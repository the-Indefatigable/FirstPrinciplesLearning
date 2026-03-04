import React, { useRef, useState, useEffect } from 'react';

type ComponentType = 'battery' | 'resistor' | 'bulb' | 'wire';

interface CircuitElement {
    id: string;
    type: ComponentType;
    x: number;
    y: number;
    rotation: number; // 0, 90, 180, 270 degrees
    value?: number; // Voltage or Resistance
}

export default function CircuitBuilder() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [elements, setElements] = useState<CircuitElement[]>([
        { id: '1', type: 'battery', x: 200, y: 300, rotation: 0, value: 9 },
        { id: '2', type: 'wire', x: 200, y: 200, rotation: 90 },
        { id: '3', type: 'bulb', x: 400, y: 200, rotation: 0, value: 50 },
        { id: '4', type: 'wire', x: 400, y: 300, rotation: 90 }
    ]);
    const [draggingId, setDraggingId] = useState<string | null>(null);

    const [isDarkMode, setIsDarkMode] = useState(false);

    useEffect(() => {
        const el = document.documentElement;
        setIsDarkMode(el.getAttribute('data-theme') === 'dark');
        const obs = new MutationObserver(() => setIsDarkMode(el.getAttribute('data-theme') === 'dark'));
        obs.observe(el, { attributes: true, attributeFilter: ['data-theme'] });
        return () => obs.disconnect();
    }, []);

    // Draw Loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Setup resize handling & HDPI
        const resize = () => {
            const rect = canvas.parentElement?.getBoundingClientRect();
            if (!rect) return;
            canvas.width = rect.width * window.devicePixelRatio;
            canvas.height = rect.height * window.devicePixelRatio;
            ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
            canvas.style.width = `${rect.width}px`;
            canvas.style.height = `${rect.height}px`;
        };
        resize();

        const gridColor = isDarkMode ? '#242018' : '#e8e0d2';
        const componentColor = isDarkMode ? '#e8e4de' : '#1a1612';

        ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

        // Draw grid dots
        ctx.fillStyle = gridColor;
        for (let i = 0; i < canvas.clientWidth; i += 50) {
            for (let j = 0; j < canvas.clientHeight; j += 50) {
                ctx.beginPath();
                ctx.arc(i, j, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Draw Elements
        elements.forEach(el => {
            ctx.save();
            ctx.translate(el.x, el.y);
            // Snap to 50px grid for dragging visually
            ctx.rotate((el.rotation * Math.PI) / 180);

            ctx.strokeStyle = componentColor;
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            if (el.type === 'wire') {
                ctx.beginPath();
                ctx.moveTo(-50, 0);
                ctx.lineTo(50, 0);
                ctx.stroke();
            } else if (el.type === 'battery') {
                // Wires to terminals
                ctx.beginPath();
                ctx.moveTo(-50, 0); ctx.lineTo(-15, 0);
                ctx.moveTo(15, 0); ctx.lineTo(50, 0);
                ctx.stroke();

                // Long plate (+)
                ctx.beginPath(); ctx.moveTo(15, -20); ctx.lineTo(15, 20); ctx.stroke();
                // Short plate (-)
                ctx.lineWidth = 6;
                ctx.beginPath(); ctx.moveTo(-15, -10); ctx.lineTo(-15, 10); ctx.stroke();

                // Label
                ctx.fillStyle = isDarkMode ? '#f59e0b' : '#d97706'; // Amber target
                ctx.font = 'bold 16px Sora';
                ctx.textAlign = 'center';
                ctx.fillText(`${el.value}V`, 0, -30);

            } else if (el.type === 'bulb') {
                // Wires to terminals
                ctx.beginPath();
                ctx.moveTo(-50, 0); ctx.lineTo(-20, 0);
                ctx.moveTo(20, 0); ctx.lineTo(50, 0);
                ctx.stroke();

                // Bulb circle
                ctx.beginPath();
                ctx.arc(0, 0, 20, 0, Math.PI * 2);
                ctx.stroke();

                // Filament (cross)
                ctx.beginPath();
                ctx.moveTo(-10, -10); ctx.lineTo(10, 10);
                ctx.moveTo(10, -10); ctx.lineTo(-10, 10);
                ctx.stroke();

                // Add glow for active state if connected (fake for now)
                // We will add logic solver later, for now just visually pleasing
                const gradient = ctx.createRadialGradient(0, 0, 5, 0, 0, 40);
                gradient.addColorStop(0, 'rgba(245, 158, 11, 0.4)');
                gradient.addColorStop(1, 'rgba(245, 158, 11, 0)');
                ctx.fillStyle = gradient;
                ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI * 2); ctx.fill();
            } else if (el.type === 'resistor') {
                // Wires to terminals
                ctx.beginPath();
                ctx.moveTo(-50, 0); ctx.lineTo(-30, 0);
                ctx.lineTo(-20, -15);
                ctx.lineTo(-10, 15);
                ctx.lineTo(0, -15);
                ctx.lineTo(10, 15);
                ctx.lineTo(20, -15);
                ctx.lineTo(30, 0);
                ctx.lineTo(50, 0);
                ctx.stroke();

                ctx.fillStyle = isDarkMode ? '#10b981' : '#059669'; // Emerald target
                ctx.font = 'bold 14px Sora';
                ctx.textAlign = 'center';
                ctx.fillText(`${el.value}Ω`, 0, 30);
            }

            // Draw selection / drag handle indicator
            if (draggingId === el.id) {
                ctx.strokeStyle = 'var(--sage)';
                ctx.lineWidth = 1;
                ctx.setLineDash([4, 4]);
                ctx.strokeRect(-55, -35, 110, 70);
            }

            ctx.restore();
        });

    }, [elements, isDarkMode, draggingId]);

    // Drag Math
    const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

        const x = clientX - rect.left;
        const y = clientY - rect.top;

        for (let i = elements.length - 1; i >= 0; i--) {
            const el = elements[i];
            const dx = x - el.x;
            const dy = y - el.y;
            if (Math.sqrt(dx * dx + dy * dy) < 40) {
                setDraggingId(el.id);
                return;
            }
        }
    };

    const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!draggingId || !canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

        const rawX = clientX - rect.left;
        const rawY = clientY - rect.top;

        // Snap to grid
        const snapX = Math.round(rawX / 50) * 50;
        const snapY = Math.round(rawY / 50) * 50;

        setElements(prev => prev.map(el =>
            el.id === draggingId ? { ...el, x: snapX, y: snapY } : el
        ));
    };

    const handlePointerUp = () => {
        setDraggingId(null);
    };

    const handleRotate = () => {
        if (!draggingId) return;
        setElements(prev => prev.map(el =>
            el.id === draggingId ? { ...el, rotation: (el.rotation + 90) % 360 } : el
        ));
    };

    useEffect(() => {
        window.addEventListener('mouseup', handlePointerUp);
        window.addEventListener('touchend', handlePointerUp);
        return () => {
            window.removeEventListener('mouseup', handlePointerUp);
            window.removeEventListener('touchend', handlePointerUp);
        };
    }, []);

    // Hotkey for rotation while holding
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.key === 'r' || e.key === 'R') && draggingId) {
                handleRotate();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [draggingId]);

    const addElement = (type: ComponentType, value?: number) => {
        setElements([
            ...elements,
            { id: Date.now().toString(), type, x: 200, y: 150, rotation: 0, value }
        ]);
    };

    return (
        <div className="tool-card circuit-builder">
            <div className="tool-card-header">
                <h3>Circuit Builder Lab</h3>
                <span className="subject-topic" style={{ background: 'var(--amber-soft)', color: 'var(--amber)' }}>Electromagnetism</span>
            </div>

            <div className="tool-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <button className="tool-btn--outline" onClick={() => addElement('battery', 9)}>+ Battery (9V)</button>
                    <button className="tool-btn--outline" onClick={() => addElement('bulb', 50)}>+ Light Bulb</button>
                    <button className="tool-btn--outline" onClick={() => addElement('resistor', 100)}>+ Resistor (100Ω)</button>
                    <button className="tool-btn--outline" onClick={() => addElement('wire')}>+ Wire</button>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginLeft: '12px' }}>Pick up an item and press <strong>R</strong> to rotate.</span>
                </div>

                <div
                    className="canvas-container"
                    style={{
                        width: '100%',
                        height: '600px',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-warm)',
                        borderRadius: 'var(--radius-md)',
                        overflow: 'hidden',
                        position: 'relative',
                        boxShadow: 'inset 0 0 20px rgba(0,0,0,0.02)'
                    }}
                >
                    <canvas
                        ref={canvasRef}
                        style={{ display: 'block', touchAction: 'none', cursor: draggingId ? 'grabbing' : 'grab' }}
                        onMouseDown={handlePointerDown}
                        onMouseMove={handlePointerMove}
                        onTouchStart={handlePointerDown}
                        onTouchMove={handlePointerMove}
                    />
                </div>
            </div>
        </div>
    );
}
