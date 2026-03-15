

## Respostas e Plano

### Pergunta 1 — Por que existe "Fila de Mensagens" sem envio em massa?

A fila foi implementada como infraestrutura preparatória. O `warming-engine` já usa a tabela `message_queue` para agendar mensagens de aquecimento dos chips — cada mensagem enviada pelo motor de aquecimento entra na fila com prioridade e controle de tentativas. A página `/admin/queue` serve para monitorar essas mensagens de aquecimento e, futuramente, disparos em massa. Mas hoje ela já tem utilidade real: mostra o status das mensagens de aquecimento sendo processadas. Não é um recurso "morto".

### Pergunta 3 — Diferença entre Respostas Rápidas e Templates

- **Respostas Rápidas**: São atalhos individuais do operador, acessados digitando `/` no chat. Cada chip tem os seus próprios atalhos sincronizados com a UazAPI. São para uso rápido durante uma conversa 1-a-1.
- **Templates**: São modelos globais gerenciados por Admin/Suporte, organizados por categoria (saudação, vendas, cobrança). Ficam disponíveis para toda a equipe como referência — o usuário copia o texto e usa onde quiser. São um "banco de mensagens padrão" da empresa.

Em resumo: Respostas Rápidas = atalhos pessoais no chat. Templates = biblioteca de mensagens padrão da empresa.

---

### Pergunta 2 — Mover "Mensagens" para dentro de "Meus Chips" como aba

**Mudanças:**

1. **`src/components/layout/DashboardLayout.tsx`**: Remover "Mensagens" completamente do sidebar (remover o `children` de "Meus Chips").

2. **`src/pages/Chips.tsx`**: Adicionar sistema de Tabs com 3 abas:
   - **Meus Chips** (conteúdo atual da página)
   - **Fila** (conteúdo que hoje está em `/admin/queue` — ou link para ele)
   - **Mensagens** (embed do conteúdo de `Messages.tsx`)

   Na prática, vou extrair o conteúdo principal de `Chips.tsx` e de `Messages.tsx` em componentes internos e renderizá-los dentro de `<Tabs>` na página Chips.

3. **`src/App.tsx`**: Manter a rota `/messages` funcionando (para links diretos) mas ela pode redirecionar para `/chips?tab=mensagens`, ou manter independente.

**Abordagem**: Para manter o código limpo, vou:
- Extrair o grid de chips em um componente `ChipsGrid` dentro do próprio arquivo
- Importar o conteúdo de `Messages.tsx` como componente (extraindo a parte interna sem o `DashboardLayout` wrapper)
- Usar `Tabs` do shadcn com valor controlado

**Arquivos a modificar:**
- `src/components/layout/DashboardLayout.tsx` — remover Mensagens do sidebar
- `src/pages/Chips.tsx` — adicionar Tabs com 3 abas (Chips, Mensagens, Fila)
- `src/pages/Messages.tsx` — extrair conteúdo interno como componente exportável

