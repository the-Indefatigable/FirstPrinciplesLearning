import { useRef, useState, useEffect, useCallback } from 'react';

/* ═══════════════════════════════════════════════════════════════════════
   LAPLACE TRANSFORM VISUALIZER
   Shows the s-plane (pole-zero plot), the time-domain impulse response,
   and the frequency response (Bode magnitude).
   ═══════════════════════════════════════════════════════════════════════ */

interface Preset {
    name: string;
    label: string;
    description: string;
    // Transfer function H(s) = K × Π(s - zeros) / Π(s - poles)
    poles: { re: number; im: number }[];
    zeros: { re: number; im: number }[];
    K: number;
}

const PRESETS: Preset[] = [
    {
        name: 'first-order', label: '1/(s+a)',
        description: 'First-order low-pass: single real pole at s = −a',
        poles: [{ re: -2, im: 0 }], zeros: [], K: 2,
    },
    {
        name: 'second-order', label: 'ω²/(s²+2ζωs+ω²)',
        description: 'Second-order underdamped system',
        poles: [{ re: -1, im: 3 }, { re: -1, im: -3 }], zeros: [], K: 10,
    },
    {
        name: 'resonant', label: 'Resonant Pair',
        description: 'Lightly damped resonance — sharp frequency peak',
        poles: [{ re: -0.3, im: 5 }, { re: -0.3, im: -5 }], zeros: [], K: 25.09,
    },
    {
        name: 'lead', label: 'Lead Compensator',
        description: 'A zero faster than the pole adds phase lead',
        poles: [{ re: -10, im: 0 }], zeros: [{ re: -2, im: 0 }], K: 10,
    },
    {
        name: 'notch', label: 'Notch Filter',
        description: 'Zeros on the jω axis cancel a specific frequency',
        poles: [{ re: -1, im: 5 }, { re: -1, im: -5 }], zeros: [{ re: 0, im: 5 }, { re: 0, im: -5 }], K: 1,
    },
    {
        name: 'integrator', label: '1/s',
        description: 'Pure integrator — pole at the origin',
        poles: [{ re: 0, im: 0 }], zeros: [], K: 1,
    },
];

// Evaluate H(jω) = K × Π(jω − z_i) / Π(jω − p_i)
function evalH(w: number, poles: { re: number; im: number }[], zeros: { re: number; im: number }[], K: number): { mag: number; phase: number } {
    let numRe = K, numIm = 0;
    for (const z of zeros) {
        const dre = -z.re;  // (jω - z) real part = -z.re
        const dim = w - z.im;
        const newRe = numRe * dre - numIm * dim;
        const newIm = numRe * dim + numIm * dre;
        numRe = newRe; numIm = newIm;
    }
    let denRe = 1, denIm = 0;
    for (const p of poles) {
        const dre = -p.re;
        const dim = w - p.im;
        const newRe = denRe * dre - denIm * dim;
        const newIm = denRe * dim + denIm * dre;
        denRe = newRe; denIm = newIm;
    }
    const denMag2 = denRe * denRe + denIm * denIm;
    if (denMag2 < 1e-20) return { mag: 1e6, phase: 0 };
    const hRe = (numRe * denRe + numIm * denIm) / denMag2;
    const hIm = (numIm * denRe - numRe * denIm) / denMag2;
    return { mag: Math.sqrt(hRe * hRe + hIm * hIm), phase: Math.atan2(hIm, hRe) };
}

// Impulse response h(t) for simple cases via inverse Laplace:
function impulseResponse(t: number, poles: { re: number; im: number }[], K: number): number {
    if (t < 0) return 0;
    // For two conjugate poles: K * e^(σt) * sin(ωt) / ω  (underdamped)
    // For single real pole: K * e^(pt)
    if (poles.length === 1) {
        return K * Math.exp(poles[0].re * t);
    }
    if (poles.length === 2 && Math.abs(poles[0].im + poles[1].im) < 1e-6) {
        const sigma = poles[0].re;
        const omega = Math.abs(poles[0].im);
        if (omega < 0.01) return K * Math.exp(sigma * t);
        return (K / omega) * Math.exp(sigma * t) * Math.sin(omega * t);
    }
    // Fallback: sum of exponentials
    let sum = 0;
    for (const p of poles) {
        sum += Math.exp(p.re * t) * Math.cos(p.im * t);
    }
    return K * sum / poles.length;
}

