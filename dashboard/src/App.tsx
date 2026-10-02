import { useState, useEffect, useRef } from 'react';
import { Lock, RefreshCw } from 'lucide-react';

import { MonitorData, RequestMetrics, SecurityAlert, Recommendation } from './types';
import { Sidebar, MobileBottomNav } from './components/Sidebar';
import { DashboardTab } from './components/DashboardTab';
import { RequestsTab } from './components/RequestsTab';
import { PlaygroundTab } from './components/PlaygroundTab';
import { SecurityTab } from './components/SecurityTab';
import { HealthTab } from './components/HealthTab';
import { RoutesTab } from './components/RoutesTab';
import { SettingsTab } from './components/SettingsTab';
import PulseNavbar from './components/Navbar/Navbar';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'requests' | 'security' | 'health' | 'settings' | 'routes' | 'playground'>('playground');
  const [authSecret, setAuthSecret] = useState<string>(() => localStorage.getItem('pulse_auth') || '');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [isAuthorized, setIsAuthorized] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('pulse_theme') as 'light' | 'dark') || 'light');

  const [data, setData] = useState<MonitorData | null>(null);
  const [pollInterval, setPollInterval] = useState<number>(5000);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isLiveStreaming, setIsLiveStreaming] = useState<boolean>(false);

  // Filters
  const [searchPath, setSearchPath] = useState<string>('');
  const [filterMethod, setFilterMethod] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [selectedRequest, setSelectedRequest] = useState<RequestMetrics | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<SecurityAlert | null>(null);

  // Sandbox State
  const [sandboxPayload, setSandboxPayload] = useState<string>('{"username": "admin\' or \'1\'=\'1", "password": "123"}');
  const [sandboxUA, setSandboxUA] = useState<string>('Mozilla/5.0');
  const [sandboxResult, setSandboxResult] = useState<{ detected: boolean; attackType?: string; severity?: string; details?: string } | null>(null);

  // Playground State
  const [pgMethod, setPgMethod] = useState<string>('GET');
  const [pgPath, setPgPath] = useState<string>('/api');
  const [pgHeaders, setPgHeaders] = useState<Array<{ key: string; value: string }>>([
    { key: 'Content-Type', value: 'application/json' }
  ]);
  const [pgQueryParams, setPgQueryParams] = useState<Array<{ key: string; value: string }>>([]);
  const [pgBody, setPgBody] = useState<string>('');
  const [pgLoading, setPgLoading] = useState<boolean>(false);
  const [pgResponse, setPgResponse] = useState<{
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
    timeMs: number;
  } | null>(null);
  const [pgActiveSubTab, setPgActiveSubTab] = useState<'headers' | 'params' | 'body'>('headers');

  const executePlaygroundRequest = async () => {
    setPgLoading(true);
    setPgResponse(null);
    const startTime = Date.now();
    try {
      let url = pgPath;
      const validParams = pgQueryParams.filter(p => p.key.trim() !== '');
      if (validParams.length > 0) {
        const queryStr = validParams.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&');
        url += (url.includes('?') ? '&' : '?') + queryStr;
      }

      const headersObj: Record<string, string> = {};
      pgHeaders.forEach(h => {
        if (h.key.trim() !== '') {
          headersObj[h.key] = h.value;
        }
      });

      const fetchOptions: RequestInit = {
        method: pgMethod,
        headers: headersObj,
      };

      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(pgMethod) && pgBody) {
        fetchOptions.body = pgBody;
      }

      const res = await fetch(url, fetchOptions);
      const endTime = Date.now();
      const text = await res.text();

      const resHeaders: Record<string, string> = {};
      res.headers.forEach((value, key) => {
        resHeaders[key] = value;
      });

      setPgResponse({
        status: res.status,
        statusText: res.statusText,
        headers: resHeaders,
        body: text,
        timeMs: endTime - startTime,
      });
    } catch (err: any) {
      const endTime = Date.now();
      setPgResponse({
        status: 0,
        statusText: 'Network Error',
        headers: {},
        body: err.message || String(err),
        timeMs: endTime - startTime,
      });
    } finally {
      setPgLoading(false);
    }
  };

  const handleTestRoute = (route: { path: string; method: string }) => {
    setPgPath(route.path);
    setPgMethod(route.method);
    setPgQueryParams([]);
    setPgHeaders([{ key: 'Content-Type', value: 'application/json' }]);
    if (['POST', 'PUT', 'PATCH'].includes(route.method)) {
      setPgBody('{\n  \n}');
      setPgActiveSubTab('body');
    } else {
      setPgBody('');
      setPgActiveSubTab('headers');
    }
    setPgResponse(null);
    setActiveTab('playground');
  };

  const handleTestRequest = (req: RequestMetrics) => {
    setPgPath(req.path);
    setPgMethod(req.method);
    setPgQueryParams([]);
    setPgHeaders([{ key: 'Content-Type', value: 'application/json' }]);
    setPgBody(req.reqBody ? formatBodyText(req.reqBody) : '');
    setPgActiveSubTab(req.reqBody ? 'body' : 'headers');
    setPgResponse(null);
    setActiveTab('playground');
  };

  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync theme
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('pulse_theme', theme);
  }, [theme]);

  // Fetch metrics data
  const fetchData = async (secretToUse: string = authSecret) => {
    setIsRefreshing(true);
    try {
      const baseEndpoint = window.location.pathname.replace(/\/$/, "");
      const url = `${baseEndpoint}/data${secretToUse ? `?secret=${encodeURIComponent(secretToUse)}` : ''}`;

      const response = await fetch(url, {
        headers: {
          'x-pulse-auth': secretToUse
        }
      });

      if (response.status === 401 || response.status === 403) {
        setIsAuthorized(false);
        setIsRefreshing(false);
        return;
      }

      const json = await response.json();
      setData(json);
      setIsAuthorized(true);
      setErrorMsg('');
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setErrorMsg('Lost connection to backend server.');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Setup SSE stream and polling fallback
  useEffect(() => {
    fetchData();

    // Initialize Server-Sent Events (SSE)
    const baseEndpoint = window.location.pathname.replace(/\/$/, "");
    const streamUrl = `${baseEndpoint}/api/stream${authSecret ? `?secret=${encodeURIComponent(authSecret)}` : ''}`;

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(streamUrl);
      eventSource.onopen = () => {
        setIsLiveStreaming(true);
      };

      eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.type === 'request') {
            setData((prev) => {
              if (!prev) return prev;
              const newReq: RequestMetrics = {
                timestamp: parsed.timestamp,
                path: parsed.request?.path || '/',
                method: parsed.request?.method || 'GET',
                statusCode: parsed.response?.statusCode || 200,
                durationMs: parsed.response?.durationMs || 0,
                ip: parsed.request?.ip || '127.0.0.1',
                userAgent: parsed.request?.userAgent,
                drift: parsed.drift,
              };
              return {
                ...prev,
                requests: [...prev.requests, newReq],
              };
            });
          } else if (parsed.type === 'threat') {
            setData((prev) => {
              if (!prev) return prev;
              const newThreat: SecurityAlert = {
                timestamp: parsed.timestamp,
                ip: parsed.clientIp || '127.0.0.1',
                path: parsed.targetField || '/',
                method: 'ALERT',
                attackType: parsed.threatType || 'Threat',
                severity: parsed.severity || 'HIGH',
                details: parsed.matchedPattern || 'Suspicious payload detected',
              };
              return {
                ...prev,
                threats: [...prev.threats, newThreat],
              };
            });
          }
        } catch (e) {}
      };

      eventSource.onerror = () => {
        setIsLiveStreaming(false);
      };
    } catch (e) {
      setIsLiveStreaming(false);
    }

    if (pollInterval > 0) {
      pollTimerRef.current = setInterval(() => {
        fetchData();
      }, pollInterval);
    }

    return () => {
      if (eventSource) eventSource.close();
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [pollInterval, authSecret]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput.trim()) return;
    localStorage.setItem('pulse_auth', passwordInput);
    setAuthSecret(passwordInput);
    fetchData(passwordInput);
  };

  const handleLogout = () => {
    localStorage.removeItem('pulse_auth');
    setAuthSecret('');
    setIsAuthorized(false);
    setData(null);
  };

  const testSandbox = () => {
    let payloadStr = sandboxPayload;
    let uaStr = sandboxUA;
    let detected = false;
    let attackType = '';
    let severity = '';
    let details = '';

    if (/sqlmap|nmap|nikto|w3af|acunetix|dirbuster/i.test(uaStr)) {
      detected = true;
      attackType = 'Vulnerability Scanner';
      severity = 'HIGH';
      details = `Crawler user-agent matches blacklisted automation tool signature.`;
    }
    else if (/\b(union|select|insert|update|delete|drop|alter|where|from|limit)\b/i.test(payloadStr) || /['"`;]--|['"]\s*(or|and)\s*['"]/i.test(payloadStr)) {
      detected = true;
      attackType = 'SQL Injection';
      severity = 'HIGH';
      details = `Syntactic SQL delimiters or query logic statements detected in payload structure.`;
    }
    else if (/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/i.test(payloadStr) || /javascript:/i.test(payloadStr) || /\bon\w+\s*=/i.test(payloadStr)) {
      detected = true;
      attackType = 'XSS';
      severity = 'MEDIUM';
      details = `Inline HTML element injections or executable script expressions identified.`;
    }
    else if (/\.\.\//.test(payloadStr) || /\/etc\/(passwd|hosts|shadow)/i.test(payloadStr) || /boot\.ini/i.test(payloadStr)) {
      detected = true;
      attackType = 'Path Traversal';
      severity = 'CRITICAL';
      details = `Parent directory traversal markers or absolute OS configuration files accessed.`;
    }

    setSandboxResult({ detected, attackType, severity, details });
  };

  if (!isAuthorized) {
    return (
      <div className="full-screen-center">
        <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '380px', padding: '2.5rem', textAlign: 'center', boxShadow: 'var(--shadow-lg)' }}>
          <div className="flex-center" style={{ width: '56px', height: '56px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '14px', boxShadow: 'var(--shadow-sm)', margin: '0 auto 1.5rem auto', color: 'var(--accent-primary)' }}>
            <Lock size={20} />
          </div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-main)', letterSpacing: '-0.02em' }}>Authentication required</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '2rem', lineHeight: '1.4' }}>Please enter credentials to unlock the Pulse dashboard.</p>

          {errorMsg && <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.8rem', marginBottom: '1rem', textAlign: 'left' }}>{errorMsg}</div>}

          <form onSubmit={handleLogin}>
            <input
              type="password"
              placeholder="Enter auth secret..."
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="form-input"
              style={{ marginBottom: '1rem' }}
            />
            <button
              type="submit"
              className="flex-center"
              style={{
                width: '100%',
                padding: '0.85rem',
                background: 'var(--accent-primary)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'var(--transition-smooth)',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.15)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}
            >
              Verify secret
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!data) {
    if (errorMsg) {
      return (
        <div className="flex-center" style={{ minHeight: '100vh', flexDirection: 'column', gap: '1rem', backgroundColor: 'var(--bg-main)' }}>
          <div className="card animate-fade-in" style={{ padding: '2rem', textAlign: 'center', maxWidth: '400px' }}>
            <h3 style={{ color: 'var(--accent-danger)', marginBottom: '0.5rem', fontWeight: 700 }}>Connection Failed</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem', lineHeight: 1.4 }}>{errorMsg}</p>
            <button
              onClick={() => fetchData()}
              className="flex-center"
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'var(--accent-primary)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.8rem'
              }}
            >
              Retry Connection
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="flex-center" style={{ minHeight: '100vh', flexDirection: 'column', gap: '1rem', backgroundColor: 'var(--bg-main)' }}>
        <RefreshCw className="animate-spin" size={28} style={{ color: 'var(--accent-primary)' }} />
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>Loading telemetry workspace...</p>
      </div>
    );
  }

  const { system, requests, threats, config, discoveredRoutes } = data;

  // Recommendations
  const getRecommendations = (): Recommendation[] => {
    const recs: Recommendation[] = [];
    if (threats.length > 0) {
      const affectedPaths = Array.from(new Set(threats.map(t => t.path)));
      recs.push({
        id: 'sec-threats',
        type: 'security',
        severity: 'critical',
        title: 'Intrusion threats matched',
        description: `Blocked ${threats.length} unauthorized access signatures on endpoint: ${affectedPaths.slice(0, 1).join(', ')}.`,
        action: 'Review target endpoint sanitization logic or restrict access using whitelisted client source headers.'
      });
    }
    const ipCounts: Record<string, number> = {};
    requests.forEach(r => {
      ipCounts[r.ip] = (ipCounts[r.ip] || 0) + 1;
    });
    const heavyClient = Object.entries(ipCounts).find(([_, count]) => count > 50);
    if (heavyClient) {
      recs.push({
        id: 'sec-rate',
        type: 'security',
        severity: 'high',
        title: 'IP threshold warning',
        description: `Client IP ${heavyClient[0]} sent ${heavyClient[1]} actions during the session.`,
        action: 'Configure "express-rate-limit" middleware to drop volumetric denial-of-service attempts.'
      });
    }
    const avgLatency = requests.length > 0 ? requests.reduce((acc, r) => acc + r.durationMs, 0) / requests.length : 0;
    if (avgLatency > 300) {
      recs.push({
        id: 'perf-slow',
        type: 'performance',
        severity: 'medium',
        title: 'Degraded latency average',
        description: `Response time average is ${avgLatency.toFixed(0)}ms across client transactions.`,
        action: 'Review database querying plans, apply Redis caching, or split synchronous operations.'
      });
    }
    if (system.eventLoopLag > 40) {
      recs.push({
        id: 'perf-loop',
        type: 'performance',
        severity: 'high',
        title: 'Event loop lag',
        description: `Execution loop delay reached ${system.eventLoopLag.toFixed(0)}ms.`,
        action: 'Trace for synchronous blocking invocations (e.g. JSON parsing large structures).'
      });
    }
    return recs;
  };

  const recommendations = getRecommendations();

  return (
    <div className="app-container">

      {/* Fixed Top Navbar */}
      <PulseNavbar
        theme={theme}
        setTheme={setTheme}
        searchPath={searchPath}
        setSearchPath={setSearchPath}
        pollInterval={pollInterval}
        setPollInterval={setPollInterval}
        isRefreshing={isRefreshing}
        fetchData={fetchData}
        system={system}
        isLiveStreaming={isLiveStreaming}
      />

      {/* Main Layout Workspace */}
      <div className="layout-main">
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          threatCount={threats.length}
          driftCount={requests.filter(r => r.drift?.hasSchemaMismatch).length}
        />

        {/* Scrollable Center Content Area */}
        <div className="content-area">
          {activeTab === 'dashboard' && (
            <DashboardTab
              data={data || {} as MonitorData}
              setActiveTab={setActiveTab}
              setSelectedRequest={setSelectedRequest}
              setSelectedAlert={setSelectedAlert}
            />
          )}

          {activeTab === 'requests' && (
            <RequestsTab
              requests={requests}
              selectedRequest={selectedRequest}
              setSelectedRequest={setSelectedRequest}
              searchPath={searchPath}
              filterMethod={filterMethod}
              setFilterMethod={setFilterMethod}
              filterStatus={filterStatus}
              setFilterStatus={setFilterStatus}
              handleTestRequest={handleTestRequest}
            />
          )}

          {activeTab === 'playground' && (
            <PlaygroundTab
              pgMethod={pgMethod}
              setPgMethod={setPgMethod}
              pgPath={pgPath}
              setPgPath={setPgPath}
              pgHeaders={pgHeaders}
              setPgHeaders={setPgHeaders}
              pgQueryParams={pgQueryParams}
              setPgQueryParams={setPgQueryParams}
              pgBody={pgBody}
              setPgBody={setPgBody}
              pgLoading={pgLoading}
              pgResponse={pgResponse}
              pgActiveSubTab={pgActiveSubTab}
              setPgActiveSubTab={setPgActiveSubTab}
              executePlaygroundRequest={executePlaygroundRequest}
            />
          )}

          {activeTab === 'security' && (
            <SecurityTab
              threats={threats}
              selectedAlert={selectedAlert}
              setSelectedAlert={setSelectedAlert}
            />
          )}

          {activeTab === 'health' && (
            <HealthTab system={system} />
          )}

          {activeTab === 'routes' && (
            <RoutesTab
              discoveredRoutes={discoveredRoutes}
              handleTestRoute={handleTestRoute}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsTab
              recommendations={recommendations}
              sandboxPayload={sandboxPayload}
              setSandboxPayload={setSandboxPayload}
              sandboxUA={sandboxUA}
              setSandboxUA={setSandboxUA}
              sandboxResult={sandboxResult}
              testSandbox={testSandbox}
              hasAuth={config.hasAuth}
              handleLogout={handleLogout}
            />
          )}
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav activeTab={activeTab} setActiveTab={setActiveTab} />

    </div>
  );
}

function formatBodyText(body: string) {
  if (!body) return '';
  try {
    const parsed = JSON.parse(body);
    return JSON.stringify(parsed, null, 2);
  } catch (e) {
    return body;
  }
}
