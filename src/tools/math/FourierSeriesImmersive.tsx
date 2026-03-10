/**
 * FourierSeriesImmersive.tsx — WebGL2 Immersive Mode renderer for Fourier Series.
 *
 * Lazy-loaded only when user clicks the Immersive Mode toggle.
 * Renders epicycles + waveform with GPU bloom. Animation runs via onBeforeRender.
 */

import { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import {
  ImmersiveRenderer,
  IMM,
  createBackground, updateBackground,
  createGlowLine, updateGlowLine,
  createGlowDot, positionDot,
} from '../../utils/immersive';

type WaveType = 'square' | 'sawtooth' | 'triangle' | 'custom';

function coefficient(kind: WaveType, n: number): number {
  if (kind === 'square') {
    return n % 2 === 0 ? 0 : 4 / (n * Math.PI);
  }
  if (kind === 'sawtooth') {
    return 2 * Math.pow(-1, n + 1) / (n * Math.PI);
  }
  if (kind === 'triangle') {
    if (n % 2 === 0) return 0;
    return 8 * Math.pow(-1, (n - 1) / 2) / (n * n * Math.PI * Math.PI);
  }
  return 0;
}

interface Props {
  wave: WaveType;
  terms: number;
  showTarget: boolean;
  showHarmonics: boolean;
  playing: boolean;
}

export default function FourierSeriesImmersive({
  wave, terms, showTarget, showHarmonics, playing,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<ImmersiveRenderer | null>(null);

  // Scene object refs
  const bgRef = useRef<THREE.Mesh | null>(null);
  const approxLineRef = useRef<THREE.Mesh | null>(null);
  const targetLineRef = useRef<THREE.Mesh | null>(null);
  const harmonicLinesRef = useRef<Map<number, THREE.Mesh>>(new Map());
  const epicycleArmsRef = useRef<THREE.LineSegments | null>(null);
  const epicycleCirclesRef = useRef<THREE.LineSegments | null>(null);
  const connectLineRef = useRef<THREE.LineSegments | null>(null);
  const epicycleDotsRef = useRef<Map<number, THREE.Group>>(new Map());
  const waveStartDotRef = useRef<THREE.Group | null>(null);
  const gridLinesRef = useRef<THREE.LineSegments | null>(null);
  const axisLineRef = useRef<THREE.LineSegments | null>(null);

  // Animation phase
  const tRef = useRef(0);

  // Initialize renderer
  useEffect(() => {
    if (!containerRef.current) return;

    const imm = new ImmersiveRenderer({ container: containerRef.current });
    rendererRef.current = imm;

    // Fade in
    imm.canvas.style.opacity = '0';
    gsap.to(imm.canvas, { opacity: 1, duration: 0.6, ease: 'power2.out' });

    // Background
    bgRef.current = createBackground(imm.width, imm.height);
    imm.scene.add(bgRef.current);

    // Wave start dot
    waveStartDotRef.current = createGlowDot('#58C4DD', 4);
    imm.scene.add(waveStartDotRef.current);

    imm.start();

    return () => {
      imm.dispose();
      rendererRef.current = null;
      harmonicLinesRef.current.clear();
      epicycleDotsRef.current.clear();
      approxLineRef.current = null;
      targetLineRef.current = null;
    };
  }, []);

  // Update scene every frame
  const updateScene = useCallback(() => {
    const imm = rendererRef.current;
    if (!imm) return;

    // Advance animation
    if (playing) tRef.current += 0.025;
    const t = tRef.current;

    const W = imm.width;
    const H = imm.height;
    const resolution = imm.resolution;

    // Layout matching 2D version
    const circleR = Math.min(H * 0.35, 100);
    const cx = circleR + 40;
    const cy = H / 2;
    const graphLeft = cx + circleR + 60;
    const graphRight = W - 20;
    const graphW = graphRight - graphLeft;

    // Background
    if (bgRef.current) updateBackground(bgRef.current, W, H);

    // Grid lines for the graph area
    if (gridLinesRef.current) {
      imm.scene.remove(gridLinesRef.current);
      gridLinesRef.current.geometry.dispose();
      (gridLinesRef.current.material as THREE.Material).dispose();
    }
    {
      const positions: number[] = [];
      for (let x = graphLeft; x <= graphRight; x += 40) {
        positions.push(x, 20, 0, x, H - 20, 0);
      }
      // Horizontal center line
      positions.push(graphLeft, cy, 0, graphRight, cy, 0);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      const mat = new THREE.LineBasicMaterial({
        color: IMM.grid,
        transparent: true,
        opacity: IMM.gridAlpha,
        depthTest: false,
      });
      gridLinesRef.current = new THREE.LineSegments(geo, mat);
      gridLinesRef.current.renderOrder = -50;
      imm.scene.add(gridLinesRef.current);
    }

    // Axis line at graph center
    if (axisLineRef.current) {
      imm.scene.remove(axisLineRef.current);
      axisLineRef.current.geometry.dispose();
      (axisLineRef.current.material as THREE.Material).dispose();
    }
    {
      const positions = [graphLeft, cy, 0, graphRight, cy, 0];
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      const mat = new THREE.LineBasicMaterial({
        color: IMM.axis,
        transparent: true,
        opacity: IMM.axisAlpha,
        depthTest: false,
      });
      axisLineRef.current = new THREE.LineSegments(geo, mat);
      axisLineRef.current.renderOrder = -40;
      imm.scene.add(axisLineRef.current);
    }

    // Target waveform
    if (showTarget) {
      const targetPoints: { x: number; y: number }[] = [];
      for (let px = 0; px <= graphW; px++) {
        const phase = (px / graphW) * 4 * Math.PI + t;
        let val = 0;
        for (let n = 1; n <= 200; n++) {
          val += coefficient(wave, n) * Math.sin(n * phase);
        }
        targetPoints.push({ x: graphLeft + px, y: cy - val * circleR });
      }

      if (targetLineRef.current) {
        updateGlowLine(targetLineRef.current, targetPoints);
      } else {
        const mesh = createGlowLine(targetPoints, resolution, {
          color: '#F4D03F',
          width: 2,
          emissive: 1.5,
          opacity: 0.6,
        });
        if (mesh) {
          mesh.renderOrder = 5;
          imm.scene.add(mesh);
          targetLineRef.current = mesh;
        }
      }
      if (targetLineRef.current) targetLineRef.current.visible = true;
    } else {
      if (targetLineRef.current) targetLineRef.current.visible = false;
    }

    // Individual harmonics
    const activeHarmonicIds = new Set<number>();
    if (showHarmonics) {
      for (let n = 1; n <= terms; n++) {
        const bn = coefficient(wave, n);
        if (Math.abs(bn) < 1e-10) continue;
        activeHarmonicIds.add(n);

        const hPoints: { x: number; y: number }[] = [];
        for (let px = 0; px <= graphW; px++) {
          const phase = (px / graphW) * 4 * Math.PI + t;
          const val = bn * Math.sin(n * phase);
          hPoints.push({ x: graphLeft + px, y: cy - val * circleR });
        }

        const color = IMM.palette[(n - 1) % IMM.palette.length];
        const existing = harmonicLinesRef.current.get(n);
        if (existing) {
          updateGlowLine(existing, hPoints);
          const mat = existing.material as THREE.ShaderMaterial;
          mat.uniforms.color.value.set(color);
          existing.visible = true;
        } else {
          const mesh = createGlowLine(hPoints, resolution, {
            color,
            width: 2,
            emissive: 0.8,
            opacity: 0.3,
          });
          if (mesh) {
            mesh.renderOrder = 8;
            imm.scene.add(mesh);
            harmonicLinesRef.current.set(n, mesh);
          }
        }
      }
    }

    // Hide/remove unused harmonic lines
    for (const [id, mesh] of harmonicLinesRef.current) {
      if (!activeHarmonicIds.has(id)) {
        mesh.visible = false;
      }
    }

    // Approximation (partial sum) curve
    {
      const approxPoints: { x: number; y: number }[] = [];
      for (let px = 0; px <= graphW; px++) {
        const phase = (px / graphW) * 4 * Math.PI + t;
        let val = 0;
        for (let n = 1; n <= terms; n++) {
          val += coefficient(wave, n) * Math.sin(n * phase);
        }
        approxPoints.push({ x: graphLeft + px, y: cy - val * circleR });
      }

      if (approxLineRef.current) {
        updateGlowLine(approxLineRef.current, approxPoints);
      } else {
        const mesh = createGlowLine(approxPoints, resolution, {
          color: '#58C4DD',
          width: 3,
          emissive: IMM.bloomEmissive,
        });
        if (mesh) {
          mesh.renderOrder = 10;
          imm.scene.add(mesh);
          approxLineRef.current = mesh;
        }
      }
    }

    // Epicycle circles + arms
    // Remove previous epicycle geometry
    if (epicycleCirclesRef.current) {
      imm.scene.remove(epicycleCirclesRef.current);
      epicycleCirclesRef.current.geometry.dispose();
      (epicycleCirclesRef.current.material as THREE.Material).dispose();
    }
    if (epicycleArmsRef.current) {
      imm.scene.remove(epicycleArmsRef.current);
      epicycleArmsRef.current.geometry.dispose();
      (epicycleArmsRef.current.material as THREE.Material).dispose();
    }

    {
      const circlePositions: number[] = [];
      const armPositions: number[] = [];
      let ex = cx;
      let ey = cy;
      const activeDotIds = new Set<number>();

      for (let n = 1; n <= terms; n++) {
        const bn = coefficient(wave, n);
        if (Math.abs(bn) < 1e-10) continue;
        const radius = Math.abs(bn) * circleR;

        // Circle outline (approximated with line segments)
        const segments = 48;
        for (let s = 0; s < segments; s++) {
          const a1 = (s / segments) * Math.PI * 2;
          const a2 = ((s + 1) / segments) * Math.PI * 2;
          circlePositions.push(
            ex + radius * Math.cos(a1), ey + radius * Math.sin(a1), 0,
            ex + radius * Math.cos(a2), ey + radius * Math.sin(a2), 0,
          );
        }

        // Rotating arm
        const angle = n * t;
        const nx = ex + radius * Math.cos(angle - Math.PI / 2);
        const ny = ey - radius * Math.sin(angle - Math.PI / 2);

        armPositions.push(ex, ey, 0, nx, ny, 0);

        // Dot at tip
        activeDotIds.add(n);
        let dot = epicycleDotsRef.current.get(n);
        if (!dot) {
          const color = IMM.palette[(n - 1) % IMM.palette.length];
          dot = createGlowDot(color, 2.5);
          imm.scene.add(dot);
          epicycleDotsRef.current.set(n, dot);
        }
        positionDot(dot, nx, ny);

        ex = nx;
        ey = ny;
      }

      // Hide unused dots
      for (const [id, dot] of epicycleDotsRef.current) {
        if (!activeDotIds.has(id)) {
          dot.visible = false;
        }
      }

      // Create circle outlines
      if (circlePositions.length > 0) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(circlePositions, 3));
        const mat = new THREE.LineBasicMaterial({
          color: new THREE.Color(IMM.white),
          transparent: true,
          opacity: 0.15,
          depthTest: false,
        });
        epicycleCirclesRef.current = new THREE.LineSegments(geo, mat);
        epicycleCirclesRef.current.renderOrder = 15;
        imm.scene.add(epicycleCirclesRef.current);
      }

      // Create arm lines
      if (armPositions.length > 0) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(armPositions, 3));
        const mat = new THREE.LineBasicMaterial({
          color: new THREE.Color('#58C4DD'),
          transparent: true,
          opacity: 0.7,
          depthTest: false,
        });
        epicycleArmsRef.current = new THREE.LineSegments(geo, mat);
        epicycleArmsRef.current.renderOrder = 16;
        imm.scene.add(epicycleArmsRef.current);
      }

      // Connecting dashed line from epicycle tip to waveform start
      if (connectLineRef.current) {
        imm.scene.remove(connectLineRef.current);
        connectLineRef.current.geometry.dispose();
        (connectLineRef.current.material as THREE.Material).dispose();
      }
      {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute([
          ex, ey, 0, graphLeft, ey, 0,
        ], 3));
        const mat = new THREE.LineDashedMaterial({
          color: 0x58C4DD,
          transparent: true,
          opacity: 0.5,
          dashSize: 3,
          gapSize: 3,
          depthTest: false,
        });
        connectLineRef.current = new THREE.LineSegments(geo, mat);
        connectLineRef.current.computeLineDistances();
        connectLineRef.current.renderOrder = 17;
        imm.scene.add(connectLineRef.current);
      }

      // Dot on waveform at start
      if (waveStartDotRef.current) {
        positionDot(waveStartDotRef.current, graphLeft, ey);
      }
    }
  }, [wave, terms, showTarget, showHarmonics, playing]);

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
