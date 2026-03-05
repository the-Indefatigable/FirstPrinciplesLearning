import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface SiteSettings {
    bookingLink: string;
    heroBadge: string;
    heroCtaText: string;
}

const DEFAULTS: SiteSettings = {
    bookingLink: 'mailto:tutoring@firstprinciple.ca',
    heroBadge: 'Now accepting students for 2026',
    heroCtaText: 'Book a Free Consultation →',
};

const DOC_REF = doc(db, 'config', 'siteSettings');

/**
 * Fetch site settings from Firestore.
 * Returns defaults if the doc doesn't exist or Firestore fails.
 */
export async function fetchSettings(): Promise<SiteSettings> {
    try {
        const snap = await getDoc(DOC_REF);
        if (snap.exists()) {
            const data = snap.data();
            return {
                bookingLink: data.bookingLink || DEFAULTS.bookingLink,
                heroBadge: data.heroBadge || DEFAULTS.heroBadge,
                heroCtaText: data.heroCtaText || DEFAULTS.heroCtaText,
            };
        }
    } catch (err) {
        console.warn('Failed to fetch site settings, using defaults:', err);
    }
    return { ...DEFAULTS };
}

/**
 * Save site settings to Firestore.
 */
export async function saveSettings(settings: SiteSettings): Promise<void> {
    await setDoc(DOC_REF, settings, { merge: true });
}
