import { useState, useCallback, useMemo, useRef } from 'react';

type GateType = 'AND' | 'OR' | 'NOT' | 'NAND' | 'NOR' | 'XOR' | 'XNOR';

interface Gate {
    id: string;
    type: GateType;
    in0: string; // input name ('A','B','C','D') or gate id ('g1','g2'...)
    in1: string; // same — ignored for NOT
}

const GATE_FN: Record<GateType, (a: boolean, b: boolean) => boolean> = {
    AND:  (a, b) => a && b,
    OR:   (a, b) => a || b,
    NOT:  (a)    => !a,
    NAND: (a, b) => !(a && b),
    NOR:  (a, b) => !(a || b),
    XOR:  (a, b) => a !== b,
    XNOR: (a, b) => a === b,
};

const GATE_COLORS: Record<GateType, string> = {
    AND: '#3b82f6', OR: '#22c55e', NOT: '#ef4444',
    NAND: '#8b5cf6', NOR: '#f59e0b', XOR: '#06b6d4', XNOR: '#ec4899',
};

const INPUT_NAMES = ['A', 'B', 'C', 'D'];

// Evaluate all gates in order; each gate can reference any earlier gate or input
function evaluate(inputs: Record<string, boolean>, gates: Gate[]): Record<string, boolean> {
    const vals: Record<string, boolean> = { ...inputs };
    for (const g of gates) {
        const a = vals[g.in0] ?? false;
        const b = vals[g.in1] ?? false;
        vals[g.id] = GATE_FN[g.type](a, b);
    }
    return vals;
}

// Build readable boolean expression for a gate (recursive)
function buildExpr(src: string, gates: Gate[], depth = 0): string {
    if (depth > 6) return src; // guard against deep nesting display
    if (INPUT_NAMES.includes(src)) return src;
    const g = gates.find(x => x.id === src);
    if (!g) return src;
    const a = buildExpr(g.in0, gates, depth + 1);
    if (g.type === 'NOT') return `¬${a}`;
    const b = buildExpr(g.in1, gates, depth + 1);
    const op: Record<GateType, string> = {
        AND: '·', OR: '+', NAND: '↑', NOR: '↓', XOR: '⊕', XNOR: '⊙', NOT: '¬',
    };
    return `(${a} ${op[g.type]} ${b})`;
}

// Return only the input names actually reachable from a gate
function reachableInputs(gateId: string, gates: Gate[]): string[] {
    const seen = new Set<string>();
    function walk(src: string) {
        if (INPUT_NAMES.includes(src)) { seen.add(src); return; }
        const g = gates.find(x => x.id === src);
        if (!g) return;
        walk(g.in0);
        if (g.type !== 'NOT') walk(g.in1);
    }
    walk(gateId);
    return INPUT_NAMES.filter(n => seen.has(n));
}

const thStyle: React.CSSProperties = {
    padding: '5px 10px', textAlign: 'center', fontWeight: 700, color: 'var(--text-dim)', fontSize: '0.78rem',
};
const tdStyle: React.CSSProperties = { padding: '4px 10px', textAlign: 'center' };
const bitStyle = (on: boolean, bold = false): React.CSSProperties => ({
    display: 'inline-block', width: 22, height: 22, lineHeight: '22px',
    borderRadius: 4, color: '#fff', fontWeight: bold ? 800 : 600,
    textAlign: 'center', fontSize: '0.78rem',
    background: on ? '#22c55e' : '#ef4444',
});
const srcSelect: React.CSSProperties = {
    padding: '2px 6px', borderRadius: 4, fontSize: '0.74rem', fontWeight: 600,
    border: '1px solid var(--border-warm)', background: 'var(--bg-primary)',
    color: 'var(--text-primary)', cursor: 'pointer',
};

