// canvas_manager.js
// Manages canvas layout, resizing, and node visibility
(function () {
    let canvas = null;
    let canvasInner = null;
    let baseCanvasWidth = 0;
    let baseCanvasHeight = 0;
    let getZoom = () => 1;
    let setZoom = (z) => { };
    let saveUiState = () => { };

    function init(refs) {
        canvas = refs.canvas;
        canvasInner = refs.canvasInner;
        if (refs.getZoom) getZoom = refs.getZoom;
        if (refs.setZoom) setZoom = refs.setZoom;
        if (refs.saveUiState) saveUiState = refs.saveUiState;

        // Record base size
        try {
            if (canvasInner) {
                baseCanvasWidth = canvasInner.scrollWidth;
                baseCanvasHeight = canvasInner.scrollHeight;
            }
        } catch (e) { console.warn('[CanvasManager] record base size failed', e); }

        // Setup resize observer
        setupResizeObserver();
    }

    function setupResizeObserver() {
        try {
            if (canvasInner && typeof ResizeObserver !== 'undefined') {
                let roTimer = null;
                const ro = new ResizeObserver(() => {
                    try { if (roTimer) clearTimeout(roTimer); } catch (_e) { }
                    roTimer = setTimeout(() => {
                        try { if (window.AppConnections?.refreshConnections && window.App && window.App.state) window.AppConnections.refreshConnections(window.App.state); } catch (_e2) { }
                    }, 60);
                });
                ro.observe(canvasInner);
            } else {
                window.addEventListener('resize', () => {
                    try { if (window.AppConnections?.refreshConnections && window.App && window.App.state) window.AppConnections.refreshConnections(window.App.state); } catch (_e) { }
                });
            }
        } catch (err) { console.warn('[CanvasManager] ResizeObserver setup failed', err); }
    }

    function autoGrowCanvas(padding = 1000) {
        try {
            if (!canvasInner) return;
            const nodes = canvasInner.querySelectorAll('.node');
            if (!nodes.length) return;
            let maxRight = 0, maxBottom = 0;
            nodes.forEach(el => {
                const left = parseFloat(el.style.left) || 0;
                const top = parseFloat(el.style.top) || 0;
                const width = el.offsetWidth || 180;
                const height = el.offsetHeight || 80;
                maxRight = Math.max(maxRight, (left + width));
                maxBottom = Math.max(maxBottom, (top + height));
            });
            const minW = baseCanvasWidth || canvasInner.scrollWidth || 8000;
            const minH = baseCanvasHeight || canvasInner.scrollHeight || 6000;
            const targetW = Math.max(minW, Math.ceil(maxRight + padding));
            const targetH = Math.max(minH, Math.ceil(maxBottom + padding));
            let changed = false;
            if (Math.abs(targetW - canvasInner.scrollWidth) > 2) { canvasInner.style.width = targetW + 'px'; changed = true; }
            if (Math.abs(targetH - canvasInner.scrollHeight) > 2) { canvasInner.style.height = targetH + 'px'; changed = true; }
            if (changed) { try { if (typeof jsPlumb !== 'undefined') jsPlumb.repaintEverything(); } catch (e) { } }
        } catch (e) { console.warn('[CanvasManager] autoGrowCanvas failed', e); }
    }

    function fitCanvasToContent(state, margin = 80, adjustZoom = true) {
        if (!canvas || !canvasInner) return;
        try {
            const nodeEls = canvasInner.querySelectorAll('.node');
            const cs = getComputedStyle(canvas);
            const padL = parseFloat(cs.paddingLeft) || 0;
            const padR = parseFloat(cs.paddingRight) || 0;
            const padT = parseFloat(cs.paddingTop) || 0;
            const padB = parseFloat(cs.paddingBottom) || 0;
            const zoom = getZoom();

            if ((!nodeEls || nodeEls.length === 0) && (!state.nodes || Object.keys(state.nodes).length === 0)) {
                const effW = (canvas.clientWidth - padL - padR) / (zoom || 1);
                const effH = (canvas.clientHeight - padT - padB) / (zoom || 1);
                const targetLeft = Math.max(0, Math.floor(padL + (canvasInner.scrollWidth - effW) * 0.5));
                const targetTop = Math.max(0, Math.floor(padT + (canvasInner.scrollHeight - effH) * 0.5));
                canvas.scrollLeft = targetLeft; canvas.scrollTop = targetTop; return;
            }

            let minLeft = Infinity, minTop = Infinity, maxRight = -Infinity, maxBottom = -Infinity;
            // Prefer model coordinates
            for (const id in state.nodes) {
                const n = state.nodes[id];
                const el = document.getElementById('node_' + id);
                const width = (el && el.offsetWidth) ? el.offsetWidth : 180;
                const height = (el && el.offsetHeight) ? el.offsetHeight : 80;
                const left = typeof n.x === 'number' ? n.x : (el ? (parseFloat(el.style.left) || 0) : 0);
                const top = typeof n.y === 'number' ? n.y : (el ? (parseFloat(el.style.top) || 0) : 0);
                minLeft = Math.min(minLeft, left);
                minTop = Math.min(minTop, top);
                maxRight = Math.max(maxRight, left + width);
                maxBottom = Math.max(maxBottom, top + height);
            }

            if (!isFinite(minLeft)) {
                // Fallback to DOM
                for (const el of nodeEls) {
                    const left = parseFloat(el.style.left) || 0;
                    const top = parseFloat(el.style.top) || 0;
                    const width = el.offsetWidth || 180;
                    const height = el.offsetHeight || 80;
                    minLeft = Math.min(minLeft, left);
                    minTop = Math.min(minTop, top);
                    maxRight = Math.max(maxRight, left + width);
                    maxBottom = Math.max(maxBottom, top + height);
                }
            }

            if (!isFinite(minLeft)) return;

            const bboxWidth = Math.max(1, (maxRight - minLeft));
            const bboxHeight = Math.max(1, (maxBottom - minTop));
            const centerX = (minLeft + maxRight) / 2;
            const centerY = (minTop + maxBottom) / 2;
            let targetZoom = zoom || 1;

            if (adjustZoom) {
                const viewportW = canvas.clientWidth;
                const viewportH = canvas.clientHeight;
                const fitW = (viewportW - padL - padR) / (bboxWidth + 2 * margin);
                const fitH = (viewportH - padT - padB) / (bboxHeight + 2 * margin);
                const z = Math.min(fitW, fitH);
                targetZoom = Math.max(0.2, Math.min(2, z));
                if (Math.abs(targetZoom - (zoom || 1)) > 1e-3) setZoom(targetZoom);
            }

            const currentZoom = targetZoom || zoom || 1;
            const scrollX = Math.max(0, Math.floor(centerX * currentZoom - (canvas.clientWidth / 2) + padL));
            const scrollY = Math.max(0, Math.floor(centerY * currentZoom - (canvas.clientHeight / 2) + padT));

            canvas.scrollLeft = scrollX;
            canvas.scrollTop = scrollY;
            saveUiState();
        } catch (e) { console.warn('[CanvasManager] fitCanvasToContent failed', e); }
    }

    function ensureNodeVisible(node, margin = 80) {
        if (!canvas || !canvasInner || !node) return;
        try {
            const el = document.getElementById('node_' + node.id);
            if (!el) return;
            const left = parseFloat(el.style.left) || 0;
            const top = parseFloat(el.style.top) || 0;
            const width = el.offsetWidth || 180;
            const height = el.offsetHeight || 80;

            let targetLeft = canvas.scrollLeft;
            let targetTop = canvas.scrollTop;
            const z = getZoom() || 1;
            const marginContent = margin / z;
            const cs = getComputedStyle(canvas);
            const padL = parseFloat(cs.paddingLeft) || 0;
            const padR = parseFloat(cs.paddingRight) || 0;
            const padT = parseFloat(cs.paddingTop) || 0;
            const padB = parseFloat(cs.paddingBottom) || 0;
            const viewportWInContent = (canvas.clientWidth - padL - padR) / z;
            const viewportHInContent = (canvas.clientHeight - padT - padB) / z;

            if (left < (canvas.scrollLeft - padL) + marginContent) {
                targetLeft = Math.max(0, Math.floor(padL + left - marginContent));
            } else if (left + width > (canvas.scrollLeft - padL) + viewportWInContent - marginContent) {
                targetLeft = Math.max(0, Math.floor(padL + (left + width) - viewportWInContent + marginContent));
            }

            if (top < (canvas.scrollTop - padT) + marginContent) {
                targetTop = Math.max(0, Math.floor(padT + top - marginContent));
            } else if (top + height > (canvas.scrollTop - padT) + viewportHInContent - marginContent) {
                targetTop = Math.max(0, Math.floor(padT + (top + height) - viewportHInContent + marginContent));
            }

            if (targetLeft !== canvas.scrollLeft) canvas.scrollLeft = targetLeft;
            if (targetTop !== canvas.scrollTop) canvas.scrollTop = targetTop;
            saveUiState();
        } catch (e) { console.warn('[CanvasManager] ensureNodeVisible failed', e); }
    }

    window.AppCanvasManager = { init, autoGrowCanvas, fitCanvasToContent, ensureNodeVisible };
})();
