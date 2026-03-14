import { useRef, useEffect, useState, useCallback } from 'react';
import ToolLayoutSplit from '../../components/tool/ToolLayoutSplit';
import { useTheme } from '../../hooks/useTheme';

// ── Pure math helpers ────────────────────────────────────────────────────────

function erf(x: number): number {
    const t = 1 / (1 + 0.3275911 * Math.abs(x));
    const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
    const r = 1 - poly * Math.exp(-x * x);
    return x >= 0 ? r : -r;
}

function normalCDF(x: number, mu = 0, sigma = 1): number {
    return 0.5 * (1 + erf((x - mu) / (sigma * Math.SQRT2)));
}

function normalPDF(x: number, mu = 0, sigma = 1): number {
    return Math.exp(-0.5 * ((x - mu) / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI));
}

function binomPMF(k: number, n: number, p: number): number {
    if (k < 0 || k > n) return 0;
    let logC = 0;
    for (let i = 0; i < k; i++) logC += Math.log(n - i) - Math.log(i + 1);
    return Math.exp(logC + k * Math.log(p || 1e-300) + (n - k) * Math.log(1 - p || 1e-300));
}

function poissonPMF(k: number, lambda: number): number {
    let logP = -lambda + k * Math.log(lambda || 1e-300);
    for (let i = 1; i <= k; i++) logP -= Math.log(i);
    return Math.exp(logP);
}

function exponentialPDF(x: number, lambda: number): number {
    return x < 0 ? 0 : lambda * Math.exp(-lambda * x);
}

function lgamma(x: number): number {
    const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    let y = x, tmp = x + 5.5;
    tmp -= (x + 0.5) * Math.log(tmp);
    let ser = 1.000000000190015;
    for (const ci of c) ser += ci / ++y;
    return -tmp + Math.log(2.5066282746310005 * ser / x);
}

function betaCF(a: number, b: number, x: number): number {
    const MAXIT = 200, EPS = 3e-7;
    let qab = a + b, qap = a + 1, qam = a - 1;
    let c = 1, d = 1 - qab * x / qap;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    d = 1 / d; let h = d;
    for (let m = 1; m <= MAXIT; m++) {
        const m2 = 2 * m;
        let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
        d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30;
        c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30;
        d = 1 / d; h *= d * c;
        aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
        d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30;
        c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30;
        d = 1 / d; const del = d * c; h *= del;
        if (Math.abs(del - 1) < EPS) break;
    }
    return h;
}

function incompleteBeta(a: number, b: number, x: number): number {
    if (x <= 0) return 0; if (x >= 1) return 1;
    const lbeta = lgamma(a) + lgamma(b) - lgamma(a + b);
    const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lbeta) / a;
    if (x < (a + 1) / (a + b + 2)) return front * betaCF(a, b, x);
    return 1 - (Math.exp(Math.log(1 - x) * b + Math.log(x) * a - lbeta) / b) * betaCF(b, a, 1 - x);
}

function tTestPValue(t: number, df: number): number {
    return incompleteBeta(df / 2, 0.5, df / (df + t * t));
}

// t-dist PDF for visualisation
function tPDF(x: number, df: number): number {
    const lbeta = lgamma(0.5) + lgamma(df / 2) - lgamma((df + 1) / 2);
    return Math.exp(-((df + 1) / 2) * Math.log(1 + x * x / df) - lbeta) / Math.sqrt(df);
}

// ── Descriptive stats ────────────────────────────────────────────────────────

interface Stats {
    n: number; mean: number; median: number; mode: number | null;
    stdDev: number; variance: number; min: number; max: number;
    q1: number; q3: number; iqr: number; sum: number;
    skewness: number; kurtosis: number;
}

function computeStats(data: number[]): Stats | null {
    if (data.length < 2) return null;
    const sorted = [...data].sort((a, b) => a - b);
    const n = data.length;
    const sum = data.reduce((a, b) => a + b, 0);
    const mean = sum / n;
    const variance = data.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1);
    const stdDev = Math.sqrt(variance);
    const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];
    const q1 = sorted[Math.floor(n * 0.25)];
    const q3 = sorted[Math.floor(n * 0.75)];
    const freq: Record<number, number> = {};
    let maxF = 0;
    for (const x of data) { freq[x] = (freq[x] || 0) + 1; if (freq[x] > maxF) maxF = freq[x]; }
    const mode = maxF > 1 ? +Object.entries(freq).find(([, f]) => f === maxF)![0] : null;
    const m3 = data.reduce((s, x) => s + ((x - mean) / (stdDev || 1)) ** 3, 0) / n;
    const m4 = data.reduce((s, x) => s + ((x - mean) / (stdDev || 1)) ** 4, 0) / n;
    return { n, mean, median, mode, stdDev, variance, min: sorted[0], max: sorted[n - 1], q1, q3, iqr: q3 - q1, sum, skewness: m3, kurtosis: m4 - 3 };
}

function parseNumbers(raw: string): number[] {
    if (!raw.trim()) return [];
    return raw.split(/[\s,;\t\n]+/).map(Number).filter(v => !isNaN(v) && isFinite(v));
}

const SAMPLES: Record<string, string> = {
    'Exam Scores': '72 85 90 68 74 88 95 82 79 91 76 84 93 70 87 81 77 89 73 86 92 78 83 75 80',
    'Heights (cm)': '155 162 170 165 178 172 168 160 175 183 158 169 177 164 173 180 167 171 166 174',
    'Reaction (ms)': '312 298 345 287 401 322 310 389 276 354 331 299 418 305 342 268 376 319 291 360',
};

// ── Canvas setup helper ──────────────────────────────────────────────────────

function setupCanvas(canvas: HTMLCanvasElement, container: HTMLElement): { ctx: CanvasRenderingContext2D; W: number; H: number } | null {
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const W = container.clientWidth, H = container.clientHeight;
    if (W === 0 || H === 0) return null;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
    return { ctx, W, H };
}

// ── Colour tokens ────────────────────────────────────────────────────────────

const amber = '#d97706', red = '#ef4444', blue = '#3b82f6', green = '#22c55e';
const axisC = (d: boolean) => d ? '#3d3530' : '#d4cec6';
const textC = (d: boolean) => d ? '#9c9488' : '#6b6560';
const bgC   = (d: boolean) => d ? '#0d0b09' : '#faf8f5';

// ── Axis drawing helper ──────────────────────────────────────────────────────

function drawAxes(ctx: CanvasRenderingContext2D, pad: { top: number; right: number; bottom: number; left: number }, W: number, H: number, isDark: boolean) {
    const cw = W - pad.left - pad.right, ch = H - pad.top - pad.bottom;
    ctx.strokeStyle = axisC(isDark); ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top); ctx.lineTo(pad.left, pad.top + ch);
    ctx.lineTo(pad.left + cw, pad.top + ch); ctx.stroke();
}

// ════════════════════════════════════════════════════════════
// TAB — DESCRIPTIVE
// ════════════════════════════════════════════════════════════

