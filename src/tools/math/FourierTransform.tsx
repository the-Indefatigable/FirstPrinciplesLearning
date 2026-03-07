import { useRef, useState, useEffect, useCallback } from 'react';

/* ═══════════════════════════════════════════════════════════════════════
   FOURIER TRANSFORM (DFT) VISUALIZER
   Compose a signal from sinusoids, then see its frequency spectrum.
   ═══════════════════════════════════════════════════════════════════════ */

interface Tone { freq: number; amp: number; phase: number; }

function dft(signal: number[]): { freq: number; amp: number; phase: number }[] {
    const N = signal.length;
    const result: { freq: number; amp: number; phase: number }[] = [];
    for (let k = 0; k <= N / 2; k++) {
        let re = 0, im = 0;
        for (let n = 0; n < N; n++) {
            const angle = (2 * Math.PI * k * n) / N;
            re += signal[n] * Math.cos(angle);
            im -= signal[n] * Math.sin(angle);
        }
        re /= N; im /= N;
        result.push({ freq: k, amp: 2 * Math.sqrt(re * re + im * im), phase: Math.atan2(im, re) });
    }
    // DC component doesn't need the ×2
    if (result.length > 0) result[0].amp /= 2;
    return result;
}

export default function FourierTransform() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const boxRef = useRef<HTMLDivElement>(null);

    const [tones, setTones] = useState<Tone[]>([
        { freq: 3, amp: 1, phase: 0 },
        { freq: 7, amp: 0.5, phase: 0 },
        { freq: 12, amp: 0.3, phase: Math.PI / 4 },
    ]);
    const [sampleRate] = useState(128);

    const updateTone = (idx: number, field: keyof Tone, val: number) => {
        setTones(prev => prev.map((t, i) => i === idx ? { ...t, [field]: val } : t));
    };

    const addTone = () => {
        setTones(prev => [...prev, { freq: Math.floor(Math.random() * 20) + 1, amp: 0.5, phase: 0 }]);
    };

    const removeTone = (idx: number) => {
        setTones(prev => prev.filter((_, i) => i !== idx));
    };

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
        const gridCol = dark ? '#242018' : '#ece6da';
        const dim = dark ? '#6b6358' : '#9c9488';
        const txt = dark ? '#e8e4de' : '#1a1612';
        const signalCol = '#d97706';
        const specCol = '#3b82f6';

        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);

        // Layout: top half = time domain, bottom half = frequency domain
        const midY = H / 2;
        const padL = 50, padR = 20, padT = 30, padB = 25;
        const gW = W - padL - padR;

        // ── Generate signal ──
        const signal: number[] = [];
        for (let n = 0; n < sampleRate; n++) {
            let v = 0;
            for (const t of tones) {
                v += t.amp * Math.sin(2 * Math.PI * t.freq * n / sampleRate + t.phase);
            }
            signal.push(v);
        }

        // ── DFT ──
        const spectrum = dft(signal);
        const maxAmp = Math.max(0.01, ...signal.map(Math.abs));
        const maxSpec = Math.max(0.01, ...spectrum.map(s => s.amp));

        // ── Time domain plot ──
        const tH = midY - padT - 10;
        const tY = padT + tH / 2;

        // Grid
        ctx.strokeStyle = gridCol; ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.moveTo(padL, tY); ctx.lineTo(padL + gW, tY); ctx.stroke();
        for (let x = padL; x <= padL + gW; x += 40) { ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, midY - 10); ctx.stroke(); }

        // Axis label
        ctx.font = 'bold 11px Sora, sans-serif';
        ctx.fillStyle = txt;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('Time Domain — f(t)', padL, 8);

        ctx.font = '9px Sora, sans-serif';
        ctx.fillStyle = dim;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${maxAmp.toFixed(1)}`, padL - 4, padT);
        ctx.fillText(`−${maxAmp.toFixed(1)}`, padL - 4, midY - 10);
        ctx.fillText('0', padL - 4, tY);

        // Signal waveform
        ctx.strokeStyle = signalCol;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < signal.length; i++) {
            const x = padL + (i / (signal.length - 1)) * gW;
            const y = tY - (signal[i] / maxAmp) * (tH / 2 - 4);
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();

        // ── Frequency domain plot ──
        const fH = H - midY - padB - 10;
        const fBase = H - padB;


        // Label
        ctx.font = 'bold 11px Sora, sans-serif';
        ctx.fillStyle = txt;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('Frequency Domain — |F(ω)|', padL, midY + 4);

        // Grid
        ctx.strokeStyle = gridCol; ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.moveTo(padL, fBase); ctx.lineTo(padL + gW, fBase); ctx.stroke();

        // Spectrum bars
        const barW = Math.max(2, gW / spectrum.length - 2);
        for (let k = 0; k < spectrum.length; k++) {
            const x = padL + (k / spectrum.length) * gW;
            const barH = (spectrum[k].amp / maxSpec) * fH * 0.85;

            // Bar
            ctx.fillStyle = specCol;
            ctx.globalAlpha = 0.7;
            ctx.fillRect(x, fBase - barH, barW, barH);
            ctx.globalAlpha = 1;

            // Highlight if matches a user tone
            const match = tones.find(t => t.freq === k);
            if (match) {
                ctx.strokeStyle = '#f59e0b';
                ctx.lineWidth = 2;
                ctx.strokeRect(x - 1, fBase - barH - 1, barW + 2, barH + 2);

                // Frequency label
                ctx.font = 'bold 9px Sora, sans-serif';
                ctx.fillStyle = '#f59e0b';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillText(`${k} Hz`, x + barW / 2, fBase - barH - 4);
            }
        }

        // Axis label
        ctx.font = '9px Sora, sans-serif';
        ctx.fillStyle = dim;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('Frequency (k)', padL + gW / 2, fBase + 4);

    }, [tones, sampleRate]);

    useEffect(() => { paint(); }, [paint]);
    useEffect(() => { window.addEventListener('resize', paint); return () => window.removeEventListener('resize', paint); }, [paint]);

    return (
        <div className="tool-card">
            <div className="tool-card-header">
                <h3>Fourier Transform</h3>
                <span className="subject-topic" style={{ background: 'var(--amber-soft)', color: 'var(--amber)' }}>Signals</span>
            </div>
            <div className="tool-card-body">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                    {tones.map((t, i) => (
                        <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.82rem', color: 'var(--text-dim)', minWidth: 20 }}>#{i + 1}</span>
                            <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                f={t.freq}
                                <input type="range" min={1} max={50} value={t.freq} onChange={e => updateTone(i, 'freq', +e.target.value)}
                                    style={{ width: 80, accentColor: 'var(--amber)' }} />
                            </label>
                            <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                A={t.amp.toFixed(1)}
                                <input type="range" min={0} max={20} step={1} value={t.amp * 10} onChange={e => updateTone(i, 'amp', +e.target.value / 10)}
                                    style={{ width: 80, accentColor: 'var(--amber)' }} />
                            </label>
                            <button className="tool-btn tool-btn--outline" style={{ color: '#ef4444', padding: '2px 8px', fontSize: '0.75rem' }}
                                onClick={() => removeTone(i)}>✕</button>
                        </div>
                    ))}
                    <button className="tool-btn tool-btn--outline" onClick={addTone} style={{ alignSelf: 'flex-start', fontSize: '0.8rem' }}>+ Add Tone</button>
                </div>

                <div ref={boxRef} style={{
                    width: '100%', aspectRatio: '16/9',
                    background: 'var(--bg-primary)', border: '1px solid var(--border-warm)',
                    borderRadius: 'var(--radius-md)', overflow: 'hidden',
                }}>
                    <canvas ref={canvasRef} style={{ display: 'block' }} />
                </div>

                <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: 8 }}>
                    Add sinusoidal components at specific frequencies. The DFT decomposes the composite signal (top, amber) into its frequency spectrum (bottom, blue). Highlighted bars correspond to your input frequencies.
                </p>
            </div>
        </div>
    );
}
