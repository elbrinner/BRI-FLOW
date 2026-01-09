(function () {
    'use strict';

    const register = (type, handler) => {
        setTimeout(() => window.Simulador.nodes.register(type, handler), 0);
    };

    register('form', (node, state, flow, nodeId, ctx) => {
        ctx.log(`FORM (${nodeId}) - Rendering form...`);

        // 1. Build Fields
        let fields = Array.isArray(node.fields) ? node.fields : [];
        const mode = node.mode || 'static';
        const srcKey = node.fields_source || node.FieldsSource || (node.provider && node.provider.source_list);

        if (mode === 'dynamic' && srcKey) {
            try {
                // Try to get variable from state
                let payload = state.variables[srcKey];
                // Fallback to flow default variable if not in state? (Simulator usually relies on runtime state)

                const arr = Array.isArray(payload) ? payload : (payload && payload.items ? payload.items : (payload ? [payload] : []));

                // Helper to normalize
                const toTextType = (ft) => {
                    const s = String(ft || '').toUpperCase();
                    if (['LONG', 'TEXTAREA', 'MULTILINE'].includes(s)) return 'textarea';
                    if (['SHORT', 'TEXT', 'STRING'].includes(s)) return 'text';
                    if (['PASSWORD'].includes(s)) return 'password';
                    if (['NUMBER', 'INT', 'FLOAT', 'DECIMAL'].includes(s)) return 'number';
                    if (['EMAIL'].includes(s)) return 'email';
                    if (['DATE', 'DATETIME'].includes(s)) return 'date';
                    if (['SELECT', 'DROPDOWN', 'CHOICE'].includes(s)) return 'select';
                    if (['CHECKBOX', 'BOOLEAN', 'TOGGLE'].includes(s)) return 'checkbox';
                    if (['RADIO'].includes(s)) return 'radio';
                    return 'text';
                };

                const normalizeOptions = (opts) => {
                    if (!opts) return undefined;
                    let raw = opts;
                    if (!Array.isArray(raw)) raw = raw.options || raw.items || raw.choices || raw.values || [];
                    if (!Array.isArray(raw)) return undefined;
                    return raw.map(o => {
                        const lbl = o.label ?? o.text ?? o.title ?? o.name ?? o.key ?? o.id ?? String(o);
                        const val = o.value ?? o.id ?? o.key ?? lbl;
                        return { label: lbl, value: val };
                    });
                };

                const built = [];
                arr.forEach(item => {
                    try {
                        const base = (item && typeof item === 'object') ? item : { Name: String(item || '') };
                        const d = base.field || base;
                        const name = d.Name || d.name || d.FieldName || d.nameprop || d.key || d.code || d.id || d.var || '';
                        if (!name) return;

                        let label = d.Prompt || d.prompt || d.Label || d.label || d.title || d.text || d.desc || name;
                        if (typeof label === 'object') label = label.es || label[Object.keys(label)[0]];

                        const type = toTextType(d.FieldType || d.fieldType || d.type);
                        const placeholder = d.Placeholder || d.placeholder || '';
                        const options = normalizeOptions(d.options || d.Options || d.choices || d.items || d.values);
                        const required = !!(d.required || d.Required || d.isRequired || d.mandatory);
                        const rows = d.rows || d.Rows;
                        const value = d.default ?? d.value ?? d.initial;

                        built.push({ name, label, type, placeholder, options, required, rows, value });
                    } catch (e) { ctx.log('Error building field: ' + e.message); }
                });
                if (built.length) fields = built;
            } catch (e) {
                ctx.log('Error processing dynamic fields: ' + e.message);
            }
        }

        // 2. Render Form UI
        const formWrap = document.createElement('div');
        const formTitle = document.createElement('div');
        formTitle.className = 'font-semibold mb-2';
        formTitle.textContent = ctx.getI18nPrompt(node, 'Completa el formulario');

        const form = document.createElement('form');
        form.className = 'mt-1 space-y-3';
        const requiredFields = new Set();

        fields.forEach((field, idx) => {
            const fieldDiv = document.createElement('div');
            const label = document.createElement('label');
            label.className = 'block text-sm font-medium text-gray-700';
            label.textContent = ctx.getI18nPrompt(field, field.label || `Campo ${idx + 1}`);
            fieldDiv.appendChild(label);

            let input;
            const fieldType = field.type || 'text';

            if (fieldType === 'textarea') {
                input = document.createElement('textarea');
                input.className = 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm';
                input.rows = field.rows || 3;
            } else if (fieldType === 'select') {
                input = document.createElement('select');
                input.className = 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm bg-white';
                const options = Array.isArray(field.options) ? field.options : [];
                options.forEach((opt) => {
                    const optEl = document.createElement('option');
                    optEl.value = opt.value !== undefined ? opt.value : opt.label;
                    optEl.textContent = opt.label || opt.value;
                    input.appendChild(optEl);
                });
            } else if (fieldType === 'checkbox') {
                input = document.createElement('input');
                input.type = 'checkbox';
                input.className = 'mt-1';
                const preVal = state.variables[field.name];
                if (preVal === true || preVal === 'true') input.checked = true;
            } else {
                input = document.createElement('input');
                input.type = fieldType;
                input.className = 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm';
                if (field.placeholder) input.placeholder = field.placeholder;
            }

            if (field.required) { requiredFields.add(field.name); input.required = true; }

            if (field.name) {
                input.name = field.name;
                const preVal = state.variables[field.name];
                // Init value
                if (preVal !== undefined && preVal !== null && fieldType !== 'checkbox') {
                    input.value = String(preVal);
                } else if (field.value !== undefined && fieldType !== 'checkbox') {
                    input.value = String(field.value);
                }
            }

            fieldDiv.appendChild(input);
            form.appendChild(fieldDiv);
        });

        // Actions
        const actions = document.createElement('div');
        actions.className = 'mt-3 flex gap-2';

        const btnSubmit = document.createElement('button');
        btnSubmit.type = 'submit';
        btnSubmit.textContent = 'Enviar';
        btnSubmit.className = 'px-4 py-2 bg-sky-600 text-white rounded text-sm hover:bg-sky-700';

        const btnCancel = document.createElement('button');
        btnCancel.type = 'button';
        btnCancel.textContent = 'Cancelar';
        btnCancel.className = 'px-4 py-2 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300';
        btnCancel.onclick = () => {
            state.current = ctx.gotoNext(node.next);
            ctx.scheduleStep();
        };

        actions.appendChild(btnSubmit);
        actions.appendChild(btnCancel);

        formWrap.appendChild(formTitle);
        formWrap.appendChild(form);
        formWrap.appendChild(actions);

        // Submit Logic
        form.onsubmit = (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const dataObj = {};

            // Check required (simple check, browser handles most)
            let valid = true;

            // Populate data
            // Handle checkboxes specifically because FormData might exclude unchecked? 
            // Actually new FormData(form) includes checked checkboxes. Unchecked are missing.
            // But we iterate fields.

            fields.forEach(f => {
                if (!f.name) return;
                let val = formData.get(f.name);
                if (f.type === 'checkbox') {
                    // Checkbox value is 'on' if stored without value attr, or the value attr.
                    // We want boolean usually or the value if part of set.
                    // Here simple boolean field assumption.
                    const el = form.querySelector(`[name="${f.name}"]`);
                    val = el ? el.checked : false;
                }
                dataObj[f.name] = val;
            });

            // Iterate remaining FormData for non-defined fields (if any) or overwrite
            for (let [k, v] of formData.entries()) {
                if (dataObj[k] === undefined) dataObj[k] = v;
            }

            // Save to variables
            const saveAs = node.save_as || `form_${nodeId}`;
            state.variables[saveAs] = dataObj;

            // Also flatten to root variables? Yes, standard behavior usually
            Object.assign(state.variables, dataObj);

            ctx.log(`FORM submitted: ${JSON.stringify(dataObj)}`);

            // Chip
            if (window.Simulador.nodes.createSavedChip) {
                ctx.appendChatMessage('bot', window.Simulador.nodes.createSavedChip('form', Object.keys(dataObj).join(', ')));
            }

            state.history.push({ node: nodeId, type: 'form', data: dataObj });
            state.current = ctx.gotoNext(node.next);
            ctx.renderVariables();
            ctx.scheduleStep();
        };

        // Render to Chat
        const chatCard = document.createElement('div');
        chatCard.className = 'bg-white border rounded p-3 max-w-[520px] shadow-sm flex flex-col gap-3';
        chatCard.appendChild(formWrap);

        ctx.appendChatMessage('bot', chatCard);

        ctx.stop(); // Interaction pause
    });
})();
