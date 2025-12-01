(function(){
  // simulador-evaluator.js
  // Evaluador de expresiones: interpolación, evaluación básica de expresiones.
  if(typeof window === 'undefined') return;
  window.Simulador = window.Simulador || {};
  window.Simulador.evaluator = (function(){
    // Interpolación simple: reemplaza {{var}} por su valor en state.variables
    function interpolate(text, vars){
      if (!text || typeof text !== 'string') return text;
      return text.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_,expr) => {
        try {
          // normalize expression: trim and collapse spaces around dots ("item. plataforma" -> "item.plataforma")
          const key = expr.trim().replace(/\s*\.\s*/g, '.');
          // simple dotted path resolver: context.x or obj.prop.sub
          const simplePathRE = /^(?:context\.)?[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/;
          if (simplePathRE.test(key) && vars){
            const path = key.replace(/^context\./, '').trim();
            const parts = path.split('.').filter(Boolean);
            let val = vars;
            for (let p of parts){ if (val === undefined || val === null) { val = undefined; break; } val = val[p]; }
            if (val === undefined || val === null) return '';
            if (typeof val === 'object') return JSON.stringify(val);
            // use JSON.stringify for strings to preserve quotes and avoid breaking JSON contexts
            if (typeof val === 'string') return JSON.stringify(val).slice(1, -1);
            return String(val);
          }
          const v = evalExpr(key, vars);
          return v === null || v === undefined ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v));
        } catch(e){ return ''; }
      });
    }

    // Evaluador básico de expresiones (placeholder: implementar funciones LINQ-like aquí)
    function evalExpr(expr, vars){
      // Placeholder: un evaluador seguro debe implementarse aquí.
      // Por ahora, delegar a window.SimuladorCore si existe, o devolver expr cruda.
      try{
        if(window.Simulador && window.Simulador.core && typeof window.Simulador.core.evaluate === 'function'){
          return window.Simulador.core.evaluate(expr, vars);
        }
        console.warn('[SimuladorEvaluator] SimuladorCore.evaluate no disponible, devolviendo expresión cruda');
        return expr;
      }catch(e){ console.warn('[SimuladorEvaluator] Error en evalExpr:', e); return null; }
    }

    // Procesar texto con interpolación y Markdown (extraído de simulador.js)
    function looksLikeMarkdown(text){
      if(!text || typeof text !== 'string') return false;
      // common markdown markers: headings, bold/italic, code, lists, links, blockquotes
      const mdPatterns = [/^#{1,6}\s+/m, /\*\*.+\*\*/, /\*[^\s].+\*/, /`[^`]+`/, /^\s*-\s+/m, /\[[^\]]+\]\([^\)]+\)/, /^>\s+/m];
      for(const p of mdPatterns){ if(p.test(text)) return true; }
      // also treat strings that include paragraph tags as markup
      if(text.indexOf('<') !== -1 && text.indexOf('>') !== -1) return true;
      return false;
    }

    function processText(text, renderMarkdown = false) {
      if (!text || typeof text !== 'string') return text;
      const interpolated = interpolate(text, window.Simulador && window.Simulador.core ? window.Simulador.core.getRuntimeState().variables : {});
      if (renderMarkdown) {
        if (window.marked) {
          try{ return window.marked.parse(interpolated); }catch(e){ return interpolated; }
        }
        // fallback lightweight renderer
        try{ return renderMarkdownFallback(interpolated); }catch(e){ return interpolated; }
      }
      return interpolated;
    }

    // Lightweight Markdown fallback renderer
    function renderMarkdownFallback(md){
      if(!md || typeof md !== 'string') return md;
      // escape HTML first
      const esc = (s) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      // handle code fences ```lang\n...\n```
      md = md.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, function(_,lang,code){ return '<pre><code>' + esc(code) + '</code></pre>'; });
      // inline code
      md = md.replace(/`([^`]+)`/g, function(_,c){ return '<code>' + esc(c) + '</code>'; });
      // headings
      md = md.replace(/^######\s*(.*)$/gm, '<h6>$1</h6>');
      md = md.replace(/^#####\s*(.*)$/gm, '<h5>$1</h5>');
      md = md.replace(/^####\s*(.*)$/gm, '<h4>$1</h4>');
      md = md.replace(/^###\s*(.*)$/gm, '<h3>$1</h3>');
      md = md.replace(/^##\s*(.*)$/gm, '<h2>$1</h2>');
      md = md.replace(/^#\s*(.*)$/gm, '<h1>$1</h1>');
      // bold/italic/strikethrough
      md = md.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      md = md.replace(/__(.*?)__/g, '<strong>$1</strong>');
      md = md.replace(/\*(.*?)\*/g, '<em>$1</em>');
      md = md.replace(/_(.*?)_/g, '<em>$1</em>');
      md = md.replace(/~~(.*?)~~/g, '<del>$1</del>');
      // links [text](url)
      md = md.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function(_,text,url){
        const u = esc(url.trim());
        const t = esc(text);
        // allow only http(s), mailto or relative
        if(/^(https?:|mailto:|\/)/i.test(u)){
          return '<a href="' + u + '" target="_blank" rel="noopener noreferrer">' + t + '</a>';
        }
        return t;
      });
      // task lists and unordered lists
      // Convert lines starting with - [ ] or - [x]
      md = md.replace(/^\s*- \[x\]\s+(.*)$/gim, '<li><input type="checkbox" disabled checked> $1</li>');
      md = md.replace(/^\s*- \[ \]\s+(.*)$/gim, '<li><input type="checkbox" disabled> $1</li>');
      // unordered list
      md = md.replace(/(^|\n)\s*[-\*]\s+(.*)(?=\n|$)/g, function(_,prefix,item){ return (prefix||'') + '<li>' + item + '</li>'; });
      // wrap consecutive <li> into <ul>
      md = md.replace(/(<li>[\s\S]*?<\/li>)(\s*<li>)/g, function(_,a){ return a; });
      // simple approach: wrap blocks separated by blank line into paragraphs if they are not block tags
      const blocks = md.split(/\n\s*\n/);
      for(let i=0;i<blocks.length;i++){
        const b = blocks[i].trim();
        if(!b) { blocks[i] = ''; continue; }
        // if block already starts with block tag, keep
        if(/^<(h[1-6]|ul|ol|pre|blockquote|li|p|code)/i.test(b)) { blocks[i] = b; continue; }
        // if block contains <li> treat as list
        if(/<li>/.test(b)){
          // ensure it is wrapped
          blocks[i] = '<ul>' + b.replace(/(^|\n)\s*/g,'') + '</ul>';
          continue;
        }
        blocks[i] = '<p>' + b + '</p>';
      }
      return blocks.join('\n');
    }

    return { interpolate, evalExpr, processText, looksLikeMarkdown };
  })();
})();
