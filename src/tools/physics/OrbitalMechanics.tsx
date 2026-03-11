/**
 * OrbitalMechanics.tsx — Two-Body Gravitational Problem (Gold Standard)
 *
 * Split layout:
 *   LEFT  — KaTeX equations, parameter sliders, perspective toggle, live readouts
 *   RIGHT — Canvas2D simulation with trails, dual-perspective (Side / CoM frame)
 */

import React, { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import { useUrlState } from '../../hooks/useUrlState';
import Tex from '../../components/tool/Tex';
import ToolLayoutSplit from '../../components/tool/ToolLayoutSplit';
import { useIsDark } from '../../hooks/useTheme';

/* ─── Lazy 3D import ─── */
const TwoBodyImmersive = React.lazy(() => import('./TwoBodyImmersive'));

/* ─── Custom Hook for Pan & Zoom ─── */
function usePanZoom(initialZoom = 1, ref: React.RefObject<any>) {
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(initialZoom);
    const isDragging = useRef(false);
    const lastPos = useRef({ x: 0, y: 0 });

    const onPointerDown = useCallback((e: React.PointerEvent) => {
        isDragging.current = true;
        lastPos.current = { x: e.clientX, y: e.clientY };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }, []);

    const onPointerMove = useCallback((e: React.PointerEvent) => {
        if (!isDragging.current) return;
        const dx = e.clientX - lastPos.current.x;
        const dy = e.clientY - lastPos.current.y;
        setOffset(o => ({ x: o.x + dx, y: o.y + dy }));
        lastPos.current = { x: e.clientX, y: e.clientY };
    }, []);

    const onPointerUp = useCallback((e: React.PointerEvent) => {
        isDragging.current = false;
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    }, []);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const onWheel = (e: WheelEvent) => {
            e.preventDefault(); // Stop entire page from scrolling/zooming!
            setZoom(z => {
                const newZoom = z * (1 - e.deltaY * 0.002);
                return Math.max(0.1, Math.min(newZoom, 10)); // clamp zoom
            });
        };
        // MUST be non-passive to allow preventDefault
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, [ref]);

    return { offset, setOffset, zoom, setZoom, handlers: { onPointerDown, onPointerMove, onPointerUp } };
}

/* ─── Types ─── */
type Perspective = 'side' | 'com';

interface SimState {
    x1: number; y1: number; vx1: number; vy1: number;
    x2: number; y2: number; vx2: number; vy2: number;
    trail1: { x: number; y: number }[];
    trail2: { x: number; y: number }[];
}

/* ─── Physics helpers ─── */
function initialState(m1: number, m2: number, sep: number, vTan: number): SimState {
    // Place bodies along x-axis, CoM at origin
    const totalM = m1 + m2;
    const x1 = -(m2 / totalM) * sep;
    const x2 = (m1 / totalM) * sep;
    // Tangential velocity perpendicular to separation (y-direction), scaled by mass
    const vy1 = (m2 / totalM) * vTan;
    const vy2 = -(m1 / totalM) * vTan;
    return {
        x1, y1: 0, vx1: 0, vy1,
        x2, y2: 0, vx2: 0, vy2,
        trail1: [], trail2: [],
    };
}

function stepPhysics(s: SimState, m1: number, m2: number, G: number, dt: number): void {
    const dx = s.x2 - s.x1;
    const dy = s.y2 - s.y1;
    const rSq = Math.max(dx * dx + dy * dy, 4); // softened
    const r = Math.sqrt(rSq);
    const F = G * m1 * m2 / rSq;
    const fx = F * dx / r;
    const fy = F * dy / r;

    // Accelerations
    const ax1 = fx / m1, ay1 = fy / m1;
    const ax2 = -fx / m2, ay2 = -fy / m2;

    // Velocity Verlet (half-step kick-drift-kick)
    s.vx1 += ax1 * dt; s.vy1 += ay1 * dt;
    s.vx2 += ax2 * dt; s.vy2 += ay2 * dt;
    s.x1 += s.vx1 * dt; s.y1 += s.vy1 * dt;
    s.x2 += s.vx2 * dt; s.y2 += s.vy2 * dt;
}

