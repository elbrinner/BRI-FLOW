# Plan de Integración de Agentes (microsoft/agent-framework)

Este documento propone cómo integrar un sistema multi‑agente con streaming en la plataforma EIRA (BRI‑FLOW + backend .NET + frontend Angular), usando Microsoft Agent Framework para .NET y Azure AI Search, con seguridad por variables/identidades gestionadas.

Instalación (preview) en .NET: agregar paquetes NuGet del Agent Framework y Azure AI Foundry/OpenAI según el modelo elegido. Usa versiones prerelease.

Opcional (ejemplo genérico, ajustar IDs reales de paquetes cuando confirmemos el namespace):

```
dotnet add package Microsoft.Agent --prerelease
dotnet add package Microsoft.Agent.Workflows --prerelease
dotnet add package Microsoft.Agent.AzureAI --prerelease
dotnet add package Azure.Identity
dotnet add package Azure.Search.Documents
```

## Objetivos

- Incorporar agentes (roles especializados) orquestados mediante microsoft/agent-framework.
- Habilitar salida por streaming (SSE/WebSocket) hacia el frontend.
- Permitir comunicación entre agentes (coordinador ↔ expertos ↔ herramientas).
- Integrar recuperación de conocimiento con Azure AI Search como herramienta del agente.
- Gestionar variables y secretos de forma segura (env/Key Vault/Managed Identity).
- Exponer contratos de API claros para que BRI‑FLOW y el frontend los consuman.

## Estado y checklist (29/10/2025)

Resumen ejecutivo: consolidamos un único endpoint `/api/chat` con negociación SSE/JSON, un orquestador de agentes en .NET, una herramienta de búsqueda Azure AI Search (semantic/vector/hybrid) y un generador de embeddings resiliente. Seguridad con perfiles de credenciales y allow‑lists. Paquetes estabilizados y tests en verde.

Checklist de implementación

- [x] Endpoint unificado `/api/chat` con negociación por `Accept` (SSE `text/event-stream` y JSON)
- [x] Controlador que enruta peticiones de “agentes” cuando `Content-Type: application/vnd.agent+json`
- [x] Orquestador `IAgentOrchestrator/AgentOrchestrator` con hilos en memoria y eventos de herramienta
- [x] Tool `AiSearchTool` (Azure.Search.Documents) con modos `keyword | semantic | vector | hybrid`
  - [x] `QueryType = Semantic` para `semantic/hybrid`
  - [x] `SemanticConfigurationName` aplicado por reflexión (SDK pinned 11.7.0)
  - [x] Soporte vector/hybrid con `KNN` y `Fields` vía tipos vectoriales por reflexión (compatibilidad SDK)
  - [x] `BuildOptionsSummary` para probar las decisiones sin acoplar a tipos del SDK
- [x] Generador de embeddings `IEmbeddingGenerator/EmbeddingGenerator` (Azure OpenAI/OpenAI HTTP)
  - [x] Manejo de errores/timeout: devuelve `null` en `TaskCanceledException`/`HttpRequestException`
  - [x] Orquestador genera embeddings “on‑the‑fly” si faltan en `vector/hybrid`
- [x] Seguridad: `ICredentialProfileResolver` + `IAgentProfileProvider`; allow‑lists de índices y participantes; deny‑by‑default
- [x] Paquetes y pinning:
  - [x] `Azure.Search.Documents` 11.7.0 (pinned por disponibilidad de feed)
  - [x] `Azure.Security.KeyVault.Secrets` 4.7.0 (actualizado, elimina NU1603)
  - [x] `Azure.Identity` 1.12.0
- [x] Tests unitarios:
  - [x] Búsqueda: mapeos de `semantic/vector/hybrid` validados vía `BuildOptionsSummary`
  - [x] Propagación de `SemanticConfiguration` en el summary
  - [x] Orquestador: auto‑generación de vector cuando falta
  - [x] Embeddings HTTP: OK/401/timeout
- [x] Frontend Angular: servicio `AgentService` con `streamChat` (fetch + ReadableStream) y `run`
- [x] Documentación inicial (`plan_agente.md`) de arquitectura, contratos y buenas prácticas

### Actualización 30/10/2025 — BRI‑FLOW como única fuente de verdad (inline‑only)

- Decisión: los agentes se definen en el propio flujo/nodo (`agent_call`) y el backend ejecuta según esa configuración inline. No se utilizará un registro/CRUD central de agentes en este proyecto.
- Cambios aplicados:
  - Simulador y editor: eliminado el modo `agentId` en el panel del nodo; sólo queda configuración inline (perfil, system prompt, modelo, búsqueda, runtime, participantes).
  - Backend `/api/chat`: el campo `AgentId` (si llegase) se ignora; la definición efectiva es la del payload inline.
  - Endpoints `/api/agents`: se mantienen ocultos en Swagger (IgnoreApi=true) y marcados como “no usados”. Pueden re‑activarse en el futuro si se necesitara gobernanza centralizada.
  - Seguridad: se mantiene enforcement por perfil (allow‑lists de índices y participantes) y deny‑by‑default sin cambios.

> Aviso importante
>
> - Inline‑only: el backend ignora `AgentId` y sólo ejecuta configuraciones provistas en el payload. Los endpoints de agentes quedan fuera de uso en esta fase.
> - Migración planeada: cuando el feed permita `Azure.Search.Documents >= 11.8.0`, migraremos a `SemanticConfigurationName` tipado (hoy aplicado por reflexión en 11.7.0). Ver “Guía de migración” al final.

#### Checklist operativo (30/10/2025)

- [x] Botón “Probar” en el modal del simulador (estado inline + mensaje en chat)
- [x] Nodo `agent_call` en modo inline‑only (selector `agentId` eliminado y backend lo ignora)
- [x] Smoke test rápido del simulador (Probar/llamada mínima) — OK (JSON y SSE verificados)
- [x] Indicador persistente de conectividad al abrir el modal
- [ ] Tests backend para inline `agent_call` (SSE y JSON, allow‑lists, `threadId`)

### Configuración rápida en appsettings (Azure OpenAI y Azure AI Search)

Para usar credenciales reales sin tocar código, pega tus valores en estos bloques de configuración del backend (`egoverabot-assistant`):

- `appsettings.Development.json` (local) y/o `appsettings.json` (otros entornos):
  - `AzureOpenAI: Endpoint, ApiKey, ApiVersion, ChatDeployment, EmbeddingsDeployment`
  - `AzureSearch: Endpoint, ApiKey, DefaultIndex, SemanticConfiguration`

El perfil `Agent.DefaultProfile` ya referencia estas claves vía el resolvedor de credenciales, así que no necesitas modificarlas en código ni en el flujo:

- Mapeos usados por el backend (no pegues secretos en el flujo):
  - `aoai_endpoint` ← `AzureOpenAI:Endpoint`
  - `aoai_api_key` ← `AzureOpenAI:ApiKey`
  - `aoai_api_version` ← `AzureOpenAI:ApiVersion`
  - `aoai_embeddings_deployment` ← `AzureOpenAI:EmbeddingsDeployment`
  - `ai_search_endpoint` ← `AzureSearch:Endpoint`
  - `ai_search` ← `AzureSearch:ApiKey`
  - `ai_search_default_index` ← `AzureSearch:DefaultIndex`
  - `ai_search_semantic_config` ← `AzureSearch:SemanticConfiguration`

Notas:
- El orquestador usará `ai_search_default_index` si el flujo no especifica `search.index|indexes`.
- Las allow‑lists siguen aplicando: sólo índices listados en `Agent:Profiles:default:AllowedSearchIndexes` serán utilizados.
- En cloud, recomienda usar Key Vault/Managed Identity; estas claves son para desarrollo/local.

#### Ejemplo rápido: llamada inline a `/api/chat` (JSON y SSE)

Request (contenido mínimo recomendado):

```json
{
  "sessionId": "sess-123",
  "message": "Requisitos para renovar la licencia",
  "agent": "coordinator",
  "agent_profile": "rag",
  "model": { "provider": "azure-openai", "deployment": "gpt-4o-mini", "temperature": 0.3 },
  "search": {
    "mode": "hybrid",
    "indexes": ["tramites-es"],
    "semanticConfiguration": "semantic-config-es",
    "topK": 5,
    "queryLanguage": "es"
  },
  "runtime": { "timeout_ms": 30000 }
}
```

- Para streaming, enviar el header `Accept: text/event-stream`.
- Para respuesta completa, omitir ese header (se devuelve JSON non‑stream).

SSE típico:

```
data: {"type":"tool","name":"ai_search","args":{"query":"Requisitos…"}}
data: {"type":"text","text":"Debe presentar…"}
data: {"type":"done","usage":{"promptTokens":123,"completionTokens":456}}
```

Respuesta JSON (non‑stream):

```json
{
  "text": "Debe presentar su documento…",
  "citations": [
    { "source": "https://contoso.gov/licencias", "score": 0.87 }
  ],
  "usage": { "promptTokens": 123, "completionTokens": 456, "totalTokens": 579 },
  "threadId": "thr-abc"
}
```


### Pendiente destacado

- [ ] Migrar a `SemanticConfigurationName` tipado cuando el feed permita `Azure.Search.Documents >= 11.8.0`
- [ ] Validación E2E contra índice real de Azure AI Search con `semanticConfiguration` y verificación SSE en `/api/chat`
- [ ] Reparar pruebas de Angular (ajustes en specs y exports de componentes) en `egoverabot-frontend-1`
- [ ] Fan‑out multi‑índice con normalización/merge/deduplicación en `AiSearchTool` (si aplica al alcance)

Pendiente / siguientes pasos

- [ ] Migrar a `SemanticConfigurationName` tipado cuando el feed permita `Azure.Search.Documents >= 11.8.0` (ver guía abajo)
- [ ] E2E con índice real de Azure AI Search (semantic config activa) y validación de SSE en `/api/chat`
- [ ] Reparar specs de Angular que fallan (AppComponent title; exports de componentes en tests)
- [ ] Fan‑out multi‑índice con normalización/merge/deduplicación en `AiSearchTool` (si aplica al alcance)
- [ ] Persistencia de threads (en almacenamiento) si se requiere memoria de largo plazo
- [ ] Métricas y trazabilidad (tokens/latencias) y límites de cuota por sesión
- [ ] Despliegue con Managed Identity y validación de Key Vault en cloud

