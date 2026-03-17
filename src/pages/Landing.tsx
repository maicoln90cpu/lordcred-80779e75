import { Link } from 'react-router-dom';
import {
  ShieldCheck, MessageSquare, BarChart3, Users, Kanban, Zap,
  Clock, Flame, Target, Send, CalendarClock, FileBarChart,
  Brain, Shuffle, Moon, Layers, ArrowRight, CheckCircle2,
  AlertTriangle, FolderSearch, PhoneOff, Smartphone, Rocket
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import logoExtended from '@/assets/logo-new.png';

const Landing = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <img src={logoExtended} alt="LordCred" className="h-10 object-contain" />
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm">Entrar</Button>
            </Link>
            <Link to="/register">
              <Button size="sm" className="gap-1.5">
                Começar Agora <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="container mx-auto px-4 text-center relative z-10">
          <Badge className="mb-6 bg-primary/10 text-primary border-primary/20 hover:bg-primary/15 text-sm px-4 py-1.5">
            <Rocket className="w-3.5 h-3.5 mr-1.5" />
            Em breve: Disparos em massa
          </Badge>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight max-w-4xl mx-auto tracking-tight">
            Aquecimento inteligente de chips WhatsApp
            <span className="text-primary"> + CRM de vendas</span> integrado
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Proteja seus números contra bloqueios, gerencie leads e feche vendas — tudo em uma única plataforma projetada para operações de crédito consignado.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register">
              <Button size="lg" className="text-base px-8 gap-2 h-12">
                Começar Agora Grátis <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <a href="#funcionalidades">
              <Button size="lg" variant="outline" className="text-base px-8 h-12">
                Ver Funcionalidades
              </Button>
            </a>
          </div>
          <div className="mt-12 flex items-center justify-center gap-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-primary" /> Sem cartão de crédito</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-primary" /> Setup em 5 minutos</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-primary" /> Suporte dedicado</span>
          </div>
        </div>
      </section>

      {/* Dores */}
      <section className="py-20 border-t border-border/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold">
              Cansado de <span className="text-destructive">perder chips</span> e leads?
            </h2>
            <p className="mt-4 text-muted-foreground text-lg max-w-xl mx-auto">
              Esses problemas custam dinheiro todos os dias. A LordCred resolve cada um deles.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              {
                icon: PhoneOff,
                title: 'Chips bloqueados constantemente',
                desc: 'Números novos banidos em horas por falta de aquecimento. Cada chip perdido é dinheiro jogado fora.',
                color: 'text-destructive'
              },
              {
                icon: FolderSearch,
                title: 'Gestão manual e caótica',
                desc: 'Planilhas desorganizadas, leads esquecidos, conversas perdidas. Sem visibilidade do que a equipe está fazendo.',
                color: 'text-warning'
              },
              {
                icon: AlertTriangle,
                title: 'Leads que escapam do funil',
                desc: 'Sem follow-up automático, sem etiquetas, sem Kanban. O vendedor esquece e o cliente fecha com o concorrente.',
                color: 'text-info'
              }
            ].map((item, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-6 hover:border-primary/30 transition-colors">
                <div className={`w-12 h-12 rounded-lg bg-card flex items-center justify-center border border-border mb-4 ${item.color}`}>
                  <item.icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Como Funciona */}
      <section className="py-20 border-t border-border/50 bg-card/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold">
              Como funciona? <span className="text-primary">Simples assim.</span>
            </h2>
            <p className="mt-4 text-muted-foreground text-lg max-w-xl mx-auto">
              Em 3 passos, seus chips estão protegidos e suas vendas organizadas.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              {
                step: '01',
                icon: Smartphone,
                title: 'Conecte seus chips',
                desc: 'Vincule seus números WhatsApp em segundos via QR Code. Suporte a chips de aquecimento e de atendimento.'
              },
              {
                step: '02',
                icon: Flame,
                title: 'O sistema aquece automaticamente',
                desc: 'Algoritmo de 5 fases simula comportamento humano real: digitação, leitura, intervalos aleatórios e horários comerciais.'
              },
              {
                step: '03',
                icon: Target,
                title: 'Venda com segurança',
                desc: 'Use o chat integrado, Kanban de conversas e gestão de leads para converter contatos em clientes — sem risco de bloqueio.'
              }
            ].map((item, i) => (
              <div key={i} className="text-center relative">
                <div className="text-5xl font-black text-primary/10 absolute -top-2 left-1/2 -translate-x-1/2">
                  {item.step}
                </div>
                <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-5 relative z-10">
                  <item.icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Funcionalidades */}
      <section id="funcionalidades" className="py-20 border-t border-border/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold">
              Tudo que você precisa, <span className="text-primary">em um só lugar</span>
            </h2>
            <p className="mt-4 text-muted-foreground text-lg max-w-xl mx-auto">
              Uma plataforma completa para quem leva WhatsApp a sério.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-6xl mx-auto">
            {[
              { icon: Flame, title: 'Aquecimento em 5 Fases', desc: 'De "Novo" a "Maduro" com volume progressivo e proteção automática.' },
              { icon: MessageSquare, title: 'Chat WhatsApp Integrado', desc: 'Atenda clientes direto na plataforma com histórico completo.' },
              { icon: Kanban, title: 'Kanban de Conversas', desc: 'Organize conversas em colunas personalizáveis. Nunca perca um deal.' },
              { icon: Users, title: 'Gestão de Leads', desc: 'Importação em massa, filtros por perfil, atribuição por vendedor.' },
              { icon: ShieldCheck, title: 'Monitor de Chips', desc: 'Status em tempo real, health check automático e alertas.' },
              { icon: BarChart3, title: 'Dashboard de Métricas', desc: 'Gráficos de envios, taxa de resposta, performance por vendedor.' },
              { icon: Zap, title: 'Chat Interno da Equipe', desc: 'Comunicação interna sem sair da plataforma. Canais e DMs.' },
              { icon: Clock, title: 'Proteção Anti-Bloqueio', desc: 'Simulação humana, limites inteligentes, cooldown e modo noturno.' }
            ].map((item, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all group">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <item.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold mb-1.5">{item.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Em Breve: Disparos */}
      <section className="py-20 border-t border-border/50 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-14">
            <Badge className="mb-4 bg-warning/10 text-warning border-warning/20 hover:bg-warning/15">
              <Rocket className="w-3.5 h-3.5 mr-1.5" /> Em desenvolvimento
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold">
              Em breve: <span className="text-primary">Disparos em Massa</span>
            </h2>
            <p className="mt-4 text-muted-foreground text-lg max-w-xl mx-auto">
              O módulo de disparo que vai multiplicar seus resultados — com toda a inteligência anti-bloqueio que você já conhece.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              { icon: Send, title: 'Disparo Segmentado', desc: 'Envie mensagens por perfil, status, banco ou lote. Segmentação precisa para conversão máxima.' },
              { icon: CalendarClock, title: 'Agendamento Inteligente', desc: 'Programe envios em horários de pico. O sistema distribui entre chips para evitar bloqueio.' },
              { icon: FileBarChart, title: 'Relatórios de Entrega', desc: 'Acompanhe taxa de entrega, leitura e resposta em tempo real. Otimize suas campanhas.' }
            ].map((item, i) => (
              <div key={i} className="rounded-xl border border-primary/20 bg-card/80 backdrop-blur p-6 text-center">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-5">
                  <item.icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Diferenciais */}
      <section className="py-20 border-t border-border/50 bg-card/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold">
              Por que a LordCred é <span className="text-primary">diferente?</span>
            </h2>
            <p className="mt-4 text-muted-foreground text-lg max-w-xl mx-auto">
              Não é apenas mais um bot de WhatsApp. É uma plataforma de inteligência.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-5 max-w-3xl mx-auto">
            {[
              { icon: Brain, title: 'Simulação Humana Real', desc: 'Digitação, leitura, tempo de resposta — tudo simulado para parecer um usuário real. O WhatsApp não percebe a diferença.' },
              { icon: Shuffle, title: 'Variação Aleatória', desc: 'Intervalos entre mensagens nunca são iguais. O algoritmo adiciona ±50% de variação para quebrar padrões detectáveis.' },
              { icon: Moon, title: 'Modo Noturno e Fim de Semana', desc: 'Redução automática de volume fora do horário comercial e aos finais de semana. Comportamento 100% natural.' },
              { icon: Layers, title: 'Múltiplos Modos de Aquecimento', desc: 'Same-user, between-users ou external. Escolha o modo ideal para cada cenário e maximize a segurança.' }
            ].map((item, i) => (
              <div key={i} className="flex gap-4 rounded-xl border border-border bg-card p-5 hover:border-primary/30 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <item.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{item.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-24 border-t border-border/50 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-primary/10 via-transparent to-transparent pointer-events-none" />
        <div className="container mx-auto px-4 text-center relative z-10">
          <h2 className="text-3xl md:text-4xl font-bold max-w-2xl mx-auto">
            Pronto para parar de perder chips e <span className="text-primary">começar a vender mais?</span>
          </h2>
          <p className="mt-4 text-muted-foreground text-lg max-w-xl mx-auto">
            Junte-se a operações que já protegem seus números e organizam suas vendas com a LordCred.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register">
              <Button size="lg" className="text-base px-10 gap-2 h-12">
                Criar Conta Grátis <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            Sem compromisso. Cancele quando quiser.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <img src={logoExtended} alt="LordCred" className="h-8 object-contain opacity-60" />
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} LordCred. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
