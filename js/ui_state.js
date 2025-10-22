// ui_state.js
// Maneja zoom y estado UI (persistencia de paneles colapsados, scroll)
(function(){
  let canvas = null;
  let canvasInner = null;
  let zoom = 1;

  function setZoom(z){
    zoom = Math.max(0.2, Math.min(2, z));
    if (canvasInner) canvasInner.style.transform = `scale(${zoom})`;
    const lbl = document.getElementById('zoomLabel'); if(lbl) lbl.textContent = Math.round(zoom*100) + '%';
    try { if (typeof jsPlumb !== 'undefined') jsPlumb.repaintEverything(); } catch(e) { console.warn('repaintEverything failed', e); }
    saveUiState();
  }

  function getZoom(){ return zoom; }

  function saveUiState(){
    try {
      const stateToSave = {
        collapsed: Array.from(document.querySelectorAll('aside')).filter(a=>a.classList.contains('collapsed')).map(a=>a.id),
        zoom,
        scroll: { left: canvas?.scrollLeft || 0, top: canvas?.scrollTop || 0 }
      };
      localStorage.setItem('editorUiState', JSON.stringify(stateToSave));
    } catch(e) { console.warn('saveUiState failed', e); }
  }

  function applySavedState(s){
    if(!s) return;
    if(s.collapsed && Array.isArray(s.collapsed)) s.collapsed.forEach(id => { const el = document.getElementById(id); if(el) el.classList.add('collapsed'); });
    if(s.zoom) setZoom(s.zoom);
    if(s.scroll && canvas) { canvas.scrollLeft = s.scroll.left || 0; canvas.scrollTop = s.scroll.top || 0; }
  }

  function applyDefaultUiState(){
    const palette = document.getElementById('palette'); if(palette) palette.classList.remove('collapsed');
    const props = document.getElementById('properties'); if(props) props.classList.remove('collapsed');
    try {
      if (canvas && canvasInner) {
        const horizontalBias = 0.75;
        const targetLeft = Math.max(0, Math.floor((canvasInner.scrollWidth - canvas.clientWidth) * horizontalBias));
        const targetTop = Math.max(0, Math.floor((canvasInner.scrollHeight - canvas.clientHeight) * 0.5));
        canvas.scrollLeft = targetLeft;
        canvas.scrollTop = targetTop;
      }
    } catch(err) { console.warn('initial center scroll failed', err); }
  }

  function restoreUiState(){
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

  function init(refs){
    canvas = refs.canvas || document.getElementById('canvas');
    canvasInner = refs.canvasInner || document.getElementById('canvasInner');
    // apply initial transform if needed
    if (canvasInner) canvasInner.style.transform = `scale(${zoom})`;
  }

  window.AppUIState = { init, setZoom, getZoom, saveUiState, restoreUiState, applySavedState, applyDefaultUiState };
})();
