import { useEffect, useState } from 'react';
import { collection, query, orderBy, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { SiteSettings } from '../lib/siteSettings';
import { fetchSettings, saveSettings } from '../lib/siteSettings';
import { fetchAllPosts, savePost, deletePost as deleteBlogPost, slugify, type BlogPost } from '../lib/blog';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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

type Tab = 'settings' | 'reviews' | 'blog';

function AdminDashboard() {
    const [activeTab, setActiveTab] = useState<Tab>('blog');

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
    const [settings, setSettings] = useState<SiteSettings>({ bookingLink: '', heroBadge: '', heroCtaText: '' });
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

    /* ── Blog ── */
    const [posts, setPosts] = useState<BlogPost[]>([]);
    const [loadingP, setLoadingP] = useState(true);
    const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
    const [previewMode, setPreviewMode] = useState(false);
    const [savingPost, setSavingPost] = useState(false);

    const loadPosts = async () => {
        setLoadingP(true);
        const p = await fetchAllPosts();
        setPosts(p);
        setLoadingP(false);
    };

    const newPost = (): BlogPost => ({
        slug: '', title: '', description: '', content: '',
        tag: 'Mathematics', published: false, createdAt: null, updatedAt: null,
    });

    const handleSavePost = async () => {
        if (!editingPost) return;
        if (!editingPost.title.trim()) { setToast('Title is required'); setTimeout(() => setToast(''), 3000); return; }
        if (!editingPost.slug.trim()) { setToast('Slug is required'); setTimeout(() => setToast(''), 3000); return; }
        setSavingPost(true);
        try {
            await savePost(editingPost);
            setToast('Post saved ✓');
            setTimeout(() => setToast(''), 3000);
            setEditingPost(null);
            loadPosts();
        } catch (err) {
            setToast('Save failed — check console');
            console.error(err);
        }
        setSavingPost(false);
    };

    const handleDeletePost = async (id: string) => {
        if (!confirm('Delete this post permanently?')) return;
        await deleteBlogPost(id);
        setPosts(prev => prev.filter(p => p.id !== id));
    };

    const logout = () => {
        sessionStorage.removeItem('fp-admin');
        window.location.reload();
    };

    useEffect(() => { fetchReviews(); loadSettings(); loadPosts(); }, []);

    const renderStars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);

    const inputStyle: React.CSSProperties = {
        width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border-warm)', background: 'var(--bg-secondary)',
        color: 'var(--text-primary)', fontSize: '0.95rem', fontFamily: 'inherit',
    };

    const tabStyle = (t: Tab): React.CSSProperties => ({
        padding: '8px 20px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
        fontWeight: 600, fontSize: '0.85rem', border: 'none', fontFamily: 'inherit',
        background: activeTab === t ? 'var(--amber)' : 'var(--bg-secondary)',
        color: activeTab === t ? '#fff' : 'var(--text-secondary)',
        transition: 'all 0.2s',
    });

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
                <p style={{ color: 'var(--text-dim)', marginBottom: 24 }}>Manage blog, reviews, and site settings.</p>

                {/* ── Tabs ── */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
                    <button style={tabStyle('blog')} onClick={() => setActiveTab('blog')}>✍ Blog</button>
                    <button style={tabStyle('reviews')} onClick={() => setActiveTab('reviews')}>📝 Reviews</button>
                    <button style={tabStyle('settings')} onClick={() => setActiveTab('settings')}>⚙ Settings</button>
                </div>

                {toast && (
                    <div style={{
                        padding: '10px 18px', background: 'var(--sage)', color: '#fff',
                        borderRadius: 'var(--radius-sm)', marginBottom: 16, fontWeight: 600,
                    }}>{toast}</div>
                )}

                {/* ═══════════ BLOG TAB ═══════════ */}
                {activeTab === 'blog' && (
                    <section>
                        {editingPost ? (
                            <div className="paper-card" style={{ padding: '28px 32px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                    <h2 style={{ fontSize: '1.3rem', margin: 0 }}>
                                        {editingPost.id ? 'Edit Post' : 'New Post'}
                                    </h2>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button onClick={() => setPreviewMode(!previewMode)} style={{
                                            padding: '8px 16px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                                            fontWeight: 600, fontSize: '0.85rem', border: 'none', fontFamily: 'inherit',
                                            background: previewMode ? 'var(--amber)' : 'var(--bg-secondary)',
                                            color: previewMode ? '#fff' : 'var(--text-secondary)',
                                        }}>
                                            {previewMode ? '✏ Edit' : '👁 Preview'}
                                        </button>
                                        <button onClick={() => { setEditingPost(null); setPreviewMode(false); }} style={{
                                            background: 'none', border: '1px solid var(--border-warm)',
                                            borderRadius: 'var(--radius-sm)', padding: '8px 16px', cursor: 'pointer',
                                            fontSize: '0.85rem', color: 'var(--text-dim)', fontFamily: 'inherit',
                                        }}>Cancel</button>
                                    </div>
                                </div>

                                {previewMode ? (
                                    <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', padding: 24, border: '1px solid var(--border-light)' }}>
                                        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', marginBottom: 8 }}>{editingPost.title || 'Untitled'}</h1>
                                        <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: 24 }}>
                                            <span style={{ background: 'var(--amber-glow)', color: 'var(--amber)', padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600, marginRight: 8 }}>{editingPost.tag}</span>
                                            {editingPost.published ? '✅ Published' : '📝 Draft'}
                                        </p>
                                        <div className="prose">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                {editingPost.content || '*No content yet*'}
                                            </ReactMarkdown>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-dim)', marginBottom: 4, fontWeight: 600 }}>Title</label>
                                            <input style={inputStyle} value={editingPost.title}
                                                onChange={e => {
                                                    const title = e.target.value;
                                                    setEditingPost(p => p ? { ...p, title, slug: p.id ? p.slug : slugify(title) } : p);
                                                }}
                                                placeholder="How Fourier Transforms Work" />
                                        </div>
                                        <div style={{ display: 'flex', gap: 16 }}>
                                            <div style={{ flex: 1 }}>
                                                <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-dim)', marginBottom: 4, fontWeight: 600 }}>Slug</label>
                                                <input style={inputStyle} value={editingPost.slug}
                                                    onChange={e => setEditingPost(p => p ? { ...p, slug: e.target.value } : p)}
                                                    placeholder="how-fourier-transforms-work" />
                                            </div>
                                            <div style={{ width: 180 }}>
                                                <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-dim)', marginBottom: 4, fontWeight: 600 }}>Tag</label>
                                                <select style={{ ...inputStyle, cursor: 'pointer' }} value={editingPost.tag}
                                                    onChange={e => setEditingPost(p => p ? { ...p, tag: e.target.value } : p)}>
                                                    <option>Mathematics</option>
                                                    <option>Physics</option>
                                                    <option>Computer Science</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-dim)', marginBottom: 4, fontWeight: 600 }}>Description (SEO)</label>
                                            <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }} value={editingPost.description}
                                                onChange={e => setEditingPost(p => p ? { ...p, description: e.target.value } : p)}
                                                placeholder="A first-principles explanation of..." />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-dim)', marginBottom: 4, fontWeight: 600 }}>
                                                Content (Markdown)
                                            </label>
                                            <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 400, fontFamily: 'monospace', fontSize: '0.88rem', lineHeight: 1.6 }}
                                                value={editingPost.content}
                                                onChange={e => setEditingPost(p => p ? { ...p, content: e.target.value } : p)}
                                                placeholder={'## Introduction\n\nWrite your post in markdown...'} />
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.9rem' }}>
                                                <input type="checkbox" checked={editingPost.published}
                                                    onChange={e => setEditingPost(p => p ? { ...p, published: e.target.checked } : p)}
                                                    style={{ width: 18, height: 18, accentColor: 'var(--amber)' }} />
                                                <span style={{ fontWeight: 600 }}>Published</span>
                                            </label>
                                            <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>
                                                {editingPost.published ? 'Visible on /blog' : 'Saved as draft'}
                                            </span>
                                        </div>
                                        <button className="btn-primary" onClick={handleSavePost} disabled={savingPost}
                                            style={{ alignSelf: 'flex-start', opacity: savingPost ? 0.6 : 1 }}>
                                            {savingPost ? 'Saving…' : editingPost.id ? 'Update Post' : 'Create Post'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                    <h2 style={{ fontSize: '1.3rem', margin: 0 }}>✍ Blog Posts ({posts.length})</h2>
                                    <button className="btn-primary" onClick={() => setEditingPost(newPost())}>
                                        + New Post
                                    </button>
                                </div>
                                {loadingP ? <p style={{ color: 'var(--text-dim)' }}>Loading…</p> : posts.length === 0 ? (
                                    <div className="paper-card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-dim)' }}>
                                        <p style={{ fontSize: '1.2rem', marginBottom: 8 }}>No posts yet</p>
                                        <p>Click "+ New Post" to write your first article.</p>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        {posts.map(p => (
                                            <div className="paper-card" key={p.id} style={{ padding: '16px 20px', display: 'flex', gap: 16, alignItems: 'center' }}>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                                                        <strong style={{ fontSize: '0.95rem' }}>{p.title}</strong>
                                                        <span style={{
                                                            background: p.published ? 'var(--sage)' : 'var(--bg-secondary)',
                                                            color: p.published ? '#fff' : 'var(--text-dim)',
                                                            padding: '2px 8px', borderRadius: 12, fontSize: '0.68rem', fontWeight: 600,
                                                        }}>
                                                            {p.published ? 'PUBLISHED' : 'DRAFT'}
                                                        </span>
                                                    </div>
                                                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-dim)' }}>
                                                        /{p.slug} · {p.tag}
                                                    </p>
                                                </div>
                                                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                                                    <button onClick={() => { setEditingPost(p); setPreviewMode(false); }}
                                                        style={{
                                                            background: 'none', border: '1px solid var(--border-warm)', color: 'var(--text-secondary)',
                                                            borderRadius: 'var(--radius-sm)', padding: '6px 14px', cursor: 'pointer',
                                                            fontSize: '0.8rem', fontWeight: 600, fontFamily: 'inherit',
                                                        }}>Edit</button>
                                                    <button onClick={() => p.id && handleDeletePost(p.id)}
                                                        style={{
                                                            background: 'none', border: '1px solid #ef4444', color: '#ef4444',
                                                            borderRadius: 'var(--radius-sm)', padding: '6px 14px', cursor: 'pointer',
                                                            fontSize: '0.8rem', fontWeight: 600, fontFamily: 'inherit',
                                                        }}>Delete</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </section>
                )}

                {/* ═══════════ SETTINGS TAB ═══════════ */}
                {activeTab === 'settings' && (
                    <section className="paper-card" style={{ padding: '28px 32px' }}>
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
                                        This is the <strong>link destination</strong> for all "Book" buttons.
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
                                </div>
                                <button className="btn-primary" onClick={handleSave} disabled={saving}
                                    style={{ alignSelf: 'flex-start', opacity: saving ? 0.6 : 1 }}>
                                    {saving ? 'Saving…' : 'Save Settings'}
                                </button>
                            </div>
                        )}
                    </section>
                )}

                {/* ═══════════ REVIEWS TAB ═══════════ */}
                {activeTab === 'reviews' && (
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
                )}
            </main>
        </>
    );
}
