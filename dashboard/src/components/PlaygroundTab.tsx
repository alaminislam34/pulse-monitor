import { Play } from 'lucide-react';

interface PlaygroundTabProps {
  pgMethod: string;
  setPgMethod: (method: string) => void;
  pgPath: string;
  setPgPath: (path: string) => void;
  pgHeaders: Array<{ key: string; value: string }>;
  setPgHeaders: React.Dispatch<React.SetStateAction<Array<{ key: string; value: string }>>>;
  pgQueryParams: Array<{ key: string; value: string }>;
  setPgQueryParams: React.Dispatch<React.SetStateAction<Array<{ key: string; value: string }>>>;
  pgBody: string;
  setPgBody: (body: string) => void;
  pgLoading: boolean;
  pgResponse: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
    timeMs: number;
  } | null;
  pgActiveSubTab: 'headers' | 'params' | 'body';
  setPgActiveSubTab: (subTab: 'headers' | 'params' | 'body') => void;
  executePlaygroundRequest: () => void;
}

export function PlaygroundTab({
  pgMethod,
  setPgMethod,
  pgPath,
  setPgPath,
  pgHeaders,
  setPgHeaders,
  pgQueryParams,
  setPgQueryParams,
  pgBody,
  setPgBody,
  pgLoading,
  pgResponse,
  pgActiveSubTab,
  setPgActiveSubTab,
  executePlaygroundRequest
}: PlaygroundTabProps) {

  const addHeader = () => setPgHeaders([...pgHeaders, { key: '', value: '' }]);
  const removeHeader = (index: number) => setPgHeaders(pgHeaders.filter((_, idx) => idx !== index));
  const updateHeader = (index: number, key: string, value: string) => {
    const next = [...pgHeaders];
    next[index] = { key, value };
    setPgHeaders(next);
  };

  const addParam = () => setPgQueryParams([...pgQueryParams, { key: '', value: '' }]);
  const removeParam = (index: number) => setPgQueryParams(pgQueryParams.filter((_, idx) => idx !== index));
  const updateParam = (index: number, key: string, value: string) => {
    const next = [...pgQueryParams];
    next[index] = { key, value };
    setPgQueryParams(next);
  };

  return (
    <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem' }}>
      
      {/* Request Workspace */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 600 }}>API Client Playground</h4>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Compose and send REST requests directly to your server.</p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <select 
            value={pgMethod} 
            onChange={(e) => setPgMethod(e.target.value)}
            className="form-input"
            style={{ 
              width: '100px', 
              fontSize: '0.85rem', 
              fontWeight: 700, 
              color: getMethodColor(pgMethod),
              padding: '0.55rem 0.50rem' 
            }}
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
            <option value="PATCH">PATCH</option>
          </select>

          <input 
            type="text" 
            placeholder="/api/v1/resource..." 
            value={pgPath}
            onChange={(e) => setPgPath(e.target.value)}
            className="form-input"
            style={{ flexGrow: 1, fontFamily: 'var(--font-mono)', fontSize: '0.8rem', padding: '0.55rem 0.75rem' }}
          />

          <button 
            onClick={executePlaygroundRequest}
            disabled={pgLoading}
            className="flex-center"
            style={{
              padding: '0.55rem 1.25rem',
              background: 'var(--accent-primary)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.8rem',
              cursor: 'pointer',
              gap: '0.35rem',
              opacity: pgLoading ? 0.7 : 1
            }}
          >
            <Play size={12} fill="white" />
            Send
          </button>
        </div>

        {/* Workspace Subtabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: '1rem', marginTop: '0.5rem' }}>
          <button 
            onClick={() => setPgActiveSubTab('headers')}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: pgActiveSubTab === 'headers' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: pgActiveSubTab === 'headers' ? 'var(--text-main)' : 'var(--text-muted)',
              paddingBottom: '0.5rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Headers ({pgHeaders.length})
          </button>
          <button 
            onClick={() => setPgActiveSubTab('params')}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: pgActiveSubTab === 'params' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: pgActiveSubTab === 'params' ? 'var(--text-main)' : 'var(--text-muted)',
              paddingBottom: '0.5rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Query Params ({pgQueryParams.length})
          </button>
          {['POST', 'PUT', 'DELETE', 'PATCH'].includes(pgMethod) && (
            <button 
              onClick={() => setPgActiveSubTab('body')}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: pgActiveSubTab === 'body' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                color: pgActiveSubTab === 'body' ? 'var(--text-main)' : 'var(--text-muted)',
                paddingBottom: '0.5rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Body
            </button>
          )}
        </div>

        {/* Tab Contents */}
        <div style={{ minHeight: '220px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {pgActiveSubTab === 'headers' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {pgHeaders.map((header, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '0.5rem' }}>
                  <input 
                    type="text" 
                    placeholder="Key" 
                    value={header.key}
                    onChange={(e) => updateHeader(idx, e.target.value, header.value)}
                    className="form-input"
                    style={{ fontSize: '0.75rem', padding: '0.35rem' }}
                  />
                  <input 
                    type="text" 
                    placeholder="Value" 
                    value={header.value}
                    onChange={(e) => updateHeader(idx, header.key, e.target.value)}
                    className="form-input"
                    style={{ fontSize: '0.75rem', padding: '0.35rem' }}
                  />
                  <button 
                    onClick={() => removeHeader(idx)}
                    style={{
                      background: 'rgba(239, 68, 68, 0.05)',
                      border: '1px solid rgba(239, 68, 68, 0.1)',
                      color: 'var(--accent-danger)',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    &times;
                  </button>
                </div>
              ))}
              <button 
                onClick={addHeader}
                style={{
                  alignSelf: 'flex-start',
                  background: 'none',
                  border: '1px dashed var(--border-color)',
                  color: 'var(--accent-primary)',
                  padding: '0.35rem 0.65rem',
                  fontSize: '0.7rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 500,
                  marginTop: '0.25rem'
                }}
              >
                + Add Header
              </button>
            </div>
          )}

          {pgActiveSubTab === 'params' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {pgQueryParams.map((param, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '0.5rem' }}>
                  <input 
                    type="text" 
                    placeholder="Key" 
                    value={param.key}
                    onChange={(e) => updateParam(idx, e.target.value, param.value)}
                    className="form-input"
                    style={{ fontSize: '0.75rem', padding: '0.35rem' }}
                  />
                  <input 
                    type="text" 
                    placeholder="Value" 
                    value={param.value}
                    onChange={(e) => updateParam(idx, param.key, e.target.value)}
                    className="form-input"
                    style={{ fontSize: '0.75rem', padding: '0.35rem' }}
                  />
                  <button 
                    onClick={() => removeParam(idx)}
                    style={{
                      background: 'rgba(239, 68, 68, 0.05)',
                      border: '1px solid rgba(239, 68, 68, 0.1)',
                      color: 'var(--accent-danger)',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    &times;
                  </button>
                </div>
              ))}
              <button 
                onClick={addParam}
                style={{
                  alignSelf: 'flex-start',
                  background: 'none',
                  border: '1px dashed var(--border-color)',
                  color: 'var(--accent-primary)',
                  padding: '0.35rem 0.65rem',
                  fontSize: '0.7rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 500,
                  marginTop: '0.25rem'
                }}
              >
                + Add Parameter
              </button>
            </div>
          )}

          {pgActiveSubTab === 'body' && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(pgMethod) && (
            <textarea 
              placeholder='{\n  "key": "value"\n}'
              value={pgBody}
              onChange={(e) => setPgBody(e.target.value)}
              className="form-input"
              style={{
                flexGrow: 1,
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                minHeight: '160px',
                padding: '0.5rem',
                resize: 'vertical'
              }}
            />
          )}
        </div>
      </div>

      {/* Response Workspace */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: '380px' }}>
        <h4 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Response</h4>

        {!pgResponse && !pgLoading && (
          <div className="flex-center" style={{ flexGrow: 1, flexDirection: 'column', color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', gap: '0.5rem' }}>
            <Play size={24} style={{ opacity: 0.15 }} />
            <span>No response yet</span>
            <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>Compose a request and hit Send to inspect status, headers and body output.</span>
          </div>
        )}

        {pgLoading && (
          <div className="flex-center" style={{ flexGrow: 1, color: 'var(--text-muted)', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
            Awaiting server response...
          </div>
        )}

        {pgResponse && !pgLoading && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flexGrow: 1 }}>
            
            {/* Status and Latency Badges */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <span className="badge" style={{
                background: pgResponse.status >= 200 && pgResponse.status < 300 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                color: pgResponse.status >= 200 && pgResponse.status < 300 ? 'var(--accent-success)' : 'var(--accent-danger)',
                fontWeight: 700
              }}>
                Status: {pgResponse.status} {pgResponse.statusText}
              </span>
              <span className="badge badge-primary">Time: {pgResponse.timeMs.toFixed(0)} Ms</span>
            </div>

            {/* Response Headers */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>Headers ({Object.keys(pgResponse.headers).length})</span>
              <div 
                style={{ 
                  background: 'var(--bg-input)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '8px', 
                  maxHeight: '120px', 
                  overflowY: 'auto',
                  padding: '0.5rem',
                  fontSize: '0.7rem',
                  fontFamily: 'var(--font-mono)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem'
                }}
              >
                {Object.entries(pgResponse.headers).map(([key, val]) => (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{key}:</span>
                    <span style={{ color: 'var(--text-main)', textAlign: 'right', wordBreak: 'break-all' }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Response Body */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flexGrow: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>Body</span>
                <button 
                  onClick={() => navigator.clipboard.writeText(pgResponse.body)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent-primary)',
                    fontSize: '0.7rem',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  Copy
                </button>
              </div>
              <pre 
                style={{ 
                  fontFamily: 'var(--font-mono)', 
                  background: 'var(--bg-input)', 
                  padding: '0.75rem', 
                  borderRadius: '8px', 
                  fontSize: '0.75rem', 
                  overflow: 'auto', 
                  border: '1px solid var(--border-color)', 
                  color: pgResponse.status >= 200 && pgResponse.status < 300 ? '#34d399' : 'var(--accent-danger)', 
                  whiteSpace: 'pre-wrap', 
                  wordBreak: 'break-all',
                  maxHeight: '280px',
                  flexGrow: 1
                }}
              >
                {formatBodyText(pgResponse.body)}
              </pre>
            </div>

          </div>
        )}

      </div>

    </div>
  );
}

// Styling helpers
function getMethodColor(method: string) {
  switch (method) {
    case 'GET': return 'var(--accent-success)';
    case 'POST': return 'var(--accent-primary)';
    case 'PUT': return 'var(--accent-warning)';
    case 'DELETE': return 'var(--accent-danger)';
    case 'PATCH': return 'purple';
    default: return 'var(--text-muted)';
  }
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
