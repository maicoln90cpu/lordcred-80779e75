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
§1º A EMPRESA PARCEIRA atuará com total autonomia, assumindo os riscos de sua atividade, inexistindo subordinação jurídica, pessoalidade, habitualidade compulsória ou contraprestação financeira fixa.
§2º A EMPRESA PARCEIRA não estará sujeita a controle de jornada, exclusividade, fiscalização hierárquica ou qualquer forma de subordinação estrutural.
§3º A EMPRESA PARCEIRA poderá prestar serviços a terceiros, salvo nas hipóteses previstas na cláusula de não concorrência deste contrato.
§4º A EMPRESA PARCEIRA é integralmente responsável pelo recolhimento de seus tributos, contribuições previdenciárias e demais encargos.
§5º A inexistência de resultados ou a ausência de intermediações não gera qualquer obrigação de pagamento mínimo por parte da CONTRATANTE.
§6º A EMPRESA PARCEIRA não possui poderes para representar juridicamente a CONTRATANTE, salvo autorização expressa e escrita.

CLÁUSULA 3 – DA REMUNERAÇÃO
O PARCEIRO fará jus à comissão de no mínimo 0,50% sobre o valor dos produtos e/ou serviços que forem vendidos por sua intermediação.
§1º O percentual de comissão poderá ser aumentado de acordo com o desempenho individual da EMPRESA PARCEIRA.
§2º A comissão somente será devida após a efetiva venda e o pagamento pelo cliente.
§3º Em caso de inadimplemento, cancelamento, distrato ou devolução de valores pelo cliente, a comissão não será devida ou poderá ser estornada proporcionalmente.
§4º O pagamento será realizado até o dia {{DIA_PAGAMENTO}} do mês subsequente ao recebimento dos valores pela CONTRATANTE.
§5º Não haverá pagamento de qualquer valor fixo, ajuda de custo, verba de representação ou remuneração mínima garantida.
§6º Nos casos em que a EMPRESA PARCEIRA realizar indicação de novos clientes ou parceiros comerciais, será devida bonificação adicional inicial de 0,10% sobre o valor da negociação realizada.
§7º A bonificação por indicação poderá ser aumentada progressivamente conforme critérios de desempenho.

CLÁUSULA 4 – DA NÃO CONCORRÊNCIA
A EMPRESA PARCEIRA compromete-se, durante a vigência deste contrato e pelo prazo de 12 meses após sua rescisão, a não:
a) Comercializar produtos ou serviços idênticos ou diretamente concorrentes aos da CONTRATANTE;
b) Utilizar informações estratégicas, listas de clientes ou dados comerciais da CONTRATANTE para benefício próprio ou de terceiros;
c) Desviar clientela vinculada aos negócios intermediados.
§1º A restrição limita-se à área de atuação correspondente aos produtos/serviços objeto desta parceria.
§2º A presente cláusula não impede a EMPRESA PARCEIRA de exercer sua atividade profissional de forma ampla, desde que não haja concorrência direta ou indireta.

CLÁUSULA 5 – DA CONFIDENCIALIDADE
A EMPRESA PARCEIRA obriga-se a manter sigilo absoluto sobre todas as informações comerciais, estratégicas, financeiras e operacionais da CONTRATANTE a que tiver acesso em razão do presente contrato, obrigação essa que permanecerá por 5 anos após o término deste contrato.
§1º A EMPRESA PARCEIRA compromete-se a não divulgar, compartilhar, reproduzir ou utilizar para benefício próprio ou de terceiros quaisquer informações confidenciais.
§2º A EMPRESA PARCEIRA responderá civil, administrativa e criminalmente pelo uso indevido, divulgação ou vazamento de quaisquer informações.
§3º Consideram-se informações confidenciais: dados de clientes, estratégias comerciais, listas de contatos, políticas internas, condições comerciais, documentos internos, informações financeiras e quaisquer outros dados não públicos da CONTRATANTE.

CLÁUSULA 6 – DO REGIME DE TRABALHO REMOTO (HOME OFFICE)
As atividades desempenhadas pela EMPRESA PARCEIRA serão realizadas em regime de trabalho remoto (home office).
§1º Não haverá controle de jornada, fiscalização de horário, exigência de presença física ou imposição de rotina laboral pela CONTRATANTE.
§2º A EMPRESA PARCEIRA será integralmente responsável pela estrutura necessária para execução de suas atividades.
§3º A EMPRESA PARCEIRA declara estar ciente de que não possui horários e dias fixos de trabalho.

