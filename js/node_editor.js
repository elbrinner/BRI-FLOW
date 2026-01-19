// js/node_editor.js
// Manejo de propiedades y aplicación de cambios en nodos, extraído de main.js
(function () {
  function ensureDocBadge(state, nodeOrId) {
    try {
      const node = typeof nodeOrId === 'string' ? state.nodes[nodeOrId] : nodeOrId;
      if (!node) return;
      const el = document.getElementById('node_' + node.id);
      if (!el) return;
      // set accent color for CSS theming if available
      try {
        const styles = (window.AppRenderer && window.AppRenderer._styles) || {};
        const style = styles[node.type] || { color: '#6b7280', icon: '📦' };
        el.style.setProperty('--node-accent', style.color);
      } catch (e) { /* noop */ }
      // clear previous
      el.querySelectorAll('.node-doc-badge, .node-tooltip').forEach(x => x.remove());
      const desc = (node.descripcion || '').toString().trim();
      if (!desc) return; // nothing to show
      const styles = (window.AppRenderer && window.AppRenderer._styles) || {};
      const style = styles[node.type] || { icon: '📦' };
      const badge = document.createElement('div');
      badge.className = 'node-doc-badge themed';
      badge.title = 'Ver documentación';
      badge.setAttribute('tabindex', '0');
      badge.setAttribute('role', 'button');
      badge.setAttribute('aria-label', 'Ver documentación del nodo');
      badge.textContent = 'ℹ️';
      const tip = document.createElement('div');
      tip.className = 'node-tooltip';
      const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
      tip.innerHTML = `<div class="node-tooltip-header">${style.icon || '📦'} Descripción</div><div class="node-tooltip-body">${esc(desc)}</div>`;
      el.appendChild(badge);
      el.appendChild(tip);
    } catch (e) { /* noop */ }
  }
  function showProperties(state, node, helpers = {}) {
    console.log('[AppEditor] showProperties ENTER', node ? node.id : 'null');
    const propForm = document.getElementById('propForm');
    const noSelection = document.getElementById('noSelection');
    const dynamicProps = document.getElementById('dynamicProps');
    const selectNode = helpers.selectNode || (id => { if (window.App && typeof window.App.selectNode === 'function') window.App.selectNode(id); });
    const renderVariables = helpers.renderVariables || (() => { if (window.App && typeof window.App.renderVariables === 'function') window.App.renderVariables(); });
    const collectVariables = helpers.collectVariables || (s => { if (window.AppVariables && typeof window.AppVariables.collectVariables === 'function') return window.AppVariables.collectVariables(s || state); return []; });
    const applyNodeChangesLocal = (n, newId, values) => applyNodeChanges(state, n, newId, values, helpers);

    if (!propForm || !noSelection || !dynamicProps) {
      console.warn('Properties DOM elements missing');
      return;
    }
    if (!node) {
      noSelection.style.display = 'block';
      propForm.style.display = 'none';
      return;
    }
    noSelection.style.display = 'none';
    propForm.style.display = 'block';

    // Open properties panel: Ensure it is visible
    try {
      const propsPanel = document.getElementById('properties');
      if (propsPanel) {
        console.log('[AppEditor] Forcing properties panel visibility');
        propsPanel.classList.remove('collapsed');
        propsPanel.classList.add('force-visible');
      }
    } catch (e) {
      console.warn('[AppEditor] Failed to open properties panel:', e);
    }

    try { const aside = document.getElementById('properties'); if (aside) aside.setAttribute('data-node-type', (node.type || '').trim()); } catch (_e) { }
    document.getElementById('prop_id').value = node.id;
    document.getElementById('prop_type').value = node.type;
    dynamicProps.innerHTML = '';
    // call builder
    const reader = FormBuilder.renderPropsFor(node, dynamicProps, Object.keys(state.nodes));
    // Regla: solo flujo principal (meta.is_main === true) puede editar locales en nodo start.
    try {
      if (node.type === 'start') {
        const isMain = !!(state && state.meta && state.meta.is_main);
        if (!isMain) {
          // Buscar controles que gestionan locales (por id conocido o heurística por label)
          const localeRow = dynamicProps.querySelector('[data-prop="locales"], #start_locales');
          if (localeRow) {
            const row = localeRow.closest('.form-row') || localeRow;
            if (row) {
              row.style.display = 'none';
              row.dataset.hiddenBy = 'non-main-flow';
            }
          } else {
            // Heurística: label que contiene 'Idioma' o 'Locales'
            dynamicProps.querySelectorAll('.form-row label').forEach(l => {
              const txt = (l.textContent || '').toLowerCase();
              if (txt.includes('idioma') || txt.includes('locale')) {
                const r = l.closest('.form-row');
                if (r) { r.style.display = 'none'; r.dataset.hiddenBy = 'non-main-flow'; }
              }
            });
          }
        }
      }
    } catch (e) { console.warn('[node_editor] ocultar locales fallo', e); }
    // Asegurar que el contenedor dinámico esté visible; filtramos filas indeseadas aparte
    try { dynamicProps.style.display = ''; } catch (_e) { }
    // Helpers para ocultar/mostrar filas por id de elemento interno
    function hideRowByInnerId(id) {
      try {
        const el = document.getElementById(id);
        const row = el && typeof el.closest === 'function' ? el.closest('.form-row') : null;
        if (row) { row.style.display = 'none'; row.dataset.hiddenBy = 'end'; }
      } catch (_e) { }
    }
    function showRowByInnerId(id) {
      try {
        const el = document.getElementById(id);
        const row = el && typeof el.closest === 'function' ? el.closest('.form-row') : null;
        if (row) { row.style.display = ''; row.dataset.hiddenBy = ''; }
      } catch (_e) { }
    }
    // Aplicar reglas de visibilidad para nodo end inmediatamente tras renderizar
    if (node.type === 'end') {
      hideRowByInnerId('variablesList');
      hideRowByInnerId('next_node');
      hideRowByInnerId('next_flow');
      try {
        const nextRow = dynamicProps.querySelector('[data-role="next"]');
        if (nextRow) nextRow.remove();
        else {
          // Fallback: localizar por texto del label en caso de que no exista data-role
          const labels = dynamicProps.querySelectorAll('label');
          labels.forEach(l => {
            const t = (l.textContent || '').trim();
            if (t.startsWith('Siguiente (flujo')) {
              const row = l.closest('.form-row') || l.parentElement; if (row) row.remove();
            }
          });
        }
      } catch (_e) { }
    } else {
      showRowByInnerId('variablesList');
      showRowByInnerId('next_node');
      showRowByInnerId('next_flow');
      // no-op: la fila de next se re-renderiza en tipos que la usan
    }
    // después de renderizar las propiedades, actualizar listado estático de variables
    try { renderVariables(); } catch (e) { /* noop */ }
    // No ocultamos dynamicProps; sólo removemos/ocultamos lo que no aplica por tipo
    // Reforzar ocultación tras un posible re-render de variables
    if (node.type === 'end') {
      hideRowByInnerId('variablesList');
      hideRowByInnerId('next_node');
      hideRowByInnerId('next_flow');
      try {
        const nextRow = dynamicProps.querySelector('[data-role="next"]'); if (nextRow) nextRow.remove();
      } catch (_e) { }
    }
    // attach delete (bloquear eliminación de start)
    const delBtn = document.getElementById('btnDeleteNode');
    if (node.type === 'start' && delBtn) { delBtn.disabled = true; delBtn.title = 'El nodo Start no puede eliminarse'; }
    else if (delBtn) { delBtn.disabled = false; delBtn.title = ''; }
    delBtn.onclick = () => {
      if (node.type === 'start') { alert('El nodo Start no puede eliminarse. Debe existir uno por flujo.'); return; }
      if (!confirm('Eliminar nodo ' + node.id + '?')) return;
      if (typeof jsPlumb !== 'undefined') {
        try {
          const el = document.getElementById('node_' + node.id);
          if (el) jsPlumb.remove('node_' + node.id);
          else if (window.__APP_DEBUG_CONN__) console.debug('node_editor: skip jsPlumb.remove - element missing', 'node_' + node.id);
        } catch (e) { console.warn('jsPlumb.remove failed', e); }
      }
      delete state.nodes[node.id];
      const el = document.getElementById('node_' + node.id); if (el) el.remove();
      state.selectedId = null; showProperties(state, null, helpers);
      try { if (helpers.refreshOutput) helpers.refreshOutput(); } catch (e) { }
      try {
        if (helpers.refreshConnections) helpers.refreshConnections(state);
        else if (window.AppConnections && typeof window.AppConnections.refreshConnections === 'function') window.AppConnections.refreshConnections(state);
      } catch (e) { console.warn('refreshConnections failed', e); }
    };

    propForm.onsubmit = (ev) => {
      ev.preventDefault();
      const newId = document.getElementById('prop_id').value.trim();
      if (!newId) return alert('ID obligatorio');
      // Validaciones de UI antes de aplicar cambios
      const blockIfErrors = (boxId, label) => {
        try {
          const vb = document.getElementById(boxId);
          if (vb) {
            const errs = JSON.parse(vb.dataset.errors || '[]');
            if (Array.isArray(errs) && errs.length) {
              alert('No se puede aplicar el nodo ' + label + ' mientras existan errores:\n- ' + errs.join('\n- '));
              return true;
            }
          }
        } catch (e) { /* noop */ }
        return false;
      };
      if (node.type === 'button' && blockIfErrors('button_validation_box', 'button')) return;
      if ((node.type === 'loop' || node.type === 'foreach') && blockIfErrors('loop_validation_box', 'loop')) return;
      if (node.type === 'rest_call' && blockIfErrors('rest_validation_box', 'rest_call')) return;
      const values = reader();
      // Validación adicional lógica para loop (no dependiente de UI)
      if (node.type === 'loop' || node.type === 'foreach') {
        const errs = [];
        if (values.mode === 'foreach' && !values.source_list) errs.push('source_list requerido en modo foreach.');
        if (values.mode === 'while' && !values.cond) errs.push('cond requerido en modo while.');
        if (values.body_start && values.body_start.node_id === node.id) errs.push('body_start no puede apuntar al mismo loop.');
        if (values.after_loop && values.after_loop.node_id === node.id) errs.push('after_loop no debe apuntar al mismo loop.');
        if (errs.length) { alert('Errores loop:\n- ' + errs.join('\n- ')); return; }
      }
      if (node.type === 'rest_call') {
        // auto-sugerir save_as si hay mappings o save_path y no se definió
        if (!values.save_as && ((Array.isArray(values.mappings) && values.mappings.length) || values.save_path)) {
          const baseName = (newId || node.id || 'rest') + '_resp';
          const existing = new Set(collectVariables(state));
          let candidate = baseName; let k = 1;
          while (existing.has(candidate)) candidate = baseName + '_' + (k++);
          values.save_as = candidate;
          const sv = document.querySelector('#rest_save_as input, #rest_save_as'); if (sv) sv.value = candidate;
        }
      }
      const hasVariableCollision = (candidate, currentName) => {
        if (!candidate) return false;
        for (const v of collectVariables(state)) if (v === candidate && v !== currentName) return true;
        return false;
      };
      if (node.type === 'rest_call' && values.save_as && hasVariableCollision(values.save_as, node.save_as)) {
        if (!confirm('La variable "' + values.save_as + '" ya existe en el flujo. Reemplazar?')) return;
      }
      // Para assign_var no hay colisión de creación (usa variable existente), pero si cambia Start variables luego emitimos evento.
      if (node.type === 'start' && newId !== node.id) {
        alert('El nodo Start no se puede renombrar.');
        document.getElementById('prop_id').value = node.id;
        return;
      }
      applyNodeChangesLocal(node, newId, values);
      // Forzar actualización inmediata del badge/tooltip tras aplicar (y reintentar tras micro/mini retraso)
      try { ensureDocBadge(state, newId); } catch (e) { }
      setTimeout(() => { try { ensureDocBadge(state, newId); } catch (e) { } }, 0);
      setTimeout(() => { try { ensureDocBadge(state, newId); } catch (e) { } }, 100);
      try {
        if (node.type === 'start' || node.type === 'assign_var') {
          window.dispatchEvent(new CustomEvent('variables:changed'));
        }
      } catch (e) { /* noop */ }
      // after applying changes, refresh variables/UI to reflect potential locales/variables updates
      try { renderVariables(); } catch (e) { /* noop */ }
      // Also update Start node DOM in-place to show declared variables immediately
      try {
        const startId = state.meta && state.meta.start_node;
        if (startId && state.nodes && state.nodes[startId]) {
          const startEl = document.getElementById('node_' + startId);
          if (startEl) {
            try {
              const startNode = state.nodes[startId];
              // build prefix HTML (locales, declared variables, other tags)
              let prefix = '';
              const locales = (state && state.meta && Array.isArray(state.meta.locales)) ? state.meta.locales : [];
              if (locales && locales.length) {
                const locTags = locales.map(l => `<span class="locale-badge">${l}</span>`).join('');
                prefix += `<div class="locales-container" title="Idiomas del flujo">${locTags}</div>`;
              }
              const declared = Array.isArray(startNode.variables) ? startNode.variables.filter(v => v && v.name) : [];
              if (declared.length) {
                prefix += `<div class="variables-preview">` + declared.map(v => {
                  let val = v.defaultValue;
                  if (typeof val === 'object' && val !== null) val = JSON.stringify(val);
                  return `<div class="var-item"><strong>${v.name}</strong>: ${val || ''}${v.isList ? ' <small>[lista]</small>' : ''}</div>`;
                }).join('') + `</div>`;
              }
              // other global variables collected from the flow
              try {
                const all = collectVariables(state) || [];
                const declMap = {};
                declared.forEach(v => { declMap[v.name] = v; });
                const others = all.filter(n => !declMap[n]);
                if (others && others.length) {
                  const tags = others.map(name => `<span class="tag" title="${name}">${name}</span>`).join('');
                  prefix += `<div class="tags-container" title="Variables globales">${tags}</div>`;
                }
              } catch (e) { /* noop */ }
              // rebuild header/type/mini/actions from existing node content
              const hdr = `<div class="hdr">${startNode.id}</div>`;
              const type = `<div class="type">${startNode.type}</div>`;
              const miniText = startNode.i18n?.es?.prompt ?? startNode.title ?? '';
              const mini = `<div class="mini">${miniText}</div>`;
              // set innerHTML preserving actions container al final
              startEl.innerHTML = prefix + hdr + type + mini + '<div class="actions"></div>';
              // reinyectar badge+tooltip si hay descripcion sin esperar a render global
              ensureDocBadge(state, startNode);
            } catch (e) { /* noop */ }
          }
        }
      } catch (e) { /* noop */ }
      // Ensure Start node visual updates immediately and connections/JSON refresh
      try {
        const startId = state.meta && state.meta.start_node;
        if (startId && state.nodes && state.nodes[startId]) {
          // ya se actualizó el DOM del Start arriba; evitamos doble re-render inmediato
          // refresh connections and output so endpoints and variables list update
          try { if (window.AppConnections && typeof window.AppConnections.refreshConnections === 'function') window.AppConnections.refreshConnections(state); } catch (e) { }
          try { if (window.App && typeof window.App.refreshOutput === 'function') window.App.refreshOutput(); } catch (e) { }
        }
      } catch (e) { /* noop */ }
      // if properties panel was shown as overlay, close it to mimic modal behavior
      try { const propsPanel = document.getElementById('properties'); if (propsPanel && propsPanel.classList.contains('overlay-visible')) propsPanel.classList.remove('overlay-visible'); } catch (e) { }
      // Guarantee connections refresh after Apply: schedule a macrotask so DOM/endpoints settle
      try {
        if (window.AppConnections && typeof window.AppConnections.refreshConnections === 'function') {
          setTimeout(() => {
            try { window.AppConnections.refreshConnections(state); } catch (e) { console.warn('scheduled refreshConnections failed', e); }
          }, 0);
        }
      } catch (e) { console.warn('schedule refreshConnections failed', e); }

      // Guardar automáticamente el flujo activo en el proyecto (localStorage)
      try {
        const proj = window.AppProject || { flows: {}, main_flow_id: null, active_flow_id: null };
        const flowId = state?.meta?.flow_id || 'flow_1';
        const meta = state?.meta ? { ...state.meta } : { flow_id: flowId, locales: ['es'], start_node: '' };
        // conservar marca de principal si aplica
        if (proj.main_flow_id === flowId) { meta.is_main = true; }
        proj.flows[flowId] = { meta, nodes: state?.nodes || {} };
        proj.active_flow_id = flowId;
        window.AppProject = proj;
        try {
          localStorage.setItem('AppProject', JSON.stringify({ flows: proj.flows, main_flow_id: proj.main_flow_id, active_flow_id: proj.active_flow_id }));
          // Notificación de guardado
          try {
            if (window.Toasts && typeof window.Toasts.info === 'function') window.Toasts.info('Guardado');
          } catch (_t) { /* noop */ }
        } catch (e) { console.warn('[auto-persist] localStorage failed', e); }
      } catch (e) { console.warn('[auto-persist] failed', e); }
    };
  }

  function applyNodeChanges(state, node, newId, values, helpers = {}) {
    const renderNode = helpers.renderNode || ((n) => { if (window.App && typeof window.App.renderNode === 'function') window.App.renderNode(n); });
    const selectNode = helpers.selectNode || ((id) => { if (window.App && typeof window.App.selectNode === 'function') window.App.selectNode(id); });
    const refreshOutput = helpers.refreshOutput || (() => { if (window.App && typeof window.App.refreshOutput === 'function') window.App.refreshOutput(); });

    const oldId = node.id;
    // Capture old state DEEP CLONE
    let oldNodeData = null;
    try { oldNodeData = JSON.parse(JSON.stringify(node)); } catch (e) { }

    if (newId !== oldId) {
      try { if (window.__APP_DEBUG_CONN__) console.debug('node_editor.applyNodeChanges - before rename', { oldId, newId, nodes: Object.keys(state.nodes) }); } catch (e) { }
      // If target id already exists in state, ask for confirmation to overwrite
      if (state.nodes[newId]) {
        try {
          const ok = confirm && confirm('El ID "' + newId + '" ya existe. Sobrescribir?');
          if (!ok) return;
        } catch (e) { return; }
      }
      // Remove jsPlumb endpoints first (they expect the element to exist), then remove DOM element
      // Perform in-place DOM rename to avoid jsPlumb/Katavorio races
      try {
        const existingEl = document.getElementById('node_' + oldId);
        if (existingEl) {
          try {
            if (typeof jsPlumb !== 'undefined') {
              try { jsPlumb.removeAllEndpoints(existingEl); } catch (e) { console.warn('jsPlumb.removeAllEndpoints(el) failed during rename', oldId, e); }
            }
          } catch (e) { }
          try { existingEl.id = 'node_' + newId; } catch (e) { }
          try { const hdr = existingEl.querySelector('.hdr'); if (hdr) hdr.textContent = newId; } catch (e) { }
        }
        state.nodes[newId] = state.nodes[oldId];
        delete state.nodes[oldId];
        node.id = newId;
      } catch (e) { /* noop */ }
      try { if (window.__APP_DEBUG_CONN__) console.debug('node_editor.applyNodeChanges - after rename', { oldId, newId, nodes: Object.keys(state.nodes) }); } catch (e) { }
      // Re-render renamed node and refresh connections to avoid race conditions
      try { if (typeof renderNode === 'function' && state.nodes[newId]) renderNode(state.nodes[newId]); } catch (e) { console.warn('renderNode after rename failed', e); }
      try {
        if (helpers && helpers.refreshConnections) helpers.refreshConnections(state);
        else if (window.AppConnections && typeof window.AppConnections.refreshConnections === 'function') window.AppConnections.refreshConnections(state);
      } catch (e) { console.warn('refreshConnections after rename failed', e); }
      // Capture dependent nodes for history (Undo/Redo)
      const changedDependentsBefore = {};
      const changedDependentsAfter = {};
      const affectedIds = new Set(); // Track IDs modified by rename

      // Helper to check if a node references oldId
      const referencesId = (n, id) => {
        if (!n) return false;
        if (n.next && n.next.node_id === id) return true;
        if (Array.isArray(n.connections) && n.connections.some(c => c.node_id === id)) return true;
        if (Array.isArray(n.options)) {
          if (n.options.some(opt => {
            const t = opt.next || opt.target;
            if (typeof t === 'string' && t === id) return true;
            if (t && t.node_id === id) return true;
            return false;
          })) return true;
        }
        if (n.true_target && n.true_target.node_id === id) return true;
        if (n.false_target && n.false_target.node_id === id) return true;
        if (n.body_start && n.body_start.node_id === id) return true;
        if (n.after_loop && n.after_loop.node_id === id) return true;
        return false;
      };

      // 1. Capture BEFORE state
      for (const id in state.nodes) {
        if (referencesId(state.nodes[id], oldId)) {
          try { changedDependentsBefore[id] = JSON.parse(JSON.stringify(state.nodes[id])); } catch (e) { }
          affectedIds.add(id);
        }
      }

      // 2. Perform updates
      for (const id in state.nodes) {
        const n = state.nodes[id];
        if (n.next && n.next.node_id === oldId) n.next.node_id = newId;
        if (Array.isArray(n.connections)) n.connections.forEach(conn => { if (conn.node_id === oldId) conn.node_id = newId; });
        if (Array.isArray(n.options)) n.options.forEach(opt => {
          // support both modern shape (opt.next) and legacy (opt.target)
          const t = opt.next || opt.target;
          if (typeof t === 'string' && t === oldId) {
            if (opt.next) opt.next = { flow_id: '', node_id: newId };
            else opt.target = { flow_id: '', node_id: newId };
          } else if (t && t.node_id === oldId) {
            if (opt.next) opt.next.node_id = newId;
            else opt.target.node_id = newId;
          }
        });
        if (n.true_target && n.true_target.node_id === oldId) n.true_target.node_id = newId;
        if (n.false_target && n.false_target.node_id === oldId) n.false_target.node_id = newId;
        if (n.body_start && n.body_start.node_id === oldId) n.body_start.node_id = newId;
        if (n.after_loop && n.after_loop.node_id === oldId) n.after_loop.node_id = newId;
      }

      // 3. Capture AFTER state
      affectedIds.forEach(id => {
        if (state.nodes[id]) {
          try { changedDependentsAfter[id] = JSON.parse(JSON.stringify(state.nodes[id])); } catch (e) { }
        }
      });
    }
    if (node.type === 'end' && values.next) values.next = null;
    if (Array.isArray(node.connections) && !('connections' in values)) values.connections = node.connections;
    if (Array.isArray(node.options) && !('options' in values)) values.options = node.options;
    if (node.next && !('next' in values) && document.getElementById('next_node') === null) values.next = node.next;

    Object.assign(node, values);
    // Persist descripcion specifically if present
    if (typeof values.descripcion !== 'undefined') node.descripcion = values.descripcion;
    // Normalize targets in node to consistent shape { flow_id, node_id }
    const normalizeTarget = (t) => {
      if (!t) return null;
      if (typeof t === 'string') return { flow_id: '', node_id: t };
      if (typeof t === 'object') {
        if (t.node_id) return { flow_id: t.flow_id || '', node_id: t.node_id };
        // support legacy key 'node' occasionally used
        if (t.node) return { flow_id: '', node_id: t.node };
      }
      return null;
    };
    try {
      if (node.next) node.next = normalizeTarget(node.next);
      if (Array.isArray(node.options)) {
        node.options = node.options.map(o => {
          // if already modern shape with i18n and next, normalize next and preserve variant
          if (o.next || (o.i18n && o.next !== undefined)) {
            const out = { i18n: o.i18n || {}, next: normalizeTarget(o.next), variant: o.variant };
            const explicit = (o.value !== undefined && o.value !== null) ? String(o.value) : '';
            if (explicit.trim() !== '') out.value = explicit;
            else {
              // fallback to label text from i18n (default locale) or legacy label
              const defaultLocale = (state && state.meta && Array.isArray(state.meta.locales) && state.meta.locales[0]) ? state.meta.locales[0] : 'en';
              let lbl = '';
              try { lbl = (o.i18n?.[defaultLocale]?.text) || ''; if (Array.isArray(lbl)) lbl = lbl[0] || ''; } catch (_e) { }
              if (!lbl && o.label) lbl = String(o.label);
              out.value = lbl || '';
            }
            return out;
          }
          // legacy shape: label + target
          const normalized = normalizeTarget(o.target || o.next);
          // create simple i18n using label in default locale if present
          const i18n = {};
          const defaultLocale = (state && state.meta && Array.isArray(state.meta.locales) && state.meta.locales[0]) ? state.meta.locales[0] : 'en';
          if (o.label) i18n[defaultLocale] = { text: o.label };
          const out = { i18n, next: normalized, variant: o.variant };
          const explicit = (o.value !== undefined && o.value !== null) ? String(o.value) : '';
          if (explicit.trim() !== '') out.value = explicit;
          else out.value = o.label || '';
          return out;
        });
      }
      if (node.true_target) node.true_target = normalizeTarget(node.true_target);
      if (node.false_target) node.false_target = normalizeTarget(node.false_target);
      if (node.body_start) node.body_start = normalizeTarget(node.body_start);
      if (node.after_loop) node.after_loop = normalizeTarget(node.after_loop);
    } catch (e) { console.warn('normalize targets failed', e); }
    try {
      if (values.save_as && ['input', 'rest_call', 'file_upload', 'button', 'choice'].includes(node.type)) {
        const startId = state.meta.start_node;
        if (startId && state.nodes[startId]) {
          state.nodes[startId].variables = state.nodes[startId].variables || [];
          const exists = state.nodes[startId].variables.some(v => v && v.name === values.save_as);
          if (!exists) state.nodes[startId].variables.push({ name: values.save_as, defaultValue: node.default_value || '', isList: false });
        }
      }
    } catch (e) { console.warn('auto-register save_as failed', e); }

    if (node.type === 'start') {
      const prev = state.meta.start_node;
      if (prev && prev !== node.id && state.nodes[prev]) { state.nodes[prev].type = 'response'; renderNode(state.nodes[prev]); }
      state.meta.start_node = node.id;
      // Solo si flujo principal permite aplicar locales
      const isMainFlow = !!(state && state.meta && state.meta.is_main);
      if (isMainFlow && values.locales && Array.isArray(values.locales) && values.locales.length) {
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
    renderNode(node);
    selectNode(null);
    refreshOutput();

    // RECORD HISTORY
    try {
      if (window.AppHistoryManager && oldNodeData) {
        const newNodeData = state.nodes[newId]; // Refetch from state in case object ref changed or normalized
        if (newNodeData) {
          if (oldId !== newId) {
            // Rename command with dependents
            window.AppHistoryManager.recordCommand(
              window.AppHistoryManager.createRenameNodeCommand(
                oldId,
                newId,
                oldNodeData,
                newNodeData,
                (typeof changedDependentsBefore !== 'undefined' ? changedDependentsBefore : {}),
                (typeof changedDependentsAfter !== 'undefined' ? changedDependentsAfter : {})
              )
            );
          } else {
            // Normal modify
            window.AppHistoryManager.recordCommand(
              window.AppHistoryManager.createModifyNodeCommand(newId, oldNodeData, newNodeData)
            );
          }
        }
      }
    } catch (e) { console.warn('History record failed', e); }

    try {
      if (helpers.refreshConnections) helpers.refreshConnections(state);
      else if (window.AppConnections && typeof window.AppConnections.refreshConnections === 'function') window.AppConnections.refreshConnections(state);
    } catch (e) { console.warn('refreshConnections failed', e); }
  }

  try { window.AppEditor = { showProperties, applyNodeChanges }; console.debug('[AppEditor] module loaded'); } catch (e) { }
})();
