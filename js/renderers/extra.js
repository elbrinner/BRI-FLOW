// extra.js - renderer del nodo Extra
(function(){
  const { adoptTemplate, setupValidation, markFieldUsed } = window.RendererHelpers || {};
  const H = window.FormBuilderHelpers || {};
  const inputRow = H.inputRow || function(){ return document.createElement('div'); };

  function renderExtra(node, container){
    container = adoptTemplate(container, 'extra', 'extra-form-slot');
    // Campo para fuente de campos
    const fieldsSourceRow = inputRow('Fuente de campos (opcional)', 'fields_source', node.fields_source || '', 'ej: itemvc_view.CatalogueSections.UseCaseSpecific.Fields');
    container.appendChild(fieldsSourceRow);

    // Nota informativa (sin propiedades de prompt)
    const note = document.createElement('div');
    note.className = 'text-xs text-gray-600 mt-2';
    note.innerHTML = 'Este nodo no requiere prompt. El frontend solo necesita el <code>id</code> del nodo y enviará un payload efímero en <code>request.extra</code>. Si necesitas conservarlo, añade un nodo <code>assign_var</code> después y copia <code>{{extra}}</code> a una variable. Para formularios dinámicos, usa la fuente de campos.';
    container.appendChild(note);

    const validator = setupValidation(container, {
      boxId: 'extra_validation_box',
      okMessage: '✔ Extra configurado',
      collectState(){
        return {
          fields_source: container.querySelector('#extra_fields_source').value.trim()
        };
      },
      buildRules(){
        const state = this.collectState();
        return [
          { kind:'info', when: state.fields_source, msg:'Campos dinámicos desde: ' + state.fields_source },
          { kind:'info', when: !state.fields_source, msg:'Sin campos dinámicos; el frontend enviará extra directamente.' }
        ];
      }
    });
    const result = validator.run();
    markFieldUsed(container.querySelector('.extra-form-slot'));
    document.dispatchEvent(new CustomEvent('renderer:after', { detail: { type:'extra', container, validation: result }}));
  }

  window.RendererRegistry = window.RendererRegistry || {};
  window.RendererRegistry.extra = renderExtra;
})();
