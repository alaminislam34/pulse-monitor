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

// 3. Interactive Cockpit Simulator
function initCockpitSimulator() {
  const simEventsList = document.getElementById('simEventsList');
  const simStatTotal = document.getElementById('simStatTotal');
  const simStatLatency = document.getElementById('simStatLatency');
  const simStatDrift = document.getElementById('simStatDrift');

  const btnValid = document.getElementById('simValidBtn');
  const btnDrift = document.getElementById('simDriftBtn');
  const btnThreat = document.getElementById('simThreatBtn');
  const btnLatency = document.getElementById('simLatencyBtn');

  let totalRequests = 1420;
  let totalDrift = 3;
  let latencies = [8, 14, 12, 9, 15];

  function updateMetrics(latency, isDrift = false) {
    totalRequests++;
    latencies.push(latency);
    if (latencies.length > 20) latencies.shift();

    const avg = (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(1);

    if (simStatTotal) simStatTotal.textContent = totalRequests.toLocaleString();
    if (simStatLatency) simStatLatency.textContent = `${avg}ms`;

    if (isDrift) {
      totalDrift++;
      if (simStatDrift) simStatDrift.textContent = `${totalDrift} Events`;
    }
  }

  function addEventRow(leftHtml, rightHtml) {
    if (!simEventsList) return;

    const row = document.createElement('div');
    row.className = 'event-row-sim';
    row.style.animation = 'fadeIn 0.25s ease';
    row.innerHTML = `
      ${leftHtml}
      ${rightHtml}
    `;

    simEventsList.insertBefore(row, simEventsList.firstChild);

    if (simEventsList.children.length > 7) {
      simEventsList.removeChild(simEventsList.lastChild);
    }
  }

  if (btnValid) {
    btnValid.addEventListener('click', () => {
      const latency = Math.floor(Math.random() * 8) + 6;
      const orderId = `ord_${Math.floor(Math.random() * 899) + 100}`;
      updateMetrics(latency);
      addEventRow(
        `<span style="color: #34D399; font-weight: 600;">GET /api/orders/${orderId}</span>`,
        `<span style="color: #94A3B8;">200 OK • ${latency}ms • <span style="color: #34D399;">Contract Verified ✓</span></span>`
      );
    });
  }

  if (btnDrift) {
    btnDrift.addEventListener('click', () => {
      const latency = Math.floor(Math.random() * 10) + 12;
      updateMetrics(latency, true);
      addEventRow(
        `<span style="color: #FBBF24; font-weight: 600;">GET /api/orders/ord_drift</span>`,
        `<span style="color: #94A3B8;">200 OK • ${latency}ms • <span style="color: #F59E0B; font-weight: 600;">Drift: missing 'status' ⚠️</span></span>`
      );
    });
  }

  if (btnThreat) {
    btnThreat.addEventListener('click', () => {
      const latency = Math.floor(Math.random() * 4) + 2;
      updateMetrics(latency);
      addEventRow(
        `<span style="color: #F87171; font-weight: 600;">GET /api/users?id=1' OR 1=1</span>`,
        `<span style="color: #EF4444; font-weight: 600;">CRITICAL: SQL Injection Blocked 🚨</span>`
      );
    });
  }

  if (btnLatency) {
    btnLatency.addEventListener('click', () => {
      const latency = Math.floor(Math.random() * 100) + 400;
      updateMetrics(latency);
      addEventRow(
        `<span style="color: #94A3B8; font-weight: 600;">GET /api/analytics/heavy-report</span>`,
        `<span style="color: #F59E0B;">200 OK • <span style="color: #EF4444; font-weight: 700;">${latency}ms (High Latency) ⏱</span></span>`
      );
    });
  }
}
