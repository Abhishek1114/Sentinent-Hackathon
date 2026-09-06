import { useEffect } from 'react'
import { AlertTriangle, ShieldAlert, X } from 'lucide-react'
import type { LiveAlert } from '../hooks/useAlertWebSocket'

interface Props {
    alert: LiveAlert
    onClose: () => void
}

export default function Toast({ alert, onClose }: Props) {
    useEffect(() => {
        const t = setTimeout(onClose, 8000)
        return () => clearTimeout(t)
    }, [onClose])

    const isCritical = alert.severity === 'critical'
    const isHigh = alert.severity === 'high'
    const sevColor = isCritical ? 'var(--red)' : isHigh ? 'var(--yellow)' : 'var(--accent)'

    return (
        <div
            className="toast"
            style={{
                background: 'rgba(17, 28, 51, 0.95)',
                backdropFilter: 'blur(12px)',
                border: `1px solid ${sevColor}`,
                boxShadow: `0 8px 30px rgba(0,0,0,0.6), 0 0 20px ${sevColor}40`,
                borderRadius: 12,
                padding: '14px 16px',
                minWidth: 320,
                maxWidth: 400,
                color: 'var(--text-primary)',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: sevColor, fontWeight: 800, fontSize: 11, letterSpacing: 0.8 }}>
                    <ShieldAlert size={15} />
                    <span>WATCHLIST ALERT · {alert.reason?.toUpperCase()}</span>
                </div>
                <button
                    onClick={onClose}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}
                >
                    <X size={14} />
                </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0' }}>
                <div className="plate-chip">
                    <span className="plate-chip-text" style={{ fontSize: 15 }}>{alert.plate_text}</span>
                </div>
                <span
                    className="badge-pill"
                    style={{
                        background: `${sevColor}20`,
                        color: sevColor,
                        border: `1px solid ${sevColor}50`,
                        fontWeight: 700,
                    }}
                >
                    {alert.severity?.toUpperCase()}
                </span>
            </div>

            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 6 }}>
                {alert.match_type === 'fuzzy' ? 'Fuzzy match · ' : 'Exact match · '}
                Score: {(alert.score * 100).toFixed(0)}%
                {alert.case_ref ? ` · Case: ${alert.case_ref}` : ''}
            </div>
        </div>
    )
}
