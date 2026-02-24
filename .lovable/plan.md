

## Tornar numeros sem formatacao clicaveis no chat

### Problema

O regex de deteccao de telefone no `MessageBubble.tsx` (linha 81) exige separadores entre grupos de digitos:

```
/\b(\+?\d{2,3}[\s.-]?\(?\d{2}\)?[\s.-]?\d{4,5}[\s.-]?\d{4})\b/g
```

Um numero como `11999136884` (11 digitos sem separadores) nao bate nesse padrao porque o regex espera grupos separados por pontos, espacos ou hifens. Ja `5511999136884` (13 digitos) tambem nao bate pelo mesmo motivo.

### Solucao

Substituir o regex por um que tambem capture sequencias simples de 10 a 15 digitos (com ou sem `+`), alem dos formatos com separadores ja suportados.

### Alteracao

**Arquivo: `src/components/whatsapp/MessageBubble.tsx`**

Linha 81 — substituir o regex local dentro de `formatWhatsAppText`:

```
// Antes:
const phoneRegex = /\b(\+?\d{2,3}[\s.-]?\(?\d{2}\)?[\s.-]?\d{4,5}[\s.-]?\d{4})\b/g;

// Depois:
const phoneRegex = /\b(\+?\d{10,15})\b|\b(\+?\d{2,3}[\s.-]?\(?\d{2}\)?[\s.-]?\d{4,5}[\s.-]?\d{4})\b/g;
```

E ajustar a logica de split/match (linhas 82-98) para tratar ambos os grupos de captura:
- Usar um regex combinado que captura tanto sequencias puras de digitos (10-15) quanto formatos com separadores
- Na iteracao dos segmentos, extrair os digitos e verificar se o segmento corresponde a um telefone

Tambem atualizar a constante `PHONE_REGEX` na linha 50 para consistencia (embora ela nao seja usada diretamente no fluxo atual).

### Resultado esperado

- `11999136884` (11 digitos) — clicavel, abre conversa com `5511999136884`
- `5511999136884` (13 digitos) — clicavel, abre conversa com `5511999136884`
- `(11) 99913-6884` — clicavel (ja funcionava)
- Numeros curtos como `12345` — nao clicaveis (menos de 10 digitos)
