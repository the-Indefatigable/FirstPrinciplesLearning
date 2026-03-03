import { useState, useEffect, type ComponentType } from 'react';
import { useParams, useLocation, useNavigate, Navigate } from 'react-router-dom';
import BootScreen from '../components/BootScreen';
import { getBySlug, toolLoaders } from '../config/tools';

type Phase = 'booting' | 'fading' | 'ready';

const CATEGORY_DISPLAY: Record<string, string> = {
  math: 'Mathematics',
  physics: 'Physics',
  cs: 'Computer Science',
};

export default function ToolView() {
  const { toolId } = useParams<{ toolId: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const category = location.pathname.split('/')[1]; // 'math' | 'physics' | 'cs'
  const tool = getBySlug(toolId ?? '');
  const loader = toolId ? toolLoaders[toolId] : null;

  const [Component, setComponent] = useState<ComponentType | null>(null);
  const [phase, setPhase] = useState<Phase>('booting');

  useEffect(() => {
    if (!loader) return;
    setPhase('booting');
    setComponent(null);

    Promise.all([
      loader(),
      new Promise<void>(r => setTimeout(r, 500)),
    ]).then(([mod]) => {
      setComponent(() => (mod as { default: ComponentType }).default);
      setPhase('fading');
      setTimeout(() => setPhase('ready'), 280);
    });
  }, [toolId]);

  if (!tool || !loader) {
    return <Navigate to={`/${category}`} replace />;
  }

  return (
    <div className="tool-view-page">
      {phase !== 'ready' && (
        <BootScreen tool={tool} categoryLabel={category} fading={phase === 'fading'} />
      )}

      {phase === 'ready' && Component && (
        <>
          <div className="tool-view-header">
            <button
              className="tool-view-back"
              onClick={() => navigate(`/${category}`)}
              aria-label={`Back to ${CATEGORY_DISPLAY[category] ?? category}`}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {CATEGORY_DISPLAY[category] ?? category}
            </button>
            <span className="tool-view-title">{tool.name}</span>
            <div className="tool-view-spacer" />
          </div>

          <div className="tool-view-content fade-in">
            <div className="tool-grid tool-grid--1col">
              <Component />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
