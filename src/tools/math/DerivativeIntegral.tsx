import React, { useState, useCallback, useRef, useEffect, useMemo, Suspense } from 'react';
import { derivative, parse, simplify, compile, type MathNode, type EvalFunction } from 'mathjs';

/* ─── Shared UI Library ─── */
import Tex from '../../components/tool/Tex';
import SmartMathInput from '../../components/tool/SmartMathInput';
import MathKeyboard from '../../components/tool/MathKeyboard';
import ToolLayoutSplit from '../../components/tool/ToolLayoutSplit';
import { useIsDark } from '../../hooks/useTheme';
import { toLatex, gridStep, fmtAxis, evalSafe, numDeriv, exprToLatex } from '../../utils/mathHelpers';

const Immersive3D = React.lazy(() => import('./Immersive3DMode'));

/* ─── Types ─── */
type Mode = 'derivative' | 'integral';
type StepEntry = { label: string; latex: string };

/* ─── Math Logic ─── */
function derivSteps(expr: string, variable: string, order: number): StepEntry[] {
    const s: StepEntry[] = [];
    try {
        s.push({ label: 'Original', latex: `f(${variable}) = ${toLatex(parse(expr))}` });
        let cur = expr;
        for (let i = 1; i <= order; i++) {
            const d = simplify(derivative(cur, variable));
            const n = order === 1 ? `f'(${variable})` : `f^{(${i})}(${variable})`;
            s.push({ label: order === 1 ? 'Differentiate' : `${i === 1 ? '1st' : i === 2 ? '2nd' : `${i}th`} derivative`, latex: `${n} = ${toLatex(d)}` });
            cur = d.toString();
        }
    } catch (e) { s.push({ label: 'Error', latex: `\\\\text{${e instanceof Error ? e.message : 'Could not differentiate'}}` }); }
    return s;
}

function symInt(node: MathNode): string {
    const expr = node.toString();
    const terms = expr.replace(/\s/g, '').replace(/-/g, '+-').split('+').filter(Boolean);
    const out: string[] = [];
    for (const t of terms) {
        const m = t.match(/^([+-]?\d*\.?\d*)\*?x\^?(\d*\.?\d*)$/);
        if (m) {
            const c = m[1] === '' || m[1] === '+' ? 1 : m[1] === '-' ? -1 : parseFloat(m[1]);
            const p = m[2] === '' ? 1 : parseFloat(m[2]);
            if (p === -1) { out.push(`${c === 1 ? '' : c === -1 ? '-' : c + ' '}ln|x|`); continue; }
            const np = p + 1, nc = Math.round((c / np) * 1e5) / 1e5;
            out.push(np === 1 ? `${nc}x` : `${nc}x^${np}`); continue;
        }
        const mc = t.match(/^([+-]?\d+\.?\d*)$/);
        if (mc) { out.push(`${mc[1]}x`); continue; }
        const MAP: Record<string, string> = { 'sin(x)': '-cos(x)', '-sin(x)': 'cos(x)', 'cos(x)': 'sin(x)', '-cos(x)': '-sin(x)', 'exp(x)': 'exp(x)', 'e^x': 'exp(x)', '1/x': 'ln|x|', 'sec(x)^2': 'tan(x)' };
        if (MAP[t]) { out.push(MAP[t]); continue; }
        try { const s = simplify(t).toString(); if (s !== t) { out.push(symInt(parse(s))); continue; } } catch { /**/ }
        throw new Error('Cannot integrate: ' + t);
    }
    return out.join(' + ').replace(/\+ -/g, '- ');
}

function intSteps(expr: string, variable: string): StepEntry[] {
    const s: StepEntry[] = [];
    try {
        const orig = parse(expr);
        s.push({ label: 'Original', latex: `f(${variable}) = ${toLatex(orig)}` });
        s.push({ label: 'Set up integral', latex: `\\\\int ${toLatex(orig)}\\\\,d${variable}` });
        s.push({ label: 'Apply rules', latex: `= ${toLatex(parse(symInt(orig)))} + C` });
    } catch (e) { s.push({ label: 'Result', latex: `\\\\text{${e instanceof Error ? e.message : 'Not available'}}` }); }
    return s;
}

