import { ExternalLink, BookOpen } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';

interface GuideStep {
  key: string;
  label: string;
  purpose: string;
  steps: string[];
  visualHint?: string;
  commonErrors: string[];
  link?: { url: string; label: string };
  optional?: boolean;
}

const GUIDE: GuideStep[] = [
  {
    key: 'app_id',
    label: 'App ID',
    purpose: 'Identifica o seu aplicativo Meta. É um número público (não é segredo).',
    steps: [
      'Acesse developers.facebook.com e faça login',
      'No menu superior, clique em "Meus Apps"',
      'Selecione o app que você criou para o WhatsApp',
      'No cabeçalho da página, abaixo do nome do app, aparece "ID do App: 123456789012345"',
      'Copie esse número e cole no campo "App ID"',
    ],
    visualHint: 'O ID fica visível no canto superior esquerdo, logo abaixo do nome do app.',
    commonErrors: [
      'Confundir App ID com Phone Number ID — App ID é do APP, Phone Number ID é do número de telefone',
      'Copiar com espaço no final',
    ],
    link: { url: 'https://developers.facebook.com/apps', label: 'Abrir Meus Apps' },
  },
  {
    key: 'access_token',
    label: 'Access Token (Token de Acesso Permanente)',
    purpose: 'Autoriza o sistema a enviar mensagens e ler dados do WhatsApp em seu nome.',
    steps: [
      'Acesse business.facebook.com → Configurações do Negócio (ícone de engrenagem)',
      'No menu esquerdo, vá em "Usuários → Usuários do Sistema"',
      'Crie um Usuário do Sistema com a função "Admin" (ou use um existente)',
      'Clique em "Adicionar Ativos" → adicione o seu App e a Conta WhatsApp Business → marque "Controle Total"',
      'Clique no botão "Gerar Novo Token"',
      'Selecione o App correto',
      'MARQUE AS DUAS PERMISSÕES: ☑ whatsapp_business_messaging  ☑ whatsapp_business_management',
      'Em "Validade do Token", escolha "Sem expiração"',
      'Clique em Gerar e COPIE imediatamente (o Meta só mostra uma vez)',
      'Cole no campo "Access Token"',
    ],
    visualHint: 'O token começa com "EAA..." e tem cerca de 200 caracteres.',
    commonErrors: [
      'Esquecer de marcar whatsapp_business_management → causa erro "missing permissions" ao validar números',
      'Usar token temporário (de 24h) em vez de permanente',
      'Gerar token no app errado',
    ],
    link: { url: 'https://business.facebook.com/settings/system-users', label: 'Abrir Usuários do Sistema' },
  },
  {
    key: 'verify_token',
    label: 'Verify Token (Webhook)',
    purpose: 'Texto secreto que você inventa para o Meta confirmar que o webhook é seu.',
    steps: [
      'Não precisa achar em lugar nenhum — você INVENTA',
      'Use uma palavra ou frase única, ex: "lordcred2026" ou "meutoken-secreto-987"',
      'Cole esse texto no campo "Verify Token" desta tela',
      'No Meta Business Manager → App → WhatsApp → Configuration → Webhook → cole o MESMO texto no campo "Verify Token"',
      'Clique em "Verify and Save" no Meta — se os dois textos baterem, fica verde',
    ],
    visualHint: 'Pense nele como uma "senha do porteiro": só quem souber consegue se conectar ao webhook.',
    commonErrors: [
      'Colocar valores diferentes aqui e no Meta → verificação falha com erro 403',
      'Usar caracteres especiais que confundem URLs (use apenas letras, números, hífen)',
    ],
  },
  {
    key: 'app_secret',
    label: 'App Secret (Chave Secreta do App)',
    purpose: 'Permite validar a origem dos webhooks usando assinatura criptográfica.',
    steps: [
      'Acesse developers.facebook.com → Meus Apps → seu app',
      'No menu esquerdo, vá em "Configurações → Básico"',
      'Procure o campo "Chave secreta do app"',
      'Clique em "Mostrar" (vai pedir sua senha do Facebook)',
      'Copie o valor (32 caracteres alfanuméricos)',
      'Cole no campo "App Secret"',
    ],
    visualHint: 'Fica logo abaixo do "ID do App" na mesma página de Configurações Básicas.',
    commonErrors: [
      'Confundir App Secret com Access Token — são DIFERENTES',
      'Compartilhar o App Secret em prints públicos',
    ],
    link: { url: 'https://developers.facebook.com/apps', label: 'Abrir App → Configurações' },
  },
  {
    key: 'webhook_secret',
    label: 'Webhook Secret (HMAC)',
    purpose: 'Validação criptográfica extra de cada webhook recebido. OPCIONAL.',
    optional: true,
    steps: [
      'Este campo é OPCIONAL — se deixar vazio, o sistema funciona normalmente',
      'Se quiser usar, configure no Meta Business Manager → App → WhatsApp → Configuration → Webhook',
      'Procure por "Webhook Secret" ou "Secret" — defina um texto qualquer',
      'Cole o MESMO texto neste campo',
      'O Meta vai assinar cada requisição e o sistema vai validar antes de processar',
    ],
    visualHint: 'Camada extra de segurança. Útil em produção, dispensável durante testes.',
    commonErrors: [
      'Definir aqui mas não no Meta → todos os webhooks serão rejeitados',
      'Trocar o secret sem atualizar nos dois lugares ao mesmo tempo',
    ],
  },
];

export default function MetaCredentialsGuide() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="w-5 h-5" />
          Manual Passo a Passo — Credenciais Meta
        </CardTitle>
        <CardDescription>
          Guia leigo para encontrar cada credencial no painel da Meta. Clique em cada item para expandir.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" className="w-full">
          {GUIDE.map((item) => (
            <AccordionItem key={item.key} value={item.key}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2 text-left">
                  <span className="font-semibold">{item.label}</span>
                  {item.optional && (
                    <Badge variant="secondary" className="text-xs">Opcional</Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4">
                <div className="bg-muted/40 rounded-md p-3">
                  <p className="text-sm">
                    <span className="font-medium">🎯 Para que serve: </span>
                    {item.purpose}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium mb-2">📍 Passo a passo:</p>
                  <ol className="list-decimal list-inside space-y-1.5 text-sm text-muted-foreground pl-1">
                    {item.steps.map((step, i) => (
                      <li key={i} className="leading-relaxed">{step}</li>
                    ))}
                  </ol>
                </div>

                {item.visualHint && (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-md p-3">
                    <p className="text-sm">
                      <span className="font-medium">🖼️ Dica visual: </span>
                      <span className="text-muted-foreground">{item.visualHint}</span>
                    </p>
                  </div>
                )}

                <div className="bg-destructive/5 border border-destructive/20 rounded-md p-3">
                  <p className="text-sm font-medium mb-2">⚠️ Erros comuns:</p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    {item.commonErrors.map((err, i) => (
                      <li key={i} className="leading-relaxed">{err}</li>
                    ))}
                  </ul>
                </div>

                {item.link && (
                  <a
                    href={item.link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    🔗 {item.link.label} <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
