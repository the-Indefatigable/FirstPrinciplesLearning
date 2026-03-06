import { useRef, useEffect, useState } from 'react';

export default function WaveSuperposition() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animRef = useRef<number>(0);
    const [freq1, setFreq1] = useState(2);
    const [amp1, setAmp1] = useState(1);
    const [freq2, setFreq2] = useState(3);
    const [amp2, setAmp2] = useState(1);
    const [phase2, setPhase2] = useState(0);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.parentElement?.getBoundingClientRect();
        if (!rect) return;
        const dpr = window.devicePixelRatio;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;

        const W = rect.width, H = rect.height;
        let t = 0;

        const draw = () => {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            ctx.clearRect(0, 0, W, H);

            const sections = 3;
            const sh = H / sections;
            const labels = ['Wave 1', 'Wave 2', 'Superposition'];
            const colors = ['#3b82f6', '#22c55e', '#f59e0b'];

            for (let s = 0; s < sections; s++) {
                const cy = sh * s + sh / 2;

                // Section background
                if (s < 2) {
                    ctx.fillStyle = isDark ? 'rgba(46,42,36,0.3)' : 'rgba(250,248,245,0.5)';
                    ctx.fillRect(0, sh * s, W, sh);
                }

                // Center line
                ctx.strokeStyle = isDark ? '#2e2a24' : '#e8e0d4';
                ctx.lineWidth = 0.8;
                ctx.beginPath();
                ctx.moveTo(0, cy);
                ctx.lineTo(W, cy);
                ctx.stroke();

                // Label
                ctx.font = 'bold 11px Sora, sans-serif';
                ctx.fillStyle = colors[s];
                ctx.textAlign = 'left';
                ctx.fillText(labels[s], 10, sh * s + 18);

                // Wave
                const maxAmp = sh / 2 - 20;
                ctx.strokeStyle = colors[s];
                ctx.lineWidth = 2.5;
                ctx.beginPath();

                for (let px = 0; px <= W; px++) {
                    const x = (px / W) * 4 * Math.PI;
                    let y: number;
                    let normMax: number;
                    if (s === 0) {
                        y = amp1 * Math.sin(freq1 * x - t * 2);
                        normMax = Math.max(amp1, 0.01);          // normalize by own amp
                    } else if (s === 1) {
                        y = amp2 * Math.sin(freq2 * x - t * 2 + phase2 * Math.PI / 180);
                        normMax = Math.max(amp2, 0.01);          // normalize by own amp
                    } else {
                        y = amp1 * Math.sin(freq1 * x - t * 2) + amp2 * Math.sin(freq2 * x - t * 2 + phase2 * Math.PI / 180);
                        normMax = Math.max(amp1 + amp2, 0.01);   // combined max for superposition
                    }

                    const normY = (y / normMax) * maxAmp;
                    px === 0 ? ctx.moveTo(px, cy - normY) : ctx.lineTo(px, cy - normY);
                }
                ctx.stroke();

                // Fill for superposition
                if (s === 2) {
                    ctx.globalAlpha = 0.08;
                    ctx.fillStyle = colors[2];
                    ctx.beginPath();
                    ctx.moveTo(0, cy);
                    const fillMax = Math.max(amp1 + amp2, 0.01);
                    for (let px = 0; px <= W; px++) {
                        const x = (px / W) * 4 * Math.PI;
                        const y = amp1 * Math.sin(freq1 * x - t * 2) + amp2 * Math.sin(freq2 * x - t * 2 + phase2 * Math.PI / 180);
                        const normY = (y / fillMax) * maxAmp;
                        ctx.lineTo(px, cy - normY);
                    }
                    ctx.lineTo(W, cy);
                    ctx.closePath();
                    ctx.fill();
                    ctx.globalAlpha = 1;
                }

                // Divider
                if (s < 2) {
                    ctx.strokeStyle = isDark ? '#3d3530' : '#d4cec6';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(0, sh * (s + 1));
                    ctx.lineTo(W, sh * (s + 1));
                    ctx.stroke();
                }
            }

            t += 0.02;
            animRef.current = requestAnimationFrame(draw);
        };

        draw();
        return () => cancelAnimationFrame(animRef.current);
    }, [freq1, amp1, freq2, amp2, phase2]);

    return (
        <div className="tool-card">
            <div className="tool-card-header">
                <h3>Wave Superposition</h3>
                <span className="subject-topic" style={{ background: 'var(--sage-glow)', color: 'var(--sage)' }}>Waves</span>
            </div>
            <div className="tool-card-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                    <div style={{ padding: 12, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(59,130,246,0.2)' }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#3b82f6', marginBottom: 8 }}>Wave 1</div>
                        <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>Frequency: {freq1}</label>
                        <input type="range" min={0.5} max={8} step={0.5} value={freq1} onChange={e => setFreq1(+e.target.value)}
                            style={{ width: '100%', accentColor: '#3b82f6' }} />
                        <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>Amplitude: {amp1}</label>
                        <input type="range" min={0} max={2} step={0.1} value={amp1} onChange={e => setAmp1(+e.target.value)}
                            style={{ width: '100%', accentColor: '#3b82f6' }} />
                    </div>
                    <div style={{ padding: 12, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(34,197,94,0.2)' }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#22c55e', marginBottom: 8 }}>Wave 2</div>
                        <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>Frequency: {freq2}</label>
                        <input type="range" min={0.5} max={8} step={0.5} value={freq2} onChange={e => setFreq2(+e.target.value)}
                            style={{ width: '100%', accentColor: '#22c55e' }} />
                        <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>Amplitude: {amp2}</label>
                        <input type="range" min={0} max={2} step={0.1} value={amp2} onChange={e => setAmp2(+e.target.value)}
                            style={{ width: '100%', accentColor: '#22c55e' }} />
                        <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>Phase Offset: {phase2}°</label>
                        <input type="range" min={0} max={360} value={phase2} onChange={e => setPhase2(+e.target.value)}
                            style={{ width: '100%', accentColor: '#22c55e' }} />
                    </div>
                </div>

                <div style={{ width: '100%', aspectRatio: '16/9', background: 'var(--bg-primary)', border: '1px solid var(--border-warm)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                    <canvas ref={canvasRef} style={{ display: 'block' }} />
                </div>
            </div>
        </div>
    );
}
