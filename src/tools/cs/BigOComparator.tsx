import { useRef, useEffect, useState } from 'react';

const COMPLEXITIES = [
    { name: 'O(1)', fn: () => 1, color: '#22c55e' },
    { name: 'O(log n)', fn: (n: number) => Math.log2(n), color: '#3b82f6' },
    { name: 'O(n)', fn: (n: number) => n, color: '#f59e0b' },
    { name: 'O(n log n)', fn: (n: number) => n * Math.log2(n), color: '#f97316' },
    { name: 'O(n²)', fn: (n: number) => n * n, color: '#ef4444' },
    { name: 'O(2ⁿ)', fn: (n: number) => Math.pow(2, n), color: '#8b5cf6' },
];

export default function BigOComparator() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [maxN, setMaxN] = useState(20);
    const [enabled, setEnabled] = useState<boolean[]>(COMPLEXITIES.map(() => true));

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
        const pad = { top: 30, right: 30, bottom: 50, left: 60 };
        const chartW = W - pad.left - pad.right;
        const chartH = H - pad.top - pad.bottom;

        ctx.clearRect(0, 0, W, H);

        // Compute max Y
        let yMax = 10;
        for (let i = 0; i < COMPLEXITIES.length; i++) {
            if (!enabled[i]) continue;
            const v = COMPLEXITIES[i].fn(maxN);
            if (isFinite(v)) yMax = Math.max(yMax, v);
        }
        // Use log scale for Y if exponential is enabled
        const useLogY = enabled[5] && maxN > 10;
        const logMax = Math.log10(Math.max(yMax, 10));

        const toX = (n: number) => pad.left + (n / maxN) * chartW;
        const toY = (val: number) => {
            if (useLogY) {
                const logVal = Math.log10(Math.max(val, 0.1));
                return pad.top + chartH - (logVal / logMax) * chartH;
            }
            return pad.top + chartH - (val / yMax) * chartH;
        };

        // Grid
        ctx.strokeStyle = isDark ? '#2e2a24' : '#e8e0d4';
        ctx.lineWidth = 0.5;
        ctx.font = '10px monospace';
        ctx.fillStyle = isDark ? '#6b6358' : '#9c9488';

        // X grid
        const xStep = maxN <= 20 ? 2 : maxN <= 50 ? 5 : 10;
        for (let n = 0; n <= maxN; n += xStep) {
            const x = toX(n);
            ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, pad.top + chartH); ctx.stroke();
            ctx.textAlign = 'center';
            ctx.fillText(`${n}`, x, pad.top + chartH + 16);
        }

        // Y grid
        if (useLogY) {
            for (let p = 0; p <= logMax; p++) {
                const val = Math.pow(10, p);
                const y = toY(val);
                ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + chartW, y); ctx.stroke();
                ctx.textAlign = 'right';
                ctx.fillText(`10^${p}`, pad.left - 8, y + 4);
            }
        } else {
            const yStep = Math.pow(10, Math.floor(Math.log10(yMax / 5)));
            for (let v = 0; v <= yMax; v += yStep) {
                const y = toY(v);
                ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + chartW, y); ctx.stroke();
                ctx.textAlign = 'right';
                ctx.fillText(`${v}`, pad.left - 8, y + 4);
            }
        }

        // Axes
        ctx.strokeStyle = isDark ? '#6b6358' : '#9c9488';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(pad.left, pad.top);
        ctx.lineTo(pad.left, pad.top + chartH);
        ctx.lineTo(pad.left + chartW, pad.top + chartH);
        ctx.stroke();

        // Labels
        ctx.font = 'bold 12px Sora, sans-serif';
        ctx.fillStyle = isDark ? '#e8e4de' : '#1a1612';
        ctx.textAlign = 'center';
        ctx.fillText('Input Size (n)', W / 2, H - 8);
        ctx.save();
        ctx.translate(14, H / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(useLogY ? 'Operations (log scale)' : 'Operations', 0, 0);
        ctx.restore();

        // Curves
        for (let i = 0; i < COMPLEXITIES.length; i++) {
            if (!enabled[i]) continue;
            const { fn, color } = COMPLEXITIES[i];

            ctx.strokeStyle = color;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            let started = false;
            for (let n = 1; n <= maxN; n += 0.5) {
                const val = fn(n);
                if (!isFinite(val) || val < 0) continue;
                const x = toX(n), y = toY(val);
                if (y < pad.top - 10) continue;
                if (!started) { ctx.moveTo(x, y); started = true; }
                else ctx.lineTo(x, y);
            }
            ctx.stroke();

            // End label
            const endVal = fn(maxN);
            if (isFinite(endVal)) {
                const endY = Math.max(pad.top, toY(endVal));
                ctx.font = 'bold 11px Sora, sans-serif';
                ctx.fillStyle = color;
                ctx.textAlign = 'left';
                ctx.fillText(COMPLEXITIES[i].name, toX(maxN) + 6, endY + 4);
            }
        }
    }, [maxN, enabled]);

    return (
        <div className="tool-card">
            <div className="tool-card-header">
                <h3>Big-O Complexity Comparator</h3>
                <span className="subject-topic" style={{ background: 'var(--terracotta-glow)', color: 'var(--terracotta)' }}>Algorithms</span>
            </div>
            <div className="tool-card-body">
                <div className="tool-input-group" style={{ marginBottom: 16 }}>
                    <label>Max N: {maxN}</label>
                    <input type="range" min={5} max={100} value={maxN} onChange={e => setMaxN(+e.target.value)}
                        style={{ width: '100%', accentColor: 'var(--terracotta)' }} />
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                    {COMPLEXITIES.map((c, i) => (
                        <button key={c.name} onClick={() => setEnabled(prev => prev.map((v, j) => j === i ? !v : v))}
                            style={{
                                padding: '6px 14px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                                border: `2px solid ${c.color}`,
                                background: enabled[i] ? c.color : 'transparent',
                                color: enabled[i] ? 'white' : c.color,
                                fontSize: '0.82rem', fontWeight: 700, fontFamily: 'monospace',
                                transition: 'all 0.15s ease',
                            }}>
                            {c.name}
                        </button>
                    ))}
                </div>

                <div style={{ width: '100%', aspectRatio: '16/9', background: 'var(--bg-primary)', border: '1px solid var(--border-warm)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                    <canvas ref={canvasRef} style={{ display: 'block' }} />
                </div>
            </div>
        </div>
    );
}
