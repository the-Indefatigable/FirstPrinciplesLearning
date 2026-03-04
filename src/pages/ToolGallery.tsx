import { useNavigate } from 'react-router-dom';
import GlassCard from '../components/GlassCard';
import { getByCategory } from '../config/tools';

const CATEGORY_META = {
  math: {
    title: 'Mathematics',
    subtitle: 'Calculus, linear algebra, and graphing — built to make abstract ideas click.',
    unit: 'interactive tools',
  },
  physics: {
    title: 'Physics Simulations',
    subtitle: 'Tweak parameters and watch the laws of physics unfold in real time.',
    unit: 'interactive simulations',
  },
  cs: {
    title: 'Computer Science',
    subtitle: 'Visualize algorithms, traverse graphs, and run code — all in the browser.',
    unit: 'interactive tools',
  },
} as const;

interface Props {
  category: 'math' | 'physics' | 'cs';
}

export default function ToolGallery({ category }: Props) {
  const navigate = useNavigate();
  const tools = getByCategory(category);
  const meta = CATEGORY_META[category];

  return (
    <div className="gallery-page">
      <div className="tool-page-header">
        <div className="tool-page-eyebrow">
          <span className="eyebrow-line" />
          <span>Interactive Tools</span>
          <span className="eyebrow-line" />
        </div>
        <h1>{meta.title}</h1>
        <p>{meta.subtitle}</p>
        <div className="tool-count-badge">
          <span className="count-dot" />
          {tools.length} {meta.unit}
        </div>
      </div>

      <div className="gallery-grid">
        {tools.map(tool => (
          <GlassCard
            key={tool.slug}
            tool={tool}
            onClick={() => navigate(`/${category}/${tool.slug}`)}
          />
        ))}
      </div>
    </div>
  );
}
