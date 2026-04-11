import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CLICKSIGN_BASE_URL = Deno.env.get('CLICKSIGN_BASE_URL') || 'https://sandbox.clicksign.com';
const CLICKSIGN_TOKEN = Deno.env.get('CLICKSIGN_ACCESS_TOKEN') || '';
const CLICKSIGN_ACCOUNT_ID = Deno.env.get('CLICKSIGN_ACCOUNT_ID') || '';
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

// ---------- Default contract template (full 5-page version) ----------
const DEFAULT_CONTRACT_TEMPLATE = `CONTRATO DE PARCERIA COMERCIAL AUTÔNOMA

Pelo presente instrumento particular, de um lado:

LORD CRED, pessoa jurídica de direito privado, inscrita no CNPJ nº 42.824.770/0001-07, com sede na Rua José Maria da Luz, n. 2900, Loja 01, Centro, Palhoça/SC, CEP 88.131-000, neste ato representada por Silas Carlos Dias, brasileiro, solteiro, CPF n. 112.937.439-41, residente e domiciliado na Rua Humberto Anibal Climaco, n. 266, E. 507, Forquilhinhas São José/SC doravante denominada CONTRATANTE;

E, de outro lado:

{{RAZAO_SOCIAL}}, pessoa jurídica de direito privado, inscrita no CNPJ nº {{CNPJ}}, com sede na {{ENDERECO_PJ}}, neste ato representada por {{REPRESENTANTE_NOME}}, nacionalidade {{REPRESENTANTE_NACIONALIDADE}}, estado civil {{REPRESENTANTE_ESTADO_CIVIL}}, CPF n. {{REPRESENTANTE_CPF}}, residente e domiciliado na {{REPRESENTANTE_ENDERECO}}, doravante denominada EMPRESA PARCEIRA;

Resolvem firmar o presente CONTRATO DE PARCERIA COMERCIAL AUTÔNOMA, mediante as cláusulas e condições seguintes:

CLÁUSULA 1 – DO OBJETO
O presente contrato tem por objeto comercialização, pela EMPRESA PARCEIRA, dos produtos e/ou serviços oferecidos pela CONTRATANTE, mediante as condições estabelecidas neste instrumento.
§1º As atividades não descritas no objeto deste contrato não estarão sujeitas ao regime de parceria empresarial descrito neste instrumento.

CLÁUSULA 2 – DA NATUREZA JURÍDICA DA RELAÇÃO
O presente contrato possui natureza estritamente civil e comercial, não gerando qualquer vínculo empregatício, societário, associativo ou de representação comercial exclusiva entre as partes.
§1º A EMPRESA PARCEIRA atuará com total autonomia, assumindo os riscos de sua atividade, inexistindo subordinação jurídica, pessoalidade, habitualidade compulsória ou contraprestação financeira fixa, razão pela qual inexistem, na presente relação comercial, os requisitos caracterizadores de relação de emprego (conforme arts 2º e 3º da CLT).
§2º A EMPRESA PARCEIRA não estará sujeita a controle de jornada, exclusividade, fiscalização hierárquica ou qualquer forma de subordinação estrutural.
§3º A EMPRESA PARCEIRA poderá prestar serviços a terceiros, salvo nas hipóteses previstas na cláusula de não concorrência deste contrato e desde que não conflite e/ou prejudique os interesses da CONTRATANTE.
§4º A EMPRESA PARCEIRA é integralmente responsável pelo recolhimento de seus tributos, contribuições previdenciárias e demais encargos decorrentes dos valores recebidos.
§5º A inexistência de resultados ou a ausência de intermediações não gera qualquer obrigação de pagamento mínimo por parte da CONTRATANTE.
§6º A EMPRESA PARCEIRA não possui poderes para representar juridicamente a CONTRATANTE (tanto na esfera administrativa quanto judicial), salvo autorização expressa e escrita.

CLÁUSULA 3 – DA REMUNERAÇÃO
O PARCEIRO fará jus à comissão de no mínimo 0,50% (zero vírgula cinquenta por cento) sobre o valor dos produtos e/ou serviços que forem vendidos por sua intermediação.
§1º O percentual de comissão poderá ser aumentado de acordo com o desempenho individual da EMPRESA PARCEIRA e o atingimento de metas comerciais estabelecidas pela CONTRATANTE, podendo haver majoração progressiva conforme critérios internos da empresa.
§2º A comissão somente será devida após a efetiva venda e o pagamento pelo cliente.
§3º Em caso de inadimplemento, cancelamento, distrato ou devolução de valores pelo cliente, a comissão não será devida ou poderá ser estornada proporcionalmente.
§4º O pagamento será realizado até o dia {{DIA_PAGAMENTO}} do mês subsequente ao recebimento dos valores pela CONTRATANTE.
§5º Não haverá pagamento de qualquer valor fixo, ajuda de custo, verba de representação ou remuneração mínima garantida.
§6º Nos casos em que a EMPRESA PARCEIRA realizar indicação de novos clientes ou parceiros comerciais que venham a efetivamente contratar produtos ou serviços da CONTRATANTE, será devida bonificação adicional inicial de 0,10% (zero vírgula dez por cento) sobre o valor da negociação realizada, a qual também poderá ser aumentada, conforme critérios, interesse e disponibilidade da CONTRATANTE.
§7º A bonificação por indicação poderá ser aumentada progressivamente conforme critérios de desempenho, volume de negócios gerados ou políticas comerciais internas da CONTRATANTE.

CLÁUSULA 4 – DA NÃO CONCORRÊNCIA
A EMPRESA PARCEIRA compromete-se, durante a vigência deste contrato e pelo prazo de 12 (doze) meses após sua rescisão, a não:
a) Comercializar produtos ou serviços idênticos ou diretamente concorrentes aos da CONTRATANTE para clientes por ele prospectados durante a vigência deste contrato;
b) Utilizar informações estratégicas, listas de clientes ou dados comerciais da CONTRATANTE para benefício próprio ou de terceiros;
c) Desviar clientela vinculada aos negócios intermediados.
§1º A restrição limita-se à área de atuação correspondente aos produtos/serviços objeto desta parceria, isto é, aqueles oferecidos pela CONTRATANTE.
§2º A presente cláusula não impede a EMPRESA PARCEIRA de exercer sua atividade profissional de forma ampla, desde que não haja concorrência direta ou indireta nos termos acima definidos.

CLÁUSULA 5 – DA CONFIDENCIALIDADE
A EMPRESA PARCEIRA obriga-se a manter sigilo absoluto sobre todas as informações comerciais, estratégicas, financeiras e operacionais da CONTRATANTE a que tiver acesso em razão do presente contrato, obrigação essa que permanecerá por 5 (cinco) anos após o término deste contrato.
§1º A EMPRESA PARCEIRA compromete-se a não divulgar, compartilhar, reproduzir ou utilizar para benefício próprio ou de terceiros quaisquer informações confidenciais a que tiver acesso em razão deste contrato.
§2º A EMPRESA PARCEIRA responderá civil, administrativa e criminalmente pelo uso indevido, divulgação ou vazamento de quaisquer informações obtidas em razão desta relação contratual, ainda que tal utilização indevida seja praticada por terceiros que tenham tido acesso às informações por sua responsabilidade.
§3º Consideram-se informações confidenciais, entre outras: dados de clientes, estratégias comerciais, listas de contatos, políticas internas, condições comerciais, documentos internos, informações financeiras e quaisquer outros dados não públicos da CONTRATANTE.
§4º Durante o contrato a CONTRATANTE terá a liberdade de acrescentar novas informações confidenciais, sobre as quais a EMPRESA PARCEIRA terá o mesmo dever de confidencialidade exposto nesta cláusula.

CLÁUSULA 6 – DO REGIME DE TRABALHO REMOTO (HOME OFFICE)
As atividades desempenhadas pela EMPRESA PARCEIRA serão realizadas em regime de trabalho remoto (home office), sendo executadas integralmente fora das dependências físicas da CONTRATANTE.
§1º Em razão da natureza autônoma da parceria e da realização das atividades em regime remoto, não haverá controle de jornada, fiscalização de horário, exigência de presença física nas dependências da CONTRATANTE ou imposição de rotina laboral pela CONTRATANTE.
§2º A EMPRESA PARCEIRA será integralmente responsável pela estrutura necessária para execução de suas atividades, incluindo equipamentos, internet, local de trabalho, energia elétrica e demais recursos necessários.
§3º A EMPRESA PARCEIRA declara estar ciente de que não possui horários e dias fixos de trabalho, podendo organizar livremente sua agenda e a forma de execução das atividades comerciais.

CLÁUSULA 7 - DA PROTEÇÃO DE DADOS PESSOAIS (LGPD)
A EMPRESA PARCEIRA declara estar ciente das disposições da Lei nº 13.709/2018 (Lei Geral de Proteção de Dados – LGPD) e compromete-se a cumprir integralmente todos os seus dispositivos, especialmente no que se refere ao tratamento de dados pessoais a que tiver acesso em razão deste contrato.
§1º Para os fins da LGPD, a EMPRESA PARCEIRA atuará na qualidade de OPERADOR, realizando o tratamento de dados pessoais exclusivamente em nome da CONTRATANTE, que figura como CONTROLADORA, limitando-se às finalidades estritamente necessárias à execução da parceria comercial.
§2º A EMPRESA PARCEIRA compromete-se a:
I – Tratar os dados pessoais apenas mediante instruções da CONTRATANTE;
II – Utilizar os dados exclusivamente para fins relacionados à execução deste contrato, vedado qualquer uso diverso;
III – Não compartilhar, ceder, divulgar ou disponibilizar dados pessoais a terceiros sem autorização prévia e expressa da CONTRATANTE;
IV – Adotar medidas técnicas e administrativas aptas a proteger os dados pessoais contra acessos não autorizados, destruição, perda, alteração, comunicação ou qualquer forma de tratamento inadequado ou ilícito;
V – Manter registro das operações de tratamento realizadas quando solicitado;
VI – Assegurar que quaisquer pessoas eventualmente envolvidos no tratamento de dados estejam igualmente vinculadas a dever de confidencialidade.
§3º A EMPRESA PARCEIRA compromete-se a comunicar imediatamente à CONTRATANTE a ocorrência de qualquer incidente de segurança que possa acarretar risco ou dano relevante aos titulares dos dados, fornecendo todas as informações necessárias para a adoção das medidas cabíveis.
§4º Encerrado o presente contrato, a EMPRESA PARCEIRA deverá, a critério da CONTRATANTE, eliminar ou devolver todos os dados pessoais a que tiver tido acesso, ressalvadas hipóteses legais de conservação obrigatória.
§5º O descumprimento das obrigações previstas nesta cláusula sujeitará a EMPRESA PARCEIRA à responsabilidade integral por eventuais danos causados à CONTRATANTE ou a terceiros, sem prejuízo da aplicação da multa contratual prevista neste instrumento.
§6º As obrigações previstas nesta cláusula subsistirão mesmo após o término da relação contratual, pelo prazo legal aplicável.

CLÁUSULA 8 – DA MULTA CONTRATUAL
O descumprimento de qualquer cláusula ou obrigação prevista neste contrato sujeitará a parte infratora ao pagamento de multa contratual, sem prejuízo das demais medidas cabíveis.
§1º Caso o descumprimento seja praticado pela EMPRESA PARCEIRA, esta ficará sujeita ao pagamento de multa equivalente a 30% (trinta por cento) do valor estimado das comissões percebidas nos últimos 12 (doze) meses, ou o valor mínimo de R$ 5.000,00 (cinco mil reais), prevalecendo o maior.
§2º Caso o descumprimento seja praticado pela CONTRATANTE, esta ficará sujeita ao pagamento de multa equivalente a 10% (dez por cento) do valor estimado das comissões percebidas pela CONTRATADA nos últimos 12 (doze) meses.
§3º No caso específico de violação da cláusula de confidencialidade, não concorrência, uso indevido de marca, carteira de clientes ou informações comerciais da CONTRATANTE, a multa aplicável à EMPRESA PARCEIRA será equivalente a R$ 5.000,00 (cinco mil reais) ou 40% (quarenta por cento) do valor do negócio envolvido, prevalecendo o maior valor.
§4º A aplicação da multa contratual não exclui o direito da parte prejudicada de pleitear indenização suplementar por perdas e danos caso o prejuízo efetivamente sofrido seja superior ao valor da penalidade estipulada.

CLÁUSULA 9 – DA VIGÊNCIA E RESCISÃO
O presente contrato vigorará por prazo determinado de {{VIGENCIA_MESES}} meses.
§1º Este contrato poderá ser rescindido por qualquer das partes mediante aviso prévio por escrito com antecedência mínima de {{AVISO_PREVIO_DIAS}} dias.
§2º Poderá haver rescisão imediata em caso de:
a) Descumprimento/violação de quaisquer cláusulas;
b) Ato que prejudique a CONTRATANTE em qualquer esfera (civil, administrativa e/ou criminal);
c) Utilização indevida da marca, nome empresarial, logotipo ou quaisquer sinais distintivos da CONTRATANTE;
d) Prática de conduta que cause ou possa causar dano à imagem, reputação ou credibilidade da CONTRATANTE perante clientes, parceiros ou o mercado;
e) Comercialização de produtos ou serviços da CONTRATANTE em desacordo com as condições, valores ou políticas previamente estabelecidas;
f) Prestação de informações falsas, incompletas ou enganosas a clientes, parceiros ou à própria CONTRATANTE;
g) Transferência, cessão ou delegação das atividades previstas neste contrato a terceiros sem prévia e expressa autorização da CONTRATANTE;
h) Envolvimento da EMPRESA PARCEIRA em práticas ilícitas, fraudulentas ou contrárias à legislação vigente;
i) Decretação de falência, recuperação judicial, dissolução ou encerramento das atividades da EMPRESA PARCEIRA, quando aplicável;
j) Prática de concorrência desleal ou comercialização de produtos ou serviços concorrentes em desacordo com as condições estabelecidas neste contrato;
k) Qualquer conduta da EMPRESA PARCEIRA que comprometa a execução regular do objeto contratual.

CLÁUSULA 10 – DO FORO
Fica eleito o foro da Comarca de Palhoça/SC, com renúncia a qualquer outro, por mais privilegiado que seja, para dirimir eventuais controvérsias.

E por estarem justas e contratadas, firmam o presente instrumento em duas vias de igual teor.

Palhoça/SC, {{DIA}} de {{MES}} de {{ANO}}.

___________________________________
LORD CRED (CONTRATANTE)

___________________________________
{{CNPJ_CURTO}} {{REPRESENTANTE_NOME}} (EMPRESA PARCEIRA)`;

