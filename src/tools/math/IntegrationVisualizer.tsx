import { useRef, useEffect, useState, useCallback } from 'react';
import * as math from 'mathjs';
import katex from 'katex';
import 'katex/dist/katex.min.css';

type Method = 'left' | 'right' | 'midpoint' | 'trapezoid' | 'simpson';

/* ─── KaTeX renderer ─── */
function Tex({ math: tex, display = false }: { math: string; display?: boolean }) {
    const ref = useRef<HTMLSpanElement>(null);
    useEffect(() => {
        if (!ref.current) return;
        try {
            katex.render(tex, ref.current, { displayMode: display, throwOnError: false });
        } catch {
            ref.current.textContent = tex;
        }
    }, [tex, display]);
    return <span ref={ref} />;
}

/* ─── Math keyboard ─── */
const KB_KEYS = [
    [
        { label: 'x', insert: 'x' },
        { label: '^', insert: '^' },
        { label: 'sin', insert: 'sin(' },
        { label: 'cos', insert: 'cos(' },
        { label: 'ln', insert: 'log(' },
        { label: 'e^x', insert: 'exp(' },
        { label: 'sqrt', insert: 'sqrt(' },
    ],
    [
        { label: '1', insert: '1' }, { label: '2', insert: '2' }, { label: '3', insert: '3' },
        { label: '4', insert: '4' }, { label: '5', insert: '5' }, { label: '6', insert: '6' },
        { label: '7', insert: '7' }, { label: '8', insert: '8' }, { label: '9', insert: '9' },
        { label: '0', insert: '0' },
    ],
    [
        { label: '+', insert: '+' }, { label: '-', insert: '-' }, { label: '*', insert: '*' },
        { label: '/', insert: '/' }, { label: '(', insert: '(' }, { label: ')', insert: ')' },
        { label: '.', insert: '.' }, { label: 'pi', insert: 'pi' },
    ],
];

const METHOD_INFO: Record<Method, { name: string; description: string; formula: string }> = {
    left: {
        name: 'Left Riemann Sum',
        description: 'Uses the left endpoint of each subinterval to determine rectangle height.',
        formula: '\\sum_{i=0}^{n-1} f(x_i) \\cdot \\Delta x',
    },
    right: {
        name: 'Right Riemann Sum',
        description: 'Uses the right endpoint of each subinterval to determine rectangle height.',
        formula: '\\sum_{i=1}^{n} f(x_i) \\cdot \\Delta x',
    },
    midpoint: {
        name: 'Midpoint Rule',
        description: 'Uses the midpoint of each subinterval for a better approximation.',
        formula: '\\sum_{i=0}^{n-1} f\\!\\left(\\frac{x_i + x_{i+1}}{2}\\right) \\cdot \\Delta x',
    },
    trapezoid: {
        name: 'Trapezoidal Rule',
        description: 'Connects function values with straight lines, forming trapezoids.',
        formula: '\\sum_{i=0}^{n-1} \\frac{f(x_i) + f(x_{i+1})}{2} \\cdot \\Delta x',
    },
    simpson: {
        name: "Simpson's Rule",
        description: 'Approximates the curve with parabolic arcs for higher accuracy (requires even N).',
        formula: '\\frac{\\Delta x}{3} \\left[ f(x_0) + 4f(x_1) + 2f(x_2) + \\cdots + f(x_n) \\right]',
    },
};

