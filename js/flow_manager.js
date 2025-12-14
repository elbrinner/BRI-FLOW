// flow_manager.js
// Manages high-level flow operations: delete, duplicate, etc.
(function () {
    let stateRef = null;
    let dependencies = {};

    function init(state, deps) {
        stateRef = state;
        dependencies = deps;
    }

    function deleteNode(id) {
        if (!stateRef || !stateRef.nodes[id]) return;

        // Record command for undo
        const nodeToDelete = JSON.parse(JSON.stringify(stateRef.nodes[id]));
        if (window.AppHistoryManager) {
            const command = window.AppHistoryManager.createDeleteNodeCommand(id, nodeToDelete);
            window.AppHistoryManager.recordCommand(command);
        }

        // Remove from state
        delete stateRef.nodes[id];

        // Remove from DOM and jsPlumb
        const el = document.getElementById('node_' + id);
        if (el) el.remove();

        try {
            if (typeof jsPlumb !== 'undefined') {
                jsPlumb.remove('node_' + id);
            }
        } catch (e) { console.warn('[FlowManager] jsPlumb remove failed', e); }

        // Clear selection if needed
        if (stateRef.selectedId === id) {
            dependencies.selectNode?.(null);
        }

        dependencies.refreshOutput?.();
    }

    function duplicateNode(id) {
        if (!stateRef || !stateRef.nodes[id]) return;
        const src = stateRef.nodes[id];

        // Create new node using factory (handles ID generation, basic render, etc.)
        // We assume createNode is available in dependencies or global factory
        let newNode = null;
        if (dependencies.createNode) {
            newNode = dependencies.createNode(src.type, (src.x || 0) + 20, (src.y || 0) + 20);
        } else if (window.AppNodeFactory) {
            newNode = window.AppNodeFactory.createNode(src.type, (src.x || 0) + 20, (src.y || 0) + 20);
        }

        if (!newNode) {
            console.warn('[FlowManager] duplicateNode: could not create new node');
            return;
        }

        // Copy properties
        Object.keys(src).forEach(k => {
            if (k !== 'id' && k !== 'x' && k !== 'y') {
                try {
                    newNode[k] = JSON.parse(JSON.stringify(src[k]));
                } catch (e) { }
            }
        });

        // Record command for undo
        if (window.AppHistoryManager) {
            const command = window.AppHistoryManager.createAddNodeCommand(newNode.id, newNode);
            window.AppHistoryManager.recordCommand(command);
        }

        // Re-render to show updated props
        dependencies.renderNode?.(newNode);
        dependencies.selectNode?.(newNode.id);
        dependencies.refreshOutput?.();
    }

    window.AppFlowManager = { init, deleteNode, duplicateNode };
})();
