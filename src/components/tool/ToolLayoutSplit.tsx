import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../../hooks/useTheme';

interface ToolLayoutSplitProps {
    /** Fixed sidebar width in pixels (default: 360) */
    sidebarWidth?: number;
    /** Top offset in pixels to sit below the navbar (default: 115) */
    navbarHeight?: number;
    /** [sidebar content, canvas/visualizer content] */
    children: [ReactNode, ReactNode];
}

/**
 * Gold Standard layout wrapper for all tools.
 *
 * Architecture:
 * - Portals to `document.body` for full-viewport control
 * - Locks body scroll on mount, restores on unmount
 * - Split flex layout: fixed-width sidebar + fluid canvas area
 * - Theme-aware colors matching the Gold Standard palette
 */
export default function ToolLayoutSplit({
    sidebarWidth = 360,
    navbarHeight = 115,
    children,
}: ToolLayoutSplitProps) {
    const { resolved: theme } = useTheme();
    const isDark = theme === 'dark';

    // Lock body overflow while tool is mounted
    useEffect(() => {
        const prev = window.getComputedStyle(document.body).overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, []);

    const sidebarBg = isDark ? '#000000' : '#ffffff';
    const canvasBg = isDark ? '#0a0a0c' : '#f4f4f5';
    const borderC = isDark ? '#27272a' : '#e4e4e7';

    const ui = (
        <div style={{
            position: 'fixed',
            top: navbarHeight,
            left: 0, right: 0, bottom: 0,
            display: 'flex',
            overflow: 'hidden',
            background: canvasBg,
            zIndex: 50,
        }}>
            {/* ══ LEFT: Sidebar ══ */}
            <div style={{
                width: sidebarWidth,
                flexShrink: 0,
                background: sidebarBg,
                borderRight: `2px solid ${borderC}`,
                boxShadow: isDark
                    ? '4px 0 20px rgba(0,0,0,0.6)'
                    : '4px 0 15px rgba(0,0,0,0.05)',
                display: 'flex',
                flexDirection: 'column',
                overflowY: 'auto',
                padding: '24px 20px',
                gap: 16,
                zIndex: 10,
            }}>
                {children[0]}
            </div>

            {/* ══ RIGHT: Canvas / Visualizer ══ */}
            <div style={{
                flex: 1,
                minWidth: 0,
                position: 'relative',
                overflow: 'hidden',
            }}>
                {children[1]}
            </div>
        </div>
    );

    if (typeof document === 'undefined') return null;
    return createPortal(ui, document.body);
}
