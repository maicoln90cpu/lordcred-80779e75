# Plano de Implementação — LordCred

## Estado Atual: Broadcasts v3 concluído ✅

## Broadcasts v3 — Melhorias Avançadas

### Etapa 1 — Fix Mídia + Preview + Export CSV ✅
- [x] Correção endpoint mídia: `/send/image` e `/send/document` → `/send/media` (UazAPI v2)
- [x] Preview WhatsApp: simulação de balão com variáveis fictícias e mídia
- [x] Export CSV: botão para baixar relatório de todas as campanhas
- [x] Formatação WhatsApp no preview: *negrito*, _itálico_, ~riscado~, ```monospace```

### Etapa 2 — Limite Diário + Overflow de Chips ✅
- [x] Coluna `broadcast_daily_limit` em chips (padrão 200)
- [x] Coluna `overflow_chip_ids` em broadcast_campaigns
- [x] Lógica de transbordo no broadcast-sender (verifica limite, troca chip automaticamente)
- [x] Incremento de messages_sent_today por chip usado
- [x] UI para selecionar chips de overflow no diálogo de criação

### Etapa 3 — Webhook de Status + Métricas de Resposta ✅
- [x] Colunas `delivery_status`, `message_id`, `replied`, `replied_at` em broadcast_recipients
- [x] Salvar message_id no broadcast-sender (extraído da resposta UazAPI)
- [x] Cross-reference no evolution-webhook (delivery status + reply detection)
- [x] KPIs de entregue/lido/respondido no relatório (3 cards + funil atualizado)

### Etapa 4 — Export PDF ✅
- [x] Geração de PDF client-side com jspdf + html2canvas
- [x] Relatório visual com header, KPIs e gráficos
- [x] Fix: trigger corban notifications recriado (track_snapshot_status_change)
