/**
 * GraphingCalcImmersive.tsx — WebGL2 Immersive Mode renderer for the Graphing Calculator.
 *
 * Lazy-loaded only when user clicks the Immersive Mode toggle.
 * Uses Three.js + postprocessing for real GPU bloom, anti-aliased lines,
 * vignette, and film grain.
 */

import { useRef, useEffect, useCallback, useMemo } from 'react';
import { compile } from 'mathjs';
import * as THREE from 'three';
import gsap from 'gsap';
import {
  ImmersiveRenderer,
  IMM,
  createBackground, updateBackground,
  createGridLines,
  createAxes,
  createCrosshair, updateCrosshair,
  createGlowLine, updateGlowLine,
  createGlowDot, positionDot,
} from '../../utils/immersive';
import { getGridStep } from '../../utils/manimCanvas';

interface FnEntry { expr: string; color: string; enabled: boolean; }

interface Props {
  functions: FnEntry[];
  scale: number;
  center: { x: number; y: number };
  mousePos: { x: number; y: number } | null;
  onMouseMove: (pos: { x: number; y: number } | null) => void;
  onZoom: (delta: number) => void;
}

export default function GraphingCalcImmersive({
  functions, scale, center, mousePos, onMouseMove, onZoom,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<ImmersiveRenderer | null>(null);

  // Scene object refs
  const bgRef = useRef<THREE.Mesh | null>(null);
  const gridRef = useRef<THREE.LineSegments | null>(null);
  const axesRef = useRef<THREE.Group | null>(null);
  const crosshairRef = useRef<THREE.LineSegments | null>(null);
  const cursorDotRef = useRef<THREE.Group | null>(null);
  const lineMeshesRef = useRef<Map<number, THREE.Mesh>>(new Map());
  const fnDotsRef = useRef<Map<number, THREE.Group>>(new Map());

  // Memoize compiled functions
  const compiledFns = useMemo(() => {
    return functions.map(fn => {
      if (!fn.enabled || !fn.expr.trim()) return null;
      try { return compile(fn.expr); }
      catch { return null; }
    });
  }, [functions]);

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

    crosshairRef.current = createCrosshair(imm.width, imm.height);
    imm.scene.add(crosshairRef.current);

    cursorDotRef.current = createGlowDot(IMM.white, 3);
    imm.scene.add(cursorDotRef.current);

    imm.start();

    return () => {
      imm.dispose();
      rendererRef.current = null;
      lineMeshesRef.current.clear();
      fnDotsRef.current.clear();
    };
  }, []);

  // Update scene every frame
  const updateScene = useCallback(() => {
    const imm = rendererRef.current;
    if (!imm) return;

    const W = imm.width;
    const H = imm.height;
    const cx = W / 2 + center.x * scale;
    const cy = H / 2 - center.y * scale;
    const step = getGridStep(scale);

    // Update background
    if (bgRef.current) updateBackground(bgRef.current, W, H);

    // Rebuild grid + axes each frame (cheap for line segments)
    if (gridRef.current) {
      imm.scene.remove(gridRef.current);
      gridRef.current.geometry.dispose();
      (gridRef.current.material as THREE.Material).dispose();
    }
    gridRef.current = createGridLines(W, H, cx, cy, scale, step);
    imm.scene.add(gridRef.current);

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

    // Update function curves
    const resolution = imm.resolution;
    const existingMeshes = lineMeshesRef.current;
    const activeFnIds = new Set<number>();

    for (let i = 0; i < functions.length; i++) {
      const fn = functions[i];
      const compiled = compiledFns[i];
      if (!compiled || !fn.enabled) continue;

      activeFnIds.add(i);

      // Compute points
      const points: { x: number; y: number }[] = [];
      for (let px = 0; px < W; px += 0.5) {
        const x = (px - cx) / scale;
        try {
          const y = compiled.evaluate({ x, e: Math.E, pi: Math.PI });
          if (typeof y !== 'number' || !isFinite(y)) {
            points.push({ x: px, y: NaN });
          } else {
            points.push({ x: px, y: cy - y * scale });
          }
        } catch { points.push({ x: px, y: NaN }); }
      }

      const existingMesh = existingMeshes.get(i);
      if (existingMesh) {
        updateGlowLine(existingMesh, points);
        // Update color if changed
        const mat = existingMesh.material as THREE.ShaderMaterial;
        mat.uniforms.color.value.set(fn.color);
      } else {
        const mesh = createGlowLine(points, resolution, {
          color: fn.color,
          width: 3,
          emissive: IMM.bloomEmissive,
        });
        if (mesh) {
          mesh.renderOrder = 10 + i;
          imm.scene.add(mesh);
          existingMeshes.set(i, mesh);
        }
      }
    }

    // Remove old meshes for disabled/removed functions
    for (const [id, mesh] of existingMeshes) {
      if (!activeFnIds.has(id)) {
        imm.scene.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
        existingMeshes.delete(id);
      }
    }

    // Crosshair + cursor dot
    if (mousePos && crosshairRef.current && cursorDotRef.current) {
      updateCrosshair(crosshairRef.current, mousePos.x, mousePos.y, W, H);
      positionDot(cursorDotRef.current, mousePos.x, mousePos.y);

      // Function intersection dots
      const existingDots = fnDotsRef.current;
      const activeDotIds = new Set<number>();

      for (let i = 0; i < functions.length; i++) {
        const fn = functions[i];
        const compiled = compiledFns[i];
        if (!compiled || !fn.enabled) continue;

        try {
          const mx = (mousePos.x - cx) / scale;
          const val = compiled.evaluate({ x: mx, e: Math.E, pi: Math.PI });
          if (typeof val === 'number' && isFinite(val)) {
            activeDotIds.add(i);
            const py = cy - val * scale;
            let dot = existingDots.get(i);
            if (!dot) {
              dot = createGlowDot(fn.color, 4);
              imm.scene.add(dot);
              existingDots.set(i, dot);
            }
            positionDot(dot, mousePos.x, py);
          }
        } catch { /* skip */ }
      }

      for (const [id, dot] of existingDots) {
        if (!activeDotIds.has(id)) {
          dot.visible = false;
        }
      }
    } else {
      if (crosshairRef.current) crosshairRef.current.visible = false;
      if (cursorDotRef.current) cursorDotRef.current.visible = false;
      for (const dot of fnDotsRef.current.values()) dot.visible = false;
    }
  }, [functions, compiledFns, scale, center, mousePos]);

  // Wire up the render callback
  useEffect(() => {
    rendererRef.current?.onBeforeRender(updateScene);
  }, [updateScene]);

  // Event handlers
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    onMouseMove({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, [onMouseMove]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    onZoom(e.deltaY);
  }, [onZoom]);

  return (
    <div
      ref={containerRef}
      className="immersive-canvas-container"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => onMouseMove(null)}
      onWheel={handleWheel}
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
