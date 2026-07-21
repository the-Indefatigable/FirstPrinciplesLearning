import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import './ToolShowcase.css';
import { getBySlug, allTools } from '../config/tools';

// A real, draggable tool mounted live on the landing page.
const UnitCircle = lazy(() => import('../tools/math/UnitCircle'));

// Curated tools shown as living previews in the bento grid.
const FEATURED = [
    'fourier-series',
    'double-pendulum',
    'blackbody-cavity',
    'sorting-visualizer',
    'quantum-wave',
    'pathfinding',
];

export default function ToolShowcase() {
    const featured = FEATURED.map(getBySlug).filter(Boolean) as NonNullable<ReturnType<typeof getBySlug>>[];
    const counts = {
        math: allTools.filter(t => t.category === 'math').length,
        physics: allTools.filter(t => t.category === 'physics').length,
        cs: allTools.filter(t => t.category === 'cs').length,
    };

    return (
        <section className="section showcase" id="tools">
            <div className="showcase-header">
                <div className="section-eyebrow">
                    <span className="eyebrow-num">03</span>
                    <span className="eyebrow-line" />
                    <span>Learn By Seeing</span>
                </div>
                <h2 className="section-title">Don't just read it. <em>Play with it.</em></h2>
                <p className="section-subtitle" style={{ margin: '0 auto' }}>
                    Every session runs on {allTools.length} interactive tools I built from scratch — the same ones
                    powering this page. Drag the point below and watch the math move.
                </p>
            </div>

            <div className="showcase-grid">
                {/* Live, interactive hero tile */}
                <div className="showcase-live">
                    <div className="showcase-live-frame">
                        <Suspense fallback={<div className="showcase-live-loading">Loading live demo…</div>}>
                            <UnitCircle />
                        </Suspense>
                    </div>
                    <div className="showcase-live-caption">
                        <span className="showcase-live-badge">● Live</span>
                        <strong>Unit Circle</strong>
                        <span>Drag the dot — sine, cosine &amp; the angle update in real time.</span>
                        <Link to="/math/unit-circle" className="showcase-live-link">Open full tool →</Link>
                    </div>
                </div>

                {/* Preview tiles */}
                {featured.map(t => (
                    <Link key={t.slug} to={`/${t.category}/${t.slug}`} className="showcase-card">
                        <div className="showcase-card-preview" style={{ background: t.gradient }}>
                            <t.Preview />
                        </div>
                        <div className="showcase-card-body">
                            <span className="showcase-card-tag">{t.tag}</span>
                            <strong>{t.name}</strong>
                        </div>
                    </Link>
                ))}
            </div>

            <div className="showcase-cta">
                <div className="showcase-counts">
                    <Link to="/math"><b>{counts.math}</b> Math</Link>
                    <Link to="/physics"><b>{counts.physics}</b> Physics</Link>
                    <Link to="/cs"><b>{counts.cs}</b> CS</Link>
                </div>
                <Link to="/math" className="btn-primary">Explore all {allTools.length} tools →</Link>
            </div>
        </section>
    );
}
