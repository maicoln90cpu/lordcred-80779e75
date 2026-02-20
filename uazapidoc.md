Documentação da API
uazapiGO - WhatsApp API (v2.0)
Versão da especificação: 1.0.0
OpenAPI: 3.1.0
Gerado automaticamente a partir de `uazapi-openapi-spec.yaml`.
Sumário
Sumário 2
Visão geral 9
⚠️ Recomendação Importante: WhatsApp Business . . . . . . . . . . . . . . . . . . . . . . . . . 9
Autenticação . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 9
Estados da Instância . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 9
Limites de Uso . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 9
Escopo deste documento . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 9
Servidores 10
Autenticação e segurança 11
Mapa de endpoints 12
Top 10 tags por volume . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 12
Endpoints 13
ChatBot 14
Recursos de IA incluídos: . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 14
Casos de uso: . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 14
Chatbot Configurações . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 14
Chatbot Trigger . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 16
Configuração do Agente de IA . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 18
Documentação dos Campos de Configuração 18
Campos Básicos . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 18
Nome e Identificação . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 18
Configuração do Modelo . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 19
Configurações de Comportamento . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 20
Prompt Base (basePrompt) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 20
Parâmetros de Geração . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 20
Configurações de Interação . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 21
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 3
Mensagens . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 21
Exemplos de Configuração . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 21
Assistente de Vendas . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 21
Suporte Técnico . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 22
Dicas de Otimização . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 22
Conhecimento dos Agentes . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 24
Funções API dos Agentes . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 26
Configuração de Funções de API para Agentes IA 26
1. Estrutura Base da Função . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 26
Campos Principais . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 26
Detalhamento dos Campos . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 27
2. Configuração de Parâmetros . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 28
Estrutura do Parâmetro . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 28
Tipos de Parâmetros . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 28
3. Sistema de Validação . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 30
Validações Automáticas . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 30
Erros e Avisos . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 30
4. Exemplo Completo . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 30
API Principal 34
Admininstração 35
 Configuração Simples (Recomendada) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 38
 Sites para Testes (ordenados por qualidade) . . . . . . . . . . . . . . . . . . . . . . . . . . . . 38
Funcionalidades Principais: . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 39
Instancia 41
Proxy 50
Perfil 53
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 4
Business 55
Chamadas 60
Webhooks e SSE 63
 Modo Simples (Recomendado) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 64
 Sites para Testes (ordenados por qualidade) . . . . . . . . . . . . . . . . . . . . . . . . . . . . 65
⚙️ Modo Avançado (Para múltiplos webhooks) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 65
Eventos Disponíveis . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 65
Funcionalidades Principais: . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 67
Enviar Mensagem 71
Campos Opcionais Comuns . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 71
Envio para Grupos . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 72
Placeholders Disponíveis . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 72
Campos de Nome . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 72
Campos do WhatsApp . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 72
Campos do Lead . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 73
Campos Personalizados . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 73
Exemplo de Uso . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 73
Recursos Específicos . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 74
Campos Comuns . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 74
Preview de Links . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 74
Preview Automático . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 74
Preview Personalizado . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 75
Tipos de Mídia Suportados . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 76
Recursos Específicos . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 76
Campos Comuns . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 76
Exemplos Básicos . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 76
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 5
Imagem Simples . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 76
Documento com Nome . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 77
Recursos Específicos . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 78
Campos Comuns . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 78
Exemplo Básico . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 78
Recursos Específicos . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 79
Campos Comuns . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 79
Exemplo Básico . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 79
 Comportamento Assíncrono: . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 80
 Tipos de presença suportados: . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 80
️ Controle de duração: . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 81
 Exemplos de uso: . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 81
Digitar por 30 segundos: . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 81
Gravar áudio por 1 minuto: . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 81
Cancelar presença atual: . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 81
Usar limite máximo (5 minutos): . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 82
Tipos de Status . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 82
Cores de Fundo . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 83
Fontes (para texto) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 83
Limites . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 83
Exemplo . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 83
Estrutura Base do Payload . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 84
Tipos de Mensagens Interativas . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 85
1. Botões (type: "button") . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 85
2. Listas (type: "list") . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 87
3. Enquetes (type: "poll") . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 88
4. Carousel (type: "carousel") . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 88
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 6
Termos de uso . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 89
Alternativas e Compatibilidade . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 89
Campos Comuns . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 90
Estrutura do Payload . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 91
Tipos de Botões . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 91
Exemplo de Botões . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 92
Exemplo Completo de Carrossel . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 93
Campos Comuns . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 95
Estrutura do Payload . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 95
Exemplo de Uso . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 95
Como funciona . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 96
Campos comuns . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 96
Regras principais . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 97
Campos comuns . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 97
Exemplo de payload . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 97
Ações na mensagem e Buscar 99
Parâmetros . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 99
Exemplos . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 100
Baixar áudio como MP3: . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 100
Transcrever áudio: . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 100
Apenas base64 (sem salvar): . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 100
Baixar mídia de status (mensagem citada): . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 100
Resposta . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 101
Funcionalidades: . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 107
Chats 110
Contatos 115
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 7
Funcionalidades: . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 118
Campos Retornados: . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 118
Funcionalidades: . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 119
Bloqueios 121
Etiquetas 123
Grupos e Comunidades 125
Detalhes . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 125
Limitações . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 126
Comportamento . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 126
Funcionalidades . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 137
Limitações . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 137
Ações Disponíveis . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 137
Respostas Rápidas 138
Como funciona: . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 138
Casos de uso: . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 138
CRM 140
Recursos disponíveis: . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 140
 Placeholders em mensagens: . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 140
Fluxo típico: . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 140
Mensagem em massa 145
Ações Disponíveis: . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 146
Status de Campanhas: . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 147
Integração Chatwoot 150
Recursos disponíveis: . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 150
️ Sistema de Nomes Inteligentes: . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 150
⚠️ Limitações conhecidas: . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 150
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 8
Casos de uso: . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 150
Funcionalidades: . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 151
Funcionalidades: . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 152
Configuração no Chatwoot: . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 152
️ Sistema de Nomes Inteligentes: . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 152
 AVISO IMPORTANTE - INTEGRAÇÃO BETA: . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 152
⚠️ Limitações Conhecidas: . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 153
Modelos de dados (Schemas) 154
Instance 155
Webhook 157
Chat 158
Message 161
Label 163
Attendant 164
ChatbotTrigger 165
ChatbotAIAgent 167
ChatbotAIFunction 169
ChatbotAIKnowledge 170
MessageQueueFolder 171
QuickReply 172
Group 173
GroupParticipant 175
WebhookEvent 176
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 9
Visão geral
API para gerenciamento de instâncias do WhatsApp e comunicações.
⚠️ Recomendação Importante: WhatsApp Business
É ALTAMENTE RECOMENDADO usar contas do WhatsApp Business em vez do WhatsApp
normal para integração, o WhatsApp normal pode apresentar inconsistências, desconexões,
limitações e instabilidades durante o uso com a nossa API.
Autenticação
• Endpoints regulares requerem um header 'token' com o token da instância
• Endpoints administrativos requerem um header 'admintoken'
Estados da Instância
As instâncias podem estar nos seguintes estados:
• disconnected: Desconectado do WhatsApp
• connecting: Em processo de conexão
• connected: Conectado e autenticado com sucesso
Limites de Uso
• O servidor possui um limite máximo de instâncias conectadas
• Quando o limite é atingido, novas tentativas receberão erro 429
• Servidores gratuitos/demo podem ter restrições adicionais de tempo de vida
Escopo deste documento
Este PDF foi gerado automaticamente a partir do arquivo OpenAPI
(`uazapi-openapi-spec.yaml`). Ele descreve endpoints, parâmetros, corpos de requisição,
respostas e modelos de dados conforme definido na especificação.
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 10
Servidores
https://{subdomain}.uazapi.com
Servidor da API uazapiGO
Variável Valores Padrão Descrição
subdomain free, api free
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 11
Autenticação e segurança
A API utiliza autenticação via *API key* em headers HTTP.
Nome Em Header Descrição
token header token
admintoken header admintoken Token de administrador para endpoints
administrativos
Segurança padrão: token
Alguns endpoints podem sobrescrever a regra padrão (por exemplo, exigir `admintoken` ou
não exigir autenticação).
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 12
Mapa de endpoints
Total de endpoints: 103 • Total de paths: 96 • Total de tags: 23
Top 10 tags por volume
Tag Endpoints
Grupos e Comunidades 16
Enviar Mensagem 11
Instancia 8
Business 8
Mensagem em massa 7
Ações na mensagem e Buscar 6
Chats 6
Contatos 6
Admininstração 5
Proxy 3
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 13
Endpoints
A seguir, os endpoints estão organizados por grupos e tags, com uma tabela-resumo e o
detalhamento de cada operação.
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 14
ChatBot
Sistema avançado de chatbots com inteligência artificial
Esta categoria contém recursos sofisticados para criar chatbots inteligentes e automatizar
conversas usando IA. Ideal para empresas que precisam de atendimento automatizado
avançado e respostas contextuais.
Recursos de IA incluídos:
•  IA Conversacional: Integração com múltiplos provedores (OpenAI, Anthropic, Google,
DeepSeek)
•  Base de Conhecimento: Sistema de embeddings com Qdrant para respostas contextuais
• ⚙️ Funções Personalizadas: Integração com APIs externas e lógica de negócio complexa
•  Triggers Inteligentes: Ativação automática baseada em contexto e palavras-chave
•  Configurações Avançadas: Personalização completa do comportamento do bot
Casos de uso:
• Atendimento automatizado 24/7
• Qualificação automática de leads
• Suporte técnico com base de conhecimento
• Agendamento de reuniões e consultas
• FAQ dinâmico e contextual
Ideal para: Empresas médias/grandes, desenvolvedores, agências, sistemas de atendimento
complexos
Requer: Conhecimento técnico para configuração adequada e chaves de API dos provedores
de IA
Chatbot Configurações
Resumo dos endpoints
Método Path Resumo
POST /instance/updatechatbotsetting
s
Chatbot Configurações
POST /instance/updatechatbotsettings
Chatbot Configurações
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 15
operationId updateChatbotSettings
Tag Chatbot Configurações
Segurança token
Explicação dos campos:
• openai_apikey: Chave da API OpenAI (começa com "sk-")
• chatbot_enabled: Habilita/desabilita o chatbot
• chatbot_ignoreGroups: Define se o chatbot deve ignorar mensagens de grupos
• chatbot_stopConversation: Palavra-chave que os usuários podem usar para parar o
chatbot
• chatbot_stopMinutes: Por quantos minutos o chatbot deve ficar desativado após receber
o comando de parada
• chatbot_stopWhenYouSendMsg: Por quantos minutos o chatbot deve ficar desativado após
você enviar uma mensagem fora da API, 0 desliga.
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Não
Respostas
Status Descrição Schema
200 Sucesso Instance
401 Token inválido/expirado
404 Instância não encontrada
500 Erro interno
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 16
Chatbot Trigger
Resumo dos endpoints
Método Path Resumo
POST /trigger/edit Criar, atualizar ou excluir um trigger do
chatbot
GET /trigger/list Listar todos os triggers do chatbot
POST /trigger/edit
Criar, atualizar ou excluir um trigger do chatbot
operationId editTrigger
Tag Chatbot Trigger
Segurança token
Endpoint para gerenciar triggers do chatbot. Suporta:
• Criação de novos triggers
• Atualização de triggers existentes
• Exclusão de triggers por ID
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Trigger atualizado com sucesso ChatbotTrigger
201 Trigger criado com sucesso ChatbotTrigger
400 Corpo da requisição inválido ou campos obrigatórios
ausentes
object
404 Trigger não encontrado object
500 Erro no servidor object
GET /trigger/list
Listar todos os triggers do chatbot
operationId listTriggers
Tag Chatbot Trigger
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 17
Segurança token
Retorna a lista completa de triggers configurados para a instância atual
Respostas
Status Descrição Schema
200 Lista de triggers retornada com sucesso array[ChatbotTrigger]
401 Não autorizado object
500 Erro no servidor object
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 18
Configuração do Agente de IA
Resumo dos endpoints
Método Path Resumo
POST /agent/edit Criar/Editar Agente
GET /agent/list Todos os agentes
POST /agent/edit
Criar/Editar Agente
operationId editAgent
Tag Configuração do Agente de IA
Segurança token
Documentação dos Campos de
Configuração
Campos Básicos
Nome e Identificação
O agente precisa ser configurado com informações básicas que determinam sua identidade e
funcionamento.
#### Nome do Agente
name: Define como o agente será identificado nas conversas.
Exemplos válidos:
• "Assistente de Vendas"
• "Suporte Técnico"
• "João"
• "Maria"
#### Provedor do Serviço
provider: Especifica qual serviço de IA será utilizado.
Provedores disponíveis:
• "openai" (ChatGPT)
• "anthropic" (Claude)
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 19
• "gemini" (Google)
• "deepseek" (DeepSeek)
#### Chave de API
apikey: Credencial necessária para autenticação com o provedor escolhido.
• Deve ser obtida através do site oficial do provedor selecionado
• Mantenha esta chave em segurança e nunca a compartilhe
Configuração do Modelo
#### Seleção do Modelo
model: Especifica qual modelo de IA será utilizado. A disponibilidade depende do provedor
selecionado.
##### OpenAI
Documentação: https://platform.openai.com/docs/models
• gpt-4o
• gpt-4o-mini
• gpt-3.5-turbo
##### Claude
Documentação: https://docs.anthropic.com/en/docs/about-claude/models
• claude-3-5-sonnet-latest
• claude-3-5-haiku-latest
• claude-3-opus-latest
##### Gemini
Documentação: https://ai.google.dev/models/gemini
• gemini-2.0-flash-exp
• gemini-1.5-pro
• gemini-1.5-flash
##### DeepSeek
Documentação: https://api-docs.deepseek.com/quick_start/pricing
• deepseek-chat
• deepseek-reasoner
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 20
Configurações de Comportamento
Prompt Base (basePrompt)
Instruções iniciais para definir o comportamento do agente
Exemplo para assistente de vendas:
"Você é um assistente especializado em vendas, focado em ajudar clientes a encontrar os
produtos ideais. Mantenha um tom profissional e amigável."
Exemplo para suporte:
"Você é um agente de suporte técnico especializado em nossos produtos. Forneça respostas
claras e objetivas para ajudar os clientes a resolverem seus problemas."
Parâmetros de Geração
• temperature: Controla a criatividade das respostas (0-100)
• 0-30: Respostas mais conservadoras e precisas
• 30-70: Equilíbrio entre criatividade e precisão
• 70-100: Respostas mais criativas e variadas
• maxTokens: Limite máximo de tokens por resposta
• Recomendado: 1000-4000 para respostas detalhadas
• Para respostas curtas: 500-1000
• Limite máximo varia por modelo
• diversityLevel: Controla a diversidade das respostas (0-100)
• Valores mais altos geram respostas mais variadas
• Recomendado: 30-70 para uso geral
• frequencyPenalty: Penalidade para repetição de palavras (0-100)
• Valores mais altos reduzem repetições
• Recomendado: 20-50 para comunicação natural
• presencePenalty: Penalidade para manter foco no tópico (0-100)
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 21
• Valores mais altos incentivam mudanças de tópico
• Recomendado: 10-30 para manter coerência
Configurações de Interação
Mensagens
• signMessages: Se verdadeiro, adiciona a assinatura do agente nas mensagens
• Útil para identificar quem está enviando a mensagem
• readMessages: Se verdadeiro, marca as mensagens como lidas ao responder
• Recomendado para simular comportamento humano
Exemplos de Configuração
Assistente de Vendas
``` json
{
"name": "Assistente de Vendas",
"provider": "openai",
"model": "gpt-4",
"basePrompt": "Você é um assistente de vendas especializado...",
"temperature": 70,
"maxTokens": 2000,
"diversityLevel": 50,
"frequencyPenalty": 30,
"presencePenalty": 20,
"signMessages": true,
"readMessages": true
}
```
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 22
Suporte Técnico
``` json
{
"name": "Suporte Técnico",
"provider": "anthropic",
"model": "claude-3-sonnet-20240229",
"basePrompt": "Você é um agente de suporte técnico...",
"temperature": 30,
"maxTokens": 3000,
"diversityLevel": 40,
"frequencyPenalty": 40,
"presencePenalty": 15,
"signMessages": true,
"readMessages": true
}
```
Dicas de Otimização
1. Ajuste Gradual: Comece com valores moderados e ajuste conforme necessário
2. Teste o Base Prompt: Verifique se as instruções estão claras e completas
3. Monitore o Desempenho: Observe as respostas e ajuste os parâmetros para melhor
adequação
4. Backup: Mantenha um backup das configurações que funcionaram bem
5. Documentação: Registre as alterações e seus impactos para referência futura
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Não
Respostas
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 23
Status Descrição Schema
200 Agente atualizado com sucesso ChatbotAIAgent
201 Novo agente criado com sucesso ChatbotAIAgent
400 Erro na requisição object
401 Não autorizado object
404 Agente não encontrado object
500 Erro interno do servidor object
GET /agent/list
Todos os agentes
operationId listAgents
Tag Configuração do Agente de IA
Segurança token
Respostas
Status Descrição Schema
200 Lista de todos os agentes de IA array[ChatbotAIAgent]
401 Sessão não encontrada object
500 Erro ao buscar agentes object
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 24
Conhecimento dos Agentes
Resumo dos endpoints
Método Path Resumo
POST /knowledge/edit Criar/Editar Conhecimento do Agente
GET /knowledge/list Listar Base de Conhecimento
POST /knowledge/edit
Criar/Editar Conhecimento do Agente
operationId editKnowledge
Tag Conhecimento dos Agentes
Segurança token
Gerencia o conhecimento base usado pelos agentes de IA para responder consultas.
O conhecimento pode ser fornecido como texto direto ou através de arquivos PDF/CSV.
Características principais:
• Suporta criação, edição e exclusão de conhecimento
• Aceita conteúdo em:
• Texto puro
• URLs públicas
• Base64 encoded de arquivos
• Upload direto de arquivos
• Formatos suportados: PDF, CSV, TXT, HTML
• Processa automaticamente qualquer formato de entrada
• Vetoriza automaticamente o conteúdo para busca semântica
Nota sobre URLs e Base64:
• URLs devem ser públicas e acessíveis
• Para PDFs/CSVs, especifique fileType se não for detectável da extensão
• Base64 deve incluir o encoding completo do arquivo
• O servidor detecta e processa automaticamente conteúdo Base64
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Não
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 25
Respostas
Status Descrição Schema
200 Conhecimento atualizado com sucesso ChatbotAIKnowledge
201 Novo conhecimento criado com sucesso ChatbotAIKnowledge
400 Requisição inválida
404 Conhecimento não encontrado
500 Erro interno do servidor
GET /knowledge/list
Listar Base de Conhecimento
operationId listKnowledge
Tag Conhecimento dos Agentes
Segurança token
Retorna todos os conhecimentos cadastrados para o agente de IA da instância.
Estes conhecimentos são utilizados pelo chatbot para responder perguntas
e interagir com os usuários de forma contextualizada.
Respostas
Status Descrição Schema
200 Lista de conhecimentos recuperada com sucesso array[ChatbotAIKnowledg
e]
401 Token de autenticação ausente ou inválido
500 Erro interno do servidor ao buscar conhecimentos
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 26
Funções API dos Agentes
Resumo dos endpoints
Método Path Resumo
POST /function/edit Criar/Editar função para integração com APIs
externas
GET /function/list Lista todas as funções de API
POST /function/edit
Criar/Editar função para integração com APIs externas
operationId editFunction
Tag Funções API dos Agentes
Segurança token
Configuração de Funções de API para
Agentes IA
Documentação para criar/editar funções utilizadas pelos agentes de IA para integração com
APIs externas. Inclui validação automática e controle de ativação.
1. Estrutura Base da Função
Campos Principais
```json
{
"name": "nomeDaFuncao",
"description": "Descrição detalhada",
"active": true,
"method": "POST",
"endpoint": "https://api.exemplo.com/recurso",
"headers": {},
"body": {},
"parameters": []
}
```
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 27
Detalhamento dos Campos
#### name
• Identificador único e descritivo
• Sem espaços ou caracteres especiais
• Ex: "createProduct", "updateUserStatus"
#### description
• Propósito e funcionamento da função
• Inclua casos de uso e resultados esperados
• Ex: "Cria produto no catálogo com nome, preço e categoria"
#### active
• Controla disponibilidade da função
• Desativa automaticamente se houver erros
• Default: false
#### method
• GET: buscar dados
• POST: criar recurso
• PUT: atualizar completo
• PATCH: atualização parcial
• DELETE: remover recurso
#### endpoint
• URL completa da API
• Aceita placeholders: {{variavel}}
• Exemplos:
```
https://api.exemplo.com/produtos
https://api.exemplo.com/usuarios/{{userId}}
https://api.exemplo.com/busca?q={{query}}&limit={{limit}}
```
#### headers
```json
{
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 28
"Authorization": "Bearer {{apiKey}}",
"Content-Type": "application/json",
"Accept": "application/json"
}
```
#### body (POST/PUT/PATCH)
```json
{
"name": "{{productName}}",
"price": "{{price}}",
"metadata": {
"tags": "{{tags}}"
}
}
```
2. Configuração de Parâmetros
Estrutura do Parâmetro
```json
{
"name": "nomeParametro",
"type": "string",
"description": "Descrição do uso",
"required": true,
"enum": "valor1,valor2,valor3",
"minimum": 0,
"maximum": 100
}
```
Tipos de Parâmetros
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 29
#### String
```json
{
"name": "status",
"type": "string",
"description": "Status do pedido",
"required": true,
"enum": "pending,processing,completed"
}
```
#### Número
```json
{
"name": "price",
"type": "number",
"description": "Preço em reais",
"required": true,
"minimum": 0.01,
"maximum": 99999.99
}
```
#### Inteiro
```json
{
"name": "quantity",
"type": "integer",
"description": "Quantidade",
"minimum": 0,
"maximum": 1000
}
```
#### Boolean
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 30
```json
{
"name": "active",
"type": "boolean",
"description": "Status de ativação"
}
```
3. Sistema de Validação
Validações Automáticas
1. JSON
• Headers e body devem ser válidos
• Erros desativam a função
2. Placeholders ({{variavel}})
• Case-sensitive
• Devem ter parâmetro correspondente
3. Parâmetros
• Nomes únicos
• Tipos corretos
• Limites numéricos válidos
• Enums sem valores vazios
Erros e Avisos
• Função desativa se houver:
• JSON inválido
• Parâmetros não documentados
• Violações de tipo
• Erros aparecem em undocumentedParameters
4. Exemplo Completo
```json
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 31
{
"name": "createProduct",
"description": "Criar novo produto no catálogo",
"active": true,
"method": "POST",
"endpoint": "https://api.store.com/v1/products",
"headers": {
"Authorization": "Bearer {{apiKey}}",
"Content-Type": "application/json"
},
"body": {
"name": "{{productName}}",
"price": "{{price}}",
"category": "{{category}}"
},
"parameters": [
{
"name": "apiKey",
"type": "string",
"description": "Chave de API",
"required": true
},
{
"name": "productName",
"type": "string",
"description": "Nome do produto",
"required": true
},
{
"name": "price",
"type": "number",
"description": "Preço em reais",
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 32
"required": true,
"minimum": 0.01
},
{
"name": "category",
"type": "string",
"description": "Categoria do produto",
"required": true,
"enum": "electronics,clothing,books"
}
]
}
```
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Função atualizada com sucesso ChatbotAIFunction
201 Nova função criada com sucesso ChatbotAIFunction
400 Erro de validação nos dados fornecidos object
404 Função não encontrada
500 Erro interno do servidor
GET /function/list
Lista todas as funções de API
operationId listFunctions
Tag Funções API dos Agentes
Segurança token
Retorna todas as funções de API configuradas para a instância atual
Respostas
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 33
Status Descrição Schema
200 Lista de funções recuperada com sucesso array[ChatbotAIFunction]
500 Erro interno do servidor object
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 34
API Principal
Demais endpoints fora do grupo ChatBot.
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 35
Admininstração
Endpoints para administração geral do sistema.
Requerem um admintoken para autenticação.
Resumo dos endpoints
Método Path Resumo
POST /instance/init Criar Instancia
GET /instance/all Listar todas as instâncias
POST /instance/updateAdminFields Atualizar campos administrativos
GET /globalwebhook Ver Webhook Global
POST /globalwebhook Configurar Webhook Global
POST /instance/init
Criar Instancia
operationId initInstance
Tag Admininstração
Segurança admintoken
Cria uma nova instância do WhatsApp. Para criar uma instância você precisa:
1. Ter um admintoken válido
2. Enviar pelo menos o nome da instância
3. A instância será criada desconectada
4. Será gerado um token único para autenticação
Após criar a instância, guarde o token retornado pois ele será necessário
para todas as outras operações.
Estados possíveis da instância:
• disconnected: Desconectado do WhatsApp
• connecting: Em processo de conexão
• connected: Conectado e autenticado
Campos administrativos (adminField01/adminField02) são opcionais e podem ser usados
para armazenar metadados personalizados.
OS valores desses campos são vísiveis para o dono da instancia via token, porém apenas o
administrador da api (via admin token) pode editá-los.
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 36
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Sucesso object
401 Token inválido/expirado
404 Instância não encontrada
500 Erro interno
GET /instance/all
Listar todas as instâncias
operationId listAllInstances
Tag Admininstração
Segurança admintoken
Retorna uma lista completa de todas as instâncias do sistema, incluindo:
• ID e nome de cada instância
• Status atual (disconnected, connecting, connected)
• Data de criação
• Última desconexão e motivo
• Informações de perfil (se conectado)
Requer permissões de administrador.
Respostas
Status Descrição Schema
200 Lista de instâncias retornada com sucesso array[Instance]
401 Token inválido ou expirado object
403 Token de administrador inválido object
500 Erro interno do servidor object
POST /instance/updateAdminFields
Atualizar campos administrativos
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 37
operationId updateAdminFields
Tag Admininstração
Segurança admintoken
Atualiza os campos administrativos (adminField01/adminField02) de uma instância.
Campos administrativos são opcionais e podem ser usados para armazenar metadados
personalizados.
Estes campos são persistidos no banco de dados e podem ser utilizados para integrações
com outros sistemas ou para armazenamento de informações internas.
OS valores desses campos são vísiveis para o dono da instancia via token, porém apenas o
administrador da api (via admin token) pode editá-los.
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Campos atualizados com sucesso Instance
401 Token de administrador inválido
404 Instância não encontrada
500 Erro interno
GET /globalwebhook
Ver Webhook Global
operationId getGlobalWebhook
Tag Admininstração
Segurança admintoken
Retorna a configuração atual do webhook global, incluindo:
• URL configurada
• Eventos ativos
• Filtros aplicados
• Configurações adicionais
Exemplo de resposta:
```json
{
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 38
"enabled": true,
"url": "https://example.com/webhook",
"events": ["messages", "messages_update"],
"excludeMessages": ["wasSentByApi", "isGroupNo"],
"addUrlEvents": true,
"addUrlTypesMessages": true
}
```
Respostas
Status Descrição Schema
200 Configuração atual do webhook global Webhook
401 Token de administrador não fornecido object
403 Token de administrador inválido ou servidor demo object
404 Webhook global não encontrado object
POST /globalwebhook
Configurar Webhook Global
operationId updateGlobalWebhook
Tag Admininstração
Segurança admintoken
Configura um webhook global que receberá eventos de todas as instâncias.
 Configuração Simples (Recomendada)
