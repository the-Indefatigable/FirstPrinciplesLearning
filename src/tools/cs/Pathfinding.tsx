import { useState, useEffect } from 'react';

type NodeType = 'empty' | 'wall' | 'start' | 'end' | 'visited' | 'path';

interface NodeData {
    r: number;
    c: number;
    type: NodeType;
    gCost: number;
    hCost: number;
    fCost: number;
    parent: NodeData | null;
}

const ROWS = 20;
const COLS = 40;
const START_NODE = { r: 10, c: 5 };
const END_NODE = { r: 10, c: 34 };

export default function Pathfinding() {
    const [grid, setGrid] = useState<NodeData[][]>([]);
    const [isMousePressed, setIsMousePressed] = useState(false);
    const [isRunning, setIsRunning] = useState(false);

    // Initialize Grid
    useEffect(() => {
        resetGrid();
    }, []);

    const resetGrid = () => {
        const newGrid: NodeData[][] = [];
        for (let r = 0; r < ROWS; r++) {
            const currentRow: NodeData[] = [];
            for (let c = 0; c < COLS; c++) {
                currentRow.push({
                    r, c,
                    type: (r === START_NODE.r && c === START_NODE.c) ? 'start' :
                        (r === END_NODE.r && c === END_NODE.c) ? 'end' : 'empty',
                    gCost: Infinity,
                    hCost: 0,
                    fCost: Infinity,
                    parent: null
                });
            }
            newGrid.push(currentRow);
        }
        setGrid(newGrid);
        setIsRunning(false);
    };

    const clearPath = () => {
        setGrid(prev => prev.map(row => row.map(node => ({
            ...node,
            type: (node.type === 'visited' || node.type === 'path') ? 'empty' : node.type,
            gCost: Infinity,
            fCost: Infinity,
            parent: null
        }))));
        setIsRunning(false);
    };

    const toggleWall = (r: number, c: number) => {
        if (isRunning) return;
        setGrid(prev => prev.map((row, rIdx) =>
            rIdx !== r ? row : row.map((node, cIdx) => {
                if (cIdx !== c) return node;
                if (node.type === 'empty') return { ...node, type: 'wall' as NodeType };
                if (node.type === 'wall') return { ...node, type: 'empty' as NodeType };
                return node;
            })
        ));
    };

    const handleMouseDown = (r: number, c: number) => {
        setIsMousePressed(true);
        toggleWall(r, c);
    };

    const handleMouseEnter = (r: number, c: number) => {
        if (!isMousePressed) return;
        toggleWall(r, c);
    };

    const handleMouseUp = () => {
        setIsMousePressed(false);
    };

    // A* Algorithm
    const runAStar = async () => {
        if (isRunning) return;
        clearPath();
        setIsRunning(true);

        const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

        // Use a ref-like approach to get latest grid state inside async loop without re-triggering closures
        let currentGrid = JSON.parse(JSON.stringify(grid)) as NodeData[][];

        const openSet: NodeData[] = [];
        const closedSet = new Set<string>();

        const startNode = currentGrid[START_NODE.r][START_NODE.c];

        startNode.gCost = 0;
        startNode.hCost = Math.abs(START_NODE.r - END_NODE.r) + Math.abs(START_NODE.c - END_NODE.c); // Manhattan
        startNode.fCost = startNode.hCost;
        openSet.push(startNode);

        const getNeighbors = (node: NodeData) => {
            const neighbors: NodeData[] = [];
            const { r, c } = node;
            if (r > 0) neighbors.push(currentGrid[r - 1][c]); // Up
            if (r < ROWS - 1) neighbors.push(currentGrid[r + 1][c]); // Down
            if (c > 0) neighbors.push(currentGrid[r][c - 1]); // Left
            if (c < COLS - 1) neighbors.push(currentGrid[r][c + 1]); // Right
            return neighbors.filter(n => n.type !== 'wall');
        };

        const updateStateGrid = () => {
            setGrid([...currentGrid]);
        };

        while (openSet.length > 0) {
            // Find lowest fCost
            openSet.sort((a, b) => a.fCost - b.fCost || a.hCost - b.hCost);
            const current = openSet.shift()!;

            closedSet.add(`${current.r}-${current.c}`);

            if (current.type !== 'start' && current.type !== 'end') {
                currentGrid[current.r][current.c].type = 'visited';
                updateStateGrid();
                await sleep(5); // Animation delay
            }

            if (current.r === END_NODE.r && current.c === END_NODE.c) {
                // Path found
                let pathNode = current.parent;
                while (pathNode && pathNode.type !== 'start') {
                    currentGrid[pathNode.r][pathNode.c].type = 'path';
                    updateStateGrid();
                    await sleep(20);
                    pathNode = pathNode.parent;
                }
                setIsRunning(false);
                return;
            }

            const neighbors = getNeighbors(current);
            for (const neighbor of neighbors) {
                if (closedSet.has(`${neighbor.r}-${neighbor.c}`)) continue;

                const tentativeGCost = current.gCost + 1;

                let isNewToOpenSet = false;
                if (!openSet.some(n => n.r === neighbor.r && n.c === neighbor.c)) {
                    isNewToOpenSet = true;
                }

                if (tentativeGCost < neighbor.gCost || isNewToOpenSet) {
                    neighbor.parent = current;
                    neighbor.gCost = tentativeGCost;
                    neighbor.hCost = Math.abs(neighbor.r - END_NODE.r) + Math.abs(neighbor.c - END_NODE.c);
                    neighbor.fCost = neighbor.gCost + neighbor.hCost;

                    if (isNewToOpenSet) {
                        openSet.push(neighbor);
                    }
                }
            }
        }

        setIsRunning(false); // No path found
    };

    return (
        <div className="tool-card pathfinding">
            <div className="tool-card-header">
                <h3>A* Pathfinding Visualizer</h3>
                <span className="subject-topic" style={{ background: 'var(--sage-glow)', color: 'var(--sage)' }}>Algorithms</span>
            </div>

            <div className="tool-card-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
                        <strong>Click and drag</strong> on the grid to draw walls.
                    </p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="tool-btn tool-btn--outline" onClick={clearPath} disabled={isRunning}>Clear Path</button>
                        <button className="tool-btn tool-btn--outline" onClick={resetGrid} disabled={isRunning}>Clear Board</button>
                        <button className="tool-btn" onClick={runAStar} disabled={isRunning}>Visualize A*</button>
                    </div>
                </div>

                <div
                    style={{
                        display: 'grid',
                        gridTemplateRows: `repeat(${ROWS}, 20px)`,
                        gridTemplateColumns: `repeat(${COLS}, 20px)`,
                        gap: '1px',
                        background: 'var(--border-warm)', // Acts as grid lines due to gap
                        border: '1px solid var(--border-warm)',
                        width: 'fit-content',
                        margin: '0 auto',
                        userSelect: 'none'
                    }}
                    onMouseLeave={handleMouseUp}
                >
                    {grid.map((row, rIdx) =>
                        row.map((node, cIdx) => {
                            let bg = 'var(--bg-primary)';
                            if (node.type === 'start') bg = 'var(--sage)';
                            else if (node.type === 'end') bg = 'var(--terracotta)';
                            else if (node.type === 'wall') bg = 'var(--text-primary)';
                            else if (node.type === 'visited') bg = 'var(--amber-soft)';
                            else if (node.type === 'path') bg = 'var(--amber)';

                            return (
                                <div
                                    key={`${rIdx}-${cIdx}`}
                                    style={{
                                        width: '20px',
                                        height: '20px',
                                        background: bg,
                                        transition: node.type === 'visited' ? 'background 0.3s ease-out' : 'none',
                                        borderRadius: node.type === 'start' || node.type === 'end' ? '50%' : '2px',
                                        transform: (node.type === 'start' || node.type === 'end') ? 'scale(0.8)' : 'scale(1)'
                                    }}
                                    onMouseDown={() => handleMouseDown(rIdx, cIdx)}
                                    onMouseEnter={() => handleMouseEnter(rIdx, cIdx)}
                                    onMouseUp={handleMouseUp}
                                />
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
