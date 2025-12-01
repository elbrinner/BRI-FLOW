(function() {
  'use strict';

  // Función para procesar nodos 'button'
  window.Simulador.nodes.processButton = function(node, state, flow, nodeId, log, gotoNext, registerInteractionPause, __clearEphemerals, appendChatMessage, renderPreview, renderVariables, step, stepDelay, fastMode, running, stepTimeout) {
    const panel = $('simulatorCanvasPreview'); if(!panel) return;
    // clear preview and show button options
    panel.innerHTML = '';
    const title = document.createElement('div'); title.className = 'font-semibold';
    const promptText = getI18nPrompt(node, 'Selecciona una opción');
    title.textContent = promptText; panel.appendChild(title);
    
    let buttons = [];
    const mode = node.mode || 'static';
    
    if (mode === 'dynamic') {
      try {
        const provider = node.provider || {};
        const srcExpr = node.src || node.source_list || provider.source_list || '';
        const sourceList = window.Simulador.core.evaluate(srcExpr);
        if (Array.isArray(sourceList)) {
          const labelExpr = node.labelExpr || node.label_expr || provider.label_expr || 'item.label || item.name || item';
          const valueExpr = node.valueExpr || node.value_expr || provider.value_expr || 'item';
          const evalInScope = (expr, item, index) => {
            try {
              if (window.ExpressionParser && typeof window.ExpressionParser.evaluate === 'function'){
                const mergedVars = Object.assign({}, (state && state.variables) ? state.variables : {}, { item, index });
                try{
                  const epRes = window.ExpressionParser.evaluate(expr, { variables: mergedVars });
                  console.debug('[Simulador][evalInScope] ExpressionParser:', { expr, epRes });
                  if (epRes === undefined || (typeof epRes === 'string' && (String(epRes).trim() === String(expr).trim() || String(epRes).includes('item')))){
                    console.debug('[Simulador][evalInScope] ExpressionParser did not resolve (undefined or contains "item"), falling back to local eval for expr=', expr);
                    throw new Error('ExpressionParser did not resolve');
                  }
                  return epRes;
                }catch(_e){ /* fallthrough to local eval */ }
              }
            } catch(_e) { /* fallback abajo */ }
            try {
              const simpleRE = /^\s*(?:item(?:\.[A-Za-z_$][\w$]*)*|index)\s*$/;
              if (typeof expr === 'string' && simpleRE.test(expr)){
                const t = expr.trim();
                if (t === 'index') return index;
                let cur = item; const parts = t.split('.').slice(1);
                for (const p of parts){ if (cur == null) return null; cur = cur[p]; }
                return cur;
              }
            } catch(_e2) { /* ignorar */ }
            try {
              if (typeof expr === 'string'){
                const m = expr.trim().match(/^item(?:\.(.+))?$/);
                if (m){
                  if(!m[1]) return item;
                  const parts = m[1].split('.'); let cur = item; for(const p of parts){ if(cur==null){ cur=null; break; } cur = cur[p]; } return cur;
                }
              }
            } catch(_e3){}
            return window.Simulador.core.evaluate(expr);
          };
          buttons = sourceList.map((item, i) => {
            try {
              const labelRaw = evalInScope(labelExpr, item, i);
              const value = evalInScope(valueExpr, item, i);
              const finalLabel = tryResolveLabelFromJsonOrRaw(labelRaw, getLocale()) || labelRaw;
              return { label: String(finalLabel), value: value, index: i };
            } catch (e) {
              log(`Error evaluating button ${i}: ${e.message}`);
              return { label: `Opción ${i+1}`, value: item, index: i };
            }
          });
        } else {
          log('BUTTON dynamic mode: source_list no es un array');
          buttons = [{ label: 'Error: source_list no válido', value: null }];
        }
      } catch (e) {
        log(`BUTTON dynamic error: ${e.message}`);
        buttons = [{ label: 'Error evaluando lista dinámica', value: null }];
      }
    } else {
      buttons = (node.options || []).map((opt, i) => ({
        label: getOptionLabel(opt) || `Botón ${i+1}`,
        value: opt.value !== undefined ? opt.value : opt,
        index: i,
        target: (opt.target && (opt.target.node_id || opt.target)) || (opt.next && (opt.next.node_id || opt.next)) || null
      }));
    }
    
    const btns = document.createElement('div'); 
    btns.style.display = 'flex'; 
    btns.style.flexDirection = 'column'; 
    btns.style.gap = '8px'; 
    btns.style.marginTop = '8px';
    
    buttons.forEach((btn, i) => {
      const b = document.createElement('button'); 
      b.className = getVariantClass(btn.variant || 'secondary');
      b.textContent = btn.label;
      b.addEventListener('click', () => {
        log(`BUTTON selected: ${btn.label}`);
        const target = btn.target || node.next || null;
        state.history.push({ node: nodeId, type: 'button', selected: btn.label, value: btn.value, index: i, target });
        const saveKey = getButtonSaveKey(nodeId, node);
        const val = (btn.value !== undefined) ? btn.value : btn.label;
        state.variables[saveKey] = val;
        state.variables.selected_button = val;
        const resolvedTarget = (typeof target === 'object') ? (target?.node_id || null) : target;
        const saveKeyTarget = (node && (node.save_as || node.saveAs)) ? String(node.save_as || node.saveAs).trim() + '_target' : `selected_button_target_${nodeId}`;
        if(resolvedTarget) state.variables[saveKeyTarget] = resolvedTarget;
        try { state.selections = state.selections || { button:{}, choice:{} }; state.selections.button[nodeId] = { label: btn.label, value: val, index: i, target: resolvedTarget, saved_as: saveKey, saved_target_as: saveKeyTarget, at: new Date().toISOString() }; } catch(_e) {}
        try{ appendChatMessage('bot', window.Simulador.nodes.createSavedChip(saveKey, val)); if(resolvedTarget) appendChatMessage('bot', window.Simulador.nodes.createSavedChip(saveKeyTarget, resolvedTarget)); }catch(_e){}
        state.current = gotoNext(target);
        renderPreview(); renderVariables();
        if (running) stepTimeout = setTimeout(step, 200);
      });
      btns.appendChild(b);
    });
    
    panel.appendChild(btns);
    registerInteractionPause();
    __clearEphemerals();
    return;
  };

})();