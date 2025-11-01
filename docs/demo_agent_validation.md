# Demo de validación de agentes (backend eGovERABot)

Este documento muestra cómo probar los flujos de validación de agentes incluidos en el backend `egoverabot-assistant` para los 5 tipos de agentes en modo no‑stream y streaming.

Requisitos:

- Backend corriendo localmente (por defecto en `http://localhost:5000`).
- `curl` y opcionalmente `jq` para formatear JSON.

## No‑stream: `agent_validation`

Inicia una sesión del flujo y deja que el motor auto‑avance por los nodos pasivos:

```bash
curl -sS http://localhost:5000/api/chat \
  -H 'Content-Type: application/json' \
  -d '{
    "flowId": "agent_validation",
    "locale": "es"
  }' | jq
```

Esperado al finalizar:

- Variables `agent_normal_resp`, `agent_rag_resp`, `agent_coordinator_resp`, `agent_retrieval_resp`, `agent_domain_resp` con sobres `{ status, timestamp, data { text, threadId, usage, citations }, isFinal }`.
- `agent_thread_id` con el ThreadId persistido a través de las 5 llamadas.

Puedes sobreescribir el mensaje del agente enviando `variableOverrides` al crear la sesión:

```bash
curl -sS http://localhost:5000/api/chat \
  -H 'Content-Type: application/json' \
  -d '{
    "flowId": "agent_validation",
    "locale": "es",
    "variableOverrides": { "agent_message": "Resume en 2 viñetas." }
  }' | jq
```

## Streaming (SSE): `agent_validation_stream`

Solicita eventos incrementales enviando `Accept: text/event-stream`:

```bash
curl -sS http://localhost:5000/api/chat \
  -H 'Content-Type: application/json' \
  -H 'Accept: text/event-stream' \
  -d '{
    "flowId": "agent_validation_stream",
    "locale": "es"
  }'
```

Verás múltiples líneas `data: ...` con sobres `ChatEnvelope` parciales (`isFinal=false`) y un último evento final con `isFinal=true` que incluye los elementos restantes.

Al finalizar, en variables de sesión:

- `agent_stream_normal_resp`, `agent_stream_rag_resp`, `agent_stream_coordinator_resp`, `agent_stream_retrieval_resp`, `agent_stream_domain_resp`.
- `agent_thread_stream` con el ThreadId del agente.

> Nota: si el cliente no envía `Accept: text/event-stream`, el controlador puede devolver `200 OK` con un sobre completo (modo no‑stream) incluso si el nodo tiene `stream: true`.

## Referencias

- Flujos en el backend: `egoverabot-assistant/Flows/agent_validation.json` y `egoverabot-assistant/Flows/agent_validation_stream.json`.
- Controlador de chat (SSE): `egoverabot-assistant/Controllers/Flow/ChatController.cs`.
