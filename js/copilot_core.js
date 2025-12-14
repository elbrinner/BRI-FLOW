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
        constructor(provider, flowManager) {
            this.provider = provider;
            this.flowManager = flowManager;
        }

        async generateAndApply(prompt) {
            // 1. Generate flow fragment from provider
            const fragment = await this.provider.generate(prompt);

            if (!fragment || !fragment.nodes || Object.keys(fragment.nodes).length === 0) {
                throw new Error('La IA no generó ningún nodo válido.');
            }

            // 2. Get current state
            const currentState = this.flowManager.getState();
            const currentNodes = currentState.nodes || {};

            // 3. Merge logic
            const mergedNodes = FlowMerger.merge(currentNodes, fragment);

            // 4. Update state via FlowManager
            // We'll add nodes one by one or bulk update if supported.
            // For safety, let's use a bulk update method if available, or manual injection.
            this.flowManager.addNodesBulk(mergedNodes);

            return mergedNodes;
        }

        async ask(question) {
            if (this.provider && typeof this.provider.ask === 'function') {
                return await this.provider.ask(question);
            }
            throw new Error('El proveedor de IA no soporta el modo chat.');
        }
    }

    global.CopilotCore = {
        FlowMerger,
        CopilotService
    };

})(window);
