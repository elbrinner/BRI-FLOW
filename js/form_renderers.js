    // showToast ahora proviene de RendererHelpers.showToast
  const showToast = window.RendererHelpers?.showToast || function(){};
// form_renderers.js
// Define los renderizadores por tipo y se apoyan en FormBuilderHelpers expuestos por formbuilder.js
(function(){
  // Reusar helpers centralizados
  const { safe } = window.RendererHelpers || {};
  safe(()=>console.debug('[FormRenderers] cargado'),'bootstrap');
  const H = window.FormBuilderHelpers || {};
  // getHostValue ya no se usa tras extracción de REST / Loop

  // small helpers to get functions from helpers safely
  // arrayRow no usado tras extracción de response
  const jsonEditor = H.jsonEditor || function(){ return document.createElement('div'); };
  // fieldsEditor ya no se usa aquí tras modularización
  const el = H.el || function(tag, attrs={}, children=[]){ const e=document.createElement(tag); (children||[]).forEach(c=>e.appendChild(c)); return e; };

  // renderValidation centralizado en módulos específicos

  // Helper genérico para inyectar un template externo si existe.
  // Convención: id del template = panel-<type>-template (ej: panel-input-template)
  // slotClass permite ubicar el contenedor interno donde se insertarán los campos dinámicos
  // adoptTemplate proviene de RendererHelpers (common.js)

  // renderResponse extraído a módulo externo

  // adaptive_card eliminado (sin usos detectados en flujos actuales)

  // renderButton extraído a módulo externo


  // Alias de tipos (normalización)
  const aliasMap = { 'rest-call':'rest_call', 'restcall':'rest_call' };

  function getRenderer(type){
    const t = aliasMap[type] || type;
    // Buscar primero en registro modular
    if(window.RendererRegistry?.[t]) {
      return window.RendererRegistry[t];
    }
    // Casos especiales inline
    if(t==='hidden_response') return window.RendererRegistry?.hidden_response || null;
    return null; // fallback permitirá JSON libre
  }

  const FormRenderers = {
    renderFor: function(node, container, nodeIds = []) {
  container.innerHTML = '';
      if(!H) {
        container.appendChild(el('div',{},[document.createTextNode('Form builders helpers no disponibles')]));
        return;
      }
      // Normalize node type to avoid small mismatches (rest_call vs rest-call etc.)
  const lookupType = (node.type||'').toString().trim();
  const fn = getRenderer(lookupType);
      if(fn) {
        const ok = safe(()=>{ fn(node, container, nodeIds); return true; },'renderer:'+lookupType);
        if(!ok) container.appendChild(el('div',{class:'form-row text-red-600'},[document.createTextNode('Error renderizando propiedades')]));
        safe(()=>console.debug('[FormRenderers] renderFor: renderizado de', node.type),'renderFor-debug');
        safe(()=>{ if (typeof renderGlobalVars === 'function') renderGlobalVars(container); },'renderGlobalVars-post');
      } else {
        // fallback: show raw props or properties (imported flows may use 'properties')
        container.appendChild(jsonEditor({label:'Props (JSON libre)', id:'props_raw', value: node.props || node.properties || {}}));
      }
      // Agregar campo descripcion común a todos los nodos
      const descRow = el('div', { class: 'form-row' });
      descRow.appendChild(el('label', { text: 'Descripción (opcional)' }));
  const descTa = el('textarea', { id: 'node_descripcion', placeholder: 'Describe el propósito de este nodo...' });
  try { descTa.value = node.descripcion || ''; } catch(e) { descTa.value = ''; }
      descTa.maxLength = 500;
      descTa.rows = 2;
      descRow.appendChild(descTa);
      const descSmall = el('small', { text: 'Hasta 500 caracteres para documentación.' });
      descSmall.style.fontSize = '11px';
      descSmall.style.color = '#666';
      descRow.appendChild(descSmall);
      container.appendChild(descRow);
      // Hook para lectura de valores desde FormBuilder: añadimos un reader local temporal
      // Si FormBuilder.renderPropsFor es quien devuelve el reader final, él también leerá #node_descripcion.
      // Aquí dejamos el textarea en el DOM con el id esperado.
    }
  };
  window.FormRenderers = FormRenderers;
})();
