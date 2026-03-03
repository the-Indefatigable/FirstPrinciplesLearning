import type { ToolMeta } from '../config/tools';

const CATEGORY_LABELS: Record<string, string> = {
  math: 'Mathematics',
  physics: 'Physics',
  cs: 'Computer Science',
};

interface Props {
  tool: ToolMeta;
  categoryLabel: string;
  fading: boolean;
}

export default function BootScreen({ tool, categoryLabel, fading }: Props) {
  return (
    <div className={`boot-screen${fading ? ' boot-fading' : ''}`} aria-live="polite">
      <div className="boot-inner">
        <span className="boot-category-badge">
          {CATEGORY_LABELS[categoryLabel] ?? categoryLabel}
        </span>
        <h2 className="boot-tool-name">{tool.name}</h2>
        <div className="boot-line" />
        <p className="boot-label">preparing your workspace</p>
        <div className="boot-dots">
          <span className="boot-dot" style={{ animationDelay: '0s' }} />
          <span className="boot-dot" style={{ animationDelay: '0.18s' }} />
          <span className="boot-dot" style={{ animationDelay: '0.36s' }} />
        </div>
      </div>
    </div>
  );
}
