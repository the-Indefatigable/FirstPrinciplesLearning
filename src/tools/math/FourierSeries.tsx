import { useRef, useState, useEffect, useCallback } from 'react';

/* ═══════════════════════════════════════════════════════════════════════
   FOURIER SERIES VISUALIZER
   Build any periodic function from sine/cosine harmonics.
   ═══════════════════════════════════════════════════════════════════════ */

type WaveType = 'square' | 'sawtooth' | 'triangle' | 'custom';

// Fourier coefficients for standard waves
function coefficient(kind: WaveType, n: number): number {
    if (kind === 'square') {
        // Only odd harmonics: 4/(nπ) for odd n
        return n % 2 === 0 ? 0 : 4 / (n * Math.PI);
    }
    if (kind === 'sawtooth') {
        // All harmonics: 2(-1)^(n+1) / (nπ)
        return 2 * Math.pow(-1, n + 1) / (n * Math.PI);
    }
    if (kind === 'triangle') {
        // Only odd harmonics: 8(-1)^((n-1)/2) / (n²π²)
        if (n % 2 === 0) return 0;
        return 8 * Math.pow(-1, (n - 1) / 2) / (n * n * Math.PI * Math.PI);
    }
    return 0;
}

export default function FourierSeries() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const boxRef = useRef<HTMLDivElement>(null);
    const animRef = useRef(0);
    const tRef = useRef(0);

    const [wave, setWave] = useState<WaveType>('square');
    const [terms, setTerms] = useState(5);
    const [showTarget, setShowTarget] = useState(true);
    const [showHarmonics, setShowHarmonics] = useState(true);
    const [playing, setPlaying] = useState(true);

    const paint = useCallback(() => {
        const cvs = canvasRef.current;
        const box = boxRef.current;
        if (!cvs || !box) return;
        const ctx = cvs.getContext('2d');
        if (!ctx) return;

        const r = box.getBoundingClientRect();
        const dpr = window.devicePixelRatio;
        cvs.width = r.width * dpr;
        cvs.height = r.height * dpr;
        ctx.scale(dpr, dpr);
        const W = r.width, H = r.height;

        const dark = document.documentElement.getAttribute('data-theme') === 'dark';
        const bg = dark ? '#1a1612' : '#faf8f5';
        const grid = dark ? '#242018' : '#ece6da';
        const dim = dark ? '#6b6358' : '#9c9488';
        const primary = '#d97706';
        const target = dark ? 'rgba(217,119,6,0.25)' : 'rgba(217,119,6,0.15)';

        // Background
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);

        // Layout: left = circle epicycles, right = waveform graph
        const circleR = Math.min(H * 0.35, 100);
        const cx = circleR + 40;
        const cy = H / 2;
        const graphLeft = cx + circleR + 60;
        const graphRight = W - 20;
        const graphW = graphRight - graphLeft;

        // Grid lines for graph
        ctx.strokeStyle = grid;
        ctx.lineWidth = 0.5;
        for (let x = graphLeft; x <= graphRight; x += 40) {
            ctx.beginPath(); ctx.moveTo(x, 20); ctx.lineTo(x, H - 20); ctx.stroke();
        }
        ctx.beginPath(); ctx.moveTo(graphLeft, cy); ctx.lineTo(graphRight, cy); ctx.stroke();

        // Axis labels
        ctx.font = '10px Sora, sans-serif';
        ctx.fillStyle = dim;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText('1', graphLeft - 6, cy - circleR);
        ctx.fillText('−1', graphLeft - 6, cy + circleR);
        ctx.fillText('0', graphLeft - 6, cy);

        const t = tRef.current;

        // ── Draw target waveform (the ideal function) ──
        if (showTarget) {
            ctx.strokeStyle = target;
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            for (let px = 0; px <= graphW; px++) {
                const phase = (px / graphW) * 4 * Math.PI + t;
                let val = 0;
                // Compute with lots of terms for "ideal"
                for (let n = 1; n <= 200; n++) {
                    val += coefficient(wave, n) * Math.sin(n * phase);
                }
                const y = cy - val * circleR;
                px === 0 ? ctx.moveTo(graphLeft + px, y) : ctx.lineTo(graphLeft + px, y);
            }
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // ── Draw each harmonic individually ──
        const harmonicColors = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6', '#f97316'];
        if (showHarmonics) {
            for (let n = 1; n <= terms; n++) {
                const bn = coefficient(wave, n);
                if (Math.abs(bn) < 1e-10) continue;
                ctx.strokeStyle = harmonicColors[(n - 1) % harmonicColors.length];
                ctx.lineWidth = 1;
                ctx.globalAlpha = 0.35;
                ctx.beginPath();
                for (let px = 0; px <= graphW; px++) {
                    const phase = (px / graphW) * 4 * Math.PI + t;
                    const val = bn * Math.sin(n * phase);
                    const y = cy - val * circleR;
                    px === 0 ? ctx.moveTo(graphLeft + px, y) : ctx.lineTo(graphLeft + px, y);
                }
                ctx.stroke();
                ctx.globalAlpha = 1;
            }
        }

        // ── Draw partial sum (the approximation) ──
        ctx.strokeStyle = primary;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let px = 0; px <= graphW; px++) {
            const phase = (px / graphW) * 4 * Math.PI + t;
            let val = 0;
            for (let n = 1; n <= terms; n++) {
                val += coefficient(wave, n) * Math.sin(n * phase);
            }
            const y = cy - val * circleR;
            px === 0 ? ctx.moveTo(graphLeft + px, y) : ctx.lineTo(graphLeft + px, y);
        }
        ctx.stroke();

        // ── Draw epicycle circles on the left ──
        let ex = cx, ey = cy;
        for (let n = 1; n <= terms; n++) {
            const bn = coefficient(wave, n);
            if (Math.abs(bn) < 1e-10) continue;
            const radius = Math.abs(bn) * circleR;

            // Circle outline
            ctx.strokeStyle = dim;
            ctx.lineWidth = 0.8;
            ctx.globalAlpha = 0.4;
            ctx.beginPath();
            ctx.arc(ex, ey, radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;

            // Rotating arm
            const angle = n * t;
            const nx = ex + radius * Math.cos(angle - Math.PI / 2);
            const ny = ey - radius * Math.sin(angle - Math.PI / 2);

            ctx.strokeStyle = harmonicColors[(n - 1) % harmonicColors.length];
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(ex, ey);
            ctx.lineTo(nx, ny);
            ctx.stroke();

            // Small dot at the tip
            ctx.fillStyle = harmonicColors[(n - 1) % harmonicColors.length];
            ctx.beginPath();
            ctx.arc(nx, ny, 2.5, 0, Math.PI * 2);
            ctx.fill();

            ex = nx;
            ey = ny;
        }

        // Connecting line from epicycle tip to waveform start
        ctx.strokeStyle = primary;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(graphLeft, ey);
        ctx.stroke();
        ctx.setLineDash([]);

        // Dot on waveform at t=0
        ctx.fillStyle = primary;
        ctx.beginPath();
        ctx.arc(graphLeft, ey, 4, 0, Math.PI * 2);
        ctx.fill();

        // ── Info ──
        ctx.font = 'bold 12px Sora, sans-serif';
        ctx.fillStyle = dark ? '#e8e4de' : '#1a1612';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(`${wave.charAt(0).toUpperCase() + wave.slice(1)} wave — ${terms} term${terms > 1 ? 's' : ''}`, 14, 14);

    }, [wave, terms, showTarget, showHarmonics]);

    useEffect(() => {
        let running = true;
        const loop = () => {
            if (!running) return;
            if (playing) tRef.current += 0.025;
            paint();
            animRef.current = requestAnimationFrame(loop);
        };
        loop();
        return () => { running = false; cancelAnimationFrame(animRef.current); };
    }, [paint, playing]);

    return (
        <div className="tool-card">
            <div className="tool-card-header">
                <h3>Fourier Series</h3>
                <span className="subject-topic" style={{ background: 'var(--amber-soft)', color: 'var(--amber)' }}>Signals</span>
            </div>
            <div className="tool-card-body">
                <div className="tool-controls-row" style={{ flexWrap: 'wrap', gap: 8 }}>
                    <div className="tool-input-group">
                        <label>Waveform</label>
                        <select value={wave} onChange={e => setWave(e.target.value as WaveType)}>
                            <option value="square">Square</option>
                            <option value="sawtooth">Sawtooth</option>
                            <option value="triangle">Triangle</option>
                        </select>
                    </div>
                    <div className="tool-input-group">
                        <label>Harmonics (N = {terms})</label>
                        <input type="range" min={1} max={40} value={terms} onChange={e => setTerms(+e.target.value)}
                            style={{ width: 140, accentColor: 'var(--amber)' }} />
                    </div>
                    <div className="tool-input-group" style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                        <button className={`tool-btn${playing ? '' : ' tool-btn--outline'}`} onClick={() => setPlaying(!playing)}>
                            {playing ? '⏸ Pause' : '▶ Play'}
                        </button>
                        <button className={`tool-btn${showTarget ? '' : ' tool-btn--outline'}`} onClick={() => setShowTarget(!showTarget)}>
                            Target
                        </button>
                        <button className={`tool-btn${showHarmonics ? '' : ' tool-btn--outline'}`} onClick={() => setShowHarmonics(!showHarmonics)}>
                            Harmonics
                        </button>
                    </div>
                </div>

                <div ref={boxRef} style={{
                    width: '100%', aspectRatio: '16/9',
                    background: 'var(--bg-primary)', border: '1px solid var(--border-warm)',
                    borderRadius: 'var(--radius-md)', overflow: 'hidden',
                }}>
                    <canvas ref={canvasRef} style={{ display: 'block' }} />
                </div>

                <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: 8 }}>
                    Watch epicycles construct the wave. Increase N to see the sum converge to the target. Gibbs phenomenon is visible at discontinuities.
                </p>
            </div>
        </div>
    );
}
