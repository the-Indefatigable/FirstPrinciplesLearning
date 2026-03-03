import type { ToolMeta } from '../config/tools';

interface Props {
  tool: ToolMeta;
  onClick: () => void;
}

export default function GlassCard({ tool, onClick }: Props) {
  return (
    <button
      className={`glass-card glass-card--${tool.category}`}
      onClick={onClick}
      aria-label={`Open ${tool.name}`}
    >
      <div className="glass-card-preview" style={{ background: tool.gradient }}>
        <tool.Preview />
      </div>
      <div className="glass-card-body">
        <span className="glass-card-tag">{tool.tag}</span>
        <h3 className="glass-card-name">{tool.name}</h3>
        <p className="glass-card-desc">{tool.description}</p>
        <div className="glass-card-footer">
          <span className="glass-card-cta">Open tool</span>
          <svg className="glass-card-arrow" width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </button>
  );
}
