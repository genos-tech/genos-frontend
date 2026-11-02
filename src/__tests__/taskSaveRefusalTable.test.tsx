/**
 * The task table when the server refuses an edit (MIP-925).
 *
 * Two ways a row changes through `updateTaskFromTable`:
 *
 *  - an inline cell edit (`handleRowUpdate`): the table state is written only
 *    AFTER the save, from the row the helper hands back. The helper used to
 *    swallow a refusal and return the EDITED row, so the table showed the value
 *    the server had refused. A refusal now rejects and the table hands back
 *    the row it still holds, writing nothing.
 *  - dropping a row onto another to reparent it (`reparentTask`): optimistic
 *    BEFORE the save, and the `catch` only logged, so a refused move stayed on
 *    screen. It now puts the moved rows (and the open preview) back.
 *
 * The table is rendered for real. The drag library is replaced by a stub that
 * hands the test `onDragEnd`, the rows by a list that hands the test
 * `onRowUpdate` and shows each row's parent, and only the transport underneath
 * the real save is stubbed.
 */
import { useMemo, useState } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { act, render, screen, waitFor } from "@testing-library/react";
import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DraggableTaskTable } from "../features/tasks/components/table/DraggableTaskTable";
import { subscribeRequestErrors } from "../services/requestErrorNotifier";
import { UserProps } from "../types/admin";
import { TaskProps, TaskTableProps } from "../types/tasks";

let finishDrag: (result: unknown) => void = () => {};
vi.mock("@hello-pangea/dnd", () => ({
    DragDropContext: ({
        onDragEnd,
        children,
    }: {
        onDragEnd: (result: unknown) => void;
        children: React.ReactNode;
    }) => {
        finishDrag = onDragEnd;
        return <>{children}</>;
    },
    Droppable: ({ children }: { children: (p: unknown, s: unknown) => React.ReactNode }) => (
        <>{children({ droppableProps: {}, innerRef: () => {}, placeholder: null }, {})}</>
    ),
    Draggable: ({ children }: { children: (p: unknown, s: unknown) => React.ReactNode }) => (
        <>{children({}, {})}</>
    ),
}));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));

// What the table hands to its rows, so the test can call it and read the rows.
let rowUpdate: (row: TaskTableProps) => Promise<TaskTableProps> = async (row) => row;
vi.mock("../features/tasks/components/table/TaskTableRows", () => ({
    TaskTableRows: ({
        displayRows,
        onRowUpdate,
    }: {
        displayRows: TaskTableProps[];
        onRowUpdate: (row: TaskTableProps) => Promise<TaskTableProps>;
    }) => {
        rowUpdate = onRowUpdate;
        return (
            <div>
                {displayRows.map((r) => (
                    <span
                        key={r.id}
                        data-parent={r.parentTaskId ?? ""}
                        data-status={r.status}
                        data-testid={`row-${r.id}`}
                    />
                ))}
            </div>
        );
    },
}));
// The filter menu normally publishes the filtered rows; here it passes them all.
vi.mock("../features/tasks/components/table/TaskFilterMenu", async () => {
    const React = await import("react");
    return {
        TaskFilterMenu: ({
            useTM,
            setCurrentDisplayingTasks,
        }: {
            useTM: { allTasks: TaskTableProps[] };
            setCurrentDisplayingTasks: (rows: TaskTableProps[]) => void;
        }) => {
            React.useEffect(() => {
                setCurrentDisplayingTasks(useTM.allTasks);
            }, [useTM.allTasks, setCurrentDisplayingTasks]);
            return null;
        },
    };
});
vi.mock("../features/tasks/components/table/TaskTableColumnSettings", () => ({
    TaskTableColumnSettings: () => null,
}));
vi.mock("../features/tasks/diagram/components/LazyTaskDiagram", () => ({
    LazyTaskDiagram: () => null,
}));
vi.mock("../hooks/tasks/useProjectCustomFields", () => ({
    useProjectCustomFields: () => ({ fields: [] }),
}));
vi.mock("../features/admin/services/popTeamMembers", () => ({
    popTeamMembers: vi.fn().mockResolvedValue([]),
}));

const loadSpecificTask = vi.fn();
vi.mock("../features/tasks/services/loadSpecificTask", () => ({
    loadSpecificTask: (...args: unknown[]) => loadSpecificTask(...args),
}));
vi.mock("../db/services/task-full.service", () => ({
    cacheFullTask: vi.fn().mockResolvedValue(undefined),
    invalidateCachedFullTask: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../features/tasks/services/addTask", () => ({
    addTask: vi.fn().mockResolvedValue(null),
}));
vi.mock("../features/tasks/services/uploadTaskAttachments", () => ({
    uploadTaskAttachments: vi.fn().mockResolvedValue([]),
}));
vi.mock("../services/channel/channelService", () => ({
    channelService: { updateTaskCard: vi.fn().mockResolvedValue(undefined) },
}));

