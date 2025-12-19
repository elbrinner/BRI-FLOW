// copilot_azure.js
// Azure OpenAI Provider for AI Copilot
// Implements the generate(prompt) interface using direct client-side API calls.

(function (global) {

    const SYSTEM_PROMPT = `
You are an expert in "Bri Flow", a JSON-based flow definition language for chatbots.
Your task is to generate a valid JSON object representing a flow based on the user's description.

### Output Format
Return ONLY a JSON object with the following structure:
{
  "nodes": {
    "node_id_1": { ... },
    "node_id_2": { ... }
  }
}
Do not include markdown formatting, code blocks, or explanations. Just the raw JSON.

### Node Types & Schema

1. **response** (Send a message)
   { "id": "...", "type": "response", "x": 0, "y": 0, "i18n": { "es": { "text": ["Message content"] } }, "next": { "node_id": "target_id" } }

2. **input** (Capture user input)
   { "id": "...", "type": "input", "x": 0, "y": 0, "i18n": { "es": { "prompt": "Question?" } }, "save_as": "variable_name", "next": { "node_id": "target_id" } }

3. **choice** (Multiple choice buttons)
   { "id": "...", "type": "choice", "x": 0, "y": 0, "i18n": { "es": { "prompt": "Choose one" } }, "options": [
       { "label": "Option A", "target": { "node_id": "target_A" } },
       { "label": "Option B", "target": { "node_id": "target_B" } }
     ]
   }

4. **agent_call** (Call an AI agent)
   { "id": "...", "type": "agent_call", "x": 0, "y": 0, "agent_name": "AgentName", "next": { "node_id": "target_id" } }

5. **end** (Finish flow)
   { "id": "...", "type": "end", "x": 0, "y": 0 }

### Rules
- **IDs**: Use short, descriptive IDs (e.g., 'ask_name', 'menu_main').
- **Positioning**: Start at x:0, y:0 and increase y by 150 for each step.
- **Language**: Default to 'es' (Spanish) for i18n content.
- **Connections**: Ensure 'next' and 'target' point to valid node IDs within your generated JSON.
`;

    const SYSTEM_PROMPT_EXPERT = `
You are an expert in "Bri Flow", a visual flow editor for chatbots.
Your task is to help the user understand how to use the editor, explain node types, write formulas (expressions), and structure their bots.

### Knowledge Base
- **Node Types**: response, input, choice, agent_call, condition, loop, variable_assign, etc.
- **Formulas**: Access variables via 'context.foo' or simple 'foo'. Expressions support standard JS-like syntax (len, split, etc.).
- **Editor Features**: Drag & Dropping, Connecting nodes, Undo/Redo, Simulator, AI Copilot.

### Output Guidelines
- Answer the user's question clearly and concisely.
- Use bullet points for steps.
- If asked for code/JSON, provide it in a code block.
- Be helpful and friendly.
`;

    class AzureCopilotProvider {
        constructor(config) {
            this.endpoint = config?.azureEndpoint || config?.endpoint || '';
            this.apiKey = config?.azureKey || config?.apiKey || '';
            this.deployment = config?.azureModel || config?.deployment || 'gpt-4o';
        }

        async generate(userPrompt, options = {}) {
            const systemPrompt = await this._getSystemPrompt('prompts/flow_generator.md', 'You are a Flow Generator AI.');
            const fullMessage = this._buildUserMessage(userPrompt, options);

            const responseText = await this._callApi([
                { role: "system", content: systemPrompt },
                { role: "user", content: fullMessage }
            ]);

            // Clean up markdown if present (e.g. \`\`\`json ... \`\`\`)
            const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            // Attempt to find the first { and last }
            const firstBrace = cleanJson.indexOf('{');
            const lastBrace = cleanJson.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1) {
                return JSON.parse(cleanJson.substring(firstBrace, lastBrace + 1));
            }
            return JSON.parse(cleanJson);
        }

        async ask(userPrompt, options = {}) {
            const systemPrompt = await this._getSystemPrompt('prompts/qa_assistant.md', 'You are a generic AI Assistant.');

            let messages = [{ role: "system", content: systemPrompt }];

            // Add History if present
            if (options.history && Array.isArray(options.history)) {
                messages = messages.concat(options.history);
            }

            // Add User Message (with context/files)
            const fullMessage = this._buildUserMessage(userPrompt, options);
            messages.push({ role: "user", content: fullMessage });

            return await this._callApi(messages, options.onProgress);
        }

        async _getSystemPrompt(path, fallback) {
            try {
                // Try to fetch the markdown file
                const response = await fetch(path);
                if (response.ok) {
                    return await response.text();
                }
                console.warn(`[AzureCopilot] Could not fetch ${path}, using fallback.`);
            } catch (e) {
                console.warn(`[AzureCopilot] Fetch error for ${path}:`, e);
            }
            return fallback;
        }

        _buildUserMessage(prompt, options) {
            const { context, files } = options;
            let msg = prompt;

            if (files && files.length > 0) {
                msg += '\n\n### Attached Files:\n';
                files.forEach(f => {
                    msg += `\n--- FILE: ${f.name} ---\n${f.content}\n--- END FILE ---\n`;
                });
            }

            if (context) {
                // Limit context size if needed, for now send full JSON
                msg += `\n\n### Current Flow Context:\n\`\`\`json\n${JSON.stringify(context, null, 2)}\n\`\`\``;
            }

            return msg;
        }

        async _callApi(messages, onProgress = null) {
            if (!this.endpoint || !this.apiKey || !this.deployment) {
                throw new Error('Azure Configuration missing');
            }

            const url = `${this.endpoint}/openai/deployments/${this.deployment}/chat/completions?api-version=2024-02-15-preview`;

            const payload = {
                messages: messages,
                max_tokens: 3500,
                temperature: 0.7,
                stream: !!onProgress // Enable stream if callback provided
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'api-key': this.apiKey
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const err = await response.text();
                throw new Error(`Azure API Error: ${response.status} - ${err}`);
            }

            if (onProgress) {
                // Handle Streaming Response
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let fullText = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split('\n');

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const dataStr = line.slice(6);
                            if (dataStr === '[DONE]') continue;
                            try {
                                const data = JSON.parse(dataStr);
                                const token = data.choices[0]?.delta?.content || '';
                                if (token) {
                                    fullText += token;
                                    onProgress(token);
                                }
                            } catch (e) {
                                console.warn('[Azure] Stream parse error', e);
                            }
                        }
                    }
                }
                return fullText;

            } else {
                // Handle Standard Response
                const data = await response.json();
                return data.choices[0].message.content;
            }
        }
    }

    global.AzureCopilotProvider = AzureCopilotProvider;

})(window);
