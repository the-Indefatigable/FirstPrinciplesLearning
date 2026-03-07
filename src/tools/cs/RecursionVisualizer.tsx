import { useState, useRef, useCallback, useEffect } from 'react';

interface TreeNode {
    val: number;
    children: TreeNode[];
    x: number;
    y: number;
    result?: number;
    computing: boolean;
    memoHit: boolean;
}

export default function RecursionVisualizer() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [n, setN] = useState(6);
    const [running, setRunning] = useState(false);
    const [useMemo, setUseMemo] = useState(false);
    const [callCount, setCallCount] = useState(0);
    const cancelRef = useRef(false);
    const treeRef = useRef<TreeNode | null>(null);

    const drawTree = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || !treeRef.current) return;
        const ctx = canvas.getContext('2d')!;
        canvas.width = canvas.parentElement!.clientWidth;
        canvas.height = 260;
        const W = canvas.width;
        const H = canvas.height;
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

        ctx.fillStyle = isDark ? '#141210' : '#faf8f5';
        ctx.fillRect(0, 0, W, H);

        const draw = (node: TreeNode) => {
            // Draw edges to children
            node.children.forEach(child => {
                ctx.strokeStyle = child.result !== undefined ? '#6b8f7180' : isDark ? '#2e2a24' : '#e8e0d4';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(node.x, node.y);
                ctx.lineTo(child.x, child.y);
                ctx.stroke();
            });

            node.children.forEach(draw);

            // Node circle
            const r = 18;
            ctx.beginPath();
            ctx.arc(node.x, node.y, r, 0, Math.PI * 2);

            if (node.computing) {
                ctx.fillStyle = '#d97706';
            } else if (node.memoHit) {
                ctx.fillStyle = '#c2714f';
            } else if (node.result !== undefined) {
                ctx.fillStyle = '#6b8f71';
            } else {
                ctx.fillStyle = isDark ? '#211f1b' : '#ffffff';
            }
            ctx.fill();

            if (!node.computing && node.result === undefined) {
                ctx.strokeStyle = isDark ? '#2e2a24' : '#e8e0d4';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }

            // Label
            ctx.fillStyle = node.computing || node.result !== undefined || node.memoHit ? '#ffffff' : isDark ? '#e8e4de' : '#1a1612';
            ctx.font = 'bold 11px Sora, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`f(${node.val})`, node.x, node.y - 2);

            if (node.result !== undefined) {
                ctx.font = '9px JetBrains Mono, monospace';
                ctx.fillText(`=${node.result}`, node.x, node.y + 10);
            }
        };

        draw(treeRef.current);
    }, []);

    const buildTree = useCallback((val: number, x: number, y: number, spread: number): TreeNode => {
        if (val <= 1) return { val, children: [], x, y, computing: false, memoHit: false };
        const left = buildTree(val - 1, x - spread, y + 60, spread * 0.55);
        const right = buildTree(val - 2, x + spread, y + 60, spread * 0.55);
        return { val, children: [left, right], x, y, computing: false, memoHit: false };
    }, []);

    const run = useCallback(async () => {
        cancelRef.current = false;
        setRunning(true);
        setCallCount(0);

        const canvas = canvasRef.current;
        const W = canvas?.parentElement?.clientWidth || 800;
        const tree = buildTree(n, W / 2, 40, Math.min(W / 4, 180));
        treeRef.current = tree;

        let calls = 0;
        const memo = new Map<number, number>();

        const delay = () => new Promise(r => setTimeout(r, Math.max(80, 400 - n * 30)));

        const solve = async (node: TreeNode): Promise<number> => {
            if (cancelRef.current) return 0;
            calls++;
            setCallCount(calls);

            if (useMemo && memo.has(node.val)) {
                node.memoHit = true;
                node.result = memo.get(node.val)!;
                drawTree();
                await delay();
                return node.result;
            }

            node.computing = true;
            drawTree();
            await delay();

            if (node.val <= 1) {
                node.computing = false;
                node.result = node.val;
                drawTree();
                await delay();
                if (useMemo) memo.set(node.val, node.result);
                return node.result;
            }

            const left = await solve(node.children[0]);
            const right = await solve(node.children[1]);

            node.computing = false;
            node.result = left + right;
            if (useMemo) memo.set(node.val, node.result);
            drawTree();
            await delay();
            return node.result;
        };

        await solve(tree);
        setRunning(false);
    }, [n, useMemo, buildTree, drawTree]);

    // Initial draw
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const W = canvas.parentElement?.clientWidth || 800;
        treeRef.current = buildTree(n, W / 2, 40, Math.min(W / 4, 180));
        drawTree();
    }, [n, buildTree, drawTree]);

    return (
        <div className="tool-card">
            <div className="tool-card-header">
                <h3>Recursion Visualizer — Fibonacci</h3>
                <div className="tool-controls">
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                        <input type="checkbox" checked={useMemo} onChange={(e) => setUseMemo(e.target.checked)} disabled={running} />
                        Memoization
                    </label>
                    <button className="tool-btn" onClick={running ? () => { cancelRef.current = true; } : run}>
                        {running ? 'Stop' : 'Run'}
                    </button>
                </div>
            </div>
            <div className="tool-card-body" style={{ padding: 0 }}>
                <div className="canvas-container" style={{ border: 'none', borderRadius: 0 }}>
                    <canvas ref={canvasRef} />
                </div>
                <div style={{ padding: '12px 24px', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid var(--border-warm)' }}>
                    <div className="tool-slider-group" style={{ flex: 1, minWidth: 120 }}>
                        <label>n = <span className="slider-val">{n}</span></label>
                        <input className="tool-slider" type="range" min={2} max={8} value={n}
                            onChange={(e) => setN(parseInt(e.target.value))} disabled={running} />
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-dim)', fontFamily: 'JetBrains Mono, monospace' }}>
                        calls: <span style={{ color: 'var(--amber)' }}>{callCount}</span>
                        {' · '}
                        <span style={{ color: '#6b8f71' }}>● done</span>
                        {' · '}
                        <span style={{ color: '#d97706' }}>● computing</span>
                        {' · '}
                        <span style={{ color: '#c2714f' }}>● memo hit</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
