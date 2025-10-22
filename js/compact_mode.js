// compact_mode.js — Toggle de modo compacto global
(function(){
  function applyCompact(on){
    document.body.classList.toggle('compact-ui', !!on);
    try { localStorage.setItem('flowEditor.compactUI', on ? '1' : '0'); }
    catch(_e){ console.warn('[compact_mode] localStorage.setItem failed', _e); }
  }
  function init(){
    const btn = document.getElementById('toggleCompactMode');
    if (!btn) return;
  try { applyCompact(localStorage.getItem('flowEditor.compactUI') === '1'); }
  catch(_e){ console.warn('[compact_mode] localStorage.getItem failed', _e); }
    btn.addEventListener('click', ()=>{
      const now = !document.body.classList.contains('compact-ui');
      applyCompact(now);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
