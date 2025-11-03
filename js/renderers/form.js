// form.js - renderer form (UI v2 con soporte i18n para label/placeholder, tipos y select con opciones)
(function(){
  const { adoptTemplate, setupValidation, markFieldUsed } = window.RendererHelpers || {};
  const H = window.FormBuilderHelpers || {};
  const el = H.el || function(tag, attrs={}, children=[]) { const e=document.createElement(tag); if(attrs){ Object.entries(attrs).forEach(([k,v])=>{ if(k==='className') e.className=v; else if(k==='text') e.textContent=v; else e.setAttribute(k,v); }); } (children||[]).forEach(c=>e.appendChild(c)); return e; };
  const inputRow = H.inputRow || function(){ return document.createElement('div'); };

  function getLocales(){
    const ls = (window.App?.state?.meta?.locales && window.App.state.meta.locales.length) ? window.App.state.meta.locales : ['es'];
    return Array.from(ls);
  }

  function coerceField(field){
    const f = field || {};
    // Excluir 'file' (no aplicable) -> convertir a 'text'
    if (f.type === 'file') f.type = 'text';
    if (!f.type) f.type = 'text';
    if (!f.name) f.name = 'campo';
    if (typeof f.required !== 'boolean') f.required = false;
    if (f.type === 'select') {
      if (!Array.isArray(f.options)) f.options = [{ value: '' }];
    } else {
      // input-like: text/email/textarea
      if (typeof f.value !== 'string') f.value = '';
    }
    f.i18n = f.i18n || {};
    getLocales().forEach(loc => {
      f.i18n[loc] = f.i18n[loc] || {};
      if (typeof f.i18n[loc].label !== 'string') f.i18n[loc].label = '';
      if (typeof f.i18n[loc].placeholder !== 'string') f.i18n[loc].placeholder = '';
    });
    return f;
  }

  function renderForm(node, container){
    container = adoptTemplate(container,'form','form-form-slot');
    node.fields = Array.isArray(node.fields) ? node.fields.map(coerceField) : [];

    const title = el('div',{className:'text-sm font-semibold text-gray-700 mb-1', text:'Campos del formulario'});
    container.appendChild(title);

    const editorRow = el('div',{className:'form-row'});
    const list = el('div',{id:'form_fields_container', className:'fields-v2'});
    editorRow.appendChild(list);
    const addBtn = el('button',{type:'button', text:'Añadir campo', className:'mt-2 px-3 py-1 bg-blue-600 text-white rounded text-sm'});
    editorRow.appendChild(addBtn);
    container.appendChild(editorRow);

    function createTypeSelect(f){
      const sel = el('select');
      ['text','email','textarea','select'].forEach(t=>{
        const o = el('option',{value:t, text:t}); if(f.type===t) o.selected = true; sel.appendChild(o);
      });
      sel.addEventListener('change', (ev)=>{ f.type = ev.target.value; renderList(); runValidation(); });
      return sel;
    }

    function createOptionsEditor(f){
      const wrap = el('div',{className:'options-editor border rounded p-2 bg-white/70'});
      wrap.appendChild(el('div',{className:'text-xs font-semibold text-gray-600 mb-1', text:'Opciones (select)'}));
      const optsList = el('div'); wrap.appendChild(optsList);
      const add = el('button',{type:'button', text:'Añadir opción', className:'mt-2 px-2 py-1 bg-blue-600 text-white rounded text-sm'});
      add.addEventListener('click',()=>{ f.options.push({ value:'', i18n:{} }); renderOptions(); runValidation(); });
      wrap.appendChild(add);

      function renderOptions(){
        optsList.innerHTML='';
        f.options = Array.isArray(f.options) ? f.options : [];
        f.options.forEach((opt, idx)=>{
          opt.i18n = opt.i18n || {};
          const row = el('div',{className:'option-item', style:'border:1px solid #eee; padding:8px; margin:6px 0;'});
          // value
          const valRow = inputRow({label:`Valor (opción #${idx+1})`, id:`form_opt_${idx}_value`, value: opt.value||''});
          const valInp = valRow.querySelector('input,textarea') || valRow;
          valInp.addEventListener('input',(ev)=>{ opt.value = ev.target.value; });
          row.appendChild(valRow);
          // labels per locale
          getLocales().forEach(loc=>{
            opt.i18n[loc] = opt.i18n[loc] || { text:'' };
            const lab = inputRow({label:`Etiqueta (${loc})`, id:`form_opt_${idx}_lbl_${loc}`, value: opt.i18n[loc].text || ''});
            const labInp = lab.querySelector('input,textarea') || lab;
            labInp.addEventListener('input',(ev)=>{ opt.i18n[loc] = opt.i18n[loc] || {}; opt.i18n[loc].text = ev.target.value; });
            row.appendChild(lab);
          });
          // remove button
          const rm = el('button',{type:'button', text:'Eliminar', className:'ml-2 px-2 py-1 bg-red-500 text-white rounded text-sm'});
          rm.addEventListener('click',()=>{ if(f.options.length<=1){ alert('Debe existir al menos una opción.'); return; } f.options.splice(idx,1); renderOptions(); runValidation(); });
          row.appendChild(rm);
          optsList.appendChild(row);
        });
      }
      renderOptions();
      return wrap;
    }

    function renderFieldItem(f, idx){
      const item = el('div',{className:'form-field-item', 'data-index': String(idx), style:'border:1px solid #eee; padding:8px; margin:6px 0;'});
      const header = el('div',{className:'flex items-center justify-between'});
      header.appendChild(el('div',{className:'text-xs font-semibold text-gray-600', text:`#${idx+1} · ${f.name}`}));
      const rm = el('button',{type:'button', text:'Eliminar', className:'ml-2 px-2 py-1 bg-red-500 text-white rounded text-sm'});
      rm.addEventListener('click',()=>{ node.fields.splice(idx,1); renderList(); runValidation(); });
      header.appendChild(rm); item.appendChild(header);
      // name
      const nameRow = inputRow({label:'name', id:`form_f_${idx}_name`, value:f.name});
      const nameInp = nameRow.querySelector('input,textarea') || nameRow; nameInp.addEventListener('input',(ev)=>{ f.name = ev.target.value; header.firstChild.textContent = `#${idx+1} · ${f.name}`; runValidation(); });
      item.appendChild(nameRow);
      // type + required
      const typeRow = el('div',{className:'form-row', style:'display:flex; gap:12px; align-items:center;'});
      typeRow.appendChild(el('label',{text:'type'}));
      typeRow.appendChild(createTypeSelect(f));
      const req = el('input',{type:'checkbox', id:`form_f_${idx}_req`}); req.checked = !!f.required; req.addEventListener('change',(ev)=>{ f.required = !!ev.target.checked; });
      const reqLbl = el('label',{text:'required'});
      const reqWrap = el('div',{style:'display:flex; gap:6px; align-items:center;'}); reqWrap.appendChild(req); reqWrap.appendChild(reqLbl);
      typeRow.appendChild(reqWrap); item.appendChild(typeRow);
      // i18n label/placeholder
      getLocales().forEach(loc=>{
        const lab = inputRow({label:`Label (${loc})`, id:`form_f_${idx}_label_${loc}`, value: f.i18n?.[loc]?.label || ''});
        const labInp = lab.querySelector('input,textarea') || lab; labInp.addEventListener('input',(ev)=>{ f.i18n = f.i18n || {}; f.i18n[loc] = f.i18n[loc] || {}; f.i18n[loc].label = ev.target.value; });
        item.appendChild(lab);
        const ph = inputRow({label:`Placeholder (${loc})`, id:`form_f_${idx}_ph_${loc}`, value: f.i18n?.[loc]?.placeholder || ''});
        const phInp = ph.querySelector('input,textarea') || ph; phInp.addEventListener('input',(ev)=>{ f.i18n = f.i18n || {}; f.i18n[loc] = f.i18n[loc] || {}; f.i18n[loc].placeholder = ev.target.value; });
        item.appendChild(ph);
      });
      // value (solo input-like)
      if (f.type !== 'select'){
        const valRow = inputRow({label:'Valor inicial (opcional)', id:`form_f_${idx}_value`, value: f.value || ''});
        const valInp = valRow.querySelector('input,textarea') || valRow; valInp.addEventListener('input',(ev)=>{ f.value = ev.target.value; });
        item.appendChild(valRow);
      }
      // opciones para select
      if (f.type === 'select'){
        item.appendChild(createOptionsEditor(f));
      }
      return item;
    }

    function renderList(){
      list.innerHTML='';
      node.fields.forEach((f, idx)=>{ list.appendChild(renderFieldItem(f, idx)); });
    }

    addBtn.addEventListener('click',()=>{ node.fields.push(coerceField({ name:`campo_${node.fields.length+1}`, type:'text', required:false })); renderList(); runValidation(); });
    renderList();

  // Exponer getValue para el lector
  const rowEl = list; // usaremos el contenedor como row con getValue
    rowEl.getValue = () => {
      // Sanitizar salida: eliminar locales vacíos y opciones vacías
      const locales = getLocales();
      const out = node.fields.map(f => {
        const base = { name: String(f.name||'').trim(), type: f.type, required: !!f.required, i18n: {} };
        locales.forEach(loc => {
          const lbl = (f.i18n?.[loc]?.label || '').trim();
          const ph = (f.i18n?.[loc]?.placeholder || '').trim();
          if (lbl !== '' || ph !== '') base.i18n[loc] = { label: lbl || '', placeholder: ph || '' };
        });
        if (f.type === 'select'){
          const options = (Array.isArray(f.options)? f.options: []).map(o => {
            const oo = { value: String(o.value||'') , i18n: {} };
            locales.forEach(loc => {
              const txt = (o.i18n?.[loc]?.text || '').trim();
              if (txt !== '') oo.i18n[loc] = { text: txt };
            });
            return oo;
          }).filter(oo => (oo.value !== '' || Object.keys(oo.i18n||{}).length>0));
          base.options = options;
        } else {
          base.value = String(f.value||'');
        }
        return base;
      }).filter(ff => ff.name);
      return out;
    };
    // El lector busca getValue en la fila .form-row; encaminar a nuestro getValue
    editorRow.getValue = () => rowEl.getValue();

    const validator = setupValidation(container, {
      boxId:'form_validation_box',
      okMessage:'✔ Form válido',
      collectState(){
        return { fields: rowEl.getValue() };
      },
      buildRules(st){
        const rules = [];
        const fs = Array.isArray(st.fields)? st.fields : [];
        rules.push({kind:'error', when: fs.length===0, msg:'Debes definir al menos un campo.'});
        rules.push({kind:'warning', when: fs.some(f=>!f.name), msg:'Hay campos sin nombre.'});
        // select con opciones
        const selectWithoutOptions = fs.filter(f=>f.type==='select' && !(Array.isArray(f.options)&&f.options.length)).length;
        if (selectWithoutOptions>0) rules.push({kind:'error', when:true, msg:`Hay ${selectWithoutOptions} select(s) sin opciones.`});
        // Advertir si ningún locale tiene label
        const noLabels = fs.filter(f=>!f.i18n || Object.values(f.i18n).every(v => ((v.label||'').trim()===''))).length;
        if (noLabels>0) rules.push({kind:'warning', when:true, msg:`Hay ${noLabels} campo(s) sin etiqueta en ningún idioma.`});
        return rules;
      }
    });
    function runValidation(){ validator.run(); }
    const result = validator.run();
    markFieldUsed(container.querySelector('.form-form-slot'));
    document.dispatchEvent(new CustomEvent('renderer:after', { detail: { type:'form', container, validation: result }}));
  }

  window.RendererRegistry = window.RendererRegistry || {};
  window.RendererRegistry.form = renderForm;
})();
