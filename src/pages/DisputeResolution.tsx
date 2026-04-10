import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, AlertTriangle, MessageSquare, FileText, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Dispute {
  id: string;
  booking_id: string;
  complainant_id: string;
  respondent_id: string;
  dispute_type: string;
  description: string;
  evidence_urls: string[];
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  resolution?: string;
  created_at: string;
  booking?: any; // Using any for complex nested type from Supabase
}

const DisputeResolution = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get('bookingId');
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [showForm, setShowForm] = useState(false);
  
  const [newDispute, setNewDispute] = useState({
    dispute_type: '',
    description: '',
    evidence_urls: ['']
  });

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchDisputes();
  }, [user]);

  const fetchDisputes = async () => {
    try {
      let query = supabase
        .from('disputes')
        .select(`
          *,
          booking:bookings!inner(
            rides!inner(departure_city, arrival_city, departure_time)
          )
        `)
        .or(`complainant_id.eq.${user?.id},respondent_id.eq.${user?.id}`);

      if (bookingId) {
        query = query.eq('booking_id', bookingId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      setDisputes((data || []).map(dispute => ({
        ...dispute,
        status: dispute.status as 'open' | 'investigating' | 'resolved' | 'closed'
      })) as Dispute[]);
    } catch (error) {
      console.error('Error fetching disputes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !bookingId) return;

    // First, get booking details to determine respondent
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        rides!inner(driver_id)
      `)
      .eq('id', bookingId)
      .single();

    if (bookingError) {
      toast({
        title: "Error",
        description: "Could not find booking details",
        variant: "destructive",
      });
      return;
    }

    const respondentId = booking.passenger_id === user.id 
      ? booking.rides.driver_id 
      : booking.passenger_id;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('disputes')
        .insert({
          booking_id: bookingId,
          complainant_id: user.id,
          respondent_id: respondentId,
          dispute_type: newDispute.dispute_type,
          description: newDispute.description,
          evidence_urls: newDispute.evidence_urls.filter(url => url.trim())
        });

      if (error) throw error;

      toast({
        title: "Dispute Submitted ✅",
        description: "Your dispute has been submitted and is under review.",
      });

      setShowForm(false);
      setNewDispute({ dispute_type: '', description: '', evidence_urls: [''] });
      fetchDisputes();
    } catch (error: any) {
      toast({
        title: "Submission Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'resolved':
        return <Badge variant="secondary" className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Resolved</Badge>;
      case 'investigating':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800"><MessageSquare className="h-3 w-3 mr-1" />Investigating</Badge>;
      case 'closed':
        return <Badge variant="outline">Closed</Badge>;
      default:
        return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Open</Badge>;
    }
  };

  const addEvidenceUrl = () => {
    setNewDispute(prev => ({
      ...prev,
      evidence_urls: [...prev.evidence_urls, '']
    }));
  };

  const updateEvidenceUrl = (index: number, value: string) => {
    setNewDispute(prev => ({
      ...prev,
      evidence_urls: prev.evidence_urls.map((url, i) => i === index ? value : url)
    }));
  };

  const removeEvidenceUrl = (index: number) => {
    setNewDispute(prev => ({
      ...prev,
      evidence_urls: prev.evidence_urls.filter((_, i) => i !== index)
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 animate-pulse mx-auto mb-4 text-primary" />
          <p>Loading disputes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/my-trips')}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to My Trips
        </Button>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Dispute Resolution Center
                </CardTitle>
                {bookingId && !showForm && disputes.length === 0 && (
                  <Button onClick={() => setShowForm(true)}>
                    File Dispute
                  </Button>
                )}
              </div>
            </CardHeader>
          </Card>

          {showForm && (
            <Card>
              <CardHeader>
                <CardTitle>File a New Dispute</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Please provide detailed information about your dispute
                </p>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <Label htmlFor="dispute_type">Dispute Type</Label>
                    <Select
                      value={newDispute.dispute_type}
                      onValueChange={(value) => setNewDispute(prev => ({ ...prev, dispute_type: value }))}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select dispute type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="payment">Payment Issue</SelectItem>
                        <SelectItem value="no_show">No Show</SelectItem>
                        <SelectItem value="behavior">Inappropriate Behavior</SelectItem>
                        <SelectItem value="vehicle_issue">Vehicle Issue</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={newDispute.description}
                      onChange={(e) => setNewDispute(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Please describe the issue in detail..."
                      rows={4}
                      required
                    />
                  </div>

                  <div>
                    <Label>Evidence (Optional)</Label>
                    <p className="text-sm text-muted-foreground mb-2">
                      Upload images or documents that support your case
                    </p>
                    {newDispute.evidence_urls.map((url, index) => (
                      <div key={index} className="flex items-center gap-2 mb-2">
                        <Input
                          type="url"
                          value={url}
                          onChange={(e) => updateEvidenceUrl(index, e.target.value)}
                          placeholder="Paste evidence URL (image/document)"
                        />
                        {newDispute.evidence_urls.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeEvidenceUrl(index)}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addEvidenceUrl}
                      className="mt-2"
                    >
                      Add Evidence
                    </Button>
                  </div>

                  <div className="flex justify-end gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowForm(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting ? 'Submitting...' : 'Submit Dispute'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Your Disputes</h3>
            {disputes.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No disputes found</p>
                </CardContent>
              </Card>
            ) : (
              disputes.map((dispute) => (
                <Card key={dispute.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h4 className="font-medium capitalize">
                          {dispute.dispute_type.replace('_', ' ')} Dispute
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          Trip: {dispute.booking?.rides?.departure_city} → {dispute.booking?.rides?.arrival_city}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Filed: {new Date(dispute.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      {getStatusBadge(dispute.status)}
                    </div>
                    
                    <p className="text-sm mb-3">{dispute.description}</p>
                    
                    {dispute.evidence_urls?.length > 0 && (
                      <div className="text-sm">
                        <span className="font-medium">Evidence: </span>
                        {dispute.evidence_urls.length} file(s) attached
                      </div>
                    )}
                    
                    {dispute.resolution && (
                      <div className="mt-3 p-3 bg-green-50 rounded-lg">
                        <h5 className="font-medium text-green-800 mb-1">Resolution</h5>
                        <p className="text-sm text-green-700">{dispute.resolution}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DisputeResolution;