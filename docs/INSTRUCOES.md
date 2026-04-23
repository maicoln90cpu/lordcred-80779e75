# LordCred — Instruções de Uso

## O que é o LordCred?

O LordCred é uma plataforma de aquecimento inteligente de chips WhatsApp + CRM de vendas + Auditoria de Comissões. Ele envia mensagens de forma automática e gradual entre seus números, simulando conversas reais para que o WhatsApp reconheça seus chips como contas legítimas e ativas, reduzindo drasticamente o risco de bloqueio.

---

## Como Funciona o Aquecimento

O sistema envia mensagens automaticamente entre seus chips ao longo do dia, respeitando limites diários, horários de operação e padrões humanos de uso. A ideia é simular o comportamento de um usuário real que conversa ao longo do dia, e não de um robô que dispara mensagens em rajadas.

---

## As 5 Fases de Aquecimento

Cada chip possui uma fase de aquecimento que você define manualmente. A fase determina quantas mensagens o chip enviará por dia. Comece sempre pela fase "Novo" e vá avançando gradualmente conforme o chip amadurece.

### Novo
- **Mensagens por dia:** 5
- **Intervalo estimado (12h):** ~2h24min (±50%: 1h12min a 3h36min)

### Iniciante
- **Mensagens por dia:** 20
- **Intervalo estimado (12h):** ~36min (±50%: 18min a 54min)

### Crescimento
- **Mensagens por dia:** 50
- **Intervalo estimado (12h):** ~14min (±50%: 7min a 21min)

### Aquecido
- **Mensagens por dia:** 80
- **Intervalo estimado (12h):** ~9min (±50%: 4min30s a 13min30s)

### Maduro
- **Mensagens por dia:** 100
- **Intervalo estimado (12h):** ~7min (±50%: 3min30s a 10min30s)

> **Dica:** Nunca pule fases. Avance gradualmente (a cada 3-5 dias).

---

## Distribuição Inteligente de Mensagens

As mensagens são distribuídas naturalmente ao longo do período de operação:
- Intervalo = horas restantes ÷ mensagens restantes
- Variação aleatória de ±50% em cada intervalo

---

## Proteção Anti-Bloqueio

1. **Simulação de digitação** (proporcional ao tamanho do texto)
2. **Delay de leitura** (espera antes de responder)
3. **Padrão humano de horários** (dentro do horário configurado)
4. **Variação aleatória** (sem padrões repetitivos)
5. **Limite por hora** e **limite consecutivo**
6. **Cooldown após erros**
7. **Redução no fim de semana**

---

## Modos de Aquecimento

- **same_user**: Chips do mesmo usuário conversam entre si
- **between_users**: Chips de diferentes usuários trocam mensagens
- **external**: Chips enviam para números externos cadastrados

---

## Relatório de Comissões

### Como Importar Dados

1. Abra a planilha original no Excel/Google Sheets
2. Selecione todos os dados (Ctrl+A)
3. Copie (Ctrl+C)
4. Na aba correspondente (Geral, Repasse, Seguros ou Relatório), clique no botão "Colar dados"
5. Cole (Ctrl+V) no campo que aparece
6. Confira o preview e clique "Importar"

### Abas Disponíveis

- **Geral/Repasse/Seguros**: Dados importados das planilhas de produção
- **Relatório**: Dados de vendas com cálculo automático de comissão esperada
- **Resumo**: Dashboard com filtros de período, resumo por banco e tabela detalhada
- **Indicadores**: KPIs de acurácia, perda acumulada e taxa média
- **Regras CLT/FGTS**: Configuração das taxas de comissão por banco
- **Hist. Importações**: Gerenciar lotes importados
- **Histórico**: Fechamentos salvos (salvar período → expandir para ver contratos)
- **Divergências**: Contratos onde a comissão recebida diverge da esperada

### Como Ler o Resumo

1. Defina o período (Data Início e Data Fim)
2. Os KPIs no topo mostram totais filtrados
3. "Resumo por Banco" agrupa por banco com totais
4. "Detalhado" mostra cada contrato individual (paginado)
5. Use "Salvar Fechamento" para registrar o período no histórico

### Onde Encontrar Relatórios Específicos

| Relatório | Onde |
|---|---|
| Histórico Gestão | Aba **Histórico** (lista de fechamentos) |
| Histórico Detalhado | Aba **Histórico** → expandir um fechamento |
| Diferença Detalhada | Aba **Divergências** (contratos com |Δ| > R$0.01) |

> Documentação técnica completa em [COMMISSION-REPORTS.md](./COMMISSION-REPORTS.md)

---

## Integração Corban (NewCorban)

### Para Administradores

- **Dashboard**: Visão geral de propostas e KPIs
- **Propostas**: Consultar, criar e acompanhar propostas
- **FGTS**: Gerenciar fila de FGTS
- **Assets**: Sincronizar bancos, convênios e tabelas
- **Config**: Configurar visibilidade de funcionalidades por papel

### Para Vendedores

- **Minhas Propostas**: Ver propostas atribuídas
- **Meu FGTS**: Ver fila FGTS atribuída

> Documentação técnica em [corban.md](./corban.md)

---

## Matriz de Permissões por Papel

O sistema possui 5 papéis: **Master** (role `master`), **Administrador** (role `admin`), **Gerente** (role `manager`), **Suporte** (role `support`) e **Vendedor** (role `seller`).

Master, Administrador e Gerente são considerados "privilegiados" — no banco de dados, a função `is_privileged()` (SECURITY DEFINER) retorna `true` para essas três roles.

### Hierarquia de Acesso

