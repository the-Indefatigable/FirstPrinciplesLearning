import { useRef, useEffect, useState, useCallback } from 'react';

/* ═══════════════════════════════════════════════════════════════════════
   PRESETS — Common vector fields with interesting features
   ═══════════════════════════════════════════════════════════════════════ */
interface Preset {
    name: string;
    pExpr: string;
    qExpr: string;
    desc: string;
}

const PRESETS: Preset[] = [
    { name: 'Rotation', pExpr: '-y', qExpr: 'x', desc: 'Pure curl, zero divergence — fluid spinning in place' },
    { name: 'Source', pExpr: 'x', qExpr: 'y', desc: 'Pure divergence, zero curl — fluid flowing outward' },
    { name: 'Sink', pExpr: '-x', qExpr: '-y', desc: 'Negative divergence — fluid flowing inward' },
    { name: 'Saddle', pExpr: 'x', qExpr: '-y', desc: 'Div = 0 but stretches along x and compresses along y' },
    { name: 'Shear', pExpr: 'y', qExpr: '0', desc: 'Horizontal flow whose speed depends on height' },
    { name: 'Vortex', pExpr: '-y/(x*x+y*y+0.1)', qExpr: 'x/(x*x+y*y+0.1)', desc: 'Irrotational vortex — speed ∝ 1/r' },
    { name: 'Dipole', pExpr: '2*x*y', qExpr: 'x*x-y*y', desc: 'Electric dipole field pattern' },
    { name: 'Custom', pExpr: 'sin(y)', qExpr: 'cos(x)', desc: 'Edit your own vector field!' },
];

/* ═══════════════════════════════════════════════════════════════════════
   SAFE MATH EVALUATOR
   ═══════════════════════════════════════════════════════════════════════ */
const evalExpr = (expr: string, x: number, y: number): number => {
    try {
        const fn = new Function('x', 'y',
            'const sin=Math.sin,cos=Math.cos,tan=Math.tan,exp=Math.exp,log=Math.log,abs=Math.abs,sqrt=Math.sqrt,PI=Math.PI,pow=Math.pow;' +
            `return (${expr});`
        );
        const val = fn(x, y);
        return isFinite(val) ? val : 0;
    } catch { return 0; }
};

