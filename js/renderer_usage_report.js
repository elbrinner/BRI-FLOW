// renderer_usage_report.js - Reporte de uso de campos requeridos en renderers
(function(){
  const reportState = { events: [] };

  function scanUsed(){
    const out = {};
    const tps = window.TemplatePanelsStatus || {}; 
    const req = tps.requiredFields || {};
    Object.entries(req).forEach(([tplId, fields]) => {
      out[tplId] = fields.map(f => {
        // Heurística: último segmento después de punto -> id probable
        const seg = f.split('.').slice(-1)[0];
        const el = document.getElementById(seg);
        return { field: f, id: seg, present: !!el, used: !!el?.dataset.used };
      });
    });
    return out;
  }

  function logFinal(){
    const snapshot = scanUsed();
    window.RendererUsageReport = { snapshot, events: reportState.events };
    const missingUse = [];
    Object.values(snapshot).forEach(arr => arr.forEach(r => { if(r.present && !r.used) missingUse.push(r.field); }));
    if(missingUse.length) console.warn('[RendererUsage] Campos presentes pero sin marca de uso:', missingUse);
    else console.info('[RendererUsage] ✔ Todos los campos requeridos marcados como usados');
  }

  document.addEventListener('renderer:after', e => {
    reportState.events.push({ type: e.detail?.type, ts: Date.now() });
    // Recalcular incremental
    window.RendererUsageLive = scanUsed();
  });

  // Ejecutar un reporte diferido (p.e. 2s después de templates listos)
  function schedule(){ setTimeout(logFinal, 2000); }

  if(window.__panelTemplatesReady) schedule();
  else document.addEventListener('panelTemplates:ready', schedule, { once: true });
})();
