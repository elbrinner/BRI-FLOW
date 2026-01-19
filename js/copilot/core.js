// copilot_core.js
// Core logic for AI Copilot: Service orchestration and Flow Merging

(function (global) {

    // --- FlowMerger: Logic to position and merge new nodes ---
    const FlowMerger = {
        merge(currentNodes, newFragment) {
            // 1. Calculate bounding box of current nodes to find a safe insertion point
            const currentIds = Object.keys(currentNodes);
            let maxY = 0;
            let minX = 100; // Default start X

            if (currentIds.length > 0) {
                currentIds.forEach(id => {
                    const n = currentNodes[id];
                    if (n.y > maxY) maxY = n.y;
                });
                // Add some padding
                maxY += 250;
            } else {
                maxY = 100;
            }

            // 2. Offset new nodes
            // Assume newFragment.nodes is a dict of nodes starting at relative positions (e.g. 0,0)
            const newNodes = {};
            const idMap = {}; // oldId -> newId mapping to avoid collisions

            Object.keys(newFragment.nodes).forEach(oldId => {
                // Generate unique ID
                const newId = this.generateUniqueId(oldId, currentNodes);
                idMap[oldId] = newId;
            });

            Object.keys(newFragment.nodes).forEach(oldId => {
                const node = JSON.parse(JSON.stringify(newFragment.nodes[oldId]));
                const newId = idMap[oldId];

                node.id = newId;
                node.x = (node.x || 0) + minX;
                node.y = (node.y || 0) + maxY;

                // Update 'next' references
                if (node.next && node.next.node_id && idMap[node.next.node_id]) {
                    node.next.node_id = idMap[node.next.node_id];
                }

                // Update other references (e.g. choice options) if necessary
                // For V1 we assume simple linear flows or simple choices
                if (node.type === 'choice' && node.options) {
                    node.options.forEach(opt => {
                        if (opt.target && opt.target.node_id && idMap[opt.target.node_id]) {
                            opt.target.node_id = idMap[opt.target.node_id];
                        }
                    });
                }

                newNodes[newId] = node;
            });

            return newNodes;
        },

        generateUniqueId(baseId, currentNodes) {
            let candidate = baseId;
            let counter = 1;
            while (currentNodes[candidate]) {
                candidate = `${baseId}_${counter}`;
                counter++;
            }
            return candidate;
        }
    };

    // --- CopilotService: Facade for the UI ---
    class CopilotService {
        constructor(provider) {
            this.provider = provider;
        }

        get flowManager() {
            return (global.App && global.App.flowManager) ? global.App.flowManager : global.AppFlowManager;
        }

        async generateAndApply(prompt, options = {}) {
            // 1. Generate flow fragment from provider
            const fragment = await this.provider.generate(prompt, options);

            if (!fragment) {
                throw new Error('La IA no generó ninguna respuesta válida.');
            }
            if (fragment.error === 'off_topic') {
                throw new Error(fragment.message || 'Solicitud fuera de contexto. Solo puedo generar flujos.');
            }
            if (!fragment.nodes || Object.keys(fragment.nodes).length === 0) {
                throw new Error('La IA no generó ningún nodo válido.');
            }

            // 2. Get current state
            const fm = this.flowManager;
            if (!fm) throw new Error('FlowManager not initialized (global.AppFlowManager missing)');

            const currentState = fm.getState();
            // Safety check for state
            if (!currentState) throw new Error('FlowManager state is null');

            const currentNodes = currentState.nodes || {};

            // 3. Merge logic
            const mergedNodes = FlowMerger.merge(currentNodes, fragment);

            // 4. Update state via FlowManager
            // We'll add nodes one by one or bulk update if supported.
            // For safety, let's use a bulk update method if available, or manual injection.
            fm.addNodesBulk(mergedNodes);

            return mergedNodes;
        }

        async ask(question, options = {}) {
            if (!this.provider) throw new Error('Provider not initialized');
            // Pass options (context, files, onProgress) to provider
            return await this.provider.ask(question, options);
        }
    }

    // --- Provider Factory ---
    function createProvider(config) {
        if (config.provider === 'ollama' && global.OllamaCopilotProvider) {
            console.log('[CopilotCore] Switched to Ollama');
            return new global.OllamaCopilotProvider(config);
        }
        if (global.AzureCopilotProvider) {
            console.log('[CopilotCore] Switched to Azure');
            return new global.AzureCopilotProvider(config);
        }
        return null;
    }

    global.CopilotCore = {
        FlowMerger,
        CopilotService,

        // Singleton service instance
        serviceInstance: null,

        init(config) {
            const provider = createProvider(config);
            if (!provider) console.warn('[CopilotCore] No provider available');

            // We no longer pass flowManager in constructor, it is accessed dynamically
            this.serviceInstance = new CopilotService(provider);

            // Auto-inject into UI if ready
            if (global.CopilotUI) {
                global.CopilotUI.init(this.serviceInstance);
            }
        },

        reinitProvider(config) {
            if (this.serviceInstance) {
                this.serviceInstance.provider = createProvider(config);
            } else {
                this.init(config);
            }
        }
    };

})(window);
