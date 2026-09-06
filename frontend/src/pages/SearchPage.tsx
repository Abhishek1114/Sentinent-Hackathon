import { useState, useCallback, useEffect } from 'react'
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup } from 'react-leaflet'
import {
    AlertTriangle,
    Calendar,
    Car,
    CheckCircle,
    Clock,
    Download,
    Eye,
    FileText,
    Fuel,
    Info,
    Map,
    MapPin,
    Navigation,
    RotateCcw,
    Search,
    Shield,
    Sparkles,
    User,
    X,
    Zap,
} from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import {
    downloadReport,
    getPlateRoute,
    getVehicleDetails,
    saveBlob,
    searchDetections,
} from '../api/client'

interface VehicleDetails {
    registration_number: string
    owner_name: string
    vehicle_class: string
    maker_model: string
    fuel_type: string
    colour: string
    registering_authority: string
    registration_date?: string
    insurance_valid_upto?: string
    insurance_expired: boolean
    puc_valid_upto?: string
    puc_expired: boolean
    is_blacklisted: boolean
    blacklist_reason?: string
    source: string
    is_authoritative: boolean
    disclaimer?: string
}

interface Detection {
    id: string
    plate_text: string
    confidence: number
    partial?: boolean
    detected_at: string
    crop_uri?: string
    camera_name: string
    camera_department: string
    camera_lat?: number
    camera_lon?: number
    camera_address?: string
}

interface RouteSighting {
    index: number
    plate_text: string
    confidence: number
    detected_at: string
    camera_name: string
    lat?: number
    lon?: number
    department: string
    address?: string
    speed_kmh?: number
    impossible: boolean
    crop_uri?: string
}

interface RouteData {
    plate: string
    total_sightings: number
    sightings: RouteSighting[]
    flagged_transitions?: number
    route_geojson: { type: string; coordinates: [number, number][] }
    road_snapped_geojson?: { type: string; coordinates: [number, number][] } | null
}

const GUJARAT_RTO_PRESETS = [
    { label: 'GJ-01 Ahmedabad', plate: 'GJ01AB1234' },
    { label: 'GJ-02 Mehsana', plate: 'GJ02BC2345' },
    { label: 'GJ-03 Rajkot', plate: 'GJ03CD3456' },
    { label: 'GJ-11 Junagadh', plate: 'GJ11ST1234' },
    { label: 'GJ-12 Kutch', plate: 'GJ12UV2345' },
    { label: 'GJ-18 Gandhinagar', plate: 'GJ18GH8901' },
    { label: 'GJ-21 Navsari', plate: 'GJ21NP1234' },
    { label: 'GJ-27 Vastral', plate: 'GJ27AB7890' },
]

