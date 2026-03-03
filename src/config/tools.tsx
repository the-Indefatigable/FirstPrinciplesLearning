import React, { type ComponentType } from 'react';

export interface ToolMeta {
  slug: string;
  name: string;
  tag: string;
  description: string;
  category: 'math' | 'physics' | 'cs';
  gradient: string;
  Preview: React.FC;
}

export const toolLoaders: Record<string, () => Promise<{ default: ComponentType }>> = {
  'unit-circle':            () => import('../tools/math/UnitCircle'),
  'plotter-3d':             () => import('../tools/math/Plotter3D'),
  'slope-field':            () => import('../tools/math/SlopeField'),
  'derivative-integral':    () => import('../tools/math/DerivativeIntegral'),
  'graphing-calculator':    () => import('../tools/math/GraphingCalc'),
  'diff-eq-solver':         () => import('../tools/math/DiffEqSolver'),
  'matrix-calculator':      () => import('../tools/math/MatrixCalc'),
  'circuit-builder':        () => import('../tools/physics/CircuitBuilder'),
  'orbital-mechanics':      () => import('../tools/physics/OrbitalMechanics'),
  'ray-optics':             () => import('../tools/physics/RayOptics'),
  'double-pendulum':        () => import('../tools/physics/DoublePendulum'),
  'spring-mass':            () => import('../tools/physics/SpringMass'),
  'momentum-conservation':  () => import('../tools/physics/MomentumConservation'),
  'pathfinding':            () => import('../tools/cs/Pathfinding'),
  'sql-visualizer':         () => import('../tools/cs/SqlVisualizer'),
  'sorting-visualizer':     () => import('../tools/cs/SortingVisualizer'),
  'graph-traversal':        () => import('../tools/cs/GraphTraversal'),
  'recursion-visualizer':   () => import('../tools/cs/RecursionVisualizer'),
  'code-executor':          () => import('../tools/cs/CodeExecutor'),
};

// ── Math Previews (amber) ────────────────────────────────────────────

const PreviewUnitCircle: React.FC = () => (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
    <circle cx="40" cy="40" r="26" stroke="#d97706" strokeWidth="1.5" opacity="0.5" />
    <line x1="14" y1="40" x2="66" y2="40" stroke="#9c9488" strokeWidth="0.8" />
    <line x1="40" y1="14" x2="40" y2="66" stroke="#9c9488" strokeWidth="0.8" />
    <g className="preview-orbit" style={{ transformOrigin: '40px 40px' }}>
      <line x1="40" y1="40" x2="66" y2="40" stroke="#d97706" strokeWidth="2" strokeLinecap="round" />
      <circle cx="66" cy="40" r="3.5" fill="#d97706" />
    </g>
    <path d="M52 40 A12 12 0 0 0 48 30" stroke="#f59e0b" strokeWidth="1.2" fill="none" strokeLinecap="round" />
  </svg>
);

const PreviewPlotter3D: React.FC = () => (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
    <path d="M8 62 Q20 38 32 48 Q44 58 56 34 Q66 18 72 44" stroke="#d97706" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    <path d="M8 70 Q20 48 32 56 Q44 66 56 42 Q66 28 72 52" stroke="#f59e0b" strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.6" />
    <path d="M8 54 Q20 30 32 40 Q44 50 56 26 Q66 10 72 36" stroke="#fde68a" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.5" />
    <line x1="32" y1="40" x2="32" y2="56" stroke="#d97706" strokeWidth="0.8" opacity="0.5" />
    <line x1="56" y1="26" x2="56" y2="42" stroke="#d97706" strokeWidth="0.8" opacity="0.5" />
  </svg>
);

