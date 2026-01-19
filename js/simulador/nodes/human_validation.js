// js/simulador/nodes/human_validation.js
(function () {
    'use strict';

    const register = (type, handler) => {
        setTimeout(() => window.Simulador.nodes.register(type, handler), 0);
    };

    register('human_validation', (node, state, flow, nodeId, ctx) => {
        ctx.log('HUMAN_VALIDATION: Pausing for approval...');

        // 1. Render Approval Card
        const approvalCard = {
            type: 'card',
            title: '⚠️ Human Validation Required',
            data: {
                'Node ID': nodeId,
                'Timeout': (node.timeout || 3600) + 's',
                'Approvers': (Array.isArray(node.approvers) ? node.approvers.join(', ') : 'Any'),
                'Status': 'Pending'
            },
            actions: [
                { label: '✅ Approve', action: 'approve', style: 'primary' },
                { label: '❌ Reject', action: 'reject', style: 'danger' }
            ]
        };

        // Helper to resume execution
        const handleAction = (action) => {
            ctx.log(`HUMAN_VALIDATION: Action received -> ${action.action}`);

            // Update state
            const saveKey = node.save_as || `validation_${nodeId}`;
            state.variables[saveKey] = {
                status: action.action, // 'approve' or 'reject'
                at: new Date().toISOString(),
                by: 'simulator_user'
            };

            // Resume
            // We need to find the next node based on approval? 
            // Usually human_validation might have 'approved'/'rejected' paths or just one 'next'.
            // For now, assuming linear flow or simple next.
            // If the node has specific outputs for approve/reject, we should handle them.
            // But standard node structure usually has just 'next'.
            // Let's assume the flow logic (Condition node) handles the branching based on the variable.

            state.current = ctx.gotoNext(node.next);

            // Re-enable engine
            if (window.Simulador.engine) {
                window.Simulador.engine.running = true;
                window.Simulador.engine.step();
            }

            // Update UI to show it's done (optional, maybe disable buttons)
            // For now, just log
            ctx.log(`Resuming execution...`);
        };

        // Render to Chat with callback
        if (window.Simulador.ui && window.Simulador.ui.appendChatMessage) {
            // We need to manually render because appendChatMessage wraps it in a bubble
            // and we need to pass the callback.
            // Actually, appendChatMessage calls renderUIComponent internally for JSON strings,
            // but for Objects it also calls it.
            // However, `appendChatMessage` signature is (role, content).
            // It doesn't accept a callback arg.
            // We need to modify `appendChatMessage` to accept a callback or return the element so we can hook it?
            // OR, we can construct the element here and pass it as HTMLElement to appendChatMessage.

            const container = document.createElement('div');
            // Use the global renderUIComponent directly
            if (window.Simulador.ui.renderUIComponent) {
                window.Simulador.ui.renderUIComponent(container, approvalCard, handleAction);
            }

            window.Simulador.ui.appendChatMessage('bot', container);
        }

        // 2. Stop Engine
        ctx.stop();
    });
})();
