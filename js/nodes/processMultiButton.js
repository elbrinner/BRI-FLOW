(function() {
  'use strict';

  // Función para procesar nodos 'multi_button'
  window.Simulador.nodes.processMultiButton = function(node, state, flow, nodeId, log, gotoNext, registerInteractionPause, __clearEphemerals, appendChatMessage, renderPreview, renderVariables, step, stepDelay, fastMode, running, stepTimeout) {
    const panel = $('simulatorCanvasPreview'); if(!panel) return;
    panel.innerHTML = '';
    const title = document.createElement('div'); title.className = 'font-semibold'; title.textContent = getI18nPrompt(node, 'Selecciona una o varias opciones'); panel.appendChild(title);

    // Construir opciones: dinámicas (provider.source_list) o estáticas (options)
    let items = [];
    const provider = node.provider || {};
    const srcExpr = node.src || node.source_list || provider.source_list || null;
    const labelExpr = node.labelExpr || node.label_expr || provider.label_expr || 'item.label || item.name || item';
    const valueExpr = node.valueExpr || node.value_expr || provider.value_expr || 'item.value || item.name || item';

    const evalInScope = (expr, item, index) => {
      try {
        if (window.ExpressionParser && typeof window.ExpressionParser.evaluate === 'function'){
          const mergedVars = Object.assign({}, (state && state.variables) ? state.variables : {}, { item, index });
          const epRes = window.ExpressionParser.evaluate(expr, { variables: mergedVars });
          if (epRes !== undefined && !(typeof epRes === 'string' && String(epRes).includes('item'))) return epRes;
        }
      } catch(_e) {}
      try {
        const simpleRE = /^\s*(?:item(?:\.[A-Za-z_$][\w$]*)*|index)\s*$/;
        if (typeof expr === 'string' && simpleRE.test(expr)){
          const t = expr.trim();
          if (t === 'index') return index;
          let cur = item; const parts = t.split('.').slice(1);
          for(const p of parts){ if(cur == null) return null; cur = cur[p]; }
          return cur;
        }
      } catch(_e2) {}
      return window.Simulador.core.evaluate(expr);
    };

    if (srcExpr){
      try{
        const sourceList = window.Simulador.core.evaluate(srcExpr);
        if (Array.isArray(sourceList)){
          let filtered = sourceList;
          const filterExpr = node.filterExpr || node.filter_expr || provider.filter_expr || null;
          if (filterExpr){
            filtered = filtered.filter((it, idx)=>{
              try{ const r = evalInScope(filterExpr, it, idx); return !!r; }catch(_e){ return true; }
            });
          }
          const sortExpr = node.sortExpr || node.sort_expr || provider.sort_expr || null;
          if (sortExpr){
            filtered = filtered.slice().sort((a,b)=>{
              const ka = evalInScope(sortExpr, a, 0) ?? '';
              const kb = evalInScope(sortExpr, b, 0) ?? '';
              return String(ka).localeCompare(String(kb));
            });
          }
          items = filtered.map((it, i)=>{
            let lblRaw = evalInScope(labelExpr, it, i); if(lblRaw === undefined || lblRaw === null) lblRaw = `Opción ${i+1}`;
            const lbl = tryResolveLabelFromJsonOrRaw(lblRaw, getLocale()) || lblRaw;
            const val = evalInScope(valueExpr, it, i);
            return { label: String(lbl), value: (val !== undefined && val !== null) ? val : String(lbl) };
          });
        }
      }catch(e){ /* si falla, cae a estáticas */ }
    }
    if (!Array.isArray(items) || items.length === 0){
      items = (Array.isArray(node.options) ? node.options : []).map((o,i)=>{
        const lbl = getOptionLabel(o) || `Opción ${i+1}`;
        return {
          label: lbl,
          value: (o && (o.value !== undefined)) ? o.value : lbl
        };
      });
    }

    // Preselección desde variable save_as si existe
    const saveKey = (node && (node.save_as || node.saveAs)) ? (node.save_as || node.saveAs) : `selected_buttons_${nodeId}`;
    const preselected = new Set(Array.isArray(state.variables?.[saveKey]) ? state.variables[saveKey].map(v=>String(v)) : []);

    const list = document.createElement('div'); list.className = 'flex flex-col gap-2 mt-2';
    const selected = new Set();
    items.forEach((it, idx)=>{
      const row = document.createElement('label'); row.className = 'flex items-center gap-2';
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.className = 'mr-2';
      cb.checked = preselected.has(String(it.value));
      if (cb.checked) selected.add(String(it.value));
      cb.addEventListener('change', ()=>{
        const v = String(it.value);
        if (cb.checked) selected.add(v); else selected.delete(v);
        updateStatus();
      });
      const span = document.createElement('span'); span.textContent = String(it.label);
      row.appendChild(cb); row.appendChild(span); list.appendChild(row);
    });

    const info = document.createElement('div'); info.className = 'text-xs text-gray-600 mt-2';
    // Validación min/max
    const minSel = (typeof node.min_selected === 'number') ? node.min_selected : (typeof node.minSelected === 'number' ? node.minSelected : null);
    const maxSel = (typeof node.max_selected === 'number') ? node.max_selected : (typeof node.maxSelected === 'number' ? node.maxSelected : null);

    const actions = document.createElement('div'); actions.className = 'mt-3 flex gap-2 items-center';
    const btnContinue = document.createElement('button'); btnContinue.textContent = 'Continuar'; btnContinue.className = 'px-3 py-1 bg-sky-600 text-white rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed';

    function updateStatus(){
      const count = selected.size;
      let msg = `${count} seleccionada${count===1?'':'s'}`;
      let valid = true;
      if (minSel != null && count < minSel){ msg += ` — mínimo ${minSel}`; valid = false; }
      if (maxSel != null && count > maxSel){ msg += ` — máximo ${maxSel}`; valid = false; }
      info.textContent = msg;
      btnContinue.disabled = !valid;
    }

    btnContinue.addEventListener('click', ()=>{
      let arr = Array.from(selected.values());
      // Si el nodo es opcional y no hay selección, usar default_values si existen
      const isOptional = !!(node.optional === true);
      const defaults = Array.isArray(node.default_values) ? node.default_values : (Array.isArray(node.defaultValues) ? node.defaultValues : null);
      if (arr.length === 0 && isOptional && defaults && defaults.length){
        arr = defaults.map(x=>String(x));
      }
      // Validación final min/max
      if (minSel != null && arr.length < minSel){
        info.textContent = `Selecciona al menos ${minSel}`;
        btnContinue.disabled = true;
        return;
      }
      if (maxSel != null && arr.length > maxSel){
        info.textContent = `Selecciona como máximo ${maxSel}`;
        btnContinue.disabled = true;
        return;
      }

      state.variables[saveKey] = arr;
      appendChatMessage('bot', window.Simulador.nodes.createSavedChip(saveKey, JSON.stringify(arr)));
      state.history.push({ node: nodeId, type: 'multi_button', selected: arr });
      state.current = gotoNext(node.next);
      renderPreview(); renderVariables(); if(running) stepTimeout = setTimeout(step, 200);
    });
    actions.appendChild(btnContinue);
    panel.appendChild(list);
    panel.appendChild(info);
    panel.appendChild(actions);
    updateStatus();
    registerInteractionPause();
    __clearEphemerals();
    return;
  };

})();