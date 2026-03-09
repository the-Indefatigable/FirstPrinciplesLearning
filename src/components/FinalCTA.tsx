import './FinalCTA.css';
import { useSettings } from '../hooks/SettingsProvider';
import CalendlyEmbed from './CalendlyEmbed';

export default function FinalCTA() {
    const { bookingLink } = useSettings();

    return (
        <section className="final-cta" id="booking">
            <div className="final-cta-card">
                <h2>Ready to <em>excel?</em></h2>
                <p>
                    Join students who stopped struggling and started understanding.
                    Book a free consultation — no commitment, no pressure.
                </p>
                <a className="btn-cta-light" href={bookingLink}>
                    Book Your Free Session →
                </a>
                <CalendlyEmbed url={bookingLink} />
            </div>
        </section>
    );
}