## Arquitectura propuesta (alto nivel)

- Front Angular (egoverabot-frontend-1)
  - Componente de chat compatible con streaming (SSE por defecto).
- Backend .NET (egoverabot-assistant)
  - Aloja el “Agent Orchestrator” con microsoft/agent-framework para .NET (sin microservicio externo).
  - Reutiliza el endpoint existente `/api/chat` con negociación por `Accept` para SSE (`text/event-stream`) o JSON (non‑stream).
  - Usa Azure AI Search como Tool (SDK .NET) y modelos en Azure AI Foundry/Azure OpenAI.

```
Angular ──SSE──▶ egoverabot-assistant (.NET, Agent Framework)
                            │
                            └──────── Azure AI Search (tool de recuperación)
```

## Roles/agentes sugeridos

- Planner/Coordinator: entiende la intención y decide a quién delegar.
- RetrievalAgent (RAG): consulta Azure AI Search y sintetiza evidencias.
- DomainExpert(s): lógicas específicas (trámites, normativa, FAQs, etc.).
- ToolingAgent: encapsula llamadas externas (REST corporativo, MCP, etc.).

Patrones soportados por agent-framework: group chat (coordinador + expertos), handoff, fan‑out/fan‑in, reflexión, bucles controlados.

## Perfiles de agente: normal vs RAG

Para simplificar el diseño y el uso desde BRI‑FLOW, definimos dos perfiles funcionales preconfigurados de agente, además de los roles internos (Coordinator/Retrieval/DomainExpert):

- Agente normal (chat): no usa recuperación externa. Ideal para conversación general, lógica determinista y tareas que no requieren documentos.
- Agente RAG (con AI Search): siempre intenta recuperar evidencias desde Azure AI Search antes de responder y cita fuentes.

Elección en `agent_call`:
- `agent_profile: "normal"` → no se usa `ai_search` (equivale a `search.retrievalPolicy = "never"`).
- `agent_profile: "rag"` → se usa `ai_search` con `retrievalPolicy = "always"` y se exige configurar `search.index|indexes` y `search.mode` válidos.
- Para escenarios avanzados, puedes seguir usando `mode/participants` y orquestación multi‑agente, pero estos dos perfiles cubren el 80% de los casos.

Compatibilidad con `tools`:
- Si `agent_profile = "rag"`, el backend puede añadir automáticamente la tool `ai_search` aunque no se declare en `tools` para robustez.
- Si `agent_profile = "normal"`, cualquier `search` presente será ignorado salvo que se fuerce explícitamente con overrides (no recomendado).

## Herramienta: Azure AI Search (RAG)

- Uso como Tool del agente para enriquecer contexto con pasajes citables.
- Implementación en .NET con `Azure.Search.Documents` y autenticación con `Azure.Identity` dentro de una Tool del agente:
  - Entrada: `query`, filtros (opcional), topK, semantic configuration.
  - Salida: lista de fragmentos con `content`, `score`, `source` y metadatos.
- Autenticación: `DefaultAzureCredential` (Managed Identity en cloud, dev con Visual Studio/CLI).

Notas de versión (SDK)

- Versión actual en backend: `Azure.Search.Documents` 11.7.0 (pin). En esta versión no exponemos la propiedad tipada `SemanticConfigurationName`; se asigna por reflexión cuando existe en tiempo de ejecución. Al actualizar el feed a ≥ 11.8.0, seguir la guía de migración abajo para usar la propiedad tipada y retirar el path reflectivo.

### Configuración avanzada de búsqueda

- Modos soportados:
  - `keyword` clásico: `queryType: simple` (o `full`) con OData filter y scoring profile.
  - `semantic`: `queryType: semantic` + `semanticConfiguration: <nombre>`; opcional `answers`, `captions`.
  - `vector`: requiere índice con campos vectoriales; parámetros: `vector`, `vectorFields`, `topK`, `filter`.
  - `hybrid`: combinación de `keyword/semantic` + `vector`; se fusionan resultados (p. ej. ponderación 50/50 o re‑rank por score).
- Selección de índice(s):
  - `index`: string para un índice.
  - `indexes`: array para multi‑índice (fan‑out); el backend ejecuta en paralelo y agrega resultados con normalización de score y deduplicación (por `source`/`documentId`).
- Parámetros comunes:
  - `topK`, `skip`, `filter` (OData), `select` (campos a retornar), `highlight/captions`, `answers`, `queryLanguage` (es, en, …), `scoringProfile`.
- Semántica:
  - Requiere habilitar `semanticConfiguration` en el índice (en Azure Portal o IaC) con campos `content`/`title`.
  - Opciones: `answers: 'extractive|generative'`, `captions: 'extractive'`, `answersCount`, `captionsHighlightEnabled`.
- Vectorial:
  - Campos vectoriales definidos (p. ej. `contentVector`), configuración de vector store, dimensiones.
  - Necesitas embeddings (Azure OpenAI) y pipeline de indexación; el Tool puede aceptar `embeddingModel` para on‑the‑fly si procede (preferible pre‑indexado).

Ejemplo de entrada para la Tool (backend valida/filtra):

```json
{
  "query": "requisitos renovación licencia",
  "mode": "hybrid",
  "index": "tramites-es",
  "indexes": ["tramites-es", "faq-ciudadania"],
  "semanticConfiguration": "semantic-config-es",
  "topK": 5,
  "filter": "category eq 'transito'",
  "select": ["title","content","source","url"],
  "queryLanguage": "es"
}
```

Agregación multi‑índice (backend):
- Ejecutar consultas en paralelo, normalizar `score` por índice (min‑max o z‑score), fusionar por mayor score, deduplicar por `url`/`id`, truncar a `topK` final.
- Controlar límites de QPS con throttle para evitar 429.

### Cambios respecto a búsquedas normales

- `semantic` aporta comprensión del enunciado y mejor ranking; requiere `semanticConfiguration` activa.
- `vector/hybrid` mejoran recall en consultas vagas; implican costo de generación y almacenamiento de embeddings.
- `answers/captions` devuelven snippets y respuestas extractivas; útiles para citar fragmentos en la respuesta del agente.
- Para RAG estable, recomendamos `hybrid` (vector + semantic) y devolver siempre `citations` con `source/url`.

### Cómo consume el agente los resultados de AI Search

Pipeline del Agente RAG (resumen):
1) Formar la consulta a partir de `message` (+ `context`), idioma y políticas de filtrado.
2) Ejecutar búsqueda según `search.mode` e índices (multi‑índice con fan‑out/merge si procede).
3) Seleccionar pasajes top‑K y construir un bloque de evidencias (citations) con `{content, url/source, score}`.
4) Inyectar un prompt de grounding: “Responde SÓLO con base en las evidencias. Si no alcanzan, dilo. Cita las fuentes.”
5) Generar la respuesta con el modelo configurado y adjuntar `citations` en salida y/o streaming.

Plantilla de system prompt (sugerencia):

```
Eres un asistente que responde estrictamente basado en las evidencias proporcionadas.
Instrucciones:
- Si la pregunta no está respondida por las evidencias, indica que no hay suficiente información.
- Resume y organiza la respuesta en viñetas claras.
- Cita las fuentes entre paréntesis al final de cada punto: (Fuente: <url o título>).
```

Notas de implementación:
- Si `search.answers`/`captions` están activos, puedes incluir esos snippets como parte de las evidencias.
- En `rag`, el stream puede alternar eventos `tool` (búsqueda) y `text` (tokens de la respuesta), y enviar las `citations` al final del stream.

## Streaming end-to-end

- En .NET: usar `agent.RunStream(...)` (o equivalente en .NET) y emitir SSE `text/event-stream` con chunks `{type, text, tool_calls, done}` directamente desde el controlador.
- En Angular: `EventSource` o `fetch` + `ReadableStream` para pintar tokens incrementales en UI.

## Contratos de API propuestos

Recomendación: reutilizar el endpoint existente `/api/chat` y extender su contrato en lugar de crear rutas nuevas, salvo que exista una razón operativa para separarlas (p. ej., permisos distintos o despliegue independiente).

1) SSE (recomendado)

- `POST /api/chat` (egoverabot-assistant)
  - Content negotiation: si el cliente envía `Accept: text/event-stream`, el backend responde en SSE; si no, responde JSON (modo non‑stream).
  - Body JSON:
    - `sessionId` (string) – sesión de usuario.
    - `message` (string) – prompt del usuario.
    - `context` (obj) – variables de flujo (del BRI‑FLOW/FlowSession) opcional.
    - `tools` (arr) – habilitadas (e.g. `ai_search`).
    - `agent` (string) – perfil/rol (opcional, por defecto “coordinator” o según `agent_profile`).
    - `mode`, `participants`, `model`, `system_prompt`, `search`, `runtime` – campos opcionales descritos antes.
  - Eventos SSE cuando `Accept: text/event-stream`:
    - `data: {type:"text", text:"..."}` – tokens parciales.
    - `data: {type:"tool", name:"ai_search", args:{...}}` – trazas de herramientas (opcional).
    - `data: {type:"done", usage:{promptTokens, completionTokens}}` – cierre.

2) Non‑stream (mismo endpoint)

- `POST /api/chat`
  - Body: igual que arriba.
  - Respuesta JSON: `{ text, citations?, steps?, usage }`.

3) Estado/Hilo

<!-- Eliminado en modo inline-only: no hay API de agentes ni hilos externos expuestos -->

## Integración con BRI‑FLOW (editor y simulador)

- Nuevo nodo `agent_call` (o extender `rest_call` con modo streaming):
  - Props: `provider: "agent_service"`, `stream: true`, `save_as`, `tooling: ["ai_search"]`, `agent_profile`.
  - Simulador: si `stream` es true y URL es SSE, mostrar tokens en tiempo real en la UI del simulador.
