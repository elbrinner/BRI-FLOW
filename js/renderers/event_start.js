// event_start.js - renderer for event_start node
(function () {
    const { adoptTemplate, setupValidation, markFieldUsed } = window.RendererHelpers || {};
    const H = window.FormBuilderHelpers || {};
    const inputRow = H.inputRow || function () { return document.createElement('div'); };

    function renderEventStart(node, container) {
        // We can reuse a generic slot or create a specific one if needed.
        // For now, we'll append directly or use a generic container if available.
        // If adoptTemplate is strict about IDs, we might need a new template in index.html,
        // but usually we can just append to container if we don't use adoptTemplate's slot mechanism strictly.
        // Let's try to just clear and append.
        container.innerHTML = '';
        const form = document.createElement('div');
        form.className = 'p-2 space-y-2';
        container.appendChild(form);

        form.appendChild(inputRow({
            label: 'Event Type',
            id: 'event_type',
            value: node.event_type || 'webhook',
            placeholder: 'e.g. webhook, timer, external_signal'
        }));

        form.appendChild(inputRow({
            label: 'Filter Expression (JSON/JS)',
            id: 'filter_expr',
            value: node.filter_expr || '',
            placeholder: 'e.g. payload.type == "urgent"'
        }));

        const validator = setupValidation(container, {
            boxId: 'event_validation_box',
            okMessage: '✔ Event Config Valid',
            collectState() {
                const type = (container.querySelector('#event_type input,#event_type')?.value || '').trim();
                const filter = (container.querySelector('#filter_expr input,#filter_expr')?.value || '').trim();
                return { type, filter };
            },
            buildRules(st) {
                return [
                    { kind: 'error', when: !st.type, msg: 'Event Type is required.' },
                    { kind: 'info', when: !st.filter, msg: 'No filter defined (accepts all).' }
                ];
            }
        });

        container.querySelectorAll('input').forEach(el => {
            el.addEventListener('input', validator.run);
            el.addEventListener('change', validator.run);
        });

        // Bind changes back to node
        container.querySelector('#event_type input').addEventListener('change', e => node.event_type = e.target.value);
        container.querySelector('#filter_expr input').addEventListener('change', e => node.filter_expr = e.target.value);

        validator.run();
    }

    window.RendererRegistry = window.RendererRegistry || {};
    window.RendererRegistry.event_start = renderEventStart;
})();
