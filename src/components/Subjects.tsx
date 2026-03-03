import './Subjects.css';

const subjects = [
    {
        id: 'math',
        icon: '∫',
        title: 'Mathematics',
        description: 'From algebra to calculus, I make abstract math feel intuitive. Build rock-solid foundations that prepare you for any exam.',
        topics: ['Algebra', 'Calculus', 'Linear Algebra', 'Statistics', 'Discrete Math'],
        className: 'subject-card--math',
    },
    {
        id: 'physics',
        icon: 'λ',
        title: 'Physics',
        description: 'Classical mechanics to electromagnetism. Learn to see the world through equations and understand why things move the way they do.',
        topics: ['Mechanics', 'Electromagnetism', 'Waves & Optics', 'Thermodynamics', 'Circuits'],
        className: 'subject-card--physics',
    },
    {
        id: 'cs',
        icon: '{ }',
        title: 'Computer Science',
        description: 'Algorithms, data structures, and programming fundamentals. Write code that works, and understand why it works.',
        topics: ['Python', 'Java', 'Data Structures', 'Algorithms', 'OOP'],
        className: 'subject-card--cs',
    },
];

export default function Subjects() {
    return (
        <section className="section" id="subjects">
            <div className="subjects-header">
                <div className="section-eyebrow">
                    <span className="eyebrow-num">02</span>
                    <span className="eyebrow-line" />
                    <span>What I Teach</span>
                </div>
                <h2 className="section-title">Three pillars. One goal.<br /><em>Your success.</em></h2>
            </div>

            <div className="subjects-grid">
                {subjects.map((s) => (
                    <div className={`paper-card subject-card ${s.className}`} key={s.id}>
                        <div className="card-accent" />
                        <div className="subject-icon">{s.icon}</div>
                        <h3>{s.title}</h3>
                        <p>{s.description}</p>
                        <div className="subject-topics">
                            {s.topics.map((t) => (
                                <span className="subject-topic" key={t}>{t}</span>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
