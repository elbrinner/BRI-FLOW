// hidden_response.js - renderer del nodo hidden_response
(function(){
  const { adoptTemplate, setupValidation, markFieldUsed } = window.RendererHelpers || {};
  const H = window.FormBuilderHelpers || {};

  function renderHiddenResponse(node, container){
    container = adoptTemplate(container,'hidden_response','hidden_response-form-slot');
    // Pre-cargar dataInfo si existe
    let dataInfoEl = container.querySelector('#hidden_response_dataInfo');
    // Fallback si el template todavía no estaba cargado al renderizar
    if(!dataInfoEl){
      const inputRow = H.inputRow || function({id,value,label,placeholder}){ const r=document.createElement('div'); const lab=document.createElement('label'); lab.textContent=label; const inp=document.createElement('input'); inp.id=id; inp.value=value||''; inp.placeholder=placeholder||''; r.appendChild(lab); r.appendChild(inp); return r; };
      const row = inputRow({label:'Data Info', id:'hidden_response_dataInfo', value: node.dataInfo || '', placeholder:'ej: {{user_name}} o {"k": "{{val}}"}'});
      // Insertar antes de la caja de validación si existe
      const vbox = container.querySelector('#hidden_response_validation_box');
      if(vbox) container.insertBefore(row, vbox); else container.appendChild(row);
      dataInfoEl = row.querySelector('#hidden_response_dataInfo');
    }
    if(dataInfoEl && node.dataInfo) dataInfoEl.value = node.dataInfo;
    markFieldUsed(dataInfoEl);

    const validator = setupValidation(container, {
      boxId:'hidden_response_validation_box',
      okMessage:'✔ Hidden Response válido',
      collectState(){
        const dataInfo = (dataInfoEl?.value || '').trim();
        return { dataInfo };
      },
      buildRules(st){
        return [
          {kind:'error', when: !st.dataInfo, msg:'Debes definir dataInfo.'},
          {kind:'warning', when: !!st.dataInfo && !/\{\{.*\}\}/.test(st.dataInfo) && st.dataInfo.length<3, msg:'dataInfo muy corto, revisa si es útil.'}
        ];
      }
    });
    container.querySelectorAll('input').forEach(inp=>{ inp.addEventListener('input', validator.run); inp.addEventListener('change', validator.run); });
    const result = validator.run();
    markFieldUsed(container.querySelector('#hidden_response_validation_box'));
    document.dispatchEvent(new CustomEvent('renderer:after', { detail: { type:'hidden_response', container, validation: result }}));
  }

  window.RendererRegistry = window.RendererRegistry || {};
  window.RendererRegistry.hidden_response = renderHiddenResponse;
})();