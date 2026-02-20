import { createClient } from "npm:@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EvolutionResponse {
  instance?: {
    instanceName?: string;
    status?: string;
  };
  qrcode?: {
    base64?: string;
    code?: string;
  };
  error?: string;
  message?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const envEvolutionApiUrl = Deno.env.get('EVOLUTION_API_URL') || ''
    const envEvolutionApiKey = Deno.env.get('EVOLUTION_API_KEY') || ''

    // Read provider config from DB (Master Admin settings take precedence)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
    const { data: providerSettings } = await adminClient
      .from('system_settings')
      .select('provider_api_url, provider_api_key')
      .limit(1)
      .maybeSingle()

    const evolutionApiUrl = providerSettings?.provider_api_url || envEvolutionApiUrl
    const evolutionApiKey = providerSettings?.provider_api_key || envEvolutionApiKey

    if (!evolutionApiUrl || !evolutionApiKey) {
      return new Response(
        JSON.stringify({ error: 'Evolution API not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const token = authHeader.replace('Bearer ', '')
    const { data: claims, error: claimsError } = await userClient.auth.getClaims(token)
    
    if (claimsError || !claims?.claims) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = claims.claims.sub as string
    const { action, instanceName, phoneNumber, message } = await req.json()

    // Normalize Evolution API URL
    const baseUrl = evolutionApiUrl.replace(/\/$/, '')

    switch (action) {
      case 'create-instance': {
        // Create instance in Evolution API
        const response = await fetch(`${baseUrl}/instance/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': evolutionApiKey,
          },
          body: JSON.stringify({
            instanceName,
            qrcode: true,
            integration: 'WHATSAPP-BAILEYS',
          }),
        })

        const data: EvolutionResponse = await response.json()
        
        if (!response.ok) {
          // If instance exists, try to connect it
          if (data.message?.includes('already') || data.error?.includes('exists')) {
            return new Response(
              JSON.stringify({ exists: true, instanceName }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
          throw new Error(data.message || data.error || 'Failed to create instance')
        }

        return new Response(
          JSON.stringify({ success: true, data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'get-qrcode': {
        // Get QR code for instance
        const response = await fetch(`${baseUrl}/instance/connect/${instanceName}`, {
          method: 'GET',
          headers: {
            'apikey': evolutionApiKey,
          },
        })

        const data: EvolutionResponse = await response.json()
        
        if (!response.ok) {
          throw new Error(data.message || 'Failed to get QR code')
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            qrcode: data.qrcode?.base64 || data.base64 || null,
            code: data.qrcode?.code || data.code || null,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'check-status': {
        // Check connection status
        const response = await fetch(`${baseUrl}/instance/connectionState/${instanceName}`, {
          method: 'GET',
          headers: {
            'apikey': evolutionApiKey,
          },
        })

        const data = await response.json()
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            state: data.instance?.state || data.state || 'unknown',
            instance: data.instance || data,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'fetch-instance-info': {
        // Get full instance info including phone number
        const response = await fetch(`${baseUrl}/instance/fetchInstances?instanceName=${instanceName}`, {
          method: 'GET',
          headers: {
            'apikey': evolutionApiKey,
          },
        })

        const data = await response.json()
        
        // Extract phone number from instance data
        let phoneNumber = null
        if (Array.isArray(data) && data.length > 0) {
          const instance = data[0]
          // ownerJid format: "5511999136884@s.whatsapp.net"
          phoneNumber = instance.ownerJid?.split('@')[0] || 
                        instance.number ||
                        instance.instance?.owner?.split('@')[0] || 
                        instance.instance?.wuid?.split('@')[0] ||
                        null
        } else if (data.instance) {
          phoneNumber = data.instance.ownerJid?.split('@')[0] ||
                        data.instance.owner?.split('@')[0] || 
                        data.instance.wuid?.split('@')[0] ||
                        null
        }
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            phoneNumber,
            data,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'send-message': {
        if (!phoneNumber || !message) {
          return new Response(
            JSON.stringify({ error: 'Phone number and message are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const response = await fetch(`${baseUrl}/message/sendText/${instanceName}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': evolutionApiKey,
          },
          body: JSON.stringify({
            number: phoneNumber,
            text: message,
          }),
        })

        const data = await response.json()
        
        if (!response.ok) {
          throw new Error(data.message || 'Failed to send message')
        }

        return new Response(
          JSON.stringify({ success: true, data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'delete-instance': {
        const response = await fetch(`${baseUrl}/instance/delete/${instanceName}`, {
          method: 'DELETE',
          headers: {
            'apikey': evolutionApiKey,
          },
        })

        const data = await response.json()
        
        return new Response(
          JSON.stringify({ success: true, data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'logout-instance': {
        const response = await fetch(`${baseUrl}/instance/logout/${instanceName}`, {
          method: 'DELETE',
          headers: {
            'apikey': evolutionApiKey,
          },
        })

        const data = await response.json()
        
        return new Response(
          JSON.stringify({ success: true, data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

  } catch (error) {
    console.error('Evolution API error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
