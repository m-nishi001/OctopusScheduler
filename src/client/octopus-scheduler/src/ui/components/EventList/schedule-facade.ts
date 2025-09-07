// Local mock facade for EventList MVP.
// Purpose: provide a minimal, easily-removable adapter that supports the UI flows
// (getAllScheduleEvents, addEventToSchedule, removeScheduleEvent) and persists
// data to localStorage so developers can demo and test without depending on
// external model/service layers. Keep this file inside EventList for easy cleanup.

const STORAGE_KEY = 'eventlist-mock-schedules-v1';

type UIEventObj = { id: string; name: string; type: string; assetName?: string };
type ScheduleObj = { id: string; events: UIEventObj[] };

function safeUUID(): string {
    try {
        return (globalThis.crypto && (globalThis.crypto as any).randomUUID && (globalThis.crypto as any).randomUUID()) || `${Date.now()}`;
    } catch {
        return `${Date.now()}`;
    }
}

function loadSchedules(): ScheduleObj[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        return JSON.parse(raw) as ScheduleObj[];
    } catch (e) {
        console.error('Failed to load mock schedules', e);
        return [];
    }
}

function saveSchedules(schedules: ScheduleObj[]) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules));
    } catch (e) {
        console.error('Failed to save mock schedules', e);
    }
}

function ensureSeed(): ScheduleObj[] {
    const existing = loadSchedules();
    if (existing.length > 0) return existing;
    const seed: ScheduleObj[] = [
        {
            id: 'default-schedule',
            events: [
                { id: safeUUID(), name: 'BGM: Opening', type: 'AudioEvent', assetName: 'opening.mp3' },
                { id: safeUUID(), name: 'Show: Title', type: 'ImageEvent', assetName: 'title.png' },
                { id: safeUUID(), name: 'Play: Trailer', type: 'VideoEvent', assetName: 'trailer.mp4' }
            ]
        }
    ];
    saveSchedules(seed);
    return seed;
}

export class LocalScheduleFacade {
    constructor() {
        // Ensure there is at least one schedule present for quick testing
        if (typeof localStorage !== 'undefined') {
            ensureSeed();
        }
    }

    /**
     * Return schedules in a shape compatible with the old UI expectations.
     * Each schedule has: id, getEvents(): array of event-like objects with methods
     */
    async getAllScheduleEvents(): Promise<any[]> {
        const schedules = loadSchedules();
        // Map to objects with getEvents() to match existing UI code that expects domain-like objects
        return schedules.map(s => ({
            id: s.id,
            getEvents: () => s.events.map(ev => ({
                id: ev.id,
                // compatibility: old UI calls getEventName() / getDetail()
                getEventName: () => ev.name,
                getDetail: () => ({ assetName: ev.assetName, audioID: ev.assetName, imageID: ev.assetName, videoID: ev.assetName }),
                // expose type for UI convenience
                type: ev.type
            }))
        }));
    }

    async addEventToSchedule(scheduleId: string, iEvent: any): Promise<void> {
        const schedules = loadSchedules();
        const target = schedules.find(s => s.id === scheduleId) || schedules[0];
        if (!target) throw new Error('No schedule found to add event');

        const id = iEvent.id || safeUUID();
        const name = (typeof iEvent.getEventName === 'function') ? iEvent.getEventName() : (iEvent.name || 'untitled');
        const assetName = (typeof iEvent.getDetail === 'function') ? (iEvent.getDetail()?.assetName ?? '') : (iEvent.assetName ?? '');
        const type = iEvent.type ?? 'AudioEvent';

        target.events.push({ id, name, type, assetName });
        saveSchedules(schedules);
    }

    async removeScheduleEvent(scheduleId: string, eventId: string): Promise<void> {
        const schedules = loadSchedules();
        const target = schedules.find(s => s.id === scheduleId) || schedules[0];
        if (!target) throw new Error('Schedule not found');

        const idx = target.events.findIndex(e => e.id === eventId || (e as any).eventId === eventId);
        if (idx >= 0) {
            target.events.splice(idx, 1);
            saveSchedules(schedules);
        }
    }
}

// Export a default shared instance for convenience
export const scheduleFacade = new LocalScheduleFacade();
