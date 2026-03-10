/**
 * GraphingCalc.tsx — Interactive graphing calculator
 *
 * Two rendering modes:
 *   Lite (default)  — Desmos-style clean Canvas2D, theme-aware
 *   Cinematic        — WebGL + Three.js with bloom, particles, effects
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { compile, type EvalFunction } from 'mathjs';
import * as THREE from 'three';
import gsap from 'gsap';
import { useTheme } from '../../hooks/useTheme';

// ── Palette ──
const CURVE_COLORS = ['#2d70b3', '#c74440', '#388c46', '#6042a6', '#000000', '#fa7e19', '#e07d10'];
const CURVE_COLORS_DARK = ['#5b9bd5', '#e06c75', '#6abf69', '#b07cd8', '#ffffff', '#fa7e19', '#f5c542'];

interface FnEntry { expr: string; color: string; colorDark: string; enabled: boolean; compiled: EvalFunction | null; }
interface PinnedPoint { x: number; y: number; fnIdx: number; color: string; }
interface CriticalPoint { x: number; y: number; type: 'zero' | 'max' | 'min'; }

// ── Shaders (cinematic only) ──
const FS_VERT = `varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position,1.0);}`;

const COMPOSITE_FRAG = `
uniform sampler2D tScene,tBloom;uniform float uTime;varying vec2 vUv;
float rand(vec2 co){return fract(sin(dot(co,vec2(12.9898,78.233)))*43758.5453);}
void main(){
  vec3 c=texture2D(tScene,vUv).rgb+texture2D(tBloom,vUv).rgb*0.7;
  vec2 q=vUv-0.5;float vig=1.0-dot(q,q)*1.8;vig=smoothstep(0.0,1.0,vig);
  c*=mix(0.3,1.0,vig);c+=rand(vUv*uTime)*0.03;c=c/(1.0+c*0.15);
  gl_FragColor=vec4(c,1.0);
}`;

const BLUR_FRAG = `
uniform sampler2D tDiffuse;uniform vec2 uOffset;varying vec2 vUv;
void main(){gl_FragColor=0.25*(
  texture2D(tDiffuse,vUv+vec2(-uOffset.x,-uOffset.y))+texture2D(tDiffuse,vUv+vec2(uOffset.x,-uOffset.y))+
  texture2D(tDiffuse,vUv+vec2(-uOffset.x,uOffset.y))+texture2D(tDiffuse,vUv+vec2(uOffset.x,uOffset.y)));}`;

const THRESH_FRAG = `
uniform sampler2D tDiffuse;uniform float uThreshold;varying vec2 vUv;
void main(){vec4 c=texture2D(tDiffuse,vUv);float b=dot(c.rgb,vec3(0.2126,0.7152,0.0722));
  gl_FragColor=b>uThreshold?c:vec4(0.0);}`;

const CURVE_VERT = `
attribute float alpha,side,progress;varying float vAlpha,vSide,vProgress;
void main(){vAlpha=alpha;vSide=side;vProgress=progress;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;

const CURVE_FRAG = `
uniform vec3 uColor;uniform float uProgress,uEmissive,uHoverBright;
varying float vAlpha,vSide,vProgress;
void main(){
  if(vAlpha<=0.0)discard;
  float reveal=smoothstep(uProgress-0.05,uProgress,vProgress);float mask=1.0-reveal;
  if(mask<=0.0)discard;
  float edge=1.0-abs(vSide);edge=smoothstep(0.0,0.35,edge);
  float a=mask*edge*vAlpha;float bright=uEmissive*(1.0+uHoverBright*0.6);
  gl_FragColor=vec4(uColor*bright*a,a);
}`;

// ── Helpers ──
const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);

const formatPi = (val: number): string | null => {
  if (Math.abs(val) < 1e-10) return null;
  const denoms = [1, 2, 3, 4, 6];
  for (const d of denoms) {
    const numer = val * d / Math.PI;
    const rounded = Math.round(numer);
    if (Math.abs(numer - rounded) < 0.02 && rounded !== 0) {
      const g = gcd(Math.abs(rounded), d);
      const n = rounded / g, den = d / g;
      if (den === 1) return n === 1 ? 'π' : n === -1 ? '-π' : `${n}π`;
      if (n === 1) return `π/${den}`;
      if (n === -1) return `-π/${den}`;
      return `${n}π/${den}`;
    }
  }
  return null;
};

const formatAxisValue = (val: number): string => {
  if (Math.abs(val) < 1e-10) return '0';
  const pi = formatPi(val);
  if (pi) return pi;
  const eR = val / Math.E;
  if (Math.abs(eR - Math.round(eR)) < 0.02 && Math.abs(val) > 0.1) {
    const r = Math.round(eR);
    return r === 1 ? 'e' : r === -1 ? '-e' : `${r}e`;
  }
  return Number.isInteger(val) ? String(val) : val.toFixed(1);
};

const gridStep = (scale: number): number => {
  const raw = 60 / scale;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  return (n < 2 ? 1 : n < 5 ? 2 : 5) * mag;
};

const evalFn = (compiled: EvalFunction, x: number, params: Record<string, number>): number => {
  try {
    const val = compiled.evaluate({ x, e: Math.E, pi: Math.PI, ...params });
    return typeof val === 'number' && isFinite(val) ? val : NaN;
  } catch { return NaN; }
};

const numericalDerivative = (compiled: EvalFunction, x: number, params: Record<string, number>): number => {
  const h = 0.0001;
  const y1 = evalFn(compiled, x - h, params);
  const y2 = evalFn(compiled, x + h, params);
  return (!isFinite(y1) || !isFinite(y2)) ? NaN : (y2 - y1) / (2 * h);
};

const findCriticalPoints = (compiled: EvalFunction, xMin: number, xMax: number, params: Record<string, number>): CriticalPoint[] => {
  const points: CriticalPoint[] = [];
  const N = 400;
  const dx = (xMax - xMin) / N;
  let prevY = evalFn(compiled, xMin, params);
  let prevD = numericalDerivative(compiled, xMin, params);
  for (let i = 1; i <= N; i++) {
    const x = xMin + i * dx;
    const y = evalFn(compiled, x, params);
    const d = numericalDerivative(compiled, x, params);
    if (!isFinite(y)) { prevY = y; prevD = d; continue; }
    if (isFinite(prevY) && prevY * y < 0) {
      let lo = x - dx, hi = x;
      for (let j = 0; j < 16; j++) { const mid = (lo + hi) / 2; const mv = evalFn(compiled, mid, params); if (!isFinite(mv)) break; if (mv * evalFn(compiled, lo, params) < 0) hi = mid; else lo = mid; }
      const zx = (lo + hi) / 2, zy = evalFn(compiled, zx, params);
      if (isFinite(zy) && Math.abs(zy) < 0.01) points.push({ x: zx, y: zy, type: 'zero' });
    }
    if (isFinite(prevD) && isFinite(d) && prevD * d < 0) {
      let lo = x - dx, hi = x;
      for (let j = 0; j < 16; j++) { const mid = (lo + hi) / 2; const md = numericalDerivative(compiled, mid, params); if (!isFinite(md)) break; if (md * numericalDerivative(compiled, lo, params) < 0) hi = mid; else lo = mid; }
      const cx2 = (lo + hi) / 2, cy2 = evalFn(compiled, cx2, params);
      if (isFinite(cy2)) points.push({ x: cx2, y: cy2, type: prevD > 0 ? 'max' : 'min' });
    }
    prevY = y; prevD = d;
  }
  return points;
};

const detectParams = (expr: string): string[] => {
  const reserved = new Set(['x', 'e', 'pi', 'sin', 'cos', 'tan', 'log', 'sqrt', 'abs', 'exp', 'pow', 'asin', 'acos', 'atan', 'ceil', 'floor', 'round', 'sign', 'max', 'min', 'mod', 'ln']);
  const matches = expr.match(/\b([a-z])\b/g);
  if (!matches) return [];
  return [...new Set(matches)].filter(v => !reserved.has(v)).sort();
};

// ── Component ──
export default function GraphingCalc() {
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const animRef = useRef(0);
  const sizeRef = useRef({ w: 800, h: 600 });
  const { resolved: theme } = useTheme();
  const themeRef = useRef(theme);
  themeRef.current = theme;

  const isDark = theme === 'dark';

  const stateRef = useRef({
    scale: 50, targetScale: 50,
    centerX: 0, centerY: 0, targetCenterX: 0, targetCenterY: 0,
    mouseX: -9999, mouseY: -9999, mouseActive: false,
    isDragging: false, dragStartX: 0, dragStartY: 0,
    dragCenterX: 0, dragCenterY: 0,
    velocityX: 0, velocityY: 0, lastDragX: 0, lastDragY: 0,
    lastTouchDist: 0, isTouching: false,
    dirty: true,
  });

  const [cinematic, setCinematic] = useState(false);
  const [functions, setFunctions] = useState<FnEntry[]>([
    { expr: 'sin(x)', color: CURVE_COLORS[0], colorDark: CURVE_COLORS_DARK[0], enabled: true, compiled: null },
    { expr: '', color: CURVE_COLORS[1], colorDark: CURVE_COLORS_DARK[1], enabled: true, compiled: null },
  ]);
  const functionsRef = useRef(functions);
  functionsRef.current = functions;

  const [pinnedPoints, setPinnedPoints] = useState<PinnedPoint[]>([]);
  const pinnedRef = useRef(pinnedPoints);
  pinnedRef.current = pinnedPoints;

  const [showCritical, setShowCritical] = useState(true);
  const showCriticalRef = useRef(showCritical);
  showCriticalRef.current = showCritical;

  const [showTangent, setShowTangent] = useState(true);
  const showTangentRef = useRef(showTangent);
  showTangentRef.current = showTangent;

  const [params, setParams] = useState<Record<string, number>>({ a: 1, b: 1, c: 0 });
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const usedParams = detectParams(functions.map(f => f.expr).join(' '));

  const critsCache = useRef<{ key: string; data: CriticalPoint[][] }>({ key: '', data: [] });

  // Compile expressions
  useEffect(() => {
    setFunctions(prev => prev.map(fn => {
      if (!fn.expr.trim()) return { ...fn, compiled: null };
      try { return { ...fn, compiled: compile(fn.expr) }; }
      catch { return { ...fn, compiled: null }; }
    }));
    stateRef.current.dirty = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [functions.map(f => f.expr + f.enabled).join('|')]);

  // Mark dirty on param/toggle changes
  useEffect(() => { stateRef.current.dirty = true; }, [params, showCritical, showTangent, pinnedPoints, theme]);

  // ── Shared interaction setup ──
  const attachInteraction = useCallback((el: HTMLElement) => {
    const st = stateRef.current;
    el.style.cursor = 'crosshair';

    const markDirty = () => { st.dirty = true; };

    const onMouseMove = (e: MouseEvent) => {
      const r = canvasWrapRef.current!.getBoundingClientRect();
      st.mouseX = e.clientX - r.left; st.mouseY = e.clientY - r.top; st.mouseActive = true;
      if (st.isDragging) {
        const dx = (e.clientX - st.lastDragX) / st.scale, dy = (e.clientY - st.lastDragY) / st.scale;
        st.velocityX = dx * 0.5; st.velocityY = -dy * 0.5;
        st.targetCenterX = st.dragCenterX + (e.clientX - st.dragStartX) / st.scale;
        st.targetCenterY = st.dragCenterY - (e.clientY - st.dragStartY) / st.scale;
        st.lastDragX = e.clientX; st.lastDragY = e.clientY;
      }
      markDirty();
    };
    const onMouseDown = (e: MouseEvent) => {
      st.isDragging = true;
      st.dragStartX = e.clientX; st.dragStartY = e.clientY;
      st.dragCenterX = st.targetCenterX; st.dragCenterY = st.targetCenterY;
      st.lastDragX = e.clientX; st.lastDragY = e.clientY;
      st.velocityX = 0; st.velocityY = 0;
      el.style.cursor = 'grabbing'; markDirty();
    };
    const onMouseUp = () => { st.isDragging = false; el.style.cursor = 'crosshair'; markDirty(); };
    const onMouseLeave = () => { st.mouseActive = false; st.isDragging = false; el.style.cursor = 'crosshair'; markDirty(); };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = canvasWrapRef.current!.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      const { w, h } = sizeRef.current;
      const worldX = (mx - w / 2) / st.targetScale - st.targetCenterX;
      const worldY = (h / 2 - my) / st.targetScale - st.targetCenterY;
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.max(5, Math.min(800, st.targetScale * factor));
      st.targetCenterX = (mx - w / 2) / newScale - worldX;
      st.targetCenterY = (h / 2 - my) / newScale - worldY;
      st.targetScale = newScale; markDirty();
    };

    const onDblClick = (e: MouseEvent) => {
      const r = canvasWrapRef.current!.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      const { w, h } = sizeRef.current;
      st.targetCenterX = (mx - w / 2) / (-st.scale) + st.centerX;
      st.targetCenterY = (my - h / 2) / (st.scale) + st.centerY;
      markDirty();
    };

    const onClick = (e: MouseEvent) => {
      if (st.isDragging) return;
      const r = canvasWrapRef.current!.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      const { w, h } = sizeRef.current;
      const cxPx = w / 2 + st.centerX * st.scale;
      const cyPx = h / 2 - st.centerY * st.scale;
      const wx = (mx - cxPx) / st.scale;
      const fns = functionsRef.current;
      const prms = paramsRef.current;
      let bestDist = 30, bestFi = -1, bestVal = 0;
      for (let fi = 0; fi < fns.length; fi++) {
        const fn = fns[fi];
        if (!fn.enabled || !fn.compiled) continue;
        const val = evalFn(fn.compiled, wx, prms);
        if (!isFinite(val)) continue;
        const screenY = cyPx - val * st.scale;
        const dist = Math.abs(screenY - my);
        if (dist < bestDist) { bestDist = dist; bestFi = fi; bestVal = val; }
      }
      if (bestFi >= 0) {
        const dark = themeRef.current === 'dark';
        setPinnedPoints(prev => [...prev, { x: wx, y: bestVal, fnIdx: bestFi, color: dark ? fns[bestFi].colorDark : fns[bestFi].color }]);
      }
    };

    const getTouchDist = (e: TouchEvent) => {
      if (e.touches.length < 2) return 0;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };
    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault(); st.isTouching = true;
      if (e.touches.length === 1) {
        st.isDragging = true;
        st.dragStartX = e.touches[0].clientX; st.dragStartY = e.touches[0].clientY;
        st.dragCenterX = st.targetCenterX; st.dragCenterY = st.targetCenterY;
        st.lastDragX = e.touches[0].clientX; st.lastDragY = e.touches[0].clientY;
        st.velocityX = 0; st.velocityY = 0;
      } else if (e.touches.length === 2) { st.lastTouchDist = getTouchDist(e); st.isDragging = false; }
      markDirty();
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 1 && st.isDragging) {
        const dx = (e.touches[0].clientX - st.lastDragX) / st.scale;
        const dy = (e.touches[0].clientY - st.lastDragY) / st.scale;
        st.velocityX = dx * 0.5; st.velocityY = -dy * 0.5;
        st.targetCenterX = st.dragCenterX + (e.touches[0].clientX - st.dragStartX) / st.scale;
        st.targetCenterY = st.dragCenterY - (e.touches[0].clientY - st.dragStartY) / st.scale;
        st.lastDragX = e.touches[0].clientX; st.lastDragY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        const dist = getTouchDist(e);
        if (st.lastTouchDist > 0) st.targetScale = Math.max(5, Math.min(800, st.targetScale * (dist / st.lastTouchDist)));
        st.lastTouchDist = dist;
      }
      markDirty();
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) { st.isDragging = false; st.isTouching = false; }
      markDirty();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const panStep = 2 / st.scale * 50;
      switch (e.key) {
        case '+': case '=': st.targetScale = Math.min(800, st.targetScale * 1.15); break;
        case '-': case '_': st.targetScale = Math.max(5, st.targetScale * 0.87); break;
        case 'ArrowLeft': st.targetCenterX -= panStep; break;
        case 'ArrowRight': st.targetCenterX += panStep; break;
        case 'ArrowUp': st.targetCenterY += panStep; break;
        case 'ArrowDown': st.targetCenterY -= panStep; break;
        case 'r': case 'R': st.targetScale = 50; st.targetCenterX = 0; st.targetCenterY = 0; st.velocityX = 0; st.velocityY = 0; break;
        default: return;
      }
      markDirty();
    };

    el.addEventListener('mousemove', onMouseMove);
    el.addEventListener('mousedown', onMouseDown);
    el.addEventListener('mouseup', onMouseUp);
    el.addEventListener('mouseleave', onMouseLeave);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('dblclick', onDblClick);
    el.addEventListener('click', onClick);
    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      el.removeEventListener('mousemove', onMouseMove);
      el.removeEventListener('mousedown', onMouseDown);
      el.removeEventListener('mouseup', onMouseUp);
      el.removeEventListener('mouseleave', onMouseLeave);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('dblclick', onDblClick);
      el.removeEventListener('click', onClick);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  // ══════════════════════════════════════════════════
  // ── LITE MODE — Desmos-style Canvas2D ──
  // ══════════════════════════════════════════════════
  useEffect(() => {
    if (cinematic) return;
    const wrap = canvasWrapRef.current;
    if (!wrap) return;

    const canvas = document.createElement('canvas');
    Object.assign(canvas.style, { position: 'absolute', top: '0', left: '0', touchAction: 'none' });
    wrap.appendChild(canvas);
    const ctx = canvas.getContext('2d')!;
    const cleanupInteraction = attachInteraction(canvas);

    let W = 0, H = 0;
    const resize = () => {
      const r = wrap.getBoundingClientRect();
      W = r.width; H = r.height;
      sizeRef.current = { w: W, h: H };
      const dpr = Math.min(window.devicePixelRatio, 2);
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stateRef.current.dirty = true;
    };
    const resObs = new ResizeObserver(resize);
    resObs.observe(wrap); resize();

    const loop = () => {
      animRef.current = requestAnimationFrame(loop);
      const st = stateRef.current;
      const dark = themeRef.current === 'dark';

      // Smooth interpolation
      const lerpF = 0.18;
      const dScale = Math.abs(st.targetScale - st.scale);
      const dCx = Math.abs(st.targetCenterX - st.centerX);
      const dCy = Math.abs(st.targetCenterY - st.centerY);
      const isAnimating = dScale > 0.01 || dCx > 0.0001 || dCy > 0.0001 || Math.abs(st.velocityX) > 0.0005 || Math.abs(st.velocityY) > 0.0005;

      st.scale += (st.targetScale - st.scale) * lerpF;
      if (!st.isDragging && !st.isTouching) {
        st.targetCenterX += st.velocityX; st.targetCenterY += st.velocityY;
        st.velocityX *= 0.92; st.velocityY *= 0.92;
        if (Math.abs(st.velocityX) < 0.0005) st.velocityX = 0;
        if (Math.abs(st.velocityY) < 0.0005) st.velocityY = 0;
      }
      st.centerX += (st.targetCenterX - st.centerX) * lerpF;
      st.centerY += (st.targetCenterY - st.centerY) * lerpF;

      if (!st.dirty && !isAnimating) return;
      st.dirty = false;

      const fns = functionsRef.current;
      const prms = paramsRef.current;
      const scale = st.scale;
      const cx = W / 2 + st.centerX * scale;
      const cy = H / 2 - st.centerY * scale;

      // ── Theme colors ──
      const bgColor = dark ? '#1a1a2e' : '#ffffff';
      const gridColor = dark ? '#2a2a3e' : '#e0e0e0';
      const axisColor = dark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.85)';
      const tickColor = dark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
      const labelColor = dark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)';
      const hoverCross = dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)';
      const tooltipBg = dark ? 'rgba(30,30,50,0.92)' : 'rgba(255,255,255,0.95)';
      const tooltipText = dark ? '#e0e0e0' : '#333333';
      const tooltipBorder = dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)';

      // ── Clear + background ──
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, W, H);

      // ── Grid ──
      const step = gridStep(scale);
      const sX = Math.floor((-cx / scale) / step) * step, eX = Math.ceil(((W - cx) / scale) / step) * step;
      const sY = Math.floor((-(H - cy) / scale) / step) * step, eY = Math.ceil((cy / scale) / step) * step;

      ctx.strokeStyle = gridColor; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = sX; x <= eX; x += step) {
        if (Math.abs(x) < 1e-10) continue;
        const px = Math.round(cx + x * scale) + 0.5;
        ctx.moveTo(px, 0); ctx.lineTo(px, H);
      }
      for (let y = sY; y <= eY; y += step) {
        if (Math.abs(y) < 1e-10) continue;
        const py = Math.round(cy - y * scale) + 0.5;
        ctx.moveTo(0, py); ctx.lineTo(W, py);
      }
      ctx.stroke();

      // ── Axes ──
      const axPx = Math.round(cx) + 0.5;
      const ayPx = Math.round(cy) + 0.5;
      ctx.strokeStyle = axisColor; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, ayPx); ctx.lineTo(W, ayPx);
      ctx.moveTo(axPx, 0); ctx.lineTo(axPx, H);
      ctx.stroke();

      // ── Tick marks ──
      ctx.strokeStyle = axisColor; ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let x = sX; x <= eX; x += step) {
        if (Math.abs(x) < 1e-10) continue;
        const px = Math.round(cx + x * scale) + 0.5;
        ctx.moveTo(px, ayPx - 5); ctx.lineTo(px, ayPx + 5);
      }
      for (let y = sY; y <= eY; y += step) {
        if (Math.abs(y) < 1e-10) continue;
        const py = Math.round(cy - y * scale) + 0.5;
        ctx.moveTo(axPx - 5, py); ctx.lineTo(axPx + 5, py);
      }
      ctx.stroke();

      // ── Axis labels (π-aware) ──
      ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.fillStyle = labelColor;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (let x = sX; x <= eX; x += step) {
        if (Math.abs(x) < 1e-10) continue;
        const px = cx + x * scale;
        if (px < 30 || px > W - 30) continue;
        ctx.fillText(formatAxisValue(x), px, ayPx + 10);
      }
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (let y = sY; y <= eY; y += step) {
        if (Math.abs(y) < 1e-10) continue;
        const py = cy - y * scale;
        if (py < 15 || py > H - 15) continue;
        ctx.fillText(formatAxisValue(y), axPx - 10, py);
      }

      // ── Curves — clean solid lines, no glow ──
      for (let fi = 0; fi < fns.length; fi++) {
        const fn = fns[fi];
        if (!fn.enabled || !fn.compiled) continue;
        const color = dark ? fn.colorDark : fn.color;
        ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath();
        let drawing = false;
        for (let px = 0; px <= W; px++) {
          const x = (px - cx) / scale;
          const y = evalFn(fn.compiled, x, prms);
          if (!isFinite(y) || Math.abs(y) > 1e6) { if (drawing) { ctx.stroke(); ctx.beginPath(); } drawing = false; continue; }
          const py = cy - y * scale;
          if (py < -500 || py > H + 500) { if (drawing) { ctx.stroke(); ctx.beginPath(); } drawing = false; continue; }
          if (!drawing) { ctx.moveTo(px, py); drawing = true; } else ctx.lineTo(px, py);
        }
        if (drawing) ctx.stroke();
      }

      // ── Critical points — simple filled dots ──
      if (showCriticalRef.current) {
        const cacheKey = fns.map(f => f.expr + ':' + f.enabled).join('|') + '|' + Object.values(prms).join(',') + '|' + scale.toFixed(1) + '|' + cx.toFixed(0);
        if (critsCache.current.key !== cacheKey) {
          const xMin = (0 - cx) / scale, xMax = (W - cx) / scale;
          critsCache.current.data = fns.map(fn => fn.enabled && fn.compiled ? findCriticalPoints(fn.compiled, xMin, xMax, prms) : []);
          critsCache.current.key = cacheKey;
        }
        for (let fi = 0; fi < fns.length; fi++) {
          const fn = fns[fi];
          if (!fn.enabled || !fn.compiled) continue;
          const crits = critsCache.current.data[fi] || [];
          const color = dark ? fn.colorDark : fn.color;
          for (const cp of crits) {
            const sx = cx + cp.x * scale, sy = cy - cp.y * scale;
            if (sx < 5 || sx > W - 5 || sy < 5 || sy > H - 5) continue;
            // Filled circle with white/dark center and colored ring
            ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI * 2);
            ctx.fillStyle = bgColor; ctx.fill();
            ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
            // Tiny label
            ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.fillStyle = tickColor; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
            const label = cp.type === 'zero' ? 'zero' : cp.type;
            ctx.fillText(`${label} (${formatAxisValue(cp.x)}, ${cp.y.toFixed(2)})`, sx + 10, sy - 4);
          }
        }
      }

      // ── Pinned points — simple open circles ──
      for (const pp of pinnedRef.current) {
        const sx = cx + pp.x * scale, sy = cy - pp.y * scale;
        if (sx < 5 || sx > W - 5 || sy < 5 || sy > H - 5) continue;
        ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI * 2);
        ctx.fillStyle = pp.color; ctx.fill();
        ctx.beginPath(); ctx.arc(sx, sy, 2, 0, Math.PI * 2);
        ctx.fillStyle = bgColor; ctx.fill();
        // Label
        ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        const txt = `(${formatAxisValue(pp.x)}, ${pp.y.toFixed(3)})`;
        const tm = ctx.measureText(txt);
        const lx = sx + 10, ly = sy - 6;
        ctx.fillStyle = tooltipBg;
        ctx.strokeStyle = tooltipBorder; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(lx - 4, ly - 10, tm.width + 8, 18, 3); ctx.fill(); ctx.stroke();
        ctx.fillStyle = pp.color; ctx.fillText(txt, lx, ly + 3);
      }

      // ── Hover: crosshair + snap + tangent ──
      if (st.mouseActive && !st.isDragging) {
        const mx = (st.mouseX - cx) / scale;

        // Crosshair
        ctx.strokeStyle = hoverCross; ctx.lineWidth = 1; ctx.setLineDash([5, 5]);
        ctx.beginPath(); ctx.moveTo(st.mouseX, 0); ctx.lineTo(st.mouseX, H); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, st.mouseY); ctx.lineTo(W, st.mouseY); ctx.stroke();
        ctx.setLineDash([]);

        // Coordinate tooltip
        const xLabel = formatPi(mx) || mx.toFixed(2);
        const my2 = (cy - st.mouseY) / scale;
        const yLabel = my2.toFixed(2);
        const coordText = `(${xLabel}, ${yLabel})`;
        ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        const tm2 = ctx.measureText(coordText);
        const lx2 = Math.min(st.mouseX + 14, W - tm2.width - 20);
        const ly2 = Math.max(st.mouseY - 14, 20);
        ctx.fillStyle = tooltipBg; ctx.strokeStyle = tooltipBorder; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(lx2 - 6, ly2 - 10, tm2.width + 12, 20, 4); ctx.fill(); ctx.stroke();
        ctx.fillStyle = tooltipText; ctx.textAlign = 'left';
        ctx.fillText(coordText, lx2, ly2 + 4);

        // Snap to each curve
        let labelYOff = ly2 - 24;
        for (let fi = 0; fi < fns.length; fi++) {
          const fn = fns[fi];
          if (!fn.enabled || !fn.compiled) continue;
          const val = evalFn(fn.compiled, mx, prms);
          if (!isFinite(val)) continue;
          const py = cy - val * scale;
          const color = dark ? fn.colorDark : fn.color;

          // Snap dot — filled circle
          ctx.beginPath(); ctx.arc(st.mouseX, py, 4.5, 0, Math.PI * 2);
          ctx.fillStyle = color; ctx.fill();
          ctx.beginPath(); ctx.arc(st.mouseX, py, 2, 0, Math.PI * 2);
          ctx.fillStyle = bgColor; ctx.fill();

          // Tangent line
          if (showTangentRef.current) {
            const slope = numericalDerivative(fn.compiled, mx, prms);
            if (isFinite(slope)) {
              const tangentLen = 80;
              const dx2 = tangentLen / Math.sqrt(1 + slope * slope);
              const dy2 = -slope * dx2;
              ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
              ctx.beginPath(); ctx.moveTo(st.mouseX - dx2, py - dy2); ctx.lineTo(st.mouseX + dx2, py + dy2); ctx.stroke();
              ctx.setLineDash([]);
              // Slope label
              ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
              ctx.fillStyle = color;
              ctx.fillText(`m=${slope.toFixed(2)}`, st.mouseX + dx2 + 6, py + dy2 - 2);
            }
          }

          // Value label
          ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
          const valText = `y = ${val.toFixed(3)}`;
          const vtm = ctx.measureText(valText);
          ctx.fillStyle = tooltipBg; ctx.strokeStyle = tooltipBorder; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.roundRect(lx2 - 6, labelYOff - 10, vtm.width + 12, 20, 4); ctx.fill(); ctx.stroke();
          ctx.fillStyle = color; ctx.fillText(valText, lx2, labelYOff + 4);
          labelYOff -= 24;
        }
      }
    };

    animRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animRef.current);
      cleanupInteraction();
      resObs.disconnect();
      if (canvas.parentElement) wrap.removeChild(canvas);
    };
  }, [cinematic, attachInteraction]);

  // ══════════════════════════════════════════════════
  // ── CINEMATIC MODE (WebGL + Three.js) ──
  // ══════════════════════════════════════════════════
  const buildCurveMesh = useCallback((color: string): THREE.Mesh => {
    const MAX = 3200;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX * 2 * 3), 3));
    geo.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(MAX * 2), 1));
    geo.setAttribute('side', new THREE.BufferAttribute(new Float32Array(MAX * 2), 1));
    geo.setAttribute('progress', new THREE.BufferAttribute(new Float32Array(MAX * 2), 1));
    geo.setIndex([]);
    const c = new THREE.Color(color);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Vector3(c.r, c.g, c.b) }, uProgress: { value: 1.0 }, uEmissive: { value: 2.5 }, uHoverBright: { value: 0.0 } },
      vertexShader: CURVE_VERT, fragmentShader: CURVE_FRAG,
      transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 10; mesh.frustumCulled = false;
    return mesh;
  }, []);

  const updateCurveGeometry = useCallback((mesh: THREE.Mesh, points: { x: number; y: number; valid: boolean }[], width: number) => {
    const geo = mesh.geometry;
    const pos = geo.attributes.position.array as Float32Array;
    const alp = geo.attributes.alpha.array as Float32Array;
    const sid = geo.attributes.side.array as Float32Array;
    const prg = geo.attributes.progress.array as Float32Array;
    const indices: number[] = [];
    let vi = 0;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (!p.valid) { pos[vi * 3] = 0; pos[vi * 3 + 1] = 0; pos[vi * 3 + 2] = 0; alp[vi] = 0; sid[vi] = -1; prg[vi] = 0; vi++; pos[vi * 3] = 0; pos[vi * 3 + 1] = 0; pos[vi * 3 + 2] = 0; alp[vi] = 0; sid[vi] = 1; prg[vi] = 0; vi++; continue; }
      let nx = 0, ny = 1;
      const prev = i > 0 && points[i - 1].valid ? points[i - 1] : null;
      const next = i < points.length - 1 && points[i + 1].valid ? points[i + 1] : null;
      if (prev && next) { const dx = next.x - prev.x, dy = next.y - prev.y, l = Math.sqrt(dx * dx + dy * dy) || 1; nx = -dy / l; ny = dx / l; }
      else if (next) { const dx = next.x - p.x, dy = next.y - p.y, l = Math.sqrt(dx * dx + dy * dy) || 1; nx = -dy / l; ny = dx / l; }
      else if (prev) { const dx = p.x - prev.x, dy = p.y - prev.y, l = Math.sqrt(dx * dx + dy * dy) || 1; nx = -dy / l; ny = dx / l; }
      const prog2 = points.length > 1 ? i / (points.length - 1) : 0;
      pos[vi * 3] = p.x + nx * width; pos[vi * 3 + 1] = p.y + ny * width; pos[vi * 3 + 2] = 0; alp[vi] = 1; sid[vi] = -1; prg[vi] = prog2; vi++;
      pos[vi * 3] = p.x - nx * width; pos[vi * 3 + 1] = p.y - ny * width; pos[vi * 3 + 2] = 0; alp[vi] = 1; sid[vi] = 1; prg[vi] = prog2; vi++;
    }
    for (let i = vi; i < pos.length / 3; i++) { pos[i * 3] = 0; pos[i * 3 + 1] = 0; pos[i * 3 + 2] = 0; alp[i] = 0; }
    for (let i = 0; i < vi - 2; i += 2) {
      if (alp[i] <= 0 || alp[i + 1] <= 0 || alp[i + 2] <= 0 || alp[i + 3] <= 0) continue;
      indices.push(i, i + 1, i + 2); indices.push(i + 1, i + 3, i + 2);
    }
    geo.setIndex(indices);
    geo.attributes.position.needsUpdate = true;
    geo.attributes.alpha.needsUpdate = true;
    geo.attributes.side.needsUpdate = true;
    geo.attributes.progress.needsUpdate = true;
  }, []);

  const curveMeshesRef = useRef<THREE.Mesh[]>([]);
  const progressRef = useRef<number[]>([]);
  const prevExprsRef = useRef<string[]>([]);

  useEffect(() => {
    if (!cinematic) return;
    const wrap = canvasWrapRef.current;
    if (!wrap) return;

    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x0a0c14, 1);
    renderer.autoClear = false;
    wrap.appendChild(renderer.domElement);
    Object.assign(renderer.domElement.style, { position: 'absolute', top: '0', left: '0', touchAction: 'none' });
    const cleanupInteraction = attachInteraction(renderer.domElement);

    const scene = new THREE.Scene();
    const rect = wrap.getBoundingClientRect();
    let W = rect.width, H = rect.height;
    sizeRef.current = { w: W, h: H };
    const camera = new THREE.OrthographicCamera(0, W, 0, H, -100, 100);
    renderer.setSize(W, H);

    // Bloom pipeline — 4 RTs
    const rtOpts: THREE.RenderTargetOptions = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, type: THREE.HalfFloatType };
    const sceneRT = new THREE.WebGLRenderTarget(W, H, rtOpts);
    const bloomRTs: THREE.WebGLRenderTarget[] = [];
    for (let i = 0; i < 4; i++) { const s = Math.pow(2, Math.floor(i / 2) + 1); bloomRTs.push(new THREE.WebGLRenderTarget(Math.ceil(W / s), Math.ceil(H / s), rtOpts)); }

    const bloomScene = new THREE.Scene();
    const bloomCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const fsGeo = new THREE.PlaneGeometry(2, 2);
    const threshMat = new THREE.ShaderMaterial({ uniforms: { tDiffuse: { value: null }, uThreshold: { value: 0.25 } }, vertexShader: FS_VERT, fragmentShader: THRESH_FRAG, depthTest: false });
    const blurMat = new THREE.ShaderMaterial({ uniforms: { tDiffuse: { value: null }, uOffset: { value: new THREE.Vector2() } }, vertexShader: FS_VERT, fragmentShader: BLUR_FRAG, depthTest: false });
    const compositeMat = new THREE.ShaderMaterial({ uniforms: { tScene: { value: null }, tBloom: { value: null }, uTime: { value: 0 } }, vertexShader: FS_VERT, fragmentShader: COMPOSITE_FRAG, depthTest: false });
    const fsQuad = new THREE.Mesh(fsGeo, compositeMat); fsQuad.frustumCulled = false; bloomScene.add(fsQuad);

    // Background
    const bgMat = new THREE.ShaderMaterial({
      uniforms: { uRes: { value: new THREE.Vector2(W, H) } },
      vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader: `uniform vec2 uRes;varying vec2 vUv;void main(){vec2 p=(vUv-0.5)*2.0;float d=length(p);vec3 a=vec3(0.08,0.10,0.18),b=vec3(0.055,0.065,0.12),c=vec3(0.035,0.04,0.07);vec3 col=mix(a,b,smoothstep(0.0,0.5,d));col=mix(col,c,smoothstep(0.4,1.2,d));gl_FragColor=vec4(col,1.0);}`,
      depthTest: false, depthWrite: false,
    });
    const bgMesh = new THREE.Mesh(new THREE.PlaneGeometry(W, H), bgMat);
    bgMesh.position.set(W / 2, H / 2, -10); bgMesh.renderOrder = -100; scene.add(bgMesh);

    // Dust
    const DUST = 80;
    const dPos = new Float32Array(DUST * 3), dSpd = new Float32Array(DUST * 2), dAlp = new Float32Array(DUST);
    for (let i = 0; i < DUST; i++) { dPos[i * 3] = Math.random() * W; dPos[i * 3 + 1] = Math.random() * H; dPos[i * 3 + 2] = -5; dSpd[i * 2] = (Math.random() - 0.5) * 0.15; dSpd[i * 2 + 1] = (Math.random() - 0.5) * 0.1; dAlp[i] = Math.random() * 0.4 + 0.1; }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
    dustGeo.setAttribute('alpha', new THREE.BufferAttribute(dAlp, 1));
    const dustPts = new THREE.Points(dustGeo, new THREE.ShaderMaterial({
      vertexShader: `attribute float alpha;varying float vA;void main(){vA=alpha;gl_PointSize=2.0;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader: `varying float vA;void main(){float d=length(gl_PointCoord-0.5)*2.0;if(d>1.0)discard;gl_FragColor=vec4(0.45,0.65,0.85,vA*(1.0-d*d)*0.5);}`,
      transparent: true, blending: THREE.AdditiveBlending, depthTest: false,
    }));
    dustPts.renderOrder = -5; dustPts.frustumCulled = false; dustPts.userData.speeds = dSpd; scene.add(dustPts);

    // Pre-allocated grid
    const MAX_GRID_VERTS = 2000;
    const gridBuf = new Float32Array(MAX_GRID_VERTS * 3);
    const gridAttr = new THREE.BufferAttribute(gridBuf, 3); gridAttr.setUsage(THREE.DynamicDrawUsage);
    const gridGeo = new THREE.BufferGeometry(); gridGeo.setAttribute('position', gridAttr);
    const gridLines = new THREE.LineSegments(gridGeo, new THREE.LineBasicMaterial({ color: 0x58C4DD, transparent: true, opacity: 0.06, depthTest: false }));
    gridLines.renderOrder = -50; gridLines.frustumCulled = false; scene.add(gridLines);

    // Pre-allocated dots
    const MAX_DOTS = 2000;
    const dotPosBuf = new Float32Array(MAX_DOTS * 3), dotBriBuf = new Float32Array(MAX_DOTS);
    const dotPosAttr = new THREE.BufferAttribute(dotPosBuf, 3); dotPosAttr.setUsage(THREE.DynamicDrawUsage);
    const dotBriAttr = new THREE.BufferAttribute(dotBriBuf, 1); dotBriAttr.setUsage(THREE.DynamicDrawUsage);
    const dotGeo = new THREE.BufferGeometry(); dotGeo.setAttribute('position', dotPosAttr); dotGeo.setAttribute('brightness', dotBriAttr);
    const gridDots = new THREE.Points(dotGeo, new THREE.ShaderMaterial({
      vertexShader: `attribute float brightness;varying float vB;void main(){vB=brightness;gl_PointSize=2.5;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader: `varying float vB;void main(){float d=length(gl_PointCoord-0.5)*2.0;if(d>1.0)discard;gl_FragColor=vec4(0.35,0.77,0.87,(1.0-d)*vB);}`,
      transparent: true, blending: THREE.AdditiveBlending, depthTest: false,
    }));
    gridDots.renderOrder = -40; gridDots.frustumCulled = false; scene.add(gridDots);

    // Pre-allocated axes
    const axisBuf = new Float32Array(12);
    const axisAttr = new THREE.BufferAttribute(axisBuf, 3); axisAttr.setUsage(THREE.DynamicDrawUsage);
    const axisGeo = new THREE.BufferGeometry(); axisGeo.setAttribute('position', axisAttr);
    const axisLines = new THREE.LineSegments(axisGeo, new THREE.LineBasicMaterial({ color: 0xC8D2E1, transparent: true, opacity: 0.3, depthTest: false }));
    axisLines.renderOrder = -45; axisLines.frustumCulled = false; scene.add(axisLines);

    // Cursor aura
    const auraMat = new THREE.ShaderMaterial({
      uniforms: { uMouse: { value: new THREE.Vector2(-9999, -9999) }, uRes: { value: new THREE.Vector2(W, H) } },
      vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader: `uniform vec2 uMouse,uRes;varying vec2 vUv;void main(){float d=distance(vUv*uRes,uMouse);gl_FragColor=vec4(0.35,0.77,0.87,exp(-d*d/3000.0)*0.08);}`,
      transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false,
    });
    const auraMesh = new THREE.Mesh(new THREE.PlaneGeometry(W, H), auraMat);
    auraMesh.position.set(W / 2, H / 2, -1); auraMesh.renderOrder = 50; auraMesh.frustumCulled = false; scene.add(auraMesh);

    // Tip particles
    const TIP_MAX = 7;
    const tipGeo = new THREE.BufferGeometry();
    tipGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TIP_MAX * 3), 3));
    tipGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(TIP_MAX * 3), 3));
    tipGeo.setAttribute('size', new THREE.BufferAttribute(new Float32Array(TIP_MAX), 1));
    const tipPts = new THREE.Points(tipGeo, new THREE.ShaderMaterial({
      vertexShader: `attribute float size;attribute vec3 color;varying vec3 vC;void main(){vC=color;gl_PointSize=size;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader: `varying vec3 vC;void main(){float d=length(gl_PointCoord-0.5)*2.0;if(d>1.0)discard;float a=(1.0-d*d);gl_FragColor=vec4(vC*3.0*a,a);}`,
      transparent: true, blending: THREE.AdditiveBlending, depthTest: false,
    }));
    tipPts.renderOrder = 20; tipPts.frustumCulled = false; scene.add(tipPts);

    // Label overlay
    const lc = document.createElement('canvas');
    Object.assign(lc.style, { position: 'absolute', top: '0', left: '0', pointerEvents: 'none', zIndex: '10' });
    wrap.appendChild(lc);

    const onResize = () => {
      const r = wrap.getBoundingClientRect();
      W = r.width; H = r.height; sizeRef.current = { w: W, h: H };
      renderer.setSize(W, H);
      camera.right = W; camera.bottom = H; camera.updateProjectionMatrix();
      sceneRT.setSize(W, H);
      for (let i = 0; i < bloomRTs.length; i++) { const s = Math.pow(2, Math.floor(i / 2) + 1); bloomRTs[i].setSize(Math.ceil(W / s), Math.ceil(H / s)); }
      bgMesh.geometry.dispose(); bgMesh.geometry = new THREE.PlaneGeometry(W, H); bgMesh.position.set(W / 2, H / 2, -10);
      (bgMesh.material as THREE.ShaderMaterial).uniforms.uRes.value.set(W, H);
      auraMesh.geometry.dispose(); auraMesh.geometry = new THREE.PlaneGeometry(W, H); auraMesh.position.set(W / 2, H / 2, -1);
      auraMat.uniforms.uRes.value.set(W, H);
    };
    const resObs = new ResizeObserver(onResize); resObs.observe(wrap);

    let lastTime = performance.now();
    let timeAcc = 0;

    const loop = (now: number) => {
      animRef.current = requestAnimationFrame(loop);
      const dt = Math.min((now - lastTime) / 16.667, 3);
      lastTime = now; timeAcc += dt * 0.016;

      const st = stateRef.current;
      const fns = functionsRef.current;
      const prms = paramsRef.current;
      W = sizeRef.current.w; H = sizeRef.current.h;
      const lerpF = 1 - Math.pow(0.001, dt / 60);

      st.scale += (st.targetScale - st.scale) * lerpF;
      if (!st.isDragging && !st.isTouching) {
        st.targetCenterX += st.velocityX; st.targetCenterY += st.velocityY;
        const decay = Math.pow(0.92, dt);
        st.velocityX *= decay; st.velocityY *= decay;
        if (Math.abs(st.velocityX) < 0.0005) st.velocityX = 0;
        if (Math.abs(st.velocityY) < 0.0005) st.velocityY = 0;
      }
      st.centerX += (st.targetCenterX - st.centerX) * lerpF;
      st.centerY += (st.targetCenterY - st.centerY) * lerpF;

      const scale = st.scale;
      const cx = W / 2 + st.centerX * scale;
      const cy = H / 2 - st.centerY * scale;
      const step = gridStep(scale);
      const sX = Math.floor((-cx / scale) / step) * step, eX = Math.ceil(((W - cx) / scale) / step) * step;
      const sY = Math.floor((-(H - cy) / scale) / step) * step, eY = Math.ceil((cy / scale) / step) * step;

      // Grid
      let gi = 0;
      for (let x = sX; x <= eX && gi < MAX_GRID_VERTS * 3 - 6; x += step) { if (Math.abs(x) < 1e-10) continue; const px = cx + x * scale; gridBuf[gi++] = px; gridBuf[gi++] = 0; gridBuf[gi++] = -8; gridBuf[gi++] = px; gridBuf[gi++] = H; gridBuf[gi++] = -8; }
      for (let y = sY; y <= eY && gi < MAX_GRID_VERTS * 3 - 6; y += step) { if (Math.abs(y) < 1e-10) continue; const py = cy - y * scale; gridBuf[gi++] = 0; gridBuf[gi++] = py; gridBuf[gi++] = -8; gridBuf[gi++] = W; gridBuf[gi++] = py; gridBuf[gi++] = -8; }
      gridGeo.setDrawRange(0, gi / 3); gridAttr.needsUpdate = true;

      let di = 0;
      for (let x = sX; x <= eX; x += step) for (let y = sY; y <= eY; y += step) {
        if (di >= MAX_DOTS) break;
        const px = cx + x * scale, py = cy - y * scale;
        if (px < -10 || px > W + 10 || py < -10 || py > H + 10) continue;
        dotPosBuf[di * 3] = px; dotPosBuf[di * 3 + 1] = py; dotPosBuf[di * 3 + 2] = -7;
        dotBriBuf[di] = Math.max(0.15, 0.6 / (1 + Math.sqrt(x * x + y * y) * 0.3)); di++;
      }
      dotGeo.setDrawRange(0, di); dotPosAttr.needsUpdate = true; dotBriAttr.needsUpdate = true;

      axisBuf[0] = 0; axisBuf[1] = cy; axisBuf[2] = -5; axisBuf[3] = W; axisBuf[4] = cy; axisBuf[5] = -5;
      axisBuf[6] = cx; axisBuf[7] = 0; axisBuf[8] = -5; axisBuf[9] = cx; axisBuf[10] = H; axisBuf[11] = -5;
      axisAttr.needsUpdate = true;

      // Dust
      const dps = dustPts.geometry.attributes.position.array as Float32Array;
      const spd = dustPts.userData.speeds as Float32Array;
      for (let i = 0; i < dps.length / 3; i++) {
        dps[i * 3] += spd[i * 2] * dt; dps[i * 3 + 1] += spd[i * 2 + 1] * dt;
        if (dps[i * 3] < -5) dps[i * 3] = W + 5; if (dps[i * 3] > W + 5) dps[i * 3] = -5;
        if (dps[i * 3 + 1] < -5) dps[i * 3 + 1] = H + 5; if (dps[i * 3 + 1] > H + 5) dps[i * 3 + 1] = -5;
      }
      dustPts.geometry.attributes.position.needsUpdate = true;
      auraMat.uniforms.uMouse.value.set(st.mouseActive ? st.mouseX : -9999, st.mouseActive ? H - st.mouseY : -9999);

      // Curves
      while (curveMeshesRef.current.length < fns.length) { const m = buildCurveMesh(fns[curveMeshesRef.current.length]?.colorDark || CURVE_COLORS_DARK[curveMeshesRef.current.length % 7]); scene.add(m); curveMeshesRef.current.push(m); }
      while (curveMeshesRef.current.length > fns.length) { const m = curveMeshesRef.current.pop()!; scene.remove(m); m.geometry.dispose(); (m.material as THREE.Material).dispose(); }
      while (progressRef.current.length < fns.length) progressRef.current.push(0);

      const curExprs = fns.map(f => f.expr + ':' + f.enabled + ':' + Object.values(prms).join(','));
      for (let i = 0; i < fns.length; i++) {
        if (prevExprsRef.current[i] !== curExprs[i]) {
          progressRef.current[i] = 0;
          const c = new THREE.Color(fns[i].colorDark);
          (curveMeshesRef.current[i].material as THREE.ShaderMaterial).uniforms.uColor.value.set(c.r, c.g, c.b);
        }
      }
      prevExprsRef.current = curExprs;

      const mouseWorldX = st.mouseActive ? (st.mouseX - cx) / scale : NaN;
      const tipPos = tipPts.geometry.attributes.position.array as Float32Array;
      const tipCol = tipPts.geometry.attributes.color.array as Float32Array;
      const tipSiz = tipPts.geometry.attributes.size.array as Float32Array;

      for (let fi = 0; fi < fns.length; fi++) {
        const fn = fns[fi], mesh = curveMeshesRef.current[fi], mat = mesh.material as THREE.ShaderMaterial;
        if (!fn.enabled || !fn.compiled) { mesh.visible = false; tipPos[fi * 3] = -9999; tipSiz[fi] = 0; continue; }
        mesh.visible = true;
        if (progressRef.current[fi] < 1) progressRef.current[fi] = Math.min(1, progressRef.current[fi] + 0.008 * dt);
        mat.uniforms.uProgress.value = progressRef.current[fi];
        let hoverBright = 0;
        if (st.mouseActive && !st.isDragging && isFinite(mouseWorldX)) {
          const val = evalFn(fn.compiled, mouseWorldX, prms);
          if (isFinite(val)) { const screenDist = Math.abs(cy - val * scale - st.mouseY); hoverBright = Math.max(0, 1 - screenDist / 60); }
        }
        mat.uniforms.uHoverBright.value += (hoverBright - mat.uniforms.uHoverBright.value) * 0.15;
        const points: { x: number; y: number; valid: boolean }[] = [];
        for (let px = 0; px < W; px += 2) {
          const x = (px - cx) / scale, y = evalFn(fn.compiled, x, prms);
          points.push(!isFinite(y) || Math.abs(y) > 1e6 ? { x: px, y: 0, valid: false } : { x: px, y: cy - y * scale, valid: true });
        }
        updateCurveGeometry(mesh, points, 2.5);
        const prog = progressRef.current[fi];
        if (prog < 1) {
          const tipIdx = Math.floor(prog * (points.length - 1));
          const tp = points[Math.min(tipIdx, points.length - 1)];
          if (tp?.valid) { tipPos[fi * 3] = tp.x; tipPos[fi * 3 + 1] = tp.y; tipPos[fi * 3 + 2] = 1; const cc = new THREE.Color(fn.colorDark); tipCol[fi * 3] = cc.r; tipCol[fi * 3 + 1] = cc.g; tipCol[fi * 3 + 2] = cc.b; tipSiz[fi] = 12 + Math.sin(timeAcc * 8) * 3; }
          else { tipPos[fi * 3] = -9999; tipSiz[fi] = 0; }
        } else { tipPos[fi * 3] = -9999; tipSiz[fi] = 0; }
      }
      for (let i = fns.length; i < TIP_MAX; i++) { tipPos[i * 3] = -9999; tipSiz[i] = 0; }
      tipPts.geometry.attributes.position.needsUpdate = true;
      tipPts.geometry.attributes.color.needsUpdate = true;
      tipPts.geometry.attributes.size.needsUpdate = true;

      // Labels
      const ldpr = Math.min(window.devicePixelRatio, 2);
      if (lc.width !== W * ldpr || lc.height !== H * ldpr) { lc.width = W * ldpr; lc.height = H * ldpr; lc.style.width = W + 'px'; lc.style.height = H + 'px'; }
      const lctx = lc.getContext('2d')!;
      lctx.clearRect(0, 0, lc.width, lc.height);
      lctx.save(); lctx.scale(ldpr, ldpr);

      // Cinematic axis labels
      lctx.fillStyle = 'rgba(200,210,225,0.45)'; lctx.font = '10px "JetBrains Mono",monospace';
      lctx.textAlign = 'center'; lctx.textBaseline = 'top';
      for (let x = sX; x <= eX; x += step) { if (Math.abs(x) < 1e-10) continue; const px = cx + x * scale; if (px < 30 || px > W - 30) continue; lctx.fillText(formatAxisValue(x), px, cy + 8); }
      lctx.textAlign = 'right'; lctx.textBaseline = 'middle';
      for (let y = sY; y <= eY; y += step) { if (Math.abs(y) < 1e-10) continue; const py = cy - y * scale; if (py < 15 || py > H - 15) continue; lctx.fillText(formatAxisValue(y), cx - 8, py); }

      // Cinematic hover/critical/pinned (same as before but in overlay)
      if (showCriticalRef.current) {
        const cacheKey = fns.map(f => f.expr + ':' + f.enabled).join('|') + '|' + Object.values(prms).join(',') + '|' + scale.toFixed(1) + '|' + cx.toFixed(0);
        if (critsCache.current.key !== cacheKey) {
          const xMin = (0 - cx) / scale, xMax = (W - cx) / scale;
          critsCache.current.data = fns.map(fn2 => fn2.enabled && fn2.compiled ? findCriticalPoints(fn2.compiled, xMin, xMax, prms) : []);
          critsCache.current.key = cacheKey;
        }
        for (let fi = 0; fi < fns.length; fi++) {
          const crits = critsCache.current.data[fi] || [];
          for (const cp of crits) {
            const sx = cx + cp.x * scale, sy = cy - cp.y * scale;
            if (sx < 5 || sx > W - 5 || sy < 5 || sy > H - 5) continue;
            const dotColor = cp.type === 'zero' ? '#ECF0F1' : cp.type === 'max' ? '#F4D03F' : '#FC6255';
            const g = lctx.createRadialGradient(sx, sy, 0, sx, sy, 14);
            g.addColorStop(0, dotColor + '80'); g.addColorStop(1, 'transparent');
            lctx.fillStyle = g; lctx.fillRect(sx - 14, sy - 14, 28, 28);
            lctx.beginPath(); lctx.arc(sx, sy, 3.5, 0, Math.PI * 2); lctx.fillStyle = dotColor; lctx.fill();
            lctx.font = '9px "JetBrains Mono",monospace'; lctx.fillStyle = dotColor; lctx.textAlign = 'left'; lctx.textBaseline = 'bottom';
            lctx.fillText(`${cp.type} (${formatAxisValue(cp.x)}, ${cp.y.toFixed(2)})`, sx + 8, sy - 4);
          }
        }
      }

      for (const pp of pinnedRef.current) {
        const sx = cx + pp.x * scale, sy = cy - pp.y * scale;
        if (sx < 5 || sx > W - 5 || sy < 5 || sy > H - 5) continue;
        const g = lctx.createRadialGradient(sx, sy, 0, sx, sy, 18);
        g.addColorStop(0, pp.color + '90'); g.addColorStop(0.3, pp.color + '40'); g.addColorStop(1, 'transparent');
        lctx.fillStyle = g; lctx.fillRect(sx - 18, sy - 18, 36, 36);
        lctx.beginPath(); lctx.arc(sx, sy, 5, 0, Math.PI * 2); lctx.fillStyle = pp.color; lctx.fill();
        lctx.beginPath(); lctx.arc(sx, sy, 2, 0, Math.PI * 2); lctx.fillStyle = 'rgba(255,255,255,0.9)'; lctx.fill();
        lctx.font = 'bold 10px "JetBrains Mono",monospace'; lctx.textAlign = 'left';
        const txt = `(${formatAxisValue(pp.x)}, ${pp.y.toFixed(3)})`;
        const tm = lctx.measureText(txt);
        lctx.fillStyle = 'rgba(10,12,20,0.9)'; lctx.beginPath(); lctx.roundRect(sx + 10, sy - 10, tm.width + 10, 18, 4); lctx.fill();
        lctx.fillStyle = pp.color; lctx.fillText(txt, sx + 15, sy + 3);
      }

      if (st.mouseActive && !st.isDragging) {
        const mx = (st.mouseX - cx) / scale, my2 = (cy - st.mouseY) / scale;
        lctx.strokeStyle = 'rgba(200,210,225,0.12)'; lctx.lineWidth = 0.8; lctx.setLineDash([4, 4]);
        lctx.beginPath(); lctx.moveTo(st.mouseX, 0); lctx.lineTo(st.mouseX, H); lctx.stroke();
        lctx.beginPath(); lctx.moveTo(0, st.mouseY); lctx.lineTo(W, st.mouseY); lctx.stroke();
        lctx.setLineDash([]);
        lctx.font = '11px "JetBrains Mono",monospace'; lctx.textAlign = 'left';
        const xLabel = formatPi(mx) || mx.toFixed(2);
        const coordText = `(${xLabel}, ${my2.toFixed(2)})`;
        const tm2 = lctx.measureText(coordText);
        const lx2 = Math.min(st.mouseX + 14, W - tm2.width - 20);
        const ly2 = Math.max(st.mouseY - 12, 20);
        lctx.fillStyle = 'rgba(10,12,20,0.85)'; lctx.beginPath(); lctx.roundRect(lx2 - 6, ly2 - 9, tm2.width + 12, 18, 4); lctx.fill();
        lctx.fillStyle = '#ECF0F1'; lctx.fillText(coordText, lx2, ly2 + 4);

        let labelYOff = ly2 - 22;
        for (let fi = 0; fi < fns.length; fi++) {
          const fn = fns[fi]; if (!fn.enabled || !fn.compiled) continue;
          const val = evalFn(fn.compiled, mx, prms); if (!isFinite(val)) continue;
          const py = cy - val * scale;
          const g2 = lctx.createRadialGradient(st.mouseX, py, 0, st.mouseX, py, 16);
          g2.addColorStop(0, fn.colorDark + '90'); g2.addColorStop(0.3, fn.colorDark + '40'); g2.addColorStop(1, 'transparent');
          lctx.fillStyle = g2; lctx.fillRect(st.mouseX - 16, py - 16, 32, 32);
          lctx.beginPath(); lctx.arc(st.mouseX, py, 4, 0, Math.PI * 2); lctx.fillStyle = fn.colorDark; lctx.fill();
          if (showTangentRef.current) {
            const slope = numericalDerivative(fn.compiled, mx, prms);
            if (isFinite(slope)) {
              const tangentLen = 80; const dx2 = tangentLen / Math.sqrt(1 + slope * slope); const dy2 = -slope * dx2;
              lctx.strokeStyle = fn.colorDark + '60'; lctx.lineWidth = 1;
              lctx.beginPath(); lctx.moveTo(st.mouseX - dx2, py - dy2); lctx.lineTo(st.mouseX + dx2, py + dy2); lctx.stroke();
              lctx.font = '9px "JetBrains Mono",monospace'; lctx.fillStyle = fn.colorDark + '99';
              lctx.fillText(`m=${slope.toFixed(2)}`, st.mouseX + dx2 + 4, py + dy2 - 4);
            }
          }
          lctx.font = '10px "JetBrains Mono",monospace';
          const valText = `y = ${val.toFixed(3)}`; const vtm = lctx.measureText(valText);
          lctx.fillStyle = 'rgba(10,12,20,0.85)'; lctx.beginPath(); lctx.roundRect(lx2 - 6, labelYOff - 9, vtm.width + 12, 18, 4); lctx.fill();
          lctx.fillStyle = fn.colorDark; lctx.fillText(valText, lx2, labelYOff + 4);
          labelYOff -= 22;
        }
      }
      lctx.restore();

      // Render pipeline
      renderer.setRenderTarget(sceneRT); renderer.clear(); renderer.render(scene, camera);
      fsQuad.material = threshMat; threshMat.uniforms.tDiffuse.value = sceneRT.texture;
      renderer.setRenderTarget(bloomRTs[0]); renderer.clear(); renderer.render(bloomScene, bloomCam);
      for (let i = 0; i < bloomRTs.length - 1; i++) {
        fsQuad.material = blurMat; blurMat.uniforms.tDiffuse.value = bloomRTs[i].texture;
        const rt = bloomRTs[i + 1]; blurMat.uniforms.uOffset.value.set((i + 0.5) / rt.width, (i + 0.5) / rt.height);
        renderer.setRenderTarget(rt); renderer.clear(); renderer.render(bloomScene, bloomCam);
      }
      fsQuad.material = compositeMat; compositeMat.uniforms.tScene.value = sceneRT.texture;
      compositeMat.uniforms.tBloom.value = bloomRTs[bloomRTs.length - 1].texture;
      compositeMat.uniforms.uTime.value = timeAcc;
      renderer.setRenderTarget(null); renderer.clear(); renderer.render(bloomScene, bloomCam);
    };
    animRef.current = requestAnimationFrame(loop);
    renderer.domElement.style.opacity = '0';
    gsap.to(renderer.domElement, { opacity: 1, duration: 0.8, ease: 'power2.out' });

    return () => {
      cancelAnimationFrame(animRef.current);
      cleanupInteraction(); resObs.disconnect();
      curveMeshesRef.current.forEach(m => { scene.remove(m); m.geometry.dispose(); (m.material as THREE.Material).dispose(); });
      curveMeshesRef.current = []; progressRef.current = []; prevExprsRef.current = [];
      scene.traverse(o => { if (o instanceof THREE.Mesh || o instanceof THREE.Points || o instanceof THREE.LineSegments) { o.geometry.dispose(); const m2 = o.material; if (Array.isArray(m2)) m2.forEach(x => x.dispose()); else (m2 as THREE.Material).dispose(); } });
      sceneRT.dispose(); bloomRTs.forEach(r => r.dispose());
      threshMat.dispose(); blurMat.dispose(); compositeMat.dispose(); fsGeo.dispose();
      if (lc.parentElement) wrap.removeChild(lc);
      if (renderer.domElement.parentElement) wrap.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [cinematic, attachInteraction, buildCurveMesh, updateCurveGeometry]);

  // ── Sidebar ──
  const addFunction = () => {
    if (functions.length >= 7) return;
    const i = functions.length;
    setFunctions(prev => [...prev, { expr: '', color: CURVE_COLORS[i % 7], colorDark: CURVE_COLORS_DARK[i % 7], enabled: true, compiled: null }]);
  };
  const removeFunction = (i: number) => {
    if (functions.length <= 1) return;
    setFunctions(prev => prev.filter((_, idx) => idx !== i));
    setPinnedPoints(prev => prev.filter(p => p.fnIdx !== i).map(p => ({ ...p, fnIdx: p.fnIdx > i ? p.fnIdx - 1 : p.fnIdx })));
  };

  const curveColor = (fn: FnEntry) => isDark ? fn.colorDark : fn.color;

  return (
    <div className="graphing-calc">
      <div className="graphing-calc-sidebar">
        <div className="graphing-calc-sidebar-header">
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Functions</span>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button onClick={() => setCinematic(!cinematic)}
              style={{
                fontSize: '0.68rem', padding: '4px 10px', borderRadius: '10px',
                background: cinematic ? 'var(--amber-glow)' : 'var(--bg-accent)',
                border: `1px solid ${cinematic ? 'var(--amber)' : 'var(--border-warm)'}`,
                color: cinematic ? 'var(--amber)' : 'var(--text-dim)',
                cursor: 'pointer', fontWeight: 600, letterSpacing: '0.3px',
              }}>
              {cinematic ? 'Cinematic' : 'Lite'}
            </button>
            <button onClick={addFunction} disabled={functions.length >= 7}
              className="graphing-calc-toggle"
              style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>+ Add</button>
          </div>
        </div>

        <div className="graphing-calc-fn-list">
          {functions.map((fn, i) => (
            <div key={i} className="graphing-calc-fn-row">
              <div className="graphing-calc-color-dot"
                style={{
                  background: curveColor(fn),
                  opacity: fn.enabled ? 1 : 0.3, cursor: 'pointer',
                  border: `2px solid ${fn.enabled ? curveColor(fn) : 'var(--border-warm)'}`,
                }}
                onClick={() => { const n = [...functions]; n[i] = { ...n[i], enabled: !n[i].enabled }; setFunctions(n); }}
                title="Toggle" />
              <input value={fn.expr}
                onChange={e => { const n = [...functions]; n[i] = { ...n[i], expr: e.target.value }; setFunctions(n); }}
                placeholder={`f${i + 1}(x) = ...`}
                className="graphing-calc-input tool-input"
                style={{ borderColor: fn.enabled && fn.expr ? curveColor(fn) + '40' : undefined }}
                onFocus={e => { e.target.style.borderColor = curveColor(fn); }}
                onBlur={e => { e.target.style.borderColor = fn.enabled && fn.expr ? curveColor(fn) + '40' : ''; }} />
              {functions.length > 1 && (
                <button onClick={() => removeFunction(i)} className="graphing-calc-remove" title="Remove">&times;</button>
              )}
            </div>
          ))}

          {/* Parameter sliders */}
          {usedParams.length > 0 && (
            <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-warm)' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-dim)', marginBottom: '8px' }}>Parameters</div>
              {usedParams.map(p => (
                <div key={p} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--amber)', fontFamily: 'monospace', fontSize: '0.88rem', width: '14px', fontWeight: 700 }}>{p}</span>
                  <input type="range" min={-5} max={5} step={0.1} value={params[p] ?? 1}
                    onChange={e => setParams(prev => ({ ...prev, [p]: +e.target.value }))}
                    style={{ flex: 1, accentColor: 'var(--amber)', height: '3px' }} />
                  <span style={{ color: 'var(--text-dim)', fontFamily: 'monospace', fontSize: '0.78rem', width: '36px', textAlign: 'right' }}>{(params[p] ?? 1).toFixed(1)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Toggles */}
          <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-dim)' }}>
              <input type="checkbox" checked={showCritical} onChange={e => setShowCritical(e.target.checked)} style={{ accentColor: 'var(--amber)' }} />
              Critical points
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-dim)' }}>
              <input type="checkbox" checked={showTangent} onChange={e => setShowTangent(e.target.checked)} style={{ accentColor: 'var(--amber)' }} />
              Tangent line
            </label>
          </div>

          {/* Pinned points */}
          {pinnedPoints.length > 0 && (
            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-warm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-dim)' }}>Pinned</span>
                <button onClick={() => setPinnedPoints([])} style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', cursor: 'pointer' }}>Clear</button>
              </div>
              {pinnedPoints.map((pp, i) => (
                <div key={i} style={{ fontSize: '0.75rem', color: pp.color, fontFamily: 'monospace', marginBottom: '2px' }}>
                  ({formatAxisValue(pp.x)}, {pp.y.toFixed(3)})
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="graphing-calc-hint">
          Scroll to zoom · Drag to pan · Click curve to pin<br />
          Double-click to center · R reset · +/- zoom · Arrows pan
        </div>
      </div>

      <div ref={canvasWrapRef} className="graphing-calc-canvas-wrap" />
    </div>
  );
}
