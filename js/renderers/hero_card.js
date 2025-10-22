// hero_card.js - renderer hero_card
(function(){
  const { adoptTemplate, setupValidation, markFieldUsed } = window.RendererHelpers || {};
  const H = window.FormBuilderHelpers || {};
  const inputRow = H.inputRow || function(){ return document.createElement('div'); };
  const jsonEditor = H.jsonEditor || function(){ return document.createElement('div'); };

  function renderHeroCard(node, container){
    container = adoptTemplate(container,'hero_card','hero_card-form-slot');
    container.appendChild(inputRow({label:'Título', id:'hero_title', value: node.title || ''}));
    container.appendChild(inputRow({label:'Subtítulo', id:'hero_sub', value: node.subtitle || ''}));
    container.appendChild(inputRow({label:'Texto', id:'hero_text', value: node.text || '', type:'textarea'}));
    container.appendChild(inputRow({label:'Image URL', id:'hero_img', value: node.image_url || ''}));
    container.appendChild(jsonEditor({label:'Buttons (JSON array)', id:'hero_buttons', value: node.buttons || []}));
    const validator = setupValidation(container, {
      boxId:'hero_validation_box',
      okMessage:'✔ Hero correcto',
      collectState(){ return { title:(container.querySelector('#hero_title input,#hero_title textarea,#hero_title')?.value||'').trim(), img:(container.querySelector('#hero_img input,#hero_img')?.value||'').trim() }; },
      buildRules(st){ return [
        {kind:'error', when: !st.title, msg:'Título requerido.'},
        {kind:'warning', when: st.img && !/^https?:/i.test(st.img), msg:'La URL de imagen no parece válida (esperado http/https).'}
      ]; }
    });
    const result = validator.run();
    markFieldUsed(container.querySelector('.hero_card-form-slot'));
    document.dispatchEvent(new CustomEvent('renderer:after', { detail: { type:'hero_card', container, validation: result }}));
  }

  window.RendererRegistry = window.RendererRegistry || {};
  window.RendererRegistry.hero_card = renderHeroCard;
})();
