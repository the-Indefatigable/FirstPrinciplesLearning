import './Testimonials.css';
import { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Link } from 'react-router-dom';

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

/* ── Review Form ──────────────────────────────────────────────────── */
function ReviewForm({ onSubmitted }: { onSubmitted: () => void }) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [grade, setGrade] = useState('');
    const [stars, setStars] = useState(5);
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);

    const submit = async () => {
        if (!name.trim() || !text.trim()) return;
        setSending(true);
        try {
            await addDoc(collection(db, 'reviews'), {
                name: name.trim(),
                grade: grade.trim(),
                stars,
                text: text.trim(),
                createdAt: serverTimestamp(),
            });
            setName(''); setGrade(''); setStars(5); setText('');
            setOpen(false);
            onSubmitted();
        } catch (err) {
            console.error('Failed to submit review:', err);
        } finally {
            setSending(false);
        }
    };

    if (!open) {
        return (
            <button className="btn-primary" onClick={() => setOpen(true)}
                style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                ✍ Leave a Review
            </button>
        );
    }

    return (
        <div className="paper-card" style={{ marginTop: 16, padding: '24px 28px', maxWidth: 520 }}>
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
                <textarea placeholder="Write your review... *" value={text} onChange={e => setText(e.target.value)}
                    rows={3}
                    style={{ padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-warm)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.9rem', resize: 'vertical', fontFamily: 'inherit' }} />
                <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn-primary" onClick={submit} disabled={sending || !name.trim() || !text.trim()}
                        style={{ opacity: sending ? 0.6 : 1 }}>
                        {sending ? 'Submitting…' : 'Submit Review'}
                    </button>
                    <button className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

/* ── Testimonials Section (Homepage) ─────────────────────────────── */
export default function Testimonials() {
    const [reviews, setReviews] = useState<Review[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchReviews = async () => {
        try {
            const q = query(collection(db, 'reviews'), orderBy('stars', 'desc'), limit(3));
            const snap = await getDocs(q);
            setReviews(snap.docs.map(d => ({ id: d.id, ...d.data() } as Review)));
        } catch (err) {
            console.error('Failed to fetch reviews:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchReviews(); }, []);

    const renderStars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);

    return (
        <section className="section" id="testimonials">
            <div className="testimonials-header">
                <div className="section-eyebrow">
                    <span className="eyebrow-num">04</span>
                    <span className="eyebrow-line" />
                    <span>What Students Say</span>
                </div>
                <h2 className="section-title">Real students. <em>Real results.</em></h2>
                <p className="section-subtitle" style={{ margin: '0 auto' }}>
                    Hear from students and parents who've seen the transformation.
                </p>
            </div>

            {loading ? (
                <p style={{ textAlign: 'center', color: 'var(--text-dim)' }}>Loading reviews…</p>
            ) : reviews.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-dim)' }}>No reviews yet — be the first!</p>
            ) : (
                <div className="testimonials-grid">
                    {reviews.map(r => (
                        <div className="paper-card testimonial-card" key={r.id}>
                            <div className="testimonial-stars" style={{ color: '#d97706' }}>{renderStars(r.stars)}</div>
                            <div className="testimonial-quote">"</div>
                            <p className="testimonial-text">{r.text}</p>
                            <div className="testimonial-author">
                                <div className="testimonial-avatar">{r.name.charAt(0).toUpperCase()}</div>
                                <div>
                                    <div className="testimonial-name">{r.name}</div>
                                    {r.grade && <div className="testimonial-role">{r.grade}</div>}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div style={{ textAlign: 'center', marginTop: 24 }}>
                <Link to="/reviews" className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    See All Reviews →
                </Link>
            </div>

            <div style={{ textAlign: 'center' }}>
                <ReviewForm onSubmitted={fetchReviews} />
            </div>
        </section>
    );
}
