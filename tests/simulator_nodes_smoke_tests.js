// simulator_nodes_smoke_tests.js
// Smoke tests para nodos hidden_response y form usando el simulador real.
(function(){
  function append(msg, ok){
    try{
      const chat = document.getElementById('simulatorChat');
      const div = document.createElement('div');
      div.className = 'text-xs ' + (ok === true ? 'text-green-700' : ok === false ? 'text-red-700' : 'text-gray-700');
      div.textContent = msg;
      chat.appendChild(div); chat.scrollTop = chat.scrollHeight;
      console[ok===false? 'error':'log']('[NodeSmoke]', msg);
    }catch(_e){}
  }

  // Definir un flujo mínimo vía window.App.generateFlowJson para que el simulador lo consuma.
  function buildTestFlow(){
    return {
      flow_id: 'smoke_nodes',
      name: 'Smoke Nodes Flow',
      start_node: 'start',
      nodes: {
        start: { id:'start', type:'start', next:{ node_id:'hidden1' }, variables:[ { name:'user_name', defaultValue:'Carlos' } ] },
        hidden1: { id:'hidden1', type:'hidden_response', next:{ node_id:'form1' }, dataInfo: '{"greet":"Hola","user":"{{user_name}}"}' },
        form1: { id:'form1', type:'form', next:{ node_id:'end' }, fields:[ { name:'email' }, { name:'age' } ], prompt:'Completa el formulario' },
        end: { id:'end', type:'end' }
      }
    };
  }

  function ensureAppStub(){
    if(!window.App) window.App = {};
    window.App.generateFlowJson = buildTestFlow;
    // Necesario para loadFlowFromEditor: algunos paths usan state.nodes
    window.App.state = { nodes: buildTestFlow().nodes };
    window.App.refreshOutput = function(){};
  }

  async function runHiddenResponseTest(){
    append('▶ Iniciando test hidden_response');
    window.Simulador.loadFlowFromEditor();
    window.Simulador.start();
    const startTs = Date.now();
    let found = null;
    while(Date.now() - startTs < 3000){
      try{
        const rt = window.Simulador.getRuntimeState();
        const hist = (rt.state && rt.state.history) || [];
        found = hist.find(h => h.type === 'hidden_response');
        if(found) break;
      }catch(_e){}
      await new Promise(r=>setTimeout(r,50));
    }
    if(!found){ append('❌ hidden_response no se registró en history', false); return false; }
    // Validar dataInfo estructura completa
    const di = found.dataInfo;
    const expected = { greet:'Hola', user:'Carlos' };
    const match = di && di.greet === expected.greet && di.user === expected.user;
    append(match ? '✅ hidden_response OK estructura {greet, user}' : '❌ hidden_response estructura incorrecta: ' + JSON.stringify(di), match);
    return match;
  }

  async function runFormNodeTest(){
    append('▶ Iniciando test form');
    // Recargar flujo y reiniciar simulación para garantizar que estamos en el nodo form
    try{ window.Simulador.loadFlowFromEditor(); window.Simulador.start(); }catch(_e){}
    // Esperar a que el nodo form esté activo y renderizado (form dentro #simulatorCanvasPreview)
    const startTs = Date.now();
    let formEl = null;
    while(Date.now() - startTs < 3000){
      formEl = document.querySelector('#simulatorCanvasPreview form');
      if(formEl) break;
      await new Promise(r=>setTimeout(r,50));
    }
    if(!formEl){ append('❌ Formulario no se renderizó', false); return false; }
    // Rellenar campos
    try{
      const inputs = formEl.querySelectorAll('input, textarea, select');
      inputs.forEach(inp => {
        if(inp.name === 'email' || inp.previousElementSibling?.textContent.toLowerCase().includes('email')) inp.value = 'test@example.com';
        else if(inp.name === 'age' || inp.previousElementSibling?.textContent.toLowerCase().includes('age')) inp.value = '33';
        else inp.value = 'x';
      });
    }catch(_e){}
    // Enviar
    formEl.dispatchEvent(new Event('submit', { cancelable:true, bubbles:true }));
    // Esperar a que history registre y variables extra aparezcan
    const waitStart = Date.now();
    let done = false; let extraVal = null; let histEntry = null;
    while(Date.now() - waitStart < 3000){
      try{
        const rt = window.Simulador.getRuntimeState();
        extraVal = rt.state?.variables?.extra;
        histEntry = (rt.state?.history||[]).find(h=>h.type==='form');
        if(extraVal && histEntry) { done = true; break; }
      }catch(_e){}
      await new Promise(r=>setTimeout(r,50));
    }
    if(!done){ append('❌ Form submit no reflejado en variables/history', false); return false; }
    const emailOk = extraVal.email === 'test@example.com';
    const ageOk = extraVal.age === '33';
    append(emailOk ? '✅ email capturado' : '❌ email faltante', emailOk);
    append(ageOk ? '✅ age capturado' : '❌ age faltante', ageOk);
    return emailOk && ageOk;
  }

  async function runSmokeSuite(){
    ensureAppStub();
    append('=== Smoke Suite Nodos ===');
    const hr = await runHiddenResponseTest();
    const fm = await runFormNodeTest();
    const all = hr && fm;
    append(all ? '✔ Resultado final: TODO OK' : '✖ Resultado final: Fallos detectados', all);
    return all;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btnRunNodeSmokeTests');
    if(btn) btn.addEventListener('click', ()=>{ runSmokeSuite().catch(e=>append('Error suite: '+e.message,false)); });
  });
})();

