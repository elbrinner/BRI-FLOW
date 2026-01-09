// js/simulador/engine.js
(function () {
    'use strict';

    window.Simulador = window.Simulador || {};

    const Engine = {
        running: false,
        stepTimeout: null,
        stepDelay: 600,
        fastMode: false,
        MAX_STEPS: 500,
        useRealHttp: true
    };

    Engine.start = function () {
        console.log('[Engine] start() called');
        Engine.running = true;
        console.log('[Engine] Calling step()...');
        Engine.step();
        console.log('[Engine] step() returned');
    };

    Engine.startFromEvent = function (payload) {
        const flow = window.Simulador.flow.currentFlow;
        const ui = window.Simulador.ui;

        if (!flow) { ui.log('No hay flujo cargado.'); return; }

        // Find event_start node
        let startNodeId = null;
        for (const [id, node] of Object.entries(flow._nodes)) {
            if (node.type === 'event_start') {
                // Optional: Check if payload matches filter (simple check for now)
                // if (node.event_type === payload.type) ...
                startNodeId = id;
                break;
            }
        }

        if (!startNodeId) {
            ui.log('No se encontró un nodo "event_start" en el flujo.');
            return;
        }

        ui.log(`⚡ Evento recibido. Iniciando desde ${startNodeId}`);

        // Init state manually
        window.Simulador.state.init(flow);
        const state = window.Simulador.state.data;

        // Inject payload
        state.variables.event_payload = payload;
        state.variables.event = payload; // Alias

        // Set current node
        state.current = startNodeId;

        // Start
        Engine.running = true;
        Engine.step();
    };

    Engine.executeRemoteNode = async function (node, state, flow, nodeId, ui) {
        ui.log(`🌐 Executing Remote Node: ${nodeId} (${node.type})`);

        const startNode = flow._nodes[flow._start];
        const backendUrl = startNode?.backend_url || 'http://localhost:8000';
        const apiKey = startNode?.api_key || '';

        try {
            const payload = {
                flow_id: flow.id || 'sim_flow',
                node_id: nodeId,
                node_data: node,
                state: state.variables,
                input: state.variables.input // or last output
            };

            const res = await fetch(`${backendUrl}/api/simulate/step`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': apiKey ? `Bearer ${apiKey}` : undefined
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error(`Backend Error: ${res.statusText}`);

            const data = await res.json();
            ui.log(`✅ Remote Execution Success`);

            // Merge variables
            if (data.variables) {
                Object.assign(state.variables, data.variables);
            }

            // Handle output
            if (data.output && node.save_as) {
                state.variables[node.save_as] = data.output;
            }

            // Next step
            state.current = window.Simulador.flow.gotoNext(node.next);
            Engine.scheduleStep();

        } catch (e) {
            ui.log(`❌ Remote Execution Failed: ${e.message}`);
            // Fallback or Stop?
            // For now, stop
            Engine.running = false;
        }
    };



    Engine.routeMessage = function (targetAgent, content) {
        const ui = window.Simulador.ui;
        ui.log(`🔄 Engine Routing: "${content}" -> @${targetAgent}`);

        // In a real backend, this would publish to a message bus.
        // Here, we simulate it by finding if there is an active agent with that ID/Name.
        // Since we don't have a "live agents" list in this simple simulator,
        // we will just store it in a mailbox variable.

        const state = window.Simulador.state.data;
        if (!state) return;

        state.variables.mailbox = state.variables.mailbox || {};
        state.variables.mailbox[targetAgent] = state.variables.mailbox[targetAgent] || [];
        state.variables.mailbox[targetAgent].push({
            from: 'user',
            content: content,
            ts: Date.now()
        });

        ui.log(`✅ Message queued for @${targetAgent}`);

        // Optional: If we are in a "Coordinator" node that is waiting for messages, 
        // we could trigger a resume. But for now, just queueing.
    };

    Engine.stop = function () {
        Engine.running = false;
        if (Engine.stepTimeout) {
            clearTimeout(Engine.stepTimeout);
            Engine.stepTimeout = null;
        }
    };

    Engine.step = function () {
        console.log('[Engine] step() called, running:', Engine.running);

        if (!Engine.running) return;

        const flow = window.Simulador.flow.currentFlow;
        const currentState = window.Simulador.state.data;
        const ui = window.Simulador.ui;

        if (!flow || !currentState) {
            console.warn('[Engine] No flow or state');
            ui.log('No hay flujo o estado inicializado.');
            Engine.stop();
            return;
        }

        const currentNodeId = currentState.current;
        console.log('[Engine] Current node:', currentNodeId);

        if (!currentNodeId) {
            console.warn('[Engine] No current node');
            ui.log('Flujo finalizado o sin nodo inicial.');
            Engine.stop();
            return;
        } if (currentState.steps++ > Engine.MAX_STEPS) { ui.log('Máximo de pasos alcanzado, abortando'); Engine.running = false; return; }

        const nodeId = currentState.current;
        const node = flow._nodes[nodeId];
        if (!node) { ui.log('Nodo no encontrado: ' + nodeId); Engine.running = false; return; }

        ui.renderNodeVisit(nodeId, node);

        // Ephemeral injections (extra, turn, origin)
        Engine.handleEphemerals(currentState, ui);

        // Check for Remote Execution
        if (node.props && node.props.execution_mode === 'remote') {
            Engine.executeRemoteNode(node, currentState, flow, nodeId, ui);
            return;
        }

        // Dispatch to node handler
        if (window.Simulador.nodes && window.Simulador.nodes.processNode) {
            window.Simulador.nodes.processNode(node, currentState, flow, nodeId, {
                gotoNext: window.Simulador.flow.gotoNext,
                log: ui.log,
                appendChatMessage: ui.appendChatMessage,
                renderPreview: ui.renderPreview,
                renderVariables: ui.renderVariables,
                step: Engine.step,
                scheduleStep: Engine.scheduleStep,
                stop: Engine.stop,
                getI18nPrompt: window.Simulador.i18n.getI18nPrompt,
                getI18nText: window.Simulador.i18n.getI18nText,
                getOptionLabel: window.Simulador.i18n.getOptionLabel,
                evaluate: window.Simulador.evaluator?.evaluate || window.Simulador.core?.evaluate, // fallback
                api: window.Simulador.api,
                useRealHttp: Engine.useRealHttp,
                fastMode: Engine.fastMode,
                stepDelay: Engine.stepDelay,
                returnFromFlow: Engine.returnFromFlow
            });
        } else {
            ui.log('No node processor found for type: ' + node.type);
            currentState.current = window.Simulador.flow.gotoNext(node.next);
            Engine.scheduleStep();
        }

        ui.renderVariables();
    };

    Engine.scheduleStep = function (delay) {
        if (Engine.running) {
            const d = delay !== undefined ? delay : (Engine.fastMode ? 0 : Engine.stepDelay);
            Engine.stepTimeout = setTimeout(Engine.step, d);
        }
    };

    Engine.resumeWithInput = function (text) {
        const state = window.Simulador.state.data;
        const ui = window.Simulador.ui;

        if (!state || !state._waitingForInput) {
            ui.log('⚠️ Input received but not waiting for input.');
            return;
            // Optionally, we could still treat it as a global intent trigger?
        }

        const nodeId = state._inputNodeId;
        const flow = window.Simulador.flow.currentFlow;
        const node = flow._nodes[nodeId];

        if (!node) {
            ui.log('❌ Error resuming: idle node not found.');
            return;
        }

        ui.log(`▶️ Resuming from INPUT (${nodeId}) with "${text}"`);

        // Save Input Variable
        const saveKey = node.save_as || node.variable || `input_${nodeId}`;
        state.variables[saveKey] = text;

        // Clear waiting flag
        delete state._waitingForInput;
        delete state._inputNodeId;

        // Move to next
        const ctx = {
            gotoNext: window.Simulador.flow.gotoNext,
            scheduleStep: Engine.scheduleStep
        };
        state.current = ctx.gotoNext(node.next);

        // Resume
        Engine.running = true;
        Engine.step();
    };

    Engine.returnFromFlow = function () {
        const state = window.Simulador.state.data;
        const ui = window.Simulador.ui;

        if (!state.callStack || state.callStack.length === 0) {
            ui.log('END reached (Root Flow). Finishing.');
            return false; // No stack, stop
        }

        const returnPoint = state.callStack.pop();
        ui.log(`🔙 Returning from sub-flow to ${returnPoint.flowId} (node ${returnPoint.returnToNodeId})`);

        // Restore Flow
        // We need to find the flow object. 
        const projectFlows = window.AppProject ? window.AppProject.flows : {};
        const targetFlow = projectFlows[returnPoint.flowId];

        if (!targetFlow) {
            ui.log(`❌ Error returning: Flow ${returnPoint.flowId} not found.`);
            return false;
        }

        window.Simulador.flow.currentFlow = targetFlow;
        state.current = returnPoint.returnToNodeId;

        // Restore context variables? 
        // Usually local variables are scoped? 
        // BriFlow usually shares global state variables. 
        // If we want scoped variables, we would restore them here from the stack frame.
        // For now, assuming Global Variables (shared).

        Engine.running = true;
        Engine.scheduleStep();
        return true;
    };

    Engine.handleEphemerals = function (state, ui) {
        // ... (previous logic)
        const extra = ui.parseSimExtraInput();
        if (extra !== undefined) state.variables.extra = extra;

        const turn = ui.parseSimTurnSelect();
        if (turn !== undefined) { state.variables.turn = turn; state.variables.$turn = turn; }

        const origin = ui.parseSimOriginInput();
        if (origin !== undefined) { state.variables.origin = origin; state.variables.$origin = origin; }
    };

    window.Simulador.engine = Engine;
})();
