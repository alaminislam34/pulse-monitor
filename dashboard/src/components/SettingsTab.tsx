import { Recommendation } from '../types';
import { Play, AlertTriangle, CheckCircle } from 'lucide-react';

interface SettingsTabProps {
  recommendations: Recommendation[];
  sandboxPayload: string;
  setSandboxPayload: (payload: string) => void;
  sandboxUA: string;
  setSandboxUA: (ua: string) => void;
  sandboxResult: { detected: boolean; attackType?: string; severity?: string; details?: string } | null;
  testSandbox: () => void;
  hasAuth: boolean;
  handleLogout: () => void;
}

export function SettingsTab({
  recommendations,
  sandboxPayload,
  setSandboxPayload,
  sandboxUA,
  setSandboxUA,
  sandboxResult,
  testSandbox,
  hasAuth,
  handleLogout
}: SettingsTabProps) {
  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Configuration Controls */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 600 }}>System Configuration</h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Manage your dashboard authentication credentials.</p>
          </div>
          {hasAuth && (
            <button 
              onClick={handleLogout}
              style={{
                padding: '0.45rem 0.85rem',
                background: 'rgba(239, 68, 68, 0.08)',
                color: 'var(--accent-danger)',
                border: '1px solid rgba(239, 68, 68, 0.15)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.75rem'
              }}
            >
              Log out session
            </button>
          )}
        </div>
      </div>

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
  );
}
