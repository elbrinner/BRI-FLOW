// end.js - renderer del nodo end (solo comentarios)
(function(){
  // No agrega campos propios; solo se mostrará el textarea de descripción que agrega FormRenderers.
  function renderEnd(node, container){
    // Intencionalmente vacío: el nodo end no tiene propiedades configurables, solo comentarios.
    // Si en el futuro se desea mostrar una nota informativa, podría inyectarse aquí.
    document.dispatchEvent(new CustomEvent('renderer:after', { detail: { type:'end', container } }));
  }
  globalThis.RendererRegistry = globalThis.RendererRegistry || {};
  globalThis.RendererRegistry.end = renderEnd;
})();
