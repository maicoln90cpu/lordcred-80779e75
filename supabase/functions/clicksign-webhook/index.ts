import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

Deno.serve(async (req) => {
  // Only accept POST
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const payload = await req.json();
    console.log('ClickSign webhook received:', JSON.stringify(payload).substring(0, 500));

    // ClickSign API v3 webhook event structure
    const event = payload?.event || payload?.data?.attributes?.event;
    const envelopeId = payload?.data?.id || payload?.envelope?.id || payload?.data?.attributes?.envelope_id;

    // Log the webhook
    await supabaseAdmin.from('audit_logs').insert({
      action: 'clicksign_webhook',
      target_table: 'partners',
      target_id: envelopeId || 'unknown',
      details: {
        event,
        payload: JSON.stringify(payload).substring(0, 5000),
      },
    });

    // Check if envelope is closed/finished
    const isCompleted = event === 'envelope.closed' || 
                         event === 'closed' ||
                         payload?.data?.attributes?.status === 'closed' ||
                         payload?.data?.attributes?.status === 'finished';

    if (isCompleted && envelopeId) {
      console.log(`Envelope ${envelopeId} completed, updating partner...`);

      // Find partner by envelope_id
      const { data: partner, error: findErr } = await supabaseAdmin
        .from('partners')
        .select('id, nome')
        .eq('envelope_id', envelopeId)
        .single();

      if (findErr || !partner) {
        console.warn('Partner not found for envelope:', envelopeId);
        return new Response(JSON.stringify({ ok: true, message: 'Partner not found' }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        });
      }

      // Try to get the signed document URL from ClickSign
      let signedUrl = null;
      try {
        const CLICKSIGN_BASE_URL = Deno.env.get('CLICKSIGN_BASE_URL') || 'https://sandbox.clicksign.com';
        const CLICKSIGN_TOKEN = Deno.env.get('CLICKSIGN_ACCESS_TOKEN') || '';
        
        const envelopeRes = await fetch(`${CLICKSIGN_BASE_URL}/api/v3/envelopes/${envelopeId}`, {
          headers: {
            'Authorization': CLICKSIGN_TOKEN,
            'Accept': 'application/vnd.api+json',
          },
        });
        if (envelopeRes.ok) {
          const envelopeData = await envelopeRes.json();
          signedUrl = envelopeData?.data?.attributes?.downloads?.signed_file_url || 
                      envelopeData?.data?.attributes?.signed_file_url ||
                      null;
        }
      } catch (e) {
        console.warn('Failed to fetch signed URL:', e);
      }

      // Update partner
      const updateData: any = {
        contrato_status: 'assinado',
        contrato_assinado_em: new Date().toISOString(),
        pipeline_status: 'contrato_assinado',
      };
      if (signedUrl) updateData.contrato_signed_url = signedUrl;

      await supabaseAdmin.from('partners').update(updateData).eq('id', partner.id);

      // Log history
      await supabaseAdmin.from('partner_history').insert({
        partner_id: partner.id,
        action: 'contrato_assinado',
        details: { envelope_id: envelopeId, signed_url: signedUrl },
        created_by: '00000000-0000-0000-0000-000000000000', // system
      });

      console.log(`Partner ${partner.nome} contract marked as signed`);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('clicksign-webhook error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
});
