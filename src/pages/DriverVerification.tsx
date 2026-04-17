import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Shield, CheckCircle, XCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface VerificationData {
  id?: string;
  license_number: string;
  license_image_url: string;
  vehicle_registration: string;
  vehicle_image_url: string;
  insurance_covers_passengers: boolean;
  verification_status: 'pending' | 'approved' | 'rejected';
  admin_notes?: string;
}

const DriverVerification = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [verification, setVerification] = useState<VerificationData>({
    license_number: '',
    license_image_url: '',
    vehicle_registration: '',
    vehicle_image_url: '',
    insurance_covers_passengers: false,
    verification_status: 'pending'
  });

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchVerification();
  }, [user]);

  const fetchVerification = async () => {
    try {
      const { data, error } = await supabase
        .from('driver_verifications')
        .select('*')
        .eq('driver_id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setVerification({
          id: data.id,
          license_number: data.license_number || '',
          license_image_url: data.license_image_url || '',
          vehicle_registration: data.vehicle_registration || '',
          vehicle_image_url: data.vehicle_image_url || '',
          insurance_covers_passengers: (data as any).insurance_covers_passengers ?? false,
          verification_status: data.verification_status as 'pending' | 'approved' | 'rejected',
          admin_notes: data.admin_notes || undefined,
        });
      }
    } catch (error) {
      console.error('Error fetching verification:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!verification.insurance_covers_passengers) {
      toast({
        title: "Insurance confirmation required",
        description: "Please confirm your insurance covers passengers and that you will not seek to make a profit.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const verificationData = {
        driver_id: user.id,
        license_number: verification.license_number,
        license_image_url: verification.license_image_url,
        vehicle_registration: verification.vehicle_registration,
        vehicle_image_url: verification.vehicle_image_url,
        insurance_covers_passengers: verification.insurance_covers_passengers,
        verification_status: 'pending' as const,
      };

      if (verification.id) {
        const { error } = await supabase
          .from('driver_verifications')
          .update(verificationData)
          .eq('id', verification.id);
        if (error) throw error;
        toast({ title: "Verification Updated! ✅", description: "Your verification documents have been updated and are under review." });
      } else {
        const { error } = await supabase
          .from('driver_verifications')
          .insert(verificationData);
        if (error) throw error;
        toast({ title: "Verification Submitted! ✅", description: "Your verification documents have been submitted for review." });
      }

      fetchVerification();
    } catch (error: any) {
      toast({ title: "Submission Error", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge variant="secondary" className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Verified</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Pending Review</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-12 w-12 animate-pulse mx-auto mb-4 text-primary" />
          <p>Loading verification status...</p>
        </div>
      </div>
    );
  }

  const disabled = verification.verification_status === 'approved';

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <Button variant="ghost" onClick={() => navigate('/profile')} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Profile
        </Button>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Driver Verification
                  </CardTitle>
                  <p className="text-muted-foreground mt-1">
                    Verify your driver credentials to gain passenger trust and increase bookings
                  </p>
                </div>
                {verification.verification_status && getStatusBadge(verification.verification_status)}
              </div>
            </CardHeader>
          </Card>

          {verification.verification_status === 'rejected' && verification.admin_notes && (
            <Card className="border-destructive">
              <CardContent className="pt-6">
                <h4 className="font-medium text-destructive mb-2">Verification Rejected</h4>
                <p className="text-destructive/80 text-sm">{verification.admin_notes}</p>
                <p className="text-destructive/60 text-xs mt-2">Please update your information and resubmit.</p>
              </CardContent>
            </Card>
          )}

          <form onSubmit={handleSubmit}>
            <Card>
              <CardHeader>
                <CardTitle>Verification Documents</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Please provide clear, high-quality images of your documents
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="license_number">Driver's License Number</Label>
                    <Input
                      id="license_number"
                      value={verification.license_number}
                      onChange={(e) => setVerification(prev => ({ ...prev, license_number: e.target.value }))}
                      placeholder="Enter license number"
                      required
                      disabled={disabled}
                    />
                  </div>
                  <div>
                    <Label htmlFor="license_image">License Image URL</Label>
                    <Input
                      id="license_image"
                      type="url"
                      value={verification.license_image_url}
                      onChange={(e) => setVerification(prev => ({ ...prev, license_image_url: e.target.value }))}
                      placeholder="Upload and paste image URL"
                      required
                      disabled={disabled}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="vehicle_registration">Plate Number</Label>
                    <Input
                      id="vehicle_registration"
                      value={verification.vehicle_registration}
                      onChange={(e) => setVerification(prev => ({ ...prev, vehicle_registration: e.target.value }))}
                      placeholder="e.g. ABC 123"
                      required
                      disabled={disabled}
                    />
                  </div>
                  <div>
                    <Label htmlFor="vehicle_image">Vehicle Image URL</Label>
                    <Input
                      id="vehicle_image"
                      type="url"
                      value={verification.vehicle_image_url}
                      onChange={(e) => setVerification(prev => ({ ...prev, vehicle_image_url: e.target.value }))}
                      placeholder="Upload and paste image URL"
                      required
                      disabled={disabled}
                    />
                  </div>
                </div>

                <div className="bg-accent/30 p-4 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="insurance_covers_passengers"
                      checked={verification.insurance_covers_passengers}
                      onCheckedChange={(checked) => setVerification(prev => ({ ...prev, insurance_covers_passengers: checked === true }))}
                      disabled={disabled}
                      className="mt-1"
                    />
                    <Label htmlFor="insurance_covers_passengers" className="text-sm leading-relaxed cursor-pointer">
                      I certify that I hold a valid Category B driving licence, that my vehicle is covered by a valid insurance policy that allows for non-profit carpooling, and that I will not seek to make a profit from these trips.
                    </Label>
                  </div>
                </div>

                <div className="bg-accent/30 p-4 rounded-lg">
                  <h4 className="font-medium text-foreground mb-2">Verification Requirements</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Valid driver's license (not expired)</li>
                    <li>• Current vehicle plate number</li>
                    <li>• Clear photo of your vehicle</li>
                    <li>• Insurance that covers passengers (cost-sharing only — no profit)</li>
                    <li>• All images must be clearly visible and readable</li>
                  </ul>
                </div>

                {!disabled && (
                  <div className="flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={() => navigate('/profile')}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting ? 'Submitting...' : verification.id ? 'Update Verification' : 'Submit for Verification'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </form>
        </div>
      </div>
    </div>
  );
};

export default DriverVerification;
