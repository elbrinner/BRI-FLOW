# Plan de Flujo para BRI FLOW - Sistema de Análisis de Vistas por Rol

## Objetivo
Crear un flujo conversacional en BRI FLOW que guíe al usuario a través del proceso de análisis arquitectónico basado en su rol, utilizando los archivos JSON estáticos (`roles.json` y `flujo_*.json`) cargados dinámicamente en variables de sesión del backend mediante el motor de ejecución de flujos existente.

## Estructura General del Flujo

### 1. Selección de Rol
- **Fuente de Datos**: API que devuelve `roles.json`.
- **Interacción**: Mostrar lista de roles disponibles (Name y Value).
- **Acción**: Usuario selecciona un rol, que determina las vistas permitidas.
- **Backend**: Almacenar el rol seleccionado en el contexto de la sesión.

### 2. Iteración por Vistas
- **Lógica**: Para cada vista en `Views` del rol seleccionado:
  - Verificar si `AnalysisCompleted` es `false` para esa vista.
  - Si no completada, proceder al análisis de la vista.
  - Una vez completada, marcar `AnalysisCompleted` como `true` y pasar a la siguiente vista.
- **Orden**: Procesar vistas en el orden definido en `roles.json`.
- **Condición de Salida**: Cuando todas las vistas estén completadas (`AnalysisCompleted: true`), finalizar el flujo.

### 3. Análisis por Vista
- **Búsqueda de Datos**: Para la vista actual, buscar en `Analysis[*].ViewName` del archivo de flujo correspondiente (ej. `flujo_solutionArchitect.json`).
- **Estructura de Análisis**:
  - Iterar sobre `ViewCatalogues`.
  - Para cada `CatalogueSections`:
    - **BusinessAgnostic y DomainSpecific**:
      - Tipo: `multi_button` dinámico.
      - Acción: Enviar lista de items (PURI, Name, Selected) al frontend como botones.
      - Interacción: Usuario selecciona/deselecciona botones.
      - Backend: Actualizar `Selected` en el JSON y enviar confirmación al frontend.
    - **UseCaseSpecific**:
      - Tipo: `form`.
      - Acción: Enviar `Fields` (Name, FieldType, Placeholder) al frontend.
      - Interacción: Usuario llena el formulario.
      - Lógica: Hacer bucle hasta que todos los items de `SectionItems.UseCaseSpecific.Items` estén recolectados.
      - Backend: Agregar nuevos items a `Items` array basado en inputs del usuario.

### 4. Actualización de Estado
- **Mecanismo**: Después de cada selección o formulario completado, actualizar el JSON correspondiente.
- **Persistencia**: Usar APIs del backend para guardar cambios en tiempo real.
- **Validación**: Asegurar que todos los campos requeridos estén completados antes de marcar vista como completada.

### 5. Finalización e Impresión
- **Acción Final**: Una vez todas las vistas completadas, imprimir la variable completa con todos los valores reflejados.
- **Formato**: Mostrar resumen estructurado de selecciones y datos recolectados.

## Arquitectura del Sistema

### Componentes Clave

**Frontend (Angular)**
- Componente de chat (`bot-chat-app-v2`) que renderiza mensajes del bot
- Manejo de interacciones: botones, formularios, selecciones múltiples
- Envío de respuestas del usuario al backend vía `POST /api/chat`

**Backend (.NET)**
- `ChatController`: Endpoint `/api/chat` que procesa requests y devuelve `ChatEnvelope`
- `FlowExecutionService`: Ejecuta nodos del flujo JSON secuencialmente
- `FlowSession`: Mantiene estado de variables y progreso del usuario en memoria/BD
- Archivos JSON estáticos en `/flujos/`:
  - `roles.json`: Define roles y vistas asociadas
  - `flujo_solutionArchitect.json`, etc.: Datos de análisis por rol

**BRI FLOW**
- JSON que define el flujo conversacional con nodos interactivos
- Tipos de nodos: `button`, `form`, `loop`, `condition`, `assign_var`, `response`
- Sistema de variables y expresiones LINQ integradas en el backend

### Flujo de Datos

