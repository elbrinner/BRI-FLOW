// sim_profiles.js
// Gestión de perfiles de credenciales para el simulador (frontend-only)
(function(){
  const LS_PROFILES = 'sim.profiles.v1';
  const LS_ACTIVE = 'sim.active_profile';
  const LS_AOAI_STATUS = 'sim.aoai_status';
  const LS_SEARCH_STATUS = 'sim.search_status';

  function readLS(key, fallback){
    try{ const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }catch(_e){ return fallback; }
  }
  function writeLS(key, value){ try{ localStorage.setItem(key, JSON.stringify(value)); }catch(_e){} }

  function loadSimProfiles(){
    const rec = readLS(LS_PROFILES, { profiles:{}, updatedAt:null });
    window.SIM_CREDENTIAL_PROFILES = rec && rec.profiles ? rec.profiles : {};
    return window.SIM_CREDENTIAL_PROFILES;
  }
  function saveSimProfiles(profiles){ writeLS(LS_PROFILES, { profiles: profiles||{}, updatedAt: new Date().toISOString() }); }
  function getActiveProfile(){ try{ return localStorage.getItem(LS_ACTIVE) || ''; }catch(_e){ return ''; } }
  function setActiveProfile(name){ try{ localStorage.setItem(LS_ACTIVE, String(name||'')); }catch(_e){}; try{ if(window.App && window.App.state) window.App.state._active_profile = name; }catch(_e){}; renderProfileChip(); }

  async function pingAoai(profile){
    try{
      const endpoint = String(profile.aoai_endpoint||'').trim();
      const apiKey = String(profile.aoai_api_key||'').trim();
      const apiVersion = String(profile.aoai_api_version||'2025-01-01-preview').trim();
      const deployment = String(profile.aoai_chat_deployment||'').trim();
      if(!endpoint || !apiKey || !deployment) throw new Error('Faltan campos (endpoint/api_key/deployment).');
      const url = endpoint.replace(/\/$/, '') + '/openai/deployments/' + encodeURIComponent(deployment) + '/chat/completions?api-version=' + encodeURIComponent(apiVersion);
      const payload = { messages:[{ role:'user', content:'ping'}], temperature:0, max_tokens:4, stream:false };
      const res = await fetch(url, { method:'POST', headers: { 'Content-Type':'application/json', 'api-key': apiKey, 'Accept':'application/json' }, body: JSON.stringify(payload) });
      const ok = res.ok;
      let message = '';
      if(!ok){ try{ message = await res.text(); }catch(_e){}; throw new Error('HTTP '+res.status+' '+(message||'')); }
      writeLS(LS_AOAI_STATUS, { ok:true, at:new Date().toISOString() });
      return { ok:true };
    }catch(err){ writeLS(LS_AOAI_STATUS, { ok:false, at:new Date().toISOString(), message: String(err && err.message ? err.message : err) }); return { ok:false, error: err } }
  }

  function getAoaiStatus(){ return readLS(LS_AOAI_STATUS, null); }

  // Ping Azure AI Search: lista índices o consulta índice por defecto
  async function pingSearch(profile){
    try{
      const endpoint = String(profile.ai_search_endpoint||'').trim();
      const apiKey = String(profile.ai_search||'').trim();
      const indexName = String(profile.ai_search_default_index||'').trim();
      if(!endpoint || !apiKey) throw new Error('Faltan campos (ai_search_endpoint / ai_search).');
      const apiVersion = '2023-11-01';
      const base = endpoint.replace(/\/$/, '');
      const path = indexName ? `/indexes/${encodeURIComponent(indexName)}` : '/indexes';
      const url = `${base}${path}?api-version=${apiVersion}`;
      const res = await fetch(url, { method:'GET', headers: { 'Accept':'application/json', 'api-key': apiKey } });
      if(!res.ok){ let t=''; try{ t = await res.text(); }catch(_){}; throw new Error(`HTTP ${res.status} ${t}`.trim()); }
      let count = null;
      if(indexName){
        try{
          const cUrl = `${base}/indexes/${encodeURIComponent(indexName)}/docs/$count?api-version=${apiVersion}`;
          const cRes = await fetch(cUrl, { method:'GET', headers: { 'Accept':'text/plain', 'api-key': apiKey } });
          if(cRes.ok){ const txt = await cRes.text(); const n = Number(txt.trim()); if(Number.isFinite(n)) count = n; }
        }catch(_e){}
      }
      writeLS(LS_SEARCH_STATUS, { ok:true, at:new Date().toISOString(), index: indexName||null, count });
      return { ok:true };
    }catch(err){ writeLS(LS_SEARCH_STATUS, { ok:false, at:new Date().toISOString(), message: String(err && err.message ? err.message : err) }); return { ok:false, error: err } }
  }

  function getSearchStatus(){ return readLS(LS_SEARCH_STATUS, null); }

  function $(id){ return document.getElementById(id); }

  function renderProfileChip(){
    try{
      let chip = $('simProfileChip');
      // Si no existe, créalo al lado del botón de perfiles
      if(!chip){
        const btn = document.getElementById('btnProfilesManager');
        if(btn && btn.parentElement){
          chip = document.createElement('span');
          chip.id = 'simProfileChip';
          chip.className = 'hidden ml-2 inline-flex items-center gap-1 px-2 py-0.5 text-xs border rounded';
          chip.innerHTML = '<span class="sp-name"></span><span class="sp-status"></span>';
          btn.parentElement.insertBefore(chip, btn.nextSibling);
        }
      }
      if(!chip) return;
      const act = getActiveProfile();
      const aoai = getAoaiStatus();
      const search = getSearchStatus();
      if(!act){ chip.classList.add('hidden'); return; }
      chip.classList.remove('hidden');
      const nameEl = chip.querySelector('.sp-name'); if(nameEl) nameEl.textContent = act;
      const stEl = chip.querySelector('.sp-status');
      chip.classList.remove('bg-green-50','border-green-300','text-green-800','bg-amber-50','border-amber-300','text-amber-800','bg-gray-50','border-gray-300','text-gray-700');
      const aoaiTxt = aoai && aoai.ok ? 'AOAI OK' : (aoai ? 'AOAI WARN' : '');
      const seaTxt = search && search.ok ? 'SEARCH OK' : (search ? 'SEARCH WARN' : '');
      const labelTxt = [aoaiTxt, seaTxt].filter(Boolean).join(' · ');
      if ((aoai && aoai.ok) && (!search || search.ok)) {
        chip.classList.add('bg-green-50','border-green-300','text-green-800');
      } else if ((aoai && aoai.ok === false) || (search && search.ok === false)) {
        chip.classList.add('bg-amber-50','border-amber-300','text-amber-800');
      } else {
        chip.classList.add('bg-gray-50','border-gray-300','text-gray-700');
      }
      if (stEl) stEl.textContent = labelTxt;
    }catch(_e){}
  }

  function openProfilesModal(){
    ensureModal();
    renderProfilesList();
    const m = $('profilesModal'); if(m) m.classList.remove('hidden');
  }
  function closeProfilesModal(){ const m = $('profilesModal'); if(m) m.classList.add('hidden'); }

  function ensureModal(){
    if($('profilesModal')) return;
    const wrap = document.createElement('div');
    wrap.id = 'profilesModal';
    wrap.className = 'fixed inset-0 z-[360] hidden items-center justify-center bg-black bg-opacity-40';
    wrap.setAttribute('aria-hidden','true'); wrap.setAttribute('role','dialog'); wrap.setAttribute('aria-modal','true'); wrap.setAttribute('tabindex','-1');
    wrap.innerHTML = `
    <div class="w-full max-w-2xl bg-white rounded-lg shadow-lg overflow-hidden flex flex-col max-h-[80vh]">
      <div class="flex items-center justify-between p-4 border-b">
        <h3 class="text-lg font-semibold">Perfiles del simulador</h3>
        <button id="profilesModalClose" class="text-gray-600 hover:text-gray-900">✕</button>
      </div>
      <div class="p-4 space-y-4 flex-1 overflow-y-auto text-sm">
        <div class="flex items-center gap-2">
          <button id="btnNewProfile" class="px-3 py-2 bg-sky-600 text-white rounded text-sm">Nuevo</button>
          <button id="btnExportProfiles" class="px-3 py-2 bg-white border rounded text-sm">Exportar</button>
          <label class="px-3 py-2 bg-white border rounded text-sm cursor-pointer">Importar<input id="inputImportProfiles" type="file" accept=".json" class="hidden"/></label>
        </div>
        <div id="profilesList" class="divide-y border rounded"></div>
        <div id="profileEditor" class="hidden border rounded p-3 bg-gray-50 space-y-2">
          <div class="font-semibold">Editar perfil</div>
          <div class="grid grid-cols-2 gap-2">
            <label class="text-xs text-gray-600">Nombre<input id="prof_name" class="mt-1 w-full border rounded px-2 py-1"/></label>
            <label class="text-xs text-gray-600">API Version<input id="prof_aoai_api_version" class="mt-1 w-full border rounded px-2 py-1" placeholder="2025-01-01-preview"/></label>
            <label class="text-xs text-gray-600 col-span-2">Endpoint<input id="prof_aoai_endpoint" class="mt-1 w-full border rounded px-2 py-1" placeholder="https://<recurso>.openai.azure.com"/></label>
            <label class="text-xs text-gray-600 col-span-2">API Key<input id="prof_aoai_api_key" class="mt-1 w-full border rounded px-2 py-1"/></label>
            <label class="text-xs text-gray-600 col-span-2">Chat Deployment<input id="prof_aoai_chat_deployment" class="mt-1 w-full border rounded px-2 py-1" placeholder="gpt-4o-mini"/></label>
            <div class="col-span-2 border-t my-1"></div>
            <div class="col-span-2 text-xs text-gray-700 font-semibold">Embeddings (opcional)</div>
            <label class="text-xs text-gray-600">Embeddings Deployment<input id="prof_aoai_embeddings_deployment" class="mt-1 w-full border rounded px-2 py-1" placeholder="text-embedding-3-large"/></label>
            <label class="text-xs text-gray-600">Embeddings API Version<input id="prof_aoai_embeddings_api_version" class="mt-1 w-full border rounded px-2 py-1" placeholder="2023-05-15"/></label>
            <div class="col-span-2 border-t my-1"></div>
            <div class="col-span-2 text-xs text-gray-700 font-semibold">Azure AI Search (opcional)</div>
            <label class="text-xs text-gray-600 col-span-2">Search Endpoint<input id="prof_ai_search_endpoint" class="mt-1 w-full border rounded px-2 py-1" placeholder="https://<recurso>.search.windows.net"/></label>
            <label class="text-xs text-gray-600">Search Api Key<input id="prof_ai_search" class="mt-1 w-full border rounded px-2 py-1"/></label>
            <label class="text-xs text-gray-600">Default Index<input id="prof_ai_search_default_index" class="mt-1 w-full border rounded px-2 py-1" placeholder="video-index"/></label>
            <label class="text-xs text-gray-600 col-span-2">Semantic Config<input id="prof_ai_search_semantic_config" class="mt-1 w-full border rounded px-2 py-1" placeholder="my-semantic-config"/></label>
          </div>
          <div class="flex items-center justify-between mt-2">
            <div class="flex items-center gap-2 text-xs text-gray-600"><input id="prof_persist" type="checkbox"/><label for="prof_persist">Persistir en localStorage</label></div>
            <div class="flex items-center gap-2">
              <button id="btnTestProfile" class="px-3 py-1 bg-white border rounded text-sm" title="Probar Azure OpenAI">Probar AOAI</button>
              <button id="btnTestSearch" class="px-3 py-1 bg-white border rounded text-sm" title="Probar Azure AI Search">Probar Search</button>
              <button id="btnSaveProfile" class="px-3 py-1 bg-sky-600 text-white rounded text-sm">Guardar</button>
            </div>
          </div>
          <div id="profTestResult" class="text-xs mt-2"></div>
        </div>
      </div>
      <div class="p-3 border-t text-xs text-gray-500">Perfiles guardados sólo en este navegador (origen actual). No se exportan en el JSON del flujo.</div>
    </div>`;
    document.body.appendChild(wrap);
    $('profilesModalClose').addEventListener('click', closeProfilesModal);
    $('btnNewProfile').addEventListener('click', () => editProfile({ name:'', aoai_api_version:'2025-01-01-preview' }, true));
    $('btnExportProfiles').addEventListener('click', exportProfiles);
    $('inputImportProfiles').addEventListener('change', importProfiles);
  }

  function exportProfiles(){
    const data = { profiles: window.SIM_CREDENTIAL_PROFILES || {}, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'simprofiles.json'; a.click(); setTimeout(()=> URL.revokeObjectURL(a.href), 1000);
  }
  function importProfiles(ev){
    const f = ev.target.files && ev.target.files[0]; if(!f) return;
    const r = new FileReader();
    r.onload = () => { try{ const obj = JSON.parse(String(r.result||'{}')); if(obj && obj.profiles && typeof obj.profiles==='object'){ window.SIM_CREDENTIAL_PROFILES = obj.profiles; saveSimProfiles(obj.profiles); renderProfilesList(); } }catch(e){ alert('Archivo inválido'); } };
    r.readAsText(f);
  }

  function renderProfilesList(){
    const host = $('profilesList'); if(!host) return;
    const profs = window.SIM_CREDENTIAL_PROFILES || {};
    host.innerHTML = '';
    const names = Object.keys(profs);
    if(names.length === 0){ host.innerHTML = '<div class="p-3 text-gray-500 text-xs">(sin perfiles)</div>'; return; }
    names.forEach(name => {
      const p = profs[name] || {};
      const row = document.createElement('div'); row.className = 'flex items-center justify-between p-2';
      const left = document.createElement('div'); left.className = 'flex flex-col';
      const t = document.createElement('div'); t.className = 'font-medium'; t.textContent = name;
      const s = document.createElement('div'); s.className = 'text-xs text-gray-600'; s.textContent = (p.aoai_endpoint||'').toString();
      left.appendChild(t); left.appendChild(s);
      const right = document.createElement('div'); right.className = 'flex items-center gap-2';
      const bAct = document.createElement('button'); bAct.className = 'px-2 py-1 bg-white border rounded text-xs'; bAct.textContent = 'Activar'; bAct.addEventListener('click', ()=> setActiveProfile(name));
      const bEd = document.createElement('button'); bEd.className = 'px-2 py-1 bg-white border rounded text-xs'; bEd.textContent = 'Editar'; bEd.addEventListener('click', ()=> editProfile({ name, ...p }, true));
      const bDel = document.createElement('button'); bDel.className = 'px-2 py-1 bg-red-500 text-white rounded text-xs'; bDel.textContent = 'Borrar'; bDel.addEventListener('click', ()=> { if(confirm('¿Eliminar perfil '+name+'?')){ try{ delete window.SIM_CREDENTIAL_PROFILES[name]; }catch(_e){}; saveSimProfiles(window.SIM_CREDENTIAL_PROFILES); renderProfilesList(); renderProfileChip(); } });
      right.appendChild(bAct); right.appendChild(bEd); right.appendChild(bDel);
      row.appendChild(left); row.appendChild(right);
      host.appendChild(row);
    });
  }

  function editProfile(p, show){
    const ed = $('profileEditor'); if(!ed) return;
    ed.classList.toggle('hidden', !show);
    if(!show) return;
    $('prof_name').value = p.name || '';
  $('prof_aoai_endpoint').value = p.aoai_endpoint || '';
  $('prof_aoai_api_key').value = p.aoai_api_key || '';
  $('prof_aoai_api_version').value = p.aoai_api_version || '2025-01-01-preview';
  $('prof_aoai_chat_deployment').value = p.aoai_chat_deployment || '';
  $('prof_aoai_embeddings_deployment').value = p.aoai_embeddings_deployment || '';
  $('prof_aoai_embeddings_api_version').value = p.aoai_embeddings_api_version || '';
  $('prof_ai_search_endpoint').value = p.ai_search_endpoint || '';
  $('prof_ai_search').value = p.ai_search || '';
  $('prof_ai_search_default_index').value = p.ai_search_default_index || '';
  $('prof_ai_search_semantic_config').value = p.ai_search_semantic_config || '';
    $('prof_persist').checked = true;
    $('profTestResult').textContent = '';
    $('btnTestProfile').onclick = async () => {
      const pf = collectProfileFromForm();
      $('profTestResult').textContent = 'Probando…';
      const r = await pingAoai(pf);
      if(r.ok){ $('profTestResult').textContent = 'OK'; } else { $('profTestResult').textContent = 'Error: '+ (r.error && r.error.message ? r.error.message : 'desconocido'); }
      renderProfileChip();
    };
    $('btnTestSearch').onclick = async () => {
      const pf = collectProfileFromForm();
      $('profTestResult').textContent = 'Probando Search…';
      const r = await pingSearch(pf);
      if(r.ok){ const st = getSearchStatus(); const extra = (st && Number.isFinite(st.count)) ? ` (docs: ${st.count})` : ''; $('profTestResult').textContent = 'Search OK' + extra; }
      else { $('profTestResult').textContent = 'Search Error: '+ (r.error && r.error.message ? r.error.message : 'desconocido'); }
      renderProfileChip();
    };
    $('btnSaveProfile').onclick = () => {
      const pf = collectProfileFromForm();
      const persist = !!$('prof_persist').checked;
      const name = pf.name || '';
      if(!name) return alert('Nombre requerido');
      window.SIM_CREDENTIAL_PROFILES = window.SIM_CREDENTIAL_PROFILES || {};
      window.SIM_CREDENTIAL_PROFILES[name] = pf;
      if(persist) saveSimProfiles(window.SIM_CREDENTIAL_PROFILES);
      renderProfilesList(); renderProfileChip();
    };
  }

  function collectProfileFromForm(){
    const name = $('prof_name').value.trim();
    const pf = {
      name,
      aoai_endpoint: $('prof_aoai_endpoint').value.trim(),
      aoai_api_key: $('prof_aoai_api_key').value.trim(),
      aoai_api_version: $('prof_aoai_api_version').value.trim() || '2025-01-01-preview',
      aoai_chat_deployment: $('prof_aoai_chat_deployment').value.trim(),
      aoai_embeddings_deployment: $('prof_aoai_embeddings_deployment').value.trim(),
      aoai_embeddings_api_version: $('prof_aoai_embeddings_api_version').value.trim(),
      ai_search_endpoint: $('prof_ai_search_endpoint').value.trim(),
      ai_search: $('prof_ai_search').value.trim(),
      ai_search_default_index: $('prof_ai_search_default_index').value.trim(),
      ai_search_semantic_config: $('prof_ai_search_semantic_config').value.trim()
    };
    return pf;
  }

  function wireGlobal(){
    try{
      document.addEventListener('DOMContentLoaded', () => {
        // cargar perfiles LS → memoria
        loadSimProfiles();
        // inyectar perfil activo a estado si existe
        const act = getActiveProfile();
        if(act && window.App && window.App.state) window.App.state._active_profile = act;
        // chip header y botón
        const btn = document.getElementById('btnProfilesManager');
        if(btn) btn.addEventListener('click', openProfilesModal);
        renderProfileChip();
      });
    }catch(_e){}
  }

  // API pública
  window.SIM_PROFILES = { loadSimProfiles, saveSimProfiles, getActiveProfile, setActiveProfile, pingAoai, getAoaiStatus, renderProfileChip };

  wireGlobal();
})();
