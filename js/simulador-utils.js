(function(){
  // simulador-utils.js
  // Utilidades compartidas: parse path, clone, resolve loop paths, timestamp helper.
  if(typeof window === 'undefined') return;
  window.Simulador = window.Simulador || {};
  window.Simulador.utils = (function(){
    function nowIso(){ return new Date().toISOString(); }
    function clone(obj){ return JSON.parse(JSON.stringify(obj)); }
    function resolveLoopPath(basePath, index, child){ return basePath + (typeof index === 'number' ? '['+index+']' : '') + (child ? '.'+child : ''); }
    return { nowIso, clone, resolveLoopPath };
  })();
})();
