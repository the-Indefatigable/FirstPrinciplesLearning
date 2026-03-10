# FirstPrinciple Tutoring — Complete Codebase Documentation

## Project Overview

**FirstPrinciple Tutoring** is a modern, interactive educational platform offering 52 free STEM tools (Math, Physics, Computer Science) alongside a premium 1-on-1 tutoring service. The site emphasizes the "first-principles" approach — understanding concepts from fundamental principles rather than memorization.

**Tech Stack:**
- Frontend: React 19 + TypeScript 5.9 + Vite 7
- Styling: Custom CSS with CSS variables and dark/light theme support
- Database: Firebase (Firestore for data, Auth for admin login)
- Hosting: Vercel
- Analytics: Google Analytics 4 + Vercel Analytics
- PWA: vite-plugin-pwa for offline capability
- Testing: Vitest + Testing Library

**Key Metrics:**
- 52 interactive tools (20 Math, 16 Physics, 16 CS)
- 10+ SEO blog posts
- Full theme system (light/dark/system)
- Admin panel for managing site settings and blog posts

---

## Project Root Structure

### Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | 46 total dependencies; Scripts: `dev`, `build` (with prerender), `lint`, `test`, `preview` |
| `vite.config.ts` | PWA config with caching strategies; Manual code-splitting for KaTeX, Firebase, Math.js, Plotly |
| `tsconfig.json` / `tsconfig.app.json` | Strict TypeScript; ES2022 target; JSX React 17+ |
| `index.html` | SEO metadata (OG, Twitter, JSON-LD); Google Analytics; Font preloading; Meta tags for Canada geo-targeting |
| `.env` | Firebase SDK keys (public, safe to commit) |
| `vercel.json` | URL rewrites for /blog; Security headers; Cache control |
| `eslint.config.js` | React hooks linting |

### Build Scripts
- `scripts/prerender.mjs` — Post-build static HTML generation for all tool and blog routes (SEO/crawler support)
- `scripts/seed-blogs.mjs` — Firebase Admin SDK script to seed sample blog posts to Firestore

### Public Assets
- `favicon.svg`, `favicon-32.png` — Icon assets
- `pwa-192.png`, `pwa-512.png` — PWA manifest icons
- `og-image.png` — Open Graph preview image
- `robots.txt` — Allows all except /admin; links sitemap
- `sitemap.xml` — Auto-generated tool and blog URLs

---

## Routing Structure (React Router v7)

| Route | Component | Purpose |
|-------|-----------|---------|
| `/` | Landing | Hero, philosophy, subjects, testimonials, pricing, CTA |
| `/reviews` | Reviews | User testimonials form + display (Firestore) |
| `/admin` | Admin | Markdown blog editor, site settings, Firebase Auth gate |
| `/math` | ToolGallery | Gallery of 20 math tools |
| `/physics` | ToolGallery | Gallery of 16 physics tools |
| `/cs` | ToolGallery | Gallery of 16 CS tools |
| `/:category/:toolId` | ToolView | Individual tool with boot screen + lazy-loaded component |
| `/blog` | Blog | Published blog post listing |
| `/blog/:slug` | BlogPost | Individual blog post with Markdown rendering + JSON-LD Article schema |
| `*` | NotFound | 404 fallback |

---

## Directory Architecture

### src/pages/ (8 files)

| File | Description |
|------|-------------|
| `Landing.tsx` | Marketing homepage with lazy-loaded testimonials section |
| `ToolGallery.tsx` | Category gallery with SEO breadcrumbs |
| `ToolView.tsx` | Individual tool viewer with phased loading (boot -> fade -> ready) |
| `Blog.tsx` | Blog index fetching published posts from Firestore |
| `BlogPost.tsx` | Single post renderer with ReactMarkdown + GFM, Article JSON-LD |
| `Reviews.tsx` | Testimonials + form with honeypot spam protection, rate limiting |
| `Admin.tsx` | Firebase Auth login gate; Markdown editor with toolbar; blog/settings management |
| `NotFound.tsx` | 404 page with GA4 tracking |