function computeOrbitalParams(s: SimState, m1: number, m2: number, G: number) {
    const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
    const r = Math.sqrt(dx * dx + dy * dy);
    const dvx = s.vx2 - s.vx1, dvy = s.vy2 - s.vy1;
    const vRel = Math.sqrt(dvx * dvx + dvy * dvy);
    const mu = (m1 * m2) / (m1 + m2); // reduced mass
    const M = m1 + m2;

    // Kinetic energy of relative motion
    const KE = 0.5 * mu * vRel * vRel;
    // Potential energy
    const PE = -G * m1 * m2 / r;
    const E = KE + PE;

    // Angular momentum of relative motion (2D: L = μ * (r × v)_z )
    const L = mu * (dx * dvy - dy * dvx);

    // Semi-major axis (if bound)
    const a = E < 0 ? -G * m1 * m2 / (2 * E) : Infinity;
    // Orbital period (Kepler's 3rd)
    const T = isFinite(a) && a > 0 ? 2 * Math.PI * Math.sqrt(a * a * a / (G * M)) : Infinity;

    return { r, E, L, mu, a, T, KE, PE };
}

/* ─── Constants ─── */
const MAX_TRAIL = 600;
const DT = 0.015;
const STEPS_PER_FRAME = 4;

/* ═══════════════════════════════════════════════
   ═══ Canvas Renderer
   ═══════════════════════════════════════════════ */
