import { useEffect, useRef } from 'react';

interface Props {
    url: string;
}

/**
 * Embeds a Calendly inline widget when the booking link is a calendly.com URL.
 * Falls back to nothing if the URL isn't Calendly.
 */
export default function CalendlyEmbed({ url }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const scriptLoaded = useRef(false);

    const isCalendly = url.includes('calendly.com');

    useEffect(() => {
        if (!isCalendly || scriptLoaded.current) return;

        const script = document.createElement('script');
        script.src = 'https://assets.calendly.com/assets/external/widget.js';
        script.async = true;
        document.head.appendChild(script);
        scriptLoaded.current = true;

        return () => {
            // Don't remove the script on unmount — it's idempotent
        };
    }, [isCalendly]);

    if (!isCalendly) return null;

    return (
        <div
            ref={containerRef}
            className="calendly-inline-widget"
            data-url={url}
            style={{ minWidth: 320, height: 660, margin: '32px auto 0', maxWidth: 680 }}
        />
    );
}
