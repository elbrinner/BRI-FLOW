# BRI-FLOW — Editor visual de flujos (generador de JSON)

BRI-FLOW es un editor visual para diseñar flujos conversacionales/procesos a partir de nodos conectables. El resultado es un JSON estructurado que describe el flujo. Este repositorio contiene exclusivamente el editor (frontend) y utilidades de simulación. 

**Importante**: Para ejecutar un flujo real hace falta un backend/intérprete que procese el JSON y hable con canales/servicios externos. Ese backend no forma parte de este repositorio y no es open source.

## ⚠️ Estado del Proyecto

### Editor de Agentes: Inestable 🚧

La funcionalidad de **agentes** (nodo `agent_call`) está en **desarrollo activo** y puede presentar cambios incompatibles entre versiones:

- **Simulador**: 
  - ✅ **Estable** para perfiles `normal`, `domain_expert` y `rag` en modo directo (Azure OpenAI + Azure AI Search)
  - ⚠️ **Inestable** para perfiles `coordinator` y `retrieval` (requieren backend con implementación mínima)
  
- **Backend**: 
  - ✅ **Producción** para perfiles `normal`
  - 🚧 **Beta** para perfil `coordinator` (modos: `sequential`, `group_chat`, `fanout`) , `rag`, `retrieval`, `domain_expert`
  
- **Interfaz del Editor**: 
  - ⚠️ **Inestable** - El panel de configuración de `agent_call` puede cambiar al agregar nuevas capacidades
  - Los campos actuales (`agent_profile`, `message`, `system_prompt`, `search`, `participants`, `mode`, `stream`) se mantendrán, pero pueden aparecer nuevas opciones

**Recomendación**: Para producción, usa perfiles estables (`normal`, `rag`, `domain_expert`). Los perfiles experimentales (`coordinator`) son para pruebas y desarrollo.

### Otros Nodos: Estables ✅

Todos los demás tipos de nodos (`start`, `response`, `input`, `button`, `form`, `rest_call`, `condition`, `loop`, etc.) están **estables** y en producción.

## Probar online
- Puedes probar una versión hospedada aquí: https://elbrinner.com/flow/

## ¿Qué incluye este repo?
- Un canvas para componer nodos (drag & drop), prop panel por tipo de nodo y vista JSON.
- Renderers de nodos en `js/renderers/` para editar sus propiedades.
- Un simulador básico para probar la experiencia (no sustituye al backend definitivo).
 - Guías y patrones para definir flujos reutilizables (post‑vista y post‑solución) y el patrón extract/modify/inject.

## Tipos de Nodos Disponibles 📦

BRI-FLOW incluye **25+ tipos de nodos** organizados en categorías:

### Control de Flujo
- **`start`** - Define variables globales iniciales. En el flujo principal centraliza los idiomas soportados (`locales`).
- **`end`** - Termina el flujo
- **`condition`** - Evalúa expresión y salta según true/false
- **`set_goto`** - Guarda punto de retorno para navegación controlada
- **`flow_jump`** - Salta a otro flujo/nodo con opción de retorno

### Interacción con Usuario
- **`response`** - Muestra texto(s) al usuario (con soporte i18n)
- **`input`** - Solicita entrada de texto y guarda en variable
- **`button`** - Presenta opciones con botones (estático/dinámico)
- **`multi_button`** - Selección múltiple con opciones
- **`choice`** - Decisión interactiva (prompt) o programática (switch)
- **`form`** - Formulario con múltiples campos
- **`hidden_response`** - Asigna valor sin mostrar al usuario

### Datos y Variables
- **`assign_var`** - Asigna valores a variables (soporta expresiones)
- **`debug`** - Depuración con log de variables y payload

### Archivos
- **`file_upload`** - Permite subir archivo al usuario
- **`file_download`** - Ofrece descarga de archivo
- **`json_export`** - Exporta datos como JSON

### Multimedia y UI Avanzada
- **`hero_card`** - Tarjeta con título, imagen y botones
- **`carousel`** - Carrusel de tarjetas

### Iteración
- **`loop`** - Bucle genérico (foreach/while)
- **`foreach`** - Itera sobre una lista
- **`while`** - Ejecuta mientras condición sea verdadera

### Integraciones
- **`rest_call`** - Llamada HTTP REST con mapeo de respuesta
- **`agent_call`** - Invoca agente de IA (Azure OpenAI, RAG, etc.) ⚠️ **Inestable**
- **`extra`** - Punto de integración efímera (envío de payload desde frontend)

### Utilidades del Simulador (No exportables)
- **`credential_profile`** - Define credenciales para simulación (no se exporta)
- **`use_profile`** - Activa perfil de credenciales en simulador

> 📖 **Documentación completa**: Nodos en [docs/nodo.md](docs/nodo.md) · Expresiones/funciones en [docs/expresiones.md](docs/expresiones.md).

## Estado del proyecto y alcance
- Este editor está orientado a diseño de flujos y prototipado.
- El backend de ejecución (interpretación del JSON y orquestación) es propietario y no está publicado aquí.

## Motivación
- Hay muy pocas opciones para construir flujos conversacionales que integren LLM/IA de forma estructurada; este editor busca combinar lo mejor de los flujos deterministas por nodos con las capacidades generativas de los LLM.
- Unificar el diseño de flujos en un formato JSON portable entre canales y proyectos.
- Permitir que perfiles no técnicos puedan diseñar y validar experiencias sin depender del backend.
- Acelerar el prototipado y la comunicación entre producto y desarrollo.
- Separar responsabilidades: un editor abierto para modelar y un runtime propietario para ejecutar.
- Diseñar prompts, herramientas y variables/slots de forma explícita para guiar al LLM sin perder trazabilidad ni control.

