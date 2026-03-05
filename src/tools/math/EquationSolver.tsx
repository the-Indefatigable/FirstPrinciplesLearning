import { useState } from 'react';

interface Step { label: string; expr: string; }

/* ── Solvers ─────────────────────────────────────────────────────────── */

function solveQuadratic(a: number, b: number, c: number): Step[] {
    const steps: Step[] = [];
    steps.push({ label: 'Standard form', expr: `${a}x² + ${b}x + ${c} = 0` });
    const disc = b * b - 4 * a * c;
    steps.push({ label: 'Discriminant', expr: `Δ = b² − 4ac = (${b})² − 4(${a})(${c}) = ${disc}` });

    if (disc > 0) {
        const x1 = (-b + Math.sqrt(disc)) / (2 * a);
        const x2 = (-b - Math.sqrt(disc)) / (2 * a);
        steps.push({ label: 'Roots (Δ > 0 → 2 real)', expr: `x = (−b ± √Δ) / 2a` });
        steps.push({ label: 'x₁', expr: `x₁ = (${-b} + √${disc}) / ${2 * a} = ${x1.toFixed(6)}` });
        steps.push({ label: 'x₂', expr: `x₂ = (${-b} − √${disc}) / ${2 * a} = ${x2.toFixed(6)}` });
    } else if (disc === 0) {
        const x = -b / (2 * a);
        steps.push({ label: 'Root (Δ = 0 → 1 repeated)', expr: `x = −b / 2a = ${x.toFixed(6)}` });
    } else {
        const realPart = (-b / (2 * a)).toFixed(4);
        const imagPart = (Math.sqrt(-disc) / (2 * a)).toFixed(4);
        steps.push({ label: 'Roots (Δ < 0 → complex)', expr: `x = ${realPart} ± ${imagPart}i` });
    }
    return steps;
}

function solveLinear(a: number, b: number): Step[] {
    const steps: Step[] = [];
    steps.push({ label: 'Equation', expr: `${a}x + ${b} = 0` });
    if (a === 0) {
        steps.push({ label: 'Result', expr: b === 0 ? 'Infinite solutions (0 = 0)' : 'No solution (0 ≠ 0)' });
    } else {
        steps.push({ label: 'Isolate x', expr: `${a}x = ${-b}` });
        steps.push({ label: 'Divide', expr: `x = ${-b} / ${a} = ${(-b / a).toFixed(6)}` });
    }
    return steps;
}

// 2×2 determinant
function det2(a: number, b: number, c: number, d: number) { return a * d - b * c; }

// Cramer's rule for 2 variables
// a1*x + b1*y = c1
// a2*x + b2*y = c2
function solve2Var(a1: number, b1: number, c1: number,
    a2: number, b2: number, c2: number): Step[] {
    const steps: Step[] = [];
    steps.push({ label: 'System', expr: `${a1}x + ${b1}y = ${c1}` });
    steps.push({ label: '', expr: `${a2}x + ${b2}y = ${c2}` });

    const D = det2(a1, b1, a2, b2);
    steps.push({ label: 'Determinant D', expr: `D = ${a1}·${b2} − ${b1}·${a2} = ${D}` });

    if (Math.abs(D) < 1e-12) {
        steps.push({ label: 'Result', expr: D === 0 ? 'No unique solution (D = 0) — system is dependent or inconsistent' : 'No solution' });
        return steps;
    }

    const Dx = det2(c1, b1, c2, b2);
    const Dy = det2(a1, c1, a2, c2);
    const x = Dx / D;
    const y = Dy / D;

    steps.push({ label: 'Solution', expr: `x = ${x.toFixed(6)},  y = ${y.toFixed(6)}` });
    return steps;
}

// 3×3 determinant (Sarrus)
function det3(
    a1: number, b1: number, c1: number,
    a2: number, b2: number, c2: number,
    a3: number, b3: number, c3: number,
) {
    return a1 * (b2 * c3 - b3 * c2) - b1 * (a2 * c3 - a3 * c2) + c1 * (a2 * b3 - a3 * b2);
}

