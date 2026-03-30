# LordCred — Instruções de Uso

## O que é o LordCred?

O LordCred é uma plataforma de aquecimento inteligente de chips WhatsApp. Ele envia mensagens de forma automática e gradual entre seus números, simulando conversas reais para que o WhatsApp reconheça seus chips como contas legítimas e ativas, reduzindo drasticamente o risco de bloqueio.

---

## Como Funciona o Aquecimento

O sistema envia mensagens automaticamente entre seus chips ao longo do dia, respeitando limites diários, horários de operação e padrões humanos de uso. A ideia é simular o comportamento de um usuário real que conversa ao longo do dia, e não de um robô que dispara mensagens em rajadas.

---

## As 5 Fases de Aquecimento

Cada chip possui uma fase de aquecimento que você define manualmente. A fase determina quantas mensagens o chip enviará por dia. Comece sempre pela fase "Novo" e vá avançando gradualmente conforme o chip amadurece.

### Novo
- **Mensagens por dia:** 5
- **Para quem:** Chips recém-ativados, que acabaram de ser conectados
- **Intervalo estimado (com 12h de operação):** ~2h24min entre mensagens
- **Com variação de ±50%:** entre ~1h12min e ~3h36min entre cada mensagem

### Iniciante
- **Mensagens por dia:** 20
- **Para quem:** Chips que já passaram os primeiros dias de ativação
- **Intervalo estimado (com 12h de operação):** ~36min entre mensagens
- **Com variação de ±50%:** entre ~18min e ~54min entre cada mensagem

### Crescimento
- **Mensagens por dia:** 50
- **Para quem:** Chips em fase de crescimento de volume
- **Intervalo estimado (com 12h de operação):** ~14min entre mensagens
- **Com variação de ±50%:** entre ~7min e ~21min entre cada mensagem

### Aquecido
- **Mensagens por dia:** 80
- **Para quem:** Chips quase prontos para volume máximo
- **Intervalo estimado (com 12h de operação):** ~9min entre mensagens
- **Com variação de ±50%:** entre ~4min30s e ~13min30s entre cada mensagem

### Maduro
- **Mensagens por dia:** 100
- **Para quem:** Chips totalmente aquecidos, prontos para uso intenso
- **Intervalo estimado (com 12h de operação):** ~7min entre mensagens
- **Com variação de ±50%:** entre ~3min30s e ~10min30s entre cada mensagem

> **Dica:** Nunca pule fases. Avance gradualmente (a cada 3-5 dias) para evitar detecção pelo WhatsApp.

---

## Distribuição Inteligente de Mensagens

As mensagens não são enviadas em intervalos fixos como um relógio. O sistema calcula o intervalo ideal entre cada mensagem baseado em:

- **Quantas mensagens ainda faltam enviar no dia**
- **Quantas horas restam no horário de operação**

Isso faz com que as mensagens sejam distribuídas naturalmente ao longo de todo o período de operação. Além disso, cada intervalo recebe uma variação aleatória de ±50%, imitando o comportamento humano imprevisível.

**Exemplo prático:**

Um chip na fase "Novo" com 5 mensagens para enviar e 15 horas de operação (8h às 23h):
- Intervalo médio = 15h ÷ 5 msgs = 3 horas entre mensagens
- Com variação de ±50%: entre 1h30min e 4h30min entre cada mensagem
- Resultado: mensagens espalhadas naturalmente ao longo do dia, impossível detectar como bot

Um chip na fase "Maduro" com 100 mensagens e 12 horas de operação (8h às 20h):
- Intervalo médio = 12h ÷ 100 msgs = ~7 minutos entre mensagens
- Com variação de ±50%: entre ~3min30s e ~10min30s
- Resultado: alta frequência mas com variação natural

---

## Proteção Anti-Bloqueio

O LordCred possui diversas camadas de proteção para evitar que seus chips sejam banidos pelo WhatsApp:

1. **Simulação de digitação:** Antes de enviar cada mensagem, o sistema simula que alguém está digitando, com velocidade proporcional ao tamanho do texto.

2. **Delay de leitura:** Após receber uma mensagem, o sistema espera alguns segundos antes de "ler" e responder, como uma pessoa real faria.

3. **Padrão humano de horários:** As mensagens são enviadas apenas dentro do horário de operação configurado, evitando envios de madrugada.

4. **Variação aleatória:** Todos os intervalos têm variação aleatória para nunca criar padrões repetitivos detectáveis.

5. **Limite por hora:** Existe um limite máximo de mensagens por hora que nunca é ultrapassado.

6. **Limite consecutivo:** O sistema evita enviar muitas mensagens seguidas para o mesmo número sem intervalo.

7. **Cooldown após erros:** Se ocorrer um erro de envio, o sistema faz uma pausa prolongada antes de tentar novamente.

8. **Redução no fim de semana:** O volume de mensagens é reduzido automaticamente nos finais de semana, como uma pessoa real que conversa menos nesses dias.

---

## Templates de Mensagens

O sistema usa uma biblioteca de mensagens pré-definidas que simulam conversas reais e naturais. As mensagens são variadas e incluem saudações, perguntas do dia-a-dia, comentários casuais, etc.

Apenas administradores podem gerenciar os templates de mensagens do sistema. As mensagens são selecionadas aleatoriamente para cada envio, garantindo que não haja repetição excessiva.

---

## Modos de Aquecimento

O sistema suporta diferentes modos de envio:

### Entre o Mesmo Usuário (same_user)
Os chips de um mesmo usuário conversam entre si. Ideal para quem tem 2 ou mais chips e quer aquecê-los mutuamente.

