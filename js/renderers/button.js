// button.js - renderer del nodo button
(function () {
  const { safe, adoptTemplate, setupValidation, markFieldUsed, hasStaticLabels, deriveLocales } = window.RendererHelpers || {};
  const H = window.FormBuilderHelpers || {};
  const inputRow = H.inputRow || function () { return document.createElement('div'); };
  const el = H.el || function (tag, attrs = {}, children = []) {
    const e = document.createElement(tag);
    if (attrs && typeof attrs === 'object') {
      Object.keys(attrs).forEach(key => {
        if (key === 'className') {
          e.className = attrs[key];
        } else if (key.startsWith('data-')) {
          e.setAttribute(key, attrs[key]);
        } else {
          e[key] = attrs[key];
        }
      });
    }
    (children || []).forEach(c => {
      if (c) e.appendChild(c);
    });
    return e;
  };

  // Helper para poblar un <select> con opciones de nodos evitando el nodo actual
  function populateNodeOptions(selectEl, nodes, excludeId) {
    if (!selectEl) return;
    selectEl.innerHTML = '';
    selectEl.appendChild(el('option', { value: '', text: '(ninguno / start)' }));
    (nodes || []).forEach(nid => { if (nid !== excludeId) selectEl.appendChild(el('option', { value: nid, text: nid })); });
  }

  function renderButton(node, container, nodeIds) {
    // validator se declara arriba para evitar TDZ cuando toggleVisibility llama a runValidation
    let validator = null;
    // Esperar templates sólo si aún no están cargados; usar la bandera global estándar (__templatesReady)
    // Nota: adoptTemplate ya es tolerante (si no hay template inserta un slot fallback),
    // por lo que esta espera es best-effort. Evitamos bloquear si los templates no exponen la bandera previa.
    if (typeof window.__templatesReady !== 'undefined' && !window.__templatesReady) {
      container.innerHTML = '<div class="p-4 text-gray-600">Cargando template...</div>';
      const onReady = () => { try { renderButton(node, container, nodeIds); } catch (_) { } };
      document.addEventListener('templates:ready', onReady, { once: true });
      return;
    }

    // Intentar adoptar template; si no existe, crear uno mínimo inline (fallback)
    container = adoptTemplate(container, 'button', 'button-form-slot');
    if (!container?.classList?.contains('button-form-slot')) {
      const fallback = document.createElement('div');
      fallback.className = 'button-form-slot';
      (container?.appendChild ? container : document.body).appendChild(fallback);
      container = fallback;
    }
    function collectButtonState() {
      const qv = sel => container.querySelector(sel)?.value?.trim();
      const btns = Array.isArray(node.options) ? node.options : [];
      return {
        mode: qv('#button_mode') || 'static',
        optional: !!container.querySelector('#btn_optional')?.checked,
        src: qv('#btn_source_list input, #btn_source_list'),
        labelExpr: qv('#btn_label_expr input, #btn_label_expr'),
        valueExpr: qv('#btn_value_expr input, #btn_value_expr'),
        nextFlow: qv('#button_next_flow'),
        nextNode: qv('#button_next'),
        btns,
        locales: deriveLocales(node, ['en']),
        hasStaticLabels: hasStaticLabels(btns)
      };
    }
    function buildButtonRules(st) {
      const rules = [];
      if (st.mode === 'dynamic') {
        rules.push({ kind: 'error', when: !st.src, msg: 'Debes indicar la lista (source_list) para modo dinámico.', field: '#btn_source_list' });
        rules.push({ kind: 'warning', when: !st.labelExpr, msg: 'Sin label_expr: se intentará usar item.label o item.name.', field: '#btn_label_expr' });
        rules.push({ kind: 'warning', when: !st.valueExpr, msg: 'Sin value_expr: se usará el item completo como valor.', field: '#btn_value_expr' });
        rules.push({ kind: 'error', when: !(st.nextNode || st.nextFlow), msg: 'Debes definir el "Siguiente (flujo · nodo)" en modo dinámico.', field: '#button_next' });
      } else {
        // Permitir guardar con 1 sola opción mientras tenga etiqueta
        rules.push({ kind: 'error', when: !st.hasStaticLabels && !st.optional, msg: 'Debes definir al menos una opción con etiqueta o marcar el botón como opcional.' });
        rules.push({ kind: 'warning', when: !st.hasStaticLabels && st.optional, msg: 'Botón opcional sin opciones: se saltará en ejecución.' });
        // Advertir si hay opciones con etiqueta pero sin valor definido
        const anyMissingValue = Array.isArray(st.btns) && st.btns.some(b => {
          const hasLabel = !!(b?.label) || (b?.i18n && Object.values(b.i18n).some(v => (v?.text || '').trim() !== ''));
          const hasValue = (b?.value != null && String(b.value).trim() !== '');
          return hasLabel && !hasValue;
        });
        rules.push({ kind: 'warning', when: anyMissingValue, msg: 'Alguna opción no tiene "valor" definido; si el backend no aplica fallback, usa este campo para valores estables.' });
      }
      return rules;
    }

    function infoIcon(text) { const wrap = el('span', { class: 'info-tip', 'data-tip': text }); wrap.textContent = 'ⓘ'; return wrap; }

    // Floating tooltip (lazy initialization)
    let floatingTip;
    function getFloatingTip() {
      if (!floatingTip) {
        floatingTip = document.getElementById('floatingFieldTooltip');
        if (!floatingTip && document.body) {
          floatingTip = document.createElement('div');
          floatingTip.id = 'floatingFieldTooltip';
          floatingTip.className = 'floating-field-tooltip';
          document.body.appendChild(floatingTip);
        }
      }
      return floatingTip;
    }
    function showFloatingTip(ev, text) {
      if (!text) {
        return;
      }
      const tip = getFloatingTip();
      if (!tip) return;
      tip.textContent = text;
      tip.style.display = 'block';
      const r = ev.target.getBoundingClientRect();
      tip.style.left = (r.left + window.scrollX + r.width / 2) + 'px';
      tip.style.top = (r.top + window.scrollY - 8 - tip.offsetHeight) + 'px';
    }
    function hideFloatingTip() { const tip = getFloatingTip(); if (tip) tip.style.display = 'none'; }
    container.addEventListener('mouseover', e => { const t = e.target.closest('.info-tip'); if (t) showFloatingTip(e, t.getAttribute('data-tip')); });
    container.addEventListener('mouseout', e => { if (e.target.closest('.info-tip')) hideFloatingTip(); });

    // Localized texto base (usar prompt si existe, fallback a text)
    const locales = (window.App?.state?.meta?.locales?.length) ? window.App.state.meta.locales : ['en'];
    locales.forEach(loc => {
      const val = node.i18n?.[loc]?.prompt ?? node.i18n?.[loc]?.text ?? '';
      container.appendChild(inputRow({ label: `Texto (${loc})`, id: `i18n_text_${loc}`, value: val }));
    });

    // Mode selector
    const modeRow = el('div', { class: 'form-row flex items-center gap-2' });
    const modeLbl = el('label', { text: 'Modo' });
    modeLbl.appendChild(infoIcon('static: lista fija de opciones. dynamic: genera opciones desde una lista (source_list).'));
    modeRow.appendChild(modeLbl);
    const modeSel = el('select', { id: 'button_mode' });
    ['static', 'dynamic'].forEach(m => {
      const opt = el('option', { value: m, text: m });
      if ((node.mode || 'static') === m) { opt.selected = true; }
      modeSel.appendChild(opt);
    });
    modeRow.appendChild(modeSel);
    container.appendChild(modeRow);

    // Variant selector
    const variantRow = el('div', { class: 'form-row flex items-center gap-2' });
    const varLbl = el('label', { text: 'Variante' });
    varLbl.appendChild(infoIcon('Define el estilo semántico (primary/secondary/tertiary).'));
    variantRow.appendChild(varLbl);
    const variantSel = el('select', { id: 'button_variant' });
    ['primary', 'secondary', 'tertiary'].forEach(v => {
      const opt = el('option', { value: v, text: v });
      if ((node.variant || 'primary') === v) { opt.selected = true; }
      variantSel.appendChild(opt);
    });
    variantRow.appendChild(variantSel);
    container.appendChild(variantRow);
    // Save selection variable
    const defaultSave = (node.save_as && String(node.save_as).trim()) || (node.id ? `selected_button_${node.id}` : '');
    const saveRow = inputRow({ label: `Guardar selección en (save_as) — sugerido: ${defaultSave || '(defínelo)'}`, id: 'btn_save_as', value: defaultSave, placeholder: 'p.ej. selected_button_<nodeId>' });
    saveRow.querySelector('label')?.appendChild(infoIcon('Nombre de variable donde guardar la selección (label/value).'));
    container.appendChild(saveRow);

    // Next selector (flujo + nodo)
    const nextRow = el('div', { class: 'form-row', id: 'button_next_row' });
    nextRow.appendChild(el('label', { text: 'Siguiente (flujo · nodo)' }));
    const nextFlowSel = el('select', { id: 'button_next_flow' });
    const getActiveFlowId = () => (globalThis.AppProject?.active_flow_id) || (globalThis.App?.state?.meta?.flow_id) || '';
    const getActiveFlowName = () => {
      const fid = getActiveFlowId();
      if (!fid) return '';
      const flows = window.AppProject?.flows || {};
      const name = flows?.[fid]?.meta?.name || window.App?.state?.meta?.name || fid;
      return name;
    };
    const buildActualFlowOption = () => {
      const name = getActiveFlowName();
      const label = name ? `${name} (actual)` : '(actual)';
      const opt = el('option', { value: '', text: label });
      return opt;
    };
    nextFlowSel.appendChild(buildActualFlowOption());
    const flows = Object.keys(window.AppProject?.flows || {});
    const activeFid = getActiveFlowId();
    flows.forEach(fid => { if (fid !== activeFid) nextFlowSel.appendChild(el('option', { value: fid, text: fid })); });
    nextFlowSel.value = node.next?.flow_id || '';
    const nextNodeSel = el('select', { id: 'button_next' });
    function refreshNextNode() {
      const fid = nextFlowSel.value || (window.AppProject?.active_flow_id || '');
      let nodes = [];
      if (fid && window.AppProject?.flows?.[fid]?.nodes) nodes = Object.keys(window.AppProject.flows[fid].nodes);
      else if (window.App?.state?.nodes) nodes = Object.keys(window.App.state.nodes || {});
      const cur = nextNodeSel.value;
      populateNodeOptions(nextNodeSel, nodes, node.id);
      const want = node.next?.node_id || cur || '';
      if (want) nextNodeSel.value = want;
    }
    refreshNextNode();
    nextFlowSel.addEventListener('change', function onNextFlowChange() {
      // rebuild '(actual)' label in case active flow changed
      try {
        const first = nextFlowSel.querySelector('option[value=""]');
        if (first) first.text = (function () { const name = getActiveFlowName(); return name ? `${name} (actual)` : '(actual)'; })();
      } catch (_e) { }
      refreshNextNode();
      // persist immediately even if node select isn't touched
      const v = nextNodeSel.value || '';
      const f = nextFlowSel.value || '';
      node.next = (v || f) ? { flow_id: f, node_id: v } : null;
    });
    nextNodeSel.addEventListener('change', function onNextChange() {
      const v = nextNodeSel.value || '';
      const f = nextFlowSel.value || '';
      node.next = (v || f) ? { flow_id: f, node_id: v } : null;
    });
    const goNextBtn = el('button', { type: 'button', text: 'Ir al destino' });
    goNextBtn.className = 'ml-2 px-2 py-1 bg-white border rounded text-sm';
    goNextBtn.addEventListener('click', () => {
      try {
        const activeFlowId = window.AppProject?.active_flow_id || window.App?.state?.meta?.flow_id || '';
        const fid = nextFlowSel.value || activeFlowId || '';
        let nid = nextNodeSel.value || '';
        if (!fid) return alert('Selecciona un flujo destino');

        if (fid !== activeFlowId) {
          if (window.AppProject?.flows?.[fid]) {
            const f = window.AppProject.flows[fid];
            if (window.App && typeof window.App.importJson === 'function') window.App.importJson({ flow_id: fid, meta: f.meta, nodes: f.nodes });
            window.AppProject.active_flow_id = fid;
          }
        }

        if (!nid) {
          const start = window.AppProject?.flows?.[fid]?.meta?.start_node || window.App?.state?.meta?.start_node || '';
          nid = start;
        }
        if (typeof window.App?.selectNode === 'function' && nid) window.App.selectNode(nid);
      } catch (e) { console.warn('Ir al destino (button next) falló', e); }
    });
    nextRow.appendChild(el('div', { style: 'display:flex;gap:8px;align-items:center;' }, [nextFlowSel, nextNodeSel, goNextBtn]));
    container.appendChild(nextRow);

    // Provider section (dynamic mode)
    const providerWrap = el('div', { id: 'button_provider_wrap', class: 'provider-wrap border rounded p-2 mb-2 bg-white/70', style: 'display:none;position:relative;' });
    const provHeader = el('div', { class: 'flex items-center justify-between mb-1' });
    provHeader.appendChild(el('div', { class: 'text-xs font-semibold text-gray-700', text: 'Datos dinámicos' }));
    const advToggleProv = el('button', { type: 'button', text: 'Avanzado ▾', class: 'px-2 py-1 text-xs rounded bg-blue-50 hover:bg-blue-100 border border-blue-200 transition' });
    provHeader.appendChild(advToggleProv); providerWrap.appendChild(provHeader);
    providerWrap.appendChild(inputRow({ label: 'Lista (source_list)', id: 'btn_source_list', value: node.provider?.source_list || node.dynamic_options_from || '', placeholder: 'context.items' }));
    providerWrap.querySelector('#btn_source_list label')?.appendChild(infoIcon('Expresión que debe resolver a un array. Ej: context.productos o context.apiResult.items'));

    function resolveDynamicSourceValue(sourceKey, nodeRef) {
      if (!sourceKey) return null;
      let payload = null;
      if (window.Simulador?.getVariable) payload = safe(() => window.Simulador.getVariable(sourceKey), 'preview:getVariable');
      if (!payload) {
        const startId = window.App?.state?.meta?.start_node; const varsArr = window.App?.state?.nodes?.[startId]?.variables;
        if (Array.isArray(varsArr)) { const v = varsArr.find(x => x?.name === sourceKey); if (v) payload = v.defaultValue; }
      }
      if (!payload) payload = nodeRef.provider?.previewData;
      return payload;
    }
    function openPreviewModal(sourceKey, payload) {
      const val = payload;
      let text;
      if (typeof val === 'string') text = val; else text = safe(() => JSON.stringify(val, null, 2), 'preview:stringify') || String(val);
      const pre = document.createElement('pre');
      pre.style.cssText = 'background:#f8fafc;border:1px solid #e6eef6;padding:8px;border-radius:6px;max-height:60vh;overflow:auto;font-size:11px;';
      pre.textContent = text;
      const bodyEl = document.createElement('div');
      bodyEl.appendChild(pre);
      window.UIHelpers?.createModal({
        title: 'Contenido conocido — ' + (sourceKey || '(sin clave)'),
        bodyEl,
        actions: [{ label: 'Cerrar', kind: 'primary' }]
      });
    }
    const previewBtnRow = el('div', { class: 'form-row' });
    const previewBtn = el('button', { type: 'button', text: 'Ver contenido conocido', class: 'px-2 py-1 text-sm rounded bg-gray-100 border' });
    previewBtn.addEventListener('click', () => { const sourceKey = (container.querySelector('#btn_source_list input, #btn_source_list')?.value || '').trim(); const payload = resolveDynamicSourceValue(sourceKey, node); if (!payload) { alert('No se encontró contenido conocido para la fuente: ' + (sourceKey || '(vacío)') + '\nEjecuta la simulación o define node.provider.previewData.'); return; } openPreviewModal(sourceKey, payload); });
    previewBtnRow.appendChild(previewBtn); providerWrap.appendChild(previewBtnRow);
    providerWrap.appendChild(inputRow({ label: 'Campo label (label_expr)', id: 'btn_label_expr', value: node.provider?.label_expr || '', placeholder: 'item.nombre' }));
    providerWrap.querySelector('#btn_label_expr label')?.appendChild(infoIcon('Expresión para mostrar cada opción. Variables: item, index. Ej: item.nombre || `Item ${index+1}`'));
    providerWrap.appendChild(inputRow({ label: 'Campo valor (value_expr)', id: 'btn_value_expr', value: node.provider?.value_expr || '', placeholder: 'item.id' }));

    const exprExamples = el('div', { class: 'expr-examples flex flex-wrap gap-2 mt-1 mb-2' });
    [
      { t: 'Label: fallback', l: 'item.nombre || `Item ${index+1}`', target: '#btn_label_expr' },
      { t: 'Label: código+nombre', l: '`${item.codigo} - ${item.nombre}`', target: '#btn_label_expr' },
      { t: 'Value: id', l: 'item.id', target: '#btn_value_expr' },
      { t: 'Value: JSON', l: 'JSON.stringify(item)', target: '#btn_value_expr' }
    ].forEach(ex => {
      const b = el('button', { type: 'button', text: ex.t, class: 'px-2 py-1 text-xs rounded bg-slate-100 hover:bg-slate-200 border border-slate-300 example-btn' });
      b.addEventListener('click', () => { const field = container.querySelector(ex.target + ' input, ' + ex.target + ' textarea, ' + ex.target); if (field) { field.value = ex.l; field.dispatchEvent(new Event('input', { bubbles: true })); } });
      exprExamples.appendChild(b);
    });
    providerWrap.appendChild(exprExamples);
    providerWrap.querySelector('#btn_value_expr label')?.appendChild(infoIcon('Valor que se guardará. Ej: item.id, JSON.stringify(item), item.codigo'));

    const providerAdvanced = el('div', { id: 'btn_provider_advanced', style: 'display:none;' });
    providerAdvanced.appendChild(inputRow({ label: 'Filtro (filter_expr)', id: 'btn_filter_expr', value: node.provider?.filter_expr || '', placeholder: 'item.activo' }));
    providerAdvanced.querySelector('#btn_filter_expr label')?.appendChild(infoIcon('Mantiene solo ítems que cumplan la condición. Ej: item.stock > 0'));
    providerAdvanced.appendChild(inputRow({ label: 'Orden (sort_expr)', id: 'btn_sort_expr', value: node.provider?.sort_expr || '', placeholder: 'item.orden' }));
    providerAdvanced.querySelector('#btn_sort_expr label')?.appendChild(infoIcon('Criterio de orden; se evalúa y se usa para sort ascendente. Ej: item.prioridad'));
    providerWrap.appendChild(providerAdvanced); container.appendChild(providerWrap);
    advToggleProv.addEventListener('click', () => { const visible = providerAdvanced.style.display !== 'none'; providerAdvanced.style.display = visible ? 'none' : 'block'; advToggleProv.textContent = visible ? 'Avanzado ▾' : 'Avanzado ▴'; });

    // Optional
    const optRow = el('div', { class: 'form-row flex items-center gap-2' });
    const optChk = el('input', { type: 'checkbox', id: 'btn_optional' }); optChk.checked = !!node.optional; optRow.appendChild(optChk);
    const optLbl = el('label', { text: 'Paso opcional (si no hay selección se omite)' }); optLbl.appendChild(infoIcon('Si está marcado y no hay opciones ni entrada, el flujo continúa automáticamente.'));
    optRow.appendChild(optLbl); container.appendChild(optRow);

    // Static buttons list
    const btns = Array.isArray(node.options) ? node.options : [];
    if (btns.length === 0) {
      btns.push({ label: 'Opción 1', target: null });
      node.options = btns;
    }
    const listRow = el('div', { class: 'form-row' });
    listRow.appendChild(el('label', { text: 'Botones (etiqueta por idioma → destino)' }));
    const list = el('div', { class: 'buttons-list' }); Object.assign(list.style, { display: 'flex', flexDirection: 'column', gap: '6px' });
    const addBtn = el('button', { type: 'button', text: 'Añadir opción', class: 'mt-2 px-3 py-1 bg-blue-600 text-white rounded text-sm' });
    addBtn.addEventListener('click', () => { btns.push({ label: '', target: null }); render(); runValidation(); });
    listRow.appendChild(list); listRow.appendChild(addBtn); container.appendChild(listRow);

    function toggleVisibility() {
      const mode = modeSel.value;
      providerWrap.style.display = mode === 'dynamic' ? 'block' : 'none';
      listRow.style.display = mode === 'static' ? 'block' : 'none';
      // Mostrar el selector "Siguiente" solo en dinámico
      if (nextRow) nextRow.style.display = (mode === 'dynamic') ? 'block' : 'none';
      // Ocultar selector de variante general cuando es estático (cada opción tiene su variante)
      if (variantRow) variantRow.style.display = (mode === 'dynamic') ? 'flex' : 'none';
      // Si cambiamos a estático, limpiar next global para evitar conexiones sobrantes
      if (mode === 'static') {
        try {
          node.next = null;
          if (nextFlowSel) nextFlowSel.value = '';
          if (nextNodeSel) nextNodeSel.value = '';
        } catch (_e) { }
      }
      runValidation();
    }

    modeSel.addEventListener('change', toggleVisibility);
    // No llamar aún a runValidation hasta que validator esté listo; sólo alternar visibilidad después
    toggleVisibility();

    function createLocaleInputRow(b, loc, idx) {
      const val = b?.i18n?.[loc]?.text ?? b.label ?? '';
      const labelRow = el('div', { class: 'form-row flex items-center gap-2' });
      labelRow.appendChild(el('label', { text: `Etiqueta (${loc})` }));
      const inp = el('input', { type: 'text', id: `button_${idx}_label_${loc}`, 'data-locale': loc });
      inp.value = val;
      inp.addEventListener('input', ev => {
        // actualizar label plano y también i18n para compatibilidad
        b.label = ev.target.value;
        b.i18n = b.i18n || {}; b.i18n[loc] = b.i18n[loc] || {}; b.i18n[loc].text = ev.target.value;
      });
      labelRow.appendChild(inp);
      return labelRow;
    }
    function renderSingleButtonOption(b, idx) {
      const row = el('div', { class: 'button-item', 'data-index': String(idx) });
      Object.assign(row.style, { display: 'flex', flexDirection: 'column', gap: '6px', border: '1px solid #eee', padding: '8px' });
      const header = el('div', { class: 'flex items-center justify-between' });
      header.appendChild(el('div', { class: 'text-xs font-semibold text-gray-600', text: `Opción #${idx + 1}` }))
      const remove = el('button', { type: 'button', text: 'Eliminar', class: 'ml-2 px-2 py-1 bg-red-500 text-white rounded' });
      remove.addEventListener('click', () => { if (btns.length <= 1) { alert('Debe existir al menos un botón.'); return; } btns.splice(idx, 1); render(); });
      header.appendChild(remove); row.appendChild(header);
      const labelsWrap = el('div', { class: 'labels-wrap flex flex-col gap-1' });
      locales.forEach(loc => labelsWrap.appendChild(createLocaleInputRow(b, loc, idx)));
      row.appendChild(labelsWrap);
      // Valor por opción (estático)
      const valRow = el('div', { class: 'form-row flex items-center gap-2' });
      valRow.appendChild(el('label', { text: 'Valor (opción)' }));
      const valInp = el('input', { type: 'text', id: `button_value_${idx}`, placeholder: 'valor estable (p.ej. id)' });
      valInp.value = b.value || '';
      valInp.addEventListener('input', ev => { b.value = ev.target.value; });
      valRow.appendChild(valInp);
      row.appendChild(valRow);
      // Variante por opción (modo static)
      const optVarRow = el('div', { class: 'form-row flex items-center gap-2' });
      optVarRow.appendChild(el('label', { text: 'Variante (opción)' }));
      const optVarSel = el('select', { id: `button_variant_${idx}` });
      ['primary', 'secondary', 'tertiary'].forEach(v => {
        const o = el('option', { value: v, text: v });
        if ((b.variant || 'primary') === v) o.selected = true;
        optVarSel.appendChild(o);
      });
      optVarSel.addEventListener('change', ev => { b.variant = ev.target.value || 'primary'; });
      optVarRow.appendChild(optVarSel); row.appendChild(optVarRow);
      const tgtRow = el('div', { class: 'form-row flex items-center gap-2' });
      tgtRow.appendChild(el('label', { text: 'Destino (flujo · nodo)' }));
      const flowSel = el('select', { id: `button_tgt_flow_${idx}`, 'data-index': String(idx) });
      // First option is the active flow label
      (function () {
        const name = getActiveFlowName();
        const label = name ? `${name} (actual)` : '(actual)';
        flowSel.appendChild(el('option', { value: '', text: label }));
      })();
      const flows = Object.keys(window.AppProject?.flows || {});
      const activeFid2 = getActiveFlowId();
      flows.forEach(fid => { if (fid !== activeFid2) flowSel.appendChild(el('option', { value: fid, text: fid })); });
      flowSel.value = (b.target?.flow_id) || '';
      const nodeSel = el('select', { id: `button_tgt_${idx}`, 'data-index': String(idx) });
      function refresh() {
        const fid = flowSel.value || (window.AppProject?.active_flow_id || '');
        let nodes = [];
        if (fid && window.AppProject?.flows?.[fid]?.nodes) nodes = Object.keys(window.AppProject.flows[fid].nodes);
        else if (window.App?.state?.nodes) nodes = Object.keys(window.App.state.nodes || {});
        const cur = nodeSel.value;
        populateNodeOptions(nodeSel, nodes, node.id);
        const want = b.target?.node_id || b.next?.node_id || cur || '';
        if (want) nodeSel.value = want;
      }
      refresh();
      flowSel.addEventListener('change', function onFlowChange() {
        // Update label of '(actual)' dynamically
        try {
          const first = flowSel.querySelector('option[value=""]');
          if (first) {
            const name = getActiveFlowName();
            first.text = name ? `${name} (actual)` : '(actual)';
          }
        } catch (_e) { }
        refresh();
        // Persist target immediately using current node selection
        const v = nodeSel.value || '';
        const f = flowSel.value || '';
        b.target = (v || f) ? { flow_id: f, node_id: v } : null;
        if (!v && !f) delete b.next;
      });
      nodeSel.addEventListener('change', () => {
        const v = nodeSel.value || ''; const f = flowSel.value || '';
        b.target = (v || f) ? { flow_id: f, node_id: v } : null;
        if (!v && !f) delete b.next;
      });
      const goOptBtn = el('button', { type: 'button', text: 'Ir al destino' });
      goOptBtn.className = 'ml-2 px-2 py-1 bg-white border rounded text-sm';
      goOptBtn.addEventListener('click', () => {
        try {
          const activeFlowId = window.AppProject?.active_flow_id || window.App?.state?.meta?.flow_id || '';
          const fid = flowSel.value || activeFlowId || '';
          let nid = nodeSel.value || '';
          if (!fid) return alert('Selecciona un flujo destino (opción)');

          if (fid !== activeFlowId) {
            if (window.AppProject?.flows?.[fid]) {
              const f = window.AppProject.flows[fid];
              if (window.App && typeof window.App.importJson === 'function') window.App.importJson({ flow_id: fid, meta: f.meta, nodes: f.nodes });
              window.AppProject.active_flow_id = fid;
            }
          }

          if (!nid) {
            const start = window.AppProject?.flows?.[fid]?.meta?.start_node || window.App?.state?.meta?.start_node || '';
            nid = start;
          }
          if (typeof window.App?.selectNode === 'function' && nid) window.App.selectNode(nid);
        } catch (e) { console.warn('Ir al destino (button opción) falló', e); }
      });
      tgtRow.appendChild(flowSel); tgtRow.appendChild(nodeSel); tgtRow.appendChild(goOptBtn); row.appendChild(tgtRow);
      return row;
    }
    function render() { list.innerHTML = ''; btns.forEach((b, idx) => list.appendChild(renderSingleButtonOption(b, idx))); }
    render();

    ['btn_source_list', 'btn_label_expr', 'btn_value_expr', 'btn_filter_expr', 'btn_sort_expr', 'btn_save_value', 'btn_save_label', 'btn_save_index'].forEach(id => {
      const inp = container.querySelector('#' + id + ' input, #' + id + ' textarea, #' + id);
      if (inp && window.FormBuilderHelpers?.attachVarAutocomplete) {
        safe(() => window.FormBuilderHelpers.attachVarAutocomplete(inp, { format: 'context' }), 'attachVarAutocomplete');
        inp.addEventListener('input', runValidation);
      }
    });

    validator = setupValidation(container, {
      boxId: 'button_validation_box',
      okMessage: '✔ Sin problemas',
      collectState: collectButtonState,
      buildRules: buildButtonRules
    });
    function runValidation() {
      if (!validator) return;
      ['btn_source_list', 'btn_label_expr', 'btn_value_expr'].forEach(fid => container.querySelector('#' + fid)?.classList.remove('field-error', 'field-warning'));
      validator.run();
      container.querySelectorAll('.info-tip').forEach(ic => ic.classList.remove('info-error', 'info-warning'));
      ['btn_source_list', 'btn_label_expr', 'btn_value_expr'].forEach(fid => {
        const host = container.querySelector('#' + fid);
        if (!host) return;
        const icon = host.querySelector('.info-tip');
        if (!icon) return;
        if (host.classList.contains('field-error')) { icon.classList.add('info-error'); }
        else if (host.classList.contains('field-warning')) { icon.classList.add('info-warning'); }
      });
    }
    const validationResult = validator.run();
    markFieldUsed(container.querySelector('.button-form-slot'));
    document.dispatchEvent(new CustomEvent('renderer:after', { detail: { type: 'button', container, validation: validationResult } }));
  }

  window.RendererRegistry = window.RendererRegistry || {};
  window.RendererRegistry.button = renderButton;
})();
