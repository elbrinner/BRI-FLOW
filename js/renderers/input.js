// input.js - renderer del nodo input
(function(){
  const { adoptTemplate, setupValidation, markFieldUsed } = window.RendererHelpers || {};
  const H = window.FormBuilderHelpers || {};
  const inputRow = H.inputRow || function(){ return document.createElement('div'); };
  // el no requerido en este renderer actualmente

  function renderInput(node, container){
    container = adoptTemplate(container,'input','input-form-slot');
    const locales = (window.App?.state?.meta?.locales?.length) ? window.App.state.meta.locales : ['es'];
    locales.forEach(loc=>{
      container.appendChild(inputRow({label:`Prompt (${loc})`, id:`input_prompt_${loc}`, value: node.i18n?.[loc]?.prompt || ''}));
    });
    container.appendChild(inputRow({label:'Guardar como (save_as)', id:'input_save_as', value: node.save_as || 'input'}));
    const sv = container.querySelector('#input_save_as input,#input_save_as');
    if(sv && window.FormBuilderHelpers?.attachVarAutocomplete){
      window.FormBuilderHelpers.attachVarAutocomplete(sv,{format:'mustache'});
    }

    const validator = setupValidation(container, {
      boxId: 'input_validation_box',
      okMessage: '✔ Input válido',
      collectState(){
        const prompts = locales.map(loc=> (container.querySelector(`#input_prompt_${loc} input,#input_prompt_${loc} textarea,#input_prompt_${loc}`)?.value || '').trim());
        const saveAs = (sv?.value || '').trim();
        return {prompts, saveAs};
      },
      buildRules(st){
        return [
          {kind:'error', when: st.prompts.every(p=>!p), msg:'Debes definir al menos un prompt.'},
          {kind:'warning', when: !st.saveAs, msg:'save_as vacío: se usará valor por defecto al serializar.'},
          {kind:'warning', when: !!st.saveAs && /\s/.test(st.saveAs), msg:'save_as contiene espacios.'},
          {kind:'info', when: st.prompts.filter(Boolean).length>1, msg:'Múltiples prompts definidos (multi-locale).'}
        ];
      }
    });
    container.querySelectorAll('input,textarea').forEach(el=>{ el.addEventListener('input',validator.run); el.addEventListener('change',validator.run); });
    const result = validator.run();
    markFieldUsed(container.querySelector('.input-form-slot'));
    document.dispatchEvent(new CustomEvent('renderer:after', { detail: { type:'input', container, validation: result }}));
  }

  window.RendererRegistry = window.RendererRegistry || {};
  window.RendererRegistry.input = renderInput;
})();
