import { useRef, useEffect, useState, useCallback } from 'react';
import { compile } from 'mathjs';

interface FnEntry {
    expr: string;
    color: string;
    enabled: boolean;
}

const COLORS = ['#d97706', '#6b8f71', '#c2714f', '#3b82f6', '#a855f7'];

export default function GraphingCalc() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [functions, setFunctions] = useState<FnEntry[]>([
        { expr: 'sin(x)', color: COLORS[0], enabled: true },
        { expr: '', color: COLORS[1], enabled: true },
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

        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        ctx.fillStyle = isDark ? '#141210' : '#faf8f5';
        ctx.fillRect(0, 0, W, H);

        // Grid
        ctx.strokeStyle = isDark ? '#2e2a24' : '#e8e0d4';
        ctx.lineWidth = 1;

        const gridStep = getGridStep(scale);
        const startX = Math.floor((-cx / scale) / gridStep) * gridStep;
        const endX = Math.ceil(((W - cx) / scale) / gridStep) * gridStep;
        const startY = Math.floor((-(H - cy) / scale) / gridStep) * gridStep;
        const endY = Math.ceil((cy / scale) / gridStep) * gridStep;

        for (let x = startX; x <= endX; x += gridStep) {
            const px = cx + x * scale;
            ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, H); ctx.stroke();
        }
        for (let y = startY; y <= endY; y += gridStep) {
            const py = cy - y * scale;
            ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(W, py); ctx.stroke();
        }

        // Axes
        ctx.strokeStyle = isDark ? '#6b6358' : '#9c9488';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(W, cy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke();

        // Axis labels
        ctx.fillStyle = isDark ? '#6b6358' : '#9c9488';
        ctx.font = '11px Sora, sans-serif';
        ctx.textAlign = 'center';
        for (let x = startX; x <= endX; x += gridStep) {
            if (Math.abs(x) < 0.001) continue;
            const px = cx + x * scale;
            const label = Number.isInteger(x) ? String(x) : x.toFixed(1);
            ctx.fillText(label, px, cy + 16);
        }
        ctx.textAlign = 'right';
        for (let y = startY; y <= endY; y += gridStep) {
            if (Math.abs(y) < 0.001) continue;
            const py = cy - y * scale;
            const label = Number.isInteger(y) ? String(y) : y.toFixed(1);
            ctx.fillText(label, cx - 8, py + 4);
        }

        // Plot functions
        for (const fn of functions) {
            if (!fn.enabled || !fn.expr.trim()) continue;
            try {
                const compiled = compile(fn.expr);
                ctx.strokeStyle = fn.color;
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                let started = false;
                for (let px = 0; px < W; px += 0.5) {
                    const x = (px - cx) / scale;
                    try {
                        const y = compiled.evaluate({ x });
                        if (typeof y !== 'number' || !isFinite(y)) { started = false; continue; }
                        const py = cy - y * scale;
                        if (!started) { ctx.moveTo(px, py); started = true; }
                        else ctx.lineTo(px, py);
                    } catch { started = false; }
                }
                ctx.stroke();
            } catch { /* invalid expression */ }
        }

        // Mouse trace
        if (mousePos) {
            const mx = (mousePos.x - cx) / scale;
            const my = (cy - mousePos.y) / scale;
            ctx.fillStyle = isDark ? '#e8e4de' : '#1a1612';
            ctx.font = '12px Sora, monospace';
            ctx.textAlign = 'left';
            ctx.fillText(`(${mx.toFixed(2)}, ${my.toFixed(2)})`, mousePos.x + 12, mousePos.y - 8);

            ctx.strokeStyle = isDark ? 'rgba(232, 228, 222, 0.2)' : 'rgba(26, 22, 18, 0.1)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath(); ctx.moveTo(mousePos.x, 0); ctx.lineTo(mousePos.x, H); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, mousePos.y); ctx.lineTo(W, mousePos.y); ctx.stroke();
            ctx.setLineDash([]);
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
            canvas.style.width = rect.width + 'px';
            canvas.style.height = rect.height + 'px';
            draw();
        };

        resize();
        const observer = new ResizeObserver(resize);
        observer.observe(container);
        return () => observer.disconnect();
    }, [draw]);

    useEffect(() => { draw(); }, [draw]);

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        setScale(s => Math.max(5, Math.min(500, s - e.deltaY * 0.5)));
    };

    const addFunction = () => {
        if (functions.length >= 5) return;
        setFunctions([...functions, { expr: '', color: COLORS[functions.length % COLORS.length], enabled: true }]);
    };

    const removeFunction = (i: number) => {
        if (functions.length <= 1) return;
        setFunctions(functions.filter((_, idx) => idx !== i));
    };

    return (
        <div className="graphing-calc">
            {/* Sidebar controls */}
            <div className="graphing-calc-sidebar">
                <div className="graphing-calc-sidebar-header">
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-dim)' }}>
                        Functions
                    </span>
                    <button className="tool-btn--outline tool-btn" onClick={addFunction}
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
                                onChange={(e) => {
                                    const newFns = [...functions];
                                    newFns[i] = { ...newFns[i], expr: e.target.value };
                                    setFunctions(newFns);
                                }}
                                placeholder={`f${i + 1}(x) = e.g. x^2, sin(x)`}
                            />
                            <button
                                className="graphing-calc-toggle"
                                onClick={() => {
                                    const newFns = [...functions];
                                    newFns[i] = { ...newFns[i], enabled: !newFns[i].enabled };
                                    setFunctions(newFns);
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
                onMouseMove={(e) => {
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

function getGridStep(scale: number): number {
    const raw = 80 / scale;
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / pow;
    if (norm < 2) return pow;
    if (norm < 5) return 2 * pow;
    return 5 * pow;
}