- Mapeo de variables:
  - Enviar `context` desde variables del flujo; recibir `text` y `citations` y guardarlos en `save_as`.
  - Opcional: guardado de `usage` para métricas.

### Selección de índices y modo desde BRI‑FLOW

En el nodo `agent_call` se pueden definir parámetros de intención (sin secretos):

- `search_index: string` o `search_indexes: string[]` (multi‑índice).
- `search_mode: "keyword" | "semantic" | "vector" | "hybrid"`.
- `semantic_config: string`, `topK: number`, `filter: string (OData)`, `select: string[]`, `language: string`.

El backend validará estos parámetros contra una allow‑list de índices y configuraciones permitidas.

### Simulador: comportamiento de credential profiles

**Sin nodo `credential_profile` configurado**:
- El simulador usa mocks automáticos para todas las herramientas.
- Ejemplo: `ai_search` → respuesta mock sintética, `openai` → texto generado localmente.

**Con nodo `credential_profile` configurado**:
- El simulador usa las credenciales reales definidas en el nodo.
- Las peticiones van al backend con esas credenciales en headers o body (según diseño backend).
- El backend las valida y llama a servicios reales (Azure Search, OpenAI, etc.).

**Variable global alternativa** (sin nodo):
```js
window.SIM_CREDENTIAL_PROFILES = {
  "testing-real": {
    "ai_search": "real-key",
    "openai": "real-key"
  }
};
```

Si existe esta variable, el simulador la usa automáticamente para el perfil especificado en nodos `agent_call`/`rest_call`.

### Backend .NET: resolución de credential profiles

Servicio propuesto:

```csharp
public interface ICredentialProfileResolver {
  Task<Dictionary<string, string>> ResolveProfileAsync(string profileName, CancellationToken ct);
  Task<string> ResolveToolCredentialAsync(string profileName, string toolName, CancellationToken ct);
}
```

Implementación:
- Lee configuración de perfiles desde `appsettings.json` o Key Vault.
- Cada perfil mapea herramientas → fuentes (App Settings name o Key Vault secret).
- Cache en memoria (5–15 min) con invalidación por cambio de configuración.
- Nunca loggear valores resueltos.
- Resolución completamente interna; no expone endpoints para consultar credenciales.

### Configuración backend (ejemplo)

```json
{
  "Security": {
    "CredentialProfiles": {
      "default": {
        "ai_search": { "source": "app_settings", "name": "AzureSearch__ApiKey" },
        "openai":    { "source": "app_settings", "name": "OpenAI__ApiKey" }
      },
      "search-prod": {
        "ai_search": { "source": "key_vault", "secret": "secrets/search-prod-key" }
      },
      "testing": {
        "ai_search": { "source": "key_vault", "secret": "secrets/search-test-key" },
        "openai":    { "source": "key_vault", "secret": "secrets/openai-test-key" }
      }
    }
  }
}
```

Notas:
- En cloud, no guardar secretos aquí; los valores apuntan a nombres en App Settings o Key Vault.
- `source: "app_settings"` → `IConfiguration[name]`.
- `source: "key_vault"` → `SecretClient.GetSecretAsync(secret)` con `DefaultAzureCredential`.

### Reglas de exportación

Al exportar flujo:
- Nodos `credential_profile` se **eliminan automáticamente**.
- Nodos `agent_call`/`rest_call` ya NO incluyen `credential_profile` a nivel de nodo.
- Advertencia si se detectan credenciales en variables globales del simulador.

Notas sobre el Panel de Simulación (opción C):
- La configuración del panel no se exporta ni persiste; sólo afecta a la ejecución en simulador.
- Si desde el panel se fija el perfil global, se guarda de forma segura en `meta.default_credential_profile` y eso sí queda en el JSON exportado.

### Ejemplos de uso

1) Flujo con perfil default (producción):

```json
{
  "type": "agent_call",
  "tooling": ["ai_search"],
  "message": "¿Qué necesito para renovar?",
  "save_as": "respuesta"
}
```

Backend resuelve `"default"` → credenciales desde App Settings/Key Vault según configuración.

2) Flujo con perfil testing (simulador con credenciales reales):

```json
[
  {
    "type": "credential_profile",
    "profile": "testing-real",
    "credentials": {
      "ai_search": "paste-your-test-key-here",
      "openai": "paste-your-openai-key-here"
    },
    "__sim_only": true
  },
  { "type": "use_profile", "profile": "testing-real" },
  {
    "type": "agent_call",
    "tooling": ["ai_search"],
    "message": "¿Qué necesito para renovar?",
    "save_as": "respuesta"
  }
]
```

Simulador usa las credenciales del nodo `credential_profile` para hacer llamadas reales; `use_profile` fija el nombre. Al exportar, solo queda:

```json
{
  "type": "use_profile",
  "profile": "testing-real"
}
```

3) Flujo con mocks (sin configuración):

```json
{
  "type": "agent_call",
  "tooling": ["ai_search"],
  "message": "¿Qué necesito para renovar?",
  "save_as": "respuesta"
}
```

Simulador sin nodo `credential_profile` ni `window.SIM_CREDENTIAL_PROFILES` → usa mocks automáticos.

4) Agente normal (sin búsqueda):

```json
{
  "type": "agent_call",
  "agent_profile": "normal",
  "message": "Explícame el proceso en 3 pasos",
  "model": { "provider": "azure-openai", "deployment": "gpt-4o-mini", "temperature": 0.2 },
  "save_as": "r_normal"
}
```

5) Agente RAG (con AI Search):

```json
{
  "type": "agent_call",
  "agent_profile": "rag",
  "tooling": ["ai_search"],
  "message": "Requisitos para renovar licencia de conducir",
  "model": { "provider": "azure-openai", "deployment": "gpt-4o-mini", "temperature": 0.3 },
  "search": {
    "mode": "hybrid",
    "indexes": ["tramites-es"],
    "semanticConfiguration": "semantic-config-es",
    "topK": 5,
    "queryLanguage": "es"
  },
  "save_as": "r_rag"
}
```

### Buenas prácticas

4) Fijar perfil en flujo (exportable) y configurar modelo y búsqueda

```json
[
  { "type": "use_profile", "profile": "prod" },
  {
    "type": "agent_call",
    "save_as": "r1",
    "tooling": ["ai_search"],
    "model": {
      "provider": "azure-openai",
      "deployment": "gpt-4o-mini",
      "endpoint": "https://aoai-contoso.openai.azure.com/",
      "temperature": 0.3,
      "max_tokens": 600,
      "response_format": "text"
    },
    "system_prompt": "Sé conciso, devuelve pasos con viñetas",
    "search": {
      "mode": "hybrid",
      "indexes": ["tramites-es"],
      "semanticConfiguration": "semantic-config-es",
      "topK": 5,
      "answers": "extractive",
      "captions": "extractive",
      "queryLanguage": "es"
    }
  }
]
```

- Usar perfil `"default"` en producción con Managed Identity o Key Vault.
- Crear perfiles `"dev"`, `"staging"`, `"prod"` según ambientes.
- En simulador, usar nodo `credential_profile` solo temporalmente para testing; eliminar antes de commit.
- Rotar secretos en Key Vault; el backend detecta cambio de versión automáticamente.
- Nunca loggear credenciales resueltas en backend.

## Gestión de credenciales: Credential Profiles

### Concepto

En lugar de nodos explícitos para cada secreto, los nodos que requieren credenciales (como `agent_call`, `rest_call`) **declaran qué perfil de credencial usan** y el backend lo resuelve automáticamente desde App Settings o Key Vault.

Ventajas:
- **Simplicidad**: 1 campo en lugar de 3 pasos (nodo → variable → referencia).
- **Seguridad por defecto**: credenciales nunca viajan al cliente; resolución siempre en backend.
- **Testing flexible**: el simulador permite override local para pruebas con valores reales, sin guardarlos en el flujo.
- **Escalabilidad**: agregar/rotar credenciales no requiere cambiar flujos, solo configuración backend.

### Nodo `credential_profile` (simulador only)

Nodo especial que **solo existe en el simulador** para configurar credenciales locales de prueba. No se exporta al flujo final.

Propósito:
- Permitir al diseñador probar flujos con credenciales reales localmente.
- Definir qué perfil usar para un scope del flujo (p. ej., testing vs producción).
- Configurar mocks personalizados por herramienta.

Esquema del nodo:

```json
{
  "type": "credential_profile",
  "profile": "testing-real",
  "credentials": {
    "ai_search": "tu-clave-local-search",
    "openai": "tu-clave-local-openai"
  },
  "__sim_only": true
}
```

Comportamiento:
- **Editor**: muestra advertencia "Este nodo solo funciona en simulador. No se exportará."
- **Simulador**: usa estos valores para el profile especificado; los guarda en memoria (no localStorage).
- **Exportación**: este nodo se **elimina automáticamente** al exportar; el flujo exportado solo contiene referencias a perfiles sin valores.

UI del nodo en editor:

### Nodo `use_profile` (exportable)

Cuando quieras fijar explícitamente el perfil activo dentro del flujo (opción A), usa el nodo `use_profile`.

Objetivo:
- Establecer el perfil de credenciales que aplicará a los nodos siguientes, hasta que otro `use_profile` lo cambie.
- Este nodo se exporta tal cual, pero solo contiene el nombre del perfil (nunca valores).

Esquema:

```json
{ "type": "use_profile", "profile": "prod" }
```

Alcance y precedencia:
- El `profile` fijado por `use_profile` prevalece sobre `meta.default_credential_profile` mientras esté en vigor.
- No existe `credential_profile` a nivel de nodo; la selección es global por `use_profile` o `meta`, con fallback a "default" en backend.

Notas:
- Coloca un `use_profile` al inicio para todo el flujo y opcionalmente otros en secciones específicas.
- Para pruebas locales con claves reales en simulador, el nodo `credential_profile` (sim-only) sigue disponible y no se exporta.

### Ámbito y precedencia de perfiles

Para simplificar el uso en BRI‑FLOW y mantener seguridad por defecto, los perfiles se resuelven así:

