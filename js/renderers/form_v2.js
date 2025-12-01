// form_v2.js - renderer form (UI con modo estático/dinámico) — esquema nuevo fields_source/save_as
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