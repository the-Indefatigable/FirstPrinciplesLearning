import { useState, useEffect, type ComponentType } from 'react';
import { useParams, useLocation, useNavigate, Navigate } from 'react-router-dom';
import BootScreen from '../components/BootScreen';
import SEOHead from '../components/SEOHead';
import { getBySlug, toolLoaders } from '../config/tools';

type Phase = 'booting' | 'fading' | 'ready';

const DOMAIN = 'https://www.firstprincipleslearningg.com';

const CATEGORY_DISPLAY: Record<string, string> = {
  math: 'Mathematics',
  physics: 'Physics',
  cs: 'Computer Science',
};

export default function ToolView() {
  const { toolId } = useParams<{ toolId: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const category = location.pathname.split('/')[1];
  const tool = getBySlug(toolId ?? '');
  const loader = toolId ? toolLoaders[toolId] : null;

  const [Component, setComponent] = useState<ComponentType | null>(null);
  const [phase, setPhase] = useState<Phase>('booting');

  useEffect(() => {
    if (!loader) return;
    let cancelled = false;
    let fadeTimer: ReturnType<typeof setTimeout>;
    setPhase('booting');
    setComponent(null);

    Promise.all([
      loader(),
      new Promise<void>(r => setTimeout(r, 500)),
    ]).then(([mod]) => {
      if (cancelled) return;
      setComponent(() => (mod as { default: ComponentType }).default);
      setPhase('fading');
      fadeTimer = setTimeout(() => { if (!cancelled) setPhase('ready'); }, 280);
    });

    return () => { cancelled = true; clearTimeout(fadeTimer); };
  }, [toolId, loader]);

  if (!tool || !loader) {
    return <Navigate to={`/${category}`} replace />;
  }

  const catLabel = CATEGORY_DISPLAY[category] ?? category;
  const seoTitle = `${tool.name} — Free ${catLabel} Tool | FirstPrinciple`;
  const seoDesc = `${tool.description} Free interactive ${tool.tag.toLowerCase()} tool. No login required.`;
  const canonical = `${DOMAIN}/${category}/${tool.slug}`;

  const breadcrumbs = [
    { name: 'Home', url: `${DOMAIN}/` },
    { name: catLabel, url: `${DOMAIN}/${category}` },
    { name: tool.name, url: canonical },
  ];

  return (
    <div className="tool-view-page">
      <SEOHead title={seoTitle} description={seoDesc} canonical={canonical} breadcrumbs={breadcrumbs} />

      {phase !== 'ready' && (
        <BootScreen tool={tool} categoryLabel={category} fading={phase === 'fading'} />
      )}

      {phase === 'ready' && Component && (
        <>
          <div className="tool-view-header">
            <button
              className="tool-view-back"
              onClick={() => navigate(`/${category}`)}
              aria-label={`Back to ${catLabel}`}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {catLabel}
            </button>
            <span className="tool-view-title">{tool.name}</span>
            <div className="tool-view-spacer" />
          </div>

          <div className="tool-view-content fade-in">
            <Component />
          </div>
        </>
      )}
    </div>
  );
}
