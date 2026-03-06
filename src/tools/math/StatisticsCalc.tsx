import { useRef, useEffect, useState, useCallback } from 'react';

const SAMPLE_DATASETS: Record<string, number[]> = {
    'Exam Scores': [72, 85, 90, 68, 74, 88, 95, 82, 79, 91, 76, 84, 93, 70, 87, 81, 77, 89, 73, 86, 92, 78, 83, 75, 80],
    'Heights (cm)': [155, 162, 170, 165, 178, 172, 168, 160, 175, 183, 158, 169, 177, 164, 173, 180, 167, 171, 166, 174],
    'Dice Rolls': Array.from({ length: 60 }, () => Math.ceil(Math.random() * 6)),
    'Custom': [],
};

function computeStats(data: number[]) {
    if (data.length === 0) return null;
    const sorted = [...data].sort((a, b) => a - b);
    const n = data.length;
    const sum = data.reduce((a, b) => a + b, 0);
    const mean = sum / n;
    const variance = data.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1 || 1);
    const stdDev = Math.sqrt(variance);
    const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];
    const min = sorted[0];
    const max = sorted[n - 1];
    const q1 = sorted[Math.floor(n * 0.25)];
    const q3 = sorted[Math.floor(n * 0.75)];
    const iqr = q3 - q1;
    const mode = (() => {
        const freq: Record<number, number> = {};
        let maxF = 0, modeVal = data[0];
        for (const x of data) { freq[x] = (freq[x] || 0) + 1; if (freq[x] > maxF) { maxF = freq[x]; modeVal = x; } }
        return maxF > 1 ? modeVal : NaN;
    })();

    return { mean, median, mode, stdDev, variance, min, max, q1, q3, iqr, n, sum };
}

