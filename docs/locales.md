# Locales centralizados en nodo Start (flujo principal)

A partir de la refactorización de diciembre 2025, la definición de idiomas soportados por el proyecto se centraliza en el **nodo `start` del flujo principal** (aquel cuyo `meta.is_main` es `true`).

## Motivación
- Evitar inconsistencias entre subflujos que antes podían declarar `meta.locales` diferentes.
- Reducir complejidad: una sola lista de idiomas guía la generación y edición de textos i18n.
- Facilitar validaciones y tooling (export, serializer, integración con backend).

## Comportamiento
- Al crear un nuevo nodo `start` en el flujo principal: 
  - Si `stateRef.meta.locales` existe y es una lista no vacía, se copia a `base.locales`.
  - Si no, se inicializa con `['es']`.
- Cuando el nodo `start` principal se crea o reemplaza, se sincroniza `state.meta.locales = base.locales` para compatibilidad con código legado que aún consulta `meta.locales`.
- Los subflujos (flujos sin `is_main: true`) ya no deben definir su propio conjunto de locales: heredan implícitamente los del flujo principal.

## Edición
- El panel de propiedades del nodo `start` del flujo principal debe permitir editar la lista (pendiente si UI aún no se ha ajustado).
- Formato sugerido: entrada separada por comas (`es,en,pt`). Internamente se guarda como array `['es','en','pt']`.

## Impacto en otros nodos
- Nodos con soporte i18n (`response`, `input`, `choice`, `button`, etc.) toman la lista de locales centralizada.
- Si se remueve un idioma de la lista, los textos existentes en ese locale quedan huérfanos; el serializer debería ignorarlos al exportar (mejora futura).

## Migración de flujos antiguos
1. Leer `meta.locales` de cada flujo.
2. Unificar (union) o elegir el del flujo marcado como principal (`is_main: true`).
3. Escribir esa lista en el nodo `start` del flujo principal y asignar `state.meta.locales`.
4. Eliminar `meta.locales` de subflujos (opcional; se puede dejar pero se ignora).

## Buenas prácticas
- Mantén la lista de locales corta y realista (ej: `['es','en']`). Idiomas sin contenido rellenado añaden ruido.
- Antes de agregar un nuevo idioma, asegúrate de que el flujo principal tenga mecanismos para completar traducciones (tooling futuro: checklist de cobertura de i18n).
- Evita cambiar el orden de la lista para no generar diffs innecesarios en control de versiones.

## Próximos pasos (potenciales)
- Validación en el editor: advertir si faltan textos para algún locale agregado.
- Comando de "sincronizar locales" que elimina keys huérfanas.
- Integración con backend para fallback automático al primer locale si falta una traducción.

## Referencia de implementación
- Archivo: `js/node_factory.js`
  - Sección: case 'start' en `initNodeByType`
  - Sincronización: bloque dentro de `createNode(type === 'start')`.

## Ejemplo JSON (fragmento)
```json
{
  "meta": { "flow_id": "principal", "is_main": true, "start_node": "start_1" },
  "nodes": {
    "start_1": {
      "id": "start_1",
      "type": "start",
      "x": 120,
      "y": 80,
      "variables": ["usuario_nombre", "pais"],
      "locales": ["es", "en"],
      "next": { "node_id": "resp_1" }
    }
  }
}
```

## FAQ
**¿Puedo tener locales distintos en un subflujo?** No recomendado. La lógica asume un conjunto global coherente.

**¿Qué pasa si elimino el nodo start?** No debe eliminarse. Si se reemplaza, el nuevo copia los locales del meta; conservar uno por flujo es obligatorio.

**¿Qué ocurre si añado un locale nuevo?** Los nodos i18n mostrarán campos vacíos para ese locale; completa manualmente.

---
Última actualización: 2025-12-01
