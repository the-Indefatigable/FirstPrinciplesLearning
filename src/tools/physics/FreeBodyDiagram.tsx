import { useRef, useEffect, useState } from 'react';

interface Force { name: string; mag: number; angle: number; color: string; }

const PRESETS: Record<string, Force[]> = {
    'Block on flat surface': [
        { name: 'Gravity', mag: 50, angle: 270, color: '#ef4444' },
        { name: 'Normal', mag: 50, angle: 90, color: '#3b82f6' },
        { name: 'Applied', mag: 30, angle: 0, color: '#22c55e' },
        { name: 'Friction', mag: 10, angle: 180, color: '#f59e0b' },
    ],
    'Block on incline': [
        { name: 'Gravity', mag: 50, angle: 270, color: '#ef4444' },
        { name: 'Normal', mag: 43, angle: 120, color: '#3b82f6' },
        { name: 'Friction', mag: 15, angle: 150, color: '#f59e0b' },
    ],
    'Hanging mass': [
        { name: 'Gravity', mag: 50, angle: 270, color: '#ef4444' },
        { name: 'Tension', mag: 50, angle: 90, color: '#8b5cf6' },
    ],
};

export default function FreeBodyDiagram() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [forces, setForces] = useState<Force[]>(PRESETS['Block on flat surface']);
    const [preset, setPreset] = useState('Block on flat surface');
    const [mass, setMass] = useState(5);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
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
        const cx = W / 2, cy = H / 2;

        ctx.clearRect(0, 0, W, H);

        // Object (block)
        const blockSize = 40;
        ctx.fillStyle = isDark ? '#3d3530' : '#e8e0d4';
        ctx.strokeStyle = isDark ? '#6b6358' : '#9c9488';
        ctx.lineWidth = 2;
        ctx.fillRect(cx - blockSize, cy - blockSize, blockSize * 2, blockSize * 2);
        ctx.strokeRect(cx - blockSize, cy - blockSize, blockSize * 2, blockSize * 2);

        // Mass label
        ctx.font = 'bold 14px Sora, sans-serif';
        ctx.fillStyle = isDark ? '#e8e4de' : '#1a1612';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${mass} kg`, cx, cy);

        // Draw force vectors
        const scale = 2.5;
        for (const f of forces) {
            const rad = (f.angle * Math.PI) / 180;
            const dx = Math.cos(rad) * f.mag * scale;
            const dy = -Math.sin(rad) * f.mag * scale;

            const startX = cx, startY = cy;
            const endX = startX + dx, endY = startY + dy;

            // Arrow shaft
            ctx.strokeStyle = f.color;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();

            // Arrow head
            const headLen = 12;
            const a = Math.atan2(dy, dx);
            ctx.fillStyle = f.color;
            ctx.beginPath();
            ctx.moveTo(endX, endY);
            ctx.lineTo(endX - headLen * Math.cos(a - 0.4), endY - headLen * Math.sin(a - 0.4));
            ctx.lineTo(endX - headLen * Math.cos(a + 0.4), endY - headLen * Math.sin(a + 0.4));
            ctx.closePath();
            ctx.fill();

            // Label
            ctx.font = 'bold 11px Sora, sans-serif';
            ctx.fillStyle = f.color;
            ctx.textAlign = 'center';
            const lx = endX + Math.cos(rad) * 18;
            const ly = endY - Math.sin(rad) * 18;
            ctx.fillText(`${f.name} (${f.mag}N)`, lx, ly);
        }
        ctx.textBaseline = 'alphabetic';

        // Net force
        let netX = 0, netY = 0;
        for (const f of forces) {
            const rad = (f.angle * Math.PI) / 180;
            netX += f.mag * Math.cos(rad);
            netY += f.mag * Math.sin(rad);
        }
        const netMag = Math.sqrt(netX * netX + netY * netY);

        // Net force arrow
        if (netMag > 0.5) {
            const ndx = netX * scale, ndy = -netY * scale;
            ctx.setLineDash([6, 4]);
            ctx.strokeStyle = isDark ? '#fde68a' : '#d97706';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + ndx, cy + ndy);
            ctx.stroke();
            ctx.setLineDash([]);

            // Head
            const headLen = 14;
            const a = Math.atan2(ndy, ndx);
            ctx.fillStyle = isDark ? '#fde68a' : '#d97706';
            ctx.beginPath();
            ctx.moveTo(cx + ndx, cy + ndy);
            ctx.lineTo(cx + ndx - headLen * Math.cos(a - 0.4), cy + ndy - headLen * Math.sin(a - 0.4));
            ctx.lineTo(cx + ndx - headLen * Math.cos(a + 0.4), cy + ndy - headLen * Math.sin(a + 0.4));
            ctx.closePath();
            ctx.fill();

            ctx.font = 'bold 12px Sora, sans-serif';
            ctx.fillStyle = isDark ? '#fde68a' : '#d97706';
            ctx.fillText(`ΣF = ${netMag.toFixed(1)}N`, cx + ndx + 20, cy + ndy);
        }
    }, [forces, mass]);

    const updateForce = (idx: number, key: keyof Force, value: string | number) => {
        setForces(prev => prev.map((f, i) => i === idx ? { ...f, [key]: value } : f));
    };

    const accel = (() => {
        let netX = 0, netY = 0;
        for (const f of forces) {
            const rad = (f.angle * Math.PI) / 180;
            netX += f.mag * Math.cos(rad);
            netY += f.mag * Math.sin(rad);
        }
        return Math.sqrt(netX * netX + netY * netY) / mass;
    })();

    return (
        <div className="tool-card">
            <div className="tool-card-header">
                <h3>Free Body Diagram Builder</h3>
                <span className="subject-topic" style={{ background: 'var(--sage-glow)', color: 'var(--sage)' }}>Mechanics</span>
            </div>
            <div className="tool-card-body">
                <div className="tool-controls-row tool-controls-row--3" style={{ marginBottom: 8 }}>
                    <div className="tool-input-group">
                        <label>Preset</label>
                        <select className="tool-input" value={preset} onChange={e => { setPreset(e.target.value); setForces(PRESETS[e.target.value]); }}>
                            {Object.keys(PRESETS).map(k => <option key={k}>{k}</option>)}
                        </select>
                    </div>
                    <div className="tool-input-group">
                        <label>Mass (kg)</label>
                        <input className="tool-input" type="number" min={0.1} value={mass} onChange={e => setMass(+e.target.value)} />
                    </div>
                    <div className="tool-input-group" style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                        <button className="tool-btn tool-btn--outline"
                            onClick={() => setForces(p => [...p, { name: 'Force', mag: 20, angle: 0, color: '#a855f7' }])}>
                            + Add Force
                        </button>
                    </div>
                </div>

                {forces.map((f, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, fontSize: '0.85rem' }}>
                        <span style={{ width: 12, height: 12, borderRadius: '50%', background: f.color, flexShrink: 0 }} />
                        <input className="tool-input" value={f.name} onChange={e => updateForce(i, 'name', e.target.value)} style={{ flex: 1, padding: '4px 8px', fontSize: '0.82rem' }} />
                        <input className="tool-input" type="number" value={f.mag} onChange={e => updateForce(i, 'mag', +e.target.value)} style={{ width: 60, padding: '4px 8px', fontSize: '0.82rem' }} />
                        <span style={{ color: 'var(--text-dim)', fontSize: '0.78rem' }}>N</span>
                        <input className="tool-input" type="number" value={f.angle} onChange={e => updateForce(i, 'angle', +e.target.value)} style={{ width: 60, padding: '4px 8px', fontSize: '0.82rem' }} />
                        <span style={{ color: 'var(--text-dim)', fontSize: '0.78rem' }}>°</span>
                        <button onClick={() => setForces(p => p.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--terracotta)', fontSize: '1.1rem' }}>×</button>
                    </div>
                ))}

                <div style={{ padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', marginBottom: 16, marginTop: 12, display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>Acceleration (a = ΣF / m):</span>
                    <strong style={{ color: 'var(--sage)', fontFamily: 'monospace' }}>{accel.toFixed(2)} m/s²</strong>
                </div>

                <div style={{ width: '100%', aspectRatio: '4/3', background: 'var(--bg-primary)', border: '1px solid var(--border-warm)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                    <canvas ref={canvasRef} style={{ display: 'block' }} />
                </div>
            </div>
        </div>
    );
}