export default function StatisticsCalc() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [datasetKey, setDatasetKey] = useState('Exam Scores');
    const [customInput, setCustomInput] = useState('');
    const [data, setData] = useState<number[]>(SAMPLE_DATASETS['Exam Scores']);
    const [bins, setBins] = useState(8);
    const [showRegression, setShowRegression] = useState(false);

    const selectDataset = useCallback((key: string) => {
        setDatasetKey(key);
        if (key === 'Custom') {
            setData([]);
        } else {
            setData(SAMPLE_DATASETS[key]);
        }
    }, []);

    const parseCustom = useCallback(() => {
        const nums = customInput.split(/[,\s]+/).map(Number).filter(n => !isNaN(n));
        setData(nums);
    }, [customInput]);

    // Draw histogram
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || data.length === 0) return;
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
        const pad = { top: 20, right: 20, bottom: 36, left: 45 };
        const cw = W - pad.left - pad.right;
        const ch = H - pad.top - pad.bottom;

        ctx.clearRect(0, 0, W, H);

        const stats = computeStats(data);
        if (!stats) return;

        // Bin the data
        const binWidth = (stats.max - stats.min) / bins || 1;
        const histogram: number[] = new Array(bins).fill(0);
        for (const x of data) {
            let idx = Math.floor((x - stats.min) / binWidth);
            if (idx >= bins) idx = bins - 1;
            histogram[idx]++;
        }
        const maxCount = Math.max(...histogram);

        // Draw bars
        const barW = cw / bins;
        for (let i = 0; i < bins; i++) {
            const barH = (histogram[i] / maxCount) * ch;
            const x = pad.left + i * barW;
            const y = pad.top + ch - barH;

            const gradient = ctx.createLinearGradient(x, y, x, pad.top + ch);
            gradient.addColorStop(0, isDark ? '#d97706' : '#f59e0b');
            gradient.addColorStop(1, isDark ? '#92400e80' : '#fde68a80');
            ctx.fillStyle = gradient;
            ctx.fillRect(x + 1, y, barW - 2, barH);

            ctx.strokeStyle = isDark ? '#b4530980' : '#d9770680';
            ctx.lineWidth = 1;
            ctx.strokeRect(x + 1, y, barW - 2, barH);

            // Count label
            if (histogram[i] > 0) {
                ctx.font = 'bold 9px Sora, sans-serif';
                ctx.fillStyle = isDark ? '#fbbf24' : '#92400e';
                ctx.textAlign = 'center';
                ctx.fillText(String(histogram[i]), x + barW / 2, y - 4);
            }
        }

        // Axes
        ctx.strokeStyle = isDark ? '#4a4540' : '#9c9488';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pad.left, pad.top);
        ctx.lineTo(pad.left, pad.top + ch);
        ctx.lineTo(pad.left + cw, pad.top + ch);
        ctx.stroke();

        // X-axis labels
        ctx.font = '9px Sora, sans-serif';
        ctx.fillStyle = isDark ? '#6b6560' : '#9c9488';
        ctx.textAlign = 'center';
        for (let i = 0; i <= bins; i += Math.max(1, Math.floor(bins / 5))) {
            const val = stats.min + i * binWidth;
            const x = pad.left + i * barW;
            ctx.fillText(val.toFixed(1), x, pad.top + ch + 16);
        }

        // Mean line
        const meanX = pad.left + ((stats.mean - stats.min) / (stats.max - stats.min)) * cw;
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(meanX, pad.top);
        ctx.lineTo(meanX, pad.top + ch);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = 'bold 9px Sora';
        ctx.fillStyle = '#ef4444';
        ctx.fillText(`μ=${stats.mean.toFixed(1)}`, meanX, pad.top - 4);

        // Median line
        const medX = pad.left + ((stats.median - stats.min) / (stats.max - stats.min)) * cw;
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(medX, pad.top);
        ctx.lineTo(medX, pad.top + ch);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#3b82f6';
        ctx.fillText(`Med=${stats.median.toFixed(1)}`, medX, pad.top + 12);

        // Normal curve overlay
        if (showRegression && stats.stdDev > 0) {
            ctx.strokeStyle = isDark ? '#22c55e' : '#16a34a';
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let px = 0; px <= cw; px++) {
                const x = stats.min + (px / cw) * (stats.max - stats.min);
                const z = (x - stats.mean) / stats.stdDev;
                const pdf = (1 / (stats.stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * z * z);
                const scaledY = pdf * data.length * binWidth;
                const sy = pad.top + ch - (scaledY / maxCount) * ch;
                px === 0 ? ctx.moveTo(pad.left + px, sy) : ctx.lineTo(pad.left + px, sy);
            }
            ctx.stroke();
        }

    }, [data, bins, showRegression]);

    const stats = computeStats(data);

    return (
        <div className="tool-card">
            <div className="tool-card-header">
                <h3>Statistics Calculator</h3>
                <span className="subject-topic" style={{ background: 'var(--amber-glow)', color: 'var(--amber)' }}>Statistics</span>
            </div>
            <div className="tool-card-body">
                {/* Dataset selector */}
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
                    {Object.keys(SAMPLE_DATASETS).map(key => (
                        <button key={key} onClick={() => selectDataset(key)}
                            style={{
                                padding: '4px 10px', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem',
                                fontWeight: 600, cursor: 'pointer',
                                background: datasetKey === key ? 'var(--amber)' : 'transparent',
                                color: datasetKey === key ? '#fff' : 'var(--text-dim)',
                                border: `1px solid ${datasetKey === key ? 'var(--amber)' : 'var(--border-warm)'}`,
                            }}>
                            {key}
                        </button>
                    ))}
                </div>

                {/* Custom input */}
                {datasetKey === 'Custom' && (
                    <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                        <input style={inputStyle} value={customInput}
                            onChange={e => setCustomInput(e.target.value)}
                            placeholder="Enter numbers separated by commas or spaces" />
                        <button className="btn-primary" onClick={parseCustom} style={{ fontSize: '0.82rem', padding: '6px 14px' }}>Parse</button>
                    </div>
                )}

                {/* Controls */}
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                        Bins: <input type="range" min={4} max={20} value={bins} onChange={e => setBins(+e.target.value)}
                            style={{ width: 80, accentColor: 'var(--amber)' }} /> {bins}
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', color: '#22c55e', cursor: 'pointer' }}>
                        <input type="checkbox" checked={showRegression} onChange={e => setShowRegression(e.target.checked)} />
                        Normal Curve
                    </label>
                </div>

                {/* Histogram */}
                <div style={{ width: '100%', aspectRatio: '16/9', background: 'var(--bg-primary)', border: '1px solid var(--border-warm)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: 12 }}>
                    {data.length > 0 ? (
                        <canvas ref={canvasRef} style={{ display: 'block' }} />
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                            Enter data and click Parse
                        </div>
                    )}
                </div>

                {/* Legend */}
                <div style={{ display: 'flex', gap: 14, fontSize: '0.72rem', marginBottom: 8, color: 'var(--text-dim)' }}>
                    <span>🔴 Mean (μ)</span>
                    <span>🔵 Median</span>
                    {showRegression && <span>🟢 Normal Curve</span>}
                </div>

                {/* Stats table */}
                {stats && (
                    <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 6,
                        background: 'var(--bg-secondary)', border: '1px solid var(--border-warm)',
                        borderRadius: 'var(--radius-sm)', padding: 12,
                    }}>
                        {[
                            ['n', stats.n],
                            ['Mean', stats.mean.toFixed(2)],
                            ['Median', stats.median.toFixed(2)],
                            ['Mode', isNaN(stats.mode) ? 'None' : stats.mode],
                            ['Std Dev', stats.stdDev.toFixed(2)],
                            ['Variance', stats.variance.toFixed(2)],
                            ['Min', stats.min],
                            ['Max', stats.max],
                            ['Q1', stats.q1],
                            ['Q3', stats.q3],
                            ['IQR', stats.iqr.toFixed(2)],
                            ['Sum', stats.sum],
                        ].map(([label, val]) => (
                            <div key={String(label)} style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', fontWeight: 600, marginBottom: 2 }}>{label}</div>
                                <div style={{ fontSize: '0.9rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-primary)' }}>{val}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

const inputStyle: React.CSSProperties = {
    flex: 1, padding: '6px 10px', borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-warm)', background: 'var(--bg-secondary)',
    color: 'var(--text-primary)', fontSize: '0.88rem', fontFamily: 'inherit',
};
