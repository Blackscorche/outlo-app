import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface NotificationPayload {
  type: 'INSERT';
  table: string;
  schema: string;
  record: {
    id: string;
    chat_room_id: string;
    sender_id: string;
    content: string;
    created_at: string;
    is_read: boolean;
  };
  old_record: null;
}

serve(async (req) => {
  try {
    // Get the webhook payload
    const payload: NotificationPayload = await req.json();
    console.log('Received webhook payload:', payload);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const message = payload.record;

    // Get chat room info to find the receiver
    const { data: chatRoom, error: chatRoomError } = await supabase
      .from('chat_rooms')
      .select('user1_id, user2_id')
      .eq('id', message.chat_room_id)
      .single();

    if (chatRoomError || !chatRoom) {
      console.error('Error fetching chat room:', chatRoomError);
      return new Response(JSON.stringify({ error: 'Chat room not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Determine receiver (the one who is NOT the sender)
    const receiverId = chatRoom.user1_id === message.sender_id 
      ? chatRoom.user2_id 
      : chatRoom.user1_id;

    // Get sender's profile for notification
    const { data: senderProfile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', message.sender_id)
      .single();

    const senderName = senderProfile?.name || 'Someone';

    // Get receiver's push token
    const { data: receiverProfile } = await supabase
      .from('profiles')
      .select('push_token')
      .eq('id', receiverId)
      .single();

    if (!receiverProfile?.push_token) {
      console.log('Receiver has no push token, skipping notification');
      return new Response(JSON.stringify({ message: 'No push token found' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Truncate message content if too long
    const messageBody = message.content.length > 100 
      ? `${message.content.substring(0, 100)}...` 
      : message.content;

    // Send push notification via Expo
    const pushMessage = {
      to: receiverProfile.push_token,
      sound: 'default',
      title: `New message from ${senderName}`,
      body: messageBody,
      data: {
        type: 'message',
        roomId: message.chat_room_id,
        otherUserId: message.sender_id,
        senderName: senderName,
      },
      priority: 'high',
      channelId: 'default',
    };

    console.log('Sending push notification:', pushMessage);

    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pushMessage),
    });

    const responseData = await response.json();
    console.log('Expo push response:', responseData);

    if (!response.ok) {
      throw new Error(`Expo push failed: ${JSON.stringify(responseData)}`);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Push notification sent',
      expoResponse: responseData 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error sending push notification:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
