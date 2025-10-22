// set_goto.js - renderer del nodo set_goto
(function(){
  const { adoptTemplate, setupValidation, markFieldUsed } = window.RendererHelpers || {};
  const H = window.FormBuilderHelpers || {};
  const el = H.el || function(tag, attrs={}, children=[]) { const e=document.createElement(tag); if(attrs){ Object.entries(attrs).forEach(([k,v])=>{ if(k==='text') e.textContent=v; else e.setAttribute(k,v); }); } (children||[]).forEach(c=>e.appendChild(c)); return e; };

  function renderSetGoto(node, container, nodeIds){
    container = adoptTemplate(container,'set_goto','set_goto-form-slot');
    const tr = el('div',{class:'form-row'});
    tr.appendChild(el('label',{text:'Punto de retorno'}));
    const targetSel = el('select',{id:'set_goto_target'}); targetSel.appendChild(el('option',{value:'',text:'(ninguno)'}));
    (nodeIds||[]).forEach(nid=>{ if(nid!==node.id) targetSel.appendChild(el('option',{value:nid,text:nid})); });
    if(node.target) targetSel.value = node.target;
    tr.appendChild(targetSel); container.appendChild(tr);

    // Acción de navegación: ir al punto de retorno
    const actions = el('div',{class:'form-row'});
    const goBtn = el('button',{type:'button'}); goBtn.textContent = 'Ir al punto de retorno';
    goBtn.className = 'px-2 py-1 bg-white border rounded text-sm';
    goBtn.addEventListener('click',()=>{
      try{
        const nid = (targetSel.value || '').trim();
        if(!nid) { alert('Selecciona un punto de retorno primero'); return; }
        if (typeof window.App?.selectNode === 'function') {
          window.App.selectNode(nid);
        }
      }catch(e){ console.warn('Navegar al punto de retorno falló', e); }
    });
    actions.appendChild(goBtn); container.appendChild(actions);

    const validator = setupValidation(container, {
      boxId:'set_goto_validation_box',
      okMessage:'✔ Set Goto válido',
      collectState(){
        const t=(targetSel.value||'');
        return {target: t};
      },
      buildRules(st){
        return [
          {kind:'error', when: !st.target, msg:'Punto de retorno requerido.'}
        ];
      }
    });
    [targetSel].forEach(el=>{ if(el){ el.addEventListener('input',validator.run); el.addEventListener('change',validator.run);} });
    const result = validator.run();
    markFieldUsed(container.querySelector('.set_goto-form-slot'));
    document.dispatchEvent(new CustomEvent('renderer:after', { detail: { type:'set_goto', container, validation: result }}));
  }

  window.RendererRegistry = window.RendererRegistry || {};
  window.RendererRegistry.set_goto = renderSetGoto;
})();