/**
 * Inline dependency removal + dependency-modal stacking.
 *
 * The preview's dependency chips are CLICKABLE (they navigate to the
 * other task), and the new per-chip unlink button sits inside that
 * clickable surface — so the load-bearing contracts are:
 *   - unlink calls `useTM.removeTaskDependency(dependencyId, taskId)`
 *     and does NOT also fire the chip's navigation;
 *   - the chip body still navigates;
 *   - `ModalManageDependencies` derives its z-index from `hostZIndex`
 *     (host+2). Without that it rendered at Joy's ~1300 default —
 *     invisibly BEHIND a task-diagram (9999+) or a UrlLinkModal-hosted
 *     preview (10020+): the "can't open the dependency modal" bug.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TaskDependenciesBlock } from "../features/tasks/components/contents/base/TaskDependenciesBlock";
import type { ProjectManagementState } from "../hooks/common/useProjectManagement";
import type { TaskManagementState } from "../hooks/tasks/useTaskManagement";
import type { TaskDependencyRef, TaskProps } from "../types/tasks";

// The manage modal's ACTaskSelector reads the auth token for its task
// fetches; no AuthProvider is mounted in this stripped render.
vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "test-token" }),
}));

const dep = (dependencyId: number, otherTaskId: number, title: string): TaskDependencyRef => ({
    dependencyId,
    otherTaskId,
    displayId: `PRJ-${otherTaskId}`,
    projectId: 1,
    projectName: "Alpha",
    title,
    status: { code: 0, status: "Open", color: "#0044c2", textColor: "white" },
    assigneeUserId: null,
    isMilestone: false,
});

const renderBlock = (opts: { hostZIndex?: number } = {}) => {
    const removeTaskDependency = vi.fn(async () => true);
    const setCurrentPreviewTaskId = vi.fn();
    const refreshTaskStatuses = vi.fn(async () => {});
    const useTM = {
        taskDependencies: {
            10: {
                blocking: [dep(501, 21, "Downstream work")],
                blockedBy: [dep(502, 22, "Upstream work")],
            },
        },
        removeTaskDependency,
        setCurrentPreviewTaskId,
        addTaskDependency: vi.fn(),
        refreshTaskStatuses,
    } as unknown as TaskManagementState;
    const usePM = {
        teamProjects: [],
        setCurrentProject: vi.fn(),
    } as unknown as ProjectManagementState;
    const taskContent = {
        id: 10,
        title: "Host task",
        project: { projectId: 1, projectName: "Alpha", projectTags: [] },
    } as unknown as TaskProps;

    render(
        <CssVarsProvider>
            <TaskDependenciesBlock
                hostZIndex={opts.hostZIndex}
                isPreviewMode={true}
                myself={{ userId: "u1" } as never}
                taskContent={taskContent}
                usePM={usePM}
                useTM={useTM}
            />
        </CssVarsProvider>
    );
    return { removeTaskDependency, setCurrentPreviewTaskId, refreshTaskStatuses };
};

describe("TaskDependenciesBlock inline remove", () => {
    it("removes the dependency without triggering the chip's navigation", () => {
        const { removeTaskDependency, setCurrentPreviewTaskId } = renderBlock();

        const unlinkButtons = screen.getAllByRole("button", { name: "Remove dependency" });
        expect(unlinkButtons).toHaveLength(2);
        fireEvent.click(unlinkButtons[0]);

        expect(removeTaskDependency).toHaveBeenCalledTimes(1);
        expect(removeTaskDependency).toHaveBeenCalledWith(501, 10);
        expect(setCurrentPreviewTaskId).not.toHaveBeenCalled();
    });

    it("refreshes both endpoints' status after a successful remove", async () => {
        const { refreshTaskStatuses } = renderBlock();

        // Unlink the first chip (the "blocking" dep to task 21, project 1).
        fireEvent.click(screen.getAllByRole("button", { name: "Remove dependency" })[0]);

        // Fires after the DELETE resolves — so the backend's auto-unblock
        // (Blocked -> Open) is reflected in the table + preview at once.
        await waitFor(() => expect(refreshTaskStatuses).toHaveBeenCalledTimes(1));
        expect(refreshTaskStatuses).toHaveBeenCalledWith([
            { taskId: 10, projectId: 1 },
            { taskId: 21, projectId: 1 },
        ]);
    });

    it("keeps the chip body navigating to the other task", () => {
        const { removeTaskDependency, setCurrentPreviewTaskId } = renderBlock();

        fireEvent.click(screen.getByText("Downstream work"));

        expect(setCurrentPreviewTaskId).toHaveBeenCalledWith(21);
        expect(removeTaskDependency).not.toHaveBeenCalled();
    });
});

describe("ModalManageDependencies stacking", () => {
    const openModal = () => {
        // The per-row "+" opens the manage modal focused on that side.
        fireEvent.click(screen.getAllByRole("button", { name: "Add to Blocking" })[0]);
    };

    it("derives its z-index from hostZIndex (host + 2)", () => {
        renderBlock({ hostZIndex: 10020 });
        openModal();

        const modalRoot = document
            .querySelector('[role="dialog"]')
            ?.closest(".MuiModal-root") as HTMLElement;
        expect(modalRoot).toBeTruthy();
        expect(getComputedStyle(modalRoot).zIndex).toBe("10022");
    });

    it("uses the 10010 dialog-family default when page-hosted", () => {
        renderBlock();
        openModal();

        const modalRoot = document
            .querySelector('[role="dialog"]')
            ?.closest(".MuiModal-root") as HTMLElement;
        expect(getComputedStyle(modalRoot).zIndex).toBe("10010");
    });
});