## Tabla de Compatibilidad de Nodos 📊

| Tipo de Nodo | Estado | Simulador | Backend | Notas |
|--------------|--------|-----------|---------|-------|
| `start` | ✅ Estable | ✅ | ✅ | Único por flujo |
| `end` | ✅ Estable | ✅ | ✅ | - |
| `response` | ✅ Estable | ✅ | ✅ | Soporte i18n |
| `input` | ✅ Estable | ✅ | ✅ | - |
| `assign_var` | ✅ Estable | ✅ | ✅ | Soporta expresiones |
| `choice` | ✅ Estable | ✅ | ✅ | Modos: prompt/switch |
| `button` | ✅ Estable | ✅ | ✅ | Estático/dinámico |
| `multi_button` | ✅ Estable | ✅ | ✅ | Selección múltiple |
| `form` | ✅ Estable | ✅ | ✅ | - |
| `rest_call` | ✅ Estable | ✅ | ✅ | Requiere servidor HTTP en local |
| `condition` | ✅ Estable | ✅ | ✅ | - |
| `loop`/`foreach`/`while` | ✅ Estable | ✅ | ✅ | - |
| `set_goto` | ✅ Estable | ✅ | ✅ | - |
| `flow_jump` | ✅ Estable | ✅ | ✅ | - |
| `file_upload` | ✅ Estable | ⚠️ Limitado | ✅ | Simulador: solo validación |
| `file_download` | ✅ Estable | ✅ | ✅ | - |
| `json_export` | ✅ Estable | ✅ | ✅ | - |
| `hero_card` | ✅ Estable | ✅ | ✅ | Depende del canal |
| `carousel` | ✅ Estable | ✅ | ✅ | Depende del canal |
| `hidden_response` | ✅ Estable | ✅ | ✅ | - |
| `debug` | ✅ Estable | ✅ | ✅ | - |
| `extra` | ✅ Estable | ⚠️ Limitado | ✅ | Simulador: solo mockeo |
| **`agent_call`** | **🚧 Inestable** | **⚠️ Parcial** | **🚧 Beta** | Ver sección de agentes |
| `credential_profile` | ✅ Estable | ✅ | ❌ | Solo simulador, no exportable |
| `use_profile` | ✅ Estable | ✅ | ❌ | Solo simulador |

### Leyenda
- ✅ **Estable**: Producción, API estable
- 🚧 **Inestable**: En desarrollo, puede cambiar
- ⚠️ **Parcial/Limitado**: Funcionalidad reducida vs backend
- ❌ **No soportado**: No disponible en ese entorno

## Documentación de nodos

📖 **Documentación completa y detallada**: [docs/nodo.md](docs/nodo.md)

📖 **Referencia canónica de expresiones/funciones**: [docs/expresiones.md](docs/expresiones.md)

Cada tipo de nodo, sus campos y comportamiento están descritos en:

- [docs/nodo.md](docs/nodo.md)

Incluye:
- Descripción de cada tipo de nodo
- Propiedades y configuración
- Ejemplos de uso
- Expresiones y funciones disponibles
- Convenciones de i18n y variables

**Resumen rápido de nodos principales**:

### Patrones recomendados (EIRA)

- Patrón Extract/Work/Inject: documentado en `egoverabot-assistant/Docs/plan_plano.md`.
- Flujos reutilizables de salto (jump):
  - `eira_post_view_actions`: acciones tras completar una vista (flags, descargar y continuar o confirmar).
  - `eira_post_solution_actions`: acciones al finalizar todas las vistas (descargar solución, reiniciar con otro DBC o finalizar).

Estos patrones evitan duplicación y mejoran la legibilidad del JSON, separando “trabajo de la vista” de “acciones comunes”.

<details>
<summary><strong>Control de Flujo</strong> (5 nodos)</summary>

- **`start`**: Define variables globales iniciales. En el flujo principal define y centraliza los idiomas (`locales`). Solo uno por flujo.
- **`end`**: Termina el flujo. No debe tener `next`.
- **`condition`**: Evalúa expresión y salta a `true_target` o `false_target`.
- **`set_goto`**: Guarda en `context.goto` un identificador de retorno.
- **`flow_jump`**: Salta a otro flujo/nodo con opción de retorno automático.

</details>

<details>
<summary><strong>Interacción con Usuario</strong> (8 nodos)</summary>

- **`response`**: Muestra texto(s) al usuario (pueden rotar al azar). Soporta i18n.
- **`input`**: Pide un valor al usuario y lo guarda en variable.
- **`button`**: Presenta opciones con botones (modo estático o dinámico desde lista).
- **`multi_button`**: Selección múltiple con opciones (min/max selección).
- **`choice`**: 
  - Modo `prompt`: opciones interactivas
  - Modo `switch`: evalúa casos `when` y salta según condición
- **`form`**: Formulario con múltiples campos configurables.
- **`hidden_response`**: Asigna valor a variable sin mostrar al usuario.
- **`extra`**: Punto de integración efímera para envío de payload desde frontend.

</details>

<details>
<summary><strong>Datos y Variables</strong> (2 nodos)</summary>

