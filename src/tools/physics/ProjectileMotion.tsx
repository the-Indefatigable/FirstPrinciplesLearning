import { useRef, useEffect, useState, useCallback } from 'react';

export default function ProjectileMotion() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animRef = useRef<number>(0);
    const [angle, setAngle] = useState(45);
    const [speed, setSpeed] = useState(50);
    const [airRes, setAirRes] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const [stats, setStats] = useState({ maxH: 0, range: 0, time: 0 });

    const launch = useCallback(() => {
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
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const g = 9.81;
        const rad = angle * Math.PI / 180;
        const vx0 = speed * Math.cos(rad);
        const vy0 = speed * Math.sin(rad);
        const dragCoeff = airRes ? 0.04 : 0;

        // Compute full trajectory for scaling
        const points: { x: number; y: number }[] = [];
        let vx = vx0, vy = vy0, px = 0, py = 0;
        const dt = 0.01;
        let maxH = 0, totalTime = 0;
        while (py >= 0 || points.length === 0) {
            points.push({ x: px, y: py });
            const v = Math.sqrt(vx * vx + vy * vy);
            vx -= dragCoeff * vx * v * dt;
            vy -= (g + dragCoeff * vy * v) * dt;
            px += vx * dt;
            py += vy * dt;
            maxH = Math.max(maxH, py);
            totalTime += dt;
            if (totalTime > 100) break;
        }
        const range = px;

        const pad = 40;
        const scaleX = (W - 2 * pad) / Math.max(range, 1);
        const scaleY = (H - 2 * pad) / Math.max(maxH * 1.3, 1);
        const sc = Math.min(scaleX, scaleY);
        const toX = (x: number) => pad + x * sc;
        const toY = (y: number) => H - pad - y * sc;

        setStats({ maxH: Math.round(maxH * 100) / 100, range: Math.round(range * 100) / 100, time: Math.round(totalTime * 100) / 100 });
        setIsRunning(true);

        let frame = 0;
        const draw = () => {
            ctx.clearRect(0, 0, W, H);

            // Ground
            ctx.fillStyle = isDark ? '#1a1612' : '#faf8f5';
            ctx.fillRect(0, 0, W, H);
            ctx.strokeStyle = isDark ? '#6b8f71' : '#6b8f71';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, toY(0));
            ctx.lineTo(W, toY(0));
            ctx.stroke();

            // Grid
            ctx.strokeStyle = isDark ? '#2e2a24' : '#e8e0d4';
            ctx.lineWidth = 0.5;
            const xStep = Math.pow(10, Math.floor(Math.log10(range / 5 || 1)));
            for (let x = 0; x <= range * 1.1; x += xStep) {
                ctx.beginPath(); ctx.moveTo(toX(x), toY(0) + 5); ctx.lineTo(toX(x), 0); ctx.stroke();
                ctx.fillStyle = isDark ? '#6b6358' : '#9c9488';
                ctx.font = '10px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(`${Math.round(x)}`, toX(x), toY(0) + 16);
            }
            const yStep = Math.pow(10, Math.floor(Math.log10(maxH / 4 || 1)));
            for (let y = 0; y <= maxH * 1.2; y += yStep) {
                ctx.beginPath(); ctx.moveTo(toX(0) - 5, toY(y)); ctx.lineTo(W, toY(y)); ctx.stroke();
                if (y > 0) {
                    ctx.fillStyle = isDark ? '#6b6358' : '#9c9488';
                    ctx.textAlign = 'right';
                    ctx.fillText(`${Math.round(y)}`, toX(0) - 8, toY(y) + 3);
                }
            }

            // Trail
            const visible = Math.min(frame, points.length);
            ctx.strokeStyle = isDark ? '#f59e0b' : '#d97706';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            for (let i = 0; i < visible; i++) {
                i === 0 ? ctx.moveTo(toX(points[i].x), toY(points[i].y)) : ctx.lineTo(toX(points[i].x), toY(points[i].y));
            }
            ctx.stroke();

            // No-air trajectory comparison
            if (airRes) {
                ctx.strokeStyle = isDark ? '#4a443c' : '#d4cec6';
                ctx.lineWidth = 1;
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                for (let t = 0; t <= totalTime; t += dt) {
                    const nx = vx0 * t;
                    const ny = vy0 * t - 0.5 * g * t * t;
                    if (ny < 0 && t > 0) break;
                    t === 0 ? ctx.moveTo(toX(nx), toY(ny)) : ctx.lineTo(toX(nx), toY(ny));
                }
                ctx.stroke();
                ctx.setLineDash([]);
            }

            // Ball
            if (visible > 0) {
                const p = points[visible - 1];
                ctx.fillStyle = isDark ? '#f59e0b' : '#d97706';
                ctx.beginPath();
                ctx.arc(toX(p.x), toY(p.y), 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = isDark ? '#fde68a' : '#fef3c7';
                ctx.beginPath();
                ctx.arc(toX(p.x) - 1.5, toY(p.y) - 1.5, 2, 0, Math.PI * 2);
                ctx.fill();
            }

            // Labels
            ctx.font = 'bold 11px Sora, sans-serif';
            ctx.fillStyle = isDark ? '#e8e4de' : '#1a1612';
            ctx.textAlign = 'left';
            ctx.fillText('Distance (m)', W - 80, toY(0) + 16);
            ctx.save();
            ctx.translate(14, H / 2);
            ctx.rotate(-Math.PI / 2);
            ctx.fillText('Height (m)', 0, 0);
            ctx.restore();

            frame += 3;
            if (frame < points.length) {
                animRef.current = requestAnimationFrame(draw);
            } else {
                setIsRunning(false);
            }
        };

        cancelAnimationFrame(animRef.current);
        draw();
    }, [angle, speed, airRes]);

    useEffect(() => () => cancelAnimationFrame(animRef.current), []);

    return (
        <div className="tool-card">
            <div className="tool-card-header">
                <h3>Projectile Motion Lab</h3>
                <span className="subject-topic" style={{ background: 'var(--sage-glow)', color: 'var(--sage)' }}>Mechanics</span>
            </div>
            <div className="tool-card-body">
                <div className="tool-controls-row tool-controls-row--4">
                    <div className="tool-input-group">
                        <label>Launch Angle: {angle}°</label>
                        <input type="range" min={1} max={89} value={angle} onChange={e => setAngle(+e.target.value)}
                            style={{ width: '100%', accentColor: 'var(--sage)' }} />
                    </div>
                    <div className="tool-input-group">
                        <label>Speed: {speed} m/s</label>
                        <input type="range" min={5} max={100} value={speed} onChange={e => setSpeed(+e.target.value)}
                            style={{ width: '100%', accentColor: 'var(--sage)' }} />
                    </div>
                    <div className="tool-input-group" style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 20 }}>
                        <input type="checkbox" id="airRes" checked={airRes} onChange={e => setAirRes(e.target.checked)} />
                        <label htmlFor="airRes" style={{ margin: 0, textTransform: 'none', letterSpacing: 0 }}>Air Resistance</label>
                    </div>
                    <div className="tool-input-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                        <button className="tool-btn" onClick={launch} disabled={isRunning} style={{ width: '100%' }}>
                            🚀 Launch
                        </button>
                    </div>
                </div>

                {stats.range > 0 && (
                    <div style={{ display: 'flex', gap: 24, marginBottom: 16, padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                        <div><span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>Range: </span><strong style={{ color: 'var(--sage)' }}>{stats.range} m</strong></div>
                        <div><span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>Max Height: </span><strong style={{ color: 'var(--sage)' }}>{stats.maxH} m</strong></div>
                        <div><span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>Time: </span><strong style={{ color: 'var(--sage)' }}>{stats.time} s</strong></div>
                    </div>
                )}

                <div style={{ width: '100%', aspectRatio: '16/9', background: 'var(--bg-primary)', border: '1px solid var(--border-warm)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                    <canvas ref={canvasRef} style={{ display: 'block' }} />
                </div>
            </div>
        </div>
    );
}
