// multi_button.js - renderer simple que reutiliza el de button por ahora
(function(){
  if (!window.RendererRegistry || !window.RendererRegistry.button) return;
  window.RendererRegistry.multi_button = function(node, container, nodeIds){
    // Reusar el formulario del botón; las propiedades comunes se serializan igual (provider/options/prompt)
    return window.RendererRegistry.button(node, container, nodeIds);
  };
})();