- **`assign_var`**: Asigna uno o varios valores a variables. Soporta expresiones y rutas (ej: `persona.nombre`).
- **`debug`**: Depuración con log de variables y payload. Útil para troubleshooting.

</details>

<details>
<summary><strong>Archivos</strong> (3 nodos)</summary>

- **`file_upload`**: Permite al usuario subir archivo (configurar extensiones y tamaño máximo).
- **`file_download`**: Ofrece descarga de archivo al usuario.
- **`json_export`**: Exporta datos como archivo JSON con plantilla configurable.

</details>

<details>
<summary><strong>UI Avanzada</strong> (2 nodos)</summary>

- **`hero_card`**: Tarjeta con título, subtítulo, imagen y botones.
- **`carousel`**: Carrusel de múltiples tarjetas (depende del canal).

</details>

<details>
<summary><strong>Iteración</strong> (3 nodos)</summary>

- **`loop`**: Bucle genérico (UI general).
- **`foreach`**: Itera sobre una lista con `item_var` e `index_var`.
- **`while`**: Ejecuta mientras condición sea verdadera (con `max_iterations` opcional).

Opcionales avanzados: `break_if_expr`, `filter_expr`, `sort_expr`, `count_save_as`, `last_item_save_as`.

</details>

<details>
<summary><strong>Integraciones</strong> (2 nodos) ⚠️</summary>

- **`rest_call`**: 
  - Ejecuta petición HTTP (GET, POST, PUT, DELETE, PATCH)
  - Mapea respuesta a variables con `mappings`
  - Soporta mock mode: `off`, `fallback`, `always`
  - Simulador: requiere servidor HTTP con CORS habilitado

- **`agent_call`** 🚧 **Inestable**: 
  - Invoca agente de IA con Azure OpenAI
  - Perfiles disponibles: `normal`, `domain_expert`, `rag`, `coordinator`, `retrieval`
  - Soporta streaming (SSE) y modo sincrónico
  - Configuración de búsqueda (RAG) con Azure AI Search
  - Orquestación multi-agente (coordinator)
  - **Ver sección completa de agentes abajo** ↓

</details>

<details>
<summary><strong>Utilidades del Simulador</strong> (2 nodos - No exportables)</summary>

- **`credential_profile`**: Define credenciales para simulación (Azure OpenAI, AI Search). No se exporta en JSON final.
- **`use_profile`**: Activa perfil de credenciales por nombre para usar en `agent_call`.

Estos nodos facilitan pruebas sin exponer secretos en el flujo. El serializer los elimina automáticamente al exportar.

</details>

---

### Expresiones y Funciones

El editor soporta expresiones en múltiples campos (ej: `assign_var.value`, `condition.expr`, `choice.cases[].when`):

**Funciones de string**: `len()`, `split()`, `join()`, `trim()`, `upper()`, `lower()`, `contains()`

**Funciones de lista**: `addItem()`, `removeItem()`, `removeAt()`, `indexOf()`, `reverse()`, `slice()`

**Funciones de conversión**: `toNumber()`, `toString()`, `toBoolean()`

**Funciones lógicas**: `coalesce()`, `iif()`, `isEmpty()`, `isNotEmpty()`

**Funciones matemáticas**: `sum()`, `avg()`, `min()`, `max()`, `round()`

📖 Documentación completa de funciones y ejemplos: [docs/nodo.md#expresiones-y-funciones-disponibles](docs/nodo.md#expresiones-y-funciones-disponibles)

---

**Nota importante**: Todos los flujos deben terminar explícitamente con un nodo `end`. Aunque algunos recorridos puedan parecer "finales" (p. ej., sin `next`), normaliza tu diseño para que cada camino concluya en `end`; esto facilita validaciones, simulación y exportaciones.

## Cómo ejecutar en local

Requisitos mínimos:
- Navegador moderno (Chrome, Edge, Firefox, Safari actualizados).
- No requiere build ni dependencias: es una app estática (HTML/CSS/JS).

Opciones de ejecución:

- Opción A — Abrir el archivo directamente
  - Abre `index.html` con doble clic o desde tu navegador.
  - Útil para una prueba rápida del editor y el simulador.
  - Nota: los nodos `rest_call` y cualquier llamada HTTP NO funcionarán al abrir por `file://` debido a políticas del navegador (origen de archivo/CORS). Para probar llamadas HTTP usa la Opción B (servidor).

- Opción B — Servir como sitio estático (recomendado)
  - Usa cualquier servidor HTTP estático para la carpeta del proyecto (por ejemplo, una extensión tipo “Live Server” en VS Code).
  - Ventajas: comportamiento más realista, evita restricciones del navegador al abrir archivos locales.
  - En VS Code: instala la extensión “Live Server”, abre este proyecto y pulsa “Go Live” para abrirlo en `http://localhost:<puerto>`.
  - Arranque rápido opcional (Windows PowerShell):
    - Si tienes Python:
      
      ```powershell
      # en la raíz del proyecto
      py -m http.server 5500
      # luego abre http://localhost:5500
      ```

    - Si tienes Node.js:

      ```powershell
      # en la raíz del proyecto
      npx http-server -p 5500
      # luego abre http://localhost:5500
      ```

Flujo básico de uso
1) Abre la app en el navegador (por archivo directo o `http://localhost:<puerto>` si usas un servidor).
2) Crea un flujo con `start` → añade nodos → conecta destinos.
3) Usa el simulador para validar recorridos. Recuerda: el simulador es orientativo; la ejecución real depende del backend propietario.

