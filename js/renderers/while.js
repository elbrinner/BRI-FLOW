// while.js - simple renderer for while loops
(function(){
  const { adoptTemplate, setupValidation, markFieldUsed } = window.RendererHelpers || {};
  const H = window.FormBuilderHelpers || {};
  const inputRow = H.inputRow || function(){ return document.createElement('div'); };
  const el = H.el || function(tag, attrs={}, children=[]){ const e=document.createElement(tag); Object.entries(attrs||{}).forEach(([k,v])=>{ if(k==='text') e.textContent=v; else e.setAttribute(k,v); }); (children||[]).forEach(c=>e.appendChild(c)); return e; };

  function renderWhile(node, container, nodeIds){
    container = adoptTemplate(container, 'loop', 'loop-form-slot');
  // Only show condition and optional max iterations
  // use ids expected by formbuilder: loop_cond and loop_max
  container.appendChild(inputRow({ label: 'condición (expr)', id: 'loop_cond', value: node.cond || node.condExpr || '', placeholder: 'i < 10' }));
  container.appendChild(inputRow({ label: 'Máx iteraciones (opcional)', id: 'loop_max', value: node.max_iterations != null ? String(node.max_iterations) : '', placeholder: '50' }));

  const innerRow = el('div',{class:'form-row'});
  innerRow.appendChild(el('label',{text:'Nodo interno (body)'}));
  const innerSel = el('select',{id:'loop_body'}); innerSel.appendChild(el('option',{value:'',text:'(ninguno)'}));
  (nodeIds||[]).forEach(nid=>{ if(nid!==node.id) innerSel.appendChild(el('option',{value:nid,text:nid})); });
  if(node.body_start?.node_id) innerSel.value = node.body_start.node_id;
  innerSel.addEventListener('change', function(ev){ const v = ev?.target?.value || ''; node.body_start = v ? { flow_id:'', node_id:v } : null; });
  innerRow.appendChild(innerSel); container.appendChild(innerRow);

  const validator = setupValidation(container, { boxId:'loop_validation_box', okMessage:'✔ While válido', collectState:()=>({cond: container.querySelector('#loop_cond input, #loop_cond textarea, #loop_cond, #loop_index_or_cond input, #loop_index_or_cond textarea, #loop_index_or_cond')?.value||''}), buildRules: st=> [{kind:'error', when:!st.cond, msg:'Debes definir condición.'}] });
    const validationResult = validator.run();
    markFieldUsed(container.querySelector('.loop-form-slot'));
    document.dispatchEvent(new CustomEvent('renderer:after', { detail: { type:'while', container, validation: validationResult }}));
  }

  window.RendererRegistry = window.RendererRegistry || {};
  window.RendererRegistry.while = renderWhile;
})();
