import { useRef, useEffect, useState, useCallback } from 'react';

interface Obj {
    x: number; vx: number; mass: number; color: string; label: string;
}

export default function MomentumConservation() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [m1, setM1] = useState(3);
    const [m2, setM2] = useState(1);
    const [v1, setV1] = useState(4);
    const [v2, setV2] = useState(-2);
    const [elasticity, setElasticity] = useState(1);
    const [phase, setPhase] = useState<'setup' | 'running' | 'done'>('setup');
    const animRef = useRef<number>(0);
    const stateRef = useRef<{ objs: Obj[]; collided: boolean }>({ objs: [], collided: false });
    const [info, setInfo] = useState('');

    const start = useCallback(() => {
        stateRef.current = {
            objs: [
                { x: 150, vx: v1 * 30, mass: m1, color: '#d97706', label: 'A' },
                { x: 500, vx: v2 * 30, mass: m2, color: '#6b8f71', label: 'B' },
            ],
            collided: false,
        };
        setPhase('running');

        const totalP = m1 * v1 + m2 * v2;
        const totalKE = 0.5 * m1 * v1 * v1 + 0.5 * m2 * v2 * v2;

        // Post-collision velocities
        const e = elasticity;
        const v1f = ((m1 - e * m2) * v1 + (1 + e) * m2 * v2) / (m1 + m2);
        const v2f = ((m2 - e * m1) * v2 + (1 + e) * m1 * v1) / (m1 + m2);
        const finalKE = 0.5 * m1 * v1f * v1f + 0.5 * m2 * v2f * v2f;

        setInfo(
            `Before: p = ${totalP.toFixed(2)} kg·m/s, KE = ${totalKE.toFixed(2)} J\n` +
            `After:  p = ${(m1 * v1f + m2 * v2f).toFixed(2)} kg·m/s, KE = ${finalKE.toFixed(2)} J\n` +
            `v₁' = ${v1f.toFixed(2)} m/s, v₂' = ${v2f.toFixed(2)} m/s\n` +
            `Type: ${e === 1 ? 'Perfectly Elastic' : e === 0 ? 'Perfectly Inelastic' : `Partially Elastic (e = ${e})`}`
        );
    }, [m1, m2, v1, v2, elasticity]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d')!;
        canvas.width = canvas.parentElement!.clientWidth;
        canvas.height = 220;
        const W = canvas.width;
        const H = canvas.height;
        const groundY = H * 0.7;
        const dt = 0.016;

        const draw = () => {
            const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            ctx.fillStyle = isDark ? '#141210' : '#faf8f5';
            ctx.fillRect(0, 0, W, H);

            // Ground
            ctx.strokeStyle = isDark ? '#2e2a24' : '#e8e0d4';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(W, groundY); ctx.stroke();

            const { objs, collided } = stateRef.current;
            if (objs.length === 0) {
                // Draw setup preview
                const preview = [
                    { x: 150, vx: v1 * 30, mass: m1, color: '#d97706', label: 'A' },
                    { x: 500, vx: v2 * 30, mass: m2, color: '#6b8f71', label: 'B' },
                ];
                preview.forEach(obj => drawObj(ctx, obj, groundY, isDark));
                animRef.current = requestAnimationFrame(draw);
                return;
            }

            if (phase === 'running') {
                // Move
                objs.forEach(o => { o.x += o.vx * dt; });

                // Check collision
                if (!collided) {
                    const r1 = 15 + objs[0].mass * 3;
                    const r2 = 15 + objs[1].mass * 3;
                    if (objs[0].x + r1 >= objs[1].x - r2) {
                        // Collision!
                        const e = elasticity;
                        const v1i = objs[0].vx;
                        const v2i = objs[1].vx;
                        const mA = objs[0].mass;
                        const mB = objs[1].mass;
                        objs[0].vx = ((mA - e * mB) * v1i + (1 + e) * mB * v2i) / (mA + mB);
                        objs[1].vx = ((mB - e * mA) * v2i + (1 + e) * mA * v1i) / (mA + mB);
                        stateRef.current.collided = true;
                    }
                }

                // Check if done (off screen)
                if (collided && (objs[0].x < -100 || objs[0].x > W + 100) && (objs[1].x < -100 || objs[1].x > W + 100)) {
                    setPhase('done');
                }
            }

            objs.forEach(obj => drawObj(ctx, obj, groundY, isDark));

            // Velocity vectors
            objs.forEach(obj => {
                const r = 15 + obj.mass * 3;
                const arrowLen = obj.vx * 0.5;
                if (Math.abs(arrowLen) < 2) return;
                ctx.strokeStyle = obj.color;
                ctx.lineWidth = 2;
                const cy = groundY - r;
                ctx.beginPath();
                ctx.moveTo(obj.x, cy);
                ctx.lineTo(obj.x + arrowLen, cy);
                ctx.stroke();
                // Arrow head
                const dir = arrowLen > 0 ? 1 : -1;
                ctx.beginPath();
                ctx.moveTo(obj.x + arrowLen, cy);
                ctx.lineTo(obj.x + arrowLen - dir * 8, cy - 4);
                ctx.lineTo(obj.x + arrowLen - dir * 8, cy + 4);
                ctx.closePath();
                ctx.fillStyle = obj.color;
                ctx.fill();
            });

            animRef.current = requestAnimationFrame(draw);
        };

        animRef.current = requestAnimationFrame(draw);
        return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
    }, [phase, m1, m2, v1, v2, elasticity]);

    const slider = (label: string, val: number, set: (n: number) => void, min: number, max: number, step: number = 0.5) => (
        <div className="tool-slider-group" style={{ flex: 1, minWidth: 130 }}>
            <label>{label}: <span className="slider-val">{val}</span></label>
            <input className="tool-slider" type="range" min={min} max={max} step={step} value={val}
                onChange={(e) => { set(parseFloat(e.target.value)); setPhase('setup'); stateRef.current.objs = []; stateRef.current.collided = false; }} />
        </div>
    );

    return (
        <div className="tool-card">
            <div className="tool-card-header">
                <h3>Momentum Conservation</h3>
                <div className="tool-controls">
                    <button className="tool-btn" onClick={start} disabled={phase === 'running'}>
                        {phase === 'setup' ? 'Start' : 'Restart'}
                    </button>
                    {phase !== 'setup' && (
                        <button className="tool-btn--outline tool-btn" onClick={() => { setPhase('setup'); stateRef.current.objs = []; stateRef.current.collided = false; }}>Reset</button>
                    )}
                </div>
            </div>
            <div className="tool-card-body" style={{ padding: 0 }}>
                <div className="canvas-container" style={{ border: 'none', borderRadius: 0 }}>
                    <canvas ref={canvasRef} />
                </div>
                <div style={{ padding: '16px 24px', display: 'flex', gap: 16, flexWrap: 'wrap', borderTop: '1px solid var(--border-warm)' }}>
                    {slider('Mass A', m1, setM1, 1, 10)}
                    {slider('Mass B', m2, setM2, 1, 10)}
                    {slider('v₁', v1, setV1, -10, 10)}
                    {slider('v₂', v2, setV2, -10, 10)}
                    {slider('Elasticity', elasticity, setElasticity, 0, 1, 0.1)}
                </div>
                {info && <div style={{ padding: '0 24px 20px' }}><div className="tool-result">{info}</div></div>}
            </div>
        </div>
    );
}

function drawObj(ctx: CanvasRenderingContext2D, obj: Obj, groundY: number, isDark: boolean) {
    const r = 15 + obj.mass * 3;
    const cy = groundY - r;

    ctx.fillStyle = obj.color;
    ctx.beginPath();
    ctx.arc(obj.x, cy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = isDark ? '#141210' : '#ffffff';
    ctx.font = `bold ${Math.max(12, r * 0.7)}px Sora, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(obj.label, obj.x, cy);
}
