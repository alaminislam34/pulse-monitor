// Pulse Monitor Interactive Documentation & Simulator

document.addEventListener('DOMContentLoaded', () => {
  initInstallClaimBar();
  initCodeShowcaseTabs();
  initCockpitSimulator();
});

// 1. Install / Claim Bar Copy Button
function initInstallClaimBar() {
  const codeEl = document.getElementById('installCode');
  const copyBtn = document.getElementById('copyInstallBtn');

  if (copyBtn && codeEl) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(codeEl.value || codeEl.textContent || '');
      const originalText = copyBtn.textContent;
      copyBtn.textContent = '✓ Copied!';
      setTimeout(() => {
        copyBtn.textContent = originalText;
      }, 2000);
    });
  }
}

// 2. Code Showcase Switcher
function initCodeShowcaseTabs() {
  const codeTabs = document.querySelectorAll('.code-tab-btn');
  const codeBlocks = document.querySelectorAll('.code-snippet');
  const copyCodeBtn = document.getElementById('copyCodeBtn');

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

  if (copyCodeBtn) {
    copyCodeBtn.addEventListener('click', () => {
      const activeSnippet = document.querySelector('.code-snippet:not([style*="display: none"]) pre');
      if (activeSnippet) {
        navigator.clipboard.writeText(activeSnippet.innerText);
        copyCodeBtn.textContent = '✓ Copied';
        setTimeout(() => {
          copyCodeBtn.textContent = 'Copy';
        }, 2000);
      }
    });
  }
}