const myself = { teamId: "t1", userId: "u1" } as unknown as UserProps;
const user = { userId: "u1", userName: "u1" } as unknown as UserProps;

const fullTask = (): TaskProps =>
    ({
        id: 42,
        displayId: "KDS-42",
        title: "A task",
        body: [],
        project: { projectId: 1, projectName: "Kds", systemUserId: "sys" },
        assignee: user,
        reporter: user,
        priority: { priority: "Medium" },
        effortLevel: { level: "Medium" },
        status: { status: "Open" },
        dueDate: "",
        links: [],
        tags: [],
        attachments: [],
        parentTaskId: null,
        threadId: null,
    }) as unknown as TaskProps;

const makeRow = (id: string, extra: Partial<TaskTableProps> = {}): TaskTableProps =>
    ({
        id,
        displayId: `KDS-${id}`,
        title: `Task ${id}`,
        status: "Open",
        priority: "Medium",
        effortLevel: "Medium",
        dueDate: "",
        projectId: 1,
        parentTaskId: null,
        rootTaskId: Number(id),
        milestoneId: null,
        sprintId: null,
        isMilestone: false,
        assigneeId: "u1",
        tags: [],
        ...extra,
    }) as unknown as TaskTableProps;

const adapter = vi.fn();
const respondWith = (status: number, data: unknown) => {
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
        if (status < 400) return { data, status, statusText: "OK", headers: {}, config };
        throw new AxiosError(
            `Request failed with status code ${status}`,
            "ERR_BAD_REQUEST",
            config,
            null,
            { data, status, statusText: "", headers: {}, config }
        );
    });
};

let bus: Array<[string, string | undefined]> = [];
let unsubscribe: () => void = () => {};
let originalAdapter: typeof axios.defaults.adapter;
let now = 0;

beforeEach(() => {
    now += 60_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    vi.spyOn(console, "error").mockImplementation(() => {});
    originalAdapter = axios.defaults.adapter;
    axios.defaults.adapter = adapter;
    adapter.mockReset();
    loadSpecificTask.mockReset();
    loadSpecificTask.mockResolvedValue([fullTask()]);
    bus = [];
    unsubscribe = subscribeRequestErrors(((kind: string, text?: string) =>
        bus.push([kind, text])) as never);
});

afterEach(() => {
    unsubscribe();
    axios.defaults.adapter = originalAdapter;
    vi.restoreAllMocks();
});

const initialRows = () => [makeRow("42"), makeRow("43")];
const initialPreview = () => ({
    id: 42,
    parentTaskId: null,
    milestoneId: null,
    rootTaskId: 42,
    title: "Task 42",
    tags: [],
    status: { status: "Open" },
    priority: { priority: "Medium" },
    effortLevel: { level: "Medium" },
});

// The table's host state, kept in real React state (as in the app) so the
// optimistic and the undone writes show up in what is rendered. The spies
// record each write; the `latest*` variables expose the state they produced.
const setAllTasksSpy = vi.fn();
const setCurrentPreviewTaskSpy = vi.fn();
let latestAllTasks: TaskTableProps[] = [];
let latestPreview: Record<string, unknown> = {};

const Host = () => {
    const [allTasks, setAllTasksState] = useState<TaskTableProps[]>(initialRows());
    const [currentPreviewTask, setPreviewState] =
        useState<Record<string, unknown>>(initialPreview());
    latestAllTasks = allTasks;
    latestPreview = currentPreviewTask;
    const useTM = useMemo(
        () => ({
            allTasks,
            setAllTasks: (update: unknown) => {
                setAllTasksSpy(update);
                setAllTasksState(update as never);
            },
            tableMilestoneFilterId: null,
            currentPreviewTaskId: 42,
            currentPreviewMilestoneId: -1,
            currentPreviewKind: "task",
            currentPreviewTask,
            setCurrentPreviewTask: (update: unknown) => {
                setCurrentPreviewTaskSpy(update);
                setPreviewState(update as never);
            },
            setIsTaskUpdated: vi.fn(),
            isLoadingTasks: false,
        }),
        [allTasks, currentPreviewTask]
    );
    return (
        <DraggableTaskTable
            myself={myself}
            setMyself={vi.fn()}
            setTeamMembers={vi.fn()}
            socket={null}
            teamMembers={[user]}
            useCM={{} as never}
            usePM={{ currentProject: { projectId: 1, projectTags: [] } } as never}
            useSM={{ projectSprints: {} } as never}
            useTEM={{} as never}
            useTM={useTM as never}
            useUISM={{} as never}
        />
    );
};

