// simulador.js
// MVP: motor de simulación que usa el JSON generado por el editor (App.generateFlowJson)
(function(){
  const SIMULATOR_BUILD_ID = 'debug-inline-v2-20251009';
  window.SIMULATOR_BUILD_ID = SIMULATOR_BUILD_ID;
  console.log('[Simulador] Inicializando simulador... build=', SIMULATOR_BUILD_ID);
  const MAX_STEPS = 500;
  let flow = null;
  let state = null; // variables + history + selections
  let running = false;
  let stepTimeout = null;
  let stepDelay = 600; // ms entre pasos en modo automático
  let fastMode = false; // modo rápido (sin delays)
  let showDiffs = true; // mostrar diffs de variables en chat/panel
  let useRealHttp = true; // usar llamadas HTTP reales en lugar de mock
  let preferEditorFlow = true; // forzado: siempre recargar del editor al iniciar
  // Persistir preferencia forzada
  try{ if(typeof localStorage !== 'undefined') localStorage.setItem('simulator.preferEditorFlow','1'); }catch(_e){}

  // Multi‑flujo (básico): mapa de flujos disponibles y flujo actual
  let simFlowsById = {}; // { [flow_id]: flowObjNormalizado }
  let simCurrentFlowId = null;

  // Normaliza un objeto de flujo arbitrario SIN usar el global "flow"
  function normalizeFlowObject(src){
    if (!src || typeof src !== 'object') return src;
    // Crear una copia superficial para no mutar el original
    const f = { ...src };
    // Compat meta -> propiedades de nivel raíz
    try{
      const mid = f.flow_id || f.meta?.flow_id || null;
      if (!f.flow_id && mid) f.flow_id = mid;
      if (!f.name && f.meta?.name) f.name = f.meta.name;
      if (!f.locales && f.meta?.locales) f.locales = f.meta.locales;
      if (!f.start_node && f.meta?.start_node) f.start_node = f.meta.start_node;
    }catch(_e){}
    // Asegurar nodes y atajo _nodes
    f.nodes = f.nodes || {};
    f._nodes = f.nodes;
    // Migración mínima set_var -> assign_var
    try{
      Object.keys(f._nodes).forEach(k=>{ const n=f._nodes[k]; if(n && n.type==='set_var') n.type='assign_var'; });
    }catch(_e){}
    // Calcular _start
    try{
      const keys = Object.keys(f._nodes);
      let start = f.start_node;
      if (!start || !keys.includes(start)) start = keys.length ? keys[0] : null;
      f._start = start || null;
    }catch(_e){}
    return f;
  }

  function simEnsureFlowRegistered(f){
    if (!f) return;
    const fid = f.flow_id || f.meta?.flow_id || null;
    if (!fid) return;
    // Normalizar si aún no lo estaba (sin tocar el global flow)
    try{ if (!f._nodes) { f = normalizeFlowObject(f); } }catch(_e){}
    simFlowsById[fid] = f;
    simCurrentFlowId = simCurrentFlowId || fid;
  }

  // Importa todos los flujos presentes en AppProject al mapa del simulador
  function simImportFromProject(){
    try{
      const proj = window.AppProject;
      if (!proj || !proj.flows) return;
      Object.keys(proj.flows).forEach(fid=>{
        try{
          const rec = proj.flows[fid];
          if (!rec) return;
          // Adaptar al shape del simulador
          const obj = {
            flow_id: fid || rec.meta?.flow_id,
            name: rec.meta?.name,
            locales: rec.meta?.locales,
            start_node: rec.meta?.start_node,
            nodes: rec.nodes || {},
            meta: rec.meta || { flow_id: fid }
          };
          const norm = normalizeFlowObject(obj);
          simFlowsById[norm.flow_id || fid] = norm;
          if (!simCurrentFlowId) simCurrentFlowId = norm.flow_id || fid;
        }catch(_e){}
      });
    }catch(_e){}
  }

  function simSetActiveFlow(flowId){
    if (!flowId || !simFlowsById[flowId]) {
      // Intentar importarlo desde AppProject si existe
      try{
        simImportFromProject();
      }catch(_e){}
      if (!simFlowsById[flowId]) {
        console.warn('[Simulador] flujo destino no disponible:', flowId);
        return false;
      }
    }
    flow = simFlowsById[flowId];
    simCurrentFlowId = flowId;
    // Si no hay current, ir al start de ese flujo
    if (!state) state = { variables:{}, history:[], current: null, steps:0, selections:{button:{}, choice:{}} };
    if (!state.current) state.current = flow._start || flow.start_node || null;
    try{ log(`Conmutado a flujo: ${flow.name || flow.flow_id} (${flowId})`); }catch(_e){}
    return true;
  }

  function resolveNextRef(ref){
    if (!ref) return { flowId: flow?.flow_id || null, nodeId: null };
    if (typeof ref === 'string') return { flowId: flow?.flow_id || null, nodeId: ref };
    if (typeof ref === 'object') {
      const targetFlow = ref.flow_id || flow?.flow_id || null;
      const targetNode = ref.node_id || null;
      return { flowId: targetFlow, nodeId: targetNode };
    }
    return { flowId: flow?.flow_id || null, nodeId: null };
  }

  function gotoNext(ref){
    const { flowId, nodeId } = resolveNextRef(ref);
    if (!flowId) return null;
    // Si cambiamos de flujo y existe en el mapa, conmutar
    if (flowId !== (flow?.flow_id || null)) {
      const ok = simSetActiveFlow(flowId);
      if (!ok) {
        console.warn('[Simulador] No se pudo conmutar al flujo destino:', flowId);
        return null;
      }
    }
    // Devolver nodeId o start del flujo actual si falta
    return nodeId || (flow?._start || flow?.start_node || null);
  }

  // Aplica los defaults declarados en el nodo start del flujo indicado según la política
  // policy: 'none' | 'onlyMissing' | 'overwrite'
  function applyFlowStartDefaults(flowObj, policy){
    try{
      if (!flowObj) return;
      const pol = policy || 'onlyMissing';
      if (pol === 'none') return;
      const startId = flowObj._start || flowObj.start_node;
      const startNode = startId ? flowObj._nodes?.[startId] : null;
      if (!startNode || !Array.isArray(startNode.variables)) return;
      for (const v of startNode.variables){
        const name = v && v.name ? String(v.name) : '';
        if (!name) continue;
        let def = v.defaultValue;
        // parse JSON-like strings
        if (typeof def === 'string'){
          const s = def.trim();
          if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))){
            try{ def = JSON.parse(s); }catch(_e){}
          }
        }
        // coerce number/boolean strings
        if (typeof def === 'string'){
          const t = def.trim();
          if (/^-?\d+(?:\.\d+)?$/.test(t)) {
            try{ def = Number(t); }catch(_e){}
          } else if (/^true$/i.test(t)) { def = true; } else if (/^false$/i.test(t)) { def = false; }
        }
        // deep copy
        try{ def = JSON.parse(JSON.stringify(def)); }catch(_e){}
        if (pol === 'overwrite') {
          state.variables[name] = def;
        } else if (pol === 'onlyMissing') {
          if (state.variables[name] === undefined) state.variables[name] = def;
        }
      }
    }catch(_e){ /* noop */ }
  }

  // Función para hacer llamadas HTTP reales
  async function makeHttpRequest(node) {
    const props = node.properties || {};
    const method = (props.method || node.method || 'GET').toUpperCase();
    const rawUrl = props.url || node.url || '';
    // Permitir {{variables}} en la URL usando el estado actual del simulador
    const url = typeof rawUrl === 'string' ? interpolate(rawUrl) : String(rawUrl || '');
    // Unir headers desde properties o nivel superior
    const headers = Object.assign({}, props.headers || {}, node.headers || {});
    // Cuerpo opcional para métodos con payload
    let body = props.body !== undefined ? props.body : (node.body !== undefined ? node.body : undefined);
    let fetchInit = { method, headers };
    if (['POST','PUT','PATCH','DELETE'].includes(method)) {
      if (body !== undefined) {
        // Si body es objeto, enviarlo como JSON y asegurar Content-Type
        if (typeof body === 'object') {
          if (!headers['Content-Type'] && !headers['content-type']) {
            headers['Content-Type'] = 'application/json';
          }
          fetchInit.body = JSON.stringify(body);
        } else if (typeof body === 'string' && body.trim() !== '') {
          // Permitir interpolación básica en string body
          fetchInit.body = interpolate(body);
        }
      }
    }

    try {
      const response = await fetch(url, fetchInit);
      const status = response.status;
      let data = null;
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          data = await response.json();
        } else {
          data = await response.text();
        }
      }
      return { status, ok: response.ok, data, headers: Object.fromEntries(response.headers.entries()) };
    } catch (error) {
      return { status: 0, ok: false, error: error.message, data: null };
    }
  }
  // locales soportados (se deduce del flujo cuando cargamos)

  function getLocale(){
    // Prioridad de detección de idioma:
    // 1) variable en estado
    // 2) valor guardado en localStorage
    // 3) navigator.lang
    // 4) primer locale declarado en el flujo
    // 5) fallback 'es'
    try{
      if(state && state.variables && state.variables.selected_language){
        const lang = state.variables.selected_language;
        if(flow && flow.locales && flow.locales.includes(lang)) return lang;
      }
    }catch(e){}

    try{
      const stored = (typeof localStorage !== 'undefined') ? localStorage.getItem('simulator_selected_language') : null;
      if(stored && flow && flow.locales && flow.locales.includes(stored)) return stored;
    }catch(e){}

    try{
      if(typeof navigator !== 'undefined' && navigator.language){
        const nav = navigator.language.slice(0,2).toLowerCase();
        if(flow && flow.locales && flow.locales.includes(nav)) return nav;
      }
    }catch(e){}

    if(flow && Array.isArray(flow.locales) && flow.locales.length) return flow.locales[0];
    return 'es';
  }

  // Fuerza selected_language al primer locale definido en el flujo (persistiendo en storage)
  function forcePrimaryLocale(){
    if(flow && Array.isArray(flow.locales) && flow.locales.length){
      const primary = flow.locales[0];
      if(!state) state = { variables:{}, history:[], current:null, steps:0 };
      state.variables.selected_language = primary;
      try { if(typeof localStorage!=='undefined') localStorage.setItem('simulator_selected_language', primary); } catch(e){}
      return primary;
    }
    return null;
  }

  function getI18nText(node, defaultText){
    if(!node) return defaultText || '';
    const locale = getLocale();
    if(node.i18n && node.i18n[locale] && Array.isArray(node.i18n[locale].text)){
      return node.i18n[locale].text.join('\n');
    }
    // fallback en cascada
    const fallbacks = ['es','en','pt'];
    for(const fb of fallbacks){
      if(node.i18n && node.i18n[fb] && Array.isArray(node.i18n[fb].text)) return node.i18n[fb].text.join('\n');
    }
    // legacy campos
    return node.text || defaultText || '';
  }

  // Similar a getI18nText pero para prompts de nodos input/choice/button
  function getI18nPrompt(node, defaultPrompt){
    if(!node) return defaultPrompt || '';
    const locale = getLocale();
    if(node.i18n && node.i18n[locale]){
      if (typeof node.i18n[locale].prompt === 'string') return node.i18n[locale].prompt;
      if (Array.isArray(node.i18n[locale].text)) return node.i18n[locale].text.join('\n');
    }
    // fallback en cascada
    const fallbacks = ['es','en','pt'];
    for(const fb of fallbacks){
      if(node.i18n && node.i18n[fb]){
        if (typeof node.i18n[fb].prompt === 'string') return node.i18n[fb].prompt;
        if (Array.isArray(node.i18n[fb].text)) return node.i18n[fb].text.join('\n');
      }
    }
    // legacy campo
    return node.prompt || defaultPrompt || '';
  }

  function getI18nOptions(node){
    const locale = getLocale();
    let localized = [];
    if(node && node.i18n && node.i18n[locale] && Array.isArray(node.i18n[locale].options)){
      localized = node.i18n[locale].options.map(o => ({ ...o }));
    }
    return localized;
  }
  // Helpers DOM
  const $ = (id) => document.getElementById(id);
  const log = (msg) => { const el = $('simulatorTimeline'); if(!el) return; const p = document.createElement('div'); p.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`; el.appendChild(p); el.scrollTop = el.scrollHeight; };
  
  // Utilidades: clon profundo y diff profundo para variables
  function deepClone(obj){ try{ return JSON.parse(JSON.stringify(obj)); }catch(_e){ return obj; } }

  function deepDiff(prev, curr, basePath=''){
    const diffs = [];
    const isObj = (v) => v !== null && typeof v === 'object';
    // Si ambos son estrictamente iguales o ambos son NaN/undefined/null de forma equivalente
    if(prev === curr){ return diffs; }
    // Si uno es primitivo y el otro también (o tipos distintos), marcar cambio directo
    const prevIsObj = isObj(prev); const currIsObj = isObj(curr);
    if(!prevIsObj || !currIsObj){
      diffs.push({ type: (prev === undefined) ? 'add' : (curr === undefined ? 'remove' : 'change'), path: basePath || '(root)', before: prev, after: curr });
      return diffs;
    }
    // Arrays: comparar por JSON; si difiere, marcar cambio en el path base
    if(Array.isArray(prev) || Array.isArray(curr)){
      if(JSON.stringify(prev) !== JSON.stringify(curr)){
        diffs.push({ type: 'change', path: basePath || '(root)', before: prev, after: curr });
      }
      return diffs;
    }
    // Objetos: recorrer claves
    const prevKeys = new Set(Object.keys(prev||{}));
    const currKeys = new Set(Object.keys(curr||{}));
    // añadidos
    for(const k of currKeys){ if(!prevKeys.has(k)) diffs.push({ type: 'add', path: basePath ? basePath + '.' + k : k, before: undefined, after: curr[k] }); }
    // eliminados
    for(const k of prevKeys){ if(!currKeys.has(k)) diffs.push({ type: 'remove', path: basePath ? basePath + '.' + k : k, before: prev[k], after: undefined }); }
    // comunes
    for(const k of currKeys){ if(prevKeys.has(k)){
      const childPath = basePath ? basePath + '.' + k : k;
      const childDiffs = deepDiff(prev[k], curr[k], childPath);
      if(childDiffs.length) diffs.push(...childDiffs);
    }}
    return diffs;
  }

  function formatDiffLines(diffs, maxLines = 20){
    if(!diffs || !diffs.length) return null;
    const icon = '🧩';
    const lines = [`${icon} Cambios en variables:`];
    const toJson = (v) => { try{ return JSON.stringify(v); }catch(_e){ return String(v); } };
    diffs.slice(0, maxLines).forEach(d => {
      if(d.type === 'add') lines.push(`+ ${d.path} = ${toJson(d.after)}`);
      else if(d.type === 'remove') lines.push(`− ${d.path} (antes: ${toJson(d.before)})`);
      else lines.push(`~ ${d.path}: ${toJson(d.before)} → ${toJson(d.after)}`);
    });
    if(diffs.length > maxLines){ lines.push(`… y ${diffs.length - maxLines} cambios más`); }
    return lines.join('\n');
  }

  function maybeAppendDiff(prevVarsSnapshot){
    try{
      const curr = state && state.variables ? state.variables : {};
      const diffs = deepDiff(prevVarsSnapshot || {}, curr || {});
      if(diffs.length){
        // actualizar panel debug
        try{
          const dbg = document.getElementById('debugVarDiff');
          if(dbg){
            const lines = diffs.map(d=>{
              const toJson = (v) => { try{ return JSON.stringify(v); }catch(_e){ return String(v); } };
              if(d.type==='add') return `+ ${d.path} = ${toJson(d.after)}`;
              if(d.type==='remove') return `− ${d.path} (antes: ${toJson(d.before)})`;
              return `~ ${d.path}: ${toJson(d.before)} → ${toJson(d.after)}`;
            }).join('\n');
            dbg.textContent = lines || '(sin cambios)';
          }
        }catch(_e){}
        // chat opcional
        if(showDiffs){ const message = formatDiffLines(diffs); if(message) appendChatMessage('bot', message); }
      }
    }catch(_e){}
  }
  

  function resetSimulation(){
    running = false; if(stepTimeout) { clearTimeout(stepTimeout); stepTimeout = null; }
    flow = null; state = null; $('simulatorCanvasPreview').innerHTML = 'Vista previa del flujo (nodos visitados, variables, respuestas)'; $('simulatorTimeline').innerHTML = 'Registro de ejecución del simulador';
  }

  // Helper: escapar HTML para mostrar texto seguro
  function escapeHtml(str){
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  // Sanitizar HTML de entrada permitiendo solo ciertas etiquetas y atributos seguros.
  // Usa DOMParser para parsear y reconstruir el fragmento permitiendo únicamente una whitelist.
  function sanitizeHtml(dirtyHtml){
    if(!dirtyHtml || typeof dirtyHtml !== 'string') return '';
    // quick escape if no tags
    if(dirtyHtml.indexOf('<') === -1) return escapeHtml(dirtyHtml);
    try{
      const parser = new DOMParser();
      const doc = parser.parseFromString(dirtyHtml, 'text/html');
      const allowedTags = new Set(['p','br','strong','b','em','i','ul','ol','li','a','code','pre','blockquote','h1','h2','h3','h4','h5','h6']);
      const allowedAttrs = { 'a': ['href','title','target','rel'] };
      function sanitizeNode(node){
        if(node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent || '');
        if(node.nodeType !== Node.ELEMENT_NODE) return '';
        const tag = node.tagName.toLowerCase();
        if(!allowedTags.has(tag)){
          // unwrap children
          return Array.from(node.childNodes).map(sanitizeNode).join('');
        }
        // build open tag
        let result = '<' + tag;
        const attrs = node.attributes || [];
        for(let i=0;i<attrs.length;i++){
          const a = attrs[i];
          const name = a.name.toLowerCase();
          const val = a.value || '';
          if(allowedAttrs[tag] && allowedAttrs[tag].includes(name)){
            // simple href sanitization: allow http/https/mailto and relative
            if(name === 'href'){
              const ok = /^(https?:|mailto:|\/)/i.test(val);
              if(!ok) continue;
              result += ' ' + name + '="' + escapeHtml(val) + '"';
            } else {
              result += ' ' + name + '="' + escapeHtml(val) + '"';
            }
          }
        }
        result += '>';
        // children
        result += Array.from(node.childNodes).map(sanitizeNode).join('');
        result += '</' + tag + '>';
        return result;
      }
      const body = doc.body || doc;
      return Array.from(body.childNodes).map(sanitizeNode).join('');
    }catch(e){ return escapeHtml(dirtyHtml); }
  }

  // Interpolación simple: reemplaza {{var}} por su valor en state.variables
  function interpolate(text){
    if (!text || typeof text !== 'string') return text;
    return text.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_,expr) => {
      try {
        // normalize expression: trim and collapse spaces around dots ("item. plataforma" -> "item.plataforma")
        const key = expr.trim().replace(/\s*\.\s*/g, '.');
        // simple dotted path resolver: context.x or obj.prop.sub
        const simplePathRE = /^(?:context\.)?[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/;
        if (simplePathRE.test(key) && state && state.variables){
          const path = key.replace(/^context\./, '').trim();
          const parts = path.split('.').filter(Boolean);
          let val = state.variables;
          for (let p of parts){ if (val === undefined || val === null) { val = undefined; break; } val = val[p]; }
          if (val === undefined || val === null) return '';
          if (typeof val === 'object') return JSON.stringify(val);
          // use JSON.stringify for strings to preserve quotes and avoid breaking JSON contexts
          if (typeof val === 'string') return JSON.stringify(val).slice(1, -1);
          return String(val);
        }
        const v = evaluate(key);
        return v === null || v === undefined ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v));
      } catch(e){ return ''; }
    });
  }

  // Nueva función para procesar texto con interpolación y Markdown
  // Heurística simple para detectar si un texto parece Markdown (o contiene HTML)
  function looksLikeMarkdown(text){
    if(!text || typeof text !== 'string') return false;
    // common markdown markers: headings, bold/italic, code, lists, links, blockquotes
    const mdPatterns = [/^#{1,6}\s+/m, /\*\*.+\*\*/, /\*[^\s].+\*/, /`[^`]+`/, /^\s*-\s+/m, /\[[^\]]+\]\([^\)]+\)/, /^>\s+/m];
    for(const p of mdPatterns){ if(p.test(text)) return true; }
    // also treat strings that include paragraph tags as markup
    if(text.indexOf('<') !== -1 && text.indexOf('>') !== -1) return true;
    return false;
  }

  function processText(text, renderMarkdown = false) {
    if (!text || typeof text !== 'string') return text;
  const interpolated = interpolate(text);
    if (renderMarkdown) {
      if (window.marked) {
        try{ return window.marked.parse(interpolated); }catch(e){ return interpolated; }
      }
      // fallback lightweight renderer
      try{ return renderMarkdownFallback(interpolated); }catch(e){ return interpolated; }
    }
    return interpolated;
  }

  // Lightweight Markdown fallback renderer for common patterns (headings, bold, italic, lists, links, code)
  function renderMarkdownFallback(md){
    if(!md || typeof md !== 'string') return md;
    // escape HTML first
    const esc = (s) => escapeHtml(s);
    // handle code fences ```lang\n...\n```
    md = md.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, function(_,lang,code){ return '<pre><code>' + escapeHtml(code) + '</code></pre>'; });
    // inline code
    md = md.replace(/`([^`]+)`/g, function(_,c){ return '<code>' + escapeHtml(c) + '</code>'; });
    // headings
    md = md.replace(/^######\s*(.*)$/gm, '<h6>$1</h6>');
    md = md.replace(/^#####\s*(.*)$/gm, '<h5>$1</h5>');
    md = md.replace(/^####\s*(.*)$/gm, '<h4>$1</h4>');
    md = md.replace(/^###\s*(.*)$/gm, '<h3>$1</h3>');
    md = md.replace(/^##\s*(.*)$/gm, '<h2>$1</h2>');
    md = md.replace(/^#\s*(.*)$/gm, '<h1>$1</h1>');
    // bold/italic/strikethrough
    md = md.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    md = md.replace(/__(.*?)__/g, '<strong>$1</strong>');
    md = md.replace(/\*(.*?)\*/g, '<em>$1</em>');
    md = md.replace(/_(.*?)_/g, '<em>$1</em>');
    md = md.replace(/~~(.*?)~~/g, '<del>$1</del>');
    // links [text](url)
    md = md.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function(_,text,url){
      const u = escapeHtml(url.trim());
      const t = escapeHtml(text);
      // allow only http(s), mailto or relative
      if(/^(https?:|mailto:|\/)/i.test(u)){
        return '<a href="' + u + '" target="_blank" rel="noopener noreferrer">' + t + '</a>';
      }
      return t;
    });
    // task lists and unordered lists
    // Convert lines starting with - [ ] or - [x]
    md = md.replace(/^\s*- \[x\]\s+(.*)$/gim, '<li><input type="checkbox" disabled checked> $1</li>');
    md = md.replace(/^\s*- \[ \]\s+(.*)$/gim, '<li><input type="checkbox" disabled> $1</li>');
    // unordered list
    md = md.replace(/(^|\n)\s*[-\*]\s+(.*)(?=\n|$)/g, function(_,prefix,item){ return (prefix||'') + '<li>' + item + '</li>'; });
    // wrap consecutive <li> into <ul>
    md = md.replace(/(<li>[\s\S]*?<\/li>)(\s*<li>)/g, function(_,a){ return a; });
    // simple approach: wrap blocks separated by blank line into paragraphs if they are not block tags
    const blocks = md.split(/\n\s*\n/);
    for(let i=0;i<blocks.length;i++){
      const b = blocks[i].trim();
      if(!b) { blocks[i] = ''; continue; }
      // if block already starts with block tag, keep
      if(/^<(h[1-6]|ul|ol|pre|blockquote|li|p|code)/i.test(b)) { blocks[i] = b; continue; }
      // if block contains <li> treat as list
      if(/<li>/.test(b)){
        // ensure it is wrapped
        blocks[i] = '<ul>' + b.replace(/(^|\n)\s*/g,'') + '</ul>';
        continue;
      }
      blocks[i] = '<p>' + b + '</p>';
    }
    return blocks.join('\n');
  }

  // Helper: deshabilitar botón brevemente para evitar doble click
  function disableTemporarily(el, ms = 600){ if(!el) return; try{ el.disabled = true; setTimeout(()=>{ el.disabled = false; }, ms); }catch(e){} }

  function loadFlowFromEditor(){
    try {
      if (!window.App) throw new Error('App no disponible');
      // Intento 1: forzar que el editor regenere el JSON mostrado
      try { if (typeof window.App.refreshOutput === 'function') window.App.refreshOutput(); } catch(_e){}
      // Intento 2: leer directamente del panel JSON del editor si está presente y es válido
      let parsedFromDom = null;
      try {
        const outEl = document.getElementById('jsonOutput');
        if (outEl && outEl.textContent && outEl.textContent.trim().length) {
          const txt = outEl.textContent.trim();
          const obj = JSON.parse(txt);
          if (obj && obj.nodes && Object.keys(obj.nodes).length) {
            parsedFromDom = obj;
          }
        }
      } catch(_e){}
          if (parsedFromDom) {
        flow = parsedFromDom;
      } else {
        // Fallback: generar directamente desde el estado del editor
        if (typeof window.App.generateFlowJson !== 'function') throw new Error('App.generateFlowJson no disponible');
            flow = window.App.generateFlowJson();
      }
      // marcar origen del flujo para reinicios inteligentes
      try { flow._source = 'editor'; flow._sourcePath = null; flow._sourceName = null; } catch(_e){}
          normalizeFlow();
          // Registrar en mapa multi‑flujo y poblar desde AppProject
          try { simEnsureFlowRegistered(flow); } catch(_e){}
          try { simImportFromProject(); } catch(_e){}
      log('Flujo cargado desde el editor: ' + (flow.name || flow.flow_id || 'sin nombre'));
      renderPreview();
      return flow;
    } catch(e){ log('Error al cargar flujo desde editor: ' + e.message); throw e; }
  }
  async function loadFlowFromFile(file){
    if (!file) return;
    try {
          const text = await file.text(); const obj = JSON.parse(text); flow = obj; try { flow._source = 'file'; flow._sourcePath = null; flow._sourceName = file.name || null; } catch(_e){}; normalizeFlow(); try { simEnsureFlowRegistered(flow); } catch(_e){}; log('Flujo cargado desde archivo: ' + (flow.name || flow.flow_id || 'sin nombre')); renderPreview(); return flow;
    } catch(e){ log('Error cargando archivo: ' + e.message); alert('JSON inválido: ' + e.message); }
  }

  async function loadFlowFromPath(path){
    try { const res = await fetch(path); const obj = await res.json(); flow = obj; try { flow._source = 'path'; flow._sourcePath = path; flow._sourceName = null; } catch(_e){}; normalizeFlow(); try { simEnsureFlowRegistered(flow); } catch(_e){}; log('Flujo cargado desde path: ' + path); renderPreview(); return flow; } catch(e){ log('Error fetch flow: ' + e.message); alert('No se pudo cargar flujo: ' + e.message); }
  }

  function normalizeFlow(){
    if(!flow) return;
    // ensure nodes object exists
    flow.nodes = flow.nodes || {};
    // simple index
    flow._nodes = flow.nodes;
    // Migración automática: set_var → assign_var
    try {
      let migrated = 0;
      Object.keys(flow._nodes || {}).forEach(k => {
        const n = flow._nodes[k];
        if (n && n.type === 'set_var') { n.type = 'assign_var'; migrated++; }
      });
      if (migrated > 0) {
        console.warn(`[Simulador] Migrados ${migrated} nodos set_var → assign_var`);
        try {
          if (window.Toasts && typeof window.Toasts.info === 'function') {
            window.Toasts.info(`Se migraron ${migrated} nodos set_var a assign_var en el simulador`);
          } else {
            alert(`Se migraron ${migrated} nodos set_var a assign_var en el simulador`);
          }
        } catch(_e){}
      }
    } catch(_e){}
    const keys = Object.keys(flow._nodes);
    // Validar start_node: si no existe en nodes, hacer fallback al primer nodo
    let start = flow.start_node;
    if (!start || !keys.includes(start)) {
      start = keys.length ? keys[0] : null;
    }
    flow._start = start;
  }

  function initState(){
    state = { variables: {}, history: [], current: flow._start, steps: 0, selections: { button: {}, choice: {} } };
    // init variables from start node if present
    if (flow._start && flow._nodes[flow._start] && Array.isArray(flow._nodes[flow._start].variables)){
      flow._nodes[flow._start].variables.forEach(v => {
        let def = v.defaultValue;
        // if defaultValue is a JSON string, try to parse it so complex objects become real objects
        if (typeof def === 'string'){
          const s = def.trim();
          if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))){
            try{ def = JSON.parse(s); }catch(e){ /* keep as string if parse fails */ }
          }
        }
        // coerce simple typed strings (numbers, booleans) to their proper types
        if (typeof def === 'string'){
          const t = def.trim();
          if (/^-?\d+(?:\.\d+)?$/.test(t)) {
            try{ def = Number(t); }catch(_e){}
          } else if (/^true$/i.test(t)) { def = true; } else if (/^false$/i.test(t)) { def = false; }
        }
        // deep copy to avoid mutating source
        try{ state.variables[v.name] = JSON.parse(JSON.stringify(def)); }catch(e){ state.variables[v.name] = def; }
      });
    }
    // inicializar selected_language desde storage / navegador si no está seteado
    if(flow && flow.locales && flow.locales.length){
      const preferred = getLocale();
      if(!state.variables.selected_language || !flow.locales.includes(state.variables.selected_language)){
        state.variables.selected_language = preferred;
      }
    }
    // Asegurar current válido
    if(!state.current && flow && flow._start) state.current = flow._start;
    // Forzar primer locale si usuario solicitó explicitamente (flag temporal en window)
    if(window._forcePrimaryLocale){ forcePrimaryLocale(); }
  }

  function evaluate(expr){
    try {
      try{ console.log('[Simulador] evaluate snapshot state.variables (pretty):', JSON.stringify(state && state.variables ? state.variables : {}, null, 2)); }catch(_e){}
      // If an ExpressionParser is available, try to use it first.
      // Preprocess `{{var}}` placeholders into bare variable names so the parser can consume them.
      if (window.ExpressionParser && typeof window.ExpressionParser.evaluate === 'function'){
        try{
          const epExpr = (typeof expr === 'string') ? expr.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_,n) => n.trim()) : expr;
          const epRes = window.ExpressionParser.evaluate(epExpr, { variables: state.variables });
          // if the parser returned undefined or returned the same string (didn't resolve), fall back
          if (epRes === undefined || (typeof epRes === 'string' && String(epRes).trim() === String(epExpr).trim())){
            throw new Error('ExpressionParser did not resolve');
          }
          return epRes;
        }catch(e){
          try{ console.warn('[Simulador] ExpressionParser failed or returned unresolved, falling back to JS eval fallback for expr:', expr, 'error:', e); }catch(_e){}
          // fall through to fallback evaluator
        }
      }
      // fallback: support simple patterns used in flows: simple dotted paths, {{var}} substitution, len(var), and Python booleans/None
      if (typeof expr === 'string'){
        // quick path: if expr is a simple dotted identifier like 'a.b.c' or 'context.x', resolve directly from state.variables
        try{
          const simplePathRE = /^\s*(?:context\.)?[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\s*$/;
          if (simplePathRE.test(expr)){
            const path = expr.replace(/^\s*context\./,'').trim();
            const parts = path.split('.').filter(Boolean);
            let val = state && state.variables ? state.variables : undefined;
            for (let p of parts){ if (val === undefined || val === null) { val = undefined; break; } val = val[p]; }
            return val;
          }
        }catch(_e){}
        let s = expr;
        // replace Python literals
        s = s.replace(/\bTrue\b/g, 'true').replace(/\bFalse\b/g, 'false').replace(/\bNone\b/g, 'null');
        // replace {{var}} with an appropriate JS literal based on the variable type
        s = s.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_,name) => {
          try{
            const key = name.trim();
            // support nested paths like a.b.c by traversing state.variables
            let val = state && state.variables ? state.variables : undefined;
            const parts = key.split('.');
            for (let p of parts) {
              if (val === undefined || val === null) { val = undefined; break; }
              val = val[p];
            }
            if (val === undefined) return 'null';
            if (val === null) return 'null';
            if (typeof val === 'number' || typeof val === 'boolean') return JSON.stringify(val);
            if (typeof val === 'string'){
              const t = val.trim();
              // if string looks like a number, return unquoted numeric literal to allow arithmetic
              if (/^-?\d+(?:\.\d+)?$/.test(t)) return t;
              // otherwise return a JSON string literal (properly quoted/escaped) to avoid breaking JSON/JS
              return JSON.stringify(val);
            }
            // objects/arrays -> JSON
            return JSON.stringify(val);
          }catch(e){return 'null'; }
        });
        // support len(varName) for simple identifier
        s = s.replace(/len\(\s*([a-zA-Z_$][a-zA-Z0-9_\.]*)\s*\)/g, function(_,vname){
          try{
            // resolve nested paths like obj.prop or obj['prop']
            const parts = vname.split('.');
            let val = state && state.variables ? state.variables : {};
            for(let p of parts){ if(val === undefined || val === null) { val = undefined; break; } if(p in val) val = val[p]; else { val = val[p]; } }
            if(val === undefined || val === null) return '0';
            if(Array.isArray(val)) return String(val.length);
            if(typeof val === 'string') return String(val.length);
            if(typeof val === 'object') return String(Object.keys(val).length);
            return String(String(val).length);
          }catch(e){ return '0'; }
        });
        // finally evaluate safely using Function
        try{
          // eslint-disable-next-line no-new-func
          const fn = new Function('return (' + s + ');');
          const res = fn();
          try{ console.log('[Simulador] evaluate expr:', expr, '-> transformed:', s, '-> result:', res); }catch(_e){}
          return res;
        }catch(e){
          try{ console.log('[Simulador] evaluate failed for expr (Function):', expr, 'transformed:', s, 'error:', e); }catch(_e){}
          // last-resort fallback: attempt a simple manual evaluation for '+' operations
          try{
            if (s.indexOf('+') !== -1){
              const parts = s.split('+').map(p=>p.trim()).filter(p=>p.length);
              const parsed = parts.map(p => {
                // unquote
                if ((p[0] === '"' && p[p.length-1] === '"') || (p[0] === '\'' && p[p.length-1] === '\'')){
                  return p.substring(1,p.length-1);
                }
                if (p === 'null') return null;
                if (p === 'true') return true;
                if (p === 'false') return false;
                // try number
                if (/^-?\d+(?:\.\d+)?$/.test(p)) return parseFloat(p);
                // try JSON.parse for objects/arrays
                try{ return JSON.parse(p); }catch(_e){}
                // fallback: raw string
                return p;
              });
              const allNumbers = parsed.every(v => typeof v === 'number');
              if (allNumbers) return parsed.reduce((a,b)=>a+b,0);
              // otherwise concatenate as strings (convert null/undefined to empty)
              return parsed.map(v => v === null || v === undefined ? '' : String(v)).join('');
            }
          }catch(_e){ try{ console.warn('[Simulador] manual fallback failed for expr:', expr, 's:', s, 'err:', _e); }catch(__e){} }
          // as a last resort, return the interpolated string
          return s;
        }
      }
      return expr;
    } catch(e){ log('Error evaluando expresión: ' + (e.message||e)); return null; }
  }

  function renderPreview(){
    const el = $('simulatorCanvasPreview'); if(!el || !flow) return; el.innerHTML = '';
    const title = document.createElement('div'); title.className = 'font-semibold mb-2'; title.textContent = `${flow.name || flow.flow_id || 'Flujo'}`; el.appendChild(title);
    const nodesCount = document.createElement('div'); nodesCount.textContent = `Nodos: ${Object.keys(flow._nodes).length}`; el.appendChild(nodesCount);
    const start = document.createElement('div'); start.textContent = `Start: ${flow._start || '(no definido)'}`; el.appendChild(start);
  }

  function renderVariables(){
    const el = $('simulatorCanvasPreview'); if(!el) return;
    const vars = document.createElement('pre'); vars.style.whiteSpace = 'pre-wrap'; vars.textContent = 'Variables:\n' + JSON.stringify(state.variables, null, 2);
    el.appendChild(vars);
  }

  // Helper: crear un pequeño "chip" informativo para mostrar dónde se guardó la selección
  function createSavedChip(saveKey, value){
    const wrap = document.createElement('div');
    wrap.className = 'text-xs text-gray-600';
    function short(v){
      try{
        if (v === undefined) return 'undefined';
        if (v === null) return 'null';
        const s = (typeof v === 'string') ? v : JSON.stringify(v);
        return s.length > 120 ? (s.slice(0,120) + '…') : s;
      }catch(_e){ return String(v); }
    }
    wrap.textContent = `💾 Guardado en ${saveKey}: ${short(value)}`;
    return wrap;
  }

  function renderNodeVisit(nodeId, node){
  const el = $('simulatorTimeline'); if(!el) return; const row = document.createElement('div'); row.className = 'sim-row';
  const s = document.createElement('strong'); s.textContent = nodeId; row.appendChild(s); row.appendChild(document.createTextNode(' — ' + node.type)); el.appendChild(row); el.scrollTop = el.scrollHeight;
  }

  // Obtiene etiqueta de opción (button/choice) según el locale actual, con fallbacks
  function getOptionLabel(opt){
    const locale = getLocale();
    if(!opt) return '';
    if (typeof opt.label === 'string' && opt.label.trim()) return interpolate(opt.label);
    const i18n = opt.i18n || {};
    const getText = (loc) => {
      try{
        const t = i18n[loc]?.text;
        if(Array.isArray(t)) return t.join(' ');
        if(typeof t === 'string') return t;
        return '';
      }catch(_e){ return ''; }
    };
    const txt = getText(locale) || getText('es') || getText('en') || getText('pt');
    return interpolate(txt || opt.text || '');
  }

  // Lee y parsea el valor del campo JSON extra (simExtraInput) de manera tolerante
  function parseSimExtraInput(){
    try{
      const el = $('simExtraInput');
      if (!el) return undefined;
      const raw = (el.value || '').trim();
      if (!raw) return undefined; // vacío => sin extra
      // Si parece JSON de objeto/array, intentar parsear
      if ((raw.startsWith('{') && raw.endsWith('}')) || (raw.startsWith('[') && raw.endsWith(']'))){
        try { return JSON.parse(raw); } catch(_e) { /* fallback abajo */ }
      }
      // Números
      if (/^-?\d+(?:\.\d+)?$/.test(raw)) {
        try { return Number(raw); } catch(_e) {}
      }
      // Booleanos y null
      if (/^true$/i.test(raw)) return true;
      if (/^false$/i.test(raw)) return false;
      if (/^null$/i.test(raw)) return null;
      // Fallback: cadena tal cual
      return raw;
    }catch(_e){ return undefined; }
  }

  // Lee el select de turn (user/assistant) — si está vacío, no inyectar
  function parseSimTurnSelect(){
    try{
      const el = $('simTurnSelect');
      if(!el) return undefined;
      const v = String(el.value || '').trim();
      if(!v) return undefined;
      return v; // 'user' | 'assistant'
    }catch(_e){ return undefined; }
  }

  // Lee y parsea origin desde el input — debe ser JSON para objeto complejo, pero aceptamos string/number/bool
  function parseSimOriginInput(){
    try{
      const el = $('simOriginInput');
      if(!el) return undefined;
      const raw = (el.value || '').trim();
      if(!raw) return undefined;
      if ((raw.startsWith('{') && raw.endsWith('}')) || (raw.startsWith('[') && raw.endsWith(']'))){
        try{ return JSON.parse(raw); }catch(_e){}
      }
      if (/^-?\d+(?:\.\d+)?$/.test(raw)) { try{ return Number(raw); }catch(_e){} }
      if (/^true$/i.test(raw)) return true;
      if (/^false$/i.test(raw)) return false;
      if (/^null$/i.test(raw)) return null;
      return raw;
    }catch(_e){ return undefined; }
  }

  function deriveOriginScalars(originVal){
    const scalars = {};
    try{
      const o = originVal && typeof originVal === 'object' ? originVal : null;
      const role = o ? (o.role || o.sender || null) : null;
      const value = o ? (o.value !== undefined ? o.value : (o.text || o.message || null)) : null;
      const nodeId = o ? (o.node || o.node_id || null) : null;
      const nodeType = o ? (o.node_type || o.type || null) : null;
      const flowId = o ? (o.flow || o.flow_id || null) : null;
      const transport = o ? (o.transport || null) : null;
      const corr = o ? (o.correlation_id || o.correlationId || null) : null;
      if(role !== null) { scalars.origin_role = role; scalars.$origin_role = role; }
      if(value !== null) { scalars.origin_value = value; scalars.$origin_value = value; }
      if(nodeId !== null) { scalars.origin_node_id = nodeId; scalars.$origin_node_id = nodeId; }
      if(nodeType !== null) { scalars.origin_node_type = nodeType; scalars.$origin_node_type = nodeType; }
      if(flowId !== null) { scalars.origin_flow_id = flowId; scalars.$origin_flow_id = flowId; }
      if(transport !== null) { scalars.origin_transport = transport; scalars.$origin_transport = transport; }
      if(corr !== null) { scalars.correlation_id = corr; scalars.$correlation_id = corr; }
    }catch(_e){}
    return scalars;
  }

  function step(){
    if (!flow) { log('No hay flujo cargado.'); return; }
    if (!state) initState();
    if (!state.current) { log('Fin del flujo (current null)'); running = false; return; }
    if (state.steps++ > MAX_STEPS) { log('Máximo de pasos alcanzado, abortando para evitar bucles infinitos'); running = false; return; }

    const nodeId = state.current; const node = flow._nodes[nodeId];
    if(!node){ log('Nodo no encontrado: ' + nodeId); running = false; return; }
    renderNodeVisit(nodeId, node);

    // Inyectar efímeros (por paso) si el usuario lo proporcionó en la UI
    const __extraVal = parseSimExtraInput();
    let __extraInjected = false;
    if (typeof __extraVal !== 'undefined') {
      try { state.variables.extra = __extraVal; __extraInjected = true; console.debug('[Simulador] extra injected for step:', __extraVal); } catch(_e) {}
    }
    const __turnVal = parseSimTurnSelect();
    let __turnInjected = false;
    if (typeof __turnVal !== 'undefined') {
      try { state.variables.turn = __turnVal; state.variables.$turn = __turnVal; __turnInjected = true; console.debug('[Simulador] turn injected for step:', __turnVal); } catch(_e) {}
    }
    const __originVal = parseSimOriginInput();
    let __originInjected = false;
    let __originDerivedKeys = [];
    if (typeof __originVal !== 'undefined') {
      try {
        state.variables.origin = __originVal; state.variables.$origin = __originVal; __originInjected = true;
        const deriv = deriveOriginScalars(__originVal);
        __originDerivedKeys = Object.keys(deriv);
        for(const k of __originDerivedKeys){ state.variables[k] = deriv[k]; }
        console.debug('[Simulador] origin injected for step:', __originVal, 'derived:', deriv);
      } catch(_e) {}
    }
    const __clearEphemerals = () => {
      if (__extraInjected) {
        try { delete state.variables.extra; console.debug('[Simulador] extra cleared after step'); } catch(_e) { /* ignore */ }
        __extraInjected = false;
      }
      if (__turnInjected) {
        try { delete state.variables.turn; delete state.variables.$turn; console.debug('[Simulador] turn cleared after step'); } catch(_e) { /* ignore */ }
        __turnInjected = false;
      }
      if (__originInjected) {
        try { delete state.variables.origin; delete state.variables.$origin; } catch(_e) {}
        try { for(const k of __originDerivedKeys){ delete state.variables[k]; } } catch(_e) {}
        __originInjected = false; __originDerivedKeys = [];
        console.debug('[Simulador] origin cleared after step');
      }
    };

    // handle types
    switch(node.type){
      case 'flow_jump': {
        // Implementación básica: empuja retorno si procede y salta al flujo destino
        state.callstack = state.callstack || [];
        const target = node.target || { flow_id:'', node_id:'' };
        const returnOnEnd = (node.return_on_end !== false);
        const returnNext = node.return_target || node.next || null;
        if (returnOnEnd) {
          state.callstack.push({ returnNext });
        }
        const destFlowId = target.flow_id || (flow && flow.flow_id) || null;
        const destNodeId = target.node_id || null;
        const policy = node.apply_start_defaults || 'onlyMissing';
        log(`FLOW_JUMP -> ${destFlowId || '(mismo)'}:${destNodeId || '(start)'} [policy=${policy}]`);
        state.history.push({ node: nodeId, type: 'flow_jump', target, policy });
        if (destFlowId && destFlowId !== (flow && flow.flow_id)){
          const ok = simSetActiveFlow(destFlowId);
          if (!ok) { state.current = null; break; }
          // aplicar defaults del start del flujo destino según política
          applyFlowStartDefaults(flow, policy);
          state.current = destNodeId || (flow?._start || flow?.start_node || null);
        } else {
          // mismo flujo: no aplicar defaults por defecto
          state.current = gotoNext({ node_id: destNodeId });
        }
        break; }
      case 'start':
      case 'response': {
        const text = (node.i18n && node.i18n.es && node.i18n.es.text) ? node.i18n.es.text.join('\n') : (node.text || '');
        log(`RESPUESTA (${nodeId}): ${text}`);
        state.history.push({ node: nodeId, type: node.type, text });
  // advance to next (multi-flujo)
  state.current = gotoNext(node.next);
        break; }
      
      case 'assign_var': {
        // support both legacy single target/value and new node.assignments = [{target, value}]
        const assignments = Array.isArray(node.assignments) ? node.assignments.slice() : ((node.target || node.value) ? [{ target: node.target, value: node.value }] : []);
        if (assignments.length === 0) {
          log('ASSIGN sin target (ignorado)');
          state.history.push({ node: nodeId, type: 'assign_var', target: '', skipped: true });
        }
        for (const a of assignments) {
          const target = (a && a.target) ? String(a.target).trim() : '';
          let raw = (a && a.value !== undefined) ? a.value : '';
          let val = raw;
          try{
            if (typeof raw === 'string') {
              val = evaluate(raw);
            }
          } catch(e){ log('Error evaluating assign value: ' + (e && e.message)); }

          if (target) {
            // nested path handling with guard: only create attribute if parent is object
            if (target.indexOf('.') !== -1) {
              const parts = target.split('.').filter(Boolean);
              let cur = state.variables;
              let createAllowed = true;
              for (let i = 0; i < parts.length - 1; i++) {
                const p = parts[i];
                if (cur[p] === undefined || cur[p] === null) {
                  // create intermediate object
                  cur[p] = {};
                } else if (typeof cur[p] !== 'object') {
                  // cannot create child on non-object parent
                  createAllowed = false; break;
                }
                cur = cur[p];
              }
              if (createAllowed && typeof cur === 'object') {
                cur[parts[parts.length - 1]] = val;
                log(`ASSIGN ${target} = ${JSON.stringify(val)}`);
                state.history.push({ node: nodeId, type: 'assign_var', target, val });
              } else {
                log(`SKIP assign: parent for path '${target}' is not an object, no attribute created`);
                state.history.push({ node: nodeId, type: 'assign_var', target, skippedParentNotObject: true });
              }
            } else {
              state.variables[target] = val;
              log(`ASSIGN ${target} = ${JSON.stringify(val)}`);
              state.history.push({ node: nodeId, type: 'assign_var', target, val });
            }
          } else {
            log('ASSIGN entry sin target (ignorado)');
            state.history.push({ node: nodeId, type: 'assign_var', target: '', skipped: true });
          }
        }
  state.current = gotoNext(node.next);
        break; }
      case 'debug': {
        // show a debug message and optional payload; optionally save payload into a variable
        const rawMsg = node.message || node.text || getI18nText(node, node.message || node.text || '');
        const text = processText(rawMsg, looksLikeMarkdown(rawMsg) || !!node.render_markdown || !!node.renderMarkdown);
        try{
          appendChatMessage('bot', text);
        }catch(_e){ appendChatMessage('bot', String(text)); }

        // handle payload/save
        const rawPayload = (node.payload !== undefined) ? node.payload : (node.data !== undefined ? node.data : null);
        let payloadVal = rawPayload;
        try{
          if (typeof rawPayload === 'string' && rawPayload.trim()){
            // try evaluate (supports {{}} and expressions) then fallback to JSON.parse
            try{ payloadVal = evaluate(rawPayload); }catch(e){ try{ const s = rawPayload.trim(); if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) payloadVal = JSON.parse(s); }catch(_e){} }
          }
        }catch(_e){}

        if (payloadVal !== undefined && payloadVal !== null && payloadVal !== ''){
          appendChatMessage('bot', payloadVal);
        }

        const saveKey = node.save_as || node.saveAs || node.variable || node.targetVar || null;
        if (saveKey) {
          state.variables[saveKey] = payloadVal;
          maybeAppendDiff(__prevVars);
        }

        state.history.push({ node: nodeId, type: 'debug', message: text, payload: payloadVal });
  state.current = gotoNext(node.next);
        break; }
      case 'input': {
        // pause and show input box
        const promptText = getI18nPrompt(node, '');
        log(`INPUT (${nodeId}): ${promptText}`);
  pauseForInput(nodeId, node);
  __clearEphemerals();
        return; }
      case 'choice': {
        // Si está en modo switch, evaluar casos y saltar automáticamente
        const mode = node.mode || 'prompt';
        if (mode === 'switch') {
          const list = Array.isArray(node.cases) ? node.cases : [];
          let jumped = false;
          for (const c of list) {
            const when = c && c.when ? String(c.when) : '';
            try {
              const res = evaluate(when);
              if (res) { state.current = gotoNext(c?.target); jumped = true; break; }
            } catch(_e) {}
          }
          if (!jumped) {
            const def = node.default_target || null;
            if (def) state.current = gotoNext(def);
            else state.current = gotoNext(node.next);
          }
          break;
        }
        // prompt: render options as buttons and wait for user selection
  const choices = node.options || [];
  renderChoice(nodeId, node, choices);
  __clearEphemerals();
  return; }
      case 'button': {
        // render button options and wait for user selection
  renderButton(nodeId, node);
  __clearEphemerals();
  return; }
      case 'multi_button': {
        // render multi-select options and wait for user to click Continue
  renderMultiButton(nodeId, node);
  __clearEphemerals();
  return; }
      case 'rest_call': {
        // Handle REST call - can use real HTTP or mock
        const saveKey = node.save_as || node.saveAs || node.save_as || null;
        
        if (useRealHttp) {
          // Make real HTTP request
          makeHttpRequest(node).then(result => {
            if (saveKey) {
              // Format similar to backend: { status, timestamp, data }
              state.variables[saveKey] = {
                status: result.status,
                timestamp: new Date().toISOString(),
                data: result.data
              };
            }
            log(`REST_CALL real -> ${saveKey || '(no save key)'} = status ${result.status}`);
            state.history.push({ node: nodeId, type: 'rest_call', result: result });
            // limpiar efímeros antes de continuar al próximo paso
            __clearEphemerals();
            
            // Continue to next node
            state.current = gotoNext(node.next);
            
            // Continue simulation if running
            if (running) {
              setTimeout(() => step(), fastMode ? 0 : stepDelay);
            }
          }).catch(error => {
            log(`REST_CALL error: ${error.message}`);
            if (saveKey) {
              state.variables[saveKey] = {
                status: 0,
                error: true,
                message: error.message
              };
            }
            state.history.push({ node: nodeId, type: 'rest_call', result: { error: error.message } });
            // limpiar efímeros también en caso de error
            __clearEphemerals();
            state.current = gotoNext(node.next);
            
            if (running) {
              setTimeout(() => step(), fastMode ? 0 : stepDelay);
            }
          });
          return; // Exit early for async operation
        } else {
          // Mock behavior
          const mock = { ok: true, mocked: true, url: node.properties ? node.properties.url : (node.url||'') };
          if (saveKey) state.variables[saveKey] = mock;
          log(`REST_CALL mocked -> ${saveKey || '(no save key)'} = ${JSON.stringify(mock)}`);
          state.history.push({ node: nodeId, type: 'rest_call', result: mock });
          state.current = gotoNext(node.next);
        }
        break; }
      case 'condition': {
        const expr = node.expr || node.expression || node.value || '';
        try{ console.log('[Simulador] about to evaluate condition:', expr, 'state.variables snapshot:', JSON.stringify(state.variables)); }catch(_e){}
        const res = evaluate(expr);
        try{ console.log('[Simulador] condition result:', expr, '->', res, 'typeof:', typeof res, 'state.user_name:', state.variables && state.variables.user_name); }catch(_e){}
        const target = res ? (node.true_target && node.true_target.node_id) : (node.false_target && node.false_target.node_id);
        log(`COND (${nodeId}): ${expr} => ${res} -> ${target}`);
  state.current = gotoNext(target);
        break; }
      case 'end': {
        // Si hay callstack, pop y saltar a returnNext; si no, fin
        if (state.callstack && state.callstack.length) {
          const frame = state.callstack.pop();
          const ret = frame?.returnNext || null;
          log('END reached (returning to caller)');
          state.current = gotoNext(ret);
        } else {
          log('END reached.'); state.current = null; running = false;
        }
        break; }
      default: {
        // fallback: advance to next
  state.current = gotoNext(node.next); log(`Nodo tipo desconocido (${node.type}), saltando a next`); break;
      }
    }

  // Limpieza post-paso: eliminar efímeros salvo que ya se hayan limpiado (por ejemplo en rest_call async)
  __clearEphemerals();

    renderVariables();

    if (running) stepTimeout = setTimeout(step, stepDelay);
  }

  function renderChoice(nodeId, node, choices){
    const panel = $('simulatorCanvasPreview'); if(!panel) return;
    // clear preview and show choice buttons
    panel.innerHTML = '';
  const title = document.createElement('div'); title.className = 'font-semibold'; title.textContent = getI18nPrompt(node, 'Elige una opción'); panel.appendChild(title);
    const btns = document.createElement('div'); btns.style.display = 'flex'; btns.style.flexDirection = 'column'; btns.style.gap = '8px'; btns.style.marginTop = '8px';
    (choices || []).forEach((opt, i) => {
      const b = document.createElement('button'); b.className = 'px-3 py-1 bg-white border rounded text-sm'; b.textContent = opt.label || opt.text || (`Opción ${i+1}`);
      b.addEventListener('click', () => {
  const target = opt.target || opt.next || null;
        log(`CHOICE selected: ${b.textContent} -> ${target}`);
        state.history.push({ node: nodeId, type: 'choice', selected: b.textContent, target, index: i });
        // Guardar selección por nodo (save_as o fallback)
        const val = opt.value !== undefined ? opt.value : (opt.label || opt.text || b.textContent);
        const saveKey = (node && (node.save_as || node.saveAs)) ? (node.save_as || node.saveAs) : `selected_choice_${nodeId}`;
        state.variables[saveKey] = val;
        // compat global
        state.variables.selected_choice = val;
        // registrar en selections
        try { state.selections = state.selections || { button:{}, choice:{} }; state.selections.choice[nodeId] = { label: b.textContent, value: val, index: i, target, saved_as: saveKey, at: new Date().toISOString() }; } catch(_e) {}
        // Chip informativo en chat
        try{ appendChatMessage('bot', createSavedChip(saveKey, val)); }catch(_e){}
  state.current = gotoNext(target);
        // restore preview
        renderPreview(); renderVariables();
        if (running) stepTimeout = setTimeout(step, 200);
      });
      btns.appendChild(b);
    });
    panel.appendChild(btns);
  }
  // Helper estilos por variante (para botones del simulador)
  function getVariantClass(v){
    const variant = (v || '').toLowerCase();
    if(variant === 'primary') return 'px-4 py-2 rounded text-sm bg-sky-600 text-white hover:bg-sky-700';
    if(variant === 'tertiary') return 'px-4 py-2 rounded text-sm bg-transparent text-sky-700 border border-transparent hover:bg-sky-50';
    return 'px-4 py-2 rounded text-sm bg-white border text-gray-800 hover:bg-gray-100'; // secondary / default
  }

  // Helper para obtener la clave donde guardar selección de botón
  function getButtonSaveKey(nodeId, node){
    const explicit = node && (node.save_as || node.saveAs);
    return explicit && String(explicit).trim() ? String(explicit).trim() : `selected_button_${nodeId}`;
  }

  function renderButton(nodeId, node){
    const panel = $('simulatorCanvasPreview'); if(!panel) return;
    // clear preview and show button options
    panel.innerHTML = '';
  const title = document.createElement('div'); title.className = 'font-semibold';
  const promptText = getI18nPrompt(node, 'Selecciona una opción');
  title.textContent = promptText; panel.appendChild(title);
    
    let buttons = [];
    const mode = node.mode || 'static';
    
  if (mode === 'dynamic') {
      // Dynamic mode: evaluate source list and generate buttons
      try {
        // Permitir tanto propiedades aplanadas como dentro de provider
        const provider = node.provider || {};
        const srcExpr = node.src || node.source_list || provider.source_list || '';
        const sourceList = evaluate(srcExpr);
        if (Array.isArray(sourceList)) {
          const labelExpr = node.labelExpr || node.label_expr || provider.label_expr || 'item.label || item.name || item';
          const valueExpr = node.valueExpr || node.value_expr || provider.value_expr || 'item';

          // Evaluador con scope local para item e index
          const evalInScope = (expr, item, index) => {
            try {
              // Si hay ExpressionParser, úsalo con variables extendidas
              if (window.ExpressionParser && typeof window.ExpressionParser.evaluate === 'function'){
                const mergedVars = Object.assign({}, (state && state.variables) ? state.variables : {}, { item, index });
                try{
                  const epRes = window.ExpressionParser.evaluate(expr, { variables: mergedVars });
                  console.debug('[Simulador][evalInScope] ExpressionParser:', { expr, epRes });
                  // If the parser returned undefined or returned the same unresolved string, fall back
                  if (epRes === undefined || (typeof epRes === 'string' && (String(epRes).trim() === String(expr).trim() || String(epRes).includes('item')))){
                    console.debug('[Simulador][evalInScope] ExpressionParser did not resolve (undefined or contains "item"), falling back to local eval for expr=', expr);
                    throw new Error('ExpressionParser did not resolve');
                  }
                  return epRes;
                }catch(_e){ /* fallthrough to local eval */ }
              }
            } catch(_e) { /* fallback abajo */ }
            // Fallback simple: soportar patrones como 'item.x.y' o 'index'
            try {
              const simpleRE = /^\s*(?:item(?:\.[A-Za-z_$][\w$]*)*|index)\s*$/;
              if (typeof expr === 'string' && simpleRE.test(expr)){
                const t = expr.trim();
                if (t === 'index') return index;
                // recorrer item.prop1.prop2
                let cur = item;
                const parts = t.split('.').slice(1); // quitar 'item'
                for (const p of parts){ if (cur == null) return null; cur = cur[p]; }
                return cur;
              }
            } catch(_e2) { /* ignorar */ }
            // Intento adicional: si la expresión es 'item' o 'item.prop...' intentar resolver directamente antes del evaluate genérico
            try {
              if (typeof expr === 'string'){
                const m = expr.trim().match(/^item(?:\.(.+))?$/);
                if (m){
                  if(!m[1]) return item;
                  const parts = m[1].split('.'); let cur = item; for(const p of parts){ if(cur==null){ cur=null; break; } cur = cur[p]; } return cur;
                }
              }
            } catch(_e3){}
            // Último recurso: intentar evaluate genérico (puede resolver context.x)
            return evaluate(expr);
          };

          buttons = sourceList.map((item, i) => {
            try {
              const label = evalInScope(labelExpr, item, i);
              const value = evalInScope(valueExpr, item, i);
              return { label: String(label), value: value, index: i };
            } catch (e) {
              log(`Error evaluating button ${i}: ${e.message}`);
              return { label: `Opción ${i+1}`, value: item, index: i };
            }
          });
        } else {
          log('BUTTON dynamic mode: source_list no es un array');
          buttons = [{ label: 'Error: source_list no válido', value: null }];
        }
      } catch (e) {
        log(`BUTTON dynamic error: ${e.message}`);
        buttons = [{ label: 'Error evaluando lista dinámica', value: null }];
      }
    } else {
      // Static mode: use node.options
      buttons = (node.options || []).map((opt, i) => ({
        label: getOptionLabel(opt) || `Botón ${i+1}`,
        value: opt.value !== undefined ? opt.value : opt,
        index: i,
        target: (opt.target && (opt.target.node_id || opt.target)) || (opt.next && (opt.next.node_id || opt.next)) || null
      }));
    }
    
    const btns = document.createElement('div'); 
    btns.style.display = 'flex'; 
    btns.style.flexDirection = 'column'; 
    btns.style.gap = '8px'; 
    btns.style.marginTop = '8px';
    
    buttons.forEach((btn, i) => {
      const b = document.createElement('button'); 
      // usar variante si viene en la opción
      b.className = getVariantClass(btn.variant || 'secondary');
      b.textContent = btn.label;
      b.addEventListener('click', () => {
        log(`BUTTON selected: ${btn.label}`);
        // preferir target específico de la opción si existe; fallback a node.next
  const target = btn.target || node.next || null;
        state.history.push({ node: nodeId, type: 'button', selected: btn.label, value: btn.value, index: i, target });
        // Guardar selección en variable única por nodo
        const saveKey = getButtonSaveKey(nodeId, node);
        const val = (btn.value !== undefined) ? btn.value : btn.label;
        state.variables[saveKey] = val;
        // Guardar también el destino (node_id) para auditoría/uso posterior
        const resolvedTarget = (typeof target === 'object') ? (target?.node_id || null) : target;
        const saveKeyTarget = (node && (node.save_as || node.saveAs)) ? String(node.save_as || node.saveAs).trim() + '_target' : `selected_button_target_${nodeId}`;
        if(resolvedTarget) state.variables[saveKeyTarget] = resolvedTarget;
        // Mantener compatibilidad opcional con selected_button global (último click)
        try { state.variables.selected_button = val; } catch(_e) {}
        // Registrar selección por nodo (para navegación hacia atrás)
        try {
          state.selections = state.selections || { button: {}, choice: {} };
          state.selections.button[nodeId] = { label: btn.label, value: val, index: i, target: resolvedTarget, saved_as: saveKey, saved_target_as: saveKeyTarget, at: new Date().toISOString() };
        } catch(_e) {}
        // Chip informativo en chat
        try{ appendChatMessage('bot', createSavedChip(saveKey, val)); if(resolvedTarget) appendChatMessage('bot', createSavedChip(saveKeyTarget, resolvedTarget)); }catch(_e){}
  state.current = gotoNext(target);
        // restore preview
        renderPreview(); renderVariables();
        if (running) stepTimeout = setTimeout(step, 200);
      });
      btns.appendChild(b);
    });
    
    panel.appendChild(btns);
  }

  // Render de selección múltiple en el panel de vista previa (canvas preview dentro del simulador)
  function renderMultiButton(nodeId, node){
    const panel = $('simulatorCanvasPreview'); if(!panel) return;
    panel.innerHTML = '';
    const title = document.createElement('div'); title.className = 'font-semibold'; title.textContent = getI18nPrompt(node, 'Selecciona una o varias opciones'); panel.appendChild(title);

    // Construir opciones: dinámicas (provider.source_list) o estáticas (options)
    let items = [];
    const provider = node.provider || {};
    const srcExpr = node.src || node.source_list || provider.source_list || null;
    const labelExpr = node.labelExpr || node.label_expr || provider.label_expr || 'item.label || item.name || item';
    const valueExpr = node.valueExpr || node.value_expr || provider.value_expr || 'item.value || item.name || item';

    const evalInScope = (expr, item, index) => {
      try {
        if (window.ExpressionParser && typeof window.ExpressionParser.evaluate === 'function'){
          const mergedVars = Object.assign({}, (state && state.variables) ? state.variables : {}, { item, index });
          const epRes = window.ExpressionParser.evaluate(expr, { variables: mergedVars });
          if (epRes !== undefined && !(typeof epRes === 'string' && String(epRes).includes('item'))) return epRes;
        }
      } catch(_e) {}
      try {
        const simpleRE = /^\s*(?:item(?:\.[A-Za-z_$][\w$]*)*|index)\s*$/;
        if (typeof expr === 'string' && simpleRE.test(expr)){
          const t = expr.trim();
          if (t === 'index') return index;
          let cur = item; const parts = t.split('.').slice(1);
          for(const p of parts){ if(cur == null) return null; cur = cur[p]; }
          return cur;
        }
      } catch(_e2) {}
      return evaluate(expr);
    };

    if (srcExpr){
      try{
        const sourceList = evaluate(srcExpr);
        if (Array.isArray(sourceList)){
          // Filtro/orden opcional
          let filtered = sourceList;
          const filterExpr = node.filterExpr || node.filter_expr || provider.filter_expr || null;
          if (filterExpr){
            filtered = filtered.filter((it, idx)=>{
              try{ const r = evalInScope(filterExpr, it, idx); return !!r; }catch(_e){ return true; }
            });
          }
          const sortExpr = node.sortExpr || node.sort_expr || provider.sort_expr || null;
          if (sortExpr){
            filtered = filtered.slice().sort((a,b)=>{
              const ka = evalInScope(sortExpr, a, 0) ?? '';
              const kb = evalInScope(sortExpr, b, 0) ?? '';
              return String(ka).localeCompare(String(kb));
            });
          }
          items = filtered.map((it, i)=>{
            let lbl = evalInScope(labelExpr, it, i); if(lbl === undefined || lbl === null) lbl = `Opción ${i+1}`;
            const val = evalInScope(valueExpr, it, i);
            return { label: String(lbl), value: (val !== undefined && val !== null) ? val : String(lbl) };
          });
        }
      }catch(e){ /* si falla, cae a estáticas */ }
    }
    if (!Array.isArray(items) || items.length === 0){
      items = (Array.isArray(node.options) ? node.options : []).map((o,i)=>({
        label: getOptionLabel(o) || `Opción ${i+1}`,
        value: (o && (o.value !== undefined)) ? o.value : (getOptionLabel(o) || `Opción ${i+1}`)
      }));
    }

    // Preselección desde variable save_as si existe
    const saveKey = (node && (node.save_as || node.saveAs)) ? (node.save_as || node.saveAs) : `selected_buttons_${nodeId}`;
    const preselected = new Set(Array.isArray(state.variables?.[saveKey]) ? state.variables[saveKey].map(v=>String(v)) : []);

    const list = document.createElement('div'); list.className = 'flex flex-col gap-2 mt-2';
    const selected = new Set();
    items.forEach((it, idx)=>{
      const row = document.createElement('label'); row.className = 'flex items-center gap-2';
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.className = 'mr-2';
      cb.checked = preselected.has(String(it.value));
      if (cb.checked) selected.add(String(it.value));
      cb.addEventListener('change', ()=>{
        const v = String(it.value);
        if (cb.checked) selected.add(v); else selected.delete(v);
        updateStatus();
      });
      const span = document.createElement('span'); span.textContent = String(it.label);
      row.appendChild(cb); row.appendChild(span); list.appendChild(row);
    });

    const info = document.createElement('div'); info.className = 'text-xs text-gray-600 mt-2';
    // Validación min/max
    const minSel = (typeof node.min_selected === 'number') ? node.min_selected : (typeof node.minSelected === 'number' ? node.minSelected : null);
    const maxSel = (typeof node.max_selected === 'number') ? node.max_selected : (typeof node.maxSelected === 'number' ? node.maxSelected : null);

    const actions = document.createElement('div'); actions.className = 'mt-3 flex gap-2 items-center';
    const btnContinue = document.createElement('button'); btnContinue.textContent = 'Continuar'; btnContinue.className = 'px-3 py-1 bg-sky-600 text-white rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed';

    function updateStatus(){
      const count = selected.size;
      let msg = `${count} seleccionada${count===1?'':'s'}`;
      let valid = true;
      if (minSel != null && count < minSel){ msg += ` — mínimo ${minSel}`; valid = false; }
      if (maxSel != null && count > maxSel){ msg += ` — máximo ${maxSel}`; valid = false; }
      info.textContent = msg;
      btnContinue.disabled = !valid;
    }

    btnContinue.addEventListener('click', ()=>{
      let arr = Array.from(selected.values());
      // Si el nodo es opcional y no hay selección, usar default_values si existen
      const isOptional = !!(node.optional === true);
      const defaults = Array.isArray(node.default_values) ? node.default_values : (Array.isArray(node.defaultValues) ? node.defaultValues : null);
      if (arr.length === 0 && isOptional && defaults && defaults.length){
        arr = defaults.map(x=>String(x));
      }
      // Validación final min/max
      if (minSel != null && arr.length < minSel){
        info.textContent = `Selecciona al menos ${minSel}`;
        btnContinue.disabled = true;
        return;
      }
      if (maxSel != null && arr.length > maxSel){
        info.textContent = `Selecciona como máximo ${maxSel}`;
        btnContinue.disabled = true;
        return;
      }

      state.variables[saveKey] = arr;
      appendChatMessage('bot', createSavedChip(saveKey, JSON.stringify(arr)));
      state.history.push({ node: nodeId, type: 'multi_button', selected: arr });
      state.current = gotoNext(node.next);
      renderPreview(); renderVariables(); if(running) step();
    });
    actions.appendChild(btnContinue);
    panel.appendChild(list);
    panel.appendChild(info);
    panel.appendChild(actions);
    updateStatus();
  }

  function pauseForInput(nodeId, node){
    const panel = $('simulatorCanvasPreview'); if(!panel) return;
    panel.innerHTML = '';
  const prompt = document.createElement('div'); prompt.className = 'font-semibold'; prompt.textContent = getI18nPrompt(node, 'Introduce un valor'); panel.appendChild(prompt);
    const input = document.createElement('input'); input.type = 'text'; input.className = 'border rounded p-1 mt-2'; input.style.width = '100%'; panel.appendChild(input);
    const btn = document.createElement('button'); btn.textContent = 'Enviar'; btn.className = 'px-3 py-1 bg-sky-600 text-white rounded mt-2'; btn.addEventListener('click', () => {
      const v = input.value; const saveAs = node.save_as || node.saveAs || node.variable || node.targetVar || null;
  if (saveAs) state.variables[saveAs] = v; log(`INPUT respuesta guardada: ${saveAs} = ${v}`); state.history.push({ node: nodeId, type: 'input', value: v }); state.current = gotoNext(node.next); renderPreview(); renderVariables(); if (running) stepTimeout = setTimeout(step, 200);
    });
    panel.appendChild(btn);
  }

  // UI wiring
  function showHelpModal(){
    const helpContent = `
      <h3 class="text-lg font-semibold mb-4">Ayuda - Variables y Markdown</h3>
      <div class="space-y-4 text-sm">
        <div>
          <h4 class="font-semibold text-sky-600">📝 Variables</h4>
          <p>Usa <code class="bg-gray-100 px-1 rounded">{{variable}}</code> para interpolar variables en textos:</p>
          <pre class="bg-gray-100 p-2 rounded text-xs mt-1">Hola {{user_name}}, tienes {{user_age}} años</pre>
        </div>
        <div>
          <h4 class="font-semibold text-sky-600">🎨 Markdown</h4>
          <p>Los textos soportan Markdown:</p>
          <ul class="list-disc list-inside ml-4 mt-1 space-y-1">
            <li><code>**negrita**</code> → <strong>negrita</strong></li>
            <li><code>*cursiva*</code> → <em>cursiva</em></li>
            <li><code># Título</code> → encabezado</li>
            <li><code>- item</code> → lista</li>
            <li><code>\`código\`</code> → <code>código</code></li>
          </ul>
        </div>
        <div>
          <h4 class="font-semibold text-sky-600">📊 DataInfo</h4>
          <p>Campo opcional que evalúa expresiones y asigna a la variable <code>dataInfo</code>:</p>
          <pre class="bg-gray-100 p-2 rounded text-xs mt-1">{"user":"{{user_name}}","age":{{user_age}}}</pre>
        </div>
        <div>
          <h4 class="font-semibold text-sky-600">💡 Consejos</h4>
          <ul class="list-disc list-inside ml-4 mt-1 space-y-1">
            <li>Las variables se interpolan automáticamente</li>
            <li>El Markdown se renderiza en el chat</li>
            <li>Escapa comillas dobles en JSON: <code>"{\"key\": \"value\"}"</code></li>
          </ul>
        </div>
      </div>
    `;
    
    // Crear modal simple
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-[400] flex items-center justify-center bg-black bg-opacity-50';
    modal.innerHTML = `
      <div class="bg-white rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-auto">
        <div class="p-6">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-xl font-bold">Ayuda del Simulador</h2>
            <button class="text-gray-500 hover:text-gray-700 text-2xl" onclick="this.closest('.fixed').remove()">×</button>
          </div>
          ${helpContent}
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  function setupUiBindings(){
    const openBtn = $('btnOpenInSimulator'); if(openBtn) openBtn.addEventListener('click', () => { try { loadFlowFromEditor(); initState(); renderPreview(); } catch(e) { console.error(e); } });
    const openModalBtn = $('btnOpenSimulatorModal');
    if (openModalBtn) {
      console.log('Binding modal button');
      openModalBtn.addEventListener('click', () => { console.log('Modal button clicked'); openSimulatorModal(); });
    } else {
      // Fallback: el botón no existe al bindear. Añadir listener delegado para capturar clicks futuros
      console.warn('[Simulador] btnOpenSimulatorModal no presente en DOM al iniciar, usando delegation fallback');
      document.body.addEventListener('click', function _delegatedOpenModal(ev){
        try{
          const tgt = ev.target && ev.target.closest ? ev.target.closest('#btnOpenSimulatorModal') : null;
          if(tgt){ console.log('[Simulador] Delegated modal open detected'); openSimulatorModal(); }
        }catch(e){ /* silent */ }
      });
    }

    // NOTE: no global 'always' delegated listener to avoid duplicate openings when the button exists

    // Expose helper so user can open modal from console if needed
    try{ window.openSimulatorModal = openSimulatorModal; }catch(e){}
    const fileBtn = $('btnLoadFlowFile'); if(fileBtn) fileBtn.addEventListener('click', () => {
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json'; inp.addEventListener('change', async (ev) => {
        const f = ev.target.files[0]; if(!f) return;
        try {
          // Leer JSON y cargarlo en el editor como flujo activo
          const text = await f.text(); const obj = JSON.parse(text);
          if (window.App && typeof window.App.importJson === 'function') {
            window.App.importJson(obj);
            // Forzar preferencia de seguir editor para que el simulador use este flujo importado
            preferEditorFlow = true; try{ if(typeof localStorage !== 'undefined') localStorage.setItem('simulator.preferEditorFlow','1'); }catch(_e){}
            // Recargar desde editor e inicializar estado limpiamente
            loadFlowFromEditor();
            initState();
            const chatEl = $('simulatorChat'); if(chatEl) chatEl.innerHTML = '';
            const timelineEl = $('simulatorTimeline'); if(timelineEl) timelineEl.innerHTML = '';
            renderPreview();
            presentCurrentNodeInChat();
            log('Flujo importado al editor y establecido como fuente para el simulador');
          } else {
            // Fallback: si por algún motivo no está el editor, mantener comportamiento anterior
            await loadFlowFromFile(f);
          }
        } catch(err){ log('Error importando flujo: ' + (err && err.message ? err.message : String(err))); }
      }); inp.click();
    });
    const apiBtn = $('btnUseAgentAPI'); if(apiBtn) apiBtn.addEventListener('click', () => { const url = prompt('URL base de Agent API (ej: http://localhost:5000)'); if(url) { loadFlowFromPath(url + '/flow'); } });
    const startBtn = $('btnStartSim'); if(startBtn) startBtn.addEventListener('click', async () => {
      try {
        // Siempre detener cualquier ejecución previa y limpiar timers
        if (stepTimeout) { clearTimeout(stepTimeout); stepTimeout = null; }
        running = false;

        // Recargar flujo basándonos en preferencia y origen para reflejar cambios recientes
        if (preferEditorFlow || !flow || flow._source === 'editor') {
          try { loadFlowFromEditor(); } catch(e) { if(!flow) { log('No se pudo cargar flujo desde el editor: ' + e.message); return; } }
        } else if (flow._source === 'path' && flow._sourcePath) {
          try { await loadFlowFromPath(flow._sourcePath); } catch(e) { log('No se pudo recargar desde path: ' + e.message); }
        } // si es file, mantenemos el flujo ya cargado (no hay path para re-fetch)

        // Reinicializar estado/variables desde el flujo actual
        initState();

        // Limpiar paneles visuales para iniciar desde cero
        const chatEl = $('simulatorChat'); if(chatEl) chatEl.innerHTML = '';
        const timelineEl = $('simulatorTimeline'); if(timelineEl) timelineEl.innerHTML = '';
        renderPreview();

        // Arrancar simulación
        running = true;
        log('Simulación iniciada');
        step();
      } catch(err) {
        log('No se pudo iniciar simulación: ' + (err && err.message ? err.message : String(err)));
      }
    });
    const stopBtn = $('btnStopSim'); if(stopBtn) stopBtn.addEventListener('click', () => { running = false; if(stepTimeout){ clearTimeout(stepTimeout); stepTimeout = null; } log('Simulación detenida'); });
    const helpBtn = $('btnShowHelp'); if(helpBtn) helpBtn.addEventListener('click', () => showHelpModal());
  // Botón para limpiar el campo de extra efímero
  const simExtraClearBtn = $('simExtraClear'); if (simExtraClearBtn) simExtraClearBtn.addEventListener('click', () => { const inp = $('simExtraInput'); if (inp) inp.value = ''; });
  // Limpiar turn/origin
  const simTurnClearBtn = $('simTurnClear'); if (simTurnClearBtn) simTurnClearBtn.addEventListener('click', () => { const sel = $('simTurnSelect'); if (sel) sel.value = ''; });
  const simOriginClearBtn = $('simOriginClear'); if (simOriginClearBtn) simOriginClearBtn.addEventListener('click', () => { const inp = $('simOriginInput'); if (inp) inp.value = ''; });
  }

  /* Modal + chat UI */
  function openSimulatorModal(){
    console.log('openSimulatorModal called');
    const modal = $('simulatorModal'); if(!modal) { console.error('Modal not found'); return; }
 
  modal.classList.remove('hidden'); modal.setAttribute('aria-hidden','false');
    modal.style.display = 'flex';
    console.log('Modal should be visible now, classes:', modal.className);
    const close = $('simulatorModalClose'); if(close) close.onclick = () => { closeSimulatorModal(); };
  const speedBtn = $('btnToggleSpeed'); if(speedBtn){ speedBtn.onclick = () => { fastMode = !fastMode; speedBtn.classList.toggle('bg-sky-600', fastMode); speedBtn.classList.toggle('text-white', fastMode); speedBtn.textContent = fastMode ? 'Normal' : 'Rápido'; }; }
  const httpBtn = $('btnToggleHttp'); if(httpBtn){ httpBtn.onclick = () => { useRealHttp = !useRealHttp; httpBtn.classList.toggle('bg-sky-600', useRealHttp); httpBtn.classList.toggle('text-white', useRealHttp); httpBtn.textContent = useRealHttp ? 'HTTP Mock' : 'HTTP Real'; }; }
    // preferencia: seguir editor
    const chkPref = $('chkPreferEditorFlow');
    if(chkPref){
      try{ chkPref.checked = true; chkPref.closest('label')?.classList.add('hidden'); }catch(_e){}
      // ignorar cambios (si el DOM lo muestra por cache) y mantener true
      chkPref.addEventListener('change', () => {
        chkPref.checked = true; // bloquear toggling
        preferEditorFlow = true;
        try{ if(typeof localStorage !== 'undefined') localStorage.setItem('simulator.preferEditorFlow','1'); }catch(_e){}
      });
    }
    // Recargar flujo desde el editor bajo demanda
    const reloadBtn = $('btnReloadFlow'); if(reloadBtn){ reloadBtn.onclick = () => {
      try{
        // detener ejecución actual
        running = false; if(stepTimeout){ clearTimeout(stepTimeout); stepTimeout = null; }
        // recargar flujo desde editor y reiniciar estado
        loadFlowFromEditor();
        initState();
        // limpiar UI del simulador
        const chatEl = $('simulatorChat'); if(chatEl) chatEl.innerHTML = '';
        const timelineEl = $('simulatorTimeline'); if(timelineEl) timelineEl.innerHTML = '';
        renderPreview();
        // presentar el nodo actual en chat
        presentCurrentNodeInChat();
        log('Flujo recargado desde el editor y simulador reinicializado');
      }catch(err){ log('Error recargando flujo: ' + (err && err.message ? err.message : String(err))); }
    }; }
    // diffs toggle
    try{
      const saved = (typeof localStorage!=='undefined') ? localStorage.getItem('simulator.showDiffs') : null;
      if(saved === '0') showDiffs = false; else if(saved === '1') showDiffs = true;
    }catch(_e){}
    const diffsBtn = $('btnToggleDiffs'); if(diffsBtn){
      // pintar estado actual
      diffsBtn.classList.toggle('bg-sky-600', showDiffs); diffsBtn.classList.toggle('text-white', showDiffs);
      diffsBtn.addEventListener('click', ()=>{
        showDiffs = !showDiffs;
        diffsBtn.classList.toggle('bg-sky-600', showDiffs);
        diffsBtn.classList.toggle('text-white', showDiffs);
        try{ if(typeof localStorage!=='undefined') localStorage.setItem('simulator.showDiffs', showDiffs ? '1' : '0'); }catch(_e){}
      });
    }
    function closeSimulatorModal(){ modal.classList.add('hidden'); modal.setAttribute('aria-hidden','true'); modal.style.display='none'; }
    document.addEventListener('keydown', function escHandler(ev){ if(ev.key==='Escape'){ closeSimulatorModal(); document.removeEventListener('keydown', escHandler); } });
    // bind vars button
    const btnToggleVars = $('btnToggleVars'); if(btnToggleVars) btnToggleVars.onclick = () => toggleVarsPanel();
    const btnVarsSave = $('btnVarsSave'); if(btnVarsSave) btnVarsSave.onclick = () => {
      const inputs = document.querySelectorAll('#simulatorVarsList input'); inputs.forEach(inp => { const name = inp.dataset.varName; if(name) state.variables[name] = inp.value; }); renderVarsPanel(); renderPreview(); };
    const btnVarsReset = $('btnVarsReset'); if(btnVarsReset) btnVarsReset.onclick = () => { Object.keys(state.variables||{}).forEach(k => state.variables[k] = ''); renderVarsPanel(); renderPreview(); };
    // clear chat and enforce visible container styles (debugging):
  const chat = $('simulatorChat'); if(chat){ chat.innerHTML = ''; chat.style.padding = '12px'; chat.style.background = '#f8fafc'; chat.style.color = '#111827'; chat.style.minHeight = '120px'; chat.style.position = 'relative'; }
    // ensure debug overlay exists inside modal to show message counts (helps when chat CSS oculta contenido)
    if(!$('simulatorDebugOverlay')){
      const o = document.createElement('div'); o.id = 'simulatorDebugOverlay'; o.style.position = 'fixed'; o.style.right = '24px'; o.style.top = '120px'; o.style.zIndex = '99999'; o.style.background = 'rgba(17,24,39,0.95)'; o.style.color = '#fff'; o.style.padding = '8px 12px'; o.style.borderRadius = '6px'; o.style.fontSize = '12px'; o.textContent = 'simulator: 0 messages (build: ' + (window.SIMULATOR_BUILD_ID || 'unknown') + ')';
      const modal = $('simulatorModal'); if(modal) modal.appendChild(o);
    }
  // Siempre recargar el flujo desde el editor al abrir el modal
  try { loadFlowFromEditor(); } catch(e) { console.log('Error loading flow:', e); }
  console.log('Flow loaded (from editor):', !!flow);
  // Always re-initialize state when opening the modal so previous runs don't accumulate
  try{ running = false; if(stepTimeout){ clearTimeout(stepTimeout); stepTimeout = null; } }catch(_e){}
  // remove simulator-specific persisted keys so each modal open starts fresh
  try{ if(typeof localStorage !== 'undefined') localStorage.removeItem('simulator_selected_language'); }catch(_e){}
  initState();
  console.log('State initialized (fresh) and persisted simulator keys cleared');
  // clear previous timeline to avoid duplicated logs from past runs
  const timelineEl = $('simulatorTimeline'); if(timelineEl) timelineEl.innerHTML = '';
    // Forzar primer idioma siempre que usuario lo pidió (creamos flag siempre para este requerimiento)
    window._forcePrimaryLocale = true; forcePrimaryLocale();
    console.log('Locale actual:', getLocale());
  // present current node (with typing)
  console.log('Presenting current node');
  presentCurrentNodeInChat();
  // watchdog: si tras 400ms no hay mensajes en el chat, añadir banner visible para depurar
  setTimeout(()=>{
    const chat = $('simulatorChat');
    if(!chat) return;
    if(chat.children.length === 0){
      console.warn('[Simulador] Watchdog: no se detectaron mensajes en #simulatorChat, mostrando fallback debug');
      const banner = document.createElement('div');
      banner.style.background = '#fde68a'; banner.style.border = '1px solid #f59e0b'; banner.style.padding = '12px'; banner.style.borderRadius = '8px'; banner.style.marginBottom = '8px';
      banner.textContent = `DEBUG: locale=${getLocale()} - start_node=${flow && flow._start ? flow._start : '(nil)'} - current=${state && state.current ? state.current : '(nil)'} `;
      chat.appendChild(banner);
      // también mostrar el texto calculado del nodo actual, si existe
      try{
        const node = flow && state ? flow._nodes[state.current] : null;
        if(node){
          const text = getI18nText(node, node.text || node.prompt || '');
          const info = document.createElement('div'); info.style.background='#fff'; info.style.border='1px solid #e5e7eb'; info.style.padding='10px'; info.style.borderRadius='6px'; info.textContent = `NODE(${node.id}): ${text}`;
          chat.appendChild(info);
        }
      }catch(e){ console.error(e); }
    }
  }, 400);
    // wiring input send
    const inputBox = $('simulatorInputBox'); const sendBtn = $('simulatorSendBtn');
  if(sendBtn && inputBox) sendBtn.onclick = () => { const v = inputBox.value.trim(); if(!v) return; handleUserTextInput(v); inputBox.value=''; };
  if(inputBox) inputBox.onkeydown = (e) => { if(e.key === 'Enter'){ e.preventDefault(); sendBtn.click(); } };
  try{ if(inputBox) inputBox.style.color = '#111827'; }catch(_e){}
    updateDebugPanels();
  }

  function appendChatMessage(who, textOrNode){
    const chat = $('simulatorChat'); if(!chat) return;
    console.log('[Simulador] appendChatMessage called, who:', who, 'type:', typeof textOrNode, 'chatChildrenBefore:', chat.children.length);
    const m = document.createElement('div'); m.className = 'mb-2';
    // Deduplicate immediate repeats: if last message equals the new one, skip append to avoid doubles
    try{
      // Allow bypassing dedup when explicitly requested by caller (e.g., foreach inline iterations)
      const allowDup = (textOrNode instanceof Node) && textOrNode.dataset && (textOrNode.dataset.simAllowDup === 'true' || textOrNode.dataset.simAllowDup === true);
      if (!allowDup) {
        const last = chat.lastElementChild;
        // If new node is a DOM node and carries our debug dataset.simNode, avoid appending if last has same id
        if (textOrNode instanceof Node) {
          const newId = textOrNode.dataset ? textOrNode.dataset.simNode : null;
          if (newId && last) {
            const lastInner = last.querySelector('[data-sim-node]');
            const lastId = lastInner ? lastInner.dataset.simNode : (last.dataset ? last.dataset.simNode : null);
            if (lastId && lastId === newId) {
              console.log('[Simulador] Skipping duplicate message by simNode id (immediate):', newId);
              try{ const overlay = $('simulatorDebugOverlay'); if(overlay) overlay.textContent = 'simulator: ' + chat.children.length + ' messages - last: ' + (lastId || ''); }catch(_e){}
              return;
            }
          }
        }
        // fallback: compare textual content to avoid duplicates coming from other code paths
        let newTextPreview = '';
        if (typeof textOrNode === 'string') newTextPreview = textOrNode.trim();
        else if (textOrNode instanceof Node) newTextPreview = (textOrNode.textContent || '').trim();
        else if (typeof textOrNode === 'object') newTextPreview = (JSON.stringify(textOrNode) || '').trim();
        if (last) {
          const lastText = (last.textContent || '').trim();
          if (lastText && newTextPreview && lastText === newTextPreview) {
            console.log('[Simulador] Skipping duplicate message (immediate repeat):', newTextPreview.slice(0,120));
            try{ const overlay = $('simulatorDebugOverlay'); if(overlay) overlay.textContent = 'simulator: ' + chat.children.length + ' messages - last: ' + (newTextPreview.substring(0,80) || ''); }catch(_e){}
            return;
          }
        }
      }
    }catch(_e){}
    function renderBubble(contentNode, isBot){
      const bubble = document.createElement('div'); bubble.className = (isBot ? 'bg-white text-gray-800' : 'bg-sky-600 text-white') + ' p-3 rounded-lg shadow max-w-[86%]';
      // Inline styles to guarantee visibility even if Tailwind classes are missing/overridden
      bubble.style.wordBreak = 'break-word';
      bubble.style.background = isBot ? '#ffffff' : '#0ea5e9';
      bubble.style.color = isBot ? '#111827' : '#ffffff';
      bubble.style.padding = '12px'; bubble.style.borderRadius = '12px'; bubble.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)'; bubble.style.maxWidth = '86%';
      // ensure child content inherits readable color
      try{ if(contentNode && contentNode.style) contentNode.style.color = bubble.style.color; }catch(_e){}
      bubble.appendChild(contentNode);
      const wrapper = document.createElement('div'); wrapper.className = isBot ? 'flex items-start' : 'flex items-end justify-end';
      wrapper.style.display = 'flex'; wrapper.style.marginBottom = '8px'; wrapper.style.justifyContent = isBot ? 'flex-start' : 'flex-end'; wrapper.appendChild(bubble); return wrapper;
    }

    if (typeof textOrNode === 'string'){
      const content = document.createElement('div'); 
      // Si contiene HTML (como Markdown renderizado), sanitizar antes de setear innerHTML
      if (textOrNode.includes('<') && textOrNode.includes('>')) {
        content.innerHTML = sanitizeHtml(textOrNode);
      } else {
        content.textContent = textOrNode;
      }
      const node = renderBubble(content, who === 'bot'); m.appendChild(node); chat.appendChild(m);
    } else if (textOrNode instanceof Node){
      // if node is a container of buttons or pre, append directly inside bubble
      const bubbleContent = document.createElement('div'); bubbleContent.appendChild(textOrNode);
      const node = renderBubble(bubbleContent, who === 'bot'); m.appendChild(node); chat.appendChild(m);
    } else if (typeof textOrNode === 'object'){
      // render JSON nicely
      const pre = document.createElement('pre'); pre.style.whiteSpace = 'pre-wrap'; pre.textContent = JSON.stringify(textOrNode, null, 2);
      const node = renderBubble(pre, who === 'bot'); m.appendChild(node); chat.appendChild(m);
    }
    // Prefer scrollTop, but also attempt scrollIntoView as a robust fallback
    try{
      chat.scrollTop = chat.scrollHeight;
    }catch(_e){}
  console.log('[Simulador] appended, chatChildrenAfter:', chat.children.length);
    // update debug overlay if present
    try{
      const overlay = $('simulatorDebugOverlay'); if(overlay){
        try{
          const lastText = (typeof textOrNode === 'string') ? textOrNode.substring(0,80) : (textOrNode && (textOrNode.textContent || JSON.stringify(textOrNode).slice(0,80)));
          overlay.textContent = 'simulator: ' + chat.children.length + ' messages - last: ' + (lastText || '');
        }catch(_e){ overlay.textContent = 'simulator: ' + chat.children.length + ' messages'; }
      }
      // highlight last message container to force visibility
      const last = chat.lastElementChild;
      if(last){ last.style.outline = '2px solid rgba(249,115,22,0.9)'; last.style.background = 'rgba(255,255,255,0.98)'; last.style.padding = '6px'; last.style.zIndex = '2'; const inner = last.querySelector('div'); if(inner) { inner.style.opacity = '1'; inner.style.display = 'block'; } }
      }catch(e){ console.warn('overlay update failed', e); }
    try{
      const last = chat.lastElementChild;
      if(last){
        console.log('[Simulador] last message outerHTML:', last.outerHTML.slice(0,1000));
        const dbgNode = $('debugCurrentNode'); if(dbgNode) dbgNode.textContent = (dbgNode.textContent || '') + '\nLAST_MSG_HTML:\n' + last.outerHTML.substring(0,1000);
        // give browser a tick to layout, then ensure visibility
        try{ setTimeout(()=>{ try{ last.scrollIntoView({ behavior: 'smooth', block: 'end', inline: 'nearest' }); }catch(_e){ try{ last.scrollIntoView(); }catch(__e){} } }, 50); }catch(_e){}
      }
    }catch(e){ console.warn('failed dumping last outerHTML', e); }
  }

  // Typing indicator: shows animated dots for ms then calls cb
  function showTyping(cb, ms = 600){
    if(fastMode) return cb();
    const chat = $('simulatorChat'); if(!chat) return; 
    const bubble = document.createElement('div');
    bubble.className = 'bg-white p-2 rounded-lg inline-block';
    bubble.textContent = '...'; 
    const wrapper = document.createElement('div'); wrapper.className = 'flex items-start mb-2'; wrapper.appendChild(bubble); chat.appendChild(wrapper); chat.scrollTop = chat.scrollHeight;
    setTimeout(()=>{ wrapper.remove(); try{ cb(); }catch(e){ console.error(e); } }, ms);
  }

  // Variables panel rendering
  function renderVarsPanel(){
    const panel = $('simulatorDebugPanel'); const list = $('simulatorVarsList'); if(!panel || !list) return;
    list.innerHTML = '';
    // gather variable definitions from flow (start node or any node that declares variables)
    const defs = {};
    try{
      if(flow && flow._nodes){
        Object.values(flow._nodes).forEach(n => {
          if(Array.isArray(n.variables)){
            n.variables.forEach(v => { if(v && v.name) defs[v.name] = v; });
          }
        });
      }
    }catch(_e){}

    // ensure state.variables exists
    state.variables = state.variables || {};

    // show each variable (from state or from defs)
    const seen = new Set();
    // first, variables defined in defs
    Object.keys(defs).forEach(k => {
      seen.add(k);
      const def = defs[k] || {};
      const row = document.createElement('div'); row.className = 'flex gap-2 items-center';
      const label = document.createElement('div'); label.className = 'text-sm text-gray-600 w-36';
      label.textContent = k + (def.isList ? ' [lista]' : '') + (def.description ? ' — ' + def.description : '');
      const input = document.createElement('input'); input.className = 'flex-1 px-2 py-1 border rounded';
      const currentVal = state.variables[k] === null || state.variables[k] === undefined ? (def.defaultValue === undefined ? '' : JSON.stringify(def.defaultValue)) : String(state.variables[k]);
      input.value = currentVal;
      input.dataset.varName = k;
      row.appendChild(label); row.appendChild(input); list.appendChild(row);
    });
    // then, any variables in state not declared in defs
    Object.keys(state.variables || {}).forEach(k => {
      if(seen.has(k)) return; seen.add(k);
      const row = document.createElement('div'); row.className = 'flex gap-2 items-center';
      const label = document.createElement('div'); label.className = 'text-sm text-gray-600 w-36'; label.textContent = k;
      const input = document.createElement('input'); input.className = 'flex-1 px-2 py-1 border rounded'; input.value = state.variables[k] === null || state.variables[k] === undefined ? '' : String(state.variables[k]); input.dataset.varName = k;
      row.appendChild(label); row.appendChild(input); list.appendChild(row);
    });
  }

  function toggleVarsPanel(){ const panel = $('simulatorDebugPanel'); if(!panel) return; panel.classList.toggle('hidden'); if(!panel.classList.contains('hidden')) renderVarsPanel(); }

  function presentCurrentNodeInChat(){
    console.log('presentCurrentNodeInChat called, state:', !!state, 'flow:', !!flow);
    if(!state || !flow){ console.warn('Sin estado o flujo'); return; }
    if(!state.current && flow._start){ console.log('state.current vacío, asignando start'); state.current = flow._start; }
    const nodeId = state.current; console.log('nodeId:', nodeId); if(!nodeId){ appendChatMessage('bot','(fin del flujo)'); return; }
    const node = flow._nodes[nodeId]; if(!node){ appendChatMessage('bot',`Nodo ${nodeId} no encontrado`); return; }
    // Snapshot antes de procesar el nodo para poder calcular diffs
    const __prevVars = deepClone(state && state.variables ? state.variables : {});
    switch(node.type){
      case 'start': {
  const rawStart = getI18nText(node,'(inicio)');
  const text = processText(rawStart, looksLikeMarkdown(rawStart) || !!node.render_markdown || !!node.renderMarkdown);
        showTyping(()=>{
          appendChatMessage('bot', text);
          setTimeout(()=>{ state.current = gotoNext(node.next); renderPreview(); updateDebugPanels(); if(state.current) presentCurrentNodeInChat(); }, fastMode?50:600);
        });
        break; }
      case 'flow_jump': {
        try{
          state.callstack = state.callstack || [];
          const target = node.target || { flow_id:'', node_id:'' };
          const returnOnEnd = (node.return_on_end !== false);
          const returnNext = node.return_target || node.next || null;
          if (returnOnEnd) {
            state.callstack.push({ returnNext });
          }
          const destFlowId = target.flow_id || (flow && flow.flow_id) || null;
          const destNodeId = target.node_id || null;
          const policy = node.apply_start_defaults || 'onlyMissing';
          if (destFlowId && destFlowId !== (flow && flow.flow_id)){
            const ok = simSetActiveFlow(destFlowId);
            if (!ok) { state.current = null; break; }
            applyFlowStartDefaults(flow, policy);
            state.current = destNodeId || (flow?._start || flow?.start_node || null);
          } else {
            state.current = gotoNext({ node_id: destNodeId });
          }
          renderPreview(); updateDebugPanels();
          if(state.current) { presentCurrentNodeInChat(); } else { appendChatMessage('bot','(fin del flujo)'); }
        }catch(e){ console.warn('[Simulador] flow_jump en chat falló:', e); state.current = gotoNext(node.next); renderPreview(); updateDebugPanels(); if(state.current) presentCurrentNodeInChat(); }
        break; }
      case 'response': {
  const rawText = getI18nText(node, node.text || '');
  const text = processText(rawText, looksLikeMarkdown(rawText) || !!node.render_markdown || !!node.renderMarkdown);
        showTyping(()=>{ 
          appendChatMessage('bot', text);
          // Construir opciones combinando raíz + i18n
          const options = [];
          if(Array.isArray(node.options)) options.push(...node.options.map(o=>({...o})));
          if(Array.isArray(node.choices)) options.push(...node.choices.map(o=>({...o})));
          if(Array.isArray(node.buttons)) options.push(...node.buttons.map(b => ({ label: b.label || b.text, target: b.next || b.target, value: b.value })));
          if(Array.isArray(node.quick_replies)) options.push(...node.quick_replies.map(o=>({...o})));
          const locOpts = getI18nOptions(node);
          if(options.length === 0 && locOpts.length){
            options.push(...locOpts.map(o=>({...o})));
          } else if(locOpts.length){
            // Rellenar etiquetas/valores vacíos por índice o matching por value
            options.forEach((opt,idx)=>{
              // si falta label, intentar por índice
              if(!opt.label && locOpts[idx]) opt.label = locOpts[idx].label || locOpts[idx].title || locOpts[idx].text;
              // si falta value, intentar copiar desde locOpts por índice
              if((opt.value === undefined || opt.value === null || opt.value === '') && locOpts[idx] && (locOpts[idx].value !== undefined)){
                opt.value = locOpts[idx].value;
              }
              // si sigue sin label, intentar buscar por value en locOpts
              if(!opt.label && opt.value){
                const found = locOpts.find(lo=>lo.value===opt.value);
                if(found) opt.label = found.label || found.title || found.text;
              }
            });
          }
          if(options.length > 0){
            const container = document.createElement('div'); container.className='flex flex-col gap-2 mt-2';
            options.forEach((o,i)=>{
              const label = interpolate(o.label || o.text || `Opción ${i+1}`);
              const btn = document.createElement('button'); btn.className=getVariantClass(o.variant || 'secondary') + ' text-left'; btn.textContent=label;
              btn.addEventListener('click', ()=>{
                try{ console.log('[Simulador] option clicked:', o, 'value:', o && o.value); }catch(_e){}
                disableTemporarily(btn,600);
                appendChatMessage('user', label);
                const __prev = deepClone(state && state.variables ? state.variables : {});
                // determine target node
                let target = (o.target && (o.target.node_id || o.target)) || (o.next && (o.next.node_id || o.next)) || null;
                // fallback for set_language_<value>
                if(!target && o.value && flow && flow._nodes[`set_language_${o.value}`]) {
                  target = `set_language_${o.value}`;
                }
                // fallback: lookup original next in node.options by value
                if(!target && node.options && Array.isArray(node.options)){
                  const orig = node.options.find(opt => opt.value === o.value);
                  if(orig && orig.next && orig.next.node_id) target = orig.next.node_id;
                }
                // store selection (per-node)
                const val = (o.value !== undefined) ? o.value : label;
                const saveKey = (node && (node.save_as || node.saveAs)) ? (node.save_as || node.saveAs) : `selected_choice_${state.current}`;
                state.variables[saveKey] = val;
                state.variables.selected_choice = val; // compat
                try { state.selections = state.selections || { button:{}, choice:{} }; state.selections.choice[state.current] = { label, value: val, index: i, target, saved_as: saveKey, at: new Date().toISOString() }; } catch(_e) {}
                try{ appendChatMessage('bot', createSavedChip(saveKey, val)); }catch(_e){}
                if(o.value && ['pt','es','en'].includes(o.value)) {
                  state.variables.selected_language = o.value;
                  try{ if(typeof localStorage!=='undefined') localStorage.setItem('simulator_selected_language', o.value); }catch(_e){}
                }
                maybeAppendDiff(__prev);
                state.current = gotoNext(target);
                renderPreview(); updateDebugPanels(); presentCurrentNodeInChat();
              });
              container.appendChild(btn);
            });
            appendChatMessage('bot', container);
          } else {
            // Verificar si hay goto opcional configurado
            const gotoTarget = state.variables && state.variables['goto'];
            if (gotoTarget && flow && flow._nodes && flow._nodes[gotoTarget]) {
              // Mostrar solo el botón Volver
              const container = document.createElement('div'); container.className='flex flex-col gap-2 mt-2';
              
              // Botón Volver (goto opcional)
              const backBtn = document.createElement('button'); 
              backBtn.className='px-3 py-2 bg-orange-600 text-white border rounded text-sm hover:bg-orange-700'; 
              backBtn.textContent='Volver';
              backBtn.addEventListener('click', ()=>{
                disableTemporarily(backBtn,600);
                appendChatMessage('user', 'Volver');
                const __prev = deepClone(state && state.variables ? state.variables : {});
                // Limpiar la variable goto después de usarla
                delete state.variables['goto'];
                maybeAppendDiff(__prev);
                state.current = gotoTarget;
                renderPreview(); updateDebugPanels(); presentCurrentNodeInChat();
              });
              container.appendChild(backBtn);
              
              appendChatMessage('bot', container);
            } else {
              // avance automático si no hay opciones ni goto
              // retrasar el auto avance para permitir ver el mensaje (aún en modo rápido damos un microtask)
              setTimeout(()=>{ state.current = gotoNext(node.next); renderPreview(); updateDebugPanels(); if(state.current) presentCurrentNodeInChat(); else appendChatMessage('bot','(fin del flujo)'); }, fastMode ? 10 : 250);
            }
          }
        });
        break; }
      case 'choice': {
          const mode = node.mode || 'prompt';
          if (mode === 'switch') {
            // evaluar casos y saltar en chat inmediatamente
            let jumped = false;
            const cases = Array.isArray(node.cases) ? node.cases : [];
            for (const c of cases) {
              const w = c && c.when ? String(c.when) : '';
              try { if (evaluate(w)) { state.current = gotoNext(c?.target); jumped = true; break; } } catch(_e) {}
            }
            if (!jumped) {
              const def = node.default_target || null;
              if (def) state.current = gotoNext(def); else state.current = gotoNext(node.next);
            }
            renderPreview(); updateDebugPanels(); if(state.current) { presentCurrentNodeInChat(); } else { appendChatMessage('bot','(fin del flujo)'); }
            break;
          }
          const rawText = getI18nText(node, node.prompt || 'Elige una opción'); const text = processText(rawText, looksLikeMarkdown(rawText) || !!node.render_markdown || !!node.renderMarkdown);
        // combinar opciones base + i18n
        let opts = [];
        if(Array.isArray(node.options)) opts.push(...node.options.map(o=>({...o})));
        if(Array.isArray(node.choices)) opts.push(...node.choices.map(o=>({...o})));
        const locOpts = getI18nOptions(node);
        if(opts.length===0 && locOpts.length){
          opts = locOpts.map(o=>({...o}));
        } else if(locOpts.length){
          opts.forEach((opt,idx)=>{
            if(!opt.label && locOpts[idx]) opt.label = locOpts[idx].label || locOpts[idx].title || locOpts[idx].text;
            if((opt.value === undefined || opt.value === null || opt.value === '') && locOpts[idx] && (locOpts[idx].value !== undefined)){
              opt.value = locOpts[idx].value;
            }
            if(!opt.label && opt.value){
              const found = locOpts.find(lo=>lo.value===opt.value);
              if(found) opt.label = found.label || found.title || found.text;
            }
          });
        }
        const container = document.createElement('div'); container.className = 'flex flex-col gap-2';
        opts.forEach((o, i) => {
          const label = interpolate(o.label || o.text || `Opción ${i+1}`);
          const b = document.createElement('button'); b.textContent = label; b.className = (getVariantClass(o.variant || 'secondary')) + ' text-left';
          b.addEventListener('click', () => {
            // Log the option object/value when clicked (helps debug missing value)
            try{ console.log('[Simulador] choice clicked:', o, 'value:', o && o.value); }catch(_e){}
            disableTemporarily(b, 800); appendChatMessage('user', label);
            const __prev = deepClone(state && state.variables ? state.variables : {});
            let target = (o.target && (o.target.node_id || o.target)) || (o.next && (o.next.node_id || o.next)) || null;
            if(!target && o.value && flow && flow._nodes[`set_language_${o.value}`]) target = `set_language_${o.value}`;
            const val = (o.value !== undefined) ? o.value : label;
            const saveKey = (node && (node.save_as || node.saveAs)) ? (node.save_as || node.saveAs) : `selected_choice_${state.current}`;
            state.variables[saveKey] = val;
            state.variables.selected_choice = val; // compat
            try { state.selections = state.selections || { button:{}, choice:{} }; state.selections.choice[state.current] = { label, value: val, index: i, target, saved_as: saveKey, at: new Date().toISOString() }; } catch(_e) {}
            try{ appendChatMessage('bot', createSavedChip(saveKey, val)); }catch(_e){}
            if(o.value && ['pt','es','en'].includes(o.value)) state.variables.selected_language = o.value;
            try { if(o.value && ['pt','es','en'].includes(o.value) && typeof localStorage!=='undefined') localStorage.setItem('simulator_selected_language', o.value); } catch(e){}
            maybeAppendDiff(__prev);
            state.current = gotoNext(target); renderPreview(); updateDebugPanels(); presentCurrentNodeInChat();
          });
          container.appendChild(b);
        });
        showTyping(()=>{ appendChatMessage('bot', text); appendChatMessage('bot', container); });
        break; }
      case 'button': {
        const rawText = getI18nText(node, node.prompt || 'Selecciona una opción'); const text = processText(rawText, looksLikeMarkdown(rawText) || !!node.render_markdown || !!node.renderMarkdown);
        const mode = node.mode || 'static';
        if (mode === 'dynamic') {
          // Generar botones dinámicamente desde provider/source_list
          try {
            const provider = node.provider || {};
            const srcExpr = node.src || node.source_list || provider.source_list || '';
            const sourceList = evaluate(srcExpr);
            let buttons = [];
            if (Array.isArray(sourceList)) {
              const labelExpr = node.labelExpr || node.label_expr || provider.label_expr || 'item.label || item.name || item';
              const valueExpr = node.valueExpr || node.value_expr || provider.value_expr || 'item';
              const evalInScope = (expr, item, index) => {
                try {
                  if (window.ExpressionParser && typeof window.ExpressionParser.evaluate === 'function'){
                    const mergedVars = Object.assign({}, (state && state.variables) ? state.variables : {}, { item, index });
                    try{
                      const epRes = window.ExpressionParser.evaluate(expr, { variables: mergedVars });
                      console.debug('[Simulador][evalInScope] ExpressionParser:', { expr, epRes });
                      if (epRes === undefined || (typeof epRes === 'string' && (String(epRes).trim() === String(expr).trim() || String(epRes).includes('item')))){
                        console.debug('[Simulador][evalInScope] ExpressionParser did not resolve (undefined or contains "item"), falling back to local eval for expr=', expr);
                        throw new Error('ExpressionParser did not resolve');
                      }
                      return epRes;
                    }catch(_e){ /* fallthrough to local eval */ }
                  }
                } catch(_e) {}
                try {
                  const simpleRE = /^\s*(?:item(?:\.[A-Za-z_$][\w$]*)*|index)\s*$/;
                  if (typeof expr === 'string' && simpleRE.test(expr)){
                    const t = expr.trim();
                    if (t === 'index') return index;
                    let cur = item; const parts = t.split('.').slice(1);
                    for (const p of parts){ if (cur == null) return null; cur = cur[p]; }
                    return cur;
                  }
                } catch(_e2) {}
                return evaluate(expr);
              };

              buttons = sourceList.map((item, i) => {
                try {
                  let label = evalInScope(labelExpr, item, i);
                  const value = evalInScope(valueExpr, item, i);
                  if (label === undefined || label === null) label = `Opción ${i+1}`;
                  const labelStr = (typeof label === 'object') ? JSON.stringify(label) : String(label);
                  return { label: labelStr, value: value, index: i };
                } catch (e) {
                  return { label: `Opción ${i+1}`, value: item, index: i };
                }
              });
            }
            const container = document.createElement('div'); container.className = 'flex flex-col gap-2';
            if (!buttons.length) {
              const fallback = document.createElement('div'); fallback.className='text-xs text-amber-700'; fallback.textContent = '(lista dinámica vacía)'; container.appendChild(fallback);
            }
            buttons.forEach((o, i) => {
              const label = interpolate(o.label) || `Botón ${i+1}`;
              const b = document.createElement('button'); b.textContent = label; b.className = 'px-4 py-2 bg-white border rounded text-sm text-left';
              b.addEventListener('click', () => {
                disableTemporarily(b, 600); appendChatMessage('user', label);
                const __prev = deepClone(state && state.variables ? state.variables : {});
                const val = (o.value !== undefined) ? o.value : label;
                const saveKey = getButtonSaveKey(nodeId, node);
                state.variables[saveKey] = val;
                state.variables.selected_button = val; // compat global
                try {
                  state.selections = state.selections || { button: {}, choice: {} };
                  const targetPeek = null; // dinámico no define target por opción
                  const resolvedTarget = null;
                  const saveKeyTarget = (node && (node.save_as || node.saveAs)) ? String(node.save_as || node.saveAs).trim() + '_target' : `selected_button_target_${nodeId}`;
                  if(resolvedTarget) state.variables[saveKeyTarget] = resolvedTarget;
                  state.selections.button[nodeId] = { label, value: val, index: i, target: resolvedTarget, saved_as: saveKey, saved_target_as: saveKeyTarget, at: new Date().toISOString() };
                } catch(_e) {}
                maybeAppendDiff(__prev);
                let target = node.next || null;
                try{ appendChatMessage('bot', createSavedChip(saveKey, val)); if(target) appendChatMessage('bot', createSavedChip(((node && (node.save_as || node.saveAs)) ? String(node.save_as || node.saveAs).trim() + '_target' : `selected_button_target_${nodeId}`), target)); }catch(_e){}
                state.current = gotoNext(target); renderPreview(); updateDebugPanels(); presentCurrentNodeInChat();
              });
              container.appendChild(b);
            });
            showTyping(()=>{ appendChatMessage('bot', text); appendChatMessage('bot', container); });
          } catch(e) {
            const container = document.createElement('div'); container.className = 'flex flex-col gap-2';
            const fallback = document.createElement('div'); fallback.className='text-xs text-red-700'; fallback.textContent = `Error dinámico: ${e && e.message ? e.message : String(e)}`; container.appendChild(fallback);
            showTyping(()=>{ appendChatMessage('bot', text); appendChatMessage('bot', container); });
          }
          break;
        }

        // Modo estático por defecto (options)
        let opts = Array.isArray(node.options) ? node.options.map(o=>({...o})) : [];
        const container = document.createElement('div'); container.className = 'flex flex-col gap-2';
        if(opts.length===0){
          const fallback = document.createElement('div'); fallback.className='text-xs text-amber-700'; fallback.textContent = '(sin opciones definidas)'; container.appendChild(fallback);
        }
        opts.forEach((o, i) => {
          const label = getOptionLabel(o) || `Botón ${i+1}`;
          const b = document.createElement('button'); b.textContent = label; b.className = 'px-4 py-2 bg-white border rounded text-sm text-left';
          b.addEventListener('click', () => {
            disableTemporarily(b, 600); appendChatMessage('user', label);
            const __prev = deepClone(state && state.variables ? state.variables : {});
            const val = (o.value !== undefined) ? o.value : label;
            // Guardar variable única por nodo (save_as o fallback a selected_button_<id>)
            const saveKey = getButtonSaveKey(nodeId, node);
            state.variables[saveKey] = val;
            // compat global (último click)
            state.variables.selected_button = val;
            // Registrar selección por nodo
            try {
              state.selections = state.selections || { button: {}, choice: {} };
              const targetPeek = (o.target && (o.target.node_id || o.target)) || (o.next && (o.next.node_id || o.next)) || null;
              const resolvedTarget = (typeof targetPeek === 'object') ? (targetPeek?.node_id || null) : targetPeek;
              const saveKeyTarget = (node && (node.save_as || node.saveAs)) ? String(node.save_as || node.saveAs).trim() + '_target' : `selected_button_target_${nodeId}`;
              if(resolvedTarget) state.variables[saveKeyTarget] = resolvedTarget;
              state.selections.button[nodeId] = { label, value: val, index: i, target: resolvedTarget, saved_as: saveKey, saved_target_as: saveKeyTarget, at: new Date().toISOString() };
            } catch(_e) {}
            maybeAppendDiff(__prev);
            let target = (o.target && (o.target.node_id || o.target)) || (o.next && (o.next.node_id || o.next)) || null;
            if(!target && node.next) target = node.next;
            try{ appendChatMessage('bot', createSavedChip(saveKey, val)); if(target) appendChatMessage('bot', createSavedChip(((node && (node.save_as || node.saveAs)) ? String(node.save_as || node.saveAs).trim() + '_target' : `selected_button_target_${nodeId}`), (typeof target === 'object') ? (target?.node_id || null) : target)); }catch(_e){}
            state.current = gotoNext(target); renderPreview(); updateDebugPanels(); presentCurrentNodeInChat();
          });
          container.appendChild(b);
        });
        showTyping(()=>{ appendChatMessage('bot', text); appendChatMessage('bot', container); });
        break; }
      case 'button': {
        const rawText = getI18nText(node, node.prompt || 'Selecciona una opción');
        const text = processText(rawText, looksLikeMarkdown(rawText) || !!node.render_markdown || !!node.renderMarkdown);
        let buttons = [];
        const mode = node.mode || 'static';
        if (mode === 'dynamic') {
          try {
            // Permitir tanto propiedades aplanadas como dentro de provider
            const provider = node.provider || {};
            const srcExpr = node.src || node.source_list || provider.source_list || '';
            const sourceList = evaluate(srcExpr);
            if (Array.isArray(sourceList)) {
              const labelExpr = node.labelExpr || node.label_expr || provider.label_expr || 'item.label || item.name || item';
              const valueExpr = node.valueExpr || node.value_expr || provider.value_expr || 'item';

              const evalInScope = (expr, item, index) => {
                try {
                  if (window.ExpressionParser && typeof window.ExpressionParser.evaluate === 'function'){
                    const mergedVars = Object.assign({}, (state && state.variables) ? state.variables : {}, { item, index });
                    try{
                      const epRes = window.ExpressionParser.evaluate(expr, { variables: mergedVars });
                      console.debug('[Simulador][evalInScope] ExpressionParser:', { expr, epRes });
                      if (epRes === undefined || (typeof epRes === 'string' && (String(epRes).trim() === String(expr).trim() || String(epRes).includes('item')))){
                        console.debug('[Simulador][evalInScope] ExpressionParser did not resolve (undefined or contains "item"), falling back to local eval for expr=', expr);
                        throw new Error('ExpressionParser did not resolve');
                      }
                      return epRes;
                    }catch(_e){ /* fallthrough to local eval */ }
                  }
                } catch(_e) { /* fallback */ }
                try {
                  const simpleRE = /^\s*(?:item(?:\.[A-Za-z_$][\w$]*)*|index)\s*$/;
                  if (typeof expr === 'string' && simpleRE.test(expr)){
                    const t = expr.trim();
                    if (t === 'index') return index;
                    let cur = item; const parts = t.split('.').slice(1);
                    for (const p of parts){ if (cur == null) return null; cur = cur[p]; }
                    return cur;
                  }
                } catch(_e2) { /* ignore */ }
                return evaluate(expr);
              };

              buttons = sourceList.map((item, i) => {
                try {
                  let label = evalInScope(labelExpr, item, i);
                  const value = evalInScope(valueExpr, item, i);
                  if (label === undefined || label === null) label = `Opción ${i+1}`;
                  const labelStr = (typeof label === 'object') ? JSON.stringify(label) : String(label);
                  return { label: labelStr, value: value, index: i };
                } catch (e) {
                  return { label: `Opción ${i+1}`, value: item, index: i };
                }
              });
            } else {
              buttons = [{ label: 'Error: source_list no válido', value: null }];
            }
          } catch (e) {
            buttons = [{ label: 'Error evaluando lista dinámica', value: null }];
          }
        } else {
          buttons = (node.options || []).map((opt, i) => ({
            label: opt.i18n && opt.i18n.es && opt.i18n.es.text ? opt.i18n.es.text.join(' ') : (opt.label || opt.text || `Botón ${i+1}`),
            value: opt.value !== undefined ? opt.value : opt,
            index: i
          }));
        }
        const container = document.createElement('div'); container.className = 'flex flex-col gap-2';
        buttons.forEach((b, i) => {
          const label = interpolate(b.label);
          const btn = document.createElement('button'); btn.textContent = label; btn.className = 'px-4 py-2 bg-white border rounded text-sm text-left';
          btn.addEventListener('click', () => {
            disableTemporarily(btn, 800); appendChatMessage('user', label);
            const __prev = deepClone(state && state.variables ? state.variables : {});
            state.variables.selected_button = b.value || label;
            maybeAppendDiff(__prev);
            state.current = gotoNext(node.next);
            renderPreview(); updateDebugPanels(); presentCurrentNodeInChat();
          });
          container.appendChild(btn);
        });
        showTyping(()=>{ appendChatMessage('bot', text); appendChatMessage('bot', container); });
        break; }
      case 'input': {
        const promptText = getI18nPrompt(node, '');
        showTyping(()=>{ appendChatMessage('bot', promptText); const inputBox = $('simulatorInputBox'); if(inputBox) inputBox.focus(); });
        break; }
      
      case 'assign_var': {
        // nuevo formato: node.assignments = [{ target, value }]; fallback a legacy target/value
        const assignments = Array.isArray(node.assignments)
          ? node.assignments.slice()
          : ((node.target || node.value) ? [{ target: node.target, value: node.value }] : []);

        if (assignments.length === 0) {
          appendChatMessage('bot', 'Asignación sin destino (ignorada)');
          state.current = gotoNext(node.next);
          renderPreview(); updateDebugPanels(); presentCurrentNodeInChat();
          break;
        }

        const messages = [];
        for (const a of assignments) {
          const target = (a && a.target) ? String(a.target).trim() : '';
          let raw = (a && a.value !== undefined) ? a.value : '';
          let val = raw;
          try {
            // Evaluar siempre si es string, para soportar funciones como split(), len(), join(), bool(), etc.
            if (typeof raw === 'string') {
              val = evaluate(raw);
            }
          } catch(e) { /* si falla la evaluación, mantener el valor original */ }

          if (target) {
            if (target.indexOf('.') !== -1) {
              const parts = target.split('.').filter(Boolean);
              let cur = state.variables;
              let createAllowed = true;
              for (let i = 0; i < parts.length - 1; i++) {
                const p = parts[i];
                if (cur[p] === undefined || cur[p] === null) {
                  cur[p] = {};
                } else if (typeof cur[p] !== 'object') {
                  createAllowed = false; break;
                }
                cur = cur[p];
              }
              if (createAllowed && typeof cur === 'object') {
                cur[parts[parts.length - 1]] = val;
                messages.push(`Asignado ${target} = ${JSON.stringify(val)}`);
              } else {
                messages.push(`Omitido ${target}: parent no es objeto`);
              }
            } else {
              state.variables[target] = val;
              messages.push(`Asignado ${target} = ${JSON.stringify(val)}`);
            }
          } else {
            messages.push('Asignación sin target (ignorada)');
          }
        }

        // mostrar un resumen en una burbuja
        appendChatMessage('bot', messages.join('\n'));
  // diffs
  maybeAppendDiff(__prevVars);
  state.current = gotoNext(node.next);
        renderPreview(); updateDebugPanels(); presentCurrentNodeInChat();
        break; }
      case 'set_goto': {
        // Configurar la variable goto para navegación opcional
        state.variables['goto'] = node.target || '';
        // diffs
        maybeAppendDiff(__prevVars);
  state.current = gotoNext(node.next);
        renderPreview(); updateDebugPanels(); presentCurrentNodeInChat();
        break; }
      case 'foreach':
      case 'loop':
      case 'while': {
        // Enhanced handling: if we have a concrete source list (or can infer one), iterate and render body per item.
        try{
          const bodyId = node.loop_body?.node_id || node.loopBody?.node_id || node.body_start?.node_id || null;
          const info = node.type + (node.source_list ? (' over ' + node.source_list) : (node.cond ? (' cond=' + String(node.cond)) : ''));
          appendChatMessage('bot', `Entrando en bucle (${info})`);

          // resolve source array: prefer explicit source_list, else try to infer from template inside body
          let items = null;
          if(node.source_list && String(node.source_list).trim()){
            try{ items = evaluate(node.source_list); }catch(_e){ items = null; }
          }

          // helper: recursively search state.variables for an array whose elements (objects) have a given key
          function findArrayContainingKey(obj, key){
            if(!obj || typeof key !== 'string') return null;
            if(Array.isArray(obj)){
              if(obj.length > 0 && obj[0] && typeof obj[0] === 'object' && (key in obj[0])) return obj;
              // also accept array of primitives if key === '' (not used)
            }
            if(obj && typeof obj === 'object'){
              for(const k of Object.keys(obj)){
                try{ const v = obj[k]; const found = findArrayContainingKey(v, key); if(found) return found; }catch(_e){}
              }
            }
            return null;
          }

          if(!items && bodyId){
            // peek body node text to infer property used, e.g. {{item.plataforma}}
            const bodyNode = flow._nodes[bodyId];
            if(bodyNode && bodyNode.type === 'response'){
              const rawText = getI18nText(bodyNode, bodyNode.text || '');
              // find first {{...}} expression and extract property after the item var if present
              const m = String(rawText).match(/\{\{\s*([A-Za-z0-9_\.\s]+)\s*\}\}/);
              if(m && m[1]){
                const expr = m[1].trim().replace(/\s*\.\s*/g, '.');
                // if expression looks like item.prop or item.something, infer the property name
                const parts = expr.split('.').filter(Boolean);
                if(parts.length >= 2){
                  const propName = parts.slice(1).join('.'); // could be nested
                  // search for array containing this prop
                  const found = findArrayContainingKey(state.variables || {}, parts[1]);
                  if(found) items = found;
                }
              }
            }
          }

          // If still no items, fallback to plural of common item_var (item -> items)
          if(!items && node.item_var){
            const guess = (node.item_var.endsWith('s')) ? node.item_var : (node.item_var + 's');
            try{ const g = evaluate(guess); if(Array.isArray(g)) items = g; }catch(_e){}
            if(!items && state && state.variables && state.variables[guess] && Array.isArray(state.variables[guess])) items = state.variables[guess];
          }

          if(items && Array.isArray(items) && items.length){
            console.log('[Simulador][foreach] items found length=' + items.length + ' bodyId=' + bodyId + ' itemName=' + (node.item_var||'item'));
            // iterate and render body response for each item (temporary inject variables)
            const itemName = node.item_var || 'item';
            const indexName = node.index_var || 'index';
            const prevSnapshot = deepClone(state.variables || {});
            for(let i=0;i<items.length;i++){
              console.log('[Simulador][foreach] iter', i, 'of', items.length, 'item preview:', (typeof items[i] === 'object' ? JSON.stringify(items[i]).slice(0,200) : String(items[i])));
              try{
                state.variables[itemName] = items[i];
                state.variables[indexName] = i;
                // procesar en línea la cadena de nodos que conforman el cuerpo del bucle
                // Esto evita restaurar state.current inmediatamente y romper la ejecución
                const bodyNode = flow._nodes[bodyId];
                console.log('[Simulador][foreach] bodyId ->', bodyId, 'bodyNode present?', !!bodyNode, bodyNode && bodyNode.type);
                if(!bodyNode){ console.log('[Simulador][foreach] WARNING: body node not found for id=', bodyId); }

                function processChainInline(startId){
                  let curId = startId;
                  let executed = 0;
                  const executedNodes = [];
                  while(curId){
                    console.log('[Simulador][foreach][inline] executing nodeId=', curId);
                    const curNode = flow._nodes[curId];
                    if(!curNode){ console.log('[Simulador][foreach][inline] curNode not found for id=', curId); break; }
                    // manejar tipos básicos inline (sin showTyping ni delays)
                    executed++;
                    executedNodes.push(curId);
                    console.log('[Simulador][foreach][inline] nodeType=', curNode.type, 'nodeId=', curNode.id || curId);
                    switch(curNode.type){
                      case 'response': {
                        const raw = getI18nText(curNode, curNode.text || '');
                        const text = processText(raw, looksLikeMarkdown(raw) || !!curNode.render_markdown || !!curNode.renderMarkdown);
                        const content = document.createElement('div');
                        content.dataset.simNode = curId;
                        content.dataset.simAllowDup = 'true';
                        // If the processed text contains HTML (e.g. marked/Markdown output), render it as HTML
                        // to match the non-inline path which uses innerHTML when strings contain tags.
                        try{
                          if (typeof text === 'string' && text.indexOf('<') !== -1 && text.indexOf('>') !== -1) {
                            // sanitize HTML produced by Markdown before inserting
                            content.innerHTML = sanitizeHtml(text);
                          } else {
                            content.textContent = text;
                          }
                        }catch(_e){ content.textContent = text; }
                        appendChatMessage('bot', content);
                        break;
                      }
                      case 'debug': {
                        try{
                          const raw = curNode.message || curNode.text || getI18nText(curNode, curNode.message || curNode.text || '');
                          const text = processText(raw, looksLikeMarkdown(raw) || !!curNode.render_markdown || !!curNode.renderMarkdown);
                          const content = document.createElement('div'); content.dataset.simNode = curId; content.dataset.simAllowDup = 'true';
                          try{ if (typeof text === 'string' && text.indexOf('<') !== -1 && text.indexOf('>') !== -1) content.innerHTML = sanitizeHtml(text); else content.textContent = text; }catch(_e){ content.textContent = text; }
                          appendChatMessage('bot', content);
                        }catch(_e){ console.warn('[Simulador][inline] debug node render failed', _e); }

                        // payload and save handling
                        try{
                          const rawPayload = (curNode.payload !== undefined) ? curNode.payload : (curNode.data !== undefined ? curNode.data : null);
                          let payloadVal = rawPayload;
                          if (typeof rawPayload === 'string' && rawPayload.trim()){
                            try{ payloadVal = evaluate(rawPayload); }catch(e){ try{ const s = rawPayload.trim(); if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) payloadVal = JSON.parse(s); }catch(_e){} }
                          }
                          if (payloadVal !== undefined && payloadVal !== null && payloadVal !== ''){
                            const content2 = document.createElement('div'); content2.dataset.simNode = curId; content2.dataset.simAllowDup = 'true'; content2.textContent = JSON.stringify(payloadVal, null, 2);
                            appendChatMessage('bot', content2);
                          }
                          const saveKey = curNode.save_as || curNode.saveAs || curNode.variable || curNode.targetVar || null;
                          if (saveKey){ state.variables[saveKey] = payloadVal; }
                        }catch(_e){ console.warn('[Simulador][inline] debug node payload handling failed', _e); }

                        break;
                      }
                      
                      case 'assign_var': {
                        const assignments = Array.isArray(curNode.assignments)
                          ? curNode.assignments.slice()
                          : ((curNode.target || curNode.value) ? [{ target: curNode.target, value: curNode.value }] : []);
                        const msgs = [];
                        for(const a of assignments){
                          const target = (a && a.target) ? String(a.target).trim() : '';
                          const raw = (a && a.value !== undefined) ? a.value : '';
                          let val = raw;
                          try {
                            // Evaluar siempre si es string, para soportar funciones como split(), len(), join(), bool(), etc.
                            if (typeof raw === 'string') {
                              val = evaluate(raw);
                            }
                          } catch(e){ log('Error evaluating assign value: ' + (e && e.message)); }
                          if (target) {
                            if (target.indexOf('.') !== -1) {
                              const parts = target.split('.').filter(Boolean);
                              let cur = state.variables; let createAllowed = true;
                              for(let i=0;i<parts.length-1;i++){ const p = parts[i]; if(cur[p] === undefined || cur[p] === null){ cur[p] = {}; } else if(typeof cur[p] !== 'object'){ createAllowed = false; break; } cur = cur[p]; }
                              if(createAllowed && typeof cur === 'object'){ cur[parts[parts.length-1]] = val; msgs.push(`Asignado ${target} = ${JSON.stringify(val)}`); } else { msgs.push(`Omitido ${target}: parent no es objeto`); }
                            } else { state.variables[target] = val; msgs.push(`Asignado ${target} = ${JSON.stringify(val)}`); }
                          } else { msgs.push('Asignación sin target (ignorada)'); }
                        }
                        const contentMsgs = document.createElement('div'); contentMsgs.dataset.simNode = curId; contentMsgs.dataset.simAllowDup = 'true'; const msgsText = msgs.join('\n'); if(typeof msgsText === 'string' && msgsText.indexOf('<') !== -1 && msgsText.indexOf('>') !== -1) contentMsgs.innerHTML = sanitizeHtml(msgsText); else contentMsgs.textContent = msgsText; appendChatMessage('bot', contentMsgs);
                        break;
                      }
                      case 'set_goto': {
                        // Configurar la variable goto para navegación opcional (inline)
                        state.variables['goto'] = curNode.target || '';
                        const contentGoto = document.createElement('div'); contentGoto.dataset.simNode = curId; contentGoto.dataset.simAllowDup = 'true'; const gotoText = `Set goto = ${JSON.stringify(curNode.target || '')}`; if(typeof gotoText === 'string' && gotoText.indexOf('<') !== -1 && gotoText.indexOf('>') !== -1) contentGoto.innerHTML = sanitizeHtml(gotoText); else contentGoto.textContent = gotoText; appendChatMessage('bot', contentGoto);
                        break;
                      }
                      case 'rest_call': {
                        const saveKey = curNode.save_as || curNode.saveAs || null;
                        const props = curNode.properties || {};
                        const mockData = props.mock !== undefined ? props.mock : { mocked:true, url: props.url || curNode.url || '' };
                        const result = { status: 200, timestamp: new Date().toISOString(), data: mockData };
                        if(saveKey) state.variables[saveKey] = result;
                        const contentRest = document.createElement('div'); contentRest.dataset.simNode = curId; contentRest.dataset.simAllowDup = 'true'; const restText = `REST call (mock) -> ${saveKey || '(sin save)'} = ${JSON.stringify(result)}`; if(typeof restText === 'string' && restText.indexOf('<') !== -1 && restText.indexOf('>') !== -1) contentRest.innerHTML = sanitizeHtml(restText); else contentRest.textContent = restText; appendChatMessage('bot', contentRest);
                        break;
                      }
                      default: {
                        // nodos no manejados inline: añadir un log visual y continuar
                        const contentDef = document.createElement('div'); contentDef.dataset.simNode = curId; contentDef.dataset.simAllowDup = 'true'; const defText = `(inline) Nodo tipo ${curNode.type} ejecutado`; if(typeof defText === 'string' && defText.indexOf('<') !== -1 && defText.indexOf('>') !== -1) contentDef.innerHTML = sanitizeHtml(defText); else contentDef.textContent = defText; appendChatMessage('bot', contentDef);
                        break;
                      }
                    }
                    // avanzar al siguiente del curNode
                    const rawNext = curNode.next;
                    const resolvedNext = (rawNext && (rawNext.node_id || rawNext)) || null;
                    console.log('[Simulador][foreach][inline] rawNext=', rawNext, 'resolvedNext=', resolvedNext);
                    // evitar salir del cuerpo del bucle: si el siguiente apunta al after_loop o al next del nodo foreach,
                    // o apunta al propio nodo del bucle, detenemos la traversa para evitar ejecutar nodos fuera del cuerpo
                    const afterLoopId = node && node.after_loop ? (node.after_loop.node_id || node.after_loop) : null;
                    const loopNextId = node && node.next ? (node.next.node_id || node.next) : null;
                    if (!resolvedNext || resolvedNext === afterLoopId || resolvedNext === loopNextId || resolvedNext === node.id || executed > 50) {
                      console.log('[Simulador][foreach][inline] stopping traversal at', resolvedNext, 'afterLoopId=', afterLoopId, 'loopNextId=', loopNextId);
                      break;
                    }
                    curId = resolvedNext;
                  }
                  console.log('[Simulador][foreach][inline] executed nodes for this iter =', executed, 'ids=', executedNodes.join(','));
                }

                try{
                  processChainInline(bodyId);
                }catch(e){ console.warn('[Simulador] error procesando cuerpo de bucle inline:', e); }
              }catch(e){ console.warn('[Simulador] error renderizando iteración de foreach:', e); }
            }
            // restore variables
            state.variables = prevSnapshot;
            // after loop, advance to after_loop or next
            state.current = gotoNext(node.after_loop || node.next);
            renderPreview(); updateDebugPanels(); presentCurrentNodeInChat();
            return;
          } else {
            // no items found: simply continue to next
            state.current = gotoNext(node.next);
            renderPreview(); updateDebugPanels(); presentCurrentNodeInChat();
            return;
          }
  }catch(e){ console.warn('[Simulador] error manejando loop node:', e); state.current = gotoNext(node.next); renderPreview(); updateDebugPanels(); presentCurrentNodeInChat(); }
        break; }
      case 'condition': {
  const expr = node.expr || node.expression || node.value || ''; const res = evaluate(expr); appendChatMessage('bot', `Condición: ${escapeHtml(expr)} => ${escapeHtml(String(res))}`); state.current = gotoNext(res ? node.true_target : node.false_target); renderPreview(); updateDebugPanels(); presentCurrentNodeInChat(); break; }
      case 'rest_call': {
        const props = node.properties || {};
        const mockMode = props.mock_mode || 'off';
        const mockData = (props.mock !== undefined) ? props.mock : undefined;
        const saveKey = node.save_as || node.saveAs || null;
        const nowIso = () => new Date().toISOString();

        // Helper to persist and render a result
        function finishWithResult(result){
          if (saveKey) {
            state.variables[saveKey] = {
              status: result.status,
              timestamp: nowIso(),
              data: result.data
            };
          }
          appendChatMessage('bot', `REST call -> ${saveKey || '(sin save)'} = status ${result.status}`);
          maybeAppendDiff(__prevVars);
          state.current = gotoNext(node.next);
          renderPreview(); 
          updateDebugPanels(); 
          presentCurrentNodeInChat();
        }

        // If mock always, bypass HTTP entirely
        if (mockMode === 'always') {
          const result = { status: 200, data: mockData };
          finishWithResult(result);
          break;
        }

        if (useRealHttp) {
          // Make real HTTP request
          makeHttpRequest(node).then(result => {
            // If HTTP failed and we want fallback, use mock
            if ((!result.ok || result.status === 0) && mockMode === 'fallback' && mockData !== undefined) {
              finishWithResult({ status: 200, data: mockData });
              return;
            }
            finishWithResult(result);
          }).catch(error => {
            if (mockMode === 'fallback' && mockData !== undefined) {
              finishWithResult({ status: 200, data: mockData });
              return;
            }
            const errRes = { status: 0, data: null };
            if (saveKey) {
              state.variables[saveKey] = { status: 0, timestamp: nowIso(), error: true, message: error.message };
            }
            appendChatMessage('bot', `REST call error: ${error.message}`);
            maybeAppendDiff(__prevVars);
            state.current = gotoNext(node.next);
            renderPreview(); 
            updateDebugPanels(); 
            presentCurrentNodeInChat();
          });
          return; // Exit early for async operation
        } else {
          // Mock behavior (manual switch)
          const result = { status: 200, data: mockData !== undefined ? mockData : { mocked: true, url: props.url || node.url || '' } };
          finishWithResult(result);
        }
        break; }
      case 'hero_card': {
        // soporte simple hero card
  const rawTitle = node.title || (node.i18n?.es?.title) || '';
  const rawSubtitle = node.subtitle || (node.i18n?.es?.subtitle) || '';
  const rawTextBody = node.text || (node.i18n?.es?.text?.join('\n')) || '';
  const title = processText(rawTitle, looksLikeMarkdown(rawTitle) || !!node.render_markdown || !!node.renderMarkdown);
  const subtitle = processText(rawSubtitle, looksLikeMarkdown(rawSubtitle) || !!node.render_markdown || !!node.renderMarkdown);
  const textBody = processText(rawTextBody, looksLikeMarkdown(rawTextBody) || !!node.render_markdown || !!node.renderMarkdown);
        const card = document.createElement('div'); card.className='border rounded-lg p-3 bg-white shadow-sm flex flex-col gap-1 max-w-sm';
        if(title){ const h=document.createElement('div'); h.className='font-semibold'; h.textContent=title; card.appendChild(h);} 
        if(subtitle){ const s=document.createElement('div'); s.className='text-xs text-gray-600'; s.textContent=subtitle; card.appendChild(s);} 
        if(textBody){ const t=document.createElement('div'); t.className='text-sm'; t.textContent=textBody; card.appendChild(t);} 
        // botones
        if(Array.isArray(node.buttons) && node.buttons.length){
          const zone=document.createElement('div'); zone.className='flex flex-col mt-2 gap-2';
          node.buttons.forEach((b,i)=>{
            const lbl = interpolate(b.label || b.text || `Opción ${i+1}`);
            const btn=document.createElement('button'); btn.className='px-3 py-2 bg-white border rounded text-sm text-left hover:bg-gray-100'; btn.textContent=lbl;
            btn.addEventListener('click',()=>{ disableTemporarily(btn,600); appendChatMessage('user', lbl); const target = (b.next && (b.next.node_id || b.next)) || (b.target && (b.target.node_id || b.target)) || (node.next && (node.next.node_id || node.next)) || null; state.current = gotoNext(target); renderPreview(); updateDebugPanels(); presentCurrentNodeInChat(); });
            zone.appendChild(btn);
          });
          card.appendChild(zone);
        }
  showTyping(()=>{ appendChatMessage('bot', card); state.current = (!Array.isArray(node.buttons) || node.buttons.length===0) ? gotoNext(node.next) : state.current; if(state.current && (!node.buttons || node.buttons.length===0)){ renderPreview(); updateDebugPanels(); presentCurrentNodeInChat(); } });
        break; }
      case 'carousel': {
        // cada item como mini-card en horizontal
        const items = node.items || node.cards || [];
        const wrap=document.createElement('div'); wrap.className='flex gap-3 overflow-auto py-2';
        items.forEach((it,idx)=>{
          const c=document.createElement('div'); c.className='border rounded p-2 bg-white shadow-sm min-w-[160px]';
          if(it.title){ const ti=document.createElement('div'); ti.className='font-semibold text-xs'; ti.textContent=interpolate(it.title); c.appendChild(ti);} 
          if(it.text){ const tx=document.createElement('div'); tx.className='text-[11px] mt-1'; tx.textContent=interpolate(it.text); c.appendChild(tx);} 
          if(Array.isArray(it.buttons)){
            const bz=document.createElement('div'); bz.className='flex flex-col mt-2 gap-1';
            it.buttons.forEach((b,i)=>{
              const lbl=interpolate(b.label||b.text||`Btn ${i+1}`);
              const btn=document.createElement('button'); btn.className='px-2 py-1 bg-white border rounded text-[11px] text-left hover:bg-gray-100'; btn.textContent=lbl;
              btn.addEventListener('click',()=>{ disableTemporarily(btn,600); appendChatMessage('user', lbl); const target = (b.next && (b.next.node_id || b.next)) || (b.target && (b.target.node_id || b.target)) || (node.next && (node.next.node_id || node.next)) || null; state.current = gotoNext(target); renderPreview(); updateDebugPanels(); presentCurrentNodeInChat(); });
              bz.appendChild(btn);
            });
            c.appendChild(bz);
          }
          wrap.appendChild(c);
        });
  showTyping(()=>{ appendChatMessage('bot', wrap); state.current = gotoNext(node.next); renderPreview(); updateDebugPanels(); if(state.current) presentCurrentNodeInChat(); });
        break; }
      case 'form': {
        const fields = node.fields || [];
        const form = document.createElement('div'); form.className='border rounded p-3 bg-white shadow-sm flex flex-col gap-3 max-w-sm';
        const title = interpolate(node.title || 'Formulario'); const th=document.createElement('div'); th.className='font-semibold'; th.textContent=title; form.appendChild(th);
        const inputs=[];
        fields.forEach(f=>{
          const wrap=document.createElement('div'); wrap.className='flex flex-col gap-1';
          const lab=document.createElement('label'); lab.className='text-xs font-medium'; lab.textContent=interpolate(f.label||f.name||'Campo'); wrap.appendChild(lab);
          const inp=document.createElement('input'); inp.className='px-2 py-1 border rounded text-sm'; inp.placeholder=f.placeholder||''; wrap.appendChild(inp); inputs.push({def:f,el:inp});
          form.appendChild(wrap);
        });
        const submit=document.createElement('button'); submit.className='mt-2 px-3 py-2 bg-sky-600 text-white rounded text-sm'; submit.textContent='Enviar'; submit.addEventListener('click',()=>{
          const __prev = deepClone(state && state.variables ? state.variables : {});
          inputs.forEach(it=>{ const save=it.def.save_as||it.def.var||it.def.name; if(save) state.variables[save]=it.el.value; });
          appendChatMessage('user','[form enviado]');
          maybeAppendDiff(__prev);
          state.current = gotoNext(node.next); renderPreview(); updateDebugPanels(); presentCurrentNodeInChat();
        }); form.appendChild(submit);
        showTyping(()=>{ appendChatMessage('bot', form); });
        break; }
      case 'multi_button': {
        // Chat: mostrar prompt + opciones con checkboxes y botón Continuar
        const rawText = getI18nText(node, node.prompt || 'Selecciona una o varias opciones');
        const text = processText(rawText, looksLikeMarkdown(rawText) || !!node.render_markdown || !!node.renderMarkdown);

        // Construcción de items dinámicos o estáticos
        let items = [];
        const provider = node.provider || {};
        const srcExpr = node.src || node.source_list || provider.source_list || null;
        const labelExpr = node.labelExpr || node.label_expr || provider.label_expr || 'item.label || item.name || item';
        const valueExpr = node.valueExpr || node.value_expr || provider.value_expr || 'item.value || item.name || item';
        const evalInScope = (expr, item, index) => {
          try {
            if (window.ExpressionParser && typeof window.ExpressionParser.evaluate === 'function'){
              const mergedVars = Object.assign({}, (state && state.variables) ? state.variables : {}, { item, index });
              const epRes = window.ExpressionParser.evaluate(expr, { variables: mergedVars });
              if (epRes !== undefined && !(typeof epRes === 'string' && String(epRes).includes('item'))) return epRes;
            }
          } catch(_e) {}
          try {
            const simpleRE = /^\s*(?:item(?:\.[A-Za-z_$][\w$]*)*|index)\s*$/;
            if (typeof expr === 'string' && simpleRE.test(expr)){
              const t = expr.trim();
              if (t === 'index') return index;
              let cur = item; const parts = t.split('.').slice(1);
              for(const p of parts){ if(cur == null) return null; cur = cur[p]; }
              return cur;
            }
          } catch(_e2) {}
          return evaluate(expr);
        };
        if (srcExpr){
          try{
            const sourceList = evaluate(srcExpr);
            if (Array.isArray(sourceList)){
              let filtered = sourceList;
              const filterExpr = node.filterExpr || node.filter_expr || provider.filter_expr || null;
              if (filterExpr){
                filtered = filtered.filter((it, idx)=>{ try{ return !!evalInScope(filterExpr, it, idx); }catch(_e){ return true; } });
              }
              const sortExpr = node.sortExpr || node.sort_expr || provider.sort_expr || null;
              if (sortExpr){
                filtered = filtered.slice().sort((a,b)=>{
                  const ka = evalInScope(sortExpr, a, 0) ?? '';
                  const kb = evalInScope(sortExpr, b, 0) ?? '';
                  return String(ka).localeCompare(String(kb));
                });
              }
              items = filtered.map((it, i)=>{
                let lbl = evalInScope(labelExpr, it, i); if(lbl === undefined || lbl === null) lbl = `Opción ${i+1}`;
                const val = evalInScope(valueExpr, it, i);
                return { label: String(lbl), value: (val !== undefined && val !== null) ? val : String(lbl) };
              });
            }
          }catch(_e){ /* fallback a estáticas */ }
        }
        if (!Array.isArray(items) || items.length === 0){
          items = (Array.isArray(node.options) ? node.options : []).map((o,i)=>({
            label: getOptionLabel(o) || `Opción ${i+1}`,
            value: (o && (o.value !== undefined)) ? o.value : (getOptionLabel(o) || `Opción ${i+1}`)
          }));
        }

        const saveKey = (node && (node.save_as || node.saveAs)) ? (node.save_as || node.saveAs) : `selected_buttons_${state.current}`;
        const preselected = new Set(Array.isArray(state.variables?.[saveKey]) ? state.variables[saveKey].map(v=>String(v)) : []);
        const minSel = (typeof node.min_selected === 'number') ? node.min_selected : (typeof node.minSelected === 'number' ? node.minSelected : null);
        const maxSel = (typeof node.max_selected === 'number') ? node.max_selected : (typeof node.maxSelected === 'number' ? node.maxSelected : null);
        const isOptional = !!(node.optional === true);
        const defaults = Array.isArray(node.default_values) ? node.default_values : (Array.isArray(node.defaultValues) ? node.defaultValues : null);

        const container = document.createElement('div'); container.className='flex flex-col gap-2 max-w-sm';
        const list = document.createElement('div'); list.className='flex flex-col gap-2';
        const selected = new Set();
        items.forEach((it)=>{
          const row = document.createElement('label'); row.className='flex items-center gap-2';
          const cb = document.createElement('input'); cb.type='checkbox'; cb.className='mr-2';
          cb.checked = preselected.has(String(it.value)); if(cb.checked) selected.add(String(it.value));
          cb.addEventListener('change',()=>{ const v=String(it.value); if(cb.checked) selected.add(v); else selected.delete(v); updateStatus(); });
          const span = document.createElement('span'); span.textContent = String(it.label);
          row.appendChild(cb); row.appendChild(span); list.appendChild(row);
        });
        const info = document.createElement('div'); info.className='text-xs text-gray-600';
        const btn = document.createElement('button'); btn.className='px-3 py-2 bg-sky-600 text-white rounded text-sm self-start disabled:opacity-50'; btn.textContent='Continuar';
        function updateStatus(){
          const count = selected.size; let msg = `${count} seleccionada${count===1?'':'s'}`; let valid = true;
          if (minSel != null && count < minSel){ msg += ` — mínimo ${minSel}`; valid = false; }
          if (maxSel != null && count > maxSel){ msg += ` — máximo ${maxSel}`; valid = false; }
          info.textContent = msg; btn.disabled = !valid;
        }
        btn.addEventListener('click', ()=>{
          let arr = Array.from(selected.values());
          if (arr.length === 0 && isOptional && defaults && defaults.length){ arr = defaults.map(x=>String(x)); }
          if (minSel != null && arr.length < minSel){ info.textContent = `Selecciona al menos ${minSel}`; btn.disabled = true; return; }
          if (maxSel != null && arr.length > maxSel){ info.textContent = `Selecciona como máximo ${maxSel}`; btn.disabled = true; return; }
          const __prev = deepClone(state && state.variables ? state.variables : {});
          state.variables[saveKey] = arr;
          try{ appendChatMessage('bot', createSavedChip(saveKey, JSON.stringify(arr))); }catch(_e){}
          maybeAppendDiff(__prev);
          state.current = gotoNext(node.next);
          renderPreview(); updateDebugPanels(); presentCurrentNodeInChat();
        });
        container.appendChild(list); container.appendChild(info); container.appendChild(btn);
        updateStatus();
        showTyping(()=>{ appendChatMessage('bot', text); appendChatMessage('bot', container); });
        break; }
  case 'end': {
    // En modo chat: si hay stack (proviene de flow_jump con return_on_end), volver al caller
    if (state.callstack && state.callstack.length) {
      const frame = state.callstack.pop();
      const ret = frame?.returnNext || null;
      appendChatMessage('bot','↩ Volviendo…');
      state.current = gotoNext(ret);
      renderPreview(); updateDebugPanels();
      if (state.current) { presentCurrentNodeInChat(); }
      else { appendChatMessage('bot','(fin del flujo)'); }
    } else {
      appendChatMessage('bot','✅ Fin del flujo');
      state.current = null;
    }
    break;
  }
  default: { appendChatMessage('bot', `Nodo tipo ${node.type} no manejado.`); state.current = gotoNext(node.next); break; }
    }
  }

  function handleUserTextInput(text){
    try{ console.log('[Simulador] handleUserTextInput received:', text); }catch(_e){}
    appendChatMessage('user', text);
    // if current node is input, save
    const node = flow._nodes[state.current];
    if(node && node.type === 'input'){
      const __prev = deepClone(state && state.variables ? state.variables : {});
      // compute saveAs with extra fallback to flow.nodes in case normalizeFlow/_nodes uses different structure
      let saveAs = node.save_as || node.saveAs || node.variable || node.targetVar || null;
      try{
        if(!saveAs && flow && flow.nodes && flow.nodes[state.current]){
          const alt = flow.nodes[state.current];
          saveAs = saveAs || alt.save_as || alt.saveAs || alt.variable || alt.var || null;
          try{ console.log('[Simulador] fallback from flow.nodes entry keys:', Object.keys(alt || {})); }catch(_e){}
        }
      }catch(_e){}
      try{ console.log('[Simulador] input node detected, saveAs:', saveAs, 'node.id:', node.node_id || node.id || '(no id)'); }catch(_e){}
      if(!saveAs){
        // try to infer variable name from node id or from empty variables in state
        try{
          // filter out empty or placeholder keys
          const candidates = Object.keys(state.variables || {}).filter(k => k && k !== 'undefined');
          let inferred = null;
          const nid = (node.id || node.node_id || '').toString().toLowerCase();
          const tokens = nid.split(/[^a-z0-9]+/).filter(Boolean);
          if(tokens.length){
            for(const c of candidates){
              const lc = c.toString().toLowerCase();
              for(const t of tokens){ if(t && lc.includes(t)){ inferred = c; break; } }
              if(inferred) break;
            }
            if(inferred) try{ console.log('[Simulador] inferred saveAs by token match:', inferred, 'from node.id tokens', tokens); }catch(_e){}
          }
          if(!inferred){
            const empties = candidates.filter(k => state.variables[k] === '' || state.variables[k] === null || state.variables[k] === undefined);
            if(empties.length === 1){ inferred = empties[0]; try{ console.log('[Simulador] inferred saveAs by single empty variable:', inferred); }catch(_e){} }
            else if(empties.length > 1){
              // if multiple empties, prefer the one that matches node id tokens
              for(const e of empties){
                const lc = e.toString().toLowerCase();
                for(const t of tokens){ if(t && lc.includes(t)){ inferred = e; break; } }
                if(inferred) break;
              }
              if(inferred) try{ console.log('[Simulador] inferred saveAs by token match in empties:', inferred); }catch(_e){}
            }
          }
          if(!inferred && candidates.length === 1){ inferred = candidates[0]; try{ console.log('[Simulador] inferred saveAs by single candidate variable:', inferred); }catch(_e){} }
          if(inferred) saveAs = inferred; else try{ console.log('[Simulador] could not infer saveAs; candidates:', Object.keys(state.variables||{})); }catch(_e){}
          // fallback: if still no saveAs, map input node to next condition variable
          if(!saveAs && node.next && flow && flow._nodes){
            const nextId = node.next.node_id || (node.next.nodeId);
            const nextNode = flow._nodes[nextId];
            if(nextNode && nextNode.type === 'condition'){
              const expr = nextNode.expr || nextNode.expression || nextNode.value || '';
              const matches = expr.match(/\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g) || [];
              // filter out keywords and functions
              const vars = [...new Set(matches.filter(v => !['len','true','false','null','and','or','not'].includes(v)) )];
              if(vars.length === 1){ saveAs = vars[0]; try{ console.log('[Simulador] inferred saveAs from next condition expr:', saveAs); }catch(_e){} }
            }
          }
        }catch(_e){}
      }
      if(saveAs){
        // coerce to string to avoid unexpected types
        const valueToStore = (typeof text === 'string') ? text : String(text);
        state.variables[saveAs] = valueToStore;
        try{ console.log('[Simulador] saved variable ->', saveAs, ':', state.variables[saveAs], ' (type:', typeof state.variables[saveAs], ')'); }catch(_e){}
      } else {
        try{ console.log('[Simulador] input node has no saveAs property. node keys:', Object.keys(node || {}), 'has variable prop?', node ? node.hasOwnProperty('variable') : false, 'node.variable:', node ? node.variable : undefined); }catch(_e){}
        try{ console.log('[Simulador] input node full JSON:', JSON.stringify(node)); }catch(_e){}
        try{ if(flow && flow.nodes && flow.nodes[state.current]) console.log('[Simulador] flow.nodes entry for current:', JSON.stringify(flow.nodes[state.current])); }catch(_e){}
      }
      state.history.push({ node: state.current, type: 'input', value: text });
      // diffs
      maybeAppendDiff(__prev);
  state.current = gotoNext(node.next);
      renderPreview();
      updateDebugPanels();
      presentCurrentNodeInChat();
    } else if (node && (node.type === 'button' || node.type === 'choice' || node.type === 'multi_button')) {
      // Si esperamos button/choice y el usuario envía texto libre, saltar a fallback y volver luego al mismo nodo
      try{ console.log('[Simulador] texto recibido mientras se esperaba', node.type, '→ derivando a fallback'); }catch(_e){}
      const originalFlowId = flow && flow.flow_id ? flow.flow_id : null;
      const originalNodeId = state.current;
      // Preparar retorno
      state.callstack = state.callstack || [];
      state.callstack.push({ returnNext: { flow_id: originalFlowId, node_id: originalNodeId } });
      // Conmutar a fallback si existe
      const ok = simSetActiveFlow('fallback');
      if (!ok) {
        try{ appendChatMessage('bot','(no hay flujo fallback definido)'); }catch(_e){}
        updateDebugPanels();
        return;
      }
      // Ir al start del fallback
      const fbStart = (flow && (flow._start || flow.start_node)) || null;
      state.current = fbStart;
      renderPreview();
      updateDebugPanels();
      if (state.current) presentCurrentNodeInChat(); else appendChatMessage('bot','(fin del flujo)');
    } else {
      updateDebugPanels();
    }
  }

  // Actualiza paneles de depuración (flow, nodo actual, variables)
  function updateDebugPanels(){
    try {
      const flowEl = $('debugFlowJson'); if(flowEl && flow) flowEl.textContent = JSON.stringify(flow, null, 2);
      const nodeEl = $('debugCurrentNode'); if(nodeEl && state && flow){ const n = flow._nodes[state.current] || null; nodeEl.textContent = n ? JSON.stringify(n, null, 2) : '(sin nodo actual)'; }
      const varsEl = $('debugVariables'); if(varsEl && state) {
        const vars = state.variables || {};
        const lines = Object.keys(vars).map(k => `${k}: ${JSON.stringify(vars[k])} (${typeof vars[k]})`);
        varsEl.textContent = lines.join('\n') || '(sin variables)';
      }
      const stackEl = $('debugCallStack'); if(stackEl) {
        const frames = (state && Array.isArray(state.callstack)) ? state.callstack : [];
        if (!frames.length) stackEl.textContent = '(vacía)';
        else {
          try {
            const pretty = frames.map((f,i)=>`#${i} → returnNext: ${JSON.stringify(f.returnNext || null)}`).join('\n');
            stackEl.textContent = pretty || '(vacía)';
          } catch(_e) { stackEl.textContent = JSON.stringify(frames, null, 2); }
        }
      }
      // no limpiar debugVarDiff aquí; se actualiza en maybeAppendDiff para mantener el último diff visible
      // render friendly variables list in the vars editor area as well
      try{ renderVarsPanel(); }catch(_e){}
    } catch(e){ console.warn('updateDebugPanels error', e); }
  }

  // Ensure legacy UI elements are hidden on load, then setup bindings
  function hideSimulatorElementsOnLoad(){
    const ids = ['simulatorSection','simulatorModal','jsonModal'];
    ids.forEach(id => {
      try{
        const el = document.getElementById(id);
        if(!el) return;
        el.classList.add('hidden');
        el.setAttribute('aria-hidden','true');
        // also force style.display none if some code toggles display
        el.style.display = 'none';
      }catch(e){}
    });
  }

  // Initialize on DOM ready: hide legacy UI then bind
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { hideSimulatorElementsOnLoad(); setupUiBindings(); }); else { hideSimulatorElementsOnLoad(); setupUiBindings(); }

  // expose minimal API for debug and runtime inspection
  window.Simulador = {
    loadFlowFromEditor,
    loadFlowFromFile,
    loadFlowFromPath,
    start: () => { $('btnStartSim')?.click(); },
    stop: () => { $('btnStopSim')?.click(); },
    reset: resetSimulation,
    // allow external code (editor) to inspect last runtime state/flow safely
    getRuntimeState: function() { return { flow: flow ? JSON.parse(JSON.stringify(flow)) : null, state: state ? JSON.parse(JSON.stringify(state)) : null }; },
    getVariable: function(name) { try { return state && state.variables ? state.variables[name] : undefined; } catch(e) { return undefined; } }
  };

})();
