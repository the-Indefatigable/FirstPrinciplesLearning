import { useRef, useState, useEffect, useCallback } from 'react';
import { drawBackground, drawGlowCurve, drawGlowDot, MANIM, type CurvePoint } from '../../utils/manimCanvas';

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
    const [playing, setPlaying] = useState(false);

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

        // Background
        drawBackground(ctx, W, H);

        // Layout: left = circle epicycles, right = waveform graph
        const circleR = Math.min(H * 0.35, 100);
        const cx = circleR + 40;
        const cy = H / 2;
        const graphLeft = cx + circleR + 60;
        const graphRight = W - 20;
        const graphW = graphRight - graphLeft;

        // Grid lines for graph
        ctx.strokeStyle = 'rgba(88, 196, 221, 0.07)';
        ctx.lineWidth = 0.5;
        for (let x = graphLeft; x <= graphRight; x += 40) {
            ctx.beginPath(); ctx.moveTo(x, 20); ctx.lineTo(x, H - 20); ctx.stroke();
        }
        ctx.beginPath(); ctx.moveTo(graphLeft, cy); ctx.lineTo(graphRight, cy); ctx.stroke();

        // Axis labels
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillStyle = 'rgba(200, 210, 225, 0.45)';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText('1', graphLeft - 6, cy - circleR);
        ctx.fillText('−1', graphLeft - 6, cy + circleR);
        ctx.fillText('0', graphLeft - 6, cy);

        const t = tRef.current;

        // ── Draw target waveform (the ideal function) ──
        if (showTarget) {
            const targetPoints: CurvePoint[] = [];
            for (let px = 0; px <= graphW; px++) {
                const phase = (px / graphW) * 4 * Math.PI + t;
                let val = 0;
                for (let n = 1; n <= 200; n++) {
                    val += coefficient(wave, n) * Math.sin(n * phase);
                }
                targetPoints.push({ x: graphLeft + px, y: cy - val * circleR });
            }
            drawGlowCurve(ctx, targetPoints, '#F4D03F', { dashed: true, glowIntensity: 0.5 });
        }

        // ── Draw each harmonic individually ──
        if (showHarmonics) {
            for (let n = 1; n <= terms; n++) {
                const bn = coefficient(wave, n);
                if (Math.abs(bn) < 1e-10) continue;
                const hPoints: CurvePoint[] = [];
                for (let px = 0; px <= graphW; px++) {
                    const phase = (px / graphW) * 4 * Math.PI + t;
                    const val = bn * Math.sin(n * phase);
                    hPoints.push({ x: graphLeft + px, y: cy - val * circleR });
                }
                ctx.save();
                ctx.globalAlpha = 0.3;
                drawGlowCurve(ctx, hPoints, MANIM.palette[(n - 1) % MANIM.palette.length], { glowIntensity: 0.3 });
                ctx.restore();
            }
        }

        // ── Draw partial sum (the approximation — glowing) ──
        const approxPoints: CurvePoint[] = [];
        for (let px = 0; px <= graphW; px++) {
            const phase = (px / graphW) * 4 * Math.PI + t;
            let val = 0;
            for (let n = 1; n <= terms; n++) {
                val += coefficient(wave, n) * Math.sin(n * phase);
            }
            approxPoints.push({ x: graphLeft + px, y: cy - val * circleR });
        }
        drawGlowCurve(ctx, approxPoints, '#58C4DD');

        // ── Draw epicycle circles on the left ──
        let ex = cx, ey = cy;
        for (let n = 1; n <= terms; n++) {
            const bn = coefficient(wave, n);
            if (Math.abs(bn) < 1e-10) continue;
            const radius = Math.abs(bn) * circleR;

            // Circle outline
            ctx.strokeStyle = 'rgba(200, 210, 225, 0.15)';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.arc(ex, ey, radius, 0, Math.PI * 2);
            ctx.stroke();

            // Rotating arm
            const angle = n * t;
            const nx = ex + radius * Math.cos(angle - Math.PI / 2);
            const ny = ey - radius * Math.sin(angle - Math.PI / 2);

            ctx.strokeStyle = MANIM.palette[(n - 1) % MANIM.palette.length];
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(ex, ey);
            ctx.lineTo(nx, ny);
            ctx.stroke();

            // Small dot at the tip
            drawGlowDot(ctx, nx, ny, MANIM.palette[(n - 1) % MANIM.palette.length], { radius: 2.5 });

            ex = nx;
            ey = ny;
        }

        // Connecting line from epicycle tip to waveform start
        ctx.strokeStyle = '#58C4DD';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(graphLeft, ey);
        ctx.stroke();
        ctx.setLineDash([]);

        // Dot on waveform at t=0
        drawGlowDot(ctx, graphLeft, ey, '#58C4DD', { radius: 4 });

        // ── Info ──
        ctx.font = 'bold 11px "JetBrains Mono", monospace';
        ctx.fillStyle = MANIM.white;
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
                    background: '#0f1117', border: '1px solid rgba(88, 196, 221, 0.1)',
                    borderRadius: 'var(--radius-md)', overflow: 'hidden',
                    boxShadow: '0 0 40px rgba(88, 196, 221, 0.03), inset 0 0 60px rgba(15, 17, 23, 0.5)',
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
