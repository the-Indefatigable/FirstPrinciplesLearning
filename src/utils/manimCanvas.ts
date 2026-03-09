/**
 * manimCanvas.ts — Manim-grade (3Blue1Brown-style) Canvas 2D rendering utilities.
 *
 * Provides dark backgrounds, glowing curves, subtle grids, and clean labels
 * that any graphing tool can import and use.
 */

// ── Manim Color Palette ──────────────────────────────────────────────
export const MANIM = {
    bg: '#0f1117',
    bgGradient: '#141822',
    grid: 'rgba(88, 196, 221, 0.07)',
    gridStrong: 'rgba(88, 196, 221, 0.14)',
    axis: 'rgba(200, 210, 225, 0.35)',
    axisLabel: 'rgba(200, 210, 225, 0.45)',
    blue: '#58C4DD',
    yellow: '#F4D03F',
    green: '#83C167',
    pink: '#FC6255',
    teal: '#5CD0B3',
    purple: '#B07CD8',
    orange: '#FF8C42',
    white: '#ECF0F1',
    dim: 'rgba(200, 210, 225, 0.2)',
    // Ordered palette for multi-function graphs
    palette: ['#58C4DD', '#F4D03F', '#83C167', '#FC6255', '#5CD0B3', '#B07CD8', '#FF8C42'],
} as const;

// ── Background ──────────────────────────────────────────────────────
/** Dark gradient background matching 3B1B aesthetic */
export function drawBackground(ctx: CanvasRenderingContext2D, W: number, H: number) {
    const grad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
    grad.addColorStop(0, MANIM.bgGradient);
    grad.addColorStop(1, MANIM.bg);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
}

// ── Grid ─────────────────────────────────────────────────────────────
/** Ultra-thin grid with adaptive step sizes */
export function drawGrid(
    ctx: CanvasRenderingContext2D,
    W: number, H: number,
    cx: number, cy: number,
    scale: number, step: number,
) {
    const startX = Math.floor((-cx / scale) / step) * step;
    const endX = Math.ceil(((W - cx) / scale) / step) * step;
    const startY = Math.floor((-(H - cy) / scale) / step) * step;
    const endY = Math.ceil((cy / scale) / step) * step;

    // Minor grid
    ctx.strokeStyle = MANIM.grid;
    ctx.lineWidth = 0.5;
    for (let x = startX; x <= endX; x += step) {
        if (Math.abs(x) < 0.001) continue;
        const px = cx + x * scale;
        ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, H); ctx.stroke();
    }
    for (let y = startY; y <= endY; y += step) {
        if (Math.abs(y) < 0.001) continue;
        const py = cy - y * scale;
        ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(W, py); ctx.stroke();
    }
}

// ── Axes ─────────────────────────────────────────────────────────────
/** Clean axis lines with subtle glow */
export function drawAxes(
    ctx: CanvasRenderingContext2D,
    W: number, H: number,
    cx: number, cy: number,
) {
    // Glow layer
    ctx.save();
    ctx.strokeStyle = 'rgba(200, 210, 225, 0.08)';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(W, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke();
    ctx.restore();

    // Core axis lines
    ctx.strokeStyle = MANIM.axis;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(W, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke();
}

// ── Axis Labels ──────────────────────────────────────────────────────
/** Clean monospace labels along axes */
export function drawAxisLabels(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number,
    scale: number, step: number,
    W: number, H: number,
) {
    const startX = Math.floor((-cx / scale) / step) * step;
    const endX = Math.ceil(((W - cx) / scale) / step) * step;
    const startY = Math.floor((-(H - cy) / scale) / step) * step;
    const endY = Math.ceil((cy / scale) / step) * step;

    ctx.fillStyle = MANIM.axisLabel;
    ctx.font = '10px "JetBrains Mono", "SF Mono", "Fira Code", monospace';

    // X-axis labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let x = startX; x <= endX; x += step) {
        if (Math.abs(x) < 0.001) continue;
        const px = cx + x * scale;
        if (px < 20 || px > W - 20) continue;
        const label = Number.isInteger(x) ? String(x) : x.toFixed(1);
        ctx.fillText(label, px, cy + 8);
    }

    // Y-axis labels
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let y = startY; y <= endY; y += step) {
        if (Math.abs(y) < 0.001) continue;
        const py = cy - y * scale;
        if (py < 12 || py > H - 12) continue;
        const label = Number.isInteger(y) ? String(y) : y.toFixed(1);
        ctx.fillText(label, cx - 8, py);
    }
}

// ── Glowing Curve ────────────────────────────────────────────────────
export interface CurvePoint { x: number; y: number; }

/**
 * Draw a curve with the signature manim glow effect:
 *   1. Wide low-opacity pass (outer glow)
 *   2. Medium pass (inner glow)
 *   3. Thin full-opacity pass (sharp core)
 */
