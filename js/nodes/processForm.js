(function() {
  'use strict';

  // Función para procesar nodos 'form'
  window.Simulador.nodes.processForm = function(node, state, flow, nodeId, log, gotoNext, registerInteractionPause, __clearEphemerals, appendChatMessage, renderPreview, renderVariables, step, stepDelay, fastMode, running, stepTimeout) {
    try { console.log('[FormSim] START nodeId=%s rawNode=%o', nodeId, node); } catch(_) {}
    // Construir definición de campos (dinámico o estático)
    let fields = Array.isArray(node.fields) ? node.fields : [];
    (function buildDynamicIfNeeded(){
      const mode = node.mode || 'static';
      const srcKey = node.fields_source || node.FieldsSource || (node.provider && node.provider.source_list);
      try { console.log('[FormSim] mode=%s srcKey=%s initialFields(len=%d)=%o', mode, srcKey, fields.length, fields); } catch(_) {}
      if (mode !== 'dynamic' || !srcKey) return;
      let payload = null;
      try {
        payload = (window.Simulador?.getVariable) ? window.Simulador.getVariable(srcKey) : null;
        if (!payload && window.App?.state) {
          const startId = window.App.state.meta?.start_node;
          const varsArr = window.App.state.nodes?.[startId]?.variables;
          const def = Array.isArray(varsArr) ? varsArr.find(v => v?.name === srcKey) : null;
          if (def) payload = def.defaultValue;
        }
      } catch(_) {}
      try { console.log('[FormSim] dynamic payload(raw)=%o', payload); } catch(_) {}
      const arr = Array.isArray(payload) ? payload : (payload && payload.items ? payload.items : (payload ? [payload] : []));
      try { console.log('[FormSim] normalized payload array(len=%d)=%o', arr.length, arr); } catch(_) {}
      const toTextType = (ft) => {
        const s = String(ft||'').toUpperCase();
        if (['LONG','TEXTAREA','MULTILINE'].includes(s)) return 'textarea';
        if (['SHORT','TEXT','STRING'].includes(s)) return 'text';
        if (['PASSWORD'].includes(s)) return 'password';
        if (['NUMBER','INT','FLOAT','DECIMAL'].includes(s)) return 'number';
        if (['EMAIL'].includes(s)) return 'email';
        if (['DATE','DATETIME'].includes(s)) return 'date';
        if (['SELECT','DROPDOWN','CHOICE'].includes(s)) return 'select';
        if (['CHECKBOX','BOOLEAN','TOGGLE'].includes(s)) return 'checkbox';
        if (['RADIO'].includes(s)) return 'radio';
        return 'text';
      };
      const normalizeOptions = (opts) => {
        if (!opts) return undefined;
        let raw = opts;
        if (!Array.isArray(raw)) {
          // Try common containers
          raw = raw.options || raw.items || raw.choices || raw.values || [];
        }
        if (!Array.isArray(raw)) return undefined;
        return raw.map(o => {
          if (typeof o === 'string' || typeof o === 'number') return { label: String(o), value: o };
          const lbl = o.label ?? o.text ?? o.title ?? o.name ?? o.key ?? o.id ?? '';
          const val = o.value ?? o.id ?? o.key ?? lbl;
          return { label: lbl, value: val };
        });
      };
      const built = [];
      arr.forEach(item => {
        try {
          const base = (item && typeof item === 'object') ? item : { Name: String(item||'') };
          // Unwrap common wrappers like { field: {...} }
          const d = base.field || base;
          const name = d.Name || d.name || d.FieldName || d.nameprop || d.key || d.code || d.id || d.var || d.variable || '';
          if (!name) return;
          // Label: allow localized objects like prompts: { es: '...' }
          let label = d.Prompt || d.prompt || d.Label || d.label || d.title || d.text || d.caption || d.desc || d.descripcion;
          if (label && typeof label === 'object') { label = label.es || label.en || Object.values(label)[0]; }
          if (!label) label = name;
          const type = toTextType(d.FieldType || d.fieldType || d.type || d.kind || d.input || d.control);
          const placeholderRaw = d.Placeholder || d.placeholder || d.hint || d.tooltip || '';
          const placeholder = (typeof placeholderRaw === 'object') ? (placeholderRaw.es || placeholderRaw.en || Object.values(placeholderRaw)[0]) : placeholderRaw;
          const options = normalizeOptions(d.options || d.Options || d.choices || d.Choices || d.items || d.Items || d.values || d.Values);
          const required = !!(d.required || d.Required || d.isRequired || d.mandatory);
          const rows = d.rows || d.Rows;
          const value = d.default ?? d.value ?? d.initial;
          built.push({ name, label, type, placeholder, options, required, rows, value });
          try { console.log('[FormSim] builtField=%o raw=%o', built[built.length-1], d); } catch(_) {}
        } catch(_) {}
      });
      if (built.length) fields = built;
      try { console.log('[FormSim] final dynamic fields(len=%d)=%o', fields.length, fields); } catch(_) {}
    })();
    try { console.log('[FormSim] fields after dynamic pass len=%d details=%o', fields.length, fields); } catch(_) {}

    // Crear formulario (pero no mostrar aún)
    const formWrap = document.createElement('div');
    const formTitle = document.createElement('div'); formTitle.className = 'font-semibold mb-2'; formTitle.textContent = getI18nPrompt(node, 'Completa el formulario');
    const form = document.createElement('form'); form.className = 'mt-1 space-y-3';
    const requiredFields = new Set();

    fields.forEach((field, idx)=>{
      try { console.log('[FormSim] renderField idx=%d def=%o', idx, field); } catch(_) {}
      const fieldDiv = document.createElement('div');
      const label = document.createElement('label'); label.className = 'block text-sm font-medium text-gray-700';
      label.textContent = getI18nPrompt(field, field.label || `Campo ${idx+1}`);
      fieldDiv.appendChild(label);

      let input;
      const fieldType = field.type || 'text';
      if (fieldType === 'textarea'){
        input = document.createElement('textarea'); input.className = 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2'; input.rows = field.rows || 3;
      } else if (fieldType === 'select'){
        input = document.createElement('select'); input.className = 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2';
        const options = Array.isArray(field.options) ? field.options : [];
        options.forEach((opt)=>{
          const optEl = document.createElement('option'); optEl.value = opt.value !== undefined ? opt.value : opt.label; optEl.textContent = opt.label || opt.value; input.appendChild(optEl);
        });
      } else if (fieldType === 'checkbox'){
        input = document.createElement('input'); input.type = 'checkbox'; input.className = 'mt-1'; if (field.value !== undefined) input.value = field.value;
      } else {
        input = document.createElement('input'); input.type = fieldType || 'text'; input.className = 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2'; if (field.placeholder) input.placeholder = field.placeholder;
      }

      if (field.required) { requiredFields.add(field.name); input.required = true; }
      if (field.name) {
        input.name = field.name;
        const preVal = state.variables?.[field.name];
        const initVal = preVal ?? field.value;
        if (initVal !== undefined && initVal !== null){ if (fieldType === 'checkbox') input.checked = !!initVal; else input.value = String(initVal); }
      }

      fieldDiv.appendChild(input);
      form.appendChild(fieldDiv);
    });

    const actions = document.createElement('div'); actions.className = 'mt-3 flex gap-2';
    const btnSubmit = document.createElement('button'); btnSubmit.type = 'submit'; btnSubmit.textContent = 'Enviar'; btnSubmit.className = 'px-4 py-2 bg-sky-600 text-white rounded text-sm';
    const btnCancel = document.createElement('button'); btnCancel.type = 'button'; btnCancel.textContent = 'Cancelar'; btnCancel.className = 'px-4 py-2 bg-gray-300 text-gray-700 rounded text-sm';
    actions.appendChild(btnSubmit); actions.appendChild(btnCancel);

    formWrap.appendChild(formTitle);
    formWrap.appendChild(form);
    formWrap.appendChild(actions);

    // Tarjeta en chat con formulario embebido
    const chatCard = document.createElement('div');
    chatCard.className = 'bg-white border rounded p-3 max-w-[520px] shadow-sm flex flex-col gap-3';
    const msgTitle = document.createElement('div'); msgTitle.className = 'font-semibold'; msgTitle.textContent = getI18nPrompt(node, 'Formulario');
    chatCard.appendChild(msgTitle);
    if (!fields || fields.length === 0) {
      const msgHint = document.createElement('div'); msgHint.className = 'text-xs text-gray-600'; msgHint.textContent = 'No hay campos de formulario para mostrar.';
      chatCard.appendChild(msgHint);
      const btnContinue = document.createElement('button'); btnContinue.className = 'mt-2 px-3 py-1 bg-gray-300 text-gray-800 rounded text-sm'; btnContinue.type = 'button'; btnContinue.textContent = 'Continuar';
      btnContinue.addEventListener('click', ()=>{ state.current = gotoNext(node.next); renderVariables(); if(running) stepTimeout = setTimeout(step, 200); });
      chatCard.appendChild(btnContinue);
    } else {
      chatCard.appendChild(formWrap);
    }
    appendChatMessage('bot', chatCard);

    // Gestión submit/cancelar
    const formData = {};
    const __handleSubmit = () => {
      try { console.log('[FormSim] submit handler invoked'); } catch(_) {}
      let data;
      try {
        data = new FormData(form);
      } catch(e) {
        // Fallback para entornos sin soporte FormData(form)
        try { console.log('[FormSim] FormData(form) falló, usando fallback manual', e); } catch(_){ }
        data = {
          _entries: [],
          get(name){ const found = this._entries.find(e=>e[0]===name); return found ? found[1] : null; },
          forEach(cb){ this._entries.forEach(([k,v])=>cb(v,k)); }
        };
        Array.from(form.elements).forEach(el => {
          if (!el.name) return;
          if (el.type === 'checkbox') {
            data._entries.push([el.name, el.checked]);
          } else {
            data._entries.push([el.name, el.value]);
          }
        });
      }
      let valid = true;
      requiredFields.forEach((name)=>{
        const val = data.get ? data.get(name) : (function(){ const found = data._entries.find(e=>e[0]===name); return found ? found[1] : null; })();
        if (!val && !form.elements[name]?.checked){ valid = false; form.elements[name].classList.add('border-red-500'); }
        else { form.elements[name].classList.remove('border-red-500'); }
      });
      if (!valid) return false;
      const iterate = data.forEach ? data.forEach.bind(data) : (cb)=>{ data._entries.forEach(([k,v])=>cb(v,k)); };
      iterate((val, key)=>{
        if (form.elements[key].type === 'checkbox') formData[key] = form.elements[key].checked; else formData[key] = val;
        const saveAs = (node.save_as || '').trim();
        if (saveAs) {
          state.variables[saveAs] = state.variables[saveAs] || {};
          if (typeof state.variables[saveAs] !== 'object') state.variables[saveAs] = {};
          state.variables[saveAs][key] = formData[key];
        }
        state.variables[key] = formData[key];
        try { console.log('[FormSim] saved var %s=%o (save_as=%s)', key, formData[key], node.save_as); } catch(_) {}
      });
      try { console.log('[FormSim] submit completed formData=%o next=%s', formData, node.next); } catch(_) {}
      const savedKeys = Object.keys(formData);
      if (savedKeys.length){
        const chipText = savedKeys.map(k=>`${k}: ${formData[k]}`).join(', ');
        appendChatMessage('bot', window.Simulador.nodes.createSavedChip('form_data', chipText));
      }
      state.history.push({ node: nodeId, type: 'form', data: formData });
      state.current = gotoNext(node.next);
      renderVariables(); if(running) stepTimeout = setTimeout(step, 200);
      return true;
    };
    form.addEventListener('submit', (e)=>{ e.preventDefault(); __handleSubmit(); });
    form.addEventListener('forceSubmit', (e)=>{ e.preventDefault(); __handleSubmit(); });
    // Exponer helper de prueba para entorno de tests (no usar en producción)
    try {
      window.Simulador.nodes.__formSubmitDebug = function(testNodeId){
        if (testNodeId === nodeId) return __handleSubmit();
        return false;
      };
    } catch(_) {}

    btnCancel.addEventListener('click', ()=>{
      try { console.log('[FormSim] cancel clicked next=%s', node.next); } catch(_) {}
      state.current = gotoNext(node.next);
      renderVariables(); if(running) stepTimeout = setTimeout(step, 200);
    });
  try { console.log('[FormSim] chat card appended fieldsLen=%d', fields.length); } catch(_) {}

    // Pausar la ejecución hasta interacción del usuario
    registerInteractionPause();
    __clearEphemerals();
    return;
  };

})();