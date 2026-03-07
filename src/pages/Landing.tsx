import { lazy, Suspense } from 'react';
import SEOHead from '../components/SEOHead';
import Hero from '../components/Hero';
import Philosophy from '../components/Philosophy';
import Subjects from '../components/Subjects';
import HowItWorks from '../components/HowItWorks';
import Pricing from '../components/Pricing';
import FinalCTA from '../components/FinalCTA';
import Footer from '../components/Footer';

// Lazy-load Testimonials to keep Firebase out of the initial JS bundle
const Testimonials = lazy(() => import('../components/Testimonials'));

export default function Landing() {
    return (
        <>
            <SEOHead
                title="FirstPrinciple Tutoring — Math, Physics & CS Tutoring in Canada"
                description="Premium 1-on-1 tutoring in Math, Physics, and Computer Science. First-principles approach that builds deep understanding. $30–$45/hr CAD. Free consultation available."
                canonical="https://www.firstprincipleslearningg.com/"
            />
            <Hero />
            <Philosophy />
            <Subjects />
            <HowItWorks />
            <Suspense fallback={<div style={{ height: 200 }} />}>
                <Testimonials />
            </Suspense>
            <Pricing />
            <FinalCTA />
            <Footer />
        </>
    );
}
