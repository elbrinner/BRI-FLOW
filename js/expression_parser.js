// expression_parser.js
// Módulo auto-contenido que expone una API ligera para tokenizar, parsear y evaluar
// expresiones usadas por el runner. Se expone en window.ExpressionParser para uso en el navegador.
(function () {
  const OPERATORS = {
    'u+': { prec: 7, assoc: 'right', args: 1, fn: (a) => +a },
    'u-': { prec: 7, assoc: 'right', args: 1, fn: (a) => -a },
    '!': { prec: 7, assoc: 'right', args: 1, fn: (a) => !a },
    '*': { prec: 6, assoc: 'left', args: 2, fn: (a, b) => a * b },
    '/': { prec: 6, assoc: 'left', args: 2, fn: (a, b) => a / b },
    '%': { prec: 6, assoc: 'left', args: 2, fn: (a, b) => a % b },
    '+': { prec: 5, assoc: 'left', args: 2, fn: (a, b) => a + b },
    '-': { prec: 5, assoc: 'left', args: 2, fn: (a, b) => a - b },
    '<': { prec: 4, assoc: 'left', args: 2, fn: (a, b) => a < b },
    '<=': { prec: 4, assoc: 'left', args: 2, fn: (a, b) => a <= b },
    '>': { prec: 4, assoc: 'left', args: 2, fn: (a, b) => a > b },
    '>=': { prec: 4, assoc: 'left', args: 2, fn: (a, b) => a >= b },
    '==': { prec: 3, assoc: 'left', args: 2, fn: (a, b) => a == b },
    '===': { prec: 3, assoc: 'left', args: 2, fn: (a, b) => a === b },
    '!=': { prec: 3, assoc: 'left', args: 2, fn: (a, b) => a != b },
    '!==': { prec: 3, assoc: 'left', args: 2, fn: (a, b) => a !== b },
    '&&': { prec: 2, assoc: 'left', args: 2, fn: (a, b) => a && b },
    '||': { prec: 1, assoc: 'left', args: 2, fn: (a, b) => a || b }
  };

  function splitTopLevel(s, sep) {
    const parts = [];
    let depth = 0; let cur = '';
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === '(') { depth++; cur += ch; continue; }
      if (ch === ')') { depth--; cur += ch; continue; }
      if (depth === 0 && s.slice(i, i + sep.length) === sep) {
        parts.push(cur.trim()); cur = ''; i += sep.length - 1; continue;
      }
      cur += ch;
    }
    if (cur.trim() !== '') parts.push(cur.trim());
    return parts;
  }

  function tokenize(input) {
    const tokens = [];
    let i = 0;
    const isIdStart = (c) => /[a-zA-Z_]/.test(c);
    // Permitir rutas con punto (user.nickname)
    const isId = (c) => /[a-zA-Z0-9_\.]/.test(c);
    while (i < input.length) {
      const ch = input[i];
      if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') { i++; continue; }
      if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(input[i + 1] || ''))) {
        let j = i; let seenDot = false;
        while (j < input.length && /[0-9.]/.test(input[j])) { if (input[j] === '.') { if (seenDot) break; seenDot = true; } j++; }
        tokens.push({ type: 'number', value: Number(input.slice(i, j)) });
        i = j; continue;
      }
      if (ch === '"' || ch === "'") {
        const quote = ch; let j = i + 1; let str = '';
        while (j < input.length) {
          const c = input[j];
          if (c === '\\') { const next = input[j + 1] || ''; str += next; j += 2; continue; }
          if (c === quote) { j++; break; }
          str += c; j++;
        }
        tokens.push({ type: 'string', value: str }); i = j; continue;
      }
      if (isIdStart(ch)) {
        let j = i + 1; while (j < input.length && isId(input[j])) j++;
        const id = input.slice(i, j);
        const idLower = id.toLowerCase();
        if (idLower === 'true' || idLower === 'false') tokens.push({ type: 'boolean', value: idLower === 'true' });
        else if (idLower === 'null' || idLower === 'undefined') tokens.push({ type: 'null', value: null });
        else tokens.push({ type: 'identifier', value: id });
        i = j; continue;
      }
      const two = input.slice(i, i + 2);
      const three = input.slice(i, i + 3);
      const twoOps = ['==', '!=', '<=', '>=', '&&', '||', '?:'];
      const threeOps = ['===', '!=='];
      if (threeOps.includes(three)) { tokens.push({ type: 'operator', value: three }); i += 3; continue; }
      if (twoOps.includes(two)) { tokens.push({ type: 'operator', value: two }); i += 2; continue; }
      if ('+-*/%<>!?:(),'.includes(ch)) {
        if (ch === '(' || ch === ')') tokens.push({ type: 'paren', value: ch });
        else if (ch === ',') tokens.push({ type: 'comma' });
        else if (ch === '?') tokens.push({ type: 'question' });
        else if (ch === ':') tokens.push({ type: 'colon' });
        else tokens.push({ type: 'operator', value: ch });
        i++; continue;
      }
      throw new Error('Unexpected char in expression: ' + ch);
    }
    return tokens;
  }

  function shuntingYard(tokens) {
    const output = [];
    const ops = [];
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (t.type === 'number' || t.type === 'string' || t.type === 'boolean' || t.type === 'null') { output.push(t); continue; }
      if (t.type === 'identifier') {
        if (tokens[i + 1] && tokens[i + 1].type === 'paren' && tokens[i + 1].value === '(') {
          ops.push({ type: 'func', name: t.value, argCount: 0 });
        } else {
          output.push(t);
        }
        continue;
      }
      if (t.type === 'paren' && t.value === '(') { ops.push(t); continue; }
      if (t.type === 'paren' && t.value === ')') {
        while (ops.length && !(ops[ops.length - 1].type === 'paren' && ops[ops.length - 1].value === '(')) {
          output.push(ops.pop());
        }
        if (!ops.length) throw new Error('Mismatched parentheses');
        ops.pop();
        if (ops.length && ops[ops.length - 1].type === 'func') {
          const fn = ops.pop();
          // Calculate final arg count: commas incremented argCount per comma while inside parens,
          // so the total number of args is commaCount + (hadArgBefore ? 1 : 0).
          const prevToken = tokens[i - 1];
          const hadArgBefore = prevToken && !(prevToken.type === 'paren' && prevToken.value === '(');
          const commaCount = fn.argCount || 0;
          fn.argCount = hadArgBefore ? (commaCount + 1) : 0;
          output.push(fn);
        }
        continue;
      }
      if (t.type === 'comma') {
        while (ops.length && !(ops[ops.length - 1].type === 'paren' && ops[ops.length - 1].value === '(')) {
          output.push(ops.pop());
        }
        // Find the last opening paren in ops and increment the func immediately before it (if any)
        let idxParen = -1;
        for (let k = ops.length - 1; k >= 0; k--) {
          if (ops[k].type === 'paren' && ops[k].value === '(') { idxParen = k; break; }
        }
        if (idxParen > 0 && ops[idxParen - 1] && ops[idxParen - 1].type === 'func') {
          ops[idxParen - 1].argCount = (ops[idxParen - 1].argCount || 0) + 1;
        }
        continue;
      }
      if (t.type === 'operator' || t.type === 'question' || t.type === 'colon') {
        let op = t.value;
        if ((op === '+' || op === '-')) {
          const prev = tokens[i - 1];
          if (!prev || prev.type === 'operator' || (prev.type === 'paren' && prev.value === '(') || prev.type === 'comma' || prev.type === 'question') {
            op = 'u' + op;
          }
        }
        if (op === '!') {
          const prev = tokens[i - 1];
          if (!prev || prev.type === 'operator' || (prev.type === 'paren' && prev.value === '(') || prev.type === 'comma') op = '!';
        }
        const o1 = OPERATORS[op];
        if (!o1 && t.type !== 'question' && t.type !== 'colon') throw new Error('Unsupported operator: ' + op);
        if (t.type === 'question') { ops.push({ type: 'ternary_q' }); continue; }
        if (t.type === 'colon') { while (ops.length && ops[ops.length - 1].type !== 'ternary_q') output.push(ops.pop()); ops.push({ type: 'ternary_colon' }); continue; }
        while (ops.length) {
          const top = ops[ops.length - 1];
          if (top.type === 'operator' || top.type === 'opobj') {
            const o2 = top.opobj || OPERATORS[top.value];
            if (!o2) break;
            if ((o1.assoc === 'left' && o1.prec <= o2.prec) || (o1.assoc === 'right' && o1.prec < o2.prec)) {
              output.push(ops.pop()); continue;
            }
          }
          break;
        }
        if (o1) ops.push({ type: 'opobj', op: op, opobj: o1, value: op });
        continue;
      }
      throw new Error('Unknown token in shunting yard: ' + JSON.stringify(t));
    }
    while (ops.length) {
      const o = ops.pop();
      if (o.type === 'paren') throw new Error('Mismatched parentheses');
      output.push(o);
    }
    return output;
  }

  function rpnToAst(rpn) {
    const stack = [];
    for (const t of rpn) {
      if (t.type === 'number' || t.type === 'string' || t.type === 'boolean' || t.type === 'null') { stack.push({ type: 'literal', value: t.value }); continue; }
      if (t.type === 'identifier') { stack.push({ type: 'identifier', name: t.value }); continue; }
      if (t.type === 'func') {
        const argc = t.argCount || 0; const args = [];
        for (let i = 0; i < argc; i++) args.unshift(stack.pop());
        stack.push({ type: 'call', name: t.name, args }); continue;
      }
      if (t.type === 'opobj') {
        const op = t.opobj; if (!op) throw new Error('Missing operator object');
        if (op.args === 1) {
          const a = stack.pop(); stack.push({ type: 'unary', op: t.op, child: a });
        } else if (op.args === 2) {
          const b = stack.pop(); const a = stack.pop(); stack.push({ type: 'binary', op: t.op, left: a, right: b });
        }
        continue;
      }
      if (t.type === 'ternary_colon') {
        const falseVal = stack.pop(); const trueVal = stack.pop(); const cond = stack.pop(); stack.push({ type: 'ternary', cond, trueVal, falseVal }); continue;
      }
      if (t.type === 'ternary_q') { continue; }
      throw new Error('Unsupported RPN token in ast conversion: ' + JSON.stringify(t));
    }
    if (stack.length !== 1) throw new Error('Invalid expression AST (stack length ' + stack.length + ')');
    return stack[0];
  }

  function getFunctionRegistry(ctx) {
    // Helper para evaluar expresiones con scope { item, index, acc } sobre el contexto actual
    function evalInScope(expr, locals) {
      try {
        if (expr == null) return undefined;
        // Si el selector/predicado es una función JS (defensivo), invocarla directamente
        if (typeof expr === 'function') {
          try { return expr(locals.item, locals.index, locals.acc); } catch (_e) { return undefined; }
        }
        // Si es string, evaluarlo usando el parser con variables extendidas
        if (typeof expr === 'string') {
          const merged = { variables: Object.assign({}, (ctx && ctx.variables) || {}, locals || {}) };
          return evaluateExpression(expr, merged);
        }
        // Si es valor literal, devolverlo tal cual
        return expr;
      } catch (_e) { return undefined; }
    }

    // Utilidades para arrays (no mutan)
    const asArray = (src) => {
      if (src == null) return [];
      if (Array.isArray(src)) return src.slice();
      if (typeof src !== 'string' && src[Symbol && Symbol.iterator]) return [...src];
      return [src];
    };

    return {
      len: (a) => (a == null ? 0 : (Array.isArray(a) || typeof a === 'string') ? a.length : 1),
      upper: (a) => a == null ? a : String(a).toUpperCase(),
      lower: (a) => a == null ? a : String(a).toLowerCase(),
      parseInt: (a) => Number.parseInt(a, 10),
      parseFloat: (a) => Number.parseFloat(a),
      join: (arr, sep) => Array.isArray(arr) ? arr.join(sep || ',') : arr,
      split: (s, sep) => String(s).split(sep || ',')
      ,
      bool: (v) => {
        if (v === true || v === false) return v;
        if (v == null) return false;
        const s = String(v).trim().toLowerCase();
        if (s === 'true' || s === '1' || s === 'yes' || s === 'y') return true;
        if (s === 'false' || s === '0' || s === 'no' || s === 'n') return false;
        return Boolean(v);
      }
      ,
      toNumber: (v) => {
        if (v == null || v === '') return NaN;
        const n = Number(v);
        return Number.isFinite(n) ? n : NaN;
      },
      trim: (s) => s == null ? s : String(s).trim(),
      contains: (hay, needle) => {
        if (hay == null) return false;
        if (Array.isArray(hay)) return hay.indexOf(needle) !== -1;
        return String(hay).indexOf(String(needle)) !== -1;
      },
      startsWith: (s, pref) => s == null ? false : String(s).startsWith(String(pref)),
      endsWith: (s, suf) => s == null ? false : String(s).endsWith(String(suf)),
      isEmpty: (v) => (v == null) || (Array.isArray(v) && v.length === 0) || (typeof v === 'string' && v.trim() === ''),
      isNull: (v) => v === null || v === undefined,
      isNotNull: (v) => !(v === null || v === undefined),
      isDefined: (v) => !(v === undefined || v === null),
      isUndefined: (v) => (v === undefined || v === null),
      coalesce: (...args) => {
        for (const a of args) if (a !== null && a !== undefined && a !== '') return a; return null;
      },
      // List manipulation (editor only, pure functions)
      addItem: (list, value, index) => {
        const toArray = (src) => {
          if (src == null) return [];
          if (Array.isArray(src)) return [...src];
          // if it's iterable but not string/array, spread it; else wrap as single
          if (typeof src !== 'string' && typeof src[Symbol.iterator] === 'function') return [...src];
          return [src];
        };
        const arr = toArray(list);
        if (index === undefined || index === null || index === '' || isNaN(Number(index))) {
          arr.push(value);
          return arr;
        }
        let idx = Number(index);
        if (!Number.isFinite(idx)) { arr.push(value); return arr; }
        idx = Math.round(idx);
        if (idx < 0) idx = 0;
        if (idx > arr.length) idx = arr.length;
        arr.splice(idx, 0, value);
        return arr;
      },
      removeItem: (list, value) => {
        const toArray = (src) => {
          if (src == null) return [];
          if (Array.isArray(src)) return [...src];
          if (typeof src !== 'string' && typeof src[Symbol.iterator] === 'function') return [...src];
          return [src];
        };
        const looseEq = (a, b) => {
          if (a === b) return true;
          if (a == null || b == null) return false;
          const an = Number(a), bn = Number(b);
          if (Number.isFinite(an) && Number.isFinite(bn)) return Math.abs(an - bn) < Number.EPSILON;
          return String(a) === String(b);
        };
        const arr = toArray(list);
        const idx = arr.findIndex(x => looseEq(x, value));
        if (idx >= 0) { arr.splice(idx, 1); }
        return arr;
      },
      removeAt: (list, index) => {
        const toArray = (src) => {
          if (src == null) return [];
          if (Array.isArray(src)) return [...src];
          if (typeof src !== 'string' && typeof src[Symbol.iterator] === 'function') return [...src];
          return [src];
        };
        const arr = toArray(list);
        let idx = Number(index);
        if (!Number.isFinite(idx)) return arr;
        idx = Math.round(idx);
        if (idx >= 0 && idx < arr.length) arr.splice(idx, 1);
        return arr;
      },

      // LINQ‑like helpers
      where: (list, predicate) => {
        const arr = asArray(list);
        try { return arr.filter((it, i) => !!evalInScope(predicate, { item: it, index: i })); } catch (_e) { return arr.slice(); }
      },
      filter: (list, predicate) => {
        const arr = asArray(list);
        try { return arr.filter((it, i) => !!evalInScope(predicate, { item: it, index: i })); } catch (_e) { return arr.slice(); }
      },
      select: (list, selector) => {
        const arr = asArray(list);
        try { return arr.map((it, i) => evalInScope(selector, { item: it, index: i })); } catch (_e) { return arr.slice(); }
      },
      map: (list, selector) => {
        const arr = asArray(list);
        try { return arr.map((it, i) => evalInScope(selector, { item: it, index: i })); } catch (_e) { return arr.slice(); }
      },
      orderBy: (list, keySelector, dir) => {
        const arr = asArray(list);
        const direction = String(dir || 'asc').toLowerCase();
        const asc = direction !== 'desc';
        try {
          return arr.slice().sort((a, b) => {
            const ka = keySelector ? evalInScope(keySelector, { item: a, index: 0 }) : a;
            const kb = keySelector ? evalInScope(keySelector, { item: b, index: 0 }) : b;
            if (ka == null && kb == null) return 0; if (ka == null) return asc ? -1 : 1; if (kb == null) return asc ? 1 : -1;
            if (typeof ka === 'number' && typeof kb === 'number') return asc ? (ka - kb) : (kb - ka);
            return asc ? String(ka).localeCompare(String(kb)) : String(kb).localeCompare(String(ka));
          });
        } catch (_e) { return arr.slice(); }
      },
      orderByDesc: (list, keySelector) => {
        const arr = asArray(list);
        try {
          return arr.slice().sort((a, b) => {
            const ka = keySelector ? evalInScope(keySelector, { item: a, index: 0 }) : a;
            const kb = keySelector ? evalInScope(keySelector, { item: b, index: 0 }) : b;
            if (ka == null && kb == null) return 0; if (ka == null) return 1; if (kb == null) return -1;
            if (typeof ka === 'number' && typeof kb === 'number') return (kb - ka);
            return String(kb).localeCompare(String(ka));
          });
        } catch (_e) { return arr.slice().reverse(); }
      },
      distinct: (list, keySelector) => {
        const arr = asArray(list); const seen = new Set(); const out = [];
        for (let i = 0; i < arr.length; i++) {
          const it = arr[i];
          const key = keySelector ? evalInScope(keySelector, { item: it, index: i }) : it;
          const sig = (key && typeof key === 'object') ? JSON.stringify(key) : String(key);
          if (!seen.has(sig)) { seen.add(sig); out.push(it); }
        }
        return out;
      },
      take: (list, n) => {
        const arr = asArray(list); const k = Number(n) || 0; if (k <= 0) return [];
        return arr.slice(0, k);
      },
      skip: (list, n) => {
        const arr = asArray(list); const k = Number(n) || 0; if (k <= 0) return arr.slice();
        return arr.slice(k);
      },
      sum: (list, selector) => {
        const arr = asArray(list);
        let s = 0; for (let i = 0; i < arr.length; i++) {
          const v = selector ? evalInScope(selector, { item: arr[i], index: i }) : arr[i];
          const n = Number(v); if (Number.isFinite(n)) s += n;
        } return s;
      },
      avg: (list, selector) => {
        const arr = asArray(list); if (!arr.length) return 0;
        let s = 0, c = 0; for (let i = 0; i < arr.length; i++) {
          const v = selector ? evalInScope(selector, { item: arr[i], index: i }) : arr[i];
          const n = Number(v); if (Number.isFinite(n)) { s += n; c++; }
        } return c ? (s / c) : 0;
      },
      min: (list, selector) => {
        const arr = asArray(list); let m = Infinity; let has = false;
        for (let i = 0; i < arr.length; i++) { const v = selector ? evalInScope(selector, { item: arr[i], index: i }) : arr[i]; const n = Number(v); if (Number.isFinite(n)) { m = Math.min(m, n); has = true; } }
        return has ? m : null;
      },
      max: (list, selector) => {
        const arr = asArray(list); let m = -Infinity; let has = false;
        for (let i = 0; i < arr.length; i++) { const v = selector ? evalInScope(selector, { item: arr[i], index: i }) : arr[i]; const n = Number(v); if (Number.isFinite(n)) { m = Math.max(m, n); has = true; } }
        return has ? m : null;
      },
      count: (list, predicate) => {
        const arr = asArray(list);
        if (!predicate) return arr.length;
        let c = 0; for (let i = 0; i < arr.length; i++) { if (evalInScope(predicate, { item: arr[i], index: i })) c++; }
        return c;
      },
      first: (list, predicate) => {
        const arr = asArray(list);
        if (!predicate) return arr.length ? arr[0] : null;
        for (let i = 0; i < arr.length; i++) { if (evalInScope(predicate, { item: arr[i], index: i })) return arr[i]; }
        return null;
      },
      last: (list, predicate) => {
        const arr = asArray(list);
        if (!predicate) return arr.length ? arr[arr.length - 1] : null;
        for (let i = arr.length - 1; i >= 0; i--) { if (evalInScope(predicate, { item: arr[i], index: i })) return arr[i]; }
        return null;
      },
      reduce: (list, seed, expr) => {
        const arr = asArray(list);
        let acc = seed;
        for (let i = 0; i < arr.length; i++) {
          acc = evalInScope(expr, { item: arr[i], index: i, acc });
        }
        return acc;
      },
      // Advanced Collection Functions
      groupBy: (list, keySelector) => {
        const arr = asArray(list);
        const map = new Map();
        arr.forEach((item, i) => {
          const key = keySelector ? evalInScope(keySelector, { item, index: i }) : item;
          const keyStr = (typeof key === 'object') ? JSON.stringify(key) : String(key);
          if (!map.has(keyStr)) map.set(keyStr, { Key: key, Items: [] });
          map.get(keyStr).Items.push(item);
        });
        return Array.from(map.values());
      },
      keyBy: (list, keySelector) => {
        const arr = asArray(list);
        const res = {};
        arr.forEach((item, i) => {
          const key = keySelector ? evalInScope(keySelector, { item, index: i }) : item;
          res[String(key)] = item;
        });
        return res;
      },
      union: (list1, list2) => {
        const s = new Set([...asArray(list1), ...asArray(list2)]);
        return Array.from(s);
      },
      intersect: (list1, list2) => {
        const s2 = new Set(asArray(list2));
        return asArray(list1).filter(x => s2.has(x));
      },
      except: (list1, list2) => {
        const s2 = new Set(asArray(list2));
        return asArray(list1).filter(x => !s2.has(x));
      },
      // Statistics
      median: (list, selector) => {
        const arr = asArray(list).map((it, i) => selector ? Number(evalInScope(selector, { item: it, index: i })) : Number(it)).filter(n => Number.isFinite(n)).sort((a, b) => a - b);
        if (!arr.length) return 0;
        const mid = Math.floor(arr.length / 2);
        return arr.length % 2 !== 0 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
      },
      mode: (list, selector) => {
        const arr = asArray(list).map((it, i) => selector ? Number(evalInScope(selector, { item: it, index: i })) : Number(it)).filter(n => Number.isFinite(n));
        if (!arr.length) return 0;
        const counts = {}; let max = 0; let res = arr[0];
        for (const n of arr) { counts[n] = (counts[n] || 0) + 1; if (counts[n] > max) { max = counts[n]; res = n; } }
        return res;
      },
      percentile: (list, p, selector) => {
        const arr = asArray(list).map((it, i) => selector ? Number(evalInScope(selector, { item: it, index: i })) : Number(it)).filter(n => Number.isFinite(n)).sort((a, b) => a - b);
        if (!arr.length) return 0;
        const pos = (arr.length - 1) * p;
        const base = Math.floor(pos);
        const rest = pos - base;
        if (arr[base + 1] !== undefined) return arr[base] + rest * (arr[base + 1] - arr[base]);
        return arr[base];
      },
      // Mutation / Path Helpers (Side-effects on objects passed by reference)
      setAtPath: (obj, path, value) => {
        if (!obj || typeof obj !== 'object') return obj;
        const parts = String(path).split('.').filter(Boolean);
        let cur = obj;
        for (let i = 0; i < parts.length - 1; i++) {
          const p = parts[i];
          if (cur[p] === undefined || cur[p] === null) cur[p] = {};
          cur = cur[p];
        }
        if (parts.length > 0) cur[parts[parts.length - 1]] = value;
        return obj;
      },
      setPropWhere: (list, predicate, prop, value) => {
        const arr = asArray(list);
        let count = 0;
        arr.forEach((item, i) => {
          if (item && typeof item === 'object' && evalInScope(predicate, { item, index: i })) {
            item[prop] = value;
            count++;
          }
        });
        return count;
      },
      setAtPathWhere: (list, predicate, path, value) => {
        const arr = asArray(list);
        let count = 0;
        arr.forEach((item, i) => {
          if (item && typeof item === 'object' && evalInScope(predicate, { item, index: i })) {
            // set at path inside item
            const parts = String(path).split('.').filter(Boolean);
            let cur = item;
            let ok = true;
            for (let k = 0; k < parts.length - 1; k++) {
              const p = parts[k];
              if (cur[p] === undefined || cur[p] === null) cur[p] = {};
              cur = cur[p];
              if (typeof cur !== 'object') { ok = false; break; }
            }
            if (ok && parts.length > 0) {
              cur[parts[parts.length - 1]] = value;
              count++;
            }
          }
        });
        return count;
      },
      removeAtPath: (obj, path) => {
        if (!obj || typeof obj !== 'object') return obj;
        const parts = String(path).split('.').filter(Boolean);
        let cur = obj;
        for (let i = 0; i < parts.length - 1; i++) {
          const p = parts[i];
          if (cur[p] === undefined || cur[p] === null) return obj;
          cur = cur[p];
        }
        if (parts.length > 0 && cur) delete cur[parts[parts.length - 1]];
        return obj;
      },
      deepMap: (obj, fn) => {
        // Simple deep map implementation
        const mapFn = (v, k) => {
          if (v && typeof v === 'object') {
            if (Array.isArray(v)) return v.map((it, i) => mapFn(it, i));
            const res = {};
            for (const key in v) res[key] = mapFn(v[key], key);
            return res;
          }
          return fn ? fn(v, k) : v;
        };
        return mapFn(obj);
      },
      // Business Specific Placeholders (No-ops or simple loggers for simulator)
      AppendUseCaseItem: (list, val) => { console.log('[Sim] AppendUseCaseItem', val); return list; },
      PersistBASelectionsView: (v) => { console.log('[Sim] PersistBASelectionsView', v); return true; },
      PersistDSSelectionsView: (v) => { console.log('[Sim] PersistDSSelectionsView', v); return true; },
      PersistUCItem: (v) => { console.log('[Sim] PersistUCItem', v); return true; },
      PersistUCItems: (v) => { console.log('[Sim] PersistUCItems', v); return true; },
      RecalcViewCompletion: (v) => { console.log('[Sim] RecalcViewCompletion', v); return 100; }
    };
  }

  function evalAst(node, ctx) {
    const funcs = getFunctionRegistry(ctx);
    if (!node) return undefined;
    switch (node.type) {
      case 'literal': return node.value;
      case 'identifier': return resolvePath(ctx.variables || {}, node.name.split('.'));
      case 'call': {
        const fn = funcs[node.name];
        const args = node.args.map(a => evalAst(a, ctx));
        if (!fn) return undefined; return fn(...args);
      }
      case 'unary': {
        const val = evalAst(node.child, ctx);
        const opobj = OPERATORS[node.op];
        if (!opobj) throw new Error('Unknown unary op ' + node.op);
        return opobj.fn(val);
      }
      case 'binary': {
        if (node.op === '&&') {
          const left = evalAst(node.left, ctx);
          if (!left) return left;
          return evalAst(node.right, ctx);
        }
        if (node.op === '||') {
          const left = evalAst(node.left, ctx);
          if (left) return left;
          return evalAst(node.right, ctx);
        }
        let a = evalAst(node.left, ctx);
        let b = evalAst(node.right, ctx);
        const funcsLocal = getFunctionRegistry(ctx);
        if (node.op === '==' || node.op === '!=') {
          if (typeof a === 'boolean' || typeof b === 'boolean') {
            const aa = (typeof a === 'boolean') ? a : (funcsLocal.bool ? funcsLocal.bool(a) : Boolean(a));
            const bb = (typeof b === 'boolean') ? b : (funcsLocal.bool ? funcsLocal.bool(b) : Boolean(b));
            const eq = aa === bb;
            return node.op === '==' ? eq : !eq;
          }
        }
        // Coercion helper: if operator is arithmetic or numeric comparison, coerce to Number
        // only when BOTH operands look like numbers (safer: preserves concatenation when one is non-numeric string)
        const numericOps = ['+', '-', '*', '/', '%', '<', '<=', '>', '>='];
        if (numericOps.includes(node.op)) {
          const looksLikeNumber = (v) => (typeof v === 'number') || (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v)));
          if (looksLikeNumber(a) && looksLikeNumber(b)) {
            const na = Number(a);
            const nb = Number(b);
            a = Number.isFinite(na) ? na : a;
            b = Number.isFinite(nb) ? nb : b;
          }
        }
        const opobj = OPERATORS[node.op];
        if (!opobj) throw new Error('Unknown binary op ' + node.op);
        return opobj.fn(a, b);
      }
      case 'ternary': {
        const c = evalAst(node.cond, ctx); return c ? evalAst(node.trueVal, ctx) : evalAst(node.falseVal, ctx);
      }
    }
    return undefined;
  }

  function resolvePath(obj, pathParts) {
    let cur = obj;
    for (const p of pathParts) {
      if (cur == null) return undefined;
      cur = cur[p];
    }
    return cur;
  }

  function evaluateExpression(expr, ctx) {
    if (expr == null) return null;
    if (typeof expr !== 'string') return expr;
    const s = expr.trim();
    if (s.includes('||')) {
      const parts = splitTopLevel(s, '||');
      for (const p of parts) {
        const v = evaluateExpression(p, ctx);
        if (v !== undefined && v !== null && v !== '') return v;
      }
      return '';
    }
    try {
      const tokens = tokenize(s);
      const rpn = shuntingYard(tokens);
      const ast = rpnToAst(rpn);
      return evalAst(ast, ctx);
    } catch (e) {
      console.debug('[expression_parser] parse error:', e?.message || e);
      return s;
    }
  }

  // Expose API
  window.ExpressionParser = {
    OPERATORS,
    splitTopLevel,
    tokenize,
    shuntingYard,
    rpnToAst,
    evalAst,
    getFunctionRegistry,
    resolvePath,
    evaluate: evaluateExpression
  };

})();