Notas útiles
- Persistencia: el proyecto/estado del editor se guarda en el almacenamiento local del navegador (localStorage). Si quieres “resetear” el estado, limpia el almacenamiento del sitio desde las herramientas de desarrollador del navegador.
- Llamadas externas: nodos como `rest_call` pueden necesitar un backend accesible y con CORS habilitado para pruebas reales. En ausencia de eso, utilízalos solo como referencia estructural durante el diseño.

## Pruebas del simulador (paridad y avanzadas)

Para ejecutar las pruebas del simulador (paridad de funciones y casos avanzados) usa la página dedicada del runner, no el `index.html` principal:

- Abre: `tests/test-runner.html`
- Allí encontrarás botones para:
  - “Tests listas” (addItem, removeItem, removeAt)
  - “Tests expresiones” (todas las funciones documentadas y composiciones)
  - “Tests avanzados” (nesting de join/split/addItem, coalesce con join vacío, índices fuera de rango, igualdad laxa, etc.)

Los resultados se muestran en el panel de la página y en la consola del navegador.

## Configuración local del simulador (REST y Agente)

Para validar flujos que hacen llamadas reales a servicios (REST o Agente) o para trabajar en modo mock sin editar nodos uno por uno, puedes colocar un archivo opcional `docs/sim.local.json`. Al cargar la app, el simulador intentará leerlo automáticamente.

Ejemplo de `docs/sim.local.json`:

```json
{
  "http_mock_global": false,
  "rest": {
    "base_url": "http://localhost:7071", 
    "default_headers": {
      "X-Env": "local",
      "Authorization": "Bearer <tu_token>"
    }
  },
  "agent_api_base": "http://localhost:5000", 
  "agent": {
    "api_base": "http://localhost:5000",
    "mock_mode": "off", 
    "mock": {
      "text": "Hola, soy un agente simulado.",
      "citations": [],
      "usage": { "prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2 },
      "threadId": "mock-thread-1"
    }
  }
}
```

Notas:
- `rest.base_url` y `rest.default_headers` se aplican a los `rest_call` cuando la URL del nodo es relativa.
- `http_mock_global` activa/desactiva el modo mock HTTP global del simulador (los nodos `rest_call` también pueden definir mock propio por nodo).
- Para el modo “backend legado” de agente (si lo usas), el base se toma de `agent_api_base` (nivel raíz) o `agent.api_base`.
- Para `agent_call`, además del mock por nodo (`props.mock_mode`, `props.mock`), ahora puedes controlar un mock global de agente vía `agent.mock_mode` con valores:
  - `off`: nunca mock (por defecto).
  - `fallback`: usa mock sólo si la llamada real falla.
  - `always`: siempre responde con el mock.

## Agentes sin backend (directo a Azure OpenAI) 🔌

El simulador puede llamar directamente a Azure OpenAI, sin backend. Usa el nodo `agent_call` con un `model` como:

```json
{
  "provider": "azure-openai",
  "deployment": "gpt-4o-mini",
  "temperature": 0.2,
  "max_tokens": 800
}
```

Para no exponer secretos en el JSON del flujo, define credenciales efímeras mediante nodos de utilidad:

- `credential_profile` (sim-only): guarda un perfil de credenciales en memoria del simulador.
  - Estructura típica de `credentials`:
    ```json
    {
      "aoai_endpoint": "https://<tu-recurso>.openai.azure.com",
      "aoai_api_key": "<API_KEY>",
      "aoai_api_version": "2025-01-01-preview",
      "aoai_chat_deployment": "gpt-4o-mini"
    }
    ```
  - El nodo no se persiste en el JSON exportado (tiene `__sim_only: true`).
- `use_profile`: activa el perfil por nombre (p. ej., `default`, `sim`, etc.).

Flujo mínimo (sin backend):
1) `credential_profile` (profile: "default") → 2) `use_profile` (profile: "default") → 3) `agent_call` (model.provider = "azure-openai").

Streaming: marca la casilla “Streaming (SSE)” en `agent_call` para recibir chunks. Si hay CORS o red bloqueada, usa `mock_mode: "fallback"` o `"always"` (a nivel de nodo o en `sim.local.json`).

## Demos incluidas para validar

En `docs/` encontrarás flujos de ejemplo listos para cargar desde el simulador:

**Flujos básicos**:
- **`demo_multi_button.json`**: Opciones dinámicas con `multi_button` (min/max, `save_as`) y uso de la selección para filtrar una lista.
- **`demo_form.json`**: Formulario con guardado de variables y demostración del nodo `extra` (ephemeral) encadenado a `response` y `debug`.

**Flujos de agentes** ⚠️ Requieren credenciales:
- **`demo_agent_azure_direct.json`**: Flujo mínimo para llamar a Azure OpenAI directamente desde el simulador usando `credential_profile` + `use_profile` + `agent_call` (stream/no-stream).
- **`demo_agent_rag.json`**: Flujo completo de RAG (Retrieval-Augmented Generation) que demuestra búsqueda en Azure AI Search + generación contextualizada con Azure OpenAI. Incluye ejemplos de buenas prácticas.

**Cómo usar las demos**:
1. Abre el simulador (`index.html`)
2. Haz clic en **"Importar Flujo"**
3. Selecciona el archivo `.json` de la demo
4. Para demos de agentes: configura credenciales primero (ver sección "Perfiles del simulador")
5. Haz clic en **"▶ Simular"** para ejecutar

