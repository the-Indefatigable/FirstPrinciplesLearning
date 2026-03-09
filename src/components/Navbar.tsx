import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import { useSettings } from '../hooks/SettingsProvider';
import { allTools, type ToolMeta } from '../config/tools';
import './Navbar.css';

const CATEGORIES = [
  { key: 'math' as const, label: 'Mathematics', color: '#d97706', path: '/math' },
  { key: 'physics' as const, label: 'Physics', color: '#6b8f71', path: '/physics' },
  { key: 'cs' as const, label: 'Computer Science', color: '#c2714f', path: '/cs' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const { bookingLink } = useSettings();
  const megaRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
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
    setSearchOpen(false);
    setSearchQuery('');
  }, [location.pathname]);

  // Escape key closes everything
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        setMegaOpen(false);
        setSearchOpen(false);
      }
      // Cmd/Ctrl+K for search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Focus search input when opened
  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  // Click outside mega menu closes it
  useEffect(() => {
    if (!megaOpen) return;
    const onClick = (e: MouseEvent) => {
      if (megaRef.current && !megaRef.current.contains(e.target as Node)) setMegaOpen(false);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [megaOpen]);

  // Click outside search closes it
  useEffect(() => {
    if (!searchOpen) return;
    const onClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
        setSearchQuery('');
      }
    };
    // Defer so the opening click doesn't immediately close the overlay
    const timer = setTimeout(() => document.addEventListener('click', onClick), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', onClick);
    };
  }, [searchOpen]);

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

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return allTools.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.tag.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [searchQuery]);

  const handleSearchSelect = (tool: ToolMeta) => {
    navigate(`/${tool.category}/${tool.slug}`);
    setSearchOpen(false);
    setSearchQuery('');
  };

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
              onClick={() => setSearchOpen(!searchOpen)}
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

      {/* Search Overlay */}
      {searchOpen && (
        <div className="search-overlay">
          <div className="search-modal" ref={searchRef}>
            <div className="search-input-row">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="search-icon">
                <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.6" />
                <line x1="11.5" y1="11.5" x2="16" y2="16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                className="search-input"
                placeholder="Search tools..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && searchResults.length > 0) handleSearchSelect(searchResults[0]);
                }}
              />
              <kbd className="search-kbd">ESC</kbd>
            </div>
            {searchResults.length > 0 && (
              <div className="search-results">
                {searchResults.map(tool => (
                  <button key={tool.slug} className="search-result" onClick={() => handleSearchSelect(tool)}>
                    <span className="search-result-dot" style={{ background: { math: '#d97706', physics: '#6b8f71', cs: '#c2714f' }[tool.category] }} />
                    <div className="search-result-info">
                      <span className="search-result-name">{tool.name}</span>
                      <span className="search-result-tag">{tool.tag}</span>
                    </div>
                    <span className="search-result-cat">{tool.category.toUpperCase()}</span>
                  </button>
                ))}
              </div>
            )}
            {searchQuery && searchResults.length === 0 && (
              <div className="search-empty">No tools found for "{searchQuery}"</div>
            )}
          </div>
        </div>
      )}

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
