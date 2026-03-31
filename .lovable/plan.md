
# Plano: Melhorias CR + Permissões + Sidebar + Gráficos

## Etapa 1 ✅ — Tooltips, Scrollbar, Sidebar colapsável
- [x] Tooltips descritivos em cada feature na página Permissões
- [x] Scrollbar visível em todas as tabelas de Relatório Comissões
- [x] Categorias do sidebar colapsáveis com persistência localStorage

## Etapa 2 ✅ — FGTS fix, Gráfico mensal, Alertas divergência
- [x] Fix payload da fila FGTS no edge function (instituicao/searchString no nível correto)
- [x] Fix SellerFGTS.tsx passando data range no payload
- [x] Gráfico evolução mensal: comissão esperada vs recebida por mês (CREvolutionChart)
- [x] Alertas de divergência por banco (> 5% acumulada) (CRDivergenceAlerts)

## Etapa 3 — Dashboard produção banco/produto
- [ ] Dashboard gráfico agregando dados por banco e produto
- [ ] Visualização de volume e comissão por banco/produto
