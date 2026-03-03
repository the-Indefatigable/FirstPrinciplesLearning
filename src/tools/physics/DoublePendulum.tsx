import { useRef, useEffect, useState, useCallback } from 'react';

export default function DoublePendulum() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const stateRef = useRef({ running: true, trail: [] as { x: number; y: number }[] });

    const [params, setParams] = useState({
        L1: 150, L2: 120,
        m1: 10, m2: 10,
        theta1: Math.PI / 2, theta2: Math.PI / 1.5,
        g: 9.81, damping: 0.999,
    });
    const paramsRef = useRef(params);
    paramsRef.current = params;

    const [isRunning, setIsRunning] = useState(true);

    const reset = useCallback(() => {
        stateRef.current.trail = [];
        setParams(p => ({ ...p, theta1: Math.PI / 2, theta2: Math.PI / 1.5 }));
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d')!;

        canvas.width = canvas.parentElement!.clientWidth;
        canvas.height = 450;
        const W = canvas.width;
        const H = canvas.height;
        const originX = W / 2;
        const originY = H * 0.3;

        let t1 = params.theta1;
        let t2 = params.theta2;
        let w1 = 0, w2 = 0;
        const dt = 0.03;
        let animId: number;

        stateRef.current.trail = [];

        const step = () => {
            const { L1, L2, m1, m2, g, damping } = paramsRef.current;
            const l1 = L1 / 150; // normalize for physics
            const l2 = L2 / 150;

            // Lagrangian equations of motion for double pendulum
            const delta = t1 - t2;
            const den1 = (2 * m1 + m2 - m2 * Math.cos(2 * delta));

            const a1_num = -g * (2 * m1 + m2) * Math.sin(t1)
                - m2 * g * Math.sin(t1 - 2 * t2)
                - 2 * Math.sin(delta) * m2 * (w2 * w2 * l2 + w1 * w1 * l1 * Math.cos(delta));
            const a1 = a1_num / (l1 * den1);

            const a2_num = 2 * Math.sin(delta) * (
                w1 * w1 * l1 * (m1 + m2)
                + g * (m1 + m2) * Math.cos(t1)
                + w2 * w2 * l2 * m2 * Math.cos(delta)
            );
            const a2 = a2_num / (l2 * den1);

            w1 += a1 * dt;
            w2 += a2 * dt;
            w1 *= damping;
            w2 *= damping;
            t1 += w1 * dt;
            t2 += w2 * dt;

            // Positions
            const x1 = originX + L1 * Math.sin(t1);
            const y1 = originY + L1 * Math.cos(t1);
            const x2 = x1 + L2 * Math.sin(t2);
            const y2 = y1 + L2 * Math.cos(t2);

            const trail = stateRef.current.trail;
            trail.push({ x: x2, y: y2 });
            if (trail.length > 600) trail.shift();

            // Draw
            const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            ctx.fillStyle = isDark ? '#141210' : '#faf8f5';
            ctx.fillRect(0, 0, W, H);

            // Trail
            for (let i = 1; i < trail.length; i++) {
                const alpha = i / trail.length;
                ctx.strokeStyle = `rgba(217, 119, 6, ${alpha * 0.6})`;
                ctx.lineWidth = alpha * 2.5;
                ctx.beginPath();
                ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
                ctx.lineTo(trail[i].x, trail[i].y);
                ctx.stroke();
            }

            // Rods
            ctx.strokeStyle = isDark ? '#6b6358' : '#9c9488';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(originX, originY); ctx.lineTo(x1, y1); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();

            // Pivot
            ctx.fillStyle = isDark ? '#4a443c' : '#b8b0a4';
            ctx.beginPath(); ctx.arc(originX, originY, 5, 0, Math.PI * 2); ctx.fill();

            // Mass 1
            const r1 = 6 + m1 * 0.6;
            ctx.fillStyle = isDark ? '#e8e4de' : '#1a1612';
            ctx.beginPath(); ctx.arc(x1, y1, r1, 0, Math.PI * 2); ctx.fill();

            // Mass 2
            const r2 = 6 + m2 * 0.6;
            ctx.fillStyle = '#d97706';
            ctx.beginPath(); ctx.arc(x2, y2, r2, 0, Math.PI * 2); ctx.fill();

            // Info
            ctx.fillStyle = isDark ? '#6b6358' : '#9c9488';
            ctx.font = '11px Sora, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(`θ₁ = ${(t1 * 180 / Math.PI % 360).toFixed(1)}°`, 16, H - 36);
            ctx.fillText(`θ₂ = ${(t2 * 180 / Math.PI % 360).toFixed(1)}°`, 16, H - 20);
        };

        const loop = () => {
            if (stateRef.current.running) step();
            animId = requestAnimationFrame(loop);
        };
        loop();

        return () => cancelAnimationFrame(animId);
    }, [params.theta1, params.theta2]);

    useEffect(() => {
        stateRef.current.running = isRunning;
    }, [isRunning]);

    const slider = (label: string, key: keyof typeof params, min: number, max: number, step: number = 1) => (
        <div className="tool-slider-group" style={{ flex: 1, minWidth: 120 }}>
            <label>{label}: <span className="slider-val">{params[key]}</span></label>
            <input
                className="tool-slider"
                type="range" min={min} max={max} step={step}
                value={params[key]}
                onChange={(e) => setParams(p => ({ ...p, [key]: parseFloat(e.target.value) }))}
            />
        </div>
    );

    return (
        <div className="tool-card">
            <div className="tool-card-header">
                <h3>Double Pendulum</h3>
                <div className="tool-controls">
                    <button className="tool-btn" onClick={() => setIsRunning(!isRunning)}>{isRunning ? 'Pause' : 'Play'}</button>
                    <button className="tool-btn--outline tool-btn" onClick={reset}>Reset</button>
                </div>
            </div>
            <div className="tool-card-body" style={{ padding: 0 }}>
                <div className="canvas-container" style={{ border: 'none', borderRadius: 0 }}>
                    <canvas ref={canvasRef} />
                </div>
                <div style={{ padding: '16px 24px', display: 'flex', gap: 16, flexWrap: 'wrap', borderTop: '1px solid var(--border-warm)' }}>
                    {slider('L₁', 'L1', 50, 200)}
                    {slider('L₂', 'L2', 50, 200)}
                    {slider('m₁', 'm1', 1, 20)}
                    {slider('m₂', 'm2', 1, 20)}
                    {slider('Gravity', 'g', 1, 20, 0.5)}
                    {slider('Damping', 'damping', 0.99, 1, 0.001)}
                </div>
            </div>
        </div>
    );
}
