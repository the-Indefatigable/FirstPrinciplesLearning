import React, { useRef, useState, useEffect, useCallback } from 'react';

/* ═══════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════ */
type Kind = 'laser' | 'mirror' | 'lens';

interface Elem {
    id: string;
    kind: Kind;
    x: number;
    y: number;
    angle: number;        // orientation (radians) — the direction the surface faces
    halfLen: number;      // half the visual length of the element (px)
    focalLength?: number; // only for lenses (px, positive = converging)
}

interface V2 { x: number; y: number; }

/* ═══════════════════════════════════════════════════════════════════════
   VECTOR HELPERS
   ═══════════════════════════════════════════════════════════════════════ */
const v2 = (x: number, y: number): V2 => ({ x, y });
const vadd = (a: V2, b: V2): V2 => v2(a.x + b.x, a.y + b.y);
const vsub = (a: V2, b: V2): V2 => v2(a.x - b.x, a.y - b.y);
const vscale = (v: V2, s: number): V2 => v2(v.x * s, v.y * s);
const vdot = (a: V2, b: V2) => a.x * b.x + a.y * b.y;
const vlen = (v: V2) => Math.hypot(v.x, v.y);
const vnorm = (v: V2): V2 => { const l = vlen(v); return l > 1e-12 ? v2(v.x / l, v.y / l) : v2(0, 0); };
const vperp = (v: V2): V2 => v2(-v.y, v.x); // 90° CCW

/** Reflect direction d across surface normal n (n must be unit). */
const vreflect = (d: V2, n: V2): V2 => vsub(d, vscale(n, 2 * vdot(d, n)));

/* ═══════════════════════════════════════════════════════════════════════
   RAY–LINE-SEGMENT INTERSECTION
   Given ray origin P, unit direction D,
   and segment endpoints A→B,
   find parametric t ≥ minT along the ray that hits the segment (u ∈ [0,1]).
   ═══════════════════════════════════════════════════════════════════════ */
function raySegment(
    P: V2, D: V2, A: V2, B: V2, minT = 1
): { t: number; point: V2; u: number } | null {
    // Ray:  P + t·D
    // Seg:  A + u·(B−A)
    const S = vsub(B, A);
    const denom = D.x * S.y - D.y * S.x;
    if (Math.abs(denom) < 1e-10) return null;  // parallel

    const PA = vsub(A, P);
    const t = (PA.x * S.y - PA.y * S.x) / denom;
    const u = (PA.x * D.y - PA.y * D.x) / denom;

    if (t < minT || u < 0 || u > 1) return null;
    return { t, point: vadd(P, vscale(D, t)), u };
}

/* ═══════════════════════════════════════════════════════════════════════
   GET ELEMENT ENDPOINTS  (surface line segment)
   ═══════════════════════════════════════════════════════════════════════ */
function elemEndpoints(el: Elem): [V2, V2] {
    const along = v2(Math.cos(el.angle), Math.sin(el.angle));
    return [
        vsub(el, vscale(along, el.halfLen)),
        vadd(el, vscale(along, el.halfLen)),
    ];
}

/* ═══════════════════════════════════════════════════════════════════════
   RAY TRACE ENGINE
   ═══════════════════════════════════════════════════════════════════════ */
interface RaySegment { from: V2; to: V2 }
interface AngleInfo {
    point: V2;
    normalAngle: number;   // angle of the outward-facing normal (radians)
    incAngle: number;       // angle of incidence (radians, measured from normal)
    incRayAngle: number;    // global angle of the incoming ray
    refRayAngle: number;    // global angle of the reflected ray
}

