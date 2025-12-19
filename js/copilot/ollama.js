// copilot_ollama.js
// Ollama Provider for AI Copilot (Local)
// Connects to a local Ollama instance (default port 11434)

(function (global) {

    class OllamaCopilotProvider {
        constructor(config) {
            this.endpoint = config?.ollamaEndpoint || 'http://localhost:11434';
            this.model = config?.ollamaModel || 'llama3.1';
        }

        async generate(userPrompt, options = {}) {
            // For generation, we use a single prompt approach
            const systemPrompt = await this._getSystemPrompt('prompts/flow_generator.md', 'You are a Flow Generator AI.');

            // Optimize context for Ollama (limit size)
            const context = this._optimizeContext(options.context);
            const fullMessage = this._buildUserMessage(userPrompt, { ...options, context });

            return await this._generateRequest(systemPrompt, fullMessage);
        }

        async ask(userPrompt, options = {}) {
            const systemPrompt = await this._getSystemPrompt('prompts/qa_assistant.md', 'You are a generic AI Assistant.');

            // Build conversation history
            let messages = [{ role: 'system', content: systemPrompt }];

            // Add history if available
            if (options.history && Array.isArray(options.history)) {
                // Take last 10 turns to avoid exploding context
                const recentHistory = options.history.slice(-10);
                messages = messages.concat(recentHistory);
            }

            // Current user message
            const context = this._optimizeContext(options.context);
            const fullMessage = this._buildUserMessage(userPrompt, { ...options, context });
            messages.push({ role: 'user', content: fullMessage });

            return await this._chatRequest(messages);
        }

        // --- Helpers ---

        async _generateRequest(systemPrompt, userMessage) {
            // Use /api/generate for single prompt or /api/chat. Let's use chat for consistency.
            const messages = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage }
            ];

            const response = await this._chatRequest(messages);

            // JSON Cleanup
            const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
            const firstBrace = cleanJson.indexOf('{');
            const lastBrace = cleanJson.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1) {
                return JSON.parse(cleanJson.substring(firstBrace, lastBrace + 1));
            }
            return JSON.parse(cleanJson);
        }

        async _chatRequest(messages) {
            try {
                const response = await fetch(`${this.endpoint}/api/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: this.model,
                        messages: messages,
                        stream: false // Streaming todo later
                    })
                });

                if (!response.ok) {
                    throw new Error(`Ollama Error: ${response.status} ${response.statusText}`);
                }

                const data = await response.json();
                return data.message.content;

            } catch (e) {
                console.error('[Ollama] Request failed', e);
                throw new Error('Ollama no responde. Verifica que esté corriendo (`ollama serve`).');
            }
        }

        _buildUserMessage(prompt, context, files) {
            let msg = prompt;

            if (files && files.length > 0) {
                msg += '\n\n### Attached Files:\n';
                files.forEach(f => {
                    // Truncate file content for Ollama if too large? 
                    // For now send raw, rely on user to be sensible.
                    msg += `\n--- FILE: ${f.name} ---\n${f.content}\n--- END FILE ---\n`;
                });
            }


            // Remove visual properties from nodes
            for (const key in optimized.nodes) {
                const node = optimized.nodes[key];
                delete node.position; // {x, y}
                delete node.width;
                delete node.height;
                delete node.style; // Any css styles
                delete node.color;
                delete node.selected;

                // Also cleanup visual meta if present
                if (node.meta) {
                    delete node.meta.visual;
                }
            }

            // Simplify connections if they have visual routing info (points)
            if (Array.isArray(optimized.connections)) {
                optimized.connections.forEach(conn => {
                    delete conn.points; // Routing points
                });
            }

            return optimized;
        }

        async _getSystemPrompt(path, fallback) {
            try {
                const response = await fetch(path);
                if (response.ok) return await response.text();
            } catch (e) {
                console.warn(`[Ollama] Could not fetch ${path}`);
            }
            return fallback;
        }
    }

    global.OllamaCopilotProvider = OllamaCopilotProvider;

})(window);
