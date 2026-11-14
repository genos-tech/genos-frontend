/**
 * MIP-1376: a change made through a connected AI app (MCP) or an API key is
 * marked with a chip, on the history rows and on the comment cards.
 *
 * Each surface is tested in both states (with and without `via`), for the owner
 * and for a colleague. What must hold on every one: the person's avatar and name
 * stay (nothing is removed), the web app's own edits are NOT marked, and the NAME
 * of a key or app reaches only its owner, anywhere in the rendered output.
 */
import type { ReactNode } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ViaChip } from "../components/ui/misc/ViaChip";
import { TaskActivityFeed } from "../features/tasks/components/contents/base/sub/TaskActivityFeed";
import { TaskCommentList } from "../features/tasks/components/contents/base/sub/TaskCommentList";
import type { ChatManagementState } from "../hooks/chats/useChatManagement";
import type { TeamManagementState } from "../hooks/common/useTeamManagement";
import type { UIStateManagementState } from "../hooks/common/useUIStateManagement";
import type { TaskManagementState } from "../hooks/tasks/useTaskManagement";
import type { UserProps } from "../types/admin";
import type { TaskActivityProps, TaskCommentProps } from "../types/tasks";

vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));
vi.mock("../services/api", () => ({ authApi: vi.fn() }));
vi.mock("../components/ui/avatars/avatarWithStatus", () => ({
    AvatarWithStatus: () => <span data-testid="avatar" />,
}));
vi.mock("../components/ui/avatars/UserAvatar", () => ({
    UserAvatar: () => <span data-testid="avatar" />,
}));
vi.mock("../components/messageBody/MessageBody", () => ({
    MessageBody: () => <div data-testid="message-body" />,
}));
vi.mock("../components/ui/emoji/ReactionTaskCommentEmojiDisplay", () => ({
    ReactionTaskCommentEmojiDisplay: () => null,
}));
vi.mock("../components/ui/emoji/TaskCommentEmojiReaction", () => ({
    TaskCommentEmojiReaction: () => null,
}));
vi.mock("../components/ui/emoji/EmojiPicker", () => ({ EmojiPicker: () => null }));
// Virtuoso measures real layout, which jsdom has none of: render every row.
vi.mock("react-virtuoso", () => ({
    Virtuoso: ({
        totalCount,
        itemContent,
    }: {
        totalCount: number;
        itemContent: (i: number) => ReactNode;
    }) => (
        <div>
            {Array.from({ length: totalCount }, (_, i) => (
                <div key={i}>{itemContent(i)}</div>
            ))}
        </div>
    ),
}));

afterEach(cleanup);

const KEY = {
    kind: "api_key",
    key_id: "key-7b2e",
    key_name: "my-laptop-claude",
    key_prefix: "gk_ab",
};
const APP = { kind: "oauth", connection_id: "conn-9f3a", client_name: "Claude Desktop" };
const SECRETS = ["my-laptop-claude", "gk_ab", "Claude Desktop", "key-7b2e", "conn-9f3a"];

const me = { userId: "u1", teamId: "t1" } as UserProps;
const colleague = { userId: "u2", teamId: "t1" } as UserProps;

const act = (over: Partial<TaskActivityProps> = {}): TaskActivityProps => ({
    activityId: 1,
    actionType: "status_changed",
    fieldName: "status",
    oldValue: "Open",
    newValue: "WIP",
    metadata: { via: { kind: "app" } },
    actor: { userId: "u1", userName: "Ken", avatarImgPath: null },
    tsCreatedAt: new Date().toISOString(),
    ...over,
});

const renderFeed = (activities: TaskActivityProps[], viewer: UserProps = me) =>
    render(
        <CssVarsProvider>
            <TaskActivityFeed
                activities={activities}
                allTasks={[]}
                isLoading={false}
                loadFailed={false}
                myself={viewer}
                setMyself={() => {}}
                socket={null}
                taskId={42}
                useCM={{} as never}
                useTEM={{ teamMemberProfiles: {} } as never}
                useUISM={{} as never}
                onRetry={() => {}}
            />
        </CssVarsProvider>
    );

/** Everything a reader could see or hear of the page, tooltips included. */
const everything = (container: HTMLElement) =>
    `${container.textContent ?? ""}\n${Array.from(container.querySelectorAll("*"))
        .flatMap((el) => Array.from(el.attributes).map((a) => a.value))
        .join("\n")}`;