Importa estos archivos desde la UI del simulador para validar rápidamente el comportamiento end-to-end.

## Perfiles del simulador (credenciales) 🧩

Para gestionar credenciales de forma segura durante la simulación sin exponerlas en los flujos exportados, el simulador incorpora un sistema de perfiles:

- Botón “Perfiles” en la cabecera del simulador: abre un diálogo para crear/editar/eliminar perfiles, activar uno como “actual”, hacer ping a Azure OpenAI e importar/exportar perfiles (JSON) en local.
- Chip de estado: muestra el perfil activo y su estado (p. ej., AOAI OK/ERROR) cuando hay datos suficientes para probar conectividad.
- Nodo `credential_profile` (sim-only): ahora incluye opciones “Persistir en localStorage” y “Activar perfil tras guardar”.
  - Si marcas “Persistir”, las credenciales se guardan en este navegador (localStorage) y quedarán disponibles en sesiones futuras. Si no, sólo se mantienen en memoria mientras la página esté abierta.
  - Este nodo jamás se exporta con el flujo; el serializer lo elimina y re-encadena el grafo automáticamente, protegiendo tus secretos.
- Nodo `use_profile`: activa un perfil por nombre (útil para encadenar a `agent_call`).

Sugerencia de uso
1) Crea un perfil con tus credenciales reales (botón “Perfiles”) y actívalo.
2) O bien usa un nodo `credential_profile` al inicio del flujo con “Persistir” y “Activar” marcados para preparar el entorno de pruebas automáticamente.
3) Ejecuta `agent_call` con provider `azure-openai`. Si hay problemas de CORS o red, habilita `mock_mode: "fallback"` o `"always"` en el nodo o en `docs/sim.local.json`.

### Campos admitidos en un perfil

Un perfil del simulador puede incluir distintos bloques, inspirados en `appsettings.*.json` del backend:

```
{
  "name": "default",
  "aoai_endpoint": "https://<recurso>.openai.azure.com",
  "aoai_api_key": "<API_KEY>",
  "aoai_api_version": "2025-01-01-preview",
  "aoai_chat_deployment": "gpt-4.1-mini",
  "aoai_embeddings_deployment": "text-embedding-3-large",          // opcional
  "aoai_embeddings_api_version": "2023-05-15",                      // opcional
  "ai_search_endpoint": "https://<recurso>.search.windows.net",     // opcional
  "ai_search": "<SEARCH_API_KEY>",                                  // opcional
  "ai_search_default_index": "video-index",                          // opcional
  "ai_search_semantic_config": "my-semantic-config"                  // opcional
}
```

Notas:
- `agent_call` (provider `azure-openai`) usa `aoai_*` (endpoint, api_key, api_version, chat_deployment).

## Perfiles de Agente y RAG 🤖🔍

⚠️ **Estado**: El nodo `agent_call` y sus capacidades están en **desarrollo activo**. La API puede cambiar en futuras versiones.

El simulador soporta diferentes **perfiles de agente** para distintos casos de uso:

### ✅ Perfiles Estables (Modo Directo sin backend)

Estos perfiles funcionan completamente en el simulador con Azure OpenAI + Azure AI Search:

| Perfil | Estado | Descripción | Credenciales Requeridas |
|--------|--------|-------------|------------------------|
| `normal` | ✅ Producción | Chat básico sin herramientas | AOAI: endpoint, api_key, deployment |
| `domain_expert` | ✅ Producción | Chat con system prompt especializado | AOAI: endpoint, api_key, deployment |
| `rag` | ✅ Producción | Chat con búsqueda en documentos (RAG) | AOAI + AI Search: endpoint, api_key, index |

### 🚧 Perfiles Experimentales (Requieren Backend)

| Perfil | Estado | Descripción | Por qué requiere backend |
|--------|--------|-------------|--------------------------|
| `coordinator` | 🚧 Beta | Orquestación multi-agente | Tool calling, delegación, modos (sequential/group_chat/fanout) |
| `retrieval` | ✅ Producción | Solo recuperación sin generación | Lógica especial de filtrado y ranking |

### Configuración de `agent_call`

**Propiedades principales**:

