/**
 * MIP-1323: the sync state grows per-project task scopes and the on-demand reads.
 *
 *  - `tasks:<projectId>`: one project's failure is not cleared by another project's success, and
 *    another project's failure does not mark this one. A project that stops existing for the
 *    user (404 / 403, or gone from the project list, or deleted) is forgotten instead of failing
 *    forever.
 *  - The first read of a project reads as "loading" until it has answered (it outlasts the 8 s
 *    `isLoadingTasks` safety timeout), and a request that never answers becomes a failure.
 *  - `notes:<list>` and `flags`: the notes sidebar's empty branches and the past-flags list say
 *    "couldn't load" when their read failed.
 *  - A consumer re-renders only when ITS answer changes (the store is written on every load).
 *
 * These fail at the REQUEST (the worker channel rejects, axios `get` rejects) where the code has one.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { tasksChannel } from "../db/workers/channels";
import { SyncAwareEmpty } from "../features/chat/components/sidebar/ChatList";
import { NoteListState } from "../features/notes/common/components/NoteListState";
import { JoinProjectListItem } from "../features/tasks/components/sidebar/projects_subs/JoinProjectListItem";
import { loadProjectTasks } from "../features/tasks/services/loadProjectTasks";
import { en } from "../i18n/locales/en";
import { channelService } from "../services/channel/channelService";
import {
    syncStatus,
    tasksScope,
    useSyncBanner,
    useSyncFailure,
    useTasksSyncFailure,
} from "../services/syncStatus";
import type { UserProps } from "../types/admin";

vi.mock("../db/workers/channels", () => ({
    tasksChannel: { request: vi.fn() },
    notesChannel: { request: vi.fn() },
}));
vi.mock("../db/config/schema", () => ({
    initDB: vi.fn().mockRejectedValue(new Error("IDB stubbed off in tests")),
}));

const tasksReq = tasksChannel.request as ReturnType<typeof vi.fn>;
const myself = { teamId: "t1", userId: "u-me" } as UserProps;
const s = en.common.feedback.sync;
const wrap = (ui: React.ReactNode) => <CssVarsProvider>{ui}</CssVarsProvider>;

beforeEach(() => {
    syncStatus.__reset();
    tasksReq.mockReset().mockResolvedValue(undefined);
    vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe("per-project tasks scope", () => {
    it("a success for another project does not clear this project's failure, and a failure of another does not mark it", async () => {
        tasksReq.mockRejectedValueOnce(new Error("Network Error"));
        await expect(loadProjectTasks(myself, 5, "tok")).rejects.toThrow();
        await loadProjectTasks(myself, 6, "tok");
        expect(syncStatus.getSnapshot().failed).toEqual(["tasks:5"]);

        const open5 = renderHook(() => useTasksSyncFailure(5));
        const open6 = renderHook(() => useTasksSyncFailure(6));
        expect(open5.result.current.failed).toBe(true);
        expect(open6.result.current.failed).toBe(false);

        tasksReq.mockRejectedValueOnce(new Error("Network Error"));
        await expect(loadProjectTasks(myself, 7, "tok")).rejects.toThrow();
        expect(open6.result.current.failed).toBe(false);
        expect(syncStatus.failedProjectIds().sort()).toEqual([5, 7]);

        await loadProjectTasks(myself, 5, "tok");
        expect(open5.result.current.failed).toBe(false);
        expect(syncStatus.getSnapshot().failed).toEqual(["tasks:7"]);
    });

    it("a project that is gone for the user (HTTP 404) is forgotten, not failed forever", async () => {
        tasksReq.mockRejectedValueOnce(new Error("Failed to load project tasks (HTTP 404)"));
        await expect(loadProjectTasks(myself, 9, "tok")).rejects.toThrow("HTTP 404");
        expect(syncStatus.getSnapshot().failed).toEqual([]);

        // A 403 is an auth problem that can heal (a gateway, an expired session): a failure, with Retry.
        tasksReq.mockRejectedValueOnce(new Error("Failed to load project tasks (HTTP 403)"));
        await expect(loadProjectTasks(myself, 10, "tok")).rejects.toThrow("HTTP 403");
        expect(syncStatus.getSnapshot().failed).toEqual(["tasks:10"]);
        syncStatus.forget(tasksScope(10));

        // A server error is a real failure (the project may well exist).
        tasksReq.mockRejectedValueOnce(new Error("Failed to load project tasks (HTTP 500)"));
        await expect(loadProjectTasks(myself, 11, "tok")).rejects.toThrow("HTTP 500");
        expect(syncStatus.getSnapshot().failed).toEqual(["tasks:11"]);
    });

    it("the project list dropping a project (or the agent deleting it) drops its failure and in-flight mark", () => {
        syncStatus.report(tasksScope(1), false);
        syncStatus.report(tasksScope(2), false);
        syncStatus.report("inbox", false);
        syncStatus.retainProjects([2, 3]);
        expect(syncStatus.getSnapshot().failed).toEqual(["tasks:2", "inbox"]);
        // Only task scopes are pruned.
        expect(syncStatus.failedProjectIds()).toEqual([2]);

        syncStatus.forget(tasksScope(2));
        expect(syncStatus.getSnapshot().failed).toEqual(["inbox"]);
    });

    it("the banner and the hydration marker see task failures; the on-demand notes and flags reads do neither", () => {
        const banner = renderHook(() => useSyncBanner());
        act(() => {
            syncStatus.report("notes:favorites", false);
            syncStatus.report("flags", false);
        });
        expect(syncStatus.getSnapshot().failed.length).toBe(2);
        expect(syncStatus.bootFailed()).toBe(false);
        expect(banner.result.current.failed).toBe(false);
        act(() => syncStatus.report(tasksScope(4), false));
        expect(syncStatus.bootFailed()).toBe(true);
        expect(banner.result.current.failed).toBe(true);
        expect(banner.result.current.episode).toBe(1);
    });

    it("the project list only drops FAILURES of missing projects: a load in flight for a project the list has not seen yet stays", () => {
        syncStatus.track(tasksScope(8), new Promise(() => {}));
        syncStatus.retainProjects([1]);
        expect(syncStatus.getSnapshot().inFlight).toEqual(["tasks:8"]);
    });
});

describe("first read in flight", () => {
    it("is 'loading' until the project has answered once, then a refresh does not bring the skeleton back", async () => {
        let answer!: () => void;
        tasksReq.mockReturnValueOnce(new Promise<void>((r) => (answer = r)));
        const hook = renderHook(() => useTasksSyncFailure(5));
        const read = loadProjectTasks(myself, 5, "tok");
        await waitFor(() => expect(hook.result.current.loading).toBe(true));
        expect(hook.result.current.failed).toBe(false);

        await act(async () => {
            answer();
            await read;
        });
        expect(hook.result.current.loading).toBe(false);

        // A background refresh of a project that has answered: quiet.
        let again!: () => void;
        tasksReq.mockReturnValueOnce(new Promise<void>((r) => (again = r)));
        const refresh = loadProjectTasks(myself, 5, "tok");
        expect(syncStatus.getSnapshot().inFlight).toEqual(["tasks:5"]);
        expect(hook.result.current.loading).toBe(false);
        await act(async () => {
            again();
            await refresh;
        });
    });

    it("a request that never answers becomes a failure with Retry instead of a skeleton forever", async () => {
        vi.useFakeTimers();
        tasksReq.mockReturnValueOnce(new Promise(() => {}));
        void loadProjectTasks(myself, 5, "tok");
        expect(syncStatus.getSnapshot().inFlight).toEqual(["tasks:5"]);
        await act(async () => {
            await vi.advanceTimersByTimeAsync(20_001);
        });
        expect(syncStatus.getSnapshot().inFlight).toEqual([]);
        expect(syncStatus.getSnapshot().failed).toEqual(["tasks:5"]);
    });

    it("a team switch (reset) or a forgotten project drops the ceiling timer: a late timeout cannot re-mark it failed", async () => {
        vi.useFakeTimers();
        syncStatus.track(tasksScope(5), new Promise(() => {}));
        syncStatus.track(tasksScope(6), new Promise(() => {}));
        syncStatus.reset();
        syncStatus.forget(tasksScope(6));
        await act(async () => {
            await vi.advanceTimersByTimeAsync(30_000);
        });
        expect(syncStatus.getSnapshot().failed).toEqual([]);
    });

    it("overlapping loads of one scope: the first to settle does not clear the other's in-flight mark", async () => {
        let first!: () => void;
        syncStatus.track("notes:favorites", new Promise<void>((r) => (first = r)));
        syncStatus.track("notes:favorites", new Promise(() => {}));
        await act(async () => {
            first();
            await Promise.resolve();
        });
        expect(syncStatus.getSnapshot().inFlight).toEqual(["notes:favorites"]);
    });

    it("a retry that is running reads as retrying for a failed scope (the skeleton, not the stale error)", () => {
        syncStatus.report(tasksScope(5), false);
        const hook = renderHook(() => useTasksSyncFailure(5));
        expect(hook.result.current.retrying).toBe(false);
        act(() => syncStatus.begin());
        expect(hook.result.current.retrying).toBe(true);
        act(() => syncStatus.end());
        expect(hook.result.current.retrying).toBe(false);
    });
});

describe("consumers re-render only for their own answer", () => {
    it("a load starting and ending for another project does not re-render this project's consumer or the banner", async () => {
        let renders = 0;
        let bannerRenders = 0;
        renderHook(() => {
            renders += 1;
            return useSyncFailure(tasksScope(5));
        });
        renderHook(() => {
            bannerRenders += 1;
            return useSyncBanner();
        });
        const before = renders;
        const bannerBefore = bannerRenders;
        await act(async () => {
            await loadProjectTasks(myself, 6, "tok");
        });
        expect(renders).toBe(before);
        expect(bannerRenders).toBe(bannerBefore);
    });
});

describe("notes sidebar lists", () => {
    const state = (hasAny: boolean, body?: string) =>
        render(
            wrap(
                <NoteListState
                    body={body}
                    emptyMarker="note-favorites"
                    hasAny={hasAny}
                    scope="favorites"
                />
            )
        );

    it("empty + failed read -> 'couldn't load' with Retry (not 'No favorites yet'); Retry re-runs the sync", () => {
        const rerun = vi.fn();
        syncStatus.setRetry(rerun);
        const { unmount } = state(false, "No favorites yet");
        expect(screen.getByText("No favorites yet")).toBeInTheDocument();
        unmount();

        // Another list failing says nothing about this one.
        act(() => syncStatus.report("notes:recents", false));
        const second = state(false, "No favorites yet");
        expect(screen.getByText("No favorites yet")).toBeInTheDocument();
        second.unmount();

        act(() => syncStatus.report("notes:favorites", false));
        state(false, "No favorites yet");
        expect(screen.queryByText("No favorites yet")).toBeNull();
        expect(screen.getByRole("alert")).toHaveTextContent(s.notesFailed);
        fireEvent.click(screen.getByRole("button", { name: en.common.actions.retry }));
        expect(rerun).toHaveBeenCalledTimes(1);
    });

    it("a list that has rows never shows the error; a not-yet-read list without an empty text draws nothing", () => {
        act(() => syncStatus.report("notes:favorites", false));
        const { unmount } = state(true, "No favorites yet");
        expect(screen.queryByRole("alert")).toBeNull();
        unmount();

        act(() => syncStatus.report("notes:favorites", true));
        const quiet = state(false);
        expect(quiet.container.querySelector("[data-empty]")).toBeNull();
        expect(screen.queryByRole("alert")).toBeNull();
    });
});

describe("past flags", () => {
    const past = () =>
        render(
            wrap(
                <SyncAwareEmpty hasAny={false} scope="flags">
                    <div>No completed flags</div>
                </SyncAwareEmpty>
            )
        );

    it("empty + failed read -> 'couldn't load', not 'No completed flags'", () => {
        const { unmount } = past();
        expect(screen.getByText("No completed flags")).toBeInTheDocument();
        unmount();
        act(() => syncStatus.report("flags", false));
        past();
        expect(screen.queryByText("No completed flags")).toBeNull();
        expect(screen.getByRole("alert")).toHaveTextContent(s.flagsFailed);
    });

    it("fetchCompletedFlags reports its own request: failed -> flagged, later good -> clear", async () => {
        const apiGet = vi.fn().mockRejectedValueOnce(new Error("Network Error"));
        vi.spyOn(channelService as unknown as { api: () => unknown }, "api").mockReturnValue({
            get: apiGet,
        });
        channelService.setAccessToken("tok");
        try {
            await channelService.fetchCompletedFlags();
            expect(syncStatus.getSnapshot().failed).toEqual(["flags"]);

            apiGet.mockResolvedValueOnce({ data: { flags: [] } });
            await channelService.fetchCompletedFlags();
            expect(syncStatus.getSnapshot().failed).toEqual([]);
        } finally {
            channelService.setAccessToken(null);
        }
    });

    it("no token, no read and no report", async () => {
        channelService.setAccessToken(null);
        await channelService.fetchCompletedFlags();
        expect(syncStatus.getSnapshot().failed).toEqual([]);
    });
});

describe("Join Project list", () => {
    const join = (teamProjects: unknown[]) =>
        render(
            wrap(
                <JoinProjectListItem
                    setOpenJoinProject={vi.fn()}
                    usePM={{ teamProjects, currentProject: null } as never}
                />
            )
        );

    it("does not say 'No projects available' for a project list that never loaded; says it for a list that did", async () => {
        const { unmount } = join([]);
        fireEvent.click(screen.getByText(en.tasks.sidebar.joinProject));
        expect(await screen.findByText(en.tasks.sidebar.noProjectsAvailable)).toBeInTheDocument();
        unmount();

        act(() => syncStatus.report("projects", false));
        join([]);
        fireEvent.click(screen.getByText(en.tasks.sidebar.joinProject));
        expect(screen.queryByText(en.tasks.sidebar.noProjectsAvailable)).toBeNull();
    });
});