1) Meta del flujo (global)
- Campo en la metadata del flujo: `meta.default_credential_profile`.
- Aplica a todos los nodos si no hay un `use_profile` más cercano.

2) Nodo `use_profile` (exportable)
- Campo: `{ "type": "use_profile", "profile": "..." }`.
- Aplica a los nodos siguientes hasta que otro `use_profile` lo cambie.

Precedencia efectiva por nodo:
`use_profile.profile` más cercano > `meta.default_credential_profile` > "default" (fallback en backend).

Ejemplo (fragmento de un flujo):

```json
{
  "meta": {
    "default_credential_profile": "prod"
  },
### Panel de simulación de perfiles (opción C, sin nodo)

Para simplificar, el editor incluirá un panel global de simulación (sin crear nodos) donde:

- Fijas el perfil global del flujo: escribe `meta.default_credential_profile`.
- Pega credenciales locales por perfil y herramienta (p. ej., `prod.openai`, `prod.ai_search`).
- Todo se guarda sólo en memoria del simulador (no localStorage); al recargar se pierde.
- No afecta al JSON exportado salvo el valor seguro de `meta.default_credential_profile`.

Comportamiento en simulación:
- Si el flujo usa `meta.default_credential_profile = "prod"` y en el panel hay valores para `prod`, el simulador usará esos valores locales.
- Si no hay valores locales para ese perfil/herramienta, cae a mocks.
- Sigue aplicando la precedencia descrita arriba (`use_profile` > `meta` > "default").

Compatibilidad con nodo opcional:
- El panel cubre el caso general. Si necesitas scope limitado (sólo parte del flujo), puedes usar el nodo `credential_profile` (sim-only) como override local de ese tramo durante simulación; no se exporta.

Guía rápida en simulador (opción C):
1) Abre “Simulación → Perfiles”. Selecciona el perfil global (crea/actualiza `meta.default_credential_profile`).
2) Pega las claves locales por herramienta para ese perfil.
3) Ejecuta el flujo: los nodos consumirán ese perfil automáticamente; si falta una herramienta, se usará mock.

  "nodes": [
    { "type": "agent_call", "save_as": "a1" },
    { "type": "use_profile", "profile": "staging" },
    { "type": "agent_call", "save_as": "a2" },
    { "type": "use_profile", "profile": "prod" },
    { "type": "agent_call", "save_as": "a3" }
  ]
}
```

En el ejemplo:
- `a1` usa `prod` por meta global.
- `a2` usa `staging` por `use_profile`.
- `a3` usa `prod` por `use_profile` previo.
```
┌─ Credential Profile (Simulator Only) ──────┐
│ ⚠️  For local testing only – not exported  │
│                                             │
│ Profile name: [testing-real]                │
│                                             │
│ Credentials:                                │
│ ┌─────────────────────────────────────────┐ │
│ │ Tool         │ Value (local only)       │ │
│ ├─────────────────────────────────────────┤ │
│ │ ai_search    │ [paste key]              │ │
│ │ openai       │ [paste key]              │ │
│ │ + Add tool                               │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ 🔒 Values stored in memory only             │
│ 📤 Auto-removed on export                   │
└─────────────────────────────────────────────┘
```

### Uso en otros nodos

Nodos como `agent_call` y `rest_call` no incluyen secretos ni el nombre de perfil; el backend aplica el perfil global activo o `default`.

```json
{
  "type": "agent_call",
  "tooling": ["ai_search"],
  "save_as": "respuesta_agente"
}
```

- Producción: el backend resuelve el perfil por `use_profile` más cercano o `meta.default_credential_profile`; si ninguno está presente, usa `"default"`.
- Simulador sin overrides: usa mocks automáticos.
- Simulador con nodo `credential_profile` (sim-only): usa los valores definidos localmente para el perfil activo.

### Variables en BRI‑FLOW (no secretas)

En BRI‑FLOW, los nodos guardan resultados con `save_as` y el resto del flujo puede referenciarlos:

- Guardar: un nodo `agent_call` con `save_as: "respuesta_agente"` producirá variables como `respuesta_agente.text`, `respuesta_agente.citations`, `respuesta_agente.usage`.
- Usar: en plantillas/propiedades, referencia con `${respuesta_agente.text}` o asigna con `assign_var`.
- Importante: las credenciales NUNCA se guardan como variables; sólo viaja el nombre del perfil (string). Los valores reales se resuelven en backend.

Ejemplo mínimo de encadenamiento:

```json
[
  { "type": "agent_call", "message": "Hola", "save_as": "r1" },
  { "type": "response", "text": "El agente dijo: ${r1.text}" }
]
```

Soporte para múltiples instancias por herramienta:
- El perfil puede incluir metadatos no secretos por herramienta (endpoint, deployment, región) además de la referencia a secreto.

Ejemplo (backend):

```json
{
  "Security": {
    "CredentialProfiles": {
      "prod": {
        "openai": { "source": "key_vault", "secret": "kv://openai/prod-key", "endpoint": "https://aoai-contoso.openai.azure.com/", "deployment": "gpt-4o-mini" },
        "ai_search": { "source": "app_settings", "name": "AzureSearch__ApiKey", "endpoint": "https://search-contoso.search.windows.net" }
      },
      "staging": {
        "openai": { "source": "key_vault", "secret": "kv://openai/staging-key", "endpoint": "https://aoai-stg.openai.azure.com/", "deployment": "gpt-4o-mini" }
      },
      "openai-eu2": {
        "openai": { "source": "key_vault", "secret": "kv://openai/eu2-key", "endpoint": "https://aoai-eu2.openai.azure.com/", "deployment": "gpt-4o-mini" }
      }
    }
  }
}
```

Al resolver una llamada, el backend aplica la precedencia indicada y selecciona para cada tool el perfil efectivo (por `use_profile` o meta). Los metadatos no secretos se usan para construir el cliente (endpoint/deployment), el secreto se obtiene de App Settings/Key Vault.

Fallback de usabilidad (requerido):
- Si tras aplicar la precedencia no se obtiene ningún perfil, el backend usará siempre "default" y registrará una advertencia.

Exportar con meta global:
- Si `meta.default_credential_profile` está presente, se mantiene tal cual en el JSON exportado.
 

Ejemplo antes (simulador):

```json
[
  { "type": "credential_profile", "profile": "testing-real", "credentials": { "openai": "paste-here" }, "__sim_only": true },
  { "type": "agent_call", "save_as": "r1" }
]
```

Después (exportado):

```json
{
  "meta": { "default_credential_profile": "testing-real" },
  "nodes": [ { "type": "agent_call", "save_as": "r1" } ]
}
```

### Nodo avanzado (opcional): `secure_value`

Para casos de uso avanzados donde se necesita control explícito de secretos individuales (p. ej., secretos dinámicos, multi-tenant complejo), se mantiene el nodo `secure_value` como opción avanzada.

Objetivo: referenciar valores de configuración/secretos definidos en el backend (Azure App Service Application Settings o Azure Key Vault) sin exponerlos al cliente. El flujo sólo maneja aliases/handles opacos, y el backend resuelve y usa los valores cuando corresponda.

Características clave:
- Fuentes soportadas: `app_settings` y `key_vault`.
- Modo por defecto seguro: `opaque` (no retorna el valor en claro; produce un handle opaco usable por otros nodos como `agent_call`, `rest_call`, herramientas, etc.).
- Modo `plaintext` sólo para desarrollo/simulador: permite mock local del valor con bandera explícita (no para producción).
- Allow‑list de claves/nombres de secreto para evitar uso arbitrario.

Esquema del nodo:

```json
{
  "type": "secure_value",
  "source": "app_settings" | "key_vault",
  "alias": "search-prod" ,
  "name": "AzureSearch__ApiKey",
  "secret": "kv://secrets/api-key",
  "mode": "opaque" | "plaintext",
  "save_as": "cred_search"
}
```

Semántica de salida:
- `opaque`: `save_as` guarda un handle opaco (p. ej., `"h_7f8c..."`). Este handle sólo tiene sentido en el backend y no revela el valor. Otros nodos lo referencian tal cual.
- `plaintext` (sólo dev): `save_as` guarda un string mockeado localmente por el simulador; nunca se envía un secreto real desde backend a cliente en producción.

Uso en otros nodos:
- `agent_call` o `rest_call` pueden aceptar campos como `credentials: { search: "${cred_search}" }`. El backend detecta handles y resuelve valores reales antes de invocar herramientas/SDKs.

Validaciones en editor:
- Requerir `alias` válido (autocompletar desde allow‑list).
- `mode` = `plaintext` sólo visible en entorno de simulador/dev con advertencia.
- Si `source=app_settings` y se especifica `name`, debe matchear patrón permitido (p. ej. prefijo `Azure*` o lista blanca).
- Si `source=key_vault` y se especifica `secret`, sólo se permiten URIs/nombres pre‑aprobados.

### Backend .NET: resolución segura de valores

Servicio propuesto:

```csharp
public interface ISecureValueResolver {
  Task<string> CreateHandleAsync(SecureRef secureRef, CancellationToken ct);
  Task<string> ResolveAsync(string handleId, CancellationToken ct);
}

public record SecureRef(string Source, string Alias, string? Name = null, string? Secret = null);
```

Implementación:
- `app_settings`: usar `IConfiguration[Name]` o mapeo `Alias -> Name` en configuración.
- `key_vault`: `Azure.Security.KeyVault.Secrets.SecretClient` + `DefaultAzureCredential`.
- Cache en memoria por corto tiempo (5–15 min) con invalidación por handle; no loggear valores.
- Allow‑list por configuración: `{ AllowedSettings: ["AzureSearch__ApiKey"], AllowedSecrets: ["secrets/api-key"], Aliases: { "search-prod": { ... } } }`.

Endpoint opcional (simulador/orquestación):

```
POST /api/config/resolve
Body: { source, alias, name?, secret?, mode }
Respuestas:
  200 { handleId: "h_..." }                      // producción (opaque)
  200 { handleId: "h_...", mock: true, value: "dev-ONLY" } // sólo dev y mode=plaintext permitido
```

