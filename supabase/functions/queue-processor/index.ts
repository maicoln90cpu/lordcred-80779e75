import { createClient } from "npm:@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface QueueItem {
  id: string
  chip_id: string
  recipient_phone: string
  message_content: string
  scheduled_at: string
  status: string
  priority: number
  attempts: number
  max_attempts: number
  error_message: string | null
  chips?: {
    instance_name: string
    status: string
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')!
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')!

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const now = new Date()

    // Get pending queue items that are ready to be sent
    const { data: queueItems, error: queueError } = await adminClient
      .from('message_queue')
      .select(`
        *,
        chips (
          instance_name,
          status
        )
      `)
      .eq('status', 'pending')
      .lte('scheduled_at', now.toISOString())
      .order('priority', { ascending: false })
      .order('scheduled_at', { ascending: true })
      .limit(10)

    if (queueError) {
      throw queueError
    }

    if (!queueItems || queueItems.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, message: 'No items to process', processed: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const baseUrl = evolutionApiUrl.replace(/\/$/, '')
    let processed = 0
    let failed = 0

    for (const item of queueItems as QueueItem[]) {
      // Check if chip is still connected
      if (!item.chips || item.chips.status !== 'connected') {
        console.log(`Chip not connected for queue item ${item.id}, skipping`)
        
        // Update attempts and potentially mark as failed
        if (item.attempts + 1 >= item.max_attempts) {
          await adminClient
            .from('message_queue')
            .update({
              status: 'failed',
              attempts: item.attempts + 1,
              error_message: 'Chip disconnected',
              processed_at: now.toISOString(),
            })
            .eq('id', item.id)
          failed++
        } else {
          await adminClient
            .from('message_queue')
            .update({
              attempts: item.attempts + 1,
              error_message: 'Chip not connected, will retry',
            })
            .eq('id', item.id)
        }
        continue
      }

      // Mark as processing
      await adminClient
        .from('message_queue')
        .update({ status: 'processing' })
        .eq('id', item.id)

      try {
        // Send message via Evolution API
        const response = await fetch(`${baseUrl}/message/sendText/${item.chips.instance_name}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': evolutionApiKey,
          },
          body: JSON.stringify({
            number: item.recipient_phone,
            text: item.message_content,
          }),
        })

        if (response.ok) {
          // Mark as sent
          await adminClient
            .from('message_queue')
            .update({
              status: 'sent',
              processed_at: now.toISOString(),
            })
            .eq('id', item.id)

          // Record in message history
          await adminClient
            .from('message_history')
            .insert({
              chip_id: item.chip_id,
              message_content: item.message_content,
              direction: 'outgoing',
              status: 'sent',
              recipient_phone: item.recipient_phone,
            })

          // Update chip's message count
          await adminClient
            .from('chips')
            .update({
              last_message_at: now.toISOString(),
            })
            .eq('id', item.chip_id)

          processed++
          console.log(`Queue item ${item.id} sent successfully`)
        } else {
          const errorData = await response.json()
          const errorMsg = errorData.message || 'Send failed'
          
          if (item.attempts + 1 >= item.max_attempts) {
            await adminClient
              .from('message_queue')
              .update({
                status: 'failed',
                attempts: item.attempts + 1,
                error_message: errorMsg,
                processed_at: now.toISOString(),
              })
              .eq('id', item.id)
            failed++
          } else {
            await adminClient
              .from('message_queue')
              .update({
                status: 'pending',
                attempts: item.attempts + 1,
                error_message: errorMsg,
              })
              .eq('id', item.id)
          }
          
          console.error(`Failed to send queue item ${item.id}:`, errorMsg)
        }
      } catch (error) {
        const errorMsg = error.message || 'Network error'
        
        if (item.attempts + 1 >= item.max_attempts) {
          await adminClient
            .from('message_queue')
            .update({
              status: 'failed',
              attempts: item.attempts + 1,
              error_message: errorMsg,
              processed_at: now.toISOString(),
            })
            .eq('id', item.id)
          failed++
        } else {
          await adminClient
            .from('message_queue')
            .update({
              status: 'pending',
              attempts: item.attempts + 1,
              error_message: errorMsg,
            })
            .eq('id', item.id)
        }
        
        console.error(`Error processing queue item ${item.id}:`, error)
      }
    }

    return new Response(
      JSON.stringify({ 
        ok: true, 
        processed, 
        failed,
        total: queueItems.length 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Queue processor error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
