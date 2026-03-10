/**
 * SlopeFieldImmersive.tsx — WebGL2 Immersive Mode renderer for the Slope Field Visualizer.
 *
 * Lazy-loaded only when user clicks the Immersive Mode toggle.
 * Renders slope segments as LineSegments and particle traces as glowing lines.
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

interface Particle {
  x: number;
  y: number;
  path: { x: number; y: number }[];
  color: string;
}

interface Props {
  equation: string;
  bounds: number;
  density: number;
  particles: Particle[];
}

export default function SlopeFieldImmersive({
  equation, bounds, density, particles,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<ImmersiveRenderer | null>(null);

  // Scene object refs
  const bgRef = useRef<THREE.Mesh | null>(null);
  const gridRef = useRef<THREE.LineSegments | null>(null);
  const axesRef = useRef<THREE.Group | null>(null);
  const slopeFieldRef = useRef<THREE.LineSegments | null>(null);
  const traceMeshesRef = useRef<Map<number, THREE.Mesh>>(new Map());
  const traceDotsRef = useRef<Map<number, THREE.Group>>(new Map());

  // Compile equation
  const compiledEq = useMemo(() => {
    try { return compile(equation); }
    catch { return null; }
  }, [equation]);

  // Initialize renderer
  useEffect(() => {
    if (!containerRef.current) return;

    const imm = new ImmersiveRenderer({ container: containerRef.current });
    rendererRef.current = imm;

    imm.canvas.style.opacity = '0';
    gsap.to(imm.canvas, { opacity: 1, duration: 0.6, ease: 'power2.out' });

    bgRef.current = createBackground(imm.width, imm.height);
    imm.scene.add(bgRef.current);

    imm.start();

    return () => {
      imm.dispose();
      rendererRef.current = null;
      traceMeshesRef.current.clear();
      traceDotsRef.current.clear();
    };
  }, []);

  const updateScene = useCallback(() => {
    const imm = rendererRef.current;
    if (!imm) return;

    const W = imm.width;
    const H = imm.height;

    const toScreenX = (x: number) => (x + bounds) / (2 * bounds) * W;
    const toScreenY = (y: number) => H - (y + bounds) / (2 * bounds) * H;

    // Update background
    if (bgRef.current) updateBackground(bgRef.current, W, H);

    // Rebuild grid
    if (gridRef.current) {
      imm.scene.remove(gridRef.current);
      gridRef.current.geometry.dispose();
      (gridRef.current.material as THREE.Material).dispose();
    }
    // Custom grid for the bounds-based coordinate system
    const gridPositions: number[] = [];
    const gridStep = bounds <= 5 ? 1 : bounds <= 20 ? 2 : 5;
    for (let i = -bounds; i <= bounds; i += gridStep) {
      if (i === 0) continue;
      const sx = toScreenX(i);
      const sy = toScreenY(i);
      gridPositions.push(sx, 0, 0, sx, H, 0);
      gridPositions.push(0, sy, 0, W, sy, 0);
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
    const ox = toScreenX(0);
    const oy = toScreenY(0);
    axesRef.current = createAxes(W, H, ox, oy);
    imm.scene.add(axesRef.current);

    // Slope field segments
    if (slopeFieldRef.current) {
      imm.scene.remove(slopeFieldRef.current);
      slopeFieldRef.current.geometry.dispose();
      (slopeFieldRef.current.material as THREE.Material).dispose();
      slopeFieldRef.current = null;
    }

    if (compiledEq) {
      const slopePositions: number[] = [];
      const slopeColors: number[] = [];
      const step = (2 * bounds) / density;
      const arrowLenScreen = (W / density) * 0.6;
      const cyanColor = new THREE.Color(IMM.palette[0]);

      for (let x = -bounds; x <= bounds; x += step) {
        for (let y = -bounds; y <= bounds; y += step) {
          try {
            const slope = compiledEq.evaluate({ x, y, e: Math.E, pi: Math.PI });
            if (typeof slope !== 'number' || !isFinite(slope)) continue;

            const mag = Math.sqrt(1 + slope * slope);
            const dx = 1 / mag;
            const dy = slope / mag;

            const sx = toScreenX(x);
            const sy = toScreenY(y);

            const p1x = sx - dx * (arrowLenScreen / 2);
            const p1y = sy + dy * (arrowLenScreen / 2); // invert Y
            const p2x = sx + dx * (arrowLenScreen / 2);
            const p2y = sy - dy * (arrowLenScreen / 2); // invert Y

            slopePositions.push(p1x, p1y, 0, p2x, p2y, 0);

            // Color with emissive boost for bloom
            const emR = cyanColor.r * IMM.bloomEmissive * 0.5;
            const emG = cyanColor.g * IMM.bloomEmissive * 0.5;
            const emB = cyanColor.b * IMM.bloomEmissive * 0.5;
            slopeColors.push(emR, emG, emB, emR, emG, emB);
          } catch {
            // ignore math errors
          }
        }
      }

      if (slopePositions.length > 0) {
        const slopeGeo = new THREE.BufferGeometry();
        slopeGeo.setAttribute('position', new THREE.Float32BufferAttribute(slopePositions, 3));
        slopeGeo.setAttribute('color', new THREE.Float32BufferAttribute(slopeColors, 3));
        const slopeMat = new THREE.LineBasicMaterial({
          vertexColors: true,
          transparent: true,
          opacity: 0.9,
          depthTest: false,
          blending: THREE.AdditiveBlending,
        });
        slopeFieldRef.current = new THREE.LineSegments(slopeGeo, slopeMat);
        slopeFieldRef.current.renderOrder = 5;
        imm.scene.add(slopeFieldRef.current);
      }
    }

    // Particle traces as glow lines
    const resolution = imm.resolution;
    const activeTraceIds = new Set<number>();

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (p.path.length < 2) continue;

      activeTraceIds.add(i);

      const tracePoints = p.path.map(pt => ({
        x: toScreenX(pt.x),
        y: toScreenY(pt.y),
      }));

      const existingMesh = traceMeshesRef.current.get(i);
      if (existingMesh) {
        updateGlowLine(existingMesh, tracePoints);
        const mat = existingMesh.material as THREE.ShaderMaterial;
        mat.uniforms.color.value.set(p.color);
      } else {
        const mesh = createGlowLine(tracePoints, resolution, {
          color: p.color,
          width: 2.5,
          emissive: IMM.bloomEmissive,
        });
        if (mesh) {
          mesh.renderOrder = 15 + i;
          imm.scene.add(mesh);
          traceMeshesRef.current.set(i, mesh);
        }
      }

      // Dot at particle origin
      let dot = traceDotsRef.current.get(i);
      if (!dot) {
        dot = createGlowDot(p.color, 4);
        imm.scene.add(dot);
        traceDotsRef.current.set(i, dot);
      }
      positionDot(dot, toScreenX(p.x), toScreenY(p.y));
    }

    // Remove old traces no longer in particles array
    for (const [id, mesh] of traceMeshesRef.current) {
      if (!activeTraceIds.has(id)) {
        imm.scene.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
        traceMeshesRef.current.delete(id);
      }
    }
    for (const [id, dot] of traceDotsRef.current) {
      if (!activeTraceIds.has(id)) {
        imm.scene.remove(dot);
        dot.traverse(o => {
          if (o instanceof THREE.Mesh) {
            o.geometry.dispose();
            (o.material as THREE.Material).dispose();
          }
        });
        traceDotsRef.current.delete(id);
      }
    }
  }, [equation, compiledEq, bounds, density, particles]);

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
        aspectRatio: '16/9',
        position: 'relative',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
      }}
    />
  );
}
