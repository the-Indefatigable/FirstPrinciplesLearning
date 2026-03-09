/**
 * sceneObjects.ts — Reusable scene elements: background, grid, axes for Immersive Mode.
 */

import * as THREE from 'three';
import { IMM } from './palette';

// ── Background Plane with radial gradient ──────────────────────────

const bgVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const bgFragmentShader = /* glsl */ `
  uniform vec3 colorCenter;
  uniform vec3 colorEdge;
  uniform vec2 resolution;

  varying vec2 vUv;

  void main() {
    vec2 center = vec2(0.5);
    float dist = length(vUv - center) * 1.4;
    vec3 color = mix(colorCenter, colorEdge, smoothstep(0.0, 1.0, dist));
    gl_FragColor = vec4(color, 1.0);
  }
`;

export function createBackground(w: number, h: number): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(w, h);
  const mat = new THREE.ShaderMaterial({
    vertexShader: bgVertexShader,
    fragmentShader: bgFragmentShader,
    uniforms: {
      colorCenter: { value: IMM.bgGradientCenter },
      colorEdge: { value: IMM.bg },
      resolution: { value: new THREE.Vector2(w, h) },
    },
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(w / 2, h / 2, -1);
  mesh.renderOrder = -100;
  return mesh;
}

export function updateBackground(mesh: THREE.Mesh, w: number, h: number) {
  const oldGeo = mesh.geometry;
  mesh.geometry = new THREE.PlaneGeometry(w, h);
  oldGeo.dispose();
  mesh.position.set(w / 2, h / 2, -1);
  const mat = mesh.material as THREE.ShaderMaterial;
  mat.uniforms.resolution.value.set(w, h);
}

// ── Grid Lines ─────────────────────────────────────────────────────

export function createGridLines(
  w: number, h: number,
  cx: number, cy: number,
  scale: number, step: number,
): THREE.LineSegments {
  const positions: number[] = [];

  const startX = Math.floor((-cx / scale) / step) * step;
  const endX = Math.ceil(((w - cx) / scale) / step) * step;
  const startY = Math.floor((-(h - cy) / scale) / step) * step;
  const endY = Math.ceil((cy / scale) / step) * step;

  for (let x = startX; x <= endX; x += step) {
    if (Math.abs(x) < 0.001) continue;
    const px = cx + x * scale;
    positions.push(px, 0, 0, px, h, 0);
  }
  for (let y = startY; y <= endY; y += step) {
    if (Math.abs(y) < 0.001) continue;
    const py = cy - y * scale;
    positions.push(0, py, 0, w, py, 0);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

  const mat = new THREE.LineBasicMaterial({
    color: IMM.grid,
    transparent: true,
    opacity: IMM.gridAlpha,
    depthTest: false,
  });

  const lines = new THREE.LineSegments(geo, mat);
  lines.renderOrder = -50;
  return lines;
}

// ── Axis Lines (with subtle glow) ──────────────────────────────────

export function createAxes(
  w: number, h: number,
  cx: number, cy: number,
): THREE.Group {
  const group = new THREE.Group();
  group.renderOrder = -40;

  // Glow layer
  const glowPositions = [
    0, cy, 0, w, cy, 0,
    cx, 0, 0, cx, h, 0,
  ];
  const glowGeo = new THREE.BufferGeometry();
  glowGeo.setAttribute('position', new THREE.Float32BufferAttribute(glowPositions, 3));
  const glowMat = new THREE.LineBasicMaterial({
    color: IMM.axis,
    transparent: true,
    opacity: 0.08,
    linewidth: 3,
    depthTest: false,
  });
  group.add(new THREE.LineSegments(glowGeo, glowMat));

  // Core axis
  const coreGeo = new THREE.BufferGeometry();
  coreGeo.setAttribute('position', new THREE.Float32BufferAttribute(glowPositions, 3));
  const coreMat = new THREE.LineBasicMaterial({
    color: IMM.axis,
    transparent: true,
    opacity: IMM.axisAlpha,
    depthTest: false,
  });
  group.add(new THREE.LineSegments(coreGeo, coreMat));

  return group;
}

// ── Crosshair ──────────────────────────────────────────────────────

export function createCrosshair(w: number, h: number): THREE.LineSegments {
  const positions = new Float32Array([
    0, 0, 0, w, 0, 0,  // horizontal
    0, 0, 0, 0, h, 0,  // vertical
  ]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.LineDashedMaterial({
    color: 0xc8d2e1,
    transparent: true,
    opacity: 0.15,
    dashSize: 4,
    gapSize: 4,
    depthTest: false,
  });

  const lines = new THREE.LineSegments(geo, mat);
  lines.computeLineDistances();
  lines.visible = false;
  lines.renderOrder = 50;
  return lines;
}

export function updateCrosshair(lines: THREE.LineSegments, x: number, y: number, w: number, h: number) {
  const arr = lines.geometry.attributes.position.array as Float32Array;
  // horizontal line
  arr[0] = 0; arr[1] = y; arr[2] = 0;
  arr[3] = w; arr[4] = y; arr[5] = 0;
  // vertical line
  arr[6] = x; arr[7] = 0; arr[8] = 0;
  arr[9] = x; arr[10] = h; arr[11] = 0;
  lines.geometry.attributes.position.needsUpdate = true;
  lines.computeLineDistances();
  lines.visible = true;
}

// ── Glowing Dot (for cursor intersection) ──────────────────────────

export function createGlowDot(color: string, radius = 5): THREE.Group {
  const group = new THREE.Group();
  group.renderOrder = 60;

  // Outer glow
  const glowGeo = new THREE.CircleGeometry(radius * 3, 32);
  const glowMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(color),
    transparent: true,
    opacity: 0.15,
    depthTest: false,
  });
  group.add(new THREE.Mesh(glowGeo, glowMat));

  // Mid glow
  const midGeo = new THREE.CircleGeometry(radius * 1.8, 32);
  const midMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(color),
    transparent: true,
    opacity: 0.3,
    depthTest: false,
  });
  group.add(new THREE.Mesh(midGeo, midMat));

  // Core dot (emissive for bloom)
  const coreGeo = new THREE.CircleGeometry(radius, 32);
  const coreMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(color).multiplyScalar(IMM.bloomEmissive),
    transparent: false,
    depthTest: false,
  });
  group.add(new THREE.Mesh(coreGeo, coreMat));

  // White center
  const whiteGeo = new THREE.CircleGeometry(radius * 0.4, 16);
  const whiteMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.7,
    depthTest: false,
  });
  group.add(new THREE.Mesh(whiteGeo, whiteMat));

  group.visible = false;
  return group;
}

export function positionDot(dot: THREE.Group, x: number, y: number) {
  dot.position.set(x, y, 0);
  dot.visible = true;
}
