(function(){
  // simulador-ui.js
  // Esqueleto de renderizado: funciones para mostrar mensajes, renderizar formularios y controles interactivos.
  if(typeof window === 'undefined') return;
  window.Simulador = window.Simulador || {};
  window.Simulador.ui = (function(){
    function renderMessage(msg, opts){
      // opts: { hidden:false }
      console.log('[SimUI] message', msg, opts);
    }
    function renderForm(formSpec, onSubmit){
      // onSubmit(values)
      console.log('[SimUI] renderForm', formSpec);
    }
    return { renderMessage, renderForm };
  })();
})();
