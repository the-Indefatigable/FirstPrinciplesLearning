import { useRef, useEffect, useState, useMemo } from 'react';

/**
 * BlackbodyCavity.tsx — Visual exploration of cavity modes and Planck's law.
 *
 * Three linked panels:
 *   1. Cavity (2D slice of 3D box) — pick (nx, ny) and see the standing wave.
 *      Toggle to overlay the two traveling waves that sum into it.
 *   2. Spectrum — Rayleigh-Jeans vs Wien vs Planck at adjustable T.
 *      Toggle "classical ↔ quantized" to see the UV catastrophe collapse.
 *   3. Mode occupancy — for each frequency bucket: g(f) slots, filled
 *      stochastically by Bose-Einstein ⟨n⟩. Shows high-f modes frozen out.
 */

type Tab = 'cavity' | 'spectrum' | 'occupancy';

// Physical constants (SI)
const H = 6.62607015e-34;
const KB = 1.380649e-23;
const C = 2.99792458e8;

// Planck spectral energy density u(f, T)
function planck(f: number, T: number): number {
    const x = (H * f) / (KB * T);
    if (x > 500) return 0;
    const pref = (8 * Math.PI * f * f) / (C * C * C);
    return pref * (H * f) / (Math.exp(x) - 1);
}
function rayleighJeans(f: number, T: number): number {
    return (8 * Math.PI * f * f) / (C * C * C) * KB * T;
}
function wien(f: number, T: number): number {
    const pref = (8 * Math.PI * f * f) / (C * C * C);
    return pref * H * f * Math.exp(-(H * f) / (KB * T));
}
// Bose-Einstein mean occupation
function bose(f: number, T: number): number {
    const x = (H * f) / (KB * T);
    if (x > 500) return 0;
    return 1 / (Math.exp(x) - 1);
}

