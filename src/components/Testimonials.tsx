import './Testimonials.css';

const testimonials = [
    {
        name: 'Sarah M.',
        role: 'Grade 12 Student — Calculus',
        initial: 'S',
        text: 'I went from a 62 to a 94 in calculus. He didn\'t just help me pass — he made me actually enjoy math. The first-principles approach completely changed how I think.',
    },
    {
        name: 'David K.',
        role: 'Parent — Physics & Math',
        initial: 'D',
        text: 'My son was ready to give up on physics. After just a few sessions, he started coming home excited about what he\'d learned. His confidence has skyrocketed.',
    },
    {
        name: 'Priya R.',
        role: 'University Student — CS',
        initial: 'P',
        text: 'Finally someone who teaches you WHY things work instead of just memorizing syntax. My data structures grade went up two letter grades.',
    },
];

export default function Testimonials() {
    return (
        <section className="section" id="testimonials">
            <div className="testimonials-header">
                <div className="section-eyebrow">
                    <span className="eyebrow-num">04</span>
                    <span className="eyebrow-line" />
                    <span>What Students Say</span>
                </div>
                <h2 className="section-title">Real students. <em>Real results.</em></h2>
                <p className="section-subtitle" style={{ margin: '0 auto' }}>
                    Don't take my word for it — hear from students and parents who've seen the transformation.
                </p>
            </div>

            <div className="testimonials-grid">
                {testimonials.map((t, i) => (
                    <div className="paper-card testimonial-card" key={i}>
                        <div className="testimonial-stars">★★★★★</div>
                        <div className="testimonial-quote">"</div>
                        <p className="testimonial-text">{t.text}</p>
                        <div className="testimonial-author">
                            <div className="testimonial-avatar">{t.initial}</div>
                            <div>
                                <div className="testimonial-name">{t.name}</div>
                                <div className="testimonial-role">{t.role}</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
