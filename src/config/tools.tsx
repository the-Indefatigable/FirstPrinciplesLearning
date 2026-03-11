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
  'unit-circle': () => import('../tools/math/UnitCircle'),
  'slope-field': () => import('../tools/math/SlopeField'),
  'derivative-integral': () => import('../tools/math/DerivativeIntegral'),
  'graphing-calculator': () => import('../tools/math/GraphingCalc'),
  'diff-eq-solver': () => import('../tools/math/DiffEqSolver'),
  'matrix-calculator': () => import('../tools/math/MatrixCalc'),
  'circuit-builder': () => import('../tools/physics/CircuitBuilder'),
  'orbital-mechanics': () => import('../tools/physics/OrbitalMechanics'),
  'ray-optics': () => import('../tools/physics/RayOptics'),
  'double-pendulum': () => import('../tools/physics/DoublePendulum'),
  'spring-mass': () => import('../tools/physics/SpringMass'),
  'momentum-conservation': () => import('../tools/physics/MomentumConservation'),
  'pathfinding': () => import('../tools/cs/Pathfinding'),
  'sql-visualizer': () => import('../tools/cs/SqlVisualizer'),
  'sorting-visualizer': () => import('../tools/cs/SortingVisualizer'),
  'graph-traversal': () => import('../tools/cs/GraphTraversal'),
  'recursion-visualizer': () => import('../tools/cs/RecursionVisualizer'),

  // Phase 1 — Math
  'integration-visualizer': () => import('../tools/math/IntegrationVisualizer'),
  'probability-sim': () => import('../tools/math/ProbabilitySim'),
  'taylor-series': () => import('../tools/math/TaylorSeries'),
  'complex-plotter': () => import('../tools/math/ComplexPlotter'),
  'equation-solver': () => import('../tools/math/EquationSolver'),
  'fourier-series': () => import('../tools/math/FourierSeries'),
  'fourier-transform': () => import('../tools/math/FourierTransform'),
  'laplace-transform': () => import('../tools/math/LaplaceTransform'),
  'vector-field': () => import('../tools/math/VectorField'),
  'monte-carlo': () => import('../tools/math/MonteCarloSim'),
  'statistics-calc': () => import('../tools/math/StatisticsCalc'),
  // Phase 2 — Physics
  'projectile-motion': () => import('../tools/physics/ProjectileMotion'),
  'electric-field': () => import('../tools/physics/ElectricField'),
  'wave-superposition': () => import('../tools/physics/WaveSuperposition'),
  'free-body-diagram': () => import('../tools/physics/FreeBodyDiagram'),
  'thermo-pv': () => import('../tools/physics/ThermoPV'),
  // Phase 3 — CS
  'data-structures': () => import('../tools/cs/DataStructures'),
  'bigo-comparator': () => import('../tools/cs/BigOComparator'),
  'regex-tester': () => import('../tools/cs/RegexTester'),
  'fsm-builder': () => import('../tools/cs/FSMBuilder'),
  'code-visualizer': () => import('../tools/cs/CodeVisualizer'),
  'packet-simulator': () => import('../tools/cs/PacketSimulator'),
  'hash-table': () => import('../tools/cs/HashTableViz'),
  'logic-gates': () => import('../tools/cs/LogicGateSim'),
  // New tools
  'number-theory': () => import('../tools/math/NumberTheory'),
  'linear-algebra-viz': () => import('../tools/math/LinearAlgebraViz'),
  'quantum-wave': () => import('../tools/physics/QuantumWave'),
  'em-induction': () => import('../tools/physics/EMInduction'),
  'cpu-pipeline': () => import('../tools/cs/CPUPipeline'),
  'memory-allocator': () => import('../tools/cs/MemoryAllocator'),
  'turing-machine': () => import('../tools/cs/TuringMachine'),
  'statistics-lab': () => import('../tools/math/StatisticsLab'),
  'lens-mirror': () => import('../tools/physics/LensMirror'),
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
    {/* Orbits */}
    <ellipse cx="40" cy="40" rx="24" ry="16" stroke="#f59e0b" strokeWidth="1" opacity="0.3" />
    <ellipse cx="40" cy="40" rx="10" ry="7" stroke="#3b82f6" strokeWidth="1" opacity="0.3" />
    {/* CoM crosshair */}
    <line x1="36" y1="40" x2="44" y2="40" stroke="#6b8f71" strokeWidth="1" opacity="0.5" />
    <line x1="40" y1="36" x2="40" y2="44" stroke="#6b8f71" strokeWidth="1" opacity="0.5" />
    {/* m1 (amber, larger) */}
    <circle cx="30" cy="40" r="8" fill="#f59e0b" opacity="0.85" />
    <circle cx="28" cy="38" r="2.5" fill="#fef3c7" opacity="0.4" />
    {/* m2 (blue, smaller) */}
    <circle cx="64" cy="40" r="5" fill="#3b82f6" opacity="0.85" />
    <circle cx="63" cy="39" r="1.5" fill="#bfdbfe" opacity="0.4" />
    {/* Velocity arrows */}
    <line x1="30" y1="40" x2="30" y2="30" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="64" y1="40" x2="64" y2="52" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" />
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


// ── New Math Previews ─────────────────────────────────────────────────

const PreviewIntegration: React.FC = () => (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
    {[18, 30, 42, 54].map((x, i) => (
      <rect key={x} x={x} y={40 - i * 6} width="10" height={20 + i * 6} fill="#d97706" opacity={0.3 + i * 0.15} rx="1" />
    ))}
    <path d="M14 56 Q28 20 42 36 Q56 52 70 18" stroke="#d97706" strokeWidth="2" fill="none" strokeLinecap="round" />
    <line x1="14" y1="56" x2="70" y2="56" stroke="#9c9488" strokeWidth="0.8" />
  </svg>
);

const PreviewProbability: React.FC = () => (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
    {[{ h: 20, x: 10 }, { h: 35, x: 22 }, { h: 50, x: 34 }, { h: 45, x: 46 }, { h: 28, x: 58 }, { h: 12, x: 70 }].map(({ h, x }, i) => (
      <rect key={i} x={x} y={64 - h} width="10" height={h} fill="#d97706" opacity={0.4 + i * 0.1} rx="2" />
    ))}
    <path d="M15 60Q25 35 40 18Q55 35 65 60" stroke="#fde68a" strokeWidth="1.5" fill="none" strokeDasharray="3 2" />
  </svg>
);

