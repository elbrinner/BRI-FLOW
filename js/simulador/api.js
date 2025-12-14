// js/simulador/api.js
(function () {
    'use strict';

    window.Simulador = window.Simulador || {};

    const API = {};

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
})();
