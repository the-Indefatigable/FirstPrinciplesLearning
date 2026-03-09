import { useState, useRef, useCallback, useEffect } from 'react';

type Algorithm = 'bubble' | 'selection' | 'insertion' | 'merge' | 'quick';

export default function SortingVisualizer() {
    const [size, setSize] = useState(40);
    const [speed, setSpeed] = useState(50);
    const [algo, setAlgo] = useState<Algorithm>('bubble');
    const [arr, setArr] = useState<number[]>([]);
    const [comparing, setComparing] = useState<number[]>([]);
    const [sorted, setSorted] = useState<number[]>([]);
    const [running, setRunning] = useState(false);
    const [comparisons, setComparisons] = useState(0);
    const cancelRef = useRef(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const generate = useCallback(() => {
        cancelRef.current = true;
        const a = Array.from({ length: size }, () => Math.random() * 0.9 + 0.1);
        setArr(a);
        setComparing([]);
        setSorted([]);
        setComparisons(0);
        setRunning(false);
    }, [size]);

    useEffect(() => { generate(); }, [generate]);

    // Draw bars
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d')!;
        canvas.width = canvas.parentElement!.clientWidth;
        canvas.height = Math.min(canvas.parentElement!.clientWidth, 500);
        const W = canvas.width;
        const H = canvas.height;
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

        ctx.fillStyle = isDark ? '#141210' : '#faf8f5';
        ctx.fillRect(0, 0, W, H);

        const barW = (W - 20) / arr.length;
        const gap = Math.max(1, barW * 0.1);

        arr.forEach((v, i) => {
            const x = 10 + i * barW;
            const h = v * (H - 20);
            const y = H - 10 - h;

            if (sorted.includes(i)) ctx.fillStyle = '#6b8f71';
            else if (comparing.includes(i)) ctx.fillStyle = '#d97706';
            else ctx.fillStyle = isDark ? '#4a443c' : '#c4bdb0';

            ctx.fillRect(x + gap / 2, y, barW - gap, h);
        });
    }, [arr, comparing, sorted]);

    const delay = () => new Promise(r => setTimeout(r, Math.max(1, 100 - speed)));

    const run = useCallback(async () => {
        cancelRef.current = false;
        setRunning(true);
        setSorted([]);
        let comp = 0;
        const a = [...arr];

        const update = async (cmp: number[] = [], srt: number[] = []) => {
            if (cancelRef.current) throw new Error('cancelled');
            setArr([...a]);
            setComparing(cmp);
            setSorted(srt);
            setComparisons(comp);
            await delay();
        };

        try {
            if (algo === 'bubble') {
                for (let i = a.length - 1; i > 0; i--) {
                    for (let j = 0; j < i; j++) {
                        comp++;
                        await update([j, j + 1]);
                        if (a[j] > a[j + 1]) [a[j], a[j + 1]] = [a[j + 1], a[j]];
                    }
                    await update([], Array.from({ length: a.length - i }, (_, k) => a.length - 1 - k));
                }
            } else if (algo === 'selection') {
                for (let i = 0; i < a.length; i++) {
                    let min = i;
                    for (let j = i + 1; j < a.length; j++) {
                        comp++;
                        await update([min, j]);
                        if (a[j] < a[min]) min = j;
                    }
                    [a[i], a[min]] = [a[min], a[i]];
                    await update([], Array.from({ length: i + 1 }, (_, k) => k));
                }
            } else if (algo === 'insertion') {
                for (let i = 1; i < a.length; i++) {
                    let j = i;
                    while (j > 0 && a[j] < a[j - 1]) {
                        comp++;
                        await update([j, j - 1]);
                        [a[j], a[j - 1]] = [a[j - 1], a[j]];
                        j--;
                    }
                }
            } else if (algo === 'merge') {
                await mergeSort(a, 0, a.length - 1, async (cmp) => { comp += cmp; await update([]); });
            } else if (algo === 'quick') {
                await quickSort(a, 0, a.length - 1, async (i, j) => { comp++; await update([i, j]); });
            }

            setArr([...a]);
            setSorted(a.map((_, i) => i));
            setComparing([]);
            setComparisons(comp);
        } catch { /* cancelled */ }
        setRunning(false);
    }, [arr, algo, speed]);

    return (
        <div className="tool-card">
            <div className="tool-card-header">
                <h3>Sorting Visualizer</h3>
                <div className="tool-controls">
                    <select className="tool-input" style={{ width: 'auto', padding: '6px 10px', fontSize: '0.82rem' }}
                        value={algo} onChange={(e) => setAlgo(e.target.value as Algorithm)} disabled={running}>
                        <option value="bubble">Bubble Sort</option>
                        <option value="selection">Selection Sort</option>
                        <option value="insertion">Insertion Sort</option>
                        <option value="merge">Merge Sort</option>
                        <option value="quick">Quick Sort</option>
                    </select>
                    <button className="tool-btn" onClick={running ? () => { cancelRef.current = true; } : run}>
                        {running ? 'Stop' : 'Sort'}
                    </button>
                    <button className="tool-btn--outline tool-btn" onClick={generate} disabled={running}>Shuffle</button>
                </div>
            </div>
            <div className="tool-card-body" style={{ padding: 0 }}>
                <div className="canvas-container" style={{ border: 'none', borderRadius: 0 }}>
                    <canvas ref={canvasRef} />
                </div>
                <div style={{ padding: '12px 24px', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid var(--border-warm)' }}>
                    <div className="tool-slider-group" style={{ flex: 1, minWidth: 120 }}>
                        <label>Size: <span className="slider-val">{size}</span></label>
                        <input className="tool-slider" type="range" min={10} max={100} value={size}
                            onChange={(e) => setSize(parseInt(e.target.value))} disabled={running} />
                    </div>
                    <div className="tool-slider-group" style={{ flex: 1, minWidth: 120 }}>
                        <label>Speed: <span className="slider-val">{speed}</span></label>
                        <input className="tool-slider" type="range" min={1} max={99} value={speed}
                            onChange={(e) => setSpeed(parseInt(e.target.value))} />
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-dim)', fontFamily: 'JetBrains Mono, monospace' }}>
                        Comparisons: <span style={{ color: 'var(--amber)' }}>{comparisons}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

async function mergeSort(a: number[], l: number, r: number, onStep: (cmp: number) => Promise<void>) {
    if (l >= r) return;
    const m = Math.floor((l + r) / 2);
    await mergeSort(a, l, m, onStep);
    await mergeSort(a, m + 1, r, onStep);
    const left = a.slice(l, m + 1);
    const right = a.slice(m + 1, r + 1);
    let i = 0, j = 0, k = l;
    while (i < left.length && j < right.length) {
        a[k++] = left[i] <= right[j] ? left[i++] : right[j++];
        await onStep(1);
    }
    while (i < left.length) a[k++] = left[i++];
    while (j < right.length) a[k++] = right[j++];
    await onStep(0);
}

async function quickSort(a: number[], l: number, r: number, onStep: (i: number, j: number) => Promise<void>) {
    if (l >= r) return;
    const pivot = a[r];
    let i = l;
    for (let j = l; j < r; j++) {
        await onStep(j, r);
        if (a[j] < pivot) {
            [a[i], a[j]] = [a[j], a[i]];
            i++;
        }
    }
    [a[i], a[r]] = [a[r], a[i]];
    await quickSort(a, l, i - 1, onStep);
    await quickSort(a, i + 1, r, onStep);
}
