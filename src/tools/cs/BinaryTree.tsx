import { useRef, useEffect, useState, useCallback } from 'react';

interface TreeNode { val: number; left: TreeNode | null; right: TreeNode | null; }

function insert(root: TreeNode | null, val: number): TreeNode {
    if (!root) return { val, left: null, right: null };
    if (val < root.val) return { ...root, left: insert(root.left, val) };
    if (val > root.val) return { ...root, right: insert(root.right, val) };
    return root;
}

function deleteNode(root: TreeNode | null, val: number): TreeNode | null {
    if (!root) return null;
    if (val < root.val) return { ...root, left: deleteNode(root.left, val) };
    if (val > root.val) return { ...root, right: deleteNode(root.right, val) };
    if (!root.left) return root.right;
    if (!root.right) return root.left;
    let min = root.right;
    while (min.left) min = min.left;
    return { ...root, val: min.val, right: deleteNode(root.right, min.val) };
}

function getTraversal(root: TreeNode | null, type: string): number[] {
    if (!root) return [];
    if (type === 'inorder') return [...getTraversal(root.left, type), root.val, ...getTraversal(root.right, type)];
    if (type === 'preorder') return [root.val, ...getTraversal(root.left, type), ...getTraversal(root.right, type)];
    return [...getTraversal(root.left, type), ...getTraversal(root.right, type), root.val];
}

export default function BinaryTree() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [root, setRoot] = useState<TreeNode | null>(null);
    const [inputVal, setInputVal] = useState('');
    const [traversalType, setTraversalType] = useState('inorder');
    const [highlighted, setHighlighted] = useState<Set<number>>(new Set());
    const [isAnimating, setIsAnimating] = useState(false);

    // Initialize with some values
    useEffect(() => {
        let tree: TreeNode | null = null;
        for (const v of [50, 30, 70, 20, 40, 60, 80]) tree = insert(tree, v);
        setRoot(tree);
    }, []);

    const handleInsert = () => {
        const val = parseInt(inputVal);
        if (isNaN(val)) return;
        setRoot(prev => insert(prev, val));
        setInputVal('');
    };

    const handleDelete = () => {
        const val = parseInt(inputVal);
        if (isNaN(val)) return;
        setRoot(prev => deleteNode(prev, val));
        setInputVal('');
    };

    const animateTraversal = useCallback(async () => {
        if (!root || isAnimating) return;
        setIsAnimating(true);
        const order = getTraversal(root, traversalType);
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

        // Get tree depth
        const depth = (n: TreeNode | null): number => n ? 1 + Math.max(depth(n.left), depth(n.right)) : 0;
        const maxD = depth(root);
        const levelH = (H - 60) / Math.max(maxD, 1);
        const nodeR = 18;

        const drawNode = (node: TreeNode | null, x: number, y: number, spread: number) => {
            if (!node) return;

            // Draw edges first
            if (node.left) {
                const cx = x - spread, cy = y + levelH;
                ctx.strokeStyle = isDark ? '#3d3530' : '#d4cec6';
                ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(x, y + nodeR); ctx.lineTo(cx, cy - nodeR); ctx.stroke();
                drawNode(node.left, cx, cy, spread / 2);
            }
            if (node.right) {
                const cx = x + spread, cy = y + levelH;
                ctx.strokeStyle = isDark ? '#3d3530' : '#d4cec6';
                ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(x, y + nodeR); ctx.lineTo(cx, cy - nodeR); ctx.stroke();
                drawNode(node.right, cx, cy, spread / 2);
            }

            // Node circle
            const isHL = highlighted.has(node.val);
            ctx.fillStyle = isHL ? '#f59e0b' : (isDark ? '#c2714f' : '#c2714f');
            ctx.beginPath();
            ctx.arc(x, y, nodeR, 0, Math.PI * 2);
            ctx.fill();

            if (isHL) {
                ctx.strokeStyle = '#fde68a';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(x, y, nodeR + 3, 0, Math.PI * 2);
                ctx.stroke();
            }

            // Value
            ctx.font = 'bold 12px monospace';
            ctx.fillStyle = 'white';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${node.val}`, x, y);
        };

        const startX = W / 2;
        const startY = 40;
        drawNode(root, startX, startY, W / 4);
        ctx.textBaseline = 'alphabetic';

    }, [root, highlighted]);

    return (
        <div className="tool-card">
            <div className="tool-card-header">
                <h3>Binary Search Tree</h3>
                <span className="subject-topic" style={{ background: 'var(--terracotta-glow)', color: 'var(--terracotta)' }}>Data Structures</span>
            </div>
            <div className="tool-card-body">
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
            </div>
        </div>
    );
}
