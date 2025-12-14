// js/simulador/utils.js
(function () {
    'use strict';

    window.Simulador = window.Simulador || {};

    const Utils = {};

    // Helper: set variable by path (supports dot notation and bracket indices)
    Utils.setVariableByPath = function (stateVariables, path, value) {
        if (!path || typeof path !== 'string') return;
        try {
            // Normalize path: "a.b[0].c" -> "a.b.0.c"
            const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
            if (parts.length === 0) return;

            let cur = stateVariables;
            for (let i = 0; i < parts.length - 1; i++) {
                const p = parts[i];
                if (cur[p] === undefined || cur[p] === null) {
                    // heuristic: if next part is digits, create array, else object
                    const nextP = parts[i + 1];
                    cur[p] = /^\d+$/.test(nextP) ? [] : {};
                }
                cur = cur[p];
            }
            const last = parts[parts.length - 1];
            if (cur && typeof cur === 'object') {
                cur[last] = value;
            }
        } catch (e) {
            console.warn('[Simulador] setVariableByPath failed', e);
        }
    };

    // Simple JSON Schema validator
    Utils.validateJsonSchema = function (data, schema) {
        if (!schema) return true;

        // Type validation
        if (schema.type) {
            const actualType = Array.isArray(data) ? 'array' : typeof data;
            if (schema.type !== actualType) {
                throw new Error(`Expected type ${schema.type}, got ${actualType}`);
            }
        }

        // Required properties (objects only)
        if (schema.required && Array.isArray(schema.required) && typeof data === 'object' && !Array.isArray(data)) {
            for (const prop of schema.required) {
                if (!(prop in data)) {
                    throw new Error(`Missing required property: ${prop}`);
                }
            }
        }

        // Properties validation (first level only)
        if (schema.properties && typeof data === 'object' && !Array.isArray(data)) {
            for (const prop in data) {
                if (schema.properties[prop]) {
                    const propSchema = schema.properties[prop];
                    const propValue = data[prop];
                    const propType = Array.isArray(propValue) ? 'array' : typeof propValue;

                    if (propSchema.type && propSchema.type !== propType) {
                        throw new Error(`Property "${prop}" should be ${propSchema.type}, got ${propType}`);
                    }
                }
            }
        }

        return true;
    };

    // Deep clone
    Utils.deepClone = function (obj) {
        try {
            return JSON.parse(JSON.stringify(obj));
        } catch (_e) {
            return obj;
        }
    };

    // Deep diff
    Utils.deepDiff = function (prev, curr, basePath = '') {
        const diffs = [];
        const isObj = (v) => v !== null && typeof v === 'object';

        if (prev === curr) { return diffs; }

        const prevIsObj = isObj(prev);
        const currIsObj = isObj(curr);

        if (!prevIsObj || !currIsObj) {
            diffs.push({ type: (prev === undefined) ? 'add' : (curr === undefined ? 'remove' : 'change'), path: basePath || '(root)', before: prev, after: curr });
            return diffs;
        }

        if (Array.isArray(prev) || Array.isArray(curr)) {
            if (JSON.stringify(prev) !== JSON.stringify(curr)) {
                diffs.push({ type: 'change', path: basePath || '(root)', before: prev, after: curr });
            }
            return diffs;
        }

        const prevKeys = new Set(Object.keys(prev || {}));
        const currKeys = new Set(Object.keys(curr || {}));

        // Added
        for (const k of currKeys) {
            if (!prevKeys.has(k)) diffs.push({ type: 'add', path: basePath ? basePath + '.' + k : k, before: undefined, after: curr[k] });
        }
        // Removed
        for (const k of prevKeys) {
            if (!currKeys.has(k)) diffs.push({ type: 'remove', path: basePath ? basePath + '.' + k : k, before: prev[k], after: undefined });
        }
        // Changed
        for (const k of currKeys) {
            if (prevKeys.has(k)) {
                const childPath = basePath ? basePath + '.' + k : k;
                const childDiffs = Utils.deepDiff(prev[k], curr[k], childPath);
                if (childDiffs.length) diffs.push(...childDiffs);
            }
        }
        return diffs;
    };

    // HTML Escaping
    Utils.escapeHtml = function (str) {
        if (str === null || str === undefined) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    };

    // HTML Sanitization
    Utils.sanitizeHtml = function (dirtyHtml) {
        if (!dirtyHtml || typeof dirtyHtml !== 'string') return '';
        if (dirtyHtml.indexOf('<') === -1) return Utils.escapeHtml(dirtyHtml);
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(dirtyHtml, 'text/html');
            const allowedTags = new Set(['p', 'br', 'strong', 'b', 'em', 'i', 'ul', 'ol', 'li', 'a', 'code', 'pre', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
            const allowedAttrs = { 'a': ['href', 'title', 'target', 'rel'] };

            function sanitizeNode(node) {
                if (node.nodeType === Node.TEXT_NODE) return Utils.escapeHtml(node.textContent || '');
                if (node.nodeType !== Node.ELEMENT_NODE) return '';
                const tag = node.tagName.toLowerCase();
                if (!allowedTags.has(tag)) {
                    return Array.from(node.childNodes).map(sanitizeNode).join('');
                }
                let result = '<' + tag;
                const attrs = node.attributes || [];
                for (let i = 0; i < attrs.length; i++) {
                    const a = attrs[i];
                    const name = a.name.toLowerCase();
                    const val = a.value || '';
                    if (allowedAttrs[tag] && allowedAttrs[tag].includes(name)) {
                        if (name === 'href') {
                            const ok = /^(https?:|mailto:|\/)/i.test(val);
                            if (!ok) continue;
                            result += ' ' + name + '="' + Utils.escapeHtml(val) + '"';
                        } else {
                            result += ' ' + name + '="' + Utils.escapeHtml(val) + '"';
                        }
                    }
                }
                result += '>';
                result += Array.from(node.childNodes).map(sanitizeNode).join('');
                result += '</' + tag + '>';
                return result;
            }
            const body = doc.body || doc;
            return Array.from(body.childNodes).map(sanitizeNode).join('');
        } catch (e) { return Utils.escapeHtml(dirtyHtml); }
    };

    // Disable temporarily
    Utils.disableTemporarily = function (el, ms = 600) {
        if (!el) return;
        try {
            el.disabled = true;
            setTimeout(() => { el.disabled = false; }, ms);
        } catch (e) { }
    };

    window.Simulador.utils = Utils;
})();
