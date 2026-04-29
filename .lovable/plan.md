## Diagnóstico

O erro atual não é mais o 401 de sessão. Agora o botão está chamando a V8, mas o cálculo manda combinações que a própria V8 recusa.

Pelos registros reais:

```text
Paulo
- margem: R$ 80,78
- limite V8: parcelas 6 a 36, valor R$ 500 a R$ 2.908,08
- botão enviou: 46x e R$ 1.904
- V8 recusou: parcela acima da margem

Gabriele
- margem: R$ 148,93
- limite V8: parcelas 6 a 36, valor R$ 500 a R$ 5.361,48
- botão enviou: 46x e R$ 3.511
- V8 recusou: parcela acima da margem

Danila
- limite V8: parcelas 6 a 36
- botão enviou: 46x
- V8 recusou: número de parcelas maior que 36
```

Causa raiz:
1. O botão filtrou prazos usando `sim_month_min`/`sim_month_max`, que são limites de tempo de admissão/meses, não o limite real de parcelas.
2. O botão ignorou `sim_installments_min`/`sim_installments_max`, que são os campos corretos para saber se pode 24x, 36x, 46x etc.
3. A estimativa usa taxa média menor do que a taxa real da V8 em algumas tabelas. Então mesmo com valor liberado “matematicamente” possível, a V8 calcula parcela maior e recusa.
4. O botão faz só uma tentativa. Se a V8 recusa por margem, ele não reduz o valor nem tenta o prazo correto.

## Implementação proposta

### 1. Corrigir a seleção de parcelas no botão

Arquivo: `src/components/v8/FindBestProposalButton.tsx`

Hoje ele seleciona campos assim:

```ts
.select('id, consult_id, config_id, margem_valor, sim_value_min, sim_value_max, sim_month_min, status')
```

Vou incluir os campos corretos:

```ts
sim_installments_min, sim_installments_max, sim_month_min, sim_month_max
```

E a regra passará a ser:

```text
parcelas disponíveis da tabela
→ filtrar por sim_installments_min/sim_installments_max
→ NÃO usar sim_month_min como se fosse parcela mínima
```

Exemplo prático:
- se a V8 disser `installmentsMax = 36`, o botão nunca enviará 46x.
- se a V8 disser `installmentsMin = 6`, o botão poderá testar 6x, 8x, 10x, 12x, 18x, 24x e 36x, conforme a tabela.

### 2. Trocar a busca de uma única proposta por uma lista de tentativas

Arquivo: `src/lib/v8FindBestProposal.ts`

Hoje a função devolve só uma melhor opção. Vou manter compatibilidade, mas adicionar uma função nova, por exemplo:

```ts
findBestProposalCandidates(...)
```

Ela vai gerar candidatos ordenados do mais vantajoso para o mais seguro:

```text
36x com valor estimado
36x com valor reduzido
24x com valor estimado
24x com valor reduzido
18x ...
...
```

Com isso, se a V8 recusar a primeira tentativa por margem, o sistema pode tentar automaticamente uma opção menor em vez de parar.

### 3. Usar modo de simulação por parcela quando fizer mais sentido

Pelo erro antigo da V8, ela exige um destes campos:

```text
disbursed_amount
ou
installment_face_value
```

Para resolver “parcela acima da margem”, o mais seguro é enviar:

```text
simulation_mode: 'installment_face_value'
simulation_value: margem disponível com margem de segurança
```

Exemplo:
- Paulo: margem R$ 80,78
- enviar parcela desejada perto de R$ 76,70, com segurança
- a V8 calcula o valor liberado real dentro da margem

Isso evita adivinhar o valor liberado usando taxa média.

Regra planejada:
- Para o botão “Encontrar proposta viável”, usar preferencialmente `installment_face_value`.
- O valor enviado será a margem disponível reduzida por segurança.
- Se a V8 ainda recusar, reduzir mais e tentar novamente.

### 4. Fazer tentativa progressiva com limite seguro

Arquivo: `src/components/v8/FindBestProposalButton.tsx`

O botão passará a tentar no máximo algumas combinações, por exemplo até 6 chamadas, para evitar spam/rate limit.

Fluxo:

```text
1. Monta candidatos válidos conforme limites oficiais da V8.
2. Tenta o melhor candidato.
3. Se sucesso: mostra “proposta encontrada”.
4. Se erro de parcela acima da margem: reduz parcela/valor e tenta próximo.
5. Se erro de parcela acima do máximo: remove esse prazo e tenta próximo.
6. Se nenhum candidato funcionar: mostra mensagem clara com o último motivo da V8.
```

