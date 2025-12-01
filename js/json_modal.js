// json_modal.js
// Controla el modal "Ver JSON" con capacidad de edición y guardado
(function(){
  function openModal(){
    const overlay = document.getElementById('jsonModal'); if(!overlay) return;
    overlay.style.display = 'block';
    overlay.setAttribute('aria-hidden','false');
    try { document.getElementById('jsonModalClose')?.focus?.(); } catch(_e){}
  }
  function closeModal(){
    const overlay = document.getElementById('jsonModal'); if(!overlay) return;
    // salir del modo edición si está activo
    setEditMode(false);
    overlay.style.display = 'none';
    overlay.setAttribute('aria-hidden','true');
  }

  function setEditMode(on){
    const pre = document.getElementById('jsonModalContent');
    const ta = document.getElementById('jsonModalEditor');
    const btnEdit = document.getElementById('jsonModalEdit');
    const btnSave = document.getElementById('jsonModalSave');
    const btnCancel = document.getElementById('jsonModalCancel');
    const btnFormat = document.getElementById('jsonModalFormat');
    const btnValidate = document.getElementById('jsonModalValidate');
    const warnBox = document.getElementById('jsonModalWarnings');
    if(!pre || !ta || !btnEdit || !btnSave || !btnCancel) return;
    if(on){
      ta.value = pre.textContent || '{}';
      pre.style.display = 'none';
      ta.style.display = 'block';
      btnEdit.style.display = 'none';
      btnSave.style.display = '';
      btnCancel.style.display = '';
      if (btnFormat) btnFormat.style.display = '';
      if (btnValidate) btnValidate.style.display = '';
      if (warnBox) { warnBox.style.display = 'none'; warnBox.innerHTML=''; }
    } else {
      pre.style.display = '';
      ta.style.display = 'none';
      btnEdit.style.display = '';
      btnSave.style.display = 'none';
      btnCancel.style.display = 'none';
      if (btnFormat) btnFormat.style.display = 'none';
      if (btnValidate) btnValidate.style.display = 'none';
      if (warnBox) { warnBox.style.display = 'none'; warnBox.innerHTML=''; }
    }
  }

  function refreshModalContent(){
    const pre = document.getElementById('jsonModalContent'); if(!pre) return;
    let out;
    try {
      if (window.App && typeof window.App.generateFlowJson === 'function') {
        out = window.App.generateFlowJson();
      } else if (window.AppSerializer && typeof window.AppSerializer.generateFlowJson === 'function' && window.App?.state) {
        out = window.AppSerializer.generateFlowJson(window.App.state);
      } else {
        out = { error: 'generator not available' };
      }
    } catch(e){ out = { error: String(e && e.message || e) }; }
    pre.textContent = JSON.stringify(out, null, 2);
  }

  function wire(){
    const btnShow = document.getElementById('btnShowJson');
    const btnClose = document.getElementById('jsonModalClose');
    const btnCopy = document.getElementById('jsonModalCopy');
    const btnEdit = document.getElementById('jsonModalEdit');
    const btnSave = document.getElementById('jsonModalSave');
    const btnCancel = document.getElementById('jsonModalCancel');
    const btnFormat = document.getElementById('jsonModalFormat');
    const btnValidate = document.getElementById('jsonModalValidate');
    const ta = document.getElementById('jsonModalEditor');
    const warnBox = document.getElementById('jsonModalWarnings');

    btnShow?.addEventListener('click', () => { try { refreshModalContent(); openModal(); } catch(e){ console.warn('[JSONModal] open failed', e); } });
    btnClose?.addEventListener('click', () => closeModal());
    // Cerrar al hacer click en el backdrop (no dentro del diálogo)
    const overlay = document.getElementById('jsonModal');
    overlay?.addEventListener('click', (ev) => {
      try {
        const dialog = document.querySelector('#jsonModal .modal-dialog');
        if (dialog && !dialog.contains(ev.target)) closeModal();
      } catch(_e){}
    });
    // Cerrar con tecla Escape
    document.addEventListener('keydown', (ev) => {
      try {
        if (ev.key === 'Escape') {
          const isVisible = overlay && overlay.style.display !== 'none' && overlay.getAttribute('aria-hidden') === 'false';
          if (isVisible) closeModal();
        }
      } catch(_e){}
    });
    btnCopy?.addEventListener('click', async () => {
      try {
        const pre = document.getElementById('jsonModalContent');
        const text = pre?.textContent || '{}';
        await navigator.clipboard.writeText(text);
        if (window.Toasts && typeof window.Toasts.info === 'function') window.Toasts.info('JSON copiado');
      } catch(e){ console.warn('[JSONModal] copy failed', e); }
    });
    btnEdit?.addEventListener('click', () => setEditMode(true));
    btnCancel?.addEventListener('click', () => setEditMode(false));
    btnFormat?.addEventListener('click', () => {
      if (!ta) return;
      try { const obj = JSON.parse(ta.value); ta.value = JSON.stringify(obj, null, 2); if (window.Toasts?.info) window.Toasts.info('JSON formateado'); }
      catch(e){ alert('No se pudo formatear: ' + (e.message || e)); }
    });
    btnValidate?.addEventListener('click', () => {
      if (!ta) return;
      try {
        const obj = JSON.parse(ta.value);
        const res = validateJson(obj);
        renderValidation(res, warnBox);
        if (!res.errors.length && window.Toasts?.info) window.Toasts.info('Validación OK');
      } catch(e){ renderValidation({ errors:[String(e.message||e)], warnings:[] }, warnBox); }
    });
    btnSave?.addEventListener('click', () => {
      try {
        if(!ta) return;
        const raw = ta.value || '';
        let obj;
        try {
          obj = JSON.parse(raw);
        } catch(parseErr){
          try { if (window.Toasts && typeof window.Toasts.error === 'function') window.Toasts.error('JSON inválido: ' + parseErr.message); } catch(_t){}
          alert('JSON inválido: ' + parseErr.message);
          return;
        }
        const res = validateJson(obj);
        renderValidation(res, warnBox);
        if (res.errors.length) { alert('Errores de validación: ' + res.errors.join('\n')); return; }
        // Importar en el editor y actualizar canvas
        if (window.App && typeof window.App.importJson === 'function') {
          window.App.importJson(obj);
          // actualizar panel estático y cerrar modal
          refreshModalContent();
          setEditMode(false);
          closeModal();
          try { if (window.Toasts && typeof window.Toasts.info === 'function') window.Toasts.info('JSON importado y canvas actualizado'); } catch(_t){}
        } else {
          alert('Editor no disponible para importar JSON');
        }
      } catch(err){ console.warn('[JSONModal] save failed', err); }
    });
  }

  document.addEventListener('DOMContentLoaded', wire);
  function validateJson(obj){
    const errors = [];
    const warnings = [];
    if (!obj || typeof obj !== 'object') { errors.push('Raíz inválida: se esperaba objeto'); return { errors, warnings }; }
    if (!obj.nodes || typeof obj.nodes !== 'object') { errors.push('Falta "nodes" o no es objeto'); return { errors, warnings }; }
    const nodes = obj.nodes;
    const nodeIds = new Set(Object.keys(nodes));
    // Meta opcional: si existe, validar parcialmente
    if (obj.schema_version !== undefined && typeof obj.schema_version !== 'number') warnings.push('schema_version debería ser numérico');
    if (obj.start_node && !nodeIds.has(obj.start_node)) warnings.push(`start_node "${obj.start_node}" no existe en nodes`);
    for (const id of Object.keys(nodes)){
      const n = nodes[id];
      if (!n || typeof n !== 'object') { errors.push(`Nodo ${id}: no es un objeto`); continue; }
      if (!n.type || typeof n.type !== 'string') errors.push(`Nodo ${id}: falta "type"`);
      if (n.id && n.id !== id) warnings.push(`Nodo ${id}: "id" interno (${n.id}) no coincide con la clave`);
      // Validar targets básicos
      const targets = [];
      const pushIf = (t)=>{ if (t && typeof t === 'object') targets.push(t); };
      pushIf(n.next);
      pushIf(n.true_target); pushIf(n.false_target);
      pushIf(n.body_start); pushIf(n.after_loop); pushIf(n.loop_body);
      if (n.type === 'flow_jump'){ pushIf(n.target); pushIf(n.return_target); }
      if (n.default_target) pushIf(n.default_target);
      if (Array.isArray(n.options)) n.options.forEach(o=>pushIf(o?.target));
      if (Array.isArray(n.cases)) n.cases.forEach(c=>pushIf(c?.target));
      if (n.knot && Array.isArray(n.knot.outputs)) n.knot.outputs.forEach(o=>pushIf(o?.target));
      targets.forEach(t => {
        const nid = t.node_id;
        const fid = t.flow_id;
        if (nid && !nodeIds.has(nid) && (!fid || fid === '')){
          warnings.push(`Nodo ${id}: target a "${nid}" no existe`);
        }
      });
    }
    return { errors, warnings };
  }

  function renderValidation(res, warnBox){
    if (!warnBox) return;
    const { errors = [], warnings = [] } = res || {};
    if (!errors.length && !warnings.length){ warnBox.style.display = 'none'; warnBox.innerHTML = ''; return; }
    const list = [];
    if (errors.length){ list.push(`<div class="p-2 mb-1 rounded border border-red-200 bg-red-50 text-red-700"><strong>Errores:</strong><ul class="list-disc pl-5">${errors.map(e=>`<li>${escapeHtml(e)}</li>`).join('')}</ul></div>`); }
    if (warnings.length){ list.push(`<div class="p-2 rounded border border-amber-200 bg-amber-50 text-amber-800"><strong>Advertencias:</strong><ul class="list-disc pl-5">${warnings.map(w=>`<li>${escapeHtml(w)}</li>`).join('')}</ul></div>`); }
    warnBox.innerHTML = list.join('');
    warnBox.style.display = '';
  }

  function escapeHtml(s){
    try { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c])); } catch(_){ return String(s); }
  }
})();