export function drawGlowCurve(
    ctx: CanvasRenderingContext2D,
    points: CurvePoint[],
    color: string,
    opts?: { lineWidth?: number; glowIntensity?: number; dashed?: boolean },
) {
    if (points.length < 2) return;
    const lw = opts?.lineWidth ?? 2;
    const intensity = opts?.glowIntensity ?? 1;

    const passes = [
        { width: lw * 4, alpha: 0.08 * intensity },
        { width: lw * 2.5, alpha: 0.2 * intensity },
        { width: lw, alpha: 1 },
    ];

    for (const pass of passes) {
        ctx.save();
        ctx.globalAlpha = pass.alpha;
        ctx.strokeStyle = color;
        ctx.lineWidth = pass.width;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        if (opts?.dashed) ctx.setLineDash([6, 4]);

        ctx.beginPath();
        let started = false;
        for (const pt of points) {
            if (!isFinite(pt.x) || !isFinite(pt.y)) { started = false; continue; }
            if (!started) { ctx.moveTo(pt.x, pt.y); started = true; }
            else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
        ctx.restore();
    }
}

// ── Glowing Point / Dot ──────────────────────────────────────────────
/** Highlighted point with soft glow ring */
export function drawGlowDot(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    color: string,
    opts?: { radius?: number; pulse?: boolean },
) {
    const r = opts?.radius ?? 4;

    // Outer glow
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.beginPath();
    ctx.arc(x, y, r * 3, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();

    // Mid glow
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.8, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();

    // Core dot
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // White center highlight
    ctx.beginPath();
    ctx.arc(x, y, r * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fill();
}

// ── Crosshair / Trace ────────────────────────────────────────────────
/** Dashed crosshair lines for mouse tracing */
export function drawCrosshair(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    W: number, H: number,
    color = MANIM.dim,
) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.8;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    ctx.restore();
}

// ── Label ────────────────────────────────────────────────────────────
/** Clean monospace label with optional background pill */
export function drawLabel(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number, y: number,
    opts?: { color?: string; fontSize?: number; bg?: boolean; align?: CanvasTextAlign },
) {
    const fontSize = opts?.fontSize ?? 11;
    const color = opts?.color ?? MANIM.white;
    ctx.font = `${fontSize}px "JetBrains Mono", "SF Mono", monospace`;
    ctx.textAlign = opts?.align ?? 'left';
    ctx.textBaseline = 'middle';

    if (opts?.bg) {
        const measured = ctx.measureText(text);
        const pad = 5;
        const bx = opts?.align === 'center' ? x - measured.width / 2 - pad
            : opts?.align === 'right' ? x - measured.width - pad
                : x - pad;
        ctx.fillStyle = 'rgba(15, 17, 23, 0.8)';
        ctx.beginPath();
        ctx.roundRect(bx, y - fontSize / 2 - 3, measured.width + pad * 2, fontSize + 6, 4);
        ctx.fill();
    }

    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
}

// ── Shaded Area ──────────────────────────────────────────────────────
/** Gradient-filled area under a curve (for integrals) */
export function drawShadedArea(
    ctx: CanvasRenderingContext2D,
    points: CurvePoint[],
    baselineY: number,
    color: string,
) {
    if (points.length < 2) return;
    ctx.save();
    const grad = ctx.createLinearGradient(0, Math.min(...points.map(p => p.y)), 0, baselineY);
    grad.addColorStop(0, color.replace(')', ', 0.25)').replace('rgb', 'rgba'));
    grad.addColorStop(1, 'transparent');

    // Fallback for hex colors
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = color;

    ctx.beginPath();
    ctx.moveTo(points[0].x, baselineY);
    for (const pt of points) {
        if (!isFinite(pt.y)) continue;
        ctx.lineTo(pt.x, pt.y);
    }
    ctx.lineTo(points[points.length - 1].x, baselineY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

// ── Grid Step Calculator ─────────────────────────────────────────────
/** Compute a nice grid step given the current zoom scale */
export function getGridStep(scale: number): number {
    const idealPixels = 60;
    const raw = idealPixels / scale;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const normalized = raw / mag;
    if (normalized < 2) return mag;
    if (normalized < 5) return 2 * mag;
    return 5 * mag;
}

// ── Full Scene Draw ──────────────────────────────────────────────────
/** Convenience: draw background + grid + axes + labels in one call */
export function drawScene(
    ctx: CanvasRenderingContext2D,
    W: number, H: number,
    cx: number, cy: number,
    scale: number,
) {
    const step = getGridStep(scale);
    drawBackground(ctx, W, H);
    drawGrid(ctx, W, H, cx, cy, scale, step);
    drawAxes(ctx, W, H, cx, cy);
    drawAxisLabels(ctx, cx, cy, scale, step, W, H);
}
