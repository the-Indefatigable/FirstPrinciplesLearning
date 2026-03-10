/**
 * GraphingCalc.tsx — Unified Graphing Calculator (Gold Standard)
 *
 * Two view modes toggled in the sidebar:
 *   2D  — Interactive Canvas2D function plotter with pan/zoom
 *   3D  — Three.js surface renderer (z = f(x,y))
 *
 * Both modes have an 🌌 Immersive 3D cinematic button.
 */

import React, { useState, useCallback, useRef, useEffect, Suspense } from 'react';
import { compile, type EvalFunction } from 'mathjs';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/* ─── Shared UI Library ─── */
import Tex from '../../components/tool/Tex';
import SmartMathInput from '../../components/tool/SmartMathInput';
import MathKeyboard from '../../components/tool/MathKeyboard';
import ToolLayoutSplit from '../../components/tool/ToolLayoutSplit';
import { useIsDark } from '../../hooks/useTheme';
import { gridStep, fmtAxis, evalSafe } from '../../utils/mathHelpers';

/* ─── Lazy 3D imports ─── */
const Graph2DImmersive = React.lazy(() => import('./Graph2DImmersive'));
const Surface3DImmersive = React.lazy(() => import('./Surface3DImmersive'));

type ViewMode = '2d' | '3d';

/* ─── Color palette for 2D curves ─── */
const CURVE_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];

/* ─── Height-to-color map for 3D surface (same as Surface3DImmersive) ─── */
const COLOR_STOPS: [number, THREE.Color][] = [
  [0.00, new THREE.Color('#1a0533')],
  [0.15, new THREE.Color('#2d1b69')],
  [0.30, new THREE.Color('#1b4f72')],
  [0.45, new THREE.Color('#2196a4')],
  [0.60, new THREE.Color('#58C4DD')],
  [0.75, new THREE.Color('#83C167')],
  [0.90, new THREE.Color('#F4D03F')],
  [1.00, new THREE.Color('#FF6F61')],
];

function heightColor(t: number): THREE.Color {
  const tc = Math.max(0, Math.min(1, t));
  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    const [t0, c0] = COLOR_STOPS[i];
    const [t1, c1] = COLOR_STOPS[i + 1];
    if (tc >= t0 && tc <= t1) return c0.clone().lerp(c1, (tc - t0) / (t1 - t0));
  }
  return COLOR_STOPS[COLOR_STOPS.length - 1][1].clone();
}


/* ─── Critical point finder ─── */
interface CritPt { x: number; y: number; type: 'zero' | 'max' | 'min' }

function findCriticalPoints(fn: EvalFunction, xMin: number, xMax: number): CritPt[] {
  const pts: CritPt[] = [];
  const steps = 2000;
  const dx = (xMax - xMin) / steps;
  let prevY = evalSafe(fn, xMin, 'x');
  let prevD = (() => { const h = 1e-6; return (evalSafe(fn, xMin + h, 'x') - evalSafe(fn, xMin - h, 'x')) / (2 * h); })();

  for (let i = 1; i <= steps; i++) {
    const x = xMin + i * dx;
    const y = evalSafe(fn, x, 'x');
    const h = 1e-6;
    const d = (evalSafe(fn, x + h, 'x') - evalSafe(fn, x - h, 'x')) / (2 * h);

    if (isFinite(prevY) && isFinite(y) && prevY * y < 0) {
      const xz = x - dx * y / (y - prevY);
      const yz = evalSafe(fn, xz, 'x');
      if (isFinite(yz)) pts.push({ x: xz, y: yz, type: 'zero' });
    }
    if (isFinite(prevD) && isFinite(d) && prevD * d < 0) {
      const xc = x - dx * d / (d - prevD);
      const yc = evalSafe(fn, xc, 'x');
      if (isFinite(yc)) pts.push({ x: xc, y: yc, type: prevD > 0 ? 'max' : 'min' });
    }
    prevY = y; prevD = d;
  }
  return pts;
}

/* ═══════════════════════════════════════════════════════
   ═══ 2D Canvas Graph (same engine as DerivativeIntegral)
   ═══════════════════════════════════════════════════════ */
