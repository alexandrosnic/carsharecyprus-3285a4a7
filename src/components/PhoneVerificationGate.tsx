import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ShieldAlert } from 'lucide-react';

interface PhoneVerificationGateProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where to send the user after they verify (e.g. /book-ride/123) */
  nextPath: string;
  /** Action description, e.g. "book this ride" or "publish a ride" */
  action: string;
}

const PhoneVerificationGate: React.FC<PhoneVerificationGateProps> = ({
  open,
  onOpenChange,
  nextPath,
  action,
}) => {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <ShieldAlert className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">Phone verification required</DialogTitle>
          <DialogDescription className="text-center">
            For everyone's safety, verify your phone number before you {action}. We'll send you a one-time code via SMS.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Not now
          </Button>
          <Button
            onClick={() => navigate(`/verify-phone?next=${encodeURIComponent(nextPath)}`)}
          >
            Verify phone
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PhoneVerificationGate;