1. Usuario abre chat → Frontend envía `POST /api/chat` con `flowId`
2. Backend carga flujo JSON desde `/Flows/` y crea/recupera `FlowSession`
3. Backend ejecuta nodo actual (ej: `button` dinámico con roles)
4. Backend responde con `ChatEnvelope` conteniendo UI a renderizar
5. Usuario interactúa → Frontend envía selección en nuevo `POST /api/chat`
6. Backend actualiza `FlowSession.Variables`, ejecuta siguiente nodo
7. Ciclo se repite hasta nodo `end`

## NO se requieren APIs adicionales

**El backend ya tiene todo lo necesario:**
- ✅ Lectura de archivos JSON desde `/flujos/` vía `IFlowRepository`
- ✅ Ejecución de nodos interactivos (button, form, loop, condition)
- ✅ Expresiones LINQ para manipular datos en `assign_var`
- ✅ Persistencia de estado en `FlowSession.Variables`
- ✅ Soporte para SSE streaming (opcional)

**Solo necesitamos:**
1. Crear el archivo de flujo JSON en `/Flows/eira_analysis_flow.json`
2. Usar nodos `button` con `mode="dynamic"` para listas dinámicas
3. Usar `assign_var` con expresiones LINQ para filtrar/transformar datos
4. Usar `loop` para iterar sobre vistas/catálogos/secciones

## Estructura del Flujo BRI FLOW

### 1. Nodo Start - Inicialización de Variables

```json
{
  "id": "start",
  "type": "start",
  "variables": [
    {"name": "roles", "defaultValue": []},
    {"name": "selected_role", "defaultValue": {}},
    {"name": "dataJson", "defaultValue": {}},
    {"name": "current_view_index", "defaultValue": 0},
    {"name": "views_pendientes", "defaultValue": []},
    {"name": "views_mismo_orden", "defaultValue": []},
    {"name": "current_view", "defaultValue": {}},
    {"name": "current_view_analysis", "defaultValue": {}},
    {"name": "catalogue", "defaultValue": {}},
    {"name": "section", "defaultValue": {}}
  ],
  "next": {"node_id": "load_roles"}
}
```

**Nota importante:** La variable principal es `dataJson` (no `flujo_data`). Este objeto contiene toda la estructura del archivo `flujo_*.json` y se modificará durante el proceso.

### 2. Cargar Roles desde JSON Estático

```json
{
  "id": "load_roles",
  "type": "assign_var",
  "descripcion": "Carga roles.json en memoria",
  "assignments": [
    {
      "target": "roles",
      "value": "readJsonFile('flujos/roles.json')"
    }
  ],
  "next": {"node_id": "select_role"}
}
```

### 3. Selección de Rol (Button Dinámico)

```json
{
  "id": "select_role",
  "type": "button",
  "mode": "dynamic",
  "save_as": "selected_role",
  "i18n": {
    "es": {"text": "Selecciona tu rol arquitectónico:"}
  },
  "provider": {
    "source_list": "roles",
    "label_expr": "item.Name",
    "value_expr": "item"
  },
  "next": {"node_id": "load_flujo_data"}
}
```

**Cómo funciona:**
- Backend lee `FlowSession.Variables["roles"]` (array de objetos)
- Genera botones dinámicamente: cada `item.Name` es la etiqueta
- Usuario selecciona → backend guarda objeto completo en `selected_role`

### 4. Cargar Datos del Flujo según Rol

```json
{
  "id": "load_flujo_data",
  "type": "assign_var",
  "descripcion": "Carga el JSON completo del rol (ej: flujo_solutionArchitect.json) en dataJson",
  "assignments": [
    {
      "target": "dataJson",
      "value": "readJsonFile('flujos/flujo_' + selected_role.Value + '.json')"
    },
    {
      "target": "views_pendientes",
      "value": "dataJson.Roadmap.where(r => !r.AnalysisCompleted && selected_role.Views.contains(r.View)).orderBy(r => r.Order)"
    }
  ],
  "next": {"node_id": "check_views_pendientes"}
}
```