// nested foreach metadata parity test (outerItem + innerItem)
(function(){
  function append(msg, ok){
    try{const chat=document.getElementById('simulatorChat');const div=document.createElement('div');div.className='text-xs '+(ok===true?'text-green-700':ok===false?'text-red-700':'text-gray-700');div.textContent=msg;chat.appendChild(div);chat.scrollTop=chat.scrollHeight;}catch(_e){}
  }
  function ensureAppStub(){ if(!window.App) window.App={}; window.App.refreshOutput=function(){}; }
  function buildNestedMetaFlow(){
    return {
      flow_id:'nested_meta_flow', start_node:'outerLoop', nodes:{
        outerLoop:{ id:'outerLoop', type:'foreach', source_list:'outerItems', item_var:'outerItem', index_var:'outerIndex', loop_body:{ node_id:'outerBodyStart' }, next:{ node_id:'end' } },
        outerBodyStart:{ id:'outerBodyStart', type:'response', text:'Outer idx={{outerIndex}}', next:{ node_id:'innerLoop' } },
        innerLoop:{ id:'innerLoop', type:'foreach', source_list:'outerItem.innerItems', item_var:'innerItem', index_var:'innerIndex', loop_body:{ node_id:'innerBodyStart' }, next:{ node_id:'outerAfterInner' } },
        innerBodyStart:{ id:'innerBodyStart', type:'response', text:'Inner idx={{innerIndex}}', next:{ node_id:'innerInput' } },
        innerInput:{ id:'innerInput', type:'input', prompt:'pause inner', next:{ node_id:'innerBodyEnd' } },
        innerBodyEnd:{ id:'innerBodyEnd', type:'response', text:'End inner iter', next:{ node_id:'innerLoop' } },
        outerAfterInner:{ id:'outerAfterInner', type:'response', text:'After inner for outer={{outerIndex}}', next:{ node_id:'outerLoop' } },
        end:{ id:'end', type:'end' }
      }
    };
  }
  async function runNestedForeachMetadataTest(){
    append('▶ Iniciando test foreach metadata (anidado)');
    ensureAppStub();
    const flow = buildNestedMetaFlow();
    window.App.generateFlowJson = () => flow;
    window.App.state = { nodes: flow.nodes };
    window.Simulador.loadFlowFromEditor();
    // Estructura de datos anidada: outerItems[i].innerItems[j]
    try{
      const rt = window.Simulador.getRuntimeState();
      rt.state.variables.outerItems = [
        { innerItems: ['a1','a2'] },
        { innerItems: ['b1'] }
      ];
    }catch(_e){}
    window.Simulador.start();
    // Esperar a pausa en innerInput de la primera iteración (outer=0, inner=0)
    const startTs = Date.now();
    while(Date.now() - startTs < 2000){
      try{
        const rt = window.Simulador.getRuntimeState();
        const hist = rt.state?.history || [];
        const pausedInner = hist.find(h=>h.node==='innerInput');
        if(pausedInner) break;
      }catch(_e){}
      await new Promise(r=>setTimeout(r,50));
    }
    const rt2 = window.Simulador.getRuntimeState();
    const vars = (rt2 && rt2.state && rt2.state.variables) || {};
    const outerPathOk = vars['__loop_path:outerItem'] === 'outerItems';
    const outerIndexOk = vars['__loop_index:outerItem'] === 0;
    const innerPathOk = vars['__loop_path:innerItem'] === 'outerItems[0].innerItems';
    const innerIndexOk = vars['__loop_index:innerItem'] === 0;
    append(outerPathOk? '✅ __loop_path:outerItem=outerItems' : '❌ __loop_path:outerItem incorrecto', outerPathOk);
    append(outerIndexOk? '✅ __loop_index:outerItem=0' : '❌ __loop_index:outerItem incorrecto', outerIndexOk);
    append(innerPathOk? '✅ __loop_path:innerItem=outerItems[0].innerItems' : '❌ __loop_path:innerItem incorrecto', innerPathOk);
    append(innerIndexOk? '✅ __loop_index:innerItem=0' : '❌ __loop_index:innerItem incorrecto', innerIndexOk);
    let all = outerPathOk && outerIndexOk && innerPathOk && innerIndexOk;

    // Avanzar dos veces el input interno para completar innerIndex=0 y innerIndex=1 del outerIndex=0
    try{
      for(let k=0;k<2;k++){
        const panel = document.getElementById('simulatorCanvasPreview');
        const inputEl = panel ? panel.querySelector('input[type="text"]') : null;
        const btnEl = panel ? Array.from(panel.querySelectorAll('button')).find(b=>b.textContent && b.textContent.toLowerCase().includes('enviar')) : null;
        if(inputEl) inputEl.value = 'ok';
        if(btnEl){ btnEl.click(); await new Promise(r=>setTimeout(r,300)); }
      }
    }catch(_e){}

    // Esperar a que pause nuevamente en innerInput pero ahora en outerIndex=1, innerIndex=0
    const waitOuter1 = Date.now();
    while(Date.now() - waitOuter1 < 2500){
      try{
        const rt = window.Simulador.getRuntimeState();
        const hist = rt.state?.history || [];
        const lastInner = hist.filter(h=>h.node==='innerInput').length;
        // debería haber al menos 3 pausas: (0,0), (0,1) y luego (1,0)
        if(lastInner >= 3) break;
      }catch(_e){}
      await new Promise(r=>setTimeout(r,60));
    }

    const rt3 = window.Simulador.getRuntimeState();
    const vars2 = (rt3 && rt3.state && rt3.state.variables) || {};
    const outerIndex2Ok = vars2['__loop_index:outerItem'] === 1;
    const innerIndex2Ok = vars2['__loop_index:innerItem'] === 0;
    const innerPath2Ok = vars2['__loop_path:innerItem'] === 'outerItems[1].innerItems';
    append(outerIndex2Ok? '✅ outerIndex avanzó a 1' : '❌ outerIndex no avanzó a 1', outerIndex2Ok);
    append(innerIndex2Ok? '✅ innerIndex reinicia a 0 en outer=1' : '❌ innerIndex no reinicia a 0', innerIndex2Ok);
    append(innerPath2Ok? '✅ __loop_path:innerItem=outerItems[1].innerItems' : '❌ __loop_path:innerItem no corresponde a outer=1', innerPath2Ok);

    all = all && outerIndex2Ok && innerIndex2Ok && innerPath2Ok;
    append(all? '✔ Resultado nested foreach metadata (anidado): OK' : '✖ Resultado nested foreach metadata (anidado): Fallos', all);
    return all;
  }
  document.addEventListener('DOMContentLoaded',()=>{
    const btn=document.getElementById('btnRunNestedForeachMetaTest');
    if(btn) btn.addEventListener('click',()=>{ runNestedForeachMetadataTest().catch(e=>append('Error nested foreach metadata: '+e.message,false)); });
  });
})();
// nested loops smoke tests
(function(){
  function append(msg, ok){
    try{const chat=document.getElementById('simulatorChat');const div=document.createElement('div');div.className='text-xs '+(ok===true?'text-green-700':ok===false?'text-red-700':'text-gray-700');div.textContent=msg;chat.appendChild(div);chat.scrollTop=chat.scrollHeight;}catch(_e){}
  }
  function ensureAppStub(){
    if(!window.App) window.App={};
    window.App.refreshOutput=function(){};
  }
  function buildNestedLoopFlow(){
    return {
      flow_id:'nested_loop_flow',
      start_node:'outer',
      nodes:{
        outer:{ id:'outer', type:'foreach', source_list:'outerList', item_var:'outerItem', loop_body:{ node_id:'innerStart' }, next:{ node_id:'end' } },
        innerStart:{ id:'innerStart', type:'foreach', source_list:'innerList', item_var:'innerItem', loop_body:{ node_id:'innerBody' }, next:{ node_id:'postInner' } },
        innerBody:{ id:'innerBody', type:'response', text:'Inner item={{innerItem}} outer={{outerItem}}', next:{ node_id:'innerInput' } },
        innerInput:{ id:'innerInput', type:'input', prompt:'(NO se debería pedir input dentro de foreach inline ahora)', next:{ node_id:'innerBody2' } },
        innerBody2:{ id:'innerBody2', type:'response', text:'After input inner={{innerItem}}', next:null },
        postInner:{ id:'postInner', type:'response', text:'Fin inner loop para outer={{outerItem}}', next:null },
        end:{ id:'end', type:'end' }
      }
    };
  }
  async function runNestedLoopTest(){
    append('▶ Iniciando test nested loops');
    ensureAppStub();
    const flow = buildNestedLoopFlow();
    // Variables simuladas
    const vars = { outerList:['A','B'], innerList:['1','2'] };
    window.App.generateFlowJson = () => flow;
    window.App.state = { nodes: flow.nodes };
    window.Simulador.loadFlowFromEditor();
    try{ const rtPre = window.Simulador.getRuntimeState(); rtPre.state.variables.outerList = vars.outerList; rtPre.state.variables.innerList = vars.innerList; }catch(_e){}
    // Iniciar simulación en modo chat llamando presentCurrentNodeInChat manualmente
    window.Simulador.start();
    // Esperar a que mensajes aparezcan
    await new Promise(r=>setTimeout(r,1500));
    const rt = window.Simulador.getRuntimeState();
    const history = rt.state.history || [];
    // Nuevo comportamiento: foreach incremental con soporte de pausa interactiva en cada iteración
    const innerBodies = history.filter(h=>h.node==='innerBody');
    const inputNodes = history.filter(h=>h.node==='innerInput');
    const expectedIterations = vars.outerList.length * vars.innerList.length;
    const passes = innerBodies.length === expectedIterations && inputNodes.length === expectedIterations;
    append(passes? '✅ nested loops ejecutó todas las iteraciones con pausa en input':'❌ nested loops no alcanzó iteraciones/pause esperadas', passes);
    if(!passes){ append(`ℹ Diagnóstico nested: innerBodies=${innerBodies.length} inputNodes=${inputNodes.length} expected=${expectedIterations}`, null); }
    append('Resultado nested loops: '+(passes?'OK':'FALLO'), passes);
    return passes;
  }
  document.addEventListener('DOMContentLoaded',()=>{
    const btn=document.getElementById('btnRunNestedLoopTests');
    if(btn) btn.addEventListener('click',()=>{ runNestedLoopTest().catch(e=>append('Error nested: '+e.message,false)); });
  });
})();