function Graph2D({ expr, showCritical }: { expr: string; showCritical: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef({ cx: 0, cy: 0, scale: 60 });
  const isDark = useIsDark();

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const paint = () => {
      const W = container.clientWidth;
      const H = container.clientHeight;
      if (W === 0 || H === 0) return;
      const dpr = window.devicePixelRatio || 1;

      const bw = Math.round(W * dpr), bh = Math.round(H * dpr);
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw; canvas.height = bh;
      }
      const ctx = canvas.getContext('2d')!;
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      const BG = isDark ? '#0a0a0c' : '#f4f4f5';
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, bw + 2, bh + 2);
      ctx.scale(dpr, dpr);

      const { cx, cy, scale } = viewRef.current;
      const xMin = cx - (W / 2) / scale;
      const xMax = cx + (W / 2) / scale;
      const yMin = cy - (H / 2) / scale;
      const yMax = cy + (H / 2) / scale;

      const toSx = (x: number) => (x - xMin) * scale;
      const toSy = (y: number) => (yMax - y) * scale;

      // ── Compile expression ──
      let fFn: EvalFunction;
      try { fFn = compile(expr); } catch {
        ctx.fillStyle = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)';
        ctx.font = '14px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('Enter a valid expression', W / 2, H / 2);
        return;
      }

      const GRID = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';
      const AXIS = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.3)';
      const LBL = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.5)';

      // ── Grid ──
      const step = gridStep(scale);
      ctx.strokeStyle = GRID; ctx.lineWidth = 1; ctx.setLineDash([]);
      ctx.beginPath();
      for (let gx = Math.ceil(xMin / step) * step; gx <= xMax; gx += step) {
        const px = Math.round(toSx(gx)); ctx.moveTo(px, 0); ctx.lineTo(px, H);
      }
      for (let gy = Math.ceil(yMin / step) * step; gy <= yMax; gy += step) {
        const py = Math.round(toSy(gy)); ctx.moveTo(0, py); ctx.lineTo(W, py);
      }
      ctx.stroke();

      // ── Axes ──
      ctx.strokeStyle = AXIS; ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (yMin <= 0 && yMax >= 0) { const ay = Math.round(toSy(0)); ctx.moveTo(0, ay); ctx.lineTo(W, ay); }
      if (xMin <= 0 && xMax >= 0) { const ax = Math.round(toSx(0)); ctx.moveTo(ax, 0); ctx.lineTo(ax, H); }
      ctx.stroke();

      // ── Labels ──
      ctx.font = '12px system-ui, sans-serif'; ctx.fillStyle = LBL;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (let gx = Math.ceil(xMin / step) * step; gx <= xMax; gx += step) {
        if (Math.abs(gx) < 1e-9) continue;
        const px = toSx(gx); if (px < 22 || px > W - 22) continue;
        const lblY = (yMin <= 0 && yMax >= 0) ? Math.max(5, Math.min(toSy(0) + 5, H - 20)) : H - 20;
        ctx.fillText(fmtAxis(gx), px, lblY);
      }
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (let gy = Math.ceil(yMin / step) * step; gy <= yMax; gy += step) {
        if (Math.abs(gy) < 1e-9) continue;
        const py = toSy(gy); if (py < 10 || py > H - 10) continue;
        const lblX = (xMin <= 0 && xMax >= 0) ? Math.max(25, Math.min(toSx(0) - 6, W - 5)) : 30;
        ctx.fillText(fmtAxis(gy), lblX, py);
      }

      // ── Function curve ──
      ctx.strokeStyle = CURVE_COLORS[0]; ctx.lineWidth = 2.5;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      let drawing = false;
      for (let px = 0; px <= W; px++) {
        const x = xMin + (xMax - xMin) * (px / W);
        const y = evalSafe(fFn, x, 'x');
        if (!isFinite(y) || Math.abs(y) > 1e6) { if (drawing) { ctx.stroke(); ctx.beginPath(); } drawing = false; continue; }
        const py = toSy(y);
        if (py < -H * 4 || py > H * 5) { if (drawing) { ctx.stroke(); ctx.beginPath(); } drawing = false; continue; }
        drawing ? ctx.lineTo(px, py) : ctx.moveTo(px, py); drawing = true;
      }
      if (drawing) ctx.stroke();

      // ── Critical Points ──
      if (showCritical) {
        const crits = findCriticalPoints(fFn, xMin, xMax);
        crits.forEach(cp => {
          const px = toSx(cp.x), py = toSy(cp.y);
          if (px < 0 || px > W || py < 0 || py > H) return;
          const color = cp.type === 'zero' ? '#10b981' : cp.type === 'max' ? '#f59e0b' : '#ef4444';
          const symbol = cp.type === 'zero' ? '●' : cp.type === 'max' ? '▲' : '▼';

          // Dot
          ctx.beginPath();
          ctx.arc(px, py, 5, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.strokeStyle = isDark ? '#000' : '#fff';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Label
          ctx.font = 'bold 11px monospace';
          ctx.fillStyle = color;
          ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
          ctx.fillText(`${symbol} (${cp.x.toFixed(2)}, ${cp.y.toFixed(2)})`, px + 8, py - 4);
        });
      }
    };

    paint();

    const ro = new ResizeObserver(() => paint());
    ro.observe(container);

    // ── Pan & Zoom ──
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const { cx, cy, scale } = viewRef.current;
      const mathX = cx + (mouseX - rect.width / 2) / scale;
      const mathY = cy - (mouseY - rect.height / 2) / scale;
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.max(0.001, Math.min(scale * zoomFactor, 10000));
      viewRef.current = {
        cx: mathX - (mouseX - rect.width / 2) / newScale,
        cy: mathY + (mouseY - rect.height / 2) / newScale,
        scale: newScale,
      };
      paint();
    };
    let isDragging = false, lastPan = { x: 0, y: 0 };
    const onPointerDown = (e: PointerEvent) => { isDragging = true; lastPan = { x: e.clientX, y: e.clientY }; canvas.style.cursor = 'grabbing'; canvas.setPointerCapture(e.pointerId); };
    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      viewRef.current.cx -= (e.clientX - lastPan.x) / viewRef.current.scale;
      viewRef.current.cy += (e.clientY - lastPan.y) / viewRef.current.scale;
      lastPan = { x: e.clientX, y: e.clientY };
      paint();
    };
    const onPointerUp = (e: PointerEvent) => { isDragging = false; canvas.style.cursor = 'grab'; canvas.releasePointerCapture(e.pointerId); };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.style.cursor = 'grab';

    return () => {
      ro.disconnect();
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
    };
  }, [expr, isDark, showCritical]);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none' }} />
    </div>
  );
}


