// carousel.js - renderer carousel
(function(){
  const { adoptTemplate, setupValidation, markFieldUsed } = window.RendererHelpers || {};
  const H = window.FormBuilderHelpers || {};
  const jsonEditor = H.jsonEditor || function(){ return document.createElement('div'); };

  function renderCarousel(node, container){
    container = adoptTemplate(container,'carousel','carousel-form-slot');
    container.appendChild(jsonEditor({label:'Cards (array JSON)', id:'carousel_cards', value: node.cards || []}));
    const validator = setupValidation(container, {
      boxId:'carousel_validation_box',
      okMessage:'✔ Carousel listo',
      collectState(){ return { count: Array.isArray(node.cards)?node.cards.length:0 }; },
      buildRules(st){ return [ {kind:'warning', when: st.count===0, msg:'Sin cards definidas.'} ]; }
    });
    const result = validator.run();
    markFieldUsed(container.querySelector('.carousel-form-slot'));
    document.dispatchEvent(new CustomEvent('renderer:after', { detail: { type:'carousel', container, validation: result }}));
  }

  window.RendererRegistry = window.RendererRegistry || {};
  window.RendererRegistry.carousel = renderCarousel;
})();
