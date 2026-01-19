(function () {
    'use strict';

    const register = (type, handler) => {
        setTimeout(() => window.Simulador.nodes.register(type, handler), 0);
    };

    register('response', (node, state, flow, nodeId, ctx) => {
        // Extract localized text
        let text = ctx.getI18nText(node);

        // Evaluate text (interpolation, markdown)
        try {
            if (ctx.evaluate) {
                // If the text looks like markdown or node has markdown flag, process it
                const isMarkdown = (node.render_markdown || node.renderMarkdown) ||
                    (window.Simulador.evaluator && window.Simulador.evaluator.looksLikeMarkdown(text));

                // We use processText if available in evaluator, otherwise simple evaluate/interpolate
                if (window.Simulador.evaluator && window.Simulador.evaluator.processText) {
                    text = window.Simulador.evaluator.processText(text, isMarkdown);
                } else {
                    text = ctx.evaluate(text, state.variables);
                }
            }
        } catch (e) {
            ctx.log(`Error evaluating response text: ${e.message}`);
        }

        if (!text && !node.options && !node.buttons) {
            text = '(empty response)';
        }

        // Helper to handle completion
        const finishStep = () => {
            // Handle Options/Buttons if present
            const options = [];
            if (Array.isArray(node.options)) options.push(...node.options);
            if (Array.isArray(node.choices)) options.push(...node.choices);
            // Compat with buttons array in response node
            if (Array.isArray(node.buttons)) options.push(...node.buttons.map(b => ({
                label: b.label || b.text,
                target: b.next || b.target,
                value: b.value
            })));
            if (Array.isArray(node.quick_replies)) options.push(...node.quick_replies);

            if (options.length > 0) {
                // Render Options using UI Component
                // We construct a temporary "card" or just a list of buttons
                // Ideally we use renderUIComponent with type 'options_list' or similar, 
                // but for now we'll manually build the button container as processResponse did, 
                // OR use the 'card' style if we want to modernize.
                // Let's stick to the simple button list for 'response' node compatibility.

                const container = document.createElement('div');
                container.className = 'flex flex-col gap-2 mt-2';

                options.forEach((opt, i) => {
                    const label = ctx.evaluate(ctx.getOptionLabel(opt) || `Opción ${i + 1}`, state.variables);
                    const btn = document.createElement('button');
                    btn.className = 'px-3 py-1 bg-white border rounded text-sm hover:bg-gray-50 text-left';
                    btn.textContent = label;
                    btn.addEventListener('click', () => {
                        ctx.log(`RESPONSE option selected: ${label}`);

                        // Save variable
                        const val = opt.value !== undefined ? opt.value : label;
                        const saveKey = node.save_as || node.saveAs || `selected_choice_${nodeId}`;
                        state.variables[saveKey] = val;

                        // Save selection metadata
                        state.selections = state.selections || { choice: {} };
                        state.selections.choice[nodeId] = {
                            label, value: val, index: i, at: new Date().toISOString()
                        };

                        // Render chip in chat (visual feedback of selection)
                        if (window.Simulador.nodes.createSavedChip) {
                            ctx.appendChatMessage('bot', window.Simulador.nodes.createSavedChip(saveKey, val));
                        }

                        // Next
                        state.current = ctx.gotoNext(opt.target || opt.next || node.next);
                        ctx.renderVariables();
                        ctx.scheduleStep(ctx.fastMode ? 0 : ctx.stepDelay);
                    });
                    container.appendChild(btn);
                });

                ctx.appendChatMessage('bot', container);
                // Stop here (don't schedule next step automatically)
            } else {
                // No options, auto-advance
                state.current = ctx.gotoNext(node.next);
                ctx.scheduleStep();
            }
        };

        // Render Message
        if (text) {
            ctx.appendChatMessage('bot', text);
        }

        // Finish (delay if typing?) 
        // For simplicity in modular node, we assume appendChatMessage handles the "appearance" 
        // but if we want typing effect we might need ctx.showTyping (not currently in ctx).
        // processResponse had showTyping logic. 
        // We will assume immediate for now or add setTimeout.

        finishStep();
    });
})();
