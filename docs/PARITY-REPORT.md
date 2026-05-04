# Relatório de Paridade — UazAPI vs Meta WhatsApp Cloud API

> 🤖 **Gerado automaticamente** em 2026-05-04 19:42:14 UTC
> Fonte de testes: `supabase/functions/whatsapp-gateway/meta_contract_test.ts`
> Não edite manualmente — rode `deno run --allow-read --allow-write scripts/generate-parity-report.ts`

## 📊 Matriz de Paridade

| Funcionalidade | UazAPI | Meta | Observações |
|---|:---:|:---:|---|
| Envio de texto | ✅ | ✅ | Paridade total |
| Envio de mídia (img/vid/doc/audio) | ✅ | ✅ | Meta requer upload prévio (media_id) |
| Sticker (webp ≤500KB) | ✅ | ✅ | Meta valida tamanho/formato |
| Resposta citada (quoted) | ✅ | ✅ | Meta usa context.message_id |
| Encaminhar mensagem | ✅ | ✅ | Cache de media_id (25d) + reupload cross-chip |
| Apagar mensagem | ✅ | ❌ | Meta não suporta — retorna unsupported:true |
| Editar mensagem | ✅ | ❌ | Meta não suporta — retorna unsupported:true |
| Indicador de digitação | ✅ | ❌ | Meta não suporta — retorna unsupported:true |
| Marcar como lida | ✅ | ✅ | Meta usa /messages com status=read |
| Templates aprovados | N/A | ✅ | Exclusivo Meta (HSM) |
| Webhook de status | ✅ | ✅ | Hierarquia: read > delivered > sent |

## 🧪 Testes de Contrato (Deno)

Total: **5 testes** garantindo o contrato de resposta entre frontend e `whatsapp-gateway`.

1. `Meta unsupported actions return success:false with unsupported:true`
2. `Meta send-message payload includes context when quoted`
3. `Meta sticker payload uses webp media reference`
4. `Forward reuses original media_url as Meta media id`
5. `Sticker size guard: reject >500KB base64`

### Como rodar
```bash
deno test supabase/functions/whatsapp-gateway/meta_contract_test.ts
```

## 🔁 Estratégia de Fallback (Meta)

Quando uma ação não é suportada, o gateway retorna:
```json
{ "success": false, "unsupported": true, "provider": "meta", "error": "..." }
```
O frontend exibe toast amigável: **"Função indisponível na Meta"**.

## 📦 Cache de Media (forward-message)

Tabela `meta_media_cache` (TTL 25 dias, antes da expiração de 30d da Meta):
- **Layer 1**: Cache hit → reusa `media_id`
- **Layer 2**: Mesmo chip → reusa `media_url` direto
- **Layer 3**: Cross-chip → download + reupload Meta + atualiza cache
- **Layer 4**: Fallback amigável `{ fallback: true, reason: "media_unavailable" }`

## 📚 Links Relacionados

- [CHANGELOG](./CHANGELOG.md)
- [Setup Meta WhatsApp](./META-WHATSAPP-SETUP.md)
- [Edge Functions](./EDGE-FUNCTIONS.md)

---
_Última atualização automática: 2026-05-04 19:42:14 UTC_
