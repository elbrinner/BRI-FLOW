// foreach.js - simple renderer for foreach loops
(function(){
  const { adoptTemplate, setupValidation, markFieldUsed } = window.RendererHelpers || {};
  const H = window.FormBuilderHelpers || {};
  const el = H.el || function(tag, attrs={}, children=[]){ const e=document.createElement(tag); Object.entries(attrs||{}).forEach(([k,v])=>{ if(k==='text') e.textContent=v; else e.setAttribute(k,v); }); (children||[]).forEach(c=>e.appendChild(c)); return e; };
  const inputRow = H.inputRow || function(){ return document.createElement('div'); };

  function renderForeach(node, container, nodeIds){
  container = adoptTemplate(container, 'loop', 'loop-form-slot');
  // Only show the essential property: source_list and body selector
  // use id 'loop_source_list' to match formbuilder.readLoop expectations
  // Build a row with input + picker button so users can explore variables
  const srcRow = H.el('div', { class: 'form-row' });
  srcRow.appendChild(H.el('label', { text: 'sourceList' }));
  const srcInput = H.el('input', { id: 'loop_source_list', type: 'text' });
  srcInput.value = node.source_list || '';
  srcInput.placeholder = 'context.items';
  srcInput.style.flex = '1';
  srcInput.style.marginRight = '8px';
  // keep node in sync when user types
  srcInput.addEventListener('input', function(ev){
    const v = (typeof (ev?.target?.value) === 'string') ? ev.target.value : srcInput.value;
    node.source_list = v;
  });
  const pickerBtn = H.el('button', { type: 'button', text: 'Elegir...' });
  pickerBtn.className = 'btn-small';
  pickerBtn.addEventListener('click', async () => {
    try {
      // gather candidate root variables from Start node
  const startId = globalThis.App?.state?.meta?.start_node;
  const startNode = startId ? globalThis.App?.state?.nodes?.[startId] : null;
      let candidates = [];
      if (startNode && Array.isArray(startNode.variables)) {
        for (const v of startNode.variables) {
          // prefer declared lists or JSON-ish defaults
          if (v.isList) candidates.push(v.name);
          else if (typeof v.defaultValue === 'string') {
            const s = v.defaultValue.trim();
            if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) candidates.push(v.name);
          } else if (Array.isArray(v.defaultValue) || typeof v.defaultValue === 'object') {
            candidates.push(v.name);
          }
        }
      }
      if (!candidates.length) {
        alert('No se encontraron variables candidatas en Start para explorar.');
        return;
      }
      // If only one candidate, open VarExplorer directly; otherwise prompt to pick root
      let root = candidates[0];
      if (candidates.length > 1) {
        const sel = globalThis.prompt('Selecciona variable raíz:\n' + candidates.map((c,i)=>`${i+1}. ${c}`).join('\n'));
        const idx = Number.parseInt(sel,10);
        if (Number.isNaN(idx) || idx < 1 || idx > candidates.length) return;
        root = candidates[idx-1];
      }
  const inst = globalThis.VarExplorer?.open ? globalThis.VarExplorer.open(root) : null;
      if (!inst) { alert('VarExplorer no disponible'); return; }
      const sel = await inst.waitForSelection();
      if (!sel) return;
      // sel.path is relative to root; final path is root + (sel.path ? '.'+sel.path : '')
      const finalPath = sel.path ? (root + '.' + sel.path) : root;
      // only accept if selected node is an array (list)
      if (sel.type !== 'array') { if (!confirm('La ruta seleccionada no es una lista/array. ¿Usar de todos modos?')) return; }
      srcInput.value = finalPath;
      node.source_list = finalPath;
    } catch(e) { console.warn('picker failed', e); alert('Error al seleccionar variable: ' + e); }
  });
  const wrapper = H.el('div', { style: 'display:flex; gap:8px; align-items:center;' }, []);
  wrapper.appendChild(srcInput); wrapper.appendChild(pickerBtn);
  srcRow.appendChild(wrapper);
  container.appendChild(srcRow);

  // Item and index variable names (expected by formbuilder.readLoop)
  const itemRow = inputRow({ label: 'Nombre del item (item_var)', id: 'loop_item_var', value: node.item_var || 'item', placeholder: 'item' });
  const indexRow = inputRow({ label: 'Nombre del índice (index_var)', id: 'loop_index_var', value: node.index_var || 'index', placeholder: 'index' });
  // keep node in sync when user types (optional)
  const itemInp = itemRow.querySelector('#loop_item_var');
  const indexInp = indexRow.querySelector('#loop_index_var');
  if (itemInp) itemInp.addEventListener('input', ev => { node.item_var = (ev.target?.value || '').trim() || 'item'; });
  if (indexInp) indexInp.addEventListener('input', ev => { node.index_var = (ev.target?.value || '').trim() || 'index'; });
  container.appendChild(itemRow);
  container.appendChild(indexRow);

  const innerRow = el('div',{class:'form-row'});
  innerRow.appendChild(el('label',{text:'Nodo interno (body)'}));
  const innerSel = el('select',{id:'loop_body'}); innerSel.appendChild(el('option',{value:'',text:'(ninguno)'}));
  for (const nid of (nodeIds||[])) { if(nid!==node.id) innerSel.appendChild(el('option',{value:nid,text:nid})); }
  if(node.body_start?.node_id) innerSel.value = node.body_start.node_id;
  innerSel.addEventListener('change', function(ev){ const v = ev?.target?.value || ''; node.body_start = v ? { flow_id:'', node_id:v } : null; });
  innerRow.appendChild(innerSel); container.appendChild(innerRow);

    // validation (basic)
  const validator = setupValidation(container, { boxId:'loop_validation_box', okMessage:'✔ Foreach válido', collectState:()=>({source: container.querySelector('#loop_source_list input, #loop_source_list textarea, #loop_source_list, #loop_source input, #loop_source textarea, #loop_source')?.value||''}), buildRules: st=> [{kind:'error', when:!st.source, msg:'Debes definir sourceList.'}] });
    const validationResult = validator.run();
    markFieldUsed(container.querySelector('.loop-form-slot'));
    document.dispatchEvent(new CustomEvent('renderer:after', { detail: { type:'foreach', container, validation: validationResult }}));
  }

  globalThis.RendererRegistry = globalThis.RendererRegistry || {};
  globalThis.RendererRegistry.foreach = renderForeach;
})();
