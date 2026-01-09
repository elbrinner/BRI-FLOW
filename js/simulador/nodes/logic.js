// js/simulador/nodes/logic.js
(function () {
    'use strict';

    // Wait for registry
    const register = (type, handler) => {
        if (window.Simulador && window.Simulador.nodes && window.Simulador.nodes.register) {
            window.Simulador.nodes.register(type, handler);
        } else {
            // Retry or assume loaded later? 
            // Better to wrap in a timeout or ensure load order. 
            // For now, assume index.js is loaded before.
            setTimeout(() => window.Simulador.nodes.register(type, handler), 0);
        }
    };

    register('condition', (node, state, flow, nodeId, ctx) => {
        const expr = node.expr || node.expression || node.value || '';
        const res = ctx.evaluate(expr, state.variables);
        const target = res ? (node.true_target && node.true_target.node_id) : (node.false_target && node.false_target.node_id);
        ctx.log(`COND (${nodeId}): ${expr} => ${res} -> ${target}`);
        state.current = ctx.gotoNext(target);
        ctx.scheduleStep();
    });

    register('debug', (node, state, flow, nodeId, ctx) => {
        const rawMsg = node.message || node.text || ctx.getI18nText(node, node.message || node.text || '');
        // Assume processText is available in utils or core
        const text = rawMsg; // Simplified

        if (window.Simulador.ui && window.Simulador.ui.appendChatMessage) {
            window.Simulador.ui.appendChatMessage('bot', text);
        }

        // Payload logic...
        const saveKey = node.save_as || node.saveAs || node.variable;
        if (saveKey) {
            state.variables[saveKey] = node.payload; // Simplified
        }

        state.history.push({ node: nodeId, type: 'debug', message: text });
        state.current = ctx.gotoNext(node.next);
        ctx.scheduleStep();
    });

    register('end', (node, state, flow, nodeId, ctx) => {
        ctx.log('END reached.');
        if (ctx.returnFromFlow && ctx.returnFromFlow()) {
            return; // Returned to parent flow
        }
        ctx.stop();
    });

    // --- LOOP / WHILE / FOREACH ---
    const handleLoopLogic = (node, state, flow, nodeId, ctx) => {
        // Initialize loop counter if needed
        const loopKey = `_loop_${nodeId}`;
        state.variables[loopKey] = (state.variables[loopKey] || 0) + 1;

        ctx.log(`LOOP ${node.type} (${nodeId}) iteration ${state.variables[loopKey]}`);

        // Simple infinite loop or max iterations guard?
        if (state.variables[loopKey] > 100) {
            ctx.log('⚠️ Loop limit reached (100), breaking.');
            state.current = ctx.gotoNext(node.next); // Break
        } else {
            // Loop body usually is 'first_node' or 'true_target' depends on definition. 
            // In standard BriFlow, Loop might have 'next' as the loop body start? 
            // Or it's a container? Based on renderer_loop.js, it seems to have a 'next' which is the loop start.
            // And usually a way to break?
            state.current = ctx.gotoNext(node.next);
        }
        ctx.scheduleStep();
    };

    register('loop', handleLoopLogic);

    register('while', (node, state, flow, nodeId, ctx) => {
        const expr = node.condition || node.expression || 'false';
        const isTrue = ctx.evaluate(expr, state.variables);

        ctx.log(`WHILE (${nodeId}): ${expr} => ${isTrue}`);

        if (isTrue) {
            // True -> Loop Body (usually node.next)
            // But we need to verify where the 'Loop End' points to. 
            // In simple flows, While -> Body -> ... -> While.
            state.current = ctx.gotoNext(node.next);
        } else {
            // False -> Exit
            // Where is exit? 'false_target'? or automatic?
            // If while behaves like 'Condition', false_target is exit.
            state.current = ctx.gotoNext(node.false_target || node.next_false);
        }
        ctx.scheduleStep();
    });

    register('foreach', (node, state, flow, nodeId, ctx) => {
        const items = ctx.evaluate(node.items || node.array || '[]', state.variables);
        const varName = node.item_var || 'item';
        const indexVar = node.index_var || 'index';

        // Internal state for iterator
        const loopKey = `_foreach_${nodeId}`;
        let currentIndex = state.variables[loopKey];

        if (!Array.isArray(items)) {
            ctx.log(`FOREACH error: items is not array (${typeof items})`);
            state.current = ctx.gotoNext(node.done_target || node.next_done);
            ctx.scheduleStep();
            return;
        }

        if (currentIndex === undefined || currentIndex === null) {
            currentIndex = 0; // Init
        }

        if (currentIndex < items.length) {
            // Next Item
            state.variables[varName] = items[currentIndex];
            state.variables[indexVar] = currentIndex;
            state.variables[loopKey] = currentIndex + 1; // Increment for NEXT time (or current?)

            // Actually we should increment AFTER the body... 
            // BUT, in a linear flow, we come BACK to this node?
            // If so, we need to know if we are entering fresh or re-entering.
            // Re-entering logic is complex without 'entry' vs 'continue' ports.
            // Simplified Assumption: Foreach node IS the entry point.
            // It sends to 'next' (body). Body MUST end pointing back to Foreach.

            ctx.log(`FOREACH index ${currentIndex}/${items.length}`);
            state.current = ctx.gotoNext(node.next);
        } else {
            // Done
            ctx.log(`FOREACH Done.`);
            delete state.variables[loopKey]; // Cleanup
            state.current = ctx.gotoNext(node.done_target || node.next_done);
        }
        ctx.scheduleStep();
    });

    // --- ASSIGN VAR ---
    register('assign_var', (node, state, flow, nodeId, ctx) => {
        const assignments = node.assignments || []; // [{var, value}, ...]
        // Support single assignment props too (legacy or simplified)
        if (node.variable && node.value) {
            assignments.push({ variable: node.variable, value: node.value });
        } else if (node.target && node.value) {
            assignments.push({ variable: node.target, value: node.value });
        }

        assignments.forEach(assign => {
            const varName = assign.variable || assign.target;
            if (!varName) return;

            // Evaluate value (supports {{var}} due to core.evaluate)
            const val = ctx.evaluate(assign.value, state.variables);

            // Support dot notation for assignments? (e.g. "user.name")
            // ctx.api doesn't have setVariable? ctx does?
            // Engine usually just sets assign.variable in state.variables.
            // If we want dot support, we need a helper.
            // For now, simple assignment.
            state.variables[varName] = val;

            ctx.log(`ASSIGN: ${varName} = ${JSON.stringify(val)}`);
        });

        state.current = ctx.gotoNext(node.next);
        ctx.scheduleStep();
    });

    // --- FLOW JUMP ---
    register('start', (node, state, flow, nodeId, ctx) => {
        ctx.log(`START (${nodeId})`);
        state.current = ctx.gotoNext(node.next);
        ctx.scheduleStep();
    });

    // --- FLOW JUMP ---
    register('flow_jump', (node, state, flow, nodeId, ctx) => {
        const targetFlowId = node.target_flow || node.flow_id || (node.target && node.target.flow_id);
        const targetNodeId = (node.target && node.target.node_id) || null; // Optional start node override
        ctx.log(`FLOW_JUMP -> ${targetFlowId}`);

        if (!targetFlowId) {
            ctx.log('⚠️ Flow Jump without target_flow');
            state.current = ctx.gotoNext(node.next); // Skip
            ctx.scheduleStep();
            return;
        }

        // Find Target Flow
        const projectFlows = window.AppProject ? window.AppProject.flows : {};
        const targetFlow = projectFlows[targetFlowId];

        if (!targetFlow) {
            ctx.log(`⚠️ Target Flow "${targetFlowId}" not found in project.`);
            state.current = ctx.gotoNext(node.next); // Skip
            ctx.scheduleStep();
            return;
        }

        // Push to Call Stack
        const returnToNodeId = ctx.gotoNext(node.next);

        if (!state.callStack) state.callStack = [];
        state.callStack.push({
            flowId: flow.flow_id || flow.id,
            nodeId: nodeId, // The jump node itself
            returnToNodeId: returnToNodeId
        });

        // Determine Start Node
        let startNode = targetNodeId || targetFlow.start_node || targetFlow._start;

        // Fallback: Check for 'start' meta in state if active? No, we are switching flows.
        // Fallback: Search for node with type 'start'
        if (!startNode && targetFlow.nodes) {
            const explicitStart = Object.values(targetFlow.nodes).find(n => n.type === 'start');
            if (explicitStart) startNode = explicitStart.id || explicitStart.node_id;
        }

        ctx.log(`🔀 Jumping to ${targetFlowId} (Start: ${startNode})`);

        // Update Current Flow (Global reference in Simulator)
        if (window.Simulador && window.Simulador.flow) {
            window.Simulador.flow.currentFlow = targetFlow;
        }

        // Update State
        state.current = startNode;

        if (!state.current) {
            ctx.log(`⚠️ Target Flow "${targetFlowId}" has no start node.`);
            // Rollback
            state.callStack.pop();
            window.Simulador.flow.currentFlow = flow;
            state.current = returnToNodeId;
        }

        ctx.scheduleStep();
    });

    // --- EVENT START ---
    register('event_start', (node, state, flow, nodeId, ctx) => {
        // Just a passthrough if we hit it (should be start node usually)
        ctx.log('EVENT_START hit.');
        state.current = ctx.gotoNext(node.next);
        ctx.scheduleStep();
    });

})();
