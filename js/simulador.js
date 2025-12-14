// simulador.js - Loader for modular simulator
(function () {
  'use strict';
  console.log('[Simulador] Bootstrapping modular simulator...');

  const scripts = [
    'js/simulador/utils.js',
    'js/simulador/state.js',
    'js/simulador/i18n.js',
    'js/simulador/ui.js',
    'js/simulador/flow.js',
    'js/simulador/api.js',
    'js/simulador/engine.js',
    'js/simulador/nodes/index.js',
    'js/simulador/nodes/logic.js',
    'js/simulador/nodes/interaction.js',
    'js/simulador/nodes/form.js',
    'js/simulador/nodes/service.js',
    'js/simulador/index.js'
  ];

  function loadScript(index) {
    if (index >= scripts.length) {
      console.log('[Simulador] All modules loaded.');
      return;
    }
    const src = scripts[index];
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => loadScript(index + 1);
    s.onerror = (e) => console.error(`[Simulador] Failed to load ${src}`, e);
    document.body.appendChild(s);
  }

  // Start loading
  loadScript(0);
})();
