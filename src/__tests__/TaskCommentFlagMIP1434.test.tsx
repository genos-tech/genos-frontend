/**
 * Flag for later / Mark done on a task comment (MIP-1434, part B).
 *
 * A task comment is also written as a v3 `Message` (its mirror, a thread reply under the PM task
 * header), and the comment's flag is the flag on THAT message. So:
 *   - the comment's "…" menu has Flag for later / Remove flag when the list gave it a mirror id,
 *     and Mark done takes the flag's toolbar slot while it is flagged (the MIP-1423 rule);
 *   - the pins apply to a comment, so a pinned Flag is on the toolbar, not in the menu;
 *   - the Flagged list can draw the row: an active flag whose message is not loaded is back-filled
 *     by id (a thread reply is not until its thread opens); the row says "Task comment", and
 *     opens the task's thread at that comment.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { v3FlagsToLegacy } from "../features/chat/adapters/v3ToLegacy";
import { ChatListItemForFlagMessages } from "../features/chat/components/sidebar/chatListItemForFlagMessages";
import { TaskCommentBubble } from "../features/tasks/components/contents/base/sub/TaskCommentBubble";
import { BubbleActionsPreferenceProvider } from "../hooks/common/useBubbleActionsPreference";
import { DoubleClickTodoPreferenceProvider } from "../hooks/common/useDoubleClickTodoPreference";
import { en } from "../i18n/locales/en";
import { ChannelKind, type Channel, type Flag, type Message } from "../types/channel";
import { TaskCommentProps } from "../types/tasks";

// ---- a fake channelService the bubble and the row can subscribe to ---------------------------
const service = vi.hoisted(() => {
    const listeners = new Set<() => void>();
    const flags = new Map<string, unknown>();
    let snapshot = { flagByMessageId: flags as ReadonlyMap<string, unknown> };
    return {
        flags,
        listeners,
        flagMessage: vi.fn().mockResolvedValue(undefined),
        unflagMessage: vi.fn().mockResolvedValue(undefined),
        completeFlag: vi.fn().mockResolvedValue(undefined),
        reopenFlag: vi.fn().mockResolvedValue(undefined),
        subscribe: (l: () => void) => {
            listeners.add(l);
            return () => listeners.delete(l);
        },
        getSnapshot: () => snapshot,
        setFlagged(messageId: string, on: boolean) {
            if (on) flags.set(messageId, { id: `f-${messageId}`, messageId });
            else flags.delete(messageId);
            snapshot = { flagByMessageId: flags };
            listeners.forEach((l) => l());
        },
    };
});
vi.mock("../services/channel/channelService", () => ({ channelService: service }));
vi.mock("../features/chat/hooks/useMessageReminder", () => ({ useMessageReminder: () => null }));
vi.mock("../components/messageBody/MessageBody", () => ({ MessageBody: () => <div /> }));
vi.mock("../components/ui/emoji/ReactionTaskCommentEmojiDisplay", () => ({
    ReactionTaskCommentEmojiDisplay: () => <div />,
}));
vi.mock("../components/ui/emoji/TaskCommentEmojiReaction", () => ({
    TaskCommentEmojiReaction: () => <div />,
}));
vi.mock("../components/ui/emoji/EmojiPicker", () => ({ EmojiPicker: () => null }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));
vi.mock("../components/ui/avatars/UserAvatar", () => ({ UserAvatar: () => <div /> }));
vi.mock("../components/ui/avatars/avatarWithStatus", () => ({ AvatarWithStatus: () => null }));
vi.mock("../components/ui/avatars/GMAvatar", () => ({ GMAvatar: () => null }));
vi.mock("../components/ui/avatars/MDMAvatar", () => ({ MDMAvatar: () => null }));
vi.mock("../components/ui/avatars/ProjectAvatar", () => ({ ProjectAvatar: () => null }));

const MIRROR = "1f23d65f-3379-5e81-985f-04a54d143ddb";
const FLAG_LABEL = en.chat.messageActions.flagForLater;
const REMOVE_FLAG = en.chat.messageActions.removeFlag;
const MARK_DONE = en.chat.listItem.completeFlag;

const comment = (over: Partial<TaskCommentProps> = {}): TaskCommentProps => ({
    projectId: 7,
    taskId: 42,
    senderId: "u2",
    senderName: "Other",
    commentId: 3,
    commentBody: [{ type: "paragraph", content: [{ type: "text", text: "read me later" }] }],
    messageId: MIRROR,
    tsSent: "2026-07-17T00:00:00Z",
    tsUpdated: "2026-07-17T00:00:00Z",
    isEdited: false,
    ...over,
});

const mountBubble = (c: TaskCommentProps) =>
    render(
        <CssVarsProvider>
            <BubbleActionsPreferenceProvider>
                <DoubleClickTodoPreferenceProvider>
                    <TaskCommentBubble
                        comment={c}
                        currentProjectId={7}
                        myself={{ userId: "u1", teamId: "t1" } as never}
                        setEditTargetComment={vi.fn()}
                        setIsInEdit={vi.fn()}
                        setMyself={vi.fn()}
                        socket={null}
                        useCM={{} as never}
                        useTEM={{} as never}
                        useUISM={{} as never}
                    />
                </DoubleClickTodoPreferenceProvider>
            </BubbleActionsPreferenceProvider>
        </CssVarsProvider>
    );

const pin = (...ids: string[]) =>
    window.localStorage.setItem("genos-bubble-pinned-actions-v1", JSON.stringify(ids));
const hover = (container: HTMLElement) => {
    const root = container.firstElementChild;
    if (root) fireEvent.mouseEnter(root);
};
const toolbar = () =>
    screen
        .getAllByRole("button")
        .map((b) => b.getAttribute("aria-label"))
        .filter(Boolean);
const menuLabels = (container: HTMLElement) => {
    hover(container);
    fireEvent.click(screen.getByLabelText("More options"));
    return screen.getAllByRole("menuitem").map((el) => el.textContent);
};

beforeEach(() => {
    window.localStorage.clear();
    service.flags.clear();
    service.setFlagged("x", true);
    service.setFlagged("x", false);
    vi.clearAllMocks();
});
afterEach(cleanup);

describe("the task comment's … menu", () => {
    it("offers Flag for later when the comment has a mirror message", () => {
        const { container } = mountBubble(comment());
        expect(menuLabels(container)).toContain(FLAG_LABEL);
    });

    it("offers nothing to flag when it has none (a comment just made, or a missing mirror)", () => {
        for (const messageId of [undefined, null]) {
            const { container, unmount } = mountBubble(comment({ messageId }));
            const labels = menuLabels(container);
            expect(labels).not.toContain(FLAG_LABEL);
            expect(labels).not.toContain(REMOVE_FLAG);
            unmount();
        }
    });

    it("flags the MIRROR message", () => {
        const { container } = mountBubble(comment());
        hover(container);
        fireEvent.click(screen.getByLabelText("More options"));
        fireEvent.click(screen.getByText(FLAG_LABEL));
        expect(service.flagMessage).toHaveBeenCalledWith(MIRROR);
        expect(service.unflagMessage).not.toHaveBeenCalled();
    });

    it("says Remove flag once flagged, and unflags the mirror", () => {
        service.setFlagged(MIRROR, true);
        const { container } = mountBubble(comment());
        hover(container);
        fireEvent.click(screen.getByLabelText("More options"));
        expect(screen.queryByText(FLAG_LABEL)).toBeNull();
        fireEvent.click(screen.getByText(REMOVE_FLAG));
        expect(service.unflagMessage).toHaveBeenCalledWith(MIRROR);
    });

    it("follows the flag live (another tab flags it)", () => {
        const { container } = mountBubble(comment());
        expect(menuLabels(container)).toContain(FLAG_LABEL);
        cleanup();
        service.setFlagged(MIRROR, true);
        const second = mountBubble(comment());
        expect(menuLabels(second.container)).toContain(REMOVE_FLAG);
    });

    it("sits with the reminder side, a rule above Add to To-Do: the two intents stay apart", () => {
        const { container } = mountBubble(comment());
        hover(container);
        fireEvent.click(screen.getByLabelText("More options"));
        const flag = screen.getAllByRole("menuitem").find((el) => el.textContent === FLAG_LABEL)!;
        const todo = screen
            .getAllByRole("menuitem")
            .find((el) => el.textContent === en.chat.messageActions.addToTodo)!;
        expect(flag.querySelector('[data-testid="FlagRoundedIcon"]')).not.toBeNull();
        expect(todo.querySelector('[data-testid="ChecklistRoundedIcon"]')).not.toBeNull();
        expect(todo.previousElementSibling?.getAttribute("role")).toBe("separator");
    });
});

describe("Mark done on the toolbar", () => {
    it("shows while the comment is flagged, whatever was pinned, and finishes the flag", () => {
        service.setFlagged(MIRROR, true);
        const { container } = mountBubble(comment());
        hover(container);
        expect(toolbar()).toContain(MARK_DONE);
        fireEvent.click(screen.getByRole("button", { name: MARK_DONE }));
        expect(service.completeFlag).toHaveBeenCalledWith(MIRROR);
        expect(service.unflagMessage).not.toHaveBeenCalled();
    });

    it("is not there when the comment is not flagged", () => {
        const { container } = mountBubble(comment());
        hover(container);
        expect(toolbar()).not.toContain(MARK_DONE);
    });

    it("takes the pinned flag's place, never both, and Remove flag stays in the menu", () => {
        pin("flag");
        service.setFlagged(MIRROR, true);
        const { container } = mountBubble(comment());
        hover(container);
        expect(toolbar()).toContain(MARK_DONE);
        expect(toolbar()).not.toContain(REMOVE_FLAG);
        fireEvent.click(screen.getByLabelText("More options"));
        expect(screen.getAllByRole("menuitem").map((el) => el.textContent)).toContain(REMOVE_FLAG);
    });
});

describe("the pins apply to a comment", () => {
    it("a pinned Flag is on the toolbar and out of the menu", () => {
        pin("flag");
        const { container } = mountBubble(comment());
        hover(container);
        expect(screen.getByRole("button", { name: FLAG_LABEL })).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: FLAG_LABEL }));
        expect(service.flagMessage).toHaveBeenCalledWith(MIRROR);
        fireEvent.click(screen.getByLabelText("More options"));
        expect(screen.getAllByRole("menuitem").map((el) => el.textContent)).not.toContain(
            FLAG_LABEL
        );
    });

    it("a pinned Flag on a comment without a mirror shows nothing (no dead button)", () => {
        pin("flag");
        const { container } = mountBubble(comment({ messageId: null }));
        hover(container);
        expect(toolbar()).not.toContain(FLAG_LABEL);
    });
});

// ---- the Flagged list ------------------------------------------------------------------------
const channel = (over: Partial<Channel> = {}): Channel => ({
    id: "ch-pm",
    kind: ChannelKind.PM,
    title: "Q4 Roadmap",
    profileImageUrl: "",
    projectId: 7,
    legacyChatId: null,
    ownerId: null,
    isPrivate: false,
    latestMessage: null,
    unreadCount: 0,
    tsCreated: "2026-01-01T00:00:00Z",
    tsUpdated: "2026-01-01T00:00:00Z",
    ...over,
});
const message = (over: Partial<Message> = {}): Message =>
    ({
        id: MIRROR,
        channelId: "ch-pm",
        channelKind: ChannelKind.PM,
        sender: {
            userId: "u2",
            userName: "Other",
            userEmail: "",
            avatarImgPath: null,
            isSystemUser: false,
        },
        seq: 1,
        body: [],
        bodyText: "read me later",
        parentId: "header-uuid",
        threadRootId: "header-uuid",
        isThreadReply: true,
        replyCount: 0,
        reactions: [],
        mentions: [],
        attachments: [],
        metadata: { taskCommentId: 3 },
        taskId: 42,
        editedAt: null,
        deletedAt: null,
        tsSent: "2026-01-01T00:00:01Z",
        tsUpdated: "2026-01-01T00:00:01Z",
        ...over,
    }) as Message;

const derive = (msg: Message, ch: Channel = channel()) =>
    v3FlagsToLegacy({
        flags: new Map<string, Flag>([["f1", { id: "f1", messageId: msg.id, tsCreated: "t" }]]),
        channels: new Map([[ch.id, ch]]),
        membersByChannel: new Map(),
        messagesByChannel: new Map([[ch.id, [msg]]]),
        currentUserId: "u1",
    });

describe("the Flagged list adapter", () => {
    it("tags a PM thread reply that mirrors a task comment with the comment's id", () => {
        const [row] = derive(message());
        expect(row.taskCommentId).toBe(3);
        expect(row.taskId).toBe(42);
    });

    it("does not tag a top-level PM message, a DM reply, or a reply with no comment id", () => {
        expect(
            derive(message({ isThreadReply: false, parentId: null }))[0].taskCommentId
        ).toBeUndefined();
        expect(
            derive(message({ channelKind: ChannelKind.DM }), channel({ kind: ChannelKind.DM }))[0]
                .taskCommentId
        ).toBeUndefined();
        expect(derive(message({ metadata: {} }))[0].taskCommentId).toBeUndefined();
    });
});

const Where = () => {
    const loc = useLocation();
    return <div data-testid="where">{loc.pathname}</div>;
};
const mountRow = (flagged: Record<string, unknown>) =>
    render(
        <MemoryRouter>
            <CssVarsProvider>
                <ChatListItemForFlagMessages
                    flaggedMessage={flagged as never}
                    myself={{ userId: "me" } as never}
                    selectedFlaggedMessageId=""
                    setCurrentProject={() => {}}
                    setMyself={() => {}}
                    setSelectedFlaggedMessageId={() => {}}
                    socket={null}
                    useTEM={{} as never}
                    useTM={{} as never}
                    useUISM={{} as never}
                    viewMode="active"
                    useCM={
                        {
                            allChats: [
                                { chatId: "ch-pm", chatType: 3, project: { projectId: 7 } },
                            ],
                            setNotMoveChatPaneType: vi.fn(),
                        } as never
                    }
                />
            </CssVarsProvider>
            <Where />
        </MemoryRouter>
    );
const COMMENT_ROW = {
    flaggedMessageId: "f1",
    chatType: 3,
    chatName: "Q4 Roadmap",
    chatId: "ch-pm",
    threadId: "header-uuid",
    messageId: MIRROR,
    contentText: "read me later",
    sender: { userId: "u2", userName: "Other" },
    dmPartnerUser: { userId: "", userName: "" },
    project: { projectId: 7, projectName: "Q4 Roadmap" },
    taskId: 42,
    displayId: "QR-16",
    taskCommentId: 3,
    tsSent: "2026-11-07T10:00:00Z",
};

describe("a flagged task comment's row", () => {
    it("says Task comment, and not PM or Thread as well", () => {
        mountRow(COMMENT_ROW);
        expect(screen.getByText(en.chat.sidebar.chipTaskComment)).toBeTruthy();
        expect(screen.queryByText(en.chat.sidebar.chipPM)).toBeNull();
        expect(screen.queryByText("Thread")).toBeNull();
    });

    it("keeps the project and task-id chips", () => {
        mountRow(COMMENT_ROW);
        expect(screen.getByText("Q4 Roadmap", { selector: ".MuiChip-label" })).toBeTruthy();
        expect(screen.getByText("QR-16")).toBeTruthy();
    });

    it("opens the task's thread at that comment", async () => {
        mountRow(COMMENT_ROW);
        fireEvent.click(document.querySelector(".MuiListItemButton-root") as HTMLElement);
        await vi.waitFor(() =>
            expect(screen.getByTestId("where").textContent).toBe(
                "/workspace/chat/pm/ch-pm/thread/42/comment/3"
            )
        );
    });

    it("a PM message that is not a comment still says PM", () => {
        mountRow({ ...COMMENT_ROW, taskCommentId: undefined, threadId: 0 });
        expect(screen.queryByText(en.chat.sidebar.chipTaskComment)).toBeNull();
        expect(screen.getByText(en.chat.sidebar.chipPM)).toBeTruthy();
    });
});