/* ═══════════════════════════════════════════════════════
   ═══ 3D Three.js Surface Chart
   ═══════════════════════════════════════════════════════ */
function Surface3D({ expr, bounds, resolution }: { expr: string; bounds: number; resolution: number }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let compiled: EvalFunction;
    try { compiled = compile(expr); } catch { return; }

    const w = container.clientWidth, h = container.clientHeight;
    if (w === 0 || h === 0) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.setClearColor(0x0f1117);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 500);
    camera.position.set(bounds * 1.8, bounds * 1.3, bounds * 1.8);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(10, 20, 15);
    scene.add(dir);

    // Grid
    const grid = new THREE.GridHelper(bounds * 2, 20, 0x27272a, 0x18181b);
    grid.position.y = -0.05;
    scene.add(grid);

    // ── Axis helper: text sprite ──
    const makeLabel = (text: string, color = '#a1a1aa') => {
      const cv = document.createElement('canvas');
      cv.width = 128; cv.height = 64;
      const cx = cv.getContext('2d')!;
      cx.font = 'bold 26px monospace';
      cx.fillStyle = color; cx.textAlign = 'center'; cx.textBaseline = 'middle';
      cx.fillText(text, 64, 32);
      const m = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false });
      const s = new THREE.Sprite(m);
      s.scale.set(1.2, 0.6, 1);
      return s;
    };

    // ── Axis lines ──
    const axisMat = (c: number) => new THREE.LineBasicMaterial({ color: c });
    const axisLine = (from: THREE.Vector3, to: THREE.Vector3, c: number) => {
      const g = new THREE.BufferGeometry().setFromPoints([from, to]);
      scene.add(new THREE.Line(g, axisMat(c)));
    };
    axisLine(new THREE.Vector3(-bounds, 0, 0), new THREE.Vector3(bounds, 0, 0), 0xef4444); // X — red
    axisLine(new THREE.Vector3(0, -bounds, 0), new THREE.Vector3(0, bounds, 0), 0x10b981); // Y — green (height)
    axisLine(new THREE.Vector3(0, 0, -bounds), new THREE.Vector3(0, 0, bounds), 0x3b82f6); // Z — blue

    // ── Axis name labels ──
    const xLbl = makeLabel('X', '#ef4444'); xLbl.position.set(bounds + 0.6, 0, 0); scene.add(xLbl);
    const yLbl = makeLabel('Y', '#10b981'); yLbl.position.set(0, bounds + 0.6, 0); scene.add(yLbl);
    const zLbl = makeLabel('Z', '#3b82f6'); zLbl.position.set(0, 0, bounds + 0.6); scene.add(zLbl);

    // ── Tick labels ──
    const tickStep = Math.max(1, Math.floor(bounds / 4));
    for (let v = -Math.floor(bounds); v <= Math.floor(bounds); v += tickStep) {
      if (v === 0) continue;
      const tx = makeLabel(v.toString()); tx.position.set(v, -0.5, 0); scene.add(tx);
      const tz = makeLabel(v.toString()); tz.position.set(0, -0.5, v); scene.add(tz);
      const ty = makeLabel(v.toString()); ty.position.set(-0.5, v, 0); scene.add(ty);
    }

    // Build surface
    const step = (bounds * 2) / resolution;
    const vertices: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const heights: number[][] = [];
    let zMin = Infinity, zMax = -Infinity;

    for (let j = 0; j <= resolution; j++) {
      const row: number[] = [];
      for (let i = 0; i <= resolution; i++) {
        const x = -bounds + i * step;
        const y = -bounds + j * step;
        let z = 0;
        try { z = Number(compiled.evaluate({ x, y, e: Math.E, pi: Math.PI })); } catch { }
        const cz = isFinite(z) ? Math.max(-30, Math.min(30, z)) : 0;
        row.push(cz);
        if (isFinite(z)) { zMin = Math.min(zMin, cz); zMax = Math.max(zMax, cz); }
      }
      heights.push(row);
    }
    if (!isFinite(zMin)) { zMin = -1; zMax = 1; }
    const zRange = zMax - zMin || 1;

    for (let j = 0; j <= resolution; j++) {
      for (let i = 0; i <= resolution; i++) {
        const x = -bounds + i * step;
        const depth = -bounds + j * step;
        const height = heights[j][i];
        vertices.push(x, height, depth);
        const c = heightColor((height - zMin) / zRange);
        colors.push(c.r, c.g, c.b);
      }
    }
    for (let j = 0; j < resolution; j++) {
      for (let i = 0; i < resolution; i++) {
        const a = j * (resolution + 1) + i;
        const b = a + 1;
        const cc = a + (resolution + 1);
        const d = cc + 1;
        indices.push(a, cc, b, b, cc, d);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const mat = new THREE.MeshPhongMaterial({ vertexColors: true, side: THREE.DoubleSide, shininess: 30 });
    scene.add(new THREE.Mesh(geo, mat));

    const wireMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.06 });
    scene.add(new THREE.Mesh(geo, wireMat));

    // Animation loop
    let animFrame = 0;
    const loop = () => {
      animFrame = requestAnimationFrame(loop);
      controls.update();
      renderer.render(scene, camera);
    };
    loop();

    // Resize
    const ro = new ResizeObserver(() => {
      const nw = container.clientWidth, nh = container.clientHeight;
      if (nw === 0 || nh === 0) return;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    });
    ro.observe(container);

    return () => {
      cancelAnimationFrame(animFrame);
      ro.disconnect();
      renderer.dispose();
      geo.dispose(); mat.dispose(); wireMat.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, [expr, bounds, resolution]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%', borderRadius: 8, overflow: 'hidden' }} />;
}





