// var_explorer.js
// Simple modal tree explorer for variable object structures
(function(){
  let stylesInjected = false;
  function injectStyles(){
    if (stylesInjected) return; stylesInjected = true;
    const css = `
      .ve-tree { padding: 0; margin: 0; }
      .ve-tree ul { list-style: none; margin: 0; padding-left: 14px; border-left: 1px dashed #e5e7eb; }
      .ve-item { padding: 2px 4px; border-radius: 6px; }
      .ve-item:hover { background: #f8fafc; }
      .ve-item.selected { background: #e6f4ff; }
      .ve-row { display: inline-flex; align-items: center; gap: 8px; cursor: pointer; }
      .ve-toggle { width: 16px; height: 16px; display: inline-flex; align-items: center; justify-content: center; font-size: 10px; border: 1px solid #cbd5e1; color:#334155; border-radius: 4px; background: #fff; }
      .ve-toggle[aria-hidden="true"] { visibility: hidden; }
      .ve-label { font-weight: 600; }
      .ve-type { font-size: 11px; padding: 2px 6px; border-radius: 999px; background: #eef2ff; color:#3730a3; }
      .ve-path { color: #64748b; font-size: 11px; margin-left: 6px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, "Roboto Mono", monospace; }
    `;
    const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
  }
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
    const card = document.createElement('div');
    card.style.background='#fff';
    card.style.borderRadius='10px';
    card.style.width='720px';
    card.style.maxWidth='90vw';
    card.style.maxHeight='80vh';
    card.style.overflow='hidden';
    card.style.padding='12px';
    card.style.boxShadow='0 12px 40px rgba(2,6,23,0.35)';
    card.style.border='1px solid #e5e7eb';
    modal.appendChild(card);
    const header = document.createElement('div'); header.style.display='flex'; header.style.justifyContent='space-between'; header.style.alignItems='center'; header.style.marginBottom='8px';
    const title = document.createElement('div'); title.style.fontWeight='700'; title.style.fontSize='14px'; title.textContent = 'Seleccionar propiedad'; header.appendChild(title);
    const close = document.createElement('button'); close.textContent='✕'; close.style.marginLeft='8px'; close.style.border='1px solid #e5e7eb'; close.style.background='#fff'; close.style.borderRadius='6px'; close.style.padding='2px 8px'; header.appendChild(close);
    card.appendChild(header);
    const search = document.createElement('input'); search.placeholder='Buscar propiedad...'; search.style.width='100%'; search.style.marginBottom='8px'; search.style.border='1px solid #d1d5db'; search.style.borderRadius='6px'; search.style.padding='6px 8px'; card.appendChild(search);
    const treeWrap = document.createElement('div'); treeWrap.style.maxHeight='62vh'; treeWrap.style.overflow='auto'; treeWrap.style.border='1px solid #eef2f7'; treeWrap.style.borderRadius='8px'; treeWrap.style.padding='8px'; card.appendChild(treeWrap);
    const footer = document.createElement('div'); footer.style.display='flex'; footer.style.justifyContent='flex-end'; footer.style.marginTop='8px';
    const selectBtn = document.createElement('button'); selectBtn.textContent='Seleccionar'; selectBtn.disabled = true; selectBtn.style.marginRight='8px'; selectBtn.style.border='1px solid #d1d5db'; selectBtn.style.borderRadius='6px'; selectBtn.style.padding='6px 10px';
    const cancelBtn = document.createElement('button'); cancelBtn.textContent='Cancelar'; cancelBtn.style.border='1px solid #d1d5db'; cancelBtn.style.borderRadius='6px'; cancelBtn.style.padding='6px 10px';
    footer.appendChild(selectBtn); footer.appendChild(cancelBtn); card.appendChild(footer);

    return { modal, card, header, title, treeWrap, close, search, selectBtn, cancelBtn };
  }

  function renderTree(treeWrap, nodes, onSelect, filter, selectedPathHolder, selectBtn, expandState){
    treeWrap.innerHTML='';
    injectStyles();
    const ul = document.createElement('ul'); ul.className='ve-tree';

    function nodeMatches(n, q){
      if (!q) return true;
      const txt = (n.path + ' ' + n.key + ' ' + n.type).toLowerCase();
      if (txt.includes(q.toLowerCase())) return true;
      if (!n.children) return false;
      return n.children.some(c => nodeMatches(c, q));
    }

    function walk(list, parentUl, depth){
      for (const n of list){
        if (filter && !nodeMatches(n, filter)) continue;
        const li = document.createElement('li'); li.className='ve-item';
        if (selectedPathHolder && selectedPathHolder.value === n.path) li.classList.add('selected');
        const row = document.createElement('div'); row.className='ve-row';
        const isBranch = !!(n.children && n.children.length);
        const toggle = document.createElement('span'); toggle.className='ve-toggle';
        if (!isBranch) toggle.setAttribute('aria-hidden','true');
        const keySpan = document.createElement('span'); keySpan.className='ve-label'; keySpan.textContent = n.key;
        const typeBadge = document.createElement('span'); typeBadge.className='ve-type'; typeBadge.textContent = n.type;
        const pathSpan = document.createElement('span'); pathSpan.className='ve-path'; pathSpan.textContent = n.path;
        row.appendChild(toggle); row.appendChild(keySpan); row.appendChild(typeBadge); row.appendChild(pathSpan);
        li.appendChild(row);

        let expanded = true; // abrir por defecto
        if (isBranch){
          const k = n.path || ('@root:'+n.key+':'+depth);
          // Expand first level or when searching/matching
          if (expandState && expandState.has(k)) expanded = !!expandState.get(k);
          else if (filter){ expanded = true; }
          else { expanded = true; }

          toggle.textContent = expanded ? '▾' : '▸';
          toggle.addEventListener('click', (ev)=>{ ev.stopPropagation(); const cur=!expanded; expanded = cur; if(expandState) expandState.set(k,cur); toggle.textContent = cur ? '▾' : '▸'; childrenWrap.style.display = cur ? '' : 'none'; });
        }

        const choose = ()=>{ selectedPathHolder.value = n.path; onSelect(n); if (selectBtn) try{ selectBtn.click(); }catch(_){} };
        row.addEventListener('click', choose);

        if (isBranch){
          const childrenWrap = document.createElement('ul'); childrenWrap.style.display = expanded ? '' : 'none';
          walk(n.children, childrenWrap, depth+1); li.appendChild(childrenWrap);
        }
        parentUl.appendChild(li);
      }
    }
    walk(nodes, ul, 0);
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
  const expandState = new Map();
  renderTree(instance.treeWrap, tree, updateSelection, null, selectedHolder, instance.selectBtn, expandState);
  instance.search.addEventListener('input', ()=>{ renderTree(instance.treeWrap, tree, updateSelection, instance.search.value, selectedHolder, instance.selectBtn, expandState); });
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
