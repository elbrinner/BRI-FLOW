# Plan Diciembre Bri Flow: Evolución Agentic

Este documento detalla la hoja de ruta estratégica para transformar Bri Flow, estructurada en 11 pilares fundamentales.

**Estado Global**: 🟢 Fase 1 Completada | 🟡 Fase 2 Pendiente

---

## 1. Integración con Agent Framework
Objetivo: Bri Flow como diseñador visual del backend.
- [x] **Unificación de `agent_call`**: El nodo central para invocar agentes.
- [x] **Nuevos Perfiles**: Implementar selectores para `UI Agent`, `Event Agent`, `Worker`.

## 2. Soporte MCP (Model Context Protocol)
Objetivo: Estandarizar el uso de herramientas externas.
- [x] **Esquemas JSON**: Definidos en `js/agent_schemas.js`.
- [x] **UI de Configuración**: Implementada en `renderer_agent_call.js` (Servidores y Herramientas).
- [ ] **Descubrimiento Dinámico**: Conectar con API para listar herramientas reales.

## 3. UI-Agents (Agentes de Interfaz)
Objetivo: Agentes que generan interfaces ricas, no solo texto.
- [x] **Esquema de Componentes**: Definido en `js/agent_schemas.js`.
- [x] **Renderizado en Simulador**: Soporte para visualizar JSON de UI.
- [x] **Renderizado en React Client**: Componentes dinámicos en el frontend.

## 4. Event Agents (Agentes Reactivos)
Objetivo: Flujos iniciados por eventos, no solo por usuarios.
- [ ] **Nodo `Event Start`**: Implementar nodo de inicio por webhook/evento.
- [ ] **Configuración de Filtros**: UI para definir triggers.

## 5. Validación Humana (Human-in-the-loop)
Objetivo: Control y seguridad en operaciones sensibles.
- [x] **Nodo `Human Validation`**: Pausar ejecución y esperar aprobación.
- [x] **Interfaz de Aprobación**: UI en simulador y cliente para gestores.

## 6. Workflows y Orquestación
Objetivo: Ejecución compleja y paralela.
- [x] **Mejora de `Coordinator`**: Soporte visual para sub-flujos y estrategias (fan-out).

## 7. Simulador Real (Backend Parity)
Objetivo: Fidelidad total entre diseño y producción.
- [x] **Modo Híbrido**: Delegar ejecución de nodos complejos al backend.
- [x] **Ejecución Remota**: API para simular pasos en el servidor.

## 8. A2A (Agent to Agent)
Objetivo: Comunicación directa entre agentes.
- [x] **Direccionamiento por ID**: Permitir mensajes directos `@agente`.
- [x] **Bus de Mensajes**: Soporte en backend para enrutamiento.

## 9. React Frontend (Agent Client)
Objetivo: Cliente moderno desacoplado del diseñador.
- [x] **Inicialización**: Proyecto Vite + React creado en `agent-client/`.
- [x] **Configuración Base**: Tailwind CSS y estructura de carpetas.
- [x] **Contrato API**: `openapi_draft.yaml` definido.
- [x] **Librería UI**: Configuración de alias para Shadcn/UI.
- [x] **Integración de Voz**: Web Audio API / WebRTC.
- [x] **Streaming de UI**: Renderizado progresivo de componentes.

## 10. Agentes de Voz en Tiempo Real
Objetivo: Interacción natural por voz con baja latencia.
- [ ] **Perfil `Voice Agent`**: Configuración de proveedor (OpenAI/Azure) en Bri Flow.
- [ ] **Gestión de Sesión**: WebSocket para audio bidireccional.
- [ ] **Eventos de Voz**: Detección de silencio e interrupciones.

## 11. Mejoras Adicionales (Premium)
Objetivo: Calidad empresarial, observabilidad y despliegue.
- [ ] **Mock Backend**: Servidor Node.js para pruebas de UI aisladas.
- [ ] **Observabilidad (LLMOps)**: Dashboard de trazas y costes.
- [ ] **Evaluación (Evals)**: Tests automáticos de calidad de respuesta.
## 12. Evolución del Editor BRI FLOW (Detalle Técnico)
Objetivo: Modernizar la herramienta de diseño, soportar nuevos nodos y asegurar estabilidad.

### 12.1. Nuevos Nodos y Propiedades
- [x] **Node Factory (`js/node_factory.js`)**:
    - Agregar casos para `event_start` y `human_validation`.
    - Actualizar `start` para inicializar `enable_debug` (default: true).
