import { useCallback, useEffect, useState } from 'react'
import { BrowserRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import {
    Activity,
    BarChart2,
    Bell,
    Clock,
    LogOut,
    Map,
    Monitor,
    Search,
    Shield,
    ShieldAlert,
    UserCheck,
    Wifi,
} from 'lucide-react'
import MapPage from './pages/MapPage'
import VideoWallPage from './pages/VideoWallPage'
import SearchPage from './pages/SearchPage'
import AlertsPage from './pages/AlertsPage'
import WatchlistPage from './pages/WatchlistPage'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'
import { useAlertWebSocket, type WsStatus } from './hooks/useAlertWebSocket'
import Toast from './components/Toast'
import { clearSession, getStoredUser, type AuthUser } from './api/client'

const NAV = [
    { to: '/', label: 'Dashboard', Icon: BarChart2 },
    { to: '/map', label: 'Camera Map', Icon: Map },
    { to: '/wall', label: 'Video Wall', Icon: Monitor },
    { to: '/search', label: 'Plate Search', Icon: Search },
    { to: '/alerts', label: 'Alerts', Icon: Bell },
    { to: '/watchlist', label: 'Watchlist', Icon: Shield },
] as const

const PAGE_TITLES: Record<string, { title: string; subtitle: string; Icon: any }> = {
    '/': {
        title: 'Command Dashboard',
        subtitle: 'Statewide Surveillance & AI Analytics Overview',
        Icon: BarChart2,
    },
    '/map': {
        title: 'GIS Camera Registry',
        subtitle: '30 Geocoded Nodes Across Gujarat Districts',
        Icon: Map,
    },
    '/wall': {
        title: 'Live Video Wall',
        subtitle: 'Multi-Stream Low-Latency CCTV Matrix',
        Icon: Monitor,
    },
    '/search': {
        title: 'Plate Search & Tracking',
        subtitle: 'ANPR Trigram Query, Route Snap & VAHAN Enrichment',
        Icon: Search,
    },
    '/alerts': {
        title: 'Real-Time Threat Alerts',
        subtitle: 'Continuous Watchlist Triggers & Incident Feed',
        Icon: Bell,
    },
    '/watchlist': {
        title: 'Hotlist & Watchlist',
        subtitle: 'State Hotlist Management & Vehicle Intercepts',
        Icon: Shield,
    },
}

function Sidebar({ newAlertCount }: { newAlertCount: number }) {
    return (
        <nav className="sidebar" aria-label="Main navigation">
            <div className="sidebar-logo">
                <div className="sidebar-logo-badge">
                    <Shield size={18} />
                </div>
                <div className="sidebar-logo-text">
                    <span className="sidebar-logo-title">SENTINEL</span>
                    <span className="sidebar-logo-sub">Gujarat Police C2</span>
                </div>
            </div>

            <div className="sidebar-nav">
                {NAV.map(({ to, label, Icon }) => {
                    const badge = to === '/alerts' ? newAlertCount : 0
                    return (
                        <NavLink
                            key={to}
                            to={to}
                            end={to === '/'}
                            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                        >
                            <Icon size={17} aria-hidden="true" />
                            <span>{label}</span>
                            {badge > 0 && (
                                <span className="badge" aria-label={`${badge} new alerts`}>
                                    {badge > 99 ? '99+' : badge}
                                </span>
                            )}
                        </NavLink>
                    )
                })}
            </div>

            <div className="sidebar-footer">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)' }} />
                    <span style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: 11 }}>
                        GRID 30/30 ACTIVE
                    </span>
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                    Gujarat CCTV Integration · 2026<br />
                    Model 1 (Registry) + Model 2 (AI C2)
                </div>
            </div>
        </nav>
    )
}

