// js/simulador/nodes/input.js
(function () {
    'use strict';

    const register = (type, handler) => {
        if (window.Simulador && window.Simulador.nodes && window.Simulador.nodes.register) {
            window.Simulador.nodes.register(type, handler);
        } else {
            setTimeout(() => window.Simulador.nodes.register(type, handler), 0);
        }
    };

    register('input', (node, state, flow, nodeId, ctx) => {
        ctx.log(`INPUT node (${nodeId}) reached.`);

        // 1. Render Prompt to Chat
        const prompt = ctx.getI18nPrompt(node, 'Por favor, escribe algo para continuar...');

        // We can use a standard bot message for the prompt
        if (window.Simulador.ui && window.Simulador.ui.appendChatMessage) {
            window.Simulador.ui.appendChatMessage('bot', prompt);
        }

        // 2. Set State to 'waiting_for_input'
        // We store the current node Id so the engine knows where to resume
        state._waitingForInput = true;
        state._inputNodeId = nodeId;

        // 3. Stop Engine
        ctx.stop();
    });

})();
