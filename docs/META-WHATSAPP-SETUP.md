# Configurar Meta WhatsApp Business API — Manual Passo a Passo

> Guia em linguagem simples para conectar o WhatsApp Business oficial (Meta) ao LordCred.
> Tela: **Admin → Integrações → Meta WhatsApp**.

---

## Os 5 campos que você precisa preencher

| Campo | Onde encontrar | Exemplo |
|---|---|---|
| **App ID** | Meta for Developers → Seu App → Configurações → Básico | `1234567890123456` |
| **App Secret** | Meta for Developers → Seu App → Configurações → Básico (clicar "Mostrar") | `abc123def456...` |
| **WABA ID** (WhatsApp Business Account ID) | Meta Business Suite → Configurações → Contas → WhatsApp | `9876543210987654` |
| **Phone Number ID** | Meta for Developers → WhatsApp → Configuração da API → ID do número | `5555555555555555` |
| **Webhook Verify Token** | Você inventa (qualquer string segura) | `lordcred-webhook-2026-xyz` |

---

## Passo 1 — Criar app no Meta for Developers

1. Acesse https://developers.facebook.com.
2. Faça login com sua conta Facebook (precisa estar vinculada à empresa).
3. Clique **Meus Apps → Criar App**.
4. Tipo: **Empresa**.
5. Nome: ex. "LordCred WhatsApp".
6. Email de contato e conta empresarial.
7. Após criar, em **Adicionar Produtos**, clique **WhatsApp → Configurar**.

✅ Pronto: você tem o **App ID** (no topo da tela).

---

## Passo 2 — Pegar App Secret

1. No painel do app, vá em **Configurações → Básico**.
2. Procure **Chave Secreta do App**.
3. Clique em **Mostrar** (vai pedir sua senha do Facebook).
4. Copie a string longa.

✅ Esse é o **App Secret**.

---

## Passo 3 — Pegar WABA ID

1. Acesse https://business.facebook.com/settings.
2. Menu esquerdo: **Contas → Contas do WhatsApp**.
3. Clique na conta da sua empresa.
4. No topo aparece o **ID** (números longos).

✅ Esse é o **WABA ID**.

---

## Passo 4 — Pegar Phone Number ID

1. No Meta for Developers, abra seu app → **WhatsApp → Configuração da API**.
2. Na seção **Enviar e receber mensagens**, veja a tabela com seus números.
3. Cada número tem um **ID do número de telefone** (não confundir com o número em si).

✅ Esse é o **Phone Number ID**.

---

## Passo 5 — Inventar Webhook Verify Token

Esse token é uma senha que VOCÊ cria para a Meta confirmar que o webhook é seu. Use algo único e seguro:

```
lordcred-webhook-{ano}-{string-aleatoria}
```

Exemplo: `lordcred-webhook-2026-K3p9xQ7mZv`

✅ Guarde esse token — vai usar tanto no LordCred quanto no Meta.

---

## Passo 6 — Configurar webhook na Meta

1. No Meta for Developers → seu app → **WhatsApp → Configuração**.
2. Em **Webhook**, clique **Editar**.
3. **URL de Callback**: `https://sibfqmzsnftscnlyuwiu.supabase.co/functions/v1/meta-webhook`
4. **Token de Verificação**: cole o token que você inventou no Passo 5.
5. Clique **Verificar e Salvar**. Deve aparecer "✅ Verificado".
6. Em **Campos do Webhook**, marque:
   - `messages`
   - `message_status`
   - `message_template_status_update`

---

## Passo 7 — Salvar no LordCred

1. Acesse **Admin → Integrações → Meta WhatsApp**.
2. Cole os 5 valores nos campos correspondentes.
3. Clique **Salvar**.
4. Clique **Testar Conexão** — deve aparecer "✅ Conectado".

---

## Como funciona internamente (o que você NÃO precisa fazer)

- O LordCred salva os 5 campos na tabela `system_settings`.
- As edge functions (`whatsapp-gateway` e `meta-webhook`) leem **primeiro do banco**, depois caem em fallback nos `Deno.env` (secrets) caso o banco esteja vazio.
- Isso permite que você troque credenciais pela tela sem precisar redeployar nada.

---

## Erros comuns

| Erro | Causa | Solução |
|---|---|---|
| "Token de verificação inválido" | Token na Meta ≠ token no LordCred | Conferir que copiou exatamente igual |
| "WABA não autorizada" | Conta empresarial não verificada na Meta | Verificar empresa em Meta Business Suite |
| "Phone number not registered" | Número não foi adicionado ao WhatsApp Business | Adicionar e validar no Meta for Developers |
| "Template not found" | Mensagem usando template não aprovado | Aguardar aprovação (24-48h) ou usar template padrão |
| "Webhook não recebe mensagens" | Campos não marcados na Meta | Voltar ao Passo 6 e marcar `messages` |

---

## Aprovar templates (obrigatório para iniciar conversa)

A Meta exige que mensagens **iniciadas pela empresa** usem **templates aprovados**.

1. Meta Business Suite → **Modelos de Mensagem**.
2. Clique **Criar Modelo**.
3. Categoria: **Marketing** (promocional) ou **Utilitário** (transacional, mais barato).
4. Idioma: **Português (Brasil)**.
5. Conteúdo: ex. "Olá {{1}}, seu pedido {{2}} foi aprovado!"
6. Enviar para aprovação. Resposta em 24-48h.
7. Templates aprovados aparecem automaticamente no LordCred.

---

## Custos (aproximados, abril 2026)

- **Conversa iniciada pelo cliente** (recebe → responde em 24h): **GRÁTIS**.
- **Conversa de utilidade iniciada pela empresa**: ~R$ 0,08.
- **Conversa de marketing iniciada pela empresa**: ~R$ 0,25.
- **Conversa de autenticação (OTP)**: ~R$ 0,03.

Cobrança pela Meta diretamente (não passa pelo LordCred).

---

📅 **Atualizado em:** 2026-04-23
🔄 **Atualizar quando:** Meta mudar UI do Developers, alterar preços, adicionar novos campos obrigatórios.
