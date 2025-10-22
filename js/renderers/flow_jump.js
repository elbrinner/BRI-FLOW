// flow_jump.js - renderer del nodo flow_jump (salto de flujo con retorno opcional)
(function(){
  const { adoptTemplate, setupValidation, markFieldUsed } = window.RendererHelpers || {};
  const H = window.FormBuilderHelpers || {};
  const el = H.el || function(tag, attrs={}, children=[]) { const e=document.createElement(tag); if(attrs){ Object.entries(attrs).forEach(([k,v])=>{ if(k==='text') e.textContent=v; else e.setAttribute(k,v); }); } (children||[]).forEach(c=>e.appendChild(c)); return e; };

  function renderFlowJump(node, container){
    container = adoptTemplate(container,'flow_jump','flow-jump-form-slot');
    // Nota aclaratoria
    const note = el('div',{class:'text-xs text-gray-500', style:'margin-bottom:6px;'});
    note.textContent = 'Este nodo controla su destino y retorno. No muestra el campo "Siguiente" genérico.';
    container.appendChild(note);
    // Target
    const tr = el('div',{class:'form-row'});
    tr.appendChild(el('label',{text:'Destino (flujo · nodo)'}));
    // selector de flujo
    const flowSel = el('select',{id:'fj_target_flow'});
    const proj = window.AppProject || {};
    const flowsDict = proj.flows || {};
    const activeId = proj.active_flow_id || window.App?.state?.meta?.flow_id || '';
    const flowIds = Object.keys(flowsDict);
    if (flowIds.length === 0) {
      if (activeId) {
        const name = window.App?.state?.meta?.name || activeId;
        flowSel.appendChild(el('option',{value:activeId,text: name + ' (actual)'}));
      }
    } else {
      flowIds.forEach(fid=>{
        const name = flowsDict[fid]?.meta?.name || fid;
        const txt = (fid === activeId) ? (name + ' (actual)') : name;
        flowSel.appendChild(el('option',{value:fid,text:txt}));
      });
      // Si el flujo activo no está en el proyecto, añadirlo igualmente
      if (activeId && !flowIds.includes(activeId)) {
        const name = window.App?.state?.meta?.name || activeId;
        flowSel.appendChild(el('option',{value:activeId,text: name + ' (actual)'}));
      }
    }
    const initialTargetFlowId = node.target?.flow_id || activeId || (flowIds[0] || '');
    if (initialTargetFlowId) flowSel.value = initialTargetFlowId;
    // selector de nodo dependiente
    const nodeSel = el('select',{id:'fj_target_node'});
    nodeSel.appendChild(el('option',{value:'',text:'(start)'}));
    function refreshNodeSel(){
      const fid = flowSel.value || activeId || '';
      const proj = window.AppProject || {};
  const nodesDict = proj.flows?.[fid]?.nodes || (window.App?.state?.nodes || {});
      const currentVal = nodeSel.value;
      nodeSel.innerHTML = '';
      nodeSel.appendChild(el('option',{value:'',text:'(start)'}));
      Object.keys(nodesDict).forEach(nid=>{
        const n = nodesDict[nid];
        const label = (n?.type === 'start') ? `🚀 ${nid} (start)` : `${nid} · ${n?.type || ''}`.trim();
        nodeSel.appendChild(el('option',{value:nid,text:label}));
      });
      const want = (node.target?.node_id) || currentVal || '';
      if (want) nodeSel.value = want;
    }
    refreshNodeSel();
    flowSel.addEventListener('change', refreshNodeSel);
    const goBtn = el('button', { type:'button', text:'Ir al destino' });
    goBtn.className = 'ml-2 px-2 py-1 bg-white border rounded text-sm';
    goBtn.addEventListener('click', () => {
      try{
        const fid = flowSel.value || window.AppProject?.active_flow_id || '';
        let nid = nodeSel.value || '';
        if(!fid) return alert('Selecciona un flujo destino');
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
      }catch(e){ console.warn('Ir al destino (FlowJump) falló', e); }
    });
    const targetWrap = el('div', { style:'display:flex; gap:8px; align-items:center;' }, [flowSel, nodeSel, goBtn]);
    tr.appendChild(targetWrap); container.appendChild(tr);
    // Return on end
    const rr = el('div',{class:'form-row'});
    const chk = el('input',{type:'checkbox', id:'fj_return_on_end'}); chk.checked = (node.return_on_end !== false);
    rr.appendChild(el('label',{for:'fj_return_on_end', text:'Retornar al finalizar flujo destino'})); rr.appendChild(chk); container.appendChild(rr);
    // Return target (opcional)
    const rtr = el('div',{class:'form-row'});
    rtr.appendChild(el('label',{text:'Retorno (flujo · nodo)'}));
    const rFlowSel = el('select',{id:'fj_return_flow'});
    if (flowIds.length === 0) {
      if (activeId) {
        const name = window.App?.state?.meta?.name || activeId;
        rFlowSel.appendChild(el('option',{value:activeId,text: name + ' (actual)'}));
      }
    } else {
      flowIds.forEach(fid=>{
        const name = flowsDict[fid]?.meta?.name || fid;
        const txt = (fid === activeId) ? (name + ' (actual)') : name;
        rFlowSel.appendChild(el('option',{value:fid,text:txt}));
      });
      if (activeId && !flowIds.includes(activeId)) {
        const name = window.App?.state?.meta?.name || activeId;
        rFlowSel.appendChild(el('option',{value:activeId,text: name + ' (actual)'}));
      }
    }
    const initialReturnFlowId = node.return_target?.flow_id || activeId || (flowIds[0] || '');
    if (initialReturnFlowId) rFlowSel.value = initialReturnFlowId;
    const rNodeSel = el('select',{id:'fj_return_node'});
    rNodeSel.appendChild(el('option',{value:'',text:'(next del FlowJump)'}));
    function refreshRNodeSel(){
      const fid = rFlowSel.value || activeId || '';
      const proj = window.AppProject || {};
  const nodesDict = proj.flows?.[fid]?.nodes || (window.App?.state?.nodes || {});
      const currentVal = rNodeSel.value;
      rNodeSel.innerHTML = '';
      rNodeSel.appendChild(el('option',{value:'',text:'(next del FlowJump)'}));
      Object.keys(nodesDict).forEach(nid=>{
        const n = nodesDict[nid];
        const label = (n?.type === 'start') ? `🚀 ${nid} (start)` : `${nid} · ${n?.type || ''}`.trim();
        rNodeSel.appendChild(el('option',{value:nid,text:label}));
      });
      const want = (node.return_target?.node_id) || currentVal || '';
      if (want) rNodeSel.value = want;
    }
    refreshRNodeSel();
    rFlowSel.addEventListener('change', refreshRNodeSel);
    const goRetBtn = el('button', { type:'button', text:'Ir al retorno' });
    goRetBtn.className = 'ml-2 px-2 py-1 bg-white border rounded text-sm';
    goRetBtn.addEventListener('click', () => {
      try{
        const currentFlowId = window.App?.state?.meta?.flow_id || '';
        let fid = rFlowSel.value || window.AppProject?.active_flow_id || '';
        let nid = rNodeSel.value || '';
        if (!nid) {
          // (next del FlowJump) → ir al flujo actual y seleccionar el next del propio FlowJump
          fid = currentFlowId;
          nid = window.App?.state?.nodes?.[node.id]?.next?.node_id || '';
        }
        if(!fid) return alert('Selecciona un flujo de retorno');
        if(window.AppProject?.flows?.[fid]){
          const f = window.AppProject.flows[fid];
          if(window.App && typeof window.App.importJson === 'function') window.App.importJson({ flow_id: fid, meta: f.meta, nodes: f.nodes });
          window.AppProject.active_flow_id = fid;
        }
        if(typeof window.App?.selectNode === 'function' && nid) window.App.selectNode(nid);
      }catch(e){ console.warn('Ir al retorno (FlowJump) falló', e); }
    });
    const retWrap = el('div', { style:'display:flex; gap:8px; align-items:center;' }, [rFlowSel, rNodeSel, goRetBtn]);
    rtr.appendChild(retWrap); container.appendChild(rtr);
    // Apply defaults policy
    const pr = el('div',{class:'form-row'});
    pr.appendChild(el('label',{text:'Aplicar defaults al entrar (start)'}));
    const sel = el('select',{id:'fj_policy'});
    [['none','Ninguno'],['onlyMissing','Solo faltantes'],['overwrite','Sobrescribir']].forEach(([v,t])=> sel.appendChild(el('option',{value:v,text:t})));
    sel.value = node.apply_start_defaults || 'onlyMissing'; pr.appendChild(sel); container.appendChild(pr);

    const validator = setupValidation(container, {
      boxId:'flowjump_validation_box',
      okMessage:'✔ FlowJump válido',
      collectState(){
        return {
          tf: (flowSel.value||'').trim(), tn: (nodeSel.value||'').trim(),
          ro: !!chk.checked,
          rtf: (rFlowSel.value||'').trim(), rtn: (rNodeSel.value||'').trim(),
          pol: sel.value
        };
      },
      buildRules(s){
        return [
          { kind:'error', when: !s.tf, msg:'Destino flow_id requerido' }
        ];
      }
    });
    [flowSel, nodeSel, chk, rFlowSel, rNodeSel, sel].forEach(e=>{ e?.addEventListener('input',validator.run); e?.addEventListener('change',validator.run); });
    const result = validator.run();
    markFieldUsed(container.querySelector('.flow-jump-form-slot'));
    document.dispatchEvent(new CustomEvent('renderer:after', { detail: { type:'flow_jump', container, validation: result }}));
  }

  window.RendererRegistry = window.RendererRegistry || {};
  window.RendererRegistry.flow_jump = renderFlowJump;
})();
