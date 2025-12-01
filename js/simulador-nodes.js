(function() {
  'use strict';

  console.log('[simulador-nodes.js] Initializing Simulador.nodes');
  console.log('[simulador-nodes.js] window.Simulador before:', window.Simulador);

  // Módulo para procesar nodos pasivos del simulador
  // Dependencias: window.Simulador.evaluator, window.Simulador.core

  if (!window.Simulador) {
    console.log('[simulador-nodes.js] Creating window.Simulador');
    window.Simulador = {};
  }
  if (!window.Simulador.nodes) {
    console.log('[simulador-nodes.js] Creating window.Simulador.nodes');
    window.Simulador.nodes = {};
  }

  console.log('[simulador-nodes.js] window.Simulador after:', window.Simulador);
  console.log('[simulador-nodes.js] window.Simulador.nodes created:', window.Simulador.nodes);

  // Helper para crear chip informativo de variable guardada
  window.Simulador.nodes.createSavedChip = function(key, value) {
    const chip = document.createElement('div');
    chip.className = 'inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded mt-1';
    chip.textContent = `${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`;
    return chip;
  };

  console.log('[simulador-nodes.js] Module loaded successfully');

})();

// Helpers

function getI18nPrompt(node, fallback) {
  return node.prompt || (node.i18n && node.i18n.es && node.i18n.es.text ? node.i18n.es.text.join(' ') : fallback);
}

function getButtonSaveKey(nodeId, node){
  const explicit = node && (node.save_as || node.saveAs);
  return explicit && String(explicit).trim() ? String(explicit).trim() : `selected_button_${nodeId}`;
}

function getVariantClass(v){
  const variant = (v || '').toLowerCase();
  if(variant === 'primary') return 'px-4 py-2 rounded text-sm bg-sky-600 text-white hover:bg-sky-700';
  if(variant === 'tertiary') return 'px-4 py-2 rounded text-sm bg-transparent text-sky-700 border border-transparent hover:bg-sky-50';
  return 'px-4 py-2 rounded text-sm bg-white border text-gray-800 hover:bg-gray-100';
}

function getOptionLabel(opt) {
  if (!opt) return '';
  if (typeof opt === 'string') return opt;
  if (opt.i18n && opt.i18n.es && opt.i18n.es.text) return opt.i18n.es.text.join(' ');
  return opt.label || opt.text || opt.value || '';
}

function tryResolveLabelFromJsonOrRaw(raw, locale) {
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object' && raw[locale] && typeof raw[locale] === 'string') return raw[locale];
  if (raw && typeof raw === 'object' && raw.es && typeof raw.es === 'string') return raw.es;
  if (raw && typeof raw === 'object' && raw.en && typeof raw.en === 'string') return raw.en;
  return raw;
}

function getLocale() {
  return 'es';
}
