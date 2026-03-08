import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchPublishedPosts, readingTime, type BlogPost } from '../lib/blog';
import SEOHead from '../components/SEOHead';
import './Blog.css';

export default function Blog() {
    const [posts, setPosts] = useState<BlogPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let mounted = true;
        fetchPublishedPosts()
            .then(p => { if (mounted) setPosts(p); })
            .catch(() => { if (mounted) setError('Failed to load articles. Please try again.'); })
            .finally(() => { if (mounted) setLoading(false); });
        return () => { mounted = false; };
    }, []);

    const formatDate = (ts: { toDate?: () => Date } | Date | number | null) => {
        if (!ts) return '';
        const d = ts instanceof Date ? ts : (typeof ts === 'object' && 'toDate' in ts && ts.toDate) ? ts.toDate() : new Date(ts as number);
        return d.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
    };

    return (
        <>
            <SEOHead
                title="Blog — STEM Tutorials & Guides | FirstPrinciple"
                description="Deep-dive tutorials on Math, Physics, and Computer Science. First-principles explanations with free interactive tools."
            />
            <main className="blog-container">
                <section className="blog-hero">
                    <div className="blog-hero-eyebrow">
                        <span className="line" />
                        <span>The FirstPrinciple Blog</span>
                        <span className="line" />
                    </div>
                    <h1>STEM, explained from <em>scratch.</em></h1>
                    <p>
                        First-principles tutorials on math, physics, and computer science —
                        paired with free interactive tools.
                    </p>
                </section>

                {loading ? (
                    <p style={{ textAlign: 'center', color: 'var(--text-dim)' }}>Loading articles…</p>
                ) : error ? (
                    <div className="blog-empty">
                        <p>{error}</p>
                    </div>
                ) : posts.length === 0 ? (
                    <div className="blog-empty">
                        <p>No articles yet. Check back soon!</p>
                    </div>
                ) : (
                    <div className="post-grid">
                        {posts.map(post => (
                            <Link key={post.slug} to={`/blog/${post.slug}`} className="post-card">
                                <div className="post-card-meta">
                                    <span className="post-card-tag">{post.tag}</span>
                                    <span>{formatDate(post.createdAt)}</span>
                                    <span>·</span>
                                    <span>{readingTime(post.content)}</span>
                                </div>
                                <h2>{post.title}</h2>
                                <p>{post.description}</p>
                                <span className="post-card-read">Read article →</span>
                            </Link>
                        ))}
                    </div>
                )}
            </main>
        </>
    );
}
