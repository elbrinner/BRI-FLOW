# Documentación de nodos

Este documento describe cada tipo de nodo disponible en BRI-FLOW, sus propiedades principales y cómo se conectan con otros nodos. Entre paréntesis se indica el `type` del nodo tal como aparece en el JSON.

Nota: el JSON generado por el editor requiere un backend/intérprete externo (no incluido en este repo) para su ejecución real.

## Inicio (start)
- Propósito: Define variables globales iniciales y los idiomas (locales) del flujo. Solo puede existir un `start` por flujo.
- Props clave:
  - `variables`: lista de objetos { name, defaultValue, isList }.
  - `meta.locales`: array de códigos de idioma (p. ej., ["es", "en"]).
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
- Props:
  - `assignments`: array de { target, value }. `target` puede incluir ruta (p. ej.: `persona.nombre`).
  - `next`.
- Notas: admite evaluación de expresiones dentro de `{{ ... }}` y referencias tipo `context.*`.

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

## Hero Card (hero_card)
- Type: `hero_card`
- Props: `title`, `subtitle`, `text`, `image_url`, `buttons` (array), `next`.

## Carrusel (carousel)
- Type: `carousel`
- Props: `cards` (array de tarjetas), `next`.

## Respuesta oculta (hidden_response)
- Type: `hidden_response`
- Props: `varName`, `value`, `next`.

## Debug (debug)
- Type: `debug`
- Props: `message` (plantilla), `payload` (texto/JSON), `save_as` (opcional), `next`.

## Fin (end)
- Type: `end`
- Propósito: Termina el flujo.
- Conexiones: no debe tener `next`.

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
