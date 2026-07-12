import { 
  Activity, 
  ShieldAlert, 
  Terminal, 
  Layers, 
  Play, 
  Settings 
} from 'lucide-react';

interface SidebarProps {
  activeTab: 'dashboard' | 'requests' | 'security' | 'health' | 'settings' | 'routes' | 'playground';
  setActiveTab: (tab: 'dashboard' | 'requests' | 'security' | 'health' | 'settings' | 'routes' | 'playground') => void;
}

export function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <button onClick={() => setActiveTab('dashboard')} className={`nav-link-item ${activeTab === 'dashboard' ? 'active' : ''}`}>
          <Layers size={16} />
          <span>Dashboard</span>
        </button>
        <button onClick={() => setActiveTab('requests')} className={`nav-link-item ${activeTab === 'requests' ? 'active' : ''}`}>
          <Terminal size={16} />
          <span>API Logs</span>
        </button>
        <button onClick={() => setActiveTab('playground')} className={`nav-link-item ${activeTab === 'playground' ? 'active' : ''}`}>
          <Play size={16} />
          <span>Playground</span>
        </button>
        <button onClick={() => setActiveTab('security')} className={`nav-link-item ${activeTab === 'security' ? 'active' : ''}`}>
          <ShieldAlert size={16} />
          <span>Threats</span>
        </button>
        <button onClick={() => setActiveTab('health')} className={`nav-link-item ${activeTab === 'health' ? 'active' : ''}`}>
          <Activity size={16} />
          <span>Server Health</span>
        </button>
        <button onClick={() => setActiveTab('routes')} className={`nav-link-item ${activeTab === 'routes' ? 'active' : ''}`}>
          <Layers size={16} />
          <span>Routes Map</span>
        </button>
        <button onClick={() => setActiveTab('settings')} className={`nav-link-item ${activeTab === 'settings' ? 'active' : ''}`}>
          <Settings size={16} />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
}

export function MobileBottomNav({ activeTab, setActiveTab }: SidebarProps) {
  return (
    <nav className="mobile-bottom-nav">
      <button onClick={() => setActiveTab('dashboard')} className={`mobile-nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}>
        <Layers size={18} />
        <span>Dashboard</span>
      </button>
      <button onClick={() => setActiveTab('requests')} className={`mobile-nav-btn ${activeTab === 'requests' ? 'active' : ''}`}>
        <Terminal size={18} />
        <span>API Logs</span>
      </button>
      <button onClick={() => setActiveTab('playground')} className={`mobile-nav-btn ${activeTab === 'playground' ? 'active' : ''}`}>
        <Play size={18} />
        <span>Playground</span>
      </button>
      <button onClick={() => setActiveTab('security')} className={`mobile-nav-btn ${activeTab === 'security' ? 'active' : ''}`}>
        <ShieldAlert size={18} />
        <span>Threats</span>
      </button>
      <button onClick={() => setActiveTab('settings')} className={`mobile-nav-btn ${activeTab === 'settings' ? 'active' : ''}`}>
        <Settings size={18} />
        <span>Settings</span>
      </button>
    </nav>
  );
}
