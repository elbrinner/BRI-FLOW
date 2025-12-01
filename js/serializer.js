// serializer.js
// Encapsula la serialización del estado a JSON exportable
(function(){
  function _getLabelFromOption(o) {
    if (o.label) return o.label;
    if (o.i18n && typeof o.i18n === 'object') {
      const locales = Object.keys(o.i18n);
      if (locales.length) {
        const first = o.i18n[locales[0]];
        if (first) {
          if (Array.isArray(first.text)) return first.text[0] || '';
          return first.text || '';
        }
      }
    }
    return '';
  }

  function _getTargetFromOption(o) {
    if (!o) return null;
    if (o.next) return o.next;
    if (o.target) return o.target;
    return null;
  }

  function normalizeNode(n){
    const node = { id: n.id, type: n.type };
    // preserve canvas position so exported JSON can restore layout
    if (n.x !== undefined) node.x = n.x;
    if (n.y !== undefined) node.y = n.y;
    if (n.next) node.next = { ...n.next };
    if (n.i18n) node.i18n = JSON.parse(JSON.stringify(n.i18n));
    // include optional documentation field
    if (n.descripcion !== undefined) node.descripcion = String(n.descripcion);

    const copy = (k, destKey = k) => { if (n[k] !== undefined) node[destKey] = JSON.parse(JSON.stringify(n[k])); };

    // helpers extracted to keep switch concise
    function _normalizeRestCall(src, dest) {
      dest.properties = { method: src.method || src.properties?.method || 'GET', url: src.url || src.properties?.url || '', headers: src.headers || src.properties?.headers || {} };
      const bodyVal = src.body || src.properties?.body;
      if (bodyVal !== undefined) dest.properties.body = JSON.parse(JSON.stringify(bodyVal));
      // include mock configuration if present (simulator-only)
      if (src.mock_mode || src.properties?.mock_mode) dest.properties.mock_mode = src.mock_mode || src.properties.mock_mode;
      if (src.mock !== undefined || src.properties?.mock !== undefined) dest.properties.mock = JSON.parse(JSON.stringify(src.mock !== undefined ? src.mock : src.properties?.mock));
      if (src.save_as) dest.save_as = src.save_as;
      if (Array.isArray(src.mappings)) {
        dest.mappings = src.mappings.map(m => {
          if (m.source !== undefined || m.target !== undefined) return { source: m.source || '', target: m.target || '', type: m.type || '' };
          if (m.name !== undefined || m.path !== undefined) return { source: m.path || '', target: m.name || '', type: m.type || '' };
          return { source: m.source || '', target: m.target || '', type: m.type || '' };
        });
      }
    }

    function _normalizeLoop(src, dest) {
      dest.mode = src.mode || 'foreach';
      dest.source_list = src.source_list || src.iterExpr || '';
      dest.item_var = src.item_var || src.itemVar || 'item';
      dest.index_var = src.index_var || 'index';
      dest.body_start = src.body_start || null;
      dest.after_loop = src.after_loop || null;
      if (dest.mode === 'while') dest.cond = src.cond || src.condition || '';
      else dest.cond = src.cond || '';
      if (Array.isArray(src.variables)) dest.variables = JSON.parse(JSON.stringify(src.variables));
    }

    function _normalizeButton(src, dest) {
      dest.mode = src.mode || 'static';
      if (src.variant) dest.variant = src.variant;
      if (src.optional !== undefined) dest.optional = !!src.optional;
      if (src.next) dest.next = src.next;
      if (src.save_as) dest.save_as = src.save_as;
      if (dest.mode === 'dynamic') {
        const p = src.provider || {};
        dest.provider = {
          source_list: p.source_list || src.dynamic_options_from || '',
          label_expr: p.label_expr || '',
          value_expr: p.value_expr || '',
          filter_expr: p.filter_expr || '',
          sort_expr: p.sort_expr || ''
        };
        dest.options = [];
      } else {
        dest.options = Array.isArray(src.options) ? src.options.map(o => {
          const out = { target: _getTargetFromOption(o) };
          // Preserve per-locale labels if available
          if (o.i18n && typeof o.i18n === 'object') {
            out.i18n = JSON.parse(JSON.stringify(o.i18n));
          }
          // Include a plain label for compatibility (first-locale or explicit label)
          const lbl = _getLabelFromOption(o);
          if (lbl) out.label = lbl;
          // Ensure value is always present: explicit or fallback to label
          if (o.value !== undefined && String(o.value).trim() !== '') out.value = o.value;
          else out.value = lbl || '';
          // Preserve per-option variant if present
          if (o.variant) out.variant = o.variant;
          return out;
        }) : [];
      }
    }

    function _parseDefaultValue(def) {
      if (Array.isArray(def)) return def;
      if (def === undefined || def === null || def === '') return [];
      try {
        const parsed = JSON.parse(def);
        return Array.isArray(parsed) ? parsed : [def];
      } catch {
        return [def];
      }
    }

    switch (n.type) {
      case 'response': copy('dataInfo'); break;
      case 'input': copy('save_as'); break;
      case 'choice':
        // Soportar modo prompt (compat) y modo switch
        node.mode = n.mode || 'prompt';
        if (node.mode === 'switch') {
          node.cases = Array.isArray(n.cases) ? n.cases.map(c => ({ when: c.when || '', target: c.target || null })) : [];
          if (n.default_target) node.default_target = { flow_id: n.default_target.flow_id || '', node_id: n.default_target.node_id || '' };
          // mantener compatibilidad: no exportar options/allow_free_text en modo switch
          node.options = [];
        } else {
          node.options = Array.isArray(n.options) ? n.options.map(o => ({ label: o.label || '', target: o.target || null })) : [];
          node.allow_free_text = !!n.allow_free_text;
        }
        break;
      case 'button':
        _normalizeButton(n, node);
        break;
      case 'start':
        if (Array.isArray(n.variables)) {
          node.variables = n.variables.map(v => {
            const isList = !!v.isList;
            let def = v.defaultValue;
            if (isList) {
              def = _parseDefaultValue(def);
            } else {
              def = def === undefined || def === null ? '' : def;
            }
            return { name: v.name || '', defaultValue: def, isList };
          });
        }
        break;
      case 'rest_call':
        _normalizeRestCall(n, node);
        break;
      case 'hero_card': copy('title'); copy('subtitle'); copy('text'); copy('image_url'); copy('buttons'); break;
      case 'carousel': copy('cards'); break;
      case 'form':
        // Nuevo esquema: soportar modo y dinámicos
        node.mode = n.mode || (Array.isArray(n.fields) ? 'static' : 'dynamic');
        if (node.mode === 'dynamic') {
          // preferir raíz snake_case
          if (n.fields_source || n.FieldsSource || n.provider?.source_list) {
            node.fields_source = n.fields_source || n.FieldsSource || n.provider?.source_list || '';
          } else {
            node.fields_source = '';
          }
          if (n.filter_expr) node.filter_expr = n.filter_expr;
          if (n.sort_expr) node.sort_expr = n.sort_expr;
          node.fields = [];
        } else {
          copy('fields');
        }
        if (n.save_as) node.save_as = n.save_as;
        break;
      case 'file_upload': copy('accept'); copy('max_size'); copy('save_as'); break;
      case 'json_export': copy('filename'); copy('description'); copy('template'); break;
      case 'file_download': copy('file_url'); copy('filename'); copy('description'); break;
      case 'flow_jump':
        node.target = n.target ? { flow_id: n.target.flow_id || '', node_id: n.target.node_id || '' } : { flow_id: '', node_id: '' };
        if (n.return_on_end !== undefined) node.return_on_end = !!n.return_on_end; else node.return_on_end = true;
        if (n.return_target) node.return_target = { flow_id: n.return_target.flow_id || '', node_id: n.return_target.node_id || '' };
        node.apply_start_defaults = n.apply_start_defaults || 'onlyMissing';
        if (n.next) node.next = { ...n.next };
        break;
      case 'assign_var':
        if (Array.isArray(n.assignments)) {
          node.assignments = n.assignments
            .filter(a => a && (a.target !== undefined || a.value !== undefined))
            .map(a => ({ target: a.target || '', value: a.value !== undefined ? a.value : '' }));
        } else {
          node.target = n.target || '';
          node.value = n.value || '';
        }
        break;
      case 'condition': node.expr = n.expr || n.condition || ''; node.true_target = n.true_target || n.true_next || null; node.false_target = n.false_target || n.false_next || null; if (n.variables) node.variables = JSON.parse(JSON.stringify(n.variables)); break;
      case 'loop':
      case 'foreach':
        _normalizeLoop(n, node);
        // persist loop_body / body connection if present
        if (n.loop_body) node.loop_body = JSON.parse(JSON.stringify(n.loop_body));
        if (n.body_start) node.body_start = JSON.parse(JSON.stringify(n.body_start));
        break;
      default:
        Object.keys(n).forEach(k => { if (!['id','type','x','y'].includes(k) && typeof n[k] !== 'function') node[k] = JSON.parse(JSON.stringify(n[k])); });
    }
    return node;
  }

  function normalizeAllTargets(nodesObj) {
    const fixTarget = (t) => {
      if (!t) return null;
      // Preservar referencias cross-flow sin validarlas contra nodesObj local
      if (t.flow_id && typeof t.flow_id === 'string') {
        return { flow_id: t.flow_id, node_id: t.node_id || '' };
      }
      // Validar intra-flujo (sin flow_id) contra nodesObj local
      if (t.node_id && nodesObj[t.node_id]) return { flow_id: t.flow_id || '', node_id: t.node_id };
      return null;
    };

    function _normalizeOptions(options) {
      return options.map(o => {
        const tgt = o.target || o.next || null;
        const out = { target: fixTarget(tgt) };
        // Keep both i18n (multi-locale) and plain label when available
        const label = _getLabelFromOption(o);
        if (label) out.label = label;
        if (o.i18n && typeof o.i18n === 'object') out.i18n = JSON.parse(JSON.stringify(o.i18n));
        // Ensure value exists: explicit or fallback to label
        if (o.value !== undefined && String(o.value).trim() !== '') out.value = o.value;
        else out.value = label || '';
        if (o.variant) out.variant = o.variant;
        return out;
      });
    }

    function _normalizeKnotOutputs(outputs) {
      return outputs.map(o => {
        const tgt = o.target || o.next || null;
        const out = { target: fixTarget(tgt) };
        const label = _getLabelFromOption(o);
        if (label) out.label = label;
        if (o.i18n && typeof o.i18n === 'object') out.i18n = JSON.parse(JSON.stringify(o.i18n));
        if (o.variant) out.variant = o.variant;
        return out;
      });
    }

    for (const id in nodesObj) {
      const nd = nodesObj[id];
      if (nd.next) nd.next = fixTarget(nd.next);
      if (nd.type === 'flow_jump') {
        if (nd.target) nd.target = fixTarget(nd.target) || { flow_id: '', node_id: '' };
        if (nd.return_target) nd.return_target = fixTarget(nd.return_target);
      }
      if (nd.options && Array.isArray(nd.options)) {
        nd.options = _normalizeOptions(nd.options);
      }
      // Normalizar cases en choice switch
      if (nd.type === 'choice' && nd.mode === 'switch' && Array.isArray(nd.cases)) {
        nd.cases = nd.cases.map(c => ({ when: c.when || '', target: fixTarget(c.target) }));
        if (nd.default_target) nd.default_target = fixTarget(nd.default_target);
      }
      if (nd.knot && Array.isArray(nd.knot.outputs)) {
        nd.knot.outputs = _normalizeKnotOutputs(nd.knot.outputs);
      }
      if (nd.true_target) nd.true_target = fixTarget(nd.true_target);
      if (nd.false_target) nd.false_target = fixTarget(nd.false_target);
      if (nd.body_start) nd.body_start = fixTarget(nd.body_start);
      if (nd.after_loop) nd.after_loop = fixTarget(nd.after_loop);
      if (nd.loop_body) nd.loop_body = fixTarget(nd.loop_body);
    }
  }

  function generateFlowJson(state){
    const nodesObj = {};
    for (const id in state.nodes) nodesObj[id] = normalizeNode(state.nodes[id]);
    normalizeAllTargets(nodesObj);
    // Quitar nodos solo-simulador (no deben persistir secretos ni perfiles)
    const SIM_ONLY = new Set(['credential_profile','use_profile']);
    // Reencaminar "next" que apunten a nodos sim-only (passthrough)
    function skipSimOnlyTarget(t){
      let current = t;
      const guard = new Set();
      while(current && current.node_id && nodesObj[current.node_id] && SIM_ONLY.has(nodesObj[current.node_id].type)){
        if(guard.has(current.node_id)) break; // evitar bucles raros
        guard.add(current.node_id);
        const nextOfSim = nodesObj[current.node_id].next || null;
        current = nextOfSim || null;
      }
      return current;
    }
    Object.keys(nodesObj).forEach(id => {
      const n = nodesObj[id];
      if(n.next) n.next = skipSimOnlyTarget(n.next);
      if(n.true_target) n.true_target = skipSimOnlyTarget(n.true_target);
      if(n.false_target) n.false_target = skipSimOnlyTarget(n.false_target);
      if(n.body_start) n.body_start = skipSimOnlyTarget(n.body_start);
      if(n.after_loop) n.after_loop = skipSimOnlyTarget(n.after_loop);
      if(n.loop_body) n.loop_body = skipSimOnlyTarget(n.loop_body);
      if(Array.isArray(n.options)){
        n.options = n.options.map(o => ({...o, target: skipSimOnlyTarget(o.target||o.next||null) }));
      }
      if(n.cases && Array.isArray(n.cases)){
        n.cases = n.cases.map(c => ({ when: c.when || '', target: skipSimOnlyTarget(c.target||null) }));
        if(n.default_target) n.default_target = skipSimOnlyTarget(n.default_target);
      }
    });
    // Eliminar los nodos sim-only del export
    Object.keys(nodesObj).forEach(id => { if (SIM_ONLY.has(nodesObj[id].type)) delete nodesObj[id]; });
    // Auto-bump de versión y timestamp de modificación
    const bumpVersion = (v) => {
      if (!v || typeof v !== 'string') return '0.1.0';
      if (/^\d+$/.test(v)) return String(parseInt(v, 10) + 1);
  const semverRe = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/;
  const m = semverRe.exec(v);
      if (m) return `${m[1]}.${m[2]}.${parseInt(m[3], 10) + 1}`;
      return '0.1.0';
    };
    const meta = { ...(state.meta || {}) };
    meta.version = bumpVersion(meta.version);
    meta.last_modified = new Date().toISOString();
  const out = { schema_version: 2, ...meta, nodes: nodesObj };
    if (out.start_node && !nodesObj[out.start_node]) out.start_node = '';
    return out;
  }

  window.AppSerializer = { normalizeNode, normalizeAllTargets, generateFlowJson };
})();
