/**
 * A refused flag change says so (MIP-1441).
 *
 * `channelService.flagMessage` / `unflagMessage` / `completeFlag` / `reopenFlag` update the store
 * first, send over the socket, and roll back if the ack fails. The callers used to catch the
 * rejection with `console.error` only, so a refused flag appeared and then vanished with no
 * sentence saying why. Every caller now shows one toast (the same id, so it never stacks) and,
 * where the menu keeps its own copy of the state, puts that copy back.
 *
 * The callers: the "…" menu of a chat message and of a thread reply, a task comment's bubble, and
 * the Flagged list's card. (The channel panes already report their own errors.)
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastHost } from "../components/ui/feedback/Toast";
import { __resetToasts, toast } from "../components/ui/feedback/toastStore";
import { BubbleMoreMenu } from "../features/chat/components/bubbles/BubbleMoreMenu";
import { BubbleThreadMoreMenu } from "../features/chat/components/bubbles/BubbleThreadMoreMenu";
import { ChatListItemForFlagMessages } from "../features/chat/components/sidebar/chatListItemForFlagMessages";
import {
    FLAG_FAILURE_TOAST_ID,
    reportFlagFailure,
} from "../features/chat/utils/reportFlagFailure";
import { TaskCommentBubble } from "../features/tasks/components/contents/base/sub/TaskCommentBubble";
import { BubbleActionsPreferenceProvider } from "../hooks/common/useBubbleActionsPreference";
import { DoubleClickTodoPreferenceProvider } from "../hooks/common/useDoubleClickTodoPreference";
import { en } from "../i18n/locales/en";
import { TaskCommentProps } from "../types/tasks";

// ---- a fake channelService (flag state the task comment can subscribe to) ---------------------
const service = vi.hoisted(() => {
    const listeners = new Set<() => void>();
    const flags = new Map<string, unknown>();
    let snapshot = { flagByMessageId: flags as ReadonlyMap<string, unknown> };
    return {
        flags,
        flagMessage: vi.fn(),
        unflagMessage: vi.fn(),
        completeFlag: vi.fn(),
        reopenFlag: vi.fn(),
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
vi.mock("../features/chat/components/modals/ModalDeleteMessage", () => ({
    ModalDeleteMessage: () => null,
}));
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

const FAILED = en.chat.messageActions.failed;
const FLAG = en.chat.messageActions.flagForLater;
const REMOVE_FLAG = en.chat.messageActions.removeFlag;
const MARK_DONE = en.chat.listItem.completeFlag;
const MIRROR = "1f23d65f-3379-5e81-985f-04a54d143ddb";
const REFUSED = new Error("404 not a member");

const refuse = (fn: ReturnType<typeof vi.fn>) => fn.mockRejectedValue(REFUSED);
const accept = (fn: ReturnType<typeof vi.fn>) => fn.mockResolvedValue(undefined);

beforeEach(() => {
    window.localStorage.clear();
    service.flags.clear();
    service.setFlagged("x", true);
    service.setFlagged("x", false);
    vi.clearAllMocks();
    for (const fn of [service.flagMessage, service.unflagMessage, service.completeFlag])
        accept(fn);
    accept(service.reopenFlag);
    __resetToasts();
    vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

const toasts = () => document.body.textContent ?? "";
const shown = async (text: string) => waitFor(() => expect(toasts()).toContain(text));
const notShown = async () => {
    // let any rejection settle before asserting nothing appeared
    await act(async () => {
        await Promise.resolve();
    });
    for (const text of Object.values(FAILED)) expect(toasts()).not.toContain(text);
};

// ---- the helper -------------------------------------------------------------------------------
describe("reportFlagFailure", () => {
    it("shows the wording for each action as a danger toast, and logs the cause", async () => {
        render(
            <CssVarsProvider>
                <ToastHost />
            </CssVarsProvider>
        );
        for (const action of ["flag", "unflag", "complete", "reopen"] as const) {
            act(() => reportFlagFailure(action, REFUSED, "Test"));
            await shown(FAILED[action]);
        }
        expect(console.error).toHaveBeenCalledWith("[Test] reopen failed:", REFUSED);
    });

    it("uses one toast id, so a second failure replaces the first instead of stacking", async () => {
        render(
            <CssVarsProvider>
                <ToastHost />
            </CssVarsProvider>
        );
        act(() => reportFlagFailure("flag", REFUSED, "Test"));
        act(() => reportFlagFailure("unflag", REFUSED, "Test"));
        await shown(FAILED.unflag);
        expect(toasts()).not.toContain(FAILED.flag);
        expect(FLAG_FAILURE_TOAST_ID).toBe("flag-action-failed");
        act(() => {
            toast.dismiss(FLAG_FAILURE_TOAST_ID);
        });
    });

    it("names no noun: it is also said of a task comment", () => {
        for (const text of Object.values(FAILED))
            expect(text.toLowerCase()).not.toContain("message");
    });
});

// ---- the "…" menu of a chat message and of a thread reply ------------------------------------
const baseMessage = {
    messageId: "m-1",
    messageIdWithChatId: "ch-1#m-1",
    messageIdWithChatIdAndThreadId: "ch-1#th-1#m-1",
    content: "hello",
    numReplies: 0,
    taskId: null,
    isFlagged: false,
    sender: { userId: "u-2", userName: "Other", isSystemUser: false },
};

const mountMenu = (kind: "main" | "thread", isFlagged = false) => {
    const common = {
        accessToken: "tok",
        flaggedMessages: [],
        isSent: false,
        message: { ...baseMessage, isFlagged } as never,
        myself: { userId: "u-1", teamId: "t-1" } as never,
        setEditTargetMessage: vi.fn(),
        setFlaggedMessages: vi.fn(),
        setIsInEdit: vi.fn(),
        setUnwrapAll: vi.fn(),
        setUnwrapCode: vi.fn(),
        socket: null,
        unwrapAll: false,
        unwrapCode: false,
        useCM: { flaggedMessages: [] } as never,
    };
    return render(
        <CssVarsProvider>
            <BubbleActionsPreferenceProvider>
                {kind === "main" ? (
                    <BubbleMoreMenu
                        {...common}
                        chat={{ chatId: "ch-1", chatType: 2 } as never}
                        replyHandler={vi.fn()}
                        setCurrentChat={vi.fn()}
                        usePM={{} as never}
                        useTM={{} as never}
                    />
                ) : (
                    <BubbleThreadMoreMenu
                        {...common}
                        currentMessageIndex={0}
                        setCurrentThreadChat={vi.fn()}
                        setTargetMessageIndex={vi.fn()}
                        thread={{ chatId: "ch-1", threadId: "th-1", chatType: 2 } as never}
                    />
                )}
            </BubbleActionsPreferenceProvider>
            <ToastHost />
        </CssVarsProvider>
    );
};
const openMenu = () => {
    fireEvent.click(screen.getAllByRole("button").at(-1) as HTMLElement);
    return screen.getAllByRole("menuitem").map((el) => el.textContent);
};
const pickFromMenu = (label: string) => {
    openMenu();
    fireEvent.click(screen.getAllByRole("menuitem").find((el) => el.textContent === label)!);
};

describe.each(["main", "thread"] as const)("the %s bubble's … menu", (kind) => {
    it("flag refused: says so, and the menu offers Flag again", async () => {
        refuse(service.flagMessage);
        mountMenu(kind);
        pickFromMenu(FLAG);
        await shown(FAILED.flag);
        const labels = openMenu();
        expect(labels).toContain(FLAG);
        expect(labels).not.toContain(REMOVE_FLAG);
    });

    it("remove flag refused: says so, and the menu still says Remove flag", async () => {
        refuse(service.unflagMessage);
        mountMenu(kind, true);
        pickFromMenu(REMOVE_FLAG);
        await shown(FAILED.unflag);
        expect(openMenu()).toContain(REMOVE_FLAG);
    });

    it("mark done refused: says so, and the message is still flagged", async () => {
        refuse(service.completeFlag);
        mountMenu(kind, true);
        // Flagged: Mark done takes the toolbar slot (MIP-1423), it is not a menu item.
        fireEvent.click(screen.getByRole("button", { name: MARK_DONE }));
        await shown(FAILED.complete);
        expect(openMenu()).toContain(REMOVE_FLAG);
    });

    it("says nothing when the server accepts", async () => {
        mountMenu(kind);
        pickFromMenu(FLAG);
        expect(service.flagMessage).toHaveBeenCalled();
        await notShown();
    });
});

// ---- a task comment ---------------------------------------------------------------------------
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
const mountComment = () =>
    render(
        <CssVarsProvider>
            <BubbleActionsPreferenceProvider>
                <DoubleClickTodoPreferenceProvider>
                    <TaskCommentBubble
                        comment={comment()}
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
            <ToastHost />
        </CssVarsProvider>
    );
const openCommentMenu = (container: HTMLElement) => {
    const root = container.firstElementChild;
    if (root) fireEvent.mouseEnter(root);
    fireEvent.click(screen.getByLabelText("More options"));
};

describe("a task comment's bubble", () => {
    it("flag refused: says so (and the comment is not flagged)", async () => {
        refuse(service.flagMessage);
        const { container } = mountComment();
        openCommentMenu(container);
        fireEvent.click(screen.getByText(FLAG));
        await shown(FAILED.flag);
        expect(service.flags.has(MIRROR)).toBe(false);
    });

    it("remove flag refused: says so", async () => {
        refuse(service.unflagMessage);
        service.setFlagged(MIRROR, true);
        const { container } = mountComment();
        openCommentMenu(container);
        fireEvent.click(screen.getByText(REMOVE_FLAG));
        await shown(FAILED.unflag);
    });

    it("mark done refused: says so", async () => {
        refuse(service.completeFlag);
        service.setFlagged(MIRROR, true);
        const { container } = mountComment();
        const root = container.firstElementChild;
        if (root) fireEvent.mouseEnter(root);
        fireEvent.click(screen.getByRole("button", { name: MARK_DONE }));
        await shown(FAILED.complete);
    });

    it("says nothing when the server accepts", async () => {
        const { container } = mountComment();
        openCommentMenu(container);
        fireEvent.click(screen.getByText(FLAG));
        expect(service.flagMessage).toHaveBeenCalledWith(MIRROR);
        await notShown();
    });
});

// ---- the Flagged list's card ------------------------------------------------------------------
const CARD = {
    flaggedMessageId: "f1",
    chatType: 1,
    chatName: "Ken",
    chatId: "c1",
    threadId: 0,
    messageId: "m1",
    contentText: "Please review the rollout plan",
    sender: { userId: "u2", username: "Ken" },
    dmPartnerUser: { userId: "u2", username: "Ken" },
    taskId: 0,
    tsSent: "2026-11-07T10:00:00Z",
};
const mountCard = (viewMode: "active" | "past") =>
    render(
        <MemoryRouter>
            <CssVarsProvider>
                <ChatListItemForFlagMessages
                    flaggedMessage={CARD as never}
                    myself={{ userId: "me" } as never}
                    selectedFlaggedMessageId=""
                    setCurrentProject={() => {}}
                    setMyself={() => {}}
                    setSelectedFlaggedMessageId={() => {}}
                    socket={null}
                    useCM={{ allChats: [] } as never}
                    useTEM={{} as never}
                    useTM={{} as never}
                    useUISM={{} as never}
                    viewMode={viewMode}
                />
                <ToastHost />
            </CssVarsProvider>
        </MemoryRouter>
    );
const cardButtons = () => [
    ...(document.querySelector(".NavItem-actions") as HTMLElement).querySelectorAll("button"),
];

describe("the Flagged list's card", () => {
    it("mark done refused: says so", async () => {
        refuse(service.completeFlag);
        mountCard("active");
        fireEvent.click(cardButtons()[0]);
        await shown(FAILED.complete);
    });

    it("remove flag refused: says so", async () => {
        refuse(service.unflagMessage);
        mountCard("active");
        fireEvent.click(cardButtons()[1]);
        await shown(FAILED.unflag);
    });

    it("reopen refused: says so", async () => {
        refuse(service.reopenFlag);
        mountCard("past");
        fireEvent.click(cardButtons()[0]);
        await shown(FAILED.reopen);
    });

    it("says nothing when the server accepts", async () => {
        mountCard("active");
        fireEvent.click(cardButtons()[0]);
        expect(service.completeFlag).toHaveBeenCalledWith("m1");
        await notShown();
    });
});

// ---- every locale -----------------------------------------------------------------------------
describe("the wording exists in every locale", () => {
    it.each(["en", "ja", "zh", "es", "fr", "hi", "ar"])("%s has all four lines", async (code) => {
        const messages = (await import(`../i18n/locales/${code}`))[code] as typeof en;
        for (const key of ["flag", "unflag", "complete", "reopen"] as const) {
            const line = messages.chat.messageActions.failed[key];
            expect(line.trim().length).toBeGreaterThan(4);
            if (code !== "en") expect(line).not.toBe(FAILED[key]);
        }
    });
});
