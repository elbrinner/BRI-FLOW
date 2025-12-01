// js/variables.js
// Maneja recolección y renderizado de variables del flujo
(function () {
  function toDisplayAndTitle(raw) {
    let asString = '';
    if (raw !== null && raw !== undefined) {
      if (typeof raw === 'string') {
        asString = raw;
      } else if (typeof raw === 'object') {
        asString = JSON.stringify(raw);
      } else {
        asString = String(raw);
      }
    }
    if (asString.length > 5) {
      return { display: 'ℹ️', title: asString };
    }
    return { display: asString, title: '' };
  }

  function buildVariableItem(v) {
    const item = document.createElement('div');
    item.className = 'variable-item flex items-center justify-between';
    item.style.display = 'flex';
    item.style.justifyContent = 'space-between';
    item.style.alignItems = 'center';
    item.style.padding = '6px';
    item.style.marginBottom = '6px';
    const left = document.createElement('div');
    left.className = 'font-mono';
    left.textContent = v.name + (v.isList ? ' [lista]' : '');
    const right = document.createElement('div');
    right.style.display = 'flex';
    right.style.alignItems = 'center';
    right.style.gap = '8px';
    const val = document.createElement('span');
    val.style.color = '#d97706';
    val.className = 'font-mono';
    const raw = (v && Object.hasOwn(v, 'defaultValue')) ? v.defaultValue : '';

    // Check for boolean type explicitly
    if (typeof raw === 'boolean') {
      val.textContent = raw ? '✅ True' : '❌ False';
      val.style.color = raw ? '#059669' : '#dc2626'; // green / red
      val.style.fontWeight = 'bold';
    } else if (typeof raw === 'number') {
      val.textContent = String(raw);
      val.style.color = '#2563eb'; // blue
    } else {
      const { display, title } = toDisplayAndTitle(raw);
      if (title) {
        // Reemplazar por badge estilizado con tooltip elegante (similar a node-doc-badge)
        val.textContent = '';
        const wrap = document.createElement('span'); wrap.className = 'inline-tip-wrap';
        const badge = document.createElement('span'); badge.className = 'info-tip'; badge.setAttribute('aria-label', 'Valor oculto'); badge.setAttribute('tabindex', '0'); badge.textContent = 'i';
        const tip = document.createElement('div'); tip.className = 'inline-tip'; tip.textContent = title;
        wrap.appendChild(badge); wrap.appendChild(tip);
        val.appendChild(wrap);
      } else {
        val.textContent = display;
      }
    }
    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.title = 'Copiar variable';
    copyBtn.className = 'copy-btn';
    copyBtn.style.padding = '6px';
    copyBtn.style.borderRadius = '6px';
    copyBtn.style.border = '1px solid #c7ddff';
    copyBtn.style.background = '#eef6ff';
    copyBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><rect x="8" y="8" width="8" height="8" rx="2" stroke-width="2" stroke="currentColor" fill="none"/><rect x="4" y="4" width="8" height="8" rx="2" stroke-width="2" stroke="currentColor" fill="none"/></svg>';
    copyBtn.addEventListener('click', () => {
      const toCopy = `{{${v.name}}}`;
      navigator.clipboard.writeText(toCopy);
      if (typeof showToast === 'function') showToast(`Copiado: ${toCopy}`);
    });
    right.appendChild(val);
    right.appendChild(copyBtn);
    item.appendChild(left);
    item.appendChild(right);
    return item;
  }

  function collectVariables(state) {
    const startId = state.meta.start_node;
    const list = [];
    if (startId && Array.isArray(state.nodes[startId]?.variables)) {
      for (const v of state.nodes[startId].variables) { if (v?.name) list.push(v.name); }
    }
    for (const id in state.nodes) {
      const n = state.nodes[id];
      if (n.save_as) list.push(n.save_as);
      // set_var eliminado; sólo assign_var
    }
    return Array.from(new Set(list));
  }

  function renderVariables(state, selectNode) {
    const el = document.getElementById('variablesList');
    if (!el) return;
    const startId = state.meta.start_node;
    const declared = (startId && Array.isArray(state.nodes[startId]?.variables)) ? state.nodes[startId].variables : [];
    if (!declared.length) { el.textContent = '(sin variables definidas)'; return; }
    el.innerHTML = '';
    const list = document.createElement('div');
    list.className = 'variables-list';
    list.style.maxHeight = '240px';
    list.style.overflow = 'auto';
    list.style.paddingRight = '6px';
    for (const v of declared) { list.appendChild(buildVariableItem(v)); }
    el.appendChild(list);
    if (startId && state.nodes[startId]) {
      const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = 'Editar variables en Start';
      btn.style.marginTop = '6px';
      btn.addEventListener('click', () => { if (typeof selectNode === 'function') selectNode(startId); });
      el.appendChild(btn);
    }
  }

  try { globalThis.AppVariables = { collectVariables, renderVariables }; console.debug('[AppVariables] module loaded'); } catch (error_) { console.debug('[AppVariables] asignación fallida', error_); }
})();
