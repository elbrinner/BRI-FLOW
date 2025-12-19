// js/simulador/ui.js
(function () {
    'use strict';

    window.Simulador = window.Simulador || {};

    const UI = {};
    const $ = (id) => document.getElementById(id);

    UI.$ = $;

    UI.log = function (msg) {
        // Map logs to debugCallStack for visibility, or just console
        console.log(`[Simulador UI] ${msg}`);
        const el = $('debugCallStack');
        if (!el) return;
        // Prepend logic for stack-like view or Append for log view.
        // Let's keep minimal history
        const line = `[${new Date().toLocaleTimeString()}] ${msg}\n`;
        el.textContent = line + el.textContent.slice(0, 500); // Limit size
    };

    UI.renderPreview = function () {
        const el = $('debugFlowJson');
        if (!el) return;
        const flow = window.Simulador.flow ? window.Simulador.flow.currentFlow : null;
        if (!flow) {
            el.textContent = '{}';
            return;
        }

        // Show a summary or the full JSON? The label says "Flow JSON".
        // Let's show full JSON but maybe sanitized or just summary if too large.
        // For debugging, summary is often better if flow is huge.
        const summary = {
            id: flow.flow_id,
            name: flow.name,
            start: flow._start || flow.start_node,
            nodes_count: Object.keys(flow._nodes || {}).length
        };
        el.textContent = JSON.stringify(summary, null, 2);
    };

    UI.renderVariables = function () {
        const el = $('debugVariables');
        const stateVars = window.Simulador.state ? window.Simulador.state.getVariables() : {};
        if (el) {
            el.textContent = JSON.stringify(stateVars, null, 2);
        }
        UI.renderVariablesList(stateVars);
    };

    UI.renderVariablesList = function (vars) {
        const container = $('simulatorVarsList');
        if (!container) return;
        container.innerHTML = '';

        Object.keys(vars).sort().forEach(key => {
            const val = vars[key];
            const div = document.createElement('div');
            div.className = 'flex flex-col gap-1 border-b pb-2 last:border-0';

            const label = document.createElement('label');
            label.className = 'text-[10px] font-bold text-gray-600 truncate';
            label.textContent = key;

            const input = document.createElement('input');
            input.className = 'w-full text-xs border rounded px-1 py-0.5';
            input.dataset.key = key;

            if (typeof val === 'object') {
                input.value = JSON.stringify(val);
                input.dataset.type = 'json';
            } else {
                input.value = String(val);
                input.dataset.type = typeof val;
            }

            div.appendChild(label);
            div.appendChild(input);
            container.appendChild(div);
        });
    };

    UI.bindVariableControls = function () {
        const btnSave = $('btnVarsSave');
        const btnReset = $('btnVarsReset');

        if (btnSave) {
            btnSave.onclick = () => {
                const container = $('simulatorVarsList');
                if (!container) return;
                const inputs = container.querySelectorAll('input');
                const newVars = {};

                inputs.forEach(input => {
                    const key = input.dataset.key;
                    const type = input.dataset.type;
                    let val = input.value;

                    try {
                        if (type === 'json' || (val.startsWith('{') || val.startsWith('['))) {
                            val = JSON.parse(val);
                        } else if (type === 'number') {
                            val = Number(val);
                        } else if (type === 'boolean') {
                            val = (val === 'true');
                        }
                    } catch (e) { /* keep as string if parse fails */ }

                    newVars[key] = val;
                });

                if (window.Simulador.state) {
                    window.Simulador.state.setVariables(newVars);
                    UI.renderVariables(); // Refresh views
                    UI.log('Variables updated manually');
                }
            };
        }

        if (btnReset) {
            btnReset.onclick = () => {
                if (window.Simulador.state) {
                    window.Simulador.state.reset();
                    // Re-init with current flow start? 
                    // state.reset() usually clears everything. 
                    // Maybe we need to reload the flow/state.
                    // For now, just refresh UI.
                    UI.renderVariables();
                    UI.log('Variables reset');
                }
            };
        }
    };

    UI.renderNodeVisit = function (nodeId, node) {
        const el = $('debugCurrentNode');
        if (!el) return;

        // Also log to call stack as history
        UI.log(`Visit: ${nodeId} (${node.type})`);

        const view = {
            id: nodeId,
            type: node.type,
            ...node
        };
        el.textContent = JSON.stringify(view, null, 2);
    };

    UI.appendChatMessage = function (role, content) {
        const chatContainer = $('simulatorChat');
        if (!chatContainer) return;

        const msgDiv = document.createElement('div');
        msgDiv.className = `flex w-full mb-4 ${role === 'user' ? 'justify-end' : 'justify-start'}`;

        const bubble = document.createElement('div');
        bubble.className = `max-w-[85%] rounded-lg p-3 text-sm ${role === 'user' ? 'bg-sky-600 text-white' : 'bg-white border text-gray-800 shadow-sm'}`;

        if (typeof content === 'string') {
            // Check for UI Component JSON (heuristic)
            let isJson = false;
            let json = null;
            if (content.trim().startsWith('{') && content.includes('"type"')) {
                try {
                    json = JSON.parse(content);
                    if (json.type && ['card', 'form', 'chart', 'list'].includes(json.type)) {
                        isJson = true;
                    }
                } catch (e) { /* ignore */ }
            }

            if (isJson && json) {
                UI.renderUIComponent(bubble, json, (action) => {
                    // Default handler for chat-embedded components (if any)
                    // For now, just log. In future, maybe trigger flow event.
                    console.log('Chat component action:', action);
                });
            } else {
                // Markdown rendering
                if (window.Simulador && window.Simulador.evaluator) {
                    bubble.innerHTML = window.Simulador.evaluator.processText(content, true);
                } else {
                    bubble.textContent = content;
                }
            }
        } else if (content instanceof HTMLElement) {
            bubble.appendChild(content);
        } else if (typeof content === 'object' && content !== null) {
            if (content.type && ['card', 'form', 'chart', 'list'].includes(content.type)) {
                UI.renderUIComponent(bubble, content);
            } else {
                const pre = document.createElement('pre');
                pre.className = 'text-xs overflow-auto';
                pre.textContent = JSON.stringify(content, null, 2);
                bubble.appendChild(pre);
            }
        }

        msgDiv.appendChild(bubble);
        chatContainer.appendChild(msgDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    };

    UI.renderUIComponent = function (container, component, onAction) {
        if (!component || !component.type) return;

        if (component.type === 'card') {
            const card = document.createElement('div');
            card.className = 'border rounded-lg overflow-hidden bg-white shadow-sm';
            if (component.title) {
                const head = document.createElement('div');
                head.className = 'bg-gray-50 px-3 py-2 border-b font-semibold';
                head.textContent = component.title;
                card.appendChild(head);
            }
            if (component.data) {
                const body = document.createElement('div');
                body.className = 'p-3 text-sm';
                // Simple key-value render
                for (const [k, v] of Object.entries(component.data)) {
                    const row = document.createElement('div');
                    row.className = 'mb-1';
                    row.innerHTML = `<span class="font-medium text-gray-600">${k}:</span> ${v}`;
                    body.appendChild(row);
                }
                card.appendChild(body);
            }
            if (Array.isArray(component.actions)) {
                const foot = document.createElement('div');
                foot.className = 'p-2 bg-gray-50 border-t flex gap-2';
                component.actions.forEach(act => {
                    const btn = document.createElement('button');
                    btn.className = 'px-3 py-1 bg-sky-600 text-white rounded text-xs hover:bg-sky-700';
                    btn.textContent = act.label || act.action;
                    btn.onclick = () => {
                        console.log('[UI Agent] Action:', act);
                        if (onAction && typeof onAction === 'function') {
                            onAction(act);
                        } else if (window.Simulador && window.Simulador.ui && window.Simulador.ui.log) {
                            window.Simulador.ui.log(`Action clicked: ${act.label} (no handler)`);
                        }
                    };
                    foot.appendChild(btn);
                });
                card.appendChild(foot);
            }
            container.appendChild(card);
        } else if (component.type === 'list') {
            const list = document.createElement('div');
            list.className = 'border rounded-lg overflow-hidden bg-white';
            if (component.title) {
                const head = document.createElement('div');
                head.className = 'bg-gray-50 px-3 py-2 border-b font-semibold';
                head.textContent = component.title;
                list.appendChild(head);
            }
            if (Array.isArray(component.data)) {
                const ul = document.createElement('ul');
                ul.className = 'divide-y';
                component.data.forEach(item => {
                    const li = document.createElement('li');
                    li.className = 'p-2 hover:bg-gray-50 text-sm';
                    li.textContent = typeof item === 'string' ? item : JSON.stringify(item);
                    ul.appendChild(li);
                });
                list.appendChild(ul);
            }
            container.appendChild(list);
        } else {
            // Fallback
            const pre = document.createElement('pre');
            pre.className = 'text-xs text-gray-500';
            pre.textContent = `[UI Component: ${component.type}]\n` + JSON.stringify(component, null, 2);
            container.appendChild(pre);
        }
    };

    UI.createSavedChip = function (saveKey, value) {
        const wrap = document.createElement('div');
        wrap.className = 'text-xs text-gray-600';
        function short(v) {
            try {
                if (v === undefined) return 'undefined';
                if (v === null) return 'null';
                const s = (typeof v === 'string') ? v : JSON.stringify(v);
                return s.length > 120 ? (s.slice(0, 120) + '…') : s;
            } catch (_e) { return String(v); }
        }
        wrap.textContent = `💾 Guardado en ${saveKey}: ${short(value)}`;
        return wrap;
    };

    UI.getVariantClass = function (v) {
        const variant = (v || '').toLowerCase();
        if (variant === 'primary') return 'px-4 py-2 rounded text-sm bg-sky-600 text-white hover:bg-sky-700';
        if (variant === 'tertiary') return 'px-4 py-2 rounded text-sm bg-transparent text-sky-700 border border-transparent hover:bg-sky-50';
        return 'px-4 py-2 rounded text-sm bg-white border text-gray-800 hover:bg-gray-100';
    };

    UI.parseSimExtraInput = function () {
        try {
            const el = $('simExtraInput');
            if (!el) return undefined;
            const raw = (el.value || '').trim();
            if (!raw) return undefined;
            if ((raw.startsWith('{') && raw.endsWith('}')) || (raw.startsWith('[') && raw.endsWith(']'))) {
                try { return JSON.parse(raw); } catch (_e) { }
            }
            if (/^-?\d+(?:\.\d+)?$/.test(raw)) {
                try { return Number(raw); } catch (_e) { }
            }
            if (/^true$/i.test(raw)) return true;
            if (/^false$/i.test(raw)) return false;
            if (/^null$/i.test(raw)) return null;
            return raw;
        } catch (_e) { return undefined; }
    };

    UI.parseSimTurnSelect = function () {
        try {
            const el = $('simTurnSelect');
            if (!el) return undefined;
            const v = String(el.value || '').trim();
            if (!v) return undefined;
            return v;
        } catch (_e) { return undefined; }
    };

    UI.parseSimOriginInput = function () {
        try {
            const el = $('simOriginInput');
            if (!el) return undefined;
            const raw = (el.value || '').trim();
            if (!raw) return undefined;
            if ((raw.startsWith('{') && raw.endsWith('}')) || (raw.startsWith('[') && raw.endsWith(']'))) {
                try { return JSON.parse(raw); } catch (_e) { }
            }
            if (/^-?\d+(?:\.\d+)?$/.test(raw)) { try { return Number(raw); } catch (_e) { } }
            if (/^true$/i.test(raw)) return true;
            if (/^false$/i.test(raw)) return false;
            if (/^null$/i.test(raw)) return null;
            return raw;
        } catch (_e) { return undefined; }
    };

    UI.parseSimEventPayload = function () {
        try {
            const el = $('simEventPayload');
            if (!el) return {};
            const raw = (el.value || '').trim();
            if (!raw) return {};
            return JSON.parse(raw);
        } catch (e) {
            console.warn('Invalid JSON in Event Payload', e);
            return {};
        }
    };

    UI.renderEventTriggerUI = function () {
        const container = $('simulatorControls'); // Assuming this exists or we append to body/sidebar
        if (!container) return;

        // Check if already rendered
        if ($('simEventTriggerBtn')) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'mt-4 border-t pt-4';

        const label = document.createElement('label');
        label.className = 'block text-xs font-semibold text-gray-700 mb-1';
        label.textContent = 'Trigger Event (Webhook)';
        wrapper.appendChild(label);

        const textarea = document.createElement('textarea');
        textarea.id = 'simEventPayload';
        textarea.className = 'w-full text-xs border rounded p-1 font-mono';
        textarea.rows = 3;
        textarea.placeholder = '{"type": "webhook", "data": ...}';
        wrapper.appendChild(textarea);

        const btn = document.createElement('button');
        btn.id = 'simEventTriggerBtn';
        btn.className = 'mt-2 w-full bg-purple-600 text-white text-xs py-1 rounded hover:bg-purple-700';
        btn.textContent = '⚡ Trigger Event';
        btn.onclick = () => {
            const payload = UI.parseSimEventPayload();
            if (window.Simulador && window.Simulador.engine && window.Simulador.engine.startFromEvent) {
                window.Simulador.engine.startFromEvent(payload);
            } else {
                alert('Simulator Engine does not support startFromEvent yet.');
            }
        };
        wrapper.appendChild(btn);

        container.appendChild(wrapper);
    };

    UI.renderBackendSettingsUI = function () {
        const container = $('simulatorControls');
        if (!container) return;

        if ($('simBackendSettingsWrap')) return;

        const wrapper = document.createElement('div');
        wrapper.id = 'simBackendSettingsWrap';
        wrapper.className = 'mt-4 border-t pt-4 hidden';

        const title = document.createElement('div');
        title.className = 'flex items-center justify-between';
        title.innerHTML = '<div class="text-xs font-semibold text-gray-700">⚙ Backend del simulador</div>';
        wrapper.appendChild(title);

        const hint = document.createElement('div');
        hint.className = 'mt-1 text-[11px] text-gray-600';
        hint.textContent = 'Configura la URL del backend y si quieres forzarlo para agent_call. Se guarda en este navegador.';
        wrapper.appendChild(hint);

        const form = document.createElement('div');
        form.className = 'mt-2 space-y-2';

        const row1 = document.createElement('label');
        row1.className = 'flex items-center gap-2 text-xs text-gray-700';
        row1.innerHTML = '<input id="simBackendForce" type="checkbox" class="border" /> <span>Forzar backend para <code>agent_call</code></span>';
        form.appendChild(row1);

        const row2 = document.createElement('label');
        row2.className = 'block text-xs text-gray-700';
        row2.innerHTML = '<div class="font-semibold mb-1">Backend URL</div>';
        const input = document.createElement('input');
        input.id = 'simBackendUrl';
        input.type = 'text';
        input.placeholder = 'http://localhost:5000';
        input.className = 'w-full text-xs border rounded px-2 py-1';
        row2.appendChild(input);
        form.appendChild(row2);

        const meta = document.createElement('div');
        meta.id = 'simBackendMeta';
        meta.className = 'text-[11px] text-gray-500';
        form.appendChild(meta);

        wrapper.appendChild(form);
        container.appendChild(wrapper);

        function refresh() {
            try {
                const s = window.Simulador?.api?.getBackendSettings?.() || {};
                const forceEl = $('simBackendForce');
                const urlEl = $('simBackendUrl');
                if (forceEl) forceEl.checked = !!s.forceBackend;
                if (urlEl) urlEl.value = s.baseUrl || '';
                const m = $('simBackendMeta');
                if (m) m.textContent = `Origen: ${s.source || 'n/d'}`;
            } catch (_e) { }
        }

        function persist() {
            try {
                const forceEl = $('simBackendForce');
                const urlEl = $('simBackendUrl');
                const baseUrl = urlEl ? String(urlEl.value || '').trim() : '';
                const forceBackend = forceEl ? !!forceEl.checked : false;
                if (window.Simulador?.api?.setBackendSettings) {
                    window.Simulador.api.setBackendSettings({ baseUrl, forceBackend });
                } else {
                    try {
                        if (typeof localStorage !== 'undefined') {
                            localStorage.setItem('sim.agent_api_base', baseUrl);
                            localStorage.setItem('sim.backend.force', forceBackend ? '1' : '0');
                        }
                    } catch (_e) { }
                }
                refresh();
                UI.log('Backend settings updated');
            } catch (_e) { }
        }

        $('simBackendForce')?.addEventListener('change', persist);
        $('simBackendUrl')?.addEventListener('change', persist);

        refresh();
    };

    UI.toggleBackendSettingsUI = function () {
        // Ensure panel exists (modules can init before modal is opened)
        try { UI.renderBackendSettingsUI(); } catch (_e) { }

        const wrap = $('simBackendSettingsWrap');
        if (!wrap) {
            UI.log('⚠️ No se pudo abrir Configuración: panel no disponible');
            return;
        }

        const willShow = wrap.classList.contains('hidden');
        wrap.classList.toggle('hidden');

        if (willShow) {
            try { wrap.scrollIntoView({ block: 'nearest' }); } catch (_e) { }
            try { $('simBackendUrl')?.focus(); } catch (_e) { }
            UI.log('⚙ Configuración backend abierta');
        } else {
            UI.log('⚙ Configuración backend cerrada');
        }
    };

    UI.handleSendMessage = function () {
        const input = $('simulatorInputBox');
        if (!input) return;
        const text = input.value.trim();
        if (!text) return;

        // 1. Append User Message
        UI.appendChatMessage('user', text);
        input.value = '';

        // 2. Check for A2A Addressing (@agent)
        if (text.startsWith('@')) {
            const match = text.match(/^@(\w+)\s+(.+)$/);
            if (match) {
                const targetAgent = match[1];
                const content = match[2];
                UI.log(`📧 Routing message to agent: ${targetAgent}`);

                if (window.Simulador.engine && window.Simulador.engine.routeMessage) {
                    window.Simulador.engine.routeMessage(targetAgent, content);
                } else {
                    UI.log('⚠️ Engine does not support routing yet.');
                }
                return;
            }
        }

        // 3. Default behavior (if waiting for input, or just log)
        // If the engine is paused at an input node, we might want to feed this input to it.
        // But processInput.js has its own input. 
        // For now, we just log "Message received".
        UI.log(`Message received: ${text}`);
    };

    UI.initHandlers = function () {
        const btn = $('simulatorSendBtn');
        const box = $('simulatorInputBox');
        if (btn) btn.onclick = UI.handleSendMessage;
        if (box) {
            box.onkeydown = (e) => {
                if (e.key === 'Enter') UI.handleSendMessage();
            };
        }

        // Backend settings panel
        UI.renderBackendSettingsUI();
        const btnSettings = $('btnSimulatorSettings');
        if (btnSettings) {
            btnSettings.addEventListener('click', (e) => {
                try { e.preventDefault(); } catch (_e) { }
                UI.toggleBackendSettingsUI();
            });
        }

        UI.renderEventTriggerUI();
        UI.bindVariableControls();
    };

    window.Simulador.ui = UI;
})();
