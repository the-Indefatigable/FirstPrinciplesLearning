import { useRef, useEffect } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface TexProps {
    math: string;
    display?: boolean;
}

/**
 * Shared KaTeX renderer.
 * Renders a LaTeX string into a <span> using KaTeX.
 */
export default function Tex({ math, display = false }: TexProps) {
    const ref = useRef<HTMLSpanElement>(null);
    useEffect(() => {
        if (!ref.current) return;
        try {
            katex.render(math, ref.current, {
                displayMode: display,
                throwOnError: false,
                trust: true,
            });
        } catch {
            ref.current.textContent = math;
        }
    }, [math, display]);
    return <span ref={ref} />;
}