### src/components/ (20 components)

**Marketing/Structure:**
| Component | Description |
|-----------|-------------|
| `Navbar.tsx` | Mega menu with tool search (Cmd/Ctrl+K), category filtering, theme toggle |
| `Hero.tsx` | Above-the-fold with CTA buttons, trust badges |
| `Philosophy.tsx` | First-principles approach explanation |
| `Subjects.tsx` | Math/Physics/CS subject cards |
| `HowItWorks.tsx` | 3-step tutoring process |
| `Pricing.tsx` | Service pricing table |
| `FinalCTA.tsx` | Bottom-of-page booking CTA with Calendly embed |
| `Footer.tsx` | Links, contact, social |
| `Testimonials.tsx` | Review carousel from Firestore (lazy-loaded) |
| `VisibleOnScroll.tsx` | Intersection Observer wrapper for fade-in animations |

**Functionality:**
| Component | Description |
|-----------|-------------|
| `ToolSkeleton.tsx` | Loading skeleton for tool boots |
| `BootScreen.tsx` | Animated boot screen during tool load |
| `ExportButton.tsx` | PNG/SVG canvas export for visualization tools |
| `CalendlyEmbed.tsx` | Embedded booking widget |
| `EmailCapture.tsx` | Newsletter subscription form |
| `RelatedPosts.tsx` | Blog post recommendations |
| `ScrollToTop.tsx` | Auto-scroll to top on route change |
| `ThemeToggle.tsx` | Light/dark/system theme switcher (localStorage-backed) |
| `GlassCard.tsx` | Tool preview card component |
| `SEOHead.tsx` | Per-page meta tag manager (title, OG, Twitter, canonical, breadcrumbs, LearningResource schema) |

### src/tools/ (52 interactive tools)

**Math (20 tools):**
- `UnitCircle` — Interactive unit circle with trig functions
- `GraphingCalc` — Multi-function graphing calculator with sidebar layout
- `Plotter3D` / `PlotGL3D` — WebGL 3D surface plotter (Plotly-based)
- `SlopeField` — Slope field visualizer with RK4 particle traces
- `DerivativeIntegral` — Symbolic differentiation & integration with graph
- `IntegrationVisualizer` — Riemann sums, trapezoids, Simpson's rule
- `TaylorSeries` — Taylor polynomial approximation visualizer
- `FourierSeries` — Fourier series with animated epicycles
- `FourierTransform` — FFT visualizer
- `ComplexPlotter` — Complex number arithmetic on the Argand plane
- `VectorField` — 2D vector field with divergence/curl heatmaps & particles
- `DiffEqSolver` — ODE solver
- `MatrixCalc` — Matrix operations calculator
- `EquationSolver` — Algebraic equation solver
- `LaplaceTransform` — Laplace transform calculator
- `MonteCarloSim` — Monte Carlo simulation
- `StatisticsCalc` — Statistical analysis tool
- `NumberTheory` — Number theory explorer
- `LinearAlgebraViz` — Linear algebra visualizer
- `ProbabilitySim` — Probability distribution simulator

**Physics (16 tools):**
- `CircuitBuilder` — Interactive circuit builder with DC/transient solver (has `circuit/types.ts` + `circuit/solver.ts`)
- `OrbitalMechanics` — Orbital mechanics simulator
- `RayOptics` — Ray optics tracer
- `DoublePendulum` — Chaotic double pendulum
- `SpringMass` — Spring-mass system
- `MomentumConservation` — Momentum/collision simulator
- `ProjectileMotion` — Projectile trajectory
- `ElectricField` — Electric field lines
- `WaveSuperposition` — Wave interference
- `FreeBodyDiagram` — Free body diagram builder
- `ThermoPV` — PV diagram / thermodynamics
- `QuantumWave` — Quantum wave function
- `EMInduction` — Electromagnetic induction
- `LensMirror` — Lens and mirror optics