export default function LaplaceTransform() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const boxRef = useRef<HTMLDivElement>(null);

    const [presetIdx, setPresetIdx] = useState(1);
    const preset = PRESETS[presetIdx];

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
        cvs.style.width = `${r.width}px`;
        cvs.style.height = `${r.height}px`;
        const W = r.width, H = r.height;

        const dark = document.documentElement.getAttribute('data-theme') === 'dark';
        const bg = dark ? '#1a1612' : '#faf8f5';
        const gridCol = dark ? '#242018' : '#ece6da';
        const dim = dark ? '#6b6358' : '#9c9488';
        const txt = dark ? '#e8e4de' : '#1a1612';

        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);

        // Layout: 3 panels — s-plane (left), time domain (top-right), freq domain (bottom-right)
        const sPlaneW = Math.min(W * 0.35, 280);
        const rightL = sPlaneW + 20;
        const rightW = W - rightL - 15;
        const topH = (H - 30) / 2;
        const botY = topH + 30;

        // ═══ S-PLANE ═══
        const sCenter = { x: sPlaneW / 2, y: H / 2 };
        const sScale = Math.min(sPlaneW, H) / 16; // pixels per unit

        // Grid
        ctx.strokeStyle = gridCol; ctx.lineWidth = 0.5;
        for (let i = -8; i <= 8; i++) {
            const x = sCenter.x + i * sScale;
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
            const y = sCenter.y + i * sScale;
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(sPlaneW, y); ctx.stroke();
        }
        // Axes (jω and σ)
        ctx.strokeStyle = dim; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, sCenter.y); ctx.lineTo(sPlaneW, sCenter.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(sCenter.x, 0); ctx.lineTo(sCenter.x, H); ctx.stroke();

        // Stability region shading (left half-plane)
        ctx.fillStyle = dark ? 'rgba(34,197,94,0.04)' : 'rgba(34,197,94,0.06)';
        ctx.fillRect(0, 0, sCenter.x, H);

        // Labels
        ctx.font = 'bold 11px Sora, sans-serif';
        ctx.fillStyle = txt;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText('s-plane', sPlaneW / 2, 16);
        ctx.font = '9px Sora, sans-serif';
        ctx.fillStyle = dim;
        ctx.textBaseline = 'top';
        ctx.fillText('σ', sPlaneW - 8, sCenter.y + 4);
        ctx.textAlign = 'right';
        ctx.fillText('jω', sCenter.x - 4, 6);

        // Draw poles (×) and zeros (○)
        for (const z of preset.zeros) {
            const px = sCenter.x + z.re * sScale;
            const py = sCenter.y - z.im * sScale;
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.stroke();
        }
        for (const p of preset.poles) {
            const px = sCenter.x + p.re * sScale;
            const py = sCenter.y - p.im * sScale;
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 2.5;
            const sz = 6;
            ctx.beginPath(); ctx.moveTo(px - sz, py - sz); ctx.lineTo(px + sz, py + sz); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(px + sz, py - sz); ctx.lineTo(px - sz, py + sz); ctx.stroke();
        }

        // Legend
        ctx.font = '9px Sora, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = '#ef4444';
        ctx.fillText('× Pole', 8, H - 18);
        ctx.fillStyle = '#3b82f6';
        ctx.fillText('○ Zero', 8, H - 6);

        // ═══ TIME DOMAIN (impulse response) ═══
        const tMax = 8;
        const tSteps = 300;

        ctx.font = 'bold 11px Sora, sans-serif';
        ctx.fillStyle = txt;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('Impulse Response h(t)', rightL, 4);

        // Compute
        const hVals: number[] = [];
        for (let i = 0; i <= tSteps; i++) {
            hVals.push(impulseResponse((i / tSteps) * tMax, preset.poles, preset.K));
        }
        const hMax = Math.max(0.01, ...hVals.map(Math.abs));

        // Grid
        ctx.strokeStyle = gridCol; ctx.lineWidth = 0.5;
        const tBaseY = topH - 5;
        const tMid = 20 + (tBaseY - 20) / 2;
        ctx.beginPath(); ctx.moveTo(rightL, tMid); ctx.lineTo(rightL + rightW, tMid); ctx.stroke();

        // Waveform
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i <= tSteps; i++) {
            const x = rightL + (i / tSteps) * rightW;
            const y = tMid - (hVals[i] / hMax) * (tBaseY - 20) * 0.45;
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Axis labels
        ctx.font = '9px Sora, sans-serif';
        ctx.fillStyle = dim;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('t (seconds)', rightL + rightW / 2, tBaseY + 2);

        // ═══ FREQUENCY RESPONSE (Bode magnitude) ═══
        ctx.font = 'bold 11px Sora, sans-serif';
        ctx.fillStyle = txt;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('|H(jω)| — Magnitude', rightL, botY - 12);

        // Compute
        const fSteps = 300;
        const wMax = 15;
        const magVals: number[] = [];
        for (let i = 0; i <= fSteps; i++) {
            const w = (i / fSteps) * wMax;
            const { mag } = evalH(w, preset.poles, preset.zeros, preset.K);
            magVals.push(mag);
        }
        const mMax = Math.max(0.01, ...magVals);

        // Grid
        ctx.strokeStyle = gridCol; ctx.lineWidth = 0.5;
        const fBaseY = H - 15;
        const fTopY = botY + 5;
        ctx.beginPath(); ctx.moveTo(rightL, fBaseY); ctx.lineTo(rightL + rightW, fBaseY); ctx.stroke();

        // Magnitude curve
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i <= fSteps; i++) {
            const x = rightL + (i / fSteps) * rightW;
            const y = fBaseY - (magVals[i] / mMax) * (fBaseY - fTopY) * 0.9;
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Fill under curve
        ctx.fillStyle = dark ? 'rgba(168,85,247,0.08)' : 'rgba(168,85,247,0.06)';
        ctx.lineTo(rightL + rightW, fBaseY);
        ctx.lineTo(rightL, fBaseY);
        ctx.closePath();
        ctx.fill();

        // Axis labels
        ctx.font = '9px Sora, sans-serif';
        ctx.fillStyle = dim;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('ω (rad/s)', rightL + rightW / 2, fBaseY + 2);

    }, [preset]);

    useEffect(() => { paint(); }, [paint]);
    useEffect(() => { window.addEventListener('resize', paint); return () => window.removeEventListener('resize', paint); }, [paint]);

    return (
        <div className="tool-card">
            <div className="tool-card-header">
                <h3>Laplace Transform</h3>
                <span className="subject-topic" style={{ background: 'var(--amber-soft)', color: 'var(--amber)' }}>Signals & Systems</span>
            </div>
            <div className="tool-card-body">
                <div className="tool-controls-row" style={{ flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
                    <div className="tool-input-group" style={{ flex: 1, minWidth: 160 }}>
                        <label>Transfer Function</label>
                        <select value={presetIdx} onChange={e => setPresetIdx(+e.target.value)}>
                            {PRESETS.map((p, i) => (
                                <option key={p.name} value={i}>{p.label}</option>
                            ))}
                        </select>
                    </div>
                    <div style={{ flex: 2, fontSize: '0.82rem', color: 'var(--text-dim)', alignSelf: 'flex-end', lineHeight: 1.4 }}>
                        {preset.description}
                        <br />
                        <span style={{ color: '#ef4444' }}>Poles: {preset.poles.map(p => `${p.re}${p.im >= 0 ? '+' : ''}${p.im}j`).join(', ')}</span>
                        {preset.zeros.length > 0 && (
                            <> · <span style={{ color: '#3b82f6' }}>Zeros: {preset.zeros.map(z => `${z.re}${z.im >= 0 ? '+' : ''}${z.im}j`).join(', ')}</span></>
                        )}
                    </div>
                </div>

                <div ref={boxRef} style={{
                    width: '100%', aspectRatio: '16/8',
                    background: 'var(--bg-primary)', border: '1px solid var(--border-warm)',
                    borderRadius: 'var(--radius-md)', overflow: 'hidden',
                }}>
                    <canvas ref={canvasRef} style={{ display: 'block' }} />
                </div>

                <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: 8 }}>
                    Left: s-plane with poles (×) and zeros (○). Stable systems have all poles in the left half-plane (green). Top-right: impulse response h(t). Bottom-right: frequency response magnitude |H(jω)|.
                </p>
            </div>
        </div>
    );
}
