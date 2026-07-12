// In-page reporting overlay (content script, injected on icon click).
// Flow: frozen screenshot fills the viewport → drag to crop (or F for full
// view) → annotate the crop (pen/box/arrow) → title/note/type/repo → file.
// UI only — all network happens in the background service worker.
(() => {
  if (window.__nanobots) { return; } // singleton per page; reopened via message
  window.__nanobots = true;

  let host = null;

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.kind !== 'nanobots-open') return;
    close();
    if (!msg.configured) {
      chrome.runtime.sendMessage({ kind: 'nanobots-open-options' });
      return;
    }
    open(msg);
  });

  const close = () => { host?.remove(); host = null; };

  function open(ctx) {
    host = document.createElement('nanobots-overlay');
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;';
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        :host { all: initial; }
        * { box-sizing: border-box; margin: 0; font: 13px/1.5 ui-monospace, Menlo, Consolas, monospace; }
        .veil { position: fixed; inset: 0; background: rgba(4,6,9,.55); cursor: crosshair; }
        .veil img { position: absolute; inset: 0; width: 100vw; height: 100vh; opacity: .45; }
        .selrect { position: absolute; border: 1.5px solid #4ade80; background: rgba(74,222,128,.08);
          box-shadow: 0 0 0 100000px rgba(4,6,9,.55); display: none; }
        .hintbar { position: fixed; top: 14px; left: 50%; transform: translateX(-50%);
          background: #11151b; color: #c9d1d9; border: 1px solid #1e242e; border-radius: 8px;
          padding: 8px 16px; }
        .hintbar b { color: #4ade80; }
        .panel { position: fixed; top: 3vh; left: 50%; transform: translateX(-50%);
          width: min(680px, 94vw); max-height: 94vh; overflow-y: auto; background: #0b0e12;
          border: 1px solid #1e242e; border-radius: 10px; padding: 16px; color: #c9d1d9; }
        .panel h1 { font-size: 14px; margin-bottom: 10px; } .panel h1 b { color: #4ade80; }
        .tools { display: flex; gap: 6px; margin-bottom: 8px; align-items: center; flex-wrap: wrap; }
        .dot { width: 18px; height: 18px; border-radius: 50%; padding: 0; border: 2px solid transparent; flex-shrink: 0; }
        .dot.on { border-color: #fff; }
        .canvas-wrap { position: relative; }
        .txtin { position: absolute; background: rgba(4,6,9,.6); border: 1px dashed currentColor;
          border-radius: 4px; padding: 2px 6px; font-weight: 700; outline: none; min-width: 60px; }
        button { background: #11151b; border: 1px solid #1e242e; color: #c9d1d9; border-radius: 6px;
          padding: 5px 12px; cursor: pointer; font: inherit; font-size: 12.5px; }
        button.on { border-color: #4ade80; color: #4ade80; }
        button.go { background: #4ade80; border: none; color: #05270f; font-weight: 700; padding: 9px 18px; }
        .spacer { flex: 1; }
        canvas { display: block; max-width: 100%; max-height: 44vh; width: auto; height: auto;
          border: 1px solid #1e242e; border-radius: 6px; cursor: crosshair; margin: 0 auto 10px; }
        input, textarea, select { width: 100%; background: #11151b; border: 1px solid #1e242e;
          color: #c9d1d9; border-radius: 6px; padding: 7px 9px; font: inherit; margin-bottom: 8px; }
        textarea { min-height: 56px; resize: vertical; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .status { min-height: 18px; margin-top: 6px; }
        .ok { color: #4ade80; } .err { color: #ef4444; }
        a { color: #22d3ee; }
      </style>`;

    if (ctx.shot && ctx.r2on) cropPhase(root, ctx);
    else panelPhase(root, ctx, null);

    host.tabIndex = -1;
    document.documentElement.appendChild(host);
    root.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    window.addEventListener('keydown', escOnce, { capture: true });
    function escOnce(e) {
      if (e.key === 'Escape' && host) { e.stopPropagation(); close(); window.removeEventListener('keydown', escOnce, { capture: true }); }
    }
  }

  // ── phase 1: crop ──────────────────────────────────────────────────────────

  function cropPhase(root, ctx) {
    const veil = document.createElement('div');
    veil.className = 'veil';
    veil.innerHTML = `<img src="${ctx.shot}"><div class="selrect"></div>
      <div class="hintbar"><b>drag</b> to select the region · <b>F</b> full view · <b>esc</b> cancel</div>`;
    root.appendChild(veil);
    const rect = veil.querySelector('.selrect');

    let start = null;
    const box = (a, b) => ({
      x: Math.min(a.x, b.x), y: Math.min(a.y, b.y),
      w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y),
    });
    veil.addEventListener('pointerdown', (e) => {
      start = { x: e.clientX, y: e.clientY };
      veil.setPointerCapture(e.pointerId);
    });
    veil.addEventListener('pointermove', (e) => {
      if (!start) return;
      const r = box(start, { x: e.clientX, y: e.clientY });
      Object.assign(rect.style, { display: 'block', left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
    });
    veil.addEventListener('pointerup', (e) => {
      const r = box(start, { x: e.clientX, y: e.clientY });
      start = null;
      if (r.w < 8 || r.h < 8) { rect.style.display = 'none'; return; } // stray click
      toCanvas(ctx.shot, r).then((cropped) => { veil.remove(); panelPhase(root, ctx, cropped); });
    });
    root.addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() === 'f' && veil.isConnected) {
        toCanvas(ctx.shot, null).then((full) => { veil.remove(); panelPhase(root, ctx, full); });
      }
    });
    veil.querySelector('img').ondragstart = () => false;
    setTimeout(() => host.focus(), 0);
  }

  // Crop rect is in CSS px; the bitmap is devicePixelRatio-scaled.
  function toCanvas(shot, r) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const sx = img.naturalWidth / window.innerWidth;
        const sy = img.naturalHeight / window.innerHeight;
        const c = document.createElement('canvas');
        if (r) { c.width = Math.round(r.w * sx); c.height = Math.round(r.h * sy); }
        else { c.width = img.naturalWidth; c.height = img.naturalHeight; }
        const g = c.getContext('2d');
        if (r) g.drawImage(img, r.x * sx, r.y * sy, c.width, c.height, 0, 0, c.width, c.height);
        else g.drawImage(img, 0, 0);
        resolve(c);
      };
      img.src = shot;
    });
  }

  // ── phase 2: annotate + file ───────────────────────────────────────────────

  function panelPhase(root, ctx, baseCanvas) {
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `
      <h1>report to nano<b>bots</b> <span style="color:#8b949e">— ${esc(ctx.title).slice(0, 60)}</span></h1>
      ${baseCanvas ? `
      <div class="tools">
        <button data-tool="pen" class="on">✏️ pen</button>
        <button data-tool="rect">▭ box</button>
        <button data-tool="arrow">↗ arrow</button>
        <button data-tool="text">T text</button>
        <button data-tool="select">⬚ select</button>
        <span class="spacer"></span>
        <button data-act="delsel" hidden>✕ delete</button>
        <button data-act="undo">undo</button>
        <button data-act="recrop">↺ recrop</button>
      </div>
      <div class="tools">
        ${['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7']
          .map((c, i) => `<button class="dot${i === 0 ? ' on' : ''}" data-color="${c}" style="background:${c}"></button>`).join('')}
        <span class="spacer"></span>
        <span style="color:#8b949e;font-size:11.5px">select a mark to delete or recolor it</span>
      </div>` : (ctx.shot ? '<div class="status">screenshots disabled — connect R2 in options to attach them</div>' : '')}
      <div class="canvas-slot canvas-wrap"></div>
      <input name="title" placeholder="title — short and specific" >
      <textarea name="note" placeholder="what happened / what you want — the loop triages from this"></textarea>
      <div class="grid">
        <select name="type"><option value="bug">bug</option><option value="idea">feature</option></select>
        <select name="repo">${ctx.repos.map((r) => `<option${r === ctx.lastRepo ? ' selected' : ''}>${esc(r)}</option>`).join('')}</select>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="go" data-act="file">file it</button>
        <button data-act="cancel">cancel</button>
        <span class="spacer"></span>
        <button data-act="page" data-page="history.html">history</button>
        <button data-act="page" data-page="chat.html">chat</button>
      </div>
      <div class="status"></div>`;
    root.appendChild(panel);

    // annotation layer — marks carry their own color; select to delete/recolor
    let strokes = [], current = null, tool = 'pen', color = '#ef4444', selected = -1;
    let canvas = null, g = null, bmp = null;
    const wrap = panel.querySelector('.canvas-slot');
    const delBtn = panel.querySelector('[data-act=delsel]');

    if (baseCanvas) {
      canvas = document.createElement('canvas');
      canvas.width = baseCanvas.width;
      canvas.height = baseCanvas.height;
      wrap.appendChild(canvas);
      g = canvas.getContext('2d');
      bmp = baseCanvas;
      redraw();
      canvas.addEventListener('pointerdown', (e) => {
        const [x, y] = pt(e);
        if (tool === 'select') {
          selected = hitTest(x, y);
          delBtn.hidden = selected < 0;
          redraw();
          return;
        }
        if (tool === 'text') { placeTextInput(e, x, y); return; }
        canvas.setPointerCapture(e.pointerId);
        current = tool === 'pen' ? { tool, color, points: [[x, y]] } : { tool, color, box: [x, y, x, y] };
      });
      canvas.addEventListener('pointermove', (e) => {
        if (!current) return;
        const [x, y] = pt(e);
        if (current.tool === 'pen') current.points.push([x, y]);
        else { current.box[2] = x; current.box[3] = y; }
        redraw();
      });
      canvas.addEventListener('pointerup', () => { if (current) strokes.push(current); current = null; redraw(); });
    }

    function pt(e) {
      const r = canvas.getBoundingClientRect();
      return [((e.clientX - r.left) / r.width) * canvas.width, ((e.clientY - r.top) / r.height) * canvas.height];
    }
    const lw = () => Math.max(3, canvas.width / 400);
    const fontPx = () => Math.max(16, Math.round(canvas.width / 28));

    function bounds(s) {
      if (s.tool === 'pen') {
        const xs = s.points.map((p) => p[0]), ys = s.points.map((p) => p[1]);
        return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
      }
      if (s.tool === 'text') {
        g.font = `bold ${s.size}px ui-sans-serif, system-ui`;
        return { x: s.x, y: s.y - s.size, w: g.measureText(s.text).width, h: s.size * 1.25 };
      }
      const [a, b, c2, d] = s.box;
      return { x: Math.min(a, c2), y: Math.min(b, d), w: Math.abs(c2 - a), h: Math.abs(d - b) };
    }

    function hitTest(x, y) {
      const thr = lw() * 3;
      for (let i = strokes.length - 1; i >= 0; i--) {
        const s = strokes[i];
        if (s.tool === 'pen') {
          if (s.points.some(([px, py]) => Math.hypot(px - x, py - y) < thr)) return i;
        } else if (s.tool === 'arrow') {
          const [a, b, c2, d] = s.box;
          const len2 = (c2 - a) ** 2 + (d - b) ** 2 || 1;
          const t = Math.max(0, Math.min(1, ((x - a) * (c2 - a) + (y - b) * (d - b)) / len2));
          if (Math.hypot(x - (a + t * (c2 - a)), y - (b + t * (d - b))) < thr) return i;
        } else {
          const r = bounds(s);
          if (x >= r.x - thr && x <= r.x + r.w + thr && y >= r.y - thr && y <= r.y + r.h + thr) return i;
        }
      }
      return -1;
    }

    function placeTextInput(e, x, y) {
      wrap.querySelector('.txtin')?.remove();
      const rect = canvas.getBoundingClientRect();
      const scale = rect.width / canvas.width;
      const inp = document.createElement('input');
      inp.className = 'txtin';
      inp.style.left = (x * scale) + 'px';
      inp.style.top = (y * scale) + 'px';
      inp.style.color = color;
      inp.style.font = `700 ${Math.max(12, fontPx() * scale)}px ui-sans-serif, system-ui`;
      wrap.appendChild(inp);
      setTimeout(() => inp.focus(), 0);
      const commit = () => {
        const text = inp.value.trim();
        inp.remove();
        if (text) { strokes.push({ tool: 'text', color, text, x, y: y + fontPx(), size: fontPx() }); redraw(); }
      };
      inp.addEventListener('keydown', (ev) => {
        ev.stopPropagation();
        if (ev.key === 'Enter') commit();
        if (ev.key === 'Escape') inp.remove();
      });
      inp.addEventListener('blur', commit);
    }

    function drawMark(s) {
      g.strokeStyle = g.fillStyle = s.color ?? '#ef4444';
      g.lineWidth = lw();
      g.lineCap = g.lineJoin = 'round';
      g.beginPath();
      if (s.tool === 'pen') { s.points.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); }
      else if (s.tool === 'rect') { const r = bounds(s); g.strokeRect(r.x, r.y, r.w, r.h); }
      else if (s.tool === 'text') { g.font = `bold ${s.size}px ui-sans-serif, system-ui`; g.fillText(s.text, s.x, s.y); }
      else { const [a, b, c2, d] = s.box; g.moveTo(a, b); g.lineTo(c2, d); g.stroke();
        const an = Math.atan2(d - b, c2 - a), h = g.lineWidth * 4;
        g.beginPath(); g.moveTo(c2, d);
        g.lineTo(c2 - h * Math.cos(an - 0.4), d - h * Math.sin(an - 0.4));
        g.lineTo(c2 - h * Math.cos(an + 0.4), d - h * Math.sin(an + 0.4));
        g.closePath(); g.fill(); }
    }

    function redraw() {
      g.setLineDash([]);
      g.drawImage(bmp, 0, 0);
      for (const s of [...strokes, current].filter(Boolean)) drawMark(s);
      if (selected >= 0 && strokes[selected]) {
        const r = bounds(strokes[selected]);
        const p = lw() * 2;
        g.setLineDash([6, 4]);
        g.strokeStyle = '#22d3ee';
        g.lineWidth = Math.max(1.5, lw() / 2);
        g.strokeRect(r.x - p, r.y - p, r.w + 2 * p, r.h + 2 * p);
        g.setLineDash([]);
      }
    }

    function removeSelected() {
      if (selected < 0) return;
      strokes.splice(selected, 1);
      selected = -1;
      delBtn.hidden = true;
      redraw();
    }

    root.addEventListener('keydown', (e) => {
      const t = e.composedPath()[0];
      if (t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA' || t?.tagName === 'SELECT') return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected >= 0) { e.preventDefault(); removeSelected(); }
    });

    panel.addEventListener('click', async (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.dataset.tool) {
        tool = btn.dataset.tool;
        if (tool !== 'select') { selected = -1; delBtn.hidden = true; redraw(); }
        panel.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('on', b === btn));
        if (canvas) canvas.style.cursor = tool === 'select' ? 'default' : (tool === 'text' ? 'text' : 'crosshair');
      }
      if (btn.dataset.color) {
        color = btn.dataset.color;
        panel.querySelectorAll('.dot').forEach((b) => b.classList.toggle('on', b === btn));
        if (selected >= 0 && strokes[selected]) { strokes[selected].color = color; redraw(); }
      }
      if (btn.dataset.act === 'delsel') removeSelected();
      if (btn.dataset.act === 'undo') { strokes.pop(); selected = -1; delBtn.hidden = true; redraw(); }
      if (btn.dataset.act === 'recrop') { panel.remove(); cropPhase(root, ctx); }
      if (btn.dataset.act === 'cancel') close();
      if (btn.dataset.act === 'page') chrome.runtime.sendMessage({ kind: 'nanobots-open-page', page: btn.dataset.page });
      if (btn.dataset.act === 'file') {
        const status = panel.querySelector('.status');
        const title = panel.querySelector('[name=title]').value;
        if (!title.trim()) { status.innerHTML = '<span class="err">title required</span>'; return; }
        btn.disabled = true;
        status.textContent = canvas ? 'uploading screenshot…' : 'filing…';
        const resp = await chrome.runtime.sendMessage({
          kind: 'nanobots-file',
          nwo: panel.querySelector('[name=repo]').value,
          title,
          note: panel.querySelector('[name=note]').value,
          type: panel.querySelector('[name=type]').value,
          image: canvas ? canvas.toDataURL('image/png') : null,
          page: ctx.url,
          pageTitle: ctx.title,
        });
        if (resp?.ok) {
          status.innerHTML = `<span class="ok">filed → <a href="${resp.url}" target="_blank" rel="noreferrer">#${resp.number}</a> — the loop takes it from here.</span>`;
          setTimeout(close, 4000);
        } else {
          status.innerHTML = `<span class="err">${esc(resp?.error ?? 'failed')}</span>`;
          btn.disabled = false;
        }
      }
    });
  }

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
})();