const renderTable = () => {
    setAllTasksSpy.mockClear();
    setCurrentPreviewTaskSpy.mockClear();
    render(
        <CssVarsProvider>
            <Host />
        </CssVarsProvider>
    );
};

const parentOf = (id: string) => screen.queryByTestId(`row-${id}`)?.getAttribute("data-parent");

describe("an inline edit in the task table", () => {
    it("hands back the row as the table holds it and writes nothing when the server refuses", async () => {
        const reason = "assignee 'u9' is not a member of project 1.";
        respondWith(400, { error: reason });
        renderTable();
        await waitFor(() => expect(screen.queryByTestId("row-42")).not.toBeNull());

        let returned: TaskTableProps | undefined;
        await act(async () => {
            returned = await rowUpdate(makeRow("42", { status: "WIP" }));
        });

        // Vacuity guard: the refused value was really sent.
        expect(adapter).toHaveBeenCalledTimes(1);
        expect(JSON.parse(adapter.mock.calls[0][0].data).status).toBe("WIP");
        // The table keeps the stored status and was never told otherwise.
        expect(returned?.status).toBe("Open");
        expect(screen.getByTestId("row-42").getAttribute("data-status")).toBe("Open");
        expect(setAllTasksSpy).not.toHaveBeenCalled();
        expect(setCurrentPreviewTaskSpy).not.toHaveBeenCalled();
        expect(bus[bus.length - 1]).toEqual(["serverMessage", reason]);
    });

    it("shows the edited row once the server accepts it (the harness can show a stuck edit)", async () => {
        respondWith(200, { task: { ts_updated_at: "now" } });
        renderTable();
        await waitFor(() => expect(screen.queryByTestId("row-42")).not.toBeNull());

        await act(async () => {
            await rowUpdate(makeRow("42", { status: "WIP" }));
        });

        expect(adapter).toHaveBeenCalledTimes(1);
        await waitFor(() =>
            expect(screen.getByTestId("row-42").getAttribute("data-status")).toBe("WIP")
        );
        expect(setAllTasksSpy).toHaveBeenCalledTimes(1);
        expect(bus).toEqual([]);
    });
});

describe("dropping a task onto another in the task table", () => {
    const drop = () =>
        act(async () => {
            finishDrag({
                combine: { draggableId: "43" },
                draggableId: "42",
                source: { droppableId: "task-table", index: 0 },
                destination: null,
            });
        });

    it("puts the moved rows and the open preview back when the server refuses the move", async () => {
        const reason = "A task cannot be moved under itself or one of its own sub-tasks.";
        respondWith(400, { error: reason });
        renderTable();
        await waitFor(() => expect(parentOf("42")).toBe(""));

        await drop();

        // Vacuity guard: the move was applied optimistically (row 42 now sits
        // under 43 in the table state and the preview) and really sent.
        await waitFor(() => expect(adapter).toHaveBeenCalledTimes(1));
        expect(JSON.parse(adapter.mock.calls[0][0].data).parent_task_id).toBe(43);
        expect(setAllTasksSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
        expect(setCurrentPreviewTaskSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
        // Refused: the displayed row, the table state and the preview all went back.
        await waitFor(() => expect(bus[bus.length - 1]).toEqual(["serverMessage", reason]));
        await waitFor(() => expect(setAllTasksSpy).toHaveBeenCalledTimes(2));
        await waitFor(() => expect(parentOf("42")).toBe(""));
        expect(latestAllTasks.find((r) => r.id === "42")?.parentTaskId).toBeNull();
        expect(latestPreview.parentTaskId).toBeNull();
        expect(latestPreview.rootTaskId).toBe(42);
    });

    it("leaves the move in place when the server accepts it", async () => {
        respondWith(200, { task: { ts_updated_at: "now" } });
        renderTable();
        await waitFor(() => expect(parentOf("42")).toBe(""));

        await drop();

        await waitFor(() => expect(adapter).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(parentOf("42")).toBe("43"));
        expect(setAllTasksSpy).toHaveBeenCalledTimes(1);
        expect(latestAllTasks.find((r) => r.id === "42")?.parentTaskId).toBe("43");
        expect(latestPreview.parentTaskId).toBe(43);
        expect(bus).toEqual([]);
    });
});
