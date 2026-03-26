
# Plano: Fases 7-8 + Correções de Egress

## Etapa 1: Correções de Egress ✅ CONCLUÍDA

### Alterações realizadas:
1. **ChatSidebar polling**: 10s → 30s (reduz ~66% das queries de polling)
2. **ChatSidebar select**: `select('*')` → campos específicos (reduz ~30% payload por query)
3. **useRealtimeMessages**: filtro `chip_id` no canal realtime (cada usuário só recebe mensagens dos seus chips)

---

## Etapa 2: FASE 7 — Formulário createProposta (PENDENTE)

### Objetivo
Botão "Criar Proposta" no detalhe do lead que abre formulário pré-preenchido.

### Arquivos
- `src/components/whatsapp/CreatePropostaDialog.tsx` (novo)
- `src/components/whatsapp/LeadsPanel.tsx` (botão)

---

## Etapa 3: FASE 8 — Monitoramento de Status (PENDENTE)

### Objetivo
Edge function agendada para sincronizar status de propostas.

### Arquivos
- Migration: coluna `corban_proposta_id` em `client_leads`
- `supabase/functions/corban-status-sync/index.ts` (novo)
- pg_cron job via SQL insert
