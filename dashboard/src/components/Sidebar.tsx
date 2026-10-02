import { 
  Activity, 
  ShieldAlert, 
  Terminal, 
  Layers, 
  Play, 
  LayoutDashboard,
  Settings 
} from 'lucide-react';

interface SidebarProps {
  activeTab: 'dashboard' | 'requests' | 'security' | 'health' | 'settings' | 'routes' | 'playground';
  setActiveTab: (tab: 'dashboard' | 'requests' | 'security' | 'health' | 'settings' | 'routes' | 'playground') => void;
  threatCount?: number;
  driftCount?: number;
  routesCount?: number;
}

export function Sidebar({ 
  activeTab, 
  setActiveTab, 
  threatCount = 0, 
  driftCount = 0,
  routesCount = 0 
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
        
        {/* Primary View */}
        <div style={{ padding: '0.35rem 0.75rem 0.2rem', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Overview
        </div>

        <button onClick={() => setActiveTab('dashboard')} className={`nav-link-item ${activeTab === 'dashboard' ? 'active' : ''}`}>
          <div className="nav-icon-round">
            <LayoutDashboard size={13} strokeWidth={2.4} />
          </div>
          <span>Overview</span>
        </button>

        {/* APIs & Traffic Section */}
        <div style={{ padding: '0.75rem 0.75rem 0.2rem', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          APIs & Traffic
        </div>

        <button onClick={() => setActiveTab('routes')} className={`nav-link-item ${activeTab === 'routes' ? 'active' : ''}`}>
          <div className="nav-icon-round">
            <Layers size={13} strokeWidth={2.4} />
          </div>
          <span>API Endpoints</span>
          {routesCount > 0 && (
            <span className="badge badge-success" style={{ marginLeft: 'auto', fontSize: '0.65rem', padding: '0.1rem 0.45rem', borderRadius: '999px' }}>
              {routesCount}
            </span>
          )}
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

        {/* Developer Tools */}
        <div style={{ padding: '0.75rem 0.75rem 0.2rem', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Tools & System
        </div>

        <button onClick={() => setActiveTab('playground')} className={`nav-link-item ${activeTab === 'playground' ? 'active' : ''}`}>
          <div className="nav-icon-round">
            <Play size={13} strokeWidth={2.4} />
          </div>
          <span>API Workbench</span>
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

      <div style={{ padding: '0.75rem', borderTop: 'none', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-light)', display: 'flex', justifyContent: 'space-between' }}>
          <span>Protocol</span>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>v0.1.0</span>
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-light)', display: 'flex', justifyContent: 'space-between' }}>
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
      <button onClick={() => setActiveTab('dashboard')} className={`mobile-nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}>
        <div className="mobile-icon-round">
          <LayoutDashboard size={15} />
        </div>
        <span>Overview</span>
      </button>

      <button onClick={() => setActiveTab('routes')} className={`mobile-nav-btn ${activeTab === 'routes' ? 'active' : ''}`}>
        <div className="mobile-icon-round">
          <Layers size={15} />
        </div>
        <span>APIs</span>
      </button>

      <button onClick={() => setActiveTab('requests')} className={`mobile-nav-btn ${activeTab === 'requests' ? 'active' : ''}`}>
        <div className="mobile-icon-round">
          <Activity size={15} />
        </div>
        <span>Traffic</span>
      </button>

      <button onClick={() => setActiveTab('playground')} className={`mobile-nav-btn ${activeTab === 'playground' ? 'active' : ''}`}>
        <div className="mobile-icon-round">
          <Play size={15} />
        </div>
        <span>Workbench</span>
      </button>

      <button onClick={() => setActiveTab('security')} className={`mobile-nav-btn ${activeTab === 'security' ? 'active' : ''}`}>
        <div className="mobile-icon-round">
          <ShieldAlert size={15} />
        </div>
        <span>Threats</span>
      </button>
    </nav>
  );
}
