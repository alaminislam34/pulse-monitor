import { Play } from 'lucide-react';

interface RoutesTabProps {
  discoveredRoutes: Array<{ path: string; method: string }> | undefined;
  handleTestRoute: (route: { path: string; method: string }) => void;
}

export function RoutesTab({ discoveredRoutes, handleTestRoute }: RoutesTabProps) {
  return (
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
                  <th style={{ textAlign: 'right' }}>Actions</th>
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
                    <td style={{ textAlign: 'right' }}>
                      <button 
                        onClick={() => handleTestRoute(route)}
                        className="flex-center"
                        style={{
                          display: 'inline-flex',
                          padding: '0.35rem 0.65rem',
                          background: 'var(--bg-input)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '6px',
                          color: 'var(--text-main)',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          gap: '0.25rem',
                          transition: 'var(--transition-smooth)'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent-primary)'}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
                      >
                        <Play size={10} style={{ color: 'var(--accent-success)' }} fill="var(--accent-success)" />
                        Run Test
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
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
