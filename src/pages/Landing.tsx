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
