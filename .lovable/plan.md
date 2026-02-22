

## Correcao DEFINITIVA: Badge, Horario e Menu de 3 pontos

### Causa raiz REAL encontrada (confirmada no codigo-fonte)

O problema NAO era apenas CSS no componente. A causa raiz esta no componente **ScrollArea do Radix UI**.

O Radix ScrollArea envolve todo o conteudo em um `div` invisivel com:
```css
style="min-width: 100%; display: table"
```

`display: table` faz com que o conteudo se expanda para sua largura NATURAL, sem respeitar limites. Isso significa que:
- `truncate` nao funciona (o texto nunca precisa truncar porque o "table" se expande)
- `min-w-0` nao funciona (o pai permite largura infinita)
- O timestamp, badge e menu de 3 pontos sao renderizados mas ficam FORA da area visivel (overflow hidden do ScrollArea os esconde)

O nome em negrito funciona porque e apenas uma mudanca de `font-weight`, nao depende de largura.

**Confirmacao no codigo-fonte** (arquivo `node_modules/@radix-ui/react-scroll-area/dist/index.mjs`, linha 130):
```
jsx("div", { style: { minWidth: "100%", display: "table" }, children })
```

### Plano de correcao (1 arquivo)

#### Arquivo: `src/components/ui/scroll-area.tsx`

Adicionar override CSS no Viewport para forcar `display: block` no div interno do Radix:

De:
```tsx
<ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
```

Para:
```tsx
<ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit] [&>div]:!block">
```

A classe Tailwind `[&>div]:!block` faz:
- `[&>div]` = seleciona o div filho direto (o div com `display: table`)
- `!block` = aplica `display: block !important` para sobreescrever o inline style

### Por que isso resolve TUDO

| Problema | Por que nao aparecia | Por que vai aparecer |
|---|---|---|
| Timestamp | Texto do nome expandia infinitamente, empurrando timestamp para fora | Com `display: block`, o conteudo respeita a largura do container |
| Badge de nao lidas | Mesma razao - empurrada para fora do overflow | Vai ficar dentro da area visivel |
| Menu de 3 pontos | Posicao absoluta `right-2` mas o container pai tinha largura excessiva | Container com largura correta = posicao correta |
| Nome em negrito | Funcionava porque `font-weight` nao depende de largura | Continua funcionando |

### Impacto

Esta correcao e global - afeta TODOS os ScrollArea do projeto. Isso e positivo porque o comportamento `display: table` do Radix causa problemas de truncamento em qualquer lugar. Funciona para TODOS os chips, nao apenas o primeiro, porque a correcao esta no componente compartilhado.

### Resumo

| Arquivo | Alteracao |
|---|---|
| `src/components/ui/scroll-area.tsx` linha 11 | Adicionar `[&>div]:!block` ao Viewport do ScrollArea |

Apenas 1 linha alterada. Correcao cirurgica na causa raiz.

