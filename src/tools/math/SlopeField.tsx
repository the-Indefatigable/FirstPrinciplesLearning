import React, { useRef, useEffect, useState } from 'react';
import * as math from 'mathjs';
import { drawBackground, drawGlowCurve, drawGlowDot, MANIM, type CurvePoint } from '../../utils/manimCanvas';
import { useUrlState } from '../../hooks/useUrlState';

interface Particle {
    x: number;
    y: number;
    path: { x: number, y: number }[];
    color: string;
}

const COLORS = MANIM.palette;

export default function SlopeField() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [urlState, setUrlState] = useUrlState('sf', { equation: 'sin(x) + cos(y)', bounds: 10, density: 20 });
    const { equation, bounds, density } = urlState;
    const setEquation = (v: string) => setUrlState(s => ({ ...s, equation: v }));
    const setBounds   = (v: number) => setUrlState(s => ({ ...s, bounds: v }));
    const setDensity  = (v: number) => setUrlState(s => ({ ...s, density: v }));
    const [particles, setParticles] = useState<Particle[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isDarkMode] = useState(false); // kept for API compat but always manim dark

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Setup HDPI canvas
        const rect = canvas.parentElement?.getBoundingClientRect();
        if (!rect) return;

        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;

        const width = rect.width;
        const height = rect.height;

        // Clear + Manim background
        drawBackground(ctx, width, height);

        const axisColor = 'rgba(200, 210, 225, 0.35)';
        const arrowColor = 'rgba(88, 196, 221, 0.35)';

        // Math prep
        let compiled: math.EvalFunction;
        try {
            compiled = math.compile(equation);
            setError(null);
        } catch (e: any) {
            setError(e.message || 'Invalid equation');
            return;
        }

        // Coordinate transforms
        const toScreenX = (x: number) => (x + bounds) / (2 * bounds) * width;
        const toScreenY = (y: number) => height - (y + bounds) / (2 * bounds) * height;

        // Draw Axes with glow
        ctx.save(); ctx.strokeStyle = 'rgba(200, 210, 225, 0.08)'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(toScreenX(0), 0); ctx.lineTo(toScreenX(0), height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, toScreenY(0)); ctx.lineTo(width, toScreenY(0)); ctx.stroke();
        ctx.restore();
        ctx.strokeStyle = axisColor;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(toScreenX(0), 0); ctx.lineTo(toScreenX(0), height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, toScreenY(0)); ctx.lineTo(width, toScreenY(0)); ctx.stroke();

        // Draw Slope Field
        const step = (2 * bounds) / density;
        const arrowLenScreen = (width / density) * 0.6; // Length of the line segments in pixels

        ctx.strokeStyle = arrowColor;
        ctx.lineWidth = 1.5;

        for (let x = -bounds; x <= bounds; x += step) {
            for (let y = -bounds; y <= bounds; y += step) {
                try {
                    const slope = compiled.evaluate({ x, y, e: Math.E, pi: Math.PI });
                    if (!isFinite(slope)) continue;

                    // Normalize the slope vector (1, slope)
                    const mag = Math.sqrt(1 + slope * slope);
                    const dx = 1 / mag;
                    const dy = slope / mag;

                    const sx = toScreenX(x);
                    const sy = toScreenY(y);

                    // We want to draw a line segment centered at (sx, sy)
                    // The screen dy needs to be inverted because Y goes down on screen

                    // dx/dy in math coordinates.
                    // Scale them to screen pixels. 
                    const p1x = sx - dx * (arrowLenScreen / 2);
                    const p1y = sy + dy * (arrowLenScreen / 2); // invert Y
                    const p2x = sx + dx * (arrowLenScreen / 2);
                    const p2y = sy - dy * (arrowLenScreen / 2); // invert Y

                    ctx.beginPath();
                    ctx.moveTo(p1x, p1y);
                    ctx.lineTo(p2x, p2y);
                    ctx.stroke();

                } catch (e) {
                    // Ignore math errors for specific domain failures (like log(-1))
                }
            }
        }

        // Draw Particles (Traces) with glow
        particles.forEach(p => {
            if (p.path.length < 2) return;
            const tracePoints: CurvePoint[] = p.path.map(pt => ({ x: toScreenX(pt.x), y: toScreenY(pt.y) }));
            drawGlowCurve(ctx, tracePoints, p.color);

            // Draw dot at origin
            drawGlowDot(ctx, toScreenX(p.x), toScreenY(p.y), p.color, { radius: 4 });
        });

    }, [equation, bounds, density, particles, isDarkMode]);

    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        const mathX = (clickX / rect.width) * (2 * bounds) - bounds;
        const mathY = bounds - (clickY / rect.height) * (2 * bounds);

        // RK4 Integration to generate path
        let compiled: math.EvalFunction;
        try {
            compiled = math.compile(equation);
        } catch {
            return;
        }

        const path = [{ x: mathX, y: mathY }];
        let currentX = mathX;
        let currentY = mathY;
        const h = 0.05; // Timestep

        // Forward integration
        for (let i = 0; i < 400; i++) {
            try {
                const f_xy = (x: number, y: number) => Number(compiled.evaluate({ x, y, e: Math.E, pi: Math.PI }));

                const k1 = f_xy(currentX, currentY);
                const k2 = f_xy(currentX + h / 2, currentY + (h / 2) * k1);
                const k3 = f_xy(currentX + h / 2, currentY + (h / 2) * k2);
                const k4 = f_xy(currentX + h, currentY + h * k3);

                const nextY = currentY + (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
                const nextX = currentX + h;

                if (!isFinite(nextY) || Math.abs(nextY) > bounds * 2 || Math.abs(nextX) > bounds * 2) break;

                path.push({ x: nextX, y: nextY });
                currentX = nextX;
                currentY = nextY;
            } catch {
                break; // Domain error
            }
        }

        const newParticle: Particle = {
            x: mathX,
            y: mathY,
            path: path,
            color: COLORS[particles.length % COLORS.length]
        };

        setParticles([...particles, newParticle]);
    };

    return (
        <div className="tool-card slope-field">
            <div className="tool-card-header">
                <h3>Slope Field Visualizer</h3>
                <span className="subject-topic" style={{ background: 'var(--amber-soft)', color: 'var(--amber)' }}>dy/dx = f(x,y)</span>
            </div>

            <div className="tool-card-body">
                <div className="tool-controls-row tool-controls-row--3">
                    <div className="tool-input-group">
                        <label>Differential Equation: dy/dx =</label>
                        <input
                            type="text"
                            className="tool-input"
                            value={equation}
                            onChange={(e) => { setEquation(e.target.value); setParticles([]); }}
                            placeholder="e.g. sin(x) + cos(y)"
                        />
                        {error && <div style={{ color: 'var(--terracotta)', fontSize: '0.8rem', marginTop: '6px' }}>{error}</div>}
                    </div>
                    <div className="tool-input-group">
                        <label>Bounds (±)</label>
                        <input
                            type="number"
                            className="tool-input"
                            value={bounds}
                            min={1}
                            max={50}
                            onChange={(e) => { setBounds(Number(e.target.value)); setParticles([]); }}
                        />
                    </div>
                    <div className="tool-input-group">
                        <label>Grid Density</label>
                        <input
                            type="number"
                            className="tool-input"
                            value={density}
                            min={10}
                            max={50}
                            step={2}
                            onChange={(e) => { setDensity(Number(e.target.value)); }}
                        />
                    </div>
                </div>

                <div
                    style={{
                        width: '100%',
                        position: 'relative',
                        background: '#0f1117',
                        border: '1px solid rgba(88, 196, 221, 0.1)',
                        borderRadius: 'var(--radius-md)',
                        overflow: 'hidden',
                        boxShadow: '0 0 40px rgba(88, 196, 221, 0.03), inset 0 0 60px rgba(15, 17, 23, 0.5)',
                    }}
                >
                    <div style={{ position: 'absolute', top: 12, left: 16, zIndex: 10, pointerEvents: 'none' }}>
                        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                            Click map to drop trace particles
                        </p>
                    </div>
                    <div style={{ position: 'absolute', top: 12, right: 16, zIndex: 10 }}>
                        <button
                            className="tool-btn tool-btn--outline"
                            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                            onClick={() => setParticles([])}
                        >
                            Clear Particles
                        </button>
                    </div>
                    <div style={{ width: '100%', aspectRatio: '16/9' }}>
                        <canvas
                            ref={canvasRef}
                            onClick={handleCanvasClick}
                            style={{ cursor: 'crosshair', display: 'block' }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
