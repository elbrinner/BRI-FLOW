(function() {
  'use strict';

  // Función para procesar nodos 'hidden_response'
  window.Simulador.nodes.processHiddenResponse = function(node, state, flow, appendChatMessage, showTyping, gotoNext, log, evaluate, maybeAppendDiff, renderPreview, renderVariables, step, stepDelay, fastMode, running, stepTimeout) {
    // Evaluar dataInfo si existe, sin mostrar nada
    if (node.dataInfo || node.data_info) {
      const dataInfoExpr = node.dataInfo || node.data_info;
      try {
        const dataInfo = evaluate(dataInfoExpr);
        if (dataInfo !== undefined) {
          state.variables.dataInfo = dataInfo;
          log(`HIDDEN_RESPONSE: dataInfo evaluado y guardado`);
        }
      } catch (e) {
        log(`HIDDEN_RESPONSE: error evaluando dataInfo: ${e.message}`);
      }
    }

    // Avanzar al siguiente
    state.current = gotoNext(node.next);
  };

})();