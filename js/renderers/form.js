// form.js - renderer form
(function(){
  const { adoptTemplate, setupValidation, markFieldUsed } = window.RendererHelpers || {};
  const H = window.FormBuilderHelpers || {};
  const fieldsEditor = H.fieldsEditor || function(){ return document.createElement('div'); };

  function renderForm(node, container){
    container = adoptTemplate(container,'form','form-form-slot');
    const fields = node.fields || [];
    const fe = fieldsEditor({label:'Campos del formulario', id:'form_fields', fields});
    container.appendChild(fe);
    const validator = setupValidation(container, {
      boxId:'form_validation_box',
      okMessage:'✔ Form válido',
      collectState(){ return { fields: Array.isArray(node.fields)?node.fields:[] }; },
      buildRules(st){ return [
        {kind:'error', when: st.fields.length===0, msg:'Debes definir al menos un campo.'},
        {kind:'warning', when: st.fields.some(f=>!f?.name), msg:'Hay campos sin nombre.'}
      ]; }
    });
    const result = validator.run();
    markFieldUsed(container.querySelector('.form-form-slot'));
    document.dispatchEvent(new CustomEvent('renderer:after', { detail: { type:'form', container, validation: result }}));
  }

  window.RendererRegistry = window.RendererRegistry || {};
  window.RendererRegistry.form = renderForm;
})();
