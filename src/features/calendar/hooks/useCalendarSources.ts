/**
 * Owns "which calendars are we showing" for the calendar modal.
 *
 * Loads every calendar across every connected Google account, tracks
 * which ones are ticked, assigns each a stable color, and persists the
 * selection so reopening the modal shows the same overlay the user set
 * up last time.
 *
 * Selection lives in localStorage rather than on the server: it's a
 * per-device presentation preference, the same call
 * `useCalendarViewPreference` makes for the view tabs.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
    CalendarListResponse,
    CalendarSource,
    CalendarSummary,
    FailedAccount,
    listCalendars,
    sourceKey,
} from "../../integrations/services/calendar";
import { FREE_BUSY_ROLES } from "../utils/eventLabel";
import { assignSourceColors } from "../utils/sourceColors";

const STORAGE_KEY = "genos-calendar-selected-sources";

/** Roles that permit creating/editing events. Anything else — most
 *  importantly "reader" and "freeBusyReader", which is what a calendar
 *  shared by a teammate usually grants — is display-only, and the UI
 *  must not offer a create affordance that would 403. */
const WRITABLE_ROLES = new Set(["owner", "writer"]);

export const isWritableCalendar = (calendar: CalendarSummary | undefined): boolean =>
    !!calendar && WRITABLE_ROLES.has(calendar.access_role ?? "owner");

const readStoredSelection = (): string[] | null => {
    if (typeof window === "undefined") return null;
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return null;
        return parsed.filter((v): v is string => typeof v === "string");
    } catch {
        // Corrupt entry or private mode — treat as "no preference" and
        // fall back to the Google-side default selection.
        return null;
    }
};

const writeStoredSelection = (keys: string[]): void => {
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
    } catch {
        // Quota / private mode. The in-memory selection still drives
        // this session correctly; only persistence is lost.
    }
};

export interface CalendarSourcesState {
    calendars: CalendarSummary[];
    /** Accounts whose calendar list failed to load, so the modal can
     *  banner them without hiding the calendars that did load. */
    failedAccounts: FailedAccount[];
    /** Selected source keys, as `accountId:calendarId`. */
    selectedKeys: Set<string>;
    /** Selected sources in the shape the aggregate fetch wants. */
    selectedSources: CalendarSource[];
    /** Base color per source key, for the grid and the legend. */
    colorBySource: Record<string, string>;
    /** Source keys whose calendar is shared at Google's free/busy level.
     *  Google strips event titles at that level, so the views render
     *  "Busy" rather than "(no title)" — the blank is the sharing
     *  setting working, not a missing value. */
    freeBusySources: Set<string>;
    loading: boolean;
    /** True once a load has completed (success or failure). Lets the
     *  caller distinguish "no calendars yet" from "no calendars". */
    loaded: boolean;
    error: string | null;
    toggleSource: (key: string) => void;
    setAccountSelected: (accountId: string, selected: boolean) => void;
    reload: () => void;
}

