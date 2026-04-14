import { useState } from 'react';
import { CheckCircle2, Circle, ExternalLink, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface MetaSetupGuideProps {
  hasAppId: boolean;
  hasToken: boolean;
  hasVerifyToken: boolean;
  webhookUrl: string;
}

interface Step {
  id: number;
  title: string;
  description: string;
  details: string[];
  link?: { url: string; label: string };
  checkFn: () => boolean;
}

export default function MetaSetupGuide({ hasAppId, hasToken, hasVerifyToken, webhookUrl }: MetaSetupGuideProps) {
  const { toast } = useToast();
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const steps: Step[] = [
    {
      id: 1,
      title: 'Criar conta no Meta Business',
      description: 'Acesse o Meta Business Suite e crie uma conta empresarial.',
      details: [
        'Acesse business.facebook.com e faça login com sua conta do Facebook.',
        'Clique em "Criar Conta" e preencha as informações da empresa.',
        'Verifique sua empresa (pode levar 1-3 dias úteis).',
        'Isso é necessário para ter acesso à API oficial do WhatsApp.',
      ],
      link: { url: 'https://business.facebook.com', label: 'Abrir Meta Business' },
      checkFn: () => hasAppId,
    },
    {
      id: 2,
      title: 'Criar App no Meta for Developers',
      description: 'Crie um aplicativo e adicione o produto WhatsApp.',
      details: [
        'Acesse developers.facebook.com e clique em "Meus Apps".',
        'Clique em "Criar App" → selecione "Negócios" como tipo.',
        'Nomeie o app (ex: "LordCred WhatsApp") e associe à sua conta Business.',
        'Na lista de produtos, encontre "WhatsApp" e clique em "Configurar".',
        'Copie o App ID que aparece na barra lateral.',
      ],
      link: { url: 'https://developers.facebook.com/apps/', label: 'Abrir Meta Developers' },
      checkFn: () => hasAppId,
    },
    {
      id: 3,
      title: 'Registrar número de telefone',
      description: 'Vincule e verifique um número para enviar mensagens.',
      details: [
        'No painel do app, vá em WhatsApp → Configurações da API.',
        'Clique em "Adicionar número de telefone".',
        'Insira o número que será usado para enviar mensagens.',
        'Verifique o número com o código SMS ou ligação recebida.',
        'Anote o Phone Number ID — será necessário ao criar o chip.',
      ],
      link: { url: 'https://developers.facebook.com/apps/', label: 'Configurar Número' },
      checkFn: () => hasToken,
    },
    {
      id: 4,
      title: 'Gerar Access Token permanente',
      description: 'Crie um token que não expire para uso na API.',
      details: [
        'No painel do app, vá em WhatsApp → Configurações da API.',
        'O token temporário expira em 24h — NÃO use em produção.',
        'Para gerar um token permanente:',
        '  1. Vá em Configurações do App → Básico → copie o App Secret.',
        '  2. Vá em Ferramentas → Graph API Explorer.',
        '  3. Selecione seu app e gere um token de "Usuário do Sistema".',
        '  4. Adicione permissões: whatsapp_business_messaging, whatsapp_business_management.',
        'Cole o token no campo "Access Token" nesta página.',
      ],
      checkFn: () => hasToken,
    },
    {
      id: 5,
      title: 'Configurar Webhook',
      description: 'Aponte o Meta para receber eventos neste sistema.',
      details: [
        'No painel do app, vá em WhatsApp → Configuração → Webhook.',
        'Clique em "Editar" e cole a URL de webhook abaixo.',
        'No campo "Verify Token", use o mesmo valor configurado nesta página.',
        'Clique em "Verificar e salvar".',
        'Após salvar, ative os eventos: messages, message_deliveries, message_reads.',
      ],
      checkFn: () => hasVerifyToken,
    },
  ];

  const completedCount = steps.filter(s => s.checkFn()).length;
  const progress = Math.round((completedCount / steps.length) * 100);

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    toast({ title: 'URL do webhook copiada!' });
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">📋 Guia de Configuração Meta</CardTitle>
          <Badge variant={progress === 100 ? 'default' : 'secondary'} className="text-xs">
            {completedCount}/{steps.length} etapas
          </Badge>
        </div>
        <div className="w-full bg-muted rounded-full h-2 mt-2">
          <div
            className={cn('rounded-full h-2 transition-all duration-500', progress === 100 ? 'bg-green-500' : 'bg-primary')}
            style={{ width: `${progress}%` }}
          />
        </div>
        {progress === 100 && (
          <p className="text-xs text-green-500 mt-1">✅ Todas as etapas concluídas! Seu Meta WhatsApp está pronto.</p>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {steps.map((step) => {
          const done = step.checkFn();
          const isExpanded = expandedStep === step.id;

          return (
            <div key={step.id} className={cn('border rounded-lg transition-colors', done ? 'border-green-500/30 bg-green-500/5' : 'border-border')}>
              <button
                className="w-full flex items-center gap-3 p-3 text-left"
                onClick={() => setExpandedStep(isExpanded ? null : step.id)}
              >
                {done ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                ) : (
                  <Circle className="w-5 h-5 text-muted-foreground shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-medium', done && 'text-green-500')}>
                    {step.id}. {step.title}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{step.description}</p>
                </div>
                {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
              </button>

              {isExpanded && (
                <div className="px-3 pb-3 pt-0 space-y-3 border-t border-border/50">
                  <ul className="space-y-1.5 mt-3">
                    {step.details.map((detail, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex gap-2">
                        <span className="text-primary shrink-0">•</span>
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>

                  {step.id === 5 && (
                    <div className="flex items-center gap-2 bg-muted/50 rounded p-2">
                      <code className="text-[10px] flex-1 truncate font-mono">{webhookUrl}</code>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={handleCopyWebhook}>
                        {copiedWebhook ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        Copiar
                      </Button>
                    </div>
                  )}

                  {step.link && (
                    <a
                      href={step.link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {step.link.label}
                    </a>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
