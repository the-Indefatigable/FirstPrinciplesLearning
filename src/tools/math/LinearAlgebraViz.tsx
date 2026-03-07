import { useState, useRef, useEffect, useCallback } from 'react';

const W = 360, H = 360;
const ORIGIN = { x: W / 2, y: H / 2 };
const SCALE = 60; // px per unit

function toScreen(gx: number, gy: number) {
  return { x: ORIGIN.x + gx * SCALE, y: ORIGIN.y - gy * SCALE };
}

function applyMatrix(m: number[][], vx: number, vy: number) {
  return { x: m[0][0] * vx + m[0][1] * vy, y: m[1][0] * vx + m[1][1] * vy };
}

function eigen2x2(a: number, b: number, c: number, d: number) {
  const trace = a + d;
  const det = a * d - b * c;
  const disc = trace * trace - 4 * det;
  if (disc < 0) return null;
  const l1 = (trace + Math.sqrt(disc)) / 2;
  const l2 = (trace - Math.sqrt(disc)) / 2;
  return { l1, l2 };
}

export default function LinearAlgebraViz() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mat, setMat] = useState([[2, 1], [0, 1]]);
  const [showGrid, setShowGrid] = useState(true);
  const [showEigen, setShowEigen] = useState(true);
  const [t, setT] = useState(1); // interpolation 0→1

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const bg = isDark ? '#1a1612' : '#faf8f4';
    const gridColor = isDark ? '#2a2420' : '#e8e0d0';
    const axisColor = isDark ? '#4a4038' : '#c8bfb0';
    const textColor = isDark ? '#9c9488' : '#6b5f52';

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    const interp = (orig: number, trans: number) => orig + (trans - orig) * t;

    // Lerp matrix
    const lerpMat = (vx: number, vy: number) => {
      const tv = applyMatrix(mat, vx, vy);
      return { x: interp(vx, tv.x), y: interp(vy, tv.y) };
    };

    // Draw transformed grid
    if (showGrid) {
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 0.8;
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath();
        for (let j = -3; j <= 3; j += 0.1) {
          const p = lerpMat(i, j);
          const s = toScreen(p.x, p.y);
          j === -3 ? ctx.moveTo(s.x, s.y) : ctx.lineTo(s.x, s.y);
        }
        ctx.stroke();
        ctx.beginPath();
        for (let j = -3; j <= 3; j += 0.1) {
          const p = lerpMat(j, i);
          const s = toScreen(p.x, p.y);
          j === -3 ? ctx.moveTo(s.x, s.y) : ctx.lineTo(s.x, s.y);
        }
        ctx.stroke();
      }
    }

    // Transformed unit square
    const corners = [[0, 0], [1, 0], [1, 1], [0, 1]];
    ctx.beginPath();
    corners.forEach(([vx, vy], i) => {
      const p = lerpMat(vx, vy);
      const s = toScreen(p.x, p.y);
      i === 0 ? ctx.moveTo(s.x, s.y) : ctx.lineTo(s.x, s.y);
    });
    ctx.closePath();
    ctx.fillStyle = isDark ? 'rgba(217,119,6,0.12)' : 'rgba(217,119,6,0.15)';
    ctx.fill();
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Axes
    ctx.strokeStyle = axisColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, ORIGIN.y); ctx.lineTo(W, ORIGIN.y);
    ctx.moveTo(ORIGIN.x, 0); ctx.lineTo(ORIGIN.x, H);
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = textColor;
    ctx.font = `10px monospace`;
    for (let i = -2; i <= 2; i++) {
      if (i === 0) continue;
      const sx = toScreen(i, 0);
      ctx.fillText(String(i), sx.x - 4, ORIGIN.y + 14);
      const sy = toScreen(0, i);
      ctx.fillText(String(i), ORIGIN.x + 4, sy.y + 4);
    }

    // Basis vectors after transform
    const drawVec = (vx: number, vy: number, color: string, label: string) => {
      const p = lerpMat(vx, vy);
      const s = toScreen(p.x, p.y);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(ORIGIN.x, ORIGIN.y);
      ctx.lineTo(s.x, s.y);
      ctx.stroke();
      // arrowhead
      const dx = s.x - ORIGIN.x, dy = s.y - ORIGIN.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) {
        const nx = dx / len, ny = dy / len;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - nx * 10 + ny * 5, s.y - ny * 10 - nx * 5);
        ctx.lineTo(s.x - nx * 10 - ny * 5, s.y - ny * 10 + nx * 5);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
      }
      ctx.fillStyle = color;
      ctx.font = 'bold 12px monospace';
      ctx.fillText(label, s.x + 6, s.y - 4);
    };

    drawVec(1, 0, '#3b82f6', 'î');
    drawVec(0, 1, '#22c55e', 'ĵ');

    // Eigenvectors
    if (showEigen) {
      const ev = eigen2x2(mat[0][0], mat[0][1], mat[1][0], mat[1][1]);
      if (ev) {
        const [a, b, c, d] = [mat[0][0], mat[0][1], mat[1][0], mat[1][1]];
        const drawEigVec = (lambda: number, color: string) => {
          let evx = 1, evy = 0;
          if (Math.abs(b) > 1e-9) { evx = b; evy = lambda - a; }
          else if (Math.abs(c) > 1e-9) { evx = lambda - d; evy = c; }
          const norm = Math.sqrt(evx * evx + evy * evy);
          evx /= norm; evy /= norm;
          const scale = 2.5;
          const s1 = toScreen(evx * scale, evy * scale);
          const s2 = toScreen(-evx * scale, -evy * scale);
          ctx.setLineDash([4, 3]);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = 0.6;
          ctx.beginPath(); ctx.moveTo(s2.x, s2.y); ctx.lineTo(s1.x, s1.y); ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
          ctx.fillStyle = color;
          ctx.font = '10px monospace';
          ctx.fillText(`λ=${lambda.toFixed(2)}`, s1.x + 4, s1.y);
        };
        drawEigVec(ev.l1, '#ef4444');
        if (Math.abs(ev.l1 - ev.l2) > 0.01) drawEigVec(ev.l2, '#a855f7');
      }
    }
  }, [mat, showGrid, showEigen, t]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    draw();
  }, [draw]);

  const setEntry = (r: number, c: number, v: number) => {
    setMat(prev => {
      const next = prev.map(row => [...row]);
      next[r][c] = isNaN(v) ? 0 : v;
      return next;
    });
  };

  const ev = eigen2x2(mat[0][0], mat[0][1], mat[1][0], mat[1][1]);
  const det = mat[0][0] * mat[1][1] - mat[0][1] * mat[1][0];
  const trace = mat[0][0] + mat[1][1];

  return (
    <div className="tool-card">
      <div className="tool-layout-2col">
        <div>
          <canvas ref={canvasRef} style={{ borderRadius: 8, border: '1px solid var(--border-warm)' }} />
          <div style={{ marginTop: 8 }}>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
              Interpolation t = {t.toFixed(2)}
            </label>
            <input type="range" min={0} max={1} step={0.01} value={t}
              onChange={e => setT(+e.target.value)}
              style={{ width: '100%', marginTop: 4 }} />
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: 2 }}>
              Drag to animate the transformation from identity (t=0) to matrix (t=1)
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
              Matrix A =
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, maxWidth: 160 }}>
              {[0, 1].map(r => [0, 1].map(c => (
                <input key={`${r}${c}`}
                  type="number" step={0.1}
                  value={mat[r][c]}
                  onChange={e => setEntry(r, c, parseFloat(e.target.value))}
                  style={{
                    width: '100%', padding: '8px 10px',
                    fontFamily: 'monospace', fontWeight: 700, fontSize: '1rem',
                    textAlign: 'center',
                    border: '1px solid var(--border-warm)',
                    borderRadius: 6, background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                  }} />
              )))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { label: 'Identity', m: [[1, 0], [0, 1]] },
              { label: 'Rotate 90°', m: [[0, -1], [1, 0]] },
              { label: 'Scale ×2', m: [[2, 0], [0, 2]] },
              { label: 'Shear', m: [[1, 1], [0, 1]] },
              { label: 'Reflect X', m: [[1, 0], [0, -1]] },
              { label: 'Squeeze', m: [[2, 0], [0, 0.5]] },
            ].map(({ label, m }) => (
              <button key={label}
                className="tool-btn--outline"
                onClick={() => { setMat(m); setT(1); }}
                style={{ fontSize: '0.72rem', padding: '4px 10px' }}>
                {label}
              </button>
            ))}
          </div>

          <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '12px 14px', fontSize: '0.82rem', lineHeight: 2 }}>
            <div><span style={{ color: 'var(--text-dim)' }}>det(A)</span> = <strong style={{ color: Math.abs(det) < 0.01 ? '#ef4444' : '#22c55e' }}>{det.toFixed(3)}</strong>
              {Math.abs(det) < 0.01 && <span style={{ color: '#ef4444', marginLeft: 6 }}>singular!</span>}
            </div>
            <div><span style={{ color: 'var(--text-dim)' }}>trace(A)</span> = <strong>{trace.toFixed(3)}</strong></div>
            {ev ? (
              <>
                <div><span style={{ color: 'var(--text-dim)' }}>λ₁</span> = <strong style={{ color: '#ef4444' }}>{ev.l1.toFixed(3)}</strong></div>
                <div><span style={{ color: 'var(--text-dim)' }}>λ₂</span> = <strong style={{ color: '#a855f7' }}>{ev.l2.toFixed(3)}</strong></div>
              </>
            ) : (
              <div style={{ color: 'var(--text-dim)' }}>Complex eigenvalues (rotation)</div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={showGrid} onChange={e => setShowGrid(e.target.checked)} />
              Grid
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={showEigen} onChange={e => setShowEigen(e.target.checked)} />
              Eigenvectors
            </label>
          </div>

          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', lineHeight: 1.6 }}>
            Blue = transformed î = column 1<br />
            Green = transformed ĵ = column 2<br />
            Orange = image of unit square<br />
            Dashed = eigenvector directions
          </div>
        </div>
      </div>
    </div>
  );
}
