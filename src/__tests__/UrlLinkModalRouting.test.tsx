/**
 * UrlLinkModal view-routing harness.
 *
 * UrlLinkModal is the single entry point for EVERY internal link clicked
 * inside a chat message / task preview / agent answer. It lazy-loads one
 * of five `Modal*View`s based on `target.kind`. That routing table is the
 * seam where "second entry point" bugs hide: a kind mapped to the wrong
 * view (or a new kind left unmapped) silently renders the wrong surface.
 *
 * These tests stub all five views (so the real BlockNote / chat-pane /
 * task-preview stacks stay out of the harness) and assert every
 * `ModalTarget.kind` reaches the intended view — with the four note kinds
 * called out explicitly, since that's the shared-URL family the
 * access-request flow lives in.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { UrlLinkModal } from "../components/modals/UrlLinkModal";
import type { ModalTarget } from "../utils/parseInternalUrl";

// Each stub echoes the kind it received so a mis-wire (right view, wrong
// target) would also surface.
vi.mock("../components/modals/views/ModalChatView", () => ({
    ModalChatView: ({ target }: { target: ModalTarget }) => (
        <div data-testid="view-chat">{target.kind}</div>
    ),
}));
vi.mock("../components/modals/views/ModalMilestoneView", () => ({
    ModalMilestoneView: ({ target }: { target: ModalTarget }) => (
        <div data-testid="view-milestone">{target.kind}</div>
    ),
}));
vi.mock("../components/modals/views/ModalNoteView", () => ({
    ModalNoteView: ({ target }: { target: ModalTarget }) => (
        <div data-testid="view-note">{target.kind}</div>
    ),
}));
vi.mock("../components/modals/views/ModalTaskView", () => ({
    ModalTaskView: ({ target }: { target: ModalTarget }) => (
        <div data-testid="view-task">{target.kind}</div>
    ),
}));
vi.mock("../components/modals/views/ModalTodoView", () => ({
    ModalTodoView: ({ target }: { target: ModalTarget }) => (
        <div data-testid="view-todo">{target.kind}</div>
    ),
}));

const baseProps = {
    onClose: vi.fn(),
    accessToken: "token",
    myself: { teamId: "team-1", userId: "u1" },
    setMyself: vi.fn(),
    socket: null,
    // Management states are only passed through to the (stubbed) views.
    useTEM: {},
    useUISM: {},
    useCM: {},
    useTM: {},
    usePM: {},
    useNM: {},
    useSM: {},
    useTG: {},
} as unknown as React.ComponentProps<typeof UrlLinkModal>;

const renderModal = (target: ModalTarget | null) =>
    render(
        <CssVarsProvider>
            <UrlLinkModal {...baseProps} target={target} />
        </CssVarsProvider>
    );

const ROUTES: Array<[string, ModalTarget, string]> = [
    ["chatMain", { kind: "chatMain", chatType: 1, chatId: 1 }, "view-chat"],
    ["chatThread", { kind: "chatThread", chatType: 1, chatId: 1, threadId: 2 }, "view-chat"],
    ["task", { kind: "task", projectId: 1, taskId: 2 }, "view-task"],
    ["milestone", { kind: "milestone", projectId: 1, milestoneId: 2 }, "view-milestone"],
    ["todo", { kind: "todo", localDate: "2026-07-13" }, "view-todo"],
    ["myNote", { kind: "myNote", noteId: 1 }, "view-note"],
    ["sharedNote", { kind: "sharedNote", noteId: 1 }, "view-note"],
    ["taskNote", { kind: "taskNote", projectId: 1, taskId: 2, noteId: 3 }, "view-note"],
    [
        "chatNote",
        { kind: "chatNote", chatType: 3, chatId: 1, threadId: 2, noteId: 3 },
        "view-note",
    ],
];

describe("UrlLinkModal view routing", () => {
    it.each(ROUTES)("routes kind=%s to its view", async (_name, target, testid) => {
        renderModal(target);
        const view = await screen.findByTestId(testid);
        expect(view).toBeInTheDocument();
        expect(view).toHaveTextContent(target.kind);
    });

    it("all four note kinds route to the single note view (shared-URL family)", async () => {
        const noteKinds: ModalTarget[] = [
            { kind: "myNote", noteId: 1 },
            { kind: "sharedNote", noteId: 1 },
            { kind: "taskNote", projectId: 1, taskId: 2, noteId: 3 },
            { kind: "chatNote", chatType: 3, chatId: 1, threadId: 2, noteId: 3 },
        ];
        for (const target of noteKinds) {
            const { unmount } = renderModal(target);
            expect(await screen.findByTestId("view-note")).toBeInTheDocument();
            unmount();
        }
    });

    it("renders no view when the target is null (modal closed)", () => {
        renderModal(null);
        for (const id of ["view-chat", "view-task", "view-milestone", "view-todo", "view-note"]) {
            expect(screen.queryByTestId(id)).toBeNull();
        }
    });
});
