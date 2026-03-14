import { useRef, useState, useCallback, useEffect } from 'react';

interface SplitOptions {
  min?: number;
  max?: number;
  direction?: 'horizontal' | 'vertical';
}

/**
 * useResizableSplit — drag-to-resize two-panel splits.
 *
 * Usage:
 *   const { ratio, containerRef, handleProps } = useResizableSplit(0.3);
 *
 *   <div ref={containerRef} style={{ display: 'flex' }}>
 *     <div style={{ width: `${ratio * 100}%` }}>left</div>
 *     <div className="resize-handle" {...handleProps} />
 *     <div style={{ flex: 1 }}>right</div>
 *   </div>
 */
export function useResizableSplit(defaultRatio: number, options: SplitOptions = {}) {
  const { min = 0.12, max = 0.75, direction = 'horizontal' } = options;
  const [ratio, setRatio] = useState(defaultRatio);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
  }, [direction]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const raw = direction === 'horizontal'
        ? (e.clientX - rect.left) / rect.width
        : (e.clientY - rect.top) / rect.height;
      setRatio(Math.min(max, Math.max(min, raw)));
    };

    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [direction, min, max]);

  return {
    ratio,
    containerRef,
    handleProps: { onMouseDown } as { onMouseDown: (e: React.MouseEvent) => void },
  };
}
