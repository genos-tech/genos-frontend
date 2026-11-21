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
vi.mock("react-router-dom", async (importOriginal) => ({
    ...(await importOriginal<typeof import("react-router-dom")>()),
    useNavigate: () => navigateMock,
}));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));
vi.mock("../features/chat/hooks/useActivityStatus", () => ({
    useActivityStatus: () => ({ updateActivityReadStatus: vi.fn() }),
}));

afterEach(cleanup);
beforeEach(() => {
    navigateMock.mockClear();
    openModalByHrefMock.mockClear();
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
                <UrlLinkModalProvider value={{ openModalByHref: openModalByHrefMock }}>
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
});
