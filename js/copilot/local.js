// copilot_local.js
// Local V1 Provider for AI Copilot (Heuristic/Mock)

(function (global) {

    class LocalCopilotProvider {
        async generate(prompt) {
            // Simulate network delay
            await new Promise(resolve => setTimeout(resolve, 1500));

            const lowerPrompt = prompt.toLowerCase();

            // Heuristic 1: "Cita médica" or "Appointment"
            if (lowerPrompt.includes('cita') || lowerPrompt.includes('appointment') || lowerPrompt.includes('medica')) {
                return this.getAppointmentTemplate();
            }

            // Heuristic 2: "Support" or "Soporte"
            if (lowerPrompt.includes('soporte') || lowerPrompt.includes('support') || lowerPrompt.includes('ayuda')) {
                return this.getSupportTemplate();
            }

            // Heuristic 3: "Encuesta" or "Survey"
            if (lowerPrompt.includes('encuesta') || lowerPrompt.includes('survey')) {
                return this.getSurveyTemplate();
            }

            // Default: Simple Hello World
            return this.getSimpleTemplate();
        }

        getAppointmentTemplate() {
            return {
                nodes: {
                    'cp_start': { id: 'cp_start', type: 'response', x: 0, y: 0, i18n: { es: { text: ['Hola, soy tu asistente médico virtual.'] } }, next: { node_id: 'cp_name' } },
                    'cp_name': { id: 'cp_name', type: 'input', x: 0, y: 150, i18n: { es: { prompt: '¿Cuál es tu nombre completo?' } }, save_as: 'user_name', next: { node_id: 'cp_spec' } },
                    'cp_spec': {
                        id: 'cp_spec', type: 'choice', x: 0, y: 300, i18n: { es: { prompt: '¿Qué especialidad necesitas?' } }, options: [
                            { label: 'Medicina General', target: { node_id: 'cp_confirm' } },
                            { label: 'Pediatría', target: { node_id: 'cp_confirm' } },
                            { label: 'Dermatología', target: { node_id: 'cp_confirm' } }
                        ]
                    },
                    'cp_confirm': { id: 'cp_confirm', type: 'response', x: 0, y: 500, i18n: { es: { text: ['Perfecto, buscaremos un especialista para ti.'] } }, next: { node_id: 'cp_end' } },
                    'cp_end': { id: 'cp_end', type: 'end', x: 0, y: 650 }
                }
            };
        }

        getSupportTemplate() {
            return {
                nodes: {
                    'cp_sup_1': { id: 'cp_sup_1', type: 'response', x: 0, y: 0, i18n: { es: { text: ['Bienvenido al soporte técnico.'] } }, next: { node_id: 'cp_sup_2' } },
                    'cp_sup_2': {
                        id: 'cp_sup_2', type: 'choice', x: 0, y: 150, i18n: { es: { prompt: '¿Cuál es tu problema?' } }, options: [
                            { label: 'No puedo acceder', target: { node_id: 'cp_sup_reset' } },
                            { label: 'Error en pago', target: { node_id: 'cp_sup_billing' } }
                        ]
                    },
                    'cp_sup_reset': { id: 'cp_sup_reset', type: 'response', x: -150, y: 350, i18n: { es: { text: ['Para restablecer tu contraseña, visita /reset.'] } }, next: { node_id: 'cp_end' } },
                    'cp_sup_billing': { id: 'cp_sup_billing', type: 'agent_call', x: 150, y: 350, agent_name: 'BillingAgent', next: { node_id: 'cp_end' } },
                    'cp_end': { id: 'cp_end', type: 'end', x: 0, y: 550 }
                }
            };
        }

        getSurveyTemplate() {
            return {
                nodes: {
                    'cp_sur_1': { id: 'cp_sur_1', type: 'input', x: 0, y: 0, i18n: { es: { prompt: 'Del 1 al 10, ¿cómo calificarías nuestro servicio?' } }, save_as: 'nps_score', next: { node_id: 'cp_sur_2' } },
                    'cp_sur_2': { id: 'cp_sur_2', type: 'condition', x: 0, y: 150, condition: 'parseInt(context.nps_score) >= 9', next_true: { node_id: 'cp_sur_thanks' }, next_false: { node_id: 'cp_sur_feedback' } },
                    'cp_sur_thanks': { id: 'cp_sur_thanks', type: 'response', x: -150, y: 300, i18n: { es: { text: ['¡Gracias! Nos alegra que te guste.'] } }, next: { node_id: 'cp_end' } },
                    'cp_sur_feedback': { id: 'cp_sur_feedback', type: 'input', x: 150, y: 300, i18n: { es: { prompt: '¿Qué podemos mejorar?' } }, save_as: 'feedback', next: { node_id: 'cp_end' } },
                    'cp_end': { id: 'cp_end', type: 'end', x: 0, y: 500 }
                }
            };
        }

        getSimpleTemplate() {
            return {
                nodes: {
                    'cp_1': { id: 'cp_1', type: 'response', x: 0, y: 0, i18n: { es: { text: ['Hola, este es un flujo generado por IA.'] } }, next: { node_id: 'cp_2' } },
                    'cp_2': { id: 'cp_2', type: 'end', x: 0, y: 150 }
                }
            };
        }
    }

    global.LocalCopilotProvider = LocalCopilotProvider;

})(window);
