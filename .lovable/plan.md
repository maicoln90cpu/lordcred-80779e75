

## Plano: Templates de áudio enviados como PTT (mensagem de voz)

### Problema
O campo `type` enviado à UazAPI determina a aparência no WhatsApp:
- `ptt` = mensagem de voz nativa (bolinha verde, waveform)
- `audio` = arquivo de áudio genérico (player de arquivo)

Templates com áudio estão sendo enviados como `audio`, não como `ptt`.

### Solução
Duas mudanças simples:

1. **`src/components/whatsapp/TemplatePicker.tsx`** — Na função `handleSelect`, quando `media_type` for `audio`, substituir por `ptt` antes de chamar `onSendMedia`:
```ts
const sendType = t.media_type === 'audio' ? 'ptt' : t.media_type!;
onSendMedia(base64, sendType, t.content || '', t.media_filename || undefined);
```

2. **`src/pages/admin/Templates.tsx`** — No formulário de criação de template, quando o admin faz upload de áudio, já salvar `media_type` como `ptt` em vez de `audio`. Ou manter `audio` no banco e só converter no momento do envio (opção 1 é mais simples e suficiente).

### Arquivos modificados
1. `src/components/whatsapp/TemplatePicker.tsx` — converter `audio` → `ptt` no envio