```javascript
{
  "type": "agent_call",
  "agent_profile": "rag",           // normal | domain_expert | rag | coordinator | retrieval
  "message": "{{input}}",            // Pregunta del usuario (usa plantillas)
  "system_prompt": "...",            // Instrucciones/rol del sistema
  "thread_var": "agent_thread_id",  // Variable para mantener conversación
  "stream": true,                    // true=SSE streaming | false=sincrónico
  "save_as": "agent_response",      // Variable destino de la respuesta
  
  // Configuración de búsqueda (para rag/retrieval)
  "search": {
    "index": "video-index",          // Índice de Azure AI Search
    "top_k": 3,                       // Número de documentos a recuperar
    "mode": "hybrid",                 // hybrid | semantic | keyword
    "semanticConfiguration": "..."   // Opcional
  },
  
  // Configuración de coordinator (experimental)
  "participants": ["retrieval", "rag", "domain_expert"],  // Sub-agentes
  "mode": "sequential",              // sequential | group_chat | fanout
  
  // Configuración de modelo
  "model": {
    "provider": "azure-openai",      // Para modo directo
    "deployment": "gpt-4",
    "temperature": 0.2,
    "max_tokens": 800
  },
  
  "next": "show_response"
}

### Usar RAG en el Simulador

**RAG (Retrieval-Augmented Generation)** permite que el agente busque en documentos antes de generar la respuesta.

**Ejemplo de flujo completo**:

1. **Configura el perfil** con credenciales de Azure AI Search:
```json
{
  "name": "mi-perfil-rag",
  "aoai_endpoint": "https://mi-openai.openai.azure.com",
  "aoai_api_key": "...",
  "aoai_chat_deployment": "gpt-4",
  "ai_search_endpoint": "https://mi-search.search.windows.net",
  "ai_search": "...",
  "ai_search_default_index": "video-index"
}
```

2. **Crea un nodo `agent_call`** con perfil RAG:
```json
{
  "type": "agent_call",
  "agent_profile": "rag",
  "message": "{{input}}",
  "system_prompt": "Eres un asistente que responde usando documentos. Cita las fuentes con [N].",
  "search": {
    "index": "video-index",
    "top_k": 5
  },
  "stream": true,
  "model": {
    "provider": "azure-openai",
    "temperature": 0.2
  },
  "next": "end"
}
```

3. **El simulador automáticamente**:
   - ✅ Consulta Azure AI Search con la pregunta del usuario
   - ✅ Recupera los documentos más relevantes (top_k)
   - ✅ Construye el contexto RAG con los resultados
   - ✅ Envía todo a Azure OpenAI para generar la respuesta contextualizada

**Flujo de ejecución RAG**:

```
Usuario: "¿Qué dice el video sobre Python?"
   ↓
[Azure AI Search] Busca en índice "video-index"
   ↓
[Resultados] 5 documentos encontrados:
   [1] video_001.mp4: "Tutorial de Python básico..."
   [2] video_002.mp4: "Python para ciencia de datos..."
   ...
   ↓
[Contexto RAG] Se construye con los documentos
   ↓
[Azure OpenAI] Genera respuesta usando el contexto
   ↓
Respuesta: "Según los documentos encontrados [1][2], 
            Python es un lenguaje de programación..."
```

### Herramientas de Prueba y Diagnóstico

**Para probar RAG y agentes**:

- 🧪 **`test_rag.html`**: Interfaz visual standalone para probar búsquedas en Azure AI Search y RAG completo
  - Prueba solo búsqueda para ver qué documentos encuentra
  - Prueba RAG completo (búsqueda + generación de respuesta)
  - Visualiza resultados, contexto y respuesta del agente

- 🔍 **`debug_profiles.html`**: Diagnóstico de credenciales y perfiles
  - Inspecciona contenido de localStorage
  - Verifica perfiles disponibles y perfil activo
  - Prueba resolución de credenciales paso a paso

- 📖 **`docs/simulador_rag.md`**: Documentación completa del flujo RAG
  - Cómo funciona RAG internamente
  - Comparación: modo directo vs backend
  - Troubleshooting y solución de problemas

- 📝 **`docs/guia_rapida_rag.md`**: Guía paso a paso para comenzar con RAG
  - Configuración de credenciales
  - Ejecución del flujo demo
  - Verificación de logs

- 🎯 **`docs/demo_agent_rag.json`**: Flujo de ejemplo completo y funcional
  - Importar directamente desde el simulador
  - Ver configuración completa de RAG
  - Ejemplo de buenas prácticas

### Logs de Diagnóstico

En la consola del navegador (F12) verás el flujo completo de ejecución:

**Para perfiles en modo directo** (`normal`, `domain_expert`, `rag`):
```
[Simulador] Usando Azure OpenAI directo (perfil: rag)
[AOAI] Perfil activo: mi-perfil-rag
[AOAI] Credenciales finales: endpoint: https://...
[RAG] Perfil RAG detectado, iniciando búsqueda en Azure AI Search...
[RAG] Consultando: https://....search.windows.net/indexes/video-index/docs/search?...
[RAG] Encontrados 5 resultados
[RAG] Contexto construido: [1] video_001.mp4: ...
```

**Para perfiles que requieren backend** (`coordinator`, `retrieval`):
```
[Simulador] ⚠️ Perfil coordinator NO soportado en modo directo (requiere backend)
⚠️ El perfil "coordinator" requiere el backend para funcionar correctamente.

Este perfil utiliza capacidades avanzadas (orquestación multi-agente, tools personalizados)
que no están disponibles en el modo directo de Azure OpenAI.

