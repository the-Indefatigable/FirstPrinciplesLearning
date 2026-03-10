import { useRef, useEffect, useState, type RefObject } from 'react';

interface CanvasSetupResult {
    canvasRef: RefObject<HTMLCanvasElement | null>;
    ctx: CanvasRenderingContext2D | null;
    W: number;
    H: number;
    dpr: number;
}

/**
 * Shared canvas DPR setup hook.
 *
 * Handles:
 * - Device pixel ratio scaling
 * - Resize observation (via ResizeObserver on parent)
 * - Returns current dimensions and 2D context
 *
 * Usage:
 * ```tsx
 * const { canvasRef, ctx, W, H } = useCanvasSetup();
 * ```
 */
export function useCanvasSetup(): CanvasSetupResult {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [dims, setDims] = useState({ W: 0, H: 0, dpr: 1 });
    const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        const parent = canvas.parentElement;
        if (!parent) return;

        const resize = () => {
            const rect = parent.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            const W = rect.width;
            const H = rect.height;

            canvas.width = W * dpr;
            canvas.height = H * dpr;
            canvas.style.width = `${W}px`;
            canvas.style.height = `${H}px`;

            context.setTransform(1, 0, 0, 1, 0, 0); // reset
            context.scale(dpr, dpr);

            setDims({ W, H, dpr });
            setCtx(context);
        };

        resize();

        const ro = new ResizeObserver(resize);
        ro.observe(parent);

        return () => ro.disconnect();
    }, []);

    return { canvasRef, ctx, W: dims.W, H: dims.H, dpr: dims.dpr };
}

/**
 * Imperative canvas setup (non-hook version).
 * Call inside a useEffect when you already have a canvas ref.
 *
 * Returns { ctx, W, H } or null if setup failed.
 */
export function setupCanvas(canvas: HTMLCanvasElement): { ctx: CanvasRenderingContext2D; W: number; H: number } | null {
    const parent = canvas.parentElement;
    if (!parent) return null;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const rect = parent.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const W = rect.width;
    const H = rect.height;

    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    return { ctx, W, H };
}