describe("ViaChip", () => {
    it("says via MCP for an app and via API key for a key, in words", () => {
        render(
            <CssVarsProvider>
                <ViaChip source={{ kind: "mcp", name: null, app: null }} />
                <ViaChip source={{ kind: "apiKey", name: null, app: null }} />
            </CssVarsProvider>
        );
        expect(screen.getByText("via MCP")).toBeInTheDocument();
        expect(screen.getByText("via API key")).toBeInTheDocument();
    });

    it("puts the name in its explanation only when it is given one", () => {
        const { container, rerender } = render(
            <CssVarsProvider>
                <ViaChip source={{ kind: "apiKey", name: null, app: null }} />
            </CssVarsProvider>
        );
        expect(everything(container)).not.toContain("my-laptop-claude");
        rerender(
            <CssVarsProvider>
                <ViaChip source={{ kind: "apiKey", name: "my-laptop-claude", app: null }} />
            </CssVarsProvider>
        );
        expect(screen.getByLabelText(/my-laptop-claude/)).toBeInTheDocument();
    });
});

describe("history rows (the task's Activity tab, the PM thread's Activities tab)", () => {
    it("a change made through a connected app carries the via MCP chip, avatar and name kept", () => {
        renderFeed([act({ metadata: { via: APP } })]);
        expect(screen.getByText("via MCP")).toBeInTheDocument();
        expect(screen.getByTestId("avatar")).toBeInTheDocument();
        expect(screen.getByText("Ken")).toBeInTheDocument();
        expect(screen.getByText("changed status from")).toBeInTheDocument();
    });

    it("MIP-1568: a recognised app shows its own mark instead of the words, for the owner and a colleague, never the name", () => {
        const claude = { ...APP, app: "claude" };
        const { container, unmount } = renderFeed(
            [act({ activityId: 1, metadata: { via: claude } })],
            colleague
        );
        expect(screen.getByRole("img", { name: "via Claude" })).toBeInTheDocument();
        expect(screen.queryByText("via MCP")).toBeNull();
        for (const secret of SECRETS) expect(everything(container), secret).not.toContain(secret);
        expect(screen.getByText("Ken")).toBeInTheDocument();
        unmount();

        renderFeed([act({ activityId: 1, metadata: { via: { ...APP, app: "chatgpt" } } })], me);
        expect(screen.getByRole("img", { name: "via ChatGPT" })).toBeInTheDocument();
    });

    it("MIP-1568: a family this build does not know, or none, keeps the generic chip", () => {
        renderFeed([
            act({ activityId: 1, metadata: { via: { ...APP, app: "gemini" } } }),
            act({ activityId: 2, metadata: { via: { ...APP, app: "Claude " } } }),
            act({ activityId: 3, metadata: { via: APP } }),
        ]);
        expect(screen.getAllByText("via MCP")).toHaveLength(3);
        expect(screen.queryByRole("img")).toBeNull();
    });

    it("a change made with an API key carries the via API key chip", () => {
        renderFeed([act({ metadata: { via: KEY } })]);
        expect(screen.getByText("via API key")).toBeInTheDocument();
    });

    it("the same rows without via: the web app's own edit, the Genos AI, nothing stamped, are NOT marked", () => {
        renderFeed([
            act({ activityId: 1, metadata: { via: { kind: "app" } } }),
            act({ activityId: 2, metadata: { via: { kind: "app", undo_of: { run_id: "r" } } } }),
            act({ activityId: 3, metadata: { via: { kind: "agent" } } }),
            act({ activityId: 4, metadata: {} }),
        ]);
        expect(screen.queryByText("via MCP")).toBeNull();
        expect(screen.queryByText("via API key")).toBeNull();
        expect(screen.getAllByTestId("avatar")).toHaveLength(4);
    });

    it("marks only the rows that came through an app, among others", () => {
        renderFeed([
            act({ activityId: 1, metadata: { via: APP } }),
            act({ activityId: 2, metadata: { via: { kind: "app" } } }),
            act({ activityId: 3, metadata: { via: KEY } }),
        ]);
        expect(screen.getAllByText(/^via /)).toHaveLength(2);
    });

    it("the owner can read the name of their key, in the chip's explanation", () => {
        renderFeed([act({ metadata: { via: KEY } })], me);
        expect(screen.getByLabelText(/my-laptop-claude/)).toBeInTheDocument();
    });

    it("a colleague sees the kind and NONE of the key's or app's identity, anywhere on the page", () => {
        const { container } = renderFeed(
            [
                act({ activityId: 1, metadata: { via: KEY } }),
                act({ activityId: 2, metadata: { via: APP } }),
            ],
            colleague
        );
        expect(screen.getByText("via API key")).toBeInTheDocument();
        expect(screen.getByText("via MCP")).toBeInTheDocument();
        const page = everything(container);
        for (const secret of SECRETS) expect(page, secret).not.toContain(secret);
    });

    it("the Restore line no longer names the key to a colleague, and still does to its owner", () => {
        const rewrite = act({
            actionType: "description_edited",
            fieldName: "content",
            metadata: { previousBodyKept: true, via: KEY },
        });
        const { container, unmount } = renderFeed([rewrite], colleague);
        expect(screen.getByText("Rewritten through the API")).toBeInTheDocument();
        for (const secret of SECRETS) expect(everything(container), secret).not.toContain(secret);
        unmount();

        renderFeed([rewrite], me);
        expect(
            screen.getByText(/Rewritten through the API \(my-laptop-claude\)/)
        ).toBeInTheDocument();
    });
});

