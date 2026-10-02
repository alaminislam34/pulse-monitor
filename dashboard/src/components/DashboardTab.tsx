import { MonitorData, RequestMetrics, SecurityAlert } from '../types';
import { MiniSparkline, CircularGauge, TrafficAreaChart } from './Charts';
import { Activity, AlertTriangle, Zap, ShieldAlert, ShieldCheck } from 'lucide-react';

interface DashboardTabProps {
  data: MonitorData;
  setActiveTab: (tab: 'dashboard' | 'requests' | 'security' | 'health' | 'settings' | 'routes' | 'playground') => void;
  setSelectedRequest: (req: RequestMetrics | null) => void;
  setSelectedAlert: (alert: SecurityAlert | null) => void;
}

export function DashboardTab({ data, setActiveTab, setSelectedRequest, setSelectedAlert }: DashboardTabProps) {
  const { system, requests, threats } = data;

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
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Top Row: 4 stat cards */}
      <div className="stat-cards-grid">
        
        {/* Stat 1: Total Requests */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>Total Requests</span>
            <div className="stat-icon-round primary">
              <Activity size={16} strokeWidth={2.4} />
            </div>
          </div>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>Error Rate %</span>
            <div className="stat-icon-round danger">
              <AlertTriangle size={16} strokeWidth={2.4} />
            </div>
          </div>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>Avg Latency</span>
            <div className="stat-icon-round success">
              <Zap size={16} strokeWidth={2.4} />
            </div>
          </div>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>Active Threats</span>
            <div className={`stat-icon-round ${threats.length > 0 ? 'danger' : 'success'}`}>
              {threats.length > 0 ? <ShieldAlert size={16} strokeWidth={2.4} /> : <ShieldCheck size={16} strokeWidth={2.4} />}
            </div>
          </div>
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
  );
}

// Styling badge helpers
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
