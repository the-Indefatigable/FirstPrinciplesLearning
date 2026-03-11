import { useRef, useEffect, useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab = 'stack-queue' | 'linked-list' | 'bst';
type DSType = 'stack' | 'queue';
interface LLNode { val: number; id: number; }
interface TreeNode { val: number; left: TreeNode | null; right: TreeNode | null; }

// ─── BST helpers ──────────────────────────────────────────────────────────────
function bstInsert(root: TreeNode | null, val: number): TreeNode {
    if (!root) return { val, left: null, right: null };
    if (val < root.val) return { ...root, left: bstInsert(root.left, val) };
    if (val > root.val) return { ...root, right: bstInsert(root.right, val) };
    return root;
}

function bstDelete(root: TreeNode | null, val: number): TreeNode | null {
    if (!root) return null;
    if (val < root.val) return { ...root, left: bstDelete(root.left, val) };
    if (val > root.val) return { ...root, right: bstDelete(root.right, val) };
    if (!root.left) return root.right;
    if (!root.right) return root.left;
    let min = root.right;
    while (min.left) min = min.left;
    return { ...root, val: min.val, right: bstDelete(root.right, min.val) };
}

function bstTraversal(root: TreeNode | null, type: string): number[] {
    if (!root) return [];
    if (type === 'inorder') return [...bstTraversal(root.left, type), root.val, ...bstTraversal(root.right, type)];
    if (type === 'preorder') return [root.val, ...bstTraversal(root.left, type), ...bstTraversal(root.right, type)];
    return [...bstTraversal(root.left, type), ...bstTraversal(root.right, type), root.val];
}

// ─── TAB: Stack & Queue ───────────────────────────────────────────────────────
function StackQueueTab() {
    const [dsType, setDsType] = useState<DSType>('stack');
    const [items, setItems] = useState<number[]>([42, 17, 85]);
    const [inputVal, setInputVal] = useState('');
    const [lastAction, setLastAction] = useState('');

    const push = () => {
        const val = parseInt(inputVal);
        if (isNaN(val)) return;
        setItems(prev => [...prev, val]);
        setLastAction(dsType === 'stack' ? `Pushed ${val} to top` : `Enqueued ${val} to back`);
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
        <>
            <div className="tool-controls-row tool-controls-row--4">
                <div className="tool-input-group">
                    <label>Structure</label>
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
                    <button className="tool-btn" onClick={push}>{dsType === 'stack' ? 'Push' : 'Enqueue'}</button>
                    <button className="tool-btn tool-btn--outline" onClick={pop} disabled={items.length === 0}>{dsType === 'stack' ? 'Pop' : 'Dequeue'}</button>
                </div>
                <div className="tool-input-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button className="tool-btn tool-btn--outline" onClick={() => { setItems([]); setLastAction('Cleared'); }}>Clear</button>
                </div>
            </div>

            {lastAction && (
                <div style={{ padding: '8px 16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', marginBottom: 16, fontSize: '0.85rem', color: 'var(--amber)', fontWeight: 600 }}>
                    {lastAction}
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0', minHeight: 180 }}>
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
        </>
    );
}

// ─── TAB: Linked List ─────────────────────────────────────────────────────────
function LinkedListTab() {
    const nodeIdRef = useRef(0);
    const mkNode = (val: number): LLNode => ({ val, id: nodeIdRef.current++ });

    const [nodes, setNodes] = useState<LLNode[]>(() => [mkNode(10), mkNode(20), mkNode(30)]);
    const [inputVal, setInputVal] = useState('');
    const [insertIdx, setInsertIdx] = useState(0);
    const [lastAction, setLastAction] = useState('');

    const insertFront = () => {
        const val = parseInt(inputVal); if (isNaN(val)) return;
        setNodes(prev => [mkNode(val), ...prev]);
        setLastAction(`Inserted ${val} at head`); setInputVal('');
    };
    const insertBack = () => {
        const val = parseInt(inputVal); if (isNaN(val)) return;
        setNodes(prev => [...prev, mkNode(val)]);
        setLastAction(`Inserted ${val} at tail`); setInputVal('');
    };
    const insertAt = () => {
        const val = parseInt(inputVal); if (isNaN(val)) return;
        const idx = Math.max(0, Math.min(insertIdx, nodes.length));
        setNodes(prev => [...prev.slice(0, idx), mkNode(val), ...prev.slice(idx)]);
        setLastAction(`Inserted ${val} at index ${idx}`); setInputVal('');
    };
    const deleteAt = (idx: number) => {
        setLastAction(`Deleted ${nodes[idx].val} at index ${idx}`);
        setNodes(prev => prev.filter((_, i) => i !== idx));
    };
    const reverse = () => { setNodes(prev => [...prev].reverse()); setLastAction('Reversed the list'); };

    return (
        <>
            <div className="tool-controls-row tool-controls-row--4">
                <div className="tool-input-group">
                    <label>Value</label>
                    <input className="tool-input" type="number" value={inputVal} onChange={e => setInputVal(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && insertBack()} placeholder="e.g. 42" />
                </div>
                <div className="tool-input-group" style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
                    <button className="tool-btn" onClick={insertFront}>↤ Head</button>
                    <button className="tool-btn" onClick={insertBack}>Tail ↦</button>
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

            <div style={{ overflowX: 'auto', padding: '32px 16px', minHeight: 140 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 0, minWidth: 'fit-content' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginRight: 8 }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Head</div>
                        <div style={{ fontSize: '1.2rem', color: 'var(--terracotta)' }}>↓</div>
                    </div>
                    {nodes.map((node, i) => (
                        <div key={node.id} style={{ display: 'flex', alignItems: 'center' }}>
                            <div style={{ display: 'flex', border: '2px solid var(--terracotta)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: 'var(--bg-card)', position: 'relative' }}>
                                <div style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', borderRight: '2px solid var(--terracotta)', minWidth: 50, textAlign: 'center' }}>
                                    {node.val}
                                </div>
                                <div style={{ padding: '12px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', color: i < nodes.length - 1 ? 'var(--terracotta)' : 'var(--text-dim)', fontWeight: 700, minWidth: 30 }}>
                                    {i < nodes.length - 1 ? '●' : '∅'}
                                </div>
                                <button onClick={() => deleteAt(i)} style={{ position: 'absolute', top: -8, right: -8, width: 18, height: 18, background: 'var(--terracotta)', color: 'white', border: 'none', borderRadius: '50%', fontSize: '0.65rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                            </div>
                            {i < nodes.length - 1 && (
                                <div style={{ display: 'flex', alignItems: 'center', padding: '0 4px' }}>
                                    <div style={{ width: 20, height: 2, background: 'var(--terracotta)' }} />
                                    <div style={{ width: 0, height: 0, borderTop: '6px solid transparent', borderBottom: '6px solid transparent', borderLeft: '8px solid var(--terracotta)' }} />
                                </div>
                            )}
                        </div>
                    ))}
                    {nodes.length === 0 && <div style={{ color: 'var(--text-dim)', fontStyle: 'italic', paddingLeft: 16 }}>NULL (empty list)</div>}
                </div>
            </div>

            <div style={{ display: 'flex', gap: 24, padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>Length: <strong style={{ color: 'var(--text-primary)' }}>{nodes.length}</strong></span>
                {nodes.length > 0 && <>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>Head: <strong style={{ color: 'var(--terracotta)' }}>{nodes[0].val}</strong></span>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>Tail: <strong style={{ color: 'var(--terracotta)' }}>{nodes[nodes.length - 1].val}</strong></span>
                </>}
            </div>
        </>
    );
}

// ─── TAB: Binary Search Tree ─────────────────────────────────────────────────
function BSTTab() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [root, setRoot] = useState<TreeNode | null>(null);
    const [inputVal, setInputVal] = useState('');
    const [traversalType, setTraversalType] = useState('inorder');
    const [highlighted, setHighlighted] = useState<Set<number>>(new Set());
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        let tree: TreeNode | null = null;
        for (const v of [50, 30, 70, 20, 40, 60, 80]) tree = bstInsert(tree, v);
        setRoot(tree);
    }, []);

    const handleInsert = () => {
        const val = parseInt(inputVal); if (isNaN(val)) return;
        setRoot(prev => bstInsert(prev, val)); setInputVal('');
    };
    const handleDelete = () => {
        const val = parseInt(inputVal); if (isNaN(val)) return;
        setRoot(prev => bstDelete(prev, val)); setInputVal('');
    };

    const animateTraversal = useCallback(async () => {
        if (!root || isAnimating) return;
        setIsAnimating(true);
        const order = bstTraversal(root, traversalType);
        setHighlighted(new Set());
        for (const val of order) {
            setHighlighted(prev => new Set([...prev, val]));
            await new Promise(r => setTimeout(r, 500));
        }
        setIsAnimating(false);
    }, [root, traversalType, isAnimating]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const rect = canvas.parentElement?.getBoundingClientRect();
        if (!rect) return;
        const dpr = window.devicePixelRatio;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
        const W = rect.width, H = rect.height;
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        ctx.clearRect(0, 0, W, H);

        if (!root) {
            ctx.font = '14px Sora, sans-serif';
            ctx.fillStyle = isDark ? '#6b6358' : '#9c9488';
            ctx.textAlign = 'center';
            ctx.fillText('Insert values to build the tree', W / 2, H / 2);
            return;
        }

        const depth = (n: TreeNode | null): number => n ? 1 + Math.max(depth(n.left), depth(n.right)) : 0;
        const maxD = depth(root);
        const levelH = (H - 60) / Math.max(maxD, 1);
        const nodeR = 18;

        const drawNode = (node: TreeNode | null, x: number, y: number, spread: number) => {
            if (!node) return;
            if (node.left) {
                const cx = x - spread, cy = y + levelH;
                ctx.strokeStyle = isDark ? '#3d3530' : '#d4cec6'; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(x, y + nodeR); ctx.lineTo(cx, cy - nodeR); ctx.stroke();
                drawNode(node.left, cx, cy, spread / 2);
            }
            if (node.right) {
                const cx = x + spread, cy = y + levelH;
                ctx.strokeStyle = isDark ? '#3d3530' : '#d4cec6'; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(x, y + nodeR); ctx.lineTo(cx, cy - nodeR); ctx.stroke();
                drawNode(node.right, cx, cy, spread / 2);
            }
            const isHL = highlighted.has(node.val);
            ctx.fillStyle = isHL ? '#f59e0b' : '#c2714f';
            ctx.beginPath(); ctx.arc(x, y, nodeR, 0, Math.PI * 2); ctx.fill();
            if (isHL) {
                ctx.strokeStyle = '#fde68a'; ctx.lineWidth = 3;
                ctx.beginPath(); ctx.arc(x, y, nodeR + 3, 0, Math.PI * 2); ctx.stroke();
            }
            ctx.font = 'bold 12px monospace'; ctx.fillStyle = 'white';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(`${node.val}`, x, y);
        };

        drawNode(root, W / 2, 40, W / 4);
        ctx.textBaseline = 'alphabetic';
    }, [root, highlighted]);

    return (
        <>
            <div className="tool-controls-row tool-controls-row--4">
                <div className="tool-input-group">
                    <label>Value</label>
                    <input className="tool-input" type="number" value={inputVal} onChange={e => setInputVal(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleInsert()} placeholder="e.g. 25" />
                </div>
                <div className="tool-input-group" style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
                    <button className="tool-btn" onClick={handleInsert}>Insert</button>
                    <button className="tool-btn tool-btn--outline" onClick={handleDelete}>Delete</button>
                </div>
                <div className="tool-input-group">
                    <label>Traversal</label>
                    <select className="tool-input" value={traversalType} onChange={e => setTraversalType(e.target.value)}>
                        <option value="inorder">In-Order</option>
                        <option value="preorder">Pre-Order</option>
                        <option value="postorder">Post-Order</option>
                    </select>
                </div>
                <div className="tool-input-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button className="tool-btn" onClick={animateTraversal} disabled={isAnimating}>
                        {isAnimating ? 'Traversing...' : '▶ Animate'}
                    </button>
                </div>
            </div>

            {highlighted.size > 0 && (
                <div style={{ padding: '8px 16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', marginBottom: 12, fontFamily: 'monospace', fontSize: '0.9rem', color: 'var(--amber)' }}>
                    [{[...highlighted].join(' → ')}]
                </div>
            )}

            <div style={{ width: '100%', aspectRatio: '16/9', background: 'var(--bg-primary)', border: '1px solid var(--border-warm)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <canvas ref={canvasRef} style={{ display: 'block' }} />
            </div>
        </>
    );
}

// ─── TAB BAR STYLE ────────────────────────────────────────────────────────────
const TABS: { id: Tab; label: string }[] = [
    { id: 'stack-queue', label: 'Stack & Queue' },
    { id: 'linked-list', label: 'Linked List' },
    { id: 'bst', label: 'Binary Search Tree' },
];

// ─── Root Component ───────────────────────────────────────────────────────────
export default function DataStructures() {
    const [tab, setTab] = useState<Tab>('stack-queue');

    return (
        <div className="tool-card">
            <div className="tool-card-header">
                <h3>Data Structures</h3>
                <span className="subject-topic" style={{ background: 'var(--terracotta-glow)', color: 'var(--terracotta)' }}>Interactive Playground</span>
            </div>
            <div className="tool-card-body">
                {/* Tab switcher */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 20, borderBottom: '1px solid var(--border-light)', paddingBottom: 12 }}>
                    {TABS.map(t => (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            className={tab === t.id ? 'tool-btn' : 'tool-btn--outline'}
                            style={{ fontSize: '0.82rem', padding: '6px 14px' }}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {tab === 'stack-queue' && <StackQueueTab />}
                {tab === 'linked-list' && <LinkedListTab />}
                {tab === 'bst' && <BSTTab />}
            </div>
        </div>
    );
}
