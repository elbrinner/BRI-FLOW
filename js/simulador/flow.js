// js/simulador/flow.js
(function () {
    'use strict';

    window.Simulador = window.Simulador || {};

    const Flow = {
        currentFlow: null,
        flowsById: {},
        currentFlowId: null
    };

    Flow.normalizeFlowObject = function (src) {
        if (!src || typeof src !== 'object') return src;
        const f = { ...src };
        try {
            const mid = f.flow_id || f.meta?.flow_id || null;
            if (!f.flow_id && mid) f.flow_id = mid;
            if (!f.name && f.meta?.name) f.name = f.meta.name;
            if (!f.locales && f.meta?.locales) f.locales = f.meta.locales;
            if (!f.start_node && f.meta?.start_node) f.start_node = f.meta.start_node;
        } catch (_e) { }
        f.nodes = f.nodes || {};
        f._nodes = f.nodes;
        try {
            Object.keys(f._nodes).forEach(k => { const n = f._nodes[k]; if (n && n.type === 'set_var') n.type = 'assign_var'; });
        } catch (_e) { }
        try {
            const keys = Object.keys(f._nodes);
            let start = f.start_node;
            if (!start || !keys.includes(start)) start = keys.length ? keys[0] : null;
            f._start = start || null;
        } catch (_e) { }
        return f;
    };

    Flow.ensureFlowRegistered = function (f) {
        if (!f) return;
        const fid = f.flow_id || f.meta?.flow_id || null;
        if (!fid) return;
        try { if (!f._nodes) { f = Flow.normalizeFlowObject(f); } } catch (_e) { }
        Flow.flowsById[fid] = f;
        Flow.currentFlowId = Flow.currentFlowId || fid;
    };

    Flow.setActiveFlow = function (flowId) {
        if (!flowId || !Flow.flowsById[flowId]) {
            // Try import from project
            Flow.importFromProject();
            if (!Flow.flowsById[flowId]) {
                console.warn('[Simulador] flujo destino no disponible:', flowId);
                return false;
            }
        }
        Flow.currentFlow = Flow.flowsById[flowId];
        Flow.currentFlowId = flowId;

        // Reset state if needed or just update current pointer?
        // The original code resets state if it's null, or updates current to start.
        // We'll let the Engine or State handle the state reset/update.
        if (window.Simulador.state) {
            const state = window.Simulador.state.data;
            if (!state) {
                window.Simulador.state.init(Flow.currentFlow);
            } else if (!state.current) {
                state.current = Flow.currentFlow._start || Flow.currentFlow.start_node || null;
            }
        }

        if (window.Simulador.ui && window.Simulador.ui.log) {
            window.Simulador.ui.log(`Conmutado a flujo: ${Flow.currentFlow.name || Flow.currentFlow.flow_id} (${flowId})`);
        }
        return true;
    };

    Flow.importFromProject = function () {
        try {
            const proj = window.AppProject;
            if (!proj || !proj.flows) return;
            Object.keys(proj.flows).forEach(fid => {
                try {
                    const rec = proj.flows[fid];
                    if (!rec) return;
                    const obj = {
                        flow_id: fid || rec.meta?.flow_id,
                        name: rec.meta?.name,
                        locales: rec.meta?.locales,
                        start_node: rec.meta?.start_node,
                        nodes: rec.nodes || {},
                        meta: rec.meta || { flow_id: fid }
                    };
                    const norm = Flow.normalizeFlowObject(obj);
                    Flow.flowsById[norm.flow_id || fid] = norm;
                    if (!Flow.currentFlowId) Flow.currentFlowId = norm.flow_id || fid;
                } catch (_e) { }
            });
        } catch (_e) { }
    };

    Flow.resolveNextRef = function (ref) {
        if (!ref) return { flowId: Flow.currentFlow?.flow_id || null, nodeId: null };
        if (typeof ref === 'string') return { flowId: Flow.currentFlow?.flow_id || null, nodeId: ref };
        if (typeof ref === 'object') {
            const targetFlow = ref.flow_id || Flow.currentFlow?.flow_id || null;
            const targetNode = ref.node_id || null;
            return { flowId: targetFlow, nodeId: targetNode };
        }
        return { flowId: Flow.currentFlow?.flow_id || null, nodeId: null };
    };

    Flow.gotoNext = function (ref) {
        const { flowId, nodeId } = Flow.resolveNextRef(ref);
        if (!flowId) return null;
        if (flowId !== (Flow.currentFlow?.flow_id || null)) {
            const ok = Flow.setActiveFlow(flowId);
            if (!ok) {
                console.warn('[Simulador] No se pudo conmutar al flujo destino:', flowId);
                return null;
            }
        }
        return nodeId || (Flow.currentFlow?._start || Flow.currentFlow?.start_node || null);
    };

    Flow.loadFlowFromEditor = function () {
        // Implementation similar to original loadFlowFromEditor
        // ... (omitted for brevity, will rely on App global)
        try {
            if (!window.App) throw new Error('App no disponible');
            try { if (typeof window.App.refreshOutput === 'function') window.App.refreshOutput(); } catch (_e) { }
            let parsedFromDom = null;
            try {
                const outEl = document.getElementById('jsonOutput');
                if (outEl && outEl.textContent && outEl.textContent.trim().length) {
                    const txt = outEl.textContent.trim();
                    const obj = JSON.parse(txt);
                    if (obj && obj.nodes && Object.keys(obj.nodes).length) parsedFromDom = obj;
                }
            } catch (_e) { }

            let flow = parsedFromDom;
            if (!flow) {
                if (typeof window.App.generateFlowJson !== 'function') throw new Error('App.generateFlowJson no disponible');
                flow = window.App.generateFlowJson();
            }

            try { flow._source = 'editor'; flow._sourcePath = null; flow._sourceName = null; } catch (_e) { }
            flow = Flow.normalizeFlowObject(flow);
            Flow.ensureFlowRegistered(flow);
            Flow.importFromProject();
            Flow.currentFlow = flow;
            Flow.currentFlowId = flow.flow_id || flow.meta?.flow_id;

            if (window.Simulador.ui) {
                window.Simulador.ui.log('Flujo cargado desde el editor: ' + (flow.name || flow.flow_id || 'sin nombre'));
                window.Simulador.ui.renderPreview();
            }
            return flow;
        } catch (e) {
            if (window.Simulador.ui) window.Simulador.ui.log('Error al cargar flujo desde editor: ' + e.message);
            throw e;
        }
    };

    window.Simulador.flow = Flow;
})();