Notas de seguridad:
- En producción, nunca devolver `value` en claro.
- Requerir autenticación/autorización si aplica multi‑tenant.
- Limitar tasa y auditar `alias`, `source`, `sessionId`, `correlationId`.

Nota: el simulador NO usa este endpoint. Es útil para pruebas E2E/ops o herramientas administrativas, pero la resolución en el simulador es siempre local.

### Simulador: mocks de desarrollo

- Principio: el simulador NO llama al backend para resolver secretos; toda resolución es local en memoria del navegador.
- Variable global opcional: `window.SIM_SECURE_MOCKS = { "search-prod": "dev-123" }`.
- UI con dos opciones cuando `source` se usa en simulador:
  1) Mock value (recomendado en dev): ingresa un valor ficticio para pruebas.
  2) Test real value (local): permite pegar un valor real sólo para validar lógicas; no se persiste ni exporta.
- Si `mode=plaintext`, el simulador toma el valor de `SIM_SECURE_MOCKS[alias]` o del campo de UI y lo guarda en `save_as` con metadatos, p. ej.:
  ```json
  {
    "value": "dev-123",
    "__meta": { "simOnly": true, "mock": true }
  }
  ```
- Si `mode=opaque`, generar un handle sintético `h_dev_<alias>` con metadatos `{ "simOnly": true }` para encadenar el flujo; no es válido en backend productivo.

Prevención de fugas en simulador:
- Cualquier nodo que intente usar una variable marcada `simOnly` en una solicitud de red generada por el simulador (p. ej., `agent_call` o `rest_call` simulados) debe:
  - No incluir el valor/handle en la petición.
  - Reemplazar por marcador `"***SIM-ONLY***"` y emitir un warning visual en la consola del simulador.
  - Cambiar el nodo a modo mock (p. ej., respuestas simuladas) cuando una credencial `simOnly` sea requerida por el backend.

Reglas de exportación/publicación:
- Al exportar el flujo a producción, cualquier `secure_value` en modo `plaintext` o con datos `simOnly` se transforma a su forma segura:
  - Se mantiene sólo `alias` y `source` y se fuerza `mode: "opaque"`.
  - Se eliminan valores y metadatos `simOnly` de variables.
- Si se detecta contenido `simOnly` en variables globales al exportar, se muestra advertencia y se limpia antes de guardar.

Advertencias UI:
- Badge “DEV MOCK” cuando `mode=plaintext`.
- Tooltip: “No se exponen secretos reales. En producción, este nodo produce un handle opaco.”

### Ejemplos

1) App Settings (opaque):

```json
{ "type": "secure_value", "source": "app_settings", "alias": "search-prod", "name": "AzureSearch__ApiKey", "mode": "opaque", "save_as": "cred_search" }
```

2) Key Vault (opaque):

```json
{ "type": "secure_value", "source": "key_vault", "alias": "kv-search", "secret": "secrets/search-api-key", "mode": "opaque", "save_as": "cred_search" }
```

3) Simulador (plaintext):

```json
{ "type": "secure_value", "source": "app_settings", "alias": "search-prod", "name": "AzureSearch__ApiKey", "mode": "plaintext", "save_as": "cred_search" }
```

Luego en `agent_call`:

```json
{ "type": "agent_call", "tooling": ["ai_search"], "credentials": { "search": "${cred_search}" }, "save_as": "respuesta_agente" }
```

### Configuración (ejemplo)

```json
{
  "Security": {
    "SecureValues": {
      "Aliases": {
        "search-prod": { "source": "app_settings", "name": "AzureSearch__ApiKey" },
        "kv-search":    { "source": "key_vault",    "secret": "secrets/search-api-key" }
      },
      "AllowedSettings": ["AzureSearch__ApiKey"],
      "AllowedSecrets":  ["secrets/search-api-key"],
      "Dev": { "AllowPlaintext": true }
    }
  }
}
```

Buenas prácticas:
- Nunca imprimir/loggear valores resueltos.
- Rotar secretos: regenerar handle cuando cambie versión de Key Vault.
- Diferenciar `handle` por sesión y caducidad corta para reducir replay.
- Pasar valores resueltos a SDKs sólo en memoria y descartarlos al terminar.

## Cambios en backend .NET (egoverabot-assistant)

- Extender el controlador existente (p. ej., `ChatController`) para reutilizar `/api/chat` con negociación por `Accept`:
  - Si `Accept: text/event-stream` → usar Agent Framework .NET para ejecutar `RunStream` y emitir SSE (usar `Response.Headers[ContentType]="text/event-stream"`, `Cache-Control: no-cache`, y `await Response.WriteAsync("data: {...}\n\n"); await Response.Body.FlushAsync();`).
  - Si no → ejecutar el agente en modo síncrono (`Run`) y devolver respuesta JSON completa.
- Configuración (`AppSettings`):
  - `AI:Models:Default` (deployment/model name en Azure AI Foundry/OpenAI)
  - `Search:Endpoint`, `Search:IndexName`
  - CORS para Angular.
- Seguridad: validar `sessionId`/tenant y añadir `correlationId` a logs/headers.

## Orquestación de agentes en .NET

- Servicios .NET:
  - `IAgentOrchestrator`/`AgentOrchestrator` que construye el `ChatAgent`/`Coordinator` y registra Tools.
  - Tool `ai_search(query, filters?, topK?)` usando `SearchClient`/`SearchIndexClient` y `DefaultAzureCredential`.
  - (Opcional) Persistencia de threads/conversaciones en almacenamiento (tabla/redis) si se requiere contexto largo.
- Controlador (existente) `ChatController` o equivalente:
  - Detecta `Accept: text/event-stream` para emitir SSE con `{type, ...}`.
  - En modo JSON, devuelve `{ text, citations, usage }`.
  - Internamente delega en `IAgentOrchestrator` cuando `agent_profile`/campos de agente están presentes.

## Comunicación entre agentes con BRI‑FLOW

Hay dos modelos complementarios para que los agentes “hablen” entre sí, manteniendo BRI‑FLOW como orquestador visual:

1) Orquestación en backend (recomendada)
- BRI‑FLOW invoca un solo `agent_call` con `mode: "group_chat" | "sequential" | "fanout"` y `participants` (alias permitidos por backend).
- El orquestador (en .NET, Agent Framework) gestiona turnos, handoffs, paralelismo y agregación.
- El stream SSE incluye eventos de pasos internos para trazabilidad:
  - `{"type":"agent_turn","speaker":"RetrievalAgent","text":"..."}`
  - `{"type":"handoff","from":"Coordinator","to":"DomainExpert"}`
  - `{"type":"tool","name":"ai_search",...}`
  - `{"type":"text","text":"..."}` (respuesta final incremental)
- Seguridad: `participants` y `mode` se validan contra allow‑list; no se permite levantar agentes no autorizados.

2) Orquestación explícita en el flujo (cuando se necesita control fino)
- BRI‑FLOW encadena varios `agent_call` con distintos `agent_profile` y guarda estado en variables (`threadId`, `transcript`, `context`), usando nodos `condition` y `loop` para bifurcaciones.
- Fan‑out: un `loop` sobre `participants[]` ejecuta `agent_call` por cada uno y luego agrega con un nodo de `assign_var` (reduce/merge). A nivel runtime real, el backend puede ejecutar en paralelo aunque BRI‑FLOW lo dispare secuencialmente.

Parámetros sugeridos en `agent_call` para multi‑agente (sin secretos):
- `mode`: `group_chat | sequential | fanout`.
- `participants`: `["Coordinator","RetrievalAgent","DomainExpert"]` (aliases controlados).
- `max_turns`, `timeout_ms`.
- `return_trace`: `true` para obtener `steps`/`handoff_trace` en la respuesta y guardarlo en `save_as`.
- Opcional: `moderation: strict|default|off`.

Variables y mapeos útiles:
- Input: `context` lleva memoria de flujo (usuario, idioma, slot filling, etc.).
- Output estándar guardado por el nodo: `save_as.text`, `save_as.citations`, `save_as.usage`.
- Trazas: `save_as.steps` (lista de `{speaker,text,tool?}`) y `save_as.handoff_trace`.
- Persistencia de hilo: `threadId` en variables del flujo; el orquestador lo reutiliza para mantener memoria multi‑turn.

Contratos SSE ampliados (ejemplo):
```json
data: {"type":"agent_turn","speaker":"RetrievalAgent","text":"Buscando en el índice..."}
data: {"type":"tool","name":"ai_search","args":{"query":"renovación"}}
data: {"type":"handoff","from":"Coordinator","to":"DomainExpert"}
data: {"type":"text","text":"Debe presentar..."}
data: {"type":"done","usage":{"promptTokens":123,"completionTokens":456}}
```

## Front Angular: streaming y UX

- Servicio `botService`: añadir método `streamChat(message, sessionId)` que use `EventSource` o `fetch + ReadableStream` a `/api/chat` con `Accept: text/event-stream`.
- Adaptador de mensajes: mostrar tokens incrementales, finalizar cuando llegue `{type:"done"}`.
- Fallback no‑stream (`run`) para navegadores legacy o escenarios offline.

## Modelos recomendados (Azure AI Foundry)

- Razonamiento: `o3` u `o1` (según disponibilidad/coste) para tareas complejas y coordinación.
- Chat general/coste: `gpt-4.1-mini` o `gpt-4o-mini` para turnos normales.
- Embeddings (para Azure AI Search si se actualiza índice vectorial): `text-embedding-3-large` o `text-embedding-3-small` via Azure OpenAI; adaptar a catálogo disponible.

## Seguridad y variables

- Desarrollo local:
  - Variables de entorno/secretos de usuario para .NET (`dotnet user-secrets`) durante dev.
  - Preferir `DefaultAzureCredential` (usa identidad de dev) y evitar secretos en código.
- Cloud:
  - Managed Identity en contenedores/App Service; asignar permisos a Azure AI Search/Key Vault.
  - Secretos en Key Vault; .NET y Python leen nombres/URIs, no el secreto en claro.
  - CORS minimizado y HTTPS estricto.

