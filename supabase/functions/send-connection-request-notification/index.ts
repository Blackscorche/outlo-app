import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface WebhookPayload {
  type: string;
  table: string;
  schema: string;
  record: any;
  old_record: any;
}

serve(async (req: Request) => {
  try {
    const payload: WebhookPayload = await req.json();
    console.log('Received webhook payload:', payload);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const record = payload.record;
    const receiverId = record.receiver_id;

    // Get sender's profile
    const { data: senderProfile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', record.sender_id)
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

    const pushMessage = {
      to: receiverProfile.push_token,
      sound: 'default',
      title: 'New Connection Request',
      body: `${senderName} wants to connect with you`,
      data: {
        type: 'connection_request',
        senderId: record.sender_id,
        senderName: senderName,
      },
      priority: 'high',
      channelId: 'default',
    };

    console.log('Sending connection request notification:', pushMessage);

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
      message: 'Connection request notification sent',
      expoResponse: responseData 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error sending connection request notification:', errorMessage);
    return new Response(JSON.stringify({ 
      error: errorMessage 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
