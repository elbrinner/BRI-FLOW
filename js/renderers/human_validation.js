// human_validation.js - renderer for human_validation node
(function () {
    const { adoptTemplate, setupValidation, markFieldUsed } = window.RendererHelpers || {};
    const H = window.FormBuilderHelpers || {};
    const inputRow = H.inputRow || function () { return document.createElement('div'); };

    function renderHumanValidation(node, container) {
        container.innerHTML = '';
        const form = document.createElement('div');
        form.className = 'p-2 space-y-2';
        container.appendChild(form);

        form.appendChild(inputRow({
            label: 'Timeout (seconds)',
            id: 'hv_timeout',
            value: node.timeout || 3600,
            type: 'number'
        }));

        // Approvers could be a list, for now let's use a comma-separated string input
        const approversVal = Array.isArray(node.approvers) ? node.approvers.join(', ') : '';
        form.appendChild(inputRow({
            label: 'Approvers (comma separated roles/ids)',
            id: 'hv_approvers',
            value: approversVal,
            placeholder: 'admin, supervisor'
        }));

        const validator = setupValidation(container, {
            boxId: 'hv_validation_box',
            okMessage: '✔ Validation Config Valid',
            collectState() {
                const timeout = parseInt(container.querySelector('#hv_timeout input')?.value || '0', 10);
                const approvers = (container.querySelector('#hv_approvers input')?.value || '').trim();
                return { timeout, approvers };
            },
            buildRules(st) {
                return [
                    { kind: 'warning', when: st.timeout <= 0, msg: 'Timeout should be positive.' },
                    { kind: 'info', when: !st.approvers, msg: 'No specific approvers (any authorized user).' }
                ];
            }
        });

        container.querySelectorAll('input').forEach(el => {
            el.addEventListener('input', validator.run);
            el.addEventListener('change', validator.run);
        });

        // Bind changes
        container.querySelector('#hv_timeout input').addEventListener('change', e => node.timeout = parseInt(e.target.value, 10));
        container.querySelector('#hv_approvers input').addEventListener('change', e => {
            const val = e.target.value.trim();
            node.approvers = val ? val.split(',').map(s => s.trim()) : [];
        });

        validator.run();
    }

    window.RendererRegistry = window.RendererRegistry || {};
    window.RendererRegistry.human_validation = renderHumanValidation;
})();
