// simulador-agents.js
// Módulo separado: lógica de llamadas de agente y perfiles AOAI/RAG.
(function(){
  const Agents = {};

  function safeGet(obj, path){
    try{ return path.split('.').reduce((a,p)=> (a && a[p] !== undefined) ? a[p] : undefined, obj); }catch(_e){ return undefined; }
  }

  Agents.setAgentApiLastStatus = function(base, ok){
    try{
      const rec = { base:String(base||''), ok:!!ok, at:new Date().toISOString() };
      if(typeof localStorage !== 'undefined') localStorage.setItem('sim.agent_api_status', JSON.stringify(rec));
      if(window.Simulador && window.Simulador.getRuntimeState){
        const st = window.Simulador.getRuntimeState().state; if(st && st.variables){ st.variables.__agent_api_status = rec; }
      }
    }catch(_e){}
  };

  Agents.getAgentApiLastStatus = function(){
    try{
      if(typeof localStorage !== 'undefined'){ const v = localStorage.getItem('sim.agent_api_status'); if(v) return JSON.parse(v); }
    }catch(_e){}
    return null;
  };

  Agents.timeAgo = function(iso){
    try{ const d=new Date(iso); const s=Math.max(0,(Date.now()-d.getTime())/1000|0); if(s<60) return s+'s'; const m=(s/60)|0; if(m<60) return m+'m'; const h=(m/60)|0; if(h<24) return h+'h'; const dd=(h/24)|0; return dd+'d'; }catch(_e){ return ''; }
  };

  Agents.buildAgentRequestFromNode = function(node, state){
    const sessionId = (state && state.variables && state.variables.__sim_sessionId) || 'no-session';
    const threadId = safeGet(state, 'variables.agent_thread_id');
    const profile = node.agent_profile || node.props?.agent_profile || 'normal';
    let message = node.message || node.props?.message || '';
    try{ if(typeof message === 'string' && message.includes('{{') && window.Simulador && window.Simulador.core){ message = window.Simulador.core.interpolate(message, state.variables); } }catch(_e){}
    const req = { sessionId, message:String(message||'') }; if(threadId) req.threadId = threadId; req.agent = profile;
    const model = node.model || node.props?.model || null; if(model) req.model = model;
    const sp = node.system_prompt || node.props?.system_prompt || null; if(sp) req.systemPrompt = sp;
    const search = node.search || node.props?.search || null; if(search) req.search = search;
    const parts = node.participants || node.props?.participants || null; if(Array.isArray(parts)&&parts.length) req.participants = parts;
    const runtime = node.runtime || node.props?.runtime || null; if(runtime) req.runtime = runtime;
    return req;
  };

  Agents.runAgentCall = async function(node, state, { onText, onMeta, onTool } = {}){
    const wantsStream = !!(node.stream || node.props?.stream);
    const agentProfile = node.agent_profile || node.props?.agent_profile || 'normal';
    const base = (typeof window.getAgentApiBase === 'function') ? window.getAgentApiBase() : (window.location.origin || 'http://localhost:5000');

    // Mock config
    const localCfg = (window.SIM_LOCAL_CONFIG && window.SIM_LOCAL_CONFIG.agent) ? window.SIM_LOCAL_CONFIG.agent : {};
    const mockMode = node.props?.mock_mode || localCfg.mock_mode || 'off';
    const mockData = node.props?.mock !== undefined ? node.props.mock : localCfg.mock;
    if(mockMode === 'always'){
      if(wantsStream){ if(onText && mockData && typeof mockData.text === 'string') onText(String(mockData.text)); return { ok:true, mocked:true }; }
      return { text: (mockData && mockData.text) || '(mock agent)', mocked:true };
    }

    // Direct Azure OpenAI support (minimal)
    const model = node.model || node.props?.model || {};
    let provider = (model && model.provider) ? String(model.provider).toLowerCase() : '';
    provider = provider.replace(/_/g,'-');
    if(['azure','aoai','openai-azure'].includes(provider)) provider = 'azure-openai';

    function resolveAoaiCreds(){
      let activeProfile = state._active_profile || null;
      try{ if(!activeProfile && typeof localStorage !== 'undefined'){ const ap = localStorage.getItem('sim.active_profile'); if(ap && ap.trim()) activeProfile = ap.trim(); } }catch(_e){}
      if(!activeProfile) activeProfile = 'default';
      let profiles = {};
      try{ const raw = localStorage.getItem('sim.profiles.v1'); if(raw){ const obj = JSON.parse(raw); if(obj && obj.profiles) profiles = obj.profiles; } }catch(_e){ if(window.SIM_CREDENTIAL_PROFILES) profiles = window.SIM_CREDENTIAL_PROFILES; }
      const baseP = profiles[activeProfile] || {};
      return {
        endpoint: state.variables.aoai_endpoint || baseP.aoai_endpoint,
        key: state.variables.aoai_api_key || baseP.aoai_api_key,
        version: state.variables.aoai_api_version || baseP.aoai_api_version || model.api_version || '2025-01-01-preview',
        deployment: state.variables.aoai_chat_deployment || baseP.aoai_chat_deployment || model.deployment
      };
    }

    async function callAzure(){
      const cred = resolveAoaiCreds();
      if(!cred.endpoint || !cred.key || !cred.deployment) throw new Error('Credenciales AOAI incompletas');
      const url = cred.endpoint.replace(/\/$/,'') + '/openai/deployments/' + encodeURIComponent(cred.deployment) + '/chat/completions?api-version=' + encodeURIComponent(cred.version);
      let userMsg = node.message || node.props?.message || '';
      try{ if(typeof userMsg === 'string' && userMsg.includes('{{') && window.Simulador && window.Simulador.core){ userMsg = window.Simulador.core.interpolate(userMsg, state.variables); } }catch(_e){}
      const sysMsg = node.system_prompt || node.props?.system_prompt || '';
      const messages = []; if(sysMsg) messages.push({ role:'system', content:String(sysMsg) }); messages.push({ role:'user', content:String(userMsg||'') });
      const payload = { messages, temperature: typeof model.temperature==='number'? model.temperature : 0.2, stream: !!wantsStream };
      const headers = { 'Content-Type':'application/json', 'api-key': cred.key, 'Accept': wantsStream ? 'text/event-stream' : 'application/json' };
      if(!wantsStream){
        const res = await fetch(url, { method:'POST', headers, body: JSON.stringify(payload) });
        if(!res.ok){ throw new Error('HTTP '+res.status); }
        const json = await res.json();
        const text = json?.choices?.[0]?.message?.content || '';
        return { text, usage: json?.usage||null };
      }
      const res = await fetch(url, { method:'POST', headers, body: JSON.stringify(payload) });
      if(!res.ok || !res.body) throw new Error('HTTP '+res.status);
      const reader = res.body.getReader(); const dec = new TextDecoder(); let buf=''; let done=false;
      while(!done){ const {value, done:d} = await reader.read(); done=d; if(value) buf += dec.decode(value,{stream:true}); let idx; while((idx = buf.indexOf('\n\n'))!==-1){ const chunk = buf.slice(0,idx).trim(); buf = buf.slice(idx+2); if(!chunk.startsWith('data:')) continue; const raw = chunk.replace(/^data:\s*/, ''); if(raw==='[DONE]') continue; try{ const ev = JSON.parse(raw); const delta = ev?.choices?.[0]?.delta?.content; if(delta && onText) onText(delta); }catch(_e){} } }
      return { ok:true };
    }

    const canDirect = ['normal','domain_expert','rag',''].includes(agentProfile);
    if(canDirect && provider === 'azure-openai'){
      try{ return await callAzure(); }catch(e){ if(mockMode==='fallback' && mockData){ return { text: mockData.text || '(mock agent)', mocked:true }; } throw e; }
    }

    // Fallback backend
    const body = Agents.buildAgentRequestFromNode(node, state);
    const url = base.replace(/\/$/,'') + '/api/chat';
    const headers = { 'Content-Type':'application/vnd.agent+json', 'Accept': wantsStream ? 'text/event-stream' : 'application/json' };
    if(!wantsStream){
      try{
        const res = await fetch(url,{ method:'POST', headers, body: JSON.stringify(body) });
        if(!res.ok){ Agents.setAgentApiLastStatus(base,false); throw new Error('HTTP '+res.status); }
        Agents.setAgentApiLastStatus(base,true);
        return await res.json();
      }catch(err){ if(mockMode==='fallback' && mockData){ return { text: mockData.text || '(mock agent)', mocked:true }; } throw err; }
    }
    const res = await fetch(url,{ method:'POST', headers, body: JSON.stringify(body) });
    if(!res.ok || !res.body){ Agents.setAgentApiLastStatus(base,false); throw new Error('HTTP '+res.status); }
    Agents.setAgentApiLastStatus(base,true);
    const reader = res.body.getReader(); const dec = new TextDecoder(); let buf=''; let done=false;
    while(!done){ const {value, done:d}=await reader.read(); done=d; if(value) buf += dec.decode(value,{stream:true}); let idx; while((idx=buf.indexOf('\n\n'))!==-1){ const chunk=buf.slice(0,idx).trim(); buf=buf.slice(idx+2); if(!chunk.startsWith('data:')) continue; const raw=chunk.replace(/^data:\s*/,''); try{ const ev=JSON.parse(raw); if(ev.type==='meta' && onMeta) onMeta(ev); else if(ev.type==='tool' && onTool) onTool(ev); else if(ev.type==='text' && onText) onText(ev.text||''); }catch(_e){} } }
    return { ok:true };
  };

  window.SimuladorAgents = Agents;
})();
