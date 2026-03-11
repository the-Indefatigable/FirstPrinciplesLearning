import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import { useSettings } from '../hooks/SettingsProvider';
import { allTools, type ToolMeta } from '../config/tools';
import './Navbar.css';

const CATEGORIES = [
  { key: 'math' as const, label: 'Mathematics', color: '#d97706', path: '/math' },
  { key: 'physics' as const, label: 'Physics', color: '#6b8f71', path: '/physics' },
  { key: 'cs' as const, label: 'Computer Science', color: '#c2714f', path: '/cs' },
];

export default function Navbar({ onOpenPalette }: { onOpenPalette: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const location = useLocation();
  const { bookingLink } = useSettings();
  const megaRef = useRef<HTMLDivElement>(null);
  const megaTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Swipe gesture tracking
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  // Scroll handler
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close everything on route change
  useEffect(() => {
    setMenuOpen(false);
    setMegaOpen(false);
  }, [location.pathname]);

  // Escape key closes mobile menu / mega menu
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        setMegaOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Click outside mega menu closes it
  useEffect(() => {
    if (!megaOpen) return;
    const onClick = (e: MouseEvent) => {
      if (megaRef.current && !megaRef.current.contains(e.target as Node)) setMegaOpen(false);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [megaOpen]);

  // Swipe gestures for mobile
  const handleTouchStart = useCallback((e: TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx > 0 && !menuOpen) setMenuOpen(true);
      if (dx < 0 && menuOpen) setMenuOpen(false);
    }
  }, [menuOpen]);

  useEffect(() => {
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchEnd]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  // Tools grouped by category
  const toolsByCategory = useMemo(() => {
    const map: Record<string, ToolMeta[]> = {};
    for (const cat of CATEGORIES) {
      map[cat.key] = allTools.filter(t => t.category === cat.key).slice(0, 6);
    }
    return map;
  }, []);

  const isToolsPage = ['/math', '/physics', '/cs'].some(p => location.pathname.startsWith(p));

  return (
    <>
      <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
        <div className="navbar-inner">
          {/* Brand */}
          <Link className="navbar-brand" to="/">
            <div className="navbar-logo-mark">fp</div>
            <div className="navbar-logo-text">FirstPrinciple</div>
          </Link>

          {/* Desktop Links */}
          <div className="navbar-links">
            {/* Tools Mega Menu Trigger */}
            <div
              className="navbar-mega-trigger"
              ref={megaRef}
              onMouseEnter={() => { clearTimeout(megaTimeout.current); setMegaOpen(true); }}
              onMouseLeave={() => { megaTimeout.current = setTimeout(() => setMegaOpen(false), 200); }}
            >
              <button
                className={`navbar-link ${isToolsPage ? 'active' : ''}`}
                onClick={() => setMegaOpen(!megaOpen)}
                aria-expanded={megaOpen}
              >
                Tools
                <svg className={`chevron ${megaOpen ? 'open' : ''}`} width="10" height="6" viewBox="0 0 10 6" fill="none">
                  <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {/* Mega Dropdown */}
              {megaOpen && (
                <div className="mega-menu">
                  <div className="mega-menu-inner">
                    {CATEGORIES.map(cat => (
                      <div className="mega-col" key={cat.key}>
                        <Link to={cat.path} className="mega-col-header" onClick={() => setMegaOpen(false)}>
                          <span className="mega-dot" style={{ background: cat.color }} />
                          {cat.label}
                          <span className="mega-col-count">{allTools.filter(t => t.category === cat.key).length}</span>
                        </Link>
                        <div className="mega-tools">
                          {toolsByCategory[cat.key].map(tool => (
                            <Link
                              key={tool.slug}
                              to={`/${cat.key}/${tool.slug}`}
                              className="mega-tool-link"
                              onClick={() => setMegaOpen(false)}
                            >
                              {tool.name}
                              <span className="mega-tool-tag">{tool.tag}</span>
                            </Link>
                          ))}
                          {allTools.filter(t => t.category === cat.key).length > 6 && (
                            <Link to={cat.path} className="mega-view-all" onClick={() => setMegaOpen(false)}>
                              View all {allTools.filter(t => t.category === cat.key).length} tools →
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Link to="/blog" className={`navbar-link ${location.pathname.startsWith('/blog') ? 'active' : ''}`}>Blog</Link>
            <Link to="/reviews" className={`navbar-link ${location.pathname === '/reviews' ? 'active' : ''}`}>Reviews</Link>
          </div>

          {/* Right side */}
          <div className="navbar-actions">
            {/* Search button */}
            <button
              className="navbar-icon-btn"
              onClick={onOpenPalette}
              aria-label="Search tools"
              title="Search (⌘K)"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.6" />
                <line x1="11.5" y1="11.5" x2="16" y2="16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>

            <div className="desktop-only">
              <ThemeToggle />
            </div>

            <a className="navbar-cta desktop-only" href={bookingLink}>Book a Session</a>

            <button
              className={`hamburger ${menuOpen ? 'open' : ''}`}
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
            >
              <span /><span /><span />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile backdrop */}
      {menuOpen && <div className="mobile-backdrop" onClick={closeMenu} />}

      {/* Mobile menu */}
      <div className={`mobile-menu ${menuOpen ? 'open' : ''}`} role="dialog" aria-label="Navigation menu" aria-hidden={!menuOpen}>
        <div className="mobile-menu-section">
          <div className="mobile-menu-label">Tools</div>
          {CATEGORIES.map(cat => (
            <Link key={cat.key} to={cat.path} onClick={closeMenu} className="mobile-menu-link">
              <span className="mega-dot" style={{ background: cat.color }} />
              {cat.label}
              <span className="mobile-menu-count">{allTools.filter(t => t.category === cat.key).length}</span>
            </Link>
          ))}
        </div>
        <div className="mobile-menu-section">
          <Link to="/blog" onClick={closeMenu} className="mobile-menu-link">Blog</Link>
          <Link to="/reviews" onClick={closeMenu} className="mobile-menu-link">Reviews</Link>
        </div>
        <a className="mobile-menu-cta" href={bookingLink} onClick={closeMenu}>Book a Session</a>
        <div className="mobile-menu-footer">
          <ThemeToggle />
        </div>
      </div>
    </>
  );
}
