import { useState } from 'react';
import { Copy, Check, Code, Shield, Zap, Table2, Key, Database, Settings2, Lock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';

function CopyableSQL({ sql, label }: { sql: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative">
      {label && <p className="text-xs text-muted-foreground mb-1 font-medium">{label}</p>}
      <div className="relative rounded-md bg-muted/50 border">
        <pre className="p-3 text-xs overflow-x-auto max-h-96 whitespace-pre-wrap break-words font-mono">{sql}</pre>
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-7 w-7"
          onClick={handleCopy}
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
        </Button>
      </div>
    </div>
  );
}

interface SQLSection {
  title: string;
  icon: React.ReactNode;
  description: string;
  sql: string;
}

const SQL_SECTIONS: SQLSection[] = [
  {
    title: '1. Tipos e Enums',
    icon: <Code className="w-4 h-4" />,
    description: 'Tipos customizados usados pelo sistema',
    sql: `-- Enum de roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user', 'seller');`,
  },
  {
    title: '2. Tabelas',
    icon: <Table2 className="w-4 h-4" />,
    description: 'Todas as 10 tabelas do sistema com colunas, tipos e defaults',
    sql: `-- ==========================================
-- TABELA: profiles
-- ==========================================
CREATE TABLE public.profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  name text,
  is_blocked boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_user_id_key UNIQUE (user_id)
);

-- ==========================================
-- TABELA: user_roles
-- ==========================================
CREATE TABLE public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL DEFAULT 'user'::app_role,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_roles_pkey PRIMARY KEY (id),
  CONSTRAINT user_roles_user_id_key UNIQUE (user_id)
);

-- ==========================================
-- TABELA: chips
-- ==========================================
CREATE TABLE public.chips (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  instance_name text NOT NULL,
  instance_token text,
  slot_number integer NOT NULL,
  status text NOT NULL DEFAULT 'disconnected'::text,
  phone_number text,
  nickname text,
  chip_type text NOT NULL DEFAULT 'warming'::text,
  warming_phase text NOT NULL DEFAULT 'novo'::text,
  messages_sent_today integer NOT NULL DEFAULT 0,
  last_message_at timestamp with time zone,
  last_connection_attempt timestamp with time zone,
  activated_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT chips_pkey PRIMARY KEY (id)
);

-- ==========================================
-- TABELA: chip_lifecycle_logs
-- ==========================================
CREATE TABLE public.chip_lifecycle_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  chip_id uuid,
  event text NOT NULL,
  details text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT chip_lifecycle_logs_pkey PRIMARY KEY (id),
  CONSTRAINT chip_lifecycle_logs_chip_id_fkey FOREIGN KEY (chip_id) REFERENCES public.chips(id)
);

-- ==========================================
-- TABELA: conversations
-- ==========================================
CREATE TABLE public.conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  chip_id uuid NOT NULL,
  remote_jid text NOT NULL,
  contact_name text,
  contact_phone text,
  is_group boolean DEFAULT false,
  last_message_at timestamp with time zone,
  last_message_text text,
  unread_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT conversations_pkey PRIMARY KEY (id),
  CONSTRAINT conversations_chip_id_fkey FOREIGN KEY (chip_id) REFERENCES public.chips(id)
);

-- ==========================================
-- TABELA: external_numbers
-- ==========================================
CREATE TABLE public.external_numbers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  phone_number text NOT NULL,
  name text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT external_numbers_pkey PRIMARY KEY (id)
);

-- ==========================================
-- TABELA: message_history
-- ==========================================
CREATE TABLE public.message_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  chip_id uuid NOT NULL,
  direction text NOT NULL,
  message_content text NOT NULL,
  recipient_phone text,
  remote_jid text,
  message_id text,
  sender_name text,
  status text NOT NULL DEFAULT 'pending'::text,
  media_type text,
  media_url text,
  media_mimetype text,
  media_filename text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT message_history_pkey PRIMARY KEY (id),
  CONSTRAINT message_history_chip_id_fkey FOREIGN KEY (chip_id) REFERENCES public.chips(id)
);

-- ==========================================
-- TABELA: message_queue
-- ==========================================
CREATE TABLE public.message_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  chip_id uuid NOT NULL,
  recipient_phone text NOT NULL,
  message_content text NOT NULL,
  scheduled_at timestamp with time zone NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  priority integer NOT NULL DEFAULT 5,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  error_message text,
  processed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT message_queue_pkey PRIMARY KEY (id),
  CONSTRAINT message_queue_chip_id_fkey FOREIGN KEY (chip_id) REFERENCES public.chips(id)
);

-- ==========================================
-- TABELA: system_settings
-- ==========================================
CREATE TABLE public.system_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  whatsapp_provider text NOT NULL DEFAULT 'evolution'::text,
  provider_api_url text,
  provider_api_key text,
  evolution_api_url text,
  evolution_api_key text,
  uazapi_api_url text,
  uazapi_api_key text,
  is_warming_active boolean NOT NULL DEFAULT true,
  warming_mode text NOT NULL DEFAULT 'same_user'::text,
  start_hour integer NOT NULL DEFAULT 8,
  end_hour integer NOT NULL DEFAULT 20,
  timezone text DEFAULT 'America/Sao_Paulo'::text,
  min_interval_seconds integer NOT NULL DEFAULT 60,
  max_interval_seconds integer NOT NULL DEFAULT 300,
  batch_size integer NOT NULL DEFAULT 5,
  batch_pause_seconds integer NOT NULL DEFAULT 30,
  max_messages_per_hour integer NOT NULL DEFAULT 30,
  random_delay_variation integer NOT NULL DEFAULT 20,
  typing_simulation boolean NOT NULL DEFAULT true,
  typing_speed_chars_sec integer NOT NULL DEFAULT 30,
  read_delay_seconds integer NOT NULL DEFAULT 3,
  online_offline_simulation boolean NOT NULL DEFAULT false,
  weekend_reduction_percent integer NOT NULL DEFAULT 30,
  night_mode_reduction integer NOT NULL DEFAULT 50,
  consecutive_message_limit integer NOT NULL DEFAULT 3,
  cooldown_after_error integer NOT NULL DEFAULT 300,
  human_pattern_mode boolean NOT NULL DEFAULT true,
  messages_day_1_3 integer NOT NULL DEFAULT 20,
  messages_day_4_7 integer NOT NULL DEFAULT 50,
  messages_day_8_plus integer NOT NULL DEFAULT 100,
  messages_day_novo integer NOT NULL DEFAULT 5,
  messages_day_aquecido integer NOT NULL DEFAULT 80,
  global_message_cursor integer DEFAULT 0,
  auto_phase_progression boolean NOT NULL DEFAULT true,
  days_phase_novo integer NOT NULL DEFAULT 3,
  days_phase_iniciante integer NOT NULL DEFAULT 5,
  days_phase_crescimento integer NOT NULL DEFAULT 7,
  days_phase_aquecido integer NOT NULL DEFAULT 10,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT system_settings_pkey PRIMARY KEY (id)
);

-- ==========================================
-- TABELA: warming_messages
-- ==========================================
CREATE TABLE public.warming_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  content text NOT NULL,
  message_order integer DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  source_file text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT warming_messages_pkey PRIMARY KEY (id)
);`,
  },
  {
    title: '3. Indexes',
    icon: <Zap className="w-4 h-4" />,
    description: 'Indexes adicionais para performance',
    sql: `-- Indexes da message_queue
CREATE INDEX idx_message_queue_status ON public.message_queue USING btree (status);
CREATE INDEX idx_message_queue_scheduled_at ON public.message_queue USING btree (scheduled_at);
CREATE INDEX idx_message_queue_chip_id ON public.message_queue USING btree (chip_id);`,
  },
  {
    title: '4. RLS (Row Level Security)',
    icon: <Shield className="w-4 h-4" />,
    description: 'Enable RLS + todas as policies de acesso por tabela',
    sql: `-- ==========================================
-- RLS: chip_lifecycle_logs
-- ==========================================
ALTER TABLE public.chip_lifecycle_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all lifecycle logs"
  ON public.chip_lifecycle_logs FOR SELECT
  USING (is_admin());

CREATE POLICY "Service can insert lifecycle logs"
  ON public.chip_lifecycle_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can view their chip lifecycle logs"
  ON public.chip_lifecycle_logs FOR SELECT
  USING (chip_id IN (SELECT id FROM chips WHERE user_id = auth.uid()));

-- ==========================================
-- RLS: chips
-- ==========================================
ALTER TABLE public.chips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all chips"
  ON public.chips FOR ALL
  USING (is_admin());

CREATE POLICY "Admins can view all chips"
  ON public.chips FOR SELECT
  USING (is_admin());

CREATE POLICY "Users can manage their own chips"
  ON public.chips FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Users can view their own chips"
  ON public.chips FOR SELECT
  USING (user_id = auth.uid());

-- ==========================================
-- RLS: conversations
-- ==========================================
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all conversations"
  ON public.conversations FOR ALL
  USING (is_admin());

CREATE POLICY "Admins can view all conversations"
  ON public.conversations FOR SELECT
  USING (is_admin());

CREATE POLICY "Users can manage their chip conversations"
  ON public.conversations FOR ALL
  USING (chip_id IN (SELECT id FROM chips WHERE user_id = auth.uid()));

CREATE POLICY "Users can view their chip conversations"
  ON public.conversations FOR SELECT
  USING (chip_id IN (SELECT id FROM chips WHERE user_id = auth.uid()));

-- ==========================================
-- RLS: external_numbers
-- ==========================================
ALTER TABLE public.external_numbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage external numbers"
  ON public.external_numbers FOR ALL
  USING (is_admin());

CREATE POLICY "Authenticated users can delete external numbers"
  ON public.external_numbers FOR DELETE
  USING (true);

CREATE POLICY "Authenticated users can insert external numbers"
  ON public.external_numbers FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read external numbers"
  ON public.external_numbers FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can update external numbers"
  ON public.external_numbers FOR UPDATE
  USING (true) WITH CHECK (true);

-- ==========================================
-- RLS: message_history
-- ==========================================
ALTER TABLE public.message_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all messages"
  ON public.message_history FOR SELECT
  USING (is_admin());

CREATE POLICY "System can insert messages"
  ON public.message_history FOR INSERT
  WITH CHECK ((chip_id IN (SELECT id FROM chips WHERE user_id = auth.uid())) OR is_admin());

CREATE POLICY "Users can view their own messages"
  ON public.message_history FOR SELECT
  USING (chip_id IN (SELECT id FROM chips WHERE user_id = auth.uid()));

-- ==========================================
-- RLS: message_queue
-- ==========================================
ALTER TABLE public.message_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all queue items"
  ON public.message_queue FOR ALL
  USING (is_admin());

CREATE POLICY "Admins can view all queue items"
  ON public.message_queue FOR SELECT
  USING (is_admin());

CREATE POLICY "Users can view their own queue items"
  ON public.message_queue FOR SELECT
  USING (chip_id IN (SELECT id FROM chips WHERE user_id = auth.uid()));

-- ==========================================
-- RLS: profiles
-- ==========================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all profiles"
  ON public.profiles FOR ALL
  USING (is_admin());

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (is_admin());

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (user_id = auth.uid());

-- ==========================================
-- RLS: system_settings
-- ==========================================
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage system settings"
  ON public.system_settings FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Authenticated users can read system settings"
  ON public.system_settings FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can update system settings"
  ON public.system_settings FOR UPDATE
  USING (true) WITH CHECK (true);

-- ==========================================
-- RLS: user_roles
-- ==========================================
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  USING (is_admin());

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (is_admin());

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (user_id = auth.uid());

-- ==========================================
-- RLS: warming_messages
-- ==========================================
ALTER TABLE public.warming_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage warming messages"
  ON public.warming_messages FOR ALL
  USING (is_admin());

CREATE POLICY "Authenticated users can delete warming messages"
  ON public.warming_messages FOR DELETE
  USING (true);

CREATE POLICY "Authenticated users can insert warming messages"
  ON public.warming_messages FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read warming messages"
  ON public.warming_messages FOR SELECT
  USING (true);`,
  },
  {
    title: '5. Database Functions',
    icon: <Settings2 className="w-4 h-4" />,
    description: '6 funções do sistema (auth, roles, triggers)',
    sql: `-- ==========================================
-- FUNCTION: handle_new_user
-- ==========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    INSERT INTO public.profiles (user_id, email)
    VALUES (NEW.id, NEW.email);
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'seller');
    
    RETURN NEW;
END;
$$;

-- ==========================================
-- FUNCTION: has_role
-- ==========================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- ==========================================
-- FUNCTION: is_admin
-- ==========================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

-- ==========================================
-- FUNCTION: promote_master_user
-- ==========================================
CREATE OR REPLACE FUNCTION public.promote_master_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    IF NEW.email = 'maicoln90@hotmail.com' THEN
        UPDATE public.user_roles 
        SET role = 'admin' 
        WHERE user_id = NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$;

-- ==========================================
-- FUNCTION: reset_daily_message_count
-- ==========================================
CREATE OR REPLACE FUNCTION public.reset_daily_message_count()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    UPDATE public.chips SET messages_sent_today = 0;
END;
$$;

-- ==========================================
-- FUNCTION: update_updated_at_column
-- ==========================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;`,
  },
  {
    title: '6. Triggers',
    icon: <Zap className="w-4 h-4" />,
    description: '5 triggers para timestamps e promoção automática',
    sql: `-- Trigger: auto-update updated_at em conversations
CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: auto-update updated_at em profiles
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: auto-update updated_at em chips
CREATE TRIGGER update_chips_updated_at
  BEFORE UPDATE ON public.chips
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: auto-update updated_at em system_settings
CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: promover master user automaticamente
CREATE TRIGGER trigger_promote_master_user
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.promote_master_user();

-- Trigger: criar perfil ao registrar (em auth.users)
-- NOTA: Este trigger é criado na schema auth
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();`,
  },
  {
    title: '7. Realtime',
    icon: <Zap className="w-4 h-4" />,
    description: 'Habilitar realtime para tabelas monitoradas',
    sql: `-- Habilitar realtime para tabelas que precisam de atualizações em tempo real
ALTER PUBLICATION supabase_realtime ADD TABLE public.chips;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_history;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_queue;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chip_lifecycle_logs;`,
  },
  {
    title: '8. Edge Functions',
    icon: <Code className="w-4 h-4" />,
    description: '9 edge functions — copie os arquivos do diretório supabase/functions/',
    sql: `-- As Edge Functions devem ser copiadas como arquivos para o novo projeto.
-- Copie o diretório supabase/functions/ inteiro para o novo projeto.
--
-- Edge Functions disponíveis:
-- 1. create-user        → Criar usuários pelo admin
-- 2. delete-user        → Deletar usuários
-- 3. evolution-api      → Proxy para Evolution API
-- 4. evolution-webhook  → Receber webhooks da Evolution API
-- 5. instance-maintenance → Manutenção de instâncias
-- 6. queue-processor    → Processar fila de mensagens
-- 7. uazapi-api         → Proxy para UazAPI
-- 8. update-user-role   → Atualizar role de usuários
-- 9. warming-engine     → Motor de aquecimento de chips
--
-- Configuração do config.toml (supabase/config.toml):
-- Cada function deve ter verify_jwt = false:
--
-- [functions.create-user]
-- verify_jwt = false
--
-- [functions.delete-user]
-- verify_jwt = false
--
-- [functions.evolution-api]
-- verify_jwt = false
--
-- [functions.evolution-webhook]
-- verify_jwt = false
--
-- [functions.instance-maintenance]
-- verify_jwt = false
--
-- [functions.queue-processor]
-- verify_jwt = false
--
-- [functions.uazapi-api]
-- verify_jwt = false
--
-- [functions.update-user-role]
-- verify_jwt = false
--
-- [functions.warming-engine]
-- verify_jwt = false`,
  },
  {
    title: '9. Dados Iniciais (Seed)',
    icon: <Database className="w-4 h-4" />,
    description: 'INSERT inicial para system_settings com valores padrão',
    sql: `-- Inserir configuração padrão do sistema
INSERT INTO public.system_settings (
  whatsapp_provider, is_warming_active, warming_mode,
  start_hour, end_hour, timezone,
  min_interval_seconds, max_interval_seconds,
  batch_size, batch_pause_seconds, max_messages_per_hour,
  random_delay_variation, typing_simulation, typing_speed_chars_sec,
  read_delay_seconds, online_offline_simulation,
  weekend_reduction_percent, night_mode_reduction,
  consecutive_message_limit, cooldown_after_error, human_pattern_mode,
  messages_day_1_3, messages_day_4_7, messages_day_8_plus,
  messages_day_novo, messages_day_aquecido, global_message_cursor,
  auto_phase_progression, days_phase_novo, days_phase_iniciante,
  days_phase_crescimento, days_phase_aquecido
) VALUES (
  'evolution', true, 'same_user',
  8, 20, 'America/Sao_Paulo',
  60, 300,
  5, 30, 30,
  20, true, 30,
  3, false,
  30, 50,
  3, 300, true,
  20, 50, 100,
  5, 80, 0,
  true, 3, 5, 7, 10
);`,
  },
];

const SECRETS_INFO = [
  { name: 'EVOLUTION_API_KEY', desc: 'Chave da Evolution API', manual: true },
  { name: 'EVOLUTION_API_URL', desc: 'URL da Evolution API', manual: true },
  { name: 'SUPABASE_URL', desc: 'URL do projeto (auto-gerada)', manual: false },
  { name: 'SUPABASE_ANON_KEY', desc: 'Chave anônima (auto-gerada)', manual: false },
  { name: 'SUPABASE_SERVICE_ROLE_KEY', desc: 'Chave de serviço (auto-gerada)', manual: false },
  { name: 'SUPABASE_DB_URL', desc: 'URL do banco de dados (auto-gerada)', manual: false },
  { name: 'SUPABASE_PUBLISHABLE_KEY', desc: 'Chave publicável (auto-gerada)', manual: false },
  { name: 'LOVABLE_API_KEY', desc: 'Chave Lovable AI Gateway (auto-gerada)', manual: false },
];

export default function MigrationSQLTab() {
  const { toast } = useToast();
  const [openSections, setOpenSections] = useState<Record<number, boolean>>({});

  const toggleSection = (idx: number) => {
    setOpenSections(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleCopyAll = () => {
    const allSQL = SQL_SECTIONS.map(s => `-- ${s.title}\n${s.sql}`).join('\n\n');
    navigator.clipboard.writeText(allSQL);
    toast({ title: 'SQL completo copiado!' });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="w-5 h-5" />
            SQL de Migração
          </CardTitle>
          <CardDescription>
            SQL completo para recriar todo o sistema em outro projeto. Copie cada bloco na ordem indicada.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleCopyAll} className="w-full mb-6">
            <Copy className="w-4 h-4 mr-2" />
            Copiar Todo o SQL
          </Button>

          <div className="space-y-3">
            {SQL_SECTIONS.map((section, idx) => (
              <Collapsible key={idx} open={openSections[idx]} onOpenChange={() => toggleSection(idx)}>
                <CollapsibleTrigger asChild>
                  <div className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
                    {section.icon}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{section.title}</p>
                      <p className="text-xs text-muted-foreground">{section.description}</p>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {openSections[idx] ? 'Fechar' : 'Abrir'}
                    </Badge>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <CopyableSQL sql={section.sql} />
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Secrets */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Secrets Necessárias
          </CardTitle>
          <CardDescription>
            Secrets que precisam ser configuradas no novo projeto
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {SECRETS_INFO.map(secret => (
              <div key={secret.name} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-mono text-sm font-medium">{secret.name}</p>
                  <p className="text-xs text-muted-foreground">{secret.desc}</p>
                </div>
                <Badge variant={secret.manual ? 'destructive' : 'secondary'} className="text-xs shrink-0">
                  {secret.manual ? 'Configurar manual' : 'Auto-gerada'}
                </Badge>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            ⚠️ Apenas <strong>EVOLUTION_API_KEY</strong> e <strong>EVOLUTION_API_URL</strong> precisam ser configuradas manualmente. As demais são geradas automaticamente pelo novo projeto.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
