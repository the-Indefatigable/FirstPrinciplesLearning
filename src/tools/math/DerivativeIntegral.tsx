import { useState, useCallback } from 'react';
import { derivative, parse, simplify, type MathNode } from 'mathjs';

export default function DerivativeIntegral() {
    const [expr, setExpr] = useState('x^3 + 2*x^2 - 5*x + 3');
    const [derivResult, setDerivResult] = useState('');
    const [integResult, setIntegResult] = useState('');
    const [error, setError] = useState('');

    const compute = useCallback(() => {
        setError('');
        try {
            // Derivative
            const d = derivative(expr, 'x');
            setDerivResult(d.toString());

            // Integration (symbolic — reverse power rule + trig + exp)
            try {
                const node = parse(expr);
                const integrated = symbolicIntegrate(node);
                setIntegResult(integrated + ' + C');
            } catch {
                setIntegResult('Symbolic integration not available for this expression');
            }
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Invalid expression';
            setError(msg);
            setDerivResult('');
            setIntegResult('');
        }
    }, [expr]);

    return (
        <div className="tool-card">
            <div className="tool-card-header">
                <h3>Differentiation & Integration</h3>
            </div>
            <div className="tool-card-body">
                <div className="tool-input-group">
                    <label>f(x) =</label>
                    <input
                        className="tool-input"
                        value={expr}
                        onChange={(e) => setExpr(e.target.value)}
                        placeholder="e.g. x^3 + sin(x)"
                        onKeyDown={(e) => e.key === 'Enter' && compute()}
                    />
                </div>
                <div style={{ marginBottom: 20 }}>
                    <button className="tool-btn" onClick={compute}>Compute →</button>
                </div>
                {error && <div className="tool-result" style={{ color: '#e74c3c', borderColor: '#e74c3c33' }}>{error}</div>}
                {!error && derivResult && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div>
                            <div style={{ fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-dim)', marginBottom: 8 }}>
                                d/dx [ f(x) ]
                            </div>
                            <div className="tool-result">{derivResult}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-dim)', marginBottom: 8 }}>
                                ∫ f(x) dx
                            </div>
                            <div className="tool-result">{integResult}</div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// Basic symbolic integration via term-by-term power rule
function symbolicIntegrate(node: MathNode): string {
    const expr = node.toString();

    // Split into terms
    const terms = expr
        .replace(/\s/g, '')
        .replace(/-/g, '+-')
        .split('+')
        .filter(Boolean);

    const results: string[] = [];

    for (const term of terms) {
        // Match: coefficient * x^power
        const m = term.match(/^([+-]?\d*\.?\d*)\*?x\^?(\d*\.?\d*)$/);
        if (m) {
            const coeff = m[1] === '' || m[1] === '+' ? 1 : m[1] === '-' ? -1 : parseFloat(m[1]);
            const power = m[2] === '' ? 1 : parseFloat(m[2]);
            const newPower = power + 1;
            const newCoeff = coeff / newPower;
            const rounded = Math.round(newCoeff * 10000) / 10000;
            if (newPower === 1) results.push(`${rounded}x`);
            else results.push(`${rounded}x^${newPower}`);
            continue;
        }

        // Match: constant
        const mc = term.match(/^([+-]?\d+\.?\d*)$/);
        if (mc) {
            results.push(`${mc[1]}x`);
            continue;
        }

        // Match: sin(x), cos(x), e^x
        if (term === 'sin(x)') { results.push('-cos(x)'); continue; }
        if (term === 'cos(x)') { results.push('sin(x)'); continue; }
        if (term === 'exp(x)' || term === 'e^x') { results.push('exp(x)'); continue; }

        // Simplify and try again
        try {
            const simplified = simplify(term).toString();
            if (simplified !== term) {
                results.push(symbolicIntegrate(parse(simplified)));
                continue;
            }
        } catch { /* skip */ }

        throw new Error('Cannot integrate: ' + term);
    }

    return results.join(' + ').replace(/\+ -/g, '- ');
}
