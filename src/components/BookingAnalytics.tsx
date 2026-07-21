import { useMemo } from 'react';
import './BookingAnalytics.css';
import { parseLocalDate, formatTime, WEEKDAY_LABELS, type Booking } from '../lib/booking';

/* ── helpers ─────────────────────────────────────────────────────── */

function effectiveDate(b: Booking): Date {
    const ts = b.createdAt as { toDate?: () => Date } | null | undefined;
    if (ts && typeof ts.toDate === 'function') return ts.toDate();
    return parseLocalDate(b.date);
}

function tally(items: Booking[], key: (b: Booking) => string | undefined) {
    const m = new Map<string, number>();
    for (const it of items) {
        const k = key(it);
        if (!k) continue;
        m.set(k, (m.get(k) || 0) + 1);
    }
    return [...m.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count);
}

const regionName = (code: string) => {
    try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(code.toUpperCase()) || code; }
    catch { return code; }
};
const flagEmoji = (code: string) => {
    if (!/^[a-zA-Z]{2}$/.test(code)) return '🌐';
    return String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1f1a5 + c.charCodeAt(0)));
};

const SUBJECT_COLORS: Record<string, string> = {
    Mathematics: '#d97706', Physics: '#6b8f71', 'Computer Science': '#c2714f',
};
const STATUS_COLORS: Record<string, string> = {
    pending: '#d97706', confirmed: '#6b8f71', done: '#94a3b8', cancelled: '#ef4444',
};

/* ── small presentational pieces ─────────────────────────────────── */

