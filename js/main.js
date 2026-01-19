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
      try { window.AppConnections.addEndpoints(state, nodeId); return; } catch (e) { console.warn('AppConnections.addEndpoints failed', e); }
    }
    // fallback to local implementation if module not present
    if (typeof jsPlumb === 'undefined' || !jsPlumbReadyFlag) return;
    const elId = 'node_' + nodeId;
    const el = document.getElementById(elId);
    if (!el) {
      if (window.App && window.App.debug) console.debug('[main] addEndpoints skipped - element missing', elId);
      return;
    }
    try { jsPlumb.removeAllEndpoints(elId); } catch (e) { console.warn('removeAllEndpoints failed for', nodeId, e); }
    const node = state.nodes[nodeId];
    if (!node || node.type !== 'end') {
      ['Top', 'Bottom', 'Left', 'Right'].forEach(anchor => { try { jsPlumb.addEndpoint(elId, { anchor, isSource: true, maxConnections: -1 }); } catch (e) { console.warn('jsPlumb.addEndpoint failed', elId, anchor, e); } });
    }
    if (!node || node.type !== 'start') {
      ['Top', 'Bottom', 'Left', 'Right'].forEach(anchor => { try { jsPlumb.addEndpoint(elId, { anchor, isTarget: true, maxConnections: -1 }); } catch (e) { console.warn('jsPlumb.addEndpoint failed', elId, anchor, e); } });
    }
  }

  // Zoom state (managed by AppUIState if available)
  let zoom = 1;
  // Simple debug flag for centering math
  const DEBUG_CENTER = !!(window && window.APP_DEBUG_CENTER);
  function dlog(...args) { if (DEBUG_CENTER) try { console.log('[center]', ...args); } catch (_) { } }
  function getSnapEnabled() { return !!state.meta?.ui?.snapEnabled; }
  function setSnapEnabled(v) { if (!state.meta.ui) state.meta.ui = {}; state.meta.ui.snapEnabled = !!v; saveUiState(); }
  function getGridSize() { return Math.max(5, Math.min(200, Number(state.meta?.ui?.gridSize || 20))); }
  function setGridSize(v) { if (!state.meta.ui) state.meta.ui = {}; state.meta.ui.gridSize = Math.max(5, Math.min(200, Number(v || 20))); saveUiState(); }
  function setZoom(z) {
    if (window.AppUIState && typeof window.AppUIState.setZoom === 'function') {
      try { window.AppUIState.setZoom(z); zoom = window.AppUIState.getZoom(); return; } catch (e) { console.warn('AppUIState.setZoom failed', e); }
    }
    zoom = Math.max(0.2, Math.min(2, z));
    if (canvasInner) canvasInner.style.transform = `scale(${zoom})`;
    try { if (typeof jsPlumb !== 'undefined' && typeof jsPlumb.setZoom === 'function') jsPlumb.setZoom(zoom); } catch (e) { /* noop */ }
    const lbl = document.getElementById('zoomLabel'); if (lbl) lbl.textContent = Math.round(zoom * 100) + '%';
    try { if (typeof jsPlumb !== 'undefined') jsPlumb.repaintEverything(); } catch (e) { console.warn('repaintEverything failed', e); }
    try { autoGrowCanvas(); } catch (e) { console.warn('autoGrowCanvas from setZoom failed', e); }
    saveUiState();
  }

  // persist UI state (moved to module scope so other functions can call it)
  function saveUiState() {
    if (window.AppUIState && typeof window.AppUIState.saveUiState === 'function') {
      try { return window.AppUIState.saveUiState(); } catch (e) { console.warn('AppUIState.saveUiState failed', e); }
    }
    try {
      const stateToSave = {
        collapsed: Array.from(document.querySelectorAll('aside')).filter(a => a.classList.contains('collapsed')).map(a => a.id),
        zoom,
        scroll: { left: canvas?.scrollLeft || 0, top: canvas?.scrollTop || 0 },
        snap: getSnapEnabled(),
        grid: getGridSize()
      };
      localStorage.setItem('editorUiState', JSON.stringify(stateToSave));
    } catch (e) { console.warn('saveUiState failed', e); }
  }

  // restore UI state (separate function to keep init() simpler)
  function restoreUiState() {
    if (window.AppUIState && typeof window.AppUIState.restoreUiState === 'function') {
      try { return window.AppUIState.restoreUiState(); } catch (e) { console.warn('AppUIState.restoreUiState failed', e); }
    }
    try {
      const raw = localStorage.getItem('editorUiState');
      if (raw) {
        const s = JSON.parse(raw);
        applySavedState(s);
      } else {
        applyDefaultUiState();
      }
    } catch (e) { console.warn('restoreUiState failed', e); }
  }

  function applySavedState(s) {
    if (window.AppUIState && typeof window.AppUIState.applySavedState === 'function') {
      try { return window.AppUIState.applySavedState(s); } catch (e) { console.warn('AppUIState.applySavedState failed', e); }
    }
    if (!s) return;
    if (s.collapsed && Array.isArray(s.collapsed)) s.collapsed.forEach(id => { const el = document.getElementById(id); if (el) el.classList.add('collapsed'); });
    if (s.zoom) setZoom(s.zoom);
    if (s.scroll) { canvas.scrollLeft = s.scroll.left || 0; canvas.scrollTop = s.scroll.top || 0; }
    if (s.snap !== undefined) setSnapEnabled(!!s.snap);
    if (s.grid !== undefined) setGridSize(Number(s.grid));
    // sync header controls if present
    try {
      const snapEl = document.getElementById('toggleSnap'); if (snapEl) snapEl.checked = getSnapEnabled();
      const gridEl = document.getElementById('gridSizeInput'); if (gridEl) gridEl.value = String(getGridSize());
    } catch (e) { console.warn('applySavedState header sync failed', e); }

  }

  function applyDefaultUiState() {
    if (window.AppUIState && typeof window.AppUIState.applyDefaultUiState === 'function') {
      try { return window.AppUIState.applyDefaultUiState(); } catch (e) { console.warn('AppUIState.applyDefaultUiState failed', e); }
    }
    const palette = document.getElementById('palette'); if (palette) palette.classList.remove('collapsed');
    const props = document.getElementById('properties'); if (props) props.classList.remove('collapsed');
    try {
      if (canvas && canvasInner) {
        // center by default (horizontalBias 0.5 puts middle of canvas in center)
        const horizontalBias = 0.5;
        const targetLeft = Math.max(0, Math.floor((canvasInner.scrollWidth - canvas.clientWidth) * horizontalBias));
        const targetTop = Math.max(0, Math.floor((canvasInner.scrollHeight - canvas.clientHeight) * 0.5));
        canvas.scrollLeft = targetLeft;
        canvas.scrollTop = targetTop;
      }
    } catch (err) { console.warn('initial center scroll failed', err); }
  }

  // previously there was a helper here; removed to avoid unused symbol

  // refresh connections based on next and targets
  function refreshConnections() {
    if (window.AppConnections && typeof window.AppConnections.refreshConnections === 'function') {
      try { window.AppConnections.refreshConnections(state); return; } catch (e) { console.warn('AppConnections.refreshConnections failed', e); }
    }
    if (typeof jsPlumb === 'undefined') return;
    try { if (jsPlumb.setSuspendDrawing) jsPlumb.setSuspendDrawing(true); } catch (e) { console.warn('suspendDrawing(true) failed', e); }
    try { if (jsPlumb.deleteEveryConnection) jsPlumb.deleteEveryConnection(); } catch (e) { console.warn('deleteEveryConnection failed', e); }
    for (const id in state.nodes) addEndpoints(id);
    // fallback simple reconnect (kept minimal since AppConnections covers full behavior)
    try { if (jsPlumb.repaintEverything) jsPlumb.repaintEverything(); } catch (e) { console.warn('repaintEverything failed', e); }
    try { if (jsPlumb.setSuspendDrawing) jsPlumb.setSuspendDrawing(false, true); } catch (e) { console.warn('suspendDrawing(false) failed', e); }
  }

  // create node object
  function createNode(type, x = 20, y = 20) {
    if (window.AppNodeFactory && typeof window.AppNodeFactory.createNode === 'function') {
      try { return window.AppNodeFactory.createNode(type, x, y); } catch (e) { console.error('AppNodeFactory.createNode failed', e); }
    } else {
      console.error('AppNodeFactory not available');
    }
  }

  // Render a node DOM in canvas (delegates to AppRenderer or AppHelpers)
  function renderNode(node) {
    // Assumes AppRenderer is loaded before main.js (index.html ordering)
    try { window.AppRenderer.renderNode(state, node, canvasInner, zoom, addEndpoints, selectNode); return; } catch (e) { console.error('AppRenderer.renderNode failed', e); throw e; }
  }
  function selectNode(id) {
    if (window.AppSelectionManager) {
      window.AppSelectionManager.select(id);
      return;
    }
    // Legacy fallback
    // Assumes AppRenderer is loaded before main.js (index.html ordering)
    try { window.AppRenderer.selectNode(state, id, canvas, showProperties); return; } catch (e) { console.error('AppRenderer.selectNode failed', e); throw e; }
  }

  function showProperties(node) {
    console.log('[main] showProperties called with node:', node);
    if (window.AppEditor && typeof window.AppEditor.showProperties === 'function') {
      try { window.AppEditor.showProperties(state, node, { selectNode, renderVariables, collectVariables, refreshOutput }); return; } catch (e) { console.warn('AppEditor.showProperties failed', e); }
    }
    console.warn('AppEditor.showProperties not available; properties UI disabled');
  }

  // Recolecta nombres de variables en el flujo (save_as y assign_var.name)
  function collectVariables() {
    if (window.AppVariables && typeof window.AppVariables.collectVariables === 'function') {
      try { return window.AppVariables.collectVariables(state); } catch (e) { console.warn('AppVariables.collectVariables failed', e); }
    }
    const startId = state.meta.start_node; const list = [];
    if (startId && Array.isArray(state.nodes[startId]?.variables)) state.nodes[startId].variables.forEach(v => { if (v?.name) list.push(v.name); });
    for (const id in state.nodes) { const n = state.nodes[id]; if (n.save_as) list.push(n.save_as); if (n.type === 'assign_var' && n.name) list.push(n.name); }
    return Array.from(new Set(list));
  }

  function renderVariables() {
    if (window.AppVariables && typeof window.AppVariables.renderVariables === 'function') {
      try { return window.AppVariables.renderVariables(state, selectNode); } catch (e) { console.warn('AppVariables.renderVariables failed', e); }
    }
    const el = document.getElementById('variablesList'); if (!el) return;
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
  try { window.renderVariables = renderVariables; console.debug('[main] renderVariables expuesta'); } catch (e) { }

  // asegurar render inicial al cargar DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { try { renderVariables(); console.debug('[main] DOMContentLoaded -> renderVariables'); } catch (e) { } });
  } else {
    try { renderVariables(); console.debug('[main] ready -> renderVariables'); } catch (e) { }
  }

  // Aplica los cambios leídos al nodo: delega a AppEditor si está presente
  function applyNodeChanges(node, newId, values) {
    if (window.AppEditor && typeof window.AppEditor.applyNodeChanges === 'function') {
      try { window.AppEditor.applyNodeChanges(state, node, newId, values, { renderNode, selectNode, refreshOutput }); return; } catch (e) { console.warn('AppEditor.applyNodeChanges failed', e); }
    }
    console.warn('AppEditor.applyNodeChanges not available; changes not applied');
  }
  // expose for other modules to call and to avoid unused function warning
  try { window.applyNodeChanges = applyNodeChanges; } catch (e) { }

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
      try { return window.AppSerializer.normalizeNode(n); } catch (e) { console.warn('AppSerializer.normalizeNode failed', e); }
    }
    // Fallback más seguro: clonar el nodo completo para no perder propiedades
    try { return JSON.parse(JSON.stringify(n)); } catch (_e) { return { id: n.id, type: n.type }; }
  }

  function normalizeAllTargets(nodesObj) {
    if (window.AppSerializer && typeof window.AppSerializer.normalizeAllTargets === 'function') {
      try { return window.AppSerializer.normalizeAllTargets(nodesObj); } catch (e) { console.warn('AppSerializer.normalizeAllTargets failed', e); }
    }
    // Fallback conservador: no tocar nada para no perder referencias entre flujos ni propiedades personalizadas
    // Si se requiere normalización avanzada, se debe cargar AppSerializer.
    return nodesObj;
  }

  function generateFlowJson() {
    if (window.AppSerializer && typeof window.AppSerializer.generateFlowJson === 'function') {
      try { return window.AppSerializer.generateFlowJson(state); } catch (e) { console.warn('AppSerializer.generateFlowJson failed', e); }
    }
    // Minimal safe generator if serializer not available
    const nodesObj = {};
    for (const id in state.nodes) nodesObj[id] = normalizeNode(state.nodes[id]);
    try { normalizeAllTargets(nodesObj); } catch (e) { console.warn('normalizeAllTargets fallback failed', e); }
    const out = { ...state.meta, nodes: nodesObj };
    if (out.start_node && !nodesObj[out.start_node]) out.start_node = '';
    return out;
  }

  // Automatically expand the inner canvas to fit all nodes, with padding
  function autoGrowCanvas(padding = 1000) {
    if (window.AppCanvasManager && typeof window.AppCanvasManager.autoGrowCanvas === 'function') {
      return window.AppCanvasManager.autoGrowCanvas(padding);
    }
  }

  // Center viewport on the bounding box of all nodes.
  function fitCanvasToContent(margin = 80, adjustZoom = true) {
    if (window.AppCanvasManager && typeof window.AppCanvasManager.fitCanvasToContent === 'function') {
      return window.AppCanvasManager.fitCanvasToContent(state, margin, adjustZoom);
    }
  }

  // Ensure a node is visible within the scrollable viewport with margin
  function ensureNodeVisible(node, margin = 80) {
    if (window.AppCanvasManager && typeof window.AppCanvasManager.ensureNodeVisible === 'function') {
      return window.AppCanvasManager.ensureNodeVisible(node, margin);
    }
  }

  // Canvas dragover & drop for creating new nodes or moving existing
  function setupCanvasDrag() {
    if (window.AppCanvasDrag && typeof window.AppCanvasDrag.init === 'function') {
      try {
        window.AppCanvasDrag.init({ canvas, canvasInner, renderNode, selectNode, createNode, getZoom: () => zoom, state, refreshOutput, showProperties, autoGrowCanvas });
        return;
      } catch (e) { console.warn('AppCanvasDrag.init failed', e); }
    }
    console.warn('AppCanvasDrag not available; canvas drag handlers not installed');

    canvas.addEventListener('click', (e) => { state.selectedId = null; showProperties(null); document.querySelectorAll('.node').forEach(nd => nd.style.outline = ''); document.getElementById('properties')?.classList.remove('force-visible'); });
  }

  // export JSON to file
  function exportJson() {
    if (window.AppIO?.exportJson) {
      try { return window.AppIO.exportJson?.(state, { generateFlowJson }); } catch (e) { console.warn('AppIO.exportJson failed', e); }
    }
    // fallback
    let out;
    try { out = generateFlowJson(); } catch (err) { console.warn('exportJson: failed to generate JSON', err); out = { error: 'failed to generate' }; }
    const data = JSON.stringify(out, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = (state.meta.name || 'flujo') + '.json'; document.body.appendChild(a); a.click(); a.remove();
  }

  // import JSON (object)
  function importJson(obj) {
    if (window.AppFlowImporter && typeof window.AppFlowImporter.importJson === 'function') {
      try {
        window.AppFlowImporter.importJson(obj, state, {
          renderNode, refreshConnections, refreshOutput, selectNode,
          autoGrowCanvas, fitCanvasToContent, canvasInner
        });
        return;
      } catch (e) { console.warn('AppFlowImporter.importJson failed', e); }
    }
    alert('No se pudo importar el flujo (AppFlowImporter no disponible)');
  }

  // load example via fetch
  function loadExample() {
    if (window.AppIO && typeof window.AppIO.loadExample === 'function') {
      try { return window.AppIO.loadExample(state, { canvasInner, renderNode, refreshConnections, refreshOutput }); } catch (e) { console.warn('AppIO.loadExample failed', e); }
    }
    fetch('data/ejemplo.json').then(r => r.json()).then(obj => importJson(obj)).catch(err => alert('No se pudo cargar ejemplo: ' + err));
  }

  // Wire snap/grid controls in header if present (safe no-op if elements are missing)
  function wireSnapControls() {
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
    } catch (e) { console.warn('wireSnapControls failed', e); }
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
      } catch (e) { console.warn('AppUI.setupUI failed', e); }
    } else {
      console.warn('AppUI.setupUI not available; UI controls may be disabled');
    }
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
      try { window.AppUIState.init({ canvas, canvasInner }); } catch (e) { console.warn('AppUIState.init failed', e); }
    }
    // initialize zoom label and transform
    setZoom(1);
    // restore UI state (collapsed panels, zoom, scroll)
    restoreUiState();
    // ensure canvas fits current nodes on init
    try { autoGrowCanvas(); } catch (e) { console.warn('autoGrowCanvas on init failed', e); }
    // initialize AppCanvasManager
    if (window.AppCanvasManager && typeof window.AppCanvasManager.init === 'function') {
      window.AppCanvasManager.init({ canvas, canvasInner, getZoom: () => zoom, setZoom, saveUiState });
    }
    // ResizeObserver moved to AppCanvasManager
    // Initialize AppFlowManager
    if (window.AppFlowManager && typeof window.AppFlowManager.init === 'function') {
      window.AppFlowManager.init(state, { createNode, renderNode, selectNode, refreshOutput });
    }

    // Inicializar NodeFactory si está disponible (debe hacerse antes de crear nodos)
    if (window.AppNodeFactory && typeof window.AppNodeFactory.init === 'function') {
      try { window.AppNodeFactory.init({ state, renderNode, selectNode, refreshOutput }); } catch (e) { console.warn('AppNodeFactory.init failed', e); }
    }

    // Inicializar HistoryManager
    if (window.AppHistoryManager && typeof window.AppHistoryManager.init === 'function') {
      try {
        window.AppHistoryManager.init(state, { refreshOutput, renderNode, selectNode });
        console.log('[main] HistoryManager initialized');
      } catch (e) { console.warn('AppHistoryManager.init failed', e); }
    }

    // Inicializar NodeSearch
    if (window.AppNodeSearch && typeof window.AppNodeSearch.init === 'function') {
      try {
        window.AppNodeSearch.init(state, { selectNode, ensureNodeVisible });
        console.log('[main] NodeSearch initialized');
      } catch (e) { console.warn('AppNodeSearch.init failed', e); }
    }

    // Initialize Selection Manager
    if (window.AppSelectionManager && typeof window.AppSelectionManager.init === 'function') {
      try {
        window.AppSelectionManager.init(state, {
          renderNode,
          onSelectionChanged: (ids) => {
            // Optional: Update UI or log
            console.log('Selection changed:', ids);
            // Force refresh of keyboard controls context if needed
          }
        });
        console.log('[main] SelectionManager initialized');
      } catch (e) { console.warn('AppSelectionManager.init failed', e); }
    }

    // Initialize Canvas Selection (Lasso)
    if (window.AppCanvasSelection && typeof window.AppCanvasSelection.init === 'function') {
      try {
        window.AppCanvasSelection.init({ canvas, state });
        console.log('[main] CanvasSelection initialized');
      } catch (e) { console.warn('AppCanvasSelection.init failed', e); }
    }

    // No crear Start automáticamente: el usuario lo agregará desde la paleta cuando lo necesite.
    // Inicializar jsPlumb
    if (typeof jsPlumb !== 'undefined') {
      jsPlumb.ready(function () {
        jsPlumb.setContainer(canvasInner);
        jsPlumbReadyFlag = true;
        // Initialize AppConnections module so it can store jsPlumb reference
        try {
          if (window.AppConnections && typeof window.AppConnections.init === 'function') {
            window.AppConnections.init(jsPlumb, canvasInner);
          }
        } catch (e) { console.warn('AppConnections.init invocation failed', e); }
        // Configurar defaults para conexiones
        jsPlumb.importDefaults({
          Connector: ['StateMachine', { margin: 5, curviness: 10, proximityLimit: 80 }],
          Endpoint: ['Dot', { radius: 4 }],
          PaintStyle: { stroke: '#5c7cfa', strokeWidth: 2 },
          HoverPaintStyle: { stroke: '#1c7ed6', strokeWidth: 3 },
          ConnectionOverlays: [
            ['Arrow', { location: 1, id: 'arrow', width: 10, length: 10 }]
          ]
        });
        // Agregar endpoints a nodos existentes
        for (const id in state.nodes) {
          addEndpoints(id);
        }
        // Dibujar conexiones existentes
        refreshConnections();
        // Intento extra tras el primer paint de jsPlumb
        try { setTimeout(() => { if (window.AppConnections?.refreshConnections) window.AppConnections.refreshConnections(state); }, 80); } catch (_e) { }
        // Escuchar conexiones (opcional, pero como ahora se hace via form, quizás no necesario)
        // jsPlumb.bind('connection', function(info) {
        //   const sourceId = info.sourceId.replace('node_', '');
        //   const targetId = info.targetId.replace('node_', '');
        //   if (state.nodes[sourceId] && !state.nodes[sourceId].options) {
        //     state.nodes[sourceId].next = { flow_id: state.meta.flow_id, node_id: targetId };
        //     refreshOutput();
        //   }
        // });
        jsPlumb.bind('connectionDetached', function (info) {
          // No hacer nada, ya que se maneja via form
        });
      });
    } else {
      console.warn('jsPlumb no está cargado');
    }
  }

  // --- Keyboard Controls Integration ---
  if (window.AppKeyboardControls && typeof window.AppKeyboardControls.init === 'function') {
    try {
      window.AppKeyboardControls.init({
        state,
        renderNode,
        refreshOutput,
        selectNode,
        deleteNode: (id) => {
          if (window.AppFlowManager && window.AppFlowManager.deleteNode) {
            window.AppFlowManager.deleteNode(id);
          } else {
            console.warn('AppFlowManager.deleteNode not available');
          }
        },
        duplicateNode: (id) => {
          if (window.AppFlowManager && window.AppFlowManager.duplicateNode) {
            window.AppFlowManager.duplicateNode(id);
          } else {
            console.warn('AppFlowManager.duplicateNode not available');
          }
        }
      });
    } catch (e) { console.warn('AppKeyboardControls init failed', e); }
  }

  return { init, createNode, state, importJson, generateFlowJson, refreshOutput, autoGrowCanvas, ensureNodeVisible, fitCanvasToContent, getSnapEnabled, getGridSize, applyNodeChanges, showProperties };
})();

