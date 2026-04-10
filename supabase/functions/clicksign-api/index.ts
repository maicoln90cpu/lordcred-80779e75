import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CLICKSIGN_BASE_URL = Deno.env.get('CLICKSIGN_BASE_URL') || 'https://sandbox.clicksign.com';
const CLICKSIGN_TOKEN = Deno.env.get('CLICKSIGN_ACCESS_TOKEN') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const textEncoder = new TextEncoder();

function sanitizeFilenamePart(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
    .slice(0, 60) || 'parceiro';
}

function toDataUriBase64(content: string, mimeType: string): string {
  const bytes = textEncoder.encode(content);
  let binary = '';

  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }

  return `data:${mimeType};base64,${btoa(binary)}`;
}

async function clicksignFetch(path: string, method: string, body?: any) {
  const url = `${CLICKSIGN_BASE_URL}${path}`;
  const headers: Record<string, string> = {
    'Authorization': CLICKSIGN_TOKEN,
    'Content-Type': 'application/vnd.api+json',
    'Accept': 'application/vnd.api+json',
  };
  const opts: RequestInit = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!res.ok) {
    console.error(`ClickSign ${method} ${path} → ${res.status}`, data);
    throw new Error(`ClickSign API error ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

async function generateAndSend(partnerId: string, userId: string) {
  // 1. Fetch partner data
  const { data: partner, error: pErr } = await supabaseAdmin
    .from('partners').select('*').eq('id', partnerId).single();
  if (pErr || !partner) throw new Error(`Parceiro não encontrado: ${pErr?.message}`);

  if (!partner.nome || !partner.email) {
    throw new Error('Parceiro precisa ter nome e email para gerar contrato');
  }

  const now = new Date();

  // 2. Create envelope
  const envelopeRes = await clicksignFetch('/api/v3/envelopes', 'POST', {
    data: {
      type: 'envelopes',
      attributes: {
        name: `Contrato Parceiro - ${partner.nome}`,
        locale: 'pt-BR',
        auto_close: true,
        block_after_refusal: true,
      }
    }
  });
  const envelopeId = envelopeRes.data.id;
  console.log('Envelope created:', envelopeId);

  // 3. Build a plain-text document compatible with ClickSign Base64 upload
  const contractContent = generateContractText(partner, now);
  const sanitizedName = sanitizeFilenamePart(partner.nome || partner.razao_social || 'parceiro');
  const fileName = `contrato_${sanitizedName}_${now.getTime()}.txt`;
  const contentBase64 = toDataUriBase64(contractContent, 'text/plain');

  const docRes = await clicksignFetch(`/api/v3/envelopes/${envelopeId}/documents`, 'POST', {
    data: {
      type: 'documents',
      attributes: {
        filename: fileName,
        content_base64: contentBase64,
      }
    }
  });
  const documentId = docRes.data.id;
  console.log('Document uploaded:', JSON.stringify({ documentId, fileName }));

  // 4. Add signer - Partner
  const signerName = (partner.nome || '').trim();
  const rawCpf = (partner.cpf || '').replace(/\D/g, '');
  // ClickSign requires CPF formatted as xxx.xxx.xxx-xx
  const formattedCpf = rawCpf.length === 11
    ? `${rawCpf.slice(0,3)}.${rawCpf.slice(3,6)}.${rawCpf.slice(6,9)}-${rawCpf.slice(9)}`
    : undefined;

  const signerAttributes: Record<string, any> = {
    name: signerName,
    email: partner.email,
    refusable: true,
  };
  if (formattedCpf) signerAttributes.documentation = formattedCpf;

  const signerRes = await clicksignFetch(`/api/v3/envelopes/${envelopeId}/signers`, 'POST', {
    data: {
      type: 'signers',
      attributes: signerAttributes,
    }
  });
  const signerId = signerRes.data.id;
  console.log('Signer added:', signerId);

  // 5. Add requirement (qualification) for the signer
  await clicksignFetch(`/api/v3/envelopes/${envelopeId}/requirements`, 'POST', {
    data: {
      type: 'requirements',
      attributes: {
        action: 'agree',
        role: 'sign',
      },
      relationships: {
        document: { data: { type: 'documents', id: documentId } },
        signer: { data: { type: 'signers', id: signerId } },
      }
    }
  });
  console.log('Requirement added');

  // 6. Add authentication for signer (email token)
  await clicksignFetch(`/api/v3/envelopes/${envelopeId}/requirements`, 'POST', {
    data: {
      type: 'requirements',
      attributes: {
        action: 'provide_evidence',
        auth: 'email',
      },
      relationships: {
        signer: { data: { type: 'signers', id: signerId } },
      }
    }
  });
  console.log('Auth requirement added');

  // 7. Activate envelope (status: running)
  await clicksignFetch(`/api/v3/envelopes/${envelopeId}`, 'PATCH', {
    data: {
      type: 'envelopes',
      id: envelopeId,
      attributes: {
        status: 'running',
      }
    }
  });
  console.log('Envelope activated');

  // 8. Notify signers
  try {
    await clicksignFetch(`/api/v3/envelopes/${envelopeId}/notifications`, 'POST', {
      data: {
        type: 'notifications',
        attributes: {
          message: `Olá ${partner.nome}, seu contrato de parceria está pronto para assinatura.`,
        }
      }
    });
    console.log('Notification sent');
  } catch (e) {
    console.warn('Notification failed (non-critical):', e);
  }

  // 9. Update partner record
  await supabaseAdmin.from('partners').update({
    envelope_id: envelopeId,
    contrato_status: 'pendente_parceiro',
    contrato_url: `${CLICKSIGN_BASE_URL}/envelopes/${envelopeId}`,
  }).eq('id', partnerId);

  // 10. Log history
  await supabaseAdmin.from('partner_history').insert({
    partner_id: partnerId,
    action: 'contrato_enviado',
    details: { envelope_id: envelopeId, signer_email: partner.email },
    created_by: userId,
  });

  // 11. Audit log
  await supabaseAdmin.from('audit_logs').insert({
    user_id: userId,
    action: 'clicksign_contract_generated',
    target_table: 'partners',
    target_id: partnerId,
    details: {
      envelope_id: envelopeId,
      partner_name: partner.nome,
      partner_email: partner.email,
      file_name: fileName,
    },
  });

  return { envelope_id: envelopeId, status: 'pendente_parceiro' };
}

async function getEnvelopeStatus(envelopeId: string) {
  const data = await clicksignFetch(`/api/v3/envelopes/${envelopeId}`, 'GET');
  return data;
}

function generateContractText(partner: any, now: Date): string {
  const dia = now.getDate();
  const mes = MESES[now.getMonth()];
  const ano = now.getFullYear();
  const diaPagamento = partner.dia_pagamento || 7;
  const vigencia = partner.vigencia_meses || 12;
  const avisoPrevio = partner.aviso_previo_dias || 7;

  return `CONTRATO DE PARCERIA COMERCIAL

CONTRATANTE:
LORD CRED LTDA, pessoa jurídica de direito privado, inscrita no CNPJ, doravante denominada simplesmente CONTRATANTE.

CONTRATADO:
${partner.razao_social || partner.nome}, ${partner.cnpj ? `inscrita no CNPJ sob nº ${partner.cnpj}` : `CPF nº ${partner.cpf || '___'}`}, com sede/endereço em ${partner.endereco_pj || partner.endereco || '___'}, doravante denominada simplesmente CONTRATADO.

CLÁUSULA 1ª - DO OBJETO
O presente contrato tem por objeto a prestação de serviços de parceria comercial para captação e intermediação de operações de crédito consignado e FGTS.

CLÁUSULA 2ª - DAS OBRIGAÇÕES
O CONTRATADO se compromete a atuar de forma ética e transparente na captação de clientes, seguindo as diretrizes e procedimentos estabelecidos pela CONTRATANTE.

CLÁUSULA 3ª - DA REMUNERAÇÃO
A CONTRATANTE pagará ao CONTRATADO comissão conforme tabela vigente, a ser creditada todo dia ${diaPagamento} do mês subsequente à operação.

CLÁUSULA 4ª - DA VIGÊNCIA
O presente contrato terá vigência de ${vigencia} meses a contar da data de assinatura, podendo ser renovado por igual período mediante acordo entre as partes.

CLÁUSULA 5ª - DA RESCISÃO
O presente contrato poderá ser rescindido por qualquer das partes, mediante aviso prévio de ${avisoPrevio} dias.

CLÁUSULA 6ª - DO FORO
As partes elegem o foro da comarca da sede da CONTRATANTE para dirimir quaisquer dúvidas oriundas do presente contrato.

Por estarem assim justas e contratadas, as partes firmam o presente instrumento em ${dia} de ${mes} de ${ano}.

LORD CRED LTDA
CONTRATANTE

${partner.razao_social || partner.nome}
CONTRATADO`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser(token);
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = user.id;

    if (!CLICKSIGN_TOKEN) {
      return new Response(JSON.stringify({ error: 'CLICKSIGN_ACCESS_TOKEN not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action, partner_id, envelope_id } = await req.json();

    let result;
    switch (action) {
      case 'generate_and_send':
        if (!partner_id) throw new Error('partner_id is required');
        result = await generateAndSend(partner_id, userId);
        break;
      case 'get_status':
        if (!envelope_id) throw new Error('envelope_id is required');
        result = await getEnvelopeStatus(envelope_id);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('clicksign-api error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
