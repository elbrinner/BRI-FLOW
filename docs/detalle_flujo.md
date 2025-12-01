# Detalle del flujo EIRA en BRI-FLOW

Este documento profundiza en: variables y su ciclo de vida (tipo, uso, alcance), cómo extraemos y actualizamos contenido del JSON de trabajo (journeyResp), qué rutas rellenamos, qué flujo se arranca al cargar un JSON, cómo reanudamos el proceso, y cómo calcular porcentajes de avance.

## 1) Arquitectura de flujos y arranque

Flujos:
- eira_main (principal): entrada, roles y ramificación inicial. Arranca siempre (is_main=true) y es dueño de las variables globales.
- eira_upload: ingesta (crear, subir, sin archivo) → normaliza journeyResp.
- eira_view_loop: selección de DBC, modo (Follow/Skip) y bucle de vistas.
- eira_catalogue_sections: gestión BA → DS → UCS para la vista activa.
- eira_post_view_actions: flujo reutilizable tras completar una vista (flags, decisión de descarga y salto de retorno).
- eira_post_solution_actions: flujo reutilizable tras completar todas las vistas (descarga final y decidir si reiniciar con otro DBC o finalizar).
- eira_download: exportación (parcial por vista o solución completa).
- postSolutionNext (string: select_dbc|finish, global)
  - Origen: `eira_post_solution_actions`.
  - Uso: al volver a `eira_view_loop`, un dispatcher decide entre reiniciar selección de DBC o terminar.

Alias de tipos de nodo (UI):
- Para simplificar la UI y reutilizar paneles, algunos tipos se agrupan mediante alias:
  - form → extra (mismo panel para formularios y extras simples)
  - file_upload → extra (subida de archivo usa el panel de extra)
  - json_export → extra (exportación básica desde el mismo panel)
  - multi_button → button (comportamiento extendido pero mismo grupo lógico)
  - choice → button (selector simple como variantes de botón)
  - loop → flow (panel de iteración dentro de grupo de flujo)
  Estas equivalencias no afectan la semántica del flujo; sólo organizan la presentación en el editor/inspector.

Regla de arranque al cargar un JSON (recomendado):
- El flujo principal es `eira_main`. Si detectas que ya existe `journeyResp` con DBCs (p.ej., al importar un proyecto/estado):
  - Puedes añadir una condición al inicio de `eira_main` que, si `len(journeyResp.DigitalBusinessCapabilities) > 0`, salte directo a `eira_view_loop`.
  - Si no, sigue el camino normal pasando por `eira_upload`.

Nota: En BRI-FLOW, el flujo activo al abrir depende de cuál esté marcado como Principal. Asegura que `eira_main` sea el principal (Project → Marcar principal).

## 2) Catálogo de variables

- apiBaseUrl (string, global)
  - Origen: Start de `eira_main` (editable).
  - Uso: construir URLs de REST.
- apiKey (string, global)
  - Origen: Start (inyectable; evita persistir secretos en export público).
  - Uso: header `x-api-key`.
- infoRolesResp (objeto, global)
  - Origen: rest_call GET /userRoles (save_as).
  - Uso: proveedor dinámico de `button` de roles (source_list = data|content).
- roleSelected (objeto|string, global)
  - Origen: selección en `button` (roles).
  - Uso: condicional de rol; POST /journey/{role}.
- journeyResp (objeto, global)
  - Origen: POST /journey (mappings → $.data.content) o file_upload (.content).
  - Uso: JSON de trabajo para todo el análisis/diseño.
- filteredNonEmptyDBCnames (lista<string>, global)
  - Origen: cálculo tras ingesta (select/where sobre DBCs con metodología).
  - Uso: filtrado/diagnóstico; opcional para UI.
- selectedDBC (objeto, global)
  - Origen: `button` dinámico en eira_view_loop.
  - Uso: fuente del bucle de vistas.
- beginDecision (string: Follow|Skip, global)
  - Origen: `button` en eira_view_loop.
  - Uso: guía de cómo presentar vistas/pasos (secuencial vs salto).
- selectedView (string|objeto breve, global)
  - Origen: `button` dinámico (vistas por orden actual) en eira_view_loop.
  - Uso: clave de vista activa para secciones y flags.