function useDescriptive() {
    const [rawInput, setRawInput] = useState(SAMPLES['Exam Scores']);
    const [sample, setSample] = useState('Exam Scores');
    const [bins, setBins] = useState(8);
    const [showNormal, setShowNormal] = useState(false);
    const [view, setView] = useState<'histogram' | 'boxplot'>('histogram');
    const data = parseNumbers(rawInput);
    const stats = computeStats(data);
    return { rawInput, setRawInput, sample, setSample, bins, setBins, showNormal, setShowNormal, view, setView, data, stats };
}

function DescriptiveSidebar({ s }: { s: ReturnType<typeof useDescriptive> }) {
    const { rawInput, setRawInput, sample, setSample, bins, setBins, showNormal, setShowNormal, view, setView, stats } = s;
    return (
        <>
            <div style={sectionLabel}>Dataset</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {Object.keys(SAMPLES).map(k => (
                    <button key={k} onClick={() => { setSample(k); s.setRawInput(SAMPLES[k]); }} style={chipStyle(sample === k)}>{k}</button>
                ))}
            </div>

            <textarea value={rawInput} onChange={e => { setRawInput(e.target.value); setSample('Custom'); }}
                rows={3} placeholder="Paste numbers separated by spaces, commas, or newlines…"
                style={textareaStyle} />

            <div style={sectionLabel}>View</div>
            <div style={{ display: 'flex', gap: 4 }}>
                {(['histogram', 'boxplot'] as const).map(v => (
                    <button key={v} onClick={() => setView(v)} style={{ ...chipStyle(view === v), flex: 1, textTransform: 'capitalize' }}>{v}</button>
                ))}
            </div>

            {view === 'histogram' && (
                <>
                    <SliderRow label="Bins" value={bins} min={3} max={20} onChange={setBins} />
                    <label style={checkLabel}>
                        <input type="checkbox" checked={showNormal} onChange={e => setShowNormal(e.target.checked)} />
                        Normal overlay
                    </label>
                </>
            )}

            <div style={divider} />

            {stats ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {([
                        ['n', stats.n],
                        ['Mean (μ)', stats.mean.toFixed(3)],
                        ['Median', stats.median.toFixed(3)],
                        ['Mode', stats.mode !== null ? stats.mode : '—'],
                        ['Std Dev (σ)', stats.stdDev.toFixed(3)],
                        ['Variance (σ²)', stats.variance.toFixed(3)],
                        ['Min', stats.min],
                        ['Max', stats.max],
                        ['Q1', stats.q1],
                        ['Q3', stats.q3],
                        ['IQR', stats.iqr.toFixed(3)],
                        ['Skewness', stats.skewness.toFixed(3)],
                        ['Ex. Kurtosis', stats.kurtosis.toFixed(3)],
                        ['Sum', stats.sum.toFixed(2)],
                    ] as [string, string | number][]).map(([label, val]) => (
                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '3px 0', borderBottom: '1px solid var(--border-warm)' }}>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>{label}</span>
                            <span style={{ fontSize: '0.82rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-primary)' }}>{val}</span>
                        </div>
                    ))}
                </div>
            ) : (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>Enter at least 2 numbers.</div>
            )}
        </>
    );
}

