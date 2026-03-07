import { useRef, useEffect, useState } from 'react';
import { useUrlState } from '../../hooks/useUrlState';
import ExportButton from '../../components/ExportButton';

export default function SpringMass() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animRef = useRef<number>(0);

    const [params, setParams] = useUrlState('p', {
        k: 10, m: 2, damping: 0.3, drivingFreq: 0, drivingAmp: 50,
    });
    const paramsRef = useRef(params);
    paramsRef.current = params;

    const [challengeMode, setChallengeMode] = useState(false);
    const challengeRef = useRef(challengeMode);
    challengeRef.current = challengeMode;

    const simRef = useRef({ y: 100, vy: 0, t: 0, trail: [] as { t: number; y: number }[] });
    const ghostSimRef = useRef({ y: 100, vy: 0, t: 0, trail: [] as { t: number; y: number }[] });

    // Ghost target parameters (hidden from user)
    const ghostParams = { k: 25, m: 5, damping: 1.5, drivingFreq: 0, drivingAmp: 0 };
    const [isWinner, setIsWinner] = useState(false);
    const winTimerRef = useRef(0);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d')!;

        const resize = () => {
            canvas.width = canvas.parentElement!.clientWidth;
            canvas.height = 260;
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
            const ghost = ghostSimRef.current;
            const isChallenge = challengeRef.current;

            // --- Physics: Real Mass ---
            const driving = drivingFreq > 0 ? drivingAmp * Math.sin(drivingFreq * sim.t) : 0;
            const force = -k * sim.y - damping * sim.vy + driving;
            sim.vy += (force / m) * dt;
            sim.y += sim.vy * dt;
            sim.t += dt;
            sim.trail.push({ t: sim.t, y: sim.y });
            if (sim.trail.length > 300) sim.trail.shift();

            // --- Physics: Ghost Mass ---
            if (isChallenge) {
                const gForce = -ghostParams.k * ghost.y - ghostParams.damping * ghost.vy;
                ghost.vy += (gForce / ghostParams.m) * dt;
                ghost.y += ghost.vy * dt;
                ghost.t += dt;
                ghost.trail.push({ t: ghost.t, y: ghost.y });
                if (ghost.trail.length > 300) ghost.trail.shift();

                // Check Win Condition: if trajectories match closely for a sustained period
                const error = Math.abs(sim.y - ghost.y) + Math.abs(sim.vy - ghost.vy);
                if (error < 5) {
                    winTimerRef.current += dt;
                    if (winTimerRef.current > 2) setIsWinner(true);
                } else {
                    winTimerRef.current = 0;
                    setIsWinner(false);
                }
            } else {
                winTimerRef.current = 0;
                setIsWinner(false);
            }

            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

            // Clear
            ctx.fillStyle = isDark ? '#141210' : '#faf8f5';
            ctx.fillRect(0, 0, w, h);

            // Layout
            const splitX = w * 0.38;
            const eqY = h * 0.45;
            const anchorX = splitX / 2;
            const anchorY = 50;

            const drawSystem = (posY: number, massVal: number, colorFill: string, colorStroke: string, isGhost: boolean) => {
                const displacement = Math.max(-150, Math.min(150, posY));
                const massY = eqY + displacement;
                const massSize = 28 + Math.min(massVal, 10) * 3;
                const springTop = anchorY + 10;
                const springBottom = massY - massSize / 2;
                const springLen = springBottom - springTop;

                // Spring
                ctx.beginPath();
                ctx.moveTo(anchorX, anchorY);
                ctx.lineTo(anchorX, springTop);
                for (let i = 0; i < 14; i++) {
                    const t = i / 14, t2 = (i + 0.5) / 14;
                    const py1 = springTop + t * springLen, py2 = springTop + t2 * springLen;
                    const dir = i % 2 === 0 ? 1 : -1;
                    ctx.lineTo(anchorX + dir * 24, (py1 + py2) / 2);
                }
                ctx.lineTo(anchorX, springBottom);
                ctx.strokeStyle = colorStroke;
                ctx.lineWidth = isGhost ? 1.5 : 2.5;
                if (isGhost) ctx.setLineDash([4, 4]);
                ctx.stroke();
                ctx.setLineDash([]);

                // Mass
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

                ctx.fillStyle = colorFill;
                ctx.fill();
                ctx.strokeStyle = colorStroke;
                ctx.lineWidth = 2;
                ctx.stroke();

                if (!isGhost) {
                    ctx.fillStyle = '#fff';
                    ctx.font = `bold ${Math.max(12, massSize * 0.35)}px Sora, sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(`${massVal}kg`, anchorX, massY);
                }
            };

            // Ceiling bracket
            ctx.fillStyle = isDark ? '#4a443c' : '#9c9488';
            ctx.fillRect(anchorX - 35, anchorY - 6, 70, 6);
            ctx.beginPath(); ctx.moveTo(anchorX - 35, anchorY); ctx.lineTo(anchorX + 35, anchorY);
            ctx.strokeStyle = isDark ? '#6b6358' : '#9c9488'; ctx.lineWidth = 2; ctx.stroke();
            for (let i = -30; i <= 30; i += 10) {
                ctx.beginPath(); ctx.moveTo(anchorX + i, anchorY - 6); ctx.lineTo(anchorX + i + 8, anchorY);
                ctx.strokeStyle = isDark ? '#4a443c' : '#b8b0a4'; ctx.lineWidth = 1; ctx.stroke();
            }

            // Equilibrium line
            ctx.setLineDash([6, 6]); ctx.strokeStyle = isDark ? '#2e2a2488' : '#e8e0d488';
            ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(20, eqY); ctx.lineTo(splitX - 20, eqY); ctx.stroke(); ctx.setLineDash([]);
            ctx.fillStyle = isDark ? '#4a443c' : '#b8b0a4'; ctx.font = '10px Sora, sans-serif'; ctx.textAlign = 'left'; ctx.fillText('eq', 8, eqY - 6);

            // Draw Ghost then Draw Real Mass
            if (isChallenge) {
                drawSystem(ghost.y, ghostParams.m, 'transparent', isDark ? 'rgba(232, 228, 222, 0.3)' : 'rgba(26, 22, 18, 0.2)', true);
            }
            drawSystem(sim.y, m, '#6b8f71', isDark ? '#86efac' : '#4a8055', false);

            // Velocity indicator (Real only)
            const realMassY = eqY + Math.max(-150, Math.min(150, sim.y));
            const realMassSize = 28 + m * 3;
            const velLen = sim.vy * 0.3;
            if (Math.abs(velLen) > 3) {
                ctx.strokeStyle = '#c2714f'; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(anchorX + realMassSize / 2 + 16, realMassY); ctx.lineTo(anchorX + realMassSize / 2 + 16, realMassY - velLen); ctx.stroke();
                const vdir = velLen > 0 ? -1 : 1;
                ctx.beginPath(); ctx.moveTo(anchorX + realMassSize / 2 + 16, realMassY - velLen); ctx.lineTo(anchorX + realMassSize / 2 + 12, realMassY - velLen + vdir * 6);
                ctx.lineTo(anchorX + realMassSize / 2 + 20, realMassY - velLen + vdir * 6); ctx.fill();
            }

            // === GRAPH: Position vs Time ===
            const graphL = splitX + 16, graphR = w - 20, graphT = 40, graphB = h - 50, graphW = graphR - graphL, graphH = graphB - graphT, gMidY = graphT + graphH / 2;
            ctx.fillStyle = isDark ? '#1c1a17' : '#f3efe8'; ctx.fillRect(graphL, graphT, graphW, graphH);
            ctx.strokeStyle = isDark ? '#2e2a24' : '#e8e0d4'; ctx.lineWidth = 1; ctx.strokeRect(graphL, graphT, graphW, graphH);

            ctx.strokeStyle = isDark ? '#242018' : '#ebe6dc'; ctx.lineWidth = 0.5;
            for (let i = 1; i < 4; i++) {
                const gy = graphT + (i / 4) * graphH; ctx.beginPath(); ctx.moveTo(graphL, gy); ctx.lineTo(graphR, gy); ctx.stroke();
            }

            ctx.setLineDash([4, 4]); ctx.strokeStyle = isDark ? '#4a443c' : '#b8b0a4'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(graphL, gMidY); ctx.lineTo(graphR, gMidY); ctx.stroke(); ctx.setLineDash([]);

            ctx.fillStyle = isDark ? '#6b6358' : '#9c9488'; ctx.font = '10px Sora, sans-serif'; ctx.textAlign = 'center';
            ctx.fillText('displacement vs time', graphL + graphW / 2, graphT - 10); ctx.fillText('0', graphL - 10, gMidY + 3);

            const plotTrail = (trailData: typeof sim.trail, color: string, isDashed: boolean) => {
                if (trailData.length > 1) {
                    const maxY = 150; // Fixed scale
                    ctx.strokeStyle = color; ctx.lineWidth = isDashed ? 1.5 : 2;
                    if (isDashed) ctx.setLineDash([4, 4]); else ctx.setLineDash([]);
                    ctx.beginPath();
                    trailData.forEach((p, i) => {
                        const px = graphL + (i / trailData.length) * graphW;
                        const py = gMidY - (p.y / maxY) * (graphH / 2 - 15);
                        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                    });
                    ctx.stroke(); ctx.setLineDash([]);
                }
            };

            if (isChallenge) plotTrail(ghost.trail, isDark ? '#e8e4de55' : '#1a161244', true);
            plotTrail(sim.trail, '#6b8f71', false);

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
        <div className="tool-card" id="spring-mass-card" style={{ border: isWinner ? '2px solid var(--sage)' : '1px solid var(--border-warm)' }}>
            <div className="tool-card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <h3>Spring-Mass System</h3>
                    {challengeMode && (
                        <span style={{ fontSize: '0.8rem', padding: '2px 8px', borderRadius: '4px', background: isWinner ? 'var(--sage-glow)' : 'var(--amber-soft)', color: isWinner ? 'var(--sage)' : 'var(--amber)' }}>
                            {isWinner ? '✨ Challenge Complete!' : 'Target: Ghost Mass'}
                        </span>
                    )}
                </div>
                <div className="tool-controls" style={{ display: 'flex', gap: '8px' }}>
                    <button
                        className={`tool-btn ${challengeMode ? 'active' : ''}`}
                        onClick={() => {
                            setChallengeMode(!challengeMode);
                            challengeRef.current = !challengeMode;
                            ghostSimRef.current = { y: 100, vy: 0, t: 0, trail: [] };
                            simRef.current = { y: 100, vy: 0, t: 0, trail: [] };
                        }}
                    >
                        {challengeMode ? 'Exit Challenge' : 'Challenge Mode'}
                    </button>
                    <ExportButton targetId="spring-mass-card" filename="spring_simulation" />
                    <button className="tool-btn--outline tool-btn" onClick={() => {
                        simRef.current = { y: 100, vy: 0, t: 0, trail: [] };
                        ghostSimRef.current = { y: 100, vy: 0, t: 0, trail: [] };
                    }} style={{ fontSize: '0.82rem', padding: '6px 14px' }}>Reset</button>
                </div>
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
