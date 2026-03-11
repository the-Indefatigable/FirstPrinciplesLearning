import { useRef, useEffect, useState, useCallback } from 'react';

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

// Regularized incomplete beta function via continued fraction (for t-dist p-value)
function betaCF(a: number, b: number, x: number): number {
    const MAXIT = 200, EPS = 3e-7;
    let qab = a + b, qap = a + 1, qam = a - 1;
    let c = 1, d = 1 - qab * x / qap;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= MAXIT; m++) {
        const m2 = 2 * m;
        let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
        d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30;
        c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30;
        d = 1 / d; h *= d * c;
        aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
        d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30;
        c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30;
        d = 1 / d;
        const del = d * c;
        h *= del;
        if (Math.abs(del - 1) < EPS) break;
    }
    return h;
}

function incompleteBeta(a: number, b: number, x: number): number {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const lbeta = lgamma(a) + lgamma(b) - lgamma(a + b);
    const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lbeta) / a;
    if (x < (a + 1) / (a + b + 2)) return front * betaCF(a, b, x);
    return 1 - (Math.exp(Math.log(1 - x) * b + Math.log(x) * a - lbeta) / b) * betaCF(b, a, 1 - x);
}

function lgamma(x: number): number {
    const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    let y = x, tmp = x + 5.5;
    tmp -= (x + 0.5) * Math.log(tmp);
    let ser = 1.000000000190015;
    for (const ci of c) ser += ci / ++y;
    return -tmp + Math.log(2.5066282746310005 * ser / x);
}

function tTestPValue(t: number, df: number): number {
    const x = df / (df + t * t);
    return incompleteBeta(df / 2, 0.5, x);
}

// ── Descriptive stats ────────────────────────────────────────────────────────

interface Stats {
    n: number; mean: number; median: number; mode: number | null;
    stdDev: number; variance: number; min: number; max: number;
    q1: number; q3: number; iqr: number; sum: number;
    skewness: number; kurtosis: number;
}

function computeStats(data: number[]): Stats | null {
    if (data.length === 0) return null;
    const sorted = [...data].sort((a, b) => a - b);
    const n = data.length;
    const sum = data.reduce((a, b) => a + b, 0);
    const mean = sum / n;
    const variance = data.reduce((s, x) => s + (x - mean) ** 2, 0) / (n > 1 ? n - 1 : 1);
    const stdDev = Math.sqrt(variance);
    const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];
    const q1 = sorted[Math.floor(n * 0.25)];
    const q3 = sorted[Math.floor(n * 0.75)];

    const freq: Record<number, number> = {};
    let maxF = 0;
    for (const x of data) { freq[x] = (freq[x] || 0) + 1; if (freq[x] > maxF) maxF = freq[x]; }
    const modes = Object.entries(freq).filter(([, f]) => f === maxF).map(([v]) => Number(v));
    const mode = maxF > 1 ? modes[0] : null;

    const m3 = data.reduce((s, x) => s + ((x - mean) / (stdDev || 1)) ** 3, 0) / n;
    const m4 = data.reduce((s, x) => s + ((x - mean) / (stdDev || 1)) ** 4, 0) / n;

    return { n, mean, median, mode, stdDev, variance, min: sorted[0], max: sorted[n - 1], q1, q3, iqr: q3 - q1, sum, skewness: m3, kurtosis: m4 - 3 };
}

function parseNumbers(raw: string): number[] {
    return raw.split(/[\s,;\t\n]+/).map(Number).filter(v => !isNaN(v) && v !== null && raw.trim() !== '');
}

// ── Sample datasets ──────────────────────────────────────────────────────────

const SAMPLES: Record<string, string> = {
    'Exam Scores': '72 85 90 68 74 88 95 82 79 91 76 84 93 70 87 81 77 89 73 86 92 78 83 75 80',
    'Heights (cm)': '155 162 170 165 178 172 168 160 175 183 158 169 177 164 173 180 167 171 166 174',
    'Reaction (ms)': '312 298 345 287 401 322 310 389 276 354 331 299 418 305 342 268 376 319 291 360',
    'Custom': '',
};

// ── Canvas helpers ───────────────────────────────────────────────────────────

function setupCanvas(canvas: HTMLCanvasElement): { ctx: CanvasRenderingContext2D; W: number; H: number; isDark: boolean } | null {
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const rect = canvas.parentElement?.getBoundingClientRect();
    if (!rect) return null;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return { ctx, W: rect.width, H: rect.height, isDark };
}

// ── Colours ──────────────────────────────────────────────────────────────────

const C = {
    amber: '#d97706', amberLight: '#fbbf24', amberFill: '#f59e0b22',
    blue: '#3b82f6', red: '#ef4444', green: '#22c55e', purple: '#a855f7',
    axis: (d: boolean) => d ? '#4a4540' : '#d4cec6',
    text: (d: boolean) => d ? '#9c9488' : '#6b6560',
    bar: (d: boolean) => d ? '#d9770699' : '#f59e0b99',
    bg: (d: boolean) => d ? '#1a1612' : '#faf8f5',
};

// ── Tab: Descriptive ─────────────────────────────────────────────────────────

