// Renderer for debug node (editor)
(function () {
  function renderDebug(node, container, nodeIds) {
    const { adoptTemplate, setupValidation, markFieldUsed } = window.RendererHelpers || {};
    const H = window.FormBuilderHelpers || {};
    const el = H.el || function (tag, attrs = {}, children = []) { const e = document.createElement(tag); (children || []).forEach(c => e.appendChild(c)); return e; };

    container.innerHTML = ''; // Start clean

    // 1. Message (Template) - Primary Field
    container.appendChild(H.inputRow({
      label: 'Contenido (Texto con {{variables}})',
      id: 'debug_message',
      value: node.message || '',
      placeholder: 'Ej:\nHola {{user.name}},\nTu saldo es {{saldo}}',
      type: 'textarea'
    }));

    // 2. Variables / Items List
    const listLabel = el('label', { style: 'display:block; margin-top:12px; font-weight:600; font-size:12px;' }, [document.createTextNode('Variables a Inspeccionar')]);
    container.appendChild(listLabel);

    const itemsContainer = el('div', { class: 'debug-items-list', style: 'margin-bottom:12px; border:1px solid #eee; padding:5px; border-radius:4px;' });
    const items = Array.isArray(node.debug_items) ? node.debug_items : [];

    function renderItems() {
      itemsContainer.innerHTML = '';
      if (items.length === 0) {
        itemsContainer.appendChild(el('div', { style: 'color:#999;font-size:11px;padding:4px;' }, [document.createTextNode('Sin variables. Añade una abajo.')]));
      } else {
        items.forEach((item, idx) => {
          const row = el('div', { style: 'display:flex; gap:5px; margin-bottom:5px; align-items:center;' });

          // Label Input
          const lblInp = el('input', { type: 'text', placeholder: 'Etiqueta', value: item.label || '', style: 'flex:1; border:1px solid #ddd; padding:4px; border-radius:3px; font-size:12px;' });
          lblInp.oninput = (e) => { item.label = e.target.value; };

          // Value Input
          const valWrapper = el('div', { style: 'flex:2; position:relative;' });
          const valInp = el('input', { type: 'text', placeholder: 'Valor ({{var}})', value: item.value || '', style: 'width:100%; border:1px solid #ddd; padding:4px; border-radius:3px; font-size:12px;' });
          valInp.oninput = (e) => { item.value = e.target.value; };
          valWrapper.appendChild(valInp);

          // Expander for Value
          if (H.openExpandedModal) {
            const expBtn = el('button', { type: 'button', text: '⤢', title: 'Expandir', style: 'position:absolute; right:2px; top:2px; height:22px; width:22px; padding:0; background:#f0f0f0; border:1px solid #ccc; cursor:pointer;' });
            expBtn.onclick = () => H.openExpandedModal(valInp);
            valWrapper.appendChild(expBtn);
          }

          // Delete Button
          const delBtn = el('button', { type: 'button', text: '✕', title: 'Borrar', style: 'color:red; cursor:pointer; background:none; border:none; padding:0 5px;' });
          delBtn.onclick = () => { items.splice(idx, 1); navSync(); renderItems(); };

          row.appendChild(lblInp);
          row.appendChild(valWrapper);
          row.appendChild(delBtn);
          itemsContainer.appendChild(row);
        });
      }
    }

    const addBtn = el('button', { type: 'button', text: '+ Añadir Variable', class: 'btn-small', style: 'margin-bottom:10px;' });
    addBtn.onclick = () => { items.push({ label: '', value: '' }); navSync(); renderItems(); };

    container.appendChild(itemsContainer);
    container.appendChild(addBtn);

    // Sync helper
    function navSync() {
      node.debug_items = items;
    }
    renderItems();


    // 3. Save As (Top level convenience)
    container.appendChild(H.inputRow({
      label: 'Guardar Resultado en Contexto (Opcional)',
      id: 'debug_save_as',
      value: node.save_as || '',
      placeholder: 'nombre_variable'
    }));


    // 4. Advanced (Raw Payload)
    const advToggle = el('button', { type: 'button', text: '▶ Opciones Avanzadas (Payload)', style: 'display:block; margin-top:15px; background:none; border:none; color:#007bff; cursor:pointer; font-size:12px; padding:0;' });
    const advBox = el('div', { style: 'display:none; margin-top:10px; border-left:2px solid #ddd; padding-left:10px;' });

    // Payload
    const payloadVal = (typeof node.payload === 'object' && node.payload !== null) ? JSON.stringify(node.payload, null, 2) : (node.payload || '');
    const plRow = H.inputRow({
      label: 'Raw Payload (JSON / Texto / Expr)',
      id: 'debug_payload',
      value: payloadVal,
      placeholder: 'Overwrites items list if set',
      type: 'textarea'
    });
    // Add expander for payload
    setTimeout(() => {
      const ta = plRow.querySelector('textarea');
      if (ta && H.openExpandedModal && ta.parentElement) {
        ta.parentElement.style.position = 'relative';
        const btn = el('button', { type: 'button', text: '⤢', style: 'position:absolute;right:5px;top:28px;z-index:9;background:#eee;border:1px solid #ccc;cursor:pointer;' });
        btn.onclick = () => H.openExpandedModal(ta);
        ta.parentElement.appendChild(btn);
      }
    }, 0);
    advBox.appendChild(plRow);

    advToggle.onclick = () => {
      const isHidden = advBox.style.display === 'none';
      advBox.style.display = isHidden ? 'block' : 'none';
      advToggle.textContent = (isHidden ? '▼' : '▶') + ' Opciones Avanzadas (Payload)';
    };

    container.appendChild(advToggle);
    container.appendChild(advBox);

    // Listeners for standard fields
    container.addEventListener('input', (e) => {
      const t = e.target;
      if (t.id === 'debug_message') node.message = t.value;
      if (t.id === 'debug_save_as') node.save_as = t.value;
      if (t.closest && t.closest('#debug_payload')) node.payload = t.value;
    });

    return container;
  }
  window.RendererRegistry = window.RendererRegistry || {};
  window.RendererRegistry.debug = renderDebug;
})();
