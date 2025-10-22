// rest_call.js - renderer extraído
(function(){
  const { safe, applyRuleSet, extractPaths, parseJson, adoptTemplate, markFieldUsed } = window.RendererHelpers || {};
  const { renderValidation } = window.ValidationHelpers || {};
  const H = window.FormBuilderHelpers || {};
  const inputRow = H.inputRow || function(){ return document.createElement('div'); };
  const jsonEditor = H.jsonEditor || function(){ return document.createElement('div'); };
  const el = H.el || function(tag, attrs={}, children=[]){ const e=document.createElement(tag); (children||[]).forEach(c=>e.appendChild(c)); return e; };
  const showToast = window.RendererHelpers?.showToast || function(){};

  // Simple util para crear modales reutilizable (parte del paso 3)
  function createModal({title, bodyEl, actions=[]}){
    const backdrop = el('div',{class:'rc-modal-backdrop'});
    Object.assign(backdrop.style,{position:'fixed',inset:'0',background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999});
    const box = el('div',{class:'rc-modal',style:'background:#fff;padding:16px;border-radius:10px;max-width:520px;width:92%;box-shadow:0 6px 20px rgba(0,0,0,0.15);'});
    box.appendChild(el('h3',{text:title||'Modal',class:'text-sm font-semibold mb-3'}));
    if(bodyEl) box.appendChild(bodyEl);
    const footer = el('div',{class:'mt-4 flex justify-end gap-2'});
    actions.forEach(a=>{
      const btn = el('button',{type:'button',text:a.text||'Ok',class:a.class||'px-3 py-1 rounded bg-blue-600 text-white text-sm'});
      btn.addEventListener('click',()=>{
        if(a.onClick) a.onClick({close});
        if(!a.persistent) close();
      });
      footer.appendChild(btn);
    });
    box.appendChild(footer);
    function close(){ backdrop.remove(); }
    backdrop.appendChild(box);
    document.body.appendChild(backdrop);
    return { close };
  }
  window.UIHelpers = window.UIHelpers || {}; if(!window.UIHelpers.createModal) window.UIHelpers.createModal = createModal;

  function openEditVariableModal(varObj, onSave){
    const body = el('div',{});
    const nameLbl = el('label',{text:'Nombre'}); const nameInp = el('input',{type:'text',value:varObj.name||''}); nameInp.style.width='100%';
    const defLbl = el('label',{text:'Valor por defecto'}); const defInp = el('input',{type:'text',value:varObj.defaultValue||''}); defInp.style.width='100%';
    const listWrap = el('div',{class:'flex items-center gap-2 mt-2'}); const listChk = el('input',{type:'checkbox'}); listChk.checked=!!varObj.isList; listWrap.appendChild(listChk); listWrap.appendChild(el('span',{text:'Es lista (isList)'}));
    body.appendChild(nameLbl); body.appendChild(nameInp); body.appendChild(defLbl); body.appendChild(defInp); body.appendChild(listWrap);
    createModal({
      title:'Editar variable',
      bodyEl: body,
      actions:[
        {text:'Cancelar',class:'px-3 py-1 rounded bg-gray-100 text-sm',onClick:()=>{},persistent:false},
        {text:'Guardar',class:'px-3 py-1 rounded bg-blue-600 text-white text-sm',onClick:()=>{
          const newName=(nameInp.value||'').trim(); if(!newName) return alert('Nombre requerido');
          varObj.name=newName; varObj.defaultValue=defInp.value||''; varObj.isList=!!listChk.checked; if(typeof onSave==='function') onSave(varObj);
        }}
      ]
    });
  }

  function renderRestCall(node, container){
    container = adoptTemplate(container,'rest_call','rest_call-form-slot');
    const props = node.properties || {};
    const methodRow = el('div',{class:'form-row'}); methodRow.appendChild(el('label',{text:'Método'}));
    const methodSel = el('select',{id:'rest_method'});
    ['GET','POST','PUT','PATCH','DELETE'].forEach(m=>{
      const o=el('option',{value:m,text:m});
      if((props.method||node.method||'GET').toUpperCase()===m){ o.selected=true; }
      methodSel.appendChild(o);
    });
    methodRow.appendChild(methodSel); container.appendChild(methodRow);

    container.appendChild(inputRow({label:'URL',id:'rest_url',value:props.url||node.url||'',placeholder:'puedes usar {{variables}}'}));
    const headersEditor = jsonEditor({label:'Headers (obj JSON)',id:'rest_headers',value:props.headers||node.headers||{}}); container.appendChild(headersEditor);
  const bodyEditor = jsonEditor({label:'Body (JSON) - opcional',id:'rest_body',value:props.body||node.body||{}}); bodyEditor.id='rest_body_row'; container.appendChild(bodyEditor);
    safe(()=>{ const hdrTa=headersEditor.querySelector('textarea'); if(hdrTa){ hdrTa.rows=4; hdrTa.style.minHeight='96px'; hdrTa.style.resize='vertical'; hdrTa.style.width='100%'; } const bTa=bodyEditor.querySelector('textarea'); if(bTa){ bTa.rows=8; bTa.style.minHeight='160px'; bTa.style.resize='vertical'; bTa.style.width='100%'; } },'rest sizing');
  // Save path eliminado: por diseño vamos a guardar la respuesta completa (o body) en save_as

    const mappingsForEditor = (Array.isArray(node.mappings)? node.mappings.map(m=>({name:m.target||m.name||'',path:m.source||m.path||'',type:m.type||''})):[]);
    if(typeof H.mappingsEditor==='function') container.appendChild(H.mappingsEditor({label:'Mappings (opcional)',id:'rest_mappings',mappings:mappingsForEditor}));
    else container.appendChild(jsonEditor({label:'Mappings (array)',id:'rest_mappings',value:mappingsForEditor}));

    const helperArea = el('div',{class:'form-row mt-2'});
    helperArea.appendChild(el('label',{text:'Ayuda / Acciones'}));
  const inner=el('div',{class:'flex flex-col gap-2'});
    const addCt=el('button',{type:'button',text:'Añadir Content-Type: application/json',class:'px-2 py-1 text-xs rounded bg-slate-100 border'});
    addCt.addEventListener('click',()=>{
      const ta=container.querySelector('#rest_headers');
      if(!ta){ alert('Headers editor no disponible'); return; }
      let hdrs=parseJson(ta.value||'{}',{});
      if(!hdrs['Content-Type']) hdrs['Content-Type']='application/json';
      ta.value=JSON.stringify(hdrs,null,2);
      ta.dispatchEvent(new Event('input',{bubbles:true}));
      showToast('Header añadido');
    });
    inner.appendChild(addCt); helperArea.appendChild(inner); container.appendChild(helperArea);

    const sampleRow=el('div',{class:'form-row'});
    sampleRow.appendChild(el('label',{text:'Sample response (JSON)'}));
    const sampleTa=el('textarea',{id:'rest_sample_response'}); Object.assign(sampleTa,{rows:6}); sampleTa.style.width='100%'; sampleTa.placeholder='{ "id":1 }'; sampleRow.appendChild(sampleTa);
    const inferBtn=el('button',{type:'button',text:'Inferir mappings',class:'mt-2 px-3 py-1 bg-blue-600 text-white rounded text-sm'});
    sampleRow.appendChild(inferBtn); container.appendChild(sampleRow);

    // Mock controls (solo simulador)
    const mockModeRow = el('div',{class:'form-row'});
    mockModeRow.appendChild(el('label',{text:'Modo mock (simulador)'}));
    const mockModeSel = el('select',{id:'rest_mock_mode'});
    const modes = [
      {v:'off', t:'Desactivado'},
      {v:'fallback', t:'Fallback si falla'},
      {v:'always', t:'Siempre usar mock'}
    ];
    const currentMode = (node.mock_mode || props.mock_mode || 'off');
  modes.forEach(m=>{ const o=el('option',{value:m.v,text:m.t}); if(currentMode===m.v){ o.selected=true; } mockModeSel.appendChild(o); });
    mockModeRow.appendChild(mockModeSel); container.appendChild(mockModeRow);

    const mockEditor = jsonEditor({label:'Mock response (JSON) — solo simulador', id:'rest_mock', value: props.mock || node.mock || {}});
    container.appendChild(mockEditor);
    safe(()=>{ const ta=mockEditor.querySelector('textarea'); if(ta){ ta.rows=6; ta.style.minHeight='120px'; ta.style.resize='vertical'; ta.style.width='100%'; } }, 'mock sizing');

    container.appendChild(inputRow({label:'Guardar como (save_as)',id:'rest_save_as',value:node.save_as||''}));
    const rs=container.querySelector('#rest_save_as input,#rest_save_as'); if(rs && H.attachVarAutocomplete) H.attachVarAutocomplete(rs,{format:'mustache'});
    const urlInp=container.querySelector('#rest_url input,#rest_url'); if(urlInp && H.attachVarAutocomplete) H.attachVarAutocomplete(urlInp,{format:'mustache'});

    const validationBox=el('div',{class:'mt-2 p-2 border rounded text-sm bg-gray-50',id:'rest_validation_box'}); container.appendChild(validationBox);

    function readMappings(){
      let mappings=[]; safe(()=>{ const mapsC=container.querySelector('#rest_mappings_container'); if(mapsC){ const row=mapsC.closest('.form-row'); if(row?.getValue) mappings=row.getValue(); } else { const raw=container.querySelector('#rest_mappings textarea,#rest_mappings')?.value||'[]'; mappings=parseJson(raw,[]); } },'readMappings'); return mappings;
    }
    function markMappingsWarnings(mappings){
      const items=container.querySelectorAll('#rest_mappings_container .mapping-item');
      items.forEach(it=>{
        const ni=it.querySelector('input[data-field="name"]');
        if(ni) ni.classList.remove('field-warning');
        const ex=it.querySelector('.create-mapping-var-btn');
        if(ex) ex.remove();
        const editBtn=it.querySelector('.edit-mapping-var-btn');
        if(editBtn) editBtn.remove();
      });
      const startId=window.App?.state?.meta?.start_node; const startVars=(startId && Array.isArray(window.App?.state?.nodes?.[startId]?.variables))? window.App.state.nodes[startId].variables.map(v=>v.name):[];
      mappings.forEach((m,i)=>{
        const name=(m.name||'').trim();
        if(!name) return;
        const exists = startVars.includes(name);
        if(!exists){
          const item=container.querySelector(`#rest_mappings_container .mapping-item[data-index="${i}"]`)||container.querySelectorAll('#rest_mappings_container .mapping-item')[i];
          if(item){
            const ni=item.querySelector('input[data-field="name"]');
            if(ni){
              ni.classList.add('field-warning');
              if(!item.querySelector('.create-mapping-var-btn')){
                const btn=el('button',{type:'button',text:'Crear var',class:'create-mapping-var-btn ml-2 px-2 py-0.5 text-xs rounded bg-amber-100 border'});
                function handleCreateVarClick(){
                  try {
                    if(!startId) throw new Error('Start node no definido');
                    const vars=window.App.state.nodes[startId].variables=window.App.state.nodes[startId].variables||[];
                    let existing=vars.find(v=>v.name===name);
                    if(!existing){ existing={name,defaultValue:'',isList:false}; vars.push(existing); }
                    const saveAs=container.querySelector('#rest_save_as input,#rest_save_as');
                    if(saveAs && !saveAs.value){ saveAs.value=name; saveAs.dispatchEvent(new Event('input',{bubbles:true})); }
                    if(typeof renderGlobalVars==='function') renderGlobalVars(container);
                    openEditVariableModal(existing,()=>{
                      if(typeof renderGlobalVars==='function') renderGlobalVars(container);
                      runValidationRest();
                      showToast('Variable '+name+' creada');
                    });
                  } catch(e){ alert('No se pudo crear variable: '+e.message); }
                }
                btn.addEventListener('click',handleCreateVarClick);
                ni.parentNode.appendChild(btn);
              }
            }
          }
        } else { // Variable ya existe -> ofrecer botón para editar
          const item=container.querySelector(`#rest_mappings_container .mapping-item[data-index="${i}"]`)||container.querySelectorAll('#rest_mappings_container .mapping-item')[i];
          if(item && !item.querySelector('.edit-mapping-var-btn')){
            const ni=item.querySelector('input[data-field="name"]');
            const edit=el('button',{type:'button',text:'Editar var',class:'edit-mapping-var-btn ml-2 px-2 py-0.5 text-xs rounded bg-blue-100 border'});
            edit.addEventListener('click',()=>{
              try {
                if(!startId) throw new Error('Start node no definido');
                const vars=window.App.state.nodes[startId].variables=window.App.state.nodes[startId].variables||[];
                const existing=vars.find(v=>v.name===name);
                if(!existing) { alert('Variable no encontrada'); return; }
                openEditVariableModal(existing,()=>{
                  if(typeof renderGlobalVars==='function') renderGlobalVars(container);
                  runValidationRest();
                  showToast('Variable '+name+' actualizada');
                });
              } catch(e){ alert('No se pudo editar variable: '+e.message); }
            });
            if(ni) ni.parentNode.appendChild(edit); else item.appendChild(edit);
          }
        }
      });
    }

    function buildRules({method,urlVal,saveAsVal,bodyObj,mappings}){
      const rules=[
        {kind:'error',when:(!urlVal) && ((container.querySelector('#rest_mock_mode')?.value||'off')!=='always'),msg:'URL requerida',field:'#rest_url'},
        {kind:'warning',when:!!urlVal && !/^https?:\/\//i.test(urlVal) && !/\{\{.*\}\}/.test(urlVal),msg:'URL sin esquema http/https y sin variables: verificar.',field:'#rest_url'},
        {kind:'warning',when:['POST','PUT','PATCH','DELETE'].includes(method) && !saveAsVal,msg:'Sería recomendable definir save_as para métodos no idempotentes.'},
        {kind:'warning',when:['POST','PUT','PATCH'].includes(method) && (!bodyObj || Object.keys(bodyObj).length===0),msg:'Cuidado: método '+method+' sin body definido.'},
        {kind:'warning',when:mappings && !Array.isArray(mappings),msg:'Mappings no parseables (ignorado)'}
      ];
      // Mock guidance
      const mockMode = container.querySelector('#rest_mock_mode')?.value || 'off';
      const mockRaw = container.querySelector('#rest_mock textarea,#rest_mock')?.value || '';
      try { if (mockMode !== 'off') JSON.parse(mockRaw || '{}'); } catch(e) {
        rules.push({kind:'error',when:true,msg:'Mock JSON inválido', field:'#rest_mock'});
      }
      if (mockMode !== 'off' && !mockRaw.trim()) rules.push({kind:'warning',when:true,msg:'Modo mock activo pero no has definido el JSON', field:'#rest_mock'});
      if(Array.isArray(mappings)){
        mappings.forEach((m,i)=>{ rules.push({kind:'error',when:!m.name,msg:`Mapping #${i+1} sin name`}); rules.push({kind:'warning',when:!!m.name && !m.path,msg:`Mapping #${i+1} sin path`}); });
        rules.push({kind:'warning',when:mappings.length>0 && !saveAsVal,msg:'Si usas mappings, considera definir save_as (estructura base)'});
      }
      return rules;
    }

    function runValidationRest(){
      ['#rest_url','#rest_method','#rest_save_as'].forEach(sel=>container.querySelector(sel)?.classList.remove('field-error','field-warning'));
      const method=(container.querySelector('#rest_method')?.value||'GET').toUpperCase();
      const urlVal=container.querySelector('#rest_url input,#rest_url textarea,#rest_url')?.value?.trim()||'';
      const saveAsVal=container.querySelector('#rest_save_as input,#rest_save_as')?.value?.trim()||'';
  const bodyObj=parseJson(container.querySelector('#rest_body')?.value||'{}',{});
      const mappings=readMappings();
      const result=applyRuleSet(buildRules({method,urlVal,saveAsVal,bodyObj,mappings}),container);
      if(Array.isArray(mappings) && mappings.length) safe(()=>markMappingsWarnings(mappings),'markMappingsWarnings');
      if(renderValidation) renderValidation(result,validationBox,'✔ REST válido');
      return result;
    }

    function toggleBody(){
      const m=(container.querySelector('#rest_method')?.value||'GET').toUpperCase();
  const row=container.querySelector('#rest_body_row');
  if(!row) return;
  row.style.display=['POST','PUT','PATCH','DELETE'].includes(m)?'block':'none';
    }

    methodSel.addEventListener('change',()=>{ toggleBody(); safe(()=>runValidationRest(),'methodChange'); });
    container.querySelectorAll('#rest_method,#rest_url,#rest_save_as,#rest_body,#rest_mock_mode,#rest_mock').forEach(elm=>{
      elm.addEventListener('input',runValidationRest);
      elm.addEventListener('change',runValidationRest);
    });
    function inferMappingsFromSample(){
      try {
        const raw=sampleTa.value||'';
        if(!raw.trim()) { alert('Pega sample JSON'); return; }
        const parsed=JSON.parse(raw);
        let keys=[];
        if(Array.isArray(parsed)){
          if(!parsed.length){ alert('Array vacío'); return; }
          const sampleItems=parsed.slice(0,3);
          const agg=new Set();
          function collectPathsFromItem(it){ extractPaths(it,3).forEach(p=>agg.add(p)); }
          sampleItems.forEach(collectPathsFromItem);
          keys=Array.from(agg);
        } else if(typeof parsed==='object' && parsed!==null){
          keys=extractPaths(parsed,4);
        } else {
          alert('Formato no soportado'); return;
        }
        keys=Array.from(new Set(keys)).filter(Boolean);
        if(!keys.length){ alert('Sin claves'); return; }
        const mapsC=container.querySelector('#rest_mappings_container');
        if(mapsC){
          const addBtn=Array.from(mapsC.querySelectorAll('button')).find(b=>(b.textContent||'').toLowerCase().includes('añadir'));
          keys.forEach(k=>{
            if(addBtn) addBtn.click();
            const items=mapsC.querySelectorAll('.mapping-item');
            const last=items[items.length-1];
            if(last){
              const ni=last.querySelector('input[data-field="name"]');
              const pi=last.querySelector('input[data-field="path"]');
              const suggested=k.replace(/\[0\]/g,'').split('.').slice(-1)[0];
              if(ni){ ni.value=suggested; ni.dispatchEvent(new Event('input',{bubbles:true})); }
              if(pi){ pi.value=k; pi.dispatchEvent(new Event('input',{bubbles:true})); }
            }
          });
        } else {
          const rawTa=container.querySelector('#rest_mappings');
          let current=parseJson(rawTa.value||'[]',[]);
            keys.forEach(k=>current.push({name:k,path:k,type:''}));
          rawTa.value=JSON.stringify(current,null,2);
          rawTa.dispatchEvent(new Event('input',{bubbles:true}));
        }
        runValidationRest();
        showToast('Mappings inferidos: '+keys.join(', '));
      } catch(e){
        alert('Error infiriendo: '+(e.message||e));
      }
    }
    inferBtn.addEventListener('click',inferMappingsFromSample);

    toggleBody();
    const validation = runValidationRest();
    // Instrumentación uso de campo principal
    markFieldUsed(container.querySelector('.rest_call-form-slot'));
    // Disparar evento renderer:after para seguimiento global
    try { window.dispatchEvent(new CustomEvent('renderer:after',{ detail:{ type:'rest_call', container, validation } })); } catch(e){}
  }

  window.RendererRegistry = window.RendererRegistry || {};
  window.RendererRegistry.rest_call = renderRestCall;
})();
