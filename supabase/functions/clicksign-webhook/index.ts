import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const payload = await req.json();
    console.log('ClickSign webhook received:', JSON.stringify(payload).substring(0, 2000));

    // ClickSign API v3 webhook structure:
    // payload.event.name = event name
    // payload.document = { key, downloads: { signed_file_url, ... } }
    // payload.account, payload.envelope, payload.signer, etc.
    const eventName = payload?.event?.name || payload?.event || null;
    
    // Document info — ClickSign v3 puts document at root level
    const document = payload?.document || payload?.event?.data?.document || {};
    const documentKey = document?.key || payload?.event?.data?.document_key || null;
    
    // Envelope info — also at root level in v3
    const envelope = payload?.envelope || payload?.event?.data?.envelope || {};
    const envelopeId = envelope?.id || 
                        payload?.event?.data?.envelope_id || 
                        payload?.data?.id ||
                        null;
    
    // Signer info
    const signer = payload?.signer || payload?.event?.data?.signer || {};
    const signerKey = signer?.key || null;
    const signerEmail = signer?.email || null;

    // Downloads — v3 puts them inside document
    const downloads = document?.downloads || {};
    const signedFileUrl = downloads?.signed_file_url || 
                           downloads?.original_file_url ||
                           null;

    console.log('Parsed webhook:', JSON.stringify({ 
      eventName, documentKey, envelopeId, signerKey, signerEmail,
      hasSignedUrl: !!signedFileUrl,
      payloadKeys: Object.keys(payload),
    }));

    // Log the webhook
    await supabaseAdmin.from('audit_logs').insert({
      action: 'clicksign_webhook',
      target_table: 'partners',
      target_id: documentKey || envelopeId || 'unknown',
      details: {
        event_name: eventName,
        document_key: documentKey,
        envelope_id: envelopeId,
        signer_email: signerEmail,
        signed_file_url: signedFileUrl ? '(present)' : null,
        payload_keys: Object.keys(payload),
        payload: JSON.stringify(payload).substring(0, 5000),
      },
    });

    // Eventos que indicam documento/envelope fechado/assinado
    const completedEvents = [
      'document_closed', 'auto_close', 'close', 'closed',
      'envelope.closed', 'envelope_closed',
    ];

    const isCompleted = (typeof eventName === 'string' && completedEvents.includes(eventName)) ||
                         envelope?.status === 'closed' ||
                         envelope?.status === 'finished' ||
                         payload?.data?.attributes?.status === 'closed' ||
                         payload?.data?.attributes?.status === 'finished';

    if (isCompleted) {
      console.log(`Completed event detected: ${eventName}`);

      // Estratégia de busca do parceiro: 1) document_key, 2) envelope_id, 3) contrato_url
      let partner = null;
      let findErr = null;

      // 1. Buscar por document_key
      if (documentKey) {
        const res = await supabaseAdmin
          .from('partners')
          .select('id, nome')
          .eq('document_key', documentKey)
          .maybeSingle();
        partner = res.data;
        findErr = res.error;
        if (partner) console.log(`Partner found by document_key: ${partner.nome}`);
      }

      // 2. Buscar por envelope_id
      if (!partner && envelopeId) {
        const res = await supabaseAdmin
          .from('partners')
          .select('id, nome')
          .eq('envelope_id', envelopeId)
          .maybeSingle();
        partner = res.data;
        findErr = res.error;
        if (partner) console.log(`Partner found by envelope_id: ${partner.nome}`);
      }

      // 3. Buscar por contrato_url contendo o envelope_id
      if (!partner && envelopeId) {
        const res = await supabaseAdmin
          .from('partners')
          .select('id, nome')
          .ilike('contrato_url', `%${envelopeId}%`)
          .maybeSingle();
        partner = res.data;
        findErr = res.error;
        if (partner) console.log(`Partner found by contrato_url match: ${partner.nome}`);
      }

      if (!partner) {
        console.warn('Partner not found for webhook:', { documentKey, envelopeId });
        return new Response(JSON.stringify({ ok: true, message: 'Partner not found' }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        });
      }

      // Atualizar parceiro — NÃO salvamos signed_file_url permanentemente pois expira em 5min
      // O download é feito on-demand via clicksign-api/getSignedUrl
      const updateData: Record<string, unknown> = {
        contrato_status: 'assinado',
        contrato_assinado_em: new Date().toISOString(),
        pipeline_status: 'contrato_assinado',
      };

      await supabaseAdmin.from('partners').update(updateData).eq('id', partner.id);

      // Registrar histórico
      await supabaseAdmin.from('partner_history').insert({
        partner_id: partner.id,
        action: 'contrato_assinado',
        details: {
          event_name: eventName,
          document_key: documentKey,
          envelope_id: envelopeId,
          signer_email: signerEmail,
        },
        created_by: '00000000-0000-0000-0000-000000000000',
      });

      console.log(`Partner ${partner.nome} contract marked as signed`);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('clicksign-webhook error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
});
