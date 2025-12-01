# Cómo importar y probar los flujos EIRA en BRI-FLOW

## Archivos incluidos
- docs/flows/eira_main.json — Flujo principal (roles y entrada).
- docs/flows/eira_upload.json — Ingesta (crear/subir/sin archivo).
- docs/flows/eira_view_loop.json — Selección de DBC y bucle por vistas.
- docs/flows/eira_catalogue_sections.json — Gestión de catálogos/secciones.

## Importación
1. Abre BRI-FLOW en el navegador (index.html con un servidor local; evita file://).
2. Crea un proyecto y un flujo vacío (o usa cualquiera activo).
3. En el menú Proyecto, pulsa “Importar” y selecciona cada JSON (uno por uno).
4. En la ventana de flujos (icono de capas), marca `eira_main` como principal y ábrelo.

## Variables requeridas
- En el Start de `eira_main` define:
  - apiBaseUrl: URL base del backend.
  - apiKey: clave del header x-api-key (si aplica).

## Ejecución (simulador)
- Pulsa “Ejecutar flujo” y sigue las pantallas.
- Si tu backend no acepta CORS, activa el modo mock en cada rest_call o ejecuta tras un proxy.

## Notas
- Los nodos con descripcion explican dónde escribir en journeyResp según tu modelo real.
- Ajusta provider.label_expr/value_expr según la forma exacta de tu /userRoles y journey.