function DescriptiveCanvas({ s, isDark }: { s: ReturnType<typeof useDescriptive>; isDark: boolean }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const { data, stats, bins, showNormal, view } = s;

    const draw = useCallback(() => {
        const canvas = canvasRef.current, container = containerRef.current;
        if (!canvas || !container || !stats) return;
        const s2 = setupCanvas(canvas, container);
        if (!s2) return;
        const { ctx, W, H } = s2;
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = bgC(isDark); ctx.fillRect(0, 0, W, H);

        if (view === 'histogram') {
            const pad = { top: 36, right: 28, bottom: 44, left: 56 };
            const cw = W - pad.left - pad.right, ch = H - pad.top - pad.bottom;
            const bw = (stats.max - stats.min) / bins || 1;
            const hist = new Array(bins).fill(0);
            for (const x of data) { let i = Math.min(Math.floor((x - stats.min) / bw), bins - 1); hist[i]++; }
            const maxC = Math.max(...hist, 1);
            const barW = cw / bins;

            // Grid
            ctx.strokeStyle = axisC(isDark) + '55'; ctx.lineWidth = 0.5;
            for (let i = 1; i <= 4; i++) {
                const y = pad.top + (1 - i / 4) * ch;
                ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + cw, y); ctx.stroke();
                ctx.font = '10px Sora,sans-serif'; ctx.fillStyle = textC(isDark); ctx.textAlign = 'right';
                ctx.fillText(String(Math.round(maxC * i / 4)), pad.left - 6, y + 4);
            }

            // Bars
            for (let i = 0; i < bins; i++) {
                const bh = (hist[i] / maxC) * ch;
                const bx = pad.left + i * barW, by = pad.top + ch - bh;
                const g = ctx.createLinearGradient(bx, by, bx, pad.top + ch);
                g.addColorStop(0, isDark ? '#d97706cc' : '#f59e0bcc');
                g.addColorStop(1, isDark ? '#92400e44' : '#fde68a44');
                ctx.fillStyle = g; ctx.fillRect(bx + 1, by, barW - 2, bh);
                ctx.strokeStyle = isDark ? '#b4530966' : '#d9770644'; ctx.lineWidth = 1;
                ctx.strokeRect(bx + 1, by, barW - 2, bh);
                if (hist[i] > 0) {
                    ctx.font = '10px Sora,sans-serif'; ctx.fillStyle = isDark ? '#fbbf24' : '#92400e';
                    ctx.textAlign = 'center'; ctx.fillText(String(hist[i]), bx + barW / 2, by - 5);
                }
            }

            // Axes
            drawAxes(ctx, pad, W, H, isDark);

            // X labels
            ctx.font = '10px Sora,sans-serif'; ctx.fillStyle = textC(isDark); ctx.textAlign = 'center';
            const step = Math.max(1, Math.floor(bins / 7));
            for (let i = 0; i <= bins; i += step) {
                const v = stats.min + i * bw;
                ctx.fillText(v.toFixed(1), pad.left + i * barW, pad.top + ch + 18);
            }

            const range = stats.max - stats.min || 1;

            // Mean line
            const mx = pad.left + ((stats.mean - stats.min) / range) * cw;
            ctx.strokeStyle = red; ctx.lineWidth = 2; ctx.setLineDash([5, 3]);
            ctx.beginPath(); ctx.moveTo(mx, pad.top); ctx.lineTo(mx, pad.top + ch); ctx.stroke();
            ctx.setLineDash([]);
            ctx.font = 'bold 10px Sora'; ctx.fillStyle = red; ctx.textAlign = 'center';
            ctx.fillText(`μ=${stats.mean.toFixed(1)}`, mx, pad.top - 8);

            // Median line
            const medx = pad.left + ((stats.median - stats.min) / range) * cw;
            ctx.strokeStyle = blue; ctx.lineWidth = 2; ctx.setLineDash([5, 3]);
            ctx.beginPath(); ctx.moveTo(medx, pad.top + 18); ctx.lineTo(medx, pad.top + ch); ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = blue; ctx.fillText(`med=${stats.median.toFixed(1)}`, medx, pad.top + 14);

            // Normal overlay
            if (showNormal && stats.stdDev > 0) {
                ctx.strokeStyle = green; ctx.lineWidth = 2.5;
                ctx.beginPath();
                for (let px = 0; px <= cw; px++) {
                    const x = stats.min + (px / cw) * range;
                    const pdf = normalPDF(x, stats.mean, stats.stdDev);
                    const sy = pad.top + ch - (pdf * data.length * bw / maxC) * ch;
                    px === 0 ? ctx.moveTo(pad.left + px, sy) : ctx.lineTo(pad.left + px, sy);
                }
                ctx.stroke();
            }

            // Legend
            ctx.font = '11px Sora'; ctx.textAlign = 'left';
            for (const [col, label, xOff] of [[red, '— Mean', 16], [blue, '— Median', 100], ...(showNormal ? [[green, '— Normal', 196]] : [])] as [string, string, number][]) {
                ctx.fillStyle = col; ctx.fillText(label, pad.left + xOff, H - 8);
            }

        } else {
            // Box plot
            const pad = { top: 60, right: 40, bottom: 60, left: 56 };
            const cw = W - pad.left - pad.right;
            const cy = H / 2;
            const bh = Math.min(H * 0.22, 40);
            const range = stats.max - stats.min || 1;
            const toX = (v: number) => pad.left + ((v - stats.min) / range) * cw;

            // Grid lines at key values
            for (const v of [stats.min, stats.q1, stats.median, stats.q3, stats.max]) {
                ctx.strokeStyle = axisC(isDark) + '66'; ctx.lineWidth = 0.5;
                ctx.setLineDash([3, 3]);
                ctx.beginPath(); ctx.moveTo(toX(v), pad.top); ctx.lineTo(toX(v), H - pad.bottom); ctx.stroke();
                ctx.setLineDash([]);
            }

            // Whiskers
            ctx.strokeStyle = textC(isDark); ctx.lineWidth = 2;
            for (const [a, b] of [[stats.min, stats.q1], [stats.q3, stats.max]] as [number, number][]) {
                ctx.beginPath(); ctx.moveTo(toX(a), cy); ctx.lineTo(toX(b), cy); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(toX(a), cy - bh / 2); ctx.lineTo(toX(a), cy + bh / 2); ctx.stroke();
            }

            // IQR box
            ctx.fillStyle = isDark ? '#d9770618' : '#f59e0b14';
            ctx.fillRect(toX(stats.q1), cy - bh / 2, toX(stats.q3) - toX(stats.q1), bh);
            ctx.strokeStyle = amber; ctx.lineWidth = 2.5;
            ctx.strokeRect(toX(stats.q1), cy - bh / 2, toX(stats.q3) - toX(stats.q1), bh);

            // Median
            ctx.strokeStyle = red; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(toX(stats.median), cy - bh / 2); ctx.lineTo(toX(stats.median), cy + bh / 2); ctx.stroke();

            // Outlier fences
            const fence = { lo: stats.q1 - 1.5 * stats.iqr, hi: stats.q3 + 1.5 * stats.iqr };
            ctx.fillStyle = red;
            for (const x of data) {
                if (x < fence.lo || x > fence.hi) {
                    ctx.beginPath(); ctx.arc(toX(x), cy, 5, 0, Math.PI * 2); ctx.fill();
                }
            }

            // Data points (jittered strip)
            const seed = 42;
            const rng = (i: number) => ((Math.sin(i * seed) * 43758.5453) % 1 + 1) % 1;
            ctx.fillStyle = isDark ? '#fbbf2488' : '#d9770666';
            for (let i = 0; i < data.length; i++) {
                const jitter = (rng(i) - 0.5) * bh * 0.7;
                ctx.beginPath(); ctx.arc(toX(data[i]), cy + jitter, 3, 0, Math.PI * 2); ctx.fill();
            }

            // Labels
            ctx.font = '11px Sora,sans-serif'; ctx.fillStyle = textC(isDark); ctx.textAlign = 'center';
            for (const [label, v] of [['Min', stats.min], ['Q1', stats.q1], ['Med', stats.median], ['Q3', stats.q3], ['Max', stats.max]] as [string, number][]) {
                const x = toX(v);
                ctx.fillStyle = label === 'Med' ? red : amber;
                ctx.fillText(label, x, cy - bh / 2 - 10);
                ctx.fillStyle = textC(isDark);
                ctx.fillText(v.toFixed(1), x, cy + bh / 2 + 18);
            }

            // Title
            ctx.font = 'bold 13px Sora'; ctx.fillStyle = textC(isDark); ctx.textAlign = 'center';
            ctx.fillText(`Box Plot  (n=${stats.n})`, W / 2, 24);
        }
    }, [data, stats, bins, showNormal, view, isDark]);

    useEffect(() => {
        draw();
        const ro = new ResizeObserver(draw);
        if (containerRef.current) ro.observe(containerRef.current);
        return () => ro.disconnect();
    }, [draw]);

    return (
        <div ref={containerRef} style={{ position: 'absolute', inset: 0 }}>
            {stats ? (
                <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
            ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: textC(true), fontSize: '0.9rem' }}>
                    Enter at least 2 numbers in the sidebar.
                </div>
            )}
        </div>
    );
}

// ════════════════════════════════════════════════════════════
// TAB — DISTRIBUTIONS
// ════════════════════════════════════════════════════════════

type Dist = 'normal' | 'binomial' | 'poisson' | 'exponential';

function useDistributions() {
    const [dist, setDist] = useState<Dist>('normal');
    const [mu, setMu] = useState(0);
    const [sigma, setSigma] = useState(1);
    const [nBinom, setNBinom] = useState(20);
    const [pBinom, setPBinom] = useState(0.5);
    const [lambda, setLambda] = useState(3);
    const [showCDF, setShowCDF] = useState(false);
    return { dist, setDist, mu, setMu, sigma, setSigma, nBinom, setNBinom, pBinom, setPBinom, lambda, setLambda, showCDF, setShowCDF };
}

