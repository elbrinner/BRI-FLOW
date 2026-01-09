// simulador-core.js
// Primer módulo extraído del simulador monolítico. Proporciona utilidades puras.
(function () {
  const Core = {};

  // Evaluador simplificado: soporta {{var}}, rutas a.b.c, len(x), literales básicos.
  Core.evaluate = function (expr, variables) {
    try {
      if (typeof expr !== 'string') return expr;
      const simplePathRE = /^\s*(?:context\.)?[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\s*$/;
      if (simplePathRE.test(expr)) {
        const path = expr.replace(/^\s*context\./, '').trim();
        const parts = path.split('.').filter(Boolean);
        let val = variables;
        for (const p of parts) { if (val == null) { val = undefined; break; } val = val[p]; }
        return val;
      }
      let s = expr.replace(/\bTrue\b/g, 'true').replace(/\bFalse\b/g, 'false').replace(/\bNone\b/g, 'null');
      s = s.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, name, offset, full) => {
        try {
          const key = name.trim();
          const parts = key.split('.');
          let val = variables;
          for (const p of parts) { if (val == null) { val = undefined; break; } val = val[p]; }
          if (val === undefined || val === null) return 'null';
          if (typeof val === 'number' || typeof val === 'boolean') return String(val);
          if (typeof val === 'string') {
            // Si el placeholder está dentro de comillas JSON ("...{{var}}...") devolver sin comillas extra para evitar doble quoted
            // Detectar caracteres anteriores y posteriores inmediatos
            const prevChar = offset > 0 ? full[offset - 1] : '';
            const nextChar = full[offset + match.length] || '';
            const isInsideQuotedJson = prevChar === '"' && nextChar === '"';
            const escaped = val.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            return isInsideQuotedJson ? escaped : escaped; // fuera también retornamos sin JSON.stringify para texto libre
          }
          return JSON.stringify(val);
        } catch (e) { return 'null'; }
      });
      s = s.replace(/len\(\s*([a-zA-Z_$][a-zA-Z0-9_\.]*)\s*\)/g, (__, vname) => {
        try {
          const parts = vname.split('.');
          let val = variables;
          for (const p of parts) { if (val == null) { val = undefined; break; } val = val[p]; }
          if (Array.isArray(val) || typeof val === 'string') { return String(val.length); }
          if (val && typeof val === 'object') { return String(Object.keys(val).length); }
          return '0';
        } catch (_e) { return '0'; }
      });
      // Intento evaluar como JSON primero
      try {
        const trimmed = s.trim();
        if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
          return JSON.parse(trimmed);
        }
      } catch (_e) {/* continuar */ }
      // Evaluación segura muy limitada: solo números y operadores + - * / % () y literales true/false/null
      if (/^[0-9+*\-/%().\s]+$/.test(s)) {
        try { /* eslint-disable no-new-func */ return Function('return (' + s + ')')(); } catch (_e) { }
      }
      return s;
    } catch (e) { return null; }
  };

  Core.deepClone = function (obj) { try { return JSON.parse(JSON.stringify(obj)); } catch (_e) { return obj; } };

  Core.interpolate = function (str, variables) {
    if (typeof str !== 'string') return str; return str.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, name) => {
      const key = name.trim(); const parts = key.split('.'); let val = variables; for (const p of parts) { if (val == null) { val = undefined; break; } val = val[p]; }
      if (val === undefined || val === null) return ''; return String(val);
    });
  };

  Core.looksLikeMarkdown = function (text) { if (typeof text !== 'string') return false; return /[#_*`>\-\[\]]/.test(text); };

  Core.processText = function (text, asMarkdown) {
    if (!asMarkdown) return text; // se delegará a un renderer markdown externo si existe
    if (window.marked) { try { return window.marked.parse(text); } catch (_e) { return text; } }
    return text;
  };

  Core.getRuntimeState = function () {
    if (window.Simulador && window.Simulador.state) {
      return window.Simulador.state.data;
    }
    return null;
  };

  // Exponer en global
  window.Simulador = window.Simulador || {};
  window.Simulador.core = Core;
})();
