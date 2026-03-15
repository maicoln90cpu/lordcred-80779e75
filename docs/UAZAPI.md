# UazAPI v2 (uazapiGO) - Referência de Endpoints

## Autenticação

- **Endpoints admin**: header `admintoken` (token global do servidor)
- **Endpoints de instância**: header `token` (token único por instância, retornado no `POST /instance/init`)

## Estados da Instância

| Estado | Descrição |
|--------|-----------|
| `disconnected` | Instância criada mas sem conexão WhatsApp |
| `connecting` | Aguardando leitura do QR Code |
| `connected` | WhatsApp conectado e operacional |

## Endpoints

### Admin (header: `admintoken`)

| Método | Path | Body | Descrição |
|--------|------|------|-----------|
| POST | `/instance/init` | `{ "name": "nome_instancia" }` | Criar nova instância. Retorna `{ token }` |
| GET | `/instance/all` | - | Listar todas as instâncias |
| POST | `/instance/updateAdminFields` | `{ "name": "...", "adminField01": "...", "adminField02": "..." }` | Atualizar campos admin |
| GET | `/globalwebhook` | - | Ver webhook global |
| POST | `/globalwebhook` | `{ "url": "...", "events": [...] }` | Configurar webhook global |

### Instância (header: `token`)

| Método | Path | Body | Descrição |
|--------|------|------|-----------|
| POST | `/instance/connect` | `{ "phone": "5511..." }` (opcional) | Iniciar conexão. Sem phone=QR, com phone=paircode |
| GET | `/instance/status` | - | Retorna status + QR code (quando em `connecting`) |
| POST | `/instance/disconnect` | - | Desconectar instância (requer novo QR para reconectar) |
| DELETE | `/instance` | - | **Deletar instância** (usa `token`, NÃO `admintoken`) |
| POST | `/instance/updateInstanceName` | `{ "name": "novo_nome" }` | Atualizar nome |
| GET | `/instance/privacy` | - | Ver configurações de privacidade |
| POST | `/instance/privacy` | `{ "groupadd": "contacts", ... }` | Alterar privacidade |
| POST | `/instance/presence` | `{ "presence": "available" }` | Definir presença online/offline |

### Mensagens (header: `token`)

| Método | Path | Body | Descrição |
|--------|------|------|-----------|
| POST | `/send/text` | `{ "number": "5511999999999", "text": "mensagem" }` | Enviar mensagem de texto |

## Fluxo de Conexão (QR Code)

1. `POST /instance/connect` → Inicia o processo de conexão (NÃO retorna QR na resposta)
2. Aguardar ~2 segundos para geração do QR
3. `GET /instance/status` → Ler o QR code do campo `qrcode` (disponível quando estado = `connecting`)
4. Se `qrcode` estiver vazio, aguardar e tentar novamente
5. QR expira após ~45 segundos. Repetir o fluxo se necessário.

## Formato das Respostas

### POST /instance/init
```json
{
  "token": "token_unico_da_instancia"
}
```

### GET /instance/status
```json
{
  "instance": {
    "qrcode": "base64_do_qr_code_ou_vazio",
    "status": "connecting",
    "paircode": "XXXX-XXXX"
  },
  "status": {
    "connected": false,
    "jid": "",
    "loggedIn": false
  }
}
```

### GET /instance/all
```json
[
  {
    "name": "nome_instancia",
    "status": "connected",
    "ownerJid": "5511999999999@s.whatsapp.net"
  }
]
```

## Notas Importantes

- O campo `qrcode` em `/instance/status` pode ser uma string base64 **sem** o prefixo `data:image/png;base64,`
- O `token` de cada instância é retornado apenas na criação (`/instance/init`) — deve ser salvo no banco
- Endpoints de instância usam header `token`, NÃO `admintoken`
- Body de envio de texto usa `text`, NÃO `message`
- Body de criação usa `name`, NÃO `instanceName`
