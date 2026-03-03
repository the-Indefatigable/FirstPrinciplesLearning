import { useState } from 'react';

// Mock Database Schema
type User = { id: number; name: string; dept_id: number };
type Department = { id: number; name: string };
type JoinResult = { 'Users.id': string; name: string; dept_name: string };

const USERS: User[] = [
    { id: 1, name: 'Alice', dept_id: 101 },
    { id: 2, name: 'Bob', dept_id: 102 },
    { id: 3, name: 'Charlie', dept_id: 101 },
    { id: 4, name: 'Diana', dept_id: 999 }, // No matching dept
];

const DEPARTMENTS: Department[] = [
    { id: 101, name: 'Engineering' },
    { id: 102, name: 'Marketing' },
    { id: 103, name: 'HR' }, // No matching users
];

export default function SqlVisualizer() {
    const [query, setQuery] = useState('SELECT *\nFROM Users\nJOIN Departments ON Users.dept_id = Departments.id');
    const [results, setResults] = useState<any[] | null>(null);
    const [animationState, setAnimationState] = useState<'idle' | 'joining' | 'filtering' | 'done'>('idle');
    const [highlightRows, setHighlightRows] = useState<{ u?: number, d?: number }>({});

    const executeQuery = async () => {
        setAnimationState('joining');
        setResults(null);
        setHighlightRows({});

        const isLeftJoin = query.toUpperCase().includes('LEFT JOIN');
        const finalResults: JoinResult[] = [];

        // Slow animated nested loop join visualization
        for (let u = 0; u < USERS.length; u++) {
            const user = USERS[u];
            let matched = false;

            for (let d = 0; d < DEPARTMENTS.length; d++) {
                const dept = DEPARTMENTS[d];
                setHighlightRows({ u: user.id, d: dept.id });

                // Animation delay
                await new Promise(r => setTimeout(r, 600));

                if (user.dept_id === dept.id) {
                    matched = true;
                    // Flash success
                    finalResults.push({
                        'Users.id': user.id.toString(),
                        name: user.name,
                        dept_name: dept.name
                    });
                    setResults([...finalResults]);
                    await new Promise(r => setTimeout(r, 400));
                }
            }

            if (!matched && isLeftJoin) {
                setHighlightRows({ u: user.id });
                await new Promise(r => setTimeout(r, 500));
                finalResults.push({
                    'Users.id': user.id.toString(),
                    name: user.name,
                    dept_name: 'NULL'
                });
                setResults([...finalResults]);
            }
        }

        setHighlightRows({});
        setAnimationState('done');
    };

    return (
        <div className="tool-card sql-visualizer">
            <div className="tool-card-header">
                <h3>SQL JOIN Visualizer</h3>
                <span className="subject-topic" style={{ background: 'var(--sage-glow)', color: 'var(--sage)' }}>Databases</span>
            </div>

            <div className="tool-card-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>

                    {/* Left: Editor & Controls */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-warm)' }}>
                            <p style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Type a query to visualize the execution plan:</p>
                            <textarea
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                style={{
                                    width: '100%',
                                    height: '100px',
                                    fontFamily: 'monospace',
                                    fontSize: '0.9rem',
                                    padding: '12px',
                                    border: '1px solid var(--border-warm)',
                                    borderRadius: 'var(--radius-sm)',
                                    background: 'var(--bg-primary)',
                                    color: 'var(--text-primary)',
                                    resize: 'vertical'
                                }}
                            />
                            <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                                <button className="tool-btn" onClick={executeQuery} disabled={animationState === 'joining'}>
                                    {animationState === 'joining' ? 'Executing...' : 'Run Query'}
                                </button>
                                <button className="tool-btn--outline" onClick={() => setQuery('SELECT *\nFROM Users\nLEFT JOIN Departments ON Users.dept_id = Departments.id')}>
                                    Try LEFT JOIN
                                </button>
                            </div>
                        </div>

                        {/* Status Panel */}
                        {animationState !== 'idle' && (
                            <div style={{
                                padding: '12px',
                                background: animationState === 'done' ? 'var(--sage-glow)' : 'var(--amber-soft)',
                                color: animationState === 'done' ? 'var(--sage)' : 'var(--amber)',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: '0.9rem',
                                fontWeight: 500
                            }}>
                                {animationState === 'joining' ? '⚡ Peforming Nested Loop Join...' : '✅ Query Complete'}
                            </div>
                        )}
                    </div>

                    {/* Right: Table Visualization */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                        {/* Source Tables Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                            {/* Users Table */}
                            <div>
                                <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem' }}>Table: Users</h4>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                    <thead>
                                        <tr style={{ background: 'var(--bg-primary)', borderBottom: '2px solid var(--border-warm)' }}>
                                            <th style={{ padding: '8px', textAlign: 'left' }}>id</th>
                                            <th style={{ padding: '8px', textAlign: 'left' }}>name</th>
                                            <th style={{ padding: '8px', textAlign: 'left' }}>dept_id</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {USERS.map(u => (
                                            <tr
                                                key={u.id}
                                                style={{
                                                    background: highlightRows.u === u.id ? 'var(--amber-soft)' : 'transparent',
                                                    borderBottom: '1px solid var(--border-warm)',
                                                    transition: 'background 0.2s ease'
                                                }}
                                            >
                                                <td style={{ padding: '8px' }}>{u.id}</td>
                                                <td style={{ padding: '8px' }}>{u.name}</td>
                                                <td style={{ padding: '8px', color: highlightRows.u === u.id ? 'var(--amber)' : 'inherit', fontWeight: highlightRows.u === u.id ? 'bold' : 'normal' }}>
                                                    {u.dept_id}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Departments Table */}
                            <div>
                                <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem' }}>Table: Departments</h4>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                    <thead>
                                        <tr style={{ background: 'var(--bg-primary)', borderBottom: '2px solid var(--border-warm)' }}>
                                            <th style={{ padding: '8px', textAlign: 'left' }}>id</th>
                                            <th style={{ padding: '8px', textAlign: 'left' }}>name</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {DEPARTMENTS.map(d => (
                                            <tr
                                                key={d.id}
                                                style={{
                                                    background: highlightRows.d === d.id ? 'var(--amber-soft)' : 'transparent',
                                                    borderBottom: '1px solid var(--border-warm)',
                                                    transition: 'background 0.2s ease'
                                                }}
                                            >
                                                <td style={{ padding: '8px', color: highlightRows.d === d.id ? 'var(--amber)' : 'inherit', fontWeight: highlightRows.d === d.id ? 'bold' : 'normal' }}>
                                                    {d.id}
                                                </td>
                                                <td style={{ padding: '8px' }}>{d.name}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Results Table */}
                        <div style={{ flex: 1, border: '1px dashed var(--border-warm)', borderRadius: 'var(--radius-md)', padding: '16px', minHeight: '200px' }}>
                            <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'var(--sage)' }}>Result Set</h4>
                            {!results || results.length === 0 ? (
                                <div style={{ color: 'var(--text-dim)', fontSize: '0.9rem', textAlign: 'center', marginTop: '40px' }}>
                                    {animationState === 'idle' ? 'Run query to see results...' : 'Waiting for matches...'}
                                </div>
                            ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                    <thead>
                                        <tr style={{ background: 'var(--sage-glow)', borderBottom: '2px solid var(--sage)' }}>
                                            <th style={{ padding: '8px', textAlign: 'left' }}>Users.id</th>
                                            <th style={{ padding: '8px', textAlign: 'left' }}>name</th>
                                            <th style={{ padding: '8px', textAlign: 'left' }}>dept_name</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {results.map((r, i) => (
                                            <tr key={i} style={{ borderBottom: '1px solid var(--border-warm)' }}>
                                                <td style={{ padding: '8px' }}>{r['Users.id']}</td>
                                                <td style={{ padding: '8px' }}>{r.name}</td>
                                                <td style={{ padding: '8px', color: r.dept_name === 'NULL' ? 'var(--terracotta)' : 'inherit' }}>{r.dept_name}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}
