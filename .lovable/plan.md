# Plano de Implementação — LordCred

## Estado Atual: Master Control v1 — Completo ✅

## Broadcasts v3 — Melhorias Avançadas ✅

### Etapa 1 — Fix Mídia + Preview + Export CSV ✅
### Etapa 2 — Limite Diário + Overflow de Chips ✅
### Etapa 3 — Webhook de Status + Métricas de Resposta ✅
### Etapa 4 — Export PDF + Fix Notifications ✅

## Master Control — Controle Total do Sistema ✅

### Etapa 1 — Interruptor Global de Módulos ✅
- [x] Tabela `master_feature_toggles` com seed de 34 módulos
- [x] RLS: qualquer autenticado lê, somente master gerencia
- [x] Hook `useFeaturePermissions` integrado com toggles (realtime)
- [x] Nova aba "Módulos" no MasterAdmin com switches por categoria
- [x] Toggle por grupo (ativar/desativar categoria inteira)
- [x] Master sempre vê tudo independente dos toggles

### Etapa 2 — Ocultação Total do Email Master ✅
- [x] RPC `get_visible_profiles()` (SECURITY DEFINER) criada
- [x] 20 arquivos refatorados para usar RPC centralizada
- [x] Master nunca aparece em dropdowns/listagens para não-master
- [x] Código simplificado: removidas chamadas duplicadas a `get_master_user_ids`