## Observabilidad y trazabilidad

- Habilitar logging estructurado en .NET y Python.
- Trazas por request/sessionId: incluir `correlationId` en headers y eventos SSE.
- (Opcional) Telemetría de tokens/latencia por conversación.

## Contratos mínimos (pseudo‑esquemas)

Entrada (stream/run):

```json
{
  "sessionId": "abc-123",
  "message": "¿Cómo renuevo mi licencia?",
  "context": { "user_name": "Ana", "selected_language": "es" },
  "tools": ["ai_search"],
  "agent": "coordinator"
}
```

Chunk SSE:

```json
{ "type": "text", "text": "Para renovar su licencia…" }
```

Fin SSE:

```json
{ "type": "done", "usage": {"promptTokens": 123, "completionTokens": 456} }
```

Respuesta non‑stream:

```json
{ "text": "Para renovar su licencia…", "citations": [{"source": "url"}], "usage": {"totalTokens": 579} }
```

## Roadmap por fases

Fase 0 – Infra mínima
- Extender `ChatController` actual para soportar SSE por content negotiation y delegar en `IAgentOrchestrator` (eco) cuando llegue `agent_profile`.
- Angular mostrando tokens vía `EventSource`.

Fase 1 – RAG y orquestación
- Añadir Tool `ai_search` (Azure AI Search) y pruebas con índice de ejemplo.
- Introducir `Coordinator` + `RetrievalAgent` y handoff simple.

Fase 2 – Integración BRI‑FLOW
- Nuevo nodo `agent_call` o extender `rest_call` con modo `stream` en simulador y runtime contra `/api/chat`.
- Guardar `text`/`citations`/`usage` en variables del flujo; plantillas en respuesta.

Fase 3 – Seguridad y observabilidad
- Managed Identity/Key Vault, logging estructurado y métricas de tokens/latencia.

Fase 4 – Expertos y herramientas
- DomainExperts por vertical, MCP/HTTP tools, fan‑out/fan‑in para sub‑tareas.

## Impactos y cambios en código (resumen)

- .NET: (inline-only) sin `AgentsController`; se usa únicamente `/api/chat` con `application/vnd.agent+json`.

### Comunicación entre agentes y MCP en enfoque inline‑only

- Multi‑agente: el nodo `agent_call` puede definir `mode` (p. ej., `group_chat`, `sequential`) y `participants` (lista de roles/identificadores). El backend debe interpretar estos campos para instanciar un coordinador y agentes participantes. Este enfoque no requiere un registro externo; toda la orquestación se describe inline por flujo.
- Herramientas MCP: se puede declarar una tool en `tools` p. ej. `{ "name": "mcp", "args": { "server": "<id-o-url>", "method": "<cmd>", "params": { ... } } }`. El backend implementa un wrapper MCP (cliente) y aplica allow‑lists en perfiles. Así, el flujo decide cuándo invocar MCP y con qué parámetros.
- Seguridad: el backend sigue imponiendo allow‑lists (índices, participantes, herramientas), deny‑by‑default y timeouts/límites. Secretos y credenciales nunca se definen en el flujo.
- SSE/JSON: no cambia; los eventos de herramienta pueden incluir `type: "tool"` con `name: "mcp"` o `"ai_search"` y sus `args`.

Ejemplo (inline) mínimo para multi‑agente + MCP:

```json
{
  "agent": "coordinator",
  "mode": "group_chat",
  "participants": ["retrieval", "domain_expert"],
  "systemPrompt": "Coordina a los participantes y cita fuentes.",
  "tools": [
    { "name": "mcp", "args": { "server": "corp-tools", "method": "getCase", "params": { "id": "{{case_id}}" } } }
  ],
  "search": { "mode": "hybrid", "indexes": ["tramites-es"], "semanticConfiguration": "semantic-config-es", "topK": 5 },
  "runtime": { "timeoutMs": 30000 }
}
```
- Angular: método `streamChat` + UI con tokens incrementales.
- BRI‑FLOW: nodo `agent_call` (o `rest_call` con `stream=true`) y soporte de SSE en simulador.
- (Eliminado) microservicio Python: la orquestación vive en .NET.

## Checklist de seguridad

- No incluir secretos en repositorios; usar Key Vault/MI.
- CORS cerrado a orígenes esperados.
- Validación de input en endpoints y límites de tamaño.
- Sanitización de HTML en frontend (ya aplicada en simulador) y Markdown seguro.

## Contratos de API: esquemas detallados

Request común (run/stream):

```json
{
  "sessionId": "string (<= 128)",
  "message": "string (<= 8000)",
  "context": { "string": "any" },
  "tools": ["ai_search"],
  "agent": "coordinator | retrieval | domain_expert",
```

Actualizar allowed values (incluyendo perfiles de alto nivel):

```json
  "agent": "normal | rag | coordinator | retrieval | domain_expert",
  "mode": "group_chat | sequential | fanout",
  "participants": ["Coordinator","RetrievalAgent","DomainExpert"],
  "model": {
    "provider": "azure-openai|openai|google|anthropic",
    "deployment": "string?",
    "name": "string?",
    "endpoint": "url?",
    "api_version": "string?",
    "temperature": 0.0,
    "max_tokens": 0,
    "top_p": 1.0,
    "response_format": "text|json"
  },
  "system_prompt": "string?",
  "search": {
    "index": "string?",
    "indexes": ["string"],
    "mode": "keyword|semantic|vector|hybrid",
    "semanticConfiguration": "string?",
    "topK": 1,
    "filter": "OData?",
    "select": ["string"],
    "answers": "extractive|generative?",
    "captions": "extractive?",
    "queryLanguage": "es|en|..."
  }
}
```

Response non‑stream:

```json
{
  "text": "string",
  "citations": [{ "source": "string", "url": "string?", "score": 0.0 }],
  "steps": [{ "speaker": "string", "text": "string", "tool": "string?" }],
  "usage": { "promptTokens": 0, "completionTokens": 0, "totalTokens": 0 },
  "threadId": "string?"
}
```

Eventos SSE:

```json
{ "type": "text", "text": "..." }
{ "type": "agent_turn", "speaker": "RetrievalAgent", "text": "..." }
{ "type": "tool", "name": "ai_search", "args": { "query": "..." } }
{ "type": "error", "code": "SEARCH_RATE_LIMIT", "message": "...", "retryable": true }
{ "type": "done", "usage": { "promptTokens": 0, "completionTokens": 0 } }
```

Validación y límites (recomendado):
- `message` máx. 8000 caracteres; rechazar HTML peligroso (server‑side no renderizar).
- Máx. `topK` = 10; máx. `indexes.length` = 3.
- `participants` y `mode` validados contra allow‑list.

## SSE: implementación robusta

- Headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`.
- Heartbeat: enviar `:\n\n` cada 15–30s para mantener la conexión en proxies.
- Reconexión: soportar `Last-Event-ID` opcional; en Angular, usar `EventSource` con reintentos del navegador.
- Backpressure: `await Response.Body.FlushAsync()` por chunk; cortar stream al cancelar el `HttpContext.RequestAborted`.
- Timeouts: límite de 60–120s por petición; si expira, emitir `event: error`/`data: {type:"error"...}` y cerrar.
- CORS: permitir solo orígenes esperados (Angular/BRI‑FLOW dev/producción).

## Errores y códigos

- 400 Bad Request: validación de `mode/indexes/topK` o JSON inválido.
- 401/403: autenticación/autorización fallida (si aplica multi‑tenant).
- 409 Conflict: thread bloqueado o estado inconsistente.
- 413 Payload Too Large: `message/context` exceden límites.
- 429 Too Many Requests: throttling de modelo o Azure AI Search; incluir `Retry-After`.
- 500 Internal Server Error: errores no controlados (sin exponer detalles sensibles).
- Evento SSE `error`: `{type:"error", code, message, retryable}` para que el frontend muestre feedback y reintente cuando corresponda.

## Configuración de appsettings (ejemplo)

```json
{
  "AI": {
    "Models": {
      "Default": "gpt-4.1-mini",
      "Reasoning": "o3-mini"
    }
  },
  "Search": {
    "Endpoint": "https://<nombre>.search.windows.net",
    "DefaultIndex": "tramites-es",
    "SemanticConfig": "semantic-config-es",
    "AllowedIndexes": ["tramites-es","faq-ciudadania"],
    "MaxFanOut": 3
  },
  "Agents": {
    "AllowedParticipants": ["Coordinator","RetrievalAgent","DomainExpert"],
    "AllowedModes": ["group_chat","sequential","fanout"],
    "MaxTurns": 12
  }
}
```

Notas:
- En cloud, no guardar secretos aquí; usar Managed Identity y Key Vault. `Endpoint` no es secreto.
- El índice por defecto se usa si el flujo no especifica `search_index(es)`.

## Allow‑list y permisos

- Controlar por configuración qué índices, participantes y modos son utilizables.
- Registrar auditoría: `sessionId`, `agent_profile`, `tools`, `mode`, `participants`, `correlationId`.
- Implementar cuotas por `sessionId` (p. ej., 60 req/hora) y tamaño de contexto.

## Azure AI Search: diseño de índices

Campos recomendados:
- `id: string` (clave)
- `title: string` (buscable, recuperable)
- `content: string` (buscable, recuperable, semántica)
- `url: string` (recuperable)
- `category: string` (filtrable)
- `updatedAt: Edm.DateTimeOffset` (ordenable)
- `contentVector: Collection(Edm.Single)` (vectorial; dimensiones según embeddings)

Configuración:
- Habilitar `semanticConfiguration` con `title` y `content`.
- Para vectorial, almacenar embeddings pre‑calculados (preferible) y definir `vectorSearch`/`algorithmConfigurations`.

## Agregación multi‑índice: pseudocódigo

```pseudo
inputs: query, indexes[], mode, topK
results = []
for each idx in indexes parallel:
  r = search(idx, query, mode) // manejar 429 con reintentos exponenciales (máx 2)
  norm = normalize_scores(r)   // min‑max por índice
  results.add(norm)
