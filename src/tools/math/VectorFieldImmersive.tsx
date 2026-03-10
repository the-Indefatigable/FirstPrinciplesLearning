/**
 * VectorFieldImmersive.tsx — WebGL2 Immersive Mode renderer for the Vector Field Visualizer.
 *
 * Lazy-loaded only when user clicks the Immersive Mode toggle.
 * Renders arrow field using THREE.LineSegments with vertex colors by magnitude,
 * and animated particles when enabled.
 */

import { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import {
  ImmersiveRenderer,
  IMM,
  createBackground, updateBackground,
  createAxes,
} from '../../utils/immersive';

interface Props {
  pExpr: string;
  qExpr: string;
  showArrows: boolean;
  showParticles: boolean;
  density: number;
}

const RANGE = 4;

const evalExpr = (expr: string, x: number, y: number): number => {
  try {
    const fn = new Function('x', 'y',
      'const sin=Math.sin,cos=Math.cos,tan=Math.tan,exp=Math.exp,log=Math.log,abs=Math.abs,sqrt=Math.sqrt,PI=Math.PI,pow=Math.pow;' +
      `return (${expr});`
    );
    const val = fn(x, y);
    return isFinite(val) ? val : 0;
  } catch { return 0; }
};

interface FlowParticle {
  x: number;
  y: number;
  age: number;
}

export default function VectorFieldImmersive({
  pExpr, qExpr, showArrows, showParticles, density,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<ImmersiveRenderer | null>(null);

  // Scene object refs
  const bgRef = useRef<THREE.Mesh | null>(null);
  const gridRef = useRef<THREE.LineSegments | null>(null);
  const axesRef = useRef<THREE.Group | null>(null);
  const arrowsRef = useRef<THREE.LineSegments | null>(null);
  const particleMeshRef = useRef<THREE.Points | null>(null);
  const particlesDataRef = useRef<FlowParticle[]>([]);

  const MAX_PARTICLES = 300;
  const MAX_AGE = 80;

  // Initialize renderer
  useEffect(() => {
    if (!containerRef.current) return;

    const imm = new ImmersiveRenderer({ container: containerRef.current });
    rendererRef.current = imm;

    imm.canvas.style.opacity = '0';
    gsap.to(imm.canvas, { opacity: 1, duration: 0.6, ease: 'power2.out' });

    bgRef.current = createBackground(imm.width, imm.height);
    imm.scene.add(bgRef.current);

    // Create particle mesh (Points)
    const particleGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(MAX_PARTICLES * 3);
    const colors = new Float32Array(MAX_PARTICLES * 3);
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const particleMat = new THREE.PointsMaterial({
      size: 3,
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    particleMeshRef.current = new THREE.Points(particleGeo, particleMat);
    particleMeshRef.current.renderOrder = 30;
    imm.scene.add(particleMeshRef.current);

    imm.start();

    return () => {
      imm.dispose();
      rendererRef.current = null;
      particlesDataRef.current = [];
    };
  }, []);

  const updateScene = useCallback(() => {
    const imm = rendererRef.current;
    if (!imm) return;

    const W = imm.width;
    const H = imm.height;
    const toScreenX = (vx: number) => (vx + RANGE) / (2 * RANGE) * W;
    const toScreenY = (vy: number) => (RANGE - vy) / (2 * RANGE) * H;

    // Update background
    if (bgRef.current) updateBackground(bgRef.current, W, H);

    // Rebuild grid: use integer steps in world coords
    if (gridRef.current) {
      imm.scene.remove(gridRef.current);
      gridRef.current.geometry.dispose();
      (gridRef.current.material as THREE.Material).dispose();
    }
    // Custom grid for the fixed-range coordinate system
    const gridPositions: number[] = [];
    for (let i = -RANGE; i <= RANGE; i++) {
      if (i === 0) continue;
      const sx = toScreenX(i);
      gridPositions.push(sx, 0, 0, sx, H, 0);
      const sy = toScreenY(i);
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

    // Arrow field using LineSegments with vertex colors
    if (arrowsRef.current) {
      imm.scene.remove(arrowsRef.current);
      arrowsRef.current.geometry.dispose();
      (arrowsRef.current.material as THREE.Material).dispose();
      arrowsRef.current = null;
    }

    if (showArrows) {
      const arrowPositions: number[] = [];
      const arrowColors: number[] = [];
      const step = W / density;
      const cyanColor = new THREE.Color(IMM.palette[0]); // blue/cyan

      for (let sx = step / 2; sx < W; sx += step) {
        for (let sy = step / 2; sy < H; sy += step) {
          const wx = (sx / W) * 2 * RANGE - RANGE;
          const wy = RANGE - (sy / H) * 2 * RANGE;
          const p = evalExpr(pExpr, wx, wy);
          const q = evalExpr(qExpr, wx, wy);
          const m = Math.sqrt(p * p + q * q);
          if (m < 0.001) continue;

          const maxLen = step * 0.42;
          const s = Math.min(maxLen / m, maxLen);
          const dx = p * s;
          const dy = -q * s; // flip y

          const strength = Math.min(m * 0.5, 1);
          // Intensity-based color: brighter for stronger vectors
          const r = cyanColor.r * (0.3 + strength * 0.7) * IMM.bloomEmissive;
          const g = cyanColor.g * (0.3 + strength * 0.7) * IMM.bloomEmissive;
          const b = cyanColor.b * (0.3 + strength * 0.7) * IMM.bloomEmissive;

          // Main line
          const x1 = sx - dx * 0.5;
          const y1 = sy - dy * 0.5;
          const x2 = sx + dx * 0.5;
          const y2 = sy + dy * 0.5;
          arrowPositions.push(x1, y1, 0, x2, y2, 0);
          arrowColors.push(r, g, b, r, g, b);

          // Arrowhead lines
          const angle = Math.atan2(dy, dx);
          const headLen = 3 + strength * 2;
          const hx1 = x2 - headLen * Math.cos(angle - 0.45);
          const hy1 = y2 - headLen * Math.sin(angle - 0.45);
          const hx2 = x2 - headLen * Math.cos(angle + 0.45);
          const hy2 = y2 - headLen * Math.sin(angle + 0.45);
          arrowPositions.push(x2, y2, 0, hx1, hy1, 0);
          arrowColors.push(r, g, b, r, g, b);
          arrowPositions.push(x2, y2, 0, hx2, hy2, 0);
          arrowColors.push(r, g, b, r, g, b);
        }
      }

      if (arrowPositions.length > 0) {
        const arrowGeo = new THREE.BufferGeometry();
        arrowGeo.setAttribute('position', new THREE.Float32BufferAttribute(arrowPositions, 3));
        arrowGeo.setAttribute('color', new THREE.Float32BufferAttribute(arrowColors, 3));
        const arrowMat = new THREE.LineBasicMaterial({
          vertexColors: true,
          transparent: true,
          opacity: 0.9,
          depthTest: false,
          blending: THREE.AdditiveBlending,
        });
        arrowsRef.current = new THREE.LineSegments(arrowGeo, arrowMat);
        arrowsRef.current.renderOrder = 10;
        imm.scene.add(arrowsRef.current);
      }
    }

    // Flow particles
    const particleMesh = particleMeshRef.current;
    if (particleMesh) {
      if (showParticles) {
        particleMesh.visible = true;
        const particles = particlesDataRef.current;

        // Spawn new particles
        while (particles.length < MAX_PARTICLES) {
          particles.push({
            x: Math.random() * W,
            y: Math.random() * H,
            age: Math.floor(Math.random() * MAX_AGE),
          });
        }

        const posArr = particleMesh.geometry.attributes.position.array as Float32Array;
        const colArr = particleMesh.geometry.attributes.color.array as Float32Array;
        const cyanC = new THREE.Color(IMM.palette[0]);

        for (let i = 0; i < particles.length; i++) {
          const pt = particles[i];
          const wx = (pt.x / W) * 2 * RANGE - RANGE;
          const wy = RANGE - (pt.y / H) * 2 * RANGE;
          const p = evalExpr(pExpr, wx, wy);
          const q = evalExpr(qExpr, wx, wy);

          pt.x += p * 0.8;
          pt.y -= q * 0.8;
          pt.age++;

          if (pt.age > MAX_AGE || pt.x < -10 || pt.x > W + 10 || pt.y < -10 || pt.y > H + 10) {
            pt.x = Math.random() * W;
            pt.y = Math.random() * H;
            pt.age = 0;
          }

          const alpha = Math.min(pt.age / 10, 1) * Math.max(1 - pt.age / MAX_AGE, 0);
          posArr[i * 3] = pt.x;
          posArr[i * 3 + 1] = pt.y;
          posArr[i * 3 + 2] = 0;
          colArr[i * 3] = cyanC.r * alpha * IMM.bloomEmissive;
          colArr[i * 3 + 1] = cyanC.g * alpha * IMM.bloomEmissive;
          colArr[i * 3 + 2] = cyanC.b * alpha * IMM.bloomEmissive;
        }

        particleMesh.geometry.attributes.position.needsUpdate = true;
        particleMesh.geometry.attributes.color.needsUpdate = true;
        particleMesh.geometry.setDrawRange(0, particles.length);
      } else {
        particleMesh.visible = false;
        particlesDataRef.current = [];
      }
    }
  }, [pExpr, qExpr, showArrows, showParticles, density]);

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
