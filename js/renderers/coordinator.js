// coordinator.js - renderer for coordinator node
(function () {
    const { adoptTemplate, setupValidation, markFieldUsed } = window.RendererHelpers || {};
    const H = window.FormBuilderHelpers || {};
    const inputRow = H.inputRow || function () { return document.createElement('div'); };
    const selectRow = H.selectRow || function () { return document.createElement('div'); };

    function renderCoordinator(node, container) {
        container.innerHTML = '';
        const form = document.createElement('div');
        form.className = 'p-2 space-y-2';
        container.appendChild(form);

        // Strategy
        form.appendChild(selectRow({
            label: 'Strategy',
            id: 'coord_strategy',
            value: node.strategy || 'fan_out',
            options: [
                { value: 'fan_out', label: 'Fan Out (Parallel)' },
                { value: 'round_robin', label: 'Round Robin' },
                { value: 'sequential', label: 'Sequential' }
            ]
        }));

        // Sub Agents (List of IDs)
        // Ideally this would be a multi-select of existing nodes/agents.
        // For now, a simple text input with comma separation.
        const subAgentsVal = Array.isArray(node.sub_agents) ? node.sub_agents.join(', ') : '';
        form.appendChild(inputRow({
            label: 'Sub Agents (Node IDs)',
            id: 'coord_sub_agents',
            value: subAgentsVal,
            placeholder: 'agent_call_1, agent_call_2'
        }));

        // Aggregation
        form.appendChild(selectRow({
            label: 'Aggregation',
            id: 'coord_aggregation',
            value: node.aggregation || 'concat',
            options: [
                { value: 'concat', label: 'Concatenate Results' },
                { value: 'summarize', label: 'Summarize (LLM)' },
                { value: 'first', label: 'First Result' }
            ]
        }));

        const validator = setupValidation(container, {
            boxId: 'coord_validation_box',
            okMessage: '✔ Coordinator Config Valid',
            collectState() {
                const strategy = container.querySelector('#coord_strategy select')?.value;
                const subAgents = container.querySelector('#coord_sub_agents input')?.value;
                return { strategy, subAgents };
            },
            buildRules(st) {
                return [
                    { kind: 'warning', when: !st.subAgents, msg: 'No sub-agents defined.' }
                ];
            }
        });

        container.querySelectorAll('input, select').forEach(el => {
            el.addEventListener('input', validator.run);
            el.addEventListener('change', validator.run);
        });

        // Bind changes
        container.querySelector('#coord_strategy select').addEventListener('change', e => node.strategy = e.target.value);
        container.querySelector('#coord_aggregation select').addEventListener('change', e => node.aggregation = e.target.value);
        container.querySelector('#coord_sub_agents input').addEventListener('change', e => {
            const val = e.target.value.trim();
            node.sub_agents = val ? val.split(',').map(s => s.trim()) : [];
        });

        validator.run();
    }

    window.RendererRegistry = window.RendererRegistry || {};
    window.RendererRegistry.coordinator = renderCoordinator;
})();
