// renderer_use_profile.js
// Renderizador para el nodo use_profile (exportable)
(function(){
  const H = window.FormBuilderHelpers || {};
  const { el, inputRow } = H;
  
  function renderUseProfile(node, container, nodeIds) {
    const props = node.props || {};
    
    // Profile name
    const row = inputRow({
      label: 'Perfil de Credenciales',
      id: 'use_profile_name',
      value: props.profile || '',
      placeholder: 'Nombre del perfil (ej: prod, staging, dev)'
    });
    container.appendChild(row);
    // Adjuntar datalist para sugerencias
    const datalist = el('datalist', { id: 'credential_profile_suggestions' });
    container.appendChild(datalist);
    try {
      const input = row.querySelector('#use_profile_name');
      if (input) input.setAttribute('list', 'credential_profile_suggestions');
    } catch(_e) {}
    // Botón para cargar perfiles desde backend (best-effort)
    const actions = el('div', { class: 'form-row', style: 'display:flex; gap:8px; align-items:center;' });
    const btn = el('button', { type: 'button', text: 'Cargar perfiles del backend' });
    btn.className = 'px-3 py-1 bg-white border rounded text-sm';
    const status = el('span', { text: '' }); status.style.fontSize = '12px'; status.style.color = '#6b7280';
    actions.appendChild(btn); actions.appendChild(status);
    container.appendChild(actions);

    async function loadProfilesFrom(url){
      try{
        const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
        if(!res.ok) return null;
        const data = await res.json();
        // Admite formatos: ["prod","staging"] o [{name:"prod"},{profile:"staging"}]
        const names = Array.isArray(data) ? data.map(x => (typeof x === 'string') ? x : (x?.name || x?.profile || '')).filter(Boolean) : [];
        return names.length ? names : null;
      }catch(_e){ return null; }
    }
    async function handleLoad(){
      status.textContent = 'Cargando…';
      // Intentar varias rutas conocidas
      const candidates = ['/api/chat/credential-profiles', '/api/credentials/profiles', '/api/chat/profiles'];
      let list = null;
      for (const u of candidates){ list = await loadProfilesFrom(u); if (list) break; }
      if (!list && Array.isArray(window.SIM_CREDENTIAL_PROFILES)) {
        try { list = Object.keys(window.SIM_CREDENTIAL_PROFILES); } catch(_e) {}
      }
      if (!list) { status.textContent = 'No disponible'; return; }
      // Poblar datalist
      datalist.innerHTML = '';
      list.forEach(name => { datalist.appendChild(el('option', { value: name })); });
      status.textContent = `Cargados ${list.length}`;
      // Autoseleccionar primero si input vacío
      try{
        const input = row.querySelector('#use_profile_name');
        if (input && !input.value && list.length) input.value = list[0];
      }catch(_e){}
    }
  btn.addEventListener('click', handleLoad);
    
    // Info note
    const note = el('div', {class:'form-row'});
    note.style.fontSize = '12px';
    note.style.color = '#6b7280';
    note.style.padding = '8px';
    note.style.background = '#f3f4f6';
    note.style.borderRadius = '4px';
    note.textContent = 'ℹ️ Este nodo establece el perfil activo para los nodos siguientes. Se exporta tal cual (solo nombre, sin valores).';
    container.appendChild(note);
  }
  
  // Registrar
  window.RendererRegistry = window.RendererRegistry || {};
  window.RendererRegistry.use_profile = renderUseProfile;
})();
