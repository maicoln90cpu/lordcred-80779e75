
## Plano de Correcoes - 3 Itens

### 1. Aumentar largura da coluna de conversas

A sidebar atual tem `w-96` (384px) no `WhatsApp.tsx` linha 159. Os filtros (Nao lidas, Favoritas, Status, Etiquetas) estao com scroll horizontal porque nao cabem. Tambem os filtros usam `overflow-x-auto` na linha 472 do `ChatSidebar.tsx`.

**Correcao**:
- Alterar `w-96` para `w-[420px]` no `WhatsApp.tsx` (sidebar aside)
- Ajustar os botoes de filtro para serem mais compactos (remover texto em alguns, usar apenas icones com tooltip, ou reduzir padding) para garantir que todos caibam sem scroll horizontal
- Remover `overflow-x-auto` e usar `flex-wrap` nos filtros para que quebrem linha se necessario

### 2. Corrigir sincronizacao de status do chip (botao Atualizar)

**Problema**: Apos reconectar um chip via QR Code, o frontend mantem o status antigo (`disconnected`) porque o state `selectedChipStatus` no `WhatsApp.tsx` so e atualizado quando `handleSelectChip` e chamado. O `ChipSelector` tambem le o status do banco na carga inicial e nao atualiza depois.

**Correcao**:
- Adicionar um botao "Atualizar status" (icone RefreshCw) no header do `WhatsApp.tsx`, ao lado dos botoes existentes
- Ao clicar, ele:
  1. Busca todos os chips do usuario no banco (`chips.status`)
  2. Para cada chip, chama a UazAPI `GET /instance/status` via edge function para verificar o status real
  3. Atualiza o banco com o status correto
  4. Atualiza o state local (`selectedChipStatus` e forca re-render do `ChipSelector`)
  5. Mostra toast com resultado ("3 chips atualizados - 1 conectado, 2 offline")
- Tambem garantir que apos o `ChipConnectDialog` fechar com sucesso, o `handleSelectChip` e chamado para atualizar o status

**Arquivos**: 
- `WhatsApp.tsx`: Adicionar botao e funcao `handleRefreshAllChips`
- `ChipSelector.tsx`: Expor funcao `fetchChips` via callback ou adicionar prop `refreshTrigger`

### 3. Botao "Sincronizar historico" no dropdown do chip + indicador visual

**Problema**: O `sync-history` e chamado em background ao selecionar chip, mas sem feedback visual. O usuario nao sabe se esta sincronizando ou se ja terminou. Alem disso, no dropdown do chip nao ha opcao para forcar sincronizacao.

**Correcao**:

**3a - Dropdown do chip (ChipSelector.tsx)**:
- Adicionar opcao "Sincronizar mensagens" no dropdown de chips conectados (abaixo de "Configuracoes")
- Ao clicar, chama `sync-history` e mostra toast com resultado

**3b - Indicador visual de sincronizacao (ChatSidebar.tsx)**:
- Adicionar estado `isSyncing` no `WhatsApp.tsx` que e passado para `ChatSidebar`
- Quando `sync-history` e chamado, mostrar uma barra no topo da sidebar: "Sincronizando mensagens..." com spinner
- Quando termina, atualizar para "X mensagens sincronizadas" por 3 segundos e depois sumir

---

### Detalhes Tecnicos

| # | Arquivo | Alteracao |
|---|---------|-----------|
| 1 | `WhatsApp.tsx` | Alterar aside de `w-96` para `w-[420px]`; adicionar botao RefreshCw no header; adicionar `handleRefreshAllChips`; gerenciar estado `isSyncing` |
| 2 | `ChatSidebar.tsx` | Alterar filtros de `overflow-x-auto` para `flex-wrap`; adicionar prop `isSyncing` com barra de indicacao no topo |
| 3 | `ChipSelector.tsx` | Adicionar opcao "Sincronizar mensagens" no dropdown de chips conectados; adicionar prop `onSyncHistory` |