✅ Para probar este perfil, asegúrate de que el backend esté ejecutándose en: http://localhost:5000
```

### Comparación: Modo Directo vs Backend

| Característica | Modo Directo (Simulador) | Backend |
|----------------|--------------------------|---------|
| **Perfiles soportados** | `normal`, `domain_expert`, `rag` | Todos |
| **Latencia** | ✅ Baja (sin hop adicional) | ⚠️ Media (pasa por backend) |
| **Búsqueda (RAG)** | ✅ Simple (searchMode: 'any') | ✅ Avanzada (ranking, filtros semánticos) |
| **Tool calling** | ❌ No | ✅ Sí |
| **Multi-agente** | ❌ No | ✅ Sí (`coordinator`) |
| **Caché** | ❌ No | ✅ Sí (opcional) |
| **Logs/Telemetría** | ⚠️ Solo consola navegador | ✅ Azure Monitor, métricas |
| **CORS** | ⚠️ Requiere configuración | ✅ Gestionado por backend |
| **Deployment** | ✅ Ninguno (solo navegador) | ⚠️ Requiere infraestructura |

**Recomendación**: 
- **Desarrollo/Prototipado**: Usa modo directo para perfiles simples y RAG
- **Producción**: Usa backend para funcionalidad completa, observabilidad y seguridad

### Mejores Prácticas para `agent_call` 📌

**Variables y plantillas**:
- ✅ Usa `{{ input }}` para inyectar la pregunta del usuario en `message`
- ✅ Evita saltos de línea dentro de `{{ }}` (escribe en una sola línea)
- ✅ El backend persiste automáticamente `request.input` en variables `input` y `last_user_input`
- ❌ No dejes `message` vacío (el backend omitirá la llamada)

**System prompts**:
- ✅ Sé específico sobre el formato de respuesta esperado
- ✅ Para RAG: instruye al modelo a citar fuentes con `[N]`
- ✅ Define el tono y rol claramente (ej: "Eres un experto en...")
- ⚠️ System prompts muy largos consumen tokens

**Conversaciones (threads)**:
- ✅ Usa `thread_var` para mantener contexto entre turnos
- ✅ Guarda el valor en una variable persistente (ej: `"thread_var": "agent_thread_id"`)
- ⚠️ Los threads tienen límite de tokens acumulados

**Streaming**:
- ✅ `stream: true` - Mejor UX (respuesta incremental)
- ✅ `stream: false` - Útil cuando necesitas procesar la respuesta completa con `assign_var`
- ⚠️ Streaming requiere que el nodo siguiente sea `end` o no dependa de la respuesta

**RAG y búsqueda**:
- ✅ Usa `top_k` entre 3-5 para balance entre contexto y tokens
- ✅ `searchMode: "hybrid"` combina búsqueda semántica y por palabras clave
- ⚠️ Índices grandes pueden requerir filtros para mejorar precisión
- ⚠️ CORS debe estar habilitado en Azure AI Search para modo directo

**Manejo de errores**:
- ✅ Configura `mock_mode: "fallback"` durante desarrollo
- ✅ Usa nodos `condition` para validar `agent_response` antes de usarlo
- ⚠️ En producción, valida que las credenciales estén configuradas

**Perfiles experimentales** (`coordinator`):
- ⚠️ API inestable, puede cambiar sin aviso
- ⚠️ Solo para experimentación, no usar en producción
- ✅ Los modos `sequential`, `group_chat`, `fanout` tienen comportamientos diferentes
- ⚠️ Costes de tokens se multiplican (varios agentes ejecutándose)

### Troubleshooting Rápido de Agentes 🔧

<details>
<summary><strong>"Faltan credenciales Azure OpenAI"</strong></summary>

**Causa**: El perfil activo no tiene credenciales completas.

**Solución**:
1. Abre el Gestor de Perfiles (botón en cabecera)
2. Verifica que el perfil activo tenga:
   - `aoai_endpoint`
   - `aoai_api_key`
   - `aoai_chat_deployment`
3. Usa el botón **"Probar AOAI"** para validar
4. Si falla, revisa las credenciales en Azure Portal

</details>

<details>
<summary><strong>"Faltan credenciales de Azure AI Search" (RAG)</strong></summary>

**Causa**: El perfil activo no tiene credenciales de AI Search.

**Solución**:
1. Abre el Gestor de Perfiles
2. Agrega:
   - `ai_search_endpoint`
   - `ai_search` (API key)
   - `ai_search_default_index`
3. Usa el botón **"Probar SEARCH"** para validar
4. Verifica que el chip de estado muestre "SEARCH OK"

</details>

<details>
<summary><strong>"HTTP 404" al buscar en AI Search</strong></summary>

**Causa**: El índice no existe o el nombre está mal escrito.

**Solución**:
1. Ve a Azure Portal → AI Search → Indexes
2. Verifica que el índice existe
3. Copia el nombre exacto al perfil
4. Prueba de nuevo con `test_rag.html`

</details>

<details>
<summary><strong>"CORS error" al consultar servicios</strong></summary>

**Causa**: Azure AI Search o Azure OpenAI bloquean peticiones desde tu origen.

**Solución**:
1. **Azure AI Search**: Portal → CORS → Agregar `http://localhost:*` o tu dominio
2. **Azure OpenAI**: CORS está habilitado por defecto
3. **Alternativa**: Usa el backend que gestiona CORS por ti

</details>

<details>
<summary><strong>"Perfil coordinator no soportado"</strong></summary>

**Causa**: Los perfiles `coordinator` y `retrieval` requieren backend.

**Solución**:
- Usa perfiles `normal`, `domain_expert` o `rag` en modo directo
- O ejecuta el backend para usar perfiles avanzados
- El simulador muestra mensaje explicativo automáticamente

</details>

<details>
<summary><strong>La respuesta no usa los documentos (RAG)</strong></summary>

**Causa**: No se encontraron documentos relevantes o la búsqueda falló.

**Solución**:
1. Abre consola del navegador (F12)
2. Busca logs `[RAG]`
3. Verifica que `Encontrados N resultados` sea > 0
4. Si N = 0:
   - Reformula la pregunta con términos más específicos
   - Aumenta `top_k` (ej: 5 → 10)
   - Verifica que el índice tenga documentos
5. Usa `test_rag.html` para probar solo la búsqueda

</details>

<details>
<summary><strong>El agente responde muy lento</strong></summary>

**Causa**: Modelo grande, contexto extenso o búsqueda lenta.

