/**
 * Surface3DImmersive.tsx — Cinematic Three.js 3D surface visualizer
 *
 * Renders z = f(x,y) as a lit, color-mapped mesh using a high-performance
 * clipping plane to "scan" the function into existence.
 */

import { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { compile, type EvalFunction } from 'mathjs';

/* ─── Props ─── */
interface Surface3DImmersiveProps {
    expr: string;
    variable?: string;
    bounds: number;
    resolution: number;
    onClose: () => void;
}

/* ─── Safe eval ─── */
const evalSafe = (fn: EvalFunction, x: number, y: number): number => {
    try { return Number(fn.evaluate({ x, y, e: Math.E, pi: Math.PI })); }
    catch { return NaN; }
};

/* ─── Height-to-color Heatmap ─── */
const COLOR_STOPS: [number, THREE.Color][] = [
    [0.00, new THREE.Color('#1a0533')], // Deep purple (Valleys)
    [0.15, new THREE.Color('#2d1b69')],
    [0.30, new THREE.Color('#1b4f72')],
    [0.45, new THREE.Color('#2196a4')],
    [0.60, new THREE.Color('#58C4DD')], // Cyan
    [0.75, new THREE.Color('#83C167')], // Green
    [0.90, new THREE.Color('#F4D03F')], // Yellow
    [1.00, new THREE.Color('#FF6F61')], // Red (Peaks)
];

function heightColor(t: number): THREE.Color {
    const tc = Math.max(0, Math.min(1, t));
    for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
        const [t0, c0] = COLOR_STOPS[i];
        const [t1, c1] = COLOR_STOPS[i + 1];
        if (tc >= t0 && tc <= t1) {
            const f = (tc - t0) / (t1 - t0);
            return c0.clone().lerp(c1, f);
        }
    }
    return COLOR_STOPS[COLOR_STOPS.length - 1][1].clone();
}

/* ─── Axis label sprites ─── */
function createTextSprite(text: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.font = 'bold 28px monospace';
    ctx.fillStyle = '#a1a1aa';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 64, 32);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(1.5, 0.75, 1);
    return sprite;
}

