import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Shield, CheckCircle, XCircle, Clock, Upload, Sparkles, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface VerificationData {
  id?: string;
  license_number: string;
  license_image_url: string; // storage path
  vehicle_registration: string;
  vehicle_image_url: string; // storage path
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
  const [aiRunning, setAiRunning] = useState(false);
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [vehicleFile, setVehicleFile] = useState<File | null>(null);
  const [licensePreview, setLicensePreview] = useState<string | null>(null);
  const [vehiclePreview, setVehiclePreview] = useState<string | null>(null);
  const licenseRef = useRef<HTMLInputElement>(null);
  const vehicleRef = useRef<HTMLInputElement>(null);

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

        // Load preview signed URLs for existing images
        if (data.license_image_url) {
          const { data: sig } = await supabase.storage.from('driver-docs').createSignedUrl(data.license_image_url, 3600);
          if (sig?.signedUrl) setLicensePreview(sig.signedUrl);
        }
        if (data.vehicle_image_url) {
          const { data: sig } = await supabase.storage.from('driver-docs').createSignedUrl(data.vehicle_image_url, 3600);
          if (sig?.signedUrl) setVehiclePreview(sig.signedUrl);
        }
      }
    } catch (error) {
      console.error('Error fetching verification:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (kind: 'license' | 'vehicle', file: File | null) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 10MB.", variant: "destructive" });
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast({ title: "Invalid file", description: "Please upload an image.", variant: "destructive" });
      return;
    }
    const url = URL.createObjectURL(file);
    if (kind === 'license') {
      setLicenseFile(file);
      setLicensePreview(url);
    } else {
      setVehicleFile(file);
      setVehiclePreview(url);
    }
  };

  const uploadFile = async (file: File, kind: 'license' | 'vehicle'): Promise<string> => {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${user!.id}/${kind}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('driver-docs').upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type,
    });
    if (error) throw error;
    return path;
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

    // Require images: either newly selected or already saved
    if (!licenseFile && !verification.license_image_url) {
      toast({ title: "License photo required", variant: "destructive" });
      return;
    }
    if (!vehicleFile && !verification.vehicle_image_url) {
      toast({ title: "Vehicle photo required", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      // Upload any new files
      let licensePath = verification.license_image_url;
      let vehiclePath = verification.vehicle_image_url;
      if (licenseFile) licensePath = await uploadFile(licenseFile, 'license');
      if (vehicleFile) vehiclePath = await uploadFile(vehicleFile, 'vehicle');

      const verificationData = {
        driver_id: user.id,
        license_number: verification.license_number,
        license_image_url: licensePath,
        vehicle_registration: verification.vehicle_registration,
        vehicle_image_url: vehiclePath,
        insurance_covers_passengers: verification.insurance_covers_passengers,
        verification_status: 'pending' as const,
      };

      let verificationId = verification.id;
      if (verification.id) {
        const { error } = await supabase
          .from('driver_verifications')
          .update(verificationData)
          .eq('id', verification.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('driver_verifications')
          .insert(verificationData)
          .select('id')
          .single();
        if (error) throw error;
        verificationId = data.id;
      }

      toast({ title: "Documents uploaded ✅", description: "Running AI verification…" });

      // Trigger AI verification
      setAiRunning(true);
      const { data: aiData, error: aiError } = await supabase.functions.invoke('verify-driver-documents', {
        body: { verification_id: verificationId },
      });
      setAiRunning(false);

      if (aiError) {
        console.error('AI verify error:', aiError);
        toast({
          title: "AI check unavailable",
          description: "Your documents were saved and will be reviewed by our team.",
        });
      } else if (aiData?.auto_approved) {
        toast({
          title: "Verified! 🎉",
          description: `AI confirmed your details (${Math.round((aiData.confidence ?? 0) * 100)}% confidence). You're now a verified driver.`,
        });
      } else if (aiData?.skipped) {
        toast({ title: "Already verified", description: "You're verified via Stripe Identity." });
      } else {
        toast({
          title: "Submitted for review",
          description: "AI couldn't auto-approve. Our team will review within 24h.",
        });
      }

      setLicenseFile(null);
      setVehicleFile(null);
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
                    Upload your documents — our AI checks them instantly. Most drivers are verified in seconds.
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
                <pre className="text-destructive/80 text-sm whitespace-pre-wrap font-sans">{verification.admin_notes}</pre>
                <p className="text-destructive/60 text-xs mt-2">Please update your information and resubmit.</p>
              </CardContent>
            </Card>
          )}

          <form onSubmit={handleSubmit}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Verification Documents
                  <Badge variant="outline" className="ml-2"><Sparkles className="h-3 w-3 mr-1" />AI-checked</Badge>
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Clear, well-lit photos work best. The AI cross-checks your name, license number, and plate.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* License */}
                <div className="space-y-3">
                  <Label htmlFor="license_number">Driver's License Number</Label>
                  <Input
                    id="license_number"
                    value={verification.license_number}
                    onChange={(e) => setVerification(prev => ({ ...prev, license_number: e.target.value }))}
                    placeholder="As written on your license"
                    required
                    disabled={disabled}
                  />
                  <Label>License Photo</Label>
                  <div className="flex items-center gap-3">
                    <input
                      ref={licenseRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleFileSelect('license', e.target.files?.[0] || null)}
                      disabled={disabled}
                    />
                    <Button type="button" variant="outline" onClick={() => licenseRef.current?.click()} disabled={disabled}>
                      <Upload className="h-4 w-4 mr-2" />
                      {licensePreview ? 'Replace' : 'Upload'}
                    </Button>
                    {licensePreview && (
                      <img src={licensePreview} alt="License preview" className="h-16 w-24 object-cover rounded border border-border" />
                    )}
                  </div>
                </div>

                {/* Vehicle */}
                <div className="space-y-3">
                  <Label htmlFor="vehicle_registration">Plate Number</Label>
                  <Input
                    id="vehicle_registration"
                    value={verification.vehicle_registration}
                    onChange={(e) => setVerification(prev => ({ ...prev, vehicle_registration: e.target.value }))}
                    placeholder="e.g. ABC 123"
                    required
                    disabled={disabled}
                  />
                  <Label>Vehicle Photo (plate must be visible)</Label>
                  <div className="flex items-center gap-3">
                    <input
                      ref={vehicleRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleFileSelect('vehicle', e.target.files?.[0] || null)}
                      disabled={disabled}
                    />
                    <Button type="button" variant="outline" onClick={() => vehicleRef.current?.click()} disabled={disabled}>
                      <Upload className="h-4 w-4 mr-2" />
                      {vehiclePreview ? 'Replace' : 'Upload'}
                    </Button>
                    {vehiclePreview && (
                      <img src={vehiclePreview} alt="Vehicle preview" className="h-16 w-24 object-cover rounded border border-border" />
                    )}
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
                    <li>• Valid Cyprus / EU Category B driver's license (not expired)</li>
                    <li>• Current vehicle plate clearly visible in the photo</li>
                    <li>• Insurance that covers passengers (cost-sharing only — no profit)</li>
                    <li>• Photos must be clear, in focus, and well-lit</li>
                  </ul>
                </div>

                {!disabled && (
                  <div className="flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={() => navigate('/profile')}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={submitting || aiRunning}>
                      {aiRunning ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> AI checking…</>
                      ) : submitting ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading…</>
                      ) : verification.id ? 'Update & Re-verify' : 'Submit for AI Verification'}
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
