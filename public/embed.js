/* eslint-env browser, es2020 */
/* eslint no-empty: ["error", { "allowEmptyCatch": true }] */

(function () {
  // ---------- single mount guard ----------
  if (window.__in60Mounted) return;
  window.__in60Mounted = true;

  // ---------- script + config ----------
  var scriptEl = document.currentScript;
  if (!scriptEl) return;

  var botId =
    scriptEl.getAttribute('data-bot-id') ||
    scriptEl.getAttribute('data-user');
  if (!botId) return;

  var srcUrl; try { srcUrl = new window.URL(scriptEl.src, window.location.href); } catch { /* no-op */ }
  var origin = (srcUrl && srcUrl.origin) || window.location.origin;

  // Stacking: keep bubble above panel
  var zIndexStr = scriptEl.getAttribute('data-z') || '2147483647';
  var Z = parseInt(zIndexStr, 10) || 2147483646;
  var Z_BUBBLE = Z;                  // bubble on top
  var Z_PANEL  = Math.max(0, Z - 1); // panel just below bubble

  var panelWidth  = scriptEl.getAttribute('data-width')  || '380px';
  var panelHeight = scriptEl.getAttribute('data-height') || '600px';
  var bottom      = scriptEl.getAttribute('data-bottom') || '20px';
  var right       = scriptEl.getAttribute('data-right')  || '20px';
  var position    = (scriptEl.getAttribute('data-position') || 'bottom-right').toLowerCase();
  var bubbleColor = scriptEl.getAttribute('data-bubble-color') || '#2563eb';
  var bubbleText  = scriptEl.getAttribute('data-bubble-text') || '';
  var openOnLoad  = (scriptEl.getAttribute('data-open') || '').toLowerCase() === 'true';

  var isLeft  = position.includes('left');
  var posXKey = isLeft ? 'left' : 'right';
  var posXVal = isLeft ? (scriptEl.getAttribute('data-left') || '20px') : right;

  // ---------- state ----------
  var container   = null;
  var panelIframe = null;
  var bubble      = null;
  var styleTag    = null;
  var mo          = null;
  var isOpen      = false;
  var killTimer   = null; // watchdog interval id

  // ---------- styles ----------
  function injectStyle() {
    if (styleTag) return;
    styleTag = document.createElement('style');
    styleTag.id = 'in60-style-' + botId;
    styleTag.textContent = `
      /* Invisible container (no bg/radius/shadow); below bubble */
      #in60-container-${botId} { all: initial; }
      #in60-container-${botId} {
        position: fixed !important;
        inset: auto !important;
        bottom: ${bottom} !important;
        ${posXKey}: ${posXVal} !important;
        width: ${panelWidth} !important;
        height: ${panelHeight} !important;
        z-index: ${Z_PANEL} !important;
        margin: 0 !important; padding: 0 !important; border: 0 !important;
        background: transparent !important;
        pointer-events: auto !important;
      }

      /* Iframe carries visuals; positioned so stacking works */
      #in60-iframe-${botId} {
        position: relative !important;
        z-index: 0 !important;
        display: block !important;
        width: 100% !important; height: 100% !important;
        border: 0 !important; background: transparent !important;
        border-radius: 16px !important; overflow: hidden !important;
        filter: drop-shadow(0 10px 30px rgba(0,0,0,.15)) !important;
        pointer-events: auto !important;
      }

      /* Bubble (on top of panel/iframe) */
      #in60-bubble-${botId} {
        position: fixed !important;
        bottom: ${bottom} !important;
        ${posXKey}: ${posXVal} !important;
        width: 56px !important; height: 56px !important;
        border-radius: 9999px !important;
        background: ${bubbleColor} !important; color: #fff !important;
        display: flex !important; align-items: center !important; justify-content: center !important;
        font: 500 14px/1 system-ui,-apple-system,Segoe UI,Roboto,sans-serif !important;
        cursor: pointer !important; z-index: ${Z_BUBBLE} !important;
        box-shadow: 0 10px 30px rgba(0,0,0,.2) !important; user-select: none !important;
        transition: transform .12s, opacity .15s !important;
        pointer-events: auto !important; touch-action: manipulation !important;
        will-change: transform, opacity !important;
        isolation: isolate !important; /* own stacking context */
      }
      #in60-bubble-${botId}:hover { transform: translateY(-1px) scale(1.02); }
      #in60-bubble-${botId} svg { width: 24px; height: 24px; display:block; }

      /* Optional label */
      #in60-bubble-text-${botId} {
        position: fixed !important;
        bottom: calc(${bottom} + 8px) !important;
        ${posXKey}: calc(${posXVal} + 64px) !important;
        background: #111827 !important; color: #fff !important;
        padding: 8px 10px !important; border-radius: 10px !important;
        font: 500 13px/1.2 system-ui,-apple-system,Segoe UI,Roboto,sans-serif !important;
        box-shadow: 0 6px 18px rgba(0,0,0,.2) !important;
        max-width: 220px !important; z-index: ${Z_BUBBLE} !important; display: none !important;
        pointer-events: none !important;
      }

      /* Inside iframe document must be transparent */
      html, body, #__next { background: transparent !important; }
      html, body { margin: 0 !important; padding: 0 !important; }
    `;
    document.head.appendChild(styleTag);
  }

  // ---------- builders ----------
  function createContainer() {
    if (container) return container;
    container = document.createElement('div');
    container.id = 'in60-container-' + botId;
    container.style.position = 'fixed';
    container.style.bottom = bottom;
    container.style[posXKey] = posXVal;
    container.style.width = panelWidth;
    container.style.height = panelHeight;
    container.style.zIndex = String(Z_PANEL);
    container.style.margin = '0';
    container.style.padding = '0';
    container.style.border = '0';
    container.style.background = 'transparent';
    document.body.appendChild(container);
    return container;
  }

  function createPanelIframe() {
    if (panelIframe) return panelIframe;
    panelIframe = document.createElement('iframe');
    panelIframe.id = 'in60-iframe-' + botId;
    panelIframe.title = 'In60second Assistant';
    panelIframe.allow = 'clipboard-read; clipboard-write';
    panelIframe.setAttribute('frameborder', '0');
    panelIframe.setAttribute('allowtransparency', 'true');
    panelIframe.style.background = 'transparent';
    panelIframe.style.border = '0';
    panelIframe.style.display = 'block';
    panelIframe.style.opacity = '0';
    panelIframe.style.pointerEvents = 'auto';
    panelIframe.onload = function () {
      panelIframe.style.transition = 'opacity .15s ease';
      panelIframe.style.opacity = '1';
    };
    panelIframe.src = origin + '/embed/bot?id=' + encodeURIComponent(botId);
    return panelIframe;
  }

  function createBubble() {
    if (bubble && bubble.nodeType === 1) return bubble;
    var btn = document.createElement('div');
    btn.id = 'in60-bubble-' + botId;
    btn.setAttribute('role', 'button');
    btn.setAttribute('tabindex', '0');
    btn.setAttribute('aria-label', 'Open chat');
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M21 12a8.5 8.5 0 1 1-3.1-6.6l.1.1A8.1 8.1 0 0 1 21 12ZM7.5 13h9M7.5 10h9"
              stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      </svg>`;
    document.body.appendChild(btn);
    bubble = btn;
    bindBubbleHandlers();

    if (bubbleText) {
      var label = document.createElement('div');
      label.id = 'in60-bubble-text-' + botId;
      label.textContent = bubbleText;
      label.style.zIndex = String(Z_BUBBLE);
      document.body.appendChild(label);
      window.setTimeout(function(){ label.style.display='block'; }, 50);
      window.setTimeout(function(){ label.style.display='none'; }, 3000);
    }
    return bubble;
  }

  function bindBubbleHandlers() {
    if (!bubble) return;
    // Remove any previous listeners to avoid duplicates (safe idempotent)
    bubble.onclick = null;
    bubble.onpointerdown = null;

    // capture:true so global interceptors can’t swallow it
    const open = function(e){
      try { e && (e.preventDefault(), e.stopPropagation(), e.stopImmediatePropagation && e.stopImmediatePropagation()); } catch { /* no-op */ }
      openPanel();
    };
    bubble.addEventListener('click', open, { capture: true });
    bubble.addEventListener('pointerdown', open, { capture: true });
    bubble.addEventListener('touchstart', function(e){ e.preventDefault(); openPanel(e); }, { capture: true, passive: false });

    // Make absolutely sure it can receive the click
    bubble.style.zIndex = String(Z_BUBBLE);
    bubble.style.pointerEvents = 'auto';
    bubble.style.touchAction = 'manipulation';
  }

  // ---------- helpers ----------
  function applyResponsive() {
    if (!container) return;
    var isMobile = Math.min(window.innerWidth, window.innerHeight) < 500;
    container.style.width  = isMobile ? '100vw' : panelWidth;
    container.style.height = isMobile ? '100vh' : panelHeight;
    container.style.bottom = isMobile ? '0' : bottom;
    container.style[posXKey] = isMobile ? '0' : posXVal;
    if (panelIframe) {
      panelIframe.style.width  = '100%';
      panelIframe.style.height = '100%';
    }
  }

  function killOverlays() {
    // remove ANY in60 iframe while closed (safety)
    var all = document.querySelectorAll('iframe[id^="in60-iframe-"]');
    all.forEach(function (el) {
      if (!isOpen) {
        try { el.style.pointerEvents = 'none'; el.style.display = 'none'; el.remove(); } catch { /* no-op */ }
      }
    });
  }

  function ensureBubble() {
    // Always ensure CSS is present (after close/HMR it may be gone)
    injectStyle();

    // Create bubble if missing
    if (!bubble || !bubble.isConnected) createBubble();

    // Hard de-dup: keep only this instance’s nodes
    document.querySelectorAll('div[id^="in60-bubble-"]').forEach(function (el) { if (el !== bubble) { try { el.remove(); } catch { /* no-op */ } }});
    document.querySelectorAll('div[id^="in60-container-"]').forEach(function (el) { if (el.id !== 'in60-container-' + botId) { try { el.remove(); } catch { /* no-op */ } }});
    document.querySelectorAll('iframe[id^="in60-iframe-"]').forEach(function (el) { if (el.id !== 'in60-iframe-' + botId) { try { el.remove(); } catch { /* no-op */ } }});

    // Make sure bubble is visible & sized even if styles blinked
    Object.assign(bubble.style, {
      width: '56px',
      height: '56px',
      display: 'flex',
      opacity: '1',
      pointerEvents: 'auto',
      zIndex: String(Z_BUBBLE),
      touchAction: 'manipulation',
    });

    // Rebind handlers every time (HMR/DOM swap safe)
    bindBubbleHandlers();

    // Keep last in body so it wins static stacking order
    if (bubble !== document.body.lastElementChild) document.body.appendChild(bubble);

    // While closed, keep area clean of any stray iframes
    if (!isOpen && !killTimer) {
      killOverlays();
      killTimer = window.setInterval(killOverlays, 200);
      window.setTimeout(function(){ window.clearInterval(killTimer); killTimer = null; }, 5000);
    }
  }

  function hideBubble() {
    if (bubble) {
      bubble.style.opacity = '0';
      bubble.style.display = 'none';
      bubble.style.pointerEvents = 'none';
    }
    if (killTimer) { window.clearInterval(killTimer); killTimer = null; }
  }

  function scrubStrays() {
    var stray = document.getElementById('in60-iframe-' + botId);
    if (stray) { try { stray.remove(); } catch { /* no-op */ } }
  }

  // ---------- lifecycle ----------
  function openPanel(e) {
    if (e) { try { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation && e.stopImmediatePropagation(); } catch { /* no-op */ } }

    // Stuck-open recovery: if isOpen but iframe is gone, treat as closed
    if (isOpen) {
      var live = document.getElementById('in60-iframe-' + botId);
      if (!live) { isOpen = false; } else { return; }
    }

    injectStyle();
    hideBubble();

    var host = createContainer();
    host.style.zIndex = String(Z_PANEL); // keep under bubble

    var iframe = createPanelIframe();
    iframe.style.pointerEvents = 'auto';
    iframe.style.display = 'block';

    if (!iframe.isConnected) host.appendChild(iframe);
    applyResponsive();
    isOpen = true;
  }

  function closePanel() {
    if (!isOpen) { ensureBubble(); return; }
    isOpen = false;

    try {
      if (panelIframe) {
        try { panelIframe.style.pointerEvents = 'none'; panelIframe.style.display = 'none'; panelIframe.style.opacity = '0'; } catch { /* no-op */ }
        try { panelIframe.remove(); } catch { /* no-op */ }
        panelIframe = null;
      }

      if (container) {
        try {
          container.style.width = '0px';
          container.style.height = '0px';
          container.style.margin = '0';
          container.style.padding = '0';
          container.style.border = '0';
          container.style.background = 'transparent';
        } catch { /* no-op */ }
        try { container.remove(); } catch { /* no-op */ }
        container = null;
      }

      if (mo) { try { mo.disconnect(); } catch { /* no-op */ } mo = null; }
    } finally {
      ensureBubble();           // bring bubble back AND rebind handlers
      window.setTimeout(scrubStrays, 0);
      window.setTimeout(scrubStrays, 120);
      window.setTimeout(scrubStrays, 400);
    }
  }

  function destroy() {
    closePanel();
    try { if (bubble) bubble.remove(); } catch { /* no-op */ }
    bubble = null;
    window.__in60Mounted = false;
    delete window.In60;
  }

  // ---------- observers & events ----------
  function startObserver() {
    if (mo || !('MutationObserver' in window)) return;
    mo = new window.MutationObserver(function () {
      if (container && !document.body.contains(container)) { try { container.remove(); } catch { /* no-op */ } container = null; }
      if (panelIframe && container && !container.contains(panelIframe)) { try { panelIframe.remove(); } catch { /* no-op */ } panelIframe = null; }
      if (!isOpen && (!bubble || !document.body.contains(bubble))) { ensureBubble(); }
      if (!isOpen) killOverlays();
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  // Delegated activation (capture) + hard stop (kept for safety)
  function onDocActivate(e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var b = t.closest('#in60-bubble-' + botId);
    if (!b) return;
    try { e.preventDefault(); e.stopPropagation(); if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation(); } catch { /* no-op */ }
    openPanel();
  }

  // Geometric hitbox fallback
  function onHitbox(e) {
    if (!bubble || window.getComputedStyle(bubble).display === 'none' || window.getComputedStyle(bubble).opacity === '0') return;
    var r = bubble.getBoundingClientRect();
    var x = e.clientX, y = e.clientY;
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
      try { e.preventDefault(); e.stopPropagation(); if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation(); } catch { /* no-op */ }
      openPanel();
    }
  }

  function onMessage(e){ if(!e||!e.data)return;
    if(e.data.type==='in60:close') closePanel();
    if(e.data.type==='in60:open')  openPanel();
    if(e.data.type==='in60:destroy') destroy();
  }
  function onResize(){ applyResponsive(); ensureBubble(); }
  function onKeydown(e){ if(e && e.key==='Escape') closePanel(); }
  function onPageHide(){ destroy(); }
  function onBeforeUnload(){ destroy(); }

  // ---------- public API ----------
  window.In60 = {
    open: openPanel,
    close: closePanel,
    destroy: destroy,
    ensureBubble: ensureBubble,
    isOpen: function(){ return !!isOpen; }
  };

  // ---------- mount ----------
  injectStyle();
  ensureBubble();              // bubble visible by default (closed state)
  if (openOnLoad) openPanel(); // optional open on load
  startObserver();

  // ---------- listeners ----------
  ['click','pointerdown','pointerup','mousedown','mouseup','touchstart','touchend']
    .forEach(function(evt){ document.addEventListener(evt, onDocActivate, true); }); // capture

  ['click','pointerdown','pointerup','mousedown','mouseup','touchstart','touchend']
    .forEach(function(evt){ document.addEventListener(evt, onHitbox, true); });

  window.addEventListener('message', onMessage);
  window.addEventListener('resize', onResize, { passive: true });
  window.addEventListener('scroll', ensureBubble, { passive: true });
  window.addEventListener('keydown', onKeydown);

  // In dev, hot-reload can trigger pagehide/beforeunload; keep bubble alive on localhost
  var isLocal = /(^localhost$)|(^127\.0\.0\.1$)/.test(window.location.hostname);
  if (!isLocal) {
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('beforeunload', onBeforeUnload);
  } else {
    // lift above Next/Turbopack badge
    const lift = function(){ if (bubble) bubble.style.bottom = '80px'; };
    window.setTimeout(lift, 0);
    window.addEventListener('resize', lift, { passive: true });
  }
})();
