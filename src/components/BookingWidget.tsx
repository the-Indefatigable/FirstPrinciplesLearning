import { useEffect, useMemo, useState } from 'react';
import './BookingWidget.css';
import {
    fetchAvailability, fetchTakenSlots, generateSlots, createBooking,
    parseLocalDate, toDateStr, formatTime, bookableDateWindow,
    WEEKDAY_LABELS, DEFAULT_AVAILABILITY, type AvailabilityConfig,
} from '../lib/booking';

type Step = 'subject' | 'date' | 'time' | 'details' | 'done';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

const emailValid = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

export default function BookingWidget() {
    const [cfg, setCfg] = useState<AvailabilityConfig>(DEFAULT_AVAILABILITY);
    const [loading, setLoading] = useState(true);

    const [step, setStep] = useState<Step>('subject');
    const [subject, setSubject] = useState('');
    const [date, setDate] = useState('');          // YYYY-MM-DD
    const [time, setTime] = useState('');          // HH:MM
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [notes, setNotes] = useState('');

    const [taken, setTaken] = useState<string[]>([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    // Calendar view month
    const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
    const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());

    useEffect(() => {
        let mounted = true;
        fetchAvailability()
            .then(c => { if (mounted) setCfg(c); })
            .catch(err => console.error('availability load failed', err))
            .finally(() => { if (mounted) setLoading(false); });
        return () => { mounted = false; };
    }, []);

    const window = useMemo(() => bookableDateWindow(cfg), [cfg]);

    // Load taken slots whenever the chosen date changes
    useEffect(() => {
        if (!date) return;
        let mounted = true;
        setLoadingSlots(true);
        fetchTakenSlots(date)
            .then(t => { if (mounted) setTaken(t); })
            .catch(() => { if (mounted) setTaken([]); })
            .finally(() => { if (mounted) setLoadingSlots(false); });
        return () => { mounted = false; };
    }, [date]);

    const slots = useMemo(
        () => (date ? generateSlots(date, cfg, taken) : []),
        [date, cfg, taken],
    );

    /* ── Calendar grid for the current view month ── */
    const calendarCells = useMemo(() => {
        const first = new Date(viewYear, viewMonth, 1);
        const startPad = first.getDay(); // 0=Sun
        const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
        const cells: (string | null)[] = [];
        for (let i = 0; i < startPad; i++) cells.push(null);
        for (let d = 1; d <= daysInMonth; d++) {
            cells.push(toDateStr(new Date(viewYear, viewMonth, d)));
        }
        return cells;
    }, [viewYear, viewMonth]);

    const isDateBookable = (ds: string): boolean => {
        if (ds < window.min || ds > window.max) return false;
        const wd = parseLocalDate(ds).getDay();
        return cfg.days[wd]?.enabled ?? false;
    };

    const prevMonth = () => {
        const m = viewMonth - 1;
        if (m < 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m);
    };
    const nextMonth = () => {
        const m = viewMonth + 1;
        if (m > 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m);
    };

    const reset = () => {
        setStep('subject'); setSubject(''); setDate(''); setTime('');
        setName(''); setEmail(''); setNotes(''); setError('');
    };

    const submit = async () => {
        setError('');
        if (!name.trim()) { setError('Please enter your name.'); return; }
        if (!emailValid(email)) { setError('Please enter a valid email.'); return; }
        setSubmitting(true);
        try {
            await createBooking({
                name, email, subject, date, time,
                durationMin: cfg.slotMinutes, notes,
            });
            // Fire off confirmation emails (non-blocking — booking is already saved).
            void fetch('/api/send-booking', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name, email, subject,
                    whenText: `${prettyDate} at ${formatTime(time)}`,
                    durationMin: cfg.slotMinutes, notes,
                }),
            }).catch(() => { /* email is best-effort; the booking already succeeded */ });
            setStep('done');
        } catch (err) {
            if (err instanceof Error && err.message === 'SLOT_TAKEN') {
                setError('Sorry — that slot was just taken. Please pick another time.');
                setStep('time');
                // refresh taken slots
                fetchTakenSlots(date).then(setTaken).catch(() => {});
            } else {
                setError('Something went wrong. Please try again or email me directly.');
                console.error(err);
            }
        } finally {
            setSubmitting(false);
        }
    };

    const prettyDate = date
        ? parseLocalDate(date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
        : '';

    const stepIndex = ['subject', 'date', 'time', 'details'].indexOf(step);

    if (loading) {
        return <div className="bw-shell"><div className="bw-loading">Loading availability…</div></div>;
    }

    return (
        <div className="bw-shell">
            {/* Progress rail */}
            {step !== 'done' && (
                <div className="bw-steps">
                    {['Subject', 'Date', 'Time', 'Details'].map((label, i) => (
                        <div key={label} className={`bw-step ${i === stepIndex ? 'active' : ''} ${i < stepIndex ? 'complete' : ''}`}>
                            <span className="bw-step-dot">{i < stepIndex ? '✓' : i + 1}</span>
                            <span className="bw-step-label">{label}</span>
                        </div>
                    ))}
                </div>
            )}

            <div className="bw-body">
                {/* ── Step: Subject ── */}
                {step === 'subject' && (
                    <div className="bw-pane">
                        <h3 className="bw-heading">What would you like help with?</h3>
                        <p className="bw-sub">Pick a subject to get started. This first session is free.</p>
                        <div className="bw-subjects">
                            {cfg.subjects.map(s => (
                                <button
                                    key={s}
                                    className={`bw-subject ${subject === s ? 'selected' : ''}`}
                                    onClick={() => { setSubject(s); setStep('date'); }}
                                >
                                    <span className="bw-subject-icon">{subjectIcon(s)}</span>
                                    <span>{s}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Step: Date ── */}
                {step === 'date' && (
                    <div className="bw-pane">
                        <h3 className="bw-heading">Choose a day</h3>
                        <p className="bw-sub">Times shown in {cfg.timezone.replace(/_/g, ' ')}.</p>
                        <div className="bw-cal">
                            <div className="bw-cal-head">
                                <button className="bw-cal-nav" onClick={prevMonth} aria-label="Previous month">‹</button>
                                <span className="bw-cal-title">{MONTHS[viewMonth]} {viewYear}</span>
                                <button className="bw-cal-nav" onClick={nextMonth} aria-label="Next month">›</button>
                            </div>
                            <div className="bw-cal-grid">
                                {WEEKDAY_LABELS.map(w => <span key={w} className="bw-cal-wd">{w}</span>)}
                                {calendarCells.map((ds, i) => {
                                    if (!ds) return <span key={`e${i}`} className="bw-cal-empty" />;
                                    const bookable = isDateBookable(ds);
                                    const day = Number(ds.split('-')[2]);
                                    return (
                                        <button
                                            key={ds}
                                            disabled={!bookable}
                                            className={`bw-cal-day ${date === ds ? 'selected' : ''} ${bookable ? 'open' : ''}`}
                                            onClick={() => { setDate(ds); setTime(''); setStep('time'); }}
                                        >
                                            {day}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="bw-nav">
                            <button className="bw-back" onClick={() => setStep('subject')}>← Back</button>
                        </div>
                    </div>
                )}

                {/* ── Step: Time ── */}
                {step === 'time' && (
                    <div className="bw-pane">
                        <h3 className="bw-heading">{prettyDate}</h3>
                        <p className="bw-sub">{cfg.slotMinutes}-minute session · pick a start time.</p>
                        {error && <div className="bw-error">{error}</div>}
                        {loadingSlots ? (
                            <div className="bw-loading">Checking open times…</div>
                        ) : slots.length === 0 ? (
                            <div className="bw-empty">
                                <span>😴</span>
                                <p>No open times this day. Try another date.</p>
                            </div>
                        ) : (
                            <div className="bw-slots">
                                {slots.map(s => (
                                    <button
                                        key={s}
                                        className={`bw-slot ${time === s ? 'selected' : ''}`}
                                        onClick={() => { setTime(s); setStep('details'); }}
                                    >
                                        {formatTime(s)}
                                    </button>
                                ))}
                            </div>
                        )}
                        <div className="bw-nav">
                            <button className="bw-back" onClick={() => setStep('date')}>← Change day</button>
                        </div>
                    </div>
                )}

                {/* ── Step: Details ── */}
                {step === 'details' && (
                    <div className="bw-pane">
                        <h3 className="bw-heading">Almost there</h3>
                        <div className="bw-summary">
                            <div><span className="bw-summary-k">Subject</span><span>{subjectIcon(subject)} {subject}</span></div>
                            <div><span className="bw-summary-k">When</span><span>{prettyDate} · {formatTime(time)}</span></div>
                            <div><span className="bw-summary-k">Length</span><span>{cfg.slotMinutes} min · Free</span></div>
                        </div>
                        {error && <div className="bw-error">{error}</div>}
                        <div className="bw-form">
                            <label className="bw-field">
                                <span>Your name</span>
                                <input value={name} onChange={e => setName(e.target.value)} placeholder="Alex Chen" autoFocus />
                            </label>
                            <label className="bw-field">
                                <span>Email</span>
                                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
                            </label>
                            <label className="bw-field">
                                <span>What do you want to focus on? <em>(optional)</em></span>
                                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                                    placeholder="e.g. I have a calculus test next week on integrals…" />
                            </label>
                        </div>
                        <div className="bw-nav">
                            <button className="bw-back" onClick={() => setStep('time')}>← Back</button>
                            <button className="bw-confirm" onClick={submit} disabled={submitting}>
                                {submitting ? 'Booking…' : 'Confirm booking →'}
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Step: Done ── */}
                {step === 'done' && (
                    <div className="bw-pane bw-done">
                        <div className="bw-done-check">✓</div>
                        <h3 className="bw-heading">You're booked!</h3>
                        <p className="bw-sub">
                            {subject} · {prettyDate} at {formatTime(time)}
                        </p>
                        <p className="bw-done-note">
                            I'll reach out at <strong>{email}</strong> to confirm and send the meeting link.
                            See you soon, {name.split(' ')[0]}!
                        </p>
                        <button className="bw-confirm" onClick={reset}>Book another session</button>
                    </div>
                )}
            </div>
        </div>
    );
}

function subjectIcon(s: string): string {
    const k = s.toLowerCase();
    if (k.includes('math')) return '📐';
    if (k.includes('phys')) return '🔭';
    if (k.includes('comp') || k.includes('cs') || k.includes('code')) return '💻';
    return '📘';
}
