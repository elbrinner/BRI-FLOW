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

            if (!state.selectedId) return;
            const node = state.nodes[state.selectedId];
            if (!node) return;

            // --- MOVIMIENTO CON FLECHAS ---
            if (e.key.startsWith('Arrow')) {
                e.preventDefault();

                // Shift = movimiento fino (1px), Normal = Grid size o 10px
                const grid = getGrid();
                const step = e.shiftKey ? 1 : (isSnap() ? grid : 10);

                let newX = node.x;
                let newY = node.y;

                if (e.key === 'ArrowUp') newY -= step;
                if (e.key === 'ArrowDown') newY += step;
                if (e.key === 'ArrowLeft') newX -= step;
                if (e.key === 'ArrowRight') newX += step;

                // Aplicar snap si no es movimiento fino
                if (!e.shiftKey && isSnap()) {
                    newX = Math.round(newX / grid) * grid;
                    newY = Math.round(newY / grid) * grid;
                }

                node.x = newX;
                node.y = newY;

                renderNode(node);
                refreshOutput(); // Actualiza conexiones

                // Asegurar que el nodo siga visible (opcional, puede ser molesto si scrollea mucho)
                // if (window.App && window.App.ensureNodeVisible) window.App.ensureNodeVisible(node);
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

            // --- DESHACER (Ctrl+Z) - Placeholder ---
            // if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
            //   console.log('Undo not implemented yet');
            // }
        });
    }

    window.AppKeyboardControls = { init };
})();
