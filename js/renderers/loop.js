// loop.js - renderer del nodo loop extraído
(function () {
  const { safe, adoptTemplate, setupValidation, markFieldUsed } = window.RendererHelpers || {};
  const H = window.FormBuilderHelpers || {};
  const inputRow = H.inputRow || function () { return document.createElement('div'); };
  const el = H.el || function (tag, attrs = {}, children = []) { const e = document.createElement(tag); Object.entries(attrs || {}).forEach(([k, v]) => { if (k === 'text') e.textContent = v; else e.setAttribute(k, v); }); (children || []).forEach(c => e.appendChild(c)); return e; };

  function renderLoop(node, container, nodeIds) {
    container = adoptTemplate(container, 'loop', 'loop-form-slot');
    // Simplified UI: mode selector + essential fields. Advanced collapsible contains the previous fields.
    const modeRow = inputRow({ label: 'Modo', id: 'loop_mode', value: node.mode || 'foreach', placeholder: 'foreach | while' });
    // replace input with a select inside modeRow
    const modeSelect = el('select', { id: 'loop_mode_select' });
    ['foreach', 'while'].forEach(m => { const o = el('option', { value: m, text: m }); modeSelect.appendChild(o); });
    modeSelect.value = node.mode || 'foreach';
    // replace inner input element
    const mr = modeRow.querySelector('input, textarea, select');
    if (mr) {
      mr.replaceWith(modeSelect);
    }
    container.appendChild(modeRow);

    // essentials
    // create source input + picker
    const srcDiv = el('div', { class: 'form-row' });
    srcDiv.appendChild(el('label', { text: 'sourcelist' }));
    const srcWrapper = el('div', { style: 'display:flex;gap:8px;align-items:center;' });
    const srcInput = el('input', { id: 'loop_source', type: 'text' }); srcInput.value = node.source_list || '';
    srcInput.placeholder = 'items'; srcInput.style.flex = '1';
    const pickBtn = el('button', { type: 'button', text: 'Elegir...' }); pickBtn.className = 'btn-small';
    pickBtn.addEventListener('click', async () => {
      try {
        const startId = window.App?.state?.meta?.start_node;
        const startNode = startId ? window.App?.state?.nodes?.[startId] : null;
        let candidates = [];
        if (startNode && Array.isArray(startNode.variables)) {
          startNode.variables.forEach(v => {
            if (v.isList) candidates.push(v.name);
            else if (typeof v.defaultValue === 'string') {
              const s = v.defaultValue.trim(); if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) candidates.push(v.name);
            } else if (Array.isArray(v.defaultValue) || typeof v.defaultValue === 'object') candidates.push(v.name);
          });
        }
        if (!candidates.length) { alert('No se encontraron variables candidatas en Start para explorar.'); return; }
        let root = candidates[0];
        if (candidates.length > 1) {
          const sel = window.prompt('Selecciona variable raíz:\n' + candidates.map((c, i) => `${i + 1}. ${c}`).join('\n'));
          const idx = parseInt(sel, 10); if (isNaN(idx) || idx < 1 || idx > candidates.length) return; root = candidates[idx - 1];
        }
        const inst = window.VarExplorer && window.VarExplorer.open ? window.VarExplorer.open(root) : null;
        if (!inst) { alert('VarExplorer no disponible'); return; }
        const sel = await inst.waitForSelection(); if (!sel) return;
        const finalPath = sel.path ? (root + '.' + sel.path) : root;
        if (sel.type !== 'array') { if (!confirm('La ruta seleccionada no es una lista/array. ¿Usar de todos modos?')) return; }
        srcInput.value = finalPath; node.source_list = finalPath;
      } catch (e) { console.warn('picker failed', e); alert('Error al seleccionar variable: ' + e); }
    });
    srcWrapper.appendChild(srcInput); srcWrapper.appendChild(pickBtn);
    srcDiv.appendChild(srcWrapper); container.appendChild(srcDiv);
    // Foreach: item/index vars (ids expected by formbuilder.readLoop)
    const itemRow = inputRow({ label: 'Nombre del item (item_var)', id: 'loop_item_var', value: node.item_var || 'item', placeholder: 'item' });
    const indexRow = inputRow({ label: 'Nombre del índice (index_var)', id: 'loop_index_var', value: node.index_var || 'index', placeholder: 'index' });
    // While: condición (we keep legacy id loop_index_or_cond as fallback used by readLoop for cond)
    const condRow = inputRow({ label: 'Condición (expr)', id: 'loop_index_or_cond', value: (node.mode === 'while' ? (node.cond || '') : ''), placeholder: 'i < 10' });
    // sync back to node (optional immediate feedback)
    const itemInp = itemRow.querySelector('#loop_item_var'); if (itemInp) itemInp.addEventListener('input', ev => { node.item_var = (ev.target?.value || '').trim() || 'item'; });
    const indexInp = indexRow.querySelector('#loop_index_var'); if (indexInp) indexInp.addEventListener('input', ev => { node.index_var = (ev.target?.value || '').trim() || 'index'; });
    container.appendChild(itemRow);
    container.appendChild(indexRow);
    container.appendChild(condRow);
    function updateModeUI() {
      const mode = (container.querySelector('#loop_mode_select')?.value) || node.mode || 'foreach';
      if (mode === 'while') { itemRow.style.display = 'none'; indexRow.style.display = 'none'; condRow.style.display = ''; }
      else { itemRow.style.display = ''; indexRow.style.display = ''; condRow.style.display = 'none'; }
    }
    modeSelect.addEventListener('change', updateModeUI);
    updateModeUI();

    // advanced collapsible
    const advToggle = el('button', { type: 'button', text: 'Avanzado', class: 'px-2 py-1 text-xs border rounded' });
    const advBox = el('div', { class: 'mt-2 hidden advanced-loop-box' });
    advBox.appendChild(inputRow({ label: 'Máx iteraciones (max_iterations)', id: 'loop_max', value: node.max_iterations != null ? String(node.max_iterations) : '', placeholder: 'ej: 50' }));
    advBox.appendChild(inputRow({ label: 'Romper si (break_if_expr)', id: 'loop_break_if', value: node.break_if_expr || '', placeholder: 'ej: item.done' }));
    advBox.appendChild(inputRow({ label: 'Guardar conteo en (count_save_as)', id: 'loop_count_var', value: node.count_save_as || node.countVar || '', placeholder: 'loop_count' }));
    advBox.appendChild(inputRow({ label: 'Guardar último item en (last_item_save_as)', id: 'loop_last_var', value: node.last_item_save_as || node.lastVar || '', placeholder: 'last_item' }));
    advBox.appendChild(inputRow({ label: 'Filtro (filter_expr)', id: 'loop_filter', value: node.filter_expr || '', placeholder: 'item.activo' }));
    advBox.appendChild(inputRow({ label: 'Orden (sort_expr)', id: 'loop_sort', value: node.sort_expr || '', placeholder: 'item.prioridad' }));
    advToggle.addEventListener('click', () => { advBox.classList.toggle('hidden'); });
    container.appendChild(advToggle); container.appendChild(advBox);

    // Destino interno y siguiente
    const innerRow = el('div', { class: 'form-row' });
    innerRow.appendChild(el('label', { text: 'Nodo interno (body)' }));
    const innerSel = el('select', { id: 'loop_body' }); innerSel.appendChild(el('option', { value: '', text: '(ninguno)' }));
    for (const nid of nodeIds) { if (nid !== node.id) innerSel.appendChild(el('option', { value: nid, text: nid })); }
    if (node.body_start?.node_id) {
      innerSel.value = node.body_start.node_id;
    }

    function onInnerChange(ev) {
      const v = ev?.target?.value || '';
      if (v) {
        node.body_start = { flow_id: '', node_id: v };
      } else {
        node.body_start = null;
      }
    }

    innerSel.addEventListener('change', onInnerChange);
    innerRow.appendChild(innerSel); container.appendChild(innerRow);

    const nextRow = el('div', { class: 'form-row' });
    nextRow.appendChild(el('label', { text: 'Siguiente al terminar (next)' }));
    const nextSel = el('select', { id: 'loop_next' }); nextSel.appendChild(el('option', { value: '', text: '(ninguno)' }));
    for (const nid of nodeIds) { if (nid !== node.id) nextSel.appendChild(el('option', { value: nid, text: nid })); }
    if (node.next?.node_id) nextSel.value = node.next.node_id;
    nextSel.addEventListener('change', function onNextChange(ev) {
      const v = ev.target?.value || '';
      if (v) {
        node.next = { flow_id: '', node_id: v };
      } else {
        node.next = null;
      }
    });
    nextRow.appendChild(nextSel); container.appendChild(nextRow);

    // Filtro y sort opcional
    // note: filter/sort moved to advanced section

    // Caja validación
    const validator = setupValidation(container, {
      boxId: 'loop_validation_box',
      okMessage: '✔ Loop válido',
      collectState,
      buildRules
    });

    function collectState() {
      const qv = sel => container.querySelector(sel + ' input, ' + sel + ' textarea, ' + sel)?.value?.trim();
      const maxRaw = qv('#loop_max');
      const maxIter = maxRaw ? Number.parseInt(maxRaw, 10) : null;
      const mode = container.querySelector('#loop_mode_select')?.value || (node.mode || 'foreach');
      return {
        mode,
        source: qv('#loop_source'),
        itemName: qv('#loop_item_var') || 'item',
        indexOrCond: qv('#loop_index_or_cond') || (mode === 'while' ? 'i < 10' : 'index'),
        maxIter: Number.isNaN(maxIter) ? null : maxIter,
        breakIf: qv('#loop_break_if'),
        countVar: qv('#loop_count_var'),
        lastVar: qv('#loop_last_var')
      };
    }

    function buildRules(st) {
      const rules = [
        { kind: 'error', when: !st.source, msg: 'Debes definir source_list.' },
        { kind: 'warning', when: !!st.source && !/^[a-zA-Z_]/.test(st.source) && !/\{\{/.test(st.source), msg: 'sourcelist no parece una variable válida.' },
        { kind: 'warning', when: st.maxIter != null && (st.maxIter <= 0 || st.maxIter > 5000), msg: 'max_iterations inusual (<=0 o >5000).' },
        { kind: 'warning', when: !!st.breakIf && !/item|context|\{\{/.test(st.breakIf), msg: 'break_if_expr no parece usar item/context.' },
        { kind: 'warning', when: !st.countVar && !st.lastVar, msg: 'No guardas ni conteo ni último item; ¿es intencional?' }
      ];
      return rules;
    }

    function runValidation() {
      ['#loop_source', '#loop_max', '#loop_break_if'].forEach(sel => container.querySelector(sel)?.classList.remove('field-error', 'field-warning'));
      validator.run();
    }
    for (const id of ['loop_source', 'loop_item_var', 'loop_index_or_cond', 'loop_max', 'loop_break_if', 'loop_filter', 'loop_sort', 'loop_count_var', 'loop_last_var']) {
      const inp = container.querySelector('#' + id + ' input, #' + id + ' textarea, #' + id);
      if (!inp) continue;
      inp.addEventListener('input', runValidation);
      if (globalThis.FormBuilderHelpers?.attachVarAutocomplete) {
        safe(() => globalThis.FormBuilderHelpers.attachVarAutocomplete(inp, { format: 'context' }), 'loopVarAutocomplete');
      }
    }

    const validationResult = validator.run();
    markFieldUsed(container.querySelector('.loop-form-slot'));
    document.dispatchEvent(new CustomEvent('renderer:after', { detail: { type: 'loop', container, validation: validationResult } }));
  }

  globalThis.RendererRegistry = globalThis.RendererRegistry || {};
  globalThis.RendererRegistry.loop = renderLoop;
})();