const PreviewSlopeField: React.FC = () => {
  const segments: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  const cols = [12, 24, 36, 48, 60, 72];
  const rows = [12, 24, 36, 48, 60, 72];
  for (const cx of cols) {
    for (const cy of rows) {
      const slope = (cx - 40) / 30;
      const len = 5;
      const dx = len / Math.sqrt(1 + slope * slope);
      const dy = slope * dx;
      segments.push({ x1: cx - dx, y1: cy - dy, x2: cx + dx, y2: cy + dy });
    }
  }
  return (
    <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
      {segments.map((s, i) => (
        <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke="#d97706" strokeWidth="1.3" strokeLinecap="round" opacity="0.6" />
      ))}
    </svg>
  );
};

const PreviewDerivativeIntegral: React.FC = () => (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
    <line x1="10" y1="40" x2="70" y2="40" stroke="#9c9488" strokeWidth="0.8" />
    <line x1="40" y1="10" x2="40" y2="70" stroke="#9c9488" strokeWidth="0.8" />
    <path d="M10 40 Q20 10 30 40 Q40 70 50 40 Q60 10 70 40" stroke="#d97706" strokeWidth="2" fill="none" strokeLinecap="round" />
    <path d="M30 40 Q40 70 50 40 L50 40 L30 40 Z" fill="#d97706" opacity="0.15" />
  </svg>
);

const PreviewGraphingCalc: React.FC = () => (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
    <line x1="10" y1="40" x2="72" y2="40" stroke="#9c9488" strokeWidth="0.8" />
    <line x1="40" y1="10" x2="40" y2="70" stroke="#9c9488" strokeWidth="0.8" />
    <path d="M12 70 Q26 28 40 40 Q54 52 68 8" stroke="#d97706" strokeWidth="2" fill="none" strokeLinecap="round" />
    <path d="M12 56 Q26 50 40 55 Q54 60 68 40" stroke="#f59e0b" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.65" />
  </svg>
);

const PreviewDiffEqSolver: React.FC = () => (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
    <path d="M40 40 Q56 30 56 40 Q56 56 40 56 Q24 56 24 40 Q24 20 46 18 Q66 18 66 40 Q66 62 40 66 Q14 66 12 40" stroke="#d97706" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    <circle cx="40" cy="40" r="2.5" fill="#d97706" />
  </svg>
);

const PreviewMatrixCalc: React.FC = () => (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
    <path d="M16 18 L10 18 L10 62 L16 62" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path d="M64 18 L70 18 L70 62 L64 62" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <text x="24" y="32" fill="#d97706" fontSize="8" textAnchor="middle" fontFamily="monospace" opacity="0.85">2</text>
    <text x="40" y="32" fill="#d97706" fontSize="8" textAnchor="middle" fontFamily="monospace" opacity="0.85">−1</text>
    <text x="56" y="32" fill="#d97706" fontSize="8" textAnchor="middle" fontFamily="monospace" opacity="0.85">3</text>
    <text x="24" y="46" fill="#d97706" fontSize="8" textAnchor="middle" fontFamily="monospace" opacity="0.85">0</text>
    <text x="40" y="46" fill="#d97706" fontSize="8" textAnchor="middle" fontFamily="monospace" opacity="0.85">4</text>
    <text x="56" y="46" fill="#d97706" fontSize="8" textAnchor="middle" fontFamily="monospace" opacity="0.85">−2</text>
    <text x="24" y="60" fill="#d97706" fontSize="8" textAnchor="middle" fontFamily="monospace" opacity="0.85">1</text>
    <text x="40" y="60" fill="#d97706" fontSize="8" textAnchor="middle" fontFamily="monospace" opacity="0.85">−3</text>
    <text x="56" y="60" fill="#d97706" fontSize="8" textAnchor="middle" fontFamily="monospace" opacity="0.85">5</text>
  </svg>
);

// ── Physics Previews (sage/navy) ─────────────────────────────────────

