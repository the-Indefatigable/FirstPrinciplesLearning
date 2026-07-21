import './FinalCTA.css';
import { lazy, Suspense } from 'react';

// Lazy-load the booking widget so Firestore stays out of the initial JS bundle.
const BookingWidget = lazy(() => import('./BookingWidget'));

export default function FinalCTA() {
    return (
        <section className="final-cta" id="booking">
            <div className="final-cta-inner">
                <div className="final-cta-head">
                    <h2>Ready to <em>excel?</em></h2>
                    <p>
                        Book your free consultation below — pick a subject, choose a time
                        that works, and we'll take it from there. No commitment, no pressure.
                    </p>
                </div>
                <Suspense fallback={<div className="final-cta-loading">Loading booking…</div>}>
                    <BookingWidget />
                </Suspense>
            </div>
        </section>
    );
}
