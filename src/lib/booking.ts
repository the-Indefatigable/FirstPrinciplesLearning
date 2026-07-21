import {
    doc, getDoc, setDoc, collection, query, orderBy, getDocs,
    addDoc, updateDoc, deleteDoc, serverTimestamp, arrayUnion, Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';

/**
 * Custom booking system — a free, self-hosted replacement for Calendly.
 *
 * Data model (two collections, PII-safe):
 *   config/availability   — the tutor's weekly schedule (public read; admin write)
 *   slots/{YYYY-MM-DD}     — { taken: string[] } booked times per day.
 *                            NO personal data. Public read + create so the widget
 *                            can show what's free and reserve a slot.
 *   bookings/{autoId}      — full booking incl. name/email/notes.
 *                            Public CREATE only; admin READ. Never queried publicly,
 *                            so student contact details are never exposed client-side.
 */

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'done';

export interface DayAvail {
    enabled: boolean;
    start: string; // "16:00"
    end: string;   // "21:00"
}

export interface AvailabilityConfig {
    timezone: string;      // display label, e.g. "America/Toronto"
    slotMinutes: number;   // length of each session slot
    leadTimeHours: number; // earliest a slot can be booked (hours from now)
    horizonDays: number;   // how far ahead a student may book
    subjects: string[];
    /** index 0 = Sunday … 6 = Saturday */
    days: DayAvail[];
}

export interface Booking {
    id?: string;
    name: string;
    email: string;
    subject: string;
    date: string;          // "YYYY-MM-DD"
    time: string;          // "HH:MM" (24h)
    durationMin: number;
    notes: string;
    status: BookingStatus;
    createdAt?: Timestamp | null;
}

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const guessTimezone = () => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Toronto'; }
    catch { return 'America/Toronto'; }
};

export const DEFAULT_AVAILABILITY: AvailabilityConfig = {
    timezone: guessTimezone(),
    slotMinutes: 60,
    leadTimeHours: 12,
    horizonDays: 30,
    subjects: ['Mathematics', 'Physics', 'Computer Science'],
    days: [
        { enabled: false, start: '10:00', end: '16:00' }, // Sun
        { enabled: true, start: '16:00', end: '21:00' },  // Mon
        { enabled: true, start: '16:00', end: '21:00' },  // Tue
        { enabled: true, start: '16:00', end: '21:00' },  // Wed
        { enabled: true, start: '16:00', end: '21:00' },  // Thu
        { enabled: true, start: '16:00', end: '21:00' },  // Fri
        { enabled: true, start: '10:00', end: '16:00' },  // Sat
    ],
};

const AVAIL_REF = doc(db, 'config', 'availability');

/* ── Availability ─────────────────────────────────────────────────── */

export async function fetchAvailability(): Promise<AvailabilityConfig> {
    try {
        const snap = await getDoc(AVAIL_REF);
        if (snap.exists()) {
            const d = snap.data() as Partial<AvailabilityConfig>;
            return {
                ...DEFAULT_AVAILABILITY,
                ...d,
                // days is a fixed 7-length array; fall back if malformed
                days: Array.isArray(d.days) && d.days.length === 7 ? d.days as DayAvail[] : DEFAULT_AVAILABILITY.days,
                subjects: Array.isArray(d.subjects) && d.subjects.length ? d.subjects : DEFAULT_AVAILABILITY.subjects,
            };
        }
    } catch (err) {
        console.warn('Failed to fetch availability, using defaults:', err);
    }
    return { ...DEFAULT_AVAILABILITY };
}

export async function saveAvailability(cfg: AvailabilityConfig): Promise<void> {
    await setDoc(AVAIL_REF, cfg, { merge: true });
}

/* ── Slot generation ──────────────────────────────────────────────── */

const toMinutes = (hhmm: string): number => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
};

