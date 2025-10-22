// choice.js - renderer del nodo choice
(function(){
  const { adoptTemplate, setupValidation, markFieldUsed } = window.RendererHelpers || {};
  const H = window.FormBuilderHelpers || {};
  const inputRow = H.inputRow || function(){ return document.createElement('div'); };
  const el = H.el || function(tag, attrs={}, children=[]) { const e=document.createElement(tag); if(attrs){ Object.entries(attrs).forEach(([k,v])=>{ if(k==='text') e.textContent=v; else e.setAttribute(k,v); }); } (children||[]).forEach(c=>e.appendChild(c)); return e; };

  function populateNodeOptions(selectEl, nodes, excludeId){
    if(!selectEl) return;
    selectEl.innerHTML='';
    selectEl.appendChild(el('option',{value:'',text:'(ninguno / start)'}));
    (nodes||[]).forEach(nid=>{ if(nid!==excludeId) selectEl.appendChild(el('option',{value:nid,text:nid})); });
  }

  function renderChoice(node, container){
    container = adoptTemplate(container,'choice','choice-form-slot');
    // Prompt (se usa en prompt y opcionalmente como descripción en switch)
    container.appendChild(inputRow({label:'Pregunta / Prompt', id:'choice_prompt', value: node.i18n?.es?.prompt || ''}));

    // Selector de modo: prompt | switch
    const modeRow = el('div',{class:'form-row flex items-center gap-2'});
    modeRow.appendChild(el('label',{text:'Modo'}));
    const modeSel = el('select',{id:'choice_mode'});
    ['prompt','switch'].forEach(m=>{ 
      const o=el('option',{value:m,text:m}); 
      if((node.mode||'prompt')===m) { o.selected=true; }
      modeSel.appendChild(o); 
    });
    modeRow.appendChild(modeSel);
    container.appendChild(modeRow);

    // Sección PROMPT: permitir texto libre + textarea de opciones (Label | node o flow#node)
    const promptWrap = el('div',{id:'choice_prompt_wrap'});
    const allowRow = el('div',{class:'form-row flex items-center gap-2'});
    const chk = el('input',{type:'checkbox',id:'choice_allow'}); chk.checked = !!node.allow_free_text; allowRow.appendChild(chk);
    allowRow.appendChild(el('label',{text:'Permitir texto libre'}));
    promptWrap.appendChild(allowRow);
    let optsText='';
    if(Array.isArray(node.options)){
      optsText = node.options.map(o=>{
        const label = o.label || o.i18n?.es?.text || o.i18n?.es?.prompt || '';
        // aceptar shapes target/next
        const tgtObj = o.target || o.next || null;
        const tgtNode = tgtObj?.node_id || '';
        const tgtFlow = tgtObj?.flow_id || '';
        const tgt = tgtFlow ? `${tgtFlow}#${tgtNode||''}` : (tgtNode || '');
        return tgt? `${label} | ${tgt}` : label;
      }).join('\n');
    }
    const taWrap = inputRow({label:'Opciones (Label | flow#node|node opcional)', id:'choice_options', value: optsText, type:'textarea'});
    promptWrap.appendChild(taWrap);
    const ta = taWrap.querySelector('textarea'); if(ta) ta.rows=6;
    container.appendChild(promptWrap);

    // Sección SWITCH: lista de casos {when, target} + default_target
    const switchWrap = el('div',{id:'choice_switch_wrap', style:'display:none'});
    const casesList = el('div',{id:'choice_cases_list'});
    const addCaseBtn = el('button',{type:'button',text:'Añadir caso', class:'mt-2 px-3 py-1 bg-blue-600 text-white rounded text-sm'});
    const flows = Object.keys(window.AppProject?.flows || {});
    function createCaseRow(c, idx){
      const row = el('div',{class:'choice-case-item', 'data-index': String(idx)});
      row.style.cssText='display:flex; flex-direction:column; gap:6px; border:1px solid #eee; padding:8px; border-radius:6px; background:#fff;';
      // When expr
      const whenRow = inputRow({label:`when (expr)`, id:`choice_case_when_${idx}`, value: c?.when || ''});
      row.appendChild(whenRow);
      // Target: flow + node
      const destRow = el('div',{class:'form-row'});
      destRow.appendChild(el('label',{text:'Destino'}));
      const flowSel = el('select',{id:`choice_case_flow_${idx}`});
      flowSel.appendChild(el('option',{value:'',text:'(actual)'}));
      flows.forEach(fid=> flowSel.appendChild(el('option',{value:fid,text:fid})));
      flowSel.value = c?.target?.flow_id || '';
      const nodeSel = el('select',{id:`choice_case_node_${idx}`});
      function refreshNodeSel(){
        const fid = flowSel.value || (window.AppProject?.active_flow_id || '');
        let nodes=[];
        if(fid && window.AppProject?.flows?.[fid]?.nodes) nodes = Object.keys(window.AppProject.flows[fid].nodes);
        else if(window.App?.state?.nodes) nodes = Object.keys(window.App.state.nodes||{});
        const cur = nodeSel.value;
        populateNodeOptions(nodeSel, nodes, node.id);
        const want = c?.target?.node_id || cur || '';
        if(want) nodeSel.value = want;
      }
      refreshNodeSel();
      flowSel.addEventListener('change', refreshNodeSel);
      const goCaseBtn = el('button',{type:'button',text:'Ir al destino'});
      goCaseBtn.className = 'ml-2 px-2 py-1 bg-white border rounded text-sm';
      goCaseBtn.addEventListener('click',()=>{
        try{
          const fid = flowSel.value || (window.AppProject?.active_flow_id || '');
          let nid = nodeSel.value || '';
          if(!fid) return alert('Selecciona un flujo destino (case)');
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
        }catch(e){ console.warn('Ir al destino (choice case) falló', e); }
      });
      destRow.appendChild(el('div',{style:'display:flex; gap:8px; align-items:center;'}, [flowSel, nodeSel, goCaseBtn]));
      row.appendChild(destRow);
      // Controls: up / down / remove
      const ctrl = el('div',{class:'flex gap-2 self-end'});
      const up = el('button',{type:'button',text:'↑', title:'Subir', class:'px-2 py-1 text-xs bg-gray-50 border border-gray-200 rounded'});
      const down = el('button',{type:'button',text:'↓', title:'Bajar', class:'px-2 py-1 text-xs bg-gray-50 border border-gray-200 rounded'});
      const rm = el('button',{type:'button',text:'Eliminar', class:'px-2 py-1 text-xs bg-red-50 border border-red-200 rounded'});
      up.addEventListener('click',()=>{
        const parent = row.parentElement;
        if (!parent) { return; }
        const prev = row.previousElementSibling;
        if (prev) {
          parent.insertBefore(row, prev);
          if (validator && typeof validator.run === 'function') validator.run();
        }
      });
      down.addEventListener('click',()=>{
        const parent = row.parentElement;
        if (!parent) { return; }
        const next = row.nextElementSibling;
        if (next) {
          parent.insertBefore(next, row);
          if (validator && typeof validator.run === 'function') validator.run();
        }
      });
      rm.addEventListener('click',()=>{ row.remove(); if (validator && typeof validator.run === 'function') validator.run(); });
      ctrl.appendChild(up); ctrl.appendChild(down); ctrl.appendChild(rm);
      row.appendChild(ctrl);
      return row;
    }
    // inicializar con casos existentes
    const cases = Array.isArray(node.cases) ? node.cases : [];
    if(cases.length===0 && (node.mode==='switch')) { cases.push({ when:'', target:null }); }
    cases.forEach((c, i)=> casesList.appendChild(createCaseRow(c, i)));
  addCaseBtn.addEventListener('click',()=>{ const idx = (casesList.querySelectorAll('.choice-case-item').length)||0; casesList.appendChild(createCaseRow({when:'',target:null}, idx)); if (validator && typeof validator.run === 'function') validator.run(); });
    switchWrap.appendChild(casesList);
    // default target
    const defRow = el('div',{class:'form-row'});
    defRow.appendChild(el('label',{text:'Default (flujo · nodo)'}));
    const defFlow = el('select',{id:'choice_default_flow'});
    defFlow.appendChild(el('option',{value:'',text:'(actual)'}));
    flows.forEach(fid=> defFlow.appendChild(el('option',{value:fid,text:fid})));
    defFlow.value = node.default_target?.flow_id || '';
    const defNode = el('select',{id:'choice_default_node'});
    function refreshDefNode(){
      const fid = defFlow.value || (window.AppProject?.active_flow_id || '');
      let nodes = [];
      if(fid && window.AppProject?.flows?.[fid]?.nodes) nodes = Object.keys(window.AppProject.flows[fid].nodes);
      else if(window.App?.state?.nodes) nodes = Object.keys(window.App.state.nodes||{});
      const cur = defNode.value;
      populateNodeOptions(defNode, nodes, node.id);
      const want = node.default_target?.node_id || cur || '';
      if(want) defNode.value = want;
    }
    refreshDefNode();
    defFlow.addEventListener('change', refreshDefNode);
    const goDefBtn = el('button',{type:'button',text:'Ir al destino'});
    goDefBtn.className = 'ml-2 px-2 py-1 bg-white border rounded text-sm';
    goDefBtn.addEventListener('click',()=>{
      try{
        const fid = defFlow.value || (window.AppProject?.active_flow_id || '');
        let nid = defNode.value || '';
        if(!fid) return alert('Selecciona un flujo destino (default)');
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
      }catch(e){ console.warn('Ir al destino (choice default) falló', e); }
    });
    defRow.appendChild(el('div',{style:'display:flex; gap:8px; align-items:center;'}, [defFlow, defNode, goDefBtn]));
    switchWrap.appendChild(defRow);
    switchWrap.appendChild(addCaseBtn);
    container.appendChild(switchWrap);

    function toggleSections(){
      const mode = modeSel.value || 'prompt';
      promptWrap.style.display = (mode==='prompt') ? 'block' : 'none';
      switchWrap.style.display = (mode==='switch') ? 'block' : 'none';
    }
    modeSel.addEventListener('change',toggleSections);
    toggleSections();

    function parseOptionLine(line){
      const parts=line.split('|').map(p=>p.trim());
      return { label: parts[0]||'', target: parts[1]||'' };
    }
    const validator = setupValidation(container, {
      boxId:'choice_validation_box',
      okMessage:'✔ Choice válido',
      collectState(){
        const prompt = (container.querySelector('#choice_prompt input,#choice_prompt textarea,#choice_prompt')?.value||'').trim();
        const mode = (container.querySelector('#choice_mode')?.value||'prompt').trim();
        if(mode === 'switch'){
          const rows = Array.from(container.querySelectorAll('.choice-case-item'));
          const list = rows.map(r=>{
            const when = r.querySelector('[id^="choice_case_when_"]')?.value?.trim() || '';
            const f = r.querySelector('select[id^="choice_case_flow_"]')?.value || '';
            const n = r.querySelector('select[id^="choice_case_node_"]')?.value || '';
            return { when, target: (f||n) ? { flow_id: f, node_id: n } : null };
          });
          const df = container.querySelector('#choice_default_flow')?.value || '';
          const dn = container.querySelector('#choice_default_node')?.value || '';
          return { mode, prompt, cases: list, default_target: (df||dn)?{flow_id:df,node_id:dn}:null };
        }
        // prompt
        const allow = !!container.querySelector('#choice_allow')?.checked;
        const rawOpts = (container.querySelector('#choice_options textarea,#choice_options input,#choice_options')?.value || '').split('\n').map(l=>l.trim()).filter(Boolean);
        const parsed = rawOpts.map(parseOptionLine);
        return { mode, prompt, allow, parsed };
      },
      buildRules(st){
        if(st.mode === 'switch'){
          const hasCaseWithTarget = Array.isArray(st.cases) && st.cases.some(c=>c.when && c.target);
          const whens = Array.isArray(st.cases) ? st.cases.map(c=> (c.when||'').trim()).filter(Boolean) : [];
          const dupMap = {};
          whens.forEach(w => { dupMap[w] = (dupMap[w]||0) + 1; });
          const dups = Object.keys(dupMap).filter(k => dupMap[k] > 1);
          const casesWithoutTarget = Array.isArray(st.cases) ? st.cases.filter(c=> (c.when||'').trim() && !c.target).length : 0;
          const hasDefault = !!st.default_target;
          return [
            {kind:'error', when: !st.prompt, msg:'Prompt requerido.'},
            {kind:'error', when: !hasCaseWithTarget && !hasDefault, msg:'Define al menos un caso con destino o un default.'},
            {kind:'warning', when: casesWithoutTarget > 0, msg:`Hay ${casesWithoutTarget} caso(s) con when sin destino.`},
            {kind:'warning', when: dups.length > 0, msg:'Casos duplicados para when: ' + dups.join(', ')},
            {kind:'info', when: !hasDefault, msg:'Sin default: si ningún when coincide, se usará el Next del nodo.'}
          ];
        }
        return [
          {kind:'error', when: !st.prompt, msg:'Prompt requerido.'},
          {kind:'error', when: st.parsed.length===0 && !st.allow, msg:'Debes definir opciones o permitir texto libre.'},
          {kind:'warning', when: st.parsed.some(o=>!o.label), msg:'Alguna opción sin etiqueta.'},
          {kind:'warning', when: st.parsed.filter(o=>o.target).length===0, msg:'Ninguna opción apunta a otro nodo.'},
          {kind:'info', when: st.allow && st.parsed.length===0, msg:'Modo texto libre puro.'}
        ];
      }
    });
    container.querySelectorAll('input,textarea,select,#choice_allow').forEach(el=>{ el.addEventListener('input',validator.run); el.addEventListener('change',validator.run); });
    const result = validator.run();
    markFieldUsed(container.querySelector('.choice-form-slot'));
    document.dispatchEvent(new CustomEvent('renderer:after', { detail: { type:'choice', container, validation: result }}));
  }

  window.RendererRegistry = window.RendererRegistry || {};
  window.RendererRegistry.choice = renderChoice;
})();
