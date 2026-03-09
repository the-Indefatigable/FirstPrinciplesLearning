#!/usr/bin/env node
/**
 * Seed 56 SEO blog posts into Firestore.
 * Run: node scripts/seed-blogs.mjs
 * Uses Firebase Admin SDK with credentials from firstprinciple-blog/.env.local
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load env from blog project ──
const envPath = resolve(__dirname, '../../firstprinciple-blog/.env.local');
const envText = readFileSync(envPath, 'utf-8');
const env = {};
for (const line of envText.split('\n')) {
    if (!line.trim() || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx < 0) continue;
    let val = line.slice(idx + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    val = val.replace(/\\n/g, '\n');
    env[line.slice(0, idx).trim()] = val;
}

initializeApp({ credential: cert({ projectId: env.FB_PROJECT_ID, clientEmail: env.FB_CLIENT_EMAIL, privateKey: env.FB_PRIVATE_KEY }) });
const db = getFirestore();
const DOMAIN = 'https://www.firstprincipleslearningg.com';

// ── Tool definitions: [slug, name, tag, category, conceptName, briefExplanation] ──
const tools = [
    // Math (20)
    ['unit-circle', 'Unit Circle Explorer', 'Trigonometry', 'math', 'the Unit Circle', 'maps every angle to (cos θ, sin θ) on a radius-1 circle — the foundation of all trigonometry'],
    ['plotter-3d', '3D Surface Plotter', 'Multivariable Calculus', 'math', '3D Surface Plotting', 'visualizes z = f(x,y) as a rotatable WebGL surface so you can see peaks, valleys, and saddle points'],
    ['slope-field', 'Slope Field Visualizer', 'Differential Equations', 'math', 'Slope Fields', 'draws tiny line segments showing dy/dx at every point, revealing solution curves without solving'],
    ['derivative-integral', 'Differentiation & Integration', 'Calculus', 'math', 'Derivatives and Integrals', 'computes instantaneous rates of change (derivatives) and accumulated area (integrals) visually'],
    ['graphing-calculator', 'Graphing Calculator', 'Algebra & Calculus', 'math', 'Function Graphing', 'plots multiple y = f(x) curves simultaneously to see roots, extrema, and intersections'],
    ['diff-eq-solver', 'Differential Equation Solver', 'Differential Equations', 'math', 'Differential Equations', 'solves and visualizes 1st/2nd order ODEs step by step with Euler and RK4 methods'],
    ['matrix-calculator', 'Matrix Calculator', 'Linear Algebra', 'math', 'Matrix Operations', 'performs addition, multiplication, determinants, inverses, and eigenvalue computations'],
    ['integration-visualizer', 'Integration Visualizer', 'Calculus', 'math', 'Riemann Sums', 'shows left, right, midpoint, and trapezoidal rectangles converging to the true integral'],
    ['probability-sim', 'Probability Simulator', 'Statistics', 'math', 'Probability Simulations', 'runs coins, dice, and custom experiments — watch histograms build toward the theoretical distribution'],
    ['taylor-series', 'Taylor Series Explorer', 'Calculus', 'math', 'Taylor Series', 'adds polynomial terms one by one, watching the partial sums converge to the original function'],
    ['complex-plotter', 'Complex Number Plotter', 'Complex Analysis', 'math', 'Complex Numbers', 'plots complex numbers on an Argand diagram showing magnitude, argument, and operations'],
    ['equation-solver', 'Equation Solver', 'Algebra', 'math', 'Equation Solving', 'solves linear and quadratic equations with detailed, step-by-step algebraic explanations'],
    ['fourier-series', 'Fourier Series', 'Signals', 'math', 'Fourier Series', 'builds periodic waves from sine harmonics with animated epicycles and live convergence'],
    ['fourier-transform', 'Fourier Transform', 'Signals', 'math', 'the Fourier Transform', 'decomposes any signal into its constituent frequencies — shown as a live spectrum'],
    ['laplace-transform', 'Laplace Transform Visualizer', 'Signals & Systems', 'math', 'the Laplace Transform', 'plots poles, zeros, impulse responses, and Bode magnitude for classic transfer functions'],
    ['vector-field', 'Vector Field Visualizer', 'Multivariable Calculus', 'math', 'Vector Fields', 'shows 2D vector fields with flow particles, divergence heatmaps, and curl visualization'],
    ['monte-carlo', 'Monte Carlo Simulator', 'Statistics', 'math', 'Monte Carlo Methods', 'estimates π, computes integrals, and runs Buffon\'s needle via random sampling convergence'],
    ['statistics-calc', 'Statistics Calculator', 'Statistics', 'math', 'Descriptive Statistics', 'computes mean, median, mode, std dev, quartiles and fits a normal curve to your data'],
    ['number-theory', 'Number Theory Explorer', 'Number Theory', 'math', 'Number Theory', 'visualizes GCD via the Euclidean algorithm, prime factorization trees, and modular arithmetic'],
    ['linear-algebra-viz', 'Linear Algebra Visualizer', 'Linear Algebra', 'math', 'Linear Transformations', 'animates 2×2 matrix transformations on a grid showing eigenvectors and how matrices warp space'],
    // Physics (15)
    ['circuit-builder', 'Circuit Builder', 'Electromagnetism', 'physics', 'Circuit Analysis', 'builds and analyzes DC circuits with resistors, capacitors, and voltage sources using Kirchhoff\'s laws'],
    ['orbital-mechanics', 'Orbital Gravity Simulator', 'Mechanics', 'physics', 'Orbital Mechanics', 'simulates planetary orbits and demonstrates Kepler\'s three laws of planetary motion'],
    ['ray-optics', 'Ray Optics Simulator', 'Optics', 'physics', 'Ray Optics', 'traces light rays through lenses and mirrors showing real and virtual image formation'],
    ['double-pendulum', 'Double Pendulum', 'Chaos Theory', 'physics', 'Chaos Theory', 'demonstrates chaotic motion — tiny changes in initial conditions lead to wildly different paths'],
    ['spring-mass', 'Spring-Mass System', 'Mechanics', 'physics', 'Simple Harmonic Motion', 'explores oscillatory motion with adjustable mass, spring constant, and damping'],
    ['momentum-conservation', 'Momentum Conservation Lab', 'Mechanics', 'physics', 'Conservation of Momentum', 'simulates elastic and inelastic collisions, verifying p₁ + p₂ = const before and after'],
    ['projectile-motion', 'Projectile Motion Lab', 'Mechanics', 'physics', 'Projectile Motion', 'fires projectiles with adjustable angle, speed, and air resistance showing trajectory and range'],
    ['electric-field', 'Electric Field Visualizer', 'Electromagnetism', 'physics', 'Electric Fields', 'places charges and shows field lines and equipotential contours updating in real time'],
    ['wave-superposition', 'Wave Superposition', 'Waves', 'physics', 'Wave Interference', 'combines two waves with adjustable frequency, amplitude, and phase to show constructive/destructive interference'],
    ['free-body-diagram', 'Free Body Diagram', 'Mechanics', 'physics', 'Force Diagrams', 'builds force diagrams with draggable arrows, auto-computing net force and acceleration'],
    ['thermo-pv', 'PV Diagram Tool', 'Thermodynamics', 'physics', 'PV Diagrams', 'explores isothermal, adiabatic, isobaric, and isochoric processes with work calculation'],
    ['quantum-wave', 'Quantum Wave Function', 'Quantum Mechanics', 'physics', 'Quantum Wave Functions', 'visualizes ψₙ(x) and |ψ|² for a particle in a box with animated time-dependent phase'],
    ['em-induction', 'Electromagnetic Induction', 'Electromagnetism', 'physics', 'Electromagnetic Induction', 'moves a magnet through a coil showing Faraday\'s law, induced EMF, and flux change'],
    ['lens-mirror', 'Lens & Mirror Calculator', 'Optics', 'physics', 'Thin Lens Optics', 'traces principal rays through converging/diverging lenses and concave/convex mirrors'],
    // CS (21)
    ['pathfinding', 'Pathfinding Visualizer', 'Graph Algorithms', 'cs', 'Pathfinding Algorithms', 'visualizes A*, Dijkstra, and BFS finding shortest paths on a grid with walls'],
    ['sql-visualizer', 'SQL Visualizer', 'Databases', 'cs', 'SQL Queries', 'writes SQL and sees results as interactive table joins with highlighted matching rows'],
    ['sorting-visualizer', 'Sorting Visualizer', 'Algorithms', 'cs', 'Sorting Algorithms', 'animates bubble, merge, quick, heap, and insertion sort step by step with color-coded comparisons'],
    ['graph-traversal', 'Graph Traversal', 'Graph Algorithms', 'cs', 'Graph Traversal', 'steps through BFS and DFS on custom graphs you build, showing visited order and discovery edges'],
    ['recursion-visualizer', 'Recursion Visualizer', 'Algorithms', 'cs', 'Recursion', 'shows call trees unfolding in real time for factorial, fibonacci, merge sort, and more'],
    ['binary-tree', 'Binary Search Tree', 'Data Structures', 'cs', 'Binary Search Trees', 'insert, delete, and traverse a BST with animated in-order, pre-order, and post-order walks'],
    ['stack-queue', 'Stack & Queue Visualizer', 'Data Structures', 'cs', 'Stacks and Queues', 'push, pop, enqueue, dequeue — see LIFO and FIFO data structures side by side'],
    ['linked-list', 'Linked List Visualizer', 'Data Structures', 'cs', 'Linked Lists', 'visual insert, delete, and reverse operations with animated pointer arrows'],
    ['bigo-comparator', 'Big-O Comparator', 'Algorithms', 'cs', 'Big-O Notation', 'plots O(1) through O(2ⁿ) growth curves overlaid to compare algorithm complexity classes'],
    ['regex-tester', 'Regex Tester', 'Programming', 'cs', 'Regular Expressions', 'tests patterns with live syntax highlighting, match groups, and a built-in cheatsheet'],
    ['fsm-builder', 'Finite State Machine Builder', 'Automata', 'cs', 'Finite Automata', 'builds DFA/NFA with draggable states and transitions, then tests input string acceptance'],
    ['code-visualizer', 'Code Visualizer', 'Programming', 'cs', 'Code Execution', 'steps through JavaScript code watching variables, arrays, and objects come alive in memory'],
    ['packet-simulator', 'Packet Simulator', 'Networking', 'cs', 'Network Packets', 'simulates TCP handshake, data transfer, packet loss, retransmission, and UDP flow'],
    ['hash-table', 'Hash Table Visualizer', 'Data Structures', 'cs', 'Hash Tables', 'inserts keys and shows hashing, collision resolution via chaining and open addressing'],
    ['logic-gates', 'Logic Gate Simulator', 'Digital Logic', 'cs', 'Logic Gates', 'builds circuits with AND, OR, NOT, NAND, NOR, XOR, XNOR gates with truth tables'],
    ['cpu-pipeline', 'CPU Pipeline Simulator', 'Computer Architecture', 'cs', 'CPU Pipelining', 'steps through IF→ID→EX→MEM→WB showing data hazards and instruction overlap'],
    ['memory-allocator', 'Memory Allocator', 'Operating Systems', 'cs', 'Memory Allocation', 'malloc/free heap blocks comparing first-fit, best-fit, worst-fit — watch fragmentation form'],
    ['turing-machine', 'Turing Machine Simulator', 'Theory of Computation', 'cs', 'Turing Machines', 'runs Turing machines step by step on a tape with preloaded programs like 0ⁿ1ⁿ recognition'],
];

// ── Template-based content generator ──
function generateContent(slug, name, tag, cat, concept, brief) {
    const url = `${DOMAIN}/${cat}/${slug}`;
    const sameCategory = tools.filter(t => t[3] === cat && t[0] !== slug);
    const related = sameCategory.slice(0, 3);
    const relLinks = related.map(r => `- [${r[1]}](${DOMAIN}/${r[3]}/${r[0]})`).join('\n');

    const categoryLabel = { math: 'mathematics', physics: 'physics', cs: 'computer science' }[cat];
    const actionVerbs = { math: 'compute, visualize, and understand', physics: 'simulate, observe, and analyze', cs: 'build, step through, and understand' }[cat];

    return `Understanding ${concept} is one of the most important steps in learning ${categoryLabel}. Our **${name}** ${brief} — giving you hands-on experience with the core ideas.

## What Is ${concept.replace(/^the /, '')}?

${concept.charAt(0).toUpperCase() + concept.slice(1)} is a fundamental concept in ${tag.toLowerCase()}. At its core, the ${name} tool lets you ${actionVerbs} how ${concept} works interactively, building intuition that textbooks alone can't provide.

Rather than memorizing formulas, you'll develop a deep, visual understanding by experimenting with parameters and seeing results update in real time. This is the first-principles approach: start with the basics and build up.

## How It Works

The **${name}** lets you interact directly with ${concept}. Adjust parameters using sliders and inputs, and watch the visualization respond instantly.

Key things you'll learn:
- **Core mechanics** — how ${concept} behaves under different conditions
- **Edge cases** — what happens at extremes and boundaries
- **Connections** — how ${concept} relates to other ${categoryLabel} concepts
- **Applications** — where ${concept} appears in the real world

Every interaction reinforces the underlying principles, so you're not just watching — you're building genuine understanding.

## Why ${concept.replace(/^the /, '')} Matters

${concept.charAt(0).toUpperCase() + concept.slice(1)} appears throughout ${categoryLabel} and its applications. Whether you're a student preparing for exams, a self-learner exploring STEM, or a professional refreshing fundamentals, understanding ${concept} from first principles gives you a solid foundation.

The concepts you learn here connect directly to advanced topics — making future learning faster and more intuitive.

## Try It Yourself

**[Open the ${name} →](${url})**

No account needed. No download. Just open the tool in your browser and start exploring ${concept} interactively.

## Explore More ${tag} Tools

${relLinks}

---

*Part of [FirstPrinciple](${DOMAIN}) — free interactive STEM tools built for deep understanding.*
`;
}

// ── Seed to Firestore ──
async function main() {
    const existing = new Set();
    const snap = await db.collection('posts').get();
    snap.forEach(d => existing.add(d.data().slug));
    console.log(`Found ${existing.size} existing posts`);

    let created = 0, skipped = 0;
    for (const [slug, name, tag, cat, concept, brief] of tools) {
        const blogSlug = `${slug}-explained`;
        if (existing.has(blogSlug)) { skipped++; continue; }

        // Also skip if a similar post already exists (check original 3)
        const altSlugs = ['how-fourier-transforms-work', 'sorting-algorithms-compared', 'circuit-analysis-tutorial'];
        if (altSlugs.some(s => slug.includes(s.split('-')[0]) || s.includes(slug.split('-')[0]))) {
            // Check more carefully
            if (existing.has(blogSlug)) { skipped++; continue; }
        }

        const content = generateContent(slug, name, tag, cat, concept, brief);
        const title = `${name} — ${concept.charAt(0).toUpperCase() + concept.slice(1)} Explained Interactively`;
        const description = `Learn ${concept} from first principles with our free interactive ${name}. Visual explanations, real-time simulations, no login required.`;

        await db.collection('posts').doc(blogSlug).set({
            slug: blogSlug,
            title: title.slice(0, 100),
            description: description.slice(0, 160),
            content,
            tag,
            published: true,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });

        created++;
        console.log(`✓ ${created}. ${blogSlug}`);
    }

    console.log(`\nDone! Created: ${created}, Skipped: ${skipped}`);
    process.exit(0);
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
