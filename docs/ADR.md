# LordCred — Architecture Decision Records (ADRs)

> Registro de decisões arquiteturais com contexto, alternativas e consequências.

---

## ADR-001: UazAPI como Provedor WhatsApp Exclusivo

**Data**: Março 2026
**Status**: Aceito

**Contexto**: O projeto originalmente suportava dois provedores (Evolution API e UazAPI). Manter dois caminhos de código duplicava complexidade em edge functions, frontend e testes.

**Decisão**: Remover completamente Evolution API e consolidar em UazAPI v2 (uazapiGO).

**Alternativas consideradas**:
- Manter ambos provedores (rejeitado: complexidade desnecessária)
- Migrar para Evolution API exclusiva (rejeitado: UazAPI mais estável e já em produção)

**Consequências**:
- (+) Código mais simples e manutenível
- (+) Menos edge functions para manter
- (-) Nome `evolution-webhook` mantido por compatibilidade (webhooks já configurados)
- (-) Campos `evolution_api_url`/`evolution_api_key` legados no banco

> Detalhes em [HISTORICO-EVOLUTION-CLEANUP.md](./HISTORICO-EVOLUTION-CLEANUP.md)

---

## ADR-002: is_privileged() SECURITY DEFINER para RLS

**Data**: Março 2026
**Status**: Aceito

**Contexto**: Com 5 roles e dezenas de tabelas, cada política RLS precisava verificar roles. Acessar `user_roles` diretamente causava recursão (a tabela também tem RLS).

**Decisão**: Criar funções `is_privileged()` e `has_role()` com SECURITY DEFINER que bypassam RLS ao consultar `user_roles`.

**Alternativas consideradas**:
- RLS recursivo com exceções (rejeitado: frágil e difícil de debugar)
- Roles em JWT claims (rejeitado: não atualiza em tempo real)
- Roles na tabela profiles (rejeitado: risco de privilege escalation)

**Consequências**:
- (+) ~60 políticas RLS consolidadas em ~30
- (+) Alteração de role reflete imediatamente
- (+) Impossível privilege escalation via cliente
- (-) Dependência de funções SQL customizadas

---

## ADR-003: Refatoração Modular (Hooks + Sub-componentes)

**Data**: Abril 2026
**Status**: Aceito

**Contexto**: Vários arquivos ultrapassavam 900+ linhas (Commissions.tsx, Leads.tsx, ChatWindow.tsx, InternalChat.tsx, ChatSidebar.tsx). Dificultava manutenção e review.

**Decisão**: Decompor em hooks customizados (lógica) + sub-componentes (UI), mantendo cada arquivo < 300 linhas.

**Padrão adotado**:
```
Página (~200 linhas) = orquestrador
  ├── Hook (lógica de negócio, ~300 linhas)
  ├── Sub-componente A (UI, ~200 linhas)
  └── Sub-componente B (UI, ~200 linhas)
```

**Consequências**:
- (+) Arquivos menores e focados
- (+) Hooks reutilizáveis
- (+) Testes unitários mais fáceis (futuro)
- (-) Mais arquivos para navegar
- (-) Necessidade de entender a composição

---

## ADR-004: Meta WhatsApp Business como Provedor Secundário

**Data**: Abril 2026
**Status**: Aceito

**Contexto**: Alguns clientes precisam de WhatsApp Business API oficial (Meta) para conformidade. UazAPI continua como provedor primário para aquecimento.

**Decisão**: Adicionar suporte a Meta como segundo provedor via campo `provider` nos chips (`uazapi` ou `meta`). Edge functions separadas: `whatsapp-gateway` e `meta-webhook`.

**Consequências**:
- (+) Suporte a WhatsApp oficial para clientes corporativos
- (+) Chips podem usar UazAPI OU Meta conforme necessidade
- (-) Dois caminhos de envio/recepção a manter

---

## ADR-005: Supabase Realtime com Debounce

**Data**: Abril 2026
**Status**: Aceito

**Contexto**: Subscriptions de Realtime sem debounce causavam re-renders excessivos (ex: 10 mensagens em 1 segundo = 10 re-fetches).

**Decisão**: Criar `useRealtimeSubscription` genérico com debounce configurável (padrão 300ms).

**Consequências**:
- (+) Menos re-renders e queries ao banco
- (+) Interface consistente para todas as subscriptions
- (+) Cleanup automático de channels

---

## ADR-006: Paste Import (Ctrl+V) para Planilhas

**Data**: Março 2026
**Status**: Aceito

**Contexto**: Importar dados de comissão via upload de arquivo (.xlsx) exigiria parser de Excel no frontend ou edge function. Planilhas são sempre abertas no Excel/Google Sheets durante a auditoria.

**Decisão**: Usar Ctrl+V paste de dados tabulares (TSV). O `clipboardParser.ts` analisa o texto colado, detecta headers e converte para objetos.

**Consequências**:
- (+) Zero dependência de bibliotecas de parsing Excel
- (+) Fluxo natural do auditor (já tem planilha aberta)
- (+) Preview antes de importar
- (-) Requer que o usuário selecione e copie manualmente
- (-) Planilhas com formatação complexa podem falhar

---

## Ver Também

- [SYSTEM-DESIGN.md](./SYSTEM-DESIGN.md) — Arquitetura atual
- [SECURITY.md](./SECURITY.md) — Decisões de segurança
- [HISTORICO-EVOLUTION-CLEANUP.md](./HISTORICO-EVOLUTION-CLEANUP.md) — Detalhes da ADR-001
