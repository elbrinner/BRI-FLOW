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
            this.endpoint = config?.endpoint || '';
            this.apiKey = config?.apiKey || '';
        }

        async generate(userPrompt) {
            const responseText = await this._callApi([
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: userPrompt }
            ]);

            // Clean up markdown if present (e.g. \`\`\`json ... \`\`\`)
            const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleanJson);
        }

        async ask(userPrompt) {
            return await this._callApi([
                { role: "system", content: SYSTEM_PROMPT_EXPERT },
                { role: "user", content: userPrompt }
            ]);
        }

        async _callApi(messages) {
            if (!this.endpoint || !this.apiKey) {
                console.warn('[AzureCopilot] Missing configuration. Returning mock response.');
                if (global.LocalCopilotProvider) {
                    // Fallback to local provider for generate, but ask might not be supported there.
                    // For now, simpler fallback:
                    return "Mock Response (No Config)";
                }
                throw new Error('Azure Configuration missing.');
            }

            const payload = {
                messages: messages,
                temperature: 0.3,
                max_tokens: 2000,
                top_p: 0.95
            };

            try {
                const response = await fetch(this.endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'api-key': this.apiKey
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const errText = await response.text();
                    throw new Error(`Azure API Error: ${response.status} - ${errText}`);
                }

                const data = await response.json();
                return data.choices[0].message.content;

            } catch (error) {
                console.error('[AzureCopilot] API call failed:', error);
                throw error;
            }
        }
    }

    global.AzureCopilotProvider = AzureCopilotProvider;

})(window);
