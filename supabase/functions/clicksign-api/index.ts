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

class HttpError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }
}

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

function normalizeSignerName(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function validateSignerName(value: string): string {
  const signerName = normalizeSignerName(value);
  const parts = signerName.split(' ').filter(Boolean);
  if (!signerName || parts.length < 2) {
    throw new HttpError(400, 'O nome do signatário precisa conter nome e sobrenome.');
  }
  if (/\d/.test(signerName)) {
    throw new HttpError(400, 'O nome do signatário não pode conter números.');
  }
  return signerName;
}

function isValidCpf(value: string): boolean {
  if (!/^\d{11}$/.test(value) || /^(\d)\1{10}$/.test(value)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(value[i]) * (10 - i);
  if (((sum * 10) % 11) % 10 !== Number(value[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(value[i]) * (11 - i);
  return ((sum * 10) % 11) % 10 === Number(value[10]);
}

function formatCpf(value: string): string {
  return `${value.slice(0,3)}.${value.slice(3,6)}.${value.slice(6,9)}-${value.slice(9)}`;
}

function getSignerDocumentation(cpf?: string | null): string | undefined {
  const rawCpf = (cpf || '').replace(/\D/g, '');
  if (!rawCpf) return undefined;
  if (!isValidCpf(rawCpf)) {
    throw new HttpError(400, 'O CPF do parceiro está inválido.');
  }
  return formatCpf(rawCpf);
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
    throw new HttpError(res.status, `ClickSign API error ${res.status}: ${JSON.stringify(data)}`, data);
  }
  return data;
}

// ---------- Dynamic template loading ----------

async function loadContractTemplate(): Promise<string> {
  const { data } = await supabaseAdmin
    .from('system_settings')
    .select('contract_template')
    .limit(1)
    .single();
  return data?.contract_template || '';
}

// ---------- Replace placeholders in template ----------

function replacePlaceholders(template: string, partner: any, now: Date): string {
  const dia = now.getDate().toString();
  const mes = MESES[now.getMonth()];
  const ano = now.getFullYear().toString();
  const diaPagamento = (partner.dia_pagamento || 7).toString();
  const vigencia = (partner.vigencia_meses || 12).toString();
  const avisoPrevio = (partner.aviso_previo_dias || 7).toString();
  const rawCpf = (partner.cpf || '').replace(/\D/g, '');
  const cpfFormatted = rawCpf.length === 11 ? formatCpf(rawCpf) : (partner.cpf || '___');

  const map: Record<string, string> = {
    '{{RAZAO_SOCIAL}}': partner.razao_social || partner.nome || '___',
    '{{CNPJ}}': partner.cnpj || '___',
    '{{ENDERECO_PJ}}': partner.endereco_pj || partner.endereco || '___',
    '{{REPRESENTANTE_NOME}}': partner.nome || '___',
    '{{REPRESENTANTE_NACIONALIDADE}}': partner.nacionalidade || '___',
    '{{REPRESENTANTE_ESTADO_CIVIL}}': partner.estado_civil || '___',
    '{{REPRESENTANTE_CPF}}': cpfFormatted,
    '{{REPRESENTANTE_ENDERECO}}': partner.endereco || '___',
    '{{DIA_PAGAMENTO}}': diaPagamento,
    '{{VIGENCIA_MESES}}': vigencia,
    '{{AVISO_PREVIO_DIAS}}': avisoPrevio,
    '{{DIA}}': dia,
    '{{MES}}': mes,
    '{{ANO}}': ano,
  };

  let result = template;
  for (const [key, value] of Object.entries(map)) {
    result = result.split(key).join(value);
  }
  return result;
}

// ---------- PDF generation ----------

function generatePdfBytes(text: string): Uint8Array {
  const lines = text.split('\n');
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 60;
  const lineHeight = 14;
  const maxCharsPerLine = 78;
  const usableHeight = pageHeight - margin * 2;
  const linesPerPage = Math.floor(usableHeight / lineHeight);

  // Word-wrap lines
  const wrappedLines: { text: string; bold: boolean }[] = [];
  for (const line of lines) {
    if (line.length === 0) {
      wrappedLines.push({ text: '', bold: false });
      continue;
    }
    // Detect bold lines: all-caps titles or CLÁUSULA headers
    const isBold = /^(CONTRATO|CLÁUSULA|CLAUSULA|CONTRATANTE|CONTRATADO|LORD CRED|E, de outro|Pelo presente|Resolvem firmar|Palhoça|___)/i.test(line.trim());
    let remaining = line;
    while (remaining.length > maxCharsPerLine) {
      let breakAt = remaining.lastIndexOf(' ', maxCharsPerLine);
      if (breakAt <= 0) breakAt = maxCharsPerLine;
      wrappedLines.push({ text: remaining.slice(0, breakAt), bold: isBold });
      remaining = remaining.slice(breakAt).trimStart();
    }
    wrappedLines.push({ text: remaining, bold: isBold });
  }

  // Split into pages
  const pages: { text: string; bold: boolean }[][] = [];
  for (let i = 0; i < wrappedLines.length; i += linesPerPage) {
    pages.push(wrappedLines.slice(i, i + linesPerPage));
  }
  if (pages.length === 0) pages.push([{ text: '', bold: false }]);

  function esc(s: string): string {
    // Convert to Latin-1 compatible chars and escape PDF special chars
    return s
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      // Map common special chars to Latin-1 octal codes
      .replace(/ã/g, '\\343').replace(/Ã/g, '\\303')
      .replace(/á/g, '\\341').replace(/Á/g, '\\301')
      .replace(/â/g, '\\342').replace(/Â/g, '\\302')
      .replace(/à/g, '\\340').replace(/À/g, '\\300')
      .replace(/é/g, '\\351').replace(/É/g, '\\311')
      .replace(/ê/g, '\\352').replace(/Ê/g, '\\312')
      .replace(/í/g, '\\355').replace(/Í/g, '\\315')
      .replace(/ó/g, '\\363').replace(/Ó/g, '\\323')
      .replace(/ô/g, '\\364').replace(/Ô/g, '\\324')
      .replace(/õ/g, '\\365').replace(/Õ/g, '\\325')
      .replace(/ú/g, '\\372').replace(/Ú/g, '\\332')
      .replace(/ü/g, '\\374').replace(/Ü/g, '\\334')
      .replace(/ç/g, '\\347').replace(/Ç/g, '\\307')
      .replace(/º/g, '\\272').replace(/ª/g, '\\252')
      .replace(/–/g, '-').replace(/—/g, '-')
      .replace(/"/g, '"').replace(/"/g, '"')
      .replace(/'/g, "'").replace(/'/g, "'")
      .replace(/§/g, '\\247')
      .replace(/€/g, 'EUR');
  }

  const objects: string[] = [];
  let objCount = 0;
  const offsets: number[] = [];

  function addObj(content: string): number {
    objCount++;
    objects.push(`${objCount} 0 obj\n${content}\nendobj\n`);
    return objCount;
  }

  // 1 - Catalog
  addObj('<< /Type /Catalog /Pages 2 0 R >>');

  // 2 - Pages placeholder
  const pagesObjNum = objCount + 1;
  addObj('PAGES_PLACEHOLDER');

  // 3 - Font Regular (Helvetica)
  const fontRegObj = objCount + 1;
  addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');

  // 4 - Font Bold (Helvetica-Bold)
  const fontBoldObj = objCount + 1;
  addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');

  const pageObjNums: number[] = [];

  for (let pi = 0; pi < pages.length; pi++) {
    const pageLines = pages[pi];
    let stream = 'BT\n';
    let y = pageHeight - margin;

    // Header line on first page
    if (pi === 0) {
      stream += `/F2 8 Tf\n0.5 0.5 0.5 rg\n`;
      stream += `1 0 0 1 ${margin} ${pageHeight - 30} Tm\n(LORD CRED - Contrato de Parceria Comercial) Tj\n`;
      stream += `0 0 0 rg\n`;
    }

    for (const line of pageLines) {
      const fontSize = line.bold ? 11 : 10;
      const fontRef = line.bold ? '/F2' : '/F1';
      stream += `${fontRef} ${fontSize} Tf\n`;
      stream += `1 0 0 1 ${margin} ${y} Tm\n(${esc(line.text)}) Tj\n`;
      y -= lineHeight;
    }

    // Footer with page number
    stream += `/F1 8 Tf\n0.5 0.5 0.5 rg\n`;
    stream += `1 0 0 1 ${pageWidth / 2 - 20} 25 Tm\n(P\\341gina ${pi + 1} de ${pages.length}) Tj\n`;
    stream += `0 0 0 rg\n`;

    stream += 'ET\n';

    // Draw header line on first page
    if (pi === 0) {
      stream += `0.2 0.4 0.7 RG\n0.5 w\n${margin} ${pageHeight - 35} m ${pageWidth - margin} ${pageHeight - 35} l S\n`;
    }

    const streamBytes = new TextEncoder().encode(stream);
    const streamObj = objCount + 1;
    addObj(`<< /Length ${streamBytes.length} >>\nstream\n${stream}endstream`);

    const pageObj = objCount + 1;
    addObj(`<< /Type /Page /Parent ${pagesObjNum} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${streamObj} 0 R /Resources << /Font << /F1 ${fontRegObj} 0 R /F2 ${fontBoldObj} 0 R >> >> >>`);
    pageObjNums.push(pageObj);
  }

  // Update Pages object
  const kidsStr = pageObjNums.map(n => `${n} 0 R`).join(' ');
  objects[pagesObjNum - 1] = `${pagesObjNum} 0 obj\n<< /Type /Pages /Kids [${kidsStr}] /Count ${pageObjNums.length} >>\nendobj\n`;

  // Build final PDF
  let pdf = '%PDF-1.4\n';
  for (let i = 0; i < objects.length; i++) {
    offsets[i] = pdf.length;
    pdf += objects[i];
  }

  const xrefOffset = pdf.length;
  pdf += 'xref\n';
  pdf += `0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 0; i < objects.length; i++) {
    pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  }
  pdf += 'trailer\n';
  pdf += `<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += 'startxref\n';
  pdf += `${xrefOffset}\n`;
  pdf += '%%EOF\n';

  return new TextEncoder().encode(pdf);
}

// ---------- Contract text generation (uses dynamic template) ----------

async function generateContractText(partner: any, now: Date): Promise<string> {
  const template = await loadContractTemplate();
  if (template) {
    return replacePlaceholders(template, partner, now);
  }
  // Fallback if no template saved
  const dia = now.getDate();
  const mes = MESES[now.getMonth()];
  const ano = now.getFullYear();
  return `CONTRATO DE PARCERIA COMERCIAL\n\nCONTRATANTE: LORD CRED LTDA\nCONTRATADO: ${partner.razao_social || partner.nome}\n\nPalhoça/SC, ${dia} de ${mes} de ${ano}.`;
}

async function previewContract(partnerId: string) {
  const { data: partner, error: pErr } = await supabaseAdmin
    .from('partners').select('*').eq('id', partnerId).single();
  if (pErr || !partner) throw new Error(`Parceiro nao encontrado: ${pErr?.message}`);

  if (!partner.nome || !partner.email) {
    throw new HttpError(400, 'Parceiro precisa ter nome e email.');
  }
  validateSignerName(partner.nome);
  getSignerDocumentation(partner.cpf);

  const contractText = await generateContractText(partner, new Date());
  const pdfBytes = generatePdfBytes(contractText);
  const pdfBase64 = btoa(String.fromCharCode(...pdfBytes));

  return { contract_text: contractText, pdf_base64: pdfBase64 };
}

async function generateAndSend(partnerId: string, userId: string) {
  const { data: partner, error: pErr } = await supabaseAdmin
    .from('partners').select('*').eq('id', partnerId).single();
  if (pErr || !partner) throw new Error(`Parceiro nao encontrado: ${pErr?.message}`);

  if (!partner.nome || !partner.email) {
    throw new HttpError(400, 'Parceiro precisa ter nome e email.');
  }

  const signerName = validateSignerName(partner.nome);
  const formattedCpf = getSignerDocumentation(partner.cpf);
  const now = new Date();

  // 1. Create envelope
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

  // 2. Generate PDF with dynamic template and upload
  const contractContent = await generateContractText(partner, now);
  const pdfBytes = generatePdfBytes(contractContent);
  const pdfBase64 = btoa(String.fromCharCode(...pdfBytes));
  const sanitizedName = sanitizeFilenamePart(partner.nome || partner.razao_social || 'parceiro');
  const fileName = `contrato_${sanitizedName}_${now.getTime()}.pdf`;
  const contentBase64 = `data:application/pdf;base64,${pdfBase64}`;

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

  // 3. Add signer
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

  // 4. Qualification requirement (role: contractee)
  await clicksignFetch(`/api/v3/envelopes/${envelopeId}/requirements`, 'POST', {
    data: {
      type: 'requirements',
      attributes: {
        action: 'agree',
        role: 'contractee',
      },
      relationships: {
        document: { data: { type: 'documents', id: documentId } },
        signer: { data: { type: 'signers', id: signerId } },
      }
    }
  });
  console.log('Qualification requirement added');

  // 5. Authentication requirement (email token)
  await clicksignFetch(`/api/v3/envelopes/${envelopeId}/requirements`, 'POST', {
    data: {
      type: 'requirements',
      attributes: {
        action: 'provide_evidence',
        auth: 'email',
      },
      relationships: {
        document: { data: { type: 'documents', id: documentId } },
        signer: { data: { type: 'signers', id: signerId } },
      }
    }
  });
  console.log('Auth requirement added');

  // 6. Activate envelope
  await clicksignFetch(`/api/v3/envelopes/${envelopeId}`, 'PATCH', {
    data: {
      type: 'envelopes',
      id: envelopeId,
      attributes: { status: 'running' },
    }
  });
  console.log('Envelope activated');

  // 7. Notify signers
  try {
    await clicksignFetch(`/api/v3/envelopes/${envelopeId}/notify`, 'POST', {
      data: {
        type: 'notifications',
        attributes: {
          message: `Ola ${partner.nome}, seu contrato de parceria esta pronto para assinatura.`,
        }
      }
    });
    console.log('Notification sent');
  } catch (e) {
    console.warn('Notification failed (non-critical):', e);
  }

  // 8. Update partner record
  await supabaseAdmin.from('partners').update({
    envelope_id: envelopeId,
    contrato_status: 'pendente_parceiro',
    contrato_url: `${CLICKSIGN_BASE_URL}/envelopes/${envelopeId}`,
  }).eq('id', partnerId);

  // 9. Log history
  await supabaseAdmin.from('partner_history').insert({
    partner_id: partnerId,
    action: 'contrato_enviado',
    details: { envelope_id: envelopeId, signer_email: partner.email },
    created_by: userId,
  });

  // 10. Audit log
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
  return await clicksignFetch(`/api/v3/envelopes/${envelopeId}`, 'GET');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
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
      case 'preview':
        if (!partner_id) throw new HttpError(400, 'partner_id is required');
        result = await previewContract(partner_id);
        break;
      case 'generate_and_send':
        if (!partner_id) throw new HttpError(400, 'partner_id is required');
        result = await generateAndSend(partner_id, userId);
        break;
      case 'get_status':
        if (!envelope_id) throw new HttpError(400, 'envelope_id is required');
        result = await getEnvelopeStatus(envelope_id);
        break;
      default:
        throw new HttpError(400, `Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('clicksign-api error:', error);
    const message = error instanceof Error ? error.message : 'Erro interno';
    const status = error instanceof HttpError ? error.status : 500;

    return new Response(JSON.stringify({ error: message }), {
      status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
