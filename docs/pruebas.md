# Pruebas

## Unit / Smoke (Node)

- `npm run test:form` existe como prueba de Node+JSDOM, pero actualmente referencia `js/nodes/processForm.js` (archivo no presente en este repo). Considera este script como **legado** hasta que se re-alinee con el código actual.

Además existen runners HTML para pruebas del simulador:

- `tests/test-runner.html`
- `tests/test-runner-nodes.html`

## E2E (Playwright)

La configuración está en `playwright.config.js` y usa:

- `baseURL`: `http://localhost:8081`
- `webServer`: `python3 -m http.server 8081`

Pasos:

1. `npm install`
2. (Primera vez) `npx playwright install`
3. Ejecutar:
   - `npm run test:e2e`

## Resultados

- El reporte/resultado se imprime en consola (reporter: `list`).
- Artefactos pueden quedar en `test-results/`.
