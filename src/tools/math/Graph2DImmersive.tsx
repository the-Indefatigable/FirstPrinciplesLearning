/**
 * Graph2DImmersive.tsx — Cinematic Three.js 2D curve tracer
 *
 * Animates a function y=f(x) being traced from left to right with a
 * glowing tracer dot, progressive curve reveal via clipping plane,
 * and a sweeping orbital camera.
 */

import { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { compile, type EvalFunction } from 'mathjs';

interface Graph2DImmersiveProps {
    expr: string;
    variable?: string;
    onClose: () => void;
}

/* ─── Helpers ─── */
const evalSafe = (fn: EvalFunction, x: number, v: string): number => {
    try { const r = Number(fn.evaluate({ [v]: x, e: Math.E, pi: Math.PI })); return isFinite(r) ? r : NaN; }
    catch { return NaN; }
};




/* ─── Colors ─── */
const COLORS = {
    bg: 0x050508,
    curve: 0x3b82f6,     // Blue
    tracer: 0xffffff,     // White
    grid: 0x27272a,
    gridSub: 0x18181b,
};

/* ─── Text sprite ─── */
function textSprite(text: string, color = '#a1a1aa'): THREE.Sprite {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const ctx = c.getContext('2d')!;
    ctx.font = 'bold 26px monospace';
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 32);
    const mat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false });
    const s = new THREE.Sprite(mat);
    s.scale.set(2, 0.5, 1);
    return s;
}

