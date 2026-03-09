import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { fetchPostBySlug, readingTime, type BlogPost } from '../lib/blog';
import SEOHead from '../components/SEOHead';
import RelatedPosts from '../components/RelatedPosts';
import './Blog.css';

export default function BlogPostPage() {
    const { slug } = useParams<{ slug: string }>();
    const [post, setPost] = useState<BlogPost | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!slug) return;
        let mounted = true;
        fetchPostBySlug(slug)
            .then(p => { if (mounted) setPost(p); })
            .catch(() => { if (mounted) setError(true); })
            .finally(() => { if (mounted) setLoading(false); });
        return () => { mounted = false; };
    }, [slug]);

    const formatDate = (ts: { toDate?: () => Date } | Date | number | null) => {
        if (!ts) return '';
        const d = ts instanceof Date ? ts : (typeof ts === 'object' && 'toDate' in ts && ts.toDate) ? ts.toDate() : new Date(ts as number);
        return d.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
    };

    if (loading) {
        return (
            <main className="blog-container">
                <p style={{ textAlign: 'center', color: 'var(--text-dim)', paddingTop: 40 }}>Loading…</p>
            </main>
        );
    }

    if (error || !post) {
        return (
            <main className="blog-container">
                <div className="blog-empty">
                    <h1 style={{ fontFamily: 'var(--font-serif)', marginBottom: 16 }}>
                        {error ? 'Failed to load post' : 'Post not found'}
                    </h1>
                    <Link to="/blog" style={{ color: 'var(--amber)' }}>← Back to blog</Link>
                </div>
            </main>
        );
    }

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: post.title,
        description: post.description,
        datePublished: post.createdAt?.toDate?.()?.toISOString() || '',
        dateModified: post.updatedAt?.toDate?.()?.toISOString() || '',
        author: { '@type': 'Organization', name: 'FirstPrinciple Tutoring', url: 'https://www.firstprincipleslearningg.com' },
        publisher: { '@type': 'Organization', name: 'FirstPrinciple Tutoring' },
        mainEntityOfPage: `https://www.firstprincipleslearningg.com/blog/${post.slug}`,
    };

    return (
        <>
            <SEOHead title={`${post.title} | FirstPrinciple Blog`} description={post.description} />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

            <main className="blog-container">
                <article>
                    <header className="post-header">
                        <Link to="/blog" className="post-header-back">← Back to all posts</Link>
                        <h1>{post.title}</h1>
                        <div className="post-header-meta">
                            <span className="post-card-tag">{post.tag}</span>
                            <span>{formatDate(post.createdAt)}</span>
                            <span>·</span>
                            <span>{readingTime(post.content)}</span>
                        </div>
                    </header>

                    <div className="prose">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {post.content}
                        </ReactMarkdown>
                    </div>

                    <div className="post-cta" style={{ marginTop: 56 }}>
                        <h3>Need help understanding {post.tag.toLowerCase()}?</h3>
                        <p>Book a free 30-minute consultation with a FirstPrinciple tutor.</p>
                        <a href="https://www.firstprincipleslearningg.com" className="cta-btn">
                            Book Free Consultation →
                        </a>
                    </div>

                    <RelatedPosts currentSlug={post.slug} currentTag={post.tag} />
                </article>
            </main>
        </>
    );
}
