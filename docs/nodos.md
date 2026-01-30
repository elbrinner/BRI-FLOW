# Nodos

BRI-FLOW organiza la lógica del flujo como un grafo de nodos conectados. Cada nodo tiene un `type` y un conjunto de propiedades editables en el panel lateral.

## Dónde se definen

- Paneles HTML por tipo de nodo: `components/panel-*.html`
- Renderers/controladores por nodo: `js/renderers/*`
- Registro/fábrica de nodos: `js/node_factory.js`

## Categorías típicas

- Control de flujo: `start`, `end`, `condition`, `flow_jump`, `set_goto`
- UI/Interacción: `response`, `input`, `button`, `multi_button`, `choice`, `form`, `hero_card`, `carousel`, `hidden_response`
- Datos/variables: `assign_var`, `debug`
- Integraciones: `rest_call`, `agent_call` (ver [Agentes](agentes.md))
- Archivos: `file_upload`, `file_download`, `json_export`

## Convenciones

- `start` suele concentrar configuración global del flujo (por ejemplo `locales`).
- Nodos “solo simulador” existen para facilitar pruebas locales y normalmente no se exportan en el JSON final.

## Referencia práctica

Para entender campos exactos por nodo, lo más confiable es:

- Ver el panel correspondiente en `components/`.
- Ver el renderer correspondiente en `js/renderers/`.
