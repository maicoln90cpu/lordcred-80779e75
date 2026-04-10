import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Save, Loader2, RotateCcw, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const PLACEHOLDERS = [
  { key: '{{RAZAO_SOCIAL}}', desc: 'Razão social ou nome do parceiro' },
  { key: '{{CNPJ}}', desc: 'CNPJ da empresa parceira' },
  { key: '{{CNPJ_CURTO}}', desc: 'CNPJ abreviado (sem filial)' },
  { key: '{{ENDERECO_PJ}}', desc: 'Endereço PJ completo' },
  { key: '{{REPRESENTANTE_NOME}}', desc: 'Nome do representante legal' },
  { key: '{{REPRESENTANTE_NACIONALIDADE}}', desc: 'Nacionalidade' },
  { key: '{{REPRESENTANTE_ESTADO_CIVIL}}', desc: 'Estado civil' },
  { key: '{{REPRESENTANTE_CPF}}', desc: 'CPF formatado' },
  { key: '{{REPRESENTANTE_ENDERECO}}', desc: 'Endereço pessoal' },
  { key: '{{DIA_PAGAMENTO}}', desc: 'Dia do pagamento (default 7)' },
  { key: '{{VIGENCIA_MESES}}', desc: 'Vigência em meses (default 12)' },
  { key: '{{AVISO_PREVIO_DIAS}}', desc: 'Aviso prévio em dias (default 7)' },
  { key: '{{DIA}}', desc: 'Dia atual' },
  { key: '{{MES}}', desc: 'Mês atual por extenso' },
  { key: '{{ANO}}', desc: 'Ano atual' },
];

const DEFAULT_TEMPLATE = `CONTRATO DE PARCERIA COMERCIAL AUTÔNOMA

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

export function ContractTemplateEditor() {
  const [template, setTemplate] = useState('');
  const [original, setOriginal] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('system_settings')
        .select('contract_template')
        .limit(1)
        .single();
      const text = data?.contract_template || '';
      if (text.length > 500) {
        setTemplate(text);
        setOriginal(text);
      } else {
        setTemplate(DEFAULT_TEMPLATE);
        setOriginal(DEFAULT_TEMPLATE);
        await supabase
          .from('system_settings')
          .update({ contract_template: DEFAULT_TEMPLATE })
          .not('id', 'is', null);
        console.log('Auto-saved default contract template to DB');
      }
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('system_settings')
      .update({ contract_template: template })
      .not('id', 'is', null);
    setSaving(false);
    if (error) {
      toast.error('Erro ao salvar template', { description: error.message });
    } else {
      setOriginal(template);
      toast.success('Template do contrato salvo com sucesso!');
    }
  };

  const handleReset = () => {
    setTemplate(DEFAULT_TEMPLATE);
  };

  const dirty = template !== original;

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="w-4 h-4 text-primary" />
            Placeholders Disponíveis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {PLACEHOLDERS.map(p => (
              <button
                key={p.key}
                onClick={() => {
                  navigator.clipboard.writeText(p.key);
                  toast.success(`"${p.key}" copiado!`);
                }}
                className="inline-flex items-center gap-1.5 group"
                title={`${p.desc} — clique para copiar`}
              >
                <Badge variant="secondary" className="font-mono text-xs cursor-pointer group-hover:bg-primary/20 transition-colors">
                  {p.key}
                </Badge>
                <span className="text-xs text-muted-foreground hidden sm:inline">{p.desc}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Texto Base do Contrato</span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={handleReset}>
                <RotateCcw className="w-3.5 h-3.5 mr-1" /> Restaurar Padrão
              </Button>
              <Button size="sm" onClick={handleSave} disabled={!dirty || saving}>
                {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                {saving ? 'Salvando...' : 'Salvar Template'}
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[60vh]">
            <Textarea
              value={template}
              onChange={e => setTemplate(e.target.value)}
              className="min-h-[55vh] font-mono text-xs resize-none leading-relaxed"
              spellCheck={false}
            />
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

export { DEFAULT_TEMPLATE };
