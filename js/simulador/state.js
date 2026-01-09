// js/simulador/state.js
(function () {
    'use strict';

    window.Simulador = window.Simulador || {};

    const State = {
        data: null, // { variables: {}, history: [], current: null, steps: 0, selections: {} }
        loopStack: [],
        extraTtl: 0
    };

    State.init = function (flow) {
        State.data = {
            variables: {},
            history: [],
            callStack: [], // Stack for flow jumps: [{ flowId, nodeId, returnToNodeId }]
            current: flow ? (flow._start || flow.start_node) : null,
            steps: 0,
            selections: { button: {}, choice: {} }
        };
        State.loopStack = [];
        State.extraTtl = 0;

        // Init variables from start node if present
        if (flow && flow._start && flow._nodes && flow._nodes[flow._start] && Array.isArray(flow._nodes[flow._start].variables)) {
            flow._nodes[flow._start].variables.forEach(v => {
                let def = v.defaultValue;
                // Parse JSON-like strings
                if (typeof def === 'string') {
                    const s = def.trim();
                    if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) {
                        try { def = JSON.parse(s); } catch (e) { }
                    }
                }
                // Coerce types
                if (typeof def === 'string') {
                    const t = def.trim();
                    if (/^-?\d+(?:\.\d+)?$/.test(t)) {
                        try { def = Number(t); } catch (_e) { }
                    } else if (/^true$/i.test(t)) { def = true; } else if (/^false$/i.test(t)) { def = false; }
                }
                // Deep copy
                try { State.data.variables[v.name] = JSON.parse(JSON.stringify(def)); } catch (e) { State.data.variables[v.name] = def; }
            });
        }

        // Ensure session ID
        State.ensureSessionId();
    };

    State.reset = function () {
        State.data = null;
        State.loopStack = [];
        State.extraTtl = 0;
    };

    State.ensureSessionId = function () {
        try {
            if (!State.data) State.data = { variables: {}, history: [], current: null, steps: 0, selections: { button: {}, choice: {} } };
            if (!State.data.variables.__sim_sessionId) {
                const u = (crypto && crypto.randomUUID) ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2));
                State.data.variables.__sim_sessionId = u;
            }
            return State.data.variables.__sim_sessionId;
        } catch (_e) { return '00000000-0000-0000-0000-000000000000'; }
    };

    State.getVariables = function () {
        return State.data ? State.data.variables : {};
    };

    State.getHistory = function () {
        return State.data ? State.data.history : [];
    };

    window.Simulador.state = State;
})();