- selectedPhase (string: Analysis|Design, global)
  - Origen: Start de `eira_catalogue_sections` (valor por defecto "Analysis"; puede ser actualizado por el flujo principal o por UI).
  - Uso: decidir de forma explícita en qué fase se extraen/reinyectan las secciones (evita depender de heurísticas tipo "si existe Analysis").
  - UX: si `selectedPhase` ya viene definida (por ejemplo, la fijó el flujo padre), el flujo salta la selección y continúa directo a la extracción; si no, muestra un botón inicial para elegir (Analysis/Design).
  - Skip condicional adicional: además de la fase, ahora aplicamos skips para listas vacías de BA y DS (ver sección "Skip condicional de secciones").
- postViewNext (string: lf_1|lo_views, global)
  - Origen: `eira_post_view_actions`.
  - Uso: indica al flujo padre si debe volver a confirmar (lf_1) o continuar automáticamente con la iteración (lo_views).
- frontData (objeto, global)
  - Origen: Start; stepNumber inicial.
  - Uso: tracking de pasos; lectura opcional para UI/telemetría.
- flagViewDone (boolean, global)
  - Origen: set en eira_catalogue_sections al completar la vista.
  - Uso: lógica de reentrada al loop.
- downloadOriginFlow (string: NormalView|FinishedSolution, global)
  - Origen: set en eira_catalogue_sections (NormalView) y al terminar loop (FinishedSolution).
  - Uso: decide variante de export en eira_download.

Tipos y ámbito: Todas son “globales” al definirse en el Start del flujo principal o setearse antes de saltar a otros flujos. BRI-FLOW comparte el contexto entre `flow_jump` (con apply_start_defaults=onlyMissing).

## 3) Estructura del JSON (journeyResp) que atacamos

Campos típicos:
- DigitalBusinessCapabilities: lista de DBCs con Roadmap (Methodology, RoadmapItems[View, Order, …])
- Analysis y Design: diccionarios por vista (p.ej., Analysis["Architecture"]), cada uno con catálogos:
  - BusinessAgnostic
  - DomainSpecific
  - UseCaseSpecific (con Items)

Extracciones principales:
- Lista de DBCs: `journeyResp.DigitalBusinessCapabilities`
- Vistas por DBC y orden:
  - `orderBy(selectedDBC.Roadmap.RoadmapItems, it.Order)` produce la secuencia de vistas.
  - Para listar vistas del orden actual: `where(selectedDBC.Views, it.Order == viewItem.Order)`

Rellenos principales (ejemplos):
- BA/DS: persistir selección del `button` dinámico (p. ej. `baSelection`, `dsSelection`) dentro de la rama adecuada:
  - `journeyResp[selectedPhase][selectedView].BusinessAgnostic = baSelection`
  - `journeyResp[selectedPhase][selectedView].DomainSpecific = dsSelection`
  - (sustituye `selectedPhase` por `Analysis` o `Design` si prefieres rutas explícitas)
- UCS: formulario → `journeyResp.Analysis[selectedView].UseCaseSpecific.Items = ucsItems`

Nota: En los flujos dejé comentarios `descripcion` indicando “dónde escribir” para no forzar una estructura si tu JSON difiere ligeramente. Ajusta las rutas exactas a tu shape final.

## 4) Dónde empezamos y cómo sabemos por dónde seguir

- Inicio del proyecto: `eira_main` (principal). Desde ahí:
  - Si no hay JSON, `eira_upload` guía la creación/subida.
  - Si ya hay JSON, puedes saltar a `eira_view_loop` con una condición temprana.
- Reanudación (continuar rellenando):
  - Basada en flags y contenido:
    - Si la vista `V` tiene secciones pendientes (por ejemplo, `UseCaseSpecific` vacía) → presentar esa sección.
    - Si `RoadmapItems` marca `AnalysisCompleted`/`DesignCompleted` para una vista → saltarla.
  - El nodo loop `lf_1` (eira_view_loop) recorre `selectedDBC.Roadmap.RoadmapItems` por `Order` y, en cada vuelta, ofrece con `choose_view` las vistas del orden actual. Puedes ampliar con condiciones para ocultar vistas ya completas.

