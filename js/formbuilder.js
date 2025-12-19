// formbuilder.js
// Exporta una función que crea los campos dinámicos para cada tipo.
// Trabaja sobre el contenedor #dynamicProps y el objeto node actual.
// nodeIds: array of available node ids for next selection

const FormBuilder = (() => {
  // Helpers simples para crear inputs DOM
  function el(tag, attrs = {}, children = []) {
    const e = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else e.setAttribute(k, v);
    });
    children.forEach(c => e.appendChild(c));
    return e;
  }

  // --- Expandable Text Modal Helpers ---
  let expandedModal = null;
  let currentInput = null;

  function ensureExpandedModal() {
    if (expandedModal) return expandedModal;
    expandedModal = document.createElement('div');
    expandedModal.id = 'expandedTextModal';
    expandedModal.className = 'modal-overlay';
    // Inline styles to ensure it works even if class missing
    expandedModal.style.cssText = 'display:none; position:fixed; top:0; left:0; width:100%; height:100%; z-index:10000; background:rgba(0,0,0,0.5); align-items:center; justify-content:center;';

    const dialog = document.createElement('div');
    dialog.className = 'modal-dialog';
    dialog.style.cssText = 'background:white; width:80%; height:80%; max-width:800px; display:flex; flex-direction:column; padding:20px; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.15);';

    dialog.innerHTML = `
      <h3 style="margin-top:0; margin-bottom:10px; font-size:1.1rem; font-weight:bold;">Editar Texto</h3>
      <textarea id="expandedTextEditor" style="flex:1; width:100%; margin-bottom:10px; font-family:monospace; padding:8px; border:1px solid #ccc; border-radius:4px; resize:none; font-size:14px;"></textarea>
      <div style="display:flex; justify-content:flex-end; gap:10px;">
        <button id="expandedTextCancel" type="button" class="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300">Cancelar</button>
        <button id="expandedTextSave" type="button" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Guardar</button>
      </div>
    `;

    expandedModal.appendChild(dialog);
    document.body.appendChild(expandedModal);

    const checkClose = (e) => { if (e.target === expandedModal) closeExpandedModal(); };
    expandedModal.addEventListener('click', checkClose);

    dialog.querySelector('#expandedTextCancel').onclick = closeExpandedModal;
    dialog.querySelector('#expandedTextSave').onclick = saveExpandedText;

    return expandedModal;
  }

  function openExpandedModal(input) {
    ensureExpandedModal();
    currentInput = input;
    const editor = expandedModal.querySelector('#expandedTextEditor');
    editor.value = input.value || '';
    expandedModal.style.display = 'flex';
    setTimeout(() => editor.focus(), 50);
  }

  function closeExpandedModal() {
    if (expandedModal) expandedModal.style.display = 'none';
    currentInput = null;
  }

  function saveExpandedText() {
    if (currentInput && expandedModal) {
      const editor = expandedModal.querySelector('#expandedTextEditor');
      currentInput.value = editor.value;
      // Trigger event
      currentInput.dispatchEvent(new Event('input', { bubbles: true }));
      currentInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    closeExpandedModal();
  }

  // Factory to create mouse handlers for variable items (keeps nesting shallow)
  function createVarClickHandler(name, insertFn, hideFn) {
    return function (ev) {
      ev.preventDefault();
      try { insertFn(name); } catch (e) { console.warn('insertVar failed', e); }
      try { hideFn(); } catch (e) { console.warn('hideFn failed', e); }
    };
  }

  // Crea label + input row
  function inputRow({ label, id, type = 'text', value = '', placeholder = '' }) {
    const row = el('div', { class: 'form-row' });
    row.appendChild(el('label', { text: label }));
    const wrapper = el('div', { style: 'display:flex; gap:5px; align-items:center;' });

    if (type === 'textarea') {
      const ta = el('textarea', { id });
      ta.value = value || '';
      ta.placeholder = placeholder;
      ta.style.flex = '1';
      try { ta.setAttribute('autocomplete', 'off'); } catch (_) { }
      wrapper.appendChild(ta);

      const expandBtn = el('button', { type: 'button', text: '⤢', title: 'Expandir' });
      expandBtn.style.cssText = 'padding:0 8px; cursor:pointer; font-size:16px; min-width:32px; height:38px; border:1px solid #ddd; background:#f9f9f9; border-radius:4px;';
      expandBtn.onclick = () => openExpandedModal(ta);
      wrapper.appendChild(expandBtn);
    } else {
      const inp = el('input', { id, type });
      inp.value = value || '';
      inp.placeholder = placeholder || '';
      inp.style.flex = '1';
      wrapper.appendChild(inp);

      if (type === 'text') {
        const expandBtn = el('button', { type: 'button', text: '⤢', title: 'Expandir' });
        expandBtn.style.cssText = 'padding:0 8px; cursor:pointer; font-size:16px; min-width:32px; height:34px; border:1px solid #ddd; background:#f9f9f9; border-radius:4px;';
        expandBtn.onclick = () => openExpandedModal(inp);
        wrapper.appendChild(expandBtn);
      }
    }
    row.appendChild(wrapper);
    return row;
  }

  function arrayRow({ label, id, value = [] }) {
    const row = el('div', { class: 'form-row' });
    row.appendChild(el('label', { text: label }));
    const wrapper = el('div', { style: 'display:flex; gap:5px; align-items:center;' });
    const ta = el('textarea', { id });
    if (Array.isArray(value)) ta.value = value.join('\n');
    else ta.value = value ? String(value) : '';
    ta.placeholder = 'Una línea por elemento (para listas simples)';
    ta.style.flex = '1';
    try { ta.setAttribute('autocomplete', 'off'); } catch (_) { }
    wrapper.appendChild(ta);

    const expandBtn = el('button', { type: 'button', text: '⤢', title: 'Expandir' });
    expandBtn.style.cssText = 'padding:0 8px; cursor:pointer; font-size:16px; min-width:32px; height:38px; border:1px solid #ddd; background:#f9f9f9; border-radius:4px;';
    expandBtn.onclick = () => openExpandedModal(ta);
    wrapper.appendChild(expandBtn);

    row.appendChild(wrapper);
    return row;
  }

  function jsonEditor({ label, id, value = {} }) {
    const row = el('div', { class: 'form-row' });
    row.appendChild(el('label', { text: label }));
    const wrapper = el('div', { style: 'display:flex; gap:5px; align-items:center;' });
    const ta = el('textarea', { id });
    ta.value = JSON.stringify(value, null, 2);
    ta.placeholder = 'Objeto JSON (edítalo si necesitas estructura más compleja)';
    ta.style.flex = '1';
    try { ta.setAttribute('autocomplete', 'off'); } catch (_) { }
    wrapper.appendChild(ta);

    const expandBtn = el('button', { type: 'button', text: '⤢', title: 'Expandir' });
    expandBtn.style.cssText = 'padding:0 8px; cursor:pointer; font-size:16px; min-width:32px; height:38px; border:1px solid #ddd; background:#f9f9f9; border-radius:4px;';
    expandBtn.onclick = () => openExpandedModal(ta);
    wrapper.appendChild(expandBtn);

    row.appendChild(wrapper);

    const msg = el('div', { class: 'json-error', 'aria-live': 'polite' });
    msg.style.color = '#b00020'; msg.style.fontSize = '12px'; msg.style.minHeight = '1.2em'; msg.style.marginTop = '4px';
    row.appendChild(msg);
    ta.addEventListener('input', () => {
      try { JSON.parse(ta.value); msg.textContent = ''; } catch (e) { msg.textContent = 'JSON inválido: ' + e.message; }
    });
    return row;
  }

  function createTypeSelect(selected, index) {
    const typeSel = el('select', { 'data-field': 'type', 'data-index': String(index) });
    const types = ['text', 'email', 'select', 'textarea', 'file'];
    for (let t of types) {
      const opt = document.createElement('option');
      opt.value = t; opt.textContent = t; if (t === selected) opt.selected = true;
      typeSel.appendChild(opt);
    }
    return typeSel;
  }

  function fieldsEditor({ label, id, fields = [] }) {
    const row = el('div', { class: 'form-row' });
    row.appendChild(el('label', { text: label }));
    const container = el('div', { id: id + '_container' });
    const list = el('div', { class: 'fields-list' });
    container.appendChild(list);
    const addBtn = el('button', {
      type: 'button',
      text: 'Añadir campo',
      class: 'mt-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition w-fit text-sm font-semibold shadow-sm'
    });
    addBtn.addEventListener('click', onAddField);
    container.appendChild(addBtn);

    function onAddField() {
      fields.push({ name: 'campo', type: 'text', label: 'Etiqueta', required: false });
      renderList();
    }

    function renderList() {
      list.innerHTML = '';
      fields.forEach((f, i) => {
        const item = el('div', { class: 'field-item', 'data-index': String(i) });
        item.style.border = '1px solid #eee'; item.style.padding = '6px'; item.style.marginBottom = '6px';
        item.appendChild(el('div', { text: `#${i + 1} - ${f.name} ` }));
        const name = el('input', { type: 'text', value: f.name, 'data-field': 'name', 'data-index': String(i) });
        const labelInp = el('input', { type: 'text', value: f.label, 'data-field': 'label', 'data-index': String(i) });
        const typeSel = createTypeSelect(f.type, i);
        const req = el('input', { type: 'checkbox', 'data-field': 'required', 'data-index': String(i) });
        req.checked = !!f.required;
        const remove = el('button', {
          type: 'button',
          text: 'Eliminar',
          'data-action': 'remove',
          'data-index': String(i),
          class: 'ml-2 px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition text-xs font-semibold shadow-sm'
        });
        item.appendChild(el('div', {}, [el('label', { text: 'name:' }), name]));
        item.appendChild(el('div', {}, [el('label', { text: 'label:' }), labelInp]));
        item.appendChild(el('div', {}, [el('label', { text: 'type:' }), typeSel]));
        item.appendChild(el('div', {}, [el('label', { text: 'required:' }), req]));
        item.appendChild(remove);
        list.appendChild(item);
      });
    }

    list.addEventListener('input', (ev) => {
      const target = ev.target;
      const idx = target.getAttribute('data-index');
      const field = target.getAttribute('data-field');
      if (idx == null || !field) {
        return;
      }
      const i = Number(idx);
      if (!fields[i]) {
        return;
      }
      fields[i][field] = target.value;
      renderList();
    });

    list.addEventListener('change', (ev) => {
      const target = ev.target;
      const idx = target.getAttribute('data-index');
      const field = target.getAttribute('data-field');
      if (idx == null || !field) {
        return;
      }
      const i = Number(idx);
      if (!fields[i]) {
        return;
      }
      if (target.type === 'checkbox') {
        fields[i][field] = !!target.checked;
      } else {
        fields[i][field] = target.value;
      }
      renderList();
    });

    list.addEventListener('click', (ev) => {
      const action = ev.target.getAttribute('data-action');
      const idx = ev.target.getAttribute('data-index');
      if (action === 'remove' && idx != null) {
        const i = Number(idx);
        if (!fields[i]) return;
        fields.splice(i, 1);
        renderList();
      }
    });

    renderList(); row.appendChild(container);
    row.getValue = () => fields;
    return row;
  }

  // Editor por filas para mappings [{name, path}]
  function mappingsEditor({ label, id, mappings = [] }) {
    const row = el('div', { class: 'form-row' });
    row.appendChild(el('label', { text: label }));
    const container = el('div', { id: id + '_container', class: 'mappings-container' });
    const list = el('div', { class: 'mappings-list' });
    container.appendChild(list);
    const addBtn = el('button', {
      type: 'button',
      text: 'Añadir mapeo',
      class: 'mt-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition w-fit text-sm font-semibold shadow-sm'
    });
    addBtn.addEventListener('click', onAdd);
    container.appendChild(addBtn);

    function onAdd() { mappings.push({ name: '', path: '', type: '' }); renderList(); }

    function renderList() {
      list.innerHTML = '';
      mappings.forEach((m, i) => {
        const item = el('div', { class: 'mapping-item', 'data-index': String(i) });
        item.style.display = 'flex'; item.style.gap = '8px'; item.style.marginBottom = '6px';
        const nameInp = el('input', { type: 'text', value: m.name, 'data-field': 'name', 'data-index': String(i), placeholder: 'variable o variable.propiedad' });
        const pathInp = el('input', { type: 'text', value: m.path, 'data-field': 'path', 'data-index': String(i), placeholder: 'ruta JSON (ej: data.items[0].id)' });
        const typeInp = el('input', { type: 'text', value: m.type || '', 'data-field': 'type', 'data-index': String(i), placeholder: 'type (opcional)' });
        const remove = el('button', {
          type: 'button',
          text: 'Eliminar',
          'data-action': 'remove',
          'data-index': String(i),
          class: 'ml-2 px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition text-xs font-semibold shadow-sm'
        });
        item.appendChild(nameInp); item.appendChild(pathInp); item.appendChild(typeInp); item.appendChild(remove);
        // attach autocomplete for variable names if helper available
        // if (window.FormBuilderHelpers?.attachVarAutocomplete) {
        //   try { window.FormBuilderHelpers.attachVarAutocomplete(nameInp, { format: 'mustache' }); } catch(e) { console.warn('attachVarAutocomplete failed for mapping name', e); }
        // }
        list.appendChild(item);
      });
    }

    list.addEventListener('input', (ev) => {
      const target = ev.target;
      const idx = target.getAttribute('data-index');
      const field = target.getAttribute('data-field');
      if (idx == null || !field) {
        return;
      }
      const i = Number(idx);
      if (!mappings[i]) {
        return;
      }
      mappings[i][field] = target.value;
    });

    list.addEventListener('click', (ev) => {
      const action = ev.target.getAttribute('data-action');
      const idx = ev.target.getAttribute('data-index');
      if (action === 'remove' && idx != null) {
        const i = Number(idx);
        if (!mappings[i]) return;
        mappings.splice(i, 1);
        renderList();
      }
    });

    renderList(); row.appendChild(container);
    row.getValue = () => mappings.map(m => ({ name: (m.name || '').trim(), path: (m.path || '').trim(), type: (m.type || '').trim() })).filter(mm => mm.name && mm.path);
    return row;
  }

  // Editor para variables en nodo start [{name, defaultValue, isList, type}]
  function variablesEditor({ label, id, variables = [] }) {
    const row = el('div', { class: 'form-row' });
    row.appendChild(el('label', { text: label, class: 'block text-sm font-medium text-gray-700 mb-2' }));
    const container = el('div', { id: id + '_container', class: 'variables-container flex flex-col gap-2' });
    const list = el('div', { class: 'variables-list flex flex-col gap-2' });
    container.appendChild(list);
    const addBtn = el('button', {
      type: 'button',
      text: 'Añadir variable',
      class: 'mt-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition w-fit text-sm font-semibold shadow-sm'
    });
    // Default type is 'string' if not specified
    addBtn.addEventListener('click', () => { variables.push({ name: '', defaultValue: '', isList: false, type: 'string' }); renderList(); });

    function findDuplicateNames() {
      const counter = {};
      variables.forEach(v => {
        const n = (v.name || '').trim(); if (!n) return;
        counter[n] = (counter[n] || 0) + 1;
      });
      const dups = new Set();
      Object.entries(counter).forEach(([k, v]) => { if (v > 1) dups.add(k); });
      return dups;
    }

    function renderList() {
      list.innerHTML = '';
      const dupSet = findDuplicateNames();
      variables.forEach((v, i) => {
        // Ensure type exists (migration for old vars)
        if (!v.type) v.type = 'string';

        const item = el('div', { class: 'variable-item flex items-center gap-2 bg-white rounded shadow-sm p-2', 'data-index': String(i) });
        const wrapper = el('div', { class: 'flex flex-col gap-1 flex-1' });

        // Row 1: Name and Type
        const row1 = el('div', { class: 'flex gap-2' });

        // Name
        const nameGroup = el('div', { class: 'flex-1' });
        const nameLabel = el('label', { text: 'Nombre', class: 'text-xs text-gray-600 block' });
        const nameInp = el('input', {
          type: 'text',
          value: v.name,
          'data-field': 'name',
          'data-index': String(i),
          placeholder: 'nombre',
          class: 'w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400'
        });
        if (dupSet.has((v.name || '').trim())) {
          nameInp.className += ' border-red-500';
          const warn = el('div', { text: '¡Duplicado!', class: 'text-xs text-red-600' });
          nameGroup.appendChild(warn);
        }
        nameGroup.appendChild(nameLabel);
        nameGroup.appendChild(nameInp);
        row1.appendChild(nameGroup);

        // Type
        const typeGroup = el('div', { class: 'w-24' });
        const typeLabel = el('label', { text: 'Tipo', class: 'text-xs text-gray-600 block' });
        const typeSel = el('select', {
          'data-field': 'type',
          'data-index': String(i),
          class: 'w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400'
        });
        ['string', 'boolean', 'number', 'json'].forEach(t => {
          const opt = el('option', { value: t, text: t });
          if (v.type === t) opt.selected = true;
          typeSel.appendChild(opt);
        });
        typeGroup.appendChild(typeLabel);
        typeGroup.appendChild(typeSel);
        row1.appendChild(typeGroup);

        wrapper.appendChild(row1);

        // Row 2: Value (dynamic input based on type)
        const row2 = el('div', { class: 'mt-1' });
        const defLabel = el('label', { text: 'Valor por defecto', class: 'text-xs text-gray-600 block' });
        row2.appendChild(defLabel);

        let inputControl;
        if (v.type === 'boolean') {
          inputControl = el('select', {
            'data-field': 'defaultValue',
            'data-index': String(i),
            class: 'w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400'
          });
          const optTrue = el('option', { value: 'true', text: 'True' });
          const optFalse = el('option', { value: 'false', text: 'False' });
          if (v.defaultValue === true || String(v.defaultValue) === 'true') optTrue.selected = true;
          else optFalse.selected = true;
          inputControl.appendChild(optTrue);
          inputControl.appendChild(optFalse);

        } else if (v.type === 'number') {
          inputControl = el('input', {
            type: 'number',
            value: v.defaultValue,
            'data-field': 'defaultValue',
            'data-index': String(i),
            placeholder: '0',
            class: 'w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400'
          });

        } else if (v.type === 'json') {
          inputControl = el('textarea', {
            'data-field': 'defaultValue',
            'data-index': String(i),
            placeholder: '{"key": "value"}',
            class: 'w-full border border-gray-300 rounded px-2 py-1 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400',
            rows: '2'
          });
          // If it's an object, stringify it for display
          let valStr = '';
          if (typeof v.defaultValue === 'object' && v.defaultValue !== null) {
            valStr = JSON.stringify(v.defaultValue); // No pretty print to save space, user can expand
          } else {
            valStr = String(v.defaultValue || '');
          }
          inputControl.value = valStr;

          inputControl.style.flex = '1';
          // Wrap in local wrapper for expander
          const wrapperJson = el('div', { style: 'display:flex; gap:5px; align-items:center;' });
          wrapperJson.appendChild(inputControl);

          const expandBtn = el('button', { type: 'button', text: '⤢', title: 'Expandir' });
          expandBtn.style.cssText = 'padding:0 5px; cursor:pointer; border:1px solid #ddd; background:#f9f9f9; border-radius:4px; margin-left:2px; height:auto; align-self:stretch;';
          expandBtn.onclick = () => openExpandedModal(inputControl);
          wrapperJson.appendChild(expandBtn);

          // Re-target inputControl to wrapper so it gets appended to row2
          inputControl = wrapperJson;

        } else {
          // String (default)
          inputControl = el('input', {
            type: 'text',
            value: v.defaultValue,
            'data-field': 'defaultValue',
            'data-index': String(i),
            placeholder: 'texto',
            class: 'w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400'
          });
        }

        row2.appendChild(inputControl);
        wrapper.appendChild(row2);

        // Row 3: Options (isList)
        const row3 = el('div', { class: 'flex items-center gap-2 mt-1' });
        const isListChk = el('input', {
          type: 'checkbox',
          'data-field': 'isList',
          'data-index': String(i),
          class: 'form-checkbox h-4 w-4 text-blue-600'
        });
        isListChk.checked = !!v.isList;
        row3.appendChild(isListChk);
        row3.appendChild(el('label', { text: 'Es Lista', class: 'text-xs text-gray-600' }));
        wrapper.appendChild(row3);

        item.appendChild(wrapper);

        // Remove button
        const remove = el('button', {
          type: 'button',
          text: '✕',
          'data-action': 'remove',
          'data-index': String(i),
          title: 'Eliminar variable',
          class: 'ml-2 px-2 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200 transition text-sm font-bold'
        });
        item.appendChild(remove);
        list.appendChild(item);
      });
    }

    list.addEventListener('input', (ev) => {
      const target = ev.target;
      const idx = target.getAttribute('data-index');
      const field = target.getAttribute('data-field');
      if (idx == null || !field) return;
      const i = Number(idx);
      if (!variables[i]) return;

      // Handle type change: reset value if type changes to avoid confusion? 
      // For now, keep value but it might look weird.
      if (field === 'type') {
        variables[i].type = target.value;
        // Reset default value to sensible default for new type
        if (target.value === 'boolean') variables[i].defaultValue = false;
        else if (target.value === 'number') variables[i].defaultValue = 0;
        else if (target.value === 'json') variables[i].defaultValue = {};
        else variables[i].defaultValue = '';
        renderList(); // Re-render to show correct input control
        return;
      }

      if (field === 'isList') return; // handled in change

      variables[i][field] = target.value;

      // Re-render only if name changed (for dup check)
      if (field === 'name') {
        const dupSet = findDuplicateNames();
        if (dupSet.size > 0 || target.classList.contains('border-red-500')) {
          renderList();
        }
      }
    });

    list.addEventListener('change', (ev) => {
      const target = ev.target;
      const idx = target.getAttribute('data-index');
      const field = target.getAttribute('data-field');
      if (idx == null || !field) return;
      const i = Number(idx);
      if (!variables[i]) return;

      if (target.type === 'checkbox') {
        variables[i][field] = !!target.checked;
      } else if (field === 'type') {
        // Already handled in input event for select, but just in case
        variables[i].type = target.value;
        if (target.value === 'boolean') variables[i].defaultValue = false;
        else if (target.value === 'number') variables[i].defaultValue = 0;
        else if (target.value === 'json') variables[i].defaultValue = {};
        else variables[i].defaultValue = '';
        renderList();
      } else {
        variables[i][field] = target.value;
      }
    });

    list.addEventListener('click', (ev) => {
      const action = ev.target.getAttribute('data-action');
      const idx = ev.target.getAttribute('data-index');
      if (action === 'remove' && idx != null) {
        const i = Number(idx);
        if (!variables[i]) return;
        if (!confirm('Eliminar la variable "' + (variables[i].name || '') + '"?')) return;
        variables.splice(i, 1);
        renderList();
      }
    });

    renderList();
    container.appendChild(addBtn);
    row.appendChild(container);

    row.getValue = () => variables.map(v => {
      let val = v.defaultValue;
      // Convert value based on type
      if (v.type === 'boolean') {
        val = (String(val) === 'true');
      } else if (v.type === 'number') {
        val = Number(val);
        if (isNaN(val)) val = 0;
      } else if (v.type === 'json') {
        try {
          if (typeof val === 'string') val = JSON.parse(val);
        } catch (e) { /* keep as string if parse fails, or set null? */ }
      } else {
        val = String(val == null ? '' : val).trim();
      }

      return {
        name: (v.name || '').trim(),
        defaultValue: val,
        isList: !!v.isList,
        type: v.type || 'string'
      };
    }).filter(vv => vv.name);

    return row;
  }

  // Expose helpers so external renderer module can reuse them
  window.FormBuilderHelpers = {
    el,
    inputRow,
    arrayRow,
    jsonEditor,
    fieldsEditor,
    mappingsEditor,
    variablesEditor,
    openExpandedModal,
    // attach simple autocomplete for variables. options: { format: 'mustache'|'context'|'dollar' }
    attachVarAutocomplete: function (input, options = {}) {
      if (!input) return;
      // No aplicar autocompletado a textareas para evitar problemas de ancho y UX
      try { if ((input.tagName || '').toUpperCase() === 'TEXTAREA') return; } catch (_) { }
      // create wrapper to position suggestions
      const wrapper = el('div', { style: 'display:inline-block; position:relative;' });
      // move input into wrapper
      const parent = input.parentNode;
      if (!parent) return;
      parent.replaceChild(wrapper, input);
      wrapper.appendChild(input);
      const box = el('div', { class: 'var-autocomplete-box' });
      box.style.position = 'absolute';
      box.style.left = '0';
      box.style.top = '100%';
      box.style.zIndex = '9999';
      box.style.background = '#fff';
      box.style.border = '1px solid #ccc';
      box.style.display = 'none';
      box.style.maxHeight = '160px';
      box.style.overflow = 'auto';
      box.style.minWidth = '160px';
      box.style.boxShadow = '0 2px 6px rgba(0,0,0,0.12)';
      wrapper.appendChild(box);

      function getVars() {
        const startId = window.App?.state?.meta?.start_node;
        if (!startId) return [];
        return window.App?.state?.nodes?.[startId]?.variables?.map(v => v.name).filter(Boolean) || [];
      }

      function getSuggestions() {
        const vars = getVars();
        const base = [
          ...vars.map(v => `context.${v} `),
          'context.input',
          'context.count',
          'context.items',
          'input',
          '+', '-', '*', '/', '==', '!=', '>', '<', '>=', '<=',
          '&&', '||', '!',
          'true', 'false', 'null',
          'parseInt(', 'parseFloat(', 'String(', 'Number(',
          'Array.isArray(', 'Object.keys(', 'JSON.stringify('
        ];
        return base;
      }

      let activeIndex = -1;
      function setActiveIndex(i) {
        activeIndex = i;
        const children = Array.from(box.children);
        children.forEach((c, idx) => { c.style.background = (idx === i) ? '#eef' : ''; });
      }

      function handleItemMouseOver(ev) {
        const idx = Number(ev.currentTarget.getAttribute('data-idx'));
        if (!Number.isNaN(idx)) setActiveIndex(idx);
      }

      function renderList(list) {
        box.innerHTML = '';
        if (!list?.length) {
          box.style.display = 'none';
          return;
        }
        list.forEach((n, idx) => {
          const it = el('div', { text: n });
          it.setAttribute('data-idx', String(idx));
          it.style.padding = '6px 8px';
          it.style.cursor = 'pointer';
          it.style.borderBottom = '1px solid #f0f0f0';
          it.tabIndex = -1;
          const handler = createVarClickHandler(n, insertVar, hide);
          it.addEventListener('mousedown', handler);
          it.addEventListener('mouseover', handleItemMouseOver);
          box.appendChild(it);
        });
        box.style.display = 'block';
      }

      function insertVar(name) {
        const start = input.selectionStart || 0;
        const end = input.selectionEnd || 0;
        const val = input.value || '';
        input.value = val.slice(0, start) + name + val.slice(end);
        input.focus();
        const pos = start + name.length;
        try { input.setSelectionRange(pos, pos); } catch (e) { console.warn('setSelectionRange failed', e); }
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }

      function showFiltered() {
        const q = (input.value || '').toLowerCase();
        const suggestions = getSuggestions();
        const filtered = suggestions.filter(s => s.toLowerCase().includes(q));
        renderList(filtered);
      }

      function hide() { box.style.display = 'none'; }

      input.addEventListener('input', () => { activeIndex = -1; showFiltered(); });
      input.addEventListener('focus', () => { activeIndex = -1; showFiltered(); });
      input.addEventListener('blur', () => setTimeout(hide, 150));
      input.addEventListener('keydown', (ev) => {
        if (box.style.display === 'none') return;
        const count = box.children.length;
        if (ev.key === 'ArrowDown') {
          ev.preventDefault();
          setActiveIndex(Math.min(count - 1, activeIndex + 1));
        } else if (ev.key === 'ArrowUp') {
          ev.preventDefault();
          setActiveIndex(Math.max(0, activeIndex - 1));
        } else if (ev.key === 'Enter') {
          ev.preventDefault();
          if (activeIndex >= 0 && activeIndex < count) {
            const name = box.children[activeIndex].textContent;
            insertVar(name);
            hide();
          }
        } else if (ev.key === 'Escape') {
          ev.preventDefault(); hide();
        }
      });
    }
  };

  // ---- Readers per-type (reduce complexity of readValues) ----
  function safeParse(text, fallback) {
    try {
      return JSON.parse(text);
    } catch (e) {
      console.warn('safeParse: JSON parse failed, returning fallback', e);
      return fallback;
    }
  }
  function readResponse(container) {
    const nodes = container.querySelectorAll('textarea[id^="i18n_text_"]');
    const i18n = {};
    nodes.forEach(t => {
      const locale = t.id.replace('i18n_text_', '').trim();
      const arr = t.value.split('\n').map(s => s.trim()).filter(Boolean);
      i18n[locale] = { text: arr };
    });
    const dataInfo = container.querySelector('#response_dataInfo')?.value.trim() || '';
    return { i18n, dataInfo };
  }

  function readInput(container) {
    // read prompts per-locale if rendered, otherwise fallback to single input_prompt
    const locales = (window.App?.state?.meta?.locales?.length) ? window.App.state.meta.locales : ['es'];
    const i18n = {};
    let foundAny = false;
    locales.forEach(loc => {
      const sel = container.querySelector('#input_prompt_' + loc);
      if (sel) {
        i18n[loc] = { prompt: sel.value || '' };
        foundAny = true;
      }
    });
    // backward compatibility: single prompt field
    if (!foundAny) {
      const single = container.querySelector('#input_prompt')?.value || '';
      i18n['es'] = { prompt: single };
    }
    let save_as = (container.querySelector('#input_save_as')?.value || '').trim();
    // Usability: si el usuario deja vacío, usar la variable por defecto 'input'
    if (!save_as) save_as = 'input';
    return { i18n, save_as };
  }

  function readChoice(container) {
    const prompt = container.querySelector('#choice_prompt')?.value || '';
    const mode = container.querySelector('#choice_mode')?.value || 'prompt';
    if (mode === 'switch') {
      const cases = [];
      const rows = container.querySelectorAll('.choice-case-item');
      rows.forEach(row => {
        const when = row.querySelector('[id^="choice_case_when_"]')?.value?.trim() || '';
        const f = row.querySelector('select[id^="choice_case_flow_"]')?.value || '';
        const n = row.querySelector('select[id^="choice_case_node_"]')?.value || '';
        const target = (f || n) ? { flow_id: f, node_id: n } : null;
        if (when || target) cases.push({ when, target });
      });
      const df = container.querySelector('#choice_default_flow')?.value || '';
      const dn = container.querySelector('#choice_default_node')?.value || '';
      const default_target = (df || dn) ? { flow_id: df, node_id: dn } : null;
      return { i18n: { es: { prompt } }, mode: 'switch', cases, default_target };
    }
    // prompt mode (compat)
    const allow_free_text = !!container.querySelector('#choice_allow')?.checked;
    const lines = (container.querySelector('#choice_options')?.value || '').split('\n').map(l => l.trim()).filter(Boolean);
    const options = lines.map(line => {
      const parts = line.split('|').map(p => p.trim());
      const label = parts[0] || 'opción';
      let target = null;
      if (parts[1]) {
        const t = parts[1];
        if (t.includes('#')) {
          const [flow, node] = t.split('#'); target = { flow_id: flow, node_id: node };
        } else target = { flow_id: '', node_id: t };
      }
      return { label, target };
    });
    return { i18n: { es: { prompt } }, mode: 'prompt', allow_free_text, options };
  }

  function readButton(container) {
    // Read node-level i18n simple inputs (single line per locale)
    const i18n = {};
    const localeInputs = container.querySelectorAll('input[id^="i18n_text_"]');
    localeInputs.forEach(inp => {
      const locale = inp.id.replace('i18n_text_', '').trim();
      i18n[locale] = { text: inp.value || '' };
    });
    const mode = container.querySelector('#button_mode')?.value || 'static';
    const variant = container.querySelector('#button_variant')?.value || 'primary';
    const optional = !!container.querySelector('#btn_optional')?.checked;
    let save_as = (container.querySelector('#btn_save_as input, #btn_save_as')?.value || '').trim();
    if (!save_as) {
      // default sugerido igual que en renderer: selected_button_<nodeId>
      const nid = window.App?.state?.selectedNodeId || window.App?.state?.editingNode?.id || null;
      if (nid) save_as = `selected_button_${nid} `;
    }

    let next = null;
    const nextSel = container.querySelector('#button_next');
    const nextFlowSel = container.querySelector('#button_next_flow');
    if (nextSel?.value || nextFlowSel?.value) {
      next = { flow_id: (nextFlowSel?.value || ''), node_id: (nextSel?.value || '') };
    }

    let provider = null;
    if (mode === 'dynamic') {
      provider = {
        source_list: (container.querySelector('#btn_source_list input, #btn_source_list')?.value || '').trim(),
        label_expr: (container.querySelector('#btn_label_expr input, #btn_label_expr')?.value || '').trim(),
        value_expr: (container.querySelector('#btn_value_expr input, #btn_value_expr')?.value || '').trim(),
        filter_expr: (container.querySelector('#btn_filter_expr input, #btn_filter_expr')?.value || '').trim(),
        sort_expr: (container.querySelector('#btn_sort_expr input, #btn_sort_expr')?.value || '').trim()
      };
    }

    const options = [];
    if (mode === 'static') {
      const list = container.querySelectorAll('.button-item');
      list.forEach(item => {
        const optI18n = {};
        const labelInputs = item.querySelectorAll('input[data-locale]');
        labelInputs.forEach((li) => {
          const loc = li.getAttribute('data-locale');
          if (!loc) { return; }
          optI18n[loc] = { text: (li.value || '') };
        });
        // Resolve a display label to fallback value when value is empty
        let firstLabel = '';
        try {
          if (labelInputs && labelInputs.length) firstLabel = (labelInputs[0].value || '').trim();
        } catch (_) { }
        // read per-option value if present
        const valueInput = item.querySelector('input[id^="button_value_"]');
        const optValue = valueInput ? (valueInput.value || '') : '';
        // read per-option variant if present
        const varSel = item.querySelector('select[id^="button_variant_"]');
        const optVariant = varSel ? (varSel.value || 'primary') : undefined;
        // read per-option target from dedicated selects (flow + node)
        const tgtFlowSel = item.querySelector('select[id^="button_tgt_flow_"]');
        // pick the node selector, not the flow one
        const tgtSel = item.querySelector('select[id^="button_tgt_"]:not([id^="button_tgt_flow_"])');
        let next = null;
        const tgtNodeId = tgtSel?.value || '';
        const tgtFlowId = tgtFlowSel?.value || '';
        if (tgtNodeId || tgtFlowId) { next = { flow_id: tgtFlowId, node_id: tgtNodeId }; }
        // Keep both shapes for maximum compatibility across normalizers/exporters
        const target = next ? { flow_id: next.flow_id, node_id: next.node_id } : null;
        const hasLabel = Object.values(optI18n).some((v) => {
          return ((v.text || '').trim() !== '');
        });
        const opt = { i18n: optI18n, next, target };
        // Always provide a value: user-entered or fallback to label text
        const trimmed = (optValue || '').trim();
        opt.value = trimmed || firstLabel || '';
        if (optVariant) opt.variant = optVariant;
        if (hasLabel || next) options.push(opt);
      });
    }
    return { i18n, mode, provider, options, optional, variant, save_as, next };
  }

  // multi_button comparte casi toda la UI con button (renderer reutilizado),
  // pero puede añadir campos específicos (min/max/defaults) si el renderer los renderiza.
  function readMultiButton(container) {
    // En vez de reutilizar totalmente readButton (que busca `.button - item` y campos i18n_text_*),
    // leemos del panel dedicado (ids mb_*) y preservamos las opciones ya presentes en el nodo.
    const out = {};

    // Prompt por locales (panel usa #i18n_prompt_<loc>)
    const locales = (window.App?.state?.meta?.locales?.length) ? window.App.state.meta.locales : ['es'];
    const i18n = {};
    let anyPrompt = false;
    locales.forEach(loc => {
      const el = container.querySelector('#i18n_prompt_' + loc);
      if (el) {
        i18n[loc] = { prompt: el.value || '' };
        anyPrompt = true;
      }
    });
    if (anyPrompt) out.i18n = i18n;

    // save_as desde el panel (fallback a sugerencia por id de nodo)
    let save_as = (container.querySelector('#mb_save_as input, #mb_save_as')?.value || '').trim();
    if (!save_as) {
      const nid = window.App?.state?.selectedNodeId || window.App?.state?.editingNode?.id || null;
      if (nid) save_as = `selected_multi_${nid} `;
    }
    if (save_as) out.save_as = save_as;

    // modo (static | dynamic)
    const mode = container.querySelector('#mb_mode')?.value || 'static';
    out.mode = mode;

    // proveedor sólo en dinámico (panel ids: mb_source/mb_label/mb_value/mb_filter/mb_sort)
    if (mode === 'dynamic') {
      out.provider = {
        source_list: (container.querySelector('#mb_source input, #mb_source')?.value || '').trim(),
        label_expr: (container.querySelector('#mb_label input, #mb_label')?.value || '').trim(),
        value_expr: (container.querySelector('#mb_value input, #mb_value')?.value || '').trim(),
        filter_expr: (container.querySelector('#mb_filter input, #mb_filter')?.value || '').trim(),
        sort_expr: (container.querySelector('#mb_sort input, #mb_sort')?.value || '').trim()
      };
      // En dinámico, no exportamos opciones estáticas
      out.options = [];
    } else {
      // En estático, intentar leer filas `.mb - item`; si no, preservar las del nodo actual
      const rows = container.querySelectorAll('.mb-item');
      const options = [];
      rows.forEach(row => {
        const lbl = row.querySelector('[id^="mb_lbl_"] input, [id^="mb_lbl_"]')?.value || '';
        const val = row.querySelector('[id^="mb_val_"] input, [id^="mb_val_"]')?.value || '';
        const variantSel = row.querySelector('select[id^="mb_var_"]');
        const variant = variantSel ? (variantSel.value || '') : '';
        const tgtFlowSel = row.querySelector('select[id^="mb_tgt_flow_"]');
        const tgtNodeSel = row.querySelector('select[id^="mb_tgt_"]:not([id^="mb_tgt_flow_"])');
        const flow_id = tgtFlowSel?.value || '';
        const node_id = tgtNodeSel?.value || '';
        const target = (flow_id || node_id) ? { flow_id, node_id } : null;
        // Sólo añadir si hay algo relevante
        if ((lbl && lbl.trim()) || (val && val.trim()) || target) {
          const opt = { label: lbl || '', target };
          if (variant) opt.variant = variant;
          if (String(val || '').trim() !== '') opt.value = val;
          options.push(opt);
        }
      });
      if (options.length) {
        out.options = options;
      } else {
        // Preservar si el renderer ya escribió en el nodo actual
        try {
          const sid = window.App?.state?.selectedNodeId;
          const current = (sid && window.App?.state?.nodes?.[sid]) ? window.App.state.nodes[sid] : null;
          if (current && Array.isArray(current.options)) {
            out.options = JSON.parse(JSON.stringify(current.options));
          }
        } catch (e) { /* noop */ }
      }
    }

    // Campos adicionales opcionales (min/max/defaults) desde el panel
    const minRaw = container.querySelector('#mb_min input, #mb_min')?.value || '';
    const maxRaw = container.querySelector('#mb_max input, #mb_max')?.value || '';
    const defsRaw = container.querySelector('#mb_defaults input, #mb_defaults')?.value || '';
    const min = String(minRaw).trim() !== '' ? Number.parseInt(String(minRaw).trim(), 10) : undefined;
    const max = String(maxRaw).trim() !== '' ? Number.parseInt(String(maxRaw).trim(), 10) : undefined;
    const default_values = String(defsRaw || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    if (Number.isFinite(min)) out.min_selected = min;
    if (Number.isFinite(max)) out.max_selected = max;
    if (default_values.length) out.default_values = default_values;

    return out;
  }


  function readRestCall(container) {
    // properties editor stores method/url/headers inside a properties structure (see sample JSON)
    const method = container.querySelector('#rest_method')?.value || 'GET';
    const url = container.querySelector('#rest_url')?.value || '';
    const headers = safeParse(container.querySelector('#rest_headers')?.value || '{}', {});
    const save_path = container.querySelector('#rest_save_path')?.value?.trim() || '';
    // body puede estar presente en el editor JSON
    let body;
    try {
      const raw = container.querySelector('#rest_body')?.value || '';
      if (raw && raw.trim() !== '') body = safeParse(raw, undefined);
    } catch (e) { console.warn('readRestCall: invalid JSON in rest_body', e); body = undefined; }
    // mock config (only used by simulator/runtime demo)
    const mock_mode = (container.querySelector('#rest_mock_mode')?.value || 'off');
    let mock;
    try {
      const raw = container.querySelector('#rest_mock')?.value || '';
      if (raw && raw.trim() !== '') mock = safeParse(raw, undefined);
    } catch (e) { console.warn('readRestCall: invalid JSON in rest_mock', e); mock = undefined; }
    // mappings editor returns [{name,path,type}] but stored JSON uses {source,target,type}
    let mappings = [];
    const mappingsContainer = container.querySelector('#rest_mappings_container');
    if (mappingsContainer) {
      const possibleRow = mappingsContainer.closest('.form-row') || mappingsContainer.parentElement;
      if (possibleRow && typeof possibleRow.getValue === 'function') mappings = possibleRow.getValue();
    }
    if (!Array.isArray(mappings)) {
      const mappingsRaw = container.querySelector('#rest_mappings')?.value || '[]';
      mappings = safeParse(mappingsRaw, []);
    }
    // Normalize to {source,target,type} used in some flows
    mappings = (Array.isArray(mappings) ? mappings.map(m => {
      // older editor returned {name,path} -> map to source/path
      if (m.name !== undefined && m.path !== undefined) return { source: m.path || '', target: m.name || '', type: m.type || '' };
      // if already in {source,target,type} shape, keep
      return { source: m.source || m.path || '', target: m.target || m.name || '', type: m.type || '' };
    }) : []);
    const save_as = container.querySelector('#rest_save_as')?.value || '';
    return { method, url, headers, body: body, save_path: save_path || undefined, mappings: mappings, save_as, mock_mode, mock };
  }

  // readSetVar removido (nodo reemplazado por assign_var)

  function readAssignVar(container) {
    const target = container.querySelector('#assign_target')?.value.trim() || '';
    const value = container.querySelector('#assign_value')?.value.trim() || '';
    return { target, value };
  }

  function readSetGoto(container) {
    const target = container.querySelector('#set_goto_target')?.value || '';
    return { target };
  }

  function readCondition(container) {
    const expr = container.querySelector('#cond_expr')?.value.trim() || '';
    // nuevos selectores con flow + node (mantener compatibilidad si no existen)
    const tNode = container.querySelector('#cond_true_node')?.value || container.querySelector('#cond_true')?.value || '';
    const tFlow = container.querySelector('#cond_true_flow')?.value || '';
    const fNode = container.querySelector('#cond_false_node')?.value || container.querySelector('#cond_false')?.value || '';
    const fFlow = container.querySelector('#cond_false_flow')?.value || '';
    const true_target = (tNode || tFlow) ? { flow_id: tFlow, node_id: tNode } : null;
    const false_target = (fNode || fFlow) ? { flow_id: fFlow, node_id: fNode } : null;
    // read optional local variables defined in the condition editor (fallback when no helper exists)
    const vars = [];
    const varsContainer = container.querySelector('#cond_variables_container');
    if (varsContainer) {
      const rows = varsContainer.querySelectorAll('.cond-var-row');
      rows.forEach(r => {
        const name = r.querySelector('.cond-var-name')?.value?.trim() || '';
        if (!name) return;
        const defaultValue = r.querySelector('.cond-var-default')?.value || '';
        const isList = !!r.querySelector('.cond-var-islist')?.checked;
        vars.push({ name, defaultValue: defaultValue === '' ? undefined : defaultValue, isList });
      });
    } else {
      const raw = container.querySelector('#cond_variables')?.value || '';
      if (raw) {
        const parsed = safeParse(raw, []);
        if (Array.isArray(parsed)) parsed.forEach(v => vars.push(v));
      }
    }
    return { expr, true_target, false_target, variables: vars };
  }

  function readLoop(container) {
    const mode = container.querySelector('#loop_mode')?.value || 'foreach';
    // prefer loop_source_list but accept legacy loop_source or loop_iter
    const source_list = container.querySelector('#loop_source_list')?.value || container.querySelector('#loop_source')?.value || container.querySelector('#loop_iter')?.value || '';
    const item_var = container.querySelector('#loop_item_var')?.value || container.querySelector('#loop_itemvar')?.value || 'item';
    const index_var = container.querySelector('#loop_index_var')?.value || 'index';
    const body_start = (container.querySelector('#loop_body')?.value) ? { flow_id: '', node_id: container.querySelector('#loop_body')?.value } : null;
    const after_loop = (container.querySelector('#loop_after')?.value) ? { flow_id: '', node_id: container.querySelector('#loop_after')?.value } : null;
    // accept loop_cond or legacy loop_index_or_cond
    const cond = container.querySelector('#loop_cond')?.value || container.querySelector('#loop_index_or_cond')?.value || '';
    const max_iterations = (container.querySelector('#loop_max')?.value || '').trim();
    // variables locales opcionales
    const variables = [];
    const varsContainer = container.querySelector('#loop_variables_container');
    if (varsContainer && typeof varsContainer.closest === 'function') {
      const row = varsContainer.closest('.form-row');
      if (row && typeof row.getValue === 'function') {
        try {
          const v = row.getValue();
          if (Array.isArray(v)) v.forEach(x => variables.push(x));
        } catch (e) {
          console.warn('readLoop: failed to read variables from UI row', e);
        }
      }
    }
    return { mode, source_list, item_var, index_var, body_start, after_loop, cond, max_iterations: max_iterations ? Number(max_iterations) : undefined, variables };
  }

  function readDebug(container) {
    // Find renderer element that exposes readValues()
    const renderer = container.querySelector('.debug-node-editor');
    if (renderer && typeof renderer.getValue === 'function') return renderer.getValue();
    // Fallback: try to read textarea fields
    const message = container.querySelector('textarea')?.value || '';
    const payload = container.querySelector('textarea:nth-of-type(2)')?.value || '';
    const save_as = container.querySelector('input[type=text]')?.value || '';
    return { message, payload, save_as };
  }

  function readHeroCard(container) {
    const title = container.querySelector('#hero_title')?.value || '';
    const subtitle = container.querySelector('#hero_sub')?.value || '';
    const text = container.querySelector('#hero_text')?.value || '';
    const image_url = container.querySelector('#hero_img')?.value || '';
    const buttons = safeParse(container.querySelector('#hero_buttons')?.value || '[]', []);
    return { title, subtitle, text, image_url, buttons };
  }

  function readCarousel(container) {
    const cards = safeParse(container.querySelector('#carousel_cards')?.value || '[]', []);
    return { cards };
  }

  function readForm(container, node) {
    const mode = container.querySelector('#form_mode')?.value || node.mode || 'static';
    const save_as = (container.querySelector('#form_save_as input, #form_save_as')?.value || node.save_as || '').trim();
    if (mode === 'dynamic') {
      const fields_source = (container.querySelector('#form_fields_source input, #form_fields_source')?.value || '').trim();
      const filter_expr = (container.querySelector('#form_filter_expr input, #form_filter_expr')?.value || '').trim();
      const sort_expr = (container.querySelector('#form_sort_expr input, #form_sort_expr')?.value || '').trim();
      const out = { mode: 'dynamic', fields_source, filter_expr, sort_expr };
      if (save_as) out.save_as = save_as;
      return out;
    }
    // static
    const inner = container.querySelector('#form_fields_container');
    let fields = [];
    if (inner) {
      const possibleRow = inner.closest('.form-row') || inner.parentElement;
      if (possibleRow && typeof possibleRow.getValue === 'function') fields = possibleRow.getValue();
    }
    const out = { mode: 'static', fields };
    if (save_as) out.save_as = save_as;
    return out;
  }

  function readFileUpload(container) {
    const accept = container.querySelector('#file_accept')?.value || '';
    const max_size = container.querySelector('#file_max')?.value || '';
    const save_as = container.querySelector('#file_save')?.value || '';
    return { accept, max_size, save_as };
  }

  function readJsonExport(container) {
    const filename = container.querySelector('#json_filename')?.value || '';
    const description = container.querySelector('#json_desc')?.value || '';
    const template = safeParse(container.querySelector('#json_template')?.value || '{}', {});
    return { filename, description, template };
  }

  function readFileDownload(container) {
    const file_url = container.querySelector('#fd_url')?.value || '';
    const filename = container.querySelector('#fd_name')?.value || '';
    const description = container.querySelector('#fd_desc')?.value || '';
    return { file_url, filename, description };
  }

  function readDefault(container) {
    return safeParse(container.querySelector('#props_raw')?.value || '{}', {});
  }

  // flow_jump: leer destino, retorno y política desde el renderer
  function readFlowJump(container, node) {
    const tf = (container.querySelector('#fj_target_flow')?.value || '').trim();
    const tn = (container.querySelector('#fj_target_node')?.value || '').trim();
    const ro = !!container.querySelector('#fj_return_on_end')?.checked;
    const rtf = (container.querySelector('#fj_return_flow')?.value || '').trim();
    const rtn = (container.querySelector('#fj_return_node')?.value || '').trim();
    const pol = (container.querySelector('#fj_policy')?.value || 'onlyMissing');

    const target = (tf || tn) ? { flow_id: tf, node_id: tn } : { flow_id: '', node_id: '' };
    let return_target = null;
    // Si el usuario selecciona explícitamente un retorno, guardarlo; si deja vacío el nodo
    // de retorno, interpretamos que el retorno usa el next del nodo (no persistimos nada)
    if (rtf || rtn) {
      return_target = { flow_id: rtf, node_id: rtn };
    }
    return { target, return_on_end: ro, return_target, apply_start_defaults: pol };
  }

  function readStart(container) {
    // leer variables del editor visual
    const inner = container.querySelector('#start_variables_container');
    let variables = [];
    if (inner) {
      const possibleRow = inner.closest('.form-row') || inner.parentElement;
      if (possibleRow && typeof possibleRow.getValue === 'function') variables = possibleRow.getValue();
    }
    // leer idiomas desde tags visuales si existen
    let locales = [];
    const tags = container.querySelectorAll('.tags-container .tag');
    if (tags.length) {
      tags.forEach(tagEl => {
        const txt = tagEl.childNodes[0]?.textContent?.trim();
        if (txt) locales.push(txt);
      });
    } else {
      const localesRaw = container.querySelector('#start_locales')?.value || '';
      locales = localesRaw.split(',').map(s => s.trim()).filter(Boolean);
    }
    return { variables, locales };
  }

  function readAgentCall(container) {
    const agent_profile = container.querySelector('#agent_profile')?.value || '';
    const message = container.querySelector('#agent_message')?.value || '';
    const stream = !!container.querySelector('#agent_stream')?.checked;
    const save_as = container.querySelector('#agent_save_as')?.value || '';
    const toolingRaw = container.querySelector('#agent_tooling')?.value || '';
    const tooling = toolingRaw.split('\n').map(s => s.trim()).filter(Boolean);
    const tools = safeParse(container.querySelector('#agent_tools_advanced')?.value || '[]', []);
    const model = safeParse(container.querySelector('#agent_model')?.value || '{}', {});
    const system_prompt = container.querySelector('#agent_system_prompt')?.value || '';
    const search = safeParse(container.querySelector('#agent_search')?.value || '{}', {});
    const mode = container.querySelector('#agent_mode')?.value || '';
    const participantsRaw = container.querySelector('#agent_participants')?.value || '';
    const participants = participantsRaw.split('\n').map(s => s.trim()).filter(Boolean);
    // runtime block (optional)
    const timeout_ms_raw = (container.querySelector('#agent_timeout_ms')?.value || '').trim();
    const max_steps_raw = (container.querySelector('#agent_max_internal_steps')?.value || '').trim();
    const retry_raw = (container.querySelector('#agent_retry_count')?.value || '').trim();
    const runtime = {};
    if (timeout_ms_raw !== '') runtime.timeout_ms = Number(timeout_ms_raw);
    if (max_steps_raw !== '') runtime.max_internal_steps = Number(max_steps_raw);
    if (retry_raw !== '') runtime.retry_count = Number(retry_raw);
    const hasRuntime = Object.keys(runtime).length > 0;
    // Construir salida condicional según el perfil
    const base = { agent_profile, message, save_as };
    function withCommonLLM(obj) {
      obj.model = model;
      if (system_prompt) obj.system_prompt = system_prompt;
      if (stream) obj.stream = true; else obj.stream = false; // mantener explícito para UI
      if (tooling && tooling.length) obj.tooling = tooling; else obj.tooling = [];
      if (Array.isArray(tools) && tools.length) obj.tools = tools;
      if (hasRuntime) obj.runtime = runtime;
      return obj;
    }
    switch ((agent_profile || 'normal')) {
      case 'rag': {
        const out = withCommonLLM({ ...base });
        // incluir bloque de búsqueda solo en RAG
        out.search = search;
        return out;
      }
      case 'retrieval': {
        // Solo recuperación: no incluir modelo/system_prompt/stream/tooling
        const out = { ...base };
        out.search = search;
        if (Array.isArray(tools) && tools.length) out.tools = tools; // permitir tools que no sean generativas
        if (hasRuntime) out.runtime = runtime;
        return out;
      }
      case 'coordinator': {
        const out = withCommonLLM({ ...base });
        // sin search directo (delegado a subagentes)
        if (mode) out.mode = mode;
        if (participants.length) out.participants = participants;
        return out;
      }
      case 'domain_expert': {
        const out = withCommonLLM({ ...base });
        // sin search por defecto
        return out;
      }
      case 'normal':
      default: {
        const out = withCommonLLM({ ...base });
        return out;
      }
    }
  }

  function readUseProfile(container) {
    const profile = container.querySelector('#use_profile_name')?.value || '';
    return { profile };
  }

  function readCredentialProfile(container) {
    const profile = container.querySelector('#cred_profile_name')?.value || '';
    const credentials = safeParse(container.querySelector('#cred_credentials')?.value || '{}', {});
    const persist = !!container.querySelector('#cred_persist')?.checked;
    const activate = !!container.querySelector('#cred_activate')?.checked;
    return { profile, credentials, persist, activate, __sim_only: true };
  }

  // simplified renderPropsFor delegator (keeps file small)
  function renderPropsFor(node, container, nodeIds = []) {
    container.innerHTML = '';
    if (!node) return;
    if (window.FormRenderers && typeof window.FormRenderers.renderFor === 'function') {
      window.FormRenderers.renderFor(node, container, nodeIds);
    } else {
      container.appendChild(jsonEditor({ label: 'Props (JSON libre)', id: 'props_raw', value: node.props || {} }));
    }
    // next selector para tipos que usan "next"; ocultar en nodes que no lo usan (choice, condition, button, flow_jump, end)
    if (node.type !== 'choice' && node.type !== 'condition' && node.type !== 'button' && node.type !== 'flow_jump' && node.type !== 'end') {
      const nextRow = el('div', { class: 'form-row', 'data-role': 'next' });
      nextRow.appendChild(el('label', { text: 'Siguiente (flujo · nodo)' }));
      // flujo destino
      const flowSel = el('select', { id: 'next_flow', 'data-original': (node.next?.flow_id || '') });
      const proj = window.AppProject || {};
      const flowsDict = proj.flows || {};
      const activeId = proj.active_flow_id || window.App?.state?.meta?.flow_id || '';
      const flows = Object.keys(flowsDict);
      if (flows.length === 0) {
        if (activeId) {
          const name = window.App?.state?.meta?.name || activeId;
          flowSel.appendChild(el('option', { value: activeId, text: name + ' (actual)' }));
        }
      } else {
        flows.forEach(fid => {
          const name = flowsDict[fid]?.meta?.name || fid;
          const txt = (fid === activeId) ? (name + ' (actual)') : name;
          flowSel.appendChild(el('option', { value: fid, text: txt }));
        });
        if (activeId && !flows.includes(activeId)) {
          const name = window.App?.state?.meta?.name || activeId;
          flowSel.appendChild(el('option', { value: activeId, text: name + ' (actual)' }));
        }
      }
      const initialNextFlowId = node.next?.flow_id || activeId || (flows[0] || '');
      if (initialNextFlowId) flowSel.value = initialNextFlowId;
      // nodo destino dependiente
      const nodeSel = el('select', { id: 'next_node', 'data-original': (node.next?.node_id || '') });
      function refreshNodeSel() {
        const fid = flowSel.value || activeId || '';
        const proj = window.AppProject || {};
        const nodesDict = proj.flows?.[fid]?.nodes || (window.App?.state?.nodes || {});
        const currentVal = nodeSel.value;
        nodeSel.innerHTML = '';
        nodeSel.appendChild(el('option', { value: '', text: '(ninguno / start)' }));
        Object.keys(nodesDict).forEach(nid => {
          if (nid === node.id) return; // evitar self-loop
          const n = nodesDict[nid];
          const label = (n?.type === 'start') ? `🚀 ${nid} (start)` : `${nid} · ${n?.type || ''} `.trim();
          nodeSel.appendChild(el('option', { value: nid, text: label }));
        });
        const want = (node.next?.node_id) || currentVal || '';
        if (want) nodeSel.value = want;
      }
      refreshNodeSel();
      flowSel.addEventListener('change', refreshNodeSel);
      // acción: Ir al destino
      const goBtn = el('button', { type: 'button', text: 'Ir al destino' });
      goBtn.className = 'ml-2 px-2 py-1 bg-white border rounded text-sm';
      goBtn.addEventListener('click', () => {
        try {
          const fid = flowSel.value || window.AppProject?.active_flow_id || '';
          const nid = nodeSel.value || (window.AppProject?.flows?.[fid]?.meta?.start_node || window.App?.state?.meta?.start_node || '');
          if (!fid) return alert('Selecciona un flujo destino');
          if (window.AppProject?.flows?.[fid]) {
            const f = window.AppProject.flows[fid];
            if (window.App && typeof window.App.importJson === 'function') window.App.importJson({ flow_id: fid, meta: f.meta, nodes: f.nodes });
            window.AppProject.active_flow_id = fid;
          }
          if (typeof window.App?.selectNode === 'function' && nid) window.App.selectNode(nid);
        } catch (e) { console.warn('Ir al destino (next) falló', e); }
      });
      const wrap = el('div', { style: 'display:flex; gap:8px; align-items:center;' }, [flowSel, nodeSel, goBtn]);
      nextRow.appendChild(wrap);
      container.appendChild(nextRow);
    }

    return function readValues() {
      let out = {};
      try {
        switch (node.type) {
          case 'response': out = readResponse(container); break;
          case 'input': out = readInput(container); break;
          case 'choice': out = readChoice(container); break;
          case 'button': out = readButton(container); break;
          case 'multi_button': out = readMultiButton(container); break;
          case 'rest_call': out = readRestCall(container); break;
          case 'assign_var': out = readAssignVar(container); break;
          case 'start': out = readStart(container); break;
          case 'condition': out = readCondition(container); break;
          case 'set_goto': out = readSetGoto(container); break;
          case 'loop': out = readLoop(container); break;
          case 'foreach': out = readLoop(container); break;
          case 'debug': out = readDebug(container); break;
          case 'adaptive_card': out = readDefault(container); break;
          case 'hero_card': out = readHeroCard(container); break;
          case 'carousel': out = readCarousel(container); break;
          case 'form': out = readForm(container, node); break;
          case 'file_upload': out = readFileUpload(container); break;
          case 'json_export': out = readJsonExport(container); break;
          case 'file_download': out = readFileDownload(container); break;
          case 'flow_jump': out = readFlowJump(container, node); break;
          case 'agent_call': out = readAgentCall(container); break;
          case 'use_profile': out = readUseProfile(container); break;
          case 'credential_profile': out = readCredentialProfile(container); break;
          default: out = readDefault(container); break;
        }
      } catch (err) {
        console.warn('Error leyendo propiedades:', err);
        alert('Error leyendo propiedades: revisa la sintaxis JSON en campos complejos.');
      }
      if (node.type !== 'choice') {
        const nextSel = container.querySelector('#next_node');
        const flowSel = container.querySelector('#next_flow');
        if (nextSel && flowSel) {
          const origNode = nextSel.getAttribute('data-original') || '';
          const origFlow = flowSel.getAttribute('data-original') || '';
          const selNode = nextSel.value || '';
          const selFlow = flowSel.value || '';
          const changed = (selNode !== origNode) || (selFlow !== origFlow);
          if (changed) {
            if (selNode || selFlow) out.next = { flow_id: selFlow, node_id: selNode || undefined };
            else out.next = null;
          }
        }
      }
      // Leer descripcion común
      const descTa = container.querySelector('#node_descripcion');
      if (descTa) {
        out.descripcion = descTa.value.trim();
      }
      return out;
    };
  }

  return { renderPropsFor };
})();
