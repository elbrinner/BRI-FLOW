// canvas_drag.js
// Maneja drag & drop en el canvas: mover nodos y crear desde la paleta
(function(){
  let canvas, renderNode, selectNode, createNode, zoomRef, stateRef, refreshOutput;
  let autoGrow;
  function getGrid(){ return (window.App && typeof window.App.getGridSize==='function') ? window.App.getGridSize() : 20; }
  function isSnap(){ return (window.App && typeof window.App.getSnapEnabled==='function') ? window.App.getSnapEnabled() : true; }
  function snap(v){ const g = getGrid(); return Math.round(v / g) * g; }
  const ALLOWED_TYPES = ['response','input','choice','choice_switch','rest_call','hero_card','carousel','form','file_upload','json_export','file_download','condition','loop','end','start','foreach','while','flow_jump','set_goto'];

  // Helpers to reduce complexity
  function getCanvasCoordsFromEvent(e, offsetX = 0, offsetY = 0){
    const rect = canvas.getBoundingClientRect();
    const scrollLeft = canvas.scrollLeft || 0;
    const scrollTop = canvas.scrollTop || 0;
    const z = (zoomRef && typeof zoomRef === 'function') ? (zoomRef() || 1) : 1;
  const x = ((e.clientX - rect.left) + scrollLeft - offsetX) / z;
  const y = ((e.clientY - rect.top) + scrollTop - offsetY) / z;
  if (!isSnap()) return { x, y };
  return { x: snap(x), y: snap(y) };
  }

  function handleMoveExistingNodeDrop(nodeId, e){
    const offX = parseInt(e.dataTransfer.getData('dragOffsetX') || '0');
    const offY = parseInt(e.dataTransfer.getData('dragOffsetY') || '0');
    const { x, y } = getCanvasCoordsFromEvent(e, offX, offY);
    const n = stateRef.nodes[nodeId];
    n.x = x; n.y = y;
    renderNode(n);
    selectNode(nodeId);
    refreshOutput();
    if (autoGrow) autoGrow();
  }

  function handleCreateNodeDrop(type, e){
    const { x, y } = getCanvasCoordsFromEvent(e);
    const n = createNode(type, x, y);
    if (autoGrow) autoGrow();
    if (window.App && typeof window.App.ensureNodeVisible === 'function') window.App.ensureNodeVisible(n, 120);
  }

  function init(opts){
    canvas = opts.canvas || document.getElementById('canvas');
  // canvasInner not needed here; we operate on state + DOM directly
    renderNode = opts.renderNode; selectNode = opts.selectNode; createNode = opts.createNode; zoomRef = opts.getZoom; stateRef = opts.state; refreshOutput = opts.refreshOutput;
    autoGrow = (opts.autoGrowCanvas || (window.App && typeof window.App.autoGrowCanvas === 'function' && window.App.autoGrowCanvas)) || null;

    canvas.addEventListener('dragover', (e) => { e.preventDefault(); });

    canvas.addEventListener('drop', (e) => {
      e.preventDefault();
      const dt = e.dataTransfer.getData('text/plain');
      if (dt && stateRef.nodes[dt]) return handleMoveExistingNodeDrop(dt, e);
      const t = e.dataTransfer.getData('node-type');
      if (t) return handleCreateNodeDrop(t, e);
      const type = e.dataTransfer.getData('type') || e.dataTransfer.getData('node-type') || e.dataTransfer.getData('text/plain');
      if (type && typeof type === 'string' && !stateRef.nodes[type] && ALLOWED_TYPES.includes(type)) return handleCreateNodeDrop(type, e);
    });

    // palette draggables and click
    document.querySelectorAll('#palette .draggable').forEach(el => {
      el.addEventListener('dragstart', (ev) => {
        ev.dataTransfer.setData('node-type', el.getAttribute('data-type'));
        ev.dataTransfer.setData('text/plain', el.getAttribute('data-type'));
      });
      el.addEventListener('click', (ev) => {
        const type = el.getAttribute('data-type'); if(!type) return;
        const rect = canvas.getBoundingClientRect(); const scrollLeft = canvas.scrollLeft || 0; const scrollTop = canvas.scrollTop || 0;
    const centerX = (rect.width / 2) + scrollLeft; const centerY = (rect.height / 2) + scrollTop;
    const x = snap(centerX / (zoomRef() || 1)); const y = snap(centerY / (zoomRef() || 1));
        const node = createNode(type, x, y);
        if (autoGrow) autoGrow();
        const propsPanel = document.getElementById('properties'); if(propsPanel?.classList.contains('collapsed')) propsPanel.classList.remove('collapsed');
        selectNode(node.id);
    if (window.App && typeof window.App.ensureNodeVisible === 'function') window.App.ensureNodeVisible(node, 120);
          });
    });

    canvas.addEventListener('click', (e) => {
      stateRef.selectedId = null; if(typeof opts.showProperties === 'function') opts.showProperties(null);
      document.querySelectorAll('.node').forEach(nd => nd.style.outline = '');
      const propsPanel = document.getElementById('properties'); if(propsPanel) propsPanel.classList.remove('force-visible');
    });
  }

  window.AppCanvasDrag = { init };
})();
