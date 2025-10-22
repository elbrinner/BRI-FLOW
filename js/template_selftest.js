// template_selftest.js
// Verificación ligera de que todos los templates de panel se cargaron correctamente.
(function(){
  const expected = [
    'panel-start-template',
    'panel-response-template',
    'panel-input-template',
    'panel-button-template',
    'panel-choice-template',
    'panel-rest_call-template',
    'panel-condition-template',
    'panel-loop-template',
    'panel-adaptive_card-template',
    'panel-hero_card-template',
    'panel-carousel-template',
    'panel-form-template',
    'panel-file_upload-template',
    'panel-json_export-template',
    'panel-file_download-template'
  ];

  function collectRequired() {
    const requiredFields = {};
    expected.forEach(id => {
      const tpl = document.getElementById(id);
      if(!tpl) return;
      const list = Array.from(tpl.content.querySelectorAll('[data-required-field]'))
        .map(el => el.getAttribute('data-required-field'));
      requiredFields[id] = list;
    });
    return requiredFields;
  }

  function runCheck(){
    const missing = expected.filter(id => !document.getElementById(id));
    const requiredFields = collectRequired();
    if (missing.length === 0) console.info('[TemplateSelfTest] ✔ Templates cargados (' + expected.length + ')');
    else console.warn('[TemplateSelfTest] ⚠ Faltan templates:', missing);
    window.TemplatePanelsStatus = { expected, missing, requiredFields };
  }

  if (window.__panelTemplatesReady) {
    runCheck();
  } else {
    document.addEventListener('panelTemplates:ready', runCheck, { once: true });
  }
})();
