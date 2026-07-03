import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    activityChannel,
    inboxChannel,
    tasksChannel,
    usersChannel,
} from "../../db/workers/channels";
import {
    loadV3SpecificMessages,
    readV3CachedMessages,
} from "../../features/chat/services/loadV3SpecificMessages";
import { channelService } from "../../services/channel/channelService";
import { loadInitialData } from "../../services/loadInitialData";
import { refreshAllData } from "../../services/refreshAllData";
import type { UserProps } from "../../types/admin";

// ---------------------------------------------------------------------------
// Shared mocks
//
// `../../db/workers/channels` is mocked so the real module — which uses
// Vite-only `*.ts?worker` imports that don't resolve under Vitest — is never
// evaluated. Each exported channel becomes a `{ request: vi.fn() }` stub so we
// can assert orchestration (which requests fire, with what payloads).
//
// `../channel/channelService` and `loadV3SpecificMessages` are mocked for the
// `loadInitialData` hook so we can drive the v3 snapshot deterministically.
// ---------------------------------------------------------------------------

// Factories are inlined inside the `vi.mock` factories below because those
// factory functions are hoisted above any top-level declarations.
vi.mock("../../db/workers/channels", () => ({
    inboxChannel: { request: vi.fn() },
    activityChannel: { request: vi.fn() },
    usersChannel: { request: vi.fn() },
    tasksChannel: { request: vi.fn() },
    notesChannel: { request: vi.fn() },
}));

// The mutable snapshot state lives ON the mocked module object so tests can
// reach it via `channelService.__snapshot` without tripping the hoist rule.
vi.mock("../../services/channel/channelService", () => {
    const snapshot = {
        hydrated: false,
        channels: new Map(),
        membersByChannel: new Map(),
        messagesByChannel: new Map(),
        flagByMessageId: new Map(),
    };
    return {
        channelService: {
            __snapshot: snapshot,
            getSnapshot: vi.fn(() => snapshot),
            subscribe: vi.fn(() => () => {}),
            syncChannel: vi.fn().mockResolvedValue(undefined),
        },
    };
});

vi.mock("../../features/chat/services/loadV3SpecificMessages", () => ({
    loadV3SpecificMessages: vi.fn().mockResolvedValue([]),
    // Synchronous snapshot read used by the cache-first boot restore.
    readV3CachedMessages: vi.fn(() => []),
}));

// Typed accessors for the mocked channel `request` fns.
const inboxReq = inboxChannel.request as ReturnType<typeof vi.fn>;
const activityReq = activityChannel.request as ReturnType<typeof vi.fn>;
const usersReq = usersChannel.request as ReturnType<typeof vi.fn>;
const tasksReq = tasksChannel.request as ReturnType<typeof vi.fn>;
const syncChannelMock = channelService.syncChannel as ReturnType<typeof vi.fn>;
const loadV3Mock = loadV3SpecificMessages as ReturnType<typeof vi.fn>;
const readV3Mock = readV3CachedMessages as ReturnType<typeof vi.fn>;
// Live, mutable snapshot object the hook reads through getSnapshot(). We
// mutate its fields in place so the same reference stays wired to the mock.
type BaseSnapshot = {
    hydrated: boolean;
    channels: Map<string, unknown>;
    membersByChannel: Map<string, unknown>;
    messagesByChannel: Map<string, unknown>;
    flagByMessageId: Map<string, unknown>;
};
const snapshotState = (channelService as unknown as { __snapshot: BaseSnapshot }).__snapshot;

const myself: UserProps = {
    teamId: "t1",
    teamName: "Team",
    userId: "u-me",
    userName: "Me",
    userEmail: "me@example.test",
    avatarImgPath: "",
    tsLastSeen: "",
    tsJoined: "",
};