function traceRays(
    origin: V2, dir: V2, elements: Elem[], maxBounce: number
): { segments: RaySegment[]; angles: AngleInfo[] } {
    const segments: RaySegment[] = [];
    const angles: AngleInfo[] = [];
    const FAR = 5000;

    let P = { ...origin };
    let D = vnorm(dir);
    let lastHitId: string | null = null;

    for (let i = 0; i <= maxBounce; i++) {
        // Find closest intersection with any non-laser element
        let best: { t: number; point: V2; el: Elem; u: number } | null = null;

        for (const el of elements) {
            if (el.kind === 'laser') continue;
            if (el.id === lastHitId) continue; // skip the element we just bounced off

            const [A, B] = elemEndpoints(el);
            const hit = raySegment(P, D, A, B, 1); // minT=1 pixel to avoid self-hit
            if (hit && (!best || hit.t < best.t)) {
                best = { t: hit.t, point: hit.point, el, u: hit.u };
            }
        }

        if (!best) {
            // Ray escapes to infinity
            segments.push({ from: P, to: vadd(P, vscale(D, FAR)) });
            break;
        }

        segments.push({ from: P, to: best.point });

        const el = best.el;
        const along = v2(Math.cos(el.angle), Math.sin(el.angle));
        // Surface normal = perpendicular to the surface direction
        let N = vnorm(vperp(along));
        // Flip normal to face the incoming ray (i.e., dot(N, D) < 0)
        if (vdot(N, D) > 0) N = vscale(N, -1);

        // Angle of incidence = angle between incoming ray and normal
        const cosInc = Math.abs(vdot(vnorm(vscale(D, -1)), N));
        const incAngle = Math.acos(Math.min(1, Math.max(-1, cosInc)));

        if (el.kind === 'mirror') {
            // === SPECULAR REFLECTION ===
            const Drefl = vreflect(D, N);

            angles.push({
                point: best.point,
                normalAngle: Math.atan2(N.y, N.x),
                incAngle,
                incRayAngle: Math.atan2(D.y, D.x),
                refRayAngle: Math.atan2(Drefl.y, Drefl.x),
            });

            D = vnorm(Drefl);
            P = vadd(best.point, vscale(D, 0.5));
            lastHitId = el.id;
            continue;
        }

        if (el.kind === 'lens') {
            // === THIN LENS REFRACTION ===
            // h = signed distance from center along the lens surface
            const toHit = vsub(best.point, el);
            const h = vdot(toHit, along);
            const f = el.focalLength ?? 200;

            // Thin lens: the ray deflects so that a parallel ray would converge at F.
            // Deflection angle ≈ −h / f (paraxial approximation)
            const deflect = Math.atan2(-h, f);

            // Rotate the direction vector by the deflection
            const c = Math.cos(deflect), s = Math.sin(deflect);
            D = vnorm(v2(D.x * c - D.y * s, D.x * s + D.y * c));

            P = vadd(best.point, vscale(D, 0.5));
            lastHitId = el.id;
            continue;
        }
    }

    return { segments, angles };
}

/* ═══════════════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════════════ */
let _nextId = 100;

