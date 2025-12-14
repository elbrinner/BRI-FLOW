// js/node_search.js
// Node search and filter functionality for BRI FLOW editor

(function () {
    'use strict';

    const NodeSearch = {
        state: null,
        searchInput: null,
        resultsContainer: null,
        currentMatches: [],
        selectedIndex: -1
    };

    /**
     * Initialize the search module
     * @param {Object} state - Reference to App.state
     * @param {Object} callbacks - { selectNode, ensureNodeVisible }
     */
    NodeSearch.init = function (state, callbacks) {
        NodeSearch.state = state;
        NodeSearch.callbacks = callbacks;
        NodeSearch.createSearchUI();
        NodeSearch.bindKeyboardShortcut();
        console.log('[NodeSearch] Initialized');
    };

    /**
     * Create search UI in header
     */
    NodeSearch.createSearchUI = function () {
        const header = document.querySelector('header .controls');
        if (!header) return;

        // Create search container
        const searchContainer = document.createElement('div');
        searchContainer.id = 'nodeSearchContainer';
        searchContainer.className = 'node-search-container';
        searchContainer.style.cssText = 'position: relative; display: inline-flex; align-items: center; gap: 4px; margin-left: 8px;';

        // Search input
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.id = 'nodeSearchInput';
        searchInput.placeholder = 'Search nodes... (Ctrl+F)';
        searchInput.className = 'px-3 py-1 border rounded text-sm';
        searchInput.style.cssText = 'width: 200px; transition: width 0.2s;';

        // Expand on focus
        searchInput.addEventListener('focus', () => {
            searchInput.style.width = '300px';
        });
        searchInput.addEventListener('blur', () => {
            if (!searchInput.value) {
                searchInput.style.width = '200px';
            }
        });

        // Search on input
        searchInput.addEventListener('input', (e) => {
            NodeSearch.performSearch(e.target.value);
        });

        // Navigate with Enter/Shift+Enter
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (e.shiftKey) {
                    NodeSearch.selectPrevious();
                } else {
                    NodeSearch.selectNext();
                }
            } else if (e.key === 'Escape') {
                NodeSearch.clearSearch();
                searchInput.blur();
            }
        });

        // Clear button
        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'px-2 py-1 bg-white border rounded text-sm';
        clearBtn.textContent = '✕';
        clearBtn.title = 'Clear search';
        clearBtn.style.cssText = 'display: none;';
        clearBtn.addEventListener('click', () => {
            NodeSearch.clearSearch();
        });

        // Results counter
        const resultsCounter = document.createElement('span');
        resultsCounter.id = 'searchResultsCounter';
        resultsCounter.className = 'text-xs text-gray-600';
        resultsCounter.style.cssText = 'min-width: 60px; display: none;';

        searchContainer.appendChild(searchInput);
        searchContainer.appendChild(clearBtn);
        searchContainer.appendChild(resultsCounter);

        // Insert before zoom controls
        const zoomControls = header.querySelector('.zoom-controls');
        if (zoomControls) {
            header.insertBefore(searchContainer, zoomControls);
        } else {
            header.appendChild(searchContainer);
        }

        NodeSearch.searchInput = searchInput;
        NodeSearch.clearBtn = clearBtn;
        NodeSearch.resultsCounter = resultsCounter;
    };

    /**
     * Bind Ctrl+F keyboard shortcut
     */
    NodeSearch.bindKeyboardShortcut = function () {
        document.addEventListener('keydown', (e) => {
            // Ctrl+F or Cmd+F
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
                // Don't prevent default if in input/textarea
                const tag = e.target.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA') return;

                e.preventDefault();
                if (NodeSearch.searchInput) {
                    NodeSearch.searchInput.focus();
                    NodeSearch.searchInput.select();
                }
            }
        });
    };

    /**
     * Perform search and highlight matches
     * @param {string} query - Search query
     */
    NodeSearch.performSearch = function (query) {
        query = query.trim().toLowerCase();

        // Clear previous highlights
        NodeSearch.clearHighlights();

        if (!query) {
            NodeSearch.currentMatches = [];
            NodeSearch.selectedIndex = -1;
            NodeSearch.updateUI();
            return;
        }

        // Search through nodes
        NodeSearch.currentMatches = [];
        for (const id in NodeSearch.state.nodes) {
            const node = NodeSearch.state.nodes[id];
            if (NodeSearch.matchesQuery(node, query)) {
                NodeSearch.currentMatches.push(id);
                NodeSearch.highlightNode(id);
            }
        }

        // Select first match
        if (NodeSearch.currentMatches.length > 0) {
            NodeSearch.selectedIndex = 0;
            NodeSearch.selectCurrentMatch();
        }

        NodeSearch.updateUI();
    };

    /**
     * Check if node matches search query
     * @param {Object} node - Node object
     * @param {string} query - Search query
     * @returns {boolean}
     */
    NodeSearch.matchesQuery = function (node, query) {
        // Search in node ID
        if (node.id && node.id.toLowerCase().includes(query)) return true;

        // Search in node type
        if (node.type && node.type.toLowerCase().includes(query)) return true;

        // Search in node label/name
        if (node.label && node.label.toLowerCase().includes(query)) return true;
        if (node.name && node.name.toLowerCase().includes(query)) return true;

        // Search in prompt (for agent_call, response, etc.)
        if (node.prompt && node.prompt.toLowerCase().includes(query)) return true;

        // Search in save_as
        if (node.save_as && node.save_as.toLowerCase().includes(query)) return true;

        return false;
    };

    /**
     * Highlight a node
     * @param {string} nodeId - Node ID
     */
    NodeSearch.highlightNode = function (nodeId) {
        const nodeEl = document.getElementById('node_' + nodeId);
        if (nodeEl) {
            nodeEl.classList.add('search-match');
            nodeEl.style.outline = '2px solid #fbbf24'; // Yellow outline
            nodeEl.style.outlineOffset = '2px';
        }
    };

    /**
     * Clear all highlights
     */
    NodeSearch.clearHighlights = function () {
        document.querySelectorAll('.search-match').forEach(el => {
            el.classList.remove('search-match');
            el.style.outline = '';
            el.style.outlineOffset = '';
        });

        // Clear selected highlight
        document.querySelectorAll('.search-selected').forEach(el => {
            el.classList.remove('search-selected');
        });
    };

    /**
     * Select current match
     */
    NodeSearch.selectCurrentMatch = function () {
        if (NodeSearch.selectedIndex < 0 || NodeSearch.selectedIndex >= NodeSearch.currentMatches.length) {
            return;
        }

        // Clear previous selection highlight
        document.querySelectorAll('.search-selected').forEach(el => {
            el.classList.remove('search-selected');
        });

        const nodeId = NodeSearch.currentMatches[NodeSearch.selectedIndex];
        const nodeEl = document.getElementById('node_' + nodeId);

        if (nodeEl) {
            nodeEl.classList.add('search-selected');
            nodeEl.style.outline = '3px solid #3b82f6'; // Blue outline for selected
            nodeEl.style.outlineOffset = '2px';
        }

        // Select node and ensure visible
        if (NodeSearch.callbacks?.selectNode) {
            NodeSearch.callbacks.selectNode(nodeId);
        }

        if (NodeSearch.callbacks?.ensureNodeVisible) {
            const node = NodeSearch.state.nodes[nodeId];
            if (node) {
                NodeSearch.callbacks.ensureNodeVisible(node, 100);
            }
        }

        NodeSearch.updateUI();
    };

    /**
     * Select next match
     */
    NodeSearch.selectNext = function () {
        if (NodeSearch.currentMatches.length === 0) return;

        NodeSearch.selectedIndex = (NodeSearch.selectedIndex + 1) % NodeSearch.currentMatches.length;
        NodeSearch.selectCurrentMatch();
    };

    /**
     * Select previous match
     */
    NodeSearch.selectPrevious = function () {
        if (NodeSearch.currentMatches.length === 0) return;

        NodeSearch.selectedIndex = (NodeSearch.selectedIndex - 1 + NodeSearch.currentMatches.length) % NodeSearch.currentMatches.length;
        NodeSearch.selectCurrentMatch();
    };

    /**
     * Clear search
     */
    NodeSearch.clearSearch = function () {
        if (NodeSearch.searchInput) {
            NodeSearch.searchInput.value = '';
        }
        NodeSearch.clearHighlights();
        NodeSearch.currentMatches = [];
        NodeSearch.selectedIndex = -1;
        NodeSearch.updateUI();
    };

    /**
     * Update UI (counter, buttons)
     */
    NodeSearch.updateUI = function () {
        const hasQuery = NodeSearch.searchInput && NodeSearch.searchInput.value.trim();
        const hasMatches = NodeSearch.currentMatches.length > 0;

        // Show/hide clear button
        if (NodeSearch.clearBtn) {
            NodeSearch.clearBtn.style.display = hasQuery ? 'inline-block' : 'none';
        }

        // Update results counter
        if (NodeSearch.resultsCounter) {
            if (hasQuery) {
                if (hasMatches) {
                    NodeSearch.resultsCounter.textContent = `${NodeSearch.selectedIndex + 1} / ${NodeSearch.currentMatches.length}`;
                    NodeSearch.resultsCounter.style.color = '#059669'; // Green
                } else {
                    NodeSearch.resultsCounter.textContent = 'No results';
                    NodeSearch.resultsCounter.style.color = '#dc2626'; // Red
                }
                NodeSearch.resultsCounter.style.display = 'inline';
            } else {
                NodeSearch.resultsCounter.style.display = 'none';
            }
        }
    };

    // Expose to window
    window.AppNodeSearch = NodeSearch;
})();
