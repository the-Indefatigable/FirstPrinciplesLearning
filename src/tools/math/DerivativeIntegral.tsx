import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { derivative, parse, simplify, compile, type MathNode } from 'mathjs';
import katex from 'katex';
import 'katex/dist/katex.min.css';

/* ─── Types ─── */
type Tab = 'derivative' | 'integral';
type StepEntry = { label: string; latex: string };

/* ─── KaTeX renderer ─── */
function Tex({ math, display = false }: { math: string; display?: boolean }) {
    const ref = useRef<HTMLSpanElement>(null);
    useEffect(() => {
        if (!ref.current) return;
        try {
            katex.render(math, ref.current, {
                displayMode: display,
                throwOnError: false,
                trust: true,
            });
        } catch {
            ref.current.textContent = math;
        }
    }, [math, display]);
    return <span ref={ref} />;
}

/* ─── Math keyboard keys ─── */
const KEYBOARD_ROWS = [
    [
        { label: 'x', insert: 'x' },
        { label: 'y', insert: 'y' },
        { label: '(', insert: '(' },
        { label: ')', insert: ')' },
        { label: '^', insert: '^' },
        { label: '/', insert: '/' },
        { label: '*', insert: '*' },
    ],
    [
        { label: 'sin', insert: 'sin(' },
        { label: 'cos', insert: 'cos(' },
        { label: 'tan', insert: 'tan(' },
        { label: 'ln', insert: 'log(' },
        { label: 'e^x', insert: 'exp(' },
        { label: 'sqrt', insert: 'sqrt(' },
        { label: 'pi', insert: 'pi' },
    ],
    [
        { label: '7', insert: '7' },
        { label: '8', insert: '8' },
        { label: '9', insert: '9' },
        { label: '4', insert: '4' },
        { label: '5', insert: '5' },
        { label: '6', insert: '6' },
        { label: '+', insert: '+' },
    ],
    [
        { label: '1', insert: '1' },
        { label: '2', insert: '2' },
        { label: '3', insert: '3' },
        { label: '0', insert: '0' },
        { label: '.', insert: '.' },
        { label: '-', insert: '-' },
        { label: 'e', insert: 'e' },
    ],
];

/* ─── Convert mathjs expression to LaTeX ─── */
function toLatex(node: MathNode): string {
    try {
        return node.toTex({ parenthesis: 'auto', implicit: 'hide' });
    } catch {
        return node.toString();
    }
}

/* ─── Try to generate differentiation steps ─── */
function derivativeSteps(expr: string, variable: string, order: number): StepEntry[] {
    const steps: StepEntry[] = [];
    try {
        const original = parse(expr);
        steps.push({
            label: 'Original function',
            latex: `f(${variable}) = ${toLatex(original)}`,
        });

        let current = expr;
        for (let i = 1; i <= order; i++) {
            const d = derivative(current, variable);
            const simplified = simplify(d);
            const ordLabel = order === 1 ? '' : i === 1 ? '1st' : i === 2 ? '2nd' : i === 3 ? '3rd' : `${i}th`;
            const notation = order === 1
                ? `f'(${variable})`
                : `f^{(${i})}(${variable})`;

            steps.push({
                label: order === 1 ? 'Apply differentiation rules' : `${ordLabel} derivative`,
                latex: `${notation} = ${toLatex(simplified)}`,
            });
            current = simplified.toString();
        }
    } catch (e) {
        steps.push({
            label: 'Error',
            latex: `\\text{${e instanceof Error ? e.message : 'Could not differentiate'}}`,
        });
    }
    return steps;
}

