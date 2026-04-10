import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const payload = await req.json();
    console.log('ClickSign webhook received:', JSON.stringify(payload).substring(0, 1000));

    // ClickSign API v3 webhook: payload.event.name contém o nome do evento
    const eventName = payload?.event?.name || payload?.event || null;
    const eventData = payload?.event?.data || payload?.data || {};

    // Extrair identificadores do documento/envelope
    const documentKey = eventData?.document?.key || eventData?.document_key || null;
    const envelopeId = eventData?.envelope?.id || 
                        eventData?.envelope_id || 
                        payload?.data?.id ||
                        payload?.envelope?.id || 
                        null;
    const signerKey = eventData?.signer?.key || null;
    const signerEmail = eventData?.signer?.email || null;

    console.log('Parsed webhook:', JSON.stringify({ eventName, documentKey, envelopeId, signerKey, signerEmail }));

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
        payload: JSON.stringify(payload).substring(0, 5000),
      },
    });

    // Eventos que indicam documento/envelope fechado/assinado
    const completedEvents = [
      'document_closed', 'auto_close', 'close', 'closed',
      'envelope.closed', 'envelope_closed',
    ];

    const isCompleted = (typeof eventName === 'string' && completedEvents.includes(eventName)) ||
                         eventData?.status === 'closed' ||
                         eventData?.status === 'finished' ||
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

      // Tentar obter a URL do documento assinado
      let signedUrl = null;
      try {
        const CLICKSIGN_BASE_URL = Deno.env.get('CLICKSIGN_BASE_URL') || 'https://sandbox.clicksign.com';
        const CLICKSIGN_TOKEN = Deno.env.get('CLICKSIGN_ACCESS_TOKEN') || '';

        if (CLICKSIGN_TOKEN && envelopeId) {
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
        }
      } catch (e) {
        console.warn('Failed to fetch signed URL:', e);
      }

      // Atualizar parceiro
      const updateData: Record<string, unknown> = {
        contrato_status: 'assinado',
        contrato_assinado_em: new Date().toISOString(),
        pipeline_status: 'contrato_assinado',
      };
      if (signedUrl) updateData.contrato_signed_url = signedUrl;

      await supabaseAdmin.from('partners').update(updateData).eq('id', partner.id);

      // Registrar histórico
      await supabaseAdmin.from('partner_history').insert({
        partner_id: partner.id,
        action: 'contrato_assinado',
        details: {
          event_name: eventName,
          document_key: documentKey,
          envelope_id: envelopeId,
          signed_url: signedUrl,
          signer_email: signerEmail,
        },
        created_by: '00000000-0000-0000-0000-000000000000',
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