**Expresiones LINQ usadas:**
- `dataJson.Roadmap.where(...)`: Filtra vistas no completadas del rol
- `selected_role.Views.contains(r.View)`: Solo vistas permitidas para el rol
- `.orderBy(r => r.Order)`: Ordena por campo Order

**⚠️ Importante:** Todas las operaciones posteriores deben usar `dataJson` como fuente de verdad.

### 5. Loop Principal - Iterar por Vistas

```json
{
  "id": "check_views_pendientes",
  "type": "condition",
  "mode": "switch",
  "cases": [
    {
      "when": "views_pendientes.count() > 0",
      "target": {"node_id": "check_orden_duplicado"}
    }
  ],
  "default": {"node_id": "finalizar_analisis"}
}
```

### 5.1. Verificar si hay Múltiples Vistas con el Mismo Orden

```json
{
  "id": "check_orden_duplicado",
  "type": "assign_var",
  "descripcion": "Detecta si hay 2+ vistas pendientes con el mismo orden mínimo",
  "assignments": [
    {
      "target": "min_order",
      "value": "views_pendientes.min(v => v.Order)"
    },
    {
      "target": "views_mismo_orden",
      "value": "views_pendientes.where(v => v.Order == min_order)"
    }
  ],
  "next": {"node_id": "decide_vista_inicio"}
}
```

```json
{
  "id": "decide_vista_inicio",
  "type": "condition",
  "mode": "switch",
  "cases": [
    {
      "when": "views_mismo_orden.count() > 1",
      "target": {"node_id": "preguntar_vista_inicio"}
    },
    {
      "when": "views_mismo_orden.count() == 1",
      "target": {"node_id": "set_current_view_auto"}
    }
  ],
  "default": {"node_id": "finalizar_analisis"}
}
```

### 5.2. Preguntar al Usuario por Cuál Vista Empezar (si hay múltiples con mismo orden)

```json
{
  "id": "preguntar_vista_inicio",
  "type": "button",
  "mode": "dynamic",
  "save_as": "current_view",
  "i18n": {
    "es": {"text": "Hay varias vistas con el mismo orden. ¿Por cuál deseas empezar?"}
  },
  "provider": {
    "source_list": "views_mismo_orden",
    "label_expr": "item.View + ' (Orden: ' + item.Order + ')'",
    "value_expr": "item"
  },
  "next": {"node_id": "set_current_view_analysis"}
}
```

### 5.3. Asignar Vista Automáticamente (si hay solo una)

```json
{
  "id": "set_current_view_auto",
  "type": "assign_var",
  "assignments": [
    {
      "target": "current_view",
      "value": "views_mismo_orden.first()"
    }
  ],
  "next": {"node_id": "set_current_view_analysis"}
}
```

### 5.4. Cargar Análisis de la Vista Actual

```json
{
  "id": "set_current_view_analysis",
  "type": "assign_var",
  "assignments": [
    {
      "target": "current_view_analysis",
      "value": "dataJson.Analysis.firstOrDefault(a => a.ViewName == current_view.View)"
    }
  ],
  "next": {"node_id": "mensaje_vista"}
}
```

```json
{
  "id": "mensaje_vista",
  "type": "response",
  "i18n": {
    "es": {"text": "Procesando vista: **{{current_view.View}}**"}
  },
  "next": {"node_id": "loop_catalogues"}
}
```

### 6. Loop de Catálogos

```json
{
  "id": "loop_catalogues",
  "type": "loop",
  "mode": "foreach",
  "source_list": "current_view_analysis.ViewCatalogues",
  "item_var": "catalogue",
  "index_var": "catalogue_index",
  "body": {"node_id": "loop_sections"},
  "next": {"node_id": "marcar_vista_completada"}
}
```

### 7. Loop de Secciones

```json
{
  "id": "loop_sections",
  "type": "loop",
  "mode": "foreach",
  "source_list": "catalogue.CatalogueSections",
  "item_var": "section",
  "index_var": "section_index",
  "body": {"node_id": "check_business_agnostic"},
  "next": {"node_id": "loop_catalogues_continue"}
}
```

### 8. Procesamiento de BusinessAgnostic (Multi-Button)