### Entre Usuários Diferentes (between_users)
Os chips de diferentes usuários trocam mensagens entre si. Aumenta a diversidade dos números de contato, tornando o aquecimento mais natural.

### Números Externos (external)
Os chips enviam mensagens para números externos cadastrados no sistema. Útil para simular conversas com contatos variados.

---

## Horário de Funcionamento

O aquecimento funciona apenas dentro do horário configurado pelo administrador. Por padrão:

- **Início:** 8h da manhã
- **Fim:** 20h (8h da noite)
- **Fuso horário:** America/São Paulo

Fora do horário de operação, nenhuma mensagem é enviada. Isso garante um comportamento realista, já que pessoas reais não costumam conversar de madrugada.

---

## Simulador de Volume

Na área de administração, existe um Simulador de Volume que permite visualizar quantas mensagens serão enviadas por dia considerando:

- Quantidade de chips ativos e suas fases
- Redução de fim de semana
- Limites configurados

Use o simulador para planejar a capacidade antes de adicionar novos chips.

---

## Documentação Relacionada

- [PRD.md](./PRD.md) — Requisitos do produto
- [ROADMAP.md](./ROADMAP.md) — Fases e prioridades
- [SYSTEM-DESIGN.md](./SYSTEM-DESIGN.md) — Arquitetura técnica
- [UAZAPI.md](./UAZAPI.md) — Referência de endpoints
- [PENDENCIAS.md](./PENDENCIAS.md) — Changelog

---

## Dicas de Uso Seguro

1. **Comece sempre na fase "Novo"** — Nunca conecte um chip e coloque direto na fase "Maduro". Isso levanta bandeiras vermelhas no WhatsApp.

2. **Avance gradualmente** — Espere pelo menos 3-5 dias em cada fase antes de avançar para a próxima.

3. **Não desative e reative rapidamente** — Se precisar pausar, mantenha o chip conectado mesmo que inativo.

4. **Use chips diferentes para fins diferentes** — Não misture chips de aquecimento com chips que você usa pessoalmente.

5. **Monitore o dashboard** — Acompanhe as métricas de envio e fique atento a qualquer queda na taxa de entrega.

6. **Respeite os limites** — Os limites padrão foram calibrados para segurança. Aumentá-los excessivamente pode resultar em bloqueio.

7. **Mantenha templates variados** — Quanto mais diversos os templates de mensagens, menor a chance de detecção.

8. **Acompanhe o status dos chips** — Se um chip desconectar, reconecte o mais rápido possível para manter a consistência.

---

## Matriz de Permissões por Papel

O sistema possui 5 papéis: **Master** (role `master`), **Administrador** (role `admin`), **Gerente** (role `manager`), **Suporte** (role `support`) e **Vendedor** (role `seller`).

Master, Administrador e Gerente são considerados "privilegiados" — no banco de dados, a função `is_privileged()` (SECURITY DEFINER) retorna `true` para essas três roles. Isso consolida as políticas RLS em uma única verificação.

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
| **Meus Chips** (gerenciar chips) | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Fila de Mensagens** (ver/gerenciar fila) | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Histórico de Mensagens** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **WhatsApp Chat** (conversar) | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Kanban** (ver board) | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Kanban** (gerenciar colunas/cards) | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Leads** (ver/gerenciar todos) | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Leads** (ver só atribuídos) | — | — | — | — | ✅ |
| **Gerenciar Usuários** (criar/editar/bloquear) | ✅ | ✅ | ✅ | ❌¹ | ❌ |
| **Criar Usuários** (vendedor/suporte) | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Monitor de Chips** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Health Check de Chips** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Diagnóstico de Webhooks** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Templates de Mensagens** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Comissões Parceiros** | ✅ | ✅ | ✅ | ✅ | ✅² |
| **Performance** (métricas) | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Configurações do Sistema** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Info Produtos** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Links Úteis** (gerenciar) | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Tickets de Suporte** (gerenciar todos) | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Tickets de Suporte** (criar/ver próprios) | — | — | — | — | ✅ |
| **Chat Interno** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Assistência Remota** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Logs de Auditoria** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Permissões do Sistema** | ✅ | ✅ | ❌³ | ❌ | ❌ |
| **SQL/Migração** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Exportar Dados** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Master Admin** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Corban (todas as funções)** | ✅ | ✅ | ✅ | ✅⁴ | ✅⁴ |

¹ Suporte pode criar usuários (vendedores e suporte) mas só visualiza os que criou. Não pode editar, bloquear ou excluir contas de outros.

² Vendedores podem visualizar apenas suas próprias vendas/comissões.

³ Gerente tem todos os privilégios de admin **exceto** a página de Permissões, que é restrita a Master e Administrador.

⁴ Suporte e Vendedor acessam apenas as funcionalidades Corban configuradas como visíveis para seu papel.

### Sistema de Permissões Granulares

Além da matriz de permissões por papel, o sistema possui controle granular via tabela `feature_permissions`:

- **Aba "Por Cargo"**: Define quais cargos (Vendedor, Suporte, Gerente) têm acesso a cada funcionalidade. Master e Admin sempre têm acesso total.
- **Aba "Por Usuário"**: Permite conceder acesso individual a usuários específicos, independente do cargo.
- **Regra**: Se nenhum cargo e nenhum usuário estiver marcado para uma funcionalidade, ela fica aberta a todos (backward compatibility).
- **Realtime**: Alterações nas permissões são refletidas automaticamente no menu lateral sem necessidade de refresh.

### RLS Consolidado

As políticas de Row-Level Security utilizam a função `is_privileged()` (SECURITY DEFINER) que retorna `true` para Master, Admin e Gerente. Isso consolidou ~60 políticas individuais em ~30 políticas unificadas, simplificando manutenção e garantindo consistência.