const PreviewTaylor: React.FC = () => (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
    <path d="M8 40Q20 10 40 40Q60 70 72 40" stroke="#d97706" strokeWidth="2" fill="none" strokeDasharray="4 3" />
    <path d="M8 40Q20 14 40 40Q60 66 72 40" stroke="#ef4444" strokeWidth="1.2" fill="none" opacity="0.5" />
    <path d="M8 38Q22 8 40 40Q58 72 72 42" stroke="#3b82f6" strokeWidth="1.2" fill="none" opacity="0.5" />
    <circle cx="40" cy="40" r="3" fill="#22c55e" />
  </svg>
);

const PreviewComplex: React.FC = () => (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
    <line x1="10" y1="40" x2="70" y2="40" stroke="#9c9488" strokeWidth="0.8" />
    <line x1="40" y1="10" x2="40" y2="70" stroke="#9c9488" strokeWidth="0.8" />
    <circle cx="40" cy="40" r="20" stroke="#e8e0d4" strokeWidth="0.8" strokeDasharray="2 2" />
    <line x1="40" y1="40" x2="58" y2="26" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
    <circle cx="58" cy="26" r="3" fill="#3b82f6" />
    <line x1="40" y1="40" x2="28" y2="32" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" />
    <circle cx="28" cy="32" r="3" fill="#22c55e" />
    <circle cx="46" cy="18" r="3" fill="#f59e0b" />
  </svg>
);

const PreviewEquation: React.FC = () => (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
    <text x="40" y="28" fill="#d97706" fontSize="10" textAnchor="middle" fontFamily="monospace" fontWeight="bold">ax² + bx + c</text>
    <line x1="16" y1="34" x2="64" y2="34" stroke="#d97706" strokeWidth="1" opacity="0.4" />
    <text x="20" y="48" fill="#f59e0b" fontSize="8" fontFamily="monospace" opacity="0.7">Δ = b²-4ac</text>
    <text x="20" y="60" fill="#d97706" fontSize="9" fontFamily="monospace" fontWeight="bold">x = 2, 3</text>
    <circle cx="60" cy="54" r="8" fill="#d97706" opacity="0.15" />
    <text x="60" y="57" fill="#d97706" fontSize="8" textAnchor="middle" fontWeight="bold">✓</text>
  </svg>
);

// ── New Physics Previews ──────────────────────────────────────────────

