# Histórico: Limpeza Completa de Evolution API

> Este documento registra a migração concluída de Evolution API para UazAPI exclusiva.

## Contexto

O projeto originalmente suportava dois provedores WhatsApp (Evolution API e UazAPI). A decisão foi consolidar em UazAPI exclusivamente.

## Restos de Evolution Removidos

| Arquivo | O que existia |
|---|---|
| `supabase/functions/evolution-api/` | Edge function inteira (deletada) |
| `supabase/functions/evolution-webhook/index.ts` | Função `handleEvolutionEvent` removida |
| `supabase/functions/queue-processor/index.ts` | Variáveis `EVOLUTION_API_URL`/`EVOLUTION_API_KEY` e endpoint Evolution removidos |
| `supabase/functions/warming-engine/index.ts` | Branch `else` Evolution e fallback removidos |
| `src/pages/Chips.tsx` | Fallback para `evolution-api` e default `'evolution'` removidos |
| `src/pages/admin/MasterAdmin.tsx` | Seletor de provedor e campos Evolution removidos |
| `src/components/admin/MigrationSQLTab.tsx` | Menções a Evolution atualizadas para UazAPI |

## O que NÃO Mudou

- Nome da edge function `evolution-webhook` permanece (renomear quebraria webhooks configurados)
- Colunas `evolution_api_url`/`evolution_api_key` no banco permanecem (campos legados inativos)
- Secrets `EVOLUTION_API_KEY`/`EVOLUTION_API_URL` no Supabase permanecem (não causam problemas)

## Impacto

- 1 edge function deletada (`evolution-api`)
- 4 edge functions atualizadas
- 3 arquivos frontend atualizados
- 1 config atualizado (`config.toml`)
- Zero mudanças no banco de dados
- Zero quebras

## Ver Também

- [UAZAPI.md](./UAZAPI.md) — Referência de endpoints
- [uazapidoc.md](./uazapidoc.md) — Documentação OpenAPI completa
- [SYSTEM-DESIGN.md](./SYSTEM-DESIGN.md) — Arquitetura do sistema
