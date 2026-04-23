

# Plano: Editar Secrets do Meta no Frontend + Manual Leigo

## Problema atual

Hoje os 4 secrets do Meta (`META_ACCESS_TOKEN`, `META_VERIFY_TOKEN`, `META_APP_SECRET`, `META_WEBHOOK_SECRET`) estão **fixos no Supabase Secrets** e não podem ser editados pela interface. Você começou a usar uma conta nova e o sistema continua usando a antiga.

Hoje a tela `/admin/integrations` (componente `MetaConfigCard.tsx`) só edita 3 campos salvos na tabela `system_settings`:
- `meta_app_id`
- `meta_access_token`
- `meta_verify_token`

E mesmo esses 3 **não estão sendo lidos pelas Edge Functions** — elas usam os secrets antigos.

## O que será feito

### 1) Adicionar 2 campos novos na tela `/admin/integrations`

No card "Credenciais Meta" (`MetaConfigCard.tsx`), adicionar:
- **App Secret** (campo password) — `meta_app_secret`
- **Webhook Secret** (campo password) — `meta_webhook_secret`

Total: 5 campos editáveis (App ID, Access Token, Verify Token, App Secret, Webhook Secret).

### 2) Salvar os 2 novos campos em `system_settings`

Migration: adicionar colunas `meta_app_secret` e `meta_webhook_secret` na tabela `system_settings` (text, nullable). Apenas Admins/Master poderão ler/editar (RLS já existe).

### 3) Fazer as Edge Functions priorizarem o banco antes do secret

Alterar `meta-webhook/index.ts` e `whatsapp-gateway/index.ts` para a seguinte ordem de leitura:

```text
1. Tenta ler de system_settings (banco)
2. Se vazio → cai no Deno.env.get() (secret)
```

Assim você pode trocar credenciais pelo painel sem redeploy. Quando quiser voltar ao modo "produção segura", basta apagar os campos do banco — o sistema volta a usar os secrets automaticamente.

### 4) Adicionar componente "Manual Passo a Passo" abaixo do card

Criar `MetaCredentialsGuide.tsx` — um accordion com 5 cartões, um para cada campo, explicando em linguagem leiga onde achar cada credencial. Resumo:

| Campo | Onde achar (resumo do guia) |
|---|---|
| **App ID** | Meta for Developers → Meus Apps → seu app → cabeçalho mostra "ID do App: 123456..." |
| **Access Token** | Meta Business Suite → Configurações → Usuários do Sistema → criar usuário admin → "Gerar Token" → marcar `whatsapp_business_messaging` + `whatsapp_business_management` → escolher "Sem expiração" |
| **Verify Token** | É inventado por você (qualquer texto, ex: `lordcred2026`). Cole o MESMO texto aqui e no Meta Webhook |
| **App Secret** | Meta for Developers → seu app → Configurações → Básico → campo "Chave secreta do app" → clique em "Mostrar" |
| **Webhook Secret** | Opcional. Usado para validar assinatura HMAC dos webhooks. Se não preencher, o sistema aceita sem validar (menos seguro, mas funciona) |

Cada cartão terá:
- 🎯 Para que serve (1 frase)
- 📍 Caminho exato no painel Meta (passos numerados)
- 🖼️ Dica visual ("o campo aparece no canto superior direito…")
- ⚠️ Erros comuns ("se aparecer EAAB... é token de teste, dura 24h")
- 🔗 Link direto para a página do Meta

## Arquitetura final

```text
┌──────────────────────────────────┐
│ Tela /admin/integrations         │
│  ├─ MetaConfigCard (5 campos)   │
│  ├─ MetaCredentialsGuide (novo)  │
│  └─ MetaSetupGuide (existente)   │
└──────────────────────────────────┘
              ↓ salva em
┌──────────────────────────────────┐
│ system_settings (banco)          │
│  meta_app_id, meta_access_token, │
│  meta_verify_token,              │
│  meta_app_secret (novo),         │
│  meta_webhook_secret (novo)      │
└──────────────────────────────────┘
              ↓ lido por
┌──────────────────────────────────┐
│ Edge Functions                   │
│  1º tenta banco                  │
│  2º cai em Deno.env (secret)     │
└──────────────────────────────────┘
```

## Vantagens
- Troca de conta Meta sem precisar mexer em secrets ou redeploy
- Cada credencial vem com manual leigo embutido
- Funciona como "modo configuração": preencheu no banco → usa banco; deixou vazio → usa secret de produção

## Desvantagens / Riscos
- **Segurança**: tokens ficam no banco (mas só Admin/Master enxerga via RLS já existente)
- **Atenção**: se preencher campo errado no banco, sobrescreve o secret. Para voltar ao secret, precisa apagar o campo (botão "Limpar" será adicionado em cada campo)

## Checklist manual (após implementação)
1. Abrir `/admin/integrations` → ver os 5 campos
2. Expandir o accordion "Manual Passo a Passo" → ler instruções de cada campo
3. Colar credenciais da nova conta Meta → Salvar
4. Clicar "Testar Conexão" → ver Conectado ✅
5. Cadastrar chip Meta novo → validar Phone Number ID
6. Mandar mensagem teste

## Pendências
- Após tudo funcionar, você decide: deixar no banco (prático) ou limpar campos e voltar a usar secrets (mais seguro)
- Futuramente: adicionar botão "Mover para Secrets" que limpa o banco e atualiza o secret automaticamente

## Prevenção de regressão
- Mensagem de aviso amarela no topo do card: "⚠️ Modo Configuração: credenciais salvas no banco têm prioridade sobre os secrets de produção. Limpe os campos para voltar aos secrets."
- Cada campo terá indicador visual (🟢 vindo do banco / 🔵 vindo do secret) para você saber a origem em uso

