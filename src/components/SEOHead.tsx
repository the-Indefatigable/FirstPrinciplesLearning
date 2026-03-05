import { useEffect } from 'react';

interface SEOProps {
    title: string;
    description: string;
    canonical?: string;
    type?: string;
}

/**
 * Sets per-page <title> and <meta> description dynamically.
 * Also updates OG tags for social sharing crawlers.
 */
export default function SEOHead({ title, description, canonical, type = 'website' }: SEOProps) {
    useEffect(() => {
        // Title
        document.title = title;

        // Meta description
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) metaDesc.setAttribute('content', description);

        // OG tags
        const setOG = (prop: string, content: string) => {
            let el = document.querySelector(`meta[property="${prop}"]`) as HTMLMetaElement;
            if (!el) {
                el = document.createElement('meta');
                el.setAttribute('property', prop);
                document.head.appendChild(el);
            }
            el.content = content;
        };
        setOG('og:title', title);
        setOG('og:description', description);
        setOG('og:type', type);
        if (canonical) setOG('og:url', canonical);

        // Twitter tags
        const setTW = (name: string, content: string) => {
            let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement;
            if (!el) {
                el = document.createElement('meta');
                el.setAttribute('name', name);
                document.head.appendChild(el);
            }
            el.content = content;
        };
        setTW('twitter:title', title);
        setTW('twitter:description', description);

        // Canonical link
        if (canonical) {
            let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
            if (!link) {
                link = document.createElement('link');
                link.rel = 'canonical';
                document.head.appendChild(link);
            }
            link.href = canonical;
        }
    }, [title, description, canonical, type]);

    return null; // Renders nothing — side-effect only
}
