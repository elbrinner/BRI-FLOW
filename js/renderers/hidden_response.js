(function(){
  const { setupValidation, markFieldUsed } = window.RendererHelpers || {};
  const H = window.FormBuilderHelpers || {};
  const inputRow = H.inputRow || function(){ return document.createElement('div'); };
  function renderHiddenResponse(node, container){
    // No template específico aún; reutiliza container directo
    container.appendChild(inputRow({label:'Variable a enviar', id:'hidden_var', value: node.varName || ''}));
    container.appendChild(inputRow({label:'Valor', id:'hidden_value', value: node.value || ''}));
    const validator = setupValidation(container, {
      boxId:'hidden_response_validation_box',
      okMessage:'✔ Hidden listo',
      collectState(){
        const variable=(container.querySelector('#hidden_var input,#hidden_var')?.value||'').trim();
        const value=(container.querySelector('#hidden_value input,#hidden_value')?.value||'').trim();
        return {variable,value};
      },
      buildRules(st){
        return [
          {kind:'error', when: !st.variable, msg:'Variable requerida.'},
          {kind:'warning', when: !st.value, msg:'Valor vacío: se enviará cadena vacía.'}
        ];
      }
    });
    container.querySelectorAll('input,textarea').forEach(el=>{ el.addEventListener('input',validator.run); el.addEventListener('change',validator.run); });
    const validation = validator.run();
    // Instrumentación: marcar slot principal (usamos todo el container al no tener template dedicado)
    markFieldUsed(container);
    try { window.dispatchEvent(new CustomEvent('renderer:after',{ detail:{ type:'hidden_response', container, validation } })); } catch(e){}
  }
  window.RendererRegistry = window.RendererRegistry || {};
  window.RendererRegistry.hidden_response = renderHiddenResponse;
})();