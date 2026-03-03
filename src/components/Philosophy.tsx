import './Philosophy.css';

const pillars = [
    {
        icon: '🧩',
        title: 'First Principles',
        description:
            'I break every concept down to its fundamentals. No memorization, no shortcuts — just deep understanding that sticks and transfers to any problem.',
    },
    {
        icon: '🌱',
        title: 'Patient Guidance',
        description:
            "Everyone learns differently. I adapt my teaching style to how you think, moving at your pace until the lightbulb clicks on.",
    },
    {
        icon: '🏆',
        title: 'Real Results',
        description:
            'From failing grades to top of the class. My students consistently improve because they actually understand the material — not just memorize it.',
    },
];

export default function Philosophy() {
    return (
        <section className="section philosophy" id="approach">
            <div className="philosophy-header">
                <div className="section-eyebrow">
                    <span className="eyebrow-num">01</span>
                    <span className="eyebrow-line" />
                    <span>My Approach</span>
                </div>
                <h2 className="section-title">Teaching that builds <em>thinkers</em>,<br />not memorizers.</h2>
                <p className="section-subtitle" style={{ margin: '0 auto' }}>
                    Most tutors teach you steps to repeat. I teach you how to derive those steps yourself —
                    so you never get stuck again.
                </p>
            </div>

            <div className="philosophy-grid">
                {pillars.map((p, i) => (
                    <div className="paper-card philosophy-card" key={i}>
                        <div className="card-icon">{p.icon}</div>
                        <h3>{p.title}</h3>
                        <p>{p.description}</p>
                    </div>
                ))}
            </div>
        </section>
    );
}
