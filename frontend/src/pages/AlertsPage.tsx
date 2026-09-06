import { useEffect, useState, useMemo } from 'react'
import { 
    Bell, Check, CheckCheck, RefreshCw, Radio, Shield, 
    Car, MapPin, Phone, FileText, Siren, AlertTriangle, 
    Navigation, UserCheck, Eye, Search, X, CheckCircle2,
    Clock, ShieldAlert, ArrowRight, Compass
} from 'lucide-react'
import { 
    getAlerts, acknowledgeAlert, resolveAlert, 
    dispatchPcr, broadcastWirelessFlash, issueNakabandi 
} from '../api/client'
import type { LiveAlert } from '../hooks/useAlertWebSocket'

interface AlertRecord {
    id: string; 
    watchlist_id: string; 
    detection_id: string;
    matched_at: string; 
    match_type: string; 
    score: number; 
    status: string;
    acknowledged_by?: string; 
    acknowledged_at?: string; 
    notes?: string;
    plate_text: string; 
    reason: string; 
    severity: string; 
    case_ref?: string;
    camera_name: string; 
    camera_id: string; 
    camera_address?: string;
    camera_department?: string;
    camera_lat?: number;
    camera_lon?: number;
    crop_uri?: string; 
    detected_at?: string;
    fir_no?: string;
    police_station?: string;
    district?: string;
    ipc_sections?: string;
    io_name?: string;
    io_rank?: string;
    io_contact?: string;
    pcr_assigned?: string;
    action_code?: string;
    vehicle_model?: string;
    incident_ref?: string;
    direction_heading?: string;
    dispatch_status?: string;
    cctns_crime_type?: string;
}

// Synthesize police tactical radio audio cue
function playRadioBeep() {
    try {
        const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
        const osc = audioCtx.createOscillator()
        const gain = audioCtx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(880, audioCtx.currentTime)
        osc.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.08)
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.18)
        osc.connect(gain)
        gain.connect(audioCtx.destination)
        osc.start()
        osc.stop(audioCtx.currentTime + 0.18)
    } catch {
        // AudioContext not allowed before user gesture
    }
}

