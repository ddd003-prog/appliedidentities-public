/* WEBAMB widget: self-contained chat launcher for appliedidentities.com.
 * Embed:
 *   <script src="/js/ambassador.js" defer
 *           data-endpoint="/api/ambassador"
 *           data-agent-name="Verity"
 *           data-verify-url="https://agents.appliedidentities.com/registry"
 *           data-turnstile-sitekey="..."
 *           data-greeting="..."></script>
 * No frameworks, no external requests except the chat endpoint and Turnstile.
 * House rule: no em dashes in any visitor-facing string.
 */
(function () {
  'use strict';

  var script = document.currentScript;
  var cfg = {
    endpoint: (script && script.dataset.endpoint) || '/api/ambassador',
    agentName: (script && script.dataset.agentName) || 'Verity',
    verifyUrl: (script && script.dataset.verifyUrl) || 'https://agents.appliedidentities.com/registry',
    turnstileSitekey: (script && script.dataset.turnstileSitekey) || '',
    greeting:
      (script && script.dataset.greeting) ||
      'Hi, I am {name}, the Applied Identities ambassador. I am an AI agent with a verified identity and a public behavioral record. Ask me what we build, how agent governance works, or why my tool permissions are nearly empty on purpose.',
  };
  cfg.greeting = cfg.greeting.replace('{name}', cfg.agentName);

  var THINKING_LINES = [
    'Thinking. This can take 10 to 20 seconds.',
    'Still thinking. Governed agents check their permissions before they speak.',
    'Almost there. Thanks for your patience.',
  ];

  var css =
    ':root{--wa-bg:#fff;--wa-fg:#111;--wa-muted:#667;--wa-border:#d8dce2;--wa-accent:#1a56db;--wa-accent-fg:#fff;--wa-me:#eef2f8;}' +
    '@media(prefers-color-scheme:dark){:root{--wa-bg:#15181d;--wa-fg:#e8eaee;--wa-muted:#98a0ab;--wa-border:#2c323b;--wa-accent:#4d82f3;--wa-accent-fg:#fff;--wa-me:#232932;}}' +
    '.wa-launch{position:fixed;right:20px;bottom:20px;z-index:99990;border:none;border-radius:28px;padding:14px 20px;background:var(--wa-accent);color:var(--wa-accent-fg);font:600 15px/1 system-ui,sans-serif;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.25)}' +
    '.wa-panel{position:fixed;right:20px;bottom:84px;z-index:99991;width:min(380px,calc(100vw - 40px));height:min(560px,calc(100vh - 120px));display:none;flex-direction:column;background:var(--wa-bg);color:var(--wa-fg);border:1px solid var(--wa-border);border-radius:14px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.3);font:15px/1.45 system-ui,sans-serif}' +
    '.wa-panel.wa-open{display:flex}' +
    '.wa-head{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid var(--wa-border)}' +
    '.wa-head b{flex:1}.wa-badge{font-size:11px;color:var(--wa-muted);border:1px solid var(--wa-border);border-radius:9px;padding:2px 8px}' +
    '.wa-close{border:none;background:none;color:var(--wa-muted);font-size:18px;cursor:pointer}' +
    '.wa-msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px}' +
    '.wa-msg{max-width:85%;padding:9px 12px;border-radius:12px;white-space:pre-wrap;word-wrap:break-word}' +
    '.wa-msg.wa-agent{background:transparent;border:1px solid var(--wa-border);align-self:flex-start}' +
    '.wa-msg.wa-me{background:var(--wa-me);align-self:flex-end}' +
    '.wa-msg.wa-thinking{color:var(--wa-muted);font-style:italic;border-style:dashed}' +
    '.wa-form{display:flex;gap:8px;padding:10px;border-top:1px solid var(--wa-border)}' +
    '.wa-input{flex:1;resize:none;border:1px solid var(--wa-border);border-radius:9px;background:var(--wa-bg);color:var(--wa-fg);padding:9px 11px;font:inherit;max-height:100px}' +
    '.wa-send{border:none;border-radius:9px;padding:0 16px;background:var(--wa-accent);color:var(--wa-accent-fg);font:600 14px system-ui,sans-serif;cursor:pointer}' +
    '.wa-send:disabled{opacity:.5;cursor:default}' +
    '.wa-foot{padding:8px 14px;border-top:1px solid var(--wa-border);font-size:11.5px;color:var(--wa-muted);display:flex;justify-content:space-between;gap:8px}' +
    '.wa-foot a{color:var(--wa-accent);text-decoration:none}' +
    '.wa-ts{padding:0 14px 8px}';

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }

  // Session id survives navigation within the tab; server enforces its own TTL.
  var sessionId = sessionStorage.getItem('wa-session');
  if (!sessionId || !/^[a-z0-9-]{8,64}$/.test(sessionId)) {
    sessionId = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 's-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
    sessionStorage.setItem('wa-session', sessionId);
  }

  var launch = el('button', 'wa-launch', 'Ask ' + cfg.agentName);
  launch.setAttribute('aria-label', 'Open chat with ' + cfg.agentName + ', an AI agent');
  var panel = el('div', 'wa-panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Chat with ' + cfg.agentName);

  var head = el('div', 'wa-head');
  head.appendChild(el('b', null, cfg.agentName));
  head.appendChild(el('span', 'wa-badge', 'AI agent'));
  var closeBtn = el('button', 'wa-close', '×');
  closeBtn.setAttribute('aria-label', 'Close chat');
  head.appendChild(closeBtn);

  var msgs = el('div', 'wa-msgs');
  var tsHost = el('div', 'wa-ts');

  var form = el('form', 'wa-form');
  var input = el('textarea', 'wa-input');
  input.rows = 1;
  input.maxLength = 1500;
  input.placeholder = 'Ask about our products...';
  var send = el('button', 'wa-send', 'Send');
  send.type = 'submit';
  form.appendChild(input);
  form.appendChild(send);

  var foot = el('div', 'wa-foot');
  var disclosure = el('span', null, 'AI agent. Conversations are recorded and scored for quality.');
  var verify = el('a', null, 'Verify this agent →');
  verify.href = cfg.verifyUrl;
  verify.target = '_blank';
  verify.rel = 'noopener';
  foot.appendChild(disclosure);
  foot.appendChild(verify);

  panel.appendChild(head);
  panel.appendChild(msgs);
  panel.appendChild(tsHost);
  panel.appendChild(form);
  panel.appendChild(foot);
  document.body.appendChild(launch);
  document.body.appendChild(panel);

  // Agent replies arrive with markdown-style **bold**. Render that one form
  // as <strong> using DOM nodes only; everything else stays plain text so
  // reply content can never become markup.
  function renderAgentText(target, text) {
    var parts = String(text).split(/\*\*([^*\n]+)\*\*/g);
    for (var i = 0; i < parts.length; i++) {
      if (!parts[i]) continue;
      if (i % 2 === 1) {
        var b = document.createElement('strong');
        b.textContent = parts[i];
        target.appendChild(b);
      } else {
        target.appendChild(document.createTextNode(parts[i]));
      }
    }
  }

  function addMsg(cls, text) {
    var m = el('div', 'wa-msg ' + cls);
    if (cls.indexOf('wa-agent') === 0 && cls.indexOf('wa-thinking') === -1) {
      renderAgentText(m, text);
    } else {
      m.textContent = text;
    }
    msgs.appendChild(m);
    msgs.scrollTop = msgs.scrollHeight;
    return m;
  }

  var greeted = false;
  function openPanel() {
    panel.classList.add('wa-open');
    if (!greeted) { addMsg('wa-agent', cfg.greeting); greeted = true; }
    ensureTurnstile();
    input.focus();
  }
  launch.addEventListener('click', function () {
    panel.classList.contains('wa-open') ? panel.classList.remove('wa-open') : openPanel();
  });
  closeBtn.addEventListener('click', function () { panel.classList.remove('wa-open'); });

  // --- Turnstile: managed widget, token used on the first message ---------
  var tsToken = '';
  var tsLoaded = false;
  function ensureTurnstile() {
    if (!cfg.turnstileSitekey || tsLoaded) return;
    tsLoaded = true;
    window.__waTsReady = function () {
      window.turnstile.render(tsHost, {
        sitekey: cfg.turnstileSitekey,
        callback: function (token) { tsToken = token; },
        'error-callback': function () { tsToken = ''; },
      });
    };
    var s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=__waTsReady';
    s.async = true;
    document.head.appendChild(s);
  }

  var busy = false;
  function setBusy(b) {
    busy = b;
    send.disabled = b;
    input.disabled = b;
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (busy) return;
    var text = input.value.trim();
    if (!text) return;
    if (cfg.turnstileSitekey && !tsToken && !sessionStorage.getItem('wa-verified')) {
      addMsg('wa-agent', 'One moment, the human check has not finished loading. Try again in a few seconds.');
      return;
    }
    input.value = '';
    addMsg('wa-me', text);
    var thinking = addMsg('wa-agent wa-thinking', THINKING_LINES[0]);
    var lineIdx = 0;
    var rotator = setInterval(function () {
      lineIdx = Math.min(lineIdx + 1, THINKING_LINES.length - 1);
      thinking.textContent = THINKING_LINES[lineIdx];
    }, 9000);
    setBusy(true);

    fetch(cfg.endpoint + '/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId: sessionId, message: text, turnstileToken: tsToken }),
    })
      .then(function (res) { return res.json().catch(function () { return {}; }).then(function (d) { return { ok: res.ok, data: d }; }); })
      .then(function (r) {
        clearInterval(rotator);
        thinking.remove();
        var reply = (r.data && r.data.reply) || 'Something went wrong on my side. Please try again in a moment.';
        addMsg('wa-agent', reply);
        if (r.ok) sessionStorage.setItem('wa-verified', '1');
      })
      .catch(function () {
        clearInterval(rotator);
        thinking.remove();
        addMsg('wa-agent', 'I could not reach my server. Check your connection and try again.');
      })
      .then(function () { setBusy(false); input.focus(); });
  });

  input.addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault();
      form.dispatchEvent(new Event('submit', { cancelable: true }));
    }
  });
})();
