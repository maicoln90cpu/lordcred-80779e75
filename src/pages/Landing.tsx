import { Link } from 'react-router-dom';
import {
  ShieldCheck, MessageSquare, BarChart3, Users, Kanban, Zap,
  Clock, Flame, Target, Send, CalendarClock, FileBarChart,
  Brain, Shuffle, Moon, Layers, ArrowRight, CheckCircle2,
  AlertTriangle, FolderSearch, PhoneOff, Smartphone, Rocket,
  ChevronDown, Sparkles, TrendingUp, Timer
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import logoExtended from '@/assets/logo-new.png';
import { motion, useInView } from 'framer-motion';
import { useRef, useEffect, useState } from 'react';

/* ─── Animated Section wrapper ─── */
const AnimatedSection = ({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-60px' });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

/* ─── Stagger container ─── */
const StaggerContainer = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-40px' });

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

const StaggerItem = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <motion.div
    variants={{
      hidden: { opacity: 0, y: 24, scale: 0.96 },
      visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
    }}
    className={className}
  >
    {children}
  </motion.div>
);

/* ─── Counter ─── */
const AnimatedCounter = ({ target, suffix = '' }: { target: number; suffix?: string }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    let start = 0;
    const duration = 1800;
    const step = (ts: number) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [isInView, target]);

  return <span ref={ref}>{count.toLocaleString('pt-BR')}{suffix}</span>;
};

/* ─── Floating icon ─── */
const FloatingIcon = ({ icon: Icon, className }: { icon: React.ElementType; className: string }) => (
  <div className={`absolute pointer-events-none opacity-20 ${className}`}>
    <Icon className="w-8 h-8 text-primary" />
  </div>
);

const Landing = () => {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {/* Header */}
      <motion.header
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/70 backdrop-blur-xl"
      >
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <img src={logoExtended} alt="LordCred" className="h-10 object-contain" />
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm">Entrar</Button>
            </Link>
            <Link to="/register">
              <Button size="sm" className="gap-1.5 animate-glow-pulse">
                Começar Agora <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </motion.header>

      {/* ════════════════ HERO ════════════════ */}
      <section className="relative pt-32 pb-24 overflow-hidden">
        {/* Glow background */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-primary/8 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-20 right-10 w-[300px] h-[300px] bg-primary/5 rounded-full blur-[80px] pointer-events-none" />

        {/* Floating icons */}
        <FloatingIcon icon={Flame} className="top-40 left-[10%] animate-float" />
        <FloatingIcon icon={ShieldCheck} className="top-28 right-[15%] animate-float-delayed" />
        <FloatingIcon icon={MessageSquare} className="bottom-20 left-[20%] animate-float-delayed" />
        <FloatingIcon icon={Target} className="bottom-32 right-[12%] animate-float" />

        <div className="container mx-auto px-4 text-center relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
            <Badge className="mb-6 bg-primary/10 text-primary border-primary/20 hover:bg-primary/15 text-sm px-4 py-1.5">
              <Rocket className="w-3.5 h-3.5 mr-1.5" />
              Em breve: Disparos em massa
            </Badge>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight max-w-4xl mx-auto tracking-tight"
          >
            Aquecimento inteligente de chips WhatsApp
            <span className="text-primary bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent"> + CRM de vendas</span> integrado
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
          >
            Proteja seus números contra bloqueios, gerencie leads e feche vendas — tudo em uma única plataforma projetada para operações de crédito consignado.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link to="/register">
              <Button size="lg" className="text-base px-8 gap-2 h-12 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all hover:-translate-y-0.5">
                Começar Agora Grátis <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <a href="#funcionalidades">
              <Button size="lg" variant="outline" className="text-base px-8 h-12 backdrop-blur-sm bg-card/30 border-border/50 hover:-translate-y-0.5 transition-all">
                Ver Funcionalidades
              </Button>
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.8 }}
            className="mt-12 flex items-center justify-center gap-6 text-sm text-muted-foreground"
          >
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-primary" /> Sem cartão de crédito</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-primary" /> Setup em 5 minutos</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-primary" /> Suporte dedicado</span>
          </motion.div>
        </div>
      </section>

      {/* ════════════════ STATS ════════════════ */}
      <section className="py-12 border-t border-b border-border/50 bg-card/30 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto text-center">
            {[
              { value: 500, suffix: '+', label: 'Chips protegidos', icon: ShieldCheck },
              { value: 99, suffix: '.7%', label: 'Uptime da plataforma', icon: TrendingUp },
              { value: 3, suffix: ' min', label: 'Tempo de setup', icon: Timer },
              { value: 50000, suffix: '+', label: 'Mensagens/dia', icon: Send },
            ].map((stat, i) => (
              <StaggerItem key={i}>
                <div className="flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-1">
                    <stat.icon className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-3xl md:text-4xl font-black text-primary">
                    <AnimatedCounter target={stat.value} suffix={stat.suffix} />
                  </span>
                  <span className="text-sm text-muted-foreground">{stat.label}</span>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* ════════════════ DORES ════════════════ */}
      <section className="py-20 border-b border-border/50">
        <div className="container mx-auto px-4">
          <AnimatedSection className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold">
              Cansado de <span className="text-destructive">perder chips</span> e leads?
            </h2>
            <p className="mt-4 text-muted-foreground text-lg max-w-xl mx-auto">
              Esses problemas custam dinheiro todos os dias. A LordCred resolve cada um deles.
            </p>
          </AnimatedSection>

          <StaggerContainer className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { icon: PhoneOff, title: 'Chips bloqueados constantemente', desc: 'Números novos banidos em horas por falta de aquecimento. Cada chip perdido é dinheiro jogado fora.', color: 'text-destructive' },
              { icon: FolderSearch, title: 'Gestão manual e caótica', desc: 'Planilhas desorganizadas, leads esquecidos, conversas perdidas. Sem visibilidade do que a equipe está fazendo.', color: 'text-warning' },
              { icon: AlertTriangle, title: 'Leads que escapam do funil', desc: 'Sem follow-up automático, sem etiquetas, sem Kanban. O vendedor esquece e o cliente fecha com o concorrente.', color: 'text-info' },
            ].map((item, i) => (
              <StaggerItem key={i}>
                <div className="rounded-xl border border-border bg-card/60 backdrop-blur-sm p-6 hover:border-primary/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5 group h-full">
                  <div className={`w-12 h-12 rounded-lg bg-card flex items-center justify-center border border-border mb-4 ${item.color} group-hover:scale-110 transition-transform`}>
                    <item.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* ════════════════ COMO FUNCIONA ════════════════ */}
      <section className="py-20 border-b border-border/50 bg-card/30 backdrop-blur-sm relative">
        <div className="container mx-auto px-4">
          <AnimatedSection className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold">
              Como funciona? <span className="text-primary">Simples assim.</span>
            </h2>
            <p className="mt-4 text-muted-foreground text-lg max-w-xl mx-auto">
              Em 3 passos, seus chips estão protegidos e suas vendas organizadas.
            </p>
          </AnimatedSection>

          <StaggerContainer className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto relative">
            {/* Connecting line */}
            <div className="hidden md:block absolute top-[60px] left-[16%] right-[16%] h-px border-t-2 border-dashed border-primary/20 z-0" />

            {[
              { step: '01', icon: Smartphone, title: 'Conecte seus chips', desc: 'Vincule seus números WhatsApp em segundos via QR Code. Suporte a chips de aquecimento e de atendimento.' },
              { step: '02', icon: Flame, title: 'O sistema aquece automaticamente', desc: 'Algoritmo de 5 fases simula comportamento humano real: digitação, leitura, intervalos aleatórios e horários comerciais.' },
              { step: '03', icon: Target, title: 'Venda com segurança', desc: 'Use o chat integrado, Kanban de conversas e gestão de leads para converter contatos em clientes — sem risco de bloqueio.' },
            ].map((item, i) => (
              <StaggerItem key={i} className="text-center relative z-10">
                <div className="text-6xl font-black text-primary/10 absolute -top-4 left-1/2 -translate-x-1/2 select-none">
                  {item.step}
                </div>
                <motion.div
                  whileHover={{ scale: 1.08, rotate: 2 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                  className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-5 relative z-10 shadow-lg shadow-primary/10"
                >
                  <item.icon className="w-7 h-7 text-primary" />
                </motion.div>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* ════════════════ FUNCIONALIDADES ════════════════ */}
      <section id="funcionalidades" className="py-20 border-b border-border/50">
        <div className="container mx-auto px-4">
          <AnimatedSection className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold">
              Tudo que você precisa, <span className="text-primary">em um só lugar</span>
            </h2>
            <p className="mt-4 text-muted-foreground text-lg max-w-xl mx-auto">
              Uma plataforma completa para quem leva WhatsApp a sério.
            </p>
          </AnimatedSection>

          <StaggerContainer className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-6xl mx-auto">
            {[
              { icon: Flame, title: 'Aquecimento em 5 Fases', desc: 'De "Novo" a "Maduro" com volume progressivo e proteção automática.' },
              { icon: MessageSquare, title: 'Chat WhatsApp Integrado', desc: 'Atenda clientes direto na plataforma com histórico completo.' },
              { icon: Kanban, title: 'Kanban de Conversas', desc: 'Organize conversas em colunas personalizáveis. Nunca perca um deal.' },
              { icon: Users, title: 'Gestão de Leads', desc: 'Importação em massa, filtros por perfil, atribuição por vendedor.' },
              { icon: ShieldCheck, title: 'Monitor de Chips', desc: 'Status em tempo real, health check automático e alertas.' },
              { icon: BarChart3, title: 'Dashboard de Métricas', desc: 'Gráficos de envios, taxa de resposta, performance por vendedor.' },
              { icon: Zap, title: 'Chat Interno da Equipe', desc: 'Comunicação interna sem sair da plataforma. Canais e DMs.' },
              { icon: Clock, title: 'Proteção Anti-Bloqueio', desc: 'Simulação humana, limites inteligentes, cooldown e modo noturno.' },
            ].map((item, i) => (
              <StaggerItem key={i}>
                <div className="rounded-xl border border-border bg-card/60 backdrop-blur-sm p-5 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 group hover:-translate-y-1 h-full">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-300">
                    <item.icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-1.5">{item.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* ════════════════ EM BREVE: DISPAROS ════════════════ */}
      <section className="py-20 border-b border-border/50 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 pointer-events-none" />
        <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_48%,hsl(var(--primary)/0.03)_49%,hsl(var(--primary)/0.03)_51%,transparent_52%)] bg-[length:30px_30px] pointer-events-none" />

        <div className="container mx-auto px-4 relative z-10">
          <AnimatedSection className="text-center mb-14">
            <Badge className="mb-4 bg-warning/10 text-warning border-warning/20 hover:bg-warning/15">
              <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Em desenvolvimento
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold">
              Em breve: <span className="text-primary">Disparos em Massa</span>
            </h2>
            <p className="mt-4 text-muted-foreground text-lg max-w-xl mx-auto">
              O módulo de disparo que vai multiplicar seus resultados — com toda a inteligência anti-bloqueio que você já conhece.
            </p>
          </AnimatedSection>

          <StaggerContainer className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              { icon: Send, title: 'Disparo Segmentado', desc: 'Envie mensagens por perfil, status, banco ou lote. Segmentação precisa para conversão máxima.' },
              { icon: CalendarClock, title: 'Agendamento Inteligente', desc: 'Programe envios em horários de pico. O sistema distribui entre chips para evitar bloqueio.' },
              { icon: FileBarChart, title: 'Relatórios de Entrega', desc: 'Acompanhe taxa de entrega, leitura e resposta em tempo real. Otimize suas campanhas.' },
            ].map((item, i) => (
              <StaggerItem key={i}>
                <motion.div
                  whileHover={{ scale: 1.03, y: -4 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                  className="rounded-xl border border-primary/20 bg-card/60 backdrop-blur-sm p-6 text-center shadow-lg shadow-primary/5 h-full"
                >
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-5 animate-glow-pulse">
                    <item.icon className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
                </motion.div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* ════════════════ DIFERENCIAIS ════════════════ */}
      <section className="py-20 border-b border-border/50 bg-card/30 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <AnimatedSection className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold">
              Por que a LordCred é <span className="text-primary">diferente?</span>
            </h2>
            <p className="mt-4 text-muted-foreground text-lg max-w-xl mx-auto">
              Não é apenas mais um bot de WhatsApp. É uma plataforma de inteligência.
            </p>
          </AnimatedSection>

          <StaggerContainer className="grid sm:grid-cols-2 gap-5 max-w-3xl mx-auto">
            {[
              { icon: Brain, title: 'Simulação Humana Real', desc: 'Digitação, leitura, tempo de resposta — tudo simulado para parecer um usuário real. O WhatsApp não percebe a diferença.' },
              { icon: Shuffle, title: 'Variação Aleatória', desc: 'Intervalos entre mensagens nunca são iguais. O algoritmo adiciona ±50% de variação para quebrar padrões detectáveis.' },
              { icon: Moon, title: 'Modo Noturno e Fim de Semana', desc: 'Redução automática de volume fora do horário comercial e aos finais de semana. Comportamento 100% natural.' },
              { icon: Layers, title: 'Múltiplos Modos de Aquecimento', desc: 'Same-user, between-users ou external. Escolha o modo ideal para cada cenário e maximize a segurança.' },
            ].map((item, i) => (
              <StaggerItem key={i}>
                <div className="flex gap-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm p-5 hover:border-primary/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5 group h-full">
                  <motion.div
                    whileHover={{ rotate: 8 }}
                    className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors"
                  >
                    <item.icon className="w-5 h-5 text-primary" />
                  </motion.div>
                  <div>
                    <h3 className="font-semibold mb-1">{item.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* ════════════════ FAQ ════════════════ */}
      <section className="py-20 border-b border-border/50">
        <div className="container mx-auto px-4">
          <AnimatedSection className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold">
              Perguntas <span className="text-primary">Frequentes</span>
            </h2>
          </AnimatedSection>

          <AnimatedSection delay={0.2} className="max-w-2xl mx-auto">
            <Accordion type="single" collapsible className="space-y-3">
              {[
                { q: 'O que é aquecimento de chip?', a: 'É o processo de simular uso humano real em um número novo de WhatsApp antes de usá-lo para envios em volume. Isso constrói reputação com o WhatsApp e evita bloqueios prematuros.' },
                { q: 'Quanto tempo leva para aquecer um chip?', a: 'O ciclo completo passa por 5 fases (Novo → Iniciante → Crescimento → Aquecido → Maduro) e pode ser configurado. Em média, um chip atinge a fase "Maduro" em 15-20 dias com as configurações padrão.' },
                { q: 'O WhatsApp pode detectar o aquecimento?', a: 'Nosso algoritmo simula comportamento humano real com variação de intervalos, simulação de digitação, delay de leitura, e redução automática em horários noturnos e finais de semana. O padrão é indistinguível de uso real.' },
                { q: 'Posso usar para chat de atendimento ao mesmo tempo?', a: 'Sim! A plataforma suporta dois tipos de chip: "warming" (aquecimento) e "whatsapp" (atendimento). Chips de atendimento têm chat integrado, Kanban e gestão de leads.' },
                { q: 'Preciso de uma API externa do WhatsApp?', a: 'Sim, a LordCred integra com UazAPI para conexão com o WhatsApp. Você pode usar sua própria instância ou contratar junto conosco.' },
              ].map((item, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="rounded-xl border border-border bg-card/60 backdrop-blur-sm px-5 data-[state=open]:border-primary/30 transition-colors">
                  <AccordionTrigger className="text-left font-semibold hover:no-underline py-4">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground text-sm leading-relaxed pb-4">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </AnimatedSection>
        </div>
      </section>

      {/* ════════════════ CTA FINAL ════════════════ */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-primary/10 via-primary/5 to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

        <AnimatedSection className="container mx-auto px-4 text-center relative z-10">
          <h2 className="text-3xl md:text-4xl font-bold max-w-2xl mx-auto">
            Pronto para parar de perder chips e <span className="text-primary">começar a vender mais?</span>
          </h2>
          <p className="mt-4 text-muted-foreground text-lg max-w-xl mx-auto">
            Junte-se a operações que já protegem seus números e organizam suas vendas com a LordCred.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
                <Button size="lg" className="text-base px-10 gap-2 h-12 shadow-lg shadow-primary/25 animate-glow-pulse">
                  Criar Conta Grátis <ArrowRight className="w-4 h-4" />
                </Button>
              </motion.div>
            </Link>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            Sem compromisso. Cancele quando quiser.
          </p>
        </AnimatedSection>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8 bg-card/30">
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
