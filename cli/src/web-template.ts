import { OrganManifest } from './manifest';

export function generateWebHtml(instanceName: string, manifests: OrganManifest[]): string {
  const hasBody = manifests.some((m) => m.organType === 'body');
  const hasVoice = manifests.some((m) => m.organType === 'voice');
  const hasMemory = manifests.some((m) => m.organType === 'memory');
  const hasKnowledge = manifests.some((m) => m.organType === 'knowledge');

  const organBadges = manifests.map((m) => {
    const icon = m.organType === 'brain' ? '🧠'
      : m.organType === 'memory' ? '💾'
      : m.organType === 'voice' ? '🗣️'
      : m.organType === 'body' ? '💃'
      : m.organType === 'knowledge' ? '📚'
      : m.organType === 'hands' ? '🛠️'
      : m.organType === 'vision' ? '👁️'
      : m.organType === 'behavior' ? '⚡'
      : '📦';
    return `<span class="badge">${icon} ${m.displayName.split(' ')[0]}</span>`;
  }).join(' ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${instanceName} · Siduri Companion</title>
  <style>
    :root {
      --bg: #0b0f19;
      --card-bg: #111827;
      --card-border: #1f2937;
      --text: #f3f4f6;
      --text-dim: #9ca3af;
      --cyan: #06b6d4;
      --cyan-dim: rgba(6, 182, 212, 0.15);
      --green: #10b981;
      --purple: #8b5cf6;
      --accent: #0ea5e9;
      --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--font);
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    header {
      background: var(--card-bg);
      border-bottom: 1px solid var(--card-border);
      padding: 12px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand h1 {
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--cyan);
      letter-spacing: -0.5px;
    }
    .badges {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .badge {
      background: var(--cyan-dim);
      color: var(--cyan);
      border: 1px solid rgba(6, 182, 212, 0.3);
      padding: 3px 8px;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 500;
    }
    .tabs {
      display: flex;
      gap: 8px;
    }
    .tab-btn {
      background: transparent;
      border: 1px solid transparent;
      color: var(--text-dim);
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }
    .tab-btn:hover {
      color: var(--text);
      background: rgba(255, 255, 255, 0.05);
    }
    .tab-btn.active {
      color: var(--cyan);
      background: var(--cyan-dim);
      border-color: rgba(6, 182, 212, 0.4);
    }
    main {
      flex: 1;
      display: flex;
      overflow: hidden;
    }
    .tab-content {
      display: none;
      width: 100%;
      height: 100%;
    }
    .tab-content.active {
      display: flex;
    }
    /* Chat & Avatar Layout */
    .chat-layout {
      width: 100%;
      height: 100%;
      display: grid;
      grid-template-columns: 420px 1fr;
    }
    @media (max-width: 860px) {
      .chat-layout { grid-template-columns: 1fr; grid-template-rows: 240px 1fr; }
    }
    .avatar-pane {
      background: radial-gradient(circle at center, #1a2234 0%, #0b0f19 70%);
      border-right: 1px solid var(--card-border);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
      padding: 20px;
    }
    .avatar-stage {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    .avatar-canvas {
      width: 100%;
      max-height: 480px;
      border-radius: 12px;
      object-fit: contain;
    }
    .avatar-portrait {
      width: 160px;
      height: 160px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--cyan), var(--purple));
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 4rem;
      box-shadow: 0 0 30px rgba(6, 182, 212, 0.3);
      animation: float 4s ease-in-out infinite;
    }
    @keyframes float {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-10px); }
    }
    .expression-badge {
      margin-top: 16px;
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid var(--card-border);
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 0.8rem;
      color: var(--text-dim);
    }
    .chat-pane {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--bg);
    }
    .messages-container {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .message {
      max-width: 80%;
      padding: 12px 16px;
      border-radius: 12px;
      line-height: 1.5;
      font-size: 0.95rem;
    }
    .message.user {
      align-self: flex-end;
      background: var(--cyan);
      color: #000;
      font-weight: 500;
      border-bottom-right-radius: 2px;
    }
    .message.companion {
      align-self: flex-start;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      color: var(--text);
      border-bottom-left-radius: 2px;
    }
    .message .meta {
      font-size: 0.7rem;
      margin-bottom: 4px;
      color: var(--text-dim);
    }
    .message.user .meta { color: rgba(0, 0, 0, 0.6); }
    .input-area {
      padding: 16px 24px;
      background: var(--card-bg);
      border-top: 1px solid var(--card-border);
      display: flex;
      gap: 12px;
    }
    .input-area input {
      flex: 1;
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 12px 16px;
      color: #fff;
      font-size: 0.95rem;
      outline: none;
      transition: border-color 0.2s;
    }
    .input-area input:focus {
      border-color: var(--cyan);
    }
    .send-btn {
      background: var(--cyan);
      color: #000;
      font-weight: 600;
      border: none;
      padding: 0 20px;
      border-radius: 8px;
      cursor: pointer;
      transition: transform 0.1s, opacity 0.2s;
    }
    .send-btn:hover { opacity: 0.9; }
    .send-btn:active { transform: scale(0.98); }

    /* Console / Operator Layout */
    .operator-layout {
      width: 100%;
      height: 100%;
      overflow-y: auto;
      padding: 28px;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 20px;
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .card-title {
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--cyan);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
    }
    th {
      text-align: left;
      padding: 10px 12px;
      border-bottom: 1px solid var(--card-border);
      color: var(--text-dim);
      font-weight: 500;
    }
    td {
      padding: 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    .btn-action {
      background: var(--cyan-dim);
      color: var(--cyan);
      border: 1px solid rgba(6, 182, 212, 0.3);
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 0.8rem;
      cursor: pointer;
    }
    .search-input {
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid var(--card-border);
      border-radius: 6px;
      padding: 6px 12px;
      color: #fff;
      font-size: 0.875rem;
      outline: none;
    }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <h1>◈ SIDURI</h1>
      <span style="font-weight: 600; color: #fff;">${instanceName}</span>
      <div class="badges">
        ${organBadges}
      </div>
    </div>
    <div class="tabs">
      <button class="tab-btn active" onclick="switchTab('chat')">💬 Companion Chat</button>
      <button class="tab-btn" onclick="switchTab('operator')">🧠 Memory Console</button>
      <button class="tab-btn" onclick="switchTab('diagnostics')">⚙️ Diagnostics</button>
    </div>
  </header>

  <main>
    <!-- TAB 1: Chat & Avatar -->
    <div id="tab-chat" class="tab-content active">
      <div class="chat-layout">
        <div class="avatar-pane">
          <div class="avatar-stage">
            <canvas id="live2d-canvas" class="avatar-canvas" style="display: none;"></canvas>
            <div id="avatar-fallback" class="avatar-portrait">✨</div>
            <div id="expression-tag" class="expression-badge">State: Neutral</div>
          </div>
        </div>
        <div class="chat-pane">
          <div id="messages" class="messages-container">
            <div class="message companion">
              <div class="meta">${instanceName}</div>
              Hello! I am your Siduri companion. How can I help you today?
            </div>
          </div>
          <div class="input-area">
            <input id="user-input" type="text" placeholder="Type your message..." autocomplete="off" onkeydown="if(event.key==='Enter') sendMessage()" />
            <button class="send-btn" onclick="sendMessage()">Send ➤</button>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 2: Memory & Claims Console -->
    <div id="tab-operator" class="tab-content">
      <div class="operator-layout">
        <div class="card">
          <div class="card-header">
            <div class="card-title">💾 Authoritative Memory Claims (PostgreSQL FTS)</div>
            <input type="text" class="search-input" placeholder="⌕ Filter claims..." oninput="filterClaims(this.value)" />
          </div>
          <table id="claims-table">
            <thead>
              <tr>
                <th>Subject</th>
                <th>Predicate</th>
                <th>Value</th>
                <th>Type</th>
                <th>Provenance</th>
                <th>Asserted</th>
              </tr>
            </thead>
            <tbody id="claims-body">
              <tr>
                <td colspan="6" style="text-align: center; color: var(--text-dim);">Loading memory claims...</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">⚡ Active Behavioral Directives</div>
          </div>
          <div id="directives-list" style="display: flex; flex-direction: column; gap: 10px; font-size: 0.9rem;">
            <div style="color: var(--text-dim);">Loading directives...</div>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 3: Diagnostics -->
    <div id="tab-diagnostics" class="tab-content">
      <div class="operator-layout">
        <div class="card">
          <div class="card-title" style="margin-bottom: 16px;">⚙️ Organ Probes & Diagnostics</div>
          <div id="diagnostics-content" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px;">
            <div style="color: var(--text-dim);">Probing runtime state...</div>
          </div>
        </div>
      </div>
    </div>
  </main>

  <script>
    let currentClaims = [];

    function switchTab(tabId) {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      const btn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.getAttribute('onclick').includes(tabId));
      if (btn) btn.classList.add('active');
      
      const tab = document.getElementById('tab-' + tabId);
      if (tab) tab.classList.add('active');

      if (tabId === 'operator') loadClaims();
      if (tabId === 'diagnostics') loadDiagnostics();
    }

    async function sendMessage() {
      const input = document.getElementById('user-input');
      const text = input.value.trim();
      if (!text) return;

      input.value = '';
      appendMessage('user', 'You', text);

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text })
        });
        const data = await res.json();
        
        appendMessage('companion', '${instanceName}', data.reply || data.text || '(No response)');
        
        if (data.expression) {
          document.getElementById('expression-tag').textContent = 'State: ' + data.expression;
        }

        if (data.audioUrl) {
          const audio = new Audio(data.audioUrl);
          audio.play().catch(e => console.warn('Audio autoplay blocked:', e));
        }
      } catch (err) {
        appendMessage('companion', '${instanceName}', '⚠️ Error connecting to companion: ' + err.message);
      }
    }

    function appendMessage(role, name, text) {
      const container = document.getElementById('messages');
      const div = document.createElement('div');
      div.className = 'message ' + role;
      div.innerHTML = '<div class="meta">' + name + '</div>' + text.replace(/\\n/g, '<br>');
      container.appendChild(div);
      container.scrollTop = container.scrollHeight;
    }

    async function loadClaims() {
      try {
        const res = await fetch('/api/memory/claims');
        const data = await res.json();
        currentClaims = data.claims || [];
        renderClaims(currentClaims);
        
        const dirRes = await fetch('/api/memory/directives');
        const dirData = await dirRes.json();
        renderDirectives(dirData.directives || []);
      } catch (err) {
        document.getElementById('claims-body').innerHTML = '<tr><td colspan="6" style="color: #ef4444;">Failed to load claims: ' + err.message + '</td></tr>';
      }
    }

    function renderClaims(claims) {
      const tbody = document.getElementById('claims-body');
      if (!claims || claims.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-dim);">No authoritative claims stored yet. Chat with your companion to build memory.</td></tr>';
        return;
      }
      tbody.innerHTML = claims.map(c => \`
        <tr>
          <td style="color: var(--cyan); font-weight: 500;">\${c.subject || '-'}</td>
          <td>\${c.predicate || '-'}</td>
          <td>\${c.value || '-'}</td>
          <td><span class="badge">\${c.claim_type || c.claimType || 'semantic'}</span></td>
          <td style="color: var(--text-dim); font-size: 0.8rem;">\${c.provenance || 'direct'}</td>
          <td style="color: var(--text-dim); font-size: 0.8rem;">\${c.asserted_at || c.assertedAt || 'recent'}</td>
        </tr>
      \`).join('');
    }

    function filterClaims(query) {
      const q = query.toLowerCase();
      const filtered = currentClaims.filter(c => 
        (c.subject || '').toLowerCase().includes(q) ||
        (c.predicate || '').toLowerCase().includes(q) ||
        (c.value || '').toLowerCase().includes(q)
      );
      renderClaims(filtered);
    }

    function renderDirectives(directives) {
      const container = document.getElementById('directives-list');
      if (!directives || directives.length === 0) {
        container.innerHTML = '<div style="color: var(--text-dim);">No custom directives set. Using default Active Self compiler.</div>';
        return;
      }
      container.innerHTML = directives.map(d => \`
        <div style="background: rgba(0,0,0,0.2); border: 1px solid var(--card-border); padding: 12px; border-radius: 8px;">
          <div style="font-weight: 600; color: var(--cyan);">\${d.domain || 'core'}: \${d.name || d.directive_id || 'Directive'}</div>
          <div style="color: var(--text-dim); font-size: 0.85rem; margin-top: 4px;">\${d.content || d.value || JSON.stringify(d)}</div>
        </div>
      \`).join('');
    }

    async function loadDiagnostics() {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
        const container = document.getElementById('diagnostics-content');
        container.innerHTML = Object.entries(data.organs || {}).map(([key, val]) => \`
          <div style="background: rgba(0,0,0,0.2); border: 1px solid var(--card-border); padding: 16px; border-radius: 8px;">
            <div style="font-weight: 600; color: var(--cyan); font-size: 1rem; margin-bottom: 8px;">\${key.toUpperCase()}</div>
            <pre style="font-size: 0.8rem; color: var(--text-dim); overflow-x: auto;">\${JSON.stringify(val, null, 2)}</pre>
          </div>
        \`).join('');
      } catch (err) {
        document.getElementById('diagnostics-content').innerHTML = '<div style="color: #ef4444;">Failed to fetch diagnostics: ' + err.message + '</div>';
      }
    }
  </script>
</body>
</html>`;
}
