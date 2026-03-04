import { useRef, useEffect, useState } from 'react';

type Process = 'isothermal' | 'adiabatic' | 'isobaric' | 'isochoric';

export default function ThermoPV() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [process, setProcess] = useState<Process>('isothermal');
    const [v1, setV1] = useState(1);
    const [v2, setV2] = useState(4);
    const [p1, setP1] = useState(4);
    const [gamma, setGamma] = useState(1.4);

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
        const pad = 60;

        // Compute PV curve
        const nRT = p1 * v1; // for isothermal
        const C_ad = p1 * Math.pow(v1, gamma); // for adiabatic

        const getPressure = (v: number): number => {
            switch (process) {
                case 'isothermal': return nRT / v;
                case 'adiabatic': return C_ad / Math.pow(v, gamma);
                case 'isobaric': return p1;
                case 'isochoric': return p1; // vertical line at v1
            }
        };

        // Determine ranges
        const vMin = 0, vMax = Math.max(v1, v2) * 1.5;
        let pMax = p1 * 1.5;
        for (let i = 0; i <= 100; i++) {
            const v = Math.max(0.1, vMin + (vMax - vMin) * (i / 100));
            const p = getPressure(v);
            if (isFinite(p) && p > 0) pMax = Math.max(pMax, p * 1.2);
        }
        pMax = Math.min(pMax, p1 * 5);

        const toX = (v: number) => pad + ((v - vMin) / (vMax - vMin)) * (W - 2 * pad);
        const toY = (p: number) => (H - pad) - ((p) / pMax) * (H - 2 * pad);

        ctx.clearRect(0, 0, W, H);

        // Axes
        ctx.strokeStyle = isDark ? '#6b6358' : '#9c9488';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(pad, pad - 10); ctx.lineTo(pad, H - pad); ctx.lineTo(W - pad + 10, H - pad); ctx.stroke();

        // Grid
        ctx.strokeStyle = isDark ? '#2e2a24' : '#e8e0d4';
        ctx.lineWidth = 0.5;
        ctx.font = '10px monospace';
        ctx.fillStyle = isDark ? '#6b6358' : '#9c9488';
        for (let v = 0.5; v <= vMax; v += 0.5) {
            const x = toX(v);
            ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, H - pad); ctx.stroke();
            ctx.textAlign = 'center';
            ctx.fillText(`${v}`, x, H - pad + 16);
        }
        for (let p = 0; p <= pMax; p += Math.max(0.5, Math.floor(pMax / 8))) {
            if (p === 0) continue;
            const y = toY(p);
            if (y < pad) continue;
            ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W - pad, y); ctx.stroke();
            ctx.textAlign = 'right';
            ctx.fillText(`${p.toFixed(1)}`, pad - 8, y + 4);
        }

        // Axis labels
        ctx.font = 'bold 12px Sora, sans-serif';
        ctx.fillStyle = isDark ? '#e8e4de' : '#1a1612';
        ctx.textAlign = 'center';
        ctx.fillText('Volume (V)', W / 2, H - 10);
        ctx.save();
        ctx.translate(16, H / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('Pressure (P)', 0, 0);
        ctx.restore();

        // Shaded area (work done)
        if (process !== 'isochoric') {
            ctx.fillStyle = isDark ? 'rgba(107,143,113,0.15)' : 'rgba(107,143,113,0.12)';
            ctx.beginPath();
            ctx.moveTo(toX(v1), toY(0));
            const steps = 200;
            const vStart = Math.min(v1, v2), vEnd = Math.max(v1, v2);
            for (let i = 0; i <= steps; i++) {
                const v = vStart + (vEnd - vStart) * (i / steps);
                const p = getPressure(v);
                if (!isFinite(p) || p < 0) continue;
                ctx.lineTo(toX(v), toY(p));
            }
            ctx.lineTo(toX(v2), toY(0));
            ctx.closePath();
            ctx.fill();
        }

        // PV curve
        ctx.strokeStyle = isDark ? '#86efac' : '#6b8f71';
        ctx.lineWidth = 3;
        ctx.beginPath();
        if (process === 'isochoric') {
            // Vertical line
            const p2 = getPressure(v1);
            ctx.moveTo(toX(v1), toY(p1));
            ctx.lineTo(toX(v1), toY(p2 * 0.3)); // draw down to arbitrary lower pressure
        } else {
            const steps = 200;
            const vStart = Math.min(v1, v2), vEnd = Math.max(v1, v2);
            let first = true;
            for (let i = 0; i <= steps; i++) {
                const v = vStart + (vEnd - vStart) * (i / steps);
                const p = getPressure(v);
                if (!isFinite(p) || p < 0) continue;
                if (first) { ctx.moveTo(toX(v), toY(p)); first = false; }
                else ctx.lineTo(toX(v), toY(p));
            }
        }
        ctx.stroke();

        // State points
        const drawPoint = (v: number, p: number, label: string) => {
            ctx.fillStyle = isDark ? '#f59e0b' : '#d97706';
            ctx.beginPath();
            ctx.arc(toX(v), toY(p), 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = isDark ? '#fde68a' : '#d97706';
            ctx.font = 'bold 12px Sora, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(label, toX(v) + 10, toY(p) - 8);
        };

        drawPoint(v1, p1, `State 1 (${v1}, ${p1})`);
        const p2_end = getPressure(v2);
        if (process !== 'isochoric' && isFinite(p2_end) && p2_end > 0) {
            drawPoint(v2, p2_end, `State 2 (${v2}, ${p2_end.toFixed(2)})`);
        }

        // Work label
        if (process !== 'isochoric') {
            let work = 0;
            const steps = 1000;
            const vStart = Math.min(v1, v2), vEnd = Math.max(v1, v2);
            const dv = (vEnd - vStart) / steps;
            for (let i = 0; i < steps; i++) {
                const v = vStart + dv * (i + 0.5);
                work += getPressure(v) * dv;
            }
            ctx.font = 'bold 13px Sora, sans-serif';
            ctx.fillStyle = isDark ? '#86efac' : '#6b8f71';
            ctx.textAlign = 'center';
            ctx.fillText(`W = ∫PdV ≈ ${work.toFixed(3)} J`, W / 2, pad + 20);
        }

    }, [process, v1, v2, p1, gamma]);

    return (
        <div className="tool-card">
            <div className="tool-card-header">
                <h3>Thermodynamics PV Diagram</h3>
                <span className="subject-topic" style={{ background: 'var(--sage-glow)', color: 'var(--sage)' }}>Thermodynamics</span>
            </div>
            <div className="tool-card-body">
                <div className="tool-controls-row tool-controls-row--4">
                    <div className="tool-input-group">
                        <label>Process</label>
                        <select className="tool-input" value={process} onChange={e => setProcess(e.target.value as Process)}>
                            <option value="isothermal">Isothermal (PV = const)</option>
                            <option value="adiabatic">Adiabatic (PV^γ = const)</option>
                            <option value="isobaric">Isobaric (P = const)</option>
                            <option value="isochoric">Isochoric (V = const)</option>
                        </select>
                    </div>
                    <div className="tool-input-group">
                        <label>V₁</label>
                        <input className="tool-input" type="number" min={0.1} step={0.1} value={v1} onChange={e => setV1(+e.target.value)} />
                    </div>
                    <div className="tool-input-group">
                        <label>V₂</label>
                        <input className="tool-input" type="number" min={0.1} step={0.1} value={v2} onChange={e => setV2(+e.target.value)} />
                    </div>
                    <div className="tool-input-group">
                        <label>P₁</label>
                        <input className="tool-input" type="number" min={0.1} step={0.1} value={p1} onChange={e => setP1(+e.target.value)} />
                    </div>
                </div>

                {process === 'adiabatic' && (
                    <div className="tool-input-group" style={{ marginBottom: 16 }}>
                        <label>γ (heat capacity ratio): {gamma}</label>
                        <input type="range" min={1.1} max={2} step={0.05} value={gamma} onChange={e => setGamma(+e.target.value)}
                            style={{ width: '100%', accentColor: 'var(--sage)' }} />
                    </div>
                )}

                <div style={{ width: '100%', aspectRatio: '4/3', background: 'var(--bg-primary)', border: '1px solid var(--border-warm)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                    <canvas ref={canvasRef} style={{ display: 'block' }} />
                </div>
            </div>
        </div>
    );
}