// Cramer's rule for 3 variables
function solve3Var(
    a1: number, b1: number, c1: number, d1: number,
    a2: number, b2: number, c2: number, d2: number,
    a3: number, b3: number, c3: number, d3: number,
): Step[] {
    const steps: Step[] = [];
    steps.push({ label: 'System', expr: `${a1}x + ${b1}y + ${c1}z = ${d1}` });
    steps.push({ label: '', expr: `${a2}x + ${b2}y + ${c2}z = ${d2}` });
    steps.push({ label: '', expr: `${a3}x + ${b3}y + ${c3}z = ${d3}` });

    const D = det3(a1, b1, c1, a2, b2, c2, a3, b3, c3);
    steps.push({ label: 'Determinant D', expr: `D = ${D}` });

    if (Math.abs(D) < 1e-12) {
        steps.push({ label: 'Result', expr: 'No unique solution (D = 0) — system is dependent or inconsistent' });
        return steps;
    }

    const Dx = det3(d1, b1, c1, d2, b2, c2, d3, b3, c3);
    const Dy = det3(a1, d1, c1, a2, d2, c2, a3, d3, c3);
    const Dz = det3(a1, b1, d1, a2, b2, d2, a3, b3, d3);

    const x = Dx / D;
    const y = Dy / D;
    const z = Dz / D;

    steps.push({ label: 'Solution', expr: `x = ${x.toFixed(6)},  y = ${y.toFixed(6)},  z = ${z.toFixed(6)}` });
    return steps;
}

/* ── Component ───────────────────────────────────────────────────────── */

type Mode = 'linear' | 'quadratic' | 'system-2var' | 'system-3var';

