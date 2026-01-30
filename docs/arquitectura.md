# Arquitectura

## Estructura del proyecto (alto nivel)

- `index.html`: UI principal del editor.
- `components/`: plantillas HTML para paneles/modales.
- `css/`: estilos.
- `js/`: lógica del editor, renderers, serializer y simulador.
- `tests/`: pruebas unitarias ligeras y E2E.

## Componentes principales

### Editor

- Canvas y UX
  - `js/canvas_*`, `js/selection_manager.js`, `js/ui_*`, `js/keyboard_controls.js`
- Gestión del flujo
  - `js/flow_manager.js`, `js/project_flows.js`, `js/serializer.js`, `js/flow_importer.js`
- Nodos
  - Fábrica/renderizado: `js/node_factory.js`, `js/node_renderer.js`, `js/renderers/*`
  - Paneles HTML: `components/panel-*.html`

### Simulador

- Core/UI
  - `js/simulador-core.js`, `js/simulador-ui.js`, `js/simulador.js`
- Evaluación y utilidades
  - `js/simulador-evaluator.js`, `js/simulador-utils.js`

### Expresiones

- Parser y evaluador: `js/expression_parser.js`

## JSON exportado (conceptual)

El editor exporta un JSON que describe:

- Metadatos del flujo (id, nombre, locales, nodo inicial, etc.)
- Nodos (id, tipo, posición, propiedades)
- Conexiones/edges entre nodos

El **serializer** elimina nodos “solo simulador” (p. ej. perfiles de credenciales) cuando corresponde.

## Integraciones

- `openapi_draft.yaml` es un borrador de contrato para un backend de agentes (no implementado aquí).
