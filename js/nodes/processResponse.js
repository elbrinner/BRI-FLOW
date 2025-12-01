(function() {
  'use strict';

  console.log('[processResponse.js] Loading processResponse module');

  // Función para procesar nodos 'response'
  // lastArg (optional): done callback to continue presenting next nodes
  window.Simulador.nodes.processResponse = function(node, state, flow, appendChatMessage, showTyping, gotoNext, log, evaluate, maybeAppendDiff, renderPreview, renderVariables, step, stepDelay, fastMode, running, stepTimeout, done) {
    // Extraer texto teniendo en cuenta i18n y campos legacy (node.text / node.prompt)
    function extractI18nText(n){
      try{
        if(!n) return '';
        // intentar usar locale expuesto o helper global si existe
        var locale = 'es';
        if(window.Simulador && window.Simulador.selected_locale) locale = window.Simulador.selected_locale;
        if(typeof getLocale === 'function') locale = getLocale() || locale;
        if(n.i18n && locale && n.i18n[locale] && Array.isArray(n.i18n[locale].text)) return n.i18n[locale].text.join('\n');
        const fallbacks = ['es','en','pt'];
        for(const fb of fallbacks){ if(n.i18n && n.i18n[fb] && Array.isArray(n.i18n[fb].text)) return n.i18n[fb].text.join('\n'); }
        if(typeof n.text === 'string' && n.text.trim().length) return n.text;
        if(typeof n.prompt === 'string' && n.prompt.trim().length) return n.prompt;
        return '';
      }catch(_e){ return n && n.text ? n.text : ''; }
    }

    const rawText = extractI18nText(node);
    // Intentar procesar el texto via evaluator
    let text = '';
    try{
      if (window.Simulador && window.Simulador.evaluator && typeof window.Simulador.evaluator.processText === 'function'){
        text = window.Simulador.evaluator.processText(rawText, window.Simulador.evaluator.looksLikeMarkdown(rawText) || !!node.render_markdown || !!node.renderMarkdown);
      } else {
        text = rawText;
      }
    }catch(e){
      console.warn('[processResponse.js] evaluator.processText failed:', e);
      text = rawText;
    }

    console.log('[processResponse.js] nodeId:', node && (node.node_id || node.id), 'rawText:', String(rawText).substring(0,200));
    console.log('[processResponse.js] processed text (length):', (typeof text === 'string' ? text.length : typeof text));
    // If evaluator returned an empty string despite rawText existing, show a visible fallback to help debugging
    if (typeof text === 'string' && text.trim().length === 0 && String(rawText).trim().length > 0){
      console.warn('[processResponse.js] Warning: processed text is empty though rawText is present. Falling back to visible placeholder.');
      text = '(sin texto después de evaluar)';
    }

    // Mostrar typing si no es rápido
    function afterHandled(){
      // Si el nodo avanzó automáticamente (sin opciones), invocar la callback para continuar la presentación
      try{
        if (typeof done === 'function') {
          // Dejar un tick para que DOM se actualice y el usuario vea el mensaje
          setTimeout(()=>{ try{ done(); }catch(_e){} }, fastMode ? 0 : 50);
        }
      }catch(_e){}
    }

    if (!fastMode) {
      showTyping(() => {
        appendChatMessage('bot', text);
        // Manejar opciones/botones si existen
        handleOptions(node, state, flow, appendChatMessage, gotoNext, log, evaluate, maybeAppendDiff, renderPreview, renderVariables, step, stepDelay, fastMode, running, stepTimeout);
        // If options exist, handleOptions will append them and return early; otherwise it advanced state.current
        afterHandled();
      });
    } else {
      appendChatMessage('bot', text);
      handleOptions(node, state, flow, appendChatMessage, gotoNext, log, evaluate, maybeAppendDiff, renderPreview, renderVariables, step, stepDelay, fastMode, running, stepTimeout);
      afterHandled();
    }

    function handleOptions(node, state, flow, appendChatMessage, gotoNext, log, evaluate, maybeAppendDiff, renderPreview, renderVariables, step, stepDelay, fastMode, running, stepTimeout) {
      const options = [];
      if (Array.isArray(node.options)) options.push(...node.options);
      if (Array.isArray(node.choices)) options.push(...node.choices);
      if (Array.isArray(node.buttons)) options.push(...node.buttons.map(b => ({ label: b.label || b.text, target: b.next || b.target, value: b.value })));
      if (Array.isArray(node.quick_replies)) options.push(...node.quick_replies);

      if (options.length > 0) {
        const container = document.createElement('div');
        container.className = 'flex flex-col gap-2 mt-2';
        options.forEach((opt, i) => {
          const label = window.Simulador.evaluator.interpolate(opt.label || opt.text || `Opción ${i+1}`);
          const btn = document.createElement('button');
          btn.className = 'px-3 py-1 bg-white border rounded text-sm';
          btn.textContent = label;
          btn.addEventListener('click', () => {
            log(`RESPONSE option selected: ${label}`);
            const __prevVars = window.Simulador.core.deepClone(state.variables || {});
            const val = opt.value !== undefined ? opt.value : label;
            const saveKey = node.save_as || node.saveAs || `selected_choice_${state.current}`;
            state.variables[saveKey] = val;
            state.variables.selected_choice = val; // compat
            try {
              state.selections = state.selections || { button:{}, choice:{} };
              state.selections.choice[state.current] = {
                label,
                value: val,
                index: i,
                target: opt.target || opt.next || null,
                saved_as: saveKey,
                at: new Date().toISOString()
              };
            } catch(_e) {}
            try { appendChatMessage('bot', window.Simulador.nodes.createSavedChip(saveKey, val)); } catch(_e) {}
            maybeAppendDiff(__prevVars);
            state.current = gotoNext(opt.target || opt.next || node.next);
            renderPreview();
            renderVariables();
            if (running) stepTimeout = setTimeout(() => step(), fastMode ? 0 : stepDelay);
          });
          container.appendChild(btn);
        });
        appendChatMessage('bot', container);
        return; // No avanzar automáticamente
      }

      // Avance automático si no hay opciones
      state.current = gotoNext(node.next);
    }
  };

  console.log('[processResponse.js] processResponse function defined:', typeof window.Simulador.nodes.processResponse);

})();