merged = merge_by_score(results)      // ordenar desc por score
dedup  = deduplicate(merged, key=url||id)
return take(dedup, topK)
```

## BRI‑FLOW: esquema del nodo `agent_call`

```json
{
  "type": "agent_call",
  "provider": "agent_service",
  "stream": true,
  "save_as": "respuesta_agente",
  "agent_profile": "coordinator",
  "tooling": ["ai_search"],
  "tools": [
    { "name": "ai_search", "args": { "mode": "hybrid", "topK": 5 } }
  ],
  "model": {
    "provider": "azure-openai",  
    "deployment": "gpt-4o-mini",  
    "endpoint": "https://aoai-contoso.openai.azure.com/", 
    "api_version": "2024-06-01",  
    "temperature": 0.2,
    "max_tokens": 800,
    "top_p": 1.0,
    "response_format": "text"  
  },
  "system_prompt": "Responde en tono claro y cita fuentes cuando existan.",
  "mode": "group_chat",
  "participants": ["Coordinator","RetrievalAgent"],
  "runtime": {
    "timeout_ms": 30000,
    "max_internal_steps": 8,
    "retry_count": 0
  },
  "search": {
    "mode": "hybrid",
    "indexes": ["tramites-es","faq-ciudadania"],
    "semanticConfiguration": "semantic-config-es",
    "topK": 5,
    "filter": "category eq 'transito'",
    "select": ["title","content","url"],
    "answers": "extractive",
    "captions": "extractive",
    "retrievalPolicy": "always",
    "inject": "system",
    "citationStyle": "inline",
    "queryLanguage": "es"
  }
}
```

Validaciones del editor:
- Autocompletar `participants` desde allow‑list.
- Limitar `topK` y número de índices.
- Mostrar toggle de `stream` y selector de `save_as`.
- No hay campo `credential_profile` por nodo; la selección de credenciales se hace vía `use_profile` o meta global.
- `model.provider` en {"azure-openai","openai","google","anthropic"...} (allow‑list); `deployment|name` requerido según proveedor.
- Rango de `temperature` [0,2]; `max_tokens` > 0 y límites de plataforma; `response_format` en {"text","json"}.
- En `search`, limitar `indexes.length` ≤ 3, `topK` ≤ 10 y validar `semanticConfiguration` contra allow‑list.
 - `agent_profile` en {"normal","rag","coordinator","retrieval","domain_expert"}.
   - Si `agent_profile = "rag"` → exigir `search.mode` y al menos un `index|indexes` válidos; `retrievalPolicy` = `always` por defecto.
   - Si `agent_profile = "normal"` → ignorar bloque `search` a menos que se seleccione un modo avanzado.

### Campos avanzados del editor: tools y runtime

- `tools` (array opcional): lista avanzada de herramientas con parámetros. Complementa a `tooling` (strings simples) cuando se requieren opciones por herramienta.
  - Esquema de cada entrada: `{ "name": string, "args"?: object }`.
  - Ejemplos: `{ "name": "ai_search", "args": { "mode": "hybrid", "topK": 5 } }`, `{ "name": "http", "args": { "url": "...", "method": "GET" } }`.
  - Perfiles:
    - `normal`/`domain_expert`/`coordinator`: se aceptan `tools` y se envían al backend junto a `tooling`/`model`/`system_prompt` si existen.
    - `retrieval`: se permiten `tools` no generativas (p. ej., `ai_search`, `http`); este perfil no envía `model/system_prompt/stream/tooling` al backend.
    - `rag`: el backend puede habilitar `ai_search` automáticamente aunque no se declare en `tools`, pero si se especifica se respetan sus `args` válidos.

- `runtime` (objeto opcional): límites/guardrails de ejecución por nodo.
  - Campos soportados actualmente en el editor:
    - `timeout_ms`: número; tiempo máximo por ejecución del agente (p. ej., 30000).
    - `max_internal_steps`: número; tope de pasos internos del orquestador (p. ej., 8).
    - `retry_count`: número; reintentos en errores transitorios (p. ej., 0–2).
  - Inclusión condicional en export/serialización: sólo se añade si al menos uno de los campos tiene valor.

Notas de serialización (implementadas en `readAgentCall`):
- `normal` y `domain_expert`: incluyen `model`, `system_prompt`, `stream`, `tooling`; si hay `tools`/`runtime`, se agregan.
- `rag`: igual que normal pero además incluye `search` obligatorio; si hay `tools`/`runtime`, se agregan.
- `retrieval`: sólo envía `search`; si hay `tools` no generativas y/o `runtime`, se agregan; omite `model/system_prompt/stream/tooling`.
- `coordinator`: incluye `mode` y `participants` además de las opciones LLM comunes; omite `search` directo.

Validaciones UI por perfil (señales visuales en el editor):
- `rag`/`retrieval`: warning si falta `search.mode` o `index|indexes`, o si `topK` > 10.
- `coordinator`: warning si `participants` está vacío o `mode` no es válido.
- `normal`/`domain_expert`: aviso de que `search` se ignorará.

## Angular: servicio y tipos

Interfaces de eventos:

```ts
export type AgentEvent =
  | { type: 'text'; text: string }
  | { type: 'agent_turn'; speaker: string; text: string }
  | { type: 'tool'; name: string; args?: any }
  | { type: 'error'; code: string; message: string; retryable?: boolean }
  | { type: 'done'; usage?: { promptTokens: number; completionTokens: number } };

export interface AgentRequest {
  sessionId: string;
  message: string;
  context?: Record<string, any>;
  tools?: string[];
  agent?: string;
  mode?: 'group_chat'|'sequential'|'fanout';
  participants?: string[];
  search?: any;
}
```

Servicio (boceto):

```ts
streamChat(req: AgentRequest): Observable<AgentEvent> { /* EventSource -> observable */ }
run(req: AgentRequest): Promise<{ text: string; citations?: any[]; usage?: any }>
```

Accesibilidad UX:
- Indicador de streaming, botón de cancelar (cierra EventSource), render de citas al final.

## Orquestador .NET: diseño e interfaces (boceto)

```csharp
public interface IAgentOrchestrator {
  IAsyncEnumerable<AgentEvent> RunStream(AgentRequest req, CancellationToken ct);
  Task<AgentResponse> Run(AgentRequest req, CancellationToken ct);
}

public record AgentRequest(string SessionId, string Message, Dictionary<string,object>? Context, string[]? Tools, string? Agent, string? Mode, string[]? Participants, SearchIntent? Search);
public record AgentResponse(string Text, IEnumerable<Citation>? Citations, Usage? Usage, string? ThreadId, IEnumerable<Step>? Steps);
```

Notas:
- Registrar herramientas (p. ej., `AiSearchTool`) en DI y pasarlas al coordinador.
- Emisión de eventos con `IAsyncEnumerable` para SSE.

### Backend: proveedores de modelo y parámetros

Para soportar múltiples proveedores y configuraciones por nodo, el backend expone una fábrica/resolutor de clientes LLM que combina proveedor + perfil:

```csharp
public enum ModelProvider { AzureOpenAI, OpenAI, Google, Anthropic }

public record ModelConfig(
  ModelProvider Provider,
  string? DeploymentOrName,
  Uri? Endpoint,
  string? ApiVersion,
  double Temperature,
  int MaxTokens,
  double? TopP,
  string? ResponseFormat // text|json
);

