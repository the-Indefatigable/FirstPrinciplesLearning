import { useRef, useEffect, useState, useCallback } from 'react';

/* ═══════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════ */
interface Node {
    id: string;
    label: string;
    x: number;
    y: number;
    icon: string;
    color: string;
}

interface Packet {
    id: number;
    from: string;
    to: string;
    label: string;
    color: string;
    progress: number;     // 0→1
    speed: number;
    size: number;
    dropped?: boolean;
    ack?: boolean;
}

interface LogEntry {
    time: number;
    text: string;
    color: string;
}

type Protocol = 'tcp' | 'udp';
type Scenario = 'handshake' | 'data' | 'loss';

/* ═══════════════════════════════════════════════════════════════════════
   TOPOLOGY
   ═══════════════════════════════════════════════════════════════════════ */
const NODES: Node[] = [
    { id: 'client', label: 'Client', x: 0.12, y: 0.5, icon: '💻', color: '#3b82f6' },
    { id: 'router1', label: 'Router A', x: 0.38, y: 0.3, icon: '🔀', color: '#f59e0b' },
    { id: 'router2', label: 'Router B', x: 0.62, y: 0.7, icon: '🔀', color: '#f59e0b' },
    { id: 'server', label: 'Server', x: 0.88, y: 0.5, icon: '🖥️', color: '#22c55e' },
];

const LINKS: [string, string][] = [
    ['client', 'router1'],
    ['client', 'router2'],
    ['router1', 'router2'],
    ['router1', 'server'],
    ['router2', 'server'],
];

