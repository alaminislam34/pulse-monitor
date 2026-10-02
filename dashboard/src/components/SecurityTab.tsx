import { SecurityAlert } from '../types';
import { X } from 'lucide-react';

interface SecurityTabProps {
  threats: SecurityAlert[];
  selectedAlert: SecurityAlert | null;
  setSelectedAlert: (alert: SecurityAlert | null) => void;
}

export function SecurityTab({ threats, selectedAlert, setSelectedAlert }: SecurityTabProps) {
  return (
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
            <button onClick={() => setSelectedAlert(null)} className="btn-icon-round" title="Close details">
              <X size={14} strokeWidth={2.4} />
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
  );
}

// Badge coloring helper
function getMethodBadgeStyle(method: string) {
  switch (method) {
    case 'GET': return { background: 'rgba(16, 185, 129, 0.08)', color: 'var(--accent-success)', fontWeight: 600 };
    case 'POST': return { background: 'rgba(99, 102, 241, 0.08)', color: 'var(--accent-primary)', fontWeight: 600 };
    case 'PUT': return { background: 'rgba(245, 158, 11, 0.08)', color: 'var(--accent-warning)', fontWeight: 600 };
    case 'DELETE': return { background: 'rgba(239, 68, 68, 0.08)', color: 'var(--accent-danger)', fontWeight: 600 };
    default: return { background: 'var(--bg-input)', color: 'var(--text-muted)' };
  }
}