function SimCanvas({
    m1, m2, sep, vTan, G, perspective, running, onOrbitalUpdate,
    simRef, frameRef,
}: {
    m1: number; m2: number; sep: number; vTan: number; G: number;
    perspective: Perspective; running: boolean;
    onOrbitalUpdate: (params: ReturnType<typeof computeOrbitalParams>) => void;
    simRef: React.MutableRefObject<SimState>;
    frameRef: React.MutableRefObject<number>;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const isDark = useIsDark();

    const { offset, zoom, handlers, setOffset, setZoom } = usePanZoom(1, canvasRef);

    // Reset pan/zoom on perspective change
    useEffect(() => {
        setOffset({ x: 0, y: 0 });
        setZoom(1);
    }, [perspective, setOffset, setZoom]);

    useEffect(() => {
        const container = containerRef.current;
        const canvas = canvasRef.current;
        if (!container || !canvas) return;

        let trailCounter = 0;
        let orbitalCounter = 0;

        const paint = () => {
            const W = container.clientWidth;
            const H = container.clientHeight;
            if (W === 0 || H === 0) return;
            const dpr = window.devicePixelRatio || 1;
            const bw = Math.round(W * dpr), bh = Math.round(H * dpr);
            if (canvas.width !== bw || canvas.height !== bh) {
                canvas.width = bw; canvas.height = bh;
            }
            const ctx = canvas.getContext('2d')!;
            ctx.setTransform(1, 0, 0, 1, 0, 0);

            // Background
            ctx.fillStyle = isDark ? '#0a0a0c' : '#f4f4f5';
            ctx.fillRect(0, 0, bw + 2, bh + 2);
            ctx.scale(dpr, dpr);

            const s = simRef.current;

            // Physics steps
            if (running) {
                for (let i = 0; i < STEPS_PER_FRAME; i++) {
                    stepPhysics(s, m1, m2, G, DT);
                }

                // Trails
                trailCounter++;
                if (trailCounter % 2 === 0) {
                    s.trail1.push({ x: s.x1, y: s.y1 });
                    s.trail2.push({ x: s.x2, y: s.y2 });
                    if (s.trail1.length > MAX_TRAIL) s.trail1.shift();
                    if (s.trail2.length > MAX_TRAIL) s.trail2.shift();
                }

                // Orbital params (throttled)
                orbitalCounter++;
                if (orbitalCounter % 15 === 0) {
                    onOrbitalUpdate(computeOrbitalParams(s, m1, m2, G));
                }
            }

            // Compute center of mass
            const totalM = m1 + m2;
            const comX = (m1 * s.x1 + m2 * s.x2) / totalM;
            const comY = (m1 * s.y1 + m2 * s.y2) / totalM;

            // View transform: world → screen
            // Base scale: fit separation comfortably. Then apply user zoom.
            const baseScale = Math.min(W, H) / (sep * 4.5);
            const viewScale = baseScale * zoom;

            // Screen center + user pan offset
            const cx = W / 2 + offset.x, cy = H / 2 + offset.y;

            const offsetX = perspective === 'com' ? comX : 0;
            const offsetY = perspective === 'com' ? comY : 0;

            const toSx = (wx: number) => cx + (wx - offsetX) * viewScale;
            const toSy = (wy: number) => cy - (wy - offsetY) * viewScale;

            // ── Stars (dark mode) ──
            if (isDark) {
                ctx.fillStyle = '#27272a';
                for (let i = 0; i < 80; i++) {
                    const sx = ((i * 137.5 + 23) % W);
                    const sy = ((i * 97.3 + 11) % H);
                    ctx.fillRect(sx, sy, 1, 1);
                }
            }

            // ── Grid ──
            ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)';
            ctx.lineWidth = 1;
            const gridSpacing = viewScale * (sep > 100 ? 50 : sep > 20 ? 10 : 5);
            if (gridSpacing > 15) {
                ctx.beginPath();
                for (let gx = cx % gridSpacing; gx < W; gx += gridSpacing) {
                    ctx.moveTo(gx, 0); ctx.lineTo(gx, H);
                }
                for (let gy = cy % gridSpacing; gy < H; gy += gridSpacing) {
                    ctx.moveTo(0, gy); ctx.lineTo(W, gy);
                }
                ctx.stroke();
            }

            // ── Center of Mass crosshair ──
            const comSx = toSx(comX), comSy = toSy(comY);
            ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(comSx - 12, comSy); ctx.lineTo(comSx + 12, comSy);
            ctx.moveTo(comSx, comSy - 12); ctx.lineTo(comSx, comSy + 12);
            ctx.stroke();
            ctx.setLineDash([]);

            // ── CoM label ──
            ctx.font = '10px system-ui, sans-serif';
            ctx.fillStyle = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)';
            ctx.textAlign = 'left';
            ctx.fillText('CoM', comSx + 14, comSy - 4);

            // ── Trails ──
            const drawTrail = (trail: { x: number; y: number }[], color: string) => {
                if (trail.length < 2) return;
                for (let i = 1; i < trail.length; i++) {
                    const alpha = (i / trail.length) * 0.6;
                    ctx.strokeStyle = color + Math.round(alpha * 255).toString(16).padStart(2, '0');
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(toSx(trail[i - 1].x), toSy(trail[i - 1].y));
                    ctx.lineTo(toSx(trail[i].x), toSy(trail[i].y));
                    ctx.stroke();
                }
            };
            drawTrail(s.trail1, '#f59e0b');
            drawTrail(s.trail2, '#3b82f6');

            // ── Connecting line ──
            ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
            ctx.lineWidth = 1;
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.moveTo(toSx(s.x1), toSy(s.y1));
            ctx.lineTo(toSx(s.x2), toSy(s.y2));
            ctx.stroke();
            ctx.setLineDash([]);

            // ── Bodies ──
            const r1 = Math.max(6, Math.min(20, Math.pow(m1, 0.33) * 3));
            const r2 = Math.max(6, Math.min(20, Math.pow(m2, 0.33) * 3));

            const drawBody = (wx: number, wy: number, radius: number, color: string, label: string) => {
                const sx = toSx(wx), sy = toSy(wy);

                // Glow
                const grad = ctx.createRadialGradient(sx, sy, radius * 0.3, sx, sy, radius * 3);
                grad.addColorStop(0, color + '40');
                grad.addColorStop(1, color + '00');
                ctx.beginPath();
                ctx.arc(sx, sy, radius * 3, 0, Math.PI * 2);
                ctx.fillStyle = grad;
                ctx.fill();

                // Body
                ctx.beginPath();
                ctx.arc(sx, sy, radius, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();

                // Specular
                ctx.beginPath();
                ctx.arc(sx - radius * 0.25, sy - radius * 0.25, radius * 0.35, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255,255,255,0.3)';
                ctx.fill();

                // Label
                ctx.font = 'bold 11px system-ui, sans-serif';
                ctx.fillStyle = isDark ? '#e4e4e7' : '#3f3f46';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillText(label, sx, sy - radius - 6);
            };

            drawBody(s.x1, s.y1, r1, '#f59e0b', `m₁`);
            drawBody(s.x2, s.y2, r2, '#3b82f6', `m₂`);

            // ── Velocity vectors ──
            const vScale = viewScale * 1.5;
            const drawVelocity = (wx: number, wy: number, vx: number, vy: number, color: string) => {
                const sx = toSx(wx), sy = toSy(wy);
                const ex = sx + vx * vScale, ey = sy - vy * vScale;
                const len = Math.sqrt((ex - sx) ** 2 + (ey - sy) ** 2);
                if (len < 3) return;
                ctx.strokeStyle = color;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(sx, sy);
                ctx.lineTo(ex, ey);
                ctx.stroke();
                // Arrowhead
                const ux = (ex - sx) / len, uy = (ey - sy) / len;
                ctx.beginPath();
                ctx.moveTo(ex, ey);
                ctx.lineTo(ex - ux * 7 + uy * 3, ey - uy * 7 - ux * 3);
                ctx.lineTo(ex - ux * 7 - uy * 3, ey - uy * 7 + ux * 3);
                ctx.fillStyle = color;
                ctx.fill();
            };

            drawVelocity(s.x1, s.y1, s.vx1, s.vy1, '#fbbf24');
            drawVelocity(s.x2, s.y2, s.vx2, s.vy2, '#60a5fa');

            // ── HUD ──
            ctx.font = '11px JetBrains Mono, monospace';
            ctx.fillStyle = isDark ? '#52525b' : '#a1a1aa';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(`Frame: ${perspective === 'com' ? 'Center-of-Mass' : 'Lab (Side View)'}`, 14, 14);

            frameRef.current = requestAnimationFrame(paint);
        };

        paint();

        const ro = new ResizeObserver(() => {
            cancelAnimationFrame(frameRef.current);
            frameRef.current = requestAnimationFrame(paint);
        });
        ro.observe(container);

        return () => {
            cancelAnimationFrame(frameRef.current);
            ro.disconnect();
        };
    }, [m1, m2, sep, vTan, G, perspective, running, isDark, onOrbitalUpdate, simRef, frameRef, offset, zoom]);

    return (
        <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
            <canvas
                ref={canvasRef}
                {...handlers}
                style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none', cursor: 'grab' }}
            />
        </div>
    );
}


