import { useRef, useEffect, useState, useCallback } from 'react';
import * as math from 'mathjs';
import katex from 'katex';
import 'katex/dist/katex.min.css';

type Method = 'left' | 'right' | 'midpoint' | 'trapezoid' | 'simpson';

/* ─── KaTeX renderer ── */
function Tex({ math: tex, display = false }: { math: string; display?: boolean }) {
    const ref = useRef<HTMLSpanElement>(null);
    useEffect(() => {
        if (!ref.current) return;
        try { katex.render(tex, ref.current, { displayMode: display, throwOnError: false, trust: true }); }
        catch { ref.current.textContent = tex; }
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
        { label: 'tan', insert: 'tan(' },
        { label: 'ln', insert: 'log(' },
        { label: 'sqrt', insert: 'sqrt(' },
    ],
    [
        { label: '0', insert: '0' }, { label: '1', insert: '1' }, { label: '2', insert: '2' },
        { label: '3', insert: '3' }, { label: '4', insert: '4' }, { label: '5', insert: '5' },
        { label: '6', insert: '6' }, { label: '7', insert: '7' }, { label: '8', insert: '8' },
        { label: '9', insert: '9' },
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
        formula: '\\sum_{i=0}^{N-1} f(x_i) \\cdot \\Delta x',
    },
    right: {
        name: 'Right Riemann Sum',
        description: 'Uses the right endpoint of each subinterval to determine rectangle height.',
        formula: '\\sum_{i=1}^{N} f(x_i) \\cdot \\Delta x',
    },
    midpoint: {
        name: 'Midpoint Rule',
        description: 'Uses the midpoint of each subinterval for generally better accuracy.',
        formula: '\\sum_{i=0}^{N-1} f\\left(\\frac{x_i + x_{i+1}}{2}\\right) \\cdot \\Delta x',
    },
    trapezoid: {
        name: 'Trapezoidal Rule',
        description: 'Connects consecutive points with straight lines, forming trapezoids.',
        formula: '\\frac{\\Delta x}{2} \\left[ f(x_0) + 2f(x_1) + \\cdots + f(x_n) \\right]',
    },
    simpson: {
        name: "Simpson's Rule",
        description: 'Approximates the curve with parabolic arcs for higher accuracy (requires even N).',
        formula: '\\frac{\\Delta x}{3} \\left[ f(x_0) + 4f(x_1) + 2f(x_2) + \\cdots + f(x_n) \\right]',
    },
};

/* ─── Helpers (matching GraphingCalc) ─── */
const gridStep = (scale: number): number => {
    const raw = 60 / scale;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / mag;
    return (n < 2 ? 1 : n < 5 ? 2 : 5) * mag;
};

const formatAxisValue = (val: number): string => {
    if (Math.abs(val) < 1e-10) return '0';
    return Number.isInteger(val) ? String(val) : val.toFixed(1);
};

export default function IntegrationVisualizer() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [fn, setFn] = useState('x^2');
    const [a, setA] = useState(0);
    const [b, setB] = useState(3);
    const [n, setN] = useState(6);
    const [method, setMethod] = useState<Method>('left');
    const [showKeyboard, setShowKeyboard] = useState(false);
    const [approxArea, setApproxArea] = useState(0);
    const [exactArea, setExactArea] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Detect theme
    const [isDark, setIsDark] = useState(() => document.documentElement.getAttribute('data-theme') === 'dark');
    useEffect(() => {
        const el = document.documentElement;
        const obs = new MutationObserver(() => setIsDark(el.getAttribute('data-theme') === 'dark'));
        obs.observe(el, { attributes: true, attributeFilter: ['data-theme'] });
        return () => obs.disconnect();
    }, []);

    const insertAtCursor = useCallback((text: string) => {
        const input = inputRef.current;
        if (!input) { setFn(p => p + text); return; }
        const start = input.selectionStart ?? fn.length;
        const end = input.selectionEnd ?? fn.length;
        setFn(fn.slice(0, start) + text + fn.slice(end));
        requestAnimationFrame(() => { input.focus(); const pos = start + text.length; input.setSelectionRange(pos, pos); });
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

        let compiled: math.EvalFunction;
        try {
            compiled = math.compile(fn);
            setError(null);
        } catch {
            setError('Invalid function expression');
            ctx.fillStyle = isDark ? '#1a1a2e' : '#ffffff';
            ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)';
            ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
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
        const scale = W / (xMax - xMin);

        // Theme colors (matching GraphingCalc Lite)
        const bgColor = isDark ? '#1a1a2e' : '#ffffff';
        const gridColor = isDark ? '#2a2a3e' : '#e0e0e0';
        const axisColor = isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.85)';
        const labelColor = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)';
        const curveColor = isDark ? '#5b9bd5' : '#2d70b3';
        const fillColor = isDark ? 'rgba(91,155,213,0.15)' : 'rgba(45,112,179,0.10)';
        const strokeColor = isDark ? 'rgba(91,155,213,0.4)' : 'rgba(45,112,179,0.3)';
        const boundColor = isDark ? '#6abf69' : '#388c46';

        // Background
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, W, H);

        // Grid
        const step = gridStep(scale);
        ctx.strokeStyle = gridColor; ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = Math.ceil(xMin / step) * step; x <= xMax; x += step) {
            if (Math.abs(x) < 1e-10) continue;
            const px = Math.round(toX(x)) + 0.5;
            ctx.moveTo(px, 0); ctx.lineTo(px, H);
        }
        for (let y = Math.ceil(yMin / step) * step; y <= yMax; y += step) {
            if (Math.abs(y) < 1e-10) continue;
            const py = Math.round(toY(y)) + 0.5;
            ctx.moveTo(0, py); ctx.lineTo(W, py);
        }
        ctx.stroke();

        // Axes
        ctx.strokeStyle = axisColor; ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (yMin <= 0 && yMax >= 0) {
            const ay = Math.round(toY(0)) + 0.5; ctx.moveTo(0, ay); ctx.lineTo(W, ay);
        }
        if (xMin <= 0 && xMax >= 0) {
            const ax = Math.round(toX(0)) + 0.5; ctx.moveTo(ax, 0); ctx.lineTo(ax, H);
        }
        ctx.stroke();

        // Tick marks
        ctx.strokeStyle = axisColor; ctx.lineWidth = 1.5;
        ctx.beginPath();
        const ayPx = yMin <= 0 && yMax >= 0 ? Math.round(toY(0)) + 0.5 : H - 0.5;
        const axPx = xMin <= 0 && xMax >= 0 ? Math.round(toX(0)) + 0.5 : 0.5;
        for (let x = Math.ceil(xMin / step) * step; x <= xMax; x += step) {
            if (Math.abs(x) < 1e-10) continue;
            const px = Math.round(toX(x)) + 0.5;
            ctx.moveTo(px, ayPx - 4); ctx.lineTo(px, ayPx + 4);
        }
        for (let y = Math.ceil(yMin / step) * step; y <= yMax; y += step) {
            if (Math.abs(y) < 1e-10) continue;
            const py = Math.round(toY(y)) + 0.5;
            ctx.moveTo(axPx - 4, py); ctx.lineTo(axPx + 4, py);
        }
        ctx.stroke();

        // Axis labels
        ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillStyle = labelColor;
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        for (let x = Math.ceil(xMin / step) * step; x <= xMax; x += step) {
            if (Math.abs(x) < 1e-10) continue;
            const px = toX(x);
            if (px < 25 || px > W - 25) continue;
            ctx.fillText(formatAxisValue(x), px, ayPx + 8);
        }
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        for (let y = Math.ceil(yMin / step) * step; y <= yMax; y += step) {
            if (Math.abs(y) < 1e-10) continue;
            const py = toY(y);
            if (py < 12 || py > H - 12) continue;
            ctx.fillText(formatAxisValue(y), axPx - 8, py);
        }

        // Shapes
        const dx = (b - a) / n;
        let totalArea = 0;
        ctx.lineWidth = 1;

        if (method === 'simpson' && n % 2 !== 0) {
            ctx.fillStyle = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)';
            ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText("Simpson's rule requires even N", W / 2, 30);
        } else if (method === 'simpson') {
            const h = dx;
            for (let i = 0; i < n; i += 2) {
                const x0 = a + i * h;
                const x1 = x0 + h;
                const x2 = x0 + 2 * h;
                const y0 = f(x0), y1 = f(x1), y2 = f(x2);
                totalArea += (h / 3) * (y0 + 4 * y1 + y2);

                ctx.fillStyle = fillColor;
                ctx.strokeStyle = strokeColor;
                ctx.beginPath();
                ctx.moveTo(toX(x0), toY(0));
                const steps = 30;
                for (let s = 0; s <= steps; s++) {
                    const t = s / steps;
                    const xp = x0 + t * 2 * h;
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

                    if (method === 'midpoint') {
                        ctx.beginPath(); ctx.arc(toX(sampleX), toY(h), 3, 0, Math.PI * 2);
                        ctx.fillStyle = curveColor; ctx.fill();
                    }
                }
            }
        }
        setApproxArea(Math.round(totalArea * 100000) / 100000);

        // Function curve — solid clean line
        ctx.strokeStyle = curveColor; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath();
        let drawing = false;
        for (let i = 0; i <= 600; i++) {
            const x = xMin + (xMax - xMin) * (i / 600);
            const y = f(x);
            if (!isFinite(y) || Math.abs(y) > 1e6) { if (drawing) { ctx.stroke(); ctx.beginPath(); } drawing = false; continue; }
            const px = toX(x), py = toY(y);
            if (!drawing) { ctx.moveTo(px, py); drawing = true; } else ctx.lineTo(px, py);
        }
        if (drawing) ctx.stroke();

        // Bound markers
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = boundColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(toX(a), 0); ctx.lineTo(toX(a), H); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(toX(b), 0); ctx.lineTo(toX(b), H); ctx.stroke();
        ctx.setLineDash([]);

        // Bound labels
        ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillStyle = boundColor;
        ctx.textAlign = 'center';
        ctx.fillText(`a = ${a}`, toX(a), H - 8);
        ctx.fillText(`b = ${b}`, toX(b), H - 8);

    }, [fn, a, b, n, method, isDark]);

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
                    background: 'var(--bg-card)', border: '1px solid var(--border-warm)',
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
