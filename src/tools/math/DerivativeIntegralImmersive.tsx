/**
 * DerivativeIntegralImmersive.tsx — WebGL2 Immersive Mode renderer for the
 * Derivative/Integral graph.
 *
 * Lazy-loaded only when user clicks the Immersive Mode toggle.
 * Uses Three.js + postprocessing for real GPU bloom, anti-aliased lines,
 * vignette, and film grain.
 */

import { useRef, useEffect, useCallback, useMemo } from 'react';
import * as math from 'mathjs';
const { compile } = math;
import * as THREE from 'three';
import gsap from 'gsap';
import {
  ImmersiveRenderer,
  IMM,
  createBackground, updateBackground,
  createAxes,
  createGlowLine, updateGlowLine,
} from '../../utils/immersive';

interface Props {
  expression: string;
  derivativeExpression: string | null;
  variable: string;
}

export default function DerivativeIntegralImmersive({
  expression, derivativeExpression, variable,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<ImmersiveRenderer | null>(null);

  // Scene object refs
  const bgRef = useRef<THREE.Mesh | null>(null);
  const gridRef = useRef<THREE.LineSegments | null>(null);
  const axesRef = useRef<THREE.Group | null>(null);
  const fLineMeshRef = useRef<THREE.Mesh | null>(null);
  const dLineMeshRef = useRef<THREE.Mesh | null>(null);

  // Memoize compiled functions
  const compiledF = useMemo(() => {
    if (!expression.trim()) return null;
    try { return compile(expression); }
    catch { return null; }
  }, [expression]);

  const compiledD = useMemo(() => {
    if (!derivativeExpression || !derivativeExpression.trim()) return null;
    try { return compile(derivativeExpression); }
    catch { return null; }
  }, [derivativeExpression]);

  // Initialize renderer
  useEffect(() => {
    if (!containerRef.current) return;

    const imm = new ImmersiveRenderer({ container: containerRef.current });
    rendererRef.current = imm;

    // Fade in with GSAP
    imm.canvas.style.opacity = '0';
    gsap.to(imm.canvas, { opacity: 1, duration: 0.6, ease: 'power2.out' });

    // Initial scene objects
    bgRef.current = createBackground(imm.width, imm.height);
    imm.scene.add(bgRef.current);

    imm.start();

    return () => {
      imm.dispose();
      rendererRef.current = null;
      fLineMeshRef.current = null;
      dLineMeshRef.current = null;
    };
  }, []);

  // Update scene every frame
  const updateScene = useCallback(() => {
    const imm = rendererRef.current;
    if (!imm) return;

    const W = imm.width;
    const H = imm.height;

    // Auto-range based on function values
    const xMin = -6, xMax = 6;
    let yMin = Infinity, yMax = -Infinity;
    const N = 600;

    const evalFn = (compiled: math.EvalFunction, x: number): number => {
      try {
        const val = compiled.evaluate({ [variable]: x, e: Math.E, pi: Math.PI });
        return typeof val === 'number' ? val : NaN;
      } catch { return NaN; }
    };

    if (compiledF) {
      for (let i = 0; i <= N; i++) {
        const x = xMin + (xMax - xMin) * (i / N);
        const y = evalFn(compiledF, x);
        if (isFinite(y)) { yMin = Math.min(yMin, y); yMax = Math.max(yMax, y); }
      }
    }
    if (compiledD) {
      for (let i = 0; i <= N; i++) {
        const x = xMin + (xMax - xMin) * (i / N);
        const y = evalFn(compiledD, x);
        if (isFinite(y)) { yMin = Math.min(yMin, y); yMax = Math.max(yMax, y); }
      }
    }
    if (!isFinite(yMin)) { yMin = -5; yMax = 5; }
    const yPad = (yMax - yMin) * 0.15 || 1;
    yMin -= yPad;
    yMax += yPad;

    const toX = (x: number) => ((x - xMin) / (xMax - xMin)) * W;
    const toY = (y: number) => H - ((y - yMin) / (yMax - yMin)) * H;

    const cx = toX(0);
    const cy = toY(0);

    // Update background
    if (bgRef.current) updateBackground(bgRef.current, W, H);

    // Rebuild grid
    if (gridRef.current) {
      imm.scene.remove(gridRef.current);
      gridRef.current.geometry.dispose();
      (gridRef.current.material as THREE.Material).dispose();
    }
    // Build grid from integer coordinates
    const gridPositions: number[] = [];
    for (let x = Math.ceil(xMin); x <= Math.floor(xMax); x++) {
      if (x === 0) continue;
      const px = toX(x);
      gridPositions.push(px, 0, 0, px, H, 0);
    }
    for (let y = Math.ceil(yMin); y <= Math.floor(yMax); y++) {
      if (y === 0) continue;
      const py = toY(y);
      gridPositions.push(0, py, 0, W, py, 0);
    }
    const gridGeo = new THREE.BufferGeometry();
    gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(gridPositions, 3));
    const gridMat = new THREE.LineBasicMaterial({
      color: IMM.grid,
      transparent: true,
      opacity: IMM.gridAlpha,
      depthTest: false,
    });
    gridRef.current = new THREE.LineSegments(gridGeo, gridMat);
    gridRef.current.renderOrder = -50;
    imm.scene.add(gridRef.current);

    // Rebuild axes
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

    // f(x) curve
    const resolution = imm.resolution;
    if (compiledF) {
      const points: { x: number; y: number }[] = [];
      for (let i = 0; i <= N; i++) {
        const x = xMin + (xMax - xMin) * (i / N);
        const y = evalFn(compiledF, x);
        if (!isFinite(y) || Math.abs(y) > 1e6) {
          points.push({ x: toX(x), y: NaN });
        } else {
          points.push({ x: toX(x), y: toY(y) });
        }
      }

      if (fLineMeshRef.current) {
        updateGlowLine(fLineMeshRef.current, points);
      } else {
        const mesh = createGlowLine(points, resolution, {
          color: '#58C4DD',
          width: 3,
          emissive: IMM.bloomEmissive,
        });
        if (mesh) {
          mesh.renderOrder = 10;
          imm.scene.add(mesh);
          fLineMeshRef.current = mesh;
        }
      }
    } else if (fLineMeshRef.current) {
      imm.scene.remove(fLineMeshRef.current);
      fLineMeshRef.current.geometry.dispose();
      (fLineMeshRef.current.material as THREE.Material).dispose();
      fLineMeshRef.current = null;
    }

    // f'(x) / integral curve
    if (compiledD) {
      const points: { x: number; y: number }[] = [];
      for (let i = 0; i <= N; i++) {
        const x = xMin + (xMax - xMin) * (i / N);
        const y = evalFn(compiledD, x);
        if (!isFinite(y) || Math.abs(y) > 1e6) {
          points.push({ x: toX(x), y: NaN });
        } else {
          points.push({ x: toX(x), y: toY(y) });
        }
      }

      if (dLineMeshRef.current) {
        updateGlowLine(dLineMeshRef.current, points);
      } else {
        const mesh = createGlowLine(points, resolution, {
          color: '#83C167',
          width: 2.5,
          emissive: IMM.bloomEmissive,
        });
        if (mesh) {
          mesh.renderOrder = 11;
          imm.scene.add(mesh);
          dLineMeshRef.current = mesh;
        }
      }
    } else if (dLineMeshRef.current) {
      imm.scene.remove(dLineMeshRef.current);
      dLineMeshRef.current.geometry.dispose();
      (dLineMeshRef.current.material as THREE.Material).dispose();
      dLineMeshRef.current = null;
    }
  }, [compiledF, compiledD, variable]);

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
