(function() {
  'use strict';

  // Función para procesar nodos 'choice'
  window.Simulador.nodes.processChoice = function(node, state, flow, nodeId, log, gotoNext, renderPreview, renderVariables, step, stepDelay, fastMode, running, stepTimeout, getI18nPrompt, registerInteractionPause, buildInteractionSnapshot, __clearEphemerals, $, evaluate) {
    const mode = node.mode || 'prompt';
    if (mode === 'switch') {
      // Evaluar casos y saltar automáticamente
      const list = Array.isArray(node.cases) ? node.cases : [];
      let jumped = false;
      for (const c of list) {
        const when = c && c.when ? String(c.when) : '';
        try {
          const res = evaluate(when);
          if (res) { state.current = gotoNext(c?.target); jumped = true; break; }
        } catch(_e) {}
      }
      if (!jumped) {
        const def = node.default_target || null;
        if (def) state.current = gotoNext(def);
        else state.current = gotoNext(node.next);
      }
      return; // Continuar automáticamente
    }
    // prompt: render options as buttons and wait for user selection
    const choices = node.options || [];
    renderChoice(nodeId, node, choices);
    // Registrar pausa de interacción para choice
    try{ registerInteractionPause(buildInteractionSnapshot(nodeId, node, 'choice')); }catch(_e){}
    __clearEphemerals();
    return;

    function renderChoice(nodeId, node, choices){
      const panel = $('simulatorCanvasPreview'); if(!panel) return;
      // clear preview and show choice buttons
      panel.innerHTML = '';
      const title = document.createElement('div'); title.className = 'font-semibold'; title.textContent = getI18nPrompt(node, 'Elige una opción'); panel.appendChild(title);
      const btns = document.createElement('div'); btns.style.display = 'flex'; btns.style.flexDirection = 'column'; btns.style.gap = '8px'; btns.style.marginTop = '8px';
      (choices || []).forEach((opt, i) => {
        const b = document.createElement('button'); b.className = 'px-3 py-1 bg-white border rounded text-sm'; b.textContent = opt.label || opt.text || (`Opción ${i+1}`);
        b.addEventListener('click', () => {
          const target = opt.target || opt.next || null;
          log(`CHOICE selected: ${b.textContent} -> ${target}`);
          state.history.push({ node: nodeId, type: 'choice', selected: b.textContent, target, index: i });
          // Guardar selección por nodo (save_as o fallback)
          const val = opt.value !== undefined ? opt.value : (opt.label || opt.text || b.textContent);
          const saveKey = (node && (node.save_as || node.saveAs)) ? (node.save_as || node.saveAs) : `selected_choice_${nodeId}`;
          state.variables[saveKey] = val;
          // compat global
          state.variables.selected_choice = val;
          // registrar en selections
          try { state.selections = state.selections || { button:{}, choice:{} }; state.selections.choice[nodeId] = { label: b.textContent, value: val, index: i, target, saved_as: saveKey, at: new Date().toISOString() }; } catch(_e) {}
          // Chip informativo en chat
          try{ appendChatMessage('bot', window.Simulador.nodes.createSavedChip(saveKey, val)); }catch(_e){}
          state.current = gotoNext(target);
          // restore preview
          renderPreview(); renderVariables();
          if (running) stepTimeout = setTimeout(step, 200);
        });
        btns.appendChild(b);
      });
      panel.appendChild(btns);
    }
  };

})();