/* ═══════════════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════════════ */
export default function PacketSimulator() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animRef = useRef<number>(0);
    const packetsRef = useRef<Packet[]>([]);
    const logRef = useRef<LogEntry[]>([]);
    const stepRef = useRef(0);
    const timerRef = useRef(0);
    const pidRef = useRef(0);

    const [protocol, setProtocol] = useState<Protocol>('tcp');
    const [scenario, setScenario] = useState<Scenario>('handshake');
    const [packetLoss, setPacketLoss] = useState(0);
    const [speed, setSpeed] = useState(1);
    const [running, setRunning] = useState(false);
    const [log, setLog] = useState<LogEntry[]>([]);
    const runRef = useRef(false);

    const addLog = useCallback((text: string, color = '#9c9488') => {
        const entry = { time: Date.now(), text, color };
        logRef.current = [...logRef.current.slice(-30), entry];
        setLog([...logRef.current]);
    }, []);

    const emit = useCallback((from: string, to: string, label: string, color: string, ack = false) => {
        const drop = Math.random() * 100 < packetLoss;
        const pkt: Packet = {
            id: pidRef.current++,
            from, to, label, color,
            progress: 0,
            speed: (0.008 + Math.random() * 0.004) * speed,
            size: 6 + label.length * 0.8,
            dropped: drop,
            ack,
        };
        packetsRef.current = [...packetsRef.current, pkt];
        if (drop) addLog(`✖ ${label} dropped! (${from} → ${to})`, '#ef4444');
        else addLog(`→ ${label} (${from} → ${to})`, color);
    }, [packetLoss, speed, addLog]);

    /* ── Scenarios ── */
    const runScenario = useCallback(() => {
        packetsRef.current = [];
        logRef.current = [];
        setLog([]);
        stepRef.current = 0;
        timerRef.current = 0;
        runRef.current = true;
        setRunning(true);
    }, []);

    const stopSim = useCallback(() => {
        runRef.current = false;
        setRunning(false);
    }, []);

    /* ── Animation ── */
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const resize = () => {
            const rect = canvas.parentElement?.getBoundingClientRect();
            if (!rect) return;
            const dpr = window.devicePixelRatio;
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            ctx.scale(dpr, dpr);
            canvas.style.width = `${rect.width}px`;
            canvas.style.height = `${rect.height}px`;
        };
        resize();

        const getNode = (id: string) => NODES.find(n => n.id === id)!;

        const draw = () => {
            const rect = canvas.parentElement?.getBoundingClientRect();
            if (!rect) { animRef.current = requestAnimationFrame(draw); return; }
            const W = rect.width, H = rect.height;
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

            ctx.clearRect(0, 0, W, H);

            // ── Draw links ──
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = isDark ? '#3d3530' : '#d4cec6';
            for (const [a, b] of LINKS) {
                const na = getNode(a), nb = getNode(b);
                ctx.beginPath();
                ctx.moveTo(na.x * W, na.y * H);
                ctx.lineTo(nb.x * W, nb.y * H);
                ctx.stroke();
            }
            ctx.setLineDash([]);

            // ── Draw nodes ──
            for (const node of NODES) {
                const nx = node.x * W, ny = node.y * H;

                // Glow
                ctx.beginPath();
                ctx.arc(nx, ny, 28, 0, Math.PI * 2);
                ctx.fillStyle = isDark ? 'rgba(26,22,18,0.7)' : 'rgba(255,255,255,0.8)';
                ctx.fill();
                ctx.strokeStyle = node.color + '50';
                ctx.lineWidth = 2;
                ctx.stroke();

                // Icon
                ctx.font = '18px serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(node.icon, nx, ny - 2);

                // Label
                ctx.font = 'bold 9px Sora, sans-serif';
                ctx.fillStyle = isDark ? '#c8c0b4' : '#4a4540';
                ctx.fillText(node.label, nx, ny + 22);
            }

            // ── Animate packets ──
            const alive: Packet[] = [];
            for (const pkt of packetsRef.current) {
                pkt.progress += pkt.speed;

                if (pkt.progress >= 1) {
                    if (!pkt.dropped) {
                        // Packet arrived
                    }
                    continue; // remove from list
                }

                if (pkt.dropped && pkt.progress > 0.5) {
                    // Draw X at drop point
                    const na = getNode(pkt.from), nb = getNode(pkt.to);
                    const dx = na.x * W + (nb.x * W - na.x * W) * 0.5;
                    const dy = na.y * H + (nb.y * H - na.y * H) * 0.5;
                    ctx.font = 'bold 14px Sora';
                    ctx.fillStyle = '#ef4444';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('✖', dx, dy - 12);
                    continue;
                }

                alive.push(pkt);

                const na = getNode(pkt.from), nb = getNode(pkt.to);
                const px = na.x * W + (nb.x * W - na.x * W) * pkt.progress;
                const py = na.y * H + (nb.y * H - na.y * H) * pkt.progress;

                // Packet body
                const pw = 28 + pkt.label.length * 4.5;
                const ph = 16;
                ctx.fillStyle = pkt.color;
                ctx.globalAlpha = 0.9;
                ctx.beginPath();
                ctx.roundRect(px - pw / 2, py - ph / 2, pw, ph, 4);
                ctx.fill();
                ctx.globalAlpha = 1;

                // Packet label
                ctx.font = 'bold 8px Sora, monospace';
                ctx.fillStyle = '#fff';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(pkt.label, px, py);
            }
            packetsRef.current = alive;

            // ── Step through scenario ──
            if (runRef.current) {
                timerRef.current += 1;
                const interval = Math.floor(60 / speed);

                if (timerRef.current % interval === 0) {
                    const step = stepRef.current++;
                    if (protocol === 'tcp') {
                        if (scenario === 'handshake') runTCPHandshake(step);
                        else if (scenario === 'data') runTCPData(step);
                        else if (scenario === 'loss') runTCPLoss(step);
                    } else {
                        if (scenario === 'data') runUDPData(step);
                        else runUDPData(step);
                    }
                }
            }

            animRef.current = requestAnimationFrame(draw);
        };

        // ── TCP Handshake ──
        const runTCPHandshake = (step: number) => {
            switch (step) {
                case 0: emit('client', 'router1', 'SYN', '#3b82f6'); break;
                case 1: emit('router1', 'server', 'SYN', '#3b82f6'); break;
                case 2: emit('server', 'router1', 'SYN-ACK', '#22c55e', true); break;
                case 3: emit('router1', 'client', 'SYN-ACK', '#22c55e', true); break;
                case 4: emit('client', 'router1', 'ACK', '#3b82f6'); break;
                case 5: emit('router1', 'server', 'ACK', '#3b82f6'); break;
                case 6:
                    addLog('✓ TCP connection established!', '#22c55e');
                    runRef.current = false;
                    setRunning(false);
                    break;
            }
        };

        // ── TCP Data Transfer ──
        const runTCPData = (step: number) => {
            const route1 = ['client', 'router1'] as const;
            const route2 = ['router1', 'server'] as const;
            const route3 = ['server', 'router2'] as const;
            const route4 = ['router2', 'client'] as const;

            if (step < 3) {
                // Handshake first
                runTCPHandshake(step * 2);
            } else {
                const dataStep = step - 3;
                const seqNum = dataStep + 1;
                if (dataStep < 8) {
                    if (dataStep % 2 === 0) {
                        emit(route1[0], route1[1], `DATA #${seqNum}`, '#8b5cf6');
                        setTimeout(() => emit(route2[0], route2[1], `DATA #${seqNum}`, '#8b5cf6'), 300);
                    } else {
                        emit(route3[0], route3[1], `ACK #${seqNum - 1}`, '#22c55e', true);
                        setTimeout(() => emit(route4[0], route4[1], `ACK #${seqNum - 1}`, '#22c55e', true), 300);
                    }
                } else {
                    // FIN
                    if (dataStep === 8) emit('client', 'router1', 'FIN', '#ef4444');
                    else if (dataStep === 9) emit('router1', 'server', 'FIN', '#ef4444');
                    else if (dataStep === 10) { emit('server', 'router1', 'FIN-ACK', '#22c55e', true); }
                    else if (dataStep === 11) { emit('router1', 'client', 'FIN-ACK', '#22c55e', true); }
                    else {
                        addLog('✓ Connection closed (4-way FIN)', '#22c55e');
                        runRef.current = false; setRunning(false);
                    }
                }
            }
        };

        // ── TCP with Loss & Retransmit ──
        const runTCPLoss = (step: number) => {
            switch (step) {
                case 0: emit('client', 'router1', 'SYN', '#3b82f6'); break;
                case 1: emit('router1', 'server', 'SYN', '#3b82f6'); break;
                case 2: emit('server', 'router1', 'SYN-ACK', '#22c55e', true); break;
                case 3: emit('router1', 'client', 'SYN-ACK', '#22c55e', true); break;
                case 4: emit('client', 'router1', 'ACK', '#3b82f6'); break;
                case 5: emit('router1', 'server', 'ACK', '#3b82f6'); break;
                case 6: emit('client', 'router1', 'DATA #1', '#8b5cf6'); break;
                case 7: emit('router1', 'server', 'DATA #1', '#8b5cf6'); break;
                case 8: emit('server', 'router2', 'ACK #1', '#22c55e', true); break;
                case 9: emit('router2', 'client', 'ACK #1', '#22c55e', true); break;
                case 10:
                    // Force drop
                    addLog('→ DATA #2 (client → router1)', '#8b5cf6');
                    const dpkt: Packet = {
                        id: pidRef.current++, from: 'client', to: 'router1',
                        label: 'DATA #2', color: '#8b5cf6', progress: 0,
                        speed: 0.008 * speed, size: 8, dropped: true,
                    };
                    packetsRef.current = [...packetsRef.current, dpkt];
                    addLog('✖ DATA #2 dropped!', '#ef4444');
                    break;
                case 11:
                    addLog('⏱ Timeout — no ACK received', '#f59e0b');
                    break;
                case 12:
                    addLog('🔄 Retransmitting DATA #2...', '#f59e0b');
                    emit('client', 'router1', 'DATA #2 ↻', '#f59e0b');
                    break;
                case 13: emit('router1', 'server', 'DATA #2 ↻', '#f59e0b'); break;
                case 14: emit('server', 'router2', 'ACK #2', '#22c55e', true); break;
                case 15: emit('router2', 'client', 'ACK #2', '#22c55e', true); break;
                case 16:
                    addLog('✓ Retransmission successful!', '#22c55e');
                    runRef.current = false; setRunning(false);
                    break;
            }
        };

        // ── UDP Data ──
        const runUDPData = (step: number) => {
            if (step < 6) {
                const seqNum = step + 1;
                // Alternate routes for visual interest
                if (step % 2 === 0) {
                    emit('client', 'router1', `UDP #${seqNum}`, '#a855f7');
                    setTimeout(() => emit('router1', 'server', `UDP #${seqNum}`, '#a855f7'), 200);
                } else {
                    emit('client', 'router2', `UDP #${seqNum}`, '#a855f7');
                    setTimeout(() => emit('router2', 'server', `UDP #${seqNum}`, '#a855f7'), 200);
                }
            } else {
                addLog('✓ All UDP datagrams sent (no ACK — fire and forget!)', '#a855f7');
                runRef.current = false;
                setRunning(false);
            }
        };

        animRef.current = requestAnimationFrame(draw);
        window.addEventListener('resize', resize);
        return () => {
            cancelAnimationFrame(animRef.current);
            window.removeEventListener('resize', resize);
        };
    }, [protocol, scenario, speed, emit, addLog]);

    return (
        <div className="tool-card">
            <div className="tool-card-header">
                <h3>Network Packet Simulator</h3>
                <span className="subject-topic" style={{ background: 'rgba(194,113,79,0.12)', color: '#c2714f' }}>Networking</span>
            </div>
            <div className="tool-card-body">
                {/* Controls */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 14 }}>
                    {/* Protocol */}
                    <div style={panelStyle}>
                        <label style={labelStyle}>Protocol</label>
                        <div style={{ display: 'flex', gap: 4 }}>
                            {(['tcp', 'udp'] as Protocol[]).map(p => (
                                <button key={p} onClick={() => { setProtocol(p); stopSim(); }}
                                    style={{ ...chipStyle, background: protocol === p ? (p === 'tcp' ? '#3b82f6' : '#a855f7') : 'transparent', color: protocol === p ? '#fff' : 'var(--text-dim)', border: `1px solid ${protocol === p ? 'transparent' : 'var(--border-warm)'}` }}>
                                    {p.toUpperCase()}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Scenario */}
                    <div style={panelStyle}>
                        <label style={labelStyle}>Scenario</label>
                        <select value={scenario} onChange={e => { setScenario(e.target.value as Scenario); stopSim(); }}
                            style={selectStyle}>
                            {protocol === 'tcp' ? (
                                <>
                                    <option value="handshake">3-Way Handshake</option>
                                    <option value="data">Data Transfer</option>
                                    <option value="loss">Packet Loss & Retransmit</option>
                                </>
                            ) : (
                                <option value="data">Fire & Forget</option>
                            )}
                        </select>
                    </div>

                    {/* Speed */}
                    <div style={panelStyle}>
                        <label style={labelStyle}>Speed: {speed}x</label>
                        <input type="range" min={0.5} max={3} step={0.5} value={speed}
                            onChange={e => setSpeed(+e.target.value)}
                            style={{ width: '100%', accentColor: '#d97706' }} />
                    </div>

                    {/* Packet Loss */}
                    <div style={panelStyle}>
                        <label style={labelStyle}>Pkt Loss: {packetLoss}%</label>
                        <input type="range" min={0} max={50} step={5} value={packetLoss}
                            onChange={e => setPacketLoss(+e.target.value)}
                            style={{ width: '100%', accentColor: '#ef4444' }} />
                    </div>
                </div>

                {/* Run / Stop */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                    <button className="btn-primary" onClick={runScenario} disabled={running}
                        style={{ opacity: running ? 0.5 : 1, fontSize: '0.85rem', padding: '8px 20px' }}>
                        ▶ Run Simulation
                    </button>
                    <button onClick={stopSim} disabled={!running}
                        style={{ ...chipStyle, opacity: !running ? 0.4 : 1, border: '1px solid var(--border-warm)', padding: '8px 16px' }}>
                        ⏹ Stop
                    </button>
                </div>

                {/* Canvas */}
                <div style={{ width: '100%', aspectRatio: '16/7', background: 'var(--bg-primary)', border: '1px solid var(--border-warm)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: 14 }}>
                    <canvas ref={canvasRef} style={{ display: 'block' }} />
                </div>

                {/* Packet Log */}
                <div style={{
                    background: 'var(--bg-secondary)', border: '1px solid var(--border-warm)',
                    borderRadius: 'var(--radius-sm)', padding: '10px 14px',
                    maxHeight: 160, overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.78rem',
                }}>
                    <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--text-dim)', fontSize: '0.72rem', letterSpacing: 0.5 }}>PACKET LOG</div>
                    {log.length === 0 ? (
                        <div style={{ color: 'var(--text-dim)' }}>Press "Run Simulation" to start...</div>
                    ) : (
                        log.map((entry, i) => (
                            <div key={i} style={{ color: entry.color, lineHeight: 1.6 }}>{entry.text}</div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

/* ── Inline Styles ── */
const panelStyle: React.CSSProperties = {
    padding: 10, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-warm)',
};
const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 6, fontWeight: 600,
};
const chipStyle: React.CSSProperties = {
    padding: '4px 10px', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem',
    fontWeight: 600, cursor: 'pointer', background: 'transparent', color: 'var(--text-dim)',
    border: '1px solid var(--border-warm)', transition: 'all 0.15s',
};
const selectStyle: React.CSSProperties = {
    width: '100%', padding: '4px 8px', borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-warm)', background: 'var(--bg-primary)',
    color: 'var(--text-primary)', fontSize: '0.82rem', fontFamily: 'inherit',
};
