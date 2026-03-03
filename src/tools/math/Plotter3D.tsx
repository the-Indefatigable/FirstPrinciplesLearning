import { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import * as math from 'mathjs';

// PlotGL3D uses plotly-gl3d partial bundle (~1.7 MB vs 4.8 MB for full plotly)
// and is lazy-loaded so it only downloads when this component actually renders
const Plot = lazy(() => import('./PlotGL3D'));

export default function Plotter3D() {
    const [equation, setEquation] = useState('sin(x) * cos(y)');
    const [bounds, setBounds] = useState(5);
    const [resolution, setResolution] = useState(40);
    const [error, setError] = useState<string | null>(null);
    const [isDarkMode, setIsDarkMode] = useState(false);

    // Watch for dark mode changes
    useEffect(() => {
        const mediaQuery = matchMedia('(prefers-color-scheme: dark)');
        setIsDarkMode(mediaQuery.matches);
        const handler = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
        mediaQuery.addEventListener('change', handler);
        return () => mediaQuery.removeEventListener('change', handler);
    }, []);

    const plotData = useMemo(() => {
        try {
            setError(null);
            const compiled = math.compile(equation);
            const xVal = [];
            const yVal = [];

            const step = (bounds * 2) / resolution;
            for (let i = 0; i <= resolution; i++) {
                xVal.push(-bounds + i * step);
                yVal.push(-bounds + i * step);
            }

            const zVal: number[][] = [];
            for (let j = 0; j <= resolution; j++) {
                const zRow = [];
                for (let i = 0; i <= resolution; i++) {
                    const result = compiled.evaluate({ x: xVal[i], y: yVal[j], e: Math.E, pi: Math.PI });
                    zRow.push(Number(result));
                }
                zVal.push(zRow);
            }

            return [{
                x: xVal,
                y: yVal,
                z: zVal,
                type: 'surface' as const,
                colorscale: 'Viridis',
                showscale: false
            }];
        } catch (err: any) {
            setError(err.message || 'Invalid equation');
            return null;
        }
    }, [equation, bounds, resolution]);

    return (
        <div className="tool-card plotter-3d">
            <div className="tool-card-header">
                <h3>3D Surface Plotter</h3>
                <span className="subject-topic" style={{ background: 'var(--amber-soft)', color: 'var(--amber)' }}>z = f(x,y)</span>
            </div>

            <div className="tool-card-body">
                <div className="tool-controls-row tool-controls-row--3">
                    <div className="tool-input-group">
                        <label>Function z = f(x, y)</label>
                        <input
                            type="text"
                            className="tool-input"
                            value={equation}
                            onChange={(e) => setEquation(e.target.value)}
                            placeholder="e.g. sin(x) * cos(y)"
                        />
                        {error && <div style={{ color: 'var(--terracotta)', fontSize: '0.8rem', marginTop: '6px' }}>{error}</div>}
                    </div>
                    <div className="tool-input-group">
                        <label>Bounds (±)</label>
                        <input
                            type="number"
                            className="tool-input"
                            value={bounds}
                            min={1}
                            max={50}
                            onChange={(e) => setBounds(Number(e.target.value))}
                        />
                    </div>
                    <div className="tool-input-group">
                        <label>Grid Resolution</label>
                        <input
                            type="number"
                            className="tool-input"
                            value={resolution}
                            min={10}
                            max={100}
                            step={10}
                            onChange={(e) => setResolution(Number(e.target.value))}
                        />
                    </div>
                </div>

                <div
                    className="plot-container"
                    style={{
                        width: '100%',
                        height: '500px',
                        background: 'var(--bg-secondary)',
                        borderRadius: 'var(--radius-md)',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid var(--border-warm)'
                    }}
                >
                    {plotData ? (
                        <Suspense fallback={
                            <div style={{ color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div className="animate-spin" style={{ width: 18, height: 18, border: '2px solid var(--border-warm)', borderTopColor: 'var(--amber)', borderRadius: '50%' }} />
                                Loading 3D renderer…
                            </div>
                        }>
                            <Plot
                                data={plotData as any}
                                layout={{
                                    width: undefined,
                                    height: undefined,
                                    autosize: true,
                                    margin: { l: 0, r: 0, b: 0, t: 0 },
                                    paper_bgcolor: 'transparent',
                                    plot_bgcolor: 'transparent',
                                    scene: {
                                        xaxis: { title: { text: 'X' }, showgrid: true, zeroline: true, gridcolor: isDarkMode ? '#242018' : '#e8e0d2' },
                                        yaxis: { title: { text: 'Y' }, showgrid: true, zeroline: true, gridcolor: isDarkMode ? '#242018' : '#e8e0d2' },
                                        zaxis: { title: { text: 'Z' }, showgrid: true, zeroline: true, gridcolor: isDarkMode ? '#242018' : '#e8e0d2' },
                                        camera: { eye: { x: 1.5, y: 1.5, z: 1.5 } }
                                    },
                                    font: {
                                        family: 'Sora, sans-serif',
                                        color: isDarkMode ? '#e8e4de' : '#1a1612'
                                    }
                                }}
                                useResizeHandler={true}
                                style={{ width: '100%', height: '100%' }}
                                config={{ displayModeBar: false, responsive: true }}
                            />
                        </Suspense>
                    ) : (
                        <div style={{ color: 'var(--text-dim)' }}>Waiting for valid equation...</div>
                    )}
                </div>
            </div>
        </div>
    );
}
