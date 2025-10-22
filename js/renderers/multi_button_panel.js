// multi_button_panel.js - panel de propiedades dedicado para multi_button
(function(){
  const { adoptTemplate, setupValidation } = globalThis.RendererHelpers || {};
  const H = globalThis.FormBuilderHelpers || {};
  const inputRow = H.inputRow || function(){ return document.createElement('div'); };
  const el = H.el || function(tag, attrs={}, children=[]){
    const e = document.createElement(tag);
    if (attrs && typeof attrs === 'object') {
      for (const key of Object.keys(attrs)){
        if (key === 'className') e.className = attrs[key];
        else if (key.startsWith('data-')) e.setAttribute(key, attrs[key]);
        else e[key] = attrs[key];
      }
    }
    for (const c of (children||[])){ if (c) e.appendChild(c); }
    return e;
  };

  function renderMulti(node, container){
    // Adoptar template dedicado
    container = adoptTemplate(container, 'multi_button', 'multi_button-form-slot');
    if (!container?.classList?.contains('multi_button-form-slot')){
      const fallback = document.createElement('div');
      fallback.className = 'multi_button-form-slot';
      (container?.appendChild ? container : document.body).appendChild(fallback);
      container = fallback;
    }

    // Textos por locale (prompt)
    const locales = (globalThis.App?.state?.meta?.locales?.length) ? globalThis.App.state.meta.locales : ['es'];
    for (const loc of locales){
      const val = node.i18n?.[loc]?.prompt ?? '';
      container.appendChild(inputRow({label:`Prompt (${loc})`, id:`i18n_prompt_${loc}`, value:val}));
    }

    // Save_as
    const defaultSave = (node.save_as && String(node.save_as).trim()) || (node.id ? `selected_multi_${node.id}` : '');
  const saveRow = inputRow({label:`Guardar selección en (save_as)`, id:'mb_save_as', value: defaultSave });
  container.appendChild(saveRow);

    // Restricciones min/max
    const limitsRow = el('div',{class:'form-row', style:'display:flex;gap:8px;'});
  limitsRow.appendChild(inputRow({label:'Mínimo seleccionado (opcional)', id:'mb_min', value: node.min_selected ?? '' }));
  limitsRow.appendChild(inputRow({label:'Máximo seleccionado (opcional)', id:'mb_max', value: node.max_selected ?? '' }));
    container.appendChild(limitsRow);

    // Valores por defecto
  const defRow = inputRow({label:'Valores por defecto (coma separada)', id:'mb_defaults', value: Array.isArray(node.default_values)? node.default_values.join(',') : ''});
  container.appendChild(defRow);

    // Modo y proveedor
    const modeRow = el('div',{class:'form-row'});
    modeRow.appendChild(el('label',{text:'Modo'}));
    const modeSel = el('select',{id:'mb_mode'});
    for (const m of ['static','dynamic']){
      const opt = el('option',{value:m,text:m});
      if ((node.mode||'static')===m) opt.selected=true;
      modeSel.appendChild(opt);
    }
    modeRow.appendChild(modeSel); container.appendChild(modeRow);

    const providerWrap = el('div',{id:'mb_provider', class:'border rounded p-2 bg-white/70', style:'display:none'});
  providerWrap.appendChild(inputRow({label:'Lista (source_list)', id:'mb_source', value: node.provider?.source_list || node.source_list || ''}));
  providerWrap.appendChild(inputRow({label:'Label (label_expr)', id:'mb_label', value: node.provider?.label_expr || ''}));
  providerWrap.appendChild(inputRow({label:'Value (value_expr)', id:'mb_value', value: node.provider?.value_expr || ''}));
  providerWrap.appendChild(inputRow({label:'Filtro (filter_expr)', id:'mb_filter', value: node.provider?.filter_expr || ''}));
  providerWrap.appendChild(inputRow({label:'Orden (sort_expr)', id:'mb_sort', value: node.provider?.sort_expr || ''}));
    container.appendChild(providerWrap);

    // Helper: active flow and populate nodes
    const getActiveFlowId = ()=> (globalThis.AppProject?.active_flow_id) || (globalThis.App?.state?.meta?.flow_id) || '';
    function populateNodeOptions(selectEl, fid, excludeId){
      if(!selectEl) return;
      let nodes=[];
      const proj = globalThis.AppProject || {};
      if(fid && proj.flows?.[fid]?.nodes) nodes = Object.keys(proj.flows[fid].nodes||{});
      else if(globalThis.App?.state?.nodes) nodes = Object.keys(globalThis.App.state.nodes||{});
      const cur = selectEl.value;
      selectEl.innerHTML = '';
      selectEl.appendChild(el('option',{value:'',text:'(ninguno / start)'}));
      for (const nid of nodes){ if(nid!==excludeId){ selectEl.appendChild(el('option',{value:nid,text:nid})); } }
      if(cur) selectEl.value = cur;
    }

    // Next selector (solo dinámico)
    const nextRow = el('div',{class:'form-row', id:'mb_next_row', style:'display:none'});
    nextRow.appendChild(el('label',{text:'Siguiente (flujo · nodo)'}));
    const nextFlowSel = el('select',{id:'mb_next_flow'});
    (function(){ const fid = getActiveFlowId(); const txt = fid? `${fid} (actual)` : '(actual)'; nextFlowSel.appendChild(el('option',{value:'',text:txt})); })();
    const flows = Object.keys(globalThis.AppProject?.flows || {});
    for (const fid of flows){ nextFlowSel.appendChild(el('option',{value:fid,text:fid})); }
    nextFlowSel.value = node.next?.flow_id || '';
    const nextNodeSel = el('select',{id:'mb_next_node'});
    function refreshNextNode(){ const fid = nextFlowSel.value || getActiveFlowId(); populateNodeOptions(nextNodeSel, fid, node.id); const want = node.next?.node_id || nextNodeSel.value || ''; if(want) nextNodeSel.value = want; }
    refreshNextNode();
    nextFlowSel.addEventListener('change',()=>{ const first=nextFlowSel.querySelector('option[value=""]'); if(first){ const fid=getActiveFlowId(); first.text = fid? `${fid} (actual)` : '(actual)'; } refreshNextNode(); const v=nextNodeSel.value||''; const f=nextFlowSel.value||''; node.next = (v||f)? { flow_id:f, node_id:v } : null; });
    nextNodeSel.addEventListener('change',()=>{ const v=nextNodeSel.value||''; const f=nextFlowSel.value||''; node.next = (v||f)? { flow_id:f, node_id:v } : null; });
    const goNextBtn = el('button',{type:'button',text:'Ir al destino', className:'ml-2 px-2 py-1 bg-white border rounded text-sm'});
    goNextBtn.addEventListener('click',()=>{
      const fid = nextFlowSel.value || getActiveFlowId();
      let nid = nextNodeSel.value || '';
      if(!fid) { alert('Selecciona un flujo destino'); return; }
      if(globalThis.AppProject?.flows?.[fid]){
        const f = globalThis.AppProject.flows[fid];
        if(globalThis.App && typeof globalThis.App.importJson === 'function') globalThis.App.importJson({ flow_id: fid, meta: f.meta, nodes: f.nodes });
        globalThis.AppProject.active_flow_id = fid;
      }
      if(!nid){ const start = globalThis.AppProject?.flows?.[fid]?.meta?.start_node || globalThis.App?.state?.meta?.start_node || ''; nid = start; }
      if(typeof globalThis.App?.selectNode === 'function' && nid) globalThis.App.selectNode(nid);
    });
    nextRow.appendChild(el('div',{style:'display:flex;gap:8px;align-items:center;'},[nextFlowSel, nextNodeSel, goNextBtn]));
    container.appendChild(nextRow);

    // Lista estática de opciones
    const listRow = el('div',{class:'form-row'});
    listRow.appendChild(el('label',{text:'Opciones estáticas'}));
  if (!Array.isArray(node.options)) node.options = [{ label: 'Opción 1' }];
  const btns = node.options;
    const list = el('div'); listRow.appendChild(list);
    const add = el('button',{type:'button', text:'Añadir opción', className:'mt-2 px-3 py-1 bg-blue-600 text-white rounded text-sm'});
  add.addEventListener('click', ()=>{ btns.push({label:'', value:''}); renderList(); runValidation(); });
    listRow.appendChild(add); container.appendChild(listRow);

    function createOptionRow(b, idx){
      const row = el('div',{class:'mb-item', style:'border:1px solid #eee;padding:8px;margin:6px 0;'});
      const lab = inputRow({label:`Etiqueta`, id:`mb_lbl_${idx}`, value: b.label||''}); row.appendChild(lab);
      const val = inputRow({label:`Valor (opcional)`, id:`mb_val_${idx}`, value: b.value||''}); row.appendChild(val);
      const variantSel = el('select',{id:`mb_var_${idx}`});
      for (const v of ['primary','secondary','tertiary']){
        const o = el('option',{value:v,text:v});
        if ((b.variant||'primary')===v) o.selected=true;
        variantSel.appendChild(o);
      }
      const varRow = el('div',{class:'form-row'}); varRow.appendChild(el('label',{text:'Variante'})); varRow.appendChild(variantSel); row.appendChild(varRow);
      const del = el('button',{type:'button', text:'Eliminar', className:'ml-2 px-2 py-1 bg-red-500 text-white rounded'});
      del.addEventListener('click',()=>{
        if(btns.length<=1){ alert('Debe existir al menos una opción.'); return; }
        btns.splice(idx,1); renderList(); runValidation();
      });
      // Destino por opción (flujo · nodo)
      const tgtRow = el('div',{class:'form-row', style:'display:flex; gap:8px; align-items:center;'});
      tgtRow.appendChild(el('label',{text:'Destino (flujo · nodo)'}));
      const flowSel = el('select',{id:`mb_tgt_flow_${idx}`});
      { const fid=getActiveFlowId(); const txt=fid? `${fid} (actual)` : '(actual)'; flowSel.appendChild(el('option',{value:'',text:txt})); }
      for (const fid of Object.keys(globalThis.AppProject?.flows || {})){ flowSel.appendChild(el('option',{value:fid,text:fid})); }
      flowSel.value = (b.target?.flow_id) || '';
      const nodeSel = el('select',{id:`mb_tgt_${idx}`});
      function refresh(){ const fid = flowSel.value || getActiveFlowId(); populateNodeOptions(nodeSel, fid, node.id); const want = b.target?.node_id || nodeSel.value || ''; if(want) nodeSel.value = want; }
      refresh();
      flowSel.addEventListener('change',()=>{ const first=flowSel.querySelector('option[value=""]'); if(first){ const fid=getActiveFlowId(); first.text=fid? `${fid} (actual)` : '(actual)'; } refresh(); const v=nodeSel.value||''; const f=flowSel.value||''; b.target = (v||f)? { flow_id:f, node_id:v } : null; if(!v && !f) delete b.next; });
      nodeSel.addEventListener('change',()=>{ const v=nodeSel.value||''; const f=flowSel.value||''; b.target = (v||f)? { flow_id:f, node_id:v } : null; if(!v && !f) delete b.next; });
      const goBtn = el('button',{type:'button',text:'Ir al destino', className:'ml-2 px-2 py-1 bg-white border rounded text-sm'});
      goBtn.addEventListener('click',()=>{
        const fid = flowSel.value || getActiveFlowId();
        let nid = nodeSel.value || '';
        if(!fid) { alert('Selecciona un flujo destino (opción)'); return; }
        if(globalThis.AppProject?.flows?.[fid]){
          const f = globalThis.AppProject.flows[fid];
          if(globalThis.App && typeof globalThis.App.importJson === 'function') globalThis.App.importJson({ flow_id: fid, meta: f.meta, nodes: f.nodes });
          globalThis.AppProject.active_flow_id = fid;
        }
        if(!nid){ const start = globalThis.AppProject?.flows?.[fid]?.meta?.start_node || globalThis.App?.state?.meta?.start_node || ''; nid = start; }
        if(typeof globalThis.App?.selectNode === 'function' && nid) globalThis.App.selectNode(nid);
      });
      tgtRow.appendChild(flowSel); tgtRow.appendChild(nodeSel); tgtRow.appendChild(goBtn);
      row.appendChild(tgtRow);

      // Bindings
      const labInp = lab.querySelector('input') || lab;
      const valInp = val.querySelector('input') || val;
      labInp.addEventListener('input', ev=>{ b.label = ev.target.value; });
      valInp.addEventListener('input', ev=>{ b.value = ev.target.value; });
      variantSel.addEventListener('change', ev=>{ b.variant = ev.target.value; });
      row.appendChild(del);
      return row;
    }

    function renderList(){
      list.innerHTML = '';
      for (let idx=0; idx<btns.length; idx++){
        const b = btns[idx];
        const row = createOptionRow(b, idx);
        list.appendChild(row);
      }
    }
    renderList();

  function toggle(){ const isDyn = (modeSel.value==='dynamic'); providerWrap.style.display = isDyn? 'block':'none'; nextRow.style.display = isDyn? 'block':'none'; listRow.style.display = isDyn? 'none':'block'; if(!isDyn){ node.next = null; nextFlowSel.value=''; nextNodeSel.value=''; } }
    modeSel.addEventListener('change', toggle); toggle();

  // Update node on input
  function qv(sel){ return container.querySelector(sel+ ' input, ' + sel); }
  qv('#mb_save_as')?.addEventListener('input', ev=>{ node.save_as = ev.target.value.trim(); });
  qv('#mb_min')?.addEventListener('input', ev=>{ const v = Number.parseInt(ev.target.value,10); node.min_selected = Number.isFinite(v) ? v : undefined; });
  qv('#mb_max')?.addEventListener('input', ev=>{ const v = Number.parseInt(ev.target.value,10); node.max_selected = Number.isFinite(v) ? v : undefined; });
  qv('#mb_defaults')?.addEventListener('input', ev=>{ const arr = String(ev.target.value||'').split(',').map(s=>s.trim()).filter(Boolean); node.default_values = arr.length? arr : undefined; });
  modeSel.addEventListener('change', ev=>{ node.mode = ev.target.value; });
  // Provider fields
  function ensureProvider(){ node.provider = node.provider || { source_list:'', label_expr:'', value_expr:'', filter_expr:'', sort_expr:'' }; }
  qv('#mb_source')?.addEventListener('input', ev=>{ ensureProvider(); node.provider.source_list = ev.target.value.trim(); node.source_list = node.provider.source_list; });
  qv('#mb_label')?.addEventListener('input', ev=>{ ensureProvider(); node.provider.label_expr = ev.target.value; });
  qv('#mb_value')?.addEventListener('input', ev=>{ ensureProvider(); node.provider.value_expr = ev.target.value; });
  qv('#mb_filter')?.addEventListener('input', ev=>{ ensureProvider(); node.provider.filter_expr = ev.target.value; });
  qv('#mb_sort')?.addEventListener('input', ev=>{ ensureProvider(); node.provider.sort_expr = ev.target.value; });

    // Validación
    const validator = setupValidation(container,{
      boxId:'multi_button_validation_box',
      collectState: ()=>({
        mode: modeSel.value,
        hasLabels: btns.some(b=> (b.label||'').trim().length>0),
        min: Number.parseInt(container.querySelector('#mb_min input, #mb_min')?.value||'0',10)||0,
        max: Number.parseInt(container.querySelector('#mb_max input, #mb_max')?.value||'0',10)||0,
        src: container.querySelector('#mb_source input, #mb_source')?.value?.trim()
      }),
      buildRules: s=>{
        const rules=[];
        if (s.mode==='static'){
          rules.push({kind: s.hasLabels? 'ok':'error', when: !s.hasLabels, msg:'Debes definir al menos una etiqueta.'});
        } else {
          rules.push({kind:'error', when:!s.src, msg:'Debes indicar source_list en modo dinámico.', field:'#mb_source'});
        }
        if (s.max>0 && s.min> s.max) rules.push({kind:'error', when:true, msg:'min_selected no puede ser mayor a max_selected'});
        return rules;
      }
    });
    function runValidation(){ validator.run(); }
    runValidation();
  }

  globalThis.RendererRegistry = globalThis.RendererRegistry || {};
  globalThis.RendererRegistry.multi_button = renderMulti;
})();
