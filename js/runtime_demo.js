// runtime_demo.js - compatibility shim that delegates to FlowRunner
(function(){
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btnRuntimeDemo');
    if (btn && window.FlowRunner && typeof window.FlowRunner.runFlow === 'function') {
      btn.addEventListener('click', window.FlowRunner.runFlow);
    }
  });
})();
