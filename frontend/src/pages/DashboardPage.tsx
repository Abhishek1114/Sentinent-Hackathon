import { useEffect, useState } from 'react'
import {
    Activity,
    AlertTriangle,
    ArrowUpRight,
    BarChart2,
    Camera,
    CheckCircle2,
    Cpu,
    Download,
    Eye,
    Layers,
    MapPin,
    Radio,
    RefreshCw,
    Search,
    Shield,
    TrendingUp,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { getAnalyticsSummary, getTopPlates, getDetectionsByHour, downloadReport, saveBlob } from '../api/client'

interface Summary {
    cameras: { total: number; live: number; offline: number }
    detections: { total: number; last_24h: number; unique_plates_24h: number }
    alerts: { total: number; new: number }
    watchlist: { active_entries: number }
    generated_at: string
}

export default function DashboardPage() {
    const [summary, setSummary] = useState<Summary | null>(null)
    const [topPlates, setTopPlates] = useState<{ plate_text: string; count: number }[]>([])
    const [hourly, setHourly] = useState<{ hour: string; count: number }[]>([])
    const [loading, setLoading] = useState(true)

    const load = async () => {
        setLoading(true)
        try {
            const [s, tp, h] = await Promise.all([
                getAnalyticsSummary(),
                getTopPlates(),
                getDetectionsByHour(),
            ])
            setSummary(s)
            setTopPlates(tp)
            setHourly(
                h.map((r: { hour: string; count: number }) => ({
                    hour: new Date(r.hour).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                    }),
                    count: r.count,
                }))
            )
        } catch (_) {}
        finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
    }, [])

    const handleDownload = async (format: 'xlsx' | 'pdf') => {
        const blob = await downloadReport(format, {
            actor: 'operator',
            purpose: 'submission-artefact',
        })
        saveBlob(blob, `sentinel_anpr_report_${Date.now()}.${format}`)
    }

    if (loading) {
        return (
            <div className="page-content">
                <div className="loading-overlay">
                    <div className="spinner" />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, letterSpacing: 0.5 }}>
                        INITIALIZING COMMAND TELEMETRY...
                    </span>
                </div>
            </div>
        )
    }

    return (
        <div className="page-content">
            {/* Header Title & Actions */}
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 24,
                    flexWrap: 'wrap',
                    gap: 16,
                }}
            >
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <h1
                            style={{
                                fontFamily: 'var(--font-display)',
                                fontSize: 24,
                                fontWeight: 800,
                                letterSpacing: '-0.3px',
                                color: 'var(--text-primary)',
                                margin: 0,
                            }}
                        >
                            State Command & Control
                        </h1>
                        <span
                            className="badge-pill pill-green"
                            style={{ padding: '3px 10px', fontSize: 11, fontWeight: 700 }}
                        >
                            ● ALL SYSTEMS OPERATIONAL
                        </span>
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4 }}>
                        Gujarat Police Statewide CCTV Network · Model 1 (Registry & GIS) + Model 2 (Unified AI C2)
                    </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleDownload('xlsx')}
                        title="Download audit & gap XLSX report"
                    >
                        <Download size={13} color="var(--green)" /> XLSX Export
                    </button>
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleDownload('pdf')}
                        title="Download official PDF report"
                    >
                        <Download size={13} color="var(--red)" /> PDF Report
                    </button>
                    <button
                        className="btn btn-primary btn-sm"
                        onClick={load}
                        title="Refresh live metrics"
                    >
                        <RefreshCw size={13} /> Refresh
                    </button>
                </div>
            </div>

            {/* Premium Stat Grid */}
            {summary && (
                <div className="stat-grid">
                    {/* Cameras */}
                    <div className="stat-card" style={{ borderTop: '3px solid var(--accent)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className="stat-label">REGISTERED NODES</span>
                            <Camera size={16} color="var(--accent)" />
                        </div>
                        <div className="stat-value blue">{summary.cameras.total}</div>
                        <div className="stat-sub">
                            <span style={{ color: 'var(--green)', fontWeight: 600 }}>{summary.cameras.live} Live</span>
                            <span>·</span>
                            <span>{summary.cameras.offline} Offline</span>
                        </div>
                    </div>

                    {/* Detections 24h */}
                    <div className="stat-card" style={{ borderTop: '3px solid var(--green)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className="stat-label">DETECTIONS (24H)</span>
                            <Activity size={16} color="var(--green)" />
                        </div>
                        <div className="stat-value green">{summary.detections.last_24h.toLocaleString()}</div>
                        <div className="stat-sub">
                            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                                {summary.detections.unique_plates_24h}
                            </span>{' '}
                            unique vehicles (GJ01-GJ27)
                        </div>
                    </div>

                    {/* Total Detections */}
                    <div className="stat-card" style={{ borderTop: '3px solid var(--purple)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className="stat-label">TOTAL ANPR INDEX</span>
                            <Cpu size={16} color="var(--purple)" />
                        </div>
                        <div className="stat-value purple">{summary.detections.total.toLocaleString()}</div>
                        <div className="stat-sub">
                            <span>Indexed Sightings & Crops</span>
                        </div>
                    </div>

                    {/* Active Alerts */}
                    <div
                        className="stat-card"
                        style={{
                            borderTop: `3px solid ${summary.alerts.new > 0 ? 'var(--red)' : 'var(--green)'}`,
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className="stat-label">THREAT ALERTS</span>
                            <AlertTriangle
                                size={16}
                                color={summary.alerts.new > 0 ? 'var(--red)' : 'var(--green)'}
                            />
                        </div>
                        <div className={`stat-value ${summary.alerts.new > 0 ? 'red' : 'green'}`}>
                            {summary.alerts.new}
                        </div>
                        <div className="stat-sub">
                            <span style={{ color: summary.alerts.new > 0 ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>
                                {summary.alerts.total} total hits
                            </span>
                        </div>
                    </div>

                    {/* Watchlist */}
                    <div className="stat-card" style={{ borderTop: '3px solid var(--yellow)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className="stat-label">HOTLIST / WATCHLIST</span>
                            <Shield size={16} color="var(--yellow)" />
                        </div>
                        <div className="stat-value yellow">{summary.watchlist.active_entries}</div>
                        <div className="stat-sub">
                            <span>Active Intercept Targets</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content: Chart + Top Plates */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20, marginBottom: 20 }}>
                {/* Hourly Detections Bar Chart */}
                <div className="card">
                    <div className="card-title">
                        <span>DETECTIONS TIMELINE — 24H WINDOW</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
                            Aggregated Sightings / Hour
                        </span>
                    </div>

                    {hourly.length > 0 ? (
                        <ResponsiveContainer width="100%" height={230}>
                            <BarChart data={hourly} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                                <defs>
                                    <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.9} />
                                        <stop offset="100%" stopColor="#2563eb" stopOpacity={0.4} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1d2d4f" vertical={false} />
                                <XAxis
                                    dataKey="hour"
                                    tick={{ fill: '#64748b', fontSize: 10.5, fontFamily: 'var(--font-mono)' }}
                                    axisLine={{ stroke: '#1d2d4f' }}
                                    tickLine={false}
                                />
                                <YAxis
                                    tick={{ fill: '#64748b', fontSize: 10.5, fontFamily: 'var(--font-mono)' }}
                                    axisLine={{ stroke: '#1d2d4f' }}
                                    tickLine={false}
                                />
                                <Tooltip
                                    cursor={{ fill: 'rgba(56, 189, 248, 0.06)' }}
                                    contentStyle={{
                                        background: 'rgba(17, 28, 51, 0.95)',
                                        backdropFilter: 'blur(8px)',
                                        border: '1px solid var(--border-light)',
                                        borderRadius: 8,
                                        fontSize: 12,
                                        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                                    }}
                                    labelStyle={{ color: 'var(--text-primary)', fontWeight: 600 }}
                                    itemStyle={{ color: 'var(--accent)' }}
                                />
                                <Bar dataKey="count" fill="url(#barGrad)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div
                            style={{
                                height: 230,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--text-muted)',
                                fontSize: 13,
                            }}
                        >
                            No detections recorded yet.
                        </div>
                    )}
                </div>

                {/* Most Detected Plates Table */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div className="card-title">
                        <span>TOP DETECTED VEHICLES</span>
                        <Link
                            to="/search"
                            style={{
                                fontSize: 11,
                                color: 'var(--accent)',
                                textDecoration: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                            }}
                        >
                            View All <ArrowUpRight size={12} />
                        </Link>
                    </div>

                    {topPlates.length > 0 ? (
                        <div style={{ flex: 1, overflowY: 'auto', maxHeight: 230 }}>
                            <table style={{ width: '100%' }}>
                                <thead>
                                    <tr>
                                        <th>PLATE NUMBER</th>
                                        <th>SIGHTINGS</th>
                                        <th style={{ textAlign: 'right' }}>ACTION</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {topPlates.slice(0, 5).map(p => (
                                        <tr key={p.plate_text}>
                                            <td>
                                                <div className="plate-chip">
                                                    <span className="plate-chip-text">{p.plate_text}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <span className="badge-pill pill-blue">
                                                    {p.count} sighting{p.count === 1 ? '' : 's'}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <Link
                                                    to={`/search?plate=${p.plate_text}`}
                                                    className="btn btn-ghost btn-sm"
                                                    style={{ fontSize: 11, padding: '3px 8px' }}
                                                >
                                                    <Search size={11} /> Track
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div
                            style={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--text-muted)',
                                fontSize: 13,
                            }}
                        >
                            No vehicle sightings yet.
                        </div>
                    )}
                </div>
            </div>

            {/* Architecture Highlights & Model Status */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {/* Model 1 Box */}
                <div
                    className="card"
                    style={{
                        background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.08) 0%, rgba(17, 28, 51, 0.95) 100%)',
                        border: '1px solid rgba(56, 189, 248, 0.25)',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        <div
                            style={{
                                width: 28,
                                height: 28,
                                borderRadius: 6,
                                background: 'rgba(56, 189, 248, 0.15)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--accent)',
                            }}
                        >
                            <MapPin size={16} />
                        </div>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                                MODEL 1 — GIS CAMERA REGISTRY & GAP ANALYSIS
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                Statewide Infrastructure Mapping & Coverage Analysis
                            </div>
                        </div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        • <strong>30 live cameras</strong> located and geocoded across 8 Gujarat districts.<br />
                        • Automated gap analysis identifies unmonitored transit corridors.<br />
                        • Bulk CSV onboarding, health monitoring, and audit trails fully enabled.
                    </div>
                </div>

                {/* Model 2 Box */}
                <div
                    className="card"
                    style={{
                        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(17, 28, 51, 0.95) 100%)',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        <div
                            style={{
                                width: 28,
                                height: 28,
                                borderRadius: 6,
                                background: 'rgba(16, 185, 129, 0.15)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--green)',
                            }}
                        >
                            <Cpu size={16} />
                        </div>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                                MODEL 2 — UNIFIED VIEWER & CONTINUOUS ANPR
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                CPU-Optimized Pipeline & Real-Time Threat Intercept
                            </div>
                        </div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        • <strong>Zero-GPU inference:</strong> Tiled YOLOv9 + CRNN OCR + Indian Grammar Voting.<br />
                        • Real-time WebSocket alerts triggered against active hotlists.<br />
                        • Route reconstruction with chronological speeds and OSRM road snapping.
                    </div>
                </div>
            </div>
        </div>
    )
}
