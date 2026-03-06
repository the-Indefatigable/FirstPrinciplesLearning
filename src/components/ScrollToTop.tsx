import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** Scroll to top on every route change — standard SPA accessibility fix */
export default function ScrollToTop() {
    const { pathname } = useLocation();
    useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
    return null;
}
