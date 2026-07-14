/**
 * Modal ↔ host task-comment isolation.
 *
 * `useTaskManagement` hoists `taskComments` / `taskCommentLines` into
 * global state on purpose (host preview + chat-thread Comments tab show
 * the SAME task). The link-preview modals are the exception: they render
 * a *different* task on top of the host page, so passing the global
 * slots through let the modal's comment load overwrite the host
 * preview's comments (open task-B from task-A's preview → task-A's
 * Comments tab showed task-B's comments and kept them after close).
 *
 * These tests stub TaskPreview with a probe that captures the `useTM`
 * the modal view hands it, then assert the comment slots are
 * modal-local (writes don't reach the host state) while the
 * deliberately-shared refetch nudge (`setIsTaskCommentUpdated`) still
 * passes through.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ModalMilestoneView } from "../components/modals/views/ModalMilestoneView";
import { ModalTaskView } from "../components/modals/views/ModalTaskView";
import type { TaskManagementState } from "../hooks/tasks/useTaskManagement";
import type { TaskCommentProps } from "../types/tasks";

const captured = vi.hoisted(() => ({
    useTM: null as TaskManagementState | null,
}));

// Probe stub: expose the `useTM` the view builds + render the comment
// count so state updates are observable through the DOM.
vi.mock("../features/tasks/components/contents/TaskPreview", () => ({
    TaskPreview: ({ useTM }: { useTM: TaskManagementState }) => {
        captured.useTM = useTM;
        return <div data-testid="preview-probe">{useTM.taskComments.length}</div>;
    },
}));

vi.mock("../features/tasks/services/loadSpecificTask", () => ({
    loadSpecificTask: vi.fn(async () => [{ id: 2, title: "Task B" }]),
}));

const makeComment = (commentId: number): TaskCommentProps =>
    ({
        commentId,
        commentBody: [],
        senderId: "u1",
        senderName: "User One",
        taskId: 2,
        tsSent: "2026-07-14 00:00:00",
        tsUpdated: "2026-07-14 00:00:00",
        isEdited: false,
        projectId: 1,
    }) as unknown as TaskCommentProps;

const makeHostUseTM = () => {
    const hostComment = makeComment(999);
    const host = {
        taskComments: [hostComment],
        setTaskComments: vi.fn(),
        taskCommentLines: 7,
        setTaskCommentLines: vi.fn(),
        setIsTaskCommentUpdated: vi.fn(),
        currentPreviewKind: "task",
        currentPreviewMilestoneId: -1,
    } as unknown as TaskManagementState;
    return { host, hostComment };
};

const baseProps = {
    onClose: vi.fn(),
    accessToken: "token",
    myself: { teamId: "team-1", userId: "u1" },
    setMyself: vi.fn(),
    socket: null,
    useTEM: {},
    useUISM: {},
    useCM: {},
    usePM: { currentProject: undefined, teamProjects: [] },
    useNM: {},
} as unknown as Omit<React.ComponentProps<typeof ModalTaskView>, "target" | "useTM">;

beforeEach(() => {
    captured.useTM = null;
});

describe("modal task-comment isolation", () => {
    it("ModalTaskView gives TaskPreview local comment slots, not the host's", async () => {
        const { host, hostComment } = makeHostUseTM();
        render(
            <CssVarsProvider>
                <ModalTaskView
                    {...baseProps}
                    target={{ kind: "task", projectId: 1, taskId: 2 }}
                    useTM={host}
                />
            </CssVarsProvider>
        );
        await waitFor(() => expect(captured.useTM).not.toBeNull());

        // The modal starts from its OWN empty slot — not the host's list.
        expect(screen.getByTestId("preview-probe").textContent).toBe("0");
        expect(captured.useTM!.taskCommentLines).toBe(0);
        // Preview-task override still points at the linked task.
        expect(captured.useTM!.currentPreviewTask?.id).toBe(2);

        // A comment load/post inside the modal must stay modal-local…
        act(() => {
            captured.useTM!.setTaskComments([makeComment(1), makeComment(2)]);
            captured.useTM!.setTaskCommentLines(3);
        });
        expect(screen.getByTestId("preview-probe").textContent).toBe("2");
        expect(host.setTaskComments).not.toHaveBeenCalled();
        expect(host.setTaskCommentLines).not.toHaveBeenCalled();
        expect(host.taskComments).toEqual([hostComment]);

        // …while the refetch nudge still reaches the host (shared on
        // purpose — it's task-scoped at every consumer).
        captured.useTM!.setIsTaskCommentUpdated({ isUpdate: true, scrollToBottom: false });
        expect(host.setIsTaskCommentUpdated).toHaveBeenCalledWith({
            isUpdate: true,
            scrollToBottom: false,
        });
    });

    it("ModalMilestoneView isolates the comment slots the same way", async () => {
        const { host, hostComment } = makeHostUseTM();
        const useSM = {
            refreshMilestone: vi.fn(async () => ({ milestoneId: 5, taskId: 42 })),
        };
        render(
            <CssVarsProvider>
                <ModalMilestoneView
                    {...baseProps}
                    target={{ kind: "milestone", projectId: 1, milestoneId: 5 }}
                    useSM={useSM as never}
                    useTM={host}
                />
            </CssVarsProvider>
        );
        await waitFor(() => expect(captured.useTM).not.toBeNull());

        expect(screen.getByTestId("preview-probe").textContent).toBe("0");
        act(() => {
            captured.useTM!.setTaskComments([makeComment(1)]);
        });
        expect(screen.getByTestId("preview-probe").textContent).toBe("1");
        expect(host.setTaskComments).not.toHaveBeenCalled();
        expect(host.taskComments).toEqual([hostComment]);
        // Milestone-mode override is intact alongside the local slots.
        expect(captured.useTM!.currentPreviewKind).toBe("milestone");
        expect(captured.useTM!.currentPreviewMilestoneId).toBe(5);
    });
});
