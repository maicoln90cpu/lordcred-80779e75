import { createClient } from 'npm:@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const corbanUrl = Deno.env.get('CORBAN_API_URL')
    const corbanUsername = Deno.env.get('CORBAN_USERNAME')
    const corbanPassword = Deno.env.get('CORBAN_PASSWORD')
    const corbanEmpresa = Deno.env.get('CORBAN_EMPRESA')

    if (!corbanUrl || !corbanUsername || !corbanPassword || !corbanEmpresa) {
      console.log('[corban-status-sync] Corban credentials not configured, skipping')
      return new Response(JSON.stringify({ skipped: true, reason: 'credentials_missing' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Fetch leads that have a corban_proposta_id and are not in terminal status
    const TERMINAL_STATUSES = ['APROVADO', 'CANCELADO', 'REPROVADO', 'FINALIZADO']
    const { data: activeLeads, error: leadsError } = await supabase
      .from('client_leads')
      .select('id, cpf, corban_proposta_id, corban_status, status')
      .not('corban_proposta_id', 'is', null)
      .limit(100)

    if (leadsError) {
      console.error('[corban-status-sync] Error fetching leads:', leadsError.message)
      return new Response(JSON.stringify({ error: leadsError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Filter out terminal statuses in code (Supabase doesn't support NOT IN easily)
    const leadsToCheck = (activeLeads || []).filter(
      (l: any) => !TERMINAL_STATUSES.includes((l.corban_status || '').toUpperCase())
    )

    if (leadsToCheck.length === 0) {
      console.log('[corban-status-sync] No active leads to sync')
      return new Response(JSON.stringify({ synced: 0, message: 'No active leads' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`[corban-status-sync] Found ${leadsToCheck.length} leads to check`)

    const auth = { username: corbanUsername, password: corbanPassword, empresa: corbanEmpresa }
    const apiUrl = `${corbanUrl.replace(/\/$/, '')}/api/propostas/`

    let updated = 0
    let errors = 0

    // Process in batches of CPFs to minimize API calls
    // Group leads by CPF to make fewer calls
    const cpfMap = new Map<string, any[]>()
    for (const lead of leadsToCheck) {
      if (!lead.cpf) continue
      const cpf = lead.cpf.replace(/\D/g, '')
      if (!cpfMap.has(cpf)) cpfMap.set(cpf, [])
      cpfMap.get(cpf)!.push(lead)
    }

    // Limit to 5 API calls per execution to avoid overloading
    const cpfsToCheck = Array.from(cpfMap.keys()).slice(0, 5)

    for (const cpf of cpfsToCheck) {
      try {
        const now = new Date()
        const from = new Date(now)
        from.setDate(from.getDate() - 90) // Search last 90 days

        const corbanBody = {
          auth,
          requestType: 'getPropostas',
          filters: {
            data: {
              tipo: 'cadastro',
              startDate: from.toISOString().split('T')[0],
              endDate: now.toISOString().split('T')[0],
            },
            searchString: cpf,
          },
        }

        console.log(`[corban-status-sync] Querying propostas for CPF ${cpf.substring(0, 3)}***`)

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(corbanBody),
        })

        if (!response.ok) {
          console.error(`[corban-status-sync] API error for CPF ${cpf.substring(0, 3)}***: ${response.status}`)
          errors++
          continue
        }

        const responseText = await response.text()
        let result: any
        try {
          result = JSON.parse(responseText)
        } catch {
          console.error(`[corban-status-sync] Invalid JSON for CPF ${cpf.substring(0, 3)}***`)
          errors++
          continue
        }

        // Check for API logical error
        if (result?.error === true) {
          console.error(`[corban-status-sync] API logical error: ${result.mensagem}`)
          errors++
          continue
        }

        // Convert keyed-object to array
        let propostas: any[] = []
        if (Array.isArray(result)) {
          propostas = result
        } else if (typeof result === 'object' && result !== null) {
          const entries = Object.entries(result)
          if (entries.length > 0 && entries.every(([k]) => /^\d+$/.test(k))) {
            propostas = entries.map(([id, value]) => ({
              proposta_id: id,
              ...(typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}),
            }))
          }
        }

        console.log(`[corban-status-sync] Found ${propostas.length} propostas for CPF ${cpf.substring(0, 3)}***`)

        // Match propostas to leads
        const leadsForCpf = cpfMap.get(cpf) || []
        for (const lead of leadsForCpf) {
          // Find matching proposta by ID
          const match = propostas.find(
            (p: any) => String(p.proposta_id) === String(lead.corban_proposta_id)
          )

          if (match) {
            const newStatus = match.status_nome || match.status || null
            if (newStatus && newStatus !== lead.corban_status) {
              console.log(`[corban-status-sync] Lead ${lead.id}: status "${lead.corban_status}" -> "${newStatus}"`)

              await supabase
                .from('client_leads')
                .update({
                  corban_status: newStatus,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', lead.id)

              // Log to audit
              await supabase.from('audit_logs').insert({
                action: 'corban_status_sync',
                target_table: 'client_leads',
                target_id: lead.id,
                details: {
                  proposta_id: lead.corban_proposta_id,
                  old_status: lead.corban_status,
                  new_status: newStatus,
                  cpf_prefix: cpf.substring(0, 3),
                },
              })

              updated++
            }
          }
        }

        // Small delay between API calls to be respectful
        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch (err: any) {
        console.error(`[corban-status-sync] Error processing CPF ${cpf.substring(0, 3)}***:`, err.message)
        errors++
      }
    }

    const summary = {
      synced: updated,
      checked_cpfs: cpfsToCheck.length,
      total_active_leads: leadsToCheck.length,
      errors,
      timestamp: new Date().toISOString(),
    }

    console.log('[corban-status-sync] Summary:', JSON.stringify(summary))

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('[corban-status-sync] Unexpected error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
