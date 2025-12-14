// js/simulador/nodes/logic.js
(function () {
    'use strict';

    // Wait for registry
    const register = (type, handler) => {
        if (window.Simulador && window.Simulador.nodes && window.Simulador.nodes.register) {
            window.Simulador.nodes.register(type, handler);
        } else {
            // Retry or assume loaded later? 
            // Better to wrap in a timeout or ensure load order. 
            // For now, assume index.js is loaded before.
            setTimeout(() => window.Simulador.nodes.register(type, handler), 0);
        }
    };

    register('condition', (node, state, flow, nodeId, ctx) => {
        const expr = node.expr || node.expression || node.value || '';
        const res = ctx.evaluate(expr, state.variables);
        const target = res ? (node.true_target && node.true_target.node_id) : (node.false_target && node.false_target.node_id);
        ctx.log(`COND (${nodeId}): ${expr} => ${res} -> ${target}`);
        state.current = ctx.gotoNext(target);
        ctx.scheduleStep();
    });

    register('debug', (node, state, flow, nodeId, ctx) => {
        const rawMsg = node.message || node.text || ctx.getI18nText(node, node.message || node.text || '');
        // Assume processText is available in utils or core
        const text = rawMsg; // Simplified

        if (window.Simulador.ui && window.Simulador.ui.appendChatMessage) {
            window.Simulador.ui.appendChatMessage('bot', text);
        }

        // Payload logic...
        const saveKey = node.save_as || node.saveAs || node.variable;
        if (saveKey) {
            state.variables[saveKey] = node.payload; // Simplified
        }

        state.history.push({ node: nodeId, type: 'debug', message: text });
        state.current = ctx.gotoNext(node.next);
        ctx.scheduleStep();
    });

    register('end', (node, state, flow, nodeId, ctx) => {
        ctx.log('END reached.');
        ctx.stop();
    });

    // TODO: Add loop, foreach, while handlers here (copying logic from simulador.js)
})();