// ---------- Dynamic template loading ----------

async function loadContractTemplate(): Promise<string> {
  const { data } = await supabaseAdmin
    .from('system_settings')
    .select('contract_template')
    .limit(1)
    .single();
  const tpl = data?.contract_template || '';
  if (tpl.length > 500) return tpl;
  return DEFAULT_CONTRACT_TEMPLATE;
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

  // CNPJ curto: extract first 9 digits (before /0001-XX)
  const rawCnpj = (partner.cnpj || '').replace(/\D/g, '');
  const cnpjCurto = rawCnpj.length >= 8
    ? `${rawCnpj.slice(0,2)}.${rawCnpj.slice(2,5)}.${rawCnpj.slice(5,8)}`
    : (partner.cnpj || '___');

  const map: Record<string, string> = {
    '{{RAZAO_SOCIAL}}': partner.razao_social || partner.nome || '___',
    '{{CNPJ}}': partner.cnpj || '___',
    '{{CNPJ_CURTO}}': cnpjCurto,
    '{{ENDERECO_PJ}}': partner.endereco_pj || partner.endereco || '___',
    '{{REPRESENTANTE_NOME}}': partner.nome || '___',
    '{{REPRESENTANTE_NACIONALIDADE}}': partner.nacionalidade || '___',
    '{{REPRESENTANTE_ESTADO_CIVIL}}': partner.estado_civil || '___',
    '{{REPRESENTANTE_CPF}}': cpfFormatted,
    '{{REPRESENTANTE_ENDERECO}}': partner.endereco || partner.endereco_pj || '___',
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
    return s
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
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

  addObj('<< /Type /Catalog /Pages 2 0 R >>');
  const pagesObjNum = objCount + 1;
  addObj('PAGES_PLACEHOLDER');
  const fontRegObj = objCount + 1;
  addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const fontBoldObj = objCount + 1;
  addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');

  const pageObjNums: number[] = [];

  for (let pi = 0; pi < pages.length; pi++) {
    const pageLines = pages[pi];
    let stream = 'BT\n';
    let y = pageHeight - margin;

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

    stream += `/F1 8 Tf\n0.5 0.5 0.5 rg\n`;
    stream += `1 0 0 1 ${pageWidth / 2 - 20} 25 Tm\n(P\\341gina ${pi + 1} de ${pages.length}) Tj\n`;
    stream += `0 0 0 rg\n`;
    stream += 'ET\n';

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

  const kidsStr = pageObjNums.map(n => `${n} 0 R`).join(' ');
  objects[pagesObjNum - 1] = `${pagesObjNum} 0 obj\n<< /Type /Pages /Kids [${kidsStr}] /Count ${pageObjNums.length} >>\nendobj\n`;

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
  const documentKey = docRes.data.attributes?.key || docRes.data.id;
  console.log('Document uploaded:', JSON.stringify({ documentId, documentKey, fileName }));

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

  // 7. Notify signer via JSON:API /notifications endpoint
  const notificationBody = {
    data: {
      type: 'notifications',
      attributes: { message: null },
    }
  };
  const notifySigner = async (attempt: number) => {
    try {
      await clicksignFetch(`/api/v3/envelopes/${envelopeId}/signers/${signerId}/notifications`, 'POST', notificationBody);
      console.log(`Notification sent to signer ${signerId} (attempt ${attempt})`);
      return true;
    } catch (e) {
      console.warn(`Notification attempt ${attempt} failed:`, e);
      return false;
    }
  };

  // Try notify with retry after 2s
  const notified = await notifySigner(1);
  if (!notified) {
    await new Promise(r => setTimeout(r, 2000));
    await notifySigner(2);
  }

  // 8. Build direct download URL using account ID
  const downloadUrl = CLICKSIGN_ACCOUNT_ID
    ? `${CLICKSIGN_BASE_URL}/accounts/${CLICKSIGN_ACCOUNT_ID}/download/packs/direct/${documentId}?kind=original`
    : `${CLICKSIGN_BASE_URL}/envelopes/${envelopeId}`;

  // 9. Update partner record
  await supabaseAdmin.from('partners').update({
    envelope_id: envelopeId,
    document_key: documentKey,
    contrato_status: 'pendente_parceiro',
    contrato_url: downloadUrl,
  }).eq('id', partnerId);

  // 10. Log history
  await supabaseAdmin.from('partner_history').insert({
    partner_id: partnerId,
    action: 'contrato_enviado',
    details: { envelope_id: envelopeId, document_id: documentId, signer_email: partner.email },
    created_by: userId,
  });

  // 11. Audit log with separated request/response
  await supabaseAdmin.from('audit_logs').insert({
    user_id: userId,
    action: 'clicksign_contract_generated',
    target_table: 'partners',
    target_id: partnerId,
    details: {
      success: true,
      request_payload: { partner_id: partnerId, partner_name: partner.nome, partner_email: partner.email, file_name: fileName },
      response_payload: { envelope_id: envelopeId, document_id: documentId, signer_id: signerId, status: 'pendente_parceiro' },
    },
  });

  return { envelope_id: envelopeId, status: 'pendente_parceiro' };
}

async function getEnvelopeStatus(envelopeId: string) {
  return await clicksignFetch(`/api/v3/envelopes/${envelopeId}`, 'GET');
}

async function getDocumentInfo(partnerId: string) {
  const { data: partner, error } = await supabaseAdmin
    .from('partners').select('document_key, envelope_id, nome, contrato_url').eq('id', partnerId).single();
  if (error || !partner) throw new HttpError(404, 'Parceiro não encontrado');

  if (!partner.envelope_id) {
    throw new HttpError(404, 'Não foi possível obter a URL do documento. Verifique se o contrato foi gerado.');
  }

  // Get documents from envelope via API
  const docsRes = await clicksignFetch(`/api/v3/envelopes/${partner.envelope_id}/documents`, 'GET');
  const docs = docsRes?.data || [];
  console.log('Envelope documents for download:', JSON.stringify(docs.map((d: any) => ({ id: d.id, key: d.attributes?.key }))));

  if (docs.length === 0) {
    throw new HttpError(404, 'Nenhum documento encontrado no envelope.');
  }

  const docId = docs[0].id;

  // Check envelope status to determine kind
  const envRes = await clicksignFetch(`/api/v3/envelopes/${partner.envelope_id}`, 'GET');
  const envStatus = envRes?.data?.attributes?.status || '';

  return { envelope_id: partner.envelope_id, document_id: docId, envelope_status: envStatus, partner_name: partner.nome };
}

async function resendNotification(partnerId: string, userId: string) {
  const { data: partner, error } = await supabaseAdmin
    .from('partners').select('envelope_id, nome, email').eq('id', partnerId).single();
  if (error || !partner) throw new HttpError(404, 'Parceiro não encontrado');
  if (!partner.envelope_id) throw new HttpError(400, 'Este parceiro não possui envelope de contrato. Gere o contrato primeiro.');

  // List signers
  const signersRes = await clicksignFetch(`/api/v3/envelopes/${partner.envelope_id}/signers`, 'GET');
  const signers = signersRes?.data || [];
  if (signers.length === 0) throw new HttpError(404, 'Nenhum signatário encontrado no envelope.');

  const notificationBody = {
    data: {
      type: 'notifications',
      attributes: { message: null },
    }
  };
  let notifiedCount = 0;
  for (const signer of signers) {
    try {
      await clicksignFetch(`/api/v3/envelopes/${partner.envelope_id}/signers/${signer.id}/notifications`, 'POST', notificationBody);
      notifiedCount++;
      console.log(`Resend notification to signer ${signer.id} (${signer.attributes?.email || 'unknown'})`);
    } catch (e) {
      console.warn(`Failed to notify signer ${signer.id}:`, e);
    }
  }

  // Log
  await supabaseAdmin.from('partner_history').insert({
    partner_id: partnerId,
    action: 'contrato_reenviado',
    details: { envelope_id: partner.envelope_id, signers_notified: notifiedCount },
    created_by: userId,
  });

  await supabaseAdmin.from('audit_logs').insert({
    user_id: userId,
    action: 'clicksign_resend_notification',
    target_table: 'partners',
    target_id: partnerId,
    details: {
      success: notifiedCount > 0,
      request_payload: { partner_id: partnerId, envelope_id: partner.envelope_id, action: 'resend_notification' },
      response_payload: { notified: notifiedCount, signers_total: signers.length, partner_name: partner.nome },
    },
  });

  return { success: true, notified: notifiedCount, envelope_id: partner.envelope_id };
}

async function downloadPdfProxy(partnerId: string) {
  const urlResult = await getSignedDocumentUrl(partnerId);
  const pdfUrl = urlResult.signed_url;

  console.log('downloadPdfProxy: fetching URL:', pdfUrl, 'source:', urlResult.source);

  // Fetch PDF via server-side to bypass CORS, follow redirects
  const res = await fetch(pdfUrl, {
    headers: { 'Authorization': CLICKSIGN_TOKEN },
    redirect: 'follow',
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('PDF download failed:', res.status, text.substring(0, 500));
    throw new HttpError(res.status, `Falha ao baixar PDF: ${res.status}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const uint8 = new Uint8Array(arrayBuffer);

  // Validate PDF magic bytes (%PDF)
  const header = String.fromCharCode(uint8[0], uint8[1], uint8[2], uint8[3], uint8[4]);
  if (!header.startsWith('%PDF')) {
    const textContent = new TextDecoder().decode(uint8.slice(0, 1000));
    console.error('downloadPdfProxy: received non-PDF content:', textContent.substring(0, 300));
    
    // Try to extract redirect URL from HTML
    const metaMatch = textContent.match(/url=([^"'\s>]+)/i);
    const hrefMatch = textContent.match(/href="([^"]+)"/i);
    const redirectUrl = metaMatch?.[1] || hrefMatch?.[1];
    
    if (redirectUrl) {
      console.log('downloadPdfProxy: following HTML redirect to:', redirectUrl);
      const res2 = await fetch(redirectUrl, { redirect: 'follow' });
      if (!res2.ok) {
        const t2 = await res2.text();
        console.error('PDF redirect download failed:', res2.status, t2.substring(0, 300));
        throw new HttpError(res2.status, `Falha ao baixar PDF após redirecionamento: ${res2.status}`);
      }
      const ab2 = await res2.arrayBuffer();
      const u2 = new Uint8Array(ab2);
      const h2 = String.fromCharCode(u2[0], u2[1], u2[2], u2[3], u2[4]);
      if (!h2.startsWith('%PDF')) {
        throw new HttpError(502, 'O arquivo retornado pela ClickSign não é um PDF válido mesmo após redirecionamento.');
      }
      // Encode in chunks to avoid stack overflow for large files
      const base64 = encodeBase64(u2);
      return { pdf_base64: base64, filename: `contrato_${urlResult.partner_name || 'parceiro'}.pdf` };
    }

    throw new HttpError(502, 'O arquivo retornado pela ClickSign não é um PDF válido. Verifique o status do contrato.');
  }

  // Encode in chunks to avoid stack overflow for large files
  const base64 = encodeBase64(uint8);
  return { pdf_base64: base64, filename: `contrato_${urlResult.partner_name || 'parceiro'}.pdf` };
}

function encodeBase64(uint8: Uint8Array): string {
  const CHUNK = 8192;
  let result = '';
  for (let i = 0; i < uint8.length; i += CHUNK) {
    const chunk = uint8.subarray(i, Math.min(i + CHUNK, uint8.length));
    result += String.fromCharCode(...chunk);
  }
  return btoa(result);
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
      case 'get_signed_url':
        if (!partner_id) throw new HttpError(400, 'partner_id is required');
        result = await getSignedDocumentUrl(partner_id);
        break;
      case 'resend_notification': {
        if (!partner_id) throw new HttpError(400, 'partner_id is required');
        result = await resendNotification(partner_id, userId);
        break;
      }
      case 'download_pdf': {
        if (!partner_id) throw new HttpError(400, 'partner_id is required');
        result = await downloadPdfProxy(partner_id);
        break;
      }
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