```json
{
  "id": "check_business_agnostic",
  "type": "condition",
  "mode": "switch",
  "cases": [
    {
      "when": "section.SectionItems.BusinessAgnostic.count() > 0",
      "target": {"node_id": "select_business_agnostic"}
    }
  ],
  "default": {"node_id": "check_domain_specific"}
}
```

```json
{
  "id": "select_business_agnostic",
  "type": "button",
  "mode": "dynamic",
  "multi_select": true,
  "save_as": "selected_business_items",
  "i18n": {
    "es": {
      "text": "**{{catalogue.CatalogueName}}** - {{section.SectionName}}\nSelecciona elementos (múltiple):"
    }
  },
  "provider": {
    "source_list": "section.SectionItems.BusinessAgnostic",
    "label_expr": "item.Name",
    "value_expr": "item.PURI",
    "preselected_expr": "item.Selected"
  },
  "next": {"node_id": "update_business_agnostic"}
}
```

**Características clave:**
- `multi_select: true`: Permite seleccionar varios items
- `preselected_expr`: Marca como seleccionados los que tengan `Selected: true`
- Usuario interactúa → backend guarda array de PURIs en `selected_business_items`

### 9. Actualizar Selecciones en el JSON (Modificar dataJson)

```json
{
  "id": "update_business_agnostic",
  "type": "assign_var",
  "descripcion": "Actualiza el campo Selected en BusinessAgnostic dentro de dataJson",
  "assignments": [
    {
      "target": "section.SectionItems.BusinessAgnostic",
      "value": "section.SectionItems.BusinessAgnostic.select(item => new { PURI = item.PURI, Name = item.Name, Selected = selected_business_items.contains(item.PURI) })"
    }
  ],
  "next": {"node_id": "sync_to_datajson_ba"}
}
```

```json
{
  "id": "sync_to_datajson_ba",
  "type": "assign_var",
  "descripcion": "Sincroniza cambios de section de vuelta a dataJson.Analysis",
  "assignments": [
    {
      "target": "dataJson.Analysis",
      "value": "dataJson.Analysis.select(a => a.ViewName == current_view.View ? new { ViewName = a.ViewName, ViewCatalogues = a.ViewCatalogues.select(c => c.CatalogueName == catalogue.CatalogueName ? new { CatalogueName = c.CatalogueName, CatalogueSections = c.CatalogueSections.select(s => s.SectionName == section.SectionName ? section : s) } : c) } : a)"
    }
  ],
  "next": {"node_id": "check_domain_specific"}
}
```

**Expresión LINQ:**
- Actualiza `Selected` en items según selecciones del usuario
- Sincroniza cambios de vuelta a `dataJson` para persistir modificaciones
- `selected_business_items.contains(item.PURI)`: true si fue seleccionado

**⚠️ Crítico:** Siempre sincronizar cambios a `dataJson` después de modificar secciones

### 10. Procesamiento de DomainSpecific (Igual que BusinessAgnostic)

```json
{
  "id": "check_domain_specific",
  "type": "condition",
  "mode": "switch",
  "cases": [
    {
      "when": "section.SectionItems.DomainSpecific.count() > 0",
      "target": {"node_id": "select_domain_specific"}
    }
  ],
  "default": {"node_id": "check_use_case"}
}
```

### 11. Procesamiento de UseCaseSpecific (Form Dinámico)

```json
{
  "id": "check_use_case",
  "type": "condition",
  "mode": "switch",
  "cases": [
    {
      "when": "section.SectionItems.UseCaseSpecific.Fields.count() > 0",
      "target": {"node_id": "ask_add_item"}
    }
  ],
  "default": {"node_id": "loop_sections_continue"}
}
```

```json
{
  "id": "ask_add_item",
  "type": "button",
  "save_as": "add_use_case_item",
  "i18n": {
    "es": {"text": "¿Deseas agregar un elemento personalizado?"}
  },
  "options": [
    {"label": "Sí, agregar", "value": "yes", "target": {"node_id": "form_use_case"}},
    {"label": "No, continuar", "value": "no", "target": {"node_id": "loop_sections_continue"}}
  ]
}
```