export default function BlackbodyCavity() {
    const [tab, setTab] = useState<Tab>('cavity');

    return (
        <div className="tool-card">
            <div className="tool-card-header">
                <h3>Blackbody Cavity</h3>
                <span className="subject-topic" style={{ background: 'var(--sage-glow)', color: 'var(--sage)' }}>Quantum / Thermal</span>
            </div>
            <div className="tool-card-body">
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                    {(['cavity', 'spectrum', 'occupancy'] as Tab[]).map(t => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={tab === t ? 'tool-btn' : 'tool-btn tool-btn--outline'}
                            style={{ textTransform: 'capitalize' }}
                        >
                            {t === 'cavity' ? '1. Cavity Modes' : t === 'spectrum' ? '2. Spectrum' : '3. Mode Occupancy'}
                        </button>
                    ))}
                </div>

                {tab === 'cavity' && <CavityPanel />}
                {tab === 'spectrum' && <SpectrumPanel />}
                {tab === 'occupancy' && <OccupancyPanel />}
            </div>
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────
   PANEL 1 — Cavity Modes
   Show 4 plane waves traveling inside the box with k-vectors
   (±nx π, ±ny π). Their sum is the standing mode. User adds
   waves one at a time and watches the pattern emerge.
   ───────────────────────────────────────────────────────────── */
function CavityPanel() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animRef = useRef<number>(0);
    const [nx, setNx] = useState(3);
    const [ny, setNy] = useState(2);
    const [numWaves, setNumWaves] = useState(1); // 1..4
    const [paused, setPaused] = useState(false);
    const pausedRef = useRef(paused);
    pausedRef.current = paused;

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

        const W = rect.width, H_ = rect.height;
        let t = 0;

        // The 4 plane-wave components that sum to the standing mode.
        // ψ_std = sin(nx π u) sin(ny π v) cos(ω t)
        //       = (1/4) · Σ over signs (sx, sy) of sx*sy * cos(sx nx π u + sy ny π v − ω t)
        // sign combos: (+,+), (+,−), (−,+), (−,−)
        // We label each with a color and an entry-side arrow.
        const waveDefs = [
            { sx: +1, sy: +1, color: '#60a5fa', label: '→↑' }, // enters from bottom-left
            { sx: -1, sy: -1, color: '#f472b6', label: '←↓' }, // enters from top-right
            { sx: +1, sy: -1, color: '#34d399', label: '→↓' }, // enters from top-left
            { sx: -1, sy: +1, color: '#fbbf24', label: '←↑' }, // enters from bottom-right
        ];

        // Preallocate image buffer
        const img = ctx.createImageData(Math.floor(W), Math.floor(H_));

        const draw = () => {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

            // Layout: big square on left = cavity. Right column = small stacked previews
            // of each individual traveling wave (4 tiles).
            const PAD = 20;
            const rightColW = 150;
            const cavityAvail = W - rightColW - PAD * 3;
            const size = Math.min(cavityAvail, H_ - PAD * 2);
            const ox = PAD;
            const oy = (H_ - size) / 2;

            // Clear
            ctx.fillStyle = isDark ? '#141210' : '#faf8f5';
            ctx.fillRect(0, 0, W, H_);

            const omega = Math.sqrt(nx * nx + ny * ny);

            // Sum field psi(u,v,t) over the first `numWaves` components.
            // Each component contributes (sx*sy) * cos(sx nx π u + sy ny π v − ω t).
            // Dividing by numWaves keeps brightness bounded regardless of count.
            const compute = (u: number, v: number) => {
                let s = 0;
                for (let i = 0; i < numWaves; i++) {
                    const { sx, sy } = waveDefs[i];
                    s += sx * sy * Math.cos(sx * nx * Math.PI * u + sy * ny * Math.PI * v - omega * t);
                }
                return s / numWaves;
            };

            // Paint cavity interior
            const data = img.data;
            const iw = img.width;
            // Clear previous frame's cavity region in the image buffer
            for (let py = 0; py < Math.floor(H_); py++) {
                for (let px = 0; px < Math.floor(W); px++) {
                    const i = (py * iw + px) * 4;
                    const insideCavity =
                        px >= ox && px <= ox + size &&
                        py >= oy && py <= oy + size;
                    if (!insideCavity) {
                        data[i + 3] = 0;
                        continue;
                    }
                    const u = (px - ox) / size;
                    const v = 1 - (py - oy) / size; // flip y
                    const a = Math.max(-1, Math.min(1, compute(u, v)));
                    // Warm/cool mapping; |a|=1 → bright white-amber (constructive)
                    const mag = Math.abs(a);
                    let r: number, g: number, b: number;
                    if (a >= 0) {
                        // warm (amber)
                        r = Math.round(255 * mag + 20);
                        g = Math.round(180 * mag + 10);
                        b = Math.round(40 * mag);
                    } else {
                        // cool (blue)
                        r = Math.round(40 * mag);
                        g = Math.round(130 * mag + 10);
                        b = Math.round(255 * mag + 20);
                    }
                    data[i] = Math.min(255, r);
                    data[i + 1] = Math.min(255, g);
                    data[i + 2] = Math.min(255, b);
                    data[i + 3] = Math.round(255 * mag * 0.9 + 25);
                }
            }
            ctx.putImageData(img, 0, 0);

            // Cavity border (mirror walls)
            ctx.strokeStyle = isDark ? '#d4a373' : '#7c5a3d';
            ctx.lineWidth = 3;
            ctx.strokeRect(ox, oy, size, size);

            // Draw arrows showing incoming direction of each active wave
            const drawArrow = (side: 'bl' | 'tr' | 'tl' | 'br', color: string, label: string) => {
                const len = 26;
                let sx1 = 0, sy1 = 0, sx2 = 0, sy2 = 0;
                if (side === 'bl') { sx1 = ox - len - 4; sy1 = oy + size + len + 4; sx2 = ox - 4; sy2 = oy + size + 4; }
                if (side === 'tr') { sx1 = ox + size + len + 4; sy1 = oy - len - 4; sx2 = ox + size + 4; sy2 = oy - 4; }
                if (side === 'tl') { sx1 = ox - len - 4; sy1 = oy - len - 4; sx2 = ox - 4; sy2 = oy - 4; }
                if (side === 'br') { sx1 = ox + size + len + 4; sy1 = oy + size + len + 4; sx2 = ox + size + 4; sy2 = oy + size + 4; }
                ctx.strokeStyle = color;
                ctx.fillStyle = color;
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.moveTo(sx1, sy1);
                ctx.lineTo(sx2, sy2);
                ctx.stroke();
                // arrowhead
                const ang = Math.atan2(sy2 - sy1, sx2 - sx1);
                ctx.beginPath();
                ctx.moveTo(sx2, sy2);
                ctx.lineTo(sx2 - 7 * Math.cos(ang - 0.4), sy2 - 7 * Math.sin(ang - 0.4));
                ctx.lineTo(sx2 - 7 * Math.cos(ang + 0.4), sy2 - 7 * Math.sin(ang + 0.4));
                ctx.closePath();
                ctx.fill();
                ctx.font = 'bold 10px Sora, sans-serif';
                ctx.fillText(label, sx1 - 4, sy1 + 4);
            };
            const corners: Array<'bl' | 'tr' | 'tl' | 'br'> = ['bl', 'tr', 'tl', 'br'];
            for (let i = 0; i < numWaves; i++) {
                drawArrow(corners[i], waveDefs[i].color, waveDefs[i].label);
            }

            // Right column: 4 mini previews, each showing ONE traveling wave alone.
            const tileX = ox + size + PAD;
            const tileW = rightColW;
            const tileH = (H_ - PAD * 5) / 4;
            for (let i = 0; i < 4; i++) {
                const tx = tileX;
                const ty = PAD + i * (tileH + PAD / 1.5);
                const active = i < numWaves;
                // Tile background
                ctx.fillStyle = isDark ? '#1a1714' : '#f0ebe3';
                ctx.fillRect(tx, ty, tileW, tileH);
                ctx.strokeStyle = active ? waveDefs[i].color : (isDark ? '#3d3530' : '#d4cec6');
                ctx.lineWidth = active ? 2 : 1;
                ctx.strokeRect(tx, ty, tileW, tileH);

                // Render this single wave's field into a small region
                const steps = 26;
                const cellW = tileW / steps;
                const cellH = (tileH - 20) / steps;
                for (let yy = 0; yy < steps; yy++) {
                    for (let xx = 0; xx < steps; xx++) {
                        const u = xx / (steps - 1);
                        const v = 1 - yy / (steps - 1);
                        const { sx, sy } = waveDefs[i];
                        const a = sx * sy * Math.cos(sx * nx * Math.PI * u + sy * ny * Math.PI * v - omega * t);
                        const mag = Math.abs(a);
                        const col = waveDefs[i].color;
                        ctx.globalAlpha = active ? mag * 0.9 : mag * 0.2;
                        ctx.fillStyle = col;
                        ctx.fillRect(tx + xx * cellW, ty + 16 + yy * cellH, cellW + 0.5, cellH + 0.5);
                    }
                }
                ctx.globalAlpha = 1;
                ctx.font = 'bold 10px Sora, sans-serif';
                ctx.fillStyle = active ? waveDefs[i].color : (isDark ? '#6b5f52' : '#9c9488');
                ctx.textAlign = 'left';
                ctx.fillText(`Wave ${i + 1}  ${waveDefs[i].label}`, tx + 6, ty + 12);
            }

            // Header text
            ctx.font = 'bold 13px Sora, sans-serif';
            ctx.fillStyle = isDark ? '#f0e6d6' : '#2e2a24';
            ctx.textAlign = 'left';
            ctx.fillText(
                numWaves === 4
                    ? `Sum of 4 waves = standing mode (${nx}, ${ny})`
                    : `${numWaves} of 4 waves active — keep adding to see the mode form`,
                ox, oy - 8
            );

            if (!pausedRef.current) t += 0.04;
            animRef.current = requestAnimationFrame(draw);
        };

        draw();
        return () => cancelAnimationFrame(animRef.current);
    }, [nx, ny, numWaves]);

    return (
        <div>
            <div className="tool-controls-row--3" style={{ marginBottom: 12 }}>
                <div>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>nx = {nx}</label>
                    <input type="range" min={1} max={8} value={nx} onChange={e => setNx(+e.target.value)} style={{ width: '100%' }} />
                </div>
                <div>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>ny = {ny}</label>
                    <input type="range" min={1} max={8} value={ny} onChange={e => setNy(+e.target.value)} style={{ width: '100%' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'flex-end' }}>
                    <button className="tool-btn tool-btn--outline" onClick={() => setPaused(p => !p)}>
                        {paused ? 'Play' : 'Pause'}
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', alignSelf: 'center', marginRight: 6 }}>
                    Waves in box:
                </span>
                {[1, 2, 3, 4].map(n => (
                    <button
                        key={n}
                        onClick={() => setNumWaves(n)}
                        className={numWaves === n ? 'tool-btn' : 'tool-btn tool-btn--outline'}
                        style={{ padding: '6px 14px' }}
                    >
                        {n}
                    </button>
                ))}
            </div>

            <div style={{ width: '100%', aspectRatio: '16/9', background: 'var(--bg-primary)', border: '1px solid var(--border-warm)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <canvas ref={canvasRef} style={{ display: 'block' }} />
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)', marginTop: 10, lineHeight: 1.55 }}>
                Start with <strong>1 wave</strong>: a single plane wave travels across the box at an angle set by (nx, ny). You'll see moving stripes — that's the wave, not a standing mode. Add <strong>wave 2</strong>: the reflection off the opposite wall (opposite k-vector). Stripes start to lock in place in one direction. Add <strong>3, then 4</strong>: all reflections combined. The moving stripes freeze into a checkerboard of bright and dark spots — that's the standing mode (nx, ny). <strong>Bright spots = all 4 waves adding constructively. Dark lines = they cancel exactly.</strong> That cancellation is why only integer (nx, ny) survive — any other wavelength would not self-reinforce and would fade away after enough bounces.
            </p>
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────
   PANEL 2 — Spectrum
   Rayleigh-Jeans vs Wien vs Planck, toggle classical↔quantum.
   ───────────────────────────────────────────────────────────── */
function SpectrumPanel() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [T, setT] = useState(5000);
    const [showRJ, setShowRJ] = useState(true);
    const [showWien, setShowWien] = useState(true);
    const [showPlanck, setShowPlanck] = useState(true);
    const [logY, setLogY] = useState(false);

    // Frequency domain: pick range that covers visible+IR+UV for this T
    const { fMin, fMax, planckPeak } = useMemo(() => {
        // Wien displacement: f_peak ≈ 2.82 kT/h
        const fPeak = 2.82 * KB * T / H;
        return { fMin: fPeak * 0.02, fMax: fPeak * 5, planckPeak: planck(fPeak, T) };
    }, [T]);

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

        const W = rect.width, H_ = rect.height;
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        ctx.fillStyle = isDark ? '#1a1714' : '#faf8f5';
        ctx.fillRect(0, 0, W, H_);

        const padL = 50, padR = 20, padT = 20, padB = 40;
        const plotW = W - padL - padR;
        const plotH = H_ - padT - padB;

        // Scale: y-axis normalized to ~3x Planck peak so UV catastrophe is visible
        const yMax = planckPeak * 3;
        const yToPx = (y: number) => {
            if (logY) {
                const lo = Math.log10(planckPeak * 1e-4);
                const hi = Math.log10(yMax);
                const v = y <= 0 ? lo : Math.log10(y);
                return padT + plotH * (1 - (v - lo) / (hi - lo));
            }
            return padT + plotH * (1 - y / yMax);
        };
        const xToPx = (f: number) => padL + plotW * ((f - fMin) / (fMax - fMin));

        // Axes
        ctx.strokeStyle = isDark ? '#3d3530' : '#d4cec6';
        ctx.lineWidth = 1;
        ctx.strokeRect(padL, padT, plotW, plotH);

        // Wien peak marker
        const fPeak = 2.82 * KB * T / H;
        ctx.strokeStyle = isDark ? 'rgba(217,119,6,0.4)' : 'rgba(180,83,9,0.4)';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(xToPx(fPeak), padT);
        ctx.lineTo(xToPx(fPeak), padT + plotH);
        ctx.stroke();
        ctx.setLineDash([]);

        const drawCurve = (fn: (f: number) => number, color: string, width: number) => {
            ctx.strokeStyle = color;
            ctx.lineWidth = width;
            ctx.beginPath();
            let started = false;
            for (let px = 0; px <= plotW; px++) {
                const f = fMin + (px / plotW) * (fMax - fMin);
                const y = fn(f);
                const yPx = yToPx(y);
                if (yPx < padT || !isFinite(yPx)) continue;
                if (!started) { ctx.moveTo(padL + px, yPx); started = true; }
                else ctx.lineTo(padL + px, yPx);
            }
            ctx.stroke();
        };

        if (showRJ) drawCurve(f => rayleighJeans(f, T), '#ef4444', 2.5);
        if (showWien) drawCurve(f => wien(f, T), '#8b5cf6', 2);
        if (showPlanck) drawCurve(f => planck(f, T), '#22c55e', 3);

        // Labels
        ctx.font = '11px Sora, sans-serif';
        ctx.fillStyle = isDark ? '#a89984' : '#6b5f52';
        ctx.textAlign = 'center';
        ctx.fillText('frequency f (Hz) →', padL + plotW / 2, H_ - 10);
        ctx.save();
        ctx.translate(14, padT + plotH / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('spectral energy density u(f, T)', 0, 0);
        ctx.restore();

        // fPeak label
        ctx.textAlign = 'center';
        ctx.fillStyle = isDark ? '#d97706' : '#b45309';
        ctx.fillText(`peak ≈ ${(fPeak / 1e14).toFixed(2)}×10¹⁴ Hz`, xToPx(fPeak), padT + 14);

        // Legend
        ctx.textAlign = 'left';
        ctx.font = 'bold 11px Sora, sans-serif';
        let ly = padT + 10;
        const legend = [
            [showRJ, '#ef4444', 'Rayleigh–Jeans (classical) → UV catastrophe'],
            [showPlanck, '#22c55e', 'Planck (quantized: E = nhf)'],
            [showWien, '#8b5cf6', 'Wien (high-f empirical fit)'],
        ] as const;
        for (const [on, col, label] of legend) {
            if (!on) continue;
            ctx.fillStyle = col;
            ctx.fillRect(padL + 10, ly - 8, 14, 3);
            ctx.fillStyle = isDark ? '#f0e6d6' : '#2e2a24';
            ctx.fillText(label, padL + 30, ly);
            ly += 16;
        }
    }, [T, showRJ, showWien, showPlanck, logY, fMin, fMax, planckPeak]);

    return (
        <div>
            <div className="tool-controls-row--3" style={{ marginBottom: 12 }}>
                <div>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>Temperature: {T} K</label>
                    <input type="range" min={500} max={10000} step={100} value={T} onChange={e => setT(+e.target.value)} style={{ width: '100%' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: '0.78rem' }}><input type="checkbox" checked={showRJ} onChange={e => setShowRJ(e.target.checked)} /> Rayleigh–Jeans</label>
                    <label style={{ fontSize: '0.78rem' }}><input type="checkbox" checked={showPlanck} onChange={e => setShowPlanck(e.target.checked)} /> Planck</label>
                    <label style={{ fontSize: '0.78rem' }}><input type="checkbox" checked={showWien} onChange={e => setShowWien(e.target.checked)} /> Wien</label>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'flex-end' }}>
                    <button className="tool-btn tool-btn--outline" onClick={() => setLogY(l => !l)}>
                        Y-axis: {logY ? 'log' : 'linear'}
                    </button>
                </div>
            </div>
            <div style={{ width: '100%', aspectRatio: '16/9', background: 'var(--bg-primary)', border: '1px solid var(--border-warm)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <canvas ref={canvasRef} style={{ display: 'block' }} />
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)', marginTop: 10, lineHeight: 1.55 }}>
                The red curve is what classical physics predicts: g(f)·kT ∝ f²·kT — it diverges. The real data (green, Planck) rises, peaks near 2.82 kT/h, then falls. Planck's fix: a mode of frequency f can only hold energy in lumps of size <strong>hf</strong>. High-f modes demand a big entry fee, so the thermal bath can't afford to excite them → exponential cutoff e<sup>−hf/kT</sup>.
            </p>
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────
   PANEL 3 — Mode Occupancy
   Buckets of frequency. For each bucket: draw g(f) slots, fill
   each slot with ⟨n⟩ = 1/(exp(hf/kT)-1) quanta.
   ───────────────────────────────────────────────────────────── */
function OccupancyPanel() {
    const [T, setT] = useState(5000);
    const NUM_BUCKETS = 9;

    const buckets = useMemo(() => {
        const fPeak = 2.82 * KB * T / H;
        const fMax = fPeak * 3.5;
        const fMin = fPeak * 0.15;
        const out: { f: number; slots: number; mean: number }[] = [];
        for (let i = 0; i < NUM_BUCKETS; i++) {
            const f = fMin + (i / (NUM_BUCKETS - 1)) * (fMax - fMin);
            // Slot count proportional to g(f) ∝ f². Scale so biggest bucket has ~14 slots.
            const g = (f * f) / (fMax * fMax);
            const slots = Math.max(2, Math.round(2 + g * 14));
            const mean = bose(f, T);
            out.push({ f, slots, mean });
        }
        return out;
    }, [T]);

    return (
        <div>
            <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>Temperature: {T} K</label>
                <input type="range" min={500} max={10000} step={100} value={T} onChange={e => setT(+e.target.value)} style={{ width: '100%', maxWidth: 360 }} />
            </div>

            <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-warm)', borderRadius: 'var(--radius-md)', padding: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 70px', gap: 10, alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: 8, fontWeight: 600 }}>
                    <div>frequency</div>
                    <div>slots g(f) ∝ f² · filled by ⟨n⟩</div>
                    <div style={{ textAlign: 'right' }}>⟨n⟩</div>
                </div>
                {buckets.map((b, i) => {
                    // Visual: each slot is a cell. Fill with darker shade based on mean occupation.
                    // Cap the visual quanta at 6 per slot.
                    const fillShade = Math.min(1, b.mean / 3);
                    const hue = 30 + (i / NUM_BUCKETS) * 200; // low f warm, high f cool
                    const color = `hsl(${hue}, 70%, 55%)`;
                    const isFrozen = b.mean < 0.05;
                    return (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 70px', gap: 10, alignItems: 'center', marginBottom: 4 }}>
                            <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-dim)' }}>
                                {(b.f / 1e14).toFixed(1)}e14 Hz
                            </div>
                            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                                {Array.from({ length: b.slots }).map((_, k) => (
                                    <div
                                        key={k}
                                        title={`mode slot #${k + 1}`}
                                        style={{
                                            width: 18, height: 18,
                                            borderRadius: 3,
                                            border: `1.5px solid ${color}`,
                                            background: isFrozen
                                                ? 'transparent'
                                                : `color-mix(in srgb, ${color} ${Math.round(fillShade * 85 + 10)}%, transparent)`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: 9,
                                            color: isFrozen ? color : '#fff',
                                            fontWeight: 700,
                                        }}
                                    >
                                        {isFrozen ? '' : b.mean >= 0.5 ? (b.mean >= 10 ? '∞' : b.mean.toFixed(0)) : '·'}
                                    </div>
                                ))}
                            </div>
                            <div style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '0.78rem', color: isFrozen ? '#94a3b8' : 'var(--text-primary)' }}>
                                {b.mean < 0.001 ? '≈0' : b.mean.toFixed(2)}
                            </div>
                        </div>
                    );
                })}
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)', marginTop: 12, lineHeight: 1.55 }}>
                Each square is one mode (one allowed standing-wave pattern). Low frequencies have few slots but they're all stuffed with quanta. High frequencies have <em>way more</em> slots (g ∝ f²) but the thermal bath can't afford the hf entry fee, so they sit empty — <strong>frozen out</strong>. Total energy = (slots) × (mean occupation) × hf. That product peaks and then falls, giving the real blackbody curve.
            </p>
        </div>
    );
}