function DistributionsSidebar({ s }: { s: ReturnType<typeof useDistributions> }) {
    const { dist, setDist, mu, setMu, sigma, setSigma, nBinom, setNBinom, pBinom, setPBinom, lambda, setLambda, showCDF, setShowCDF } = s;
    const statsRows: [string, string][] = dist === 'normal'
        ? [['Mean', mu.toFixed(2)], ['Std Dev', sigma.toFixed(2)], ['Variance', (sigma * sigma).toFixed(2)], ['Skewness', '0'], ['Kurtosis', '0']]
        : dist === 'binomial'
        ? [['Mean', (nBinom * pBinom).toFixed(2)], ['Variance', (nBinom * pBinom * (1 - pBinom)).toFixed(2)], ['Std Dev', Math.sqrt(nBinom * pBinom * (1 - pBinom)).toFixed(2)], ['n', String(nBinom)], ['p', pBinom.toFixed(2)]]
        : dist === 'poisson'
        ? [['Mean', lambda.toFixed(2)], ['Variance', lambda.toFixed(2)], ['Std Dev', Math.sqrt(lambda).toFixed(2)], ['P(X=0)', Math.exp(-lambda).toFixed(4)], ['λ', lambda.toFixed(2)]]
        : [['Mean', (1 / lambda).toFixed(3)], ['Variance', (1 / (lambda * lambda)).toFixed(3)], ['Std Dev', (1 / lambda).toFixed(3)], ['Median', (Math.log(2) / lambda).toFixed(3)], ['λ', lambda.toFixed(2)]];

    return (
        <>
            <div style={sectionLabel}>Distribution</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {(['normal', 'binomial', 'poisson', 'exponential'] as Dist[]).map(d => (
                    <button key={d} onClick={() => setDist(d)} style={{ ...chipStyle(dist === d), textAlign: 'left' }}>
                        {d.charAt(0).toUpperCase() + d.slice(1)}
                    </button>
                ))}
            </div>

            <div style={divider} />
            <div style={sectionLabel}>Parameters</div>

            {dist === 'normal' && (<>
                <SliderRow label="μ (mean)" value={mu} min={-5} max={5} step={0.1} onChange={setMu} fmt={v => v.toFixed(1)} />
                <SliderRow label="σ (std dev)" value={sigma} min={0.1} max={5} step={0.1} onChange={setSigma} fmt={v => v.toFixed(1)} />
            </>)}
            {dist === 'binomial' && (<>
                <SliderRow label="n (trials)" value={nBinom} min={2} max={50} step={1} onChange={setNBinom} />
                <SliderRow label="p (success)" value={pBinom} min={0.01} max={0.99} step={0.01} onChange={setPBinom} fmt={v => v.toFixed(2)} />
            </>)}
            {(dist === 'poisson' || dist === 'exponential') && (
                <SliderRow label="λ (rate)" value={lambda} min={0.2} max={10} step={0.1} onChange={setLambda} fmt={v => v.toFixed(1)} />
            )}

            <label style={checkLabel}>
                <input type="checkbox" checked={showCDF} onChange={e => setShowCDF(e.target.checked)} />
                Show CDF
            </label>

            <div style={divider} />
            <div style={sectionLabel}>Properties</div>
            {statsRows.map(([l, v]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid var(--border-warm)' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>{l}</span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-primary)' }}>{v}</span>
                </div>
            ))}
        </>
    );
}

function DistributionsCanvas({ s, isDark }: { s: ReturnType<typeof useDistributions>; isDark: boolean }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const { dist, mu, sigma, nBinom, pBinom, lambda, showCDF } = s;

    const draw = useCallback(() => {
        const canvas = canvasRef.current, container = containerRef.current;
        if (!canvas || !container) return;
        const s2 = setupCanvas(canvas, container);
        if (!s2) return;
        const { ctx, W, H } = s2;
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = bgC(isDark); ctx.fillRect(0, 0, W, H);

        const pad = { top: 36, right: 28, bottom: 44, left: 56 };
        const cw = W - pad.left - pad.right, ch = H - pad.top - pad.bottom;

        // Grid
        ctx.strokeStyle = axisC(isDark) + '55'; ctx.lineWidth = 0.5;
        for (let i = 1; i <= 4; i++) {
            const y = pad.top + (1 - i / 4) * ch;
            ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + cw, y); ctx.stroke();
        }
        drawAxes(ctx, pad, W, H, isDark);

        if (dist === 'normal') {
            const xMin = mu - 4.5 * sigma, xMax = mu + 4.5 * sigma;
            const peak = normalPDF(mu, mu, sigma);

            // Fill
            ctx.beginPath(); ctx.moveTo(pad.left, pad.top + ch);
            for (let px = 0; px <= cw; px++) {
                const x = xMin + (px / cw) * (xMax - xMin);
                const y = pad.top + ch - (normalPDF(x, mu, sigma) / peak) * ch;
                ctx.lineTo(pad.left + px, y);
            }
            ctx.lineTo(pad.left + cw, pad.top + ch); ctx.closePath();
            ctx.fillStyle = isDark ? '#d9770618' : '#f59e0b14'; ctx.fill();

            // PDF
            ctx.strokeStyle = amber; ctx.lineWidth = 2.5;
            ctx.beginPath();
            for (let px = 0; px <= cw; px++) {
                const x = xMin + (px / cw) * (xMax - xMin);
                const y = pad.top + ch - (normalPDF(x, mu, sigma) / peak) * ch;
                px === 0 ? ctx.moveTo(pad.left + px, y) : ctx.lineTo(pad.left + px, y);
            }
            ctx.stroke();

            // CDF
            if (showCDF) {
                ctx.strokeStyle = blue; ctx.lineWidth = 2; ctx.setLineDash([6, 3]);
                ctx.beginPath();
                for (let px = 0; px <= cw; px++) {
                    const x = xMin + (px / cw) * (xMax - xMin);
                    const y = pad.top + ch - normalCDF(x, mu, sigma) * ch;
                    px === 0 ? ctx.moveTo(pad.left + px, y) : ctx.lineTo(pad.left + px, y);
                }
                ctx.stroke(); ctx.setLineDash([]);
            }

            // Mean line
            const mxPx = pad.left + ((mu - xMin) / (xMax - xMin)) * cw;
            ctx.strokeStyle = red; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
            ctx.beginPath(); ctx.moveTo(mxPx, pad.top); ctx.lineTo(mxPx, pad.top + ch); ctx.stroke(); ctx.setLineDash([]);

            // X axis labels
            ctx.font = '11px Sora'; ctx.fillStyle = textC(isDark); ctx.textAlign = 'center';
            for (const [k, label] of [[-2, '-2σ'], [-1, '-σ'], [0, 'μ'], [1, 'σ'], [2, '2σ']] as [number, string][]) {
                const x = pad.left + ((mu + k * sigma - xMin) / (xMax - xMin)) * cw;
                ctx.fillText(label, x, pad.top + ch + 18);
            }

        } else if (dist === 'binomial') {
            const vals = Array.from({ length: nBinom + 1 }, (_, k) => binomPMF(k, nBinom, pBinom));
            const maxP = Math.max(...vals, 1e-9);
            const barW = cw / (nBinom + 1);
            const mean = nBinom * pBinom;

            for (let k = 0; k <= nBinom; k++) {
                const bh = (vals[k] / maxP) * ch;
                ctx.fillStyle = isDark ? '#d9770699' : '#f59e0b99';
                ctx.fillRect(pad.left + k * barW + 1, pad.top + ch - bh, barW - 2, bh);
            }
            if (showCDF) {
                let cum = 0;
                ctx.strokeStyle = blue; ctx.lineWidth = 2; ctx.setLineDash([5, 3]);
                ctx.beginPath();
                for (let k = 0; k <= nBinom; k++) {
                    cum += vals[k];
                    const x = pad.left + k * barW + barW / 2;
                    const y = pad.top + ch - cum * ch;
                    k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
                }
                ctx.stroke(); ctx.setLineDash([]);
            }
            // Mean line
            ctx.strokeStyle = red; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
            const mx = pad.left + mean * barW + barW / 2;
            ctx.beginPath(); ctx.moveTo(mx, pad.top); ctx.lineTo(mx, pad.top + ch); ctx.stroke(); ctx.setLineDash([]);

            ctx.font = '11px Sora'; ctx.fillStyle = textC(isDark); ctx.textAlign = 'center';
            for (let k = 0; k <= nBinom; k += Math.max(1, Math.floor(nBinom / 8))) {
                ctx.fillText(String(k), pad.left + k * barW + barW / 2, pad.top + ch + 18);
            }

        } else if (dist === 'poisson') {
            const kMax = Math.ceil(lambda + 5 * Math.sqrt(lambda)) + 2;
            const vals = Array.from({ length: kMax }, (_, k) => poissonPMF(k, lambda));
            const maxP = Math.max(...vals, 1e-9);
            const barW = cw / kMax;

            for (let k = 0; k < kMax; k++) {
                const bh = (vals[k] / maxP) * ch;
                ctx.fillStyle = isDark ? '#a855f799' : '#c084fc99';
                ctx.fillRect(pad.left + k * barW + 1, pad.top + ch - bh, barW - 2, bh);
            }
            ctx.strokeStyle = red; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
            const mx = pad.left + lambda * barW + barW / 2;
            ctx.beginPath(); ctx.moveTo(mx, pad.top); ctx.lineTo(mx, pad.top + ch); ctx.stroke(); ctx.setLineDash([]);

            ctx.font = '11px Sora'; ctx.fillStyle = textC(isDark); ctx.textAlign = 'center';
            for (let k = 0; k < kMax; k += Math.max(1, Math.floor(kMax / 8))) {
                ctx.fillText(String(k), pad.left + k * barW + barW / 2, pad.top + ch + 18);
            }

        } else {
            // Exponential
            const xMax = 5 / lambda;
            const peak = lambda;
            ctx.strokeStyle = green; ctx.lineWidth = 2.5;
            ctx.beginPath();
            for (let px = 0; px <= cw; px++) {
                const x = (px / cw) * xMax;
                const y = pad.top + ch - (exponentialPDF(x, lambda) / peak) * ch;
                px === 0 ? ctx.moveTo(pad.left + px, y) : ctx.lineTo(pad.left + px, y);
            }
            ctx.stroke();

            if (showCDF) {
                ctx.strokeStyle = blue; ctx.lineWidth = 2; ctx.setLineDash([5, 3]);
                ctx.beginPath();
                for (let px = 0; px <= cw; px++) {
                    const x = (px / cw) * xMax;
                    const y = pad.top + ch - (1 - Math.exp(-lambda * x)) * ch;
                    px === 0 ? ctx.moveTo(pad.left + px, y) : ctx.lineTo(pad.left + px, y);
                }
                ctx.stroke(); ctx.setLineDash([]);
            }

            ctx.font = '11px Sora'; ctx.fillStyle = textC(isDark); ctx.textAlign = 'center';
            for (let i = 0; i <= 5; i++) {
                ctx.fillText((i / 5 * xMax).toFixed(2), pad.left + (i / 5) * cw, pad.top + ch + 18);
            }
        }

        // Legend
        const legend: [string, string][] = [[amber, 'PDF']];
        if (showCDF) legend.push([blue, 'CDF']);
        legend.push([red, 'Mean']);
        ctx.font = '11px Sora'; ctx.textAlign = 'left';
        legend.forEach(([col, label], i) => {
            ctx.fillStyle = col;
            ctx.fillText(`— ${label}`, pad.left + i * 90, H - 10);
        });

    }, [dist, mu, sigma, nBinom, pBinom, lambda, showCDF, isDark]);

    useEffect(() => {
        draw();
        const ro = new ResizeObserver(draw);
        if (containerRef.current) ro.observe(containerRef.current);
        return () => ro.disconnect();
    }, [draw]);

    return (
        <div ref={containerRef} style={{ position: 'absolute', inset: 0 }}>
            <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
        </div>
    );
}

