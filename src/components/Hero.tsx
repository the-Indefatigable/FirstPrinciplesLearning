import './Hero.css';
import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { useSettings } from '../hooks/SettingsProvider';

// Lazy-load the booking widget so Firestore stays out of the initial JS bundle.
const BookingWidget = lazy(() => import('./BookingWidget'));

export default function Hero() {
    const { heroBadge, heroCtaText } = useSettings();

    return (
        <section className="hero" id="top">
            {/* Organic blob shapes */}
            <div className="hero-blobs">
                <div className="blob blob-1" />
                <div className="blob blob-2" />
                <div className="blob blob-3" />
            </div>

            <div className="hero-grid">
                <div className="hero-content">
                    <div className="hero-badge">
                        <span className="badge-dot" />
                        {heroBadge}
                    </div>

                    <h1 className="hero-title">
                        Where Tough Subjects<br />
                        <em>Click.</em>
                    </h1>

                    <p className="hero-subtitle">
                        First-principles tutoring in Math, Physics, and Computer Science.
                        I don't just teach you the answer — I teach you how to think.
                    </p>

                    <div className="hero-cta-group">
                        <a className="btn-primary" href="#booking">
                            {heroCtaText}
                        </a>
                        <a className="btn-secondary" href="#approach">
                            See My Approach
                        </a>
                        <Link className="btn-secondary" to="/reviews" style={{ background: 'transparent' }}>
                            ✍ Leave a Review
                        </Link>
                    </div>
                </div>

                {/* Booking lives above the fold — no scrolling required. */}
                <div className="hero-booking" id="booking">
                    <div className="hero-booking-head">
                        <h2>Book your <em>free</em> consultation</h2>
                        <p>Pick a subject, choose a time. No commitment, no pressure.</p>
                    </div>
                    <Suspense fallback={<div className="hero-booking-loading">Loading booking…</div>}>
                        <BookingWidget />
                    </Suspense>
                </div>

                <div className="hero-trust">
                    <div className="trust-item">
                        <span className="trust-icon">🎓</span>
                        <span>CS & Physics Honours</span>
                    </div>
                    <div className="trust-item">
                        <span className="trust-icon">⭐</span>
                        <span>5.0 Rating</span>
                    </div>
                    <div className="trust-item">
                        <span className="trust-icon">📈</span>
                        <span>100+ Students</span>
                    </div>
                    <div className="trust-item">
                        <span className="trust-icon">🇨🇦</span>
                        <span>Based in Canada</span>
                    </div>
                </div>
            </div>
        </section>
    );
}
