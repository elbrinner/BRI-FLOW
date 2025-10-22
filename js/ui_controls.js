// js/ui_controls.js
// Encapsula el wiring de los controles UI (botones, import/export, zoom, palette draggables)
(function(){
  function setupUI(state, helpers = {}) {
    const canvas = helpers.canvas || document.getElementById('canvas');
    const canvasInner = helpers.canvasInner || document.getElementById('canvasInner');
    const exportJson = helpers.exportJson || (() => { if (window.App && window.App.exportJson) window.App.exportJson(); });
    const importJson = helpers.importJson || ((obj) => { if (window.App && window.App.importJson) window.App.importJson(obj); });
    const createNode = helpers.createNode || ((t,x,y)=>{ if (window.App && window.App.createNode) return window.App.createNode(t,x,y); });
    const selectNode = helpers.selectNode || ((id)=>{ if (window.App && window.App.selectNode) return window.App.selectNode(id); });
    const refreshOutput = helpers.refreshOutput || (() => { if (window.App && window.App.refreshOutput) return window.App.refreshOutput(); });
    const setZoom = helpers.setZoom || ((z)=>{ if (window.App && window.App.setZoom) return window.App.setZoom(z); });
    const saveUiState = helpers.saveUiState || (()=>{ if (window.App && window.App.saveUiState) return window.App.saveUiState(); });
    const loadExample = helpers.loadExample || (() => { if (window.App && window.App.loadExample) return window.App.loadExample(); });

    // guard: elementos esenciales
    const btnExport = document.getElementById('btnExport');
    const btnClear = document.getElementById('btnClear');
    const btnLoadExample = document.getElementById('btnLoadExample');
    const importFile = document.getElementById('importFile');
  const zoomIn = document.getElementById('zoomIn');
    const zoomOut = document.getElementById('zoomOut');
    const zoomReset = document.getElementById('zoomReset');
    const togglePaletteBtn = document.getElementById('togglePaletteBtn');
    const togglePropertiesBtn = document.getElementById('togglePropertiesBtn');
  const btnShowJson = document.getElementById('btnShowJson');

    if(btnExport) btnExport.addEventListener('click', () => exportJson());
    if(btnClear) btnClear.addEventListener('click', ()=>{
      if(!confirm('Limpiar canvas?')) return;
      state.nodes = {};
      if (canvasInner) canvasInner.innerHTML = '';
      if (typeof jsPlumb !== 'undefined' && jsPlumb.deleteEveryConnection) jsPlumb.deleteEveryConnection();
      const propsPanel = document.getElementById('properties'); if(propsPanel) { propsPanel.classList.remove('force-visible'); propsPanel.classList.remove('overlay-visible'); }
      refreshOutput();
    });
    if(btnLoadExample) btnLoadExample.addEventListener('click', loadExample);
    async function handleMultiImport(fileList, resetInputCb){
      try {
        const files = Array.from(fileList || []);
        if (!files.length) return;
        // Helpers
        const parseFile = (file) => new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            try { resolve({ file, json: JSON.parse(e.target.result) }); }
            catch(err){ console.warn('Import parse failed', file.name, err); resolve({ file, error: err }); }
          };
          reader.onerror = (e) => { resolve({ file, error: new Error('read error') }); };
          reader.readAsText(file);
        });
        // Cargar todos en paralelo
        const results = await Promise.all(files.map(parseFile));
        let importedCount = 0; let opened = false; let firstOpenedId = null;
        const proj = (window.AppProject || (window.AppProject = { flows:{}, main_flow_id:null, active_flow_id:null }));
        const versionOf = (metaOrObj) => {
          const v = metaOrObj?.meta?.version || metaOrObj?.version || '';
          return (typeof v === 'string' || typeof v === 'number') ? String(v) : '';
        };
        const norm = (obj) => ({ meta: {
            flow_id: obj.flow_id || obj.meta?.flow_id || '',
            name: obj.name || obj.meta?.name || (obj.flow_id || ''),
            version: obj.version || obj.meta?.version || '0.1.0',
            description: obj.description || obj.meta?.description || '',
            locales: obj.locales || obj.meta?.locales || ['es'],
            start_node: obj.start_node || obj.meta?.start_node || ''
          }, nodes: obj.nodes || {} });
        for (const item of results) {
          if (item.error || !item.json) { console.warn('Saltando archivo inválido', item.file?.name); continue; }
          const obj = item.json;
          const fid = obj.flow_id || obj.meta?.flow_id;
          if (!fid || !obj.nodes) { console.warn('JSON sin flow_id o nodes', item.file?.name); continue; }
          // ¿Existe ya en proyecto?
          const activeFid = window.App?.state?.meta?.flow_id || window.App?.state?.flow_id || proj.active_flow_id || '';
          const existsInProject = !!proj.flows[fid];
          const isActiveSame = activeFid === fid;
          const exists = existsInProject || isActiveSame;
          let doImport = true;
          if (exists) {
            // Preferir versión del flujo abierto si coincide con fid; si no, usar la del proyecto
            const cur = isActiveSame ? (window.App?.state || proj.flows[fid]) : proj.flows[fid];
            const vCur = versionOf(cur);
            const vNew = versionOf(obj);
            // Preguntar confirmación mostrando versiones; enfatizar si es el flujo abierto
            const where = isActiveSame ? ' (abierto actualmente)' : ' (en proyecto)';
            const msg = `El flujo "${fid}" ya existe${where}.\nVersión actual: ${vCur || '(sin)'}\nVersión del archivo: ${vNew || '(sin)'}\n\n¿Deseas sustituirlo por el del archivo?`;
            doImport = confirm(msg);
          }
          if (!doImport) continue;
          // Insertar/actualizar en AppProject
          const flowLike = norm(obj);
          proj.flows[fid] = flowLike;
          importedCount++;
          // Si no hay principal aún y el import lo indica, fijarlo
          if (!proj.main_flow_id && (obj.meta?.is_main || obj.is_main)) {
            proj.main_flow_id = fid;
          }
          // Si el flujo importado es el activo y lo hemos sustituido, refrescar el canvas con el nuevo contenido
          if (isActiveSame) {
            try {
              if (typeof window.App?.importJson === 'function') {
                window.App.importJson({ flow_id: fid, meta: flowLike.meta, nodes: flowLike.nodes });
                proj.active_flow_id = fid;
                if (!opened) { opened = true; firstOpenedId = fid; }
              }
            } catch(e) { console.warn('Refrescar flujo activo tras importación falló', fid, e); }
          }
          // Si aún no hemos abierto nada en esta importación, abrir el primero importado (cuando no sea el activo)
          if (!opened && !isActiveSame) {
            try {
              if (typeof window.App?.importJson === 'function') {
                window.App.importJson({ flow_id: fid, meta: flowLike.meta, nodes: flowLike.nodes });
                proj.active_flow_id = fid;
                opened = true; firstOpenedId = fid;
              }
            } catch(e) { console.warn('Abrir flujo importado falló', fid, e); }
          }
        }
        // Persistir proyecto
        try { localStorage.setItem('AppProject', JSON.stringify({ flows: proj.flows, main_flow_id: proj.main_flow_id, active_flow_id: proj.active_flow_id })); } catch(e) {}
  // Notificar actualización del proyecto (para refrescar listados en modal, etc.)
  try { document.dispatchEvent(new CustomEvent('AppProject:updated')); } catch(_) {}
  // Mensaje final
        const msgOk = importedCount > 1 ? `${importedCount} flujos importados` : (importedCount === 1 ? `Flujo importado: ${firstOpenedId}` : 'No se importaron flujos');
        try { if (window.Toasts?.info) window.Toasts.info(msgOk); else alert(msgOk); } catch(e) {}
        // Limpiar input para permitir reimportar los mismos archivos si se desea
        try { resetInputCb && resetInputCb(); } catch(e) {}
      } catch(err) {
        console.warn('Importación múltiple falló', err);
        alert('Importación fallida: ' + (err?.message || err));
      }
    }
    if(importFile) importFile.addEventListener('change', (ev)=>{
      handleMultiImport(ev.target.files, () => { try { ev.target.value = ''; } catch(_){} });
    });
    const importFolder = document.getElementById('importFolder');
    if(importFolder) importFolder.addEventListener('change', (ev)=>{
      // Filtrar a .json explícitamente, aunque el accept lo indica
      const onlyJson = Array.from(ev.target.files || []).filter(f => f.name.toLowerCase().endsWith('.json'));
      const dt = { length: onlyJson.length };
      // Reusar la misma lógica pasando un arreglo
      handleMultiImport(onlyJson, () => { try { ev.target.value = ''; } catch(_){} });
    });

    if(zoomIn) zoomIn.addEventListener('click', ()=> setZoom((helpers.getZoom?helpers.getZoom():1) + 0.1));
    if(zoomOut) zoomOut.addEventListener('click', ()=> setZoom((helpers.getZoom?helpers.getZoom():1) - 0.1));
    if(zoomReset) zoomReset.addEventListener('click', ()=> setZoom(1));

    // (modo compacto movido a js/compact_mode.js)

    // palette draggables
    document.querySelectorAll('#palette .draggable').forEach(el => {
      el.addEventListener('dragstart', (ev) => {
        ev.dataTransfer.setData('node-type', el.getAttribute('data-type'));
        ev.dataTransfer.setData('text/plain', el.getAttribute('data-type'));
      });
      el.addEventListener('click', (ev) => {
        const type = el.getAttribute('data-type'); if(!type) return;
        const rect = canvas.getBoundingClientRect(); const scrollLeft = canvas.scrollLeft || 0; const scrollTop = canvas.scrollTop || 0;
        const centerX = (rect.width / 2) + scrollLeft; const centerY = (rect.height / 2) + scrollTop;
        const x = centerX / (helpers.getZoom?helpers.getZoom():1); const y = centerY / (helpers.getZoom?helpers.getZoom():1);
        const node = createNode(type, x, y);
        const propsPanel = document.getElementById('properties'); if(propsPanel && !propsPanel.classList.contains('overlay-visible')) propsPanel.classList.add('overlay-visible');
        selectNode(node.id);
      });
    });

    // click outside canvas deselect
    if (canvas) canvas.addEventListener('click', (e) => {
      if (helpers.onCanvasClick) helpers.onCanvasClick(e);
      state.selectedId = null; if (helpers.showProperties) helpers.showProperties(null); document.querySelectorAll('.node').forEach(nd => nd.style.outline = '');
      const propsPanel = document.getElementById('properties'); if(propsPanel) { propsPanel.classList.remove('force-visible'); propsPanel.classList.remove('overlay-visible'); }
    });

    // Delete key: remove currently selected node (except Start). Skip when editing inputs.
    document.addEventListener('keydown', (e) => {
      try {
        if (e.key !== 'Delete' && e.key !== 'Del') return;
        const tgt = e.target; const tag = tgt && tgt.tagName ? tgt.tagName.toUpperCase() : '';
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (tgt && tgt.isContentEditable)) return;
        const sel = state.selectedId; if (!sel) return;
        const node = state.nodes[sel]; if (!node) return;
  if (node.type === 'start') { alert('El nodo Start no puede eliminarse. Debe existir uno por flujo.'); return; }
        if (typeof jsPlumb !== 'undefined') {
          try {
            const el = document.getElementById('node_' + node.id);
            if (el) jsPlumb.remove('node_' + node.id);
            else if (window.__APP_DEBUG_CONN__) console.debug('ui_controls: skip jsPlumb.remove - element missing', 'node_' + node.id);
          } catch(err) { console.warn('jsPlumb.remove failed', err); }
        }
        delete state.nodes[node.id];
        const el = document.getElementById('node_' + node.id); if (el) el.remove();
        state.selectedId = null;
        if (helpers.showProperties) try { helpers.showProperties(null); } catch(er) {}
        try { if (helpers.refreshOutput) helpers.refreshOutput(); else if (window.App && typeof window.App.refreshOutput === 'function') window.App.refreshOutput(); } catch(er) {}
        try { if (helpers.refreshConnections) helpers.refreshConnections(state); else if (window.AppConnections && typeof window.AppConnections.refreshConnections === 'function') window.AppConnections.refreshConnections(state); } catch(er) { console.warn('refreshConnections failed', er); }
      } catch(err) { console.warn('Delete key handler failed', err); }
    });

    // header toggles
    if(togglePaletteBtn) togglePaletteBtn.addEventListener('click', () => { const p = document.getElementById('palette'); if(p) { p.classList.toggle('overlay-visible'); saveUiState(); } });
    if(togglePropertiesBtn) togglePropertiesBtn.addEventListener('click', () => { const p = document.getElementById('properties'); if(p) { p.classList.toggle('overlay-visible'); saveUiState(); } });

    // Show generated JSON in modal
    if(btnShowJson) btnShowJson.addEventListener('click', () => {
      const modal = document.getElementById('jsonModal');
      const content = document.getElementById('jsonModalContent');
      if(!modal || !content) return;
      try {
        const out = (helpers.generateFlowJson? helpers.generateFlowJson() : (window.App && window.App.generateFlowJson? window.App.generateFlowJson() : null));
        content.textContent = out ? JSON.stringify(out, null, 2) : '{}';
      } catch(e) { content.textContent = '{}'; }
      modal.style.display = 'flex'; modal.setAttribute('aria-hidden','false');
    });

    const jsonModalClose = document.getElementById('jsonModalClose');
  if(jsonModalClose) jsonModalClose.addEventListener('click', ()=>{ const m = document.getElementById('jsonModal'); if(m){ m.style.display = 'none'; m.setAttribute('aria-hidden','true'); const btn = document.getElementById('btnShowJson'); if(btn) try { btn.focus(); } catch(e){} } });
    const jsonModalCopy = document.getElementById('jsonModalCopy');
    if(jsonModalCopy) jsonModalCopy.addEventListener('click', ()=>{
      const content = document.getElementById('jsonModalContent'); if(!content) return;
      try {
        navigator.clipboard.writeText(content.textContent);
        if (typeof showToast === 'function') showToast('JSON copiado al portapapeles');
        else alert('JSON copiado al portapapeles');
      } catch(e) { alert('No se pudo copiar: ' + e); }
    });

    // Close modal on click outside (overlay) or when pressing Escape
    document.addEventListener('click', (e) => {
      const modal = document.getElementById('jsonModal'); if(!modal) return;
      if (modal.style.display === 'flex' && e.target === modal) {
        modal.style.display = 'none'; modal.setAttribute('aria-hidden','true');
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        const modal = document.getElementById('jsonModal'); if(!modal) return;
        if (modal.style.display === 'flex') { modal.style.display = 'none'; modal.setAttribute('aria-hidden','true'); }
      }
    });

    // close overlays on click outside
    document.addEventListener('click', (e) => {
      const palette = document.getElementById('palette');
      const properties = document.getElementById('properties');
      // Guardar comprobaciones de existencia antes de llamar a .contains para evitar errores si los botones no existen
      if (palette && !palette.contains(e.target) && e.target !== togglePaletteBtn && !(togglePaletteBtn && togglePaletteBtn.contains(e.target))) {
        palette.classList.remove('overlay-visible');
      }
      if (properties && !properties.contains(e.target) && e.target !== togglePropertiesBtn && !(togglePropertiesBtn && togglePropertiesBtn.contains(e.target)) && !properties.classList.contains('force-visible')) {
        properties.classList.remove('overlay-visible');
      }
    });

    // wheel zoom centered on cursor
    if (canvas) canvas.addEventListener('wheel', (ev) => {
      if(!ev.shiftKey) {
        if(ev.ctrlKey || ev.metaKey || ev.altKey) {
          ev.preventDefault();
          const delta = ev.deltaY > 0 ? -0.1 : 0.1;
          const rect = canvas.getBoundingClientRect();
          const cursorX = (ev.clientX - rect.left) + canvas.scrollLeft;
          const cursorY = (ev.clientY - rect.top) + canvas.scrollTop;
          const currentZoom = helpers.getZoom ? helpers.getZoom() : 1;
          const newZoom = Math.max(0.2, Math.min(2, currentZoom + delta));
          const factor = newZoom / currentZoom;
          const newScrollLeft = (cursorX * factor) - (ev.clientX - rect.left);
          const newScrollTop = (cursorY * factor) - (ev.clientY - rect.top);
          setZoom(newZoom);
          canvas.scrollLeft = newScrollLeft; canvas.scrollTop = newScrollTop;
        }
      }
    }, { passive: false });

    // save scroll debounce
    let saveScrollTimer = null;
    if (canvas) canvas.addEventListener('scroll', () => { if(saveScrollTimer) clearTimeout(saveScrollTimer); saveScrollTimer = setTimeout(()=> saveUiState(), 200); });

    // pan with spacebar
    if (canvas) {
      // panning can be triggered either by holding Space (keyboard) or by right-button drag on empty canvas
      let panning = false; let panStart = null; let panViaMouse = false;
      canvas.addEventListener('keydown', (e) => { if(e.code === 'Space') { panning = true; canvas.style.cursor = 'grab'; } });
      canvas.addEventListener('keyup', (e) => { if(e.code === 'Space') { panning = false; canvas.style.cursor = ''; } });

      // start panning on mousedown when Space mode is active or when right mouse button is pressed on canvas background
      canvas.addEventListener('mousedown', (e) => {
        // right-click (button===2) panning only when clicking on the canvas background (not on a node or control)
        if (e.button === 2 && !e.target.closest || !e.target.closest('.node')) {
          // ensure click was on the canvas element (or its immediate background)
          if (e.target === canvas || e.target === canvas || !e.target.closest('.node')) {
            panViaMouse = true; panning = true;
            panStart = { x: e.clientX, y: e.clientY, left: canvas.scrollLeft, top: canvas.scrollTop };
            canvas.style.cursor = 'grabbing';
            // prevent default to avoid context menu while dragging
            e.preventDefault();
          }
        } else if (panning) {
          // existing Spacebar panning start
          panStart = { x: e.clientX, y: e.clientY, left: canvas.scrollLeft, top: canvas.scrollTop };
          e.preventDefault();
        }
      });

      // prevent context menu when panning via right-button
      canvas.addEventListener('contextmenu', (e) => { if (panViaMouse) e.preventDefault(); });

      window.addEventListener('mousemove', (e) => {
        if (panning && panStart) {
          const dx = e.clientX - panStart.x; const dy = e.clientY - panStart.y;
          canvas.scrollLeft = panStart.left - dx; canvas.scrollTop = panStart.top - dy;
        }
      });

      // If user clicks left button while panning via right-button, cancel the right-button panning
      window.addEventListener('mousedown', (e) => {
        if (panViaMouse && e.button === 0) {
          panStart = null; panning = false; panViaMouse = false; canvas.style.cursor = '';
        }
      });

      window.addEventListener('mouseup', (e) => {
        // if mouse panning ended (right button released) or general mouse up, stop panning
        if (panViaMouse && e.button === 2) {
          panStart = null; panning = false; panViaMouse = false; canvas.style.cursor = '';
        } else if (!panViaMouse) {
          panStart = null; panning = false; canvas.style.cursor = '';
        }
      });
    }
  }

  try { window.AppUI = { setupUI }; console.debug('[AppUI] module loaded'); } catch(e){}
})();
