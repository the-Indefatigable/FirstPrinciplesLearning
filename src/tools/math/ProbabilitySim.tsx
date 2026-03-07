import { useState, useCallback } from 'react';

type Experiment = 'coin' | 'dice' | 'custom';

export default function ProbabilitySim() {
    const [experiment, setExperiment] = useState<Experiment>('dice');
    const [trials, setTrials] = useState(100);
    const [results, setResults] = useState<number[]>([]);
    const [isRunning, setIsRunning] = useState(false);

    const outcomes: Record<Experiment, { labels: string[]; theoretical: number[] }> = {
        coin: { labels: ['Heads', 'Tails'], theoretical: [0.5, 0.5] },
        dice: { labels: ['1', '2', '3', '4', '5', '6'], theoretical: [1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6] },
        custom: { labels: ['A', 'B', 'C', 'D'], theoretical: [0.1, 0.2, 0.3, 0.4] },
    };

    const runSim = useCallback(async () => {
        setIsRunning(true);
        const { labels } = outcomes[experiment];
        const counts = new Array(labels.length).fill(0);
        const batchSize = Math.max(1, Math.floor(trials / 50));

        for (let i = 0; i < trials; i++) {
            const outcome = Math.floor(Math.random() * labels.length);
            counts[outcome]++;
            if (i % batchSize === 0 || i === trials - 1) {
                setResults([...counts]);
                await new Promise(r => setTimeout(r, 10));
            }
        }
        setIsRunning(false);
    }, [experiment, trials]);

    const { labels, theoretical } = outcomes[experiment];
    const maxCount = Math.max(...results, 1);

    return (
        <div className="tool-card">
            <div className="tool-card-header">
                <h3>Probability Simulator</h3>
                <span className="subject-topic" style={{ background: 'var(--amber-soft)', color: 'var(--amber)' }}>Statistics</span>
            </div>
            <div className="tool-card-body">
                <div className="tool-controls-row tool-controls-row--3">
                    <div className="tool-input-group">
                        <label>Experiment</label>
                        <select className="tool-input" value={experiment} onChange={e => { setExperiment(e.target.value as Experiment); setResults([]); }}>
                            <option value="coin">Coin Flip</option>
                            <option value="dice">Dice Roll</option>
                            <option value="custom">Weighted (10/20/30/40%)</option>
                        </select>
                    </div>
                    <div className="tool-input-group">
                        <label>Number of Trials</label>
                        <input className="tool-input" type="number" min={1} max={10000} value={trials} onChange={e => setTrials(+e.target.value)} />
                    </div>
                    <div className="tool-input-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                        <button className="tool-btn" onClick={runSim} disabled={isRunning} style={{ width: '100%' }}>
                            {isRunning ? 'Running...' : `Run ${trials} Trials`}
                        </button>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
                    {labels.map((label, i) => {
                        const count = results[i] || 0;
                        const total = results.reduce((s, c) => s + c, 0) || 1;
                        const pct = ((count / total) * 100).toFixed(1);
                        const thPct = (theoretical[i] * 100).toFixed(1);
                        const barH = maxCount > 0 ? (count / maxCount) * 130 : 0;

                        return (
                            <div key={label} style={{ flex: 1, minWidth: 50, textAlign: 'center' }}>
                                <div style={{ height: 150, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center' }}>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: 3, fontFamily: 'monospace' }}>
                                        {count > 0 ? `${pct}%` : '—'}
                                    </div>
                                    <div style={{
                                        width: '65%', height: barH, minHeight: 2,
                                        background: `linear-gradient(to top, var(--amber), var(--amber-light))`,
                                        borderRadius: '4px 4px 0 0',
                                        transition: 'height 0.15s ease-out',
                                        position: 'relative',
                                    }}>
                                        {/* Theoretical line */}
                                        <div style={{
                                            position: 'absolute', left: -4, right: -4,
                                            bottom: maxCount > 0 ? (theoretical[i] * total / maxCount) * 130 - barH : 0,
                                            height: 2, background: 'var(--sage)',
                                            borderRadius: 1, opacity: count > 0 ? 1 : 0
                                        }} />
                                    </div>
                                </div>
                                <div style={{
                                    borderTop: '1px solid var(--border-warm)', padding: '8px 0',
                                    fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)'
                                }}>
                                    {label}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                                    Expected: {thPct}%
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
