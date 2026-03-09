import { useState, useRef, useCallback, useEffect } from 'react';

interface Node { id: number; x: number; y: number; }
interface Edge { from: number; to: number; }

const DEFAULT_NODES: Node[] = [
    { id: 0, x: 300, y: 50 },
    { id: 1, x: 150, y: 150 }, { id: 2, x: 450, y: 150 },
    { id: 3, x: 80, y: 260 }, { id: 4, x: 220, y: 260 },
    { id: 5, x: 380, y: 260 }, { id: 6, x: 520, y: 260 },
];

const DEFAULT_EDGES: Edge[] = [
    { from: 0, to: 1 }, { from: 0, to: 2 },
    { from: 1, to: 3 }, { from: 1, to: 4 },
    { from: 2, to: 5 }, { from: 2, to: 6 },
    { from: 3, to: 4 }, { from: 5, to: 6 },
];

export default function GraphTraversal() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [algo, setAlgo] = useState<'bfs' | 'dfs'>('bfs');
    const [visited, setVisited] = useState<number[]>([]);
    const [current, setCurrent] = useState<number | null>(null);
    const [frontier, setFrontier] = useState<number[]>([]);
    const [running, setRunning] = useState(false);
    const cancelRef = useRef(false);
    const nodes = DEFAULT_NODES;
    const edges = DEFAULT_EDGES;

    // Draw
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d')!;
        canvas.width = canvas.parentElement!.clientWidth;
        canvas.height = Math.min(canvas.parentElement!.clientWidth, 500);
        const W = canvas.width;
        const H = canvas.height;
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const offsetX = (W - 600) / 2;

        ctx.fillStyle = isDark ? '#141210' : '#faf8f5';
        ctx.fillRect(0, 0, W, H);

        // Edges
        edges.forEach(e => {
            const from = nodes.find(n => n.id === e.from)!;
            const to = nodes.find(n => n.id === e.to)!;
            const fromVisited = visited.includes(e.from);
            const toVisited = visited.includes(e.to);
            ctx.strokeStyle = fromVisited && toVisited ? '#d97706' : isDark ? '#2e2a24' : '#e8e0d4';
            ctx.lineWidth = fromVisited && toVisited ? 2.5 : 1.5;
            ctx.beginPath();
            ctx.moveTo(from.x + offsetX, from.y);
            ctx.lineTo(to.x + offsetX, to.y);
            ctx.stroke();
        });

        // Nodes
        nodes.forEach(n => {
            const x = n.x + offsetX;
            const isVisited = visited.includes(n.id);
            const isCurrent = current === n.id;
            const isFrontier = frontier.includes(n.id);

            const r = 22;
            ctx.beginPath();
            ctx.arc(x, n.y, r, 0, Math.PI * 2);
            if (isCurrent) {
                ctx.fillStyle = '#d97706';
                ctx.fill();
                ctx.strokeStyle = '#f59e0b';
                ctx.lineWidth = 3;
                ctx.stroke();
            } else if (isVisited) {
                ctx.fillStyle = '#6b8f71';
                ctx.fill();
            } else if (isFrontier) {
                ctx.fillStyle = isDark ? '#2e2a24' : '#f3efe8';
                ctx.fill();
                ctx.strokeStyle = '#d97706';
                ctx.lineWidth = 2;
                ctx.setLineDash([4, 3]);
                ctx.stroke();
                ctx.setLineDash([]);
            } else {
                ctx.fillStyle = isDark ? '#211f1b' : '#ffffff';
                ctx.fill();
                ctx.strokeStyle = isDark ? '#2e2a24' : '#e8e0d4';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }

            // Label
            ctx.fillStyle = isCurrent || isVisited ? '#ffffff' : isDark ? '#e8e4de' : '#1a1612';
            ctx.font = 'bold 14px Sora, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(n.id), x, n.y);
        });
    }, [visited, current, frontier]);

    const getNeighbors = (id: number) => {
        const neighbors: number[] = [];
        edges.forEach(e => {
            if (e.from === id) neighbors.push(e.to);
            if (e.to === id) neighbors.push(e.from);
        });
        return neighbors.sort((a, b) => a - b);
    };

    const run = useCallback(async () => {
        cancelRef.current = false;
        setRunning(true);
        setVisited([]);
        setCurrent(null);
        setFrontier([]);

        const visited: number[] = [];
        const delay = () => new Promise(r => setTimeout(r, 600));

        if (algo === 'bfs') {
            const queue = [0];
            setFrontier([0]);
            while (queue.length > 0) {
                if (cancelRef.current) break;
                const node = queue.shift()!;
                if (visited.includes(node)) continue;
                visited.push(node);
                setCurrent(node);
                setVisited([...visited]);
                await delay();

                const neighbors = getNeighbors(node).filter(n => !visited.includes(n) && !queue.includes(n));
                queue.push(...neighbors);
                setFrontier([...queue]);
                await delay();
            }
        } else {
            const stack = [0];
            setFrontier([0]);
            while (stack.length > 0) {
                if (cancelRef.current) break;
                const node = stack.pop()!;
                if (visited.includes(node)) continue;
                visited.push(node);
                setCurrent(node);
                setVisited([...visited]);
                await delay();

                const neighbors = getNeighbors(node).filter(n => !visited.includes(n)).reverse();
                stack.push(...neighbors);
                setFrontier([...stack]);
                await delay();
            }
        }

        setCurrent(null);
        setFrontier([]);
        setRunning(false);
    }, [algo]);

    return (
        <div className="tool-card">
            <div className="tool-card-header">
                <h3>Graph Traversal</h3>
                <div className="tool-controls">
                    <select className="tool-input" style={{ width: 'auto', padding: '6px 10px', fontSize: '0.82rem' }}
                        value={algo} onChange={(e) => setAlgo(e.target.value as 'bfs' | 'dfs')} disabled={running}>
                        <option value="bfs">BFS (Breadth-First)</option>
                        <option value="dfs">DFS (Depth-First)</option>
                    </select>
                    <button className="tool-btn" onClick={running ? () => { cancelRef.current = true; } : run}>
                        {running ? 'Stop' : 'Traverse'}
                    </button>
                    <button className="tool-btn--outline tool-btn" onClick={() => { setVisited([]); setCurrent(null); setFrontier([]); }} disabled={running}>Reset</button>
                </div>
            </div>
            <div className="tool-card-body" style={{ padding: 0 }}>
                <div className="canvas-container" style={{ border: 'none', borderRadius: 0 }}>
                    <canvas ref={canvasRef} />
                </div>
                <div style={{ padding: '12px 24px', fontSize: '0.82rem', color: 'var(--text-dim)', borderTop: '1px solid var(--border-warm)' }}>
                    <span style={{ color: '#d97706' }}>● Current</span>
                    {' · '}
                    <span style={{ color: '#6b8f71' }}>● Visited</span>
                    {' · '}
                    <span>○ Frontier (dashed)</span>
                    {' · '}
                    Visited order: [{visited.join(', ')}]
                </div>
            </div>
        </div>
    );
}
