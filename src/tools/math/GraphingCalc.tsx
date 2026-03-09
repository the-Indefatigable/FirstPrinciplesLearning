import { useRef, useEffect, useState, useCallback, lazy, Suspense } from 'react';
import { compile } from 'mathjs';
import {
    MANIM, drawScene, drawGlowCurve, drawCrosshair, drawLabel,
    drawGlowDot, type CurvePoint
} from '../../utils/manimCanvas';
import ImmersiveToggle from '../../components/ImmersiveToggle';
import '../../components/ImmersiveToggle.css';

// Lazy-load the WebGL immersive renderer — only downloaded when user activates it
const GraphingCalcImmersive = lazy(() => import('./GraphingCalcImmersive'));

interface FnEntry { expr: string; color: string; enabled: boolean; }

export default function GraphingCalc() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [functions, setFunctions] = useState<FnEntry[]>([
        { expr: 'sin(x)', color: MANIM.palette[0], enabled: true },
        { expr: '', color: MANIM.palette[1], enabled: true },
    ]);
    const [center] = useState({ x: 0, y: 0 });
    const [scale, setScale] = useState(50);
    const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

    // Immersive mode state
    const [immersive, setImmersive] = useState(false);
    const [immersiveLoading, setImmersiveLoading] = useState(false);

    const handleToggleImmersive = useCallback(() => {
        if (!immersive) {
            setImmersiveLoading(true);
            // The lazy import will resolve, then we switch
            setImmersive(true);
        } else {
            setImmersive(false);
        }
    }, [immersive]);

    const handleImmersiveLoaded = useCallback(() => {
        setImmersiveLoading(false);
    }, []);

    // ── Canvas 2D Drawing (standard mode) ──
    const draw = useCallback(() => {
        if (immersive) return; // Skip when in immersive mode
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const W = canvas.width / dpr;
        const H = canvas.height / dpr;
        const cx = W / 2 + center.x * scale;
        const cy = H / 2 - center.y * scale;

        ctx.save();
        ctx.scale(dpr, dpr);

        drawScene(ctx, W, H, cx, cy, scale);

        for (const fn of functions) {
            if (!fn.enabled || !fn.expr.trim()) continue;
            try {
                const compiled = compile(fn.expr);
                const points: CurvePoint[] = [];

                for (let px = 0; px < W; px += 0.5) {
                    const x = (px - cx) / scale;
                    try {
                        const y = compiled.evaluate({ x, e: Math.E, pi: Math.PI });
                        if (typeof y !== 'number' || !isFinite(y)) {
                            points.push({ x: px, y: NaN });
                            continue;
                        }
                        points.push({ x: px, y: cy - y * scale });
                    } catch { points.push({ x: px, y: NaN }); }
                }

                drawGlowCurve(ctx, points, fn.color);
            } catch { /* invalid expression */ }
        }

        if (mousePos) {
            const mx = (mousePos.x - cx) / scale;
            const my = (cy - mousePos.y) / scale;

            drawCrosshair(ctx, mousePos.x, mousePos.y, W, H);
            drawGlowDot(ctx, mousePos.x, mousePos.y, MANIM.white, { radius: 3 });
            drawLabel(ctx, `(${mx.toFixed(2)}, ${my.toFixed(2)})`, mousePos.x + 14, mousePos.y - 12, {
                color: MANIM.white, fontSize: 11, bg: true,
            });

            let labelY = mousePos.y - 28;
            for (const fn of functions) {
                if (!fn.enabled || !fn.expr.trim()) continue;
                try {
                    const compiled = compile(fn.expr);
                    const val = compiled.evaluate({ x: mx, e: Math.E, pi: Math.PI });
                    if (typeof val === 'number' && isFinite(val)) {
                        const py = cy - val * scale;
                        drawGlowDot(ctx, mousePos.x, py, fn.color, { radius: 4 });
                        drawLabel(ctx, `y = ${val.toFixed(3)}`, mousePos.x + 14, labelY, {
                            color: fn.color, fontSize: 10, bg: true,
                        });
                        labelY -= 18;
                    }
                } catch { /* skip */ }
            }
        }

        ctx.restore();
    }, [functions, center, scale, mousePos, immersive]);

    // ── Canvas resize (standard mode) ──
    useEffect(() => {
        if (immersive) return;
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const resize = () => {
            const dpr = window.devicePixelRatio || 1;
            const rect = container.getBoundingClientRect();
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            canvas.style.width = `${rect.width}px`;
            canvas.style.height = `${rect.height}px`;
            draw();
        };

        resize();
        const obs = new ResizeObserver(resize);
        obs.observe(container);
        return () => obs.disconnect();
    }, [draw, immersive]);

    // ── Mouse + Zoom handlers ──
    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }, []);

    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        setScale(prev => Math.max(10, Math.min(500, prev * (e.deltaY > 0 ? 0.9 : 1.1))));
    }, []);

    const handleImmersiveZoom = useCallback((deltaY: number) => {
        setScale(prev => Math.max(10, Math.min(500, prev * (deltaY > 0 ? 0.9 : 1.1))));
    }, []);

    const addFunction = () => {
        if (functions.length >= 7) return;
        setFunctions(prev => [...prev, { expr: '', color: MANIM.palette[prev.length % 7], enabled: true }]);
    };

    const removeFunction = (i: number) => {
        setFunctions(prev => prev.filter((_, idx) => idx !== i));
    };

    return (
        <div className="tool-card graphing-calc">
            <div className="tool-card-header">
                <h3>Graphing Calculator</h3>
                <span className="subject-topic" style={{ background: 'var(--amber-soft)', color: 'var(--amber)' }}>y = f(x)</span>
            </div>

            <div className="tool-card-body">
                {/* Function inputs */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                    {functions.map((fn, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                                width: 12, height: 12, borderRadius: '50%',
                                background: fn.color, flexShrink: 0,
                                boxShadow: `0 0 8px ${fn.color}44`,
                                cursor: 'pointer', opacity: fn.enabled ? 1 : 0.3,
                            }} onClick={() => {
                                const next = [...functions];
                                next[i] = { ...next[i], enabled: !next[i].enabled };
                                setFunctions(next);
                            }} title="Toggle" />
                            <input
                                type="text" className="tool-input"
                                value={fn.expr} placeholder={`f${i + 1}(x) = ...`}
                                style={{ fontFamily: '"JetBrains Mono", "SF Mono", monospace', fontSize: '0.88rem' }}
                                onChange={e => {
                                    const next = [...functions];
                                    next[i] = { ...next[i], expr: e.target.value };
                                    setFunctions(next);
                                }}
                            />
                            {functions.length > 1 && (
                                <button onClick={() => removeFunction(i)}
                                    style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '1rem', padding: '4px 8px' }}
                                    title="Remove">×</button>
                            )}
                        </div>
                    ))}
                    {functions.length < 7 && (
                        <button onClick={addFunction}
                            style={{
                                background: 'none', border: '1px dashed var(--border-warm)',
                                borderRadius: 'var(--radius-sm)', padding: '6px 12px',
                                color: 'var(--text-dim)', cursor: 'pointer', fontSize: '0.82rem',
                                transition: 'border-color 0.2s',
                            }}>+ Add function</button>
                    )}
                </div>

                {/* Canvas / Immersive container */}
                <div
                    ref={containerRef}
                    style={{
                        width: '100%', height: '360px',
                        borderRadius: 'var(--radius-md)', overflow: 'hidden',
                        border: '1px solid rgba(88, 196, 221, 0.1)',
                        boxShadow: '0 0 40px rgba(88, 196, 221, 0.03), inset 0 0 60px rgba(15, 17, 23, 0.5)',
                        position: 'relative',
                    }}
                >
                    {/* Immersive Mode Toggle */}
                    <ImmersiveToggle
                        active={immersive}
                        onToggle={handleToggleImmersive}
                        loading={immersiveLoading}
                    />

                    {/* Standard Canvas 2D renderer */}
                    {!immersive && (
                        <canvas
                            ref={canvasRef}
                            onMouseMove={handleMouseMove}
                            onMouseLeave={() => setMousePos(null)}
                            onWheel={handleWheel}
                            style={{ display: 'block', cursor: 'crosshair' }}
                        />
                    )}

                    {/* Immersive WebGL renderer (lazy loaded) */}
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
                                <GraphingCalcImmersive
                                    functions={functions}
                                    scale={scale}
                                    center={center}
                                    mousePos={mousePos}
                                    onMouseMove={setMousePos}
                                    onZoom={handleImmersiveZoom}
                                />
                            </ImmersiveLoadWrapper>
                        </Suspense>
                    )}
                </div>

                {/* Legend */}
                <div style={{ display: 'flex', gap: '16px', marginTop: '10px', flexWrap: 'wrap' }}>
                    {functions.filter(f => f.enabled && f.expr.trim()).map((fn, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            <span style={{ width: 20, height: 3, borderRadius: 2, background: fn.color, boxShadow: `0 0 6px ${fn.color}66` }} />
                            <code style={{ fontFamily: '"JetBrains Mono", monospace', color: fn.color }}>{fn.expr}</code>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

/** Tiny wrapper that calls onLoaded when the lazy component mounts */
function ImmersiveLoadWrapper({ children, onLoaded }: { children: React.ReactNode; onLoaded: () => void }) {
    useEffect(() => { onLoaded(); }, [onLoaded]);
    return <>{children}</>;
}
