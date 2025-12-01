(function() {
  'use strict';

  // Función para procesar nodos 'input'
  window.Simulador.nodes.processInput = function(node, state, flow, nodeId, log, gotoNext, renderPreview, renderVariables, step, stepDelay, fastMode, running, stepTimeout, getI18nPrompt, registerInteractionPause, buildInteractionSnapshot, __clearEphemerals, $) {
    // pause and show input box
    const promptText = getI18nPrompt(node, '');
    log(`INPUT (${nodeId}): ${promptText}`);
    pauseForInput(nodeId, node);
    // Registrar pausa de interacción para input
    try{ registerInteractionPause(buildInteractionSnapshot(nodeId, node, 'input')); }catch(_e){}
    __clearEphemerals();
    return;

    function pauseForInput(nodeId, node){
      const panel = $('simulatorCanvasPreview'); if(!panel) return;
      panel.innerHTML = '';
      const prompt = document.createElement('div'); prompt.className = 'font-semibold'; prompt.textContent = getI18nPrompt(node, 'Introduce un valor'); panel.appendChild(prompt);
      const input = document.createElement('input'); input.type = 'text'; input.className = 'border rounded p-1 mt-2'; input.style.width = '100%'; panel.appendChild(input);
      const btn = document.createElement('button'); btn.textContent = 'Enviar'; btn.className = 'px-3 py-1 bg-sky-600 text-white rounded mt-2'; btn.addEventListener('click', () => {
        const v = input.value; const saveAs = node.save_as || node.saveAs || node.variable || node.targetVar || null;
        if (saveAs) state.variables[saveAs] = v; log(`INPUT respuesta guardada: ${saveAs} = ${v}`); state.history.push({ node: nodeId, type: 'input', value: v }); state.current = gotoNext(node.next); renderPreview(); renderVariables(); if (running) stepTimeout = setTimeout(step, 200);
      });
      panel.appendChild(btn);
    }
  };

})();