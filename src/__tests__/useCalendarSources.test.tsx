/**
 * Which calendars the multi-account modal draws.
 *
 * The subtle requirements this hook has to hold, all of which produce a
 * silently-empty or silently-wrong grid when broken:
 *
 *  - **Seed once per mount.** Re-seeding on every refetch would throw
 *    away ticks the user made since opening the modal.
 *  - **Stale keys must be dropped.** A selection pointing at a
 *    disconnected account would keep being sent to the aggregate
 *    endpoint, which reports it as a failed source forever.
 *  - **A fully-stale stored selection must not win.** Restoring zero
 *    live calendars would leave the user staring at an empty grid with
 *    no indication why.
 *  - **Read-only shared calendars are not writable.** Offering "create
 *    here" on a teammate's calendar produces a 403 at save time.
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    isWritableCalendar,
    useCalendarSources,
} from "../features/calendar/hooks/useCalendarSources";
import { sourceKey, type CalendarSummary } from "../features/integrations/services/calendar";

const listCalendars = vi.hoisted(() => vi.fn());
vi.mock("../features/integrations/services/calendar", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("../features/integrations/services/calendar")>();
    return { ...actual, listCalendars };
});

const STORAGE_KEY = "genos-calendar-selected-sources";
const ACCOUNT_A = "11111111-1111-1111-1111-111111111111";
const ACCOUNT_B = "22222222-2222-2222-2222-222222222222";

const cal = (
    accountId: string,
    id: string,
    overrides: Partial<CalendarSummary> = {}
): CalendarSummary => ({
    id,
    account_id: accountId,
    account_email: accountId === ACCOUNT_A ? "me@work.com" : "me@gmail.com",
    summary: id,
    primary: id === "primary",
    access_role: "owner",
    selected: true,
    ...overrides,
});

const respond = (calendars: CalendarSummary[], failedAccounts: unknown[] = []) => {
    listCalendars.mockResolvedValue({
        calendars,
        failed_accounts: failedAccounts,
        accounts: [],
    });
};

beforeEach(() => {
    window.localStorage.clear();
    listCalendars.mockReset();
});

const render = () => renderHook(() => useCalendarSources("token", true));

describe("useCalendarSources", () => {
    it("loads calendars from every connected account", async () => {
        respond([cal(ACCOUNT_A, "primary"), cal(ACCOUNT_B, "primary")]);
        const { result } = render();
        await waitFor(() => expect(result.current.loaded).toBe(true));

        expect(result.current.calendars).toHaveLength(2);
        // Both accounts' primary calendars are distinct sources.
        expect(result.current.selectedSources).toHaveLength(2);
    });

    it("assigns each source its own color", async () => {
        respond([cal(ACCOUNT_A, "primary"), cal(ACCOUNT_B, "primary")]);
        const { result } = render();
        await waitFor(() => expect(result.current.loaded).toBe(true));

        const colors = Object.values(result.current.colorBySource);
        expect(new Set(colors).size).toBe(2);
    });

    it("defaults to the calendars the user has ticked on Google", async () => {
        respond([
            cal(ACCOUNT_A, "primary", { selected: true }),
            cal(ACCOUNT_A, "muted", { selected: false, primary: false }),
        ]);
        const { result } = render();
        await waitFor(() => expect(result.current.loaded).toBe(true));

        expect([...result.current.selectedKeys]).toEqual([sourceKey(ACCOUNT_A, "primary")]);
    });

    it("restores and persists the user's selection", async () => {
        respond([cal(ACCOUNT_A, "primary"), cal(ACCOUNT_B, "primary")]);
        window.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify([sourceKey(ACCOUNT_B, "primary")])
        );
        const { result } = render();
        await waitFor(() => expect(result.current.loaded).toBe(true));

        expect([...result.current.selectedKeys]).toEqual([sourceKey(ACCOUNT_B, "primary")]);

        act(() => result.current.toggleSource(sourceKey(ACCOUNT_A, "primary")));
        await waitFor(() => expect(result.current.selectedKeys.size).toBe(2));
        expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)).toHaveLength(2);
    });

    it("ignores a stored selection whose calendars are all gone", async () => {
        // Reconnecting an account mints new account ids. Honouring the
        // dead selection would render an empty grid with no explanation.
        respond([cal(ACCOUNT_A, "primary")]);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(["dead-account:primary"]));
        const { result } = render();
        await waitFor(() => expect(result.current.loaded).toBe(true));

        expect([...result.current.selectedKeys]).toEqual([sourceKey(ACCOUNT_A, "primary")]);
    });

    it("survives a corrupt stored value", async () => {
        respond([cal(ACCOUNT_A, "primary")]);
        window.localStorage.setItem(STORAGE_KEY, "{not json");
        const { result } = render();
        await waitFor(() => expect(result.current.loaded).toBe(true));

        expect(result.current.selectedKeys.size).toBe(1);
    });

    it("drops selected keys that no longer exist on reload", async () => {
        respond([cal(ACCOUNT_A, "primary"), cal(ACCOUNT_B, "primary")]);
        const { result } = render();
        await waitFor(() => expect(result.current.loaded).toBe(true));
        expect(result.current.selectedKeys.size).toBe(2);

        // Account B disconnected between loads.
        respond([cal(ACCOUNT_A, "primary")]);
        act(() => result.current.reload());
        await waitFor(() => expect(result.current.calendars).toHaveLength(1));

        expect([...result.current.selectedKeys]).toEqual([sourceKey(ACCOUNT_A, "primary")]);
    });

    it("keeps the user's ticks across a reload", async () => {
        respond([cal(ACCOUNT_A, "primary"), cal(ACCOUNT_A, "other", { primary: false })]);
        const { result } = render();
        await waitFor(() => expect(result.current.loaded).toBe(true));

        act(() => result.current.toggleSource(sourceKey(ACCOUNT_A, "primary")));
        await waitFor(() => expect(result.current.selectedKeys.size).toBe(1));

        act(() => result.current.reload());
        await waitFor(() => expect(listCalendars).toHaveBeenCalledTimes(2));

        // Re-seeding here would have re-ticked "primary".
        expect(result.current.selectedKeys.has(sourceKey(ACCOUNT_A, "primary"))).toBe(false);
    });

    it("toggles a whole account at once", async () => {
        respond([
            cal(ACCOUNT_A, "primary"),
            cal(ACCOUNT_A, "other", { primary: false }),
            cal(ACCOUNT_B, "primary"),
        ]);
        const { result } = render();
        await waitFor(() => expect(result.current.loaded).toBe(true));

        act(() => result.current.setAccountSelected(ACCOUNT_A, false));
        await waitFor(() =>
            expect(result.current.selectedSources.every((s) => s.accountId === ACCOUNT_B)).toBe(
                true
            )
        );

        act(() => result.current.setAccountSelected(ACCOUNT_A, true));
        await waitFor(() => expect(result.current.selectedKeys.size).toBe(3));
    });

    it("surfaces per-account failures without dropping the calendars that loaded", async () => {
        respond(
            [cal(ACCOUNT_A, "primary")],
            [{ account_id: ACCOUNT_B, reason: "google_reauth_required" }]
        );
        const { result } = render();
        await waitFor(() => expect(result.current.loaded).toBe(true));

        expect(result.current.calendars).toHaveLength(1);
        expect(result.current.failedAccounts).toHaveLength(1);
    });

    it("does not fetch while disabled", async () => {
        respond([cal(ACCOUNT_A, "primary")]);
        renderHook(() => useCalendarSources("token", false));
        expect(listCalendars).not.toHaveBeenCalled();
    });

    it("clears calendars on a connection-level failure", async () => {
        listCalendars.mockResolvedValue("google_not_connected");
        const { result } = render();
        await waitFor(() => expect(result.current.loaded).toBe(true));

        expect(result.current.calendars).toEqual([]);
    });
});

describe("isWritableCalendar", () => {
    it("allows calendars the user owns or can write", () => {
        expect(isWritableCalendar(cal(ACCOUNT_A, "primary", { access_role: "owner" }))).toBe(true);
        expect(isWritableCalendar(cal(ACCOUNT_A, "primary", { access_role: "writer" }))).toBe(
            true
        );
    });

    it("rejects a calendar a teammate shared read-only", () => {
        // This is the common shape of "shared with me" — creating on it
        // would 403 at save time.
        expect(isWritableCalendar(cal(ACCOUNT_A, "team", { access_role: "reader" }))).toBe(false);
        expect(isWritableCalendar(cal(ACCOUNT_A, "team", { access_role: "freeBusyReader" }))).toBe(
            false
        );
    });

    it("treats a missing role as writable", () => {
        // Older payloads (and our own primary calendar) may omit it;
        // defaulting to read-only would break creating events.
        expect(isWritableCalendar(cal(ACCOUNT_A, "primary", { access_role: null }))).toBe(true);
    });

    it("rejects undefined", () => {
        expect(isWritableCalendar(undefined)).toBe(false);
    });
});
