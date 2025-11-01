// simulator_expr_list_tests.js
// Pruebas ligeras para funciones de lista del ExpressionParser: addItem, removeItem, removeAt
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

  function assertEq(actual, expected, message){
    const a = typeof actual === 'string' ? actual : JSON.stringify(actual);
    const e = typeof expected === 'string' ? expected : JSON.stringify(expected);
    const ok = a === e;
    const line = ok ? `✅ ${message}` : `❌ ${message} -> esperado ${e}, obtenido ${a}`;
    console[ok ? 'info' : 'error']('[ListFnTests]', line);
    appendToChat(`<div class="text-xs ${ok ? 'text-green-700' : 'text-red-700'}">${line}</div>`);
    return ok;
  }

  function runListFnTests(){
    const ctx = { variables: { items: ['a','b'] } };
    const EP = window.ExpressionParser;
    if (!EP || typeof EP.evaluate !== 'function'){
      console.warn('[ListFnTests] ExpressionParser no disponible');
      appendToChat('<div class="text-xs text-red-700">ExpressionParser no disponible</div>');
      return false;
    }
    appendToChat('<div class="text-sm font-semibold">▶ Pruebas funciones de lista (addItem/removeItem/removeAt)</div>');

    const r1 = EP.evaluate("addItem(items, 'c')", ctx);
    const t1 = assertEq(r1, ['a','b','c'], 'addItem al final');

    const r2 = EP.evaluate("addItem(items, 'X', 1)", ctx);
    const t2 = assertEq(r2, ['a','X','b'], 'addItem en índice 1');

    const r3 = EP.evaluate("removeItem(items, 'a')", ctx);
    const t3 = assertEq(r3, ['b'], 'removeItem primera coincidencia');

    const r4 = EP.evaluate("removeAt(items, 0)", ctx);
    const t4 = assertEq(r4, ['b'], 'removeAt índice 0');

    const all = t1 && t2 && t3 && t4;
    appendToChat(`<div class="text-xs ${all ? 'text-green-700' : 'text-red-700'}">Resultado: ${all ? 'OK' : 'FALLÓ'} (4 tests)</div>`);
    return all;
  }

  // Exponer y bindear botón si existe
  try { window.runListFnTests = runListFnTests; } catch(_e){}
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btnRunListFnTests');
    if (btn) btn.addEventListener('click', () => { try { runListFnTests(); } catch(e){ console.error(e); } });
  });
})();
