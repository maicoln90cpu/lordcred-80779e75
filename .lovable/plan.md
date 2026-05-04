Pelo diagnóstico direto no banco, a V2 está quase toda zerada por problemas de mapeamento das taxas, não por ausência de vendas.

Resumo do que encontrei:
- Existem 464 vendas na `commission_sales_v2`.
- 458 estão com comissão/taxa zerada.
- Apenas 6 vendas tiveram match de taxa.
- O relatório V1 x V2 foi feito comparando pelo `id`, mas hoje V1 e V2 não compartilham os mesmos IDs; por isso ele não mede paridade real.
- A V2 tem taxa cadastrada com nomes diferentes dos nomes das vendas. Exemplos:
  - Venda: `Lotus Mais`; taxa: `LOTUS`.
  - Venda: `Hub Credito`; taxa: `HUB`.
  - Venda: `V8 Bank`; muitas taxas novas estão em `V8`, e parte em `V8 Bank`.
- FGTS foi migrado para lógica mais específica, mas os prazos nas vendas parecem vir como anos em alguns casos (`1`, `2`, `3`, `4`, `5`) enquanto as taxas FGTS estão em meses (`12`, `24`, `36`, `48`, `60`). Isso impede o match.
- CLT não tem fallback V1 completo na V2: quando não existe `table_key`/prazo/valor compatível, ele zera em vez de usar um fallback seguro por banco + seguro + data.
- Alguns bancos e nomes de tabelas CLT não batem semanticamente, por exemplo `Trabalhador - Seg. 2 parcelas` vira `2 Parcela`, mas as taxas incluem variações como `2 parcelas`, `4 Parcela`, etc.

Plano de correção em 3 passos seguros:

1. Corrigir o trigger V2 para não zerar por variação de nome
- Criar uma migration ajustando `calculate_commission_v2()`.
- Normalizar nomes de bancos dentro do trigger:
  - `Lotus Mais` = `LOTUS`
  - `Hub Credito` = `HUB`
  - `V8 Bank` = tentar `V8 Bank` e também `V8`
  - manter `UPPER()` para evitar diferença de maiúscula/minúscula.
- Para FGTS, tratar prazo 1 a 5 como anos e converter para meses apenas no cálculo de match (`term * 12`) quando o produto for FGTS.
- Manter `rate_match_level` com os níveis:
  - `specific`
  - `generic`
  - `fallback`
  - `none`
- Adicionar fallback também no CLT: se não achar taxa específica/genérica por prazo/tabela, tentar banco + seguro + data, igual a intenção da V1, para homologação não ficar tudo zerado.

2. Recalcular a base V2 e melhorar diagnóstico visual
- Ajustar a função `recalculate_commissions_v2()` para retornar contagens úteis:
  - total reprocessado
  - quantos ficaram `specific`
  - quantos ficaram `generic`
  - quantos ficaram `fallback`
  - quantos ainda ficaram `none`
- Atualizar o botão “Recalcular Vendas V2” para mostrar esses números no toast.
- No Extrato/Base V2, manter o indicador visual de fallback e destacar os casos `none` para ficar claro quais vendas ainda estão sem taxa correspondente.

3. Corrigir relatório V1 x V2 para comparação real
- Alterar o relatório V1 x V2 para não comparar por `id`, pois os IDs não coincidem.
- Comparar por chave operacional:
  - data da venda
  - vendedor
  - produto
  - banco
  - valor liberado
  - CPF ou ID proposta quando existir
- Exibir uma coluna de status:
  - “pareado” quando encontrar venda correspondente
  - “sem par V2” quando a venda da V1 não existir na V2
  - “duplicidade” quando houver mais de um candidato.
- Assim o relatório deixa de acusar divergência falsa e passa a mostrar diferença real de cálculo.

Validação após implementar:
1. Rodar o recalcular V2.
2. Conferir se o total zerado cai drasticamente.
3. Conferir amostras dos prints:
   - `Lotus Mais` FGTS deve deixar de ficar zerado.
   - `Hub Credito` FGTS deve deixar de ficar zerado.
   - `V8 Bank` CLT deve usar taxa de `V8 Bank` ou fallback em `V8` quando aplicável.
   - `Banco C6` com seguro deve tentar match por tabela/prazo e, se não bater, fallback visível.
4. Abrir V1 x V2 e conferir por pareamento operacional, não por ID.
5. Confirmar que as vendas que ainda ficarem `none` representam taxa realmente não cadastrada ou regra ainda desconhecida.

Vantagens:
- Corrige a causa mais provável dos zeros sem apagar dados.
- Mantém a V2 como sandbox/homologação, sem tocar na V1 produção.
- Mostra claramente quando o sistema usou regra exata, genérica, fallback ou nenhuma.
- O relatório V1 x V2 passa a comparar as vendas corretas.

Desvantagens/cuidados:
- O fallback pode gerar comissão onde a regra específica ainda não foi cadastrada; por isso ele continuará marcado visualmente como `fallback`.
- Algumas taxas ainda podem ficar zeradas se realmente não existir regra compatível no cadastro.
- A normalização de bancos precisa ser documentada para futuras importações.

Prevenção de regressão:
- Atualizar os testes Vitest do espelho `commissionTriggerLogic.ts` com casos reais encontrados:
  - `Lotus Mais` versus `LOTUS`
  - `Hub Credito` versus `HUB`
  - FGTS prazo `5` virando `60` meses
  - `V8 Bank` usando fallback/alias `V8`
  - relatório pareando por chave operacional e não por ID.

Se aprovado, implemento esse plano agora na próxima etapa.