**CS (16 tools):**
- `SortingVisualizer` — Algorithm sorting animations
- `GraphTraversal` — BFS/DFS graph traversal
- `BinaryTree` — Binary tree operations
- `StackQueue` — Stack & queue visualizer
- `LinkedList` — Linked list operations
- `BigOComparator` — Algorithm complexity comparison
- `RegexTester` — Regular expression tester
- `FSMBuilder` — Finite state machine builder
- `CodeVisualizer` — Code execution visualizer
- `PathfindingVisualizer` — A*/Dijkstra pathfinding
- `SqlVisualizer` — SQL query visualizer
- `PacketSimulator` — Network packet simulation
- `HashTableViz` — Hash table visualizer
- `LogicGateSim` — Logic gate simulator
- `CPUPipeline` — CPU pipeline visualizer
- `TuringMachine` / `MemoryAllocator` / `RecursionVisualizer`

### src/config/ (2 files)

| File | Description |
|------|-------------|
| `tools.tsx` (1176 lines) | Master tool registry: ToolMeta interface, toolLoaders (dynamic imports), 52 Preview SVG components, allTools array, getByCategory/getBySlug helpers |
| `tools.test.ts` | Validates tool registry structure |

### src/hooks/ (3 custom hooks)

| Hook | Description |
|------|-------------|
| `useTheme.tsx` | Dark/light theme context with localStorage persistence + system preference detection |
| `SettingsProvider.tsx` | Site settings (bookingLink, heroBadge, heroCtaText) loaded from Firestore `config/siteSettings` |
| `useUrlState.ts` | Syncs complex state to URL query params with debouncing |

### src/lib/ (3 Firebase modules)

| File | Description |
|------|-------------|
| `firebase.ts` | Firestore + Auth initialization |
| `blog.ts` | BlogPost interface; fetchAllPosts, fetchPublishedPosts, fetchPostBySlug, savePost, deletePost, slugify, readingTime |
| `siteSettings.ts` | SiteSettings interface; fetchSettings, saveSettings with defaults |

### src/utils/

| File | Description |
|------|-------------|
| `manimCanvas.ts` (318 lines) | Manim-style (3Blue1Brown aesthetic) Canvas 2D rendering. Exports: MANIM color palette, drawBackground, drawGrid, drawAxes, drawAxisLabels, drawGlowCurve, drawGlowDot, drawCrosshair, drawLabel, drawShadedArea, getGridStep, drawScene. CurvePoint interface: `{ x: number; y: number }` |

---

## Styling System

### Design Tokens (CSS Variables in src/index.css)

