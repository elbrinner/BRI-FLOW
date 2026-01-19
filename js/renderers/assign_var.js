// assign_var.js — soporte para múltiples asignaciones ({ target, value })
(function () {
  const { adoptTemplate, setupValidation, markFieldUsed } = globalThis.RendererHelpers || {};
  const H = globalThis.FormBuilderHelpers || {};
  const el = H.el || function (tag, attrs = {}, children = []) {
    const e = document.createElement(tag);
    if (attrs) {
      const entries = Object.entries(attrs);
      for (const pair of entries) {
        const k = pair[0]; const v = pair[1];
        if (k === 'text') e.textContent = v; else e.setAttribute(k, v);
      }
    }
    const kids = children || [];
    for (const c of kids) { e.appendChild(c); }
    return e;
  };

  // Helpers globales (dentro del IIFE) para multi‑flujo y tipos
  function collectAllFlowVars() {
    const list = [];
    try {
      const curFlowId = globalThis.AppProject?.active_flow_id || globalThis.App?.state?.flow_id || '';
      const flows = globalThis.AppProject?.flows || {};
      // helper para extraer pares {name, defaultValue, flowId}
      const pushFrom = (flowId, startNode) => {
        const vars = (startNode?.variables || []).filter(v => v?.name);
        for (const v of vars) { list.push({ name: String(v.name), defaultValue: v.defaultValue, flowId }); }
      };
      // flujo actual (preferencia primero)
      const curStartId = globalThis.App?.state?.meta?.start_node;
      if (curStartId) { pushFrom(curFlowId || '(actual)', globalThis.App?.state?.nodes?.[curStartId]); }
      // otros flujos del proyecto
      for (const fid of Object.keys(flows)) {
        if (!fid || fid === curFlowId) continue;
        const meta = flows[fid]?.meta; const startId = meta?.start_node;
        if (startId) { pushFrom(fid, flows[fid]?.nodes?.[startId]); }
      }
    } catch (error_) { console.debug('[assign_var] collectAllFlowVars failed', error_); }
    // de‑duplicar por nombre, conservando el primero (prioriza flujo actual)
    const seen = new Set();
    const out = [];
    for (const it of list) { if (!seen.has(it.name)) { seen.add(it.name); out.push(it); } }
    return out;
  }

  function getVarDef(name) {
    try {
      // flujo actual primero
      const startId = globalThis.App?.state?.meta?.start_node;
      const curList = globalThis.App?.state?.nodes?.[startId]?.variables || [];
      let def = curList.find(v => v?.name === name);
      if (def) return def;
      // otros flujos del proyecto
      const flows = globalThis.AppProject?.flows || {};
      for (const fid of Object.keys(flows)) {
        const meta = flows[fid]?.meta; const s = meta?.start_node; if (!s) continue;
        const list = flows[fid]?.nodes?.[s]?.variables || [];
        const d = list.find(v => v?.name === name); if (d) return d;
      }
    } catch (error_) { console.debug('[assign_var] getVarDef failed', error_); }
    return undefined;
  }

  function parseDefaultValue(defVal) {
    if (defVal === undefined || defVal === null) return undefined;
    if (typeof defVal === 'object') return defVal;
    if (typeof defVal === 'string') {
      const s = defVal.trim();
      if (!s) return undefined;
      try { return JSON.parse(s); }
      catch (error_) { console.warn('[assign_var] defaultValue JSON parse failed:', error_); return undefined; }
    }
    return undefined;
  }

  function isObjectVar(name) {
    const def = getVarDef(name);
    const val = def ? parseDefaultValue(def.defaultValue) : undefined;
    return val && typeof val === 'object' && !Array.isArray(val);
  }

  function renderAssignVar(node, container) {
    container = adoptTemplate(container, 'assign_var', 'assign_var-form-slot');

    // Normalizar datos legacy -> assignments
    if (!Array.isArray(node.assignments)) {
      const t = node.target || '';
      const v = node.value || '';
      node.assignments = (t || v) ? [{ target: t, value: v }] : [];
    }

    // Entrada completa (name + origin) y sólo nombres
    const allVarEntries = collectAllFlowVars();
    function getAllVarEntries() { return allVarEntries.slice(); }

    const assignmentsContainer = el('div', { id: 'assignmentsContainer', class: 'space-y-1' });
    container.appendChild(assignmentsContainer);

    // helpers para saber si una variable es "objeto" (según defaultValue en Start) — busca en todos los flujos

    function renderRow(a) {
      const row = el('div', { class: 'assignment-row' });
      // select root var
      const selTarget = el('select', { class: 'assign-target border rounded px-2 py-1 text-sm w-full min-w-0', 'aria-label': 'Variable' });
      selTarget.appendChild(el('option', { value: '', text: '-- seleccionar --' }));
      const curFlowId = globalThis.AppProject?.active_flow_id || globalThis.App?.state?.flow_id || '';
      for (const ent of getAllVarEntries()) {
        const label = ent.flowId && ent.flowId !== curFlowId ? `${ent.name} (${ent.flowId})` : ent.name;
        const opt = el('option', { value: ent.name, text: label });
        opt.dataset.originFlow = ent.flowId || '';
        selTarget.appendChild(opt);
      }
      // Opción para escribir manualmente (ej: item, data_flow.Lista[{{index}}])
      selTarget.appendChild(el('option', { value: '__manual__', text: '⭧ Escribir manualmente…' }));
      const manualRoot = el('input', { type: 'text', class: 'assign-root-manual border rounded px-2 py-1 text-sm w-full min-w-0', placeholder: 'Variable raíz (ej: item, data_flow)' });
      manualRoot.style.display = 'none';
      // path
      const pathInp = el('input', { type: 'text', class: 'assign-path border rounded px-2 py-1 text-sm w-full min-w-0', placeholder: 'Propiedad (ej: persona.nombre)', 'aria-label': 'Propiedad (objeto)' });
      // init select+path from a.target
      (function initFromTarget() {
        const tgt = a?.target || '';
        if (!tgt) return;
        if (tgt.includes('.')) {
          const parts = tgt.split('.');
          const root = parts[0];
          const rest = parts.slice(1).join('.');
          // si root no está en la lista, activar modo manual
          const hasOpt = Array.from(selTarget.options).some(o => o.value === root);
          if (hasOpt) { selTarget.value = root; }
          else { selTarget.value = '__manual__'; manualRoot.style.display = ''; manualRoot.value = root; }
          pathInp.value = rest;
        } else {
          const hasOpt = Array.from(selTarget.options).some(o => o.value === tgt);
          if (hasOpt) selTarget.value = tgt; else { selTarget.value = '__manual__'; manualRoot.style.display = ''; manualRoot.value = tgt; }
        }
      })();
      // value
      const valueAttrs = { type: 'text', class: 'assign-value border rounded px-2 py-1 text-sm w-full min-w-0', placeholder: 'Valor ("texto" | 123 | varX | {{expresion}})', value: a.value || '', 'aria-label': 'Valor' };
      const valueInp = el('input', valueAttrs);
      // manualRoot with expander
      const manualRootWrapper = el('div', { style: 'display:flex; gap:5px; align-items:center; width:100%;' });
      manualRootWrapper.style.display = 'none'; // Initially hidden
      manualRootWrapper.appendChild(manualRoot);
      const expandManual = el('button', { type: 'button', text: '⤢', title: 'Expandir' });
      expandManual.style.cssText = 'padding:0 4px; cursor:pointer; font-size:14px; min-width:24px; height:28px; border:1px solid #ddd; background:#f9f9f9; border-radius:4px;';
      if (H.openExpandedModal) expandManual.onclick = () => H.openExpandedModal(manualRoot);
      manualRootWrapper.appendChild(expandManual);

      // path with expander
      const pathWrapper = el('div', { style: 'display:flex; gap:5px; align-items:center; width:100%;' });
      pathWrapper.appendChild(pathInp);
      const expandPath = el('button', { type: 'button', text: '⤢', title: 'Expandir' });
      expandPath.style.cssText = 'padding:0 4px; cursor:pointer; font-size:14px; min-width:24px; height:28px; border:1px solid #ddd; background:#f9f9f9; border-radius:4px;';
      if (H.openExpandedModal) expandPath.onclick = () => H.openExpandedModal(pathInp);
      pathWrapper.appendChild(expandPath);

      // value with expander
      const valueWrapper = el('div', { style: 'display:flex; gap:5px; align-items:center; width:100%;' });
      valueWrapper.appendChild(valueInp);
      const expandValue = el('button', { type: 'button', text: '⤢', title: 'Expandir' });
      expandValue.style.cssText = 'padding:0 4px; cursor:pointer; font-size:14px; min-width:24px; height:28px; border:1px solid #ddd; background:#f9f9f9; border-radius:4px;';
      if (H.openExpandedModal) expandValue.onclick = () => H.openExpandedModal(valueInp);
      valueWrapper.appendChild(expandValue);

      // actions (explorer + remove) en una sola celda para evitar saltos de fila
      const actions = el('div', { class: 'assign-actions flex items-center gap-1 justify-end' });
      const explorerBtn = el('button', { type: 'button', class: 'explorer-btn icon-only px-1.5 py-1 border rounded text-xs', title: 'Explorar', 'aria-label': 'Explorar' });
      // solo icono para ahorrar espacio
      try {
        const icon = document.createElement('span'); icon.className = 'explorer-icon'; icon.textContent = '🔎';
        explorerBtn.appendChild(icon);
      } catch (error_) { console.warn('[assign_var] No se pudo componer el botón Explorar:', error_); explorerBtn.textContent = '🔎'; }
      const removeBtn = el('button', { type: 'button', class: 'remove-assignment px-2 py-1 border rounded text-sm', title: 'Eliminar asignación', text: '−' });

      // columnas con etiqueta visible
      const colTarget = el('div', { class: 'field-col' }, [
        el('span', { class: 'field-label', text: 'Variable' }),
        selTarget,
        manualRootWrapper
      ]);
      const colPath = el('div', { class: 'field-col' }, [
        el('span', { class: 'field-label', text: 'Propiedad (objeto)' }),
        pathWrapper
      ]);
      const colValue = el('div', { class: 'field-col' }, [
        el('span', { class: 'field-label', text: 'Valor' }),
        valueWrapper
      ]);

      row.appendChild(colTarget);
      row.appendChild(colPath);
      row.appendChild(colValue);
      actions.appendChild(explorerBtn);
      actions.appendChild(removeBtn);
      row.appendChild(actions);

      // si la variable seleccionada no es objeto, ocultar path + explorer
      function currentRoot() { return (selTarget.value === '__manual__') ? (manualRoot.value || '').trim() : selTarget.value; }
      function updateManualUI() { manualRootWrapper.style.display = (selTarget.value === '__manual__') ? 'flex' : 'none'; }
      function updateVisibility() {
        const root = currentRoot();
        const isManual = (selTarget.value === '__manual__');
        const isObj = isManual ? true : (!!root && isObjectVar(root));
        // habilitar path cuando root es manual o la var raíz es objeto
        pathInp.disabled = !isObj;
        explorerBtn.disabled = !(!isManual && isObj); // deshabilitar explorer si es manual
        pathInp.placeholder = isObj ? 'Propiedad (ej: persona.nombre)' : '— no aplica —';
        if (!isObj) pathInp.value = '';
        updateManualUI();
      }
      updateVisibility();
      selTarget.addEventListener('change', updateVisibility);
      manualRoot.addEventListener('input', updateVisibility);

      return row;
    }

    function renderAssignments() {
      assignmentsContainer.innerHTML = '';
      if (!Array.isArray(node.assignments) || node.assignments.length === 0) node.assignments = [{ target: '', value: '' }];
      for (const a of node.assignments) { assignmentsContainer.appendChild(renderRow(a)); }
      // ocultar el botón eliminar cuando solo hay una fila
      const rowsNow = assignmentsContainer.querySelectorAll('.assignment-row');
      for (const r of rowsNow) {
        const removeBtn = r.querySelector('.remove-assignment');
        if (removeBtn) removeBtn.classList.toggle('hidden', rowsNow.length <= 1);
      }
      const addBtn = el('button', { type: 'button', class: 'add-assignment mt-1 px-3 py-1 bg-green-600 text-white rounded text-sm', text: '+ Añadir asignación' });
      assignmentsContainer.appendChild(addBtn);
    }
    renderAssignments();

    // Nota / ayuda
    container.appendChild(el('div', { class: 'form-row form-help' }, [
      el('small', { text: 'Si el valor empieza con {{expr}} se evaluará la expresión interna. Si contiene context. se intentará evaluar. De lo contrario se trata como literal.' })
    ]));

    function persist() {
      const rows = assignmentsContainer.querySelectorAll('.assignment-row');
      const assigns = [];
      for (const row of rows) {
        const sel = row.querySelector('.assign-target');
        const manual = row.querySelector('.assign-root-manual');
        const path = row.querySelector('.assign-path');
        const val = row.querySelector('.assign-value');
        const root = (sel?.value === '__manual__') ? (manual?.value || '') : (sel?.value || '');
        const sub = (path?.value || '').trim();
        let target = '';
        if (root) { target = sub ? (root + '.' + sub) : root; }
        assigns.push({ target, value: val?.value || '' });
      }
      node.assignments = assigns;
      delete node.target; delete node.value; // limpiar legacy
    }

    const validator = setupValidation(container, {
      boxId: 'assign_var_validation_box',
      okMessage: '✔ Assign válido',
      collectState() {
        persist();
        return { assignments: node.assignments };
      },
      buildRules(st) {
        const rules = [
          { kind: 'error', when: !st.assignments || st.assignments.every(a => !a.target), msg: 'Al menos una asignación con target requerida.' },
          { kind: 'warning', when: st.assignments?.some(a => a.target && /[^a-zA-Z0-9_.]/.test(a.target)), msg: 'Nombre de destino contiene caracteres no recomendados.' },
          { kind: 'info', when: st.assignments?.some(a => (a.value || '') === ''), msg: 'Hay valores vacíos: limpiarán la variable.' }
        ];
        return rules;
      }
    });

    assignmentsContainer.addEventListener('input', (ev) => {
      if (ev.target.classList.contains('assign-path') || ev.target.classList.contains('assign-value')) { persist(); validator.run(); }
    });
    assignmentsContainer.addEventListener('change', (ev) => {
      if (ev.target.classList.contains('assign-target')) { persist(); validator.run(); }
    });
    assignmentsContainer.addEventListener('click', async (ev) => {
      const addBtnEl = ev.target.closest('.add-assignment');
      const removeBtnEl = ev.target.closest('.remove-assignment');
      const explorerBtnEl = ev.target.closest('.explorer-btn');
      if (addBtnEl) {
        node.assignments.push({ target: '', value: '' });
        renderAssignments(); persist(); validator.run();
      } else if (removeBtnEl) {
        const rows = Array.from(assignmentsContainer.querySelectorAll('.assignment-row'));
        const idx = rows.indexOf(removeBtnEl.closest('.assignment-row'));
        if (idx >= 0) node.assignments.splice(idx, 1);
        renderAssignments(); persist(); validator.run();
      } else if (explorerBtnEl) {
        const row = explorerBtnEl.closest('.assignment-row');
        const sel = row.querySelector('.assign-target');
        const pathInp = row.querySelector('.assign-path');
        const root = sel?.value;
        if (!root) { alert('Selecciona primero la variable raíz'); return; }
        try {
          const picker = globalThis.VarExplorer.open(root);
          const chosen = await picker.waitForSelection();
          if (chosen?.path) { pathInp.value = chosen.path; persist(); validator.run(); }
        } catch (error_) { console.warn('Explorer open failed', error_); alert('No se pudo abrir el explorador'); }
      }
    });

    const result = validator.run();
    markFieldUsed(container.querySelector('.assign_var-form-slot'));
    document.dispatchEvent(new CustomEvent('renderer:after', { detail: { type: 'assign_var', container, validation: result } }));
  }

  globalThis.RendererRegistry = globalThis.RendererRegistry || {};
  globalThis.RendererRegistry.assign_var = renderAssignVar;
})();
