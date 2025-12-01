// js/connections.js — gestor robusto y limpio de conexiones (jsPlumb)
// Objetivo: que las líneas no se pierdan al abrir/importar flujos y aparezcan sin mover nodos.
// Estrategia: endpoints en 4 lados, revalidate por nodo, conexión en múltiples pasadas y reintentos escalonados.
(function () {
  'use strict';

  let jsPlumbRef = null;
  let _refreshInProgress = false;
  let _queuedRefresh = false;

  function init(jsPlumbObj) {
    jsPlumbRef = jsPlumbObj;
  }

  function addEndpoints(state, nodeId) {
    if (!jsPlumbRef) return;
    const elId = 'node_' + nodeId;
    const el = document.getElementById(elId);
    if (!el) return;
    try { if (jsPlumbRef.removeAllEndpoints) jsPlumbRef.removeAllEndpoints(elId); } catch (_e) { }
    const anchors = ['Top', 'Bottom', 'Left', 'Right'];
    for (let i = 0; i < anchors.length; i++) {
      const anchor = anchors[i];
      try {
        jsPlumbRef.addEndpoint(elId, {
          anchor: anchor,
          isSource: true,
          isTarget: true,
          maxConnections: -1,
          endpoint: ['Dot', { radius: 6 }],
          paintStyle: { fill: '#fff', stroke: '#7c93b8', strokeWidth: 2 }
        });
      } catch (_e) {
        try { jsPlumbRef.addEndpoint(elId, { anchor: anchor, isSource: true, isTarget: true, maxConnections: -1 }); } catch (__e) { }
      }
    }
  }

  function resolveTargetRef(t, currentFlowId) {
    if (!t) return null;
    if (typeof t === 'string') return t;
    if (typeof t === 'object') {
      // Si especifica flow_id y es diferente al actual, no dibujar línea
      if (t.flow_id && currentFlowId && t.flow_id !== currentFlowId) return null;
      return t.node_id;
    }
    return null;
  }

  function refreshConnections(state) {
    if (!jsPlumbRef) return;
    if (_refreshInProgress) { _queuedRefresh = true; return; }
    _refreshInProgress = true;

    const currentFlowId = (state.meta && state.meta.flow_id) ? state.meta.flow_id : '';

    try { if (jsPlumbRef.setSuspendDrawing) jsPlumbRef.setSuspendDrawing(true); } catch (_e) { }
    try { if (jsPlumbRef.deleteEveryConnection) jsPlumbRef.deleteEveryConnection(); } catch (_e) { }

    // Endpoints y revalidate
    try {
      for (const id in state.nodes) {
        addEndpoints(state, id);
        try { if (jsPlumbRef.revalidate) jsPlumbRef.revalidate('node_' + id); } catch (_e) { }
        try { if (jsPlumbRef.repaint) jsPlumbRef.repaint('node_' + id); } catch (_e) { }
      }
    } catch (_e) { }

    // Especificaciones a conectar
    const toConnect = [];
    function pushSpec(fromId, toId, label, flags) {
      if (!toId) return;
      if (!(state.nodes && state.nodes[toId])) return;
      const spec = { source: 'node_' + fromId, target: 'node_' + toId };
      if (label) spec.label = label;
      if (flags) { for (const k in flags) spec[k] = flags[k]; }
      toConnect.push(spec);
    }

    for (const id in state.nodes) {
      const node = state.nodes[id] || {};
      // next: para button y multi_button, solo conectar en modo dinámico
      if (!((node.type === 'button' || node.type === 'multi_button') && node.mode !== 'dynamic')) {
        pushSpec(id, resolveTargetRef(node.next, currentFlowId), null);
      }
      // choice: modo switch -> cases y default_target
      if (node.type === 'choice' && (node.mode === 'switch')) {
        if (Array.isArray(node.cases)) {
          for (let k = 0; k < node.cases.length; k++) {
            const c = node.cases[k] || {};
            const tgt = resolveTargetRef(c.target, currentFlowId);
            const lbl = (c.when && String(c.when).trim()) ? String(c.when).trim() : `case ${k + 1}`;
            pushSpec(id, tgt, lbl ? `when: ${lbl}` : null, { isChoiceCase: true });
          }
        }
        if (node.default_target) {
          const dt = resolveTargetRef(node.default_target, currentFlowId);
          pushSpec(id, dt, 'default', { isChoiceDefault: true });
        }
      }
      // connections
      if (Array.isArray(node.connections)) {
        for (let i = 0; i < node.connections.length; i++) {
          const c = node.connections[i];
          pushSpec(id, resolveTargetRef(c, currentFlowId), (c && c.label) ? c.label : null);
        }
      }
      // options (choice/button/multi_button): para button/multi_button dinámico, no hay enlaces por opción
      if (Array.isArray(node.options)) {
        const isBtnLikeDynamic = ((node.type === 'button' || node.type === 'multi_button') && node.mode === 'dynamic');
        if (!isBtnLikeDynamic) {
          for (let j = 0; j < node.options.length; j++) {
            const opt = node.options[j] || {};
            const tgt = resolveTargetRef(opt.next || opt.target, currentFlowId);
            let lbl = opt.label || '';
            if (!lbl && opt.i18n && typeof opt.i18n === 'object') {
              const ks = Object.keys(opt.i18n);
              if (ks.length) {
                const v = opt.i18n[ks[0]];
                if (v) lbl = Array.isArray(v.text) ? (v.text[0] || '') : (v.text || '');
              }
            }
            pushSpec(id, tgt, lbl || null);
          }
        }
        // choice en modo prompt: conectar opciones que tengan destino
        if (node.type === 'choice' && (node.mode === undefined || node.mode === 'prompt')) {
          for (let j = 0; j < node.options.length; j++) {
            const opt = node.options[j] || {};
            const tgt = resolveTargetRef(opt.next || opt.target, currentFlowId);
            if (!tgt) continue;
            let lbl = opt.label || '';
            pushSpec(id, tgt, lbl ? `opt: ${lbl}` : `opt#${j + 1}`, { isChoiceOpt: true });
          }
        }
      }
      // condition
      pushSpec(id, resolveTargetRef(node.true_target, currentFlowId), 'TRUE');
      pushSpec(id, resolveTargetRef(node.false_target, currentFlowId), 'FALSE');
      // loop/foreach
      pushSpec(id, resolveTargetRef(node.body_start, currentFlowId), 'BODY');
      pushSpec(id, resolveTargetRef(node.after_loop, currentFlowId), 'AFTER');
      if (node.loop_body) pushSpec(id, resolveTargetRef(node.loop_body, currentFlowId), '🔁 Loop', { isLoopBody: true });
      // set_goto return
      if (node.type === 'set_goto' && node.target) pushSpec(id, resolveTargetRef(node.target, currentFlowId), 'return', { isGotoReturn: true });
      // flow_jump y su return_target
      if (node.type === 'flow_jump') {
        pushSpec(id, resolveTargetRef(node.target, currentFlowId), 'Jump');
        if (node.return_target) pushSpec(id, resolveTargetRef(node.return_target, currentFlowId), 'return', { isGotoReturn: true });
      }
    }

    // Mantener pares creados entre intentos para saber cuándo terminamos
    const createdPairs = new Set();

    function doConnectPass() {
      let createdCount = 0;

      function ensureEndpointsFor(spec) {
        try {
          const srcId = spec.source.replace(/^node_/, '');
          const tgtId = spec.target.replace(/^node_/, '');
          let sOk = true, tOk = true;
          try {
            if (jsPlumbRef.getEndpoints) {
              const sArr = jsPlumbRef.getEndpoints(spec.source) || [];
              const tArr = jsPlumbRef.getEndpoints(spec.target) || [];
              sOk = sArr.length > 0; tOk = tArr.length > 0;
            }
          } catch (_e) { }
          if (!sOk) { addEndpoints(state, srcId); try { if (jsPlumbRef.revalidate) jsPlumbRef.revalidate(spec.source); } catch (_e) { } }
          if (!tOk) { addEndpoints(state, tgtId); try { if (jsPlumbRef.revalidate) jsPlumbRef.revalidate(spec.target); } catch (_e) { } }
        } catch (_e) { }
      }

      function connectWithGuards(spec) {
        if (!spec) return false;
        if (spec.source === spec.target) return false; // evitar self
        const key = spec.source + '|' + spec.target + '|' + (spec.label || '');
        if (createdPairs.has(key)) return true;
        const sEl = document.getElementById(spec.source);
        const tEl = document.getElementById(spec.target);
        if (!sEl || !tEl) return false;
        ensureEndpointsFor(spec);

        const overlays = spec.label ? [['Label', { label: spec.label, location: 0.5 }]] : [];
        let paintStyle = { stroke: '#456', strokeWidth: 2 };
        if (spec.isGotoReturn) paintStyle = { stroke: '#f97316', strokeWidth: 6 };
        else if (spec.isLoopBody) paintStyle = { stroke: '#f97316', strokeWidth: 3 };
        else if (spec.isChoiceDefault) paintStyle = { stroke: '#9333ea', strokeWidth: 3, dashstyle: '4 2' }; // morado y punteado para default
        try {
          jsPlumbRef.connect({ source: spec.source, target: spec.target, anchors: ['Continuous', 'Continuous'], overlays: overlays, paintStyle: paintStyle });
          createdPairs.add(key); createdCount++; return true;
        } catch (_e) {
          try {
            jsPlumbRef.connect({ source: spec.source, target: spec.target, overlays: overlays });
            createdPairs.add(key); createdCount++; return true;
          } catch (__e) {
            return false;
          }
        }
      }

      // Fuerza un reflow antes de conectar (asegura layout estable)
      try { const _w = (document.getElementById('canvasInner') || {}).offsetWidth; void _w; } catch (_rf) { }
      for (let i = 0; i < toConnect.length; i++) { try { connectWithGuards(toConnect[i]); } catch (_e) { } }
      for (let j = 0; j < toConnect.length; j++) { try { connectWithGuards(toConnect[j]); } catch (_e) { } }
      return createdCount;
    }

    function scheduleAttempts(attempt) {
      const count = doConnectPass();
      const allBuilt = (createdPairs.size >= toConnect.length);
      try { if (jsPlumbRef.repaintEverything) jsPlumbRef.repaintEverything(); } catch (_e) { }
      if (allBuilt || attempt >= 4) {
        try { if (jsPlumbRef.setSuspendDrawing) jsPlumbRef.setSuspendDrawing(false, true); } catch (_e) { }
        _refreshInProgress = false;
        if (_queuedRefresh) { _queuedRefresh = false; setTimeout(function () { refreshConnections(state); }, 0); }
        return;
      }
      if (attempt === 0) {
        try { requestAnimationFrame(function () { scheduleAttempts(attempt + 1); }); } catch (_e) { setTimeout(function () { scheduleAttempts(attempt + 1); }, 16); }
      } else if (attempt === 1) {
        setTimeout(function () { scheduleAttempts(attempt + 1); }, 50);
      } else if (attempt === 2) {
        setTimeout(function () { scheduleAttempts(attempt + 1); }, 150);
      } else {
        // último intento más largo por si hay imágenes o fuentes que tardan
        setTimeout(function () { scheduleAttempts(attempt + 1); }, 300);
      }
    }

    try {
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(function () { scheduleAttempts(0); });
      else setTimeout(function () { scheduleAttempts(0); }, 0);
    } catch (_e) { setTimeout(function () { scheduleAttempts(0); }, 0); }
  }

  window.AppConnections = { init: init, addEndpoints: addEndpoints, refreshConnections: refreshConnections };
})();