| Papel | Nível | Pode criar | Pode alterar roles de |
|---|---|---|---|
| **Master** | Máximo | Admin, Gerente, Suporte, Vendedor | Todos exceto Master |
| **Administrador** | Alto | Gerente, Suporte, Vendedor | Gerente, Suporte, Vendedor |
| **Gerente** | Médio-Alto | Gerente, Suporte, Vendedor | Suporte, Vendedor |
| **Suporte** | Operacional | Vendedor | Ninguém |
| **Vendedor** | Básico | Ninguém | Ninguém |

### Funcionalidades por Papel

| Funcionalidade | Master | Admin | Gerente | Suporte | Vendedor |
|---|:---:|:---:|:---:|:---:|:---:|
| **Dashboard** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Meus Chips** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Fila de Mensagens** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Histórico de Mensagens** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **WhatsApp Chat** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Kanban** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Leads** (todos) | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Leads** (atribuídos) | — | — | — | — | ✅ |
| **Gerenciar Usuários** | ✅ | ✅ | ✅ | ❌¹ | ❌ |
| **Criar Usuários** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Monitor de Chips** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Health Check** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Webhooks** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Templates** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Comissões Parceiros** | ✅ | ✅ | ✅ | ✅ | ✅² |
| **Relatório Comissões** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Performance** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Configurações** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Info Produtos** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Links Úteis** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Tickets** (todos) | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Tickets** (próprios) | — | — | — | — | ✅ |
| **Chat Interno** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Assistência Remota** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Logs de Auditoria** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Permissões** | ✅ | ✅ | ❌³ | ❌ | ❌ |
| **SQL/Migração** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Exportar Dados** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Master Admin** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Corban** | ✅ | ✅ | ✅ | ✅⁴ | ✅⁴ |

¹ Suporte pode criar vendedores e suporte, mas só visualiza os que criou.
² Vendedores veem apenas suas próprias vendas/comissões.
³ Gerente tem privilégios admin exceto Permissões.
⁴ Suporte e Vendedor acessam apenas funcionalidades Corban configuradas como visíveis.

### Sistema de Permissões Granulares

- **Aba "Por Cargo"**: Define quais cargos têm acesso a cada funcionalidade
- **Aba "Por Usuário"**: Concede acesso individual independente do cargo
- **Regra**: Se nenhum cargo e nenhum usuário estiver marcado, funcionalidade fica aberta a todos
- **Realtime**: Alterações refletidas automaticamente sem refresh

### RLS Consolidado

Políticas RLS usam `is_privileged()` (SECURITY DEFINER) que retorna `true` para Master, Admin e Gerente. ~60 políticas individuais consolidadas em ~30 unificadas.

---

## Dicas de Uso Seguro

1. **Comece sempre na fase "Novo"**
2. **Avance gradualmente** (3-5 dias por fase)
3. **Não desative e reative rapidamente**
4. **Use chips diferentes para fins diferentes**
5. **Monitore o dashboard**
6. **Respeite os limites** configurados
7. **Mantenha templates variados**
8. **Acompanhe o status dos chips**

---

## Documentação Relacionada

- [PRD.md](./PRD.md) — Requisitos do produto
- [ROADMAP.md](./ROADMAP.md) — Fases e prioridades
- [SYSTEM-DESIGN.md](./SYSTEM-DESIGN.md) — Arquitetura técnica
- [DATABASE-SCHEMA.md](./DATABASE-SCHEMA.md) — Schema do banco
- [SECURITY.md](./SECURITY.md) — Práticas de segurança
- [CODE-STANDARDS.md](./CODE-STANDARDS.md) — Padrões de código
- [EDGE-FUNCTIONS.md](./EDGE-FUNCTIONS.md) — Catálogo de edge functions
- [ONBOARDING.md](./ONBOARDING.md) — Guia para novos devs
- [ADR.md](./ADR.md) — Decisões arquiteturais
- [COMMISSION-REPORTS.md](./COMMISSION-REPORTS.md) — Auditoria de comissões
- [corban.md](./corban.md) — Integração NewCorban
- [UAZAPI.md](./UAZAPI.md) — Referência de endpoints
- [PENDENCIAS.md](./PENDENCIAS.md) — Changelog

---

## Comissões Parceiros V2 (sandbox de teste 🧪)

O sistema tem agora **dois módulos de Comissões Parceiros**:

- **Comissões Parceiros** (V1): em produção. Use para o dia a dia.
- **Comissões Parceiros V2 🧪**: sandbox para testar a nova fórmula de Taxas FGTS. **Não usa para pagar ninguém ainda** — só para conferir cálculos.

### Como usar V2 para teste

1. Menu lateral → **Comissões Parceiros V2 🧪**
2. Aba **Taxas FGTS** → veja as 28 taxas novas (LOTUS, HUB, FACTA, Paraná)
3. Aba **Base** → clique **📋 Copiar vendas do V1**
4. Vai aparecer "✅ Cópia concluída — X vendas processadas"
5. Aba **Extrato** → veja as mesmas vendas com a comissão recalculada pela nova fórmula
6. Compare com V1 lado a lado (abrir as duas abas no navegador)

### Quando V2 estiver validado

Vamos planejar uma migração definitiva (V2 vira produção, V1 vira backup). Esse passo só acontece com sua aprovação.

---

## Configurar Meta WhatsApp Business

Agora as credenciais da Meta (5 campos) podem ser editadas direto pela tela, sem precisar chamar dev:

1. **Admin → Integrações → Meta WhatsApp**
2. Preencha os 5 campos (instruções completas em [META-WHATSAPP-SETUP.md](./META-WHATSAPP-SETUP.md))
3. Clique **Salvar** e depois **Testar Conexão**
4. ✅ Pronto

Se em algum momento o campo ficar em branco, o sistema continua funcionando usando os valores antigos guardados em segurança (fallback automático).

📅 Atualizado em: 2026-04-23
