import { useRef, useEffect, useState } from 'react';

interface Body {
    x: number; y: number;
    vx: number; vy: number;
    mass: number; radius: number;
    color: string; isStatic: boolean;
    trail: { x: number; y: number }[];
}

const G = 0.5;

const DEFAULT_BODIES: Body[] = [
    { x: 400, y: 300, vx: 0, vy: 0, mass: 5000, radius: 30, color: '#f59e0b', isStatic: true, trail: [] },
    { x: 400, y: 100, vx: 3.5, vy: 0, mass: 10, radius: 8, color: '#3b82f6', isStatic: false, trail: [] },
];

export default function OrbitalMechanics() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animRef = useRef(0);
    const bodiesRef = useRef<Body[]>(structuredClone(DEFAULT_BODIES));
    const dragRef = useRef<{ active: boolean; sx: number; sy: number; cx: number; cy: number }>({
        active: false, sx: 0, sy: 0, cx: 0, cy: 0,
    });
    const [, forceRender] = useState(0);
    const trailFrameRef = useRef(0);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d')!;
        canvas.width = 800;
        canvas.height = Math.min(canvas.parentElement!.clientWidth, 500);
        canvas.style.width = '100%';
        canvas.style.height = '100%';

        const loop = () => {
            const bodies = bodiesRef.current;
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

            // --- Physics ---
            for (const b of bodies) {
                if (b.isStatic) continue;
                let ax = 0, ay = 0;
                for (const other of bodies) {
                    if (b === other) continue;
                    const dx = other.x - b.x, dy = other.y - b.y;
                    const distSq = Math.max(dx * dx + dy * dy, 100); // softened
                    const dist = Math.sqrt(distSq);
                    const f = (G * other.mass) / distSq;
                    ax += f * dx / dist;
                    ay += f * dy / dist;
                }
                b.vx += ax; b.vy += ay;
            }
            for (const b of bodies) {
                if (b.isStatic) continue;
                b.x += b.vx; b.y += b.vy;
            }

            // --- Trail (every 3rd frame) ---
            trailFrameRef.current++;
            if (trailFrameRef.current % 3 === 0) {
                for (const b of bodies) {
                    if (b.isStatic) continue;
                    b.trail.push({ x: b.x, y: b.y });
                    if (b.trail.length > 400) b.trail.shift();
                }
            }

            // --- Draw ---
            ctx.fillStyle = isDark ? '#141210' : '#faf8f5';
            ctx.fillRect(0, 0, 800, 600);

            // Stars
            if (isDark) {
                ctx.fillStyle = '#4a443c';
                for (let i = 0; i < 60; i++) {
                    const sx = ((i * 137.5) % 800);
                    const sy = ((i * 97.3) % 600);
                    ctx.fillRect(sx, sy, 1, 1);
                }
            }

            // Trails
            for (const b of bodies) {
                if (b.trail.length < 2) continue;
                ctx.beginPath();
                ctx.moveTo(b.trail[0].x, b.trail[0].y);
                for (let i = 1; i < b.trail.length; i++) {
                    ctx.lineTo(b.trail[i].x, b.trail[i].y);
                }
                ctx.strokeStyle = b.color + '40';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }

            // Bodies
            for (const b of bodies) {
                // Glow for sun
                if (b.isStatic) {
                    const grad = ctx.createRadialGradient(b.x, b.y, b.radius * 0.5, b.x, b.y, b.radius * 3);
                    grad.addColorStop(0, b.color + '50');
                    grad.addColorStop(1, b.color + '00');
                    ctx.beginPath();
                    ctx.arc(b.x, b.y, b.radius * 3, 0, Math.PI * 2);
                    ctx.fillStyle = grad;
                    ctx.fill();
                }

                ctx.beginPath();
                ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
                ctx.fillStyle = b.color;
                ctx.fill();

                // Specular highlight
                ctx.beginPath();
                ctx.arc(b.x - b.radius * 0.25, b.y - b.radius * 0.25, b.radius * 0.35, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255,255,255,0.3)';
                ctx.fill();
            }

            // Drag vector
            const d = dragRef.current;
            if (d.active) {
                ctx.setLineDash([6, 4]);
                ctx.strokeStyle = isDark ? '#e8e4de' : '#5c544a';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(d.sx, d.sy);
                ctx.lineTo(d.cx, d.cy);
                ctx.stroke();
                ctx.setLineDash([]);

                // Ghost planet
                ctx.beginPath();
                ctx.arc(d.sx, d.sy, 6, 0, Math.PI * 2);
                ctx.fillStyle = isDark ? '#86efac' : '#6b8f71';
                ctx.fill();

                // Arrow head
                const adx = d.cx - d.sx, ady = d.cy - d.sy;
                const len = Math.sqrt(adx * adx + ady * ady);
                if (len > 10) {
                    const ux = adx / len, uy = ady / len;
                    ctx.beginPath();
                    ctx.moveTo(d.cx, d.cy);
                    ctx.lineTo(d.cx - ux * 10 + uy * 5, d.cy - uy * 10 - ux * 5);
                    ctx.lineTo(d.cx - ux * 10 - uy * 5, d.cy - uy * 10 + ux * 5);
                    ctx.fillStyle = isDark ? '#e8e4de' : '#5c544a';
                    ctx.fill();
                }
            }

            // Info HUD
            ctx.font = '11px JetBrains Mono, monospace';
            ctx.fillStyle = isDark ? '#6b6358' : '#9c9488';
            ctx.textAlign = 'left';
            ctx.fillText(`Bodies: ${bodies.length}`, 16, 24);
            ctx.fillText(`G = ${G}`, 16, 40);

            animRef.current = requestAnimationFrame(loop);
        };

        animRef.current = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(animRef.current);
    }, []);

    const toLogical = (e: React.MouseEvent | React.TouchEvent) => {
        const rect = canvasRef.current!.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
        return { x: (clientX - rect.left) * 800 / rect.width, y: (clientY - rect.top) * 600 / rect.height };
    };

    const handleDown = (e: React.MouseEvent | React.TouchEvent) => {
        const p = toLogical(e);
        dragRef.current = { active: true, sx: p.x, sy: p.y, cx: p.x, cy: p.y };
    };
    const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!dragRef.current.active) return;
        const p = toLogical(e);
        dragRef.current.cx = p.x;
        dragRef.current.cy = p.y;
    };
    const handleUp = () => {
        const d = dragRef.current;
        if (!d.active) return;
        d.active = false;
        const dx = d.sx - d.cx, dy = d.sy - d.cy;
        const colors = ['#3b82f6', '#86efac', '#c2714f', '#f59e0b', '#a78bfa', '#f472b6'];
        bodiesRef.current.push({
            x: d.sx, y: d.sy,
            vx: dx * 0.05, vy: dy * 0.05,
            mass: 10, radius: 6,
            color: colors[bodiesRef.current.length % colors.length],
            isStatic: false, trail: [],
        });
        forceRender(n => n + 1);
    };

    const resetSim = () => {
        bodiesRef.current = structuredClone(DEFAULT_BODIES);
        forceRender(n => n + 1);
    };

    return (
        <div className="tool-card orbital-mechanics">
            <div className="tool-card-header">
                <h3>Orbital Gravity Simulator</h3>
                <span className="subject-topic" style={{ background: 'var(--amber-soft)', color: 'var(--amber)' }}>Astrophysics</span>
            </div>

            <div className="tool-card-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
                        <strong>Click and drag</strong> to launch a satellite. Length = speed, direction = velocity.
                    </p>
                    <button className="tool-btn tool-btn--outline" onClick={resetSim}>Clear Satellites</button>
                </div>

                <div style={{
                    width: '100%', aspectRatio: '8/6', maxHeight: 260,
                    background: 'var(--bg-secondary)', border: '1px solid var(--border-warm)',
                    borderRadius: 'var(--radius-md)', overflow: 'hidden',
                }}>
                    <canvas
                        ref={canvasRef}
                        style={{ display: 'block', touchAction: 'none', cursor: 'crosshair' }}
                        onMouseDown={handleDown} onMouseMove={handleMove}
                        onMouseUp={handleUp} onMouseOut={handleUp}
                        onTouchStart={handleDown} onTouchMove={handleMove} onTouchEnd={handleUp}
                    />
                </div>
            </div>
        </div>
    );
}
