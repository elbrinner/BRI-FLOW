(function () {
    let canvas, stateRef;
    let isSelecting = false;
    let selectionBox = null;
    let startX = 0;
    let startY = 0;

    function init(opts) {
        canvas = opts.canvas || document.getElementById('canvas');
        stateRef = opts.state;

        // Create selection box element
        selectionBox = document.createElement('div');
        selectionBox.classList.add('selection-box');
        selectionBox.style.position = 'absolute';
        selectionBox.style.border = '1px dashed #3b82f6';
        selectionBox.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
        selectionBox.style.pointerEvents = 'none'; // Critical to not block mouseup
        selectionBox.style.display = 'none';
        selectionBox.style.zIndex = '9999';
        canvas.appendChild(selectionBox);

        canvas.addEventListener('mousedown', onMouseDown);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    function onMouseDown(e) {
        // Only start lasso if clicking on background (canvas directly)
        // And not Right Click (button 2) -> actually button 0 (Left) for standard lasso
        if (e.button !== 0) return;

        // Check if we clicked on a node or connection -> handled by other handlers
        if (e.target.closest('.node') || e.target.closest('.jtk-connector')) return;

        // Also check if we are panning (Middle click or Space+Drag usually)
        // Ignoring pan logic for now, assuming Left Click on empty space = Selection

        isSelecting = true;

        // Get start coordinates relative to viewport (clientX/Y)
        // Or relative to canvas?
        // selectionBox is absolute in document?
        // Let's use page coordinates for simplicity if selectionBox is appended to body or canvas with relative.

        // Actually selectionBox is appended to canvas parent?
        // We appended it to `document.body` in previous thought?
        // Let's check init.

        const rect = canvas.getBoundingClientRect();
        const scrollLeft = canvas.scrollLeft;
        const scrollTop = canvas.scrollTop;
        // const zoom = (window.App && window.App.getZoom) ? window.App.getZoom() : 1; // This line was removed in the edit

        // Calculate start relative to canvas *content* (taking scroll into account) behaves differently
        // For drawing the DOM element 'selectionBox', we usually put it relative to the container.

        // Let's position selectionBox fixed to the viewport area of the canvas for simplicity 
        // OR relative to the scrolling content.
        // If selectionBox is child of canvas (which has overflow:auto), it moves with scroll.
        // But e.clientX is viewport relative.

        // Start pos relative to canvas container (top-left)
        startX = e.clientX - rect.left + scrollLeft;
        startY = e.clientY - rect.top + scrollTop;

        selectionBox.style.left = startX + 'px';
        selectionBox.style.top = startY + 'px';
        selectionBox.style.width = '0px';
        selectionBox.style.height = '0px';
        selectionBox.style.display = 'block';

        console.log('[Lasso] Started selection at', startX, startY);
        // Clear selection unless Shift is held
        if (!e.shiftKey && window.AppSelectionManager) {
            window.AppSelectionManager.clear();
        }
    }

    function onMouseMove(e) {
        if (!isSelecting) return;

        const rect = canvas.getBoundingClientRect();
        const scrollLeft = canvas.scrollLeft;
        const scrollTop = canvas.scrollTop;

        const currentX = e.clientX - rect.left + scrollLeft;
        const currentY = e.clientY - rect.top + scrollTop;

        const width = Math.abs(currentX - startX);
        const height = Math.abs(currentY - startY);
        const left = Math.min(currentX, startX);
        const top = Math.min(currentY, startY);

        selectionBox.style.width = width + 'px';
        selectionBox.style.height = height + 'px';
        selectionBox.style.left = left + 'px';
        selectionBox.style.top = top + 'px';
    }

    function onMouseUp(e) {
        if (!isSelecting) return;
        isSelecting = false;

        // Calculate selection
        // Must measure rect BEFORE hiding the element, otherwise it returns 0x0
        const boxRect = selectionBox.getBoundingClientRect();
        selectionBox.style.display = 'none';

        // If box is too small, ignore (simple click)
        if (boxRect.width < 5 && boxRect.height < 5) return;

        const nodes = document.querySelectorAll('.node');
        const idsToSelect = [];

        nodes.forEach(node => {
            const nodeRect = node.getBoundingClientRect();
            // console.log('[Lasso] NodeRect:', node.id, nodeRect);
            if (rectsIntersect(boxRect, nodeRect)) {
                // Get ID
                const id = node.dataset.id || node.id.replace('node_', '');
                idsToSelect.push(id);
            }
        });

        if (window.AppSelectionManager && idsToSelect.length > 0) {
            idsToSelect.forEach(id => {
                window.AppSelectionManager.select(id, true); // true = add
            });
            // Signal to canvas_drag that a selection just happened
            if (window.AppCanvasSelection) window.AppCanvasSelection.wasLasso = true;
            setTimeout(() => { if (window.AppCanvasSelection) window.AppCanvasSelection.wasLasso = false; }, 100);
        }
    }

    function rectsIntersect(r1, r2) {
        console.log('[Lasso] Checking intersection:', r1, r2);
        return !(r2.left > r1.right ||
            r2.right < r1.left ||
            r2.top > r1.bottom ||
            r2.bottom < r1.top);
    }

    window.AppCanvasSelection = { init };
})();
