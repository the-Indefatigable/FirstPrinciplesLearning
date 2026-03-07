import { useRef, useEffect, useState, useCallback } from 'react';

const W = 560, H = 300;

export default function QuantumWave() {
  const psiRef = useRef<HTMLCanvasElement>(null);
  const probRef = useRef<HTMLCanvasElement>(null);
  const [n, setN] = useState(1);
  const [L, setL] = useState(1.0);
  const [showPsi, setShowPsi] = useState(true);
  const [showProb, setShowProb] = useState(true);
  const [time, setTime] = useState(0);
  const [animate, setAnimate] = useState(false);
  const rafRef = useRef<number>(0);
  const t0Ref = useRef<number>(0);

  // Energy in ℏ²π²/(2mL²) units: Eₙ = n²
  const E = n * n;
  const omega = (E * Math.PI * Math.PI) / (2 * L * L);

  const psi = useCallback((x: number, t: number) => {
    const spatial = Math.sqrt(2 / L) * Math.sin(n * Math.PI * x / L);
    // Time-dependent phase: Ψ(x,t) = ψ(x)·e^{-iEt/ℏ}
    // Real part = ψ(x)·cos(ωt), Imag = -ψ(x)·sin(ωt)
    return {
      real: spatial * Math.cos(omega * t),
      imag: -spatial * Math.sin(omega * t),
      prob: spatial * spatial,
    };
  }, [n, L, omega]);

  const draw = useCallback((t: number) => {
    const pts = 400;
    const dx = L / pts;

    // --- ψ(x,t) canvas ---
    if (showPsi) {
      const c = psiRef.current;
      if (c) {
        const ctx = c.getContext('2d')!;
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = isDark ? '#1a1612' : '#faf8f4';
        ctx.fillRect(0, 0, W, H);

        const midY = H / 2;
        const amp = H * 0.38;
        const xScale = W / L;

        // Axes
        ctx.strokeStyle = isDark ? '#3a3028' : '#ddd4c0';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, midY); ctx.lineTo(W, midY); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, H); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(W, 0); ctx.lineTo(W, H); ctx.stroke();

        // Real part (solid)
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i <= pts; i++) {
          const x = i * dx;
          const { real } = psi(x, t);
          const sx = x * xScale;
          const sy = midY - real * amp;
          i === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
        }
        ctx.stroke();

        // Imaginary part (dashed)
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        for (let i = 0; i <= pts; i++) {
          const x = i * dx;
          const { imag } = psi(x, t);
          const sx = x * xScale;
          const sy = midY - imag * amp;
          i === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Labels
        ctx.fillStyle = isDark ? '#9c9488' : '#7a6f62';
        ctx.font = '11px monospace';
        ctx.fillText(`ψ${n}(x, t)   n=${n}  L=${L.toFixed(1)}`, 10, 18);
        ctx.fillStyle = '#3b82f6'; ctx.fillText('Re(Ψ)', W - 70, 18);
        ctx.fillStyle = '#f59e0b'; ctx.fillText('Im(Ψ)', W - 70, 34);
        ctx.fillStyle = isDark ? '#9c9488' : '#7a6f62';
        ctx.fillText('0', 2, midY - 4); ctx.fillText('L', W - 10, midY - 4);
      }
    }

    // --- |ψ|² probability density canvas ---
    if (showProb) {
      const c = probRef.current;
      if (c) {
        const ctx = c.getContext('2d')!;
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = isDark ? '#1a1612' : '#faf8f4';
        ctx.fillRect(0, 0, W, H);

        const xScale = W / L;
        const maxProb = 2 / L; // max of |ψ|² = 2/L
        const probScale = (H - 40) / maxProb;

        // Fill area
        ctx.beginPath();
        ctx.moveTo(0, H - 20);
        for (let i = 0; i <= pts; i++) {
          const x = i * dx;
          const { prob } = psi(x, t);
          ctx.lineTo(x * xScale, H - 20 - prob * probScale);
        }
        ctx.lineTo(W, H - 20);
        ctx.closePath();
        ctx.fillStyle = 'rgba(34,197,94,0.15)';
        ctx.fill();
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i <= pts; i++) {
          const x = i * dx;
          const { prob } = psi(x, t);
          const sx = x * xScale;
          const sy = H - 20 - prob * probScale;
          i === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
        }
        ctx.stroke();

        // Baseline
        ctx.strokeStyle = isDark ? '#3a3028' : '#ddd4c0';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, H - 20); ctx.lineTo(W, H - 20); ctx.stroke();

        // Node labels
        ctx.fillStyle = isDark ? '#ef4444' : '#dc2626';
        for (let k = 0; k < n - 1; k++) {
          const nodeX = ((k + 1) * L / n) * xScale;
          ctx.beginPath();
          ctx.arc(nodeX, H - 20, 4, 0, 2 * Math.PI);
          ctx.fill();
        }

        ctx.fillStyle = isDark ? '#9c9488' : '#7a6f62';
        ctx.font = '11px monospace';
        ctx.fillText(`|ψ${n}|²   E${n} = ${E}·(ℏ²π²/2mL²)   nodes = ${n - 1}`, 10, 18);
      }
    }
  }, [psi, n, L, E, showPsi, showProb]);

  useEffect(() => {
    [psiRef, probRef].forEach(r => {
      if (!r.current) return;
      const dpr = window.devicePixelRatio || 1;
      r.current.width = W * dpr;
      r.current.height = H * dpr;
      r.current.getContext('2d')!.scale(dpr, dpr);
    });
    draw(time);
  }, [draw, time]);

  useEffect(() => {
    if (animate) {
      t0Ref.current = performance.now() - time * 200;
      const tick = (now: number) => {
        const t = ((now - t0Ref.current) / 200) % (2 * Math.PI / Math.max(omega, 0.1));
        setTime(t);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(rafRef.current);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [animate, omega]);

  return (
    <div className="tool-card">
      <div className="tool-controls-row--3">
        <div>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Quantum number n = <strong>{n}</strong></label>
          <input type="range" min={1} max={8} value={n} onChange={e => setN(+e.target.value)} style={{ width: '100%' }} />
        </div>
        <div>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Box length L = <strong>{L.toFixed(1)}</strong></label>
          <input type="range" min={0.5} max={3} step={0.1} value={L} onChange={e => setL(+e.target.value)} style={{ width: '100%' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button
            className={animate ? 'tool-btn tool-btn--amber' : 'tool-btn--outline'}
            onClick={() => setAnimate(a => !a)}
          >
            {animate ? 'Pause Time' : 'Animate Ψ(x,t)'}
          </button>
          <div style={{ display: 'flex', gap: 10 }}>
            <label style={{ fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="checkbox" checked={showPsi} onChange={e => setShowPsi(e.target.checked)} /> Wave
            </label>
            <label style={{ fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="checkbox" checked={showProb} onChange={e => setShowProb(e.target.checked)} /> Prob
            </label>
          </div>
        </div>
      </div>

      {showPsi && (
        <div style={{ marginTop: 12 }}>
          <canvas ref={psiRef} style={{ borderRadius: 8, border: '1px solid var(--border-warm)', width: '100%', height: 'auto', display: 'block' }} />
        </div>
      )}
      {showProb && (
        <div style={{ marginTop: 10 }}>
          <canvas ref={probRef} style={{ borderRadius: 8, border: '1px solid var(--border-warm)', width: '100%', height: 'auto', display: 'block' }} />
        </div>
      )}

      <div style={{ marginTop: 10, display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--text-dim)', lineHeight: 1.8 }}>
        <div>ψₙ(x) = √(2/L) · sin(nπx/L)</div>
        <div>Eₙ = n²ℏ²π²/(2mL²)</div>
        <div>Nodes = n − 1 <span style={{ color: '#ef4444' }}>(red dots)</span></div>
        <div style={{ color: '#3b82f6' }}>Blue = Re(Ψ)</div>
        <div style={{ color: '#f59e0b' }}>Amber = Im(Ψ)</div>
      </div>
    </div>
  );
}
