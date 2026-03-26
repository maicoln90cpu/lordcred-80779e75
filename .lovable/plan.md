

# Nova aba "API Tester" na página de Logs de Auditoria

## O que será feito

Adicionar uma sub-aba na página `AuditLogs.tsx` com um testador manual da API Corban. A página terá:

1. **Campo URL** (pré-preenchido com `https://api.newcorban.com.br/api/`)
2. **Textarea de Payload** (JSON completo que o usuário monta manualmente, incluindo auth)
3. **Botão Enviar**
4. **Campo de Resposta** (exibe o JSON retornado pela API, com status HTTP)

## Implementação

### Arquivo: `src/pages/admin/AuditLogs.tsx`

- Importar `Tabs, TabsList, TabsTrigger, TabsContent` e `Textarea`
- Envolver o conteúdo existente em `TabsContent value="logs"`
- Criar nova `TabsContent value="api-tester"` com:
  - Input para URL (default: `https://api.newcorban.com.br/api/`)
  - Textarea para payload JSON (placeholder com exemplo de getPropostas completo)
  - Botão "Enviar Requisição"
  - Textarea readonly para resposta (status + body)
- A chamada será feita via `supabase.functions.invoke('corban-api')` passando uma nova action `rawProxy` que encaminha o body direto para a URL

### Arquivo: `supabase/functions/corban-api/index.ts`

- Adicionar action `rawProxy` à lista de valid actions
- No switch, quando `rawProxy`: pegar `params.url` e `params.body`, fazer `fetch(url, { method: 'POST', body })` direto e retornar o resultado bruto
- Restrito a role `admin` (já coberto pelo check existente, basta adicionar `rawProxy` ao `WRITE_ACTIONS`)

### Segurança
- `rawProxy` será restrito a admins via role check existente
- O payload é enviado exatamente como o usuário digitou -- é um testador manual

