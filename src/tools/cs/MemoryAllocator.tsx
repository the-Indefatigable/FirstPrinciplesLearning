import { useState, useCallback } from 'react';

interface Block {
  id: number;
  start: number; // bytes
  size: number;  // bytes
  free: boolean;
  label?: string;
}

const HEAP_SIZE = 512; // bytes
const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899'];
let nextId = 1;
let colorIdx = 0;

const initialBlocks: Block[] = [
  { id: 0, start: 0, size: HEAP_SIZE, free: true },
];

type Strategy = 'first-fit' | 'best-fit' | 'worst-fit';

export default function MemoryAllocator() {
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [reqSize, setReqSize] = useState(64);
  const [strategy, setStrategy] = useState<Strategy>('first-fit');
  const [label, setLabel] = useState('');
  const [log, setLog] = useState<string[]>(['Heap initialized. 512 bytes free.']);
  const [selected, setSelected] = useState<number | null>(null);

  const addLog = (msg: string) => setLog(prev => [msg, ...prev].slice(0, 10));

  const totalFree = blocks.filter(b => b.free).reduce((s, b) => s + b.size, 0);
  const totalUsed = HEAP_SIZE - totalFree;

  const malloc = useCallback(() => {
    if (reqSize <= 0 || reqSize > HEAP_SIZE) return;

    setBlocks(prev => {
      const freeBlocks = prev.filter(b => b.free && b.size >= reqSize);
      if (freeBlocks.length === 0) {
        addLog(`❌ malloc(${reqSize}B) failed — not enough contiguous memory`);
        return prev;
      }

      let chosen: Block;
      if (strategy === 'first-fit') {
        chosen = freeBlocks[0];
      } else if (strategy === 'best-fit') {
        chosen = freeBlocks.reduce((best, b) => b.size < best.size ? b : best);
      } else {
        chosen = freeBlocks.reduce((worst, b) => b.size > worst.size ? b : worst);
      }

      colorIdx++;
      const id = nextId++;
      const lbl = label.trim() || `blk${id}`;

      const result = prev.filter(b => b.id !== chosen.id);
      result.push({
        id,
        start: chosen.start,
        size: reqSize,
        free: false,
        label: lbl,
      });

      // Remainder
      if (chosen.size > reqSize) {
        result.push({
          id: nextId++,
          start: chosen.start + reqSize,
          size: chosen.size - reqSize,
          free: true,
        });
      }

      result.sort((a, b) => a.start - b.start);
      addLog(`✅ malloc(${reqSize}B) → ${lbl} @ 0x${chosen.start.toString(16).padStart(3, '0').toUpperCase()} [${strategy}]`);
      return result;
    });

    setLabel('');
  }, [reqSize, strategy, label]);

  const free = useCallback((id: number) => {
    setBlocks(prev => {
      const idx = prev.findIndex(b => b.id === id);
      if (idx < 0 || prev[idx].free) return prev;
      const lbl = prev[idx].label ?? `id${id}`;
      addLog(`🗑️ free(${lbl}) — ${prev[idx].size}B returned to heap`);

      const next = prev.map((b, i) => i === idx ? { ...b, free: true, label: undefined } : b);

      // Coalesce adjacent free blocks
      const coalesced: Block[] = [];
      for (const b of next) {
        const last = coalesced[coalesced.length - 1];
        if (last && last.free && b.free) {
          last.size += b.size;
        } else {
          coalesced.push({ ...b });
        }
      }

      const freed = coalesced.filter(b => b.free).length;
      if (freed !== next.filter(b => b.free).length || coalesced.length !== next.length) {
        addLog(`🔗 Coalesced adjacent free blocks`);
      }

      return coalesced;
    });
    setSelected(null);
  }, []);

  const reset = () => {
    setBlocks([{ id: 0, start: 0, size: HEAP_SIZE, free: true }]);
    setLog(['Heap reset. 512 bytes free.']);
    setSelected(null);
    nextId = 1; colorIdx = 0;
  };

  return (
    <div className="tool-card">
      {/* Controls */}
      <div className="tool-controls-row" style={{ marginBottom: 12, gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 140 }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Alloc size (bytes)</label>
          <input type="range" min={8} max={256} step={8} value={reqSize} onChange={e => setReqSize(+e.target.value)} />
          <span style={{ fontSize: '0.8rem', fontFamily: 'monospace', fontWeight: 700 }}>{reqSize}B</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Label (optional)</label>
          <input
            type="text" placeholder="e.g. arr[]" value={label}
            onChange={e => setLabel(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && malloc()}
            style={{ padding: '5px 8px', borderRadius: 5, border: '1px solid var(--border-warm)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.82rem' }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Strategy</label>
          <select value={strategy} onChange={e => setStrategy(e.target.value as Strategy)}
            style={{ padding: '5px 8px', borderRadius: 5, border: '1px solid var(--border-warm)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.82rem' }}>
            <option value="first-fit">First Fit</option>
            <option value="best-fit">Best Fit</option>
            <option value="worst-fit">Worst Fit</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <button className="tool-btn tool-btn--amber" onClick={malloc}>malloc({reqSize})</button>
          <button className="tool-btn--outline" onClick={reset}>Reset</button>
        </div>
      </div>

      {/* Heap bar */}
      <div style={{ marginBottom: 8, fontSize: '0.78rem', color: 'var(--text-dim)', display: 'flex', justifyContent: 'space-between' }}>
        <span>Heap (512 bytes)</span>
        <span>{totalFree}B free · {totalUsed}B used</span>
      </div>
      <div style={{
        display: 'flex', height: 40, borderRadius: 6, overflow: 'hidden',
        border: '1px solid var(--border-warm)',
      }}>
        {blocks.map((b, i) => (
          <div
            key={b.id}
            onClick={() => !b.free && setSelected(s => s === b.id ? null : b.id)}
            title={b.free ? `Free: ${b.size}B @ 0x${b.start.toString(16)}` : `${b.label}: ${b.size}B`}
            style={{
              width: `${(b.size / HEAP_SIZE) * 100}%`,
              background: b.free
                ? (i % 2 === 0 ? 'var(--bg-secondary)' : 'var(--bg-tertiary, var(--bg-secondary))')
                : COLORS[blocks.filter(x => !x.free).indexOf(b) % COLORS.length],
              opacity: selected !== null && selected !== b.id ? 0.55 : 1,
              borderRight: i < blocks.length - 1 ? '1px solid var(--border-warm)' : 'none',
              cursor: b.free ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.65rem', fontFamily: 'monospace', color: b.free ? 'var(--text-dim)' : 'white',
              fontWeight: 600, overflow: 'hidden', transition: 'opacity 0.2s',
            }}>
            {b.size >= 32 ? (b.free ? `${b.size}` : b.label ?? '') : ''}
          </div>
        ))}
      </div>

      {/* Block list */}
      <div style={{ marginTop: 12, maxHeight: 180, overflowY: 'auto' }}>
        {blocks.map((b) => (
          <div key={b.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '5px 10px', borderRadius: 5, marginBottom: 2,
            background: selected === b.id ? 'var(--bg-secondary)' : 'transparent',
            cursor: b.free ? 'default' : 'pointer',
            fontSize: '0.8rem', fontFamily: 'monospace',
          }}
            onClick={() => !b.free && setSelected(s => s === b.id ? null : b.id)}
          >
            <div style={{
              width: 12, height: 12, borderRadius: 2, flexShrink: 0,
              background: b.free ? 'var(--border-warm)' : COLORS[blocks.filter(x => !x.free).indexOf(b) % COLORS.length],
            }} />
            <span style={{ minWidth: 80, color: 'var(--text-dim)' }}>
              0x{b.start.toString(16).padStart(3, '0').toUpperCase()}
            </span>
            <span style={{ minWidth: 64 }}>{b.size}B</span>
            <span style={{ flex: 1, color: b.free ? '#22c55e' : 'var(--text-primary)' }}>
              {b.free ? 'FREE' : b.label}
            </span>
            {!b.free && (
              <button
                className="tool-btn--outline"
                onClick={e => { e.stopPropagation(); free(b.id); }}
                style={{ padding: '2px 8px', fontSize: '0.72rem' }}>
                free()
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Log */}
      <div style={{ marginTop: 10, background: 'var(--bg-secondary)', borderRadius: 6, padding: '8px 12px', maxHeight: 120, overflowY: 'auto' }}>
        {log.map((l, i) => (
          <div key={i} style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: i === 0 ? 'var(--text-primary)' : 'var(--text-dim)', padding: '1px 0' }}>{l}</div>
        ))}
      </div>

      <div style={{ marginTop: 8, fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.7 }}>
        <strong>First Fit</strong> — allocates the first free block that fits (fast). &nbsp;
        <strong>Best Fit</strong> — finds smallest sufficient block (less waste). &nbsp;
        <strong>Worst Fit</strong> — uses largest block (keeps larger fragments). &nbsp;
        Click a block to select, then press free() to deallocate. Adjacent free blocks are automatically coalesced.
      </div>
    </div>
  );
}
