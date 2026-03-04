import React, { useState } from 'react';

interface ExportButtonProps {
    targetId?: string; // ID of the DOM element to export
    targetRef?: React.RefObject<HTMLCanvasElement | HTMLDivElement>; // Ref to the element
    filename?: string;
}

export default function ExportButton({ targetId, targetRef, filename = 'export' }: ExportButtonProps) {
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = async () => {
        setIsExporting(true);
        try {
            let el: HTMLElement | null = null;
            if (targetRef && targetRef.current) {
                el = targetRef.current;
            } else if (targetId) {
                el = document.getElementById(targetId);
            }

            if (!el) {
                console.warn('ExportButton: Target element not found');
                setIsExporting(false);
                return;
            }

            let dataUrl = '';

            // Fast path for isolated Canvas elements
            if (el instanceof HTMLCanvasElement) {
                dataUrl = el.toDataURL('image/png');
            } else {
                // Fallback for full DOM node using html2canvas
                // We use dynamic import so it doesn't bloat the main bundle when not used
                const html2canvas = (await import('html2canvas')).default;
                const canvas = await html2canvas(el, {
                    scale: 2, // Hi-DPI
                    backgroundColor: document.documentElement.getAttribute('data-theme') === 'dark' ? '#1a1612' : '#ffffff',
                    logging: false
                });
                dataUrl = canvas.toDataURL('image/png');
            }

            // Trigger download
            const link = document.createElement('a');
            link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.png`;
            link.href = dataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        } catch (e) {
            console.error('Failed to export image', e);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <button
            className="tool-btn--outline"
            onClick={handleExport}
            disabled={isExporting}
            style={{ fontSize: '0.8rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
            {isExporting ? (
                <>
                    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeDasharray="30" strokeOpacity="0.3"></circle>
                        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round"></path>
                    </svg>
                    Exporting...
                </>
            ) : (
                <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    Save Image
                </>
            )}
        </button>
    );
}
