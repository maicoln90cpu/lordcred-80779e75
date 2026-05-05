# Testes SQL de regressão

Esta pasta contém scripts SQL idempotentes que validam funções e políticas críticas
do banco. Cada script começa com `BEGIN;` e termina com `ROLLBACK;` — **nada é
persistido**, mesmo se o teste passar.

## Como executar

### Opção A — psql direto (terminal local com `PG*` env vars configuradas)

```bash
psql -f supabase/tests/has_feature_access_test.sql
```

Saída esperada em sucesso:
```
NOTICE:  ✅ ALL has_feature_access TESTS PASSED (7 grupos, 14 asserts)
ROLLBACK
```

Em falha, a função levanta `EXCEPTION` com a regra violada (ex.:
`FAIL G3.1: support deveria passar com allowed_roles=[support]`).

### Opção B — SQL Editor do Supabase

1. Abra https://supabase.com/dashboard/project/sibfqmzsnftscnlyuwiu/sql/new
2. Cole o conteúdo do arquivo `.sql` que quer testar.
3. Rode. O bloco DO emitirá `NOTICE` em verde se passar, `ERROR` em vermelho se falhar.
4. O `ROLLBACK` final garante que nada foi escrito.

## Testes disponíveis

| Arquivo | Cobre | Asserts |
|---|---|---|
| `has_feature_access_test.sql` | Função `public.has_feature_access(uid, key)` — privileged bypass, allowed_roles, allowed_user_ids, master toggle OFF, feature inexistente, usuário sem role | 14 (7 grupos) |

## Quando rodar

- ✅ Após qualquer migration que altere `feature_permissions`, `master_feature_toggles`, `user_roles` ou a função `has_feature_access`.
- ✅ Como parte do checklist de release.
- ✅ Sempre que houver bug reportado de "usuário não vê dados que deveria ver" ou "vendedor viu algo que não devia".
