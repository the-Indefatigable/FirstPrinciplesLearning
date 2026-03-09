import { useEffect, useState } from 'react';
import { collection, query, orderBy, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import Footer from '../components/Footer';
import SEOHead from '../components/SEOHead';

interface Review {
    id: string;
    name: string;
    grade: string;
    stars: number;
    text: string;
}

/* ── Star Picker ──────────────────────────────────────────────────── */
function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
    return (
        <div style={{ display: 'flex', gap: 4 }}>
            {[1, 2, 3, 4, 5].map(n => (
                <button key={n} type="button" onClick={() => onChange(n)}
                    style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: '1.5rem', color: n <= value ? '#d97706' : 'var(--text-dim)',
                        transition: 'transform 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.2)')}
                    onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                >★</button>
            ))}
        </div>
    );
}

/* ── Full Reviews Page ────────────────────────────────────────────── */
export default function Reviews() {
    const [reviews, setReviews] = useState<Review[]>([]);
    const [loading, setLoading] = useState(true);

    // Form state
    const [name, setName] = useState('');
    const [grade, setGrade] = useState('');
    const [stars, setStars] = useState(5);
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [toast, setToast] = useState('');
    const [honeypot, setHoneypot] = useState('');
    const [lastSubmit, setLastSubmit] = useState(0);

    const fetchAll = async () => {
        try {
            const q = query(collection(db, 'reviews'), orderBy('stars', 'desc'));
            const snap = await getDocs(q);
            setReviews(snap.docs.map(d => ({ id: d.id, ...d.data() } as Review)));
        } catch (err) {
            console.error('Failed to fetch reviews:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAll(); }, []);

    const submit = async () => {
        if (!name.trim() || !text.trim()) return;
        // Spam protection: honeypot
        if (honeypot) return;
        // Spam protection: rate limit (60s cooldown)
        const now = Date.now();
        if (now - lastSubmit < 60_000) {
            setToast('Please wait a minute before submitting again.');
            setTimeout(() => setToast(''), 4000);
            return;
        }
        setSending(true);
        try {
            setLastSubmit(now);
            await addDoc(collection(db, 'reviews'), {
                name: name.trim(),
                grade: grade.trim(),
                stars,
                text: text.trim(),
                createdAt: serverTimestamp(),
            });
            setName(''); setGrade(''); setStars(5); setText('');
            setShowForm(false);
            setToast('Thank you for your review! ✨');
            setTimeout(() => setToast(''), 4000);
            fetchAll();
        } catch (err) {
            console.error('Submit failed:', err);
        } finally {
            setSending(false);
        }
    };

    const renderStars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);

    const avg = reviews.length > 0
        ? (reviews.reduce((s, r) => s + r.stars, 0) / reviews.length).toFixed(1)
        : '—';

    return (
        <>
            <SEOHead
                title="Student Reviews — FirstPrinciple Tutoring"
                description="Read real student reviews and leave your own feedback. See why students love first-principles tutoring in Math, Physics, and Computer Science."
                canonical="https://www.firstprincipleslearningg.com/reviews"
            />
            <main style={{ padding: '100px 24px 60px', maxWidth: 900, margin: '0 auto' }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: 40 }}>
                    <div className="section-eyebrow" style={{ justifyContent: 'center' }}>
                        <span className="eyebrow-num">★</span>
                        <span className="eyebrow-line" />
                        <span>Reviews</span>
                    </div>
                    <h1 style={{ fontSize: '2.2rem', margin: '12px 0 8px' }}>Student Reviews</h1>
                    <p style={{ color: 'var(--text-dim)', fontSize: '1.05rem', maxWidth: 520, margin: '0 auto' }}>
                        {reviews.length > 0
                            ? `${reviews.length} review${reviews.length > 1 ? 's' : ''} · ${avg} average`
                            : 'Be the first to leave a review!'}
                    </p>
                </div>

                {/* Toast */}
                {toast && (
                    <div style={{
                        padding: '12px 20px', background: 'var(--sage)', color: '#fff',
                        borderRadius: 'var(--radius-sm)', textAlign: 'center', marginBottom: 20,
                        fontSize: '0.95rem', fontWeight: 600,
                    }}>{toast}</div>
                )}

                {/* CTA + Form */}
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    {!showForm ? (
                        <button className="btn-primary" onClick={() => setShowForm(true)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            ✍ Leave a Review
                        </button>
                    ) : (
                        <div className="paper-card" style={{ padding: '24px 28px', maxWidth: 520, margin: '0 auto', textAlign: 'left' }}>
                            <h4 style={{ margin: '0 0 16px', fontSize: '1.1rem' }}>Share Your Experience</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <div style={{ display: 'flex', gap: 12 }}>
                                    <input placeholder="Your name *" value={name} onChange={e => setName(e.target.value)}
                                        style={{ flex: 1, padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-warm)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.9rem' }} />
                                    <input placeholder="Grade (e.g. Grade 11)" value={grade} onChange={e => setGrade(e.target.value)}
                                        style={{ flex: 1, padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-warm)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.9rem' }} />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.82rem', color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>Rating</label>
                                    <StarPicker value={stars} onChange={setStars} />
                                </div>
                                {/* Honeypot — hidden from real users, catches bots */}
                                <input
                                    type="text"
                                    value={honeypot}
                                    onChange={e => setHoneypot(e.target.value)}
                                    tabIndex={-1}
                                    autoComplete="off"
                                    aria-hidden="true"
                                    style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0, width: 0 }}
                                />
                                <textarea placeholder="Write your review... *" value={text} onChange={e => setText(e.target.value)}
                                    rows={3}
                                    style={{ padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-warm)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.9rem', resize: 'vertical', fontFamily: 'inherit' }} />
                                <div style={{ display: 'flex', gap: 10 }}>
                                    <button className="btn-primary" onClick={submit} disabled={sending || !name.trim() || !text.trim()}
                                        style={{ opacity: sending ? 0.6 : 1 }}>
                                        {sending ? 'Submitting…' : 'Submit Review'}
                                    </button>
                                    <button className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Reviews list */}
                {loading ? (
                    <p style={{ textAlign: 'center', color: 'var(--text-dim)' }}>Loading…</p>
                ) : reviews.length === 0 ? (
                    <p style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '1.1rem', marginTop: 40 }}>
                        No reviews yet. Be the first to share your experience!
                    </p>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
                        {reviews.map(r => (
                            <div className="paper-card" key={r.id} style={{ padding: '24px 28px' }}>
                                <div style={{ color: '#d97706', fontSize: '1.1rem', letterSpacing: 2, marginBottom: 8 }}>
                                    {renderStars(r.stars)}
                                </div>
                                <p style={{ fontSize: '0.95rem', lineHeight: 1.6, margin: '0 0 16px', color: 'var(--text-primary)' }}>
                                    "{r.text}"
                                </p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{
                                        width: 36, height: 36, borderRadius: '50%',
                                        background: 'var(--amber-soft)', color: 'var(--amber)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontWeight: 700, fontSize: '0.9rem',
                                    }}>{r.name.charAt(0).toUpperCase()}</div>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{r.name}</div>
                                        {r.grade && <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{r.grade}</div>}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
            <Footer />
        </>
    );
}
