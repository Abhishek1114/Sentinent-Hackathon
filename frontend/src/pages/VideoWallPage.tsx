import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    Camera as CameraIcon,
    Check,
    ChevronDown,
    LayoutGrid,
    Maximize2,
    Minimize2,
    RotateCw,
    Search,
    Video,
    X,
} from 'lucide-react'
import { getCameras } from '../api/client'
import LiveTile, { type StreamProfile, type TileState } from '../components/LiveTile'

interface Camera {
    id: string
    native_id: string
    name: string
    department: string
    district?: string
    address?: string
    live_url?: string
    hls_url?: string
    is_live: boolean
    codec?: string
}

interface Slot {
    camera: Camera | null
    isHero: boolean
}

// Search and select modal used for picking or swapping cameras
function CameraPicker({
    cameras,
    onPick,
    onClose,
    title = 'Select Camera',
}: {
    cameras: Camera[]
    onPick: (c: Camera) => void
    onClose: () => void
    title?: string
}) {
    const [query, setQuery] = useState('')
    const [selectedDistrict, setSelectedDistrict] = useState<string>('All')
    const modalRef = useRef<HTMLDivElement>(null)

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
                onClose()
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [onClose])

    const districts = useMemo(() => {
        const set = new Set<string>()
        cameras.forEach(c => {
            if (c.district) set.add(c.district)
            else if (c.department) set.add(c.department)
        })
        return ['All', ...Array.from(set).sort()]
    }, [cameras])

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        return cameras.filter(c => {
            const matchesQuery =
                !q ||
                c.native_id.toLowerCase().includes(q) ||
                c.name.toLowerCase().includes(q) ||
                (c.department && c.department.toLowerCase().includes(q)) ||
                (c.district && c.district.toLowerCase().includes(q)) ||
                (c.address && c.address.toLowerCase().includes(q))

            const matchesDistrict =
                selectedDistrict === 'All' ||
                c.district === selectedDistrict ||
                c.department === selectedDistrict

            return matchesQuery && matchesDistrict
        })
    }, [cameras, query, selectedDistrict])

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.65)',
                backdropFilter: 'blur(3px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                padding: 16,
            }}
            onClick={e => e.stopPropagation()}
        >
            <div
                ref={modalRef}
                style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
                    width: '100%',
                    maxWidth: 520,
                    maxHeight: '80vh',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                }}
            >
                {/* Header */}
                <div
                    style={{
                        padding: '14px 16px',
                        borderBottom: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'var(--bg-surface)',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <CameraIcon size={18} color="var(--accent)" />
                        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
                            {title}
                        </span>
                        <span
                            style={{
                                fontSize: 11,
                                padding: '2px 8px',
                                borderRadius: 10,
                                background: 'rgba(59,130,246,0.15)',
                                color: 'var(--accent)',
                                fontWeight: 600,
                            }}
                        >
                            {cameras.length} Available
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: 4,
                            display: 'flex',
                        }}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Search input */}
                <div style={{ padding: '12px 16px 8px 16px', display: 'flex', gap: 8 }}>
                    <div
                        style={{
                            flex: 1,
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                        }}
                    >
                        <Search
                            size={15}
                            color="var(--text-muted)"
                            style={{ position: 'absolute', left: 10 }}
                        />
                        <input
                            autoFocus
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="Search by ID (e.g. cam12), name, toll plaza, district..."
                            style={{
                                width: '100%',
                                padding: '8px 32px 8px 34px',
                                fontSize: 13,
                                background: 'var(--bg-input)',
                                border: '1px solid var(--border)',
                                borderRadius: 6,
                                color: 'var(--text-primary)',
                                outline: 'none',
                            }}
                        />
                        {query && (
                            <button
                                onClick={() => setQuery('')}
                                style={{
                                    position: 'absolute',
                                    right: 8,
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--text-muted)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                }}
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                </div>

                {/* District Filter Chips */}
                <div
                    style={{
                        padding: '0 16px 10px 16px',
                        display: 'flex',
                        gap: 6,
                        overflowX: 'auto',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {districts.map(d => (
                        <button
                            key={d}
                            onClick={() => setSelectedDistrict(d)}
                            style={{
                                padding: '3px 9px',
                                fontSize: 11,
                                borderRadius: 12,
                                border: '1px solid',
                                borderColor: selectedDistrict === d ? 'var(--accent)' : 'var(--border)',
                                background: selectedDistrict === d ? 'rgba(59,130,246,0.2)' : 'var(--bg-surface)',
                                color: selectedDistrict === d ? 'var(--accent)' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                fontWeight: selectedDistrict === d ? 600 : 400,
                            }}
                        >
                            {d}
                        </button>
                    ))}
                </div>

                {/* Camera List */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 12px 12px' }}>
                    {filtered.length === 0 ? (
                        <div
                            style={{
                                padding: 24,
                                textAlign: 'center',
                                color: 'var(--text-muted)',
                                fontSize: 13,
                            }}
                        >
                            No cameras match your search query "{query}".
                        </div>
                    ) : (
                        filtered.map(c => (
                            <div
                                key={c.id}
                                onClick={() => onPick(c)}
                                style={{
                                    padding: '9px 12px',
                                    margin: '3px 0',
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    background: 'var(--bg-surface)',
                                    border: '1px solid transparent',
                                    transition: 'all 0.15s ease',
                                }}
                                onMouseOver={e => {
                                    e.currentTarget.style.borderColor = 'var(--accent)'
                                    e.currentTarget.style.background = 'var(--bg-card)'
                                }}
                                onMouseOut={e => {
                                    e.currentTarget.style.borderColor = 'transparent'
                                    e.currentTarget.style.background = 'var(--bg-surface)'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <span
                                        style={{
                                            fontFamily: 'var(--font-mono)',
                                            fontWeight: 700,
                                            fontSize: 12,
                                            padding: '2px 7px',
                                            borderRadius: 4,
                                            background: 'rgba(59,130,246,0.15)',
                                            color: 'var(--accent)',
                                        }}
                                    >
                                        {c.native_id}
                                    </span>
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                                            {c.name}
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                            {c.department} {c.district ? `· ${c.district}` : ''}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    {c.native_id === 'cam12' && (
                                        <span
                                            style={{
                                                fontSize: 10,
                                                padding: '2px 6px',
                                                borderRadius: 4,
                                                background: 'rgba(34,197,94,0.15)',
                                                color: 'var(--green)',
                                                fontWeight: 600,
                                            }}
                                        >
                                            ANPR READY
                                        </span>
                                    )}
                                    <span
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 4,
                                            fontSize: 11,
                                            color: 'var(--green)',
                                            fontWeight: 600,
                                        }}
                                    >
                                        <span
                                            style={{
                                                width: 6,
                                                height: 6,
                                                borderRadius: '50%',
                                                background: 'var(--green)',
                                            }}
                                        />
                                        LIVE
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}

function VideoTile({
    slot,
    index,
    onMaximise,
    onCameraChange,
    cameras,
    isMaximised,
    isSelected,
    onSelect,
    profile,
}: {
    slot: Slot
    index: number
    onMaximise: (i: number) => void
    onCameraChange: (i: number, c: Camera | null) => void
    cameras: Camera[]
    isMaximised: boolean
    isSelected: boolean
    onSelect: (i: number) => void
    profile: StreamProfile
}) {
    const [showPicker, setShowPicker] = useState(false)
    const [reloadKey, setReloadKey] = useState(0)
    const [state, setState] = useState<TileState>('connecting')
    const cam = slot.camera

    const handleState = useCallback((s: TileState) => setState(s), [])

    if (!cam) {
        return (
            <div
                className={`video-tile tile-empty ${isSelected ? 'tile-selected' : ''}`}
                onClick={() => {
                    onSelect(index)
                    setShowPicker(true)
                }}
                style={{
                    border: isSelected ? '2px solid var(--accent)' : undefined,
                    cursor: 'pointer',
                }}
            >
                <LayoutGrid size={24} />
                <span style={{ fontWeight: 500 }}>Slot {index + 1}: Click to assign camera</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Search from 30 live cameras
                </span>
                {showPicker && (
                    <CameraPicker
                        cameras={cameras}
                        title={`Assign Camera to Slot ${index + 1}`}
                        onPick={c => {
                            onCameraChange(index, c)
                            setShowPicker(false)
                        }}
                        onClose={() => setShowPicker(false)}
                    />
                )}
            </div>
        )
    }

    return (
        <div
            className={`video-tile ${isSelected ? 'tile-selected' : ''}`}
            onClick={() => onSelect(index)}
            style={{
                position: 'relative',
                outline: isSelected ? '2px solid var(--accent)' : undefined,
                outlineOffset: -2,
            }}
        >
            <LiveTile
                key={reloadKey}
                cameraId={cam.native_id}
                alt={`Live view from ${cam.name}`}
                onStateChange={handleState}
                profile={profile}
            />

            <div className="tile-overlay">
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span
                                style={{
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color: 'var(--accent)',
                                    background: 'rgba(0,0,0,0.6)',
                                    padding: '1px 5px',
                                    borderRadius: 3,
                                }}
                            >
                                {cam.native_id.toUpperCase()}
                            </span>
                            <div className="tile-cam-name">{cam.name}</div>
                        </div>
                        <div className="tile-cam-dept">
                            {cam.department} {cam.district ? `· ${cam.district}` : ''}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                        {/* Switch Camera Button */}
                        <button
                            style={{
                                background: 'rgba(0,0,0,0.6)',
                                border: '1px solid rgba(255,255,255,0.15)',
                                borderRadius: 4,
                                padding: '3px 6px',
                                cursor: 'pointer',
                                color: '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                fontSize: 11,
                            }}
                            title="Search & switch camera in this slot"
                            onClick={() => setShowPicker(true)}
                        >
                            <Search size={11} /> Switch
                        </button>
                        <button
                            style={{
                                background: 'rgba(0,0,0,0.5)',
                                border: 'none',
                                borderRadius: 4,
                                padding: '3px 6px',
                                cursor: 'pointer',
                                color: '#fff',
                            }}
                            title="Reload stream"
                            onClick={() => setReloadKey(k => k + 1)}
                        >
                            <RotateCw size={12} />
                        </button>
                        <button
                            style={{
                                background: 'rgba(0,0,0,0.5)',
                                border: 'none',
                                borderRadius: 4,
                                padding: '3px 6px',
                                cursor: 'pointer',
                                color: '#fff',
                            }}
                            title={isMaximised ? 'Restore' : 'Maximise'}
                            onClick={() => onMaximise(index)}
                        >
                            {isMaximised ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                        </button>
                        <button
                            style={{
                                background: 'rgba(0,0,0,0.5)',
                                border: 'none',
                                borderRadius: 4,
                                padding: '3px 6px',
                                cursor: 'pointer',
                                color: '#fff',
                                fontSize: 10,
                            }}
                            title="Clear tile"
                            onClick={() => onCameraChange(index, null)}
                        >
                            ✕
                        </button>
                    </div>
                </div>
            </div>

            {slot.isHero && <div className="tile-hero-badge">HERO</div>}
            {state === 'playing' && (
                <div
                    style={{
                        position: 'absolute',
                        top: 6,
                        left: 6,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        background: 'rgba(0,0,0,0.65)',
                        borderRadius: 4,
                        padding: '2px 6px',
                        fontSize: 10,
                        color: 'var(--green)',
                        fontWeight: 700,
                        zIndex: 6,
                    }}
                >
                    <div className="pulse-dot" />
                    LIVE
                </div>
            )}

            {/* In-tile Camera Picker */}
            {showPicker && (
                <CameraPicker
                    cameras={cameras}
                    title={`Switch Camera for Slot ${index + 1}`}
                    onPick={c => {
                        onCameraChange(index, c)
                        setShowPicker(false)
                    }}
                    onClose={() => setShowPicker(false)}
                />
            )}
        </div>
    )
}

export default function VideoWallPage() {
    const [cameras, setCameras] = useState<Camera[]>([])
    const [slots, setSlots] = useState<Slot[]>(
        Array.from({ length: 9 }, () => ({ camera: null, isHero: false }))
    )
    const [layout, setLayout] = useState<'3x3' | '2x2' | '1x1'>('2x2')
    const [maximised, setMaximised] = useState<number | null>(null)
    const [selectedSlot, setSelectedSlot] = useState<number>(0)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Top Search Bar State
    const [searchQuery, setSearchQuery] = useState('')
    const [isSearchFocused, setIsSearchFocused] = useState(false)
    const searchContainerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        getCameras({ live_only: true, limit: 100 })
            .then((data: Camera[]) => {
                setCameras(data)
                setSlots(prev =>
                    prev.map((s, i) =>
                        i < data.length ? { camera: data[i], isHero: i === 0 } : s
                    )
                )
            })
            .catch(() => setError('Could not load cameras. Is the backend running?'))
            .finally(() => setLoading(false))
    }, [])

    // Click outside search dropdown
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                searchContainerRef.current &&
                !searchContainerRef.current.contains(e.target as Node)
            ) {
                setIsSearchFocused(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Pause video when tab is hidden
    useEffect(() => {
        const onVisibility = () => {
            document.querySelectorAll('video').forEach(v => {
                if (document.hidden) v.pause()
                else v.play().catch(() => { /* autoplay policy */ })
            })
        }
        document.addEventListener('visibilitychange', onVisibility)
        return () => document.removeEventListener('visibilitychange', onVisibility)
    }, [])

    const handleMaximise = (idx: number) => setMaximised(m => (m === idx ? null : idx))
    const handleCameraChange = (idx: number, cam: Camera | null) =>
        setSlots(prev => prev.map((s, i) => (i === idx ? { ...s, camera: cam } : s)))

    const gridCount = layout === '3x3' ? 9 : layout === '2x2' ? 4 : 1
    const profile: StreamProfile =
        maximised !== null || layout === '1x1'
            ? 'high'
            : layout === '2x2'
            ? 'balanced'
            : 'low'

    const displaySlots =
        maximised !== null
            ? [{ ...slots[maximised], isHero: false }]
            : slots.slice(0, gridCount)

    // Filtered cameras for the header search bar
    const searchResults = useMemo(() => {
        const q = searchQuery.trim().toLowerCase()
        if (!q) return cameras
        return cameras.filter(
            c =>
                c.native_id.toLowerCase().includes(q) ||
                c.name.toLowerCase().includes(q) ||
                (c.department && c.department.toLowerCase().includes(q)) ||
                (c.district && c.district.toLowerCase().includes(q)) ||
                (c.address && c.address.toLowerCase().includes(q))
        )
    }, [cameras, searchQuery])

    const assignToSlot = (cam: Camera, slotIndex: number) => {
        handleCameraChange(slotIndex, cam)
        setSelectedSlot(slotIndex)
        setIsSearchFocused(false)
        setSearchQuery('')
    }

    const openInFullView = (cam: Camera) => {
        handleCameraChange(0, cam)
        setLayout('1x1')
        setMaximised(null)
        setSelectedSlot(0)
        setIsSearchFocused(false)
        setSearchQuery('')
    }

    return (
        <div className="page-content no-padding" style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Top Toolbar */}
            <div
                style={{
                    padding: '8px 16px',
                    background: 'var(--bg-surface)',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    gap: 12,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                }}
            >
                {/* Layout Controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
                        LAYOUT:
                    </span>
                    {(['3x3', '2x2', '1x1'] as const).map(l => (
                        <button
                            key={l}
                            className={`btn btn-sm ${layout === l && maximised === null ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => {
                                setLayout(l)
                                setMaximised(null)
                            }}
                        >
                            {l}
                        </button>
                    ))}
                    {maximised !== null && (
                        <button className="btn btn-ghost btn-sm" onClick={() => setMaximised(null)}>
                            <Minimize2 size={12} /> Exit fullscreen
                        </button>
                    )}
                </div>

                {/* Vertical separator */}
                <div style={{ width: 1, height: 20, background: 'var(--border)' }} />

                {/* CAMERA SEARCH BAR (Search any of the 30 cameras) */}
                <div
                    ref={searchContainerRef}
                    style={{ position: 'relative', flex: '1 1 320px', maxWidth: 460 }}
                >
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            background: 'var(--bg-input)',
                            border: `1px solid ${isSearchFocused ? 'var(--accent)' : 'var(--border)'}`,
                            borderRadius: 6,
                            padding: '4px 10px',
                            gap: 8,
                            transition: 'border-color 0.15s ease',
                        }}
                    >
                        <Search size={14} color="var(--accent)" />
                        <input
                            value={searchQuery}
                            onFocus={() => setIsSearchFocused(true)}
                            onChange={e => {
                                setSearchQuery(e.target.value)
                                setIsSearchFocused(true)
                            }}
                            placeholder="Search 30 cameras (e.g. cam12, Adalaj Toll, Janpath, Traffic)..."
                            style={{
                                flex: 1,
                                background: 'transparent',
                                border: 'none',
                                outline: 'none',
                                color: 'var(--text-primary)',
                                fontSize: 12.5,
                            }}
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--text-muted)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    padding: 2,
                                }}
                            >
                                <X size={13} />
                            </button>
                        )}
                        <span
                            style={{
                                fontSize: 11,
                                color: 'var(--text-muted)',
                                background: 'var(--bg-surface)',
                                padding: '2px 6px',
                                borderRadius: 4,
                                whiteSpace: 'nowrap',
                            }}
                        >
                            Slot {selectedSlot + 1} active
                        </span>
                    </div>

                    {/* Search Results Dropdown */}
                    {isSearchFocused && (
                        <div
                            style={{
                                position: 'absolute',
                                top: 'calc(100% + 4px)',
                                left: 0,
                                right: 0,
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border)',
                                borderRadius: 8,
                                boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                                maxHeight: 380,
                                overflowY: 'auto',
                                zIndex: 1000,
                                padding: 6,
                            }}
                        >
                            <div
                                style={{
                                    padding: '6px 10px',
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: 'var(--text-muted)',
                                    borderBottom: '1px solid var(--border)',
                                    marginBottom: 4,
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                }}
                            >
                                <span>MATCHING CAMERAS ({searchResults.length} / {cameras.length})</span>
                                <span>Click to assign to Slot {selectedSlot + 1}</span>
                            </div>

                            {searchResults.length === 0 ? (
                                <div
                                    style={{
                                        padding: '16px 12px',
                                        fontSize: 12,
                                        color: 'var(--text-muted)',
                                        textAlign: 'center',
                                    }}
                                >
                                    No cameras found matching "{searchQuery}"
                                </div>
                            ) : (
                                searchResults.map(cam => (
                                    <div
                                        key={cam.id}
                                        style={{
                                            padding: '8px 10px',
                                            borderRadius: 6,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            cursor: 'pointer',
                                            transition: 'background 0.1s ease',
                                        }}
                                        onMouseOver={e => (e.currentTarget.style.background = 'var(--bg-surface)')}
                                        onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
                                        onClick={() => assignToSlot(cam, selectedSlot)}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                            <span
                                                style={{
                                                    fontFamily: 'var(--font-mono)',
                                                    fontWeight: 700,
                                                    fontSize: 11,
                                                    padding: '2px 6px',
                                                    borderRadius: 4,
                                                    background: 'rgba(59,130,246,0.15)',
                                                    color: 'var(--accent)',
                                                    flexShrink: 0,
                                                }}
                                            >
                                                {cam.native_id}
                                            </span>
                                            <div style={{ overflow: 'hidden' }}>
                                                <div
                                                    style={{
                                                        fontSize: 12.5,
                                                        fontWeight: 500,
                                                        color: 'var(--text-primary)',
                                                        textOverflow: 'ellipsis',
                                                        overflow: 'hidden',
                                                        whiteSpace: 'nowrap',
                                                    }}
                                                >
                                                    {cam.name}
                                                </div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                    {cam.department} {cam.district ? `· ${cam.district}` : ''}
                                                </div>
                                            </div>
                                        </div>

                                        <div
                                            style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
                                            onClick={e => e.stopPropagation()}
                                        >
                                            <button
                                                className="btn btn-ghost btn-sm"
                                                style={{ fontSize: 11, padding: '2px 8px' }}
                                                title="Open this camera fullscreen (1x1)"
                                                onClick={() => openInFullView(cam)}
                                            >
                                                <Maximize2 size={11} /> 1×1
                                            </button>
                                            <button
                                                className="btn btn-primary btn-sm"
                                                style={{ fontSize: 11, padding: '2px 8px' }}
                                                title={`Assign to Slot ${selectedSlot + 1}`}
                                                onClick={() => assignToSlot(cam, selectedSlot)}
                                            >
                                                Set Slot {selectedSlot + 1}
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>

                {/* Status info */}
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {loading ? 'Loading cameras…' : `${cameras.length} cameras registered (${cameras.filter(c => c.is_live).length} live)`}
                    </span>
                </div>
            </div>

            {error && (
                <div style={{ padding: '10px 16px', color: 'var(--red)', fontSize: 13 }}>{error}</div>
            )}

            {/* Video Wall Grid */}
            <div style={{ flex: 1, padding: 4 }}>
                <div
                    className={`video-wall-grid ${maximised !== null ? 'grid-1x1' : `grid-${layout}`}`}
                    style={{ height: '100%' }}
                >
                    {displaySlots.map((slot, i) => {
                        const realIndex = maximised !== null ? maximised : i
                        return (
                            <VideoTile
                                key={slot.camera ? `${realIndex}-${slot.camera.native_id}` : `empty-${realIndex}`}
                                slot={slot}
                                index={realIndex}
                                cameras={cameras}
                                isMaximised={maximised === realIndex}
                                isSelected={selectedSlot === realIndex}
                                onSelect={setSelectedSlot}
                                profile={profile}
                                onMaximise={handleMaximise}
                                onCameraChange={handleCameraChange}
                            />
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
