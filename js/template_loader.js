// template_loader.js — Carga común de templates (paneles + help) con reintentos
(function(){
  const FILES = [
    'components/panel-start.html',
    'components/panel-response.html',
    'components/panel-input.html',
    'components/panel-assign_var.html',
    'components/panel-rest_call.html',
    'components/panel-condition.html',
    'components/panel-set_goto.html',
    'components/panel-loop.html',
    'components/panel-form.html',
    'components/panel-button.html',
    'components/panel-multi_button.html',
    'components/panel-extra.html',
    'components/help_modal.html'
  ];

  async function loadTemplateFile(path, retries = 3, timeoutMs = 5000){
    for (let i = 0; i < retries; i++){
      try{
        const controller = new AbortController();
        const to = setTimeout(()=>controller.abort(), timeoutMs);
        const res = await fetch(path, { cache: 'no-store', signal: controller.signal });
        clearTimeout(to);
        if (!res.ok) throw new Error('HTTP '+res.status);
        const html = await res.text();
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        const temps = tmp.querySelectorAll('template');
        for (const t of temps) document.head.appendChild(t);
        return true;
      }catch(err){
        console.warn(`[TemplateLoader] Intento ${i+1} falló para ${path}:`, err.message || err);
        if (i < retries - 1) await new Promise(r => setTimeout(r, 1000));
      }
    }
    console.warn(`[TemplateLoader] No se pudo cargar ${path} tras ${retries} intentos`);
    return false;
  }

  async function loadAll(files = FILES){
    if (location.protocol === 'file:'){
      console.warn('[TemplateLoader] file:// detectado — omitiendo carga de templates para evitar CORS. Inicia un servidor local.');
      globalThis.__templatesReady = true;
      document.dispatchEvent(new CustomEvent('templates:ready'));
      return { ok: false };
    }
    const promises = files.map(p => loadTemplateFile(p));
    const results = await Promise.allSettled(promises);
    const ok = results.every(r => r.status === 'fulfilled');
    globalThis.__templatesReady = true;
    document.dispatchEvent(new CustomEvent('templates:ready'));
    return { ok };
  }

  // API pública mínima
  globalThis.TemplateLoader = { loadAll };

  // Cargar inmediatamente al iniciar
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', () => loadAll());
  } else {
    loadAll();
  }
})();
