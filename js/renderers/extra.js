// extra.js - renderer del nodo Extra
(function(){
  const { adoptTemplate, setupValidation, markFieldUsed } = window.RendererHelpers || {};
  const H = window.FormBuilderHelpers || {};
  const inputRow = H.inputRow || function(){ return document.createElement('div'); };

  function renderExtra(node, container){
    container = adoptTemplate(container, 'extra', 'extra-form-slot');
    // Nota informativa (sin propiedades de prompt)
    const note = document.createElement('div');
    note.className = 'text-xs text-gray-600 mt-2';
    note.innerHTML = 'Este nodo no requiere prompt. El frontend solo necesita el <code>id</code> del nodo y enviará un payload efímero en <code>request.extra</code>. Si necesitas conservarlo, añade un nodo <code>assign_var</code> después y copia <code>{{extra}}</code> a una variable.';
    container.appendChild(note);

    const validator = setupValidation(container, {
      boxId: 'extra_validation_box',
      okMessage: '✔ Extra sin propiedades',
      collectState(){
        return {};
      },
      buildRules(){
        return [
          { kind:'info', when: true, msg:'Configura únicamente el siguiente nodo (next). El valor extra es efímero.' }
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
