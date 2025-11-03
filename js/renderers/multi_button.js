// multi_button.js - renderer que reutiliza el de button y añade controles específicos de selección múltiple
(function(){
  const RH = window.RendererHelpers || {};
  const setupValidation = RH.setupValidation || function(){ return { run: ()=>({}) }; };

  function el(tag, attrs = {}, children = []){
    const e = document.createElement(tag);
    if (attrs && typeof attrs === 'object'){
      Object.keys(attrs).forEach(k=>{
        if (k === 'className') e.className = attrs[k];
        else if (k === 'text') e.textContent = attrs[k];
        else if (k.startsWith('data-')) e.setAttribute(k, attrs[k]);
        else e[k] = attrs[k];
      });
    }
    (children||[]).forEach(c=>{ if(c) e.appendChild(c); });
    return e;
  }

  function appendMultiSpecificUI(node, container){
    // Crear sección específica para multi selección
    const section = el('div', { className: 'form-section mt-2 border rounded p-2 bg-white/70' });
    section.appendChild(el('div', { className: 'text-sm font-semibold text-gray-700 mb-1', text: 'Selección múltiple' }));
    // min
    const minRow = el('div', { className: 'form-row' });
    minRow.appendChild(el('label', { text: 'Mínimo seleccionado (opcional)' }));
    const minInp = el('input', { id: 'mb_min', type: 'number', min: '0' });
    if (Number.isFinite(node.min_selected)) minInp.value = String(node.min_selected);
    minInp.addEventListener('input', (ev)=>{
      const v = Number.parseInt(String(ev.target.value||'').trim(), 10);
      if (Number.isFinite(v)) node.min_selected = v; else delete node.min_selected;
      runValidation();
    });
    minRow.appendChild(minInp);
    section.appendChild(minRow);
    // max
    const maxRow = el('div', { className: 'form-row' });
    maxRow.appendChild(el('label', { text: 'Máximo seleccionado (opcional)' }));
    const maxInp = el('input', { id: 'mb_max', type: 'number', min: '0' });
    if (Number.isFinite(node.max_selected)) maxInp.value = String(node.max_selected);
    maxInp.addEventListener('input', (ev)=>{
      const v = Number.parseInt(String(ev.target.value||'').trim(), 10);
      if (Number.isFinite(v)) node.max_selected = v; else delete node.max_selected;
      runValidation();
    });
    maxRow.appendChild(maxInp);
    section.appendChild(maxRow);
    // defaults
    const defRow = el('div', { className: 'form-row' });
    defRow.appendChild(el('label', { text: 'Valores por defecto (coma separada)' }));
    const defInp = el('input', { id: 'mb_defaults', type: 'text', placeholder: 'v1, v2, v3' });
    if (Array.isArray(node.default_values)) defInp.value = node.default_values.join(',');
    defInp.addEventListener('input', (ev)=>{
      const arr = String(ev.target.value||'').split(',').map(s=>s.trim()).filter(Boolean);
      if (arr.length) node.default_values = arr; else delete node.default_values;
      runValidation();
    });
    defRow.appendChild(defInp);
    section.appendChild(defRow);
    container.appendChild(section);

    // Validación específica multi
    const validator = setupValidation(container, {
      boxId: 'multi_button_validation_box',
      collectState: () => {
        const mode = container.querySelector('#button_mode')?.value || 'static';
        const min = Number.parseInt(container.querySelector('#mb_min')?.value || '', 10);
        const max = Number.parseInt(container.querySelector('#mb_max')?.value || '', 10);
        const defs = String(container.querySelector('#mb_defaults')?.value || '').split(',').map(s=>s.trim()).filter(Boolean);
        return {
          mode,
          hasMin: Number.isFinite(min),
          hasMax: Number.isFinite(max),
          min: Number.isFinite(min)? min : undefined,
          max: Number.isFinite(max)? max : undefined,
          defCount: defs.length
        };
      },
      buildRules: (s) => {
        const rules = [];
        if (s.hasMin && s.hasMax && s.min > s.max) {
          rules.push({ kind: 'error', when: true, msg: 'min_selected no puede ser mayor que max_selected', field:'#mb_min' });
        }
        if (s.defCount > 0) {
          if (s.hasMin && s.defCount < s.min) rules.push({ kind: 'warning', when: true, msg: 'Valores por defecto menor al mínimo requerido.' });
          if (s.hasMax && s.defCount > s.max) rules.push({ kind: 'warning', when: true, msg: 'Valores por defecto exceden el máximo permitido.' });
        }
        return rules;
      }
    });
    function runValidation(){ try { validator.run(); } catch(_){} }
    return { runValidation };
  }

  function renderMultiButton(node, container, nodeIds){
    if (!window.RendererRegistry || !window.RendererRegistry.button){ return; }
    // Render base de button
    window.RendererRegistry.button(node, container, nodeIds);
    // Añadir controles específicos
    appendMultiSpecificUI(node, container);
    // Señal de post-render específico
    document.dispatchEvent(new CustomEvent('renderer:after', { detail: { type:'multi_button', container } }));
  }

  window.RendererRegistry = window.RendererRegistry || {};
  window.RendererRegistry.multi_button = renderMultiButton;
})();
