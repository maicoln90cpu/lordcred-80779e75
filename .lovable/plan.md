Plano seguro para corrigir a falha do retry automático no V8

Diagnóstico confirmado

1. O auto-retry está rodando, mas está reenviando parte das linhas sem `config_id` e sem `parcelas`.
   - No banco, os lotes têm `v8_batches.config_id` e `v8_batches.installments` preenchidos.
   - Porém várias linhas em `v8_simulations` estão com `config_id = null` e `installments = null`.
   - O cron atual usa apenas os campos da própria simulação. Quando chama `v8-clt-api/simulate_one`, a função responde `config_id é obrigatório`.
   - Resultado visível: a tentativa sobe para 2, 3, 4 etc., mas a linha continua falhando sem realmente consultar/simular corretamente na V8.

2. A barra global conta apenas `temporary_v8` e `analysis_pending`.
   - Depois que a linha vira `config_id é obrigatório`, `error_kind` fica `null`, então ela desaparece do contador de auto-retry.
   - Por isso parece que o retry automático parou.

3. O webhook da V8 atualiza status da simulação, mas não recalcula os contadores do lote.
   - Isso pode deixar Histórico/Nova Simulação/Consultas com números inconsistentes até outra ação atualizar.

4. Existe também um aviso React no console:
   - `Function components cannot be given refs` vindo de `ViewV8StatusButton` dentro de Tooltip.
   - Não é a causa principal do retry, mas é regressão visual/técnica que deve ser corrigida.

O que vou implementar

Etapa única e segura

1. Corrigir `v8-retry-cron`
   - Buscar também os dados do lote junto com a simulação.
   - Ao reenviar para `v8-clt-api`, usar fallback:
     - `config_id = simulation.config_id || batch.config_id`
     - `parcelas = simulation.installments || batch.installments`
   - Se mesmo assim faltar configuração, não gastar tentativa inútil; registrar log e pular a linha.
   - Corrigir o retorno para mostrar claramente `retried_ok`, `retried_fail` e `skipped_missing_config`.

2. Corrigir `create_batch` no `v8-clt-api`
   - Ao criar cada linha em `v8_simulations`, já salvar:
     - `config_id`
     - `config_name`
     - `installments`
     - `error_kind = 'analysis_pending'`
   - Isso evita que novos lotes voltem a nascer sem os dados necessários para retry.

3. Classificar corretamente erro local de validação
   - Quando `simulate_one` falhar antes de chamar a V8 por falta de `config_id`, `parcelas`, nome ou nascimento, salvar como `invalid_data` em vez de `null`.
   - Assim o auto-retry não fica insistindo em erro que só configuração/dados corrigem.

4. Criar proteção no banco para recalcular contadores do lote
   - Adicionar função segura para recalcular `pending_count`, `success_count`, `failure_count` a partir da tabela `v8_simulations`.
   - Usar essa função após retries e após atualizações relevantes, evitando contador travado.
   - Isso corrige inconsistência em Histórico e Nova Simulação sem depender só de incremento manual.

5. Melhorar realtime/fallback nas telas
   - Em `useV8BatchSimulations`, manter subscription e adicionar polling fallback leve de 10s enquanto o lote estiver ativo.
   - Em `V8ConsultasTab`, também colocar fallback de 10s depois de uma busca manual, para a aba Consultas atualizar mesmo se o WebSocket cair.
   - Ajustar a barra global para contar também linhas que estão presas com erro local conhecido, separando:
     - auto-retry realmente ativo
     - bloqueadas por configuração/dados

6. Corrigir aviso do Tooltip com `ViewV8StatusButton`
   - Transformar o botão em `forwardRef` ou remover o uso problemático dentro de `TooltipTrigger asChild`.
   - Isso limpa o console e evita comportamento estranho no botão.

7. Documentar e testar
   - Atualizar a documentação V8 com a regra: retries usam fallback do lote quando a linha não tem config.
   - Rodar testes/build aplicáveis.
   - Verificar logs da Edge Function `v8-retry-cron` depois da correção.

Resultado esperado

- O retry automático passa a reenviar usando a tabela e parcelas corretas do lote.
- Linhas novas não nascem mais sem `config_id`/`installments`.
- Linhas antigas com `config_id = null` ainda conseguem retry porque o cron recupera do lote.
- Histórico, Nova Simulação e Consultas atualizam melhor em tempo real e com fallback de 10s.
- O botão/contador deixa de dar falsa impressão de que o retry rodou quando só aumentou tentativa com erro local.

Validação manual após implementação

1. Abrir `/admin/v8-simulador`.
2. Criar um lote pequeno de teste.
3. Confirmar que as linhas têm tentativas subindo apenas quando a função realmente consegue reenviar com `config_id`.
4. Em Histórico, abrir o lote e verificar se o motivo muda sem trocar de aba.
5. Em Consultas, buscar período e confirmar atualização automática/pulso em tempo real ou fallback.
6. Conferir a barra global: deve mostrar retry ativo apenas quando houver itens realmente retentáveis.
7. Verificar console: o aviso de `Function components cannot be given refs` não deve mais aparecer.

Pendências depois desta correção

- Se houver linhas antigas já marcadas como `failed` com erro `config_id é obrigatório`, elas devem voltar a ser processáveis pelo cron porque o fallback usará o `config_id` do lote. Se ainda ficarem bloqueadas, será necessário um pequeno reparo de dados para reclassificar essas linhas antigas como `analysis_pending` ou acionar uma retentativa manual controlada.
- Não vou alterar `src/integrations/supabase/types.ts`, respeitando a regra do projeto.