/* ─── Symbolic integration (power rule + trig + exp + log) ─── */
function symbolicIntegrate(node: MathNode): string {
    const expr = node.toString();
    const terms = expr
        .replace(/\s/g, '')
        .replace(/-/g, '+-')
        .split('+')
        .filter(Boolean);

    const results: string[] = [];

    for (const term of terms) {
        // coefficient * x^power
        const m = term.match(/^([+-]?\d*\.?\d*)\*?x\^?(\d*\.?\d*)$/);
        if (m) {
            const coeff = m[1] === '' || m[1] === '+' ? 1 : m[1] === '-' ? -1 : parseFloat(m[1]);
            const power = m[2] === '' ? 1 : parseFloat(m[2]);
            if (power === -1) {
                const c = coeff === 1 ? '' : coeff === -1 ? '-' : `${coeff} `;
                results.push(`${c}ln|x|`);
                continue;
            }
            const newPower = power + 1;
            const newCoeff = coeff / newPower;
            const rounded = Math.round(newCoeff * 100000) / 100000;
            if (newPower === 1) results.push(`${rounded}x`);
            else results.push(`${rounded}x^${newPower}`);
            continue;
        }

        // constant
        const mc = term.match(/^([+-]?\d+\.?\d*)$/);
        if (mc) {
            results.push(`${mc[1]}x`);
            continue;
        }

        // common trig / exp
        if (term === 'sin(x)') { results.push('-cos(x)'); continue; }
        if (term === '-sin(x)') { results.push('cos(x)'); continue; }
        if (term === 'cos(x)') { results.push('sin(x)'); continue; }
        if (term === '-cos(x)') { results.push('-sin(x)'); continue; }
        if (term === 'exp(x)' || term === 'e^x') { results.push('exp(x)'); continue; }
        if (term === 'sec(x)^2') { results.push('tan(x)'); continue; }
        if (term === '1/x') { results.push('ln|x|'); continue; }

        // try simplifying
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

/* ─── Integration steps ─── */
function integrationSteps(expr: string, variable: string): StepEntry[] {
    const steps: StepEntry[] = [];
    try {
        const original = parse(expr);
        steps.push({
            label: 'Original function',
            latex: `f(${variable}) = ${toLatex(original)}`,
        });
        steps.push({
            label: 'Set up the integral',
            latex: `\\int f(${variable})\\,d${variable} = \\int ${toLatex(original)}\\,d${variable}`,
        });

        const result = symbolicIntegrate(original);
        const resultNode = parse(result);
        steps.push({
            label: 'Apply integration rules term by term',
            latex: `= ${toLatex(resultNode)} + C`,
        });
    } catch (e) {
        steps.push({
            label: 'Result',
            latex: `\\text{${e instanceof Error ? e.message : 'Symbolic integration not available'}}`,
        });
    }
    return steps;
}

/* ─── Graph component ─── */
function Graph({ expr, derivExpr, variable }: { expr: string; derivExpr: string | null; variable: string }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const parent = canvas.parentElement;
        if (!parent) return;

        const rect = parent.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.scale(dpr, dpr);

        const W = rect.width;
        const H = rect.height;
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

        let fCompiled: ReturnType<typeof compile>;
        let dCompiled: ReturnType<typeof compile> | null = null;

        try {
            fCompiled = compile(expr);
            if (derivExpr) dCompiled = compile(derivExpr);
        } catch {
            ctx.fillStyle = isDark ? '#9c9488' : '#5c544a';
            ctx.font = '14px Sora, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Enter a valid expression to see the graph', W / 2, H / 2);
            return;
        }

        const evalFn = (compiled: ReturnType<typeof compile>, x: number) => {
            try {
                return Number(compiled.evaluate({ [variable]: x, e: Math.E, pi: Math.PI }));
            } catch { return NaN; }
        };

        // Auto-range
        const xMin = -6, xMax = 6;
        let yMin = Infinity, yMax = -Infinity;
        const N = 400;
        for (let i = 0; i <= N; i++) {
            const x = xMin + (xMax - xMin) * (i / N);
            const y = evalFn(fCompiled, x);
            if (isFinite(y)) { yMin = Math.min(yMin, y); yMax = Math.max(yMax, y); }
            if (dCompiled) {
                const dy = evalFn(dCompiled, x);
                if (isFinite(dy)) { yMin = Math.min(yMin, dy); yMax = Math.max(yMax, dy); }
            }
        }
        if (!isFinite(yMin)) { yMin = -5; yMax = 5; }
        const yPad = (yMax - yMin) * 0.15 || 1;
        yMin -= yPad;
        yMax += yPad;

        const toX = (x: number) => ((x - xMin) / (xMax - xMin)) * W;
        const toY = (y: number) => H - ((y - yMin) / (yMax - yMin)) * H;

        // Background
        ctx.fillStyle = isDark ? '#1a1612' : '#faf8f5';
        ctx.fillRect(0, 0, W, H);

        // Grid
        ctx.strokeStyle = isDark ? '#2e2a24' : '#e8e0d4';
        ctx.lineWidth = 0.5;
        for (let x = Math.ceil(xMin); x <= Math.floor(xMax); x++) {
            ctx.beginPath(); ctx.moveTo(toX(x), 0); ctx.lineTo(toX(x), H); ctx.stroke();
        }
        for (let y = Math.ceil(yMin); y <= Math.floor(yMax); y++) {
            ctx.beginPath(); ctx.moveTo(0, toY(y)); ctx.lineTo(W, toY(y)); ctx.stroke();
        }

        // Axes
        ctx.strokeStyle = isDark ? '#6b6358' : '#9c9488';
        ctx.lineWidth = 1.2;
        if (yMin <= 0 && yMax >= 0) {
            ctx.beginPath(); ctx.moveTo(0, toY(0)); ctx.lineTo(W, toY(0)); ctx.stroke();
        }
        if (xMin <= 0 && xMax >= 0) {
            ctx.beginPath(); ctx.moveTo(toX(0), 0); ctx.lineTo(toX(0), H); ctx.stroke();
        }

        // Axis labels
        ctx.fillStyle = isDark ? '#6b6358' : '#9c9488';
        ctx.font = '10px Sora, sans-serif';
        ctx.textAlign = 'center';
        for (let x = Math.ceil(xMin); x <= Math.floor(xMax); x++) {
            if (x === 0) continue;
            const px = toX(x);
            const py = yMin <= 0 && yMax >= 0 ? toY(0) + 14 : H - 4;
            ctx.fillText(String(x), px, py);
        }
        ctx.textAlign = 'right';
        for (let y = Math.ceil(yMin); y <= Math.floor(yMax); y++) {
            if (y === 0) continue;
            const px = xMin <= 0 && xMax >= 0 ? toX(0) - 6 : 20;
            ctx.fillText(String(y), px, toY(y) + 4);
        }

        // Draw curve helper
        const drawCurve = (compiled: ReturnType<typeof compile>, color: string, width: number, dashed = false) => {
            ctx.strokeStyle = color;
            ctx.lineWidth = width;
            ctx.setLineDash(dashed ? [6, 4] : []);
            ctx.beginPath();
            let started = false;
            for (let i = 0; i <= N; i++) {
                const x = xMin + (xMax - xMin) * (i / N);
                const y = evalFn(compiled, x);
                if (!isFinite(y) || Math.abs(y) > 1e6) { started = false; continue; }
                if (!started) { ctx.moveTo(toX(x), toY(y)); started = true; }
                else ctx.lineTo(toX(x), toY(y));
            }
            ctx.stroke();
            ctx.setLineDash([]);
        };

        // f(x)
        drawCurve(fCompiled, isDark ? '#f59e0b' : '#d97706', 2.5);

        // f'(x)
        if (dCompiled) {
            drawCurve(dCompiled, isDark ? '#86efac' : '#6b8f71', 2, true);
        }

        // Legend
        const legendY = 16;
        ctx.font = '12px Sora, sans-serif';
        ctx.textAlign = 'left';
        // f(x)
        ctx.fillStyle = isDark ? '#f59e0b' : '#d97706';
        ctx.fillRect(8, legendY - 6, 16, 3);
        ctx.fillText('f(x)', 28, legendY);
        // f'(x)
        if (dCompiled) {
            ctx.fillStyle = isDark ? '#86efac' : '#6b8f71';
            ctx.setLineDash([4, 3]);
            ctx.strokeStyle = isDark ? '#86efac' : '#6b8f71';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(8, legendY + 16); ctx.lineTo(24, legendY + 16); ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillText("f'(x)", 28, legendY + 20);
        }
    }, [expr, derivExpr, variable]);

    return (
        <div style={{
            width: '100%',
            aspectRatio: '2 / 1',
            minHeight: 220,
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-warm)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
        }}>
            <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
        </div>
    );
}

