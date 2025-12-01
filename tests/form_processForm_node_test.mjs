// Node test for processForm using jsdom
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

// Load the processForm source
const processFormPath = path.resolve('js/nodes/processForm.js');
const source = fs.readFileSync(processFormPath, 'utf8');

// Create JSDOM environment
const dom = new JSDOM(`<!DOCTYPE html><html><body><div id="chatRoot"></div></body></html>`, { url: 'http://localhost/' });
const { window } = dom;
global.window = window;
global.document = window.document;
global.navigator = window.navigator;

// Minimal stubs required by processForm
window.Simulador = window.Simulador || {};
window.Simulador.nodes = window.Simulador.nodes || {};
window.Simulador.getVariable = (key) => state.variables[key];
// Chip helper stub
window.Simulador.nodes.createSavedChip = function(type, text){
  const div = document.createElement('div');
  div.className = 'chip';
  div.textContent = `[${type}] ${text}`;
  return div;
};

// i18n prompt helper stub
global.getI18nPrompt = (obj, fallback) => {
  if (!obj) return fallback || '';
  if (typeof obj === 'string') return obj;
  return fallback || obj.label || obj.prompt || obj.Prompt || '';
};

// Append chat message stub
const chatMessages = [];
const appendChatMessage = (who, elOrStr) => {
  let el = elOrStr;
  if (typeof elOrStr === 'string') {
    el = document.createElement('div');
    el.textContent = elOrStr;
  }
  chatMessages.push({ who, el });
  // Attach to DOM for potential further inspection
  document.getElementById('chatRoot').appendChild(el);
};

// Other callback stubs
const noop = () => {};
const gotoNext = (next) => next; // pass through

// Prepare dynamic variable payload
const dynamicFields = [
  { Name: 'nombre', FieldType: 'SHORT', Prompt: 'Tu nombre' },
  { Name: 'comentario', FieldType: 'LONG', Prompt: 'Comentario' }
];

const state = {
  variables: {
    ucSectionFields: dynamicFields
  },
  history: [],
  current: 'f1'
};

// Flow/node definition
const node = {
  id: 'f1',
  type: 'form',
  mode: 'dynamic',
  fields_source: 'ucSectionFields',
  next: 'end',
  save_as: 'uc_form_values'
};

// Evaluate original source (defines window.Simulador.nodes.processForm)
// Wrap in function to avoid leaking variables
const wrapped = `(function(){ ${source} })();`;
eval(wrapped);

if (typeof window.Simulador.nodes.processForm !== 'function') {
  console.error('[TEST] processForm function not found.');
  process.exit(1);
}

// Invoke processForm
window.Simulador.nodes.processForm(
  node,
  state,
  { nodes: { f1: node } },
  'f1',
  console.log,
  gotoNext,
  noop,
  noop,
  appendChatMessage,
  noop,
  noop,
  noop,
  0,
  false,
  true,
  0
);

// Assertions
let pass = true;
const formCard = chatMessages.find(m => m.who === 'bot' && m.el.querySelector('form'));
if (!formCard) {
  console.error('[TEST] No form found inside chat card.');
  pass = false;
} else {
  const inputs = formCard.el.querySelectorAll('input, textarea, select');
  console.log('[TEST] Found inputs count =', inputs.length);
  if (inputs.length < 2) {
    console.error('[TEST] Expected at least 2 inputs (nombre, comentario).');
    pass = false;
  } else {
    // Check specific fields
    const nombre = formCard.el.querySelector('input[name="nombre"]');
    const comentario = formCard.el.querySelector('textarea[name="comentario"]');
    if (!nombre) { console.error('[TEST] Missing input nombre'); pass = false; }
    if (!comentario) { console.error('[TEST] Missing textarea comentario'); pass = false; }
  }
}

// Simulate submit (fill values first)
if (pass && formCard) {
  const nombre = formCard.el.querySelector('input[name="nombre"]');
  const comentario = formCard.el.querySelector('textarea[name="comentario"]');
  if (nombre) nombre.value = 'Juan';
  if (comentario) comentario.value = 'Hola mundo';
  const submitBtn = formCard.el.querySelector('button[type="submit"]');
  if (submitBtn) {
    // Use exposed debug submit if available
    if (window.Simulador?.nodes?.__formSubmitDebug) {
      window.Simulador.nodes.__formSubmitDebug('f1');
    } else {
      const form = submitBtn.closest('form');
      if (form) {
        const ev = new window.Event('forceSubmit', { bubbles: true, cancelable: true });
        form.dispatchEvent(ev);
      } else {
        submitBtn.click();
      }
    }
    console.log('[TEST] After submit state.variables.uc_form_values =', state.variables.uc_form_values);
    if (!state.variables.uc_form_values || state.variables.uc_form_values.nombre !== 'Juan') {
      console.error('[TEST] Submitted value for nombre not stored under save_as'); pass = false;
    }
  } else {
    console.error('[TEST] Submit button not found'); pass = false;
  }
}

if (pass) {
  console.log('[TEST] PASS: processForm dynamic rendering and submit behavior OK');
  process.exit(0);
} else {
  console.error('[TEST] FAIL');
  process.exit(2);
}
