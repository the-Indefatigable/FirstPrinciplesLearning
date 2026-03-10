import { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { compile, type EvalFunction } from 'mathjs';

/* ─── Props ─── */
interface Immersive3DProps {
    expr: string;
    mode: 'derivative' | 'integral';
    variable: string;
    onClose: () => void;
}

/* ─── Safe math eval ─── */
const evalSafe = (fn: EvalFunction, x: number, v: string): number => {
    try { return Number(fn.evaluate({ [v]: x, e: Math.E, pi: Math.PI })); }
    catch { return NaN; }
};

const numDeriv = (fn: EvalFunction, x: number, v: string) => {
    const h = 1e-5;
    return (evalSafe(fn, x + h, v) - evalSafe(fn, x - h, v)) / (2 * h);
};

/* ─── Solid Color palette ─── */
const COLORS = {
    bg: 0x050508,
    curve: 0x0ea5e9,     // Flat Sky Blue
    deriv: 0x10b981,     // Flat Emerald Green
    integral: 0xf59e0b,  // Flat Amber
    tangent: 0xef4444,   // Flat Red
    tracer: 0xffffff,    // White
    grid: 0x27272a,      // Visible gray grid
    gridSub: 0x18181b,
    axisLabel: '#a1a1aa' // Text color
};

/* ─── Text Sprite Generator for Axis Numbers ─── */
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

/* ─── Build a fat Line2 ─── */
function buildLine(points: number[], color: number, linewidth = 4, dashed = false): Line2 {
    const geo = new LineGeometry();
    geo.setPositions(points);
    const mat = new LineMaterial({
        color, linewidth, worldUnits: false, dashed,
        dashScale: dashed ? 3 : 1, dashSize: dashed ? 0.5 : 1, gapSize: dashed ? 0.3 : 0,
        resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
        transparent: true, opacity: 1.0
    });
    const line = new Line2(geo, mat);
    if (dashed) line.computeLineDistances();
    return line;
}

export default function Immersive3DMode({ expr, mode, variable, onClose }: Immersive3DProps) {
    const mountRef = useRef<HTMLDivElement>(null);
    const labelFRef = useRef<HTMLDivElement>(null);
    const labelDRef = useRef<HTMLDivElement>(null);
    
    // UI State
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    const [isAutoTracking, setIsAutoTracking] = useState(true); // NEW: Tracks camera mode
    
    // Mutable refs for the animation loop
    const stateRef = useRef({ time: 0, paused: false, finished: false, autoTracking: true });

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
        camera.position.set(0, 5, 45);

        // ── Controls ──
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        
        // Disable auto-tracking when user interacts, BUT do not pause the math!
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
            const xSprite = createTextSprite(i.toString());
            xSprite.position.set(i, -0.6, 0);
            scene.add(xSprite);

            const ySprite = createTextSprite(i.toString());
            ySprite.position.set(-0.6, i, 0);
            scene.add(ySprite);
        }

        // ── Math Calculations ──
        const SAMPLES = 1000; 
        const xMin = -10, xMax = 10;
        const fPoints: number[] = [];
        const dPoints: number[] = [];
        let maxY = 0; 

        for (let i = 0; i <= SAMPLES; i++) {
            const x = xMin + (xMax - xMin) * (i / SAMPLES);
            const y = evalSafe(compiled, x, variable);
            const dy = numDeriv(compiled, x, variable);
            
            const clampedY = isFinite(y) ? Math.max(-30, Math.min(30, y)) : 0;
            const clampedDy = isFinite(dy) ? Math.max(-30, Math.min(30, dy)) : 0;
            
            if (Math.abs(x) < 8) maxY = Math.max(maxY, Math.abs(clampedY), Math.abs(clampedDy));

            fPoints.push(x, clampedY, 0);
            dPoints.push(x, clampedDy, 0);
        }

        const fCurve = buildLine(fPoints, COLORS.curve, 4);
        scene.add(fCurve);

        const dCurveGeo = new LineGeometry();
        dCurveGeo.setPositions([xMin, 0, 0, xMin, 0, 0]); 
        const dCurveMat = new LineMaterial({ color: COLORS.deriv, linewidth: 5, resolution: new THREE.Vector2(w, h) });
        const dCurve = new Line2(dCurveGeo, dCurveMat);
        scene.add(dCurve);

        const tGeo = new LineGeometry();
        tGeo.setPositions([-1, 0, 0, 1, 0, 0]);
        const tMat = new LineMaterial({ color: COLORS.tangent, linewidth: 3, dashed: true, resolution: new THREE.Vector2(w, h) });
        const tangentLine = new Line2(tGeo, tMat);
        scene.add(tangentLine);

        const tracerGeo = new LineGeometry();
        tracerGeo.setPositions([0,0,0, 0,0,0]);
        const tracerMat = new LineMaterial({ color: COLORS.tracer, linewidth: 1.5, dashed: true, resolution: new THREE.Vector2(w, h), transparent: true, opacity: 0.5 });
        const tracerLine = new Line2(tracerGeo, tracerMat);
        scene.add(tracerLine);

        const dotGeo = new THREE.SphereGeometry(0.2, 16, 16);
        const fDot = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: COLORS.tangent }));
        const dDot = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: COLORS.deriv }));
        scene.add(fDot, dDot);

        setLoading(false);

        // ── Animation Loop ──
        const clock = new THREE.Clock();
        let animFrame = 0;
        const DURATION = 14.0;

        const animate = () => {
            animFrame = requestAnimationFrame(animate);
            const delta = clock.getDelta();
            controls.update();

            // Progress time only if not explicitly paused by the user
            if (!stateRef.current.paused && !stateRef.current.finished) {
                stateRef.current.time += delta;
                if (stateRef.current.time >= DURATION) {
                    stateRef.current.time = DURATION;
                    stateRef.current.finished = true;
                    setIsFinished(true);
                }
            }

            const progress = stateRef.current.time / DURATION;
            const currentIdx = Math.floor(progress * SAMPLES);
            const sweepX = xMin + (xMax - xMin) * progress;
            const fY = evalSafe(compiled, sweepX, variable);
            const slope = numDeriv(compiled, sweepX, variable);

            if (isFinite(fY) && isFinite(slope)) {
                const currentDPoints = dPoints.slice(0, (currentIdx + 1) * 3);
                if (currentDPoints.length > 3) {
                    dCurve.geometry.dispose();
                    const newGeo = new LineGeometry();
                    newGeo.setPositions(currentDPoints);
                    dCurve.geometry = newGeo;
                }

                const clampedFY = Math.max(-30, Math.min(30, fY));
                const clampedSlope = Math.max(-30, Math.min(30, slope));

                fDot.position.set(sweepX, clampedFY, 0);
                dDot.position.set(sweepX, clampedSlope, 0);

                const tLen = 3;
                const dx = tLen / Math.sqrt(1 + slope * slope);
                const dy = slope * dx;
                tangentLine.geometry.dispose();
                const newTGeo = new LineGeometry();
                newTGeo.setPositions([sweepX - dx, clampedFY - dy, 0, sweepX + dx, clampedFY + dy, 0]);
                tangentLine.geometry = newTGeo;
                tangentLine.computeLineDistances();

                tracerLine.geometry.dispose();
                const newTracerGeo = new LineGeometry();
                newTracerGeo.setPositions([sweepX, clampedFY, 0, sweepX, clampedSlope, 0]);
                tracerLine.geometry = newTracerGeo;
                tracerLine.computeLineDistances();

                // Smart Drone Camera (Only runs if AutoTracking is ON)
                if (stateRef.current.autoTracking) {
                    const targetCamX = sweepX * 0.4; 
                    const targetCamY = (clampedFY + clampedSlope) / 4; 
                    const targetCamZ = Math.max(25, Math.min(maxY * 1.5, 45)); 
                    
                    camera.position.lerp(new THREE.Vector3(targetCamX, targetCamY, targetCamZ), 0.04);
                    controls.target.lerp(new THREE.Vector3(targetCamX, targetCamY, 0), 0.04);
                }

                const projectLabel = (mesh: THREE.Mesh, ref: React.RefObject<HTMLDivElement>) => {
                    if (!ref.current) return;
                    const vector = new THREE.Vector3();
                    mesh.getWorldPosition(vector);
                    vector.project(camera);
                    const x = (vector.x * .5 + .5) * window.innerWidth;
                    const y = (vector.y * -.5 + .5) * window.innerHeight;
                    ref.current.style.transform = `translate(-50%, -100%) translate(${x}px, ${y - 20}px)`;
                    ref.current.style.opacity = vector.z > 1 ? '0' : '1';
                };

                projectLabel(fDot, labelFRef);
                projectLabel(dDot, labelDRef);
                
                if (labelFRef.current) labelFRef.current.innerHTML = `<span style="color:#0ea5e9">f(${sweepX.toFixed(1)})</span> = <b style="color:#fff">${fY.toFixed(2)}</b>`;
                if (labelDRef.current) labelDRef.current.innerHTML = `Slope = <b style="color:#10b981">${slope.toFixed(2)}</b>`;
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
            (dCurve.material as LineMaterial).resolution = res;
            (tangentLine.material as LineMaterial).resolution = res;
            (tracerLine.material as LineMaterial).resolution = res;
            (axisMat as LineMaterial).resolution = res;
        };
        window.addEventListener('resize', onResize);
        window.addEventListener('keydown', (e) => { if (e.key === 'Escape') onClose(); });

        return () => {
            cancelAnimationFrame(animFrame);
            window.removeEventListener('resize', onResize);
            renderer.dispose();
            if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
        };
    }, [expr, variable, onClose]);

    // ── UI Controls Handlers ──
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
        return (
            <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#050508', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', flexDirection: 'column', gap: 16 }}>
                <h2>Math Error</h2>
                <button onClick={onClose} style={{ padding: '8px 16px', background: '#333', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Close</button>
            </div>
        );
    }

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#050508', overflow: 'hidden' }}>
            <div ref={mountRef} style={{ width: '100%', height: '100%', position: 'absolute', inset: 0, cursor: 'grab' }} />

            {/* Labels */}
            <div ref={labelFRef} style={{
                position: 'absolute', top: 0, left: 0,
                background: 'rgba(0,0,0,0.85)', border: '1px solid #0ea5e9', borderRadius: 6,
                padding: '6px 10px', fontSize: '0.85rem', fontFamily: 'monospace',
                pointerEvents: 'none', whiteSpace: 'nowrap',
            }} />
            
            <div ref={labelDRef} style={{
                position: 'absolute', top: 0, left: 0,
                background: 'rgba(0,0,0,0.85)', border: '1px solid #10b981', borderRadius: 6,
                padding: '6px 10px', fontSize: '0.85rem', fontFamily: 'monospace', color: '#ccc',
                pointerEvents: 'none', whiteSpace: 'nowrap',
            }} />

            {/* Header / Legend */}
            <div style={{ position: 'absolute', top: 24, left: 32, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: '#0ea5e9' }}>
                    Interactive 3D Sketch
                </span>
                <span style={{ fontFamily: 'monospace', fontSize: '1.4rem', color: '#fff' }}>
                    f({variable}) = {expr}
                </span>
                <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                    <span style={{ color: '#0ea5e9', fontSize: '0.85rem', fontWeight: 600 }}>── Original Curve</span>
                    <span style={{ color: '#10b981', fontSize: '0.85rem', fontWeight: 600 }}>── Derivative Curve</span>
                </div>
            </div>

            <button onClick={onClose} style={{ position: 'absolute', top: 24, right: 32, width: 44, height: 44, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.8)', color: '#fff', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>

            {/* ── Control Bar (Play/Pause/Replay/Tracker) ── */}
            {!loading && (
                <div style={{
                    position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)',
                    display: 'flex', gap: 12, background: 'rgba(0,0,0,0.8)', padding: '8px', 
                    borderRadius: 12, border: '1px solid #27272a', backdropFilter: 'blur(8px)'
                }}>
                    <button onClick={isFinished ? handleReplay : handleTogglePause} style={{
                        padding: '10px 24px', borderRadius: 8, border: 'none',
                        background: isFinished ? '#0ea5e9' : (isPaused ? '#10b981' : '#3f3f46'),
                        color: '#fff', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer',
                        fontFamily: 'system-ui', minWidth: 120
                    }}>
                        {isFinished ? '↺ Replay' : (isPaused ? '▶ Resume' : '⏸ Pause')}
                    </button>

                    <button onClick={handleToggleTracking} style={{
                        padding: '10px 24px', borderRadius: 8, border: '1px solid #3f3f46',
                        background: isAutoTracking ? '#1e1e24' : 'transparent',
                        color: isAutoTracking ? '#0ea5e9' : '#a1a1aa', 
                        fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
                        fontFamily: 'system-ui', minWidth: 160, transition: 'all 0.2s'
                    }}>
                        {isAutoTracking ? '🎯 Auto-Tracking' : '🎥 Free Camera'}
                    </button>
                </div>
            )}
        </div>
    );
}
