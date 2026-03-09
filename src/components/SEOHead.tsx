import { useEffect } from 'react';

interface LearningResourceData {
    name: string;
    description: string;
    url: string;
    category: string;
    educationalLevel?: string;
}

interface SEOProps {
    title: string;
    description: string;
    canonical?: string;
    type?: string;
    breadcrumbs?: { name: string; url: string }[];
    learningResource?: LearningResourceData;
}

/**
 * Sets per-page <title>, <meta> description, OG, Twitter, canonical, and breadcrumb schema.
 */
export default function SEOHead({ title, description, canonical, type = 'website', breadcrumbs, learningResource }: SEOProps) {
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

        // Breadcrumb JSON-LD
        const bcId = 'seo-breadcrumb-ld';
        const oldBc = document.getElementById(bcId);
        if (oldBc) oldBc.remove();

        if (breadcrumbs && breadcrumbs.length > 0) {
            const script = document.createElement('script');
            script.id = bcId;
            script.type = 'application/ld+json';
            script.textContent = JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'BreadcrumbList',
                itemListElement: breadcrumbs.map((bc, i) => ({
                    '@type': 'ListItem',
                    position: i + 1,
                    name: bc.name,
                    item: bc.url,
                })),
            });
            document.head.appendChild(script);
        }

        // LearningResource JSON-LD
        const lrId = 'seo-learning-resource-ld';
        const oldLr = document.getElementById(lrId);
        if (oldLr) oldLr.remove();

        if (learningResource) {
            const script = document.createElement('script');
            script.id = lrId;
            script.type = 'application/ld+json';
            script.textContent = JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'LearningResource',
                name: learningResource.name,
                description: learningResource.description,
                url: learningResource.url,
                provider: {
                    '@type': 'EducationalOrganization',
                    name: 'FirstPrinciple Tutoring',
                    url: 'https://www.firstprincipleslearningg.com',
                },
                educationalLevel: learningResource.educationalLevel || 'High School / University',
                isAccessibleForFree: true,
                learningResourceType: 'Interactive Tool',
                about: {
                    '@type': 'Thing',
                    name: learningResource.category,
                },
            });
            document.head.appendChild(script);
        }

        return () => {
            // Clean up on unmount
            const el = document.getElementById(bcId);
            if (el) el.remove();
            const lr = document.getElementById(lrId);
            if (lr) lr.remove();
        };
    }, [title, description, canonical, type, breadcrumbs, learningResource]);

    return null;
}
