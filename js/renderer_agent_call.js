// renderer_agent_call.js
// Renderizador de propiedades para el nodo agent_call
(function(){
  const H = globalThis.FormBuilderHelpers || {};
  const { el, inputRow, arrayRow, jsonEditor } = H;

  const PROFILE_DESCRIPTIONS = {
    normal: 'Conversación/razonamiento directo sin recuperación externa.',
    rag: 'Con recuperación desde Azure AI Search para grounding y citaciones.',
    coordinator: 'Orquesta múltiples agentes/herramientas y fusiona respuestas.',
    retrieval: 'Solo recuperación de contexto desde el índice, sin generar respuesta.',
    domain_expert: 'Experto de dominio con políticas/tono; sin recuperación por defecto.'
  };

  function renderAgentCall(node, container, nodeIds) {
    const props = node.props || {};
    const currentProfile = props.agent_profile || 'normal';

    // Solo modo inline: no agentId

  // Perfil de Agente
    const profileRow = el('div', {class:'form-row'});
    const profileLabelWrap = el('div', {style:'display:flex; align-items:center; gap:6px;'});
    profileLabelWrap.appendChild(el('label', {text:'Perfil de Agente'}));
    // Info tooltip con resumen de perfiles
    const tipWrap = el('span', { class:'inline-tip-wrap' });
    const tipIcon = el('span', { class:'info-tip', text:'i', title:'Perfiles de Agente' });
    const tipBox = el('span', { class:'inline-tip', text:
      'normal: conversación sin recuperación externa.\n' +
      'rag: grounding con Azure AI Search y citaciones.\n' +
      'coordinator: orquesta participantes y fusiona respuestas.\n' +
      'retrieval: solo recuperación de contexto (sin generar).\n' +
      'domain_expert: experto con políticas/tono; sin RAG por defecto.'
    });
    tipWrap.appendChild(tipIcon);
    tipWrap.appendChild(tipBox);
    profileLabelWrap.appendChild(tipWrap);
    profileRow.appendChild(profileLabelWrap);
    const profileSel = el('select', {id:'agent_profile'});
    for (const p of ['normal', 'rag', 'coordinator', 'retrieval', 'domain_expert']) {
      const opt = el('option', {value:p, text:p});
      if(currentProfile === p) opt.selected = true;
      profileSel.appendChild(opt);
    }
    const profileHelp = el('small', {text: PROFILE_DESCRIPTIONS[currentProfile] || ''});
    profileHelp.style.fontSize = '11px';
    profileHelp.style.color = '#666';
    profileRow.appendChild(profileSel);
    profileRow.appendChild(profileHelp);
  container.appendChild(profileRow);

    // Message
    const messageRow = inputRow({label:'Mensaje', id:'agent_message', type:'textarea', value:props.message||'', placeholder:'Prompt o pregunta del usuario'});
  container.appendChild(messageRow);

    // Stream
    const streamRow = el('div', {class:'form-row'});
    streamRow.appendChild(el('label', {text:'Streaming (SSE)'}));
    const streamCheck = el('input', {type:'checkbox', id:'agent_stream'});
    streamCheck.checked = !!props.stream;
    streamRow.appendChild(streamCheck);
  container.appendChild(streamRow);

    // Save As
    const saveAsRow = inputRow({label:'Guardar en', id:'agent_save_as', value:props.save_as||'', placeholder:'Variable para guardar respuesta'});
  container.appendChild(saveAsRow);

  // Tooling (array)
    const toolingRow = arrayRow({label:'Herramientas', id:'agent_tooling', value:props.tooling||[]});
  container.appendChild(toolingRow);

  // (Eliminado) Perfil de Credenciales a nivel de nodo: usar `use_profile` global

    // Model Config (JSON)
    const modelRow = jsonEditor({label:'Modelo (JSON)', id:'agent_model', value:props.model||{
      provider: 'azure-openai',
      deployment: 'gpt-4o-mini',
      temperature: 0.2,
      max_tokens: 800
    }});
  container.appendChild(modelRow);

    // System Prompt
    const sysPromptRow = inputRow({label:'System Prompt', id:'agent_system_prompt', type:'textarea', value:props.system_prompt||'', placeholder:'Instrucciones del sistema (opcional)'});
  container.appendChild(sysPromptRow);

    // Sección desplegable de Opciones avanzadas
    const advSection = el('details', { id: 'agent_adv_section' });
    const advSummary = el('summary', { text: 'Opciones avanzadas' });
    advSection.appendChild(advSummary);

    // Tools avanzadas (JSON)
    const toolsAdvRow = jsonEditor({label:'Herramientas avanzadas (JSON)', id:'agent_tools_advanced', value: Array.isArray(props.tools) ? props.tools : []});
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
    const searchRow = jsonEditor({label:'Configuración de Búsqueda (JSON)', id:'agent_search', value: defaultSearch});
    advSection.appendChild(searchRow);

    // Controles simplificados para modo y semanticConfiguration
    const searchSimplified = el('div', { class: 'form-row' });
    const modeLabel = el('label', { text: 'Modo de búsqueda' });
    const modeSelect = el('select', { id: 'agent_search_mode' });
    for (const m of ['', 'keyword', 'semantic', 'vector', 'hybrid']) {
      const opt = el('option', { value: m, text: m || '(sin especificar)' });
      modeSelect.appendChild(opt);
    }
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
    const advRow = el('div', {class:'form-row'});
    advRow.appendChild(el('label', {text:'Modo (avanzado)'}));
    const modeSel = el('select', {id:'agent_mode'});
    for (const m of ['', 'group_chat', 'sequential', 'fanout']) {
      const opt = el('option', {value:m, text:m||'(ninguno)'});
      if(props.mode === m) opt.selected = true;
      modeSel.appendChild(opt);
    }
    advRow.appendChild(modeSel);
    advSection.appendChild(advRow);

    const participantsRow = arrayRow({label:'Participantes (avanzado)', id:'agent_participants', value:props.participants||[]});
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

    function setVisible(row, visible){ if (!row) return; row.style.display = visible ? '' : 'none'; }

    function getInputValue(id){
      const elx = container.querySelector('#'+id);
      if (!elx) return '';
      if (elx.tagName === 'INPUT' || elx.tagName === 'TEXTAREA' || elx.tagName === 'SELECT') return (elx.value || '').toString().trim();
      const inner = elx.querySelector('input,textarea,select');
      return inner ? (inner.value || '').toString().trim() : '';
    }

    function applyProfile(profile){
      // Ayuda dinámica
      profileHelp.textContent = PROFILE_DESCRIPTIONS[profile] || '';
      // Visibilidad por perfil
      switch(profile){
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
      }
      validate(profile);
    }

    // sin source mode; inline siempre visible

    function validate(profile){
      const msgs = [];
      // leer search JSON del textarea
      let searchVal = {};
      try { searchVal = JSON.parse(container.querySelector('#agent_search')?.value || '{}'); } catch(_) {}
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
        msgs.push('⚠️ Con stream:false debes definir "save_as" para guardar el resultado.');
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
        const help = el('div', { class: 'info-msg', text: 'Consulta Ayuda → Agent Call → Errores comunes.' });
        validationBox.appendChild(help);
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
