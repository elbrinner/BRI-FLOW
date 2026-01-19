# Documentación de nodos

Este documento describe cada tipo de nodo disponible en BRI-FLOW, sus propiedades principales y cómo se conectan con otros nodos. Entre paréntesis se indica el `type` del nodo tal como aparece en el JSON.

Nota: el JSON generado por el editor requiere un backend/intérprete externo (no incluido en este repo) para su ejecución real.

## Índice rápido
- Ir directo a: [Expresiones y funciones](expresiones.md)
- Tipos de nodo (paleta): `start`, `response`, `hidden_response`, `input`, `assign_var`, `choice` / `choice_switch`, `button`, `multi_button`, `rest_call`, `condition`, `loop` / `foreach` / `while`, `flow_jump`, `set_goto`, `hero_card`, `carousel`, `form`, `file_upload`, `json_upload`, `json_export`, `file_download`, `extra`, `debug`, `agent_call`, `use_profile`, `credential_profile`, `end`

## Inicio (start)
- Propósito: Define variables globales iniciales y los idiomas (locales) del flujo. Solo puede existir un `start` por flujo.
- Props clave:
  - `variables`: lista de objetos { name, defaultValue, isList }.
  - `locales`: array de códigos de idioma (p. ej., ["es", "en"]). El editor lo sincroniza también en `meta.locales` por compatibilidad.
  - `enable_debug` (bool, opcional): habilita señales/debug del runtime.
  - `next`: primer nodo a ejecutar.
- Notas: El panel muestra/edita tags de idioma y variables. El `start` no se puede renombrar ni eliminar.

## Respuesta (response)
- Type: `response`
- Propósito: Muestra uno o más textos (pueden rotar al azar) y continúa.
- Props: `i18n.<locale>.text` (array de líneas), `next`.
- Opcional: `dataInfo` texto/plantilla adicional.

## Entrada (input)
- Type: `input`
- Propósito: Pide un valor al usuario y lo guarda en una variable.
- Props: `i18n.<locale>.prompt`, `save_as`, `next`.

## Asignar variable (assign_var)
- Type: `assign_var`
- Propósito: Asigna uno o varios valores a variables en el contexto.
- Props (formas soportadas):
  - Simple (la más común en el editor): `target` (string) y `value` (string/JSON).
  - Bulk (compat/avanzado): `assignments` (array) aceptando claves como `{ name|target|variable, valueExpr|value|expression }`.
  - `next`.
- Notas:
  - Admite `{{ ... }}` en `value`/`valueExpr`.
  - Si usas rutas (p. ej. `persona.nombre`) depende del runtime si crea/actualiza objetos.

## Decisión (choice)
- Type: `choice`
- Modos:
  - `prompt`: opciones interactiva(s) con botones/elecciones.
  - `switch`: evalúa casos `when` (expresiones) y salta a `target` del primer caso verdadero, si no usa `default_target` o `next`.
- Props prompt: `i18n.<locale>.prompt`, `options` (label + target), `allow_free_text`.
- Props switch: `cases: [{ when, target }]`, `default_target`.

## Botón (button)
- Type: `button`
- Propósito: Presenta una o varias acciones tipo botón.
- Modos:
  - `static`: lista fija de `options[{ label, target, variant }]`.
  - `dynamic`: genera opciones desde `provider`.
- Props comunes: `i18n.<locale>.prompt`, `variant` (en dinámico), `optional`, `save_as` (nombre variable donde guardar selección), `next` (solo dinámico).
- Provider (dinámico): `{ source_list, label_expr, value_expr, filter_expr, sort_expr }`.

## Multi-botón (multi_button)
- Type: `multi_button`
- Propósito: Selección múltiple.
- Props: `mode` (`static`/`dynamic`), `options` (estático), `provider` (dinámico), `save_as`, `min_selected`, `max_selected`, `default_values`, `next` (solo dinámico).

