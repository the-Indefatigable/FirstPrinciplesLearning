import { useRef, useEffect, useState } from 'react';
import * as math from 'mathjs';

export default function TaylorSeries() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [fn, setFn] = useState('sin(x)');
    const [center, setCenter] = useState(0);
    const [terms, setTerms] = useState(4);
    const [error, setError] = useState<string | null>(null);

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
            catch { return NaN; }
        };

        // Compute Taylor coefficients via numerical differentiation
        const h = 1e-5;
        const derivAtCenter: number[] = [f(center)];
        let prevDeriv = (x: number) => f(x);

        for (let k = 1; k <= terms; k++) {
            const prev = prevDeriv;
            const dfdx = (x: number) => (prev(x + h) - prev(x - h)) / (2 * h);
            derivAtCenter.push(dfdx(center));
            prevDeriv = dfdx;
        }

        const taylor = (x: number) => {
            let sum = 0;
            let fact = 1;
            for (let k = 0; k <= terms; k++) {
                if (k > 0) fact *= k;
                sum += (derivAtCenter[k] / fact) * Math.pow(x - center, k);
            }
            return sum;
        };

        // View window
        const xMin = center - 8, xMax = center + 8;
        let yMin = -4, yMax = 4;

        // Auto scale Y
        for (let i = 0; i <= 100; i++) {
            const x = xMin + (xMax - xMin) * (i / 100);
            const y = f(x);
            if (isFinite(y)) {
                yMin = Math.min(yMin, y - 1);
                yMax = Math.max(yMax, y + 1);
            }
        }

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

        // Draw partial sums from 0 to N (faded)
        const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];
        for (let order = 0; order <= terms; order++) {
            const partialTaylor = (x: number) => {
                let sum = 0, fact = 1;
                for (let k = 0; k <= order; k++) {
                    if (k > 0) fact *= k;
                    sum += (derivAtCenter[k] / fact) * Math.pow(x - center, k);
                }
                return sum;
            };

            ctx.strokeStyle = colors[order % colors.length];
            ctx.lineWidth = order === terms ? 2.5 : 1;
            ctx.globalAlpha = order === terms ? 1 : 0.3;
            ctx.beginPath();
            let started = false;
            for (let i = 0; i <= 400; i++) {
                const x = xMin + (xMax - xMin) * (i / 400);
                const y = partialTaylor(x);
                if (!isFinite(y) || y < yMin - 5 || y > yMax + 5) { started = false; continue; }
                if (!started) { ctx.moveTo(toX(x), toY(y)); started = true; }
                else ctx.lineTo(toX(x), toY(y));
            }
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // Original function
        ctx.strokeStyle = isDark ? '#f59e0b' : '#d97706';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        let started = false;
        for (let i = 0; i <= 400; i++) {
            const x = xMin + (xMax - xMin) * (i / 400);
            const y = f(x);
            if (!isFinite(y)) { started = false; continue; }
            if (!started) { ctx.moveTo(toX(x), toY(y)); started = true; }
            else ctx.lineTo(toX(x), toY(y));
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Center point
        ctx.fillStyle = isDark ? '#86efac' : '#6b8f71';
        ctx.beginPath();
        ctx.arc(toX(center), toY(f(center)), 5, 0, Math.PI * 2);
        ctx.fill();

        // Legend
        ctx.font = '11px Sora, sans-serif';
        ctx.fillStyle = isDark ? '#e8e4de' : '#1a1612';
        ctx.textAlign = 'left';
        ctx.fillText(`f(x) = ${fn}`, 12, 20);
        ctx.fillStyle = colors[terms % colors.length];
        ctx.fillText(`T${terms}(x) — ${terms + 1} terms`, 12, 36);

    }, [fn, center, terms]);

    return (
        <div className="tool-card">
            <div className="tool-card-header">
                <h3>Taylor Series Explorer</h3>
                <span className="subject-topic" style={{ background: 'var(--amber-soft)', color: 'var(--amber)' }}>Calculus</span>
            </div>
            <div className="tool-card-body">
                <div className="tool-controls-row tool-controls-row--3">
                    <div className="tool-input-group">
                        <label>f(x) =</label>
                        <input className="tool-input" value={fn} onChange={e => setFn(e.target.value)} />
                        {error && <div style={{ color: 'var(--terracotta)', fontSize: '0.8rem', marginTop: 4 }}>{error}</div>}
                    </div>
                    <div className="tool-input-group">
                        <label>Center (a)</label>
                        <input className="tool-input" type="number" value={center} onChange={e => setCenter(+e.target.value)} />
                    </div>
                    <div className="tool-input-group">
                        <label>Terms: {terms + 1}</label>
                        <input type="range" min={0} max={12} value={terms} onChange={e => setTerms(+e.target.value)}
                            style={{ width: '100%', accentColor: 'var(--amber)' }} />
                    </div>
                </div>

                <div style={{ width: '100%', aspectRatio: '16/9', background: 'var(--bg-primary)', border: '1px solid var(--border-warm)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                    <canvas ref={canvasRef} style={{ display: 'block' }} />
                </div>

                <p style={{ margin: '12px 0 0', fontSize: '0.82rem', color: 'var(--text-dim)' }}>
                    Dashed amber = original f(x). Colored lines = partial Taylor sums building up. Green dot = expansion center.
                </p>
            </div>
        </div>
    );
}