export default function RayOptics() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const boxRef = useRef<HTMLDivElement>(null);

    const [elements, setElements] = useState<Elem[]>([
        { id: 'L1', kind: 'laser', x: 80, y: 300, angle: 0, halfLen: 22 },
        { id: 'M1', kind: 'mirror', x: 550, y: 300, angle: Math.PI * 3 / 4, halfLen: 70 },
        { id: 'M2', kind: 'mirror', x: 550, y: 500, angle: Math.PI / 4, halfLen: 70 },
        { id: 'N1', kind: 'lens', x: 300, y: 300, angle: Math.PI / 2, halfLen: 70, focalLength: 250 },
    ]);

    const [selId, setSelId] = useState<string | null>(null);
    const dragRef = useRef<{ id: string; ox: number; oy: number } | null>(null);

    /* ── Draw ──────────────────────────────────────────────────────────── */
    const paint = useCallback(() => {
        const cvs = canvasRef.current;
        const box = boxRef.current;
        if (!cvs || !box) return;
        const ctx = cvs.getContext('2d');
        if (!ctx) return;

        const r = box.getBoundingClientRect();
        const dpr = window.devicePixelRatio;
        cvs.width = r.width * dpr;
        cvs.height = r.height * dpr;
        ctx.scale(dpr, dpr);
        cvs.style.width = `${r.width}px`;
        cvs.style.height = `${r.height}px`;
        const W = r.width, H = r.height;

        const dark = document.documentElement.getAttribute('data-theme') === 'dark';
        const COL = {
            bg: dark ? '#1a1612' : '#faf8f5',
            grid: dark ? '#242018' : '#ece6da',
            txt: dark ? '#e8e4de' : '#1a1612',
            dim: dark ? '#6b6358' : '#9c9488',
            mirror: dark ? '#a3c4a8' : '#6b8f71',
            lens: dark ? 'rgba(96,165,250,0.45)' : 'rgba(59,130,246,0.3)',
            lensStk: dark ? '#60a5fa' : '#3b82f6',
            beam: '#ef4444',
            angle: '#f59e0b',
        };

        // ── background + grid ──
        ctx.fillStyle = COL.bg;
        ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = COL.grid;
        ctx.lineWidth = 0.5;
        for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
        for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

        // ── trace every laser ──
        const traces: ReturnType<typeof traceRays>[] = [];
        for (const el of elements) {
            if (el.kind !== 'laser') continue;
            const d = v2(Math.cos(el.angle), Math.sin(el.angle));
            const o = vadd(el, vscale(d, 24));
            traces.push(traceRays(o, d, elements, 16));
        }

        // ── draw beams ──
        for (const tr of traces) {
            // glow
            ctx.save();
            ctx.strokeStyle = COL.beam;
            ctx.lineWidth = 7;
            ctx.globalAlpha = 0.08;
            for (const s of tr.segments) { ctx.beginPath(); ctx.moveTo(s.from.x, s.from.y); ctx.lineTo(s.to.x, s.to.y); ctx.stroke(); }
            // core
            ctx.lineWidth = 2.5;
            ctx.globalAlpha = 0.9;
            ctx.lineCap = 'round';
            for (const s of tr.segments) { ctx.beginPath(); ctx.moveTo(s.from.x, s.from.y); ctx.lineTo(s.to.x, s.to.y); ctx.stroke(); }
            ctx.restore();
        }

        // ── draw angle annotations ──
        for (const tr of traces) {
            for (const a of tr.angles) {
                const ARC = 32; // arc radius
                const nA = a.normalAngle;
                const incDeg = Math.round(a.incAngle * 180 / Math.PI * 10) / 10;

                // --- dashed normal line ---
                ctx.save();
                ctx.strokeStyle = COL.dim;
                ctx.lineWidth = 1;
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.moveTo(a.point.x - Math.cos(nA) * 55, a.point.y - Math.sin(nA) * 55);
                ctx.lineTo(a.point.x + Math.cos(nA) * 55, a.point.y + Math.sin(nA) * 55);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.restore();

                // The incoming ray angle and the reflected ray angle
                // We want arcs from the normal direction sweeping to the ray direction
                const inAngle = a.incRayAngle + Math.PI; // reverse the incoming direction for the arc
                const outAngle = a.refRayAngle;

                // --- incidence arc (blue-ish) ---
                ctx.save();
                ctx.strokeStyle = '#60a5fa';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                // Arc from normal angle to incoming ray (reversed) direction
                const incStart = Math.min(nA, inAngle);
                const incEnd = Math.max(nA, inAngle);
                // We need the smaller arc. Check if the arc crosses and adjust.
                let iStart = nA, iEnd = inAngle;
                let iDiff = iEnd - iStart;
                // Normalize to [-π, π]
                while (iDiff > Math.PI) iDiff -= 2 * Math.PI;
                while (iDiff < -Math.PI) iDiff += 2 * Math.PI;
                if (iDiff > 0) {
                    ctx.arc(a.point.x, a.point.y, ARC, iStart, iStart + iDiff);
                } else {
                    ctx.arc(a.point.x, a.point.y, ARC, iStart + iDiff, iStart);
                }
                ctx.stroke();

                // filled wedge for incidence
                ctx.fillStyle = 'rgba(96,165,250,0.12)';
                ctx.beginPath();
                ctx.moveTo(a.point.x, a.point.y);
                if (iDiff > 0) {
                    ctx.arc(a.point.x, a.point.y, ARC, iStart, iStart + iDiff);
                } else {
                    ctx.arc(a.point.x, a.point.y, ARC, iStart + iDiff, iStart);
                }
                ctx.closePath();
                ctx.fill();
                ctx.restore();

                // --- reflection arc (amber) ---
                ctx.save();
                ctx.strokeStyle = COL.angle;
                ctx.lineWidth = 1.5;
                let rStart = nA, rEnd = outAngle;
                let rDiff = rEnd - rStart;
                while (rDiff > Math.PI) rDiff -= 2 * Math.PI;
                while (rDiff < -Math.PI) rDiff += 2 * Math.PI;
                ctx.beginPath();
                if (rDiff > 0) {
                    ctx.arc(a.point.x, a.point.y, ARC - 2, rStart, rStart + rDiff);
                } else {
                    ctx.arc(a.point.x, a.point.y, ARC - 2, rStart + rDiff, rStart);
                }
                ctx.stroke();

                // filled wedge for reflection
                ctx.fillStyle = 'rgba(245,158,11,0.12)';
                ctx.beginPath();
                ctx.moveTo(a.point.x, a.point.y);
                if (rDiff > 0) {
                    ctx.arc(a.point.x, a.point.y, ARC - 2, rStart, rStart + rDiff);
                } else {
                    ctx.arc(a.point.x, a.point.y, ARC - 2, rStart + rDiff, rStart);
                }
                ctx.closePath();
                ctx.fill();
                ctx.restore();

                // --- angle labels ---
                // Place labels near the midpoint of each arc
                const incMid = nA + iDiff / 2;
                const refMid = nA + rDiff / 2;

                ctx.font = 'bold 11px Sora, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                // θᵢ label
                ctx.fillStyle = '#60a5fa';
                ctx.fillText(
                    `θᵢ=${incDeg}°`,
                    a.point.x + Math.cos(incMid) * (ARC + 18),
                    a.point.y + Math.sin(incMid) * (ARC + 18)
                );

                // θᵣ label
                ctx.fillStyle = COL.angle;
                ctx.fillText(
                    `θᵣ=${incDeg}°`,
                    a.point.x + Math.cos(refMid) * (ARC + 18),
                    a.point.y + Math.sin(refMid) * (ARC + 18)
                );

                // hit-point dot
                ctx.fillStyle = COL.angle;
                ctx.beginPath();
                ctx.arc(a.point.x, a.point.y, 4, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // ── draw elements ──
        for (const el of elements) {
            ctx.save();
            ctx.translate(el.x, el.y);
            ctx.rotate(el.angle);

            if (el.kind === 'laser') {
                ctx.fillStyle = dark ? '#3d3530' : '#374151';
                ctx.beginPath();
                ctx.roundRect(-24, -13, 48, 26, 4);
                ctx.fill();
                ctx.fillStyle = COL.beam;
                ctx.beginPath();
                ctx.roundRect(20, -5, 8, 10, [0, 3, 3, 0]);
                ctx.fill();
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 7px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('LASER', -2, 0);
            }

            if (el.kind === 'mirror') {
                // reflective surface
                ctx.strokeStyle = COL.mirror;
                ctx.lineWidth = 5;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(0, -el.halfLen);
                ctx.lineTo(0, el.halfLen);
                ctx.stroke();

                // hatch marks (back side)
                ctx.strokeStyle = dark ? '#4a6050' : '#8fb897';
                ctx.lineWidth = 1.2;
                for (let h = -el.halfLen + 8; h <= el.halfLen - 8; h += 10) {
                    ctx.beginPath();
                    ctx.moveTo(0, h);
                    ctx.lineTo(-7, h + 7);
                    ctx.stroke();
                }
            }

            if (el.kind === 'lens') {
                const lh = el.halfLen;
                const bulge = 16;
                ctx.fillStyle = COL.lens;
                ctx.strokeStyle = COL.lensStk;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(0, -lh);
                ctx.quadraticCurveTo(bulge, 0, 0, lh);
                ctx.quadraticCurveTo(-bulge, 0, 0, -lh);
                ctx.fill();
                ctx.stroke();

                // focal point dots
                const f = el.focalLength ?? 200;
                ctx.fillStyle = COL.angle;
                for (const side of [-1, 1]) {
                    ctx.beginPath();
                    ctx.arc(side * f, 0, 3.5, 0, Math.PI * 2);
                    ctx.fill();
                }
                // F labels
                ctx.font = 'bold 9px Sora, sans-serif';
                ctx.fillStyle = COL.angle;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.fillText('F', -f, 6);
                ctx.fillText("F'", f, 6);

                // optical axis
                ctx.strokeStyle = COL.dim;
                ctx.lineWidth = 0.7;
                ctx.setLineDash([3, 3]);
                ctx.beginPath();
                const axLen = Math.min(f * 1.4, 300);
                ctx.moveTo(-axLen, 0);
                ctx.lineTo(axLen, 0);
                ctx.stroke();
                ctx.setLineDash([]);
            }

            // selection ring
            if (selId === el.id) {
                ctx.strokeStyle = COL.angle;
                ctx.lineWidth = 1.5;
                ctx.setLineDash([5, 4]);
                const sz = Math.max(el.halfLen + 12, 30);
                ctx.strokeRect(-14, -sz, 28, sz * 2);
                ctx.setLineDash([]);
            }

            ctx.restore();
        }

        ctx.textBaseline = 'alphabetic';
    }, [elements, selId]);

    useEffect(() => { paint(); }, [paint]);

    /* ── pointer interaction ──────────────────────────────────────────── */
    const pos = (e: React.MouseEvent | React.TouchEvent): V2 => {
        const cr = canvasRef.current!.getBoundingClientRect();
        const cx = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const cy = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
        return v2(cx - cr.left, cy - cr.top);
    };

    const onDown = (e: React.MouseEvent | React.TouchEvent) => {
        const p = pos(e);
        for (let i = elements.length - 1; i >= 0; i--) {
            const el = elements[i];
            if (Math.hypot(p.x - el.x, p.y - el.y) < el.halfLen + 20) {
                setSelId(el.id);
                dragRef.current = { id: el.id, ox: p.x - el.x, oy: p.y - el.y };
                return;
            }
        }
        setSelId(null);
    };

    const onMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!dragRef.current) return;
        const p = pos(e);
        setElements(prev => prev.map(el =>
            el.id === dragRef.current!.id
                ? { ...el, x: p.x - dragRef.current!.ox, y: p.y - dragRef.current!.oy }
                : el
        ));
    };

    const onUp = useCallback(() => { dragRef.current = null; }, []);
    useEffect(() => {
        window.addEventListener('mouseup', onUp);
        window.addEventListener('touchend', onUp);
        return () => { window.removeEventListener('mouseup', onUp); window.removeEventListener('touchend', onUp); };
    }, [onUp]);

    /* ── helpers ───────────────────────────────────────────────────────── */
    const rotate = (deg: number) => {
        if (!selId) return;
        setElements(prev => prev.map(el =>
            el.id === selId ? { ...el, angle: el.angle + deg * Math.PI / 180 } : el
        ));
    };

    const remove = () => {
        if (!selId) return;
        setElements(prev => prev.filter(el => el.id !== selId));
        setSelId(null);
    };

    const add = (kind: Kind) => {
        const id = `e${_nextId++}`;
        const n: Elem = {
            id, kind,
            x: 250, y: 300,
            angle: kind === 'laser' ? 0 : Math.PI / 2,
            halfLen: kind === 'laser' ? 22 : 70,
            ...(kind === 'lens' ? { focalLength: 200 } : {}),
        };
        setElements(prev => [...prev, n]);
        setSelId(id);
    };

    const sel = elements.find(e => e.id === selId);

    return (
        <div className="tool-card">
            <div className="tool-card-header">
                <h3>Ray Optics Lab</h3>
                <span className="subject-topic" style={{ background: 'var(--sage-glow)', color: 'var(--sage)' }}>Optics</span>
            </div>
            <div className="tool-card-body">
                {/* controls row */}
                <div className="tool-controls-row" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                    <button className="tool-btn" onClick={() => add('laser')}>+ Laser</button>
                    <button className="tool-btn" onClick={() => add('mirror')}>+ Mirror</button>
                    <button className="tool-btn" onClick={() => add('lens')}>+ Lens</button>

                    {selId && <>
                        <span style={{ width: 1, height: 24, background: 'var(--border-warm)', margin: '0 4px' }} />
                        <button className="tool-btn tool-btn--outline" onClick={() => rotate(-15)}>↺ 15°</button>
                        <button className="tool-btn tool-btn--outline" onClick={() => rotate(15)}>↻ 15°</button>
                        <button className="tool-btn tool-btn--outline" onClick={() => rotate(-5)}>↺ 5°</button>
                        <button className="tool-btn tool-btn--outline" onClick={() => rotate(5)}>↻ 5°</button>
                        <button className="tool-btn tool-btn--outline" style={{ color: '#ef4444' }} onClick={remove}>✕ Delete</button>
                    </>}

                    {sel?.kind === 'lens' && <>
                        <span style={{ width: 1, height: 24, background: 'var(--border-warm)', margin: '0 4px' }} />
                        <label style={{ fontSize: '0.82rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            f = {sel.focalLength}px
                            <input type="range" min={60} max={500} value={sel.focalLength ?? 200}
                                onChange={e => { const f = +e.target.value; setElements(prev => prev.map(el => el.id === selId ? { ...el, focalLength: f } : el)); }}
                                style={{ width: 100, accentColor: 'var(--sage)' }} />
                        </label>
                    </>}
                </div>

                {/* info bar */}
                {sel && (
                    <div style={{ padding: '6px 14px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', marginBottom: 10, fontSize: '0.82rem', color: 'var(--text-dim)', display: 'flex', gap: 16 }}>
                        <span><strong style={{ color: 'var(--text-primary)' }}>{sel.kind === 'laser' ? 'Laser' : sel.kind === 'mirror' ? 'Mirror' : 'Convex Lens'}</strong></span>
                        <span>angle: <strong>{Math.round(sel.angle * 180 / Math.PI % 360)}°</strong></span>
                        <span>pos: ({Math.round(sel.x)}, {Math.round(sel.y)})</span>
                        {sel.kind === 'lens' && <span>focal: <strong>{sel.focalLength}px</strong></span>}
                    </div>
                )}

                {/* canvas */}
                <div ref={boxRef} style={{
                    width: '100%', aspectRatio: '16/10',
                    background: 'var(--bg-primary)', border: '1px solid var(--border-warm)',
                    borderRadius: 'var(--radius-md)', overflow: 'hidden',
                    cursor: dragRef.current ? 'grabbing' : 'grab',
                }}>
                    <canvas ref={canvasRef} style={{ display: 'block', touchAction: 'none' }}
                        onMouseDown={onDown} onMouseMove={onMove}
                        onTouchStart={onDown} onTouchMove={onMove} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                    <span>Drag to move · Select → ↺/↻ to rotate · <span style={{ color: '#60a5fa' }}>θᵢ</span> = incidence · <span style={{ color: '#f59e0b' }}>θᵣ</span> = reflection</span>
                    <span>{elements.length} element{elements.length !== 1 ? 's' : ''}</span>
                </div>
            </div>
        </div>
    );
}
