import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { SiteSettings } from '../lib/siteSettings';
import { fetchSettings } from '../lib/siteSettings';

const DEFAULTS: SiteSettings = {
    bookingLink: 'mailto:tutoring@firstprinciple.ca',
    heroBadge: 'Now accepting students for 2026',
    heroCtaText: 'Book a Free Consultation →',
};

const Ctx = createContext<SiteSettings>(DEFAULTS);

export function SettingsProvider({ children }: { children: ReactNode }) {
    const [settings, setSettings] = useState<SiteSettings>(DEFAULTS);

    useEffect(() => {
        fetchSettings().then(setSettings);
    }, []);

    return <Ctx.Provider value={settings}>{children}</Ctx.Provider>;
}

export function useSettings() {
    return useContext(Ctx);
}
