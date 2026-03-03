import React, { useRef, useState, useEffect } from 'react';

interface Body {
    id: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    mass: number;
    radius: number;
    color: string;
    isStatic: boolean;
    trail: { x: number, y: number }[];
}

const G = 0.5; // Scaled gravitational constant for visuals

export default function OrbitalMechanics() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number>(0);

    // Default state: A large central sun and one orbiting planet
    const [, setBodies] = useState<Body[]>([
        {
            id: 'sun', x: 400, y: 300, vx: 0, vy: 0, mass: 5000, radius: 30, color: '#f59e0b', isStatic: true, trail: []
        },
        {
            id: 'planet1', x: 400, y: 100, vx: 3.5, vy: 0, mass: 10, radius: 8, color: '#3b82f6', isStatic: false, trail: []
        }
    ]);

    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [dragCurrent, setDragCurrent] = useState({ x: 0, y: 0 });

    // Physics Loop
    const updatePhysics = (currentBodies: Body[], dt: number = 1): Body[] => {
        const nextBodies = JSON.parse(JSON.stringify(currentBodies)) as Body[];

        // Calculate gravity forces
        for (let i = 0; i < nextBodies.length; i++) {
            if (nextBodies[i].isStatic) continue;

            let ax = 0;
            let ay = 0;

            for (let j = 0; j < nextBodies.length; j++) {
                if (i === j) continue;
                const b1 = nextBodies[i];
                const b2 = nextBodies[j];

                const dx = b2.x - b1.x;
                const dy = b2.y - b1.y;
                const distSq = dx * dx + dy * dy;
                const dist = Math.sqrt(distSq);

                if (dist < (b1.radius + b2.radius)) {
                    // Collision - simple merge or just bounce. For now, let's just let them pass through 
                    // or ignore gravity if perfectly centered to avoid infinity.
                    if (dist < 1) continue;
                }

                const force = (G * b2.mass) / distSq;
                ax += force * (dx / dist);
                ay += force * (dy / dist);
            }

            nextBodies[i].vx += ax * dt;
            nextBodies[i].vy += ay * dt;
        }

        // Update positions
        for (let i = 0; i < nextBodies.length; i++) {
            if (nextBodies[i].isStatic) continue;
            nextBodies[i].x += nextBodies[i].vx * dt;
            nextBodies[i].y += nextBodies[i].vy * dt;

            // Trail storage
            if (nextBodies[i].trail.length % 5 === 0) {
                nextBodies[i].trail.push({ x: nextBodies[i].x, y: nextBodies[i].y });
            } else {
                // Push dummy to keep counter moving fast without eating memory if we don't render them all
                nextBodies[i].trail.push(null as any);
            }
            if (nextBodies[i].trail.length > 500) {
                nextBodies[i].trail.shift();
            }
        }

        return nextBodies;
    };

    // Render Loop
    const draw = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        setBodies(prev => {
            const next = updatePhysics(prev);

            // Render
            ctx.clearRect(0, 0, canvas.width, canvas.height); // Logical width/height

            // Draw Trails
            next.forEach(b => {
                if (b.trail.length < 2) return;
                ctx.beginPath();
                // Find first valid point
                let started = false;
                for (let i = 0; i < b.trail.length; i++) {
                    if (b.trail[i]) {
                        if (!started) {
                            ctx.moveTo(b.trail[i].x, b.trail[i].y);
                            started = true;
                        } else {
                            ctx.lineTo(b.trail[i].x, b.trail[i].y);
                        }
                    }
                }
                ctx.strokeStyle = `${b.color}40`; // 25% opacity
                ctx.lineWidth = 1.5;
                ctx.stroke();
            });

            // Draw Bodies
            next.forEach(b => {
                ctx.beginPath();
                ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
                ctx.fillStyle = b.color;
                ctx.fill();

                // Glow for sun
                if (b.id === 'sun') {
                    const gradient = ctx.createRadialGradient(b.x, b.y, b.radius, b.x, b.y, b.radius * 2.5);
                    gradient.addColorStop(0, `${b.color}60`);
                    gradient.addColorStop(1, `${b.color}00`);
                    ctx.fillStyle = gradient;
                    ctx.beginPath();
                    ctx.arc(b.x, b.y, b.radius * 2.5, 0, Math.PI * 2);
                    ctx.fill();
                }
            });

            // Draw Drag Vector
            if (isDragging) {
                ctx.beginPath();
                ctx.moveTo(dragStart.x, dragStart.y);
                ctx.lineTo(dragCurrent.x, dragCurrent.y);
                ctx.strokeStyle = 'var(--text-secondary)';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.stroke();
                ctx.setLineDash([]);

                // Ghost planet at start
                ctx.beginPath();
                ctx.arc(dragStart.x, dragStart.y, 6, 0, Math.PI * 2);
                ctx.fillStyle = 'var(--sage)';
                ctx.fill();
            }

            requestRef.current = requestAnimationFrame(draw);
            return next;
        });
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas) {
            const rect = canvas.parentElement?.getBoundingClientRect();
            if (rect) {
                // To keep physics simple, we use 800x600 logical coordinate space, and scale the canvas
                canvas.width = 800; // Logical
                canvas.height = 600; // Logical
                canvas.style.width = '100%';
                canvas.style.height = '100%';
            }
        }

        requestRef.current = requestAnimationFrame(draw);
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [isDragging, dragStart, dragCurrent]); // Re-bind on state changes so closure captures them

    // Interactions
    const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
        if (!canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

        // Map to logical 800x600 space
        const scaleX = 800 / rect.width;
        const scaleY = 600 / rect.height;

        const x = (clientX - rect.left) * scaleX;
        const y = (clientY - rect.top) * scaleY;

        setIsDragging(true);
        setDragStart({ x, y });
        setDragCurrent({ x, y });
    };

    const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDragging || !canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

        const scaleX = 800 / rect.width;
        const scaleY = 600 / rect.height;

        setDragCurrent({
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        });
    };

    const handlePointerUp = () => {
        if (!isDragging) return;
        setIsDragging(false);

        // Calculate initial velocity vector based on drag length and direction
        const dx = dragStart.x - dragCurrent.x;
        const dy = dragStart.y - dragCurrent.y;

        // Scale down the drag to a reasonable velocity
        const velocityScale = 0.05;

        setBodies(prev => [
            ...prev,
            {
                id: `body-${Date.now()}`,
                x: dragStart.x,
                y: dragStart.y,
                vx: dx * velocityScale,
                vy: dy * velocityScale,
                mass: 10,
                radius: 6,
                color: 'var(--sage)',
                isStatic: false,
                trail: []
            }
        ]);
    };

    const resetSim = () => {
        setBodies([
            { id: 'sun', x: 400, y: 300, vx: 0, vy: 0, mass: 5000, radius: 30, color: '#f59e0b', isStatic: true, trail: [] }
        ]);
    };

    return (
        <div className="tool-card orbital-mechanics">
            <div className="tool-card-header">
                <h3>Orbital Gravity Simulator</h3>
                <span className="subject-topic" style={{ background: 'var(--amber-soft)', color: 'var(--amber)' }}>Astrophysics</span>
            </div>

            <div className="tool-card-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
                        <strong>Click and drag</strong> on the canvas to launch a satellite. The length and direction of your drag determines its initial velocity.
                    </p>
                    <button className="tool-btn--outline" onClick={resetSim}>Clear Satellites</button>
                </div>

                <div
                    style={{
                        width: '100%',
                        aspectRatio: '8/6', // matches 800/600 logical size
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-warm)',
                        borderRadius: 'var(--radius-md)',
                        overflow: 'hidden'
                    }}
                >
                    <canvas
                        ref={canvasRef}
                        style={{ display: 'block', touchAction: 'none', cursor: 'crosshair' }}
                        onMouseDown={handlePointerDown}
                        onMouseMove={handlePointerMove}
                        onMouseUp={handlePointerUp}
                        onMouseOut={handlePointerUp}
                        onTouchStart={handlePointerDown}
                        onTouchMove={handlePointerMove}
                        onTouchEnd={handlePointerUp}
                    />
                </div>
            </div>
        </div>
    );
}
