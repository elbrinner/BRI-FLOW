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
    
    // Info note
    const note = el('div', {class:'form-row'});
    note.style.fontSize = '11px';
    note.style.color = '#6b7280';
    note.style.marginTop = '8px';
    note.textContent = '🔒 Valores guardados solo en memoria del simulador. No usar localStorage. Auto-eliminado al exportar.';
    container.appendChild(note);
  }
  
  // Registrar
  window.RendererRegistry = window.RendererRegistry || {};
  window.RendererRegistry.credential_profile = renderCredentialProfile;
})();
