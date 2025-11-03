// renderer_credential_profile.js
// Renderizador para el nodo credential_profile (simulador only)
(function(){
  const H = window.FormBuilderHelpers || {};
  const { el, inputRow, jsonEditor } = H;
  
  function renderCredentialProfile(node, container, nodeIds) {
    const props = node.props || {};
    
    // Warning badge
    const warning = el('div', {class:'form-row'});
    warning.style.padding = '12px';
    warning.style.background = '#fef3c7';
    warning.style.border = '1px solid #f59e0b';
    warning.style.borderRadius = '6px';
    warning.style.fontSize = '13px';
    warning.style.color = '#92400e';
    warning.innerHTML = '⚠️ <strong>Solo para simulador</strong> — Este nodo no se exportará. Úsalo solo para pruebas locales con credenciales reales.';
    container.appendChild(warning);
    
    // Profile name
    container.appendChild(inputRow({
      label: 'Nombre del Perfil',
      id: 'cred_profile_name',
      value: props.profile || '',
      placeholder: 'testing-real'
    }));
    
    // Credentials (JSON)
    container.appendChild(jsonEditor({
      label: 'Credenciales (JSON)',
      id: 'cred_credentials',
      value: props.credentials || {
        ai_search: '',
        openai: ''
      }
    }));
    
    // Persistencia opcional en localStorage
    const persistRow = el('div', { class: 'form-row' });
    const persistWrap = el('div', { style: 'display:flex; align-items:center; gap:8px;' });
    const persistChk = el('input', { id:'cred_persist', type:'checkbox' });
    if (props.persist === true || props.persist_to_localstorage === true) persistChk.checked = true;
    const persistLbl = el('label', { for:'cred_persist', text:'Persistir en localStorage (simulador)' });
    persistWrap.appendChild(persistChk); persistWrap.appendChild(persistLbl);
    persistRow.appendChild(persistWrap);
    container.appendChild(persistRow);

    // Activar tras guardar
    const activateRow = el('div', { class: 'form-row' });
    const activateWrap = el('div', { style: 'display:flex; align-items:center; gap:8px;' });
    const activateChk = el('input', { id:'cred_activate', type:'checkbox' });
    if (props.activate === true) activateChk.checked = true;
    const activateLbl = el('label', { for:'cred_activate', text:'Activar perfil tras guardar' });
    activateWrap.appendChild(activateChk); activateWrap.appendChild(activateLbl);
    activateRow.appendChild(activateWrap);
    container.appendChild(activateRow);

    // Info note
    const note = el('div', {class:'form-row'});
    note.style.fontSize = '11px';
    note.style.color = '#6b7280';
    note.style.marginTop = '8px';
    note.textContent = '🔒 Por defecto, las credenciales se guardan solo en memoria del simulador y no se exportan. Marca "Persistir" si quieres guardarlas en este navegador (localStorage).';
    container.appendChild(note);
  }
  
  // Registrar
  window.RendererRegistry = window.RendererRegistry || {};
  window.RendererRegistry.credential_profile = renderCredentialProfile;
})();
