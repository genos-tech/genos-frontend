/**
 * MIP-1755: a click on an "your AI app did X" row in the chat sidebar's Activity feed opens the
 * task or milestone in the chat's preview modal, the way a task-body mention does. It no longer
 * moves the user to the task or milestone page. Notes keep their page (the app's own note
 * mentions open the note page too), and a notice with no ids keeps the path it always had.
 *
 * Also pinned: the row is reachable from the keyboard (Enter opens it), since it is a div-based row.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AiAppActivityRow } from "../features/chat/components/sidebar/activity/AiAppActivityRow";
import { parseAiAppNotice } from "../features/chat/utils/aiAppNotice";
import { loadSpecificTask } from "../features/tasks/services/loadSpecificTask";
import type { ActivityMessageProps } from "../types/chat";

const navigateMock = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => ({
    ...(await importOriginal<typeof import("react-router-dom")>()),
    useNavigate: () => navigateMock,
}));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));
vi.mock("../features/chat/hooks/useActivityStatus", () => ({
    useActivityStatus: () => ({ updateActivityReadStatus: vi.fn() }),
}));
vi.mock("../features/tasks/services/loadSpecificTask", () => ({
    loadSpecificTask: vi.fn(async (_m: unknown, _p: number, taskId: number) => [
        { taskId, title: "Fix login" },
    ]),
}));

afterEach(cleanup);
beforeEach(() => {
    navigateMock.mockClear();
    vi.mocked(loadSpecificTask).mockClear();
});

const myself = { userId: "me", userName: "Me", userEmail: "me@test", teamId: "t1" } as never;

const makeTM = () => ({
    setIsTaskPreviewVisible: vi.fn(),
    setCurrentPreviewTask: vi.fn(),
    setCurrentPreviewTaskId: vi.fn(),
    setCurrentPreviewKind: vi.fn(),
    setCurrentPreviewMilestoneId: vi.fn(),
});

/** An AI-app row as the feed holds it after `v3ActivityToLegacy` (the notice already parsed). */
const row = (meta: Record<string, unknown>) =>
    ({
        activityId: "act-1",
        tsSent: "2026-11-21T10:00:00Z",
        isRead: false,
        aiApp: parseAiAppNotice({ aiApp: true, app: "Claude Code", ...meta }),
    }) as unknown as ActivityMessageProps;

const renderRow = (activity: ActivityMessageProps, tm = makeTM()) => {
    const setCurrentProject = vi.fn();
    render(
        <CssVarsProvider>
            <MemoryRouter>
                <AiAppActivityRow
                    activity={activity}
                    activityMessages={[activity]}
                    myself={myself}
                    selectedActivityId=""
                    setCurrentProject={setCurrentProject}
                    setSelectedActivityId={vi.fn()}
                    useCM={{} as never}
                    useTM={tm as never}
                />
            </MemoryRouter>
        </CssVarsProvider>
    );
    return { tm, setCurrentProject };
};

const rowButton = () => screen.getByRole("button", { name: /Claude Code/ });

describe("AI-app activity row opens the item in the chat modal (MIP-1755)", () => {
    it("a created task opens its preview in place and stays on the chat page", async () => {
        const { tm, setCurrentProject } = renderRow(
            row({
                verb: "created",
                kind: "task",
                count: 1,
                url: "/workspace/tasks/project/3/task/7",
                items: [
                    {
                        kind: "task",
                        id: 7,
                        taskId: 7,
                        projectId: 3,
                        displayId: "MIP-7",
                        title: "Fix login",
                        url: "/workspace/tasks/project/3/task/7",
                    },
                ],
            })
        );

        fireEvent.click(rowButton());
        await act(async () => {});

        expect(navigateMock).not.toHaveBeenCalled();
        expect(loadSpecificTask).toHaveBeenCalledWith(myself, 3, 7, "tok");
        expect(setCurrentProject).toHaveBeenCalledWith(expect.objectContaining({ projectId: 3 }));
        expect(tm.setCurrentPreviewTask).toHaveBeenCalledWith(
            expect.objectContaining({ taskId: 7 })
        );
        expect(tm.setCurrentPreviewTaskId).toHaveBeenCalledWith(7);
        expect(tm.setIsTaskPreviewVisible).toHaveBeenCalledWith(true);
    });

    it("Enter on the focused row opens the task the same way (keyboard access)", async () => {
        const { tm } = renderRow(
            row({
                verb: "created",
                kind: "task",
                count: 1,
                url: "/workspace/tasks/project/3/task/7",
                items: [{ kind: "task", id: 7, taskId: 7, projectId: 3, title: "Fix login" }],
            })
        );

        rowButton().focus();
        fireEvent.keyDown(rowButton(), { key: "Enter" });
        await act(async () => {});

        expect(navigateMock).not.toHaveBeenCalled();
        expect(tm.setIsTaskPreviewVisible).toHaveBeenCalledWith(true);
    });

    it("a milestone opens its preview in place, not its page", () => {
        const { tm, setCurrentProject } = renderRow(
            row({
                verb: "created",
                kind: "milestone",
                count: 1,
                url: "/workspace/tasks/project/3/milestone/9",
                items: [
                    {
                        kind: "milestone",
                        id: 9,
                        projectId: 3,
                        title: "Launch",
                        url: "/workspace/tasks/project/3/milestone/9",
                    },
                ],
            })
        );

        fireEvent.click(rowButton());

        expect(navigateMock).not.toHaveBeenCalled();
        expect(setCurrentProject).toHaveBeenCalledWith(expect.objectContaining({ projectId: 3 }));
        expect(tm.setCurrentPreviewKind).toHaveBeenCalledWith("milestone");
        expect(tm.setCurrentPreviewMilestoneId).toHaveBeenCalledWith(9);
        expect(tm.setIsTaskPreviewVisible).toHaveBeenCalledWith(true);
    });

    it("a note still opens its note page (the app's own note mentions do too)", () => {
        renderRow(
            row({
                verb: "created",
                kind: "note",
                count: 1,
                url: "/workspace/notes/my/5",
                items: [{ kind: "note", id: 5, title: "Plan", url: "/workspace/notes/my/5" }],
            })
        );

        fireEvent.click(rowButton());

        expect(navigateMock).toHaveBeenCalledWith("/workspace/notes/my/5");
    });

    it("a notice with no ids keeps the path it always had", () => {
        renderRow(
            row({
                verb: "created",
                kind: "task",
                count: 1,
                url: "/workspace/tasks",
                items: [{ kind: "task", title: "Fix login" }],
            })
        );

        fireEvent.click(rowButton());

        expect(navigateMock).toHaveBeenCalledWith("/workspace/tasks");
        expect(loadSpecificTask).not.toHaveBeenCalled();
    });
});