```json
{
  "id": "form_use_case",
  "type": "form",
  "mode": "dynamic",
  "save_as": "new_use_case_item",
  "i18n": {
    "es": {"text": "Completa los datos:"}
  },
  "provider": {
    "fields_source": "section.SectionItems.UseCaseSpecific.Fields",
    "field_name_expr": "field.Name",
    "field_type_expr": "field.FieldType",
    "field_placeholder_expr": "field.Placeholder"
  },
  "next": {"node_id": "append_item"}
}
```

**Form dinámico:**
- Lee definición de campos desde `Fields` array
- Genera inputs según `FieldType` (SHORT/LONG)
- Backend guarda objeto con los valores en `new_use_case_item`

### 12. Agregar Item a la Lista

```json
{
  "id": "append_item",
  "type": "assign_var",
  "assignments": [
    {
      "target": "section.SectionItems.UseCaseSpecific.Items",
      "value": "section.SectionItems.UseCaseSpecific.Items.append(new_use_case_item)"
    }
  ],
  "next": {"node_id": "ask_add_item"}
}
```

### 13. Marcar Vista como Completada en dataJson

```json
{
  "id": "marcar_vista_completada",
  "type": "assign_var",
  "descripcion": "Actualiza AnalysisCompleted a true en dataJson.Roadmap para la vista actual",
  "assignments": [
    {
      "target": "dataJson.Roadmap",
      "value": "dataJson.Roadmap.select(r => r.View == current_view.View ? new { View = r.View, Order = r.Order, AnalysisCompleted = true, DesignCompleted = r.DesignCompleted } : r)"
    },
    {
      "target": "views_pendientes",
      "value": "dataJson.Roadmap.where(r => !r.AnalysisCompleted && selected_role.Views.contains(r.View)).orderBy(r => r.Order)"
    }
  ],
  "next": {"node_id": "mensaje_vista_completada"}
}
```

```json
{
  "id": "mensaje_vista_completada",
  "type": "response",
  "i18n": {
    "es": {"text": "✅ Vista **{{current_view.View}}** completada correctamente.\n\nVistas restantes: {{views_pendientes.count()}}"}
  },
  "next": {"node_id": "check_views_pendientes"}
}
```

**Cambios clave:**
- Modifica directamente `dataJson.Roadmap` (no `flujo_data.Roadmap`)
- Establece `AnalysisCompleted = true` para la vista procesada
- Recalcula `views_pendientes` desde `dataJson.Roadmap`
- Muestra mensaje de confirmación antes de continuar

### 14. Finalización y Exportación de dataJson

```json
{
  "id": "finalizar_analisis",
  "type": "response",
  "i18n": {
    "es": {"text": "✅ **¡Análisis completado!**\n\nResumen:\n- Rol: {{selected_role.Name}}\n- Vistas procesadas: {{selected_role.Views.count()}}\n- Vistas completadas en Roadmap: {{dataJson.Roadmap.where(r => r.AnalysisCompleted).count()}}\n\nDescargando JSON actualizado..."}
  },
  "next": {"node_id": "mostrar_vistas_completadas"}
}
```

### 14.1. Mostrar Estado de Vistas Completadas

```json
{
  "id": "mostrar_vistas_completadas",
  "type": "response",
  "i18n": {
    "es": {
      "text": "**Estado de Vistas:**\n\n{{dataJson.Roadmap.select(r => '- ' + r.View + ' (Orden: ' + r.Order + '): ' + (r.AnalysisCompleted ? '✅ Completada' : '⏳ Pendiente')).join('\n')}}"
    }
  },
  "next": {"node_id": "export_json"}
}
```

### 14.2. Exportar dataJson Completo

```json
{
  "id": "export_json",
  "type": "json_export",
  "descripcion": "Exporta dataJson con todas las modificaciones (Selected, AnalysisCompleted, UseCaseSpecific.Items)",
  "variable": "dataJson",
  "filename": "roadmap_{{selected_role.Value}}_{{timestamp}}.json",
  "download": true,
  "next": {"node_id": "mensaje_descarga"}
}
```

