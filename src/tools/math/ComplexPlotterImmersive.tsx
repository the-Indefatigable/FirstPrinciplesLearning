/**
 * ComplexPlotterImmersive.tsx — WebGL2 Immersive Mode renderer for the Complex Number Plotter.
 *
 * Lazy-loaded only when user clicks the Immersive Mode toggle.
 * Renders complex vectors as glowing lines from origin to z1, z2, and result,
 * with glowing dots at endpoints and a unit circle.
 */

import { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import {
  ImmersiveRenderer,
  IMM,
  createBackground, updateBackground,
  createGridLines,
  createAxes,
  createGlowLine, updateGlowLine,
  createGlowDot, positionDot,
} from '../../utils/immersive';
import { getGridStep } from '../../utils/manimCanvas';

interface ComplexNum { re: number; im: number; }

interface Props {
  zA: ComplexNum;
  zB: ComplexNum;
  op: 'add' | 'multiply';
  result: ComplexNum;
}

export default function ComplexPlotterImmersive({ zA, zB, op, result }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<ImmersiveRenderer | null>(null);

  // Scene object refs
  const bgRef = useRef<THREE.Mesh | null>(null);
  const gridRef = useRef<THREE.LineSegments | null>(null);
  const axesRef = useRef<THREE.Group | null>(null);
  const unitCircleRef = useRef<THREE.LineSegments | null>(null);

  // Vector line refs: zA, zB, result, parallelogram dashed lines
  const vecMeshRefs = useRef<Map<string, THREE.Mesh>>(new Map());
  const dotRefs = useRef<Map<string, THREE.Group>>(new Map());

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
      vecMeshRefs.current.clear();
      dotRefs.current.clear();
    };
  }, []);

  const updateScene = useCallback(() => {
    const imm = rendererRef.current;
    if (!imm) return;

    const W = imm.width;
    const H = imm.height;
    const cx = W / 2;
    const cy = H / 2;
    const scale = Math.min(W, H) / 14;
    const step = getGridStep(scale);

    const toX = (re: number) => cx + re * scale;
    const toY = (im: number) => cy - im * scale;

    // Update background
    if (bgRef.current) updateBackground(bgRef.current, W, H);

    // Rebuild grid
    if (gridRef.current) {
      imm.scene.remove(gridRef.current);
      gridRef.current.geometry.dispose();
      (gridRef.current.material as THREE.Material).dispose();
    }
    gridRef.current = createGridLines(W, H, cx, cy, scale, step);
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

    // Unit circle
    if (unitCircleRef.current) {
      imm.scene.remove(unitCircleRef.current);
      unitCircleRef.current.geometry.dispose();
      (unitCircleRef.current.material as THREE.Material).dispose();
    }
    const circlePositions: number[] = [];
    const circleSegments = 64;
    for (let i = 0; i < circleSegments; i++) {
      const a1 = (i / circleSegments) * Math.PI * 2;
      const a2 = ((i + 1) / circleSegments) * Math.PI * 2;
      circlePositions.push(
        toX(Math.cos(a1)), toY(Math.sin(a1)), 0,
        toX(Math.cos(a2)), toY(Math.sin(a2)), 0,
      );
    }
    const circleGeo = new THREE.BufferGeometry();
    circleGeo.setAttribute('position', new THREE.Float32BufferAttribute(circlePositions, 3));
    const circleMat = new THREE.LineBasicMaterial({
      color: IMM.grid,
      transparent: true,
      opacity: 0.15,
      depthTest: false,
    });
    unitCircleRef.current = new THREE.LineSegments(circleGeo, circleMat);
    unitCircleRef.current.renderOrder = -30;
    imm.scene.add(unitCircleRef.current);

    // Helper to draw/update a vector line from origin to complex number
    const resolution = imm.resolution;
    const drawVector = (key: string, z: ComplexNum, color: string, renderOrder: number) => {
      const points = [
        { x: cx, y: cy },
        { x: toX(z.re), y: toY(z.im) },
      ];

      const existing = vecMeshRefs.current.get(key);
      if (existing) {
        updateGlowLine(existing, points);
        const mat = existing.material as THREE.ShaderMaterial;
        mat.uniforms.color.value.set(color);
      } else {
        const mesh = createGlowLine(points, resolution, {
          color,
          width: 3,
          emissive: IMM.bloomEmissive,
        });
        if (mesh) {
          mesh.renderOrder = renderOrder;
          imm.scene.add(mesh);
          vecMeshRefs.current.set(key, mesh);
        }
      }

      // Dot at endpoint
      let dot = dotRefs.current.get(key);
      if (!dot) {
        dot = createGlowDot(color, 5);
        imm.scene.add(dot);
        dotRefs.current.set(key, dot);
      }
      positionDot(dot, toX(z.re), toY(z.im));
      // Update dot color layers
      dot.children.forEach((child, i) => {
        if (child instanceof THREE.Mesh) {
          const mat = child.material as THREE.MeshBasicMaterial;
          if (i < 3) { // glow, mid, core
            mat.color.set(i === 2 ? new THREE.Color(color).multiplyScalar(IMM.bloomEmissive) : color);
          }
        }
      });
    };

    drawVector('zA', zA, IMM.palette[0], 10); // blue
    drawVector('zB', zB, IMM.palette[2], 11); // green
    drawVector('result', result, IMM.palette[1], 12); // yellow

    // Parallelogram dashed lines for addition
    const dashKey = 'dash';
    if (op === 'add') {
      const dashPoints = [
        { x: toX(zA.re), y: toY(zA.im) },
        { x: toX(result.re), y: toY(result.im) },
      ];
      const dashPoints2 = [
        { x: toX(zB.re), y: toY(zB.im) },
        { x: toX(result.re), y: toY(result.im) },
      ];

      // Combine both dashed segments
      const existingDash1 = vecMeshRefs.current.get(dashKey + '1');
      if (existingDash1) {
        updateGlowLine(existingDash1, dashPoints);
      } else {
        const mesh = createGlowLine(dashPoints, resolution, {
          color: IMM.white,
          width: 1.5,
          emissive: 1.0,
          opacity: 0.3,
        });
        if (mesh) {
          mesh.renderOrder = 8;
          imm.scene.add(mesh);
          vecMeshRefs.current.set(dashKey + '1', mesh);
        }
      }

      const existingDash2 = vecMeshRefs.current.get(dashKey + '2');
      if (existingDash2) {
        updateGlowLine(existingDash2, dashPoints2);
      } else {
        const mesh = createGlowLine(dashPoints2, resolution, {
          color: IMM.white,
          width: 1.5,
          emissive: 1.0,
          opacity: 0.3,
        });
        if (mesh) {
          mesh.renderOrder = 8;
          imm.scene.add(mesh);
          vecMeshRefs.current.set(dashKey + '2', mesh);
        }
      }

      // Show dash lines
      vecMeshRefs.current.get(dashKey + '1')!.visible = true;
      vecMeshRefs.current.get(dashKey + '2')!.visible = true;
    } else {
      // Hide dash lines for multiply
      const d1 = vecMeshRefs.current.get(dashKey + '1');
      const d2 = vecMeshRefs.current.get(dashKey + '2');
      if (d1) d1.visible = false;
      if (d2) d2.visible = false;
    }
  }, [zA, zB, op, result]);

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