// 3. Interactive Cockpit Simulator & Dashboard Showcase
function initCockpitSimulator() {
  const cockpitWindow = document.getElementById('cockpitWindow');
  const simTableBody = document.getElementById('simTableBody');
  const simStatTotal = document.getElementById('simStatTotal');
  const simStatLatency = document.getElementById('simStatLatency');
  const simStatThreats = document.getElementById('simStatThreats');
  const simStatErrorRate = document.getElementById('simStatErrorRate');
  const simErrorBadge = document.getElementById('simErrorBadge');
  const driftBadgeCount = document.getElementById('driftBadgeCount');
  const threatBadgeCount = document.getElementById('threatBadgeCount');

  const btnValid = document.getElementById('simValidBtn');
  const btnDrift = document.getElementById('simDriftBtn');
  const btnThreat = document.getElementById('simThreatBtn');
  const btnLatency = document.getElementById('simLatencyBtn');
  const themeToggle = document.getElementById('cockpitThemeToggle');
  const syncBtn = document.getElementById('cockpitSyncBtn');

  let totalRequests = 1426;
  let totalThreats = 1;
  let totalDrift = 1;
  let failedRequests = 0;
  let latencies = [8, 14, 1, 487, 24];

  // Theme Toggle (Light / Dark mode inside the cockpit)
  if (themeToggle && cockpitWindow) {
    themeToggle.addEventListener('click', () => {
      cockpitWindow.classList.toggle('dark-mode');
      const isDark = cockpitWindow.classList.contains('dark-mode');
      const icon = document.getElementById('themeToggleIcon');
      if (icon) {
        icon.textContent = isDark ? '☀️' : '🌙';
      }
    });
  }

  // Sidebar Tab Switcher
  const navItems = document.querySelectorAll('.cockpit-nav-item');
  const views = document.querySelectorAll('.cockpit-view');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tab = item.dataset.tab;
      navItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      views.forEach(v => {
        if (v.id === `view-${tab}`) {
          v.classList.add('active');
        } else {
          v.classList.remove('active');
        }
      });
    });
  });

  // Sync Button Animation
  if (syncBtn) {
    syncBtn.addEventListener('click', () => {
      const svg = syncBtn.querySelector('svg');
      if (svg) svg.style.transform = 'rotate(360deg)';
      syncBtn.style.opacity = '0.7';
      setTimeout(() => {
        if (svg) svg.style.transform = 'none';
        syncBtn.style.opacity = '1';
      }, 500);
    });
  }

  function updateMetrics(latency, isDrift = false, isThreat = false, isError = false) {
    totalRequests++;
    latencies.push(latency);
    if (latencies.length > 20) latencies.shift();

    const avg = (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(1);

    if (simStatTotal) simStatTotal.textContent = totalRequests.toLocaleString();
    if (simStatLatency) simStatLatency.textContent = avg;

    if (isDrift) {
      totalDrift++;
      if (driftBadgeCount) driftBadgeCount.textContent = totalDrift;
    }

    if (isThreat) {
      totalThreats++;
      if (simStatThreats) simStatThreats.textContent = totalThreats;
      if (threatBadgeCount) threatBadgeCount.textContent = totalThreats;
    }

    if (isError) {
      failedRequests++;
    }
    const errRate = ((failedRequests / (totalRequests - 1420 || 1)) * 10).toFixed(1);
    if (simStatErrorRate) simStatErrorRate.textContent = `${errRate}%`;
    if (simErrorBadge && Number(errRate) > 0) {
      simErrorBadge.textContent = 'Anomaly';
      simErrorBadge.className = 'badge-mini danger';
    }
  }

  function addTableRow(method, route, status, statusClass, latency, tagHtml, timeText) {
    if (!simTableBody) return;

    // Switch to analytics view if not active
    const analyticsView = document.getElementById('view-analytics');
    const analyticsNav = document.querySelector('.cockpit-nav-item[data-tab="analytics"]');
    if (analyticsView && !analyticsView.classList.contains('active')) {
      document.querySelectorAll('.cockpit-view').forEach(v => v.classList.remove('active'));
      document.querySelectorAll('.cockpit-nav-item').forEach(i => i.classList.remove('active'));
      analyticsView.classList.add('active');
      if (analyticsNav) analyticsNav.classList.add('active');
    }

    const tr = document.createElement('tr');
    tr.className = 'row-highlight';
    tr.style.animation = 'fadeIn 0.25s ease';
    tr.innerHTML = `
      <td><span class="method-badge ${method.toLowerCase()}">${method}</span></td>
      <td class="route-mono">${route}</td>
      <td><span class="status-badge ${statusClass}">${status}</span></td>
      <td class="lat-mono ${latency > 300 ? 'slow-text' : ''}">${latency}ms</td>
      <td>${tagHtml}</td>
      <td class="time-sub">${timeText}</td>
    `;

    simTableBody.insertBefore(tr, simTableBody.firstChild);

    if (simTableBody.children.length > 7) {
      simTableBody.removeChild(simTableBody.lastChild);
    }
  }

  if (btnValid) {
    btnValid.addEventListener('click', () => {
      const latency = Math.floor(Math.random() * 8) + 6;
      const orderId = `ord_${Math.floor(Math.random() * 899) + 100}`;
      updateMetrics(latency);
      addTableRow('GET', `/api/orders/${orderId}`, '200 OK', 'success', latency, '<span class="tag-verified">Contract Verified ✓</span>', 'Just now');
    });
  }

  if (btnDrift) {
    btnDrift.addEventListener('click', () => {
      const latency = Math.floor(Math.random() * 10) + 12;
      updateMetrics(latency, true);
      addTableRow('GET', '/api/orders/ord_drift', '200 OK', 'success', latency, '<span class="tag-drift">Drift: missing \'status\' ⚠️</span>', 'Just now');
    });
  }

  if (btnThreat) {
    btnThreat.addEventListener('click', () => {
      const latency = Math.floor(Math.random() * 3) + 1;
      updateMetrics(latency, false, true, true);
      addTableRow('GET', "/api/users?id=1' OR 1=1", '403 FORBIDDEN', 'danger', latency, '<span class="tag-threat">Threat: SQL Injection Blocked 🚨</span>', 'Just now');
    });
  }

  if (btnLatency) {
    btnLatency.addEventListener('click', () => {
      const latency = Math.floor(Math.random() * 100) + 400;
      updateMetrics(latency);
      addTableRow('GET', '/api/analytics/heavy-report', '200 OK', 'success', latency, '<span class="tag-slow">Latency Alert (Slow) ⏱</span>', 'Just now');
    });
  }
}
