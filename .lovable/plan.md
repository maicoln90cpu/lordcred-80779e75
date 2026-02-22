

## Correcao definitiva: Badge, Horario e Menu de 3 pontos

### Causa raiz identificada

O console confirma que `unreadCount: 2` ESTA no componente no momento da renderizacao. O nome fica em negrito (prova que o dado chega). Mas badge, horario e 3 pontos NAO aparecem. Isso e 100% problema de CSS/layout.

### 4 conflitos encontrados

**1. App.css com estilos padrao do Vite**
O arquivo `src/App.css` contem:
```css
#root {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}
```
O `padding: 2rem` adiciona 32px em todos os lados, reduzindo o espaco disponivel. O `text-align: center` e herdado por todos os filhos.

**2. Linha do nome: falta `flex-1` no container do nome**
```
<div className="flex items-center gap-1 min-w-0">  // SEM flex-1
  <span className="truncate">{chat.name}</span>
</div>
<span className="shrink-0 ml-2">{timestamp}</span>  // empurrado para fora
```
Sem `flex-1`, o div do nome nao preenche o espaco. Com nomes longos, `justify-between` empurra o timestamp para fora da area visivel.

**3. Linha da mensagem: falta `flex-1 min-w-0` no span da mensagem**
```
<span className="truncate">{lastMessage}</span>  // SEM flex-1, SEM min-w-0
<span className="shrink-0">{badge}</span>  // empurrado para fora
```
Sem `min-w-0`, o `truncate` nao consegue encolher. O badge e empurrado para alem do container.

**4. Menu de 3 pontos: `md:opacity-0` + posicao absoluta**
O menu usa `md:opacity-0 md:group-hover:opacity-100` mas o botao que ocupa toda a area pode nao acionar o `group-hover` corretamente no container pai.

---

### Plano de correcao (2 arquivos)

#### Arquivo 1: `src/App.css`
Limpar completamente os estilos padrao do Vite que conflitam:
- Remover `#root { max-width, padding, text-align, margin }`
- Remover `.logo`, `.card`, `.read-the-docs` e keyframes nao usados
- Manter apenas o arquivo vazio ou com comentario

#### Arquivo 2: `src/components/whatsapp/ChatSidebar.tsx`

**Correcao na linha do nome (668-676):**
- Adicionar `flex-1` ao div do nome para preencher o espaco
- Garantir `overflow-hidden` no div do nome

De:
```
<div className="flex items-center gap-1 min-w-0">
```
Para:
```
<div className="flex items-center gap-1 min-w-0 flex-1 overflow-hidden">
```

**Correcao na linha da mensagem (678-685):**
- Adicionar `flex-1 min-w-0` ao span da mensagem para permitir encolhimento

De:
```
<span className={cn("text-xs truncate", ...)}>
```
Para:
```
<span className={cn("text-xs truncate flex-1 min-w-0", ...)}>
```

**Correcao no menu de 3 pontos (701-702):**
- Remover `md:opacity-0` — tornar sempre visivel com opacidade reduzida
- Usar opacidade parcial que aumenta no hover

De:
```
<div className="absolute right-2 top-2 z-10 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
```
Para:
```
<div className="absolute right-2 top-2 z-10 opacity-50 group-hover:opacity-100 transition-opacity">
```

**Remover console.log de debug (linha 650):**
- Remover a linha de debug `if (chat.unreadCount > 0) console.log(...)` que polui o console

---

### Resumo das alteracoes

| Arquivo | Alteracao |
|---|---|
| `src/App.css` | Limpar estilos padrao do Vite (#root padding, text-align, max-width) |
| `ChatSidebar.tsx` linha 669 | Adicionar `flex-1 overflow-hidden` ao div do nome |
| `ChatSidebar.tsx` linha 679 | Adicionar `flex-1 min-w-0` ao span da mensagem |
| `ChatSidebar.tsx` linha 702 | Trocar `md:opacity-0` por `opacity-50` no menu 3 pontos |
| `ChatSidebar.tsx` linha 650 | Remover console.log de debug |

### Resultado esperado

- Horario visivel ao lado do nome em TODAS as conversas
- Badge verde de nao lidas visivel ao lado da ultima mensagem
- Menu de 3 pontos sempre visivel (semitransparente, opaco no hover)
- Layout correto sem padding extra do App.css