function DescriptiveTab() {
    const histRef = useRef<HTMLCanvasElement>(null);
    const boxRef = useRef<HTMLCanvasElement>(null);
    const [rawInput, setRawInput] = useState(SAMPLES['Exam Scores']);
    const [sample, setSample] = useState('Exam Scores');
    const [bins, setBins] = useState(8);
    const [showNormal, setShowNormal] = useState(false);
    const data = parseNumbers(rawInput);
    const stats = computeStats(data);

    // Draw histogram
    useEffect(() => {
        const canvas = histRef.current;
        if (!canvas || !stats || data.length < 2) return;
        const s = setupCanvas(canvas);
        if (!s) return;
        const { ctx, W, H, isDark } = s;
        const pad = { top: 28, right: 16, bottom: 36, left: 44 };
        const cw = W - pad.left - pad.right, ch = H - pad.top - pad.bottom;

        ctx.clearRect(0, 0, W, H);

        const bw = (stats.max - stats.min) / bins || 1;
        const hist = new Array(bins).fill(0);
        for (const x of data) { let i = Math.min(Math.floor((x - stats.min) / bw), bins - 1); hist[i]++; }
        const maxC = Math.max(...hist, 1);

        // Bars
        for (let i = 0; i < bins; i++) {
            const bh = (hist[i] / maxC) * ch;
            const bx = pad.left + i * (cw / bins);
            const by = pad.top + ch - bh;
            const bW = cw / bins - 1;
            const g = ctx.createLinearGradient(bx, by, bx, pad.top + ch);
            g.addColorStop(0, isDark ? '#d97706cc' : '#f59e0bcc');
            g.addColorStop(1, isDark ? '#92400e44' : '#fde68a44');
            ctx.fillStyle = g;
            ctx.fillRect(bx, by, bW, bh);
            ctx.strokeStyle = isDark ? '#b4530966' : '#d9770644';
            ctx.lineWidth = 1;
            ctx.strokeRect(bx, by, bW, bh);
            if (hist[i] > 0) {
                ctx.font = '9px Sora,sans-serif';
                ctx.fillStyle = isDark ? '#fbbf24' : '#92400e';
                ctx.textAlign = 'center';
                ctx.fillText(String(hist[i]), bx + bW / 2, by - 4);
            }
        }

        // Axes
        ctx.strokeStyle = C.axis(isDark); ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pad.left, pad.top); ctx.lineTo(pad.left, pad.top + ch);
        ctx.lineTo(pad.left + cw, pad.top + ch); ctx.stroke();

        // X labels
        ctx.font = '9px Sora,sans-serif'; ctx.fillStyle = C.text(isDark); ctx.textAlign = 'center';
        for (let i = 0; i <= bins; i += Math.max(1, Math.floor(bins / 6))) {
            const v = stats.min + i * bw;
            ctx.fillText(v.toFixed(1), pad.left + i * (cw / bins), pad.top + ch + 16);
        }

        // Y labels
        ctx.textAlign = 'right';
        for (let i = 0; i <= 4; i++) {
            const v = Math.round((maxC * i) / 4);
            const y = pad.top + ch - (i / 4) * ch;
            ctx.fillText(String(v), pad.left - 5, y + 3);
            ctx.strokeStyle = C.axis(isDark) + '55'; ctx.lineWidth = 0.5;
            ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + cw, y); ctx.stroke();
        }

        const range = stats.max - stats.min || 1;

        // Mean line
        const mx = pad.left + ((stats.mean - stats.min) / range) * cw;
        ctx.strokeStyle = C.red; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.moveTo(mx, pad.top); ctx.lineTo(mx, pad.top + ch); ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = 'bold 9px Sora'; ctx.fillStyle = C.red; ctx.textAlign = 'center';
        ctx.fillText(`μ=${stats.mean.toFixed(1)}`, mx, pad.top - 4);

        // Median line
        const medx = pad.left + ((stats.median - stats.min) / range) * cw;
        ctx.strokeStyle = C.blue; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.moveTo(medx, pad.top + 12); ctx.lineTo(medx, pad.top + ch); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = C.blue;
        ctx.fillText(`Med=${stats.median.toFixed(1)}`, medx, pad.top + 10);

        // Normal overlay
        if (showNormal && stats.stdDev > 0) {
            ctx.strokeStyle = C.green; ctx.lineWidth = 2;
            ctx.beginPath();
            for (let px = 0; px <= cw; px++) {
                const x = stats.min + (px / cw) * range;
                const pdf = normalPDF(x, stats.mean, stats.stdDev);
                const sy = pad.top + ch - (pdf * data.length * bw / maxC) * ch;
                px === 0 ? ctx.moveTo(pad.left + px, sy) : ctx.lineTo(pad.left + px, sy);
            }
            ctx.stroke();
        }
    }, [data, stats, bins, showNormal]);

    // Draw box plot
    useEffect(() => {
        const canvas = boxRef.current;
        if (!canvas || !stats || data.length < 4) return;
        const s = setupCanvas(canvas);
        if (!s) return;
        const { ctx, W, H, isDark } = s;
        ctx.clearRect(0, 0, W, H);

        const pad = { top: 16, right: 24, bottom: 24, left: 44 };
        const cw = W - pad.left - pad.right;
        const cy = H / 2;
        const bh = Math.min(H * 0.28, 28);

        const range = stats.max - stats.min || 1;
        const toX = (v: number) => pad.left + ((v - stats.min) / range) * cw;

        // Whiskers
        ctx.strokeStyle = isDark ? '#9c9488' : '#6b6560'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(toX(stats.min), cy); ctx.lineTo(toX(stats.q1), cy); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(toX(stats.q3), cy); ctx.lineTo(toX(stats.max), cy); ctx.stroke();
        // Whisker caps
        for (const v of [stats.min, stats.max]) {
            ctx.beginPath(); ctx.moveTo(toX(v), cy - bh / 2); ctx.lineTo(toX(v), cy + bh / 2); ctx.stroke();
        }

        // IQR box
        ctx.fillStyle = isDark ? '#d9770622' : '#f59e0b18';
        ctx.strokeStyle = C.amber; ctx.lineWidth = 2;
        ctx.fillRect(toX(stats.q1), cy - bh / 2, toX(stats.q3) - toX(stats.q1), bh);
        ctx.strokeRect(toX(stats.q1), cy - bh / 2, toX(stats.q3) - toX(stats.q1), bh);

        // Median line
        ctx.strokeStyle = C.red; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(toX(stats.median), cy - bh / 2); ctx.lineTo(toX(stats.median), cy + bh / 2); ctx.stroke();

        // Outliers
        const fence = { lo: stats.q1 - 1.5 * stats.iqr, hi: stats.q3 + 1.5 * stats.iqr };
        ctx.fillStyle = C.red;
        for (const x of data) {
            if (x < fence.lo || x > fence.hi) {
                ctx.beginPath(); ctx.arc(toX(x), cy, 3, 0, Math.PI * 2); ctx.fill();
            }
        }

        // X axis labels
        ctx.font = '9px Sora,sans-serif'; ctx.fillStyle = C.text(isDark); ctx.textAlign = 'center';
        for (const [label, v] of [['Min', stats.min], ['Q1', stats.q1], ['Med', stats.median], ['Q3', stats.q3], ['Max', stats.max]] as [string, number][]) {
            ctx.fillText(label, toX(v), cy + bh / 2 + 14);
            ctx.fillStyle = C.text(isDark) + 'aa';
            ctx.fillText(v.toFixed(1), toX(v), cy - bh / 2 - 5);
            ctx.fillStyle = C.text(isDark);
        }
    }, [data, stats]);

    return (
        <div>
            {/* Dataset buttons */}
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
                {Object.keys(SAMPLES).map(k => (
                    <button key={k} onClick={() => { setSample(k); setRawInput(SAMPLES[k]); }}
                        style={tabBtnStyle(sample === k)}>
                        {k}
                    </button>
                ))}
            </div>

            {/* Data input */}
            <textarea
                value={rawInput}
                onChange={e => { setRawInput(e.target.value); setSample('Custom'); }}
                rows={2}
                placeholder="Paste numbers separated by spaces, commas, or newlines…"
                style={{ width: '100%', padding: '7px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-warm)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.82rem', fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box', marginBottom: 8 }} />

            {data.length < 2 && (
                <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginBottom: 8 }}>
                    Enter at least 2 numbers to see analysis.
                </div>
            )}

            {stats && (
                <>
                    {/* Controls row */}
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                        <label style={labelStyle}>
                            Bins: <input type="range" min={3} max={20} value={bins} onChange={e => setBins(+e.target.value)} style={{ width: 80, accentColor: 'var(--amber)' }} /> {bins}
                        </label>
                        <label style={{ ...labelStyle, color: C.green, cursor: 'pointer' }}>
                            <input type="checkbox" checked={showNormal} onChange={e => setShowNormal(e.target.checked)} /> Normal overlay
                        </label>
                    </div>

                    {/* Histogram */}
                    <div style={canvasWrap('16/9')}>
                        <canvas ref={histRef} style={{ display: 'block' }} />
                    </div>
                    <div style={{ display: 'flex', gap: 14, fontSize: '0.72rem', color: 'var(--text-dim)', margin: '4px 0 8px' }}>
                        <span style={{ color: C.red }}>— Mean</span>
                        <span style={{ color: C.blue }}>— Median</span>
                        {showNormal && <span style={{ color: C.green }}>— Normal fit</span>}
                    </div>

                    {/* Box plot */}
                    <div style={canvasWrap('6/1', 72)}>
                        <canvas ref={boxRef} style={{ display: 'block' }} />
                    </div>

                    {/* Stats grid */}
                    <div style={statsGrid}>
                        {([
                            ['n', stats.n],
                            ['Mean', stats.mean.toFixed(3)],
                            ['Median', stats.median.toFixed(3)],
                            ['Mode', stats.mode !== null ? stats.mode : '—'],
                            ['Std Dev', stats.stdDev.toFixed(3)],
                            ['Variance', stats.variance.toFixed(3)],
                            ['Min', stats.min],
                            ['Max', stats.max],
                            ['Q1', stats.q1],
                            ['Q3', stats.q3],
                            ['IQR', stats.iqr.toFixed(3)],
                            ['Skewness', stats.skewness.toFixed(3)],
                            ['Ex. Kurtosis', stats.kurtosis.toFixed(3)],
                            ['Sum', stats.sum.toFixed(2)],
                        ] as [string, string | number][]).map(([label, val]) => (
                            <div key={label} style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '0.62rem', color: 'var(--text-dim)', fontWeight: 600, marginBottom: 2 }}>{label}</div>
                                <div style={{ fontSize: '0.88rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-primary)' }}>{val}</div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

// ── Tab: Distributions ───────────────────────────────────────────────────────

type Dist = 'normal' | 'binomial' | 'poisson' | 'exponential';

function DistributionsTab() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [dist, setDist] = useState<Dist>('normal');
    const [mu, setMu] = useState(0);
    const [sigma, setSigma] = useState(1);
    const [nBinom, setNBinom] = useState(20);
    const [pBinom, setPBinom] = useState(0.5);
    const [lambda, setLambda] = useState(3);
    const [showCDF, setShowCDF] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const s = setupCanvas(canvas);
        if (!s) return;
        const { ctx, W, H, isDark } = s;
        ctx.clearRect(0, 0, W, H);
        const pad = { top: 24, right: 16, bottom: 36, left: 50 };
        const cw = W - pad.left - pad.right, ch = H - pad.top - pad.bottom;

        const toSY = (v: number, maxV: number) => pad.top + ch - Math.max(0, Math.min(1, v / maxV)) * ch;

        if (dist === 'normal') {
            const xMin = mu - 4 * sigma, xMax = mu + 4 * sigma;
            const pts: [number, number][] = [];
            const cpts: [number, number][] = [];
            for (let px = 0; px <= cw; px++) {
                const x = xMin + (px / cw) * (xMax - xMin);
                pts.push([pad.left + px, pad.top + ch - normalPDF(x, mu, sigma) / normalPDF(mu, mu, sigma) * ch]);
                cpts.push([pad.left + px, pad.top + ch - normalCDF(x, mu, sigma) * ch]);
            }
            // Fill
            ctx.beginPath(); ctx.moveTo(pts[0][0], pad.top + ch);
            pts.forEach(([x, y]) => ctx.lineTo(x, y));
            ctx.lineTo(pts[pts.length - 1][0], pad.top + ch); ctx.closePath();
            ctx.fillStyle = isDark ? '#d9770618' : '#f59e0b18'; ctx.fill();
            // PDF curve
            ctx.strokeStyle = C.amber; ctx.lineWidth = 2.5;
            ctx.beginPath(); pts.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)); ctx.stroke();
            if (showCDF) {
                ctx.strokeStyle = C.blue; ctx.lineWidth = 2; ctx.setLineDash([5, 3]);
                ctx.beginPath(); cpts.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)); ctx.stroke();
                ctx.setLineDash([]);
            }
            // Mean line
            ctx.strokeStyle = C.red; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
            const mx = pad.left + ((mu - xMin) / (xMax - xMin)) * cw;
            ctx.beginPath(); ctx.moveTo(mx, pad.top); ctx.lineTo(mx, pad.top + ch); ctx.stroke();
            ctx.setLineDash([]);
            // ±σ labels
            ctx.font = '9px Sora'; ctx.textAlign = 'center'; ctx.fillStyle = C.text(isDark);
            for (const [k, label] of [[-2, '-2σ'], [-1, '-σ'], [0, 'μ'], [1, 'σ'], [2, '2σ']] as [number, string][]) {
                const x = pad.left + ((mu + k * sigma - xMin) / (xMax - xMin)) * cw;
                ctx.fillText(label, x, pad.top + ch + 16);
            }
        } else if (dist === 'binomial') {
            const maxP = Math.max(...Array.from({ length: nBinom + 1 }, (_, k) => binomPMF(k, nBinom, pBinom)));
            const barW = cw / (nBinom + 1);
            for (let k = 0; k <= nBinom; k++) {
                const p = binomPMF(k, nBinom, pBinom);
                const bh = (p / maxP) * ch;
                const bx = pad.left + k * barW;
                ctx.fillStyle = isDark ? '#d9770699' : '#f59e0b99';
                ctx.fillRect(bx + 1, pad.top + ch - bh, barW - 2, bh);
                ctx.strokeStyle = isDark ? '#b4530966' : '#d9770666'; ctx.lineWidth = 0.5;
                ctx.strokeRect(bx + 1, pad.top + ch - bh, barW - 2, bh);
            }
            if (showCDF) {
                let cum = 0;
                ctx.strokeStyle = C.blue; ctx.lineWidth = 2; ctx.setLineDash([5, 3]);
                ctx.beginPath();
                for (let k = 0; k <= nBinom; k++) {
                    cum += binomPMF(k, nBinom, pBinom);
                    const x = pad.left + k * barW + barW / 2;
                    const y = pad.top + ch - cum * ch;
                    k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
                }
                ctx.stroke(); ctx.setLineDash([]);
            }
            const mean = nBinom * pBinom;
            ctx.font = '9px Sora'; ctx.textAlign = 'center'; ctx.fillStyle = C.text(isDark);
            for (let k = 0; k <= nBinom; k += Math.max(1, Math.floor(nBinom / 8))) {
                ctx.fillText(String(k), pad.left + k * barW + barW / 2, pad.top + ch + 16);
            }
            ctx.strokeStyle = C.red; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
            const mx = pad.left + mean * barW + barW / 2;
            ctx.beginPath(); ctx.moveTo(mx, pad.top); ctx.lineTo(mx, pad.top + ch); ctx.stroke();
            ctx.setLineDash([]);
        } else if (dist === 'poisson') {
            const kMax = Math.ceil(lambda + 4 * Math.sqrt(lambda)) + 2;
            const maxP = Math.max(...Array.from({ length: kMax }, (_, k) => poissonPMF(k, lambda)));
            const barW = cw / kMax;
            for (let k = 0; k < kMax; k++) {
                const p = poissonPMF(k, lambda);
                const bh = (p / maxP) * ch;
                ctx.fillStyle = isDark ? '#a855f799' : '#c084fc99';
                ctx.fillRect(pad.left + k * barW + 1, pad.top + ch - bh, barW - 2, bh);
            }
            ctx.font = '9px Sora'; ctx.textAlign = 'center'; ctx.fillStyle = C.text(isDark);
            for (let k = 0; k < kMax; k += Math.max(1, Math.floor(kMax / 8))) {
                ctx.fillText(String(k), pad.left + k * barW + barW / 2, pad.top + ch + 16);
            }
            ctx.strokeStyle = C.red; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
            const mx = pad.left + lambda * barW + barW / 2;
            ctx.beginPath(); ctx.moveTo(mx, pad.top); ctx.lineTo(mx, pad.top + ch); ctx.stroke();
            ctx.setLineDash([]);
        } else {
            // Exponential
            const xMax = 5 / lambda;
            const maxP = lambda;
            ctx.beginPath();
            for (let px = 0; px <= cw; px++) {
                const x = (px / cw) * xMax;
                const y = toSY(exponentialPDF(x, lambda), maxP);
                px === 0 ? ctx.moveTo(pad.left, y) : ctx.lineTo(pad.left + px, y);
            }
            ctx.strokeStyle = C.green; ctx.lineWidth = 2.5; ctx.stroke();
            if (showCDF) {
                ctx.beginPath();
                for (let px = 0; px <= cw; px++) {
                    const x = (px / cw) * xMax;
                    const y = pad.top + ch - (1 - Math.exp(-lambda * x)) * ch;
                    px === 0 ? ctx.moveTo(pad.left, y) : ctx.lineTo(pad.left + px, y);
                }
                ctx.strokeStyle = C.blue; ctx.lineWidth = 2; ctx.setLineDash([5, 3]); ctx.stroke(); ctx.setLineDash([]);
            }
            ctx.font = '9px Sora'; ctx.textAlign = 'center'; ctx.fillStyle = C.text(isDark);
            for (let i = 0; i <= 4; i++) {
                const v = (i / 4) * xMax;
                ctx.fillText(v.toFixed(2), pad.left + (i / 4) * cw, pad.top + ch + 16);
            }
        }

        // Y-axis gridlines
        ctx.font = '9px Sora'; ctx.fillStyle = C.text(isDark); ctx.textAlign = 'right';
        ctx.strokeStyle = C.axis(isDark) + '44'; ctx.lineWidth = 0.5;
        for (let i = 1; i <= 4; i++) {
            const y = pad.top + (i / 4) * ch;
            ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + cw, y); ctx.stroke();
        }

        // Axes
        ctx.strokeStyle = C.axis(isDark); ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pad.left, pad.top); ctx.lineTo(pad.left, pad.top + ch);
        ctx.lineTo(pad.left + cw, pad.top + ch); ctx.stroke();

    }, [dist, mu, sigma, nBinom, pBinom, lambda, showCDF]);

    const distStats: Record<Dist, [string, string][]> = {
        normal: [['Mean', mu.toFixed(2)], ['Std Dev', sigma.toFixed(2)], ['Variance', (sigma * sigma).toFixed(2)], ['Skewness', '0'], ['P(X<μ)', '0.5']],
        binomial: [['Mean', (nBinom * pBinom).toFixed(2)], ['Variance', (nBinom * pBinom * (1 - pBinom)).toFixed(2)], ['Std Dev', Math.sqrt(nBinom * pBinom * (1 - pBinom)).toFixed(2)], ['n', String(nBinom)], ['p', pBinom.toFixed(2)]],
        poisson: [['Mean', lambda.toFixed(2)], ['Variance', lambda.toFixed(2)], ['Std Dev', Math.sqrt(lambda).toFixed(2)], ['λ', lambda.toFixed(2)], ['P(X=0)', Math.exp(-lambda).toFixed(4)]],
        exponential: [['Mean', (1 / lambda).toFixed(3)], ['Variance', (1 / (lambda * lambda)).toFixed(3)], ['Std Dev', (1 / lambda).toFixed(3)], ['λ', lambda.toFixed(2)], ['Median', (Math.log(2) / lambda).toFixed(3)]],
    };

    return (
        <div>
            {/* Dist selector */}
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
                {(['normal', 'binomial', 'poisson', 'exponential'] as Dist[]).map(d => (
                    <button key={d} onClick={() => setDist(d)} style={tabBtnStyle(dist === d)}>
                        {d.charAt(0).toUpperCase() + d.slice(1)}
                    </button>
                ))}
            </div>

            {/* Parameters */}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
                {dist === 'normal' && (<>
                    <ParamSlider label="μ (mean)" value={mu} min={-5} max={5} step={0.1} onChange={setMu} />
                    <ParamSlider label="σ (std dev)" value={sigma} min={0.1} max={5} step={0.1} onChange={setSigma} />
                </>)}
                {dist === 'binomial' && (<>
                    <ParamSlider label="n (trials)" value={nBinom} min={2} max={50} step={1} onChange={setNBinom} />
                    <ParamSlider label="p (success)" value={pBinom} min={0.01} max={0.99} step={0.01} onChange={setPBinom} />
                </>)}
                {(dist === 'poisson' || dist === 'exponential') && (
                    <ParamSlider label="λ (rate)" value={lambda} min={0.2} max={10} step={0.1} onChange={setLambda} />
                )}
                <label style={{ ...labelStyle, cursor: 'pointer', color: C.blue }}>
                    <input type="checkbox" checked={showCDF} onChange={e => setShowCDF(e.target.checked)} /> Show CDF
                </label>
            </div>

            <div style={canvasWrap('16/9')}><canvas ref={canvasRef} style={{ display: 'block' }} /></div>

            <div style={statsGrid}>
                {distStats[dist].map(([label, val]) => (
                    <div key={label} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.62rem', color: 'var(--text-dim)', fontWeight: 600, marginBottom: 2 }}>{label}</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-primary)' }}>{val}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Tab: Hypothesis Testing ──────────────────────────────────────────────────

function HypothesisTab() {
    const [testType, setTestType] = useState<'one-sample' | 'two-sample' | 'z-test'>('one-sample');
    const [raw1, setRaw1] = useState('72 85 90 68 74 88 95 82 79 91 76 84 93 70 87');
    const [raw2, setRaw2] = useState('65 78 82 71 69 75 80 73 77 68 83 72 79 70 76');
    const [mu0, setMu0] = useState('75');
    const [alpha, setAlpha] = useState(0.05);

    const data1 = parseNumbers(raw1);
    const data2 = parseNumbers(raw2);
    const stats1 = computeStats(data1);
    const stats2 = computeStats(data2);

    const result = (() => {
        if (!stats1 || data1.length < 2) return null;
        const hypothMean = parseFloat(mu0);
        if (isNaN(hypothMean) && testType !== 'two-sample') return null;

        if (testType === 'one-sample' || testType === 'z-test') {
            const se = stats1.stdDev / Math.sqrt(stats1.n);
            const t = (stats1.mean - hypothMean) / se;
            const df = stats1.n - 1;
            const pVal = tTestPValue(Math.abs(t), df);
            const reject = pVal < alpha;
            return { t, df, pVal, reject, type: testType === 'z-test' ? 'Z' : 't', se, mean1: stats1.mean, n1: stats1.n };
        } else {
            if (!stats2 || data2.length < 2) return null;
            const se = Math.sqrt(stats1.variance / stats1.n + stats2.variance / stats2.n);
            const t = (stats1.mean - stats2.mean) / se;
            const df = Math.floor((stats1.variance / stats1.n + stats2.variance / stats2.n) ** 2 /
                ((stats1.variance / stats1.n) ** 2 / (stats1.n - 1) + (stats2.variance / stats2.n) ** 2 / (stats2.n - 1)));
            const pVal = tTestPValue(Math.abs(t), df);
            const reject = pVal < alpha;
            return { t, df, pVal, reject, type: 't', se, mean1: stats1.mean, n1: stats1.n, mean2: stats2.mean, n2: stats2.n };
        }
    })();

    const interpretSkewness = (s: number) => Math.abs(s) < 0.5 ? 'Approx. symmetric' : s > 0 ? 'Right-skewed' : 'Left-skewed';

    return (
        <div>
            {/* Test type */}
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
                {[['one-sample', 'One-Sample t-test'], ['two-sample', 'Two-Sample t-test'], ['z-test', 'Z-test']] .map(([v, label]) => (
                    <button key={v} onClick={() => setTestType(v as typeof testType)} style={tabBtnStyle(testType === v)}>{label}</button>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: testType === 'two-sample' ? '1fr 1fr' : '1fr', gap: 8, marginBottom: 8 }}>
                <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: 3 }}>
                        {testType === 'two-sample' ? 'Sample 1' : 'Sample data'}
                    </div>
                    <textarea value={raw1} onChange={e => setRaw1(e.target.value)} rows={2}
                        placeholder="Numbers separated by spaces or commas"
                        style={textareaStyle} />
                    {stats1 && <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>n={stats1.n}, x̄={stats1.mean.toFixed(2)}, s={stats1.stdDev.toFixed(2)}, {interpretSkewness(stats1.skewness)}</div>}
                </div>
                {testType === 'two-sample' && (
                    <div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: 3 }}>Sample 2</div>
                        <textarea value={raw2} onChange={e => setRaw2(e.target.value)} rows={2}
                            placeholder="Numbers separated by spaces or commas"
                            style={textareaStyle} />
                        {stats2 && <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>n={stats2.n}, x̄={stats2.mean.toFixed(2)}, s={stats2.stdDev.toFixed(2)}</div>}
                    </div>
                )}
            </div>

            {testType !== 'two-sample' && (
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                    <label style={labelStyle}>
                        H₀: μ =
                        <input type="number" value={mu0} onChange={e => setMu0(e.target.value)}
                            style={{ width: 70, marginLeft: 5, padding: '4px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-warm)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.85rem' }} />
                    </label>
                    <label style={labelStyle}>
                        α =
                        <select value={alpha} onChange={e => setAlpha(+e.target.value)}
                            style={{ marginLeft: 5, padding: '4px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-warm)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                            {[0.01, 0.05, 0.1].map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                    </label>
                </div>
            )}

            {testType === 'two-sample' && (
                <div style={{ marginBottom: 8 }}>
                    <label style={labelStyle}>
                        H₀: μ₁ = μ₂ &nbsp;&nbsp; α =
                        <select value={alpha} onChange={e => setAlpha(+e.target.value)}
                            style={{ marginLeft: 5, padding: '4px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-warm)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                            {[0.01, 0.05, 0.1].map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                    </label>
                </div>
            )}

            {result && (
                <>
                    {/* Result banner */}
                    <div style={{
                        padding: '10px 14px', borderRadius: 'var(--radius-md)', marginBottom: 10,
                        background: result.reject ? '#ef444418' : '#22c55e18',
                        border: `1.5px solid ${result.reject ? C.red : C.green}`,
                    }}>
                        <div style={{ fontWeight: 700, color: result.reject ? C.red : C.green, marginBottom: 4 }}>
                            {result.reject ? '✗ Reject H₀' : '✓ Fail to Reject H₀'}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                            {result.reject
                                ? `p-value (${result.pVal.toFixed(4)}) < α (${alpha}) → statistically significant`
                                : `p-value (${result.pVal.toFixed(4)}) ≥ α (${alpha}) → not statistically significant`}
                        </div>
                    </div>

                    {/* Metrics grid */}
                    <div style={statsGrid}>
                        {([
                            [result.type + '-stat', result.t.toFixed(4)],
                            ['df', result.df.toFixed(1)],
                            ['p-value', result.pVal.toFixed(5)],
                            ['SE', result.se.toFixed(4)],
                            ['x̄₁', result.mean1.toFixed(3)],
                            ['n₁', result.n1],
                            ...('mean2' in result ? [['x̄₂', (result.mean2 as number).toFixed(3)], ['n₂', result.n2]] : []),
                        ] as [string, string | number][]).map(([l, v]) => (
                            <div key={l} style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '0.62rem', color: 'var(--text-dim)', fontWeight: 600, marginBottom: 2 }}>{l}</div>
                                <div style={{ fontSize: '0.88rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-primary)' }}>{v}</div>
                            </div>
                        ))}
                    </div>

                    {/* Interpretation */}
                    <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', fontSize: '0.76rem', color: 'var(--text-dim)', lineHeight: 1.6 }}>
                        <strong>Interpretation: </strong>
                        {testType === 'two-sample'
                            ? result.reject
                                ? `The means of the two samples differ significantly (${result.mean1.toFixed(2)} vs ${(result as { mean2: number }).mean2.toFixed(2)}).`
                                : `No significant difference between the two sample means (${result.mean1.toFixed(2)} vs ${(result as { mean2: number }).mean2.toFixed(2)}).`
                            : result.reject
                                ? `The sample mean (${result.mean1.toFixed(2)}) differs significantly from H₀: μ = ${mu0}.`
                                : `Insufficient evidence to conclude the mean differs from H₀: μ = ${mu0}.`}
                    </div>
                </>
            )}
        </div>
    );
}

// ── Tab: Regression ──────────────────────────────────────────────────────────

function RegressionTab() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [rawX, setRawX] = useState('1 2 3 4 5 6 7 8 9 10');
    const [rawY, setRawY] = useState('2.1 3.8 5.2 6.9 8.4 10.1 11.7 13.2 15.0 16.8');
    const [showResiduals, setShowResiduals] = useState(false);

    const dataX = parseNumbers(rawX);
    const dataY = parseNumbers(rawY);
    const n = Math.min(dataX.length, dataY.length);
    const xs = dataX.slice(0, n);
    const ys = dataY.slice(0, n);

    const reg = useCallback(() => {
        if (n < 2) return null;
        const mx = xs.reduce((a, b) => a + b, 0) / n;
        const my = ys.reduce((a, b) => a + b, 0) / n;
        const ssxx = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
        const ssxy = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
        const ssyy = ys.reduce((s, y) => s + (y - my) ** 2, 0);
        const slope = ssxy / (ssxx || 1);
        const intercept = my - slope * mx;
        const r = ssxy / Math.sqrt(ssxx * ssyy || 1);
        const r2 = r * r;
        const predicted = xs.map(x => slope * x + intercept);
        const sse = ys.reduce((s, y, i) => s + (y - predicted[i]) ** 2, 0);
        const se = Math.sqrt(sse / (n - 2 || 1));
        return { slope, intercept, r, r2, se, predicted, mx, my, ssxx, ssxy };
    }, [xs, ys, n]);

    const model = reg();

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !model || n < 2) return;
        const s = setupCanvas(canvas);
        if (!s) return;
        const { ctx, W, H, isDark } = s;
        ctx.clearRect(0, 0, W, H);
        const pad = { top: 20, right: 20, bottom: 40, left: 50 };
        const cw = W - pad.left - pad.right, ch = H - pad.top - pad.bottom;

        const xMin = Math.min(...xs), xMax = Math.max(...xs);
        const yMin = Math.min(...ys), yMax = Math.max(...ys);
        const xRange = xMax - xMin || 1, yRange = yMax - yMin || 1;
        const pad_ = 0.12;
        const toX = (v: number) => pad.left + ((v - xMin) / xRange + pad_) / (1 + 2 * pad_) * cw;
        const toY = (v: number) => pad.top + (1 - ((v - yMin) / yRange + pad_) / (1 + 2 * pad_)) * ch;

        // Grid
        ctx.strokeStyle = C.axis(isDark) + '55'; ctx.lineWidth = 0.5;
        for (let i = 1; i <= 5; i++) {
            const y = pad.top + (i / 5) * ch;
            ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + cw, y); ctx.stroke();
        }

        // Regression line
        const rxMin = xMin - xRange * pad_;
        const rxMax = xMax + xRange * pad_;
        ctx.strokeStyle = C.amber; ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(toX(rxMin), toY(model.slope * rxMin + model.intercept));
        ctx.lineTo(toX(rxMax), toY(model.slope * rxMax + model.intercept));
        ctx.stroke();

        // Residual lines
        if (showResiduals) {
            ctx.strokeStyle = C.red + '88'; ctx.lineWidth = 1;
            for (let i = 0; i < n; i++) {
                ctx.beginPath();
                ctx.moveTo(toX(xs[i]), toY(ys[i]));
                ctx.lineTo(toX(xs[i]), toY(model.predicted[i]));
                ctx.stroke();
            }
        }

        // Points
        for (let i = 0; i < n; i++) {
            ctx.beginPath();
            ctx.arc(toX(xs[i]), toY(ys[i]), 4.5, 0, Math.PI * 2);
            ctx.fillStyle = isDark ? '#fbbf24' : '#d97706';
            ctx.fill();
            ctx.strokeStyle = isDark ? '#92400e' : '#fffbeb'; ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        // Axes
        ctx.strokeStyle = C.axis(isDark); ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pad.left, pad.top); ctx.lineTo(pad.left, pad.top + ch);
        ctx.lineTo(pad.left + cw, pad.top + ch); ctx.stroke();

        // X axis labels
        ctx.font = '9px Sora,sans-serif'; ctx.fillStyle = C.text(isDark); ctx.textAlign = 'center';
        for (let i = 0; i <= 5; i++) {
            const v = xMin + (i / 5) * xRange;
            ctx.fillText(v.toFixed(1), pad.left + (i / 5) * cw, pad.top + ch + 16);
        }

        // Y axis labels
        ctx.textAlign = 'right';
        for (let i = 0; i <= 4; i++) {
            const v = yMin + (i / 4) * yRange;
            ctx.fillText(v.toFixed(1), pad.left - 5, pad.top + ch - (i / 4) * ch + 3);
        }

        // Equation label
        const eq = `ŷ = ${model.slope.toFixed(3)}x ${model.intercept >= 0 ? '+' : '−'} ${Math.abs(model.intercept).toFixed(3)}`;
        ctx.font = 'bold 10px Sora'; ctx.fillStyle = C.amber; ctx.textAlign = 'left';
        ctx.fillText(eq, pad.left + 8, pad.top + 16);

    }, [xs, ys, n, model, showResiduals]);

    return (
        <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: 3 }}>X values</div>
                    <textarea value={rawX} onChange={e => setRawX(e.target.value)} rows={2} placeholder="X values…" style={textareaStyle} />
                </div>
                <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: 3 }}>Y values</div>
                    <textarea value={rawY} onChange={e => setRawY(e.target.value)} rows={2} placeholder="Y values…" style={textareaStyle} />
                </div>
            </div>

            {n < 2 && <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginBottom: 8 }}>Enter at least 2 (x, y) pairs.</div>}
            {dataX.length !== dataY.length && n >= 2 && (
                <div style={{ color: '#f59e0b', fontSize: '0.78rem', marginBottom: 6 }}>
                    ⚠ Using first {n} points (X has {dataX.length}, Y has {dataY.length} values)
                </div>
            )}

            <div style={{ marginBottom: 8 }}>
                <label style={{ ...labelStyle, color: C.red, cursor: 'pointer' }}>
                    <input type="checkbox" checked={showResiduals} onChange={e => setShowResiduals(e.target.checked)} /> Show residuals
                </label>
            </div>

            <div style={canvasWrap('16/9')}><canvas ref={canvasRef} style={{ display: 'block' }} /></div>

            {model && (
                <div style={statsGrid}>
                    {([
                        ['Slope (β₁)', model.slope.toFixed(5)],
                        ['Intercept (β₀)', model.intercept.toFixed(5)],
                        ['R (Pearson)', model.r.toFixed(5)],
                        ['R² (fit)', model.r2.toFixed(5)],
                        ['Std Error', model.se.toFixed(4)],
                        ['n', n],
                    ] as [string, string | number][]).map(([l, v]) => (
                        <div key={l} style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.62rem', color: 'var(--text-dim)', fontWeight: 600, marginBottom: 2 }}>{l}</div>
                            <div style={{ fontSize: '0.88rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-primary)' }}>{v}</div>
                        </div>
                    ))}
                    <div style={{ gridColumn: '1/-1', fontSize: '0.75rem', color: 'var(--text-dim)', textAlign: 'center', marginTop: 4 }}>
                        {Math.abs(model.r) > 0.9 ? '🔴 Very strong' : Math.abs(model.r) > 0.7 ? '🟠 Strong' : Math.abs(model.r) > 0.4 ? '🟡 Moderate' : '⚪ Weak'} {model.r > 0 ? 'positive' : 'negative'} linear correlation
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Shared sub-components ────────────────────────────────────────────────────

function ParamSlider({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
    return (
        <label style={labelStyle}>
            {label}: <input type="range" min={min} max={max} step={step} value={value}
                onChange={e => onChange(+e.target.value)}
                style={{ width: 90, accentColor: 'var(--amber)', margin: '0 6px' }} />
            <span style={{ fontFamily: 'monospace', minWidth: 36, display: 'inline-block' }}>{value}</span>
        </label>
    );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '4px 12px', borderRadius: 'var(--radius-sm)', fontSize: '0.77rem', fontWeight: 600,
    cursor: 'pointer', background: active ? 'var(--amber)' : 'transparent',
    color: active ? '#fff' : 'var(--text-dim)',
    border: `1px solid ${active ? 'var(--amber)' : 'var(--border-warm)'}`,
});

const labelStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 4,
    fontSize: '0.78rem', color: 'var(--text-dim)',
};

const textareaStyle: React.CSSProperties = {
    width: '100%', padding: '6px 10px', borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-warm)', background: 'var(--bg-secondary)',
    color: 'var(--text-primary)', fontSize: '0.82rem', fontFamily: 'monospace',
    resize: 'vertical', boxSizing: 'border-box',
};

