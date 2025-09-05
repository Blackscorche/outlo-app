
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { record } = await req.json()
    
    // Check if the user is female
    if (record.gender === 'female') {
      console.log('Granting VIP privileges to female user:', record.id)
      
      // Get user email from auth.users
      const { data: authUser, error: authError } = await supabaseClient.auth.admin.getUserById(record.id)
      
      if (authError) {
        console.error('Error fetching auth user:', authError)
        return new Response(JSON.stringify({ error: 'Failed to fetch user' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Use UPSERT to either create or update the subscriber record with VIP privileges
      const { error: subscriberError } = await supabaseClient
        .from('subscribers')
        .upsert({
          user_id: record.id,
          email: authUser.user.email,
          subscription_tier: 'vip',
          subscribed: true,
          subscription_end: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString(), // 10 years
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'email',
          ignoreDuplicates: false
        })

      if (subscriberError) {
        console.error('Error creating/updating subscriber record:', subscriberError)
        return new Response(JSON.stringify({ error: 'Failed to grant VIP privileges' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      console.log('Successfully granted VIP privileges to female user:', record.id)
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error in auto-grant-vip function:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
