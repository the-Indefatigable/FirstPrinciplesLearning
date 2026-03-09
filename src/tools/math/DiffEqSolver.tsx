import { useState, useRef, useEffect, useCallback } from 'react';
import { compile } from 'mathjs';

export default function DiffEqSolver() {
    const [equation, setEquation] = useState("y' = -0.5 * y + sin(t)");
    const [y0, setY0] = useState(1);
    const [tMax, setTMax] = useState(20);
    const [result, setResult] = useState('');
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [solution, setSolution] = useState<{ t: number; y: number }[]>([]);

    const solve = useCallback(() => {
        try {
            // Parse RHS: expects format "y' = f(t, y)"
            const rhs = equation.replace(/y'\s*=\s*/, '').trim();
            const compiled = compile(rhs);

            // RK4
            const dt = 0.02;
            const points: { t: number; y: number }[] = [{ t: 0, y: y0 }];
            let y = y0;
            let t = 0;

            while (t < tMax) {
                const scope = { t, y };
                const k1 = compiled.evaluate(scope) as number;
                const k2 = compiled.evaluate({ t: t + dt / 2, y: y + (dt / 2) * k1 }) as number;
                const k3 = compiled.evaluate({ t: t + dt / 2, y: y + (dt / 2) * k2 }) as number;
                const k4 = compiled.evaluate({ t: t + dt, y: y + dt * k3 }) as number;

                y = y + (dt / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
                t += dt;

                if (!isFinite(y)) break;
                points.push({ t, y });
            }

            setSolution(points);
            setResult(`Solved using RK4 (dt = ${dt})\nInitial: y(0) = ${y0}\nFinal: y(${tMax.toFixed(1)}) ≈ ${points[points.length - 1].y.toFixed(6)}\nPoints: ${points.length}`);
        } catch (e: unknown) {
            setResult(`Error: ${e instanceof Error ? e.message : 'Invalid equation'}`);
            setSolution([]);
        }
    }, [equation, y0, tMax]);

    // Draw solution
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || solution.length === 0) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = canvas.parentElement!.clientWidth;
        canvas.height = Math.min(canvas.parentElement!.clientWidth, 500);
        const W = canvas.width;
        const H = canvas.height;
        const pad = 48;

        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        ctx.fillStyle = isDark ? '#141210' : '#faf8f5';
        ctx.fillRect(0, 0, W, H);

        const tMin = solution[0].t;
        const tMaxVal = solution[solution.length - 1].t;
        const yVals = solution.map(p => p.y);
        const yMin = Math.min(...yVals);
        const yMax = Math.max(...yVals);
        const yRange = yMax - yMin || 1;

        const toX = (t: number) => pad + ((t - tMin) / (tMaxVal - tMin)) * (W - 2 * pad);
        const toY = (y: number) => H - pad - ((y - yMin + yRange * 0.1) / (yRange * 1.2)) * (H - 2 * pad);

        // Grid
        ctx.strokeStyle = isDark ? '#2e2a24' : '#e8e0d4';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 5; i++) {
            const y = pad + (i / 5) * (H - 2 * pad);
            ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W - pad, y); ctx.stroke();
        }

        // Axis labels
        ctx.fillStyle = isDark ? '#6b6358' : '#9c9488';
        ctx.font = '10px Sora, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('t', W - 20, H - pad + 4);
        ctx.textAlign = 'right';
        ctx.fillText('y(t)', pad - 8, pad - 8);

        // Plot
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        solution.forEach((p, i) => {
            const px = toX(p.t);
            const py = toY(p.y);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        });
        ctx.stroke();

        // Start dot
        ctx.fillStyle = '#d97706';
        ctx.beginPath();
        ctx.arc(toX(solution[0].t), toY(solution[0].y), 4, 0, Math.PI * 2);
        ctx.fill();
    }, [solution]);

    return (
        <div className="tool-card">
            <div className="tool-card-header">
                <h3>Differential Equation Solver</h3>
            </div>
            <div className="tool-card-body">
                <div className="tool-input-group">
                    <label>Equation (y' = f(t, y))</label>
                    <input
                        className="tool-input"
                        value={equation}
                        onChange={(e) => setEquation(e.target.value)}
                        placeholder="y' = -0.5 * y + sin(t)"
                    />
                </div>
                <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                    <div className="tool-input-group" style={{ flex: 1 }}>
                        <label>y(0)</label>
                        <input className="tool-input" type="number" value={y0} onChange={(e) => setY0(parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="tool-input-group" style={{ flex: 1 }}>
                        <label>t max</label>
                        <input className="tool-input" type="number" value={tMax} onChange={(e) => setTMax(parseFloat(e.target.value) || 10)} />
                    </div>
                </div>
                <div style={{ marginBottom: 20 }}>
                    <button className="tool-btn" onClick={solve}>Solve (RK4) →</button>
                </div>
                {solution.length > 0 && (
                    <div className="canvas-container" style={{ marginBottom: 16 }}>
                        <canvas ref={canvasRef} />
                    </div>
                )}
                {result && <div className="tool-result">{result}</div>}
            </div>
        </div>
    );
}
