import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { NotificationManager } from "../../services/notifications/notificationManager";
import {
    isSnoozedNow,
    msUntilNextBoundary,
    SnoozeSchedule,
    untilNextWeek,
    untilTomorrow,
} from "../../services/notifications/snooze";
import { writeSnoozeMirror } from "../../services/notifications/snoozeMirror";
import { UserProps } from "../../types/admin";
import { resolveDisplayZone } from "../../utils/userTimezone";

/** Backstop re-evaluation cadence. The `setTimeout` armed to the exact next
 *  boundary is the primary mechanism; this only catches a boundary the timer
 *  missed (tab throttled while backgrounded, wall-clock jump, DST shift). */
const BACKSTOP_MS = 60_000;

/** A small buffer so the re-evaluation fires strictly AFTER the boundary
 *  minute has ticked over, never a millisecond before it. */
const BOUNDARY_BUFFER_MS = 250;

export interface NotificationPauseState {
    /** Reactive "am I paused right now" — recomputed on a timer armed to the
     *  next boundary, so a lapsed one-shot / schedule edge self-clears the
     *  badge and gate WITHOUT a refresh. */
    isPausedNow: boolean;
    /** The current one-shot expiry (absolute ISO instant) or null. */
    snoozeUntil: string | null;
    /** The current recurring daily window or null. */
    snoozeSchedule: SnoozeSchedule | null;
    /** Pause for a fixed duration from now (30m / 1h / 2h presets). */
    pauseFor: (ms: number) => void;
    /** Pause until tomorrow morning, local. */
    pauseUntilTomorrow: () => void;
    /** Pause until the coming Monday morning, local. */
    pauseUntilNextWeek: () => void;
    /** Pause until an explicit absolute ISO instant (the custom picker). */
    pauseUntil: (iso: string) => void;
    /** Clear the one-shot pause (PUTs explicit null). Leaves the schedule. */
    resume: () => void;
    /** Set (or clear, with null) the recurring daily window. */
    setSchedule: (schedule: SnoozeSchedule | null) => void;
}

/**
 * The React face of the pause feature — composed inside `useNotifications`.
 *
 * Owns three things the pure `NotificationManager` singleton can't:
 *   - the current user's resolved zone, fed to the manager so its
 *     schedule-branch fires in the same zone the profile card shows;
 *   - a reactive `isPausedNow` that self-clears on expiry (the manager
 *     evaluates lazily at `notify()`, but the avatar badge needs a push);
 *   - the localStorage mirror + `pause-changed` event the heartbeat reads to
 *     broadcast the paused state to other users' avatars.
 */
export const useNotificationPause = (
    manager: NotificationManager,
    myself: UserProps
): NotificationPauseState => {
    const zone = useMemo(
        () => resolveDisplayZone(myself, true) ?? "UTC",
        [myself.currentLocation, myself.timezone]
    );

    // Feed the zone to the manager via a ref-backed provider so its `notify()`
    // gate resolves the schedule in the user's zone without rebuilding the
    // provider on every zone change.
    const zoneRef = useRef(zone);
    zoneRef.current = zone;
    useEffect(() => {
        manager.setZoneProvider(() => zoneRef.current);
    }, [manager]);

    // Track the manager's snooze fields reactively (they change via our own
    // actions AND via the initial server hydrate).
    const [snoozeUntil, setSnoozeUntil] = useState<string | null>(
        () => manager.getPreferences().snoozeUntil ?? null
    );
    const [snoozeSchedule, setSnoozeSchedule] = useState<SnoozeSchedule | null>(
        () => manager.getPreferences().snoozeSchedule ?? null
    );
    useEffect(() => {
        return manager.subscribePreferences((p) => {
            setSnoozeUntil(p.snoozeUntil ?? null);
            setSnoozeSchedule(p.snoozeSchedule ?? null);
        });
    }, [manager]);

    // Mirror to localStorage + announce, so the heartbeat can compute
    // `isNotificationsPaused` off plain storage and beat immediately on
    // change. Driven off the tracked values (not the actions) so a server
    // hydrate updates the mirror too.
    useEffect(() => {
        writeSnoozeMirror({ snoozeUntil, snoozeSchedule });
    }, [snoozeUntil, snoozeSchedule]);

    // Reactive pause state: evaluate now, then arm a timeout to the exact next
    // boundary so expiry clears the badge without a refresh; a low-frequency
    // backstop covers a boundary the timer slept through.
    const [isPausedNow, setIsPausedNow] = useState<boolean>(() =>
        isSnoozedNow(snoozeUntil, snoozeSchedule, zone)
    );
    useEffect(() => {
        let timeout: ReturnType<typeof setTimeout> | undefined;
        const evaluate = () => {
            setIsPausedNow(isSnoozedNow(snoozeUntil, snoozeSchedule, zone));
            const ms = msUntilNextBoundary(snoozeUntil, snoozeSchedule, zone);
            if (timeout) clearTimeout(timeout);
            if (ms !== null) timeout = setTimeout(evaluate, ms + BOUNDARY_BUFFER_MS);
        };
        evaluate();
        const backstop = setInterval(evaluate, BACKSTOP_MS);
        return () => {
            if (timeout) clearTimeout(timeout);
            clearInterval(backstop);
        };
    }, [snoozeUntil, snoozeSchedule, zone]);

    const pauseUntil = useCallback((iso: string) => manager.setSnoozeUntil(iso), [manager]);
    const pauseFor = useCallback(
        (ms: number) => manager.setSnoozeUntil(new Date(Date.now() + ms).toISOString()),
        [manager]
    );
    const pauseUntilTomorrow = useCallback(
        () => manager.setSnoozeUntil(untilTomorrow(zoneRef.current)),
        [manager]
    );
    const pauseUntilNextWeek = useCallback(
        () => manager.setSnoozeUntil(untilNextWeek(zoneRef.current)),
        [manager]
    );
    const resume = useCallback(() => manager.setSnoozeUntil(null), [manager]);
    const setSchedule = useCallback(
        (schedule: SnoozeSchedule | null) => manager.setSnoozeSchedule(schedule),
        [manager]
    );

    return {
        isPausedNow,
        snoozeUntil,
        snoozeSchedule,
        pauseFor,
        pauseUntilTomorrow,
        pauseUntilNextWeek,
        pauseUntil,
        resume,
        setSchedule,
    };
};
