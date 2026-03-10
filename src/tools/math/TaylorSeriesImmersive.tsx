/**
 * TaylorSeriesImmersive.tsx — WebGL2 Immersive Mode renderer for Taylor Series.
 *
 * Lazy-loaded only when user clicks the Immersive Mode toggle.
 * Renders Taylor approximation curves + the original function with GPU bloom.
 */

import { useRef, useEffect, useCallback, useMemo } from 'react';
import * as math from 'mathjs';
import * as THREE from 'three';
import gsap from 'gsap';
import {
  ImmersiveRenderer,
  IMM,
  createBackground, updateBackground,
  createAxes,
  createGlowLine, updateGlowLine,
  createGlowDot, positionDot,
} from '../../utils/immersive';

interface Props {
  fn: string;
  center: number;
  terms: number;
}

export default function TaylorSeriesImmersive({ fn, center, terms }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<ImmersiveRenderer | null>(null);

  // Scene object refs
  const bgRef = useRef<THREE.Mesh | null>(null);
  const gridRef = useRef<THREE.LineSegments | null>(null);
  const axesRef = useRef<THREE.Group | null>(null);
  const taylorLinesRef = useRef<Map<number, THREE.Mesh>>(new Map());
  const origLineRef = useRef<THREE.Mesh | null>(null);
  const centerDotRef = useRef<THREE.Group | null>(null);

  // Compile the user function
  const compiled = useMemo(() => {
    try { return math.compile(fn); }
    catch { return null; }
  }, [fn]);

  // Evaluate the function
  const f = useCallback((x: number): number => {
    if (!compiled) return NaN;
    try { return Number(compiled.evaluate({ x, e: Math.E, pi: Math.PI })); }
    catch { return NaN; }
  }, [compiled]);

  // Compute Taylor coefficients via numerical differentiation
  const derivCoeffs = useMemo(() => {
    const h = 1e-5;
    const coeffs: number[] = [];
    const fEval = (x: number): number => {
      if (!compiled) return NaN;
      try { return Number(compiled.evaluate({ x, e: Math.E, pi: Math.PI })); }
      catch { return NaN; }
    };
    coeffs.push(fEval(center));
    let prevDeriv = fEval;

    for (let k = 1; k <= terms; k++) {
      const prev = prevDeriv;
      const dfdx = (x: number) => (prev(x + h) - prev(x - h)) / (2 * h);
      coeffs.push(dfdx(center));
      prevDeriv = dfdx;
    }
    return coeffs;
  }, [compiled, center, terms]);

  // Initialize renderer
  useEffect(() => {
    if (!containerRef.current) return;

    const imm = new ImmersiveRenderer({ container: containerRef.current });
    rendererRef.current = imm;

    // Fade in with GSAP
    imm.canvas.style.opacity = '0';
    gsap.to(imm.canvas, { opacity: 1, duration: 0.6, ease: 'power2.out' });

    // Background
    bgRef.current = createBackground(imm.width, imm.height);
    imm.scene.add(bgRef.current);

    // Center dot
    centerDotRef.current = createGlowDot('#83C167', 5);
    imm.scene.add(centerDotRef.current);

    imm.start();

    return () => {
      imm.dispose();
      rendererRef.current = null;
      taylorLinesRef.current.clear();
      origLineRef.current = null;
    };
  }, []);

  // Update scene every frame
  const updateScene = useCallback(() => {
    const imm = rendererRef.current;
    if (!imm) return;

    const W = imm.width;
    const H = imm.height;

    // View window matching 2D version
    const xMin = center - 8;
    const xMax = center + 8;
    let yMin = -4;
    let yMax = 4;

    // Auto-scale Y
    for (let i = 0; i <= 100; i++) {
      const x = xMin + (xMax - xMin) * (i / 100);
      const y = f(x);
      if (isFinite(y)) {
        yMin = Math.min(yMin, y - 1);
        yMax = Math.max(yMax, y + 1);
      }
    }

    const toX = (x: number) => ((x - xMin) / (xMax - xMin)) * W;
    const toY = (y: number) => H - ((y - yMin) / (yMax - yMin)) * H;

    // Coordinate system center in pixels
    const cx = toX(0);
    const cy = toY(0);

    // Background
    if (bgRef.current) updateBackground(bgRef.current, W, H);

    // Grid — rebuild each frame
    if (gridRef.current) {
      imm.scene.remove(gridRef.current);
      gridRef.current.geometry.dispose();
      (gridRef.current.material as THREE.Material).dispose();
    }
    {
      const positions: number[] = [];
      for (let x = Math.ceil(xMin); x <= xMax; x++) {
        const px = toX(x);
        positions.push(px, 0, 0, px, H, 0);
      }
      for (let y = Math.ceil(yMin); y <= yMax; y++) {
        const py = toY(y);
        positions.push(0, py, 0, W, py, 0);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      const mat = new THREE.LineBasicMaterial({
        color: IMM.grid,
        transparent: true,
        opacity: IMM.gridAlpha,
        depthTest: false,
      });
      gridRef.current = new THREE.LineSegments(geo, mat);
      gridRef.current.renderOrder = -50;
      imm.scene.add(gridRef.current);
    }

    // Axes
    if (axesRef.current) {
      imm.scene.remove(axesRef.current);
      axesRef.current.traverse(o => {
        if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
    }
    axesRef.current = createAxes(W, H, cx, cy);
    imm.scene.add(axesRef.current);

    const resolution = imm.resolution;
    const existingLines = taylorLinesRef.current;
    const activeIds = new Set<number>();

    // Draw Taylor partial sums
    for (let order = 0; order <= terms; order++) {
      activeIds.add(order);

      const points: { x: number; y: number }[] = [];
      for (let i = 0; i <= 600; i++) {
        const x = xMin + (xMax - xMin) * (i / 600);
        let sum = 0;
        let fact = 1;
        for (let k = 0; k <= order; k++) {
          if (k > 0) fact *= k;
          sum += (derivCoeffs[k] / fact) * Math.pow(x - center, k);
        }
        if (!isFinite(sum) || sum < yMin - 5 || sum > yMax + 5) {
          points.push({ x: toX(x), y: NaN });
        } else {
          points.push({ x: toX(x), y: toY(sum) });
        }
      }

      const color = IMM.palette[order % IMM.palette.length];
      const isCurrent = order === terms;
      const existingMesh = existingLines.get(order);

      if (existingMesh) {
        updateGlowLine(existingMesh, points);
        const mat = existingMesh.material as THREE.ShaderMaterial;
        mat.uniforms.color.value.set(color);
        mat.uniforms.opacity.value = isCurrent ? 1.0 : 0.25;
        mat.uniforms.emissive.value = isCurrent ? IMM.bloomEmissive : 0.8;
      } else {
        const mesh = createGlowLine(points, resolution, {
          color,
          width: isCurrent ? 3 : 2,
          emissive: isCurrent ? IMM.bloomEmissive : 0.8,
          opacity: isCurrent ? 1.0 : 0.25,
        });
        if (mesh) {
          mesh.renderOrder = 10 + order;
          imm.scene.add(mesh);
          existingLines.set(order, mesh);
        }
      }
    }

    // Remove old lines for terms that no longer exist
    for (const [id, mesh] of existingLines) {
      if (!activeIds.has(id)) {
        imm.scene.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
        existingLines.delete(id);
      }
    }

    // Original function curve (dashed effect via lower emissive + different color)
    {
      const origPoints: { x: number; y: number }[] = [];
      for (let i = 0; i <= 600; i++) {
        const x = xMin + (xMax - xMin) * (i / 600);
        const y = f(x);
        if (!isFinite(y)) {
          origPoints.push({ x: toX(x), y: NaN });
        } else {
          origPoints.push({ x: toX(x), y: toY(y) });
        }
      }

      if (origLineRef.current) {
        updateGlowLine(origLineRef.current, origPoints);
      } else {
        const mesh = createGlowLine(origPoints, resolution, {
          color: '#F4D03F',
          width: 2,
          emissive: 1.5,
          opacity: 0.7,
        });
        if (mesh) {
          mesh.renderOrder = 5;
          imm.scene.add(mesh);
          origLineRef.current = mesh;
        }
      }
    }

    // Center dot
    if (centerDotRef.current) {
      const fCenter = f(center);
      if (isFinite(fCenter)) {
        positionDot(centerDotRef.current, toX(center), toY(fCenter));
      } else {
        centerDotRef.current.visible = false;
      }
    }
  }, [f, center, terms, derivCoeffs]);

  // Wire up the render callback
  useEffect(() => {
    rendererRef.current?.onBeforeRender(updateScene);
  }, [updateScene]);

  return (
    <div
      ref={containerRef}
      className="immersive-canvas-container"
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
      }}
    />
  );
}
