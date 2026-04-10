import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Camera, Star, User, Phone, Mail, Save, Shield, Loader2, MessageSquare, Banknote, ExternalLink } from 'lucide-react';
import { BRAND_LOGO } from '@/constants/brand';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface ProfileData {
  id?: string;
  full_name: string;
  phone_number: string;
  avatar_url: string;
  rating: number;
  total_rides: number;
  stripe_account_id?: string;
  stripe_onboarding_complete?: boolean;
}

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  rater_name: string;
}

const Profile = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [profileData, setProfileData] = useState<ProfileData>({
    full_name: '',
    phone_number: '',
    avatar_url: '',
    rating: 5.0,
    total_rides: 0,
  });

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchReviews();
    }
    // Handle Stripe Connect return
    const params = new URLSearchParams(window.location.search);
    if (params.get('stripe') === 'complete') {
      toast.success('Stripe setup complete! Checking status...');
      // Clean URL
      window.history.replaceState({}, '', '/profile');
    }
  }, [user]);

  const fetchReviews = async () => {
    if (!user) return;
    try {
      const { data: ratingsData, error } = await supabase
        .from('ratings')
        .select('id, rating, comment, created_at, rater_id')
        .eq('rated_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      if (ratingsData && ratingsData.length > 0) {
        const raterIds = ratingsData.map(r => r.rater_id);
        const { data: profiles } = await supabase
          .from('safe_profiles')
          .select('user_id, full_name')
          .in('user_id', raterIds);

        setReviews(ratingsData.map(r => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          created_at: r.created_at,
          rater_name: profiles?.find(p => p.user_id === r.rater_id)?.full_name || 'Anonymous',
        })));
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
    }
  };

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setProfileData({
          id: data.id,
          full_name: data.full_name || '',
          phone_number: data.phone_number || '',
          avatar_url: data.avatar_url || '',
          rating: data.rating || 5.0,
          total_rides: data.total_rides || 0,
          stripe_account_id: (data as any).stripe_account_id || undefined,
          stripe_onboarding_complete: (data as any).stripe_onboarding_complete || false,
        });
      }
    } catch (error: any) {
      console.error('Error fetching profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be smaller than 2MB');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Add cache buster
      const avatarUrl = `${publicUrl}?t=${Date.now()}`;

      setProfileData(prev => ({ ...prev, avatar_url: avatarUrl }));

      // Save immediately
      await supabase
        .from('profiles')
        .upsert({
          user_id: user.id,
          avatar_url: avatarUrl,
          full_name: profileData.full_name,
          updated_at: new Date().toISOString(),
        });

      toast.success('Profile photo updated!');
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      toast.error('Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const saveProfile = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          user_id: user.id,
          full_name: profileData.full_name,
          phone_number: profileData.phone_number,
          avatar_url: profileData.avatar_url,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      toast.success('Profile saved successfully!');
    } catch (error: any) {
      console.error('Error saving profile:', error);
      toast.error('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: keyof ProfileData, value: string) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <img 
            src={BRAND_LOGO} 
            alt="Car Share Cyprus Logo" 
            className="h-12 w-12 animate-spin mx-auto mb-4" 
          />
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card shadow-sm border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/')}
              className="flex items-center"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
            <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid gap-8">
          {/* Profile Overview Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={profileData.avatar_url} />
                    <AvatarFallback className="text-2xl">
                      {profileData.full_name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full p-0"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <div className="flex-1">
                  <CardTitle className="text-2xl">{profileData.full_name || 'Complete your profile'}</CardTitle>
                  <CardDescription>{user?.email}</CardDescription>
                  <div className="flex items-center space-x-4 mt-2">
                    <div className="flex items-center space-x-1">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span className="font-medium">{profileData.rating.toFixed(1)}</span>
                    </div>
                    <Badge variant="secondary">
                      {profileData.total_rides} rides completed
                    </Badge>
                  </div>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Profile Information */}
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Update your personal details and contact information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="full_name"
                      value={profileData.full_name}
                      onChange={(e) => handleInputChange('full_name', e.target.value)}
                      className="pl-9"
                      placeholder="Enter your full name"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone_number">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone_number"
                      value={profileData.phone_number}
                      onChange={(e) => handleInputChange('phone_number', e.target.value)}
                      className="pl-9"
                      placeholder="+357 99 123456"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      value={user?.email || ''}
                      disabled
                      className="pl-9 bg-muted"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">Email cannot be changed</p>
                </div>
              </div>

              <Separator />

              <Button 
                onClick={saveProfile} 
                disabled={saving}
                className="w-full"
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Profile'}
              </Button>
            </CardContent>
          </Card>

          {/* Driver Payouts - Stripe Connect */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Banknote className="h-5 w-5" />
                Driver Payouts
              </CardTitle>
              <CardDescription>
                {profileData.stripe_onboarding_complete
                  ? 'Your payouts are set up. You receive 90% of each fare automatically.'
                  : 'Set up automatic payouts to receive your share (90%) of ride fares directly to your bank account.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Button
                  variant={profileData.stripe_onboarding_complete ? "outline" : "default"}
                  className="w-full"
                  disabled={stripeLoading}
                  onClick={async () => {
                    setStripeLoading(true);
                    try {
                      const { data, error } = await supabase.functions.invoke('create-connect-account', {
                        body: { return_url: window.location.origin + '/profile' },
                      });
                      if (error) throw error;
                      if (data?.url) {
                        window.open(data.url, '_blank');
                      }
                      if (data?.onboarding_complete) {
                        setProfileData(prev => ({ ...prev, stripe_onboarding_complete: true }));
                      }
                    } catch (error: any) {
                      console.error('Stripe Connect error:', error);
                      toast.error('Failed to set up payouts');
                    } finally {
                      setStripeLoading(false);
                    }
                  }}
                >
                  {stripeLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ExternalLink className="h-4 w-4 mr-2" />
                  )}
                  {profileData.stripe_onboarding_complete
                    ? 'Open Stripe Dashboard'
                    : 'Set Up Payouts'}
                </Button>

                {profileData.stripe_onboarding_complete && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <Shield className="h-4 w-4" />
                    Payouts active — 90% of fares sent to your bank
                  </div>
                )}

                <Separator />

                <Button 
                  variant="outline" 
                  onClick={() => navigate('/driver-verification')}
                  className="w-full"
                >
                  <Shield className="h-4 w-4 mr-2" />
                  Driver Verification
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => navigate('/payment-history')}
                >
                  View Payment History
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Ride Statistics */}
          <Card>
            <CardHeader>
              <CardTitle>Ride Statistics</CardTitle>
              <CardDescription>Your activity as driver and passenger</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-accent/50 rounded-lg">
                  <div className="text-2xl font-bold text-primary">{profileData.total_rides}</div>
                  <div className="text-sm text-muted-foreground">Total Rides</div>
                </div>
                <div className="text-center p-4 bg-accent/50 rounded-lg">
                  <div className="text-2xl font-bold text-primary">{profileData.rating.toFixed(1)}</div>
                  <div className="text-sm text-muted-foreground">Average Rating</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Reviews */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Recent Reviews
              </CardTitle>
              <CardDescription>What others say about you</CardDescription>
            </CardHeader>
            <CardContent>
              {reviews.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No reviews yet</p>
              ) : (
                <div className="space-y-4">
                  {reviews.map((review) => (
                    <div key={review.id} className="border-b last:border-0 pb-4 last:pb-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">{review.rater_name}</span>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`h-3 w-3 ${i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`}
                            />
                          ))}
                        </div>
                      </div>
                      {review.comment && (
                        <p className="text-sm text-muted-foreground">{review.comment}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(review.created_at).toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Profile;