```json
{
  "id": "mensaje_descarga",
  "type": "response",
  "i18n": {
    "es": {
      "text": "📥 **Archivo descargado correctamente**\n\nEl archivo `roadmap_{{selected_role.Value}}_{{timestamp}}.json` contiene:\n- Todas las selecciones de BusinessAgnostic y DomainSpecific (campo `Selected`)\n- Items personalizados de UseCaseSpecific\n- Estado de vistas completadas (`AnalysisCompleted: true`)\n\n¡Gracias por usar el asistente de análisis arquitectónico!"
    }
  },
  "next": {"node_id": "end"}
}
```

```json
{
  "id": "end",
  "type": "end"
}
```

**Características de la exportación:**
1. ✅ Exporta `dataJson` completo (no solo un resumen)
2. ✅ Contiene todas las modificaciones del usuario
3. ✅ Campos `Selected` actualizados en BusinessAgnostic/DomainSpecific
4. ✅ Items agregados en `UseCaseSpecific.Items`
5. ✅ Booleanos `AnalysisCompleted` marcados como `true` para vistas procesadas
6. ✅ Nombre de archivo con timestamp y rol del usuario

## Ventajas de esta Arquitectura

### ✅ Sin Desarrollo Backend Adicional
- Usa infraestructura existente: `ChatController`, `FlowExecutionService`, `FlowSession`
- No requiere nuevos endpoints ni servicios
- Archivos JSON estáticos leídos automáticamente

### ✅ Mantenimiento de Estado Automático
- `FlowSession.Variables` persiste todo el progreso
- Backend maneja sincronización con BD/memoria
- Frontend no necesita gestionar estado complejo

### ✅ Expresiones LINQ Potentes
- Filtrado: `where()`, `firstOrDefault()`, `contains()`
- Transformación: `select()`, `orderBy()`, `append()`
- Agregación: `count()`, `sum()`, `any()`

### ✅ Nodos Dinámicos Nativos
- `button` con `mode="dynamic"` + `provider`
- `form` con campos generados desde JSON
- `loop` para iteraciones complejas
- `condition` para lógica condicional

### ✅ Modularidad y Reusabilidad
- Misma estructura para todos los roles (solo cambia el JSON de flujo)
- Fácil agregar nuevas vistas/catálogos/secciones
- Backend agnóstico al contenido

## Mejores Prácticas para Implementación

### 1. Estructura de Variables en Start Node
- Declarar todas las variables principales en el nodo `start`
- Usar `defaultValue` apropiado según tipo ([], {}, "", 0)
- Documentar propósito de cada variable en comentarios

### 2. Expresiones LINQ Seguras
- Usar `firstOrDefault()` en lugar de `first()` para evitar errores
- Validar con `count() > 0` antes de iterar
- Usar `coalesce()` para valores opcionales

### 3. Manejo de Errores en Expresiones LINQ
- Si una expresión falla (ej: `firstOrDefault()` en array vacío), el flujo podría detenerse. Agrega `condition` nodes para validar antes de operaciones críticas.
- Ejemplo: Antes de `views_pendientes.first()`, verifica `views_pendientes.count() > 0`
- Usa `try/catch` en expresiones complejas o valida inputs en nodos `assign_var`
- Considera nodos `response` para mostrar mensajes de error al usuario si hay problemas de datos

### 3. Loops Anidados
- Usar variables distintas para cada nivel: `item`, `item1`, `item2`
- Definir `body` para ejecutar nodos dentro del loop
- Limitar profundidad máxima de anidación (recomendado: 3 niveles)

### 4. Gestión de Estado
- Actualizar `flujo_data` incrementalmente después de cada interacción
- No mutar directamente; usar `select()` para crear nuevos objetos
- Persistir estado crítico en variables separadas (ej: `views_pendientes`)

### 5. UX y Feedback
- Mostrar mensajes de progreso (`response` nodes) entre pasos largos
- Usar markdown en textos para mejorar legibilidad
- Incluir información contextual en prompts (ej: nombre de catálogo)

