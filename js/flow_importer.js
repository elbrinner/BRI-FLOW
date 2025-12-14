// flow_importer.js
// Handles importing flow JSON with migrations and heuristics
(function () {

    function importJson(obj, state, dependencies) {
        const { renderNode, refreshConnections, refreshOutput, selectNode, autoGrowCanvas, fitCanvasToContent } = dependencies;

        // NOTE: logic extracted from main.js

        // Hard reset de jsPlumb
        try {
            if (typeof jsPlumb !== 'undefined') {
                if (jsPlumb.reset) jsPlumb.reset();
                if (dependencies.canvasInner && jsPlumb.setContainer) jsPlumb.setContainer(dependencies.canvasInner);
                if (jsPlumb.importDefaults) {
                    jsPlumb.importDefaults({
                        Connector: ['StateMachine', { margin: 5, curviness: 10, proximityLimit: 80 }],
                        Endpoint: ['Dot', { radius: 4 }],
                        PaintStyle: { stroke: '#5c7cfa', strokeWidth: 2 },
                        HoverPaintStyle: { stroke: '#1c7ed6', strokeWidth: 3 },
                        ConnectionOverlays: [
                            ['Arrow', { location: 1, id: 'arrow', width: 10, length: 10 }]
                        ]
                    });
                }
                try { if (window.AppConnections && typeof window.AppConnections.init === 'function') window.AppConnections.init(jsPlumb, dependencies.canvasInner); } catch (_e) { }
            }
        } catch (_e) { console.warn('jsPlumb reset during import failed', _e); }

        if (!obj?.nodes) {
            alert('JSON inválido (no se encontró nodes)');
            return;
        }

        // Reset state nodes but keep reference if possible, or just clear properties
        // main.js assigns state.nodes = {}, so we do that.
        // We need to modify the state object passed in.
        for (const key in state.nodes) delete state.nodes[key];

        state.meta.flow_id = obj.flow_id || obj.meta?.flow_id || state.meta.flow_id;
        state.meta.version = obj.version || obj.meta?.version || state.meta.version;
        state.meta.name = obj.name || obj.meta?.name || state.meta.name;
        state.meta.description = obj.description || obj.meta?.description || state.meta.description;
        state.meta.locales = obj.locales || obj.meta?.locales || state.meta.locales;
        state.meta.start_node = obj.start_node || obj.meta?.start_node || state.meta.start_node;
        try { state.meta.is_main = (obj.is_main !== undefined) ? !!obj.is_main : !!obj.meta?.is_main; } catch (_e) { }

        let migratedCount = 0;
        for (const id in obj.nodes) {
            const node = { ...obj.nodes[id] };
            // Migración: set_var -> assign_var
            if (node.type === 'set_var') { node.type = 'assign_var'; migratedCount++; }
            // Layout default
            if (node.x === undefined || node.x === null) node.x = 20 + (Object.keys(state.nodes).length * 30) % 400;
            if (node.y === undefined || node.y === null) node.y = 20 + (Object.keys(state.nodes).length * 20) % 300;
            // Migraciones loop
            if (node.type === 'loop') {
                if (!node.source_list && node.iterExpr) node.source_list = node.iterExpr;
                if (!node.item_var && node.itemVar) node.item_var = node.itemVar;
                if (!node.index_var) node.index_var = 'index';
            }
            state.nodes[id] = node;
        }

        if (migratedCount > 0) {
            try { if (window.Toasts && typeof window.Toasts.info === 'function') window.Toasts.info(`Se migraron ${migratedCount} nodos set_var a assign_var`); else alert(`Se migraron ${migratedCount} nodos set_var a assign_var`); } catch (e) { console.warn('Toasts.info failed', e); }
        }

        // Heurística source_list
        let inferredNodes = [];
        try {
            const startId = obj.start_node || state.meta.start_node;
            const startNode = startId ? state.nodes[startId] : null;
            const initialVars = {};
            if (startNode && Array.isArray(startNode.variables)) {
                startNode.variables.forEach(v => {
                    let def = v.defaultValue;
                    if (typeof def === 'string') {
                        const s = def.trim();
                        if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) {
                            try { def = JSON.parse(s); } catch (e) { }
                        }
                    }
                    initialVars[v.name] = def;
                });
            }

            function findArrayPath(obj, key, basePath) {
                if (!obj) return null;
                if (Array.isArray(obj)) {
                    if (obj.length > 0 && obj[0] && typeof obj[0] === 'object' && (key in obj[0])) return basePath;
                    return null;
                }
                if (typeof obj === 'object') {
                    for (const k of Object.keys(obj)) {
                        const found = findArrayPath(obj[k], key, basePath ? (basePath + '.' + k) : k);
                        if (found) return found;
                    }
                }
                return null;
            }

            for (const nid in state.nodes) {
                const n = state.nodes[nid];
                if (n && (n.type === 'foreach' || n.type === 'loop') && (!n.source_list || !String(n.source_list).trim()) && n.body_start && n.body_start.node_id) {
                    try {
                        const body = state.nodes[n.body_start.node_id];
                        if (body && body.type === 'response') {
                            const raw = body.i18n && body.i18n[(state.meta && state.meta.locales && state.meta.locales[0]) || 'en'] && Array.isArray(body.i18n[(state.meta && state.meta.locales && state.meta.locales[0]) || 'en'].text) ? body.i18n[state.meta.locales[0]].text.join('\n') : (body.text || '');
                            const m = String(raw).match(/\{\{\s*([A-Za-z0-9_\.\s]+)\s*\}\}/);
                            if (m && m[1]) {
                                const expr = m[1].trim().replace(/\s*\.\s*/g, '.');
                                const parts = expr.split('.').filter(Boolean);
                                if (parts.length >= 2) {
                                    const prop = parts[1];
                                    for (const varName of Object.keys(initialVars)) {
                                        const path = findArrayPath(initialVars[varName], prop, varName);
                                        if (path) {
                                            n.source_list = path;
                                            inferredNodes.push(nid);
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                    } catch (e) { }
                }
            }
        } catch (e) { console.warn('infer source_list failed', e); }

        // Render
        try { if (typeof jsPlumb !== 'undefined' && jsPlumb.deleteEveryConnection) jsPlumb.deleteEveryConnection(); } catch (_e) { }
        dependencies.canvasInner.innerHTML = '';
        for (const id in state.nodes) renderNode(state.nodes[id]);

        refreshConnections();
        refreshOutput();
        try { autoGrowCanvas(); } catch (e) { }
        try {
            fitCanvasToContent();
            setTimeout(() => { try { fitCanvasToContent(); } catch (_e2) { } }, 60);
        } catch (_e1) { }

        // Refresh connections again
        try {
            if (window.AppConnections && typeof window.AppConnections.refreshConnections === 'function') {
                setTimeout(() => { try { window.AppConnections.refreshConnections(state); } catch (_e) { } }, 0);
                setTimeout(() => { try { window.AppConnections.refreshConnections(state); } catch (_e) { } }, 120);
                setTimeout(() => { try { window.AppConnections.refreshConnections(state); } catch (_e) { } }, 300);
            }
        } catch (_r) { }

        // Update badge
        try {
            const badge = document.getElementById('currentFlowBadge');
            if (badge) {
                const name = state.meta?.name || state.meta?.flow_id || 'flujo';
                const nameSpan = badge.querySelector('#currentFlowName');
                if (nameSpan) nameSpan.textContent = String(name);
                try {
                    const chip = badge.querySelector('#mainFlowChip');
                    if (chip) chip.classList.toggle('hidden', !(state.meta && state.meta.is_main === true));
                } catch (_) { }
            }
        } catch (_e) { }

        // Select inferred
        try {
            if (inferredNodes && inferredNodes.length) {
                selectNode(inferredNodes[0]);
            } else if (state.selectedId && state.nodes[state.selectedId]) {
                selectNode(state.selectedId);
            }
        } catch (e) { }
    }

    window.AppFlowImporter = { importJson };
})();
