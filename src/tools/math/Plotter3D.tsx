import { useState, useMemo, lazy, Suspense } from 'react';
import * as math from 'mathjs';

// PlotGL3D uses plotly-gl3d partial bundle (~1.7 MB vs 4.8 MB for full plotly)
// and is lazy-loaded so it only downloads when this component actually renders
const Plot = lazy(() => import('./PlotGL3D'));

/* ─── Manim-inspired colorscale (dark teal → cyan → gold) ─── */
const MANIM_COLORSCALE: [number, string][] = [
    [0, '#1a0533'],
    [0.15, '#2d1b69'],
    [0.3, '#1b4f72'],
    [0.45, '#2196a4'],
    [0.6, '#58C4DD'],
    [0.75, '#83C167'],
    [0.9, '#F4D03F'],
    [1, '#FF6F61'],
];

/* ─── Manim scene axis config ─── */
const manimAxis = (label: string) => ({
    title: { text: label, font: { family: '"JetBrains Mono", monospace', size: 12, color: 'rgba(200,210,225,0.6)' } },
    showgrid: true,
    zeroline: true,
    gridcolor: 'rgba(88,196,221,0.08)',
    zerolinecolor: 'rgba(200,210,225,0.2)',
    linecolor: 'rgba(200,210,225,0.15)',
    tickfont: { family: '"JetBrains Mono", monospace', size: 10, color: 'rgba(200,210,225,0.4)' },
    backgroundcolor: '#0d0f14',
    showbackground: true,
    gridwidth: 1,
});

export default function Plotter3D() {
    const [equation, setEquation] = useState('sin(x) * cos(y)');
    const [bounds, setBounds] = useState(5);
    const [resolution, setResolution] = useState(50);
    const [error, setError] = useState<string | null>(null);

    const plotData = useMemo(() => {
        try {
            setError(null);
            const compiled = math.compile(equation);
            const xVal: number[] = [];
            const yVal: number[] = [];

            const step = (bounds * 2) / resolution;
            for (let i = 0; i <= resolution; i++) {
                xVal.push(-bounds + i * step);
                yVal.push(-bounds + i * step);
            }

            const zVal: number[][] = [];
            for (let j = 0; j <= resolution; j++) {
                const zRow: number[] = [];
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
                colorscale: MANIM_COLORSCALE,
                showscale: false,
                opacity: 0.92,
                lighting: {
                    ambient: 0.6,
                    diffuse: 0.7,
                    specular: 0.4,
                    roughness: 0.3,
                    fresnel: 0.8,
                },
                lightposition: { x: 1000, y: 1000, z: 2000 },
                contours: {
                    z: { show: true, usecolormap: true, highlightcolor: '#58C4DD', project: { z: false } },
                },
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
                        height: '400px',
                        background: '#0f1117',
                        borderRadius: 'var(--radius-md)',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid rgba(88, 196, 221, 0.1)',
                        boxShadow: '0 0 40px rgba(88, 196, 221, 0.03), inset 0 0 60px rgba(15, 17, 23, 0.5)',
                    }}
                >
                    {plotData ? (
                        <Suspense fallback={
                            <div style={{ color: 'rgba(200,210,225,0.5)', display: 'flex', alignItems: 'center', gap: 10, fontFamily: '"JetBrains Mono", monospace', fontSize: '0.85rem' }}>
                                <div style={{ width: 18, height: 18, border: '2px solid rgba(88,196,221,0.2)', borderTopColor: '#58C4DD', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
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
                                    paper_bgcolor: '#0f1117',
                                    plot_bgcolor: '#0f1117',
                                    scene: {
                                        xaxis: manimAxis('X'),
                                        yaxis: manimAxis('Y'),
                                        zaxis: manimAxis('Z'),
                                        camera: { eye: { x: 1.6, y: 1.6, z: 1.4 } },
                                        bgcolor: '#0f1117',
                                        aspectmode: 'cube',
                                    },
                                    font: {
                                        family: '"JetBrains Mono", monospace',
                                        color: 'rgba(200,210,225,0.6)',
                                    },
                                } as any}
                                useResizeHandler={true}
                                style={{ width: '100%', height: '100%' }}
                                config={{ displayModeBar: false, responsive: true }}
                            />
                        </Suspense>
                    ) : (
                        <div style={{ color: 'rgba(200,210,225,0.4)', fontFamily: '"JetBrains Mono", monospace', fontSize: '0.85rem' }}>Waiting for valid equation...</div>
                    )}
                </div>

                <p style={{ margin: '8px 0 0', fontSize: '0.78rem', color: 'var(--text-dim)', fontFamily: '"JetBrains Mono", monospace' }}>
                    Click and drag to rotate. Scroll to zoom. Double-click to reset view.
                </p>
            </div>
        </div>
    );
}
