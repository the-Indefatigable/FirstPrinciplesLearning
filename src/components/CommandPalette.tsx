import { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { allTools, type ToolMeta } from '../config/tools';

const CAT = {
  math:    { bg: 'rgba(245,158,11,0.13)',  color: '#b45309', label: 'Math' },
  physics: { bg: 'rgba(107,143,113,0.13)', color: '#4a7a52', label: 'Physics' },
  cs:      { bg: 'rgba(194,113,79,0.13)',  color: '#c2714f', label: 'CS' },
};

function matches(tool: ToolMeta, q: string): boolean {
  if (!q.trim()) return true;
  const hay = `${tool.name} ${tool.tag} ${tool.description} ${tool.category}`.toLowerCase();
  return q.toLowerCase().split(/\s+/).every(w => w && hay.includes(w));
}

interface Props { open: boolean; onClose: () => void; }

export default function CommandPalette({ open, onClose }: Props) {
  const [query, setQuery]       = useState('');
  const [idx,   setIdx]         = useState(0);
  const inputRef                = useRef<HTMLInputElement>(null);
  const listRef                 = useRef<HTMLDivElement>(null);
  const navigate                = useNavigate();

  const results = allTools.filter(t => matches(t, query));

  // Reset selection when query changes
  useEffect(() => { setIdx(0); }, [query]);

  // Focus + reset when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setIdx(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const go = useCallback((tool: ToolMeta) => {
    navigate(`/${tool.category}/${tool.slug}`);
    onClose();
  }, [navigate, onClose]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape')    { onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(i + 1, results.length - 1)); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)); }
      if (e.key === 'Enter' && results[idx]) go(results[idx]);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, results, idx, go, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    (list.children[idx] as HTMLElement | undefined)?.scrollIntoView({ block: 'nearest' });
  }, [idx]);

  if (!open) return null;

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(10,8,6,0.72)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '12vh', padding: '12vh 16px 0',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 600,
          background: 'var(--bg-card)',
          border: '1px solid var(--border-warm)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.4)',
          overflow: 'hidden',
        }}
      >
        {/* ── Search input ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '14px 16px',
          borderBottom: '1px solid var(--border-light)',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            style={{ color: 'var(--text-dim)', flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={`Search ${allTools.length} tools…`}
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontSize: '1rem', color: 'var(--text-primary)', fontFamily: 'inherit',
            }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '1rem', lineHeight: 1, padding: 0 }}
              aria-label="Clear"
            >✕</button>
          )}
          <kbd style={kbdStyle}>esc</kbd>
        </div>

        {/* ── Results ── */}
        <div ref={listRef} style={{ maxHeight: 400, overflowY: 'auto' }}>
          {results.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.9rem' }}>
              No tools match &ldquo;{query}&rdquo;
            </div>
          ) : results.map((tool, i) => {
            const cat = CAT[tool.category];
            const selected = i === idx;
            return (
              <div
                key={tool.slug}
                onClick={() => go(tool)}
                onMouseEnter={() => setIdx(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 16px', cursor: 'pointer',
                  background: selected ? 'var(--bg-secondary)' : 'transparent',
                  borderLeft: `3px solid ${selected ? 'var(--amber)' : 'transparent'}`,
                  transition: 'background 0.08s',
                }}
              >
                <span style={{
                  fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                  background: cat.bg, color: cat.color, whiteSpace: 'nowrap', flexShrink: 0,
                }}>
                  {cat.label}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {tool.name}
                  </div>
                  <div style={{
                    fontSize: '0.74rem', color: 'var(--text-dim)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {tool.tag}
                  </div>
                </div>
                {selected && <kbd style={kbdStyle}>↵</kbd>}
              </div>
            );
          })}
        </div>

        {/* ── Footer ── */}
        <div style={{
          padding: '8px 16px', borderTop: '1px solid var(--border-light)',
          display: 'flex', gap: 14, fontSize: '0.72rem', color: 'var(--text-dim)',
          flexWrap: 'wrap',
        }}>
          {[['↑↓', 'navigate'], ['↵', 'open'], ['esc', 'close']].map(([key, label]) => (
            <span key={key}><kbd style={kbdSmall}>{key}</kbd> {label}</span>
          ))}
          <span style={{ marginLeft: 'auto' }}>{results.length} / {allTools.length} tools</span>
        </div>
      </div>
    </div>,
    document.body
  );
}

const kbdStyle: React.CSSProperties = {
  fontSize: '0.7rem', padding: '2px 6px',
  background: 'var(--bg-secondary)', border: '1px solid var(--border-warm)',
  borderRadius: 4, color: 'var(--text-dim)', fontFamily: 'inherit',
};
const kbdSmall: React.CSSProperties = {
  ...kbdStyle, padding: '1px 4px', borderRadius: 3,
};