// Expose App to window for debugging and external control (importing flows, refresh, etc.)
try { window.App = App; console.debug('[main] App expuesto en window.App'); } catch (e) { }

document.addEventListener('DOMContentLoaded', () => {
  if (typeof jsPlumb !== 'undefined') {
    jsPlumb.ready(() => {
      console.log('[main] jsPlumb ready, initializing App...');
      App.init();
    });
  } else {
    console.warn('[main] jsPlumb not found, initializing App without it...');
    App.init();
    // --- AI Copilot Initialization ---
    console.log('[Main] Checking for Copilot modules...', {
      CopilotCore: !!window.CopilotCore,
      CopilotUI: !!window.CopilotUI,
      AzureCopilotProvider: !!window.AzureCopilotProvider,
      LocalCopilotProvider: !!window.LocalCopilotProvider
    });

    if (window.CopilotCore && window.CopilotUI) {
      console.log('[Main] Copilot modules found, initializing...');
      // Configuration for Azure (To be filled by user or env)
      const azureConfig = {
        endpoint: localStorage.getItem('bri_azure_endpoint') || '',
        apiKey: localStorage.getItem('bri_azure_key') || ''
      };

      let provider;
      if (azureConfig.endpoint && azureConfig.apiKey && window.AzureCopilotProvider) {
        console.log('[Copilot] Using Azure Provider');
        provider = new window.AzureCopilotProvider(azureConfig);
      } else if (window.LocalCopilotProvider) {
        console.log('[Copilot] Using Local Provider (Mock)');
        provider = new window.LocalCopilotProvider();
      }

      if (provider) {
        console.log('[Main] Creating CopilotService...');
        const service = new window.CopilotCore.CopilotService(provider, App.flowManager);
        console.log('[Main] Calling CopilotUI.init...');
        window.CopilotUI.init(service);
        console.log('[Main] AI Copilot initialized');
      } else {
        console.warn('[Main] No copilot provider available');
      }
    } else {
      console.warn('[Main] Copilot modules not found');
    }

  }
});