function Topbar({
    status,
    user,
    onSignOut,
}: {
    status: WsStatus
    user: AuthUser | null
    onSignOut: () => void
}) {
    const { pathname } = useLocation()
    const pageMeta = PAGE_TITLES[pathname] ?? {
        title: 'Sentinel Platform',
        subtitle: 'Command Centre',
        Icon: Activity,
    }
    const PageIcon = pageMeta.Icon

    // Live Digital Clock (IST)
    const [timeStr, setTimeStr] = useState('')
    useEffect(() => {
        const update = () => {
            const now = new Date()
            setTimeStr(
                now.toLocaleTimeString('en-IN', {
                    timeZone: 'Asia/Kolkata',
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                }) + ' IST'
            )
        }
        update()
        const timer = setInterval(update, 1000)
        return () => clearInterval(timer)
    }, [])

    return (
        <header className="topbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                    style={{
                        width: 34,
                        height: 34,
                        borderRadius: 8,
                        background: 'rgba(56, 189, 248, 0.1)',
                        border: '1px solid rgba(56, 189, 248, 0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--accent)',
                    }}
                >
                    <PageIcon size={18} />
                </div>
                <div>
                    <h1 className="topbar-title" style={{ margin: 0, fontSize: 15 }}>
                        {pageMeta.title}
                    </h1>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {pageMeta.subtitle}
                    </div>
                </div>
            </div>

            <div className="topbar-right">
                {/* Digital Clock */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontFamily: 'var(--font-mono)',
                        fontSize: 12,
                        color: 'var(--text-secondary)',
                        background: 'rgba(0,0,0,0.3)',
                        padding: '4px 10px',
                        borderRadius: 6,
                        border: '1px solid var(--border)',
                    }}
                >
                    <Clock size={13} color="var(--accent)" />
                    <span>{timeStr || '18:30:00 IST'}</span>
                </div>

                {/* Telemetry Status */}
                <div
                    className={`live-indicator${status === 'live' ? '' : ' disconnected'}`}
                    role="status"
                    aria-live="polite"
                    title="Live WebSocket stream telemetry"
                >
                    <div className="pulse-dot" aria-hidden="true" />
                    <span>{status === 'live' ? 'TELEMETRY LIVE' : status === 'connecting' ? 'CONNECTING' : 'OFFLINE'}</span>
                </div>

                {/* User Card */}
                {user && (
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '3px 8px 3px 12px',
                            background: 'rgba(21, 32, 56, 0.8)',
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                        }}
                    >
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                                {user.username}
                            </div>
                            <div
                                style={{
                                    fontSize: 9.5,
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    letterSpacing: 0.6,
                                    color: 'var(--accent)',
                                }}
                            >
                                {user.role.replace('_', ' ')}
                            </div>
                        </div>

                        <div
                            style={{
                                width: 28,
                                height: 28,
                                borderRadius: 6,
                                background: 'var(--accent-grad)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#fff',
                                fontWeight: 800,
                                fontSize: 11,
                                textTransform: 'uppercase',
                            }}
                        >
                            {user.username.slice(0, 2)}
                        </div>

                        <button
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '4px 7px', marginLeft: 4 }}
                            onClick={onSignOut}
                            title="Sign out of command session"
                        >
                            <LogOut size={13} aria-hidden="true" />
                        </button>
                    </div>
                )}
            </div>
        </header>
    )
}

function Shell({ user, onSignOut }: { user: AuthUser | null; onSignOut: () => void }) {
    const { alerts, status, clearAlert } = useAlertWebSocket()
    const toasts = alerts.slice(0, 3)

    return (
        <div className="app-layout">
            <Sidebar newAlertCount={alerts.length} />
            <div className="main-area">
                <Topbar status={status} user={user} onSignOut={onSignOut} />
                <Routes>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/map" element={<MapPage />} />
                    <Route path="/wall" element={<VideoWallPage />} />
                    <Route path="/search" element={<SearchPage />} />
                    <Route path="/alerts" element={<AlertsPage wsAlerts={alerts} />} />
                    <Route path="/watchlist" element={<WatchlistPage />} />
                </Routes>
            </div>

            {/* Alert Toast Stack */}
            <div
                style={{
                    position: 'fixed',
                    bottom: 18,
                    right: 18,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    zIndex: 99999,
                    pointerEvents: 'none',
                }}
            >
                {toasts.map(a => (
                    <div key={a.alert_id} style={{ pointerEvents: 'auto' }}>
                        <Toast alert={a} onClose={() => clearAlert(a.alert_id)} />
                    </div>
                ))}
            </div>
        </div>
    )
}

export default function App() {
    const [user, setUser] = useState<AuthUser | null>(() => getStoredUser())

    const handleSignOut = useCallback(() => {
        clearSession()
        setUser(null)
    }, [])

    useEffect(() => {
        const onSignedOut = () => setUser(null)
        window.addEventListener('sentinel:signed-out', onSignedOut)
        return () => window.removeEventListener('sentinel:signed-out', onSignedOut)
    }, [])

    return (
        <BrowserRouter>
            {user ? (
                <Shell user={user} onSignOut={handleSignOut} />
            ) : (
                <LoginPage onSignedIn={setUser} />
            )}
        </BrowserRouter>
    )
}
