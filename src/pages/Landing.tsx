import SEOHead from '../components/SEOHead';
import Hero from '../components/Hero';
import Philosophy from '../components/Philosophy';
import Subjects from '../components/Subjects';
import HowItWorks from '../components/HowItWorks';
import Testimonials from '../components/Testimonials';
import Pricing from '../components/Pricing';
import FinalCTA from '../components/FinalCTA';
import Footer from '../components/Footer';

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
            <Testimonials />
            <Pricing />
            <FinalCTA />
            <Footer />
        </>
    );
}
