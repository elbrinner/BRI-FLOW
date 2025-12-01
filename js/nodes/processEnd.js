(function() {
  'use strict';

  // Función para procesar nodos 'end'
  window.Simulador.nodes.processEnd = function(node, state, flow, appendChatMessage, showTyping, gotoNext, log, evaluate, maybeAppendDiff, renderPreview, renderVariables, step, stepDelay, fastMode, running, stepTimeout) {
    // Si hay callstack, pop y saltar a returnNext; si no, fin
    if (state.callstack && state.callstack.length) {
      const frame = state.callstack.pop();
      const ret = frame?.returnNext || null;
      log('END reached (returning to caller)');
      state.current = gotoNext(ret);
    } else {
      log('END reached.');
      state.current = null;
      running = false;
    }
  };

})();