**Solución**:
- Reduce `top_k` en búsqueda RAG (ej: 5 → 3)
- Usa modelo más rápido (ej: `gpt-4o-mini` en lugar de `gpt-4`)
- Reduce `max_tokens` si no necesitas respuestas largas
- Acorta el `system_prompt`
- Verifica latencia de red (Azure region)

</details>

---

- Campos de embeddings y Azure AI Search quedan disponibles para nodos o funciones futuras (p. ej., RAG) y para mockear integraciones.

## Contribuciones
¡Se agradecen issues y PRs! Al contribuir, aceptas que tus aportes se licencian bajo los mismos términos indicados en la licencia del proyecto para su inclusión.

 

## Aviso sobre el backend
- El backend que interpreta y ejecuta el JSON NO está incluido en este repositorio.
- Ese componente es propietario y no open source.
- Este editor genera el JSON de flujo y ayuda a probarlo de forma limitada con el simulador.

## Estructura rápida
- `index.html`: app principal.
- `components/`: paneles HTML para cada tipo de nodo.
- `js/`: módulos del editor y simulador (factory, renderers, UI, serializer, etc.).
- `js/renderers/`: renderers de propiedades por nodo.
- `css/style.css`: estilos.
- `docs/nodo.md`: documentación de nodos.

## Roadmap y Estado Actual 🗺️

### ✅ Completado (Producción)

- **Editor visual** completo con drag & drop, canvas, prop panels
- **25+ tipos de nodos** documentados y funcionales
- **Simulador** con soporte para la mayoría de nodos
- **Sistema de perfiles** para gestión de credenciales (localStorage)
- **Expresiones y funciones** (40+ funciones matemáticas, string, lista, lógicas)
- **Internacionalización (i18n)** con soporte multi-idioma
- **Agentes básicos** (`normal`, `domain_expert`) en modo directo
- **RAG completo** con Azure AI Search + Azure OpenAI
- **Streaming SSE** para respuestas incrementales
- **Mock modes** (off/fallback/always) para desarrollo sin servicios
- **Herramientas de debug** (test_rag.html, debug_profiles.html)

### 🚧 En Desarrollo (Beta/Experimental)

- **Perfiles de agente avanzados**:
  - ⚠️ `coordinator` (orquestación multi-agente: sequential/group_chat/fanout)
  - ⚠️ Tool calling personalizado
  - ⚠️ Mejoras en ranking y filtrado semántico (RAG avanzado)

- **UI del editor**:
  - Mejoras en el panel de `agent_call`
  - Validaciones en tiempo real de credenciales
  - Preview de búsqueda RAG en el editor

### 📋 Pendiente (Futuro)

**Validaciones y testing**:
- Validaciones avanzadas por nodo (tipado de variables, linting de rutas)
- Pruebas automáticas del flujo (simulación headless, snapshots I/O)
- Cobertura de caminos y detección de nodos inalcanzables

**Colaboración**:
- Control de versiones de flujos (Git-like)
- Comentarios y anotaciones en nodos
- Modo multiusuario

**Biblioteca y reutilización**:
- Plantillas/snippets reutilizables por dominio
- Biblioteca de flujos comunitarios
- Composición de sub-flujos (importar flujos como nodos)

**Extensibilidad**:
- Plugins/extensiones para renderers personalizados
- Validadores específicos por tipo de nodo
- Conectores a distintos backends

**Contenido e i18n**:
- Gestión de catálogos de texto
- Sistema de traducción integrado
- Revisión y aprobación de cambios

**Accesibilidad y UX**:
- Atajos de teclado completos
- Modo compacto del canvas
- Ayudas contextuales y tooltips
- Búsqueda de nodos en el canvas

**Agentes y LLM** (largo plazo):
- MCP (Model Context Protocol): actuar como proveedor/consumidor
- A2A (Agent-to-Agent): coordinación y negociación entre agentes
- Función calling estructurado con validación de esquemas
- Observabilidad LLM: trazas, contadores de tokens, costes por sesión
- Evaluación de calidad de respuestas (RAG metrics)

## Visión y futuras ideas (Archivo)
- Colaboración y control de versiones de flujos (multiusuario, cambios comentados).
- Validaciones avanzadas: tipado de variables, linting de rutas, cobertura de caminos.
- Biblioteca de plantillas/snippets reutilizables por dominio.
- Plugins/extensiones: renderers personalizados y validadores específicos.
- Pruebas automáticas del flujo (simulación headless, snapshots de I/O).
- Integraciones: import/export desde otras herramientas y conectores a distintos backends.
- Gestión de contenido e i18n (catálogos, traducciones, revisión).
- Accesibilidad y UX: atajos de teclado, modo compacto, ayudas contextuales.
- Agentes: orquestación de agentes con herramientas/acciones, memoria y objetivos dentro del grafo de nodos.
- MCP (Model Context Protocol): actuar como proveedor y/o consumidor para integrar herramientas y contextos estándar.
- A2A (Agent-to-Agent): coordinación entre agentes, negociación de pasos y transferencia de estado.
- Conexiones por LLM: function/tool calling, validación de esquemas/JSON, structured outputs y manejo de errores.
- RAG: conectores a fuentes de conocimiento y evaluaciones de calidad de respuesta.
- Observabilidad LLM: trazas, contadores de tokens y costes por sesión.

## Créditos
© Elbrinner da Silva Fernandes — Autores de BRI-FLOW.

## Licencia
Este proyecto se distribuye bajo Business Source License 1.1 (BUSL-1.1). Consulta el archivo `LICENSE.md` para más detalles.
