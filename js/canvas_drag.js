// canvas_drag.js
// Maneja drag & drop en el canvas: mover nodos y crear desde la paleta
(function () {
  let canvas, canvasInner, renderNode, selectNode, createNode, zoomRef, stateRef, refreshOutput;
  let autoGrow;

  // State for connection highlighting
  let highlightedConn = null;
  let originalPaintStyle = null;

  function getGrid() { return (window.App && typeof window.App.getGridSize === 'function') ? window.App.getGridSize() : 20; }
  function isSnap() { return (window.App && typeof window.App.getSnapEnabled === 'function') ? window.App.getSnapEnabled() : true; }
  function snap(v) { const g = getGrid(); return Math.round(v / g) * g; }
  const ALLOWED_TYPES = ['response', 'input', 'choice', 'choice_switch', 'rest_call', 'hero_card', 'carousel', 'form', 'file_upload', 'json_upload', 'json_export', 'file_download', 'condition', 'loop', 'end', 'start', 'foreach', 'while', 'flow_jump', 'set_goto', 'debug', 'hidden_response', 'agent_call', 'credential_profile', 'use_profile'];

  // Helpers to reduce complexity
  function getCanvasCoordsFromEvent(e, offsetX = 0, offsetY = 0) {
    const rect = canvas.getBoundingClientRect();
    const scrollLeft = canvas.scrollLeft || 0;
    const scrollTop = canvas.scrollTop || 0;
    const z = (zoomRef && typeof zoomRef === 'function') ? (zoomRef() || 1) : 1;
    const x = ((e.clientX - rect.left) + scrollLeft) / z - offsetX;
    const y = ((e.clientY - rect.top) + scrollTop) / z - offsetY;
    if (!isSnap()) return { x, y };
    return { x: snap(x), y: snap(y) };
  }

  // Helper to find connection under mouse
  function findConnectionAtPoint(x, y) {
    if (typeof jsPlumb === 'undefined') return null;

    // 1. Get all elements at the point
    const elements = document.elementsFromPoint(x, y);
    if (!elements || elements.length === 0) return null;

    // 2. Get all connections
    let conns;
    try {
      conns = jsPlumb.getAllConnections();
    } catch (e) {
      console.warn('jsPlumb.getAllConnections failed', e);
      return null;
    }
    const list = Array.isArray(conns) ? conns : (typeof conns === 'object' ? Object.values(conns) : []);

    // 3. Find intersection
    for (const c of list) {
      // Check main canvas (SVG path) - support various jsPlumb versions/structures
      const canvasEl = c.canvas || (c.connector && (c.connector.canvas || c.connector.svg));

      if (canvasEl && (elements.includes(canvasEl) || canvasEl.contains(document.elementFromPoint(x, y)))) {
        return c;
      }

      // Check overlays (labels, arrows)
      const overlays = c.getOverlays();
      if (overlays) {
        const ovs = Array.isArray(overlays) ? overlays : Object.values(overlays);
        for (const ov of ovs) {
          if (ov.canvas && elements.includes(ov.canvas)) return c;
        }
      }
    }
    return null;
  }

  function handleMoveExistingNodeDrop(nodeId, e) {
    console.log('[canvas_drag] handleMoveExistingNodeDrop called for:', nodeId);

    const offX = parseFloat(e.dataTransfer.getData('dragOffsetX') || '0');
    const offY = parseFloat(e.dataTransfer.getData('dragOffsetY') || '0');
    console.log('[canvas_drag] Drag offsets:', { offX, offY });

    // Use helper to respect scroll and snap
    const { x, y } = getCanvasCoordsFromEvent(e, offX, offY);
    console.log('[canvas_drag] Calculated new coords:', { x, y });

    const n = stateRef.nodes[nodeId];
    if (n) {
      console.log('[canvas_drag] Current node position:', { oldX: n.x, oldY: n.y });

      // Capture old state for history
      const oldPos = { x: n.x, y: n.y };
      const newPos = { x, y };
      const sideEffects = { before: {}, after: {} };

      n.x = x; n.y = y;
      console.log('[canvas_drag] Set new node position:', { newX: n.x, newY: n.y });

      // Auto-insert logic for existing nodes
      let conn = highlightedConn;
      if (!conn) conn = findConnectionAtPoint(e.clientX, e.clientY);

      if (conn) {
        console.log('[canvas_drag] Existing node drop on connection:', conn);
        const sourceId = conn.sourceId.replace('node_', '');
        const targetId = conn.targetId.replace('node_', '');

        // Avoid self-connection
        if (sourceId !== nodeId && targetId !== nodeId) {
          console.log('[canvas_drag] Splitting connection for existing node:', nodeId);

          // 1. Update source -> moved node
          const sourceNode = stateRef.nodes[sourceId];
          if (sourceNode) {
            // CAPTURE BEFORE STATE
            try { sideEffects.before[sourceId] = JSON.parse(JSON.stringify(sourceNode)); } catch (e) { }

            let replaced = false;
            const replaceRef = (obj) => {
              if (obj && obj.node_id === targetId) {
                obj.node_id = nodeId;
                replaced = true;
              }
            };

            if (sourceNode.next) replaceRef(sourceNode.next);
            if (sourceNode.true_target) replaceRef(sourceNode.true_target);
            if (sourceNode.false_target) replaceRef(sourceNode.false_target);
            if (Array.isArray(sourceNode.options)) sourceNode.options.forEach(opt => replaceRef(opt));
            if (sourceNode.cases && typeof sourceNode.cases === 'object') Object.values(sourceNode.cases).forEach(c => replaceRef(c));
            if (sourceNode.type === 'loop' && sourceNode.done_target) replaceRef(sourceNode.done_target);
            if (sourceNode.default_target) replaceRef(sourceNode.default_target);

            if (replaced) {
              console.log('[canvas_drag] Source node updated.');

              // 3. Delete old connection (Do this BEFORE rendering to avoid stale element references)
              try { jsPlumb.deleteConnection(conn); } catch (err) { }

              renderNode(sourceNode);
              // CAPTURE AFTER STATE
              try { sideEffects.after[sourceId] = JSON.parse(JSON.stringify(sourceNode)); } catch (e) { }
            }
          }

          // 2. Update moved node -> target
          if (n.type !== 'end') {
            // Overwrite 'next' or set it if missing
            if (!n.options && !n.true_target) {
              n.next = { flow_id: stateRef.meta.flow_id, node_id: targetId };
              console.log('[canvas_drag] Moved node next set to:', targetId);
            }
          }

          // Cleanup highlight
          if (highlightedConn) {
            try { highlightedConn.setPaintStyle(originalPaintStyle || { stroke: '#456', strokeWidth: 2 }); } catch (err) { }
            highlightedConn = null;
            originalPaintStyle = null;
          }
        }
      }

      // Bulk Move Logic (applies to both connection drop and regular drop)
      const deltaX = newPos.x - oldPos.x;
      const deltaY = newPos.y - oldPos.y;

      const commands = [];

      // 1. Command for the primary node (with side effects from connection logic if any)
      commands.push(
        window.AppHistoryManager.createMoveNodeCommand(nodeId, oldPos, newPos, sideEffects)
      );

      // 2. Check for other selected nodes (multi-selection)
      if (window.AppSelectionManager && window.AppSelectionManager.isSelected(nodeId)) {
        const selectedIds = window.AppSelectionManager.getSelection();
        selectedIds.forEach(otherId => {
          if (otherId === nodeId) return; // Skip primary
          const otherNode = stateRef.nodes[otherId];
          if (otherNode) {
            const otherOldPos = { x: otherNode.x, y: otherNode.y };
            const otherNewPos = { x: otherNode.x + deltaX, y: otherNode.y + deltaY };

            otherNode.x = otherNewPos.x;
            otherNode.y = otherNewPos.y;

            renderNode(otherNode);

            // Add simple move command (no side effects for secondary nodes for now)
            if (window.AppHistoryManager) {
              commands.push(
                window.AppHistoryManager.createMoveNodeCommand(otherId, otherOldPos, otherNewPos, { before: {}, after: {} })
              );
            }
          }
        });
      }

      // ALWAYS render the primary node after position update
      renderNode(n);
      console.log('[canvas_drag] After renderNode, node position should be:', { x: n.x, y: n.y });
      selectNode(nodeId);
      refreshOutput();
      if (autoGrow) autoGrow();

      // Record History - record each command individually
      if (window.AppHistoryManager && commands.length > 0) {
        commands.forEach(cmd => {
          window.AppHistoryManager.recordCommand(cmd);
        });
      }
    }
  }

  function handleCreateNodeDrop(type, e) {
    // 1. Detectar si se soltó sobre una conexión (usar highlightedConn si existe)
    let connection = highlightedConn;

    // Si por alguna razón no hay highlightedConn pero estamos sobre una (edge case), buscarla
    if (!connection) {
      connection = findConnectionAtPoint(e.clientX, e.clientY);
    }

    // Limpiar highlight antes de proceder
    if (highlightedConn) {
      try {
        if (originalPaintStyle) highlightedConn.setPaintStyle(originalPaintStyle);
        else highlightedConn.setPaintStyle({ stroke: '#456', strokeWidth: 2 }); // fallback default
      } catch (err) { }
      highlightedConn = null;
      originalPaintStyle = null;
    }

    // Calcular coordenadas del canvas respetando scroll y zoom, centrando el nodo bajo el cursor
    // 90x40 ~ mitad del tamaño típico del nodo para posicionar por el centro
    const p = getCanvasCoordsFromEvent(e, 90, 40);
    const x = p.x;
    const y = p.y;

    console.log('[canvas_drag] Drop event. Type:', type, 'Canvas coords:', x, y);

    let newNode = null;
    const sideEffects = { before: {}, after: {} };

    // Try to use the highlighted connection from dragover first
    let conn = connection; // Use the one we found or highlighted

    if (conn) {
      console.log('[canvas_drag] Connection detected for drop:', conn);
      // Logic to split connection
      // 1. Get source and target IDs
      const sourceId = conn.sourceId.replace('node_', '');
      const targetId = conn.targetId.replace('node_', '');
      console.log('[canvas_drag] Splitting connection between:', sourceId, 'and', targetId);

      // Create new node first so we have its ID
      newNode = createNode(type, x, y);
      console.log('[canvas_drag] New node created:', newNode.id);

      // 2. Update source node to point to new node
      const sourceNode = stateRef.nodes[sourceId];
      if (sourceNode) {
        // CAPTURE BEFORE STATE
        try {
          sideEffects.before[sourceId] = JSON.parse(JSON.stringify(sourceNode));
          console.log(`[canvas_drag] Captured before state for ${sourceId}:`, sideEffects.before[sourceId]);
        } catch (e) { console.warn('Error capturing before state', e); }

        // Helper to replace reference
        let replaced = false;
        const replaceRef = (obj) => {
          if (obj && obj.node_id === targetId) {
            obj.node_id = newNode.id;
            replaced = true;
          }
        };

        // Check next
        if (sourceNode.next) replaceRef(sourceNode.next);

        // Check true_target/false_target (condition)
        if (sourceNode.true_target) replaceRef(sourceNode.true_target);
        if (sourceNode.false_target) replaceRef(sourceNode.false_target);

        // Check options (choice)
        if (Array.isArray(sourceNode.options)) {
          sourceNode.options.forEach(opt => replaceRef(opt));
        }
        // Check cases (switch)
        if (sourceNode.cases && typeof sourceNode.cases === 'object') {
          Object.values(sourceNode.cases).forEach(c => replaceRef(c));
        }
        // Check loop
        if (sourceNode.type === 'loop' && sourceNode.done_target) replaceRef(sourceNode.done_target);

        // Check default_target (interaction)
        if (sourceNode.default_target) replaceRef(sourceNode.default_target);

        if (replaced) {
          // 3. Delete old connection (Do this BEFORE rendering nodes/updating DOM to avoid stale element references)
          try {
            if (conn) jsPlumb.deleteConnection(conn);
          } catch (err) { console.warn('Error deleting old connection', err); }

          // 4. Update new node to point to old target
          if (newNode.type !== 'end') {
            if (!newNode.next && !newNode.options && !newNode.true_target) {
              newNode.next = { flow_id: stateRef.meta.flow_id, node_id: targetId };
              console.log('[canvas_drag] New node next set to:', targetId);
            } else {
              console.log('[canvas_drag] New node is complex, not auto-connecting output.');
            }
          }

          renderNode(newNode);

          if (sourceNode) {
            renderNode(sourceNode);
          }
        } else {
          // Fallback if replacement failed logic
          // But node is already created?
          console.log('[canvas_drag] Source node found but no reference to target replaced.');
        }

      }
    } else {
      console.log('[canvas_drag] No connection found, creating standalone node.');
      // Normal create (coords ya calculadas con scroll/zoom/snap)
      newNode = createNode(type, x, y);
    }

    // Finalize
    if (newNode) {
      selectNode(newNode.id);
      refreshOutput();

      // Record History (Add)
      if (window.AppHistoryManager) {
        window.AppHistoryManager.recordCommand(
          window.AppHistoryManager.createAddNodeCommand(newNode.id, newNode, sideEffects)
        );
      }

      if (window.App && typeof window.App.ensureNodeVisible === 'function') window.App.ensureNodeVisible(newNode, 120);
    }

    canvas.style.cursor = '';
    if (autoGrow) autoGrow();
  }

  function init(opts) {
    canvas = opts.canvas || document.getElementById('canvas');
    canvasInner = opts.canvasInner || document.getElementById('canvasInner');
    renderNode = opts.renderNode; selectNode = opts.selectNode; createNode = opts.createNode; zoomRef = opts.getZoom; stateRef = opts.state; refreshOutput = opts.refreshOutput;
    autoGrow = (opts.autoGrowCanvas || (window.App && typeof window.App.autoGrowCanvas === 'function' && window.App.autoGrowCanvas)) || null;

    const addDnDListeners = (targetEl) => {
      if (!targetEl) return;
      // DRAG OVER: Visual feedback
      targetEl.addEventListener('dragover', (e) => {
        e.preventDefault();

        // Throttle visual check slightly if needed, but usually OK
        const conn = findConnectionAtPoint(e.clientX, e.clientY);

        if (conn) {
          if (highlightedConn !== conn) {
            // Unhighlight previous
            if (highlightedConn) {
              try { highlightedConn.setPaintStyle(originalPaintStyle || { stroke: '#456', strokeWidth: 2 }); } catch (err) { }
            }

            // Highlight new
            highlightedConn = conn;
            try {
              originalPaintStyle = conn.getPaintStyle();
              conn.setPaintStyle({ stroke: '#22c55e', strokeWidth: 4, outlineStroke: 'transparent', outlineWidth: 5 }); // Green-500
              canvas.style.cursor = 'copy';
            } catch (err) {
              console.warn('Error highlighting connection', err);
            }
          }
        } else {
          // No connection under mouse
          if (highlightedConn) {
            try { highlightedConn.setPaintStyle(originalPaintStyle || { stroke: '#456', strokeWidth: 2 }); } catch (err) { }
            highlightedConn = null;
            originalPaintStyle = null;
            canvas.style.cursor = '';
          }
        }
      });

      // DRAG LEAVE: Cleanup
      targetEl.addEventListener('dragleave', (e) => {
        // Only if leaving the canvas container
        if (e.target === targetEl) {
          if (highlightedConn) {
            try { highlightedConn.setPaintStyle(originalPaintStyle || { stroke: '#456', strokeWidth: 2 }); } catch (err) { }
            highlightedConn = null;
            originalPaintStyle = null;
          }
        }
      });

      targetEl.addEventListener('drop', (e) => {
        e.preventDefault();
        console.log('[canvas_drag] Drop event triggered.');

        // Restore cursor
        canvas.style.cursor = '';

        const dt = e.dataTransfer.getData('text/plain');
        if (dt && stateRef.nodes[dt]) {
          console.log('[canvas_drag] Handling existing node drop:', dt);
          return handleMoveExistingNodeDrop(dt, e);
        }

        const t = e.dataTransfer.getData('node-type');
        if (t) {
          console.log('[canvas_drag] Handling new node drop (from node-type):', t);
          return handleCreateNodeDrop(t, e);
        }

        const type = e.dataTransfer.getData('type') || e.dataTransfer.getData('node-type') || e.dataTransfer.getData('text/plain');
        if (type && typeof type === 'string' && !stateRef.nodes[type] && ALLOWED_TYPES.includes(type)) {
          console.log('[canvas_drag] Handling new node drop (from generic type/text/plain):', type);
          return handleCreateNodeDrop(type, e);
        }
        console.log('[canvas_drag] Drop event did not result in node creation or move.');
      });

    };

    // Adjuntamos SOLO en canvas para evitar doble firing del evento drop (canvas + canvasInner)
    // que causaba creación duplicada de nodos (especialmente Start) al arrastrar.
    addDnDListeners(canvas);

    // palette draggables and click
    document.querySelectorAll('#palette .draggable').forEach(el => {
      el.addEventListener('dragstart', (ev) => {
        ev.dataTransfer.setData('node-type', el.getAttribute('data-type'));
        ev.dataTransfer.setData('text/plain', el.getAttribute('data-type'));
      });
      el.addEventListener('click', (ev) => {
        const type = el.getAttribute('data-type'); if (!type) return;
        const rect = canvas.getBoundingClientRect(); const scrollLeft = canvas.scrollLeft || 0; const scrollTop = canvas.scrollTop || 0;
        const z = (typeof zoomRef === 'function' ? (zoomRef() || 1) : 1);
        // Centro del viewport en coordenadas de contenido (pre-zoom) con snap
        const centerX = (rect.width / 2 + scrollLeft) / z; const centerY = (rect.height / 2 + scrollTop) / z;
        const x = isSnap() ? snap(centerX) : centerX; const y = isSnap() ? snap(centerY) : centerY;
        const node = createNode(type, x, y);
        if (autoGrow) autoGrow();
        const propsPanel = document.getElementById('properties'); if (propsPanel?.classList.contains('collapsed')) propsPanel.classList.remove('collapsed');
        selectNode(node.id);
        if (window.App && typeof window.App.ensureNodeVisible === 'function') window.App.ensureNodeVisible(node, 120);
      });
    });

    canvas.addEventListener('click', (e) => {
      // Check if this click was part of a Lasso selection
      if (window.AppCanvasSelection && window.AppCanvasSelection.wasLasso) {
        window.AppCanvasSelection.wasLasso = false;
        return;
      }

      // Use SelectionManager if available
      if (window.AppSelectionManager) {
        window.AppSelectionManager.clear();
      } else {
        // Fallback
        stateRef.selectedId = null;
        if (typeof opts.showProperties === 'function') opts.showProperties(null);
        document.querySelectorAll('.node').forEach(nd => nd.style.outline = '');
        const propsPanel = document.getElementById('properties'); if (propsPanel) propsPanel.classList.remove('force-visible');
      }
    });
  }

  window.AppCanvasDrag = { init };
})();
