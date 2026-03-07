import { useState } from 'react';

function gcdSteps(a: number, b: number): { a: number; b: number; q: number; r: number }[] {
  const steps: { a: number; b: number; q: number; r: number }[] = [];
  while (b !== 0) {
    const q = Math.floor(a / b);
    const r = a % b;
    steps.push({ a, b, q, r });
    a = b; b = r;
  }
  return steps;
}

function primeFactors(n: number): number[] {
  const factors: number[] = [];
  for (let d = 2; d * d <= n; d++) {
    while (n % d === 0) { factors.push(d); n = Math.floor(n / d); }
  }
  if (n > 1) factors.push(n);
  return factors;
}

export default function NumberTheory() {
  const [a, setA] = useState(48);
  const [b, setB] = useState(18);
  const [modN, setModN] = useState(12);
  const [modA, setModA] = useState(19);
  const [tab, setTab] = useState<'gcd' | 'prime' | 'mod'>('gcd');

  const steps = gcdSteps(a, b);
  const gcdVal = steps.length > 0 ? steps[steps.length - 1].a : a;
  const lcmVal = (a * b) / gcdVal;

  const cx = 110, cy = 110, clockR = 88;
  const angle = (i: number) => (i / modN) * 2 * Math.PI - Math.PI / 2;
  const result = modA % modN;

  return (
    <div className="tool-card">
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['gcd', 'prime', 'mod'] as const).map(t => (
          <button
            key={t}
            className={tab === t ? 'tool-btn tool-btn--amber' : 'tool-btn--outline'}
            onClick={() => setTab(t)}
            style={{ flex: 1 }}
          >
            {t === 'gcd' ? 'GCD / LCM' : t === 'prime' ? 'Prime Factors' : 'Modular Clock'}
          </button>
        ))}
      </div>

      {tab === 'gcd' && (
        <>
          <div className="tool-controls-row">
            <label>a = <strong>{a}</strong></label>
            <input type="range" min={1} max={200} value={a} onChange={e => setA(+e.target.value)} />
            <label>b = <strong>{b}</strong></label>
            <input type="range" min={1} max={200} value={b} onChange={e => setB(+e.target.value)} />
          </div>

          <div style={{ marginTop: 12, padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--accent)', marginBottom: 10, fontFamily: 'monospace' }}>
              Euclidean Algorithm — gcd({a}, {b})
            </div>
            {steps.map((s, i) => (
              <div key={i} style={{
                display: 'flex', gap: 16, padding: '5px 0',
                borderBottom: i < steps.length - 1 ? '1px solid var(--border-warm)' : 'none',
                fontFamily: 'monospace', fontSize: '0.85rem',
              }}>
                <span style={{ color: 'var(--text-dim)', minWidth: 56 }}>Step {i + 1}</span>
                <span>
                  {s.a} = {s.q} × {s.b} + <strong style={{ color: s.r === 0 ? '#22c55e' : '#f59e0b' }}>{s.r}</strong>
                </span>
                {s.r === 0 && <span style={{ color: '#22c55e', marginLeft: 'auto' }}>← done</span>}
              </div>
            ))}
            <div style={{ marginTop: 14, display: 'flex', gap: 32 }}>
              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#22c55e', fontSize: '1rem' }}>
                gcd = {gcdVal}
              </span>
              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#3b82f6', fontSize: '1rem' }}>
                lcm = {lcmVal}
              </span>
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: 6 }}>
              Common divisors of {a} and {b} — highlighted in green
            </div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {Array.from({ length: Math.min(a, 100) }, (_, i) => i + 1)
                .filter(d => a % d === 0)
                .map(d => (
                  <span key={d} style={{
                    padding: '2px 8px', borderRadius: 4, fontSize: '0.78rem',
                    background: b % d === 0 ? '#22c55e18' : 'var(--bg-secondary)',
                    border: `1px solid ${b % d === 0 ? '#22c55e' : 'var(--border-warm)'}`,
                    color: b % d === 0 ? '#22c55e' : 'var(--text-dim)',
                    fontFamily: 'monospace',
                  }}>
                    {d}
                  </span>
                ))}
            </div>
          </div>
        </>
      )}

      {tab === 'prime' && (
        <>
          <div className="tool-controls-row" style={{ marginBottom: 16 }}>
            <label>n = <strong>{a}</strong></label>
            <input type="range" min={2} max={500} value={a} onChange={e => setA(+e.target.value)} />
          </div>
          {(() => {
            const pf = primeFactors(a);
            const unique = [...new Set(pf)];
            const isPrime = pf.length === 1;
            return (
              <div>
                <div style={{ fontSize: '1.3rem', fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent)', marginBottom: 16 }}>
                  {a} = {isPrime ? `${a} (prime)` : pf.join(' × ')}
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                  {unique.map(p => {
                    const exp = pf.filter(x => x === p).length;
                    return (
                      <div key={p} style={{
                        padding: '10px 16px', borderRadius: 10,
                        background: 'var(--bg-secondary)',
                        border: '2px solid #d97706',
                        textAlign: 'center', minWidth: 64,
                      }}>
                        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#d97706', fontFamily: 'monospace', lineHeight: 1 }}>{p}</div>
                        {exp > 1 && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 4 }}>
                            p<sup>{exp}</sup> = {Math.pow(p, exp)}
                          </div>
                        )}
                        <div style={{ fontSize: '0.65rem', color: '#22c55e', marginTop: 2 }}>prime</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 2, background: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: 8 }}>
                  {unique.map(p => {
                    const exp = pf.filter(x => x === p).length;
                    return (
                      <div key={p}>
                        {p}
                        {exp > 1 ? <sup>{exp}</sup> : null}
                        {' = '}
                        {Array.from({ length: exp }, () => p).join(' × ')}
                        {' = '}
                        <strong style={{ color: 'var(--accent)' }}>{Math.pow(p, exp)}</strong>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </>
      )}

      {tab === 'mod' && (
        <>
          <div className="tool-controls-row">
            <label>mod = <strong>{modN}</strong></label>
            <input type="range" min={2} max={24} value={modN} onChange={e => { setModN(+e.target.value); }} />
            <label>a = <strong>{modA}</strong></label>
            <input type="range" min={0} max={modN * 4} value={modA} onChange={e => setModA(+e.target.value)} />
          </div>

          <svg width="220" height="220" style={{ display: 'block', margin: '8px auto 0' }}>
            <circle cx={cx} cy={cy} r={clockR} fill="none" stroke="var(--border-warm)" strokeWidth={1.5} />
            {Array.from({ length: modN }, (_, i) => {
              const ang = angle(i);
              const x = cx + clockR * Math.cos(ang);
              const y = cy + clockR * Math.sin(ang);
              const isResult = i === result;
              return (
                <g key={i}>
                  <circle cx={x} cy={y} r={isResult ? 13 : 9}
                    fill={isResult ? '#d97706' : 'var(--bg-secondary)'}
                    stroke={isResult ? '#d97706' : 'var(--border-warm)'}
                    strokeWidth={1.5} />
                  <text x={x} y={y + 4} textAnchor="middle"
                    fontSize={isResult ? 9 : 7}
                    fill={isResult ? 'white' : 'var(--text-dim)'}
                    fontFamily="monospace" fontWeight={isResult ? 700 : 400}>
                    {i}
                  </text>
                </g>
              );
            })}
            <text x={cx} y={cy - 10} textAnchor="middle" fontSize={15}
              fill="var(--text-primary)" fontFamily="monospace" fontWeight={700}>{modA}</text>
            <text x={cx} y={cy + 8} textAnchor="middle" fontSize={10}
              fill="var(--text-dim)" fontFamily="monospace">mod {modN}</text>
            <text x={cx} y={cy + 24} textAnchor="middle" fontSize={16}
              fill="#d97706" fontFamily="monospace" fontWeight={800}>= {result}</text>
          </svg>

          <div style={{ textAlign: 'center', fontFamily: 'monospace', color: 'var(--text-dim)', marginTop: 4, fontSize: '0.88rem' }}>
            {modA} = {Math.floor(modA / modN)} × {modN} + <strong style={{ color: '#d97706' }}>{result}</strong>
          </div>
          <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 6 }}>
            Mod wraps numbers around a clock of size {modN}. The orange dot is {modA} mod {modN}.
          </div>
        </>
      )}
    </div>
  );
}
