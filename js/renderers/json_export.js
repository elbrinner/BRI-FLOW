// json_export.js - renderer json_export
(function(){
  const { adoptTemplate, setupValidation, markFieldUsed } = window.RendererHelpers || {};
  const H = window.FormBuilderHelpers || {};
  const inputRow = H.inputRow || function(){ return document.createElement('div'); };
  const jsonEditor = H.jsonEditor || function(){ return document.createElement('div'); };

  function renderJsonExport(node, container){
    container = adoptTemplate(container,'json_export','json_export-form-slot');
    container.appendChild(inputRow({label:'Filename', id:'json_filename', value: node.filename || ''}));
    container.appendChild(inputRow({label:'Descripción', id:'json_desc', value: node.description || '', type:'textarea'}));
    container.appendChild(jsonEditor({label:'Template (JSON)', id:'json_template', value: node.template || {}}));
    const validator = setupValidation(container, {
      boxId:'json_export_validation_box',
      okMessage:'✔ JSON Export OK',
      collectState(){ return { filename:(container.querySelector('#json_filename input,#json_filename')?.value||'').trim() }; },
      buildRules(st){ return [ {kind:'error', when: !st.filename, msg:'Filename requerido.'} ]; }
    });
    const result = validator.run();
    markFieldUsed(container.querySelector('.json_export-form-slot'));
    document.dispatchEvent(new CustomEvent('renderer:after', { detail: { type:'json_export', container, validation: result }}));
  }

  window.RendererRegistry = window.RendererRegistry || {};
  window.RendererRegistry.json_export = renderJsonExport;
})();