// loop & while smoke tests
(function(){
  function append(msg, ok){
    try{const chat=document.getElementById('simulatorChat');const div=document.createElement('div');div.className='text-xs '+(ok===true?'text-green-700':ok===false?'text-red-700':'text-gray-700');div.textContent=msg;chat.appendChild(div);chat.scrollTop=chat.scrollHeight;}catch(_e){}
  }
  function ensureAppStub(){ if(!window.App) window.App={}; window.App.refreshOutput=function(){}; }
  function buildLoopFlow(){
    return {
      flow_id:'loop_flow', start_node:'loopNode', nodes:{
        loopNode:{ id:'loopNode', type:'loop', count:3, loop_body:{ node_id:'loopBodyStart' }, next:{ node_id:'end' } },
        loopBodyStart:{ id:'loopBodyStart', type:'response', text:'Iter index={{index}}', next:{ node_id:'loopInput' } },
        loopInput:{ id:'loopInput', type:'input', prompt:'Valor en iter {{index}}', next:{ node_id:'loopBodyEnd' } },
        loopBodyEnd:{ id:'loopBodyEnd', type:'response', text:'Fin iter {{index}}', next:{ node_id:'loopNode' } },
        end:{ id:'end', type:'end' }
      }
    };
  }
  function buildWhileFlow(){
    return {
      flow_id:'while_flow', start_node:'whileNode', nodes:{
        whileNode:{ id:'whileNode', type:'while', expr:'counter < 3', loop_body:{ node_id:'whileBodyStart' }, next:{ node_id:'end' } },
        whileBodyStart:{ id:'whileBodyStart', type:'response', text:'While counter={{counter}}', next:{ node_id:'whileInput' } },
        whileInput:{ id:'whileInput', type:'input', prompt:'pause in while {{counter}}', next:{ node_id:'whileIncrement' } },
        whileIncrement:{ id:'whileIncrement', type:'assign_var', entries:[ { target:'counter', value:'{{counter}} + 1' } ], next:{ node_id:'whileNode' } },
        end:{ id:'end', type:'end' }
      }
    };
  }
  async function runLoopAndWhileTests(){
    append('▶ Iniciando tests loop/while');
    ensureAppStub();
    // LOOP
    window.App.generateFlowJson = buildLoopFlow;
    window.App.state = { nodes: buildLoopFlow().nodes };
    window.Simulador.loadFlowFromEditor();
    try{ const rt = window.Simulador.getRuntimeState(); rt.state.variables.index = 0; }catch(_e){}
    window.Simulador.start();
    await new Promise(r=>setTimeout(r,1200));
    const rtLoop = window.Simulador.getRuntimeState();
    const historyLoop = rtLoop.state.history||[];
    const bodyMsgs = historyLoop.filter(h=>h.node==='loopBodyStart');
    const inputPauses = historyLoop.filter(h=>h.node==='loopInput');
    const loopOk = bodyMsgs.length===3 && inputPauses.length===3;
    append(loopOk? '✅ loop ejecutó 3 iteraciones con pausa input':'❌ loop iteraciones/pause incorrectas', loopOk);
    // WHILE
    window.App.generateFlowJson = buildWhileFlow;
    window.App.state = { nodes: buildWhileFlow().nodes };
    window.Simulador.loadFlowFromEditor();
    try{ const rt2 = window.Simulador.getRuntimeState(); rt2.state.variables.counter = 0; }catch(_e){}
    window.Simulador.start();
    await new Promise(r=>setTimeout(r,1500));
    const rtWhile = window.Simulador.getRuntimeState();
    const historyWhile = rtWhile.state.history||[];
    const whileBodies = historyWhile.filter(h=>h.node==='whileBodyStart');
    const whileInputs = historyWhile.filter(h=>h.node==='whileInput');
    const increments = historyWhile.filter(h=>h.node==='whileIncrement');
    const whileOk = whileBodies.length===3 && whileInputs.length===3 && increments.length===3;
    append(whileOk? '✅ while ejecutó 3 iteraciones con pausa input':'❌ while iteraciones/pause incorrectas', whileOk);
    const all = loopOk && whileOk;
    append(all? '✔ Resultado loop/while: OK':'✖ Resultado loop/while: Fallos', all);
    return all;
  }
  document.addEventListener('DOMContentLoaded',()=>{
    const btn=document.getElementById('btnRunLoopWhileTests');
    if(btn) btn.addEventListener('click',()=>{ runLoopAndWhileTests().catch(e=>append('Error loop/while: '+e.message,false)); });
  });
})();