### 5. Melhorar mensagens para o usuário

Hoje o toast mostra a recusa, mas não explica que o sistema vai tentar outra combinação.

Vou ajustar para mensagens mais úteis:

```text
Tentando V8: 36x com parcela segura de R$ 76,70...
V8 recusou esta combinação, tentando valor menor...
Proposta encontrada em 24x — verifique o card.
```

Se falhar tudo:

```text
Não foi possível encontrar proposta automática dentro dos limites da V8. Último motivo: [motivo real]. Tente manualmente com parcela menor.
```

### 6. Garantir que o Edge Function persista o erro real no card

Arquivo: `supabase/functions/v8-clt-api/index.ts`

No fluxo `simulate_only_for_consult`, hoje ele marca `simulate_status`, mas o erro exibido pode ficar pouco claro no histórico.

Vou confirmar e, se necessário, ajustar para salvar também:

```text
error_message
error_kind
last_step
raw_response
```

quando a tentativa falhar. Assim o card e os logs mostram o motivo real.

### 7. Testes de regressão

Arquivos:
- `src/lib/__tests__/v8FindBestProposal.test.ts`
- se necessário, `supabase/functions/v8-clt-api/payload_test.ts`

Vou adicionar testes cobrindo:

```text
- não escolher 46x quando sim_installments_max = 36
- Paulo com margem R$ 80,78 gera candidato válido usando parcela segura
- Gabriele com margem R$ 148,93 gera candidato válido usando parcela segura
- respeitar valor mínimo da V8
- manter o payload V8 com installment_face_value quando esse modo for usado
```

## Antes vs depois

Antes:
- O botão achava que podia usar 46x mesmo quando a V8 permitia no máximo 36x.
- Enviava valor liberado estimado (`disbursed_amount`) e a V8 recalculava uma parcela maior que a margem.
- Falhava no primeiro erro.

Depois:
- O botão respeitará `installmentsMin/installmentsMax` oficiais da V8.
- Usará parcela segura (`installment_face_value`) para caber na margem.
- Se uma combinação falhar, tentará automaticamente uma opção menor antes de desistir.

## Melhorias

- Maior chance de funcionar para todos os CPFs com margem confirmada.
- Menos tentativa manual do operador.
- Mensagens mais claras quando a V8 recusar.
- Evita enviar prazo inválido como 46x quando o limite do CPF é 36x.

## Vantagens e desvantagens

Vantagens:
- Corrige a causa real do erro.
- Usa os limites oficiais que a V8 já devolve no webhook.
- Reduz dependência de taxa estimada.
- Mantém segurança contra rate limit com limite de tentativas.

Desvantagens:
- Pode fazer mais de uma chamada à V8 em casos difíceis.
- A proposta encontrada pode liberar valor menor, porque vamos priorizar caber na margem.
- Ainda depende da V8 aceitar o consult_id antigo e a tabela usada na consulta.

## Checklist manual após implementação

1. Abrir `/admin/v8-simulador`.
2. Ir em “Operações”.
3. Abrir Paulo Cesar da Silva.
4. Clicar “Encontrar proposta viável”.
5. Confirmar que o toast tenta no máximo 36x, não 46x.
6. Confirmar que não aparece mais erro de “parcela acima da margem” logo na primeira tentativa sem retry.
7. Repetir com Gabriele.
8. Repetir com Danila e confirmar que 46x não é enviado quando o limite é 36x.
9. Verificar se o card atualiza com proposta ou mostra o último motivo real da V8.

## Pendências

Pendência imediata:
- Implementar a correção no botão, na biblioteca de cálculo e, se necessário, no Edge Function.

Pendência futura opcional:
- Criar um painel pequeno de diagnóstico mostrando “limite oficial V8: parcelas X–Y, valor R$ A–B, margem R$ C” ao lado do botão, para o operador entender por que determinada combinação foi escolhida.

## Prevenção de regressão

- Teste automatizado garantindo que o algoritmo nunca escolhe prazo acima de `sim_installments_max`.
- Teste para os casos reais Paulo/Gabriele.
- Mensagens de erro da V8 preservadas no audit log e no card, para facilitar diagnóstico se a V8 mudar regra de payload novamente.