# Contribuir

## Issues y PRs

- Abre un Issue con contexto (capturas si aplica) y pasos de reproducción.
- Para PRs, describe claramente el cambio y su motivación.

## Estilo y alcance

- Cambios pequeños y enfocados.
- Evita refactors masivos si no son necesarios.

## Pruebas

Antes de abrir un PR, ejecuta al menos:

- `npm run test:form`

Si modificas UI o flujos críticos, idealmente también:

- `npm run test:e2e`