Ejemplo de condición para filtrar vistas ya completadas:
- `provider.source_list` del `choose_view` →
  - `where(selectedDBC.Views, it.Order == viewItem.Order && !it.AnalysisCompleted)`

## 5) Cálculo de porcentajes de avance

Hay varias granularidades. Dos aproximaciones usuales:

A) Progreso por vista (secciones acabadas / secciones existentes)
- totalSectionsForView = número de secciones presentes para la vista `V` (BA existe? + DS existe? + UCS existe?).
- completedSectionsForView = cuenta de secciones marcadas o con contenido:
  - BA completado si `len(BA) > 0` o flag equivalente
  - DS completado si `len(DS) > 0` o flag equivalente
  - UCS completado si `len(UCS.Items) > 0` o flag equivalente
- progressViewPercent = `round( (completedSectionsForView / totalSectionsForView) * 100 )`

Ejemplos de expresiones (ExpressionParser):
- `totalSectionsForView = sum([ coalesce(journeyResp.Analysis[selectedView].BusinessAgnostic, []) , coalesce(journeyResp.Analysis[selectedView].DomainSpecific, []) , coalesce(journeyResp.Analysis[selectedView].UseCaseSpecific.Items, []) ], it => 1)  // suma 1 por sección existente`
- Simpler: `count([ journeyResp.Analysis[selectedView].BusinessAgnostic , journeyResp.Analysis[selectedView].DomainSpecific , journeyResp.Analysis[selectedView].UseCaseSpecific.Items ], it => isDefined(it))`
- `completedSectionsForView = count([ journeyResp.Analysis[selectedView].BusinessAgnostic , journeyResp.Analysis[selectedView].DomainSpecific , journeyResp.Analysis[selectedView].UseCaseSpecific.Items ], it => isDefined(it) && len(it) > 0)`
- `progressViewPercent = round( (toNumber(completedSectionsForView) / coalesce(toNumber(totalSectionsForView),1)) * 100 )`

B) Progreso de solución (vistas completadas / vistas totales)
- totalViews = `len(selectedDBC.Roadmap.RoadmapItems)` 
- completedViews = `count(selectedDBC.Roadmap.RoadmapItems, it => it.AnalysisCompleted || it.DesignCompleted)`
- progressSolutionPercent = `round( (toNumber(completedViews) / coalesce(toNumber(totalViews),1)) * 100 )`

Consejos:
- Si el dataset distingue fase (Analysis vs Design), considera separar métricas por fase.
- Si hay ponderaciones por sección, ajusta con un peso (por ejemplo, UCS vale 2x) usando `sum` con un `selector` que devuelva el peso.

## 6) Buenas prácticas aplicadas

- Documentación inline: cada nodo lleva `descripcion` con propósito y notas.
- Fase explícita: utiliza `selectedPhase` para evitar ramas implícitas según existencia de nodos en `Analysis`/`Design`.
- Skip condicional de secciones: al extraer listas planas, aplicamos condiciones `c_has_ba` y `c_has_ds`:
  - `c_has_ba`: si `len(currentBA) == 0` salta la selección BusinessAgnostic y pasa directamente a la fase DS.
  - `c_has_ds`: si `len(currentDS) == 0` salta la selección DomainSpecific y pasa directamente a UCS.
  Esto reduce fricción cuando una vista no define elementos para esas categorías.
- Variables globales en el Start de `eira_main` para coherencia entre flujos.
- `flow_jump` con `return_on_end=true` y `apply_start_defaults=onlyMissing` para encapsular pasos (descarga) sin perder contexto.
- REST con `mappings` mínimos: ubicamos exactamente `$.data.content` (ajusta si tu backend devuelve `content` directo).
- Evitar “sentinelas” del canal (Composer) usando `button/form`, salvo que busques compatibilidad exacta.

## 7) Qué rellenamos (checklist)

- Tras ingesta:
  - `journeyResp.DigitalBusinessCapabilities[*].Roadmap.Methodology` debe existir.
  - `journeyResp.Analysis[view]` / `journeyResp.Design[view]` deben existir o crearse perezosamente.
