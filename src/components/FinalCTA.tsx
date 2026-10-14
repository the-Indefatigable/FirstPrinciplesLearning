import './FinalCTA.css';

/**
 * Closing CTA. The booking widget itself now lives in the Hero (above the fold),
 * so this section just sends people back up to it — one `#booking` target only.
 */
export default function FinalCTA() {
    return (
        <section className="final-cta">
            <div className="final-cta-inner">
                <div className="final-cta-head">
                    <h2>Ready to <em>excel?</em></h2>
                    <p>
                        Your free consultation is one click away — pick a subject, choose a time
                        that works, and we'll take it from there. No commitment, no pressure.
                    </p>
                </div>
                <a className="btn-primary final-cta-btn" href="#booking">
                    Book my free consultation →
                </a>
            </div>
        </section>
    );
}