public interface IModelClientFactory {
  IChatClient Create(ModelConfig config, string profileName, CancellationToken ct);
}
```

Resolución:
- `profileName` → `ICredentialProfileResolver` obtiene las credenciales para el proveedor (`openai`, `azure-openai`, etc.).
- `ModelConfig` viene del nodo `agent_call.model` (validado/recortado por allow‑list).
- La fábrica construye el cliente concreto (Azure OpenAI, OpenAI, Google, Anthropic) con credenciales del perfil y parámetros (`temperature`, `max_tokens`, etc.).

Validación y seguridad:
- Allow‑list de proveedores habilitados.
- Límite superior de `max_tokens` y acotación de `temperature`.
- Endpoints no secretos permitidos opcionalmente por perfil (metadatos en `CredentialProfiles`).

## Pruebas y observabilidad

- Unit: orquestador con herramientas mock, validación de fan‑out/merge.
- Integration: endpoint `/api/chat` (SSE por `Accept: text/event-stream` o JSON) con `TestServer`; asserts de SSE y errores.
- E2E: flujo BRI‑FLOW que dispare `agent_call` y verifique variables `save_as.*`.
- Telemetría: Application Insights (trazas, dependencias a Azure Search, métricas de latencia/tokens).

## Riesgos y mitigaciones

- Coste de tokens: limitar `max_turns` y resumir contexto con memoria compacta.
- 429/limites Azure Search: reintento exponencial con jitter, fan‑out con throttle.
- Conexiones SSE en producción: usar proxy compatible (NGINX `proxy_buffering off`).
- Fuga de información: estricta validación de inputs y allow‑list; no exponer secretos.

## Glosario

- SSE: Server‑Sent Events, protocolo unidireccional basado en HTTP para streaming de texto.
- RAG: Retrieval‑Augmented Generation, generación aumentada con recuperación de documentos.
- Allow‑list: lista explícita de elementos permitidos (índices, agentes, modos, etc.).

## Referencias

- microsoft/agent-framework: https://github.com/microsoft/agent-framework
- Azure AI Search: https://learn.microsoft.com/azure/search/
- Autenticación `DefaultAzureCredential` (.NET): https://learn.microsoft.com/dotnet/api/azure.identity.defaultazurecredential

## Implementación: artefactos a crear y campos (por parte)

En esta sección listamos de forma prescriptiva los artefactos que hay que implementar en cada componente (Backend .NET, BRI‑FLOW editor/simulador, Angular frontend e infra/configuración). Para cada artefacto indicamos los campos/firmas mínimos, validaciones y notas de seguridad. Úsalo como la checklist de implementación.

### Backend (.NET) — archivos/servicios a crear

- Controllers
  - `ChatController` (existente)
    - POST `/api/chat` (SSE/JSON via `Accept`)
      - Entrada (JSON): `AgentRequestDto` (ver DTOs)
      - SSE: `{ type, text?, speaker?, tool?, citations?, usage? }`
      - JSON: `AgentResponseDto`

- DTOs (C# records)
  - `AgentRequestDto` {
    string SessionId;
    string Message;
    Dictionary<string,object>? Context;
    string[]? Tools;
    string? Agent; // allowed: normal|rag|coordinator|retrieval|domain_expert
    string? Mode; // group_chat|sequential|fanout
    string[]? Participants;
    ModelConfigDto? Model;
    string? SystemPrompt;
    SearchIntentDto? Search;
  }

  - `ModelConfigDto` {
    string Provider; // azure-openai|openai|google|anthropic
    string? DeploymentOrName;
    string? Endpoint; // optional, non-secret
    string? ApiVersion;
    double Temperature;
    int MaxTokens;
    double? TopP;
    string? ResponseFormat; // text|json
  }

  - `SearchIntentDto` {
    string? Index;
    string[]? Indexes;
    string Mode; // keyword|semantic|vector|hybrid
    string? SemanticConfiguration;
    int TopK;
    string? Filter; // OData
    string[]? Select;
    string? Answers; // extractive|generative
    string? Captions; // extractive
    string? QueryLanguage;
    string? RetrievalPolicy; // always|never|conditional
  }

  - `AgentResponseDto` {
    string Text;
    CitationDto[]? Citations;
    StepDto[]? Steps;
    UsageDto? Usage;
    string? ThreadId;
  }

  - `CitationDto` { string Source; string? Url; double Score; string? Snippet; }
  - `StepDto` { string Speaker; string Text; string? Tool; }
  - `UsageDto` { int PromptTokens; int CompletionTokens; int TotalTokens; }

- Servicios / Interfaces
  - `IAgentOrchestrator`
    - IAsyncEnumerable<AgentEvent> RunStream(AgentRequestDto req, CancellationToken ct)
    - Task<AgentResponseDto> Run(AgentRequestDto req, CancellationToken ct)

  - `ICredentialProfileResolver`
    - Task<Dictionary<string, CredentialEntry>> ResolveProfileAsync(string profileName, CancellationToken ct)
    - Task<string?> ResolveToolCredentialAsync(string profileName, string toolName, CancellationToken ct)

    - `CredentialEntry` { string Source; string? Name; string? SecretRef; string? Endpoint; string? Deployment; }

  - `IModelClientFactory`
    - IChatClient Create(ModelConfigDto config, string profileName)

  - `ISecureValueResolver` (opcional administrativo)
    - Task<string> CreateHandleAsync(SecureRef ref)
    - Task<string> ResolveAsync(string handleId)

- Tools y utilidades
  - `AiSearchTool`:
    - Método SearchAsync(SearchIntentDto intent, CancellationToken ct) -> CitationDto[]
    - Soporta fan‑out a múltiples índices, normalización y deduplicación.

Notas de seguridad (backend):
- Nunca loggear secretos ni valores resueltos.
- Cache de credenciales en memoria con TTL corto (5–15min) y invalidación.
- Validar `indexes`, `participants`, `mode` contra allow‑lists configuradas.

### BRI‑FLOW (editor y simulador) — nodos y validaciones que hay que crear

- Nodo `agent_call` (editor + simulador + runtime)
  - Campos mínimos:
    - `type`: "agent_call"
    - `agent_profile`?: string (normal|rag|coordinator|retrieval|domain_expert)
    - `provider`: "agent_service"
    - `stream`: boolean
    - `message`: string
    - `save_as`?: string
    - `tooling`?: string[] // e.g. ["ai_search"]
    - `model`?: { provider, deployment/name, endpoint?, api_version?, temperature?, max_tokens?, top_p?, response_format? }
    - `system_prompt`?: string
    - `mode`?: string
    - `participants`?: string[]
    - `search`?: { mode, indexes, semanticConfiguration, topK, filter, select, answers, captions, queryLanguage, retrievalPolicy }

  - Validaciones editor:
    - `agent_profile` obligatorio solo si quieres perfiles rápidos (normal/rag), else default coordinator.
    - Si `agent_profile == "rag"` → `search.mode` y `search.indexes|index` obligatorios.
    - Limitar `search.indexes.length <= 3`, `search.topK <= 10`.
    - Validar `model.provider` contra allow‑list.

- Nodo `credential_profile` (sim‑only)
  - Esquema: `{ type: 'credential_profile', profile: string, credentials: { [tool]: string }, __sim_only: true }`
  - Comportamiento editor: badge de advertencia y UI para pegar claves (en memoria).
  - Export: eliminar por defecto del JSON exportado.

- Nodo `use_profile` (exportable)
  - Esquema: `{ type: 'use_profile', profile: string }`
  - Comportamiento runtime: establece perfil activo para nodos siguientes hasta cambio.

- Nodo `secure_value` (opcional avanzado)
  - Campos: `source` (app_settings|key_vault), `alias`, `name?`, `secret?`, `mode` (opaque|plaintext), `save_as`
  - Editor: permitir `mode=plaintext` solo en simulador con badge.

Notas simulador:
- Mantener todos los valores `__sim_only` en memoria JS; no usar localStorage por defecto.
- Variable global opcional `window.SIM_CREDENTIAL_PROFILES` y `window.SIM_SECURE_MOCKS`.
- Al exportar, transformar nodos sim_only según reglas de exportación (eliminar valores).

### Angular frontend — servicios/formatos/UI que hay que crear

- Servicio `botService` / `AgentService`
  - `streamChat(req: AgentRequest): Observable<AgentEvent>`
  - `run(req: AgentRequest): Promise<AgentResponse>`

- Tipos/Interfaces (TS)
  - `AgentRequest` { sessionId: string; message: string; context?: any; tools?: string[]; agent?: string; mode?: string; participants?: string[]; model?: ModelConfig; search?: SearchIntent }
  - `AgentEvent` (union): text, agent_turn, tool, error, done
  - `AgentResponse` { text: string; citations?: Citation[]; steps?: Step[]; usage?: Usage }

- UI
  - Componente de chat con indicador de streaming, botón cancelar y render de citas (lista con url y snippet).
  - Badge RAG cuando `agent_profile == 'rag'` y tooltip explicativo.

### Infra / Configuración — appsettings y allow‑lists

- `appsettings.json` (ejemplo mínimo ya en doc):
  - `Search:AllowedIndexes` (array)
  - `Agents:AllowedParticipants` (array)
  - `Security:CredentialProfiles` (map de perfiles → tool entries)
  - `SecureValues:Aliases` (map alias -> source/name/secret)

### Checklist de implementación (por prioridad mínima)
1. Backend: crear DTOs, `IAgentOrchestrator`, `ICredentialProfileResolver` y reutilizar `/api/chat` (JSON primero) — validar contratos.
2. Angular: `botService.run` y UI de respuesta (no‑stream) — integrar con BRI‑FLOW exportado JSON de ejemplo.
3. Backend: añadir SSE en `/api/chat` con `RunStream` (content negotiation); Angular `streamChat`.
4. Backend: `AiSearchTool` con fan‑out y normalización, y `IModelClientFactory` para provider pluggable.
5. BRI‑FLOW: editor — node schemas (`agent_call`, `use_profile`, `credential_profile`, `secure_value`) y validaciones; simulador mock behavior.

Si quieres, genero automáticamente los DTOs C# y las interfaces básicas en `egoverabot-assistant` (archivo boceto) y los tipos TypeScript en `egoverabot-frontend-1` como base para implementación. Dime si quieres que haga eso ahora y en qué lenguaje/estilo prefieres los artefactos (por ejemplo, C# 11 records / .NET 8, TypeScript 5.*, etc.).

## Guía de migración: usar SemanticConfigurationName tipado (pendiente)

Objetivo: eliminar el uso de reflexión y usar la propiedad tipada `SemanticConfigurationName` en `SearchOptions` cuando el feed permita `Azure.Search.Documents >= 11.8.0`.

Pasos

1) Actualizar paquete en `egoverabot-assistant/eGovERABot.csproj`:
  - Cambiar `<PackageReference Include="Azure.Search.Documents" Version="11.7.0" />` por `11.8.x` o superior disponible en el feed.
2) Código en `Services/Agents/AiSearchTool.cs`:
  - En la construcción de `SearchOptions` para modos `semantic` y `hybrid`, reemplazar la asignación reflectiva por tipada:
    - Sustituir:
     - Buscar `typeof(SearchOptions).GetProperty("SemanticConfigurationName")` y el `SetValue(...)`
    - Por:
     - `options.SemanticConfigurationName = intent.SemanticConfiguration;`
  - Mantener `QueryType = SearchQueryType.Semantic` en `semantic/hybrid`.
  - Conservar (temporalmente) el path reflectivo detrás de un `#if`/verificación de símbolo si se quiere compatibilidad dual; idealmente eliminarlo tras el upgrade estable.
3) Vector/hybrid (opcional):
  - Si el SDK expone tipos estables para `VectorizedQuery`/`VectorSearchOptions` en la versión actualizada, migrar la creación que hoy usa reflexión a tipos tipados.
  - Ajustar el helper que aplica `KNN` y `Fields` a `VectorSearchOptions` con objetos tipados.
4) Tests en `eGovERABot.Tests`:
  - Mantener pruebas basadas en `BuildOptionsSummary` (no acopladas a tipos del SDK) — deberían seguir pasando sin cambios.
  - Añadir un test opcional que verifique, cuando se compile contra la versión nueva, que `SemanticConfigurationName` se propaga (si exponemos un accessor condicionally compilado para inspección tipada).
5) Validación:
  - `dotnet restore && dotnet build && dotnet test` — esperar verde.
  - Prueba manual contra un índice con `semanticConfiguration` real para confirmar ranking/answers.

Notas

- Motivo del pin actual (11.7.0): el feed disponible en el entorno solo ofrecía hasta esa versión; por eso usamos reflexión para compatibilidad hacia delante.
- Tras el upgrade, remover reflexión simplificará mantenimiento y reducirá riesgo de ruptura en cambios de API.
