import { useState, useEffect, useRef } from 'react';
import { 
  Activity, 
  ShieldAlert, 
  Terminal, 
  RefreshCw, 
  Search, 
  Lock, 
  AlertTriangle, 
  CheckCircle, 
  Layers,
  X,
  Sun,
  Moon,
  Play,
  Settings
} from 'lucide-react';

interface SystemMetrics {
  memory: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
    systemTotal: number;
    systemFree: number;
  };
  uptime: number;
  cpuUsage: {
    user: number;
    system: number;
  };
  cpuCount: number;
  loadAvg: [number, number, number];
  nodeVersion: string;
  platform: string;
  pid: number;
  eventLoopLag: number;
}

interface RequestMetrics {
  timestamp: number;
  path: string;
  method: string;
  statusCode: number;
  durationMs: number;
  ip: string;
  userAgent?: string;
  reqBody?: string;
  resBody?: string;
  inferredReqType?: string;
  inferredResType?: string;
}

interface SecurityAlert {
  timestamp: number;
  ip: string;
  path: string;
  method: string;
  attackType: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  details: string;
}

interface MonitorData {
  system: SystemMetrics;
  requests: RequestMetrics[];
  threats: SecurityAlert[];
  discoveredRoutes?: Array<{ path: string; method: string }>;
  config: {
    enableThreatDetection: boolean;
    maxBufferSize: number;
    isServerless: boolean;
    dashboardEndpoint: string;
    hasAuth: boolean;
    logBodies?: boolean;
  };
}

