// help_modal.js — Carga y gestión del modal de ayuda como componente externo
(function(){
  const TEMPLATE_URL = 'components/help_modal.html';
  let loaded = false;
  let modal = null;
  let closeBtn = null;
  let insertBtn = null;

  async function loadTemplate(){
    if (loaded) return true;
    // 1) Si ya existe el diálogo en DOM, listo
    modal = document.getElementById('helpModal');
    if (modal){
      cacheControls();
      wireModal();
      loaded = true;
      return true;
    }
    // 2) Si el template ya está presente (cargado por loader común), instanciarlo
    let tpl = document.getElementById('tpl-help-modal');
    if (tpl && 'content' in tpl){
      const fragment = tpl.content.cloneNode(true);
      document.body.appendChild(fragment);
      modal = document.getElementById('helpModal');
      cacheControls();
      wireModal();
      loaded = true;
      return true;
    }
    // 3) Fallback: fetch directo si no hay loader ni template
    if (location.protocol === 'file:'){
      console.warn('[HelpModal] Ejecutando desde file:// — no se puede hacer fetch del template. Inicia un servidor local.');
      return false;
    }
    try{
      const controller = new AbortController();
      const timeoutId = setTimeout(()=>controller.abort(), 5000);
      const res = await fetch(TEMPLATE_URL, { cache: 'no-store', signal: controller.signal });
      clearTimeout(timeoutId);
      if(!res.ok) throw new Error('HTTP '+res.status);
      const html = await res.text();
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      tpl = tmp.querySelector('#tpl-help-modal');
      if (!tpl) throw new Error('Template #tpl-help-modal no encontrado');
      const fragment = tpl.content.cloneNode(true);
      document.body.appendChild(fragment);
      modal = document.getElementById('helpModal');
      cacheControls();
      wireModal();
      loaded = true;
      return true;
    }catch(err){
      console.warn('[HelpModal] No se pudo cargar el componente:', err.message || err);
      return false;
    }
  }

  function cacheControls(){
    closeBtn = document.getElementById('helpModalClose');
    insertBtn = document.getElementById('btnInsertExample');
  }

  function open(){ if (modal && typeof modal.showModal==='function'){ modal.showModal(); setTimeout(bindCopyExprButtons, 50); } }
  function close(){ if (modal && typeof modal.close==='function'){ modal.close(); } }

  function wireModal(){
    closeBtn?.addEventListener('click', close);
    // Cerrar al hacer clic fuera del cuadro (backdrop click)
    modal?.addEventListener('click', (e)=>{
      const rect = modal.getBoundingClientRect();
      const inDialog = rect.top <= e.clientY && e.clientY <= rect.bottom && rect.left <= e.clientX && e.clientX <= rect.right;
      if (!inDialog) close();
    });

    insertBtn?.addEventListener('click', insertExampleFlow);

    // Scroll suave interno para enlaces del índice
    const body = document.getElementById('helpModalBody') || modal;
    modal?.addEventListener('click', (ev) => {
      const a = ev.target && ev.target.closest ? ev.target.closest('a[href^="#"]') : null;
      if (!a) return;
      const href = a.getAttribute('href');
      if (!href || href.length < 2) return;
      const target = modal.querySelector(href);
      if (!target) return;
      ev.preventDefault();
      try {
        const cRect = body.getBoundingClientRect();
        const tRect = target.getBoundingClientRect();
        const delta = tRect.top - cRect.top;
        const top = body.scrollTop + delta - 8; // pequeño margen
        body.scrollTo({ top, behavior: 'smooth' });
      } catch(_e){
        try { target.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' }); } catch(ee) {}
      }
    });
  }

  function bindCopyExprButtons(){
    const buttons = modal?.querySelectorAll('.copyExprBtn') || [];
    for (const btn of buttons){
      btn.addEventListener('click', async (e) => {
        const el = e.currentTarget;
        const expr = el?.dataset?.expr || '';
        try {
          if (navigator?.clipboard?.writeText) await navigator.clipboard.writeText(expr);
          const old = el.textContent; el.textContent = 'Copiado';
          setTimeout(function(){ el.textContent = old || 'Copiar'; }, 1000);
        } catch(err){
          console.warn('[HelpModal] No se pudo copiar', err);
        }
      });
    }
  }

  function insertExampleFlow(){
    try {
      let start = null;
      if (globalThis.App && typeof globalThis.App.createNode === 'function') {
        start = globalThis.App.createNode('start', 120, 100);
      } else if (globalThis.AppNodeFactory && typeof globalThis.AppNodeFactory.createNode === 'function') {
        start = globalThis.AppNodeFactory.createNode('start', 120, 100);
      }
      if (!start) return;
      const state = globalThis.App?.state;
      try {
        start.variables = start.variables || [];
        if (!start.variables.some(v=>v.name==='items')) start.variables.push({ name:'items', isList: true, defaultValue: '' });
        if (!start.variables.some(v=>v.name==='items_count')) start.variables.push({ name:'items_count', isList: false, defaultValue: '0' });
      } catch(e) { console.warn('[HelpModal] No se pudo actualizar variables en Start', e); }

      const n1 = globalThis.App.createNode('assign_var', 360, 100);
      n1.assignments = [{ target:'items', value: "split('a,b,c', ',')" }];
      start.next = { flow_id:'', node_id: n1.id };

      const n2 = globalThis.App.createNode('assign_var', 600, 100);
      n2.assignments = [{ target:'items_count', value: 'len(items)' }];
      n1.next = { flow_id:'', node_id: n2.id };

      const n3 = globalThis.App.createNode('assign_var', 840, 100);
      n3.assignments = [{ target:'csv', value: "join(items, ';')" }];
      n2.next = { flow_id:'', node_id: n3.id };

      const n4 = globalThis.App.createNode('assign_var', 1080, 100);
      n4.assignments = [{ target:'n', value: "toNumber('42')" }];
      n3.next = { flow_id:'', node_id: n4.id };

      const n5 = globalThis.App.createNode('response', 1320, 100);
      const locales = (state?.meta?.locales?.length) ? state.meta.locales : ['es'];
      n5.i18n = n5.i18n || {};
      for (const l of locales) {
        n5.i18n[l] = n5.i18n[l] || {};
        n5.i18n[l].text = [ 'Tienes {{ items_count }} elementos; csv={{ csv }}; n={{ n }}' ];
      }
      n4.next = { flow_id:'', node_id: n5.id };

      // 7) End: finaliza el flujo
      const n6 = globalThis.App.createNode('end', 1560, 100);
      n5.next = { flow_id:'', node_id: n6.id };

      if (globalThis.App && typeof globalThis.App.refreshOutput === 'function') {
        globalThis.App.refreshOutput();
      }
      if (globalThis.App && typeof globalThis.App.ensureNodeVisible === 'function') {
        globalThis.App.ensureNodeVisible(n6, 120);
      }
      close();
    } catch (err) {
      console.warn('[HelpModal] No se pudo insertar el ejemplo', err);
    }
  }

  async function openHelp(){
    const ok = await loadTemplate();
    if (ok) open();
  }

  // Exponer API mínima global
  globalThis.HelpModal = { open: openHelp, close };

  // Wire botones que abren la ayuda
  function wireOpeners(){
    const ids = ['btnHelpDoc', 'btnShowHelp'];
    for (const id of ids){
      const el = document.getElementById(id);
      el?.addEventListener('click', openHelp);
    }
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', wireOpeners);
  } else {
    wireOpeners();
  }
})();
