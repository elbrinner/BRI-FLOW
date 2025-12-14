// js/simulador/nodes/interaction.js
(function () {
    'use strict';

    const register = (type, handler) => {
        setTimeout(() => window.Simulador.nodes.register(type, handler), 0);
    };

    register('choice', (node, state, flow, nodeId, ctx) => {
        // Render choice UI
        const choices = node.options || []; // Simplified

        // We need to render buttons in the preview panel
        const panel = document.getElementById('simulatorCanvasPreview');
        if (!panel) return;

        panel.innerHTML = '';
        const title = document.createElement('div');
        title.className = 'font-semibold';
        title.textContent = ctx.getI18nPrompt(node, 'Elige una opción');
        panel.appendChild(title);

        const btns = document.createElement('div');
        btns.style.display = 'flex';
        btns.style.flexDirection = 'column';
        btns.style.gap = '8px';
        btns.style.marginTop = '8px';

        choices.forEach((opt, i) => {
            const b = document.createElement('button');
            b.className = 'px-3 py-1 bg-white border rounded text-sm';
            b.textContent = ctx.getOptionLabel(opt) || `Opción ${i + 1}`;
            b.addEventListener('click', () => {
                const target = opt.target || opt.next || null;
                ctx.log(`CHOICE selected: ${b.textContent} -> ${target}`);

                const saveKey = node.save_as || `selected_choice_${nodeId}`;
                const val = opt.value !== undefined ? opt.value : b.textContent;
                state.variables[saveKey] = val;

                state.current = ctx.gotoNext(target);
                ctx.renderPreview();
                ctx.renderVariables();
                ctx.scheduleStep(200);
            });
            btns.appendChild(b);
        });
        panel.appendChild(btns);

        // Stop execution to wait for user input
        ctx.stop();
    });

    // TODO: Add button, multi_button handlers

    register('button', (node, state, flow, nodeId, ctx) => {
        // Similar to choice but different UI style usually
        const panel = document.getElementById('simulatorCanvasPreview');
        if (!panel) return;

        panel.innerHTML = '';
        const title = document.createElement('div');
        title.className = 'font-semibold';
        title.textContent = ctx.getI18nPrompt(node, 'Selecciona una opción');
        panel.appendChild(title);

        const btns = document.createElement('div');
        btns.className = 'flex flex-wrap gap-2 mt-2';

        const options = node.options || [];
        options.forEach((opt, i) => {
            const b = document.createElement('button');
            b.className = 'px-4 py-2 bg-blue-100 text-blue-800 rounded hover:bg-blue-200';
            b.textContent = ctx.getOptionLabel(opt) || `Botón ${i + 1}`;
            b.onclick = () => {
                const target = opt.target || opt.next;
                ctx.log(`BUTTON click: ${b.textContent} -> ${target}`);

                const saveKey = node.save_as || `selected_button_${nodeId}`;
                state.variables[saveKey] = opt.value || b.textContent;

                state.current = ctx.gotoNext(target);
                ctx.renderPreview();
                ctx.renderVariables();
                ctx.scheduleStep();
            };
            btns.appendChild(b);
        });
        panel.appendChild(btns);
        ctx.stop();
    });
})();