interface Recommendation {
  id: string;
  type: 'security' | 'performance' | 'capacity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  action: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'requests' | 'security' | 'health' | 'settings' | 'routes'>('dashboard');
  const [authSecret, setAuthSecret] = useState<string>(() => localStorage.getItem('pulse_auth') || '');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [isAuthorized, setIsAuthorized] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('pulse_theme') as 'light' | 'dark') || 'light');
  
  const [data, setData] = useState<MonitorData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [pollInterval, setPollInterval] = useState<number>(5000); // 5s default polling interval
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  
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
        setLoading(false);
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
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // Setup polling
  useEffect(() => {
    fetchData();
    
    if (pollInterval > 0) {
      pollTimerRef.current = setInterval(() => {
        fetchData();
      }, pollInterval);
    }
    
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [pollInterval, authSecret]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput.trim()) return;
    localStorage.setItem('pulse_auth', passwordInput);
    setAuthSecret(passwordInput);
    setLoading(true);
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

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    parts.push(`${secs}s`);
    return parts.join(' ');
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
              style={{
                marginBottom: '1rem',
              }}
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

  if (loading && !data) {
    return (
      <div className="flex-center" style={{ minHeight: '100vh', flexDirection: 'column', gap: '1rem', backgroundColor: 'var(--bg-main)' }}>
        <RefreshCw className="animate-spin" size={28} style={{ color: 'var(--accent-primary)' }} />
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>Loading telemetry workspace...</p>
      </div>
    );
  }

  const { system, requests, threats, config, discoveredRoutes } = data || {
    system: { memory: { rss: 0, heapUsed: 0, heapTotal: 0, systemTotal: 0, systemFree: 0 }, uptime: 0, cpuUsage: { user: 0, system: 0 }, cpuCount: 1, loadAvg: [0, 0, 0], nodeVersion: '', platform: '', pid: 0, eventLoopLag: 0 },
    requests: [],
    threats: [],
    discoveredRoutes: [],
    config: { enableThreatDetection: false, maxBufferSize: 0, isServerless: false, dashboardEndpoint: '', hasAuth: false }
  };

  // Calculations
  const totalRequests = requests.length;
  const failedRequests = requests.filter(r => r.statusCode >= 400).length;
  const errorRate = totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0;
  
  const avgLatency = totalRequests > 0 
    ? requests.reduce((acc, r) => acc + r.durationMs, 0) / totalRequests 
    : 0;

  // Percentiles
  let p95Latency = 0;
  let p99Latency = 0;
  if (totalRequests > 0) {
    const sortedLatencies = [...requests].map(r => r.durationMs).sort((a, b) => a - b);
    p95Latency = sortedLatencies[Math.floor(sortedLatencies.length * 0.95)] || sortedLatencies[sortedLatencies.length - 1];
    p99Latency = sortedLatencies[Math.floor(sortedLatencies.length * 0.99)] || sortedLatencies[sortedLatencies.length - 1];
  }

  // Active load average check
  const activeLoad = system.loadAvg ? system.loadAvg[0] : 0;

  // Real-time API traffic over the last 24 hours (simulated hourly aggregate or raw counts)
  const trafficChartPointsCount = Math.min(requests.length, 24);
  const trafficTrendData = requests.slice(-trafficChartPointsCount).map(r => r.durationMs);

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

  // Filter requests
  const filteredRequests = requests.filter(req => {
    const matchesPath = req.path.toLowerCase().includes(searchPath.toLowerCase()) || req.ip.includes(searchPath);
    const matchesMethod = filterMethod === 'ALL' || req.method === filterMethod;
    let matchesStatus = true;
    if (filterStatus !== 'ALL') {
      const codeClass = filterStatus.charAt(0);
      matchesStatus = String(req.statusCode).startsWith(codeClass);
    }
    return matchesPath && matchesMethod && matchesStatus;
  }).reverse();

  // Simulated sparkline history arrays
  const totalReqHistory = requests.map((_, i) => i + 1);
  const latencyHistory = requests.map(r => r.durationMs);
  const errorRateHistory = requests.map((_, i) => {
    const sub = requests.slice(0, i + 1);
    const fails = sub.filter(r => r.statusCode >= 400).length;
    return (fails / (sub.length || 1)) * 100;
  });
  const threatsHistory = threats.map((_, i) => i + 1);

  // CPU Gauge value
  const cpuPercent = system.cpuUsage ? Math.min(100, Math.max(0, (system.cpuUsage.user + system.cpuUsage.system) * 100)) : 15;
  // RAM Gauge value
  const ramPercent = system.memory.systemTotal ? ((system.memory.systemTotal - system.memory.systemFree) / system.memory.systemTotal) * 100 : 25;

  return (
    <div className="app-container">
      
      {/* Fixed Top Navbar */}
      <nav className="navbar glass-effect">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Activity size={22} style={{ color: 'var(--accent-primary)' }} />
          <span style={{ fontWeight: 700, fontSize: '1.2rem', letterSpacing: '-0.03em' }}>Pulse Monitor</span>
        </div>

        <div className="search-container" style={{ maxWidth: '450px' }}>
          <Search size={14} style={{ color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder="Search path or IP... (⌘ + F)" 
            value={searchPath}
            onChange={(e) => setSearchPath(e.target.value)}
            className="search-input"
          />
          {searchPath && <X size={13} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setSearchPath('')} />}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          
          <button 
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="flex-center"
            style={{
              padding: '0.45rem',
              background: 'var(--bg-main)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              cursor: 'pointer',
              color: 'var(--text-main)',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
          </button>

          <button 
            onClick={() => fetchData()}
            disabled={isRefreshing}
            className="flex-center"
            style={{
              padding: '0.45rem 0.75rem',
              background: 'var(--bg-main)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              cursor: 'pointer',
              color: 'var(--text-main)',
              fontSize: '0.75rem',
              gap: '0.35rem',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <RefreshCw size={11} className={isRefreshing ? "animate-spin" : ""} />
            Sync
          </button>

          <select
            value={pollInterval}
            onChange={(e) => setPollInterval(Number(e.target.value))}
            style={{
              padding: '0.45rem 1.8rem 0.45rem 0.60rem',
              background: 'var(--bg-main)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              cursor: 'pointer',
              color: 'var(--text-main)',
              fontSize: '0.75rem',
              outline: 'none',
              boxShadow: 'var(--shadow-sm)',
              appearance: 'none',
              WebkitAppearance: 'none',
              backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23888888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 0.5rem center',
              backgroundSize: '0.75rem'
            }}
          >
            <option value={3000}>3s Polling</option>
            <option value={5000}>5s Polling (Default)</option>
            <option value={10000}>10s Polling</option>
            <option value={30000}>30s Polling</option>
            <option value={0}>Manual Only</option>
          </select>

          {/* User Profile Card */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderLeft: '1px solid var(--border-color)', paddingLeft: '1rem' }}>
            <div style={{ width: '32px', height: '32px', background: 'var(--accent-primary)', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 600 }}>
              AD
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }} className="sidebar-collapsed-hide">
              <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Admin User</span>
              {config.hasAuth ? (
                <button onClick={handleLogout} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--accent-danger)', fontSize: '0.65rem', textAlign: 'left', cursor: 'pointer', fontWeight: 500 }}>Disconnect</button>
              ) : (
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>PID {system.pid || 'Host'}</span>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Layout Body */}
      <div className="layout-main">
        
        {/* Fixed Left Sidebar (Desktop Only) */}
        <aside className="sidebar">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button onClick={() => setActiveTab('dashboard')} className={`nav-link-item ${activeTab === 'dashboard' ? 'active' : ''}`}>
              <Layers size={16} />
              <span>Dashboard</span>
            </button>
            <button onClick={() => setActiveTab('requests')} className={`nav-link-item ${activeTab === 'requests' ? 'active' : ''}`}>
              <Terminal size={16} />
              <span>API Logs</span>
            </button>
            <button onClick={() => setActiveTab('security')} className={`nav-link-item ${activeTab === 'security' ? 'active' : ''}`}>
              <ShieldAlert size={16} />
              <span>Threats</span>
            </button>
            <button onClick={() => setActiveTab('health')} className={`nav-link-item ${activeTab === 'health' ? 'active' : ''}`}>
              <Activity size={16} />
              <span>Server Health</span>
            </button>
            <button onClick={() => setActiveTab('routes')} className={`nav-link-item ${activeTab === 'routes' ? 'active' : ''}`}>
              <Layers size={16} />
              <span>Routes Map</span>
            </button>
            <button onClick={() => setActiveTab('settings')} className={`nav-link-item ${activeTab === 'settings' ? 'active' : ''}`}>
              <Settings size={16} />
              <span>Settings</span>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '8px', height: '8px', background: 'var(--accent-success)', borderRadius: '50%' }}></div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{system.platform} server</span>
            </div>
            <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Uptime: {formatUptime(system.uptime)}</p>
          </div>
        </aside>

        {/* Scrollable Center Content Area */}
        <div className="content-area">
          
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Top Row: 4 stat cards */}
              <div className="stat-cards-grid">
                
                {/* Stat 1: Total Requests */}
                <div className="card">
                  <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>Total Requests</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '0.25rem', marginBottom: '0.75rem' }}>
                    <h3 style={{ fontSize: '1.8rem', fontWeight: 700, letterSpacing: '-0.03em' }}>{totalRequests}</h3>
                    <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>Active</span>
                  </div>
                  <div style={{ height: '30px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Total requests log</span>
                    <MiniSparkline data={totalReqHistory} color="var(--accent-primary)" />
                  </div>
                </div>

                {/* Stat 2: Error Rate % */}
                <div className="card">
                  <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>Error Rate %</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '0.25rem', marginBottom: '0.75rem' }}>
                    <h3 style={{ fontSize: '1.8rem', fontWeight: 700, letterSpacing: '-0.03em', color: errorRate > 0 ? 'var(--accent-danger)' : 'var(--text-main)' }}>{errorRate.toFixed(1)}%</h3>
                    <span className={`badge ${errorRate > 0 ? 'badge-danger' : 'badge-success'}`} style={{ fontSize: '0.65rem' }}>
                      {errorRate > 0 ? 'Anomaly' : 'Safe'}
                    </span>
                  </div>
                  <div style={{ height: '30px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Recent 4xx/5xx requests</span>
                    <MiniSparkline data={errorRateHistory} color="var(--accent-danger)" />
                  </div>
                </div>

                {/* Stat 3: Avg Latency */}
                <div className="card">
                  <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>Avg Latency</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '0.25rem', marginBottom: '0.75rem' }}>
                    <h3 style={{ fontSize: '1.8rem', fontWeight: 700, letterSpacing: '-0.03em' }}>{avgLatency.toFixed(1)} <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)' }}>ms</span></h3>
                    <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>p95/p99: {p95Latency.toFixed(0)}/{p99Latency.toFixed(0)}ms</span>
                  </div>
                  <div style={{ height: '30px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Rolling milliseconds lag</span>
                    <MiniSparkline data={latencyHistory} color="var(--accent-success)" />
                  </div>
                </div>

                {/* Stat 4: Active Threats */}
                <div className="card">
                  <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>Active Threats</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '0.25rem', marginBottom: '0.75rem' }}>
                    <h3 style={{ fontSize: '1.8rem', fontWeight: 700, letterSpacing: '-0.03em', color: threats.length > 0 ? 'var(--accent-danger)' : 'var(--text-main)' }}>{threats.length}</h3>
                    <span className={`badge ${threats.length > 0 ? 'badge-danger' : 'badge-success'}`} style={{ fontSize: '0.65rem' }}>
                      {threats.length > 0 ? 'Blocked' : 'Secure'}
                    </span>
                  </div>
                  <div style={{ height: '30px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Signature-matched threats</span>
                    <MiniSparkline data={threatsHistory} color="var(--accent-warning)" />
                  </div>
                </div>

              </div>

              {/* Middle Row: Area traffic chart and circular gauges */}
              <div className="middle-cards-grid">
                
                {/* Traffic Trend Chart */}
                <div className="card" style={{ minHeight: '340px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Real-time API Traffic</h4>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total duration trend of connections over the active buffer</p>
                    </div>
                    <span style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>MS LATENCY HISTORY</span>
                  </div>
                  <div style={{ background: 'var(--bg-input)', padding: '1rem', borderRadius: '12px', flexGrow: 1, display: 'flex', alignItems: 'center' }}>
                    <TrafficAreaChart data={trafficTrendData} color="var(--accent-primary)" />
                  </div>
                </div>

                {/* Server Health (Circular Gauges) */}
                <div className="card">
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.25rem' }}>Server Health</h4>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Physical resource utilization</p>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', flexGrow: 1, gap: '1rem', flexWrap: 'wrap' }}>
                    <CircularGauge value={cpuPercent} label="CPU Load" color="var(--accent-primary)" />
                    <CircularGauge value={ramPercent} label="RAM Usage" color="var(--accent-success)" />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1.5rem', fontSize: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Load avg (1m)</span>
                      <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{activeLoad.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Event loop lag</span>
                      <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{system.eventLoopLag.toFixed(1)} ms</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Bottom Row: Logs table and blocked threat list */}
              <div className="bottom-cards-grid">
                
                {/* Recent API Logs */}
                <div className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Recent API Logs</h4>
                    <button onClick={() => setActiveTab('requests')} style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
                      View all &rarr;
                    </button>
                  </div>
                  {requests.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>No transaction history found.</div>
                  ) : (
                    <div className="table-container">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Method</th>
                            <th>Endpoint</th>
                            <th>Status</th>
                            <th>Latency</th>
                            <th>Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {requests.slice(-5).reverse().map((req, idx) => (
                            <tr key={idx} onClick={() => { setSelectedRequest(req); setActiveTab('requests'); }} style={{ cursor: 'pointer' }}>
                              <td>
                                <span className="badge" style={getMethodBadgeStyle(req.method)}>
                                  {req.method}
                                </span>
                              </td>
                              <td style={{ fontWeight: 500, fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{req.path}</td>
                              <td>
                                <span style={{ color: getStatusClassColor(req.statusCode), fontWeight: 700 }}>{req.statusCode}</span>
                              </td>
                              <td style={{ fontFamily: 'var(--font-mono)' }}>{req.durationMs.toFixed(0)} ms</td>
                              <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(req.timestamp).toLocaleTimeString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Threat Detection block */}
                <div className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Threat Detection</h4>
                    <button onClick={() => setActiveTab('security')} style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
                      Audit logs &rarr;
                    </button>
                  </div>

                  {threats.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>No intrusion threats blocked. Host is safe.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto', maxHeight: '260px' }}>
                      {threats.slice(-3).reverse().map((alert, idx) => (
                        <div 
                          key={idx} 
                          style={{ background: 'var(--bg-input)', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.25rem', cursor: 'pointer' }}
                          onClick={() => { setSelectedAlert(alert); setActiveTab('security'); }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>{alert.attackType}</span>
                            <span className={`badge ${alert.severity === 'CRITICAL' || alert.severity === 'HIGH' ? 'badge-danger' : 'badge-warning'}`}>
                              {alert.severity}
                            </span>
                          </div>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {alert.method} {alert.path}
                          </p>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-light)', fontFamily: 'var(--font-mono)' }}>IP: {alert.ip}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

            </div>
          )}

          {/* API Logs Tab */}
          {activeTab === 'requests' && (
            <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: selectedRequest ? '2fr 1fr' : '1fr', gap: '1.5rem' }}>
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 600 }}>API Requests Log</h4>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <select 
                      value={filterMethod} 
                      onChange={(e) => setFilterMethod(e.target.value)}
                      className="form-input"
                      style={{ fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}
                    >
                      <option value="ALL">All methods</option>
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                      <option value="PUT">PUT</option>
                      <option value="DELETE">DELETE</option>
                    </select>
                    <select 
                      value={filterStatus} 
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="form-input"
                      style={{ fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}
                    >
                      <option value="ALL">All statuses</option>
                      <option value="2">2xx Success</option>
                      <option value="3">3xx Redirect</option>
                      <option value="4">4xx Client error</option>
                      <option value="5">5xx Server error</option>
                    </select>
                  </div>
                </div>

                {filteredRequests.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No logged requests found.</div>
                ) : (
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>Method</th>
                          <th>Endpoint</th>
                          <th>Status</th>
                          <th>Client IP</th>
                          <th>Latency</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRequests.map((req, idx) => (
                          <tr key={idx} onClick={() => setSelectedRequest(req)} style={{ cursor: 'pointer', background: selectedRequest?.timestamp === req.timestamp ? 'rgba(99, 102, 241, 0.04)' : 'transparent' }}>
                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-light)' }}>{new Date(req.timestamp).toLocaleTimeString()}</td>
                            <td>
                              <span className="badge" style={getMethodBadgeStyle(req.method)}>
                                {req.method}
                              </span>
                            </td>
                            <td style={{ fontWeight: 500, fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{req.path}</td>
                            <td>
                              <span style={{ color: getStatusClassColor(req.statusCode), fontWeight: 700 }}>{req.statusCode}</span>
                            </td>
                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{req.ip}</td>
                            <td style={{ fontFamily: 'var(--font-mono)' }}>{req.durationMs.toFixed(1)} ms</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {selectedRequest && (
                <div className="card" style={{ height: 'fit-content', display: 'flex', flexDirection: 'column', gap: '1.25rem', position: 'sticky', top: '0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 600 }}>Request details</h4>
                    <button onClick={() => setSelectedRequest(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                      <X size={15} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <span className="badge" style={getMethodBadgeStyle(selectedRequest.method)}>{selectedRequest.method}</span>
                    <span className="badge badge-primary">{selectedRequest.statusCode} code</span>
                    <span className="badge badge-success">{selectedRequest.durationMs.toFixed(0)} ms</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.8rem' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Path:</span>
                      <p style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg-input)', padding: '0.45rem', borderRadius: '6px', marginTop: '0.15rem', color: 'var(--accent-primary)', wordBreak: 'break-all' }}>
                        {selectedRequest.path}
                      </p>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Source IP:</span>
                      <p style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg-input)', padding: '0.45rem', borderRadius: '6px', marginTop: '0.15rem' }}>{selectedRequest.ip}</p>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Timestamp:</span>
                      <p style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg-input)', padding: '0.45rem', borderRadius: '6px', marginTop: '0.15rem' }}>{new Date(selectedRequest.timestamp).toLocaleString()}</p>
                    </div>
                    {selectedRequest.userAgent && (
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>User-Agent:</span>
                        <p style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg-input)', padding: '0.45rem', borderRadius: '6px', marginTop: '0.15rem', fontSize: '0.75rem', lineHeight: '1.4' }}>
                          {selectedRequest.userAgent}
                        </p>
                      </div>
                    )}
                    {selectedRequest.inferredReqType && (
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>TypeScript Interface (Inferred Request Body):</span>
                        <pre style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg-input)', padding: '0.45rem', borderRadius: '6px', marginTop: '0.15rem', fontSize: '0.75rem', overflowX: 'auto', border: '1px solid var(--border-color)', color: '#818cf8' }}>
                          {`interface RequestBody ${selectedRequest.inferredReqType}`}
                        </pre>
                      </div>
                    )}
                    {selectedRequest.reqBody && (
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Request Body Payload:</span>
                        <pre style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg-input)', padding: '0.45rem', borderRadius: '6px', marginTop: '0.15rem', fontSize: '0.75rem', overflowX: 'auto', border: '1px solid var(--border-color)', color: 'var(--text-light)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                          {selectedRequest.reqBody}
                        </pre>
                      </div>
                    )}
                    {selectedRequest.inferredResType && (
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>TypeScript Interface (Inferred Response Body):</span>
                        <pre style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg-input)', padding: '0.45rem', borderRadius: '6px', marginTop: '0.15rem', fontSize: '0.75rem', overflowX: 'auto', border: '1px solid var(--border-color)', color: '#34d399' }}>
                          {`interface ResponseBody ${selectedRequest.inferredResType}`}
                        </pre>
                      </div>
                    )}
                    {selectedRequest.resBody && (
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Response Body Payload:</span>
                        <pre style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg-input)', padding: '0.45rem', borderRadius: '6px', marginTop: '0.15rem', fontSize: '0.75rem', overflowX: 'auto', border: '1px solid var(--border-color)', color: 'var(--text-light)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                          {selectedRequest.resBody}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Discovered Routes Tab */}
          {activeTab === 'routes' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Upfront API Route Discovery</h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Automatically discovered routing structure scanned from the router stack on startup.
                    </p>
                  </div>
                  <span className="badge badge-success">
                    {discoveredRoutes ? discoveredRoutes.length : 0} Routes Found
                  </span>
                </div>

                {!discoveredRoutes || discoveredRoutes.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No routes discovered yet. Routes will populate when the first request hits the server.
                  </div>
                ) : (
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th style={{ width: '150px' }}>Method</th>
                          <th>Route Path</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {discoveredRoutes.map((route, idx) => (
                          <tr key={idx}>
                            <td>
                              <span className="badge" style={getMethodBadgeStyle(route.method)}>
                                {route.method}
                              </span>
                            </td>
                            <td style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-main)' }}>
                              {route.path}
                            </td>
                            <td>
                              <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>Active</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Threats Tab */}
          {activeTab === 'security' && (
            <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: selectedAlert ? '2fr 1fr' : '1fr', gap: '1.5rem' }}>
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Blocked Threat Signatures</h4>

                {threats.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No threat alerts recorded. The server is secure.</div>
                ) : (
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>Attack type</th>
                          <th>Method</th>
                          <th>Endpoint</th>
                          <th>Severity</th>
                          <th>Source IP</th>
                        </tr>
                      </thead>
                      <tbody>
                        {threats.slice().reverse().map((alert, idx) => (
                          <tr key={idx} onClick={() => setSelectedAlert(alert)} style={{ cursor: 'pointer', background: selectedAlert?.timestamp === alert.timestamp ? 'rgba(99, 102, 241, 0.04)' : 'transparent' }}>
                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-light)' }}>{new Date(alert.timestamp).toLocaleTimeString()}</td>
                            <td style={{ fontWeight: 600 }}>{alert.attackType}</td>
                            <td>
                              <span className="badge" style={getMethodBadgeStyle(alert.method)}>{alert.method}</span>
                            </td>
                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{alert.path}</td>
                            <td>
                              <span className={`badge ${alert.severity === 'CRITICAL' || alert.severity === 'HIGH' ? 'badge-danger' : 'badge-warning'}`}>{alert.severity}</span>
                            </td>
                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{alert.ip}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {selectedAlert && (
                <div className="card" style={{ height: 'fit-content', display: 'flex', flexDirection: 'column', gap: '1.25rem', borderLeft: '3px solid var(--accent-danger)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 600 }}>Threat details</h4>
                    <button onClick={() => setSelectedAlert(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                      <X size={15} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <span className="badge badge-danger">{selectedAlert.severity} Severity</span>
                    <span className="badge badge-primary">{selectedAlert.attackType}</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.8rem' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Target route:</span>
                      <p style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg-input)', padding: '0.45rem', borderRadius: '6px', marginTop: '0.15rem', color: 'var(--accent-danger)', wordBreak: 'break-all' }}>
                        {selectedAlert.method} {selectedAlert.path}
                      </p>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Source IP:</span>
                      <p style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg-input)', padding: '0.45rem', borderRadius: '6px', marginTop: '0.15rem' }}>{selectedAlert.ip}</p>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Details:</span>
                      <p style={{ background: 'var(--bg-input)', padding: '0.55rem', borderRadius: '6px', marginTop: '0.15rem', lineHeight: '1.4', fontSize: '0.775rem' }}>{selectedAlert.details}</p>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Timestamp:</span>
                      <p style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg-input)', padding: '0.45rem', borderRadius: '6px', marginTop: '0.15rem' }}>{new Date(selectedAlert.timestamp).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Server Health detailed tab */}
          {activeTab === 'health' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="card">
                <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.25rem' }}>Process Resource Footprint</h4>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Deep hardware capacity, thread responsiveness, and VM heap details</p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }} className="middle-cards-grid">
                  
                  {/* Performance Indicators */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="card" style={{ padding: '1rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Node processor count</span>
                      <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.25rem' }}>{system.cpuCount} Cores</h3>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Host environment platform: {system.platform}</p>
                    </div>

                    <div className="card" style={{ padding: '1rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Main thread lag delay</span>
                      <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.25rem', color: system.eventLoopLag > 40 ? 'var(--accent-danger)' : 'var(--text-main)' }}>
                        {system.eventLoopLag.toFixed(1)} ms
                      </h3>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Execution queue intervals</p>
                    </div>

                    {system.loadAvg && (
                      <div className="card" style={{ padding: '1rem' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Load Averages (1m, 5m, 15m)</span>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.25rem', fontFamily: 'var(--font-mono)' }}>
                          {system.loadAvg.join(', ')}
                        </h3>
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Standard Unix physical thread levels</p>
                      </div>
                    )}
                  </div>

                  {/* Memory gauges */}
                  <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Node Heap Used</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{system.memory.heapUsed.toFixed(0)}MB / {system.memory.heapTotal.toFixed(0)}MB</span>
                      </div>
                      <div style={{ width: '100%', height: '8px', background: 'var(--bg-input)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${(system.memory.heapUsed / system.memory.heapTotal) * 100}%`, height: '100%', background: 'var(--accent-primary)', borderRadius: '4px' }}></div>
                      </div>
                    </div>

                    {system.memory.systemTotal && (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Host System RAM</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{(system.memory.systemTotal - system.memory.systemFree).toFixed(0)}MB / {system.memory.systemTotal.toFixed(0)}MB</span>
                        </div>
                        <div style={{ width: '100%', height: '8px', background: 'var(--bg-input)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${((system.memory.systemTotal - system.memory.systemFree) / system.memory.systemTotal) * 100}%`, height: '100%', background: 'var(--accent-success)', borderRadius: '4px' }}></div>
                        </div>
                      </div>
                    )}

                    <div style={{ background: 'var(--bg-input)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem', lineHeight: '1.4' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>RSS Footprint: </span>
                      {system.memory.rss.toFixed(0)}MB total physical memory mapped to the host node.js process.
                    </div>
                  </div>

                </div>
              </div>
            </div>
          )}

          {/* Settings / Threat Sandbox */}
          {activeTab === 'settings' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Diagnostic Suggestions */}
              {recommendations.length > 0 && (
                <div className="card">
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '1rem' }}>Diagnostic suggestions</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {recommendations.map((rec) => (
                      <div 
                        key={rec.id} 
                        style={{ borderLeft: `3px solid var(--accent-primary)`, paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}
                      >
                        <h5 style={{ fontSize: '0.85rem', fontWeight: 600 }}>{rec.title}</h5>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{rec.description}</p>
                        <div style={{ background: 'var(--bg-input)', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                          <span style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>Action: </span>{rec.action}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Threat Sandbox */}
              <div className="card">
                <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.25rem' }}>Threat Sandbox</h4>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Inspect string injection payloads and user-agents against blacklisted patterns</p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }} className="middle-cards-grid">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 500 }}>Payload / URL Parameters</label>
                      <textarea 
                        value={sandboxPayload}
                        onChange={(e) => setSandboxPayload(e.target.value)}
                        className="form-input"
                        rows={4}
                        style={{ resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 500 }}>Scanner User-Agent</label>
                      <input 
                        type="text"
                        value={sandboxUA}
                        onChange={(e) => setSandboxUA(e.target.value)}
                        className="form-input"
                        style={{ fontSize: '0.8rem' }}
                      />
                    </div>

                    <button 
                      onClick={testSandbox}
                      className="flex-center"
                      style={{
                        padding: '0.65rem',
                        background: 'var(--accent-primary)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        gap: '0.35rem'
                      }}
                    >
                      <Play size={12} fill="white" />
                      Test Signature
                    </button>
                  </div>

                  <div style={{ background: 'var(--bg-input)', borderRadius: '12px', padding: '1.25rem', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Console Analysis Output</span>

                    {sandboxResult === null ? (
                      <div style={{ textAlign: 'center', margin: 'auto 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        Click "Test Signature" to run mock evaluation.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.8rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {sandboxResult.detected ? (
                            <>
                              <AlertTriangle size={18} style={{ color: 'var(--accent-danger)' }} />
                              <span style={{ fontWeight: 700, color: 'var(--accent-danger)', fontSize: '0.85rem' }}>Anomaly signature identified!</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle size={18} style={{ color: 'var(--accent-success)' }} />
                              <span style={{ fontWeight: 700, color: 'var(--accent-success)', fontSize: '0.85rem' }}>Verified safe payload</span>
                            </>
                          )}
                        </div>

                        {sandboxResult.detected && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
                            <div>
                              <span style={{ color: 'var(--text-muted)' }}>Threat Category:</span>
                              <span style={{ fontWeight: 600, marginLeft: '0.35rem' }}>{sandboxResult.attackType}</span>
                            </div>
                            <div>
                              <span style={{ color: 'var(--text-muted)' }}>Severity Level:</span>
                              <span className="badge badge-danger" style={{ marginLeft: '0.35rem' }}>{sandboxResult.severity}</span>
                            </div>
                            <div>
                              <span style={{ color: 'var(--text-muted)' }}>Triggering details:</span>
                              <p style={{ background: 'var(--bg-card)', padding: '0.45rem', borderRadius: '6px', border: '1px solid var(--border-color)', marginTop: '0.15rem', fontSize: '0.75rem' }}>
                                {sandboxResult.details}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* Mobile Bottom Navigation Bar (Visible on mobile/tablets only) */}
      <nav className="mobile-bottom-nav">
        <button onClick={() => setActiveTab('dashboard')} className={`mobile-nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}>
          <Layers size={18} />
          <span>Dashboard</span>
        </button>
        <button onClick={() => setActiveTab('requests')} className={`mobile-nav-btn ${activeTab === 'requests' ? 'active' : ''}`}>
          <Terminal size={18} />
          <span>API Logs</span>
        </button>
        <button onClick={() => setActiveTab('security')} className={`mobile-nav-btn ${activeTab === 'security' ? 'active' : ''}`}>
          <ShieldAlert size={18} />
          <span>Threats</span>
        </button>
        <button onClick={() => setActiveTab('health')} className={`mobile-nav-btn ${activeTab === 'health' ? 'active' : ''}`}>
          <Activity size={18} />
          <span>Health</span>
        </button>
        <button onClick={() => setActiveTab('settings')} className={`mobile-nav-btn ${activeTab === 'settings' ? 'active' : ''}`}>
          <Settings size={18} />
          <span>Settings</span>
        </button>
      </nav>

    </div>
  );
}



// Mini Sparkline component for Stat Cards
function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) {
    return (
      <svg width="70" height="20" viewBox="0 0 70 20">
        <line x1="0" y1="10" x2="70" y2="10" stroke={color} strokeWidth="1" strokeDasharray="2" />
      </svg>
    );
  }
  const width = 70;
  const height = 20;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min === 0 ? 1 : max - min;
  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * width;
    const y = height - 2 - ((val - min) / range) * (height - 4);
    return `${x},${y}`;
  }).join(' ');
  
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', overflow: 'visible' }}>
      <polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
}

// Circular progress gauge component
function CircularGauge({ value, label, color }: { value: number; label: string; color: string }) {
  const radius = 30;
  const stroke = 5;
  const circumference = 2 * Math.PI * radius; // ~188.5
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference;

  return (
    <div className="gauge-container" style={{ width: '80px', height: '80px' }}>
      <svg width="80" height="80" viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)', display: 'block' }}>
        <circle cx="40" cy="40" r={radius} fill="none" stroke="var(--bg-input)" strokeWidth={stroke} />
        <circle 
          cx="40" 
          cy="40" 
          r={radius} 
          fill="none" 
          stroke={color} 
          strokeWidth={stroke} 
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease-out' }}
        />
      </svg>
      <div className="gauge-center-text">
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>{value.toFixed(0)}%</span>
        <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
      </div>
    </div>
  );
}

// Real-time Traffic Area Chart component
function TrafficAreaChart({ data, color }: { data: number[]; color: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);

  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });
    resizeObserver.observe(containerRef.current);
    setWidth(containerRef.current.clientWidth);
    return () => resizeObserver.disconnect();
  }, []);

  const height = 220;
  if (data.length === 0) {
    return (
      <div ref={containerRef} className="flex-center" style={{ height, color: 'var(--text-muted)', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
        Awaiting transaction flow...
      </div>
    );
  }

  const padding = 15;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min === 0 ? 1 : max - min;

  const points = data.map((val, idx) => {
    const x = padding + (idx / (data.length - 1 || 1)) * chartWidth;
    const y = height - padding - ((val - min) / range) * chartHeight;
    return { x, y };
  });

  const linePath = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

  return (
    <div ref={containerRef} style={{ width: '100%', height, position: 'relative' }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id="trafficGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="var(--border-color)" strokeDasharray="3" />
        <line x1={padding} y1={padding + chartHeight / 2} x2={width - padding} y2={padding + chartHeight / 2} stroke="var(--border-color)" strokeDasharray="3" />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="var(--border-color)" />

        <path d={areaPath} fill="url(#trafficGrad)" />
        <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {points.map((p, idx) => (
          <circle key={idx} cx={p.x} cy={p.y} r="3.5" fill="var(--bg-card)" stroke={color} strokeWidth="2" />
        ))}

        <text x={padding} y={padding - 4} fill="var(--text-muted)" fontSize="8.5" fontFamily="var(--font-mono)">
          Peak: {max.toFixed(0)} ms
        </text>
        <text x={padding} y={height - padding + 12} fill="var(--text-muted)" fontSize="8.5" fontFamily="var(--font-mono)">
          Min: {min.toFixed(0)} ms
        </text>
      </svg>
    </div>
  );
}

// Styling mapping helpers
function getMethodBadgeStyle(method: string) {
  switch (method) {
    case 'GET': return { background: 'rgba(16, 185, 129, 0.08)', color: 'var(--accent-success)', fontWeight: 600 };
    case 'POST': return { background: 'rgba(99, 102, 241, 0.08)', color: 'var(--accent-primary)', fontWeight: 600 };
    case 'PUT': return { background: 'rgba(245, 158, 11, 0.08)', color: 'var(--accent-warning)', fontWeight: 600 };
    case 'DELETE': return { background: 'rgba(239, 68, 68, 0.08)', color: 'var(--accent-danger)', fontWeight: 600 };
    default: return { background: 'var(--bg-input)', color: 'var(--text-muted)' };
  }
}

function getStatusClassColor(code: number) {
  if (code >= 200 && code < 300) return 'var(--accent-success)';
  if (code >= 300 && code < 400) return 'var(--accent-primary)';
  if (code >= 400 && code < 500) return 'var(--accent-warning)';
  return 'var(--accent-danger)';
}
