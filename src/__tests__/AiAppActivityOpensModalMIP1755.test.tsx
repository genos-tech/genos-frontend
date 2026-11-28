/**
 * MIP-1755: a click on an "your AI app did X" row in the chat sidebar's Activity feed opens the
 * task or milestone in the chat's preview modal, the way a task-body mention does. It no longer
 * moves the user to the task or milestone page. A note opens in the note modal (MIP-1845), the
 * same surface a note link in a chat message opens, and a notice with no ids keeps the path it
 * always had.
 *
 * Also pinned: the row is reachable from the keyboard (Enter opens it), since it is a div-based row.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AiAppActivityRow } from "../features/chat/components/sidebar/activity/AiAppActivityRow";
import { parseAiAppNotice } from "../features/chat/utils/aiAppNotice";
import { UrlLinkModalProvider } from "../hooks/common/UrlLinkModalContext";
import type { ActivityMessageProps } from "../types/chat";

const navigateMock = vi.fn();
const openModalByHrefMock = vi.fn<(href: string, opts?: unknown) => "opened" | "navigated">(
    () => "opened"
);
const openTodoListMock = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => ({
    ...(await importOriginal<typeof import("react-router-dom")>()),
    useNavigate: () => navigateMock,
}));
vi.mock("../context/authState", () => ({ useAuth: () => ({ accessToken: "tok" }) }));
vi.mock("../features/chat/hooks/useActivityStatus", () => ({
    useActivityStatus: () => ({ updateActivityReadStatus: vi.fn() }),
}));

afterEach(cleanup);
beforeEach(() => {
    navigateMock.mockClear();
    openModalByHrefMock.mockClear();
    openTodoListMock.mockClear();
});

const myself = { userId: "me", userName: "Me", userEmail: "me@test", teamId: "t1" } as never;

/** An AI-app row as the feed holds it after `v3ActivityToLegacy` (the notice already parsed). */
const row = (meta: Record<string, unknown>) =>
    ({
        activityId: "act-1",
        tsSent: "2026-11-21T10:00:00Z",
        isRead: false,
        aiApp: parseAiAppNotice({ aiApp: true, app: "Claude Code", ...meta }),
    }) as unknown as ActivityMessageProps;

const renderRow = (activity: ActivityMessageProps) => {
    render(
        <CssVarsProvider>
            <MemoryRouter>
                <UrlLinkModalProvider
                    value={{
                        openModalByHref: openModalByHrefMock,
                        openTodoList: openTodoListMock,
                    }}
                >
                    <AiAppActivityRow
                        activity={activity}
                        activityMessages={[activity]}
                        myself={myself}
                        selectedActivityId=""
                        setSelectedActivityId={vi.fn()}
                        useCM={{} as never}
                    />
                </UrlLinkModalProvider>
            </MemoryRouter>
        </CssVarsProvider>
    );
};

const rowButton = () => screen.getByRole("button", { name: /Claude Code/ });