## Formulario (form)
- Type: `form`
- Propósito: Define y renderiza un conjunto de campos.
- Props: `fields` (lista de campos con `name` y otras propiedades dependientes del builder), `next`.

## Llamada REST (rest_call)
- Type: `rest_call`
- Propósito: Ejecuta una petición HTTP y mapea resultados a variables.
- Props clave: `method`, `url`, `headers`, `body`, `save_as`, `mappings` (array de reglas de extracción), `next`.
- Simulador: `mock_mode` (`off|fallback|always`), `mock` (objeto JSON).
- Mappings: cada mapping `{ name, path, type }` asigna variables desde `response`/`response.data`.

## Agente (agent_call)
- Type: `agent_call`
- Propósito: Invoca un agente de conversación integrado (Agent Framework) con opción de streaming SSE o ejecución sin streaming guardando en variable.
- Props clave (preferido): se guardan en `props.*`.
  - Compatibilidad: si un flujo trae campos legacy en raíz (`agent_profile`, `message`, etc.), al guardar se normalizan a `props.*`.
  - `props.agent_profile` (string): perfil del agente. Valores típicos: `normal`, `rag`, `coordinator`, `retrieval`, `domain_expert` (y otros perfiles avanzados si el runtime los soporta).
  - `props.execution_mode` (string): `local` | `remote`.
  - `props.message` (string): texto del usuario; admite plantillas `{{ }}`. Recomendado: `{{ input }}`.
  - `props.system_prompt` (string): instrucciones/rol del sistema.
  - `props.stream` (bool): `true` para SSE; `false` para ejecución sin streaming.
  - `props.save_as` (string): variable destino de la respuesta.
  - `props.tooling` (array): lista simple de herramientas.
  - `props.model` (obj): configuración del modelo.
  - `props.search` (obj, opcional): configuración de búsqueda para `rag/retrieval`.
  - `props.participants` (array, opcional): cuando `agent_profile = "coordinator"`, define participantes a orquestar.
    - `retrieval`: prepara contexto (no genera texto por sí mismo).
    - `rag`: usa RAG (adjunta herramienta nativa cuando está disponible y, si no, concatena contexto) y cita fuentes cuando aplique.
    - `domain_expert`: tono/políticas de experto.
    - `normal`: asistente general.
  - `props.mode` (string, opcional): sólo con `agent_profile = "coordinator"`. Valores habituales: `sequential`, `group_chat`, `fanout`.
    - `sequential`: ejecuta participantes en orden; el último se emite en streaming si `stream=true`.
    - `group_chat`: rondas cortas entre participantes y una síntesis final (el paso de síntesis se streamea).
    - `fanout`: ejecuta participantes en paralelo, selecciona una respuesta ganadora por heurística simple (domain_expert > rag > longitud) y suma el coste total.

Notas importantes
- El backend persiste automáticamente `request.input` en las variables `input` y `last_user_input` al inicio del request; usa `{{ input }}` en `message/system_prompt` para inyectarlo.
- Evita `{{ }}` con saltos de línea; escribe `{{ input }}` en una sola línea.
- Si `message` queda vacío, el backend omite la llamada para evitar errores y lo reporta en logs.

Perfiles

Los perfiles disponibles y su comportamiento dependen del runtime/backend configurado. El editor expone perfiles comunes como `normal`, `rag`, `coordinator`, `retrieval`, `domain_expert`.

Ejemplo mínimo (no‑stream → pintar luego con `response`)

```json
{
  "id": "ag_pregunta",
  "type": "agent_call",
  "props": {
    "agent_profile": "rag",
    "message": "{{ input }}",
    "system_prompt": "Responde con citas cuando existan.",
    "search": { "mode": "hybrid", "indexes": ["docs-es"], "topK": 5, "semanticConfiguration": "semantic-es" },
    "save_as": "agent_result",
    "stream": false
  },
  "next": "r_mostrar"
}
```

Luego en `response`:

```json
{
  "id": "r_mostrar",
  "type": "response",
  "i18n": { "es": { "text": ["{{ agent_result.data.text }}"] } },
  "next": "end"
}
```

