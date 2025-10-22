// flow_runner.js
// Lógica principal del runner que utiliza FlowUI y ExpressionParser
(function(){
  console.log('[FlowRunner] Inicializando flow runner...');
  // Contador de profundidad de bucles para generar nombres de variables sencillos y predecibles
  let loopDepth = 0;
  // Estado interno mínimo para multi‑flujo: mapa de flujos y flujo actual
  let flowsById = {};
  let currentFlowId = null;

  function setActiveFlow(flowId){
    if (!flowId || !flowsById[flowId]) { console.warn('[FlowRunner] setActiveFlow: flujo no encontrado', flowId); return; }
    currentFlowId = flowId;
    try {
      // Importante: muchos componentes leen desde window.App.state; para compatibilidad, actualizamos esta referencia
      window.App = window.App || {};
      window.App.state = flowsById[flowId];
      if (!window.App.runtimeContext) window.App.runtimeContext = { variables: {} };
      window.App.runtimeContext.currentFlowId = flowId;
    } catch (e) { console.warn('[FlowRunner] setActiveFlow error', e); }
  }

  const renderTemplate = (input) => {
    // replace {{ expr }} with evaluation result using ExpressionParser
    if (typeof input === 'string') {
      return input.replace(/\{\{([^}]+)\}\}/g, (_, expr) => {
        try {
          const e = expr.trim();
          if (window.ExpressionParser && typeof window.ExpressionParser.evaluate === 'function') {
            const res = window.ExpressionParser.evaluate(e, window.App.runtimeContext);
            return (typeof res === 'object') ? JSON.stringify(res) : String(res);
          }
          return '';
        } catch (err) {
          return '';
        }
      });
    } else if (Array.isArray(input)) {
      return input.map(renderTemplate);
    } else if (input && typeof input === 'object') {
      const copy = JSON.parse(JSON.stringify(input));
      const walk = (obj) => {
        if (typeof obj === 'string') return renderTemplate(obj);
        if (Array.isArray(obj)) return obj.map(walk);
        if (obj && typeof obj === 'object') {
          Object.keys(obj).forEach(k => { obj[k] = walk(obj[k]); });
          return obj;
        }
        return obj;
      };
      return walk(copy);
    }
    return input;
  };

  async function presentNode(node) {
    const locale = window.App?.state?.meta?.locales?.[0] || 'es';
    switch (node.type) {
      case 'loop':
      case 'foreach':
      case 'while':
        return await handleLoop(node);
      case 'input': return await handleInput(node, locale);
      case 'response': return await handleResponse(node, locale);
      case 'choice': return await handleChoice(node, locale);
      case 'button': return await handleButton(node, locale);
  case 'assign_var': return await handleAssignVar(node);
      case 'condition': return await handleCondition(node);
      case 'set_goto': return await handleSetGoto(node);
      case 'rest_call': return await handleRestCall(node);
      case 'end': return await handleEnd(node, locale);
      default: return resolveNext(node.next);
    }
  }

  // Resolver siguiente salto, aceptando string (node_id) u objeto { node_id, flow_id }
  function resolveNext(next) {
    if (!next) return null;
    if (typeof next === 'string') return next;
    if (typeof next === 'object') {
      const targetFlow = next.flow_id || currentFlowId;
      if (targetFlow && targetFlow !== currentFlowId) {
        // conmutar a otro flujo si está disponible
        setActiveFlow(targetFlow);
      }
      return next.node_id || (window.App?.state?.meta?.start_node || null);
    }
    return null;
  }

  // Helper to get a next node id accepting different shapes: string or { node_id }
  function getNextIdFrom(next) {
    if (!next) return null;
    if (typeof next === 'string') return next;
    if (typeof next === 'object') return next.node_id || null;
    return null;
  }

  async function handleInput(node, locale) {
    const ctx = window.App.runtimeContext;
    const contextHtml = `<div style="margin-top:12px;font-size:12px;color:#333">Context: <pre class='contextPreview' style='background:#f6f6f6;padding:8px;border-radius:4px;height:120px;overflow:auto'>${JSON.stringify(ctx, null, 2)}</pre></div>`;
    const prompt = node.i18n?.[locale]?.prompt || node.i18n?.es?.prompt || 'Introduce un valor';
    const save_as = node.save_as?.trim() || 'input';
    const html = `
      <div>
        <div style="font-weight:700;margin-bottom:8px">Nodo input: ${node.id}</div>
        <div style="margin-bottom:10px">${prompt}</div>
        <input id="runnerInput" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;margin-bottom:10px" />
        <div style="text-align:right"><button id="runnerCancel" style="margin-right:8px">Cancelar</button><button id="runnerOk">Enviar</button></div>
        ${contextHtml}
        <div style="margin-top:8px;font-size:12px;color:#666">La respuesta se guardará en <code>context.${save_as}</code></div>
      </div>`;
    const { card } = window.FlowUI.showNodeUI(html);
    const res = await window.FlowUI.waitForInputSubmit(card, '#runnerInput', '#runnerOk', '#runnerCancel');
    if (res.cancelled) { window.FlowUI.hideModal(); return null; }
    ctx.variables[save_as] = res.value;
    window.FlowUI.updateContextView(card);
    await new Promise(r => setTimeout(r, 250));
    window.FlowUI.hideModal();
    return resolveNext(node.next);
  }

  async function handleResponse(node, locale) {
    const ctx = window.App.runtimeContext;
    const contextHtml = `<div style="margin-top:12px;font-size:12px;color:#333">Context: <pre class='contextPreview' style='background:#f6f6f6;padding:8px;border-radius:4px;height:120px;overflow:auto'>${JSON.stringify(ctx, null, 2)}</pre></div>`;
    const textArr = node.i18n?.[locale]?.text || node.i18n?.es?.text || [];
    const text = Array.isArray(textArr) && textArr.length > 0 ? (textArr.length > 1 ? textArr[Math.floor(Math.random() * textArr.length)] : textArr[0]) : String(textArr);
    const html = `<div><div style="font-weight:700;margin-bottom:8px">Nodo response: ${node.id}</div><div style="white-space:pre-wrap;margin-bottom:12px">${text}</div><div style="text-align:right"><button id="runnerNext">Siguiente</button></div>${contextHtml}</div>`;
    const { card } = window.FlowUI.showNodeUI(html);
    await window.FlowUI.waitForClick(card, '#runnerNext');
    window.FlowUI.hideModal();
    return resolveNext(node.next);
  }

  async function handleChoice(node, locale) {
    const ctx = window.App.runtimeContext;
    const mode = node.mode || 'prompt';
    if (mode === 'switch') {
      // Evaluar casos en orden; si ninguno coincide usar default_target; si no, next
      const list = Array.isArray(node.cases) ? node.cases : [];
      for (const c of list) {
        const raw = (c && c.when) ? String(c.when) : '';
        let truthy = false;
        try {
          const rendered = typeof raw === 'string' ? (renderTemplate(raw) || raw) : raw;
          if (window.ExpressionParser && typeof window.ExpressionParser.evaluate === 'function') {
            truthy = !!window.ExpressionParser.evaluate(rendered, ctx);
          } else {
            truthy = !!rendered;
          }
        } catch(_e) { truthy = false; }
        if (truthy) {
          return resolveNext(c?.target);
        }
      }
      if (node.default_target) return resolveNext(node.default_target);
      return resolveNext(node.next);
    }
    // prompt (UI interactiva)
    const contextHtml = `<div style="margin-top:12px;font-size:12px;color:#333">Context: <pre class='contextPreview' style='background:#f6f6f6;padding:8px;border-radius:4px;height:120px;overflow:auto'>${JSON.stringify(ctx, null, 2)}</pre></div>`;
    const prompt = node.i18n?.[locale]?.prompt || node.i18n?.es?.prompt || '';
    const opts = node.options || [];
    let buttonsHtml = '';
    opts.forEach((o, i) => { buttonsHtml += `<button class="choiceOpt" data-idx="${i}" style="margin:6px">${o.label || o.text || ('Opción ' + (i+1))}</button>`; });
    const html = `<div><div style="font-weight:700;margin-bottom:8px">Nodo choice: ${node.id}</div><div style="margin-bottom:8px">${prompt}</div><div>${buttonsHtml}</div>${contextHtml}<div style="text-align:right;margin-top:8px"><button id="runnerCancel">Cancelar</button></div></div>`;
    const { card } = window.FlowUI.showNodeUI(html);
    const res = await new Promise((resolve) => {
      card.querySelectorAll('.choiceOpt').forEach(btn => btn.addEventListener('click', (ev) => {
        const idx = Number(ev.currentTarget.getAttribute('data-idx'));
        resolve({ cancelled: false, index: idx });
      }));
      const cancelBtn = card.querySelector('#runnerCancel');
      if (cancelBtn) cancelBtn.addEventListener('click', () => resolve({ cancelled: true }));
    });
    window.FlowUI.hideModal();
    if (res.cancelled) return null;
    const chosen = opts[res.index];
    if (!chosen) return null;
    const target = chosen.target || chosen.next || null;
    return resolveNext(target);
  }

  async function handleAssignVar(node) {
    const ctx = window.App.runtimeContext;
    function normalizeExpr(e) {
      if (typeof e !== 'string') return e;
      let s = e.trim();
      // strip leading '=' (Excel-style)
      if (s.startsWith('=')) s = s.slice(1).trim();
      // unwrap {{ ... }} style templates
      const m = s.match(/^\{\{([\s\S]*)\}\}$/);
      if (m) s = m[1].trim();
      return s;
    }
    // support assignments: array of { name, valueExpr } or single assignment fields
    const assignments = node.assignments || node.assigns || (node.assignment ? [node.assignment] : null) || null;
    if (Array.isArray(assignments)) {
      for (const a of assignments) {
        const n = a.name || a.variable || a.save_as || a.saveAs || a.target || '';
        const rawExpr = a.valueExpr || a.value || a.expression || '';
        const expr = normalizeExpr(rawExpr);
        try {
          let val = expr;
          if (typeof expr === 'string' && window.ExpressionParser && typeof window.ExpressionParser.evaluate === 'function') {
            try { val = window.ExpressionParser.evaluate(expr, window.App.runtimeContext); } catch(e) { val = expr; }
          }
          if (n) ctx.variables[n] = val;
        } catch (e) { console.warn('[FlowRunner] handleAssignVar item error', e); }
      }
    } else {
      // fallback single fields
      const n = node.name || node.variable || node.save_as || '';
      const expr = normalizeExpr(node.valueExpr || node.value || '');
      try {
        let val = expr;
        if (typeof expr === 'string' && window.ExpressionParser && typeof window.ExpressionParser.evaluate === 'function') {
          try { val = window.ExpressionParser.evaluate(expr, window.App.runtimeContext); } catch(e) { val = expr; }
        }
        if (n) ctx.variables[n] = val;
      } catch (e) { console.warn('[FlowRunner] handleAssignVar error', e); }
    }
    return resolveNext(node.next);
  }

  async function handleCondition(node) {
    const expr = node.expr || '';
    let condVal = false;
    try {
      // Primero renderizar templates en expr
      const renderedExpr = renderTemplate(expr);
      // Luego evaluar la expresión
      if (window.ExpressionParser && typeof window.ExpressionParser.evaluate === 'function') {
        condVal = !!window.ExpressionParser.evaluate(renderedExpr, window.App.runtimeContext);
      } else {
        condVal = !!renderedExpr;
      }
    } catch (e) {
      condVal = false;
    }
    console.log(`Condición: ${expr} => ${renderTemplate(expr)} => ${condVal}`);
    if (condVal) {
      return resolveNext(node.true_target);
    } else {
      return resolveNext(node.false_target);
    }
  }

  async function handleSetGoto(node) {
    // Configurar la variable goto
    window.App.runtimeContext.variables['goto'] = node.target || '';
    return resolveNext(node.next);
  }

  // Loop handler: it iterates a source list variable, sets item/index vars and executes simple actions
  async function handleLoop(node) {
    const ctx = window.App.runtimeContext;
    // support multiple naming conventions from JSON/C# model
    const sourceListName = node.source_list || node.Source_List || node.sourceList || node.SourceList || '';
  // Determine item/index variable names. If node explicitly defines them, use those.
  // Otherwise choose based on current loopDepth: outermost -> 'item'/'index', nested -> 'item1'/'index1', etc.
  const explicitItem = node.item_var || node.Item_Var || node.itemVar || node.ItemVar;
  const explicitIndex = node.index_var || node.Index_Var || node.indexVar || node.IndexVar;
  const depth = loopDepth || 0;
  const suffix = depth === 0 ? '' : String(depth);
  const itemVar = explicitItem || ('item' + suffix);
  const indexVar = explicitIndex || ('index' + suffix);
    // Resolve sourceList: try variable name first, otherwise evaluate as expression (e.g. 'item.children' or 'context.x')
    let list = [];
    try {
      if (sourceListName && Array.isArray(ctx?.variables?.[sourceListName])) {
        list = ctx.variables[sourceListName];
      } else if (sourceListName && typeof sourceListName === 'string' && sourceListName.trim()) {
        // try evaluate with ExpressionParser (preferred)
        if (window.ExpressionParser && typeof window.ExpressionParser.evaluate === 'function') {
          const evalRes = window.ExpressionParser.evaluate(sourceListName, window.App.runtimeContext);
          if (Array.isArray(evalRes)) list = evalRes;
        }
        // fallback: try resolve dotted path against context variables
        if (!list.length && window.ExpressionParser && typeof window.ExpressionParser.resolvePath === 'function') {
          const path = sourceListName.replace(/^context\./, '');
          const parts = path.split('.').filter(Boolean);
          const resolved = window.ExpressionParser.resolvePath(window.App.runtimeContext.variables, parts);
          if (Array.isArray(resolved)) list = resolved;
        }
      }
    } catch (err) {
      console.warn('[FlowRunner] loop: error resolving sourceList', sourceListName, err);
    }
    if (!Array.isArray(list)) {
      // If it's not an array, it may be a 'while' node that doesn't need a list
      if (node.type === 'while' || (node.mode && node.mode === 'while')) {
        // allowed: while doesn't require list
      } else {
        console.warn('[FlowRunner] loop: source list not found or not array:', sourceListName);
        return resolveNext(node.next);
      }
    }

  // prepare chain of nodes for loop body using loop_body connection
    let bodyChainNodes = [];
    const loopBodyId = node.loop_body?.node_id || node.loopBody?.node_id || node.body_start?.node_id;
    if (loopBodyId) {
      // traverse chain starting from loop_body following .next links
      let current = loopBodyId;
      const visited = new Set();
      while (current && !visited.has(current)) {
        visited.add(current);
        const childNode = window.App.state.nodes?.[current];
        if (!childNode) break;
        bodyChainNodes.push(childNode);
        // accept different shapes for next (string id or object with node_id)
        const nextId = getNextIdFrom(childNode.next);
        current = nextId;
      }
    }

    // Save previous values (if any) to restore after loop
    const prevItem = ctx.variables.hasOwnProperty(itemVar) ? ctx.variables[itemVar] : undefined;
    const prevIndex = indexVar && ctx.variables.hasOwnProperty(indexVar) ? ctx.variables[indexVar] : undefined;

    // Determine mode: explicit node.type 'while' or node.mode === 'while' -> while semantics
    const mode = (node.type === 'while' || (node.mode && node.mode === 'while')) ? 'while' : 'foreach';

    // Increase loop depth so nested loops get distinct variable names
    loopDepth = loopDepth + 1;
    try {
      if (mode === 'foreach') {
        for (let i = 0; i < list.length; i++) {
          ctx.variables[itemVar] = list[i];
          if (indexVar) ctx.variables[indexVar] = i;

          if (Array.isArray(node.actions)) {
            for (const a of node.actions) {
              const atype = (a.type || a.Type || '').toString();
              if (atype === 'append_list') {
                const target = a.target || a.Target || '';
                if (!target) continue;
                let val = a.value || a.Value;
                val = renderTemplate(val);
                if (!Array.isArray(ctx.variables[target])) ctx.variables[target] = [];
                ctx.variables[target].push(val);
              } else {
                // future actions could be supported here
                console.warn('[FlowRunner] loop: unsupported action type', a.type || a.Type);
              }
            }
          }
          // execute body chain nodes in sequence starting from loopBodyId each iteration
          try {
            let currentBodyId = loopBodyId;
            const visitedBody = new Set();
            while (currentBodyId && !visitedBody.has(currentBodyId)) {
              visitedBody.add(currentBodyId);
              const childNode = window.App.state.nodes?.[currentBodyId];
              if (!childNode) break;
              try {
                await presentNode(childNode);
              } catch (err) {
                console.warn('[FlowRunner] loop: error executing child node', childNode.id, err);
                break;
              }
              // compute next id dynamically, accept string or object
              currentBodyId = getNextIdFrom(childNode.next);
            }
          } catch (err) { console.warn('[FlowRunner] loop: error walking body chain', err); }

          // evaluate break_if_expr after body if present
          if (node.break_if_expr) {
            try {
              const br = (window.ExpressionParser && typeof window.ExpressionParser.evaluate === 'function') ? window.ExpressionParser.evaluate(node.break_if_expr, window.App.runtimeContext) : false;
              if (br) break;
            } catch (e) { /* ignore */ }
          }
          // small pause per iteration for UI responsiveness
          await new Promise(r => setTimeout(r, 8));
        }
      } else if (mode === 'while') {
        const condExpr = node.cond || node.condExpr || '';
        const maxIter = Number(node.max_iterations || node.maxIterations || node.max_iter || 1000) || 1000;
        let iter = 0;
        while (true) {
          // evaluate condition in current context
          let condVal = false;
          try {
            if (window.ExpressionParser && typeof window.ExpressionParser.evaluate === 'function') {
              condVal = !!window.ExpressionParser.evaluate(condExpr, window.App.runtimeContext);
            } else {
              condVal = !!condExpr;
            }
          } catch (e) { condVal = false; }
          if (!condVal) break;

          // set iteration variables (item may be undefined unless explicitly set by actions)
          if (indexVar) ctx.variables[indexVar] = iter;
          if (itemVar && !(itemVar in ctx.variables)) ctx.variables[itemVar] = null;

          if (Array.isArray(node.actions)) {
            for (const a of node.actions) {
              const atype = (a.type || a.Type || '').toString();
              if (atype === 'append_list') {
                const target = a.target || a.Target || '';
                if (!target) continue;
                let val = a.value || a.Value;
                val = renderTemplate(val);
                if (!Array.isArray(ctx.variables[target])) ctx.variables[target] = [];
                ctx.variables[target].push(val);
              } else {
                console.warn('[FlowRunner] loop: unsupported action type', a.type || a.Type);
              }
            }
          }

          for (const childNode of bodyChainNodes) {
            try {
              await presentNode(childNode);
            } catch (err) {
              console.warn('[FlowRunner] loop: error executing child node', childNode.id, err);
            }
          }

          // after body, check break_if_expr
          if (node.break_if_expr) {
            try {
              const br = (window.ExpressionParser && typeof window.ExpressionParser.evaluate === 'function') ? window.ExpressionParser.evaluate(node.break_if_expr, window.App.runtimeContext) : false;
              if (br) break;
            } catch (e) { /* ignore */ }
          }

          iter++;
          if (maxIter && iter >= maxIter) {
            console.warn('[FlowRunner] loop: reached max_iterations', maxIter);
            break;
          }
          await new Promise(r => setTimeout(r, 8));
        }
      }
      return resolveNext(node.next);
    } finally {
      // restore previous values (or delete if were undefined)
      try {
        if (prevItem === undefined) delete ctx.variables[itemVar]; else ctx.variables[itemVar] = prevItem;
        if (indexVar) {
          if (prevIndex === undefined) delete ctx.variables[indexVar]; else ctx.variables[indexVar] = prevIndex;
        }
      } catch (e) { /* ignore */ }
      // decrement loop depth
      loopDepth = Math.max(0, loopDepth - 1);
    }
    // keep last item in context (or optionally remove)
    return resolveNext(node.next);
  }

  async function handleRestCall(node) {
    // Compose request from node properties (support both flat and properties.*)
    const method = (node.method || node.properties?.method || 'GET').toUpperCase();
    let url = node.url || node.properties?.url || '';
    let headers = node.headers || node.properties?.headers || {};
    const body = node.body !== undefined ? node.body : node.properties?.body;
    const mockMode = node.mock_mode || node.properties?.mock_mode || 'off';
    const mockData = node.mock !== undefined ? node.mock : node.properties?.mock;
    const save_as = node.save_as || null;

    // Helper to apply mappings on a standard response object { status, headers, data }
    const applyMappings = (responseObj) => {
      if (!Array.isArray(node.mappings)) return;
      node.mappings.forEach((m) => {
        if (!m || typeof m !== 'object') return;
        const mtype = ((m.type || m.Type) || '').toString().toLowerCase();
        const target = (m.target || m.Target || m.name || m.Name || '').toString();
        const source = (m.source || m.Source || m.from || m.From || '').toString();
        if (!target) return;
        let value = null;
        try {
          if (mtype === 'responsestatus' || mtype === 'status') {
            value = responseObj.status;
          } else if (mtype === 'responsebody' || mtype === 'body') {
            if (!source || source === '$') {
              value = responseObj.data ?? responseObj;
            } else {
              // support prefixes like $.data or response.data or data.items[0]
              let path = source.replace(/^\$\./, '').replace(/^response\./, '');
              path = path.replace(/\[(\d+)\]/g, '.$1');
              const parts = path.split('.').filter(Boolean);
              const root = (source.startsWith('response.') || source.startsWith('$.')) ? responseObj : responseObj.data ?? responseObj;
              value = (window.ExpressionParser && typeof window.ExpressionParser.resolvePath === 'function') ? window.ExpressionParser.resolvePath(root, parts) : null;
            }
          } else if (mtype === 'responseheader' || mtype === 'header') {
            value = (responseObj.headers && source) ? responseObj.headers[source] : null;
          } else {
            // fallback: try evaluate as expression in context
            if (source) {
              value = (window.ExpressionParser && typeof window.ExpressionParser.evaluate === 'function') ? window.ExpressionParser.evaluate(source, window.App.runtimeContext) : source;
            } else {
              value = `[[sim_${target}]]`;
            }
          }
        } catch (err) {
          console.warn('[FlowRunner] rest_call mapping eval error', err);
          value = null;
        }
        window.App.runtimeContext.variables[target] = value;
      });
    };

    // Render templates in url/headers/body
    try { url = renderTemplate(url); } catch(e){}
    try {
      const renderedHeaders = {};
      Object.keys(headers || {}).forEach(k => { renderedHeaders[k] = renderTemplate(headers[k]); });
      headers = renderedHeaders;
    } catch(e){}
    let renderedBody = body;
    try { if (body && typeof body === 'object') renderedBody = JSON.parse(JSON.stringify(renderTemplate(body))); } catch(e){}

    // Try to perform the fetch; in browser simulator, CORS may block it. We'll catch and fallback.
    let finalResponse = null;
    if (mockMode === 'always') {
      finalResponse = {
        status: 200,
        headers: {},
        data: (mockData !== undefined) ? mockData : {
          id: `id_${Math.floor(Math.random()*900+100)}`,
          timestamp: Date.now(),
          value: `val_${Math.floor(Math.random()*900+100)}`,
          items: [{ name: 'one' }, { name: 'two' }]
        }
      };
    } else {
      try {
        const init = { method, headers };
        if (['POST','PUT','PATCH','DELETE'].includes(method)) {
          init.body = (headers['Content-Type'] === 'application/json' || headers['content-type'] === 'application/json') ? JSON.stringify(renderedBody ?? {}) : (renderedBody ?? '');
        }
        const res = await fetch(url, init);
        const contentType = res.headers.get('content-type') || '';
        const data = contentType.includes('application/json') ? await res.json() : await res.text();
        finalResponse = { status: res.status, headers: Object.fromEntries(res.headers.entries()), data };
      } catch (err) {
        // Network/CORS error
        if (mockMode === 'fallback' && mockData !== undefined) {
          finalResponse = { status: 200, headers: {}, data: mockData };
        } else {
          // last resort fake response to keep simulator flowing
          finalResponse = {
            status: 200,
            headers: {},
            data: {
              id: `id_${Math.floor(Math.random()*900+100)}`,
              timestamp: Date.now(),
              value: `val_${Math.floor(Math.random()*900+100)}`,
              items: [{ name: 'one' }, { name: 'two' }]
            }
          };
        }
      }
    }

    if (save_as) window.App.runtimeContext.variables[save_as] = finalResponse;
    applyMappings(finalResponse);
    await new Promise(r => setTimeout(r, 150));
    return resolveNext(node.next);
  }

  async function handleEnd(node, locale) {
    const ctx = window.App.runtimeContext;
    const contextHtml = `<div style="margin-top:12px;font-size:12px;color:#333">Context: <pre class='contextPreview' style='background:#f6f6f6;padding:8px;border-radius:4px;height:120px;overflow:auto'>${JSON.stringify(ctx, null, 2)}</pre></div>`;
    const html = `<div><div style="font-weight:700;margin-bottom:8px">End: ${node.id}</div><div>Fin del flujo.</div>${contextHtml}<div style="text-align:right;margin-top:8px"><button id="runnerClose">Cerrar</button></div></div>`;
    const { card } = window.FlowUI.showNodeUI(html);
    await window.FlowUI.waitForClick(card, '#runnerClose');
    window.FlowUI.hideModal();
    return null;
  }

  async function runFlow() {
    console.log('[FlowRunner] runFlow called');
    window.App = window.App || {};
    window.App.runtimeContext = window.App.runtimeContext || { variables: {} };
    // Initialize variables from start node definitions if present (parse JSON strings and coerce simple types)
    try{
      const startNodeId = window.App?.state?.meta?.start_node || null;
      if (startNodeId && window.App.state && window.App.state.nodes && window.App.state.nodes[startNodeId] && Array.isArray(window.App.state.nodes[startNodeId].variables)){
        const defs = window.App.state.nodes[startNodeId].variables;
        defs.forEach(v => {
          let def = v.defaultValue;
          if (typeof def === 'string'){
            const s = def.trim();
            if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))){
              try{ def = JSON.parse(s); }catch(e){ /* keep as string on parse error */ }
            }
            // coerce simple typed strings
            const t = def && def.toString ? def.toString().trim() : '';
            if (/^-?\d+(?:\.\d+)?$/.test(t)) { try{ def = Number(t); }catch(_e){} }
            else if (/^true$/i.test(t)) def = true; else if (/^false$/i.test(t)) def = false;
          }
          try{ window.App.runtimeContext.variables[v.name] = JSON.parse(JSON.stringify(def)); }catch(e){ window.App.runtimeContext.variables[v.name] = def; }
        });
      }
    }catch(e){ console.warn('[FlowRunner] init vars from start failed', e); }
    const startId = window.App?.state?.meta?.start_node || null;
    if (!startId) {
      const modal = window.FlowUI.createModalContainer();
      modal.innerHTML = '<div style="background:#fff;padding:16px;border-radius:8px;min-width:320px">No hay nodo Start definido.<div style="text-align:right;margin-top:12px"><button id="closeNoStart">Cerrar</button></div></div>';
      modal.querySelector('#closeNoStart').addEventListener('click', window.FlowUI.hideModal);
      return;
    }
    let currentId = startId;
    while (currentId) {
      const node = window.App.state.nodes[currentId];
      if (!node) break;
      if (node.type === 'start') { currentId = resolveNext(node.next); if (!currentId) break; continue; }
      const nextId = await presentNode(node);
      if (!nextId) break;
      currentId = nextId;
    }
    const modal = window.FlowUI.createModalContainer();
    const content = `<div style="background:#fff;padding:16px;border-radius:8px;min-width:360px"><div style="font-weight:700;margin-bottom:8px">Ejecución finalizada</div><pre style="background:#f6f6f6;padding:8px;border-radius:4px">${JSON.stringify(window.App.runtimeContext, null, 2)}</pre><div style="text-align:right;margin-top:8px"><button id="runnerDone">Cerrar</button></div></div>`;
    modal.innerHTML = content;
    modal.querySelector('#runnerDone').addEventListener('click', window.FlowUI.hideModal);
  }

  window.FlowRunner = { runFlow };

  // auto-register button after DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btnRuntimeDemo');
    if (btn) btn.addEventListener('click', async () => {
      // Preparar mapa de flujos antes de ejecutar, usando el estado actual como flujo por defecto
      flowsById = {};
      try {
        const st = window.App?.state;
        const fid = st?.meta?.flow_id || 'flow_1';
        if (st && st.nodes) flowsById[fid] = st;
        // Si en el futuro AppProject expone varios flujos en memoria en formato { meta, nodes }, podemos agregarlos aquí
        if (window.AppProject?.flows && typeof window.AppProject.flows === 'object') {
          Object.keys(window.AppProject.flows).forEach(k => {
            const f = window.AppProject.flows[k];
            if (f && f.nodes && f.meta) flowsById[f.meta.flow_id || k] = f;
          });
        }
        setActiveFlow(fid);
      } catch (e) { console.warn('[FlowRunner] init flowsById failed', e); }
      await runFlow();
    });
  });

})();
