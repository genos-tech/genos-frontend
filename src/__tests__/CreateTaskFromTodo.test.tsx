/**
 * Promoting a to-do into a task.
 *
 * The two things worth pinning: the created row is a ROOT task (a
 * promoted to-do is top-level work, and `createQuickTask`'s other
 * callers all pass real parent/root ids, so nulls are the new path), and
 * the to-do's own notes ride along as the task body instead of the
 * generic template.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ModalCreateTaskFromTodo } from "../features/chat/components/todo/ModalCreateTaskFromTodo";
import { UserProps } from "../types/admin";

vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));

const loadTeamProjects = vi.fn();
const createQuickTask = vi.fn();

vi.mock("../features/tasks/services/loadTeamProjects", () => ({
    loadTeamProjects: (...args: unknown[]) => loadTeamProjects(...args),
}));
vi.mock("../features/tasks/services/createQuickTask", () => ({
    createQuickTask: (...args: unknown[]) => createQuickTask(...args),
}));

const myself = {
    teamId: "team1",
    userId: "user1",
    userName: "Test User",
} as unknown as UserProps;

const renderModal = (over: { todoNotes?: never[] | null; todoTitle?: string } = {}) => {
    const onClose = vi.fn();
    const utils = render(
        <CssVarsProvider>
            <ModalCreateTaskFromTodo
                myself={myself}
                open={true}
                todoNotes={over.todoNotes ?? null}
                todoTitle={over.todoTitle ?? "Ship the thing"}
                onClose={onClose}
            />
        </CssVarsProvider>
    );
    return { ...utils, onClose };
};

describe("ModalCreateTaskFromTodo", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.localStorage.clear();
        loadTeamProjects.mockResolvedValue([
            { projectId: 42, projectName: "Platform" },
            { projectId: 7, projectName: "Marketing" },
        ]);
        createQuickTask.mockResolvedValue({ taskId: 101, displayId: "PLT-1" });
    });

    it("creates a ROOT task in the selected project, seeded with the to-do title", async () => {
        const { getByText, onClose } = renderModal();

        await waitFor(() => expect(loadTeamProjects).toHaveBeenCalled());
        fireEvent.click(getByText("Create task"));

        await waitFor(() => expect(createQuickTask).toHaveBeenCalledTimes(1));
        expect(createQuickTask.mock.calls[0][0]).toMatchObject({
            projectId: 42,
            title: "Ship the thing",
            // A promoted to-do is top-level work, not a sub-task.
            parentTaskId: null,
            rootTaskId: null,
            milestoneId: null,
        });
        await waitFor(() => expect(onClose).toHaveBeenCalled());
    });

    it("carries the to-do's notes over as the task body", async () => {
        const notes = [{ type: "paragraph", content: [{ type: "text", text: "context" }] }];
        const { getByText } = renderModal({ todoNotes: notes as never[] });

        await waitFor(() => expect(loadTeamProjects).toHaveBeenCalled());
        fireEvent.click(getByText("Create task"));

        await waitFor(() => expect(createQuickTask).toHaveBeenCalledTimes(1));
        expect(createQuickTask.mock.calls[0][0].content).toEqual(notes);
    });

    it("leaves the body to the default template when the to-do has no notes", async () => {
        const { getByText } = renderModal({ todoNotes: null });

        await waitFor(() => expect(loadTeamProjects).toHaveBeenCalled());
        fireEvent.click(getByText("Create task"));

        await waitFor(() => expect(createQuickTask).toHaveBeenCalledTimes(1));
        // undefined, not null — `createQuickTask` falls back to its
        // template only on `??`, and null would post an empty body.
        expect(createQuickTask.mock.calls[0][0].content).toBeUndefined();
    });

    it("remembers the project for the next promotion", async () => {
        const { getByText } = renderModal();

        await waitFor(() => expect(loadTeamProjects).toHaveBeenCalled());
        fireEvent.click(getByText("Create task"));

        await waitFor(() =>
            expect(window.localStorage.getItem("genos-todo-to-task-last-project")).toBe("42")
        );
    });

    it("prefers the remembered project when it is still live", async () => {
        window.localStorage.setItem("genos-todo-to-task-last-project", "7");
        const { getByText } = renderModal();

        await waitFor(() => expect(loadTeamProjects).toHaveBeenCalled());
        fireEvent.click(getByText("Create task"));

        await waitFor(() => expect(createQuickTask).toHaveBeenCalledTimes(1));
        expect(createQuickTask.mock.calls[0][0].projectId).toBe(7);
    });

    it("ignores a remembered project the user no longer has", async () => {
        // Left / deleted since last time — pre-selecting it would show a
        // blank picker and post to a project that isn't listed.
        window.localStorage.setItem("genos-todo-to-task-last-project", "999");
        const { getByText } = renderModal();

        await waitFor(() => expect(loadTeamProjects).toHaveBeenCalled());
        fireEvent.click(getByText("Create task"));

        await waitFor(() => expect(createQuickTask).toHaveBeenCalledTimes(1));
        expect(createQuickTask.mock.calls[0][0].projectId).toBe(42);
    });

    it("surfaces a failure inline and keeps the modal open", async () => {
        createQuickTask.mockRejectedValue(new Error("boom"));
        const { getByText, onClose } = renderModal();

        await waitFor(() => expect(loadTeamProjects).toHaveBeenCalled());
        fireEvent.click(getByText("Create task"));

        await waitFor(() =>
            expect(getByText("Couldn't create the task. Please try again.")).toBeInTheDocument()
        );
        expect(onClose).not.toHaveBeenCalled();
    });
});
