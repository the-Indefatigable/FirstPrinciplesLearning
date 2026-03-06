import { Link } from 'react-router-dom';
import SEOHead from '../components/SEOHead';

export default function NotFound() {
    return (
        <>
            <SEOHead title="404 — Page Not Found | FirstPrinciple" description="The page you're looking for doesn't exist. Explore our free interactive math, physics, and CS tools." />
            <main style={{
                padding: '160px 24px 80px', maxWidth: 520, margin: '0 auto', textAlign: 'center',
            }}>
                <div style={{ fontSize: '4rem', marginBottom: 12 }}>🔍</div>
                <h1 style={{ fontSize: '2rem', marginBottom: 8 }}>Page not found</h1>
                <p style={{ color: 'var(--text-dim)', fontSize: '1.05rem', lineHeight: 1.6, marginBottom: 32 }}>
                    The page you're looking for doesn't exist or has been moved.
                    Try one of these instead:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
                    <Link className="btn-primary" to="/" style={{ minWidth: 200 }}>← Back to Home</Link>
                    <Link className="btn-secondary" to="/math" style={{ minWidth: 200 }}>Math Tools</Link>
                    <Link className="btn-secondary" to="/physics" style={{ minWidth: 200 }}>Physics Simulations</Link>
                    <Link className="btn-secondary" to="/cs" style={{ minWidth: 200 }}>CS Tools</Link>
                    <Link className="btn-secondary" to="/reviews" style={{ minWidth: 200 }}>Reviews</Link>
                </div>
            </main>
        </>
    );
}
