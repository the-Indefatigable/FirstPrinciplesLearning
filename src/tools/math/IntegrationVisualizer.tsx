import { useRef, useEffect, useState } from 'react';
import * as math from 'mathjs';

type Method = 'left' | 'right' | 'midpoint' | 'trapezoid';

export default function IntegrationVisualizer() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [fn, setFn] = useState('x^2');
    const [a, setA] = useState(0);
    const [b, setB] = useState(3);
    const [n, setN] = useState(6);
    const [method, setMethod] = useState<Method>('left');
    const [error, setError] = useState<string | null>(null);
    const [approxArea, setApproxArea] = useState(0);

    useEffect(() => {
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

        let compiled: math.EvalFunction;
        try {
            compiled = math.compile(fn);
            setError(null);
        } catch {
            setError('Invalid function');
            return;
        }

        const f = (x: number) => {
            try { return Number(compiled.evaluate({ x, e: Math.E, pi: Math.PI })); }
            catch { return 0; }
        };

        // Determine visible range with padding
        const pad = (b - a) * 0.3;
        const xMin = a - pad, xMax = b + pad;
        let yMin = Infinity, yMax = -Infinity;
        for (let i = 0; i <= 200; i++) {
            const x = xMin + (xMax - xMin) * (i / 200);
            const y = f(x);
            if (isFinite(y)) { yMin = Math.min(yMin, y); yMax = Math.max(yMax, y); }
        }
        const yPad = (yMax - yMin) * 0.2 || 1;
        yMin -= yPad; yMax += yPad;
        if (yMin > 0) yMin = -0.5;

        const toX = (x: number) => ((x - xMin) / (xMax - xMin)) * W;
        const toY = (y: number) => H - ((y - yMin) / (yMax - yMin)) * H;

        // Clear
        ctx.clearRect(0, 0, W, H);

        // Grid
        ctx.strokeStyle = isDark ? '#2e2a24' : '#e8e0d4';
        ctx.lineWidth = 0.5;
        for (let x = Math.ceil(xMin); x <= xMax; x++) {
            ctx.beginPath(); ctx.moveTo(toX(x), 0); ctx.lineTo(toX(x), H); ctx.stroke();
        }
        for (let y = Math.ceil(yMin); y <= yMax; y++) {
            ctx.beginPath(); ctx.moveTo(0, toY(y)); ctx.lineTo(W, toY(y)); ctx.stroke();
        }

        // Axes
        ctx.strokeStyle = isDark ? '#6b6358' : '#9c9488';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, toY(0)); ctx.lineTo(W, toY(0)); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(toX(0), 0); ctx.lineTo(toX(0), H); ctx.stroke();

        // Rectangles / Trapezoids
        const dx = (b - a) / n;
        let totalArea = 0;
        ctx.fillStyle = isDark ? 'rgba(245,158,11,0.2)' : 'rgba(217,119,6,0.15)';
        ctx.strokeStyle = isDark ? 'rgba(245,158,11,0.5)' : 'rgba(217,119,6,0.4)';
        ctx.lineWidth = 1;

        for (let i = 0; i < n; i++) {
            const x0 = a + i * dx;
            const x1 = x0 + dx;

            if (method === 'trapezoid') {
                const y0 = f(x0), y1 = f(x1);
                totalArea += (y0 + y1) * dx / 2;
                ctx.beginPath();
                ctx.moveTo(toX(x0), toY(0));
                ctx.lineTo(toX(x0), toY(y0));
                ctx.lineTo(toX(x1), toY(y1));
                ctx.lineTo(toX(x1), toY(0));
                ctx.closePath();
                ctx.fill(); ctx.stroke();
            } else {
                let sampleX = x0;
                if (method === 'right') sampleX = x1;
                else if (method === 'midpoint') sampleX = (x0 + x1) / 2;
                const h = f(sampleX);
                totalArea += h * dx;
                ctx.fillRect(toX(x0), toY(Math.max(h, 0)), toX(x1) - toX(x0), Math.abs(toY(h) - toY(0)));
                ctx.strokeRect(toX(x0), toY(Math.max(h, 0)), toX(x1) - toX(x0), Math.abs(toY(h) - toY(0)));
            }
        }
        setApproxArea(Math.round(totalArea * 10000) / 10000);

        // Function curve
        ctx.strokeStyle = isDark ? '#f59e0b' : '#d97706';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let i = 0; i <= 300; i++) {
            const x = xMin + (xMax - xMin) * (i / 300);
            const y = f(x);
            if (!isFinite(y)) continue;
            i === 0 ? ctx.moveTo(toX(x), toY(y)) : ctx.lineTo(toX(x), toY(y));
        }
        ctx.stroke();

        // Bound markers
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = isDark ? '#86efac' : '#6b8f71';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(toX(a), 0); ctx.lineTo(toX(a), H); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(toX(b), 0); ctx.lineTo(toX(b), H); ctx.stroke();
        ctx.setLineDash([]);

        // Labels
        ctx.font = '12px Sora, sans-serif';
        ctx.fillStyle = isDark ? '#86efac' : '#6b8f71';
        ctx.textAlign = 'center';
        ctx.fillText(`a = ${a}`, toX(a), H - 8);
        ctx.fillText(`b = ${b}`, toX(b), H - 8);

    }, [fn, a, b, n, method]);

    return (
        <div className="tool-card">
            <div className="tool-card-header">
                <h3>Integration Visualizer</h3>
                <span className="subject-topic" style={{ background: 'var(--amber-soft)', color: 'var(--amber)' }}>Calculus</span>
            </div>
            <div className="tool-card-body">
                <div className="tool-controls-row tool-controls-row--4">
                    <div className="tool-input-group">
                        <label>f(x) =</label>
                        <input className="tool-input" value={fn} onChange={e => setFn(e.target.value)} />
                        {error && <div style={{ color: 'var(--terracotta)', fontSize: '0.8rem', marginTop: 4 }}>{error}</div>}
                    </div>
                    <div className="tool-input-group">
                        <label>Lower bound (a)</label>
                        <input className="tool-input" type="number" value={a} onChange={e => setA(+e.target.value)} />
                    </div>
                    <div className="tool-input-group">
                        <label>Upper bound (b)</label>
                        <input className="tool-input" type="number" value={b} onChange={e => setB(+e.target.value)} />
                    </div>
                    <div className="tool-input-group">
                        <label>Method</label>
                        <select className="tool-input" value={method} onChange={e => setMethod(e.target.value as Method)}>
                            <option value="left">Left Riemann</option>
                            <option value="right">Right Riemann</option>
                            <option value="midpoint">Midpoint</option>
                            <option value="trapezoid">Trapezoid</option>
                        </select>
                    </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Rectangles (N = {n})
                    </label>
                    <input type="range" min={1} max={100} value={n} onChange={e => setN(+e.target.value)}
                        style={{ width: '100%', accentColor: 'var(--amber)' }} />
                </div>

                <div style={{ marginBottom: 16, padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Approximate Area:</span>
                    <span style={{ color: 'var(--amber)', fontWeight: 700, fontFamily: 'monospace', fontSize: '1.1rem' }}>{approxArea}</span>
                </div>

                <div style={{ width: '100%', aspectRatio: '16/9', background: 'var(--bg-primary)', border: '1px solid var(--border-warm)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                    <canvas ref={canvasRef} style={{ display: 'block' }} />
                </div>
            </div>
        </div>
    );
}