export default function IntegrationVisualizer() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [fn, setFn] = useState('x^2');
    const [a, setA] = useState(0);
    const [b, setB] = useState(3);
    const [n, setN] = useState(6);
    const [method, setMethod] = useState<Method>('left');
    const [error, setError] = useState<string | null>(null);
    const [approxArea, setApproxArea] = useState(0);
    const [exactArea, setExactArea] = useState<number | null>(null);
    const [showKeyboard, setShowKeyboard] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const insertAtCursor = useCallback((text: string) => {
        const input = inputRef.current;
        if (!input) { setFn(prev => prev + text); return; }
        const start = input.selectionStart ?? fn.length;
        const end = input.selectionEnd ?? fn.length;
        const newVal = fn.slice(0, start) + text + fn.slice(end);
        setFn(newVal);
        requestAnimationFrame(() => {
            input.focus();
            const pos = start + text.length;
            input.setSelectionRange(pos, pos);
        });
    }, [fn]);

    // Compute exact integral via high-N Simpson's for comparison
    useEffect(() => {
        try {
            const compiled = math.compile(fn);
            const f = (x: number) => {
                try { return Number(compiled.evaluate({ x, e: Math.E, pi: Math.PI })); }
                catch { return 0; }
            };
            const hN = 10000;
            const h = (b - a) / hN;
            let sum = f(a) + f(b);
            for (let i = 1; i < hN; i++) {
                sum += (i % 2 === 0 ? 2 : 4) * f(a + i * h);
            }
            setExactArea(Math.round((sum * h / 3) * 100000) / 100000);
        } catch {
            setExactArea(null);
        }
    }, [fn, a, b]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.parentElement?.getBoundingClientRect();
        if (!rect) return;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;

        const W = rect.width, H = rect.height;
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

        let compiled: math.EvalFunction;
        try {
            compiled = math.compile(fn);
            setError(null);
        } catch {
            setError('Invalid function expression');
            ctx.fillStyle = isDark ? '#1a1612' : '#faf8f5';
            ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = isDark ? '#9c9488' : '#5c544a';
            ctx.font = '14px Sora, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Enter a valid function', W / 2, H / 2);
            return;
        }

        const f = (x: number) => {
            try { return Number(compiled.evaluate({ x, e: Math.E, pi: Math.PI })); }
            catch { return 0; }
        };

        // Range
        const pad = (b - a) * 0.3 || 1;
        const xMin = a - pad, xMax = b + pad;
        let yMin = Infinity, yMax = -Infinity;
        for (let i = 0; i <= 300; i++) {
            const x = xMin + (xMax - xMin) * (i / 300);
            const y = f(x);
            if (isFinite(y)) { yMin = Math.min(yMin, y); yMax = Math.max(yMax, y); }
        }
        const yPad = (yMax - yMin) * 0.2 || 1;
        yMin -= yPad; yMax += yPad;
        if (yMin > 0) yMin = -0.5;

        const toX = (x: number) => ((x - xMin) / (xMax - xMin)) * W;
        const toY = (y: number) => H - ((y - yMin) / (yMax - yMin)) * H;

        // Background
        ctx.fillStyle = isDark ? '#1a1612' : '#faf8f5';
        ctx.fillRect(0, 0, W, H);

        // Grid
        ctx.strokeStyle = isDark ? '#2e2a24' : '#e8e0d4';
        ctx.lineWidth = 0.5;
        for (let x = Math.ceil(xMin); x <= xMax; x++) {
            ctx.beginPath(); ctx.moveTo(toX(x), 0); ctx.lineTo(toX(x), H); ctx.stroke();
        }
        for (let y = Math.ceil(yMin); y <= yMax; y++) {
            ctx.beginPath(); ctx.moveTo(0, toY(y)); ctx.lineTo(W, toY(y)); ctx.stroke();
        }

        // Axis labels
        ctx.fillStyle = isDark ? '#6b6358' : '#9c9488';
        ctx.font = '10px Sora, sans-serif';
        ctx.textAlign = 'center';
        for (let x = Math.ceil(xMin); x <= Math.floor(xMax); x++) {
            if (x === 0) continue;
            const py = yMin <= 0 && yMax >= 0 ? toY(0) + 14 : H - 4;
            ctx.fillText(String(x), toX(x), py);
        }
        ctx.textAlign = 'right';
        for (let y = Math.ceil(yMin); y <= Math.floor(yMax); y++) {
            if (y === 0) continue;
            const px = xMin <= 0 && xMax >= 0 ? toX(0) - 6 : 20;
            ctx.fillText(String(y), px, toY(y) + 4);
        }

        // Axes
        ctx.strokeStyle = isDark ? '#6b6358' : '#9c9488';
        ctx.lineWidth = 1.2;
        if (yMin <= 0 && yMax >= 0) {
            ctx.beginPath(); ctx.moveTo(0, toY(0)); ctx.lineTo(W, toY(0)); ctx.stroke();
        }
        if (xMin <= 0 && xMax >= 0) {
            ctx.beginPath(); ctx.moveTo(toX(0), 0); ctx.lineTo(toX(0), H); ctx.stroke();
        }

        // Shapes
        const dx = (b - a) / n;
        let totalArea = 0;

        const fillColor = isDark ? 'rgba(245,158,11,0.18)' : 'rgba(217,119,6,0.12)';
        const strokeColor = isDark ? 'rgba(245,158,11,0.45)' : 'rgba(217,119,6,0.35)';
        ctx.lineWidth = 1;

        if (method === 'simpson' && n % 2 !== 0) {
            // Simpson needs even n — draw nothing, show warning
            ctx.fillStyle = isDark ? '#9c9488' : '#5c544a';
            ctx.font = '13px Sora, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText("Simpson's rule requires even N", W / 2, 30);
        } else if (method === 'simpson') {
            // Simpson's rule — draw parabolic fills
            const h = dx;
            for (let i = 0; i < n; i += 2) {
                const x0 = a + i * h;
                const x1 = x0 + h;
                const x2 = x0 + 2 * h;
                const y0 = f(x0), y1 = f(x1), y2 = f(x2);
                totalArea += (h / 3) * (y0 + 4 * y1 + y2);

                // Draw parabola fill
                ctx.fillStyle = fillColor;
                ctx.strokeStyle = strokeColor;
                ctx.beginPath();
                ctx.moveTo(toX(x0), toY(0));
                const steps = 30;
                for (let s = 0; s <= steps; s++) {
                    const t = s / steps;
                    const xp = x0 + t * 2 * h;
                    // Lagrange interpolation through (x0,y0), (x1,y1), (x2,y2)
                    const L0 = ((xp - x1) * (xp - x2)) / ((x0 - x1) * (x0 - x2));
                    const L1 = ((xp - x0) * (xp - x2)) / ((x1 - x0) * (x1 - x2));
                    const L2 = ((xp - x0) * (xp - x1)) / ((x2 - x0) * (x2 - x1));
                    const yp = y0 * L0 + y1 * L1 + y2 * L2;
                    ctx.lineTo(toX(xp), toY(yp));
                }
                ctx.lineTo(toX(x2), toY(0));
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            }
        } else {
            for (let i = 0; i < n; i++) {
                const x0 = a + i * dx;
                const x1 = x0 + dx;

                ctx.fillStyle = fillColor;
                ctx.strokeStyle = strokeColor;

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

                    const top = Math.min(toY(h), toY(0));
                    const height = Math.abs(toY(h) - toY(0));
                    ctx.fillRect(toX(x0), top, toX(x1) - toX(x0), height);
                    ctx.strokeRect(toX(x0), top, toX(x1) - toX(x0), height);

                    // Midpoint dot
                    if (method === 'midpoint') {
                        ctx.fillStyle = isDark ? '#f59e0b' : '#d97706';
                        ctx.beginPath();
                        ctx.arc(toX(sampleX), toY(h), 3, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }
        }
        setApproxArea(Math.round(totalArea * 100000) / 100000);

        // Function curve
        ctx.strokeStyle = isDark ? '#f59e0b' : '#d97706';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        let started = false;
        for (let i = 0; i <= 400; i++) {
            const x = xMin + (xMax - xMin) * (i / 400);
            const y = f(x);
            if (!isFinite(y) || Math.abs(y) > 1e6) { started = false; continue; }
            if (!started) { ctx.moveTo(toX(x), toY(y)); started = true; }
            else ctx.lineTo(toX(x), toY(y));
        }
        ctx.stroke();

        // Bound markers
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = isDark ? '#86efac' : '#6b8f71';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(toX(a), 0); ctx.lineTo(toX(a), H); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(toX(b), 0); ctx.lineTo(toX(b), H); ctx.stroke();
        ctx.setLineDash([]);

        // Bound labels
        ctx.font = 'bold 12px Sora, sans-serif';
        ctx.fillStyle = isDark ? '#86efac' : '#6b8f71';
        ctx.textAlign = 'center';
        ctx.fillText(`a = ${a}`, toX(a), H - 8);
        ctx.fillText(`b = ${b}`, toX(b), H - 8);

    }, [fn, a, b, n, method]);

    const errorPct = exactArea && exactArea !== 0
        ? Math.abs(((approxArea - exactArea) / exactArea) * 100).toFixed(2)
        : null;

    const fnLatex = (() => {
        try { return math.parse(fn).toTex({ parenthesis: 'auto', implicit: 'hide' }); }
        catch { return fn; }
    })();

    const info = METHOD_INFO[method];

    return (
        <div className="tool-card" style={{ maxWidth: 900, margin: '0 auto' }}>
            <div className="tool-card-header">
                <h3>Integration Visualizer</h3>
                <span className="subject-topic" style={{ background: 'var(--amber-soft)', color: 'var(--amber)' }}>
                    Calculus
                </span>
            </div>
            <div className="tool-card-body">
                {/* ── Integral display ── */}
                <div style={{
                    textAlign: 'center',
                    padding: '16px 20px',
                    background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: 20,
                    fontSize: '1.3rem',
                }}>
                    <Tex math={`\\int_{${a}}^{${b}} ${fnLatex} \\, dx`} display />
                </div>

                {/* ── Input row ── */}
                <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <label style={{
                            fontSize: '0.82rem', fontWeight: 600, textTransform: 'uppercase',
                            letterSpacing: 0.8, color: 'var(--text-dim)',
                        }}>
                            f(x)
                        </label>
                        <button
                            onClick={() => setShowKeyboard(k => !k)}
                            style={{
                                background: showKeyboard ? 'var(--amber)' : 'var(--bg-secondary)',
                                color: showKeyboard ? '#fff' : 'var(--text-secondary)',
                                border: '1px solid var(--border-warm)',
                                borderRadius: 'var(--radius-sm)',
                                padding: '4px 12px',
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                            }}
                        >
                            {showKeyboard ? 'Hide Keyboard' : 'Math Keyboard'}
                        </button>
                    </div>
                    <input
                        ref={inputRef}
                        className="tool-input"
                        value={fn}
                        onChange={e => setFn(e.target.value)}
                        placeholder="e.g. x^2, sin(x), exp(-x^2)"
                        style={{ fontFamily: 'monospace', fontSize: '0.95rem' }}
                    />
                    {error && (
                        <div style={{ color: 'var(--terracotta)', fontSize: '0.8rem', marginTop: 4 }}>
                            {error}
                        </div>
                    )}
                </div>

                {/* ── Math Keyboard ── */}
                {showKeyboard && (
                    <div style={{
                        marginBottom: 16, padding: 10, background: 'var(--bg-secondary)',
                        borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-warm)',
                    }}>
                        {KB_KEYS.map((row, ri) => (
                            <div key={ri} style={{ display: 'flex', gap: 5, marginBottom: ri < KB_KEYS.length - 1 ? 5 : 0, justifyContent: 'center', flexWrap: 'wrap' }}>
                                {row.map(k => (
                                    <button
                                        key={k.label}
                                        onClick={() => insertAtCursor(k.insert)}
                                        onMouseDown={e => e.preventDefault()}
                                        style={{
                                            padding: '8px 6px', minWidth: 40, border: '1px solid var(--border-warm)',
                                            borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)',
                                            color: 'var(--text-primary)', fontSize: '0.83rem', fontWeight: 600,
                                            cursor: 'pointer', fontFamily: 'var(--font-sans)',
                                        }}
                                    >
                                        {k.label}
                                    </button>
                                ))}
                            </div>
                        ))}
                    </div>
                )}

                {/* ── Controls ── */}
                <div className="tool-controls-row tool-controls-row--3" style={{ marginBottom: 16 }}>
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
                            <option value="midpoint">Midpoint Rule</option>
                            <option value="trapezoid">Trapezoidal Rule</option>
                            <option value="simpson">Simpson's Rule</option>
                        </select>
                    </div>
                </div>

                {/* ── N slider ── */}
                <div style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            Subdivisions
                        </label>
                        <span style={{
                            background: 'var(--amber-soft)', color: 'var(--amber)',
                            padding: '2px 10px', borderRadius: 'var(--radius-sm)',
                            fontWeight: 700, fontSize: '0.9rem', fontFamily: 'monospace',
                        }}>
                            N = {n}
                        </span>
                    </div>
                    <input
                        type="range" min={1} max={100} value={n}
                        onChange={e => setN(+e.target.value)}
                        style={{ width: '100%', accentColor: 'var(--amber)' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-light)' }}>
                        <span>1</span><span>100</span>
                    </div>
                </div>

                {/* ── Method info card ── */}
                <div style={{
                    padding: '14px 18px', marginBottom: 20,
                    background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-light)',
                }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                        {info.name}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
                        {info.description}
                    </div>
                    <Tex math={info.formula} />
                </div>

                {/* ── Results row ── */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: exactArea !== null ? '1fr 1fr 1fr' : '1fr',
                    gap: 12,
                    marginBottom: 20,
                }}>
                    <div style={{
                        padding: '14px 18px', background: 'linear-gradient(135deg, rgba(217,119,6,0.08), rgba(217,119,6,0.15))',
                        borderRadius: 'var(--radius-md)', border: '1px solid rgba(217,119,6,0.2)',
                        textAlign: 'center',
                    }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--amber)', marginBottom: 6 }}>
                            Approximate Area
                        </div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                            {approxArea}
                        </div>
                    </div>

                    {exactArea !== null && (
                        <>
                            <div style={{
                                padding: '14px 18px', background: 'linear-gradient(135deg, rgba(107,143,113,0.08), rgba(107,143,113,0.15))',
                                borderRadius: 'var(--radius-md)', border: '1px solid rgba(107,143,113,0.2)',
                                textAlign: 'center',
                            }}>
                                <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--sage)', marginBottom: 6 }}>
                                    Exact (numerical)
                                </div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                                    {exactArea}
                                </div>
                            </div>
                            <div style={{
                                padding: '14px 18px', background: 'var(--bg-secondary)',
                                borderRadius: 'var(--radius-md)', border: '1px solid var(--border-warm)',
                                textAlign: 'center',
                            }}>
                                <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-dim)', marginBottom: 6 }}>
                                    Error
                                </div>
                                <div style={{
                                    fontSize: '1.2rem', fontWeight: 700, fontFamily: 'monospace',
                                    color: errorPct && Number(errorPct) < 1 ? 'var(--sage)' : 'var(--terracotta)',
                                }}>
                                    {errorPct ? `${errorPct}%` : '--'}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* ── Canvas ── */}
                <div style={{
                    width: '100%', aspectRatio: '16/9', minHeight: 250,
                    background: 'var(--bg-primary)', border: '1px solid var(--border-warm)',
                    borderRadius: 'var(--radius-md)', overflow: 'hidden',
                }}>
                    <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
                </div>

                {/* ── Explanation ── */}
                <div style={{
                    marginTop: 16, padding: '12px 16px', fontSize: '0.82rem',
                    color: 'var(--text-secondary)', lineHeight: 1.6,
                    background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)',
                }}>
                    <Tex math={`\\Delta x = \\frac{b - a}{N} = \\frac{${b} - ${a}}{${n}} = ${Math.round(((b - a) / n) * 10000) / 10000}`} />
                    <span style={{ margin: '0 12px', color: 'var(--text-light)' }}>|</span>
                    Increase N to improve accuracy. The error decreases as subdivisions increase.
                </div>
            </div>
        </div>
    );
}