/* ─── Canvas Graph ─── */
function Graph({ expr, derivExpr, variable, mode, animating, setAnimating, animProg, animRef }: {
    expr: string; derivExpr: string | null; variable: string; mode: Mode;
    animating: boolean; setAnimating: (v: boolean) => void;
    animProg: React.MutableRefObject<number>;
    animRef: React.MutableRefObject<number>;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef({ cx: 0, cy: 0, scale: 60 });
    const isDark = useIsDark();

    const startAnim = useCallback(() => { animProg.current = 0; setAnimating(true); }, [animProg, setAnimating]);
    const stopAnim = useCallback(() => { setAnimating(false); cancelAnimationFrame(animRef.current); }, [animRef, setAnimating]);

    useEffect(() => {
        const container = containerRef.current;
        const canvas = canvasRef.current;
        if (!container || !canvas) return;
        let rafId = 0;

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

            let fFn: EvalFunction, dFn: EvalFunction | null = null;
            try {
                fFn = compile(expr);
                if (derivExpr) dFn = compile(derivExpr);
            } catch {
                ctx.fillStyle = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)';
                ctx.font = '14px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText('Enter a valid expression', W / 2, H / 2);
                return;
            }

            const { cx, cy, scale } = viewRef.current;
            const xMin = cx - (W / 2) / scale;
            const xMax = cx + (W / 2) / scale;
            const yMin = cy - (H / 2) / scale;
            const yMax = cy + (H / 2) / scale;

            const toSx = (x: number) => (x - xMin) * scale;
            const toSy = (y: number) => (yMax - y) * scale;
            const sx = (x: number) => Math.round(toSx(x));
            const sy = (y: number) => Math.round(toSy(y));

            const GRID = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';
            const AXIS = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.3)';
            const LBL = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.5)';
            const FC = isDark ? '#3b82f6' : '#2563eb';
            const DC = isDark ? '#10b981' : '#059669';
            const TC = isDark ? '#ef4444' : '#dc2626';
            const AREA = isDark ? 'rgba(59,130,246,0.15)' : 'rgba(37,99,235,0.1)';

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

            ctx.strokeStyle = AXIS; ctx.lineWidth = 1.5;
            ctx.beginPath();
            if (yMin <= 0 && yMax >= 0) { const ay = sy(0); ctx.moveTo(0, ay); ctx.lineTo(W, ay); }
            if (xMin <= 0 && xMax >= 0) { const ax = sx(0); ctx.moveTo(ax, 0); ctx.lineTo(ax, H); }
            ctx.stroke();

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

            // Draw Original f(x) Curve
            ctx.strokeStyle = FC; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.setLineDash([]);
            ctx.beginPath(); let on = false;
            for (let px = 0; px <= W; px++) {
                const y = evalSafe(fFn, xMin + (xMax - xMin) * (px / W), variable);
                if (!isFinite(y) || Math.abs(y) > 1e6) { if (on) { ctx.stroke(); ctx.beginPath(); } on = false; continue; }
                const py = toSy(y);
                if (py < -H * 4 || py > H * 5) { if (on) { ctx.stroke(); ctx.beginPath(); } on = false; continue; }
                on ? ctx.lineTo(px, py) : ctx.moveTo(px, py); on = true;
            }
            if (on) ctx.stroke();

            const progress = animProg.current;

            if (progress > 0 && progress <= 1) {
                const rx = xMin + (xMax - xMin) * progress;
                const rpx = toSx(rx);

                if (mode === 'derivative' && dFn) {
                    ctx.strokeStyle = DC; ctx.lineWidth = 2.5; ctx.setLineDash([]);
                    ctx.beginPath(); on = false;
                    for (let px = 0; px <= rpx; px++) {
                        const y = evalSafe(dFn, xMin + (xMax - xMin) * (px / W), variable);
                        if (!isFinite(y) || Math.abs(y) > 1e6) { if (on) { ctx.stroke(); ctx.beginPath(); } on = false; continue; }
                        const py = toSy(y);
                        if (py < -H * 4 || py > H * 5) { if (on) { ctx.stroke(); ctx.beginPath(); } on = false; continue; }
                        on ? ctx.lineTo(px, py) : ctx.moveTo(px, py); on = true;
                    }
                    if (on) ctx.stroke();

                    const fy = evalSafe(fFn, rx, variable);
                    const slope = numDeriv(fFn, rx, variable);
                    if (isFinite(fy) && isFinite(slope)) {
                        const tl = 52, dx = tl / Math.sqrt(1 + slope * slope);
                        const sdy = -slope * dx;
                        ctx.strokeStyle = TC; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
                        ctx.beginPath(); ctx.moveTo(rpx - dx, toSy(fy) + sdy); ctx.lineTo(rpx + dx, toSy(fy) - sdy); ctx.stroke();
                        ctx.setLineDash([]);

                        ctx.beginPath(); ctx.arc(rpx, toSy(fy), 5, 0, Math.PI * 2); ctx.fillStyle = TC; ctx.fill();
                        const dY = evalSafe(dFn, rx, variable);
                        if (isFinite(dY)) {
                            ctx.beginPath(); ctx.arc(rpx, toSy(dY), 4, 0, Math.PI * 2); ctx.fillStyle = DC; ctx.fill();
                        }
                    }
                } else if (mode === 'integral') {
                    const sp = toSx(xMin), zeroY = toSy(0);
                    ctx.fillStyle = AREA; ctx.strokeStyle = 'rgba(59,130,246,0.3)'; ctx.lineWidth = 1; ctx.setLineDash([]);
                    ctx.beginPath(); ctx.moveTo(sp, zeroY);
                    for (let px = sp; px <= rpx; px++) {
                        const y = evalSafe(fFn, xMin + (xMax - xMin) * (px / W), variable);
                        if (isFinite(y)) ctx.lineTo(px, toSy(y));
                    }
                    ctx.lineTo(rpx, zeroY); ctx.closePath(); ctx.fill(); ctx.stroke();

                    let cum = 0; const dxStep = (xMax - xMin) / W;
                    ctx.strokeStyle = DC; ctx.lineWidth = 2.5; ctx.setLineDash([]);
                    ctx.beginPath(); on = false;
                    for (let px = 0; px <= rpx; px++) {
                        const y = evalSafe(fFn, xMin + (xMax - xMin) * (px / W), variable);
                        if (isFinite(y)) cum += y * dxStep;
                        const py = toSy(cum);
                        if (py < -H * 4 || py > H * 5) { if (on) { ctx.stroke(); ctx.beginPath(); } on = false; continue; }
                        on ? ctx.lineTo(px, py) : ctx.moveTo(px, py); on = true;
                    }
                    if (on) ctx.stroke();

                    ctx.strokeStyle = 'rgba(217,119,6,0.35)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
                    ctx.beginPath(); ctx.moveTo(rpx, 0); ctx.lineTo(rpx, H); ctx.stroke(); ctx.setLineDash([]);
                }
            } else if (!animating || progress >= 1) {
                if (dFn) {
                    ctx.strokeStyle = DC; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.setLineDash([8, 5]);
                    ctx.beginPath(); on = false;
                    for (let px = 0; px <= W; px++) {
                        const y = evalSafe(dFn, xMin + (xMax - xMin) * (px / W), variable);
                        if (!isFinite(y) || Math.abs(y) > 1e6) { if (on) { ctx.stroke(); ctx.beginPath(); } on = false; continue; }
                        const py = toSy(y);
                        if (py < -H * 4 || py > H * 5) { if (on) { ctx.stroke(); ctx.beginPath(); } on = false; continue; }
                        on ? ctx.lineTo(px, py) : ctx.moveTo(px, py); on = true;
                    }
                    if (on) ctx.stroke(); ctx.setLineDash([]);
                }
            }
        };

        paint();

        if (animating) {
            const start = performance.now(), dur = 3000;
            const loop = (now: number) => {
                const t = Math.min((now - start) / dur, 1);
                animProg.current = t; paint();
                if (t < 1) { rafId = requestAnimationFrame(loop); animRef.current = rafId; }
                else { setAnimating(false); }
            };
            rafId = requestAnimationFrame(loop); animRef.current = rafId;
        }

        const ro = new ResizeObserver(() => paint());
        ro.observe(container);

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
            const dx = e.clientX - lastPan.x;
            const dy = e.clientY - lastPan.y;
            lastPan = { x: e.clientX, y: e.clientY };

            viewRef.current.cx -= dx / viewRef.current.scale;
            viewRef.current.cy += dy / viewRef.current.scale;
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
            cancelAnimationFrame(rafId);
            canvas.removeEventListener('wheel', onWheel);
            canvas.removeEventListener('pointerdown', onPointerDown);
            canvas.removeEventListener('pointermove', onPointerMove);
            canvas.removeEventListener('pointerup', onPointerUp);
            canvas.removeEventListener('pointercancel', onPointerUp);
        };
    }, [expr, derivExpr, variable, mode, isDark, animating, animProg, animRef, setAnimating]);

    return (
        <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
            <canvas
                ref={canvasRef}
                style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none' }}
            />
            <button onClick={animating ? stopAnim : startAnim} style={{
                position: 'absolute', top: 16, right: 16,
                padding: '8px 16px', borderRadius: 8,
                border: `1px solid ${animating ? 'rgba(239,68,68,0.4)' : 'rgba(217,119,6,0.4)'}`,
                background: animating ? 'rgba(239,68,68,0.1)' : 'rgba(217,119,6,0.1)',
                color: animating ? '#ef4444' : '#d97706',
                fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                fontFamily: 'system-ui', backdropFilter: 'blur(8px)', zIndex: 2,
            }}>{animating ? '⏹ Stop' : '▶ Animate'}</button>
        </div>
    );
}