const resetSnapshot = () => {
    snapshotState.hydrated = false;
    snapshotState.channels = new Map();
    snapshotState.membersByChannel = new Map();
    snapshotState.messagesByChannel = new Map();
    snapshotState.flagByMessageId = new Map();
};

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    resetSnapshot();
    // Default: every channel request resolves. teamMembers MUST resolve truthy
    // because loadInitialData's `.then` checks `if (members)` before flagging
    // the section loaded.
    inboxReq.mockResolvedValue(undefined);
    activityReq.mockResolvedValue(undefined);
    usersReq.mockResolvedValue([{ userId: "u-1" }]);
    tasksReq.mockResolvedValue(undefined);
    syncChannelMock.mockResolvedValue(undefined);
    loadV3Mock.mockResolvedValue([]);
    readV3Mock.mockReturnValue([]);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
});

// ===========================================================================
// refreshAllData
// ===========================================================================
describe("refreshAllData", () => {
    const onIDBRefreshed = vi.fn().mockResolvedValue(undefined);

    beforeEach(() => {
        onIDBRefreshed.mockClear().mockResolvedValue(undefined);
    });

    afterEach(() => {
        // Defensive: ensure fake timers never leak into a later test even if
        // an assertion in the timeout test throws before its cleanup runs.
        vi.useRealTimers();
    });

    it("returns early without running any channel request when accessToken is missing", async () => {
        await refreshAllData({
            myself,
            accessToken: null,
            currentProjectId: 5,
            onIDBRefreshed,
        });

        expect(inboxReq).not.toHaveBeenCalled();
        expect(activityReq).not.toHaveBeenCalled();
        expect(usersReq).not.toHaveBeenCalled();
        expect(tasksReq).not.toHaveBeenCalled();
        expect(onIDBRefreshed).not.toHaveBeenCalled();
    });

    it("returns early when myself.userId is empty", async () => {
        await refreshAllData({
            myself: { ...myself, userId: "" },
            accessToken: "tok",
            currentProjectId: 5,
            onIDBRefreshed,
        });

        expect(inboxReq).not.toHaveBeenCalled();
        expect(onIDBRefreshed).not.toHaveBeenCalled();
    });

    it("fires inbox, activity, and team-member loaders and then re-pulls IDB", async () => {
        await refreshAllData({
            myself,
            accessToken: "tok",
            currentProjectId: null,
            onIDBRefreshed,
        });

        expect(inboxReq).toHaveBeenCalledWith("loadInbox", { myself, accessToken: "tok" });
        expect(activityReq).toHaveBeenCalledWith("loadActivityHistory", {
            myself,
            accessToken: "tok",
        });
        expect(usersReq).toHaveBeenCalledWith("loadTeamMembers", { myself, accessToken: "tok" });
        // null project id => no tasks load
        expect(tasksReq).not.toHaveBeenCalled();
        expect(onIDBRefreshed).toHaveBeenCalledTimes(1);
    });

    it("loads project tasks only for a positive project id", async () => {
        await refreshAllData({
            myself,
            accessToken: "tok",
            currentProjectId: 42,
            onIDBRefreshed,
        });

        expect(tasksReq).toHaveBeenCalledWith("loadProjectTasks", {
            myself,
            projectId: 42,
            accessToken: "tok",
        });
    });

    it("skips project tasks for currentProjectId of 0 or a negative value", async () => {
        await refreshAllData({
            myself,
            accessToken: "tok",
            currentProjectId: 0,
            onIDBRefreshed,
        });
        expect(tasksReq).not.toHaveBeenCalled();

        await refreshAllData({
            myself,
            accessToken: "tok",
            currentProjectId: -3,
            onIDBRefreshed,
        });
        expect(tasksReq).not.toHaveBeenCalled();
    });

    it("logs but tolerates a rejected channel call and still re-pulls IDB (allSettled)", async () => {
        inboxReq.mockRejectedValue(new Error("inbox boom"));

        await refreshAllData({
            myself,
            accessToken: "tok",
            currentProjectId: null,
            onIDBRefreshed,
        });

        expect(console.warn).toHaveBeenCalledWith(
            "[refreshAllData] channel call failed",
            expect.any(Error)
        );
        // The other loaders still ran, and the IDB re-pull still fired.
        expect(activityReq).toHaveBeenCalled();
        expect(onIDBRefreshed).toHaveBeenCalledTimes(1);
    });

    it("logs and resolves when onIDBRefreshed throws", async () => {
        onIDBRefreshed.mockRejectedValue(new Error("repull boom"));

        await expect(
            refreshAllData({
                myself,
                accessToken: "tok",
                currentProjectId: null,
                onIDBRefreshed,
            })
        ).resolves.toBeUndefined();

        expect(console.error).toHaveBeenCalledWith(
            "[refreshAllData] onIDBRefreshed threw",
            expect.any(Error)
        );
    });

    it("rejects a request that never settles via the 20s timeout, still re-pulling IDB", async () => {
        vi.useFakeTimers();
        // inbox never settles -> withTimeout should reject it after 20s.
        inboxReq.mockReturnValue(new Promise(() => {}));

        const promise = refreshAllData({
            myself,
            accessToken: "tok",
            currentProjectId: null,
            onIDBRefreshed,
        });

        // Advance past REQUEST_TIMEOUT_MS, flushing microtasks so allSettled and
        // the subsequent onIDBRefreshed actually run.
        await vi.advanceTimersByTimeAsync(20_000);
        await promise;

        expect(console.warn).toHaveBeenCalledWith(
            "[refreshAllData] channel call failed",
            expect.objectContaining({ message: expect.stringContaining("timed out") })
        );
        expect(onIDBRefreshed).toHaveBeenCalledTimes(1);
    });
});

