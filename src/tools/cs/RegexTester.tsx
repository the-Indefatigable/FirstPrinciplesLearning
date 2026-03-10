import { useState, useMemo } from 'react';

export default function RegexTester() {
    const [pattern, setPattern] = useState('\\b\\w+ing\\b');
    const [flags, setFlags] = useState('gi');
    const [testStr, setTestStr] = useState('The running fox is jumping over the sleeping dog while singing.');
    const [error, setError] = useState<string | null>(null);

    const matches = useMemo(() => {
        try {
            const regex = new RegExp(pattern, flags);
            setError(null);
            const result: { start: number; end: number; match: string; groups: (string | undefined)[] }[] = [];
            let m: RegExpExecArray | null;
            if (flags.includes('g')) {
                while ((m = regex.exec(testStr)) !== null) {
                    result.push({ start: m.index, end: m.index + m[0].length, match: m[0], groups: Array.from(m).slice(1) });
                    if (!m[0].length) regex.lastIndex++;
                }
            } else {
                m = regex.exec(testStr);
                if (m) result.push({ start: m.index, end: m.index + m[0].length, match: m[0], groups: Array.from(m).slice(1) });
            }
            return result;
        } catch (e) { setError((e as Error).message); return []; }
    }, [pattern, flags, testStr]);

    const highlighted = useMemo(() => {
        if (!matches.length) return [{ text: testStr, hl: false }];
        const parts: { text: string; hl: boolean }[] = [];
        let last = 0;
        matches.forEach(m => {
            if (m.start > last) parts.push({ text: testStr.slice(last, m.start), hl: false });
            parts.push({ text: m.match, hl: true });
            last = m.end;
        });
        if (last < testStr.length) parts.push({ text: testStr.slice(last), hl: false });
        return parts;
    }, [testStr, matches]);

    return (
        <div className="tool-card">
            <div className="tool-card-header">
                <h3>Regex Tester</h3>
                <span className="subject-topic" style={{ background: 'var(--terracotta-glow)', color: 'var(--terracotta)' }}>Programming</span>
            </div>
            <div className="tool-card-body">
                <div className="tool-input-group" style={{ marginBottom: 12 }}>
                    <label>Pattern</label>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-dim)', fontSize: '1.1rem' }}>/</span>
                        <input className="tool-input" value={pattern} onChange={e => setPattern(e.target.value)} style={{ fontFamily: 'monospace', flex: 1 }} />
                        <span style={{ color: 'var(--text-dim)', fontSize: '1.1rem' }}>/</span>
                        <input className="tool-input" value={flags} onChange={e => setFlags(e.target.value)} style={{ fontFamily: 'monospace', width: 50 }} />
                    </div>
                    {error && <div style={{ color: 'var(--terracotta)', fontSize: '0.8rem', marginTop: 4 }}>{error}</div>}
                </div>
                <div className="tool-input-group" style={{ marginBottom: 16 }}>
                    <label>Test String</label>
                    <textarea className="tool-input" value={testStr} onChange={e => setTestStr(e.target.value)} rows={3} style={{ fontFamily: 'monospace', resize: 'vertical' }} />
                </div>

                <div style={{ padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', marginBottom: 12, fontSize: '0.85rem' }}>
                    <strong style={{ color: matches.length ? 'var(--sage)' : 'var(--text-dim)' }}>{matches.length}</strong> match{matches.length !== 1 ? 'es' : ''}
                </div>

                <div style={{ padding: '16px 20px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', fontFamily: 'monospace', fontSize: '0.95rem', lineHeight: 1.8, marginBottom: 16, border: '1px solid var(--border-warm)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {highlighted.map((p, i) => p.hl
                        ? <mark key={i} style={{ background: 'rgba(245,158,11,0.3)', color: 'var(--amber)', padding: '2px 4px', borderRadius: 3, borderBottom: '2px solid var(--amber)' }}>{p.text}</mark>
                        : <span key={i}>{p.text}</span>
                    )}
                </div>

                {matches.length > 0 && (
                    <div style={{ border: '1px solid var(--border-warm)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                        {matches.map((m, i) => (
                            <div key={i} style={{ padding: '6px 16px', borderTop: i ? '1px solid var(--border-light)' : 'none', fontSize: '0.85rem', fontFamily: 'monospace' }}>
                                <div style={{ display: 'flex', gap: 16 }}>
                                    <span style={{ color: 'var(--text-dim)', minWidth: 30 }}>#{i + 1}</span>
                                    <span style={{ color: 'var(--amber)', fontWeight: 600 }}>"{m.match}"</span>
                                    <span style={{ color: 'var(--text-dim)' }}>pos {m.start}–{m.end}</span>
                                </div>
                                {m.groups.length > 0 && (
                                    <div style={{ paddingLeft: 46, marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                        {m.groups.map((g, gi) => (
                                            <span key={gi} style={{ color: 'var(--sage)', fontSize: '0.78rem' }}>
                                                ${gi + 1}=<span style={{ color: 'var(--text-dim)' }}>"{g ?? '—'}"</span>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
