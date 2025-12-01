// form.js - renderer form (UI con modo estático/dinámico) — esquema nuevo fields_source/save_as
(function(){
  const { adoptTemplate, setupValidation, markFieldUsed } = window.RendererHelpers || {};
  const H = window.FormBuilderHelpers || {};
  const inputRow = H.inputRow || function(){ return document.createElement('div'); };
  const fieldsEditor = H.fieldsEditor || function(){ return document.createElement('div'); };
  const el = H.el || function(tag, attrs={}, children=[]) {
    const e = document.createElement(tag);
    if (attrs) {
      Object.entries(attrs).forEach(([k,v]) => {
        if (k === 'className') e.className = v; else if (k === 'text') e.textContent = v; else e.setAttribute(k, v);
      });
    }
    (children||[]).forEach(c => e.appendChild(c));
    return e;
  };

  function renderForm(node, container){
    container = adoptTemplate(container, 'form', 'form-form-slot');

    // save_as con sugerencia
    const suggested = (node.save_as && String(node.save_as).trim()) || (node.id ? `form_${node.id}_values` : '');
    const saveRow = inputRow({ label: `Guardar datos en (save_as) — sugerido: ${suggested || '(defínelo)'}`, id: 'form_save_as', value: suggested, placeholder: 'p.ej. uc_form_values' });
    container.appendChild(saveRow);

    // selector de modo
    const modeRow = el('div', { className: 'form-row flex items-center gap-2' });
    modeRow.appendChild(el('label', { text: 'Modo' }));
    const modeSel = el('select', { id: 'form_mode' });
    ['static','dynamic'].forEach(m => {
      const opt = el('option', { value: m, text: m });
      if ((node.mode || 'static') === m) opt.selected = true;
      modeSel.appendChild(opt);
    });
    modeRow.appendChild(modeSel);
    container.appendChild(modeRow);

    // editor de campos (estático)
    const staticWrap = el('div', { id: 'form_static_wrap' });
    const currentFields = Array.isArray(node.fields) ? node.fields : [];
    const staticRow = fieldsEditor({ label: 'Campos', id: 'form_fields', fields: currentFields });
    staticRow.querySelector('div[id$="_container"]')?.setAttribute('id', 'form_fields_container');
    staticWrap.appendChild(staticRow);
    container.appendChild(staticWrap);

    // configuración dinámica (fields_source + filtros/orden)
    const dynWrap = el('div', { id: 'form_dynamic_wrap', className: 'provider-wrap border rounded p-2 mb-2 bg-white/70', style: 'display:none;' });
    dynWrap.appendChild(inputRow({ label: 'Fuente de campos (fields_source)', id: 'form_fields_source', value: node.fields_source || node.FieldsSource || '', placeholder: 'ucSectionFields' }));
    dynWrap.appendChild(inputRow({ label: 'Filtro (filter_expr)', id: 'form_filter_expr', value: node.filter_expr || '', placeholder: 'item.activo' }));
    dynWrap.appendChild(inputRow({ label: 'Orden (sort_expr)', id: 'form_sort_expr', value: node.sort_expr || '', placeholder: 'item.orden' }));
    ['#form_fields_source','#form_filter_expr','#form_sort_expr'].forEach(sel => {
      const inp = dynWrap.querySelector(sel + ' input, ' + sel);
      if (inp && window.FormBuilderHelpers?.attachVarAutocomplete) {
        try { window.FormBuilderHelpers.attachVarAutocomplete(inp, { format: 'context' }); } catch(_) {}
      }
    });
    container.appendChild(dynWrap);

    // validación
    const validator = setupValidation(container, {
      boxId: 'form_validation_box',
      okMessage: '✔ Form válido',
      collectState(){
        const mode = modeSel.value;
        const src = container.querySelector('#form_fields_source input, #form_fields_source')?.value?.trim();
        const fieldsRow = container.querySelector('#form_fields_container');
        const fields = (mode === 'static' && fieldsRow && typeof (fieldsRow.closest('.form-row')||{}).getValue === 'function')
          ? (fieldsRow.closest('.form-row').getValue() || [])
          : [];
        return { mode, fields_source: src, fields };
      },
      buildRules(st){
        const rules = [];
        if (st.mode === 'dynamic') rules.push({ kind: 'error', when: !st.fields_source, msg: 'Debes indicar fields_source en modo dinámico.', field: '#form_fields_source' });
        if (st.mode === 'static') rules.push({ kind: 'error', when: !Array.isArray(st.fields) || st.fields.length === 0, msg: 'Debes definir al menos un campo.' });
        return rules;
      }
    });

    function toggleVisibility(){
      const mode = modeSel.value;
      staticWrap.style.display = (mode === 'static') ? 'block' : 'none';
      dynWrap.style.display = (mode === 'dynamic') ? 'block' : 'none';
      validator.run();
    }
    modeSel.addEventListener('change', toggleVisibility);
    toggleVisibility();

    validator.run();
    markFieldUsed(container.querySelector('.form-form-slot'));
  }

  window.RendererRegistry = window.RendererRegistry || {};
  window.RendererRegistry.form = renderForm;
})();
// form.js - renderer form (UI con modo estático/dinámico) — esquema nuevo fields_source/save_as
(function(){
  const { adoptTemplate, setupValidation, markFieldUsed } = window.RendererHelpers || {};
  const H = window.FormBuilderHelpers || {};
  const inputRow = H.inputRow || function(){ return document.createElement('div'); };
  const fieldsEditor = H.fieldsEditor || function(){ return document.createElement('div'); };
  const el = H.el || function(tag, attrs={}, children=[]) {
    const e = document.createElement(tag);
    if (attrs) {
      Object.entries(attrs).forEach(([k,v]) => {
        if (k === 'className') e.className = v; else if (k === 'text') e.textContent = v; else e.setAttribute(k, v);
      });
    }
    (children||[]).forEach(c => e.appendChild(c));
    return e;
  };

  function renderForm(node, container){
    container = adoptTemplate(container, 'form', 'form-form-slot');

    // save_as con sugerencia
    const suggested = (node.save_as && String(node.save_as).trim()) || (node.id ? `form_${node.id}_values` : '');
    const saveRow = inputRow({ label: `Guardar datos en (save_as) — sugerido: ${suggested || '(defínelo)'}`, id: 'form_save_as', value: suggested, placeholder: 'p.ej. uc_form_values' });
    container.appendChild(saveRow);

    // selector de modo
    const modeRow = el('div', { className: 'form-row flex items-center gap-2' });
    modeRow.appendChild(el('label', { text: 'Modo' }));
    const modeSel = el('select', { id: 'form_mode' });
    ['static','dynamic'].forEach(m => {
      const opt = el('option', { value: m, text: m });
      if ((node.mode || 'static') === m) opt.selected = true;
      modeSel.appendChild(opt);
    });
    modeRow.appendChild(modeSel);
    container.appendChild(modeRow);

    // editor de campos (estático)
    const staticWrap = el('div', { id: 'form_static_wrap' });
    const currentFields = Array.isArray(node.fields) ? node.fields : [];
    const staticRow = fieldsEditor({ label: 'Campos', id: 'form_fields', fields: currentFields });
    staticRow.querySelector('div[id$="_container"]')?.setAttribute('id', 'form_fields_container');
    staticWrap.appendChild(staticRow);
    container.appendChild(staticWrap);

    // configuración dinámica (fields_source + filtros/orden)
    const dynWrap = el('div', { id: 'form_dynamic_wrap', className: 'provider-wrap border rounded p-2 mb-2 bg-white/70', style: 'display:none;' });
    dynWrap.appendChild(inputRow({ label: 'Fuente de campos (fields_source)', id: 'form_fields_source', value: node.fields_source || node.FieldsSource || '', placeholder: 'ucSectionFields' }));
    dynWrap.appendChild(inputRow({ label: 'Filtro (filter_expr)', id: 'form_filter_expr', value: node.filter_expr || '', placeholder: 'item.activo' }));
    dynWrap.appendChild(inputRow({ label: 'Orden (sort_expr)', id: 'form_sort_expr', value: node.sort_expr || '', placeholder: 'item.orden' }));
    ['#form_fields_source','#form_filter_expr','#form_sort_expr'].forEach(sel => {
      const inp = dynWrap.querySelector(sel + ' input, ' + sel);
      if (inp && window.FormBuilderHelpers?.attachVarAutocomplete) {
        try { window.FormBuilderHelpers.attachVarAutocomplete(inp, { format: 'context' }); } catch(_) {}
      }
    });
    container.appendChild(dynWrap);

    // validación
    const validator = setupValidation(container, {
      boxId: 'form_validation_box',
      okMessage: '✔ Form válido',
      collectState(){
        const mode = modeSel.value;
        const src = container.querySelector('#form_fields_source input, #form_fields_source')?.value?.trim();
        const fieldsRow = container.querySelector('#form_fields_container');
        const fields = (mode === 'static' && fieldsRow && typeof (fieldsRow.closest('.form-row')||{}).getValue === 'function')
          ? (fieldsRow.closest('.form-row').getValue() || [])
          : [];
        return { mode, fields_source: src, fields };
      },
      buildRules(st){
        const rules = [];
        if (st.mode === 'dynamic') rules.push({ kind: 'error', when: !st.fields_source, msg: 'Debes indicar fields_source en modo dinámico.', field: '#form_fields_source' });
        if (st.mode === 'static') rules.push({ kind: 'error', when: !Array.isArray(st.fields) || st.fields.length === 0, msg: 'Debes definir al menos un campo.' });
        return rules;
      }
    });

    function toggleVisibility(){
      const mode = modeSel.value;
      staticWrap.style.display = (mode === 'static') ? 'block' : 'none';
      dynWrap.style.display = (mode === 'dynamic') ? 'block' : 'none';
      validator.run();
    }
    modeSel.addEventListener('change', toggleVisibility);
    toggleVisibility();

    validator.run();
    markFieldUsed(container.querySelector('.form-form-slot'));
  }

  window.RendererRegistry = window.RendererRegistry || {};
  window.RendererRegistry.form = renderForm;
})();
// form.js - renderer del nodo form (estático y dinámico)
(function(){
  const { adoptTemplate, setupValidation, markFieldUsed } = window.RendererHelpers || {};
  const H = window.FormBuilderHelpers || {};
  const inputRow = H.inputRow || function(){ return document.createElement('div'); };
  const fieldsEditor = H.fieldsEditor || function(){ return document.createElement('div'); };
  const el = H.el || function(tag, attrs={}, children=[]){ const e=document.createElement(tag); (children||[]).forEach(c=>e.appendChild(c)); return e; };

  function infoIcon(text){ const wrap=el('span',{class:'info-tip','data-tip':text}); wrap.textContent='ⓘ'; return wrap; }

  function renderForm(node, container){
    if (typeof window.__templatesReady !== 'undefined' && !window.__templatesReady) {
      container.innerHTML = '<div class="p-4 text-gray-600">Cargando template...</div>';
      const onReady = () => { try { renderForm(node, container); } catch(_) {} };
      document.addEventListener('templates:ready', onReady, { once: true });
      return;
    }

    container = adoptTemplate(container, 'form', 'form-form-slot');
    if(!container?.classList?.contains('form-form-slot')){
      const fallback = document.createElement('div');
      fallback.className='form-form-slot';
      (container?.appendChild ? container : document.body).appendChild(fallback);
      container = fallback;
    }

    // Save_as variable
    const defaultSave = (node.save_as && String(node.save_as).trim()) || (node.id ? `form_${node.id}_values` : '');
    const saveRow = inputRow({label:`Guardar datos en (save_as) — sugerido: ${defaultSave || '(defínelo)'}`, id:'form_save_as', value: defaultSave, placeholder:'p.ej. uc_form_values'});
    container.appendChild(saveRow);

    // Mode selector
    const modeRow=el('div',{class:'form-row flex items-center gap-2'});
    modeRow.appendChild(el('label',{text:'Modo'}));
    const modeSel=el('select',{id:'form_mode'});
    ['static','dynamic'].forEach(m=>{
      const opt=document.createElement('option'); opt.value=m; opt.textContent=m;
      if((node.mode||'static')===m) opt.selected=true; modeSel.appendChild(opt);
    });
    modeRow.appendChild(modeSel); container.appendChild(modeRow);

    // Static fields editor
    const staticWrap = document.createElement('div'); staticWrap.id = 'form_static_wrap';
    const staticRow = fieldsEditor({label:'Campos', id:'form_fields'});
    // inicializar con node.fields si existen
    try {
      const list = Array.isArray(node.fields) ? node.fields : [];
      const containerId = 'form_fields_container';
      staticRow.querySelector('div[id$="_container"]')?.setAttribute('id', containerId);
      // call renderList by re-setting value through getValue stub
      if (Array.isArray(list) && list.length) {
        // emulate user edits by replacing internal captured array
        if (typeof staticRow.getValue === 'function') {
          // no direct setter, but fieldsEditor captured its own 'fields' reference
          // we rebuild the row to seed values
          staticWrap.innerHTML='';
        }
      }
    } catch(_) {}
    staticWrap.appendChild(staticRow); container.appendChild(staticWrap);

    // Dynamic provider
    const dynWrap = el('div',{id:'form_dynamic_wrap', class:'provider-wrap border rounded p-2 mb-2 bg-white/70', style:'display:none;'});
    dynWrap.appendChild(inputRow({label:'Fuente de campos (fields_source)', id:'form_fields_source', value: node.fields_source || node.FieldsSource || '' , placeholder:'ucSectionFields'}));
    dynWrap.appendChild(inputRow({label:'Filtro (filter_expr)', id:'form_filter_expr', value: node.filter_expr || '' , placeholder:'item.activo'}));
    dynWrap.appendChild(inputRow({label:'Orden (sort_expr)', id:'form_sort_expr', value: node.sort_expr || '' , placeholder:'item.orden'}));
    // autocompletado de variables en fields_source
    ['#form_fields_source','#form_filter_expr','#form_sort_expr'].forEach(sel=>{
      const inp = dynWrap.querySelector(sel+' input, '+sel);
      if (inp && window.FormBuilderHelpers?.attachVarAutocomplete) {
        try { window.FormBuilderHelpers.attachVarAutocomplete(inp,{format:'context'}); } catch(_){}
      }
    });
    container.appendChild(dynWrap);

    function toggleVisibility(){
      const mode = modeSel.value;
      staticWrap.style.display = (mode==='static') ? 'block' : 'none';
      dynWrap.style.display = (mode==='dynamic') ? 'block' : 'none';
    }
    modeSel.addEventListener('change', toggleVisibility);
    toggleVisibility();

    // Validación simple
    const validator = setupValidation(container, {
      boxId:'form_validation_box',
      okMessage:'✔ Sin problemas',
      collectState: () => {
        return {
          mode: modeSel.value,
          fields_source: container.querySelector('#form_fields_source input, #form_fields_source')?.value?.trim()
        };
      },
      buildRules: (st) => {
        const rules=[];
        // form.js - renderer del nodo form (estático y dinámico) — esquema nuevo con fields_source/save_as
        (function(){
          const { adoptTemplate, setupValidation, markFieldUsed } = window.RendererHelpers || {};
          const H = window.FormBuilderHelpers || {};
          const inputRow = H.inputRow || function(){ return document.createElement('div'); };
          const fieldsEditor = H.fieldsEditor || function(){ return document.createElement('div'); };
          const el = H.el || function(tag, attrs={}, children=[]){ const e=document.createElement(tag); if(attrs){ Object.entries(attrs).forEach(([k,v])=>{ if(k==='className') e.className=v; else if(k==='text') e.textContent=v; else e.setAttribute(k,v); }); } (children||[]).forEach(c=>e.appendChild(c)); return e; };

          function renderForm(node, container){
            container = adoptTemplate(container, 'form', 'form-form-slot');

            // Campo save_as con sugerencia
            const suggested = (node.save_as && String(node.save_as).trim()) || (node.id ? `form_${node.id}_values` : '');
            const saveRow = inputRow({ label: `Guardar datos en (save_as) — sugerido: ${suggested || '(defínelo)'}`, id: 'form_save_as', value: suggested, placeholder: 'p.ej. uc_form_values' });
            container.appendChild(saveRow);

            // Selector de modo
            const modeRow = el('div', { className: 'form-row flex items-center gap-2' });
            modeRow.appendChild(el('label', { text: 'Modo' }));
            const modeSel = el('select', { id: 'form_mode' });
            ['static','dynamic'].forEach(m => {
              const opt = el('option', { value: m, text: m });
              if ((node.mode || 'static') === m) opt.selected = true;
              modeSel.appendChild(opt);
            });
            modeRow.appendChild(modeSel);
            container.appendChild(modeRow);

            // Editor de campos (estático)
            const staticWrap = el('div', { id: 'form_static_wrap' });
            const currentFields = Array.isArray(node.fields) ? node.fields : [];
            const staticRow = fieldsEditor({ label: 'Campos', id: 'form_fields', fields: currentFields });
            // asegurar id del contenedor interno para el lector
            staticRow.querySelector('div[id$="_container"]')?.setAttribute('id', 'form_fields_container');
            staticWrap.appendChild(staticRow);
            container.appendChild(staticWrap);

            // Configuración dinámica (fields_source + filtros/orden)
            const dynWrap = el('div', { id: 'form_dynamic_wrap', className: 'provider-wrap border rounded p-2 mb-2 bg-white/70', style: 'display:none;' });
            dynWrap.appendChild(inputRow({ label: 'Fuente de campos (fields_source)', id: 'form_fields_source', value: node.fields_source || node.FieldsSource || '', placeholder: 'ucSectionFields' }));
            dynWrap.appendChild(inputRow({ label: 'Filtro (filter_expr)', id: 'form_filter_expr', value: node.filter_expr || '', placeholder: 'item.activo' }));
            dynWrap.appendChild(inputRow({ label: 'Orden (sort_expr)', id: 'form_sort_expr', value: node.sort_expr || '', placeholder: 'item.orden' }));
            // autocompletado de variables
            ['#form_fields_source','#form_filter_expr','#form_sort_expr'].forEach(sel => {
              const inp = dynWrap.querySelector(sel + ' input, ' + sel);
              if (inp && window.FormBuilderHelpers?.attachVarAutocomplete) {
                try { window.FormBuilderHelpers.attachVarAutocomplete(inp, { format: 'context' }); } catch(_) {}
              }
            });
            container.appendChild(dynWrap);

            function toggleVisibility(){
              const mode = modeSel.value;
              staticWrap.style.display = (mode === 'static') ? 'block' : 'none';
              dynWrap.style.display = (mode === 'dynamic') ? 'block' : 'none';
              validator.run();
            }
            modeSel.addEventListener('change', toggleVisibility);
            toggleVisibility();

            // Validación
            const validator = setupValidation(container, {
              boxId: 'form_validation_box',
              okMessage: '✔ Form válido',
              collectState(){
                const mode = modeSel.value;
                const src = container.querySelector('#form_fields_source input, #form_fields_source')?.value?.trim();
                const fieldsRow = container.querySelector('#form_fields_container');
                const fields = (mode === 'static' && fieldsRow && typeof (fieldsRow.closest('.form-row')||{}).getValue === 'function')
                  ? (fieldsRow.closest('.form-row').getValue() || [])
                  : [];
                return { mode, fields_source: src, fields };
              },
              buildRules(st){
                const rules = [];
                if (st.mode === 'dynamic') rules.push({ kind: 'error', when: !st.fields_source, msg: 'Debes indicar fields_source en modo dinámico.', field: '#form_fields_source' });
                if (st.mode === 'static') rules.push({ kind: 'error', when: !Array.isArray(st.fields) || st.fields.length === 0, msg: 'Debes definir al menos un campo.' });
                return rules;
              }
            });
            validator.run();
            markFieldUsed(container.querySelector('.form-form-slot'));
          }

          window.RendererRegistry = window.RendererRegistry || {};
          window.RendererRegistry.form = renderForm;
        })();
    modeSel.addEventListener('change', toggleVisibility);
