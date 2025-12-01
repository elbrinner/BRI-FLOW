// js/renderers/json_upload.js
// Renderer de propiedades para el nodo json_upload
(function () {
  const { adoptTemplate, setupValidation, markFieldUsed } = window.RendererHelpers || {};
  const H = window.FormBuilderHelpers || {};
  const inputRow = H.inputRow || function () { return document.createElement('div'); };
  const textAreaRow = H.textAreaRow || function () { return document.createElement('div'); };
  const checkboxRow = H.checkboxRow || function () { return document.createElement('div'); };
  const selectRow = H.selectRow || function () { return document.createElement('div'); };

  function renderJsonUpload(node, container) {
    container = adoptTemplate(container, 'json_upload', 'json_upload-form-slot');

    // Prompt
    container.appendChild(inputRow({
      label: 'Prompt (texto mostrado al usuario)',
      id: 'json_upload_prompt',
      placeholder: 'Sube un archivo JSON',
      value: node.prompt || ''
    }));

    // Validate (checkbox)
    const validateRow = document.createElement('div');
    validateRow.className = 'form-row';
    const validateLabel = document.createElement('label');
    validateLabel.style.display = 'flex';
    validateLabel.style.alignItems = 'center';
    validateLabel.style.gap = '8px';
    const validateCheckbox = document.createElement('input');
    validateCheckbox.type = 'checkbox';
    validateCheckbox.id = 'json_upload_validate';
    validateCheckbox.checked = node.validate !== false;
    validateLabel.appendChild(validateCheckbox);
    validateLabel.appendChild(document.createTextNode('Validar JSON (parsear antes de enviar)'));
    validateRow.appendChild(validateLabel);
    container.appendChild(validateRow);

    // Save parsed (variable local opcional)
    container.appendChild(inputRow({
      label: 'Guardar en variable local (opcional)',
      id: 'json_upload_save_parsed',
      placeholder: 'ej: uploaded_data',
      value: node.save_parsed || node.save_as || ''
    }));
    const saveNote = document.createElement('small');
    saveNote.className = 'text-xs text-gray-600 block mt-1';
    saveNote.textContent = 'Además de enviarse vía "extra", se puede guardar en una variable específica';
    container.lastChild.appendChild(saveNote);

    // Schema (JSON)
    const schemaRow = document.createElement('div');
    schemaRow.className = 'form-row';
    const schemaLabel = document.createElement('label');
    schemaLabel.textContent = 'JSON Schema (opcional, para validación)';
    schemaRow.appendChild(schemaLabel);

    const schemaTextarea = document.createElement('textarea');
    schemaTextarea.id = 'json_upload_schema';
    schemaTextarea.rows = 6;
    schemaTextarea.placeholder = '{"type": "object", "required": ["name"], "properties": {"name": {"type": "string"}}}';
    schemaTextarea.value = node.schema ? JSON.stringify(node.schema, null, 2) : '';
    schemaRow.appendChild(schemaTextarea);

    const schemaNote = document.createElement('small');
    schemaNote.className = 'text-xs text-gray-600 block mt-1';
    schemaNote.textContent = 'Define un JSON Schema simple para validar la estructura del JSON subido';
    schemaRow.appendChild(schemaNote);

    // Botón para validar schema
    const validateSchemaBtn = document.createElement('button');
    validateSchemaBtn.type = 'button';
    validateSchemaBtn.className = 'px-3 py-1 bg-blue-600 text-white rounded text-sm mt-2';
    validateSchemaBtn.textContent = 'Validar Schema';
    validateSchemaBtn.addEventListener('click', () => {
      try {
        const schemaText = schemaTextarea.value.trim();
        if (!schemaText) {
          alert('Schema vacío');
          return;
        }
        JSON.parse(schemaText);
        alert('✅ Schema JSON válido');
      } catch (e) {
        alert('❌ Schema no es JSON válido: ' + e.message);
      }
    });
    schemaRow.appendChild(validateSchemaBtn);
    container.appendChild(schemaRow);

    // On error (select)
    const errorOptions = [
      { value: 'show', label: 'Mostrar mensaje de error' },
      { value: 'fail', label: 'Fallar y detener flujo' }
    ];
    const errorRow = document.createElement('div');
    errorRow.className = 'form-row';
    const errorLabel = document.createElement('label');
    errorLabel.textContent = 'Al encontrar error';
    errorRow.appendChild(errorLabel);

    const errorSelect = document.createElement('select');
    errorSelect.id = 'json_upload_on_error';
    errorOptions.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      if (node.on_error === opt.value || (!node.on_error && opt.value === 'show')) {
        option.selected = true;
      }
      errorSelect.appendChild(option);
    });
    errorRow.appendChild(errorSelect);
    container.appendChild(errorRow);

    // Información
    const infoBox = document.createElement('div');
    infoBox.className = 'bg-blue-50 border border-blue-200 rounded p-3 mt-3 text-sm';
    infoBox.innerHTML = `
  < strong > ℹ️ Sobre json_upload</strong >
    <ul class="list-disc list-inside mt-2 text-xs">
      <li>Solo acepta archivos <code>.json</code></li>
      <li>El contenido <strong>parseado</strong> se envía como campo <code>extra</code> al backend</li>
      <li>Opcionalmente se puede guardar también en una variable local</li>
      <li>El JSON se valida antes de enviarse al siguiente nodo</li>
      <li>Se puede definir un JSON Schema para validación adicional</li>
    </ul>
`;
    container.appendChild(infoBox);

    // Setup validation
    const validator = setupValidation(container, {
      boxId: 'json_upload_validation_box',
      okMessage: '✔ JSON Upload listo',
      collectState() {
        const saveParsed = (container.querySelector('#json_upload_save_parsed input,#json_upload_save_parsed')?.value || '').trim();
        const schema = container.querySelector('#json_upload_schema')?.value.trim();
        return { saveParsed, schema };
      },
      buildRules(st) {
        return [
          { kind: 'warning', when: st.schema && (() => { try { JSON.parse(st.schema); return false; } catch { return true; } })(), msg: 'El schema no es JSON válido.' }
        ];
      }
    });

    if (validator) validator.run();
    markFieldUsed(container.querySelector('.json_upload-form-slot'));
    document.dispatchEvent(new CustomEvent('renderer:after', { detail: { type: 'json_upload', container } }));
  }

  window.RendererRegistry = window.RendererRegistry || {};
  window.RendererRegistry.json_upload = renderJsonUpload;
})();