/* ═══════════════════════════════════════════════
   ═══ Main Component
   ═══════════════════════════════════════════════ */
export default function OrbitalMechanics() {
    const [urlState, setUrlState] = useUrlState('2bp', {
        m1: 40, m2: 10, sep: 80, vTan: 3.0, G: 50,
        perspective: 'side' as Perspective,
    });
    const { m1, m2, sep, vTan, G, perspective } = urlState;

    const set = <K extends keyof typeof urlState>(k: K, v: (typeof urlState)[K]) =>
        setUrlState(s => ({ ...s, [k]: v }));

    const isDark = useIsDark();
    const [running, setRunning] = useState(true);
    const [showImmersive, setShowImmersive] = useState(false);
    const [orbital, setOrbital] = useState<ReturnType<typeof computeOrbitalParams> | null>(null);

    const simRef = useRef<SimState>(initialState(m1, m2, sep, vTan));
    const frameRef = useRef(0);

    // Reset simulation when parameters change
    const resetSim = useCallback(() => {
        simRef.current = initialState(m1, m2, sep, vTan);
        setOrbital(null);
    }, [m1, m2, sep, vTan]);

    // Auto-reset on param change
    useEffect(() => { resetSim(); }, [resetSim]);

    const handleOrbitalUpdate = useCallback((params: ReturnType<typeof computeOrbitalParams>) => {
        setOrbital(params);
    }, []);

    const borderC = isDark ? '#27272a' : '#e4e4e7';
    const textDim = isDark ? '#9ca3af' : '#6b7280';
    const accent = '#3b82f6';
    const accentGlow = isDark ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.06)';
    const warmAccent = '#f59e0b';
    const warmGlow = isDark ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.06)';
    const inputBg = isDark ? '#18181b' : '#f3f4f6';

    /* ---- Sidebar ---- */
    const sidebar = (
        <>
            {/* ── Perspective Toggle ── */}
            <div style={{
                display: 'flex', borderRadius: 8, overflow: 'hidden',
                border: `1px solid ${borderC}`,
            }}>
                {(['side', 'com'] as Perspective[]).map(p => (
                    <button key={p} onClick={() => set('perspective', p)} style={{
                        flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer',
                        fontFamily: 'system-ui', fontWeight: 700, fontSize: '0.85rem',
                        letterSpacing: 1, textTransform: 'uppercase',
                        background: perspective === p ? (p === 'side' ? warmGlow : accentGlow) : 'transparent',
                        color: perspective === p ? (p === 'side' ? warmAccent : accent) : textDim,
                        transition: 'all 0.15s',
                        borderBottom: perspective === p
                            ? `2px solid ${p === 'side' ? warmAccent : accent}`
                            : '2px solid transparent',
                    }}>
                        {p === 'side' ? '🔭 Side View' : '⊕ CoM Frame'}
                    </button>
                ))}
            </div>

            {/* ── Governing Equations ── */}
            <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: textDim }}>
                Governing Equations
            </div>

            <div style={{
                padding: '14px 16px', background: inputBg, borderRadius: 10,
                border: `1px solid ${borderC}`, display: 'flex', flexDirection: 'column', gap: 12,
            }}>
                <div>
                    <span style={{ fontSize: '0.7rem', color: textDim, fontWeight: 600 }}>Newton's Gravitation</span>
                    <div style={{ marginTop: 4 }}>
                        <Tex math="F = \frac{G\,m_1\,m_2}{r^2}" display />
                    </div>
                </div>

                <div style={{ borderTop: `1px solid ${borderC}`, paddingTop: 10 }}>
                    <span style={{ fontSize: '0.7rem', color: textDim, fontWeight: 600 }}>Equations of Motion</span>
                    <div style={{ marginTop: 4 }}>
                        <Tex math="m_1\,\ddot{\mathbf{r}}_1 = +\frac{G\,m_1\,m_2}{r^2}\,\hat{r}" display />
                    </div>
                    <div style={{ marginTop: 4 }}>
                        <Tex math="m_2\,\ddot{\mathbf{r}}_2 = -\frac{G\,m_1\,m_2}{r^2}\,\hat{r}" display />
                    </div>
                </div>

                <div style={{ borderTop: `1px solid ${borderC}`, paddingTop: 10 }}>
                    <span style={{ fontSize: '0.7rem', color: textDim, fontWeight: 600 }}>Reduced to One-Body</span>
                    <div style={{ marginTop: 4 }}>
                        <Tex math="\mu = \frac{m_1 m_2}{m_1 + m_2}" display />
                    </div>
                    <div style={{ marginTop: 4 }}>
                        <Tex math="\mu\,\ddot{\mathbf{r}} = -\frac{G\,m_1\,m_2}{r^2}\,\hat{r}" display />
                    </div>
                </div>

                <div style={{ borderTop: `1px solid ${borderC}`, paddingTop: 10 }}>
                    <span style={{ fontSize: '0.7rem', color: textDim, fontWeight: 600 }}>Conserved Quantities</span>
                    <div style={{ marginTop: 4 }}>
                        <Tex math="E = \frac{1}{2}\mu v_{\text{rel}}^2 - \frac{G\,m_1 m_2}{r}" display />
                    </div>
                    <div style={{ marginTop: 4 }}>
                        <Tex math="L = \mu\,(\mathbf{r} \times \mathbf{v}_{\text{rel}})_z" display />
                    </div>
                </div>
            </div>

            {/* ── Parameters ── */}
            <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: textDim }}>
                Parameters
            </div>

            {/* m1 */}
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#f59e0b' }}>
                        m₁ (mass)
                    </span>
                    <span style={{
                        background: warmGlow, color: warmAccent,
                        padding: '2px 10px', borderRadius: 6,
                        fontWeight: 700, fontSize: '0.85rem', fontFamily: 'monospace',
                        border: `1px solid ${isDark ? 'rgba(245,158,11,0.2)' : 'rgba(245,158,11,0.15)'}`,
                    }}>{m1}</span>
                </div>
                <input type="range" min={1} max={100} value={m1}
                    onChange={e => set('m1', +e.target.value)}
                    style={{ width: '100%', accentColor: warmAccent }} />
            </div>

            {/* m2 */}
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#3b82f6' }}>
                        m₂ (mass)
                    </span>
                    <span style={{
                        background: accentGlow, color: accent,
                        padding: '2px 10px', borderRadius: 6,
                        fontWeight: 700, fontSize: '0.85rem', fontFamily: 'monospace',
                        border: `1px solid ${isDark ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.15)'}`,
                    }}>{m2}</span>
                </div>
                <input type="range" min={1} max={100} value={m2}
                    onChange={e => set('m2', +e.target.value)}
                    style={{ width: '100%', accentColor: accent }} />
            </div>

            {/* Separation */}
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: textDim }}>
                        Initial Separation
                    </span>
                    <span style={{
                        background: inputBg, color: isDark ? '#e4e4e7' : '#3f3f46',
                        padding: '2px 10px', borderRadius: 6,
                        fontWeight: 700, fontSize: '0.85rem', fontFamily: 'monospace',
                        border: `1px solid ${borderC}`,
                    }}>{sep}</span>
                </div>
                <input type="range" min={20} max={200} value={sep}
                    onChange={e => set('sep', +e.target.value)}
                    style={{ width: '100%', accentColor: isDark ? '#a1a1aa' : '#71717a' }} />
            </div>

            {/* Tangential Velocity */}
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: textDim }}>
                        Tangential Velocity
                    </span>
                    <span style={{
                        background: inputBg, color: isDark ? '#e4e4e7' : '#3f3f46',
                        padding: '2px 10px', borderRadius: 6,
                        fontWeight: 700, fontSize: '0.85rem', fontFamily: 'monospace',
                        border: `1px solid ${borderC}`,
                    }}>{vTan.toFixed(1)}</span>
                </div>
                <input type="range" min={0} max={80} step={0.5} value={vTan}
                    onChange={e => set('vTan', +e.target.value)}
                    style={{ width: '100%', accentColor: isDark ? '#a1a1aa' : '#71717a' }} />
            </div>

            {/* G */}
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#10b981' }}>
                        G (gravitational constant)
                    </span>
                    <span style={{
                        background: isDark ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.06)',
                        color: '#10b981',
                        padding: '2px 10px', borderRadius: 6,
                        fontWeight: 700, fontSize: '0.85rem', fontFamily: 'monospace',
                        border: `1px solid ${isDark ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.15)'}`,
                    }}>{G}</span>
                </div>
                <input type="range" min={1} max={200} value={G}
                    onChange={e => set('G', +e.target.value)}
                    style={{ width: '100%', accentColor: '#10b981' }} />
            </div>

            {/* ── Live Readouts ── */}
            {orbital && (
                <>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: textDim }}>
                        Live Orbital Data
                    </div>

                    <div style={{
                        padding: '12px 16px', background: inputBg, borderRadius: 10,
                        border: `1px solid ${borderC}`, fontFamily: 'monospace', fontSize: '0.82rem',
                        lineHeight: 1.8, color: isDark ? '#d4d4d8' : '#3f3f46',
                    }}>
                        <div>
                            <span style={{ color: textDim }}>μ </span>
                            <span style={{ fontWeight: 700 }}>= {orbital.mu.toFixed(2)}</span>
                        </div>
                        <div>
                            <span style={{ color: textDim }}>r </span>
                            <span style={{ fontWeight: 700 }}>= {orbital.r.toFixed(2)}</span>
                        </div>
                        <div>
                            <span style={{ color: orbital.E < 0 ? '#10b981' : '#ef4444' }}>E </span>
                            <span style={{ fontWeight: 700, color: orbital.E < 0 ? '#10b981' : '#ef4444' }}>
                                = {orbital.E.toFixed(2)}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: textDim, marginLeft: 6 }}>
                                {orbital.E < 0 ? '(bound)' : '(unbound)'}
                            </span>
                        </div>
                        <div>
                            <span style={{ color: textDim }}>L </span>
                            <span style={{ fontWeight: 700 }}>= {orbital.L.toFixed(2)}</span>
                        </div>
                        {isFinite(orbital.T) && orbital.T > 0 && (
                            <div>
                                <span style={{ color: textDim }}>T </span>
                                <span style={{ fontWeight: 700 }}>= {orbital.T.toFixed(2)}</span>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* ── Playback controls ── */}
            <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setRunning(r => !r)} style={{
                    flex: 1, padding: '10px 14px', borderRadius: 8, border: 'none',
                    background: running ? (isDark ? '#3f3f46' : '#e4e4e7') : '#10b981',
                    color: running ? (isDark ? '#d4d4d8' : '#3f3f46') : '#fff',
                    fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'system-ui',
                    transition: 'all 0.15s',
                }}>
                    {running ? '⏸ Pause' : '▶ Resume'}
                </button>
                <button onClick={resetSim} style={{
                    flex: 1, padding: '10px 14px', borderRadius: 8,
                    border: `1px solid ${borderC}`, background: 'transparent',
                    color: textDim, fontWeight: 700, fontSize: '0.85rem',
                    cursor: 'pointer', fontFamily: 'system-ui', transition: 'all 0.15s',
                }}>
                    ↺ Reset
                </button>
            </div>

            {/* ── Immersive 3D button ── */}
            <button onClick={() => setShowImmersive(true)} style={{
                width: '100%', padding: '10px 14px',
                border: `1px solid ${isDark ? 'rgba(245,158,11,0.25)' : 'rgba(200,120,0,0.2)'}`,
                borderRadius: 8,
                background: isDark ? 'rgba(245,158,11,0.06)' : 'rgba(245,158,11,0.04)',
                color: isDark ? '#fbbf24' : '#b45309',
                fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                fontFamily: 'system-ui', letterSpacing: 0.3, transition: 'all 0.15s',
            }}>
                🌌 Immersive 3D
            </button>

            {/* ── Tips ── */}
            <div style={{
                padding: '12px 16px', fontSize: '0.82rem',
                color: textDim, lineHeight: 1.6,
                background: inputBg, borderRadius: 8,
                border: `1px solid ${borderC}`,
            }}>
                Adjust masses and velocity to create elliptical, circular, or hyperbolic orbits.
                Switch to <strong>CoM Frame</strong> to see the reduced one-body equivalent.
                {' '}Energy {'<'} 0 = bound orbit.
            </div>
        </>
    );

    const canvas = (
        <>
            <SimCanvas
                m1={m1} m2={m2} sep={sep} vTan={vTan} G={G}
                perspective={perspective} running={running}
                onOrbitalUpdate={handleOrbitalUpdate}
                simRef={simRef} frameRef={frameRef}
            />

            {showImmersive && (
                <Suspense fallback={
                    <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: '#030308', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(245,158,11,0.6)', fontSize: '1rem', letterSpacing: 2 }}>
                        Loading Immersive Simulation…
                    </div>
                }>
                    <TwoBodyImmersive
                        m1={m1} m2={m2} sep={sep} vTan={vTan} G={G}
                        onClose={() => setShowImmersive(false)}
                    />
                </Suspense>
            )}
        </>
    );

    return (
        <ToolLayoutSplit>
            {[sidebar, canvas]}
        </ToolLayoutSplit>
    );
}