CLÁUSULA 7 – DA PROTEÇÃO DE DADOS PESSOAIS (LGPD)
A EMPRESA PARCEIRA declara estar ciente das disposições da Lei nº 13.709/2018 (LGPD) e compromete-se a cumprir integralmente todos os seus dispositivos.
§1º Para os fins da LGPD, a EMPRESA PARCEIRA atuará na qualidade de OPERADOR, realizando o tratamento de dados pessoais exclusivamente em nome da CONTRATANTE.
§2º A EMPRESA PARCEIRA compromete-se a:
I – Tratar os dados pessoais apenas mediante instruções da CONTRATANTE;
II – Utilizar os dados exclusivamente para fins relacionados à execução deste contrato;
III – Não compartilhar dados pessoais a terceiros sem autorização prévia e expressa;
IV – Adotar medidas técnicas e administrativas aptas a proteger os dados pessoais;
V – Manter registro das operações de tratamento realizadas quando solicitado;
VI – Assegurar que quaisquer pessoas envolvidas no tratamento de dados estejam vinculadas a dever de confidencialidade.
§3º A EMPRESA PARCEIRA compromete-se a comunicar imediatamente qualquer incidente de segurança.
§4º Encerrado o presente contrato, a EMPRESA PARCEIRA deverá eliminar ou devolver todos os dados pessoais.
§5º O descumprimento sujeitará a EMPRESA PARCEIRA à responsabilidade integral por eventuais danos.
§6º As obrigações previstas nesta cláusula subsistirão mesmo após o término da relação contratual.

CLÁUSULA 8 – DA MULTA CONTRATUAL
O descumprimento de qualquer cláusula sujeitará a parte infratora ao pagamento de multa contratual.
§1º Multa pela EMPRESA PARCEIRA: 30% do valor estimado das comissões nos últimos 12 meses, ou R$ 5.000,00, prevalecendo o maior.
§2º Multa pela CONTRATANTE: 10% do valor estimado das comissões percebidas pela CONTRATADA nos últimos 12 meses.
§3º Violação de confidencialidade/não concorrência: R$ 5.000,00 ou 40% do valor do negócio envolvido, prevalecendo o maior valor.
§4º A aplicação da multa não exclui o direito de pleitear indenização suplementar por perdas e danos.

CLÁUSULA 9 – DA VIGÊNCIA E RESCISÃO
O presente contrato vigorará por prazo determinado de {{VIGENCIA_MESES}} meses.
§1º Este contrato poderá ser rescindido por qualquer das partes mediante aviso prévio por escrito com antecedência mínima de {{AVISO_PREVIO_DIAS}} dias.
§2º Poderá haver rescisão imediata em caso de:
a) Descumprimento/violação de quaisquer cláusulas;
b) Ato que prejudique a CONTRATANTE;
c) Utilização indevida da marca, nome empresarial, logotipo ou quaisquer sinais distintivos;
d) Prática de conduta que cause dano à imagem ou reputação da CONTRATANTE;
e) Comercialização em desacordo com as condições previamente estabelecidas;
f) Prestação de informações falsas, incompletas ou enganosas;
g) Transferência das atividades a terceiros sem autorização;
h) Envolvimento em práticas ilícitas ou fraudulentas;
i) Decretação de falência, recuperação judicial ou encerramento das atividades;
j) Prática de concorrência desleal;
k) Qualquer conduta que comprometa a execução regular do objeto contratual.

CLÁUSULA 10 – DO FORO
Fica eleito o foro da Comarca de Palhoça/SC para dirimir eventuais controvérsias.

E por estarem justas e contratadas, firmam o presente instrumento.

Palhoça/SC, {{DIA}} de {{MES}} de {{ANO}}.

___________________________________
LORD CRED (CONTRATANTE)

___________________________________
{{RAZAO_SOCIAL}} (EMPRESA PARCEIRA)`;

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
      if (text.length > 100) {
        setTemplate(text);
        setOriginal(text);
      } else {
        // Template is empty in DB - auto-save the default
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
