import { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { compile, type EvalFunction } from 'mathjs';

/* ─── Props ─── */
interface Integration3DProps {
    expr: string;
    variable: string;
    lowerBound: number;
    upperBound: number;
    subdivisions: number;
    method: string;
    onClose: () => void;
}

/* ─── Safe math eval ─── */
const evalSafe = (fn: EvalFunction, x: number, v: string): number => {
    try { return Number(fn.evaluate({ [v]: x, e: Math.E, pi: Math.PI })); }
    catch { return NaN; }
};

/* ─── Flat Color palette (matching Immersive3DMode) ─── */
const COLORS = {
    bg: 0x050508,
    curve: 0x0ea5e9,
    box: 0xf59e0b,
    boxEdge: 0xd97706,
    bound: 0x10b981,
    grid: 0x27272a,
    gridSub: 0x18181b,
    axisLabel: '#a1a1aa',
};

/* ─── Text Sprite ─── */
function createTextSprite(text: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.font = 'bold 28px monospace';
    ctx.fillStyle = COLORS.axisLabel;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 64, 32);

    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(1.5, 0.75, 1);
    return sprite;
}

/* ─── Build a Line2 ─── */
function buildLine(points: number[], color: number, linewidth = 4): Line2 {
    const geo = new LineGeometry();
    geo.setPositions(points);
    const mat = new LineMaterial({
        color, linewidth, worldUnits: false,
        resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
        transparent: true, opacity: 1.0,
    });
    return new Line2(geo, mat);
}

/* ─── Riemann sample point for a method ─── */
function sampleX(method: string, x0: number, x1: number): number {
    if (method === 'right') return x1;
    if (method === 'midpoint') return (x0 + x1) / 2;
    return x0; // left (default)
}