// foreach metadata parity tests (__loop_path:* and __loop_index:* )
(function(){
  function append(msg, ok){
    try{const chat=document.getElementById('simulatorChat');const div=document.createElement('div');div.className='text-xs '+(ok===true?'text-green-700':ok===false?'text-red-700':'text-gray-700');div.textContent=msg;chat.appendChild(div);chat.scrollTop=chat.scrollHeight;}catch(_e){}
  }
  function ensureAppStub(){ if(!window.App) window.App={}; window.App.refreshOutput=function(){}; }
  function buildForeachFlow(){
    return {
      flow_id:'foreach_meta_flow', start_node:'lo', nodes:{
        lo:{ id:'lo', type:'foreach', source_list:'items', item_var:'item', index_var:'index', loop_body:{ node_id:'bodyStart' }, next:{ node_id:'end' } },
        bodyStart:{ id:'bodyStart', type:'response', text:'Item={{item}} Index={{index}}', next:{ node_id:'pauseInput' } },
        pauseInput:{ id:'pauseInput', type:'input', prompt:'pause', next:{ node_id:'bodyEnd' } },
        bodyEnd:{ id:'bodyEnd', type:'response', text:'End iter', next:{ node_id:'lo' } },
        end:{ id:'end', type:'end' }
      }
    };
  }
  async function runForeachMetadataTest(){
    append('▶ Iniciando test foreach metadata');
    ensureAppStub();
    const flow = buildForeachFlow();
    window.App.generateFlowJson = () => flow;
    window.App.state = { nodes: flow.nodes };
    window.Simulador.loadFlowFromEditor();
    try{ const rt = window.Simulador.getRuntimeState(); rt.state.variables.items = ['A','B','C']; }catch(_e){}
    window.Simulador.start();
    // Esperar a que entre en primera iteración y pause en input
    await new Promise(r=>setTimeout(r,800));
    const rt = window.Simulador.getRuntimeState();
    const vars = (rt && rt.state && rt.state.variables) || {};
    const pathKey = '__loop_path:item';
    const indexKey = '__loop_index:item';
    const pathOk = typeof vars[pathKey] === 'string' && vars[pathKey].startsWith('items');
    const indexOk = vars[indexKey] === 0;
    append(pathOk? '✅ __loop_path:item presente' : '❌ __loop_path:item faltante', pathOk);
    append(indexOk? '✅ __loop_index:item=0' : '❌ __loop_index:item incorrecto', indexOk);
    const all = pathOk && indexOk;
    append(all? '✔ Resultado foreach metadata: OK':'✖ Resultado foreach metadata: Fallos', all);
    return all;
  }
  document.addEventListener('DOMContentLoaded',()=>{
    const btn=document.getElementById('btnRunForeachMetadataTest');
    if(btn) btn.addEventListener('click',()=>{ runForeachMetadataTest().catch(e=>append('Error foreach metadata: '+e.message,false)); });
  });
})();
