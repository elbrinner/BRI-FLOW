// js/simulador/nodes/service.js
(function () {
    'use strict';

    const register = (type, handler) => {
        setTimeout(() => window.Simulador.nodes.register(type, handler), 0);
    };

    register('rest_call', (node, state, flow, nodeId, ctx) => {
        const saveKey = node.save_as || node.saveAs;

        ctx.api.makeHttpRequest(node, ctx.useRealHttp).then(result => {
            if (saveKey) {
                state.variables[saveKey] = {
                    status: result.status,
                    timestamp: new Date().toISOString(),
                    data: result.data,
                    error: result.error
                };
            }
            ctx.log(`REST_CALL -> ${saveKey} = status ${result.status}`);
            state.history.push({ node: nodeId, type: 'rest_call', result });

            state.current = ctx.gotoNext(node.next);
            ctx.scheduleStep();
        }).catch(err => {
            ctx.log(`REST_CALL error: ${err.message}`);
            state.current = ctx.gotoNext(node.next);
            ctx.scheduleStep();
        });

        // Async, so we don't schedule step immediately here, but inside then/catch
    });

    register('agent_call', async (node, state, flow, nodeId, ctx) => {
        ctx.log('AGENT_CALL (Real/Simulated)');
        const saveKey = node.save_as;

        // Show typing indicator if available (ctx.showTyping not standard in service nodes, but we can try)
        // For now, just log start

        try {
            // Call the agent module (supports Azure, Mock, etc.)
            const result = await window.SimuladorAgents.runAgentCall(node, state, {
                onText: (text) => {
                    // Streaming callback
                    // We need to append to the LAST bot message if possible, or just append new chunks
                    // For simplicity in this version, we'll append chunks as separate messages or rely on the final result if not streaming
                    // Ideally, UI.appendChatMessage should support updating the last bubble.
                    // For now, let's just log stream chunks to debug
                    // console.log('[Stream]', text);
                },
                onTool: (tool) => {
                    ctx.log(`[Tool] ${tool.name}`);
                }
            });

            // Handle final result
            if (result.ok) {
                // If it was a stream, we might assume onText handled it, but runAgentCall returns {ok:true}
                // If it was not a stream, it returns { text: "...", ... } or { ... }

                let contentToRender = result.text || result.content || '';

                // If result has usage, save it
                if (saveKey) {
                    state.variables[saveKey] = result;
                }

                // Render to Chat
                // Check if it's a UI component object (parsed JSON) or just text
                if (typeof contentToRender === 'object') {
                    // Direct object (e.g. from mock or parsed response)
                    if (window.Simulador.ui && window.Simulador.ui.appendChatMessage) {
                        window.Simulador.ui.appendChatMessage('bot', contentToRender);
                    }
                } else if (contentToRender) {
                    // String (Text or JSON string)
                    if (window.Simulador.ui && window.Simulador.ui.appendChatMessage) {
                        window.Simulador.ui.appendChatMessage('bot', contentToRender);
                    }
                }

            } else {
                ctx.log('Agent call returned not OK');
            }

        } catch (e) {
            ctx.log('Agent Error: ' + e.message);
            if (window.Simulador.ui && window.Simulador.ui.appendChatMessage) {
                window.Simulador.ui.appendChatMessage('bot', `⚠️ Error: ${e.message}`);
            }
        }

        state.current = ctx.gotoNext(node.next);
        ctx.scheduleStep();
    });

    register('use_profile', (node, state, flow, nodeId, ctx) => {
        const profileName = node.profile || 'default';
        state._active_profile = profileName;
        ctx.log(`USE_PROFILE -> ${profileName}`);
        state.current = ctx.gotoNext(node.next);
        ctx.scheduleStep();
    });
})();
