// file_upload.js - renderer file_upload
(function(){
  const { adoptTemplate, setupValidation, markFieldUsed } = window.RendererHelpers || {};
  const H = window.FormBuilderHelpers || {};
  const inputRow = H.inputRow || function(){ return document.createElement('div'); };

  function renderFileUpload(node, container){
    container = adoptTemplate(container,'file_upload','file_upload-form-slot');
    container.appendChild(inputRow({label:'Aceptar (extensiones)', id:'file_accept', value: node.accept || ''}));
    container.appendChild(inputRow({label:'Max size (bytes)', id:'file_max', value: node.max_size || ''}));
    container.appendChild(inputRow({label:'Guardar como', id:'file_save', value: node.save_as || ''}));
    const fs = container.querySelector('#file_save input, #file_save');
    if(fs && H.attachVarAutocomplete) H.attachVarAutocomplete(fs,{format:'mustache'});
    const validator = setupValidation(container, {
      boxId:'file_upload_validation_box',
      okMessage:'✔ File Upload listo',
      collectState(){
        const saveAs = (container.querySelector('#file_save input,#file_save')?.value||'').trim();
        const max = (container.querySelector('#file_max input,#file_max')?.value||'').trim();
        return { saveAs, max }; },
      buildRules(st){ return [
        {kind:'error', when: !st.saveAs, msg:'Nombre de variable (guardar como) es requerido.'},
        {kind:'warning', when: st.max && isNaN(Number(st.max)), msg:'Max size no es numérico.'}
      ]; }
    });
    const result = validator.run();
    markFieldUsed(container.querySelector('.file_upload-form-slot'));
    document.dispatchEvent(new CustomEvent('renderer:after', { detail: { type:'file_upload', container, validation: result }}));
  }

  window.RendererRegistry = window.RendererRegistry || {};
  window.RendererRegistry.file_upload = renderFileUpload;
})();