// ===========================================================================
// loadInitialData (React hook)
// ===========================================================================
describe("loadInitialData", () => {
    const render = (
        opts: {
            accessToken?: string | null;
            user?: UserProps;
            firstRefreshDone?: boolean;
        } = {}
    ) => {
        const setIsLoading = vi.fn();
        const setCurrentMainChat = vi.fn();
        const result = renderHook(() =>
            loadInitialData(
                opts.user ?? myself,
                opts.accessToken === undefined ? "tok" : opts.accessToken,
                setIsLoading,
                setCurrentMainChat,
                // Default true (as if App's first background refresh already
                // landed) so the boot gate can close; cold-start tests pass false.
                opts.firstRefreshDone ?? true
            )
        );
        return { setIsLoading, setCurrentMainChat, ...result };
    };

    it("does not fire channel requests when auth is not ready (no token)", () => {
        render({ accessToken: null });
        expect(inboxReq).not.toHaveBeenCalled();
        expect(activityReq).not.toHaveBeenCalled();
        expect(usersReq).not.toHaveBeenCalled();
    });

    it("fires cache reads (pop*) — not the network loaders — on a ready boot", async () => {
        render();
        await waitFor(() => {
            expect(inboxReq).toHaveBeenCalledWith("popInboxItems", {});
        });
        expect(activityReq).toHaveBeenCalledWith("popActivityMessages", { myself });
        expect(usersReq).toHaveBeenCalledWith("popTeamMembers", { myself });
        // The network hydration moved out of the boot gate — App owns it now
        // (refreshAllData). The gate must NOT fire the network loaders itself.
        expect(inboxReq).not.toHaveBeenCalledWith("loadInbox", expect.anything());
        expect(activityReq).not.toHaveBeenCalledWith("loadActivityHistory", expect.anything());
        expect(usersReq).not.toHaveBeenCalledWith("loadTeamMembers", expect.anything());
    });

    it("skips project tasks (and marks them loaded) when no lastProjectId is stored", async () => {
        render();
        await waitFor(() => expect(inboxReq).toHaveBeenCalled());
        expect(tasksReq).not.toHaveBeenCalled();
    });

    it("reads cached project tasks with the numeric lastProjectId from localStorage", async () => {
        localStorage.setItem("lastProjectId", "77");
        render();
        await waitFor(() => {
            expect(tasksReq).toHaveBeenCalledWith("popSpecificProjectTasks", {
                projectId: 77,
                targetStatuses: expect.any(Array),
            });
        });
    });

    it("fails open on a project-tasks rejection: logs the error but still marks tasks loaded", async () => {
        // The catch deliberately calls setIsProjectTasksLoaded(true) so a
        // failed project load doesn't hang the six-flag boot gate forever.
        // We confirm the gate still completes (setIsLoading(false)).
        snapshotState.hydrated = true; // let the rest of the boot gate close too
        localStorage.setItem("lastProjectId", "5");
        tasksReq.mockRejectedValue(new Error("tasks boom"));
        const { setIsLoading } = render();

        await waitFor(() =>
            expect(console.error).toHaveBeenCalledWith(
                "Failed initial project tasks cache read",
                expect.any(Error)
            )
        );
        await waitFor(() => expect(setIsLoading).toHaveBeenCalledWith(false));
    });

    it("sets isLoading(false) once every section is loaded (no last chat, no project)", async () => {
        // hydrated snapshot so the channels-hydrated flag flips true.
        snapshotState.hydrated = true;
        const { setIsLoading } = render();
        await waitFor(() => expect(setIsLoading).toHaveBeenCalledWith(false));
    });

    it("lands on the default chat when lastChatType is unset but channels hydrated", async () => {
        snapshotState.hydrated = true;
        const { setCurrentMainChat, setIsLoading } = render();
        // No saved chat type -> the restore path is skipped entirely. Sync on
        // the boot gate closing (setIsLoading(false)) instead of a log line.
        await waitFor(() => expect(setIsLoading).toHaveBeenCalledWith(false));
        // No chat restore attempted.
        expect(readV3Mock).not.toHaveBeenCalled();
        expect(setCurrentMainChat).not.toHaveBeenCalled();
    });

    it("clears a stale legacy integer chatId and falls back to the default chat", async () => {
        snapshotState.hydrated = true;
        localStorage.setItem("lastChatType", "1");
        localStorage.setItem("lastDMChatId", "3"); // legacy integer, not a UUID
        const { setCurrentMainChat } = render();

        await waitFor(() => expect(setCurrentMainChat).toHaveBeenCalled());
        expect(localStorage.getItem("lastDMChatId")).toBeNull();
        expect(setCurrentMainChat).toHaveBeenCalledWith(
            expect.objectContaining({ chatId: "", chatType: -1 })
        );
        // Restore is short-circuited before any v3 message fetch.
        expect(readV3Mock).not.toHaveBeenCalled();
    });

    it("uses the default chat when a valid chat type has no stored chat id", async () => {
        snapshotState.hydrated = true;
        localStorage.setItem("lastChatType", "1"); // valid type, but no lastDMChatId stored
        const { setCurrentMainChat } = render();

        await waitFor(() =>
            expect(setCurrentMainChat).toHaveBeenCalledWith(
                expect.objectContaining({ chatId: "", chatType: -1 })
            )
        );
        expect(readV3Mock).not.toHaveBeenCalled();
    });

    it("falls back to default chat when the UUID chat is not yet in the v3 store", async () => {
        snapshotState.hydrated = true;
        const uuid = "11111111-1111-1111-1111-111111111111";
        localStorage.setItem("lastChatType", "2");
        localStorage.setItem("lastGMChatId", uuid);
        // snapshot.channels is empty => channel not found branch.
        const { setCurrentMainChat } = render();

        await waitFor(() => expect(setCurrentMainChat).toHaveBeenCalled());
        expect(setCurrentMainChat).toHaveBeenCalledWith(
            expect.objectContaining({ chatId: "", chatType: -1 })
        );
        expect(readV3Mock).not.toHaveBeenCalled();
    });

    it("hydrates the last chat from the v3 snapshot when the UUID channel exists", async () => {
        const uuid = "22222222-2222-2222-2222-222222222222";
        snapshotState.hydrated = true;
        snapshotState.channels = new Map([
            [
                uuid,
                {
                    id: uuid,
                    title: "Design GM",
                    isPrivate: true,
                    profileImageUrl: "http://img/x.png",
                    tsUpdated: "2026-02-02T00:00:00Z",
                },
            ],
        ]);
        snapshotState.membersByChannel = new Map([
            [
                uuid,
                [
                    { userId: "u-me", tsJoined: "j1" },
                    { userId: "u-partner", tsJoined: "j2" },
                ],
            ],
        ]);
        readV3Mock.mockReturnValue([
            { messageId: 99, contentText: "hello", tsSent: "2026-02-02T01:00:00Z" },
        ]);

        localStorage.setItem("lastChatType", "2");
        localStorage.setItem("lastGMChatId", uuid);
        const { setCurrentMainChat } = render();

        // Cache read is synchronous; the network sync fires in the background.
        await waitFor(() => expect(readV3Mock).toHaveBeenCalledWith(uuid, 2));
        expect(syncChannelMock).toHaveBeenCalledWith(uuid);
        await waitFor(() => expect(setCurrentMainChat).toHaveBeenCalled());

        const chat = setCurrentMainChat.mock.calls[0][0];
        expect(chat).toMatchObject({
            chatId: uuid,
            chatName: "Design GM",
            chatType: 2,
            isPrivate: true,
            profileImagePath: "http://img/x.png",
            lastReadMessageId: "99",
            latestMessageText: "hello",
            TSLastMessage: "2026-02-02T01:00:00Z",
        });
        // dmPartner resolves to the OTHER member.
        expect(chat.dmPartnerUser.userId).toBe("u-partner");
        expect(chat.dmPartnerUser.tsJoined).toBe("j2");
        expect(chat.messages).toHaveLength(1);
    });

    it("falls back to default chat when the cached-message read throws during restore", async () => {
        const uuid = "33333333-3333-3333-3333-333333333333";
        snapshotState.hydrated = true;
        snapshotState.channels = new Map([[uuid, { id: uuid, title: "X", isPrivate: false }]]);
        readV3Mock.mockImplementation(() => {
            throw new Error("cache boom");
        });

        localStorage.setItem("lastChatType", "3");
        localStorage.setItem("lastPMChatId", uuid);
        const { setCurrentMainChat } = render();

        await waitFor(() =>
            expect(console.error).toHaveBeenCalledWith(
                "Failed initial chat hydrate",
                expect.any(Error)
            )
        );
        expect(setCurrentMainChat).toHaveBeenCalledWith(
            expect.objectContaining({ chatId: "", chatType: -1 })
        );
    });

    it("still reveals the shell when the team-member cache read is empty", async () => {
        snapshotState.hydrated = true;
        usersReq.mockResolvedValue([]);
        const { setIsLoading } = render();
        await waitFor(() => expect(setIsLoading).toHaveBeenCalledWith(false));
    });

    it("logs and fails open when the inbox cache read rejects", async () => {
        inboxReq.mockRejectedValue(new Error("inbox fail"));
        render();
        await waitFor(() =>
            expect(console.error).toHaveBeenCalledWith(
                "Failed initial inbox cache read",
                expect.any(Error)
            )
        );
    });

    // --- cache-first gate: cold vs warm --------------------------------------

    it("holds the shell on a cold cache until the first refresh completes", async () => {
        snapshotState.hydrated = true;
        // No hydrated marker (cold) + firstRefreshDone=false → gate stays open.
        const { setIsLoading } = render({ firstRefreshDone: false });
        await waitFor(() => expect(inboxReq).toHaveBeenCalled());
        expect(setIsLoading).not.toHaveBeenCalledWith(false);
    });

    it("reveals a warm cache immediately, without waiting for a refresh", async () => {
        snapshotState.hydrated = true;
        // Hydrated marker matches the team → warm → reveal even if the first
        // refresh hasn't landed yet.
        localStorage.setItem("genos.hydrated.v1", myself.teamId);
        const { setIsLoading } = render({ firstRefreshDone: false });
        await waitFor(() => expect(setIsLoading).toHaveBeenCalledWith(false));
    });
});

