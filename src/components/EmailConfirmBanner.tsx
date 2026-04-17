import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Mail, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const EmailConfirmBanner: React.FC = () => {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);

  if (!user || dismissed) return null;
  // Skip if email is already confirmed
  if ((user as any).email_confirmed_at) return null;
  if (!user.email) return null;

  const resend = async () => {
    setSending(true);
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: user.email!,
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    setSending(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Confirmation email sent — check your inbox.');
    }
  };

  return (
    <div className="bg-primary/10 border-b border-primary/20 text-foreground">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-3 text-sm">
        <Mail className="h-4 w-4 text-primary shrink-0" />
        <span className="flex-1">
          Please confirm your email <span className="font-medium">{user.email}</span> to keep full access.
        </span>
        <Button size="sm" variant="ghost" onClick={resend} disabled={sending}>
          {sending ? 'Sending…' : 'Resend'}
        </Button>
        <button
          onClick={() => setDismissed(true)}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default EmailConfirmBanner;
