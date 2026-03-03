import { useRef, useEffect, useState } from 'react';

export default function SpringMass() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animRef = useRef<number>(0);

    const [params, setParams] = useState({
        k: 10, m: 2, damping: 0.3, drivingFreq: 0, drivingAmp: 50,
    });
    const paramsRef = useRef(params);
    paramsRef.current = params;

    const simRef = useRef({ y: 100, vy: 0, t: 0, trail: [] as { t: number; y: number }[] });

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d')!;

        const resize = () => {
            canvas.width = canvas.parentElement!.clientWidth;
            canvas.height = 400;
        };
        resize();
        window.addEventListener('resize', resize);

        const W = () => canvas.width;
        const H = () => canvas.height;
        const dt = 0.016;

        const loop = () => {
            const w = W();
            const h = H();
            const { k, m, damping, drivingFreq, drivingAmp } = paramsRef.current;
            const sim = simRef.current;

            // Physics
            const driving = drivingFreq > 0 ? drivingAmp * Math.sin(drivingFreq * sim.t) : 0;
            const force = -k * sim.y - damping * sim.vy + driving;
            sim.vy += (force / m) * dt;
            sim.y += sim.vy * dt;
            sim.t += dt;

            sim.trail.push({ t: sim.t, y: sim.y });
            if (sim.trail.length > 300) sim.trail.shift();

            const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

            // Clear
            ctx.fillStyle = isDark ? '#141210' : '#faf8f5';
            ctx.fillRect(0, 0, w, h);

            // Layout: spring on left (40%), graph on right (60%)
            const splitX = w * 0.38;
            const eqY = h * 0.45;
            const anchorX = splitX / 2;
            const anchorY = 50;
            const displacement = Math.max(-150, Math.min(150, sim.y)); // clamp for visual
            const massY = eqY + displacement;
            const massSize = 28 + m * 3;

            // === SPRING COILS ===
            const coilCount = 14;
            const springTop = anchorY + 10;
            const springBottom = massY - massSize / 2;
            const springLen = springBottom - springTop;
            const coilWidth = 24;

            // Ceiling bracket
            ctx.fillStyle = isDark ? '#4a443c' : '#9c9488';
            ctx.fillRect(anchorX - 35, anchorY - 6, 70, 6);
            ctx.beginPath();
            ctx.moveTo(anchorX - 35, anchorY);
            ctx.lineTo(anchorX + 35, anchorY);
            ctx.strokeStyle = isDark ? '#6b6358' : '#9c9488';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Hatch marks on ceiling
            for (let i = -30; i <= 30; i += 10) {
                ctx.beginPath();
                ctx.moveTo(anchorX + i, anchorY - 6);
                ctx.lineTo(anchorX + i + 8, anchorY);
                ctx.strokeStyle = isDark ? '#4a443c' : '#b8b0a4';
                ctx.lineWidth = 1;
                ctx.stroke();
            }

            // Draw spring as zigzag coils
            ctx.beginPath();
            ctx.moveTo(anchorX, anchorY);
            ctx.lineTo(anchorX, springTop);

            for (let i = 0; i < coilCount; i++) {
                const t = i / coilCount;
                const t2 = (i + 0.5) / coilCount;
                const py1 = springTop + t * springLen;
                const py2 = springTop + t2 * springLen;
                const dir = i % 2 === 0 ? 1 : -1;
                ctx.lineTo(anchorX + dir * coilWidth, (py1 + py2) / 2);
            }
            ctx.lineTo(anchorX, springBottom);

            ctx.strokeStyle = isDark ? '#a09888' : '#5c544a';
            ctx.lineWidth = 2.5;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            ctx.stroke();

            // Equilibrium dashed line
            ctx.setLineDash([6, 6]);
            ctx.strokeStyle = isDark ? '#2e2a2488' : '#e8e0d488';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(20, eqY);
            ctx.lineTo(splitX - 20, eqY);
            ctx.stroke();
            ctx.setLineDash([]);

            // Equilibrium label
            ctx.fillStyle = isDark ? '#4a443c' : '#b8b0a4';
            ctx.font = '10px Sora, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText('eq', 8, eqY - 6);

            // Mass (solid rounded rect)
            const mx = anchorX - massSize / 2;
            const my = massY - massSize / 2;
            const radius = 6;
            ctx.beginPath();
            ctx.moveTo(mx + radius, my);
            ctx.lineTo(mx + massSize - radius, my);
            ctx.quadraticCurveTo(mx + massSize, my, mx + massSize, my + radius);
            ctx.lineTo(mx + massSize, my + massSize - radius);
            ctx.quadraticCurveTo(mx + massSize, my + massSize, mx + massSize - radius, my + massSize);
            ctx.lineTo(mx + radius, my + massSize);
            ctx.quadraticCurveTo(mx, my + massSize, mx, my + massSize - radius);
            ctx.lineTo(mx, my + radius);
            ctx.quadraticCurveTo(mx, my, mx + radius, my);
            ctx.closePath();

            ctx.fillStyle = '#6b8f71';
            ctx.fill();
            ctx.strokeStyle = isDark ? '#86efac' : '#4a8055';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Mass label
            ctx.fillStyle = '#fff';
            ctx.font = `bold ${Math.max(12, massSize * 0.35)}px Sora, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${m}kg`, anchorX, massY);

            // Displacement arrow
            if (Math.abs(displacement) > 5) {
                const arrowStartY = eqY;
                const arrowEndY = massY;
                ctx.strokeStyle = '#d97706';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(splitX - 30, arrowStartY);
                ctx.lineTo(splitX - 30, arrowEndY);
                ctx.stroke();
                // Arrow head
                const dir = displacement > 0 ? 1 : -1;
                ctx.beginPath();
                ctx.moveTo(splitX - 30, arrowEndY);
                ctx.lineTo(splitX - 35, arrowEndY - dir * 8);
                ctx.lineTo(splitX - 25, arrowEndY - dir * 8);
                ctx.closePath();
                ctx.fillStyle = '#d97706';
                ctx.fill();

                ctx.fillStyle = '#d97706';
                ctx.font = '11px JetBrains Mono, monospace';
                ctx.textAlign = 'center';
                ctx.fillText(`${displacement.toFixed(0)}`, splitX - 30, (arrowStartY + arrowEndY) / 2 - 8);
            }

            // Velocity indicator
            const velLen = sim.vy * 0.3;
            if (Math.abs(velLen) > 3) {
                ctx.strokeStyle = '#c2714f';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(anchorX + massSize / 2 + 16, massY);
                ctx.lineTo(anchorX + massSize / 2 + 16, massY - velLen);
                ctx.stroke();
                const vdir = velLen > 0 ? -1 : 1;
                ctx.beginPath();
                ctx.moveTo(anchorX + massSize / 2 + 16, massY - velLen);
                ctx.lineTo(anchorX + massSize / 2 + 12, massY - velLen + vdir * 6);
                ctx.lineTo(anchorX + massSize / 2 + 20, massY - velLen + vdir * 6);
                ctx.closePath();
                ctx.fillStyle = '#c2714f';
                ctx.fill();
            }

            // === GRAPH: Position vs Time ===
            const graphL = splitX + 16;
            const graphR = w - 20;
            const graphT = 40;
            const graphB = h - 50;
            const graphW = graphR - graphL;
            const graphH = graphB - graphT;
            const gMidY = graphT + graphH / 2;

            // Graph background
            ctx.fillStyle = isDark ? '#1c1a17' : '#f3efe8';
            ctx.fillRect(graphL, graphT, graphW, graphH);
            ctx.strokeStyle = isDark ? '#2e2a24' : '#e8e0d4';
            ctx.lineWidth = 1;
            ctx.strokeRect(graphL, graphT, graphW, graphH);

            // Grid lines
            ctx.strokeStyle = isDark ? '#242018' : '#ebe6dc';
            ctx.lineWidth = 0.5;
            for (let i = 1; i < 4; i++) {
                const gy = graphT + (i / 4) * graphH;
                ctx.beginPath(); ctx.moveTo(graphL, gy); ctx.lineTo(graphR, gy); ctx.stroke();
            }

            // Zero line
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = isDark ? '#4a443c' : '#b8b0a4';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(graphL, gMidY); ctx.lineTo(graphR, gMidY); ctx.stroke();
            ctx.setLineDash([]);

            // Label
            ctx.fillStyle = isDark ? '#6b6358' : '#9c9488';
            ctx.font = '10px Sora, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('displacement vs time', graphL + graphW / 2, graphT - 10);
            ctx.fillText('0', graphL - 10, gMidY + 3);

            // Plot trail
            if (sim.trail.length > 1) {
                const maxY = Math.max(100, ...sim.trail.map(p => Math.abs(p.y)));
                ctx.strokeStyle = '#6b8f71';
                ctx.lineWidth = 2;
                ctx.beginPath();
                sim.trail.forEach((p, i) => {
                    const px = graphL + (i / sim.trail.length) * graphW;
                    const py = gMidY - (p.y / maxY) * (graphH / 2 - 15);
                    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                });
                ctx.stroke();
            }

            // Info bar at bottom
            const omega0 = Math.sqrt(k / m);
            ctx.fillStyle = isDark ? '#6b6358' : '#9c9488';
            ctx.font = '11px JetBrains Mono, monospace';
            ctx.textAlign = 'left';
            ctx.fillText(`ω₀ = ${omega0.toFixed(2)} rad/s`, graphL, h - 14);
            ctx.textAlign = 'center';
            ctx.fillText(`f₀ = ${(omega0 / (2 * Math.PI)).toFixed(2)} Hz`, graphL + graphW / 2, h - 14);
            ctx.textAlign = 'right';
            ctx.fillText(`T = ${(2 * Math.PI / omega0).toFixed(2)}s`, graphR, h - 14);

            animRef.current = requestAnimationFrame(loop);
        };

        animRef.current = requestAnimationFrame(loop);
        return () => {
            cancelAnimationFrame(animRef.current);
            window.removeEventListener('resize', resize);
        };
    }, []);

    const slider = (label: string, key: keyof typeof params, min: number, max: number, step: number = 0.1) => (
        <div className="tool-slider-group" style={{ flex: 1, minWidth: 130 }}>
            <label>{label}: <span className="slider-val">{params[key]}</span></label>
            <input className="tool-slider" type="range" min={min} max={max} step={step}
                value={params[key]}
                onChange={(e) => setParams(p => ({ ...p, [key]: parseFloat(e.target.value) }))}
            />
        </div>
    );

    return (
        <div className="tool-card">
            <div className="tool-card-header">
                <h3>Spring-Mass System</h3>
                <button className="tool-btn--outline tool-btn" onClick={() => {
                    simRef.current = { y: 100, vy: 0, t: 0, trail: [] };
                }} style={{ fontSize: '0.82rem', padding: '6px 14px' }}>Reset</button>
            </div>
            <div className="tool-card-body" style={{ padding: 0 }}>
                <div className="canvas-container" style={{ border: 'none', borderRadius: 0 }}>
                    <canvas ref={canvasRef} />
                </div>
                <div style={{ padding: '16px 24px', display: 'flex', gap: 16, flexWrap: 'wrap', borderTop: '1px solid var(--border-warm)' }}>
                    {slider('Spring k', 'k', 1, 50)}
                    {slider('Mass m', 'm', 0.5, 10)}
                    {slider('Damping γ', 'damping', 0, 5, 0.1)}
                    {slider('Drive ω', 'drivingFreq', 0, 15, 0.1)}
                    {slider('Drive Amp', 'drivingAmp', 0, 100)}
                </div>
            </div>
        </div>
    );
}
