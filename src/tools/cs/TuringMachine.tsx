import { useState, useCallback, useRef, useEffect } from 'react';

interface Transition {
  state: string;
  read: string;
  write: string;
  move: 'L' | 'R' | 'S';
  next: string;
}

interface TMConfig {
  name: string;
  states: string[];
  tape: string;
  startState: string;
  acceptState: string;
  rejectState: string;
  transitions: Transition[];
  description: string;
}

const EXAMPLES: TMConfig[] = [
  {
    name: 'Recognize 0ⁿ1ⁿ',
    description: 'Accepts strings of the form 0ⁿ1ⁿ (equal # of 0s then 1s). Marks off matched pairs.',
    tape: '000111',
    startState: 'q0',
    acceptState: 'accept',
    rejectState: 'reject',
    states: ['q0', 'q1', 'q2', 'q3', 'accept', 'reject'],
    transitions: [
      { state: 'q0', read: '0', write: 'X', move: 'R', next: 'q1' },
      { state: 'q0', read: 'Y', write: 'Y', move: 'R', next: 'q3' },
      { state: 'q0', read: '1', write: '1', move: 'R', next: 'reject' },
      { state: 'q0', read: '_', write: '_', move: 'R', next: 'accept' },
      { state: 'q1', read: '0', write: '0', move: 'R', next: 'q1' },
      { state: 'q1', read: 'Y', write: 'Y', move: 'R', next: 'q1' },
      { state: 'q1', read: '1', write: 'Y', move: 'L', next: 'q2' },
      { state: 'q1', read: '_', write: '_', move: 'R', next: 'reject' },
      { state: 'q2', read: '0', write: '0', move: 'L', next: 'q2' },
      { state: 'q2', read: 'Y', write: 'Y', move: 'L', next: 'q2' },
      { state: 'q2', read: 'X', write: 'X', move: 'R', next: 'q0' },
      { state: 'q3', read: 'Y', write: 'Y', move: 'R', next: 'q3' },
      { state: 'q3', read: '_', write: '_', move: 'R', next: 'accept' },
      { state: 'q3', read: '1', write: '1', move: 'R', next: 'reject' },
    ],
  },
  {
    name: 'Binary increment',
    description: 'Increments a binary number by 1. Moves to the rightmost bit and carries left.',
    tape: '1011',
    startState: 'q0',
    acceptState: 'accept',
    rejectState: 'reject',
    states: ['q0', 'q1', 'accept', 'reject'],
    transitions: [
      { state: 'q0', read: '0', write: '0', move: 'R', next: 'q0' },
      { state: 'q0', read: '1', write: '1', move: 'R', next: 'q0' },
      { state: 'q0', read: '_', write: '_', move: 'L', next: 'q1' },
      { state: 'q1', read: '0', write: '1', move: 'R', next: 'accept' },
      { state: 'q1', read: '1', write: '0', move: 'L', next: 'q1' },
      { state: 'q1', read: '_', write: '1', move: 'R', next: 'accept' },
    ],
  },
  {
    name: 'Copy string (0s)',
    description: 'Copies a string of 0s: input "000" → output "000#000".',
    tape: '000',
    startState: 'q0',
    acceptState: 'accept',
    rejectState: 'reject',
    states: ['q0', 'q1', 'q2', 'q3', 'q4', 'accept', 'reject'],
    transitions: [
      { state: 'q0', read: '0', write: 'X', move: 'R', next: 'q1' },
      { state: 'q0', read: '_', write: '_', move: 'R', next: 'accept' },
      { state: 'q0', read: '#', write: '#', move: 'R', next: 'q4' },
      { state: 'q1', read: '0', write: '0', move: 'R', next: 'q1' },
      { state: 'q1', read: '#', write: '#', move: 'R', next: 'q2' },
      { state: 'q1', read: '_', write: '#', move: 'R', next: 'q2' },
      { state: 'q2', read: '0', write: '0', move: 'R', next: 'q2' },
      { state: 'q2', read: '_', write: '0', move: 'L', next: 'q3' },
      { state: 'q3', read: '0', write: '0', move: 'L', next: 'q3' },
      { state: 'q3', read: '#', write: '#', move: 'L', next: 'q3' },
      { state: 'q3', read: 'X', write: 'X', move: 'R', next: 'q0' },
      { state: 'q4', read: 'X', write: '0', move: 'R', next: 'q4' },
      { state: 'q4', read: '_', write: '_', move: 'R', next: 'accept' },
    ],
  },
];

