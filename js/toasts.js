// toasts.js
// Minimal toast notification helper
(function(){
  const THRESHOLD_MS = 5000; // ventana de agrupación
  const DEFAULT_TIMEOUT = 3500;
  let current = null;
  function ensureContainer() {
    let c = document.getElementById('toastContainer');
    if (!c) {
      c = document.createElement('div');
      c.id = 'toastContainer';
      c.style.position = 'fixed';
      c.style.right = '16px';
      c.style.top = 'calc(var(--header-height) + 16px)';
      c.style.zIndex = 9999;
      c.style.display = 'flex';
      c.style.flexDirection = 'column';
      c.style.gap = '8px';
      document.body.appendChild(c);
    }
    return c;
  }

  function showToast(msg, opts = {}) {
    try {
      const cont = ensureContainer();
      const now = Date.now();
      // Si hay un toast activo reciente, actualizarlo en lugar de crear otro
  if (current?.el && document.body.contains(current.el) && (now - current.shownAt) < THRESHOLD_MS) {
        current.count = (current.count || 1) + 1;
        // Mostrar el último mensaje; opcionalmente podríamos concatenar. Mostramos uno solo.
        current.el.textContent = msg + (current.count > 1 ? ` (+${current.count - 1})` : '');
        // Reiniciar estilos según opts si llegan distintos tipos
        current.el.style.background = opts.background || current.el.style.background || '#0b2540';
        current.el.style.color = opts.color || current.el.style.color || '#fff';
        current.shownAt = now;
  clearTimeout(current.removeTimer);
        const timeout = opts.timeout || DEFAULT_TIMEOUT;
        current.removeTimer = setTimeout(() => {
          if (current?.el) {
            current.el.remove();
          }
          current = null;
        }, timeout);
        return current.el;
      }

      const el = document.createElement('div');
      el.className = 'toast-item';
      el.textContent = msg;
      el.style.background = opts.background || '#0b2540';
      el.style.color = opts.color || '#fff';
      el.style.padding = '8px 12px';
      el.style.borderRadius = '8px';
      el.style.boxShadow = '0 6px 18px rgba(11,22,40,0.12)';
      el.style.fontSize = '13px';
      cont.appendChild(el);
      const timeout = opts.timeout || DEFAULT_TIMEOUT;
  const removeTimer = setTimeout(() => { el.remove(); if (current && current.el === el) current = null; }, timeout);
      current = { el, shownAt: now, removeTimer, count: 1 };
      return el;
    } catch(e) { console.warn('showToast failed', e); }
  }

  window.showToast = showToast;
  // Compatibilidad básica: exponer window.Toasts si no existe
  window.Toasts = window.Toasts || {};
  if (typeof window.Toasts.info !== 'function') window.Toasts.info = (m, o) => showToast(m, { background: '#0b2540', ...(o||{}) });
  if (typeof window.Toasts.success !== 'function') window.Toasts.success = (m, o) => showToast(m, { background: '#065f46', ...(o||{}) });
  if (typeof window.Toasts.error !== 'function') window.Toasts.error = (m, o) => showToast(m, { background: '#b91c1c', ...(o||{}) });
})();
