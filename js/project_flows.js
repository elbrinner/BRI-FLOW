// project_flows.js
// Gestión mínima de proyecto con múltiples flujos en memoria (AppProject)
(function () {
  // Guardar último elemento con foco para restaurarlo al cerrar el modal
  let lastFocusedEl = null;
  const Project = {
    flows: {}, // { [flow_id]: { meta, nodes } }
    main_flow_id: null,
    active_flow_id: null,
    get active() { return window.App?.state; }
  };

  function ensureProject() {
    if (!window.AppProject) {
      window.AppProject = Project;
    }
    return window.AppProject;
  }

  function normalizeFlowLike(obj) {
    if (!obj) return null;
    const meta = obj.meta || {
      flow_id: obj.flow_id || 'flow_1',
      name: obj.name || obj.flow_id || 'Flujo',
      version: obj.version || '0.1.0',
      description: obj.description || '',
      locales: obj.locales || ['es'],
      start_node: obj.start_node || '',
      is_main: obj.is_main || false,
      last_modified: obj.last_modified || null
    };
    return { meta, nodes: obj.nodes || {} };
  }

  function renderList() {
    const proj = ensureProject();
    const list = document.getElementById('flowsList'); if (!list) return;
    list.innerHTML = '';
    const ids = Object.keys(proj.flows);
    if (ids.length === 0) { list.innerHTML = '<div class="p-4 text-sm text-gray-600">(No hay flujos en el proyecto)</div>'; return; }
    ids.forEach(fid => {
      const f = proj.flows[fid];
      const row = document.createElement('div'); row.className = 'flex items-center justify-between p-2';
      const left = document.createElement('div');
      const isMain = proj.main_flow_id === fid || !!f.meta?.is_main;
      const isActive = proj.active_flow_id === fid;
      const ver = f.meta?.version ? ` · v${f.meta.version}` : '';
      const mainChip = isMain ? ' <span class="ml-2 px-2 py-0.5 text-xs rounded bg-green-100 text-green-700 border border-green-200 align-middle">Principal</span>' : '';
      left.innerHTML = `<div class="font-semibold flex items-center gap-2">${f.meta?.name || fid}${ver}${isActive ? ' · (abierto)' : ''}${mainChip}</div><div class="text-xs text-gray-500">flow_id: ${fid}</div>`;
      const right = document.createElement('div'); right.className = 'flex items-center gap-2';
      const btnActivate = document.createElement('button'); btnActivate.className = 'px-2 py-1 bg-white border rounded text-sm'; btnActivate.textContent = isActive ? 'Abierto' : 'Abrir';
      if (isActive) { btnActivate.disabled = true; btnActivate.title = 'Este flujo ya está abierto'; btnActivate.classList.add('opacity-60', 'cursor-default'); }
      btnActivate.onclick = () => {
        try {
          const proj = ensureProject();
          // Si el flujo ya está activo, no re-importar: solo cerrar modal y refrescar conexiones
          if (proj.active_flow_id === fid) {
            closeModal();
            try {
              const state = window.App?.state;
              if (state && window.AppConnections && typeof window.AppConnections.refreshConnections === 'function') {
                setTimeout(() => { try { window.AppConnections.refreshConnections(state); } catch (_e1) { } }, 0);
                setTimeout(() => { try { window.AppConnections.refreshConnections(state); } catch (_e2) { } }, 80);
                setTimeout(() => { try { window.AppConnections.refreshConnections(state); } catch (_e3) { } }, 200);
              }
              try { if (window.App?.autoGrowCanvas) window.App.autoGrowCanvas(); } catch (_ag) { }
            } catch (_rf) { }
            try { if (window.Toasts && typeof window.Toasts.info === 'function') window.Toasts.info('Este flujo ya está abierto'); } catch (_t) { }
            return;
          }
          // Antes de cambiar de flujo, guardar el flujo actualmente abierto en el editor (si existe)
          try {
            if (window.App && typeof window.App.generateFlowJson === 'function') {
              const out = window.App.generateFlowJson();
              const curId = out?.flow_id || out?.meta?.flow_id;
              if (curId) {
                // Validar que el export contiene nodos no vacíos antes de sobrescribir
                const hasNodes = out && out.nodes && Object.keys(out.nodes).length > 0;
                if (hasNodes) {
                  const norm = normalizeFlowLike(out);
                  if (proj.main_flow_id === curId) { norm.meta = norm.meta || {}; norm.meta.is_main = true; }
                  proj.flows[curId] = norm;
                } else {
                  console.warn('[ProjectFlows] Se evitó guardar un flujo vacío para', curId);
                }
                try { if (window.Toasts && typeof window.Toasts.info === 'function') window.Toasts.info('Guardado'); } catch (_t) { }
              }
            }
          } catch (_e) { console.warn('[ProjectFlows] auto-upsert current before activate failed', _e); }
          // Cerrar el modal antes de importar para evitar que el overlay afecte el layout
          closeModal();
          // Cargar este flujo en el editor (App.state)
          if (window.App && typeof window.App.importJson === 'function') {
            const jsonLike = { flow_id: fid, meta: f.meta, nodes: f.nodes };
            window.App.importJson(jsonLike);
            proj.active_flow_id = fid;
            // Centrar/ajustar el canvas tras abrir el flujo (inmediato y breve reintento)
            const fitFn = globalThis.App?.fitCanvasToContent ? globalThis.App.fitCanvasToContent.bind(globalThis.App) : null;
            if (fitFn) {
              fitFn();
              setTimeout(fitFn, 80);
            }
            // Refrescar conexiones explícitamente para evitar que se "pierdan" visualmente
            try {
              const state = globalThis.App?.state;
              const refreshFn = globalThis.AppConnections?.refreshConnections ? globalThis.AppConnections.refreshConnections.bind(globalThis.AppConnections, state) : null;
              if (state && refreshFn) {
                // Difere un poco para asegurar que el DOM ya pintó todos los nodos
                setTimeout(refreshFn, 0);
                // Segundo intento tras un breve tiempo para cubrir layout tardío
                setTimeout(refreshFn, 180);
              }
            } catch (error_) { console.warn('[ProjectFlows] refreshConnections after open failed', error_); }
            try { if (typeof globalThis.App?.refreshOutput === 'function') globalThis.App.refreshOutput(); } catch (error_) { console.warn('[ProjectFlows] refreshOutput failed', error_); }
            // Persistir proyecto incluyendo active_flow_id actualizado
            try {
              persist();
              if (globalThis.Toasts && typeof globalThis.Toasts.info === 'function') {
                try { globalThis.Toasts.info('Flujo abierto'); } catch (error_) { console.warn('[ProjectFlows] toast info failed', error_); }
              }
            } catch (error_) { console.warn('[ProjectFlows] persist after activate failed', error_); }
          }
        } catch (e) { console.warn('Activar flujo falló', e); }
      };
      const btnMain = document.createElement('button'); btnMain.className = 'px-2 py-1 bg-white border rounded text-sm';
      if (isMain) {
        btnMain.textContent = 'Principal';
        btnMain.disabled = true;
        btnMain.title = 'Este flujo ya es el principal';
        btnMain.classList.add('opacity-60', 'cursor-default');
      } else {
        btnMain.textContent = 'Marcar principal';
        btnMain.title = 'Establecer este flujo como principal';
      }
      btnMain.onclick = () => { if (!isMain) setMainFlow(fid); };
      const btnDuplicate = document.createElement('button'); btnDuplicate.className = 'px-2 py-1 bg-white border rounded text-sm'; btnDuplicate.textContent = 'Duplicar';
      btnDuplicate.onclick = () => { duplicateFlow(fid); };
      const btnRename = document.createElement('button'); btnRename.className = 'px-2 py-1 bg-white border rounded text-sm'; btnRename.textContent = 'Renombrar';
      btnRename.onclick = () => { const nv = prompt('Nuevo nombre visible (name):', f.meta?.name || ''); if (nv != null) { f.meta = f.meta || {}; f.meta.name = nv; persist(); renderList(); } };
      const btnDelete = document.createElement('button'); btnDelete.className = 'px-2 py-1 bg-red-50 border border-red-200 rounded text-sm text-red-700'; btnDelete.textContent = 'Eliminar';
      btnDelete.onclick = () => {
        // No permitir eliminar el flujo 'fallback'
        if (fid === 'fallback' || f?.meta?.is_fallback) { alert('El flujo fallback no puede eliminarse.'); return; }
        if (confirm('¿Eliminar este flujo del proyecto?')) {
          delete proj.flows[fid];
          if (proj.main_flow_id === fid) proj.main_flow_id = null;
          persist(); renderList();
        }
      };
      right.appendChild(btnActivate); right.appendChild(btnMain); right.appendChild(btnDuplicate); right.appendChild(btnRename); right.appendChild(btnDelete);
      row.appendChild(left); row.appendChild(right); list.appendChild(row);
    });
  }

  function openModal() {
    const m = document.getElementById('flowsModal');
    if (!m) { return; }
    // Guardar foco actual para restaurar luego
    try { lastFocusedEl = document.activeElement; } catch (_e) { }
    // Mostrar modal y anunciar accesible
    m.classList.remove('hidden');
    m.classList.add('flex');
    m.setAttribute('aria-hidden', 'false');
    // Mover foco dentro del modal (al botón cerrar por defecto)
    try { (document.getElementById('flowsModalClose') || m).focus({ preventScroll: true }); } catch (_f) { }
    renderList();
    // Enlazar botón "Abrir carpeta" cada vez que se abre (por si el DOM se recrea)
    try {
      const btnImportFolder = document.getElementById('btnImportFolder');
      const hiddenInput = document.getElementById('importFolder');
      if (btnImportFolder && hiddenInput) {
        btnImportFolder.onclick = () => { try { hiddenInput.click(); } catch (_e) { } };
      }
    } catch (_w) { }
  }
  function closeModal() {
    const m = document.getElementById('flowsModal');
    if (!m) { return; }
    // Evitar dejar foco en un elemento oculto
    try { if (m.contains(document.activeElement)) { (document.activeElement)?.blur?.(); } } catch (_e) { }
    // Ocultar y marcar aria-hidden
    m.classList.add('hidden');
    m.classList.remove('flex');
    m.setAttribute('aria-hidden', 'true');
    // Restaurar foco al disparador si es posible
    try { (document.getElementById('btnOpenFlows') || lastFocusedEl)?.focus?.({ preventScroll: true }); } catch (_r) { }
  }

  function createNewFlow() {
    const proj = ensureProject();
    const fid = prompt('Nuevo flow_id:', 'new_flow'); if (!fid) return;
    if (proj.flows[fid]) { alert('Ya existe un flujo con ese flow_id'); return; }
    const name = prompt('Nombre visible del flujo:', fid) || fid;
    const flow = { meta: { flow_id: fid, name, locales: ['es'], start_node: '', is_main: false }, nodes: {} };
    proj.flows[fid] = flow;
    // Si no hay principal aún, ofrecer marcar este como principal
    try {
      const shouldBeMain = (!proj.main_flow_id) ? true : (confirm('¿Marcar este nuevo flujo como principal?'));
      if (shouldBeMain) {
        setMainFlow(fid);
      } else {
        persist();
        renderList();
      }
    } catch (_e) {
      // Fallback: si no hay principal, establecer éste; si ya hay, dejar como no principal
      if (!proj.main_flow_id) setMainFlow(fid); else { persist(); renderList(); }
    }
  }

  function upsertCurrentFlow() {
    const proj = ensureProject();
    try {
      if (!window.App || typeof window.App.generateFlowJson !== 'function') { alert('Editor no disponible'); return; }
      const out = window.App.generateFlowJson();
      const fid = out?.flow_id || out?.meta?.flow_id;
      if (!fid) { alert('El flujo actual no tiene flow_id'); return; }
      const norm = normalizeFlowLike(out);
      // Propagar bandera principal desde el proyecto
      if (proj.main_flow_id === fid) { norm.meta = norm.meta || {}; norm.meta.is_main = true; }
      proj.flows[fid] = norm;
      if (!proj.main_flow_id) proj.main_flow_id = fid;
      proj.active_flow_id = fid;
      persist(); renderList();
    } catch (e) { alert('No se pudo añadir el flujo actual: ' + e.message); }
  }

  function setMainFlow(fid) {
    const proj = ensureProject();
    if (!proj.flows[fid]) return;
    const prevMain = proj.main_flow_id;
    proj.main_flow_id = fid;
    // Limpiar/establecer is_main en todos los flujos del proyecto
    Object.keys(proj.flows).forEach(k => {
      const f = proj.flows[k]; f.meta = f.meta || {}; f.meta.is_main = (k === fid);
    });
    // Sincronizar con el editor si el activo coincide
    try {
      const st = window.App?.state;
      if (st && st.meta) {
        const activeId = st.meta.flow_id;
        if (activeId === fid) st.meta.is_main = true;
        else if (activeId === prevMain) st.meta.is_main = false;
        // refrescar salida y variables si está disponible
        try { if (window.App?.refreshOutput) window.App.refreshOutput(); } catch (_e) { }
        // Actualizar chip en badge de cabecera
        try {
          const chip = document.getElementById('mainFlowChip');
          if (chip) chip.classList.toggle('hidden', !(st.meta && st.meta.is_main === true));
        } catch (_c) { /* noop */ }
      }
    } catch (_e) { /* noop */ }
    persist(); renderList();
  }

  function duplicateFlow(fid) {
    const proj = ensureProject(); const src = proj.flows[fid]; if (!src) return;
    const newId = prompt('Nuevo flow_id para la copia:', fid + '_copy'); if (!newId) return;
    if (proj.flows[newId]) { alert('Ya existe un flujo con ese flow_id'); return; }
    const clone = JSON.parse(JSON.stringify(src));
    clone.meta = clone.meta || {}; clone.meta.flow_id = newId; clone.meta.name = (clone.meta.name ? (clone.meta.name + ' (copia)') : newId);
    // No heredar marca de principal
    clone.meta.is_main = false;
    proj.flows[newId] = clone;
    persist(); renderList();
  }

  function persist() {
    try {
      localStorage.setItem('AppProject', JSON.stringify({ flows: window.AppProject.flows, main_flow_id: window.AppProject.main_flow_id, active_flow_id: window.AppProject.active_flow_id }));
    } catch (e) { console.warn('[ProjectFlows] persist failed', e); }
  }
  function restore() {
    try {
      const raw = localStorage.getItem('AppProject');
      if (!raw) { return; }
      const obj = JSON.parse(raw);
      const proj = ensureProject();
      proj.flows = obj.flows || {};
      proj.main_flow_id = obj.main_flow_id || null;
      proj.active_flow_id = obj.active_flow_id || null;
    } catch (e) { console.warn('[ProjectFlows] restore failed', e); }
  }

  function bind() {
    const initFlows = () => {
      restore();
      // Si hay un flujo activo restaurado, cargarlo automáticamente en el editor
      try {
        const proj = ensureProject();
        const af = proj.active_flow_id; const fobj = af && proj.flows[af];
        if (af && fobj && window.App && typeof window.App.importJson === 'function') {
          window.App.importJson({ flow_id: af, meta: fobj.meta, nodes: fobj.nodes });
        }
      } catch (_e) { console.warn('[ProjectFlows] auto-load active flow on restore failed', _e); }
    };

    if (typeof jsPlumb !== 'undefined') {
      jsPlumb.ready(initFlows);
    } else {
      initFlows();
    }

    document.getElementById('btnOpenFlows')?.addEventListener('click', openModal);
    document.getElementById('flowsModalClose')?.addEventListener('click', closeModal);
    document.getElementById('btnCreateFlow')?.addEventListener('click', createNewFlow);
    document.getElementById('btnUpsertCurrent')?.addEventListener('click', upsertCurrentFlow);
    // Si no hay flujos, sugerir crear al cargar
    setTimeout(() => {
      const proj = ensureProject();
      if (Object.keys(proj.flows).length === 0) {
        try {
          const name = prompt('Nombre del flujo principal:', 'principal') || 'principal';
          const fid = (name || 'principal').toLowerCase().replace(/[^a-z0-9_-]+/g, '_');
          // Crear flujo con nodo Start por defecto
          proj.flows[fid] = {
            meta: { flow_id: fid, name, locales: ['es'], start_node: 'start', is_main: true },
            nodes: {
              'start': { id: 'start', type: 'start', x: 100, y: 100, variables: [], next: null }
            }
          };
          proj.main_flow_id = fid; proj.active_flow_id = fid;
          // Crear flujo fallback por defecto si no existe
          const fbId = 'fallback';
          if (!proj.flows[fbId]) {
            proj.flows[fbId] = {
              meta: { flow_id: fbId, name: 'Fallback (entrada no esperada)', locales: ['es'], start_node: 'sfb_1', is_main: false, is_fallback: true }, nodes: {
                'sfb_1': { id: 'sfb_1', type: 'start', x: 200, y: 320, variables: [], next: { node_id: 'rfb_1' } },
                'rfb_1': { id: 'rfb_1', type: 'response', x: 420, y: 320, i18n: { es: { text: ['Adiós'] } }, next: { node_id: 'efb_1' } },
                'efb_1': { id: 'efb_1', type: 'end', x: 640, y: 320 }
              }
            };
          }
          persist();
          // activar en el editor si está disponible
          try {
            if (window.App && typeof window.App.importJson === 'function') {
              window.App.importJson({ flow_id: fid, meta: proj.flows[fid].meta, nodes: proj.flows[fid].nodes });
            }
          } catch (_e) { console.warn('[ProjectFlows] importJson inicial falló', _e); }
        } catch (e) { console.warn('[ProjectFlows] primer uso falló', e); }
        openModal();
      } else {
        // asegurar que existe fallback
        if (!proj.flows['fallback']) {
          proj.flows['fallback'] = {
            meta: { flow_id: 'fallback', name: 'Fallback (entrada no esperada)', locales: ['es'], start_node: 'sfb_1', is_main: false, is_fallback: true }, nodes: {
              'sfb_1': { id: 'sfb_1', type: 'start', x: 200, y: 320, variables: [], next: { node_id: 'rfb_1' } },
              'rfb_1': { id: 'rfb_1', type: 'response', x: 420, y: 320, i18n: { es: { text: ['Adiós'] } }, next: { node_id: 'efb_1' } },
              'efb_1': { id: 'efb_1', type: 'end', x: 640, y: 320 }
            }
          };
          persist();
        }
        renderList();
      }
    }, 300);
  }

  document.addEventListener('DOMContentLoaded', bind);
  // Re-render list when project updates (e.g., after multi-import)
  document.addEventListener('AppProject:updated', () => { try { renderList(); } catch (_) { } });
})();
