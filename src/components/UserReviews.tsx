import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Star, MessageSquare } from 'lucide-react';

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  rater_name: string;
}

interface UserReviewsProps {
  userId: string;
  label?: string;
}

const UserReviews = ({ userId, label = 'Reviews' }: UserReviewsProps) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReviews();
  }, [userId]);

  const fetchReviews = async () => {
    try {
      const { data: ratingsData, error } = await supabase
        .from('ratings')
        .select('id, rating, comment, created_at, rater_id')
        .eq('rated_user_id', userId)
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
    } finally {
      setLoading(false);
    }
  };

  if (loading) return null;
  if (reviews.length === 0) return null;

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          {label} ({reviews.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {reviews.map((review) => (
            <div key={review.id} className="border-b border-border last:border-0 pb-4 last:pb-0">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-xs">
                      {review.rater_name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium text-sm">{review.rater_name}</span>
                </div>
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-3.5 w-3.5 ${i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`}
                    />
                  ))}
                </div>
              </div>
              {review.comment && (
                <p className="text-sm text-muted-foreground mt-1 ml-9">{review.comment}</p>
              )}
              <p className="text-xs text-muted-foreground/60 mt-1 ml-9">
                {new Date(review.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default UserReviews;
