import { RequestMetrics } from '../types';
import { X, Play } from 'lucide-react';

interface RequestsTabProps {
  requests: RequestMetrics[];
  selectedRequest: RequestMetrics | null;
  setSelectedRequest: (req: RequestMetrics | null) => void;
  searchPath: string;
  filterMethod: string;
  setFilterMethod: (method: string) => void;
  filterStatus: string;
  setFilterStatus: (status: string) => void;
  handleTestRequest: (req: RequestMetrics) => void;
}

export function RequestsTab({
  requests,
  selectedRequest,
  setSelectedRequest,
  searchPath,
  filterMethod,
  setFilterMethod,
  filterStatus,
  setFilterStatus,
  handleTestRequest
}: RequestsTabProps) {

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

  return (
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
                  <th>Contract</th>
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
                    <td>
                      {req.drift ? (
                        !req.drift.isDocumented ? (
                          <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', fontSize: '0.7rem', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                            Undocumented
                          </span>
                        ) : req.drift.hasSchemaMismatch ? (
                          <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', fontSize: '0.7rem', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                            Drift ⚠️
                          </span>
                        ) : (
                          <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', fontSize: '0.7rem', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                            Verified ✓
                          </span>
                        )
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>—</span>
                      )}
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

          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
            <span className="badge" style={getMethodBadgeStyle(selectedRequest.method)}>{selectedRequest.method}</span>
            <span className="badge badge-primary">{selectedRequest.statusCode} code</span>
            <span className="badge badge-success">{selectedRequest.durationMs.toFixed(0)} ms</span>
            
            <button 
              onClick={() => handleTestRequest(selectedRequest)}
              className="flex-center animate-fade-in"
              style={{
                marginLeft: 'auto',
                padding: '0.35rem 0.65rem',
                background: 'var(--accent-primary)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.7rem',
                fontWeight: 600,
                cursor: 'pointer',
                gap: '0.25rem'
              }}
            >
              <Play size={10} fill="white" />
              Test in Playground
            </button>
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

            {selectedRequest.drift && (
              <div style={{ background: 'var(--bg-input)', padding: '0.75rem', borderRadius: '8px', border: `1px solid ${selectedRequest.drift.hasSchemaMismatch ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.75rem', color: selectedRequest.drift.hasSchemaMismatch ? '#ef4444' : '#10b981' }}>
                    {selectedRequest.drift.hasSchemaMismatch ? '⚠️ OpenAPI Contract Drift' : '✓ OpenAPI Contract Verified'}
                  </span>
                  <span className="badge" style={{ fontSize: '0.65rem', background: 'var(--bg-card)' }}>
                    {selectedRequest.drift.driftCategory || 'CONFORMANT'}
                  </span>
                </div>
                {selectedRequest.drift.matchedOpenApiPath && (
                  <p style={{ margin: '0.2rem 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Matched: <code style={{ color: 'var(--accent-primary)' }}>{selectedRequest.drift.matchedOpenApiPath}</code>
                  </p>
                )}
                {selectedRequest.drift.description && (
                  <p style={{ margin: '0.2rem 0', fontSize: '0.75rem', color: selectedRequest.drift.hasSchemaMismatch ? '#f87171' : 'var(--text-muted)' }}>
                    {selectedRequest.drift.description}
                  </p>
                )}
                {selectedRequest.drift.diff?.missingRequired && (
                  <div style={{ marginTop: '0.35rem' }}>
                    <span style={{ fontSize: '0.7rem', color: '#f87171' }}>Missing required fields:</span>
                    <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginTop: '0.15rem' }}>
                      {selectedRequest.drift.diff.missingRequired.map((f, i) => (
                        <span key={i} className="badge" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', fontSize: '0.65rem' }}>-{f}</span>
                      ))}
                    </div>
                  </div>
                )}
                {selectedRequest.drift.diff?.undocumentedFields && (
                  <div style={{ marginTop: '0.35rem' }}>
                    <span style={{ fontSize: '0.7rem', color: '#fbbf24' }}>Undocumented fields:</span>
                    <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginTop: '0.15rem' }}>
                      {selectedRequest.drift.diff.undocumentedFields.map((f, i) => (
                        <span key={i} className="badge" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', fontSize: '0.65rem' }}>+{f}</span>
                      ))}
                    </div>
                  </div>
                )}
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
  );
}

// Badge coloring helpers
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
