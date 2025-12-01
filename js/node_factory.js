// node_factory.js
// Centraliza la creación de nodos y genId
(function(){
  let stateRef = null;
  let renderNode = null;
  let selectNode = null;
  let refreshOutput = null;

  function initNodeByType(base, type, locales){
    const t = type;
    const ensureI18n = (obj, keys) => { obj.i18n = obj.i18n || {}; keys.forEach(l=>{ obj.i18n[l] = obj.i18n[l] || {}; }); };
    switch (t){
      case 'start':
        // Nodo Start: ahora centraliza definición de locales del proyecto.
        base.variables = base.variables || [];
        // Si ya trae locales (recreación), respetarlos; si no, tomar de meta.locales o default ['es'].
        if (!base.locales || !Array.isArray(base.locales) || base.locales.length === 0) {
          const metaLocales = (stateRef && stateRef.meta && Array.isArray(stateRef.meta.locales) && stateRef.meta.locales.length)
            ? stateRef.meta.locales : ['es'];
          base.locales = [...metaLocales];
        }
        break;
      case 'extra':
        // Nodo minimalista: solo usa next y descripcion; sin props especiales
        break;
      case 'end':
        // no special props
        break;
      case 'response':
        ensureI18n(base, locales);
        locales.forEach(l => { base.i18n[l].text = base.i18n[l].text || []; });
        break;
      case 'hidden_response':
        // No i18n, solo dataInfo
        break;
      case 'input':
        ensureI18n(base, locales);
        locales.forEach(l => { base.i18n[l].prompt = base.i18n[l].prompt || ''; });
        base.save_as = '';
        break;
      case 'assign_var':
        base.target = '';
        base.value = '';
        break;
      case 'choice':
        ensureI18n(base, locales);
        locales.forEach(l => { base.i18n[l].prompt = base.i18n[l].prompt || ''; });
        base.mode = base.mode || 'prompt';
        if (base.mode === 'switch') {
          base.cases = base.cases || [];
          base.default_target = base.default_target || null;
        } else {
          base.options = base.options || [];
          base.allow_free_text = !!base.allow_free_text;
        }
        break;
      case 'rest_call':
        base.method = 'GET'; base.url = ''; base.headers = {}; base.save_as = ''; base.save_path = ''; base.mappings = [];
        break;
      case 'button':
        ensureI18n(base, locales);
        locales.forEach(l => { base.i18n[l].prompt = base.i18n[l].prompt || ''; });
        base.options = [{ label: 'Opción 1', target: null }];
        base.mode = 'static';
        base.provider = { source_list: '', label_expr: '', value_expr: '', filter_expr: '', sort_expr: '' };
        base.optional = false;
        base.variant = 'primary';
        break;
      case 'multi_button':
        ensureI18n(base, locales);
        locales.forEach(l => { base.i18n[l].prompt = base.i18n[l].prompt || ''; });
        base.options = [{ label: 'Opción 1' }];
        base.mode = 'static';
        base.provider = { source_list: '', label_expr: '', value_expr: '', filter_expr: '', sort_expr: '' };
        base.optional = false;
        base.variant = 'primary';
        break;
      case 'loop': {
        base.mode = base.mode || 'foreach'; // foreach | while
        base.source_list = base.source_list || '';
        if (base.mode === 'while'){
          base.item_var = base.item_var || 'i';
          base.index_var = base.index_var || '';
          base.cond = base.cond || 'i < 10';
        } else {
          base.item_var = base.item_var || 'item';
          base.index_var = base.index_var || 'index';
          base.cond = base.cond || '';
        }
        base.body_start = base.body_start || null; // { flow_id:'', node_id:'' }
        base.after_loop = base.after_loop || null;
        base.variables = base.variables || [];
        base.slots = base.slots || { slot0: [], slot1: [] };
        break;
      }
      case 'hero_card':
        base.title = ''; base.subtitle = ''; base.text = ''; base.image_url = ''; base.buttons = [];
        break;
      case 'carousel':
        base.cards = [];
        break;
      case 'form':
        base.fields = [];
        break;
      case 'file_upload':
        base.accept = ''; base.max_size = 0; base.save_as = '';
        break;
      case 'json_export':
        base.filename = 'export.json'; base.description = ''; base.template = {};
        break;
      case 'condition':
        base.expr = base.expr || '';
        base.true_target = base.true_target || null;
        base.false_target = base.false_target || null;
        base.variables = base.variables || [];
        break;
      case 'flow_jump':
        base.target = base.target || { flow_id: '', node_id: '' };
        base.return_on_end = (base.return_on_end !== false);
        base.return_target = base.return_target || null; // { flow_id, node_id } opcional
        base.apply_start_defaults = base.apply_start_defaults || 'onlyMissing';
        break;
      case 'set_goto':
        base.target = base.target || '';
        break;
    }
  }

  function init(opts){
    stateRef = opts.state || stateRef;
    renderNode = opts.renderNode || renderNode;
    selectNode = opts.selectNode || selectNode;
    refreshOutput = opts.refreshOutput || refreshOutput;
  }

  function genId(type){
    let n = 1;
    while (stateRef?.nodes?.[`${type}_${n}`]) n++;
    return `${type}_${n}`;
  }

  function createNode(type, x=20, y=20){
    if (!stateRef) throw new Error('node_factory: state not initialized');
    // Unicidad de Start: si ya existe uno en meta, seleccionar
    if (type === 'start') {
      const metaStart = stateRef.meta?.start_node;
      if (metaStart && stateRef.nodes[metaStart]) {
        selectNode?.(metaStart);
        return stateRef.nodes[metaStart];
      }
    }
    // Keep the actual type (foreach/while) so form renderer can pick a specialized panel.
  const actualType = (type === 'choice_switch') ? 'choice' : type;
  const id = genId(actualType);
  const base = { id, type: actualType, x, y, next: null, descripcion: '' };
    if(type === 'start'){
      const prev = stateRef.meta.start_node;
      if(prev && stateRef.nodes[prev]){
        stateRef.nodes[prev].type = 'response';
        renderNode?.(stateRef.nodes[prev]);
      }
      stateRef.meta.start_node = id;
      // Sincronizar locales hacia meta por compatibilidad con código existente que aún lee meta.locales.
      if (Array.isArray(base.locales) && base.locales.length) {
        stateRef.meta.locales = [...base.locales];
      }
    }
    const locales = Array.isArray(stateRef.meta.locales) && stateRef.meta.locales.length ? stateRef.meta.locales : ['en'];
    // Apply loop defaults when creating foreach/while by asking initNodeByType for 'loop'.
    if (type === 'foreach' || type === 'while') {
      base.mode = (type === 'while') ? 'while' : 'foreach';
      initNodeByType(base, 'loop', locales);
    } else {
      initNodeByType(base, actualType, locales);
      // Specialize choice created from palette as switch when requested
      if (type === 'choice_switch') {
        base.mode = 'switch';
        base.cases = base.cases || [{ when: '', target: null }];
        base.default_target = null;
      }
    }
    stateRef.nodes[id] = base;
    renderNode?.(base);
    selectNode?.(id);
    // link start node next to first created node if start exists and has no next
    function linkStartIfNeeded(newId){
      try{
        if (type === 'start') return;
        const startId = stateRef?.meta?.start_node;
        if (!startId) return;
        const startNode = stateRef.nodes?.[startId];
        if (!startNode) return;
        if (!startNode.next) {
          startNode.next = { flow_id: '', node_id: newId };
          renderNode?.(startNode);
        }
  }catch(err){ console.warn('[node_factory] linkStartIfNeeded failed', err); }
    }
    linkStartIfNeeded(id);
    refreshOutput?.();
    return base;
  }

  window.AppNodeFactory = { init, createNode, genId };
})();
