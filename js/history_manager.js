// js/history_manager.js
// Manages undo/redo history using Command pattern

(function () {
    'use strict';

    const HistoryManager = {
        undoStack: [],
        redoStack: [],
        maxHistorySize: 50,
        isExecuting: false, // Prevent recording during undo/redo
        state: null,
        callbacks: null
    };

    /**
     * Initialize the history manager
     * @param {Object} state - Reference to App.state
     * @param {Object} callbacks - { refreshOutput, renderNode, selectNode }
     */
    HistoryManager.init = function (state, callbacks) {
        HistoryManager.state = state;
        HistoryManager.callbacks = callbacks;
        console.log('[HistoryManager] Initialized');
    };

    /**
     * Record a command for undo/redo
     * @param {Object} command - { execute, undo, description }
     */
    HistoryManager.recordCommand = function (command) {
        if (HistoryManager.isExecuting) return; // Don't record during undo/redo

        HistoryManager.undoStack.push(command);
        HistoryManager.redoStack = []; // Clear redo stack on new action

        // Limit stack size
        if (HistoryManager.undoStack.length > HistoryManager.maxHistorySize) {
            HistoryManager.undoStack.shift();
        }

        console.log(`[HistoryManager] Recorded: ${command.description}`);
    };

    /**
     * Undo the last command
     */
    HistoryManager.undo = function () {
        if (HistoryManager.undoStack.length === 0) {
            console.log('[HistoryManager] Nothing to undo');
            if (typeof showToast === 'function') showToast('Nothing to undo');
            return;
        }

        const command = HistoryManager.undoStack.pop();
        HistoryManager.isExecuting = true;

        try {
            command.undo();
            HistoryManager.redoStack.push(command);
            console.log(`[HistoryManager] Undid: ${command.description}`);
            if (typeof showToast === 'function') showToast(`Undid: ${command.description}`);

            // Refresh UI
            if (HistoryManager.callbacks?.refreshOutput) {
                HistoryManager.callbacks.refreshOutput();
            }
        } catch (e) {
            console.error('[HistoryManager] Undo failed:', e);
            if (typeof showToast === 'function') showToast('Undo failed');
        } finally {
            HistoryManager.isExecuting = false;
        }
    };

    /**
     * Redo the last undone command
     */
    HistoryManager.redo = function () {
        if (HistoryManager.redoStack.length === 0) {
            console.log('[HistoryManager] Nothing to redo');
            if (typeof showToast === 'function') showToast('Nothing to redo');
            return;
        }

        const command = HistoryManager.redoStack.pop();
        HistoryManager.isExecuting = true;

        try {
            command.execute();
            HistoryManager.undoStack.push(command);
            console.log(`[HistoryManager] Redid: ${command.description}`);
            if (typeof showToast === 'function') showToast(`Redid: ${command.description}`);

            // Refresh UI
            if (HistoryManager.callbacks?.refreshOutput) {
                HistoryManager.callbacks.refreshOutput();
            }
        } catch (e) {
            console.error('[HistoryManager] Redo failed:', e);
            if (typeof showToast === 'function') showToast('Redo failed');
        } finally {
            HistoryManager.isExecuting = false;
        }
    };

    /**
     * Clear all history
     */
    HistoryManager.clear = function () {
        HistoryManager.undoStack = [];
        HistoryManager.redoStack = [];
        console.log('[HistoryManager] History cleared');
    };

    /**
     * Get current history state (for debugging)
     */
    HistoryManager.getState = function () {
        return {
            undoCount: HistoryManager.undoStack.length,
            redoCount: HistoryManager.redoStack.length,
            canUndo: HistoryManager.undoStack.length > 0,
            canRedo: HistoryManager.redoStack.length > 0
        };
    };

    // Command Factory Functions
    // These create command objects for common operations

    /**
     * Create a command for adding a node
     */
    /**
     * Create a command for adding a node
     */
    HistoryManager.createAddNodeCommand = function (nodeId, node, sideEffects) {
        return {
            description: `Add node ${nodeId}`,
            execute: function () {
                HistoryManager.state.nodes[nodeId] = node;
                if (HistoryManager.callbacks?.renderNode) {
                    HistoryManager.callbacks.renderNode(node);
                }

                // Restore side effects (e.g. source node update in auto-split)
                if (sideEffects && sideEffects.after) {
                    for (const id in sideEffects.after) {
                        HistoryManager.state.nodes[id] = JSON.parse(JSON.stringify(sideEffects.after[id]));
                        if (HistoryManager.callbacks?.renderNode) {
                            HistoryManager.callbacks.renderNode(HistoryManager.state.nodes[id]);
                        }
                    }
                }
            },
            undo: function () {
                // Proper cleanup with jsPlumb to remove 4 dots (endpoints)
                if (typeof jsPlumb !== 'undefined') {
                    try { jsPlumb.remove('node_' + nodeId); } catch (e) {
                        // Fallback if jsPlumb fails or not ready
                        const nodeEl = document.getElementById('node_' + nodeId);
                        if (nodeEl) nodeEl.remove();
                    }
                } else {
                    const nodeEl = document.getElementById('node_' + nodeId);
                    if (nodeEl) nodeEl.remove();
                }

                delete HistoryManager.state.nodes[nodeId];

                // Restore side effects (restore original source node connection)
                if (sideEffects && sideEffects.before) {
                    console.log('[HistoryManager] Restoring side effects (before):', Object.keys(sideEffects.before));
                    for (const id in sideEffects.before) {
                        HistoryManager.state.nodes[id] = JSON.parse(JSON.stringify(sideEffects.before[id]));
                        if (HistoryManager.callbacks?.renderNode) {
                            HistoryManager.callbacks.renderNode(HistoryManager.state.nodes[id]);
                        }
                    }
                } else {
                    console.log('[HistoryManager] No side effects to restore.');
                }

                // Deselect if this was selected
                if (HistoryManager.state.selectedId === nodeId) {
                    HistoryManager.state.selectedId = null;
                }
            }
        };
    };

    /**
     * Create a command for deleting a node
     */
    HistoryManager.createDeleteNodeCommand = function (nodeId, node) {
        return {
            description: `Delete node ${nodeId}`,
            execute: function () {
                const nodeEl = document.getElementById('node_' + nodeId);
                if (nodeEl) nodeEl.remove();
                delete HistoryManager.state.nodes[nodeId];

                if (HistoryManager.state.selectedId === nodeId) {
                    HistoryManager.state.selectedId = null;
                }
            },
            undo: function () {
                HistoryManager.state.nodes[nodeId] = node;
                if (HistoryManager.callbacks?.renderNode) {
                    HistoryManager.callbacks.renderNode(node);
                }
            }
        };
    };

    /**
     * Create a command for modifying a node
     */
    HistoryManager.createModifyNodeCommand = function (nodeId, oldNode, newNode) {
        return {
            description: `Modify node ${nodeId}`,
            execute: function () {
                HistoryManager.state.nodes[nodeId] = JSON.parse(JSON.stringify(newNode));
                const nodeEl = document.getElementById('node_' + nodeId);
                if (nodeEl) nodeEl.remove();
                if (HistoryManager.callbacks?.renderNode) {
                    HistoryManager.callbacks.renderNode(HistoryManager.state.nodes[nodeId]);
                }
            },
            undo: function () {
                HistoryManager.state.nodes[nodeId] = JSON.parse(JSON.stringify(oldNode));
                const nodeEl = document.getElementById('node_' + nodeId);
                if (nodeEl) nodeEl.remove();
                if (HistoryManager.callbacks?.renderNode) {
                    HistoryManager.callbacks.renderNode(HistoryManager.state.nodes[nodeId]);
                }
            }
        };
    };

    /**
     * Create a command for moving a node
     */
    /**
     * Create a command for moving a node
     */
    HistoryManager.createMoveNodeCommand = function (nodeId, oldPos, newPos, sideEffects) {
        return {
            description: `Move node ${nodeId}`,
            execute: function () {
                const node = HistoryManager.state.nodes[nodeId];
                if (node) {
                    node.x = newPos.x;
                    node.y = newPos.y;
                    const nodeEl = document.getElementById('node_' + nodeId);
                    if (nodeEl) {
                        nodeEl.style.left = newPos.x + 'px';
                        nodeEl.style.top = newPos.y + 'px';
                    }
                }
                // Restore side effects (after move - e.g. source node updated)
                if (sideEffects && sideEffects.after) {
                    for (const id in sideEffects.after) {
                        HistoryManager.state.nodes[id] = JSON.parse(JSON.stringify(sideEffects.after[id]));
                        if (HistoryManager.callbacks?.renderNode) {
                            HistoryManager.callbacks.renderNode(HistoryManager.state.nodes[id]);
                        }
                    }
                }
            },
            undo: function () {
                const node = HistoryManager.state.nodes[nodeId];
                if (node) {
                    node.x = oldPos.x;
                    node.y = oldPos.y;
                    const nodeEl = document.getElementById('node_' + nodeId);
                    if (nodeEl) {
                        nodeEl.style.left = oldPos.x + 'px';
                        nodeEl.style.top = oldPos.y + 'px';
                    }
                }
                // Restore side effects (before move - e.g. source node original state)
                if (sideEffects && sideEffects.before) {
                    for (const id in sideEffects.before) {
                        HistoryManager.state.nodes[id] = JSON.parse(JSON.stringify(sideEffects.before[id]));
                        if (HistoryManager.callbacks?.renderNode) {
                            HistoryManager.callbacks.renderNode(HistoryManager.state.nodes[id]);
                        }
                    }
                }
            }
        };
    };

    /**
     * Create a command for renaming/modifying a node (handle ID change)
     */
    HistoryManager.createRenameNodeCommand = function (oldId, newId, oldNodeData, newNodeData, dependentsBefore, dependentsAfter) {
        return {
            description: `Rename node ${oldId} to ${newId}`,
            execute: function () {
                // Delete old
                const oldEl = document.getElementById('node_' + oldId);
                if (oldEl) oldEl.remove();
                delete HistoryManager.state.nodes[oldId];

                // Create new
                HistoryManager.state.nodes[newId] = JSON.parse(JSON.stringify(newNodeData));
                if (HistoryManager.callbacks?.renderNode) {
                    HistoryManager.callbacks.renderNode(HistoryManager.state.nodes[newId]);
                }

                // Restore dependent nodes (after update)
                if (dependentsAfter) {
                    for (const id in dependentsAfter) {
                        HistoryManager.state.nodes[id] = JSON.parse(JSON.stringify(dependentsAfter[id]));
                        // We do NOT need to re-render dependents if only their internal references changed,
                        // because RefreshConnections will redraw lines based on data.
                        // However, if we wanted to be safe, we could re-render them.
                        // For now, assume refreshOutput/RefreshConnections handles visual lines.
                    }
                }

                // Update selection
                if (HistoryManager.state.selectedId === oldId) {
                    HistoryManager.state.selectedId = newId;
                }
            },
            undo: function () {
                // Delete new
                const newEl = document.getElementById('node_' + newId);
                if (newEl) newEl.remove();
                delete HistoryManager.state.nodes[newId];

                // Restore old
                HistoryManager.state.nodes[oldId] = JSON.parse(JSON.stringify(oldNodeData));
                if (HistoryManager.callbacks?.renderNode) {
                    HistoryManager.callbacks.renderNode(HistoryManager.state.nodes[oldId]);
                }

                // Restore dependent nodes (before update - pointing to oldId)
                if (dependentsBefore) {
                    for (const id in dependentsBefore) {
                        HistoryManager.state.nodes[id] = JSON.parse(JSON.stringify(dependentsBefore[id]));
                    }
                }

                // Restore selection
                if (HistoryManager.state.selectedId === newId) {
                    HistoryManager.state.selectedId = oldId;
                }
            }
        };
    };

    // Expose to window
    window.AppHistoryManager = HistoryManager;
})();
