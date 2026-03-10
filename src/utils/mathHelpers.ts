import { parse, type MathNode, type EvalFunction } from 'mathjs';

/* ─── Convert mathjs node to LaTeX ─── */
export function toLatex(n: MathNode): string {
    try {
        return n.toTex({ parenthesis: 'auto', implicit: 'hide' });
    } catch {
        return n.toString();
    }
}

/* ─── Adaptive grid step (nice 1-2-5 intervals) ─── */
export function gridStep(scale: number, minPx = 80): number {
    const raw = minPx / scale;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / mag;
    return (n < 2 ? 1 : n < 5 ? 2 : 5) * mag;
}

/* ─── Format axis label ─── */
export function fmtAxis(v: number): string {
    if (Math.abs(v) < 1e-10) return '0';
    if (Number.isInteger(v)) return String(v);
    return parseFloat(v.toFixed(3)).toString();
}

/* ─── Safe math evaluation (never throws) ─── */
export function evalSafe(fn: EvalFunction, x: number, v: string): number {
    try {
        return Number(fn.evaluate({ [v]: x, e: Math.E, pi: Math.PI }));
    } catch {
        return NaN;
    }
}

/* ─── Numerical derivative via central difference ─── */
export function numDeriv(fn: EvalFunction, x: number, v: string): number {
    const h = 1e-6;
    return (evalSafe(fn, x + h, v) - evalSafe(fn, x - h, v)) / (2 * h);
}

/* ─── Parse expression to LaTeX string (convenience) ─── */
export function exprToLatex(expr: string): string {
    try {
        return toLatex(parse(expr));
    } catch {
        return expr;
    }
}
