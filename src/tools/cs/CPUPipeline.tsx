import { useState } from 'react';

const STAGES = ['IF', 'ID', 'EX', 'MEM', 'WB'] as const;
type Stage = typeof STAGES[number];

const STAGE_INFO: Record<Stage, { full: string; desc: string; color: string }> = {
  IF:  { full: 'Instruction Fetch',   desc: 'Reads next instruction from memory at the PC address.',          color: '#3b82f6' },
  ID:  { full: 'Instruction Decode',  desc: 'Decodes opcode, reads registers from register file.',             color: '#8b5cf6' },
  EX:  { full: 'Execute',             desc: 'ALU performs operation (add, compare, compute address).',         color: '#f59e0b' },
  MEM: { full: 'Memory Access',       desc: 'Reads from or writes to data memory (loads/stores only).',        color: '#22c55e' },
  WB:  { full: 'Write Back',          desc: 'Writes result back to the destination register.',                 color: '#ef4444' },
};

type HazardType = 'none' | 'data' | 'control' | 'structural';

interface Instruction {
  asm: string;
  dest?: string;
  src?: string[];
  isBranch?: boolean;
  isLoad?: boolean;
}

const PROGRAMS: { name: string; instrs: Instruction[] }[] = [
  {
    name: 'Basic ADD loop',
    instrs: [
      { asm: 'LOAD R1, [100]', dest: 'R1', isLoad: true },
      { asm: 'ADD  R2, R1, R3', dest: 'R2', src: ['R1', 'R3'] },
      { asm: 'SUB  R4, R2, R1', dest: 'R4', src: ['R2', 'R1'] },
      { asm: 'STORE R4, [200]', src: ['R4'] },
      { asm: 'BEQ  R4, done', isBranch: true, src: ['R4'] },
    ],
  },
  {
    name: 'Load-use hazard',
    instrs: [
      { asm: 'LOAD R1, [0x40]', dest: 'R1', isLoad: true },
      { asm: 'ADD  R2, R1, R0', dest: 'R2', src: ['R1'] },
      { asm: 'MUL  R3, R2, R2', dest: 'R3', src: ['R2'] },
      { asm: 'STORE R3, [0x44]', src: ['R3'] },
    ],
  },
  {
    name: 'Branch hazard',
    instrs: [
      { asm: 'CMP  R1, R2', src: ['R1', 'R2'] },
      { asm: 'BNE  loop', isBranch: true },
      { asm: 'NOP  (flushed)', dest: undefined },
      { asm: 'NOP  (flushed)', dest: undefined },
      { asm: 'ADD  R3, R4, R5', dest: 'R3', src: ['R4', 'R5'] },
    ],
  },
];