const pad = (n: number) => String(n).padStart(2, '0');
const fromMinutes = (mins: number): string => `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;

/** Parse a "YYYY-MM-DD" string as a local-time Date (midnight). */
export function parseLocalDate(dateStr: string): Date {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
}

/** "YYYY-MM-DD" for a Date in local time. */
export function toDateStr(d: Date): string {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 24h "HH:MM" → "4:00 PM". */
export function formatTime(hhmm: string): string {
    const [h, m] = hhmm.split(':').map(Number);
    const ampm = h < 12 ? 'AM' : 'PM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${pad(m)} ${ampm}`;
}

/**
 * All bookable start times for a given date, honoring availability,
 * lead time, and already-taken slots.
 */
export function generateSlots(
    dateStr: string,
    cfg: AvailabilityConfig,
    taken: string[],
): string[] {
    const date = parseLocalDate(dateStr);
    const weekday = date.getDay();
    const day = cfg.days[weekday];
    if (!day || !day.enabled) return [];

    const start = toMinutes(day.start);
    const end = toMinutes(day.end);
    const step = cfg.slotMinutes;
    if (step <= 0 || end <= start) return [];

    const takenSet = new Set(taken);
    const now = new Date();
    const earliest = new Date(now.getTime() + cfg.leadTimeHours * 3600_000);

    const slots: string[] = [];
    for (let t = start; t + step <= end; t += step) {
        const hhmm = fromMinutes(t);
        if (takenSet.has(hhmm)) continue;
        const slotDate = new Date(date);
        slotDate.setHours(Math.floor(t / 60), t % 60, 0, 0);
        if (slotDate < earliest) continue;
        slots.push(hhmm);
    }
    return slots;
}

/** Dates (YYYY-MM-DD) that fall within the booking horizon, starting today. */
export function bookableDateWindow(cfg: AvailabilityConfig): { min: string; max: string } {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const max = new Date(today);
    max.setDate(max.getDate() + cfg.horizonDays);
    return { min: toDateStr(today), max: toDateStr(max) };
}

/* ── Slots (PII-free public reservation ledger) ───────────────────── */

export async function fetchTakenSlots(dateStr: string): Promise<string[]> {
    try {
        const snap = await getDoc(doc(db, 'slots', dateStr));
        if (snap.exists()) {
            const taken = snap.data().taken;
            return Array.isArray(taken) ? taken : [];
        }
    } catch (err) {
        console.warn('Failed to fetch taken slots:', err);
    }
    return [];
}

async function reserveSlot(dateStr: string, time: string): Promise<void> {
    await setDoc(doc(db, 'slots', dateStr), { taken: arrayUnion(time) }, { merge: true });
}

/* ── Bookings ─────────────────────────────────────────────────────── */

/**
 * Create a booking. Reserves the slot (PII-free) and stores the full
 * record. Re-checks the slot right before writing to reduce double-booking.
 */
export async function createBooking(
    b: Omit<Booking, 'id' | 'status' | 'createdAt'>,
): Promise<void> {
    const taken = await fetchTakenSlots(b.date);
    if (taken.includes(b.time)) {
        throw new Error('SLOT_TAKEN');
    }
    await reserveSlot(b.date, b.time);
    await addDoc(collection(db, 'bookings'), {
        name: b.name.trim(),
        email: b.email.trim(),
        subject: b.subject,
        date: b.date,
        time: b.time,
        durationMin: b.durationMin,
        notes: b.notes.trim(),
        status: 'pending' as BookingStatus,
        createdAt: serverTimestamp(),
    });
}

export async function fetchAllBookings(): Promise<Booking[]> {
    const q = query(collection(db, 'bookings'), orderBy('date', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Booking));
}

export async function updateBookingStatus(id: string, status: BookingStatus): Promise<void> {
    await updateDoc(doc(db, 'bookings', id), { status });
}

/** Delete a booking and free its slot. */
export async function deleteBooking(b: Booking): Promise<void> {
    if (b.id) await deleteDoc(doc(db, 'bookings', b.id));
    // Free the slot so it can be re-booked.
    try {
        const taken = await fetchTakenSlots(b.date);
        const next = taken.filter(t => t !== b.time);
        await setDoc(doc(db, 'slots', b.date), { taken: next }, { merge: true });
    } catch (err) {
        console.warn('Failed to free slot on delete:', err);
    }
}
