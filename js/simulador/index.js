// js/simulador/index.js
(function () {
    'use strict';

    console.log('[Simulador] Loading modular simulator...');

    // Ensure namespace
    window.Simulador = window.Simulador || {};

    // Facade to expose legacy API if needed or initialize
    window.Simulador.init = function () {
        console.log('[Simulador] Initialized.');
        // Load local config
        if (window.Simulador.api) window.Simulador.api.loadLocalConfig();
        // Init UI handlers (chat, events)
        if (window.Simulador.ui && window.Simulador.ui.initHandlers) {
            window.Simulador.ui.initHandlers();
        }
    };

    // Auto-init if document is ready
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        window.Simulador.init();
    } else {
        document.addEventListener('DOMContentLoaded', window.Simulador.init);
    }
})();
