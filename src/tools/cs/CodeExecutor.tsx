import { useState, useRef } from 'react';

export default function CodeExecutor() {
    const [code, setCode] = useState(`// Write your JavaScript code here
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

for (let i = 0; i < 10; i++) {
  console.log(\`fib(\${i}) = \${fibonacci(i)}\`);
}
`);
    const [output, setOutput] = useState('');
    const [running, setRunning] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const run = () => {
        setRunning(true);
        setOutput('');
        const logs: string[] = [];
        const startTime = performance.now();

        try {
            // Override console.log
            const originalLog = console.log;
            console.log = (...args: unknown[]) => {
                logs.push(args.map(a => {
                    if (typeof a === 'object') return JSON.stringify(a, null, 2);
                    return String(a);
                }).join(' '));
            };

            // Execute in sandboxed scope
            const fn = new Function(code);
            const result = fn();

            console.log = originalLog;
            const elapsed = (performance.now() - startTime).toFixed(2);

            if (result !== undefined) logs.push(`→ ${JSON.stringify(result)}`);
            logs.push(`\n⏱ Executed in ${elapsed}ms`);
            setOutput(logs.join('\n'));
        } catch (e: unknown) {
            setOutput(`❌ Error: ${e instanceof Error ? e.message : String(e)}`);
        }
        setRunning(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            const ta = textareaRef.current;
            if (!ta) return;
            const start = ta.selectionStart;
            const end = ta.selectionEnd;
            const newCode = code.substring(0, start) + '  ' + code.substring(end);
            setCode(newCode);
            setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + 2; }, 0);
        }
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            run();
        }
    };

    return (
        <div className="tool-card">
            <div className="tool-card-header">
                <h3>Code Executor</h3>
                <div className="tool-controls">
                    <button className="tool-btn" onClick={run} disabled={running}>
                        {running ? 'Running...' : '▶ Run (⌘+Enter)'}
                    </button>
                    <button className="tool-btn--outline tool-btn" onClick={() => setOutput('')} style={{ fontSize: '0.82rem', padding: '6px 14px' }}>
                        Clear
                    </button>
                </div>
            </div>
            <div className="tool-card-body" style={{ padding: 0 }}>
                <textarea
                    ref={textareaRef}
                    className="tool-input"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    onKeyDown={handleKeyDown}
                    style={{
                        width: '100%',
                        minHeight: 200,
                        borderRadius: 0,
                        border: 'none',
                        borderBottom: '1px solid var(--border-warm)',
                        resize: 'vertical',
                        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                        fontSize: '0.88rem',
                        lineHeight: 1.6,
                        padding: '20px 24px',
                    }}
                    spellCheck={false}
                />
                {output && (
                    <div className="tool-result" style={{
                        borderRadius: 0,
                        border: 'none',
                        borderTop: 'none',
                        margin: 0,
                        minHeight: 60,
                        padding: '16px 24px',
                    }}>
                        {output}
                    </div>
                )}
            </div>
        </div>
    );
}