export default function EquationSolver() {
    const [mode, setMode] = useState<Mode>('quadratic');
    // Linear / Quadratic
    const [a, setA] = useState(1);
    const [b, setB] = useState(-5);
    const [c, setC] = useState(6);

    // 2-var system: a1*x + b1*y = c1, a2*x + b2*y = c2
    const [s2, setS2] = useState({ a1: 2, b1: 1, c1: 5, a2: 1, b2: 3, c2: 10 });

    // 3-var system
    const [s3, setS3] = useState({
        a1: 1, b1: 2, c1: -1, d1: 3,
        a2: 2, b2: -1, c2: 3, d2: 9,
        a3: 3, b3: 1, c3: 1, d3: 4,
    });

    const [steps, setSteps] = useState<Step[]>([]);

    const solve = () => {
        if (mode === 'quadratic') setSteps(solveQuadratic(a, b, c));
        else if (mode === 'linear') setSteps(solveLinear(a, b));
        else if (mode === 'system-2var') setSteps(solve2Var(s2.a1, s2.b1, s2.c1, s2.a2, s2.b2, s2.c2));
        else setSteps(solve3Var(s3.a1, s3.b1, s3.c1, s3.d1, s3.a2, s3.b2, s3.c2, s3.d2, s3.a3, s3.b3, s3.c3, s3.d3));
    };

    const num = (val: number, setter: (v: number) => void) => (
        <input className="tool-input" type="number" value={val} onChange={e => setter(+e.target.value)}
            style={{ width: 64, textAlign: 'center' }} />
    );

    return (
        <div className="tool-card">
            <div className="tool-card-header">
                <h3>Equation Solver</h3>
                <span className="subject-topic" style={{ background: 'var(--amber-soft)', color: 'var(--amber)' }}>Algebra</span>
            </div>
            <div className="tool-card-body">
                <div className="tool-controls-row" style={{ marginBottom: 12 }}>
                    <div className="tool-input-group" style={{ flex: 1 }}>
                        <label>Type</label>
                        <select className="tool-input" value={mode} onChange={e => { setMode(e.target.value as Mode); setSteps([]); }}>
                            <option value="linear">Linear (ax + b = 0)</option>
                            <option value="quadratic">Quadratic (ax² + bx + c = 0)</option>
                            <option value="system-2var">System — 2 Variables</option>
                            <option value="system-3var">System — 3 Variables</option>
                        </select>
                    </div>
                </div>

                {/* Linear / Quadratic inputs */}
                {(mode === 'linear' || mode === 'quadratic') && (
                    <div className="tool-controls-row tool-controls-row--4" style={{ marginBottom: 12 }}>
                        <div className="tool-input-group">
                            <label>a</label>
                            <input className="tool-input" type="number" value={a} onChange={e => setA(+e.target.value)} />
                        </div>
                        <div className="tool-input-group">
                            <label>b</label>
                            <input className="tool-input" type="number" value={b} onChange={e => setB(+e.target.value)} />
                        </div>
                        {mode === 'quadratic' && (
                            <div className="tool-input-group">
                                <label>c</label>
                                <input className="tool-input" type="number" value={c} onChange={e => setC(+e.target.value)} />
                            </div>
                        )}
                    </div>
                )}

                {/* 2-variable system */}
                {mode === 'system-2var' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            {num(s2.a1, v => setS2(p => ({ ...p, a1: v })))} <span style={{ color: 'var(--text-dim)' }}>x +</span>
                            {num(s2.b1, v => setS2(p => ({ ...p, b1: v })))} <span style={{ color: 'var(--text-dim)' }}>y =</span>
                            {num(s2.c1, v => setS2(p => ({ ...p, c1: v })))}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            {num(s2.a2, v => setS2(p => ({ ...p, a2: v })))} <span style={{ color: 'var(--text-dim)' }}>x +</span>
                            {num(s2.b2, v => setS2(p => ({ ...p, b2: v })))} <span style={{ color: 'var(--text-dim)' }}>y =</span>
                            {num(s2.c2, v => setS2(p => ({ ...p, c2: v })))}
                        </div>
                    </div>
                )}

                {/* 3-variable system */}
                {mode === 'system-3var' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                        {([
                            { a: 'a1', b: 'b1', c: 'c1', d: 'd1' },
                            { a: 'a2', b: 'b2', c: 'c2', d: 'd2' },
                            { a: 'a3', b: 'b3', c: 'c3', d: 'd3' },
                        ] as const).map((row, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                {num(s3[row.a], v => setS3(p => ({ ...p, [row.a]: v })))} <span style={{ color: 'var(--text-dim)' }}>x +</span>
                                {num(s3[row.b], v => setS3(p => ({ ...p, [row.b]: v })))} <span style={{ color: 'var(--text-dim)' }}>y +</span>
                                {num(s3[row.c], v => setS3(p => ({ ...p, [row.c]: v })))} <span style={{ color: 'var(--text-dim)' }}>z =</span>
                                {num(s3[row.d], v => setS3(p => ({ ...p, [row.d]: v })))}
                            </div>
                        ))}
                    </div>
                )}

                <button className="tool-btn" onClick={solve} style={{ marginBottom: 16 }}>
                    {mode.startsWith('system') ? 'Solve System' : 'Solve Step-by-Step'}
                </button>

                {steps.length > 0 && (
                    <div style={{ border: '1px solid var(--border-warm)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                        {steps.map((step, i) => (
                            <div key={i} style={{
                                display: 'flex', gap: 16, padding: '14px 20px',
                                borderBottom: i < steps.length - 1 ? '1px solid var(--border-light)' : 'none',
                                background: i === steps.length - 1 ? 'var(--amber-soft)' : 'transparent',
                            }}>
                                <div style={{
                                    minWidth: 28, height: 28, borderRadius: '50%',
                                    background: i === steps.length - 1 ? 'var(--amber)' : 'var(--bg-secondary)',
                                    color: i === steps.length - 1 ? 'var(--bg-primary)' : 'var(--text-dim)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '0.75rem', fontWeight: 700, flexShrink: 0,
                                }}>
                                    {step.label ? i + 1 : ''}
                                </div>
                                <div>
                                    {step.label && (
                                        <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            {step.label}
                                        </div>
                                    )}
                                    <div style={{
                                        fontSize: '1.05rem', fontFamily: 'monospace',
                                        color: i === steps.length - 1 ? 'var(--amber)' : 'var(--text-primary)',
                                        fontWeight: i === steps.length - 1 ? 700 : 400,
                                    }}>
                                        {step.expr}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
