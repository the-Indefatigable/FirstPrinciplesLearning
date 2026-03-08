import { useEffect, useState, useRef, useCallback } from 'react';
import { collection, query, orderBy, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { SiteSettings } from '../lib/siteSettings';
import { fetchSettings, saveSettings } from '../lib/siteSettings';
import { fetchAllPosts, savePost, deletePost as deleteBlogPost, slugify, readingTime, type BlogPost } from '../lib/blog';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import SEOHead from '../components/SEOHead';

interface Review { id: string; name: string; grade: string; stars: number; text: string; }

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
        } else setError('Invalid credentials');
    };

    return (
        <>
            <SEOHead title="Admin Login — FirstPrinciple" description="Admin login" />
            <main className="admin-login">
                <div className="admin-login-card">
                    <div className="admin-login-icon">🔒</div>
                    <h1>Admin Login</h1>
                    <p>Enter your credentials to continue.</p>
                    <div className="admin-form-stack">
                        <div className="admin-field">
                            <label>Username</label>
                            <input value={user} onChange={e => setUser(e.target.value)}
                                placeholder="Username" autoFocus
                                onKeyDown={e => e.key === 'Enter' && handleLogin()} />
                        </div>
                        <div className="admin-field">
                            <label>Password</label>
                            <input type="password" value={pass} onChange={e => setPass(e.target.value)}
                                placeholder="Password"
                                onKeyDown={e => e.key === 'Enter' && handleLogin()} />
                        </div>
                        {error && <p className="admin-error">{error}</p>}
                        <button className="admin-btn-primary full" onClick={handleLogin}>Log In</button>
                    </div>
                </div>
            </main>
        </>
    );
}

