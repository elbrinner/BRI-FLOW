# Desarrollo local

## Requisitos

- Node.js (para ejecutar pruebas)
- Python 3 (opcional, para servir el frontend con `http.server`)

## Ejecutar el editor

Opción A (simple): abrir el archivo

- Abre `index.html` en el navegador.

Opción B (recomendada para evitar restricciones del navegador con archivos locales)

- Ejecuta un servidor estático:
  - `python3 -m http.server 8081`
- Abre `http://localhost:8081`

## Dependencias

Este repo usa `package.json` principalmente para pruebas.

- Instalar dependencias:
  - `npm install`

## Estructura de scripts

Ver scripts disponibles en `package.json`:

- `npm run test:form`
- `npm run test:e2e`

## Notas

- El editor funciona 100% en el navegador.
- Algunas características (p. ej. llamadas HTTP en `rest_call`) pueden requerir CORS o endpoints locales de prueba.
