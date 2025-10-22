// file_download.js - renderer file_download
(function(){
  const { adoptTemplate, setupValidation, markFieldUsed } = window.RendererHelpers || {};
  const H = window.FormBuilderHelpers || {};
  const inputRow = H.inputRow || function(){ return document.createElement('div'); };

  function renderFileDownload(node, container){
    container = adoptTemplate(container,'file_download','file_download-form-slot');
    container.appendChild(inputRow({label:'File URL', id:'fd_url', value: node.file_url || ''}));
    container.appendChild(inputRow({label:'Filename', id:'fd_name', value: node.filename || ''}));
    container.appendChild(inputRow({label:'Descripción', id:'fd_desc', value: node.description || ''}));
    const validator = setupValidation(container, {
      boxId:'file_download_validation_box',
      okMessage:'✔ File Download listo',
      collectState(){ return { url:(container.querySelector('#fd_url input,#fd_url')?.value||'').trim(), name:(container.querySelector('#fd_name input,#fd_name')?.value||'').trim() }; },
      buildRules(st){ return [
        {kind:'error', when: !st.url, msg:'URL requerida.'},
        {kind:'warning', when: st.url && !/^https?:/i.test(st.url), msg:'La URL no parece http/https.'},
        {kind:'warning', when: !st.name, msg:'Filename vacío: se usará uno por defecto.'}
      ]; }
    });
    const result = validator.run();
    markFieldUsed(container.querySelector('.file_download-form-slot'));
    document.dispatchEvent(new CustomEvent('renderer:after', { detail: { type:'file_download', container, validation: result }}));
  }

  window.RendererRegistry = window.RendererRegistry || {};
  window.RendererRegistry.file_download = renderFileDownload;
})();
