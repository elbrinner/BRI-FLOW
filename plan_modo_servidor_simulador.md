# Plan técnico — Modo servidor (Simulador frontend + ejecución en backend)

## Objetivo
Permitir que el **simulador frontend** ejecute un flujo usando el **backend real** ("backend parity"), manteniendo la UX de depuración del simulador (timeline, variables, nodo actual) y minimizando divergencias de comportamiento.

## Alcance
- Soportar ejecución **híbrida**: local (JS) + remota (backend) con un conmutador claro.
- Empezar por **MVP**: ejecutar remotamente `agent_call` y, después, pasos remotos por nodo (`execution_mode='remote'`) o por tipo.
- No romper el simulador actual: si falla el backend, el modo local sigue funcionando.

---

## Backend real: API única `POST /api/chat`
En este proyecto, el “modo servidor” se apoya en **una única API**: `POST /api/chat`.

### Flujo de prueba recomendado
- Flujo: `flow_main`
- Archivo backend (referencia): `egoverabot-assistant/Flows/flow_main.json`

### Ejemplo de llamada (SSE)
```bash
curl 'http://localhost:5000/api/chat' \
  -H 'Accept: text/event-stream' \
  -H 'Content-Type: application/json' \
  --data-raw '{"flowId":"flow_main"}'
```

Notas:
- `Accept: text/event-stream` activa el intento de **streaming**; el backend **solo** streamea si, al auto‑avanzar, alcanza un nodo candidato (p. ej. `agent_call` con streaming o `rest_call` SSE). Si no, responde en JSON normal.
- El cliente (simulador) debe soportar **ambos**: respuesta JSON (no‑stream) y SSE (múltiples eventos).

### Contrato (resumen)
**Request** (`ChatRequest`):
- Inicio de sesión: `{ "flowId": "flow_main" }` (opcional `locale`, `turn`).
- Continuación: `{ "sessionId": "<guid>", "input": "..." }` (o `choiceValue` / `choiceValues`).
- Contexto efímero por paso: `origin` y/o `extra`.

**Response** (`ChatEnvelope`):
- `session`: `{ id, flowId, ended, locale }`
- `groups`: `ChatElement[][]` (elementos renderizables por “grupo”)
- `context`: historial unificado (user/assistant)
- `isFinal`: `true` en no‑stream; en SSE habrá eventos intermedios con `false` y un final con `true`.

**Elemento renderizable** (`ChatElement`):
- `nodeId`, `type`, `text`, `options`, `requiresInput`, `variable`, `dataInfo`, `fields`, `optional`

Implicación clave para BRI‑FLOW:
- En modo servidor, el simulador no debe “ejecutar nodos” localmente: debe **pintar** `groups` y, cuando haya un elemento interactivo (`requiresInput == true` o `options`), **enviar** la interacción de vuelta a `/api/chat`.

---

## Preguntas técnicas que hay que cerrar (antes de implementar el “modo servidor” completo)

### 1) ¿Qué flujo arranca?
Decisiones:
- **Opción A (recomendada para MVP):** el flujo que está activo en el editor (el que el simulador ya carga con `loadFlowFromEditor()`).
- Opción B: un flujo por `flow_id` seleccionado en UI (lista de proyectos/flows).

Criterio:
- Para “paridad de simulación”, el backend debe recibir **exactamente el JSON** que el diseñador tiene en el editor (incl. start node y variables definidas).

### 2) ¿Qué significa “ejecutar en backend”?
Separar dos niveles:
- **Nivel 1 (ya útil):** `agent_call` usa backend real (chat/tools/mcp) pero el control de flujo sigue en frontend.
- **Nivel 2 (modo servidor real):** el backend ejecuta **pasos** del flujo (state machine), y el frontend solo “reproduce” estado/visuales.

### 3) Contrato de respuesta: ¿qué devuelve el backend?
Necesitamos un contrato estable para el simulador y **ya existe** (backend): `ChatEnvelope`.