function ConfBar({ value }: { value: number }) {
    const pct = Math.round(value * 100)
    const color = pct >= 85 ? 'var(--green)' : pct >= 60 ? 'var(--yellow)' : 'var(--red)'
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div className="conf-bar">
                <div className="conf-bar-fill" style={{ width: `${pct}%`, background: color }} />
            </div>
            <span style={{ fontSize: 11, color, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                {pct}%
            </span>
        </div>
    )
}

function RoutePanel({ route, onClose }: { route: RouteData; onClose: () => void }) {
    const coords: [number, number][] = route.route_geojson.coordinates
        .filter(([lon, lat]) => lat && lon)
        .map(([lon, lat]) => [lat, lon])

    const snapped: [number, number][] = (route.road_snapped_geojson?.coordinates ?? [])
        .filter(([lon, lat]) => lat && lon)
        .map(([lon, lat]) => [lat, lon])

    const center: [number, number] =
        coords.length > 0 ? coords[Math.floor(coords.length / 2)] : [23.0225, 72.5714]

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.8)',
                backdropFilter: 'blur(8px)',
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 24,
            }}
            onClick={e => e.stopPropagation()}
        >
            <div
                style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 16,
                    width: '95%',
                    maxWidth: 1100,
                    height: '84vh',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
                }}
            >
                {/* Header */}
                <div
                    style={{
                        padding: '16px 24px',
                        borderBottom: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'var(--bg-surface)',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div className="plate-chip">
                            <span className="plate-chip-text" style={{ fontSize: 16 }}>{route.plate}</span>
                        </div>
                        <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                                SIGHTING TIMELINE & ROUTE RECONSTRUCTION
                            </div>
                            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                                Chronological Camera Fixes with Calculated Inter-Camera Speeds
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <span className="badge-pill pill-blue" style={{ fontSize: 12 }}>
                            {route.total_sightings} Sighting{route.total_sightings === 1 ? '' : 's'}
                        </span>
                        {!!route.flagged_transitions && (
                            <span className="badge-pill pill-red" style={{ fontSize: 12 }}>
                                <AlertTriangle size={12} /> {route.flagged_transitions} Implausible Speed
                            </span>
                        )}
                        <button className="btn btn-ghost btn-sm" onClick={onClose}>
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* Map & Timeline Body */}
                <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                    {/* Leaflet Map */}
                    <div style={{ flex: 1, position: 'relative' }}>
                        <div
                            style={{
                                position: 'absolute',
                                bottom: 12,
                                left: 12,
                                zIndex: 500,
                                background: 'rgba(12, 19, 36, 0.92)',
                                backdropFilter: 'blur(6px)',
                                border: '1px solid var(--border)',
                                borderRadius: 8,
                                padding: '8px 14px',
                                fontSize: 11.5,
                                lineHeight: 1.8,
                                color: 'var(--text-secondary)',
                                pointerEvents: 'none',
                                boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ width: 16, height: 3, borderTop: '2px dashed #38bdf8' }} />
                                <span>Sequential Sighting Vector</span>
                            </div>
                            {snapped.length > 1 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ width: 16, height: 4, background: '#10b981', borderRadius: 2 }} />
                                    <span>OSRM Road Network Snap</span>
                                </div>
                            )}
                        </div>

                        <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }}>
                            <TileLayer
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                attribution="&copy; OpenStreetMap contributors"
                            />
                            {snapped.length > 1 && (
                                <Polyline positions={snapped} pathOptions={{ color: '#10b981', weight: 4, opacity: 0.6 }} />
                            )}
                            {coords.length > 1 && (
                                <Polyline positions={coords} pathOptions={{ color: '#38bdf8', weight: 3, dashArray: '8 5' }} />
                            )}
                            {route.sightings
                                .filter(s => s.lat && s.lon)
                                .map(s => (
                                    <CircleMarker
                                        key={s.index}
                                        center={[s.lat!, s.lon!]}
                                        radius={9}
                                        pathOptions={{
                                            color: s.impossible ? '#f43f5e' : '#38bdf8',
                                            fillColor: s.impossible ? '#f43f5e' : '#0284c7',
                                            fillOpacity: 0.9,
                                            weight: 2,
                                        }}
                                    >
                                        <Popup>
                                            <div style={{ minWidth: 180 }}>
                                                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--accent)', marginBottom: 4 }}>
                                                    Fix #{s.index + 1}: {s.camera_name}
                                                </div>
                                                <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                                                    {new Date(s.detected_at).toLocaleString()}
                                                </div>
                                                {s.speed_kmh != null && (
                                                    <div style={{ marginTop: 6, fontWeight: 700, fontSize: 12, color: s.impossible ? 'var(--red)' : 'var(--green)' }}>
                                                        Speed: ~{s.speed_kmh} km/h {s.impossible ? '⚠ IMPLAUSIBLE' : ''}
                                                    </div>
                                                )}
                                            </div>
                                        </Popup>
                                    </CircleMarker>
                                ))}
                        </MapContainer>
                    </div>

                    {/* Timeline Sidebar */}
                    <div
                        style={{
                            width: 310,
                            borderLeft: '1px solid var(--border)',
                            overflowY: 'auto',
                            padding: 16,
                            background: 'var(--bg-surface)',
                        }}
                    >
                        <div
                            style={{
                                fontSize: 11,
                                color: 'var(--text-secondary)',
                                textTransform: 'uppercase',
                                letterSpacing: 0.8,
                                marginBottom: 14,
                                fontWeight: 700,
                            }}
                        >
                            WAYPOINT CHRONOLOGY
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {route.sightings.map(s => (
                                <div
                                    key={s.index}
                                    style={{
                                        display: 'flex',
                                        gap: 12,
                                        padding: 10,
                                        background: 'var(--bg-card)',
                                        border: '1px solid var(--border)',
                                        borderRadius: 8,
                                    }}
                                >
                                    <div
                                        style={{
                                            width: 26,
                                            height: 26,
                                            borderRadius: '50%',
                                            background: s.impossible ? 'rgba(244,63,94,0.2)' : 'rgba(56,189,248,0.2)',
                                            color: s.impossible ? 'var(--red)' : 'var(--accent)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: 12,
                                            fontWeight: 800,
                                            flexShrink: 0,
                                        }}
                                    >
                                        {s.index + 1}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--text-primary)' }}>
                                            {s.camera_name}
                                        </div>
                                        <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>
                                            {new Date(s.detected_at).toLocaleTimeString()}
                                        </div>
                                        {s.speed_kmh != null && (
                                            <div
                                                style={{
                                                    color: s.impossible ? 'var(--red)' : 'var(--green)',
                                                    fontSize: 11,
                                                    fontWeight: 600,
                                                    marginTop: 4,
                                                }}
                                            >
                                                ~{s.speed_kmh} km/h {s.impossible && '⚠ Flagged Transit'}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function SearchPage() {
    const [searchParams] = useSearchParams()
    const [query, setQuery] = useState(searchParams.get('plate') || '')
    const [fuzzy, setFuzzy] = useState(true)
    const [results, setResults] = useState<Detection[]>([])
    const [loading, setLoading] = useState(false)
    const [route, setRoute] = useState<RouteData | null>(null)
    const [searched, setSearched] = useState(false)
    const [purpose, setPurpose] = useState('investigation')
    const [caseRef, setCaseRef] = useState('')
    const [vehicle, setVehicle] = useState<VehicleDetails | null>(null)
    const [vehicleLoading, setVehicleLoading] = useState(false)

    const handleSearch = useCallback(
        async (targetQuery?: string) => {
            const q = targetQuery || query
            if (!q.trim()) return
            setLoading(true)
            setSearched(true)
            setVehicle(null)
            try {
                const data = await searchDetections({
                    plate: q.trim(),
                    fuzzy,
                    limit: 100,
                    actor: 'operator',
                    purpose: purpose || 'investigation',
                    case_ref: caseRef || undefined,
                })
                setResults(data)
            } finally {
                setLoading(false)
            }
        },
        [query, fuzzy, purpose, caseRef]
    )

    // Trigger auto-search if URL query has plate parameter
    useEffect(() => {
        const initialPlate = searchParams.get('plate')
        if (initialPlate) {
            setQuery(initialPlate)
            handleSearch(initialPlate)
        }
    }, [searchParams, handleSearch])

    const showRoute = async (plate: string) => {
        const data = await getPlateRoute(plate, {
            actor: 'operator',
            purpose: purpose || 'investigation',
            case_ref: caseRef || undefined,
        })
        setRoute(data)
    }

    const lookupVehicle = async (plate: string) => {
        setVehicleLoading(true)
        try {
            const data = await getVehicleDetails(plate, {
                actor: 'operator',
                purpose: purpose || 'investigation',
                case_ref: caseRef || undefined,
            })
            setVehicle(data)
        } catch {
            setVehicle(null)
        } finally {
            setVehicleLoading(false)
        }
    }

    const handleDownload = async (format: 'xlsx' | 'pdf') => {
        const blob = await downloadReport(format, {
            plate: query.trim() || undefined,
            actor: 'operator',
            purpose: 'submission-artefact',
        })
        saveBlob(blob, `sentinel_report_${Date.now()}.${format}`)
    }

    return (
        <div className="page-content">
            {/* Header */}
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 20,
                    flexWrap: 'wrap',
                    gap: 12,
                }}
            >
                <div>
                    <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, margin: 0 }}>
                        Plate Search & Route Intelligence
                    </h1>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
                        Continuous Index Trigram Query · OCR Error Tolerance · Road Snapping
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleDownload('xlsx')}>
                        <Download size={13} color="var(--green)" /> XLSX Export
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleDownload('pdf')}>
                        <Download size={13} color="var(--red)" /> PDF Export
                    </button>
                </div>
            </div>

            {/* Search Input Box */}
            <div
                className="card"
                style={{
                    marginBottom: 20,
                    padding: 16,
                    background: 'linear-gradient(180deg, rgba(22, 36, 66, 0.9) 0%, rgba(17, 28, 51, 0.95) 100%)',
                }}
            >
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', flex: '1 1 300px' }}>
                        <input
                            className="input"
                            style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: 16,
                                fontWeight: 700,
                                letterSpacing: 2,
                                paddingLeft: 38,
                            }}
                            placeholder="GJ01AB1234..."
                            value={query}
                            onChange={e => setQuery(e.target.value.toUpperCase())}
                            onKeyDown={e => e.key === 'Enter' && handleSearch()}
                        />
                        <Search
                            size={16}
                            color="var(--accent)"
                            style={{ position: 'absolute', left: 12, top: 13 }}
                        />
                        {query && (
                            <button
                                onClick={() => setQuery('')}
                                style={{
                                    position: 'absolute',
                                    right: 12,
                                    top: 13,
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--text-muted)',
                                    cursor: 'pointer',
                                }}
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    <label
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: 13,
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            userSelect: 'none',
                        }}
                    >
                        <input
                            type="checkbox"
                            checked={fuzzy}
                            onChange={e => setFuzzy(e.target.checked)}
                            style={{ accentColor: 'var(--accent)' }}
                        />
                        <span>Fuzzy Match (pg_trgm)</span>
                    </label>

                    <button
                        className="btn btn-primary"
                        onClick={() => handleSearch()}
                        disabled={loading}
                        style={{ minWidth: 110 }}
                    >
                        {loading ? <div className="spinner" style={{ width: 14, height: 14 }} /> : <Search size={14} />}
                        Search
                    </button>
                </div>

                {/* Audit Binding */}
                <div
                    style={{
                        display: 'flex',
                        gap: 12,
                        alignItems: 'center',
                        marginTop: 14,
                        paddingTop: 12,
                        borderTop: '1px solid var(--border)',
                        flexWrap: 'wrap',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                        <Shield size={12} color="var(--accent)" />
                        <span style={{ fontWeight: 700, textTransform: 'uppercase' }}>AUDIT PURPOSE:</span>
                    </div>

                    <select
                        className="input"
                        style={{ width: 'auto', fontSize: 12, padding: '5px 10px' }}
                        value={purpose}
                        onChange={e => setPurpose(e.target.value)}
                    >
                        <option value="investigation">Criminal Investigation</option>
                        <option value="stolen-vehicle">Stolen Vehicle Intercept</option>
                        <option value="traffic-enforcement">Traffic Enforcement</option>
                        <option value="missing-person">Missing Person Trace</option>
                        <option value="verification">Official Verification</option>
                    </select>

                    <input
                        className="input"
                        style={{ width: 'auto', fontSize: 12, padding: '5px 10px' }}
                        placeholder="Case Ref (e.g. FIR/2026/04)"
                        value={caseRef}
                        onChange={e => setCaseRef(e.target.value)}
                    />
                </div>

                {/* Gujarat RTO Presets */}
                <div style={{ display: 'flex', gap: 6, marginTop: 12, overflowX: 'auto', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', alignSelf: 'center', marginRight: 4 }}>
                        Quick Gujarat RTOs:
                    </span>
                    {GUJARAT_RTO_PRESETS.map(preset => (
                        <button
                            key={preset.plate}
                            onClick={() => {
                                setQuery(preset.plate)
                                handleSearch(preset.plate)
                            }}
                            className="btn btn-ghost btn-sm"
                            style={{
                                fontSize: 11,
                                padding: '2px 8px',
                                borderRadius: 12,
                                background: query === preset.plate ? 'rgba(56,189,248,0.2)' : 'rgba(255,255,255,0.03)',
                                borderColor: query === preset.plate ? 'var(--accent)' : 'var(--border)',
                                color: query === preset.plate ? 'var(--accent)' : 'var(--text-secondary)',
                            }}
                        >
                            {preset.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Loading */}
            {loading && (
                <div className="loading-overlay" style={{ minHeight: 200 }}>
                    <div className="spinner" />
                    <span>QUERYING ANPR TELEMETRY INDEX...</span>
                </div>
            )}

            {/* Empty State */}
            {!loading && searched && results.length === 0 && (
                <div
                    className="card"
                    style={{
                        textAlign: 'center',
                        padding: 40,
                        color: 'var(--text-muted)',
                    }}
                >
                    <Search size={36} color="var(--border-light)" style={{ margin: '0 auto 12px auto' }} />
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                        No detections found for "{query}"
                    </div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>
                        Try enabling fuzzy matching or searching a partial plate number.
                    </div>
                </div>
            )}

            {/* Results */}
            {!loading && results.length > 0 && (
                <div>
                    {/* Header summary of results */}
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: 16,
                            flexWrap: 'wrap',
                            gap: 10,
                        }}
                    >
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                            Found <strong style={{ color: 'var(--text-primary)' }}>{results.length}</strong> sighting{results.length !== 1 ? 's' : ''} across registered cameras
                        </div>

                        <div style={{ display: 'flex', gap: 8 }}>
                            <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => lookupVehicle(results[0].plate_text)}
                            >
                                {vehicleLoading ? (
                                    <div className="spinner" style={{ width: 12, height: 12 }} />
                                ) : (
                                    <Car size={13} color="var(--accent)" />
                                )}
                                <span>Vehicle Particulars (VAHAN)</span>
                            </button>
                            <button
                                className="btn btn-primary btn-sm"
                                onClick={() => showRoute(query || results[0].plate_text)}
                            >
                                <Navigation size={13} />
                                <span>Show Route on Map</span>
                            </button>
                        </div>
                    </div>

                    {/* VAHAN Enrichment Card */}
                    {vehicle && (
                        <div
                            className="card"
                            style={{
                                marginBottom: 16,
                                border: '1px solid var(--accent-dim)',
                                background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.08) 0%, rgba(17, 28, 51, 0.95) 100%)',
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div className="plate-chip">
                                        <span className="plate-chip-text">{vehicle.registration_number}</span>
                                    </div>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                                        {vehicle.maker_model}
                                    </span>
                                    {vehicle.is_blacklisted && (
                                        <span className="badge-pill pill-red">
                                            BLACKLISTED
                                        </span>
                                    )}
                                </div>
                                <button
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => setVehicle(null)}
                                    style={{ padding: 4 }}
                                >
                                    <X size={14} />
                                </button>
                            </div>

                            {/* Info grid */}
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                                    gap: 12,
                                    fontSize: 12.5,
                                }}
                            >
                                <div>
                                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                                        REGISTERED OWNER
                                    </div>
                                    <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginTop: 2 }}>
                                        {vehicle.owner_name}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                                        REGISTERING AUTHORITY
                                    </div>
                                    <div style={{ color: 'var(--accent)', fontWeight: 600, marginTop: 2 }}>
                                        {vehicle.registering_authority}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                                        VEHICLE CLASS / FUEL
                                    </div>
                                    <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>
                                        {vehicle.vehicle_class} · {vehicle.fuel_type}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                                        INSURANCE STATUS
                                    </div>
                                    <div style={{ marginTop: 2 }}>
                                        {vehicle.insurance_expired ? (
                                            <span style={{ color: 'var(--red)', fontWeight: 600 }}>Expired</span>
                                        ) : (
                                            <span style={{ color: 'var(--green)', fontWeight: 600 }}>Valid (Active)</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Sighting Cards List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {results.map(det => (
                            <div key={det.id} className="detection-card">
                                {det.crop_uri ? (
                                    <img src={det.crop_uri} alt="Plate crop" className="detection-crop" />
                                ) : (
                                    <div
                                        style={{
                                            width: 120,
                                            height: 50,
                                            background: '#0d1420',
                                            borderRadius: 'var(--radius-sm)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: 11,
                                            color: 'var(--text-muted)',
                                        }}
                                    >
                                        No Crop
                                    </div>
                                )}

                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                                        <div className="plate-chip">
                                            <span className="plate-chip-text">{det.plate_text}</span>
                                        </div>
                                        <ConfBar value={det.confidence} />
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: 'var(--text-secondary)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                            <MapPin size={13} color="var(--accent)" />
                                            <span><strong>{det.camera_name}</strong> ({det.camera_department})</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                            <Clock size={13} color="var(--text-muted)" />
                                            <span>
                                                {new Date(det.detected_at).toLocaleString('en-IN', {
                                                    timeZone: 'Asia/Kolkata',
                                                })}{' '}
                                                IST
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <button
                                        className="btn btn-ghost btn-sm"
                                        onClick={() => showRoute(det.plate_text)}
                                    >
                                        <Navigation size={12} color="var(--accent)" /> Track
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Route Panel Modal */}
            {route && <RoutePanel route={route} onClose={() => setRoute(null)} />}
        </div>
    )
}
