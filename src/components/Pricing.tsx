import './Pricing.css';
import { useSettings } from '../hooks/SettingsProvider';

export default function Pricing() {
    const { bookingLink } = useSettings();

    return (
        <section className="section pricing-section" id="pricing">
            <div className="pricing-header">
                <div className="section-eyebrow">
                    <span className="eyebrow-num">05</span>
                    <span className="eyebrow-line" />
                    <span>Pricing</span>
                </div>
                <h2 className="section-title">Simple, <em>transparent</em> pricing.</h2>
                <p className="section-subtitle" style={{ margin: '0 auto' }}>
                    No hidden fees, no contracts. Start with a free consultation — pay only when you're ready.
                </p>
            </div>

            <div className="pricing-grid">
                {/* Free Consultation */}
                <div className="paper-card pricing-card">
                    <div className="pricing-tier">Get Started</div>
                    <div className="pricing-amount">
                        <span className="price">$0</span>
                    </div>
                    <div className="pricing-note">Free consultation — no obligation</div>
                    <ul className="pricing-features">
                        {[
                            '30-minute introductory call',
                            'Assess current skill level',
                            'Identify knowledge gaps',
                            'Custom learning plan',
                            'No commitment required',
                        ].map((f, i) => (
                            <li key={i}>
                                <span className="check">✓</span> {f}
                            </li>
                        ))}
                    </ul>
                    <a className="btn-secondary" href={bookingLink}>Book Free Call</a>
                </div>

                {/* Regular Sessions */}
                <div className="paper-card pricing-card pricing-card--featured">
                    <div className="pricing-badge">Most Popular</div>
                    <div className="pricing-tier">Regular Sessions</div>
                    <div className="pricing-amount">
                        <span className="price">$30 – $45</span>
                        <span className="period">/ hour CAD</span>
                    </div>
                    <div className="pricing-note">Flexible scheduling, cancel anytime</div>
                    <ul className="pricing-features">
                        {[
                            '1-on-1 personalized sessions',
                            'Math, Physics, or CS',
                            'First-principles methodology',
                            'Session notes & resources',
                            'WhatsApp support between sessions',
                            'Progress tracking & reports',
                            'Exam prep & homework help',
                            'Everything from free tier',
                        ].map((f, i) => (
                            <li key={i}>
                                <span className="check">✓</span> {f}
                            </li>
                        ))}
                    </ul>
                    <a className="btn-primary" href={bookingLink}>Start Learning →</a>
                </div>
            </div>
        </section>
    );
}
