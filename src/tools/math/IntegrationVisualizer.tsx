import React, { useRef, useEffect, useState, useCallback, useMemo, Suspense } from 'react';
import * as math from 'mathjs';

const Integration3D = React.lazy(() => import('../../components/tool/Integration3DMode'));

/* ─── Shared UI Library ─── */
import Tex from '../../components/tool/Tex';
import SmartMathInput from '../../components/tool/SmartMathInput';
import MathKeyboard from '../../components/tool/MathKeyboard';
import ToolLayoutSplit from '../../components/tool/ToolLayoutSplit';
import { useIsDark } from '../../hooks/useTheme';
import { gridStep, fmtAxis, exprToLatex } from '../../utils/mathHelpers';

type Method = 'left' | 'right' | 'midpoint' | 'trapezoid' | 'simpson';

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

/* ─── Interactive Canvas Graph (transplanted from DerivativeIntegral) ─── */
function IntegrationGraph({ fn, a, b, n, method, setApproxArea }: {
    fn: string; a: number; b: number; n: number; method: Method;
    setApproxArea: (v: number) => void;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef({ cx: 0, cy: 0, scale: 60 });
    const isDark = useIsDark();

    // Auto-fit viewport to bounds on mount or when a/b changes
    useEffect(() => {
        const pad = (b - a) * 0.4 || 2;
        const midX = (a + b) / 2;
        const container = containerRef.current;
        if (!container) return;
        const W = container.clientWidth || 600;
        const newScale = W / ((b - a) + 2 * pad);
        viewRef.current = { cx: midX, cy: 0, scale: Math.max(10, Math.min(newScale, 200)) };
    }, [a, b]);

    useEffect(() => {
        const container = containerRef.current;
        const canvas = canvasRef.current;
        if (!container || !canvas) return;

        const paint = () => {
            const W = container.clientWidth;
            const H = container.clientHeight;
            if (W === 0 || H === 0) return;
            const dpr = window.devicePixelRatio || 1;

            const bw = Math.round(W * dpr), bh = Math.round(H * dpr);
            if (canvas.width !== bw || canvas.height !== bh) {
                canvas.width = bw; canvas.height = bh;
            }
            const ctx = canvas.getContext('2d')!;
            ctx.setTransform(1, 0, 0, 1, 0, 0);

            const BG = isDark ? '#0a0a0c' : '#f4f4f5';
            ctx.fillStyle = BG;
            ctx.fillRect(0, 0, bw + 2, bh + 2);
            ctx.scale(dpr, dpr);

            // ── Viewport camera (same as DerivativeIntegral) ──
            const { cx, cy, scale } = viewRef.current;
            const xMin = cx - (W / 2) / scale;
            const xMax = cx + (W / 2) / scale;
            const yMin = cy - (H / 2) / scale;
            const yMax = cy + (H / 2) / scale;

            const toSx = (x: number) => (x - xMin) * scale;
            const toSy = (y: number) => (yMax - y) * scale;
            const sx = (x: number) => Math.round(toSx(x));
            const sy = (y: number) => Math.round(toSy(y));

            // ── Compile function ──
            let compiled: math.EvalFunction;
            try {
                compiled = math.compile(fn);
            } catch {
                ctx.fillStyle = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)';
                ctx.font = '14px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText('Enter a valid expression', W / 2, H / 2);
                return;
            }

            const f = (x: number) => {
                try { return Number(compiled.evaluate({ x, e: Math.E, pi: Math.PI })); }
                catch { return NaN; }
            };

            // ── Theme colors ──
            const GRID = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';
            const AXIS = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.3)';
            const LBL = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.5)';
            const FC = isDark ? '#3b82f6' : '#2563eb';
            const FILL = isDark ? 'rgba(59,130,246,0.15)' : 'rgba(37,99,235,0.1)';
            const STROKE = isDark ? 'rgba(59,130,246,0.4)' : 'rgba(37,99,235,0.3)';
            const BOUND = isDark ? '#10b981' : '#059669';

            // ── Grid ──
            const step = gridStep(scale);
            ctx.strokeStyle = GRID; ctx.lineWidth = 1; ctx.setLineDash([]);
            ctx.beginPath();
            for (let gx = Math.ceil(xMin / step) * step; gx <= xMax; gx += step) {
                const px = sx(gx); ctx.moveTo(px, 0); ctx.lineTo(px, H);
            }
            for (let gy = Math.ceil(yMin / step) * step; gy <= yMax; gy += step) {
                const py = sy(gy); ctx.moveTo(0, py); ctx.lineTo(W, py);
            }
            ctx.stroke();

            // ── Axes ──
            ctx.strokeStyle = AXIS; ctx.lineWidth = 1.5;
            ctx.beginPath();
            if (yMin <= 0 && yMax >= 0) { const ay = sy(0); ctx.moveTo(0, ay); ctx.lineTo(W, ay); }
            if (xMin <= 0 && xMax >= 0) { const ax = sx(0); ctx.moveTo(ax, 0); ctx.lineTo(ax, H); }
            ctx.stroke();

            // ── Axis labels ──
            ctx.font = '12px system-ui, sans-serif'; ctx.fillStyle = LBL;
            ctx.textAlign = 'center'; ctx.textBaseline = 'top';
            for (let gx = Math.ceil(xMin / step) * step; gx <= xMax; gx += step) {
                if (Math.abs(gx) < 1e-9) continue;
                const px = toSx(gx); if (px < 22 || px > W - 22) continue;
                const lblY = (yMin <= 0 && yMax >= 0) ? Math.max(5, Math.min(toSy(0) + 5, H - 20)) : H - 20;
                ctx.fillText(fmtAxis(gx), px, lblY);
            }
            ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
            for (let gy = Math.ceil(yMin / step) * step; gy <= yMax; gy += step) {
                if (Math.abs(gy) < 1e-9) continue;
                const py = toSy(gy); if (py < 10 || py > H - 10) continue;
                const lblX = (xMin <= 0 && xMax >= 0) ? Math.max(25, Math.min(toSx(0) - 6, W - 5)) : 30;
                ctx.fillText(fmtAxis(gy), lblX, py);
            }

            // ══════════════════════════════════════════════════════
            // ══ Integration Shapes (Riemann / Trapezoid / Simpson)
            // ══════════════════════════════════════════════════════
            const dx = (b - a) / n;
            let totalArea = 0;
            ctx.lineWidth = 1;

            if (method === 'simpson' && n % 2 !== 0) {
                ctx.fillStyle = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)';
                ctx.font = '13px system-ui, sans-serif'; ctx.textAlign = 'center';
                ctx.fillText("Simpson's rule requires even N", W / 2, 30);
            } else if (method === 'simpson') {
                const h = dx;
                for (let i = 0; i < n; i += 2) {
                    const x0 = a + i * h;
                    const x1 = x0 + h;
                    const x2 = x0 + 2 * h;
                    const y0 = f(x0), y1 = f(x1), y2 = f(x2);
                    totalArea += (h / 3) * (y0 + 4 * y1 + y2);

                    ctx.fillStyle = FILL;
                    ctx.strokeStyle = STROKE;
                    ctx.beginPath();
                    ctx.moveTo(toSx(x0), toSy(0));
                    const steps = 30;
                    for (let s = 0; s <= steps; s++) {
                        const t = s / steps;
                        const xp = x0 + t * 2 * h;
                        const L0 = ((xp - x1) * (xp - x2)) / ((x0 - x1) * (x0 - x2));
                        const L1 = ((xp - x0) * (xp - x2)) / ((x1 - x0) * (x1 - x2));
                        const L2 = ((xp - x0) * (xp - x1)) / ((x2 - x0) * (x2 - x1));
                        const yp = y0 * L0 + y1 * L1 + y2 * L2;
                        ctx.lineTo(toSx(xp), toSy(yp));
                    }
                    ctx.lineTo(toSx(x2), toSy(0));
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();
                }
            } else {
                for (let i = 0; i < n; i++) {
                    const x0 = a + i * dx;
                    const x1 = x0 + dx;

                    ctx.fillStyle = FILL;
                    ctx.strokeStyle = STROKE;

                    if (method === 'trapezoid') {
                        const y0 = f(x0), y1f = f(x1);
                        totalArea += (y0 + y1f) * dx / 2;
                        ctx.beginPath();
                        ctx.moveTo(toSx(x0), toSy(0));
                        ctx.lineTo(toSx(x0), toSy(y0));
                        ctx.lineTo(toSx(x1), toSy(y1f));
                        ctx.lineTo(toSx(x1), toSy(0));
                        ctx.closePath();
                        ctx.fill(); ctx.stroke();
                    } else {
                        let sampleX = x0;
                        if (method === 'right') sampleX = x1;
                        else if (method === 'midpoint') sampleX = (x0 + x1) / 2;
                        const hv = f(sampleX);
                        totalArea += hv * dx;

                        const top = Math.min(toSy(hv), toSy(0));
                        const height = Math.abs(toSy(hv) - toSy(0));
                        ctx.fillRect(toSx(x0), top, toSx(x1) - toSx(x0), height);
                        ctx.strokeRect(toSx(x0), top, toSx(x1) - toSx(x0), height);

                        if (method === 'midpoint') {
                            ctx.beginPath(); ctx.arc(toSx(sampleX), toSy(hv), 3, 0, Math.PI * 2);
                            ctx.fillStyle = FC; ctx.fill();
                        }
                    }
                }
            }
            setApproxArea(Math.round(totalArea * 100000) / 100000);

            // ── Function curve ──
            ctx.strokeStyle = FC; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.setLineDash([]);
            ctx.beginPath();
            let drawing = false;
            for (let px = 0; px <= W; px++) {
                const x = xMin + (xMax - xMin) * (px / W);
                const y = f(x);
                if (!isFinite(y) || Math.abs(y) > 1e6) { if (drawing) { ctx.stroke(); ctx.beginPath(); } drawing = false; continue; }
                const py = toSy(y);
                if (py < -H * 4 || py > H * 5) { if (drawing) { ctx.stroke(); ctx.beginPath(); } drawing = false; continue; }
                drawing ? ctx.lineTo(px, py) : ctx.moveTo(px, py); drawing = true;
            }
            if (drawing) ctx.stroke();

            // ── Bound markers ──
            ctx.setLineDash([5, 4]);
            ctx.strokeStyle = BOUND; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(toSx(a), 0); ctx.lineTo(toSx(a), H); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(toSx(b), 0); ctx.lineTo(toSx(b), H); ctx.stroke();
            ctx.setLineDash([]);

            // ── Bound labels ──
            ctx.font = 'bold 11px system-ui, sans-serif';
            ctx.fillStyle = BOUND; ctx.textAlign = 'center';
            ctx.fillText(`a = ${a}`, toSx(a), H - 8);
            ctx.fillText(`b = ${b}`, toSx(b), H - 8);
        };

        paint();

        // ── Resize observer ──
        const ro = new ResizeObserver(() => paint());
        ro.observe(container);

        // ── Pan & Zoom events (transplanted from DerivativeIntegral) ──
        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const { cx, cy, scale } = viewRef.current;
            const mathX = cx + (mouseX - rect.width / 2) / scale;
            const mathY = cy - (mouseY - rect.height / 2) / scale;

            const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
            const newScale = Math.max(0.001, Math.min(scale * zoomFactor, 10000));

            const newCx = mathX - (mouseX - rect.width / 2) / newScale;
            const newCy = mathY + (mouseY - rect.height / 2) / newScale;

            viewRef.current = { cx: newCx, cy: newCy, scale: newScale };
            paint();
        };

        let isDragging = false;
        let lastPan = { x: 0, y: 0 };
        const onPointerDown = (e: PointerEvent) => {
            isDragging = true;
            lastPan = { x: e.clientX, y: e.clientY };
            canvas.style.cursor = 'grabbing';
            canvas.setPointerCapture(e.pointerId);
        };
        const onPointerMove = (e: PointerEvent) => {
            if (!isDragging) return;
            const ddx = e.clientX - lastPan.x;
            const ddy = e.clientY - lastPan.y;
            lastPan = { x: e.clientX, y: e.clientY };

            viewRef.current.cx -= ddx / viewRef.current.scale;
            viewRef.current.cy += ddy / viewRef.current.scale;
            paint();
        };
        const onPointerUp = (e: PointerEvent) => {
            isDragging = false;
            canvas.style.cursor = 'grab';
            canvas.releasePointerCapture(e.pointerId);
        };

        canvas.addEventListener('wheel', onWheel, { passive: false });
        canvas.addEventListener('pointerdown', onPointerDown);
        canvas.addEventListener('pointermove', onPointerMove);
        canvas.addEventListener('pointerup', onPointerUp);
        canvas.addEventListener('pointercancel', onPointerUp);
        canvas.style.cursor = 'grab';

        return () => {
            ro.disconnect();
            canvas.removeEventListener('wheel', onWheel);
            canvas.removeEventListener('pointerdown', onPointerDown);
            canvas.removeEventListener('pointermove', onPointerMove);
            canvas.removeEventListener('pointerup', onPointerUp);
            canvas.removeEventListener('pointercancel', onPointerUp);
        };
    }, [fn, a, b, n, method, isDark, setApproxArea]);

    return (
        <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
            <canvas
                ref={canvasRef}
                style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none' }}
            />
        </div>
    );
}

