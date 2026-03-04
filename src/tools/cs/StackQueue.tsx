import { useState } from 'react';

type DSType = 'stack' | 'queue';

export default function StackQueue() {
    const [dsType, setDsType] = useState<DSType>('stack');
    const [items, setItems] = useState<number[]>([42, 17, 85]);
    const [inputVal, setInputVal] = useState('');
    const [lastAction, setLastAction] = useState('');

    const push = () => {
        const val = parseInt(inputVal);
        if (isNaN(val)) return;
        if (dsType === 'stack') {
            setItems(prev => [...prev, val]);
            setLastAction(`Pushed ${val} to top`);
        } else {
            setItems(prev => [...prev, val]);
            setLastAction(`Enqueued ${val} to back`);
        }
        setInputVal('');
    };

    const pop = () => {
        if (items.length === 0) return;
        if (dsType === 'stack') {
            const val = items[items.length - 1];
            setItems(prev => prev.slice(0, -1));
            setLastAction(`Popped ${val} from top`);
        } else {
            const val = items[0];
            setItems(prev => prev.slice(1));
            setLastAction(`Dequeued ${val} from front`);
        }
    };

    return (
        <div className="tool-card">
            <div className="tool-card-header">
                <h3>Stack & Queue Visualizer</h3>
                <span className="subject-topic" style={{ background: 'var(--terracotta-glow)', color: 'var(--terracotta)' }}>Data Structures</span>
            </div>
            <div className="tool-card-body">
                <div className="tool-controls-row tool-controls-row--4">
                    <div className="tool-input-group">
                        <label>Data Structure</label>
                        <select className="tool-input" value={dsType} onChange={e => { setDsType(e.target.value as DSType); setItems([]); setLastAction(''); }}>
                            <option value="stack">Stack (LIFO)</option>
                            <option value="queue">Queue (FIFO)</option>
                        </select>
                    </div>
                    <div className="tool-input-group">
                        <label>Value</label>
                        <input className="tool-input" type="number" value={inputVal} onChange={e => setInputVal(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && push()} placeholder="e.g. 99" />
                    </div>
                    <div className="tool-input-group" style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
                        <button className="tool-btn" onClick={push}>
                            {dsType === 'stack' ? 'Push' : 'Enqueue'}
                        </button>
                        <button className="tool-btn tool-btn--outline" onClick={pop} disabled={items.length === 0}>
                            {dsType === 'stack' ? 'Pop' : 'Dequeue'}
                        </button>
                    </div>
                    <div className="tool-input-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                        <button className="tool-btn tool-btn--outline" onClick={() => { setItems([]); setLastAction('Cleared'); }}>
                            Clear
                        </button>
                    </div>
                </div>

                {lastAction && (
                    <div style={{ padding: '8px 16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', marginBottom: 16, fontSize: '0.85rem', color: 'var(--amber)', fontWeight: 600 }}>
                        {lastAction}
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0', minHeight: 300 }}>
                    {dsType === 'stack' ? (
                        <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: 4, alignItems: 'center' }}>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>Bottom</div>
                            {items.map((item, i) => (
                                <div key={`${item}-${i}`} style={{
                                    width: 120, padding: '12px 0', textAlign: 'center',
                                    background: i === items.length - 1 ? 'var(--amber)' : 'var(--terracotta)',
                                    color: 'white', fontFamily: 'monospace', fontWeight: 700, fontSize: '1.1rem',
                                    borderRadius: 'var(--radius-sm)',
                                    boxShadow: i === items.length - 1 ? '0 0 12px rgba(245,158,11,0.3)' : 'none',
                                    transition: 'all 0.2s ease',
                                }}>
                                    {item}
                                    {i === items.length - 1 && <div style={{ fontSize: '0.65rem', opacity: 0.8 }}>← TOP</div>}
                                </div>
                            ))}
                            {items.length === 0 && <div style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>Empty</div>}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                            {items.length > 0 && <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', writingMode: 'vertical-rl' }}>Front</div>}
                            {items.map((item, i) => (
                                <div key={`${item}-${i}`} style={{
                                    width: 64, padding: '16px 0', textAlign: 'center',
                                    background: i === 0 ? 'var(--amber)' : 'var(--terracotta)',
                                    color: 'white', fontFamily: 'monospace', fontWeight: 700, fontSize: '1.1rem',
                                    borderRadius: 'var(--radius-sm)',
                                    boxShadow: i === 0 ? '0 0 12px rgba(245,158,11,0.3)' : 'none',
                                    position: 'relative',
                                }}>
                                    {item}
                                    {i < items.length - 1 && (
                                        <div style={{ position: 'absolute', right: -8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', fontSize: '0.9rem' }}>→</div>
                                    )}
                                </div>
                            ))}
                            {items.length > 0 && <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', writingMode: 'vertical-rl' }}>Back</div>}
                            {items.length === 0 && <div style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>Empty</div>}
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', gap: 24, padding: '12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>Size: <strong style={{ color: 'var(--text-primary)' }}>{items.length}</strong></span>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>Type: <strong style={{ color: 'var(--text-primary)' }}>{dsType === 'stack' ? 'LIFO' : 'FIFO'}</strong></span>
                    {items.length > 0 && <span style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>
                        {dsType === 'stack' ? 'Top' : 'Front'}: <strong style={{ color: 'var(--amber)' }}>{dsType === 'stack' ? items[items.length - 1] : items[0]}</strong>
                    </span>}
                </div>
            </div>
        </div>
    );
}
