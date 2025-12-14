// copilot_ui.js
// Manages the AI Copilot Modal and User Interaction

(function (global) {
    const CopilotUI = {
        elements: {},
        service: null,

        init(service) {
            console.log('[CopilotUI] init() called');
            this.service = service;
            this.cacheDOM();
            this.bindEvents();
            console.log('[CopilotUI] Initialization complete');
        },

        cacheDOM() {
            this.elements = {
                btnOpen: document.getElementById('btnAiCopilot'),
                modal: document.getElementById('copilotModal'),
                btnClose: document.getElementById('copilotModalClose'),

                // Generator Tab
                tabGen: document.getElementById('tabGen'),
                panelGen: document.getElementById('panelGen'),
                btnCancel: document.getElementById('copilotBtnCancel'),
                btnGenerate: document.getElementById('copilotBtnGenerate'),
                inputPrompt: document.getElementById('copilotPrompt'),
                errorBox: document.getElementById('copilotError'),
                spinner: document.getElementById('copilotSpinner'),

                // Chat Tab
                tabChat: document.getElementById('tabChat'),
                panelChat: document.getElementById('panelChat'),
                chatHistory: document.getElementById('copilotChatHistory'),
                chatInput: document.getElementById('copilotChatInput'),
                chatSend: document.getElementById('copilotChatSend')
            };

            console.log('[CopilotUI] Elements cached:', {
                btnOpen: !!this.elements.btnOpen,
                modal: !!this.elements.modal,
                tabGen: !!this.elements.tabGen,
                tabChat: !!this.elements.tabChat
            });
        },

        bindEvents() {
            console.log('[CopilotUI] Binding events...');

            if (this.elements.btnOpen) {
                this.elements.btnOpen.addEventListener('click', () => {
                    console.log('[CopilotUI] Open button clicked');
                    this.open();
                });
                console.log('[CopilotUI] Open button bound');
            }

            if (this.elements.btnClose) {
                this.elements.btnClose.addEventListener('click', () => {
                    console.log('[CopilotUI] Close button clicked');
                    this.close();
                });
                console.log('[CopilotUI] Close button bound');
            }

            // Tabs
            if (this.elements.tabGen) {
                this.elements.tabGen.addEventListener('click', (e) => {
                    e.preventDefault();
                    console.log('[CopilotUI] Gen tab clicked');
                    this.switchTab('gen');
                });
                console.log('[CopilotUI] Gen tab bound');
            }

            if (this.elements.tabChat) {
                this.elements.tabChat.addEventListener('click', (e) => {
                    e.preventDefault();
                    console.log('[CopilotUI] Chat tab clicked');
                    this.switchTab('chat');
                });
                console.log('[CopilotUI] Chat tab bound');
            }

            // Generator
            if (this.elements.btnCancel) {
                this.elements.btnCancel.addEventListener('click', () => this.close());
            }

            if (this.elements.btnGenerate) {
                this.elements.btnGenerate.addEventListener('click', () => this.handleGenerate());
            }

            // Chat
            if (this.elements.chatSend) {
                this.elements.chatSend.addEventListener('click', () => this.handleChat());
            }

            if (this.elements.chatInput) {
                this.elements.chatInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') this.handleChat();
                });
            }

            // Close on backdrop
            if (this.elements.modal) {
                this.elements.modal.addEventListener('click', (e) => {
                    if (e.target === this.elements.modal) this.close();
                });
            }

            console.log('[CopilotUI] All events bound');
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

            this.setLoading(true);
            this.hideError();

            try {
                if (this.service) {
                    await this.service.generateAndApply(prompt);
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

            // Add User Message
            this.appendChatMessage('user', text);
            input.value = '';
            input.disabled = true;

            try {
                if (this.service && typeof this.service.ask === 'function') {
                    // Show typing indicator?
                    const response = await this.service.ask(text);
                    this.appendChatMessage('assistant', response);
                } else {
                    this.appendChatMessage('assistant', '⚠️ El servicio de Copilot no soporta el modo chat.');
                }
            } catch (e) {
                console.error('[CopilotUI] Chat error', e);
                this.appendChatMessage('assistant', '❌ Error: ' + e.message);
            } finally {
                input.disabled = false;
                input.focus();
            }
        },

        appendChatMessage(role, text) {
            const container = this.elements.chatHistory;
            const div = document.createElement('div');
            div.className = 'flex gap-2 items-start';

            const isUser = role === 'user';
            const icon = document.createElement('div');
            icon.className = `w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isUser ? 'bg-gray-200 order-2' : 'bg-indigo-100'}`;
            icon.textContent = isUser ? '👤' : '🤖';

            const bubble = document.createElement('div');
            bubble.className = `p-3 shadow-sm text-sm border max-w-[85%] ${isUser
                ? 'bg-indigo-50 text-indigo-900 rounded-tl-xl rounded-bl-xl rounded-br-xl'
                : 'bg-white text-gray-700 rounded-tr-xl rounded-br-xl rounded-bl-xl'
                }`;
            // Simple robust markdown-like parsing for code blocks or bold
            // For now just plain text to avoid XSS, or use innerText
            bubble.innerText = text;

            if (isUser) {
                div.classList.add('justify-end');
                div.appendChild(bubble);
                div.appendChild(icon);
            } else {
                div.appendChild(icon);
                div.appendChild(bubble);
            }

            container.appendChild(div);
            container.scrollTop = container.scrollHeight;
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