function Stat({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
    return (
        <div className={`ba-stat ${accent ? 'ba-stat--accent' : ''}`}>
            <span className="ba-stat-value">{value}</span>
            <span className="ba-stat-label">{label}</span>
            {sub && <span className="ba-stat-sub">{sub}</span>}
        </div>
    );
}

function BarList({ data, color, formatLabel, empty }: {
    data: { label: string; count: number }[];
    color?: string | ((label: string) => string);
    formatLabel?: (label: string) => React.ReactNode;
    empty?: string;
}) {
    if (data.length === 0) return <p className="ba-empty">{empty || 'No data yet.'}</p>;
    const max = Math.max(...data.map(d => d.count), 1);
    return (
        <div className="ba-bars">
            {data.map(d => (
                <div className="ba-bar-row" key={d.label}>
                    <span className="ba-bar-label">{formatLabel ? formatLabel(d.label) : d.label}</span>
                    <div className="ba-bar-track">
                        <div className="ba-bar-fill" style={{
                            width: `${(d.count / max) * 100}%`,
                            background: typeof color === 'function' ? color(d.label) : (color || 'var(--amber)'),
                        }} />
                    </div>
                    <span className="ba-bar-count">{d.count}</span>
                </div>
            ))}
        </div>
    );
}

/* ── main ────────────────────────────────────────────────────────── */

export default function BookingAnalytics({ bookings }: { bookings: Booking[] }) {
    const m = useMemo(() => {
        const now = new Date();
        const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay()); startOfWeek.setHours(0, 0, 0, 0);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const active = bookings.filter(b => b.status !== 'cancelled');
        const dated = bookings.map(b => ({ b, d: effectiveDate(b) }));

        const thisWeek = dated.filter(x => x.d >= startOfWeek).length;
        const thisMonth = dated.filter(x => x.d >= startOfMonth).length;

        const byStatus = (s: string) => bookings.filter(b => b.status === s).length;
        const total = bookings.length;
        const cancelled = byStatus('cancelled');

        const emails = bookings.map(b => (b.email || '').toLowerCase()).filter(Boolean);
        const uniqueStudents = new Set(emails).size;
        const repeat = [...new Set(emails)].filter(e => emails.filter(x => x === e).length > 1).length;

        // 8-week activity
        const weeks = 8;
        const weekStart = new Date(startOfWeek); weekStart.setDate(weekStart.getDate() - (weeks - 1) * 7);
        const buckets = Array.from({ length: weeks }, (_, i) => {
            const s = new Date(weekStart); s.setDate(weekStart.getDate() + i * 7);
            return { label: `${s.getMonth() + 1}/${s.getDate()}`, count: 0 };
        });
        for (const { d } of dated) {
            if (d < weekStart) continue;
            const idx = Math.floor((d.getTime() - weekStart.getTime()) / (7 * 86400000));
            if (idx >= 0 && idx < weeks) buckets[idx].count++;
        }

        return {
            total, active: active.length, thisWeek, thisMonth,
            pending: byStatus('pending'), confirmed: byStatus('confirmed'),
            done: byStatus('done'), cancelled,
            cancelRate: total ? Math.round((cancelled / total) * 100) : 0,
            uniqueStudents, repeat,
            bySubject: tally(bookings, b => b.subject),
            byStatus: tally(bookings, b => b.status),
            bySource: tally(bookings, b => b.source),
            byCountry: tally(bookings, b => b.country),
            byCity: tally(bookings, b => (b.city ? `${b.city}${b.region ? ', ' + b.region : ''}` : undefined)),
            byWeekday: WEEKDAY_LABELS.map((label, i) => ({
                label, count: bookings.filter(b => parseLocalDate(b.date).getDay() === i).length,
            })).filter(d => d.count > 0).sort((a, b) => b.count - a.count),
            byTime: tally(bookings, b => b.time),
            byDevice: tally(bookings, b => b.device),
            weekly: buckets,
        };
    }, [bookings]);

    const maxWeekly = Math.max(...m.weekly.map(w => w.count), 1);
    const hasGeo = m.byCountry.length > 0;
    const hasSource = m.bySource.length > 0;

    return (
        <div className="ba">
            {/* KPI row */}
            <div className="ba-stats">
                <Stat label="Total bookings" value={m.total} accent />
                <Stat label="This month" value={m.thisMonth} />
                <Stat label="This week" value={m.thisWeek} />
                <Stat label="Awaiting confirmation" value={m.pending} sub={m.pending ? 'needs action' : 'all clear'} />
                <Stat label="Unique students" value={m.uniqueStudents} sub={m.repeat ? `${m.repeat} repeat` : undefined} />
                <Stat label="Cancel rate" value={`${m.cancelRate}%`} sub={`${m.cancelled} cancelled`} />
            </div>

            {/* Activity over time */}
            <div className="ba-panel ba-panel--wide">
                <h3 className="ba-panel-title">Booking activity <span>· last 8 weeks</span></h3>
                <div className="ba-cols">
                    {m.weekly.map((w, i) => (
                        <div className="ba-col" key={i}>
                            <div className="ba-col-bar-wrap">
                                <span className="ba-col-value">{w.count || ''}</span>
                                <div className="ba-col-bar" style={{ height: `${(w.count / maxWeekly) * 100}%` }} />
                            </div>
                            <span className="ba-col-label">{w.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Breakdown grid */}
            <div className="ba-grid">
                <div className="ba-panel">
                    <h3 className="ba-panel-title">By subject</h3>
                    <BarList data={m.bySubject} color={(l) => SUBJECT_COLORS[l] || 'var(--amber)'} />
                </div>

                <div className="ba-panel">
                    <h3 className="ba-panel-title">By status</h3>
                    <BarList data={m.byStatus} color={(l) => STATUS_COLORS[l] || 'var(--amber)'}
                        formatLabel={(l) => <span style={{ textTransform: 'capitalize' }}>{l}</span>} />
                </div>

                <div className="ba-panel">
                    <h3 className="ba-panel-title">Where they book from</h3>
                    {hasGeo ? (
                        <BarList data={m.byCountry} color="#6b8f71"
                            formatLabel={(code) => <span>{flagEmoji(code)} {regionName(code)}</span>} />
                    ) : <p className="ba-empty">Location data appears on new bookings.</p>}
                    {m.byCity.length > 0 && (
                        <div className="ba-sublist">
                            <span className="ba-sublist-title">Top cities</span>
                            {m.byCity.slice(0, 5).map(c => (
                                <div className="ba-sublist-row" key={c.label}><span>{c.label}</span><b>{c.count}</b></div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="ba-panel">
                    <h3 className="ba-panel-title">Traffic source</h3>
                    {hasSource ? (
                        <BarList data={m.bySource} color="#c2714f"
                            formatLabel={(l) => <span style={{ textTransform: 'capitalize' }}>{l}</span>} />
                    ) : <p className="ba-empty">Source data appears on new bookings.</p>}
                </div>

                <div className="ba-panel">
                    <h3 className="ba-panel-title">Popular days</h3>
                    <BarList data={m.byWeekday} color="#d97706" empty="No bookings yet." />
                </div>

                <div className="ba-panel">
                    <h3 className="ba-panel-title">Popular times</h3>
                    <BarList data={m.byTime} color="#8b5cf6" formatLabel={(t) => formatTime(t)} empty="No bookings yet." />
                </div>
            </div>

            {m.byDevice.length > 0 && (
                <div className="ba-panel ba-panel--wide">
                    <h3 className="ba-panel-title">Device</h3>
                    <BarList data={m.byDevice} color="#0ea5e9"
                        formatLabel={(l) => <span style={{ textTransform: 'capitalize' }}>{l}</span>} />
                </div>
            )}
        </div>
    );
}
