// js/simulador/nodes/coordinator.js
(function () {
    'use strict';

    const register = (type, handler) => {
        setTimeout(() => window.Simulador.nodes.register(type, handler), 0);
    };

    register('coordinator', async (node, state, flow, nodeId, ctx) => {
        ctx.log(`COORDINATOR: Strategy=${node.strategy}, Aggregation=${node.aggregation}`);

        const subAgents = node.sub_agents || [];
        if (subAgents.length === 0) {
            ctx.log('⚠️ No sub-agents defined.');
            state.current = ctx.gotoNext(node.next);
            ctx.scheduleStep();
            return;
        }

        ctx.log(`Dispatching to ${subAgents.length} agents: ${subAgents.join(', ')}`);

        // Simulation of Fan-Out
        // In a real backend, this would trigger parallel jobs.
        // In this simulator, we will just simulate the "Result" of calling these agents.
        // If the sub-agents are actual nodes in the flow, we can't easily "call" them in parallel 
        // without complex state management (stack frames, etc.).
        // So we will assume 'sub_agents' refers to "Agent Profiles" or "External Agents" 
        // and we mock their response or call them sequentially if possible.

        const results = [];

        // Mock execution for simulation
        for (const agentId of subAgents) {
            ctx.log(`[Sim] Calling sub-agent: ${agentId}...`);
            // Simulate delay
            await new Promise(r => setTimeout(r, 500));

            // Mock result
            results.push({
                agent: agentId,
                output: `Result from ${agentId} (Simulated)`
            });
        }

        // Aggregation
        let aggregatedOutput = '';
        if (node.aggregation === 'concat') {
            aggregatedOutput = results.map(r => `${r.agent}: ${r.output}`).join('\n');
        } else if (node.aggregation === 'first') {
            aggregatedOutput = results[0]?.output || '';
        } else {
            aggregatedOutput = JSON.stringify(results);
        }

        ctx.log(`Aggregation Complete. Result length: ${aggregatedOutput.length}`);

        // Save result
        const saveKey = node.save_as || `coord_${nodeId}`;
        state.variables[saveKey] = aggregatedOutput;

        state.current = ctx.gotoNext(node.next);
        ctx.scheduleStep();
    });
})();
