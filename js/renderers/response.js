// response.js - renderer del nodo response
(function(){
  const { adoptTemplate, deriveLocales, setupValidation, markFieldUsed } = window.RendererHelpers || {};
  const H = window.FormBuilderHelpers || {};
  const arrayRow = H.arrayRow || function(){ return document.createElement('div'); };

  function renderResponse(node, container){
    container = adoptTemplate(container,'response','response-form-slot');
    const localesWrap = container.querySelector('#response_locales_container') || container;
    const locales = deriveLocales(node,['es']);
    // Sólo crear inputs de texto si aún no existen (idempotente)
    locales.forEach(loc=>{
      const id = `i18n_text_${loc}`;
      if(!container.querySelector(`#${id}`)){
        const arr = node.i18n?.[loc]?.text || [];
        localesWrap.appendChild(arrayRow({label:`Texto (${loc}) - una línea = un elemento`, id, value: arr}));
      }
    });
    // Pre-cargar dataInfo si existe
    let dataInfoEl = container.querySelector('#response_dataInfo');
    // Fallback si el template todavía no estaba cargado al renderizar
    if(!dataInfoEl){
      const inputRow = H.inputRow || function({id,value,label,placeholder}){ const r=document.createElement('div'); const lab=document.createElement('label'); lab.textContent=label; const inp=document.createElement('input'); inp.id=id; inp.value=value||''; inp.placeholder=placeholder||''; r.appendChild(lab); r.appendChild(inp); return r; };
      const row = inputRow({label:'Data Info (opcional)', id:'response_dataInfo', value: node.dataInfo || '', placeholder:'ej: {{user_name}} o {"k": "{{val}}"}'});
      // Insertar antes de la caja de validación si existe
      const vbox = container.querySelector('#response_validation_box');
      if(vbox) container.insertBefore(row, vbox); else container.appendChild(row);
      dataInfoEl = row.querySelector('#response_dataInfo');
    }
    if(dataInfoEl && node.dataInfo) dataInfoEl.value = node.dataInfo;
    markFieldUsed(localesWrap);
    markFieldUsed(dataInfoEl);

    function readLinesForLocale(loc){
      const ta = container.querySelector(`#i18n_text_${loc}`) || container.querySelector(`#i18n_text_${loc} textarea,#i18n_text_${loc} input`);
      const raw = (ta && 'value' in ta) ? ta.value : '';
      return raw.split('\n').map(l=>l.trim()).filter(Boolean);
    }
    const validator = setupValidation(container, {
      boxId:'response_validation_box',
      okMessage:'✔ Response válido',
      collectState(){
        const texts = locales.map(loc=>({loc, lines: readLinesForLocale(loc)}));
        const dataInfo = (dataInfoEl?.value || '').trim();
        return { texts, dataInfo };
      },
      buildRules(st){
        const totalLines = st.texts.reduce((acc,t)=>acc + t.lines.length,0);
        return [
          {kind:'error', when: totalLines===0, msg:'Debes definir al menos una línea de texto.'},
          {kind:'warning', when: !!st.dataInfo && !/\{\{.*\}\}/.test(st.dataInfo) && st.dataInfo.length<3, msg:'dataInfo muy corto, revisa si es útil.'},
          {kind:'info', when: !st.dataInfo, msg:'Sin dataInfo: se omitirá ese campo.'}
        ];
      }
    });
    container.querySelectorAll('textarea,input').forEach(inp=>{ inp.addEventListener('input', validator.run); inp.addEventListener('change', validator.run); });
    const result = validator.run();
    markFieldUsed(container.querySelector('#response_validation_box'));
    document.dispatchEvent(new CustomEvent('renderer:after', { detail: { type:'response', container, validation: result }}));
  }

  window.RendererRegistry = window.RendererRegistry || {};
  window.RendererRegistry.response = renderResponse;
})();
