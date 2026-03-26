# NewCorban API V1 — Documentação de Integração

## Visão Geral

A API V1 da NewCorban permite integrar sistemas externos com a plataforma de gestão de propostas de crédito consignado. Todos os endpoints usam **POST** e a autenticação é via body.

**URL Base:** `{{url}}/api/propostas/`

## Autenticação

Todas as requisições incluem no body:

```json
{
  "auth": {
    "username": "{{username}}",
    "password": "{{password}}",
    "empresa": "{{empresa}}"
  }
}
```

> **Pré-requisito:** Criar um usuário com perfil **robô** no menu **Empresa → Usuários** da plataforma NewCorban. O usuário pode estar INATIVO.

## Variáveis de Ambiente Necessárias

| Variável     | Descrição                      |
|-------------|--------------------------------|
| `url`       | URL base da API NewCorban      |
| `username`  | Usuário robô cadastrado        |
| `password`  | Senha do usuário robô          |
| `empresa`   | Identificador da empresa       |

---

## Endpoints Disponíveis

### 1. Consultar Propostas (`getPropostas`)

Consulta propostas com filtros avançados.

```json
{
  "auth": { ... },
  "requestType": "getPropostas",
  "filters": {
    "status": ["1684", "1709"],
    "bancos": ["935"],
    "promotoras": [],
    "convenios": [],
    "produtos": [],
    "equipes": [],
    "origens": [],
    "tabelas": [],
    "franquias": [],
    "data": {
      "startDate": "2024-09-01",
      "endDate": "2024-09-30"
    },
    "searchString": "41253417881"
  }
}
```

**Filtros disponíveis:**
- `status` — IDs de status (usar `getAssets` para listar)
- `bancos` — IDs de bancos
- `promotoras`, `convenios`, `produtos`, `equipes`, `origens`, `tabelas`, `franquias` — arrays de IDs
- `data.startDate / endDate` — período (formato `YYYY-MM-DD`)
- `searchString` — busca por CPF ou telefone

---

### 2. Listas Operacionais (`getAssets`)

Obtém parâmetros auxiliares para filtros.

```json
{
  "auth": { ... },
  "requestType": "getAssets",
  "asset": "status"
}
```

**Assets disponíveis:**
- `status` — lista de status de propostas
- `bancos` — lista de bancos/instituições
- `promotoras` — lista de promotoras
- `convenios` — lista de convênios
- `produtos` — lista de produtos
- `equipes` — lista de equipes
- `origens` — lista de origens
- `tabelas` — lista de tabelas
- `franquias` — lista de franquias

---

### 3. Listar Logins (`listLogins`)

Lista logins disponíveis por instituição (necessário para fila FGTS).

```json
{
  "auth": { ... },
  "requestType": "listLogins",
  "instituicao": "facta"
}
```

---

### 4. Incluir na Fila FGTS (`insertQueueFGTS`)

Adiciona um CPF na fila de consulta FGTS.

```json
{
  "auth": { ... },
  "requestType": "insertQueueFGTS",
  "content": {
    "cpf": "41253417881",
    "instituicao": "facta",
    "loginId": "123"
  }
}
```

---

### 5. Listar Fila FGTS (`listQueueFGTS`)

Lista a fila de consultas FGTS com filtros.

```json
{
  "auth": { ... },
  "requestType": "listQueueFGTS",
  "filters": {
    "data": {
      "startDate": "2024-09-25",
      "endDate": "2024-09-25"
    },
    "instituicao": "facta",
    "searchString": "11940034771"
  }
}
```

---

### 6. Criar Proposta (`createProposta`)

Cria uma proposta completa com dados pessoais, documentos, endereços, telefones e dados bancários.

