import { useRef, useEffect, useState } from 'react';

interface Charge { x: number; y: number; q: number; }

export default function ElectricField() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [charges, setCharges] = useState<Charge[]>([
        { x: 0.35, y: 0.5, q: 1 },
        { x: 0.65, y: 0.5, q: -1 },
    ]);
    const [addMode, setAddMode] = useState<'+' | '-'>('+');
    const dragRef = useRef<number | null>(null);

    const redraw = () => {
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

        ctx.fillStyle = isDark ? '#1a1612' : '#faf8f5';
        ctx.fillRect(0, 0, W, H);

        // Compute field at a point
        const field = (px: number, py: number) => {
            let ex = 0, ey = 0;
            for (const c of charges) {
                const dx = px - c.x * W, dy = py - c.y * H;
                const r2 = dx * dx + dy * dy;
                if (r2 < 100) continue;
                const r = Math.sqrt(r2);
                const e = (c.q * 5000) / r2;
                ex += e * dx / r; ey += e * dy / r;
            }
            return { ex, ey };
        };

        // Field lines
        const lineColors = isDark ? ['rgba(245,158,11,0.4)', 'rgba(107,143,113,0.4)'] : ['rgba(217,119,6,0.3)', 'rgba(107,143,113,0.3)'];

        for (const charge of charges) {
            if (charge.q <= 0) continue;
            const numLines = 12;
            for (let i = 0; i < numLines; i++) {
                const theta = (2 * Math.PI * i) / numLines;
                let px = charge.x * W + 15 * Math.cos(theta);
                let py = charge.y * H + 15 * Math.sin(theta);

                ctx.strokeStyle = lineColors[0];
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                ctx.moveTo(px, py);

                for (let step = 0; step < 300; step++) {
                    const { ex, ey } = field(px, py);
                    const mag = Math.sqrt(ex * ex + ey * ey);
                    if (mag < 0.01) break;
                    const stepSize = 3;
                    px += (ex / mag) * stepSize;
                    py += (ey / mag) * stepSize;
                    if (px < 0 || px > W || py < 0 || py > H) break;
                    ctx.lineTo(px, py);

                    // Check if near a negative charge
                    let nearNeg = false;
                    for (const c of charges) {
                        if (c.q < 0) {
                            const d = Math.sqrt((px - c.x * W) ** 2 + (py - c.y * H) ** 2);
                            if (d < 14) { nearNeg = true; break; }
                        }
                    }
                    if (nearNeg) break;
                }
                ctx.stroke();
            }
        }

        // Equipotential (simple grid-based coloring)
        const res = 6;
        for (let gx = 0; gx < W; gx += res) {
            for (let gy = 0; gy < H; gy += res) {
                let potential = 0;
                for (const c of charges) {
                    const dx = gx - c.x * W, dy = gy - c.y * H;
                    const r = Math.sqrt(dx * dx + dy * dy);
                    if (r < 5) { potential = 0; continue; }
                    potential += c.q * 100 / r;
                }
                const clamp = Math.max(-1, Math.min(1, potential * 0.3));
                if (Math.abs(clamp) > 0.02) {
                    ctx.fillStyle = clamp > 0
                        ? `rgba(239, 68, 68, ${Math.abs(clamp) * 0.06})`
                        : `rgba(59, 130, 246, ${Math.abs(clamp) * 0.06})`;
                    ctx.fillRect(gx, gy, res, res);
                }
            }
        }

        // Draw charges
        for (const c of charges) {
            const cx = c.x * W, cy = c.y * H;
            const grad = ctx.createRadialGradient(cx - 3, cy - 3, 2, cx, cy, 18);
            if (c.q > 0) {
                grad.addColorStop(0, '#ff6b6b');
                grad.addColorStop(1, '#ef4444');
            } else {
                grad.addColorStop(0, '#60a5fa');
                grad.addColorStop(1, '#3b82f6');
            }
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(cx, cy, 14, 0, Math.PI * 2);
            ctx.fill();

            // +/- label
            ctx.fillStyle = 'white';
            ctx.font = 'bold 16px Sora, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(c.q > 0 ? '+' : '−', cx, cy);
        }
        ctx.textBaseline = 'alphabetic';
    };

    useEffect(() => { redraw(); }, [charges]);

    const handleMouseDown = (e: React.MouseEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left) / rect.width;
        const my = (e.clientY - rect.top) / rect.height;

        // Check if clicking existing charge
        for (let i = 0; i < charges.length; i++) {
            const dx = mx - charges[i].x, dy = my - charges[i].y;
            if (Math.sqrt(dx * dx + dy * dy) < 0.04) {
                dragRef.current = i;
                return;
            }
        }

        // Add new charge
        setCharges(prev => [...prev, { x: mx, y: my, q: addMode === '+' ? 1 : -1 }]);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (dragRef.current === null) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left) / rect.width;
        const my = (e.clientY - rect.top) / rect.height;
        setCharges(prev => prev.map((c, i) => i === dragRef.current ? { ...c, x: mx, y: my } : c));
    };

    const handleMouseUp = () => { dragRef.current = null; };

    return (
        <div className="tool-card">
            <div className="tool-card-header">
                <h3>Electric Field Visualizer</h3>
                <span className="subject-topic" style={{ background: 'var(--sage-glow)', color: 'var(--sage)' }}>Electromagnetism</span>
            </div>
            <div className="tool-card-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>
                        <strong>Click</strong> to add charges. <strong>Drag</strong> to move them.
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className={`tool-btn ${addMode === '+' ? '' : 'tool-btn--outline'}`}
                            onClick={() => setAddMode('+')} style={{ minWidth: 40, fontSize: '1.2rem' }}>+</button>
                        <button className={`tool-btn ${addMode === '-' ? '' : 'tool-btn--outline'}`}
                            onClick={() => setAddMode('-')} style={{ minWidth: 40, fontSize: '1.2rem' }}>−</button>
                        <button className="tool-btn tool-btn--outline"
                            onClick={() => setCharges([])}>Clear</button>
                    </div>
                </div>

                <div style={{ width: '100%', aspectRatio: '16/9', background: 'var(--bg-primary)', border: '1px solid var(--border-warm)', borderRadius: 'var(--radius-md)', overflow: 'hidden', cursor: 'crosshair' }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                >
                    <canvas ref={canvasRef} style={{ display: 'block' }} />
                </div>
            </div>
        </div>
    );
}
