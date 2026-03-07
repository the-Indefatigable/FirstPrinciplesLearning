import { useRef, useEffect, useState, useCallback } from 'react';

type Sim = 'pi' | 'integral' | 'buffon';

export default function MonteCarloSim() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animRef = useRef<number>(0);
    const pointsRef = useRef<{ x: number; y: number; inside: boolean }[]>([]);

    const [sim, setSim] = useState<Sim>('pi');
    const [totalPoints, setTotalPoints] = useState(0);
    const [estimate, setEstimate] = useState('—');
    const [running, setRunning] = useState(false);
    const [speed, setSpeed] = useState(10);
    const runRef = useRef(false);

    const clear = useCallback(() => {
        pointsRef.current = [];
        setTotalPoints(0);
        setEstimate('—');
        runRef.current = false;
        setRunning(false);
    }, []);

    const start = useCallback(() => {
        clear();
        runRef.current = true;
        setRunning(true);
    }, [clear]);

    const stop = useCallback(() => {
        runRef.current = false;
        setRunning(false);
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const resize = () => {
            const rect = canvas.parentElement?.getBoundingClientRect();
            if (!rect) return;
            const dpr = window.devicePixelRatio;
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            ctx.scale(dpr, dpr);
            canvas.style.width = `${rect.width}px`;
            canvas.style.height = `${rect.height}px`;
        };
        resize();

        const draw = () => {
            const rect = canvas.parentElement?.getBoundingClientRect();
            if (!rect) { animRef.current = requestAnimationFrame(draw); return; }
            const W = rect.width, H = rect.height;
            const S = Math.min(W, H);
            const ox = (W - S) / 2, oy = (H - S) / 2;
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

            ctx.clearRect(0, 0, W, H);

            // Background
            ctx.fillStyle = isDark ? 'rgba(26,22,18,0.3)' : 'rgba(250,248,245,0.5)';
            ctx.fillRect(ox, oy, S, S);
            ctx.strokeStyle = isDark ? '#3d3530' : '#d4cec6';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(ox, oy, S, S);

            // Target shape
            ctx.lineWidth = 2;
            if (sim === 'pi') {
                // Quarter circle
                ctx.strokeStyle = isDark ? '#4ade8060' : '#22c55e60';
                ctx.fillStyle = isDark ? 'rgba(34,197,94,0.08)' : 'rgba(34,197,94,0.06)';
                ctx.beginPath();
                ctx.arc(ox, oy + S, S, -Math.PI / 2, 0);
                ctx.lineTo(ox, oy + S);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            } else if (sim === 'integral') {
                // f(x) = x^2 area
                ctx.strokeStyle = isDark ? '#60a5fa60' : '#3b82f660';
                ctx.fillStyle = isDark ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.06)';
                ctx.beginPath();
                ctx.moveTo(ox, oy + S);
                for (let px = 0; px <= S; px++) {
                    const x = px / S;
                    const y = x * x;
                    ctx.lineTo(ox + px, oy + S - y * S);
                }
                ctx.lineTo(ox + S, oy + S);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            } else {
                // Buffon's needle — draw parallel lines
                const gap = S / 6;
                ctx.strokeStyle = isDark ? '#9c948860' : '#d4cec680';
                ctx.lineWidth = 1;
                for (let li = gap; li < S; li += gap) {
                    ctx.beginPath();
                    ctx.moveTo(ox, oy + li);
                    ctx.lineTo(ox + S, oy + li);
                    ctx.stroke();
                }
            }

            // Draw points / needles
            if (sim === 'buffon') {
                for (const pt of pointsRef.current) {
                    const cx = ox + pt.x * S;
                    const cy = oy + pt.y * S;
                    ctx.strokeStyle = pt.inside ? '#ef4444' : '#22c55e80';
                    ctx.lineWidth = 1.5;
                    const angle = Math.random() * Math.PI;
                    const halfLen = (S / 6) / 2 * 0.5;
                    ctx.beginPath();
                    ctx.moveTo(cx - Math.cos(angle) * halfLen, cy - Math.sin(angle) * halfLen);
                    ctx.lineTo(cx + Math.cos(angle) * halfLen, cy + Math.sin(angle) * halfLen);
                    ctx.stroke();
                }
            } else {
                for (const pt of pointsRef.current) {
                    ctx.beginPath();
                    ctx.arc(ox + pt.x * S, oy + pt.y * S, 1.5, 0, Math.PI * 2);
                    ctx.fillStyle = pt.inside
                        ? (isDark ? '#4ade80' : '#22c55e')
                        : (isDark ? '#f8717180' : '#ef444480');
                    ctx.fill();
                }
            }

            // Add new points
            if (runRef.current) {
                for (let i = 0; i < speed; i++) {
                    const x = Math.random();
                    const y = Math.random();
                    let inside = false;

                    if (sim === 'pi') {
                        inside = x * x + (1 - y) * (1 - y) <= 1;
                    } else if (sim === 'integral') {
                        inside = (1 - y) <= x * x;
                    } else {
                        // Buffon: needle crosses a line
                        const gap = 1 / 6;
                        const angle = Math.random() * Math.PI;
                        const halfLen = gap / 2 * 0.5;
                        const needleTop = y - Math.sin(angle) * halfLen;
                        const needleBot = y + Math.sin(angle) * halfLen;
                        const topLine = Math.floor(y / gap) * gap;
                        const botLine = topLine + gap;
                        inside = needleTop <= topLine || needleBot >= botLine;
                    }

                    pointsRef.current.push({ x, y, inside });
                    setTotalPoints(n => n + 1);
                }

                // Compute estimate
                const total = pointsRef.current.length;
                const hits = pointsRef.current.filter(p => p.inside).length;
                if (total > 0) {
                    if (sim === 'pi') {
                        setEstimate((4 * hits / total).toFixed(6));
                    } else if (sim === 'integral') {
                        setEstimate((hits / total).toFixed(6));
                    } else {
                        setEstimate(hits > 0 ? (2 * 0.5 * total / (hits * (1 / 6))).toFixed(6) : '—');
                    }
                }

                if (total >= 20000) {
                    runRef.current = false;
                    setRunning(false);
                }
            }

            animRef.current = requestAnimationFrame(draw);
        };

        animRef.current = requestAnimationFrame(draw);
        window.addEventListener('resize', resize);
        return () => { cancelAnimationFrame(animRef.current); window.removeEventListener('resize', resize); };
    }, [sim, speed]);

    const actual = sim === 'pi' ? Math.PI.toFixed(6) : sim === 'integral' ? (1 / 3).toFixed(6) : Math.PI.toFixed(6);
    const error = estimate !== '—' ? Math.abs(parseFloat(estimate) - parseFloat(actual)).toFixed(6) : '—';

    return (
        <div className="tool-card">
            <div className="tool-card-header">
                <h3>Monte Carlo Simulator</h3>
                <span className="subject-topic" style={{ background: 'var(--amber-glow)', color: 'var(--amber)' }}>Statistics</span>
            </div>
            <div className="tool-card-body">
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                    {([['pi', 'Estimate π'], ['integral', '∫x² dx'], ['buffon', "Buffon's Needle"]] as [Sim, string][]).map(([s, label]) => (
                        <button key={s} onClick={() => { setSim(s); clear(); }}
                            style={{
                                padding: '5px 12px', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem',
                                fontWeight: 600, cursor: 'pointer',
                                background: sim === s ? 'var(--amber)' : 'transparent',
                                color: sim === s ? '#fff' : 'var(--text-dim)',
                                border: `1px solid ${sim === s ? 'var(--amber)' : 'var(--border-warm)'}`,
                            }}>
                            {label}
                        </button>
                    ))}
                </div>

                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>Speed:</label>
                    <input type="range" min={1} max={50} value={speed} onChange={e => setSpeed(+e.target.value)}
                        style={{ width: 120, accentColor: 'var(--amber)' }} />
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>{speed} pts/frame</span>
                </div>

                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <button className="btn-primary" onClick={start} disabled={running}
                        style={{ fontSize: '0.82rem', padding: '7px 18px', opacity: running ? 0.5 : 1 }}>
                        ▶ Start
                    </button>
                    <button onClick={stop} style={{ ...btnStyle, opacity: running ? 1 : 0.4 }}>⏹ Stop</button>
                    <button onClick={clear} style={btnStyle}>✕ Clear</button>
                </div>

                <div style={{ width: '100%', aspectRatio: '1/1', maxHeight: 420, background: 'var(--bg-primary)', border: '1px solid var(--border-warm)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: 12 }}>
                    <canvas ref={canvasRef} style={{ display: 'block' }} />
                </div>

                {/* Stats */}
                <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
                    background: 'var(--bg-secondary)', border: '1px solid var(--border-warm)',
                    borderRadius: 'var(--radius-sm)', padding: 12,
                }}>
                    {[
                        ['Points', totalPoints.toLocaleString()],
                        ['Estimate', estimate],
                        ['Actual', actual],
                        ['Error', error],
                    ].map(([label, val]) => (
                        <div key={label} style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontWeight: 600, marginBottom: 2 }}>{label}</div>
                            <div style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-primary)' }}>{val}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

const btnStyle: React.CSSProperties = {
    padding: '7px 14px', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem',
    fontWeight: 500, cursor: 'pointer', background: 'transparent',
    color: 'var(--text-dim)', border: '1px solid var(--border-warm)',
};
