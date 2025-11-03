// condition.js - renderer del nodo condition
(function(){
  const { adoptTemplate, setupValidation, markFieldUsed } = window.RendererHelpers || {};
  const H = window.FormBuilderHelpers || {};
  const inputRow = H.inputRow || function(){ return document.createElement('div'); };
  const el = H.el || function(tag, attrs={}, children=[]) { const e=document.createElement(tag); if(attrs){ Object.entries(attrs).forEach(([k,v])=>{ if(k==='text') e.textContent=v; else e.setAttribute(k,v); }); } (children||[]).forEach(c=>e.appendChild(c)); return e; };

  function renderCondition(node, container, nodeIds){
    container = adoptTemplate(container,'condition','condition-form-slot');
    container.appendChild(inputRow({label:'Condición (expr)', id:'cond_expr', value: node.expr || '', placeholder:'context.count > 3'}));

    // Helpers para listas de flujos y nodos según flujo
    function buildFlowSelect(id, currentFlowId){
      const sel = el('select',{id});
      const flowsDict = window.AppProject?.flows || {};
      const flows = Object.keys(flowsDict);
      const activeId = window.AppProject?.active_flow_id || window.App?.state?.meta?.flow_id || '';
      const activeName = (flowsDict?.[activeId]?.meta?.name) || (window.App?.state?.meta?.name) || activeId;
      sel.appendChild(el('option',{value:'',text: activeId ? `${activeName} (actual)` : '(actual)'}));
      flows.forEach(fid=>{
        // Evitar duplicar el flujo actual cuando existe la opción "(actual)"
        if (fid === activeId) return;
        sel.appendChild(el('option',{value:fid,text:fid}));
      });
      sel.value = currentFlowId || '';
      return sel;
    }
    function buildNodeSelect(id){
      const sel = el('select',{id});
      sel.appendChild(el('option',{value:'',text:'(ninguno / start)'}));
      return sel;
    }
    function refreshNodeSelect(flowSel, nodeSel, selectedId){
      const fid = flowSel.value || (window.AppProject?.active_flow_id || '');
      let nodes=[];
      if(fid && window.AppProject?.flows?.[fid]?.nodes) nodes = Object.keys(window.AppProject.flows[fid].nodes);
      else if(window.App?.state?.nodes) nodes = Object.keys(window.App.state.nodes||{});
      const prev = nodeSel.value;
      nodeSel.innerHTML='';
      nodeSel.appendChild(el('option',{value:'',text:'(ninguno / start)'}));
      nodes.forEach(nid=>{ if(nid!==node.id) nodeSel.appendChild(el('option',{value:nid,text:nid})); });
      const want = selectedId || prev || '';
      if(want) nodeSel.value = want;
    }

    // TRUE target: flujo + nodo
    const tr = el('div',{class:'form-row'});
    tr.appendChild(el('label',{text:'Destino si TRUE (flujo · nodo)'}));
    const trueFlowSel = buildFlowSelect('cond_true_flow', node.true_target?.flow_id || '');
    const trueNodeSel = buildNodeSelect('cond_true_node');
    refreshNodeSelect(trueFlowSel, trueNodeSel, node.true_target?.node_id || '');
    trueFlowSel.addEventListener('change',()=>{
      // refrescar etiqueta de '(actual)' con el nombre del flujo activo
      try{
        const first = trueFlowSel.querySelector('option[value=""]');
        if(first){
          const flowsDict = window.AppProject?.flows || {};
          const activeId = window.AppProject?.active_flow_id || window.App?.state?.meta?.flow_id || '';
          const activeName = (flowsDict?.[activeId]?.meta?.name) || (window.App?.state?.meta?.name) || activeId;
          first.text = activeId ? `${activeName} (actual)` : '(actual)';
        }
      }catch(_e){}
      return refreshNodeSelect(trueFlowSel, trueNodeSel, '');
    });
    const goTrue = el('button',{type:'button',text:'Ir (TRUE)'});
    goTrue.className = 'ml-2 px-2 py-1 bg-white border rounded text-sm';
    goTrue.addEventListener('click',()=>{
      try{
        const fid = trueFlowSel.value || (window.AppProject?.active_flow_id || '');
        let nid = trueNodeSel.value || '';
        if(!fid) return alert('Selecciona un flujo destino (TRUE)');
        if(window.AppProject?.flows?.[fid]){
          const f = window.AppProject.flows[fid];
          if(window.App && typeof window.App.importJson === 'function') window.App.importJson({ flow_id: fid, meta: f.meta, nodes: f.nodes });
          window.AppProject.active_flow_id = fid;
        }
        if(!nid){
          const start = window.AppProject?.flows?.[fid]?.meta?.start_node || window.App?.state?.meta?.start_node || '';
          nid = start;
        }
        if(typeof window.App?.selectNode === 'function' && nid) window.App.selectNode(nid);
      }catch(e){ console.warn('Ir (TRUE) falló', e); }
    });
    tr.appendChild(el('div',{style:'display:flex;gap:8px;align-items:center;'},[trueFlowSel,trueNodeSel,goTrue]));
    container.appendChild(tr);

    // FALSE target: flujo + nodo
    const fr = el('div',{class:'form-row'});
    fr.appendChild(el('label',{text:'Destino si FALSE (flujo · nodo)'}));
    const falseFlowSel = buildFlowSelect('cond_false_flow', node.false_target?.flow_id || '');
    const falseNodeSel = buildNodeSelect('cond_false_node');
    refreshNodeSelect(falseFlowSel, falseNodeSel, node.false_target?.node_id || '');
    falseFlowSel.addEventListener('change',()=>{
      // refrescar etiqueta de '(actual)' con el nombre del flujo activo
      try{
        const first = falseFlowSel.querySelector('option[value=""]');
        if(first){
          const flowsDict = window.AppProject?.flows || {};
          const activeId = window.AppProject?.active_flow_id || window.App?.state?.meta?.flow_id || '';
          const activeName = (flowsDict?.[activeId]?.meta?.name) || (window.App?.state?.meta?.name) || activeId;
          first.text = activeId ? `${activeName} (actual)` : '(actual)';
        }
      }catch(_e){}
      return refreshNodeSelect(falseFlowSel, falseNodeSel, '');
    });
    const goFalse = el('button',{type:'button',text:'Ir (FALSE)'});
    goFalse.className = 'ml-2 px-2 py-1 bg-white border rounded text-sm';
    goFalse.addEventListener('click',()=>{
      try{
        const fid = falseFlowSel.value || (window.AppProject?.active_flow_id || '');
        let nid = falseNodeSel.value || '';
        if(!fid) return alert('Selecciona un flujo destino (FALSE)');
        if(window.AppProject?.flows?.[fid]){
          const f = window.AppProject.flows[fid];
          if(window.App && typeof window.App.importJson === 'function') window.App.importJson({ flow_id: fid, meta: f.meta, nodes: f.nodes });
          window.AppProject.active_flow_id = fid;
        }
        if(!nid){
          const start = window.AppProject?.flows?.[fid]?.meta?.start_node || window.App?.state?.meta?.start_node || '';
          nid = start;
        }
        if(typeof window.App?.selectNode === 'function' && nid) window.App.selectNode(nid);
      }catch(e){ console.warn('Ir (FALSE) falló', e); }
    });
    fr.appendChild(el('div',{style:'display:flex;gap:8px;align-items:center;'},[falseFlowSel,falseNodeSel,goFalse]));
    container.appendChild(fr);

    const validator = setupValidation(container, {
      boxId:'condition_validation_box',
      okMessage:'✔ Condition válida',
      collectState(){
        const expr=(container.querySelector('#cond_expr input,#cond_expr textarea,#cond_expr')?.value||'').trim();
        const t=((container.querySelector('#cond_true_node')?.value)||'');
        const f=((container.querySelector('#cond_false_node')?.value)||'');
        return {expr,t,f};
      },
      buildRules(st){
        return [
          {kind:'error', when: !st.expr, msg:'Expr requerida.'},
          {kind:'warning', when: !st.t && !st.f, msg:'No hay destinos definidos.'},
          {kind:'warning', when: !!st.t && st.t===st.f && st.t!=='', msg:'TRUE y FALSE apuntan al mismo nodo.'}
        ];
      }
    });
    [container.querySelector('#cond_expr'),
     container.querySelector('#cond_true_flow'), container.querySelector('#cond_true_node'),
     container.querySelector('#cond_false_flow'), container.querySelector('#cond_false_node')]
     .forEach(el=>{ if(el){ el.addEventListener('input',validator.run); el.addEventListener('change',validator.run);} });
    const result = validator.run();
    markFieldUsed(container.querySelector('.condition-form-slot'));
    document.dispatchEvent(new CustomEvent('renderer:after', { detail: { type:'condition', container, validation: result }}));
  }

  window.RendererRegistry = window.RendererRegistry || {};
  window.RendererRegistry.condition = renderCondition;
})();