export default function Integration3DMode({
    expr, variable, lowerBound: a, upperBound: b,
    subdivisions: n, method, onClose,
}: Integration3DProps) {
    const mountRef = useRef<HTMLDivElement>(null);
    const labelRef = useRef<HTMLDivElement>(null);
    const totalRef = useRef<HTMLDivElement>(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    const [isAutoTracking, setIsAutoTracking] = useState(true);

    const stateRef = useRef({ time: 0, paused: false, finished: false, autoTracking: true });

    // Native fullscreen on mount
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
        renderer.setClearColor(COLORS.bg);
        container.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 500);
        // Position camera to see the integration region
        const midX = (a + b) / 2;
        camera.position.set(midX, 5, Math.max(25, (b - a) * 3));

        // ── Controls ──
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.target.set(midX, 0, 0);
        controls.addEventListener('start', () => {
            if (stateRef.current.autoTracking) {
                stateRef.current.autoTracking = false;
                setIsAutoTracking(false);
            }
        });

        // ── Grid & Axes ──
        const grid = new THREE.GridHelper(40, 40, COLORS.grid, COLORS.gridSub);
        grid.position.y = -0.05;
        scene.add(grid);

        const axisGeo = new LineGeometry();
        axisGeo.setPositions([-20, 0, 0, 20, 0, 0, 0, -20, 0, 0, 20, 0]);
        const axisMat = new LineMaterial({ color: 0x555566, linewidth: 2, resolution: new THREE.Vector2(w, h) });
        scene.add(new Line2(axisGeo, axisMat));

        for (let i = -10; i <= 10; i += 2) {
            if (i === 0) continue;
            const xs = createTextSprite(i.toString());
            xs.position.set(i, -0.6, 0);
            scene.add(xs);
            const ys = createTextSprite(i.toString());
            ys.position.set(-0.6, i, 0);
            scene.add(ys);
        }

        // ── Main function curve ──
        const SAMPLES = 1000;
        const xMin = a - (b - a) * 0.3;
        const xMax = b + (b - a) * 0.3;
        const curvePts: number[] = [];
        for (let i = 0; i <= SAMPLES; i++) {
            const x = xMin + (xMax - xMin) * (i / SAMPLES);
            const y = evalSafe(compiled, x, variable);
            curvePts.push(x, isFinite(y) ? Math.max(-30, Math.min(30, y)) : 0, 0);
        }
        const fCurve = buildLine(curvePts, COLORS.curve, 4);
        scene.add(fCurve);

        // ── Bound markers (dashed vertical lines at a and b) ──
        const boundPts = (bx: number) => [bx, -10, 0, bx, 10, 0];
        const bLineA = buildLine(boundPts(a), COLORS.bound, 2);
        const bLineB = buildLine(boundPts(b), COLORS.bound, 2);
        scene.add(bLineA, bLineB);

        // ── Pre-compute Riemann rectangle data ──
        const dx = (b - a) / n;
        const isTrapezoid = method === 'trapezoid';
        const isSimpson = method === 'simpson';

        interface RectData { x0: number; x1: number; height: number; area: number }
        const rects: RectData[] = [];

        if (isSimpson && n % 2 !== 0) {
            // Simpson's needs even N — fall back to midpoint for visualization
            for (let i = 0; i < n; i++) {
                const x0 = a + i * dx;
                const x1 = x0 + dx;
                const sx = (x0 + x1) / 2;
                const hv = evalSafe(compiled, sx, variable);
                const ch = isFinite(hv) ? Math.max(-30, Math.min(30, hv)) : 0;
                rects.push({ x0, x1, height: ch, area: ch * dx });
            }
        } else if (isSimpson) {
            // Group into pairs for Simpson's — visualize as rectangles with parabolic area
            for (let i = 0; i < n; i += 2) {
                const x0 = a + i * dx;
                const x1 = x0 + dx;
                const x2 = x0 + 2 * dx;
                const y0 = evalSafe(compiled, x0, variable);
                const y1 = evalSafe(compiled, x1, variable);
                const y2 = evalSafe(compiled, x2, variable);
                const a0 = isFinite(y0) ? y0 : 0;
                const a1 = isFinite(y1) ? y1 : 0;
                const a2 = isFinite(y2) ? y2 : 0;
                const area = (dx / 3) * (a0 + 4 * a1 + a2);
                const avgH = area / (2 * dx);
                rects.push({ x0, x1: x2, height: Math.max(-30, Math.min(30, avgH)), area });
            }
        } else if (isTrapezoid) {
            for (let i = 0; i < n; i++) {
                const x0 = a + i * dx;
                const x1 = x0 + dx;
                const y0 = evalSafe(compiled, x0, variable);
                const y1 = evalSafe(compiled, x1, variable);
                const a0 = isFinite(y0) ? y0 : 0;
                const a1 = isFinite(y1) ? y1 : 0;
                const area = (a0 + a1) * dx / 2;
                const avgH = (a0 + a1) / 2;
                rects.push({ x0, x1, height: Math.max(-30, Math.min(30, avgH)), area });
            }
        } else {
            // Left / Right / Midpoint
            for (let i = 0; i < n; i++) {
                const x0 = a + i * dx;
                const x1 = x0 + dx;
                const sx0 = sampleX(method, x0, x1);
                const hv = evalSafe(compiled, sx0, variable);
                const ch = isFinite(hv) ? Math.max(-30, Math.min(30, hv)) : 0;
                rects.push({ x0, x1, height: ch, area: ch * dx });
            }
        }

        // ── Create 3D box meshes (initially scaled to 0 on Y) ──
        const boxMat = new THREE.MeshBasicMaterial({
            color: COLORS.box, transparent: true, opacity: 0.4,
            side: THREE.DoubleSide,
        });
        const edgeMat = new THREE.LineBasicMaterial({ color: COLORS.boxEdge, transparent: true, opacity: 0.8 });

        const boxGroups: THREE.Group[] = [];
        for (const r of rects) {
            const w = r.x1 - r.x0;
            const geo = new THREE.BoxGeometry(w, 1, w * 0.4);
            const mesh = new THREE.Mesh(geo, boxMat.clone());
            const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat);

            const group = new THREE.Group();
            group.add(mesh, edges);
            const cx = (r.x0 + r.x1) / 2;
            group.position.set(cx, 0, 0);
            group.scale.set(1, 0.001, 1); // start invisible
            scene.add(group);
            boxGroups.push(group);
        }

        setLoading(false);

        // ── Animation loop ──
        const clock = new THREE.Clock();
        let animFrame = 0;
        const DURATION = 6.0 + n * 0.15; // scale duration with subdivisions

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
            let runningTotal = 0;
            let activeIdx = -1;
            let activeArea = 0;

            // Animate boxes rising progressively
            for (let i = 0; i < rects.length; i++) {
                const boxStart = i / rects.length;
                const boxEnd = (i + 0.8) / rects.length;
                const t = Math.max(0, Math.min(1, (progress - boxStart) / (boxEnd - boxStart)));

                if (t > 0) {
                    const h = rects[i].height;
                    const absH = Math.abs(h);
                    const scaleY = absH < 0.001 ? 0.001 : t * absH;
                    boxGroups[i].scale.set(1, scaleY, 1);
                    boxGroups[i].position.y = h >= 0 ? scaleY / 2 : -scaleY / 2;

                    // Update material opacity based on reveal
                    const mesh = boxGroups[i].children[0] as THREE.Mesh;
                    (mesh.material as THREE.MeshBasicMaterial).opacity = 0.15 + t * 0.35;

                    runningTotal += rects[i].area;

                    if (t < 1) {
                        activeIdx = i;
                        activeArea = rects[i].area;
                    }
                }
            }

            // ── Smart Drone Camera ──
            if (stateRef.current.autoTracking) {
                const sweepIdx = Math.min(Math.floor(progress * rects.length), rects.length - 1);
                const focusX = sweepIdx >= 0 ? (rects[sweepIdx].x0 + rects[sweepIdx].x1) / 2 : midX;
                const focusY = sweepIdx >= 0 ? Math.abs(rects[sweepIdx].height) / 2 : 0;
                const camZ = Math.max(20, (b - a) * 2.5);

                camera.position.lerp(new THREE.Vector3(focusX * 0.6, focusY + 3, camZ), 0.04);
                controls.target.lerp(new THREE.Vector3(focusX * 0.6, focusY, 0), 0.04);
            }

            // ── Floating label (current rectangle area) ──
            if (labelRef.current) {
                if (activeIdx >= 0 && activeIdx < boxGroups.length) {
                    const pos = new THREE.Vector3();
                    boxGroups[activeIdx].getWorldPosition(pos);
                    pos.y += Math.abs(rects[activeIdx].height) + 0.5;
                    pos.project(camera);
                    const sx = (pos.x * 0.5 + 0.5) * window.innerWidth;
                    const sy = (pos.y * -0.5 + 0.5) * window.innerHeight;
                    labelRef.current.style.transform = `translate(-50%, -100%) translate(${sx}px, ${sy - 10}px)`;
                    labelRef.current.style.opacity = pos.z > 1 ? '0' : '1';
                    labelRef.current.innerHTML = `<span style="color:#f59e0b">Rectangle ${activeIdx + 1}</span><br/>Area ≈ <b style="color:#fff">${activeArea.toFixed(4)}</b>`;
                } else {
                    labelRef.current.style.opacity = '0';
                }
            }

            // ── Running total overlay ──
            if (totalRef.current) {
                totalRef.current.textContent = `Σ ≈ ${runningTotal.toFixed(5)}`;
            }

            renderer.render(scene, camera);
        };

        animate();

        const onResize = () => {
            const width = window.innerWidth, height = window.innerHeight;
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
            const res = new THREE.Vector2(width, height);
            (fCurve.material as LineMaterial).resolution = res;
            (bLineA.material as LineMaterial).resolution = res;
            (bLineB.material as LineMaterial).resolution = res;
            (axisMat as LineMaterial).resolution = res;
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
    }, [expr, variable, a, b, n, method, onClose]);

    // ── UI Control Handlers ──
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
            document.body
        );
    }

    const methodLabel = method.charAt(0).toUpperCase() + method.slice(1);

    return createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, background: '#050508', overflow: 'hidden' }}>
            <div ref={mountRef} style={{ width: '100%', height: '100%', position: 'absolute', inset: 0, cursor: 'grab' }} />

            {/* ── Floating rectangle label ── */}
            <div ref={labelRef} style={{
                position: 'absolute', top: 0, left: 0,
                background: 'rgba(0,0,0,0.85)', border: '1px solid #f59e0b', borderRadius: 6,
                padding: '6px 10px', fontSize: '0.85rem', fontFamily: 'monospace',
                pointerEvents: 'none', whiteSpace: 'nowrap', lineHeight: 1.5,
                opacity: 0,
            }} />

            {/* ── Header / Legend ── */}
            <div style={{ position: 'absolute', top: 24, left: 32, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: '#f59e0b' }}>
                    3D Riemann Sum — {methodLabel}
                </span>
                <span style={{ fontFamily: 'monospace', fontSize: '1.4rem', color: '#fff' }}>
                    ∫ f({variable}) = {expr}
                </span>
                <span style={{ fontFamily: 'monospace', fontSize: '0.9rem', color: '#a1a1aa' }}>
                    [{a}, {b}] · N = {n}
                </span>
                <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                    <span style={{ color: '#0ea5e9', fontSize: '0.85rem', fontWeight: 600 }}>── f(x) Curve</span>
                    <span style={{ color: '#f59e0b', fontSize: '0.85rem', fontWeight: 600 }}>██ Rectangles</span>
                    <span style={{ color: '#10b981', fontSize: '0.85rem', fontWeight: 600 }}>│ Bounds</span>
                </div>

                {/* Running total */}
                <div ref={totalRef} style={{
                    marginTop: 12, fontFamily: 'monospace', fontSize: '1.6rem', fontWeight: 700,
                    color: '#f59e0b', textShadow: '0 0 12px rgba(245,158,11,0.3)',
                }}>
                    Σ ≈ 0
                </div>
            </div>

            {/* ── Close button ── */}
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
                        background: isFinished ? '#f59e0b' : (isPaused ? '#10b981' : '#3f3f46'),
                        color: '#fff', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer',
                        fontFamily: 'system-ui', minWidth: 120,
                    }}>
                        {isFinished ? '↺ Replay' : (isPaused ? '▶ Resume' : '⏸ Pause')}
                    </button>

                    <button onClick={handleToggleTracking} style={{
                        padding: '10px 24px', borderRadius: 8, border: '1px solid #3f3f46',
                        background: isAutoTracking ? '#1e1e24' : 'transparent',
                        color: isAutoTracking ? '#f59e0b' : '#a1a1aa',
                        fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
                        fontFamily: 'system-ui', minWidth: 160, transition: 'all 0.2s',
                    }}>
                        {isAutoTracking ? '🎯 Auto-Tracking' : '🎥 Free Camera'}
                    </button>
                </div>
            )}
        </div>,
        document.body
    );
}
