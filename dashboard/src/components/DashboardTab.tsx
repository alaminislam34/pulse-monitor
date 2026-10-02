import { useMemo } from 'react';
import { MonitorData, RequestMetrics, SecurityAlert, DiscoveredEndpoint } from '../types';
import { MiniSparkline, TrafficAreaChart } from './Charts';
import { 
  Activity, AlertTriangle, Zap, ShieldCheck, 
  Layers, CheckCircle, ArrowRight, Play, Cpu, HardDrive
} from 'lucide-react';

interface DashboardTabProps {
  data: MonitorData;
  setActiveTab: (tab: 'dashboard' | 'requests' | 'security' | 'health' | 'settings' | 'routes' | 'playground') => void;
  setSelectedRequest: (req: RequestMetrics | null) => void;
  setSelectedAlert: (alert: SecurityAlert | null) => void;
  onInspectEndpoint: (endpoint: DiscoveredEndpoint) => void;
}

export function DashboardTab({ 
  data, 
  setActiveTab, 
  setSelectedRequest, 
  setSelectedAlert,
  onInspectEndpoint: _onInspectEndpoint 
}: DashboardTabProps) {
  const { system, requests, threats, discoveredRoutes = [], documentedRoutes = [] } = data;

  // Build unified endpoints list
  const allEndpoints: DiscoveredEndpoint[] = useMemo(() => {
    const map = new Map<string, DiscoveredEndpoint>();

    documentedRoutes.forEach(doc => {
      const key = `${doc.method.toUpperCase()} ${doc.path}`;
      map.set(key, { ...doc });
    });

    discoveredRoutes.forEach(disc => {
      const key = `${disc.method.toUpperCase()} ${disc.path}`;
      if (!map.has(key)) {
        const isAlreadyCovered = documentedRoutes.some(doc => {
          if (doc.method.toUpperCase() !== disc.method.toUpperCase()) return false;
          const regexStr = '^' + doc.path.replace(/\{[^}]+\}/g, '[^/]+') + '$';
          return new RegExp(regexStr).test(disc.path);
        });

        if (!isAlreadyCovered) {
          map.set(key, {
            path: disc.path,
            method: disc.method.toUpperCase(),
            summary: `${disc.method.toUpperCase()} ${disc.path}`,
            tags: [disc.path.split('/')[2] ? disc.path.split('/')[2] : 'General'],
          });
        }
      }
    });

    return Array.from(map.values());
  }, [discoveredRoutes, documentedRoutes]);

  // Calculations
  const totalRequests = requests.length;
  const failedRequests = requests.filter(r => r.statusCode >= 400).length;
  const errorRate = totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0;
  
  const avgLatency = totalRequests > 0 
    ? requests.reduce((acc, r) => acc + r.durationMs, 0) / totalRequests 
    : 0;

  // Percentiles
  let p95Latency = 0;
  if (totalRequests > 0) {
    const sortedLatencies = [...requests].map(r => r.durationMs).sort((a, b) => a - b);
    p95Latency = sortedLatencies[Math.floor(sortedLatencies.length * 0.95)] || sortedLatencies[sortedLatencies.length - 1];
  }

  // Active load average check
  const activeLoad = system.loadAvg ? system.loadAvg[0] : 0;

  // Latency trend points
  const trafficTrendData = requests.slice(-20).map(r => r.durationMs);

  // Sparklines
  const totalReqHistory = requests.map((_, i) => i + 1);
  const latencyHistory = requests.map(r => r.durationMs);
  const errorRateHistory = requests.map((_, i) => {
    const sub = requests.slice(0, i + 1);
    const fails = sub.filter(r => r.statusCode >= 400).length;
    return (fails / (sub.length || 1)) * 100;
  });

  // CPU and RAM Percentages
  const cpuPercent = system.cpuUsage ? Math.min(100, Math.max(0, (system.cpuUsage.user + system.cpuUsage.system) * 100)) : 15;
  const heapPercent = system.memory.heapTotal > 0 ? Math.min(100, (system.memory.heapUsed / system.memory.heapTotal) * 100) : 40;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* ── Top Row: 4 Metric Cards (Stripe Style) ── */}
      <div className="stat-cards-grid">
        
        {/* Stat 1: Total Requests */}
        <div className="card stat-card-stripe">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Total Requests</span>
            <div className="stat-icon-round primary">
              <Activity size={15} strokeWidth={2.4} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '0.4rem', marginBottom: '0.6rem' }}>
            <h3 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.03em', fontFamily: 'var(--font-sans)' }}>
              {totalRequests.toLocaleString()}
            </h3>
            <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>
              Live Stream
            </span>
          </div>
          <div style={{ height: '24px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Recorded buffer log</span>
            <MiniSparkline data={totalReqHistory} color="var(--accent-primary)" />
          </div>
        </div>

        {/* Stat 2: Error Rate % */}
        <div className="card stat-card-stripe">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Error Rate %</span>
            <div className="stat-icon-round danger">
              <AlertTriangle size={15} strokeWidth={2.4} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '0.4rem', marginBottom: '0.6rem' }}>
            <h3 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.03em', color: errorRate > 0 ? 'var(--accent-danger)' : 'var(--text-main)' }}>
              {errorRate.toFixed(1)}%
            </h3>
            <span className={`badge ${errorRate > 0 ? 'badge-danger' : 'badge-success'}`} style={{ fontSize: '0.65rem' }}>
              {errorRate > 0 ? 'Anomaly' : 'Healthy'}
            </span>
          </div>
          <div style={{ height: '24px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>4xx/5xx failures</span>
            <MiniSparkline data={errorRateHistory} color="var(--accent-danger)" />
          </div>
        </div>

        {/* Stat 3: Avg Latency */}
        <div className="card stat-card-stripe">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Avg Latency</span>
            <div className="stat-icon-round success">
              <Zap size={15} strokeWidth={2.4} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '0.4rem', marginBottom: '0.6rem' }}>
            <h3 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.03em' }}>
              {avgLatency.toFixed(1)} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)' }}>ms</span>
            </h3>
            <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>
              p95: {p95Latency.toFixed(0)}ms
            </span>
          </div>
          <div style={{ height: '24px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Execution speed</span>
            <MiniSparkline data={latencyHistory} color="var(--accent-success)" />
          </div>
        </div>

        {/* Stat 4: Pre-defined APIs (Swagger Endpoint Catalog Count) */}
        <div 
          className="card stat-card-stripe" 
          onClick={() => setActiveTab('routes')}
          style={{ cursor: 'pointer' }}
          title="Open API Endpoints Catalog"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Pre-defined APIs</span>
            <div className="stat-icon-round primary">
              <Layers size={15} strokeWidth={2.4} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '0.4rem', marginBottom: '0.6rem' }}>
            <h3 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--accent-primary)' }}>
              {allEndpoints.length} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)' }}>Routes</span>
            </h3>
            <span className="badge badge-success" style={{ fontSize: '0.65rem', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
              <CheckCircle size={10} /> 100% Ready
            </span>
          </div>
          <div style={{ height: '24px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
              Swagger Catalog &rarr;
            </span>
            <ArrowRight size={13} color="var(--accent-primary)" />
          </div>
        </div>

      </div>

      {/* ── Middle Row: Latency Area Chart + Host Resource Footprint ── */}
      <div className="middle-cards-grid">
        
        {/* Latency & Throughput Trend Chart */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>Transaction Latency Stream</h4>
                <span className="status-dot-pulse" />
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Real-time execution duration over ring buffer</p>
            </div>
            <span style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', background: 'var(--bg-input)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
              MS HISTORY
            </span>
          </div>
          <div style={{ background: 'var(--bg-input)', padding: '0.75rem 1rem', borderRadius: '8px', flexGrow: 1, border: '1px solid var(--border-color)' }}>
            <TrafficAreaChart data={trafficTrendData} color="var(--accent-primary)" />
          </div>
        </div>

        {/* Host Resource & Infrastructure Footprint */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.15rem' }}>Infrastructure Footprint</h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Local Node process thread & memory consumption</p>
          </div>

          {/* CPU Progress */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.35rem' }}>
              <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Cpu size={12} /> CPU Utilization
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                {cpuPercent.toFixed(1)}% ({system.cpuCount} Cores)
              </span>
            </div>
            <div className="progress-bar-bg">
              <div className="progress-bar-fill green" style={{ width: `${Math.max(5, cpuPercent)}%` }} />
            </div>
          </div>

          {/* Node Heap Memory */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.35rem' }}>
              <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <HardDrive size={12} /> Node V8 Heap
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                {system.memory.heapUsed.toFixed(0)}MB / {system.memory.heapTotal.toFixed(0)}MB
              </span>
            </div>
            <div className="progress-bar-bg">
              <div className="progress-bar-fill blue" style={{ width: `${Math.max(5, heapPercent)}%` }} />
            </div>
          </div>

          {/* Details Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: 'auto' }}>
            <div className="metric-pill-box">
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Event Loop Lag</span>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: system.eventLoopLag > 40 ? 'var(--accent-danger)' : 'var(--text-main)' }}>
                {system.eventLoopLag.toFixed(1)} ms
              </span>
            </div>
            <div className="metric-pill-box">
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Load Avg (1m)</span>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                {activeLoad.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* ── Premier Centerpiece: Pre-defined API Endpoints Catalog (Swagger style) ── */}
      <div className="card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Pre-defined API Endpoints Catalog
              </h4>
              <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>
                {allEndpoints.length} Available
              </span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              All documented routes ready to click, inspect parameter contracts, and execute live tests.
            </p>
          </div>

          <button 
            onClick={() => setActiveTab('routes')}
            style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
          >
            <span>Full API Explorer</span>
            <ArrowRight size={13} />
          </button>
        </div>

        {allEndpoints.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            No API endpoints discovered yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {allEndpoints.slice(0, 6).map((ep, idx) => {
              const isDocumented = documentedRoutes.some(d => d.path === ep.path && d.method.toUpperCase() === ep.method.toUpperCase());
              return (
                <div 
                  key={idx}
                  className="endpoint-row-card compact"
                  onClick={() => setActiveTab('routes')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexGrow: 1, minWidth: 0 }}>
                    <span className={`method-badge ${ep.method.toLowerCase()}`}>
                      {ep.method}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {ep.path}
                    </span>
                    {ep.summary && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        — {ep.summary}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                    {isDocumented ? (
                      <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>
                        Verified Spec
                      </span>
                    ) : (
                      <span className="badge" style={{ background: 'var(--bg-input)', color: 'var(--text-muted)', fontSize: '0.65rem' }}>
                        Route
                      </span>
                    )}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveTab('routes');
                      }}
                      className="btn-try-endpoint"
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.65rem' }}
                    >
                      <Play size={9} fill="#00AA45" color="#00AA45" />
                      <span>Test API</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Bottom Row: Recent Live Traffic Logs + Threat Watchdog ── */}
      <div className="bottom-cards-grid">
        
        {/* Recent API Logs Table */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Recent Live Traffic</h4>
            <button onClick={() => setActiveTab('requests')} style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
              View all requests &rarr;
            </button>
          </div>
          {requests.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>No recent requests logged.</div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Method</th>
                    <th>Path</th>
                    <th>Status</th>
                    <th>Latency</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.slice(-5).reverse().map((req, idx) => (
                    <tr key={idx} onClick={() => { setSelectedRequest(req); setActiveTab('requests'); }} style={{ cursor: 'pointer' }}>
                      <td>
                        <span className={`method-badge ${req.method.toLowerCase()}`}>
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

        {/* Threat Detection Audit */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Threat Watchdog</h4>
            <button onClick={() => setActiveTab('security')} style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
              Security audit &rarr;
            </button>
          </div>

          {threats.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              <ShieldCheck size={28} strokeWidth={1.5} color="var(--accent-success)" style={{ margin: '0 auto 0.5rem' }} />
              <div>Zero intrusion threats detected. System is safe.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto', maxHeight: '240px' }}>
              {threats.slice(-3).reverse().map((alert, idx) => (
                <div 
                  key={idx} 
                  style={{ background: 'var(--bg-input)', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.2rem', cursor: 'pointer' }}
                  onClick={() => { setSelectedAlert(alert); setActiveTab('security'); }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--accent-danger)' }}>{alert.attackType}</span>
                    <span className="badge badge-danger">
                      {alert.severity}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {alert.method} {alert.path}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}

function getStatusClassColor(code: number) {
  if (code >= 200 && code < 300) return 'var(--accent-success)';
  if (code >= 300 && code < 400) return 'var(--accent-warning)';
  return 'var(--accent-danger)';
}