describe("comment cards (MIP-1508: the chip comes from the comment's own `via`)", () => {
    const comment = (
        commentId: number,
        via?: Record<string, unknown> | null,
        senderId = "u1"
    ): TaskCommentProps => ({
        projectId: 7,
        taskId: 42,
        senderId,
        senderName: senderId === "u1" ? "Ken" : "Aki",
        commentId,
        commentBody: [{ type: "paragraph", content: [{ type: "text", text: `c${commentId}` }] }],
        tsSent: "2026-07-17T00:00:00Z",
        tsUpdated: "2026-07-17T00:00:00Z",
        isEdited: false,
        ...(via === undefined ? {} : { via }),
    });

    const list = (comments: TaskCommentProps[], viewer: UserProps = me) => (
        <CssVarsProvider>
            <MemoryRouter>
                <TaskCommentList
                    currentProjectId={3}
                    currentProjectName="Proj"
                    currentTaskDisplayId="PRJ-42"
                    myself={viewer}
                    setEditTargetComment={vi.fn()}
                    setIsInEdit={vi.fn()}
                    setMyself={vi.fn()}
                    socket={null}
                    taskComments={comments}
                    useCM={{} as unknown as ChatManagementState}
                    useTEM={{} as unknown as TeamManagementState}
                    useTM={{} as unknown as TaskManagementState}
                    useUISM={{} as unknown as UIStateManagementState}
                />
            </MemoryRouter>
        </CssVarsProvider>
    );
    const renderList = (comments: TaskCommentProps[], viewer: UserProps = me) =>
        render(list(comments, viewer));

    it("MIP-1568: a comment from a recognised app carries its mark, and a colleague sees no name", () => {
        const { container } = renderList(
            [comment(1, { ...APP, app: "claude" }), comment(2, { kind: "app" })],
            colleague
        );
        expect(screen.getAllByRole("img", { name: "via Claude" })).toHaveLength(1);
        expect(screen.queryByText("via MCP")).toBeNull();
        for (const secret of SECRETS) expect(everything(container), secret).not.toContain(secret);
    });

    it("a comment an app wrote carries the chip, the one typed in Genos does not, avatars kept", () => {
        renderList([comment(1, APP), comment(2, { kind: "app" })]);
        expect(screen.getAllByText("via MCP")).toHaveLength(1);
        expect(screen.getAllByTestId("avatar")).toHaveLength(2);
        expect(screen.getAllByText("Ken")).toHaveLength(2);
        // The chip is on the card of comment 1, not comment 2.
        const rows = document.querySelectorAll(".comment-row");
        expect(rows[0].textContent).toContain("via MCP");
        expect(rows[1].textContent).not.toContain("via MCP");
    });

    it("needs no history: the chip shows with the activity feed never loaded (an old comment)", () => {
        // This is the MIP-1508 fix: the list answers by itself, so a comment older
        // than the newest 100 feed rows is marked like any other.
        renderList([comment(1, KEY)]);
        expect(screen.getByText("via API key")).toBeInTheDocument();
    });

    it("no `via` (older API, comment just made) or a null one means no chip, and nothing breaks", () => {
        renderList([comment(1), comment(2, null), comment(3, {})]);
        expect(screen.queryByText(/^via /)).toBeNull();
        expect(screen.getAllByTestId("avatar")).toHaveLength(3);
    });

    it("a comment by a colleague's key arrives as the kind only and shows it, no name", () => {
        // What api #758/#760 send a non-owner: `{ kind: "api_key" }`.
        const { container } = renderList([comment(1, { kind: "api_key" }, "u2")], me);
        expect(screen.getByText("via API key")).toBeInTheDocument();
        for (const secret of SECRETS) expect(everything(container), secret).not.toContain(secret);
    });

    it("the owner's own comment arrives whole and keeps the name in the explanation", () => {
        renderList([comment(1, KEY)], me);
        expect(screen.getByLabelText(/my-laptop-claude/)).toBeInTheDocument();
    });

    it("a re-read list updates the chip (a comment an app has just rewritten)", () => {
        const { rerender } = renderList([comment(1, { kind: "app" })]);
        expect(screen.queryByText("via MCP")).toBeNull();
        rerender(list([{ ...comment(1, APP), tsUpdated: "2026-07-17T00:05:00Z" }]));
        expect(screen.getByText("via MCP")).toBeInTheDocument();
    });
});
