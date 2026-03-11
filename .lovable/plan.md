

## Limpeza completa de Evolution API — Remover todo legado sem quebrar nada

### Inventario de restos de Evolution encontrados

| Arquivo | O que sobrou |
|---|---|
| `supabase/functions/evolution-api/index.ts` | Edge function inteira (legado) |
| `supabase/functions/evolution-webhook/index.ts` | Funcao `handleEvolutionEvent` (linhas 370-404) com logica de `messages.upsert` no formato Evolution |
| `supabase/functions/queue-processor/index.ts` | Usa `EVOLUTION_API_URL`/`EVOLUTION_API_KEY` do env e endpoint Evolution `/message/sendText/{instance}` com header `apikey` |
| `supabase/functions/warming-engine/index.ts` | Fallback `envEvolutionApiUrl`/`envEvolutionApiKey`, branch `else` (linhas 530-542) com endpoint Evolution, default provider `'evolution'` |
| `supabase/functions/instance-maintenance/index.ts` | Webhook URL hardcoded como `evolution-webhook` |
| `supabase/functions/uazapi-api/index.ts` | Webhook URL hardcoded como `evolution-webhook` (linha 212) |
| `src/pages/Chips.tsx` | Default provider `'evolution'`, fallback para `evolution-api` function |
| `src/pages/admin/MasterAdmin.tsx` | Interface de selecao Evolution/UazAPI, campos `evolution_api_url`/`evolution_api_key`, webhook URL apontando para `evolution-webhook`, fallback default `'evolution'` |
| `src/components/admin/MigrationSQLTab.tsx` | Mencoes a Evolution em SQL template e lista de secrets |
| `supabase/config.toml` | Entrada `[functions.evolution-api]` |

### Alteracoes planejadas

**1. Deletar `supabase/functions/evolution-api/`** — Edge function inteira, nao eh mais usada.

**2. `supabase/functions/evolution-webhook/index.ts`** — Remover funcao `handleEvolutionEvent` (linhas 370-404) e o `else` que a chama (linhas 88-92). O webhook continua existindo pois ja recebe eventos da UazAPI. Apenas renomear nao eh possivel sem reconfigurar todos os webhooks na UazAPI, entao mantemos o nome `evolution-webhook` mas removemos o codigo legado interno.

**3. `supabase/functions/queue-processor/index.ts`** — Reescrever para ler `provider_api_url`/`provider_api_key` do `system_settings` (como warming-engine ja faz), usar endpoint UazAPI `/send/text` com header `token` (instance_token do chip), remover variaveis `EVOLUTION_API_URL`/`EVOLUTION_API_KEY`.

**4. `supabase/functions/warming-engine/index.ts`** — Remover branch `else` (Evolution), remover fallback `envEvolutionApiUrl`/`envEvolutionApiKey`, mudar default de `'evolution'` para `'uazapi'`.

**5. `supabase/functions/instance-maintenance/index.ts`** — Nenhuma mudanca (ja usa `evolution-webhook` como URL do webhook, que eh correto pois o webhook continua com esse nome).

**6. `supabase/functions/uazapi-api/index.ts`** — Nenhuma mudanca (ja usa `evolution-webhook` como URL, que continua correto).

**7. `src/pages/Chips.tsx`** — Remover fallback para `evolution-api`, usar sempre `uazapi-api`. Remover default `'evolution'`.

**8. `src/pages/admin/MasterAdmin.tsx`** — Simplificar interface: remover seletor de provedor (sempre UazAPI), remover campos `evolution_api_url`/`evolution_api_key` da interface, usar diretamente `uazapi_api_url`/`uazapi_api_key`. Atualizar webhook URL label. Remover SelectItem de Evolution.

**9. `src/components/admin/MigrationSQLTab.tsx`** — Atualizar textos: trocar "Evolution API" por "UazAPI" nas descricoes de secrets e SQL template.

**10. `supabase/config.toml`** — Remover entrada `[functions.evolution-api]`.

**11. Deletar funcao deployada `evolution-api`** no Supabase.

### O que NAO muda

- O nome da edge function `evolution-webhook` permanece (renomear quebraria todos os webhooks ja configurados na UazAPI). Internamente o codigo ja eh 100% UazAPI.
- Colunas `evolution_api_url`/`evolution_api_key` no banco permanecem (nao podemos editar o types.ts, e remover colunas pode causar erros em queries existentes). Ficam como campos legados inativos.
- Secrets `EVOLUTION_API_KEY`/`EVOLUTION_API_URL` no Supabase permanecem (nao causam problemas, sao apenas variaveis de ambiente nao usadas).

### Resumo de impacto

- 1 edge function deletada (`evolution-api`)
- 4 edge functions atualizadas (webhook, queue-processor, warming-engine, + deploy)
- 3 arquivos frontend atualizados (Chips, MasterAdmin, MigrationSQLTab)
- 1 config atualizado (config.toml)
- Zero mudancas no banco de dados
- Zero risco de quebra — todas as funcionalidades ativas ja usam UazAPI