### 6. Validaciones
- Implementar `condition` nodes antes de operaciones críticas
- Validar que arrays no estén vacíos antes de iterar
- Proporcionar rutas alternativas (default) en conditions

### 7. Testing
- Probar con cada rol definido en `roles.json`
- Verificar que todas las vistas se procesen correctamente
- Validar que el JSON final contenga todas las selecciones
- Probar casos edge: sin selecciones, todas seleccionadas, cancelación

### 8. Performance
- Evitar expresiones LINQ muy complejas en un solo nodo
- Dividir transformaciones grandes en múltiples `assign_var` nodes
- Usar índices apropiados en loops para debugging

## Resumen de Cambios Implementados

### ✅ 1. Gestión de Vistas con Mismo Orden
- **Detección automática**: Si hay 2+ vistas pendientes con el mismo orden mínimo, el sistema lo detecta
- **Pregunta al usuario**: Muestra botones dinámicos para elegir por cuál vista empezar
- **Inicio automático**: Si hay solo una vista con el orden mínimo, comienza directamente sin preguntar
- **Nodos involucrados**: `check_orden_duplicado`, `decide_vista_inicio`, `preguntar_vista_inicio`, `set_current_view_auto`

### ✅ 2. Uso de dataJson como Variable Principal
- **Nombre correcto**: La variable se llama `dataJson` (no `flujo_data`)
- **Lectura inicial**: Se carga desde `flujos/flujo_<rolValue>.json`
- **Modificaciones directas**: Todas las actualizaciones se hacen sobre `dataJson`
- **Sincronización**: Cambios en variables temporales (`section`, `catalogue`) se sincronizan de vuelta a `dataJson`

### ✅ 3. Actualización de Booleanos en Roadmap
- **Campo modificado**: `AnalysisCompleted` se marca como `true` al completar cada vista
- **Persistencia**: Los cambios se guardan en `dataJson.Roadmap`
- **Visualización**: El usuario ve el estado de cada vista antes de la exportación
- **Nodo clave**: `marcar_vista_completada`

### ✅ 4. Exportación Completa del JSON
- **Variable exportada**: `dataJson` completo con todas las modificaciones
- **Contenido incluido**:
  - Campos `Selected` actualizados en BusinessAgnostic y DomainSpecific
  - Items agregados en `UseCaseSpecific.Items`
  - Booleanos `AnalysisCompleted` marcados para vistas procesadas
  - Toda la estructura original del `flujo_*.json`
- **Nombre de archivo**: `roadmap_<rolValue>_<timestamp>.json`
- **Nodos involucrados**: `mostrar_vistas_completadas`, `export_json`, `mensaje_descarga`

## Próximos Pasos

1. **Crear archivo de flujo**: `/Flows/eira_analysis_flow.json` con la estructura completa documentada
2. **Testear orden duplicado**: Crear caso de prueba con 2+ vistas con mismo Order
3. **Validar sincronización dataJson**: Verificar que modificaciones se persisten correctamente
4. **Testear con un rol**: Comenzar con `publicPolicyOfficer` (solo vista Legal)
5. **Validar multi-select**: Probar selección múltiple de BusinessAgnostic
6. **Implementar formularios**: Validar campos dinámicos de UseCaseSpecific
7. **Expandir a todos los roles**: Probar con `solutionArchitect` (5 vistas)
8. **Verificar exportación**: Descargar JSON y validar que contenga todas las selecciones y booleanos actualizados

## Referencias Técnicas

### Documentación BRI FLOW
- Nodos: `/BRI-FLOW/README.md`
- Expresiones LINQ: `/egoverabot-assistant/Docs/Expression/`
- Tests de referencia: `/egoverabot-assistant/eGovERABot.Tests/`

### Archivos de Ejemplo
- `linq_egovera_file.json`: Ejemplo de button dinámico y loops
- `eira_view_loop.json`: Iteración sobre vistas (si existe)
- `test_formulario_analysis.json`: Forms dinámicos

### Backend
- `ChatController.cs`: Endpoint principal
- `FlowExecutionService.cs`: Motor de ejecución
- `FlowSession.cs`: Gestión de estado