export default function Graph2DImmersive({ expr, variable = 'x', onClose }: Graph2DImmersiveProps) {
    const mountRef = useRef<HTMLDivElement>(null);
    const labelRef = useRef<HTMLDivElement>(null);

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

        // ── Determine x-range and good y-range ──
        const X_MIN = -10, X_MAX = 10;
        let yMin = Infinity, yMax = -Infinity;
        for (let i = 0; i <= 200; i++) {
            const x = X_MIN + (X_MAX - X_MIN) * i / 200;
            const y = evalSafe(compiled, x, variable);
            if (isFinite(y)) { yMin = Math.min(yMin, y); yMax = Math.max(yMax, y); }
        }
        if (!isFinite(yMin)) { yMin = -5; yMax = 5; }
        const yPad = Math.max(1, (yMax - yMin) * 0.2);
        yMin -= yPad; yMax += yPad;
        const yMid = (yMin + yMax) / 2;
        const ySpan = (yMax - yMin) / 2;

        // ── Three.js setup ──
        const w = window.innerWidth, h = window.innerHeight;
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(w, h);
        renderer.setClearColor(COLORS.bg);
        renderer.localClippingEnabled = true;
        container.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 500);
        camera.position.set(0, yMid, 25);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true; controls.dampingFactor = 0.05;
        controls.addEventListener('start', () => {
            if (stateRef.current.autoTracking) {
                stateRef.current.autoTracking = false;
                setIsAutoTracking(false);
            }
        });

        // ── Grid ──
        // XY grid in the z=0 plane
        const gridGroup = new THREE.Group();
        const gridMat = new THREE.LineBasicMaterial({ color: COLORS.gridSub, transparent: true, opacity: 0.4 });
        for (let x = Math.ceil(X_MIN); x <= Math.floor(X_MAX); x++) {
            const g = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(x, yMin, 0), new THREE.Vector3(x, yMax, 0),
            ]);
            gridGroup.add(new THREE.Line(g, gridMat));
        }
        const yStep = Math.max(1, Math.round((yMax - yMin) / 10));
        for (let y = Math.ceil(yMin / yStep) * yStep; y <= yMax; y += yStep) {
            const g = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(X_MIN, y, 0), new THREE.Vector3(X_MAX, y, 0),
            ]);
            gridGroup.add(new THREE.Line(g, gridMat));
        }
        scene.add(gridGroup);

        // Axis lines
        const axisMat = new THREE.LineBasicMaterial({ color: 0x52525b });
        const xAxisGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(X_MIN, 0, 0), new THREE.Vector3(X_MAX, 0, 0)
        ]);
        scene.add(new THREE.Line(xAxisGeo, axisMat));
        const yAxisGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, yMin, 0), new THREE.Vector3(0, yMax, 0)
        ]);
        scene.add(new THREE.Line(yAxisGeo, axisMat));

        // Axis labels
        for (let x = Math.ceil(X_MIN); x <= Math.floor(X_MAX); x++) {
            if (x === 0) continue;
            const s = textSprite(x.toString());
            s.position.set(x, -0.5, 0);
            scene.add(s);
        }
        for (let y = Math.ceil(yMin / yStep) * yStep; y <= yMax; y += yStep) {
            if (Math.abs(y) < 0.01) continue;
            const s = textSprite(y.toFixed(0));
            s.position.set(-0.8, y, 0);
            scene.add(s);
        }

        // ── Clipping plane (sweeps left → right) ──
        const sweepPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), X_MIN);

        // ── Function curve (Line2) ──
        const curvePts: number[] = [];
        const SAMPLES = 1000;
        for (let i = 0; i <= SAMPLES; i++) {
            const x = X_MIN + (X_MAX - X_MIN) * i / SAMPLES;
            const y = evalSafe(compiled, x, variable);
            const cy = isFinite(y) ? Math.max(yMin - 5, Math.min(yMax + 5, y)) : NaN;
            if (isNaN(cy)) { curvePts.push(x, yMid, 0); continue; }
            curvePts.push(x, cy, 0);
        }
        const curveGeo = new LineGeometry(); curveGeo.setPositions(curvePts);
        const curveMat = new LineMaterial({
            color: COLORS.curve, linewidth: 3, worldUnits: false,
            alphaToCoverage: true, clippingPlanes: [sweepPlane],
        });
        curveMat.resolution.set(w, h);
        const curveLine = new Line2(curveGeo, curveMat);
        scene.add(curveLine);

        // ── Tracer sphere ──
        const tracerGeo = new THREE.SphereGeometry(0.2, 16, 16);
        const tracerMat = new THREE.MeshBasicMaterial({ color: COLORS.tracer });
        const tracer = new THREE.Mesh(tracerGeo, tracerMat);
        scene.add(tracer);

        setLoading(false);

        // ── Animation ──
        const clock = new THREE.Clock();
        let animFrame = 0;
        const DURATION = 10.0;

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

            // Sweep clipping plane
            const sweepX = X_MIN + (X_MAX - X_MIN) * progress;
            sweepPlane.constant = X_MIN + (X_MAX - X_MIN) * progress;

            // Move tracer
            const ty = evalSafe(compiled, sweepX, variable);
            if (isFinite(ty)) {
                tracer.position.set(sweepX, Math.max(yMin - 5, Math.min(yMax + 5, ty)), 0);
                tracer.visible = true;
            } else { tracer.visible = false; }

            // Floating label
            if (labelRef.current && isFinite(ty)) {
                const p = tracer.position.clone().project(camera);
                const px = (p.x * 0.5 + 0.5) * window.innerWidth;
                const py = (-p.y * 0.5 + 0.5) * window.innerHeight;
                labelRef.current.style.transform = `translate(${px + 15}px, ${py - 20}px)`;
                labelRef.current.style.opacity = '1';
                labelRef.current.innerHTML =
                    `<span style="color:#3b82f6">f(${sweepX.toFixed(2)})</span> = <b>${ty.toFixed(4)}</b>`;
            }

            // Camera sweep
            if (stateRef.current.autoTracking) {
                const lookX = sweepX * 0.6;
                const angle = -Math.PI / 2 + progress * Math.PI * 0.3;
                const camDist = 22;
                const camX = lookX + Math.sin(angle) * 3;
                const camY = yMid + ySpan * 0.2 + Math.sin(progress * Math.PI) * ySpan * 0.3;
                const camZ = camDist - progress * 3;
                camera.position.lerp(new THREE.Vector3(camX, camY, camZ), 0.03);
                controls.target.lerp(new THREE.Vector3(lookX, yMid, 0), 0.03);
            }

            renderer.render(scene, camera);
        };
        animate();

        const onResize = () => {
            const nw = window.innerWidth, nh = window.innerHeight;
            camera.aspect = nw / nh;
            camera.updateProjectionMatrix();
            renderer.setSize(nw, nh);
            curveMat.resolution.set(nw, nh);
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('resize', onResize);
        window.addEventListener('keydown', onKey);

        return () => {
            cancelAnimationFrame(animFrame);
            window.removeEventListener('resize', onResize);
            window.removeEventListener('keydown', onKey);
            renderer.dispose();
            if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
        };
    }, [expr, variable, onClose]);

    // ── Controls ──
    const handleTogglePause = () => { stateRef.current.paused = !stateRef.current.paused; setIsPaused(stateRef.current.paused); };
    const handleReplay = () => {
        stateRef.current.time = 0; stateRef.current.finished = false; stateRef.current.paused = false;
        setIsFinished(false); setIsPaused(false);
    };
    const handleToggleTracking = () => { stateRef.current.autoTracking = !stateRef.current.autoTracking; setIsAutoTracking(stateRef.current.autoTracking); };

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

            {/* Tracer label */}
            <div ref={labelRef} style={{
                position: 'absolute', top: 0, left: 0,
                background: 'rgba(0,0,0,0.85)', border: '1px solid #3b82f6', borderRadius: 6,
                padding: '6px 10px', fontSize: '0.85rem', fontFamily: 'monospace',
                pointerEvents: 'none', whiteSpace: 'nowrap', opacity: 0,
                color: '#fff',
            }} />

            {/* Header */}
            <div style={{ position: 'absolute', top: 24, left: 32, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: '#3b82f6' }}>
                    Curve Tracer
                </span>
                <span style={{ fontFamily: 'monospace', fontSize: '1.4rem', color: '#fff' }}>
                    f({variable}) = {expr}
                </span>
                <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                    <span style={{ color: '#3b82f6', fontSize: '0.85rem', fontWeight: 600 }}>── Function</span>
                    <span style={{ color: '#ffffff', fontSize: '0.85rem', fontWeight: 600 }}>● Tracer</span>
                </div>
            </div>

            {/* Close */}
            <button onClick={onClose} style={{
                position: 'absolute', top: 24, right: 32, width: 44, height: 44,
                borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(0,0,0,0.8)', color: '#fff', fontSize: '1.2rem', cursor: 'pointer',
            }}>✕</button>

            {/* Control Bar */}
            {!loading && (
                <div style={{
                    position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)',
                    display: 'flex', gap: 12, background: 'rgba(0,0,0,0.8)', padding: '8px',
                    borderRadius: 12, border: '1px solid #27272a', backdropFilter: 'blur(8px)',
                }}>
                    <button onClick={isFinished ? handleReplay : handleTogglePause} style={{
                        padding: '10px 24px', borderRadius: 8, border: 'none',
                        background: isFinished ? '#3b82f6' : (isPaused ? '#10b981' : '#3f3f46'),
                        color: '#fff', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer',
                        fontFamily: 'system-ui', minWidth: 120,
                    }}>
                        {isFinished ? '↺ Replay' : (isPaused ? '▶ Resume' : '⏸ Pause')}
                    </button>
                    <button onClick={handleToggleTracking} style={{
                        padding: '10px 24px', borderRadius: 8, border: '1px solid #3f3f46',
                        background: isAutoTracking ? '#1e1e24' : 'transparent',
                        color: isAutoTracking ? '#3b82f6' : '#a1a1aa',
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
