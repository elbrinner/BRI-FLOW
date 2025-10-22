// main.js
// Guarda estado simple en memoria
const App = (() => {
  const state = {
    nodes: {}, // id -> node object
    selectedId: null,
    meta: {
      flow_id: 'mi_flujo',
      version: '1.0.0',
      name: 'Flujo creado con editor',
      description: '',
      locales: ['en'],
      start_node: ''
    },
    ui: {
      snapEnabled: true,
      gridSize: 20
    }
  };

  // DOM refs (initialized in init)
  let canvas; // viewport (scrollable)
  let canvasInner; // large virtual canvas where nodes live
  // Track base canvas size to enforce minimum when shrinking
  let baseCanvasWidth = 0;
  let baseCanvasHeight = 0;
  let jsonOutput;
  // removed unused DOM refs (propForm, noSelection, dynamicProps)

  // helper: generate unique id
  function genId(type) {
    let n = 1;
    while (state.nodes[`${type}_${n}`]) n++;
    return `${type}_${n}`;
  }

  // helper: add endpoints to node (delegates to AppConnections if available)
  let jsPlumbReadyFlag = false;
  function addEndpoints(nodeId) {
    if (window.AppConnections?.addEndpoints) {
      try { window.AppConnections.addEndpoints(state, nodeId); return; } catch(e) { console.warn('AppConnections.addEndpoints failed', e); }
    }
    // fallback to local implementation if module not present
    if (typeof jsPlumb === 'undefined' || !jsPlumbReadyFlag) return;
    const elId = 'node_' + nodeId;
    const el = document.getElementById(elId);
    if (!el) {
      if (window.App && window.App.debug) console.debug('[main] addEndpoints skipped - element missing', elId);
      return;
    }
  try { jsPlumb.removeAllEndpoints(elId); } catch(e) { console.warn('removeAllEndpoints failed for', nodeId, e); }
    const node = state.nodes[nodeId];
    if(!node || node.type !== 'end') {
      ['Top','Bottom','Left','Right'].forEach(anchor => { try { jsPlumb.addEndpoint(elId, { anchor, isSource: true, maxConnections: -1 }); } catch(e) { console.warn('jsPlumb.addEndpoint failed', elId, anchor, e); } });
    }
    if(!node || node.type !== 'start') {
      ['Top','Bottom','Left','Right'].forEach(anchor => { try { jsPlumb.addEndpoint(elId, { anchor, isTarget: true, maxConnections: -1 }); } catch(e) { console.warn('jsPlumb.addEndpoint failed', elId, anchor, e); } });
    }
  }

  // Zoom state (managed by AppUIState if available)
  let zoom = 1;
  function getSnapEnabled(){ return !!state.meta?.ui?.snapEnabled; }
  function setSnapEnabled(v){ if(!state.meta.ui) state.meta.ui = {}; state.meta.ui.snapEnabled = !!v; saveUiState(); }
  function getGridSize(){ return Math.max(5, Math.min(200, Number(state.meta?.ui?.gridSize || 20))); }
  function setGridSize(v){ if(!state.meta.ui) state.meta.ui = {}; state.meta.ui.gridSize = Math.max(5, Math.min(200, Number(v || 20))); saveUiState(); }
  function setZoom(z) {
    if (window.AppUIState && typeof window.AppUIState.setZoom === 'function') {
      try { window.AppUIState.setZoom(z); zoom = window.AppUIState.getZoom(); return; } catch(e){ console.warn('AppUIState.setZoom failed', e); }
    }
    zoom = Math.max(0.2, Math.min(2, z));
  if (canvasInner) canvasInner.style.transform = `scale(${zoom})`;
  try { if (typeof jsPlumb !== 'undefined' && typeof jsPlumb.setZoom === 'function') jsPlumb.setZoom(zoom); } catch(e) { /* noop */ }
    const lbl = document.getElementById('zoomLabel'); if(lbl) lbl.textContent = Math.round(zoom*100) + '%';
    try { if (typeof jsPlumb !== 'undefined') jsPlumb.repaintEverything(); } catch(e) { console.warn('repaintEverything failed', e); }
  try { autoGrowCanvas(); } catch(e) { console.warn('autoGrowCanvas from setZoom failed', e); }
    saveUiState();
  }

  // persist UI state (moved to module scope so other functions can call it)
  function saveUiState() {
    if (window.AppUIState && typeof window.AppUIState.saveUiState === 'function') {
      try { return window.AppUIState.saveUiState(); } catch(e) { console.warn('AppUIState.saveUiState failed', e); }
    }
    try {
      const stateToSave = {
        collapsed: Array.from(document.querySelectorAll('aside')).filter(a=>a.classList.contains('collapsed')).map(a=>a.id),
        zoom,
        scroll: { left: canvas?.scrollLeft || 0, top: canvas?.scrollTop || 0 },
        snap: getSnapEnabled(),
        grid: getGridSize()
      };
      localStorage.setItem('editorUiState', JSON.stringify(stateToSave));
    } catch(e) { console.warn('saveUiState failed', e); }
  }

  // restore UI state (separate function to keep init() simpler)
  function restoreUiState() {
    if (window.AppUIState && typeof window.AppUIState.restoreUiState === 'function') {
      try { return window.AppUIState.restoreUiState(); } catch(e) { console.warn('AppUIState.restoreUiState failed', e); }
    }
    try {
      const raw = localStorage.getItem('editorUiState');
      if(raw) {
        const s = JSON.parse(raw);
        applySavedState(s);
      } else {
        applyDefaultUiState();
      }
    } catch(e) { console.warn('restoreUiState failed', e); }
  }

  function applySavedState(s) {
    if (window.AppUIState && typeof window.AppUIState.applySavedState === 'function') {
      try { return window.AppUIState.applySavedState(s); } catch(e) { console.warn('AppUIState.applySavedState failed', e); }
    }
    if(!s) return;
    if(s.collapsed && Array.isArray(s.collapsed)) s.collapsed.forEach(id => { const el = document.getElementById(id); if(el) el.classList.add('collapsed'); });
    if(s.zoom) setZoom(s.zoom);
    if(s.scroll) { canvas.scrollLeft = s.scroll.left || 0; canvas.scrollTop = s.scroll.top || 0; }
    if(s.snap !== undefined) setSnapEnabled(!!s.snap);
    if(s.grid !== undefined) setGridSize(Number(s.grid));
    // sync header controls if present
    try {
      const snapEl = document.getElementById('toggleSnap'); if (snapEl) snapEl.checked = getSnapEnabled();
      const gridEl = document.getElementById('gridSizeInput'); if (gridEl) gridEl.value = String(getGridSize());
    } catch(e) { console.warn('applySavedState header sync failed', e); }

  }

  function applyDefaultUiState() {
    if (window.AppUIState && typeof window.AppUIState.applyDefaultUiState === 'function') {
      try { return window.AppUIState.applyDefaultUiState(); } catch(e) { console.warn('AppUIState.applyDefaultUiState failed', e); }
    }
    const palette = document.getElementById('palette'); if(palette) palette.classList.remove('collapsed');
    const props = document.getElementById('properties'); if(props) props.classList.remove('collapsed');
    try {
      if (canvas && canvasInner) {
        // center by default (horizontalBias 0.5 puts middle of canvas in center)
        const horizontalBias = 0.5;
        const targetLeft = Math.max(0, Math.floor((canvasInner.scrollWidth - canvas.clientWidth) * horizontalBias));
        const targetTop = Math.max(0, Math.floor((canvasInner.scrollHeight - canvas.clientHeight) * 0.5));
        canvas.scrollLeft = targetLeft;
        canvas.scrollTop = targetTop;
      }
  } catch(err) { console.warn('initial center scroll failed', err); }
  }

  // previously there was a helper here; removed to avoid unused symbol

  // refresh connections based on next and targets
  function refreshConnections() {
    if (window.AppConnections && typeof window.AppConnections.refreshConnections === 'function') {
      try { window.AppConnections.refreshConnections(state); return; } catch(e) { console.warn('AppConnections.refreshConnections failed', e); }
    }
    if (typeof jsPlumb === 'undefined') return;
    try { if (jsPlumb.setSuspendDrawing) jsPlumb.setSuspendDrawing(true); } catch(e) { console.warn('suspendDrawing(true) failed', e); }
    jsPlumb.deleteEveryConnection();
    for (const id in state.nodes) addEndpoints(id);
    // fallback simple reconnect (kept minimal since AppConnections covers full behavior)
    try { if (jsPlumb.repaintEverything) jsPlumb.repaintEverything(); } catch(e) { console.warn('repaintEverything failed', e); }
    try { if (jsPlumb.setSuspendDrawing) jsPlumb.setSuspendDrawing(false, true); } catch(e) { console.warn('suspendDrawing(false) failed', e); }
  }

  // create node object
  function createNode(type, x=20, y=20) {
    if (window.AppNodeFactory && typeof window.AppNodeFactory.createNode === 'function') {
      try { return window.AppNodeFactory.createNode(type, x, y); } catch(e) { console.warn('AppNodeFactory.createNode failed', e); }
    }
    // fallback: inline implementation (kept for compatibility)
    // ...existing code...
    // If trying to create a start but one exists, select and return existing start
    if (type === 'start' && state.meta.start_node && state.nodes[state.meta.start_node]) {
      selectNode(state.meta.start_node);
      return state.nodes[state.meta.start_node];
    }
    const id = genId(type);
    const base = { id, type, x, y, next: null };
    if(type === 'start') {
      const prev = state.meta.start_node;
      if(prev && state.nodes[prev]) {
        state.nodes[prev].type = 'response';
        renderNode(state.nodes[prev]);
      }
      state.meta.start_node = id;
      base.variables = base.variables || [];
    }
    const locales = Array.isArray(state.meta.locales) && state.meta.locales.length ? state.meta.locales : ['en'];
    if(type === 'response') { base.i18n = {}; locales.forEach(l => { base.i18n[l] = { text: [] }; }); }
    else if(type === 'input') { base.i18n = {}; locales.forEach(l => { base.i18n[l] = { prompt: '' }; }); base.save_as = ''; }
    else if(type === 'choice') { base.i18n = {}; locales.forEach(l => { base.i18n[l] = { prompt: '' }; }); base.options = []; }
  else if(type === 'rest_call') { base.method = 'GET'; base.url = ''; base.headers = {}; base.save_as = ''; base.save_path = ''; base.mappings = []; base.mock_mode = 'off'; base.mock = {}; }
    else if(type === 'hero_card') { base.title = ''; base.subtitle = ''; base.text = ''; base.image_url = ''; base.buttons = []; }
    else if(type === 'carousel') { base.cards = []; }
    else if(type === 'form') { base.fields = []; }
    else if(type === 'file_upload') { base.accept = ''; base.max_size = 0; base.save_as = ''; }
    else if(type === 'json_export') { base.filename = 'export.json'; base.description = ''; base.template = {}; }
    else if(type === 'file_download') { base.file_url = ''; base.filename = ''; base.description = ''; }
    state.nodes[id] = base;
  renderNode(base);
  try { autoGrowCanvas(); } catch(e) { /* noop */ }
  try { ensureNodeVisible(base, 120); } catch(e) { /* noop */ }
  selectNode(id);
    if (type !== 'start' && state.meta.start_node && state.nodes[state.meta.start_node]) {
      const startNode = state.nodes[state.meta.start_node];
      if (!startNode.next) { startNode.next = { flow_id: '', node_id: id }; renderNode(startNode); }
    }
    refreshOutput();
    return base;
  }

  // Render a node DOM in canvas (delegates to AppRenderer or AppHelpers)
  function renderNode(node) {
    // Assumes AppRenderer is loaded before main.js (index.html ordering)
  try { window.AppRenderer.renderNode(state, node, canvasInner, zoom, addEndpoints, selectNode); return; } catch(e) { console.error('AppRenderer.renderNode failed', e); throw e; }
  }
  function selectNode(id) {
    // Assumes AppRenderer is loaded before main.js (index.html ordering)
  try { window.AppRenderer.selectNode(state, id, canvas, showProperties); return; } catch(e) { console.error('AppRenderer.selectNode failed', e); throw e; }
  }

  function showProperties(node) {
    if (window.AppEditor && typeof window.AppEditor.showProperties === 'function') {
      try { window.AppEditor.showProperties(state, node, { selectNode, renderVariables, collectVariables, refreshOutput }); return; } catch(e) { console.warn('AppEditor.showProperties failed', e); }
    }
    console.warn('AppEditor.showProperties not available; properties UI disabled');
  }

  // Recolecta nombres de variables en el flujo (save_as y assign_var.name)
  function collectVariables() {
    if (window.AppVariables && typeof window.AppVariables.collectVariables === 'function') {
      try { return window.AppVariables.collectVariables(state); } catch(e) { console.warn('AppVariables.collectVariables failed', e); }
    }
    const startId = state.meta.start_node; const list = [];
    if (startId && Array.isArray(state.nodes[startId]?.variables)) state.nodes[startId].variables.forEach(v => { if (v?.name) list.push(v.name); });
  for (const id in state.nodes) { const n = state.nodes[id]; if(n.save_as) list.push(n.save_as); if(n.type === 'assign_var' && n.name) list.push(n.name); }
    return Array.from(new Set(list));
  }

  function renderVariables() {
    if (window.AppVariables && typeof window.AppVariables.renderVariables === 'function') {
      try { return window.AppVariables.renderVariables(state, selectNode); } catch(e) { console.warn('AppVariables.renderVariables failed', e); }
    }
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
      const copyBtn = document.createElement('button'); copyBtn.type = 'button'; copyBtn.title = 'Copiar variable'; copyBtn.className = 'copy-btn'; copyBtn.style.padding = '6px'; copyBtn.style.borderRadius = '6px'; copyBtn.style.border = '1px solid #c7ddff'; copyBtn.style.background = '#eef6ff';
      copyBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><rect x="8" y="8" width="8" height="8" rx="2" stroke-width="2" stroke="currentColor" fill="none"/><rect x="4" y="4" width="8" height="8" rx="2" stroke-width="2" stroke="currentColor" fill="none"/></svg>';
      copyBtn.addEventListener('click', () => { const toCopy = `{{${v.name}}}`; navigator.clipboard.writeText(toCopy); if (typeof showToast === 'function') showToast(`Copiado: ${toCopy}`); });
      right.appendChild(val); right.appendChild(copyBtn); item.appendChild(left); item.appendChild(right); list.appendChild(item);
    });
    el.appendChild(list);
    if (startId && state.nodes[startId]) { const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = 'Editar variables en Start'; btn.style.marginTop = '6px'; btn.addEventListener('click', () => { selectNode(startId); }); el.appendChild(btn); }
  }
  // exponer para depuración y permitir invocación manual
  try { window.renderVariables = renderVariables; console.debug('[main] renderVariables expuesta'); } catch(e) {}

  // asegurar render inicial al cargar DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { try { renderVariables(); console.debug('[main] DOMContentLoaded -> renderVariables'); } catch(e) {} });
  } else {
    try { renderVariables(); console.debug('[main] ready -> renderVariables'); } catch(e) {}
  }

  // Aplica los cambios leídos al nodo: delega a AppEditor si está presente
  function applyNodeChanges(node, newId, values) {
    if (window.AppEditor && typeof window.AppEditor.applyNodeChanges === 'function') {
      try { window.AppEditor.applyNodeChanges(state, node, newId, values, { renderNode, selectNode, refreshOutput }); return; } catch(e) { console.warn('AppEditor.applyNodeChanges failed', e); }
    }
    console.warn('AppEditor.applyNodeChanges not available; changes not applied');
  }
  // expose for other modules to call and to avoid unused function warning
  try { window.applyNodeChanges = applyNodeChanges; } catch(e) {}

  // refresh JSON output
  function refreshOutput() {
    try {
      const out = generateFlowJson();
      jsonOutput.textContent = JSON.stringify(out, null, 2);
    } catch (err) {
      console.warn('refreshOutput: failed to generate JSON', err);
      jsonOutput.textContent = '{}';
    }
    // refresh connections (visual)
    refreshConnections();
    // actualizar lista de variables
    renderVariables();
  }

  // Generate a normalized flow JSON object suitable for export / Semantic Kernel ingestion
  // normalize a single node into exportable shape
  // Serializer: delegate to AppSerializer when available. Keep a tiny safe fallback.
  function normalizeNode(n) {
    if (window.AppSerializer && typeof window.AppSerializer.normalizeNode === 'function') {
      try { return window.AppSerializer.normalizeNode(n); } catch(e) { console.warn('AppSerializer.normalizeNode failed', e); }
    }
    // Fallback más seguro: clonar el nodo completo para no perder propiedades
    try { return JSON.parse(JSON.stringify(n)); } catch(_e) { return { id: n.id, type: n.type }; }
  }

  function normalizeAllTargets(nodesObj) {
    if (window.AppSerializer && typeof window.AppSerializer.normalizeAllTargets === 'function') {
      try { return window.AppSerializer.normalizeAllTargets(nodesObj); } catch(e) { console.warn('AppSerializer.normalizeAllTargets failed', e); }
    }
    // Fallback conservador: no tocar nada para no perder referencias entre flujos ni propiedades personalizadas
    // Si se requiere normalización avanzada, se debe cargar AppSerializer.
    return nodesObj;
  }

  function generateFlowJson() {
    if (window.AppSerializer && typeof window.AppSerializer.generateFlowJson === 'function') {
      try { return window.AppSerializer.generateFlowJson(state); } catch(e) { console.warn('AppSerializer.generateFlowJson failed', e); }
    }
    // Minimal safe generator if serializer not available
    const nodesObj = {};
    for (const id in state.nodes) nodesObj[id] = normalizeNode(state.nodes[id]);
    try { normalizeAllTargets(nodesObj); } catch(e) { console.warn('normalizeAllTargets fallback failed', e); }
    const out = { ...state.meta, nodes: nodesObj };
    if (out.start_node && !nodesObj[out.start_node]) out.start_node = '';
    return out;
  }

  // Automatically expand the inner canvas to fit all nodes, with padding
  function autoGrowCanvas(padding = 1000) {
    try {
      if (!canvasInner) return;
      const nodes = canvasInner.querySelectorAll('.node');
      if (!nodes.length) return;
      let maxRight = 0, maxBottom = 0;
      nodes.forEach(el => {
        const left = parseFloat(el.style.left) || 0;
        const top = parseFloat(el.style.top) || 0;
        const width = el.offsetWidth || 180;
        const height = el.offsetHeight || 80;
        maxRight = Math.max(maxRight, (left + width));
        maxBottom = Math.max(maxBottom, (top + height));
      });
      const minW = baseCanvasWidth || canvasInner.scrollWidth || 8000;
      const minH = baseCanvasHeight || canvasInner.scrollHeight || 6000;
      const targetW = Math.max(minW, Math.ceil(maxRight + padding));
      const targetH = Math.max(minH, Math.ceil(maxBottom + padding));
      let changed = false;
      // Resize both directions (grow or shrink) but never below min base size
      if (Math.abs(targetW - canvasInner.scrollWidth) > 2) { canvasInner.style.width = targetW + 'px'; changed = true; }
      if (Math.abs(targetH - canvasInner.scrollHeight) > 2) { canvasInner.style.height = targetH + 'px'; changed = true; }
      if (changed) { try { if (typeof jsPlumb !== 'undefined') jsPlumb.repaintEverything(); } catch(e) {} }
  } catch(e) { console.warn('autoGrowCanvas failed', e); }
  }

  // Center viewport on the bounding box of all nodes (optionally fit zoom in future)
  function fitCanvasToContent(margin = 80) {
    if (!canvas || !canvasInner) return;
    try {
  const nodeEls = canvasInner.querySelectorAll('.node');
  if (!nodeEls || nodeEls.length === 0) {
        // No hay nodos: centrar vista por defecto sin tocar zoom
        const targetLeft = Math.max(0, Math.floor((canvasInner.scrollWidth - canvas.clientWidth) * 0.5));
        const targetTop = Math.max(0, Math.floor((canvasInner.scrollHeight - canvas.clientHeight) * 0.5));
        canvas.scrollLeft = targetLeft; canvas.scrollTop = targetTop; return;
      }
      let minLeft = Infinity, minTop = Infinity, maxRight = -Infinity, maxBottom = -Infinity;
      // medir en coordenadas del modelo luego aplicar zoom
      for (const el of nodeEls) {
        const left = parseFloat(el.style.left) || 0;
        const top = parseFloat(el.style.top) || 0;
        const width = el.offsetWidth || 180;
        const height = el.offsetHeight || 80;
        minLeft = Math.min(minLeft, left);
        minTop = Math.min(minTop, top);
        maxRight = Math.max(maxRight, left + width);
        maxBottom = Math.max(maxBottom, top + height);
      }
      if (!isFinite(minLeft) || !isFinite(minTop) || !isFinite(maxRight) || !isFinite(maxBottom)) return;
  const z = (typeof globalThis.AppUIState?.getZoom === 'function') ? globalThis.AppUIState.getZoom() : zoom;
      // aplicar márgenes y zoom a coordenadas de scroll
      const bboxWidth = Math.max(1, (maxRight - minLeft));
      const bboxHeight = Math.max(1, (maxBottom - minTop));
      const centerX = (minLeft + maxRight) / 2;
      const centerY = (minTop + maxBottom) / 2;
      const scrollX = Math.max(0, Math.floor(centerX * z - canvas.clientWidth / 2));
      const scrollY = Math.max(0, Math.floor(centerY * z - canvas.clientHeight / 2));
      canvas.scrollLeft = scrollX;
      canvas.scrollTop = scrollY;
      // si el bbox es mayor que el viewport, no ajustamos zoom automáticamente (evitar sorpresa);
      // podríamos ofrecer un botón futuro "Ajustar zoom al contenido".
      saveUiState();
    } catch(e) { console.warn('fitCanvasToContent failed', e); }
  }

  // Ensure a node is visible within the scrollable viewport with margin (in CSS px, pre-zoom)
  function ensureNodeVisible(node, margin = 80) {
    if (!canvas || !canvasInner || !node) return;
    try {
      const el = document.getElementById('node_' + node.id);
      if (!el) return;
      const z = (typeof window.AppUIState?.getZoom === 'function') ? window.AppUIState.getZoom() : 1;
      const left = (parseFloat(el.style.left) || 0) * z;
      const top = (parseFloat(el.style.top) || 0) * z;
      const width = (el.offsetWidth || 180) * z;
      const height = (el.offsetHeight || 80) * z;

      let targetLeft = canvas.scrollLeft;
      let targetTop = canvas.scrollTop;
      // Horizontal
      if (left < canvas.scrollLeft + margin) {
        targetLeft = Math.max(0, Math.floor(left - margin));
      } else if (left + width > canvas.scrollLeft + canvas.clientWidth - margin) {
        targetLeft = Math.max(0, Math.floor((left + width) - canvas.clientWidth + margin));
      }
      // Vertical
      if (top < canvas.scrollTop + margin) {
        targetTop = Math.max(0, Math.floor(top - margin));
      } else if (top + height > canvas.scrollTop + canvas.clientHeight - margin) {
        targetTop = Math.max(0, Math.floor((top + height) - canvas.clientHeight + margin));
      }
      if (targetLeft !== canvas.scrollLeft) canvas.scrollLeft = targetLeft;
      if (targetTop !== canvas.scrollTop) canvas.scrollTop = targetTop;
      saveUiState();
  } catch(e) { console.warn('ensureNodeVisible failed', e); }
  }

  // Canvas dragover & drop for creating new nodes or moving existing
  function setupCanvasDrag() {
    if (window.AppCanvasDrag && typeof window.AppCanvasDrag.init === 'function') {
      try {
        window.AppCanvasDrag.init({ canvas, canvasInner, renderNode, selectNode, createNode, getZoom: () => zoom, state, refreshOutput, showProperties, autoGrowCanvas });
        return;
      } catch(e) { console.warn('AppCanvasDrag.init failed', e); }
    }
    console.warn('AppCanvasDrag not available; canvas drag handlers not installed');
    
    document.querySelectorAll('#palette .draggable').forEach(el => {
      el.addEventListener('dragstart', (ev) => { ev.dataTransfer.setData('node-type', el.getAttribute('data-type')); ev.dataTransfer.setData('text/plain', el.getAttribute('data-type')); });
      el.addEventListener('click', (ev) => {
        const type = el.getAttribute('data-type'); if(!type) return;
        const rect = canvas.getBoundingClientRect(); const scrollLeft = canvas.scrollLeft || 0; const scrollTop = canvas.scrollTop || 0;
        const centerX = (rect.width / 2) + scrollLeft; const centerY = (rect.height / 2) + scrollTop;
        const x = centerX / zoom; const y = centerY / zoom;
        const node = createNode(type, x, y);
        document.getElementById('properties')?.classList.remove('collapsed');
        selectNode(node.id);
      });
    });
    canvas.addEventListener('click', (e) => { state.selectedId = null; showProperties(null); document.querySelectorAll('.node').forEach(nd => nd.style.outline = ''); document.getElementById('properties')?.classList.remove('force-visible'); });
  }

  // export JSON to file
  function exportJson() {
    if (window.AppIO?.exportJson) {
      try { return window.AppIO.exportJson?.(state, { generateFlowJson }); } catch(e) { console.warn('AppIO.exportJson failed', e); }
    }
    // fallback
    let out;
    try { out = generateFlowJson(); } catch (err) { console.warn('exportJson: failed to generate JSON', err); out = { error: 'failed to generate' }; }
    const data = JSON.stringify(out, null, 2);
    const blob = new Blob([data], {type:'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = (state.meta.name || 'flujo') + '.json'; document.body.appendChild(a); a.click(); a.remove();
  }

  // import JSON (object)
  function importJson(obj) {
    // Update current flow badge early
    const badge = document.getElementById('currentFlowBadge');
    if (badge) {
      const name = obj?.meta?.name || obj?.name || obj?.flow_id || 'flujo';
      const span = badge.querySelector('span:last-child');
      if (span) span.textContent = String(name);
    }
    // NOTE: intentionally do NOT delegate to AppIO.importJson here porque AppIO's
    // simple importer does not run the richer import-time heuristics (eg. inferring
    // loop.source_list). Keep the import logic local so the editor UI and simulator
    // remain in sync after loading a JSON flow.
    // Hard reset de jsPlumb para evitar estado obsoleto en reaperturas
    try {
      if (typeof jsPlumb !== 'undefined') {
        if (jsPlumb.reset) jsPlumb.reset();
        if (canvasInner && jsPlumb.setContainer) jsPlumb.setContainer(canvasInner);
        if (jsPlumb.importDefaults) {
          jsPlumb.importDefaults({
            Connector: ['Flowchart', { cornerRadius: 5 }],
            Endpoint: ['Dot', { radius: 5 }],
            PaintStyle: { stroke: '#456', strokeWidth: 2 },
            HoverPaintStyle: { stroke: '#f00', strokeWidth: 3 }
          });
        }
        try { if (window.AppConnections && typeof window.AppConnections.init === 'function') window.AppConnections.init(jsPlumb, canvasInner); } catch(_e){}
      }
    } catch(_e) { console.warn('jsPlumb reset during import failed', _e); }
    // fallback
    if (!obj?.nodes) return alert('JSON inválido (no se encontró nodes)');
    state.nodes = {};
  state.meta.flow_id = obj.flow_id || obj.meta?.flow_id || state.meta.flow_id;
  state.meta.version = obj.version || obj.meta?.version || state.meta.version;
  state.meta.name = obj.name || obj.meta?.name || state.meta.name;
  state.meta.description = obj.description || obj.meta?.description || state.meta.description;
  state.meta.locales = obj.locales || obj.meta?.locales || state.meta.locales;
  state.meta.start_node = obj.start_node || obj.meta?.start_node || state.meta.start_node;
    let migratedCount = 0;
    for(const id in obj.nodes) {
      const node = { ...obj.nodes[id] };
      // Migración: set_var → assign_var
      if (node.type === 'set_var') { node.type = 'assign_var'; migratedCount++; }
      // preserve incoming canvas position if provided, otherwise compute a modest layout
      if (node.x === undefined || node.x === null) node.x = 20 + (Object.keys(state.nodes).length * 30) % 400;
      if (node.y === undefined || node.y === null) node.y = 20 + (Object.keys(state.nodes).length * 20) % 300;
      // Migraciones: loop antiguo (iterExpr/itemVar) -> nuevo (source_list/item_var/index_var)
      if (node.type === 'loop') {
        if (!node.source_list && node.iterExpr) node.source_list = node.iterExpr;
        if (!node.item_var && node.itemVar) node.item_var = node.itemVar;
        if (!node.index_var) node.index_var = 'index';
      }
      state.nodes[id] = node;
    }
    if (migratedCount > 0) {
  try { if (window.Toasts && typeof window.Toasts.info === 'function') window.Toasts.info(`Se migraron ${migratedCount} nodos set_var a assign_var`); else alert(`Se migraron ${migratedCount} nodos set_var a assign_var`); } catch(e) { console.warn('Toasts.info failed', e); }
    }
    // Heurística: intentar inferir source_list para foreach/loop cuando viene vacío en el JSON
    let inferredNodes = [];
    try{
      const startId = obj.start_node || state.meta.start_node;
      const startNode = startId ? state.nodes[startId] : null;
      // construir un mapa de valores iniciales a partir de startNode.variables.defaultValue si están presentes
      const initialVars = {};
      if (startNode && Array.isArray(startNode.variables)) {
        startNode.variables.forEach(v => {
          let def = v.defaultValue;
          if (typeof def === 'string'){
            const s = def.trim();
            if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))){
              try{ def = JSON.parse(s); }catch(e){ /* keep as string */ }
            }
          }
          initialVars[v.name] = def;
        });
      }

      // helper: search recursively for array path whose elements (objects) contain a given key
      function findArrayPath(obj, key, basePath){
        if(!obj) return null;
        if(Array.isArray(obj)){
          if(obj.length>0 && obj[0] && typeof obj[0] === 'object' && (key in obj[0])) return basePath;
          return null;
        }
        if(typeof obj === 'object'){
          for(const k of Object.keys(obj)){
            const found = findArrayPath(obj[k], key, basePath ? (basePath + '.' + k) : k);
            if(found) return found;
          }
        }
        return null;
      }

      for(const nid in state.nodes){
        const n = state.nodes[nid];
        if(n && (n.type === 'foreach' || n.type === 'loop') && (!n.source_list || !String(n.source_list).trim()) && n.body_start && n.body_start.node_id){
          try{
            const body = state.nodes[n.body_start.node_id];
            if(body && body.type === 'response'){
              const raw = body.i18n && body.i18n[ (state.meta && state.meta.locales && state.meta.locales[0]) || 'en'] && Array.isArray(body.i18n[(state.meta && state.meta.locales && state.meta.locales[0]) || 'en'].text) ? body.i18n[state.meta.locales[0]].text.join('\n') : (body.text || '');
              const m = String(raw).match(/\{\{\s*([A-Za-z0-9_\.\s]+)\s*\}\}/);
              if(m && m[1]){
                const expr = m[1].trim().replace(/\s*\.\s*/g, '.');
                const parts = expr.split('.').filter(Boolean);
                if(parts.length >= 2){
                  // buscar en initialVars
                  const prop = parts[1];
                  for(const varName of Object.keys(initialVars)){
                    const path = findArrayPath(initialVars[varName], prop, varName);
                    if(path){
                      n.source_list = path;
                      try { console.debug('[importJson] inferred source_list for', nid, '->', n.source_list); } catch(e) {}
                      inferredNodes.push(nid);
                      break;
                    }
                  }
                }
              }
            }
          }catch(e){ console.warn('foreach infer loop failed', e); }
        }
      }
    }catch(e){ console.warn('infer source_list failed', e); }
  // Limpiar conexiones previas de jsPlumb antes de re-renderizar el lienzo
  try { if (typeof jsPlumb !== 'undefined' && jsPlumb.deleteEveryConnection) jsPlumb.deleteEveryConnection(); } catch(_e) { console.warn('deleteEveryConnection before import failed', _e); }
  canvasInner.innerHTML = '';
    for (const id in state.nodes) renderNode(state.nodes[id]);
  refreshConnections();
    refreshOutput();
  try { autoGrowCanvas(); } catch(e) { console.warn('autoGrowCanvas after import failed', e); }
    // Centrar viewport al contenido tras renderizar
    try {
      fitCanvasToContent();
      // Segundo intento tras leve delay por si tamaños cambian al terminar de pintar
      setTimeout(() => { try { fitCanvasToContent(); } catch(_e2){} }, 60);
    } catch(_e1) { console.warn('fitCanvasToContent after import failed', _e1); }
    // Refrescar conexiones nuevamente después de que el layout haya podido estabilizarse
    try {
      const st = window.App && window.App.state;
      if (st && window.AppConnections && typeof window.AppConnections.refreshConnections === 'function') {
        // Inmediato (cola)
        setTimeout(() => { try { window.AppConnections.refreshConnections(st); } catch(_e) {} }, 0);
        // Un poco después para cubrir imágenes/transiciones
        setTimeout(() => { try { window.AppConnections.refreshConnections(st); } catch(_e) {} }, 120);
        setTimeout(() => { try { window.AppConnections.refreshConnections(st); } catch(_e) {} }, 300);
        setTimeout(() => { try { window.AppConnections.refreshConnections(st); } catch(_e) {} }, 500);
      }
    } catch(_r) { /* noop */ }
    // Ensure current flow badge reflects state meta name if changed by import
    try {
      const badge = document.getElementById('currentFlowBadge');
      if (badge) {
        const name = state.meta?.name || state.meta?.flow_id || 'flujo';
        const span = badge.querySelector('span:last-child');
        if (span) span.textContent = String(name);
      }
    } catch(_e) {}
    // If we inferred one or more nodes, select the first inferred node so the user sees the autocompleted value.
    try {
      if (inferredNodes && inferredNodes.length) {
        selectNode(inferredNodes[0]);
      } else if (state.selectedId && state.nodes[state.selectedId]) {
        // otherwise re-select previous to refresh properties panel
        selectNode(state.selectedId);
      }
  } catch(e) { console.warn('post-import selection failed', e); }
  }

  // load example via fetch
  function loadExample() {
    if (window.AppIO && typeof window.AppIO.loadExample === 'function') {
      try { return window.AppIO.loadExample(state, { canvasInner, renderNode, refreshConnections, refreshOutput }); } catch(e) { console.warn('AppIO.loadExample failed', e); }
    }
    fetch('data/ejemplo.json').then(r => r.json()).then(obj => importJson(obj)).catch(err => alert('No se pudo cargar ejemplo: ' + err));
  }

  // Wire snap/grid controls in header if present (safe no-op if elements are missing)
  function wireSnapControls(){
    try {
      const snapEl = document.getElementById('toggleSnap');
      const gridEl = document.getElementById('gridSizeInput');
      if (snapEl) {
        snapEl.checked = getSnapEnabled();
        snapEl.addEventListener('change', () => setSnapEnabled(snapEl.checked));
      }
      if (gridEl) {
        gridEl.value = String(getGridSize());
        gridEl.addEventListener('change', () => setGridSize(gridEl.value));
      }
  } catch(e) { console.warn('wireSnapControls failed', e); }
  }

  // wire UI: delega a AppUI.setupUI si está presente
  function setupUI() {
    if (window.AppUI && typeof window.AppUI.setupUI === 'function') {
      try {
        window.AppUI.setupUI(state, {
          canvas,
          canvasInner,
          exportJson,
          importJson,
          createNode,
          selectNode,
          refreshOutput,
          setZoom: setZoom,
          getZoom: () => zoom,
          saveUiState,
          loadExample,
          showProperties
        });
        // Do not return here; we still want to wire local header controls
      } catch(e) { console.warn('AppUI.setupUI failed', e); }
    }
    console.warn('AppUI.setupUI not available; UI controls may be disabled');
    wireSnapControls();
  }

  // init
  function init() {
    // initialize DOM references (ensure elements exist)
  canvas = document.getElementById('canvas');
  canvasInner = document.getElementById('canvasInner');
  jsonOutput = document.getElementById('jsonOutput');

    setupCanvasDrag();
    setupUI();
    refreshOutput();
    // initialize AppUIState (if present) with canvas refs so its setZoom can apply transform
    if (window.AppUIState && typeof window.AppUIState.init === 'function') {
      try { window.AppUIState.init({ canvas, canvasInner }); } catch(e) { console.warn('AppUIState.init failed', e); }
    }
    // initialize zoom label and transform
    setZoom(1);
    // restore UI state (collapsed panels, zoom, scroll)
    restoreUiState();
  // ensure canvas fits current nodes on init
  try { autoGrowCanvas(); } catch(e) { console.warn('autoGrowCanvas on init failed', e); }
    // record base size from CSS after initial layout
    try {
      baseCanvasWidth = canvasInner.scrollWidth;
      baseCanvasHeight = canvasInner.scrollHeight;
  } catch(e) { console.warn('record base canvas size failed', e); }
    // Observa cambios de tamaño del canvas interno y reintenta refrescar conexiones
    try {
      if (canvasInner && typeof ResizeObserver !== 'undefined') {
        let roTimer = null;
        const ro = new ResizeObserver(() => {
          try { if (roTimer) clearTimeout(roTimer); } catch(_e){}
          roTimer = setTimeout(() => {
            try { if (window.AppConnections?.refreshConnections) window.AppConnections.refreshConnections(state); } catch(_e2){}
          }, 60);
        });
        ro.observe(canvasInner);
      } else {
        // Como fallback, al cerrar el modal/otros triggers se suele disparar resize de ventana
        window.addEventListener('resize', () => {
          try { if (window.AppConnections?.refreshConnections) window.AppConnections.refreshConnections(state); } catch(_e){}
        });
      }
    } catch(err) { console.warn('ResizeObserver setup failed', err); }
    // Inicializar NodeFactory si está disponible (debe hacerse antes de crear nodos)
    if (window.AppNodeFactory && typeof window.AppNodeFactory.init === 'function') {
      try { window.AppNodeFactory.init({ state, renderNode, selectNode, refreshOutput }); } catch(e) { console.warn('AppNodeFactory.init failed', e); }
    }
    // No crear Start automáticamente: el usuario lo agregará desde la paleta cuando lo necesite.
    // Inicializar jsPlumb
    if (typeof jsPlumb !== 'undefined') {
      jsPlumb.ready(function() {
  jsPlumb.setContainer(canvasInner);
          jsPlumbReadyFlag = true;
        // Initialize AppConnections module so it can store jsPlumb reference
        try {
          if (window.AppConnections && typeof window.AppConnections.init === 'function') {
            window.AppConnections.init(jsPlumb, canvasInner);
          }
        } catch(e) { console.warn('AppConnections.init invocation failed', e); }
        // Configurar defaults para conexiones
        jsPlumb.importDefaults({
          Connector: ['Flowchart', { cornerRadius: 5 }],
          Endpoint: ['Dot', { radius: 5 }],
          PaintStyle: { stroke: '#456', strokeWidth: 2 },
          HoverPaintStyle: { stroke: '#f00', strokeWidth: 3 }
        });
        // Agregar endpoints a nodos existentes
        for (const id in state.nodes) {
          addEndpoints(id);
        }
        // Dibujar conexiones existentes
        refreshConnections();
  // Intento extra tras el primer paint de jsPlumb
  try { setTimeout(() => { if (window.AppConnections?.refreshConnections) window.AppConnections.refreshConnections(state); }, 80); } catch(_e){}
        // Escuchar conexiones (opcional, pero como ahora se hace via form, quizás no necesario)
        // jsPlumb.bind('connection', function(info) {
        //   const sourceId = info.sourceId.replace('node_', '');
        //   const targetId = info.targetId.replace('node_', '');
        //   if (state.nodes[sourceId] && !state.nodes[sourceId].options) {
        //     state.nodes[sourceId].next = { flow_id: state.meta.flow_id, node_id: targetId };
        //     refreshOutput();
        //   }
        // });
        jsPlumb.bind('connectionDetached', function(info) {
          // No hacer nada, ya que se maneja via form
        });
      });
    } else {
      console.warn('jsPlumb no está cargado');
    }
  }

  return { init, createNode, state, importJson, generateFlowJson, refreshOutput, autoGrowCanvas, ensureNodeVisible, fitCanvasToContent, getSnapEnabled, getGridSize, applyNodeChanges };
})();

// Expose App to window for debugging and external control (importing flows, refresh, etc.)
try { window.App = App; console.debug('[main] App expuesto en window.App'); } catch(e) {}
document.addEventListener('DOMContentLoaded', () => App.init());
