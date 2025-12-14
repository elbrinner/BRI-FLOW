// js/simulador/nodes/index.js
(function () {
    'use strict';

    window.Simulador = window.Simulador || {};
    window.Simulador.nodes = window.Simulador.nodes || {};

    const Registry = {};

    window.Simulador.nodes.register = function (type, handler) {
        Registry[type] = handler;
    };

    window.Simulador.nodes.processNode = function (node, state, flow, nodeId, context) {
        const handler = Registry[node.type];
        if (handler) {
            handler(node, state, flow, nodeId, context);
        } else {
            // Default fallback
            context.log(`Nodo tipo desconocido (${node.type}), saltando a next`);
            state.current = context.gotoNext(node.next);
            context.scheduleStep();
        }
    };
})();
