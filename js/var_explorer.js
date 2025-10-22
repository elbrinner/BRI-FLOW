// var_explorer.js
// Simple modal tree explorer for variable object structures
(function(){
  function shallowType(v){
    if (v === null) { return 'null'; }
    if (Array.isArray(v)) { return 'array'; }
    return typeof v;
  }

  function buildTreeFromObject(obj, prefix=''){
    // returns array of nodes { key, path, type, children? }
    if(obj === undefined || obj === null) return [];
    if(typeof obj !== 'object') return [];
    const out = [];
    function pushArray(arr){
      for(let i=0;i<arr.length;i++){
        const v = arr[i];
        const type = shallowType(v);
        const path = prefix ? (prefix + '.' + i) : String(i);
        const children = (type === 'object' || type === 'array') ? buildTreeFromObject(v, path) : [];
        out.push({ key: String(i), path, type, value: v, children });
      }
    }
    function pushObject(o){
      for(const k of Object.keys(o)){
        const p = prefix ? (prefix + '.' + k) : k;
        const v = o[k];
        const type = shallowType(v);
        const children = (type === 'object' || type === 'array') ? buildTreeFromObject(v, p) : [];
        out.push({ key: k, path: p, type, value: v, children });
      }
    }
    if (Array.isArray(obj)) pushArray(obj); else pushObject(obj);
    return out;
  }

  function getVarDefaultAcrossFlows(rootVarName){
    // from runtime snapshot
    let snapshot = globalThis.App?.runtimeContext?.variables?.[rootVarName];
    let originFlow = '';
    if(snapshot !== undefined) return { snapshot, originFlow: '(runtime)' };
    // from current flow start
    const startId = globalThis.App?.state?.meta?.start_node;
    originFlow = globalThis.App?.state?.flow_id || '';
    snapshot = globalThis.App?.state?.nodes?.[startId]?.variables?.find(v=>v.name===rootVarName)?.defaultValue;
    if(snapshot !== undefined) return { snapshot, originFlow };
    // from other flows
    const flows = globalThis.AppProject?.flows || {};
    for (const fid of Object.keys(flows)){
      const sId = flows[fid]?.meta?.start_node; if(!sId) continue;
      const list = flows[fid]?.nodes?.[sId]?.variables || [];
      const found = list.find(v => v?.name === rootVarName);
      if(found){ return { snapshot: found.defaultValue, originFlow: fid }; }
    }
    return { snapshot: undefined, originFlow: '' };
  }

  function parseJSONIfNeeded(val){
    if (typeof val !== 'string') return val;
    const s = val.trim();
    const couldBeJSON = (s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'));
    if (!couldBeJSON) return val;
    try { return JSON.parse(s); }
    catch(error_){ console.warn('[VarExplorer] JSON parse failed for defaultValue:', error_); return val; }
  }

  function waitForSelectionPromise(instance, getSelected){
    return new Promise((resolve)=>{
      const btn = instance.selectBtn;
      const onClick = function(){ instance.modal.remove(); resolve(getSelected()); btn.removeEventListener('click', onClick); };
      btn.addEventListener('click', onClick);
    });
  }

  function createModal(){
    const modal = document.createElement('div'); modal.className='var-explorer-modal';
    const style = modal.style; style.position='fixed'; style.left='0'; style.top='0'; style.right='0'; style.bottom='0'; style.background='rgba(0,0,0,0.4)'; style.display='flex'; style.alignItems='center'; style.justifyContent='center'; style.zIndex='9999';
    const card = document.createElement('div'); card.style.background='#fff'; card.style.borderRadius='8px'; card.style.width='640px'; card.style.maxHeight='80vh'; card.style.overflow='auto'; card.style.padding='12px'; modal.appendChild(card);
    const header = document.createElement('div'); header.style.display='flex'; header.style.justifyContent='space-between'; header.style.alignItems='center'; header.style.marginBottom='8px';
    const title = document.createElement('div'); title.style.fontWeight='700'; title.textContent = 'Seleccionar propiedad'; header.appendChild(title);
    const close = document.createElement('button'); close.textContent='Cerrar'; close.style.marginLeft='8px'; header.appendChild(close);
    card.appendChild(header);
    const search = document.createElement('input'); search.placeholder='Buscar propiedad...'; search.style.width='100%'; search.style.marginBottom='8px'; card.appendChild(search);
    const treeWrap = document.createElement('div'); card.appendChild(treeWrap);
    const footer = document.createElement('div'); footer.style.display='flex'; footer.style.justifyContent='flex-end'; footer.style.marginTop='8px';
    const selectBtn = document.createElement('button'); selectBtn.textContent='Seleccionar'; selectBtn.disabled = true; selectBtn.style.marginRight='8px';
    const cancelBtn = document.createElement('button'); cancelBtn.textContent='Cancelar';
    footer.appendChild(selectBtn); footer.appendChild(cancelBtn); card.appendChild(footer);

    return { modal, card, header, title, treeWrap, close, search, selectBtn, cancelBtn };
  }

  function renderTree(treeWrap, nodes, onSelect, filter, selectedPathHolder){
    treeWrap.innerHTML='';
    const ul = document.createElement('ul'); ul.style.listStyle='none'; ul.style.paddingLeft='12px';
    function walk(list, parentUl){
      for (const n of list){
        if(filter && !String(n.path).toLowerCase().includes(filter.toLowerCase())) continue;
        const li = document.createElement('li'); li.style.padding='4px 0';
        const label = document.createElement('span'); label.textContent = n.key + ' ('+n.type+')'; label.style.cursor='pointer'; label.style.marginRight='8px';
        li.appendChild(label);
        const pathSpan = document.createElement('code'); pathSpan.textContent = n.path; pathSpan.style.color='#666'; pathSpan.style.fontSize='12px'; li.appendChild(pathSpan);
        // visual selected state
        if (selectedPathHolder && selectedPathHolder.value === n.path) {
          li.style.background = '#e6f4ff';
          li.style.borderRadius = '6px';
        }
        label.addEventListener('click',()=>{ selectedPathHolder.value = n.path; onSelect(n); renderTree(treeWrap, nodes, onSelect, filter, selectedPathHolder); });
        if(n.children?.length){
          const childUl = document.createElement('ul'); childUl.style.listStyle='none'; childUl.style.paddingLeft='12px'; walk(n.children, childUl); li.appendChild(childUl);
        }
        parentUl.appendChild(li);
      }
    }
    walk(nodes, ul);
    treeWrap.appendChild(ul);
  }

  // Public API
  globalThis.VarExplorer = {
    open(rootVarName){
      const { snapshot: rawSnap, originFlow } = getVarDefaultAcrossFlows(rootVarName);
      const snapshot = parseJSONIfNeeded(rawSnap) || {};
      const tree = buildTreeFromObject(snapshot);
      const instance = createModal(); document.body.appendChild(instance.modal);
      if (originFlow){ instance.title.textContent = `Seleccionar propiedad · ${rootVarName} (origen: ${originFlow})`; }
      let selected = null;
      const selectedHolder = { value: null };
      function updateSelection(n){ selected = n; selectedHolder.value = n?.path || null; instance.selectBtn.disabled = !selected; }
      renderTree(instance.treeWrap, tree, updateSelection, null, selectedHolder);
      instance.search.addEventListener('input', ()=>{ renderTree(instance.treeWrap, tree, updateSelection, instance.search.value, selectedHolder); });
      instance.close.addEventListener('click', ()=>{ instance.modal.remove(); });
      instance.cancelBtn.addEventListener('click', ()=>{ instance.modal.remove(); });
      return {
        waitForSelection: function(){
          return waitForSelectionPromise(instance, () => selected || null);
        },
        // expose a way to get current selected path without closing
        _getSelectedPath: () => selectedHolder.value
      };
    }
  };
})();
