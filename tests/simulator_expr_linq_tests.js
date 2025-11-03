// simulator_expr_linq_tests.js
// Pruebas para funciones LINQ-like del ExpressionParser: where, select, orderBy, distinct, take/skip, agregaciones
(function(){
  function appendToChat(htmlOrText){
    try{
      const chat = document.getElementById('simulatorChat');
      const wrap = document.createElement('div');
      if (/<[a-z][\s\S]*>/i.test(String(htmlOrText))) { wrap.innerHTML = String(htmlOrText); } else { wrap.textContent = String(htmlOrText); }
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
    console[ok ? 'info' : 'error']('[ExprLinq]', line);
    appendToChat(`<div class="text-xs ${ok ? 'text-green-700' : 'text-red-700'}">${line}</div>`);
    return ok;
  }

  const baseVars = {
    nums: [1,2,3,4,5],
    users: [
      { id: 1, name: 'Ana', age: 20, active: true },
      { id: 2, name: 'Luis', age: 17, active: false },
      { id: 3, name: 'Berta', age: 30, active: true },
      { id: 3, name: 'Berta', age: 30, active: true } // duplicado intencional para distinct por id
    ]
  };

  const cases = [
    { expr: "where(nums, 'item % 2 == 0')", expected: [2,4], msg: 'where pares' },
    { expr: "select(users, 'item.name')", expected: ['Ana','Luis','Berta','Berta'], msg: 'select name' },
    { expr: "orderBy(select(users, 'item.age'), null, 'desc')", expected: [30,30,20,17], msg: 'orderBy desc edades' },
    { expr: "orderBy(users, 'item.name')|select('item.name')", expected: ['Ana','Berta','Berta','Luis'], msg: 'orderBy por nombre + select' },
    { expr: "distinct(select(users,'item.id'))", expected: [1,2,3], msg: 'distinct ids' },
    { expr: "distinct(users, 'item.id')|select('item.id')", expected: [1,2,3], msg: 'distinct por id en objetos' },
    { expr: "take(nums, 3)", expected: [1,2,3], msg: 'take 3' },
    { expr: "skip(nums, 2)", expected: [3,4,5], msg: 'skip 2' },
    { expr: "sum(nums)", expected: 15, msg: 'sum simple' },
    { expr: "avg(nums)", expected: 3, msg: 'avg simple' },
    { expr: "min(nums)", expected: 1, msg: 'min simple' },
    { expr: "max(nums)", expected: 5, msg: 'max simple' },
    { expr: "count(users, 'item.age >= 18')", expected: 3, msg: 'count mayores de edad' },
    { expr: "first(select(where(users, 'item.active'), 'item.name'))", expected: 'Ana', msg: 'first nombre de activo' }
  ];

  function runExprLinqTests(){
    const EP = window.ExpressionParser;
    if (!EP || typeof EP.evaluate !== 'function'){
      appendToChat('<div class="text-xs text-red-700">ExpressionParser no disponible</div>');
      return false;
    }
    appendToChat('<div class="text-sm font-semibold">▶ Pruebas LINQ-like de expresiones (simulador)</div>');
    let okAll = true;
    for (const tc of cases){
      // Soportar una pequeña sintaxis de tubería local "|" solo para tests, expandiéndola a llamadas anidadas:
      let expr = tc.expr;
      if (expr.includes('|')){
        // Ej: orderBy(users,'item.name')|select('item.name') -> select(orderBy(users,'item.name'), 'item.name')
        const parts = expr.split('|');
        let acc = parts[0].trim();
        for (let i=1;i<parts.length;i++){
          const call = parts[i].trim();
          // extraer nombre y args del call
          const m = call.match(/^([a-zA-Z_][\w]*)\((.*)\)$/);
          if (m){
            const name = m[1]; const args = m[2];
            acc = `${name}(${acc}${args ? ', ' + args : ''})`;
          } else {
            acc = `${call}(${acc})`;
          }
        }
        expr = acc;
      }
      const got = EP.evaluate(expr, { variables: JSON.parse(JSON.stringify(baseVars)) });
      okAll = assertEq(got, tc.expected, tc.msg || tc.expr) && okAll;
    }
    appendToChat(`<div class="text-xs ${okAll ? 'text-green-700' : 'text-red-700'}">Resultado: ${okAll ? 'OK' : 'FALLÓ'} (${cases.length} tests)</div>`);
    return okAll;
  }

  try { window.runExprLinqTests = runExprLinqTests; } catch(_e){}
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btnRunExprLinqTests');
    if (btn) btn.addEventListener('click', () => { try { runExprLinqTests(); } catch(e){ console.error(e); } });
  });
})();