/* ─── Main Component ─── */
export default function DerivativeIntegral() {
    const [expr, setExpr] = useState('x^3 + 2*x^2 - 5*x + 3');
    const [variable, setVariable] = useState('x');
    const [order, setOrder] = useState(1);
    const [mode, setMode] = useState<Mode>('derivative');
    const [showKB, setShowKB] = useState(false);
    const [steps, setSteps] = useState<StepEntry[]>([]);
    const [showSteps, setShowSteps] = useState(false);
    const [result, setResult] = useState('');
    const [derivExpr, setDerivExpr] = useState<string | null>(null);
    const [computed, setComputed] = useState(false);
    const [animating, setAnimating] = useState(false);
    const [show3D, setShow3D] = useState(false);
    const animProg = useRef(0);
    const animRef = useRef<number>(0);
    const inputRef = useRef<HTMLInputElement>(null);

    const isDark = useIsDark();

    const run = useCallback((m: Mode) => {
        setMode(m); setComputed(true); setShowSteps(false); animProg.current = 0; setAnimating(false);
        if (m === 'derivative') {
            setSteps(derivSteps(expr, variable, order));
            try {
                let cur = expr;
                for (let i = 0; i < order; i++) cur = simplify(derivative(cur, variable)).toString();
                setDerivExpr(cur); setResult(toLatex(parse(cur)));
            } catch { setDerivExpr(null); setResult(''); }
        } else {
            setSteps(intSteps(expr, variable)); setDerivExpr(null);
            try { setResult(toLatex(parse(symInt(parse(expr)))) + ' + C'); } catch { setResult(''); }
        }
    }, [expr, variable, order]);

    const insert = useCallback((text: string) => {
        const inp = inputRef.current;
        if (!inp) { setExpr(p => p + text); return; }
        const s = inp.selectionStart ?? expr.length, e = inp.selectionEnd ?? expr.length;
        setExpr(expr.slice(0, s) + text + expr.slice(e));
        requestAnimationFrame(() => { inp.focus(); inp.setSelectionRange(s + text.length, s + text.length); });
    }, [expr]);

    const handleBackspace = useCallback(() => {
        const i = inputRef.current;
        if (i) {
            const s = i.selectionStart ?? expr.length;
            if (s > 0) {
                setExpr(expr.slice(0, s - 1) + expr.slice(s));
                requestAnimationFrame(() => { i.focus(); i.setSelectionRange(s - 1, s - 1); });
            }
        }
    }, [expr]);

    const notation = mode === 'derivative' ? (order === 1 ? `f'(${variable})` : `f^{(${order})}(${variable})`) : `\\\\int f(${variable})\\\\,d${variable}`;

    const borderC = isDark ? '#27272a' : '#e4e4e7';
    const textDim = isDark ? '#9ca3af' : '#6b7280';
    const textPrimary = isDark ? '#ffffff' : '#000000';
    const inputBg = isDark ? '#18181b' : '#f3f4f6';
    const amber = '#d97706';
    const amberGlow = isDark ? 'rgba(217,119,6,0.1)' : 'rgba(217,119,6,0.08)';
    const sageBg = isDark ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.06)';

    const sidebar = (
        <>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: textDim }}>
                Function definition
            </div>

            {/* ─── Smart Toggle Input (shared) ─── */}
            <SmartMathInput
                value={expr}
                onChange={setExpr}
                onSubmit={() => run(mode)}
                variable={variable}
                isDark={isDark}
            />

            <button onClick={() => setShowKB(k => !k)} style={{
                background: showKB ? amberGlow : 'transparent', color: showKB ? amber : textDim,
                border: `1px solid ${borderC}`, borderRadius: 7, padding: '8px 10px',
                fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'system-ui',
                width: '100%', letterSpacing: 0.3, transition: 'all 0.1s'
            }}>
                {showKB ? '✕ Hide keyboard' : '⌨ Math keyboard'}
            </button>

            {/* ─── Math Keyboard (shared) ─── */}
            {showKB && (
                <MathKeyboard
                    onInsert={insert}
                    onBackspace={handleBackspace}
                    onClear={() => setExpr('')}
                    isDark={isDark}
                />
            )}

            <div style={{ display: 'flex', gap: 12 }}>
                {[
                    { label: 'Variable', el: <select value={variable} onChange={e => setVariable(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: `1px solid ${borderC}`, background: inputBg, color: textPrimary, fontSize: '0.9rem', outline: 'none' }}>{['x', 'y', 't'].map(v => <option key={v} value={v}>{v}</option>)}</select> },
                    { label: 'Order', el: <select value={order} onChange={e => setOrder(Number(e.target.value))} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: `1px solid ${borderC}`, background: inputBg, color: textPrimary, fontSize: '0.9rem', outline: 'none' }}>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`}</option>)}</select> },
                ].map(({ label, el }) => (
                    <div key={label} style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: textDim, marginBottom: 6 }}>{label}</div>
                        {el}
                    </div>
                ))}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                {([['derivative', 'd/dx  Diff'], ['integral', '∫  Integrate']] as [Mode, string][]).map(([m, label]) => (
                    <button key={m} onClick={() => run(m)} style={{
                        flex: 1, padding: '12px 6px',
                        border: `1px solid ${computed && mode === m ? amber : borderC}`,
                        borderRadius: 8, background: computed && mode === m ? amber : 'transparent',
                        color: computed && mode === m ? '#fff' : textDim,
                        fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                        fontFamily: 'system-ui', letterSpacing: 0.2, transition: 'all 0.1s',
                    }}>{label}</button>
                ))}
            </div>

            {computed && (
                <button onClick={() => setShow3D(true)} style={{
                    width: '100%', padding: '10px 14px', marginTop: 8,
                    border: `1px solid ${isDark ? 'rgba(0,221,255,0.25)' : 'rgba(0,100,200,0.2)'}`,
                    borderRadius: 8,
                    background: isDark ? 'rgba(0,221,255,0.06)' : 'rgba(0,100,200,0.04)',
                    color: isDark ? '#00ddff' : '#0066cc',
                    fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                    fontFamily: 'system-ui', letterSpacing: 0.3, transition: 'all 0.15s',
                }}>
                    🌌 Immersive 3D
                </button>
            )}

            {computed && result && (
                <div style={{
                    padding: '16px', background: mode === 'derivative' ? sageBg : amberGlow,
                    border: `1px solid ${mode === 'derivative' ? 'rgba(16,185,129,0.3)' : 'rgba(217,119,6,0.3)'}`,
                    borderRadius: 10, marginTop: 8
                }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2, color: mode === 'derivative' ? (isDark ? '#10b981' : '#059669') : amber, marginBottom: 10 }}>Answer</div>
                    <div style={{ fontSize: '1.2rem', overflowX: 'auto', color: textPrimary }}>
                        <Tex math={`${notation} = ${result}`} display />
                    </div>
                </div>
            )}

            {computed && steps.length > 0 && (
                <div>
                    <button onClick={() => setShowSteps(s => !s)} style={{
                        width: '100%', padding: '10px 14px', border: `1px solid ${borderC}`, borderRadius: 7,
                        background: showSteps ? inputBg : 'transparent', color: textDim, fontSize: '0.85rem',
                        fontWeight: 600, cursor: 'pointer', fontFamily: 'system-ui',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                        <span>Step by step</span>
                        <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>{showSteps ? '▲ hide' : '▼ show'}</span>
                    </button>
                    {showSteps && (
                        <div style={{ marginTop: 8, border: `1px solid ${borderC}`, borderRadius: 8, overflow: 'hidden' }}>
                            {steps.map((step, i) => (
                                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 14px', background: i % 2 === 0 ? inputBg : 'transparent', borderBottom: i < steps.length - 1 ? `1px solid ${borderC}` : 'none' }}>
                                    <span style={{ flex: '0 0 24px', width: 24, height: 24, borderRadius: '50%', background: amber, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, marginTop: 2 }}>{i + 1}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: textDim, marginBottom: 4 }}>{step.label}</div>
                                        <div style={{ fontSize: '1rem', overflowX: 'auto', color: textPrimary }}><Tex math={step.latex} /></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </>
    );

    const canvas = (
        <>
            {computed ? (
                <Graph
                    expr={expr} derivExpr={mode === 'derivative' ? derivExpr : null}
                    variable={variable} mode={mode}
                    animating={animating} setAnimating={setAnimating}
                    animProg={animProg} animRef={animRef}
                />
            ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: textDim, gap: 12 }}>
                    <span style={{ fontSize: '4rem', opacity: 0.15 }}>∫</span>
                    <span style={{ fontSize: '1rem' }}>Enter a function and compute</span>
                </div>
            )}

            {show3D && (
                <Suspense fallback={
                    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#050510', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(0,221,255,0.6)', fontSize: '1rem', letterSpacing: 2 }}>
                        Loading 3D…
                    </div>
                }>
                    <Immersive3D expr={expr} mode={mode} variable={variable} onClose={() => setShow3D(false)} />
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