Para a maioria dos casos de uso:
• Configure apenas URL e eventos desejados
• Modo simples por padrão (sem complexidade)
• Recomendado: Sempre use "excludeMessages": ["wasSentByApi"] para evitar loops
• Exemplo: {"url": "https://webhook.cool/global", "events": ["messages",
"connection"], "excludeMessages": ["wasSentByApi"]}
 Sites para Testes (ordenados por qualidade)
Para testar webhooks durante desenvolvimento:
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 39
1. https://webhook.cool/ -  Melhor opção (sem rate limit, interface limpa)
2. https://rbaskets.in/ -  Boa alternativa (confiável, baixo rate limit)
3. https://webhook.site/ - ⚠️ Evitar se possível (rate limit agressivo)
Funcionalidades Principais:
• Configuração de URL para recebimento de eventos
• Seleção granular de tipos de eventos
• Filtragem avançada de mensagens
• Parâmetros adicionais na URL
Eventos Disponíveis:
• connection: Alterações no estado da conexão
• history: Recebimento de histórico de mensagens
• messages: Novas mensagens recebidas
• messages_update: Atualizações em mensagens existentes
• call: Eventos de chamadas VoIP
• contacts: Atualizações na agenda de contatos
• presence: Alterações no status de presença
• groups: Modificações em grupos
• labels: Gerenciamento de etiquetas
• chats: Eventos de conversas
• chat_labels: Alterações em etiquetas de conversas
• blocks: Bloqueios/desbloqueios
• leads: Atualizações de leads
• sender: Atualizações de campanhas, quando inicia, e quando completa
Remover mensagens com base nos filtros:
• wasSentByApi: Mensagens originadas pela API ⚠️ IMPORTANTE: Use sempre este filtro
para evitar loops em automações
• wasNotSentByApi: Mensagens não originadas pela API
• fromMeYes: Mensagens enviadas pelo usuário
• fromMeNo: Mensagens recebidas de terceiros
• isGroupYes: Mensagens em grupos
• isGroupNo: Mensagens em conversas individuais
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 40
 Prevenção de Loops Globais: O webhook global recebe eventos de TODAS as instâncias. Se
