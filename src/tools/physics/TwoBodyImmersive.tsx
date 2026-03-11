/**
 * TwoBodyImmersive.tsx — Cinematic Three.js Two-Body Gravitational Simulation
 *
 * Fullscreen immersive mode with:
 *   - Bloom post-processing for glowing bodies
 *   - Multi-layer star field with twinkling
 *   - Point lights on each body (cast colored light on the other)
 *   - Atmospheric ring sprites
 *   - Fading gradient trails
 *   - Smart cinematic camera with dramatic angle shifts
 */

import { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

/* ─── Props ─── */
interface TwoBodyImmersiveProps {
    m1: number;
    m2: number;
    sep: number;
    vTan: number;
    G: number;
    onClose: () => void;
}

/* ─── Physics ─── */
interface SimState {
    x1: number; y1: number; z1: number; vx1: number; vy1: number; vz1: number;
    x2: number; y2: number; z2: number; vx2: number; vy2: number; vz2: number;
}

function makeInitial(m1: number, m2: number, sep: number, vTan: number, G: number): SimState {
    const totalM = m1 + m2;
    const x1 = -(m2 / totalM) * sep;
    const x2 = (m1 / totalM) * sep;
    const vCirc = Math.sqrt(G * totalM / sep);
    const speedFraction = Math.min(vTan / 3.0, 1.5) * 0.95;
    const vRel = vCirc * speedFraction;
    const v1z = (m2 / totalM) * vRel;
    const v2z = -(m1 / totalM) * vRel;
    return {
        x1, y1: 0, z1: 0, vx1: 0, vy1: 0, vz1: v1z,
        x2, y2: 0, z2: 0, vx2: 0, vy2: 0, vz2: v2z,
    };
}

function stepSim(s: SimState, m1: number, m2: number, G: number, dt: number) {
    const dx = s.x2 - s.x1, dy = s.y2 - s.y1, dz = s.z2 - s.z1;
    const softeningSq = 2.0;
    const rSq = (dx * dx + dy * dy + dz * dz) + softeningSq;
    const r = Math.sqrt(rSq);
    const F = (G * m1 * m2) / rSq;
    const fx = F * dx / r, fy = F * dy / r, fz = F * dz / r;
    s.vx1 += (fx / m1) * dt; s.vy1 += (fy / m1) * dt; s.vz1 += (fz / m1) * dt;
    s.vx2 -= (fx / m2) * dt; s.vy2 -= (fy / m2) * dt; s.vz2 -= (fz / m2) * dt;
    s.x1 += s.vx1 * dt; s.y1 += s.vy1 * dt; s.z1 += s.vz1 * dt;
    s.x2 += s.vx2 * dt; s.y2 += s.vy2 * dt; s.z2 += s.vz2 * dt;
}

/* ─── Orbital Element Computation (from state vectors) ─── */
interface OrbitalElements {
    a: number;     // semi-major axis
    e: number;     // eccentricity
    T: number;     // period
    theta: number; // true anomaly (degrees)
    E: number;     // total energy
    L: number;     // angular momentum magnitude
    mu: number;    // reduced mass
    rPeri: number; // periapsis distance
    rApo: number;  // apoapsis distance
    epsilon: number; // specific orbital energy
    h: number;     // specific angular momentum
    v1: number;    // speed of body 1
    v2: number;    // speed of body 2
    vRel: number;  // relative speed
    rDist: number; // current separation
}

function computeElements(s: SimState, m1: number, m2: number, G: number): OrbitalElements {
    const totalM = m1 + m2;
    const mu = (m1 * m2) / totalM;
    const GMtot = G * totalM;

    // Relative position & velocity
    const rx = s.x2 - s.x1, ry = s.y2 - s.y1, rz = s.z2 - s.z1;
    const vx = s.vx2 - s.vx1, vy = s.vy2 - s.vy1, vz = s.vz2 - s.vz1;
    const r = Math.sqrt(rx * rx + ry * ry + rz * rz);
    const v = Math.sqrt(vx * vx + vy * vy + vz * vz);

    // Speeds
    const v1 = Math.sqrt(s.vx1 ** 2 + s.vy1 ** 2 + s.vz1 ** 2);
    const v2 = Math.sqrt(s.vx2 ** 2 + s.vy2 ** 2 + s.vz2 ** 2);

    // Specific orbital energy & angular momentum
    const epsilon = 0.5 * v * v - GMtot / r;
    const E = mu * epsilon;

    // Angular momentum vector: L = r × v
    const Lx = ry * vz - rz * vy;
    const Ly = rz * vx - rx * vz;
    const Lz = rx * vy - ry * vx;
    const h = Math.sqrt(Lx * Lx + Ly * Ly + Lz * Lz);
    const L = mu * h;

    // Semi-major axis
    const a = epsilon < 0 ? -GMtot / (2 * epsilon) : Infinity;

    // Eccentricity vector: e = (v × L)/GM - r̂
    // Simplified for the magnitude:
    const eSq = 1 + (2 * epsilon * h * h) / (GMtot * GMtot);
    const e = Math.sqrt(Math.max(0, eSq));

    // Period (Kepler's third law)
    const T = isFinite(a) && a > 0 ? 2 * Math.PI * Math.sqrt(a * a * a / GMtot) : Infinity;

    // Periapsis / apoapsis
    const rPeri = isFinite(a) ? a * (1 - e) : r;
    const rApo = (isFinite(a) && e < 1) ? a * (1 + e) : Infinity;

    // True anomaly from r and orbital params
    let theta = 0;
    if (isFinite(a) && e > 1e-6) {
        const cosTheta = Math.max(-1, Math.min(1, (a * (1 - e * e) / r - 1) / e));
        theta = Math.acos(cosTheta) * 180 / Math.PI;
        // Determine sign from radial velocity
        const vr = (rx * vx + ry * vy + rz * vz) / r;
        if (vr < 0) theta = 360 - theta;
    }

    return { a, e, T, theta, E, L, mu, rPeri, rApo, epsilon, h, v1, v2, vRel: v, rDist: r };
}

/* ─── Build predicted orbit ellipse (Keplerian) ─── */
function buildOrbitEllipse(
    s: SimState, m1: number, m2: number, G: number, scene: THREE.Scene,
): { line: THREE.Line; periMarker: THREE.Mesh; apoMarker: THREE.Mesh } {
    const totalM = m1 + m2;
    const GMtot = G * totalM;
    const rx = s.x2 - s.x1, ry = s.y2 - s.y1, rz = s.z2 - s.z1;
    const vx = s.vx2 - s.vx1, vy = s.vy2 - s.vy1, vz = s.vz2 - s.vz1;
    const r = Math.sqrt(rx * rx + ry * ry + rz * rz);
    const v = Math.sqrt(vx * vx + vy * vy + vz * vz);
    const epsilon = 0.5 * v * v - GMtot / r;
    const Lx = ry * vz - rz * vy, Ly = rz * vx - rx * vz, Lz = rx * vy - ry * vx;
    const h = Math.sqrt(Lx * Lx + Ly * Ly + Lz * Lz);
    const a = epsilon < 0 ? -GMtot / (2 * epsilon) : 200;
    const eSq = 1 + (2 * epsilon * h * h) / (GMtot * GMtot);
    const e = Math.sqrt(Math.max(0, eSq));

    // Compute eccentricity vector direction for orbit orientation
    // e_vec = (v × h_vec) / GM - r̂
    const hx = Lx, hy = Ly, hz = Lz;
    const crossVHx = vy * hz - vz * hy;
    const crossVHy = vz * hx - vx * hz;
    const crossVHz = vx * hy - vy * hx;
    const eVecX = crossVHx / GMtot - rx / r;
    const eVecY = crossVHy / GMtot - ry / r;
    const eVecZ = crossVHz / GMtot - rz / r;
    const eMag = Math.sqrt(eVecX * eVecX + eVecY * eVecY + eVecZ * eVecZ);

    // Orbital frame: x̂ = ê (toward periapsis), ẑ = ĥ (normal), ŷ = ẑ × x̂
    const ex = eMag > 1e-6 ? eVecX / eMag : rx / r;
    const ey = eMag > 1e-6 ? eVecY / eMag : ry / r;
    const ez = eMag > 1e-6 ? eVecZ / eMag : rz / r;
    const hMag = Math.max(h, 1e-6);
    const nx = hx / hMag, ny = hy / hMag, nz = hz / hMag;
    // ŷ = n̂ × ê
    const px = ny * ez - nz * ey;
    const py = nz * ex - nx * ez;
    const pz = nx * ey - ny * ex;

    // Center of mass (focus is at CoM for relative orbit)
    const comX = (m1 * s.x1 + m2 * s.x2) / totalM;
    const comY = (m1 * s.y1 + m2 * s.y2) / totalM;
    const comZ = (m1 * s.z1 + m2 * s.z2) / totalM;

    // Generate ellipse points in the orbital plane
    const N = 200;
    const pts: number[] = [];
    const p = a * (1 - e * e);
    const clampedE = Math.min(e, 0.99);

    for (let i = 0; i <= N; i++) {
        const theta = (i / N) * 2 * Math.PI;
        const rTheta = Math.abs(p) / (1 + clampedE * Math.cos(theta));
        const clampedR = Math.min(rTheta, a * 5);
        // Position in orbital frame
        const ox = clampedR * Math.cos(theta);
        const oy = clampedR * Math.sin(theta);
        // Transform to 3D (centered on CoM)
        pts.push(
            comX + ox * ex + oy * px,
            comY + ox * ey + oy * py,
            comZ + ox * ez + oy * pz,
        );
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const mat = new THREE.LineBasicMaterial({
        color: 0x446688, transparent: true, opacity: 0.25,
        blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const line = new THREE.Line(geo, mat);
    scene.add(line);

    // Periapsis marker (green)
    const periGeo = new THREE.SphereGeometry(0.8, 12, 12);
    const periMat = new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.7 });
    const periMarker = new THREE.Mesh(periGeo, periMat);
    const rPeri = Math.abs(p) / (1 + clampedE);
    periMarker.position.set(
        comX + rPeri * ex, comY + rPeri * ey, comZ + rPeri * ez,
    );
    scene.add(periMarker);

    // Apoapsis marker (red)
    const apoGeo = new THREE.SphereGeometry(0.8, 12, 12);
    const apoMat = new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.7 });
    const apoMarker = new THREE.Mesh(apoGeo, apoMat);
    if (e < 0.99) {
        const rApo = Math.abs(p) / (1 - clampedE);
        apoMarker.position.set(
            comX - rApo * ex, comY - rApo * ey, comZ - rApo * ez,
        );
    } else {
        apoMarker.visible = false;
    }
    scene.add(apoMarker);

    return { line, periMarker, apoMarker };
}