Lo que el simulador debe asumir:
- La salida visible viene en `groups: ChatElement[][]`.
- El backend **auto‑avanza** nodos pasivos y agrupa salidas hasta llegar a un interactivo.
- El simulador no recibe variables del flujo: recibirá contexto renderizable + sesión.

Punto crítico: el modo servidor requiere un **adapter** `ChatEnvelope → UI del simulador`.

### 4) Sesión / estado / reproducibilidad
- ¿Dónde vive el estado fuente? (backend o frontend)
- ¿Cómo se identifican sesiones? `sessionId` + `threadId` + `flowId`
- ¿Cómo se reinicia o se “rebobina”? (reset)

Recomendación MVP:
- El estado fuente vive en el **backend**. El frontend conserva solo estado de UI.
- El frontend conserva `sessionId` y lo re‑envía en cada paso.
- Para reinicio: usar `restartIfEnded: true` o crear una sesión nueva (sin `sessionId`).

### 5) Adaptación: “la respuesta es diferente”
Hoy el simulador asume:
- Nodos JS → actualizan UI/variables localmente.

En modo servidor:
- El backend puede devolver eventos que no tienen equivalente 1:1.

Regla:
- Introducir un **adapter** `ChatEnvelope/ChatElement → SimuladorUI`.

---

## Plan por fases (incremental)

### Fase 0 — Alinear contrato (diseño)
Entregables:
- Documento de contrato real de `/api/chat` (request/response + ejemplos JSON).
- Tabla de mapeo: `ChatElement.type` → componente UI del simulador (response/button/input/form/etc.).

### Fase 1 — MVP estable (agent_call remoto + config)
Estado actual/objetivo:
- Configuración (URL + forzar backend) desde UI.
- `agent_call` usa backend si se fuerza.

Pendiente:
- Decidir cabeceras estándar: `Authorization: Bearer` vs `x-api-key`.
- Mostrar “estado backend” (ok/error + timestamp) en el panel.

### Fase 2 — Adapter “modo servidor” sobre `/api/chat` (no‑stream)
Frontend:
- Nuevo modo: el simulador llama a `/api/chat` en vez de ejecutar nodos.
- Renderiza `envelope.groups`.
- Cuando haya interacción:
  - `input` → enviar `input`
  - `button/choice` → enviar `choiceValue`
  - `multi_button` → enviar `choiceValues` (incluye `[]` para “no seleccionar” cuando sea opcional)

Backend:
- Sin cambios: el flujo se ejecuta con el motor actual.

### Fase 3 — Streaming SSE sobre `/api/chat`
Frontend:
- Soportar `Accept: text/event-stream` y consumir `data: <json>\n\n`.
- Pintar incrementalmente los `ChatElement` (especialmente `type="Stream"`).
- Tratar `isFinal=false` como evento parcial y `isFinal=true` como cierre de la respuesta.

### Fase 4 — Pruebas y compatibilidad
- Tests de contrato: golden files (request/response) + validación schema.
- E2E Playwright: abrir simulador → activar modo servidor → ejecutar 3 pasos.

---

## Cambios de UX mínimos (sin inventar nuevas pantallas)
- En el modal del simulador:
  - Botón “Configuración” (ya existe)
  - Toggle “Forzar backend” (ya existe)
  - Campo URL (ya existe)
- En el panel debug:
  - Línea de “Origen config” y “último estado backend”.

---

## Riesgos
- Divergencia de semántica de variables (frontend snapshot vs backend patch).
- Flujos grandes: enviar JSON completo en cada step puede ser pesado.
- Nodos con side-effects: evitar duplicados (idempotencia).

## Decisiones recomendadas (para cerrar rápido)
1) Arranque = flujo activo del editor (Opción A).
2) Contrato único = `/api/chat` (no inventar `/simulate/step` mientras no sea imprescindible).
3) MVP: adapter no‑stream (JSON) y luego soporte SSE.
