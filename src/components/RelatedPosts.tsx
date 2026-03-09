import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchPublishedPosts, readingTime, type BlogPost } from '../lib/blog';

interface Props {
    currentSlug: string;
    currentTag: string;
}

export default function RelatedPosts({ currentSlug, currentTag }: Props) {
    const [related, setRelated] = useState<BlogPost[]>([]);

    useEffect(() => {
        let mounted = true;
        fetchPublishedPosts().then(posts => {
            if (!mounted) return;
            // Prefer same tag, exclude current post
            const others = posts.filter(p => p.slug !== currentSlug);
            const sameTag = others.filter(p => p.tag === currentTag);
            const picks = sameTag.length >= 2
                ? sameTag.slice(0, 2)
                : [...sameTag, ...others.filter(p => p.tag !== currentTag)].slice(0, 2);
            setRelated(picks);
        });
        return () => { mounted = false; };
    }, [currentSlug, currentTag]);

    if (related.length === 0) return null;

    return (
        <section className="related-posts">
            <h3>Keep reading</h3>
            <div className="related-posts-grid">
                {related.map(post => (
                    <Link key={post.slug} to={`/blog/${post.slug}`} className="post-card">
                        <div className="post-card-meta">
                            <span className="post-card-tag">{post.tag}</span>
                            <span>{readingTime(post.content)}</span>
                        </div>
                        <h4 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.15rem', fontWeight: 400, margin: '0 0 6px' }}>
                            {post.title}
                        </h4>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                            {post.description}
                        </p>
                    </Link>
                ))}
            </div>
        </section>
    );
}
