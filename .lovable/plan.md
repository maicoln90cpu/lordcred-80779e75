# Plano de Implementação — LordCred

## Estado Atual: Broadcasts v3 em andamento

## Broadcasts v3 — Melhorias Avançadas

### Etapa 1 — Fix Mídia + Preview + Export CSV ✅
- [x] Correção endpoint mídia: `/send/image` e `/send/document` → `/send/media` (UazAPI v2)
- [x] Preview WhatsApp: simulação de balão com variáveis fictícias e mídia
- [x] Export CSV: botão para baixar relatório de todas as campanhas

### Etapa 2 — Limite Diário + Overflow de Chips (Pendente)
- [ ] Coluna `broadcast_daily_limit` em chips
- [ ] Coluna `overflow_chip_ids` em broadcast_campaigns
- [ ] Lógica de transbordo no broadcast-sender
- [ ] UI para configurar limite e chips de overflow

### Etapa 3 — Webhook de Status + Métricas de Resposta (Pendente)
- [ ] Colunas `delivery_status`, `message_id`, `replied`, `replied_at` em broadcast_recipients
- [ ] Salvar message_id no broadcast-sender
- [ ] Cross-reference no evolution-webhook
- [ ] KPIs de entregue/lido/respondido no relatório

### Etapa 4 — Export PDF (Pendente)
- [ ] Geração de PDF client-side com jspdf + html2canvas
- [ ] Relatório visual com KPIs e gráficos