**Colors:**
- Background: `--bg-primary` (#faf8f5 light cream), `--bg-secondary`, `--bg-card`, `--bg-dark`
- Accent: `--amber` (#d97706), `--amber-light`, `--sage` (#6b8f71), `--terracotta` (#c2714f)
- Text: `--text-primary` (dark brown), `--text-secondary`, `--text-dim`, `--text-light`
- Borders: `--border-warm`, `--border-light`, `--border-accent`

**Typography:**
- Serif: 'Instrument Serif' (headings, branding)
- Sans: 'Sora' (body, UI)
- Monospace: 'JetBrains Mono', 'SF Mono' (code, tool inputs)

**Layout:**
- `--max-width: 1100px`
- `--nav-height: 72px`
- Radius: `--radius-sm` (8px), `--radius-md` (14px), `--radius-lg` (20px)
- Shadows: sm, md, lg, xl with subtle brown tints

**Theme Handling:**
- Light mode (default): warm cream backgrounds, dark text
- Dark mode: `data-theme="dark"` attribute on `<html>`
- Toggled via ThemeToggle.tsx, persisted to localStorage as `fp-theme`
- System preference detection via `matchMedia`

**Grain Texture:**
- Subtle SVG noise overlay (opacity 0.025) across viewport via `body::after`

### Tool-Specific CSS

**GraphingCalc Layout:**
- `.graphing-calc` — CSS Grid: `280px 1fr` (sidebar + canvas)
- `.graphing-calc-sidebar` — Function list, controls, hints
- `.graphing-calc-canvas-wrap` — Canvas container with absolute positioning
- Mobile: stacks to single column at 768px breakpoint

---

## Firebase Integration

### Firestore Collections

| Collection | Documents | Purpose |
|------------|-----------|---------|
| `posts` | BlogPost[] | Blog articles (slug, title, content, tag, published, createdAt, updatedAt) |
| `reviews` | Review[] | User testimonials (name, grade, stars, text, createdAt) |
| `config` | siteSettings | Single doc with bookingLink, heroBadge, heroCtaText |

### Authentication
- Firebase Auth (email/password only)
- Admin page login gate checks `onAuthStateChanged()`
- No public signup; credentials managed in Firebase Console

### Data Flow
- Public tools & gallery are fully static (no DB calls)
- Testimonials fetched on landing page load (lazy-loaded)
- Blog posts fetched on /blog, /blog/:slug
- Site settings fetched in SettingsProvider
- Admin panel full CRUD on posts + settings

---

## SEO & Content Strategy

### On-Page SEO (SEOHead.tsx)
- Per-page `<title>`, `<meta name="description">`
- Open Graph tags (og:title, og:description, og:image, og:url)
- Twitter Card tags
- Canonical URLs
- JSON-LD Schema: BreadcrumbList, Article (blog), LearningResource (tools)

### Structured Data (index.html)
- EducationalOrganization schema
- FAQPage schema (4 common Q&A)

### Technical SEO
- Sitemap auto-generated at build time
- robots.txt allows all except /admin
- GA4 tracking + Vercel Analytics
- Prerendered HTML for all routes

### Blog System
- Markdown editing in admin panel with live preview
- ReactMarkdown + remark-gfm renderer
- Auto reading time, published/draft toggle, tags, related posts

---

## PWA Configuration

### vite-plugin-pwa
- Manifest: name, short_name, description, theme_color, icons (192/512px)
- Workbox Caching:
  - Google Fonts: CacheFirst (1 year TTL)
  - Firestore API: NetworkFirst (24h expiration)
  - Assets (.js, .css, .woff2): Long-lived cache
- Auto-update service worker registration

### Boot Screen
- `BootScreen.tsx` shown during tool load (0.5s min + loader promise)
- Phased transitions: booting -> fading -> ready

---

## Build & Deployment

### Build Pipeline
```bash
npm run build
```
1. TypeScript compilation (`tsc -b`)
2. Vite bundling with chunk splitting:
   - `vendor-katex` — KaTeX library
   - `vendor-firebase` — Firebase SDK
   - `vendor-math` — Math.js
   - `vendor-plotly` — Plotly for 3D
   - `vendor-react`, `vendor-react-dom` — React core
3. Prerender script generates static HTML for all routes

### Hosting
- Vercel: Automatic deployments on git push
- Domain: firstprincipleslearningg.com (Canada geo-targeted)
- Security headers in vercel.json

---

## Key Architectural Patterns

### Lazy Loading & Code Splitting
```typescript
// App.tsx — route-level
const Reviews = lazy(() => import('./pages/Reviews'));

// tools.tsx — tool-level
const tool = toolLoaders[toolId]?.(); // Dynamic tool import
```

### Canvas Rendering Pattern (manimCanvas.ts)
All visualization tools follow:
1. `useRef` for canvas element
2. `useCallback` for draw function
3. `useEffect` with `ResizeObserver` for responsive HiDPI sizing
4. Draw: background -> grid -> axes -> curves -> interactive elements

### State Management
- **Global:** Theme (useTheme), Settings (SettingsProvider)
- **Local:** Component `useState` for forms, animations, UI
- **URL State:** `useUrlState` for complex tool parameters
- **Firebase:** Real-time listeners in components

### Responsiveness
- CSS Grid/Flexbox layouts
- Canvas tools scale to container via ResizeObserver + devicePixelRatio
- Mobile nav menu with swipe gesture detection
- Breakpoints: 768px (tablet), 480px (mobile)

---

## Dependencies

### Major Libraries
| Package | Version | Purpose |
|---------|---------|---------|
| react | 19.2.0 | UI framework |
| react-router-dom | 7.13.1 | Client-side routing |
| firebase | 12.10.0 | Backend (Firestore, Auth) |
| mathjs | 15.1.1 | Math expression parsing & evaluation |
| katex | 0.16.37 | LaTeX math rendering |
| react-markdown | 10.1.0 | Markdown to JSX |
| react-plotly.js | 2.6.0 | 3D/2D plotting |
| html2canvas | 1.4.1 | Canvas to image export |
| remark-gfm | 4.0.1 | GitHub-flavored Markdown |

### Dev Dependencies
| Package | Version | Purpose |
|---------|---------|---------|
| vite | 7.3.1 | Fast bundler |
| typescript | 5.9.3 | Type safety |
| vitest | 4.0.18 | Test runner |
| eslint | 9.39.1 | Linting |
| vite-plugin-pwa | 1.2.0 | PWA support |
| @testing-library/react | - | Component testing |

---

## Testing

### Configuration (vite.config.ts)
- JSDOM environment
- Global test functions enabled
- Setup file: `src/test/setup.ts` (localStorage mock)

### Test Files
- `src/config/tools.test.ts` — Validates tool registry structure and loader functions

---

## Admin Features

### Admin Panel (src/pages/Admin.tsx)
1. **Login Gate:** Firebase email/password auth
2. **Blog Management:** Create/edit/delete posts, Markdown editor with toolbar, publish/draft toggle, auto-slug
3. **Site Settings:** bookingLink, heroBadge, heroCtaText — saved to Firestore
4. **Review Moderation:** View and delete reviews

---

## File Tree

```
FirstPrincipleTutoring/
├── public/
│   ├── favicon.svg, favicon-32.png, og-image.png
│   ├── pwa-192.png, pwa-512.png
│   ├── robots.txt, sitemap.xml
├── scripts/
│   ├── prerender.mjs
│   └── seed-blogs.mjs
├── src/
│   ├── main.tsx, App.tsx, index.css
│   ├── pages/ (8 files)
│   ├── components/ (20 components)
│   ├── tools/
│   │   ├── math/ (20 tools)
│   │   ├── physics/ (16 tools + circuit/)
│   │   └── cs/ (16 tools)
│   ├── config/
│   │   ├── tools.tsx (tool registry, 1176 lines)
│   │   └── tools.test.ts
│   ├── hooks/ (useTheme, SettingsProvider, useUrlState)
│   ├── lib/ (firebase.ts, blog.ts, siteSettings.ts)
│   ├── utils/ (manimCanvas.ts)
│   └── test/ (setup.ts)
├── package.json, vite.config.ts
├── tsconfig.json, tsconfig.app.json, tsconfig.node.json
├── eslint.config.js, vercel.json
├── index.html, .env
└── CODEBASE.md (this file)
```

---

## Conventions

- **File naming:** PascalCase for components (`Hero.tsx`), camelCase for utilities (`manimCanvas.ts`)
- **CSS:** Pure CSS with variables, no CSS-in-JS or Tailwind. Component CSS co-located with `.tsx`
- **Exports:** Default exports for components, named exports for utilities
- **Error handling:** try/catch in Firestore queries, fallback defaults
- **Accessibility:** skip-link, semantic HTML, ARIA labels, keyboard shortcuts
