/**
 * MIP-1755: a task preview in a modal is shown over another page. Clicking a comment there must not
 * move that page to the task (on a task page the click writes the comment's address into the URL).
 * Copy link keeps working: the bubble still gets the comment's address.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { VirtuosoMockContext } from "react-virtuoso";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TaskCommentList } from "../features/tasks/components/contents/base/sub/TaskCommentList";
import type { TaskCommentProps } from "../types/tasks";

const navigateMock = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => ({
    ...(await importOriginal<typeof import("react-router-dom")>()),
    useNavigate: () => navigateMock,
}));
vi.mock("../features/tasks/components/contents/base/sub/TaskCommentBubble", () => ({
    TaskCommentBubble: (props: {
        comment: TaskCommentProps;
        commentLink?: string;
        onCommentClick?: (id: number) => void;
    }) => (
        <button
            data-link={props.commentLink}
            type="button"
            onClick={() => props.onCommentClick?.(props.comment.commentId)}
        >
            comment
        </button>
    ),
}));

afterEach(() => {
    cleanup();
    navigateMock.mockClear();
});

const comments = [{ commentId: 41, taskId: 7, senderId: "u", tsUpdated: "t" }] as never;

const renderList = (inModal: boolean) =>
    render(
        <CssVarsProvider>
            <MemoryRouter>
                <VirtuosoMockContext.Provider value={{ itemHeight: 40, viewportHeight: 400 }}>
                    <TaskCommentList
                        inModal={inModal}
                        myself={{ userId: "me" } as never}
                        setEditTargetComment={vi.fn()}
                        setIsInEdit={vi.fn()}
                        setMyself={vi.fn()}
                        socket={null}
                        taskComments={comments}
                        useCM={{} as never}
                        useTEM={{} as never}
                        useTM={{} as never}
                        useUISM={{} as never}
                        commentLinkBuilder={(id) =>
                            `/workspace/tasks/project/3/task/7/comment/${id}`
                        }
                    />
                </VirtuosoMockContext.Provider>
            </MemoryRouter>
        </CssVarsProvider>
    );

describe("a comment click in a task preview modal (MIP-1755)", () => {
    it("leaves the page behind alone and keeps the comment's address for Copy link", () => {
        renderList(true);

        const row = screen.getByRole("button", { name: "comment" });
        fireEvent.click(row);

        expect(navigateMock).not.toHaveBeenCalled();
        expect(row.getAttribute("data-link")).toBe("/workspace/tasks/project/3/task/7/comment/41");
    });

    it("on the task page the click still writes the comment into the URL", () => {
        renderList(false);

        fireEvent.click(screen.getByRole("button", { name: "comment" }));

        expect(navigateMock).toHaveBeenCalledWith("/workspace/tasks/project/3/task/7/comment/41");
    });
});
