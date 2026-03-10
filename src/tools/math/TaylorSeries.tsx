import { useRef, useEffect, useState, useCallback, lazy, Suspense } from 'react';
import * as math from 'mathjs';
import { drawBackground, drawGlowCurve, drawGlowDot, MANIM, type CurvePoint } from '../../utils/manimCanvas';
import ImmersiveToggle from '../../components/ImmersiveToggle';
import '../../components/ImmersiveToggle.css';

const TaylorSeriesImmersive = lazy(() => import('./TaylorSeriesImmersive'));

export default function TaylorSeries() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [fn, setFn] = useState('sin(x)');
    const [center, setCenter] = useState(0);
    const [terms, setTerms] = useState(4);
    const [error, setError] = useState<string | null>(null);

    // Immersive mode state
    const [immersive, setImmersive] = useState(false);
    const [immersiveLoading, setImmersiveLoading] = useState(false);

    const handleToggleImmersive = useCallback(() => {
        if (!immersive) {
            setImmersiveLoading(true);
            setImmersive(true);
        } else {
            setImmersive(false);
        }
    }, [immersive]);

    const handleImmersiveLoaded = useCallback(() => {
        setImmersiveLoading(false);
    }, []);

    useEffect(() => {
        if (immersive) return;
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

        // Clear + Manim background
        drawBackground(ctx, W, H);

        // Grid
        ctx.strokeStyle = 'rgba(88, 196, 221, 0.07)';
        ctx.lineWidth = 0.5;
        for (let x = Math.ceil(xMin); x <= xMax; x++) {
            ctx.beginPath(); ctx.moveTo(toX(x), 0); ctx.lineTo(toX(x), H); ctx.stroke();
        }
        for (let y = Math.ceil(yMin); y <= yMax; y++) {
            ctx.beginPath(); ctx.moveTo(0, toY(y)); ctx.lineTo(W, toY(y)); ctx.stroke();
        }

        // Axes with glow
        ctx.save(); ctx.strokeStyle = 'rgba(200, 210, 225, 0.08)'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(0, toY(0)); ctx.lineTo(W, toY(0)); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(toX(0), 0); ctx.lineTo(toX(0), H); ctx.stroke();
        ctx.restore();
        ctx.strokeStyle = 'rgba(200, 210, 225, 0.35)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, toY(0)); ctx.lineTo(W, toY(0)); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(toX(0), 0); ctx.lineTo(toX(0), H); ctx.stroke();

        // Draw partial sums with glow
        for (let order = 0; order <= terms; order++) {
            const partialTaylor = (x: number) => {
                let sum = 0, fact = 1;
                for (let k = 0; k <= order; k++) {
                    if (k > 0) fact *= k;
                    sum += (derivAtCenter[k] / fact) * Math.pow(x - center, k);
                }
                return sum;
            };

            const points: CurvePoint[] = [];
            for (let i = 0; i <= 600; i++) {
                const x = xMin + (xMax - xMin) * (i / 600);
                const y = partialTaylor(x);
                if (!isFinite(y) || y < yMin - 5 || y > yMax + 5) { points.push({ x: toX(x), y: NaN }); continue; }
                points.push({ x: toX(x), y: toY(y) });
            }

            const color = MANIM.palette[order % MANIM.palette.length];
            if (order === terms) {
                drawGlowCurve(ctx, points, color);
            } else {
                // Faded older terms
                ctx.save();
                ctx.globalAlpha = 0.25;
                drawGlowCurve(ctx, points, color, { glowIntensity: 0.3 });
                ctx.restore();
            }
        }

        // Original function (dashed glow)
        const origPoints: CurvePoint[] = [];
        for (let i = 0; i <= 600; i++) {
            const x = xMin + (xMax - xMin) * (i / 600);
            const y = f(x);
            if (!isFinite(y)) { origPoints.push({ x: toX(x), y: NaN }); continue; }
            origPoints.push({ x: toX(x), y: toY(y) });
        }
        drawGlowCurve(ctx, origPoints, '#F4D03F', { dashed: true });

        // Center point (glowing dot)
        drawGlowDot(ctx, toX(center), toY(f(center)), '#83C167', { radius: 5 });

        // Legend
        ctx.font = '11px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#F4D03F';
        ctx.fillText(`f(x) = ${fn}`, 12, 20);
        ctx.fillStyle = MANIM.palette[terms % MANIM.palette.length];
        ctx.fillText(`T${terms}(x) — ${terms + 1} terms`, 12, 36);

    }, [fn, center, terms, immersive]);

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

                <div
                    ref={containerRef}
                    style={{
                        width: '100%', aspectRatio: '16/9',
                        background: '#0f1117', border: '1px solid rgba(88, 196, 221, 0.1)',
                        borderRadius: 'var(--radius-md)', overflow: 'hidden',
                        boxShadow: '0 0 40px rgba(88, 196, 221, 0.03), inset 0 0 60px rgba(15, 17, 23, 0.5)',
                        position: 'relative',
                    }}
                >
                    <ImmersiveToggle
                        active={immersive}
                        onToggle={handleToggleImmersive}
                        loading={immersiveLoading}
                    />

                    {!immersive && (
                        <canvas ref={canvasRef} style={{ display: 'block' }} />
                    )}

                    {immersive && (
                        <Suspense fallback={
                            <div style={{
                                width: '100%', height: '100%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: '#0f1117', color: '#58C4DD',
                                fontSize: '0.9rem', fontFamily: 'var(--font-sans)',
                            }}>
                                Loading Immersive Mode...
                            </div>
                        }>
                            <ImmersiveLoadWrapper onLoaded={handleImmersiveLoaded}>
                                <TaylorSeriesImmersive
                                    fn={fn}
                                    center={center}
                                    terms={terms}
                                />
                            </ImmersiveLoadWrapper>
                        </Suspense>
                    )}
                </div>

                <p style={{ margin: '12px 0 0', fontSize: '0.82rem', color: 'var(--text-dim)' }}>
                    Dashed amber = original f(x). Colored lines = partial Taylor sums building up. Green dot = expansion center.
                </p>
            </div>
        </div>
    );
}

/** Tiny wrapper that calls onLoaded when the lazy component mounts */
function ImmersiveLoadWrapper({ children, onLoaded }: { children: React.ReactNode; onLoaded: () => void }) {
    useEffect(() => { onLoaded(); }, [onLoaded]);
    return <>{children}</>;
}
