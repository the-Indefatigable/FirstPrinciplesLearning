import './HowItWorks.css';

const steps = [
    {
        num: 1,
        title: 'Book a Free Call',
        description: "Tell me what you're struggling with. We'll find the gaps and build a plan — no commitment.",
    },
    {
        num: 2,
        title: 'Learn From Scratch',
        description: "We rebuild your understanding from the ground up using first principles. No band-aids.",
    },
    {
        num: 3,
        title: 'See the Results',
        description: 'Watch your grades climb as you build the confidence to tackle any problem alone.',
    },
];

export default function HowItWorks() {
    return (
        <section className="section how-section" id="how-it-works">
            <div className="how-header">
                <div className="section-eyebrow">
                    <span className="eyebrow-num">03</span>
                    <span className="eyebrow-line" />
                    <span>How It Works</span>
                </div>
                <h2 className="section-title">Three steps to <em>clarity.</em></h2>
            </div>

            <div className="how-grid">
                {steps.map((s, i) => (
                    <>
                        <div className="paper-card how-step" key={s.num}>
                            <div className="step-num">{s.num}</div>
                            <h3>{s.title}</h3>
                            <p>{s.description}</p>
                        </div>
                        {i < steps.length - 1 && (
                            <div className="how-connector" key={`c-${i}`}>
                                <div className="connector-line" />
                            </div>
                        )}
                    </>
                ))}
            </div>
        </section>
    );
}
