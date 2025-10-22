// js/node_renderer.js
// Renderizado y selección de nodos desacoplados de main.js
(function(){
  const nodeStyles = {
    start: { color: '#2b7cff', bg: 'linear-gradient(90deg,#eef6ff,#fff)', icon: '🚀', label: 'Inicio' },
    response: { color: '#10b981', bg: 'linear-gradient(90deg,#f0fdf4,#fff)', icon: '💬', label: 'Respuesta' },
    input: { color: '#f59e0b', bg: 'linear-gradient(90deg,#fffbeb,#fff)', icon: '⌨️', label: 'Entrada' },
    assign_var: { color: '#8b5cf6', bg: 'linear-gradient(90deg,#faf5ff,#fff)', icon: '🔧', label: 'Asignar Variable' },
    button: { color: '#f59e0b', bg: 'linear-gradient(90deg,#fffaf0,#fff)', icon: '🔘', label: 'Botón' },
    rest_call: { color: '#06b6d4', bg: 'linear-gradient(90deg,#ecfeff,#fff)', icon: '🔗', label: 'API REST' },
    foreach: { color: '#f97316', bg: 'linear-gradient(90deg,#fff7ed,#fff)', icon: '🔁', label: 'ForEach' },
    loop: { color: '#f97316', bg: 'linear-gradient(90deg,#fff7ed,#fff)', icon: '🔄', label: 'Loop' },
    condition: { color: '#ef4444', bg: 'linear-gradient(90deg,#fef2f2,#fff)', icon: '❓', label: 'Condición' },
    set_goto: { color: '#6366f1', bg: 'linear-gradient(90deg,#eef2ff,#fff)', icon: '🔙', label: 'Set Goto' },
    form: { color: '#84cc16', bg: 'linear-gradient(90deg,#f7fee7,#fff)', icon: '📝', label: 'Formulario' },
    hero_card: { color: '#ec4899', bg: 'linear-gradient(90deg,#fdf2f8,#fff)', icon: '🃏', label: 'Hero Card' },
    carousel: { color: '#ec4899', bg: 'linear-gradient(90deg,#fdf2f8,#fff)', icon: '🎠', label: 'Carousel' },
    file_upload: { color: '#6b7280', bg: 'linear-gradient(90deg,#f9fafb,#fff)', icon: '📎', label: 'Subir Archivo' },
    json_export: { color: '#6b7280', bg: 'linear-gradient(90deg,#f9fafb,#fff)', icon: '📄', label: 'Exportar JSON' },
    end: { color: '#ff6b6b', bg: 'linear-gradient(90deg,#fff6f6,#fff)', icon: '🏁', label: 'Fin' }
  };

  function renderNode(state, node, canvasInner, zoom, addEndpoints, selectNodeFn) {
    // if node element exists, remove to re-render
    const existing = document.getElementById('node_'+node.id);
    if(existing) {
      if (typeof jsPlumb !== 'undefined') {
        try {
          const el = document.getElementById('node_' + node.id);
          if (el) jsPlumb.remove('node_' + node.id);
          else if (window.AppRenderer && window.AppRenderer.debug) console.debug('node_renderer: skip jsPlumb.remove - element missing', 'node_' + node.id);
        } catch(e) { console.warn('jsPlumb.remove failed for', node.id, e); }
      }
      existing.remove();
    }

    const n = document.createElement('div');
    n.className = 'node';
    if (node.type) n.classList.add(node.type);
    if(node.type === 'start') { n.classList.add('start'); }
    if(node.type === 'end') { n.classList.add('end'); }
    // Aplicar estilos personalizados
  const style = nodeStyles[node.type] || { color: '#6b7280', bg: 'linear-gradient(90deg,#f9fafb,#fff)', icon: '📦', label: node.type };
    n.style.borderColor = style.color;
  n.style.background = style.bg;
  // Exponer color de acento para CSS (badge/tooltip)
  try { n.style.setProperty('--node-accent', style.color); } catch(e) { /* noop */ }
    // Tooltip accesible (sin usar title nativo para permitir formato visual)
    if (node.descripcion && String(node.descripcion).trim()) {
      n.setAttribute('aria-label', String(node.descripcion).trim());
    } else {
      n.removeAttribute('aria-label');
    }
    // Botón: modo y variante
    if(node.type === 'button') {
      const modeClass = (node.mode === 'dynamic') ? 'btn-dynamic' : 'btn-static';
      n.classList.add(modeClass);
      const variant = node.variant || 'primary';
      n.classList.add('btn-var-' + variant);
      if (node.optional) n.classList.add('btn-optional');
    }
    n.id = 'node_'+node.id;
    n.style.left = (node.x || 20) + 'px';
    n.style.top = (node.y || 20) + 'px';
    n.draggable = true;

  const miniText = node.i18n?.es?.prompt ?? node.title ?? '';
  let html = '';
    if (node.type === 'condition') {
      const label = (node.expr && node.expr.trim()) ? 'IF' : 'IF';
      html = `
      <div class="diamond-wrapper">
        <div class="diamond"><div class="diamond-label">${style.icon} ${label}</div></div>
      </div>
      <div class="hdr">${node.id}</div>
      <div class="type">${node.type}</div>
      <div class="mini">${miniText}</div>`;
    } else {
   // Añadir badges simples para botón
   if (node.type === 'button') {
     const modeBadge = node.mode === 'dynamic' ? '<span class="badge badge-mode badge-dyn" title="Dinámico">Dyn</span>' : '<span class="badge badge-mode badge-stat" title="Estático">Stat</span>';
     const variantBadge = `<span class="badge badge-var" title="Variante">${(node.variant||'pri').slice(0,3)}</span>`;
     html = `<div class="hdr flex items-center gap-1">${style.icon} ${node.id} ${modeBadge} ${variantBadge}</div>
     <div class="type">${node.type}</div>
     <div class="mini">${miniText}</div>`;
   } else {
     html = `<div class="hdr flex items-center gap-1">${style.icon} ${node.id}</div>
       <div class="type">${node.type}</div>
       <div class="mini">${miniText}</div>`;
   }
    }
    // For start node: render declared variables (with defaults) and a summary of all global variables
    if (node.type === 'start') {
      // Render global locales (languages) as small badges when available
      const locales = (state && state.meta && Array.isArray(state.meta.locales)) ? state.meta.locales : (window.App?.state?.meta?.locales || []);
      if (locales && locales.length) {
        const locTags = locales.map(l => `<span class="locale-badge">${l}</span>`).join('');
        html = `<div class="locales-container" title="Idiomas del flujo">${locTags}</div>` + html;
      }
      // declared variables inside start node (with defaults) - render as name: value
      const declared = Array.isArray(node.variables) ? node.variables.filter(v => v && v.name) : [];
      if (declared.length) {
        html = `<div class="variables-preview">` + declared.map(v => {
          return `<div class="var-item"><strong>${v.name}</strong>: ${v.defaultValue || ''}${v.isList ? ' <small>[lista]</small>' : ''}</div>`;
        }).join('') + `</div>` + html;
      }
      // summary of other global variables (not declared in start) as tags; include value when available
      try {
        if (window.AppVariables && typeof window.AppVariables.collectVariables === 'function') {
          const all = window.AppVariables.collectVariables(state) || [];
          // build lookup from declared for quick exclusion and value lookup
          const declMap = {};
          declared.forEach(v => { declMap[v.name] = v; });
          const others = all.filter(n => !declMap[n]);
          if (others && others.length) {
            const tags = others.map(name => {
              const info = declMap[name];
              const val = info ? (info.defaultValue || '') : '';
              const isList = info ? !!info.isList : false;
              return `<span class="tag ${isList? 'tag-list':''}" title="${name}${val?': '+val:''}">${name}${val?': '+val:''}</span>`;
            }).join('');
            html = `<div class="tags-container" title="Variables globales">${tags}</div>` + html;
          }
        }
      } catch(e) { /* noop */ }
    }
    html += '<div class="actions"></div>';
  // If loop or foreach node, render with connection-based style showing variables
  if (node.type === 'loop' || node.type === 'foreach') {
      const itemVar = node.itemVar || node.item_var || 'item';
      const indexVar = node.indexVar || node.index_var || 'index';
      const sourceList = node.sourceList || node.source_list || '';
      
      const loopHeaderHtml = `
        <div class="loop-header">
          <div class="loop-var-info">
            <span class="loop-var-badge" title="Variable de iteración">🔄 ${itemVar}</span>
            <span class="loop-var-badge" title="Variable de índice">📍 ${indexVar}</span>
          </div>
          <div style="font-size: 10px; color: #64748b; font-family: monospace;">${sourceList ? 'from: ' + sourceList : ''}</div>
        </div>
        <div class="loop-endpoints-hint">
          <span class="endpoint-hint loop-body-hint">🔁 Loop Body (naranja)</span>
          <span class="endpoint-hint">➡️ Next (azul)</span>
        </div>`;
      
      html += loopHeaderHtml;
    }
    n.innerHTML = html;

    // Agregar (o refrescar) badge y tooltip visual si hay descripcion
    try {
      // limpiar instancias previas si se re-renderiza
      n.querySelectorAll('.node-doc-badge, .node-tooltip').forEach(el => el.remove());
      const desc = (node.descripcion || '').toString().trim();
  if (desc) {
        const esc = (s)=>s
          .replace(/&/g,'&amp;')
          .replace(/</g,'&lt;')
          .replace(/>/g,'&gt;')
          .replace(/"/g,'&quot;')
          .replace(/'/g,'&#39;');
        // Badge de documentación (hover/focus)
        const badge = document.createElement('div');
        badge.className = 'node-doc-badge themed';
        badge.title = 'Ver documentación';
        badge.setAttribute('tabindex','0');
        badge.setAttribute('role','button');
        badge.setAttribute('aria-label','Ver documentación del nodo');
  badge.textContent = 'ℹ️';
        n.appendChild(badge);
          const tip = document.createElement('div');
          tip.className = 'node-tooltip';
          tip.innerHTML = `<div class="node-tooltip-header">${style.icon} Descripción</div><div class="node-tooltip-body">${esc(desc).replace(/\n/g,'<br>')}</div>`;
          n.appendChild(tip);
      }
    } catch(e) { /* noop */ }

    n.addEventListener('click', (ev)=>{ ev.stopPropagation(); if(typeof selectNodeFn === 'function') selectNodeFn(node.id); });

    n.addEventListener('dragstart', (ev) => {
      ev.dataTransfer.setData('text/plain', node.id);
      const rect = n.getBoundingClientRect();
      ev.dataTransfer.setData('dragOffsetX', String((ev.clientX - rect.left) / (zoom || 1)));
      ev.dataTransfer.setData('dragOffsetY', String((ev.clientY - rect.top) / (zoom || 1)));
    });

    n.addEventListener('dblclick', () => { if(typeof selectNodeFn === 'function') { selectNodeFn(node.id); const el = document.getElementById('prop_id'); if(el) el.focus(); } });

    if (canvasInner) canvasInner.appendChild(n);
    // If this is a button node, show a small preview of its options
    if (node.type === 'button') {
      const actionsDiv = n.querySelector('.actions');
      if (actionsDiv) {
        if (node.mode === 'static' && Array.isArray(node.options) && node.options.length) {
          node.options.slice(0,3).forEach(opt => {
            const b = document.createElement('button');
            b.className = 'mini-action';
            const label = (opt && opt.label) ? String(opt.label) : (node.i18n?.es?.prompt ? node.i18n.es.prompt : 'btn');
            b.textContent = label.length > 12 ? label.slice(0,11) + '…' : label;
            b.title = label;
            if (opt && opt.target && (opt.target.node_id || opt.target.flow_id)) b.classList.add('has-target');
            b.disabled = true;
            actionsDiv.appendChild(b);
          });
          if (node.options.length > 3) {
            const more = document.createElement('span');
            more.className = 'more-actions';
            more.textContent = `+${node.options.length - 3}`;
            actionsDiv.appendChild(more);
          }
        } else if (node.mode === 'dynamic') {
          const badge = document.createElement('span');
          badge.className = 'mini-action dynamic-badge';
          badge.textContent = '⚡ dyn';
          badge.title = 'Botón dinámico'; 
          actionsDiv.appendChild(badge);
          // mostrar fuente dinámica (variable / source_list) y, cuando sea posible, un recuento
          try {
            const source = node.dynamic_options_from || (node.provider && node.provider.source_list) || '';
            const ds = document.createElement('div');
            ds.className = 'dynamic-source';
            ds.style.marginTop = '6px';
            ds.style.fontSize = '11px';
            ds.style.opacity = '0.9';
            if (source) {
              let countText = '';
              try {
                // intenta leer valores conocidos en el Start.variables (solo edición)
                const startId = state?.meta?.start_node || (window.App && window.App.state && window.App.state.meta && window.App.state.meta.start_node);
                if (startId && state && state.nodes && Array.isArray(state.nodes[startId]?.variables)) {
                  const found = state.nodes[startId].variables.find(v => v && v.name === source);
                  if (found && Array.isArray(found.defaultValue)) {
                    countText = ` — ${found.defaultValue.length} items`;
                  }
                }
              } catch(e) { /* best-effort */ }
              ds.innerHTML = `from: <code style="font-family:monospace">${source}</code>${countText}`;
            } else {
              ds.textContent = 'from: (source undefined)';
            }
            actionsDiv.appendChild(ds);
          } catch(e) { console.warn('dynamic preview render failed', e); }
        }
      }
    }
    // add endpoints via callback if available
    try { if (typeof addEndpoints === 'function') addEndpoints(node.id); } catch(e) { /* noop */ }
  }

  function selectNode(state, id, canvas, showPropertiesFn) {
    state.selectedId = id;
    document.querySelectorAll('.node').forEach(nd => nd.style.outline = '');
    const el = document.getElementById('node_' + id);
    if(el) el.style.outline = '2px solid var(--accent)';
    const propsPanel = document.getElementById('properties');
    if (propsPanel) {
      if (id) {
        if (propsPanel.classList.contains('overlay-visible')) propsPanel.classList.remove('overlay-visible');
        propsPanel.classList.add('force-visible');
      } else {
        propsPanel.classList.remove('force-visible');
      }
    }
    if(typeof showPropertiesFn === 'function') showPropertiesFn(state.nodes[id]);
  }

  try { window.AppRenderer = { renderNode, selectNode, _styles: nodeStyles }; console.debug('[AppRenderer] module loaded'); } catch(e) {}
})();
