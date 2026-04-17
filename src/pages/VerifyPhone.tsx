import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { ArrowLeft, Phone, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { validateEUPhone, normalizePhone } from '@/lib/phoneValidation';

const RESEND_COOLDOWN_SECONDS = 60;
const MAX_SENDS_PER_HOUR = 3;

const VerifyPhone: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nextPath = searchParams.get('next') || '/profile';
  const { user } = useAuth();

  const [step, setStep] = useState<'enter' | 'verify'>('enter');
  const [phone, setPhone] = useState('+357');
  const [otp, setOtp] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!user) navigate('/auth');
  }, [user, navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendOtp = async () => {
    if (!user) return;
    const normalized = normalizePhone(phone);
    const check = validateEUPhone(normalized);
    if (!check.valid) {
      toast.error(check.error!);
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-phone-otp', {
        body: { phone: normalized },
      });
      if (error || (data && (data as any).error)) {
        toast.error((data as any)?.error || error?.message || 'Failed to send code');
        return;
      }

      setStep('verify');
      setCooldown(RESEND_COOLDOWN_SECONDS);
      toast.success('Code sent. Check your SMS.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send code');
    } finally {
      setSending(false);
    }
  };

  const verifyOtp = async () => {
    if (!user) return;
    if (otp.length !== 6) {
      toast.error('Enter the 6-digit code');
      return;
    }
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-phone-otp', {
        body: { code: otp },
      });
      if (error || (data && (data as any).error)) {
        toast.error((data as any)?.error || error?.message || 'Verification failed');
        return;
      }

      toast.success('Phone verified ✓');
      navigate(nextPath);
    } catch (err: any) {
      toast.error(err.message || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card shadow-sm border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <h1 className="text-xl font-bold">Verify Phone</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-8">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              {step === 'enter' ? (
                <Phone className="h-6 w-6 text-primary" />
              ) : (
                <ShieldCheck className="h-6 w-6 text-primary" />
              )}
            </div>
            <CardTitle>
              {step === 'enter' ? 'Enter your phone' : 'Enter the code'}
            </CardTitle>
            <CardDescription>
              {step === 'enter'
                ? 'We support Cyprus and EU numbers only. Standard SMS rates may apply.'
                : `We sent a 6-digit code to ${phone}.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {step === 'enter' ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone number</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+357 99 123456"
                    inputMode="tel"
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={sendOtp}
                  disabled={sending}
                >
                  {sending ? 'Sending…' : 'Send code'}
                </Button>
              </>
            ) : (
              <>
                <div className="flex justify-center">
                  <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <Button
                  className="w-full"
                  onClick={verifyOtp}
                  disabled={verifying || otp.length !== 6}
                >
                  {verifying ? 'Verifying…' : 'Verify'}
                </Button>
                <div className="flex justify-between text-sm">
                  <button
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setStep('enter');
                      setOtp('');
                    }}
                  >
                    Change number
                  </button>
                  <button
                    className="text-primary disabled:text-muted-foreground"
                    onClick={sendOtp}
                    disabled={cooldown > 0 || sending}
                  >
                    {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                  </button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default VerifyPhone;
