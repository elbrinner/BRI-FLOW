// flow_ui.js
// Helpers para la UI del runner (modales y promesas de interacción)
(function(){
  function createModalContainer() {
    let modal = document.getElementById('flowRunnerModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'flowRunnerModal';
      modal.style.position = 'fixed';
      modal.style.left = '0'; modal.style.top = '0';
      modal.style.width = '100%'; modal.style.height = '100%';
      modal.style.display = 'flex'; modal.style.alignItems = 'center'; modal.style.justifyContent = 'center';
      modal.style.background = 'rgba(0,0,0,0.45)'; modal.style.zIndex = '9999';
      document.body.appendChild(modal);
    }
    modal.innerHTML = '';
    return modal;
  }

  function hideModal() { const m = document.getElementById('flowRunnerModal'); if(m) m.remove(); }

  function showNodeUI(contentHtml) {
    const modal = createModalContainer();
    const card = document.createElement('div');
    card.style.background = '#fff'; card.style.padding = '16px'; card.style.borderRadius = '8px'; card.style.minWidth = '360px';
    card.innerHTML = contentHtml;
    modal.appendChild(card);
    return { modal, card };
  }

  function updateContextView(card) {
    const pre = card.querySelector('.contextPreview');
    if (pre) pre.textContent = JSON.stringify(window.App.runtimeContext, null, 2);
  }

  function waitForClick(card, selector) {
    return new Promise(resolve => {
      const btn = card.querySelector(selector);
      if (!btn) return resolve(null);
      const handler = (e) => { e.preventDefault(); resolve(e); };
      btn.addEventListener('click', handler, { once: true });
    });
  }

  function waitForInputSubmit(card, inputSelector, okSelector, cancelSelector) {
    return new Promise(resolve => {
      const ok = card.querySelector(okSelector);
      const cancel = card.querySelector(cancelSelector);
      const inp = card.querySelector(inputSelector);
      if (!ok || !inp) return resolve({ cancelled: true });
      const onOk = () => resolve({ cancelled: false, value: inp.value });
      const onCancel = () => resolve({ cancelled: true });
      ok.addEventListener('click', onOk, { once: true });
      if (cancel) cancel.addEventListener('click', onCancel, { once: true });
    });
  }

  function waitForChoice(card, opts) {
    return new Promise(resolve => {
      const handler = (ev) => {
        const btn = ev.target.closest?.('.choiceOpt');
        if (btn && card.contains(btn)) {
          ev.preventDefault();
          const idx = Number(btn.getAttribute('data-idx'));
          const opt = opts[idx];
          card.removeEventListener('click', handler);
          const cancel = card.querySelector('#runnerCancel');
          if (cancel) cancel.removeEventListener('click', cancelHandler);
          hideModal();
          resolve(opt?.target?.node_id || null);
        }
      };
      const cancelHandler = () => { hideModal(); card.removeEventListener('click', handler); resolve(null); };
      card.addEventListener('click', handler);
      const cancel = card.querySelector('#runnerCancel');
      if (cancel) cancel.addEventListener('click', cancelHandler, { once: true });
    });
  }

  window.FlowUI = {
    createModalContainer,
    hideModal,
    showNodeUI,
    updateContextView,
    waitForClick,
    waitForInputSubmit,
    waitForChoice
  };

})();