// ════════════════════════════════════════════════════════════
// TAB — HYPOTHESIS TESTING
// ════════════════════════════════════════════════════════════

function useHypothesis() {
    const [testType, setTestType] = useState<'one-sample' | 'two-sample'>('one-sample');
    const [raw1, setRaw1] = useState('82 85 91 88 79 93 87 84 90 86 94 81 88 92 85');
    const [raw2, setRaw2] = useState('65 78 82 71 69 75 80 73 77 68 83 72 79 70 76');
    const [mu0, setMu0] = useState('75');
    const [alpha, setAlpha] = useState(0.05);
    return { testType, setTestType, raw1, setRaw1, raw2, setRaw2, mu0, setMu0, alpha, setAlpha };
}

interface HResult {
    t: number; df: number; pVal: number; reject: boolean; se: number;
    mean1: number; n1: number; mean2?: number; n2?: number;
}

function computeHypothesis(s: ReturnType<typeof useHypothesis>): HResult | null {
    const { testType, raw1, raw2, mu0, alpha } = s;
    const d1 = parseNumbers(raw1); const st1 = computeStats(d1);
    if (!st1) return null;
    if (testType === 'one-sample') {
        const h = parseFloat(mu0); if (isNaN(h)) return null;
        const se = st1.stdDev / Math.sqrt(st1.n);
        const t = (st1.mean - h) / se;
        const pVal = tTestPValue(Math.abs(t), st1.n - 1);
        return { t, df: st1.n - 1, pVal, reject: pVal < alpha, se, mean1: st1.mean, n1: st1.n };
    } else {
        const d2 = parseNumbers(raw2); const st2 = computeStats(d2);
        if (!st2) return null;
        const se = Math.sqrt(st1.variance / st1.n + st2.variance / st2.n);
        const t = (st1.mean - st2.mean) / se;
        const df = Math.floor((st1.variance / st1.n + st2.variance / st2.n) ** 2 /
            ((st1.variance / st1.n) ** 2 / (st1.n - 1) + (st2.variance / st2.n) ** 2 / (st2.n - 1)));
        const pVal = tTestPValue(Math.abs(t), df);
        return { t, df, pVal, reject: pVal < alpha, se, mean1: st1.mean, n1: st1.n, mean2: st2.mean, n2: st2.n };
    }
}