const canvasWrap = (ratio: string, minH?: number): React.CSSProperties => ({
    width: '100%', aspectRatio: ratio, minHeight: minH,
    background: 'var(--bg-primary)', border: '1px solid var(--border-warm)',
    borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: 10,
});

const statsGrid: React.CSSProperties = {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 6,
    background: 'var(--bg-secondary)', border: '1px solid var(--border-warm)',
    borderRadius: 'var(--radius-sm)', padding: '10px 12px', marginTop: 8,
};

// ── Root component ───────────────────────────────────────────────────────────

type Tab = 'descriptive' | 'distributions' | 'hypothesis' | 'regression';
const TABS: [Tab, string][] = [
    ['descriptive', 'Descriptive'],
    ['distributions', 'Distributions'],
    ['hypothesis', 'Hypothesis Testing'],
    ['regression', 'Regression'],
];

export default function StatisticsLab() {
    const [tab, setTab] = useState<Tab>('descriptive');

    return (
        <div className="tool-card">
            <div className="tool-card-header">
                <h3>Statistics Lab</h3>
                <span className="subject-topic" style={{ background: 'var(--amber-glow)', color: 'var(--amber)' }}>Statistics</span>
            </div>
            <div className="tool-card-body">
                {/* Tab bar */}
                <div style={{ display: 'flex', gap: 4, marginBottom: 14, borderBottom: '1px solid var(--border-warm)', paddingBottom: 10, flexWrap: 'wrap' }}>
                    {TABS.map(([key, label]) => (
                        <button key={key} onClick={() => setTab(key)}
                            style={{
                                padding: '5px 14px', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', fontWeight: 600,
                                cursor: 'pointer', border: 'none',
                                background: tab === key ? 'var(--amber)' : 'transparent',
                                color: tab === key ? '#fff' : 'var(--text-dim)',
                                transition: 'all 0.15s',
                            }}>
                            {label}
                        </button>
                    ))}
                </div>

                {tab === 'descriptive' && <DescriptiveTab />}
                {tab === 'distributions' && <DistributionsTab />}
                {tab === 'hypothesis' && <HypothesisTab />}
                {tab === 'regression' && <RegressionTab />}
            </div>
        </div>
    );
}
