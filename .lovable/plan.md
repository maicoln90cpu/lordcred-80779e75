# Plano de Implementação — LordCred

## Estado Atual: Master Control v1 — Etapa 1 concluída ✅

## Broadcasts v3 — Melhorias Avançadas ✅

### Etapa 1 — Fix Mídia + Preview + Export CSV ✅
### Etapa 2 — Limite Diário + Overflow de Chips ✅
### Etapa 3 — Webhook de Status + Métricas de Resposta ✅
### Etapa 4 — Export PDF + Fix Notifications ✅

## Master Control — Controle Total do Sistema

### Etapa 1 — Interruptor Global de Módulos ✅
- [x] Tabela `master_feature_toggles` com seed de 34 módulos
- [x] RLS: qualquer autenticado lê, somente master gerencia
- [x] Hook `useFeaturePermissions` integrado com toggles (realtime)
- [x] Nova aba "Módulos" no MasterAdmin com switches por categoria
- [x] Toggle por grupo (ativar/desativar categoria inteira)
- [x] Master sempre vê tudo independente dos toggles

### Etapa 2 — Ocultação Total do Email Master (pendente)
- [ ] RPC `get_visible_profiles()` que filtra master automaticamente
- [ ] Refatorar ~14 arquivos para usar RPC em vez de query direta
- [ ] Garantir que master nunca apareça em dropdowns/listagens