- [x] **Serializer (`js/serializer.js`)**:
    - Implementar normalización para `event_start` (event_type, filter) y `human_validation` (timeout, approvers).
    - Persistir flag `enable_debug` en nodo `start`.
- [x] **Property Renderers (`js/renderers/`)**:
    - Crear `js/renderers/event_start.js`: Formulario para tipo de evento y filtros JSON.
    - Crear `js/renderers/human_validation.js`: Formulario para timeout y roles.
    - Actualizar `js/renderers/start.js`: Añadir checkbox "Habilitar Debug Global".

### 12.2. Mejoras Visuales y UX
- [x] **Estilos de Nodos (`js/node_renderer.js`)**:
    - `event_start`: Icono ⚡, Color Púrpura (`#d8b4fe`).
    - `human_validation`: Icono 🛡️, Color Naranja (`#fdba74`).
    - `voice_agent`: Icono 🎙️, Color Cian (`#67e8f9`) (si se usa como nodo visual distinto).
- [x] **Paleta de Nodos**:
    - Reorganizar la barra lateral en categorías colapsables: *Agentes*, *Lógica*, *UI*, *Voz*.
- [x] **Indicadores Visuales**:
    - Líneas punteadas para conexiones asíncronas (eventos).

### 12.3. Refactorización y Testing
- [x] **Desacoplamiento**:
    - Extraer lógica de `main.js` a módulos testables (`FlowManager`, `CanvasManager`).
- [x] **Unit Tests (Vitest/Node)**:
    - Testear `node_factory.createNode()` para asegurar propiedades default correctas.
    - Testear `serializer.normalizeNode()` para asegurar integridad de datos.
- [x] **E2E Tests (Playwright)**:
    - Test: Crear flujo simple (Start -> Debug -> End).
    - Test: Verificar persistencia de `enable_debug`.
    - Test: Drag & drop de nuevos nodos.

## 13. AI Copilot (Generador de Flujos)
Objetivo: Acelerar la creación de flujos mediante lenguaje natural.
- [x] **Interfaz de Usuario**:
    - Botón flotante "✨ AI Assist" en el canvas.
    - Modal con área de texto para el prompt ("Crea un agente que reserve citas...").
- [x] **Lógica de Generación**:
    - **Prompt System**: "Eres un experto en Bri Flow JSON. Genera una estructura de nodos válida para...".
    - **Integración**: Función `mergeGeneratedFlow(currentFlow, newNodes)` que posiciona los nuevos nodos sin solapar los existentes.
- [x] **Backend**:
    - Endpoint `/api/copilot/generate` que conecta con LLM (GPT-4o/Claude 3.5) (Prototipo Azure Client-side).

## 14. Historial de Versiones (Time Travel)
Objetivo: Seguridad y recuperación ante errores de edición.
- [ ] **Estructura de Datos (`project_flows.js`)**:
    - Extender el objeto de flujo: `flow.snapshots = [{ ts: 123456, version: '1.0.1', nodes: {...} }]`.
- [ ] **Lógica de Captura**:
    - Crear snapshot automático al guardar (con límite, ej. últimos 10).
    - Crear snapshot manual (botón "Crear Versión").
- [ ] **Interfaz de Restauración**:
    - Pestaña "Historial" en el modal de proyectos.
    - Lista de versiones con fecha y botón "Restaurar" (sobrescribe el estado actual).

## 15. Marketplace de Plantillas
Objetivo: Reducir la fricción inicial con casos de uso predefinidos.
- [ ] **Registro de Plantillas**:
    - Archivo `js/templates/registry.js` con metadatos y JSONs de flujos (Lead Gen, FAQ RAG, Quiz, Customer Support).
- [ ] **UI de Selección**:
    - En "Nuevo Flujo", ofrecer opción "Desde Plantilla".
    - Grid de tarjetas con vista previa de la plantilla.
- [ ] **Lógica de Instanciación**:
    - `createFlowFromTemplate(templateId)`: Clona el JSON de la plantilla y asigna un nuevo ID único.

## 16. Configuración de Backend y Ejecución Híbrida
Objetivo: Permitir la simulación de agentes complejos delegando en el backend real.
- 📌 Plan técnico detallado: `plan_modo_servidor_simulador.md`.
- [ ] **Configuración Global (Nodo Start)**:
    - Campo `backend_url`: URL base del servidor de agentes (ej. `http://localhost:8000`).
    - Campo `api_key`: (Opcional) para autenticación con el backend.
