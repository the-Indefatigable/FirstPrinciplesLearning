import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useResizableSplit } from '../../hooks/useResizableSplit';

/* ═══════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════ */
type Kind = 'laser' | 'mirror' | 'lens';
type LensType = 'converging' | 'diverging' | 'concave' | 'convex';
type Mode = 'interactive' | 'calculator';

interface Elem {
    id: string;
    kind: Kind;
    x: number;
    y: number;
    angle: number;
    halfLen: number;
    focalLength?: number;
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
const vperp = (v: V2): V2 => v2(-v.y, v.x);
const vreflect = (d: V2, n: V2): V2 => vsub(d, vscale(n, 2 * vdot(d, n)));

/* ═══════════════════════════════════════════════════════════════════════
   RAY–LINE-SEGMENT INTERSECTION
   ═══════════════════════════════════════════════════════════════════════ */
function raySegment(
    P: V2, D: V2, A: V2, B: V2, minT = 1
): { t: number; point: V2; u: number } | null {
    const S = vsub(B, A);
    const denom = D.x * S.y - D.y * S.x;
    if (Math.abs(denom) < 1e-10) return null;
    const PA = vsub(A, P);
    const t = (PA.x * S.y - PA.y * S.x) / denom;
    const u = (PA.x * D.y - PA.y * D.x) / denom;
    if (t < minT || u < 0 || u > 1) return null;
    return { t, point: vadd(P, vscale(D, t)), u };
}

/* ═══════════════════════════════════════════════════════════════════════
   ELEMENT ENDPOINTS
   ═══════════════════════════════════════════════════════════════════════ */
function elemEndpoints(el: Elem): [V2, V2] {
    const along = v2(-Math.sin(el.angle), Math.cos(el.angle));
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
    normalAngle: number;
    incAngle: number;
    refAngle: number;
    incRayAngle: number;
    refRayAngle: number;
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
        let best: { t: number; point: V2; el: Elem; u: number } | null = null;

        for (const el of elements) {
            if (el.kind === 'laser') continue;
            if (el.id === lastHitId) continue;
            const [A, B] = elemEndpoints(el);
            const hit = raySegment(P, D, A, B, 1);
            if (hit && (!best || hit.t < best.t)) {
                best = { t: hit.t, point: hit.point, el, u: hit.u };
            }
        }

        if (!best) {
            segments.push({ from: P, to: vadd(P, vscale(D, FAR)) });
            break;
        }

        segments.push({ from: P, to: best.point });

        const el = best.el;
        const along = v2(-Math.sin(el.angle), Math.cos(el.angle));
        let N = vnorm(vperp(along));
        if (vdot(N, D) > 0) N = vscale(N, -1);

        const cosInc = Math.abs(vdot(vnorm(vscale(D, -1)), N));
        const incAngle = Math.acos(Math.min(1, Math.max(-1, cosInc)));

        if (el.kind === 'mirror') {
            const Drefl = vreflect(D, N);
            const cosRef = Math.abs(vdot(Drefl, vscale(N, -1)));
            const refAngle = Math.acos(Math.min(1, Math.max(-1, cosRef)));
            angles.push({
                point: best.point,
                normalAngle: Math.atan2(N.y, N.x),
                incAngle, refAngle,
                incRayAngle: Math.atan2(D.y, D.x),
                refRayAngle: Math.atan2(Drefl.y, Drefl.x),
            });
            D = vnorm(Drefl);
            P = vadd(best.point, vscale(D, 0.5));
            lastHitId = el.id;
            continue;
        }

        if (el.kind === 'lens') {
            const surf = along;
            let optAxis = v2(Math.cos(el.angle), Math.sin(el.angle));
            if (vdot(optAxis, D) < 0) optAxis = vscale(optAxis, -1);
            const toHit = vsub(best.point, el);
            const h = vdot(toHit, surf);
            const f = el.focalLength ?? 200;
            const daLen = vdot(D, optAxis);
            const Dt = vsub(D, vscale(optAxis, daLen));
            const DtNew = vsub(Dt, vscale(surf, h / f));
            D = vnorm(vadd(vscale(optAxis, daLen), DtNew));
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
    /* ── Resizable split ──────────────────────────────────────────────── */
    const { ratio, containerRef, handleProps } = useResizableSplit(0.27, { min: 0.16, max: 0.52 });

    /* ── Mode ─────────────────────────────────────────────────────────── */
    const [mode, setMode] = useState<Mode>('interactive');

    /* ── Interactive state ────────────────────────────────────────────── */
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const boxRef = useRef<HTMLDivElement>(null);
    const [elements, setElements] = useState<Elem[]>([
        { id: 'L1', kind: 'laser', x: 80, y: 250, angle: 0, halfLen: 22 },
        { id: 'M1', kind: 'mirror', x: 470, y: 180, angle: Math.PI * 3 / 4, halfLen: 70 },
        { id: 'M2', kind: 'mirror', x: 470, y: 380, angle: Math.PI / 4, halfLen: 70 },
        { id: 'N1', kind: 'lens', x: 260, y: 250, angle: 0, halfLen: 70, focalLength: 220 },
    ]);
    const [selId, setSelId] = useState<string | null>(null);
    const dragRef = useRef<{ id: string; ox: number; oy: number } | null>(null);
    const elementsRef = useRef(elements);
    useEffect(() => { elementsRef.current = elements; }, [elements]);

    /* ── Calculator state (merged from LensMirror) ────────────────────── */
    const calcCanvasRef = useRef<HTMLCanvasElement>(null);
    const [lensType, setLensType] = useState<LensType>('converging');
    const [fLen, setFLen] = useState(120);
    const [od, setOd] = useState(220);
    const [oh, setOh] = useState(60);

    const isCalcLens = lensType === 'converging' || lensType === 'diverging';
    const fSigned = (lensType === 'converging' || lensType === 'concave') ? fLen : -fLen;
    const di = (fSigned * od) / (od - fSigned);
    const mag = -di / od;
    const imgH = mag * oh;
    const isVirtual = !isFinite(di) || (isCalcLens ? di < 0 : di < 0);

    /* ── Interactive paint ────────────────────────────────────────────── */
    const paint = useCallback(() => {
        const cvs = canvasRef.current;
        const box = boxRef.current;
        if (!cvs || !box) return;
        const ctx = cvs.getContext('2d');
        if (!ctx) return;

        const r = box.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        const dpr = window.devicePixelRatio;
        cvs.width = r.width * dpr;
        cvs.height = r.height * dpr;
        ctx.scale(dpr, dpr);
        const W = r.width, H = r.height;

        const dark = document.documentElement.getAttribute('data-theme') === 'dark';
        const COL = {
            bg: dark ? '#1a1612' : '#faf8f5',
            grid: dark ? '#242018' : '#ece6da',
            dim: dark ? '#6b6358' : '#9c9488',
            mirror: dark ? '#a3c4a8' : '#6b8f71',
            lens: dark ? 'rgba(96,165,250,0.45)' : 'rgba(59,130,246,0.3)',
            lensStk: dark ? '#60a5fa' : '#3b82f6',
            beam: '#ef4444',
            angle: '#f59e0b',
        };

        ctx.fillStyle = COL.bg;
        ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = COL.grid;
        ctx.lineWidth = 0.5;
        for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
        for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

        const traces: ReturnType<typeof traceRays>[] = [];
        for (const el of elements) {
            if (el.kind !== 'laser') continue;
            const d = v2(Math.cos(el.angle), Math.sin(el.angle));
            const o = vadd(el, vscale(d, 24));
            traces.push(traceRays(o, d, elements, 16));
        }

        for (const tr of traces) {
            ctx.save();
            ctx.strokeStyle = COL.beam;
            ctx.lineWidth = 7;
            ctx.globalAlpha = 0.08;
            for (const s of tr.segments) { ctx.beginPath(); ctx.moveTo(s.from.x, s.from.y); ctx.lineTo(s.to.x, s.to.y); ctx.stroke(); }
            ctx.lineWidth = 2.5;
            ctx.globalAlpha = 0.9;
            ctx.lineCap = 'round';
            for (const s of tr.segments) { ctx.beginPath(); ctx.moveTo(s.from.x, s.from.y); ctx.lineTo(s.to.x, s.to.y); ctx.stroke(); }
            ctx.restore();
        }

        for (const tr of traces) {
            for (const a of tr.angles) {
                const ARC = 32;
                const nA = a.normalAngle;
                const incDeg = Math.round(a.incAngle * 180 / Math.PI * 10) / 10;
                const refDeg = Math.round(a.refAngle * 180 / Math.PI * 10) / 10;

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

                const inAngle = a.incRayAngle + Math.PI;
                const outAngle = a.refRayAngle;

                ctx.save();
                ctx.strokeStyle = '#60a5fa';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                let iStart = nA;
                let iDiff = inAngle - iStart;
                while (iDiff > Math.PI) iDiff -= 2 * Math.PI;
                while (iDiff < -Math.PI) iDiff += 2 * Math.PI;
                if (iDiff > 0) ctx.arc(a.point.x, a.point.y, ARC, iStart, iStart + iDiff);
                else ctx.arc(a.point.x, a.point.y, ARC, iStart + iDiff, iStart);
                ctx.stroke();
                ctx.fillStyle = 'rgba(96,165,250,0.12)';
                ctx.beginPath();
                ctx.moveTo(a.point.x, a.point.y);
                if (iDiff > 0) ctx.arc(a.point.x, a.point.y, ARC, iStart, iStart + iDiff);
                else ctx.arc(a.point.x, a.point.y, ARC, iStart + iDiff, iStart);
                ctx.closePath();
                ctx.fill();
                ctx.restore();

                ctx.save();
                ctx.strokeStyle = COL.angle;
                ctx.lineWidth = 1.5;
                let rStart = nA;
                let rDiff = outAngle - rStart;
                while (rDiff > Math.PI) rDiff -= 2 * Math.PI;
                while (rDiff < -Math.PI) rDiff += 2 * Math.PI;
                ctx.beginPath();
                if (rDiff > 0) ctx.arc(a.point.x, a.point.y, ARC - 2, rStart, rStart + rDiff);
                else ctx.arc(a.point.x, a.point.y, ARC - 2, rStart + rDiff, rStart);
                ctx.stroke();
                ctx.fillStyle = 'rgba(245,158,11,0.12)';
                ctx.beginPath();
                ctx.moveTo(a.point.x, a.point.y);
                if (rDiff > 0) ctx.arc(a.point.x, a.point.y, ARC - 2, rStart, rStart + rDiff);
                else ctx.arc(a.point.x, a.point.y, ARC - 2, rStart + rDiff, rStart);
                ctx.closePath();
                ctx.fill();
                ctx.restore();

                const incMid = nA + iDiff / 2;
                const refMid = nA + rDiff / 2;
                ctx.font = 'bold 11px Sora, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = '#60a5fa';
                ctx.fillText(`θᵢ=${incDeg}°`, a.point.x + Math.cos(incMid) * (ARC + 18), a.point.y + Math.sin(incMid) * (ARC + 18));
                ctx.fillStyle = COL.angle;
                ctx.fillText(`θᵣ=${refDeg}°`, a.point.x + Math.cos(refMid) * (ARC + 18), a.point.y + Math.sin(refMid) * (ARC + 18));
                ctx.fillStyle = COL.angle;
                ctx.beginPath();
                ctx.arc(a.point.x, a.point.y, 4, 0, Math.PI * 2);
                ctx.fill();
            }
        }

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
                ctx.strokeStyle = COL.mirror;
                ctx.lineWidth = 5;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(0, -el.halfLen);
                ctx.lineTo(0, el.halfLen);
                ctx.stroke();
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
                const f = el.focalLength ?? 200;
                ctx.fillStyle = COL.angle;
                for (const side of [-1, 1]) {
                    ctx.beginPath();
                    ctx.arc(side * f, 0, 3.5, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.font = 'bold 9px Sora, sans-serif';
                ctx.fillStyle = COL.angle;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.fillText('F', -f, 6);
                ctx.fillText("F'", f, 6);
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

    /* ── Calculator draw (merged from LensMirror) ─────────────────────── */
    const drawCalc = useCallback(() => {
        const cvs = calcCanvasRef.current;
        const box = boxRef.current;
        if (!cvs || !box) return;
        const ctx = cvs.getContext('2d');
        if (!ctx) return;

        const rect = box.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        const dpr = window.devicePixelRatio || 1;
        cvs.width = rect.width * dpr;
        cvs.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        const W = rect.width, H = rect.height;
        const CX = W / 2, CY = H / 2;
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = isDark ? '#1a1612' : '#faf8f4';
        ctx.fillRect(0, 0, W, H);

        const axisColor = isDark ? '#3a3028' : '#ddd4c0';
        const textColor = isDark ? '#9c9488' : '#7a6f62';

        // Optical axis
        ctx.strokeStyle = axisColor;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.moveTo(0, CY); ctx.lineTo(W, CY); ctx.stroke();
        ctx.setLineDash([]);

        // Lens / mirror symbol
        if (isCalcLens) {
            ctx.strokeStyle = isDark ? '#d97706' : '#b45309';
            ctx.lineWidth = 2.5;
            const lensH = Math.min(H * 0.45, 150);
            if (lensType === 'converging') {
                ctx.beginPath();
                ctx.moveTo(CX, CY - lensH / 2);
                ctx.bezierCurveTo(CX + 24, CY - lensH / 4, CX + 24, CY + lensH / 4, CX, CY + lensH / 2);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(CX, CY - lensH / 2);
                ctx.bezierCurveTo(CX - 24, CY - lensH / 4, CX - 24, CY + lensH / 4, CX, CY + lensH / 2);
                ctx.stroke();
                ctx.fillStyle = isDark ? '#d97706' : '#b45309';
                ctx.beginPath(); ctx.moveTo(CX, CY - lensH / 2); ctx.lineTo(CX - 7, CY - lensH / 2 + 12); ctx.lineTo(CX + 7, CY - lensH / 2 + 12); ctx.fill();
                ctx.beginPath(); ctx.moveTo(CX, CY + lensH / 2); ctx.lineTo(CX - 7, CY + lensH / 2 - 12); ctx.lineTo(CX + 7, CY + lensH / 2 - 12); ctx.fill();
            } else {
                ctx.beginPath();
                ctx.moveTo(CX, CY - lensH / 2);
                ctx.bezierCurveTo(CX - 20, CY - lensH / 4, CX - 20, CY + lensH / 4, CX, CY + lensH / 2);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(CX, CY - lensH / 2);
                ctx.bezierCurveTo(CX + 20, CY - lensH / 4, CX + 20, CY + lensH / 4, CX, CY + lensH / 2);
                ctx.stroke();
                ctx.fillStyle = isDark ? '#d97706' : '#b45309';
                ctx.beginPath(); ctx.moveTo(CX, CY - lensH / 2 + 12); ctx.lineTo(CX - 7, CY - lensH / 2); ctx.lineTo(CX + 7, CY - lensH / 2); ctx.fill();
                ctx.beginPath(); ctx.moveTo(CX, CY + lensH / 2 - 12); ctx.lineTo(CX - 7, CY + lensH / 2); ctx.lineTo(CX + 7, CY + lensH / 2); ctx.fill();
            }
        } else {
            const mH = Math.min(H * 0.45, 150);
            ctx.strokeStyle = isDark ? '#60a5fa' : '#2563eb';
            ctx.lineWidth = 3;
            const curveDir = lensType === 'concave' ? -1 : 1;
            ctx.beginPath();
            ctx.moveTo(CX, CY - mH / 2);
            ctx.bezierCurveTo(CX + curveDir * 20, CY - mH / 4, CX + curveDir * 20, CY + mH / 4, CX, CY + mH / 2);
            ctx.stroke();
            ctx.strokeStyle = isDark ? '#3a3028' : '#d0c8b8';
            ctx.lineWidth = 1;
            for (let y = CY - mH / 2; y < CY + mH / 2; y += 12) {
                ctx.beginPath(); ctx.moveTo(CX, y); ctx.lineTo(CX + 12, y + 8); ctx.stroke();
            }
        }

        // Focal points
        const f1x = CX - fSigned;
        const f2x = CX + fSigned;
        ctx.fillStyle = '#ef4444';
        for (const [fx, label] of [[f1x, 'F'], [f2x, "F'"]] as [number, string][]) {
            if (fx > 10 && fx < W - 10) {
                ctx.beginPath(); ctx.arc(fx, CY, 4, 0, 2 * Math.PI); ctx.fill();
                ctx.fillStyle = textColor;
                ctx.font = '10px monospace';
                ctx.fillText(label, fx - 4, CY + 16);
                ctx.fillStyle = '#ef4444';
            }
        }

        // Object arrow
        const objX = CX - od;
        if (objX > 10 && objX < CX - 10) {
            ctx.strokeStyle = '#22c55e';
            ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.moveTo(objX, CY); ctx.lineTo(objX, CY - oh); ctx.stroke();
            ctx.fillStyle = '#22c55e';
            ctx.beginPath();
            ctx.moveTo(objX, CY - oh);
            ctx.lineTo(objX - 5, CY - oh + 10);
            ctx.lineTo(objX + 5, CY - oh + 10);
            ctx.fill();
            ctx.fillStyle = textColor;
            ctx.font = '10px monospace';
            ctx.fillText('Object', objX - 14, CY + 14);
        }

        // Image arrow
        const imgX = isCalcLens ? CX + di : CX - di;
        if (isFinite(di) && imgX > 10 && imgX < W - 10) {
            ctx.strokeStyle = isVirtual ? '#a855f7' : '#f59e0b';
            ctx.lineWidth = isVirtual ? 1.5 : 2.5;
            if (isVirtual) ctx.setLineDash([5, 3]);
            ctx.beginPath(); ctx.moveTo(imgX, CY); ctx.lineTo(imgX, CY - imgH); ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = isVirtual ? '#a855f7' : '#f59e0b';
            const tipY = CY - imgH;
            ctx.beginPath();
            ctx.moveTo(imgX, tipY);
            ctx.lineTo(imgX - 5, tipY + (imgH > 0 ? 10 : -10));
            ctx.lineTo(imgX + 5, tipY + (imgH > 0 ? 10 : -10));
            ctx.fill();
            ctx.fillStyle = textColor;
            ctx.font = '10px monospace';
            ctx.fillText(isVirtual ? 'Image (virtual)' : 'Image (real)', imgX - 20, CY + 14);
        }

        // Principal rays
        if (objX > 10 && objX < CX - 10 && isFinite(di)) {
            const tipX = objX, tipY = CY - oh;
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 2]);
            ctx.strokeStyle = '#f59e0b';
            ctx.globalAlpha = 0.7;
            ctx.beginPath(); ctx.moveTo(tipX, tipY); ctx.lineTo(CX, tipY); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(CX, tipY); ctx.lineTo(isCalcLens ? CX + di : CX - di, CY - imgH); ctx.stroke();
            ctx.strokeStyle = '#3b82f6';
            const imgXr = isCalcLens ? CX + di : CX - di;
            ctx.beginPath(); ctx.moveTo(tipX, tipY); ctx.lineTo(CX, CY); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(CX, CY); ctx.lineTo(imgXr, CY - imgH); ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = 1;
        }
    }, [lensType, fLen, od, oh, fSigned, di, mag, imgH, isVirtual, isCalcLens]);

    /* ── Effects ──────────────────────────────────────────────────────── */
    useEffect(() => { paint(); }, [paint]);
    useEffect(() => { drawCalc(); }, [drawCalc]);

    // Repaint both when the box resizes (handles split drag + window resize)
    useEffect(() => {
        const box = boxRef.current;
        if (!box) return;
        const ro = new ResizeObserver(() => { paint(); drawCalc(); });
        ro.observe(box);
        return () => ro.disconnect();
    }, [paint, drawCalc]);

    /* ── Pointer: canvas coords ───────────────────────────────────────── */
    const canvasPos = (clientX: number, clientY: number): V2 => {
        const cr = canvasRef.current!.getBoundingClientRect();
        return v2(clientX - cr.left, clientY - cr.top);
    };

    /* ── Mouse handlers ───────────────────────────────────────────────── */
    const onMouseDown = (e: React.MouseEvent) => {
        const p = canvasPos(e.clientX, e.clientY);
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

    const onMouseMove = (e: React.MouseEvent) => {
        if (!dragRef.current) return;
        const p = canvasPos(e.clientX, e.clientY);
        setElements(prev => prev.map(el =>
            el.id === dragRef.current!.id
                ? { ...el, x: p.x - dragRef.current!.ox, y: p.y - dragRef.current!.oy }
                : el
        ));
    };

    /* ── Touch handlers ───────────────────────────────────────────────── */
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const onTouchStart = (e: TouchEvent) => {
            e.preventDefault();
            const t = e.touches[0];
            const p = canvasPos(t.clientX, t.clientY);
            const elems = elementsRef.current;
            for (let i = elems.length - 1; i >= 0; i--) {
                const el = elems[i];
                if (Math.hypot(p.x - el.x, p.y - el.y) < el.halfLen + 20) {
                    setSelId(el.id);
                    dragRef.current = { id: el.id, ox: p.x - el.x, oy: p.y - el.y };
                    return;
                }
            }
            setSelId(null);
        };

        const onTouchMove = (e: TouchEvent) => {
            e.preventDefault();
            if (!dragRef.current) return;
            const t = e.touches[0];
            const p = canvasPos(t.clientX, t.clientY);
            setElements(prev => prev.map(el =>
                el.id === dragRef.current!.id
                    ? { ...el, x: p.x - dragRef.current!.ox, y: p.y - dragRef.current!.oy }
                    : el
            ));
        };

        canvas.addEventListener('touchstart', onTouchStart, { passive: false });
        canvas.addEventListener('touchmove', onTouchMove, { passive: false });
        return () => {
            canvas.removeEventListener('touchstart', onTouchStart);
            canvas.removeEventListener('touchmove', onTouchMove);
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const onUp = useCallback(() => { dragRef.current = null; }, []);
    useEffect(() => {
        window.addEventListener('mouseup', onUp);
        window.addEventListener('touchend', onUp);
        return () => { window.removeEventListener('mouseup', onUp); window.removeEventListener('touchend', onUp); };
    }, [onUp]);

    /* ── Element helpers ──────────────────────────────────────────────── */
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
        setElements(prev => [...prev, {
            id, kind,
            x: 200, y: 200,
            angle: 0,
            halfLen: kind === 'laser' ? 22 : 70,
            ...(kind === 'lens' ? { focalLength: 200 } : {}),
        }]);
        setSelId(id);
    };

    const sel = elements.find(e => e.id === selId);

    /* ── Render ───────────────────────────────────────────────────────── */
    return (
        <div className="tool-card">
            <div className="tool-card-header">
                <h3>Ray Optics Lab</h3>
                <span className="subject-topic" style={{ background: 'var(--sage-glow)', color: 'var(--sage)' }}>Optics</span>
            </div>

            <div className="tool-card-body" style={{ padding: 0 }}>
                <div
                    ref={containerRef}
                    style={{ display: 'flex', height: 560, overflow: 'hidden', borderRadius: '0 0 var(--radius-md) var(--radius-md)' }}
                >
                    {/* ── Sidebar ──────────────────────────────────────────── */}
                    <div style={{
                        width: `${ratio * 100}%`,
                        flexShrink: 0,
                        overflowY: 'auto',
                        padding: '14px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                        borderRight: '1px solid var(--border-warm)',
                    }}>
                        {/* Mode toggle */}
                        <div style={{
                            display: 'flex', gap: 3, padding: 3,
                            background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)',
                        }}>
                            {(['interactive', 'calculator'] as const).map(m => (
                                <button key={m} onClick={() => setMode(m)} style={{
                                    flex: 1, padding: '5px 0', border: 'none',
                                    borderRadius: 'var(--radius-sm)', fontSize: '0.75rem',
                                    fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                                    background: mode === m ? 'var(--bg-primary)' : 'transparent',
                                    color: mode === m ? 'var(--text-primary)' : 'var(--text-dim)',
                                    boxShadow: mode === m ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                                    transition: 'all 0.15s',
                                }}>
                                    {m === 'interactive' ? 'Interactive' : 'Calculator'}
                                </button>
                            ))}
                        </div>

                        {mode === 'interactive' ? (
                            <>
                                {/* Add elements */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                    <div style={sideLabel}>Add Element</div>
                                    <button className="tool-btn" style={fullBtn} onClick={() => add('laser')}>+ Laser</button>
                                    <button className="tool-btn" style={fullBtn} onClick={() => add('mirror')}>+ Mirror</button>
                                    <button className="tool-btn" style={fullBtn} onClick={() => add('lens')}>+ Lens</button>
                                </div>

                                {sel && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <div style={sideLabel}>
                                            Selected: <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{sel.kind}</span>
                                        </div>

                                        {/* Info */}
                                        <div style={infoBox}>
                                            <div>angle: <strong>{Math.round(sel.angle * 180 / Math.PI % 360)}°</strong></div>
                                            <div>pos: ({Math.round(sel.x)}, {Math.round(sel.y)})</div>
                                            {sel.kind === 'lens' && <div>f: <strong>{sel.focalLength}px</strong></div>}
                                        </div>

                                        {/* Rotate buttons */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                                            <button className="tool-btn--outline" style={gridBtn} onClick={() => rotate(-15)}>↺ 15°</button>
                                            <button className="tool-btn--outline" style={gridBtn} onClick={() => rotate(15)}>↻ 15°</button>
                                            <button className="tool-btn--outline" style={gridBtn} onClick={() => rotate(-5)}>↺ 5°</button>
                                            <button className="tool-btn--outline" style={gridBtn} onClick={() => rotate(5)}>↻ 5°</button>
                                        </div>

                                        {/* Focal length slider */}
                                        {sel.kind === 'lens' && (
                                            <label style={sliderLabel}>
                                                <span>f = {sel.focalLength}px</span>
                                                <input type="range" min={60} max={500} value={sel.focalLength ?? 200}
                                                    onChange={e => {
                                                        const f = +e.target.value;
                                                        setElements(prev => prev.map(el => el.id === selId ? { ...el, focalLength: f } : el));
                                                    }}
                                                    style={{ width: '100%', accentColor: 'var(--sage)' }} />
                                            </label>
                                        )}

                                        <button className="tool-btn--outline" style={{ ...fullBtn, color: '#ef4444' }} onClick={remove}>
                                            ✕ Delete
                                        </button>
                                    </div>
                                )}

                                {/* Legend */}
                                <div style={{ marginTop: 'auto', fontSize: '0.72rem', color: 'var(--text-dim)', lineHeight: 1.9 }}>
                                    <div>Drag elements to move</div>
                                    <div>Select → rotate or adjust f</div>
                                    <div><span style={{ color: '#60a5fa' }}>θᵢ</span> incidence · <span style={{ color: '#f59e0b' }}>θᵣ</span> reflection</div>
                                    <div style={{ marginTop: 4, color: 'var(--text-light)' }}>{elements.length} element{elements.length !== 1 ? 's' : ''}</div>
                                </div>
                            </>
                        ) : (
                            <>
                                {/* Optic type selector */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <div style={sideLabel}>Optic Type</div>
                                    {(['converging', 'diverging', 'concave', 'convex'] as const).map(t => (
                                        <button key={t}
                                            className={lensType === t ? 'tool-btn tool-btn--amber' : 'tool-btn--outline'}
                                            style={{ width: '100%', fontSize: '0.76rem', textAlign: 'left', padding: '6px 10px' }}
                                            onClick={() => setLensType(t)}>
                                            {t === 'converging' ? 'Converging Lens' : t === 'diverging' ? 'Diverging Lens' : t === 'concave' ? 'Concave Mirror' : 'Convex Mirror'}
                                        </button>
                                    ))}
                                </div>

                                {/* Sliders */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    <div style={sideLabel}>Parameters</div>
                                    <label style={sliderLabel}>
                                        <span>Focal length: {(fSigned / 40).toFixed(1)} cm</span>
                                        <input type="range" min={40} max={200} value={fLen}
                                            onChange={e => setFLen(+e.target.value)}
                                            style={{ width: '100%', accentColor: 'var(--amber)' }} />
                                    </label>
                                    <label style={sliderLabel}>
                                        <span>Object distance: {(od / 40).toFixed(1)} cm</span>
                                        <input type="range" min={20} max={300} value={od}
                                            onChange={e => setOd(+e.target.value)}
                                            style={{ width: '100%', accentColor: 'var(--amber)' }} />
                                    </label>
                                    <label style={sliderLabel}>
                                        <span>Object height: {(oh / 40).toFixed(1)} cm</span>
                                        <input type="range" min={20} max={100} value={oh}
                                            onChange={e => setOh(+e.target.value)}
                                            style={{ width: '100%', accentColor: 'var(--amber)' }} />
                                    </label>
                                </div>

                                {/* Results */}
                                <div style={{ ...infoBox, gap: 6, lineHeight: 1.8 }}>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: 2 }}>
                                        <strong>1/f = 1/d<sub>o</sub> + 1/d<sub>i</sub></strong>
                                    </div>
                                    <div>d<sub>i</sub> = <strong>{isFinite(di) ? (di / 40).toFixed(1) + ' cm' : '∞'}</strong></div>
                                    <div>m = <strong>{isFinite(mag) ? mag.toFixed(2) + 'x' : '∞'}</strong></div>
                                    <div style={{ color: isVirtual ? '#a855f7' : '#f59e0b', fontWeight: 600, fontSize: '0.78rem' }}>
                                        {isVirtual ? 'Virtual · upright' : 'Real · inverted'}
                                    </div>
                                </div>

                                {/* Legend */}
                                <div style={{ marginTop: 'auto', fontSize: '0.72rem', color: 'var(--text-dim)', lineHeight: 1.9 }}>
                                    <div><span style={{ color: '#22c55e' }}>●</span> Object</div>
                                    <div><span style={{ color: '#f59e0b' }}>●</span> Real image</div>
                                    <div><span style={{ color: '#a855f7' }}>●</span> Virtual image</div>
                                    <div><span style={{ color: '#ef4444' }}>●</span> Focal points F, F'</div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* ── Resize handle ─────────────────────────────────────── */}
                    <div className="resize-handle" {...handleProps} />

                    {/* ── Canvas area ───────────────────────────────────────── */}
                    <div ref={boxRef} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                        <canvas
                            ref={canvasRef}
                            style={{
                                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                                display: mode === 'interactive' ? 'block' : 'none',
                                touchAction: 'none',
                            }}
                            onMouseDown={onMouseDown}
                            onMouseMove={onMouseMove}
                        />
                        <canvas
                            ref={calcCanvasRef}
                            style={{
                                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                                display: mode === 'calculator' ? 'block' : 'none',
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ── Style constants ──────────────────────────────────────────────────── */
const sideLabel: React.CSSProperties = {
    fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.06em', color: 'var(--text-dim)',
};

const fullBtn: React.CSSProperties = {
    width: '100%', fontSize: '0.82rem',
};

const gridBtn: React.CSSProperties = {
    fontSize: '0.78rem', padding: '5px 0', textAlign: 'center',
};

const infoBox: React.CSSProperties = {
    background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)',
    padding: '8px 10px', fontSize: '0.8rem', color: 'var(--text-dim)',
    display: 'flex', flexDirection: 'column', gap: 2,
};

const sliderLabel: React.CSSProperties = {
    display: 'flex', flexDirection: 'column', gap: 3,
    fontSize: '0.79rem', color: 'var(--text-dim)',
};
