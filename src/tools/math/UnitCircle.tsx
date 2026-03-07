import React, { useState, useRef, useEffect } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';

export default function UnitCircle() {
    const [angle, setAngle] = useState(Math.PI / 4); // 45 degrees
    const [isDragging, setIsDragging] = useState(false);
    const circleRef = useRef<SVGSVGElement>(null);

    // Coordinate system parameters
    const size = 240;
    const center = size / 2;
    const radius = size * 0.35; // leaves room for labels

    // Calculate Cartesian coordinates of the point on the circle
    const pointX = center + radius * Math.cos(angle);
    const pointY = center - radius * Math.sin(angle); // Subtract because SVG Y goes down

    // Mouse interactions
    const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
        setIsDragging(true);
        updateAngleFromEvent(e);
    };

    const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDragging) return;
        updateAngleFromEvent(e);
    };

    const handlePointerUp = () => {
        setIsDragging(false);
    };

    useEffect(() => {
        window.addEventListener('mouseup', handlePointerUp);
        window.addEventListener('touchend', handlePointerUp);
        return () => {
            window.removeEventListener('mouseup', handlePointerUp);
            window.removeEventListener('touchend', handlePointerUp);
        };
    }, []);

    const updateAngleFromEvent = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
        if (!circleRef.current) return;
        const rect = circleRef.current.getBoundingClientRect();

        let clientX, clientY;
        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = (e as ReactMouseEvent).clientX;
            clientY = (e as ReactMouseEvent).clientY;
        }

        const x = clientX - rect.left - center;
        const y = -(clientY - rect.top - center); // Invert Y so up is positive

        let newAngle = Math.atan2(y, x);
        if (newAngle < 0) newAngle += 2 * Math.PI; // Keep bounded 0 to 2PI
        setAngle(newAngle);
    };

    // Derived values for display
    const deg = (angle * 180 / Math.PI).toFixed(1);
    const cosVal = Math.cos(angle).toFixed(3);
    const sinVal = Math.sin(angle).toFixed(3);

    return (
        <div className="tool-card unit-circle">
            <div className="tool-card-header">
                <h3>Unit Circle & Trigonometry</h3>
                <span className="subject-topic" style={{ background: 'var(--sage-glow)', color: 'var(--sage)' }}>Trigonometry</span>
            </div>

            <div className="tool-card-body">
                <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.95rem' }}>
                    Drag the point around the circle to see how <strong style={{ color: 'var(--terracotta)' }}>Sine (y-height)</strong> and <strong style={{ color: 'var(--amber)' }}>Cosine (x-width)</strong> relate to the angle θ.
                </p>

                <div className="tool-layout-2col">
                    {/* Circle View */}
                    <div
                        style={{
                            background: 'var(--bg-secondary)',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border-warm)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '20px'
                        }}
                    >
                        <svg
                            ref={circleRef}
                            width={size}
                            height={size}
                            style={{ touchAction: 'none', cursor: isDragging ? 'grabbing' : 'grab' }}
                            onMouseDown={handlePointerDown}
                            onMouseMove={handlePointerMove}
                            onTouchStart={handlePointerDown}
                            onTouchMove={handlePointerMove}
                        >
                            {/* Axes */}
                            <line x1={0} y1={center} x2={size} y2={center} stroke="var(--border-warm)" strokeWidth={2} />
                            <line x1={center} y1={0} x2={center} y2={size} stroke="var(--border-warm)" strokeWidth={2} />

                            {/* Circle */}
                            <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--text-dim)" strokeWidth={2} strokeDasharray="4 4" />

                            {/* Angle Wedge */}
                            <path
                                d={`M ${center} ${center} L ${center + radius * 0.25} ${center} A ${radius * 0.25} ${radius * 0.25} 0 ${angle > Math.PI ? 1 : 0} 0 ${center + radius * 0.25 * Math.cos(angle)} ${center - radius * 0.25 * Math.sin(angle)} Z`}
                                fill="var(--sage-glow)"
                            />

                            {/* Cosine Line (X) */}
                            <line x1={center} y1={center} x2={pointX} y2={center} stroke="var(--amber)" strokeWidth={4} />
                            {/* Sine Line (Y) */}
                            <line x1={pointX} y1={center} x2={pointX} y2={pointY} stroke="var(--terracotta)" strokeWidth={4} />
                            {/* Hypotenuse */}
                            <line x1={center} y1={center} x2={pointX} y2={pointY} stroke="var(--text-secondary)" strokeWidth={2} />

                            {/* Draggable Point */}
                            <circle cx={pointX} cy={pointY} r={8} fill="var(--bg-card)" stroke="var(--text-primary)" strokeWidth={3} />
                        </svg>
                    </div>

                    {/* Dashboard View */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                        {/* Values Card */}
                        <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-warm)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '1px' }}>Angle θ</div>
                                <div style={{ fontSize: '1.2rem', fontFamily: 'var(--font-serif)' }}>{deg}° / {(angle / Math.PI).toFixed(2)}π rad</div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', color: 'var(--amber)' }}>
                                <div style={{ fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '1px' }}>cos(θ)</div>
                                <div style={{ fontSize: '1.2rem', fontFamily: 'var(--font-serif)' }}>{cosVal}</div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--terracotta)' }}>
                                <div style={{ fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '1px' }}>sin(θ)</div>
                                <div style={{ fontSize: '1.2rem', fontFamily: 'var(--font-serif)' }}>{sinVal}</div>
                            </div>
                        </div>

                        {/* Wave Graph Mini */}
                        <div style={{ flex: 1, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-warm)', position: 'relative', overflow: 'hidden' }}>
                            <svg width="100%" height="100%" viewBox="0 0 400 200" preserveAspectRatio="none">
                                {/* Axes */}
                                <line x1={0} y1={100} x2={400} y2={100} stroke="var(--border-warm)" strokeWidth={2} />

                                {/* Sine Wave Static */}
                                <path
                                    d={`M 0 100 ${Array.from({ length: 400 }).map((_, i) => `L ${i} ${100 - Math.sin((i / 400) * 2 * Math.PI) * 60}`).join(' ')}`}
                                    fill="none" stroke="rgba(232, 149, 111, 0.4)" strokeWidth={3}
                                />

                                {/* Cosine Wave Static */}
                                <path
                                    d={`M 0 ${100 - 60} ${Array.from({ length: 400 }).map((_, i) => `L ${i} ${100 - Math.cos((i / 400) * 2 * Math.PI) * 60}`).join(' ')}`}
                                    fill="none" stroke="rgba(245, 158, 11, 0.4)" strokeWidth={3}
                                />

                                {/* Moving Indicators */}
                                <line x1={(angle / (2 * Math.PI)) * 400} y1={0} x2={(angle / (2 * Math.PI)) * 400} y2={200} stroke="var(--text-primary)" strokeWidth={1} strokeDasharray="4 4" />
                                <circle cx={(angle / (2 * Math.PI)) * 400} cy={100 - Math.sin(angle) * 60} r={5} fill="var(--terracotta)" />
                                <circle cx={(angle / (2 * Math.PI)) * 400} cy={100 - Math.cos(angle) * 60} r={5} fill="var(--amber)" />
                            </svg>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}
