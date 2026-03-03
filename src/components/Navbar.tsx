import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Navbar.css';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const isLanding = location.pathname === '/';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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
                <li><a href="#testimonials">Reviews</a></li>
                <li><a href="#pricing">Pricing</a></li>
              </>
            ) : null}
            <li><Link to="/math" className={location.pathname.startsWith('/math') ? 'active' : ''}>Math</Link></li>
            <li><Link to="/physics" className={location.pathname.startsWith('/physics') ? 'active' : ''}>Physics</Link></li>
            <li><Link to="/cs" className={location.pathname.startsWith('/cs') ? 'active' : ''}>CS</Link></li>
          </ul>

          {isLanding ? (
            <a className="navbar-cta" href="#booking">Book a Session</a>
          ) : (
            <Link className="navbar-cta" to="/">← Back to Home</Link>
          )}

          <button
            className={`hamburger ${menuOpen ? 'open' : ''}`}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <span /><span /><span />
          </button>
        </div>
      </nav>

      <div className={`mobile-menu ${menuOpen ? 'open' : ''}`}>
        {isLanding && (
          <>
            <a href="#approach" onClick={closeMenu}>Approach</a>
            <a href="#subjects" onClick={closeMenu}>Subjects</a>
            <a href="#testimonials" onClick={closeMenu}>Reviews</a>
            <a href="#pricing" onClick={closeMenu}>Pricing</a>
          </>
        )}
        <Link to="/math" onClick={closeMenu}>Math Tools</Link>
        <Link to="/physics" onClick={closeMenu}>Physics Tools</Link>
        <Link to="/cs" onClick={closeMenu}>CS Tools</Link>
        {isLanding ? (
          <a className="navbar-cta" href="#booking" onClick={closeMenu}>Book a Session</a>
        ) : (
          <Link className="navbar-cta" to="/" onClick={closeMenu}>← Back to Home</Link>
        )}
      </div>
    </>
  );
}
