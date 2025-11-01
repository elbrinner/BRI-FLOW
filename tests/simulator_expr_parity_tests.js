// simulator_expr_parity_tests.js
// Suite de paridad: ejecuta expresiones (valor y booleanas) con ExpressionParser y compara contra resultados esperados.
(function(){
  function appendToChat(htmlOrText){
    try{
      const chat = document.getElementById('simulatorChat');
      const wrap = document.createElement('div');
      if (/<[a-z][\s\S]*>/i.test(String(htmlOrText))) {
        wrap.innerHTML = String(htmlOrText);
      } else {
        wrap.textContent = String(htmlOrText);
      }
      if (chat) { chat.appendChild(wrap); chat.scrollTop = chat.scrollHeight; }
    }catch(_e){ /* ignore */ }
  }

  function deepEqual(a, b){
    if (a === b) return true;
    if (a == null || b == null) return a === b;
    if (Array.isArray(a) && Array.isArray(b)){
      if (a.length !== b.length) return false;
      for (let i=0;i<a.length;i++) if (!deepEqual(a[i], b[i])) return false;
      return true;
    }
    if (typeof a === 'object' && typeof b === 'object'){
      const ka = Object.keys(a), kb = Object.keys(b);
      if (ka.length !== kb.length) return false;
      for (const k of ka){ if (!deepEqual(a[k], b[k])) return false; }
      return true;
    }
    // numérico laxo
    const na = Number(a), nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return Math.abs(na - nb) < Number.EPSILON;
    return String(a) === String(b);
  }

  function assertEq(actual, expected, message){
    const ok = deepEqual(actual, expected);
    const show = (v)=>{
      try{ return typeof v === 'string' ? `'${v}'` : JSON.stringify(v); }catch(_e){ return String(v); }
    };
    const line = ok ? `✅ ${message}` : `❌ ${message} -> esperado ${show(expected)}, obtenido ${show(actual)}`;
    console[ok ? 'info' : 'error']('[ExprParity]', line);
    appendToChat(`<div class="text-xs ${ok ? 'text-green-700' : 'text-red-700'}">${line}</div>`);
    return ok;
  }

  // Variables base para las pruebas
  const baseVars = {
    items: ['a','b','c'],
    name: 'Ana Maria',
    code: 'ES-001',
    email: '',
    alias: '',
    user: { name: 'Bruno', nickname: ' bru ' },
    resp: { data: { title: 'Doc' } }
  };

  // Casos de prueba: cubren todas las funciones documentadas
  // type: 'value' | 'boolean'
  const cases = [
    { type: 'value',   expr: "len('hola')", expected: 4 },
    { type: 'value',   expr: "split('a,b,c', ',')", expected: ['a','b','c'] },
    { type: 'value',   expr: "join(split('x|y|z','|'), ', ')", expected: 'x, y, z' },
    { type: 'value',   expr: "toNumber('42')", expected: 42 },
    { type: 'value',   expr: "trim(' hola ')", expected: 'hola' },
    { type: 'value',   expr: "upper('ab')", expected: 'AB' },
    { type: 'value',   expr: "lower('AB')", expected: 'ab' },
    { type: 'boolean', expr: "contains('banana','ana')", expected: true },
    { type: 'boolean', expr: "startsWith('ES-001','ES-')", expected: true },
    { type: 'boolean', expr: "endsWith('file.pdf','.pdf')", expected: true },
    { type: 'boolean', expr: "isEmpty('')", expected: true },
    { type: 'value',   expr: "coalesce('', null, 'x')", expected: 'x' },
    { type: 'boolean', expr: "isNull(null)", expected: true },
    { type: 'boolean', expr: "isNotNull('x')", expected: true },
    { type: 'boolean', expr: "isDefined(resp.data)", expected: true, vars: { resp: { data: { ok:1 } } } },
    { type: 'boolean', expr: "isUndefined(missing)", expected: true },
    // listas nuevas
    { type: 'value',   expr: "addItem(items, 'x')", expected: ['a','b','c','x'] },
    { type: 'value',   expr: "addItem(items, 'X', 1)", expected: ['a','X','b','c'] },
    { type: 'value',   expr: "removeItem(items, 'b')", expected: ['a','c'] },
    { type: 'value',   expr: "removeAt(items, 0)", expected: ['b','c'] },
    // composiciones
    { type: 'boolean', expr: "len(items) > 0 && startsWith(code, 'ES-')", expected: true },
    { type: 'value',   expr: "coalesce(trim(user.nickname), user.name, 'invitado')", expected: 'bru' }
  ];

  function runExprParityTests(){
    const EP = window.ExpressionParser;
    if (!EP || typeof EP.evaluate !== 'function'){
      console.warn('[ExprParity] ExpressionParser no disponible');
      appendToChat('<div class="text-xs text-red-700">ExpressionParser no disponible</div>');
      return false;
    }
    appendToChat('<div class="text-sm font-semibold">▶ Pruebas paridad de expresiones (simulador)</div>');
    let okAll = true;
    for (const tc of cases){
      const vars = Object.assign({}, baseVars, tc.vars || {});
      const got = EP.evaluate(tc.expr, { variables: vars });
      okAll = assertEq(got, tc.expected, tc.expr) && okAll;
    }
    appendToChat(`<div class="text-xs ${okAll ? 'text-green-700' : 'text-red-700'}">Resultado: ${okAll ? 'OK' : 'FALLÓ'} (${cases.length} tests)</div>`);
    return okAll;
  }

  try { window.runExprParityTests = runExprParityTests; } catch(_e){}
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btnRunExprParityTests');
    if (btn) btn.addEventListener('click', () => { try { runExprParityTests(); } catch(e){ console.error(e); } });
  });
})();