```json
{
  "auth": { ... },
  "requestType": "createProposta",
  "content": {
    "cliente": {
      "pessoais": {
        "cpf": "123456789",
        "nome": "Nome do Cliente",
        "nascimento": "1999-03-29",
        "sexo": "MASCULINO",
        "estado_civil": "SOLTEIRO",
        "nacionalidade": "BRASILEIRO",
        "mae": "NOME DA MAE",
        "pai": "NOME DO PAI",
        "renda": 1412,
        "email": "email@exemplo.com",
        "falecido": false,
        "nao_perturbe": false,
        "analfabeto": false
      },
      "documentos": [
        {
          "numero": "12345678",
          "tipo": "RG",
          "data_emissao": "2022-04-09",
          "uf": "SP"
        }
      ],
      "enderecos": [
        {
          "cep": "03545000",
          "logradouro": "RUA OSVALDO NEVOLA",
          "numero": "806",
          "bairro": "JARDIM TIETE",
          "cidade": "SAO PAULO",
          "estado": "Sao Paulo",
          "uf": "SP",
          "complemento": ""
        }
      ],
      "telefones": [
        { "ddd": "11", "numero": "940034771" }
      ]
    },
    "proposta": {
      "documento_id": "12345678",
      "endereco_id": "03545000",
      "telefone_id": "940034771",
      "banco_id": "935",
      "convenio_id": "100000",
      "produto_id": "7",
      "status": "0",
      "tipo_cadastro": "API",
      "tipo_liberacao": "CONTA_CORRENTE",
      "banco_averbacao": "237",
      "conta": "123456789",
      "conta_digito": "3",
      "agencia": "0001",
      "valor_parcela": 0,
      "valor_financiado": 113.04,
      "valor_liberado": 113.04,
      "prazos": 5,
      "taxa": 1.80
    }
  }
}
```

---

## Integração com LordCred — Possibilidades

### Fase 1: Leitura (baixo risco)
1. **Importar Assets** — Sincronizar bancos, status, produtos para popular campos do `Info Produtos` automaticamente
2. **Consultar Propostas** — Buscar propostas por CPF do lead e exibir status na tela de WhatsApp ou Leads
3. **Consultar Fila FGTS** — Verificar se lead já está na fila FGTS

### Fase 2: Escrita (médio risco)
4. **Incluir na Fila FGTS** — Botão no lead para consultar FGTS automaticamente via NewCorban
5. **Criar Proposta** — Criar proposta direto da tela do lead usando dados já preenchidos (CPF, nome, telefone, etc.)

### Fase 3: Automação (alto valor)
6. **Monitoramento de Status** — Polling periódico de propostas para atualizar status do lead automaticamente
7. **Webhook reverso** — Se a NewCorban suportar, receber notificações de mudança de status

### Mapeamento de Dados (LordCred → NewCorban)

| Campo LordCred (`client_leads`) | Campo NewCorban                   |
|----------------------------------|-----------------------------------|
| `cpf`                            | `pessoais.cpf`                    |
| `nome`                           | `pessoais.nome`                   |
| `data_nasc`                      | `pessoais.nascimento`             |
| `nome_mae`                       | `pessoais.mae`                    |
| `telefone`                       | `telefones[0].ddd` + `.numero`    |
| `valor_lib`                      | `proposta.valor_liberado`         |
| `vlr_parcela`                    | `proposta.valor_parcela`          |
| `prazo`                          | `proposta.prazos`                 |
| `banco_codigo`                   | `proposta.banco_id`               |
| `banco_nome`                     | (via `getAssets("bancos")`)       |
| `agencia`                        | `proposta.agencia`                |
| `conta`                          | `proposta.conta`                  |

### Configuração Necessária

Para integrar, será necessário:
1. Adicionar campos em `system_settings`: `corban_api_url`, `corban_username`, `corban_password`, `corban_empresa`
2. Criar Edge Function `corban-api` como proxy seguro (credenciais ficam no servidor)
3. Criar tela de configuração em Admin > Configurações para salvar credenciais
4. Adicionar botões contextuais na tela de Leads e WhatsApp

### Segurança

- Credenciais da NewCorban **NUNCA** ficam no frontend
- Edge Function atua como proxy, validando JWT do usuário antes de repassar
- Apenas roles `master`, `admin`, `support` podem executar ações de escrita
- Logs de todas as ações em `audit_logs`
