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

  // A small, deliberate celebration: filing is the whole point of this extension, and the
  // old behaviour was one line of text followed by four silent seconds.
  function burstConfetti(root) {
    const layer = document.createElement("div");
    layer.className = "confetti";
    const colors = ["#4ade80", "#22d3ee", "#f59e0b", "#ef4444", "#a78bfa", "#e6edf3"];
    for (let i = 0; i < 90; i++) {
      const bit = document.createElement("i");
      bit.style.left = `${Math.random() * 100}vw`;
      bit.style.top = `${8 + Math.random() * 22}vh`;
      bit.style.background = colors[i % colors.length];
      bit.style.setProperty("--dx", `${(Math.random() - 0.5) * 340}px`);
      bit.style.setProperty("--spin", `${(Math.random() - 0.5) * 1080}deg`);
      bit.style.setProperty("--dur", `${1100 + Math.random() * 900}ms`);
      bit.style.setProperty("--delay", `${Math.random() * 220}ms`);
      if (i % 3 === 0) bit.style.borderRadius = "50%";
      layer.appendChild(bit);
    }
    root.appendChild(layer);
    setTimeout(() => layer.remove(), 2400);
  }

  // Header drag. The panel is centred with a transform, which fights explicit positioning —
  // so the first drag pins it to its current pixel position and drops the transform.
  function makeDraggable(panel) {
    const bar = panel.querySelector("h1");
    if (!bar) return;
    let d = null;
    bar.addEventListener("pointerdown", (e) => {
      const r = panel.getBoundingClientRect();
      panel.style.transform = "none";
      panel.style.left = `${r.left}px`;
      panel.style.top = `${r.top}px`;
      d = { dx: e.clientX - r.left, dy: e.clientY - r.top, w: r.width };
      bar.classList.add("dragging");
      bar.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    bar.addEventListener("pointermove", (e) => {
      if (!d) return;
      // Always leave a strip on screen so the panel cannot be dragged out of reach.
      const maxL = window.innerWidth - 80, maxT = window.innerHeight - 40;
      panel.style.left = `${Math.max(80 - d.w, Math.min(maxL, e.clientX - d.dx))}px`;
      panel.style.top = `${Math.max(0, Math.min(maxT, e.clientY - d.dy))}px`;
    });
    const end = () => { d = null; bar.classList.remove("dragging"); };
    bar.addEventListener("pointerup", end);
    bar.addEventListener("pointercancel", end);
  }

  function open(ctx) {
    host = document.createElement('nanobots-overlay');
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;';
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        :host { all: initial; }
        * { box-sizing: border-box; margin: 0; font: 13px/1.5 ui-monospace, Menlo, Consolas, monospace; }
        .veil { position: fixed; inset: 0; background: rgba(2,3,5,.72); cursor: crosshair; }
        .veil img { position: absolute; inset: 0; width: 100vw; height: 100vh; opacity: .45; }
        .selrect { position: absolute; border: 1.5px solid #4ade80; background: rgba(74,222,128,.08);
          box-shadow: 0 0 0 100000px rgba(4,6,9,.55); display: none; }
        .hintbar { position: fixed; top: 14px; left: 50%; transform: translateX(-50%);
          background: #11151b; color: #c9d1d9; border: 1px solid #1e242e; border-radius: 8px;
          padding: 8px 16px; }
        .hintbar b { color: #4ade80; }
        /* Lighter than the page-dimming veil and lifted with a shadow, so the panel reads as
           a surface floating ABOVE the page rather than a hole cut into it. */
        .panel { position: fixed; top: 3vh; left: 50%; transform: translateX(-50%);
          width: min(1180px, 92vw); max-height: 94vh; overflow-y: auto; background: #1c2129;
          border: 1px solid #3d444d; border-radius: 12px; padding: 16px; color: #e6edf3;
          box-shadow: 0 18px 60px rgba(0,0,0,.62), 0 0 0 1px rgba(255,255,255,.04) inset; }
        /* The header is the drag handle — hence the grab cursor and the grip glyph. */
        .panel h1 { font-size: 14px; margin-bottom: 10px; cursor: grab; user-select: none;
          line-height: 1.45; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .panel h1.dragging { cursor: grabbing; }
        .panel h1 .grip { color: #6e7681; letter-spacing: -2px; font-size: 15px;
          margin-right: 8px; cursor: grab; }
        .panel h1 b { color: #4ade80; }
        .wsep { width: 1px; height: 18px; background: #30363d; margin: 0 8px; display: inline-block; }
        .wt { background: #0d1117; border: 1px solid #30363d; border-radius: 6px; width: 34px; height: 26px;
          display: inline-flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; }
        .wt.on { border-color: #4ade80; }
        .wt i { display: block; width: 18px; background: #c9d1d9; border-radius: 2px; }
        .wt.on i { background: #4ade80; }
        .panel input, .panel textarea, .panel select { background: #0d1117; border-color: #30363d; }
        /* Confetti: plain divs, no canvas and no dependency. Removed when the burst ends. */
        .confetti { position: fixed; inset: 0; pointer-events: none; overflow: hidden; z-index: 2147483647; }
        .confetti i { position: absolute; width: 9px; height: 14px; opacity: 0;
          animation: nb-fall var(--dur) cubic-bezier(.2,.6,.35,1) var(--delay) forwards; }
        @keyframes nb-fall {
          0%   { opacity: 1; transform: translate3d(0,0,0) rotate(0deg); }
          100% { opacity: 0; transform: translate3d(var(--dx), 78vh, 0) rotate(var(--spin)); }
        }
        .tools { display: flex; gap: 6px; margin-bottom: 8px; align-items: center; flex-wrap: wrap; }
        .dot { width: 18px; height: 18px; border-radius: 50%; padding: 0; border: 2px solid transparent; flex-shrink: 0; }
        .dot.on { border-color: #fff; }
        .canvas-wrap { position: relative; }
        .txtin { position: absolute; width: 8ch; margin: 0; background: rgba(4,6,9,.6);
          border: 1px dashed currentColor; border-radius: 4px; padding: 1px 6px;
          font-weight: 700; outline: none; }
        button { background: #11151b; border: 1px solid #1e242e; color: #c9d1d9; border-radius: 6px;
          padding: 5px 12px; cursor: pointer; font: inherit; font-size: 12.5px; }
        button.on { border-color: #4ade80; color: #4ade80; }
        button.go { background: #4ade80; border: none; color: #05270f; font-weight: 700; padding: 9px 18px; }
        .spacer { flex: 1; }
        canvas { display: block; max-width: 100%; max-height: 58vh; width: auto; height: auto;
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
      <h1><span class="grip">⠿</span>report to nano<b>bots</b> <span style="color:#8b949e">— ${esc(ctx.title).slice(0, 60)}</span></h1>
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
        <span class="wsep"></span>
        ${[1, 2, 3].map((w) => `<button class="wt${w === 2 ? ' on' : ''}" data-weight="${w}" title="${['fine','medium','bold'][w-1]}"><i style="height:${w * 2 + 1}px"></i></button>`).join('')}
        <span class="spacer"></span>
        <span style="color:#8b949e;font-size:11.5px">select: drag to move · corners resize · knob rotates (pen/arrow) · ⌘C/⌘V duplicate · del removes · swatch recolors</span>
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
    makeDraggable(panel);

    // annotation layer — marks carry their own color; select to delete/recolor
    let strokes = [], current = null, tool = 'pen', color = '#ef4444', selected = -1;
    // 1 = fine, 2 = medium (default), 3 = bold. Marks capture their weight when drawn so a
    // later change to the picker never rewrites existing annotations.
    let weight = 2;
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
      let drag = null; // { start: [x,y], orig: snapshot of the selected mark }
      canvas.addEventListener('pointerdown', (e) => {
        const [x, y] = pt(e);
        if (tool === 'select') {
          // A handle on the CURRENT selection takes precedence over selecting something else.
          const handle = hitHandle(x, y);
          if (handle) {
            const r = bounds(strokes[selected]);
            const hs = handlesFor(r);
            const opposite = { nw: 'se', ne: 'sw', sw: 'ne', se: 'nw' }[handle];
            drag = {
              mode: handle === 'rot' ? 'rotate' : 'resize',
              start: [x, y],
              orig: structuredClone(strokes[selected]),
              anchor: opposite ? hs[opposite] : null,
              center: [r.x + r.w / 2, r.y + r.h / 2],
            };
            canvas.setPointerCapture(e.pointerId);
            canvas.style.cursor = handle === 'rot' ? 'grabbing' : 'nwse-resize';
            return;
          }
          selected = hitTest(x, y);
          delBtn.hidden = selected < 0;
          if (selected >= 0) {
            drag = { mode: 'move', start: [x, y], orig: structuredClone(strokes[selected]) };
            canvas.setPointerCapture(e.pointerId);
            canvas.style.cursor = 'move';
          }
          redraw();
          return;
        }
        if (tool === 'text') { placeTextInput(e, x, y); return; }
        canvas.setPointerCapture(e.pointerId);
        current = tool === 'pen' ? { tool, color, weight, points: [[x, y]] } : { tool, color, weight, box: [x, y, x, y] };
      });
      canvas.addEventListener('pointermove', (e) => {
        const [x, y] = pt(e);
        if (drag && selected >= 0) {
          if (drag.mode === 'resize') {
            const [ax, ay] = drag.anchor;
            const w0 = drag.start[0] - ax, h0 = drag.start[1] - ay;
            // A zero-width start would divide by zero; fall back to 1:1 on that axis.
            const sx = Math.abs(w0) < 1e-6 ? 1 : (x - ax) / w0;
            const sy = Math.abs(h0) < 1e-6 ? 1 : (y - ay) / h0;
            // Clamp so a mark cannot be flipped inside-out or collapsed to nothing.
            const cl = (v) => (Math.abs(v) < 0.05 ? 0.05 * Math.sign(v || 1) : v);
            strokes[selected] = scaled(drag.orig, ax, ay, cl(sx), cl(sy));
          } else if (drag.mode === 'rotate') {
            const [cx, cy] = drag.center;
            const a0 = Math.atan2(drag.start[1] - cy, drag.start[0] - cx);
            const a1 = Math.atan2(y - cy, x - cx);
            strokes[selected] = rotated(drag.orig, cx, cy, a1 - a0);
          } else {
            strokes[selected] = translated(drag.orig, x - drag.start[0], y - drag.start[1]);
          }
          redraw();
          return;
        }
        // Hover feedback so the handles read as grabbable.
        if (!current && tool === 'select') {
          const h = hitHandle(x, y);
          canvas.style.cursor = h === 'rot' ? 'grab' : h ? 'nwse-resize' : (hitTest(x, y) >= 0 ? 'move' : 'default');
        }
        if (!current) return;
        if (current.tool === 'pen') current.points.push([x, y]);
        else { current.box[2] = x; current.box[3] = y; }
        redraw();
      });
      canvas.addEventListener('pointerup', () => {
        if (drag) { drag = null; canvas.style.cursor = 'default'; return; }
        if (current) strokes.push(current);
        current = null;
        redraw();
      });
    }

    function pt(e) {
      const r = canvas.getBoundingClientRect();
      return [((e.clientX - r.left) / r.width) * canvas.width, ((e.clientY - r.top) / r.height) * canvas.height];
    }
    // Base stroke, scaled by the chosen weight. The old value (canvas.width/400, min 3) was
    // the "fine" end; medium is now the default because annotations sit on top of dense UI
    // screenshots and a hairline disappears into them.
    const WEIGHTS = { 1: 1, 2: 1.75, 3: 2.75 };
    const lw = (w) => Math.max(3, canvas.width / 400) * (WEIGHTS[w ?? weight] ?? 1.75);
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
      // keep the input on-canvas and grow it with the content
      inp.style.left = Math.min(x * scale, rect.width - 90) + 'px';
      inp.style.top = Math.min(y * scale, rect.height - 28) + 'px';
      inp.style.color = color;
      inp.style.font = `700 ${Math.max(12, fontPx() * scale)}px ui-sans-serif, system-ui`;
      inp.addEventListener('input', () => { inp.style.width = Math.max(8, inp.value.length + 2) + 'ch'; });
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
      g.lineWidth = lw(s.weight);
      g.lineCap = g.lineJoin = 'round';
      g.beginPath();
      if (s.tool === 'pen') { s.points.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); }
      else if (s.tool === 'rect') { const r = bounds(s); g.strokeRect(r.x, r.y, r.w, r.h); }
      else if (s.tool === 'text') { g.font = `bold ${s.size}px ui-sans-serif, system-ui`; g.fillText(s.text, s.x, s.y); }
      else {
        // shaft stops at the head's base so the round line cap never pokes
        // through the tip; only the filled triangle forms the point
        const [a, b, c2, d] = s.box;
        const an = Math.atan2(d - b, c2 - a);
        const h = g.lineWidth * 4.2;                 // head length
        // Where the shaft stops and the head begins.
        const bx = c2 - h * Math.cos(an), by = d - h * Math.sin(an);
        // Perpendicular unit vector, used to give the shaft its two edges.
        const px = -Math.sin(an), py = Math.cos(an);
        const tailW = g.lineWidth * 0.28;            // nearly a point at the tail
        const baseW = g.lineWidth * 0.95;            // full weight where it meets the head
        // One filled polygon: tail edge → base edge → back, so the taper is continuous.
        g.beginPath();
        g.moveTo(a + px * tailW, b + py * tailW);
        g.lineTo(bx + px * baseW, by + py * baseW);
        g.lineTo(bx - px * baseW, by - py * baseW);
        g.lineTo(a - px * tailW, b - py * tailW);
        g.closePath();
        g.fill();
        // Head, slightly wider than the shaft base so the silhouette stays a clear arrow.
        g.beginPath();
        g.moveTo(c2, d);
        g.lineTo(c2 - h * 1.1 * Math.cos(an - 0.34), d - h * 1.1 * Math.sin(an - 0.34));
        g.lineTo(c2 - h * 1.1 * Math.cos(an + 0.34), d - h * 1.1 * Math.sin(an + 0.34));
        g.closePath();
        g.fill();
      }
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
        const hs = handlesFor(r);
        const hr = handleRadius();
        g.fillStyle = '#22d3ee';
        for (const [name, [hx, hy]] of Object.entries(hs)) {
          if (name === 'rot') {
            if (!rotatable(strokes[selected])) continue;
            g.beginPath();
            g.moveTo((hs.nw[0] + hs.ne[0]) / 2, hs.nw[1]);
            g.lineTo(hx, hy);
            g.stroke();
            g.beginPath();
            g.arc(hx, hy, hr * 0.8, 0, Math.PI * 2);
            g.fill();
          } else {
            g.fillRect(hx - hr / 2, hy - hr / 2, hr, hr);
          }
        }
      }
    }

    // Every mark is a vector — pen is a point list, text an anchor, rect/arrow two corners —
    // so a single point-mapper expresses move, resize and rotate for all of them.
    function mapPoints(s, fn) {
      const c = structuredClone(s);
      if (c.tool === 'pen') c.points = c.points.map(([px, py]) => fn(px, py));
      else if (c.tool === 'text') { [c.x, c.y] = fn(c.x, c.y); }
      else {
        const [x1, y1] = fn(c.box[0], c.box[1]);
        const [x2, y2] = fn(c.box[2], c.box[3]);
        c.box = [x1, y1, x2, y2];
      }
      return c;
    }

    function translated(s, dx, dy) {
      return mapPoints(s, (px, py) => [px + dx, py + dy]);
    }

    // Scale about a fixed anchor (the corner opposite the one being dragged) so that corner
    // stays put. Text has no width of its own to stretch, so its font size rides the larger
    // axis instead of distorting.
    function scaled(s, ax, ay, sx, sy) {
      const c = mapPoints(s, (px, py) => [ax + (px - ax) * sx, ay + (py - ay) * sy]);
      if (c.tool === 'text') c.size = Math.max(8, Math.round(c.size * Math.max(Math.abs(sx), Math.abs(sy))));
      return c;
    }

    // Rotation is exact for pen and arrow, because their geometry IS their points. A rect
    // stored as two corners cannot express rotation without a separate angle field, and text
    // would need the same — so the rotate knob is offered only where it is honest.
    function rotatable(s) { return Boolean(s) && (s.tool === 'pen' || s.tool === 'arrow'); }

    function rotated(s, cx, cy, ang) {
      const cos = Math.cos(ang), sin = Math.sin(ang);
      return mapPoints(s, (px, py) => {
        const dx = px - cx, dy = py - cy;
        return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
      });
    }

    // Four corners resize; a knob above rotates. Sized in canvas units so the targets stay
    // grabbable on a high-DPI screenshot.
    function handleRadius() { return Math.max(7, lw() * 2.2); }
    function handlesFor(r) {
      const p = lw() * 2;
      const x1 = r.x - p, y1 = r.y - p, x2 = r.x + r.w + p, y2 = r.y + r.h + p;
      return {
        nw: [x1, y1], ne: [x2, y1], sw: [x1, y2], se: [x2, y2],
        rot: [(x1 + x2) / 2, y1 - Math.max(22, lw() * 6)],
      };
    }
    // Checked BEFORE mark hit-testing, so a handle overlapping another mark still wins.
    function hitHandle(x, y) {
      if (selected < 0 || !strokes[selected]) return null;
      const hs = handlesFor(bounds(strokes[selected]));
      const rr = handleRadius() * 1.7;
      for (const [name, [hx, hy]] of Object.entries(hs)) {
        if (name === 'rot' && !rotatable(strokes[selected])) continue;
        if (Math.abs(x - hx) <= rr && Math.abs(y - hy) <= rr) return name;
      }
      return null;
    }

    function removeSelected() {
      if (selected < 0) return;
      strokes.splice(selected, 1);
      selected = -1;
      delBtn.hidden = true;
      redraw();
    }

    // Window-level capture: the canvas isn't focusable, so key events never
    // enter the shadow tree — catch them before the page does. The handler
    // detaches itself when this panel is gone (close or recrop).
    let clipboardMark = null;
    const keyHandler = (e) => {
      if (!panel.isConnected) { window.removeEventListener('keydown', keyHandler, true); return; }
      const t = e.composedPath()[0];
      if (t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA' || t?.tagName === 'SELECT') return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected >= 0) {
        e.preventDefault(); e.stopPropagation();
        removeSelected();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'c' && selected >= 0 && strokes[selected]) {
        e.preventDefault(); e.stopPropagation();
        clipboardMark = structuredClone(strokes[selected]);
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'v' && clipboardMark && canvas) {
        e.preventDefault(); e.stopPropagation();
        const off = Math.max(14, canvas.width / 50);
        strokes.push(translated(clipboardMark, off, off));
        selected = strokes.length - 1;
        delBtn.hidden = false;
        redraw();
      }
    };
    window.addEventListener('keydown', keyHandler, true);

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
      if (btn.dataset.weight) {
        weight = Number(btn.dataset.weight);
        panel.querySelectorAll('.wt').forEach((b) => b.classList.toggle('on', b === btn));
        // Match the swatch behaviour: a change applies to whatever is selected right now.
        if (selected >= 0 && strokes[selected]) { strokes[selected].weight = weight; redraw(); }
        return;
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
        burstConfetti(root);
          status.innerHTML = `<span class="ok">filed → <a href="${resp.url}" target="_blank" rel="noreferrer">#${resp.number}</a> — the loop takes it from here.</span>`;
          setTimeout(close, 1800);   // confetti runs ~2s; close as it settles
        } else {
          status.innerHTML = `<span class="err">${esc(resp?.error ?? 'failed')}</span>`;
          btn.disabled = false;
        }
      }
    });
  }

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
})();