const PreviewCircuitBuilder: React.FC = () => (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
    <line x1="15" y1="20" x2="30" y2="20" stroke="#6b8f71" strokeWidth="1.8" strokeLinecap="round" />
    <line x1="30" y1="15" x2="30" y2="25" stroke="#6b8f71" strokeWidth="2.5" strokeLinecap="round" />
    <line x1="34" y1="17" x2="34" y2="23" stroke="#6b8f71" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="34" y1="20" x2="65" y2="20" stroke="#6b8f71" strokeWidth="1.8" strokeLinecap="round" />
    <line x1="65" y1="20" x2="65" y2="60" stroke="#6b8f71" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M65 35 L60 38 L65 41 L60 44 L65 47 L60 50 L65 53" stroke="#6b8f71" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="15" y1="60" x2="65" y2="60" stroke="#6b8f71" strokeWidth="1.8" strokeLinecap="round" />
    <line x1="15" y1="20" x2="15" y2="60" stroke="#6b8f71" strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="40" cy="60" r="2" fill="#a3c4a8" />
  </svg>
);

const PreviewOrbitalMechanics: React.FC = () => (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
    <ellipse cx="38" cy="42" rx="27" ry="18" stroke="#6b8f71" strokeWidth="1.5" opacity="0.45" />
    <circle cx="32" cy="44" r="6" fill="#1e293b" opacity="0.75" />
    <circle cx="30" cy="42" r="2" fill="#a3c4a8" opacity="0.5" />
    <g className="preview-orbit" style={{ transformOrigin: '38px 42px' }}>
      <circle cx="65" cy="42" r="4" fill="#6b8f71" />
      <circle cx="64" cy="41" r="1.5" fill="#d4edda" opacity="0.8" />
    </g>
  </svg>
);

const PreviewRayOptics: React.FC = () => (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
    <path d="M40 18 Q52 40 40 62 Q28 40 40 18 Z" fill="#a3c4a8" opacity="0.25" stroke="#6b8f71" strokeWidth="1.5" />
    <line x1="10" y1="28" x2="40" y2="34" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="10" y1="40" x2="40" y2="40" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="10" y1="52" x2="40" y2="46" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="40" y1="34" x2="66" y2="40" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
    <line x1="40" y1="40" x2="66" y2="40" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
    <line x1="40" y1="46" x2="66" y2="40" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
    <circle cx="66" cy="40" r="2.5" fill="#d97706" opacity="0.7" />
  </svg>
);

const PreviewDoublePendulum: React.FC = () => (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
    <circle cx="40" cy="12" r="3" fill="#1e293b" opacity="0.6" />
    <line x1="40" y1="12" x2="56" y2="40" stroke="#6b8f71" strokeWidth="2" strokeLinecap="round" />
    <circle cx="56" cy="40" r="5.5" fill="#6b8f71" opacity="0.85" />
    <line x1="56" y1="40" x2="34" y2="62" stroke="#a3c4a8" strokeWidth="2" strokeLinecap="round" />
    <circle cx="34" cy="62" r="4.5" fill="#a3c4a8" />
    <path d="M34 62 Q18 54 20 44 Q28 34 46 48" stroke="#6b8f71" strokeWidth="0.8" fill="none" opacity="0.3" strokeDasharray="2 2" />
  </svg>
);

const PreviewSpringMass: React.FC = () => (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
    <line x1="20" y1="10" x2="60" y2="10" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />
    <path d="M40 10 L40 14 L34 17 L46 20 L34 23 L46 26 L34 29 L46 32 L34 35 L40 38 L40 42" stroke="#6b8f71" strokeWidth="1.8" fill="none" strokeLinecap="round" className="preview-bounce" />
    <rect x="29" y="42" width="22" height="15" rx="3" fill="#6b8f71" className="preview-bounce" />
    <line x1="33" y1="49.5" x2="47" y2="49.5" stroke="#a3c4a8" strokeWidth="1" opacity="0.55" className="preview-bounce" />
  </svg>
);

