import { useState } from 'react';

interface Step { label: string; expr: string; }

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

export default function EquationSolver() {
    const [mode, setMode] = useState<'linear' | 'quadratic'>('quadratic');
    const [a, setA] = useState(1);
    const [b, setB] = useState(-5);
    const [c, setC] = useState(6);
    const [steps, setSteps] = useState<Step[]>([]);

    const solve = () => {
        if (mode === 'quadratic') {
            setSteps(solveQuadratic(a, b, c));
        } else {
            setSteps(solveLinear(a, b));
        }
    };

    return (
        <div className="tool-card">
            <div className="tool-card-header">
                <h3>Equation Solver</h3>
                <span className="subject-topic" style={{ background: 'var(--amber-soft)', color: 'var(--amber)' }}>Algebra</span>
            </div>
            <div className="tool-card-body">
                <div className="tool-controls-row tool-controls-row--4">
                    <div className="tool-input-group">
                        <label>Type</label>
                        <select className="tool-input" value={mode} onChange={e => { setMode(e.target.value as 'linear' | 'quadratic'); setSteps([]); }}>
                            <option value="linear">Linear (ax + b = 0)</option>
                            <option value="quadratic">Quadratic (ax² + bx + c = 0)</option>
                        </select>
                    </div>
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

                <button className="tool-btn" onClick={solve} style={{ marginBottom: 16 }}>
                    Solve Step-by-Step
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
                                    {i + 1}
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        {step.label}
                                    </div>
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
