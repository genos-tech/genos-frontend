/**
 * A localStorage mirror of the two snooze fields, plus the window event that
 * announces a change.
 *
 * The pause state lives authoritatively on the server (`NotificationPreference`)
 * and in the `NotificationManager`, but two consumers need it OUTSIDE the React
 * tree that owns the manager:
 *
 *   - `useWebSocket.sendHeartBeat()` computes `isNotificationsPaused` fresh on
 *     every beat to ride it out on the presence broadcast, and it reads plain
 *     localStorage (the same way it already reads `isOfflineForced`) rather than
 *     subscribing to the manager.
 *
 * So the pause hook mirrors both fields here on every change and fires
 * `PAUSE_CHANGED_EVENT` so the heartbeat can beat immediately (a manual pause
 * then syncs to other users in <1s instead of waiting up to 60s for the tick).
 */

import { SnoozeSchedule } from "./snooze";

export const SNOOZE_UNTIL_KEY = "notifSnoozeUntil";
export const SNOOZE_SCHEDULE_KEY = "notifSnoozeSchedule";

/** Dispatched on `window` whenever the local snooze state changes. */
export const PAUSE_CHANGED_EVENT = "notifications:pause-changed";

export interface SnoozeMirror {
    snoozeUntil: string | null;
    snoozeSchedule: SnoozeSchedule | null;
}

/** Read the mirrored snooze state; tolerant of absent / corrupt values. */
export const readSnoozeMirror = (): SnoozeMirror => {
    let snoozeUntil: string | null = null;
    let snoozeSchedule: SnoozeSchedule | null = null;
    try {
        snoozeUntil = localStorage.getItem(SNOOZE_UNTIL_KEY) || null;
        const raw = localStorage.getItem(SNOOZE_SCHEDULE_KEY);
        if (raw) snoozeSchedule = JSON.parse(raw) as SnoozeSchedule;
    } catch {
        // A corrupt mirror must never break the heartbeat — treat as unset.
    }
    return { snoozeUntil, snoozeSchedule };
};

/** Overwrite the mirror and announce the change on `window`. */
export const writeSnoozeMirror = (mirror: SnoozeMirror): void => {
    try {
        if (mirror.snoozeUntil) localStorage.setItem(SNOOZE_UNTIL_KEY, mirror.snoozeUntil);
        else localStorage.removeItem(SNOOZE_UNTIL_KEY);

        if (mirror.snoozeSchedule)
            localStorage.setItem(SNOOZE_SCHEDULE_KEY, JSON.stringify(mirror.snoozeSchedule));
        else localStorage.removeItem(SNOOZE_SCHEDULE_KEY);
    } catch {
        // Private-mode / quota failures are non-fatal: the manager + server
        // remain authoritative; only the cross-tab / heartbeat mirror lapses.
    }
    if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(PAUSE_CHANGED_EVENT));
    }
};
