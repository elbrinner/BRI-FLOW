// expression_parser.js
// Módulo auto-contenido que expone una API ligera para tokenizar, parsear y evaluar
// expresiones usadas por el runner. Se expone en window.ExpressionParser para uso en el navegador.
(function(){
  const OPERATORS = {
    'u+': {prec: 7, assoc: 'right', args:1, fn: (a)=>+a},
    'u-': {prec: 7, assoc: 'right', args:1, fn: (a)=>-a},
    '!': {prec: 7, assoc: 'right', args:1, fn: (a)=>!a},
    '*': {prec: 6, assoc: 'left', args:2, fn: (a,b)=>a*b},
    '/': {prec: 6, assoc: 'left', args:2, fn: (a,b)=>a/b},
    '%': {prec: 6, assoc: 'left', args:2, fn: (a,b)=>a%b},
    '+': {prec: 5, assoc: 'left', args:2, fn: (a,b)=>a+b},
    '-': {prec: 5, assoc: 'left', args:2, fn: (a,b)=>a-b},
    '<': {prec:4, assoc:'left', args:2, fn:(a,b)=>a<b},
    '<=':{prec:4, assoc:'left', args:2, fn:(a,b)=>a<=b},
    '>': {prec:4, assoc:'left', args:2, fn:(a,b)=>a>b},
    '>=':{prec:4, assoc:'left', args:2, fn:(a,b)=>a>=b},
    '==':{prec:3, assoc:'left', args:2, fn:(a,b)=>a==b},
    '===':{prec:3, assoc:'left', args:2, fn:(a,b)=>a===b},
    '!=':{prec:3, assoc:'left', args:2, fn:(a,b)=>a!=b},
    '!==':{prec:3, assoc:'left', args:2, fn:(a,b)=>a!==b},
    '&&':{prec:2, assoc:'left', args:2, fn:(a,b)=>a&&b},
    '||':{prec:1, assoc:'left', args:2, fn:(a,b)=>a||b}
  };

  function splitTopLevel(s, sep) {
    const parts = [];
    let depth = 0; let cur = '';
    for (let i=0;i<s.length;i++) {
      const ch = s[i];
      if (ch === '(') { depth++; cur += ch; continue; }
      if (ch === ')') { depth--; cur += ch; continue; }
      if (depth === 0 && s.slice(i, i+sep.length) === sep) {
        parts.push(cur.trim()); cur = ''; i += sep.length-1; continue;
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
    const isId = (c) => /[a-zA-Z0-9_]/.test(c);
    while (i < input.length) {
      const ch = input[i];
      if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') { i++; continue; }
      if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(input[i+1] || ''))) {
        let j = i; let seenDot = false;
        while (j < input.length && /[0-9.]/.test(input[j])) { if (input[j]==='.' ) { if (seenDot) break; seenDot = true;} j++; }
        tokens.push({ type: 'number', value: Number(input.slice(i, j)) });
        i = j; continue;
      }
      if (ch === '"' || ch === "'") {
        const quote = ch; let j = i+1; let str = '';
        while (j < input.length) {
          const c = input[j];
          if (c === '\\') { const next = input[j+1] || ''; str += next; j += 2; continue; }
          if (c === quote) { j++; break; }
          str += c; j++;
        }
        tokens.push({ type: 'string', value: str }); i = j; continue;
      }
      if (isIdStart(ch)) {
        let j = i+1; while (j < input.length && isId(input[j])) j++;
        const id = input.slice(i, j);
        const idLower = id.toLowerCase();
        if (idLower === 'true' || idLower === 'false') tokens.push({ type: 'boolean', value: idLower === 'true' });
        else if (idLower === 'null' || idLower === 'undefined') tokens.push({ type: 'null', value: null });
        else tokens.push({ type: 'identifier', value: id });
        i = j; continue;
      }
      const two = input.slice(i, i+2);
      const three = input.slice(i, i+3);
      const twoOps = ['==','!=','<=','>=','&&','||','?:'];
      const threeOps = ['===','!=='];
      if (threeOps.includes(three)) { tokens.push({ type: 'operator', value: three}); i += 3; continue; }
      if (twoOps.includes(two)) { tokens.push({ type: 'operator', value: two}); i += 2; continue; }
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
    for (let i=0;i<tokens.length;i++) {
      const t = tokens[i];
      if (t.type === 'number' || t.type === 'string' || t.type === 'boolean' || t.type === 'null') { output.push(t); continue; }
      if (t.type === 'identifier') {
        if (tokens[i+1] && tokens[i+1].type === 'paren' && tokens[i+1].value === '(') {
          ops.push({ type: 'func', name: t.value, argCount: 0 });
        } else {
          output.push(t);
        }
        continue;
      }
      if (t.type === 'paren' && t.value === '(') { ops.push(t); continue; }
      if (t.type === 'paren' && t.value === ')') {
        while (ops.length && !(ops[ops.length-1].type === 'paren' && ops[ops.length-1].value === '(')) {
          output.push(ops.pop());
        }
        if (!ops.length) throw new Error('Mismatched parentheses');
        ops.pop();
        if (ops.length && ops[ops.length-1].type === 'func') {
          const fn = ops.pop();
          // Calculate final arg count: commas incremented argCount per comma while inside parens,
          // so the total number of args is commaCount + (hadArgBefore ? 1 : 0).
          const prevToken = tokens[i-1];
          const hadArgBefore = prevToken && !(prevToken.type === 'paren' && prevToken.value === '(');
          const commaCount = fn.argCount || 0;
          fn.argCount = hadArgBefore ? (commaCount + 1) : 0;
          output.push(fn);
        }
        continue;
      }
      if (t.type === 'comma') {
        while (ops.length && !(ops[ops.length-1].type === 'paren' && ops[ops.length-1].value === '(')) {
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
        if ((op === '+' || op === '-') ) {
          const prev = tokens[i-1];
          if (!prev || prev.type === 'operator' || (prev.type === 'paren' && prev.value === '(') || prev.type === 'comma' || prev.type === 'question') {
            op = 'u' + op;
          }
        }
        if (op === '!') {
          const prev = tokens[i-1];
          if (!prev || prev.type === 'operator' || (prev.type === 'paren' && prev.value === '(') || prev.type === 'comma') op = '!';
        }
        const o1 = OPERATORS[op];
        if (!o1 && t.type !== 'question' && t.type !== 'colon') throw new Error('Unsupported operator: ' + op);
        if (t.type === 'question') { ops.push({ type: 'ternary_q' }); continue; }
        if (t.type === 'colon') { while (ops.length && ops[ops.length-1].type !== 'ternary_q') output.push(ops.pop()); ops.push({ type: 'ternary_colon' }); continue; }
        while (ops.length) {
          const top = ops[ops.length-1];
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
        for (let i=0;i<argc;i++) args.unshift(stack.pop());
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
        const falseVal = stack.pop(); const trueVal = stack.pop(); const cond = stack.pop(); stack.push({ type: 'ternary', cond, trueVal, falseVal}); continue;
      }
      if (t.type === 'ternary_q') { continue; }
      throw new Error('Unsupported RPN token in ast conversion: ' + JSON.stringify(t));
    }
    if (stack.length !== 1) throw new Error('Invalid expression AST (stack length ' + stack.length + ')');
    return stack[0];
  }

  function getFunctionRegistry() {
    return {
      len: (a) => (a == null ? 0 : (Array.isArray(a) || typeof a === 'string') ? a.length : 1),
      upper: (a) => a == null ? a : String(a).toUpperCase(),
      lower: (a) => a == null ? a : String(a).toLowerCase(),
      parseInt: (a) => Number.parseInt(a, 10),
      parseFloat: (a) => Number.parseFloat(a),
      join: (arr, sep) => Array.isArray(arr) ? arr.join(sep||',') : arr,
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
      }
    };
  }

  function evalAst(node, ctx) {
    const funcs = getFunctionRegistry();
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
        const funcsLocal = getFunctionRegistry();
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
        const numericOps = ['+','-','*','/','%','<','<=','>','>='];
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
        return opobj.fn(a,b);
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
