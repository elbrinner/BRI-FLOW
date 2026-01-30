# Visión general

BRI-FLOW es un editor visual para diseñar flujos conversacionales/procesos usando nodos conectables. El resultado es un JSON estructurado que describe el flujo.

## Qué hay en este repositorio

- Editor visual (canvas, nodos, paneles de propiedades, exportación/importación JSON)
- Renderers y paneles por tipo de nodo
- Simulador/runner en navegador para probar la experiencia de forma local
- Pruebas unitarias ligeras (Node + JSDOM) y E2E (Playwright)

## Qué NO hay en este repositorio

- Backend/rutina de ejecución para producción (interpretación del JSON, integración con canales, credenciales reales, etc.)

## Flujo de trabajo típico

1. Diseñar el flujo en el editor.
2. Exportar el JSON.
3. Probar rápidamente con el simulador.
4. Integrar el JSON en un runtime/backend (externo a este repo).