describe("AI-app activity row opens the item in the chat modal (MIP-1755)", () => {
    it("a created task opens in the chat's task modal, not the side pane, and the URL stays on the chat", async () => {
        const url = "/workspace/tasks/project/3/task/7";
        renderRow(
            row({
                verb: "created",
                kind: "task",
                count: 1,
                url,
                items: [
                    {
                        kind: "task",
                        id: 7,
                        taskId: 7,
                        projectId: 3,
                        displayId: "MIP-7",
                        title: "Fix login",
                        url,
                    },
                ],
            })
        );

        fireEvent.click(rowButton());
        await act(async () => {});

        expect(navigateMock).not.toHaveBeenCalled();
        expect(openModalByHrefMock).toHaveBeenCalledWith(url, { fullPageHref: url });
    });

    it("Enter on the focused row opens the task modal the same way (keyboard access)", async () => {
        const url = "/workspace/tasks/project/3/task/7";
        renderRow(
            row({
                verb: "created",
                kind: "task",
                count: 1,
                url,
                items: [{ kind: "task", id: 7, taskId: 7, projectId: 3, title: "Fix login" }],
            })
        );

        rowButton().focus();
        fireEvent.keyDown(rowButton(), { key: "Enter" });
        await act(async () => {});

        expect(navigateMock).not.toHaveBeenCalled();
        expect(openModalByHrefMock).toHaveBeenCalledWith(url, { fullPageHref: url });
    });

    it("a milestone opens in the milestone modal, not the side pane or its page", () => {
        const url = "/workspace/tasks/project/3/milestone/9";
        renderRow(
            row({
                verb: "created",
                kind: "milestone",
                count: 1,
                url,
                items: [{ kind: "milestone", id: 9, projectId: 3, title: "Launch", url }],
            })
        );

        fireEvent.click(rowButton());

        expect(navigateMock).not.toHaveBeenCalled();
        expect(openModalByHrefMock).toHaveBeenCalledWith(url, { fullPageHref: url });
    });

    it("Enter on a milestone row opens the milestone modal (keyboard access)", () => {
        const url = "/workspace/tasks/project/3/milestone/9";
        renderRow(
            row({
                verb: "created",
                kind: "milestone",
                count: 1,
                url,
                items: [{ kind: "milestone", id: 9, projectId: 3, title: "Launch" }],
            })
        );

        rowButton().focus();
        fireEvent.keyDown(rowButton(), { key: "Enter" });

        expect(navigateMock).not.toHaveBeenCalled();
        expect(openModalByHrefMock).toHaveBeenCalledWith(url, { fullPageHref: url });
    });

    it("a personal note opens in the note modal in place (MIP-1845), the URL stays on the chat", () => {
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

        expect(navigateMock).not.toHaveBeenCalled();
        expect(openModalByHrefMock).toHaveBeenCalledWith("/workspace/notes/my/5", {
            fullPageHref: "/workspace/notes/my/5",
        });
    });

    it("a task note opens in the note modal too (MIP-1845)", () => {
        const url = "/workspace/notes/task/project/3/task/7/note/9";
        renderRow(
            row({
                verb: "edited",
                kind: "note",
                count: 1,
                url,
                items: [{ kind: "note", id: 9, taskId: 7, projectId: 3, title: "Spec", url }],
            })
        );

        fireEvent.click(rowButton());

        expect(navigateMock).not.toHaveBeenCalled();
        expect(openModalByHrefMock).toHaveBeenCalledWith(url, { fullPageHref: url });
    });

    it("Enter on a note row opens the note modal (keyboard access, MIP-1845)", () => {
        renderRow(
            row({
                verb: "created",
                kind: "note",
                count: 1,
                url: "/workspace/notes/my/5",
                items: [{ kind: "note", id: 5, title: "Plan", url: "/workspace/notes/my/5" }],
            })
        );

        rowButton().focus();
        fireEvent.keyDown(rowButton(), { key: "Enter" });

        expect(navigateMock).not.toHaveBeenCalled();
        expect(openModalByHrefMock).toHaveBeenCalledTimes(1);
    });

    it("the modal hook owns the outcome: the row does not navigate a second time", () => {
        // The hook navigates itself for a route it cannot preview; the row must not add a second one.
        openModalByHrefMock.mockReturnValueOnce("navigated");
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

        expect(openModalByHrefMock).toHaveBeenCalledTimes(1);
        expect(navigateMock).not.toHaveBeenCalled();
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
    });

    it("a deleted milestone opens no modal: its page is gone (MIP-1923)", () => {
        renderRow(
            row({
                verb: "deleted",
                kind: "milestone",
                count: 1,
                url: "",
                items: [{ kind: "milestone", id: 5, projectId: 1, title: "Old", url: "" }],
            })
        );

        fireEvent.click(rowButton());

        expect(openModalByHrefMock).not.toHaveBeenCalled();
        expect(navigateMock).not.toHaveBeenCalled();
    });

    it("a task comment opens its task modal at that comment, by Enter too", () => {
        // What `mcp_notice._comment` files: a task item of kind "comment", id = the comment.
        const href = "/workspace/tasks/project/3/task/7/comment/41";
        const meta = {
            verb: "commented",
            kind: "comment",
            count: 1,
            url: href,
            items: [{ kind: "comment", id: 41, commentId: 41, taskId: 7, projectId: 3 }],
        };
        renderRow(row(meta));

        fireEvent.click(rowButton());
        rowButton().focus();
        fireEvent.keyDown(rowButton(), { key: "Enter" });

        expect(navigateMock).not.toHaveBeenCalled();
        expect(openModalByHrefMock.mock.calls).toEqual([
            [href, { fullPageHref: href }],
            [href, { fullPageHref: href }],
        ]);
    });

    it("a deleted comment opens the task it was on", () => {
        const href = "/workspace/tasks/project/3/task/7";
        renderRow(
            row({
                verb: "deleted",
                kind: "comment",
                count: 1,
                url: href,
                items: [{ kind: "comment", id: 41, taskId: 7, projectId: 3, url: href }],
            })
        );

        fireEvent.click(rowButton());

        expect(navigateMock).not.toHaveBeenCalled();
        expect(openModalByHrefMock).toHaveBeenCalledWith(href, { fullPageHref: href });
    });

    it("a comment on a note opens the note modal on its thread", () => {
        const url = "/workspace/notes/my/5?comment=th-1";
        renderRow(
            row({
                verb: "commented",
                kind: "note",
                count: 1,
                url,
                items: [{ kind: "note", id: 5, title: "Plan", url }],
            })
        );

        fireEvent.click(rowButton());

        expect(openModalByHrefMock).toHaveBeenCalledWith(url, { fullPageHref: url });
    });

    it("a new to-do opens the to-do modal on its day and item, with no page button", () => {
        const url = "/workspace/todo/2026-11-30/item/12";
        renderRow(
            row({
                verb: "created",
                kind: "todo",
                count: 1,
                url,
                items: [{ kind: "todo", id: 12, title: "Call", localDate: "2026-11-30", url }],
            })
        );

        fireEvent.click(rowButton());

        expect(navigateMock).not.toHaveBeenCalled();
        expect(openModalByHrefMock).toHaveBeenCalledWith(url, undefined);
    });

    it.each(["created", "deleted"])(
        "a %s to-do with no day opens the whole to-do list",
        (verb) => {
            renderRow(
                row({
                    verb,
                    kind: "todo",
                    count: 1,
                    url: "/workspace/todo",
                    items: [{ kind: "todo", id: 12, title: "Call", url: "/workspace/todo" }],
                })
            );

            fireEvent.click(rowButton());

            expect(openTodoListMock).toHaveBeenCalledTimes(1);
            expect(navigateMock).not.toHaveBeenCalled();
        }
    );

    it("a project member change keeps its page: the modal has no project view", () => {
        const url = "/workspace/tasks/project/3";
        renderRow(
            row({
                verb: "members",
                kind: "project",
                count: 1,
                action: "add",
                url,
                items: [{ kind: "project", id: 3, projectId: 3, title: "QR", url }],
            })
        );

        fireEvent.click(rowButton());

        expect(openModalByHrefMock).not.toHaveBeenCalled();
        expect(navigateMock).toHaveBeenCalledWith(url);
    });
});