function HypothesisSidebar({ s }: { s: ReturnType<typeof useHypothesis> }) {
    const { testType, setTestType, raw1, setRaw1, raw2, setRaw2, mu0, setMu0, alpha, setAlpha } = s;
    const result = computeHypothesis(s);

    return (
        <>
            <div style={sectionLabel}>Test Type</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {([['one-sample', 'One-Sample t-test'], ['two-sample', 'Two-Sample t-test']] as const).map(([v, label]) => (
                    <button key={v} onClick={() => setTestType(v)} style={{ ...chipStyle(testType === v), textAlign: 'left' }}>{label}</button>
                ))}
            </div>

            <div style={divider} />
            <div style={sectionLabel}>{testType === 'two-sample' ? 'Sample 1' : 'Sample Data'}</div>
            <textarea value={raw1} onChange={e => setRaw1(e.target.value)} rows={2} placeholder="Space or comma separated…" style={textareaStyle} />

            {testType === 'two-sample' && (<>
                <div style={sectionLabel}>Sample 2</div>
                <textarea value={raw2} onChange={e => setRaw2(e.target.value)} rows={2} placeholder="Space or comma separated…" style={textareaStyle} />
            </>)}

            {testType === 'one-sample' && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>H₀: μ =</span>
                    <input type="number" value={mu0} onChange={e => setMu0(e.target.value)}
                        style={{ flex: 1, padding: '5px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-warm)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.85rem' }} />
                </div>
            )}

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>α =</span>
                <select value={alpha} onChange={e => setAlpha(+e.target.value)}
                    style={{ flex: 1, padding: '5px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-warm)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                    {[0.01, 0.05, 0.1].map(a => <option key={a} value={a}>{a}</option>)}
                </select>
            </div>

            <div style={divider} />

            {result ? (
                <>
                    <div style={{
                        padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                        background: result.reject ? '#ef444418' : '#22c55e18',
                        border: `1.5px solid ${result.reject ? red : green}`,
                    }}>
                        <div style={{ fontWeight: 700, color: result.reject ? red : green, fontSize: '0.85rem' }}>
                            {result.reject ? '✗ Reject H₀' : '✓ Fail to Reject H₀'}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: 3 }}>
                            p = {result.pVal.toFixed(5)} {result.reject ? '<' : '≥'} α = {alpha}
                        </div>
                    </div>

                    {([
                        ['t-statistic', result.t.toFixed(4)],
                        ['Degrees of freedom', result.df.toFixed(1)],
                        ['p-value', result.pVal.toFixed(5)],
                        ['Standard error', result.se.toFixed(4)],
                        ['x̄₁', result.mean1.toFixed(3)],
                        ['n₁', result.n1],
                        ...(result.mean2 !== undefined ? [['x̄₂', result.mean2.toFixed(3)], ['n₂', result.n2!]] : []),
                    ] as [string, string | number][]).map(([l, v]) => (
                        <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid var(--border-warm)' }}>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>{l}</span>
                            <span style={{ fontSize: '0.82rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-primary)' }}>{v}</span>
                        </div>
                    ))}
                </>
            ) : (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>Enter at least 2 numbers per sample.</div>
            )}
        </>
    );
}

function HypothesisCanvas({ s, isDark }: { s: ReturnType<typeof useHypothesis>; isDark: boolean }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const result = computeHypothesis(s);

    const draw = useCallback(() => {
        const canvas = canvasRef.current, container = containerRef.current;
        if (!canvas || !container) return;
        const s2 = setupCanvas(canvas, container);
        if (!s2) return;
        const { ctx, W, H } = s2;
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = bgC(isDark); ctx.fillRect(0, 0, W, H);

        const pad = { top: 48, right: 36, bottom: 56, left: 56 };
        const cw = W - pad.left - pad.right, ch = H - pad.top - pad.bottom;

        const df = result ? result.df : 10;
        const xRange = 5;
        const peak = tPDF(0, df);

        const toX = (v: number) => pad.left + ((v + xRange) / (2 * xRange)) * cw;
        const toY = (p: number) => pad.top + ch - Math.max(0, Math.min(1, p / peak)) * ch;

        // Grid
        ctx.strokeStyle = axisC(isDark) + '44'; ctx.lineWidth = 0.5;
        for (let i = 1; i <= 4; i++) {
            const y = pad.top + (1 - i / 4) * ch;
            ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + cw, y); ctx.stroke();
        }

        // Critical region shading (two-tailed)
        const critT = result ? (result.reject ? Math.abs(result.t) : 3.5) : 1.96;

        // Left tail
        ctx.beginPath(); ctx.moveTo(pad.left, pad.top + ch);
        for (let px = 0; px <= cw; px++) {
            const x = -xRange + (px / cw) * 2 * xRange;
            if (x <= -critT) { ctx.lineTo(pad.left + px, toY(tPDF(x, df))); }
            else { ctx.lineTo(toX(-critT), toY(tPDF(-critT, df))); break; }
        }
        ctx.lineTo(toX(-critT), pad.top + ch); ctx.closePath();
        ctx.fillStyle = red + '44'; ctx.fill();

        // Right tail
        ctx.beginPath(); ctx.moveTo(toX(critT), toY(tPDF(critT, df)));
        for (let px = 0; px <= cw; px++) {
            const x = -xRange + (px / cw) * 2 * xRange;
            if (x >= critT) ctx.lineTo(pad.left + px, toY(tPDF(x, df)));
        }
        ctx.lineTo(pad.left + cw, pad.top + ch); ctx.lineTo(toX(critT), pad.top + ch); ctx.closePath();
        ctx.fillStyle = red + '44'; ctx.fill();

        // t-distribution curve
        ctx.strokeStyle = isDark ? '#fbbf24' : amber; ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let px = 0; px <= cw; px++) {
            const x = -xRange + (px / cw) * 2 * xRange;
            const y = toY(tPDF(x, df));
            px === 0 ? ctx.moveTo(pad.left + px, y) : ctx.lineTo(pad.left + px, y);
        }
        ctx.stroke();

        // t-statistic line
        if (result) {
            const tClamped = Math.max(-xRange + 0.1, Math.min(xRange - 0.1, result.t));
            ctx.strokeStyle = result.reject ? red : green; ctx.lineWidth = 2.5; ctx.setLineDash([6, 3]);
            ctx.beginPath(); ctx.moveTo(toX(tClamped), pad.top); ctx.lineTo(toX(tClamped), pad.top + ch); ctx.stroke();
            ctx.setLineDash([]);
            ctx.font = 'bold 11px Sora'; ctx.fillStyle = result.reject ? red : green;
            ctx.textAlign = result.t > 0 ? 'right' : 'left';
            ctx.fillText(`t = ${result.t.toFixed(3)}`, toX(tClamped) + (result.t > 0 ? -6 : 6), pad.top + 20);
        }

        // Critical region lines
        for (const cv of [-critT, critT]) {
            ctx.strokeStyle = red + 'aa'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
            ctx.beginPath(); ctx.moveTo(toX(cv), pad.top); ctx.lineTo(toX(cv), pad.top + ch); ctx.stroke();
            ctx.setLineDash([]);
        }

        // Axis
        drawAxes(ctx, pad, W, H, isDark);

        // X labels
        ctx.font = '11px Sora'; ctx.fillStyle = textC(isDark); ctx.textAlign = 'center';
        for (const v of [-4, -3, -2, -1, 0, 1, 2, 3, 4]) {
            if (v >= -xRange && v <= xRange) ctx.fillText(String(v), toX(v), pad.top + ch + 18);
        }

        // Title
        ctx.font = 'bold 13px Sora'; ctx.fillStyle = textC(isDark); ctx.textAlign = 'center';
        ctx.fillText(`t-distribution  (df = ${df.toFixed(1)})`, W / 2, 24);

        // p-value label
        if (result) {
            ctx.font = '12px Sora'; ctx.fillStyle = result.reject ? red : green; ctx.textAlign = 'center';
            ctx.fillText(`p-value = ${result.pVal.toFixed(5)}  (two-tailed)`, W / 2, pad.top + ch + 42);
        }

        // Shaded region label
        ctx.font = '10px Sora'; ctx.fillStyle = red; ctx.textAlign = 'center';
        ctx.fillText('rejection region', toX(-critT - 0.8), pad.top + 14);
        ctx.fillText('rejection region', toX(critT + 0.8), pad.top + 14);

    }, [result, isDark]);

    useEffect(() => {
        draw();
        const ro = new ResizeObserver(draw);
        if (containerRef.current) ro.observe(containerRef.current);
        return () => ro.disconnect();
    }, [draw]);

    return (
        <div ref={containerRef} style={{ position: 'absolute', inset: 0 }}>
            <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
        </div>
    );
}