/* ─── Main Component ─── */
export default function DerivativeIntegral() {
    const [expr, setExpr] = useState('x^3 + 2*x^2 - 5*x + 3');
    const [variable, setVariable] = useState('x');
    const [order, setOrder] = useState(1);
    const [tab, setTab] = useState<Tab>('derivative');
    const [showKeyboard, setShowKeyboard] = useState(false);
    const [steps, setSteps] = useState<StepEntry[]>([]);
    const [finalResult, setFinalResult] = useState('');
    const [derivExpr, setDerivExpr] = useState<string | null>(null);
    const [hasComputed, setHasComputed] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const compute = useCallback(() => {
        setHasComputed(true);
        if (tab === 'derivative') {
            const s = derivativeSteps(expr, variable, order);
            setSteps(s);
            // Extract final result for graph
            try {
                let current = expr;
                for (let i = 0; i < order; i++) {
                    current = simplify(derivative(current, variable)).toString();
                }
                setDerivExpr(current);
                const finalNode = parse(current);
                setFinalResult(toLatex(finalNode));
            } catch {
                setDerivExpr(null);
                setFinalResult('');
            }
        } else {
            const s = integrationSteps(expr, variable);
            setSteps(s);
            setDerivExpr(null);
            try {
                const result = symbolicIntegrate(parse(expr));
                setFinalResult(toLatex(parse(result)) + ' + C');
            } catch {
                setFinalResult('');
            }
        }
    }, [expr, variable, order, tab]);

    const insertAtCursor = useCallback((text: string) => {
        const input = inputRef.current;
        if (!input) {
            setExpr(prev => prev + text);
            return;
        }
        const start = input.selectionStart ?? expr.length;
        const end = input.selectionEnd ?? expr.length;
        const newVal = expr.slice(0, start) + text + expr.slice(end);
        setExpr(newVal);
        // Restore cursor position after React re-render
        requestAnimationFrame(() => {
            input.focus();
            const pos = start + text.length;
            input.setSelectionRange(pos, pos);
        });
    }, [expr]);

    const previewLatex = useMemo(() => {
        try {
            const node = parse(expr);
            return toLatex(node);
        } catch {
            return expr;
        }
    }, [expr]);

    return (
        <div className="tool-card" style={{ maxWidth: 860, margin: '0 auto' }}>
            <div className="tool-card-header">
                <h3>Differentiation & Integration</h3>
                <span className="subject-topic" style={{ background: 'var(--amber-soft)', color: 'var(--amber)' }}>
                    Calculus
                </span>
            </div>
            <div className="tool-card-body">
                {/* ── Tab bar ── */}
                <div style={{
                    display: 'flex',
                    gap: 0,
                    marginBottom: 24,
                    borderRadius: 'var(--radius-sm)',
                    overflow: 'hidden',
                    border: '1px solid var(--border-warm)',
                }}>
                    {(['derivative', 'integral'] as Tab[]).map(t => (
                        <button
                            key={t}
                            onClick={() => { setTab(t); setSteps([]); setHasComputed(false); }}
                            style={{
                                flex: 1,
                                padding: '12px 0',
                                border: 'none',
                                cursor: 'pointer',
                                fontFamily: 'var(--font-sans)',
                                fontSize: '0.9rem',
                                fontWeight: 600,
                                letterSpacing: 0.3,
                                background: tab === t ? 'var(--amber)' : 'var(--bg-secondary)',
                                color: tab === t ? '#fff' : 'var(--text-secondary)',
                                transition: 'all 0.2s',
                            }}
                        >
                            {t === 'derivative' ? 'd/dx  Derivative' : '\u222B  Integral'}
                        </button>
                    ))}
                </div>

                {/* ── Input area ── */}
                <div style={{ marginBottom: 20 }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 6,
                    }}>
                        <label style={{
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: 0.8,
                            color: 'var(--text-dim)',
                        }}>
                            Enter function
                        </label>
                        <button
                            onClick={() => setShowKeyboard(k => !k)}
                            style={{
                                background: showKeyboard ? 'var(--amber)' : 'var(--bg-secondary)',
                                color: showKeyboard ? '#fff' : 'var(--text-secondary)',
                                border: '1px solid var(--border-warm)',
                                borderRadius: 'var(--radius-sm)',
                                padding: '4px 12px',
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                            }}
                        >
                            {showKeyboard ? 'Hide Keyboard' : 'Math Keyboard'}
                        </button>
                    </div>

                    {/* Live preview */}
                    <div style={{
                        padding: '10px 16px',
                        background: 'var(--bg-secondary)',
                        borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
                        borderBottom: '1px solid var(--border-warm)',
                        minHeight: 36,
                        display: 'flex',
                        alignItems: 'center',
                        fontSize: '1.15rem',
                    }}>
                        <span style={{ color: 'var(--text-dim)', marginRight: 8, fontSize: '0.85rem', fontWeight: 600 }}>
                            f({variable}) =
                        </span>
                        <Tex math={previewLatex} />
                    </div>

                    <input
                        ref={inputRef}
                        className="tool-input"
                        value={expr}
                        onChange={e => setExpr(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && compute()}
                        placeholder="e.g. x^3 + sin(x)"
                        style={{
                            borderRadius: '0 0 var(--radius-sm) var(--radius-sm)',
                            borderTop: 'none',
                            fontFamily: 'monospace',
                            fontSize: '0.95rem',
                        }}
                    />
                </div>

                {/* ── Math Keyboard ── */}
                {showKeyboard && (
                    <div style={{
                        marginBottom: 20,
                        padding: 12,
                        background: 'var(--bg-secondary)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-warm)',
                    }}>
                        {KEYBOARD_ROWS.map((row, ri) => (
                            <div key={ri} style={{
                                display: 'flex',
                                gap: 6,
                                marginBottom: ri < KEYBOARD_ROWS.length - 1 ? 6 : 0,
                                justifyContent: 'center',
                            }}>
                                {row.map(k => (
                                    <button
                                        key={k.label}
                                        onClick={() => insertAtCursor(k.insert)}
                                        style={{
                                            flex: '1 1 0',
                                            maxWidth: 72,
                                            padding: '10px 4px',
                                            border: '1px solid var(--border-warm)',
                                            borderRadius: 'var(--radius-sm)',
                                            background: 'var(--bg-card)',
                                            color: 'var(--text-primary)',
                                            fontFamily: 'var(--font-sans)',
                                            fontSize: '0.85rem',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            transition: 'all 0.15s',
                                        }}
                                        onMouseDown={e => e.preventDefault()} // prevent input blur
                                    >
                                        {k.label}
                                    </button>
                                ))}
                            </div>
                        ))}
                        <div style={{ display: 'flex', gap: 6, marginTop: 6, justifyContent: 'center' }}>
                            <button
                                onClick={() => {
                                    const input = inputRef.current;
                                    if (input) {
                                        const start = input.selectionStart ?? expr.length;
                                        if (start > 0) {
                                            setExpr(expr.slice(0, start - 1) + expr.slice(start));
                                            requestAnimationFrame(() => {
                                                input.focus();
                                                input.setSelectionRange(start - 1, start - 1);
                                            });
                                        }
                                    } else {
                                        setExpr(expr.slice(0, -1));
                                    }
                                }}
                                onMouseDown={e => e.preventDefault()}
                                style={{
                                    flex: '1 1 0',
                                    maxWidth: 110,
                                    padding: '10px 4px',
                                    border: '1px solid var(--border-warm)',
                                    borderRadius: 'var(--radius-sm)',
                                    background: 'var(--terracotta-glow)',
                                    color: 'var(--terracotta)',
                                    fontFamily: 'var(--font-sans)',
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                }}
                            >
                                Backspace
                            </button>
                            <button
                                onClick={() => setExpr('')}
                                onMouseDown={e => e.preventDefault()}
                                style={{
                                    flex: '1 1 0',
                                    maxWidth: 110,
                                    padding: '10px 4px',
                                    border: '1px solid var(--border-warm)',
                                    borderRadius: 'var(--radius-sm)',
                                    background: 'var(--terracotta-glow)',
                                    color: 'var(--terracotta)',
                                    fontFamily: 'var(--font-sans)',
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                }}
                            >
                                Clear
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Options row ── */}
                <div style={{
                    display: 'flex',
                    gap: 16,
                    alignItems: 'flex-end',
                    marginBottom: 20,
                    flexWrap: 'wrap',
                }}>
                    <div className="tool-input-group" style={{ flex: '0 0 100px', marginBottom: 0 }}>
                        <label>Variable</label>
                        <select
                            className="tool-input"
                            value={variable}
                            onChange={e => setVariable(e.target.value)}
                        >
                            <option value="x">x</option>
                            <option value="y">y</option>
                            <option value="t">t</option>
                        </select>
                    </div>

                    {tab === 'derivative' && (
                        <div className="tool-input-group" style={{ flex: '0 0 120px', marginBottom: 0 }}>
                            <label>Order (n)</label>
                            <select
                                className="tool-input"
                                value={order}
                                onChange={e => setOrder(Number(e.target.value))}
                            >
                                {[1, 2, 3, 4, 5].map(n => (
                                    <option key={n} value={n}>
                                        {n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <button className="tool-btn tool-btn--amber" onClick={compute} style={{ marginBottom: 0 }}>
                        {tab === 'derivative' ? 'Differentiate' : 'Integrate'}
                    </button>
                </div>

                {/* ── Results ── */}
                {hasComputed && steps.length > 0 && (
                    <div style={{ marginBottom: 24 }}>
                        {/* Final result banner */}
                        {finalResult && (
                            <div style={{
                                padding: '16px 20px',
                                background: tab === 'derivative'
                                    ? 'linear-gradient(135deg, rgba(107,143,113,0.08), rgba(107,143,113,0.15))'
                                    : 'linear-gradient(135deg, rgba(217,119,6,0.08), rgba(217,119,6,0.15))',
                                border: `1px solid ${tab === 'derivative' ? 'var(--sage-light)' : 'var(--amber)'}`,
                                borderRadius: 'var(--radius-md)',
                                marginBottom: 20,
                                textAlign: 'center',
                            }}>
                                <div style={{
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    letterSpacing: 1.2,
                                    color: tab === 'derivative' ? 'var(--sage)' : 'var(--amber)',
                                    marginBottom: 8,
                                }}>
                                    {tab === 'derivative' ? 'Result' : 'Indefinite Integral'}
                                </div>
                                <div style={{ fontSize: '1.3rem' }}>
                                    <Tex
                                        math={tab === 'derivative'
                                            ? `${order === 1 ? `f'(${variable})` : `f^{(${order})}(${variable})`} = ${finalResult}`
                                            : `\\int f(${variable})\\,d${variable} = ${finalResult}`
                                        }
                                        display
                                    />
                                </div>
                            </div>
                        )}

                        {/* Step-by-step */}
                        <div style={{
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: 1,
                            color: 'var(--text-dim)',
                            marginBottom: 12,
                        }}>
                            Step-by-step
                        </div>
                        <div style={{
                            border: '1px solid var(--border-warm)',
                            borderRadius: 'var(--radius-md)',
                            overflow: 'hidden',
                        }}>
                            {steps.map((step, i) => (
                                <div
                                    key={i}
                                    style={{
                                        display: 'flex',
                                        gap: 16,
                                        alignItems: 'center',
                                        padding: '14px 20px',
                                        background: i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-secondary)',
                                        borderBottom: i < steps.length - 1 ? '1px solid var(--border-light)' : 'none',
                                    }}
                                >
                                    <span style={{
                                        flex: '0 0 24px',
                                        width: 24,
                                        height: 24,
                                        borderRadius: '50%',
                                        background: 'var(--amber)',
                                        color: '#fff',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '0.72rem',
                                        fontWeight: 700,
                                    }}>
                                        {i + 1}
                                    </span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{
                                            fontSize: '0.78rem',
                                            fontWeight: 600,
                                            color: 'var(--text-dim)',
                                            marginBottom: 4,
                                        }}>
                                            {step.label}
                                        </div>
                                        <div style={{ fontSize: '1.05rem', overflowX: 'auto' }}>
                                            <Tex math={step.latex} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Graph ── */}
                {hasComputed && (
                    <div>
                        <div style={{
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: 1,
                            color: 'var(--text-dim)',
                            marginBottom: 12,
                        }}>
                            Graph
                        </div>
                        <Graph expr={expr} derivExpr={tab === 'derivative' ? derivExpr : null} variable={variable} />
                        <div style={{
                            display: 'flex',
                            gap: 20,
                            marginTop: 8,
                            fontSize: '0.8rem',
                            color: 'var(--text-dim)',
                        }}>
                            <span>
                                <span style={{
                                    display: 'inline-block',
                                    width: 16,
                                    height: 3,
                                    background: 'var(--amber)',
                                    borderRadius: 2,
                                    verticalAlign: 'middle',
                                    marginRight: 6,
                                }} />
                                f({variable})
                            </span>
                            {tab === 'derivative' && derivExpr && (
                                <span>
                                    <span style={{
                                        display: 'inline-block',
                                        width: 16,
                                        height: 3,
                                        background: 'var(--sage)',
                                        borderRadius: 2,
                                        verticalAlign: 'middle',
                                        marginRight: 6,
                                        borderTop: '2px dashed var(--sage)',
                                    }} />
                                    f'({variable})
                                </span>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