> Nota: `coordinator` implementado con modos `sequential`, `group_chat` y `fanout`. El evento final de SSE incluye `isFinal=true`, `usage` agregado y, si aplica, `citations`. Heurística y métricas pueden evolucionar manteniendo compatibilidad con `save_as`.

### Ejemplos rápidos — coordinator

Secuencial con 3 participantes (retrieval → domain_expert → rag)

```json
{
  "id": "ag_coord_seq",
  "type": "agent_call",
  "props": {
    "agent_profile": "coordinator",
    "mode": "sequential",
    "participants": ["retrieval","domain_expert","rag"],
    "message": "{{ input }}",
    "system_prompt": "Consolida respuestas claras usando el contexto when available.",
    "search": { "mode": "hybrid", "indexes": ["docs-es"], "topK": 5, "semanticConfiguration": "semantic-es" },
    "stream": false,
    "save_as": "agent_result"
  },
  "next": "r_mostrar"
}
```

Group chat con síntesis final (streameada)

```json
{
  "id": "ag_coord_gc",
  "type": "agent_call",
  "props": {
    "agent_profile": "coordinator",
    "mode": "group_chat",
    "participants": ["domain_expert","rag"],
    "message": "{{ input }}",
    "system_prompt": "Facilita un debate breve entre participantes y sintetiza una única respuesta final.",
    "search": { "mode": "semantic", "indexes": ["docs-es"], "topK": 3, "semanticConfiguration": "semantic-es" },
    "stream": true
  },
  "next": "end"
}
```


## Condición (condition)
- Type: `condition`
- Propósito: Evalúa `expr` y salta a `true_target` o `false_target`.
- Props: `expr` (plantilla/expresión), `true_target`, `false_target`.

## Bucle (loop)
- Types: `loop` (UI general), `foreach`, `while` (paleta específica)
- Foreach:
  - Props: `mode: 'foreach'`, `source_list` (lista/expresión), `item_var`, `index_var`, `body_start`, `next`.
- While:
  - Props: `mode: 'while'`, `cond` (expr), `max_iterations` (opcional), `body_start`, `next`.
- Opcionales avanzados: `break_if_expr`, `filter_expr`, `sort_expr`, `count_save_as`, `last_item_save_as`.

## Ir a (set_goto)
- Type: `set_goto`
- Propósito: Guarda en `context.goto` un identificador de retorno; útil para navegación controlada.
- Props: `target`, `next`.

## Salto de flujo (flow_jump)
- Type: `flow_jump`
- Propósito: Saltar a otro flujo/nodo con opción de retorno automático.
- Props: `target { flow_id, node_id }`, `return_on_end` (bool), `return_target { flow_id, node_id }` (opcional), `apply_start_defaults` (`none|onlyMissing|overwrite`).

## Subida de archivo (file_upload)
- Type: `file_upload`
- Props: `accept` (extensiones), `max_size`, `save_as`, `next`.

## Descarga de archivo (file_download)
- Type: `file_download`
- Props: `file_url`, `filename`, `description`, `next`.

## Exportar JSON (json_export)
- Type: `json_export`
- Props: `filename`, `description`, `template` (objeto JSON), `next`.

## Subir JSON (json_upload)
- Type: `json_upload`
- Propósito: Permite subir un archivo `.json`, validarlo y enviarlo como `extra` al runtime (y opcionalmente guardarlo como variable local).
- Props: `prompt`, `validate` (bool), `save_parsed`/`save_as` (opcional), `schema` (JSON Schema, opcional), `on_error` (`show|fail`), `next`.

## Hero Card (hero_card)
- Type: `hero_card`
- Props: `title`, `subtitle`, `text`, `image_url`, `buttons` (array), `next`.

## Carrusel (carousel)
- Type: `carousel`
- Props: `cards` (array de tarjetas), `next`.

