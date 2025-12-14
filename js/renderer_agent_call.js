// renderer_agent_call.js
// Renderizador de propiedades para el nodo agent_call
(function () {
  const H = globalThis.FormBuilderHelpers || {};
  const { el, inputRow, arrayRow, jsonEditor } = H;

  const PROFILE_DESCRIPTIONS = {
    normal: 'Conversación/razonamiento directo sin recuperación externa.',
    rag: 'Con recuperación desde Azure AI Search para grounding y citaciones.',
    coordinator: 'Orquesta múltiples agentes/herramientas y fusiona respuestas.',
    retrieval: 'Solo recuperación de contexto desde el índice, sin generar respuesta.',
    domain_expert: 'Experto de dominio con políticas/tono; sin recuperación por defecto.',
    worker: 'Ejecuta una tarea específica con esquemas de entrada/salida estrictos.',
    ui_agent: 'Genera componentes de interfaz de usuario (UI) dinámicos.',
    event_agent: 'Procesa o emite eventos de forma asíncrona.'
  };

  function renderAgentCall(node, container, nodeIds) {
    const rawProps = node.props || {};
    // Compatibilidad: si el flujo trae valores en raíz (legacy), usarlos como default y normalizar a props.* al guardar
    const legacy = {
      agent_profile: node.agent_profile || node.agent || '',
      message: node.message || '',
      system_prompt: node.system_prompt || '',
      stream: (typeof node.stream === 'boolean') ? node.stream : undefined,
      save_as: node.save_as || ''
    };
    const props = Object.assign({}, legacy, rawProps);
    const currentProfile = props.agent_profile || 'normal';

    // Solo modo inline: no agentId

    // Perfil de Agente
    const profileRow = el('div', { class: 'form-row' });
    const profileLabelWrap = el('div', { style: 'display:flex; align-items:center; gap:6px;' });
    profileLabelWrap.appendChild(el('label', { text: 'Perfil de Agente' }));
    // Info tooltip con resumen de perfiles
    const tipWrap = el('span', { class: 'inline-tip-wrap' });
    const tipIcon = el('span', { class: 'info-tip', text: 'i', title: 'Perfiles de Agente' });
    const tipBox = el('span', {
      class: 'inline-tip', text:
        'normal: conversación sin recuperación externa.\n' +
        'rag: grounding con Azure AI Search y citaciones.\n' +
        'coordinator: orquesta participantes y fusiona respuestas.\n' +
        'retrieval: solo recuperación de contexto (sin generar).\n' +
        'domain_expert: experto con políticas/tono; sin RAG por defecto.'
    });
    tipWrap.appendChild(tipIcon);
    tipWrap.appendChild(tipBox);
    //profileLabelWrap.appendChild(tipWrap);
    // Botón de ayuda contextual
    const helpBtn = el('button', { type: 'button', text: 'Ayuda' });
    helpBtn.className = 'ml-2 px-2 py-0.5 bg-white border rounded text-xs';
    helpBtn.addEventListener('click', () => {
      try {
        if (globalThis.HelpModal && typeof globalThis.HelpModal.open === 'function') {
          globalThis.HelpModal.open('#agent_call');
        } else {
          // Fallback: dispara botón de ayuda global
          const btn = document.getElementById('btnHelpDoc');
          if (btn) btn.click();
        }
      } catch (e) { /* noop */ }
    });
    profileLabelWrap.appendChild(helpBtn);
    profileRow.appendChild(profileLabelWrap);
    const profileSel = el('select', { id: 'agent_profile' });
    for (const p of ['normal', 'rag', 'coordinator', 'retrieval', 'domain_expert', 'worker', 'ui_agent', 'event_agent']) {
      const opt = el('option', { value: p, text: p });
      if (currentProfile === p) opt.selected = true;
      profileSel.appendChild(opt);
    }
    const profileHelp = el('small', { text: PROFILE_DESCRIPTIONS[currentProfile] || '' });
    profileHelp.style.fontSize = '11px';
    profileHelp.style.color = '#666';
    profileRow.appendChild(profileSel);
    profileRow.appendChild(profileHelp);
    container.appendChild(profileRow);
    // Nota de compatibilidad (solo si detectamos legacy)
    const usedLegacy = (!!legacy.message || !!legacy.system_prompt || typeof legacy.stream === 'boolean' || !!legacy.save_as || !!legacy.agent_profile) && !node.props;
    if (usedLegacy) {
      const compatNote = el('div', { class: 'panel-note', text: 'Compatibilidad: se detectaron propiedades legacy en el nodo. Al guardar se normalizarán en props.*' });
      compatNote.style.marginBottom = '6px';
      container.appendChild(compatNote);
    }

    // Execution Mode (Hybrid)
    const execModeRow = el('div', { class: 'form-row' });
    execModeRow.appendChild(el('label', { text: 'Execution Mode' }));
    const execModeSel = el('select', { id: 'agent_execution_mode' });
    ['local', 'remote'].forEach(m => {
      const opt = el('option', { value: m, text: m.charAt(0).toUpperCase() + m.slice(1) });
      if ((props.execution_mode || 'local') === m) opt.selected = true;
      execModeSel.appendChild(opt);
    });
    execModeRow.appendChild(execModeSel);
    container.appendChild(execModeRow);

    // Message
    const messageRow = inputRow({ label: 'Prompt o pregunta del usuario', id: 'agent_message', type: 'textarea', value: props.message || '', placeholder: 'Prompt o pregunta del usuario (puedes usar {{input}} y {{context.*}})' });
    container.appendChild(messageRow);
    try {
      // Autocompletado de variables (formato mustache)
      const msgTa = container.querySelector('#agent_message');
      if (H.attachVarAutocomplete && msgTa) H.attachVarAutocomplete(msgTa, { format: 'mustache' });
    } catch (e) { /* best-effort */ }

    // Stream
    const streamRow = el('div', { class: 'form-row' });
    streamRow.appendChild(el('label', { text: 'Streaming (SSE)' }));
    const streamCheck = el('input', { type: 'checkbox', id: 'agent_stream' });
    streamCheck.checked = !!props.stream;
    streamRow.appendChild(streamCheck);
    container.appendChild(streamRow);

    // Save As
    const saveAsRow = inputRow({ label: 'Guardar en', id: 'agent_save_as', value: props.save_as || '', placeholder: 'Variable para guardar respuesta (ej.: agent_' + (node.id || 'n') + ')' });
    container.appendChild(saveAsRow);
    // Sugerir por defecto si está vacío
    try {
      const saveInp = container.querySelector('#agent_save_as');
      if (saveInp && !props.save_as) saveInp.value = 'agent_' + (node.id || 'n');
    } catch (e) { /* noop */ }

    // Tooling (array)
    const toolingRow = arrayRow({ label: 'Herramientas', id: 'agent_tooling', value: props.tooling || [] });
    container.appendChild(toolingRow);

    // (Eliminado) Perfil de Credenciales a nivel de nodo: usar `use_profile` global

    // Model Config (JSON)
    const modelRow = jsonEditor({
      label: 'Modelo (JSON)', id: 'agent_model', value: props.model || {
        provider: 'azure-openai',
        deployment: 'gpt-4o-mini',
        temperature: 0.2,
        max_tokens: 800
      }
    });
    container.appendChild(modelRow);

    // System Prompt
    const sysPromptRow = inputRow({ label: 'System Prompt (instrucciones que definen cómo debe comportarse)', id: 'agent_system_prompt', type: 'textarea', value: props.system_prompt || '', placeholder: 'Instrucciones del sistema (opcional). Acepta {{variables}}' });
    container.appendChild(sysPromptRow);
    try {
      const spTa = container.querySelector('#agent_system_prompt');
      if (H.attachVarAutocomplete && spTa) H.attachVarAutocomplete(spTa, { format: 'mustache' });
    } catch (e) { /* best-effort */ }

    // --- Worker Fields ---
    const inputSchemaRow = jsonEditor({ label: 'Input Schema (JSON Schema)', id: 'agent_input_schema', value: props.input_schema || {} });
    container.appendChild(inputSchemaRow);
    const outputSchemaRow = jsonEditor({ label: 'Output Schema (JSON Schema)', id: 'agent_output_schema', value: props.output_schema || {} });
    container.appendChild(outputSchemaRow);

    // --- UI Agent Fields ---
    const uiLibsRow = arrayRow({ label: 'Librerías UI permitidas', id: 'agent_ui_libraries', value: props.ui_libraries || ['shadcn'] });
    container.appendChild(uiLibsRow);
    const previewModeRow = el('div', { class: 'form-row' });
    previewModeRow.appendChild(el('label', { text: 'Modo Previsualización' }));
    const previewCheck = el('input', { type: 'checkbox', id: 'agent_preview_mode' });
    previewCheck.checked = props.preview_mode !== false; // default true
    previewModeRow.appendChild(previewCheck);
    container.appendChild(previewModeRow);

    // --- Event Agent Fields ---
    const topicsRow = arrayRow({ label: 'Tópicos de Eventos', id: 'agent_event_topics', value: props.event_topics || [] });
    container.appendChild(topicsRow);
    const asyncRow = el('div', { class: 'form-row' });
    asyncRow.appendChild(el('label', { text: 'Ejecución Asíncrona (Fire-and-forget)' }));
    const asyncCheck = el('input', { type: 'checkbox', id: 'agent_async_mode' });
    asyncCheck.checked = !!props.async_mode;
    asyncRow.appendChild(asyncCheck);
    container.appendChild(asyncRow);

    // Sección desplegable de Opciones avanzadas
    const advSection = el('details', { id: 'agent_adv_section' });
    const advSummary = el('summary', { text: 'Opciones avanzadas' });
    advSection.appendChild(advSummary);

    // MCP Configuration
    const mcpRow = el('div', { class: 'form-row' });
    mcpRow.appendChild(el('label', { text: 'MCP Servers (JSON)' }));
    const mcpServersInput = jsonEditor({ label: '', id: 'agent_mcp_servers', value: props.mcp_servers || [] });
    mcpRow.appendChild(mcpServersInput);
    // Note
    const mcpNote = el('div', { class: 'panel-note', text: 'Lista de servidores MCP: [{ "url": "http://localhost:8000/mcp", "name": "local" }]' });
    mcpRow.appendChild(mcpNote);
    advSection.appendChild(mcpRow);

    const mcpToolsRow = el('div', { class: 'form-row' });
    mcpToolsRow.appendChild(el('label', { text: 'MCP Tools (JSON)' }));
    const mcpToolsInput = jsonEditor({ label: '', id: 'agent_mcp_tools', value: props.mcp_tools || [] });
    mcpToolsRow.appendChild(mcpToolsInput);
    const mcpToolsNote = el('div', { class: 'panel-note', text: 'Herramientas MCP a habilitar: ["tool_name"] o [{"name": "tool_name"}]' });
    mcpToolsRow.appendChild(mcpToolsNote);
    advSection.appendChild(mcpToolsRow);

    // Tools avanzadas (JSON)
    const toolsAdvRow = jsonEditor({ label: 'Herramientas avanzadas (Legacy JSON)', id: 'agent_tools_advanced', value: Array.isArray(props.tools) ? props.tools : [] });
    // Nota de ayuda
    const toolsNote = el('div', { class: 'panel-note', text: 'Defínelas como una lista de objetos: [{ "name": "ai_search", "args": { "topK": 5 } }]. No pegues secretos aquí.' });
    toolsAdvRow.appendChild(toolsNote);
    advSection.appendChild(toolsAdvRow);

    // Search Config (JSON)
    const defaultSearch = props.search || {
      mode: 'hybrid',
      indexes: ['tramites-es'],
      semanticConfiguration: 'semantic-config-es',
      topK: 5
    };
    const searchRow = jsonEditor({ label: 'Configuración de Búsqueda (JSON)', id: 'agent_search', value: defaultSearch });
    advSection.appendChild(searchRow);

    // Controles simplificados para modo y semanticConfiguration
    const searchSimplified = el('div', { class: 'form-row' });
    const modeLabel = el('label', { text: 'Modo de búsqueda' });
    const modeSelect = el('select', { id: 'agent_search_mode' });
    for (const m of ['', 'keyword', 'semantic', 'vector', 'hybrid']) {
      const opt = el('option', { value: m, text: m || '(sin especificar)' });
      modeSelect.appendChild(opt);
    }
    // Índices (simplificado): coma o salto de línea
    const idxWrap = el('div', { style: 'display:flex; gap:8px; align-items:flex-start; margin-left:12px; flex:1;' });
    const idxLabel = el('label', { text: 'Índices' });
    idxLabel.style.minWidth = '72px';
    const idxTa = el('textarea', { id: 'agent_search_indexes', placeholder: 'index-a\nindex-b' });
    idxTa.rows = 2;
    idxWrap.appendChild(idxLabel);
    idxWrap.appendChild(idxTa);

    // TopK (simplificado)
    const topKWrap = el('div', { style: 'display:flex; gap:8px; align-items:center; margin-left:12px;' });
    const topKLabel = el('label', { text: 'topK' });
    topKLabel.style.minWidth = '48px';
    const topKInput = el('input', { id: 'agent_search_topk', type: 'number', min: '1', step: '1', placeholder: '5' });
    topKInput.style.width = '88px';
    topKWrap.appendChild(topKLabel);
    topKWrap.appendChild(topKInput);

    const semCfgWrap = el('div', { style: 'display:flex; gap:8px; align-items:center; margin-left:12px;' });
    const semCfgLabel = el('label', { text: 'Semantic configuration' });
    semCfgLabel.style.minWidth = '160px';
    const semCfgInput = el('input', { id: 'agent_semantic_config', placeholder: 'my-semantic-config' });
    semCfgWrap.appendChild(semCfgLabel);
    semCfgWrap.appendChild(semCfgInput);

    // Nota de ayuda
    const semNote = el('small', { text: 'Nombre configurado en Azure AI Search para el índice seleccionado. Usa el valor de tu índice (por defecto: "my-semantic-config").' });
    semNote.style.display = 'block';
    semNote.style.color = '#666';
    semNote.style.marginTop = '4px';

    searchSimplified.appendChild(modeLabel);
    searchSimplified.appendChild(modeSelect);
    searchSimplified.appendChild(idxWrap);
    searchSimplified.appendChild(topKWrap);
    searchSimplified.appendChild(semCfgWrap);
    searchSimplified.appendChild(semNote);
    advSection.appendChild(searchSimplified);

    // Inicializar valores simplificados desde el JSON actual
    function parseSearchJson() {
      try { return JSON.parse(container.querySelector('#agent_search')?.value || '{}'); }
      catch { return {}; }
    }
    function updateSearchJson(mutator) {
      const ta = container.querySelector('#agent_search');
      let obj = parseSearchJson();
      mutator(obj);
      ta.value = JSON.stringify(obj, null, 2);
      validate(profileSel.value);
    }
    const initialSearch = parseSearchJson();
    const initialMode = (initialSearch.mode || '').toString();
    modeSelect.value = initialMode;
    // Inicializar índices (lista => textarea)
    (function initIndexes() {
      let idx = initialSearch?.indexes ?? initialSearch?.index ?? [];
      if (typeof idx === 'string') idx = [idx];
      if (!Array.isArray(idx)) idx = [];
      idxTa.value = idx.join('\n');
    })();
    // Inicializar topK
    if (typeof initialSearch?.topK === 'number' && initialSearch.topK > 0) topKInput.value = String(initialSearch.topK);
    semCfgInput.value = (initialSearch.semanticConfiguration || 'my-semantic-config');

    function applySemCfgVisibility() {
      const m = modeSelect.value;
      const show = (m === 'semantic' || m === 'hybrid');
      semCfgWrap.style.display = show ? 'flex' : 'none';
      semNote.style.display = show ? 'block' : 'none';
    }
    applySemCfgVisibility();

    // Eventos de sincronización simplificada -> JSON
    modeSelect.addEventListener('change', () => {
      const newMode = modeSelect.value || undefined;
      updateSearchJson(obj => {
        if (!obj || typeof obj !== 'object') obj = {};
        if (newMode) obj.mode = newMode; else delete obj.mode;
        // Si el modo es semantic/hybrid y no hay semanticConfiguration, aplicar default
        if ((newMode === 'semantic' || newMode === 'hybrid') && !obj.semanticConfiguration) {
          obj.semanticConfiguration = semCfgInput.value || 'my-semantic-config';
        }
      });
      applySemCfgVisibility();
    });
    idxTa.addEventListener('input', () => {
      const lines = (idxTa.value || '').split('\n').map(s => s.trim()).filter(Boolean);
      updateSearchJson(obj => {
        if (!obj || typeof obj !== 'object') obj = {};
        if (lines.length === 0) { delete obj.indexes; delete obj.index; }
        else { obj.indexes = lines; if ('index' in obj) delete obj.index; }
      });
    });
    topKInput.addEventListener('input', () => {
      const n = Number(topKInput.value || '');
      updateSearchJson(obj => {
        if (!obj || typeof obj !== 'object') obj = {};
        if (!Number.isFinite(n) || n <= 0) delete obj.topK; else obj.topK = Math.max(1, Math.floor(n));
      });
      validate(profileSel.value);
    });
    semCfgInput.addEventListener('input', () => {
      const val = semCfgInput.value;
      updateSearchJson(obj => {
        const m = (obj?.mode || '').toString();
        if (m === 'semantic' || m === 'hybrid') {
          if (val) obj.semanticConfiguration = val; else delete obj.semanticConfiguration;
        }
      });
    });

    // Mode & Participants (advanced)
    const advRow = el('div', { class: 'form-row' });
    advRow.appendChild(el('label', { text: 'Modo (avanzado)' }));
    const modeSel = el('select', { id: 'agent_mode' });
    for (const m of ['', 'group_chat', 'sequential', 'fanout']) {
      const opt = el('option', { value: m, text: m || '(ninguno)' });
      if (props.mode === m) opt.selected = true;
      modeSel.appendChild(opt);
    }
    advRow.appendChild(modeSel);
    advSection.appendChild(advRow);

    const participantsRow = arrayRow({ label: 'Participantes (avanzado)', id: 'agent_participants', value: props.participants || [] });
    try {
      const partTa = participantsRow.querySelector('textarea#agent_participants');
      if (partTa) partTa.placeholder = 'Una línea por agente (ID o alias)\ncoordinator usará estos participantes en group_chat/sequential/fanout';
    } catch (e) { /* noop */ }
    advSection.appendChild(participantsRow);

    // Runtime / Guardrails
    const runtimeWrap = el('div', { class: 'form-row' });
    runtimeWrap.appendChild(el('label', { text: 'Runtime / Límites (opcional)' }));
    const rtTimeout = inputRow({ label: 'Timeout (ms)', id: 'agent_timeout_ms', type: 'number', value: props.runtime?.timeout_ms || '', placeholder: 'p. ej., 30000' });
    const rtSteps = inputRow({ label: 'Máx. pasos internos', id: 'agent_max_internal_steps', type: 'number', value: props.runtime?.max_internal_steps || '', placeholder: 'p. ej., 8' });
    const rtRetry = inputRow({ label: 'Reintentos', id: 'agent_retry_count', type: 'number', value: props.runtime?.retry_count || '', placeholder: 'p. ej., 0' });
    runtimeWrap.appendChild(rtTimeout);
    runtimeWrap.appendChild(rtSteps);
    runtimeWrap.appendChild(rtRetry);
    advSection.appendChild(runtimeWrap);

    // Añadir sección avanzada al contenedor
    container.appendChild(advSection);

    // Caja de validaciones
    const validationRow = el('div', { class: 'form-row' });
    const validationBox = el('div', { class: 'validation-box' });
    validationRow.appendChild(validationBox);
    container.appendChild(validationRow);

    function setVisible(row, visible) { if (!row) return; row.style.display = visible ? '' : 'none'; }

    function getInputValue(id) {
      const elx = container.querySelector('#' + id);
      if (!elx) return '';
      if (elx.tagName === 'INPUT' || elx.tagName === 'TEXTAREA' || elx.tagName === 'SELECT') return (elx.value || '').toString().trim();
      const inner = elx.querySelector('input,textarea,select');
      return inner ? (inner.value || '').toString().trim() : '';
    }

    function applyProfile(profile) {
      // Ayuda dinámica
      profileHelp.textContent = PROFILE_DESCRIPTIONS[profile] || '';
      // Visibilidad por perfil
      switch (profile) {
        case 'normal':
          setVisible(messageRow, true);
          setVisible(modelRow, true);
          setVisible(sysPromptRow, true);
          setVisible(streamRow, true);
          setVisible(saveAsRow, true);
          setVisible(toolingRow, true);
          setVisible(toolsAdvRow, true);
          setVisible(searchRow, false);
          setVisible(advRow, false);
          setVisible(participantsRow, false);
          setVisible(runtimeWrap, true);
          setVisible(inputSchemaRow, false);
          setVisible(outputSchemaRow, false);
          setVisible(uiLibsRow, false);
          setVisible(previewModeRow, false);
          setVisible(topicsRow, false);
          setVisible(asyncRow, false);
          break;
        case 'rag':
          setVisible(messageRow, true);
          setVisible(modelRow, true);
          setVisible(sysPromptRow, true);
          setVisible(streamRow, true);
          setVisible(saveAsRow, true);
          setVisible(toolingRow, true);
          setVisible(toolsAdvRow, true);
          setVisible(searchRow, true);
          setVisible(advRow, false);
          setVisible(participantsRow, false);
          setVisible(runtimeWrap, true);
          setVisible(inputSchemaRow, false);
          setVisible(outputSchemaRow, false);
          setVisible(uiLibsRow, false);
          setVisible(previewModeRow, false);
          setVisible(topicsRow, false);
          setVisible(asyncRow, false);
          break;
        case 'retrieval':
          setVisible(messageRow, true); // se usa como query
          setVisible(modelRow, false);
          setVisible(sysPromptRow, false);
          setVisible(streamRow, false);
          setVisible(saveAsRow, true);
          setVisible(toolingRow, false);
          setVisible(toolsAdvRow, false);
          setVisible(searchRow, true);
          setVisible(advRow, false);
          setVisible(participantsRow, false);
          setVisible(runtimeWrap, true);
          setVisible(inputSchemaRow, false);
          setVisible(outputSchemaRow, false);
          setVisible(uiLibsRow, false);
          setVisible(previewModeRow, false);
          setVisible(topicsRow, false);
          setVisible(asyncRow, false);
          break;
        case 'coordinator':
          setVisible(messageRow, true);
          setVisible(modelRow, true);
          setVisible(sysPromptRow, true);
          setVisible(streamRow, true);
          setVisible(saveAsRow, true);
          setVisible(toolingRow, true);
          setVisible(toolsAdvRow, true);
          setVisible(searchRow, false); // delega recuperación a subagentes
          setVisible(advRow, true);
          setVisible(participantsRow, true);
          setVisible(runtimeWrap, true);
          setVisible(inputSchemaRow, false);
          setVisible(outputSchemaRow, false);
          setVisible(uiLibsRow, false);
          setVisible(previewModeRow, false);
          setVisible(topicsRow, false);
          setVisible(asyncRow, false);
          break;
        case 'domain_expert':
          setVisible(messageRow, true);
          setVisible(modelRow, true);
          setVisible(sysPromptRow, true);
          setVisible(streamRow, true);
          setVisible(saveAsRow, true);
          setVisible(toolingRow, true);
          setVisible(toolsAdvRow, true);
          setVisible(searchRow, false); // sin RAG por defecto
          setVisible(advRow, false);
          setVisible(participantsRow, false);
          setVisible(runtimeWrap, true);
          setVisible(inputSchemaRow, false);
          setVisible(outputSchemaRow, false);
          setVisible(uiLibsRow, false);
          setVisible(previewModeRow, false);
          setVisible(topicsRow, false);
          setVisible(asyncRow, false);
          break;
        case 'worker':
          setVisible(messageRow, true);
          setVisible(modelRow, true);
          setVisible(sysPromptRow, false); // workers suelen tener prompt fijo o implícito
          setVisible(streamRow, false);
          setVisible(saveAsRow, true);
          setVisible(toolingRow, true);
          setVisible(toolsAdvRow, true);
          setVisible(searchRow, false);
          setVisible(advRow, false);
          setVisible(participantsRow, false);
          setVisible(runtimeWrap, true);
          setVisible(inputSchemaRow, true);
          setVisible(outputSchemaRow, true);
          setVisible(uiLibsRow, false);
          setVisible(previewModeRow, false);
          setVisible(topicsRow, false);
          setVisible(asyncRow, false);
          break;
        case 'ui_agent':
          setVisible(messageRow, true);
          setVisible(modelRow, true);
          setVisible(sysPromptRow, true);
          setVisible(streamRow, true);
          setVisible(saveAsRow, true);
          setVisible(toolingRow, true);
          setVisible(toolsAdvRow, true);
          setVisible(searchRow, false);
          setVisible(advRow, false);
          setVisible(participantsRow, false);
          setVisible(runtimeWrap, true);
          setVisible(inputSchemaRow, false);
          setVisible(outputSchemaRow, false);
          setVisible(uiLibsRow, true);
          setVisible(previewModeRow, true);
          setVisible(topicsRow, false);
          setVisible(asyncRow, false);
          break;
        case 'event_agent':
          setVisible(messageRow, true);
          setVisible(modelRow, true);
          setVisible(sysPromptRow, true);
          setVisible(streamRow, false);
          setVisible(saveAsRow, true);
          setVisible(toolingRow, true);
          setVisible(toolsAdvRow, true);
          setVisible(searchRow, false);
          setVisible(advRow, false);
          setVisible(participantsRow, false);
          setVisible(runtimeWrap, true);
          setVisible(inputSchemaRow, false);
          setVisible(outputSchemaRow, false);
          setVisible(uiLibsRow, false);
          setVisible(previewModeRow, false);
          setVisible(topicsRow, true);
          setVisible(asyncRow, true);
          break;
        default:
          setVisible(messageRow, true);
          setVisible(modelRow, true);
          setVisible(sysPromptRow, true);
          setVisible(streamRow, true);
          setVisible(saveAsRow, true);
          setVisible(toolingRow, true);
          setVisible(toolsAdvRow, true);
          setVisible(searchRow, false);
          setVisible(advRow, false);
          setVisible(participantsRow, false);
          setVisible(runtimeWrap, true);
          setVisible(inputSchemaRow, false);
          setVisible(outputSchemaRow, false);
          setVisible(uiLibsRow, false);
          setVisible(previewModeRow, false);
          setVisible(topicsRow, false);
          setVisible(asyncRow, false);
      }
      validate(profile);
    }

    // sin source mode; inline siempre visible

    function validate(profile) {
      const msgs = [];
      // leer search JSON del textarea
      let searchVal = {};
      try { searchVal = JSON.parse(container.querySelector('#agent_search')?.value || '{}'); } catch (_) { }
      // participantes (textarea)
      const partText = container.querySelector('#agent_participants')?.value || '';
      const partList = partText.split('\n').map(s => s.trim()).filter(Boolean);
      // stream/save_as
      const isStream = !!container.querySelector('#agent_stream')?.checked;
      const saveAs = getInputValue('agent_save_as');

      if (profile === 'rag' || profile === 'retrieval') {
        let indexes = searchVal?.indexes ?? searchVal?.index ?? [];
        if (typeof indexes === 'string') indexes = [indexes];
        const topK = Number(searchVal?.topK ?? 0);
        if (!Array.isArray(indexes) || indexes.length === 0) {
          msgs.push('⚠️ Configura al menos un índice en "Configuración de Búsqueda".');
        }
        if (!topK || topK <= 0) {
          msgs.push('⚠️ El valor de topK debe ser mayor a 0.');
        }
        const mode = (searchVal?.mode || '').toString();
        if ((mode === 'semantic' || mode === 'hybrid') && !searchVal?.semanticConfiguration) {
          msgs.push('⚠️ Define "semanticConfiguration" (p. ej., "my-semantic-config") para modo semantic/hybrid.');
        }
      }
      // Mensaje vacío (recomendación)
      const msgTxt = getInputValue('agent_message');
      if (!msgTxt) {
        msgs.push('ℹ️ Sugerencia: agrega un Mensaje o usa {{input}} para reutilizar la entrada del usuario.');
      }
      if (profile === 'coordinator') {
        if (partList.length === 0) msgs.push('⚠️ Define al menos un participante en "Participantes (avanzado)".');
      }
      if (profile === 'normal' || profile === 'domain_expert') {
        if (searchVal && (searchVal.index || searchVal.indexes || searchVal.topK)) {
          msgs.push('ℹ️ Nota: La configuración de búsqueda se ignorará en este perfil.');
        }
      }
      // Reglas generales de stream/save_as
      if (!isStream && !saveAs) {
        msgs.push('⚠️ Con stream:false debes definir "save_as" para guardar el resultado (p. ej., agent_' + (node.id || 'n') + ').');
      }
      if (profile === 'retrieval' && isStream) {
        msgs.push('⚠️ Retrieval no soporta streaming en UI: usa stream:false y pinta el resultado con un nodo response.');
      }

      // Renderizar mensajes
      validationBox.innerHTML = '';
      if (msgs.length) {
        for (const m of msgs) {
          const p = el('div', { class: 'info-msg', text: m });
          validationBox.appendChild(p);
        }
        // Mensaje de ayuda + enlace clicable a Errores comunes
        const help = el('div', { class: 'info-msg' });
        help.appendChild(document.createTextNode('Consulta Ayuda → Agent Call → '));
        const linkBtn = el('button', { type: 'button', text: 'Errores comunes' });
        linkBtn.className = 'ml-1 px-2 py-0.5 bg-white border rounded text-xs';
        linkBtn.addEventListener('click', () => {
          try {
            if (globalThis.HelpModal && typeof globalThis.HelpModal.open === 'function') {
              globalThis.HelpModal.open('#agent_common_errors');
            } else {
              const btn = document.getElementById('btnHelpDoc');
              if (btn) btn.click();
            }
          } catch (e) { /* noop */ }
        });
        help.appendChild(linkBtn);
        validationBox.appendChild(help);

        // Si es coordinator y faltan participantes, ofrecer enlace directo a "Perfiles (tabla)"
        const participantsMissing = (profile === 'coordinator' && partList.length === 0);
        if (participantsMissing) {
          const prof = el('div', { class: 'info-msg' });
          prof.appendChild(document.createTextNode('Revisa perfiles y participantes: '));
          const profBtn = el('button', { type: 'button', text: 'Perfiles (tabla)' });
          profBtn.className = 'ml-1 px-2 py-0.5 bg-white border rounded text-xs';
          profBtn.addEventListener('click', () => {
            try {
              if (globalThis.HelpModal && typeof globalThis.HelpModal.open === 'function') {
                globalThis.HelpModal.open('#agent_profiles_table');
              } else {
                const btn = document.getElementById('btnHelpDoc');
                if (btn) btn.click();
              }
            } catch (e) { /* noop */ }
          });
          prof.appendChild(profBtn);
          validationBox.appendChild(prof);
        }
      }
    }

    // Inicializar visibilidad y ayuda
    applyProfile(currentProfile);
    profileSel.addEventListener('change', () => applyProfile(profileSel.value));
    // no hay selector de fuente de agente
    // Revalidar al editar búsqueda o participantes
    const searchTa = container.querySelector('#agent_search');
    if (searchTa) searchTa.addEventListener('input', () => validate(profileSel.value));
    const partTa = container.querySelector('#agent_participants');
    if (partTa) partTa.addEventListener('input', () => validate(profileSel.value));
  }

  // Registrar en el sistema
  globalThis.RendererRegistry = globalThis.RendererRegistry || {};
  globalThis.RendererRegistry.agent_call = renderAgentCall;
})();
