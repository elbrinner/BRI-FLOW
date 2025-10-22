// io.js
// Maneja export/import de JSON y carga de ejemplo
(function(){
  async function exportJson(state, helpers={}){
    try {
      let out = null;
      if (helpers.generateFlowJson) {
        out = helpers.generateFlowJson();
      } else if (window.AppSerializer && typeof window.AppSerializer.generateFlowJson === 'function') {
        out = window.AppSerializer.generateFlowJson(state);
      }
      const data = JSON.stringify(out || {}, null, 2);
      const blob = new Blob([data], {type:'application/json'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      // Convención: siempre guardar como <flow_id>.json (la versión va dentro del JSON)
      const flowId = state?.meta?.flow_id ?? out?.flow_id ?? null;
      let filename = '';
      if (flowId) {
        filename = `${flowId}.json`;
      } else {
        const fallbackName = state?.meta?.name || 'flujo';
        filename = `${fallbackName}.json`;
      }
      a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
    } catch(err) { console.warn('AppIO.exportJson failed', err); alert('Error al exportar JSON: ' + err); }
  }

  function importJson(state, obj, helpers={}){
    try {
      // If the main App exposes an importJson that implements richer heuristics
      // (eg. inferring loop.source_list), prefer delegating to it so all import
      // entrypoints behave consistently.
      if (typeof window !== 'undefined' && window.App && typeof window.App.importJson === 'function') {
        try { window.App.importJson(obj); return; } catch(e) { console.warn('Delegated App.importJson failed', e); }
      }
      if (!obj?.nodes) return alert('JSON inválido (no se encontró nodes)');
      state.nodes = {};
      state.meta.flow_id = obj.flow_id || state.meta.flow_id;
      state.meta.version = obj.version || state.meta.version;
      state.meta.name = obj.name || state.meta.name;
      state.meta.description = obj.description || state.meta.description;
      state.meta.locales = obj.locales || state.meta.locales;
      state.meta.start_node = obj.start_node || state.meta.start_node;
      for(const id in obj.nodes) {
        // preserve x/y from imported JSON when present, otherwise compute a modest layout
        const node = { ...obj.nodes[id] };
        if (node.x === undefined || node.x === null) node.x = 20 + (Object.keys(state.nodes).length * 30) % 400;
        if (node.y === undefined || node.y === null) node.y = 20 + (Object.keys(state.nodes).length * 20) % 300;
        state.nodes[id] = node;
      }
      // render
      const canvasInner = helpers.canvasInner || document.getElementById('canvasInner');
      if (canvasInner) canvasInner.innerHTML = '';
      if (helpers.renderNode) {
        for (const id in state.nodes) helpers.renderNode(state.nodes[id]);
      } else {
        for (const id in state.nodes) {
          const rn = window.AppRenderer?.renderNode;
          if (typeof rn === 'function') rn(state, state.nodes[id], canvasInner, window.AppUIState?.getZoom?.() || 1, window.AppConnections?.addEndpoints, () => {});
        }
      }
      if (helpers.refreshConnections) try { helpers.refreshConnections(); } catch(e) { console.warn('refreshConnections failed during import', e); }
      if (helpers.refreshOutput) try { helpers.refreshOutput(); } catch(e) { console.warn('refreshOutput failed during import', e); }
      // After rendering nodes, adjust canvas scroll to show the imported layout: compute bounding box
      try {
        const canvasEl = document.getElementById('canvas');
        const canvasInnerEl = document.getElementById('canvasInner');
        if (canvasEl && canvasInnerEl) {
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity; let found = false;
          for (const id in state.nodes) {
            const n = state.nodes[id];
            if (typeof n.x === 'number' && typeof n.y === 'number') {
              found = true;
              minX = Math.min(minX, n.x);
              minY = Math.min(minY, n.y);
              maxX = Math.max(maxX, n.x);
              maxY = Math.max(maxY, n.y);
            }
          }
          if (found) {
            // center bounding box in viewport
            const padding = 80; // px
            const targetLeft = Math.max(0, Math.floor(minX - padding));
            const targetTop = Math.max(0, Math.floor(minY - padding));
            canvasEl.scrollLeft = targetLeft;
            canvasEl.scrollTop = targetTop;
          }
        }
      } catch(e) { console.warn('importJson: ajuste de scroll falló', e); }
    } catch(err) { console.warn('AppIO.importJson failed', err); alert('Error al importar JSON: ' + err); }
  }

  function loadExample(state, helpers={}){
    fetch('data/ejemplo.json').then(r => r.json()).then(obj => {
      importJson(state, obj, helpers);
    }).catch(err => { alert('No se pudo cargar ejemplo: ' + err); });
  }

  window.AppIO = { exportJson, importJson, loadExample };
})();
