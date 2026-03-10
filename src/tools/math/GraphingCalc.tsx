import { useRef, useEffect, useState, useCallback } from 'react';
import { compile } from 'mathjs';
import {
    MANIM, drawScene, drawGlowCurve, drawCrosshair, drawLabel,
    drawGlowDot, type CurvePoint
} from '../../utils/manimCanvas';

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

    const draw = useCallback(() => {
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
    }, [functions, center, scale, mousePos]);

    useEffect(() => {
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
    }, [draw]);

    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        setScale(prev => Math.max(10, Math.min(500, prev * (e.deltaY > 0 ? 0.9 : 1.1))));
    }, []);

    const addFunction = () => {
        if (functions.length >= 5) return;
        setFunctions(prev => [...prev, { expr: '', color: MANIM.palette[prev.length % 7], enabled: true }]);
    };

    const removeFunction = (i: number) => {
        if (functions.length <= 1) return;
        setFunctions(prev => prev.filter((_, idx) => idx !== i));
    };

    return (
        <div className="graphing-calc">
            {/* Sidebar */}
            <div className="graphing-calc-sidebar">
                <div className="graphing-calc-sidebar-header">
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-dim)' }}>
                        Functions
                    </span>
                    <button className="tool-btn tool-btn--outline" onClick={addFunction}
                        style={{ fontSize: '0.78rem', padding: '4px 12px' }}
                        disabled={functions.length >= 5}>
                        + Add
                    </button>
                </div>

                <div className="graphing-calc-fn-list">
                    {functions.map((fn, i) => (
                        <div key={i} className="graphing-calc-fn-row">
                            <div className="graphing-calc-color-dot" style={{ background: fn.color }} />
                            <input
                                className="tool-input graphing-calc-input"
                                value={fn.expr}
                                onChange={e => {
                                    const next = [...functions];
                                    next[i] = { ...next[i], expr: e.target.value };
                                    setFunctions(next);
                                }}
                                placeholder={`f${i + 1}(x) = e.g. x^2, sin(x)`}
                            />
                            <button
                                className="graphing-calc-toggle"
                                onClick={() => {
                                    const next = [...functions];
                                    next[i] = { ...next[i], enabled: !next[i].enabled };
                                    setFunctions(next);
                                }}
                                title={fn.enabled ? 'Hide curve' : 'Show curve'}
                                style={{ color: fn.enabled ? 'var(--sage)' : 'var(--text-dim)' }}
                            >
                                {fn.enabled ? '●' : '○'}
                            </button>
                            {functions.length > 1 && (
                                <button className="graphing-calc-remove" onClick={() => removeFunction(i)} title="Remove">
                                    ×
                                </button>
                            )}
                        </div>
                    ))}
                </div>

                <div className="graphing-calc-hint">
                    Scroll to zoom · Hover for coordinates<br />
                    sin, cos, tan, log, sqrt, abs, exp, x^n
                </div>
            </div>

            {/* Canvas */}
            <div
                ref={containerRef}
                className="graphing-calc-canvas-wrap"
                onWheel={handleWheel}
                onMouseMove={e => {
                    const rect = canvasRef.current?.getBoundingClientRect();
                    if (rect) setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                }}
                onMouseLeave={() => setMousePos(null)}
            >
                <canvas ref={canvasRef} style={{ cursor: 'crosshair' }} />
            </div>
        </div>
    );
}