export default function CPUPipeline() {
  const [cycleIdx, setCycleIdx] = useState(0);
  const [progIdx, setProgIdx] = useState(0);
  const [selected, setSelected] = useState<{ i: number; s: number } | null>(null);

  const prog = PROGRAMS[progIdx];
  const instrs = prog.instrs;
  const totalCycles = instrs.length + STAGES.length - 1;
  const cycle = cycleIdx + 1; // 1-indexed

  // For each (instr, cycle), which stage is it in?
  const getStage = (instrIdx: number, cyc: number): Stage | null => {
    const stageIdx = cyc - instrIdx - 1;
    if (stageIdx < 0 || stageIdx >= STAGES.length) return null;
    return STAGES[stageIdx];
  };

  // Detect hazards
  const getHazard = (instrIdx: number, stageIdx: number): HazardType => {
    const instr = instrs[instrIdx];
    const stage = STAGES[stageIdx];
    if (!instr) return 'none';

    // Load-use hazard: LOAD followed immediately by instruction using the loaded reg
    if (instrIdx > 0 && stage === 'EX') {
      const prev = instrs[instrIdx - 1];
      if (prev.isLoad && instr.src?.includes(prev.dest ?? '')) {
        return 'data';
      }
    }

    // Data hazard: instruction using result before WB of producer
    if (stage === 'EX' && instrIdx > 0) {
      for (let j = Math.max(0, instrIdx - 2); j < instrIdx; j++) {
        const prod = instrs[j];
        if (prod.dest && instr.src?.includes(prod.dest)) {
          const prodStage = getStage(j, cycleIdx + 1);
          if (prodStage === 'EX' || prodStage === 'MEM') return 'data';
        }
      }
    }

    // Control hazard
    if (instrIdx > 0 && instrs[instrIdx - 1].isBranch && (stageIdx === 0 || stageIdx === 1)) {
      return 'control';
    }

    return 'none';
  };

  const selStage = selected ? STAGES[selected.s] : null;

  return (
    <div className="tool-card">
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          value={progIdx}
          onChange={e => { setProgIdx(+e.target.value); setCycleIdx(0); }}
          style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-warm)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.82rem' }}
        >
          {PROGRAMS.map((p, i) => <option key={i} value={i}>{p.name}</option>)}
        </select>
        <button className="tool-btn--outline" onClick={() => setCycleIdx(c => Math.max(0, c - 1))}>◀ Prev</button>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>Cycle {cycle} / {totalCycles}</span>
        <button className="tool-btn--outline" onClick={() => setCycleIdx(c => Math.min(totalCycles - 1, c + 1))}>Next ▶</button>
        <button className="tool-btn tool-btn--amber" onClick={() => setCycleIdx(0)}>Reset</button>
      </div>

      {/* Pipeline diagram */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 480 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '4px 10px', fontSize: '0.75rem', color: 'var(--text-dim)', minWidth: 130 }}>Instruction</th>
              {Array.from({ length: totalCycles }, (_, i) => (
                <th key={i} style={{
                  padding: '4px 8px', fontSize: '0.72rem', textAlign: 'center',
                  color: i === cycleIdx ? 'var(--accent)' : 'var(--text-dim)',
                  fontWeight: i === cycleIdx ? 700 : 400,
                }}>C{i + 1}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {instrs.map((instr, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--border-warm)' }}>
                <td style={{ padding: '6px 10px', fontSize: '0.78rem', fontFamily: 'monospace', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  {instr.asm}
                </td>
                {Array.from({ length: totalCycles }, (_, cyc) => {
                  const stage = getStage(i, cyc + 1);
                  const stageIdx = stage ? STAGES.indexOf(stage) : -1;
                  const hazard = stage ? getHazard(i, stageIdx) : 'none';
                  const isCurrent = cyc === cycleIdx;
                  const isSelected = selected?.i === i && selected?.s === stageIdx;
                  return (
                    <td key={cyc} style={{ padding: '3px 4px', textAlign: 'center' }}>
                      {stage && (
                        <div
                          onClick={() => setSelected(stageIdx >= 0 ? { i, s: stageIdx } : null)}
                          style={{
                            padding: '3px 0',
                            borderRadius: 5,
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            fontFamily: 'monospace',
                            cursor: 'pointer',
                            background: hazard === 'data' ? '#ef444422' : hazard === 'control' ? '#f59e0b22' : `${STAGE_INFO[stage].color}22`,
                            border: `1.5px solid ${hazard !== 'none' ? (hazard === 'data' ? '#ef4444' : '#f59e0b') : STAGE_INFO[stage].color}`,
                            color: STAGE_INFO[stage].color,
                            opacity: isCurrent ? 1 : 0.55,
                            outline: isSelected ? `2px solid white` : 'none',
                            transition: 'opacity 0.2s',
                          }}
                        >
                          {stage}
                          {hazard !== 'none' && <span style={{ fontSize: '0.6rem', display: 'block', color: hazard === 'data' ? '#ef4444' : '#f59e0b' }}>
                            {hazard === 'data' ? 'RAW' : 'CTL'}
                          </span>}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Stage info */}
      <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {STAGES.map(s => (
          <div key={s} style={{
            padding: '6px 12px', borderRadius: 6, fontSize: '0.75rem',
            background: `${STAGE_INFO[s].color}18`,
            border: `1.5px solid ${selStage === s ? STAGE_INFO[s].color : 'transparent'}`,
            color: STAGE_INFO[s].color, cursor: 'default',
          }}>
            <strong>{s}</strong> — {STAGE_INFO[s].full}
          </div>
        ))}
      </div>

      {selStage && (
        <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 8, background: 'var(--bg-secondary)', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          <strong style={{ color: STAGE_INFO[selStage].color }}>{selStage} — {STAGE_INFO[selStage].full}</strong>
          <p style={{ margin: '4px 0 0' }}>{STAGE_INFO[selStage].desc}</p>
        </div>
      )}

      <div style={{ marginTop: 10, display: 'flex', gap: 16, fontSize: '0.75rem', flexWrap: 'wrap' }}>
        <span style={{ color: '#ef4444' }}>■ RAW = Read After Write (data hazard)</span>
        <span style={{ color: '#f59e0b' }}>■ CTL = Control hazard (branch)</span>
      </div>

      <div style={{ marginTop: 8, fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.7 }}>
        Click any stage box to see its description. Step through cycles to watch instructions move through
        IF → ID → EX → MEM → WB. Hazards appear when an instruction needs a result that hasn't been
        computed yet (RAW) or when a branch changes the PC (control).
      </div>
    </div>
  );
}
