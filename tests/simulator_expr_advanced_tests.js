// simulator_expr_advanced_tests.js
// Pruebas avanzadas: nesting y bordes para funciones de expresiones en el simulador
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
    const na = Number(a), nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return Math.abs(na - nb) < Number.EPSILON;
    return String(a) === String(b);
  }

  function show(v){ try{ return typeof v === 'string' ? `'${v}'` : JSON.stringify(v); }catch{ return String(v); } }
  function assertEq(actual, expected, message){
    const ok = deepEqual(actual, expected);
    const line = ok ? `✅ ${message}` : `❌ ${message} -> esperado ${show(expected)}, obtenido ${show(actual)}`;
    console[ok ? 'info' : 'error']('[ExprAdvanced]', line);
    appendToChat(`<div class="text-xs ${ok ? 'text-green-700' : 'text-red-700'}">${line}</div>`);
    return ok;
  }

  const baseVars = {
    items: ['a','b'],
    items2: [1, '2', 3],
    user: { name: 'Bruno', nickname: ' bru ' }
  };

  const cases = [
    // Nesting join + addItem + split
    { expr: "join(addItem(split('a|b','|'), 'c'), ' - ')", expected: 'a - b - c' },
    { expr: "join(addItem(split('1|2','|'), toNumber('3')), '-')", expected: '1-2-3' },

    // coalesce con resultado vacío de join
    { expr: "coalesce(join(split('', ','), ', '), 'fallback')", expected: 'fallback' },

    // removeItem igualdad laxa
    { expr: "removeItem(items2, 2)", expected: [1,3] },
    { expr: "removeItem(items2, '3')", expected: [1,'2'] },

    // addItem índices fuera de rango (clamp)
    { expr: "addItem(items, 'X', 99)", expected: ['a','b','X'] },
    { expr: "addItem(items, 'Y', -100)", expected: ['Y','a','b'] },

    // removeAt fuera de rango o negativo -> no-op
    { expr: "removeAt(items, 99)", expected: ['a','b'] },
    { expr: "removeAt(items, -1)", expected: ['a','b'] },

    // isEmpty con split de string vacío
    { expr: "isEmpty(split('', ','))", expected: false },

    // contains sobre array proveniente de split
    { expr: "contains(split('a,b', ','), 'a')", expected: true }
  ];

  function runExprAdvancedTests(){
    const EP = window.ExpressionParser;
    if (!EP || typeof EP.evaluate !== 'function'){
      appendToChat('<div class="text-xs text-red-700">ExpressionParser no disponible</div>');
      return false;
    }
    appendToChat('<div class="text-sm font-semibold">▶ Pruebas avanzadas de expresiones (simulador)</div>');
    let okAll = true;
    for (const tc of cases){
      const got = EP.evaluate(tc.expr, { variables: JSON.parse(JSON.stringify(baseVars)) });
      okAll = assertEq(got, tc.expected, tc.expr) && okAll;
    }
    appendToChat(`<div class="text-xs ${okAll ? 'text-green-700' : 'text-red-700'}">Resultado: ${okAll ? 'OK' : 'FALLÓ'} (${cases.length} tests)</div>`);
    return okAll;
  }

  try { window.runExprAdvancedTests = runExprAdvancedTests; } catch(_e){}
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btnRunExprAdvancedTests');
    if (btn) btn.addEventListener('click', () => { try { runExprAdvancedTests(); } catch(e){ console.error(e); } });
  });
})();