const BLANK = '_';
const TAPE_LEN = 32;

function initTape(input: string): string[] {
  const t = new Array(TAPE_LEN).fill(BLANK);
  const start = 4;
  for (let i = 0; i < input.length && start + i < TAPE_LEN; i++) {
    t[start + i] = input[i];
  }
  return t;
}

export default function TuringMachine() {
  const [exIdx, setExIdx] = useState(0);
  const [ex, setEx] = useState(EXAMPLES[0]);
  const [running, setRunning] = useState(false);
  const [customInput, setCustomInput] = useState(EXAMPLES[0].tape);
  const rafRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [tmState, setTmState] = useState<{ tape: string[]; head: number; state: string; log: string[]; halted: boolean }>({
    tape: initTape(EXAMPLES[0].tape),
    head: 4,
    state: EXAMPLES[0].startState,
    log: [],
    halted: false,
  });

  const doStep = useCallback((cur: typeof tmState, cfg: TMConfig) => {
    if (cur.halted) return cur;
    const sym = cur.tape[cur.head] ?? BLANK;
    const tr = cfg.transitions.find(t => t.state === cur.state && t.read === sym);

    if (!tr) {
      return { ...cur, halted: true, log: [`No transition for (${cur.state}, '${sym}') → REJECT`, ...cur.log].slice(0, 20) };
    }

    const newTape = [...cur.tape];
    newTape[cur.head] = tr.write;
    const newHead = Math.max(0, Math.min(TAPE_LEN - 1,
      tr.move === 'R' ? cur.head + 1 : tr.move === 'L' ? cur.head - 1 : cur.head
    ));
    const halted = tr.next === cfg.acceptState || tr.next === cfg.rejectState;
    const newLog = [
      ...(halted ? [`🏁 HALTED: ${tr.next.toUpperCase()}`] : []),
      `(${cur.state}, '${sym}') → write '${tr.write}', ${tr.move}, → ${tr.next}`,
      ...cur.log,
    ].slice(0, 20);

    return { tape: newTape, head: newHead, state: tr.next, log: newLog, halted };
  }, []);

  const tmRef = useRef(tmState);
  tmRef.current = tmState;
  const exRef = useRef(ex);
  exRef.current = ex;

  const handleReset = useCallback((cfg: TMConfig, inp?: string) => {
    const input = inp ?? cfg.tape;
    const init = { tape: initTape(input), head: 4, state: cfg.startState, log: [], halted: false };
    setTmState(init);
    setRunning(false);
    clearTimeout(rafRef.current);
  }, []);

  const handleStep = useCallback(() => {
    setTmState(cur => doStep(cur, exRef.current));
  }, [doStep]);

  useEffect(() => {
    if (running && !tmState.halted) {
      rafRef.current = setTimeout(() => {
        setTmState(cur => doStep(cur, exRef.current));
      }, 200);
    } else if (tmState.halted) {
      setRunning(false);
    }
    return () => clearTimeout(rafRef.current);
  }, [running, tmState, doStep]);

  const changeExample = (idx: number) => {
    setExIdx(idx);
    const cfg = EXAMPLES[idx];
    setEx(cfg);
    setCustomInput(cfg.tape);
    handleReset(cfg, cfg.tape);
  };

  const accepted = tmState.halted && tmState.state === ex.acceptState;
  const rejected = tmState.halted && (tmState.state === ex.rejectState || tmState.log[0]?.includes('No transition'));

  return (
    <div className="tool-card">
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={exIdx} onChange={e => changeExample(+e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-warm)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.82rem' }}>
          {EXAMPLES.map((e, i) => <option key={i} value={i}>{e.name}</option>)}
        </select>
        <input
          type="text" value={customInput}
          onChange={e => setCustomInput(e.target.value)}
          placeholder="Input tape..."
          style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-warm)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.82rem', width: 120, fontFamily: 'monospace' }}
        />
        <button className="tool-btn--outline" onClick={() => { handleReset(ex, customInput); }}>Load</button>
        <button className="tool-btn--outline" onClick={handleStep} disabled={tmState.halted}>Step</button>
        <button
          className={running ? 'tool-btn tool-btn--amber' : 'tool-btn--outline'}
          onClick={() => setRunning(r => !r)} disabled={tmState.halted}>
          {running ? 'Pause' : 'Run'}
        </button>
        <button className="tool-btn--outline" onClick={() => handleReset(ex, customInput)}>Reset</button>
      </div>

      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 10 }}>{ex.description}</div>

      {/* Status badge */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
        <div style={{
          padding: '4px 14px', borderRadius: 20, fontSize: '0.8rem', fontFamily: 'monospace', fontWeight: 700,
          background: accepted ? '#22c55e22' : rejected ? '#ef444422' : 'var(--bg-secondary)',
          border: `1.5px solid ${accepted ? '#22c55e' : rejected ? '#ef4444' : 'var(--border-warm)'}`,
          color: accepted ? '#22c55e' : rejected ? '#ef4444' : 'var(--text-primary)',
        }}>
          {accepted ? 'ACCEPTED' : rejected ? 'REJECTED' : `State: ${tmState.state}`}
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Head @ cell {tmState.head}</span>
      </div>

      {/* Tape */}
      <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
        <div style={{ display: 'flex', gap: 1, minWidth: 'max-content' }}>
          {tmState.tape.map((cell, i) => {
            const isHead = i === tmState.head;
            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{
                  width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: isHead ? 800 : 400,
                  border: `1.5px solid ${isHead ? '#d97706' : 'var(--border-warm)'}`,
                  borderRadius: 3,
                  background: isHead ? '#d9770622' : cell !== BLANK ? 'var(--bg-secondary)' : 'transparent',
                  color: isHead ? '#d97706' : cell !== BLANK ? 'var(--text-primary)' : 'var(--text-dim)',
                  transition: 'all 0.15s',
                }}>
                  {cell}
                </div>
                {isHead && (
                  <div style={{ fontSize: '0.6rem', color: '#d97706', fontWeight: 800, marginTop: 2 }}>▲</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Transition table */}
      <div style={{ marginTop: 12, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 300px', overflowX: 'auto', maxHeight: 180, overflowY: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: '0.75rem', fontFamily: 'monospace', width: '100%' }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary)' }}>
                {['State', 'Read', 'Write', 'Move', 'Next'].map(h => (
                  <th key={h} style={{ padding: '4px 8px', textAlign: 'left', color: 'var(--text-dim)', fontWeight: 600, borderBottom: '1px solid var(--border-warm)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ex.transitions.map((tr, i) => {
                const active = tr.state === tmState.state;
                return (
                  <tr key={i} style={{ background: active ? '#d9770610' : 'transparent' }}>
                    <td style={{ padding: '3px 8px', color: active ? '#d97706' : 'var(--text-dim)', fontWeight: active ? 700 : 400 }}>{tr.state}</td>
                    <td style={{ padding: '3px 8px', color: tr.read === tmState.tape[tmState.head] && active ? '#22c55e' : 'var(--text-secondary)' }}>{tr.read}</td>
                    <td style={{ padding: '3px 8px', color: 'var(--text-secondary)' }}>{tr.write}</td>
                    <td style={{ padding: '3px 8px', color: tr.move === 'R' ? '#3b82f6' : tr.move === 'L' ? '#f59e0b' : '#9c9488' }}>{tr.move}</td>
                    <td style={{ padding: '3px 8px', color: tr.next === ex.acceptState ? '#22c55e' : tr.next === ex.rejectState ? '#ef4444' : 'var(--text-secondary)' }}>{tr.next}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Step log */}
        <div style={{ flex: '1 1 220px', background: 'var(--bg-secondary)', borderRadius: 6, padding: '8px 10px', maxHeight: 180, overflowY: 'auto' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: 4, fontWeight: 600 }}>Execution Log</div>
          {tmState.log.map((l, i) => (
            <div key={i} style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: i === 0 ? 'var(--text-primary)' : 'var(--text-dim)', padding: '1px 0' }}>{l}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
