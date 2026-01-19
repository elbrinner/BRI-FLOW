/**
 * agent_schemas.js
 * Definitions for MCP (Model Context Protocol) and UI-Agents schemas.
 */

export const MCP_SERVER_SCHEMA = {
    type: "object",
    properties: {
        url: { type: "string", format: "uri" },
        name: { type: "string" },
        auth: {
            type: "object",
            properties: {
                type: { type: "string", enum: ["none", "bearer", "api_key"] },
                token: { type: "string" },
                key: { type: "string" }
            }
        },
        tools: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    name: { type: "string" },
                    description: { type: "string" },
                    input_schema: { type: "object" }
                }
            }
        }
    },
    required: ["url", "name"]
};

export const UI_COMPONENT_SCHEMA = {
    type: "object",
    properties: {
        type: { type: "string", enum: ["card", "form", "chart", "list", "markdown"] },
        id: { type: "string" },
        title: { type: "string" },
        data: { type: "object" },
        actions: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    label: { type: "string" },
                    action: { type: "string", enum: ["submit", "link", "event"] },
                    payload: { type: "object" }
                }
            }
        }
    },
    required: ["type"]
};

export const VOICE_AGENT_PROFILE_SCHEMA = {
    type: "object",
    properties: {
        provider: { type: "string", enum: ["openai-realtime", "azure-speech", "elevenlabs"] },
        voice_id: { type: "string" },
        vad_sensitivity: { type: "number", minimum: 0, maximum: 1 },
        interruptible: { type: "boolean" },
        language: { type: "string" }
    }
};
