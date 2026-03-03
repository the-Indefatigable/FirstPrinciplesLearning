import { useState, useCallback } from 'react';
import { matrix, det, inv, multiply, transpose } from 'mathjs';

type Op = 'det' | 'inv' | 'transpose' | 'multiply' | 'rref';

export default function MatrixCalc() {
    const [rows, setRows] = useState(3);
    const [cols, setCols] = useState(3);
    const [values, setValues] = useState<number[][]>(
        Array.from({ length: 3 }, () => Array(3).fill(0))
    );
    const [values2, setValues2] = useState<number[][]>(
        Array.from({ length: 3 }, () => Array(3).fill(0))
    );
    const [result, setResult] = useState('');
    const [showB, setShowB] = useState(false);

    const updateSize = (r: number, c: number) => {
        setRows(r);
        setCols(c);
        setValues(Array.from({ length: r }, (_, i) => Array.from({ length: c }, (_, j) => values[i]?.[j] ?? 0)));
        setValues2(Array.from({ length: r }, (_, i) => Array.from({ length: c }, (_, j) => values2[i]?.[j] ?? 0)));
    };

    const setCell = (mat: 'A' | 'B', r: number, c: number, v: number) => {
        const setter = mat === 'A' ? setValues : setValues2;
        const old = mat === 'A' ? values : values2;
        const newVals = old.map((row, ri) => row.map((val, ci) => (ri === r && ci === c ? v : val)));
        setter(newVals);
    };

    const compute = useCallback((op: Op) => {
        try {
            const A = matrix(values);
            switch (op) {
                case 'det':
                    setResult(`Determinant = ${det(A)}`);
                    break;
                case 'inv':
                    setResult(`Inverse:\n${formatMatrix(inv(A).valueOf() as number[][])}`);
                    break;
                case 'transpose':
                    setResult(`Transpose:\n${formatMatrix(transpose(A).valueOf() as number[][])}`);
                    break;
                case 'multiply': {
                    const B = matrix(values2);
                    const C = multiply(A, B);
                    setResult(`A × B:\n${formatMatrix(C.valueOf() as number[][])}`);
                    break;
                }
                case 'rref': {
                    const rr = rref(values.map(r => [...r]));
                    setResult(`RREF:\n${formatMatrix(rr)}`);
                    break;
                }
            }
        } catch (e: unknown) {
            setResult(`Error: ${e instanceof Error ? e.message : 'Invalid matrix'}`);
        }
    }, [values, values2]);

    return (
        <div className="tool-card">
            <div className="tool-card-header">
                <h3>Matrix Calculator</h3>
                <div className="tool-controls">
                    <select className="tool-input" style={{ width: 'auto', padding: '6px 10px', fontSize: '0.82rem' }}
                        value={`${rows}x${cols}`}
                        onChange={(e) => {
                            const [r, c] = e.target.value.split('x').map(Number);
                            updateSize(r, c);
                        }}
                    >
                        {[2, 3, 4].map(r =>
                            [2, 3, 4].map(c => (
                                <option key={`${r}x${c}`} value={`${r}x${c}`}>{r}×{c}</option>
                            ))
                        )}
                    </select>
                </div>
            </div>
            <div className="tool-card-body">
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 20 }}>
                    <div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-dim)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Matrix A</div>
                        {renderMatrix(values, rows, cols, (r, c, v) => setCell('A', r, c, v))}
                    </div>
                    {showB && (
                        <div>
                            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-dim)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Matrix B</div>
                            {renderMatrix(values2, rows, cols, (r, c, v) => setCell('B', r, c, v))}
                        </div>
                    )}
                </div>

                <div className="tool-controls" style={{ marginBottom: 20 }}>
                    <button className="tool-btn" onClick={() => compute('det')}>Determinant</button>
                    <button className="tool-btn" onClick={() => compute('inv')}>Inverse</button>
                    <button className="tool-btn" onClick={() => compute('transpose')}>Transpose</button>
                    <button className="tool-btn" onClick={() => compute('rref')}>RREF</button>
                    <button className="tool-btn--outline tool-btn" onClick={() => { setShowB(!showB); }}>
                        {showB ? 'Hide B' : 'A × B'}
                    </button>
                    {showB && <button className="tool-btn" onClick={() => compute('multiply')}>Multiply</button>}
                </div>

                {result && <div className="tool-result">{result}</div>}
            </div>
        </div>
    );
}

function renderMatrix(
    vals: number[][],
    rows: number,
    cols: number,
    onChange: (r: number, c: number, v: number) => void
) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 56px)`, gap: 4 }}>
            {Array.from({ length: rows }, (_, r) =>
                Array.from({ length: cols }, (_, c) => (
                    <input
                        key={`${r}-${c}`}
                        className="tool-input"
                        style={{ width: 56, padding: '8px 4px', textAlign: 'center', fontSize: '0.9rem' }}
                        type="number"
                        value={vals[r]?.[c] ?? 0}
                        onChange={(e) => onChange(r, c, parseFloat(e.target.value) || 0)}
                    />
                ))
            )}
        </div>
    );
}

function formatMatrix(m: number[][]): string {
    return m.map(row => row.map(v => {
        const r = Math.round(v * 10000) / 10000;
        return String(r).padStart(8);
    }).join(' ')).join('\n');
}

function rref(m: number[][]): number[][] {
    const rows = m.length;
    const cols = m[0].length;
    let lead = 0;

    for (let r = 0; r < rows; r++) {
        if (lead >= cols) return m;
        let i = r;
        while (Math.abs(m[i][lead]) < 1e-10) {
            i++;
            if (i === rows) {
                i = r;
                lead++;
                if (lead === cols) return m;
            }
        }
        [m[i], m[r]] = [m[r], m[i]];
        const lv = m[r][lead];
        m[r] = m[r].map(v => v / lv);
        for (let j = 0; j < rows; j++) {
            if (j !== r) {
                const factor = m[j][lead];
                m[j] = m[j].map((v, k) => v - factor * m[r][k]);
            }
        }
        lead++;
    }
    return m;
}
