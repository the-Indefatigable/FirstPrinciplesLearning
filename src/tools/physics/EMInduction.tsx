import { useRef, useEffect, useState, useCallback } from 'react';

const W = 560, H = 320;

export default function EMInduction() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [magnetX, setMagnetX] = useState(50); // 0..100 % of canvas
  const [turns, setTurns] = useState(4);
  const [speed, setSpeed] = useState(2);
  const [animate, setAnimate] = useState(false);
  const [, setDirection] = useState(1); // 1 = right, -1 = left
  const posRef = useRef(50);
  const dirRef = useRef(1);
  const rafRef = useRef<number>(0);

  // Coil center at x=70% of canvas
  const coilX = W * 0.65;
  const coilW = 80, coilH = 120;
  const coilY = H / 2;

  // Compute flux: Gaussian based on magnet distance from coil center
  const computeFlux = useCallback((pct: number) => {
    const mx = (pct / 100) * W;
    const dist = mx - coilX;
    const sigma = 80;
    return Math.exp(-(dist * dist) / (2 * sigma * sigma));
  }, [coilX]);

  const draw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = isDark ? '#1a1612' : '#faf8f4';
    ctx.fillRect(0, 0, W, H);

    const mx = (magnetX / 100) * W;
    const flux = computeFlux(magnetX);

    // Flux lines (emanating from magnet)
    const numLines = 7;
    ctx.strokeStyle = isDark ? '#1e3a2a' : '#d1fae5';
    ctx.lineWidth = 1;
    for (let i = 0; i < numLines; i++) {
      const angle = (i / (numLines - 1)) * Math.PI - Math.PI / 2;
      const r = 60 + flux * 40;
      const ex = mx + r * Math.cos(angle);
      const ey = H / 2 + r * Math.sin(angle);
      const alpha = 0.15 + flux * 0.6;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(mx, H / 2);
      ctx.bezierCurveTo(mx + r * 0.6 * Math.cos(angle), H / 2 + r * 0.6 * Math.sin(angle), ex, ey, ex, ey);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Magnet body
    const mw = 60, mh = 36;
    // N pole (right)
    const gradient = ctx.createLinearGradient(mx - mw / 2, 0, mx + mw / 2, 0);
    gradient.addColorStop(0, '#3b82f6');
    gradient.addColorStop(1, '#ef4444');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(mx - mw / 2, H / 2 - mh / 2, mw, mh, 6);
    ctx.fill();
    ctx.strokeStyle = isDark ? '#333' : '#ccc';
    ctx.lineWidth = 1;
    ctx.stroke();

    // S and N labels
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.fillText('S', mx - mw / 4, H / 2 + 5);
    ctx.fillText('N', mx + mw / 4, H / 2 + 5);
    ctx.textAlign = 'start';

    // Coil
    const coilLeft = coilX - coilW / 2;
    for (let i = 0; i < turns; i++) {
      const ty = coilY - coilH / 2 + (i / turns) * coilH;
      const loopH = coilH / turns;
      ctx.strokeStyle = isDark ? '#b45309' : '#92400e';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(coilX, ty + loopH / 2, coilW / 2, loopH * 0.45, 0, 0, 2 * Math.PI);
      ctx.stroke();
    }

    // Coil terminals / wire
    ctx.strokeStyle = isDark ? '#d97706' : '#b45309';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(coilLeft - 20, coilY - coilH / 2);
    ctx.lineTo(coilLeft, coilY - coilH / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(coilLeft - 20, coilY + coilH / 2);
    ctx.lineTo(coilLeft, coilY + coilH / 2);
    ctx.stroke();

    // dΦ/dt approximation: proportional to derivative
    const delta = 1;
    const fluxPlus = computeFlux(magnetX + delta);
    const fluxMinus = computeFlux(magnetX - delta);
    const dPhi = (fluxPlus - fluxMinus) / (2 * delta / 100 * W) * dirRef.current;
    const emf = -turns * dPhi * speed * 50; // scale for display

    // EMF meter on the right
    const meterX = coilX + coilW / 2 + 50;
    const meterY = H / 2;
    const meterR = 44;
    ctx.strokeStyle = isDark ? '#3a3028' : '#ddd4c0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(meterX, meterY, meterR, Math.PI, 2 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(meterX - meterR, meterY);
    ctx.lineTo(meterX + meterR, meterY);
    ctx.stroke();

    // Needle
    const needleAngle = Math.PI + (Math.max(-1, Math.min(1, emf / 80))) * (Math.PI / 2);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(meterX, meterY);
    ctx.lineTo(
      meterX + (meterR - 8) * Math.cos(needleAngle),
      meterY + (meterR - 8) * Math.sin(needleAngle),
    );
    ctx.stroke();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(meterX, meterY, 4, 0, 2 * Math.PI);
    ctx.fill();

    // Meter labels
    ctx.fillStyle = isDark ? '#9c9488' : '#7a6f62';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('−', meterX - meterR + 6, meterY - 8);
    ctx.fillText('+', meterX + meterR - 6, meterY - 8);
    ctx.fillText('EMF', meterX, meterY + 16);
    ctx.textAlign = 'start';

    // EMF value
    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = Math.abs(emf) > 5 ? '#22c55e' : isDark ? '#9c9488' : '#7a6f62';
    ctx.textAlign = 'center';
    ctx.fillText(`${emf.toFixed(1)} V`, meterX, meterY + 28);
    ctx.textAlign = 'start';

    // Flux bar
    const barY = H - 36;
    ctx.fillStyle = isDark ? '#2a2420' : '#e8e0d0';
    ctx.beginPath();
    ctx.roundRect(40, barY, W - 80, 12, 3);
    ctx.fill();
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.roundRect(40, barY, (W - 80) * flux, 12, 3);
    ctx.fill();
    ctx.fillStyle = isDark ? '#9c9488' : '#7a6f62';
    ctx.font = '10px monospace';
    ctx.fillText(`Flux Φ = ${flux.toFixed(3)} Wb`, 40, barY - 4);
    ctx.fillText(`ε = −N·dΦ/dt = ${emf.toFixed(2)} V   (N=${turns} turns)`, 40, H - 10);
  }, [magnetX, turns, speed, coilX, coilW, coilH, coilY, computeFlux]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = W * dpr; c.height = H * dpr;
    c.style.width = `${W}px`; c.style.height = `${H}px`;
    c.getContext('2d')!.scale(dpr, dpr);
    draw();
  }, [draw]);

  useEffect(() => {
    if (animate) {
      const tick = () => {
        posRef.current += dirRef.current * speed * 0.3;
        if (posRef.current >= 95) dirRef.current = -1;
        if (posRef.current <= 5) dirRef.current = 1;
        setMagnetX(posRef.current);
        setDirection(dirRef.current);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(rafRef.current);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [animate, speed]);

  return (
    <div className="tool-card">
      <div className="tool-controls-row--3">
        <div>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Magnet position</label>
          <input type="range" min={3} max={97} value={magnetX}
            onChange={e => { setMagnetX(+e.target.value); posRef.current = +e.target.value; }}
            disabled={animate} style={{ width: '100%' }} />
        </div>
        <div>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Turns N = <strong>{turns}</strong></label>
          <input type="range" min={1} max={12} value={turns} onChange={e => setTurns(+e.target.value)} style={{ width: '100%' }} />
        </div>
        <div>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Speed = <strong>{speed}</strong></label>
          <input type="range" min={1} max={6} value={speed} onChange={e => setSpeed(+e.target.value)} style={{ width: '100%' }} />
        </div>
      </div>
      <div style={{ marginBottom: 10 }}>
        <button
          className={animate ? 'tool-btn tool-btn--amber' : 'tool-btn--outline'}
          onClick={() => setAnimate(a => !a)}
        >
          {animate ? 'Stop' : 'Animate Magnet'}
        </button>
      </div>
      <canvas ref={canvasRef} style={{ borderRadius: 8, border: '1px solid var(--border-warm)', width: '100%', display: 'block' }} />
      <div style={{ marginTop: 10, fontSize: '0.78rem', color: 'var(--text-dim)', lineHeight: 1.8 }}>
        Faraday's Law: ε = −N · dΦ/dt — the induced EMF is proportional to the rate of change of magnetic flux.
        Drag the magnet through the coil (or animate) to see the needle deflect. Moving faster → larger EMF.
        The sign follows Lenz's Law: induced current opposes the change in flux.
      </div>
    </div>
  );
}