const PreviewMomentumConservation: React.FC = () => (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
    <circle cx="22" cy="38" r="10" fill="#6b8f71" opacity="0.85" />
    <circle cx="58" cy="42" r="8" fill="#a3c4a8" opacity="0.85" />
    <path d="M8 38 L18 38" stroke="#1e293b" strokeWidth="1.8" strokeLinecap="round" opacity="0.7" />
    <path d="M16 35 L20 38 L16 41" stroke="#1e293b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.7" />
    <path d="M72 42 L62 42" stroke="#1e293b" strokeWidth="1.8" strokeLinecap="round" opacity="0.7" />
    <path d="M64 39 L60 42 L64 45" stroke="#1e293b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.7" />
    <circle cx="40" cy="40" r="3.5" fill="#d97706" opacity="0.45" />
  </svg>
);

// ── CS Previews (terracotta/slate) ───────────────────────────────────

const PreviewPathfinding: React.FC = () => (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
    {[10, 24, 38, 52, 66].map(x => (
      <line key={`v${x}`} x1={x} y1="10" x2={x} y2="70" stroke="#e8e0d4" strokeWidth="0.6" />
    ))}
    {[10, 24, 38, 52, 66].map(y => (
      <line key={`h${y}`} x1="10" y1={y} x2="70" y2={y} stroke="#e8e0d4" strokeWidth="0.6" />
    ))}
    <path
      d="M10 66 L10 52 L24 52 L24 38 L38 38 L38 24 L52 24 L52 10 L66 10"
      stroke="#c2714f" strokeWidth="2.5" fill="none"
      strokeLinecap="round" strokeLinejoin="round"
      className="preview-dash"
    />
    <circle cx="10" cy="66" r="3.5" fill="#c2714f" />
    <circle cx="66" cy="10" r="3.5" fill="#c2714f" opacity="0.55" />
  </svg>
);

const PreviewSqlVisualizer: React.FC = () => (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
    <rect x="10" y="12" width="60" height="12" rx="3" fill="#c2714f" opacity="0.75" />
    <text x="40" y="21.5" fill="white" fontSize="7" textAnchor="middle" fontFamily="monospace" fontWeight="600">id  name  age</text>
    {([{ y: 30, d: '1   Alice   22' }, { y: 43, d: '2   Bob      28' }, { y: 56, d: '3   Carol  31' }] as const).map(({ y, d }) => (
      <g key={y}>
        <rect x="10" y={y} width="60" height="11" fill="#faf0ec" stroke="#e0baa8" strokeWidth="0.6" />
        <text x="16" y={y + 8} fill="#c2714f" fontSize="6.5" fontFamily="monospace">{d}</text>
      </g>
    ))}
  </svg>
);

const PreviewSortingVisualizer: React.FC = () => (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
    {([{ h: 15, x: 8 }, { h: 35, x: 20 }, { h: 22, x: 32 }, { h: 50, x: 44 }, { h: 30, x: 56 }, { h: 56, x: 68 }] as const).map(({ h, x }, i) => (
      <rect key={x} x={x} y={70 - h} width="9" height={h} rx="2"
        fill="#c2714f" opacity={0.45 + i * 0.09}
        className={i === 3 || i === 5 ? 'preview-grow' : ''} />
    ))}
    <line x1="6" y1="70" x2="74" y2="70" stroke="#9c9488" strokeWidth="0.8" />
  </svg>
);

