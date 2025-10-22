// validation.js - helpers de validación reutilizables
(function(){
  const H = window.FormBuilderHelpers || {};
  const el = H.el || function(tag, attrs={}, children=[]) { const e=document.createElement(tag); (children||[]).forEach(c=>e.appendChild(c)); return e; };
  function renderValidation(result, box, okMessage) {
    if (!box) return;
    const okMsg = okMessage || '✔ Sin problemas';
    box.innerHTML='';
    const errs = result?.errors || [];
    const warns = result?.warnings || [];
    const infos = result?.infos || [];
    if (!errs.length && !warns.length && !infos.length) {
      box.textContent = okMsg;
      box.style.color = '#059669';
    } else {
      const ul = el('ul',{class:'list-disc pl-4 space-y-1'});
      errs.forEach(m=>ul.appendChild(el('li',{text:m,class:'text-red-600 font-semibold'})));
      warns.forEach(m=>ul.appendChild(el('li',{text:m,class:'text-amber-600'})));
      infos.forEach(m=>ul.appendChild(el('li',{text:m,class:'text-sky-700 info-msg'})));
      box.appendChild(ul);
      box.style.color='';
    }
    box.dataset.errors = JSON.stringify(errs);
    box.dataset.warnings = JSON.stringify(warns);
    box.dataset.infos = JSON.stringify(infos);
  }
  window.ValidationHelpers = { renderValidation };
})();
