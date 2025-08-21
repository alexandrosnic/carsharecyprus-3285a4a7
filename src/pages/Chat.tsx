import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Send, MessageCircle, Phone } from 'lucide-react';
import { toast } from 'sonner';

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  created_at: string;
  read_at?: string;
}

interface ChatInfo {
  ride_id: string;
  departure_city: string;
  arrival_city: string;
  departure_time: string;
  other_user: {
    user_id: string;
    full_name: string;
    avatar_url: string;
    phone_number?: string;
  };
  user_role: 'driver' | 'passenger';
}

const Chat = () => {
  const { rideId } = useParams<{ rideId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [chatInfo, setChatInfo] = useState<ChatInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (rideId) {
      fetchChatInfo();
      fetchMessages();
    }
  }, [rideId, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchChatInfo = async () => {
    if (!user) return;

    try {
      // Get ride details
      const { data: rideData, error: rideError } = await supabase
        .from('rides')
        .select('*')
        .eq('id', rideId)
        .single();

      if (rideError) throw rideError;

      // Determine user role and other party
      const isDriver = rideData.driver_id === user.id;
      let otherUserId: string;
      let userRole: 'driver' | 'passenger';

      if (isDriver) {
        // Driver chatting with passenger - get passenger from bookings
        const { data: bookingData, error: bookingError } = await supabase
          .from('bookings')
          .select('passenger_id')
          .eq('ride_id', rideId)
          .eq('status', 'confirmed')
          .single();

        if (bookingError) throw bookingError;
        otherUserId = bookingData.passenger_id;
        userRole = 'driver';
      } else {
        // Passenger chatting with driver
        otherUserId = rideData.driver_id;
        userRole = 'passenger';
      }

      // Get other user's profile (using public view for security)
      const { data: profileData, error: profileError } = await supabase
        .from('public_profiles')
        .select('user_id, full_name, avatar_url')
        .eq('user_id', otherUserId)
        .single();

      if (profileError) throw profileError;

      setChatInfo({
        ride_id: rideData.id,
        departure_city: rideData.departure_city,
        arrival_city: rideData.arrival_city,
        departure_time: rideData.departure_time,
        other_user: profileData,
        user_role: userRole
      });
    } catch (error: any) {
      console.error('Error fetching chat info:', error);
      toast.error('Failed to load chat information');
      navigate('/my-trips');
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    if (!user || !rideId) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('ride_id', rideId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);

      // Mark messages as read
      const unreadMessages = data?.filter(msg => 
        msg.receiver_id === user.id && !msg.read_at
      ) || [];

      if (unreadMessages.length > 0) {
        await supabase
          .from('messages')
          .update({ read_at: new Date().toISOString() })
          .in('id', unreadMessages.map(msg => msg.id));
      }
    } catch (error: any) {
      console.error('Error fetching messages:', error);
      toast.error('Failed to load messages');
    }
  };

  const sendMessage = async () => {
    if (!user || !chatInfo || !newMessage.trim()) return;

    setSending(true);
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          ride_id: rideId,
          sender_id: user.id,
          receiver_id: chatInfo.other_user.user_id,
          message: newMessage.trim()
        });

      if (error) throw error;

      setNewMessage('');
      fetchMessages(); // Refresh messages
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (timeString: string) => {
    return new Date(timeString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const formatDate = (timeString: string) => {
    const date = new Date(timeString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <MessageCircle className="h-12 w-12 animate-pulse mx-auto mb-4 text-primary" />
          <p>Loading chat...</p>
        </div>
      </div>
    );
  }

  if (!chatInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <MessageCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h2 className="text-xl font-semibold mb-2">Chat not available</h2>
          <p className="text-muted-foreground mb-4">Unable to load chat information</p>
          <Button onClick={() => navigate('/my-trips')}>
            Back to My Trips
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate('/my-trips')}
                className="flex items-center"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              
              <div className="flex items-center space-x-3">
                <Avatar>
                  <AvatarImage src={chatInfo.other_user.avatar_url} />
                  <AvatarFallback>
                    {chatInfo.other_user.full_name?.split(' ').map(n => n[0]).join('') || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h1 className="text-lg font-semibold">{chatInfo.other_user.full_name}</h1>
                  <p className="text-sm text-muted-foreground">
                    {chatInfo.departure_city} → {chatInfo.arrival_city}
                  </p>
                </div>
              </div>
            </div>

            {chatInfo.other_user.phone_number && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`tel:${chatInfo.other_user.phone_number}`)}
              >
                <Phone className="h-4 w-4 mr-2" />
                Call
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Chat Messages */}
      <main className="max-w-4xl mx-auto px-4 py-4 h-[calc(100vh-200px)] flex flex-col">
        <Card className="flex-1 flex flex-col">
          <CardContent className="flex-1 flex flex-col p-0">
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  messages.map((message, index) => {
                    const isOwnMessage = message.sender_id === user?.id;
                    const prevMessage = messages[index - 1];
                    const showDate = !prevMessage || 
                      formatDate(message.created_at) !== formatDate(prevMessage.created_at);

                    return (
                      <div key={message.id}>
                        {showDate && (
                          <div className="flex justify-center my-4">
                            <span className="bg-muted px-3 py-1 rounded-full text-sm text-muted-foreground">
                              {formatDate(message.created_at)}
                            </span>
                          </div>
                        )}
                        
                        <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-xs lg:max-w-md ${
                            isOwnMessage 
                              ? 'bg-primary text-primary-foreground' 
                              : 'bg-muted'
                          } rounded-lg px-3 py-2`}>
                            <p className="text-sm">{message.message}</p>
                            <p className={`text-xs mt-1 ${
                              isOwnMessage 
                                ? 'text-primary-foreground/70' 
                                : 'text-muted-foreground'
                            }`}>
                              {formatTime(message.created_at)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Message Input */}
            <div className="border-t p-4">
              <div className="flex space-x-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type a message..."
                  disabled={sending}
                />
                <Button 
                  onClick={sendMessage}
                  disabled={sending || !newMessage.trim()}
                  size="sm"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Chat;