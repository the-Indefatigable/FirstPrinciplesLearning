import React, { useRef, useEffect, useState, useCallback, lazy, Suspense } from 'react';
import { drawBackground, drawGlowDot, MANIM } from '../../utils/manimCanvas';
import ImmersiveToggle from '../../components/ImmersiveToggle';
import '../../components/ImmersiveToggle.css';

const ComplexPlotterImmersive = lazy(() => import('./ComplexPlotterImmersive'));

interface ComplexNum { re: number; im: number; }

const add = (a: ComplexNum, b: ComplexNum): ComplexNum => ({ re: a.re + b.re, im: a.im + b.im });
const mul = (a: ComplexNum, b: ComplexNum): ComplexNum => ({
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
});
const mag = (a: ComplexNum) => Math.sqrt(a.re * a.re + a.im * a.im);
const arg = (a: ComplexNum) => Math.atan2(a.im, a.re);

export default function ComplexPlotter() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [zA, setZA] = useState<ComplexNum>({ re: 3, im: 2 });
    const [zB, setZB] = useState<ComplexNum>({ re: -1, im: 1 });
    const [op, setOp] = useState<'add' | 'multiply'>('add');

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

    const result = op === 'add' ? add(zA, zB) : mul(zA, zB);

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
        const cx = W / 2, cy = H / 2;
        const scale = Math.min(W, H) / 14;

        const toX = (re: number) => cx + re * scale;
        const toY = (im: number) => cy - im * scale;

        drawBackground(ctx, W, H);

        // Grid
        ctx.strokeStyle = 'rgba(88, 196, 221, 0.07)';
        ctx.lineWidth = 0.5;
        for (let i = -7; i <= 7; i++) {
            ctx.beginPath(); ctx.moveTo(toX(i), 0); ctx.lineTo(toX(i), H); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, toY(i)); ctx.lineTo(W, toY(i)); ctx.stroke();
        }

        // Axes with glow
        ctx.save(); ctx.strokeStyle = 'rgba(200, 210, 225, 0.08)'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(W, cy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke();
        ctx.restore();
        ctx.strokeStyle = 'rgba(200, 210, 225, 0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(W, cy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke();

        // Axis labels
        ctx.font = '11px "JetBrains Mono", monospace';
        ctx.fillStyle = 'rgba(200, 210, 225, 0.45)';
        ctx.textAlign = 'center';
        ctx.fillText('Re', W - 16, cy - 8);
        ctx.fillText('Im', cx + 14, 16);

        const drawVec = (z: ComplexNum, color: string, label: string) => {
            // Glow pass
            ctx.save();
            ctx.globalAlpha = 0.15;
            ctx.strokeStyle = color;
            ctx.lineWidth = 6;
            ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(toX(z.re), toY(z.im)); ctx.stroke();
            ctx.restore();

            // Core line
            ctx.strokeStyle = color;
            ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(toX(z.re), toY(z.im)); ctx.stroke();

            // Arrow head
            const len = Math.sqrt(z.re * z.re + z.im * z.im);
            if (len > 0.1) {
                const ux = z.re / len, uy = z.im / len;
                const ax = toX(z.re), ay = toY(z.im);
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.moveTo(ax, ay);
                ctx.lineTo(ax - (ux * 8 + uy * 4), ay + (uy * 8 - ux * 4));
                ctx.lineTo(ax - (ux * 8 - uy * 4), ay + (uy * 8 + ux * 4));
                ctx.fill();
            }

            // Point (glow dot)
            drawGlowDot(ctx, toX(z.re), toY(z.im), color, { radius: 5 });

            // Label
            ctx.font = 'bold 11px "JetBrains Mono", monospace';
            ctx.fillStyle = color;
            ctx.textAlign = 'left';
            ctx.fillText(label, toX(z.re) + 10, toY(z.im) - 8);
        };

        drawVec(zA, MANIM.blue, `z₁ = ${zA.re}${zA.im >= 0 ? '+' : ''}${zA.im}i`);
        drawVec(zB, MANIM.green, `z₂ = ${zB.re}${zB.im >= 0 ? '+' : ''}${zB.im}i`);

        // Result
        if (op === 'add') {
            // Parallelogram
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = 'rgba(200, 210, 225, 0.2)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(toX(zA.re), toY(zA.im));
            ctx.lineTo(toX(result.re), toY(result.im));
            ctx.lineTo(toX(zB.re), toY(zB.im));
            ctx.stroke();
            ctx.setLineDash([]);
        }

        drawVec(result, MANIM.yellow, `${op === 'add' ? 'z₁+z₂' : 'z₁×z₂'} = ${result.re.toFixed(2)}${result.im >= 0 ? '+' : ''}${result.im.toFixed(2)}i`);

        // Unit circle (faint)
        ctx.strokeStyle = 'rgba(88, 196, 221, 0.15)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(cx, cy, scale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

    }, [zA, zB, op]);

    const fmt = (z: ComplexNum) => `|z| = ${mag(z).toFixed(3)}, θ = ${(arg(z) * 180 / Math.PI).toFixed(1)}°`;

    return (
        <div className="tool-card">
            <div className="tool-card-header">
                <h3>Complex Number Plotter</h3>
                <span className="subject-topic" style={{ background: 'var(--amber-soft)', color: 'var(--amber)' }}>Complex Analysis</span>
            </div>
            <div className="tool-card-body">
                <div className="tool-controls-row tool-controls-row--3">
                    <div className="tool-input-group">
                        <label>z₁ (Re, Im)</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <input className="tool-input" type="number" value={zA.re} onChange={e => setZA(p => ({ ...p, re: +e.target.value }))} style={{ flex: 1 }} />
                            <input className="tool-input" type="number" value={zA.im} onChange={e => setZA(p => ({ ...p, im: +e.target.value }))} style={{ flex: 1 }} />
                        </div>
                    </div>
                    <div className="tool-input-group">
                        <label>z₂ (Re, Im)</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <input className="tool-input" type="number" value={zB.re} onChange={e => setZB(p => ({ ...p, re: +e.target.value }))} style={{ flex: 1 }} />
                            <input className="tool-input" type="number" value={zB.im} onChange={e => setZB(p => ({ ...p, im: +e.target.value }))} style={{ flex: 1 }} />
                        </div>
                    </div>
                    <div className="tool-input-group">
                        <label>Operation</label>
                        <select className="tool-input" value={op} onChange={e => setOp(e.target.value as 'add' | 'multiply')}>
                            <option value="add">Addition (z₁ + z₂)</option>
                            <option value="multiply">Multiplication (z₁ × z₂)</option>
                        </select>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: '0.82rem', color: MANIM.blue }}>z₁: {fmt(zA)}</div>
                    <div style={{ fontSize: '0.82rem', color: MANIM.green }}>z₂: {fmt(zB)}</div>
                    <div style={{ fontSize: '0.82rem', color: MANIM.yellow, fontWeight: 600 }}>Result: {fmt(result)}</div>
                </div>

                <div
                    ref={containerRef}
                    style={{
                        width: '100%', aspectRatio: '4/3', background: '#0f1117',
                        border: '1px solid rgba(88, 196, 221, 0.1)', borderRadius: 'var(--radius-md)',
                        overflow: 'hidden', position: 'relative',
                        boxShadow: '0 0 40px rgba(88, 196, 221, 0.03), inset 0 0 60px rgba(15, 17, 23, 0.5)',
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
                                <ComplexPlotterImmersive
                                    zA={zA}
                                    zB={zB}
                                    op={op}
                                    result={result}
                                />
                            </ImmersiveLoadWrapper>
                        </Suspense>
                    )}
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
