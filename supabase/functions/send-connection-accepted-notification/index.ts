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
    const senderId = record.sender_id; // The person who SENT the request (now accepting)

    // Get receiver's profile (the person accepting the request)
    const { data: receiverProfile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', record.receiver_id)
      .single();

    const receiverName = receiverProfile?.name || 'Someone';

    // Get sender's push token (the person who SENT the request)
    const { data: senderProfile } = await supabase
      .from('profiles')
      .select('push_token')
      .eq('id', senderId)
      .single();

    if (!senderProfile?.push_token) {
      console.log('Sender has no push token, skipping notification');
      return new Response(JSON.stringify({ message: 'No push token found' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const pushMessage = {
      to: senderProfile.push_token,
      sound: 'default',
      title: 'Connection Accepted! 🎉',
      body: `${receiverName} accepted your connection request`,
      data: {
        type: 'connection_accepted',
        receiverId: record.receiver_id,
        receiverName: receiverName,
      },
      priority: 'high',
      channelId: 'default',
    };

    console.log('Sending connection accepted notification:', pushMessage);

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
      message: 'Connection accepted notification sent',
      expoResponse: responseData 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error sending connection accepted notification:', errorMessage);
    return new Response(JSON.stringify({ 
      error: errorMessage 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
