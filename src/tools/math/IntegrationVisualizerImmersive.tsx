/**
 * IntegrationVisualizerImmersive.tsx — WebGL2 Immersive Mode renderer for the
 * Integration Visualizer.
 *
 * Lazy-loaded only when user clicks the Immersive Mode toggle.
 * Uses Three.js + postprocessing for real GPU bloom, anti-aliased lines,
 * vignette, and film grain. Riemann rectangles / trapezoids / parabolic arcs
 * are rendered as semi-transparent colored meshes.
 */

import { useRef, useEffect, useCallback, useMemo } from 'react';
import { compile } from 'mathjs';
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

type Method = 'left' | 'right' | 'midpoint' | 'trapezoid' | 'simpson';

interface Props {
  expression: string;
  bounds: [number, number];
  subdivisions: number;
  method: Method;
}

export default function IntegrationVisualizerImmersive({
  expression, bounds, subdivisions, method,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<ImmersiveRenderer | null>(null);

  // Scene object refs
  const bgRef = useRef<THREE.Mesh | null>(null);
  const gridRef = useRef<THREE.LineSegments | null>(null);
  const axesRef = useRef<THREE.Group | null>(null);
  const curveRef = useRef<THREE.Mesh | null>(null);
  const rectsGroupRef = useRef<THREE.Group | null>(null);
  const boundLinesRef = useRef<THREE.LineSegments | null>(null);
  const midDotsRef = useRef<THREE.Group[]>([]);

  const [a, b] = bounds;
  const n = subdivisions;

  // Memoize compiled function
  const compiledFn = useMemo(() => {
    if (!expression.trim()) return null;
    try { return compile(expression); }
    catch { return null; }
  }, [expression]);

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
      curveRef.current = null;
      rectsGroupRef.current = null;
      boundLinesRef.current = null;
      midDotsRef.current = [];
    };
  }, []);

  // Update scene every frame
  const updateScene = useCallback(() => {
    const imm = rendererRef.current;
    if (!imm) return;

    const W = imm.width;
    const H = imm.height;

    const f = (x: number): number => {
      if (!compiledFn) return 0;
      try {
        const val = compiledFn.evaluate({ x, e: Math.E, pi: Math.PI });
        return typeof val === 'number' ? val : 0;
      } catch { return 0; }
    };

    // Range
    const pad = (b - a) * 0.3 || 1;
    const xMin = a - pad, xMax = b + pad;
    let yMin = Infinity, yMax = -Infinity;
    for (let i = 0; i <= 300; i++) {
      const x = xMin + (xMax - xMin) * (i / 300);
      const y = f(x);
      if (isFinite(y)) { yMin = Math.min(yMin, y); yMax = Math.max(yMax, y); }
    }
    const yPad = (yMax - yMin) * 0.2 || 1;
    yMin -= yPad; yMax += yPad;
    if (yMin > 0) yMin = -0.5;

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

    // ── Riemann shapes ──
    // Clean up old rects group
    if (rectsGroupRef.current) {
      rectsGroupRef.current.traverse(o => {
        if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
          o.geometry.dispose();
          if (Array.isArray(o.material)) {
            o.material.forEach(m => m.dispose());
          } else {
            (o.material as THREE.Material).dispose();
          }
        }
      });
      imm.scene.remove(rectsGroupRef.current);
    }
    // Clean up old midpoint dots
    for (const dot of midDotsRef.current) {
      imm.scene.remove(dot);
      dot.traverse(o => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
    }
    midDotsRef.current = [];

    const rectsGroup = new THREE.Group();
    rectsGroup.renderOrder = 5;

    if (compiledFn) {
      const dx = (b - a) / n;
      const fillColor = new THREE.Color('#58C4DD');
      const strokeColor = new THREE.Color('#58C4DD');

      const isValidSimpson = method === 'simpson' && n % 2 === 0;

      if (method === 'simpson' && !isValidSimpson) {
        // Simpson needs even n — skip shapes
      } else if (method === 'simpson' && isValidSimpson) {
        // Simpson's rule — draw parabolic fills as shape approximations
        for (let i = 0; i < n; i += 2) {
          const x0 = a + i * dx;
          const x2 = x0 + 2 * dx;
          const x1 = x0 + dx;
          const y0 = f(x0), y1 = f(x1), y2 = f(x2);

          // Draw parabolic arc fill as triangle strip
          const steps = 30;
          const shapeVerts: number[] = [];
          const shapeIndices: number[] = [];
          let vtxIdx = 0;
          for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            const xp = x0 + t * 2 * dx;
            // Lagrange interpolation
            const L0 = ((xp - x1) * (xp - x2)) / ((x0 - x1) * (x0 - x2));
            const L1 = ((xp - x0) * (xp - x2)) / ((x1 - x0) * (x1 - x2));
            const L2 = ((xp - x0) * (xp - x1)) / ((x2 - x0) * (x2 - x1));
            const yp = y0 * L0 + y1 * L1 + y2 * L2;

            // Top vertex (on parabola)
            shapeVerts.push(toX(xp), toY(yp), 0);
            // Bottom vertex (on x-axis)
            shapeVerts.push(toX(xp), toY(0), 0);

            if (s > 0) {
              const base = vtxIdx - 2;
              shapeIndices.push(base, base + 1, base + 2);
              shapeIndices.push(base + 1, base + 3, base + 2);
            }
            vtxIdx += 2;
          }

          const geo = new THREE.BufferGeometry();
          geo.setAttribute('position', new THREE.Float32BufferAttribute(shapeVerts, 3));
          geo.setIndex(shapeIndices);
          const mat = new THREE.MeshBasicMaterial({
            color: fillColor,
            transparent: true,
            opacity: 0.12,
            depthTest: false,
            side: THREE.DoubleSide,
          });
          rectsGroup.add(new THREE.Mesh(geo, mat));

          // Outline via line loop for the parabolic shape
          const outlineVerts: number[] = [];
          outlineVerts.push(toX(x0), toY(0), 0);
          for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            const xp = x0 + t * 2 * dx;
            const L0 = ((xp - x1) * (xp - x2)) / ((x0 - x1) * (x0 - x2));
            const L1 = ((xp - x0) * (xp - x2)) / ((x1 - x0) * (x1 - x2));
            const L2 = ((xp - x0) * (xp - x1)) / ((x2 - x0) * (x2 - x1));
            const yp = y0 * L0 + y1 * L1 + y2 * L2;
            outlineVerts.push(toX(xp), toY(yp), 0);
          }
          outlineVerts.push(toX(x2), toY(0), 0);
          // Close back to start
          outlineVerts.push(toX(x0), toY(0), 0);
          const outlineGeo = new THREE.BufferGeometry();
          outlineGeo.setAttribute('position', new THREE.Float32BufferAttribute(outlineVerts, 3));
          const outlineMat = new THREE.LineBasicMaterial({
            color: strokeColor,
            transparent: true,
            opacity: 0.35,
            depthTest: false,
          });
          rectsGroup.add(new THREE.Line(outlineGeo, outlineMat));
        }
      } else if (method === 'trapezoid') {
        for (let i = 0; i < n; i++) {
          const x0 = a + i * dx;
          const x1 = x0 + dx;
          const y0v = f(x0), y1v = f(x1);

          // Trapezoid: 4 vertices
          const verts = new Float32Array([
            toX(x0), toY(0), 0,
            toX(x0), toY(y0v), 0,
            toX(x1), toY(y1v), 0,
            toX(x1), toY(0), 0,
          ]);
          const geo = new THREE.BufferGeometry();
          geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
          geo.setIndex([0, 1, 2, 0, 2, 3]);
          const mat = new THREE.MeshBasicMaterial({
            color: fillColor,
            transparent: true,
            opacity: 0.12,
            depthTest: false,
            side: THREE.DoubleSide,
          });
          rectsGroup.add(new THREE.Mesh(geo, mat));

          // Outline
          const outlineVerts = new Float32Array([
            toX(x0), toY(0), 0,
            toX(x0), toY(y0v), 0,
            toX(x1), toY(y1v), 0,
            toX(x1), toY(0), 0,
            toX(x0), toY(0), 0,
          ]);
          const outlineGeo = new THREE.BufferGeometry();
          outlineGeo.setAttribute('position', new THREE.BufferAttribute(outlineVerts, 3));
          const outlineMat = new THREE.LineBasicMaterial({
            color: strokeColor,
            transparent: true,
            opacity: 0.35,
            depthTest: false,
          });
          rectsGroup.add(new THREE.Line(outlineGeo, outlineMat));
        }
      } else {
        // left, right, midpoint — rectangles
        for (let i = 0; i < n; i++) {
          const x0 = a + i * dx;
          const x1 = x0 + dx;
          let sampleX = x0;
          if (method === 'right') sampleX = x1;
          else if (method === 'midpoint') sampleX = (x0 + x1) / 2;
          const h = f(sampleX);

          const rectTop = Math.min(toY(h), toY(0));
          const rectBot = Math.max(toY(h), toY(0));
          const left = toX(x0);
          const right = toX(x1);

          const verts = new Float32Array([
            left, rectTop, 0,
            right, rectTop, 0,
            right, rectBot, 0,
            left, rectBot, 0,
          ]);
          const geo = new THREE.BufferGeometry();
          geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
          geo.setIndex([0, 1, 2, 0, 2, 3]);
          const mat = new THREE.MeshBasicMaterial({
            color: fillColor,
            transparent: true,
            opacity: 0.12,
            depthTest: false,
            side: THREE.DoubleSide,
          });
          rectsGroup.add(new THREE.Mesh(geo, mat));

          // Outline
          const outlineVerts = new Float32Array([
            left, rectTop, 0,
            right, rectTop, 0,
            right, rectBot, 0,
            left, rectBot, 0,
            left, rectTop, 0,
          ]);
          const outlineGeo = new THREE.BufferGeometry();
          outlineGeo.setAttribute('position', new THREE.BufferAttribute(outlineVerts, 3));
          const outlineMat = new THREE.LineBasicMaterial({
            color: strokeColor,
            transparent: true,
            opacity: 0.35,
            depthTest: false,
          });
          rectsGroup.add(new THREE.Line(outlineGeo, outlineMat));

          // Midpoint dots
          if (method === 'midpoint') {
            const dot = createGlowDot('#58C4DD', 3);
            positionDot(dot, toX(sampleX), toY(h));
            imm.scene.add(dot);
            midDotsRef.current.push(dot);
          }
        }
      }
    }

    rectsGroupRef.current = rectsGroup;
    imm.scene.add(rectsGroup);

    // ── Bound marker lines (dashed) ──
    if (boundLinesRef.current) {
      imm.scene.remove(boundLinesRef.current);
      boundLinesRef.current.geometry.dispose();
      (boundLinesRef.current.material as THREE.Material).dispose();
    }
    const boundPositions = new Float32Array([
      toX(a), 0, 0, toX(a), H, 0,
      toX(b), 0, 0, toX(b), H, 0,
    ]);
    const boundGeo = new THREE.BufferGeometry();
    boundGeo.setAttribute('position', new THREE.BufferAttribute(boundPositions, 3));
    const boundMat = new THREE.LineDashedMaterial({
      color: 0x83C167,
      transparent: true,
      opacity: 0.6,
      dashSize: 5,
      gapSize: 4,
      depthTest: false,
    });
    boundLinesRef.current = new THREE.LineSegments(boundGeo, boundMat);
    boundLinesRef.current.computeLineDistances();
    boundLinesRef.current.renderOrder = 15;
    imm.scene.add(boundLinesRef.current);

    // ── Function curve ──
    if (compiledFn) {
      const resolution = imm.resolution;
      const points: { x: number; y: number }[] = [];
      for (let i = 0; i <= 600; i++) {
        const x = xMin + (xMax - xMin) * (i / 600);
        const y = f(x);
        if (!isFinite(y) || Math.abs(y) > 1e6) {
          points.push({ x: toX(x), y: NaN });
        } else {
          points.push({ x: toX(x), y: toY(y) });
        }
      }

      if (curveRef.current) {
        updateGlowLine(curveRef.current, points);
      } else {
        const mesh = createGlowLine(points, resolution, {
          color: '#58C4DD',
          width: 3,
          emissive: IMM.bloomEmissive,
        });
        if (mesh) {
          mesh.renderOrder = 20;
          imm.scene.add(mesh);
          curveRef.current = mesh;
        }
      }
    } else if (curveRef.current) {
      imm.scene.remove(curveRef.current);
      curveRef.current.geometry.dispose();
      (curveRef.current.material as THREE.Material).dispose();
      curveRef.current = null;
    }
  }, [compiledFn, a, b, n, method]);

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