/* ─── Main Component ─── */
export default function IntegrationVisualizer() {
    const inputRef = useRef<HTMLInputElement>(null);
    const [fn, setFn] = useState('x^2');
    const [a, setA] = useState(0);
    const [b, setB] = useState(3);
    const [n, setN] = useState(6);
    const [method, setMethod] = useState<Method>('left');
    const [showKeyboard, setShowKeyboard] = useState(false);
    const [approxArea, setApproxArea] = useState(0);
    const [exactArea, setExactArea] = useState<number | null>(null);
    const [show3D, setShow3D] = useState(false);

    const isDark = useIsDark();

    const insertAtCursor = useCallback((text: string) => {
        const input = inputRef.current;
        if (!input) { setFn(p => p + text); return; }
        const start = input.selectionStart ?? fn.length;
        const end = input.selectionEnd ?? fn.length;
        setFn(fn.slice(0, start) + text + fn.slice(end));
        requestAnimationFrame(() => { input.focus(); const pos = start + text.length; input.setSelectionRange(pos, pos); });
    }, [fn]);

    const handleBackspace = useCallback(() => {
        const i = inputRef.current;
        if (i) {
            const s = i.selectionStart ?? fn.length;
            if (s > 0) {
                setFn(fn.slice(0, s - 1) + fn.slice(s));
                requestAnimationFrame(() => { i.focus(); i.setSelectionRange(s - 1, s - 1); });
            }
        }
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

    const errorPct = exactArea && exactArea !== 0
        ? Math.abs(((approxArea - exactArea) / exactArea) * 100).toFixed(2)
        : null;

    const fnLatex = useMemo(() => exprToLatex(fn), [fn]);
    const info = METHOD_INFO[method];

    const borderC = isDark ? '#27272a' : '#e4e4e7';
    const textDim = isDark ? '#9ca3af' : '#6b7280';
    const textPrimary = isDark ? '#ffffff' : '#000000';
    const inputBg = isDark ? '#18181b' : '#f3f4f6';
    const amber = '#d97706';
    const amberGlow = isDark ? 'rgba(217,119,6,0.1)' : 'rgba(217,119,6,0.08)';
    const sageBg = isDark ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.06)';

    const sidebar = (
        <>
            {/* ── Integral display ── */}
            <div style={{
                textAlign: 'center', padding: '16px 20px',
                background: inputBg, borderRadius: 10,
                fontSize: '1.3rem', border: `1px solid ${borderC}`,
            }}>
                <Tex math={`\\int_{${a}}^{${b}} ${fnLatex} \\, dx`} display />
            </div>

            {/* ── Function input ── */}
            <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: textDim }}>
                f(x)
            </div>

            <SmartMathInput
                value={fn}
                onChange={setFn}
                variable="x"
                isDark={isDark}
                placeholder="e.g. x^2, sin(x), exp(-x^2)"
            />

            <button onClick={() => setShowKeyboard(k => !k)} style={{
                background: showKeyboard ? amberGlow : 'transparent', color: showKeyboard ? amber : textDim,
                border: `1px solid ${borderC}`, borderRadius: 7, padding: '8px 10px',
                fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'system-ui',
                width: '100%', letterSpacing: 0.3, transition: 'all 0.1s'
            }}>
                {showKeyboard ? '✕ Hide keyboard' : '⌨ Math keyboard'}
            </button>

            {showKeyboard && (
                <MathKeyboard
                    onInsert={insertAtCursor}
                    onBackspace={handleBackspace}
                    onClear={() => setFn('')}
                    isDark={isDark}
                />
            )}

            {/* ── Controls ── */}
            <div style={{ display: 'flex', gap: 12 }}>
                {[
                    { label: 'Lower bound (a)', el: <input type="number" value={a} onChange={e => setA(+e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: `1px solid ${borderC}`, background: inputBg, color: textPrimary, fontSize: '0.9rem', outline: 'none' }} /> },
                    { label: 'Upper bound (b)', el: <input type="number" value={b} onChange={e => setB(+e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: `1px solid ${borderC}`, background: inputBg, color: textPrimary, fontSize: '0.9rem', outline: 'none' }} /> },
                ].map(({ label, el }) => (
                    <div key={label} style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: textDim, marginBottom: 6 }}>{label}</div>
                        {el}
                    </div>
                ))}
            </div>

            <div>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: textDim, marginBottom: 6 }}>Method</div>
                <select value={method} onChange={e => setMethod(e.target.value as Method)} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: `1px solid ${borderC}`, background: inputBg, color: textPrimary, fontSize: '0.9rem', outline: 'none' }}>
                    <option value="left">Left Riemann</option>
                    <option value="right">Right Riemann</option>
                    <option value="midpoint">Midpoint Rule</option>
                    <option value="trapezoid">Trapezoidal Rule</option>
                    <option value="simpson">Simpson's Rule</option>
                </select>
            </div>

            {/* ── N slider ── */}
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: textDim }}>
                        Subdivisions
                    </span>
                    <span style={{
                        background: amberGlow, color: amber,
                        padding: '2px 10px', borderRadius: 6,
                        fontWeight: 700, fontSize: '0.85rem', fontFamily: 'monospace',
                        border: '1px solid rgba(217,119,6,0.2)',
                    }}>
                        N = {n}
                    </span>
                </div>
                <input
                    type="range" min={1} max={100} value={n}
                    onChange={e => setN(+e.target.value)}
                    style={{ width: '100%', accentColor: amber }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: textDim }}>
                    <span>1</span><span>100</span>
                </div>
            </div>

            {/* ── Method info card ── */}
            <div style={{
                padding: '14px 18px',
                background: inputBg, borderRadius: 10,
                border: `1px solid ${borderC}`,
            }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: textPrimary, marginBottom: 4 }}>
                    {info.name}
                </div>
                <div style={{ fontSize: '0.82rem', color: textDim, marginBottom: 8 }}>
                    {info.description}
                </div>
                <Tex math={info.formula} />
            </div>

            {/* ── Results ── */}
            <div style={{
                padding: '16px', background: amberGlow,
                border: '1px solid rgba(217,119,6,0.3)',
                borderRadius: 10,
            }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2, color: amber, marginBottom: 10 }}>Approximate Area</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'monospace', color: textPrimary }}>
                    {approxArea}
                </div>
            </div>

            {exactArea !== null && (
                <>
                    <div style={{
                        padding: '16px', background: sageBg,
                        border: '1px solid rgba(16,185,129,0.3)',
                        borderRadius: 10,
                    }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2, color: isDark ? '#10b981' : '#059669', marginBottom: 10 }}>Exact (numerical)</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'monospace', color: textPrimary }}>
                            {exactArea}
                        </div>
                    </div>

                    <div style={{
                        padding: '16px', background: inputBg,
                        border: `1px solid ${borderC}`,
                        borderRadius: 10,
                    }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2, color: textDim, marginBottom: 10 }}>Error</div>
                        <div style={{
                            fontSize: '1.2rem', fontWeight: 700, fontFamily: 'monospace',
                            color: errorPct && Number(errorPct) < 1 ? (isDark ? '#10b981' : '#059669') : '#ef4444',
                        }}>
                            {errorPct ? `${errorPct}%` : '--'}
                        </div>
                    </div>
                </>
            )}

            {/* ── Δx info ── */}
            <div style={{
                padding: '12px 16px', fontSize: '0.82rem',
                color: textDim, lineHeight: 1.6,
                background: inputBg, borderRadius: 8,
                border: `1px solid ${borderC}`,
            }}>
                <Tex math={`\\Delta x = \\frac{b - a}{N} = \\frac{${b} - ${a}}{${n}} = ${Math.round(((b - a) / n) * 10000) / 10000}`} />
                <span style={{ margin: '0 12px', color: textDim }}>|</span>
                Increase N to improve accuracy.
            </div>

            {/* ── 3D Immersive button ── */}
            <button onClick={() => setShow3D(true)} style={{
                width: '100%', padding: '10px 14px', marginTop: 4,
                border: `1px solid ${isDark ? 'rgba(0,221,255,0.25)' : 'rgba(0,100,200,0.2)'}`,
                borderRadius: 8,
                background: isDark ? 'rgba(0,221,255,0.06)' : 'rgba(0,100,200,0.04)',
                color: isDark ? '#00ddff' : '#0066cc',
                fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                fontFamily: 'system-ui', letterSpacing: 0.3, transition: 'all 0.15s',
            }}>
                🌌 Immersive 3D
            </button>
        </>
    );

    const canvas = (
        <>
            <IntegrationGraph
                fn={fn} a={a} b={b} n={n} method={method}
                setApproxArea={setApproxArea}
            />

            {show3D && (
                <Suspense fallback={
                    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#050510', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(245,158,11,0.6)', fontSize: '1rem', letterSpacing: 2 }}>
                        Loading 3D…
                    </div>
                }>
                    <Integration3D
                        expr={fn} variable="x"
                        lowerBound={a} upperBound={b}
                        subdivisions={n} method={method}
                        onClose={() => setShow3D(false)}
                    />
                </Suspense>
            )}
        </>
    );

    return (
        <ToolLayoutSplit>
            {[sidebar, canvas]}
        </ToolLayoutSplit>
    );
}
