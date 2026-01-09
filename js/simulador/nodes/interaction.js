// js/simulador/nodes/interaction.js
(function () {
    'use strict';

    const register = (type, handler) => {
        setTimeout(() => window.Simulador.nodes.register(type, handler), 0);
    };

    register('choice', (node, state, flow, nodeId, ctx) => {
        // Render choice UI as a Card with Actions in the Chat
        const choices = node.options || [];
        const actions = choices.map((opt, i) => ({
            label: ctx.getOptionLabel(opt) || `Opción ${i + 1}`,
            action: 'option_click', // Internal action type
            value: opt.value, // value to save
            target: opt.target || opt.next, // target node
            // You might want to pass 'opt' fully if needed
        }));

        const card = {
            type: 'card',
            title: ctx.getI18nPrompt(node, 'Elige una opción'),
            actions: actions
        };

        // Render to Chat
        if (window.Simulador.ui && window.Simulador.ui.appendChatMessage) {
            // We need a way to handle the action click. 
            // rendering the component manually ensures we catch the callback.
            const container = document.createElement('div');
            window.Simulador.ui.renderUIComponent(container, card, (action) => {
                // Action Handler
                ctx.log(`CHOICE selected: ${action.label} -> ${action.target}`);
                const saveKey = node.save_as || `selected_choice_${nodeId}`;
                const val = action.value !== undefined ? action.value : action.label;

                state.variables[saveKey] = val;
                state.current = ctx.gotoNext(action.target);

                // Update UI to show selection (optional: disable buttons or remove card?)
                // For now, let's keep it simple.

                ctx.renderPreview();
                ctx.renderVariables();

                // Resume engine
                if (window.Simulador.engine) {
                    window.Simulador.engine.running = true;
                    window.Simulador.engine.step();
                }
            });

            window.Simulador.ui.appendChatMessage('bot', container);
        }

        // Stop execution to wait for user input
        ctx.stop();
    });

    // TODO: Add button, multi_button handlers

    register('button', (node, state, flow, nodeId, ctx) => {
        const options = node.options || [];
        const actions = options.map((opt, i) => ({
            label: ctx.getOptionLabel(opt) || `Botón ${i + 1}`,
            action: 'button_click',
            value: opt.value,
            target: opt.target || opt.next
        }));

        const card = {
            type: 'card',
            title: ctx.getI18nPrompt(node, 'Selecciona una opción'),
            actions: actions
        };

        if (window.Simulador.ui && window.Simulador.ui.appendChatMessage) {
            const container = document.createElement('div');
            window.Simulador.ui.renderUIComponent(container, card, (action) => {
                ctx.log(`BUTTON click: ${action.label} -> ${action.target}`);
                const saveKey = node.save_as || `selected_button_${nodeId}`;
                // Button often saves value or label
                const val = action.value || action.label;

                state.variables[saveKey] = val;
                state.current = ctx.gotoNext(action.target);

                ctx.renderPreview();
                ctx.renderVariables();

                if (window.Simulador.engine) {
                    window.Simulador.engine.running = true;
                    window.Simulador.engine.step();
                }
            });
            window.Simulador.ui.appendChatMessage('bot', container);
        }
        ctx.stop();
    });

    register('multi_button', (node, state, flow, nodeId, ctx) => {
        // 1. Resolve Options
        let items = [];
        const provider = node.provider || {};
        const srcExpr = node.src || node.source_list || provider.source_list || null;

        // Helper to evaluate in scope
        const evalInScope = (expr, item, index) => {
            const scope = Object.assign({}, state.variables, { item, index });
            return ctx.evaluate(expr, scope);
        };

        if (srcExpr) {
            try {
                const sourceList = ctx.evaluate(srcExpr, state.variables);
                if (Array.isArray(sourceList)) {
                    let filtered = sourceList;
                    // Filter
                    const filterExpr = node.filterExpr || node.filter_expr || provider.filter_expr;
                    if (filterExpr) {
                        filtered = filtered.filter((it, idx) => {
                            try { return !!evalInScope(filterExpr, it, idx); } catch (e) { return true; }
                        });
                    }
                    // Sort (Skipping complex sort for brevity, usually not critical in sim)

                    // Map
                    const labelExpr = node.labelExpr || node.label_expr || provider.label_expr || 'item.label || item.name || item';
                    const valueExpr = node.valueExpr || node.value_expr || provider.value_expr || 'item.value || item.name || item';

                    items = filtered.map((it, i) => {
                        let lbl = evalInScope(labelExpr, it, i);
                        if (lbl === undefined || lbl === null) lbl = `Opción ${i + 1}`;
                        // Resolve i18n object if needed
                        if (typeof lbl === 'object') lbl = lbl[window.Simulador.selected_locale || 'es'] || lbl.es || lbl;

                        const val = evalInScope(valueExpr, it, i);
                        return { label: String(lbl), value: (val !== undefined) ? val : String(lbl) };
                    });
                }
            } catch (e) {
                ctx.log(`Error processing source_list: ${e.message}`);
            }
        }

        // Fallback to static options
        if (!items || items.length === 0) {
            items = (node.options || []).map((o, i) => ({
                label: ctx.getOptionLabel(o) || `Opción ${i + 1}`,
                value: (o.value !== undefined) ? o.value : (ctx.getOptionLabel(o) || `Opción ${i + 1}`)
            }));
        }

        // 2. Render UI
        const container = document.createElement('div');
        container.className = 'flex flex-col gap-2 mt-2 p-2 border rounded bg-gray-50';

        const title = document.createElement('div');
        title.className = 'font-semibold text-sm mb-2';
        title.textContent = ctx.getI18nPrompt(node, 'Selecciona opciones');
        container.appendChild(title);

        // Preselection
        const saveKey = node.save_as || node.saveAs || `selected_buttons_${nodeId}`;
        const preselected = new Set(Array.isArray(state.variables[saveKey]) ? state.variables[saveKey].map(String) : []);
        const currentSelection = new Set(preselected);

        const list = document.createElement('div');
        list.className = 'flex flex-col gap-1 max-h-48 overflow-y-auto';

        const updateStatus = () => {
            const count = currentSelection.size;
            let msg = `${count} seleccionada${count === 1 ? '' : 's'}`;
            let valid = true;

            const minSel = node.min_selected ?? node.minSelected ?? null;
            const maxSel = node.max_selected ?? node.maxSelected ?? null;

            if (minSel !== null && count < minSel) { msg += ` (Min: ${minSel})`; valid = false; }
            if (maxSel !== null && count > maxSel) { msg += ` (Max: ${maxSel})`; valid = false; }

            statusLabel.textContent = msg;
            btnContinue.disabled = !valid;
            btnContinue.classList.toggle('opacity-50', !valid);
        };

        items.forEach((it) => {
            const row = document.createElement('label');
            row.className = 'flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-100 p-1 rounded';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.value = String(it.value);
            cb.checked = currentSelection.has(String(it.value));

            cb.addEventListener('change', () => {
                const v = String(it.value);
                if (cb.checked) currentSelection.add(v); else currentSelection.delete(v);
                updateStatus();
            });

            const span = document.createElement('span');
            span.textContent = it.label;

            row.appendChild(cb);
            row.appendChild(span);
            list.appendChild(row);
        });
        container.appendChild(list);

        // Footer: Status + Continue
        const footer = document.createElement('div');
        footer.className = 'mt-3 flex justify-between items-center border-t pt-2';

        const statusLabel = document.createElement('div');
        statusLabel.className = 'text-xs text-gray-500';
        footer.appendChild(statusLabel);

        const btnContinue = document.createElement('button');
        btnContinue.textContent = 'Continuar';
        btnContinue.className = 'px-3 py-1 bg-sky-600 text-white rounded text-xs font-bold uppercase tracking-wider';
        btnContinue.addEventListener('click', () => {
            const selectionArr = Array.from(currentSelection);

            // Save
            state.variables[saveKey] = selectionArr;
            state.selections = state.selections || {};
            state.selections[nodeId] = { type: 'multi_button', selected: selectionArr, at: new Date().toISOString() };

            // Feedback
            ctx.log(`MULTI_BUTTON selected: ${selectionArr.length} items`);
            if (window.Simulador.nodes.createSavedChip) {
                ctx.appendChatMessage('bot', window.Simulador.nodes.createSavedChip(saveKey, JSON.stringify(selectionArr)));
            }

            // Next
            state.current = ctx.gotoNext(node.next);
            ctx.scheduleStep();
        });

        footer.appendChild(btnContinue);
        container.appendChild(footer);

        updateStatus(); // Init status

        // Append to Chat
        ctx.appendChatMessage('bot', container);
        ctx.stop(); // Wait for interaction
    });
})();
