// common.js - helpers compartidos de form renderers
(function(){
  const safe = (fn, ctx) => {
    try { return fn(); }
    catch(e){ window?.console?.debug?.('[FormRenderers:safe]', ctx||'', e.message); return undefined; }
  };

  const markField = (host, cls) => { if (host) host.classList.add(cls); };
  const markFieldUsed = (el) => { if(el) el.dataset.used = '1'; };

  function applyRuleSet(rules, ctx) {
    const errors = [];
    const warnings = [];
    const infos = [];
    function record(r){
      if(r.kind==='error') errors.push(r.msg);
      else if(r.kind==='warning') warnings.push(r.msg);
      else infos.push(r.msg);
      if(r.field){
        let cls = r.cls;
        if(!cls){
          if(r.kind==='error') cls='field-error';
          else if(r.kind==='warning') cls='field-warning';
          else cls='field-info';
        }
        markField(ctx.querySelector(r.field), cls);
      }
    }
    rules?.forEach(r => { if(r?.when) record(r); });
    return { errors, warnings, infos };
  }

  function deriveLocales(node, fallback = ['es']) {
    const metaLocales = window.App?.state?.meta?.locales;
    if (Array.isArray(metaLocales) && metaLocales.length) return metaLocales;
    if (node?.i18n && typeof node.i18n === 'object') {
      const k = Object.keys(node.i18n);
      if (k.length) return k;
    }
    return fallback;
  }

  function extractPaths(obj, maxDepth = 4, prefix = '') {
    if (obj == null || maxDepth < 0) return [];
    if (Array.isArray(obj)) return extractArrayPaths(obj, maxDepth, prefix);
    if (typeof obj === 'object') return extractObjectPaths(obj, maxDepth, prefix);
    return [];
  }
  function extractArrayPaths(arr, maxDepth, prefix) {
    if (!arr.length) return [];
    const first = arr[0];
    if (first && typeof first === 'object') {
      const base = prefix ? prefix + '[0]' : '[0]';
      const child = extractPaths(first, maxDepth - 1, base);
      return child.length ? child : [base];
    }
    return [prefix || ''];
  }
  function extractObjectPaths(obj, maxDepth, prefix) {
    const out = [];
    Object.keys(obj).forEach(k => {
      const full = prefix ? prefix + '.' + k : k;
      out.push(full);
      extractPaths(obj[k], maxDepth - 1, full).forEach(p => out.push(p));
    });
    return out;
  }

  function parseJson(str, fallback) { try { return JSON.parse(str); } catch { return fallback; } }

  const hasStaticLabels = btns => Array.isArray(btns) && btns.some(b => {
    const hasLbl = typeof b?.label === 'string' && b.label.trim() !== '';
    const hasI18n = b?.i18n && Object.values(b.i18n).some(v => (v?.text || '').trim() !== '');
    return hasLbl || hasI18n;
  });

  function adoptTemplate(container, type, slotClass) {
    const tpl = document.getElementById(`panel-${type}-template`);
    if (!tpl) return container;
    const frag = tpl.content.cloneNode(true);
    container.appendChild(frag);
    return container.querySelector(`.${slotClass}`) || container;
  }

  // Toast global reutilizable
  function showToast(msg) {
    let toast = document.getElementById('globalVarToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'globalVarToast';
      toast.className = 'fixed top-6 right-6 z-50 px-4 py-2 bg-green-600 text-white rounded shadow-lg text-sm font-semibold opacity-0 pointer-events-none transition-opacity duration-300';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
    setTimeout(() => { toast.style.opacity = '0'; }, 1200);
  }

  function setupValidation(container, opts){
    const { boxId = 'validation_box', okMessage = '✔ OK', collectState, buildRules } = opts || {};
    let box = container.querySelector('#'+boxId);
    if(!box){
      box = document.createElement('div');
      box.id = boxId;
      box.className = 'validation-box mt-2 p-2 border rounded bg-gray-50 text-xs';
      container.appendChild(box);
    }
    const { renderValidation } = window.ValidationHelpers || {};
    function run(){
      const st = collectState ? collectState() : {};
      const rules = buildRules ? buildRules(st) : [];
      const result = applyRuleSet(rules, container);
      if(renderValidation) renderValidation(result, box, okMessage);
      return result;
    }
    return { run, box };
  }

  window.RendererHelpers = { safe, applyRuleSet, deriveLocales, extractPaths, parseJson, hasStaticLabels, adoptTemplate, showToast, setupValidation, markFieldUsed };
})();
