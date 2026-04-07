# uazapiGO - WhatsApp API

**Versão:** `2.0.1`  
**Spec:** OpenAPI `3.1.0`  
**Fonte:** `https://docs.uazapi.com`

---

API para gerenciamento de instâncias do WhatsApp e comunicações.

## ⚠️ Recomendação Importante: WhatsApp Business
**É ALTAMENTE RECOMENDADO usar contas do WhatsApp Business** em vez do WhatsApp normal para integração, o WhatsApp normal pode apresentar inconsistências, desconexões, limitações e instabilidades durante o uso com a nossa API.

## Autenticação
- Endpoints regulares requerem um header 'token' com o token da instância
- Endpoints administrativos requerem um header 'admintoken'

## Estados da Instância
As instâncias podem estar nos seguintes estados:
- `disconnected`: Desconectado do WhatsApp
- `connecting`: Em processo de conexão
- `connected`: Conectado e autenticado com sucesso

## Limites de Uso
- O servidor possui um limite máximo de instâncias conectadas
- Quando o limite é atingido, novas tentativas receberão erro 429
- Servidores gratuitos/demo podem ter restrições adicionais de tempo de vida


---

## Servidores

**Servidor da API uazapiGO**  
`https://{subdomain}.uazapi.com`

- `subdomain`: valores disponíveis `free`, `api` · padrão: `free`


---

## Segurança

| Esquema | Tipo | Header | Descrição |
|---|---|---|---|
| `token` | `apiKey` | `token` |  |
| `admintoken` | `apiKey` | `admintoken` | Token de administrador para endpoints administrativos |

---

## Índice de Endpoints

**Total:** 141 endpoints · 15 schemas