// Indian HSRP Plate Chip Component
function HsrpChip({ plate }: { plate: string }) {
    const formatted = plate.toUpperCase().replace(/[^A-Z0-9]/g, '')
    return (
        <div className="plate-chip" style={{ fontSize: 13, padding: '4px 10px', boxShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
            <div className="hsrp-flag">
                <span className="hsrp-chakra" style={{ width: 6, height: 6 }} />
                <span>IND</span>
            </div>
            <span className="plate-text" style={{ letterSpacing: '1px' }}>{formatted || plate}</span>
        </div>
    )
}

function timeAgo(dateString: string): string {
    const diff = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000)
    if (diff < 60) return `${diff}s ago`
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
}

interface Props {
    wsAlerts: LiveAlert[]
}

export default function AlertsPage({ wsAlerts }: Props) {
    const [alerts, setAlerts] = useState<AlertRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [statusFilter, setStatusFilter] = useState<string>('all')
    const [severityFilter, setSeverityFilter] = useState<string>('all')
    const [searchQuery, setSearchQuery] = useState<string>('')
    const [selectedDistrict, setSelectedDistrict] = useState<string>('all')
    const [activeDossier, setActiveDossier] = useState<AlertRecord | null>(null)
    const [activeImageZoom, setActiveImageZoom] = useState<string | null>(null)
    const [tacticalToast, setTacticalToast] = useState<{ msg: string; type: string } | null>(null)

    const showTacticalToast = (msg: string, type = 'info') => {
        setTacticalToast({ msg, type })
        playRadioBeep()
        setTimeout(() => setTacticalToast(null), 4500)
    }

    const loadAlerts = async () => {
        setLoading(true)
        try {
            const params: Record<string, string> = {}
            if (statusFilter !== 'all') params.status = statusFilter
            if (severityFilter !== 'all') params.severity = severityFilter
            const data = await getAlerts(params)
            setAlerts(data)
        } catch (err) {
            console.error('Failed to load alerts', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadAlerts()
    }, [statusFilter, severityFilter])

    const handleAck = async (id: string) => {
        try {
            await acknowledgeAlert(id, 'Duty Officer — Netram C2', 'Assigned for active verification')
            showTacticalToast('Alert acknowledged & assigned to Duty Officer', 'success')
            loadAlerts()
        } catch (err) {
            console.error(err)
        }
    }

    const handleResolve = async (id: string) => {
        try {
            await resolveAlert(id)
            showTacticalToast('Vehicle intercepted & case marked resolved in CCTNS', 'success')
            if (activeDossier?.id === id) setActiveDossier(null)
            loadAlerts()
        } catch (err) {
            console.error(err)
        }
    }

    const handleDispatchPcr = async (a: AlertRecord) => {
        try {
            const callsign = a.pcr_assigned || 'PCR Cheetah-04'
            await dispatchPcr(a.id, callsign)
            showTacticalToast(`Intercept order dispatched! ${callsign} en-route to ${a.camera_name}`, 'warning')
            loadAlerts()
        } catch (err) {
            console.error(err)
        }
    }

    const handleBroadcastFlash = async (a: AlertRecord) => {
        try {
            await broadcastWirelessFlash(a.id)
            showTacticalToast(`W/T Flash Message broadcast on VHF All-Channel for plate ${a.plate_text}`, 'danger')
            loadAlerts()
        } catch (err) {
            console.error(err)
        }
    }

    const handleIssueNakabandi = async (a: AlertRecord) => {
        try {
            const res = await issueNakabandi(a.id)
            showTacticalToast(`Nakabandi Advisory #${res.order_number || 'NK-402'} deployed across downstream circles!`, 'warning')
            loadAlerts()
        } catch (err) {
            console.error(err)
        }
    }

    // Filter alerts by search query and district
    const filteredAlerts = useMemo(() => {
        return alerts.filter(a => {
            if (selectedDistrict !== 'all') {
                const dist = (a.district || '').toLowerCase()
                if (!dist.includes(selectedDistrict.toLowerCase())) return false
            }
            if (!searchQuery.trim()) return true
            const q = searchQuery.toLowerCase()
            return (
                a.plate_text.toLowerCase().includes(q) ||
                (a.fir_no && a.fir_no.toLowerCase().includes(q)) ||
                (a.police_station && a.police_station.toLowerCase().includes(q)) ||
                (a.reason && a.reason.toLowerCase().includes(q)) ||
                (a.camera_name && a.camera_name.toLowerCase().includes(q)) ||
                (a.io_name && a.io_name.toLowerCase().includes(q)) ||
                (a.ipc_sections && a.ipc_sections.toLowerCase().includes(q))
            )
        })
    }, [alerts, searchQuery, selectedDistrict])

    // KPI counts
    const criticalCount = useMemo(() => alerts.filter(a => a.severity === 'critical' && a.status !== 'resolved').length, [alerts])
    const pcrCount = useMemo(() => alerts.filter(a => (a.notes && a.notes.includes('PCR DISPATCHED')) || a.status === 'ack').length, [alerts])
    const pendingCount = useMemo(() => alerts.filter(a => a.status === 'new').length, [alerts])
    const resolvedCount = useMemo(() => alerts.filter(a => a.status === 'resolved').length, [alerts])

    return (
        <div className="page-content" style={{ maxWidth: 1440, margin: '0 auto', paddingBottom: 60 }}>
            {/* Tactical Toast */}
            {tacticalToast && (
                <div style={{
                    position: 'fixed',
                    bottom: 24,
                    right: 24,
                    zIndex: 99999,
                    background: tacticalToast.type === 'danger' ? '#ef4444' : tacticalToast.type === 'warning' ? '#f59e0b' : '#10b981',
                    color: '#ffffff',
                    padding: '12px 20px',
                    borderRadius: 8,
                    boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    fontWeight: 600,
                    fontSize: 13,
                    animation: 'slide-in 0.2s ease',
                }}>
                    <Siren size={18} />
                    <span>{tacticalToast.msg}</span>
                    <button onClick={() => setTacticalToast(null)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}>
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* Indian Police C2 Command Header */}
            <div className="police-c2-header">
                <div className="police-crest-wrap">
                    <div className="police-badge-icon">
                        <Shield size={24} />
                    </div>
                    <div>
                        <div className="police-c2-title">
                            GUJARAT POLICE STATE SURVEILLANCE & COMMAND NETWORK
                            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'rgba(6, 182, 212, 0.2)', border: '1px solid rgba(6, 182, 212, 0.4)', color: '#38bdf8' }}>
                                NETRAM C2
                            </span>
                        </div>
                        <div className="police-c2-sub">
                            <span>Continuous ANPR Watchlist Intercepts & CCTNS Criminal Vehicle Tracking</span>
                            <span>•</span>
                            <div className="dial-112-badge">
                                <Radio size={12} className="pulse-dot" />
                                DIAL 112 DISPATCH SYNC ACTIVE
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <button 
                        className="tactical-btn tactical-btn-flash" 
                        onClick={() => { playRadioBeep(); showTacticalToast('Police All-Channel W/T Network Active & Listening', 'info') }}
                        title="Simulate Radio Channel Check"
                    >
                        <Radio size={14} /> W/T CHANNEL 01 (ACTIVE)
                    </button>
                    <button 
                        className="btn btn-ghost btn-sm" 
                        onClick={loadAlerts} 
                        title="Refresh Live Police Alerts"
                        style={{ height: 36, width: 36, padding: 0 }}
                    >
                        <RefreshCw size={14} className={loading ? 'spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Tactical KPI Stats */}
            <div className="tactical-stats-grid">
                <div className="tactical-kpi-card kpi-red">
                    <div>
                        <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Critical Threats (Code Red)</div>
                        <div style={{ fontSize: 26, fontWeight: 800, color: '#f87171', marginTop: 4, fontFamily: 'Outfit' }}>{criticalCount}</div>
                        <div style={{ fontSize: 11, color: '#ef4444', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Siren size={11} /> Armed & Extortion Hotlist
                        </div>
                    </div>
                    <ShieldAlert size={36} color="#ef4444" opacity={0.3} />
                </div>

                <div className="tactical-kpi-card kpi-amber">
                    <div>
                        <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Active PCR Pursuits</div>
                        <div style={{ fontSize: 26, fontWeight: 800, color: '#fbbf24', marginTop: 4, fontFamily: 'Outfit' }}>{pcrCount}</div>
                        <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Car size={11} /> Units En-Route / Assigned
                        </div>
                    </div>
                    <Radio size={36} color="#f59e0b" opacity={0.3} />
                </div>

                <div className="tactical-kpi-card kpi-blue">
                    <div>
                        <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pending CCTNS Verification</div>
                        <div style={{ fontSize: 26, fontWeight: 800, color: '#38bdf8', marginTop: 4, fontFamily: 'Outfit' }}>{pendingCount}</div>
                        <div style={{ fontSize: 11, color: '#0ea5e9', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Clock size={11} /> New Sighting Flags
                        </div>
                    </div>
                    <FileText size={36} color="#38bdf8" opacity={0.3} />
                </div>

                <div className="tactical-kpi-card kpi-green">
                    <div>
                        <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Apprehended / Resolved</div>
                        <div style={{ fontSize: 26, fontWeight: 800, color: '#34d399', marginTop: 4, fontFamily: 'Outfit' }}>{resolvedCount}</div>
                        <div style={{ fontSize: 11, color: '#10b981', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle2 size={11} /> Intercepted Successfully
                        </div>
                    </div>
                    <CheckCheck size={36} color="#10b981" opacity={0.3} />
                </div>
            </div>

            {/* Tactical Filter Bar */}
            <div className="tactical-filter-bar">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 260 }}>
                    <Search size={15} color="#64748b" />
                    <input 
                        type="text" 
                        className="input" 
                        placeholder="Search by Plate (e.g. GJ01), FIR #, Thana, Section, IO Name..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{ background: 'transparent', border: 'none', padding: '6px 0', fontSize: 13 }}
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                            <X size={14} />
                        </button>
                    )}
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <select 
                        className="input" 
                        style={{ width: 'auto', padding: '6px 12px', fontSize: 12 }} 
                        value={statusFilter} 
                        onChange={e => setStatusFilter(e.target.value)}
                    >
                        <option value="all">All Alert Statuses</option>
                        <option value="new">New Sighting (Action Required)</option>
                        <option value="ack">PCR Dispatched / Assigned</option>
                        <option value="resolved">Apprehended / Resolved</option>
                    </select>

                    <select 
                        className="input" 
                        style={{ width: 'auto', padding: '6px 12px', fontSize: 12 }} 
                        value={severityFilter} 
                        onChange={e => setSeverityFilter(e.target.value)}
                    >
                        <option value="all">All Threat Severities</option>
                        <option value="critical">Critical (Armed / Heinous)</option>
                        <option value="high">High (Stolen / Wanted)</option>
                        <option value="medium">Medium (Surveillance / Missing)</option>
                    </select>

                    <select 
                        className="input" 
                        style={{ width: 'auto', padding: '6px 12px', fontSize: 12 }} 
                        value={selectedDistrict} 
                        onChange={e => setSelectedDistrict(e.target.value)}
                    >
                        <option value="all">All Gujarat Jurisdictions</option>
                        <option value="ahmedabad">Ahmedabad City CP</option>
                        <option value="junagadh">Junagadh Range</option>
                        <option value="gandhinagar">Gandhinagar Range</option>
                        <option value="surat">Surat City CP</option>
                        <option value="rajkot">Rajkot City CP</option>
                    </select>
                </div>
            </div>

            {/* Alert List */}
            {loading ? (
                <div className="loading-overlay" style={{ minHeight: 300 }}>
                    <div className="spinner" />
                    <span style={{ fontSize: 13, color: '#94a3b8' }}>Syncing Gujarat Police CCTNS & ANPR grid alerts...</span>
                </div>
            ) : filteredAlerts.length === 0 ? (
                <div className="empty-state" style={{ padding: '60px 20px', textAlign: 'center' }}>
                    <Bell size={48} color="#334155" style={{ margin: '0 auto 14px' }} />
                    <p style={{ fontSize: 16, fontWeight: 600, color: '#cbd5e1' }}>No Alerts Matching Filter Criteria</p>
                    <p style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                        Watchlist triggers from live cameras and CCTNS flags will populate here automatically.
                    </p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {filteredAlerts.map(a => {
                        const isResolved = a.status === 'resolved'
                        const isPcrDispatched = (a.notes && a.notes.includes('PCR DISPATCHED')) || a.dispatch_status === 'PCR_DISPATCHED'
                        const isNakabandi = a.notes && a.notes.includes('NAKABANDI')

                        return (
                            <div 
                                key={a.id} 
                                className={`tactical-alert-card sev-${a.severity} ${isResolved ? 'status-resolved' : ''}`}
                            >
                                {/* Column 1: Plate, Crop, Confidence */}
                                <div className="alert-col-left">
                                    <HsrpChip plate={a.plate_text} />
                                    
                                    {a.crop_uri ? (
                                        <div style={{ position: 'relative' }}>
                                            <img 
                                                src={a.crop_uri} 
                                                alt={`Evidence crop ${a.plate_text}`}
                                                className="alert-crop-preview"
                                                onClick={() => setActiveImageZoom(a.crop_uri || null)}
                                                title="Click to inspect full crop evidence"
                                            />
                                            <div style={{
                                                position: 'absolute',
                                                bottom: 4,
                                                right: 6,
                                                fontSize: 10,
                                                color: '#38bdf8',
                                                background: 'rgba(0,0,0,0.7)',
                                                padding: '1px 5px',
                                                borderRadius: 3,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 3
                                            }}>
                                                <Eye size={10} /> Zoom
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{
                                            height: 64, 
                                            background: '#0a0f1d', 
                                            borderRadius: 6, 
                                            border: '1px solid rgba(255,255,255,0.06)',
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            justifyContent: 'center',
                                            fontSize: 11,
                                            color: '#64748b'
                                        }}>
                                            No Crop Recorded
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase' }}>ANPR Match</span>
                                        <span style={{ 
                                            fontSize: 11, 
                                            fontWeight: 700, 
                                            fontFamily: 'JetBrains Mono',
                                            color: a.match_type === 'exact' ? '#34d399' : '#c084fc'
                                        }}>
                                            {a.match_type.toUpperCase()} {(a.score * 100).toFixed(0)}%
                                        </span>
                                    </div>
                                </div>

                                {/* Column 2: Police Fields, FIR, Thana, IO, Specs */}
                                <div className="alert-col-center">
                                    {/* Top badges */}
                                    <div className="alert-tags-row">
                                        <span className="police-badge-pill pill-fir">
                                            <FileText size={11} /> {a.fir_no || 'FIR Pending'}
                                        </span>
                                        <span className="police-badge-pill pill-thana">
                                            <Shield size={11} /> {a.police_station || 'Jurisdiction PS'}
                                        </span>
                                        <span className="police-badge-pill pill-sections">
                                            {a.ipc_sections || a.reason}
                                        </span>
                                        {a.incident_ref && (
                                            <span style={{ 
                                                fontSize: 10.5, 
                                                fontFamily: 'JetBrains Mono', 
                                                color: '#94a3b8', 
                                                background: 'rgba(255,255,255,0.05)',
                                                padding: '2px 6px',
                                                borderRadius: 4
                                            }}>
                                                REF: {a.incident_ref}
                                            </span>
                                        )}
                                    </div>

                                    {/* Detailed Metadata Grid */}
                                    <div className="alert-meta-grid">
                                        <div className="meta-field">
                                            <MapPin size={13} color="#06b6d4" />
                                            <div>
                                                <div className="meta-label">Camera Node & Junction</div>
                                                <div className="meta-value">{a.camera_name}</div>
                                                <div style={{ fontSize: 11, color: '#64748b' }}>{a.camera_address || a.district}</div>
                                            </div>
                                        </div>

                                        <div className="meta-field">
                                            <Compass size={13} color="#f59e0b" />
                                            <div>
                                                <div className="meta-label">Direction Vector / Heading</div>
                                                <div className="meta-value">{a.direction_heading || 'Northbound'}</div>
                                                <div style={{ fontSize: 11, color: '#64748b' }}>
                                                    {timeAgo(a.matched_at)} ({new Date(a.matched_at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' })} IST)
                                                </div>
                                            </div>
                                        </div>

                                        <div className="meta-field">
                                            <Phone size={13} color="#34d399" />
                                            <div>
                                                <div className="meta-label">Investigating Officer (IO)</div>
                                                <div className="meta-value">{a.io_name || 'PSI on Duty'}</div>
                                                <div style={{ fontSize: 11, color: '#38bdf8', fontFamily: 'JetBrains Mono' }}>
                                                    {a.io_contact || '+91 Control Room'}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="meta-field">
                                            <Car size={13} color="#c084fc" />
                                            <div>
                                                <div className="meta-label">Vehicle Particulars (VAHAN)</div>
                                                <div className="meta-value">{a.vehicle_model || 'Passenger Vehicle'}</div>
                                                <div style={{ fontSize: 11, color: '#64748b' }}>Registration Authority: {a.plate_text.slice(0, 4)} RTO</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Code & Tactical Status Banner */}
                                    <div className="alert-action-notice">
                                        <AlertTriangle size={13} color="#06b6d4" />
                                        <span style={{ fontWeight: 600 }}>TACTICAL PROTOCOL:</span>
                                        <span>{a.action_code || 'Standard interception advisory'}</span>
                                    </div>

                                    {/* Live Dispatched Units or Notes */}
                                    {isPcrDispatched && (
                                        <div style={{ 
                                            background: 'rgba(245, 158, 11, 0.12)', 
                                            border: '1px solid rgba(245, 158, 11, 0.35)', 
                                            borderRadius: 6, 
                                            padding: '4px 10px', 
                                            fontSize: 11, 
                                            color: '#fbbf24',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            fontWeight: 600
                                        }}>
                                            <Radio size={12} className="pulse-dot" />
                                            <span>ACTIVE PCR PURSUIT: {a.pcr_assigned || 'Patrol Unit'} deployed to junction</span>
                                        </div>
                                    )}

                                    {isNakabandi && (
                                        <div style={{ 
                                            background: 'rgba(168, 85, 247, 0.12)', 
                                            border: '1px solid rgba(168, 85, 247, 0.35)', 
                                            borderRadius: 6, 
                                            padding: '4px 10px', 
                                            fontSize: 11, 
                                            color: '#d8b4fe',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            fontWeight: 600
                                        }}>
                                            <ShieldAlert size={12} />
                                            <span>NAKABANDI ACTIVE: Downstream intercept barricades deployed</span>
                                        </div>
                                    )}

                                    {a.acknowledged_by && (
                                        <div style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <UserCheck size={12} color="#10b981" />
                                            <span>Assigned to: <strong style={{ color: '#cbd5e1' }}>{a.acknowledged_by}</strong> at {new Date(a.acknowledged_at || a.matched_at).toLocaleTimeString('en-IN')} IST</span>
                                        </div>
                                    )}
                                </div>

                                {/* Column 3: Indian Police Tactical Action Center */}
                                <div className="alert-col-right">
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {/* Broadcast W/T Flash */}
                                        <button 
                                            className="tactical-btn tactical-btn-flash"
                                            onClick={() => handleBroadcastFlash(a)}
                                            title="Broadcast Immediate Police Wireless Flash"
                                        >
                                            <Radio size={12} /> FLASH W/T MESSAGE
                                        </button>

                                        {/* Dispatch PCR Cheetah */}
                                        <button 
                                            className="tactical-btn tactical-btn-pcr"
                                            onClick={() => handleDispatchPcr(a)}
                                            title="Dispatch Nearest PCR Van to Camera"
                                        >
                                            <Car size={12} /> DISPATCH {a.pcr_assigned ? a.pcr_assigned.split(' ')[0] : 'PCR VAN'}
                                        </button>

                                        {/* Issue Nakabandi Advisory */}
                                        <button 
                                            className="tactical-btn tactical-btn-nakabandi"
                                            onClick={() => handleIssueNakabandi(a)}
                                            title="Deploy Downstream Roadblock / Nakabandi"
                                        >
                                            <ShieldAlert size={12} /> ISSUE NAKABANDI
                                        </button>

                                        {/* View CCTNS Dossier */}
                                        <button 
                                            className="tactical-btn tactical-btn-dossier"
                                            onClick={() => setActiveDossier(a)}
                                            title="View Full Police Crime Dossier & History"
                                        >
                                            <FileText size={12} /> CCTNS DOSSIER
                                        </button>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                                        {/* Track on Route Map */}
                                        <a 
                                            href={`/search?q=${a.plate_text}`}
                                            className="tactical-btn"
                                            style={{ background: 'rgba(6, 182, 212, 0.12)', borderColor: 'rgba(6, 182, 212, 0.3)', color: '#38bdf8' }}
                                        >
                                            <Navigation size={12} /> TRACK VECTOR MAP <ArrowRight size={11} />
                                        </a>

                                        {/* Acknowledge / Resolve Controls */}
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            {a.status === 'new' && (
                                                <button 
                                                    className="tactical-btn"
                                                    style={{ flex: 1, background: 'rgba(255,255,255,0.08)', color: '#e2e8f0' }}
                                                    onClick={() => handleAck(a.id)}
                                                    title="Acknowledge Alert"
                                                >
                                                    <Check size={12} /> ACK
                                                </button>
                                            )}

                                            {!isResolved && (
                                                <button 
                                                    className="tactical-btn tactical-btn-resolve"
                                                    style={{ flex: 1 }}
                                                    onClick={() => handleResolve(a.id)}
                                                    title="Mark Vehicle Apprehended & Close Alert"
                                                >
                                                    <CheckCheck size={12} /> APPREHENDED
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* CCTNS POLICE DOSSIER MODAL */}
            {activeDossier && (
                <div className="cctns-modal-overlay" onClick={() => setActiveDossier(null)}>
                    <div className="cctns-modal-box" onClick={e => e.stopPropagation()}>
                        <div className="cctns-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                <div className="police-badge-icon" style={{ width: 38, height: 38 }}>
                                    <Shield size={20} />
                                </div>
                                <div>
                                    <div style={{ fontSize: 15, fontWeight: 800, color: '#f8fafc', letterSpacing: '0.5px' }}>
                                        CCTNS OFFICIAL CRIME DOSSIER & VEHICLE MEMORANDUM
                                    </div>
                                    <div style={{ fontSize: 11, color: '#94a3b8' }}>
                                        GOVERNMENT OF GUJARAT • STATE POLICE INTELLIGENCE GRID • CONFIDENTIAL
                                    </div>
                                </div>
                            </div>
                            <button 
                                onClick={() => setActiveDossier(null)} 
                                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="cctns-body">
                            {/* Watermark Notice */}
                            <div style={{
                                background: 'rgba(239, 68, 68, 0.08)',
                                border: '1px solid rgba(239, 68, 68, 0.25)',
                                borderRadius: 8,
                                padding: '10px 16px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                fontSize: 12,
                                color: '#fca5a5'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Siren size={16} />
                                    <span><strong>RESTRICTED LAW ENFORCEMENT RECORD:</strong> Authorized for State Command Center Operators only.</span>
                                </div>
                                <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: '#f87171' }}>
                                    TOKEN: {activeDossier.incident_ref || 'GJ-112-9901'}
                                </span>
                            </div>

                            {/* Section 1: FIR & Legal Particulars */}
                            <div>
                                <div className="cctns-section-title">
                                    <FileText size={14} /> 1. Crime & FIR Particulars (CCTNS)
                                </div>
                                <div className="cctns-grid">
                                    <div>
                                        <div className="meta-label">FIR / Crime Number</div>
                                        <div style={{ fontSize: 14, fontWeight: 700, color: '#38bdf8', fontFamily: 'JetBrains Mono', marginTop: 2 }}>
                                            {activeDossier.fir_no}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="meta-label">Police Station Jurisdiction (Thana)</div>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', marginTop: 2 }}>
                                            {activeDossier.police_station}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="meta-label">Statutory Penal Sections (BNS / IPC)</div>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: '#f87171', marginTop: 2 }}>
                                            {activeDossier.ipc_sections}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="meta-label">Crime Classification</div>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: '#fbbf24', marginTop: 2 }}>
                                            {activeDossier.cctns_crime_type || activeDossier.reason}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="meta-label">Investigating Officer (IO)</div>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginTop: 2 }}>
                                            {activeDossier.io_name} ({activeDossier.io_rank})
                                        </div>
                                        <div style={{ fontSize: 12, color: '#38bdf8', fontFamily: 'JetBrains Mono' }}>
                                            Contact: {activeDossier.io_contact}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="meta-label">Police District / Range</div>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginTop: 2 }}>
                                            {activeDossier.district}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Vehicle & VAHAN Specifications */}
                            <div>
                                <div className="cctns-section-title">
                                    <Car size={14} /> 2. Vehicle Registry & VAHAN Cross-Verification
                                </div>
                                <div className="cctns-grid">
                                    <div>
                                        <div className="meta-label">Registration Number (HSRP)</div>
                                        <div style={{ marginTop: 4 }}>
                                            <HsrpChip plate={activeDossier.plate_text} />
                                        </div>
                                    </div>
                                    <div>
                                        <div className="meta-label">Make & Model</div>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', marginTop: 2 }}>
                                            {activeDossier.vehicle_model}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="meta-label">RTO Registration Authority</div>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: '#cbd5e1', marginTop: 2 }}>
                                            {activeDossier.plate_text.slice(0, 4)} — Gujarat Transport Dept
                                        </div>
                                    </div>
                                    <div>
                                        <div className="meta-label">Stolen / Flagged Status</div>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', marginTop: 2 }}>
                                            ACTIVE WATCHLIST / HOTLIST TRIGGER
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Section 3: ANPR Sighting Telemetry */}
                            <div>
                                <div className="cctns-section-title">
                                    <MapPin size={14} /> 3. Live ANPR Sighting Telemetry
                                </div>
                                <div className="cctns-grid">
                                    <div>
                                        <div className="meta-label">Camera Node</div>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', marginTop: 2 }}>
                                            {activeDossier.camera_name}
                                        </div>
                                        <div style={{ fontSize: 11, color: '#64748b' }}>{activeDossier.camera_address}</div>
                                    </div>
                                    <div>
                                        <div className="meta-label">Detected Timestamp (IST)</div>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', marginTop: 2 }}>
                                            {new Date(activeDossier.matched_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
                                        </div>
                                    </div>
                                    <div>
                                        <div className="meta-label">Heading Vector</div>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: '#38bdf8', marginTop: 2 }}>
                                            {activeDossier.direction_heading}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="meta-label">OCR Match Confidence</div>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: '#34d399', marginTop: 2 }}>
                                            {(activeDossier.score * 100).toFixed(1)}% ({activeDossier.match_type})
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Modal Actions */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button 
                                        className="tactical-btn tactical-btn-flash"
                                        onClick={() => handleBroadcastFlash(activeDossier)}
                                    >
                                        <Radio size={12} /> FLASH W/T
                                    </button>
                                    <button 
                                        className="tactical-btn tactical-btn-pcr"
                                        onClick={() => handleDispatchPcr(activeDossier)}
                                    >
                                        <Car size={12} /> DISPATCH PCR
                                    </button>
                                </div>

                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button 
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => window.print()}
                                    >
                                        <FileText size={12} /> Print FIR Memo
                                    </button>
                                    {activeDossier.status !== 'resolved' && (
                                        <button 
                                            className="tactical-btn tactical-btn-resolve"
                                            onClick={() => handleResolve(activeDossier.id)}
                                        >
                                            <CheckCheck size={12} /> Mark Apprehended
                                        </button>
                                    )}
                                    <button 
                                        className="btn btn-ghost btn-sm"
                                        onClick={() => setActiveDossier(null)}
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* LIGHTBOX CROP ZOOM MODAL */}
            {activeImageZoom && (
                <div className="cctns-modal-overlay" onClick={() => setActiveImageZoom(null)}>
                    <div style={{
                        background: '#0a101d',
                        padding: 16,
                        borderRadius: 12,
                        border: '1px solid rgba(6,182,212,0.4)',
                        maxWidth: 600,
                        textAlign: 'center',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.8)'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#38bdf8' }}>ANPR Evidence Plate Crop</span>
                            <button onClick={() => setActiveImageZoom(null)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                                <X size={18} />
                            </button>
                        </div>
                        <img 
                            src={activeImageZoom} 
                            alt="Zoomed Plate Crop" 
                            style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)' }} 
                        />
                    </div>
                </div>
            )}
        </div>
    )
}
