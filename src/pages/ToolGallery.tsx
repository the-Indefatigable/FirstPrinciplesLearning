import { useNavigate } from 'react-router-dom';
import GlassCard from '../components/GlassCard';
import SEOHead from '../components/SEOHead';
import { getByCategory } from '../config/tools';

const CATEGORY_META = {
  math: {
    title: 'Mathematics',
    subtitle: 'Calculus, linear algebra, and graphing — built to make abstract ideas click.',
    unit: 'interactive tools',
    seoTitle: 'Free Math Tools — Interactive Calculators & Visualizers | FirstPrinciple',
    seoDesc: 'Explore 12+ free interactive math tools: graphing calculator, unit circle, Fourier transform visualizer, equation solver, matrix tools, and more.',
  },
  physics: {
    title: 'Physics Simulations',
    subtitle: 'Tweak parameters and watch the laws of physics unfold in real time.',
    unit: 'interactive simulations',
    seoTitle: 'Free Physics Simulations — Interactive Labs | FirstPrinciple',
    seoDesc: 'Run real-time physics simulations: circuit builder, projectile motion, electric fields, wave superposition, ray optics, orbital mechanics, and more.',
  },
  cs: {
    title: 'Computer Science',
    subtitle: 'Visualize algorithms, traverse graphs, and run code — all in the browser.',
    unit: 'interactive tools',
    seoTitle: 'Free CS Tools — Algorithm Visualizers & Data Structures | FirstPrinciple',
    seoDesc: 'Visualize sorting algorithms, graph traversal, binary trees, stacks, queues, linked lists, finite state machines, and Big-O complexity — all in the browser.',
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
      <SEOHead
        title={meta.seoTitle}
        description={meta.seoDesc}
        canonical={`https://www.firstprincipleslearningg.com/${category}`}
        breadcrumbs={[
          { name: 'Home', url: 'https://www.firstprincipleslearningg.com/' },
          { name: meta.seoTitle.split('—')[0].trim(), url: `https://www.firstprincipleslearningg.com/${category}` },
        ]}
      />
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