// ════════════════════════════════════════════════════════════
// TAB — REGRESSION
// ════════════════════════════════════════════════════════════

function useRegression() {
    const [rawX, setRawX] = useState('1 2 3 4 5 6 7 8 9 10');
    const [rawY, setRawY] = useState('2.1 3.8 5.2 6.9 8.4 10.1 11.7 13.2 15.0 16.8');
    const [showResiduals, setShowResiduals] = useState(false);
    return { rawX, setRawX, rawY, setRawY, showResiduals, setShowResiduals };
}

interface RegResult { slope: number; intercept: number; r: number; r2: number; se: number; predicted: number[]; n: number; xs: number[]; ys: number[] }

function computeRegression(s: ReturnType<typeof useRegression>): RegResult | null {
    const xs0 = parseNumbers(s.rawX), ys0 = parseNumbers(s.rawY);
    const n = Math.min(xs0.length, ys0.length);
    if (n < 2) return null;
    const xs = xs0.slice(0, n), ys = ys0.slice(0, n);
    const mx = xs.reduce((a, b) => a + b, 0) / n;
    const my = ys.reduce((a, b) => a + b, 0) / n;
    const ssxx = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
    const ssxy = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
    const ssyy = ys.reduce((s, y) => s + (y - my) ** 2, 0);
    const slope = ssxy / (ssxx || 1);
    const intercept = my - slope * mx;
    const r = ssxy / Math.sqrt(ssxx * ssyy || 1);
    const predicted = xs.map(x => slope * x + intercept);
    const sse = ys.reduce((s, y, i) => s + (y - predicted[i]) ** 2, 0);
    return { slope, intercept, r, r2: r * r, se: Math.sqrt(sse / (n - 2 || 1)), predicted, n, xs, ys };
}

function RegressionSidebar({ s }: { s: ReturnType<typeof useRegression> }) {
    const { rawX, setRawX, rawY, setRawY, showResiduals, setShowResiduals } = s;
    const model = computeRegression(s);

    return (
        <>
            <div style={sectionLabel}>X values</div>
            <textarea value={rawX} onChange={e => setRawX(e.target.value)} rows={2} placeholder="X values…" style={textareaStyle} />
            <div style={sectionLabel}>Y values</div>
            <textarea value={rawY} onChange={e => setRawY(e.target.value)} rows={2} placeholder="Y values…" style={textareaStyle} />

            {model && rawX.split(/[\s,;]+/).filter(Boolean).length !== rawY.split(/[\s,;]+/).filter(Boolean).length && (
                <div style={{ fontSize: '0.72rem', color: amber }}>⚠ Using first {model.n} pairs</div>
            )}

            <label style={checkLabel}>
                <input type="checkbox" checked={showResiduals} onChange={e => setShowResiduals(e.target.checked)} />
                Show residuals
            </label>

            <div style={divider} />

            {model ? (
                <>
                    <div style={{ padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-warm)', fontSize: '0.85rem', fontFamily: 'monospace', color: amber, fontWeight: 700 }}>
                        ŷ = {model.slope.toFixed(4)}x {model.intercept >= 0 ? '+' : '−'} {Math.abs(model.intercept).toFixed(4)}
                    </div>

                    {([
                        ['Slope (β₁)', model.slope.toFixed(5)],
                        ['Intercept (β₀)', model.intercept.toFixed(5)],
                        ['Pearson r', model.r.toFixed(5)],
                        ['R² (fit)', model.r2.toFixed(5)],
                        ['Std Error', model.se.toFixed(4)],
                        ['n', model.n],
                    ] as [string, string | number][]).map(([l, v]) => (
                        <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid var(--border-warm)' }}>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>{l}</span>
                            <span style={{ fontSize: '0.82rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-primary)' }}>{v}</span>
                        </div>
                    ))}

                    <div style={{ padding: '8px 10px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 4 }}>
                        {Math.abs(model.r) > 0.9 ? '🔴 Very strong' : Math.abs(model.r) > 0.7 ? '🟠 Strong' : Math.abs(model.r) > 0.4 ? '🟡 Moderate' : '⚪ Weak'} {model.r > 0 ? 'positive' : 'negative'} correlation
                    </div>
                </>
            ) : (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>Enter at least 2 (x, y) pairs.</div>
            )}
        </>
    );
}

function RegressionCanvas({ s, isDark }: { s: ReturnType<typeof useRegression>; isDark: boolean }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const model = computeRegression(s);

    const draw = useCallback(() => {
        const canvas = canvasRef.current, container = containerRef.current;
        if (!canvas || !container || !model) return;
        const s2 = setupCanvas(canvas, container);
        if (!s2) return;
        const { ctx, W, H } = s2;
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = bgC(isDark); ctx.fillRect(0, 0, W, H);

        const pad = { top: 36, right: 36, bottom: 48, left: 60 };
        const cw = W - pad.left - pad.right, ch = H - pad.top - pad.bottom;
        const { xs, ys } = model;

        const xMin = Math.min(...xs), xMax = Math.max(...xs);
        const yMin = Math.min(...ys), yMax = Math.max(...ys);
        const xRange = xMax - xMin || 1, yRange = yMax - yMin || 1;
        const margin = 0.15;
        const toX = (v: number) => pad.left + ((v - xMin) / xRange * (1 - 2 * margin) + margin) * cw;
        const toY = (v: number) => pad.top + ch - ((v - yMin) / yRange * (1 - 2 * margin) + margin) * ch;

        // Grid
        ctx.strokeStyle = axisC(isDark) + '55'; ctx.lineWidth = 0.5;
        for (let i = 1; i <= 5; i++) {
            const y = pad.top + (i / 5) * ch;
            ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + cw, y); ctx.stroke();
        }

        // Regression line
        const rXMin = xMin - xRange * margin * 1.2;
        const rXMax = xMax + xRange * margin * 1.2;
        ctx.strokeStyle = amber; ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(toX(rXMin), toY(model.slope * rXMin + model.intercept));
        ctx.lineTo(toX(rXMax), toY(model.slope * rXMax + model.intercept));
        ctx.stroke();

        // Residuals
        if (s.showResiduals) {
            ctx.strokeStyle = red + 'aa'; ctx.lineWidth = 1.2;
            for (let i = 0; i < model.n; i++) {
                ctx.beginPath(); ctx.moveTo(toX(xs[i]), toY(ys[i]));
                ctx.lineTo(toX(xs[i]), toY(model.predicted[i])); ctx.stroke();
            }
        }

        // Points
        for (let i = 0; i < model.n; i++) {
            ctx.beginPath(); ctx.arc(toX(xs[i]), toY(ys[i]), 5.5, 0, Math.PI * 2);
            ctx.fillStyle = isDark ? '#fbbf24' : amber; ctx.fill();
            ctx.strokeStyle = isDark ? '#1a1612' : '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
        }

        drawAxes(ctx, pad, W, H, isDark);

        // X labels
        ctx.font = '11px Sora'; ctx.fillStyle = textC(isDark); ctx.textAlign = 'center';
        for (let i = 0; i <= 5; i++) {
            const v = xMin + (i / 5) * xRange;
            ctx.fillText(v.toFixed(1), pad.left + (i / 5) * cw, pad.top + ch + 18);
        }

        // Y labels
        ctx.textAlign = 'right';
        for (let i = 0; i <= 4; i++) {
            const v = yMin + (i / 4) * yRange;
            ctx.fillText(v.toFixed(1), pad.left - 8, pad.top + ch - (i / 4) * ch + 4);
        }

        // Equation label on canvas
        const eq = `ŷ = ${model.slope.toFixed(3)}x ${model.intercept >= 0 ? '+' : '−'} ${Math.abs(model.intercept).toFixed(3)}   R² = ${model.r2.toFixed(3)}`;
        ctx.font = 'bold 11px Sora'; ctx.fillStyle = amber; ctx.textAlign = 'left';
        ctx.fillText(eq, pad.left + 10, pad.top - 10);

    }, [model, s.showResiduals, isDark]);

    useEffect(() => {
        draw();
        const ro = new ResizeObserver(draw);
        if (containerRef.current) ro.observe(containerRef.current);
        return () => ro.disconnect();
    }, [draw]);

    return (
        <div ref={containerRef} style={{ position: 'absolute', inset: 0 }}>
            {model ? (
                <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
            ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: textC(true), fontSize: '0.9rem' }}>
                    Enter X and Y data in the sidebar.
                </div>
            )}
        </div>
    );
}