const PreviewGraphTraversal: React.FC = () => (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
    <line x1="40" y1="18" x2="20" y2="44" stroke="#9c9488" strokeWidth="1.2" />
    <line x1="40" y1="18" x2="60" y2="44" stroke="#9c9488" strokeWidth="1.2" />
    <line x1="20" y1="44" x2="32" y2="66" stroke="#9c9488" strokeWidth="1.2" />
    <line x1="60" y1="44" x2="32" y2="66" stroke="#9c9488" strokeWidth="1.2" />
    <line x1="60" y1="44" x2="68" y2="66" stroke="#9c9488" strokeWidth="1.2" />
    <line x1="20" y1="44" x2="14" y2="66" stroke="#9c9488" strokeWidth="1.2" />
    <circle cx="40" cy="18" r="7" fill="#c2714f" opacity="0.95" />
    <circle cx="20" cy="44" r="7" fill="#c2714f" opacity="0.75" />
    <circle cx="60" cy="44" r="7" fill="#e8956f" opacity="0.55" />
    <circle cx="32" cy="66" r="5.5" fill="#faf0ec" stroke="#9c9488" strokeWidth="1.2" />
    <circle cx="68" cy="66" r="5" fill="#faf0ec" stroke="#9c9488" strokeWidth="1.2" />
    <circle cx="14" cy="66" r="5" fill="#faf0ec" stroke="#9c9488" strokeWidth="1.2" />
    <text x="40" y="21" fill="white" fontSize="7" textAnchor="middle" fontFamily="monospace" fontWeight="600">A</text>
    <text x="20" y="47" fill="white" fontSize="7" textAnchor="middle" fontFamily="monospace" fontWeight="600">B</text>
    <text x="60" y="47" fill="white" fontSize="7" textAnchor="middle" fontFamily="monospace" fontWeight="600">C</text>
  </svg>
);

const PreviewRecursionVisualizer: React.FC = () => (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
    <circle cx="40" cy="14" r="7" fill="#c2714f" opacity="0.95" />
    <text x="40" y="17" fill="white" fontSize="6" textAnchor="middle" fontFamily="monospace">f(4)</text>
    <line x1="35" y1="20" x2="22" y2="34" stroke="#9c9488" strokeWidth="1" />
    <line x1="45" y1="20" x2="58" y2="34" stroke="#9c9488" strokeWidth="1" />
    <circle cx="22" cy="38" r="6" fill="#e8956f" opacity="0.85" />
    <text x="22" y="41" fill="white" fontSize="5.5" textAnchor="middle" fontFamily="monospace">f(3)</text>
    <circle cx="58" cy="38" r="6" fill="#e8956f" opacity="0.85" />
    <text x="58" y="41" fill="white" fontSize="5.5" textAnchor="middle" fontFamily="monospace">f(2)</text>
    <line x1="18" y1="44" x2="12" y2="56" stroke="#9c9488" strokeWidth="0.8" />
    <line x1="26" y1="44" x2="32" y2="56" stroke="#9c9488" strokeWidth="0.8" />
    <circle cx="12" cy="59" r="5" fill="#faf0ec" stroke="#c2714f" strokeWidth="1" />
    <text x="12" y="62" fill="#c2714f" fontSize="4.5" textAnchor="middle" fontFamily="monospace">f(2)</text>
    <circle cx="32" cy="59" r="5" fill="#faf0ec" stroke="#c2714f" strokeWidth="1" />
    <text x="32" y="62" fill="#c2714f" fontSize="4.5" textAnchor="middle" fontFamily="monospace">f(1)</text>
    <line x1="54" y1="44" x2="48" y2="56" stroke="#9c9488" strokeWidth="0.8" />
    <circle cx="48" cy="59" r="4.5" fill="#faf0ec" stroke="#c2714f" strokeWidth="1" />
    <text x="48" y="62" fill="#c2714f" fontSize="4.5" textAnchor="middle" fontFamily="monospace">f(1)</text>
  </svg>
);

const PreviewCodeExecutor: React.FC = () => (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
    <rect x="8" y="10" width="64" height="60" rx="5" fill="#1a1612" opacity="0.92" />
    <circle cx="18" cy="19" r="3" fill="#ff5f56" opacity="0.85" />
    <circle cx="27" cy="19" r="3" fill="#ffbd2e" opacity="0.85" />
    <circle cx="36" cy="19" r="3" fill="#27c93f" opacity="0.85" />
    <text x="14" y="34" fill="#c2714f" fontSize="7" fontFamily="monospace">{'>'} def fib(n):</text>
    <text x="18" y="44" fill="#a3c4a8" fontSize="7" fontFamily="monospace">  if n {'<'}= 1:</text>
    <text x="22" y="54" fill="#e8e0d4" fontSize="7" fontFamily="monospace">    return n</text>
    <text x="14" y="64" fill="#f59e0b" fontSize="8" fontFamily="monospace">▌</text>
  </svg>
);

