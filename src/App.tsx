import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { ThemeProvider } from './hooks/useTheme';
import { SettingsProvider } from './hooks/SettingsProvider';
import Navbar from './components/Navbar';
import Landing from './pages/Landing';
import ToolGallery from './pages/ToolGallery';
import ToolView from './pages/ToolView';

// Lazy-loaded pages (not on critical path)
const Reviews = lazy(() => import('./pages/Reviews'));
const Admin = lazy(() => import('./pages/Admin'));

const Loader = () => (
  <div style={{ padding: '120px 24px', textAlign: 'center', color: 'var(--text-dim)' }}>Loading…</div>
);

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <SettingsProvider>
          <Navbar />
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
            </Routes>
          </Suspense>
        </SettingsProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
