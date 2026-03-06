import { useState, useCallback } from 'react';

type GateType = 'AND' | 'OR' | 'NOT' | 'NAND' | 'NOR' | 'XOR' | 'XNOR';

interface Gate {
    id: number;
    type: GateType;
    inputs: [boolean, boolean];
}

const GATE_FN: Record<GateType, (a: boolean, b: boolean) => boolean> = {
    AND: (a, b) => a && b,
    OR: (a, b) => a || b,
    NOT: (a) => !a,
    NAND: (a, b) => !(a && b),
    NOR: (a, b) => !(a || b),
    XOR: (a, b) => a !== b,
    XNOR: (a, b) => a === b,
};

const GATE_SYMBOL: Record<GateType, string> = {
    AND: '&', OR: '≥1', NOT: '1', NAND: '&̶', NOR: '≥̶1', XOR: '=1', XNOR: '=̶1',
};

const GATE_COLORS: Record<GateType, string> = {
    AND: '#3b82f6', OR: '#22c55e', NOT: '#ef4444', NAND: '#8b5cf6', NOR: '#f59e0b', XOR: '#06b6d4', XNOR: '#ec4899',
};

let nextId = 1;

export default function LogicGateSim() {
    const [gates, setGates] = useState<Gate[]>([
        { id: nextId++, type: 'AND', inputs: [true, false] },
    ]);
    const [selectedType, setSelectedType] = useState<GateType>('AND');

    const addGate = useCallback(() => {
        setGates(prev => [...prev, { id: nextId++, type: selectedType, inputs: [false, false] }]);
    }, [selectedType]);

    const removeGate = useCallback((id: number) => {
        setGates(prev => prev.filter(g => g.id !== id));
    }, []);

    const toggleInput = useCallback((id: number, idx: 0 | 1) => {
        setGates(prev => prev.map(g => {
            if (g.id !== id) return g;
            const inputs: [boolean, boolean] = [...g.inputs] as [boolean, boolean];
            inputs[idx] = !inputs[idx];
            return { ...g, inputs };
        }));
    }, []);

    const changeType = useCallback((id: number, type: GateType) => {
        setGates(prev => prev.map(g => g.id === id ? { ...g, type } : g));
    }, []);

    // Generate truth table for selected gate type
    const truthTable = (() => {
        const fn = GATE_FN[selectedType];
        if (selectedType === 'NOT') {
            return [
                { a: false, b: false, out: fn(false, false) },
                { a: true, b: false, out: fn(true, false) },
            ];
        }
        return [
            { a: false, b: false, out: fn(false, false) },
            { a: false, b: true, out: fn(false, true) },
            { a: true, b: false, out: fn(true, false) },
            { a: true, b: true, out: fn(true, true) },
        ];
    })();

    return (
        <div className="tool-card">
            <div className="tool-card-header">
                <h3>Logic Gate Simulator</h3>
                <span className="subject-topic" style={{ background: 'rgba(194,113,79,0.12)', color: '#c2714f' }}>Digital Logic</span>
            </div>
            <div className="tool-card-body">
                {/* Gate type selector */}
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
                    {(Object.keys(GATE_FN) as GateType[]).map(t => (
                        <button key={t} onClick={() => setSelectedType(t)}
                            style={{
                                padding: '5px 12px', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem',
                                fontWeight: 700, cursor: 'pointer',
                                background: selectedType === t ? GATE_COLORS[t] : 'transparent',
                                color: selectedType === t ? '#fff' : 'var(--text-dim)',
                                border: `1px solid ${selectedType === t ? GATE_COLORS[t] : 'var(--border-warm)'}`,
                                transition: 'all 0.15s',
                            }}>
                            {t}
                        </button>
                    ))}
                </div>

                <button className="btn-primary" onClick={addGate} style={{ fontSize: '0.82rem', padding: '7px 18px', marginBottom: 14 }}>
                    + Add {selectedType} Gate
                </button>

                {/* Gates workspace */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginBottom: 16 }}>
                    {gates.map(gate => {
                        const fn = GATE_FN[gate.type];
                        const output = fn(gate.inputs[0], gate.inputs[1]);
                        const color = GATE_COLORS[gate.type];
                        const isNot = gate.type === 'NOT';

                        return (
                            <div key={gate.id} style={{
                                background: 'var(--bg-secondary)', border: `1.5px solid ${color}30`,
                                borderRadius: 'var(--radius-md)', padding: 14, position: 'relative',
                            }}>
                                {/* Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                    <select value={gate.type} onChange={e => changeType(gate.id, e.target.value as GateType)}
                                        style={{
                                            background: color, color: '#fff', border: 'none', borderRadius: 4,
                                            padding: '2px 8px', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer',
                                        }}>
                                        {(Object.keys(GATE_FN) as GateType[]).map(t => (
                                            <option key={t} value={t}>{t}</option>
                                        ))}
                                    </select>
                                    <button onClick={() => removeGate(gate.id)}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', fontSize: '1rem' }}>
                                        ✕
                                    </button>
                                </div>

                                {/* Gate visual */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                                    {/* Inputs */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <button onClick={() => toggleInput(gate.id, 0)}
                                            style={{
                                                width: 32, height: 24, borderRadius: 4, cursor: 'pointer',
                                                background: gate.inputs[0] ? '#22c55e' : '#ef4444',
                                                color: '#fff', fontWeight: 700, fontSize: '0.75rem',
                                                border: 'none',
                                            }}>
                                            {gate.inputs[0] ? '1' : '0'}
                                        </button>
                                        {!isNot && (
                                            <button onClick={() => toggleInput(gate.id, 1)}
                                                style={{
                                                    width: 32, height: 24, borderRadius: 4, cursor: 'pointer',
                                                    background: gate.inputs[1] ? '#22c55e' : '#ef4444',
                                                    color: '#fff', fontWeight: 700, fontSize: '0.75rem',
                                                    border: 'none',
                                                }}>
                                                {gate.inputs[1] ? '1' : '0'}
                                            </button>
                                        )}
                                    </div>

                                    {/* Wires in */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: isNot ? 0 : 10 }}>
                                        <div style={{ width: 16, height: 2, background: gate.inputs[0] ? '#22c55e' : '#9c9488' }} />
                                        {!isNot && <div style={{ width: 16, height: 2, background: gate.inputs[1] ? '#22c55e' : '#9c9488' }} />}
                                    </div>

                                    {/* Gate body */}
                                    <div style={{
                                        width: 48, height: 40, borderRadius: '6px 16px 16px 6px',
                                        background: `${color}20`, border: `2px solid ${color}`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontWeight: 800, fontSize: '0.85rem', color,
                                        position: 'relative',
                                    }}>
                                        {GATE_SYMBOL[gate.type]}
                                        {/* Inversion bubble for NAND/NOR/NOT/XNOR */}
                                        {['NOT', 'NAND', 'NOR', 'XNOR'].includes(gate.type) && (
                                            <div style={{
                                                position: 'absolute', right: -6, width: 8, height: 8,
                                                borderRadius: '50%', background: 'var(--bg-primary)',
                                                border: `2px solid ${color}`,
                                            }} />
                                        )}
                                    </div>

                                    {/* Wire out */}
                                    <div style={{ width: 16, height: 2, background: output ? '#22c55e' : '#9c9488' }} />

                                    {/* Output */}
                                    <div style={{
                                        width: 32, height: 28, borderRadius: 6,
                                        background: output ? '#22c55e' : '#ef4444',
                                        color: '#fff', fontWeight: 800, fontSize: '0.9rem',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        boxShadow: output ? '0 0 8px rgba(34,197,94,0.4)' : '0 0 8px rgba(239,68,68,0.3)',
                                    }}>
                                        {output ? '1' : '0'}
                                    </div>
                                </div>

                                {/* Expression */}
                                <div style={{
                                    marginTop: 8, textAlign: 'center', fontSize: '0.72rem',
                                    fontFamily: 'monospace', color: 'var(--text-dim)',
                                }}>
                                    {isNot
                                        ? `NOT(${gate.inputs[0] ? '1' : '0'}) = ${output ? '1' : '0'}`
                                        : `${gate.inputs[0] ? '1' : '0'} ${gate.type} ${gate.inputs[1] ? '1' : '0'} = ${output ? '1' : '0'}`
                                    }
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Truth table */}
                <div style={{
                    background: 'var(--bg-secondary)', border: '1px solid var(--border-warm)',
                    borderRadius: 'var(--radius-sm)', padding: 12,
                }}>
                    <div style={{ fontWeight: 700, marginBottom: 8, fontSize: '0.82rem', color: GATE_COLORS[selectedType] }}>
                        {selectedType} Gate — Truth Table
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace', fontSize: '0.82rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid var(--border-warm)' }}>
                                <th style={thStyle}>A</th>
                                {selectedType !== 'NOT' && <th style={thStyle}>B</th>}
                                <th style={{ ...thStyle, color: GATE_COLORS[selectedType] }}>Output</th>
                            </tr>
                        </thead>
                        <tbody>
                            {truthTable.map((row, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid var(--border-warm)' }}>
                                    <td style={tdStyle}>
                                        <span style={{ ...bitStyle, background: row.a ? '#22c55e' : '#ef4444' }}>{row.a ? '1' : '0'}</span>
                                    </td>
                                    {selectedType !== 'NOT' && (
                                        <td style={tdStyle}>
                                            <span style={{ ...bitStyle, background: row.b ? '#22c55e' : '#ef4444' }}>{row.b ? '1' : '0'}</span>
                                        </td>
                                    )}
                                    <td style={tdStyle}>
                                        <span style={{
                                            ...bitStyle,
                                            background: row.out ? '#22c55e' : '#ef4444',
                                            fontWeight: 800,
                                        }}>{row.out ? '1' : '0'}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

const thStyle: React.CSSProperties = {
    padding: '6px 12px', textAlign: 'center', fontWeight: 700, color: 'var(--text-dim)',
};
const tdStyle: React.CSSProperties = {
    padding: '5px 12px', textAlign: 'center',
};
const bitStyle: React.CSSProperties = {
    display: 'inline-block', width: 22, height: 22, lineHeight: '22px',
    borderRadius: 4, color: '#fff', fontWeight: 600, textAlign: 'center', fontSize: '0.78rem',
};
