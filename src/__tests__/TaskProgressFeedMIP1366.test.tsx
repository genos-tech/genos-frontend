/**
 * MIP-1366: the "Under it" view of a task's or milestone's Activity tab - what
 * changed under it (MIP-1351), newest first, each entry headed by the task it
 * happened to and drawn by the same feed as the task's own history.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TaskProgressFeed } from "../features/tasks/components/contents/base/sub/TaskProgressFeed";
import { loadTaskProgress } from "../features/tasks/services/loadTaskProgress";
import type { TaskActivityProps, TaskProgressPage } from "../types/tasks";

vi.mock("../components/ui/avatars/avatarWithStatus", () => ({
    AvatarWithStatus: () => <span />,
}));
vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "tok" }),
}));
vi.mock("../features/tasks/services/loadTaskProgress", () => ({
    loadTaskProgress: vi.fn(),
}));

const load = vi.mocked(loadTaskProgress);

const entry = (n: number, over: Partial<TaskActivityProps> = {}): TaskActivityProps => ({
    activityId: 100 + n,
    factId: n,
    actionType: "status_changed",
    fieldName: "status",
    oldValue: "Open",
    newValue: "Closed",
    metadata: { via: { kind: "app" } },
    actor: { userId: "u1", userName: "Ken", avatarImgPath: null },
    tsCreatedAt: new Date().toISOString(),
    depth: 1,
    sourceTask: {
        id: String(900 + n),
        displayId: `MIP-${900 + n}`,
        title: `Sub-task ${n}`,
        isMilestone: false,
        isDeleted: false,
    },
    ...over,
});

const page = (
    entries: TaskActivityProps[],
    nextCursor: string | null = null
): TaskProgressPage => ({
    entries,
    nextCursor,
});

type Overrides = { taskId?: number; version?: string };
const ui = ({ taskId = 70, version = "v1" }: Overrides = {}) => (
    <CssVarsProvider>
        <MemoryRouter>
            <TaskProgressFeed
                allTasks={[]}
                myself={{ userId: "u1" } as never}
                projectId={7}
                setMyself={() => {}}
                socket={null}
                taskId={taskId}
                useCM={{} as never}
                useTEM={{ teamMemberProfiles: {} } as never}
                useUISM={{} as never}
                version={version}
            />
        </MemoryRouter>
    </CssVarsProvider>
);

beforeEach(() => load.mockReset());
afterEach(cleanup);

describe("TaskProgressFeed", () => {
    it("asks for what is UNDER the task, not its own changes", async () => {
        load.mockResolvedValue(page([entry(1)]));
        render(ui({ taskId: 70, version: "2026-11-09 10:00:00+00:00" }));
        await screen.findByTestId("task-progress-feed");
        expect(load).toHaveBeenCalledWith("tok", 70, {
            minDepth: 1,
            limit: 30,
            version: "2026-11-09 10:00:00+00:00",
        });
    });

    it("heads each entry with the task it happened to, as a link into the project", async () => {
        load.mockResolvedValue(page([entry(1), entry(2)]));
        render(ui());
        const lines = await screen.findAllByTestId("progress-source");
        expect(lines.map((l) => l.textContent)).toEqual([
            "MIP-901Sub-task 1",
            "MIP-902Sub-task 2",
        ]);
        expect(lines[0].getAttribute("href")).toBe("/workspace/tasks/project/7/task/901");
    });

    it("draws the change itself with the task feed's own sentence", async () => {
        load.mockResolvedValue(page([entry(1)]));
        render(ui());
        await screen.findByTestId("task-progress-feed");
        expect(screen.getByText("Closed")).toBeTruthy();
        expect(screen.getByText("Open")).toBeTruthy();
    });

    it("names a deleted task but does not link it", async () => {
        load.mockResolvedValue(
            page([
                entry(1, {
                    sourceTask: {
                        id: "5",
                        displayId: "MIP-5",
                        title: "Gone",
                        isMilestone: false,
                        isDeleted: true,
                    },
                }),
            ])
        );
        render(ui());
        const line = await screen.findByTestId("progress-source");
        expect(line.getAttribute("href")).toBeNull();
        expect(line.textContent).toContain("deleted");
    });

    it("says nothing has changed under it, rather than 'No activity yet'", async () => {
        load.mockResolvedValue(page([]));
        render(ui());
        await screen.findByText("Nothing has changed under this yet");
        expect(screen.queryByText("No activity yet")).toBeNull();
    });

    it("offers Retry when the read failed, and does not call that an empty history", async () => {
        load.mockResolvedValueOnce(null).mockResolvedValueOnce(page([entry(1)]));
        render(ui());
        const retry = await screen.findByText("Retry");
        expect(screen.queryByText("Nothing has changed under this yet")).toBeNull();
        fireEvent.click(retry);
        await screen.findByTestId("task-progress-feed");
        expect(load).toHaveBeenCalledTimes(2);
    });

    it("loads the next page on request and does not repeat an entry", async () => {
        load.mockResolvedValueOnce(page([entry(1), entry(2)], "cursor-1"));
        load.mockResolvedValueOnce(page([entry(2), entry(3)], null));
        render(ui());
        await screen.findAllByTestId("progress-source");
        fireEvent.click(screen.getByText("Load more"));
        await waitFor(() => expect(screen.getAllByTestId("progress-source")).toHaveLength(3));
        expect(load).toHaveBeenLastCalledWith("tok", 70, {
            cursor: "cursor-1",
            minDepth: 1,
            limit: 30,
            version: "v1",
        });
        expect(screen.queryByText("Load more")).toBeNull();
    });

    it("reads again when the task's lastProgressAt moves, and keeps the rows on screen meanwhile", async () => {
        load.mockResolvedValueOnce(page([entry(1)]));
        const view = render(ui({ version: "v1" }));
        await screen.findByTestId("task-progress-feed");

        let release: (p: TaskProgressPage) => void = () => {};
        load.mockReturnValueOnce(new Promise((resolve) => (release = resolve)));
        view.rerender(ui({ version: "v2" }));
        expect(screen.getByTestId("task-progress-feed")).toBeTruthy(); // not flashed away
        await act(async () => release(page([entry(9), entry(1)])));
        await waitFor(() => expect(screen.getAllByTestId("progress-source")).toHaveLength(2));
        expect(load).toHaveBeenLastCalledWith("tok", 70, {
            minDepth: 1,
            limit: 30,
            version: "v2",
        });
    });

    it("drops another task's rows when it moves to a different task", async () => {
        load.mockResolvedValueOnce(page([entry(1)]));
        const view = render(ui({ taskId: 70 }));
        await screen.findByTestId("task-progress-feed");

        load.mockReturnValueOnce(new Promise(() => {})); // the new task is still loading
        view.rerender(ui({ taskId: 71 }));
        await waitFor(() => expect(screen.queryAllByTestId("progress-source")).toHaveLength(0));
        expect(screen.queryByTestId("task-progress-feed")).toBeNull();
    });

    it("ignores a response for a task it has moved off", async () => {
        let releaseOld: (p: TaskProgressPage) => void = () => {};
        load.mockReturnValueOnce(new Promise((resolve) => (releaseOld = resolve)));
        const view = render(ui({ taskId: 70 }));

        load.mockResolvedValueOnce(page([entry(2)]));
        view.rerender(ui({ taskId: 71 }));
        const lines = await screen.findAllByTestId("progress-source");
        expect(lines.map((l) => l.textContent)).toEqual(["MIP-902Sub-task 2"]);

        // The first request answers late, for the task we left: it must not land.
        await act(async () => releaseOld(page([entry(1)])));
        expect(screen.getAllByTestId("progress-source").map((l) => l.textContent)).toEqual([
            "MIP-902Sub-task 2",
        ]);
    });
});
