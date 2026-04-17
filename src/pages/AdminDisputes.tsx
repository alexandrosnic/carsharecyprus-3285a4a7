import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, ShieldCheck, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface DisputeRow {
  id: string;
  booking_id: string;
  complainant_id: string;
  respondent_id: string;
  dispute_type: string;
  description: string;
  evidence_urls: string[] | null;
  status: string;
  resolution: string | null;
  resolved_at: string | null;
  created_at: string;
  booking?: {
    total_amount: number;
    driver_amount: number;
    commission_amount: number;
    payout_status: string;
    departure_city?: string;
    arrival_city?: string;
    departure_time?: string;
  };
  complainant_name?: string;
  respondent_name?: string;
}

const AdminDisputes = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);
  const [resolutionText, setResolutionText] = useState<Record<string, string>>({});
  const [splitAmount, setSplitAmount] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    void checkAdminAndLoad();
  }, [user]);

  const checkAdminAndLoad = async () => {
    if (!user) return;
    const { data: roleData } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin',
    });
    setIsAdmin(!!roleData);
    if (!roleData) {
      setLoading(false);
      return;
    }
    await loadDisputes();
  };

  const loadDisputes = async () => {
    setLoading(true);
    try {
      const { data: disputeRows, error } = await supabase
        .from('disputes')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Load related booking + ride + names
      const bookingIds = [...new Set(disputeRows?.map(d => d.booking_id) ?? [])];
      const userIds = [...new Set([
        ...(disputeRows?.map(d => d.complainant_id) ?? []),
        ...(disputeRows?.map(d => d.respondent_id) ?? []),
      ])];

      const [bookingsRes, profilesRes] = await Promise.all([
        supabase.from('bookings').select('id, ride_id, total_amount, driver_amount, commission_amount, payout_status').in('id', bookingIds),
        supabase.from('safe_profiles').select('user_id, full_name').in('user_id', userIds),
      ]);

      const rideIds = [...new Set((bookingsRes.data ?? []).map(b => b.ride_id))];
      const ridesRes = await supabase.from('rides').select('id, departure_city, arrival_city, departure_time').in('id', rideIds);

      const enriched: DisputeRow[] = (disputeRows ?? []).map(d => {
        const b = bookingsRes.data?.find(x => x.id === d.booking_id);
        const r = b ? ridesRes.data?.find(x => x.id === b.ride_id) : undefined;
        return {
          ...d,
          booking: b ? {
            total_amount: b.total_amount,
            driver_amount: b.driver_amount,
            commission_amount: b.commission_amount,
            payout_status: b.payout_status,
            departure_city: r?.departure_city,
            arrival_city: r?.arrival_city,
            departure_time: r?.departure_time,
          } : undefined,
          complainant_name: profilesRes.data?.find(p => p.user_id === d.complainant_id)?.full_name ?? 'Unknown',
          respondent_name: profilesRes.data?.find(p => p.user_id === d.respondent_id)?.full_name ?? 'Unknown',
        };
      });
      setDisputes(enriched);
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to load disputes');
    } finally {
      setLoading(false);
    }
  };

  const resolve = async (
    disputeId: string,
    action: 'pay_driver' | 'refund_passenger' | 'split'
  ) => {
    const resolution = resolutionText[disputeId]?.trim();
    if (!resolution || resolution.length < 5) {
      toast.error('Please write a resolution note (min 5 chars)');
      return;
    }
    const payload: Record<string, unknown> = { dispute_id: disputeId, action, resolution };
    if (action === 'split') {
      const amt = parseFloat(splitAmount[disputeId] ?? '');
      if (!amt || amt <= 0) {
        toast.error('Enter a valid passenger refund amount for split');
        return;
      }
      payload.passenger_refund_amount = amt;
    }

    setResolving(disputeId);
    try {
      const { data, error } = await supabase.functions.invoke('resolve-dispute', { body: payload });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success('Dispute resolved');
      await loadDisputes();
    } catch (err: any) {
      toast.error('Failed: ' + err.message);
    } finally {
      setResolving(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-xl font-semibold">Admin access required</h2>
            <p className="text-muted-foreground">You don't have permission to view this page.</p>
            <Button onClick={() => navigate('/')}>Go home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const open = disputes.filter(d => d.status !== 'resolved');
  const resolved = disputes.filter(d => d.status === 'resolved');

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Home
            </Button>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-primary" />
              Admin · Disputes
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <Tabs defaultValue="open">
          <TabsList>
            <TabsTrigger value="open">Open ({open.length})</TabsTrigger>
            <TabsTrigger value="resolved">Resolved ({resolved.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="open" className="space-y-4 mt-4">
            {open.length === 0 ? (
              <Card><CardContent className="p-8 text-center text-muted-foreground">No open disputes 🎉</CardContent></Card>
            ) : open.map(d => (
              <DisputeCard
                key={d.id}
                d={d}
                resolving={resolving === d.id}
                resolutionText={resolutionText[d.id] ?? ''}
                splitAmount={splitAmount[d.id] ?? ''}
                onResolutionChange={v => setResolutionText(s => ({ ...s, [d.id]: v }))}
                onSplitChange={v => setSplitAmount(s => ({ ...s, [d.id]: v }))}
                onResolve={action => resolve(d.id, action)}
              />
            ))}
          </TabsContent>

          <TabsContent value="resolved" className="space-y-4 mt-4">
            {resolved.length === 0 ? (
              <Card><CardContent className="p-8 text-center text-muted-foreground">No resolved disputes yet</CardContent></Card>
            ) : resolved.map(d => (
              <Card key={d.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      <CheckCircle className="h-3 w-3 mr-1" /> Resolved
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {d.resolved_at ? new Date(d.resolved_at).toLocaleString() : ''}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">{d.complainant_name}</span> vs{' '}
                    <span className="font-medium">{d.respondent_name}</span> · {d.dispute_type}
                  </div>
                  <p className="text-sm text-muted-foreground">{d.description}</p>
                  <p className="text-sm"><span className="font-medium">Resolution:</span> {d.resolution}</p>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

interface DisputeCardProps {
  d: DisputeRow;
  resolving: boolean;
  resolutionText: string;
  splitAmount: string;
  onResolutionChange: (v: string) => void;
  onSplitChange: (v: string) => void;
  onResolve: (action: 'pay_driver' | 'refund_passenger' | 'split') => void;
}

const DisputeCard = ({ d, resolving, resolutionText, splitAmount, onResolutionChange, onSplitChange, onResolve }: DisputeCardProps) => (
  <Card>
    <CardHeader className="pb-3">
      <CardTitle className="flex items-center justify-between text-base">
        <span className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-destructive" />
          {d.dispute_type}
        </span>
        <Badge variant={d.booking?.payout_status === 'frozen' ? 'destructive' : 'outline'}>
          {d.booking?.payout_status ?? 'unknown'}
        </Badge>
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-muted-foreground text-xs">Complainant</div>
          <div className="font-medium">{d.complainant_name}</div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs">Respondent</div>
          <div className="font-medium">{d.respondent_name}</div>
        </div>
        {d.booking && (
          <>
            <div>
              <div className="text-muted-foreground text-xs">Route</div>
              <div className="font-medium">{d.booking.departure_city} → {d.booking.arrival_city}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Departure</div>
              <div className="font-medium">{d.booking.departure_time ? new Date(d.booking.departure_time).toLocaleString() : '—'}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Total paid</div>
              <div className="font-medium">€{Number(d.booking.total_amount).toFixed(2)}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Driver / Commission</div>
              <div className="font-medium">€{Number(d.booking.driver_amount).toFixed(2)} / €{Number(d.booking.commission_amount).toFixed(2)}</div>
            </div>
          </>
        )}
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">Passenger's complaint</Label>
        <p className="text-sm mt-1 p-3 bg-muted rounded">{d.description}</p>
      </div>

      {d.evidence_urls && d.evidence_urls.length > 0 && (
        <div>
          <Label className="text-xs text-muted-foreground">Evidence</Label>
          <ul className="text-xs space-y-1 mt-1">
            {d.evidence_urls.map((u, i) => (
              <li key={i}><a className="text-primary underline" href={u} target="_blank" rel="noreferrer">Evidence #{i + 1}</a></li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-2 pt-2 border-t">
        <Label htmlFor={`res-${d.id}`}>Resolution notes (required)</Label>
        <Textarea
          id={`res-${d.id}`}
          rows={2}
          placeholder="Why are you resolving this way?"
          value={resolutionText}
          onChange={e => onResolutionChange(e.target.value)}
        />
      </div>

      <div className="grid sm:grid-cols-3 gap-2">
        <Button
          variant="outline"
          disabled={resolving}
          onClick={() => onResolve('pay_driver')}
        >
          Pay driver in full
        </Button>
        <Button
          variant="destructive"
          disabled={resolving}
          onClick={() => onResolve('refund_passenger')}
        >
          Refund passenger
        </Button>
        <div className="flex gap-2">
          <Input
            type="number"
            step="0.01"
            placeholder="Refund €"
            value={splitAmount}
            onChange={e => onSplitChange(e.target.value)}
          />
          <Button
            variant="secondary"
            disabled={resolving}
            onClick={() => onResolve('split')}
          >
            Split
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Split: passenger gets refunded the entered amount, driver gets the remainder minus the platform commission (€{Number(d.booking?.commission_amount ?? 0).toFixed(2)}).
      </p>
    </CardContent>
  </Card>
);

export default AdminDisputes;
