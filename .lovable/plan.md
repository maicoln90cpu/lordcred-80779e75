
## Confirmação dos seus dados (tudo correto)

Pelos prints que você mandou:

| Celular | Phone Number ID | WABA ID | No LordCred |
|---|---|---|---|
| +55 48 9615-9114 | 1019660597905406 | 970875535458386 | Correto |
| +55 48 9978-1709 | 1153714314481686 | 4368180816766123 | Correto |

Os cadastros no LordCred estao certos. Agora os 3 bugs:

---

## Bug 1: Erro ao sincronizar qualidade

**Causa**: A Meta API retorna erro `#100 Tried accessing nonexisting field (messaging_limit)` porque o campo `messaging_limit` nao existe mais na versao atual da Graph API (v21.0). Foi substituido por `throughput` ou simplesmente removido.

**Correcao**: Alterar a chamada de `sync-quality` no `whatsapp-gateway` para nao pedir `messaging_limit`. Pedir apenas `quality_rating,display_phone_number,throughput`. Se a Meta retornar erro para um chip, continuar com os outros (hoje ja faz isso, mas o erro assusta).

---

## Bug 2: Templates importados mas nao aparecem na tela

**Causa**: A tabela `meta_message_templates` tem RLS ativado com apenas 1 policy: `"Privileged users can manage meta templates"` (ALL). A edge function grava com `service_role_key` (bypassa RLS), entao os 7 templates **foram gravados com sucesso**. Porem, ao verificar no banco, a tabela esta **vazia** -- o que indica que o `upsert` falhou silenciosamente ou a policy bloqueou.

Verificacao real: a query retornou 0 rows. Provavelmente o upsert retornou erro que foi ignorado (o codigo nao checa `error` do upsert). Vou adicionar tratamento de erro E verificar se o `adminClient` (service role) esta sendo usado corretamente.

**Correcao**:
1. Adicionar checagem de erro no upsert de templates
2. Adicionar policy de SELECT para usuarios autenticados (leitura)
3. Re-sincronizar para popular a tabela

---

## Bug 3: Danielle nao ve o chip na tela WhatsApp

**Causa**: Voce atribuiu Danielle (62af138a...) ao chip 9615-9114, e ele esta com `is_shared=true` e `shared_user_ids` contendo o ID dela. Porem o chip 9978-1709 esta com `is_shared=false` e `shared_user_ids=[]`.

Mas o problema maior: o `ChipSelector` busca chips **pessoais** (`user_id = user.id`) e **compartilhados** (`is_shared=true AND shared_user_ids contains user.id`). Como o dono dos chips e outro usuario (Silas), Danielle so veria o chip 9615-9114 (que esta shared). Mas pelo print dela a tela mostra "Nenhum chip conectado".

Possiveis causas:
- O `SharedChipManager` (tela de acesso) nao esta salvando o `shared_user_ids` corretamente
- Ou a RLS do `chips` nao permite Danielle ler o chip

**Correcao**: Verificar e corrigir o fluxo de salvamento de acesso no `SharedChipManager` e garantir que a RLS de `chips` permita leitura por usuarios em `shared_user_ids`.

---

## Resumo das alteracoes

1. **whatsapp-gateway/index.ts** -- Remover `messaging_limit` da chamada sync-quality, adicionar checagem de erro nos upserts de templates
2. **Migration SQL** -- Adicionar policy de SELECT na `meta_message_templates` para authenticated
3. **SharedChipManager ou ChipSelector** -- Garantir que o fluxo de atribuicao de vendedor funcione end-to-end
4. **Re-deploy** da edge function apos correcao

Tempo estimado: ~15 minutos de implementacao.
