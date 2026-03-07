import { useRef, useEffect, useState, useCallback } from 'react';

const W = 560, H = 360;
const CX = W / 2, CY = H / 2;

export default function LensMirror() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [type, setType] = useState<'converging' | 'diverging' | 'concave' | 'convex'>('converging');
  const [f, setF] = useState(120); // focal length in px
  const [objDist, setObjDist] = useState(220); // object distance from lens
  const [objH, setObjH] = useState(60); // object height in px

  const isLens = type === 'converging' || type === 'diverging';
  const fSigned = (type === 'converging' || type === 'concave') ? f : -f;

  // Thin lens / mirror equation: 1/do + 1/di = 1/f
  // do is positive (object left of lens for lens, or in front of mirror)
  const do_ = objDist;
  const di = (fSigned * do_) / (do_ - fSigned); // can be ±∞
  const m = -di / do_; // magnification
  const imgH = m * objH;
  const isReal = isLens ? di > 0 : di > 0;
  const isVirtual = !isReal;

  const draw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = isDark ? '#1a1612' : '#faf8f4';
    ctx.fillRect(0, 0, W, H);

    const axisColor = isDark ? '#3a3028' : '#ddd4c0';
    const textColor = isDark ? '#9c9488' : '#7a6f62';

    // Optical axis
    ctx.strokeStyle = axisColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(0, CY); ctx.lineTo(W, CY); ctx.stroke();
    ctx.setLineDash([]);

    // Lens / mirror
    if (isLens) {
      ctx.strokeStyle = isDark ? '#d97706' : '#b45309';
      ctx.lineWidth = 2.5;
      const lensH = 150;
      if (type === 'converging') {
        // Double convex lens shape
        ctx.beginPath();
        ctx.moveTo(CX, CY - lensH / 2);
        ctx.bezierCurveTo(CX + 24, CY - lensH / 4, CX + 24, CY + lensH / 4, CX, CY + lensH / 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(CX, CY - lensH / 2);
        ctx.bezierCurveTo(CX - 24, CY - lensH / 4, CX - 24, CY + lensH / 4, CX, CY + lensH / 2);
        ctx.stroke();
        // Arrows
        ctx.fillStyle = isDark ? '#d97706' : '#b45309';
        ctx.beginPath(); ctx.moveTo(CX, CY - lensH / 2); ctx.lineTo(CX - 7, CY - lensH / 2 + 12); ctx.lineTo(CX + 7, CY - lensH / 2 + 12); ctx.fill();
        ctx.beginPath(); ctx.moveTo(CX, CY + lensH / 2); ctx.lineTo(CX - 7, CY + lensH / 2 - 12); ctx.lineTo(CX + 7, CY + lensH / 2 - 12); ctx.fill();
      } else {
        // Double concave lens
        ctx.beginPath();
        ctx.moveTo(CX, CY - lensH / 2);
        ctx.bezierCurveTo(CX - 20, CY - lensH / 4, CX - 20, CY + lensH / 4, CX, CY + lensH / 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(CX, CY - lensH / 2);
        ctx.bezierCurveTo(CX + 20, CY - lensH / 4, CX + 20, CY + lensH / 4, CX, CY + lensH / 2);
        ctx.stroke();
        // Arrows inward
        ctx.fillStyle = isDark ? '#d97706' : '#b45309';
        ctx.beginPath(); ctx.moveTo(CX, CY - lensH / 2 + 12); ctx.lineTo(CX - 7, CY - lensH / 2); ctx.lineTo(CX + 7, CY - lensH / 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(CX, CY + lensH / 2 - 12); ctx.lineTo(CX - 7, CY + lensH / 2); ctx.lineTo(CX + 7, CY + lensH / 2); ctx.fill();
      }
    } else {
      // Mirror: vertical line on right with curve hint
      const mH = 150;
      ctx.strokeStyle = isDark ? '#60a5fa' : '#2563eb';
      ctx.lineWidth = 3;
      const curveDir = type === 'concave' ? -1 : 1;
      ctx.beginPath();
      ctx.moveTo(CX, CY - mH / 2);
      ctx.bezierCurveTo(CX + curveDir * 20, CY - mH / 4, CX + curveDir * 20, CY + mH / 4, CX, CY + mH / 2);
      ctx.stroke();
      // Mirror hatching
      ctx.strokeStyle = isDark ? '#3a3028' : '#d0c8b8';
      ctx.lineWidth = 1;
      for (let y = CY - mH / 2; y < CY + mH / 2; y += 12) {
        ctx.beginPath(); ctx.moveTo(CX, y); ctx.lineTo(CX + 12, y + 8); ctx.stroke();
      }
    }

    // Focal points
    const f1x = isLens ? CX - fSigned : CX - fSigned; // front focal
    const f2x = isLens ? CX + fSigned : CX + fSigned; // back focal
    ctx.fillStyle = '#ef4444';
    [f1x, f2x].forEach(fx => {
      if (fx > 0 && fx < W) {
        ctx.beginPath(); ctx.arc(fx, CY, 4, 0, 2 * Math.PI); ctx.fill();
        ctx.fillStyle = textColor;
        ctx.font = '10px monospace';
        ctx.fillText(fx === f1x ? 'F' : "F'", fx - 4, CY + 16);
        ctx.fillStyle = '#ef4444';
      }
    });

    // Object arrow (left of lens)
    const objX = CX - do_;
    if (objX > 10 && objX < CX - 10) {
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(objX, CY);
      ctx.lineTo(objX, CY - objH);
      ctx.stroke();
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.moveTo(objX, CY - objH);
      ctx.lineTo(objX - 5, CY - objH + 10);
      ctx.lineTo(objX + 5, CY - objH + 10);
      ctx.fill();
      ctx.font = '10px monospace';
      ctx.fillText('Object', objX - 14, CY + 14);
    }

    // Image arrow
    const imgX = isLens ? CX + di : CX - di;
    if (isFinite(di) && imgX > 10 && imgX < W - 10) {
      ctx.strokeStyle = isVirtual ? '#a855f7' : '#f59e0b';
      ctx.lineWidth = isVirtual ? 1.5 : 2.5;
      if (isVirtual) ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.moveTo(imgX, CY);
      ctx.lineTo(imgX, CY - imgH);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = isVirtual ? '#a855f7' : '#f59e0b';
      const tipY = CY - imgH;
      ctx.beginPath();
      ctx.moveTo(imgX, tipY);
      ctx.lineTo(imgX - 5, tipY + (imgH > 0 ? 10 : -10));
      ctx.lineTo(imgX + 5, tipY + (imgH > 0 ? 10 : -10));
      ctx.fill();
      ctx.font = '10px monospace';
      ctx.fillText(isVirtual ? 'Image (virtual)' : 'Image (real)', imgX - 18, CY + 14);
    }

    // Principal rays
    if (objX > 10 && objX < CX - 10 && isFinite(di)) {
      const tipX = objX, tipY = CY - objH;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 2]);

      // Ray 1: parallel to axis → through far focal point
      ctx.strokeStyle = '#f59e0b';
      ctx.globalAlpha = 0.7;
      ctx.beginPath(); ctx.moveTo(tipX, tipY); ctx.lineTo(CX, tipY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(CX, tipY); ctx.lineTo(isLens ? CX + di : CX - di, CY - imgH); ctx.stroke();

      // Ray 2: through center (lens) or at angle (mirror)
      ctx.strokeStyle = '#3b82f6';
      const imgXr = isLens ? CX + di : CX - di;
      ctx.beginPath(); ctx.moveTo(tipX, tipY); ctx.lineTo(CX, CY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(CX, CY); ctx.lineTo(imgXr, CY - imgH); ctx.stroke();

      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    // Info panel
    ctx.fillStyle = isDark ? 'rgba(26,22,18,0.9)' : 'rgba(250,248,244,0.9)';
    ctx.beginPath(); ctx.roundRect(10, 10, 220, 110, 6); ctx.fill();
    ctx.strokeStyle = axisColor; ctx.lineWidth = 1; ctx.stroke();

    ctx.fillStyle = textColor;
    ctx.font = '11px monospace';
    const lines = [
      `Type: ${type}`,
      `f = ${(fSigned / 40).toFixed(1)} cm`,
      `dₒ = ${(do_ / 40).toFixed(1)} cm`,
      `dᵢ = ${isFinite(di) ? (di / 40).toFixed(1) + ' cm' : '∞'}`,
      `m = ${isFinite(m) ? m.toFixed(2) : '∞'}x  ${isVirtual ? '(virtual)' : '(real)'}`,
      `Image: ${isVirtual ? 'upright' : Math.sign(imgH) === Math.sign(objH) ? 'upright' : 'inverted'}`,
    ];
    lines.forEach((l, i) => ctx.fillText(l, 18, 30 + i * 16));
  }, [type, f, objDist, objH, fSigned, di, m, imgH, isReal, isVirtual]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = W * dpr; c.height = H * dpr;
    c.style.width = `${W}px`; c.style.height = `${H}px`;
    c.getContext('2d')!.scale(dpr, dpr);
    draw();
  }, [draw]);

  return (
    <div className="tool-card">
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {(['converging', 'diverging', 'concave', 'convex'] as const).map(t => (
          <button
            key={t}
            className={type === t ? 'tool-btn tool-btn--amber' : 'tool-btn--outline'}
            onClick={() => setType(t)}
            style={{ flex: 1, minWidth: 100, fontSize: '0.78rem' }}
          >
            {t === 'converging' ? 'Converging Lens' : t === 'diverging' ? 'Diverging Lens' : t === 'concave' ? 'Concave Mirror' : 'Convex Mirror'}
          </button>
        ))}
      </div>

      <div className="tool-controls-row--3">
        <div>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
            Focal length f = {(fSigned / 40).toFixed(1)} cm
          </label>
          <input type="range" min={40} max={200} value={f} onChange={e => setF(+e.target.value)} style={{ width: '100%' }} />
        </div>
        <div>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
            Object distance = {(objDist / 40).toFixed(1)} cm
          </label>
          <input type="range" min={20} max={300} value={objDist} onChange={e => setObjDist(+e.target.value)} style={{ width: '100%' }} />
        </div>
        <div>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
            Object height = {(objH / 40).toFixed(1)} cm
          </label>
          <input type="range" min={20} max={100} value={objH} onChange={e => setObjH(+e.target.value)} style={{ width: '100%' }} />
        </div>
      </div>

      <canvas ref={canvasRef} style={{ borderRadius: 8, border: '1px solid var(--border-warm)', width: '100%', display: 'block', marginTop: 8 }} />

      <div style={{ marginTop: 10, fontSize: '0.78rem', color: 'var(--text-dim)', lineHeight: 1.8 }}>
        <strong>Thin lens/mirror equation:</strong> 1/f = 1/dₒ + 1/dᵢ &nbsp;|&nbsp;
        Magnification m = −dᵢ/dₒ &nbsp;|&nbsp;
        <span style={{ color: '#f59e0b' }}>Amber = real image</span> &nbsp;
        <span style={{ color: '#a855f7' }}>Purple = virtual image</span>
      </div>
    </div>
  );
}
