// js/simulador/i18n.js
(function () {
    'use strict';

    window.Simulador = window.Simulador || {};

    const I18n = {};

    I18n.getLocale = function () {
        // Priority: state > storage > navigator > flow > fallback
        try {
            const state = window.Simulador.state && window.Simulador.state.data;
            const flow = window.Simulador.flow && window.Simulador.flow.currentFlow;

            if (state && state.variables && state.variables.selected_language) {
                const lang = state.variables.selected_language;
                if (flow && flow.locales && flow.locales.includes(lang)) return lang;
            }
        } catch (e) { }

        try {
            const flow = window.Simulador.flow && window.Simulador.flow.currentFlow;
            const stored = (typeof localStorage !== 'undefined') ? localStorage.getItem('simulator_selected_language') : null;
            if (stored && flow && flow.locales && flow.locales.includes(stored)) return stored;
        } catch (e) { }

        try {
            const flow = window.Simulador.flow && window.Simulador.flow.currentFlow;
            if (typeof navigator !== 'undefined' && navigator.language) {
                const nav = navigator.language.slice(0, 2).toLowerCase();
                if (flow && flow.locales && flow.locales.includes(nav)) return nav;
            }
        } catch (e) { }

        const flow = window.Simulador.flow && window.Simulador.flow.currentFlow;
        if (flow && Array.isArray(flow.locales) && flow.locales.length) return flow.locales[0];
        return 'es';
    };

    I18n.getI18nText = function (node, defaultText) {
        if (!node) return defaultText || '';
        const locale = I18n.getLocale();
        if (node.i18n && node.i18n[locale] && Array.isArray(node.i18n[locale].text)) {
            return node.i18n[locale].text.join('\n');
        }
        // fallback
        const fallbacks = ['es', 'en', 'pt'];
        for (const fb of fallbacks) {
            if (node.i18n && node.i18n[fb] && Array.isArray(node.i18n[fb].text)) return node.i18n[fb].text.join('\n');
        }
        return node.text || defaultText || '';
    };

    I18n.getI18nPrompt = function (node, defaultPrompt) {
        if (!node) return defaultPrompt || '';
        const locale = I18n.getLocale();
        if (node.i18n && node.i18n[locale]) {
            if (typeof node.i18n[locale].prompt === 'string') return node.i18n[locale].prompt;
            if (Array.isArray(node.i18n[locale].text)) return node.i18n[locale].text.join('\n');
        }
        // fallback
        const fallbacks = ['es', 'en', 'pt'];
        for (const fb of fallbacks) {
            if (node.i18n && node.i18n[fb]) {
                if (typeof node.i18n[fb].prompt === 'string') return node.i18n[fb].prompt;
                if (Array.isArray(node.i18n[fb].text)) return node.i18n[fb].text.join('\n');
            }
        }
        return node.prompt || defaultPrompt || '';
    };

    I18n.getOptionLabel = function (opt) {
        const locale = I18n.getLocale();
        if (!opt) return '';

        // 1) String (maybe JSON)
        if (typeof opt.label === 'string' && opt.label.trim()) {
            const s = opt.label.trim();
            const resolved = I18n.tryResolveLabelFromJsonOrRaw(s, locale);
            return window.Simulador.utils.interpolate ? window.Simulador.utils.interpolate(resolved || s) : (resolved || s);
        }

        // 2) Object
        if (opt.label && typeof opt.label === 'object') {
            try {
                const obj = opt.label;
                const map = (obj && obj.i18n && typeof obj.i18n === 'object') ? obj.i18n : obj;
                const txt = map[locale] || map.es || map.en || map.pt || obj.default || '';
                if (txt) return window.Simulador.utils.interpolate ? window.Simulador.utils.interpolate(String(txt)) : String(txt);
            } catch (_e) { }
        }

        const i18n = opt.i18n || {};
        const getText = (loc) => {
            try {
                const t = i18n[loc]?.text;
                if (Array.isArray(t)) return t.join(' ');
                if (typeof t === 'string') return t;
                return '';
            } catch (_e) { return ''; }
        };
        const txt = getText(locale) || getText('es') || getText('en') || getText('pt');
        const finalTxt = txt || opt.text || '';
        return window.Simulador.utils.interpolate ? window.Simulador.utils.interpolate(finalTxt) : finalTxt;
    };

    I18n.tryResolveLabelFromJsonOrRaw = function (labelOrJson, locale) {
        if (!labelOrJson) return labelOrJson;
        try {
            if (typeof labelOrJson === 'object') {
                const obj = labelOrJson;
                const map = (obj && obj.i18n && typeof obj.i18n === 'object') ? obj.i18n : obj;
                return map[locale] || map.es || obj.default || Object.values(map).find(v => typeof v === 'string' && v.trim()) || '';
            }
            const s = String(labelOrJson).trim();
            if (!s.startsWith('{')) return s;
            const parsed = JSON.parse(s);
            if (parsed && typeof parsed === 'object') {
                const map = (parsed.i18n && typeof parsed.i18n === 'object') ? parsed.i18n : parsed;
                return map[locale] || map.es || parsed.default || Object.values(map).find(v => typeof v === 'string' && String(v).trim()) || s;
            }
        } catch (_e) { }
        return labelOrJson;
    };

    window.Simulador.i18n = I18n;
})();