const PreviewProjectile: React.FC = () => (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
    <line x1="10" y1="66" x2="72" y2="66" stroke="#6b8f71" strokeWidth="1.5" />
    <path d="M12 64Q28 10 68 64" stroke="#6b8f71" strokeWidth="2" fill="none" strokeLinecap="round" />
    <circle cx="40" cy="18" r="2.5" fill="#a3c4a8" />
    <line x1="40" y1="18" x2="40" y2="64" stroke="#6b8f71" strokeWidth="0.6" strokeDasharray="2 2" />
    <circle cx="12" cy="64" r="4" fill="#1e293b" opacity="0.6" />
    <line x1="12" y1="64" x2="22" y2="52" stroke="#6b8f71" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const PreviewElectricField: React.FC = () => (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
    <circle cx="28" cy="40" r="8" fill="#ef4444" opacity="0.7" />
    <text x="28" y="44" fill="white" fontSize="10" textAnchor="middle" fontWeight="bold">+</text>
    <circle cx="56" cy="40" r="8" fill="#3b82f6" opacity="0.7" />
    <text x="56" y="44" fill="white" fontSize="10" textAnchor="middle" fontWeight="bold">−</text>
    {[20, 30, 40, 50, 60].map(y => (
      <path key={y} d={`M36 ${y}Q42 ${y + 2} 48 ${y}`} stroke="#6b8f71" strokeWidth="0.8" fill="none" opacity="0.6" />
    ))}
  </svg>
);

const PreviewWave: React.FC = () => (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
    <path d="M8 25Q18 10 28 25Q38 40 48 25Q58 10 68 25" stroke="#3b82f6" strokeWidth="1.5" fill="none" />
    <path d="M8 42Q22 30 36 42Q50 54 64 42" stroke="#22c55e" strokeWidth="1.5" fill="none" />
    <path d="M8 60Q16 45 24 60Q32 75 40 60Q48 45 56 60Q64 75 72 60" stroke="#f59e0b" strokeWidth="2" fill="none" />
  </svg>
);

const PreviewFBD: React.FC = () => (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
    <rect x="28" y="30" width="24" height="20" rx="3" fill="#a3c4a8" opacity="0.5" stroke="#6b8f71" strokeWidth="1.5" />
    <line x1="40" y1="50" x2="40" y2="70" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
    <polygon points="40,70 36,64 44,64" fill="#ef4444" />
    <line x1="40" y1="30" x2="40" y2="12" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
    <polygon points="40,12 36,18 44,18" fill="#3b82f6" />
    <line x1="52" y1="40" x2="70" y2="40" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" />
    <polygon points="70,40 64,36 64,44" fill="#22c55e" />
  </svg>
);

const PreviewThermoPV: React.FC = () => (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
    <line x1="14" y1="14" x2="14" y2="66" stroke="#6b8f71" strokeWidth="1.5" />
    <line x1="14" y1="66" x2="68" y2="66" stroke="#6b8f71" strokeWidth="1.5" />
    <path d="M20 22Q30 28 42 38Q54 48 64 54" stroke="#6b8f71" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    <path d="M20 22L20 66L64 66L64 54" fill="#a3c4a8" opacity="0.15" />
    <circle cx="20" cy="22" r="3" fill="#f59e0b" />
    <circle cx="64" cy="54" r="3" fill="#f59e0b" />
    <text x="10" y="12" fill="#6b8f71" fontSize="7" fontWeight="bold">P</text>
    <text x="68" y="74" fill="#6b8f71" fontSize="7" fontWeight="bold">V</text>
  </svg>
);

// ── New CS Previews ───────────────────────────────────────────────────

const PreviewBinaryTree: React.FC = () => (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
    <line x1="40" y1="18" x2="24" y2="38" stroke="#9c9488" strokeWidth="1.2" />
    <line x1="40" y1="18" x2="56" y2="38" stroke="#9c9488" strokeWidth="1.2" />
    <line x1="24" y1="38" x2="16" y2="58" stroke="#9c9488" strokeWidth="1.2" />
    <line x1="24" y1="38" x2="32" y2="58" stroke="#9c9488" strokeWidth="1.2" />
    <line x1="56" y1="38" x2="64" y2="58" stroke="#9c9488" strokeWidth="1.2" />
    <circle cx="40" cy="18" r="7" fill="#c2714f" />
    <circle cx="24" cy="38" r="7" fill="#c2714f" opacity="0.8" />
    <circle cx="56" cy="38" r="7" fill="#c2714f" opacity="0.8" />
    <circle cx="16" cy="58" r="5.5" fill="#e8956f" opacity="0.6" />
    <circle cx="32" cy="58" r="5.5" fill="#e8956f" opacity="0.6" />
    <circle cx="64" cy="58" r="5.5" fill="#e8956f" opacity="0.6" />
  </svg>
);


const PreviewBigO: React.FC = () => (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
    <line x1="12" y1="68" x2="72" y2="68" stroke="#9c9488" strokeWidth="0.8" />
    <line x1="12" y1="68" x2="12" y2="10" stroke="#9c9488" strokeWidth="0.8" />
    <line x1="12" y1="60" x2="72" y2="60" stroke="#22c55e" strokeWidth="1.5" />
    <path d="M12 64Q30 54 50 44Q65 38 72 32" stroke="#3b82f6" strokeWidth="1.5" fill="none" />
    <path d="M12 64Q25 58 40 48Q55 36 66 24Q72 16 72 12" stroke="#f59e0b" strokeWidth="1.5" fill="none" />
    <path d="M12 64Q20 60 30 52Q40 38 50 14" stroke="#ef4444" strokeWidth="1.5" fill="none" />
  </svg>
);

const PreviewRegex: React.FC = () => (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
    <rect x="8" y="14" width="64" height="52" rx="4" fill="none" stroke="#c2714f" strokeWidth="1.5" />
    <text x="14" y="30" fill="#9c9488" fontSize="7" fontFamily="monospace">The </text>
    <text x="36" y="30" fill="#c2714f" fontSize="7" fontFamily="monospace" fontWeight="bold">fox</text>
    <text x="53" y="30" fill="#9c9488" fontSize="7" fontFamily="monospace"> is</text>
    <rect x="35" y="23" width="17" height="10" rx="2" fill="#c2714f" opacity="0.15" />
    <text x="14" y="44" fill="#e8956f" fontSize="8" fontFamily="monospace">/\\b\\w+/g</text>
    <text x="14" y="58" fill="#22c55e" fontSize="7" fontFamily="monospace">3 matches</text>
  </svg>
);

const PreviewFSM: React.FC = () => (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
    <circle cx="20" cy="40" r="10" stroke="#c2714f" strokeWidth="1.5" fill="none" />
    <circle cx="60" cy="40" r="10" stroke="#c2714f" strokeWidth="1.5" fill="none" />
    <circle cx="60" cy="40" r="7" stroke="#c2714f" strokeWidth="1" fill="none" />
    <line x1="30" y1="40" x2="48" y2="40" stroke="#9c9488" strokeWidth="1.5" />
    <polygon points="48,37 50,40 48,43" fill="#9c9488" />
    <text x="40" y="36" fill="#c2714f" fontSize="7" textAnchor="middle" fontFamily="monospace">a</text>
    <text x="20" y="43" fill="#c2714f" fontSize="7" textAnchor="middle" fontFamily="monospace">q0</text>
    <text x="60" y="43" fill="#c2714f" fontSize="7" textAnchor="middle" fontFamily="monospace">q1</text>
    <path d="M5 40L10 40" stroke="#6b8f71" strokeWidth="1.5" />
    <polygon points="10,37 12,40 10,43" fill="#6b8f71" />
  </svg>
);

const PreviewPacketSim: React.FC = () => (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
    <circle cx="14" cy="40" r="8" fill="#3b82f6" opacity="0.8" />
    <text x="14" y="43" fill="white" fontSize="6" textAnchor="middle" fontFamily="monospace">C</text>
    <circle cx="40" cy="24" r="7" fill="#f59e0b" opacity="0.7" />
    <text x="40" y="27" fill="white" fontSize="5" textAnchor="middle" fontFamily="monospace">R</text>
    <circle cx="40" cy="56" r="7" fill="#f59e0b" opacity="0.7" />
    <text x="40" y="59" fill="white" fontSize="5" textAnchor="middle" fontFamily="monospace">R</text>
    <circle cx="66" cy="40" r="8" fill="#22c55e" opacity="0.8" />
    <text x="66" y="43" fill="white" fontSize="6" textAnchor="middle" fontFamily="monospace">S</text>
    <line x1="22" y1="36" x2="33" y2="27" stroke="#9c9488" strokeWidth="0.8" strokeDasharray="2 2" />
    <line x1="22" y1="44" x2="33" y2="53" stroke="#9c9488" strokeWidth="0.8" strokeDasharray="2 2" />
    <line x1="47" y1="27" x2="58" y2="36" stroke="#9c9488" strokeWidth="0.8" strokeDasharray="2 2" />
    <line x1="47" y1="53" x2="58" y2="44" stroke="#9c9488" strokeWidth="0.8" strokeDasharray="2 2" />
    <rect x="25" y="29" width="12" height="7" rx="2" fill="#8b5cf6" opacity="0.85" />
    <text x="31" y="34" fill="white" fontSize="4" textAnchor="middle" fontWeight="bold">SYN</text>
    <rect x="48" y="44" width="12" height="7" rx="2" fill="#22c55e" opacity="0.85" />
    <text x="54" y="49" fill="white" fontSize="4" textAnchor="middle" fontWeight="bold">ACK</text>
  </svg>
);

const PreviewCodeVisualizer: React.FC = () => (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
    <rect x="8" y="10" width="64" height="60" rx="5" fill="#1a1612" opacity="0.92" />
    {/* Variable rows */}
    <rect x="14" y="22" width="18" height="9" rx="2" fill="#0e2218" stroke="#4ade80" strokeWidth="0.8" />
    <text x="23" y="29" fill="#6ee7b7" fontSize="5.5" textAnchor="middle" fontFamily="monospace">42</text>
    <text x="13" y="29" fill="#9c9488" fontSize="5" fontFamily="monospace">x</text>
    <rect x="14" y="35" width="36" height="9" rx="1" fill="#0a1e2d" stroke="#7dd3fc" strokeWidth="0.6" />
    <text x="32" y="42" fill="#7dd3fc" fontSize="5.5" textAnchor="middle" fontFamily="monospace">"hello"</text>
    <text x="13" y="42" fill="#9c9488" fontSize="5" fontFamily="monospace">s</text>
    {/* Object card */}
    <rect x="14" y="48" width="32" height="16" rx="2" fill="#0e0e1e" stroke="#332c24" strokeWidth="0.8" />
    <text x="16" y="55" fill="#94a3b8" fontSize="4.5" fontFamily="monospace">val: 1</text>
    <text x="16" y="61" fill="#94a3b8" fontSize="4.5" fontFamily="monospace">next: →</text>
    <text x="13" y="56" fill="#9c9488" fontSize="5" fontFamily="monospace">n</text>
    {/* Step badge */}
    <rect x="50" y="20" width="16" height="8" rx="2" fill="#b45309" opacity="0.8" />
    <text x="58" y="26" fill="#fef3c7" fontSize="5" textAnchor="middle" fontWeight="bold">2/8</text>
  </svg>
);

const PreviewFourierSeries: React.FC = () => (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
    <circle cx="25" cy="40" r="16" stroke="#d97706" strokeWidth="0.8" opacity="0.5" />
    <circle cx="25" cy="40" r="10" stroke="#ef4444" strokeWidth="0.6" opacity="0.4" />
    <circle cx="25" cy="40" r="5" stroke="#22c55e" strokeWidth="0.6" opacity="0.4" />
    <line x1="25" y1="40" x2="38" y2="30" stroke="#d97706" strokeWidth="1.5" />
    <circle cx="38" cy="30" r="2" fill="#d97706" />
    <line x1="38" y1="30" x2="75" y2="30" stroke="#d97706" strokeWidth="0.8" strokeDasharray="2 2" opacity="0.5" />
    <path d="M42 40 Q48 25 54 40 Q60 55 66 40 Q72 25 78 40" stroke="#d97706" strokeWidth="1.8" fill="none" />
    <path d="M42 40 L78 40" stroke="#9c9488" strokeWidth="0.5" opacity="0.3" />
  </svg>
);

const PreviewFourierTransform: React.FC = () => (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
    <path d="M8 25 Q16 15 24 25 Q32 35 40 25 Q48 15 56 25 Q64 35 72 25" stroke="#d97706" strokeWidth="1.5" fill="none" />
    <line x1="8" y1="25" x2="72" y2="25" stroke="#9c9488" strokeWidth="0.5" opacity="0.3" />
    <line x1="8" y1="48" x2="72" y2="48" stroke="#9c9488" strokeWidth="0.5" opacity="0.3" />
    <rect x="14" y="42" width="5" height="6" fill="#3b82f6" opacity="0.5" rx="0.5" />
    <rect x="24" y="32" width="5" height="16" fill="#3b82f6" opacity="0.7" rx="0.5" />
    <rect x="34" y="38" width="5" height="10" fill="#3b82f6" opacity="0.6" rx="0.5" />
    <rect x="44" y="36" width="5" height="12" fill="#3b82f6" opacity="0.65" rx="0.5" />
    <rect x="54" y="44" width="5" height="4" fill="#3b82f6" opacity="0.4" rx="0.5" />
    <text x="40" y="14" fill="#d97706" fontSize="6" textAnchor="middle" fontWeight="bold">f(t)</text>
    <text x="40" y="60" fill="#3b82f6" fontSize="6" textAnchor="middle" fontWeight="bold">F(ω)</text>
  </svg>
);

const PreviewLaplace: React.FC = () => (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
    <rect x="4" y="8" width="40" height="64" rx="3" fill="rgba(34,197,94,0.05)" stroke="#9c9488" strokeWidth="0.5" />
    <line x1="24" y1="8" x2="24" y2="72" stroke="#9c9488" strokeWidth="0.7" />
    <line x1="4" y1="40" x2="44" y2="40" stroke="#9c9488" strokeWidth="0.7" />
    <line x1="14" y1="25" x2="22" y2="33" stroke="#ef4444" strokeWidth="2" />
    <line x1="22" y1="25" x2="14" y2="33" stroke="#ef4444" strokeWidth="2" />
    <line x1="14" y1="47" x2="22" y2="55" stroke="#ef4444" strokeWidth="2" />
    <line x1="22" y1="47" x2="14" y2="55" stroke="#ef4444" strokeWidth="2" />
    <text x="24" y="78" fill="#9c9488" fontSize="5" textAnchor="middle">σ</text>
    <text x="2" y="12" fill="#9c9488" fontSize="5">jω</text>
    <path d="M48 36 Q54 20 60 34 Q66 48 72 34 Q74 28 76 30" stroke="#22c55e" strokeWidth="1.5" fill="none" />
    <path d="M48 60 L60 52 Q66 48 72 54 L76 60" stroke="#a855f7" strokeWidth="1.5" fill="none" />
    <text x="62" y="14" fill="#22c55e" fontSize="5" textAnchor="middle">h(t)</text>
    <text x="62" y="70" fill="#a855f7" fontSize="5" textAnchor="middle">|H|</text>
  </svg>
);

const PreviewVectorField: React.FC = () => (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
    <line x1="10" y1="40" x2="70" y2="40" stroke="#9c9488" strokeWidth="0.6" />
    <line x1="40" y1="10" x2="40" y2="70" stroke="#9c9488" strokeWidth="0.6" />
    {/* Rotation field arrows */}
    <line x1="55" y1="20" x2="50" y2="16" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="60" y1="40" x2="60" y2="34" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="55" y1="60" x2="60" y2="56" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="40" y1="65" x2="40" y2="59" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="25" y1="60" x2="20" y2="56" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="20" y1="40" x2="20" y2="46" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="25" y1="20" x2="20" y2="24" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="40" y1="15" x2="40" y2="21" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="40" cy="40" r="2" fill="#d97706" />
    {/* Flow dots */}
    <circle cx="52" cy="18" r="1.5" fill="#fbbf24" opacity="0.6" />
    <circle cx="62" cy="32" r="1.5" fill="#fbbf24" opacity="0.5" />
    <circle cx="58" cy="58" r="1.5" fill="#fbbf24" opacity="0.4" />
    <circle cx="22" cy="52" r="1.5" fill="#fbbf24" opacity="0.6" />
  </svg>
);

const PreviewHashTable: React.FC = () => (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
    {[14, 26, 38, 50, 62].map((y, i) => (
      <g key={i}>
        <rect x="8" y={y} width="14" height="10" rx="2" fill="#c2714f" opacity={0.4 + i * 0.1} />
        <text x="15" y={y + 7.5} fill="white" fontSize="6" textAnchor="middle" fontFamily="monospace">{i}</text>
      </g>
    ))}
    <rect x="28" y="14" width="20" height="10" rx="2" fill="#22c55e" opacity="0.7" />
    <text x="38" y="21.5" fill="white" fontSize="5" textAnchor="middle" fontFamily="monospace">Alice</text>
    <rect x="28" y="26" width="20" height="10" rx="2" fill="#3b82f6" opacity="0.7" />
    <text x="38" y="33.5" fill="white" fontSize="5" textAnchor="middle" fontFamily="monospace">Bob</text>
    <rect x="28" y="38" width="20" height="10" rx="2" fill="#22c55e" opacity="0.7" />
    <text x="38" y="45.5" fill="white" fontSize="5" textAnchor="middle" fontFamily="monospace">Carol</text>
    {/* Collision chain */}
    <rect x="50" y="38" width="20" height="10" rx="2" fill="#ef4444" opacity="0.7" />
    <text x="60" y="45.5" fill="white" fontSize="5" textAnchor="middle" fontFamily="monospace">Eve</text>
    <line x1="48" y1="43" x2="50" y2="43" stroke="#c2714f" strokeWidth="1" />
    <text x="40" y="60" fill="#ef4444" fontSize="5" textAnchor="middle" fontWeight="bold">💥</text>
  </svg>
);

const PreviewMonteCarlo: React.FC = () => (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
    <rect x="10" y="10" width="60" height="60" stroke="#9c9488" strokeWidth="1" rx="2" />
    <path d="M10 70 A60 60 0 0 1 70 10" stroke="#22c55e" strokeWidth="1.5" fill="none" />
    {[{ x: 20, y: 25 }, { x: 35, y: 40 }, { x: 15, y: 55 }, { x: 45, y: 20 }, { x: 50, y: 50 }, { x: 28, y: 62 }, { x: 60, y: 35 }, { x: 55, y: 60 }, { x: 22, y: 38 }].map((p, i) => (
      <circle key={i} cx={p.x} cy={p.y} r="2" fill={Math.sqrt((p.x - 10) ** 2 + (70 - p.y) ** 2) <= 60 ? '#22c55e' : '#ef4444'} opacity="0.8" />
    ))}
    <text x="40" y="78" fill="#d97706" fontSize="6" textAnchor="middle" fontWeight="bold">π ≈ 3.14</text>
  </svg>
);

const PreviewStatistics: React.FC = () => (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
    {[{ x: 12, h: 15 }, { x: 22, h: 28 }, { x: 32, h: 42 }, { x: 42, h: 50 }, { x: 52, h: 35 }, { x: 62, h: 20 }].map(({ x, h }, i) => (
      <rect key={i} x={x} y={64 - h} width="8" height={h} fill="#d97706" opacity={0.5 + i * 0.08} rx="1" />
    ))}
    <line x1="10" y1="64" x2="72" y2="64" stroke="#9c9488" strokeWidth="0.8" />
    <line x1="40" y1="10" x2="40" y2="64" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="3 2" />
    <text x="40" y="8" fill="#ef4444" fontSize="5" textAnchor="middle" fontWeight="bold">μ</text>
    <path d="M10 56Q25 30 40 14Q55 30 70 56" stroke="#22c55e" strokeWidth="1.5" fill="none" opacity="0.6" />
  </svg>
);

const PreviewLogicGate: React.FC = () => (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
    <rect x="8" y="14" width="12" height="8" rx="2" fill="#22c55e" />
    <text x="14" y="20" fill="white" fontSize="5" textAnchor="middle" fontWeight="bold">1</text>
    <rect x="8" y="28" width="12" height="8" rx="2" fill="#ef4444" />
    <text x="14" y="34" fill="white" fontSize="5" textAnchor="middle" fontWeight="bold">0</text>
    <line x1="20" y1="18" x2="30" y2="26" stroke="#9c9488" strokeWidth="1" />
    <line x1="20" y1="32" x2="30" y2="26" stroke="#9c9488" strokeWidth="1" />
    <path d="M30 18 L42 18 Q50 26 42 34 L30 34 Z" fill="#3b82f620" stroke="#3b82f6" strokeWidth="1.5" />
    <text x="38" y="28" fill="#3b82f6" fontSize="6" textAnchor="middle" fontWeight="bold">&amp;</text>
    <line x1="50" y1="26" x2="62" y2="26" stroke="#9c9488" strokeWidth="1" />
    <rect x="62" y="22" width="12" height="8" rx="2" fill="#ef4444" />
    <text x="68" y="28" fill="white" fontSize="5" textAnchor="middle" fontWeight="bold">0</text>
    <rect x="14" y="50" width="52" height="20" rx="3" fill="none" stroke="#9c9488" strokeWidth="0.8" />
    <text x="18" y="58" fill="#9c9488" fontSize="5" fontFamily="monospace">A B | OUT</text>
    <text x="18" y="66" fill="#c2714f" fontSize="5" fontFamily="monospace">1 0 |  0</text>
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
    description: 'Interactive 2D/3D graphing calculator — plot functions, switch to 3D surface mode, and enter immersive cinematic views.',
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
  {
    slug: 'integration-visualizer', name: 'Integration Visualizer', tag: 'Calculus',
    description: 'Watch Riemann sums converge to the integral with adjustable rectangles and methods.',
    category: 'math',
    gradient: 'linear-gradient(135deg, #fef9ee 0%, #fef3c7 55%, #fde68a 100%)',
    Preview: PreviewIntegration,
  },
  {
    slug: 'probability-sim', name: 'Probability Simulator', tag: 'Statistics',
    description: 'Run coin flips, dice rolls, and weighted experiments — see histograms build in real time.',
    category: 'math',
    gradient: 'linear-gradient(145deg, #fffbeb 0%, #fef9c3 55%, #fde68a 100%)',
    Preview: PreviewProbability,
  },
  {
    slug: 'taylor-series', name: 'Taylor Series Explorer', tag: 'Calculus',
    description: 'Build Taylor polynomials term by term and watch them converge to the original function.',
    category: 'math',
    gradient: 'linear-gradient(150deg, #fef9ee 0%, #fef3c7 60%, #fbbf24 100%)',
    Preview: PreviewTaylor,
  },
  {
    slug: 'complex-plotter', name: 'Complex Number Plotter', tag: 'Complex Analysis',
    description: 'Visualize complex number operations on an Argand diagram with magnitude and argument.',
    category: 'math',
    gradient: 'linear-gradient(140deg, #fffbeb 0%, #fef3c7 55%, #fde68a 100%)',
    Preview: PreviewComplex,
  },
  {
    slug: 'equation-solver', name: 'Equation Solver', tag: 'Algebra',
    description: 'Solve linear and quadratic equations with detailed step-by-step explanations.',
    category: 'math',
    gradient: 'linear-gradient(130deg, #fef9ee 0%, #fef3c7 60%, #fde68a 100%)',
    Preview: PreviewEquation,
  },
  {
    slug: 'fourier-series', name: 'Fourier Series', tag: 'Signals',
    description: 'Build periodic waves from sine harmonics with animated epicycles and live convergence.',
    category: 'math',
    gradient: 'linear-gradient(140deg, #fefce8 0%, #fef08a 55%, #fde047 100%)',
    Preview: PreviewFourierSeries,
  },
  {
    slug: 'fourier-transform', name: 'Fourier Transform', tag: 'Signals',
    description: 'Compose signals from sinusoids and see the DFT decompose them into frequency spectra.',
    category: 'math',
    gradient: 'linear-gradient(145deg, #eff6ff 0%, #bfdbfe 55%, #93c5fd 100%)',
    Preview: PreviewFourierTransform,
  },
  {
    slug: 'laplace-transform', name: 'Laplace Transform', tag: 'Signals & Systems',
    description: 'Explore pole-zero plots, impulse responses, and Bode magnitudes for classic transfer functions.',
    category: 'math',
    gradient: 'linear-gradient(150deg, #faf5ff 0%, #e9d5ff 55%, #d8b4fe 100%)',
    Preview: PreviewLaplace,
  },
  {
    slug: 'vector-field', name: 'Vector Field Visualizer', tag: 'Multivariable Calculus',
    description: 'Visualize 2D vector fields with animated flow particles, divergence and curl heatmaps, and custom expressions.',
    category: 'math',
    gradient: 'linear-gradient(140deg, #fef9ee 0%, #fef3c7 55%, #fde68a 100%)',
    Preview: PreviewVectorField,
  },
  {
    slug: 'monte-carlo', name: 'Monte Carlo Simulator', tag: 'Statistics',
    description: 'Estimate π, compute integrals, and run Buffon\'s needle — see how random sampling converges to exact values.',
    category: 'math',
    gradient: 'linear-gradient(145deg, #fef9ee 0%, #fef3c7 55%, #fde68a 100%)',
    Preview: PreviewMonteCarlo,
  },
  {
    slug: 'statistics-calc', name: 'Statistics Calculator', tag: 'Statistics',
    description: 'Visualize data with histograms, compute mean, median, mode, std dev, quartiles, and fit a normal curve.',
    category: 'math',
    gradient: 'linear-gradient(135deg, #fffbeb 0%, #fef9c3 55%, #fde68a 100%)',
    Preview: PreviewStatistics,
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
    slug: 'orbital-mechanics', name: 'Two-Body Problem', tag: 'Classical Mechanics',
    description: 'Explore the gravitational two-body problem with live KaTeX equations, reduced-mass derivation, and dual-perspective simulation (lab frame & center-of-mass frame).',
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
  {
    slug: 'projectile-motion', name: 'Projectile Motion Lab', tag: 'Mechanics',
    description: 'Fire projectiles with adjustable angle, speed, and air resistance. See trajectory, range, and max height.',
    category: 'physics',
    gradient: 'linear-gradient(145deg, #f0fdf4 0%, #dcfce7 55%, #bbf7d0 100%)',
    Preview: PreviewProjectile,
  },
  {
    slug: 'electric-field', name: 'Electric Field Visualizer', tag: 'Electromagnetism',
    description: 'Place positive and negative charges, see field lines and equipotential regions in real time.',
    category: 'physics',
    gradient: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 60%, #a7f3d0 100%)',
    Preview: PreviewElectricField,
  },
  {
    slug: 'wave-superposition', name: 'Wave Superposition', tag: 'Waves',
    description: 'Combine two waves with adjustable frequency, amplitude, and phase to see interference patterns.',
    category: 'physics',
    gradient: 'linear-gradient(150deg, #f0f5f1 0%, #d8eada 55%, #b8d4bd 100%)',
    Preview: PreviewWave,
  },
  {
    slug: 'free-body-diagram', name: 'Free Body Diagram', tag: 'Mechanics',
    description: 'Build force diagrams with draggable forces, auto-compute net force and acceleration.',
    category: 'physics',
    gradient: 'linear-gradient(140deg, #f0fdf4 0%, #dcfce7 55%, #bbf7d0 100%)',
    Preview: PreviewFBD,
  },
  {
    slug: 'thermo-pv', name: 'PV Diagram', tag: 'Thermodynamics',
    description: 'Explore isothermal, adiabatic, isobaric, and isochoric processes with work calculation.',
    category: 'physics',
    gradient: 'linear-gradient(130deg, #f0f5f1 0%, #c8deca 60%, #a3c4a8 100%)',
    Preview: PreviewThermoPV,
  },
  {
    slug: 'lens-mirror', name: 'Lens & Mirror', tag: 'Optics',
    description: 'Trace rays through converging and diverging lenses, concave and convex mirrors. See image formation with the thin lens equation.',
    category: 'physics',
    gradient: 'linear-gradient(140deg, #f0f4ff 0%, #dbeafe 55%, #bfdbfe 100%)',
    Preview: () => (
      <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
        {/* Lens */}
        <path d="M40 18 Q50 40 40 62 Q30 40 40 18Z" stroke="#3b82f6" strokeWidth="1.5" fill="#3b82f618" />
        {/* Optical axis */}
        <line x1="8" y1="40" x2="72" y2="40" stroke="#9c9488" strokeWidth="0.8" strokeDasharray="3 2" />
        {/* Object arrow */}
        <line x1="16" y1="40" x2="16" y2="26" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" />
        <polygon points="16,23 13,29 19,29" fill="#22c55e" />
        {/* Focal points */}
        <circle cx="30" cy="40" r="2" fill="#3b82f6" opacity="0.6" />
        <circle cx="50" cy="40" r="2" fill="#3b82f6" opacity="0.6" />
        {/* Rays */}
        <line x1="16" y1="26" x2="40" y2="26" stroke="#ef4444" strokeWidth="1" opacity="0.7" />
        <line x1="40" y1="26" x2="64" y2="56" stroke="#ef4444" strokeWidth="1" opacity="0.7" />
        <line x1="16" y1="26" x2="64" y2="40" stroke="#f59e0b" strokeWidth="1" opacity="0.6" strokeDasharray="2 2" />
        {/* Image arrow */}
        <line x1="64" y1="40" x2="64" y2="56" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
        <polygon points="64,59 61,53 67,53" fill="#ef4444" />
      </svg>
    ),
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
    slug: 'data-structures', name: 'Data Structures', tag: 'Data Structures',
    description: 'Interactive playground for Stack, Queue, Linked List, and Binary Search Tree — all in one tabbed tool.',
    category: 'cs',
    gradient: 'linear-gradient(145deg, #faf0ec 0%, #f0d5c8 55%, #e0baa8 100%)',
    Preview: PreviewBinaryTree,
  },
  {
    slug: 'bigo-comparator', name: 'Big-O Comparator', tag: 'Algorithms',
    description: 'Plot O(1) through O(2ⁿ) growth curves overlaid to visually compare complexity classes.',
    category: 'cs',
    gradient: 'linear-gradient(140deg, #fdf4f2 0%, #f0d5c8 55%, #e0baa8 100%)',
    Preview: PreviewBigO,
  },
  {
    slug: 'regex-tester', name: 'Regex Tester', tag: 'Programming',
    description: 'Test regular expressions with live highlighting, match details, and a handy cheatsheet.',
    category: 'cs',
    gradient: 'linear-gradient(155deg, #faf0ec 0%, #f0d5c8 55%, #c2714f30 100%)',
    Preview: PreviewRegex,
  },
  {
    slug: 'fsm-builder', name: 'Finite State Machine', tag: 'Automata',
    description: 'Build finite automata with draggable states, add transitions, and test input strings.',
    category: 'cs',
    gradient: 'linear-gradient(145deg, #fdf4f2 0%, #fce7e2 55%, #f9c8c0 100%)',
    Preview: PreviewFSM,
  },
  {
    slug: 'code-visualizer', name: 'Code Visualizer', tag: 'Programming',
    description: 'Step through JavaScript code and watch variables, arrays, and objects come alive in memory.',
    category: 'cs',
    gradient: 'linear-gradient(155deg, #1e1b17 0%, #2a201a 60%, #3d2b22 100%)',
    Preview: PreviewCodeVisualizer,
  },
  {
    slug: 'packet-simulator', name: 'Packet Simulator', tag: 'Networking',
    description: 'Simulate TCP handshakes, data transfer, packet loss, retransmission, and UDP — animated network packet flow.',
    category: 'cs',
    gradient: 'linear-gradient(145deg, #faf0ec 0%, #f0d5c8 55%, #e0baa8 100%)',
    Preview: PreviewPacketSim,
  },
  {
    slug: 'hash-table', name: 'Hash Table Visualizer', tag: 'Data Structures',
    description: 'Insert keys and watch hashing, collisions, chaining, and open addressing in action.',
    category: 'cs',
    gradient: 'linear-gradient(150deg, #fdf4f2 0%, #fce7e2 55%, #f9c8c0 100%)',
    Preview: PreviewHashTable,
  },
  {
    slug: 'logic-gates', name: 'Logic Gate Simulator', tag: 'Digital Logic',
    description: 'Build circuits with AND, OR, NOT, NAND, NOR, XOR, XNOR gates — toggle inputs and see truth tables.',
    category: 'cs',
    gradient: 'linear-gradient(140deg, #fdf4f2 0%, #f0d5c8 55%, #e0baa8 100%)',
    Preview: PreviewLogicGate,
  },

  // ── New Math tools ────────────────────────────────────────────────
  {
    slug: 'number-theory', name: 'Number Theory Explorer', tag: 'Number Theory',
    description: 'Visualize the Euclidean algorithm for GCD, prime factorization trees, and modular arithmetic on a clock.',
    category: 'math',
    gradient: 'linear-gradient(145deg, #fef9ee 0%, #fef3c7 55%, #fde68a 100%)',
    Preview: () => (
      <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
        <circle cx="40" cy="40" r="28" stroke="#d97706" strokeWidth="1.2" opacity="0.5" />
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * 2 * Math.PI - Math.PI / 2;
          const x = 40 + 24 * Math.cos(a), y = 40 + 24 * Math.sin(a);
          return <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 4 : 2.5} fill={i === 0 ? '#d97706' : '#fde68a'} opacity={0.7} />;
        })}
        <text x="40" y="44" textAnchor="middle" fontSize="10" fill="#d97706" fontWeight="bold" fontFamily="monospace">mod</text>
      </svg>
    ),
  },
  {
    slug: 'linear-algebra-viz', name: 'Linear Algebra Visualizer', tag: 'Linear Algebra',
    description: 'Animate 2×2 matrix transformations on a grid. See eigenvectors, determinant, and how matrices warp space.',
    category: 'math',
    gradient: 'linear-gradient(140deg, #fffbeb 0%, #fef3c7 55%, #fde68a 100%)',
    Preview: () => (
      <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
        <line x1="10" y1="40" x2="70" y2="40" stroke="#9c9488" strokeWidth="0.6" />
        <line x1="40" y1="10" x2="40" y2="70" stroke="#9c9488" strokeWidth="0.6" />
        <polygon points="40,40 62,40 62,18 40,18" fill="#d97706" opacity="0.18" stroke="#d97706" strokeWidth="1.5" />
        <line x1="40" y1="40" x2="62" y2="40" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
        <line x1="40" y1="40" x2="40" y2="18" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" />
        <polygon points="62,40 57,37 57,43" fill="#3b82f6" />
        <polygon points="40,18 37,23 43,23" fill="#22c55e" />
      </svg>
    ),
  },

  {
    slug: 'statistics-lab', name: 'Statistics Lab', tag: 'Statistics',
    description: 'Full stats workbench: descriptive analysis with histograms & box plots, distribution explorer, hypothesis testing (t-test, z-test), and linear regression.',
    category: 'math',
    gradient: 'linear-gradient(140deg, #fffbeb 0%, #fef3c7 55%, #fbbf24 100%)',
    Preview: () => (
      <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
        {/* Histogram bars */}
        {[{ x: 8, h: 16, o: 0.5 }, { x: 19, h: 30, o: 0.65 }, { x: 30, h: 44, o: 0.85 }, { x: 41, h: 36, o: 0.75 }, { x: 52, h: 20, o: 0.55 }, { x: 63, h: 10, o: 0.4 }].map(({ x, h, o }, i) => (
          <rect key={i} x={x} y={68 - h} width={9} height={h} rx={1} fill="#d97706" opacity={o} />
        ))}
        {/* Mean line */}
        <line x1="38" y1="22" x2="38" y2="68" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="3 2" />
        {/* Normal curve */}
        <path d="M8 66 Q20 30 38 22 Q56 30 72 66" stroke="#22c55e" strokeWidth="1.5" fill="none" opacity="0.7" />
        {/* Axis */}
        <line x1="7" y1="68" x2="74" y2="68" stroke="#9c9488" strokeWidth="1" />
        {/* Regression dots & line */}
        {[{ x: 12, y: 56 }, { x: 22, y: 50 }, { x: 32, y: 43 }, { x: 42, y: 37 }, { x: 55, y: 30 }].map(({ x, y }, i) => (
          <circle key={i} cx={x} cy={y} r={1.8} fill="#f59e0b" />
        ))}
        <line x1="10" y1="58" x2="58" y2="28" stroke="#f59e0b" strokeWidth="1" opacity="0.6" />
      </svg>
    ),
  },

  // ── New Physics tools ─────────────────────────────────────────────
  {
    slug: 'quantum-wave', name: 'Quantum Wave Function', tag: 'Quantum Mechanics',
    description: 'Visualize ψₙ(x) and |ψ|² for a particle in a box. Animate the time-dependent phase and see quantized energy levels.',
    category: 'physics',
    gradient: 'linear-gradient(145deg, #eff6ff 0%, #bfdbfe 55%, #93c5fd 100%)',
    Preview: () => (
      <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
        <line x1="8" y1="40" x2="72" y2="40" stroke="#9c9488" strokeWidth="0.6" />
        <path d="M8 40 Q20 16 32 40 Q44 64 56 40 Q64 24 72 40" stroke="#3b82f6" strokeWidth="2" fill="none" />
        <path d="M8 40 Q20 52 32 60 Q44 52 56 60 Q64 52 72 60" stroke="#22c55e" strokeWidth="1.2" fill="none" opacity="0.6" />
        <text x="40" y="14" textAnchor="middle" fontSize="8" fill="#3b82f6" fontFamily="monospace">ψ₂(x)</text>
        <text x="40" y="74" textAnchor="middle" fontSize="7" fill="#22c55e" fontFamily="monospace">|ψ|²</text>
      </svg>
    ),
  },
  {
    slug: 'em-induction', name: 'Electromagnetic Induction', tag: 'Electromagnetism',
    description: "Move a bar magnet through a coil and watch Faraday's law in action — see induced EMF and flux change in real time.",
    category: 'physics',
    gradient: 'linear-gradient(145deg, #f0fdf4 0%, #dcfce7 55%, #86efac 100%)',
    Preview: () => (
      <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
        <rect x="8" y="34" width="24" height="12" rx="3" fill="none" stroke="#3b82f6" strokeWidth="1.5" />
        <rect x="8" y="34" width="12" height="12" rx="2" fill="#3b82f6" opacity="0.3" />
        <text x="14" y="43" textAnchor="middle" fontSize="6" fill="#3b82f6" fontWeight="bold">S N</text>
        {[28, 36, 44, 52].map(x => (
          <ellipse key={x} cx={x + 4} cy="40" rx="4" ry="14" stroke="#b45309" strokeWidth="1.5" fill="none" />
        ))}
        <circle cx="68" cy="40" r="10" fill="none" stroke="#9c9488" strokeWidth="1" />
        <line x1="68" y1="40" x2="68" y2="36" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  // ── New CS tools ──────────────────────────────────────────────────
  {
    slug: 'cpu-pipeline', name: 'CPU Pipeline Simulator', tag: 'Computer Architecture',
    description: 'Step through IF→ID→EX→MEM→WB stages. See data hazards (RAW), control hazards, and how instructions overlap.',
    category: 'cs',
    gradient: 'linear-gradient(145deg, #faf0ec 0%, #f0d5c8 55%, #e0baa8 100%)',
    Preview: () => (
      <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
        {['IF', 'ID', 'EX', 'MEM', 'WB'].map((s, i) => (
          <g key={s}>
            <rect x={4 + i * 15} y={32} width={13} height={16} rx={2}
              fill={['#3b82f6', '#8b5cf6', '#f59e0b', '#22c55e', '#ef4444'][i]} opacity={0.7} />
            <text x={10 + i * 15} y={43} textAnchor="middle" fontSize={5}
              fill="white" fontFamily="monospace" fontWeight="bold">{s}</text>
          </g>
        ))}
        {[0, 1, 2, 3].map(row => (
          <g key={row}>
            {Array.from({ length: 5 - row }, (_, i) => (
              <rect key={i} x={4 + (i + row) * 15} y={56 - row * 10} width={13} height={7} rx={1}
                fill={['#3b82f6', '#8b5cf6', '#f59e0b', '#22c55e', '#ef4444'][i]} opacity={0.25} />
            ))}
          </g>
        ))}
      </svg>
    ),
  },
  {
    slug: 'memory-allocator', name: 'Memory Allocator', tag: 'Operating Systems',
    description: 'malloc() and free() heap blocks. Compare first-fit, best-fit, worst-fit strategies and watch fragmentation form.',
    category: 'cs',
    gradient: 'linear-gradient(150deg, #fdf4f2 0%, #fce7e2 55%, #f9c8c0 100%)',
    Preview: () => (
      <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
        <rect x="8" y="28" width="64" height="24" rx="3" fill="none" stroke="#9c9488" strokeWidth="1" />
        <rect x="8" y="28" width="20" height="24" rx="2" fill="#3b82f6" opacity="0.6" />
        <rect x="30" y="28" width="10" height="24" fill="#9c9488" opacity="0.2" />
        <rect x="42" y="28" width="16" height="24" fill="#22c55e" opacity="0.6" />
        <rect x="60" y="28" width="12" height="24" rx="2" fill="#9c9488" opacity="0.2" />
        <text x="18" y="43" textAnchor="middle" fontSize="6" fill="white" fontFamily="monospace">A</text>
        <text x="35" y="43" textAnchor="middle" fontSize="5" fill="#9c9488" fontFamily="monospace">free</text>
        <text x="50" y="43" textAnchor="middle" fontSize="6" fill="white" fontFamily="monospace">B</text>
        <text x="66" y="43" textAnchor="middle" fontSize="5" fill="#9c9488" fontFamily="monospace">free</text>
        <text x="40" y="18" textAnchor="middle" fontSize="7" fill="#9c9488" fontFamily="monospace">HEAP</text>
        <text x="40" y="64" textAnchor="middle" fontSize="6" fill="#c2714f" fontFamily="monospace">malloc / free</text>
      </svg>
    ),
  },
  {
    slug: 'turing-machine', name: 'Turing Machine', tag: 'Theory of Computation',
    description: 'Run Turing machines step by step on a tape. Preloaded with 0ⁿ1ⁿ recognizer, binary increment, and string copy.',
    category: 'cs',
    gradient: 'linear-gradient(140deg, #fdf4f2 0%, #f0d5c8 55%, #c2714f30 100%)',
    Preview: () => (
      <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
        {['0', '0', '1', 'X', '1', '_', '_'].map((c, i) => (
          <g key={i}>
            <rect x={4 + i * 10} y={30} width={9} height={12} rx={1}
              fill={i === 3 ? '#d9770622' : 'none'}
              stroke={i === 3 ? '#d97706' : '#9c9488'} strokeWidth={i === 3 ? 1.5 : 0.8} />
            <text x={8.5 + i * 10} y={40} textAnchor="middle" fontSize={7}
              fill={i === 3 ? '#d97706' : c === '_' ? '#6b5f52' : '#c2714f'}
              fontFamily="monospace" fontWeight={i === 3 ? 700 : 400}>{c}</text>
          </g>
        ))}
        <polygon points="38,44 35,50 41,50" fill="#d97706" />
        <text x="38" y="58" textAnchor="middle" fontSize="6" fill="#d97706" fontFamily="monospace">q1</text>
        <text x="40" y="22" textAnchor="middle" fontSize="6" fill="#9c9488" fontFamily="monospace">Tape</text>
      </svg>
    ),
  },
];

export const getByCategory = (cat: 'math' | 'physics' | 'cs') =>
  allTools.filter(t => t.category === cat);

export const getBySlug = (slug: string) =>
  allTools.find(t => t.slug === slug);

