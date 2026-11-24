/**
 * MIP-2373: on the CHAT page, submitting the create-task form must not close one
 * pane and open another (same fix as MIP-2370 on the task page).
 *
 * The chat preview slot has extra gates (`useSurfaceTaskPreviewVisible`,
 * `useTaskPreviewPaneVisible`, `useDropStaleSurfacePreview`). `ChatSlots` below wires
 * the REAL hooks the way chatHome.tsx wires them around the REAL `TaskPreviewPanel`, so
 * the submit sequence runs through every gate; only the heavy children are mocked.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TaskPreviewPanel } from "../features/chat/components/panels/TaskPreviewPanel";
import { useDropStaleSurfacePreview } from "../hooks/tasks/useDropStaleSurfacePreview";
import { useHoldPreviewAfterSolo, useSoloCreatePane } from "../hooks/tasks/useSoloCreatePane";
import { useSurfaceTaskPreviewVisible } from "../hooks/tasks/useSurfaceTaskPreviewVisible";
import type { TaskManagementState } from "../hooks/tasks/useTaskManagement";
import { useTaskPreviewPaneVisible } from "../hooks/tasks/useTaskPreviewPaneVisible";

vi.mock("react-resizable-panels", () => ({
    Panel: ({ children, id }: { children?: React.ReactNode; id?: string }) => (
        <div data-testid={`panel-${id}`}>{children}</div>
    ),
}));
vi.mock("../features/tasks/components/contents/TaskPreview", () => ({
    TaskPreview: () => <div>task preview</div>,
}));
vi.mock("../features/tasks/components/contents/CreateTaskForm", () => ({
    CreateTaskForm: () => <div>create task form</div>,
}));

type Tm = {
    creating: boolean;
    previewVisible: boolean;
    taskId: number;
    previewCount?: number;
};

const makeTM = ({ creating, previewVisible, taskId, previewCount = 0 }: Tm) =>
    ({
        isCreatingTask: { flag: creating },
        isTaskPreviewVisible: previewVisible,
        currentPreviewTaskId: taskId,
        currentPreviewTask: taskId > 0 ? { id: taskId } : undefined,
        currentPreviewKind: "task",
        currentPreviewMilestoneId: -1,
        previewOpenCount: previewCount,
        previewCloseCount: 0,
    }) as unknown as TaskManagementState;

// chatHome.tsx's wiring of the preview slot, minus the unrelated panes.
const ChatSlots = ({ tm, active = true }: { tm: TaskManagementState; active?: boolean }) => {
    const [surfaceVisible, setSurfaceVisible] = useSurfaceTaskPreviewVisible("chat", active, tm);
    const paneVisible = useTaskPreviewPaneVisible(surfaceVisible && tm.isTaskPreviewVisible, tm);
    const createShown = tm.isCreatingTask.flag === true && active;
    const solo = useSoloCreatePane(createShown, paneVisible);
    const hold = useHoldPreviewAfterSolo(
        solo,
        tm.previewOpenCount ?? 0,
        tm.isTaskPreviewVisible === true && tm.currentPreviewTaskId > 0,
        paneVisible
    );
    useDropStaleSurfacePreview({
        isActiveRoute: active,
        intentPending: false,
        surfaceVisible,
        paneVisible,
        setSurfaceVisible,
    });
    const common = {
        myself: {} as never,
        setMyself: () => {},
        socket: null,
        useCM: {} as never,
        useNM: {} as never,
        usePM: {} as never,
        useSM: {} as never,
        useTEM: {} as never,
        useTM: tm,
        useUISM: {} as never,
    };
    return (
        <CssVarsProvider>
            {createShown && !solo && <div data-testid="beside-create">create beside</div>}
            {(solo || paneVisible || hold) && (
                <TaskPreviewPanel
                    {...common}
                    createForm={solo ? <div>create task form</div> : undefined}
                    guardStaleTaskId
                />
            )}
        </CssVarsProvider>
    );
};

describe("chat page create form -> preview", () => {
    beforeEach(() => localStorage.clear());
    afterEach(cleanup);

    it("keeps the same pane element from the form to the new task's preview", () => {
        const { rerender } = render(
            <ChatSlots tm={makeTM({ creating: true, previewVisible: false, taskId: -1 })} />
        );
        const pane = screen.getByTestId("panel-7");
        expect(pane).toHaveTextContent("create task form");
        expect(screen.queryByTestId("beside-create")).toBeNull();

        // Submit: the new task is selected and the preview flag raised while the form is
        // still up (surface flag follows through its effect).
        act(() => {
            rerender(
                <ChatSlots
                    tm={makeTM({
                        creating: true,
                        previewVisible: true,
                        taskId: 42,
                        previewCount: 1,
                    })}
                />
            );
        });
        expect(screen.getByTestId("panel-7")).toBe(pane);
        expect(screen.queryByTestId("beside-create")).toBeNull();

        // Then the form closes.
        act(() => {
            rerender(
                <ChatSlots
                    tm={makeTM({
                        creating: false,
                        previewVisible: true,
                        taskId: 42,
                        previewCount: 1,
                    })}
                />
            );
        });
        expect(screen.getByTestId("panel-7")).toBe(pane);
        expect(pane).toHaveTextContent("task preview");
        expect(pane).not.toHaveTextContent("create task form");
    });

    it("opens solo even when the global preview flag was left up with the pane hidden", () => {
        // Raw flag true, nothing selected: the chat pane is not on screen, so the form is
        // solo (no preview pane beside it).
        render(<ChatSlots tm={makeTM({ creating: true, previewVisible: true, taskId: -1 })} />);
        expect(screen.getByTestId("panel-7")).toHaveTextContent("create task form");
        expect(screen.queryByTestId("beside-create")).toBeNull();
    });

    it("keeps the form beside an already-open preview (sub-task from the preview)", () => {
        localStorage.setItem("taskPreviewVisible:chat", "true");
        render(<ChatSlots tm={makeTM({ creating: true, previewVisible: true, taskId: 7 })} />);
        expect(screen.getByTestId("panel-7")).toHaveTextContent("task preview");
        expect(screen.getByTestId("beside-create")).toBeInTheDocument();
    });

    it("closing the solo form leaves no pane behind", () => {
        const { rerender } = render(
            <ChatSlots tm={makeTM({ creating: true, previewVisible: false, taskId: -1 })} />
        );
        rerender(
            <ChatSlots tm={makeTM({ creating: false, previewVisible: false, taskId: -1 })} />
        );
        expect(screen.queryByTestId("panel-7")).toBeNull();
    });

    it("keeps the pane when the preview flag and the form closing land in ONE commit (milestone)", () => {
        const { rerender } = render(
            <ChatSlots tm={makeTM({ creating: true, previewVisible: false, taskId: -1 })} />
        );
        const pane = screen.getByTestId("panel-7");
        act(() => {
            rerender(
                <ChatSlots
                    tm={makeTM({
                        creating: false,
                        previewVisible: true,
                        taskId: 42,
                        previewCount: 1,
                    })}
                />
            );
        });
        expect(screen.getByTestId("panel-7")).toBe(pane);
        expect(pane).toHaveTextContent("task preview");
    });

    it("cancelling the solo form does not open a preview from a leftover request", () => {
        // A request was already up (count 3, task selected) but the pane was hidden.
        const { rerender } = render(
            <ChatSlots
                tm={makeTM({ creating: true, previewVisible: true, taskId: -1, previewCount: 3 })}
            />
        );
        act(() => {
            rerender(
                <ChatSlots
                    tm={makeTM({
                        creating: false,
                        previewVisible: true,
                        taskId: 9,
                        previewCount: 3,
                    })}
                />
            );
        });
        expect(screen.queryByTestId("panel-7")).toBeNull();
        // Review finding: the user leaves chat, opens another task elsewhere (count 3 -> 4),
        // and comes back. The cancelled form must not be read as a request to show it.
        const bumped = makeTM({
            creating: false,
            previewVisible: true,
            taskId: 10,
            previewCount: 4,
        });
        act(() => {
            rerender(<ChatSlots tm={bumped} active={false} />);
        });
        act(() => {
            rerender(<ChatSlots tm={bumped} active />);
        });
        expect(screen.queryByTestId("panel-7")).toBeNull();
    });
});
