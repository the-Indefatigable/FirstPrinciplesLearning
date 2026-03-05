import { useEffect, useState } from 'react';
import { collection, query, orderBy, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { SiteSettings } from '../lib/siteSettings';
import { fetchSettings, saveSettings } from '../lib/siteSettings';
import SEOHead from '../components/SEOHead';

interface Review {
    id: string;
    name: string;
    grade: string;
    stars: number;
    text: string;
}

/* ── Login Gate ───────────────────────────────────────────────────────── */
const ADMIN_USER = 'alam';
const ADMIN_PASS = 'alam@5621';

function LoginGate({ onAuth }: { onAuth: () => void }) {
    const [user, setUser] = useState('');
    const [pass, setPass] = useState('');
    const [error, setError] = useState('');

    const handleLogin = () => {
        if (user === ADMIN_USER && pass === ADMIN_PASS) {
            sessionStorage.setItem('fp-admin', '1');
            onAuth();
        } else {
            setError('Invalid credentials');
        }
    };

    const inputStyle: React.CSSProperties = {
        width: '100%', padding: '12px 16px', borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border-warm)', background: 'var(--bg-secondary)',
        color: 'var(--text-primary)', fontSize: '0.95rem', fontFamily: 'inherit',
        boxSizing: 'border-box',
    };

    return (
        <>
            <SEOHead title="Admin Login — FirstPrinciple" description="Admin login" />
            <main style={{ padding: '140px 24px 60px', maxWidth: 380, margin: '0 auto', textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🔒</div>
                <h1 style={{ fontSize: '1.5rem', marginBottom: 4 }}>Admin Login</h1>
                <p style={{ color: 'var(--text-dim)', marginBottom: 28, fontSize: '0.9rem' }}>Enter your credentials to continue.</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-dim)', marginBottom: 4, fontWeight: 600 }}>Username</label>
                        <input style={inputStyle} value={user} onChange={e => setUser(e.target.value)}
                            placeholder="Username" autoFocus
                            onKeyDown={e => e.key === 'Enter' && handleLogin()} />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-dim)', marginBottom: 4, fontWeight: 600 }}>Password</label>
                        <input style={inputStyle} type="password" value={pass} onChange={e => setPass(e.target.value)}
                            placeholder="Password"
                            onKeyDown={e => e.key === 'Enter' && handleLogin()} />
                    </div>
                    {error && <p style={{ color: '#ef4444', fontSize: '0.85rem', margin: 0 }}>{error}</p>}
                    <button className="btn-primary" onClick={handleLogin} style={{ width: '100%', marginTop: 4 }}>
                        Log In
                    </button>
                </div>
            </main>
        </>
    );
}

/* ── Admin Dashboard ──────────────────────────────────────────────────── */
export default function Admin() {
    const [authed, setAuthed] = useState(() => sessionStorage.getItem('fp-admin') === '1');

    if (!authed) return <LoginGate onAuth={() => setAuthed(true)} />;

    return <AdminDashboard />;
}

