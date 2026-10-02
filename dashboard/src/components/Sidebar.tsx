import { 
  Activity, 
  ShieldAlert, 
  Terminal, 
  Layers, 
  Play, 
  BarChart3,
  Settings 
} from 'lucide-react';

interface SidebarProps {
  activeTab: 'dashboard' | 'requests' | 'security' | 'health' | 'settings' | 'routes' | 'playground';
  setActiveTab: (tab: 'dashboard' | 'requests' | 'security' | 'health' | 'settings' | 'routes' | 'playground') => void;
  threatCount?: number;
  driftCount?: number;
}

export function Sidebar({ activeTab, setActiveTab, threatCount = 0, driftCount = 0 }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          API Cockpit
        </div>
        
        <button onClick={() => setActiveTab('playground')} className={`nav-link-item ${activeTab === 'playground' ? 'active' : ''}`}>
          <div className="nav-icon-round">
            <Play size={13} strokeWidth={2.4} />
          </div>
          <span>API Runner</span>
        </button>

        <button onClick={() => setActiveTab('requests')} className={`nav-link-item ${activeTab === 'requests' ? 'active' : ''}`}>
          <div className="nav-icon-round">
            <Activity size={13} strokeWidth={2.4} />
          </div>
          <span>Live Traffic</span>
          {driftCount > 0 && (
            <span className="badge" style={{ marginLeft: 'auto', background: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-warning)', fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: '999px' }}>
              {driftCount}
            </span>
          )}
        </button>

        <button onClick={() => setActiveTab('routes')} className={`nav-link-item ${activeTab === 'routes' ? 'active' : ''}`}>
          <div className="nav-icon-round">
            <Layers size={13} strokeWidth={2.4} />
          </div>
          <span>Contracts & Routes</span>
        </button>

        <button onClick={() => setActiveTab('security')} className={`nav-link-item ${activeTab === 'security' ? 'active' : ''}`}>
          <div className="nav-icon-round">
            <ShieldAlert size={13} strokeWidth={2.4} />
          </div>
          <span>Threat Watchdog</span>
          {threatCount > 0 && (
            <span className="badge" style={{ marginLeft: 'auto', background: 'rgba(239, 68, 68, 0.15)', color: 'var(--accent-danger)', fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: '999px' }}>
              {threatCount}
            </span>
          )}
        </button>

        <div style={{ padding: '0.75rem 0.75rem 0.25rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Monitoring
        </div>

        <button onClick={() => setActiveTab('dashboard')} className={`nav-link-item ${activeTab === 'dashboard' ? 'active' : ''}`}>
          <div className="nav-icon-round">
            <BarChart3 size={13} strokeWidth={2.4} />
          </div>
          <span>Analytics</span>
        </button>

        <button onClick={() => setActiveTab('health')} className={`nav-link-item ${activeTab === 'health' ? 'active' : ''}`}>
          <div className="nav-icon-round">
            <Terminal size={13} strokeWidth={2.4} />
          </div>
          <span>Server Health</span>
        </button>

        <button onClick={() => setActiveTab('settings')} className={`nav-link-item ${activeTab === 'settings' ? 'active' : ''}`}>
          <div className="nav-icon-round">
            <Settings size={13} strokeWidth={2.4} />
          </div>
          <span>Settings</span>
        </button>
      </div>

      <div style={{ padding: '0.75rem', borderTop: 'none', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', display: 'flex', justifyContent: 'space-between' }}>
          <span>Protocol</span>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>v0.1.0</span>
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', display: 'flex', justifyContent: 'space-between' }}>
          <span>Telemetry</span>
          <span style={{ color: 'var(--accent-success)', fontWeight: 600 }}>100% Local</span>
        </div>
      </div>
    </aside>
  );
}

export function MobileBottomNav({ activeTab, setActiveTab }: SidebarProps) {
  return (
    <nav className="mobile-bottom-nav">
      <button onClick={() => setActiveTab('playground')} className={`mobile-nav-btn ${activeTab === 'playground' ? 'active' : ''}`}>
        <div className="mobile-icon-round">
          <Play size={15} />
        </div>
        <span>Runner</span>
      </button>
      <button onClick={() => setActiveTab('requests')} className={`mobile-nav-btn ${activeTab === 'requests' ? 'active' : ''}`}>
        <div className="mobile-icon-round">
          <Activity size={15} />
        </div>
        <span>Traffic</span>
      </button>
      <button onClick={() => setActiveTab('routes')} className={`mobile-nav-btn ${activeTab === 'routes' ? 'active' : ''}`}>
        <div className="mobile-icon-round">
          <Layers size={15} />
        </div>
        <span>Routes</span>
      </button>
      <button onClick={() => setActiveTab('security')} className={`mobile-nav-btn ${activeTab === 'security' ? 'active' : ''}`}>
        <div className="mobile-icon-round">
          <ShieldAlert size={15} />
        </div>
        <span>Threats</span>
      </button>
      <button onClick={() => setActiveTab('settings')} className={`mobile-nav-btn ${activeTab === 'settings' ? 'active' : ''}`}>
        <div className="mobile-icon-round">
          <Settings size={15} />
        </div>
        <span>Settings</span>
      </button>
    </nav>
  );
}
