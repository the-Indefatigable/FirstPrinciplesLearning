import { useState, useCallback } from 'react';

/* ═══════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════ */
interface Entry {
    key: string;
    hash: number;
    bucket: number;
    highlight: boolean;
}

type Strategy = 'chaining' | 'linear' | 'quadratic';

/* ═══════════════════════════════════════════════════════════════════════
   HASH FUNCTION
   ═══════════════════════════════════════════════════════════════════════ */
const simpleHash = (key: string, size: number): number => {
    let h = 0;
    for (let i = 0; i < key.length; i++) {
        h = (h * 31 + key.charCodeAt(i)) >>> 0;
    }
    return h % size;
};

/* ═══════════════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════════════ */
export default function HashTableViz() {
    const [tableSize, setTableSize] = useState(8);
    const [strategy, setStrategy] = useState<Strategy>('chaining');
    const [entries, setEntries] = useState<Entry[]>([]);
    const [inputKey, setInputKey] = useState('');
    const [log, setLog] = useState<{ text: string; color: string }[]>([]);
    const [collisionCount, setCollisionCount] = useState(0);

    const addLog = useCallback((text: string, color = '#9c9488') => {
        setLog(prev => [...prev.slice(-20), { text, color }]);
    }, []);

    /* ── Insert ── */
    const insert = useCallback(() => {
        const key = inputKey.trim();
        if (!key) return;
        setInputKey('');

        const hash = simpleHash(key, tableSize);
        let bucket = hash;
        let collided = false;

        // Check duplicate
        if (entries.some(e => e.key === key)) {
            addLog(`⚠ "${key}" already exists`, '#f59e0b');
            return;
        }

        if (strategy === 'chaining') {
            // Chaining — just add to same bucket
            const existing = entries.filter(e => e.bucket === bucket);
            if (existing.length > 0) {
                collided = true;
                setCollisionCount(c => c + 1);
                addLog(`💥 Collision! "${key}" → bucket ${bucket} (chained, ${existing.length + 1} items)`, '#ef4444');
            } else {
                addLog(`✓ "${key}" → hash(${hash}) → bucket ${bucket}`, '#22c55e');
            }
        } else {
            // Open addressing
            const occupied = new Set(entries.map(e => e.bucket));
            let probes = 0;
            let step = 1;

            while (occupied.has(bucket) && probes < tableSize) {
                collided = true;
                probes++;
                if (strategy === 'linear') {
                    bucket = (hash + probes) % tableSize;
                } else {
                    bucket = (hash + step * step) % tableSize;
                    step++;
                }
            }

            if (probes >= tableSize) {
                addLog(`✖ Table full! Cannot insert "${key}"`, '#ef4444');
                return;
            }

            if (collided) {
                setCollisionCount(c => c + 1);
                addLog(`💥 Collision! "${key}" → hash(${hash}) → probed ${probes}× → bucket ${bucket}`, '#ef4444');
            } else {
                addLog(`✓ "${key}" → hash(${hash}) → bucket ${bucket}`, '#22c55e');
            }
        }

        const newEntry: Entry = { key, hash, bucket, highlight: true };
        setEntries(prev => {
            const updated = prev.map(e => ({ ...e, highlight: false }));
            return [...updated, newEntry];
        });

        // Remove highlight after animation
        setTimeout(() => {
            setEntries(prev => prev.map(e => e.key === key ? { ...e, highlight: false } : e));
        }, 1200);
    }, [inputKey, tableSize, strategy, entries, addLog]);

    /* ── Delete ── */
    const remove = useCallback((key: string) => {
        setEntries(prev => prev.filter(e => e.key !== key));
        addLog(`🗑 Removed "${key}"`, '#9c9488');
    }, [addLog]);

    /* ── Search ── */
    const search = useCallback(() => {
        const key = inputKey.trim();
        if (!key) return;
        const found = entries.find(e => e.key === key);
        if (found) {
            addLog(`🔍 Found "${key}" at bucket ${found.bucket}`, '#3b82f6');
            setEntries(prev => prev.map(e => e.key === key ? { ...e, highlight: true } : { ...e, highlight: false }));
            setTimeout(() => setEntries(prev => prev.map(e => ({ ...e, highlight: false }))), 1500);
        } else {
            addLog(`🔍 "${key}" not found`, '#ef4444');
        }
    }, [inputKey, entries, addLog]);

    /* ── Clear ── */
    const clear = useCallback(() => {
        setEntries([]);
        setCollisionCount(0);
        setLog([]);
        addLog('Table cleared', '#9c9488');
    }, [addLog]);

    /* ── Quick fill with sample data ── */
    const fillSample = useCallback(() => {
        clear();
        const samples = ['Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank'];
        let delay = 0;
        for (const name of samples) {
            setTimeout(() => {
                setInputKey(name);
                // Trigger insert after setting key
                setTimeout(() => {
                    const hash = simpleHash(name, tableSize);
                    let bucket = hash;

                    setEntries(prev => {
                        const occupied = new Set(prev.map(e => e.bucket));
                        let collided = false;

                        if (strategy !== 'chaining') {
                            let probes = 0, step = 1;
                            while (occupied.has(bucket) && probes < tableSize) {
                                collided = true;
                                probes++;
                                bucket = strategy === 'linear'
                                    ? (hash + probes) % tableSize
                                    : (hash + step * step) % tableSize;
                                step++;
                            }
                        } else if (prev.some(e => e.bucket === bucket)) {
                            collided = true;
                        }

                        if (collided) {
                            setCollisionCount(c => c + 1);
                            addLog(`💥 "${name}" → hash(${hash}) → bucket ${bucket}`, '#ef4444');
                        } else {
                            addLog(`✓ "${name}" → hash(${hash}) → bucket ${bucket}`, '#22c55e');
                        }

                        return [...prev.map(e => ({ ...e, highlight: false })), { key: name, hash, bucket, highlight: true }];
                    });
                    setTimeout(() => setEntries(prev => prev.map(e => ({ ...e, highlight: false }))), 800);
                }, 50);
            }, delay);
            delay += 400;
        }
        setTimeout(() => setInputKey(''), delay);
    }, [clear, tableSize, strategy, addLog]);

    /* ── Render ── */
    const buckets = Array.from({ length: tableSize }, (_, i) => i);
    const loadFactor = (entries.length / tableSize * 100).toFixed(0);

    return (
        <div className="tool-card">
            <div className="tool-card-header">
                <h3>Hash Table Visualizer</h3>
                <span className="subject-topic" style={{ background: 'rgba(194,113,79,0.12)', color: '#c2714f' }}>Data Structures</span>
            </div>
            <div className="tool-card-body">
                {/* Controls */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 12 }}>
                    <div style={panelStyle}>
                        <label style={lblStyle}>Strategy</label>
                        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                            {([['chaining', 'Chain'], ['linear', 'Linear'], ['quadratic', 'Quad']] as [Strategy, string][]).map(([s, label]) => (
                                <button key={s} onClick={() => { setStrategy(s); clear(); }}
                                    style={{
                                        padding: '3px 8px', borderRadius: 'var(--radius-sm)', fontSize: '0.72rem',
                                        fontWeight: 600, cursor: 'pointer',
                                        background: strategy === s ? '#c2714f' : 'transparent',
                                        color: strategy === s ? '#fff' : 'var(--text-dim)',
                                        border: `1px solid ${strategy === s ? '#c2714f' : 'var(--border-warm)'}`,
                                    }}>
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div style={panelStyle}>
                        <label style={lblStyle}>Table Size: {tableSize}</label>
                        <input type="range" min={4} max={16} value={tableSize}
                            onChange={e => { setTableSize(+e.target.value); clear(); }}
                            style={{ width: '100%', accentColor: '#c2714f' }} />
                    </div>
                    <div style={panelStyle}>
                        <label style={lblStyle}>Stats</label>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                            Load: <strong>{loadFactor}%</strong> · Collisions: <strong style={{ color: collisionCount > 0 ? '#ef4444' : 'inherit' }}>{collisionCount}</strong>
                        </div>
                    </div>
                </div>

                {/* Input */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                    <input style={{ ...inputStyle, flex: 1 }} value={inputKey}
                        onChange={e => setInputKey(e.target.value)}
                        placeholder="Type a key (e.g. Alice)"
                        onKeyDown={e => e.key === 'Enter' && insert()} />
                    <button className="btn-primary" onClick={insert} style={{ fontSize: '0.82rem', padding: '6px 14px' }}>Insert</button>
                    <button onClick={search} style={btnOutline}>Search</button>
                    <button onClick={fillSample} style={btnOutline}>Sample</button>
                    <button onClick={clear} style={btnOutline}>Clear</button>
                </div>

                {/* Visualization */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 14 }}>
                    {buckets.map(bIdx => {
                        const items = entries.filter(e => e.bucket === bIdx);
                        const chainingItems = strategy === 'chaining'
                            ? entries.filter(e => e.bucket === bIdx)
                            : entries.filter(e => e.bucket === bIdx).slice(0, 1);

                        return (
                            <div key={bIdx} style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 32 }}>
                                {/* Index */}
                                <div style={{
                                    width: 28, height: 28, borderRadius: 'var(--radius-sm)',
                                    background: items.length > 0 ? 'rgba(194,113,79,0.12)' : 'var(--bg-secondary)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '0.78rem', fontWeight: 700, color: items.length > 0 ? '#c2714f' : 'var(--text-dim)',
                                    border: '1px solid var(--border-warm)', flexShrink: 0,
                                }}>
                                    {bIdx}
                                </div>

                                {/* Arrow */}
                                <span style={{ color: 'var(--border-warm)', fontSize: '0.8rem' }}>→</span>

                                {/* Entries */}
                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flex: 1 }}>
                                    {chainingItems.length === 0 ? (
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', opacity: 0.4, fontStyle: 'italic' }}>empty</span>
                                    ) : (
                                        chainingItems.map((entry) => (
                                            <div key={entry.key}
                                                onClick={() => remove(entry.key)}
                                                title="Click to remove"
                                                style={{
                                                    padding: '3px 10px', borderRadius: 'var(--radius-sm)',
                                                    background: entry.highlight ? '#c2714f' : 'var(--bg-secondary)',
                                                    color: entry.highlight ? '#fff' : 'var(--text-primary)',
                                                    fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer',
                                                    border: `1px solid ${entry.highlight ? '#c2714f' : 'var(--border-warm)'}`,
                                                    transition: 'all 0.3s',
                                                    fontFamily: 'monospace',
                                                }}>
                                                {entry.key}
                                                <span style={{ fontSize: '0.65rem', opacity: 0.6, marginLeft: 4 }}>h={entry.hash}</span>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* Collision indicator */}
                                {strategy === 'chaining' && items.length > 1 && (
                                    <span style={{ fontSize: '0.68rem', color: '#ef4444', fontWeight: 600, flexShrink: 0 }}>
                                        chain({items.length})
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Hash function display */}
                <div style={{
                    background: 'var(--bg-secondary)', border: '1px solid var(--border-warm)',
                    borderRadius: 'var(--radius-sm)', padding: '8px 12px', marginBottom: 10,
                    fontSize: '0.78rem', fontFamily: 'monospace', color: 'var(--text-dim)',
                }}>
                    <strong>h(key)</strong> = (Σ key[i] × 31^i) mod {tableSize}
                    {strategy !== 'chaining' && (
                        <span> · Probing: {strategy === 'linear' ? 'h(k) + i' : 'h(k) + i²'}</span>
                    )}
                </div>

                {/* Log */}
                <div style={{
                    background: 'var(--bg-secondary)', border: '1px solid var(--border-warm)',
                    borderRadius: 'var(--radius-sm)', padding: '8px 12px',
                    maxHeight: 120, overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.75rem',
                }}>
                    <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--text-dim)', fontSize: '0.7rem', letterSpacing: 0.5 }}>LOG</div>
                    {log.length === 0 ? (
                        <div style={{ color: 'var(--text-dim)' }}>Insert a key or click "Sample" to start...</div>
                    ) : (
                        log.map((entry, i) => (
                            <div key={i} style={{ color: entry.color, lineHeight: 1.6 }}>{entry.text}</div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

/* ── Styles ── */
const panelStyle: React.CSSProperties = {
    padding: 8, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-warm)',
};
const lblStyle: React.CSSProperties = {
    display: 'block', fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: 4, fontWeight: 600,
};
const inputStyle: React.CSSProperties = {
    padding: '6px 10px', borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-warm)', background: 'var(--bg-secondary)',
    color: 'var(--text-primary)', fontSize: '0.88rem', fontFamily: 'inherit',
};
const btnOutline: React.CSSProperties = {
    padding: '6px 12px', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem',
    fontWeight: 500, cursor: 'pointer', background: 'transparent',
    color: 'var(--text-dim)', border: '1px solid var(--border-warm)',
    transition: 'all 0.15s',
};
