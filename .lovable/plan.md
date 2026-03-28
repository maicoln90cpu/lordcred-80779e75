
Plano de correção — Respostas Rápidas ainda não funcionando

1) Diagnóstico confirmado
- Do I know what the issue is? **Sim**.
- O problema principal é de **falso sucesso**:
  - `QuickRepliesManager` e `ChatInput` usam `supabase.functions.invoke(...)` sem validar `res.error` / `res.data.success`.
  - então o toast “criada” pode aparecer mesmo quando a operação falhou.
- Há também falha de sincronização de cache:
  - o manager tenta limpar `window.__quickReplyCache`, mas o cache real está em `ChatInput.tsx` como variável de módulo (`quickReplyCache`), então não limpa nada.
- Na edge `uazapi-api`, o case `edit-quick-reply` retorna `success: true` sem checar `response.ok`, mascarando erro da UazAPI.

2) O que será alterado agora
- `supabase/functions/uazapi-api/index.ts`
  - Em `edit-quick-reply` e `list-quick-replies`, validar `response.ok`.
  - Se a UazAPI falhar, retornar erro real (status/mensagem), não `success: true`.
  - Melhorar log para rastrear criação/edição/exclusão de quick reply.
- `src/components/whatsapp/QuickRepliesManager.tsx`
  - Validar retorno de `invoke` corretamente (`error`, `data.error`, `data.success`).
  - Só mostrar toast de sucesso quando a API confirmar sucesso.
  - Em falha, mostrar toast com motivo real.
  - Após sucesso, disparar evento global de atualização (`quick-replies-updated`) por `chipId`.
- `src/components/whatsapp/ChatInput.tsx`
  - Escutar evento `quick-replies-updated`.
  - Limpar `quickReplyCache[chipId]` corretamente e recarregar quick replies.
  - Ajustar fetch de quick replies para tratar erro real (não silencioso).

3) Melhorias diretas entregues por essa correção
- Criação/edição/exclusão de resposta rápida deixa de ter “sucesso falso”.
- Lista do modal e autocomplete com `/` passam a refletir dados reais sem precisar recarregar a página.
- Erros de API ficam visíveis para o vendedor/admin (mensagem útil no toast).

4) Vantagens / desvantagens
- Vantagens:
  - elimina inconsistência entre toast e estado real;
  - reduz retrabalho operacional (“criei e sumiu”);
  - melhora suporte/debug com logs corretos.
- Desvantagens:
  - haverá mais toasts de erro reais (antes eram mascarados como sucesso);
  - pequeno aumento de chamadas de refresh após criar/editar/deletar.

5) Checklist manual (validação fim a fim)
- [ ] Logar como vendedor.
- [ ] Abrir WhatsApp > Respostas Rápidas.
- [ ] Criar `/aaa` com texto teste.
- [ ] Confirmar que aparece imediatamente na lista.
- [ ] No input do chat, digitar `/a` e validar sugestão `/aaa`.
- [ ] Selecionar `/aaa` e validar preenchimento da mensagem.
- [ ] Editar `/aaa` e validar atualização imediata na lista e no autocomplete.
- [ ] Excluir `/aaa` e validar remoção imediata da lista e do autocomplete.
- [ ] Repetir com outro chip para confirmar isolamento por instância.
- [ ] Testar erro proposital (atalho inválido/duplicado) e validar toast de erro real.

6) Pendências
- Para agora: nenhuma pendência crítica além desta correção.
- Futuro (opcional):
  - unificar quick replies com template shortcuts (`trigger_word`) em uma única fonte de dados para reduzir duplicidade de comportamento.