export default function Surface3DImmersive({
    expr, bounds, resolution, onClose,
}: Surface3DImmersiveProps) {
    const mountRef = useRef<HTMLDivElement>(null);
    const infoRef = useRef<HTMLDivElement>(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    const [isAutoTracking, setIsAutoTracking] = useState(true);

    const stateRef = useRef({ time: 0, paused: false, finished: false, autoTracking: true });

    useEffect(() => {
        document.documentElement.requestFullscreen().catch(() => { });
        return () => { document.exitFullscreen().catch(() => { }); };
    }, []);

    useEffect(() => {
        const container = mountRef.current;
        if (!container) return;

        let compiled: EvalFunction;
        try { compiled = compile(expr); }
        catch { setError(true); setLoading(false); return; }

        const w = window.innerWidth, h = window.innerHeight;
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(w, h);
        renderer.setClearColor(0x050508);
        
        // ENABLE CLIPPING FOR THE SCANNER EFFECT
        renderer.localClippingEnabled = true; 
        container.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 500);
        camera.position.set(bounds * 2, bounds * 1.5, bounds * 2);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.addEventListener('start', () => {
            if (stateRef.current.autoTracking) {
                stateRef.current.autoTracking = false;
                setIsAutoTracking(false);
            }
        });

        // ── Lighting ──
        scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(10, 20, 15);
        scene.add(dirLight);

        // ── Grid & Axes ──
        const grid = new THREE.GridHelper(bounds * 2, 20, 0x27272a, 0x18181b);
        grid.position.y = -0.05;
        scene.add(grid);

        for (let i = -Math.floor(bounds); i <= Math.floor(bounds); i += Math.max(1, Math.floor(bounds / 5))) {
            if (i === 0) continue;
            const xs = createTextSprite(i.toString());
            xs.position.set(i, -0.6, 0);
            scene.add(xs);
            const zs = createTextSprite(i.toString());
            zs.position.set(0, -0.6, i);
            scene.add(zs);
        }

        // ── Build Surface Geometry ──
        const step = (bounds * 2) / resolution;
        const geometry = new THREE.BufferGeometry();

        const vertices: number[] = [];
        const colors: number[] = [];
        const indices: number[] = [];
        const heights: number[][] = [];

        let zMin = Infinity, zMax = -Infinity;

        // Calculate math points
        for (let j = 0; j <= resolution; j++) {
            const row: number[] = [];
            for (let i = 0; i <= resolution; i++) {
                const x = -bounds + i * step;
                const y = -bounds + j * step; // treating 'y' math variable as z-depth in 3D
                const z = evalSafe(compiled, x, y);
                const cz = isFinite(z) ? Math.max(-30, Math.min(30, z)) : 0;
                row.push(cz);
                if (isFinite(z)) { zMin = Math.min(zMin, cz); zMax = Math.max(zMax, cz); }
            }
            heights.push(row);
        }

        if (!isFinite(zMin)) zMin = -1;
        if (!isFinite(zMax)) zMax = 1;
        const zRange = zMax - zMin || 1;

        // Map to 3D space
        for (let j = 0; j <= resolution; j++) {
            for (let i = 0; i <= resolution; i++) {
                const x = -bounds + i * step;
                const depth = -bounds + j * step;
                const height = heights[j][i];
                vertices.push(x, height, depth); 

                const t = (height - zMin) / zRange;
                const c = heightColor(t);
                colors.push(c.r, c.g, c.b);
            }
        }

        for (let j = 0; j < resolution; j++) {
            for (let i = 0; i < resolution; i++) {
                const a = j * (resolution + 1) + i;
                const b = a + 1;
                const c = a + (resolution + 1);
                const d = c + 1;
                indices.push(a, c, b, b, c, d);
            }
        }

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();

        // ── The Clipping Plane (The Laser Scanner) ──
        // This plane hides everything "in front" of it. We will move it along the X axis.
        const sweepPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), -bounds);

        // SOLID Material, NO transparency to fix the lag.
        const surfaceMat = new THREE.MeshPhongMaterial({
            vertexColors: true,
            side: THREE.DoubleSide,
            shininess: 30,
            clippingPlanes: [sweepPlane], 
            clipShadows: true
        });
        const surfaceMesh = new THREE.Mesh(geometry, surfaceMat);
        scene.add(surfaceMesh);

        // Optional wireframe to make it look like a math graph
        const wireMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            wireframe: true,
            transparent: true,
            opacity: 0.1,
            clippingPlanes: [sweepPlane]
        });
        const wireMesh = new THREE.Mesh(geometry, wireMat);
        scene.add(wireMesh);

        // ── FIX: Set static HTML ONCE, not in the animation loop ──
        if (infoRef.current) {
            const zMid = ((zMin + zMax) / 2).toFixed(2);
            infoRef.current.innerHTML =
                `<span style="color:#58C4DD">z</span> ∈ [${zMin.toFixed(2)}, ${zMax.toFixed(2)}]<br/>` +
                `<span style="color:#a1a1aa">Domain</span> ∈ [${-bounds}, ${bounds}]<br/>` +
                `Median Height ≈ <b style="color:#fff">${zMid}</b>`;
        }

        setLoading(false);

        // ── Animation Loop ──
        const clock = new THREE.Clock();
        let animFrame = 0;
        const DURATION = 8.0;

        const animate = () => {
            animFrame = requestAnimationFrame(animate);
            const delta = clock.getDelta();
            controls.update();

            if (!stateRef.current.paused && !stateRef.current.finished) {
                stateRef.current.time += delta;
                if (stateRef.current.time >= DURATION) {
                    stateRef.current.time = DURATION;
                    stateRef.current.finished = true;
                    setIsFinished(true);
                }
            }

            const progress = stateRef.current.time / DURATION;

            // Animate the clipping plane sweeping from -bounds to +bounds
            sweepPlane.constant = -bounds + (bounds * 2) * progress;

            // Camera sweep
            if (stateRef.current.autoTracking) {
                const angle = progress * Math.PI * 1.5 - Math.PI / 4;
                const radius = bounds * 2.2;
                const camY = bounds * 1.2 + Math.sin(progress * Math.PI) * bounds * 0.5;
                const camX = Math.cos(angle) * radius;
                const camZ = Math.sin(angle) * radius;

                camera.position.lerp(new THREE.Vector3(camX, camY, camZ), 0.04);
                controls.target.lerp(new THREE.Vector3(0, 0, 0), 0.04);
            }

            renderer.render(scene, camera);
        };

        animate();

        const onResize = () => {
            const width = window.innerWidth, height = window.innerHeight;
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('resize', onResize);
        window.addEventListener('keydown', onKey);

        return () => {
            cancelAnimationFrame(animFrame);
            window.removeEventListener('resize', onResize);
            window.removeEventListener('keydown', onKey);
            renderer.dispose();
            geometry.dispose();
            surfaceMat.dispose();
            wireMat.dispose();
            if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
        };
    }, [expr, bounds, resolution, onClose]);

    // ── Control handlers ──
    const handleTogglePause = () => {
        const willPause = !stateRef.current.paused;
        stateRef.current.paused = willPause;
        setIsPaused(willPause);
    };
    const handleReplay = () => {
        stateRef.current.time = 0;
        stateRef.current.finished = false;
        stateRef.current.paused = false;
        setIsFinished(false);
        setIsPaused(false);
    };
    const handleToggleTracking = () => {
        const willTrack = !stateRef.current.autoTracking;
        stateRef.current.autoTracking = willTrack;
        setIsAutoTracking(willTrack);
    };

    if (error) {
        return createPortal(
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, background: '#050508', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', flexDirection: 'column', gap: 16 }}>
                <h2>Math Error</h2>
                <p style={{ color: '#a1a1aa' }}>Could not parse: {expr}</p>
                <button onClick={onClose} style={{ padding: '8px 16px', background: '#333', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Close</button>
            </div>,
            document.body,
        );
    }

    return createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, background: '#050508', overflow: 'hidden' }}>
            <div ref={mountRef} style={{ width: '100%', height: '100%', position: 'absolute', inset: 0, cursor: 'grab' }} />

            {/* ── Floating info label ── */}
            <div ref={infoRef} style={{
                position: 'absolute', top: 80, right: 28,
                background: 'rgba(0,0,0,0.85)', border: '1px solid #58C4DD', borderRadius: 6,
                padding: '12px 16px', fontSize: '0.9rem', fontFamily: 'monospace',
                pointerEvents: 'none', whiteSpace: 'nowrap', lineHeight: 1.8, color: '#a1a1aa',
                boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
            }} />

            {/* ── Header ── */}
            <div style={{ position: 'absolute', top: 24, left: 32, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: '#58C4DD' }}>
                    Function Surface Scanner
                </span>
                <span style={{ fontFamily: 'monospace', fontSize: '1.4rem', color: '#fff' }}>
                    z = {expr}
                </span>
                <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                    <span style={{ color: '#58C4DD', fontSize: '0.85rem', fontWeight: 600 }}>▰ Z-Axis Heatmap</span>
                </div>
            </div>

            {/* ── Close ── */}
            <button onClick={onClose} style={{
                position: 'absolute', top: 24, right: 32, width: 44, height: 44,
                borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(0,0,0,0.8)', color: '#fff', fontSize: '1.2rem', cursor: 'pointer',
            }}>✕</button>

            {/* ── Control Bar ── */}
            {!loading && (
                <div style={{
                    position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)',
                    display: 'flex', gap: 12, background: 'rgba(0,0,0,0.8)', padding: '8px',
                    borderRadius: 12, border: '1px solid #27272a', backdropFilter: 'blur(8px)',
                }}>
                    <button onClick={isFinished ? handleReplay : handleTogglePause} style={{
                        padding: '10px 24px', borderRadius: 8, border: 'none',
                        background: isFinished ? '#58C4DD' : (isPaused ? '#10b981' : '#3f3f46'),
                        color: '#fff', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer',
                        fontFamily: 'system-ui', minWidth: 120,
                    }}>
                        {isFinished ? '↺ Replay' : (isPaused ? '▶ Resume' : '⏸ Pause')}
                    </button>

                    <button onClick={handleToggleTracking} style={{
                        padding: '10px 24px', borderRadius: 8, border: '1px solid #3f3f46',
                        background: isAutoTracking ? '#1e1e24' : 'transparent',
                        color: isAutoTracking ? '#58C4DD' : '#a1a1aa',
                        fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
                        fontFamily: 'system-ui', minWidth: 160, transition: 'all 0.2s',
                    }}>
                        {isAutoTracking ? '🎯 Auto-Tracking' : '🎥 Free Camera'}
                    </button>
                </div>
            )}
        </div>,
        document.body,
    );
}