| Categoria | Endpoints |
|---|:---:|
| [Admininstração](#admininstracao) | 7 |
| [Instancia](#instancia) | 10 |
| [Proxy](#proxy) | 3 |
| [Perfil](#perfil) | 2 |
| [Business](#business) | 8 |
| [Chamadas](#chamadas) | 2 |
| [Webhooks e SSE](#webhooks_e_sse) | 4 |
| [Enviar Mensagem](#enviar_mensagem) | 11 |
| [Mensagem Async](#mensagem_async) | 2 |
| [Ações na mensagem e Buscar](#acoes_na_mensagem_e_buscar) | 7 |
| [Chats](#chats) | 9 |
| [Contatos](#contatos) | 6 |
| [Bloqueios](#bloqueios) | 2 |
| [Etiquetas](#etiquetas) | 4 |
| [Grupos e Comunidades](#grupos_e_comunidades) | 16 |
| [Newsletters e Canais](#newsletters_e_canais) | 26 |
| [Respostas Rápidas](#respostas_rapidas) | 2 |
| [CRM](#crm) | 2 |
| [Mensagem em massa](#mensagem_em_massa) | 7 |
| [Chatbot Configurações](#chatbot_configuracoes) | 1 |
| [Chatbot Trigger](#chatbot_trigger) | 2 |
| [Configuração do Agente de IA](#configuracao_do_agente_de_ia) | 2 |
| [Conhecimento dos Agentes](#conhecimento_dos_agentes) | 2 |
| [Funções API dos Agentes](#funcoes_api_dos_agentes) | 2 |
| [Integração Chatwoot](#integracao_chatwoot) | 2 |

---

## Endpoints


---

### Admininstração

Endpoints para **administração geral** do sistema.
Requerem um `admintoken` para autenticação.



#### `POST` `/instance/create`

**Criar Instancia**

Cria uma nova instância do WhatsApp. Para criar uma instância você precisa:

1. Ter um admintoken válido
2. Enviar pelo menos o nome da instância
3. A instância será criada desconectada
4. Será gerado um token único para autenticação

Após criar a instância, guarde o token retornado pois ele será necessário
para todas as outras operações.

Estados possíveis da instância:

- `disconnected`: Desconectado do WhatsApp
- `connecting`: Em processo de conexão
- `connected`: Conectado e autenticado

Campos administrativos (adminField01/adminField02) são opcionais e podem ser usados para armazenar metadados personalizados. 
OS valores desses campos são vísiveis para o dono da instancia via token, porém apenas o administrador da api (via admin token) pode editá-los.

🔐 **Autenticação:** `admintoken`


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `name` | `string` | ✅ | Nome da instância Exemplo: `minha-instancia` |
| `systemName` | `string` |  | Nome do sistema (opcional, padrão 'uazapiGO' se não informado) Exemplo: `apilocal` |
| `adminField01` | `string` |  | Campo administrativo 1 para metadados personalizados (opcional) Exemplo: `custom-metadata-1` |
| `adminField02` | `string` |  | Campo administrativo 2 para metadados personalizados (opcional) Exemplo: `custom-metadata-2` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Sucesso |
| `401` | Token inválido/expirado |
| `404` | Instância não encontrada |
| `500` | Erro interno |

#### `GET` `/instance/all`

**Listar todas as instâncias**

Retorna uma lista completa de todas as instâncias do sistema, incluindo:
- ID e nome de cada instância
- Status atual (disconnected, connecting, connected)
- Data de criação
- Última desconexão e motivo
- Informações de perfil (se conectado)

Requer permissões de administrador.

🔐 **Autenticação:** `admintoken`


**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Lista de instâncias retornada com sucesso |
| `401` | Token inválido ou expirado |
| `403` | Token de administrador inválido |
| `500` | Erro interno do servidor |

#### `POST` `/instance/updateAdminFields`

**Atualizar campos administrativos**

Atualiza os campos administrativos (adminField01/adminField02) de uma instância.

Campos administrativos são opcionais e podem ser usados para armazenar metadados personalizados. 
Estes campos são persistidos no banco de dados e podem ser utilizados para integrações com outros sistemas ou para armazenamento de informações internas.
OS valores desses campos são vísiveis para o dono da instancia via token, porém apenas o administrador da api (via admin token) pode editá-los.

🔐 **Autenticação:** `admintoken`


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `id` | `string` | ✅ | ID da instância Exemplo: `inst_123456` |
| `adminField01` | `string` |  | Campo administrativo 1 Exemplo: `clientId_456` |
| `adminField02` | `string` |  | Campo administrativo 2 Exemplo: `integration_xyz` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Campos atualizados com sucesso |
| `401` | Token de administrador inválido |
| `404` | Instância não encontrada |
| `500` | Erro interno |

#### `GET` `/globalwebhook`

**Ver Webhook Global**

Retorna a configuração atual do webhook global, incluindo:
- URL configurada
- Eventos ativos
- Filtros aplicados
- Configurações adicionais

Exemplo de resposta:
```json
{
  "enabled": true,
  "url": "https://example.com/webhook",
  "events": ["messages", "messages_update"],
  "excludeMessages": ["wasSentByApi", "isGroupNo"],
  "addUrlEvents": true,
  "addUrlTypesMessages": true
}
```

🔐 **Autenticação:** `admintoken`


**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Configuração atual do webhook global |
| `401` | Token de administrador não fornecido |
| `403` | Token de administrador inválido ou servidor demo |
| `404` | Webhook global não encontrado |

#### `POST` `/globalwebhook`

**Configurar Webhook Global**

Configura um webhook global que receberá eventos de todas as instâncias.

### 🚀 Configuração Simples (Recomendada)

**Para a maioria dos casos de uso**:
- Configure apenas URL e eventos desejados
- Modo simples por padrão (sem complexidade)
- **Recomendado**: Sempre use `"excludeMessages": ["wasSentByApi"]` para evitar loops
- **Exemplo**: `{"url": "https://webhook.cool/global", "events": ["messages", "connection"], "excludeMessages": ["wasSentByApi"]}`

### 🧪 Sites para Testes (ordenados por qualidade)

**Para testar webhooks durante desenvolvimento**:
1. **https://webhook.cool/** - ⭐ Melhor opção (sem rate limit, interface limpa)
2. **https://rbaskets.in/** - ⭐ Boa alternativa (confiável, baixo rate limit)
3. **https://webhook.site/** - ⚠️ Evitar se possível (rate limit agressivo)

### Funcionalidades Principais:
- Configuração de URL para recebimento de eventos
- Seleção granular de tipos de eventos
- Filtragem avançada de mensagens
- Parâmetros adicionais na URL

**Eventos Disponíveis**:
- `connection`: Alterações no estado da conexão
- `history`: Recebimento de histórico de mensagens
- `messages`: Novas mensagens recebidas
- `messages_update`: Atualizações em mensagens existentes
- `call`: Eventos de chamadas VoIP
- `contacts`: Atualizações na agenda de contatos
- `presence`: Alterações no status de presença
- `groups`: Modificações em grupos
- `labels`: Gerenciamento de etiquetas
- `chats`: Eventos de conversas
- `chat_labels`: Alterações em etiquetas de conversas
- `blocks`: Bloqueios/desbloqueios
- `sender`: Atualizações de campanhas, quando inicia, e quando completa

**Remover mensagens com base nos filtros**:
- `wasSentByApi`: Mensagens originadas pela API ⚠️ **IMPORTANTE:** Use sempre este filtro para evitar loops em automações
- `wasNotSentByApi`: Mensagens não originadas pela API
- `fromMeYes`: Mensagens enviadas pelo usuário
- `fromMeNo`: Mensagens recebidas de terceiros
- `isGroupYes`: Mensagens em grupos
- `isGroupNo`: Mensagens em conversas individuais

💡 **Prevenção de Loops Globais**: O webhook global recebe eventos de TODAS as instâncias. Se você tem automações que enviam mensagens via API, sempre inclua `"excludeMessages": ["wasSentByApi"]`. Caso prefira receber esses eventos, certifique-se de que sua automação detecta mensagens enviadas pela própria API para não criar loops infinitos em múltiplas instâncias.

**Parâmetros de URL**:
- `addUrlEvents` (boolean): Quando ativo, adiciona o tipo do evento como path parameter na URL.
  Exemplo: `https://api.example.com/webhook/{evento}`
- `addUrlTypesMessages` (boolean): Quando ativo, adiciona o tipo da mensagem como path parameter na URL.
  Exemplo: `https://api.example.com/webhook/{tipo_mensagem}`

**Combinações de Parâmetros**:
- Ambos ativos: `https://api.example.com/webhook/{evento}/{tipo_mensagem}`
  Exemplo real: `https://api.example.com/webhook/message/conversation`
- Apenas eventos: `https://api.example.com/webhook/message`
- Apenas tipos: `https://api.example.com/webhook/conversation`

**Notas Técnicas**:
1. Os parâmetros são adicionados na ordem: evento → tipo mensagem
2. A URL deve ser configurada para aceitar esses parâmetros dinâmicos
3. Funciona com qualquer combinação de eventos/mensagens

🔐 **Autenticação:** `admintoken`


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `url` | `string (uri)` | ✅ | URL para receber os eventos Exemplo: `https://webhook.cool/global` |
| `events` | `array` | ✅ | Lista de eventos monitorados Exemplo: `['messages', 'connection']` |
| `excludeMessages` | `array` |  | Filtros para excluir tipos de mensagens Exemplo: `['wasSentByApi']` |
| `addUrlEvents` | `boolean` |  | Adiciona o tipo do evento como parâmetro na URL. - `false` (padrão): URL normal - `true`: Adiciona evento na URL (ex: `/webhook/message`) |
| `addUrlTypesMessages` | `boolean` |  | Adiciona o tipo da mensagem como parâmetro na URL. - `false` (padrão): URL normal   - `true`: Adiciona tipo da mensagem (ex: `/webhook/conversation`) |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Webhook global configurado com sucesso |
| `400` | Payload inválido |
| `401` | Token de administrador não fornecido |
| `403` | Token de administrador inválido ou servidor demo |
| `500` | Erro interno do servidor |

#### `GET` `/globalwebhook/errors`

**Ver últimos erros do webhook global**

Retorna em memória os últimos 20 erros de entrega do webhook global.

Cada item inclui data/hora (`created`), URL de destino, evento, tipo do webhook
(`global`), payload tentado, número de tentativas, status HTTP final quando existir e a mensagem de erro.

Observações:
- O histórico fica apenas em memória e é perdido quando o processo reinicia.
- O endpoint exige `admintoken`.
- Útil para diagnosticar falhas do webhook global sem expor esses dados aos tokens das instâncias.
- O header `X-Webhook-Error-Capture-Started-At` informa desde quando a captura atual está valendo.

Exemplo de consulta:
```bash
curl -X GET "$BASE_URL/globalwebhook/errors" \
  -H "admintoken: SEU_ADMIN_TOKEN"
```

🔐 **Autenticação:** `admintoken`


**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Histórico global retornado com sucesso |
| `401` | Token de administrador não fornecido |
| `403` | Token de administrador inválido ou servidor demo |

#### `POST` `/admin/restart`

**Reiniciar a aplicação**

Reinicia toda a aplicação para forçar a reconexão de todas as instâncias de uma vez.

Use apenas em situações realmente necessárias, como instabilidades gerais.
Após o restart, os números entram em reconexão automática e não ficam desconectados permanentemente.

🔐 **Autenticação:** `admintoken`


**Respostas**:

| Código | Descrição |
|---|---|
| `202` | Reinicio agendado com sucesso |
| `500` | Erro interno do servidor ao agendar o reinicio |

---

### Instancia

Operações relacionadas ao ciclo de vida de uma instância, como conectar,
desconectar e verificar o status.



#### `POST` `/instance/connect`

**Conectar instância ao WhatsApp**

Inicia o processo de conexão de uma instância ao WhatsApp. Este endpoint:
1. Requer o token de autenticação da instância
2. Recebe o número de telefone associado à conta WhatsApp
3. Gera um QR code caso não passe o campo `phone`
4. Ou Gera código de pareamento se passar o o campo `phone`
5. Atualiza o status da instância para "connecting"

O processo de conexão permanece pendente até que:
- O QR code seja escaneado no WhatsApp do celular, ou
- O código de pareamento seja usado no WhatsApp
- Timeout de 2 minutos para QRCode seja atingido ou 5 minutos para o código de pareamento

Use o endpoint /instance/status para monitorar o progresso da conexão.

Estados possíveis da instância:
- `disconnected`: Desconectado do WhatsApp
- `connecting`: Em processo de conexão
- `connected`: Conectado e autenticado

Sincronização e armazenamento de mensagens:
- Todas as mensagens recebidas da Meta durante a sincronização da conexão (leitura do QR code) são enviadas no evento `history` do webhook.
- As mensagens dos últimos 7 dias são armazenadas no banco de dados e ficam acessíveis pelos endpoints: `POST /message/find` e `POST /chat/find`.
- Depois que a instância conecta, todas as mensagens enviadas ou recebidas são armazenadas no banco de dados.
- Mensagens mais antigas do que 7 dias são excluídas durante a madrugada.

Exemplo de requisição:
```json
{
  "phone": "5511999999999"
}
```


**Request Body** (`application/json`):

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `phone` | `string` |  | Número de telefone no formato internacional (ex: 5511999999999). Se informado, gera código de pareamento. Se omitido, gera QR code. Exemplo: `55119999 |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Sucesso |
| `401` | Token inválido/expirado |
| `404` | Instância não encontrada |
| `429` | Limite de conexões simultâneas atingido |
| `500` | Erro interno |

#### `POST` `/instance/disconnect`

**Desconectar instância**

Desconecta a instância do WhatsApp, encerrando a sessão atual.
Esta operação:

- Encerra a conexão ativa

- Requer novo QR code para reconectar


Diferenças entre desconectar e hibernar:

- Desconectar: Encerra completamente a sessão, exigindo novo login

- Hibernar: Mantém a sessão ativa, apenas pausa a conexão


Use este endpoint para:

1. Encerrar completamente uma sessão

2. Forçar uma nova autenticação

3. Limpar credenciais de uma instância

4. Reiniciar o processo de conexão


Estados possíveis após desconectar:

- `disconnected`: Desconectado do WhatsApp

- `connecting`: Em processo de reconexão (após usar /instance/connect)


**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Sucesso |
| `401` | Token inválido/expirado |
| `404` | Instância não encontrada |
| `500` | Erro interno |

#### `POST` `/instance/reset`

**Reiniciar runtime da instância**

Solicita um reset controlado do runtime da instância atual.

Este endpoint é útil quando a sessão ficou presa, o envio não está progredindo
ou a instância precisa forçar uma tentativa de recuperação sem apagar o registro
da instância.

Comportamentos possíveis:
- inicia um novo reset quando a instância está apta
- informa que um reset já está em andamento
- informa que existe cooldown ativo entre resets
- retorna erro quando a sessão não pode ser recuperada ou quando a política de
  reconexão bloqueia a operação

A resposta sempre informa:
- `instanceId`: ID da instância autenticada
- `resetting`: se há reset em andamento no momento
- `queuedRecoveryAttempted`: se houve tentativa de recuperação da fila interna

🔐 **Autenticação:** `token`


**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Reset aceito, já em andamento ou em cooldown |
| `401` | Token inválido, ausente ou cliente não encontrado |
| `403` | Reset bloqueado pela política de reconexão |
| `409` | Sessão atual não é reconectável por reset |
| `500` | Erro interno ao solicitar o reset |

#### `GET` `/instance/status`

**Verificar status da instância**

Retorna o status atual de uma instância, incluindo:
- Estado da conexão (disconnected, connecting, connected)
- QR code atualizado (se em processo de conexão)
- Código de pareamento (se disponível)
- Informações da última desconexão
- Detalhes completos da instância

Este endpoint é particularmente útil para:
1. Monitorar o progresso da conexão
2. Obter QR codes atualizados durante o processo de conexão
3. Verificar o estado atual da instância
4. Identificar problemas de conexão

Estados possíveis:
- `disconnected`: Desconectado do WhatsApp
- `connecting`: Em processo de conexão (aguardando QR code ou código de pareamento)
- `connected`: Conectado e autenticado com sucesso


**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Sucesso |
| `401` | Token inválido/expirado |
| `404` | Instância não encontrada |
| `500` | Erro interno |

#### `POST` `/instance/updateInstanceName`

**Atualizar nome da instância**

Atualiza o nome de uma instância WhatsApp existente.
O nome não precisa ser único.


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `name` | `string` | ✅ | Novo nome para a instância Exemplo: `Minha Nova Instância 2024!@#` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Sucesso |
| `401` | Token inválido/expirado |
| `404` | Instância não encontrada |
| `500` | Erro interno |

#### `DELETE` `/instance`

**Deletar instância**

Remove a instância do sistema.

🔐 **Autenticação:** `token`


**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Instância deletada com sucesso |
| `401` | Falha na autenticação |
| `404` | Instância não encontrada |
| `500` | Erro interno do servidor |

#### `GET` `/instance/privacy`

**Buscar configurações de privacidade**

Busca as configurações de privacidade atuais da instância do WhatsApp.

**Importante - Diferença entre Status e Broadcast:**

- **Status**: Refere-se ao recado personalizado que aparece embaixo do nome do usuário (ex: "Disponível", "Ocupado", texto personalizado)
- **Broadcast**: Refere-se ao envio de "stories/reels" (fotos/vídeos temporários)

**Limitação**: As configurações de privacidade do broadcast (stories/reels) não estão disponíveis para alteração via API.

Retorna todas as configurações de privacidade como quem pode:
- Adicionar aos grupos
- Ver visto por último
- Ver status (recado embaixo do nome)
- Ver foto de perfil
- Receber confirmação de leitura
- Ver status online
- Fazer chamadas


**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Configurações de privacidade obtidas com sucesso |
| `401` | Token de autenticação inválido |
| `500` | Erro interno do servidor |

#### `POST` `/instance/privacy`

**Alterar configurações de privacidade**

Altera uma ou múltiplas configurações de privacidade da instância do WhatsApp de forma otimizada.

**Importante - Diferença entre Status e Broadcast:**

- **Status**: Refere-se ao recado personalizado que aparece embaixo do nome do usuário (ex: "Disponível", "Ocupado", texto personalizado)
- **Broadcast**: Refere-se ao envio de "stories/reels" (fotos/vídeos temporários)

**Limitação**: As configurações de privacidade do broadcast (stories/reels) não estão disponíveis para alteração via API.

**Características:**
- ✅ **Eficiência**: Altera apenas configurações que realmente mudaram
- ✅ **Flexibilidade**: Pode alterar uma ou múltiplas configurações na mesma requisição
- ✅ **Feedback completo**: Retorna todas as configurações atualizadas

**Formato de entrada:**
```json
{
  "groupadd": "contacts",
  "last": "none",
  "status": "contacts"
}
```

**Tipos de privacidade disponíveis:**
- `groupadd`: Quem pode adicionar aos grupos
- `last`: Quem pode ver visto por último
- `status`: Quem pode ver status (recado embaixo do nome)
- `profile`: Quem pode ver foto de perfil
- `readreceipts`: Confirmação de leitura
- `online`: Quem pode ver status online
- `calladd`: Quem pode fazer chamadas

**Valores possíveis:**
- `all`: Todos
- `contacts`: Apenas contatos
- `contact_blacklist`: Contatos exceto bloqueados
- `none`: Ninguém
- `match_last_seen`: Corresponder ao visto por último (apenas para online)
- `known`: Números conhecidos (apenas para calladd)


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `groupadd` | `string` |  | Quem pode adicionar aos grupos. Valores - all, contacts, contact_blacklist, none Valores: `all`, `contacts`, `contact_blacklist`, `none` |
| `last` | `string` |  | Quem pode ver visto por último. Valores - all, contacts, contact_blacklist, none Valores: `all`, `contacts`, `contact_blacklist`, `none` |
| `status` | `string` |  | Quem pode ver status (recado embaixo do nome). Valores - all, contacts, contact_blacklist, none Valores: `all`, `contacts`, `contact_blacklist`, `none |
| `profile` | `string` |  | Quem pode ver foto de perfil. Valores - all, contacts, contact_blacklist, none Valores: `all`, `contacts`, `contact_blacklist`, `none` |
| `readreceipts` | `string` |  | Confirmação de leitura. Valores - all, none Valores: `all`, `none` |
| `online` | `string` |  | Quem pode ver status online. Valores - all, match_last_seen Valores: `all`, `match_last_seen` |
| `calladd` | `string` |  | Quem pode fazer chamadas. Valores - all, known Valores: `all`, `known` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Configuração de privacidade alterada com sucesso |
| `400` | Dados de entrada inválidos |
| `401` | Token de autenticação inválido |
| `500` | Erro interno do servidor |

#### `POST` `/instance/presence`

**Atualizar status de presença da instância**

Atualiza o status de presença global da instância do WhatsApp. Este endpoint permite:
1. Definir se a instância está disponível (Aparece "online") ou indisponível
2. Controlar o status de presença para todos os contatos
3. Salvar o estado atual da presença na instância

Tipos de presença suportados:
- available: Marca a instância como disponível/online
- unavailable: Marca a instância como indisponível/offline

**Atenção**:
- O status de presença pode ser temporariamente alterado para "available" (online) em algumas situações internas da API, e com isso o visto por último também pode ser atualizado.
- Caso isso for um problema, considere alterar suas configurações de privacidade no WhatsApp para não mostrar o visto por último e/ou quem pode ver seu status "online".

**⚠️ Importante - Limitação do Presence "unavailable"**:
- **Quando a API é o único dispositivo ativo**: Confirmações de entrega/leitura (ticks cinzas/azuis) não são enviadas nem recebidas
- **Impacto**: Eventos `message_update` com status de entrega podem não ser recebidos
- **Solução**: Se precisar das confirmações, mantenha WhatsApp Web ou aplicativo móvel ativo ou use presence "available" 

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
- 401: Token inválido ou expirado
- 400: Valor de presença inválido
- 500: Erro ao atualizar presença


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `presence` | `string` | ✅ | Status de presença da instância Valores: `available`, `unavailable` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Presença atualizada com sucesso |
| `400` | Requisição inválida |
| `401` | Token inválido ou expirado |
| `500` | Erro interno do servidor |

#### `POST` `/instance/updateDelaySettings`

**Delay na fila de mensagens**

Configura o intervalo de tempo entre mensagens diretas (async=true).

### Detalhes
- Configuração aplicada apenas para mensagens diretas (não afeta campanhas)
- Delay mínimo (msg_delay_min): 0 ou mais segundos (0 = sem delay)
- Delay máximo (msg_delay_max): se menor que min, será ajustado para o mesmo valor de min
- Sistema ajusta automaticamente valores negativos para 0

### Exemplo
```json
{
  "msg_delay_min": 0,
  "msg_delay_max": 2
}
```


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `msg_delay_min` | `integer (int64)` | ✅ | Delay mínimo em segundos (0 = sem delay) Exemplo: `0` |
| `msg_delay_max` | `integer (int64)` | ✅ | Delay máximo em segundos Exemplo: `2` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Sucesso |
| `400` | Requisição inválida |
| `401` | Token inválido ou expirado |
| `500` | Erro interno do servidor |

---

### Proxy

A uazapiGO opera com um proxy interno como padrão.
Você pode manter esse padrão, configurar um proxy próprio via `proxy_url` ou usar seu celular android como proxy instalando o app em https://github.com/uazapi/silver_proxy_apk (APK direto: https://github.com/uazapi/silver_proxy_apk/raw/refs/heads/main/silver_proxy.apk).
Se nada for enviado, seguimos no proxy interno. IPs são brasileiros; para clientes internacionais, considere um proxy da região do cliente.



#### `GET` `/instance/proxy`

**Obter configuração de proxy da instância**

A uazapiGO opera com um proxy interno como padrão.
Observação: nossos IPs são brasileiros. Se você atende clientes internacionais, considere usar um proxy do país/região do seu cliente (via `proxy_url`).
Você pode:
  (1) continuar no proxy interno padrão;
  (2) usar um proxy próprio informando `proxy_url`. Se nada for definido, seguimos no proxy interno; ou
  (3) usar seu celular android como proxy instalando o aplicativo disponibilizado pela uazapi em https://github.com/uazapi/silver_proxy_apk (APK direto: https://github.com/uazapi/silver_proxy_apk/raw/refs/heads/main/silver_proxy.apk).

A resposta desse endpoint traz o estado atual do proxy e o último teste de conectividade.

🔐 **Autenticação:** `token`


**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Configuração de proxy recuperada com sucesso |
| `401` | Token inválido ou expirado |
| `500` | Erro interno do servidor ao recuperar a configuração |

#### `POST` `/instance/proxy`

**Configurar ou alterar o proxy**

Permite habilitar ou trocar para:
- Um proxy próprio (`proxy_url`), usando sua infraestrutura ou o aplicativo de celular para proxy próprio.
- O proxy interno padrão (nenhum `proxy_url` enviado).

Se nada for enviado, seguimos no proxy interno. A URL é validada antes de salvar. A conexão pode ser reiniciada automaticamente para aplicar a mudança.

Opcional: você pode usar seu celular android como proxy instalando o aplicativo disponibilizado pela uazapi em https://github.com/uazapi/silver_proxy_apk (APK direto: https://github.com/uazapi/silver_proxy_apk/raw/refs/heads/main/silver_proxy.apk).

🔐 **Autenticação:** `token`


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `enable` | `boolean` | ✅ | Define se o proxy deve ser habilitado; se `false`, remove o proxy atual |
| `proxy_url` | `string` |  | URL do proxy a ser usado (obrigatória se `enable=true` e quiser usar um proxy próprio) Exemplo: `http://usuario:senha@ip:porta` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Proxy configurado com sucesso |
| `400` | Payload inválido ou falha na validação do proxy |
| `401` | Token inválido ou expirado |
| `500` | Erro interno do servidor ao configurar o proxy |

#### `DELETE` `/instance/proxy`

**Remover o proxy configurado**

Desativa e apaga o proxy personalizado, voltando ao comportamento padrão (proxy interno).
Pode reiniciar a conexão para aplicar a remoção.

🔐 **Autenticação:** `token`


**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Configuração de proxy removida com sucesso |
| `401` | Token inválido ou expirado |
| `500` | Erro interno do servidor ao deletar a configuração de proxy |

---

### Perfil

Operações relacionadas ao perfil da instância do WhatsApp, como alterar
nome e imagem de perfil.



#### `POST` `/profile/name`

**Altera o nome do perfil do WhatsApp**

Altera o nome de exibição do perfil da instância do WhatsApp.

O endpoint realiza:
- Atualiza o nome do perfil usando o WhatsApp AppState
- Sincroniza a mudança com o servidor do WhatsApp
- Retorna confirmação da alteração

**Importante**: 
- A instância deve estar conectada ao WhatsApp
- O nome será visível para todos os contatos
- Pode haver um limite de alterações por período (conforme WhatsApp)

🔐 **Autenticação:** `token`


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `name` | `string` | ✅ | Novo nome do perfil do WhatsApp Exemplo: `Minha Empresa - Atendimento` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Nome do perfil alterado com sucesso |
| `400` | Dados inválidos na requisição |
| `401` | Sem sessão ativa |
| `403` | Ação não permitida |
| `500` | Erro interno do servidor |

#### `POST` `/profile/image`

**Altera a imagem do perfil do WhatsApp**

Altera a imagem de perfil da instância do WhatsApp.

O endpoint realiza:
- Atualiza a imagem do perfil usando 
- Processa a imagem (URL, base64 ou comando de remoção)
- Sincroniza a mudança com o servidor do WhatsApp
- Retorna confirmação da alteração

**Importante**: 
- A instância deve estar conectada ao WhatsApp
- A imagem será visível para todos os contatos
- A imagem deve estar em formato JPEG e tamanho 640x640 pixels

🔐 **Autenticação:** `token`


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `image` | `string` | ✅ | Imagem do perfil. Pode ser: - URL da imagem (http/https) - String base64 da imagem - "remove" ou "delete" para remover a imagem atual Exemplo: `https: |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Imagem do perfil alterada com sucesso |
| `400` | Dados inválidos na requisição |
| `401` | Sem sessão ativa |
| `403` | Ação não permitida |
| `413` | Imagem muito grande |
| `500` | Erro interno do servidor |

---

### Business

⚠️ **EXPERIMENTAL** - Endpoints ainda não testados completamente.

Operações relacionadas ao perfil comercial do WhatsApp Business.
Permite consultar e atualizar dados do perfil comercial como descrição,
endereço, email, categorias e gerenciar o catálogo de produtos.

**Requisitos:**
- A instância deve ser uma conta **WhatsApp Business**
- Contas pessoais do WhatsApp não possuem perfil comercial

**Nota:** Estes endpoints podem não funcionar como esperado.
Reporte problemas encontrados.



#### `POST` `/business/get/profile`

**Obter o perfil comercial**

Retorna o perfil comercial da instância do WhatsApp.


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `jid` | `string` |  | JID do perfil comercial a consultar Exemplo: `5511999999999@s.whatsapp.net` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Perfil comercial recuperado com sucesso |
| `400` | Requisição inválida |
| `401` | Token inválido ou expirado |
| `500` | Erro interno do servidor ao recuperar o perfil comercial |

#### `GET` `/business/get/categories`

**Obter as categorias de negócios**

Retorna as categorias de negócios disponíveis.


**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Categorias de negócios recuperadas com sucesso |
| `401` | Token inválido ou expirado |
| `500` | Erro interno do servidor ao recuperar as categorias de negócios |

#### `POST` `/business/update/profile`

**Atualizar o perfil comercial**

Atualiza os dados do perfil comercial da instância do WhatsApp.
Todos os campos são opcionais; apenas os enviados serão atualizados.


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `description` | `string` |  | Nova descrição do perfil comercial. Exemplo: `Loja de eletrônicos e acessórios` |
| `address` | `string` |  | Novo endereço do perfil comercial. Exemplo: `Rua das Flores, 123 - Centro` |
| `email` | `string` |  | Novo email do perfil comercial. Exemplo: `contato@empresa.com` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Todos os campos enviados foram atualizados |
| `207` | Sucesso parcial — ao menos um campo falhou |
| `400` | Requisição inválida |
| `401` | Token inválido ou expirado |
| `500` | Falha total — nenhum campo foi atualizado |

#### `POST` `/business/catalog/list`

**Listar os produtos do catálogo**

Lista uma página de produtos do catálogo de um perfil comercial no WhatsApp.

Observações:
- envie apenas `jid` para buscar a primeira página
- a paginação pública usa o campo `after`
- copie exatamente o valor retornado em `response.Paging.After` e envie na próxima chamada
- o valor de `after` é um token opaco: não tente decodificar ou modificar
- a integração atual retorna até 10 produtos por chamada
- o retorno espelha as structs atuais da camada `whatsmeow`, então os campos de `response` usam nomes em maiúsculas (`Products`, `Paging`, etc.)


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `jid` | `string` | ✅ | JID do catálogo a consultar Exemplo: `5511999999999@s.whatsapp.net` |
| `after` | `string` |  | Token da próxima página. Use exatamente o valor retornado em `response.Paging.After`. Exemplo: `Q1VSU09SX1BST1hJTUFfUEFHSU5B` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Produtos do catálogo recuperados com sucesso |
| `400` | Requisição inválida |
| `401` | Token inválido ou expirado |
| `500` | Erro interno do servidor ao recuperar os produtos do catálogo |

#### `POST` `/business/catalog/info`

**Obter informações de um produto do catálogo**

Retorna as informações de um produto específico do catálogo.


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `jid` | `string` | ✅ | JID do catálogo a consultar Exemplo: `5511999999999@s.whatsapp.net` |
| `id` | `string` | ✅ | O ID do produto. |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Informações do produto recuperadas com sucesso |
| `400` | Requisição inválida |
| `401` | Token inválido ou expirado |
| `500` | Erro interno do servidor ao recuperar as informações do produto |

#### `POST` `/business/catalog/delete`

**Deletar um produto do catálogo**

Deleta um produto específico do catálogo.


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `id` | `string` | ✅ | O ID do produto. |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Produto deletado com sucesso |
| `400` | Requisição inválida |
| `401` | Token inválido ou expirado |
| `500` | Erro interno do servidor ao deletar o produto |

#### `POST` `/business/catalog/show`

**Mostrar um produto do catálogo**

Mostra um produto específico do catálogo.


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `id` | `string` | ✅ | O ID do produto. |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Produto mostrado com sucesso |
| `400` | Requisição inválida |
| `401` | Token inválido ou expirado |
| `500` | Erro interno do servidor ao mostrar o produto |

#### `POST` `/business/catalog/hide`

**Ocultar um produto do catálogo**

Oculta um produto específico do catálogo.


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `id` | `string` | ✅ | O ID do produto. |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Produto ocultado com sucesso |
| `400` | Requisição inválida |
| `401` | Token inválido ou expirado |
| `500` | Erro interno do servidor ao ocultar o produto |

---

### Chamadas

Operações relacionadas a chamadas peloWhatsApp.
Permite realizar e rejeitar chamadas programaticamente.



#### `POST` `/call/make`

**Iniciar chamada de voz**

Inicia uma chamada de voz para um contato específico. Este endpoint permite:
1. Iniciar chamadas de voz para contatos
2. Funciona apenas com números válidos do WhatsApp
3. O contato receberá uma chamada de voz

**Nota**: O telefone do contato tocará normalmente, mas ao contato atender, ele não ouvirá nada, e você também não ouvirá nada. 
Este endpoint apenas inicia a chamada, não estabelece uma comunicação de voz real.

**Opcional**: Use `call_duration` para definir por quantos segundos a chamada deve tocar.
Após esse período a chamada é encerrada automaticamente, sem precisar chamar `/call/reject`.

Exemplo de requisição:
```json
{
  "number": "5511999999999",
  "call_duration": 15
}
```

Exemplo de resposta:
```json
{
  "response": "Call successful"
}
```

Erros comuns:
- 401: Token inválido ou expirado
- 400: Número inválido ou ausente
- 500: Erro ao iniciar chamada


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `number` | `string` | ✅ | Número do contato no formato internacional (ex: 5511999999999) Exemplo: `5511999999999` |
| `call_duration` | `integer` |  | Duração da chamada em segundos (opcional). Após esse tempo a chamada é encerrada automaticamente. Exemplo: `15` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Chamada iniciada com sucesso |
| `400` | Requisição inválida |
| `401` | Token inválido ou expirado |
| `500` | Erro interno do servidor |

#### `POST` `/call/reject`

**Rejeitar chamada recebida**

Rejeita uma chamada recebida do WhatsApp.

O body pode ser enviado vazio `{}`. Os campos `number` e `id` são opcionais e podem ser usados para especificar uma chamada específica.

Exemplo de requisição (recomendado):
```json
{}
```

Exemplo de requisição com campos opcionais:
```json
{
  "number": "5511999999999",
  "id": "ABEiGmo8oqkAcAKrBYQAAAAA_1"
}
```

Exemplo de resposta:
```json
{
  "response": "Call rejected"
}
```

Erros comuns:
- 401: Token inválido ou expirado
- 400: Número inválido
- 500: Erro ao rejeitar chamada


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `number` | `string` |  | (Opcional) Número do contato no formato internacional (ex: 5511999999999) |
| `id` | `string` |  | (Opcional) ID único da chamada a ser rejeitada |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Chamada rejeitada com sucesso |
| `400` | Requisição inválida |
| `401` | Token inválido ou expirado |
| `500` | Erro interno do servidor |

---

### Webhooks e SSE


#### `GET` `/webhook`

**Ver Webhook da Instância**

Retorna a configuração atual do webhook da instância, incluindo:
- URL configurada
- Eventos ativos
- Filtros aplicados
- Configurações adicionais

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
    "url": "https://outro-endpoint.com/webhook",
    "events": ["connection", "presence"],
    "excludeMessages": [],
    "addUrlEvents": false,
    "addUrlTypesMessages": false
  }
]
```

A resposta é sempre um array, mesmo quando há apenas um webhook configurado.


**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Configuração do webhook retornada com sucesso |
| `401` | Token inválido ou não fornecido |
| `500` | Erro interno do servidor |

#### `POST` `/webhook`

**Configurar Webhook da Instância**

Gerencia a configuração de webhooks para receber eventos em tempo real da instância.
Permite gerenciar múltiplos webhooks por instância através do campo ID e action.

### 🚀 Modo Simples (Recomendado)

**Uso mais fácil - sem complexidade de IDs**:
- Não inclua `action` nem `id` no payload
- Gerencia automaticamente um único webhook por instância
- Cria novo ou atualiza o existente automaticamente
- **Recomendado**: Sempre use `"excludeMessages": ["wasSentByApi"]` para evitar loops
- **Exemplo**: `{"url": "https://meusite.com/webhook", "events": ["messages"], "excludeMessages": ["wasSentByApi"]}`

### 🧪 Sites para Testes (ordenados por qualidade)

**Para testar webhooks durante desenvolvimento**:
1. **https://webhook.cool/** - ⭐ Melhor opção (sem rate limit, interface limpa)
2. **https://rbaskets.in/** - ⭐ Boa alternativa (confiável, baixo rate limit)
3. **https://webhook.site/** - ⚠️ Evitar se possível (rate limit agressivo)

### ⚙️ Modo Avançado (Para múltiplos webhooks)

**Para usuários que precisam de múltiplos webhooks por instância**:

💡 **Dica**: Mesmo precisando de múltiplos webhooks, considere usar `addUrlEvents` no modo simples.
Um único webhook pode receber diferentes tipos de eventos em URLs específicas 
(ex: `/webhook/message`, `/webhook/connection`), eliminando a necessidade de múltiplos webhooks.

1. **Criar Novo Webhook**:
   - Use `action: "add"`
   - Não inclua `id` no payload
   - O sistema gera ID automaticamente

2. **Atualizar Webhook Existente**:
   - Use `action: "update"`
   - Inclua o `id` do webhook no payload
   - Todos os campos serão atualizados

3. **Remover Webhook**:
   - Use `action: "delete"`
   - Inclua apenas o `id` do webhook
   - Outros campos são ignorados



### Eventos Disponíveis
- `connection`: Alterações no estado da conexão
- `history`: Recebimento de histórico de mensagens
- `messages`: Novas mensagens recebidas
- `messages_update`: Atualizações em mensagens existentes
- `newsletter_messages`: Novos posts/mensagens de canais do WhatsApp
  Para views e reactions de canais, use a rota `/newsletter/updates`.
- `call`: Eventos de chamadas VoIP
- `contacts`: Atualizações na agenda de contatos
- `presence`: Alterações no status de presença
- `groups`: Modificações em grupos
- `labels`: Gerenciamento de etiquetas
- `chats`: Eventos de conversas
- `chat_labels`: Alterações em etiquetas de conversas
- `blocks`: Bloqueios/desbloqueios
- `sender`: Atualizações de campanhas, quando inicia, e quando completa

**Remover mensagens com base nos filtros**:
- `wasSentByApi`: Mensagens originadas pela API ⚠️ **IMPORTANTE:** Use sempre este filtro para evitar loops em automações
- `wasNotSentByApi`: Mensagens não originadas pela API
- `fromMeYes`: Mensagens enviadas pelo usuário
- `fromMeNo`: Mensagens recebidas de terceiros
- `isGroupYes`: Mensagens em grupos
- `isGroupNo`: Mensagens em conversas individuais

💡 **Prevenção de Loops**: Se você tem automações que enviam mensagens via API, sempre inclua `"excludeMessages": ["wasSentByApi"]` no seu webhook. Caso prefira receber esses eventos, certifique-se de que sua automação detecta mensagens enviadas pela própria API para não criar loops infinitos.

**Ações Suportadas**:
- `add`: Registrar novo webhook
- `delete`: Remover webhook existente

**Parâmetros de URL**:
- `addUrlEvents` (boolean): Quando ativo, adiciona o tipo do evento como path parameter na URL.
  Exemplo: `https://api.example.com/webhook/{evento}`
- `addUrlTypesMessages` (boolean): Quando ativo, adiciona o tipo da mensagem como path parameter na URL.
  Exemplo: `https://api.example.com/webhook/{tipo_mensagem}`

**Combinações de Parâmetros**:
- Ambos ativos: `https://api.example.com/webhook/{evento}/{tipo_mensagem}`
  Exemplo real: `https://api.example.com/webhook/message/conversation`
- Apenas eventos: `https://api.example.com/webhook/message`
- Apenas tipos: `https://api.example.com/webhook/conversation`

**Notas Técnicas**:
1. Os parâmetros são adicionados na ordem: evento → tipo mensagem
2. A URL deve ser configurada para aceitar esses parâmetros dinâmicos
3. Funciona com qualquer combinação de eventos/mensagens


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `id` | `string` |  | ID único do webhook (necessário para update/delete) Exemplo: `123e4567-e89b-12d3-a456-426614174000` |
| `enabled` | `boolean` |  | Habilita/desabilita o webhook Exemplo: `True` |
| `url` | `string` | ✅ | URL para receber os eventos Exemplo: `https://example.com/webhook` |
| `events` | `array` |  | Lista de eventos monitorados |
| `excludeMessages` | `array` |  | Filtros para excluir tipos de mensagens |
| `addUrlEvents` | `boolean` |  | Adiciona o tipo do evento como parâmetro na URL. - `false` (padrão): URL normal - `true`: Adiciona evento na URL (ex: `/webhook/message`) |
| `addUrlTypesMessages` | `boolean` |  | Adiciona o tipo da mensagem como parâmetro na URL. - `false` (padrão): URL normal   - `true`: Adiciona tipo da mensagem (ex: `/webhook/conversation`) |
| `action` | `string` |  | Ação a ser executada: - add: criar novo webhook - update: atualizar webhook existente (requer id) - delete: remover webhook (requer apenas id) Se não  |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Webhook configurado ou atualizado com sucesso |
| `400` | Requisição inválida |
| `401` | Token inválido ou não fornecido |
| `500` | Erro interno do servidor |

#### `GET` `/webhook/errors`

**Ver últimos erros do webhook local**

Retorna em memória os últimos 20 erros de envio dos webhooks locais da instância autenticada.

Cada item inclui data/hora (`created`), URL de destino, evento, tipo do webhook
(`local`), payload tentado, número de tentativas, status HTTP final quando existir e a mensagem de erro.

Observações:
- O histórico fica apenas em memória e é perdido quando o processo reinicia.
- O endpoint usa o mesmo `token` da instância.
- Retorna apenas falhas dos webhooks locais da própria instância.
- Falhas do webhook global ficam disponíveis separadamente em `/globalwebhook/errors` com `admintoken`.
- O header `X-Webhook-Error-Capture-Started-At` informa desde quando a captura atual está valendo.

Exemplo de consulta:
```bash
curl -X GET "$BASE_URL/webhook/errors" \
  -H "token: SUA_INSTANCIA_TOKEN"
```


**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Histórico retornado com sucesso |
| `401` | Token inválido ou não fornecido |

#### `GET` `/sse`

**Server-Sent Events (SSE)**

Receber eventos em tempo real via Server-Sent Events (SSE)

### Funcionalidades Principais:
- Configuração de URL para recebimento de eventos
- Seleção granular de tipos de eventos
- Filtragem avançada de mensagens
- Parâmetros adicionais na URL
- Gerenciamento múltiplo de webhooks

**Eventos Disponíveis**:
- `connection`: Alterações no estado da conexão
- `history`: Recebimento de histórico de mensagens
- `messages`: Novas mensagens recebidas
- `messages_update`: Atualizações em mensagens existentes
- `call`: Eventos de chamadas VoIP
- `contacts`: Atualizações na agenda de contatos
- `presence`: Alterações no status de presença
- `groups`: Modificações em grupos
- `labels`: Gerenciamento de etiquetas
- `chats`: Eventos de conversas
- `chat_labels`: Alterações em etiquetas de conversas
- `blocks`: Bloqueios/desbloqueios


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

🔓 **Autenticação:** Não requerida


**Parâmetros**:

| Nome | In | Tipo | Obrigatório | Descrição |
|---|---|---|:---:|---|
| `token` | `query` | `string` | ✅ | Token de autenticação da instância |
| `events` | `query` | `string` | ✅ | Tipos de eventos a serem recebidos. Suporta dois formatos: - Separados por vírgula: `?events=chats,messages` - Parâmetro |
| `excludeMessages` | `query` | `string` |  | Tipos de mensagens a serem excluídas do evento `messages`. Suporta dois formatos: - Separados por vírgula: `?excludeMess |

---

### Enviar Mensagem

Endpoints para envio de mensagens do WhatsApp com diferentes tipos de conteúdo.

## Campos Opcionais Comuns

Todos os endpoints de envio de mensagem suportam os seguintes campos opcionais:

- **`delay`** *(integer)*: Atraso em milissegundos antes do envio
  - Durante o atraso aparecerá "Digitando..." ou "Gravando áudio..." dependendo do tipo
  - Exemplo: `5000` (5 segundos)

- **`readchat`** *(boolean)*: Marcar chat como lido após envio
  - Remove o contador de mensagens não lidas do chat
  - Exemplo: `true`

- **`readmessages`** *(boolean)*: Marcar últimas mensagens recebidas como lidas
  - Marca as últimas 10 mensagens **recebidas** (não enviadas por você) como lidas
  - Útil para confirmar leitura de mensagens pendentes antes de responder
  - Diferente do `readchat` que apenas remove contador de não lidas
  - Exemplo: `true`

- **`replyid`** *(string)*: ID da mensagem para responder
  - Cria uma resposta vinculada à mensagem original
  - Suporte varia por tipo de mensagem
  - Exemplo: `"3A12345678901234567890123456789012"`

- **`mentions`** *(string)*: Números para mencionar (apenas para envio em grupos)
  - Números específicos: `"5511999999999,5511888888888"`
  - Mencionar todos: `"all"`

- **`forward`** *(boolean)*: Marca a mensagem como encaminhada no WhatsApp
  - Adiciona o indicador "Encaminhada" na mensagem
  - Exemplo: `true`

- **`track_source`** *(string)*: Origem do rastreamento da mensagem
  - Identifica o sistema ou fonte que está enviando a mensagem
  - Útil para integrações (ex: "chatwoot", "crm", "chatbot")
  - Exemplo: `"chatwoot"`

- **`track_id`** *(string)*: ID para rastreamento da mensagem
  - Identificador livre para acompanhar a mensagem em sistemas externos
  - Permite correlacionar mensagens entre diferentes plataformas
  - **Nota**: O sistema aceita valores duplicados - não há validação de unicidade
  - Use o mesmo ID em várias mensagens se fizer sentido para sua integração
  - Exemplo: `"msg_123456789"`

- **`async`** *(boolean)*: Envia pela fila interna sem bloquear a requisição
  - Resposta 200 indica que a mensagem entrou na fila; o envio real pode falhar depois
  - Em caso de falha, pesquise em `/message/find` com `status=failed`

### Envio para Grupos
- **`number`** *(string)*: Para enviar mensagem para grupo, use o ID do grupo que termina com `@g.us`
  - Exemplo: `"120363012345678901@g.us"`
  - **Como obter o ID do grupo:**
    - Use o `chatid` do webhook recebido quando alguém envia mensagem no grupo
    - Use o endpoint `GET /group/list` para listar todos os grupos e seus IDs

## Placeholders Disponíveis

Todos os endpoints de envio de mensagem suportam placeholders dinâmicos para personalização automática:

### Campos de Nome
- **`{{name}}`**: Nome consolidado do chat, usando a primeira opção disponível:
  1. Nome do lead (`lead_name`)
  2. Nome completo do lead (`lead_fullName`)
  3. Nome do contato no WhatsApp (`wa_contactName`)
  4. Nome do perfil do WhatsApp (`wa_name`)

- **`{{first_name}}`**: Primeira palavra válida do nome consolidado (mínimo 2 caracteres)

### Campos do WhatsApp
- **`{{wa_name}}`**: Nome do perfil do WhatsApp
- **`{{wa_contactName}}`**: Nome do contato como salvo no WhatsApp

### Campos do Lead
- **`{{lead_name}}`**: Nome do lead
- **`{{lead_fullName}}`**: Nome completo do lead
- **`{{lead_personalid}}`**: ID pessoal (CPF, CNPJ, etc)
- **`{{lead_email}}`**: Email do lead
- **`{{lead_status}}`**: Status atual do lead
- **`{{lead_notes}}`**: Anotações do lead
- **`{{lead_assignedAttendant_id}}`**: ID do atendente designado

### Campos Personalizados
Campos adicionados via custom fields são acessíveis usando `{{lead_field01}}` à `{{lead_field20}}` ou usar `{{nomedocampo}}` definido em `/instance/updateFieldsMap`.

### Exemplo de Uso
```
Olá {{name}}! Vi que você trabalha na {{company}}.
Seu email {{lead_email}} está correto?
```

**💡 Dica**: Use `/chat/find` para buscar dados do chat e ver os campos disponíveis antes de enviar mensagens com placeholders.



#### `POST` `/send/text`

**Enviar mensagem de texto**

Envia uma mensagem de texto para um contato, grupo ou canal/newsletter.

## Recursos Específicos

- **Preview de links** com suporte a personalização automática ou customizada
- **Formatação básica** do texto
- **Substituição automática de placeholders** dinâmicos

## Envio para Newsletter

Para enviar texto para um canal, use o mesmo campo `number`, mas informe o JID completo do canal:
- Exemplo: `120363123456789012@newsletter`

```json
{
  "number": "120363123456789012@newsletter",
  "text": "Post publicado no canal"
}
```

## Campos Comuns

Este endpoint suporta todos os **campos opcionais comuns** documentados na tag **"Enviar Mensagem"**, incluindo:
`delay`, `readchat`, `readmessages`, `replyid`, `mentions`, `forward`, `track_source`, `track_id`, placeholders e envio para grupos.

## Preview de Links

### Preview Automático
```json
{
  "number": "5511999999999",
  "text": "Confira: https://exemplo.com",
  "linkPreview": true
}
```

### Preview Personalizado
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


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `number` | `string` | ✅ | ID do chat para o qual a mensagem será enviada. Pode ser um número de telefone em formato internacional, um ID de grupo (`@g.us`), um ID de usuário (c |
| `text` | `string` | ✅ | Texto da mensagem (aceita placeholders) Exemplo: `Olá {{name}}! Como posso ajudar?` |
| `linkPreview` | `boolean` |  | Ativa/desativa preview de links. Se true, procura automaticamente um link no texto para gerar preview.  Comportamento: - Se apenas linkPreview=true: g |
| `linkPreviewTitle` | `string` |  | Define um título personalizado para o preview do link Exemplo: `Título Personalizado` |
| `linkPreviewDescription` | `string` |  | Define uma descrição personalizada para o preview do link Exemplo: `Descrição personalizada do link` |
| `linkPreviewImage` | `string` |  | URL ou Base64 da imagem para usar no preview do link Exemplo: `https://exemplo.com/imagem.jpg` |
| `linkPreviewLarge` | `boolean` |  | Se true, gera um preview grande com upload da imagem. Se false, gera um preview pequeno sem upload Exemplo: `True` |
| `replyid` | `string` |  | ID da mensagem para responder Exemplo: `3EB0538DA65A59F6D8A251` |
| `mentions` | `string` |  | Números para mencionar (separados por vírgula) Exemplo: `5511999999999,5511888888888` |
| `readchat` | `boolean` |  | Marca conversa como lida após envio Exemplo: `True` |
| `readmessages` | `boolean` |  | Marca últimas mensagens recebidas como lidas Exemplo: `True` |
| `delay` | `integer` |  | Atraso em milissegundos antes do envio, durante o atraso apacerá 'Digitando...' Exemplo: `1000` |
| `forward` | `boolean` |  | Marca a mensagem como encaminhada no WhatsApp Exemplo: `True` |
| `track_source` | `string` |  | Origem do rastreamento da mensagem Exemplo: `chatwoot` |
| `track_id` | `string` |  | ID para rastreamento da mensagem (aceita valores duplicados) Exemplo: `msg_123456789` |
| `async` | `boolean` |  | Se true, envia a mensagem de forma assíncrona via fila interna. Útil para alto volume de mensagens. Exemplo: `False` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Mensagem enviada com sucesso |
| `400` | Requisição inválida |
| `401` | Não autorizado |
| `429` | Limite de requisições excedido |
| `500` | Erro interno do servidor |

#### `POST` `/send/media`

**Enviar mídia (imagem, vídeo, áudio ou documento)**

Envia diferentes tipos de mídia para um contato, grupo ou canal/newsletter. Suporta URLs ou arquivos base64.

## Tipos de Mídia Suportados
- **`image`**: Imagens (JPG preferencialmente)
- **`video`**: Vídeos (apenas MP4)
- **`videoplay`**: Vídeo com comportamento visual de autoplay/loop no WhatsApp
- **`document`**: Documentos (PDF, DOCX, XLSX, etc)
- **`audio`**: Áudio comum (MP3 ou OGG)
- **`myaudio`**: Mensagem de voz (alternativa ao PTT)
- **`ptt`**: Mensagem de voz (Push-to-Talk)
- **`ptv`**: Mensagem de vídeo (Push-to-Video)
- **`sticker`**: Figurinha/Sticker

## Recursos Específicos
- **Upload por URL ou base64**
- **Caption/legenda** opcional com suporte a placeholders
- **Nome personalizado** para documentos (`docName`)
- **Geração automática de thumbnails**
- **Compressão otimizada** conforme o tipo

## Envio para Newsletter

Para enviar mídia para um canal, use o mesmo campo `number`, mas informe o JID completo do canal:
- Exemplo: `120363123456789012@newsletter`

```json
{
  "number": "120363123456789012@newsletter",
  "type": "image",
  "file": "https://exemplo.com/foto.jpg",
  "text": "Imagem publicada no canal"
}
```

## Campos Comuns

Este endpoint suporta todos os **campos opcionais comuns** documentados na tag **"Enviar Mensagem"**, incluindo:
`delay`, `readchat`, `readmessages`, `replyid`, `mentions`, `forward`, `track_source`, `track_id`, placeholders e envio para grupos.

## Exemplos Básicos

### Imagem Simples
```json
{
  "number": "5511999999999",
  "type": "image",
  "file": "https://exemplo.com/foto.jpg"
}
```

### Documento com Nome
```json
{
  "number": "5511999999999",
  "type": "document",
  "file": "https://exemplo.com/contrato.pdf",
  "docName": "Contrato.pdf",
  "text": "Segue o documento solicitado"
}
```


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `number` | `string` | ✅ | ID do chat para o qual a mensagem será enviada. Pode ser um número de telefone em formato internacional, um ID de grupo (`@g.us`), um ID de usuário (c |
| `type` | `string` | ✅ | Tipo de mídia (image, video, videoplay, document, audio, myaudio, ptt, ptv, sticker) Valores: `image`, `video`, `videoplay`, `document`, `audio`, `mya |
| `file` | `string` | ✅ | URL ou base64 do arquivo Exemplo: `https://exemplo.com/imagem.jpg` |
| `text` | `string` |  | Texto descritivo (caption) - aceita placeholders Exemplo: `Veja esta foto!` |
| `docName` | `string` |  | Nome do arquivo (apenas para documents) Exemplo: `relatorio.pdf` |
| `thumbnail` | `string` |  | URL ou base64 de thumbnail personalizado para vídeos e documentos Exemplo: `https://exemplo.com/thumb.jpg` |
| `mimetype` | `string` |  | MIME type do arquivo (opcional, detectado automaticamente) Exemplo: `application/pdf` |
| `replyid` | `string` |  | ID da mensagem para responder Exemplo: `3EB0538DA65A59F6D8A251` |
| `mentions` | `string` |  | Números para mencionar (separados por vírgula) Exemplo: `5511999999999,5511888888888` |
| `readchat` | `boolean` |  | Marca conversa como lida após envio Exemplo: `True` |
| `readmessages` | `boolean` |  | Marca últimas mensagens recebidas como lidas Exemplo: `True` |
| `delay` | `integer` |  | Atraso em milissegundos antes do envio, durante o atraso apacerá 'Digitando...' ou 'Gravando áudio...' Exemplo: `1000` |
| `forward` | `boolean` |  | Marca a mensagem como encaminhada no WhatsApp Exemplo: `True` |
| `track_source` | `string` |  | Origem do rastreamento da mensagem Exemplo: `chatwoot` |
| `track_id` | `string` |  | ID para rastreamento da mensagem (aceita valores duplicados) Exemplo: `msg_123456789` |
| `async` | `boolean` |  | Se true, envia a mensagem de forma assíncrona via fila interna Exemplo: `False` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Mídia enviada com sucesso |
| `400` | Requisição inválida |
| `401` | Não autorizado |
| `413` | Arquivo muito grande |
| `415` | Formato de mídia não suportado |
| `500` | Erro interno do servidor |

#### `POST` `/send/contact`

**Enviar cartão de contato (vCard)**

Envia um cartão de contato (vCard) para um contato ou grupo.

## Recursos Específicos

- **vCard completo** com nome, telefones, organização, email e URL
- **Múltiplos números de telefone** (separados por vírgula)
- **Cartão clicável** no WhatsApp para salvar na agenda
- **Informações profissionais** (organização/empresa)

## Campos Comuns

Este endpoint suporta todos os **campos opcionais comuns** documentados na tag **"Enviar Mensagem"**, incluindo:
`delay`, `readchat`, `readmessages`, `replyid`, `mentions`, `forward`, `track_source`, `track_id`, placeholders e envio para grupos.

## Exemplo Básico
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


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `number` | `string` | ✅ | ID do chat para o qual a mensagem será enviada. Pode ser um número de telefone em formato internacional, um ID de grupo (`@g.us`), um ID de usuário (c |
| `fullName` | `string` | ✅ | Nome completo do contato Exemplo: `João Silva` |
| `phoneNumber` | `string` | ✅ | Números de telefone (separados por vírgula) Exemplo: `5511999999999,5511888888888` |
| `organization` | `string` |  | Nome da organização/empresa Exemplo: `Empresa XYZ` |
| `email` | `string` |  | Endereço de email Exemplo: `joao@empresa.com` |
| `url` | `string` |  | URL pessoal ou da empresa Exemplo: `https://empresa.com/joao` |
| `replyid` | `string` |  | ID da mensagem para responder Exemplo: `3EB0538DA65A59F6D8A251` |
| `mentions` | `string` |  | Números para mencionar (separados por vírgula) Exemplo: `5511999999999,5511888888888` |
| `readchat` | `boolean` |  | Marca conversa como lida após envio Exemplo: `True` |
| `readmessages` | `boolean` |  | Marca últimas mensagens recebidas como lidas Exemplo: `True` |
| `delay` | `integer` |  | Atraso em milissegundos antes do envio, durante o atraso apacerá 'Digitando...' Exemplo: `1000` |
| `forward` | `boolean` |  | Marca a mensagem como encaminhada no WhatsApp Exemplo: `True` |
| `track_source` | `string` |  | Origem do rastreamento da mensagem Exemplo: `chatwoot` |
| `track_id` | `string` |  | ID para rastreamento da mensagem (aceita valores duplicados) Exemplo: `msg_123456789` |
| `async` | `boolean` |  | Se true, envia a mensagem de forma assíncrona via fila interna Exemplo: `False` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Cartão de contato enviado com sucesso |
| `400` | Requisição inválida |
| `401` | Não autorizado |
| `429` | Limite de requisições excedido |
| `500` | Erro interno do servidor |

#### `POST` `/send/location`

**Enviar localização geográfica**

Envia uma localização geográfica para um contato ou grupo.

## Recursos Específicos

- **Coordenadas precisas** (latitude e longitude obrigatórias)
- **Nome do local** para identificação
- **Endereço completo** para exibição detalhada
- **Mapa interativo** no WhatsApp para navegação
- **Pin personalizado** com nome do local

## Campos Comuns

Este endpoint suporta todos os **campos opcionais comuns** documentados na tag **"Enviar Mensagem"**, incluindo:
`delay`, `readchat`, `readmessages`, `replyid`, `mentions`, `forward`, `track_source`, `track_id`, placeholders e envio para grupos.

## Exemplo Básico
```json
{
  "number": "5511999999999",
  "name": "Maracanã",
  "address": "Av. Pres. Castelo Branco - Maracanã, Rio de Janeiro - RJ",
  "latitude": -22.912982815767986,
  "longitude": -43.23028153499254
}
```


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `number` | `string` | ✅ | ID do chat para o qual a mensagem será enviada. Pode ser um número de telefone em formato internacional, um ID de grupo (`@g.us`), um ID de usuário (c |
| `name` | `string` |  | Nome do local Exemplo: `MASP` |
| `address` | `string` |  | Endereço do local Exemplo: `Av. Paulista, 1578 - Bela Vista, São Paulo - SP` |
| `latitude` | `number` | ✅ | Latitude (-90 a 90) Exemplo: `-23.5616` |
| `longitude` | `number` | ✅ | Longitude (-180 a 180) Exemplo: `-46.6562` |
| `replyid` | `string` |  | ID da mensagem para responder Exemplo: `3EB0538DA65A59F6D8A251` |
| `mentions` | `string` |  | Números para mencionar (separados por vírgula) Exemplo: `5511999999999,5511888888888` |
| `readchat` | `boolean` |  | Marca conversa como lida após envio Exemplo: `True` |
| `readmessages` | `boolean` |  | Marca últimas mensagens recebidas como lidas Exemplo: `True` |
| `delay` | `integer` |  | Atraso em milissegundos antes do envio, durante o atraso apacerá 'Digitando...' Exemplo: `1000` |
| `forward` | `boolean` |  | Marca a mensagem como encaminhada no WhatsApp Exemplo: `True` |
| `track_source` | `string` |  | Origem do rastreamento da mensagem Exemplo: `chatwoot` |
| `track_id` | `string` |  | ID para rastreamento da mensagem (aceita valores duplicados) Exemplo: `msg_123456789` |
| `async` | `boolean` |  | Se true, envia a mensagem de forma assíncrona via fila interna Exemplo: `False` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Localização enviada com sucesso |
| `400` | Requisição inválida |
| `401` | Não autorizado |
| `429` | Limite de requisições excedido |
| `500` | Erro interno do servidor |

#### `POST` `/message/presence`

**Enviar atualização de presença**

Envia uma atualização de presença para um contato ou grupo de forma **assíncrona**.

## 🔄 Comportamento Assíncrono:
- **Execução independente**: A presença é gerenciada em background, não bloqueia o retorno da API
- **Limite máximo**: 5 minutos de duração (300 segundos)
- **Tick de atualização**: Reenvia a presença a cada 10 segundos
- **Cancelamento automático**: Presença é cancelada automaticamente ao enviar uma mensagem para o mesmo chat

## 📱 Tipos de presença suportados:
- **composing**: Indica que você está digitando uma mensagem
- **recording**: Indica que você está gravando um áudio
- **paused**: Remove/cancela a indicação de presença atual

## ⏱️ Controle de duração:
- **Sem delay**: Usa limite padrão de 5 minutos
- **Com delay**: Usa o valor especificado (máximo 5 minutos)
- **Cancelamento**: Envio de mensagem cancela presença automaticamente

## 📋 Exemplos de uso:

### Digitar por 30 segundos:
```json
{
  "number": "5511999999999",
  "presence": "composing",
  "delay": 30000
}
```

### Gravar áudio por 1 minuto:
```json
{
  "number": "5511999999999",
  "presence": "recording",
  "delay": 60000
}
```

### Cancelar presença atual:
```json
{
  "number": "5511999999999",
  "presence": "paused"
}
```

### Usar limite máximo (5 minutos):
```json
{
  "number": "5511999999999",
  "presence": "composing"
}
```


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `number` | `string` | ✅ | Número do destinatário no formato internacional (ex: 5511999999999) Exemplo: `5511999999999` |
| `presence` | `string` | ✅ | Tipo de presença a ser enviada Valores: `composing`, `recording`, `paused` |
| `delay` | `integer` |  | Duração em milissegundos que a presença ficará ativa (máximo 5 minutos = 300000ms). Se não informado ou valor maior que 5 minutos, usa o limite padrão |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Presença atualizada com sucesso |
| `400` | Requisição inválida |
| `401` | Token inválido ou expirado |
| `500` | Erro interno do servidor |

#### `POST` `/send/status`

**Enviar Stories (Status)**

Envia um story (status) com suporte para texto, imagem, vídeo e áudio.

**Suporte a campos de rastreamento**: Este endpoint também suporta `track_source` e `track_id` documentados na tag **"Enviar Mensagem"**.

## Tipos de Status
- text: Texto com estilo e cor de fundo
- image: Imagens com legenda opcional
- video: Vídeos com thumbnail e legenda
- audio: Áudio normal ou mensagem de voz (PTT)

## Cores de Fundo
- 1-3: Tons de amarelo
- 4-6: Tons de verde
- 7-9: Tons de azul
- 10-12: Tons de lilás
- 13: Magenta
- 14-15: Tons de rosa
- 16: Marrom claro
- 17-19: Tons de cinza (19 é o padrão)

## Fontes (para texto)
- 0: Padrão 
- 1-8: Estilos alternativos

## Limites
- Texto: Máximo 656 caracteres
- Imagem: JPG, PNG, GIF
- Vídeo: MP4, MOV
- Áudio: MP3, OGG, WAV (convertido para OGG/OPUS)

## Exemplo
```json
{
  "type": "text",
  "text": "Novidades chegando!",
  "background_color": 7,
  "font": 1
}
```


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `type` | `string` | ✅ | Tipo do status Valores: `text`, `image`, `video`, `audio`, `myaudio`, `ptt` |
| `text` | `string` |  | Texto principal ou legenda Exemplo: `Novidades chegando!` |
| `background_color` | `integer` |  | Código da cor de fundo Exemplo: `7` |
| `font` | `integer` |  | Estilo da fonte (apenas para type=text) Exemplo: `1` |
| `file` | `string` |  | URL ou Base64 do arquivo de mídia Exemplo: `https://example.com/video.mp4` |
| `thumbnail` | `string` |  | URL ou Base64 da miniatura (opcional para vídeos) Exemplo: `https://example.com/thumb.jpg` |
| `mimetype` | `string` |  | MIME type do arquivo (opcional) Exemplo: `video/mp4` |
| `replyid` | `string` |  | ID da mensagem para responder Exemplo: `3EB0538DA65A59F6D8A251` |
| `mentions` | `string` |  | Números para mencionar (separados por vírgula) Exemplo: `5511999999999,5511888888888` |
| `readchat` | `boolean` |  | Marca conversa como lida após envio Exemplo: `True` |
| `readmessages` | `boolean` |  | Marca últimas mensagens recebidas como lidas Exemplo: `True` |
| `delay` | `integer` |  | Atraso em milissegundos antes do envio Exemplo: `1000` |
| `forward` | `boolean` |  | Marca a mensagem como encaminhada no WhatsApp Exemplo: `False` |
| `async` | `boolean` |  | Se true, envia a mensagem de forma assíncrona via fila interna Exemplo: `False` |
| `track_source` | `string` |  | Origem do rastreamento da mensagem Exemplo: `chatwoot` |
| `track_id` | `string` |  | ID para rastreamento da mensagem (aceita valores duplicados) Exemplo: `msg_123456789` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Status enviado com sucesso |
| `400` | Requisição inválida |
| `401` | Não autorizado |
| `500` | Erro interno do servidor |

#### `POST` `/send/menu`

**Enviar menu interativo (botões, carrosel, lista ou enquete)**

Este endpoint oferece uma interface unificada para envio de quatro tipos principais de mensagens interativas:
- Botões: Para ações rápidas e diretas
- Carrosel de Botões: Para uma lista horizontal de botões com imagens
- Listas: Para menus organizados em seções
- Enquetes: Para coleta de opiniões e votações

**Suporte a campos de rastreamento**: Este endpoint também suporta `track_source` e `track_id` documentados na tag **"Enviar Mensagem"**.

## Estrutura Base do Payload

Todas as requisições seguem esta estrutura base:

```json
{
  "number": "5511999999999",
  "type": "button|list|poll|carousel",
  "text": "Texto principal da mensagem",
  "choices": ["opções baseadas no tipo escolhido"],
  "footerText": "Texto do rodapé (opcional para botões e listas)",
  "listButton": "Texto do botão (para listas)",
  "selectableCount": "Número de opções selecionáveis (apenas para enquetes)"
}
```

## Tipos de Mensagens Interativas

### 1. Botões (type: "button")

Cria botões interativos com diferentes funcionalidades de ação.

#### Campos Específicos
- `footerText`: Texto opcional exibido abaixo da mensagem principal
- `choices`: Array de opções que serão convertidas em botões

#### Formatos de Botões
Cada botão pode ser configurado usando `|` (pipe) ou `\n` (quebra de linha) como separadores:

- **Botão de Resposta**: 
  - `"texto|id"` ou 
  - `"texto\nid"` ou 
  - `"texto"` (ID será igual ao texto)

- **Botão de Cópia**: 
  - `"texto|copy:código"` ou 
  - `"texto\ncopy:código"`

- **Botão de Chamada**: 
  - `"texto|call:+5511999999999"` ou 
  - `"texto\ncall:+5511999999999"`

- **Botão de URL**: 
  - `"texto|https://exemplo.com"` ou 
  - `"texto|url:https://exemplo.com"`

#### Botões com Imagem
Para adicionar uma imagem aos botões, use o campo `imageButton` no payload:

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

> **Suporte**: O campo `imageButton` aceita URLs ou imagens em base64.

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
```

#### Limitações e Compatibilidade
> **Importante**: Ao combinar botões de resposta com outros tipos (call, url, copy) na mesma mensagem, será exibido o aviso: "Não é possível exibir esta mensagem no WhatsApp Web. Abra o WhatsApp no seu celular para visualizá-la."

### 2. Listas (type: "list")

Cria menus organizados em seções com itens selecionáveis.

#### Campos Específicos
- `listButton`: Texto do botão que abre a lista
- `footerText`: Texto opcional do rodapé
- `choices`: Array com seções e itens da lista

#### Formato das Choices
- `"[Título da Seção]"`: Inicia uma nova seção
- `"texto|id|descrição"`: Item da lista com:
  - texto: Label do item
  - id: Identificador único, opcional
  - descrição: Texto descritivo adicional e opcional

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
  "listButton": "Ver Catálogo",
  "footerText": "Preços sujeitos a alteração"
}
```

### 3. Enquetes (type: "poll")

Cria enquetes interativas para votação.

#### Campos Específicos
- `selectableCount`: Número de opções que podem ser selecionadas (padrão: 1)
- `choices`: Array simples com as opções de voto

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

### 4. Carousel (type: "carousel")

Cria um carrossel de cartões com imagens e botões interativos.

#### Campos Específicos
- `choices`: Array com elementos do carrossel na seguinte ordem:
  - `[Texto do cartão]`: Texto do cartão entre colchetes
  - `{URL ou base64 da imagem}`: Imagem entre chaves
  - Botões do cartão (um por linha):
    - `"texto|copy:código"` para botão de copiar
    - `"texto|https://url"` para botão de link
    - `"texto|call:+número"` para botão de ligação

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

> **Nota**: Criamos outro endpoint para carrossel: `/send/carousel`, funciona da mesma forma, mas com outro formato de payload. Veja o que é mais fácil para você.

## Termos de uso

Os recursos de botões interativos e listas podem ser descontinuados a qualquer momento sem aviso prévio. Não nos responsabilizamos por quaisquer alterações ou indisponibilidade destes recursos.

### Alternativas e Compatibilidade

Considerando a natureza dinâmica destes recursos, nosso endpoint foi projetado para facilitar a migração entre diferentes tipos de mensagens (botões, listas e enquetes). 

Recomendamos criar seus fluxos de forma flexível, preparados para alternar entre os diferentes tipos.

Em caso de descontinuidade de algum recurso, você poderá facilmente migrar para outro tipo de mensagem apenas alterando o campo "type" no payload, mantendo a mesma estrutura de choices.


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `number` | `string` | ✅ | ID do chat para o qual a mensagem será enviada. Pode ser um número de telefone em formato internacional, um ID de grupo (`@g.us`), um ID de usuário (c |
| `type` | `string` | ✅ | Tipo do menu (button, list, poll, carousel) Valores: `button`, `list`, `poll`, `carousel` |
| `text` | `string` | ✅ | Texto principal (aceita placeholders) Exemplo: `Escolha uma opção:` |
| `footerText` | `string` |  | Texto do rodapé (opcional) Exemplo: `Menu de serviços` |
| `listButton` | `string` |  | Texto do botão principal Exemplo: `Ver opções` |
| `selectableCount` | `integer` |  | Número máximo de opções selecionáveis (para enquetes) Exemplo: `1` |
| `choices` | `array` | ✅ | Lista de opções. Use [Título] para seções em listas Exemplo: `['[Eletrônicos]', 'Smartphones|phones|Últimos lançamentos', 'Notebooks|notes|Modelos 202 |
| `imageButton` | `string` |  | URL da imagem para botões (recomendado para type: button) Exemplo: `https://exemplo.com/imagem-botao.jpg` |
| `replyid` | `string` |  | ID da mensagem para responder Exemplo: `3EB0538DA65A59F6D8A251` |
| `mentions` | `string` |  | Números para mencionar (separados por vírgula) Exemplo: `5511999999999,5511888888888` |
| `readchat` | `boolean` |  | Marca conversa como lida após envio Exemplo: `True` |
| `readmessages` | `boolean` |  | Marca últimas mensagens recebidas como lidas Exemplo: `True` |
| `delay` | `integer` |  | Atraso em milissegundos antes do envio, durante o atraso apacerá 'Digitando...' Exemplo: `1000` |
| `track_source` | `string` |  | Origem do rastreamento da mensagem Exemplo: `chatwoot` |
| `track_id` | `string` |  | ID para rastreamento da mensagem (aceita valores duplicados) Exemplo: `msg_123456789` |
| `async` | `boolean` |  | Se true, envia a mensagem de forma assíncrona via fila interna Exemplo: `False` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Menu enviado com sucesso |
| `400` | Requisição inválida |
| `401` | Não autorizado |
| `429` | Limite de requisições excedido |
| `500` | Erro interno do servidor |

#### `POST` `/send/carousel`

**Enviar carrossel de mídia com botões**

Este endpoint permite enviar um carrossel com imagens e botões interativos.
Funciona de maneira igual ao endpoint `/send/menu` com type: carousel, porém usando outro formato de payload.

## Campos Comuns

Este endpoint suporta todos os **campos opcionais comuns** documentados na tag **"Enviar Mensagem"**, incluindo:
`delay`, `readchat`, `readmessages`, `replyid`, `mentions`, `forward`, `track_source`, `track_id`, placeholders e envio para grupos.

## Estrutura do Payload

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

## Tipos de Botões

- `REPLY`: Botão de resposta rápida
  - Quando clicado, envia o valor do id como resposta ao chat
  - O id será o texto enviado como resposta

- `URL`: Botão com link
  - Quando clicado, abre a URL especificada
  - O id deve conter a URL completa (ex: https://exemplo.com)

- `COPY`: Botão para copiar texto
  - Quando clicado, copia o texto para a área de transferência
  - O id será o texto que será copiado

- `CALL`: Botão para realizar chamada
  - Quando clicado, inicia uma chamada telefônica
  - O id deve conter o número de telefone

## Exemplo de Botões
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
```

## Exemplo Completo de Carrossel
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


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `number` | `string` | ✅ | ID do chat para o qual a mensagem será enviada. Pode ser um número de telefone em formato internacional, um ID de grupo (`@g.us`), um ID de usuário (c |
| `text` | `string` | ✅ | Texto principal da mensagem Exemplo: `Nossos Produtos em Destaque` |
| `carousel` | `array` | ✅ | Array de cartões do carrossel |
| `delay` | `integer` |  | Atraso em milissegundos antes do envio Exemplo: `1000` |
| `readchat` | `boolean` |  | Marca conversa como lida após envio Exemplo: `True` |
| `readmessages` | `boolean` |  | Marca últimas mensagens recebidas como lidas Exemplo: `True` |
| `replyid` | `string` |  | ID da mensagem para responder Exemplo: `3EB0538DA65A59F6D8A251` |
| `mentions` | `string` |  | Números para mencionar (separados por vírgula) Exemplo: `5511999999999,5511888888888` |
| `forward` | `boolean` |  | Marca a mensagem como encaminhada no WhatsApp Exemplo: `False` |
| `async` | `boolean` |  | Se true, envia a mensagem de forma assíncrona via fila interna Exemplo: `False` |
| `track_source` | `string` |  | Origem do rastreamento da mensagem Exemplo: `chatwoot` |
| `track_id` | `string` |  | ID para rastreamento da mensagem (aceita valores duplicados) Exemplo: `msg_123456789` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Carrossel enviado com sucesso |
| `400` | Requisição inválida |
| `401` | Não autorizado |
| `500` | Erro interno do servidor |

#### `POST` `/send/location-button`

**Solicitar localização do usuário**

Este endpoint envia uma mensagem com um botão que solicita a localização do usuário.
Quando o usuário clica no botão, o WhatsApp abre a interface para compartilhar a localização atual.

## Campos Comuns

Este endpoint suporta todos os **campos opcionais comuns** documentados na tag **"Enviar Mensagem"**, incluindo:
`delay`, `readchat`, `readmessages`, `replyid`, `mentions`, `forward`, `track_source`, `track_id`, placeholders e envio para grupos.

## Estrutura do Payload

```json
{
  "number": "5511999999999",
  "text": "Por favor, compartilhe sua localização",
  "delay": 0,
  "readchat": true
}
```

## Exemplo de Uso

```json
{
  "number": "5511999999999",
  "text": "Para continuar o atendimento, clique no botão abaixo e compartilhe sua localização"
}
```

> **Nota**: O botão de localização é adicionado automaticamente à mensagem


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `number` | `string` | ✅ | ID do chat para o qual a mensagem será enviada. Pode ser um número de telefone em formato internacional, um ID de grupo (`@g.us`), um ID de usuário (c |
| `text` | `string` | ✅ | Texto da mensagem que será exibida Exemplo: `Por favor, compartilhe sua localização` |
| `delay` | `integer` |  | Atraso em milissegundos antes do envio Exemplo: `0` |
| `readchat` | `boolean` |  | Se deve marcar a conversa como lida após envio Exemplo: `True` |
| `readmessages` | `boolean` |  | Marca últimas mensagens recebidas como lidas Exemplo: `True` |
| `replyid` | `string` |  | ID da mensagem para responder Exemplo: `3EB0538DA65A59F6D8A251` |
| `mentions` | `string` |  | Números para mencionar (separados por vírgula) Exemplo: `5511999999999,5511888888888` |
| `async` | `boolean` |  | Se true, envia a mensagem de forma assíncrona via fila interna Exemplo: `False` |
| `track_source` | `string` |  | Origem do rastreamento da mensagem Exemplo: `chatwoot` |
| `track_id` | `string` |  | ID para rastreamento da mensagem (aceita valores duplicados) Exemplo: `msg_123456789` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Localização enviada com sucesso |
| `400` | Requisição inválida |
| `401` | Não autorizado |
| `500` | Erro interno do servidor |

#### `POST` `/send/request-payment`

**Solicitar pagamento**

Envia uma solicitação de pagamento com o botão nativo **"Revisar e pagar"** do WhatsApp.
O fluxo suporta PIX (estático, dinâmico ou desabilitado), boleto, link de pagamento e cartão,
combinando tudo em uma única mensagem interativa.

## Como funciona
- Define o valor em `amount` (BRL por padrão) e opcionalmente personaliza título, texto e nota adicional.
- Por padrão exige `pixKey`.
- O arquivo apontado por `fileUrl` é anexado como documento (boleto ou fatura em PDF, por exemplo).
- `paymentLink` habilita o botão externo.



## Campos comuns
Este endpoint também suporta os campos padrão: `delay`, `readchat`, `readmessages`, `replyid`,
`mentions`, `track_source`, `track_id` e `async`.


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `number` | `string` | ✅ | ID do chat para o qual a mensagem será enviada. Pode ser um número de telefone em formato internacional, um ID de grupo (`@g.us`), um ID de usuário (c |
| `title` | `string` |  | Título que aparece no cabeçalho do fluxo Exemplo: `Detalhes do pedido` |
| `text` | `string` |  | Mensagem exibida no corpo do fluxo Exemplo: `Pedido #123 pronto para pagamento` |
| `footer` | `string` |  | Texto do rodapé da mensagem Exemplo: `Loja Exemplo` |
| `itemName` | `string` |  | Nome do item principal listado no fluxo Exemplo: `Assinatura Plano Ouro` |
| `invoiceNumber` | `string` |  | Identificador ou número da fatura Exemplo: `PED-123` |
| `amount` | `number (float)` | ✅ | Valor da cobrança (em BRL por padrão) Exemplo: `199.9` |
| `pixKey` | `string` |  | Chave PIX estático (CPF/CNPJ/telefone/email/EVP) Exemplo: `123e4567-e89b-12d3-a456-426614174000` |
| `pixType` | `string` |  | Tipo da chave PIX (`CPF`, `CNPJ`, `PHONE`, `EMAIL`, `EVP`). Padrão `EVP` Exemplo: `EVP` |
| `pixName` | `string` |  | Nome do recebedor exibido no fluxo (padrão usa o nome do perfil da instância) Exemplo: `Loja Exemplo` |
| `paymentLink` | `string` |  | URL externa para checkout (somente dominios homologados; veja lista acima) Exemplo: `https://pagamentos.exemplo.com/checkout/abc` |
| `fileUrl` | `string` |  | URL ou caminho (base64) do documento a ser anexado (ex.: boleto PDF) Exemplo: `https://cdn.exemplo.com/boleto-123.pdf` |
| `fileName` | `string` |  | Nome do arquivo exibido no WhatsApp ao anexar `fileUrl` Exemplo: `boleto-123.pdf` |
| `boletoCode` | `string` |  | Linha digitável do boleto (habilita o método boleto automaticamente) Exemplo: `34191.79001 01043.510047 91020.150008 5 91070026000` |
| `replyid` | `string` |  | ID da mensagem que será respondida |
| `mentions` | `string` |  | Números mencionados separados por vírgula |
| `delay` | `integer` |  | Atraso em milissegundos antes do envio (exibe "digitando..." no WhatsApp) |
| `readchat` | `boolean` |  | Marca o chat como lido após enviar a mensagem |
| `readmessages` | `boolean` |  | Marca mensagens recentes como lidas após o envio |
| `async` | `boolean` |  | Enfileira o envio para processamento assíncrono |
| `track_source` | `string` |  | Origem de rastreamento (ex.: chatwoot, crm-interno) |
| `track_id` | `string` |  | Identificador de rastreamento (aceita valores duplicados) |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Solicitação de pagamento enviada com sucesso |
| `400` | Requisição inválida |
| `401` | Não autorizado |
| `500` | Erro interno do servidor |

#### `POST` `/send/pix-button`

**Enviar botão PIX**

Envia um botão nativo do WhatsApp que abre para pagamento PIX com a chave informada.
O usuário visualiza o detalhe do recebedor, nome e chave.

## Regras principais
- `pixType` aceita: `CPF`, `CNPJ`, `PHONE`, `EMAIL`, `EVP` (case insensitive)
- `pixName` padrão: `"Pix"` quando não informado - nome de quem recebe o pagamento


## Campos comuns
Este endpoint herda os campos opcionais padronizados da tag **"Enviar Mensagem"**:
`delay`, `readchat`, `readmessages`, `replyid`, `mentions`, `track_source`, `track_id` e `async`.

## Exemplo de payload
```json
{
  "number": "5511999999999",
  "pixType": "EVP",
  "pixKey": "123e4567-e89b-12d3-a456-426614174000",
  "pixName": "Loja Exemplo"
}
```


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `number` | `string` | ✅ | ID do chat para o qual a mensagem será enviada. Pode ser um número de telefone em formato internacional, um ID de grupo (`@g.us`), um ID de usuário (c |
| `pixType` | `string` | ✅ | Tipo da chave PIX. Valores aceitos: CPF, CNPJ, PHONE, EMAIL ou EVP Exemplo: `EVP` |
| `pixKey` | `string` | ✅ | Valor da chave PIX (CPF/CNPJ/telefone/email/EVP) Exemplo: `123e4567-e89b-12d3-a456-426614174000` |
| `pixName` | `string` |  | Nome exibido como recebedor do PIX (padrão "Pix" se vazio) Exemplo: `Loja Exemplo` |
| `async` | `boolean` |  | Enfileira o envio para processamento assíncrono |
| `delay` | `integer` |  | Atraso em milissegundos antes do envio (exibe "digitando..." no WhatsApp) |
| `readchat` | `boolean` |  | Marca o chat como lido após enviar a mensagem |
| `readmessages` | `boolean` |  | Marca mensagens recentes como lidas após o envio |
| `replyid` | `string` |  | ID da mensagem que será respondida |
| `mentions` | `string` |  | Lista de números mencionados separados por vírgula |
| `track_source` | `string` |  | Origem de rastreamento (ex.: chatwoot, crm-interno) |
| `track_id` | `string` |  | Identificador de rastreamento (aceita valores duplicados) |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Botão PIX enviado com sucesso |
| `400` | Requisição inválida |
| `401` | Não autorizado |
| `500` | Erro interno do servidor |

---

### Mensagem Async

Controles operacionais da fila interna de envio assíncrono usada quando um endpoint de envio recebe `async=true`.

Esta seção serve para:
- consultar o estado atual da fila async
- limpar backlog pendente e cancelar mensagens ainda não concluídas

Escopo:
- cobre apenas a fila interna de mensagens diretas async
- não cobre campanhas do sender (`/sender/*`)
- não altera mensagens já enviadas com sucesso



#### `GET` `/message/async`

**Consultar fila async de envio direto**

Retorna um resumo simples da fila de envio `async=true` da instância atual autenticada.

Este endpoint cobre apenas a fila interna de envio direto assíncrono. Ele **não** representa:
- campanhas do sender (`/sender/*`)
- filas de envio em massa

A resposta padrão foi pensada para clientes:
- `status`: visão resumida da fila (`idle`, `queued`, `processing`, `waiting_connection`, `resetting`)
- `pending`: quantidade total estimada de mensagens pendentes
- `processingNow`: indica se o worker está ocupando um job neste momento
- `acceptingNewMessages`: indica se a fila aceita novos envios async
- `sessionReady`: indica se a sessão WhatsApp está pronta para envio
- `resetting`: indica se a fila está pausada por reset/clear


**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Resumo da fila async |
| `401` | Token inválido ou ausente |
| `500` | Erro interno ao consultar a fila async |

#### `DELETE` `/message/async`

**Limpar fila async de envio direto**

Cancela toda a fila de envio `async=true` da instância e marca as mensagens pendentes como `Canceled`.

Este endpoint atua apenas na fila interna de envio direto assíncrono. Ele **não** afeta:
- campanhas do sender (`/sender/*`)
- mensagens já enviadas com sucesso
- mensagens em massa agendadas

O fluxo executado é:
1. pausa o worker interno da fila async
2. drena jobs pendentes em memória e overflow
3. marca backlog persistido em `Queued` como `Canceled`
4. libera a fila para novos envios async

Use este endpoint quando houver backlog preso, fila acumulada ou quando você quiser abortar todos os envios assíncronos ainda não concluídos.


**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Fila async limpa com sucesso |
| `401` | Token inválido ou ausente |
| `409` | A fila não pôde ser limpa porque a instância está em reset ou havia envio em progresso que não drenou a tempo |
| `500` | Erro interno ao limpar a fila async |

---

### Ações na mensagem e Buscar


#### `POST` `/message/download`

**Baixar arquivo de uma mensagem**

Baixa o arquivo associado a uma mensagem de mídia (imagem, vídeo, áudio, documento ou sticker).

## Parâmetros

- **id** (string, obrigatório): ID da mensagem
- **return_base64** (boolean, default: false): Retorna arquivo em base64
- **generate_mp3** (boolean, default: true): Para áudios, define formato de retorno
  - `true`: Retorna MP3
  - `false`: Retorna OGG
- **return_link** (boolean, default: true): Retorna URL pública do arquivo
- **transcribe** (boolean, default: false): Transcreve áudios para texto
- **openai_apikey** (string, opcional): Chave OpenAI para transcrição
  - Se não informada, usa a chave salva na instância
  - Se informada, atualiza e salva na instância para próximas chamadas
- **download_quoted** (boolean, default: false): Baixa mídia da mensagem citada
  - Útil para baixar conteúdo original de status do WhatsApp
  - Quando uma mensagem é resposta a um status, permite baixar a mídia do status original
  - **Contextualização**: Ao baixar a mídia citada, você identifica o contexto da conversa
    - Exemplo: Se alguém responde a uma promoção, baixando a mídia você saberá que a pergunta é sobre aquela promoção específica

## Exemplos

### Baixar áudio como MP3:
```json
{
  "id": "7EB0F01D7244B421048F0706368376E0",
  "generate_mp3": true
}
```

### Transcrever áudio:
```json
{
  "id": "7EB0F01D7244B421048F0706368376E0",
  "transcribe": true
}
```

### Apenas base64 (sem salvar):
```json
{
  "id": "7EB0F01D7244B421048F0706368376E0",
  "return_base64": true,
  "return_link": false
}
```

### Baixar mídia de status (mensagem citada):
```json
{
  "id": "7EB0F01D7244B421048F0706368376E0",
  "download_quoted": true
}
```
*Útil quando o cliente responde a uma promoção/status - você baixa a mídia original para entender sobre qual produto/oferta ele está perguntando.*

## Resposta

```json
{
  "fileURL": "https://api.exemplo.com/files/arquivo.mp3",
  "mimetype": "audio/mpeg",
  "base64Data": "UklGRkj...",
  "transcription": "Texto transcrito"
}
```

**Nota**: 
- Por padrão, se não definido o contrário:
  1. áudios são retornados como MP3. 
  2. E todos os pedidos de download são retornados com URL pública.
- Transcrição requer chave OpenAI válida. A chave pode ser configurada uma vez na instância e será reutilizada automaticamente.
- Retenção de mídia: mantemos as mídias no nosso storage por 2 dias. Após 2 dias, elas são removidas na limpeza automática e o link retornado deixa de ficar disponível. Para voltar a disponibilizar a mídia, é necessário refazer o download pelo endpoint. Se o cliente solicitar novamente, a mídia será baixada do CDN da Meta, o que pode aumentar o tempo de resposta. Enquanto estiver no nosso storage, a resposta tende a ser mais rápida.


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `id` | `string` | ✅ | ID da mensagem contendo o arquivo Exemplo: `7EB0F01D7244B421048F0706368376E0` |
| `return_base64` | `boolean` |  | Se verdadeiro, retorna o conteúdo em base64 |
| `generate_mp3` | `boolean` |  | Para áudios, define formato de retorno (true=MP3, false=OGG) |
| `return_link` | `boolean` |  | Salva e retorna URL pública do arquivo |
| `transcribe` | `boolean` |  | Se verdadeiro, transcreve áudios para texto |
| `openai_apikey` | `string` |  | Chave da API OpenAI para transcrição (opcional) Exemplo: `sk-...` |
| `download_quoted` | `boolean` |  | Se verdadeiro, baixa mídia da mensagem citada ao invés da mensagem principal |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Successful file download |
| `400` | Bad Request |
| `401` | Unauthorized |
| `404` | Not Found |
| `500` | Internal Server Error |

#### `POST` `/message/find`

**Buscar mensagens em um chat**

Busca mensagens com múltiplos filtros disponíveis. Este endpoint permite:

1. **Busca por ID específico**: Use `id` para encontrar uma mensagem exata
2. **Filtrar por chat**: Use `chatid` para mensagens de uma conversa específica
3. **Filtrar por rastreamento**: Use `track_source` e `track_id` para mensagens com dados de tracking
4. **Limitar resultados**: Use `limit` para controlar quantas mensagens retornar
5. **Ordenação**: Resultados ordenados por data (mais recentes primeiro)


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `id` | `string` |  | ID específico da mensagem para busca exata Exemplo: `user123:r3EB0538` |
| `chatid` | `string` |  | ID do chat no formato internacional Exemplo: `5511999999999@s.whatsapp.net` |
| `track_source` | `string` |  | Origem do rastreamento para filtrar mensagens Exemplo: `chatwoot` |
| `track_id` | `string` |  | ID de rastreamento para filtrar mensagens Exemplo: `msg_123456789` |
| `limit` | `integer` |  | Numero maximo de mensagens a retornar (padrao 100) Exemplo: `20` |
| `offset` | `integer` |  | Deslocamento para paginacao (0 retorna as mensagens mais recentes) |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Lista de mensagens encontradas com metadados de paginacao |
| `400` | Parametros invalidos |
| `401` | Token invalido ou expirado |
| `404` | Chat nao encontrado |
| `500` | Erro interno do servidor |

#### `POST` `/message/history-sync`

**Solicitar histórico sob demanda de um chat**

Solicita ao WhatsApp um sync sob demanda de mensagens antigas de um chat.

Regras:
- envie `number`
- `count` é opcional e limitado a 100
- `messageid` é opcional; quando informado, a API usa essa mensagem como referência para buscar mensagens mais antigas do chat

Observação:
- **Importante:** a recuperação pode só acontecer depois de abrir o WhatsApp no celular ou deixá-lo ativo em segundo plano
- `messageid` define a mensagem de referência para carregar histórico anterior
- esse campo não serve para buscar essa mensagem específica
- o histórico é buscado para trás a partir da mensagem de referência informada
- se você quiser recuperar apenas uma mensagem específica `X`, informe como `messageid` a mensagem logo depois de `X` e use `count=1`
- se `messageid` não for informado, a API usa a mensagem mais antiga conhecida localmente desse chat como referência para buscar histórico anterior
- as mensagens retornam depois via webhook/SSE em eventos do tipo `history` e também ficam disponíveis em `/message/find`


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `messageid` | `string` |  | ID da mensagem de referência usada para buscar mensagens mais antigas do chat Exemplo: `3EB01234567890ABCDEF` |
| `number` | `string` |  | JID completo do chat Exemplo: `5511999999999@s.whatsapp.net` |
| `count` | `integer` |  | Quantidade desejada de mensagens no sync Exemplo: `20` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Solicitação de history sync enviada com sucesso |
| `400` | Payload inválido ou âncora insuficiente |
| `500` | Erro interno ao solicitar o history sync |

#### `POST` `/message/markread`

**Marcar mensagens como lidas**

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
- id: Lista de IDs das mensagens a serem marcadas como lidas

Erros comuns:
- 401: Token inválido ou expirado
- 400: Lista de IDs vazia ou inválida
- 404: Uma ou mais mensagens não encontradas
- 500: Erro ao marcar mensagens como lidas


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `id` | `array` | ✅ | Lista de IDs das mensagens a serem marcadas como lidas Exemplo: `['62AD1AD844E518180227BF68DA7ED710', 'ECB9DE48EB41F77BFA8491BFA8D6EF9B']` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Messages successfully marked as read |
| `400` | Invalid request payload or missing required fields |
| `401` | Unauthorized - invalid or missing token |
| `500` | Server error while processing the request |

#### `POST` `/message/react`

**Enviar reação a uma mensagem**

Envia uma reação (emoji) a uma mensagem específica. Este endpoint permite:

1. Adicionar ou remover reações em mensagens

2. Usar qualquer emoji Unicode válido

3. Reagir a mensagens em chats individuais ou grupos

4. Remover reações existentes

5. Verificar o status da reação enviada


Tipos de reações suportados:

- Qualquer emoji Unicode válido (👍, ❤️, 😂, etc)

- String vazia para remover reação


Exemplo de requisição básica:

```json

{
  "number": "5511999999999@s.whatsapp.net",
  "text": "👍",
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
    "emoji": "👍",
    "timestamp": 1672531200000,
    "status": "sent"
  }
}

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

- number: Número do chat no formato internacional (ex:
5511999999999@s.whatsapp.net)

- text: Emoji Unicode da reação (ou string vazia para remover reação)

- id: ID da mensagem que receberá a reação


Erros comuns:

- 401: Token inválido ou expirado

- 400: Número inválido ou emoji não suportado

- 404: Mensagem não encontrada

- 500: Erro ao enviar reação


Limitações:

- Só é possível reagir a mensagens enviadas por outros usuários

- Não é possível reagir a mensagens antigas (mais de 7 dias)

- O mesmo usuário só pode ter uma reação ativa por mensagem


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `number` | `string` | ✅ | Número do chat no formato internacional Exemplo: `5511999999999@s.whatsapp.net` |
| `text` | `string` | ✅ | Emoji Unicode da reação (ou string vazia para remover reação) Exemplo: `👍` |
| `id` | `string` | ✅ | ID da mensagem que receberá a reação Exemplo: `3EB0538DA65A59F6D8A251` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Reação enviada com sucesso |
| `400` | Erro nos dados da requisição |
| `401` | Não autorizado |
| `404` | Mensagem não encontrada |
| `500` | Erro interno do servidor |

#### `POST` `/message/delete`

**Apagar Mensagem Para Todos**

Apaga uma mensagem para todos os participantes da conversa.

### Funcionalidades:
- Apaga mensagens em conversas individuais ou grupos
- Funciona com mensagens enviadas pelo usuário ou recebidas
- Atualiza o status no banco de dados
- Envia webhook de atualização

**Notas Técnicas**:
1. O ID da mensagem pode ser fornecido em dois formatos:
   - ID completo (contém ":"): usado diretamente
   - ID curto: concatenado com o owner para busca
2. Gera evento webhook do tipo "messages_update"
3. Atualiza o status da mensagem para "Deleted"
4. Para newsletters/canais, use `POST /newsletter/messages/delete`


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `id` | `string` | ✅ | ID da mensagem a ser apagada |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Mensagem apagada com sucesso |
| `400` | Payload inválido ou ID de chat/sender inválido |
| `401` | Token não fornecido |
| `404` | Mensagem não encontrada |
| `500` | Erro interno do servidor ou sessão não iniciada |

#### `POST` `/message/edit`

**Edita uma mensagem enviada**

Edita o conteúdo de uma mensagem já enviada usando a funcionalidade nativa do WhatsApp.

O endpoint realiza:
- Busca a mensagem original no banco de dados usando o ID fornecido
- Edita o conteúdo da mensagem para o novo texto no WhatsApp
- Gera um novo ID para a mensagem editada
- Retorna objeto de mensagem completo seguindo o padrão da API
- Dispara eventos SSE/Webhook automaticamente

**Importante**: 
- Só é possível editar mensagens enviadas pela própria instância
- A mensagem deve existir no banco de dados
- O ID pode ser fornecido no formato completo (owner:messageid) ou apenas messageid
- A mensagem deve estar dentro do prazo permitido pelo WhatsApp para edição
- Para newsletters/canais, use `POST /newsletter/messages/edit`

🔐 **Autenticação:** `token`


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `id` | `string` | ✅ | ID único da mensagem que será editada (formato owner:messageid ou apenas messageid) Exemplo: `3A12345678901234567890123456789012` |
| `text` | `string` | ✅ | Novo conteúdo de texto da mensagem Exemplo: `Texto editado da mensagem` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Mensagem editada com sucesso |
| `400` | Dados inválidos na requisição |
| `401` | Sem sessão ativa |
| `404` | Mensagem não encontrada |
| `500` | Erro interno do servidor |

---

### Chats


#### `POST` `/chat/delete`

**Deleta chat**

Deleta ou limpa um chat e/ou suas mensagens do WhatsApp e/ou banco de dados.
Você pode escolher:
- Deletar o chat do WhatsApp
- Limpar a conversa no WhatsApp
- Deletar o chat do banco de dados
- Deletar apenas as mensagens do banco de dados
- Qualquer combinação das opções acima
Observação:
- Se clearChatWhatsApp e deleteChatWhatsApp forem true, o clear tem prioridade.


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `number` | `string` | ✅ | Número do chat no formato internacional. Para grupos use o ID completo do grupo. Exemplo: `5511999999999` |
| `deleteChatDB` | `boolean` |  | Se true, deleta o chat do banco de dados Exemplo: `True` |
| `deleteMessagesDB` | `boolean` |  | Se true, deleta todas as mensagens do chat do banco de dados Exemplo: `True` |
| `deleteChatWhatsApp` | `boolean` |  | Se true, deleta o chat do WhatsApp. Para grupos, esta operação não é permitida e o chat será apenas limpo. Exemplo: `True` |
| `clearChatWhatsApp` | `boolean` |  | Se true, limpa a conversa do chat no WhatsApp (sem sair do chat). Funciona para grupos e conversas individuais. Exemplo: `True` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Operação realizada com sucesso |
| `400` | Erro nos parâmetros da requisição |
| `401` | Token inválido ou não fornecido |
| `404` | Chat não encontrado |
| `500` | Erro interno do servidor |

#### `POST` `/chat/archive`

**Arquivar/desarquivar chat**

Altera o estado de arquivamento de um chat do WhatsApp.
- Quando arquivado, o chat é movido para a seção de arquivados no WhatsApp
- A ação é sincronizada entre todos os dispositivos conectados
- Não afeta as mensagens ou o conteúdo do chat


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `number` | `string` | ✅ | Número do telefone (formato E.164) ou ID do grupo Exemplo: `5511999999999` |
| `archive` | `boolean` | ✅ | true para arquivar, false para desarquivar Exemplo: `True` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Chat arquivado/desarquivado com sucesso |
| `400` | Dados da requisição inválidos |
| `401` | Token de autenticação ausente ou inválido |
| `500` | Erro ao executar a operação |

#### `POST` `/chat/read`

**Marcar chat como lido/não lido**

Atualiza o status de leitura de um chat no WhatsApp.

Quando um chat é marcado como lido:
- O contador de mensagens não lidas é zerado
- O indicador visual de mensagens não lidas é removido
- O remetente recebe confirmação de leitura (se ativado)

Quando marcado como não lido:
- O chat aparece como pendente de leitura
- Não afeta as confirmações de leitura já enviadas


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `number` | `string` | ✅ | Identificador do chat no formato: - Para usuários: [número]@s.whatsapp.net (ex: 5511999999999@s.whatsapp.net) - Para grupos: [id-grupo]@g.us (ex: 1234 |
| `read` | `boolean` | ✅ | - true: marca o chat como lido - false: marca o chat como não lido |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Status de leitura atualizado com sucesso |
| `401` | Token de autenticação ausente ou inválido |
| `404` | Chat não encontrado |
| `500` | Erro ao atualizar status de leitura |

#### `POST` `/chat/mute`

**Silenciar chat**

Silencia notificações de um chat por um período específico. 
As opções de silenciamento são:
* 0 - Remove o silenciamento
* 8 - Silencia por 8 horas
* 168 - Silencia por 1 semana (168 horas)
* -1 - Silencia permanentemente


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `number` | `string` | ✅ | ID do chat no formato 123456789@s.whatsapp.net ou 123456789-123456@g.us Exemplo: `5511999999999@s.whatsapp.net` |
| `muteEndTime` | `integer` | ✅ | Duração do silenciamento: * 0 = Remove silenciamento * 8 = Silencia por 8 horas * 168 = Silencia por 1 semana * -1 = Silencia permanentemente Valores: |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Chat silenciado com sucesso |
| `400` | Duração inválida ou formato de número incorreto |
| `401` | Token inválido ou ausente |
| `404` | Chat não encontrado |

#### `POST` `/chat/pin`

**Fixar/desafixar chat**

Fixa ou desafixa um chat no topo da lista de conversas. Chats fixados permanecem 
no topo mesmo quando novas mensagens são recebidas em outros chats.


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `number` | `string` | ✅ | Número do chat no formato internacional completo (ex: "5511999999999")  ou ID do grupo (ex: "123456789-123456@g.us") Exemplo: `5511999999999` |
| `pin` | `boolean` | ✅ | Define se o chat deve ser fixado (true) ou desafixado (false) Exemplo: `True` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Chat fixado/desafixado com sucesso |
| `400` | Erro na requisição |
| `401` | Não autorizado |

#### `POST` `/chat/find`

**Busca chats com filtros**

Busca chats com diversos filtros e ordenação. Suporta filtros em todos os campos do chat, 
paginação e ordenação customizada.

Operadores de filtro:
- `~` : LIKE (contém)
- `!~` : NOT LIKE (não contém)
- `!=` : diferente
- `>=` : maior ou igual
- `>` : maior que
- `<=` : menor ou igual
- `<` : menor que
- Sem operador: LIKE (contém)


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `operator` | `string` |  | Operador lógico entre os filtros Valores: `AND`, `OR` |
| `sort` | `string` |  | Campo para ordenação (+/-campo). Ex -wa_lastMsgTimestamp |
| `limit` | `integer` |  | Quantidade máxima de resultados a retornar |
| `offset` | `integer` |  | Número de registros a pular (para paginação) |
| `wa_fastid` | `string` |  |  |
| `wa_chatid` | `string` |  |  |
| `wa_archived` | `boolean` |  |  |
| `wa_contactName` | `string` |  |  |
| `wa_name` | `string` |  |  |
| `name` | `string` |  |  |
| `wa_isBlocked` | `boolean` |  |  |
| `wa_isGroup` | `boolean` |  |  |
| `wa_isGroup_admin` | `boolean` |  |  |
| `wa_isGroup_announce` | `boolean` |  |  |
| `wa_isGroup_member` | `boolean` |  |  |
| `wa_isPinned` | `boolean` |  |  |
| `wa_label` | `string` |  | ID da label aplicada ao chat. Use o valor retornado por `/labels`, não o nome da etiqueta. |
| `wa_notes` | `string` |  |  |
| `lead_tags` | `string` |  |  |
| `lead_isTicketOpen` | `boolean` |  |  |
| `lead_assignedAttendant_id` | `string` |  |  |
| `lead_status` | `string` |  |  |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Lista de chats encontrados |

#### `POST` `/chat/notes`

**Consultar notas internas do chat**

Retorna `wa_notes` de um chat usando apenas os dados já persistidos localmente.

Casos de uso:
- ler a anotação local já persistida no chat
- consultar notas mesmo durante reconexão da sessão do WhatsApp

Regras:
- envie `number`
- para recarregar do WhatsApp, use `/chat/notes/refresh`


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `number` | `string` |  | JID completo do chat Exemplo: `5511999999999@s.whatsapp.net` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Nota do chat retornada com sucesso |
| `400` | Payload inválido |
| `404` | Chat não encontrado |
| `500` | Erro interno ao consultar a nota local |

#### `POST` `/chat/notes/refresh`

**Recarregar notas internas do chat no WhatsApp**

Faz uma nova leitura das notas internas do chat no WhatsApp antes de retornar o valor atualizado.

Uso recomendado:
- tente primeiro com `force=false`
- se isso não atualizar a nota corretamente, tente `force=true`
- use `force=true` apenas como tentativa de correção, porque ele faz uma recarga mais pesada


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `number` | `string` |  | JID completo do chat Exemplo: `5511999999999@s.whatsapp.net` |
| `force` | `boolean` |  | Tente primeiro com `false`. Use `true` apenas quando a recarga padrão não funcionar bem, pois esse modo faz uma nova leitura mais completa das notas.  |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Nota do chat recarregada com sucesso |
| `400` | Payload inválido |
| `404` | Chat não encontrado após o reload |
| `409` | O reload não pode ser executado porque o history sync inicial ainda está em andamento |
| `500` | Erro interno ao recarregar a nota |

#### `POST` `/chat/notes/edit`

**Editar notas internas do chat**

Atualiza `wa_notes` de um chat via app state do WhatsApp e persiste o resultado localmente.

Regras:
- envie `number`
- envie `notes` como campo principal
- envie string vazia para limpar a nota do chat


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `number` | `string` |  | JID completo do chat Exemplo: `5511999999999@s.whatsapp.net` |
| `notes` | `string` |  | Conteúdo da nota a persistir no chat Exemplo: `Cliente prefere contato no período da tarde` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Nota atualizada com sucesso |
| `400` | Payload inválido |
| `404` | Chat não encontrado |
| `409` | A edição não pode ser executada porque o history sync inicial ainda está em andamento |
| `500` | Erro interno ao atualizar a nota |

---

### Contatos


#### `GET` `/contacts`

**Retorna lista de contatos do WhatsApp**

Retorna a lista de contatos salvos na agenda do celular e que estão no WhatsApp.

O endpoint realiza:
- Busca todos os contatos armazenados
- Retorna dados formatados incluindo JID e informações de nome

🔐 **Autenticação:** `token`


**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Lista de contatos retornada com sucesso |
| `401` | Sem sessão ativa |
| `500` | Erro interno do servidor |

#### `POST` `/contacts/list`

**Listar todos os contatos com paginacao**

Retorna uma lista paginada de contatos da instancia do WhatsApp. 
Use este endpoint (POST) para controlar `limit` e `offset` via corpo da requisicao.
A rota GET `/contacts` continua disponivel para quem prefere a lista completa sem paginacao.

🔐 **Autenticação:** `token`


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `limit` | `integer` |  | Quantidade maxima de resultados por pagina (padrao 100, maximo 1000) |
| `offset` | `integer` |  | Deslocamento base zero para paginacao |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Lista de contatos recuperada com sucesso |
| `401` | Token nao fornecido ou invalido |
| `500` | Erro interno do servidor ao recuperar contatos |

#### `POST` `/contact/add`

**Adiciona um contato à agenda**

Adiciona um novo contato à agenda do celular.

O endpoint realiza:
- Adiciona o contato à agenda usando o WhatsApp
- Usa o campo 'name' tanto para o nome completo quanto para o primeiro nome
- Salva as informações do contato na agenda do WhatsApp
- Retorna informações do contato adicionado

🔐 **Autenticação:** `token`


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `number` | `string` | ✅ | Número de telefone no formato internacional com código do país obrigatório.  Para Brasil, deve começar com 55. Aceita variações com/sem símbolo +,  co |
| `name` | `string` | ✅ | Nome completo do contato (será usado como primeiro nome e nome completo) Exemplo: `João Silva` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Contato adicionado com sucesso |
| `400` | Dados inválidos na requisição |
| `401` | Sem sessão ativa |
| `500` | Erro interno do servidor |

#### `POST` `/contact/remove`

**Remove um contato da agenda**

Remove um contato da agenda do celular.

O endpoint realiza:
- Remove o contato da agenda usando o WhatsApp AppState
- Atualiza a lista de contatos sincronizada
- Retorna confirmação da remoção

🔐 **Autenticação:** `token`


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `number` | `string` | ✅ | Número de telefone no formato internacional com código do país obrigatório.  Para Brasil, deve começar com 55. Aceita variações com/sem símbolo +,  co |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Contato removido com sucesso |
| `400` | Dados inválidos na requisição |
| `401` | Sem sessão ativa |
| `404` | Contato não encontrado |
| `500` | Erro interno do servidor |

#### `POST` `/chat/details`

**Obter Detalhes Completos**

Retorna informações **completas** sobre um contato ou chat, incluindo **todos os campos disponíveis** do modelo Chat.

### Funcionalidades:
- **Retorna chat completo**: Todos os campos do modelo Chat (mais de 60 campos)
- **Busca informações para contatos individuais e grupos**
- **URLs de imagem em dois tamanhos**: preview (menor) ou full (original)
- **Combina informações de diferentes fontes**: WhatsApp, contatos salvos, leads
- **Atualiza automaticamente dados desatualizados** no banco

### Campos Retornados:
- **Informações básicas**: id, wa_fastid, wa_chatid, owner, name, phone
- **Dados do WhatsApp**: wa_name, wa_contactName, wa_archived, wa_isBlocked, etc.
- **Dados de lead/CRM**: lead_name, lead_email, lead_status, lead_field01-20, etc.
- **Informações de grupo**: wa_isGroup, wa_isGroup_admin, wa_isGroup_announce, etc.
- **Chatbot**: chatbot_summary, chatbot_lastTrigger_id, chatbot_disableUntil, etc.
- **Configurações**: wa_muteEndTime, wa_isPinned, wa_unreadCount, etc.

**Comportamento**:
- Para contatos individuais:
  - Busca nome verificado do WhatsApp
  - Verifica nome salvo nos contatos
  - Formata número internacional
  - Calcula grupos em comum
- Para grupos:
  - Busca nome do grupo
  - Verifica status de comunidade


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `number` | `string` | ✅ | Número do telefone ou ID do grupo Exemplo: `5511999999999` |
| `preview` | `boolean` |  | Controla o tamanho da imagem de perfil retornada: - `true`: Retorna imagem em tamanho preview (menor, otimizada para listagens) - `false` (padrão): Re |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Informações completas do chat retornadas com sucesso |
| `400` | Payload inválido ou número inválido |
| `401` | Token não fornecido |
| `500` | Erro interno do servidor ou sessão não iniciada |

#### `POST` `/chat/check`

**Verificar Números no WhatsApp**

Verifica se números fornecidos estão registrados no WhatsApp e retorna informações detalhadas.

### Funcionalidades:
- Verifica múltiplos números simultaneamente
- Suporta números individuais e IDs de grupo
- Retorna nome verificado quando disponível
- Identifica grupos e comunidades
- Verifica subgrupos de comunidades

**Comportamento específico**:
- Para números individuais:
  - Verifica registro no WhatsApp
  - Retorna nome verificado se disponível
  - Normaliza formato do número
- Para grupos:
  - Verifica existência
  - Retorna nome do grupo
  - Retorna id do grupo de anúncios se buscado por id de comunidade


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `numbers` | `array` |  | Lista de números ou IDs de grupo para verificar Exemplo: `['5511999999999', '123456789@g.us']` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Resultado da verificação |
| `400` | Payload inválido ou sem números |
| `401` | Sem sessão ativa |
| `500` | Erro interno do servidor |

---

### Bloqueios


#### `POST` `/chat/block`

**Bloqueia ou desbloqueia contato do WhatsApp**

Bloqueia ou desbloqueia um contato do WhatsApp. Contatos bloqueados não podem enviar mensagens 
para a instância e a instância não pode enviar mensagens para eles.


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `number` | `string` | ✅ | Número do WhatsApp no formato internacional (ex. 5511999999999) Exemplo: `5511999999999` |
| `block` | `boolean` | ✅ | True para bloquear, False para desbloquear Exemplo: `True` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Operação realizada com sucesso |
| `401` | Não autorizado - token inválido |
| `404` | Contato não encontrado |
| `500` | Erro do servidor ao processar a requisição |

#### `GET` `/chat/blocklist`

**Lista contatos bloqueados**

Retorna a lista completa de contatos que foram bloqueados pela instância.
Esta lista é atualizada em tempo real conforme contatos são bloqueados/desbloqueados.


**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Lista de contatos bloqueados recuperada com sucesso |
| `401` | Token inválido ou não fornecido |
| `500` | Erro interno do servidor ou instância não conectada |

---

### Etiquetas


#### `POST` `/chat/labels`

**Gerencia labels de um chat**

Atualiza as labels associadas a um chat específico. Este endpoint oferece três modos de operação:

1. **Definir todas as labels** (labelids): Define o conjunto completo de labels para o chat, substituindo labels existentes
2. **Adicionar uma label** (add_labelid): Adiciona uma única label ao chat sem afetar as existentes
3. **Remover uma label** (remove_labelid): Remove uma única label do chat sem afetar as outras

**Importante**: Use apenas um dos três parâmetros por requisição. Labels inexistentes serão rejeitadas.

As labels devem ser fornecidas no formato id ou labelid encontradas na função get labels.


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `number` | `string` | ✅ | Número do chat ou grupo Exemplo: `5511999999999` |
| `labelids` | `array` |  | Lista de IDs das labels a serem aplicadas ao chat (define todas as labels) Exemplo: `['10', '20']` |
| `add_labelid` | `string` |  | ID da label a ser adicionada ao chat Exemplo: `10` |
| `remove_labelid` | `string` |  | ID da label a ser removida do chat Exemplo: `20` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Labels atualizadas com sucesso |
| `400` | Erro na requisição |
| `404` | Chat não encontrado |

#### `POST` `/label/edit`

**Criar, editar ou deletar etiqueta**

Cria, edita ou deleta uma etiqueta da instância.

Regras de uso:
- Para editar uma etiqueta existente, envie o `labelid` real da etiqueta.
- Para criar uma nova etiqueta, envie `labelid: "new"` com `delete: false`.
  O backend irá gerar o próximo `labelid` numérico disponível para a instância.
- Para deletar uma etiqueta existente, envie o `labelid` real com `delete: true`.

Observações:
- A resposta de sucesso retorna `"Label created"` para criação e `"Label edited"` para edição.
- Para descobrir o `labelid` final criado, consulte `GET /labels` após a operação
  ou consuma o webhook/evento de labels da instância.


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `labelid` | `string` | ✅ | ID da etiqueta.  Use o ID real para editar/deletar uma etiqueta existente. Use `"new"` para criar uma nova etiqueta quando `delete` for `false`. Exemp |
| `name` | `string` |  | Novo nome da etiqueta Exemplo: `responder editado` |
| `color` | `integer` |  | Código numérico da nova cor (0-19) Exemplo: `2` |
| `delete` | `boolean` |  | Indica se a etiqueta deve ser deletada Exemplo: `False` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Operação concluída com sucesso |
| `400` | Payload inválido |
| `500` | Erro interno do servidor ou sessão inválida |

#### `GET` `/labels`

**Buscar todas as etiquetas**

Retorna a lista completa de etiquetas da instância.


**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Lista de etiquetas retornada com sucesso |
| `500` | Erro interno do servidor |

#### `POST` `/labels/refresh`

**Recarregar etiquetas do WhatsApp**

Faz uma nova leitura das etiquetas no WhatsApp antes de retornar a lista atualizada.

Uso recomendado:
- tente primeiro com `force=false`
- se isso não trouxer as etiquetas corretamente, tente `force=true`
- use `force=true` apenas como tentativa de correção, porque ele faz uma recarga mais pesada


**Request Body** (`application/json`):

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `force` | `boolean` |  | Tente primeiro com `false`. Use `true` apenas quando a recarga padrão não funcionar bem, pois esse modo faz uma nova leitura mais completa das etiquet |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Lista de etiquetas recarregada com sucesso |
| `409` | O reload não pôde ser executado porque o history sync ainda está em andamento |
| `500` | Erro interno do servidor |

---

### Grupos e Comunidades


#### `POST` `/group/create`

**Criar um novo grupo**

Cria um novo grupo no WhatsApp com participantes iniciais.

### Detalhes
- Requer autenticação via token da instância
- Os números devem ser fornecidos sem formatação (apenas dígitos)

### Limitações
- Mínimo de 1 participante além do criador
  
### Comportamento
- Retorna informações detalhadas do grupo criado
- Inclui lista de participantes adicionados com sucesso/falha

🔐 **Autenticação:** `token`


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `name` | `string` | ✅ | Nome do grupo Exemplo: `uazapiGO grupo` |
| `participants` | `array` | ✅ | Lista de números de telefone dos participantes iniciais Exemplo: `['5521987905995', '5511912345678']` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Grupo criado com sucesso |
| `400` | Erro de payload inválido |
| `500` | Erro interno do servidor |

#### `POST` `/group/info`

**Obter informações detalhadas de um grupo**

Recupera informações completas de um grupo do WhatsApp, incluindo:
- Detalhes do grupo
- Participantes
- Configurações
- Link de convite (opcional)


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `groupjid` | `string` | ✅ | Identificador único do grupo (JID) Exemplo: `120363153742561022@g.us` |
| `getInviteLink` | `boolean` |  | Recuperar link de convite do grupo Exemplo: `True` |
| `getRequestsParticipants` | `boolean` |  | Recuperar lista de solicitações pendentes de participação Exemplo: `False` |
| `force` | `boolean` |  | Forçar atualização, ignorando cache Exemplo: `False` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Informações do grupo obtidas com sucesso |
| `400` | Código de convite inválido ou mal formatado |
| `404` | Grupo não encontrado ou link de convite expirado |
| `500` | Erro interno do servidor |

#### `POST` `/group/inviteInfo`

**Obter informações de um grupo pelo código de convite**

Retorna informações detalhadas de um grupo usando um código de convite ou URL completo do WhatsApp.

Esta rota permite:
- Recuperar informações básicas sobre um grupo antes de entrar
- Validar um link de convite
- Obter detalhes como nome do grupo, número de participantes e restrições de entrada


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `invitecode` | `string` | ✅ | Código de convite ou URL completo do grupo. Pode ser um código curto ou a URL completa do WhatsApp. |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Informações do grupo obtidas com sucesso |
| `400` | Código de convite inválido ou mal formatado |
| `404` | Grupo não encontrado ou link de convite expirado |
| `500` | Erro interno do servidor |

#### `POST` `/group/join`

**Entrar em um grupo usando código de convite**

Permite entrar em um grupo do WhatsApp usando um código de convite ou URL completo. 

Características:
- Suporta código de convite ou URL completo
- Valida o código antes de tentar entrar no grupo
- Retorna informações básicas do grupo após entrada bem-sucedida
- Trata possíveis erros como convite inválido ou expirado


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `invitecode` | `string` | ✅ | Código de convite ou URL completo do grupo.  Formatos aceitos: - Código completo: "IYnl5Zg9bUcJD32rJrDzO7" - URL completa: "https://chat.whatsapp.com/ |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Entrada no grupo realizada com sucesso |
| `400` | Código de convite inválido |
| `403` | Usuário já está no grupo ou não tem permissão para entrar |
| `500` | Erro interno do servidor |

#### `POST` `/group/leave`

**Sair de um grupo**

Remove o usuário atual de um grupo específico do WhatsApp.

Requisitos:
- O usuário deve estar conectado a uma instância válida
- O usuário deve ser um membro do grupo

Comportamentos:
- Se o usuário for o último administrador, o grupo será dissolvido
- Se o usuário for um membro comum, será removido do grupo


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `groupjid` | `string` | ✅ | Identificador único do grupo (JID) - Formato: número@g.us - Exemplo válido: 120363324255083289@g.us Exemplo: `120363324255083289@g.us` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Saída do grupo realizada com sucesso |
| `400` | Erro de payload inválido |
| `500` | Erro interno do servidor ou falha na conexão |

#### `GET` `/group/list`

**Listar todos os grupos**

Retorna uma lista com todos os grupos disponíveis para a instância atual do WhatsApp.

Recursos adicionais:
- Suporta atualização forçada do cache de grupos
- Recupera informações detalhadas de grupos conectados


**Parâmetros**:

| Nome | In | Tipo | Obrigatório | Descrição |
|---|---|---|:---:|---|
| `force` | `query` | `boolean` |  | Se definido como `true`, força a atualização do cache de grupos. Útil para garantir que as informações mais recentes sej |
| `noparticipants` | `query` | `boolean` |  | Se definido como `true`, retorna a lista de grupos sem incluir os participantes. Útil para otimizar a resposta quando nã |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Lista de grupos recuperada com sucesso |
| `500` | Erro interno do servidor ao recuperar grupos |

#### `POST` `/group/list`

**Listar todos os grupos com filtros e paginacao**

Retorna uma lista com todos os grupos disponiveis para a instancia atual do WhatsApp, com opcoes de filtros e paginacao via corpo (POST).
A rota GET continua para quem prefere a listagem direta sem paginacao.


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `limit` | `integer` |  | Quantidade maxima de resultados por pagina (padrao 50, maximo 1000) |
| `offset` | `integer` |  | Deslocamento base zero |
| `search` | `string` |  | Texto para filtrar grupos por nome/JID |
| `force` | `boolean` |  | Se definido como `true`, forca a atualizacao do cache de grupos. Util para garantir que as informacoes mais recentes sejam recuperadas. |
| `noParticipants` | `boolean` |  | Se definido como `true`, retorna a lista de grupos sem incluir os participantes. Util para otimizar a resposta quando nao ha necessidade dos dados dos |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Lista de grupos recuperada com sucesso |
| `500` | Erro interno do servidor ao recuperar grupos |

#### `POST` `/group/resetInviteCode`

**Resetar código de convite do grupo**

Gera um novo código de convite para o grupo, invalidando o código de convite anterior. 
Somente administradores do grupo podem realizar esta ação.

Principais características:
- Invalida o link de convite antigo
- Cria um novo link único
- Retorna as informações atualizadas do grupo


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `groupjid` | `string` | ✅ | Identificador único do grupo (JID) Exemplo: `120363308883996631@g.us` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Código de convite resetado com sucesso |
| `400` | Erro de validação |
| `403` | Usuário sem permissão |
| `500` | Erro interno do servidor |

#### `POST` `/group/updateAnnounce`

**Configurar permissões de envio de mensagens no grupo**

Define as permissões de envio de mensagens no grupo, permitindo restringir o envio apenas para administradores.

Quando ativado (announce=true):
- Apenas administradores podem enviar mensagens
- Outros participantes podem apenas ler
- Útil para anúncios importantes ou controle de spam

Quando desativado (announce=false):
- Todos os participantes podem enviar mensagens
- Configuração padrão para grupos normais

Requer que o usuário seja administrador do grupo para fazer alterações.


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `groupjid` | `string` | ✅ | Identificador único do grupo no formato xxxx@g.us Exemplo: `120363339858396166@g.us` |
| `announce` | `boolean` | ✅ | Controla quem pode enviar mensagens no grupo Exemplo: `True` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Configuração atualizada com sucesso |
| `401` | Token de autenticação ausente ou inválido |
| `403` | Usuário não é administrador do grupo |
| `404` | Grupo não encontrado |
| `500` | Erro interno do servidor ou falha na API do WhatsApp |

#### `POST` `/group/updateDescription`

**Atualizar descrição do grupo**

Altera a descrição (tópico) do grupo WhatsApp especificado.
Requer que o usuário seja administrador do grupo.
A descrição aparece na tela de informações do grupo e pode ser visualizada por todos os participantes.


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `groupjid` | `string` | ✅ | JID (ID) do grupo no formato xxxxx@g.us Exemplo: `120363339858396166@g.us` |
| `description` | `string` | ✅ | Nova descrição/tópico do grupo Exemplo: `Grupo oficial de suporte` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Descrição atualizada com sucesso |
| `401` | Token inválido ou ausente |
| `403` | Usuário não é administrador do grupo |
| `404` | Grupo não encontrado |
| `413` | Descrição excede o limite máximo permitido |

#### `POST` `/group/updateImage`

**Atualizar imagem do grupo**

Altera a imagem do grupo especificado. A imagem pode ser enviada como URL ou como string base64.

Requisitos da imagem:
- Formato: JPEG
- Resolução máxima: 640x640 pixels
- Imagens maiores ou diferente de JPEG não são aceitas pelo WhatsApp

Para remover a imagem atual, envie "remove" ou "delete" no campo image.


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `groupjid` | `string` | ✅ | JID do grupo Exemplo: `120363308883996631@g.us` |
| `image` | `string` | ✅ | URL da imagem, string base64 ou "remove"/"delete" para remover. A imagem deve estar em formato JPEG e ter resolução máxima de 640x640. |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Imagem atualizada com sucesso |
| `400` | Erro nos parâmetros da requisição |
| `401` | Token inválido ou expirado |
| `403` | Usuário não é administrador do grupo |
| `413` | Imagem muito grande |
| `415` | Formato de imagem inválido |

#### `POST` `/group/updateLocked`

**Configurar permissão de edição do grupo**

Define se apenas administradores podem editar as informações do grupo. 
Quando bloqueado (locked=true), apenas administradores podem alterar nome, descrição, 
imagem e outras configurações do grupo. Quando desbloqueado (locked=false), 
qualquer participante pode editar as informações.

Importante:
- Requer que o usuário seja administrador do grupo
- Afeta edições de nome, descrição, imagem e outras informações do grupo
- Não controla permissões de adição de membros


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `groupjid` | `string` | ✅ | Identificador único do grupo (JID) Exemplo: `120363308883996631@g.us` |
| `locked` | `boolean` | ✅ | Define permissões de edição: - true = apenas admins podem editar infos do grupo - false = qualquer participante pode editar infos do grupo Exemplo: `T |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Operação realizada com sucesso |
| `403` | Usuário não é administrador do grupo |
| `404` | Grupo não encontrado |

#### `POST` `/group/updateName`

**Atualizar nome do grupo**

Altera o nome de um grupo do WhatsApp. Apenas administradores do grupo podem realizar esta operação.
O nome do grupo deve seguir as diretrizes do WhatsApp e ter entre 1 e 25 caracteres.

🔐 **Autenticação:** `token`


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `groupjid` | `string` | ✅ | Identificador único do grupo no formato JID Exemplo: `120363339858396166@g.us` |
| `name` | `string` | ✅ | Novo nome para o grupo Exemplo: `Grupo de Suporte` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Nome do grupo atualizado com sucesso |
| `400` | Erro de validação na requisição |
| `401` | Token de autenticação ausente ou inválido |
| `403` | Usuário não é administrador do grupo |
| `404` | Grupo não encontrado |
| `500` | Erro interno do servidor |

#### `POST` `/group/updateParticipants`

**Gerenciar participantes do grupo**

Gerencia participantes do grupo através de diferentes ações:
- Adicionar ou remover participantes
- Promover ou rebaixar administradores
- Aprovar ou rejeitar solicitações pendentes

Requer que o usuário seja administrador do grupo para executar as ações.


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `groupjid` | `string` | ✅ | JID (identificador) do grupo Exemplo: `120363308883996631@g.us` |
| `action` | `string` | ✅ | Ação a ser executada: - add: Adicionar participantes ao grupo - remove: Remover participantes do grupo - promote: Promover participantes a administrad |
| `participants` | `array` | ✅ | Lista de números de telefone ou JIDs dos participantes. Para números de telefone, use formato internacional sem '+' ou espaços. Exemplo: `['5521987654 |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Sucesso na operação |
| `400` | Erro nos parâmetros da requisição |
| `403` | Usuário não é administrador do grupo |
| `500` | Erro interno do servidor |

#### `POST` `/community/create`

**Criar uma comunidade**

Cria uma nova comunidade no WhatsApp. Uma comunidade é uma estrutura que permite agrupar múltiplos grupos relacionados sob uma única administração. 

A comunidade criada inicialmente terá apenas o grupo principal (announcements), e grupos adicionais podem ser vinculados posteriormente usando o endpoint `/community/updategroups`.

**Observações importantes:**
- O número que cria a comunidade torna-se automaticamente o administrador
- A comunidade terá um grupo principal de anúncios criado automaticamente


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `name` | `string` | ✅ | Nome da comunidade Exemplo: `Comunidade do Bairro` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Comunidade criada com sucesso |
| `400` | Erro na requisição |
| `401` | Token inválido ou não fornecido |
| `403` | Sem permissão para criar comunidades |
| `429` | Limite de criação de comunidades atingido |
| `500` | Erro interno do servidor |

#### `POST` `/community/editgroups`

**Gerenciar grupos em uma comunidade**

Adiciona ou remove grupos de uma comunidade do WhatsApp. Apenas administradores da comunidade podem executar estas operações.

## Funcionalidades
- Adicionar múltiplos grupos simultaneamente a uma comunidade
- Remover grupos de uma comunidade existente
- Suporta operações em lote

## Limitações
- Os grupos devem existir previamente
- A comunidade deve existir e o usuário deve ser administrador
- Grupos já vinculados não podem ser adicionados novamente
- Grupos não vinculados não podem ser removidos

## Ações Disponíveis
- `add`: Adiciona os grupos especificados à comunidade
- `remove`: Remove os grupos especificados da comunidade


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `community` | `string` | ✅ | JID (identificador único) da comunidade Exemplo: `120363153742561022@g.us` |
| `action` | `string` | ✅ | Tipo de operação a ser realizada: * add - Adiciona grupos à comunidade * remove - Remove grupos da comunidade Valores: `add`, `remove` |
| `groupjids` | `array` | ✅ | Lista de JIDs dos grupos para adicionar ou remover Exemplo: `['120363324255083289@g.us', '120363308883996631@g.us']` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Operação realizada com sucesso |
| `400` | Requisição inválida |
| `401` | Não autorizado |
| `403` | Usuário não é administrador da comunidade |

---

### Newsletters e Canais

Operações para leitura e acompanhamento de canais do WhatsApp (newsletters).

Casos de uso principais:
- listar posts já publicados em um canal
- editar posts recentes de um canal
- deletar posts recentes de um canal
- consultar updates de engajamento dos posts
- integrar canais sem necessidade de persistir as mensagens localmente

Observações:
- `/newsletter/messages` retorna o conteúdo dos posts
- `/newsletter/messages/edit` edita o conteúdo de posts recentes
- `/newsletter/messages/delete` apaga posts recentes
- `/newsletter/updates` retorna updates dos posts, como views e reactions
- views e reactions de canal devem ser consultados por `/newsletter/updates`, não por evento de webhook
- newsletters usam rotas próprias e não devem usar `/message/edit` ou `/message/delete`



#### `POST` `/newsletter/create`

**Criar canal**

Cria um novo canal/newsletter no WhatsApp.

Observações:
- `name` é obrigatório
- `picture` é opcional
- `picture` aceita URL HTTP/HTTPS, base64 puro ou data URI
- imagens acima de 1 MB são rejeitadas


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `name` | `string` | ✅ |  Exemplo: `Canal de Promoções` |
| `description` | `string` |  |  Exemplo: `Ofertas e novidades da loja` |
| `picture` | `string` |  | URL, base64 puro ou data URI da imagem do canal. Exemplo: `https://example.com/newsletter.png` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Canal criado com sucesso |
| `400` | Payload inválido |
| `401` | Instância não autenticada ou cliente não encontrado |
| `500` | Erro interno ao criar o canal |

#### `GET` `/newsletter/list`

**Listar canais inscritos**

Retorna os canais/newsletters já inscritos na instância atual.


**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Lista de canais recuperada com sucesso |
| `401` | Instância não autenticada ou cliente não encontrado |
| `500` | Erro interno ao listar canais |

#### `POST` `/newsletter/info`

**Buscar informações de um canal**

Busca os detalhes de um canal/newsletter pelo `id` numérico ou pelo `jid`.


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `id` | `string` |  | ID numérico do canal. Se informado sem domínio, será convertido para `@newsletter`. Exemplo: `120363123456789012` |
| `jid` | `string` |  | JID completo do canal. Exemplo: `120363123456789012@newsletter` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Informações do canal recuperadas com sucesso |
| `400` | ID/JID inválido |
| `401` | Instância não autenticada ou cliente não encontrado |
| `500` | Erro interno ao consultar o canal |

#### `POST` `/newsletter/link`

**Buscar canal por link-chave de convite**

Busca as informações de um canal a partir da chave de convite.


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `key` | `string` | ✅ | Chave do convite do canal. Exemplo: `AbCdEfGhIjKlMn` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Informações do canal recuperadas com sucesso |
| `400` | Payload inválido |
| `401` | Instância não autenticada ou cliente não encontrado |
| `500` | Erro interno ao consultar o convite |

#### `POST` `/newsletter/subscribe`

**Assinar live updates temporários de um canal**

Assina temporariamente os live updates internos do WhatsApp para um canal.

Observação:
- esta rota retorna apenas a duração da assinatura temporária
- isso não cria um novo evento de webhook


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `id` | `string` |  |  Exemplo: `120363123456789012` |
| `jid` | `string` |  |  Exemplo: `120363123456789012@newsletter` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Assinatura criada com sucesso |
| `400` | ID/JID inválido |
| `401` | Instância não autenticada ou cliente não encontrado |
| `500` | Erro interno ao assinar updates |

#### `POST` `/newsletter/messages`

**Buscar mensagens de um canal**

Busca diretamente no WhatsApp os posts/mensagens de um canal (newsletter).

Esta rota não depende de mensagens salvas localmente e é útil para:
- carregar o histórico recente de posts de um canal
- paginar mensagens anteriores usando `beforeid`
- consumir conteúdo de newsletters sem persistência em banco

Identificação do canal:
- envie `id` com o identificador numérico do canal; o backend converte para `@newsletter`
- ou envie `jid` completo no formato `1234567890@newsletter`

Observações:
- `count` controla quantos posts retornar
- use preferencialmente `beforeid`
- `beforeid` pagina para trás a partir de um `serverid`
- o retorno vem no campo `response`


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `id` | `string` |  | ID numérico do canal. Se informado sem domínio, será convertido para `@newsletter`. Exemplo: `120363123456789012` |
| `jid` | `string` |  | JID completo do canal. Exemplo: `120363123456789012@newsletter` |
| `count` | `integer` |  | Quantidade de mensagens/posts a buscar. Exemplo: `20` |
| `beforeid` | `integer` |  | Retorna mensagens anteriores ao `serverid` informado. Use para paginação retroativa. Exemplo: `12345` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Mensagens do canal recuperadas com sucesso |
| `400` | Payload inválido ou ID/JID do canal inválido |
| `401` | Instância não autenticada ou cliente não encontrado |
| `500` | Erro interno ao consultar mensagens do canal no WhatsApp |

#### `POST` `/newsletter/messages/edit`

**Editar mensagem recente de um canal**

Edita o conteúdo de um post recente de newsletter diretamente no WhatsApp.

Esta rota:
- nao depende de mensagens salvas localmente
- busca a mensagem recente do canal via WhatsApp/whatsmeow
- localiza o post por `messageid` ou `serverid`
- edita apenas tipos suportados (`text`, `image`, `video`, `document`)

Observações:
- use `jid` ou `id` para identificar o canal
- envie ao menos um entre `messageid` e `serverid`
- envie `text` com o novo conteúdo/legenda
- `count` e `maxpages` controlam a janela de busca no canal


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `id` | `string` |  | ID numérico do canal. Se informado sem domínio, será convertido para `@newsletter`. Exemplo: `120363123456789012` |
| `jid` | `string` |  | JID completo do canal. Exemplo: `120363123456789012@newsletter` |
| `messageid` | `string` |  | ID lógico da mensagem no canal. Exemplo: `3EB0B4302B3A8A52F7A1` |
| `serverid` | `integer` |  | Identificador sequencial do post no canal. Exemplo: `12345` |
| `text` | `string` | ✅ | Novo texto ou nova legenda do post. Exemplo: `Post atualizado` |
| `count` | `integer` |  | Quantidade de mensagens buscadas por página ao localizar o post. Exemplo: `100` |
| `maxpages` | `integer` |  | Quantidade máxima de páginas buscadas ao localizar o post. Exemplo: `5` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Mensagem do canal editada com sucesso |
| `400` | Payload inválido, mensagem não editável, mensagem alvo não identificada ou canal inválido |
| `401` | Instância não autenticada ou cliente não encontrado |
| `404` | Mensagem do canal não encontrada na janela recente consultada |
| `500` | Erro interno ao consultar ou editar a mensagem do canal |

#### `POST` `/newsletter/messages/delete`

**Deletar mensagem recente de um canal**

Apaga um post recente de newsletter diretamente no WhatsApp.

Esta rota:
- nao depende de mensagens salvas localmente
- revoga o post no canal usando o WhatsApp/whatsmeow
- aceita localizar o post por `messageid` ou `serverid`

Observações:
- use `jid` ou `id` para identificar o canal
- envie ao menos um entre `messageid` e `serverid`
- `count` e `maxpages` controlam a janela de busca no canal


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `id` | `string` |  | ID numérico do canal. Se informado sem domínio, será convertido para `@newsletter`. Exemplo: `120363123456789012` |
| `jid` | `string` |  | JID completo do canal. Exemplo: `120363123456789012@newsletter` |
| `messageid` | `string` |  | ID lógico da mensagem no canal. Exemplo: `3EB0B4302B3A8A52F7A1` |
| `serverid` | `integer` |  | Identificador sequencial do post no canal. Exemplo: `12345` |
| `count` | `integer` |  | Quantidade de mensagens buscadas por página ao localizar o post. Exemplo: `100` |
| `maxpages` | `integer` |  | Quantidade máxima de páginas buscadas ao localizar o post. Exemplo: `5` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Mensagem do canal deletada com sucesso |
| `400` | Payload inválido ou canal inválido |
| `401` | Instância não autenticada ou cliente não encontrado |
| `404` | Mensagem do canal não encontrada na janela recente consultada |
| `500` | Erro interno ao consultar ou deletar a mensagem do canal |

#### `POST` `/newsletter/updates`

**Buscar updates de mensagens de um canal**

Consulta diretamente no WhatsApp os updates de posts já existentes de um canal.

Esta rota é diferente de `/newsletter/messages`:
- `/newsletter/messages` retorna o conteúdo dos posts
- `/newsletter/updates` retorna mudanças posteriores nos posts, especialmente métricas

Esta rota também não é um evento de webhook:
- não existe webhook `newsletter_messages_update`
- para views e reactions de canais, consulte `/newsletter/updates` sob demanda

Casos de uso:
- atualizar contadores de `views` de posts já carregados
- atualizar `reactionCounts` de posts do canal
- consultar sob demanda os mesmos tipos de métricas que chegam nos live updates internos do WhatsApp

Observações:
- use preferencialmente `afterid`
- `afterid` filtra updates depois de um `serverid`
- `since` filtra pelo momento do update
- `since` aceita timestamp em segundos ou milissegundos
- o retorno vem no campo `response`


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `id` | `string` |  | ID numérico do canal. Se informado sem domínio, será convertido para `@newsletter`. Exemplo: `120363123456789012` |
| `jid` | `string` |  | JID completo do canal. Exemplo: `120363123456789012@newsletter` |
| `count` | `integer` |  | Quantidade máxima de updates retornados. Exemplo: `50` |
| `afterid` | `integer` |  | Retorna apenas updates posteriores ao `serverid` informado. Exemplo: `12345` |
| `since` | `integer` |  | Timestamp de corte. - Se maior que `1000000000000`, é interpretado como milissegundos. - Caso contrário, é interpretado como segundos. Exemplo: `17100 |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Updates de mensagens do canal recuperados com sucesso |
| `400` | Payload inválido ou ID/JID do canal inválido |
| `401` | Instância não autenticada ou cliente não encontrado |
| `500` | Erro interno ao consultar updates do canal no WhatsApp |

#### `POST` `/newsletter/viewed`

**Marcar posts do canal como visualizados**

Marca um ou mais posts do canal como visualizados usando `serverid`.

Observações:
- envie `serverids` com uma lista de posts


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `id` | `string` |  |  Exemplo: `120363123456789012` |
| `jid` | `string` |  |  Exemplo: `120363123456789012@newsletter` |
| `serverids` | `array` |  |  Exemplo: `[12345, 12346]` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Posts marcados como visualizados |
| `400` | Payload inválido ou faltando `serverids` |
| `401` | Instância não autenticada ou cliente não encontrado |
| `500` | Erro interno ao marcar visualização |

#### `POST` `/newsletter/reaction`

**Reagir a um post do canal**

Envia, altera ou remove uma reação de um post do canal.

Observações:
- `serverid` identifica o post alvo
- `reaction` define o emoji
- envie `reaction` vazio para remover a reação
- `reactionmessageid` é opcional; se omitido, o WhatsApp gera o ID da reação


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `id` | `string` |  |  Exemplo: `120363123456789012` |
| `jid` | `string` |  |  Exemplo: `120363123456789012@newsletter` |
| `serverid` | `integer` |  |  Exemplo: `12345` |
| `reaction` | `string` |  |  Exemplo: `🔥` |
| `reactionmessageid` | `string` |  |  Exemplo: `3EB0AABBCCDD` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Reação aplicada com sucesso |
| `400` | Payload inválido ou faltando `serverid` |
| `401` | Instância não autenticada ou cliente não encontrado |
| `500` | Erro interno ao reagir ao post |

#### `POST` `/newsletter/follow`

**Seguir canal**

Segue um canal/newsletter.


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `id` | `string` |  |  Exemplo: `120363123456789012` |
| `jid` | `string` |  |  Exemplo: `120363123456789012@newsletter` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Canal seguido com sucesso |
| `400` | ID/JID inválido |
| `401` | Instância não autenticada ou cliente não encontrado |
| `500` | Erro interno ao seguir canal |

#### `POST` `/newsletter/unfollow`

**Deixar de seguir canal**

Deixa de seguir um canal/newsletter.


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `id` | `string` |  |  Exemplo: `120363123456789012` |
| `jid` | `string` |  |  Exemplo: `120363123456789012@newsletter` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Canal removido dos seguidos com sucesso |
| `400` | ID/JID inválido |
| `401` | Instância não autenticada ou cliente não encontrado |
| `500` | Erro interno ao deixar de seguir canal |

#### `POST` `/newsletter/mute`

**Silenciar canal**

Ativa o mute de um canal/newsletter.


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `id` | `string` |  |  Exemplo: `120363123456789012` |
| `jid` | `string` |  |  Exemplo: `120363123456789012@newsletter` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Canal silenciado com sucesso |
| `400` | ID/JID inválido |
| `401` | Instância não autenticada ou cliente não encontrado |
| `500` | Erro interno ao silenciar canal |

#### `POST` `/newsletter/unmute`

**Remover mute do canal**

Remove o mute de um canal/newsletter.


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `id` | `string` |  |  Exemplo: `120363123456789012` |
| `jid` | `string` |  |  Exemplo: `120363123456789012@newsletter` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Mute removido com sucesso |
| `400` | ID/JID inválido |
| `401` | Instância não autenticada ou cliente não encontrado |
| `500` | Erro interno ao remover mute do canal |

#### `POST` `/newsletter/delete`

**Deletar canal**

Remove/deleta um canal/newsletter.


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `id` | `string` |  |  Exemplo: `120363123456789012` |
| `jid` | `string` |  |  Exemplo: `120363123456789012@newsletter` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Canal deletado com sucesso |
| `400` | ID/JID inválido |
| `401` | Instância não autenticada ou cliente não encontrado |
| `500` | Erro interno ao deletar o canal |

#### `POST` `/newsletter/picture`

**Atualizar foto do canal**

Atualiza a imagem do canal/newsletter.

Observações:
- `picture` aceita URL HTTP/HTTPS, base64 puro ou data URI
- imagens acima de 1 MB são rejeitadas


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `id` | `string` |  |  Exemplo: `120363123456789012` |
| `jid` | `string` |  |  Exemplo: `120363123456789012@newsletter` |
| `picture` | `string` | ✅ |  Exemplo: `https://example.com/newsletter.png` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Foto do canal atualizada com sucesso |
| `400` | Payload inválido |
| `401` | Instância não autenticada ou cliente não encontrado |
| `500` | Erro interno ao atualizar a foto do canal |

#### `POST` `/newsletter/name`

**Atualizar nome do canal**

Atualiza o nome do canal/newsletter.


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `id` | `string` |  |  Exemplo: `120363123456789012` |
| `jid` | `string` |  |  Exemplo: `120363123456789012@newsletter` |
| `name` | `string` | ✅ |  Exemplo: `Canal de Promoções VIP` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Nome atualizado com sucesso |
| `400` | Payload inválido |
| `401` | Instância não autenticada ou cliente não encontrado |
| `500` | Erro interno ao atualizar o nome do canal |

#### `POST` `/newsletter/description`

**Atualizar descrição do canal**

Atualiza a descrição do canal/newsletter.


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `id` | `string` |  |  Exemplo: `120363123456789012` |
| `jid` | `string` |  |  Exemplo: `120363123456789012@newsletter` |
| `description` | `string` |  |  Exemplo: `Atualizações, ofertas e novidades` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Descrição atualizada com sucesso |
| `400` | Payload inválido ou ID/JID inválido |
| `401` | Instância não autenticada ou cliente não encontrado |
| `500` | Erro interno ao atualizar a descrição do canal |

#### `POST` `/newsletter/settings`

**Atualizar configurações do canal**

Atualiza configurações do canal/newsletter.

Atualmente, esta rota controla `reactionCodes`.

Valores aceitos:
- `all`
- `basic`
- `none`
- `blocklist`


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `id` | `string` |  |  Exemplo: `120363123456789012` |
| `jid` | `string` |  |  Exemplo: `120363123456789012@newsletter` |
| `reactionCodes` | `string` | ✅ |  Exemplo: `basic` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Configurações atualizadas com sucesso |
| `400` | Payload inválido |
| `401` | Instância não autenticada ou cliente não encontrado |
| `500` | Erro interno ao atualizar configurações do canal |

#### `POST` `/newsletter/search`

**Pesquisar canais públicos**

Pesquisa canais/newsletters públicos no diretório do WhatsApp.

Observações:
- use `after` para buscar a próxima página
- `countryCodes` filtra por países
- `view` e `searchText` são opcionais


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `limit` | `integer` |  |  Exemplo: `20` |
| `view` | `string` |  |  Exemplo: `RECOMMENDED` |
| `countryCodes` | `array` |  |  Exemplo: `['BR']` |
| `searchText` | `string` |  |  Exemplo: `promo` |
| `after` | `string` |  |  Exemplo: `YXJyYXljb25uZWN0aW9uOjE5` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Pesquisa executada com sucesso |
| `400` | Payload inválido |
| `401` | Instância não autenticada ou cliente não encontrado |
| `500` | Erro interno ao pesquisar canais |

#### `POST` `/newsletter/admin/invite`

**Convidar admin do canal**

Convida um telefone para virar administrador do canal.


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `id` | `string` |  |  Exemplo: `120363123456789012` |
| `jid` | `string` |  |  Exemplo: `120363123456789012@newsletter` |
| `phone` | `string` | ✅ |  Exemplo: `5511999999999` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Convite enviado com sucesso |
| `400` | Payload inválido |
| `401` | Instância não autenticada ou cliente não encontrado |
| `500` | Erro interno ao convidar admin |

#### `POST` `/newsletter/admin/accept`

**Aceitar convite de admin do canal**

Aceita um convite pendente de administrador do canal.


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `id` | `string` |  |  Exemplo: `120363123456789012` |
| `jid` | `string` |  |  Exemplo: `120363123456789012@newsletter` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Convite aceito com sucesso |
| `400` | ID/JID inválido |
| `401` | Instância não autenticada ou cliente não encontrado |
| `500` | Erro interno ao aceitar convite de admin |

#### `POST` `/newsletter/admin/remove`

**Remover admin do canal**

Remove um administrador do canal usando o telefone dele.


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `id` | `string` |  |  Exemplo: `120363123456789012` |
| `jid` | `string` |  |  Exemplo: `120363123456789012@newsletter` |
| `phone` | `string` | ✅ |  Exemplo: `5511999999999` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Admin removido com sucesso |
| `400` | Payload inválido |
| `401` | Instância não autenticada ou cliente não encontrado |
| `500` | Erro interno ao remover admin |

#### `POST` `/newsletter/admin/revoke`

**Revogar convite de admin do canal**

Revoga um convite pendente de administrador do canal usando o telefone do convidado.


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `id` | `string` |  |  Exemplo: `120363123456789012` |
| `jid` | `string` |  |  Exemplo: `120363123456789012@newsletter` |
| `phone` | `string` | ✅ |  Exemplo: `5511999999999` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Convite revogado com sucesso |
| `400` | Payload inválido |
| `401` | Instância não autenticada ou cliente não encontrado |
| `500` | Erro interno ao revogar convite |

#### `POST` `/newsletter/owner/transfer`

**Transferir dono do canal**

Transfere a propriedade do canal para outro telefone.

Observações:
- `phone` é obrigatório
- `quitAdmin=true` remove o dono anterior da posição de admin após a transferência


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `id` | `string` |  |  Exemplo: `120363123456789012` |
| `jid` | `string` |  |  Exemplo: `120363123456789012@newsletter` |
| `phone` | `string` | ✅ |  Exemplo: `5511999999999` |
| `quitAdmin` | `boolean` |  |  Exemplo: `False` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Transferência solicitada com sucesso |
| `400` | Payload inválido |
| `401` | Instância não autenticada ou cliente não encontrado |
| `500` | Erro interno ao transferir ownership do canal |

---

### Respostas Rápidas

Gerenciamento de respostas rápidas para agilizar o atendimento.

**⚠️ Importante**: Este recurso tem serventia apenas se você utilizar um sistema frontend/interface
personalizada para registrar e utilizar as respostas. A API apenas armazena as respostas, 
mas não as aplica automaticamente.

### Como funciona:
- **Criar**: Cadastre respostas pré-definidas com títulos e conteúdo
- **Listar**: Recupere todas as respostas cadastradas para exibir na sua interface
- **Usar**: Seu sistema frontend pode usar essas respostas para agilizar digitação

### Casos de uso:
- Interfaces web personalizadas de atendimento
- Apps mobile com sugestões de resposta
- Sistemas CRM com templates de mensagem
- Ferramentas de produtividade para atendentes

**Não é um chatbot**: Para respostas automáticas, use os recursos de Chatbot.



#### `POST` `/quickreply/edit`

**Criar, atualizar ou excluir resposta rápida**

Gerencia templates de respostas rápidas para agilizar o atendimento. Suporta mensagens de texto e mídia.

- Para criar: não inclua o campo `id`
- Para atualizar: inclua o `id` existente
- Para excluir: defina `delete: true` e inclua o `id`

Observação: Templates originados do WhatsApp (onWhatsApp=true) não podem ser modificados ou excluídos.


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `id` | `string` |  | Necessário para atualizações/exclusões, omitir para criação Exemplo: `rb9da9c03637452` |
| `delete` | `boolean` |  | Definir como true para excluir o template |
| `shortCut` | `string` | ✅ | Atalho para acesso rápido ao template Exemplo: `saudacao1` |
| `type` | `string` | ✅ | Tipo da mensagem Valores: `text`, `audio`, `myaudio`, `ptt`, `document`, `video`, `image` |
| `text` | `string` |  | Obrigatório para mensagens do tipo texto Exemplo: `Olá! Como posso ajudar hoje?` |
| `file` | `string` |  | URL ou Base64 para tipos de mídia Exemplo: `https://exemplo.com/arquivo.pdf` |
| `docName` | `string` |  | Nome do arquivo opcional para tipo documento Exemplo: `apresentacao.pdf` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Operação concluída com sucesso |
| `400` | Requisição inválida (erro de validação) |
| `403` | Não é possível modificar template originado do WhatsApp |
| `404` | Template não encontrado |
| `500` | Erro no servidor |

#### `GET` `/quickreply/showall`

**Listar todas as respostas rápidas**

Retorna todas as respostas rápidas cadastradas para a instância autenticada


**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Lista de respostas rápidas |
| `500` | Erro no servidor |

---

### CRM

Sistema completo de gestão de relacionamento com clientes integrado à API.

**💾 Armazenamento interno**: Todos os dados dos leads ficam salvos diretamente na API,
eliminando a necessidade de bancos de dados externos. Sua aplicação pode focar apenas
na interface e lógica de negócio.

### Recursos disponíveis:
- **📋 20+ campos personalizáveis**: Nome, telefone, email, empresa, observações, etc.
- **🏷️ Sistema de etiquetas**: Organize e categorize seus contatos
- **🔍 Busca avançada**: Filtre por qualquer campo ou etiqueta
- **📊 Histórico completo**: Todas as interações ficam registradas automaticamente

### 🎯 Placeholders em mensagens:
Use variáveis dinâmicas nas mensagens para personalização automática:

```
Olá {{nome}}! Vi que você trabalha na {{empresa}}.
Seu email {{email}} está correto?
Observações: {{observacoes}}
```

### Fluxo típico:
1. **Captura**: Leads chegam via WhatsApp ou formulários
2. **Enriquecimento**: Adicione dados usando `/chat/editLead`
3. **Segmentação**: Organize com etiquetas
4. **Comunicação**: Envie mensagens personalizadas com placeholders
5. **Acompanhamento**: Histórico fica salvo automaticamente

**Ideal para**: Vendas, marketing, atendimento, qualificação de leads



#### `POST` `/instance/updateFieldsMap`

**Atualizar campos personalizados de leads**

Atualiza os campos personalizados (custom fields) de uma instância. 
Permite configurar até 20 campos personalizados para armazenamento de 
informações adicionais sobre leads.

Cada campo pode armazenar até 255 caracteres e aceita qualquer tipo de dado.

Campos disponíveis:
- lead_field01 a lead_field20

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
- 400: Campos inválidos ou payload mal formatado
- 401: Token inválido ou expirado
- 404: Instância não encontrada
- 500: Erro ao atualizar campos no banco de dados

Restrições:
- Cada campo pode ter no máximo 255 caracteres
- Campos vazios serão mantidos com seus valores atuais
- Apenas os campos enviados serão atualizados


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `lead_field01` | `string` |  | Campo personalizado 01 |
| `lead_field02` | `string` |  | Campo personalizado 02 |
| `lead_field03` | `string` |  | Campo personalizado 03 |
| `lead_field04` | `string` |  | Campo personalizado 04 |
| `lead_field05` | `string` |  | Campo personalizado 05 |
| `lead_field06` | `string` |  | Campo personalizado 06 |
| `lead_field07` | `string` |  | Campo personalizado 07 |
| `lead_field08` | `string` |  | Campo personalizado 08 |
| `lead_field09` | `string` |  | Campo personalizado 09 |
| `lead_field10` | `string` |  | Campo personalizado 10 |
| `lead_field11` | `string` |  | Campo personalizado 11 |
| `lead_field12` | `string` |  | Campo personalizado 12 |
| `lead_field13` | `string` |  | Campo personalizado 13 |
| `lead_field14` | `string` |  | Campo personalizado 14 |
| `lead_field15` | `string` |  | Campo personalizado 15 |
| `lead_field16` | `string` |  | Campo personalizado 16 |
| `lead_field17` | `string` |  | Campo personalizado 17 |
| `lead_field18` | `string` |  | Campo personalizado 18 |
| `lead_field19` | `string` |  | Campo personalizado 19 |
| `lead_field20` | `string` |  | Campo personalizado 20 |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Sucesso |
| `401` | Token inválido/expirado |
| `404` | Instância não encontrada |
| `500` | Erro interno |

#### `POST` `/chat/editLead`

**Edita informações de lead**

Atualiza as informações de lead associadas a um chat. Permite modificar status do ticket, 
atribuição de atendente, posição no kanban, tags e outros campos customizados.

As alterações são refletidas imediatamente no banco de dados e disparam eventos webhook/SSE
para manter a aplicação sincronizada.


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `id` | `string` | ✅ | Identificador do chat. Pode ser: - wa_chatid (ex: "5511999999999@s.whatsapp.net") - wa_fastid (ex: "5511888888888:5511999999999") Exemplo: `5511999999 |
| `chatbot_disableUntil` | `integer (int64)` |  | Timestamp UTC até quando o chatbot deve ficar desativado para este chat. Use 0 para reativar imediatamente. Exemplo: `1735686000` |
| `lead_isTicketOpen` | `boolean` |  | Status do ticket associado ao lead. - true: Ticket está aberto/em atendimento - false: Ticket está fechado/resolvido Exemplo: `True` |
| `lead_assignedAttendant_id` | `string` |  | ID do atendente atribuído ao lead. Use string vazia ("") para remover a atribuição. Exemplo: `att_123456` |
| `lead_kanbanOrder` | `integer (int64)` |  | Posição do card no quadro kanban. Valores maiores aparecem primeiro. Exemplo: `1000` |
| `lead_tags` | `array` |  | Lista de tags associadas ao lead. Tags inexistentes são criadas automaticamente. Envie array vazio ([]) para remover todas as tags. Exemplo: `['vip',  |
| `lead_name` | `string` |  | Nome principal do lead Exemplo: `João Silva` |
| `lead_fullName` | `string` |  | Nome completo do lead Exemplo: `João Silva Pereira` |
| `lead_email` | `string (email)` |  | Email do lead Exemplo: `joao@exemplo.com` |
| `lead_personalid` | `string` |  | Documento de identificação (CPF/CNPJ) Apenas números ou formatado Exemplo: `123.456.789-00` |
| `lead_status` | `string` |  | Status do lead no funil de vendas Exemplo: `qualificado` |
| `lead_notes` | `string` |  | Anotações sobre o lead Exemplo: `Cliente interessado em plano premium` |
| `lead_field01` | `string` |  | Campo personalizado 1 |
| `lead_field02` | `string` |  | Campo personalizado 2 |
| `lead_field03` | `string` |  | Campo personalizado 3 |
| `lead_field04` | `string` |  | Campo personalizado 4 |
| `lead_field05` | `string` |  | Campo personalizado 5 |
| `lead_field06` | `string` |  | Campo personalizado 6 |
| `lead_field07` | `string` |  | Campo personalizado 7 |
| `lead_field08` | `string` |  | Campo personalizado 8 |
| `lead_field09` | `string` |  | Campo personalizado 9 |
| `lead_field10` | `string` |  | Campo personalizado 10 |
| `lead_field11` | `string` |  | Campo personalizado 11 |
| `lead_field12` | `string` |  | Campo personalizado 12 |
| `lead_field13` | `string` |  | Campo personalizado 13 |
| `lead_field14` | `string` |  | Campo personalizado 14 |
| `lead_field15` | `string` |  | Campo personalizado 15 |
| `lead_field16` | `string` |  | Campo personalizado 16 |
| `lead_field17` | `string` |  | Campo personalizado 17 |
| `lead_field18` | `string` |  | Campo personalizado 18 |
| `lead_field19` | `string` |  | Campo personalizado 19 |
| `lead_field20` | `string` |  | Campo personalizado 20 |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Lead atualizado com sucesso |
| `400` | Payload inválido |
| `404` | Chat não encontrado |
| `500` | Erro interno do servidor |

---

### Mensagem em massa


#### `POST` `/sender/simple`

**Criar nova campanha (Simples)**

Cria uma nova campanha de envio com configurações básicas


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `numbers` | `array` | ✅ | Lista de números para envio Exemplo: `['5511999999999@s.whatsapp.net']` |
| `type` | `string` | ✅ | Tipo da mensagem Valores: `text`, `image`, `video`, `videoplay`, `audio`, `document`, `contact`, `location`, `list`, `button`, `poll`, `carousel` |
| `folder` | `string` |  | Nome da campanha de envio Exemplo: `Campanha Janeiro` |
| `delayMin` | `integer` | ✅ | Delay mínimo entre mensagens em segundos Exemplo: `10` |
| `delayMax` | `integer` | ✅ | Delay máximo entre mensagens em segundos Exemplo: `30` |
| `scheduled_for` | `integer` | ✅ | Timestamp em milissegundos ou minutos a partir de agora para agendamento Exemplo: `1706198400000` |
| `info` | `string` |  | Informações adicionais sobre a campanha |
| `delay` | `integer` |  | Delay fixo entre mensagens (opcional) |
| `mentions` | `string` |  | Menções na mensagem em formato JSON |
| `text` | `string` |  | Texto da mensagem |
| `linkPreview` | `boolean` |  | Habilitar preview de links em mensagens de texto. O preview será gerado automaticamente a partir da URL contida no texto. |
| `linkPreviewTitle` | `string` |  | Título personalizado para o preview do link (opcional) |
| `linkPreviewDescription` | `string` |  | Descrição personalizada para o preview do link (opcional) |
| `linkPreviewImage` | `string` |  | URL ou dados base64 da imagem para o preview do link (opcional) |
| `linkPreviewLarge` | `boolean` |  | Se deve usar preview grande ou pequeno (opcional, padrão false) |
| `file` | `string` |  | URL da mídia ou arquivo (quando type é image, video, audio, document, etc.) |
| `docName` | `string` |  | Nome do arquivo (quando type é document) |
| `fullName` | `string` |  | Nome completo (quando type é contact) |
| `phoneNumber` | `string` |  | Número do telefone (quando type é contact) |
| `organization` | `string` |  | Organização (quando type é contact) |
| `email` | `string` |  | Email (quando type é contact) |
| `url` | `string` |  | URL (quando type é contact) |
| `latitude` | `number` |  | Latitude (quando type é location) |
| `longitude` | `number` |  | Longitude (quando type é location) |
| `name` | `string` |  | Nome do local (quando type é location) |
| `address` | `string` |  | Endereço (quando type é location) |
| `footerText` | `string` |  | Texto do rodapé (quando type é list, button, poll ou carousel) |
| `buttonText` | `string` |  | Texto do botão (quando type é list, button, poll ou carousel) |
| `listButton` | `string` |  | Texto do botão da lista (quando type é list) |
| `selectableCount` | `integer` |  | Quantidade de opções selecionáveis (quando type é poll) |
| `choices` | `array` |  | Lista de opções (quando type é list, button, poll ou carousel). Para carousel, use formato específico com [texto], {imagem} e botões |
| `imageButton` | `string` |  | URL da imagem para o botão (quando type é button) |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | campanha criada com sucesso |
| `400` | Erro nos parâmetros da requisição |
| `401` | Erro de autenticação |
| `409` | Conflito - campanha já existe |
| `500` | Erro interno do servidor |

#### `POST` `/sender/advanced`

**Criar envio em massa avançado**

Cria um novo envio em massa com configurações avançadas, permitindo definir
múltiplos destinatários e mensagens com delays personalizados.


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `delayMin` | `integer` |  | Delay mínimo entre mensagens (segundos) Exemplo: `3` |
| `delayMax` | `integer` |  | Delay máximo entre mensagens (segundos) Exemplo: `6` |
| `info` | `string` |  | Descrição ou informação sobre o envio em massa Exemplo: `Campanha de lançamento` |
| `scheduled_for` | `integer` |  | Timestamp em milissegundos (date unix) ou minutos a partir de agora para agendamento Exemplo: `1` |
| `messages` | `array` | ✅ | Lista de mensagens a serem enviadas |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Mensagens adicionadas à fila com sucesso |
| `400` | Erro nos parâmetros da requisição |
| `401` | Não autorizado - token inválido ou ausente |
| `500` | Erro interno do servidor |

#### `POST` `/sender/edit`

**Controlar campanha de envio em massa**

Permite controlar campanhas de envio de mensagens em massa através de diferentes ações:

## Ações Disponíveis:

**🛑 stop** - Pausar campanha
- Pausa uma campanha ativa ou agendada
- Altera o status para "paused" 
- Use quando quiser interromper temporariamente o envio
- Mensagens já enviadas não são afetadas

**▶️ continue** - Continuar campanha  
- Retoma uma campanha pausada
- Altera o status para "scheduled"
- Use para continuar o envio após pausar uma campanha
- Não funciona em campanhas já concluídas ("done")

**🗑️ delete** - Deletar campanha
- Remove completamente a campanha
- Deleta apenas mensagens NÃO ENVIADAS (status "scheduled")
- Mensagens já enviadas são preservadas no histórico
- Operação é executada de forma assíncrona

## Status de Campanhas:
- **scheduled**: Agendada para envio
- **sending**: Enviando mensagens  
- **paused**: Pausada pelo usuário
- **done**: Concluída (não pode ser alterada)
- **deleting**: Sendo deletada (operação em andamento)


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `folder_id` | `string` | ✅ | Identificador único da campanha de envio Exemplo: `folder_123` |
| `action` | `string` | ✅ | Ação a ser executada na campanha: - **stop**: Pausa a campanha (muda para status "paused") - **continue**: Retoma campanha pausada (muda para status " |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Ação realizada com sucesso |
| `400` | Requisição inválida |

#### `POST` `/sender/cleardone`

**Limpar mensagens enviadas**

Inicia processo de limpeza de mensagens antigas em lote que já foram enviadas com sucesso. Por padrão, remove mensagens mais antigas que 7 dias.


**Request Body** (`application/json`):

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `hours` | `integer` |  | Quantidade de horas para manter mensagens. Mensagens mais antigas que esse valor serão removidas. Exemplo: `168` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Limpeza iniciada com sucesso |

#### `DELETE` `/sender/clearall`

**Limpar toda fila de mensagens**

Remove todas as mensagens da fila de envio em massa, incluindo mensagens pendentes e já enviadas.
Esta é uma operação irreversível.


**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Fila de mensagens limpa com sucesso |
| `401` | Não autorizado - token inválido ou ausente |
| `500` | Erro interno do servidor |

#### `GET` `/sender/listfolders`

**Listar campanhas de envio**

Retorna as campanhas de envio em massa da instância atual, ordenadas das mais recentes
para as mais antigas.

Se a instância não possuir owner associado, a API retorna uma lista vazia.


**Parâmetros**:

| Nome | In | Tipo | Obrigatório | Descrição |
|---|---|---|:---:|---|
| `status` | `query` | `string` |  | Filtro de status desejado. O backend atual retorna todas as pastas do owner e pode ignorar esse parâmetro dependendo da  |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Lista de campanhas retornada com sucesso |
| `500` | Erro interno do servidor |

#### `POST` `/sender/listmessages`

**Listar mensagens de uma campanha**

Retorna a lista de mensagens de uma campanha específica, com opções de filtro por status e paginação


**Request Body** (`application/json`):

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `folder_id` | `string` | ✅ | ID da campanha a ser consultada |
| `messageStatus` | `string` |  | Status das mensagens para filtrar Valores: `Scheduled`, `Sent`, `Failed` |
| `limit` | `integer` |  | Quantidade maxima de itens por pagina |
| `offset` | `integer` |  | Deslocamento base zero para paginacao |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Lista de mensagens retornada com sucesso |
| `400` | Requisição inválida |
| `500` | Erro interno do servidor |

---

### Chatbot Configurações


#### `POST` `/instance/updatechatbotsettings`

**Chatbot Configurações**

Explicação dos campos:


- `openai_apikey`: Chave da API OpenAI (começa com "sk-")  

- `chatbot_enabled`: Habilita/desabilita o chatbot  

- `chatbot_ignoreGroups`: Define se o chatbot deve ignorar mensagens de grupos  

- `chatbot_stopConversation`: Palavra-chave que os usuários podem usar para parar o chatbot  

- `chatbot_stopMinutes`: Por quantos minutos o chatbot deve ficar desativado após receber o comando de parada  

- `chatbot_stopWhenYouSendMsg`: Por quantos minutos o chatbot deve ficar desativado após você enviar uma mensagem fora da API, 0 desliga.


**Request Body** (`application/json`):


**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Sucesso |
| `401` | Token inválido/expirado |
| `404` | Instância não encontrada |
| `500` | Erro interno |

---

### Chatbot Trigger


#### `POST` `/trigger/edit`

**Criar, atualizar ou excluir um trigger do chatbot**

Endpoint para gerenciar triggers do chatbot. Suporta:
- Criação de novos triggers
- Atualização de triggers existentes
- Exclusão de triggers por ID


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `id` | `string` |  | ID do trigger. Vazio para criação, obrigatório para atualização/exclusão |
| `delete` | `boolean` |  | Quando verdadeiro, exclui o trigger especificado pelo id |
| `trigger` | `` | ✅ |  |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Trigger atualizado com sucesso |
| `201` | Trigger criado com sucesso |
| `400` | Corpo da requisição inválido ou campos obrigatórios ausentes |
| `404` | Trigger não encontrado |
| `500` | Erro no servidor |

#### `GET` `/trigger/list`

**Listar todos os triggers do chatbot**

Retorna a lista completa de triggers configurados para a instância atual


**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Lista de triggers retornada com sucesso |
| `401` | Não autorizado |
| `500` | Erro no servidor |

---

### Configuração do Agente de IA


#### `POST` `/agent/edit`

**Criar/Editar Agente**

# Documentação dos Campos de Configuração

## Campos Básicos

### Nome e Identificação

O agente precisa ser configurado com informações básicas que determinam sua identidade e funcionamento.

#### Nome do Agente
**name**: Define como o agente será identificado nas conversas.

Exemplos válidos:
- "Assistente de Vendas"
- "Suporte Técnico" 
- "João"
- "Maria"

#### Provedor do Serviço
**provider**: Especifica qual serviço de IA será utilizado.

Provedores disponíveis:
- "openai" (ChatGPT)
- "anthropic" (Claude)
- "gemini" (Google)
- "deepseek" (DeepSeek)

#### Chave de API
**apikey**: Credencial necessária para autenticação com o provedor escolhido.
- Deve ser obtida através do site oficial do provedor selecionado
- Mantenha esta chave em segurança e nunca a compartilhe

### Configuração do Modelo

#### Seleção do Modelo
**model**: Especifica qual modelo de IA será utilizado. A disponibilidade depende do provedor selecionado.

##### OpenAI
Documentação: https://platform.openai.com/docs/models
- gpt-4o
- gpt-4o-mini
- gpt-3.5-turbo

##### Claude
Documentação: https://docs.anthropic.com/en/docs/about-claude/models
- claude-3-5-sonnet-latest
- claude-3-5-haiku-latest
- claude-3-opus-latest

##### Gemini
Documentação: https://ai.google.dev/models/gemini
- gemini-2.0-flash-exp
- gemini-1.5-pro
- gemini-1.5-flash

##### DeepSeek
Documentação: https://api-docs.deepseek.com/quick_start/pricing
- deepseek-chat
- deepseek-reasoner

        

## Configurações de Comportamento


### Prompt Base (**basePrompt**)


Instruções iniciais para definir o comportamento do agente
    
Exemplo para assistente de vendas:

"Você é um assistente especializado em vendas, focado em ajudar clientes a encontrar os produtos ideais. Mantenha um tom profissional e amigável."
        
Exemplo para suporte:

"Você é um agente de suporte técnico especializado em nossos produtos. Forneça respostas claras e objetivas para ajudar os clientes a resolverem seus problemas."

        

### Parâmetros de Geração


- **temperature**: Controla a criatividade das respostas (0-100)
    
    - 0-30: Respostas mais conservadoras e precisas
        
    - 30-70: Equilíbrio entre criatividade e precisão
        
    - 70-100: Respostas mais criativas e variadas

        
- **maxTokens**: Limite máximo de tokens por resposta
    
    - Recomendado: 1000-4000 para respostas detalhadas
        
    - Para respostas curtas: 500-1000
        
    - Limite máximo varia por modelo

        
- **diversityLevel**: Controla a diversidade das respostas (0-100)
    
    - Valores mais altos geram respostas mais variadas
        
    - Recomendado: 30-70 para uso geral

        
- **frequencyPenalty**: Penalidade para repetição de palavras (0-100)
    
    - Valores mais altos reduzem repetições
        
    - Recomendado: 20-50 para comunicação natural

        
- **presencePenalty**: Penalidade para manter foco no tópico (0-100)
    
    - Valores mais altos incentivam mudanças de tópico
        
    - Recomendado: 10-30 para manter coerência

        

## Configurações de Interação


### Mensagens


- **signMessages**: Se verdadeiro, adiciona a assinatura do agente nas mensagens
    
    - Útil para identificar quem está enviando a mensagem

        
- **readMessages**: Se verdadeiro, marca as mensagens como lidas ao responder
    
    - Recomendado para simular comportamento humano

        

## Exemplos de Configuração


### Assistente de Vendas


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

### Suporte Técnico


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

## Dicas de Otimização


1. **Ajuste Gradual**: Comece com valores moderados e ajuste conforme necessário
    
2. **Teste o Base Prompt**: Verifique se as instruções estão claras e completas
    
3. **Monitore o Desempenho**: Observe as respostas e ajuste os parâmetros para melhor adequação
    
4. **Backup**: Mantenha um backup das configurações que funcionaram bem
    
5. **Documentação**: Registre as alterações e seus impactos para referência futura


**Request Body** (`application/json`):


**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Agente atualizado com sucesso |
| `201` | Novo agente criado com sucesso |
| `400` | Erro na requisição |
| `401` | Não autorizado |
| `404` | Agente não encontrado |
| `500` | Erro interno do servidor |

#### `GET` `/agent/list`

**Todos os agentes**


**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Lista de todos os agentes de IA |
| `401` | Sessão não encontrada |
| `500` | Erro ao buscar agentes |

---

### Conhecimento dos Agentes


#### `POST` `/knowledge/edit`

**Criar/Editar Conhecimento do Agente**

Gerencia o conhecimento base usado pelos agentes de IA para responder consultas.
O conhecimento pode ser fornecido como texto direto ou através de arquivos PDF/CSV.

Características principais:
- Suporta criação, edição e exclusão de conhecimento
- Aceita conteúdo em:
  - Texto puro
  - URLs públicas
  - Base64 encoded de arquivos
  - Upload direto de arquivos
- Formatos suportados: PDF, CSV, TXT, HTML
- Processa automaticamente qualquer formato de entrada
- Vetoriza automaticamente o conteúdo para busca semântica

Nota sobre URLs e Base64:
- URLs devem ser públicas e acessíveis
- Para PDFs/CSVs, especifique fileType se não for detectável da extensão
- Base64 deve incluir o encoding completo do arquivo
- O servidor detecta e processa automaticamente conteúdo Base64


**Request Body** (`application/json`):

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `id` | `string` |  | ID do conhecimento (vazio para criar novo) |
| `delete` | `boolean` |  | Define se é uma operação de exclusão |
| `knowledge` | `object` |  |  |
| `fileType` | `string` |  | Tipo do arquivo quando não detectado automaticamente Valores: `pdf`, `txt`, `html`, `csv` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Conhecimento atualizado com sucesso |
| `201` | Novo conhecimento criado com sucesso |
| `400` | Requisição inválida |
| `404` | Conhecimento não encontrado |
| `500` | Erro interno do servidor |

#### `GET` `/knowledge/list`

**Listar Base de Conhecimento**

Retorna todos os conhecimentos cadastrados para o agente de IA da instância.
Estes conhecimentos são utilizados pelo chatbot para responder perguntas
e interagir com os usuários de forma contextualizada.


**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Lista de conhecimentos recuperada com sucesso |
| `401` | Token de autenticação ausente ou inválido |
| `500` | Erro interno do servidor ao buscar conhecimentos |

---

### Funções API dos Agentes


#### `POST` `/function/edit`

**Criar/Editar função para integração com APIs externas**

# Configuração de Funções de API para Agentes IA

Documentação para criar/editar funções utilizadas pelos agentes de IA para integração com APIs externas. Inclui validação automática e controle de ativação.

## 1. Estrutura Base da Função

### Campos Principais
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

### Detalhamento dos Campos

#### `name`
- Identificador único e descritivo
- Sem espaços ou caracteres especiais
- Ex: "createProduct", "updateUserStatus"

#### `description`
- Propósito e funcionamento da função
- Inclua casos de uso e resultados esperados
- Ex: "Cria produto no catálogo com nome, preço e categoria"

#### `active`
- Controla disponibilidade da função
- Desativa automaticamente se houver erros
- Default: false

#### `method`
- GET: buscar dados
- POST: criar recurso
- PUT: atualizar completo
- PATCH: atualização parcial
- DELETE: remover recurso

#### `endpoint`
- URL completa da API
- Aceita placeholders: {{variavel}}
- Exemplos:
  ```
  https://api.exemplo.com/produtos
  https://api.exemplo.com/usuarios/{{userId}}
  https://api.exemplo.com/busca?q={{query}}&limit={{limit}}
  ```

#### `headers`
```json
{
  "Authorization": "Bearer {{apiKey}}",
  "Content-Type": "application/json",
  "Accept": "application/json"
}
```

#### `body` (POST/PUT/PATCH)
```json
{
  "name": "{{productName}}",
  "price": "{{price}}",
  "metadata": {
    "tags": "{{tags}}"
  }
}
```

## 2. Configuração de Parâmetros

### Estrutura do Parâmetro
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

### Tipos de Parâmetros

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
```json
{
  "name": "active",
  "type": "boolean",
  "description": "Status de ativação"
}
```

## 3. Sistema de Validação

### Validações Automáticas
1. JSON
  - Headers e body devem ser válidos
  - Erros desativam a função

2. Placeholders ({{variavel}})
  - Case-sensitive
  - Devem ter parâmetro correspondente

3. Parâmetros
  - Nomes únicos
  - Tipos corretos
  - Limites numéricos válidos
  - Enums sem valores vazios

### Erros e Avisos
- Função desativa se houver:
  - JSON inválido
  - Parâmetros não documentados
  - Violações de tipo
- Erros aparecem em `undocumentedParameters`

## 4. Exemplo Completo

```json
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


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `id` | `string` | ✅ | ID da função. Vazio para criar nova, preenchido para editar existente. |
| `delete` | `boolean` | ✅ | Se true, deleta a função especificada pelo ID. |
| `function` | `object` | ✅ |  |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Função atualizada com sucesso |
| `201` | Nova função criada com sucesso |
| `400` | Erro de validação nos dados fornecidos |
| `404` | Função não encontrada |
| `500` | Erro interno do servidor |

#### `GET` `/function/list`

**Lista todas as funções de API**

Retorna todas as funções de API configuradas para a instância atual


**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Lista de funções recuperada com sucesso |
| `500` | Erro interno do servidor |

---

### Integração Chatwoot

**🚧 INTEGRAÇÃO BETA - Sistema de integração com Chatwoot para atendimento unificado**

**⚠️ AVISO**: Esta integração está em fase BETA. Use por sua conta e risco. Recomendamos testes em ambiente não-produtivo antes do uso em produção.

Esta categoria contém recursos para configurar e gerenciar a integração com o Chatwoot, uma plataforma de atendimento ao cliente open-source. A integração permite centralizar conversas do WhatsApp no Chatwoot.

### Recursos disponíveis:
- 🔧 **Configuração Completa**: Configure URL, tokens e credenciais do Chatwoot
- 📬 **Sincronização Bidirecional**: Mensagens novas entre WhatsApp e Chatwoot são sincronizadas automaticamente
- 📱 **Gerenciamento de Contatos**: Sincronização automática de nomes e telefones
- 🔄 **Atualização LID→PN**: Migração automática de Local ID para Phone Number
- 🏷️ **Nomes Inteligentes**: Sistema de nomes com til (~) para atualização automática
- 🚫 **Separação de Grupos**: Opção para ignorar grupos na sincronização
- 👤 **Assinatura de Mensagens**: Identificação do agente nas mensagens enviadas
- 🔗 **Webhook Automático**: URL gerada automaticamente para configurar no Chatwoot

### 🏷️ Sistema de Nomes Inteligentes:
- **Nomes com til (~)**: Atualizados automaticamente quando contato modifica nome no WhatsApp
- **Nomes específicos**: Para nome fixo, remover til (~) do nome no Chatwoot
- **Exemplo**: "~João Silva" = automático, "João Silva" = fixo
- **Migração LID→PN**: Sem duplicação de conversas durante a transição
- **Respostas nativas**: Aparecem diretamente no Chatwoot sem marcações externas

### ⚠️ Limitações conhecidas:
- **Sincronização de histórico**: Não implementada - apenas mensagens novas são sincronizadas

### Casos de uso:
- Atendimento centralizado no Chatwoot
- Equipes de suporte com múltiplos agentes
- Integração com CRM via Chatwoot
- Centralização de canais de comunicação
- Gestão automática de contatos e nomes

**Ideal para**: Empresas com equipes de atendimento, call centers, suporte técnico (em ambiente de testes)

**Requer**: Instância do Chatwoot configurada, tokens de API e ambiente de testes

**🚧 Lembre-se**: Integração em BETA - funcionalidades podem mudar sem aviso prévio



#### `GET` `/chatwoot/config`

**Obter configuração do Chatwoot**

Retorna a configuração atual da integração com Chatwoot para a instância.

### Funcionalidades:
- Retorna todas as configurações do Chatwoot incluindo credenciais
- Mostra status de habilitação da integração
- Útil para verificar configurações atuais antes de fazer alterações


**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Configuração obtida com sucesso |
| `401` | Token inválido/expirado |
| `500` | Erro interno do servidor |

#### `PUT` `/chatwoot/config`

**Atualizar configuração do Chatwoot**

Atualiza a configuração da integração com Chatwoot para a instância.

### Funcionalidades:
- Configura todos os parâmetros da integração Chatwoot
- Reinicializa automaticamente o cliente Chatwoot quando habilitado
- Retorna URL do webhook para configurar no Chatwoot
- Sincronização bidirecional de mensagens novas entre WhatsApp e Chatwoot
- Sincronização automática de contatos (nome e telefone)
- Atualização automática LID → PN (Local ID para Phone Number)
- Sistema de nomes inteligentes com til (~)

### Configuração no Chatwoot:
1. Após configurar via API, use a URL retornada no webhook settings da inbox no Chatwoot
2. Configure como webhook URL na sua inbox do Chatwoot
3. A integração ficará ativa e sincronizará mensagens e contatos automaticamente

### 🏷️ Sistema de Nomes Inteligentes:
- **Nomes com til (~)**: São atualizados automaticamente quando o contato modifica seu nome no WhatsApp
- **Nomes específicos**: Para definir um nome fixo, remova o til (~) do nome no Chatwoot
- **Exemplo**: "~João Silva" será atualizado automaticamente, "João Silva" (sem til) permanecerá fixo
- **Atualização LID→PN**: Contatos migram automaticamente de Local ID para Phone Number quando disponível
- **Sem duplicação**: Durante a migração LID→PN, não haverá duplicação de conversas
- **Respostas nativas**: Todas as respostas dos agentes aparecem nativamente no Chatwoot

### 🚧 AVISO IMPORTANTE - INTEGRAÇÃO BETA:
- **Fase Beta**: Esta integração está em fase de desenvolvimento e testes
- **Uso por conta e risco**: O usuário assume total responsabilidade pelo uso
- **Recomendação**: Teste em ambiente não-produtivo antes de usar em produção
- **Suporte limitado**: Funcionalidades podem mudar sem aviso prévio

### ⚠️ Limitações Conhecidas:
- **Sincronização de histórico**: Não implementada - apenas mensagens novas são sincronizadas


**Request Body** (`application/json`) — obrigatório:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `enabled` | `boolean` | ✅ | Habilitar/desabilitar integração com Chatwoot Exemplo: `True` |
| `url` | `string` | ✅ | URL base da instância Chatwoot (sem barra final) Exemplo: `https://app.chatwoot.com` |
| `access_token` | `string` | ✅ | Token de acesso da API Chatwoot (obtido em Profile Settings > Access Token) Exemplo: `pXXGHHHyJPYHYgWHJHYHgJjj` |
| `account_id` | `integer (int64)` | ✅ | ID da conta no Chatwoot (visível na URL da conta) Exemplo: `1` |
| `inbox_id` | `integer (int64)` | ✅ | ID da inbox no Chatwoot (obtido nas configurações da inbox) Exemplo: `5` |
| `ignore_groups` | `boolean` |  | Ignorar mensagens de grupos do WhatsApp na sincronização Exemplo: `False` |
| `sign_messages` | `boolean` |  | Assinar mensagens enviadas para WhatsApp com identificação do agente Exemplo: `True` |
| `create_new_conversation` | `boolean` |  | Sempre criar nova conversa ao invés de reutilizar conversas existentes Exemplo: `False` |

**Respostas**:

| Código | Descrição |
|---|---|
| `200` | Configuração atualizada com sucesso |
| `400` | Dados inválidos no body da requisição |
| `401` | Token inválido/expirado |
| `500` | Erro interno ao salvar configuração |

---

## Schemas

A API define **15 schemas** reutilizáveis.


### `Instance`

Representa uma instância do WhatsApp

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `id` | `string (uuid)` |  | ID único gerado automaticamente |
| `token` | `string` |  | Token de autenticação da instância |
| `status` | `string` |  | Status atual da conexão |
| `paircode` | `string` |  | Código de pareamento |
| `qrcode` | `string` |  | QR Code em base64 para autenticação |
| `name` | `string` |  | Nome da instância |
| `profileName` | `string` |  | Nome do perfil WhatsApp |
| `profilePicUrl` | `string (uri)` |  | URL da foto do perfil |
| `isBusiness` | `boolean` |  | Indica se é uma conta business |
| `plataform` | `string` |  | Plataforma de origem (iOS/Android/Web) |
| `systemName` | `string` |  | Nome do sistema operacional |
| `owner` | `string` |  | Proprietário da instância |
| `current_presence` | `string` |  | Status atual de presença da instância (campo não persistido) Valores: `available`, `unavailable` |
| `lastDisconnect` | `string (date-time)` |  | Data/hora da última desconexão |
| `lastDisconnectReason` | `string` |  | Motivo da última desconexão |
| `adminField01` | `string` |  | Campo administrativo 01 |
| `adminField02` | `string` |  | Campo administrativo 02 |
| `openai_apikey` | `string` |  | Chave da API OpenAI |
| `chatbot_enabled` | `boolean` |  | Habilitar chatbot automático |
| `chatbot_ignoreGroups` | `boolean` |  | Ignorar mensagens de grupos |
| `chatbot_stopConversation` | `string` |  | Palavra-chave para parar conversa |
| `chatbot_stopMinutes` | `integer` |  | Por quanto tempo ficará pausado o chatbot ao usar stop conversation |
| `chatbot_stopWhenYouSendMsg` | `integer` |  | Por quanto tempo ficará pausada a conversa quando você enviar mensagem manualmente |
| `fieldsMap` | `object` |  | Mapa de campos customizados da instância (quando presente) |
| `currentTime` | `string` |  | Horário atual retornado pelo backend |
| `created` | `string (date-time)` |  | Data de criação da instância |
| `updated` | `string (date-time)` |  | Data da última atualização |

### `Webhook`

Configuração completa de webhook com filtros e opções avançadas

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `id` | `string (uuid)` |  | ID único gerado automaticamente |
| `enabled` | `boolean` |  | Webhook ativo/inativo |
| `url` | `string (uri)` | ✅ | URL de destino dos eventos |
| `events` | `array` | ✅ | Tipos de eventos monitorados |
| `addUrlTypesMessages` | `boolean` |  | Incluir na URLs o tipo de mensagem |
| `addUrlEvents` | `boolean` |  | Incluir na URL o nome do evento |
| `excludeMessages` | `array` |  | Filtros para excluir tipos de mensagens |

### `Chat`

Representa uma conversa/chamado no sistema

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `id` | `string` |  | ID único da conversa (r + 7 bytes aleatórios em hex) |
| `wa_fastid` | `string` |  | Identificador rápido do WhatsApp |
| `wa_chatid` | `string` |  | ID completo do chat no WhatsApp |
| `wa_chatlid` | `string` |  | LID do chat no WhatsApp (quando disponível) |
| `wa_archived` | `boolean` |  | Indica se o chat está arquivado |
| `wa_contactName` | `string` |  | Nome do contato no WhatsApp |
| `wa_name` | `string` |  | Nome do WhatsApp |
| `name` | `string` |  | Nome exibido do chat |
| `image` | `string` |  | URL da imagem do chat |
| `imagePreview` | `string` |  | URL da miniatura da imagem |
| `wa_ephemeralExpiration` | `integer (int64)` |  | Tempo de expiração de mensagens efêmeras |
| `wa_isBlocked` | `boolean` |  | Indica se o contato está bloqueado |
| `wa_isGroup` | `boolean` |  | Indica se é um grupo |
| `wa_isGroup_admin` | `boolean` |  | Indica se o usuário é admin do grupo |
| `wa_isGroup_announce` | `boolean` |  | Indica se é um grupo somente anúncios |
| `wa_isGroup_community` | `boolean` |  | Indica se é uma comunidade |
| `wa_isGroup_member` | `boolean` |  | Indica se é membro do grupo |
| `wa_isPinned` | `boolean` |  | Indica se o chat está fixado |
| `wa_label` | `array` |  | Labels do chat |
| `wa_notes` | `string` |  | Anotações internas do chat sincronizadas via app state |
| `wa_lastMessageTextVote` | `string` |  | Texto/voto da última mensagem |
| `wa_lastMessageType` | `string` |  | Tipo da última mensagem |
| `wa_lastMsgTimestamp` | `integer (int64)` |  | Timestamp da última mensagem |
| `wa_lastMessageSender` | `string` |  | Remetente da última mensagem |
| `wa_muteEndTime` | `integer (int64)` |  | Timestamp do fim do silenciamento |
| `owner` | `string` |  | Dono da instância |
| `wa_unreadCount` | `integer (int64)` |  | Contador de mensagens não lidas |
| `phone` | `string` |  | Número de telefone |
| `common_groups` | `string` |  | Grupos em comum separados por vírgula, formato: (nome_grupo)id_grupo Exemplo: `Grupo Família(120363123456789012@g.us),Trabalho(987654321098765432@g.us |
| `lead_name` | `string` |  | Nome do lead |
| `lead_fullName` | `string` |  | Nome completo do lead |
| `lead_email` | `string` |  | Email do lead |
| `lead_personalid` | `string` |  | Documento de identificação |
| `lead_status` | `string` |  | Status do lead |
| `lead_tags` | `array` |  | Tags do lead |
| `lead_notes` | `string` |  | Anotações sobre o lead |
| `lead_isTicketOpen` | `boolean` |  | Indica se tem ticket aberto |
| `lead_assignedAttendant_id` | `string` |  | ID do atendente responsável |
| `lead_kanbanOrder` | `integer (int64)` |  | Ordem no kanban |
| `lead_field01` | `string` |  |  |
| `lead_field02` | `string` |  |  |
| `lead_field03` | `string` |  |  |
| `lead_field04` | `string` |  |  |
| `lead_field05` | `string` |  |  |
| `lead_field06` | `string` |  |  |
| `lead_field07` | `string` |  |  |
| `lead_field08` | `string` |  |  |
| `lead_field09` | `string` |  |  |
| `lead_field10` | `string` |  |  |
| `lead_field11` | `string` |  |  |
| `lead_field12` | `string` |  |  |
| `lead_field13` | `string` |  |  |
| `lead_field14` | `string` |  |  |
| `lead_field15` | `string` |  |  |
| `lead_field16` | `string` |  |  |
| `lead_field17` | `string` |  |  |
| `lead_field18` | `string` |  |  |
| `lead_field19` | `string` |  |  |
| `lead_field20` | `string` |  |  |
| `chatbot_agentResetMemoryAt` | `integer (int64)` |  | Timestamp do último reset de memória |
| `chatbot_lastTrigger_id` | `string` |  | ID do último gatilho executado |
| `chatbot_lastTriggerAt` | `integer (int64)` |  | Timestamp do último gatilho |
| `chatbot_disableUntil` | `integer (int64)` |  | Timestamp até quando chatbot está desativado |

### `Message`

Representa uma mensagem trocada no sistema

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `id` | `string (uuid)` |  | ID único interno da mensagem (formato r + 7 caracteres hex aleatórios) |
| `messageid` | `string` |  | ID original da mensagem no provedor |
| `chatid` | `string` |  | ID da conversa relacionada |
| `sender` | `string` |  | ID do remetente da mensagem |
| `senderName` | `string` |  | Nome exibido do remetente |
| `isGroup` | `boolean` |  | Indica se é uma mensagem de grupo |
| `fromMe` | `boolean` |  | Indica se a mensagem foi enviada pelo usuário |
| `messageType` | `string` |  | Tipo de conteúdo da mensagem |
| `source` | `string` |  | Plataforma de origem da mensagem |
| `messageTimestamp` | `integer` |  | Timestamp original da mensagem em milissegundos |
| `status` | `string` |  | Status do ciclo de vida da mensagem. Exemplos comuns: `Queued`, `Canceled`, `Failed`, `Sent`, `Delivered`, `Read`. |
| `text` | `string` |  | Texto original da mensagem |
| `quoted` | `string` |  | ID da mensagem citada/respondida |
| `edited` | `string` |  | Histórico de edições da mensagem |
| `reaction` | `string` |  | ID da mensagem reagida |
| `vote` | `string` |  | Dados de votação de enquete e listas |
| `convertOptions` | `string` |  | Conversão de opções da mensagem, lista, enquete e botões |
| `buttonOrListid` | `string` |  | ID do botão ou item de lista selecionado |
| `owner` | `string` |  | Dono da mensagem |
| `error` | `string` |  | Mensagem de erro caso o envio tenha falhado |
| `content` | `` |  | Conteúdo bruto da mensagem (JSON serializado ou texto) |
| `wasSentByApi` | `boolean` |  | Indica se a mensagem foi enviada via API |
| `sendFunction` | `string` |  | Função usada para enviar a mensagem (quando enviada via API) |
| `sendPayload` | `` |  | Payload enviado (texto/JSON serializado) |
| `fileURL` | `string` |  | URL ou referência de arquivo da mensagem |
| `send_folder_id` | `string` |  | Pasta associada ao envio (quando aplicável) |
| `track_source` | `string` |  | Origem de rastreamento |
| `track_id` | `string` |  | ID de rastreamento (pode repetir) |
| `ai_metadata` | `object` |  | Metadados do processamento por IA |
| `sender_pn` | `string` |  | JID PN resolvido do remetente (quando disponível) |
| `sender_lid` | `string` |  | LID original do remetente (quando disponível) |

### `Label`

Representa uma etiqueta/categoria no sistema

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `id` | `string (uuid)` |  | ID único da etiqueta |
| `name` | `string` |  | Nome da etiqueta |
| `color` | `integer` |  | Índice numérico da cor (0-19) Exemplo: `2` |
| `colorHex` | `string` |  | Cor hexadecimal correspondente ao índice Valores: `#ff9484`, `#64c4ff`, `#fed428`, `#dfaef0`, `#9ab6c1`, `#56ccb4`, `#fe9dfe`, `#d3a91f`, `#6f7bcf`, ` |
| `labelid` | `string` |  | ID da label no WhatsApp (quando sincronizada) |
| `owner` | `string` |  | Dono da etiqueta |
| `created` | `string (date-time)` |  | Data de criação |
| `updated` | `string (date-time)` |  | Data da última atualização |

### `Attendant`

Modelo de atendente do sistema

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `id` | `string (uuid)` |  | ID único gerado automaticamente |
| `name` | `string` |  | Nome do atendente |
| `phone` | `string` |  | Número de telefone |
| `email` | `string (email)` |  | Endereço de e-mail |
| `department` | `string` |  | Departamento de atuação |
| `customField01` | `string` |  | Campo personalizável 01 |
| `customField02` | `string` |  | Campo personalizável 02 |
| `owner` | `string` |  | Responsável pelo cadastro |
| `created` | `string (date-time)` |  | Data de criação automática |
| `updated` | `string (date-time)` |  | Data de atualização automática |

### `ChatbotTrigger`

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `id` | `string` |  | Identificador único do trigger. Se definido, você irá editar ou deletar o trigger. Se vazio, um novo trigger será criado. |
| `active` | `boolean` |  | Define se o trigger está ativo e disponível para uso. Triggers inativos não serão executados pelo sistema. |
| `type` | `string` | ✅ | Tipo do trigger: * agent - aciona um agente de IA * quickreply - aciona respostas rápidas predefinidas * flow - dispara um fluxo salvo Valores: `agent |
| `agent_id` | `string` | ✅ | ID do agente de IA. Obrigatório quando type='agent' |
| `flow_id` | `string` |  | ID do fluxo. Obrigatório quando type='flow' |
| `quickReply_id` | `string` |  | ID da resposta rápida. Obrigatório quando type='quickreply' |
| `ignoreGroups` | `boolean` |  | Define se o trigger deve ignorar mensagens de grupos |
| `lead_field` | `string` |  | Campo do lead usado para condição do trigger Valores: `lead_name`, `lead_fullName`, `lead_email`, `lead_personalid`, `lead_status`, `lead_tags`, `lead |
| `lead_operator` | `string` |  | Operador de comparação para condição do lead: * equals - igual a * not_equals - diferente de * contains - contém * not_contains - não contém * greater |
| `lead_value` | `string` |  | Valor para comparação com o campo do lead. Usado em conjunto com lead_field e lead_operator |
| `priority` | `integer (int64)` |  | Prioridade do trigger. Quando existem múltiplos triggers que poderiam ser acionados, APENAS o trigger com maior prioridade será executado. Se houver m |
| `wordsToStart` | `string` |  | Palavras-chave ou frases que ativam o trigger. Múltiplas entradas separadas por pipe (|). Exemplo: olá|bom dia|qual seu nome |
| `responseDelay_seconds` | `integer (int64)` |  | Tempo de espera em segundos antes de executar o trigger |
| `owner` | `string` |  | Identificador do proprietário do trigger |
| `created` | `string (date-time)` |  | Data e hora de criação |
| `updated` | `string (date-time)` |  | Data e hora da última atualização |

### `ChatbotAIAgent`

Configuração de um agente de IA para atendimento de conversas

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `id` | `string (uuid)` |  | ID único gerado pelo sistema |
| `name` | `string` | ✅ | Nome de exibição do agente |
| `provider` | `string` | ✅ | Provedor do serviço de IA Valores: `openai`, `anthropic`, `gemini`, `deepseek`, `custom` |
| `model` | `string` | ✅ | Nome do modelo LLM a ser utilizado |
| `apikey` | `string` | ✅ | Chave de API para autenticação no provedor |
| `basePrompt` | `string` |  | Prompt base para orientar o comportamento do agente |
| `maxTokens` | `integer` |  | Número máximo de tokens por resposta |
| `temperature` | `integer` |  | Controle de criatividade (0-100) |
| `diversityLevel` | `integer` |  | Nível de diversificação das respostas |
| `frequencyPenalty` | `integer` |  | Penalidade para repetição de frases |
| `presencePenalty` | `integer` |  | Penalidade para manter foco no tópico |
| `signMessages` | `boolean` |  | Adiciona identificação do agente nas mensagens |
| `readMessages` | `boolean` |  | Marca mensagens como lidas automaticamente |
| `maxMessageLength` | `integer` |  | Tamanho máximo permitido para mensagens (caracteres) |
| `typingDelay_seconds` | `integer` |  | Atraso simulado de digitação em segundos |
| `contextTimeWindow_hours` | `integer` |  | Janela temporal para contexto da conversa |
| `contextMaxMessages` | `integer` |  | Número máximo de mensagens no contexto |
| `contextMinMessages` | `integer` |  | Número mínimo de mensagens para iniciar contexto |
| `owner` | `string` |  | Responsável/Proprietário do agente |
| `created` | `string (date-time)` |  | Data de criação do registro |
| `updated` | `string (date-time)` |  | Data da última atualização |

### `ChatbotAIFunction`

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `id` | `string` |  | ID único da função gerado automaticamente |
| `name` | `string` | ✅ | Nome da função |
| `description` | `string` | ✅ | Descrição da função |
| `active` | `boolean` |  | Indica se a função está ativa |
| `method` | `string` | ✅ | Método HTTP da requisição |
| `endpoint` | `string` | ✅ | Endpoint da API |
| `headers` | `['string', 'null']` |  | Cabeçalhos da requisição |
| `body` | `['string', 'null']` |  | Corpo da requisição |
| `parameters` | `['string', 'null']` |  | Parâmetros da função |
| `undocumentedParameters` | `string` |  | Parâmetros não documentados |
| `header_error` | `boolean` |  | Indica erro de formatação nos cabeçalhos |
| `body_error` | `boolean` |  | Indica erro de formatação no corpo |
| `owner` | `string` |  | Proprietário da função |
| `created` | `string (date-time)` |  | Data de criação |
| `updated` | `string (date-time)` |  | Data de atualização |

### `ChatbotAIKnowledge`

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `id` | `string` | ✅ | ID único gerado automaticamente Exemplo: `r1a2b3c4` |
| `active` | `boolean` | ✅ | Indica se o conhecimento está ativo |
| `tittle` | `string` | ✅ | Título do conhecimento |
| `content` | `string` | ✅ | Conteúdo textual do conhecimento |
| `vectorStatus` | `string` |  | Status da vetorização no sistema |
| `isVectorized` | `boolean` |  | Indica se o conteúdo foi vetorizado |
| `lastVectorizedAt` | `integer (int64)` |  | Timestamp da última vetorização |
| `owner` | `string` |  | Proprietário do conhecimento |
| `priority` | `integer (int64)` |  | Prioridade de uso do conhecimento |
| `created` | `string (date-time)` |  | Data de criação |
| `updated` | `string (date-time)` |  | Data de atualização |

### `MessageQueueFolder`

Pasta para organização de campanhas de mensagens em massa

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `id` | `string` |  | Identificador único |
| `info` | `string` |  | Informações adicionais sobre a pasta |
| `status` | `string` |  | Status atual da pasta Exemplo: `ativo` |
| `scheduled_for` | `integer (int64)` |  | Timestamp Unix para execução agendada |
| `delayMax` | `integer (int64)` |  | Atraso máximo entre mensagens em milissegundos |
| `delayMin` | `integer (int64)` |  | Atraso mínimo entre mensagens em milissegundos |
| `log_delivered` | `integer (int64)` |  | Contagem de mensagens entregues |
| `log_failed` | `integer (int64)` |  | Contagem de mensagens com falha |
| `log_played` | `integer (int64)` |  | Contagem de mensagens reproduzidas (para áudio/vídeo) |
| `log_read` | `integer (int64)` |  | Contagem de mensagens lidas |
| `log_sucess` | `integer (int64)` |  | Contagem de mensagens enviadas com sucesso |
| `log_total` | `integer (int64)` |  | Contagem total de mensagens |
| `owner` | `string` |  | Identificador do proprietário da instância |
| `created` | `string (date-time)` |  | Data e hora de criação |
| `updated` | `string (date-time)` |  | Data e hora da última atualização |

### `QuickReply`

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `id` | `string (uuid)` |  | ID único da resposta rápida |
| `onWhatsApp` | `boolean` |  | Indica se a resposta veio do WhatsApp (não pode ser editada/excluída) |
| `docName` | `string` |  | Nome de documento associado (quando aplicável) |
| `file` | `string` |  | Caminho ou conteúdo do arquivo associado |
| `shortCut` | `string` | ✅ | Atalho para acionar a resposta |
| `text` | `string` | ✅ | Conteúdo da mensagem pré-definida |
| `type` | `string` |  | Tipo da resposta rápida (texto/documento/outros) |
| `owner` | `string` |  | Dono da resposta rápida |
| `created` | `string (date-time)` |  | Data de criação |
| `updated` | `string (date-time)` |  | Data da última atualização |

### `Group`

Representa um grupo/conversa coletiva

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `JID` | `string (jid)` |  | Identificador único do grupo Exemplo: `jid8@g.us` |
| `OwnerJID` | `string (jid)` |  | JID do proprietário do grupo Exemplo: `1232@s.whatsapp.net` |
| `OwnerPN` | `string (jid)` |  | Número/LID do proprietário (quando disponível) |
| `Name` | `string` |  | Nome do grupo Exemplo: `Grupo de Suporte` |
| `NameSetAt` | `string (date-time)` |  | Data da última alteração do nome |
| `NameSetBy` | `string (jid)` |  | JID do usuário que definiu o nome |
| `NameSetByPN` | `string (jid)` |  | LID/PN de quem definiu o nome |
| `Topic` | `string` |  | Descrição do grupo |
| `TopicID` | `string` |  | ID interno da descrição |
| `TopicSetAt` | `string (date-time)` |  | Data da última alteração da descrição |
| `TopicSetBy` | `string (jid)` |  | JID de quem alterou a descrição |
| `TopicSetByPN` | `string (jid)` |  | LID/PN de quem alterou a descrição |
| `TopicDeleted` | `boolean` |  | Indica se a descrição foi apagada |
| `IsLocked` | `boolean` |  | Indica se apenas administradores podem editar informações do grupo - true = apenas admins podem editar - false = todos podem editar Exemplo: `True` |
| `IsAnnounce` | `boolean` |  | Indica se apenas administradores podem enviar mensagens |
| `AnnounceVersionID` | `string` |  | Versão da configuração de anúncios |
| `IsEphemeral` | `boolean` |  | Indica se as mensagens são temporárias |
| `DisappearingTimer` | `integer` |  | Tempo em segundos para desaparecimento de mensagens |
| `IsIncognito` | `boolean` |  | Indica se o grupo é incognito |
| `IsParent` | `boolean` |  | Indica se é um grupo pai (comunidade) |
| `IsJoinApprovalRequired` | `boolean` |  | Indica se requer aprovação para novos membros |
| `LinkedParentJID` | `string (jid)` |  | JID da comunidade vinculada |
| `IsDefaultSubGroup` | `boolean` |  | Indica se é um subgrupo padrão da comunidade |
| `DefaultMembershipApprovalMode` | `string` |  | Modo padrão de aprovação de membros (quando comunidade) |
| `GroupCreated` | `string (date-time)` |  | Data de criação do grupo |
| `CreatorCountryCode` | `string` |  | Código do país do criador |
| `ParticipantVersionID` | `string` |  | Versão da lista de participantes |
| `Participants` | `array` |  | Lista de participantes do grupo |
| `MemberAddMode` | `string` |  | Modo de adição de novos membros Valores: `admin_add`, `all_member_add` |
| `AddressingMode` | `string` |  | Endereçamento preferido do grupo Valores: `pn`, `lid` |
| `OwnerCanSendMessage` | `boolean` |  | Verifica se é possível você enviar mensagens |
| `OwnerIsAdmin` | `boolean` |  | Verifica se você adminstrador do grupo |
| `DefaultSubGroupId` | `string` |  | Se o grupo atual for uma comunidade, nesse campo mostrará o ID do subgrupo de avisos |
| `invite_link` | `string` |  | Link de convite para entrar no grupo |
| `request_participants` | `string` |  | Lista de solicitações de entrada, separados por vírgula |

### `GroupParticipant`

Participante de um grupo

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `JID` | `string (jid)` |  | Identificador do participante |
| `LID` | `string (jid)` |  | Identificador local do participante |
| `PhoneNumber` | `string (jid)` |  | Número do participante (quando disponível) |
| `IsAdmin` | `boolean` |  | Indica se é administrador |
| `IsSuperAdmin` | `boolean` |  | Indica se é super administrador |
| `DisplayName` | `string` |  | Nome exibido no grupo (para usuários anônimos) |
| `Error` | `integer` |  | Código de erro ao adicionar participante |
| `AddRequest` | `object` |  | Informações da solicitação de entrada |

### `WebhookEvent`

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `event` | `string` | ✅ | Tipo do evento recebido Valores: `message`, `status`, `presence`, `group`, `connection` |
| `instance` | `string` | ✅ | ID da instância que gerou o evento |
| `data` | `object` | ✅ | Payload do evento enviado pelo webhook. O formato varia conforme o tipo do evento (messages, messages_update, connection, presence, etc) e segue o que |

---

*Documentação gerada a partir da especificação OpenAPI 3.1.0 — uazapiGO - WhatsApp API v2.0.1*