## Respuesta oculta (hidden_response)
- Type: `hidden_response`
- Propósito: Evalúa/transporta información sin mostrarla en UI.
- Props: `dataInfo` (o `data_info`), `next`.

## Debug (debug)
- Type: `debug`
- Props: `message` (plantilla), `payload` (texto/JSON), `save_as` (opcional), `next`.

## Usar perfil de credenciales (use_profile)
- Type: `use_profile`
- Propósito: Establece el perfil activo para que los nodos siguientes lo usen.
- Props (preferido): `props.profile`.
- Nota: este nodo se exporta “tal cual” (solo el nombre del perfil, no secretos).

## Definir perfil de credenciales (credential_profile)
- Type: `credential_profile`
- Propósito: Definir credenciales locales para el simulador.
- Props (preferido): `props.profile`, `props.credentials` (JSON), `props.persist` (bool), `props.activate` (bool), `__sim_only: true`.
- Nota: **solo para simulador**; no debería exportarse a entornos reales.

## Event Start (event_start)
- Type: `event_start`
- Propósito: Inicio de flujo por evento (si el runtime lo soporta).
- Props: `event_type` (p.ej. `webhook`), `filter_expr`.

## Human Validation (human_validation)
- Type: `human_validation`
- Propósito: Validación humana con timeout (si el runtime lo soporta).
- Props: `timeout` (segundos), `approvers` (roles/usuarios), `on_timeout` (target).

## Coordinator (coordinator)
- Type: `coordinator`
- Propósito: Orquestación de sub-agentes (si el runtime lo soporta).
- Props: `strategy` (`fan_out|round_robin|sequential`), `sub_agents` (lista), `aggregation` (`concat|summarize`).

## Fin (end)
- Type: `end`
- Propósito: Termina el flujo.
- Conexiones: no debe tener `next`.

## Extra (extra)
- Type: `extra`
- Propósito: Marca un punto interactivo para que el frontend envíe un payload efímero en `request.extra` hacia el backend. Útil para integraciones puntuales o para pasar metadatos del cliente sin usar `input/choice`.
- Props:
  - `next`: nodo destino cuando llega `extra`.
  - `optional`: si está presente, el intérprete puede decidir saltarlo si `extra` no llega (depende del backend).
- Notas:
  - No requiere `prompt`. El frontend solo necesita el `id` del nodo para decidir qué enviar.
  - El valor de `extra` NO se persiste automáticamente: es efímero por paso. Si quieres guardarlo, añade un `assign_var` inmediatamente después para copiar `{{extra}}` o una ruta (`{{extra.algo}}`) a una variable.
  - El editor no ejecuta lógica de backend; en el simulador se muestra un mensaje genérico y un área para simular el `extra`.

Ejemplo mínimo:

```json
{
  "id": "n_extra_confirma",
  "type": "extra",
  "next": "r_gracias"
}
```

Patrón de persistencia posterior:

```json
{
  "id": "a_guardar_extra",
  "type": "assign_var",
  "assignments": [
    { "target": "vars.last_extra", "value": "{{extra}}" }
  ],
  "next": "r_sigue"
}
```

---

### Convenciones de conexiones y destinos
- `next`: puede ser string `node_id` o objeto `{ flow_id, node_id }`.
- Campos alternativos para opciones: `option.target` o `option.next` (el editor normaliza a `{ flow_id, node_id }`).
- En `loop`, el cuerpo se inicia con `body_start` y avanza siguiendo `next` de cada nodo del cuerpo.

### Internacionalización (i18n)
- La mayoría de nodos de UI usan `i18n` por locale: `prompt` (input/choice/button) y `text` (response). Si se añaden nuevos locales en `start`, el editor asegura que existan claves por defecto.

### Variables
- Nodos que suelen escribir variables: `input.save_as`, `rest_call.save_as` y `mappings`, `file_upload.save_as`, `button.save_as`, `assign_var.assignments[].target`/`value`.
- El `start` inicializa `window.App.runtimeContext.variables` con los `defaultValue` (se intenta parsear JSON básico y coerción numérica/booleana).