/* ─── Rich Star Field ─── */
function createStarField(): THREE.Group {
    const group = new THREE.Group();

    // Layer 1: dense small stars
    const n1 = 2000;
    const v1 = new Float32Array(n1 * 3);
    const c1 = new Float32Array(n1 * 3);
    for (let i = 0; i < n1; i++) {
        v1[i * 3] = (Math.random() - 0.5) * 800;
        v1[i * 3 + 1] = (Math.random() - 0.5) * 800;
        v1[i * 3 + 2] = (Math.random() - 0.5) * 800;
        // Slight color variation: mostly white, some blue/yellow tint
        const tint = Math.random();
        c1[i * 3] = tint > 0.7 ? 0.8 : 1.0;
        c1[i * 3 + 1] = 1.0;
        c1[i * 3 + 2] = tint < 0.3 ? 0.8 : 1.0;
    }
    const g1 = new THREE.BufferGeometry();
    g1.setAttribute('position', new THREE.BufferAttribute(v1, 3));
    g1.setAttribute('color', new THREE.BufferAttribute(c1, 3));
    group.add(new THREE.Points(g1, new THREE.PointsMaterial({
        size: 0.3, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.7,
    })));

    // Layer 2: sparse bright stars
    const n2 = 200;
    const v2 = new Float32Array(n2 * 3);
    for (let i = 0; i < n2; i++) {
        v2[i * 3] = (Math.random() - 0.5) * 600;
        v2[i * 3 + 1] = (Math.random() - 0.5) * 600;
        v2[i * 3 + 2] = (Math.random() - 0.5) * 600;
    }
    const g2 = new THREE.BufferGeometry();
    g2.setAttribute('position', new THREE.BufferAttribute(v2, 3));
    group.add(new THREE.Points(g2, new THREE.PointsMaterial({
        size: 0.8, sizeAttenuation: true, color: 0xffffff, transparent: true, opacity: 0.9,
    })));

    return group;
}

