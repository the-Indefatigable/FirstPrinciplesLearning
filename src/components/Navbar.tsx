import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import { useSettings } from '../hooks/SettingsProvider';
import './Navbar.css';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const isLanding = location.pathname === '/';
  const { bookingLink } = useSettings();

  // Swipe gesture tracking
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close mobile menu on Escape key
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  // Close menu on route change
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  // Swipe gestures: right to open, left to close
  const handleTouchStart = useCallback((e: TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;

    // Only trigger if horizontal swipe is dominant and > 60px
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx > 0 && !menuOpen) setMenuOpen(true);   // swipe right → open
      if (dx < 0 && menuOpen) setMenuOpen(false);    // swipe left → close
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

  // Lock body scroll when menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
        <div className="navbar-inner">
          <Link className="navbar-brand" to="/">
            <div className="navbar-logo-mark">fp</div>
            <div className="navbar-logo-text">FirstPrinciple</div>
          </Link>

          <ul className="navbar-links">
            {isLanding ? (
              <>
                <li><a href="#approach">Approach</a></li>
                <li><a href="#subjects">Subjects</a></li>
                <li><Link to="/reviews">Reviews</Link></li>
                <li><a href="#pricing">Pricing</a></li>
              </>
            ) : null}
            <li><Link to="/math" className={location.pathname.startsWith('/math') ? 'active' : ''}>Math</Link></li>
            <li><Link to="/physics" className={location.pathname.startsWith('/physics') ? 'active' : ''}>Physics</Link></li>
            <li><Link to="/cs" className={location.pathname.startsWith('/cs') ? 'active' : ''}>CS</Link></li>
            <li><Link to="/blog" className={location.pathname.startsWith('/blog') ? 'active' : ''}>Blog</Link></li>
          </ul>

          {isLanding ? (
            <a className="navbar-cta desktop-only" href={bookingLink}>Book a Session</a>
          ) : (
            <Link className="navbar-cta desktop-only" to="/">← Home</Link>
          )}

          <div className="desktop-only">
            <ThemeToggle />
          </div>

          <button
            className={`hamburger ${menuOpen ? 'open' : ''}`}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            <span /><span /><span />
          </button>
        </div>
      </nav>

      {/* Backdrop overlay */}
      {menuOpen && <div className="mobile-backdrop" onClick={closeMenu} />}

      <div className={`mobile-menu ${menuOpen ? 'open' : ''}`} role="dialog" aria-label="Navigation menu" aria-hidden={!menuOpen}>
        {isLanding && (
          <>
            <a href="#approach" onClick={closeMenu}>Approach</a>
            <a href="#subjects" onClick={closeMenu}>Subjects</a>
            <Link to="/reviews" onClick={closeMenu}>Reviews</Link>
            <a href="#pricing" onClick={closeMenu}>Pricing</a>
          </>
        )}
        <Link to="/math" onClick={closeMenu}>Math Tools</Link>
        <Link to="/physics" onClick={closeMenu}>Physics Tools</Link>
        <Link to="/cs" onClick={closeMenu}>CS Tools</Link>
        <Link to="/blog" onClick={closeMenu}>Blog</Link>
        {isLanding ? (
          <a className="mobile-menu-cta" href={bookingLink} onClick={closeMenu}>Book a Session</a>
        ) : (
          <Link className="mobile-menu-cta" to="/" onClick={closeMenu}>← Back to Home</Link>
        )}
        <div className="mobile-menu-footer">
          <ThemeToggle />
        </div>
      </div>
    </>
  );
}
