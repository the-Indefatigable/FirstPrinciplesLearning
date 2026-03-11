import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { lazy, Suspense, useState, useEffect } from 'react';
import { ThemeProvider } from './hooks/useTheme';
import { SettingsProvider } from './hooks/SettingsProvider';
import Navbar from './components/Navbar';
import ScrollToTop from './components/ScrollToTop';
import CommandPalette from './components/CommandPalette';
import Landing from './pages/Landing';
import ToolGallery from './pages/ToolGallery';
import ToolView from './pages/ToolView';

// Lazy-loaded pages (not on critical path)
const Reviews = lazy(() => import('./pages/Reviews'));
const Admin = lazy(() => import('./pages/Admin'));
const Blog = lazy(() => import('./pages/Blog'));
const BlogPost = lazy(() => import('./pages/BlogPost'));
const NotFound = lazy(() => import('./pages/NotFound'));

const Loader = () => (
  <div style={{ padding: '120px 24px', textAlign: 'center', color: 'var(--text-dim)' }}>Loading…</div>
);

function AppInner() {
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen(o => !o);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <>
      <ScrollToTop />
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <Navbar onOpenPalette={() => setPaletteOpen(true)} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <div id="main-content">
        <Suspense fallback={<Loader />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/reviews" element={<Reviews />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/math" element={<ToolGallery category="math" />} />
            <Route path="/physics" element={<ToolGallery category="physics" />} />
            <Route path="/cs" element={<ToolGallery category="cs" />} />
            <Route path="/math/:toolId" element={<ToolView />} />
            <Route path="/physics/:toolId" element={<ToolView />} />
            <Route path="/cs/:toolId" element={<ToolView />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/blog/:slug" element={<BlogPost />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </div>
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <SettingsProvider>
          <AppInner />
        </SettingsProvider>
      </BrowserRouter>
      <Analytics />
    </ThemeProvider>
  );
}