export default function LogicGateSim() {
    const counterRef = useRef(2); // g1, g2 used by defaults

    const [inputs, setInputs] = useState<Record<string, boolean>>({
        A: true, B: false, C: false, D: false,
    });
    const [gates, setGates] = useState<Gate[]>([
        { id: 'g1', type: 'AND', in0: 'A', in1: 'B' },
        { id: 'g2', type: 'OR',  in0: 'g1', in1: 'C' },
    ]);
    const [addType, setAddType] = useState<GateType>('AND');

    // Live values for all signals
    const values = useMemo(() => evaluate(inputs, gates), [inputs, gates]);

    const toggleInput = useCallback((name: string) => {
        setInputs(prev => ({ ...prev, [name]: !prev[name] }));
    }, []);

    const addGate = useCallback(() => {
        counterRef.current++;
        const id = `g${counterRef.current}`;
        const available = [...INPUT_NAMES, ...gates.map(g => g.id)];
        setGates(prev => [...prev, {
            id, type: addType,
            in0: available[0] ?? 'A',
            in1: available[1] ?? 'A',
        }]);
    }, [addType, gates]);

    const removeGate = useCallback((id: string) => {
        setGates(prev => {
            const kept = prev.filter(g => g.id !== id);
            // Remap any reference to the removed gate → 'A'
            return kept.map(g => ({
                ...g,
                in0: g.in0 === id ? 'A' : g.in0,
                in1: g.in1 === id ? 'A' : g.in1,
            }));
        });
    }, []);

    const setGateType = useCallback((id: string, type: GateType) => {
        setGates(prev => prev.map(g => g.id === id ? { ...g, type } : g));
    }, []);

    const setGateSrc = useCallback((id: string, pin: 0 | 1, src: string) => {
        setGates(prev => prev.map(g =>
            g.id === id ? { ...g, [pin === 0 ? 'in0' : 'in1']: src } : g
        ));
    }, []);

    // Truth table — only for the last gate, only over inputs it actually uses
    const lastGate = gates[gates.length - 1] ?? null;
    const usedInputs = useMemo(
        () => lastGate ? reachableInputs(lastGate.id, gates) : [],
        [lastGate, gates]
    );
    const truthTable = useMemo(() => {
        if (!lastGate || usedInputs.length === 0) return [];
        const n = usedInputs.length;
        const rows: Array<{ ins: Record<string, boolean>; out: boolean }> = [];
        for (let mask = 0; mask < (1 << n); mask++) {
            const ins: Record<string, boolean> = { ...inputs }; // carry through non-table inputs
            usedInputs.forEach((name, i) => { ins[name] = !!(mask & (1 << (n - 1 - i))); });
            const vals = evaluate(ins, gates);
            rows.push({ ins, out: vals[lastGate.id] });
        }
        return rows;
    }, [lastGate, gates, usedInputs, inputs]);

    return (
        <div className="tool-card">
            <div className="tool-card-header">
                <h3>Logic Gate Simulator</h3>
                <span className="subject-topic" style={{ background: 'rgba(194,113,79,0.12)', color: '#c2714f' }}>
                    Digital Logic
                </span>
            </div>
            <div className="tool-card-body">

                {/* ── Input signals ── */}
                <div style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                        Input Signals — click to toggle
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {INPUT_NAMES.map(name => (
                            <button key={name} onClick={() => toggleInput(name)}
                                style={{
                                    padding: '7px 20px', borderRadius: 'var(--radius-sm)',
                                    fontWeight: 800, fontSize: '0.95rem', cursor: 'pointer',
                                    background: inputs[name] ? '#22c55e' : '#ef4444',
                                    color: '#fff', border: 'none', transition: 'all 0.15s',
                                    boxShadow: inputs[name]
                                        ? '0 0 12px rgba(34,197,94,0.35)'
                                        : '0 0 8px rgba(239,68,68,0.25)',
                                }}>
                                {name} = {inputs[name] ? '1' : '0'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Add gate toolbar ── */}
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
                    {(Object.keys(GATE_FN) as GateType[]).map(t => (
                        <button key={t} onClick={() => setAddType(t)}
                            style={{
                                padding: '4px 10px', borderRadius: 'var(--radius-sm)', fontSize: '0.74rem',
                                fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                                background: addType === t ? GATE_COLORS[t] : 'transparent',
                                color: addType === t ? '#fff' : 'var(--text-dim)',
                                border: `1px solid ${addType === t ? GATE_COLORS[t] : 'var(--border-warm)'}`,
                            }}>
                            {t}
                        </button>
                    ))}
                    <button onClick={addGate}
                        style={{
                            padding: '5px 14px', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem',
                            fontWeight: 700, cursor: 'pointer', marginLeft: 4,
                            background: GATE_COLORS[addType], color: '#fff', border: 'none',
                        }}>
                        + Add {addType}
                    </button>
                </div>

                {/* ── Gate chain ── */}
                {gates.length === 0 ? (
                    <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                        Add a gate above to start building a circuit
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
                        {gates.map((gate, idx) => {
                            const color = GATE_COLORS[gate.type];
                            const val = values[gate.id];
                            const isNot = gate.type === 'NOT';
                            // A gate can reference any input or any *earlier* gate
                            const available = [...INPUT_NAMES, ...gates.slice(0, idx).map(g => g.id)];

                            return (
                                <div key={gate.id} style={{
                                    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                                    background: 'var(--bg-secondary)',
                                    border: `1.5px solid ${color}35`,
                                    borderRadius: 'var(--radius-md)', padding: '9px 12px',
                                }}>
                                    {/* Gate output name */}
                                    <code style={{ minWidth: 26, fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                                        {gate.id}
                                    </code>

                                    <span style={{ color: 'var(--text-dim)', fontSize: '0.82rem' }}>=</span>

                                    {/* Gate type */}
                                    <select value={gate.type} onChange={e => setGateType(gate.id, e.target.value as GateType)}
                                        style={{
                                            background: color, color: '#fff', border: 'none', borderRadius: 6,
                                            padding: '3px 8px', fontWeight: 700, fontSize: '0.76rem', cursor: 'pointer',
                                        }}>
                                        {(Object.keys(GATE_FN) as GateType[]).map(t => (
                                            <option key={t} value={t}>{t}</option>
                                        ))}
                                    </select>

                                    {/* Input source pickers */}
                                    <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>(</span>
                                    <select value={gate.in0} onChange={e => setGateSrc(gate.id, 0, e.target.value)} style={srcSelect}>
                                        {available.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>

                                    {!isNot && (
                                        <>
                                            <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>,</span>
                                            <select value={gate.in1} onChange={e => setGateSrc(gate.id, 1, e.target.value)} style={srcSelect}>
                                                {available.map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </>
                                    )}
                                    <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>)</span>

                                    {/* Signal wire */}
                                    <div style={{
                                        flex: 1, minWidth: 24, height: 2,
                                        background: val ? '#22c55e60' : '#9c948840',
                                        borderRadius: 1,
                                    }} />

                                    {/* Output LED */}
                                    <div style={{
                                        width: 36, height: 26, borderRadius: 5,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        background: val ? '#22c55e' : '#ef4444',
                                        color: '#fff', fontWeight: 800, fontSize: '0.88rem',
                                        boxShadow: val ? '0 0 10px rgba(34,197,94,0.4)' : '0 0 8px rgba(239,68,68,0.22)',
                                    }}>
                                        {val ? '1' : '0'}
                                    </div>

                                    {/* Delete */}
                                    <button onClick={() => removeGate(gate.id)}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', fontSize: '0.85rem', padding: '0 2px', lineHeight: 1 }}>
                                        ✕
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* ── Boolean expression ── */}
                {lastGate && (
                    <div style={{
                        marginBottom: 18, padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-secondary)', border: '1px solid var(--border-warm)',
                        fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-secondary)',
                        wordBreak: 'break-word',
                    }}>
                        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-dim)', fontFamily: 'sans-serif', textTransform: 'uppercase', letterSpacing: 1 }}>
                            Expression:{' '}
                        </span>
                        {buildExpr(lastGate.id, gates)} ={' '}
                        <span style={{ fontWeight: 800, color: values[lastGate.id] ? '#22c55e' : '#ef4444' }}>
                            {values[lastGate.id] ? '1' : '0'}
                        </span>
                    </div>
                )}

                {/* ── Truth table ── */}
                {lastGate && usedInputs.length > 0 && (
                    <div style={{
                        background: 'var(--bg-secondary)', border: '1px solid var(--border-warm)',
                        borderRadius: 'var(--radius-sm)', padding: 12,
                    }}>
                        <div style={{ fontWeight: 700, marginBottom: 8, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                            Truth Table — {lastGate.id} (final output)
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ borderCollapse: 'collapse', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid var(--border-warm)' }}>
                                        {usedInputs.map(n => <th key={n} style={thStyle}>{n}</th>)}
                                        <th style={{ ...thStyle, color: GATE_COLORS[lastGate.type] }}>OUT</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {truthTable.map((row, i) => {
                                        const isActive = usedInputs.every(n => row.ins[n] === inputs[n]);
                                        return (
                                            <tr key={i} style={{
                                                borderBottom: '1px solid var(--border-warm)',
                                                background: isActive ? `${GATE_COLORS[lastGate.type]}18` : 'transparent',
                                            }}>
                                                {usedInputs.map(n => (
                                                    <td key={n} style={tdStyle}>
                                                        <span style={bitStyle(row.ins[n])}>{row.ins[n] ? '1' : '0'}</span>
                                                    </td>
                                                ))}
                                                <td style={tdStyle}>
                                                    <span style={bitStyle(row.out, true)}>{row.out ? '1' : '0'}</span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