// ════════════════════════════════════════════════════════════
// SHARED SMALL COMPONENTS & STYLES
// ════════════════════════════════════════════════════════════

function SliderRow({ label, value, min, max, step = 1, onChange, fmt }: {
    label: string; value: number; min: number; max: number; step?: number;
    onChange: (v: number) => void; fmt?: (v: number) => string;
}) {
    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 600 }}>{label}</span>
                <span style={{ fontSize: '0.78rem', fontFamily: 'monospace', color: 'var(--text-primary)', fontWeight: 700 }}>
                    {fmt ? fmt(value) : value}
                </span>
            </div>
            <input type="range" min={min} max={max} step={step} value={value}
                onChange={e => onChange(+e.target.value)}
                style={{ width: '100%', accentColor: 'var(--amber)' }} />
        </div>
    );
}

const chipStyle = (active: boolean): React.CSSProperties => ({
    padding: '5px 12px', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', fontWeight: 600,
    cursor: 'pointer', background: active ? 'var(--amber)' : 'transparent',
    color: active ? '#fff' : 'var(--text-dim)',
    border: `1px solid ${active ? 'var(--amber)' : 'var(--border-warm)'}`,
    transition: 'all 0.12s',
});

const sectionLabel: React.CSSProperties = {
    fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '1.2px', color: 'var(--text-dim)',
};

const divider: React.CSSProperties = {
    borderTop: '1px solid var(--border-warm)',
};

const textareaStyle: React.CSSProperties = {
    width: '100%', padding: '7px 10px', borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-warm)', background: 'var(--bg-secondary)',
    color: 'var(--text-primary)', fontSize: '0.88rem', fontFamily: 'monospace',
    resize: 'vertical', boxSizing: 'border-box',
};

const checkLabel: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 6,
    fontSize: '0.78rem', color: 'var(--text-dim)', cursor: 'pointer',
};

// ════════════════════════════════════════════════════════════
// ROOT COMPONENT
// ════════════════════════════════════════════════════════════

type Tab = 'descriptive' | 'distributions' | 'hypothesis' | 'regression';

export default function StatisticsLab() {
    const [tab, setTab] = useState<Tab>('descriptive');
    const { resolved } = useTheme();
    const isDark = resolved === 'dark';

    const desc = useDescriptive();
    const dist = useDistributions();
    const hyp = useHypothesis();
    const reg = useRegression();

    const tabBar = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {([
                ['descriptive', 'Descriptive'],
                ['distributions', 'Distributions'],
                ['hypothesis', 'Hypothesis'],
                ['regression', 'Regression'],
            ] as [Tab, string][]).map(([key, label]) => (
                <button key={key} onClick={() => setTab(key)}
                    style={{
                        padding: '8px 12px', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem',
                        fontWeight: 600, cursor: 'pointer', border: 'none', textAlign: 'left',
                        background: tab === key ? 'var(--amber)' : 'transparent',
                        color: tab === key ? '#fff' : 'var(--text-dim)',
                        transition: 'all 0.12s',
                    }}>
                    {label}
                </button>
            ))}
        </div>
    );

    const sidebar = (
        <>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--text-dim)' }}>
                Statistics Lab
            </div>
            {tabBar}
            <div style={{ borderTop: '1px solid var(--border-warm)' }} />
            {tab === 'descriptive' && <DescriptiveSidebar s={desc} />}
            {tab === 'distributions' && <DistributionsSidebar s={dist} />}
            {tab === 'hypothesis' && <HypothesisSidebar s={hyp} />}
            {tab === 'regression' && <RegressionSidebar s={reg} />}
        </>
    );

    const canvas = (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            {tab === 'descriptive' && <DescriptiveCanvas s={desc} isDark={isDark} />}
            {tab === 'distributions' && <DistributionsCanvas s={dist} isDark={isDark} />}
            {tab === 'hypothesis' && <HypothesisCanvas s={hyp} isDark={isDark} />}
            {tab === 'regression' && <RegressionCanvas s={reg} isDark={isDark} />}
        </div>
    );

    return (
        <ToolLayoutSplit sidebarWidth={300}>
            {[sidebar, canvas]}
        </ToolLayoutSplit>
    );
}
