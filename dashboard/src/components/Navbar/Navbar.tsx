import { useState, useEffect, useRef } from 'react';
import {
    Activity, Search, X, Moon, Sun, RefreshCw, Menu,
    Settings, LogOut, Bell, Clock
} from 'lucide-react';
import './style.css';

interface PulseNavbarProps {
    theme: 'light' | 'dark';
    setTheme: (theme: 'light' | 'dark') => void;
    searchPath: string;
    setSearchPath: (path: string) => void;
    pollInterval: number;
    setPollInterval: (interval: number) => void;
    isRefreshing: boolean;
    fetchData: (secretToUse?: string) => Promise<void>;
    system: {
        pid: number;
        [key: string]: any;
    };
}

export default function PulseNavbar({
    theme, setTheme, searchPath, setSearchPath,
    pollInterval, setPollInterval, isRefreshing, fetchData, system
}: PulseNavbarProps) {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
    const searchRef = useRef<HTMLInputElement>(null);

    // Close mobile menu on resize to desktop
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 768) {
                setMobileMenuOpen(false);
                setMobileSearchOpen(false);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Focus search input when opened on mobile
    useEffect(() => {
        if (mobileSearchOpen && searchRef.current) {
            searchRef.current.focus();
        }
    }, [mobileSearchOpen]);

    // Keyboard shortcut (⌘+F / Ctrl+F)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
                e.preventDefault();
                if (window.innerWidth < 768) {
                    setMobileSearchOpen(true);
                } else {
                    searchRef.current?.focus();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <>
            <nav className="navbar glass-effect">
                {/* ── Left: Brand ── */}
                <div className="navbar-brand">
                    <Activity size={22} strokeWidth={2.2} style={{ color: 'var(--accent-primary)' }} />
                    <span className="brand-text">Pulse Monitor</span>
                </div>

                {/* ── Center: Desktop Search ── */}
                <div className="navbar-search desktop-only">
                    <Search size={14} strokeWidth={2.2} style={{ color: 'var(--text-muted)' }} />
                    <input
                        ref={searchRef}
                        type="text"
                        placeholder="Search path or IP... (⌘ + F)"
                        value={searchPath}
                        onChange={(e) => setSearchPath(e.target.value)}
                        className="search-input"
                    />
                    {searchPath && (
                        <X
                            size={13}
                            strokeWidth={2.5}
                            style={{ cursor: 'pointer', color: 'var(--text-muted)' }}
                            onClick={() => setSearchPath('')}
                        />
                    )}
                </div>

                {/* ── Right: Desktop Actions ── */}
                <div className="navbar-actions desktop-only">
                    <button
                        onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                        className="icon-btn"
                        title="Toggle theme"
                    >
                        {theme === 'light' ? <Moon size={14} strokeWidth={2.2} /> : <Sun size={14} strokeWidth={2.2} />}
                    </button>

                    <button
                        onClick={() => fetchData()}
                        disabled={isRefreshing}
                        className="icon-btn sync-btn"
                        title="Refresh data"
                    >
                        <RefreshCw size={12} strokeWidth={2.5} className={isRefreshing ? 'animate-spin' : ''} />
                        <span>Sync</span>
                    </button>

                    <div className="select-wrapper">
                        <Clock size={12} strokeWidth={2.2} className="select-icon" />
                        <select
                            value={pollInterval}
                            onChange={(e) => setPollInterval(Number(e.target.value))}
                            className="poll-select"
                        >
                            <option value={3000}>3s</option>
                            <option value={5000}>5s</option>
                            <option value={10000}>10s</option>
                            <option value={0}>Manual</option>
                        </select>
                    </div>

                    <div className="user-badge">
                        <div className="avatar">AD</div>
                        <div className="user-info">
                            <span className="user-name">Admin User</span>
                            <span className="user-pid">PID {system.pid}</span>
                        </div>
                    </div>
                </div>

                {/* ── Mobile: Search trigger + Hamburger ── */}
                <div className="navbar-mobile-actions mobile-only">
                    <button
                        onClick={() => setMobileSearchOpen(true)}
                        className="icon-btn"
                        title="Search"
                    >
                        <Search size={16} strokeWidth={2.2} />
                    </button>
                    <button
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        className="icon-btn hamburger-btn"
                        title="Menu"
                    >
                        {mobileMenuOpen ? <X size={18} strokeWidth={2.5} /> : <Menu size={18} strokeWidth={2.2} />}
                    </button>
                </div>
            </nav>

            {/* ── Mobile Search Overlay ── */}
            {mobileSearchOpen && (
                <div className="mobile-search-overlay">
                    <div className="mobile-search-bar">
                        <Search size={16} strokeWidth={2.2} style={{ color: 'var(--text-muted)' }} />
                        <input
                            ref={searchRef}
                            type="text"
                            placeholder="Search path or IP..."
                            value={searchPath}
                            onChange={(e) => setSearchPath(e.target.value)}
                            className="search-input"
                            autoFocus
                        />
                        <button
                            onClick={() => { setMobileSearchOpen(false); setSearchPath(''); }}
                            className="icon-btn"
                        >
                            <X size={16} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>
            )}

            {/* ── Mobile Drawer ── */}
            <div className={`mobile-drawer ${mobileMenuOpen ? 'open' : ''}`}>
                <div className="drawer-header">
                    <Activity size={18} style={{ color: 'var(--accent-primary)' }} />
                    <span>Controls</span>
                    <button onClick={() => setMobileMenuOpen(false)} className="icon-btn">
                        <X size={16} strokeWidth={2.5} />
                    </button>
                </div>

                <div className="drawer-body">
                    {/* User Section */}
                    <div className="drawer-user">
                        <div className="avatar avatar-lg">AD</div>
                        <div>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Admin User</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>PID {system.pid}</div>
                        </div>
                    </div>

                    <div className="drawer-divider" />

                    {/* Theme Toggle */}
                    <button
                        onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                        className="drawer-item"
                    >
                        {theme === 'light' ? <Moon size={16} strokeWidth={2.2} /> : <Sun size={16} strokeWidth={2.2} />}
                        <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
                        <span className="drawer-badge">{theme === 'light' ? '🌙' : '☀️'}</span>
                    </button>

                    {/* Sync */}
                    <button
                        onClick={() => { fetchData(); setMobileMenuOpen(false); }}
                        disabled={isRefreshing}
                        className="drawer-item"
                    >
                        <RefreshCw size={16} strokeWidth={2.2} className={isRefreshing ? 'animate-spin' : ''} />
                        <span>Sync Data</span>
                        <span className="drawer-badge">{isRefreshing ? '...' : '↻'}</span>
                    </button>

                    {/* Polling Interval */}
                    <div className="drawer-poll">
                        <div className="drawer-poll-label">
                            <Clock size={14} strokeWidth={2.2} />
                            <span>Polling Interval</span>
                        </div>
                        <div className="drawer-poll-options">
                            {[
                                { value: 3000, label: '3s' },
                                { value: 5000, label: '5s' },
                                { value: 10000, label: '10s' },
                                { value: 0, label: 'Manual' }
                            ].map((opt) => (
                                <button
                                    key={opt.value}
                                    onClick={() => setPollInterval(opt.value)}
                                    className={`poll-chip ${pollInterval === opt.value ? 'active' : ''}`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="drawer-divider" />

                    {/* Extra nav items (optional premium feel) */}
                    <button className="drawer-item">
                        <Bell size={16} strokeWidth={2.2} />
                        <span>Notifications</span>
                        <span className="drawer-badge badge-dot" />
                    </button>
                    <button className="drawer-item">
                        <Settings size={16} strokeWidth={2.2} />
                        <span>Settings</span>
                    </button>
                    <button className="drawer-item danger">
                        <LogOut size={16} strokeWidth={2.2} />
                        <span>Sign Out</span>
                    </button>
                </div>
            </div>

            {/* Backdrop */}
            {mobileMenuOpen && (
                <div className="drawer-backdrop" onClick={() => setMobileMenuOpen(false)} />
            )}
        </>
    );
}