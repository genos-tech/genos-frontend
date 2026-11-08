/**
 * MIP-1298: a failed background sync is never drawn as an empty workspace.
 *
 * The chat list, inbox and task table read IndexedDB and are refilled once by
 * `refreshAllData`, which used to swallow a failure; a cold cache plus a failed
 * first refresh opened a shell saying "No chats yet / No tasks". These cases
 * fail at the REQUEST (the worker channel rejects) and read what the user would
 * see: the store, the banner, `refreshAllData`, and the empty surfaces.
 * Mutation-checked: dropping `syncStatus.report` in `refreshAllData`, or the
 * `error` prop on a surface, turns the matching case red.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CssVarsProvider } from "@mui/joy/styles";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SyncStatusBanner } from "../components/layout/SyncStatusBanner";
import { __resetToasts } from "../components/ui/feedback/toastStore";
import { activityChannel, inboxChannel, tasksChannel, usersChannel } from "../db/workers/channels";
import { SyncAwareEmpty } from "../features/chat/components/sidebar/ChatList";
import { InboxSection } from "../features/inbox/components/InboxSection";
import { MobileTaskList } from "../features/tasks/MobileTaskList";
import { loadProjectTasks } from "../features/tasks/services/loadProjectTasks";
import { en } from "../i18n/locales/en";
import { refreshAllData } from "../services/refreshAllData";
import { syncStatus } from "../services/syncStatus";
import type { UserProps } from "../types/admin";

vi.mock("../db/workers/channels", () => ({
    inboxChannel: { request: vi.fn() },
    activityChannel: { request: vi.fn() },
    usersChannel: { request: vi.fn() },
    tasksChannel: { request: vi.fn() },
    notesChannel: { request: vi.fn() },
}));
vi.mock("../services/channel/channelService", () => ({
    channelService: { refreshChannels: vi.fn().mockResolvedValue(undefined) },
}));

const inboxReq = inboxChannel.request as ReturnType<typeof vi.fn>;
const activityReq = activityChannel.request as ReturnType<typeof vi.fn>;
const usersReq = usersChannel.request as ReturnType<typeof vi.fn>;
const tasksReq = tasksChannel.request as ReturnType<typeof vi.fn>;

const myself = {
    teamId: "t1",
    userId: "u-me",
    userName: "Me",
    userEmail: "me@example.test",
} as UserProps;

const run = (onIDBRefreshed = vi.fn()) =>
    refreshAllData({ myself, accessToken: "tok", currentProjectId: 5, onIDBRefreshed });

const wrap = (ui: React.ReactNode) => (
    <CssVarsProvider>
        <MemoryRouter>{ui}</MemoryRouter>
    </CssVarsProvider>
);
const retry = () => screen.getByRole("button", { name: en.common.actions.retry });
const s = en.common.feedback.sync;

beforeEach(() => {
    syncStatus.__reset();
    __resetToasts();
    for (const m of [inboxReq, activityReq, usersReq, tasksReq]) {
        m.mockReset().mockResolvedValue(undefined);
    }
    vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("syncStatus store", () => {
    it("records failures per scope and recovers them one by one", () => {
        syncStatus.report("inbox", false);
        syncStatus.report("tasks", false);
        syncStatus.report("tasks", false);
        expect(syncStatus.getSnapshot().failed).toEqual(["inbox", "tasks"]);
        syncStatus.report("inbox", true);
        expect(syncStatus.getSnapshot().failed).toEqual(["tasks"]);
        syncStatus.report("tasks", true);
        expect(syncStatus.getSnapshot().failed).toEqual([]);
    });

    it("starts a new episode only when failures begin again from none", () => {
        syncStatus.report("inbox", false);
        syncStatus.report("tasks", false);
        expect(syncStatus.getSnapshot().episode).toBe(1);
        syncStatus.report("inbox", true);
        syncStatus.report("tasks", true);
        syncStatus.report("inbox", false);
        expect(syncStatus.getSnapshot().episode).toBe(2);
    });

    it("keeps `syncing` until the last overlapping run ends", () => {
        syncStatus.begin();
        syncStatus.begin();
        syncStatus.end();
        expect(syncStatus.getSnapshot().syncing).toBe(true);
        syncStatus.end();
        expect(syncStatus.getSnapshot().syncing).toBe(false);
    });
});

describe("refreshAllData feeds the store", () => {
    it("names the loaders that failed, still re-pulls IDB, and clears them on a good run", async () => {
        inboxReq.mockRejectedValueOnce(new Error("Network Error"));
        tasksReq.mockRejectedValueOnce(new Error("Network Error"));
        const onIDBRefreshed = vi.fn();

        await run(onIDBRefreshed);
        expect([...syncStatus.getSnapshot().failed].sort()).toEqual(["inbox", "tasks"]);
        expect(syncStatus.getSnapshot().syncing).toBe(false);
        // The cached rows are still pushed into React state.
        expect(onIDBRefreshed).toHaveBeenCalledTimes(1);

        await run();
        expect(syncStatus.getSnapshot().failed).toEqual([]);
    });

    it("loadProjectTasks, the one door for every project-task load, reports its own failure and rethrows", async () => {
        tasksReq.mockRejectedValueOnce(new Error("Network Error"));
        await expect(loadProjectTasks(myself, 5, "tok")).rejects.toThrow("Network Error");
        expect(syncStatus.getSnapshot().failed).toEqual(["tasks"]);
        await loadProjectTasks(myself, 5, "tok");
        expect(syncStatus.getSnapshot().failed).toEqual([]);
    });

    it("does not touch the store when auth is not ready", async () => {
        await refreshAllData({
            myself,
            accessToken: null,
            currentProjectId: 5,
            onIDBRefreshed: vi.fn(),
        });
        expect(syncStatus.getSnapshot()).toMatchObject({ failed: [], syncing: false, episode: 0 });
    });
});

describe("SyncStatusBanner", () => {
    it("is absent while all is well and shows once with Retry after a failure", async () => {
        render(wrap(<SyncStatusBanner />));
        expect(screen.queryByText(s.banner)).toBeNull();

        inboxReq.mockRejectedValueOnce(new Error("Network Error"));
        const retrySync = vi.fn(async () => {
            await run();
        });
        syncStatus.setRetry(retrySync);
        await act(async () => {
            await run();
        });
        expect(screen.getAllByText(s.banner)).toHaveLength(1);

        // Retry re-runs the sync; its success removes the banner.
        await act(async () => {
            fireEvent.click(retry());
        });
        expect(retrySync).toHaveBeenCalledTimes(1);
        expect(screen.queryByText(s.banner)).toBeNull();
    });

    it("a closed banner stays closed for that outage and returns for the next", async () => {
        render(wrap(<SyncStatusBanner />));
        act(() => syncStatus.report("inbox", false));
        fireEvent.click(screen.getByRole("button", { name: en.common.actions.close }));
        expect(screen.queryByText(s.banner)).toBeNull();

        act(() => syncStatus.report("tasks", false)); // same outage
        expect(screen.queryByText(s.banner)).toBeNull();

        act(() => {
            syncStatus.report("inbox", true);
            syncStatus.report("tasks", true);
            syncStatus.report("inbox", false); // next outage
        });
        expect(screen.getByText(s.banner)).toBeInTheDocument();
    });

    it("steps aside while the API-unreachable banner is up", () => {
        const { rerender } = render(wrap(<SyncStatusBanner hidden />));
        act(() => syncStatus.report("inbox", false));
        expect(screen.queryByText(s.banner)).toBeNull();
        rerender(wrap(<SyncStatusBanner hidden={false} />));
        expect(screen.getByText(s.banner)).toBeInTheDocument();
    });

    it("says it is syncing while a retry is in flight", () => {
        render(wrap(<SyncStatusBanner />));
        act(() => {
            syncStatus.report("inbox", false);
            syncStatus.begin();
        });
        expect(screen.getByText(s.bannerRetrying)).toBeInTheDocument();
        expect(screen.queryByText(s.banner)).toBeNull();
    });
});

describe("empty surfaces tell 'nothing here' from 'could not load'", () => {
    const inbox = (items: unknown[] = []) =>
        wrap(
            <InboxSection
                itemKeyPrefix="a"
                items={items as never}
                myself={myself}
                setMyself={() => {}}
                socket={null}
                useCM={{} as never}
                useTEM={{} as never}
                useUISM={{} as never}
                onItemChanged={() => {}}
            />
        );

    it("inbox: empty and the sync is fine -> the empty state", () => {
        render(inbox());
        expect(document.querySelector('[data-empty="inbox"]')).not.toBeNull();
        expect(document.querySelector('[data-error="inbox"]')).toBeNull();
    });

    it("inbox: empty and the inbox sync failed -> ErrorState, Retry re-runs the sync, then skeleton", () => {
        const retrySync = vi.fn();
        syncStatus.setRetry(retrySync);
        syncStatus.report("inbox", false);
        render(inbox());
        expect(document.querySelector('[data-empty="inbox"]')).toBeNull();
        expect(screen.getByRole("alert")).toHaveTextContent(s.inboxFailed);
        fireEvent.click(retry());
        expect(retrySync).toHaveBeenCalledTimes(1);

        // While the retry runs: the skeleton, not a stale error and not "empty".
        act(() => syncStatus.begin());
        expect(document.querySelector('[data-error="inbox"]')).toBeNull();
        expect(document.querySelector('[data-skeleton="rows"]')).not.toBeNull();
    });

    it("inbox: a failure of ANOTHER scope does not turn the empty state into an error", () => {
        syncStatus.report("tasks", false);
        render(inbox());
        expect(document.querySelector('[data-empty="inbox"]')).not.toBeNull();
    });

    it("chat sidebar: no chats at all + channel sync failed -> 'couldn't load'; a filter that emptied the list stays an empty state", () => {
        const empty = (hasAny: boolean) =>
            wrap(
                <SyncAwareEmpty hasAny={hasAny} scope="channels">
                    <div data-empty="chat-list">No direct messages</div>
                </SyncAwareEmpty>
            );
        syncStatus.report("channels", false);
        const { unmount } = render(empty(false));
        expect(screen.getByRole("alert")).toHaveTextContent(s.chatsFailed);
        expect(screen.queryByText("No direct messages")).toBeNull();
        unmount();

        render(empty(true));
        expect(screen.getByText("No direct messages")).toBeInTheDocument();
        expect(screen.queryByRole("alert")).toBeNull();
    });

    it("chat sidebar: the activity list names its own scope", () => {
        syncStatus.report("channels", false);
        render(
            wrap(
                <SyncAwareEmpty hasAny={false} scope="activity">
                    <div>No activity</div>
                </SyncAwareEmpty>
            )
        );
        expect(screen.getByText("No activity")).toBeInTheDocument();
        act(() => syncStatus.report("activity", false));
        expect(screen.getByRole("alert")).toHaveTextContent(s.activityFailed);
    });

    it("mobile task list: empty and the tasks sync failed -> ErrorState instead of 'No open tasks'", () => {
        const props = {
            usePM: { currentProject: { projectId: 5 } } as never,
            useTM: { allTasks: [] } as never,
        };
        const { unmount } = render(wrap(<MobileTaskList {...props} />));
        expect(document.querySelector('[data-empty="mobile-tasks"]')).not.toBeNull();
        unmount();

        syncStatus.report("tasks", false);
        render(wrap(<MobileTaskList {...props} />));
        expect(document.querySelector('[data-empty="mobile-tasks"]')).toBeNull();
        expect(screen.getByRole("alert")).toHaveTextContent(s.tasksFailed);
    });
});

describe("adoption (source-level: the table and the dashboard are too big to mount here)", () => {
    const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
    const read = (p: string) => readFileSync(join(SRC, p), "utf8");

    it("the task table and the project dashboard read the sync status for their empty state", () => {
        expect(read("features/tasks/components/table/DraggableTaskTable.tsx")).toContain(
            'useSyncFailure("tasks")'
        );
        expect(read("features/tasks/components/dashboard/TaskHomeContent.tsx")).toContain(
            'useSyncFailure("projects")'
        );
    });

    it("App mounts the banner and registers the retry", () => {
        const app = read("App.tsx");
        expect(app).toContain("<SyncStatusBanner");
        expect(app).toContain("syncStatus.setRetry(");
    });

    it("the project list reports its own failure (it is not loaded by refreshAllData)", () => {
        expect(read("hooks/common/useProjectManagement.ts")).toContain(
            'syncStatus.report("projects", false)'
        );
    });
});