você tem automações que enviam mensagens via API, sempre inclua "excludeMessages":
["wasSentByApi"]. Caso prefira receber esses eventos, certifique-se de que sua automação
detecta mensagens enviadas pela própria API para não criar loops infinitos em múltiplas
instâncias.
Parâmetros de URL:
• addUrlEvents (boolean): Quando ativo, adiciona o tipo do evento como path parameter
na URL.
Exemplo: https://api.example.com/webhook/{evento}
• addUrlTypesMessages (boolean): Quando ativo, adiciona o tipo da mensagem como path
parameter na URL.
Exemplo: https://api.example.com/webhook/{tipo_mensagem}
Combinações de Parâmetros:
• Ambos ativos: https://api.example.com/webhook/{evento}/{tipo_mensagem}
Exemplo real: https://api.example.com/webhook/message/conversation
• Apenas eventos: https://api.example.com/webhook/message
• Apenas tipos: https://api.example.com/webhook/conversation
Notas Técnicas:
1. Os parâmetros são adicionados na ordem: evento → tipo mensagem
2. A URL deve ser configurada para aceitar esses parâmetros dinâmicos
3. Funciona com qualquer combinação de eventos/mensagens
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Webhook global configurado com sucesso Webhook
400 Payload inválido object
401 Token de administrador não fornecido object
403 Token de administrador inválido ou servidor demo object
500 Erro interno do servidor object
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 41
Instancia
Operações relacionadas ao ciclo de vida de uma instância, como conectar,
desconectar e verificar o status.
Resumo dos endpoints
Método Path Resumo
POST /instance/connect Conectar instância ao WhatsApp
POST /instance/disconnect Desconectar instância
GET /instance/status Verificar status da instância
POST /instance/updateInstanceName Atualizar nome da instância
DELETE /instance Deletar instância
GET /instance/privacy Buscar configurações de privacidade
POST /instance/privacy Alterar configurações de privacidade
POST /instance/presence Atualizar status de presença da instância
POST /instance/connect
Conectar instância ao WhatsApp
operationId connectInstance
Tag Instancia
Segurança token
Inicia o processo de conexão de uma instância ao WhatsApp. Este endpoint:
1. Requer o token de autenticação da instância
2. Recebe o número de telefone associado à conta WhatsApp
3. Gera um QR code caso não passe o campo phone
4. Ou Gera código de pareamento se passar o o campo phone
5. Atualiza o status da instância para "connecting"
O processo de conexão permanece pendente até que:
• O QR code seja escaneado no WhatsApp do celular, ou
• O código de pareamento seja usado no WhatsApp
• Timeout de 2 minutos para QRCode seja atingido ou 5 minutos para o código de
pareamento
Use o endpoint /instance/status para monitorar o progresso da conexão.
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 42
Estados possíveis da instância:
• disconnected: Desconectado do WhatsApp
• connecting: Em processo de conexão
• connected: Conectado e autenticado
Exemplo de requisição:
```json
{
"phone": "5511999999999"
}
```
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Não
Respostas
Status Descrição Schema
200 Sucesso object
401 Token inválido/expirado
404 Instância não encontrada
429 Limite de conexões simultâneas atingido
500 Erro interno
POST /instance/disconnect
Desconectar instância
operationId disconnectInstance
Tag Instancia
Segurança token
Desconecta a instância do WhatsApp, encerrando a sessão atual.
Esta operação:
• Encerra a conexão ativa
• Requer novo QR code para reconectar
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 43
Diferenças entre desconectar e hibernar:
• Desconectar: Encerra completamente a sessão, exigindo novo login
• Hibernar: Mantém a sessão ativa, apenas pausa a conexão
Use este endpoint para:
1. Encerrar completamente uma sessão
2. Forçar uma nova autenticação
3. Limpar credenciais de uma instância
4. Reiniciar o processo de conexão
Estados possíveis após desconectar:
• disconnected: Desconectado do WhatsApp
• connecting: Em processo de reconexão (após usar /instance/connect)
Respostas
Status Descrição Schema
200 Sucesso object
401 Token inválido/expirado
404 Instância não encontrada
500 Erro interno
GET /instance/status
Verificar status da instância
operationId getInstanceStatus
Tag Instancia
Segurança token
Retorna o status atual de uma instância, incluindo:
• Estado da conexão (disconnected, connecting, connected)
• QR code atualizado (se em processo de conexão)
• Código de pareamento (se disponível)
• Informações da última desconexão
• Detalhes completos da instância
Este endpoint é particularmente útil para:
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 44
1. Monitorar o progresso da conexão
2. Obter QR codes atualizados durante o processo de conexão
3. Verificar o estado atual da instância
4. Identificar problemas de conexão
Estados possíveis:
• disconnected: Desconectado do WhatsApp
• connecting: Em processo de conexão (aguardando QR code ou código de pareamento)
• connected: Conectado e autenticado com sucesso
Respostas
Status Descrição Schema
200 Sucesso object
401 Token inválido/expirado object
404 Instância não encontrada
500 Erro interno
POST /instance/updateInstanceName
Atualizar nome da instância
operationId updateInstanceName
Tag Instancia
Segurança token
Atualiza o nome de uma instância WhatsApp existente.
O nome não precisa ser único.
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Sucesso Instance
401 Token inválido/expirado
404 Instância não encontrada
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 45
500 Erro interno
DELET
E
/instance
Deletar instância
operationId deleteInstance
Tag Instancia
Segurança token
Remove a instância do sistema.
Respostas
Status Descrição Schema
200 Instância deletada com sucesso object
401 Falha na autenticação object
404 Instância não encontrada object
500 Erro interno do servidor object
GET /instance/privacy
Buscar configurações de privacidade
operationId getInstancePrivacy
Tag Instancia
Segurança token
Busca as configurações de privacidade atuais da instância do WhatsApp.
Importante - Diferença entre Status e Broadcast:
• Status: Refere-se ao recado personalizado que aparece embaixo do nome do usuário (ex:
"Disponível", "Ocupado", texto personalizado)
• Broadcast: Refere-se ao envio de "stories/reels" (fotos/vídeos temporários)
Limitação: As configurações de privacidade do broadcast (stories/reels) não estão disponíveis
para alteração via API.
Retorna todas as configurações de privacidade como quem pode:
• Adicionar aos grupos
• Ver visto por último
• Ver status (recado embaixo do nome)
• Ver foto de perfil
• Receber confirmação de leitura
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 46
• Ver status online
• Fazer chamadas
Respostas
Status Descrição Schema
200 Configurações de privacidade obtidas com sucesso object
401 Token de autenticação inválido object
500 Erro interno do servidor object
POST /instance/privacy
Alterar configurações de privacidade
operationId setPrivacySetting
Tag Instancia
Segurança token
Altera uma ou múltiplas configurações de privacidade da instância do WhatsApp de forma
otimizada.
Importante - Diferença entre Status e Broadcast:
• Status: Refere-se ao recado personalizado que aparece embaixo do nome do usuário (ex:
"Disponível", "Ocupado", texto personalizado)
• Broadcast: Refere-se ao envio de "stories/reels" (fotos/vídeos temporários)
Limitação: As configurações de privacidade do broadcast (stories/reels) não estão disponíveis
para alteração via API.
Características:
•  Eficiência: Altera apenas configurações que realmente mudaram
•  Flexibilidade: Pode alterar uma ou múltiplas configurações na mesma requisição
•  Feedback completo: Retorna todas as configurações atualizadas
Formato de entrada:
```json
{
"groupadd": "contacts",
"last": "none",
"status": "contacts"
}
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 47
```
Tipos de privacidade disponíveis:
• groupadd: Quem pode adicionar aos grupos
• last: Quem pode ver visto por último
• status: Quem pode ver status (recado embaixo do nome)
• profile: Quem pode ver foto de perfil
• readreceipts: Confirmação de leitura
• online: Quem pode ver status online
• calladd: Quem pode fazer chamadas
Valores possíveis:
• all: Todos
• contacts: Apenas contatos
• contact_blacklist: Contatos exceto bloqueados
• none: Ninguém
• match_last_seen: Corresponder ao visto por último (apenas para online)
• known: Números conhecidos (apenas para calladd)
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Configuração de privacidade alterada com sucesso object
400 Dados de entrada inválidos object
401 Token de autenticação inválido object
500 Erro interno do servidor object
POST /instance/presence
Atualizar status de presença da instância
operationId updateInstancePresence
Tag Instancia
Segurança token
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 48
Atualiza o status de presença global da instância do WhatsApp. Este endpoint permite:
1. Definir se a instância está disponível (Aparece "online") ou indisponível
2. Controlar o status de presença para todos os contatos
3. Salvar o estado atual da presença na instância
Tipos de presença suportados:
• available: Marca a instância como disponível/online
• unavailable: Marca a instância como indisponível/offline
Atenção:
• O status de presença pode ser temporariamente alterado para "available" (online) em
algumas situações internas da API, e com isso o visto por último também pode ser
atualizado.
• Caso isso for um problema, considere alterar suas configurações de privacidade no
WhatsApp para não mostrar o visto por último e/ou quem pode ver seu status "online".
⚠️ Importante - Limitação do Presence "unavailable":
• Quando a API é o único dispositivo ativo: Confirmações de entrega/leitura (ticks
cinzas/azuis) não são enviadas nem recebidas
• Impacto: Eventos message_update com status de entrega podem não ser recebidos
• Solução: Se precisar das confirmações, mantenha WhatsApp Web ou aplicativo móvel
ativo ou use presence "available"
Exemplo de requisição:
```json
{
"presence": "available"
}
```
Exemplo de resposta:
```json
{
"response": "Presence updated successfully"
}
```
Erros comuns:
• 401: Token inválido ou expirado
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 49
• 400: Valor de presença inválido
• 500: Erro ao atualizar presença
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Presença atualizada com sucesso object
400 Requisição inválida object
401 Token inválido ou expirado object
500 Erro interno do servidor object
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 50
Proxy
A uazapiGO opera com um proxy interno como padrão.
Você pode manter esse padrão, configurar um proxy próprio via proxy_url ou usar seu
celular android como proxy instalando o app em https://github.com/uazapi/silver_proxy_apk
(APK direto:
https://github.com/uazapi/silver_proxy_apk/raw/refs/heads/main/silver_proxy.apk).
Se nada for enviado, seguimos no proxy interno. IPs são brasileiros; para clientes
internacionais, considere um proxy da região do cliente.
Resumo dos endpoints
Método Path Resumo
GET /instance/proxy Obter configuração de proxy da instância
POST /instance/proxy Configurar ou alterar o proxy
DELETE /instance/proxy Remover o proxy configurado
GET /instance/proxy
Obter configuração de proxy da instância
operationId getProxyConfig
Tag Proxy
Segurança token
A uazapiGO opera com um proxy interno como padrão.
Observação: nossos IPs são brasileiros. Se você atende clientes internacionais, considere
usar um proxy do país/região do seu cliente (via proxy_url).
Você pode:
(1) continuar no proxy interno padrão;
(2) usar um proxy próprio informando proxy_url. Se nada for definido, seguimos no proxy
interno; ou
(3) usar seu celular android como proxy instalando o aplicativo disponibilizado pela uazapi
em https://github.com/uazapi/silver_proxy_apk (APK direto:
https://github.com/uazapi/silver_proxy_apk/raw/refs/heads/main/silver_proxy.apk).
A resposta desse endpoint traz o estado atual do proxy e o último teste de conectividade.
Respostas
Status Descrição Schema
200 Configuração de proxy recuperada com sucesso object
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 51
401 Token inválido ou expirado object
500 Erro interno do servidor ao recuperar a configuração object
POST /instance/proxy
Configurar ou alterar o proxy
operationId updateProxyConfig
Tag Proxy
Segurança token
Permite habilitar ou trocar para:
• Um proxy próprio (proxy_url), usando sua infraestrutura ou o aplicativo de celular para
proxy próprio.
• O proxy interno padrão (nenhum proxy_url enviado).
Se nada for enviado, seguimos no proxy interno. A URL é validada antes de salvar. A conexão
pode ser reiniciada automaticamente para aplicar a mudança.
Opcional: você pode usar seu celular android como proxy instalando o aplicativo
disponibilizado pela uazapi em https://github.com/uazapi/silver_proxy_apk (APK direto:
https://github.com/uazapi/silver_proxy_apk/raw/refs/heads/main/silver_proxy.apk).
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Proxy configurado com sucesso object
400 Payload inválido ou falha na validação do proxy object
401 Token inválido ou expirado object
500 Erro interno do servidor ao configurar o proxy object
DELET
E
/instance/proxy
Remover o proxy configurado
operationId deleteProxyConfig
Tag Proxy
Segurança token
Desativa e apaga o proxy personalizado, voltando ao comportamento padrão (proxy interno).
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 52
Pode reiniciar a conexão para aplicar a remoção.
Respostas
Status Descrição Schema
200 Configuração de proxy removida com sucesso object
401 Token inválido ou expirado object
500 Erro interno do servidor ao deletar a configuração de
proxy
object
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 53
Perfil
Operações relacionadas ao perfil da instância do WhatsApp, como alterar
nome e imagem de perfil.
Resumo dos endpoints
Método Path Resumo
POST /profile/name Altera o nome do perfil do WhatsApp
POST /profile/image Altera a imagem do perfil do WhatsApp
POST /profile/name
Altera o nome do perfil do WhatsApp
operationId updateProfileName
Tag Perfil
Segurança token
Altera o nome de exibição do perfil da instância do WhatsApp.
O endpoint realiza:
• Atualiza o nome do perfil usando o WhatsApp AppState
• Sincroniza a mudança com o servidor do WhatsApp
• Retorna confirmação da alteração
Importante:
• A instância deve estar conectada ao WhatsApp
• O nome será visível para todos os contatos
• Pode haver um limite de alterações por período (conforme WhatsApp)
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Nome do perfil alterado com sucesso object
400 Dados inválidos na requisição object
401 Sem sessão ativa object
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 54
403 Ação não permitida object
500 Erro interno do servidor object
POST /profile/image
Altera a imagem do perfil do WhatsApp
operationId updateProfileImage
Tag Perfil
Segurança token
Altera a imagem de perfil da instância do WhatsApp.
O endpoint realiza:
• Atualiza a imagem do perfil usando
• Processa a imagem (URL, base64 ou comando de remoção)
• Sincroniza a mudança com o servidor do WhatsApp
• Retorna confirmação da alteração
Importante:
• A instância deve estar conectada ao WhatsApp
• A imagem será visível para todos os contatos
• A imagem deve estar em formato JPEG e tamanho 640x640 pixels
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Imagem do perfil alterada com sucesso object
400 Dados inválidos na requisição object
401 Sem sessão ativa object
403 Ação não permitida object
413 Imagem muito grande object
500 Erro interno do servidor object
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 55
Business
⚠️ EXPERIMENTAL - Endpoints ainda não testados completamente.
Operações relacionadas ao perfil comercial do WhatsApp Business.
Permite consultar e atualizar dados do perfil comercial como descrição,
endereço, email, categorias e gerenciar o catálogo de produtos.
Requisitos:
• A instância deve ser uma conta WhatsApp Business
• Contas pessoais do WhatsApp não possuem perfil comercial
Nota: Estes endpoints podem não funcionar como esperado.
Reporte problemas encontrados.
Resumo dos endpoints
Método Path Resumo
POST /business/get/profile Obter o perfil comercial
GET /business/get/categories Obter as categorias de negócios
POST /business/update/profile Atualizar o perfil comercial
POST /business/catalog/list Listar os produtos do catálogo
POST /business/catalog/info Obter informações de um produto do catálogo
POST /business/catalog/delete Deletar um produto do catálogo
POST /business/catalog/show Mostrar um produto do catálogo
POST /business/catalog/hide Ocultar um produto do catálogo
POST /business/get/profile
Obter o perfil comercial
Tag Business
Segurança token
Retorna o perfil comercial da instância do WhatsApp.
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 56
Respostas
Status Descrição Schema
200 Perfil comercial recuperado com sucesso object
400 Requisição inválida object
401 Token inválido ou expirado object
500 Erro interno do servidor ao recuperar o perfil
comercial
object
GET /business/get/categories
Obter as categorias de negócios
Tag Business
Segurança token
Retorna as categorias de negócios disponíveis.
Respostas
Status Descrição Schema
200 Categorias de negócios recuperadas com sucesso object
401 Token inválido ou expirado object
500 Erro interno do servidor ao recuperar as categorias de
negócios
object
POST /business/update/profile
Atualizar o perfil comercial
Tag Business
Segurança token
Atualiza os dados do perfil comercial da instância do WhatsApp.
Todos os campos são opcionais; apenas os enviados serão atualizados.
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 57
200 Todos os campos enviados foram atualizados object
207 Sucesso parcial — ao menos um campo falhou object
400 Requisição inválida object
401 Token inválido ou expirado object
500 Falha total — nenhum campo foi atualizado object
POST /business/catalog/list
Listar os produtos do catálogo
Tag Business
Segurança token
Lista os produtos do catálogo da instância do WhatsApp.
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Produtos do catálogo recuperados com sucesso object
400 Requisição inválida object
401 Token inválido ou expirado object
500 Erro interno do servidor ao recuperar os produtos do
catálogo
object
POST /business/catalog/info
Obter informações de um produto do catálogo
Tag Business
Segurança token
Retorna as informações de um produto específico do catálogo.
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 58
Respostas
Status Descrição Schema
200 Informações do produto recuperadas com sucesso object
400 Requisição inválida object
401 Token inválido ou expirado object
500 Erro interno do servidor ao recuperar as informações
do produto
object
POST /business/catalog/delete
Deletar um produto do catálogo
Tag Business
Segurança token
Deleta um produto específico do catálogo.
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Produto deletado com sucesso object
400 Requisição inválida object
401 Token inválido ou expirado object
500 Erro interno do servidor ao deletar o produto object
POST /business/catalog/show
Mostrar um produto do catálogo
Tag Business
Segurança token
Mostra um produto específico do catálogo.
Corpo da requisição
Content-Type Schema Obrigatório
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 59
application/json object Sim
Respostas
Status Descrição Schema
200 Produto mostrado com sucesso object
400 Requisição inválida object
401 Token inválido ou expirado object
500 Erro interno do servidor ao mostrar o produto object
POST /business/catalog/hide
Ocultar um produto do catálogo
Tag Business
Segurança token
Oculta um produto específico do catálogo.
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Produto ocultado com sucesso object
400 Requisição inválida object
401 Token inválido ou expirado object
500 Erro interno do servidor ao ocultar o produto object
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 60
Chamadas
Operações relacionadas a chamadas peloWhatsApp.
Permite realizar e rejeitar chamadas programaticamente.
Resumo dos endpoints
Método Path Resumo
POST /call/make Iniciar chamada de voz
POST /call/reject Rejeitar chamada recebida
POST /call/make
Iniciar chamada de voz
operationId makeCall
Tag Chamadas
Segurança token
Inicia uma chamada de voz para um contato específico. Este endpoint permite:
1. Iniciar chamadas de voz para contatos
2. Funciona apenas com números válidos do WhatsApp
3. O contato receberá uma chamada de voz
Nota: O telefone do contato tocará normalmente, mas ao contato atender, ele não ouvirá
nada, e você também não ouvirá nada.
Este endpoint apenas inicia a chamada, não estabelece uma comunicação de voz real.
Exemplo de requisição:
```json
{
"number": "5511999999999"
}
```
Exemplo de resposta:
```json
{
"response": "Call successful"
}
```
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 61
Erros comuns:
• 401: Token inválido ou expirado
• 400: Número inválido ou ausente
• 500: Erro ao iniciar chamada
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Chamada iniciada com sucesso object
400 Requisição inválida object
401 Token inválido ou expirado object
500 Erro interno do servidor object
POST /call/reject
Rejeitar chamada recebida
operationId rejectCall
Tag Chamadas
Segurança token
Rejeita uma chamada recebida do WhatsApp.
O body pode ser enviado vazio {}. Os campos number e id são opcionais e podem ser usados
para especificar uma chamada específica.
Exemplo de requisição (recomendado):
```json
{}
```
Exemplo de requisição com campos opcionais:
```json
{
"number": "5511999999999",
"id": "ABEiGmo8oqkAcAKrBYQAAAAA_1"
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 62
}
```
Exemplo de resposta:
```json
{
"response": "Call rejected"
}
```
Erros comuns:
• 401: Token inválido ou expirado
• 400: Número inválido
• 500: Erro ao rejeitar chamada
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Chamada rejeitada com sucesso object
400 Requisição inválida object
401 Token inválido ou expirado object
500 Erro interno do servidor object
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 63
Webhooks e SSE
Resumo dos endpoints
Método Path Resumo
GET /webhook Ver Webhook da Instância
POST /webhook Configurar Webhook da Instância
GET /sse Server-Sent Events (SSE)
GET /webhook
Ver Webhook da Instância
operationId getWebhook
Tag Webhooks e SSE
Segurança token
Retorna a configuração atual do webhook da instância, incluindo:
• URL configurada
• Eventos ativos
• Filtros aplicados
• Configurações adicionais
Exemplo de resposta:
```json
[
{
"id": "123e4567-e89b-12d3-a456-426614174000",
"enabled": true,
"url": "https://example.com/webhook",
"events": ["messages", "messages_update"],
"excludeMessages": ["wasSentByApi", "isGroupNo"],
"addUrlEvents": true,
"addUrlTypesMessages": true
},
{
"id": "987fcdeb-51k3-09j8-x543-864297539100",
"enabled": true,
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 64
"url": "https://outro-endpoint.com/webhook",
"events": ["connection", "presence"],
"excludeMessages": [],
"addUrlEvents": false,
"addUrlTypesMessages": false
}
]
```
A resposta é sempre um array, mesmo quando há apenas um webhook configurado.
Respostas
Status Descrição Schema
200 Configuração do webhook retornada com sucesso array[Webhook]
401 Token inválido ou não fornecido object
500 Erro interno do servidor object
POST /webhook
Configurar Webhook da Instância
operationId updateWebhook
Tag Webhooks e SSE
Segurança token
Gerencia a configuração de webhooks para receber eventos em tempo real da instância.
Permite gerenciar múltiplos webhooks por instância através do campo ID e action.
 Modo Simples (Recomendado)
Uso mais fácil - sem complexidade de IDs:
• Não inclua action nem id no payload
• Gerencia automaticamente um único webhook por instância
• Cria novo ou atualiza o existente automaticamente
• Recomendado: Sempre use "excludeMessages": ["wasSentByApi"] para evitar loops
• Exemplo: {"url": "https://meusite.com/webhook", "events": ["messages"],
"excludeMessages": ["wasSentByApi"]}
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 65
 Sites para Testes (ordenados por qualidade)
Para testar webhooks durante desenvolvimento:
1. https://webhook.cool/ -  Melhor opção (sem rate limit, interface limpa)
2. https://rbaskets.in/ -  Boa alternativa (confiável, baixo rate limit)
3. https://webhook.site/ - ⚠️ Evitar se possível (rate limit agressivo)
⚙️ Modo Avançado (Para múltiplos webhooks)
Para usuários que precisam de múltiplos webhooks por instância:
 Dica: Mesmo precisando de múltiplos webhooks, considere usar addUrlEvents no modo
simples.
Um único webhook pode receber diferentes tipos de eventos em URLs específicas
(ex: /webhook/message, /webhook/connection), eliminando a necessidade de múltiplos
webhooks.
1. Criar Novo Webhook:
• Use action: "add"
• Não inclua id no payload
• O sistema gera ID automaticamente
2. Atualizar Webhook Existente:
• Use action: "update"
• Inclua o id do webhook no payload
• Todos os campos serão atualizados
3. Remover Webhook:
• Use action: "delete"
• Inclua apenas o id do webhook
• Outros campos são ignorados
Eventos Disponíveis
• connection: Alterações no estado da conexão
• history: Recebimento de histórico de mensagens
• messages: Novas mensagens recebidas
• messages_update: Atualizações em mensagens existentes
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 66
• call: Eventos de chamadas VoIP
• contacts: Atualizações na agenda de contatos
• presence: Alterações no status de presença
• groups: Modificações em grupos
• labels: Gerenciamento de etiquetas
• chats: Eventos de conversas
• chat_labels: Alterações em etiquetas de conversas
• blocks: Bloqueios/desbloqueios
• leads: Atualizações de leads
• sender: Atualizações de campanhas, quando inicia, e quando completa
Remover mensagens com base nos filtros:
• wasSentByApi: Mensagens originadas pela API ⚠️ IMPORTANTE: Use sempre este filtro
para evitar loops em automações
• wasNotSentByApi: Mensagens não originadas pela API
• fromMeYes: Mensagens enviadas pelo usuário
• fromMeNo: Mensagens recebidas de terceiros
• isGroupYes: Mensagens em grupos
• isGroupNo: Mensagens em conversas individuais
 Prevenção de Loops: Se você tem automações que enviam mensagens via API, sempre
inclua "excludeMessages": ["wasSentByApi"] no seu webhook. Caso prefira receber esses
eventos, certifique-se de que sua automação detecta mensagens enviadas pela própria API
para não criar loops infinitos.
Ações Suportadas:
• add: Registrar novo webhook
• delete: Remover webhook existente
Parâmetros de URL:
• addUrlEvents (boolean): Quando ativo, adiciona o tipo do evento como path parameter
na URL.
Exemplo: https://api.example.com/webhook/{evento}
• addUrlTypesMessages (boolean): Quando ativo, adiciona o tipo da mensagem como path
parameter na URL.
Exemplo: https://api.example.com/webhook/{tipo_mensagem}
Combinações de Parâmetros:
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 67
• Ambos ativos: https://api.example.com/webhook/{evento}/{tipo_mensagem}
Exemplo real: https://api.example.com/webhook/message/conversation
• Apenas eventos: https://api.example.com/webhook/message
• Apenas tipos: https://api.example.com/webhook/conversation
Notas Técnicas:
1. Os parâmetros são adicionados na ordem: evento → tipo mensagem
2. A URL deve ser configurada para aceitar esses parâmetros dinâmicos
3. Funciona com qualquer combinação de eventos/mensagens
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Webhook configurado ou atualizado com sucesso array[Webhook]
400 Requisição inválida object
401 Token inválido ou não fornecido object
500 Erro interno do servidor object
GET /sse
Server-Sent Events (SSE)
operationId subscribeSSE
Tag Webhooks e SSE
Segurança Nenhuma (público)
Receber eventos em tempo real via Server-Sent Events (SSE)
Funcionalidades Principais:
• Configuração de URL para recebimento de eventos
• Seleção granular de tipos de eventos
• Filtragem avançada de mensagens
• Parâmetros adicionais na URL
• Gerenciamento múltiplo de webhooks
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 68
Eventos Disponíveis:
• connection: Alterações no estado da conexão
• history: Recebimento de histórico de mensagens
• messages: Novas mensagens recebidas
• messages_update: Atualizações em mensagens existentes
• call: Eventos de chamadas VoIP
• contacts: Atualizações na agenda de contatos
• presence: Alterações no status de presença
• groups: Modificações em grupos
• labels: Gerenciamento de etiquetas
• chats: Eventos de conversas
• chat_labels: Alterações em etiquetas de conversas
• blocks: Bloqueios/desbloqueios
• leads: Atualizações de leads
Estabelece uma conexão persistente para receber eventos em tempo real. Este
endpoint:
1. Requer autenticação via token
2. Mantém uma conexão HTTP aberta com o cliente
3. Envia eventos conforme ocorrem no servidor
4. Suporta diferentes tipos de eventos
Exemplo de uso:
```javascript
const eventSource = new
EventSource('/sse?token=SEU_TOKEN&events=chats,messages');
eventSource.onmessage = function(event) {
const data = JSON.parse(event.data);
console.log('Novo evento:', data);
};
eventSource.onerror = function(error) {
console.error('Erro na conexão SSE:', error);
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 69
};
```
Estrutura de um evento:
```json
{
"type": "message",
"data": {
"id": "3EB0538DA65A59F6D8A251",
"from": "5511999999999@s.whatsapp.net",
"to": "5511888888888@s.whatsapp.net",
"text": "Olá!",
"timestamp": 1672531200000
}
}
```
Parâmetros
Nome Em Tipo Obrigatór
io
Descrição
token query string Sim Token de autenticação da
instância
events query string Sim Tipos de eventos a serem
recebidos. Suporta dois
formatos: - Separados por
vírgula:
?events=chats,messages -
Parâmetros repetidos: ?event
s=chats&events=messages
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 70
excludeMessa
ges
query string Não Tipos de mensagens a serem
excluídas do evento
messages. Suporta dois
formatos: - Separados por
vírgula: ?excludeMessages=p
oll,reaction - Parâmetros
repetidos: ?excludeMessages
=poll&excludeMessages=rea
ction
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 71
Enviar Mensagem
Endpoints para envio de mensagens do WhatsApp com diferentes tipos de conteúdo.
Campos Opcionais Comuns
Todos os endpoints de envio de mensagem suportam os seguintes campos opcionais:
• delay (integer): Atraso em milissegundos antes do envio
• Durante o atraso aparecerá "Digitando..." ou "Gravando áudio..." dependendo do tipo
• Exemplo: 5000 (5 segundos)
• readchat (boolean): Marcar chat como lido após envio
• Remove o contador de mensagens não lidas do chat
• Exemplo: true
• readmessages (boolean): Marcar últimas mensagens recebidas como lidas
• Marca as últimas 10 mensagens recebidas (não enviadas por você) como lidas
• Útil para confirmar leitura de mensagens pendentes antes de responder
• Diferente do readchat que apenas remove contador de não lidas
• Exemplo: true
• replyid (string): ID da mensagem para responder
• Cria uma resposta vinculada à mensagem original
• Suporte varia por tipo de mensagem
• Exemplo: "3A12345678901234567890123456789012"
• mentions (string): Números para mencionar (apenas para envio em grupos)
• Números específicos: "5511999999999,5511888888888"
• Mencionar todos: "all"
• forward (boolean): Marca a mensagem como encaminhada no WhatsApp
• Adiciona o indicador "Encaminhada" na mensagem
• Exemplo: true
• track_source (string): Origem do rastreamento da mensagem
• Identifica o sistema ou fonte que está enviando a mensagem
• Útil para integrações (ex: "chatwoot", "crm", "chatbot")
• Exemplo: "chatwoot"
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 72
• track_id (string): ID para rastreamento da mensagem
• Identificador livre para acompanhar a mensagem em sistemas externos
• Permite correlacionar mensagens entre diferentes plataformas
• Nota: O sistema aceita valores duplicados - não há validação de unicidade
• Use o mesmo ID em várias mensagens se fizer sentido para sua integração
• Exemplo: "msg_123456789"
• async (boolean): Envia pela fila interna sem bloquear a requisição
• Resposta 200 indica que a mensagem entrou na fila; o envio real pode falhar depois
• Em caso de falha, pesquise em /message/find com status=failed
Envio para Grupos
• number (string): Para enviar mensagem para grupo, use o ID do grupo que termina com
@g.us
• Exemplo: "120363012345678901@g.us"
• Como obter o ID do grupo:
• Use o chatid do webhook recebido quando alguém envia mensagem no grupo
• Use o endpoint GET /group/list para listar todos os grupos e seus IDs
Placeholders Disponíveis
Todos os endpoints de envio de mensagem suportam placeholders dinâmicos para
personalização automática:
Campos de Nome
• {{name}}: Nome consolidado do chat, usando a primeira opção disponível:
1. Nome do lead (lead_name)
2. Nome completo do lead (lead_fullName)
3. Nome do contato no WhatsApp (wa_contactName)
4. Nome do perfil do WhatsApp (wa_name)
• {{first_name}}: Primeira palavra válida do nome consolidado (mínimo 2 caracteres)
Campos do WhatsApp
• {{wa_name}}: Nome do perfil do WhatsApp
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 73
• {{wa_contactName}}: Nome do contato como salvo no WhatsApp
Campos do Lead
• {{lead_name}}: Nome do lead
• {{lead_fullName}}: Nome completo do lead
• {{lead_personalid}}: ID pessoal (CPF, CNPJ, etc)
• {{lead_email}}: Email do lead
• {{lead_status}}: Status atual do lead
• {{lead_notes}}: Anotações do lead
• {{lead_assignedAttendant_id}}: ID do atendente designado
Campos Personalizados
Campos adicionados via custom fields são acessíveis usando {{lead_field01}} à
{{lead_field20}} ou usar {{nomedocampo}} definido em /instance/updateFieldsMap.
Exemplo de Uso
```
Olá {{name}}! Vi que você trabalha na {{company}}.
Seu email {{lead_email}} está correto?
```
 Dica: Use /chat/find para buscar dados do chat e ver os campos disponíveis antes de
enviar mensagens com placeholders.
Resumo dos endpoints
Método Path Resumo
POST /send/text Enviar mensagem de texto
POST /send/media Enviar mídia (imagem, vídeo, áudio ou
documento)
POST /send/contact Enviar cartão de contato (vCard)
POST /send/location Enviar localização geográfica
POST /message/presence Enviar atualização de presença
POST /send/status Enviar Stories (Status)
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 74
POST /send/menu Enviar menu interativo (botões, carrosel, lista
ou enquete)
POST /send/carousel Enviar carrossel de mídia com botões
POST /send/location-button Solicitar localização do usuário
POST /send/request-payment Solicitar pagamento
POST /send/pix-button Enviar botão PIX
POST /send/text
Enviar mensagem de texto
operationId sendText
Tag Enviar Mensagem
Segurança token
Envia uma mensagem de texto para um contato ou grupo.
Recursos Específicos
• Preview de links com suporte a personalização automática ou customizada
• Formatação básica do texto
• Substituição automática de placeholders dinâmicos
Campos Comuns
Este endpoint suporta todos os campos opcionais comuns documentados na tag "Enviar
Mensagem", incluindo:
delay, readchat, readmessages, replyid, mentions, forward, track_source, track_id,
placeholders e envio para grupos.
Preview de Links
Preview Automático
```json
{
"number": "5511999999999",
"text": "Confira: https://exemplo.com",
"linkPreview": true
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 75
}
```
Preview Personalizado
```json
{
"number": "5511999999999",
"text": "Confira nosso site! https://exemplo.com",
"linkPreview": true,
"linkPreviewTitle": "Título Personalizado",
"linkPreviewDescription": "Uma descrição personalizada do link",
"linkPreviewImage": "https://exemplo.com/imagem.jpg",
"linkPreviewLarge": true
}
```
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Mensagem enviada com sucesso allOf(Message, object)
400 Requisição inválida object
401 Não autorizado object
429 Limite de requisições excedido object
500 Erro interno do servidor object
POST /send/media
Enviar mídia (imagem, vídeo, áudio ou documento)
operationId sendMedia
Tag Enviar Mensagem
Segurança token
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 76
Envia diferentes tipos de mídia para um contato ou grupo. Suporta URLs ou arquivos base64.
Tipos de Mídia Suportados
• image: Imagens (JPG preferencialmente)
• video: Vídeos (apenas MP4)
• document: Documentos (PDF, DOCX, XLSX, etc)
• audio: Áudio comum (MP3 ou OGG)
• myaudio: Mensagem de voz (alternativa ao PTT)
• ptt: Mensagem de voz (Push-to-Talk)
• ptv: Mensagem de vídeo (Push-to-Video)
• sticker: Figurinha/Sticker
Recursos Específicos
• Upload por URL ou base64
• Caption/legenda opcional com suporte a placeholders
• Nome personalizado para documentos (docName)
• Geração automática de thumbnails
• Compressão otimizada conforme o tipo
Campos Comuns
Este endpoint suporta todos os campos opcionais comuns documentados na tag "Enviar
Mensagem", incluindo:
delay, readchat, readmessages, replyid, mentions, forward, track_source, track_id,
placeholders e envio para grupos.
Exemplos Básicos
Imagem Simples
```json
{
"number": "5511999999999",
"type": "image",
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 77
"file": "https://exemplo.com/foto.jpg"
}
```
Documento com Nome
```json
{
"number": "5511999999999",
"type": "document",
"file": "https://exemplo.com/contrato.pdf",
"docName": "Contrato.pdf",
"text": "Segue o documento solicitado"
}
```
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Mídia enviada com sucesso allOf(Message, object)
400 Requisição inválida object
401 Não autorizado object
413 Arquivo muito grande object
415 Formato de mídia não suportado object
500 Erro interno do servidor object
POST /send/contact
Enviar cartão de contato (vCard)
operationId sendContact
Tag Enviar Mensagem
Segurança token
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 78
Envia um cartão de contato (vCard) para um contato ou grupo.
Recursos Específicos
• vCard completo com nome, telefones, organização, email e URL
• Múltiplos números de telefone (separados por vírgula)
• Cartão clicável no WhatsApp para salvar na agenda
• Informações profissionais (organização/empresa)
Campos Comuns
Este endpoint suporta todos os campos opcionais comuns documentados na tag "Enviar
Mensagem", incluindo:
delay, readchat, readmessages, replyid, mentions, forward, track_source, track_id,
placeholders e envio para grupos.
Exemplo Básico
```json
{
"number": "5511999999999",
"fullName": "João Silva",
"phoneNumber": "5511999999999,5511888888888",
"organization": "Empresa XYZ",
"email": "joao.silva@empresa.com",
"url": "https://empresa.com/joao"
}
```
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 79
200 Cartão de contato enviado com sucesso allOf(Message, object)
400 Requisição inválida object
401 Não autorizado object
429 Limite de requisições excedido object
500 Erro interno do servidor object
POST /send/location
Enviar localização geográfica
operationId sendLocation
Tag Enviar Mensagem
Segurança token
Envia uma localização geográfica para um contato ou grupo.
Recursos Específicos
• Coordenadas precisas (latitude e longitude obrigatórias)
• Nome do local para identificação
• Endereço completo para exibição detalhada
• Mapa interativo no WhatsApp para navegação
• Pin personalizado com nome do local
Campos Comuns
Este endpoint suporta todos os campos opcionais comuns documentados na tag "Enviar
Mensagem", incluindo:
delay, readchat, readmessages, replyid, mentions, forward, track_source, track_id,
placeholders e envio para grupos.
Exemplo Básico
```json
{
"number": "5511999999999",
"name": "Maracanã",
"address": "Av. Pres. Castelo Branco - Maracanã, Rio de Janeiro - RJ",
"latitude": -22.912982815767986,
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 80
"longitude": -43.23028153499254
}
```
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Localização enviada com sucesso allOf(Message, object)
400 Requisição inválida object
401 Não autorizado object
429 Limite de requisições excedido object
500 Erro interno do servidor object
POST /message/presence
Enviar atualização de presença
operationId sendPresence
Tag Enviar Mensagem
Segurança token
Envia uma atualização de presença para um contato ou grupo de forma assíncrona.
 Comportamento Assíncrono:
• Execução independente: A presença é gerenciada em background, não bloqueia o retorno
da API
• Limite máximo: 5 minutos de duração (300 segundos)
• Tick de atualização: Reenvia a presença a cada 10 segundos
• Cancelamento automático: Presença é cancelada automaticamente ao enviar uma
mensagem para o mesmo chat
 Tipos de presença suportados:
• composing: Indica que você está digitando uma mensagem
• recording: Indica que você está gravando um áudio
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 81
• paused: Remove/cancela a indicação de presença atual
️ Controle de duração:
• Sem delay: Usa limite padrão de 5 minutos
• Com delay: Usa o valor especificado (máximo 5 minutos)
• Cancelamento: Envio de mensagem cancela presença automaticamente
 Exemplos de uso:
Digitar por 30 segundos:
```json
{
"number": "5511999999999",
"presence": "composing",
"delay": 30000
}
```
Gravar áudio por 1 minuto:
```json
{
"number": "5511999999999",
"presence": "recording",
"delay": 60000
}
```
Cancelar presença atual:
```json
{
"number": "5511999999999",
"presence": "paused"
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 82
}
```
Usar limite máximo (5 minutos):
```json
{
"number": "5511999999999",
"presence": "composing"
}
```
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Presença atualizada com sucesso object
400 Requisição inválida object
401 Token inválido ou expirado object
500 Erro interno do servidor object
POST /send/status
Enviar Stories (Status)
operationId sendStatus
Tag Enviar Mensagem
Segurança token
Envia um story (status) com suporte para texto, imagem, vídeo e áudio.
Suporte a campos de rastreamento: Este endpoint também suporta track_source e
track_id documentados na tag "Enviar Mensagem".
Tipos de Status
• text: Texto com estilo e cor de fundo
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 83
• image: Imagens com legenda opcional
• video: Vídeos com thumbnail e legenda
• audio: Áudio normal ou mensagem de voz (PTT)
Cores de Fundo
• 1-3: Tons de amarelo
• 4-6: Tons de verde
• 7-9: Tons de azul
• 10-12: Tons de lilás
• 13: Magenta
• 14-15: Tons de rosa
• 16: Marrom claro
• 17-19: Tons de cinza (19 é o padrão)
Fontes (para texto)
• 0: Padrão
• 1-8: Estilos alternativos
Limites
• Texto: Máximo 656 caracteres
• Imagem: JPG, PNG, GIF
• Vídeo: MP4, MOV
• Áudio: MP3, OGG, WAV (convertido para OGG/OPUS)
Exemplo
```json
{
"type": "text",
"text": "Novidades chegando!",
"background_color": 7,
"font": 1
}
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 84
```
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Status enviado com sucesso object
400 Requisição inválida object
401 Não autorizado object
500 Erro interno do servidor object
POST /send/menu
Enviar menu interativo (botões, carrosel, lista ou enquete)
operationId sendMenu
Tag Enviar Mensagem
Segurança token
Este endpoint oferece uma interface unificada para envio de quatro tipos principais de
mensagens interativas:
• Botões: Para ações rápidas e diretas
• Carrosel de Botões: Para uma lista horizontal de botões com imagens
• Listas: Para menus organizados em seções
• Enquetes: Para coleta de opiniões e votações
Suporte a campos de rastreamento: Este endpoint também suporta track_source e
track_id documentados na tag "Enviar Mensagem".
Estrutura Base do Payload
Todas as requisições seguem esta estrutura base:
```json
{
"number": "5511999999999",
"type": "button|list|poll|carousel",
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 85
"text": "Texto principal da mensagem",
"choices": ["opções baseadas no tipo escolhido"],
"footerText": "Texto do rodapé (opcional para botões e listas)",
"listButton": "Texto do botão (para listas)",
"selectableCount": "Número de opções selecionáveis (apenas para enquetes)"
}
```
Tipos de Mensagens Interativas
1. Botões (type: "button")
Cria botões interativos com diferentes funcionalidades de ação.
#### Campos Específicos
• footerText: Texto opcional exibido abaixo da mensagem principal
• choices: Array de opções que serão convertidas em botões
#### Formatos de Botões
Cada botão pode ser configurado usando | (pipe) ou \n (quebra de linha) como separadores:
• Botão de Resposta:
• "texto|id" ou
• "texto\nid" ou
• "texto" (ID será igual ao texto)
• Botão de Cópia:
• "texto|copy:código" ou
• "texto\ncopy:código"
• Botão de Chamada:
• "texto|call:+5511999999999" ou
• "texto\ncall:+5511999999999"
• Botão de URL:
• "texto|https://exemplo.com" ou
• "texto|url:https://exemplo.com"
#### Botões com Imagem
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 86
Para adicionar uma imagem aos botões, use o campo imageButton no payload:
#### Exemplo com Imagem
```json
{
"number": "5511999999999",
"type": "button",
"text": "Escolha um produto:",
"imageButton": "https://exemplo.com/produto1.jpg",
"choices": [
"Produto A|prod_a",
"Mais Info|https://exemplo.com/produto-a",
"Produto B|prod_b",
"Ligar|call:+5511999999999"
],
"footerText": "Produtos em destaque"
}
```
> Suporte: O campo imageButton aceita URLs ou imagens em base64.
#### Exemplo Completo
```json
{
"number": "5511999999999",
"type": "button",
"text": "Como podemos ajudar?",
"choices": [
"Suporte Técnico|suporte",
"Fazer Pedido|pedido",
"Nosso Site|https://exemplo.com",
"Falar Conosco|call:+5511999999999"
],
"footerText": "Escolha uma das opções abaixo"
}
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 87
```
#### Limitações e Compatibilidade
> Importante: Ao combinar botões de resposta com outros tipos (call, url, copy) na mesma
mensagem, será exibido o aviso: "Não é possível exibir esta mensagem no WhatsApp Web.
Abra o WhatsApp no seu celular para visualizá-la."
2. Listas (type: "list")
Cria menus organizados em seções com itens selecionáveis.
#### Campos Específicos
• listButton: Texto do botão que abre a lista
• footerText: Texto opcional do rodapé
• choices: Array com seções e itens da lista
#### Formato das Choices
• "[Título da Seção]": Inicia uma nova seção
• "texto|id|descrição": Item da lista com:
• texto: Label do item
• id: Identificador único, opcional
• descrição: Texto descritivo adicional e opcional
#### Exemplo Completo
```json
{
"number": "5511999999999",
"type": "list",
"text": "Catálogo de Produtos",
"choices": [
"[Eletrônicos]",
"Smartphones|phones|Últimos lançamentos",
"Notebooks|notes|Modelos 2024",
"[Acessórios]",
"Fones|fones|Bluetooth e com fio",
"Capas|cases|Proteção para seu device"
],
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 88
"listButton": "Ver Catálogo",
"footerText": "Preços sujeitos a alteração"
}
```
3. Enquetes (type: "poll")
Cria enquetes interativas para votação.
#### Campos Específicos
• selectableCount: Número de opções que podem ser selecionadas (padrão: 1)
• choices: Array simples com as opções de voto
#### Exemplo Completo
```json
{
"number": "5511999999999",
"type": "poll",
"text": "Qual horário prefere para atendimento?",
"choices": [
"Manhã (8h-12h)",
"Tarde (13h-17h)",
"Noite (18h-22h)"
],
"selectableCount": 1
}
```
4. Carousel (type: "carousel")
Cria um carrossel de cartões com imagens e botões interativos.
#### Campos Específicos
• choices: Array com elementos do carrossel na seguinte ordem:
• [Texto do cartão]: Texto do cartão entre colchetes
• {URL ou base64 da imagem}: Imagem entre chaves
• Botões do cartão (um por linha):
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 89
• "texto|copy:código" para botão de copiar
• "texto|https://url" para botão de link
• "texto|call:+número" para botão de ligação
#### Exemplo Completo
```json
{
"number": "5511999999999",
"type": "carousel",
"text": "Conheça nossos produtos",
"choices": [
"[Smartphone XYZ\nO mais avançado smartphone da linha]",
"{https://exemplo.com/produto1.jpg}",
"Copiar Código|copy:PROD123",
"Ver no Site|https://exemplo.com/xyz",
"Fale Conosco|call:+5511999999999",
"[Notebook ABC\nO notebook ideal para profissionais]",
"{https://exemplo.com/produto2.jpg}",
"Copiar Código|copy:NOTE456",
"Comprar Online|https://exemplo.com/abc",
"Suporte|call:+5511988888888"
]
}
```
> Nota: Criamos outro endpoint para carrossel: /send/carousel, funciona da mesma forma,
mas com outro formato de payload. Veja o que é mais fácil para você.
Termos de uso
Os recursos de botões interativos e listas podem ser descontinuados a qualquer momento
sem aviso prévio. Não nos responsabilizamos por quaisquer alterações ou indisponibilidade
destes recursos.
Alternativas e Compatibilidade
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 90
Considerando a natureza dinâmica destes recursos, nosso endpoint foi projetado para
facilitar a migração entre diferentes tipos de mensagens (botões, listas e enquetes).
Recomendamos criar seus fluxos de forma flexível, preparados para alternar entre os
diferentes tipos.
Em caso de descontinuidade de algum recurso, você poderá facilmente migrar para outro
tipo de mensagem apenas alterando o campo "type" no payload, mantendo a mesma
estrutura de choices.
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Menu enviado com sucesso allOf(Message, object)
400 Requisição inválida object
401 Não autorizado object
429 Limite de requisições excedido object
500 Erro interno do servidor object
POST /send/carousel
Enviar carrossel de mídia com botões
operationId sendCarousel
Tag Enviar Mensagem
Segurança token
Este endpoint permite enviar um carrossel com imagens e botões interativos.
Funciona de maneira igual ao endpoint /send/menu com type: carousel, porém usando outro
formato de payload.
Campos Comuns
Este endpoint suporta todos os campos opcionais comuns documentados na tag "Enviar
Mensagem", incluindo:
delay, readchat, readmessages, replyid, mentions, forward, track_source, track_id,
placeholders e envio para grupos.
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 91
Estrutura do Payload
```json
{
"number": "5511999999999",
"text": "Texto principal",
"carousel": [
{
"text": "Texto do cartão",
"image": "URL da imagem",
"buttons": [
{
"id": "resposta1",
"text": "Texto do botão",
"type": "REPLY"
}
]
}
],
"delay": 1000,
"readchat": true
}
```
Tipos de Botões
• REPLY: Botão de resposta rápida
• Quando clicado, envia o valor do id como resposta ao chat
• O id será o texto enviado como resposta
• URL: Botão com link
• Quando clicado, abre a URL especificada
• O id deve conter a URL completa (ex: https://exemplo.com)
• COPY: Botão para copiar texto
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 92
• Quando clicado, copia o texto para a área de transferência
• O id será o texto que será copiado
• CALL: Botão para realizar chamada
• Quando clicado, inicia uma chamada telefônica
• O id deve conter o número de telefone
Exemplo de Botões
```json
{
"buttons": [
{
"id": "Sim, quero comprar!",
"text": "Confirmar Compra",
"type": "REPLY"
},
{
"id": "https://exemplo.com/produto",
"text": "Ver Produto",
"type": "URL"
},
{
"id": "CUPOM20",
"text": "Copiar Cupom",
"type": "COPY"
},
{
"id": "5511999999999",
"text": "Falar com Vendedor",
"type": "CALL"
}
]
}
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 93
```
Exemplo Completo de Carrossel
```json
{
"number": "5511999999999",
"text": "Nossos Produtos em Destaque",
"carousel": [
{
"text": "Smartphone XYZ\nO mais avançado smartphone da linha",
"image": "https://exemplo.com/produto1.jpg",
"buttons": [
{
"id": "SIM_COMPRAR_XYZ",
"text": "Comprar Agora",
"type": "REPLY"
},
{
"id": "https://exemplo.com/xyz",
"text": "Ver Detalhes",
"type": "URL"
}
]
},
{
"text": "Cupom de Desconto\nGanhe 20% OFF em qualquer produto",
"image": "https://exemplo.com/cupom.jpg",
"buttons": [
{
"id": "DESCONTO20",
"text": "Copiar Cupom",
"type": "COPY"
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 94
},
{
"id": "5511999999999",
"text": "Falar com Vendedor",
"type": "CALL"
}
]
}
],
"delay": 0,
"readchat": true
}
```
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Carrossel enviado com sucesso allOf(Message, object)
400 Requisição inválida object
401 Não autorizado object
500 Erro interno do servidor object
POST /send/location-button
Solicitar localização do usuário
operationId sendLocationButton
Tag Enviar Mensagem
Segurança token
Este endpoint envia uma mensagem com um botão que solicita a localização do usuário.
Quando o usuário clica no botão, o WhatsApp abre a interface para compartilhar a
localização atual.
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 95
Campos Comuns
Este endpoint suporta todos os campos opcionais comuns documentados na tag "Enviar
Mensagem", incluindo:
delay, readchat, readmessages, replyid, mentions, forward, track_source, track_id,
placeholders e envio para grupos.
Estrutura do Payload
```json
{
"number": "5511999999999",
"text": "Por favor, compartilhe sua localização",
"delay": 0,
"readchat": true
}
```
Exemplo de Uso
```json
{
"number": "5511999999999",
"text": "Para continuar o atendimento, clique no botão abaixo e compartilhe sua localização"
}
```
> Nota: O botão de localização é adicionado automaticamente à mensagem
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Localização enviada com sucesso allOf(Message, object)
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 96
400 Requisição inválida object
401 Não autorizado object
500 Erro interno do servidor object
POST /send/request-payment
Solicitar pagamento
operationId sendRequestPayment
Tag Enviar Mensagem
Segurança token
Envia uma solicitação de pagamento com o botão nativo "Revisar e pagar" do WhatsApp.
O fluxo suporta PIX (estático, dinâmico ou desabilitado), boleto, link de pagamento e cartão,
combinando tudo em uma única mensagem interativa.
Como funciona
• Define o valor em amount (BRL por padrão) e opcionalmente personaliza título, texto e
nota adicional.
• Por padrão exige pixKey.
• O arquivo apontado por fileUrl é anexado como documento (boleto ou fatura em PDF,
por exemplo).
• paymentLink habilita o botão externo.
Campos comuns
Este endpoint também suporta os campos padrão: delay, readchat, readmessages,
replyid,
mentions, track_source, track_id e async.
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Solicitação de pagamento enviada com sucesso allOf(Message, object)
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 97
400 Requisição inválida object
401 Não autorizado object
500 Erro interno do servidor object
POST /send/pix-button
Enviar botão PIX
operationId sendPixButton
Tag Enviar Mensagem
Segurança token
Envia um botão nativo do WhatsApp que abre para pagamento PIX com a chave informada.
O usuário visualiza o detalhe do recebedor, nome e chave.
Regras principais
• pixType aceita: CPF, CNPJ, PHONE, EMAIL, EVP (case insensitive)
• pixName padrão: "Pix" quando não informado - nome de quem recebe o pagamento
Campos comuns
Este endpoint herda os campos opcionais padronizados da tag "Enviar Mensagem":
delay, readchat, readmessages, replyid, mentions, track_source, track_id e async.
Exemplo de payload
```json
{
"number": "5511999999999",
"pixType": "EVP",
"pixKey": "123e4567-e89b-12d3-a456-426614174000",
"pixName": "Loja Exemplo"
}
```
Corpo da requisição
Content-Type Schema Obrigatório
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 98
application/json object Sim
Respostas
Status Descrição Schema
200 Botão PIX enviado com sucesso allOf(Message, object)
400 Requisição inválida object
401 Não autorizado object
500 Erro interno do servidor object
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 99
Ações na mensagem e Buscar
Resumo dos endpoints
Método Path Resumo
POST /message/download Baixar arquivo de uma mensagem
POST /message/find Buscar mensagens em um chat
POST /message/markread Marcar mensagens como lidas
POST /message/react Enviar reação a uma mensagem
POST /message/delete Apagar Mensagem Para Todos
POST /message/edit Edita uma mensagem enviada
POST /message/download
Baixar arquivo de uma mensagem
operationId downloadMessage
Tag Ações na mensagem e Buscar
Segurança token
Baixa o arquivo associado a uma mensagem de mídia (imagem, vídeo, áudio, documento ou
sticker).
Parâmetros
• id (string, obrigatório): ID da mensagem
• return_base64 (boolean, default: false): Retorna arquivo em base64
• generate_mp3 (boolean, default: true): Para áudios, define formato de retorno
• true: Retorna MP3
• false: Retorna OGG
• return_link (boolean, default: true): Retorna URL pública do arquivo
• transcribe (boolean, default: false): Transcreve áudios para texto
• openai_apikey (string, opcional): Chave OpenAI para transcrição
• Se não informada, usa a chave salva na instância
• Se informada, atualiza e salva na instância para próximas chamadas
• download_quoted (boolean, default: false): Baixa mídia da mensagem citada
• Útil para baixar conteúdo original de status do WhatsApp
• Quando uma mensagem é resposta a um status, permite baixar a mídia do status original
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 100
• Contextualização: Ao baixar a mídia citada, você identifica o contexto da conversa
• Exemplo: Se alguém responde a uma promoção, baixando a mídia você saberá que a
pergunta é sobre aquela promoção específica
Exemplos
Baixar áudio como MP3:
```json
{
"id": "7EB0F01D7244B421048F0706368376E0",
"generate_mp3": true
}
```
Transcrever áudio:
```json
{
"id": "7EB0F01D7244B421048F0706368376E0",
"transcribe": true
}
```
Apenas base64 (sem salvar):
```json
{
"id": "7EB0F01D7244B421048F0706368376E0",
"return_base64": true,
"return_link": false
}
```
Baixar mídia de status (mensagem citada):
```json
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 101
{
"id": "7EB0F01D7244B421048F0706368376E0",
"download_quoted": true
}
```
Útil quando o cliente responde a uma promoção/status - você baixa a mídia original para
entender sobre qual produto/oferta ele está perguntando.
Resposta
```json
{
"fileURL": "https://api.exemplo.com/files/arquivo.mp3",
"mimetype": "audio/mpeg",
"base64Data": "UklGRkj...",
"transcription": "Texto transcrito"
}
```
Nota:
• Por padrão, se não definido o contrário:
1. áudios são retornados como MP3.
2. E todos os pedidos de download são retornados com URL pública.
• Transcrição requer chave OpenAI válida. A chave pode ser configurada uma vez na
instância e será reutilizada automaticamente.
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Successful file download object
400 Bad Request object
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 102
401 Unauthorized object
404 Not Found object
500 Internal Server Error object
POST /message/find
Buscar mensagens em um chat
operationId findMessages
Tag Ações na mensagem e Buscar
Segurança token
Busca mensagens com múltiplos filtros disponíveis. Este endpoint permite:
1. Busca por ID específico: Use id para encontrar uma mensagem exata
2. Filtrar por chat: Use chatid para mensagens de uma conversa específica
3. Filtrar por rastreamento: Use track_source e track_id para mensagens com dados de
tracking
4. Limitar resultados: Use limit para controlar quantas mensagens retornar
5. Ordenação: Resultados ordenados por data (mais recentes primeiro)
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Lista de mensagens encontradas com metadados de
paginacao
object
400 Parametros invalidos
401 Token invalido ou expirado
404 Chat nao encontrado
500 Erro interno do servidor
POST /message/markread
Marcar mensagens como lidas
operationId markMessageRead
Tag Ações na mensagem e Buscar
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 103
Segurança token
Marca uma ou mais mensagens como lidas. Este endpoint permite:
1. Marcar múltiplas mensagens como lidas de uma vez
2. Atualizar o status de leitura no WhatsApp
3. Sincronizar o status de leitura entre dispositivos
Exemplo de requisição básica:
```json
{
"id": [
"62AD1AD844E518180227BF68DA7ED710",
"ECB9DE48EB41F77BFA8491BFA8D6EF9B"
]
}
```
Exemplo de resposta:
```json
{
"success": true,
"message": "Messages marked as read",
"markedMessages": [
{
"id": "62AD1AD844E518180227BF68DA7ED710",
"timestamp": 1672531200000
},
{
"id": "ECB9DE48EB41F77BFA8491BFA8D6EF9B",
"timestamp": 1672531300000
}
]
}
```
Parâmetros disponíveis:
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 104
• id: Lista de IDs das mensagens a serem marcadas como lidas
Erros comuns:
• 401: Token inválido ou expirado
• 400: Lista de IDs vazia ou inválida
• 404: Uma ou mais mensagens não encontradas
• 500: Erro ao marcar mensagens como lidas
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Messages successfully marked as read object
400 Invalid request payload or missing required fields object
401 Unauthorized - invalid or missing token
500 Server error while processing the request
POST /message/react
Enviar reação a uma mensagem
operationId reactToMessage
Tag Ações na mensagem e Buscar
Segurança token
Envia uma reação (emoji) a uma mensagem específica. Este endpoint permite:
1. Adicionar ou remover reações em mensagens
2. Usar qualquer emoji Unicode válido
3. Reagir a mensagens em chats individuais ou grupos
4. Remover reações existentes
5. Verificar o status da reação enviada
Tipos de reações suportados:
• Qualquer emoji Unicode válido (, ❤️, ὠ, etc)
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 105
• String vazia para remover reação
Exemplo de requisição básica:
```json
{
"number": "5511999999999@s.whatsapp.net",
"text": "",
"id": "3EB0538DA65A59F6D8A251"
}
```
Exemplo de requisição para remover reação:
```json
{
"number": "5511999999999@s.whatsapp.net",
"text": "",
"id": "3EB0538DA65A59F6D8A251"
}
```
Exemplo de resposta:
```json
{
"success": true,
"message": "Reaction sent",
"reaction": {
"id": "3EB0538DA65A59F6D8A251",
"emoji": "",
"timestamp": 1672531200000,
"status": "sent"
}
}
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 106
```
Exemplo de resposta ao remover reação:
```json
{
"success": true,
"message": "Reaction removed",
"reaction": {
"id": "3EB0538DA65A59F6D8A251",
"emoji": null,
"timestamp": 1672531200000,
"status": "removed"
}
}
```
Parâmetros disponíveis:
• number: Número do chat no formato internacional (ex:
5511999999999@s.whatsapp.net)
• text: Emoji Unicode da reação (ou string vazia para remover reação)
• id: ID da mensagem que receberá a reação
Erros comuns:
• 401: Token inválido ou expirado
• 400: Número inválido ou emoji não suportado
• 404: Mensagem não encontrada
• 500: Erro ao enviar reação
Limitações:
• Só é possível reagir a mensagens enviadas por outros usuários
• Não é possível reagir a mensagens antigas (mais de 7 dias)
• O mesmo usuário só pode ter uma reação ativa por mensagem
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 107
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Reação enviada com sucesso object
400 Erro nos dados da requisição object
401 Não autorizado object
404 Mensagem não encontrada object
500 Erro interno do servidor object
POST /message/delete
Apagar Mensagem Para Todos
operationId deleteMessage
Tag Ações na mensagem e Buscar
Segurança token
Apaga uma mensagem para todos os participantes da conversa.
Funcionalidades:
• Apaga mensagens em conversas individuais ou grupos
• Funciona com mensagens enviadas pelo usuário ou recebidas
• Atualiza o status no banco de dados
• Envia webhook de atualização
Notas Técnicas:
1. O ID da mensagem pode ser fornecido em dois formatos:
• ID completo (contém ":"): usado diretamente
• ID curto: concatenado com o owner para busca
2. Gera evento webhook do tipo "messages_update"
3. Atualiza o status da mensagem para "Deleted"
Corpo da requisição
Content-Type Schema Obrigatório
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 108
application/json object Sim
Respostas
Status Descrição Schema
200 Mensagem apagada com sucesso object
400 Payload inválido ou ID de chat/sender inválido object
401 Token não fornecido object
404 Mensagem não encontrada object
500 Erro interno do servidor ou sessão não iniciada object
POST /message/edit
Edita uma mensagem enviada
operationId editMessage
Tag Ações na mensagem e Buscar
Segurança token
Edita o conteúdo de uma mensagem já enviada usando a funcionalidade nativa do
WhatsApp.
O endpoint realiza:
• Busca a mensagem original no banco de dados usando o ID fornecido
• Edita o conteúdo da mensagem para o novo texto no WhatsApp
• Gera um novo ID para a mensagem editada
• Retorna objeto de mensagem completo seguindo o padrão da API
• Dispara eventos SSE/Webhook automaticamente
Importante:
• Só é possível editar mensagens enviadas pela própria instância
• A mensagem deve existir no banco de dados
• O ID pode ser fornecido no formato completo (owner:messageid) ou apenas messageid
• A mensagem deve estar dentro do prazo permitido pelo WhatsApp para edição
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 109
Respostas
Status Descrição Schema
200 Mensagem editada com sucesso object
400 Dados inválidos na requisição object
401 Sem sessão ativa object
404 Mensagem não encontrada object
500 Erro interno do servidor object
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 110
Chats
Resumo dos endpoints
Método Path Resumo
POST /chat/delete Deleta chat
POST /chat/archive Arquivar/desarquivar chat
POST /chat/read Marcar chat como lido/não lido
POST /chat/mute Silenciar chat
POST /chat/pin Fixar/desafixar chat
POST /chat/find Busca chats com filtros
POST /chat/delete
Deleta chat
operationId deleteChat
Tag Chats
Segurança token
Deleta um chat e/ou suas mensagens do WhatsApp e/ou banco de dados.
Você pode escolher deletar:
• Apenas do WhatsApp
• Apenas do banco de dados
• Apenas as mensagens do banco de dados
• Qualquer combinação das opções acima
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Operação realizada com sucesso object
400 Erro nos parâmetros da requisição object
401 Token inválido ou não fornecido
404 Chat não encontrado
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 111
500 Erro interno do servidor
POST /chat/archive
Arquivar/desarquivar chat
operationId archiveChat
Tag Chats
Segurança token
Altera o estado de arquivamento de um chat do WhatsApp.
• Quando arquivado, o chat é movido para a seção de arquivados no WhatsApp
• A ação é sincronizada entre todos os dispositivos conectados
• Não afeta as mensagens ou o conteúdo do chat
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Chat arquivado/desarquivado com sucesso object
400 Dados da requisição inválidos object
401 Token de autenticação ausente ou inválido
500 Erro ao executar a operação object
POST /chat/read
Marcar chat como lido/não lido
operationId markChatRead
Tag Chats
Segurança token
Atualiza o status de leitura de um chat no WhatsApp.
Quando um chat é marcado como lido:
• O contador de mensagens não lidas é zerado
• O indicador visual de mensagens não lidas é removido
• O remetente recebe confirmação de leitura (se ativado)
Quando marcado como não lido:
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 112
• O chat aparece como pendente de leitura
• Não afeta as confirmações de leitura já enviadas
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Status de leitura atualizado com sucesso object
401 Token de autenticação ausente ou inválido
404 Chat não encontrado
500 Erro ao atualizar status de leitura
POST /chat/mute
Silenciar chat
operationId muteChat
Tag Chats
Segurança token
Silencia notificações de um chat por um período específico.
As opções de silenciamento são:
* 0 - Remove o silenciamento
* 8 - Silencia por 8 horas
* 168 - Silencia por 1 semana (168 horas)
* -1 - Silencia permanentemente
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Chat silenciado com sucesso object
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 113
400 Duração inválida ou formato de número incorreto
401 Token inválido ou ausente
404 Chat não encontrado
POST /chat/pin
Fixar/desafixar chat
operationId pinChat
Tag Chats
Segurança token
Fixa ou desafixa um chat no topo da lista de conversas. Chats fixados permanecem
no topo mesmo quando novas mensagens são recebidas em outros chats.
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Chat fixado/desafixado com sucesso object
400 Erro na requisição object
401 Não autorizado object
POST /chat/find
Busca chats com filtros
operationId findChats
Tag Chats
Segurança token
Busca chats com diversos filtros e ordenação. Suporta filtros em todos os campos do chat,
paginação e ordenação customizada.
Operadores de filtro:
• ~ : LIKE (contém)
• !~ : NOT LIKE (não contém)
• != : diferente
• >= : maior ou igual
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 114
• > : maior que
• <= : menor ou igual
• < : menor que
• Sem operador: LIKE (contém)
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Lista de chats encontrados object
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 115
Contatos
Resumo dos endpoints
Método Path Resumo
GET /contacts Retorna lista de contatos do WhatsApp
POST /contacts/list Listar todos os contatos com paginacao
POST /contact/add Adiciona um contato à agenda
POST /contact/remove Remove um contato da agenda
POST /chat/details Obter Detalhes Completos
POST /chat/check Verificar Números no WhatsApp
GET /contacts
Retorna lista de contatos do WhatsApp
operationId checkContacts
Tag Contatos
Segurança token
Retorna a lista de contatos salvos na agenda do celular e que estão no WhatsApp.
O endpoint realiza:
• Busca todos os contatos armazenados
• Retorna dados formatados incluindo JID e informações de nome
Respostas
Status Descrição Schema
200 Lista de contatos retornada com sucesso array[object]
401 Sem sessão ativa object
500 Erro interno do servidor object
POST /contacts/list
Listar todos os contatos com paginacao
operationId listContacts
Tag Contatos
Segurança token
Retorna uma lista paginada de contatos da instancia do WhatsApp.
Use este endpoint (POST) para controlar pagina, tamanho e offset via corpo da requisicao.
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 116
A rota GET /contacts continua disponivel para quem prefere a lista completa sem
paginacao.
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Lista de contatos recuperada com sucesso object
401 Token nao fornecido ou invalido object
500 Erro interno do servidor ao recuperar contatos object
POST /contact/add
Adiciona um contato à agenda
operationId addContact
Tag Contatos
Segurança token
Adiciona um novo contato à agenda do celular.
O endpoint realiza:
• Adiciona o contato à agenda usando o WhatsApp
• Usa o campo 'name' tanto para o nome completo quanto para o primeiro nome
• Salva as informações do contato na agenda do WhatsApp
• Retorna informações do contato adicionado
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Contato adicionado com sucesso object
400 Dados inválidos na requisição object
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 117
401 Sem sessão ativa object
500 Erro interno do servidor object
POST /contact/remove
Remove um contato da agenda
operationId removeContact
Tag Contatos
Segurança token
Remove um contato da agenda do celular.
O endpoint realiza:
• Remove o contato da agenda usando o WhatsApp AppState
• Atualiza a lista de contatos sincronizada
• Retorna confirmação da remoção
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Contato removido com sucesso object
400 Dados inválidos na requisição object
401 Sem sessão ativa object
404 Contato não encontrado object
500 Erro interno do servidor object
POST /chat/details
Obter Detalhes Completos
operationId getChatDetails
Tag Contatos
Segurança token
Retorna informações completas sobre um contato ou chat, incluindo todos os campos
disponíveis do modelo Chat.
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 118
Funcionalidades:
• Retorna chat completo: Todos os campos do modelo Chat (mais de 60 campos)
• Busca informações para contatos individuais e grupos
• URLs de imagem em dois tamanhos: preview (menor) ou full (original)
• Combina informações de diferentes fontes: WhatsApp, contatos salvos, leads
• Atualiza automaticamente dados desatualizados no banco
Campos Retornados:
• Informações básicas: id, wa_fastid, wa_chatid, owner, name, phone
• Dados do WhatsApp: wa_name, wa_contactName, wa_archived, wa_isBlocked, etc.
• Dados de lead/CRM: lead_name, lead_email, lead_status, lead_field01-20, etc.
• Informações de grupo: wa_isGroup, wa_isGroup_admin, wa_isGroup_announce, etc.
• Chatbot: chatbot_summary, chatbot_lastTrigger_id, chatbot_disableUntil, etc.
• Configurações: wa_muteEndTime, wa_isPinned, wa_unreadCount, etc.
Comportamento:
• Para contatos individuais:
• Busca nome verificado do WhatsApp
• Verifica nome salvo nos contatos
• Formata número internacional
• Calcula grupos em comum
• Para grupos:
• Busca nome do grupo
• Verifica status de comunidade
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Informações completas do chat retornadas com
sucesso
allOf(Chat, object)
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 119
400 Payload inválido ou número inválido object
401 Token não fornecido object
500 Erro interno do servidor ou sessão não iniciada object
POST /chat/check
Verificar Números no WhatsApp
operationId checkChat
Tag Contatos
Segurança token
Verifica se números fornecidos estão registrados no WhatsApp e retorna informações
detalhadas.
Funcionalidades:
• Verifica múltiplos números simultaneamente
• Suporta números individuais e IDs de grupo
• Retorna nome verificado quando disponível
• Identifica grupos e comunidades
• Verifica subgrupos de comunidades
Comportamento específico:
• Para números individuais:
• Verifica registro no WhatsApp
• Retorna nome verificado se disponível
• Normaliza formato do número
• Para grupos:
• Verifica existência
• Retorna nome do grupo
• Retorna id do grupo de anúncios se buscado por id de comunidade
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 120
Status Descrição Schema
200 Resultado da verificação array[object]
400 Payload inválido ou sem números object
401 Sem sessão ativa object
500 Erro interno do servidor object
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 121
Bloqueios
Resumo dos endpoints
Método Path Resumo
POST /chat/block Bloqueia ou desbloqueia contato do WhatsApp
GET /chat/blocklist Lista contatos bloqueados
POST /chat/block
Bloqueia ou desbloqueia contato do WhatsApp
operationId blockChat
Tag Bloqueios
Segurança token
Bloqueia ou desbloqueia um contato do WhatsApp. Contatos bloqueados não podem enviar
mensagens
para a instância e a instância não pode enviar mensagens para eles.
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Operação realizada com sucesso object
401 Não autorizado - token inválido
404 Contato não encontrado
500 Erro do servidor ao processar a requisição
GET /chat/blocklist
Lista contatos bloqueados
operationId getBlocklist
Tag Bloqueios
Segurança token
Retorna a lista completa de contatos que foram bloqueados pela instância.
Esta lista é atualizada em tempo real conforme contatos são bloqueados/desbloqueados.
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 122
Respostas
Status Descrição Schema
200 Lista de contatos bloqueados recuperada com
sucesso
object
401 Token inválido ou não fornecido
500 Erro interno do servidor ou instância não conectada
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 123
Etiquetas
Resumo dos endpoints
Método Path Resumo
POST /chat/labels Gerencia labels de um chat
POST /label/edit Editar etiqueta
GET /labels Buscar todas as etiquetas
POST /chat/labels
Gerencia labels de um chat
operationId setChatLabels
Tag Etiquetas
Segurança token
Atualiza as labels associadas a um chat específico. Este endpoint oferece três modos de
operação:
1. Definir todas as labels (labelids): Define o conjunto completo de labels para o chat,
substituindo labels existentes
2. Adicionar uma label (add_labelid): Adiciona uma única label ao chat sem afetar as
existentes
3. Remover uma label (remove_labelid): Remove uma única label do chat sem afetar as
outras
Importante: Use apenas um dos três parâmetros por requisição. Labels inexistentes serão
rejeitadas.
As labels devem ser fornecidas no formato id ou labelid encontradas na função get labels.
Corpo da requisição
Content-Type Schema Obrigatório
application/json oneOf(, , ) Sim
Respostas
Status Descrição Schema
200 Labels atualizadas com sucesso object
400 Erro na requisição object
404 Chat não encontrado object
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 124
POST /label/edit
Editar etiqueta
operationId editLabel
Tag Etiquetas
Segurança token
Edita uma etiqueta existente na instância.
Permite alterar nome, cor ou deletar a etiqueta.
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Etiqueta editada com sucesso object
400 Payload inválido object
500 Erro interno do servidor ou sessão inválida object
GET /labels
Buscar todas as etiquetas
operationId listLabels
Tag Etiquetas
Segurança token
Retorna a lista completa de etiquetas da instância.
Respostas
Status Descrição Schema
200 Lista de etiquetas retornada com sucesso array[Label]
500 Erro interno do servidor object
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 125
Grupos e Comunidades
Resumo dos endpoints
Método Path Resumo
POST /group/create Criar um novo grupo
POST /group/info Obter informações detalhadas de um grupo
POST /group/inviteInfo Obter informações de um grupo pelo código de
convite
POST /group/join Entrar em um grupo usando código de convite
POST /group/leave Sair de um grupo
GET /group/list Listar todos os grupos
POST /group/list Listar todos os grupos com filtros e paginacao
POST /group/resetInviteCode Resetar código de convite do grupo
POST /group/updateAnnounce Configurar permissões de envio de mensagens
no grupo
POST /group/updateDescription Atualizar descrição do grupo
POST /group/updateImage Atualizar imagem do grupo
POST /group/updateLocked Configurar permissão de edição do grupo
POST /group/updateName Atualizar nome do grupo
POST /group/updateParticipants Gerenciar participantes do grupo
POST /community/create Criar uma comunidade
POST /community/editgroups Gerenciar grupos em uma comunidade
POST /group/create
Criar um novo grupo
operationId createGroup
Tag Grupos e Comunidades
Segurança token
Cria um novo grupo no WhatsApp com participantes iniciais.
Detalhes
• Requer autenticação via token da instância
• Os números devem ser fornecidos sem formatação (apenas dígitos)
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 126
Limitações
• Mínimo de 1 participante além do criador
Comportamento
• Retorna informações detalhadas do grupo criado
• Inclui lista de participantes adicionados com sucesso/falha
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Grupo criado com sucesso Group
400 Erro de payload inválido object
500 Erro interno do servidor object
POST /group/info
Obter informações detalhadas de um grupo
operationId getGroupInfo
Tag Grupos e Comunidades
Segurança token
Recupera informações completas de um grupo do WhatsApp, incluindo:
• Detalhes do grupo
• Participantes
• Configurações
• Link de convite (opcional)
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 127
Status Descrição Schema
200 Informações do grupo obtidas com sucesso Group
400 Código de convite inválido ou mal formatado object
404 Grupo não encontrado ou link de convite expirado object
500 Erro interno do servidor object
POST /group/inviteInfo
Obter informações de um grupo pelo código de convite
operationId getGroupInviteInfo
Tag Grupos e Comunidades
Segurança token
Retorna informações detalhadas de um grupo usando um código de convite ou URL completo
do WhatsApp.
Esta rota permite:
• Recuperar informações básicas sobre um grupo antes de entrar
• Validar um link de convite
• Obter detalhes como nome do grupo, número de participantes e restrições de entrada
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Informações do grupo obtidas com sucesso Group
400 Código de convite inválido ou mal formatado object
404 Grupo não encontrado ou link de convite expirado object
500 Erro interno do servidor object
POST /group/join
Entrar em um grupo usando código de convite
operationId joinGroup
Tag Grupos e Comunidades
Segurança token
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 128
Permite entrar em um grupo do WhatsApp usando um código de convite ou URL completo.
Características:
• Suporta código de convite ou URL completo
• Valida o código antes de tentar entrar no grupo
• Retorna informações básicas do grupo após entrada bem-sucedida
• Trata possíveis erros como convite inválido ou expirado
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Entrada no grupo realizada com sucesso object
400 Código de convite inválido object
403 Usuário já está no grupo ou não tem permissão para
entrar
object
500 Erro interno do servidor object
POST /group/leave
Sair de um grupo
operationId leaveGroup
Tag Grupos e Comunidades
Segurança token
Remove o usuário atual de um grupo específico do WhatsApp.
Requisitos:
• O usuário deve estar conectado a uma instância válida
• O usuário deve ser um membro do grupo
Comportamentos:
• Se o usuário for o último administrador, o grupo será dissolvido
• Se o usuário for um membro comum, será removido do grupo
Corpo da requisição
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 129
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Saída do grupo realizada com sucesso object
400 Erro de payload inválido object
500 Erro interno do servidor ou falha na conexão object
GET /group/list
Listar todos os grupos
operationId listGroups
Tag Grupos e Comunidades
Segurança token
Retorna uma lista com todos os grupos disponíveis para a instância atual do WhatsApp.
Recursos adicionais:
• Suporta atualização forçada do cache de grupos
• Recupera informações detalhadas de grupos conectados
Parâmetros
Nome Em Tipo Obrigatór
io
Descrição
force query boolean Não Se definido como true, força
a atualização do cache de
grupos. Útil para garantir que
as informações mais recentes
sejam recuperadas.
Comportamentos: - false
(padrão): Usa informações em
cache - true: Busca dados
atualizados diretamente do
WhatsApp
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 130
noparticipants query boolean Não Se definido como true,
retorna a lista de grupos sem
incluir os participantes. Útil
para otimizar a resposta
quando não há necessidade
dos dados dos participantes.
Comportamentos: - false
(padrão): Retorna grupos com
lista completa de
participantes - true: Retorna
grupos sem incluir os
participantes
Respostas
Status Descrição Schema
200 Lista de grupos recuperada com sucesso object
500 Erro interno do servidor ao recuperar grupos object
POST /group/list
Listar todos os grupos com filtros e paginacao
operationId refreshGroups
Tag Grupos e Comunidades
Segurança token
Retorna uma lista com todos os grupos disponiveis para a instancia atual do WhatsApp, com
opcoes de filtros e paginacao via corpo (POST).
A rota GET continua para quem prefere a listagem direta sem paginacao.
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Lista de grupos recuperada com sucesso object
500 Erro interno do servidor ao recuperar grupos object
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 131
POST /group/resetInviteCode
Resetar código de convite do grupo
operationId resetGroupInviteCode
Tag Grupos e Comunidades
Segurança token
Gera um novo código de convite para o grupo, invalidando o código de convite anterior.
Somente administradores do grupo podem realizar esta ação.
Principais características:
• Invalida o link de convite antigo
• Cria um novo link único
• Retorna as informações atualizadas do grupo
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Código de convite resetado com sucesso object
400 Erro de validação object
403 Usuário sem permissão object
500 Erro interno do servidor object
POST /group/updateAnnounce
Configurar permissões de envio de mensagens no grupo
operationId updateGroupAnnounce
Tag Grupos e Comunidades
Segurança token
Define as permissões de envio de mensagens no grupo, permitindo restringir o envio apenas
para administradores.
Quando ativado (announce=true):
• Apenas administradores podem enviar mensagens
• Outros participantes podem apenas ler
• Útil para anúncios importantes ou controle de spam
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 132
Quando desativado (announce=false):
• Todos os participantes podem enviar mensagens
• Configuração padrão para grupos normais
Requer que o usuário seja administrador do grupo para fazer alterações.
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Configuração atualizada com sucesso object
401 Token de autenticação ausente ou inválido
403 Usuário não é administrador do grupo
404 Grupo não encontrado
500 Erro interno do servidor ou falha na API do WhatsApp
POST /group/updateDescription
Atualizar descrição do grupo
operationId updateGroupDescription
Tag Grupos e Comunidades
Segurança token
Altera a descrição (tópico) do grupo WhatsApp especificado.
Requer que o usuário seja administrador do grupo.
A descrição aparece na tela de informações do grupo e pode ser visualizada por todos os
participantes.
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 133
200 Descrição atualizada com sucesso object
401 Token inválido ou ausente
403 Usuário não é administrador do grupo
404 Grupo não encontrado
413 Descrição excede o limite máximo permitido
POST /group/updateImage
Atualizar imagem do grupo
operationId updateGroupImage
Tag Grupos e Comunidades
Segurança token
Altera a imagem do grupo especificado. A imagem pode ser enviada como URL ou como
string base64.
Requisitos da imagem:
• Formato: JPEG
• Resolução máxima: 640x640 pixels
• Imagens maiores ou diferente de JPEG não são aceitas pelo WhatsApp
Para remover a imagem atual, envie "remove" ou "delete" no campo image.
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Imagem atualizada com sucesso object
400 Erro nos parâmetros da requisição
401 Token inválido ou expirado
403 Usuário não é administrador do grupo
413 Imagem muito grande
415 Formato de imagem inválido
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 134
POST /group/updateLocked
Configurar permissão de edição do grupo
operationId updateGroupLocked
Tag Grupos e Comunidades
Segurança token
Define se apenas administradores podem editar as informações do grupo.
Quando bloqueado (locked=true), apenas administradores podem alterar nome, descrição,
imagem e outras configurações do grupo. Quando desbloqueado (locked=false),
qualquer participante pode editar as informações.
Importante:
• Requer que o usuário seja administrador do grupo
• Afeta edições de nome, descrição, imagem e outras informações do grupo
• Não controla permissões de adição de membros
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Operação realizada com sucesso object
403 Usuário não é administrador do grupo
404 Grupo não encontrado
POST /group/updateName
Atualizar nome do grupo
operationId updateGroupName
Tag Grupos e Comunidades
Segurança token
Altera o nome de um grupo do WhatsApp. Apenas administradores do grupo podem realizar
esta operação.
O nome do grupo deve seguir as diretrizes do WhatsApp e ter entre 1 e 25 caracteres.
Corpo da requisição
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 135
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Nome do grupo atualizado com sucesso object
400 Erro de validação na requisição object
401 Token de autenticação ausente ou inválido object
403 Usuário não é administrador do grupo object
404 Grupo não encontrado object
500 Erro interno do servidor object
POST /group/updateParticipants
Gerenciar participantes do grupo
operationId updateGroupParticipants
Tag Grupos e Comunidades
Segurança token
Gerencia participantes do grupo através de diferentes ações:
• Adicionar ou remover participantes
• Promover ou rebaixar administradores
• Aprovar ou rejeitar solicitações pendentes
Requer que o usuário seja administrador do grupo para executar as ações.
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Sucesso na operação object
400 Erro nos parâmetros da requisição
403 Usuário não é administrador do grupo
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 136
500 Erro interno do servidor
POST /community/create
Criar uma comunidade
operationId createCommunity
Tag Grupos e Comunidades
Segurança token
Cria uma nova comunidade no WhatsApp. Uma comunidade é uma estrutura que permite
agrupar múltiplos grupos relacionados sob uma única administração.
A comunidade criada inicialmente terá apenas o grupo principal (announcements), e grupos
adicionais podem ser vinculados posteriormente usando o endpoint
/community/updategroups.
Observações importantes:
• O número que cria a comunidade torna-se automaticamente o administrador
• A comunidade terá um grupo principal de anúncios criado automaticamente
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Comunidade criada com sucesso object
400 Erro na requisição object
401 Token inválido ou não fornecido
403 Sem permissão para criar comunidades
429 Limite de criação de comunidades atingido
500 Erro interno do servidor
POST /community/editgroups
Gerenciar grupos em uma comunidade
operationId editCommunityGroups
Tag Grupos e Comunidades
Segurança token
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 137
Adiciona ou remove grupos de uma comunidade do WhatsApp. Apenas administradores da
comunidade podem executar estas operações.
Funcionalidades
• Adicionar múltiplos grupos simultaneamente a uma comunidade
• Remover grupos de uma comunidade existente
• Suporta operações em lote
Limitações
• Os grupos devem existir previamente
• A comunidade deve existir e o usuário deve ser administrador
• Grupos já vinculados não podem ser adicionados novamente
• Grupos não vinculados não podem ser removidos
Ações Disponíveis
• add: Adiciona os grupos especificados à comunidade
• remove: Remove os grupos especificados da comunidade
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Operação realizada com sucesso object
400 Requisição inválida
401 Não autorizado
403 Usuário não é administrador da comunidade
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 138
Respostas Rápidas
Gerenciamento de respostas rápidas para agilizar o atendimento.
⚠️ Importante: Este recurso tem serventia apenas se você utilizar um sistema
frontend/interface
personalizada para registrar e utilizar as respostas. A API apenas armazena as respostas,
mas não as aplica automaticamente.
Como funciona:
• Criar: Cadastre respostas pré-definidas com títulos e conteúdo
• Listar: Recupere todas as respostas cadastradas para exibir na sua interface
• Usar: Seu sistema frontend pode usar essas respostas para agilizar digitação
Casos de uso:
• Interfaces web personalizadas de atendimento
• Apps mobile com sugestões de resposta
• Sistemas CRM com templates de mensagem
• Ferramentas de produtividade para atendentes
Não é um chatbot: Para respostas automáticas, use os recursos de Chatbot.
Resumo dos endpoints
Método Path Resumo
POST /quickreply/edit Criar, atualizar ou excluir resposta rápida
GET /quickreply/showall Listar todas as respostas rápidas
POST /quickreply/edit
Criar, atualizar ou excluir resposta rápida
operationId editQuickReply
Tag Respostas Rápidas
Segurança token
Gerencia templates de respostas rápidas para agilizar o atendimento. Suporta mensagens de
texto e mídia.
• Para criar: não inclua o campo id
• Para atualizar: inclua o id existente
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 139
• Para excluir: defina delete: true e inclua o id
Observação: Templates originados do WhatsApp (onWhatsApp=true) não podem ser
modificados ou excluídos.
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Operação concluída com sucesso object
400 Requisição inválida (erro de validação)
403 Não é possível modificar template originado do
WhatsApp
404 Template não encontrado
500 Erro no servidor
GET /quickreply/showall
Listar todas as respostas rápidas
operationId listQuickReplies
Tag Respostas Rápidas
Segurança token
Retorna todas as respostas rápidas cadastradas para a instância autenticada
Respostas
Status Descrição Schema
200 Lista de respostas rápidas array[QuickReply]
500 Erro no servidor
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 140
CRM
Sistema completo de gestão de relacionamento com clientes integrado à API.
 Armazenamento interno: Todos os dados dos leads ficam salvos diretamente na API,
eliminando a necessidade de bancos de dados externos. Sua aplicação pode focar apenas
na interface e lógica de negócio.
Recursos disponíveis:
•  20+ campos personalizáveis: Nome, telefone, email, empresa, observações, etc.
• ️ Sistema de etiquetas: Organize e categorize seus contatos
•  Busca avançada: Filtre por qualquer campo ou etiqueta
•  Histórico completo: Todas as interações ficam registradas automaticamente
 Placeholders em mensagens:
Use variáveis dinâmicas nas mensagens para personalização automática:
```
Olá {{nome}}! Vi que você trabalha na {{empresa}}.
Seu email {{email}} está correto?
Observações: {{observacoes}}
```
Fluxo típico:
1. Captura: Leads chegam via WhatsApp ou formulários
2. Enriquecimento: Adicione dados usando /chat/editLead
3. Segmentação: Organize com etiquetas
4. Comunicação: Envie mensagens personalizadas com placeholders
5. Acompanhamento: Histórico fica salvo automaticamente
Ideal para: Vendas, marketing, atendimento, qualificação de leads
Resumo dos endpoints
Método Path Resumo
POST /instance/updateFieldsMap Atualizar campos personalizados de leads
POST /chat/editLead Edita informações de lead
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 141
POST /instance/updateFieldsMap
Atualizar campos personalizados de leads
operationId updateFieldsMap
Tag CRM
Segurança token
Atualiza os campos personalizados (custom fields) de uma instância.
Permite configurar até 20 campos personalizados para armazenamento de
informações adicionais sobre leads.
Cada campo pode armazenar até 255 caracteres e aceita qualquer tipo de dado.
Campos disponíveis:
• lead_field01 a lead_field20
Exemplo de uso:
1. Armazenar informações adicionais sobre leads
2. Criar campos personalizados para integração com outros sistemas
3. Armazenar tags ou categorias personalizadas
4. Manter histórico de interações com o lead
Exemplo de requisição:
```json
{
"lead_field01": "nome",
"lead_field02": "email",
"lead_field03": "telefone",
"lead_field04": "cidade",
"lead_field05": "estado",
"lead_field06": "idade",
"lead_field07": "interesses",
"lead_field08": "origem",
"lead_field09": "status",
"lead_field10": "valor",
"lead_field11": "observacoes",
"lead_field12": "ultima_interacao",
"lead_field13": "proximo_contato",
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 142
"lead_field14": "vendedor",
"lead_field15": "produto_interesse",
"lead_field16": "fonte_captacao",
"lead_field17": "score",
"lead_field18": "tags",
"lead_field19": "historico",
"lead_field20": "custom"
}
```
Exemplo de resposta:
```json
{
"success": true,
"message": "Custom fields updated successfully",
"instance": {
"id": "r183e2ef9597845",
"name": "minha-instancia",
"fieldsMap": {
"lead_field01": "nome",
"lead_field02": "email",
"lead_field03": "telefone",
"lead_field04": "cidade",
"lead_field05": "estado",
"lead_field06": "idade",
"lead_field07": "interesses",
"lead_field08": "origem",
"lead_field09": "status",
"lead_field10": "valor",
"lead_field11": "observacoes",
"lead_field12": "ultima_interacao",
"lead_field13": "proximo_contato",
"lead_field14": "vendedor",
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 143
"lead_field15": "produto_interesse",
"lead_field16": "fonte_captacao",
"lead_field17": "score",
"lead_field18": "tags",
"lead_field19": "historico",
"lead_field20": "custom"
}
}
}
```
Erros comuns:
• 400: Campos inválidos ou payload mal formatado
• 401: Token inválido ou expirado
• 404: Instância não encontrada
• 500: Erro ao atualizar campos no banco de dados
Restrições:
• Cada campo pode ter no máximo 255 caracteres
• Campos vazios serão mantidos com seus valores atuais
• Apenas os campos enviados serão atualizados
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Sucesso Instance
401 Token inválido/expirado
404 Instância não encontrada
500 Erro interno
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 144
POST /chat/editLead
Edita informações de lead
operationId editLead
Tag CRM
Segurança token
Atualiza as informações de lead associadas a um chat. Permite modificar status do ticket,
atribuição de atendente, posição no kanban, tags e outros campos customizados.
As alterações são refletidas imediatamente no banco de dados e disparam eventos
webhook/SSE
para manter a aplicação sincronizada.
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Lead atualizado com sucesso Chat
400 Payload inválido
404 Chat não encontrado
500 Erro interno do servidor
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 145
Mensagem em massa
Resumo dos endpoints
Método Path Resumo
POST /sender/simple Criar nova campanha (Simples)
POST /sender/advanced Criar envio em massa avançado
POST /sender/edit Controlar campanha de envio em massa
POST /sender/cleardone Limpar mensagens enviadas
DELETE /sender/clearall Limpar toda fila de mensagens
GET /sender/listfolders Listar campanhas de envio
POST /sender/listmessages Listar mensagens de uma campanha
POST /sender/simple
Criar nova campanha (Simples)
operationId sendSimpleCampaign
Tag Mensagem em massa
Segurança token
Cria uma nova campanha de envio com configurações básicas
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 campanha criada com sucesso object
400 Erro nos parâmetros da requisição object
401 Erro de autenticação object
409 Conflito - campanha já existe object
500 Erro interno do servidor object
POST /sender/advanced
Criar envio em massa avançado
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 146
operationId sendAdvancedCampaign
Tag Mensagem em massa
Segurança token
Cria um novo envio em massa com configurações avançadas, permitindo definir
múltiplos destinatários e mensagens com delays personalizados.
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Mensagens adicionadas à fila com sucesso object
400 Erro nos parâmetros da requisição object
401 Não autorizado - token inválido ou ausente object
500 Erro interno do servidor object
POST /sender/edit
Controlar campanha de envio em massa
operationId editCampaign
Tag Mensagem em massa
Segurança token
Permite controlar campanhas de envio de mensagens em massa através de diferentes ações:
Ações Disponíveis:
 stop - Pausar campanha
• Pausa uma campanha ativa ou agendada
• Altera o status para "paused"
• Use quando quiser interromper temporariamente o envio
• Mensagens já enviadas não são afetadas
▶️ continue - Continuar campanha
• Retoma uma campanha pausada
• Altera o status para "scheduled"
• Use para continuar o envio após pausar uma campanha
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 147
• Não funciona em campanhas já concluídas ("done")
️ delete - Deletar campanha
• Remove completamente a campanha
• Deleta apenas mensagens NÃO ENVIADAS (status "scheduled")
• Mensagens já enviadas são preservadas no histórico
• Operação é executada de forma assíncrona
Status de Campanhas:
• scheduled: Agendada para envio
• sending: Enviando mensagens
• paused: Pausada pelo usuário
• done: Concluída (não pode ser alterada)
• deleting: Sendo deletada (operação em andamento)
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Ação realizada com sucesso oneOf(object, object,
object)
400 Requisição inválida object
POST /sender/cleardone
Limpar mensagens enviadas
operationId clearDoneCampaigns
Tag Mensagem em massa
Segurança token
Inicia processo de limpeza de mensagens antigas em lote que já foram enviadas com
sucesso. Por padrão, remove mensagens mais antigas que 7 dias.
Corpo da requisição
Content-Type Schema Obrigatório
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 148
application/json object Não
Respostas
Status Descrição Schema
200 Limpeza iniciada com sucesso object
DELET
E
/sender/clearall
Limpar toda fila de mensagens
operationId clearAllCampaigns
Tag Mensagem em massa
Segurança token
Remove todas as mensagens da fila de envio em massa, incluindo mensagens pendentes e
já enviadas.
Esta é uma operação irreversível.
Respostas
Status Descrição Schema
200 Fila de mensagens limpa com sucesso object
401 Não autorizado - token inválido ou ausente object
500 Erro interno do servidor object
GET /sender/listfolders
Listar campanhas de envio
operationId listCampaignFolders
Tag Mensagem em massa
Segurança Nenhuma (público)
Retorna todas as campanhas de mensagens em massa com possibilidade de filtro por status
Parâmetros
Nome Em Tipo Obrigatór
io
Descrição
status query string Não Filtrar campanhas por status
Respostas
Status Descrição Schema
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 149
200 Lista de campanhas retornada com sucesso array[MessageQueueFold
er]
500 Erro interno do servidor object
POST /sender/listmessages
Listar mensagens de uma campanha
operationId listCampaignMessages
Tag Mensagem em massa
Segurança token
Retorna a lista de mensagens de uma campanha específica, com opções de filtro por status e
paginação
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Não
Respostas
Status Descrição Schema
200 Lista de mensagens retornada com sucesso object
400 Requisição inválida object
500 Erro interno do servidor object
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 150
Integração Chatwoot
 INTEGRAÇÃO BETA - Sistema de integração com Chatwoot para atendimento unificado
⚠️ AVISO: Esta integração está em fase BETA. Use por sua conta e risco. Recomendamos
testes em ambiente não-produtivo antes do uso em produção.
Esta categoria contém recursos para configurar e gerenciar a integração com o Chatwoot,
uma plataforma de atendimento ao cliente open-source. A integração permite centralizar
conversas do WhatsApp no Chatwoot.
Recursos disponíveis:
•  Configuração Completa: Configure URL, tokens e credenciais do Chatwoot
•  Sincronização Bidirecional: Mensagens novas entre WhatsApp e Chatwoot são
sincronizadas automaticamente
•  Gerenciamento de Contatos: Sincronização automática de nomes e telefones
•  Atualização LID→PN: Migração automática de Local ID para Phone Number
• ️ Nomes Inteligentes: Sistema de nomes com til (~) para atualização automática
•  Separação de Grupos: Opção para ignorar grupos na sincronização
•  Assinatura de Mensagens: Identificação do agente nas mensagens enviadas
•  Webhook Automático: URL gerada automaticamente para configurar no Chatwoot
️ Sistema de Nomes Inteligentes:
• Nomes com til (~): Atualizados automaticamente quando contato modifica nome no
WhatsApp
• Nomes específicos: Para nome fixo, remover til (~) do nome no Chatwoot
• Exemplo: "~João Silva" = automático, "João Silva" = fixo
• Migração LID→PN: Sem duplicação de conversas durante a transição
• Respostas nativas: Aparecem diretamente no Chatwoot sem marcações externas
⚠️ Limitações conhecidas:
• Sincronização de histórico: Não implementada - apenas mensagens novas são
sincronizadas
Casos de uso:
• Atendimento centralizado no Chatwoot
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 151
• Equipes de suporte com múltiplos agentes
• Integração com CRM via Chatwoot
• Centralização de canais de comunicação
• Gestão automática de contatos e nomes
Ideal para: Empresas com equipes de atendimento, call centers, suporte técnico (em
ambiente de testes)
Requer: Instância do Chatwoot configurada, tokens de API e ambiente de testes
 Lembre-se: Integração em BETA - funcionalidades podem mudar sem aviso prévio
Resumo dos endpoints
Método Path Resumo
GET /chatwoot/config Obter configuração do Chatwoot
PUT /chatwoot/config Atualizar configuração do Chatwoot
GET /chatwoot/config
Obter configuração do Chatwoot
operationId getChatwootConfig
Tag Integração Chatwoot
Segurança token
Retorna a configuração atual da integração com Chatwoot para a instância.
Funcionalidades:
• Retorna todas as configurações do Chatwoot incluindo credenciais
• Mostra status de habilitação da integração
• Útil para verificar configurações atuais antes de fazer alterações
Respostas
Status Descrição Schema
200 Configuração obtida com sucesso object
401 Token inválido/expirado
500 Erro interno do servidor
PUT /chatwoot/config
Atualizar configuração do Chatwoot
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 152
operationId updateChatwootConfig
Tag Integração Chatwoot
Segurança token
Atualiza a configuração da integração com Chatwoot para a instância.
Funcionalidades:
• Configura todos os parâmetros da integração Chatwoot
• Reinicializa automaticamente o cliente Chatwoot quando habilitado
• Retorna URL do webhook para configurar no Chatwoot
• Sincronização bidirecional de mensagens novas entre WhatsApp e Chatwoot
• Sincronização automática de contatos (nome e telefone)
• Atualização automática LID → PN (Local ID para Phone Number)
• Sistema de nomes inteligentes com til (~)
Configuração no Chatwoot:
1. Após configurar via API, use a URL retornada no webhook settings da inbox no Chatwoot
2. Configure como webhook URL na sua inbox do Chatwoot
3. A integração ficará ativa e sincronizará mensagens e contatos automaticamente
️ Sistema de Nomes Inteligentes:
• Nomes com til (~): São atualizados automaticamente quando o contato modifica seu
nome no WhatsApp
• Nomes específicos: Para definir um nome fixo, remova o til (~) do nome no Chatwoot
• Exemplo: "~João Silva" será atualizado automaticamente, "João Silva" (sem til)
permanecerá fixo
• Atualização LID→PN: Contatos migram automaticamente de Local ID para Phone Number
quando disponível
• Sem duplicação: Durante a migração LID→PN, não haverá duplicação de conversas
• Respostas nativas: Todas as respostas dos agentes aparecem nativamente no Chatwoot
 AVISO IMPORTANTE - INTEGRAÇÃO BETA:
• Fase Beta: Esta integração está em fase de desenvolvimento e testes
• Uso por conta e risco: O usuário assume total responsabilidade pelo uso
• Recomendação: Teste em ambiente não-produtivo antes de usar em produção
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 153
• Suporte limitado: Funcionalidades podem mudar sem aviso prévio
⚠️ Limitações Conhecidas:
• Sincronização de histórico: Não implementada - apenas mensagens novas são
sincronizadas
Corpo da requisição
Content-Type Schema Obrigatório
application/json object Sim
Respostas
Status Descrição Schema
200 Configuração atualizada com sucesso object
400 Dados inválidos no body da requisição
401 Token inválido/expirado
500 Erro interno ao salvar configuração
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 154
Modelos de dados (Schemas)
Modelos reutilizáveis definidos em `components/schemas`.
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 155
Instance
Representa uma instância do WhatsApp
Tipo: object
Campos
Campo Tipo Obrigatór
io
Descrição
id string(uuid) Não ID único gerado automaticamente
token string Não Token de autenticação da instância
status string Não Status atual da conexão
paircode string Não Código de pareamento
qrcode string Não QR Code em base64 para
autenticação
name string Não Nome da instância
profileName string Não Nome do perfil WhatsApp
profilePicUrl string(uri) Não URL da foto do perfil
isBusiness boolean Não Indica se é uma conta business
plataform string Não Plataforma de origem
(iOS/Android/Web)
systemName string Não Nome do sistema operacional
owner string Não Proprietário da instância
current_presence string Não Status atual de presença da
instância (campo não persistido)
lastDisconnect string(date-time) Não Data/hora da última desconexão
lastDisconnectReas
on
string Não Motivo da última desconexão
adminField01 string Não Campo administrativo 01
adminField02 string Não Campo administrativo 02
openai_apikey string Não Chave da API OpenAI
chatbot_enabled boolean Não Habilitar chatbot automático
chatbot_ignoreGrou
ps
boolean Não Ignorar mensagens de grupos
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 156
chatbot_stopConver
sation
string Não Palavra-chave para parar conversa
chatbot_stopMinute
s
integer Não Por quanto tempo ficará pausado o
chatbot ao usar stop conversation
chatbot_stopWhenY
ouSendMsg
integer Não Por quanto tempo ficará pausada a
conversa quando você enviar
mensagem manualmente
fieldsMap map[string, any] Não Mapa de campos customizados da
instância (quando presente)
currentTime string Não Horário atual retornado pelo
backend
created string(date-time) Não Data de criação da instância
updated string(date-time) Não Data da última atualização
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 157
Webhook
Configuração completa de webhook com filtros e opções avançadas
Tipo: object
Campos obrigatórios: url, events
Campos
Campo Tipo Obrigatór
io
Descrição
id string(uuid) Não ID único gerado automaticamente
enabled boolean Não Webhook ativo/inativo
url string(uri) Sim URL de destino dos eventos
events array[string] Sim Tipos de eventos monitorados
addUrlTypesMessag
es
boolean Não Incluir na URLs o tipo de mensagem
addUrlEvents boolean Não Incluir na URL o nome do evento
excludeMessages array[string] Não Filtros para excluir tipos de
mensagens
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 158
Chat
Representa uma conversa/chamado no sistema
Tipo: object
Campos
Campo Tipo Obrigatór
io
Descrição
id string Não ID único da conversa (r + 7 bytes
aleatórios em hex)
wa_fastid string Não Identificador rápido do WhatsApp
wa_chatid string Não ID completo do chat no WhatsApp
wa_chatlid string Não LID do chat no WhatsApp (quando
disponível)
wa_archived boolean Não Indica se o chat está arquivado
wa_contactName string Não Nome do contato no WhatsApp
wa_name string Não Nome do WhatsApp
name string Não Nome exibido do chat
image string Não URL da imagem do chat
imagePreview string Não URL da miniatura da imagem
wa_ephemeralExpir
ation
integer(int64) Não Tempo de expiração de mensagens
efêmeras
wa_isBlocked boolean Não Indica se o contato está bloqueado
wa_isGroup boolean Não Indica se é um grupo
wa_isGroup_admin boolean Não Indica se o usuário é admin do
grupo
wa_isGroup_announ
ce
boolean Não Indica se é um grupo somente
anúncios
wa_isGroup_commu
nity
boolean Não Indica se é uma comunidade
wa_isGroup_membe
r
boolean Não Indica se é membro do grupo
wa_isPinned boolean Não Indica se o chat está fixado
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 159
wa_label array[string] Não Labels do chat
wa_lastMessageTex
tVote
string Não Texto/voto da última mensagem
wa_lastMessageTyp
e
string Não Tipo da última mensagem
wa_lastMsgTimesta
mp
integer(int64) Não Timestamp da última mensagem
wa_lastMessageSen
der
string Não Remetente da última mensagem
wa_muteEndTime integer(int64) Não Timestamp do fim do silenciamento
owner string Não Dono da instância
wa_unreadCount integer(int64) Não Contador de mensagens não lidas
phone string Não Número de telefone
common_groups string Não Grupos em comum separados por
vírgula, formato:
(nome_grupo)id_grupo
lead_name string Não Nome do lead
lead_fullName string Não Nome completo do lead
lead_email string Não Email do lead
lead_personalid string Não Documento de identificação
lead_status string Não Status do lead
lead_tags array[string] Não Tags do lead
lead_notes string Não Anotações sobre o lead
lead_isTicketOpen boolean Não Indica se tem ticket aberto
lead_assignedAtten
dant_id
string Não ID do atendente responsável
lead_kanbanOrder integer(int64) Não Ordem no kanban
lead_field01 string Não
lead_field02 string Não
lead_field03 string Não
lead_field04 string Não
lead_field05 string Não
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 160
lead_field06 string Não
lead_field07 string Não
lead_field08 string Não
lead_field09 string Não
lead_field10 string Não
lead_field11 string Não
lead_field12 string Não
lead_field13 string Não
lead_field14 string Não
lead_field15 string Não
lead_field16 string Não
lead_field17 string Não
lead_field18 string Não
lead_field19 string Não
lead_field20 string Não
chatbot_agentReset
MemoryAt
integer(int64) Não Timestamp do último reset de
memória
chatbot_lastTrigger
_id
string Não ID do último gatilho executado
chatbot_lastTrigger
At
integer(int64) Não Timestamp do último gatilho
chatbot_disableUnti
l
integer(int64) Não Timestamp até quando chatbot
está desativado
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 161
Message
Representa uma mensagem trocada no sistema
Tipo: object
Campos
Campo Tipo Obrigatór
io
Descrição
id string(uuid) Não ID único interno da mensagem
(formato r + 7 caracteres hex
aleatórios)
messageid string Não ID original da mensagem no
provedor
chatid string Não ID da conversa relacionada
sender string Não ID do remetente da mensagem
senderName string Não Nome exibido do remetente
isGroup boolean Não Indica se é uma mensagem de
grupo
fromMe boolean Não Indica se a mensagem foi enviada
pelo usuário
messageType string Não Tipo de conteúdo da mensagem
source string Não Plataforma de origem da
mensagem
messageTimestamp integer Não Timestamp original da mensagem
em milissegundos
status string Não Status do ciclo de vida da
mensagem
text string Não Texto original da mensagem
quoted string Não ID da mensagem citada/respondida
edited string Não Histórico de edições da mensagem
reaction string Não ID da mensagem reagida
vote string Não Dados de votação de enquete e
listas
convertOptions string Não Conversão de opções da
mensagem, lista, enquete e botões
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 162
buttonOrListid string Não ID do botão ou item de lista
selecionado
owner string Não Dono da mensagem
error string Não Mensagem de erro caso o envio
tenha falhado
content oneOf(map[string,
any], string)
Não Conteúdo bruto da mensagem
(JSON serializado ou texto)
wasSentByApi boolean Não Indica se a mensagem foi enviada
via API
sendFunction string Não Função usada para enviar a
mensagem (quando enviada via
API)
sendPayload oneOf(map[string,
any], string)
Não Payload enviado (texto/JSON
serializado)
fileURL string Não URL ou referência de arquivo da
mensagem
send_folder_id string Não Pasta associada ao envio (quando
aplicável)
track_source string Não Origem de rastreamento
track_id string Não ID de rastreamento (pode repetir)
ai_metadata object Não Metadados do processamento por
IA
sender_pn string Não JID PN resolvido do remetente
(quando disponível)
sender_lid string Não LID original do remetente (quando
disponível)
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 163
Label
Representa uma etiqueta/categoria no sistema
Tipo: object
Campos
Campo Tipo Obrigatór
io
Descrição
id string(uuid) Não ID único da etiqueta
name string Não Nome da etiqueta
color integer Não Índice numérico da cor (0-19)
colorHex string Não Cor hexadecimal correspondente
ao índice
labelid string Não ID da label no WhatsApp (quando
sincronizada)
owner string Não Dono da etiqueta
created string(date-time) Não Data de criação
updated string(date-time) Não Data da última atualização
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 164
Attendant
Modelo de atendente do sistema
Tipo: object
Campos
Campo Tipo Obrigatór
io
Descrição
id string(uuid) Não ID único gerado automaticamente
name string Não Nome do atendente
phone string Não Número de telefone
email string(email) Não Endereço de e-mail
department string Não Departamento de atuação
customField01 string Não Campo personalizável 01
customField02 string Não Campo personalizável 02
owner string Não Responsável pelo cadastro
created string(date-time) Não Data de criação automática
updated string(date-time) Não Data de atualização automática
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 165
ChatbotTrigger
Tipo: object
Campos obrigatórios: type, agent_id
Campos
Campo Tipo Obrigatór
io
Descrição
id string Não Identificador único do trigger. Se
definido, você irá editar ou deletar
o trigger. Se vazio, um novo trigger
será criado.
active boolean Não Define se o trigger está ativo e
disponível para uso. Triggers
inativos não serão executados pelo
sistema.
type string Sim Tipo do trigger: agent - aciona um
agente de IA quickreply - aciona
respostas rápidas predefinidas *
flow - dispara um fluxo salvo
agent_id string Sim ID do agente de IA. Obrigatório
quando type='agent'
flow_id string Não ID do fluxo. Obrigatório quando
type='flow'
quickReply_id string Não ID da resposta rápida. Obrigatório
quando type='quickreply'
ignoreGroups boolean Não Define se o trigger deve ignorar
mensagens de grupos
lead_field string Não Campo do lead usado para
condição do trigger
lead_operator string Não Operador de comparação para
condição do lead: equals - igual a
not_equals - diferente de contains -
contém not_contains - não contém
greater - maior que less - menor
que empty - vazio not_empty - não
vazio
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 166
lead_value string Não Valor para comparação com o
campo do lead. Usado em conjunto
com lead_field e lead_operator
priority integer(int64) Não Prioridade do trigger. Quando
existem múltiplos triggers que
poderiam ser acionados, APENAS o
trigger com maior prioridade será
executado. Se houver múltiplos
triggers com a mesma prioridade
mais alta, um será escolhido
aleatoriamente.
wordsToStart string Não Palavras-chave ou frases que
ativam o trigger. Múltiplas entradas
separadas por pipe (|). Exemplo:
olá|bom dia|qual seu nome
responseDelay_sec
onds
integer(int64) Não Tempo de espera em segundos
antes de executar o trigger
owner string Não Identificador do proprietário do
trigger
created string(date-time) Não Data e hora de criação
updated string(date-time) Não Data e hora da última atualização
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 167
ChatbotAIAgent
Configuração de um agente de IA para atendimento de conversas
Tipo: object
Campos obrigatórios: name, provider, model, apikey
Campos
Campo Tipo Obrigatór
io
Descrição
id string(uuid) Não ID único gerado pelo sistema
name string Sim Nome de exibição do agente
provider string Sim Provedor do serviço de IA
model string Sim Nome do modelo LLM a ser
utilizado
apikey string Sim Chave de API para autenticação no
provedor
basePrompt string Não Prompt base para orientar o
comportamento do agente
maxTokens integer Não Número máximo de tokens por
resposta
temperature integer Não Controle de criatividade (0-100)
diversityLevel integer Não Nível de diversificação das
respostas
frequencyPenalty integer Não Penalidade para repetição de frases
presencePenalty integer Não Penalidade para manter foco no
tópico
signMessages boolean Não Adiciona identificação do agente
nas mensagens
readMessages boolean Não Marca mensagens como lidas
automaticamente
maxMessageLength integer Não Tamanho máximo permitido para
mensagens (caracteres)
typingDelay_second
s
integer Não Atraso simulado de digitação em
segundos
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 168
contextTimeWindo
w_hours
integer Não Janela temporal para contexto da
conversa
contextMaxMessag
es
integer Não Número máximo de mensagens no
contexto
contextMinMessage
s
integer Não Número mínimo de mensagens
para iniciar contexto
owner string Não Responsável/Proprietário do agente
created string(date-time) Não Data de criação do registro
updated string(date-time) Não Data da última atualização
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 169
ChatbotAIFunction
Tipo: object
Campos obrigatórios: name, description, method, endpoint
Campos
Campo Tipo Obrigatór
io
Descrição
id string Não ID único da função gerado
automaticamente
name string Sim Nome da função
description string Sim Descrição da função
active boolean Não Indica se a função está ativa
method string Sim Método HTTP da requisição
endpoint string Sim Endpoint da API
headers string/null Não Cabeçalhos da requisição
body string/null Não Corpo da requisição
parameters string/null Não Parâmetros da função
undocumentedPara
meters
string Não Parâmetros não documentados
header_error boolean Não Indica erro de formatação nos
cabeçalhos
body_error boolean Não Indica erro de formatação no corpo
owner string Não Proprietário da função
created string(date-time) Não Data de criação
updated string(date-time) Não Data de atualização
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 170
ChatbotAIKnowledge
Tipo: object
Campos obrigatórios: id, active, tittle, content
Campos
Campo Tipo Obrigatór
io
Descrição
id string Sim ID único gerado automaticamente
active boolean Sim Indica se o conhecimento está ativo
tittle string Sim Título do conhecimento
content string Sim Conteúdo textual do conhecimento
vectorStatus string Não Status da vetorização no sistema
isVectorized boolean Não Indica se o conteúdo foi vetorizado
lastVectorizedAt integer(int64) Não Timestamp da última vetorização
owner string Não Proprietário do conhecimento
priority integer(int64) Não Prioridade de uso do conhecimento
created string(date-time) Não Data de criação
updated string(date-time) Não Data de atualização
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 171
MessageQueueFolder
Pasta para organização de campanhas de mensagens em massa
Tipo: object
Campos
Campo Tipo Obrigatór
io
Descrição
id string Não Identificador único
info string Não Informações adicionais sobre a
pasta
status string Não Status atual da pasta
scheduled_for integer(int64) Não Timestamp Unix para execução
agendada
delayMax integer(int64) Não Atraso máximo entre mensagens
em milissegundos
delayMin integer(int64) Não Atraso mínimo entre mensagens
em milissegundos
log_delivered integer(int64) Não Contagem de mensagens
entregues
log_failed integer(int64) Não Contagem de mensagens com falha
log_played integer(int64) Não Contagem de mensagens
reproduzidas (para áudio/vídeo)
log_read integer(int64) Não Contagem de mensagens lidas
log_sucess integer(int64) Não Contagem de mensagens enviadas
com sucesso
log_total integer(int64) Não Contagem total de mensagens
owner string Não Identificador do proprietário da
instância
created string(date-time) Não Data e hora de criação
updated string(date-time) Não Data e hora da última atualização
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 172
QuickReply
Tipo: object
Campos obrigatórios: shortCut, text
Campos
Campo Tipo Obrigatór
io
Descrição
id string(uuid) Não ID único da resposta rápida
onWhatsApp boolean Não Indica se a resposta veio do
WhatsApp (não pode ser
editada/excluída)
docName string Não Nome de documento associado
(quando aplicável)
file string Não Caminho ou conteúdo do arquivo
associado
shortCut string Sim Atalho para acionar a resposta
text string Sim Conteúdo da mensagem
pré-definida
type string Não Tipo da resposta rápida
(texto/documento/outros)
owner string Não Dono da resposta rápida
created string(date-time) Não Data de criação
updated string(date-time) Não Data da última atualização
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 173
Group
Representa um grupo/conversa coletiva
Tipo: object
Campos
Campo Tipo Obrigatór
io
Descrição
JID string(jid) Não Identificador único do grupo
OwnerJID string(jid) Não JID do proprietário do grupo
OwnerPN string(jid) Não Número/LID do proprietário
(quando disponível)
Name string Não Nome do grupo
NameSetAt string(date-time) Não Data da última alteração do nome
NameSetBy string(jid) Não JID do usuário que definiu o nome
NameSetByPN string(jid) Não LID/PN de quem definiu o nome
Topic string Não Descrição do grupo
TopicID string Não ID interno da descrição
TopicSetAt string(date-time) Não Data da última alteração da
descrição
TopicSetBy string(jid) Não JID de quem alterou a descrição
TopicSetByPN string(jid) Não LID/PN de quem alterou a descrição
TopicDeleted boolean Não Indica se a descrição foi apagada
IsLocked boolean Não Indica se apenas administradores
podem editar informações do grupo
- true = apenas admins podem
editar - false = todos podem editar
IsAnnounce boolean Não Indica se apenas administradores
podem enviar mensagens
AnnounceVersionID string Não Versão da configuração de
anúncios
IsEphemeral boolean Não Indica se as mensagens são
temporárias
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 174
DisappearingTimer integer Não Tempo em segundos para
desaparecimento de mensagens
IsIncognito boolean Não Indica se o grupo é incognito
IsParent boolean Não Indica se é um grupo pai
(comunidade)
IsJoinApprovalRequi
red
boolean Não Indica se requer aprovação para
novos membros
LinkedParentJID string(jid) Não JID da comunidade vinculada
IsDefaultSubGroup boolean Não Indica se é um subgrupo padrão da
comunidade
DefaultMembership
ApprovalMode
string Não Modo padrão de aprovação de
membros (quando comunidade)
GroupCreated string(date-time) Não Data de criação do grupo
CreatorCountryCod
e
string Não Código do país do criador
ParticipantVersionI
D
string Não Versão da lista de participantes
Participants array[GroupParticip
ant]
Não Lista de participantes do grupo
MemberAddMode string Não Modo de adição de novos membros
AddressingMode string Não Endereçamento preferido do grupo
OwnerCanSendMes
sage
boolean Não Verifica se é possível você enviar
mensagens
OwnerIsAdmin boolean Não Verifica se você adminstrador do
grupo
DefaultSubGroupId string Não Se o grupo atual for uma
comunidade, nesse campo
mostrará o ID do subgrupo de
avisos
invite_link string Não Link de convite para entrar no
grupo
request_participant
s
string Não Lista de solicitações de entrada,
separados por vírgula
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 175
GroupParticipant
Participante de um grupo
Tipo: object
Campos
Campo Tipo Obrigatór
io
Descrição
JID string(jid) Não Identificador do participante
LID string(jid) Não Identificador local do participante
PhoneNumber string(jid) Não Número do participante (quando
disponível)
IsAdmin boolean Não Indica se é administrador
IsSuperAdmin boolean Não Indica se é super administrador
DisplayName string Não Nome exibido no grupo (para
usuários anônimos)
Error integer Não Código de erro ao adicionar
participante
AddRequest object Não Informações da solicitação de
entrada
uazapiGO - WhatsApp API (v2.0) • v1.0.0
Gerado em 2026-01-20 (UTC) Página 176
WebhookEvent
Tipo: object
Campos obrigatórios: event, instance, data
Campos
Campo Tipo Obrigatór
io
Descrição
event string Sim Tipo do evento recebido
instance string Sim ID da instância que gerou o evento
data map[string, any] Sim Payload do evento enviado pelo
webhook. O formato varia conforme
o tipo do evento (messages,
messages_update, connection,
presence, etc) e segue o que o
backend envia em callHook
(map[string]interface{}). Consulte
os exemplos de cada evento
específico.
