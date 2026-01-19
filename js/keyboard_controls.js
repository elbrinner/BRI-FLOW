// js/keyboard_controls.js
// Manejo centralizado de atajos de teclado para el editor (estilo Draw.io)
(function () {
    function init(opts) {
        const { state, renderNode, refreshOutput, deleteNode, duplicateNode, selectNode } = opts;

        // Helper para obtener grid size
        function getGrid() {
            return (window.App && typeof window.App.getGridSize === 'function') ? window.App.getGridSize() : 20;
        }

        // Helper para saber si snap está activo
        function isSnap() {
            return (window.App && typeof window.App.getSnapEnabled === 'function') ? window.App.getSnapEnabled() : true;
        }

        document.addEventListener('keydown', (e) => {
            // Ignorar si el foco está en un input, textarea o editable
            const tag = e.target.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;

            // Si hay modales abiertos, ignorar también (simple heurística)
            if (document.body.classList.contains('modal-open')) return;

            // Get selection info
            let selectedIds = [];
            if (window.AppSelectionManager) {
                selectedIds = window.AppSelectionManager.getSelection();
            } else if (state.selectedId) {
                selectedIds = [state.selectedId];
            }

            if (selectedIds.length === 0) return;

            // --- MOVIMIENTO CON FLECHAS ---
            if (e.key.startsWith('Arrow')) {
                e.preventDefault();

                // Shift = movimiento fino (1px), Normal = Grid size o 10px
                const grid = getGrid();
                const step = e.shiftKey ? 1 : (isSnap() ? grid : 10);

                let dx = 0;
                let dy = 0;

                if (e.key === 'ArrowUp') dy -= step;
                if (e.key === 'ArrowDown') dy += step;
                if (e.key === 'ArrowLeft') dx -= step;
                if (e.key === 'ArrowRight') dx += step;

                // Move all selected nodes
                selectedIds.forEach(id => {
                    const n = state.nodes[id];
                    if (n) {
                        let newX = n.x + dx;
                        let newY = n.y + dy;

                        // Apply snap to each node individually if grid enabled (and not shift)
                        if (!e.shiftKey && isSnap()) {
                            newX = Math.round(newX / grid) * grid;
                            newY = Math.round(newY / grid) * grid;
                        }

                        n.x = newX;
                        n.y = newY;
                        renderNode(n);
                    }
                });

                refreshOutput(); // Actualiza conexiones

                // Ensure primary node visible
                if (state.selectedId && state.nodes[state.selectedId]) {
                    // if (window.App && window.App.ensureNodeVisible) window.App.ensureNodeVisible(state.nodes[state.selectedId]);
                }
            }

            // --- BORRAR (Delete / Backspace) ---
            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                // Confirmación suave o directa? Por seguridad, confirmamos.
                // TODO: UI de confirmación mejor que alert nativo
                if (confirm('¿Eliminar nodo seleccionado?')) {
                    if (typeof deleteNode === 'function') deleteNode(state.selectedId);
                }
            }

            // --- DUPLICAR (Ctrl+D / Cmd+D) ---
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
                e.preventDefault();
                if (typeof duplicateNode === 'function') duplicateNode(state.selectedId);
            }

            // --- DESHACER (Ctrl+Z) ---
            if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (window.AppHistoryManager && typeof window.AppHistoryManager.undo === 'function') {
                    window.AppHistoryManager.undo();
                } else {
                    console.warn('[KeyboardControls] HistoryManager not available');
                }
            }

            // --- REHACER (Ctrl+Shift+Z o Ctrl+Y) ---
            if ((e.ctrlKey || e.metaKey) && (
                (e.shiftKey && e.key.toLowerCase() === 'z') ||
                e.key.toLowerCase() === 'y'
            )) {
                e.preventDefault();
                if (window.AppHistoryManager && typeof window.AppHistoryManager.redo === 'function') {
                    window.AppHistoryManager.redo();
                } else {
                    console.warn('[KeyboardControls] HistoryManager not available');
                }
            }
        });
    }

    window.AppKeyboardControls = { init };
})();
