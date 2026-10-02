import { useState, useEffect } from 'react';
import { X, Play, Copy, Check, AlertTriangle, CheckCircle, Layers } from 'lucide-react';
import { DiscoveredEndpoint } from '../types';

interface ApiInspectorModalProps {
  endpoint: DiscoveredEndpoint | null;
  isOpen: boolean;
  onClose: () => void;
  authSecret?: string;
  onExecuted?: () => void;
}

export function ApiInspectorModal({
  endpoint,
  isOpen,
  onClose,
  authSecret,
  onExecuted
}: ApiInspectorModalProps) {
  const [method, setMethod] = useState<string>('GET');
  const [pathTemplate, setPathTemplate] = useState<string>('');
  const [pathParams, setPathParams] = useState<Record<string, string>>({});
  const [queryParams, setQueryParams] = useState<Array<{ key: string; value: string }>>([]);
  const [headers, setHeaders] = useState<Array<{ key: string; value: string }>>([
    { key: 'Accept', value: 'application/json' },
    { key: 'Content-Type', value: 'application/json' }
  ]);
  const [reqBody, setReqBody] = useState<string>('');
  const [activeSubTab, setActiveSubTab] = useState<'params' | 'body' | 'headers'>('params');
  const [loading, setLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  
  const [response, setResponse] = useState<{
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
    timeMs: number;
  } | null>(null);

  const [validationResult, setValidationResult] = useState<{
    status: 'VERIFIED' | 'DRIFT' | 'UNDOCUMENTED' | 'ERROR';
    message: string;
    details?: string[];
  } | null>(null);

  // Initialize form when endpoint changes
  useEffect(() => {
    if (!endpoint) return;

    setMethod(endpoint.method.toUpperCase());
    setPathTemplate(endpoint.path);
    setResponse(null);
    setValidationResult(null);

    // Extract path params like {id}
    const detectedParams: Record<string, string> = {};
    const matches = endpoint.path.match(/\{([^}]+)\}/g);
    if (matches) {
      matches.forEach(m => {
        const paramName = m.replace(/[{}]/g, '');
        // Provide intelligent smart default examples for common API parameters
        if (paramName.toLowerCase().includes('id')) {
          detectedParams[paramName] = 'ord_101';
        } else if (paramName.toLowerCase().includes('user')) {
          detectedParams[paramName] = 'usr_42';
        } else {
          detectedParams[paramName] = '1';
        }
      });
    }
    setPathParams(detectedParams);

    // Query params from spec if available
    const initialQueryParams: Array<{ key: string; value: string }> = [];
    if (endpoint.parameters) {
      endpoint.parameters.filter(p => p.in === 'query').forEach(p => {
        initialQueryParams.push({
          key: p.name,
          value: p.example !== undefined ? String(p.example) : ''
        });
      });
    }
    setQueryParams(initialQueryParams);

    // Headers
    const initialHeaders = [
      { key: 'Accept', value: 'application/json' },
      { key: 'Content-Type', value: 'application/json' }
    ];
    if (authSecret) {
      initialHeaders.push({ key: 'x-pulse-auth', value: authSecret });
    }
    setHeaders(initialHeaders);

    // Request body if POST/PUT
    if (['POST', 'PUT', 'PATCH'].includes(endpoint.method.toUpperCase())) {
      if (endpoint.requestBody?.example) {
        setReqBody(JSON.stringify(endpoint.requestBody.example, null, 2));
      } else {
        setReqBody(JSON.stringify({ name: 'Sample Item', status: 'ACTIVE', count: 1 }, null, 2));
      }
      setActiveSubTab('body');
    } else {
      setReqBody('');
      setActiveSubTab(matches && matches.length > 0 ? 'params' : 'headers');
    }
  }, [endpoint, authSecret]);

  if (!isOpen || !endpoint) return null;

  // Compute resolved URL
  let resolvedPath = pathTemplate;
  Object.entries(pathParams).forEach(([k, v]) => {
    resolvedPath = resolvedPath.replace(new RegExp(`\\{${k}\\}`, 'g'), encodeURIComponent(v || '1'));
  });

  const executeRequest = async () => {
    setLoading(true);
    setResponse(null);
    setValidationResult(null);
    const startTime = performance.now();

    try {
      let finalUrl = resolvedPath;
      const validQuery = queryParams.filter(q => q.key.trim() !== '');
      if (validQuery.length > 0) {
        const qs = validQuery.map(q => `${encodeURIComponent(q.key)}=${encodeURIComponent(q.value)}`).join('&');
        finalUrl += (finalUrl.includes('?') ? '&' : '?') + qs;
      }

      const headersObj: Record<string, string> = {};
      headers.forEach(h => {
        if (h.key.trim()) headersObj[h.key] = h.value;
      });

      const options: RequestInit = {
        method,
        headers: headersObj,
      };

      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && reqBody.trim()) {
        options.body = reqBody;
      }

      const res = await fetch(finalUrl, options);
      const endTime = performance.now();
      const rawText = await res.text();

      const resHeaders: Record<string, string> = {};
      res.headers.forEach((val, key) => {
        resHeaders[key] = val;
      });

      const durationMs = Math.max(1, Math.round(endTime - startTime));

      setResponse({
        status: res.status,
        statusText: res.statusText || (res.status === 200 ? 'OK' : 'Response'),
        headers: resHeaders,
        body: rawText,
        timeMs: durationMs,
      });

      // Contract validation check against endpoint spec
      if (endpoint.responses) {
        const expectedStatus = String(res.status);
        if (!endpoint.responses[expectedStatus] && !endpoint.responses['default']) {
          setValidationResult({
            status: 'DRIFT',
            message: `Undocumented HTTP ${res.status} returned! Spec only declares: ${Object.keys(endpoint.responses).join(', ')}`
          });
        } else {
          // If 200 OK and JSON returned, check fields
          try {
            const parsed = JSON.parse(rawText);
            const schema = endpoint.responses[expectedStatus]?.content?.['application/json']?.schema;
            if (schema && schema.required && Array.isArray(schema.required)) {
              const missing = schema.required.filter((field: string) => parsed[field] === undefined);
              if (missing.length > 0) {
                setValidationResult({
                  status: 'DRIFT',
                  message: `Schema Mismatch: Missing required field(s): ${missing.join(', ')}`,
                  details: missing
                });
              } else {
                setValidationResult({
                  status: 'VERIFIED',
                  message: `Response strictly adheres to OpenAPI contract (HTTP ${res.status})`
                });
              }
            } else {
              setValidationResult({
                status: 'VERIFIED',
                message: `Status code ${res.status} matches documented contract`
              });
            }
          } catch {
            setValidationResult({
              status: 'VERIFIED',
              message: `HTTP ${res.status} response received`
            });
          }
        }
      } else {
        setValidationResult({
          status: 'VERIFIED',
          message: `Live response received (HTTP ${res.status})`
        });
      }

      // Notify parent to re-fetch live logs
      if (onExecuted) {
        setTimeout(onExecuted, 200);
      }
    } catch (err: any) {
      const endTime = performance.now();
      setResponse({
        status: 0,
        statusText: 'Client Connection Error',
        headers: {},
        body: JSON.stringify({ error: err.message || String(err) }, null, 2),
        timeMs: Math.round(endTime - startTime),
      });
      setValidationResult({
        status: 'ERROR',
        message: err.message || 'Failed to reach API endpoint'
      });
    } finally {
      setLoading(false);
    }
  };

  const copyResponse = () => {
    if (!response) return;
    navigator.clipboard.writeText(response.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  let formattedResponseBody = response?.body || '';
  try {
    if (response?.body) {
      formattedResponseBody = JSON.stringify(JSON.parse(response.body), null, 2);
    }
  } catch {}

  const hasPathParams = Object.keys(pathParams).length > 0;

  return (
    <div className="modal-backdrop animate-fade-in" onClick={onClose}>
      <div 
        className="modal-panel-stripe" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="modal-header-stripe">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span className={`method-badge ${method.toLowerCase()}`}>
              {method}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)' }}>
              {pathTemplate}
            </span>
            {endpoint.tags && endpoint.tags.map((t, idx) => (
              <span key={idx} className="badge" style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)', fontSize: '0.65rem' }}>
                {t}
              </span>
            ))}
            <span className="badge badge-success" style={{ fontSize: '0.65rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
              <CheckCircle size={10} />
              OpenAPI Contract Ready
            </span>
          </div>

          <button onClick={onClose} className="btn-icon-round" title="Close inspector">
            <X size={15} strokeWidth={2.4} />
          </button>
        </div>

        {/* Modal Body / Split Workbench */}
        <div className="modal-body-split">
          
          {/* Left Column: Request Composer */}
          <div className="modal-col request-composer">
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.2rem' }}>
                {endpoint.summary || `${method} ${pathTemplate}`}
              </div>
              {endpoint.description && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {endpoint.description}
                </div>
              )}
            </div>

            {/* Resolved URL Preview Bar */}
            <div className="resolved-url-bar">
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Target URL</span>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-main)', wordBreak: 'break-all', marginTop: '0.2rem' }}>
                {resolvedPath}
              </div>
            </div>

            {/* Sub-tabs: Parameters, Body, Headers */}
            <div className="composer-subtabs">
              {hasPathParams && (
                <button 
                  onClick={() => setActiveSubTab('params')} 
                  className={`subtab-btn ${activeSubTab === 'params' ? 'active' : ''}`}
                >
                  Path Parameters ({Object.keys(pathParams).length})
                </button>
              )}
              {['POST', 'PUT', 'PATCH'].includes(method) && (
                <button 
                  onClick={() => setActiveSubTab('body')} 
                  className={`subtab-btn ${activeSubTab === 'body' ? 'active' : ''}`}
                >
                  Request Body
                </button>
              )}
              <button 
                onClick={() => setActiveSubTab('headers')} 
                className={`subtab-btn ${activeSubTab === 'headers' ? 'active' : ''}`}
              >
                Headers & Query
              </button>
            </div>

            {/* Tab 1: Path Parameters */}
            {activeSubTab === 'params' && hasPathParams && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.75rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Customize the path variables to query real entity records:
                </div>
                {Object.entries(pathParams).map(([param, val]) => (
                  <div key={param} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-main)' }}>
                        {`{${param}}`}
                      </span>
                      <span style={{ color: 'var(--accent-primary)', fontSize: '0.7rem' }}>Required</span>
                    </div>
                    <input 
                      type="text"
                      value={val}
                      onChange={(e) => setPathParams({ ...pathParams, [param]: e.target.value })}
                      className="form-input"
                      style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}
                      placeholder="e.g. ord_101 or ord_broken"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Tab 2: Request Body */}
            {activeSubTab === 'body' && ['POST', 'PUT', 'PATCH'].includes(method) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem', flexGrow: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>JSON Payload (application/json)</span>
                  <button 
                    onClick={() => {
                      try {
                        setReqBody(JSON.stringify(JSON.parse(reqBody), null, 2));
                      } catch {}
                    }}
                    style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Format JSON
                  </button>
                </div>
                <textarea 
                  value={reqBody}
                  onChange={(e) => setReqBody(e.target.value)}
                  className="code-textarea"
                  style={{ minHeight: '160px', height: '100%' }}
                  placeholder="Enter JSON request body..."
                />
              </div>
            )}

            {/* Tab 3: Headers & Query Params */}
            {activeSubTab === 'headers' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.75rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.35rem' }}>Query Parameters</div>
                  {queryParams.length === 0 ? (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No query parameters specified.</div>
                  ) : (
                    queryParams.map((q, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.35rem' }}>
                        <input 
                          type="text"
                          value={q.key}
                          onChange={(e) => {
                            const next = [...queryParams];
                            next[idx].key = e.target.value;
                            setQueryParams(next);
                          }}
                          className="form-input"
                          style={{ width: '40%', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}
                          placeholder="key"
                        />
                        <input 
                          type="text"
                          value={q.value}
                          onChange={(e) => {
                            const next = [...queryParams];
                            next[idx].value = e.target.value;
                            setQueryParams(next);
                          }}
                          className="form-input"
                          style={{ width: '60%', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}
                          placeholder="value"
                        />
                      </div>
                    ))
                  )}
                  <button 
                    onClick={() => setQueryParams([...queryParams, { key: '', value: '' }])}
                    style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', fontSize: '0.7rem', cursor: 'pointer', marginTop: '0.25rem', fontWeight: 600 }}
                  >
                    + Add Parameter
                  </button>
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.35rem' }}>Request Headers</div>
                  {headers.map((h, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.35rem' }}>
                      <input 
                        type="text"
                        value={h.key}
                        onChange={(e) => {
                          const next = [...headers];
                          next[idx].key = e.target.value;
                          setHeaders(next);
                        }}
                        className="form-input"
                        style={{ width: '40%', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}
                      />
                      <input 
                        type="text"
                        value={h.value}
                        onChange={(e) => {
                          const next = [...headers];
                          next[idx].value = e.target.value;
                          setHeaders(next);
                        }}
                        className="form-input"
                        style={{ width: '60%', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Execute Button */}
            <div style={{ marginTop: 'auto', paddingTop: '1.25rem' }}>
              <button 
                onClick={executeRequest}
                disabled={loading}
                className="btn-execute-stripe"
              >
                {loading ? (
                  <>
                    <div className="spinner-border-sm" />
                    <span>Executing Request...</span>
                  </>
                ) : (
                  <>
                    <Play size={13} fill="#FFFFFF" />
                    <span>Execute API Call</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Column: Live Response & Verification Console */}
          <div className="modal-col response-console">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-main)' }}>
                  Response Console
                </span>
                {response && (
                  <span className={`badge ${response.status >= 200 && response.status < 300 ? 'badge-success' : response.status >= 400 ? 'badge-danger' : 'badge-warning'}`}>
                    {response.status} {response.statusText}
                  </span>
                )}
                {response && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    ⏱ {response.timeMs} ms
                  </span>
                )}
              </div>

              {response && (
                <button 
                  onClick={copyResponse} 
                  className="btn-icon-round" 
                  title="Copy JSON Response"
                  style={{ width: '26px', height: '26px' }}
                >
                  {copied ? <Check size={13} color="var(--accent-success)" /> : <Copy size={13} />}
                </button>
              )}
            </div>

            {/* Contract Drift Verification Result Card */}
            {validationResult && (
              <div className={`contract-validation-card ${validationResult.status.toLowerCase()}`}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {validationResult.status === 'VERIFIED' ? (
                    <CheckCircle size={16} color="var(--accent-success)" />
                  ) : (
                    <AlertTriangle size={16} color={validationResult.status === 'DRIFT' ? 'var(--accent-warning)' : 'var(--accent-danger)'} />
                  )}
                  <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>
                    {validationResult.status === 'VERIFIED' ? 'Contract Conformance Verified' : 'Contract Drift / Anomaly Detected'}
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', marginTop: '0.25rem', opacity: 0.9 }}>
                  {validationResult.message}
                </div>
              </div>
            )}

            {/* Raw JSON Response Viewer */}
            <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minHeight: '260px' }}>
              {!response ? (
                <div className="response-placeholder">
                  <Layers size={28} strokeWidth={1.5} style={{ color: 'var(--text-light)', marginBottom: '0.5rem' }} />
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Ready to inspect endpoint</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '280px', marginTop: '0.2rem' }}>
                    Click "Execute API Call" on the left to send live HTTP traffic and inspect contract compliance.
                  </div>
                </div>
              ) : (
                <pre className="response-pre">
                  <code>{formattedResponseBody}</code>
                </pre>
              )}
            </div>

            {/* Response Headers Footer */}
            {response && Object.keys(response.headers).length > 0 && (
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Response Headers</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {Object.entries(response.headers).slice(0, 4).map(([k, v]) => (
                    <span key={k} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                      {k}: {v}
                    </span>
                  ))}
                </div>
              </div>
            )}

          </div>

        </div>

      </div>
    </div>
  );
}