// ── Tool Registry ─────────────────────────────────────────────────────

export const allTools: ToolMeta[] = [
  // Math
  {
    slug: 'unit-circle', name: 'Unit Circle', tag: 'Trigonometry',
    description: 'Explore sine, cosine, and angle relationships on an interactive unit circle.',
    category: 'math',
    gradient: 'linear-gradient(145deg, #fef9ee 0%, #fef3c7 60%, #fde68a 100%)',
    Preview: PreviewUnitCircle,
  },
  {
    slug: 'plotter-3d', name: '3D Surface Plotter', tag: 'Multivariable Calculus',
    description: 'Visualize three-dimensional functions with an interactive WebGL surface plotter.',
    category: 'math',
    gradient: 'linear-gradient(160deg, #fffbeb 0%, #fef3c7 60%, #fde68a 100%)',
    Preview: PreviewPlotter3D,
  },
  {
    slug: 'slope-field', name: 'Slope Field', tag: 'Differential Equations',
    description: 'Draw slope fields for any dy/dx expression and sketch solution curves.',
    category: 'math',
    gradient: 'linear-gradient(130deg, #fef9ee 0%, #fef3c7 55%, #fbbf2440 100%)',
    Preview: PreviewSlopeField,
  },
  {
    slug: 'derivative-integral', name: 'Differentiation & Integration', tag: 'Calculus',
    description: 'Compute derivatives, integrals, and visualize the area under any curve.',
    category: 'math',
    gradient: 'linear-gradient(150deg, #fffbeb 0%, #fef9c3 60%, #fef08a 100%)',
    Preview: PreviewDerivativeIntegral,
  },
  {
    slug: 'graphing-calculator', name: 'Graphing Calculator', tag: 'Algebra & Calculus',
    description: 'Plot multiple functions simultaneously with a full-featured graphing calculator.',
    category: 'math',
    gradient: 'linear-gradient(140deg, #fef9ee 0%, #fef3c7 60%, #fde68a 100%)',
    Preview: PreviewGraphingCalc,
  },
  {
    slug: 'diff-eq-solver', name: 'Differential Equation Solver', tag: 'Differential Equations',
    description: 'Solve and visualize first and second order differential equations step by step.',
    category: 'math',
    gradient: 'linear-gradient(155deg, #fef9ee 0%, #fde68a 55%, #fbbf24 100%)',
    Preview: PreviewDiffEqSolver,
  },
  {
    slug: 'matrix-calculator', name: 'Matrix Calculator', tag: 'Linear Algebra',
    description: 'Perform matrix operations, compute eigenvalues, and visualize transformations.',
    category: 'math',
    gradient: 'linear-gradient(120deg, #fffbeb 0%, #fef3c7 60%, #fde68a 100%)',
    Preview: PreviewMatrixCalc,
  },

  // Physics
  {
    slug: 'circuit-builder', name: 'Circuit Builder', tag: 'Electromagnetism',
    description: 'Build and analyze DC circuits with resistors, capacitors, and voltage sources.',
    category: 'physics',
    gradient: 'linear-gradient(145deg, #f0fdf4 0%, #dcfce7 60%, #bbf7d0 100%)',
    Preview: PreviewCircuitBuilder,
  },
  {
    slug: 'orbital-mechanics', name: 'Orbital Gravity Simulator', tag: 'Mechanics',
    description: "Simulate planetary orbits and explore Kepler's laws with gravitational physics.",
    category: 'physics',
    gradient: 'linear-gradient(160deg, #f0f5f1 0%, #d8eada 60%, #b8d4bd 100%)',
    Preview: PreviewOrbitalMechanics,
  },
  {
    slug: 'ray-optics', name: 'Ray Optics', tag: 'Optics',
    description: 'Trace light rays through lenses and mirrors to understand image formation.',
    category: 'physics',
    gradient: 'linear-gradient(130deg, #ecfdf5 0%, #d1fae5 60%, #a7f3d0 100%)',
    Preview: PreviewRayOptics,
  },
  {
    slug: 'double-pendulum', name: 'Double Pendulum', tag: 'Chaos Theory',
    description: 'Watch chaotic motion emerge from simple physics in a double pendulum system.',
    category: 'physics',
    gradient: 'linear-gradient(150deg, #f0f5f1 0%, #c8deca 60%, #a3c4a8 100%)',
    Preview: PreviewDoublePendulum,
  },
  {
    slug: 'spring-mass', name: 'Spring-Mass System', tag: 'Mechanics',
    description: 'Explore oscillatory motion with adjustable mass, spring constant, and damping.',
    category: 'physics',
    gradient: 'linear-gradient(140deg, #f0fdf4 0%, #dcfce7 60%, #bbf7d0 100%)',
    Preview: PreviewSpringMass,
  },
  {
    slug: 'momentum-conservation', name: 'Momentum Conservation', tag: 'Mechanics',
    description: 'Visualize elastic and inelastic collisions and verify conservation of momentum.',
    category: 'physics',
    gradient: 'linear-gradient(155deg, #f0f5f1 0%, #d8eada 55%, #a3c4a8 100%)',
    Preview: PreviewMomentumConservation,
  },

  // CS
  {
    slug: 'pathfinding', name: 'Pathfinding', tag: 'Graph Algorithms',
    description: 'Visualize A*, Dijkstra, and BFS algorithms finding the shortest path on a grid.',
    category: 'cs',
    gradient: 'linear-gradient(145deg, #faf0ec 0%, #f0d5c8 55%, #e0baa8 100%)',
    Preview: PreviewPathfinding,
  },
  {
    slug: 'sql-visualizer', name: 'SQL Visualizer', tag: 'Databases',
    description: 'Write SQL queries and see the results visualized as interactive table joins.',
    category: 'cs',
    gradient: 'linear-gradient(160deg, #fdf4f2 0%, #fce7e2 55%, #f9c8c0 100%)',
    Preview: PreviewSqlVisualizer,
  },
  {
    slug: 'sorting-visualizer', name: 'Sorting Visualizer', tag: 'Algorithms',
    description: 'Watch bubble sort, merge sort, quicksort, and more animate step by step.',
    category: 'cs',
    gradient: 'linear-gradient(130deg, #faf0ec 0%, #f0d5c8 55%, #c2714f30 100%)',
    Preview: PreviewSortingVisualizer,
  },
  {
    slug: 'graph-traversal', name: 'Graph Traversal', tag: 'Graph Algorithms',
    description: 'Step through BFS and DFS traversals on custom graphs you build yourself.',
    category: 'cs',
    gradient: 'linear-gradient(150deg, #faf0ec 0%, #f5d9ce 55%, #e8b9a8 100%)',
    Preview: PreviewGraphTraversal,
  },
  {
    slug: 'recursion-visualizer', name: 'Recursion Visualizer', tag: 'Algorithms',
    description: 'See recursion call trees unfold in real time for factorial, fibonacci, and more.',
    category: 'cs',
    gradient: 'linear-gradient(140deg, #fdf4f2 0%, #f0d5c8 55%, #e0baa8 100%)',
    Preview: PreviewRecursionVisualizer,
  },
  {
    slug: 'code-executor', name: 'Code Executor', tag: 'Programming',
    description: 'Write and run Python, JavaScript, and more directly in the browser.',
    category: 'cs',
    gradient: 'linear-gradient(155deg, #1e1b17 0%, #2a201a 60%, #3d2b22 100%)',
    Preview: PreviewCodeExecutor,
  },
];

export const getByCategory = (cat: 'math' | 'physics' | 'cs') =>
  allTools.filter(t => t.category === cat);

export const getBySlug = (slug: string) =>
  allTools.find(t => t.slug === slug);