export const useCalendarSources = (
    accessToken: string | null,
    enabled: boolean
): CalendarSourcesState => {
    const [calendars, setCalendars] = useState<CalendarSummary[]>([]);
    const [failedAccounts, setFailedAccounts] = useState<FailedAccount[]>([]);
    const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [reloadToken, setReloadToken] = useState(0);

    // Whether the stored selection has been applied yet. Without this
    // guard the seeding effect would re-run on every reload and undo
    // ticks the user made since — it must seed once per mount, not once
    // per fetch.
    const seededRef = useRef(false);

    useEffect(() => {
        if (!enabled || !accessToken) return;
        let cancelled = false;
        setLoading(true);
        setError(null);
        void (async () => {
            const res = await listCalendars(accessToken, setError);
            if (cancelled) return;
            setLoading(false);
            setLoaded(true);
            if (!res || typeof res === "string") {
                // Connection-level failure (not connected / no scope /
                // reauth). The modal renders the matching prompt from
                // its own connection probe; here we just clear so a
                // stale list isn't shown as if it were live.
                setCalendars([]);
                setFailedAccounts([]);
                return;
            }
            applyList(res, cancelled);
        })();

        function applyList(res: CalendarListResponse, isCancelled: boolean) {
            if (isCancelled) return;
            const items = res.calendars ?? [];
            setCalendars(items);
            setFailedAccounts(res.failed_accounts ?? []);

            if (seededRef.current) {
                // Already seeded this mount. Keep the user's ticks, but
                // drop any that point at a calendar that no longer
                // exists (account disconnected, calendar unsubscribed)
                // so the aggregate call doesn't keep asking for it.
                const live = new Set(items.map((c) => sourceKey(c.account_id, c.id)));
                setSelectedKeys((prev) => {
                    const next = new Set([...prev].filter((k) => live.has(k)));
                    return next.size === prev.size ? prev : next;
                });
                return;
            }
            seededRef.current = true;

            const stored = readStoredSelection();
            if (stored) {
                const live = new Set(items.map((c) => sourceKey(c.account_id, c.id)));
                const restored = stored.filter((k) => live.has(k));
                // A stored selection that no longer matches anything
                // (e.g. every account was reconnected and got new ids)
                // would leave the grid mysteriously empty. Treat that
                // as "no preference" and fall through to the default.
                if (restored.length > 0) {
                    setSelectedKeys(new Set(restored));
                    return;
                }
            }
            // Default: whatever the user already has ticked on Google,
            // so the first open mirrors their own Google Calendar.
            // Falls back to primary calendars if Google reported none.
            const defaults = items.filter((c) => c.selected || c.primary);
            const chosen = defaults.length > 0 ? defaults : items;
            setSelectedKeys(new Set(chosen.map((c) => sourceKey(c.account_id, c.id))));
        }

        return () => {
            cancelled = true;
        };
    }, [accessToken, enabled, reloadToken]);

    const persist = useCallback((next: Set<string>) => {
        writeStoredSelection([...next]);
        return next;
    }, []);

    const toggleSource = useCallback(
        (key: string) => {
            setSelectedKeys((prev) => {
                const next = new Set(prev);
                if (next.has(key)) next.delete(key);
                else next.add(key);
                return persist(next);
            });
        },
        [persist]
    );

    const setAccountSelected = useCallback(
        (accountId: string, selected: boolean) => {
            setSelectedKeys((prev) => {
                const next = new Set(prev);
                for (const c of calendars) {
                    if (c.account_id !== accountId) continue;
                    const key = sourceKey(c.account_id, c.id);
                    if (selected) next.add(key);
                    else next.delete(key);
                }
                return persist(next);
            });
        },
        [calendars, persist]
    );

    const reload = useCallback(() => setReloadToken((n) => n + 1), []);

    // Assigned across the whole set rather than per calendar, so two
    // calendars can't independently hash onto the same color — the pair
    // that would collide most visibly being a work "primary" and a
    // personal "primary".
    const colorBySource = useMemo(
        () =>
            assignSourceColors(
                calendars.map((c) => ({
                    accountId: c.account_id,
                    calendarId: c.id,
                    googleColor: c.background_color,
                }))
            ),
        [calendars]
    );

    const freeBusySources = useMemo(
        () =>
            new Set(
                calendars
                    .filter((c) => c.access_role && FREE_BUSY_ROLES.has(c.access_role))
                    .map((c) => sourceKey(c.account_id, c.id))
            ),
        [calendars]
    );

    const selectedSources = useMemo(
        () =>
            calendars
                .filter((c) => selectedKeys.has(sourceKey(c.account_id, c.id)))
                .map((c) => ({ accountId: c.account_id, calendarId: c.id })),
        [calendars, selectedKeys]
    );

    return {
        calendars,
        failedAccounts,
        selectedKeys,
        selectedSources,
        colorBySource,
        freeBusySources,
        loading,
        loaded,
        error,
        toggleSource,
        setAccountSelected,
        reload,
    };
};
