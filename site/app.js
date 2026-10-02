// Pulse Monitor Interactive Documentation & Simulator

document.addEventListener('DOMContentLoaded', () => {
  initInstallTabs();
  initCodeShowcaseTabs();
  initCockpitSimulator();
});

// 1. Install Snippet Switcher
function initInstallTabs() {
  const tabs = document.querySelectorAll('.install-tab-btn');
  const codeEl = document.getElementById('installCode');
  const copyBtn = document.getElementById('copyInstallBtn');

  const commands = {
    npm: 'npm install pulse-monitor',
    pnpm: 'pnpm add pulse-monitor',
    pip: 'pip install pulse-monitor',
    go: 'go get github.com/alaminislam34/server-monitor/sdk/go',
    yarn: 'yarn add pulse-monitor',
  };

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const pkg = tab.dataset.pkg;
      if (codeEl && commands[pkg]) {
        codeEl.textContent = commands[pkg];
      }
    });
  });

  if (copyBtn && codeEl) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(codeEl.textContent || '');
      copyBtn.innerHTML = '✓ Copied';
      setTimeout(() => {
        copyBtn.innerHTML = '📋 Copy';
      }, 2000);
    });
  }
}

// 2. Code Showcase Switcher
function initCodeShowcaseTabs() {
  const codeTabs = document.querySelectorAll('.code-tab-btn');
  const codeBlocks = document.querySelectorAll('.code-snippet');

  codeTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.target;
      codeTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      codeBlocks.forEach(block => {
        if (block.id === target) {
          block.style.display = 'block';
        } else {
          block.style.display = 'none';
        }
      });
    });
  });
}

// 3. Interactive Cockpit Simulator
function initCockpitSimulator() {
  const tableBody = document.getElementById('simTableBody');
  const alertBanner = document.getElementById('simAlertBanner');
  const alertText = document.getElementById('simAlertText');

  const totalReqVal = document.getElementById('metricTotalReq');
  const avgLatencyVal = document.getElementById('metricAvgLatency');
  const threatCountVal = document.getElementById('metricThreatCount');
  const cpuLoadVal = document.getElementById('metricCpuLoad');

  let totalRequests = 142;
  let totalThreats = 3;
  let latencies = [12, 18, 9, 24, 15];

  function updateMetrics(latency, isThreat = false) {
    totalRequests++;
    latencies.push(latency);
    if (latencies.length > 20) latencies.shift();

    const avg = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);

    if (totalReqVal) totalReqVal.textContent = totalRequests.toString();
    if (avgLatencyVal) avgLatencyVal.textContent = `${avg}ms`;
    if (cpuLoadVal) cpuLoadVal.textContent = `${(Math.random() * 3 + 1.2).toFixed(1)}%`;

    if (isThreat) {
      totalThreats++;
      if (threatCountVal) threatCountVal.textContent = totalThreats.toString();
    }
  }

  function addRow(method, path, status, statusClass, contractBadgeHtml, latencyMs) {
    if (!tableBody) return;

    const row = document.createElement('tr');
    row.className = 'new-row';
    const now = new Date().toLocaleTimeString();

    row.innerHTML = `
      <td style="color: var(--text-dim);">${now}</td>
      <td><span class="badge ${method === 'POST' ? 'badge-post' : 'badge-get'}">${method}</span></td>
      <td style="color: var(--text-main); font-weight: 500;">${path}</td>
      <td><span class="${statusClass}">${status}</span></td>
      <td>${contractBadgeHtml}</td>
      <td style="color: var(--text-muted);">${latencyMs}ms</td>
    `;

    tableBody.insertBefore(row, tableBody.firstChild);

    // Keep table capped to 8 rows for clean view
    if (tableBody.children.length > 8) {
      tableBody.removeChild(tableBody.lastChild);
    }
  }

  function triggerAlert(message, type = 'danger') {
    if (!alertBanner || !alertText) return;
    alertBanner.className = `cockpit-alert active`;
    alertBanner.style.background = type === 'warning' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)';
    alertBanner.style.borderColor = type === 'warning' ? 'rgba(245, 158, 11, 0.4)' : 'rgba(239, 68, 68, 0.4)';
    alertBanner.style.color = type === 'warning' ? '#fde68a' : '#fca5a5';
    alertText.innerHTML = message;

    setTimeout(() => {
      alertBanner.classList.remove('active');
    }, 4500);
  }

  // Button Listeners
  const btnValid = document.getElementById('btnSimValid');
  const btnDrift = document.getElementById('btnSimDrift');
  const btnAttack = document.getElementById('btnSimAttack');
  const btnSlow = document.getElementById('btnSimSlow');

  if (btnValid) {
    btnValid.addEventListener('click', () => {
      const latency = Math.floor(Math.random() * 8) + 6;
      updateMetrics(latency);
      addRow(
        'GET',
        `/api/v1/users/${Math.floor(Math.random() * 900) + 100}`,
        '200',
        'badge-status-200',
        '<span class="badge badge-verified">Verified ✓</span>',
        latency
      );
    });
  }

  if (btnDrift) {
    btnDrift.addEventListener('click', () => {
      const latency = Math.floor(Math.random() * 10) + 12;
      updateMetrics(latency);
      addRow(
        'GET',
        '/api/v1/orders/ord_101',
        '200',
        'badge-status-200',
        '<span class="badge badge-drift">Drift ⚠️</span>',
        latency
      );
      triggerAlert('<strong>OpenAPI Schema Drift Detected:</strong> Response body for <code>GET /api/v1/orders/{id}</code> is missing required field <code>status</code>!', 'warning');
    });
  }

  if (btnAttack) {
    btnAttack.addEventListener('click', () => {
      const latency = Math.floor(Math.random() * 5) + 3;
      updateMetrics(latency, true);
      addRow(
        'GET',
        "/api/search?q=1' OR 1=1 --",
        '403',
        'badge-status-500',
        '<span class="badge badge-drift">Blocked 🛡️</span>',
        latency
      );
      triggerAlert('<strong>Security Threat Watchdog:</strong> Blocked SQL Injection pattern <code>1\' OR 1=1 --</code> from 192.168.1.105!', 'danger');
    });
  }

  if (btnSlow) {
    btnSlow.addEventListener('click', () => {
      const latency = Math.floor(Math.random() * 300) + 550;
      updateMetrics(latency);
      addRow(
        'POST',
        '/api/v1/analytics/generate-pdf',
        '200',
        'badge-status-200',
        '<span class="badge badge-verified">Slow ⏱️</span>',
        latency
      );
    });
  }
}
