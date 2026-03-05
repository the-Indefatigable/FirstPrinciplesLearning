import './Hero.css';
import { Link } from 'react-router-dom';
import { useSettings } from '../hooks/SettingsProvider';

export default function Hero() {
    const { bookingLink, heroBadge, heroCtaText } = useSettings();

    return (
        <section className="hero" id="top">
            {/* Organic blob shapes */}
            <div className="hero-blobs">
                <div className="blob blob-1" />
                <div className="blob blob-2" />
                <div className="blob blob-3" />
            </div>

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
                    <a className="btn-primary" href={bookingLink}>
                        {heroCtaText}
                    </a>
                    <a className="btn-secondary" href="#approach">
                        See My Approach
                    </a>
                    <Link className="btn-secondary" to="/reviews" style={{ background: 'transparent' }}>
                        ✍ Leave a Review
                    </Link>
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
