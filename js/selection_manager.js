(function () {
    const SelectionManager = {
        selectedIds: new Set(),
        stateRef: null,
        callbacks: {
            onSelectionChanged: null, // (selectedIds) => void
            renderNode: null
        },

        init: function (state, callbacks) {
            this.stateRef = state;
            this.callbacks = { ...this.callbacks, ...callbacks };
            this.selectedIds = new Set();
        },

        select: function (id, add = false) {
            if (!add) {
                this.clear();
            }
            if (id) {
                this.selectedIds.add(id);
                // Update legacy single selection for backward compatibility
                if (this.stateRef) {
                    this.stateRef.selectedId = id;
                }
            }
            this._notify();
        },

        deselect: function (id) {
            if (this.selectedIds.has(id)) {
                this.selectedIds.delete(id);
                // If we deselected the "primary" one, pick another one or clear
                if (this.stateRef && this.stateRef.selectedId === id) {
                    this.stateRef.selectedId = this.selectedIds.size > 0
                        ? Array.from(this.selectedIds)[this.selectedIds.size - 1]
                        : null;
                }
                this._notify();
            }
        },

        toggle: function (id) {
            if (this.selectedIds.has(id)) {
                this.deselect(id);
            } else {
                this.select(id, true);
            }
        },

        clear: function () {
            if (this.selectedIds.size > 0) {
                this.selectedIds.clear();
                if (this.stateRef) this.stateRef.selectedId = null;
                this._notify();
            }
        },

        isSelected: function (id) {
            return this.selectedIds.has(id);
        },

        getSelection: function () {
            return Array.from(this.selectedIds);
        },

        _notify: function () {
            console.log('[SelectionManager] _notify called');
            if (this.callbacks.onSelectionChanged) {
                this.callbacks.onSelectionChanged(Array.from(this.selectedIds));
            }
            // Update Visuals
            document.querySelectorAll('.node').forEach(el => {
                const id = el.dataset.id; // Assuming dataset-id exists or id attribute matches
                if (this.selectedIds.has(id || el.id.replace('node_', ''))) { // robust check
                    el.classList.add('selected');
                    // Ensure outline for legacy styles if needed
                    el.style.outline = '2px solid #3b82f6';
                } else {
                    el.classList.remove('selected');
                    el.style.outline = '';
                }
            });

            // Handle Properties Panel visibility based on selection count
            const count = this.selectedIds.size;
            console.log('[SelectionManager] About to handle properties, count =', count);

            if (count === 1) {
                // Single selection: show properties
                const selectedId = Array.from(this.selectedIds)[0];

                if (this.stateRef && this.stateRef.nodes && window.App && window.App.showProperties) {
                    const node = this.stateRef.nodes[selectedId];

                    if (node) {
                        window.App.showProperties(node);
                    } else {
                        console.warn('[SelectionManager] Node not found in state:', selectedId);
                    }
                } else {
                    console.warn('[SelectionManager] Missing dependencies for showProperties');
                }
            } else {
                // Multiple or none: hide properties or show summary (MVP: hide)
                const propsPanel = document.getElementById('properties');
                if (propsPanel) propsPanel.classList.remove('force-visible');
                // Clear properties
                if (window.App && window.App.showProperties) {
                    window.App.showProperties(null);
                }
            }
        }
    };

    // Expose to window
    window.AppSelectionManager = SelectionManager;
})();
