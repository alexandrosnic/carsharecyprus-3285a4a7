import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface PhoneVerificationStatus {
  loading: boolean;
  phoneVerified: boolean;
  phoneNumber: string | null;
  refresh: () => Promise<void>;
}

export const usePhoneVerification = (): PhoneVerificationStatus => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);

  const fetchStatus = async () => {
    if (!user) {
      setPhoneVerified(false);
      setPhoneNumber(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('phone_number, phone_verified')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!error && data) {
      setPhoneVerified(!!(data as any).phone_verified);
      setPhoneNumber((data as any).phone_number ?? null);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return { loading, phoneVerified, phoneNumber, refresh: fetchStatus };
};
