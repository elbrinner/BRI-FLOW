# Agentes (agent_call)

El nodo `agent_call` está orientado a invocar un backend de agentes/LLM.

## Estado

- El soporte de agentes en el editor es **activo** y puede cambiar.
- El simulador soporta un subconjunto de perfiles/modos.

## Implementación en este repo

- Renderer: `js/renderer_agent_call.js`
- Conectores Copilot/LLM: `js/copilot/*`
- Borrador de contrato: `openapi_draft.yaml`

## Perfiles

Se mencionan perfiles típicos como:

- `normal`
- `domain_expert`
- `rag`
- `coordinator` (experimental)
- `retrieval` (experimental)

Los perfiles y campos exactos dependen del backend.

## Credenciales (solo simulador)

Para pruebas en local, existen nodos que ayudan a gestionar credenciales sin exportarlas:

- `credential_profile`
- `use_profile`

El serializer puede excluirlos del JSON exportado.