---

## Expresiones y funciones disponibles

Las expresiones se usan en múltiples nodos (p. ej., `assign_var.value`, `choice.switch.cases[].when`, `loop.cond`, `provider.*_expr`). El editor y el backend comparten semántica para las funciones descritas aquí. Puedes combinar funciones (anidar) libremente.

Notas generales
- Tipos de retorno: se indica entre paréntesis.
- Literales soportados: strings `'texto'` o `"texto"`, números, `true|false`, `null`, `undefined`.
- Rutas a variables: `user.name`, `resp.data.title`.
- Anidación: se permiten llamadas anidadas como `join(split('a|b','|'), ', ')` o `addItem(split('a|b','|'), 'c')`.

Funciones de string/lista y utilidades
- `len(x) -> number`: longitud de string o de lista; `len('hola') == 4`.
- `split(s, sep) -> list`: divide `s` por `sep`; `split('a,b,c', ',') == ['a','b','c']`.
- `join(list, sep) -> string`: une elementos con `sep`; `join(['x','y','z'], ', ') == 'x, y, z'`.
- `toNumber(x) -> number`: intenta convertir a número; `toNumber('42') == 42`.
- `trim(s) -> string`: quita espacios; `trim(' hola ') == 'hola'`.
- `upper(s) -> string`, `lower(s) -> string`.
- `contains(hay, needle) -> boolean`:
  - Si `hay` es lista/colección, busca por igualdad laxa el elemento `needle` (números vs strings se consideran iguales si su valor coincide). Ej.: `contains(split('a,b', ','), 'a') == true`.
  - Si `hay` es string, verifica substring. Ej.: `contains('banana','ana') == true`.
- `startsWith(s, pref) -> boolean`, `endsWith(s, suf) -> boolean`.
- `isEmpty(x) -> boolean`: true si `x` es null/undefined, string vacío o lista vacía. Nota: `isEmpty(split('', ',')) == false` (split devuelve `['']`).
- `coalesce(a, b, c, ...) -> any`: devuelve el primer argumento no vacío (no null/undefined y no string vacío). Ej.: `coalesce('', null, 'x') == 'x'`.

Funciones de chequeo de null/undefined
- `isNull(x) -> boolean`: true si `x` es null o undefined.
- `isNotNull(x) -> boolean`: negación de `isNull`.
- `isDefined(x) -> boolean`: true si `x` está definido y no es null.
- `isUndefined(x) -> boolean`: true si `x` es undefined o null.

Funciones para listas (no mutan la fuente; retornan nueva lista)
- `addItem(list, value[, index]) -> list`:
  - Inserta `value` al final si `index` está ausente o no es numérico.
  - Si `index` está fuera de rango, se ajusta a `[0..len]` (clamp).
  - Ej.: `addItem(['a','b'], 'X', 1) == ['a','X','b']`.
- `removeItem(list, value) -> list`:
  - Remueve la primera coincidencia por igualdad laxa (número 2 y string '2' equivalen).
  - Ej.: `removeItem([1,'2',3], 2) == [1,3]`.
- `removeAt(list, index) -> list`:
  - Remueve el elemento en `index` si está en rango; de lo contrario no hace nada.
  - Ej.: `removeAt(['a','b','c'], 0) == ['b','c']`.

Ejemplos de composición
- `join(split('x|y|z','|'), ', ') == 'x, y, z'`.
- `coalesce(trim(user.nickname), user.name, 'invitado') == 'bru'` (si `user.nickname` es `' bru '`).
- `join(addItem(split('a|b','|'), 'c'), ' - ') == 'a - b - c'`.

Validación rápida de expresiones
- Usa la página de pruebas dedicada: `tests/test-runner.html`.
  - “Tests expresiones”: cubre todas las funciones documentadas y composiciones comunes.
  - “Tests avanzados”: casos de anidación (join/split/addItem), índices fuera de rango, igualdad laxa, etc.
