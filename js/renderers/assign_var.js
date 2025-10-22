// assign_var.js — soporte para múltiples asignaciones ({ target, value })
(function(){
  const { adoptTemplate, setupValidation, markFieldUsed } = globalThis.RendererHelpers || {};
  const H = globalThis.FormBuilderHelpers || {};
  const el = H.el || function(tag, attrs={}, children=[]) {
    const e = document.createElement(tag);
    if (attrs){
      const entries = Object.entries(attrs);
      for (const pair of entries){
        const k = pair[0]; const v = pair[1];
        if (k === 'text') e.textContent = v; else e.setAttribute(k, v);
      }
    }
    const kids = children || [];
    for (const c of kids){ e.appendChild(c); }
    return e;
  };

  // Helpers globales (dentro del IIFE) para multi‑flujo y tipos
  function collectAllFlowVars(){
    const list = [];
    try{
      const curFlowId = globalThis.AppProject?.active_flow_id || globalThis.App?.state?.flow_id || '';
      const flows = globalThis.AppProject?.flows || {};
      // helper para extraer pares {name, defaultValue, flowId}
      const pushFrom = (flowId, startNode) => {
        const vars = (startNode?.variables || []).filter(v => v?.name);
        for (const v of vars){ list.push({ name: String(v.name), defaultValue: v.defaultValue, flowId }); }
      };
      // flujo actual (preferencia primero)
      const curStartId = globalThis.App?.state?.meta?.start_node;
      if (curStartId){ pushFrom(curFlowId || '(actual)', globalThis.App?.state?.nodes?.[curStartId]); }
      // otros flujos del proyecto
      for (const fid of Object.keys(flows)){
        if (!fid || fid === curFlowId) continue;
        const meta = flows[fid]?.meta; const startId = meta?.start_node;
        if (startId){ pushFrom(fid, flows[fid]?.nodes?.[startId]); }
      }
    }catch(error_){ console.debug('[assign_var] collectAllFlowVars failed', error_); }
    // de‑duplicar por nombre, conservando el primero (prioriza flujo actual)
    const seen = new Set();
    const out = [];
    for (const it of list){ if(!seen.has(it.name)){ seen.add(it.name); out.push(it); } }
    return out;
  }

  function getVarDef(name){
    try{
      // flujo actual primero
      const startId = globalThis.App?.state?.meta?.start_node;
      const curList = globalThis.App?.state?.nodes?.[startId]?.variables || [];
      let def = curList.find(v => v?.name === name);
      if (def) return def;
      // otros flujos del proyecto
      const flows = globalThis.AppProject?.flows || {};
      for (const fid of Object.keys(flows)){
        const meta = flows[fid]?.meta; const s = meta?.start_node; if(!s) continue;
        const list = flows[fid]?.nodes?.[s]?.variables || [];
        const d = list.find(v => v?.name === name); if (d) return d;
      }
    }catch(error_){ console.debug('[assign_var] getVarDef failed', error_); }
    return undefined;
  }

  function parseDefaultValue(defVal){
    if (defVal === undefined || defVal === null) return undefined;
    if (typeof defVal === 'object') return defVal;
    if (typeof defVal === 'string'){
      const s = defVal.trim();
      if (!s) return undefined;
      try { return JSON.parse(s); }
      catch(error_){ console.warn('[assign_var] defaultValue JSON parse failed:', error_); return undefined; }
    }
    return undefined;
  }

  function isObjectVar(name){
    const def = getVarDef(name);
    const val = def ? parseDefaultValue(def.defaultValue) : undefined;
    return val && typeof val === 'object' && !Array.isArray(val);
  }

  function renderAssignVar(node, container){
    container = adoptTemplate(container,'assign_var','assign_var-form-slot');

    // Normalizar datos legacy -> assignments
    if (!Array.isArray(node.assignments)){
      const t = node.target || '';
      const v = node.value || '';
      node.assignments = (t || v) ? [{ target: t, value: v }] : [];
    }

    // Entrada completa (name + origin) y sólo nombres
    const allVarEntries = collectAllFlowVars();
    function getAllVarEntries(){ return allVarEntries.slice(); }

    const assignmentsContainer = el('div',{id:'assignmentsContainer', class:'space-y-1'});
    container.appendChild(assignmentsContainer);

    // helpers para saber si una variable es "objeto" (según defaultValue en Start) — busca en todos los flujos

    function renderRow(a){
      const row = el('div',{class:'assignment-row grid grid-cols-[minmax(160px,1fr)_minmax(160px,1fr)_minmax(160px,1fr)_auto] gap-1 items-center'});
      // select root var
      const selTarget = el('select',{class:'assign-target border rounded px-2 py-1 text-sm w-full min-w-0'});
      selTarget.appendChild(el('option',{value:'',text:'-- seleccionar --'}));
      const curFlowId = globalThis.AppProject?.active_flow_id || globalThis.App?.state?.flow_id || '';
      for (const ent of getAllVarEntries()){
        const label = ent.flowId && ent.flowId !== curFlowId ? `${ent.name} (${ent.flowId})` : ent.name;
        const opt=el('option',{value:ent.name,text:label});
        opt.dataset.originFlow = ent.flowId || '';
        selTarget.appendChild(opt);
      }
      // path
      const pathInp = el('input',{type:'text',class:'assign-path border rounded px-2 py-1 text-sm w-full min-w-0',placeholder:'propiedad (ej: persona.nombre)'});
      // init select+path from a.target
  if (a?.target?.includes('.')){ const parts=a.target.split('.'); selTarget.value = parts[0]; pathInp.value = parts.slice(1).join('.'); }
  else if (a?.target) { selTarget.value = a.target; }
  // value
  const valueAttrs = { type:'text', class:'assign-value border rounded px-2 py-1 text-sm w-full min-w-0', placeholder:'ej: "texto" | 123 | context.varX | {{expresion}}', value: a.value || '' };
  const valueInp = el('input', valueAttrs);
      // actions (explorer + remove) en una sola celda para evitar saltos de fila
      const actions = el('div',{class:'assign-actions flex items-center gap-1 justify-end'});
      const explorerBtn = el('button',{type:'button',class:'explorer-btn px-2 py-1 border rounded text-sm', text:'Explorar'});
      const removeBtn = el('button',{type:'button',class:'remove-assignment px-2 py-1 border rounded text-sm', title:'Eliminar asignación', text:'−'});

      row.appendChild(selTarget);
      row.appendChild(pathInp);
      row.appendChild(valueInp);
      actions.appendChild(explorerBtn);
      actions.appendChild(removeBtn);
      row.appendChild(actions);

      // si la variable seleccionada no es objeto, ocultar path + explorer
      function updateVisibility(){
        const showPath = !!selTarget.value && isObjectVar(selTarget.value);
        pathInp.classList.toggle('hidden', !showPath);
        explorerBtn.classList.toggle('hidden', !showPath);
        if (!showPath) pathInp.value = '';
      }
      updateVisibility();
      selTarget.addEventListener('change', updateVisibility);

      return row;
    }

    function renderAssignments(){
      assignmentsContainer.innerHTML = '';
      if (!Array.isArray(node.assignments) || node.assignments.length === 0) node.assignments = [{ target:'', value:'' }];
      for (const a of node.assignments){ assignmentsContainer.appendChild(renderRow(a)); }
      // ocultar el botón eliminar cuando solo hay una fila
      const rowsNow = assignmentsContainer.querySelectorAll('.assignment-row');
      for (const r of rowsNow){
        const removeBtn = r.querySelector('.remove-assignment');
        if (removeBtn) removeBtn.classList.toggle('hidden', rowsNow.length <= 1);
      }
      const addBtn = el('button',{type:'button',class:'add-assignment mt-1 px-3 py-1 bg-green-600 text-white rounded text-sm', text:'+ Añadir asignación'});
      assignmentsContainer.appendChild(addBtn);
    }
    renderAssignments();

    // Nota / ayuda
    container.appendChild(el('div',{class:'form-row form-help'},[
      el('small',{text:'Si el valor empieza con {{expr}} se evaluará la expresión interna. Si contiene context. se intentará evaluar. De lo contrario se trata como literal.'})
    ]));

    function persist(){
      const rows = assignmentsContainer.querySelectorAll('.assignment-row');
      const assigns = [];
      for (const row of rows){
        const sel = row.querySelector('.assign-target');
        const path = row.querySelector('.assign-path');
        const val = row.querySelector('.assign-value');
        const root = sel?.value || '';
        const sub = (path?.value||'').trim();
        let target = '';
        if (root){ target = sub ? (root + '.' + sub) : root; }
        assigns.push({ target, value: val?.value || '' });
      }
      node.assignments = assigns;
      delete node.target; delete node.value; // limpiar legacy
    }

    const validator = setupValidation(container, {
      boxId:'assign_var_validation_box',
      okMessage:'✔ Assign válido',
      collectState(){
        persist();
        return { assignments: node.assignments };
      },
      buildRules(st){
        const rules=[
          {kind:'error', when: !st.assignments || st.assignments.every(a => !a.target), msg:'Al menos una asignación con target requerida.'},
          {kind:'warning', when: st.assignments?.some(a => a.target && /[^a-zA-Z0-9_.]/.test(a.target)), msg:'Nombre de destino contiene caracteres no recomendados.'},
          {kind:'info', when: st.assignments?.some(a => (a.value||'')===''), msg:'Hay valores vacíos: limpiarán la variable.'}
        ];
        return rules;
      }
    });

    assignmentsContainer.addEventListener('input', (ev)=>{
      if (ev.target.classList.contains('assign-path') || ev.target.classList.contains('assign-value')) { persist(); validator.run(); }
    });
    assignmentsContainer.addEventListener('change', (ev)=>{
      if (ev.target.classList.contains('assign-target')) { persist(); validator.run(); }
    });
    assignmentsContainer.addEventListener('click', async (ev)=>{
      if (ev.target.classList.contains('add-assignment')){
        node.assignments.push({ target:'', value:'' });
        renderAssignments(); persist(); validator.run();
      } else if (ev.target.classList.contains('remove-assignment')){
        const rows = Array.from(assignmentsContainer.querySelectorAll('.assignment-row'));
        const idx = rows.indexOf(ev.target.closest('.assignment-row'));
        if (idx >= 0) node.assignments.splice(idx,1);
        renderAssignments(); persist(); validator.run();
      } else if (ev.target.classList.contains('explorer-btn')){
        const row = ev.target.closest('.assignment-row');
        const sel = row.querySelector('.assign-target');
        const pathInp = row.querySelector('.assign-path');
        const root = sel?.value;
        if (!root) { alert('Selecciona primero la variable raíz'); return; }
        try{
          const picker = globalThis.VarExplorer.open(root);
          const chosen = await picker.waitForSelection();
          if(chosen?.path){ pathInp.value = chosen.path; persist(); validator.run(); }
        }catch(e){ console.warn('Explorer open failed', e); alert('No se pudo abrir el explorador'); }
      }
    });

    const result = validator.run();
    markFieldUsed(container.querySelector('.assign_var-form-slot'));
    document.dispatchEvent(new CustomEvent('renderer:after', { detail: { type:'assign_var', container, validation: result }}));
  }

  globalThis.RendererRegistry = globalThis.RendererRegistry || {};
  globalThis.RendererRegistry.assign_var = renderAssignVar;
})();
