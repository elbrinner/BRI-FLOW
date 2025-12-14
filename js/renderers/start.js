// start.js - renderer del nodo start
(function () {
  const { adoptTemplate, setupValidation, markFieldUsed } = window.RendererHelpers || {};
  const H = window.FormBuilderHelpers || {};
  const el = H.el || function (tag, attrs = {}, children = []) { const e = document.createElement(tag); (children || []).forEach(c => e.appendChild(c)); return e; };
  const jsonEditor = H.jsonEditor || function () { return document.createElement('div'); };

  function renderStart(node, container) {
    container = adoptTemplate(container, 'start', 'start-form-slot');

    // Locales TAG editor
    let locales = window.App?.state?.meta?.locales || ['en'];
    const locRow = el('div', { class: 'form-row' });
    locRow.appendChild(el('label', { text: 'Idiomas (tags, Enter para agregar)' }));
    const tagsContainer = el('div', { class: 'tags-container' });
    function renderTags() {
      tagsContainer.innerHTML = '';
      locales.forEach((tag, idx) => {
        const tagEl = el('span', { class: 'tag' }); tagEl.textContent = tag;
        const rem = el('button', { type: 'button', text: '×', class: 'tag-remove' });
        rem.onclick = () => {
          locales.splice(idx, 1);
          if (window.App?.state?.meta) window.App.state.meta.locales = locales;
          renderTags();
          if (window.App?.refreshOutput) window.App.refreshOutput();
          validator.run();
        };
        tagEl.appendChild(rem); tagsContainer.appendChild(tagEl);
      });
    }
    renderTags();
    const tagInput = el('input', { id: 'start_locales_tag', type: 'text', placeholder: 'Ej: en, es, pt' });
    tagInput.addEventListener('keydown', ev => {
      if (ev.key === 'Enter' && tagInput.value.trim()) {
        const val = tagInput.value.trim();
        if (val && !locales.includes(val)) {
          locales.push(val);
          if (window.App?.state?.meta) window.App.state.meta.locales = locales;
          renderTags();
          tagInput.value = '';
          if (window.App?.refreshOutput) window.App.refreshOutput();
          validator.run();
        }
        ev.preventDefault();
      }
    });
    locRow.appendChild(tagsContainer); locRow.appendChild(tagInput); container.appendChild(locRow);

    // Debug Toggle
    const debugRow = document.createElement('div');
    debugRow.className = 'form-row flex items-center gap-2 mb-4';
    const debugCheck = document.createElement('input');
    debugCheck.type = 'checkbox';
    debugCheck.id = 'start_enable_debug';
    debugCheck.checked = (node.enable_debug !== false);
    debugCheck.addEventListener('change', (e) => { node.enable_debug = e.target.checked; });
    const debugLabel = document.createElement('label');
    debugLabel.htmlFor = 'start_enable_debug';
    debugLabel.textContent = ' Enable Global Debug';
    debugRow.appendChild(debugCheck);
    debugRow.appendChild(debugLabel);
    container.appendChild(debugRow);

    // Backend Config
    const backendRow = document.createElement('div');
    backendRow.className = 'p-3 bg-gray-50 border rounded mb-4';
    backendRow.innerHTML = '<div class="text-xs font-semibold mb-2 text-gray-600">Backend Configuration (Hybrid Execution)</div>';

    backendRow.appendChild(H.inputRow({
      label: 'Backend URL',
      id: 'start_backend_url',
      value: node.backend_url || 'http://localhost:8000',
      placeholder: 'e.g. http://localhost:8000'
    }));

    backendRow.appendChild(H.inputRow({
      label: 'API Key (Optional)',
      id: 'start_api_key',
      value: node.api_key || '',
      placeholder: 'sk-...'
    }));

    // Bind changes
    backendRow.querySelector('#start_backend_url input').addEventListener('change', e => node.backend_url = e.target.value);
    backendRow.querySelector('#start_api_key input').addEventListener('change', e => node.api_key = e.target.value);

    container.appendChild(backendRow);

    // Variables definitions
    let vars = Array.isArray(node.variables) ? node.variables : [];
    const varLabel = vars.length === 0 ? 'Variables (ninguna definida, haz clic en "Añadir variable")' : 'Variables (definidas en start)';
    if (typeof H.variablesEditor === 'function') container.appendChild(H.variablesEditor({ label: varLabel, id: 'start_variables', variables: vars }));
    else container.appendChild(jsonEditor({ label: varLabel, id: 'start_variables', value: vars }));

    // Validation box
    const validator = setupValidation(container, {
      boxId: 'start_validation_box',
      okMessage: '✔ Start válido',
      collectState() {
        return { locales: (window.App?.state?.meta?.locales) || [], vars: Array.isArray(node.variables) ? node.variables : [] };
      },
      buildRules(st) {
        const rules = [];
        rules.push({ kind: 'error', when: st.locales.length === 0, msg: 'Debes definir al menos un idioma.' });
        const names = st.vars.map(v => v?.name).filter(Boolean);
        const dup = names.filter((n, i) => names.indexOf(n) !== i);
        rules.push({ kind: 'error', when: dup.length > 0, msg: 'Variables duplicadas: ' + [...new Set(dup)].join(', ') });
        rules.push({ kind: 'warning', when: names.length === 0, msg: 'Sin variables definidas: puedes agregarlas ahora o más tarde.' });
        return rules;
      }
    });
    const result = validator.run();
    markFieldUsed(container.querySelector('.start-form-slot'));
    document.dispatchEvent(new CustomEvent('renderer:after', { detail: { type: 'start', container, validation: result } }));
  }

  window.RendererRegistry = window.RendererRegistry || {};
  window.RendererRegistry.start = renderStart;
})();
