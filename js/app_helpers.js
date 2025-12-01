// app_helpers.js
// Helpers extracted from main.js to reduce file size and cognitive complexity.
(function(){
  function refreshConnectionsImpl(state, addEndpoints, jsPlumb) {
    if (typeof jsPlumb === 'undefined') return;
    try { if (jsPlumb.setSuspendDrawing) jsPlumb.setSuspendDrawing(true); } catch(e) { console.warn('suspendDrawing(true) failed', e); }
    try { if (jsPlumb.deleteEveryConnection) jsPlumb.deleteEveryConnection(); } catch(e) { console.warn('deleteEveryConnection failed', e); }
    for (const id in state.nodes) { try { addEndpoints(id); } catch(e) { console.warn('addEndpoints failed for', id, e); } }
    const toConnect = [];
    for (const id in state.nodes) {
      const node = state.nodes[id];
      if (node.next?.node_id && state.nodes[node.next.node_id]) toConnect.push({ source: 'node_' + id, target: 'node_' + node.next.node_id, label: null });
      if (Array.isArray(node.connections)) {
        node.connections.forEach(conn => { if (conn?.node_id && state.nodes[conn.node_id]) toConnect.push({ source: 'node_' + id, target: 'node_' + conn.node_id, label: conn.label || null }); });
      }
      if (node.options) {
        node.options.forEach(option => { if (option.target?.node_id && state.nodes[option.target.node_id]) toConnect.push({ source: 'node_' + id, target: 'node_' + option.target.node_id, label: option.label || '' }); });
      }
      if (node.true_target?.node_id && state.nodes[node.true_target.node_id]) toConnect.push({ source: 'node_' + id, target: 'node_' + node.true_target.node_id, label: 'TRUE' });
      if (node.false_target?.node_id && state.nodes[node.false_target.node_id]) toConnect.push({ source: 'node_' + id, target: 'node_' + node.false_target.node_id, label: 'FALSE' });
      if (node.body_start?.node_id && state.nodes[node.body_start.node_id]) toConnect.push({ source: 'node_' + id, target: 'node_' + node.body_start.node_id, label: 'BODY' });
      if (node.after_loop?.node_id && state.nodes[node.after_loop.node_id]) toConnect.push({ source: 'node_' + id, target: 'node_' + node.after_loop.node_id, label: 'AFTER' });
    }
    const groups = {};
    toConnect.forEach(spec => { const key = spec.source + '|' + spec.target; groups[key] = groups[key] || []; groups[key].push(spec); });
    // Defer connection creation to next macrotask so DOM updates (renderNode/remove) can settle.
    // Using setTimeout(...,0) gives the browser a chance to update layout and for jsPlumb to finish internal tasks.
    setTimeout(() => {
      Object.keys(groups).forEach(key => {
        const arr = groups[key];
        arr.forEach((spec, idx) => {
          // Defensive: ensure both source and target DOM elements still exist and nodes are present in state
          try {
            const srcExists = !!document.getElementById(spec.source);
            const tgtExists = !!document.getElementById(spec.target);
            const srcNodeId = spec.source && spec.source.replace(/^node_/, '');
            const tgtNodeId = spec.target && spec.target.replace(/^node_/, '');
            const nodesOk = state.nodes && state.nodes[srcNodeId] && state.nodes[tgtNodeId];
            if (!srcExists || !tgtExists || !nodesOk) {
              if (window.__APP_DEBUG_CONN__) console.warn('Skipping invalid connection spec', spec, { srcExists, tgtExists, nodesOk });
              return;
            }
          } catch(e) { /* noop - fall through to attempt connect */ }
          const offset = ((Math.floor(idx/2) + 1) * 30) * (idx % 2 === 0 ? 1 : -1);
          const curviness = idx === 0 ? 0 : offset;
          const overlays = spec.label ? [['Label', { label: spec.label, location: 0.5 }]] : [];
          try {
            jsPlumb.connect({ source: spec.source, target: spec.target, connector: ['Bezier', { curviness }], paintStyle: { stroke: '#456', strokeWidth: 2 }, overlays });
          } catch (e) {
            try { jsPlumb.connect({ source: spec.source, target: spec.target, anchors: ['AutoDefault','AutoDefault'], overlays }); } catch(err) { console.warn('connect failed', err); }
          }
        });
      });
    }, 0);
    try { if (jsPlumb.repaintEverything) jsPlumb.repaintEverything(); } catch(e) { console.warn('repaintEverything failed', e); }
    try { if (jsPlumb.setSuspendDrawing) jsPlumb.setSuspendDrawing(false, true); } catch(e) { console.warn('suspendDrawing(false) failed', e); }
  }

  function renderNodeImpl(node, state, addEndpoints, canvasInner, zoom, selectNode, renderVariables) {
    const existing = document.getElementById('node_'+node.id);
    if (existing) {
      if (typeof jsPlumb !== 'undefined') { try { jsPlumb.remove('node_' + node.id); } catch(e) { console.warn('jsPlumb.remove failed for', node.id, e); } }
      existing.remove();
    }
    const n = document.createElement('div'); n.className = 'node'; if (node.type) n.classList.add(node.type); if(node.type === 'start') n.classList.add('start'); if(node.type === 'end') n.classList.add('end'); n.id = 'node_'+node.id; n.style.left = (node.x || 20) + 'px'; n.style.top = (node.y || 20) + 'px'; n.draggable = true;
    const miniText = node.i18n?.es?.prompt ?? node.title ?? '';
    let html = '';
    if (node.type === 'condition') {
      const label = (node.expr && node.expr.trim()) ? 'IF' : 'IF';
      html = `\n      <div class="diamond-wrapper">\n        <div class="diamond"><div class="diamond-label">${label}</div></div>\n      </div>\n      <div class="hdr">${node.id}</div>\n      <div class="type">${node.type}</div>\n      <div class="mini">${miniText}</div>`;
    } else {
      html = `<div class="hdr">${node.id}</div>\n           <div class="type">${node.type}</div>\n           <div class="mini">${miniText}</div>`;
    }
    if (node.type === 'start' && node.variables && node.variables.length) {
      html += '<div class="variables-preview">'; node.variables.forEach(v => { if (v.name) { html += `<div class="var-item">${v.name}${v.isList ? ' [lista]' : ''}: ${v.defaultValue || ''}</div>`; } }); html += '</div>';
    }
    html += '<div class="actions"></div>';
    n.innerHTML = html;
    n.addEventListener('click', (ev)=>{ ev.stopPropagation(); selectNode(node.id); });
    n.addEventListener('dragstart', (ev) => {
      ev.dataTransfer.setData('text/plain', node.id);
      const rect = n.getBoundingClientRect();
      ev.dataTransfer.setData('dragOffsetX', String((ev.clientX - rect.left) / zoom));
      ev.dataTransfer.setData('dragOffsetY', String((ev.clientY - rect.top) / zoom));
    });
    n.addEventListener('dblclick', () => { selectNode(node.id); try { document.getElementById('prop_id').focus(); } catch(e){} });
    canvasInner.appendChild(n);
    try { addEndpoints(node.id); } catch(e) { console.warn('addEndpoints failed', e); }
  }

  function renderVariablesImpl(state, selectNode) {
    const el = document.getElementById('variablesList'); if(!el) return;
    const startId = state.meta.start_node; const declared = (startId && Array.isArray(state.nodes[startId]?.variables)) ? state.nodes[startId].variables : [];
    if (!declared.length) { el.textContent = '(sin variables definidas)'; return; }
    el.innerHTML = '';
    const list = document.createElement('div'); list.className = 'variables-list'; list.style.maxHeight = '240px'; list.style.overflow = 'auto'; list.style.paddingRight = '6px';
    declared.forEach(v => {
      const item = document.createElement('div'); item.className = 'variable-item flex items-center justify-between'; item.style.display = 'flex'; item.style.justifyContent = 'space-between'; item.style.alignItems = 'center'; item.style.padding = '6px'; item.style.marginBottom = '6px';
      const left = document.createElement('div'); left.className = 'font-mono'; left.textContent = v.name + (v.isList ? ' [lista]' : '');
      const right = document.createElement('div'); right.style.display = 'flex'; right.style.alignItems = 'center'; right.style.gap = '8px';
      const val = document.createElement('span'); val.style.color = '#d97706'; val.className = 'font-mono'; val.textContent = v.defaultValue || '';
      const copyBtn = document.createElement('button'); copyBtn.type = 'button'; copyBtn.title = 'Copiar variable'; copyBtn.className = 'copy-btn'; copyBtn.style.padding = '6px'; copyBtn.style.borderRadius = '6px'; copyBtn.style.border = '1px solid #c7ddff'; copyBtn.style.background = '#eef6ff'; copyBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><rect x="8" y="8" width="8" height="8" rx="2" stroke-width="2" stroke="currentColor" fill="none"/><rect x="4" y="4" width="8" height="8" rx="2" stroke-width="2" stroke="currentColor" fill="none"/></svg>';
      copyBtn.addEventListener('click', () => { const toCopy = `{{${v.name}}}`; try { navigator.clipboard.writeText(toCopy); } catch(e){} if (typeof showToast === 'function') showToast(`Copiado: ${toCopy}`); });
      right.appendChild(val); right.appendChild(copyBtn); item.appendChild(left); item.appendChild(right); list.appendChild(item);
    });
    el.appendChild(list);
    if (startId && state.nodes[startId]) {
      const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = 'Editar variables en Start'; btn.style.marginTop = '6px'; btn.addEventListener('click', () => { selectNode(startId); }); el.appendChild(btn);
    }
  }

  function applyNodeChangesImpl(node, newId, values, state, renderNode, selectNode, refreshOutput) {
    const oldId = node.id;
    if(newId !== oldId) {
      try { if (window.__APP_DEBUG_CONN__) console.debug('applyNodeChangesImpl - before rename', { oldId, newId, nodes: Object.keys(state.nodes) }); } catch(e) {}
      // If target id already exists in state, ask for confirmation to overwrite
      if (state.nodes[newId]) {
        try {
          const ok = confirm && confirm('El ID "' + newId + '" ya existe. Sobrescribir?');
          if (!ok) return;
        } catch(e) { /* if confirm not available, proceed conservatively by aborting */
          return;
        }
      }
      // Try to rename the DOM element in-place to avoid jsPlumb/Katavorio races.
      try {
        const existingEl = document.getElementById('node_' + oldId);
        if (existingEl) {
          // Remove endpoints attached to the element (use element reference to be safe)
          try {
            if (typeof jsPlumb !== 'undefined') {
              try { jsPlumb.removeAllEndpoints(existingEl); } catch(e) { console.warn('jsPlumb.removeAllEndpoints(el) failed during rename', oldId, e); }
            }
          } catch(e) {}
          // rename DOM id so we keep the same element and avoid detach races
          try { existingEl.id = 'node_' + newId; } catch(e) {}
          // update visible header inside node if present
          try { const hdr = existingEl.querySelector('.hdr'); if (hdr) hdr.textContent = newId; } catch(e) {}
        }
      } catch(e) { /* noop */ }

      state.nodes[newId] = state.nodes[oldId]; delete state.nodes[oldId]; node.id = newId;
      try { if (window.__APP_DEBUG_CONN__) console.debug('applyNodeChangesImpl - after rename', { oldId, newId, nodes: Object.keys(state.nodes) }); } catch(e) {}
      // Immediately re-render the renamed node and refresh visual connections to avoid races
      try {
        // Re-render (will update content) — renderNode should be tolerant to element existing
        if (typeof renderNode === 'function' && state.nodes[newId]) renderNode(state.nodes[newId]);
      } catch(e) { console.warn('renderNode after rename failed', e); }
      try {
        // Prefer to only refresh connections after rename; AppConnections.refreshConnections will re-add endpoints safely
        if (window.AppConnections && typeof window.AppConnections.refreshConnections === 'function') window.AppConnections.refreshConnections(state);
        else if (typeof window.AppHelpers !== 'undefined' && typeof window.AppHelpers.refreshConnections === 'function') window.AppHelpers.refreshConnections(state, addEndpoints, typeof jsPlumb !== 'undefined' ? jsPlumb : undefined);
      } catch(e) { console.warn('refreshConnections after rename failed', e); }
      for (const id in state.nodes) {
        const n = state.nodes[id];
        if (n.next && n.next.node_id === oldId) n.next.node_id = newId;
        if (Array.isArray(n.connections)) n.connections.forEach(conn => { if (conn.node_id === oldId) conn.node_id = newId; });
        if (Array.isArray(n.options)) n.options.forEach(opt => { if (opt.target && opt.target.node_id === oldId) opt.target.node_id = newId; });
        if (n.true_target && n.true_target.node_id === oldId) n.true_target.node_id = newId;
        if (n.false_target && n.false_target.node_id === oldId) n.false_target.node_id = newId;
        if (n.body_start && n.body_start.node_id === oldId) n.body_start.node_id = newId;
        if (n.after_loop && n.after_loop.node_id === oldId) n.after_loop.node_id = newId;
      }
    }
    if(node.type === 'end' && values.next) values.next = null;
    if (Array.isArray(node.connections) && !('connections' in values)) values.connections = node.connections;
    // Normalize legacy option targets when values.options is provided as strings
    if (Array.isArray(values.options)) {
      values.options.forEach(opt => {
        if (opt && typeof opt.target === 'string') {
          opt.target = { node_id: opt.target };
        }
      });
    }
    if (Array.isArray(node.options) && !('options' in values)) values.options = node.options;
    if (node.next && !('next' in values) && document.getElementById('next_node') === null) values.next = node.next;
    Object.assign(node, values);
    try {
      if (values.save_as && ['input','rest_call','file_upload'].includes(node.type)) {
        const startId = state.meta.start_node;
        if (startId && state.nodes[startId]) {
          state.nodes[startId].variables = state.nodes[startId].variables || [];
          const exists = state.nodes[startId].variables.some(v => v && v.name === values.save_as);
          if (!exists) state.nodes[startId].variables.push({ name: values.save_as, defaultValue: node.default_value || '', isList: false });
        }
      }
    } catch(e) { console.warn('auto-register save_as failed', e); }
    if(node.type === 'start') {
      const prev = state.meta.start_node;
      if(prev && prev !== node.id && state.nodes[prev]) { state.nodes[prev].type = 'response'; try { renderNode(state.nodes[prev]); } catch(e){} }
      state.meta.start_node = node.id;
      if (values.locales && Array.isArray(values.locales) && values.locales.length) {
        state.meta.locales = values.locales;
        for (const id in state.nodes) {
          const n = state.nodes[id];
          if (n.i18n) {
            for (const loc of state.meta.locales) {
              if (!n.i18n[loc]) {
                if (n.type === 'response') n.i18n[loc] = { text: [] };
                else if (n.type === 'input' || n.type === 'choice') n.i18n[loc] = { prompt: '' };
              }
            }
          }
        }
      }
    }
    // If arbitrary node contains i18n keys (new locales defined there), merge them into meta.locales
    try {
      if (values && values.i18n && typeof values.i18n === 'object') {
        const newLocs = Object.keys(values.i18n).filter(Boolean);
          if (newLocs.length) {
            state.meta.locales = Array.from(new Set([...(state.meta.locales || []), ...newLocs]));
            // ensure every node has entries for the new locales where appropriate
            for (const id in state.nodes) {
              const n = state.nodes[id];
              if (n.i18n) {
                for (const loc of state.meta.locales) {
                  if (!n.i18n[loc]) {
                    if (n.type === 'response') n.i18n[loc] = { text: [] };
                    else if (n.type === 'input' || n.type === 'choice') n.i18n[loc] = { prompt: '' };
                  }
                }
              }
            }
            // re-render the start node so badges/variables update visually immediately
            try {
              const startId = state.meta.start_node;
              if (startId && state.nodes[startId] && typeof renderNode === 'function') {
                renderNode(state.nodes[startId]);
              }
              // refresh the variables panel if available
              try { if (typeof window.AppHelpers?.renderVariables === 'function') window.AppHelpers.renderVariables(state, selectNode); } catch(e) {}
              // try to refresh visual connections so endpoints reposition correctly without moving the node
              try {
                if (window.AppConnections && typeof window.AppConnections.refreshConnections === 'function') {
                  window.AppConnections.refreshConnections(state);
                }
              } catch(e) { /* noop */ }
            } catch(e) { /* noop */ }
          }
      }
    } catch(e) { /* noop */ }
    try { renderNode(node); selectNode(null); refreshOutput(); } catch(e) { console.warn('post-apply render failed', e); }
  }

  window.AppHelpers = window.AppHelpers || {};
  window.AppHelpers.refreshConnections = refreshConnectionsImpl;
  window.AppHelpers.renderNode = renderNodeImpl;
  window.AppHelpers.renderVariables = renderVariablesImpl;
  window.AppHelpers.applyNodeChanges = applyNodeChangesImpl;
})();