function AdminDashboard() {
    /* ── Reviews ── */
    const [reviews, setReviews] = useState<Review[]>([]);
    const [loadingR, setLoadingR] = useState(true);

    const fetchReviews = async () => {
        setLoadingR(true);
        const q = query(collection(db, 'reviews'), orderBy('stars', 'desc'));
        const snap = await getDocs(q);
        setReviews(snap.docs.map(d => ({ id: d.id, ...d.data() } as Review)));
        setLoadingR(false);
    };

    const removeReview = async (id: string) => {
        if (!confirm('Delete this review permanently?')) return;
        await deleteDoc(doc(db, 'reviews', id));
        setReviews(prev => prev.filter(r => r.id !== id));
    };

    /* ── Settings ── */
    const [settings, setSettings] = useState<SiteSettings>({
        bookingLink: '',
        heroBadge: '',
        heroCtaText: '',
    });
    const [loadingS, setLoadingS] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState('');

    const loadSettings = async () => {
        setLoadingS(true);
        const s = await fetchSettings();
        setSettings(s);
        setLoadingS(false);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await saveSettings(settings);
            setToast('Settings saved ✓');
            setTimeout(() => setToast(''), 3000);
        } catch (err) {
            setToast('Save failed — check console');
            console.error(err);
        }
        setSaving(false);
    };

    const logout = () => {
        sessionStorage.removeItem('fp-admin');
        window.location.reload();
    };

    useEffect(() => { fetchReviews(); loadSettings(); }, []);

    const renderStars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);

    const inputStyle: React.CSSProperties = {
        width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border-warm)', background: 'var(--bg-secondary)',
        color: 'var(--text-primary)', fontSize: '0.95rem', fontFamily: 'inherit',
    };

    return (
        <>
            <SEOHead title="Admin — FirstPrinciple" description="Admin dashboard" />
            <main style={{ padding: '100px 24px 60px', maxWidth: 900, margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <h1 style={{ fontSize: '2rem', margin: 0 }}>Admin Dashboard</h1>
                    <button onClick={logout} style={{
                        background: 'none', border: '1px solid var(--border-warm)', borderRadius: 'var(--radius-sm)',
                        padding: '6px 14px', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '0.82rem',
                    }}>Log Out</button>
                </div>
                <p style={{ color: 'var(--text-dim)', marginBottom: 32 }}>Manage reviews and site settings.</p>

                {toast && (
                    <div style={{
                        padding: '10px 18px', background: 'var(--sage)', color: '#fff',
                        borderRadius: 'var(--radius-sm)', marginBottom: 16, fontWeight: 600,
                    }}>{toast}</div>
                )}

                {/* ── Site Settings ── */}
                <section className="paper-card" style={{ padding: '28px 32px', marginBottom: 32 }}>
                    <h2 style={{ fontSize: '1.3rem', marginBottom: 16 }}>⚙ Site Settings</h2>
                    {loadingS ? <p style={{ color: 'var(--text-dim)' }}>Loading…</p> : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-dim)', marginBottom: 4, fontWeight: 600 }}>
                                    Booking Link (URL or mailto:)
                                </label>
                                <input style={inputStyle} value={settings.bookingLink}
                                    onChange={e => setSettings(s => ({ ...s, bookingLink: e.target.value }))}
                                    placeholder="https://calendly.com/... or mailto:you@email.com" />
                                <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', margin: '4px 0 0' }}>
                                    This is the <strong>link destination</strong> for all "Book" buttons. Use a full URL (https://...) or mailto: link.
                                </p>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-dim)', marginBottom: 4, fontWeight: 600 }}>
                                    Hero Badge Text
                                </label>
                                <input style={inputStyle} value={settings.heroBadge}
                                    onChange={e => setSettings(s => ({ ...s, heroBadge: e.target.value }))}
                                    placeholder="Now accepting students for 2026" />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-dim)', marginBottom: 4, fontWeight: 600 }}>
                                    Hero CTA Button Text
                                </label>
                                <input style={inputStyle} value={settings.heroCtaText}
                                    onChange={e => setSettings(s => ({ ...s, heroCtaText: e.target.value }))}
                                    placeholder="Book a Free Consultation →" />
                                <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', margin: '4px 0 0' }}>
                                    This is the <strong>text on the button</strong>, not the link. E.g. "Book a Free Consultation →"
                                </p>
                            </div>
                            <button className="btn-primary" onClick={handleSave} disabled={saving}
                                style={{ alignSelf: 'flex-start', opacity: saving ? 0.6 : 1 }}>
                                {saving ? 'Saving…' : 'Save Settings'}
                            </button>
                        </div>
                    )}
                </section>

                {/* ── Reviews Management ── */}
                <section>
                    <h2 style={{ fontSize: '1.3rem', marginBottom: 16 }}>📝 Reviews ({reviews.length})</h2>
                    {loadingR ? <p style={{ color: 'var(--text-dim)' }}>Loading…</p> : reviews.length === 0 ? (
                        <p style={{ color: 'var(--text-dim)' }}>No reviews yet.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {reviews.map(r => (
                                <div className="paper-card" key={r.id} style={{
                                    padding: '16px 20px', display: 'flex', gap: 16, alignItems: 'flex-start',
                                }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                                            <span style={{ color: '#d97706', letterSpacing: 1.5, fontSize: '0.9rem' }}>
                                                {renderStars(r.stars)}
                                            </span>
                                            <strong style={{ fontSize: '0.9rem' }}>{r.name}</strong>
                                            {r.grade && <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>— {r.grade}</span>}
                                        </div>
                                        <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.5, color: 'var(--text-primary)' }}>
                                            "{r.text}"
                                        </p>
                                    </div>
                                    <button onClick={() => removeReview(r.id)}
                                        style={{
                                            background: 'none', border: '1px solid #ef4444', color: '#ef4444',
                                            borderRadius: 'var(--radius-sm)', padding: '6px 14px', cursor: 'pointer',
                                            fontSize: '0.8rem', fontWeight: 600, flexShrink: 0,
                                            transition: 'all 0.15s',
                                        }}
                                        onMouseEnter={e => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff'; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#ef4444'; }}
                                    >
                                        Delete
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </main>
        </>
    );
}
