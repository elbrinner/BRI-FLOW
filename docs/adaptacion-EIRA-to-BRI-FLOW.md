# Adaptación de EIRA (Composer) a BRI-FLOW

Este documento mapea los diálogos y acciones del bot EIRA (Composer) a nodos y flujos de BRI-FLOW, proponiendo una implementación equivalente y señalando ajustes requeridos en frontend/backend.

## Objetivos
- Reproducir el flujo funcional (roles → ingesta → selección DBC → vistas → catálogos/secciones → descarga) con los nodos disponibles de BRI-FLOW.
- Minimizar lógica de “sentinelas” en frontend (User-upload-success, User-custom-response, User-form-response) delegando a nodos form/button cuando sea posible.

## Mapeo Composer → BRI-FLOW
- Triggers (OnConversationUpdate, OnBeginDialog): Start + Response inicial.
- HttpRequest: nodo rest_call (method/url/headers/body + mappings/save_as).
- ChoiceInput (roles/DBC/vistas):
  - Caso simple: nodo choice (prompt + options).
  - Caso dinámico: nodo button en modo dynamic con provider { source_list, label_expr, value_expr, ... } y save_as.
- SetProperty/EditArray/Foreach/If/Switch: assign_var, loop, condition, choice (modo switch).
- Begin/Replace/Start/Cancel: flow_jump (cross-flow) o next encadenado.
- UI de catálogos/secciones:
  - BusinessAgnostic/DomainSpecific: button (dynamic) para listas o extra si requiere payload libre.
  - UseCaseSpecific: form.
- DownloadFile/Export: json_export o file_download (según backend).

## Variables y contexto sugerido
Definir en Start variables clave (defaultValue puede ser literal o JSON string):
- apiBaseUrl: "https://<host>" (editable).
- apiKey: "" (inyectable por simulador/producción).
- infoRolesResp: {}.
- roleSelected: {}.
- journeyResp: {}.
- filteredNonEmptyDBCnames: []
- selectedDBC: {}
- selectedView: ""
- beginDecision: "Follow"
- frontData: { "stepNumber": 0 }

Notas:
- BRI-FLOW evalúa JSON strings en defaultValue del Start (se parsea en runtime).

## Flujos propuestos
1) eira_main
- Start → Response bienvenida → rest_call GET /userRoles (save_as: infoRolesResp)
- button (dynamic) “Selecciona tu rol” (source_list: infoRolesResp.data || infoRolesResp.content; label_expr: item.Text || item.name || item.Value; value_expr: item.Value || item.value || JSON.stringify(item); save_as: roleSelected)
- condition (roleSelected.Value == 'solutionArchitect') → Response contextual → flow_jump a eira_upload

2) eira_upload
- button estático (3 opciones): Crear roadmap · Subir JSON · Trabajar sin archivo.
- Para “Crear roadmap”/“Sin archivo”: input + assign_var roadmapOnlyResp → rest_call POST /journey/{roleSelected.Value} (body: roadmapOnlyResp, mappings→ journeyResp = $.data.content)
- Para “Subir JSON”: file_upload (save_as: uploadedJson) → assign_var journeyResp = uploadedJson.content || uploadedJson
- assign_var filteredNonEmptyDBCnames (Expression: select(where(journeyResp.DigitalBusinessCapabilities, it.Roadmap.Methodology != ''), it.Name))
- flow_jump → eira_view_loop

3) eira_view_loop
- button (dynamic) DBCs disponibles → save_as selectedDBC
- button estático “Seguir secuencia / Saltar a vistas” → save_as beginDecision
- loop foreach sobre selectedDBC.Roadmap.RoadmapItems (ordenados por Order)
  - Dentro del loop: button (dynamic) vistas pendientes en el orden actual → save_as selectedView → flow_jump eira_catalogue_sections
- Cuando termine: json_export (filename: solution.json, template: journeyResp)

4) eira_catalogue_sections
- condition por fase (Analysis vs Design) según selectedView.
- Secuencia: BusinessAgnostic → DomainSpecific → UseCaseSpecific (si existen):
  - BA/DS: button (dynamic) con source_list=catálogo correspondiente; save_as guarda selección y assign_var escribe en journeyResp.
  - UCS: form con fields mapeados desde catálogo; on submit: assign_var → journeyResp…UseCaseSpecific.Items.
- assign_var flags AnalysisCompleted/DesignCompleted en DBC.RoadmapItems para la vista.
- flow_jump return a eira_view_loop.

## Gaps y decisiones
- Sentinelas UI: BRI-FLOW puede evitar tokens especiales si modelamos con nodos button/form; si se requiere total equivalencia con canal existente, usar nodo extra para simular “payload libre” y un condition posterior.
- Tipado: ExpressionParser admite helpers (select/where/orderBy). Validar expresiones en simulador.
- Seguridad: apiKey no debe persistirse en JSON de flujos; inyectar por perfil del simulador o variable en Start local.

## Buenas prácticas
- Mantener “save_as” consistente y documentado.
- Reutilizar flow_jump para separar responsabilidades (main/upload/loop/sections).
- Usar mappings de rest_call para extraer exactamente $.data.content.
- Adjuntar descripción (descripcion) en cada nodo como documentación viva.

## Próximos pasos
- Importar los JSON de flujos incluidos en docs/flows/.
- Probar en el simulador (botón Ejecutar) y ajustar expresiones/provider según forma real del backend (content vs data).
