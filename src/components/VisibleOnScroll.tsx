import { useEffect, useRef, useState, type ReactNode } from 'react';

interface Props {
    children: ReactNode;
    placeholder: ReactNode;
}

/**
 * Defers mounting children until they're near the viewport.
 * Prevents off-screen canvas tools from starting animation loops immediately.
 * rootMargin of 400px pre-loads content before the user reaches it.
 */
export default function VisibleOnScroll({ children, placeholder }: Props) {
    const ref = useRef<HTMLDivElement>(null);
    const [entered, setEntered] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        // If IntersectionObserver isn't available (very old browser), just show immediately
        if (typeof IntersectionObserver === 'undefined') {
            setEntered(true);
            return;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setEntered(true);
                    observer.disconnect();
                }
            },
            { rootMargin: '400px' }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    return <div ref={ref}>{entered ? children : placeholder}</div>;
}