// ===========================================================================
// analytics
//
// Module-level `initialized` / `userEnabled` state means each test re-imports
// the module under a fresh module registry (vi.resetModules) and grabs BOTH
// `posthog` and `analytics` from the SAME reset cycle, so assertions target the
// live mock instances. env is stubbed per-test.
// ===========================================================================
describe("analytics", () => {
    const PREF_KEY = "genos-analytics-preferences:v1";

    const loadAnalytics = async () => {
        vi.resetModules();
        const posthog = (await import("posthog-js")).default;
        const mod = await import("../../services/analytics");
        return { posthog, analytics: mod.analytics };
    };

    beforeEach(() => {
        vi.doMock("posthog-js", () => ({
            default: {
                init: vi.fn(),
                capture: vi.fn(),
                identify: vi.fn(),
                reset: vi.fn(),
                opt_in_capturing: vi.fn(),
                opt_out_capturing: vi.fn(),
            },
        }));
        localStorage.clear();
    });

    afterEach(() => {
        vi.doUnmock("posthog-js");
        vi.unstubAllEnvs();
    });

    it("init no-ops when the posthog key/host env is missing", async () => {
        vi.stubEnv("VITE_POSTHOG_KEY", "");
        vi.stubEnv("VITE_POSTHOG_HOST", "");
        const { posthog, analytics } = await loadAnalytics();

        analytics.init();
        expect(posthog.init).not.toHaveBeenCalled();
    });

    it("init configures posthog with env key/host and opt-out from stored preference", async () => {
        vi.stubEnv("VITE_POSTHOG_KEY", "phc_key");
        vi.stubEnv("VITE_POSTHOG_HOST", "https://ph.example");
        const { posthog, analytics } = await loadAnalytics();

        analytics.init();

        expect(posthog.init).toHaveBeenCalledTimes(1);
        expect(posthog.init).toHaveBeenCalledWith(
            "phc_key",
            expect.objectContaining({
                api_host: "https://ph.example",
                autocapture: false,
                capture_pageview: false,
                disable_session_recording: true,
                opt_out_capturing_by_default: false,
                persistence: "localStorage+cookie",
            })
        );
    });

    it("init reads the opt-out preference from localStorage (enabled:false => opt_out default true)", async () => {
        localStorage.setItem(PREF_KEY, JSON.stringify({ enabled: false }));
        vi.stubEnv("VITE_POSTHOG_KEY", "phc_key");
        vi.stubEnv("VITE_POSTHOG_HOST", "https://ph.example");
        const { posthog, analytics } = await loadAnalytics();

        analytics.init();

        expect(posthog.init).toHaveBeenCalledWith(
            "phc_key",
            expect.objectContaining({ opt_out_capturing_by_default: true })
        );
    });

    it("init treats a malformed preferences JSON as enabled (opt_out default false)", async () => {
        localStorage.setItem(PREF_KEY, "{not json");
        vi.stubEnv("VITE_POSTHOG_KEY", "phc_key");
        vi.stubEnv("VITE_POSTHOG_HOST", "https://ph.example");
        const { posthog, analytics } = await loadAnalytics();

        analytics.init();

        expect(posthog.init).toHaveBeenCalledWith(
            "phc_key",
            expect.objectContaining({ opt_out_capturing_by_default: false })
        );
    });

    it("init is idempotent (second call no-ops)", async () => {
        vi.stubEnv("VITE_POSTHOG_KEY", "phc_key");
        vi.stubEnv("VITE_POSTHOG_HOST", "https://ph.example");
        const { posthog, analytics } = await loadAnalytics();

        analytics.init();
        analytics.init();
        expect(posthog.init).toHaveBeenCalledTimes(1);
    });

    it("capture no-ops when not initialized", async () => {
        const { posthog, analytics } = await loadAnalytics();
        analytics.capture("$pageview", { path: "/" });
        expect(posthog.capture).not.toHaveBeenCalled();
    });

    it("capture forwards event + properties once initialized and enabled", async () => {
        vi.stubEnv("VITE_POSTHOG_KEY", "phc_key");
        vi.stubEnv("VITE_POSTHOG_HOST", "https://ph.example");
        const { posthog, analytics } = await loadAnalytics();

        analytics.init();
        analytics.capture("$pageview", { path: "/home" });
        expect(posthog.capture).toHaveBeenCalledWith("$pageview", { path: "/home" });
    });

    it("capture no-ops when the user has opted out after init", async () => {
        localStorage.setItem(PREF_KEY, JSON.stringify({ enabled: false }));
        vi.stubEnv("VITE_POSTHOG_KEY", "phc_key");
        vi.stubEnv("VITE_POSTHOG_HOST", "https://ph.example");
        const { posthog, analytics } = await loadAnalytics();

        analytics.init(); // userEnabled becomes false from storage
        analytics.capture("$pageview");
        expect(posthog.capture).not.toHaveBeenCalled();
    });

    it("identify no-ops when not initialized", async () => {
        const { posthog, analytics } = await loadAnalytics();
        analytics.identify("user-1", { teamId: "t1" });
        expect(posthog.identify).not.toHaveBeenCalled();
    });

    it("identify no-ops on an empty distinctId even when initialized", async () => {
        vi.stubEnv("VITE_POSTHOG_KEY", "phc_key");
        vi.stubEnv("VITE_POSTHOG_HOST", "https://ph.example");
        const { posthog, analytics } = await loadAnalytics();

        analytics.init();
        analytics.identify("");
        expect(posthog.identify).not.toHaveBeenCalled();
    });

    it("identify forwards id + traits once initialized", async () => {
        vi.stubEnv("VITE_POSTHOG_KEY", "phc_key");
        vi.stubEnv("VITE_POSTHOG_HOST", "https://ph.example");
        const { posthog, analytics } = await loadAnalytics();

        analytics.init();
        analytics.identify("user-1", { teamId: "t1", role: "admin" });
        expect(posthog.identify).toHaveBeenCalledWith("user-1", { teamId: "t1", role: "admin" });
    });

    it("reset no-ops when not initialized", async () => {
        const { posthog, analytics } = await loadAnalytics();
        analytics.reset();
        expect(posthog.reset).not.toHaveBeenCalled();
    });

    it("reset forwards to posthog once initialized", async () => {
        vi.stubEnv("VITE_POSTHOG_KEY", "phc_key");
        vi.stubEnv("VITE_POSTHOG_HOST", "https://ph.example");
        const { posthog, analytics } = await loadAnalytics();

        analytics.init();
        analytics.reset();
        expect(posthog.reset).toHaveBeenCalledTimes(1);
    });

    it("setEnabled(true) opts in when initialized", async () => {
        vi.stubEnv("VITE_POSTHOG_KEY", "phc_key");
        vi.stubEnv("VITE_POSTHOG_HOST", "https://ph.example");
        const { posthog, analytics } = await loadAnalytics();

        analytics.init();
        analytics.setEnabled(true);
        expect(posthog.opt_in_capturing).toHaveBeenCalledTimes(1);
        expect(posthog.opt_out_capturing).not.toHaveBeenCalled();
    });

    it("setEnabled(false) opts out and resets when initialized", async () => {
        vi.stubEnv("VITE_POSTHOG_KEY", "phc_key");
        vi.stubEnv("VITE_POSTHOG_HOST", "https://ph.example");
        const { posthog, analytics } = await loadAnalytics();

        analytics.init();
        analytics.setEnabled(false);
        expect(posthog.opt_out_capturing).toHaveBeenCalledTimes(1);
        expect(posthog.reset).toHaveBeenCalledTimes(1);
        expect(posthog.opt_in_capturing).not.toHaveBeenCalled();
    });

    it("setEnabled before init does not touch posthog opt in/out", async () => {
        vi.stubEnv("VITE_POSTHOG_KEY", "phc_key");
        vi.stubEnv("VITE_POSTHOG_HOST", "https://ph.example");
        const { posthog, analytics } = await loadAnalytics();

        // Not initialized yet: setEnabled only flips the in-module flag.
        analytics.setEnabled(false);
        expect(posthog.opt_out_capturing).not.toHaveBeenCalled();
        expect(posthog.opt_in_capturing).not.toHaveBeenCalled();
        expect(posthog.reset).not.toHaveBeenCalled();
    });

    it("init re-reads the storage preference, clobbering a pre-init setEnabled(false)", async () => {
        // No stored preference => storage read yields enabled:true. A
        // setEnabled(false) before init is overwritten by init's storage read,
        // so capture is NOT gated afterward. This documents the actual
        // (slightly surprising) precedence.
        vi.stubEnv("VITE_POSTHOG_KEY", "phc_key");
        vi.stubEnv("VITE_POSTHOG_HOST", "https://ph.example");
        const { posthog, analytics } = await loadAnalytics();

        analytics.setEnabled(false);
        analytics.init();
        analytics.capture("$pageview");
        expect(posthog.capture).toHaveBeenCalledTimes(1);
    });
});
