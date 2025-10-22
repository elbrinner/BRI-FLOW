// Renderer for debug node (editor)
(function(){
  function renderDebug(node, container, nodeIds){
    const el = document.createElement('div');
    el.className = 'debug-node-editor';
    const msg = document.createElement('label'); msg.textContent = 'Message (template)';
    const ta = document.createElement('textarea'); ta.value = node && node.message ? node.message : '';
    ta.style.width = '100%'; ta.style.height = '60px';
    const payloadLabel = document.createElement('label'); payloadLabel.textContent = 'Payload (JSON or text)';
    const payload = document.createElement('textarea'); payload.style.width = '100%'; payload.style.height = '80px'; payload.value = node && node.payload ? (typeof node.payload === 'string' ? node.payload : JSON.stringify(node.payload, null, 2)) : '';
    const saveAsLabel = document.createElement('label'); saveAsLabel.textContent = 'Save as (variable)';
    const saveAs = document.createElement('input'); saveAs.type = 'text'; saveAs.value = node && node.save_as ? node.save_as : '';
    el.appendChild(msg); el.appendChild(ta); el.appendChild(payloadLabel); el.appendChild(payload); el.appendChild(saveAsLabel); el.appendChild(saveAs);
    // Expose getters for formbuilder
    el.readValues = function(){ return { message: ta.value, payload: payload.value, save_as: saveAs.value }; };
    el.getValue = function(){ return { message: ta.value, payload: payload.value, save_as: saveAs.value }; };

    // Preview button: evaluate message against simulator variables if available
    const previewBtn = document.createElement('button'); previewBtn.textContent = 'Preview'; previewBtn.className = 'px-2 py-1 bg-sky-600 text-white rounded ml-2';
    previewBtn.addEventListener('click', () => {
      try{
        const msg = ta.value || '';
        let evaluated = msg;
        if (window.Simulador && typeof window.Simulador.getRuntimeState === 'function'){
          const st = window.Simulador.getRuntimeState();
          const vars = st?.state?.variables ?? {};
          // simple interpolation of {{var}} using vars
          evaluated = String(msg).replace(/\{\{\s*([^}]+)\s*\}\}/g, (_,k) => {
            const key = k.trim().replace(/\s*\.\s*/g,'.');
            const parts = key.split('.').filter(Boolean);
            let v = vars;
            for(const p of parts){ if (v == null) { v = undefined; break; } v = v[p]; }
            if (v === undefined || v === null) return '';
            if (typeof v === 'object') return JSON.stringify(v);
            return String(v);
          });
        }
        // show preview in a small modal-like alert
        const md = document.createElement('div'); md.className='preview-box'; md.style.padding='8px'; md.style.background='#fff'; md.style.border='1px solid #e5e7eb'; md.style.borderRadius='6px'; md.style.maxWidth='540px'; md.style.whiteSpace='pre-wrap'; md.textContent = evaluated;
        // append temporarily to document body
        document.body.appendChild(md);
        setTimeout(()=>{ md.remove(); }, 2500);
      }catch(e){ console.warn('Preview failed', e); }
    });
    el.appendChild(previewBtn);
    container.appendChild(el);
    return el;
  }
  window.RendererRegistry = window.RendererRegistry || {};
  window.RendererRegistry.debug = renderDebug;
})();
