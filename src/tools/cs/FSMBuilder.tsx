import { useRef, useEffect, useState } from 'react';

interface State { id: number; x: number; y: number; label: string; isAccept: boolean; }
interface Transition { from: number; to: number; symbol: string; }

export default function FSMBuilder() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [states, setStates] = useState<State[]>([
        { id: 0, x: 0.2, y: 0.5, label: 'q0', isAccept: false },
        { id: 1, x: 0.5, y: 0.5, label: 'q1', isAccept: false },
        { id: 2, x: 0.8, y: 0.5, label: 'q2', isAccept: true },
    ]);
    const [transitions, setTransitions] = useState<Transition[]>([
        { from: 0, to: 1, symbol: 'a' },
        { from: 1, to: 2, symbol: 'b' },
        { from: 1, to: 1, symbol: 'a' },
    ]);
    const [testInput, setTestInput] = useState('aab');
    const [testResult, setTestResult] = useState<{ accepted: boolean; path: number[] } | null>(null);
    const [newTrFrom, setNewTrFrom] = useState(0);
    const [newTrTo, setNewTrTo] = useState(1);
    const [newTrSym, setNewTrSym] = useState('a');
    const dragRef = useRef<number | null>(null);

    const runFSM = () => {
        let current = 0;
        const path = [current];
        for (const ch of testInput) {
            const tr = transitions.find(t => t.from === current && t.symbol === ch);
            if (!tr) { setTestResult({ accepted: false, path }); return; }
            current = tr.to;
            path.push(current);
        }
        const final = states.find(s => s.id === current);
        setTestResult({ accepted: final?.isAccept ?? false, path });
    };

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
        const R = 28;
        ctx.clearRect(0, 0, W, H);

        const activePath = testResult?.path ?? [];
        const activeSet = new Set(activePath);

        // Draw transitions
        for (const tr of transitions) {
            const from = states.find(s => s.id === tr.from);
            const to = states.find(s => s.id === tr.to);
            if (!from || !to) continue;
            const fx = from.x * W, fy = from.y * H;
            const tx = to.x * W, ty = to.y * H;

            if (tr.from === tr.to) {
                // Self-loop
                ctx.strokeStyle = isDark ? '#6b6358' : '#9c9488';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(fx, fy - R - 15, 15, 0.3, Math.PI - 0.3);
                ctx.stroke();
                ctx.font = 'bold 12px monospace';
                ctx.fillStyle = isDark ? '#e8e4de' : '#1a1612';
                ctx.textAlign = 'center';
                ctx.fillText(tr.symbol, fx, fy - R - 32);
            } else {
                const angle = Math.atan2(ty - fy, tx - fx);
                const sx = fx + R * Math.cos(angle), sy = fy + R * Math.sin(angle);
                const ex = tx - R * Math.cos(angle), ey = ty - R * Math.sin(angle);

                ctx.strokeStyle = isDark ? '#6b6358' : '#9c9488';
                ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();

                // Arrow head
                ctx.fillStyle = isDark ? '#6b6358' : '#9c9488';
                ctx.beginPath();
                ctx.moveTo(ex, ey);
                ctx.lineTo(ex - 10 * Math.cos(angle - 0.4), ey - 10 * Math.sin(angle - 0.4));
                ctx.lineTo(ex - 10 * Math.cos(angle + 0.4), ey - 10 * Math.sin(angle + 0.4));
                ctx.fill();

                // Label
                const mx = (sx + ex) / 2, my = (sy + ey) / 2;
                ctx.font = 'bold 12px monospace';
                ctx.fillStyle = isDark ? '#f59e0b' : '#d97706';
                ctx.textAlign = 'center';
                ctx.fillText(tr.symbol, mx + 10 * Math.cos(angle + Math.PI / 2), my + 10 * Math.sin(angle + Math.PI / 2));
            }
        }

        // Draw states
        for (const s of states) {
            const cx = s.x * W, cy = s.y * H;
            const isActive = activeSet.has(s.id);
            const isCurrentEnd = testResult && activePath[activePath.length - 1] === s.id;

            // Circle
            ctx.fillStyle = isCurrentEnd
                ? (testResult.accepted ? '#22c55e' : '#ef4444')
                : isActive ? (isDark ? 'rgba(245,158,11,0.3)' : 'rgba(217,119,6,0.15)') : (isDark ? '#2e2a24' : '#faf8f5');
            ctx.strokeStyle = isActive ? '#f59e0b' : (isDark ? '#6b6358' : '#9c9488');
            ctx.lineWidth = isActive ? 3 : 2;
            ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

            // Accept state double circle
            if (s.isAccept) {
                ctx.beginPath(); ctx.arc(cx, cy, R - 5, 0, Math.PI * 2); ctx.stroke();
            }

            // Label
            ctx.font = 'bold 13px monospace';
            ctx.fillStyle = isCurrentEnd ? 'white' : (isDark ? '#e8e4de' : '#1a1612');
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(s.label, cx, cy);
        }

        // Start arrow
        if (states.length > 0) {
            const s0 = states[0];
            const sx = s0.x * W - R - 30, sy = s0.y * H;
            ctx.strokeStyle = isDark ? '#86efac' : '#6b8f71';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(s0.x * W - R, sy); ctx.stroke();
            ctx.fillStyle = isDark ? '#86efac' : '#6b8f71';
            ctx.beginPath();
            ctx.moveTo(s0.x * W - R, sy);
            ctx.lineTo(s0.x * W - R - 8, sy - 5);
            ctx.lineTo(s0.x * W - R - 8, sy + 5);
            ctx.fill();
        }
        ctx.textBaseline = 'alphabetic';
    }, [states, transitions, testResult]);

    const handleMouseDown = (e: React.MouseEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left) / rect.width;
        const my = (e.clientY - rect.top) / rect.height;
        for (let i = 0; i < states.length; i++) {
            if (Math.hypot(mx - states[i].x, my - states[i].y) < 0.05) { dragRef.current = i; return; }
        }
    };
    const handleMouseMove = (e: React.MouseEvent) => {
        if (dragRef.current === null) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        setStates(p => p.map((s, i) => i === dragRef.current ? { ...s, x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height } : s));
    };
    const handleMouseUp = () => { dragRef.current = null; };

    return (
        <div className="tool-card">
            <div className="tool-card-header">
                <h3>Finite State Machine</h3>
                <span className="subject-topic" style={{ background: 'var(--terracotta-glow)', color: 'var(--terracotta)' }}>Automata</span>
            </div>
            <div className="tool-card-body">
                <div className="tool-controls-row tool-controls-row--3" style={{ marginBottom: 8 }}>
                    <div className="tool-input-group">
                        <label>Test Input</label>
                        <div style={{ display: 'flex', gap: 6 }}>
                            <input className="tool-input" value={testInput} onChange={e => setTestInput(e.target.value)} style={{ fontFamily: 'monospace', flex: 1 }} />
                            <button className="tool-btn" onClick={runFSM}>▶ Run</button>
                        </div>
                    </div>
                    <div className="tool-input-group">
                        <label>Add Transition</label>
                        <div style={{ display: 'flex', gap: 4 }}>
                            <select className="tool-input" value={newTrFrom} onChange={e => setNewTrFrom(+e.target.value)} style={{ width: 60 }}>
                                {states.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                            </select>
                            <input className="tool-input" value={newTrSym} onChange={e => setNewTrSym(e.target.value)} style={{ width: 36, fontFamily: 'monospace', textAlign: 'center' }} maxLength={1} />
                            <select className="tool-input" value={newTrTo} onChange={e => setNewTrTo(+e.target.value)} style={{ width: 60 }}>
                                {states.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                            </select>
                            <button className="tool-btn tool-btn--outline" onClick={() => setTransitions(p => [...p, { from: newTrFrom, to: newTrTo, symbol: newTrSym }])}>+</button>
                        </div>
                    </div>
                    <div className="tool-input-group" style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
                        <button className="tool-btn tool-btn--outline" onClick={() => {
                            const id = states.length;
                            setStates(p => [...p, { id, x: 0.3 + Math.random() * 0.4, y: 0.3 + Math.random() * 0.4, label: `q${id}`, isAccept: false }]);
                        }}>+ State</button>
                    </div>
                </div>

                {testResult && (
                    <div style={{ padding: '8px 16px', background: testResult.accepted ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', borderRadius: 'var(--radius-sm)', marginBottom: 12, fontSize: '0.9rem', fontWeight: 700, color: testResult.accepted ? '#22c55e' : '#ef4444', border: `1px solid ${testResult.accepted ? '#22c55e' : '#ef4444'}30` }}>
                        {testResult.accepted ? '✓ Accepted' : '✗ Rejected'} — Path: {testResult.path.map(id => states.find(s => s.id === id)?.label ?? id).join(' → ')}
                    </div>
                )}

                <div style={{ width: '100%', aspectRatio: '16/9', background: 'var(--bg-primary)', border: '1px solid var(--border-warm)', borderRadius: 'var(--radius-md)', overflow: 'hidden', cursor: 'grab' }}
                    onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
                    <canvas ref={canvasRef} style={{ display: 'block' }} />
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: 8 }}>Drag states to rearrange. Double-circle = accept state.</p>
            </div>
        </div>
    );
}
