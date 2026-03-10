import React, { useState, useMemo, useCallback, useRef, useEffect, Suspense } from 'react';
import { createPortal } from 'react-dom';
import * as math from 'mathjs';

/* ─── Shared UI Library ─── */
import SmartMathInput from '../../components/tool/SmartMathInput';
import MathKeyboard from '../../components/tool/MathKeyboard';
import ToolLayoutSplit from '../../components/tool/ToolLayoutSplit';
import { useIsDark } from '../../hooks/useTheme';

const Plot = React.lazy(() => import('./PlotGL3D'));

/* ─── Manim-inspired colorscale ─── */
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

/* ─── Axis config ─── */
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

/* ─── Plotly Chart (shared between inline + fullscreen) ─── */
function PlotlyChart({ plotData }: { plotData: any[] | null }) {
    if (!plotData) {
        return (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(200,210,225,0.4)', fontFamily: '"JetBrains Mono", monospace', fontSize: '0.85rem' }}>
                Waiting for valid equation...
            </div>
        );
    }

    return (
        <Suspense fallback={
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(200,210,225,0.5)', fontFamily: '"JetBrains Mono", monospace', fontSize: '0.85rem', gap: 10 }}>
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
    );
}

export default function Plotter3D() {
    const inputRef = useRef<HTMLInputElement>(null);
    const [equation, setEquation] = useState('sin(x) * cos(y)');
    const [bounds, setBounds] = useState(5);
    const [resolution, setResolution] = useState(50);
    const [error, setError] = useState<string | null>(null);
    const [showKeyboard, setShowKeyboard] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const isDark = useIsDark();

    const insertAtCursor = useCallback((text: string) => {
        const input = inputRef.current;
        if (!input) { setEquation(p => p + text); return; }
        const start = input.selectionStart ?? equation.length;
        const end = input.selectionEnd ?? equation.length;
        setEquation(equation.slice(0, start) + text + equation.slice(end));
        requestAnimationFrame(() => { input.focus(); const pos = start + text.length; input.setSelectionRange(pos, pos); });
    }, [equation]);

    const handleBackspace = useCallback(() => {
        const i = inputRef.current;
        if (i) {
            const s = i.selectionStart ?? equation.length;
            if (s > 0) {
                setEquation(equation.slice(0, s - 1) + equation.slice(s));
                requestAnimationFrame(() => { i.focus(); i.setSelectionRange(s - 1, s - 1); });
            }
        }
    }, [equation]);

    // Native fullscreen
    useEffect(() => {
        if (isFullscreen) {
            document.documentElement.requestFullscreen().catch(() => { });
        } else {
            if (document.fullscreenElement) document.exitFullscreen().catch(() => { });
        }
    }, [isFullscreen]);

    // Listen for Escape to exit fullscreen
    useEffect(() => {
        const onFS = () => {
            if (!document.fullscreenElement) setIsFullscreen(false);
        };
        document.addEventListener('fullscreenchange', onFS);
        return () => document.removeEventListener('fullscreenchange', onFS);
    }, []);

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

    const borderC = isDark ? '#27272a' : '#e4e4e7';
    const textDim = isDark ? '#9ca3af' : '#6b7280';
    const textPrimary = isDark ? '#ffffff' : '#000000';
    const inputBg = isDark ? '#18181b' : '#f3f4f6';
    const cyan = '#58C4DD';
    const cyanGlow = isDark ? 'rgba(88,196,221,0.1)' : 'rgba(88,196,221,0.08)';

    const sidebar = (
        <>
            {/* ── Title ── */}
            <div style={{
                textAlign: 'center', padding: '14px 20px',
                background: cyanGlow, borderRadius: 10,
                border: `1px solid ${isDark ? 'rgba(88,196,221,0.2)' : 'rgba(88,196,221,0.15)'}`,
            }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: cyan, marginBottom: 6 }}>
                    3D Surface Plotter
                </div>
                <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '1.1rem', color: textPrimary }}>
                    z = f(x, y)
                </div>
            </div>

            {/* ── Function input ── */}
            <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: textDim }}>
                z = f(x, y)
            </div>

            <SmartMathInput
                value={equation}
                onChange={setEquation}
                variable="x"
                isDark={isDark}
                placeholder="e.g. sin(x) * cos(y)"
            />

            {error && (
                <div style={{ color: '#ef4444', fontSize: '0.82rem', padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 6, border: '1px solid rgba(239,68,68,0.2)' }}>
                    {error}
                </div>
            )}

            <button onClick={() => setShowKeyboard(k => !k)} style={{
                background: showKeyboard ? cyanGlow : 'transparent', color: showKeyboard ? cyan : textDim,
                border: `1px solid ${borderC}`, borderRadius: 7, padding: '8px 10px',
                fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'system-ui',
                width: '100%', letterSpacing: 0.3, transition: 'all 0.1s'
            }}>
                {showKeyboard ? '✕ Hide keyboard' : '⌨ Math keyboard'}
            </button>

            {showKeyboard && (
                <MathKeyboard
                    onInsert={insertAtCursor}
                    onBackspace={handleBackspace}
                    onClear={() => setEquation('')}
                    isDark={isDark}
                />
            )}

            {/* ── Controls ── */}
            <div>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: textDim, marginBottom: 6 }}>
                    Bounds (±)
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <input
                        type="range" min={1} max={20} value={bounds}
                        onChange={e => setBounds(+e.target.value)}
                        style={{ flex: 1, accentColor: cyan }}
                    />
                    <span style={{
                        background: cyanGlow, color: cyan,
                        padding: '2px 10px', borderRadius: 6,
                        fontWeight: 700, fontSize: '0.85rem', fontFamily: 'monospace',
                        border: '1px solid rgba(88,196,221,0.2)',
                        minWidth: 36, textAlign: 'center',
                    }}>
                        {bounds}
                    </span>
                </div>
            </div>

            <div>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: textDim, marginBottom: 6 }}>
                    Grid Resolution
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <input
                        type="range" min={10} max={100} step={5} value={resolution}
                        onChange={e => setResolution(+e.target.value)}
                        style={{ flex: 1, accentColor: cyan }}
                    />
                    <span style={{
                        background: cyanGlow, color: cyan,
                        padding: '2px 10px', borderRadius: 6,
                        fontWeight: 700, fontSize: '0.85rem', fontFamily: 'monospace',
                        border: '1px solid rgba(88,196,221,0.2)',
                        minWidth: 36, textAlign: 'center',
                    }}>
                        {resolution}
                    </span>
                </div>
            </div>

            {/* ── Fullscreen toggle ── */}
            <button onClick={() => setIsFullscreen(true)} style={{
                width: '100%', padding: '10px 14px', marginTop: 4,
                border: `1px solid ${isDark ? 'rgba(88,196,221,0.25)' : 'rgba(0,100,200,0.2)'}`,
                borderRadius: 8,
                background: isDark ? 'rgba(88,196,221,0.06)' : 'rgba(0,100,200,0.04)',
                color: isDark ? '#58C4DD' : '#0066cc',
                fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                fontFamily: 'system-ui', letterSpacing: 0.3, transition: 'all 0.15s',
            }}>
                🌌 Immersive Fullscreen
            </button>

            {/* ── Tip ── */}
            <div style={{
                padding: '12px 16px', fontSize: '0.82rem',
                color: textDim, lineHeight: 1.6,
                background: inputBg, borderRadius: 8,
                border: `1px solid ${borderC}`,
            }}>
                Click and drag to rotate. Scroll to zoom. Double-click to reset view.
            </div>
        </>
    );

    const canvas = (
        <div style={{ width: '100%', height: '100%', background: '#0f1117', borderRadius: 8, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PlotlyChart plotData={plotData} />
        </div>
    );

    // ── Fullscreen portal ──
    const fullscreenOverlay = isFullscreen ? createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, background: '#0f1117', overflow: 'hidden' }}>
            <div style={{ width: '100%', height: '100%' }}>
                <PlotlyChart plotData={plotData} />
            </div>

            {/* Header */}
            <div style={{ position: 'absolute', top: 20, left: 28, display: 'flex', flexDirection: 'column', gap: 2, pointerEvents: 'none' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: '#58C4DD' }}>
                    3D Surface Plotter
                </span>
                <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '1.2rem', color: '#fff' }}>
                    z = {equation}
                </span>
            </div>

            {/* Close button */}
            <button onClick={() => setIsFullscreen(false)} style={{
                position: 'absolute', top: 20, right: 28, width: 44, height: 44,
                borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(0,0,0,0.8)', color: '#fff', fontSize: '1.2rem', cursor: 'pointer',
            }}>✕</button>
        </div>,
        document.body
    ) : null;

    return (
        <>
            <ToolLayoutSplit>
                {[sidebar, canvas]}
            </ToolLayoutSplit>
            {fullscreenOverlay}
        </>
    );
}