- [ ] **Configuración por Nodo**:
    - Propiedad `execution_mode`: Selector `Local (JS)` vs `Remote (Backend)`.
    - En nodos `agent_call`, permitir forzar `Remote` si se usan herramientas no soportadas en navegador (Python, File System).
- [ ] **Lógica del Simulador**:
    - Interceptar nodos con `execution_mode='remote'`.
    - Realizar POST a `backend_url/simulate/step` enviando el estado actual.
    - Actualizar el estado del simulador con la respuesta del backend.

## 17. Arquitectura Detallada de Agentes y Backend
Objetivo: Definir la implementación técnica precisa de cada tipo de agente y capacidad en ambos extremos (Bri Flow y Backend).

### 17.1. Tipos de Agentes (Polimorfismo)
El nodo `agent_call` tendrá un selector `profile_type` que altera su comportamiento y ejecución.

#### A. Assistant (Chatbot Estándar)
- **Bri Flow**: Configuración de `system_prompt`, `model` (GPT-4, Claude), `temperature`.
- **Backend**: Instancia `BaseAgent`. Mantiene historial de conversación (Memory).
- **Function Calling**: Puede tener herramientas básicas asignadas.

#### B. RAG Agent (Retrieval Augmented Generation)
- **Bri Flow**: Campo adicional `knowledge_base_id` (colección vectorial) y `retrieval_strategy` (similarity, hybrid).
- **Backend**: Instancia `RAGAgent`.
    - Pipeline: Query -> Embedding -> Vector DB Search -> Context Injection -> LLM.
    - Requiere conexión a Vector DB (Qdrant/Pinecone).

#### C. Orchestrator (Router/Coordinator)
- **Bri Flow**: Lista de `sub_agents` (IDs de otros agentes) y `routing_logic` (LLM-based o Rules-based).
- **Backend**: Instancia `OrchestratorAgent`.
    - No responde al usuario directamente, sino que delega.
    - Analiza el input y decide a qué `sub_agent` invocar.
    - Agrega las respuestas de los sub-agentes.

#### D. Worker (Task Executor)
- **Bri Flow**: Configuración estricta de `input_schema` y `output_schema`.
- **Backend**: Instancia `WorkerAgent`.
    - Optimizado para "One-shot" tasks (no mantiene chat history largo).
    - Ejecuta herramientas MCP específicas y devuelve JSON estructurado.

#### E. UI Agent (Generative UI)
- **Bri Flow**: Acceso a librería de componentes (Shadcn definitions).
- **Backend**: Instancia `UIAgent`.
    - System Prompt especializado en generar JSON de UI (`{ type: "card", title: ... }`).
    - Valida el JSON generado contra el esquema de UI antes de enviarlo.

### 17.2. MCP (Model Context Protocol)
- **Bri Flow (Frontend)**:
    - **Discovery**: Consulta al backend `/api/mcp/servers` para listar herramientas disponibles.
    - **Selection**: Checkbox list en `agent_call` para habilitar herramientas específicas.
- **Backend**:
    - **MCP Client**: El backend actúa como cliente MCP.
    - **Connection**: Mantiene conexiones SSE/Stdio con los servidores MCP configurados.
    - **Execution**: Cuando el LLM solicita una tool call, el backend la enruta al servidor MCP correspondiente.

### 17.3. A2A (Agent-to-Agent Communication)
- **Bri Flow**:
    - **Addressing**: Sintaxis `@nombre_agente` en el prompt o nodo `send_message` con `target_agent_id`.
- **Backend**:
    - **Message Bus**: Sistema Pub/Sub (Redis o Memoria) para intercambio de mensajes.
    - **Direct Invocation**: Un agente puede invocar el método `process_message` de otro agente directamente si están en el mismo runtime.
    - **Loop Prevention**: Mecanismo para detectar y detener ciclos infinitos de mensajes (TTL o Max Hops).

### 17.4. Function Calling & Tools
- **Bri Flow**:
    - Editor de herramientas personalizadas (JS/Python snippets) si no se usa MCP.
- **Backend**:
    - **Tool Registry**: Mapeo de nombres de herramientas a funciones ejecutables.
    - **Parser**: Convierte la respuesta del LLM (JSON de tool call) en ejecución de código.
    - **Safety**: Sandbox para ejecución de código arbitrario (si se permite) o validación estricta de parámetros.