/* ─── Atmosphere ring sprite ─── */
function createAtmosphereSprite(color: number, radius: number): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    const cx = 128, cy = 128;

    // Soft radial gradient ring
    const grad = ctx.createRadialGradient(cx, cy, radius * 8, cx, cy, 128);
    const hexStr = '#' + new THREE.Color(color).getHexString();
    grad.addColorStop(0, hexStr + '40');
    grad.addColorStop(0.4, hexStr + '18');
    grad.addColorStop(0.7, hexStr + '08');
    grad.addColorStop(1.0, hexStr + '00');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({
        map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(radius * 8, radius * 8, 1);
    return sprite;
}

/* ─── Gradient trail via tube of points ─── */
class FadingTrail {
    private trail: THREE.Vector3[] = [];
    private line: THREE.Line;
    private maxLen: number;

    constructor(color: number, maxLen: number, scene: THREE.Scene) {
        this.maxLen = maxLen;
        const mat = new THREE.LineBasicMaterial({
            color, transparent: true, opacity: 0.5,
            blending: THREE.AdditiveBlending, depthWrite: false,
        });
        this.line = new THREE.Line(new THREE.BufferGeometry(), mat);
        scene.add(this.line);
    }

    push(pt: THREE.Vector3) {
        this.trail.push(pt.clone());
        if (this.trail.length > this.maxLen) this.trail.shift();
        this.rebuild();
    }

    private rebuild() {
        const len = this.trail.length;
        if (len < 2) return;
        const positions = new Float32Array(len * 3);
        const colors = new Float32Array(len * 3);
        const baseColor = (this.line.material as THREE.LineBasicMaterial).color;

        for (let i = 0; i < len; i++) {
            positions[i * 3] = this.trail[i].x;
            positions[i * 3 + 1] = this.trail[i].y;
            positions[i * 3 + 2] = this.trail[i].z;
            const alpha = i / len;
            colors[i * 3] = baseColor.r * alpha;
            colors[i * 3 + 1] = baseColor.g * alpha;
            colors[i * 3 + 2] = baseColor.b * alpha;
        }
        this.line.geometry.dispose();
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        this.line.geometry = geo;
        (this.line.material as THREE.LineBasicMaterial).vertexColors = true;
    }

    dispose() {
        this.line.geometry.dispose();
        (this.line.material as THREE.Material).dispose();
    }
}

/* ═══════════════════════════════════════════════════
   ═══ Component
   ═══════════════════════════════════════════════════ */
export default function TwoBodyImmersive({ m1, m2, sep, vTan, G, onClose }: TwoBodyImmersiveProps) {
    const mountRef = useRef<HTMLDivElement>(null);
    const infoRef = useRef<HTMLDivElement>(null);

    const [loading, setLoading] = useState(true);
    const [isPaused, setIsPaused] = useState(false);
    const [isAutoTracking, setIsAutoTracking] = useState(true);

    const stateRef = useRef({ paused: false, autoTracking: true });
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    // Fullscreen
    useEffect(() => {
        document.documentElement.requestFullscreen().catch(() => { });
        return () => { document.exitFullscreen().catch(() => { }); };
    }, []);

    useEffect(() => {
        const container = mountRef.current;
        if (!container) return;

        const w = window.innerWidth, h = window.innerHeight;

        // ── Renderer ──
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(w, h);
        renderer.setClearColor(0x020210);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;
        container.appendChild(renderer.domElement);

        const scene = new THREE.Scene();

        // Subtle space fog
        scene.fog = new THREE.FogExp2(0x020210, 0.0008);

        const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 1200);
        camera.position.set(0, sep * 1.2, sep * 2.2);

        // ── Post-processing: Bloom ──
        const composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));
        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(w, h),
            0.8,   // strength
            0.4,   // radius
            0.6,   // threshold
        );
        composer.addPass(bloomPass);

        // ── Controls ──
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.04;
        controls.addEventListener('start', () => {
            if (stateRef.current.autoTracking) {
                stateRef.current.autoTracking = false;
                setIsAutoTracking(false);
            }
        });

        // ── Lighting ──
        scene.add(new THREE.AmbientLight(0x223344, 0.4));
        const sunLight = new THREE.DirectionalLight(0xfff8ee, 0.6);
        sunLight.position.set(60, 100, 80);
        scene.add(sunLight);

        // ── Star field ──
        scene.add(createStarField());

        // ── Orbital plane grid ──
        const gridSize = sep * 3;
        const grid = new THREE.GridHelper(gridSize, 40, 0x0c0c20, 0x06060f);
        grid.position.y = -0.3;
        (grid.material as THREE.Material).transparent = true;
        (grid.material as THREE.Material).opacity = 0.35;
        scene.add(grid);

        // ── Planet sizes ──
        const r1 = Math.max(2.0, Math.pow(m1, 0.33) * 1.4);
        const r2 = Math.max(1.2, Math.pow(m2, 0.33) * 1.4);

        // ── Body 1 (amber/gold) ──
        const mat1 = new THREE.MeshStandardMaterial({
            color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 0.6,
            metalness: 0.3, roughness: 0.4,
        });
        const mesh1 = new THREE.Mesh(new THREE.SphereGeometry(r1, 48, 48), mat1);
        scene.add(mesh1);

        // Point light on body 1 → illuminates body 2
        const light1 = new THREE.PointLight(0xf59e0b, 2.0, sep * 4);
        scene.add(light1);

        // Atmosphere sprite for body 1
        const atmo1 = createAtmosphereSprite(0xf59e0b, r1);
        scene.add(atmo1);

        // ── Body 2 (blue) ──
        const mat2 = new THREE.MeshStandardMaterial({
            color: 0x3b82f6, emissive: 0x3b82f6, emissiveIntensity: 0.6,
            metalness: 0.3, roughness: 0.4,
        });
        const mesh2 = new THREE.Mesh(new THREE.SphereGeometry(r2, 48, 48), mat2);
        scene.add(mesh2);

        // Point light on body 2
        const light2 = new THREE.PointLight(0x3b82f6, 2.0, sep * 4);
        scene.add(light2);

        // Atmosphere sprite for body 2
        const atmo2 = createAtmosphereSprite(0x3b82f6, r2);
        scene.add(atmo2);

        // ── CoM marker ──
        const comMat = new THREE.MeshBasicMaterial({ color: 0x8888aa, transparent: true, opacity: 0.5 });
        const comMesh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), comMat);
        scene.add(comMesh);

        // ── Connecting line ──
        const connectMat = new THREE.LineBasicMaterial({
            color: 0x334466, transparent: true, opacity: 0.15,
        });
        const connectLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(), new THREE.Vector3(),
        ]), connectMat);
        scene.add(connectLine);

        // ── Trails ──
        const trail1 = new FadingTrail(0xf59e0b, 1200, scene);
        const trail2 = new FadingTrail(0x3b82f6, 1200, scene);

        // ── Physics state ──
        const sim = makeInitial(m1, m2, sep, vTan, G);
        const DT = 0.025;
        const STEPS = 8;
        let trailTick = 0;
        let timeSec = 0;

        // ── Predicted orbit ellipse ──
        buildOrbitEllipse(sim, m1, m2, G, scene);

        // ── Velocity arrows ──
        const arrow1 = new THREE.ArrowHelper(
            new THREE.Vector3(0, 0, 1), new THREE.Vector3(), 5, 0xfbbf24, 1.5, 0.8,
        );
        (arrow1.line.material as THREE.Material).transparent = true;
        (arrow1.line.material as THREE.Material).opacity = 0.6;
        scene.add(arrow1);

        const arrow2 = new THREE.ArrowHelper(
            new THREE.Vector3(0, 0, 1), new THREE.Vector3(), 5, 0x60a5fa, 1.5, 0.8,
        );
        (arrow2.line.material as THREE.Material).transparent = true;
        (arrow2.line.material as THREE.Material).opacity = 0.6;
        scene.add(arrow2);

        // Camera cinematic state
        let camPhase = 0; // cycles through dramatic angles
        const PHASE_DURATION = 12; // seconds per camera phase

        setLoading(false);

        // ── Animation ──
        const clock = new THREE.Clock();
        let animFrame = 0;

        const animate = () => {
            animFrame = requestAnimationFrame(animate);
            const delta = clock.getDelta();
            controls.update();

            // Physics
            if (!stateRef.current.paused) {
                for (let i = 0; i < STEPS; i++) stepSim(sim, m1, m2, G, DT);
                timeSec += delta;

                // Trails (every other frame for performance)
                trailTick++;
                if (trailTick % 2 === 0) {
                    trail1.push(new THREE.Vector3(sim.x1, sim.y1, sim.z1));
                    trail2.push(new THREE.Vector3(sim.x2, sim.y2, sim.z2));
                }
            }

            // ── Update positions ──
            mesh1.position.set(sim.x1, sim.y1, sim.z1);
            mesh2.position.set(sim.x2, sim.y2, sim.z2);
            light1.position.copy(mesh1.position);
            light2.position.copy(mesh2.position);
            atmo1.position.copy(mesh1.position);
            atmo2.position.copy(mesh2.position);

            // Rotate bodies slightly for visual life
            mesh1.rotation.y += 0.003;
            mesh2.rotation.y += 0.005;

            // CoM
            const totalM = m1 + m2;
            const comX = (m1 * sim.x1 + m2 * sim.x2) / totalM;
            const comY = (m1 * sim.y1 + m2 * sim.y2) / totalM;
            const comZ = (m1 * sim.z1 + m2 * sim.z2) / totalM;
            comMesh.position.set(comX, comY, comZ);

            // Connecting line
            const cPos = new Float32Array([sim.x1, sim.y1, sim.z1, sim.x2, sim.y2, sim.z2]);
            connectLine.geometry.dispose();
            const cGeo = new THREE.BufferGeometry();
            cGeo.setAttribute('position', new THREE.BufferAttribute(cPos, 3));
            connectLine.geometry = cGeo;

            // ── Update velocity arrows ──
            const arrowScale = Math.min(sep * 0.15, 20);
            const updateArrow = (arrow: THREE.ArrowHelper, px: number, py: number, pz: number, avx: number, avy: number, avz: number) => {
                const speed = Math.sqrt(avx * avx + avy * avy + avz * avz);
                if (speed > 0.001) {
                    arrow.position.set(px, py, pz);
                    arrow.setDirection(new THREE.Vector3(avx, avy, avz).normalize());
                    arrow.setLength(speed * arrowScale, speed * arrowScale * 0.2, speed * arrowScale * 0.1);
                    arrow.visible = true;
                } else {
                    arrow.visible = false;
                }
            };
            updateArrow(arrow1, sim.x1, sim.y1, sim.z1, sim.vx1, sim.vy1, sim.vz1);
            updateArrow(arrow2, sim.x2, sim.y2, sim.z2, sim.vx2, sim.vy2, sim.vz2);

            // ── Compute orbital elements ──
            const elems = computeElements(sim, m1, m2, G);

            // Track initial energy for conservation check
            if (trailTick === 1) {
                (sim as any)._E0 = elems.E;
                (sim as any)._L0 = elems.L;
            }
            const E0 = (sim as any)._E0 ?? elems.E;
            const L0 = (sim as any)._L0 ?? elems.L;
            const driftE = E0 !== 0 ? Math.abs((elems.E - E0) / E0) * 100 : 0;
            const driftL = L0 !== 0 ? Math.abs((elems.L - L0) / L0) * 100 : 0;

            // ── Pulsing glow (intensity tracks speed) ──
            const speedPulse = Math.min(elems.vRel / 10, 1.5);
            mat1.emissiveIntensity = 0.4 + speedPulse * 0.4;
            mat2.emissiveIntensity = 0.4 + speedPulse * 0.4;
            light1.intensity = 1.5 + speedPulse;
            light2.intensity = 1.5 + speedPulse;

            // ── Research-grade HUD ──
            if (trailTick % 10 === 0 && infoRef.current) {
                const eColor = elems.E < 0 ? '#10b981' : '#ef4444';
                const orbitType = elems.e < 0.01 ? 'CIRCULAR' : elems.e < 1 ? 'ELLIPTIC' : elems.e === 1 ? 'PARABOLIC' : 'HYPERBOLIC';
                const driftColor = driftE < 0.1 ? '#10b981' : driftE < 1 ? '#f59e0b' : '#ef4444';

                const fmt = (v: number, d = 2) => isFinite(v) ? v.toFixed(d) : '∞';
                const row = (label: string, value: string, color = '#e4e4e7') =>
                    `<div style="display:flex;justify-content:space-between;gap:16px"><span style="color:#6b7280">${label}</span><b style="color:${color}">${value}</b></div>`;

                infoRef.current.innerHTML =
                    `<div style="margin-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.06);padding-bottom:6px"><span style="color:#6b7280;font-size:0.65rem;letter-spacing:2px">ORBITAL ELEMENTS</span></div>` +
                    row('a', fmt(elems.a, 1)) +
                    row('e', fmt(elems.e, 4)) +
                    row('T', fmt(elems.T, 1)) +
                    row('θ', fmt(elems.theta, 1) + '°') +
                    row('r<sub>peri</sub>', fmt(elems.rPeri, 1), '#10b981') +
                    row('r<sub>apo</sub>', fmt(elems.rApo, 1), '#ef4444') +
                    `<div style="margin:8px 0;border-bottom:1px solid rgba(255,255,255,0.06)"></div>` +
                    `<div style="margin-bottom:4px"><span style="color:#6b7280;font-size:0.65rem;letter-spacing:2px">STATE</span></div>` +
                    row('r', fmt(elems.rDist, 1)) +
                    row('v<sub>rel</sub>', fmt(elems.vRel, 2)) +
                    row('v₁', fmt(elems.v1, 2), '#f59e0b') +
                    row('v₂', fmt(elems.v2, 2), '#3b82f6') +
                    `<div style="margin:8px 0;border-bottom:1px solid rgba(255,255,255,0.06)"></div>` +
                    `<div style="margin-bottom:4px"><span style="color:#6b7280;font-size:0.65rem;letter-spacing:2px">CONSERVED</span></div>` +
                    row('E', fmt(elems.E, 2), eColor) +
                    `<div style="display:flex;align-items:center;gap:6px;margin:2px 0"><span style="color:#6b7280;font-size:0.7rem">${orbitType}</span></div>` +
                    row('L', fmt(elems.L, 2)) +
                    row('ε', fmt(elems.epsilon, 3)) +
                    row('h', fmt(elems.h, 2)) +
                    `<div style="margin:8px 0;border-bottom:1px solid rgba(255,255,255,0.06)"></div>` +
                    `<div style="margin-bottom:4px"><span style="color:#6b7280;font-size:0.65rem;letter-spacing:2px">CONSERVATION</span></div>` +
                    row('ΔE', driftE.toFixed(4) + '%', driftColor) +
                    row('ΔL', driftL.toFixed(4) + '%', driftColor) +
                    `<div style="height:3px;border-radius:2px;background:#1a1a2e;margin-top:6px;overflow:hidden"><div style="height:100%;width:${Math.min(100, driftE * 100)}%;background:${driftColor};border-radius:2px"></div></div>` +
                    `<div style="margin-top:8px;color:#52525b;font-size:0.72rem">t = ${timeSec.toFixed(1)}s</div>`;
            }

            // ── Cinematic Camera ──
            if (stateRef.current.autoTracking) {
                camPhase = timeSec / PHASE_DURATION;
                const phaseIndex = Math.floor(camPhase) % 4;
                const phaseProg = camPhase - Math.floor(camPhase); // 0→1

                const systemAngle = Math.atan2(sim.z1 - comZ, sim.x1 - comX);
                const dynamicRadius = Math.max(elems.rDist * 2.2, sep * 0.8);

                let targetCam: THREE.Vector3;
                let targetLook: THREE.Vector3;

                switch (phaseIndex) {
                    case 0: {
                        // Wide overview: slow orbit above
                        const a = systemAngle + Math.PI / 2 + phaseProg * 0.3;
                        targetCam = new THREE.Vector3(
                            comX + Math.cos(a) * dynamicRadius * 1.3,
                            dynamicRadius * 0.9,
                            comZ + Math.sin(a) * dynamicRadius * 1.3,
                        );
                        targetLook = new THREE.Vector3(comX, comY, comZ);
                        break;
                    }
                    case 1: {
                        // Close-up tracking body 1
                        const a = systemAngle + Math.PI * 0.8;
                        const closeR = Math.max(r1 * 8, 12);
                        targetCam = new THREE.Vector3(
                            sim.x1 + Math.cos(a) * closeR,
                            r1 * 3 + Math.sin(phaseProg * Math.PI) * 5,
                            sim.z1 + Math.sin(a) * closeR,
                        );
                        targetLook = new THREE.Vector3(sim.x1, sim.y1, sim.z1);
                        break;
                    }
                    case 2: {
                        // Low angle sweep (dramatic)
                        const a = systemAngle - Math.PI / 3 + phaseProg * 0.5;
                        targetCam = new THREE.Vector3(
                            comX + Math.cos(a) * dynamicRadius * 1.1,
                            2 + Math.sin(phaseProg * Math.PI) * dynamicRadius * 0.3,
                            comZ + Math.sin(a) * dynamicRadius * 1.1,
                        );
                        targetLook = new THREE.Vector3(comX, comY, comZ);
                        break;
                    }
                    case 3:
                    default: {
                        // Close-up tracking body 2
                        const a = systemAngle - Math.PI * 0.7;
                        const closeR = Math.max(r2 * 10, 15);
                        targetCam = new THREE.Vector3(
                            sim.x2 + Math.cos(a) * closeR,
                            r2 * 4 + Math.sin(phaseProg * Math.PI) * 4,
                            sim.z2 + Math.sin(a) * closeR,
                        );
                        targetLook = new THREE.Vector3(sim.x2, sim.y2, sim.z2);
                        break;
                    }
                }

                camera.position.lerp(targetCam, 0.025);
                controls.target.lerp(targetLook, 0.025);
            }

            // Render with bloom
            composer.render();
        };

        animate();

        // Resize
        const onResize = () => {
            const width = window.innerWidth, height = window.innerHeight;
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
            composer.setSize(width, height);
            bloomPass.setSize(width, height);
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
        window.addEventListener('resize', onResize);
        window.addEventListener('keydown', onKey);

        return () => {
            cancelAnimationFrame(animFrame);
            window.removeEventListener('resize', onResize);
            window.removeEventListener('keydown', onKey);
            trail1.dispose();
            trail2.dispose();
            renderer.dispose();
            composer.dispose();
            if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
        };
    }, [m1, m2, sep, vTan, G]);

    // ── Control handlers ──
    const handleTogglePause = () => {
        const willPause = !stateRef.current.paused;
        stateRef.current.paused = willPause;
        setIsPaused(willPause);
    };
    const handleToggleTracking = () => {
        const willTrack = !stateRef.current.autoTracking;
        stateRef.current.autoTracking = willTrack;
        setIsAutoTracking(willTrack);
    };

    return createPortal(
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 99999, background: '#020210', overflow: 'hidden',
        }}>
            <div ref={mountRef} style={{
                width: '100%', height: '100%', position: 'absolute', inset: 0, cursor: 'grab',
            }} />

            {/* ── Telemetry panel ── */}
            <div ref={infoRef} style={{
                position: 'absolute', top: 80, right: 28,
                background: 'rgba(2,2,16,0.85)', border: '1px solid rgba(59,130,246,0.2)',
                borderRadius: 8, padding: '14px 18px', fontSize: '0.88rem',
                fontFamily: 'JetBrains Mono, monospace', pointerEvents: 'none',
                whiteSpace: 'nowrap', lineHeight: 1.9, color: '#a1a1aa',
                boxShadow: '0 4px 20px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.03)',
                backdropFilter: 'blur(12px)',
            }} />

            {/* ── Header ── */}
            <div style={{
                position: 'absolute', top: 24, left: 32,
                display: 'flex', flexDirection: 'column', gap: 4,
            }}>
                <span style={{
                    fontSize: '0.65rem', fontWeight: 800, letterSpacing: 3,
                    textTransform: 'uppercase', color: '#f59e0b',
                    textShadow: '0 0 20px rgba(245,158,11,0.3)',
                }}>
                    Immersive Two-Body Simulation
                </span>
                <span style={{
                    fontFamily: 'JetBrains Mono, monospace', fontSize: '1.1rem', color: '#e4e4e7',
                    opacity: 0.8,
                }}>
                    m₁ = {m1} &nbsp; m₂ = {m2} &nbsp; G = {G}
                </span>
                <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                    <span style={{ color: '#f59e0b', fontSize: '0.8rem', fontWeight: 600, textShadow: '0 0 8px rgba(245,158,11,0.4)' }}>● Body 1</span>
                    <span style={{ color: '#3b82f6', fontSize: '0.8rem', fontWeight: 600, textShadow: '0 0 8px rgba(59,130,246,0.4)' }}>● Body 2</span>
                    <span style={{ color: '#8888aa', fontSize: '0.8rem', fontWeight: 600 }}>⊕ CoM</span>
                </div>
            </div>

            {/* ── Close ── */}
            <button onClick={onClose} style={{
                position: 'absolute', top: 24, right: 32, width: 44, height: 44,
                borderRadius: '50%', border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '1.2rem',
                cursor: 'pointer', backdropFilter: 'blur(8px)',
                transition: 'all 0.2s',
            }}>✕</button>

            {/* ── Control Bar ── */}
            {!loading && (
                <div style={{
                    position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)',
                    display: 'flex', gap: 12, background: 'rgba(2,2,16,0.8)', padding: '8px 12px',
                    borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)',
                    backdropFilter: 'blur(16px)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                }}>
                    <button onClick={handleTogglePause} style={{
                        padding: '10px 28px', borderRadius: 10, border: 'none',
                        background: isPaused ? '#10b981' : 'rgba(255,255,255,0.08)',
                        color: '#fff', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer',
                        fontFamily: 'system-ui', minWidth: 120, transition: 'all 0.2s',
                    }}>
                        {isPaused ? '▶ Resume' : '⏸ Pause'}
                    </button>

                    <button onClick={handleToggleTracking} style={{
                        padding: '10px 28px', borderRadius: 10,
                        border: '1px solid rgba(255,255,255,0.08)',
                        background: isAutoTracking ? 'rgba(245,158,11,0.1)' : 'transparent',
                        color: isAutoTracking ? '#f59e0b' : '#a1a1aa',
                        fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
                        fontFamily: 'system-ui', minWidth: 170, transition: 'all 0.2s',
                    }}>
                        {isAutoTracking ? '🎬 Cinematic' : '🎥 Free Camera'}
                    </button>
                </div>
            )}
        </div>,
        document.body,
    );
}
