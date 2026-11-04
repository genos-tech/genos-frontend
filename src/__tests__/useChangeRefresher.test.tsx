/**
 * `useChangeRefresher`: every refresh trigger lands on ONE throttled,
 * change-driven call (MIP-970 step 5).
 *
 * The hook runs for real; only the HTTP layer (`authApi`) is mocked, with the
 * contract fixture as the `/changes/` answer, and each loader is a spy that
 * stands for one request. "Requests" below = `/changes/` calls + loader calls,
 * which is what the network panel would show.
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    CHANGE_COLLECTIONS,
    type ChangeCollection,
    type Loader,
    type LoaderGroups,
} from "../context/changeRefresher";
import { NOTE_LIST_POLL_MS } from "../context/hashMentionRefresh";
import { useChangeRefresher } from "../hooks/common/useChangeRefresher";
import fixture from "./fixtures/changes_response.json";

const net = vi.hoisted(() => ({
    get: vi.fn(),
    // What `/changes/` does: serve `tokens`, or reject like a 404.
    tokens: {} as Record<string, string | null>,
    failWith: null as null | Error,
}));
vi.mock("../services/api", () => ({
    authApi: (token: string | null | undefined) => (token ? { get: net.get } : null),
}));

const SIZES: Record<ChangeCollection, number> = {
    tasks_project: 2,
    tasks_team: 1,
    projects: 1,
    notes_personal: 4,
    notes_task: 1,
    notes_chat: 1,
};
const LOADERS_PER_FULL_REFRESH = 10;

const makeHost = () => {
    const spies = {} as Record<ChangeCollection, ReturnType<typeof vi.fn>[]>;
    const groups = {} as LoaderGroups;
    for (const c of CHANGE_COLLECTIONS) {
        spies[c] = Array.from({ length: SIZES[c] }, () => vi.fn(async () => true));
        groups[c] = spies[c] as unknown as Loader[];
    }
    const total = () =>
        CHANGE_COLLECTIONS.reduce(
            (n, c) => n + spies[c].reduce((m, s) => m + s.mock.calls.length, 0),
            0
        );
    const calls = (c: ChangeCollection) => spies[c].reduce((m, s) => m + s.mock.calls.length, 0);
    return { groups, total, calls, spies };
};

type Props = {
    accessToken: string | null;
    userId: string | null;
    teamId: string | null;
    projectId: number | null;
};
const SIGNED_IN: Props = { accessToken: "tok", userId: "u1", teamId: "team-a", projectId: 7 };

// Wired like App: the project loaders exist only while a project is open.
const mountHost = (host = makeHost(), initial: Props = SIGNED_IN) => {
    const view = renderHook(
        (props: Props) =>
            useChangeRefresher({
                ...props,
                buildGroups: (projectId) => ({
                    ...host.groups,
                    tasks_project: projectId ? host.groups.tasks_project : [],
                }),
            }),
        { initialProps: initial }
    );
    return { ...view, host };
};

const changesCalls = () =>
    net.get.mock.calls.filter(([url]) => String(url).startsWith("/changes/"));

const elapse = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-04T09:00:00Z"));
    net.get.mockReset();
    net.failWith = null;
    net.tokens = { ...fixture.tokens };
    net.get.mockImplementation(async (url: string) => {
        if (net.failWith) throw net.failWith;
        // The server answers `tasks_project` only for a project that was asked about.
        const project = new URL(url, "http://x").searchParams.get("project_id");
        return {
            data: {
                tokens: {
                    ...net.tokens,
                    tasks_project: project ? net.tokens.tasks_project : null,
                },
            },
        };
    });
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
});

afterEach(() => {
    vi.useRealTimers();
});

describe("useChangeRefresher", () => {
    it("asks /changes/ with the team and the open project, and silences the error toast", async () => {
        const { host } = mountHost();
        await elapse(NOTE_LIST_POLL_MS);

        const [url, config] = changesCalls()[0];
        expect(url).toBe("/changes/?team_id=team-a&project_id=7");
        // Without this a 404 (API not deployed yet) raises a "request failed" toast
        // every tick.
        expect(config).toEqual({ suppressErrorToast: true });
        expect(host.total()).toBe(LOADERS_PER_FULL_REFRESH);
    });

    it("leaves project_id out when no project is open", async () => {
        net.tokens.tasks_project = null;
        const { host } = mountHost(makeHost(), { ...SIGNED_IN, projectId: null });
        await elapse(NOTE_LIST_POLL_MS);

        expect(changesCalls()[0][0]).toBe("/changes/?team_id=team-a");
        // Nothing to load for a project that is not open.
        expect(host.calls("tasks_project")).toBe(0);
        expect(host.total()).toBe(LOADERS_PER_FULL_REFRESH - SIZES.tasks_project);
    });

    it("idle minutes: a full refresh at the start and at the 10-minute backstop, otherwise ONE request", async () => {
        const { host } = mountHost();
        const perMinute: number[] = [];
        for (let minute = 1; minute <= 12; minute++) {
            const before = changesCalls().length + host.total();
            await elapse(NOTE_LIST_POLL_MS);
            perMinute.push(changesCalls().length + host.total() - before);
        }

        // The first tick loads everything once (1 + 10). The backstop fires on the
        // first tick at least 10 minutes after it (minute 11). Every other idle
        // minute is the single /changes/ call.
        expect(perMinute).toEqual([11, 1, 1, 1, 1, 1, 1, 1, 1, 1, 11, 1]);
    });

    it("when /changes/ is unavailable (404) every tick is today's full refresh, plus the failed probe", async () => {
        net.failWith = Object.assign(new Error("404"), { response: { status: 404 } });
        const { host } = mountHost();
        const perMinute: number[] = [];
        for (let minute = 1; minute <= 3; minute++) {
            const before = changesCalls().length + host.total();
            await elapse(NOTE_LIST_POLL_MS);
            perMinute.push(changesCalls().length + host.total() - before);
        }
        expect(perMinute).toEqual([11, 11, 11]);
    });

    it("focus, visibilitychange, the tick and the returned refresh all share one throttled call", async () => {
        const { result } = mountHost();

        await act(async () => {
            window.dispatchEvent(new Event("focus"));
            document.dispatchEvent(new Event("visibilitychange"));
            result.current();
            result.current();
        });
        expect(changesCalls()).toHaveLength(1);

        // Still inside the 30 s throttle window.
        await elapse(NOTE_LIST_POLL_MS / 2 - 1);
        await act(async () => void window.dispatchEvent(new Event("focus")));
        expect(changesCalls()).toHaveLength(1);

        // The 60 s tick lands after it has passed.
        await elapse(NOTE_LIST_POLL_MS);
        expect(changesCalls()).toHaveLength(2);
    });

    it("visibilitychange to hidden does not refresh", async () => {
        mountHost();
        Object.defineProperty(document, "visibilityState", {
            configurable: true,
            value: "hidden",
        });
        await act(async () => void document.dispatchEvent(new Event("visibilitychange")));
        await elapse(NOTE_LIST_POLL_MS * 2);
        expect(changesCalls()).toHaveLength(0);
    });

    it("a changed token runs only that collection's loaders", async () => {
        const { host, result } = mountHost();
        await act(async () => void result.current());
        const before = host.total();

        net.tokens.notes_chat = "moved";
        await elapse(NOTE_LIST_POLL_MS);

        expect(host.total() - before).toBe(SIZES.notes_chat);
        expect(host.calls("notes_chat")).toBe(2);
    });

    it("a team switch clears the tokens: the next trigger refreshes everything on the same tokens", async () => {
        const { host, rerender } = mountHost();
        await elapse(NOTE_LIST_POLL_MS);
        await elapse(NOTE_LIST_POLL_MS);
        expect(host.total()).toBe(LOADERS_PER_FULL_REFRESH);

        rerender({ ...SIGNED_IN, teamId: "team-b" });
        await elapse(NOTE_LIST_POLL_MS);

        expect(changesCalls().at(-1)![0]).toContain("team_id=team-b");
        expect(host.total()).toBe(2 * LOADERS_PER_FULL_REFRESH);
    });

    it("a rotated access token is not a new session", async () => {
        const { host, rerender } = mountHost();
        await elapse(NOTE_LIST_POLL_MS);

        rerender({ ...SIGNED_IN, accessToken: "tok-2" });
        await elapse(NOTE_LIST_POLL_MS);

        expect(host.total()).toBe(LOADERS_PER_FULL_REFRESH);
    });

    it("signing out clears the tokens; signed out, a trigger asks nothing and refreshes in full", async () => {
        const { host, rerender } = mountHost();
        await elapse(NOTE_LIST_POLL_MS);
        const asked = changesCalls().length;

        rerender({ accessToken: null, userId: null, teamId: null, projectId: null });
        await elapse(NOTE_LIST_POLL_MS);
        expect(changesCalls()).toHaveLength(asked);
        // Every loader but the (closed) project's.
        const withoutProject = LOADERS_PER_FULL_REFRESH - SIZES.tasks_project;
        expect(host.total()).toBe(LOADERS_PER_FULL_REFRESH + withoutProject);

        // Signing back in starts over rather than trusting the old tokens.
        rerender(SIGNED_IN);
        await elapse(NOTE_LIST_POLL_MS);
        expect(host.total()).toBe(2 * LOADERS_PER_FULL_REFRESH + withoutProject);
    });

    it("switching project compares against that project's own token", async () => {
        const { host, rerender } = mountHost();
        await elapse(NOTE_LIST_POLL_MS); // project 7, applied

        net.tokens.tasks_project = "p8-token";
        rerender({ ...SIGNED_IN, projectId: 8 });
        await elapse(NOTE_LIST_POLL_MS);
        expect(changesCalls().at(-1)![0]).toContain("project_id=8");
        expect(host.calls("tasks_project")).toBe(2 * SIZES.tasks_project);

        // Back to 7 and its token is what it was: nothing to load.
        net.tokens.tasks_project = fixture.tokens.tasks_project;
        rerender({ ...SIGNED_IN, projectId: 7 });
        await elapse(NOTE_LIST_POLL_MS);
        expect(host.calls("tasks_project")).toBe(2 * SIZES.tasks_project);
    });

    it("a loader that fails is retried on the next trigger", async () => {
        const host = makeHost();
        host.spies.notes_task[0].mockResolvedValueOnce(false);
        mountHost(host);

        await elapse(NOTE_LIST_POLL_MS);
        expect(host.calls("notes_task")).toBe(1);
        // Same token, never applied.
        await elapse(NOTE_LIST_POLL_MS);
        expect(host.calls("notes_task")).toBe(2);
        await elapse(NOTE_LIST_POLL_MS);
        expect(host.calls("notes_task")).toBe(2);
    });

    it("a team switch while /changes/ is in the air drops that run: the old team's loaders never run", async () => {
        const { host, rerender } = mountHost();
        let answer!: (v: unknown) => void;
        net.get.mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)));

        await act(async () => void window.dispatchEvent(new Event("focus")));
        expect(changesCalls()).toHaveLength(1);
        rerender({ ...SIGNED_IN, teamId: "team-b" });
        await act(async () => answer({ data: { tokens: fixture.tokens } }));

        expect(host.total()).toBe(0);
    });

    it("stops listening when unmounted", async () => {
        const { unmount } = mountHost();
        unmount();
        await act(async () => void window.dispatchEvent(new Event("focus")));
        await elapse(NOTE_LIST_POLL_MS * 2);
        expect(changesCalls()).toHaveLength(0);
    });

    describe("two hosts mounted at once (kept-alive Homes)", () => {
        it("each applies its own refresh; one host's success never suppresses the other's loaders", async () => {
            const a = mountHost();
            const b = mountHost();
            await elapse(NOTE_LIST_POLL_MS);
            // Each host did its own full first refresh.
            expect(a.host.total()).toBe(LOADERS_PER_FULL_REFRESH);
            expect(b.host.total()).toBe(LOADERS_PER_FULL_REFRESH);

            net.tokens.notes_task = "moved";
            await elapse(NOTE_LIST_POLL_MS);

            expect(a.host.calls("notes_task")).toBe(2);
            expect(b.host.calls("notes_task")).toBe(2);
            // Nothing else was loaded by either.
            expect(a.host.total()).toBe(LOADERS_PER_FULL_REFRESH + 1);
            expect(b.host.total()).toBe(LOADERS_PER_FULL_REFRESH + 1);
        });

        it("a host that mounts later is not skipped on the strength of the first one's tokens", async () => {
            const a = mountHost();
            await elapse(NOTE_LIST_POLL_MS);
            await elapse(NOTE_LIST_POLL_MS);
            const late = mountHost();
            await elapse(NOTE_LIST_POLL_MS);

            expect(late.host.total()).toBe(LOADERS_PER_FULL_REFRESH);
            expect(a.host.total()).toBe(LOADERS_PER_FULL_REFRESH);
        });

        it("a trigger costs one /changes/ call per host, and unmounting one leaves the other working", async () => {
            const a = mountHost();
            const b = mountHost();
            await act(async () => void window.dispatchEvent(new Event("focus")));
            expect(changesCalls()).toHaveLength(2);

            a.unmount();
            net.tokens.projects = "moved";
            await elapse(NOTE_LIST_POLL_MS);
            expect(b.host.calls("projects")).toBe(2);
            expect(a.host.calls("projects")).toBe(1);
        });
    });
});
