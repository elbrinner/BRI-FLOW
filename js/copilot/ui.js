// copilot_ui.js
// Manages the AI Copilot Modal and User Interaction

(function (global) {
    const CopilotUI = {
        elements: {},
        service: null,

        history: [], // Stores conversation history {role, content}
        settings: {}, // Stores user settings for AI provider

        async init(service) {
            console.log('[CopilotUI] init() called');
            this.service = service;

            // Load Component
            try {
                const container = document.getElementById('copilotContainer');
                if (container) {
                    const resp = await fetch('components/copilot.html');
                    if (resp.ok) {
                        container.innerHTML = await resp.text();
                        console.log('[CopilotUI] Template loaded');
                    } else {
                        console.error('[CopilotUI] Failed to load template', resp.status);
                    }
                }
            } catch (e) {
                console.error('[CopilotUI] Template fetch error', e);
            }

            this.loadSettings();
            this.cacheDOM();
            this.bindEvents();
            this.updateSettingsUI();
            this.resetChat(); // Show updated greeting
            console.log('[CopilotUI] Initialization complete');
        },

        loadSettings() {
            this.settings = {
                provider: localStorage.getItem('bri_cp_provider') || 'azure',
                azureEndpoint: localStorage.getItem('bri_azure_endpoint') || '',
                azureKey: localStorage.getItem('bri_azure_key') || '',
                azureModel: localStorage.getItem('bri_azure_model') || 'gpt-4o',
                ollamaEndpoint: localStorage.getItem('bri_ollama_endpoint') || 'http://localhost:11434',
                ollamaModel: localStorage.getItem('bri_ollama_model') || 'llama3.1'
            };
        },

        saveSettings() {
            localStorage.setItem('bri_cp_provider', this.settings.provider);
            localStorage.setItem('bri_azure_endpoint', this.settings.azureEndpoint);
            localStorage.setItem('bri_azure_key', this.settings.azureKey);
            localStorage.setItem('bri_azure_model', this.settings.azureModel);
            localStorage.setItem('bri_ollama_endpoint', this.settings.ollamaEndpoint);
            localStorage.setItem('bri_ollama_model', this.settings.ollamaModel);

            // Re-init service if changed
            if (global.CopilotCore && global.CopilotCore.reinitProvider) {
                global.CopilotCore.reinitProvider(this.settings);
            }
        },

        cacheDOM() {
            const root = document.getElementById('copilotContainer');
            if (!root) {
                console.error('[CopilotUI] Root container #copilotContainer not found.');
                return;
            }

            this.elements = {
                btnOpen: document.getElementById('btnAiCopilot'), // Global button
                modal: root.querySelector('#copilotModal'),
                btnClose: root.querySelector('#copilotModalClose'),
                btnGenerate: document.getElementById('copilotBtnGenerate'),
                inputPrompt: document.getElementById('copilotPrompt'),
                errorBox: document.getElementById('copilotError'),
                spinner: document.getElementById('copilotSpinner'),

                // Attachment
                fileInput: document.getElementById('copilotFileInput'),
                btnAttach: document.getElementById('copilotBtnAttach'),
                btnAttachChat: document.getElementById('copilotChatBtnAttach'),
                fileList: document.getElementById('copilotFileList'),
                includedFiles: document.getElementById('copilotIncludedFiles'),

                // Chat Tab
                tabGen: document.getElementById('tabGen'),
                panelGen: document.getElementById('panelGen'),
                tabChat: document.getElementById('tabChat'),
                panelChat: document.getElementById('panelChat'),
                chatHistoryContainer: document.getElementById('copilotChatHistory'), // Original line
                // Chat History Container
                chatHistory: root.querySelector('#copilotChatHistory') || root.querySelector('#chatHistory') || document.getElementById('copilotChatHistory'),
                chatInput: document.getElementById('copilotChatInput'),
                chatSend: document.getElementById('copilotChatSend'),
                btnChatReset: document.getElementById('copilotChatReset'), // Reset history

                // Settings
                btnSettings: root.querySelector('#copilotBtnSettings'), // Header settings
                modalSettings: root.querySelector('#copilotSettingsModal'),
                btnSaveSettings: root.querySelector('#cpSettingsSave'),
                btnCloseSettings: root.querySelector('#copilotModalClose'), // Maybe specific close for settings? 
                settingsCancel: root.querySelector('#cpSettingsCancel'),

                // Settings Inputs
                inputProvider: root.querySelector('#cpSettingsProvider'),
                divAzure: root.querySelector('#cpSettingsAzure'),
                divOllama: root.querySelector('#cpSettingsOllama'),
                inputAzureEndpoint: root.querySelector('#cpSettingsAzureEndpoint'),
                inputAzureKey: root.querySelector('#cpSettingsAzureKey'),
                inputAzureModel: root.querySelector('#cpSettingsAzureModel'),
                inputOllamaEndpoint: root.querySelector('#cpSettingsOllamaEndpoint'),
                inputOllamaModel: root.querySelector('#cpSettingsOllamaModel'),

                btnResetChat: root.querySelector('#copilotChatReset')
            };
        },

        bindEvents() {
            if (this.elements.btnOpen) this.elements.btnOpen.addEventListener('click', () => this.open());
            if (this.elements.btnClose) this.elements.btnClose.addEventListener('click', () => this.close());

            // Settings
            if (this.elements.btnSettings) {
                this.elements.btnSettings.addEventListener('click', () => {
                    if (this.elements.modalSettings) {
                        this.elements.modalSettings.classList.remove('hidden');
                        this.elements.modalSettings.classList.add('flex');
                    }
                    this.updateSettingsUI();
                });
            }
            if (this.elements.settingsCancel) {
                this.elements.settingsCancel.addEventListener('click', () => {
                    if (this.elements.modalSettings) {
                        this.elements.modalSettings.classList.add('hidden');
                        this.elements.modalSettings.classList.remove('flex');
                    }
                });
            }
            if (this.elements.btnSaveSettings) {
                this.elements.btnSaveSettings.addEventListener('click', () => {
                    // Extract values
                    this.settings.provider = this.elements.inputProvider ? this.elements.inputProvider.value : 'azure';
                    this.settings.azureEndpoint = this.elements.inputAzureEndpoint ? this.elements.inputAzureEndpoint.value : '';
                    this.settings.azureKey = this.elements.inputAzureKey ? this.elements.inputAzureKey.value : '';
                    this.settings.azureModel = this.elements.inputAzureModel ? this.elements.inputAzureModel.value : '';
                    this.settings.ollamaEndpoint = this.elements.inputOllamaEndpoint ? this.elements.inputOllamaEndpoint.value : '';
                    this.settings.ollamaModel = this.elements.inputOllamaModel ? this.elements.inputOllamaModel.value : '';

                    this.saveSettings();
                    if (this.elements.modalSettings) {
                        this.elements.modalSettings.classList.add('hidden');
                        this.elements.modalSettings.classList.remove('flex');
                    }
                    if (global.Toasts) global.Toasts.success('Configuración guardada');
                });
            }

            if (this.elements.inputProvider) {
                this.elements.inputProvider.addEventListener('change', () => this.updateSettingsUI());
            }

            // Tabs and Attachments 
            if (this.elements.tabGen) this.elements.tabGen.addEventListener('click', (e) => { e.preventDefault(); this.switchTab('gen'); });
            if (this.elements.tabChat) this.elements.tabChat.addEventListener('click', (e) => { e.preventDefault(); this.switchTab('chat'); });

            if (this.elements.btnAttach) this.elements.btnAttach.addEventListener('click', () => this.elements.fileInput.click());
            if (this.elements.btnAttachChat) this.elements.btnAttachChat.addEventListener('click', () => this.elements.fileInput.click());
            if (this.elements.fileInput) this.elements.fileInput.addEventListener('change', () => this.updateFileList());

            // Generator
            if (this.elements.btnCancel) this.elements.btnCancel.addEventListener('click', () => this.close());
            if (this.elements.btnGenerate) this.elements.btnGenerate.addEventListener('click', () => this.handleGenerate());

            // Chat
            if (this.elements.chatSend) this.elements.chatSend.addEventListener('click', () => this.handleChat());
            if (this.elements.chatInput) {
                this.elements.chatInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') this.handleChat();
                });
            }
            if (this.elements.btnChatReset) {
                this.elements.btnChatReset.addEventListener('click', () => this.resetChat());
            }

            // Close on backdrop
            if (this.elements.modal) {
                this.elements.modal.addEventListener('click', (e) => {
                    if (e.target === this.elements.modal) this.close();
                });
            }
        },

        resetChat() {
            this.history = [];
            if (this.elements.chatHistoryContainer) {
                this.elements.chatHistoryContainer.innerHTML = '';
            }
            // Re-add greeting
            const initialGreeting = document.createElement('div');
            initialGreeting.innerHTML = `
            <div class="flex gap-2 items-start">
              <div class="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">🤖</div>
              <div class="bg-white p-3 rounded-tr-xl rounded-br-xl rounded-bl-xl shadow-sm text-sm text-gray-700 border">
                Hola, soy tu experto en BRI Flow. ¿En qué puedo ayudarte?
              </div>
            </div>`;
            this.elements.chatHistoryContainer.appendChild(initialGreeting);
            if (global.Toasts) global.Toasts.info('Conversación reiniciada');
        },

        updateFileList() {
            const input = this.elements.fileInput;
            const container = this.elements.fileList;
            const label = this.elements.includedFiles;

            if (input.files.length > 0) {
                const names = Array.from(input.files).map(f => f.name).join(', ');
                if (label) label.textContent = names;
                if (container) container.classList.remove('hidden');

                // Visual feedback in buttons
                if (this.elements.btnAttach) this.elements.btnAttach.classList.add('text-indigo-600', 'bg-indigo-50');
                if (this.elements.btnAttachChat) this.elements.btnAttachChat.classList.add('text-indigo-600', 'bg-indigo-50');
            } else {
                if (container) container.classList.add('hidden');

                if (this.elements.btnAttach) this.elements.btnAttach.classList.remove('text-indigo-600', 'bg-indigo-50');
                if (this.elements.btnAttachChat) this.elements.btnAttachChat.classList.remove('text-indigo-600', 'bg-indigo-50');
            }
        },

        open() {
            console.log('[CopilotUI] open() called');
            if (!this.elements.modal) return;

            this.elements.modal.classList.remove('hidden');
            this.elements.modal.classList.add('flex');
            this.elements.modal.setAttribute('aria-hidden', 'false');

            this.switchTab('gen');
            this.hideError();
            this.resetButton();
        },

        close() {
            if (!this.elements.modal) return;
            this.elements.modal.classList.add('hidden');
            this.elements.modal.classList.remove('flex');
            this.elements.modal.setAttribute('aria-hidden', 'true');
        },

        updateSettingsUI() {
            if (!this.elements.inputProvider) return;

            // Set current values
            this.elements.inputProvider.value = this.settings.provider;

            if (this.elements.divAzure && this.elements.divOllama) {
                if (this.settings.provider === 'azure') {
                    this.elements.divAzure.classList.remove('hidden');
                    this.elements.divOllama.classList.add('hidden');
                } else {
                    this.elements.divAzure.classList.add('hidden');
                    this.elements.divOllama.classList.remove('hidden');
                }
            }

            if (this.elements.inputAzureEndpoint) this.elements.inputAzureEndpoint.value = this.settings.azureEndpoint || '';
            if (this.elements.inputAzureKey) this.elements.inputAzureKey.value = this.settings.azureKey || '';
            if (this.elements.inputAzureModel) this.elements.inputAzureModel.value = this.settings.azureModel || 'gpt-4o';
            if (this.elements.inputOllamaEndpoint) this.elements.inputOllamaEndpoint.value = this.settings.ollamaEndpoint || 'http://localhost:11434';
            if (this.elements.inputOllamaModel) this.elements.inputOllamaModel.value = this.settings.ollamaModel || 'llama3.1';
        },

        switchTab(tab) {
            console.log('[CopilotUI] Switching to tab:', tab);
            // Reset styles
            // Active: text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50
            // Inactive: text-gray-500 hover:text-indigo-600 hover:bg-gray-50
            const activeClass = ['text-indigo-600', 'border-b-2', 'border-indigo-600', 'bg-indigo-50'];
            const inactiveClass = ['text-gray-500', 'hover:text-indigo-600', 'hover:bg-gray-50'];

            if (tab === 'gen') {
                if (this.elements.panelGen) this.elements.panelGen.classList.remove('hidden');
                if (this.elements.panelChat) this.elements.panelChat.classList.add('hidden');

                if (this.elements.tabGen) {
                    this.elements.tabGen.classList.add(...activeClass);
                    this.elements.tabGen.classList.remove(...inactiveClass);
                }
                if (this.elements.tabChat) {
                    this.elements.tabChat.classList.remove(...activeClass);
                    this.elements.tabChat.classList.add(...inactiveClass);
                }

                if (this.elements.inputPrompt) this.elements.inputPrompt.focus();
            } else {
                if (this.elements.panelGen) this.elements.panelGen.classList.add('hidden');
                if (this.elements.panelChat) this.elements.panelChat.classList.remove('hidden');

                if (this.elements.tabChat) {
                    this.elements.tabChat.classList.add(...activeClass);
                    this.elements.tabChat.classList.remove(...inactiveClass);
                }
                if (this.elements.tabGen) {
                    this.elements.tabGen.classList.remove(...activeClass);
                    this.elements.tabGen.classList.add(...inactiveClass);
                }

                if (this.elements.chatInput) this.elements.chatInput.focus();
            }
        },

        async handleGenerate() {
            const prompt = this.elements.inputPrompt.value.trim();
            if (!prompt) {
                this.showError('Por favor, describe el flujo que deseas crear.');
                return;
            }

            // Logic: Overwrite vs Append
            const context = this.getFlowContext();
            const nodeCount = context && context.nodes ? Object.keys(context.nodes).length : 0;

            if (nodeCount > 0) {
                const wantOverwrite = confirm(
                    "⚠️ El lienzo actual NO está vacío.\n\n" +
                    "¿Quieres BORRAR el flujo actual antes de generar el nuevo?\n\n" +
                    "[Aceptar] = BORRAR todo y generar nuevo (Sobrescribir).\n" +
                    "[Cancelar] = Mantener actual y AÑADIR lo nuevo al final (Append)."
                );

                if (wantOverwrite) {
                    // Clear flow logic
                    if (global.App && global.App.flowManager && typeof global.App.flowManager.clear === 'function') {
                        global.App.flowManager.clear();
                        console.log('[CopilotUI] Flow cleared by user request');
                    } else if (global.AppFlowManager && typeof global.AppFlowManager.clear === 'function') {
                        global.AppFlowManager.clear();
                    } else {
                        console.warn('[CopilotUI] Could not find clear() method on FlowManager');
                    }
                }
            }

            this.setLoading(true);
            this.hideError();

            try {
                if (this.service) {
                    // Gather Context (re-fetch if cleared, though object might be stale if ref changed)
                    const currentContext = this.getFlowContext();
                    // Gather Files
                    const files = await this.getSelectedFiles();

                    await this.service.generateAndApply(prompt, { context: currentContext, files });
                    this.close();
                    if (global.Toasts) global.Toasts.success('Flujo generado con éxito');
                } else {
                    throw new Error('Copilot Service not initialized');
                }
            } catch (error) {
                console.error('[CopilotUI] Generation failed', error);
                this.showError('Error al generar el flujo: ' + error.message);
            } finally {
                this.setLoading(false);
            }
        },

        async handleChat() {
            const input = this.elements.chatInput;
            const text = input.value.trim();
            if (!text) return;

            // Validation: Check configuration
            if (this.settings.provider === 'azure') {
                if (!this.settings.azureKey || !this.settings.azureEndpoint) {
                    this.appendChatMessage('assistant', '⚠️ Error de configuración: Faltan credenciales de Azure OpenAI. Por favor, revisa los ajustes ⚙️.');
                    return;
                }
            }
            // Ollama usually defaults to localhost, so less critical, but good to have
            if (this.settings.provider === 'ollama') {
                if (!this.settings.ollamaEndpoint) {
                    this.appendChatMessage('assistant', '⚠️ Error de configuración: Falta el endpoint de Ollama. Por favor, revisa los ajustes ⚙️.');
                    return;
                }
            }

            // Clear input and disable
            input.value = '';
            input.disabled = true;

            // Display User Message
            this.appendChatMessage('user', text);

            // Create Assistant Bubble immediately
            const bubbleContent = this.appendChatMessage('assistant', '⏳ Analizando contexto...');
            let fullResponse = '';

            try {
                if (this.service && typeof this.service.ask === 'function') {
                    // Gather Context & Files
                    const context = this.getFlowContext();
                    const files = await this.getSelectedFiles();

                    // Simple Context Feedback
                    const nodeCount = context && context.nodes ? Object.keys(context.nodes).length : 0;
                    if (nodeCount > 0) {
                        bubbleContent.innerText = `🔍 Leyendo ${nodeCount} nodo(s) de tu flujo...`;
                    }

                    // Clone history to prevent mutation issues, though strict cloning isn't strictly necessary here
                    const options = {
                        context,
                        files,
                        history: [...this.history], // Pass copy of current history
                        onProgress: (chunk) => {
                            if (!chunk) return;
                            if (fullResponse === '') bubbleContent.textContent = '';
                            fullResponse += chunk;
                            bubbleContent.innerHTML = this.renderMarkdown(fullResponse);

                            // Auto-scroll
                            const historyContainer = this.elements.chatHistory;
                            historyContainer.scrollTop = historyContainer.scrollHeight;
                        }
                    };

                    const response = await this.service.ask(text, options);

                    // Final update (just in case stream missed something or fallback usage)
                    if (response && response !== fullResponse) {
                        fullResponse = response;
                        bubbleContent.innerHTML = this.renderMarkdown(fullResponse);
                    }

                    // Save assistant response to history
                    this.history.push({ role: 'assistant', content: fullResponse });

                } else {
                    bubbleContent.innerText = '⚠️ El servicio de Copilot no soporta el modo chat.';
                }
            } catch (e) {
                console.error('[CopilotUI] Chat error', e);
                bubbleContent.innerText = '❌ Error: ' + e.message;
            } finally {
                input.disabled = false;
                input.focus();
            }
        },

        getFlowContext() {
            // Safe access to App.flowManager
            if (global.App && global.App.flowManager) {
                return global.App.flowManager.getState(); // Returns full JSON object
            }
            return null;
        },

        async getSelectedFiles() {
            // Look for file input. Ideally added to HTML or dynamically created.
            // For now, let's assume an input with id 'copilotFileInput' exists or return empty.
            const fileInput = document.getElementById('copilotFileInput');
            if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
                return [];
            }

            const readers = Array.from(fileInput.files).map(file => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve({ name: file.name, content: reader.result });
                    reader.onerror = reject;
                    // Read as text
                    reader.readAsText(file);
                });
            });

            return Promise.all(readers);
        },

        appendChatMessage(role, text) {
            // Add to internal history state
            // Note: We don't push the assistant '...' placeholder here, only finalized messages in handleChat
            if (text !== '...') {
                this.history.push({ role, content: text });
            }

            const container = this.elements.chatHistory;
            const wrapper = document.createElement('div');
            wrapper.className = 'flex gap-2 items-start';

            const isUser = role === 'user';
            const icon = document.createElement('div');
            icon.className = `w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isUser ? 'bg-gray-200 order-2' : 'bg-indigo-100'}`;
            icon.textContent = isUser ? '👤' : '🤖';

            const contentDiv = document.createElement('div');
            contentDiv.className = `p-3 shadow-sm text-sm border max-w-[85%] overflow-hidden ${isUser
                ? 'bg-indigo-50 text-indigo-900 rounded-tl-xl rounded-bl-xl rounded-br-xl'
                : 'bg-white text-gray-700 rounded-tr-xl rounded-br-xl rounded-bl-xl'
                }`;

            // Initial render
            if (text === '...') {
                contentDiv.innerText = text;
            } else {
                contentDiv.innerHTML = this.renderMarkdown(text);
            }

            if (isUser) {
                wrapper.classList.add('justify-end');
                wrapper.appendChild(contentDiv);
                wrapper.appendChild(icon);
            } else {
                wrapper.appendChild(icon);
                wrapper.appendChild(contentDiv);
            }

            container.appendChild(wrapper);
            container.scrollTop = container.scrollHeight;
            return contentDiv;
        },

        renderMarkdown(text) {
            // Simple robust regex-based markdown parser
            let html = text
                // Escape HTML (simple)
                .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
                // Code Blocks
                .replace(/```([\s\S]*?)```/g, '<pre class="bg-gray-800 text-gray-100 p-2 rounded mt-1 mb-1 overflow-x-auto text-xs font-mono">$1</pre>')
                // Inline Code
                .replace(/`([^`]+)`/g, '<code class="bg-gray-200 text-gray-800 px-1 rounded text-xs font-mono">$1</code>')
                // Bold
                .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                // Italic
                .replace(/\*([^*]+)\*/g, '<em>$1</em>')
                // Line breaks
                .replace(/\n/g, '<br>');
            return html;
        },

        setLoading(isLoading) {
            const btn = this.elements.btnGenerate;
            const spinner = this.elements.spinner;
            if (isLoading) {
                btn.disabled = true;
                btn.classList.add('opacity-75', 'cursor-not-allowed');
                spinner.classList.remove('hidden');
            } else {
                this.resetButton();
            }
        },

        resetButton() {
            const btn = this.elements.btnGenerate;
            const spinner = this.elements.spinner;
            btn.disabled = false;
            btn.classList.remove('opacity-75', 'cursor-not-allowed');
            spinner.classList.add('hidden');
        },

        showError(msg) {
            const box = this.elements.errorBox;
            box.textContent = msg;
            box.classList.remove('hidden');
        },

        hideError() {
            const box = this.elements.errorBox;
            box.classList.add('hidden');
        }
    };

    global.CopilotUI = CopilotUI;

})(window);
