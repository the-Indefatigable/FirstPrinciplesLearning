import React, { useRef, useState, useEffect } from 'react';

type OpticType = 'laser' | 'mirror' | 'lens_convex' | 'lens_concave' | 'block';

interface OpticElement {
    id: string;
    type: OpticType;
    x: number;
    y: number;
    angle: number; // in radians
    focalLength?: number; // for lenses
    refractiveIndex?: number; // for blocks
}

export default function RayOptics() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [elements, setElements] = useState<OpticElement[]>([
        { id: '1', type: 'laser', x: 100, y: 300, angle: 0 },
        { id: '2', type: 'lens_convex', x: 400, y: 300, angle: Math.PI / 2, focalLength: 150 },
        { id: '3', type: 'mirror', x: 700, y: 300, angle: Math.PI / 4 }
    ]);
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [isDarkMode, setIsDarkMode] = useState(false);

    useEffect(() => {
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        setIsDarkMode(mq.matches);
        const handler = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
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
        const laserColor = '#ec4899'; // Pink/Red laser
        const glassColor = isDarkMode ? 'rgba(156, 163, 175, 0.2)' : 'rgba(107, 114, 128, 0.2)';

        // Clear and draw grid
        ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        for (let i = 0; i < canvas.clientWidth; i += 50) {
            ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.clientHeight); ctx.stroke();
        }
        for (let i = 0; i < canvas.clientHeight; i += 50) {
            ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.clientWidth, i); ctx.stroke();
        }

        // Draw Elements
        elements.forEach(el => {
            ctx.save();
            ctx.translate(el.x, el.y);
            ctx.rotate(el.angle);

            if (el.type === 'laser') {
                ctx.fillStyle = '#333';
                ctx.fillRect(-20, -10, 40, 20);
                ctx.fillStyle = laserColor;
                ctx.fillRect(15, -3, 6, 6);

                // Draw a simple straight line for now for the laser beam
                // We will implement full raycasting next
                ctx.strokeStyle = laserColor;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(20, 0);
                ctx.lineTo(1000, 0);
                ctx.stroke();

            } else if (el.type === 'mirror') {
                ctx.strokeStyle = componentColor;
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.moveTo(-40, 0);
                ctx.lineTo(40, 0);
                ctx.stroke();

                // Hatch marks on the back
                ctx.strokeStyle = '#888';
                ctx.lineWidth = 1;
                for (let x = -35; x <= 35; x += 10) {
                    ctx.beginPath();
                    ctx.moveTo(x, 0);
                    ctx.lineTo(x - 5, 8);
                    ctx.stroke();
                }

            } else if (el.type === 'lens_convex') {
                ctx.fillStyle = glassColor;
                ctx.strokeStyle = componentColor;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(0, -50);
                ctx.quadraticCurveTo(20, 0, 0, 50);
                ctx.quadraticCurveTo(-20, 0, 0, -50);
                ctx.fill();
                ctx.stroke();
            }

            // Draw selection / drag handle indicator
            if (draggingId === el.id) {
                ctx.strokeStyle = 'var(--amber)';
                ctx.lineWidth = 1;
                ctx.setLineDash([4, 4]);
                ctx.strokeRect(-45, -55, 90, 110);
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

        // Check intersection (simple 40px radius circle for now)
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

        const x = clientX - rect.left;
        const y = clientY - rect.top;

        setElements(prev => prev.map(el =>
            el.id === draggingId ? { ...el, x, y } : el
        ));
    };

    const handlePointerUp = () => {
        setDraggingId(null);
    };

    useEffect(() => {
        window.addEventListener('mouseup', handlePointerUp);
        window.addEventListener('touchend', handlePointerUp);
        return () => {
            window.removeEventListener('mouseup', handlePointerUp);
            window.removeEventListener('touchend', handlePointerUp);
        };
    }, []);

    return (
        <div className="tool-card ray-optics">
            <div className="tool-card-header">
                <h3>Ray Optics Lab</h3>
                <span className="subject-topic" style={{ background: 'var(--amber-soft)', color: 'var(--amber)' }}>Physics Engine</span>
            </div>

            <div className="tool-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button className="tool-btn--outline" onClick={() => setElements([...elements, { id: Date.now().toString(), type: 'laser', x: 200, y: 200, angle: 0 }])}>+ Add Laser</button>
                    <button className="tool-btn--outline" onClick={() => setElements([...elements, { id: Date.now().toString(), type: 'mirror', x: 200, y: 200, angle: 0 }])}>+ Add Mirror</button>
                    <button className="tool-btn--outline" onClick={() => setElements([...elements, { id: Date.now().toString(), type: 'lens_convex', x: 200, y: 200, angle: Math.PI / 2, focalLength: 150 }])}>+ Add Convex Lens</button>
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
                        position: 'relative'
                    }}
                >
                    <div style={{ position: 'absolute', top: 16, left: 16, pointerEvents: 'none', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        Drag items to move them around the optical bench.
                    </div>
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
