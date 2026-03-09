/**
 * glowLine.ts — Creates thick, anti-aliased line meshes that bloom properly.
 *
 * Uses Three.js MeshLine-style geometry: each line segment is a screen-facing
 * quad strip, giving pixel-perfect thickness that doesn't depend on GL lineWidth.
 */

import * as THREE from 'three';

const lineVertexShader = /* glsl */ `
  attribute vec3 prevPos;
  attribute vec3 nextPos;
  attribute float side;
  attribute float progress;

  uniform float lineWidth;
  uniform vec2 resolution;

  varying float vProgress;
  varying float vSide;

  vec4 project(vec3 p) {
    return projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }

  void main() {
    vProgress = progress;
    vSide = side;

    vec4 curr = project(position);
    vec4 prev = project(prevPos);
    vec4 next = project(nextPos);

    vec2 currScreen = curr.xy / curr.w * resolution;
    vec2 prevScreen = prev.xy / prev.w * resolution;
    vec2 nextScreen = next.xy / next.w * resolution;

    vec2 dir = vec2(0.0);
    if (length(currScreen - prevScreen) > 0.001) dir += normalize(currScreen - prevScreen);
    if (length(nextScreen - currScreen) > 0.001) dir += normalize(nextScreen - currScreen);
    dir = normalize(dir);

    vec2 normal = vec2(-dir.y, dir.x);
    vec2 offset = normal * lineWidth * side / resolution;

    gl_Position = curr + vec4(offset * curr.w, 0.0, 0.0);
  }
`;

const lineFragmentShader = /* glsl */ `
  uniform vec3 color;
  uniform float emissive;
  uniform float opacity;

  varying float vProgress;
  varying float vSide;

  void main() {
    // Soft edge falloff for anti-aliasing
    float edge = 1.0 - smoothstep(0.7, 1.0, abs(vSide));
    float alpha = opacity * edge;

    // Emissive color for bloom (values > 1.0 trigger bloom)
    vec3 col = color * emissive;
    gl_FragColor = vec4(col, alpha);
  }
`;

export interface GlowLineOptions {
  color: string;
  width?: number;
  emissive?: number;
  opacity?: number;
}

/**
 * Build a renderable line mesh from a list of 2D points.
 * Points with NaN y-values create breaks in the line.
 */
export function createGlowLine(
  points: { x: number; y: number }[],
  resolution: THREE.Vector2,
  opts: GlowLineOptions,
): THREE.Mesh | null {
  // Split into continuous segments (break at NaN)
  const segments: { x: number; y: number }[][] = [];
  let current: { x: number; y: number }[] = [];
  for (const pt of points) {
    if (!isFinite(pt.y)) {
      if (current.length >= 2) segments.push(current);
      current = [];
    } else {
      current.push(pt);
    }
  }
  if (current.length >= 2) segments.push(current);
  if (segments.length === 0) return null;

  // Build geometry from all segments
  const positions: number[] = [];
  const prevPositions: number[] = [];
  const nextPositions: number[] = [];
  const sides: number[] = [];
  const progresses: number[] = [];
  const indices: number[] = [];
  let vertexOffset = 0;

  for (const seg of segments) {
    const totalLen = seg.length;
    for (let i = 0; i < totalLen; i++) {
      const prev = seg[Math.max(0, i - 1)];
      const curr = seg[i];
      const next = seg[Math.min(totalLen - 1, i + 1)];
      const prog = i / (totalLen - 1);

      // Two vertices per point (one on each side of the line)
      for (const s of [-1, 1]) {
        positions.push(curr.x, curr.y, 0);
        prevPositions.push(prev.x, prev.y, 0);
        nextPositions.push(next.x, next.y, 0);
        sides.push(s);
        progresses.push(prog);
      }

      // Triangle strip indices
      if (i < totalLen - 1) {
        const base = vertexOffset + i * 2;
        indices.push(base, base + 1, base + 2);
        indices.push(base + 1, base + 3, base + 2);
      }
    }
    vertexOffset += totalLen * 2;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('prevPos', new THREE.Float32BufferAttribute(prevPositions, 3));
  geometry.setAttribute('nextPos', new THREE.Float32BufferAttribute(nextPositions, 3));
  geometry.setAttribute('side', new THREE.Float32BufferAttribute(sides, 1));
  geometry.setAttribute('progress', new THREE.Float32BufferAttribute(progresses, 1));
  geometry.setIndex(indices);

  const color = new THREE.Color(opts.color);
  const material = new THREE.ShaderMaterial({
    vertexShader: lineVertexShader,
    fragmentShader: lineFragmentShader,
    uniforms: {
      color: { value: color },
      emissive: { value: opts.emissive ?? 2.5 },
      opacity: { value: opts.opacity ?? 1.0 },
      lineWidth: { value: opts.width ?? 3.0 },
      resolution: { value: resolution },
    },
    transparent: true,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });

  return new THREE.Mesh(geometry, material);
}

/**
 * Update an existing line mesh with new points (avoids re-creating material).
 */
export function updateGlowLine(
  mesh: THREE.Mesh,
  points: { x: number; y: number }[],
): void {
  const oldGeo = mesh.geometry;

  // Rebuild geometry
  const segments: { x: number; y: number }[][] = [];
  let current: { x: number; y: number }[] = [];
  for (const pt of points) {
    if (!isFinite(pt.y)) {
      if (current.length >= 2) segments.push(current);
      current = [];
    } else {
      current.push(pt);
    }
  }
  if (current.length >= 2) segments.push(current);

  const positions: number[] = [];
  const prevPositions: number[] = [];
  const nextPositions: number[] = [];
  const sidesArr: number[] = [];
  const progressArr: number[] = [];
  const indices: number[] = [];
  let vertexOffset = 0;

  for (const seg of segments) {
    const totalLen = seg.length;
    for (let i = 0; i < totalLen; i++) {
      const prev = seg[Math.max(0, i - 1)];
      const curr = seg[i];
      const next = seg[Math.min(totalLen - 1, i + 1)];
      const prog = i / (totalLen - 1);

      for (const s of [-1, 1]) {
        positions.push(curr.x, curr.y, 0);
        prevPositions.push(prev.x, prev.y, 0);
        nextPositions.push(next.x, next.y, 0);
        sidesArr.push(s);
        progressArr.push(prog);
      }

      if (i < totalLen - 1) {
        const base = vertexOffset + i * 2;
        indices.push(base, base + 1, base + 2);
        indices.push(base + 1, base + 3, base + 2);
      }
    }
    vertexOffset += totalLen * 2;
  }

  const newGeo = new THREE.BufferGeometry();
  newGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  newGeo.setAttribute('prevPos', new THREE.Float32BufferAttribute(prevPositions, 3));
  newGeo.setAttribute('nextPos', new THREE.Float32BufferAttribute(nextPositions, 3));
  newGeo.setAttribute('side', new THREE.Float32BufferAttribute(sidesArr, 1));
  newGeo.setAttribute('progress', new THREE.Float32BufferAttribute(progressArr, 1));
  newGeo.setIndex(indices);

  mesh.geometry = newGeo;
  oldGeo.dispose();
}