- En secciones por vista:
  - BA: set de elementos seleccionados.
  - DS: set de elementos seleccionados.
  - UCS: Items del formulario.
  - Flags de finalización (opcional):
    - `selectedDBC.Roadmap.RoadmapItems[k].AnalysisCompleted = true` (y/o `DesignCompleted`) cuando corresponda.
- Al cerrar una vista:
  - Se invoca el flujo reusable `eira_post_view_actions` que:
    - Actualiza `flagViewDone = true`, `frontData.stepNumber++`, `downloadOriginFlow = 'NormalView'`.
    - Pregunta si descargar (y cómo continuar).
    - Define `postViewNext` y retorna al flujo padre, que despacha a `lo_views` (continuar) o `lf_1` (confirmar).
- Al finalizar todas las vistas:
  - `downloadOriginFlow = 'FinishedSolution'` → saltamos al flujo reusable `eira_post_solution_actions` que:
    - Ofrece descargar la solución y escoger otro DBC o finalizar (con y sin descarga).
    - Define `postSolutionNext` y retorna al `eira_view_loop`, que redirige a `b_select_dbc` (reiniciar) o finaliza.

## 8) Recomendaciones de reanudación

- Al cargar un proyecto con `journeyResp` existente:
  - Detecta vistas con `AnalysisCompleted/DesignCompleted` y ofrécelas como “saltadas” automáticamente.
  - En `choose_view`, filtra vistas completas con un `where(...)` para mostrar sólo pendientes.
- Guarda “última sección completada” por vista si necesitas retornar exactamente a mitad de una vista (variable `LastCompletedSection`).

## 9) Ejemplos rápidos (expresiones)

- Vistas pendientes del orden actual:
```
where(selectedDBC.Views, it.Order == viewItem.Order && !(it.AnalysisCompleted || it.DesignCompleted))
```
- ¿La UCS de la vista tiene contenido?:
```
len(coalesce(journeyResp.Analysis[selectedView].UseCaseSpecific.Items, [])) > 0
```
- Contar DBCs con metodología:
```
count(journeyResp.DigitalBusinessCapabilities, it => isDefined(it.Roadmap) && it.Roadmap.Methodology != '')
```

Con esto tienes el mapa completo: qué variables intervienen y cómo, qué partes del JSON atacamos y rellenamos, cómo se decide el flujo a ejecutar, cómo continuamos y cómo se computa el avance en distintos niveles.

## 10) Skip condicional de secciones (detalle)

Patrón: después de `av_extract_sections` se evalúan condiciones para saltar nodos interactivos vacíos.

Flujo actual (`eira_catalogue_sections`):
- `av_extract_sections` → `c_has_ba` → (`b_ba` | `c_has_ds`)
- Tras reinyección BA (`av_ba_analysis` / `av_ba_design`) → `c_has_ds` → (`b_ds` | `f_ucs`)

Ventajas:
- Evita presentar prompts innecesarios con listas vacías.
- Mantiene el mismo grafo para vistas con y sin datos (no hace falta un flujo alterno).
- Simplifica pruebas: las rutas de nodo siguen existiendo pero se saltan en tiempo de ejecución si no hay items.

Recomendación futura (opcional):
- Auto‑selección cuando `len(currentBA) == 1` o `len(currentDS) == 1` (marcar directamente y seguir). Para implementarlo añadir condiciones `c_auto_ba` / `c_auto_ds` antes de la UI y asignar la lista completa a la variable de selección.

Ejemplo de nueva condición (si se decide aplicar en el futuro):
```json
"c_auto_ba": {
  "id": "c_auto_ba", "type": "condition", "expr": "len(currentBA) == 1",
  "true_target": { "node_id": "av_select_single_ba" },
  "false_target": { "node_id": "b_ba" }
}
```
```json
"av_select_single_ba": {
  "id": "av_select_single_ba", "type": "assign_var",
  "assignments": [ { "target": "baSelection", "value": "currentBA" } ],
  "next": { "node_id": "c_phase_ba" }
}
```

Esto mantiene la filosofía extract → work (con UI mínima) → inject, optimizando pasos.
