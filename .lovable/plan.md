

# Painel de Exportacao e Migracao no Master Admin

## Visao Geral

Adicionar duas novas abas dentro da pagina Master Admin:
1. **Exportar Dados (CSV)** - Exportar todos os dados de cada tabela em CSV
2. **SQL de Migracao** - SQL completo para recriar o sistema em outro projeto, organizado por categorias

---

## Aba 1: Exportar Dados CSV

Um painel com botoes para exportar cada tabela individualmente como CSV. Tambem um botao "Exportar Tudo" que gera todos os CSVs de uma vez.

### Tabelas disponiveis para exportacao (10 tabelas):
- chip_lifecycle_logs
- chips
- conversations
- external_numbers
- message_history
- message_queue
- profiles
- system_settings
- user_roles
- warming_messages

### Funcionamento
- Cada botao faz uma query `supabase.from('tabela').select('*')` e gera um CSV no navegador
- Botao "Exportar Tudo" gera um zip ou faz download sequencial de cada tabela
- Para tabelas grandes (message_history, message_queue), paginar a busca usando `.range()` em blocos de 1000

---

## Aba 2: SQL de Migracao

Exibir blocos de SQL copiavel, organizados em categorias com botao "Copiar" para cada bloco. Todo o SQL sera gerado estaticamente no frontend baseado no schema atual do banco.

### Categorias de SQL:

**1. Tipos e Enums**
```sql
CREATE TYPE public.app_role AS ENUM ('seller', 'user', 'admin');
```

**2. Tabelas (10 tabelas)**
SQL completo de CREATE TABLE com todas as colunas, tipos, defaults, constraints e unique indexes para:
- chip_lifecycle_logs, chips, conversations, external_numbers, message_history, message_queue, profiles, system_settings, user_roles, warming_messages

**3. Indexes**
Todos os indexes adicionais (nao-PK, nao-unique-constraint):
- idx_message_queue_status
- idx_message_queue_scheduled_at
- idx_message_queue_chip_id

**4. RLS (Row Level Security)**
Enable RLS + todas as 30+ policies para cada tabela

**5. Database Functions (6 funcoes)**
- handle_new_user
- has_role
- is_admin
- promote_master_user
- reset_daily_message_count
- update_updated_at_column

**6. Triggers (5 triggers)**
- update_conversations_updated_at
- update_profiles_updated_at
- update_chips_updated_at
- update_system_settings_updated_at
- trigger_promote_master_user

**7. Realtime**
Habilitar realtime para as 5 tabelas configuradas:
- chips, message_history, message_queue, conversations, chip_lifecycle_logs

**8. Edge Functions**
Lista das 9 edge functions com instrucao para copiar os arquivos:
- create-user, delete-user, evolution-api, evolution-webhook, instance-maintenance, queue-processor, uazapi-api, update-user-role, warming-engine

E o config.toml com verify_jwt = false para cada uma

**9. Dados iniciais (seed)**
SQL de INSERT para system_settings com os valores default

---

## Aba 3 (dentro da aba SQL): Secrets Necessarias

Lista clara de todas as secrets que precisam ser configuradas no novo projeto:

| Secret | Descricao |
|---|---|
| EVOLUTION_API_KEY | Chave da Evolution API |
| EVOLUTION_API_URL | URL da Evolution API |
| SUPABASE_URL | URL do projeto Supabase (auto-gerada) |
| SUPABASE_ANON_KEY | Chave anonima do Supabase (auto-gerada) |
| SUPABASE_SERVICE_ROLE_KEY | Chave de servico do Supabase (auto-gerada) |
| SUPABASE_DB_URL | URL do banco de dados (auto-gerada) |
| SUPABASE_PUBLISHABLE_KEY | Chave publicavel (auto-gerada) |

Nota: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL e SUPABASE_PUBLISHABLE_KEY sao geradas automaticamente pelo novo projeto. Apenas EVOLUTION_API_KEY e EVOLUTION_API_URL precisam ser configuradas manualmente.

---

## Implementacao Tecnica

### Arquivo: `src/pages/admin/MasterAdmin.tsx`

Transformar a pagina em um layout com Tabs:
- Tab "Provedor" (conteudo atual - provedor, credenciais, webhook)
- Tab "Exportar Dados" (novo - exportacao CSV)
- Tab "SQL Migracao" (novo - blocos SQL copiaveis + secrets)

### Componentes auxiliares:
- Funcao utilitaria `downloadCSV(data, filename)` que converte array de objetos em CSV e dispara download
- Componente `CopyableSQL` que exibe um bloco de codigo com botao copiar
- Cada categoria de SQL sera um Accordion ou Card expansivel

### Logica de exportacao CSV:
```typescript
const exportTable = async (tableName: string) => {
  let allData = [];
  let from = 0;
  const batchSize = 1000;
  while (true) {
    const { data } = await supabase.from(tableName).select('*').range(from, from + batchSize - 1);
    if (!data || data.length === 0) break;
    allData.push(...data);
    if (data.length < batchSize) break;
    from += batchSize;
  }
  downloadCSV(allData, `${tableName}.csv`);
};
```

### SQL de migracao:
Todo o SQL sera hardcoded/pre-gerado baseado na auditoria completa do banco que fiz. Os blocos serao strings constantes no componente, organizados em cards por categoria.

### Arquivos a criar/editar:
| Arquivo | Acao |
|---|---|
| `src/pages/admin/MasterAdmin.tsx` | Refatorar com Tabs + adicionar abas de exportacao e SQL |

Nenhuma migracao de banco necessaria - tudo e frontend.

