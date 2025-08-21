import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  type: 'booking_confirmation' | 'booking_update' | 'ride_reminder' | 'payment_success';
  bookingId: string;
  recipientEmail?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase service client
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { type, bookingId, recipientEmail }: EmailRequest = await req.json();

    // Fetch booking details with related data
    const { data: booking, error: bookingError } = await supabaseService
      .from("bookings")
      .select(`
        *,
        rides!inner(
          departure_city,
          arrival_city,
          departure_time,
          price_per_seat,
          driver_id
        )
      `)
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) {
      throw new Error('Booking not found');
    }

    // Get passenger and driver profiles
    const { data: profiles } = await supabaseService
      .from("public_profiles")
      .select("user_id, full_name")
      .in("user_id", [booking.passenger_id, booking.rides.driver_id]);

    const passenger = profiles?.find(p => p.user_id === booking.passenger_id);
    const driver = profiles?.find(p => p.user_id === booking.rides.driver_id);

    // Get user emails from auth.users (service role can access this)
    const { data: authUsers } = await supabaseService.auth.admin.listUsers();
    const passengerAuth = authUsers.users.find(u => u.id === booking.passenger_id);
    const driverAuth = authUsers.users.find(u => u.id === booking.rides.driver_id);

    const formatDateTime = (datetime: string) => {
      const date = new Date(datetime);
      return date.toLocaleString('en-GB', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    let subject = '';
    let htmlContent = '';
    let recipientEmails: string[] = [];

    switch (type) {
      case 'booking_confirmation':
        subject = `Booking Confirmed: ${booking.rides.departure_city} → ${booking.rides.arrival_city}`;
        htmlContent = `
          <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
            <h1 style="color: #2563eb;">Booking Confirmed! 🚗</h1>
            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h2>Trip Details</h2>
              <p><strong>Route:</strong> ${booking.rides.departure_city} → ${booking.rides.arrival_city}</p>
              <p><strong>Date & Time:</strong> ${formatDateTime(booking.rides.departure_time)}</p>
              <p><strong>Seats Booked:</strong> ${booking.seats_booked}</p>
              <p><strong>Total Amount:</strong> €${booking.total_amount}</p>
              <p><strong>Driver:</strong> ${driver?.full_name || 'N/A'}</p>
            </div>
            <p>Thank you for booking with Carpool Cyprus! We'll send you a reminder closer to your departure time.</p>
            <p style="color: #64748b; font-size: 14px;">If you need to make changes, please contact your driver or our support team.</p>
          </div>
        `;
        recipientEmails = [passengerAuth?.email, driverAuth?.email].filter(Boolean) as string[];
        break;

      case 'payment_success':
        subject = `Payment Confirmed: ${booking.rides.departure_city} → ${booking.rides.arrival_city}`;
        htmlContent = `
          <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
            <h1 style="color: #059669;">Payment Successful! ✅</h1>
            <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h2>Payment Details</h2>
              <p><strong>Amount Paid:</strong> €${booking.total_amount}</p>
              <p><strong>Trip:</strong> ${booking.rides.departure_city} → ${booking.rides.arrival_city}</p>
              <p><strong>Date:</strong> ${formatDateTime(booking.rides.departure_time)}</p>
              <p><strong>Seats:</strong> ${booking.seats_booked}</p>
            </div>
            <p>Your payment has been processed successfully. Your seat is now confirmed!</p>
          </div>
        `;
        recipientEmails = [passengerAuth?.email].filter(Boolean) as string[];
        break;

      case 'ride_reminder':
        subject = `Reminder: Your ride is tomorrow - ${booking.rides.departure_city} → ${booking.rides.arrival_city}`;
        htmlContent = `
          <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
            <h1 style="color: #dc2626;">Ride Reminder 🚨</h1>
            <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h2>Your ride is tomorrow!</h2>
              <p><strong>Route:</strong> ${booking.rides.departure_city} → ${booking.rides.arrival_city}</p>
              <p><strong>Departure Time:</strong> ${formatDateTime(booking.rides.departure_time)}</p>
              <p><strong>Driver:</strong> ${driver?.full_name || 'N/A'}</p>
            </div>
            <p>Don't forget about your upcoming ride tomorrow. Make sure to be ready 10 minutes before departure time.</p>
          </div>
        `;
        recipientEmails = [passengerAuth?.email].filter(Boolean) as string[];
        break;

      default:
        throw new Error('Invalid email type');
    }

    // Send emails to all recipients
    const emailPromises = recipientEmails.map(email => 
      resend.emails.send({
        from: "Carpool Cyprus <noreply@carpoolcyprus.com>",
        to: [email],
        subject: subject,
        html: htmlContent,
      })
    );

    await Promise.all(emailPromises);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Email sending error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});