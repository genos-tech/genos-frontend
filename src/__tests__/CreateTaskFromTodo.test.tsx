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
import { onTasksBulkChanged } from "../features/tasks/services/taskEvents";
import { UserProps } from "../types/admin";

vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));

const openModalByHref = vi.fn();
vi.mock("../hooks/common/UrlLinkModalContext", () => ({
    useUrlLinkModal: () => ({ openModalByHref }),
}));

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
        openModalByHref.mockClear();
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

    it("opens the created task, so a successful create is visible", async () => {
        // Nothing on the to-do surface lists tasks, so without this the
        // modal closes and the create is indistinguishable from a no-op.
        const { getByText } = renderModal();

        await waitFor(() => expect(loadTeamProjects).toHaveBeenCalled());
        fireEvent.click(getByText("Create task"));

        await waitFor(() =>
            expect(openModalByHref).toHaveBeenCalledWith("/workspace/tasks/project/42/task/101")
        );
    });

    it("does not try to open anything when the id could not be read", async () => {
        createQuickTask.mockResolvedValue({ taskId: null, displayId: null });
        const { getByText, onClose } = renderModal();

        await waitFor(() => expect(loadTeamProjects).toHaveBeenCalled());
        fireEvent.click(getByText("Create task"));

        await waitFor(() => expect(onClose).toHaveBeenCalled());
        expect(openModalByHref).not.toHaveBeenCalled();
    });

    it("treats an untouched notes editor as no notes", async () => {
        // BlockNote refuses an empty document, so an untouched editor
        // still holds one empty paragraph — carrying that over would
        // open the task to a blank body instead of the template.
        const { getByText } = renderModal({
            todoNotes: [{ type: "paragraph", content: [] }] as never[],
        });

        await waitFor(() => expect(loadTeamProjects).toHaveBeenCalled());
        fireEvent.click(getByText("Create task"));

        await waitFor(() => expect(createQuickTask).toHaveBeenCalledTimes(1));
        expect(createQuickTask.mock.calls[0][0].content).toBeUndefined();
    });

    it("tells an open task surface for that project to refresh", async () => {
        const { getByText } = renderModal();

        await waitFor(() => expect(loadTeamProjects).toHaveBeenCalled());
        const seen: Array<number | undefined> = [];
        const off = onTasksBulkChanged((detail) => seen.push(detail.projectId));
        fireEvent.click(getByText("Create task"));

        await waitFor(() => expect(seen).toEqual([42]));
        off();
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