/* ═══════════════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════════════ */
export default function VectorField() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animRef = useRef<number>(0);
    const particlesRef = useRef<{ x: number; y: number; age: number }[]>([]);

    const [presetIdx, setPresetIdx] = useState(0);
    const [pExpr, setPExpr] = useState(PRESETS[0].pExpr);
    const [qExpr, setQExpr] = useState(PRESETS[0].qExpr);
    const [showArrows, setShowArrows] = useState(true);
    const [showParticles, setShowParticles] = useState(true);
    const [showDiv, setShowDiv] = useState(false);
    const [showCurl, setShowCurl] = useState(false);
    const [density, setDensity] = useState(12);

    const selectPreset = useCallback((idx: number) => {
        setPresetIdx(idx);
        setPExpr(PRESETS[idx].pExpr);
        setQExpr(PRESETS[idx].qExpr);
        particlesRef.current = [];
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

        // Particles for flow visualization
        const MAX_PARTICLES = 300;
        const MAX_AGE = 80;

        const draw = () => {
            const rect = canvas.parentElement?.getBoundingClientRect();
            if (!rect) { animRef.current = requestAnimationFrame(draw); return; }
            const W = rect.width, H = rect.height;
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

            // Coordinate system: center of canvas is (0,0), range [-4,4]
            const RANGE = 4;
            const toScreen = (vx: number, vy: number): [number, number] =>
                [(vx + RANGE) / (2 * RANGE) * W, (RANGE - vy) / (2 * RANGE) * H];
            const toWorld = (sx: number, sy: number): [number, number] =>
                [(sx / W) * 2 * RANGE - RANGE, RANGE - (sy / H) * 2 * RANGE];

            ctx.clearRect(0, 0, W, H);

            // ── Background: divergence / curl heatmap ──
            if (showDiv || showCurl) {
                const step = 6;
                const h = 0.01;
                for (let sx = 0; sx < W; sx += step) {
                    for (let sy = 0; sy < H; sy += step) {
                        const [wx, wy] = toWorld(sx, sy);

                        let val = 0;
                        if (showDiv) {
                            // ∂P/∂x + ∂Q/∂y (numerical)
                            const dPdx = (evalExpr(pExpr, wx + h, wy) - evalExpr(pExpr, wx - h, wy)) / (2 * h);
                            const dQdy = (evalExpr(qExpr, wx, wy + h) - evalExpr(qExpr, wx, wy - h)) / (2 * h);
                            val = dPdx + dQdy;
                        } else {
                            // ∂Q/∂x - ∂P/∂y (curl z-component)
                            const dQdx = (evalExpr(qExpr, wx + h, wy) - evalExpr(qExpr, wx - h, wy)) / (2 * h);
                            const dPdy = (evalExpr(pExpr, wx, wy + h) - evalExpr(pExpr, wx, wy - h)) / (2 * h);
                            val = dQdx - dPdy;
                        }

                        const intensity = Math.min(Math.abs(val) * 0.3, 1);
                        if (val > 0.01) {
                            ctx.fillStyle = showDiv
                                ? `rgba(34,197,94,${intensity * 0.35})`    // green = positive div (source)
                                : `rgba(59,130,246,${intensity * 0.35})`;   // blue = positive curl (CCW)
                        } else if (val < -0.01) {
                            ctx.fillStyle = showDiv
                                ? `rgba(239,68,68,${intensity * 0.35})`    // red = negative div (sink)
                                : `rgba(239,68,68,${intensity * 0.35})`;   // red = negative curl (CW)
                        } else {
                            continue;
                        }
                        ctx.fillRect(sx, sy, step, step);
                    }
                }
            }

            // ── Grid lines ──
            ctx.strokeStyle = isDark ? 'rgba(62,56,48,0.4)' : 'rgba(200,192,180,0.4)';
            ctx.lineWidth = 0.5;
            for (let i = -RANGE; i <= RANGE; i++) {
                const [sx] = toScreen(i, 0);
                ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, H); ctx.stroke();
                const [, sy] = toScreen(0, i);
                ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(W, sy); ctx.stroke();
            }

            // Axes darker
            ctx.strokeStyle = isDark ? '#4a4540' : '#9c9488';
            ctx.lineWidth = 1;
            const [ox, oy] = toScreen(0, 0);
            ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(W, oy); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, H); ctx.stroke();

            // ── Arrow field ──
            if (showArrows) {
                const step = W / density;
                for (let sx = step / 2; sx < W; sx += step) {
                    for (let sy = step / 2; sy < H; sy += step) {
                        const [wx, wy] = toWorld(sx, sy);
                        const p = evalExpr(pExpr, wx, wy);
                        const q = evalExpr(qExpr, wx, wy);
                        const mag = Math.sqrt(p * p + q * q);
                        if (mag < 0.001) continue;

                        const maxLen = step * 0.42;
                        const scale = Math.min(maxLen / mag, maxLen);
                        const dx = p * scale;
                        const dy = -q * scale; // flip y

                        const strength = Math.min(mag * 0.5, 1);
                        ctx.strokeStyle = isDark
                            ? `rgba(217,119,6,${0.3 + strength * 0.6})`
                            : `rgba(180,83,9,${0.3 + strength * 0.6})`;
                        ctx.lineWidth = 1.2 + strength;

                        // Line
                        ctx.beginPath();
                        ctx.moveTo(sx - dx * 0.5, sy - dy * 0.5);
                        ctx.lineTo(sx + dx * 0.5, sy + dy * 0.5);
                        ctx.stroke();

                        // Arrowhead
                        const angle = Math.atan2(dy, dx);
                        const headLen = 3 + strength * 2;
                        ctx.beginPath();
                        ctx.moveTo(sx + dx * 0.5, sy + dy * 0.5);
                        ctx.lineTo(
                            sx + dx * 0.5 - headLen * Math.cos(angle - 0.45),
                            sy + dy * 0.5 - headLen * Math.sin(angle - 0.45)
                        );
                        ctx.moveTo(sx + dx * 0.5, sy + dy * 0.5);
                        ctx.lineTo(
                            sx + dx * 0.5 - headLen * Math.cos(angle + 0.45),
                            sy + dy * 0.5 - headLen * Math.sin(angle + 0.45)
                        );
                        ctx.stroke();
                    }
                }
            }

            // ── Flow particles ──
            if (showParticles) {
                // Spawn new particles
                while (particlesRef.current.length < MAX_PARTICLES) {
                    particlesRef.current.push({
                        x: Math.random() * W,
                        y: Math.random() * H,
                        age: Math.floor(Math.random() * MAX_AGE),
                    });
                }

                const alive: typeof particlesRef.current = [];
                for (const pt of particlesRef.current) {
                    const [wx, wy] = toWorld(pt.x, pt.y);
                    const p = evalExpr(pExpr, wx, wy);
                    const q = evalExpr(qExpr, wx, wy);

                    pt.x += p * 0.8;
                    pt.y -= q * 0.8; // flip y
                    pt.age++;

                    if (pt.age > MAX_AGE || pt.x < -10 || pt.x > W + 10 || pt.y < -10 || pt.y > H + 10) {
                        // Respawn
                        alive.push({ x: Math.random() * W, y: Math.random() * H, age: 0 });
                    } else {
                        alive.push(pt);
                    }

                    const alpha = Math.min(pt.age / 10, 1) * Math.max(1 - pt.age / MAX_AGE, 0);
                    ctx.beginPath();
                    ctx.arc(pt.x, pt.y, 1.5, 0, Math.PI * 2);
                    ctx.fillStyle = isDark
                        ? `rgba(251,191,36,${alpha * 0.7})`
                        : `rgba(217,119,6,${alpha * 0.7})`;
                    ctx.fill();
                }
                particlesRef.current = alive;
            }

            // ── Axis labels ──
            ctx.font = 'bold 10px Sora, sans-serif';
            ctx.fillStyle = isDark ? '#6b6560' : '#9c9488';
            ctx.textAlign = 'center';
            ctx.fillText('x', W - 10, oy + 14);
            ctx.fillText('y', ox + 12, 14);

            animRef.current = requestAnimationFrame(draw);
        };

        animRef.current = requestAnimationFrame(draw);
        window.addEventListener('resize', resize);
        return () => {
            cancelAnimationFrame(animRef.current);
            window.removeEventListener('resize', resize);
        };
    }, [pExpr, qExpr, showArrows, showParticles, showDiv, showCurl, density]);

    const preset = PRESETS[presetIdx];

    return (
        <div className="tool-card">
            <div className="tool-card-header">
                <h3>Vector Field Visualizer</h3>
                <span className="subject-topic" style={{ background: 'var(--amber-glow)', color: 'var(--amber)' }}>Multivariable Calculus</span>
            </div>
            <div className="tool-card-body">
                {/* Preset selector */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                    {PRESETS.map((p, i) => (
                        <button key={i} onClick={() => selectPreset(i)}
                            style={{
                                padding: '4px 10px', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem',
                                fontWeight: 600, cursor: 'pointer', border: '1px solid',
                                background: presetIdx === i ? 'var(--amber)' : 'transparent',
                                color: presetIdx === i ? '#fff' : 'var(--text-dim)',
                                borderColor: presetIdx === i ? 'var(--amber)' : 'var(--border-warm)',
                                transition: 'all 0.15s',
                            }}>
                            {p.name}
                        </button>
                    ))}
                </div>

                {/* Description */}
                <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)', margin: '0 0 12px', lineHeight: 1.5, fontStyle: 'italic' }}>
                    {preset.desc}
                </p>

                {/* Expression inputs */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                    <div>
                        <label style={labelStyle}>P(x,y) — x component</label>
                        <input style={inputStyle} value={pExpr}
                            onChange={e => { setPExpr(e.target.value); setPresetIdx(PRESETS.length - 1); }}
                            placeholder="-y" />
                    </div>
                    <div>
                        <label style={labelStyle}>Q(x,y) — y component</label>
                        <input style={inputStyle} value={qExpr}
                            onChange={e => { setQExpr(e.target.value); setPresetIdx(PRESETS.length - 1); }}
                            placeholder="x" />
                    </div>
                </div>

                {/* Toggles */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10, fontSize: '0.8rem' }}>
                    <label style={toggleStyle}>
                        <input type="checkbox" checked={showArrows} onChange={e => setShowArrows(e.target.checked)} /> Arrows
                    </label>
                    <label style={toggleStyle}>
                        <input type="checkbox" checked={showParticles} onChange={e => setShowParticles(e.target.checked)} /> Flow Particles
                    </label>
                    <label style={{ ...toggleStyle, color: '#22c55e' }}>
                        <input type="checkbox" checked={showDiv} onChange={e => { setShowDiv(e.target.checked); if (e.target.checked) setShowCurl(false); }} />
                        ∇·F (Divergence)
                    </label>
                    <label style={{ ...toggleStyle, color: '#3b82f6' }}>
                        <input type="checkbox" checked={showCurl} onChange={e => { setShowCurl(e.target.checked); if (e.target.checked) setShowDiv(false); }} />
                        ∇×F (Curl)
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: 'var(--text-dim)', fontSize: '0.78rem' }}>Density:</span>
                        <input type="range" min={6} max={20} value={density} onChange={e => setDensity(+e.target.value)}
                            style={{ width: 80, accentColor: 'var(--amber)' }} />
                    </div>
                </div>

                {/* Legend */}
                {(showDiv || showCurl) && (
                    <div style={{ display: 'flex', gap: 14, fontSize: '0.72rem', marginBottom: 8, color: 'var(--text-dim)' }}>
                        {showDiv ? (
                            <>
                                <span>🟢 Source (div &gt; 0)</span>
                                <span>🔴 Sink (div &lt; 0)</span>
                            </>
                        ) : (
                            <>
                                <span>🔵 CCW rotation (curl &gt; 0)</span>
                                <span>🔴 CW rotation (curl &lt; 0)</span>
                            </>
                        )}
                    </div>
                )}

                {/* Canvas */}
                <div style={{ width: '100%', aspectRatio: '1/1', maxHeight: 500, background: 'var(--bg-primary)', border: '1px solid var(--border-warm)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                    <canvas ref={canvasRef} style={{ display: 'block' }} />
                </div>
            </div>
        </div>
    );
}

/* ── Styles ── */
const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 3, fontWeight: 600,
};
const inputStyle: React.CSSProperties = {
    width: '100%', padding: '6px 10px', borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-warm)', background: 'var(--bg-secondary)',
    color: 'var(--text-primary)', fontSize: '0.88rem', fontFamily: 'monospace',
};
const toggleStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer',
    color: 'var(--text-dim)', fontWeight: 500,
};