/* ── Markdown Toolbar ─────────────────────────────────────────────────── */
function MdToolbar({ textareaRef, onChange }: { textareaRef: React.RefObject<HTMLTextAreaElement | null>; onChange: (v: string) => void }) {
    const wrap = (before: string, after: string) => {
        const ta = textareaRef.current;
        if (!ta) return;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const text = ta.value;
        const selected = text.slice(start, end) || 'text';
        const newText = text.slice(0, start) + before + selected + after + text.slice(end);
        onChange(newText);
        setTimeout(() => { ta.focus(); ta.setSelectionRange(start + before.length, start + before.length + selected.length); }, 0);
    };

    const insertLine = (prefix: string) => {
        const ta = textareaRef.current;
        if (!ta) return;
        const start = ta.selectionStart;
        const text = ta.value;
        const lineStart = text.lastIndexOf('\n', start - 1) + 1;
        const newText = text.slice(0, lineStart) + prefix + text.slice(lineStart);
        onChange(newText);
        setTimeout(() => { ta.focus(); ta.setSelectionRange(start + prefix.length, start + prefix.length); }, 0);
    };

    const tools: { label: string; icon: string; action: () => void; shortcut?: string }[] = [
        { label: 'Bold', icon: 'B', action: () => wrap('**', '**'), shortcut: '⌘B' },
        { label: 'Italic', icon: 'I', action: () => wrap('*', '*'), shortcut: '⌘I' },
        { label: 'Code', icon: '<>', action: () => wrap('`', '`') },
        { label: 'Link', icon: '🔗', action: () => wrap('[', '](url)') },
        { label: 'H2', icon: 'H2', action: () => insertLine('## ') },
        { label: 'H3', icon: 'H3', action: () => insertLine('### ') },
        { label: 'Bullet', icon: '•', action: () => insertLine('- ') },
        { label: 'Numbered', icon: '1.', action: () => insertLine('1. ') },
        { label: 'Quote', icon: '❝', action: () => insertLine('> ') },
        { label: 'Code Block', icon: '{ }', action: () => wrap('\n```\n', '\n```\n') },
        { label: 'Image', icon: '🖼', action: () => wrap('![alt](', ')') },
    ];

    return (
        <div className="md-toolbar">
            {tools.map(t => (
                <button key={t.label} onClick={t.action} title={`${t.label}${t.shortcut ? ` (${t.shortcut})` : ''}`}
                    className="md-toolbar-btn">{t.icon}</button>
            ))}
        </div>
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
    const [toast, setToast] = useState('');
    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

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

    const loadSettings = async () => { setLoadingS(true); const s = await fetchSettings(); setSettings(s); setLoadingS(false); };

    const handleSave = async () => {
        setSaving(true);
        try { await saveSettings(settings); showToast('Settings saved ✓'); }
        catch (err) { showToast('Save failed'); console.error(err); }
        setSaving(false);
    };

    /* ── Blog ── */
    const [posts, setPosts] = useState<BlogPost[]>([]);
    const [loadingP, setLoadingP] = useState(true);
    const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
    const [savingPost, setSavingPost] = useState(false);
    const [searchQ, setSearchQ] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const loadPosts = async () => { setLoadingP(true); const p = await fetchAllPosts(); setPosts(p); setLoadingP(false); };

    const newPost = (): BlogPost => ({
        slug: '', title: '', description: '', content: '',
        tag: 'Mathematics', published: false, createdAt: null, updatedAt: null,
    });

    const handleSavePost = async () => {
        if (!editingPost) return;
        if (!editingPost.title.trim()) { showToast('Title is required'); return; }
        if (!editingPost.slug.trim()) { showToast('Slug is required'); return; }
        setSavingPost(true);
        try {
            await savePost(editingPost);
            showToast('Post saved ✓');
            setEditingPost(null);
            loadPosts();
        } catch (err) { showToast('Save failed — check console'); console.error(err); }
        setSavingPost(false);
    };

    const handleDeletePost = async (id: string) => {
        if (!confirm('Delete this post permanently?')) return;
        await deleteBlogPost(id);
        setPosts(prev => prev.filter(p => p.id !== id));
    };

    // Keyboard shortcuts in editor
    const handleEditorKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 's') {
            e.preventDefault();
            handleSavePost();
        }
        if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
            e.preventDefault();
            const ta = e.currentTarget;
            const start = ta.selectionStart;
            const end = ta.selectionEnd;
            const text = ta.value;
            const selected = text.slice(start, end) || 'bold';
            const newText = text.slice(0, start) + '**' + selected + '**' + text.slice(end);
            setEditingPost(p => p ? { ...p, content: newText } : p);
        }
        if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
            e.preventDefault();
            const ta = e.currentTarget;
            const start = ta.selectionStart;
            const end = ta.selectionEnd;
            const text = ta.value;
            const selected = text.slice(start, end) || 'italic';
            const newText = text.slice(0, start) + '*' + selected + '*' + text.slice(end);
            setEditingPost(p => p ? { ...p, content: newText } : p);
        }
        // Tab inserts spaces
        if (e.key === 'Tab') {
            e.preventDefault();
            const ta = e.currentTarget;
            const start = ta.selectionStart;
            const text = ta.value;
            const newText = text.slice(0, start) + '  ' + text.slice(start);
            setEditingPost(p => p ? { ...p, content: newText } : p);
            setTimeout(() => { ta.setSelectionRange(start + 2, start + 2); }, 0);
        }
    }, [editingPost]);

    const logout = () => { sessionStorage.removeItem('fp-admin'); window.location.reload(); };

    useEffect(() => { fetchReviews(); loadSettings(); loadPosts(); }, []);

    const renderStars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);

    const filteredPosts = posts.filter(p =>
        p.title.toLowerCase().includes(searchQ.toLowerCase()) ||
        p.tag.toLowerCase().includes(searchQ.toLowerCase())
    );

    const wordCount = editingPost?.content.trim().split(/\s+/).filter(Boolean).length || 0;

    return (
        <>
            <SEOHead title="Admin — FirstPrinciple" description="Admin dashboard" />
            <style>{adminCSS}</style>
            <main className="admin-shell">
                {/* ── Sidebar ── */}
                <aside className="admin-sidebar">
                    <div className="admin-sidebar-brand">
                        <div className="admin-logo-mark">fp</div>
                        <span>Admin</span>
                    </div>
                    <nav className="admin-sidebar-nav">
                        {([['blog', '✍', 'Blog'], ['reviews', '⭐', 'Reviews'], ['settings', '⚙', 'Settings']] as [Tab, string, string][]).map(([key, icon, label]) => (
                            <button key={key} className={`admin-sidebar-btn ${activeTab === key ? 'active' : ''}`}
                                onClick={() => setActiveTab(key)}>
                                <span className="admin-sidebar-icon">{icon}</span>{label}
                            </button>
                        ))}
                    </nav>
                    <button className="admin-sidebar-logout" onClick={logout}>↩ Log Out</button>
                </aside>

                {/* ── Main area ── */}
                <div className="admin-main">
                    {toast && <div className="admin-toast">{toast}</div>}

                    {/* ═══════════ BLOG TAB ═══════════ */}
                    {activeTab === 'blog' && (
                        <section className="admin-content">
                            {editingPost ? (
                                <div className="admin-editor-shell">
                                    {/* Editor Top Bar */}
                                    <div className="admin-editor-topbar">
                                        <input className="admin-title-input" value={editingPost.title}
                                            onChange={e => {
                                                const title = e.target.value;
                                                setEditingPost(p => p ? { ...p, title, slug: p.id ? p.slug : slugify(title) } : p);
                                            }}
                                            placeholder="Post title…" />
                                        <div className="admin-editor-actions">
                                            <label className="admin-publish-toggle">
                                                <input type="checkbox" checked={editingPost.published}
                                                    onChange={e => setEditingPost(p => p ? { ...p, published: e.target.checked } : p)} />
                                                <span className={`admin-toggle-track ${editingPost.published ? 'on' : ''}`}>
                                                    <span className="admin-toggle-thumb" />
                                                </span>
                                                <span className="admin-toggle-label">{editingPost.published ? 'Published' : 'Draft'}</span>
                                            </label>
                                            <button className="admin-btn-ghost" onClick={() => setEditingPost(null)}>Cancel</button>
                                            <button className="admin-btn-primary" onClick={handleSavePost} disabled={savingPost}>
                                                {savingPost ? 'Saving…' : editingPost.id ? '💾 Update' : '🚀 Publish'}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Meta Fields */}
                                    <div className="admin-meta-row">
                                        <div className="admin-field compact">
                                            <label>Slug</label>
                                            <input value={editingPost.slug}
                                                onChange={e => setEditingPost(p => p ? { ...p, slug: e.target.value } : p)}
                                                placeholder="how-fourier-transforms-work" />
                                        </div>
                                        <div className="admin-field compact">
                                            <label>Tag</label>
                                            <select value={editingPost.tag}
                                                onChange={e => setEditingPost(p => p ? { ...p, tag: e.target.value } : p)}>
                                                <option>Mathematics</option>
                                                <option>Physics</option>
                                                <option>Computer Science</option>
                                            </select>
                                        </div>
                                        <div className="admin-field compact" style={{ flex: 2 }}>
                                            <label>SEO Description</label>
                                            <input value={editingPost.description}
                                                onChange={e => setEditingPost(p => p ? { ...p, description: e.target.value } : p)}
                                                placeholder="A first-principles explanation of…" />
                                        </div>
                                    </div>

                                    {/* Split Pane: Editor + Preview */}
                                    <div className="admin-split-pane">
                                        <div className="admin-pane editor-pane">
                                            <div className="admin-pane-header">
                                                <span>✏️ Editor</span>
                                                <span className="admin-stats">{wordCount} words · {readingTime(editingPost.content)} · ⌘S to save</span>
                                            </div>
                                            <MdToolbar textareaRef={textareaRef}
                                                onChange={v => setEditingPost(p => p ? { ...p, content: v } : p)} />
                                            <textarea ref={textareaRef} className="admin-editor-textarea"
                                                value={editingPost.content}
                                                onChange={e => setEditingPost(p => p ? { ...p, content: e.target.value } : p)}
                                                onKeyDown={handleEditorKeyDown}
                                                placeholder={'## Introduction\n\nWrite your post in markdown…\n\nUse the toolbar above or keyboard shortcuts:\n  ⌘B = Bold\n  ⌘I = Italic\n  ⌘S = Save\n  Tab = Indent'} />
                                        </div>
                                        <div className="admin-pane preview-pane">
                                            <div className="admin-pane-header"><span>👁 Live Preview</span></div>
                                            <div className="admin-preview-body prose">
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                    {editingPost.content || '*Start typing to see the preview…*'}
                                                </ReactMarkdown>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="admin-page-header">
                                        <div>
                                            <h1>Blog Posts</h1>
                                            <p className="admin-subtitle">{posts.length} article{posts.length !== 1 ? 's' : ''} · {posts.filter(p => p.published).length} published</p>
                                        </div>
                                        <button className="admin-btn-primary" onClick={() => setEditingPost(newPost())}>+ New Post</button>
                                    </div>

                                    <input className="admin-search" value={searchQ} onChange={e => setSearchQ(e.target.value)}
                                        placeholder="🔍  Search posts by title or tag…" />

                                    {loadingP ? <div className="admin-loading">Loading…</div> : filteredPosts.length === 0 ? (
                                        <div className="admin-empty">
                                            <span className="admin-empty-icon">📝</span>
                                            <p>{searchQ ? 'No matching posts' : 'No posts yet'}</p>
                                            {!searchQ && <button className="admin-btn-primary" onClick={() => setEditingPost(newPost())}>Write your first article</button>}
                                        </div>
                                    ) : (
                                        <div className="admin-post-list">
                                            {filteredPosts.map(p => (
                                                <div className="admin-post-row" key={p.id}>
                                                    <div className="admin-post-info">
                                                        <div className="admin-post-title-row">
                                                            <strong>{p.title}</strong>
                                                            <span className={`admin-badge ${p.published ? 'published' : 'draft'}`}>
                                                                {p.published ? '● Live' : '○ Draft'}
                                                            </span>
                                                        </div>
                                                        <div className="admin-post-meta">
                                                            <span className="admin-tag-pill">{p.tag}</span>
                                                            <span>/{p.slug}</span>
                                                            <span>·</span>
                                                            <span>{readingTime(p.content)}</span>
                                                        </div>
                                                    </div>
                                                    <div className="admin-post-actions">
                                                        <button className="admin-btn-ghost" onClick={() => setEditingPost(p)}>Edit</button>
                                                        <button className="admin-btn-danger" onClick={() => p.id && handleDeletePost(p.id)}>Delete</button>
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
                        <section className="admin-content">
                            <div className="admin-page-header"><h1>Site Settings</h1></div>
                            <div className="admin-card">
                                {loadingS ? <div className="admin-loading">Loading…</div> : (
                                    <div className="admin-form-stack">
                                        <div className="admin-field">
                                            <label>Booking Link</label>
                                            <input value={settings.bookingLink}
                                                onChange={e => setSettings(s => ({ ...s, bookingLink: e.target.value }))}
                                                placeholder="https://calendly.com/... or mailto:you@email.com" />
                                            <span className="admin-hint">Destination for all "Book" buttons.</span>
                                        </div>
                                        <div className="admin-field">
                                            <label>Hero Badge Text</label>
                                            <input value={settings.heroBadge}
                                                onChange={e => setSettings(s => ({ ...s, heroBadge: e.target.value }))}
                                                placeholder="Now accepting students for 2026" />
                                        </div>
                                        <div className="admin-field">
                                            <label>Hero CTA Button Text</label>
                                            <input value={settings.heroCtaText}
                                                onChange={e => setSettings(s => ({ ...s, heroCtaText: e.target.value }))}
                                                placeholder="Book a Free Consultation →" />
                                        </div>
                                        <button className="admin-btn-primary" onClick={handleSave} disabled={saving}
                                            style={{ alignSelf: 'flex-start' }}>
                                            {saving ? 'Saving…' : '💾 Save Settings'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </section>
                    )}

                    {/* ═══════════ REVIEWS TAB ═══════════ */}
                    {activeTab === 'reviews' && (
                        <section className="admin-content">
                            <div className="admin-page-header">
                                <div>
                                    <h1>Reviews</h1>
                                    <p className="admin-subtitle">{reviews.length} review{reviews.length !== 1 ? 's' : ''}</p>
                                </div>
                            </div>
                            {loadingR ? <div className="admin-loading">Loading…</div> : reviews.length === 0 ? (
                                <div className="admin-empty"><span className="admin-empty-icon">⭐</span><p>No reviews yet.</p></div>
                            ) : (
                                <div className="admin-post-list">
                                    {reviews.map(r => (
                                        <div className="admin-post-row" key={r.id}>
                                            <div className="admin-post-info">
                                                <div className="admin-post-title-row">
                                                    <span style={{ color: '#d97706', letterSpacing: 1.5, fontSize: '0.85rem' }}>{renderStars(r.stars)}</span>
                                                    <strong>{r.name}</strong>
                                                    {r.grade && <span className="admin-post-meta">{r.grade}</span>}
                                                </div>
                                                <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>"{r.text}"</p>
                                            </div>
                                            <button className="admin-btn-danger" onClick={() => removeReview(r.id)}>Delete</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>
                    )}
                </div>
            </main>
        </>
    );
}

/* ── Admin CSS (injected via <style>) ── */
const adminCSS = `
/* ── Shell Layout ── */
.admin-shell {
    display: flex;
    min-height: 100vh;
    padding-top: 64px;
}

.admin-login {
    padding: 140px 24px 60px;
    display: flex;
    justify-content: center;
}

.admin-login-card {
    max-width: 380px;
    width: 100%;
    text-align: center;
}

.admin-login-icon { font-size: 2.5rem; margin-bottom: 8px; }
.admin-login-card h1 { font-size: 1.5rem; margin-bottom: 4px; font-family: var(--font-serif); }
.admin-login-card > p { color: var(--text-dim); margin-bottom: 28px; font-size: 0.9rem; }

/* ── Sidebar ── */
.admin-sidebar {
    width: 220px;
    background: var(--bg-secondary);
    border-right: 1px solid var(--border-warm);
    padding: 20px 12px;
    display: flex;
    flex-direction: column;
    position: fixed;
    top: 64px;
    left: 0;
    bottom: 0;
    z-index: 50;
}

.admin-sidebar-brand {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 700;
    font-size: 1rem;
    padding: 4px 12px 20px;
    border-bottom: 1px solid var(--border-warm);
    margin-bottom: 16px;
}

.admin-logo-mark {
    width: 30px; height: 30px; border-radius: 8px;
    background: linear-gradient(135deg, #d97706, #b45309);
    display: flex; align-items: center; justify-content: center;
    color: white; font-weight: 800; font-size: 0.8rem;
}

.admin-sidebar-nav {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
}

.admin-sidebar-btn {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 14px; border: none; background: none;
    border-radius: var(--radius-sm); cursor: pointer;
    font-size: 0.88rem; font-weight: 500; color: var(--text-secondary);
    font-family: inherit; text-align: left; transition: all 0.15s;
}
.admin-sidebar-btn:hover { background: var(--bg-primary); color: var(--text-primary); }
.admin-sidebar-btn.active {
    background: var(--amber-glow);
    color: var(--amber);
    font-weight: 600;
}
.admin-sidebar-icon { font-size: 1rem; width: 20px; text-align: center; }

.admin-sidebar-logout {
    padding: 10px 14px; border: 1px solid var(--border-warm);
    background: none; border-radius: var(--radius-sm); cursor: pointer;
    font-size: 0.82rem; color: var(--text-dim); font-family: inherit;
    transition: all 0.15s;
}
.admin-sidebar-logout:hover { border-color: #ef4444; color: #ef4444; }

/* ── Main Content ── */
.admin-main {
    flex: 1;
    margin-left: 220px;
    padding: 28px 32px 60px;
    max-width: 1200px;
}

.admin-content { animation: fadeIn 0.2s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

.admin-page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 20px;
}
.admin-page-header h1 {
    font-size: 1.6rem;
    font-family: var(--font-serif);
    margin: 0;
}
.admin-subtitle {
    color: var(--text-dim);
    font-size: 0.82rem;
    margin: 4px 0 0;
}

/* ── Toast ── */
.admin-toast {
    position: fixed; top: 80px; right: 32px; z-index: 999;
    padding: 12px 20px; background: var(--sage); color: #fff;
    border-radius: var(--radius-sm); font-weight: 600; font-size: 0.88rem;
    animation: slideIn 0.25s ease;
    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
}
@keyframes slideIn { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }

/* ── Buttons ── */
.admin-btn-primary {
    padding: 10px 20px; border: none; background: var(--amber);
    color: #fff; border-radius: var(--radius-sm); cursor: pointer;
    font-weight: 600; font-size: 0.85rem; font-family: inherit;
    transition: all 0.15s;
}
.admin-btn-primary:hover { background: var(--amber-light); }
.admin-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.admin-btn-primary.full { width: 100%; }

.admin-btn-ghost {
    padding: 8px 16px; border: 1px solid var(--border-warm);
    background: none; border-radius: var(--radius-sm); cursor: pointer;
    font-size: 0.82rem; font-weight: 600; color: var(--text-secondary);
    font-family: inherit; transition: all 0.15s;
}
.admin-btn-ghost:hover { border-color: var(--amber); color: var(--amber); }

.admin-btn-danger {
    padding: 8px 16px; border: 1px solid var(--border-warm);
    background: none; border-radius: var(--radius-sm); cursor: pointer;
    font-size: 0.82rem; font-weight: 600; color: var(--text-dim);
    font-family: inherit; transition: all 0.15s;
}
.admin-btn-danger:hover { border-color: #ef4444; color: #ef4444; background: rgba(239,68,68,0.05); }

/* ── Fields ── */
.admin-form-stack { display: flex; flex-direction: column; gap: 16px; text-align: left; }
.admin-field label {
    display: block; font-size: 0.78rem; font-weight: 600;
    color: var(--text-dim); margin-bottom: 5px;
    text-transform: uppercase; letter-spacing: 0.5px;
}
.admin-field input, .admin-field select, .admin-field textarea {
    width: 100%; padding: 10px 14px; border-radius: var(--radius-sm);
    border: 1px solid var(--border-warm); background: var(--bg-primary);
    color: var(--text-primary); font-size: 0.9rem; font-family: inherit;
    transition: border-color 0.15s; box-sizing: border-box;
}
.admin-field input:focus, .admin-field select:focus, .admin-field textarea:focus {
    outline: none; border-color: var(--amber);
    box-shadow: 0 0 0 3px var(--amber-glow);
}
.admin-field.compact { flex: 1; }
.admin-hint { font-size: 0.75rem; color: var(--text-dim); margin-top: 4px; display: block; }
.admin-error { color: #ef4444; font-size: 0.85rem; margin: 0; }

/* ── Search ── */
.admin-search {
    width: 100%; padding: 12px 16px; border-radius: var(--radius-sm);
    border: 1px solid var(--border-warm); background: var(--bg-secondary);
    color: var(--text-primary); font-size: 0.9rem; font-family: inherit;
    margin-bottom: 16px; box-sizing: border-box; transition: border-color 0.15s;
}
.admin-search:focus { outline: none; border-color: var(--amber); box-shadow: 0 0 0 3px var(--amber-glow); }

/* ── Post List ── */
.admin-post-list { display: flex; flex-direction: column; gap: 8px; }
.admin-post-row {
    display: flex; align-items: center; gap: 16px;
    padding: 16px 20px; background: var(--bg-card);
    border: 1px solid var(--border-light); border-radius: var(--radius-sm);
    transition: all 0.15s;
}
.admin-post-row:hover { border-color: var(--border-accent); box-shadow: var(--shadow-sm); }
.admin-post-info { flex: 1; min-width: 0; }
.admin-post-title-row { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; flex-wrap: wrap; }
.admin-post-title-row strong { font-size: 0.92rem; }
.admin-post-meta { display: flex; align-items: center; gap: 8px; font-size: 0.78rem; color: var(--text-dim); }
.admin-post-actions { display: flex; gap: 8px; flex-shrink: 0; }

.admin-badge {
    padding: 2px 10px; border-radius: 20px; font-size: 0.68rem;
    font-weight: 700; letter-spacing: 0.3px;
}
.admin-badge.published { background: rgba(107,143,113,0.15); color: var(--sage); }
.admin-badge.draft { background: var(--bg-secondary); color: var(--text-dim); }

.admin-tag-pill {
    background: var(--amber-glow); color: var(--amber);
    padding: 2px 8px; border-radius: 12px; font-size: 0.7rem;
    font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px;
}

/* ── Empty / Loading ── */
.admin-empty { text-align: center; padding: 60px 20px; color: var(--text-dim); }
.admin-empty-icon { font-size: 2.5rem; display: block; margin-bottom: 12px; }
.admin-empty p { margin-bottom: 16px; }
.admin-loading { color: var(--text-dim); padding: 24px; }
.admin-card { background: var(--bg-card); border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 28px 32px; }

/* ── Editor Shell ── */
.admin-editor-shell { display: flex; flex-direction: column; gap: 0; }

.admin-editor-topbar {
    display: flex; align-items: center; gap: 16px;
    padding-bottom: 16px; border-bottom: 1px solid var(--border-light);
    margin-bottom: 12px;
}

.admin-title-input {
    flex: 1; border: none; background: none; font-size: 1.5rem;
    font-family: var(--font-serif); color: var(--text-primary);
    outline: none; font-weight: 400;
}
.admin-title-input::placeholder { color: var(--text-dim); }

.admin-editor-actions { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }

/* ── Publish Toggle ── */
.admin-publish-toggle {
    display: flex; align-items: center; gap: 8px; cursor: pointer;
    font-size: 0.85rem; font-weight: 600;
}
.admin-publish-toggle input { display: none; }
.admin-toggle-track {
    width: 38px; height: 22px; border-radius: 11px;
    background: var(--bg-secondary); border: 1px solid var(--border-warm);
    position: relative; transition: all 0.2s;
}
.admin-toggle-track.on { background: var(--sage); border-color: var(--sage); }
.admin-toggle-thumb {
    width: 16px; height: 16px; border-radius: 50%;
    background: #fff; position: absolute; top: 2px; left: 2px;
    transition: transform 0.2s;
    box-shadow: 0 1px 3px rgba(0,0,0,0.15);
}
.admin-toggle-track.on .admin-toggle-thumb { transform: translateX(16px); }
.admin-toggle-label { color: var(--text-secondary); }

/* ── Meta Row ── */
.admin-meta-row {
    display: flex; gap: 12px; margin-bottom: 12px;
}

/* ── Split Pane ── */
.admin-split-pane {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0;
    border: 1px solid var(--border-warm);
    border-radius: var(--radius-md);
    overflow: hidden;
    min-height: 500px;
}

.admin-pane {
    display: flex;
    flex-direction: column;
}

.editor-pane { border-right: 1px solid var(--border-warm); }

.admin-pane-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 8px 14px; background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-warm);
    font-size: 0.78rem; font-weight: 600; color: var(--text-dim);
}

.admin-stats { font-weight: 400; }

/* ── Markdown Toolbar ── */
.md-toolbar {
    display: flex; flex-wrap: wrap; gap: 2px;
    padding: 6px 10px; background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-light);
}

.md-toolbar-btn {
    width: 32px; height: 30px; border: none; background: none;
    border-radius: 4px; cursor: pointer; font-size: 0.78rem;
    font-weight: 700; color: var(--text-secondary);
    display: flex; align-items: center; justify-content: center;
    font-family: inherit; transition: all 0.1s;
}
.md-toolbar-btn:hover { background: var(--amber-glow); color: var(--amber); }

/* ── Editor Textarea ── */
.admin-editor-textarea {
    flex: 1; border: none; background: var(--bg-primary); resize: none;
    padding: 16px; font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
    font-size: 0.88rem; line-height: 1.7; color: var(--text-primary);
    outline: none; min-height: 400px;
}
.admin-editor-textarea::placeholder { color: var(--text-dim); }

/* ── Preview ── */
.admin-preview-body {
    flex: 1; padding: 20px; overflow-y: auto;
    background: var(--bg-primary);
}

/* ── Responsive ── */
@media (max-width: 900px) {
    .admin-sidebar { width: 60px; padding: 12px 8px; }
    .admin-sidebar-brand span,
    .admin-sidebar-btn span:not(.admin-sidebar-icon),
    .admin-sidebar-logout { font-size: 0; overflow: hidden; width: 40px; text-align: center; }
    .admin-sidebar-btn { justify-content: center; padding: 10px; }
    .admin-sidebar-icon { font-size: 1.2rem; }
    .admin-main { margin-left: 60px; padding: 20px 16px; }
    .admin-split-pane { grid-template-columns: 1fr; }
    .editor-pane { border-right: none; border-bottom: 1px solid var(--border-warm); }
    .admin-meta-row { flex-direction: column; }
    .admin-editor-topbar { flex-direction: column; align-items: stretch; gap: 12px; }
}
`;