/* ═══════════════════════════════════════════════════
   ═══ Main Component
   ═══════════════════════════════════════════════════ */
export default function GraphingCalc() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [expr, setExpr] = useState('sin(x)');
  const [viewMode, setViewMode] = useState<ViewMode>('2d');
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [show3DImmersive, setShow3DImmersive] = useState(false);
  const [showSurfaceFS, setShowSurfaceFS] = useState(false);
  const [showCritical, setShowCritical] = useState(false);

  // 3D-specific state
  const [bounds3D, setBounds3D] = useState(5);
  const [resolution3D, setResolution3D] = useState(50);

  const isDark = useIsDark();

  const insertAtCursor = useCallback((text: string) => {
    const input = inputRef.current;
    if (!input) { setExpr(p => p + text); return; }
    const start = input.selectionStart ?? expr.length;
    const end = input.selectionEnd ?? expr.length;
    setExpr(expr.slice(0, start) + text + expr.slice(end));
    requestAnimationFrame(() => { input.focus(); const pos = start + text.length; input.setSelectionRange(pos, pos); });
  }, [expr]);

  const handleBackspace = useCallback(() => {
    const i = inputRef.current;
    if (i) {
      const s = i.selectionStart ?? expr.length;
      if (s > 0) {
        setExpr(expr.slice(0, s - 1) + expr.slice(s));
        requestAnimationFrame(() => { i.focus(); i.setSelectionRange(s - 1, s - 1); });
      }
    }
  }, [expr]);

  const borderC = isDark ? '#27272a' : '#e4e4e7';
  const textDim = isDark ? '#9ca3af' : '#6b7280';
  const inputBg = isDark ? '#18181b' : '#f3f4f6';
  const accent = viewMode === '2d' ? '#3b82f6' : '#58C4DD';
  const accentGlow = isDark
    ? (viewMode === '2d' ? 'rgba(59,130,246,0.1)' : 'rgba(88,196,221,0.1)')
    : (viewMode === '2d' ? 'rgba(59,130,246,0.08)' : 'rgba(88,196,221,0.08)');

  const sidebar = (
    <>
      {/* ── 2D / 3D toggle ── */}
      <div style={{
        display: 'flex', borderRadius: 8, overflow: 'hidden',
        border: `1px solid ${borderC}`,
      }}>
        {(['2d', '3d'] as ViewMode[]).map(m => (
          <button key={m} onClick={() => setViewMode(m)} style={{
            flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer',
            fontFamily: 'system-ui', fontWeight: 700, fontSize: '0.85rem',
            letterSpacing: 1, textTransform: 'uppercase',
            background: viewMode === m ? accentGlow : 'transparent',
            color: viewMode === m ? accent : textDim,
            transition: 'all 0.15s',
            borderBottom: viewMode === m ? `2px solid ${accent}` : '2px solid transparent',
          }}>
            {m === '2d' ? '📈 2D Graph' : '🧊 3D Surface'}
          </button>
        ))}
      </div>

      {/* ── Function input ── */}
      <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: textDim }}>
        {viewMode === '2d' ? 'y = f(x)' : 'z = f(x, y)'}
      </div>

      <SmartMathInput
        value={expr}
        onChange={setExpr}
        variable="x"
        isDark={isDark}
        placeholder={viewMode === '2d' ? 'e.g. sin(x), x^2' : 'e.g. sin(x)*cos(y)'}
      />

      <button onClick={() => setShowKeyboard(k => !k)} style={{
        background: showKeyboard ? accentGlow : 'transparent', color: showKeyboard ? accent : textDim,
        border: `1px solid ${borderC}`, borderRadius: 7, padding: '8px 10px',
        fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'system-ui',
        width: '100%', letterSpacing: 0.3, transition: 'all 0.1s'
      }}>
        {showKeyboard ? '✕ Hide keyboard' : '⌨ Math keyboard'}
      </button>

      {showKeyboard && (
        <MathKeyboard
          onInsert={insertAtCursor}
          onBackspace={handleBackspace}
          onClear={() => setExpr('')}
          isDark={isDark}
        />
      )}

      {/* ── 3D-specific controls ── */}
      {viewMode === '3d' && (
        <>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: textDim }}>Bounds (±)</span>
              <span style={{
                background: accentGlow, color: accent,
                padding: '2px 10px', borderRadius: 6,
                fontWeight: 700, fontSize: '0.85rem', fontFamily: 'monospace',
                border: `1px solid ${isDark ? 'rgba(88,196,221,0.2)' : 'rgba(88,196,221,0.15)'}`,
              }}>{bounds3D}</span>
            </div>
            <input type="range" min={1} max={20} value={bounds3D} onChange={e => setBounds3D(+e.target.value)} style={{ width: '100%', accentColor: accent }} />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: textDim }}>Resolution</span>
              <span style={{
                background: accentGlow, color: accent,
                padding: '2px 10px', borderRadius: 6,
                fontWeight: 700, fontSize: '0.85rem', fontFamily: 'monospace',
                border: `1px solid ${isDark ? 'rgba(88,196,221,0.2)' : 'rgba(88,196,221,0.15)'}`,
              }}>{resolution3D}</span>
            </div>
            <input type="range" min={10} max={100} step={5} value={resolution3D} onChange={e => setResolution3D(+e.target.value)} style={{ width: '100%', accentColor: accent }} />
          </div>
        </>
      )}

      {/* ── LaTeX preview ── */}
      <div style={{
        textAlign: 'center', padding: '14px 20px',
        background: inputBg, borderRadius: 10,
        border: `1px solid ${borderC}`,
      }}>
        <Tex math={viewMode === '2d' ? `y = ${expr.replace(/\*/g, '\\cdot ')}` : `z = ${expr.replace(/\*/g, '\\cdot ')}`} display />
      </div>

      {/* ── Critical Points toggle (2D only) ── */}
      {viewMode === '2d' && (
        <button onClick={() => setShowCritical(c => !c)} style={{
          width: '100%', padding: '8px 10px',
          border: `1px solid ${showCritical ? '#10b981' : borderC}`,
          borderRadius: 7,
          background: showCritical ? (isDark ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.06)') : 'transparent',
          color: showCritical ? '#10b981' : textDim,
          fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'system-ui',
          letterSpacing: 0.3, transition: 'all 0.15s',
        }}>
          {showCritical ? '✓ Critical Points ON' : '○ Show Critical Points'}
        </button>
      )}

      {/* ── Immersive 3D button ── */}
      <button onClick={() => viewMode === '3d' ? setShowSurfaceFS(true) : setShow3DImmersive(true)} style={{
        width: '100%', padding: '10px 14px',
        border: `1px solid ${isDark ? 'rgba(0,221,255,0.25)' : 'rgba(0,100,200,0.2)'}`,
        borderRadius: 8,
        background: isDark ? 'rgba(0,221,255,0.06)' : 'rgba(0,100,200,0.04)',
        color: isDark ? '#00ddff' : '#0066cc',
        fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
        fontFamily: 'system-ui', letterSpacing: 0.3, transition: 'all 0.15s',
      }}>
        🌌 Immersive 3D
      </button>

      {/* ── Tips ── */}
      <div style={{
        padding: '12px 16px', fontSize: '0.82rem',
        color: textDim, lineHeight: 1.6,
        background: inputBg, borderRadius: 8,
        border: `1px solid ${borderC}`,
      }}>
        {viewMode === '2d'
          ? 'Scroll to zoom. Click & drag to pan. The grid scales dynamically.'
          : 'Click and drag to rotate. Scroll to zoom. Double-click to reset view.'
        }
      </div>
    </>
  );

  const canvas = (
    <>
      {viewMode === '2d' ? (
        <Graph2D expr={expr} showCritical={showCritical} />
      ) : (
        <Surface3D expr={expr} bounds={bounds3D} resolution={resolution3D} />
      )}

      {/* Immersive for 2D curves */}
      {show3DImmersive && (
        <Suspense fallback={
          <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: '#050510', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(59,130,246,0.6)', fontSize: '1rem', letterSpacing: 2 }}>
            Loading Curve Tracer…
          </div>
        }>
          <Graph2DImmersive
            expr={expr} variable="x"
            onClose={() => setShow3DImmersive(false)}
          />
        </Suspense>
      )}

      {/* 3D Surface immersive */}
      {showSurfaceFS && (
        <Suspense fallback={
          <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: '#050510', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(88,196,221,0.6)', fontSize: '1rem', letterSpacing: 2 }}>
            Loading 3D Surface…
          </div>
        }>
          <Surface3DImmersive
            expr={expr} bounds={bounds3D} resolution={resolution3D}
            onClose={() => setShowSurfaceFS(false)}
          />
        </Suspense>
      )}
    </>
  );

  return (
    <ToolLayoutSplit>
      {[sidebar, canvas]}
    </ToolLayoutSplit>
  );
}
