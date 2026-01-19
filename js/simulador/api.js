// js/simulador/api.js
(function () {
    'use strict';

    window.Simulador = window.Simulador || {};

    const API = {};

    const LS_BACKEND_SETTINGS = 'sim.backend.settings.v1';

    function readBackendSettingsLS() {
        try {
            if (typeof localStorage === 'undefined') return null;
            const raw = localStorage.getItem(LS_BACKEND_SETTINGS);
            if (!raw) return null;
            const obj = JSON.parse(raw);
            if (!obj || typeof obj !== 'object') return null;
            return obj;
        } catch (_e) {
            return null;
        }
    }

    function writeBackendSettingsLS(settings) {
        try {
            if (typeof localStorage === 'undefined') return;
            const safe = {
                baseUrl: settings && settings.baseUrl ? String(settings.baseUrl) : '',
                forceBackend: !!(settings && settings.forceBackend),
                updatedAt: new Date().toISOString()
            };
            localStorage.setItem(LS_BACKEND_SETTINGS, JSON.stringify(safe));
        } catch (_e) { }
    }

    function getStartNode() {
        try {
            const flow = window.Simulador && window.Simulador.flow ? window.Simulador.flow.currentFlow : null;
            if (!flow || !flow._nodes) return null;
            const startId = flow._start || flow.start_node || null;
            if (!startId) return null;
            return flow._nodes[startId] || null;
        } catch (_e) {
            return null;
        }
    }

    function normalizeBaseUrl(url) {
        try {
            const s = String(url || '').trim();
            return s.replace(/\/$/, '');
        } catch (_e) {
            return '';
        }
    }

    API.getBackendSettings = function () {
        const startNode = getStartNode();
        const startBackendUrl = startNode && startNode.backend_url ? String(startNode.backend_url) : '';
        const startApiKey = startNode && startNode.api_key ? String(startNode.api_key) : '';

        const ls = readBackendSettingsLS() || {};
        let baseUrl = ls.baseUrl ? String(ls.baseUrl) : '';
        let source = baseUrl ? 'localStorage' : '';

        // Backward-compatible keys
        if (!baseUrl) {
            try {
                if (typeof localStorage !== 'undefined') {
                    const legacy = localStorage.getItem('sim.agent_api_base');
                    if (legacy && legacy.trim()) {
                        baseUrl = legacy.trim();
                        source = 'localStorage(sim.agent_api_base)';
                    }
                }
            } catch (_e) { }
        }

        // Flow config (Start node)
        if (!baseUrl && startBackendUrl) {
            baseUrl = startBackendUrl;
            source = 'flow(start.backend_url)';
        }

        // Local JSON config
        if (!baseUrl) {
            try {
                if (window.SIM_LOCAL_CONFIG && window.SIM_LOCAL_CONFIG.agent_api_base) {
                    baseUrl = String(window.SIM_LOCAL_CONFIG.agent_api_base);
                    source = 'SIM_LOCAL_CONFIG.agent_api_base';
                }
            } catch (_e) { }
        }

        if (!baseUrl) {
            baseUrl = (window.location && window.location.origin) ? window.location.origin : 'http://localhost:5000';
            source = 'default(origin)';
        }

        return {
            baseUrl: normalizeBaseUrl(baseUrl),
            apiKey: startApiKey,
            forceBackend: !!ls.forceBackend,
            source
        };
    };

    API.setBackendSettings = function ({ baseUrl, forceBackend } = {}) {
        const normalized = normalizeBaseUrl(baseUrl);
        writeBackendSettingsLS({ baseUrl: normalized, forceBackend: !!forceBackend });
        // Backward-compatible key used by legacy pieces
        try {
            if (typeof localStorage !== 'undefined') {
                if (normalized) localStorage.setItem('sim.agent_api_base', normalized);
            }
        } catch (_e) { }
        return API.getBackendSettings();
    };

    API.getAgentApiBase = function () {
        return API.getBackendSettings().baseUrl;
    };

    // Load local config
    API.loadLocalConfig = async function () {
        try {
            const url = 'docs/sim.local.json?ts=' + Date.now();
            const res = await fetch(url);
            if (!res.ok) return;
            const cfg = await res.json();
            try { window.SIM_LOCAL_CONFIG = cfg; } catch (_e) { }
            if (cfg && cfg.agent_api_base) {
                try { if (typeof localStorage !== 'undefined') localStorage.setItem('sim.agent_api_base', String(cfg.agent_api_base)); } catch (_e) { }
            }
            // Note: useRealHttp global was in simulador.js. We might need a settings module or put it in State/Engine.
            // For now, we'll access it via a getter/setter in Engine if needed, or just assume it's handled by the caller.
        } catch (_e) { }
    };

    API.makeHttpRequest = async function (node, useRealHttp = true) {
        const props = node.properties || {};
        const method = (props.method || node.method || 'GET').toUpperCase();
        const rawUrl = props.url || node.url || '';

        // Interpolate URL
        const evaluator = window.Simulador.evaluator || window.Simulador.core; // fallback
        const url = (typeof rawUrl === 'string' && evaluator && evaluator.interpolate)
            ? evaluator.interpolate(rawUrl, window.Simulador.state.getVariables())
            : String(rawUrl || '');

        const cfg = (typeof window !== 'undefined' && window.SIM_LOCAL_CONFIG) ? (window.SIM_LOCAL_CONFIG.rest || {}) : {};
        let finalUrl = url;
        try {
            const abs = /^https?:\/\//i.test(url);
            if (!abs && cfg.base_url) { finalUrl = String(cfg.base_url).replace(/\/$/, '') + '/' + String(url).replace(/^\//, ''); }
        } catch (_e) { }

        const headers = Object.assign({}, props.headers || {}, node.headers || {});
        try {
            if (cfg && cfg.default_headers && typeof cfg.default_headers === 'object') {
                Object.keys(cfg.default_headers).forEach(k => { const exists = headers[k] !== undefined || headers[String(k).toLowerCase()] !== undefined; if (!exists) headers[k] = cfg.default_headers[k]; });
            }
        } catch (_e) { }

        let body = props.body !== undefined ? props.body : (node.body !== undefined ? node.body : undefined);
        let fetchInit = { method, headers };
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
            if (body !== undefined) {
                if (typeof body === 'object') {
                    if (!headers['Content-Type'] && !headers['content-type']) {
                        headers['Content-Type'] = 'application/json';
                    }
                    fetchInit.body = JSON.stringify(body);
                } else if (typeof body === 'string' && body.trim() !== '') {
                    fetchInit.body = (evaluator && evaluator.interpolate) ? evaluator.interpolate(body, window.Simulador.state.getVariables()) : body;
                }
            }
        }

        try {
            const response = await fetch(finalUrl, fetchInit);
            const status = response.status;
            let data = null;
            if (response.ok) {
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    data = await response.json();
                } else {
                    data = await response.text();
                }
            }
            return { status, ok: response.ok, data, headers: Object.fromEntries(response.headers.entries()) };
        } catch (error) {
            return { status: 0, ok: false, error: error.message, data: null };
        }
    };

    API.runAgentCall = function (node, state, callbacks) {
        // Delegate to SimuladorAgents if available
        if (window.SimuladorAgents && typeof window.SimuladorAgents.runAgentCall === 'function') {
            return window.SimuladorAgents.runAgentCall(node, state, callbacks);
        }
        console.warn('[Simulador] Módulo SimuladorAgents no disponible todavía');
        return Promise.reject(new Error('SimuladorAgents no disponible'));
    };

    window.Simulador.api = API;

    // Global helper used by simulador-agents.js
    if (typeof window.getAgentApiBase !== 'function') {
        window.getAgentApiBase = function () {
            try {
                if (window.Simulador && window.Simulador.api && typeof window.Simulador.api.getAgentApiBase === 'function') {
                    return window.Simulador.api.getAgentApiBase();
                }
            } catch (_e) { }
            try { return (window.location && window.location.origin) ? window.location.origin : 'http://localhost:5000'; } catch (_e) { return 'http://localhost:5000'; }
        };
    }
})();
