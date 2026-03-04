import { useState } from 'react';

interface LLNode { val: number; id: number; }

let nodeId = 0;

export default function LinkedList() {
    const [nodes, setNodes] = useState<LLNode[]>([
        { val: 10, id: nodeId++ },
        { val: 20, id: nodeId++ },
        { val: 30, id: nodeId++ },
    ]);
    const [inputVal, setInputVal] = useState('');
    const [insertIdx, setInsertIdx] = useState(0);
    const [lastAction, setLastAction] = useState('');

    const insertAt = () => {
        const val = parseInt(inputVal);
        if (isNaN(val)) return;
        const idx = Math.max(0, Math.min(insertIdx, nodes.length));
        const newNode: LLNode = { val, id: nodeId++ };
        setNodes(prev => [...prev.slice(0, idx), newNode, ...prev.slice(idx)]);
        setLastAction(`Inserted ${val} at index ${idx}`);
        setInputVal('');
    };

    const insertFront = () => {
        const val = parseInt(inputVal);
        if (isNaN(val)) return;
        setNodes(prev => [{ val, id: nodeId++ }, ...prev]);
        setLastAction(`Inserted ${val} at head`);
        setInputVal('');
    };

    const insertBack = () => {
        const val = parseInt(inputVal);
        if (isNaN(val)) return;
        setNodes(prev => [...prev, { val, id: nodeId++ }]);
        setLastAction(`Inserted ${val} at tail`);
        setInputVal('');
    };

    const deleteAt = (idx: number) => {
        const val = nodes[idx].val;
        setNodes(prev => prev.filter((_, i) => i !== idx));
        setLastAction(`Deleted node ${val} at index ${idx}`);
    };

    const reverse = () => {
        setNodes(prev => [...prev].reverse());
        setLastAction('Reversed the list');
    };

    return (
        <div className="tool-card">
            <div className="tool-card-header">
                <h3>Linked List Playground</h3>
                <span className="subject-topic" style={{ background: 'var(--terracotta-glow)', color: 'var(--terracotta)' }}>Data Structures</span>
            </div>
            <div className="tool-card-body">
                <div className="tool-controls-row tool-controls-row--4">
                    <div className="tool-input-group">
                        <label>Value</label>
                        <input className="tool-input" type="number" value={inputVal} onChange={e => setInputVal(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && insertBack()} placeholder="e.g. 42" />
                    </div>
                    <div className="tool-input-group" style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
                        <button className="tool-btn" onClick={insertFront} title="Insert at head">↤ Head</button>
                        <button className="tool-btn" onClick={insertBack} title="Insert at tail">Tail ↦</button>
                    </div>
                    <div className="tool-input-group">
                        <label>Index</label>
                        <div style={{ display: 'flex', gap: 6 }}>
                            <input className="tool-input" type="number" min={0} max={nodes.length} value={insertIdx}
                                onChange={e => setInsertIdx(+e.target.value)} style={{ width: 60 }} />
                            <button className="tool-btn tool-btn--outline" onClick={insertAt}>Insert At</button>
                        </div>
                    </div>
                    <div className="tool-input-group" style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
                        <button className="tool-btn tool-btn--outline" onClick={reverse} disabled={nodes.length < 2}>⇄ Reverse</button>
                        <button className="tool-btn tool-btn--outline" onClick={() => { setNodes([]); setLastAction('Cleared'); }}>Clear</button>
                    </div>
                </div>

                {lastAction && (
                    <div style={{ padding: '8px 16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', marginBottom: 16, fontSize: '0.85rem', color: 'var(--amber)', fontWeight: 600 }}>
                        {lastAction}
                    </div>
                )}

                {/* Visual linked list */}
                <div style={{ overflowX: 'auto', padding: '32px 16px', minHeight: 140 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 0, minWidth: 'fit-content' }}>
                        {/* Head pointer */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginRight: 8 }}>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Head</div>
                            <div style={{ fontSize: '1.2rem', color: 'var(--terracotta)' }}>↓</div>
                        </div>

                        {nodes.map((node, i) => (
                            <div key={node.id} style={{ display: 'flex', alignItems: 'center' }}>
                                <div style={{
                                    display: 'flex', border: '2px solid var(--terracotta)', borderRadius: 'var(--radius-sm)',
                                    overflow: 'hidden', background: 'var(--bg-card)', position: 'relative',
                                }}>
                                    {/* Data section */}
                                    <div style={{
                                        padding: '12px 16px', fontFamily: 'monospace', fontSize: '1.1rem', fontWeight: 700,
                                        color: 'var(--text-primary)', borderRight: '2px solid var(--terracotta)',
                                        minWidth: 50, textAlign: 'center',
                                    }}>
                                        {node.val}
                                    </div>
                                    {/* Next pointer section */}
                                    <div style={{
                                        padding: '12px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '0.9rem', color: i < nodes.length - 1 ? 'var(--terracotta)' : 'var(--text-dim)',
                                        fontWeight: 700, minWidth: 30,
                                    }}>
                                        {i < nodes.length - 1 ? '●' : '∅'}
                                    </div>
                                    {/* Delete button */}
                                    <button onClick={() => deleteAt(i)} style={{
                                        position: 'absolute', top: -8, right: -8, width: 18, height: 18,
                                        background: 'var(--terracotta)', color: 'white', border: 'none',
                                        borderRadius: '50%', fontSize: '0.65rem', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>×</button>
                                </div>
                                {/* Arrow to next */}
                                {i < nodes.length - 1 && (
                                    <div style={{ display: 'flex', alignItems: 'center', padding: '0 4px' }}>
                                        <div style={{ width: 20, height: 2, background: 'var(--terracotta)' }} />
                                        <div style={{ width: 0, height: 0, borderTop: '6px solid transparent', borderBottom: '6px solid transparent', borderLeft: '8px solid var(--terracotta)' }} />
                                    </div>
                                )}
                            </div>
                        ))}

                        {nodes.length === 0 && (
                            <div style={{ color: 'var(--text-dim)', fontStyle: 'italic', paddingLeft: 16 }}>NULL (empty list)</div>
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 24, padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>Length: <strong style={{ color: 'var(--text-primary)' }}>{nodes.length}</strong></span>
                    {nodes.length > 0 && <>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>Head: <strong style={{ color: 'var(--terracotta)' }}>{nodes[0].val}</strong></span>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>Tail: <strong style={{ color: 'var(--terracotta)' }}>{nodes[nodes.length - 1].val}</strong></span>
                    </>}
                </div>
            </div>
        </div>
    );
}
