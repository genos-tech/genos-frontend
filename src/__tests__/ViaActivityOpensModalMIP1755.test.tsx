/**
 * MIP-1755: an ordinary Activity card for a change made through an AI app (`meta.via`) opens what
 * it names in the chat's preview modal: a task comment, a task, a task's description, a chat
 * message, a thread reply and a note mention. A person's own change keeps its old click.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { v3ActivityToLegacy } from "../features/chat/adapters/v3ActivityToLegacy";
import { ChatListItemForActivity } from "../features/chat/components/sidebar/activity/chatListItemForActivity";
import { viaActivityModalHref } from "../features/chat/utils/viaActivityModalHref";
import { UrlLinkModalProvider } from "../hooks/common/UrlLinkModalContext";
import type { ActivityMessageProps, AllChatProps } from "../types/chat";
import { parseInternalUrl } from "../utils/parseInternalUrl";

const navigateMock = vi.fn();
const openModalByHrefMock = vi.fn<(href: string, opts?: unknown) => "opened">(() => "opened");
const loadSpecificNoteMock = vi.fn();
const markReadMock = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => ({
    ...(await importOriginal<typeof import("react-router-dom")>()),
    useNavigate: () => navigateMock,
}));
vi.mock("../context/authState", () => ({ useAuth: () => ({ accessToken: "tok" }) }));
vi.mock("../features/chat/hooks/useActivityStatus", () => ({
    useActivityStatus: () => ({ updateActivityReadStatus: markReadMock, groupedReactions: [] }),
}));
vi.mock("../features/chat/components/sidebar/activity/ActivityContent", () => ({
    ActivityContent: () => <span>content</span>,
}));
vi.mock("../features/chat/components/sidebar/activity/ActivityHeader", () => ({
    ActivityHeader: () => <span>the card</span>,
}));
vi.mock("../features/notes/common/services/loadSpecificNote", () => ({
    loadSpecificNote: (...args: unknown[]) => loadSpecificNoteMock(...args),
}));

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

const myself = { userId: "me", userName: "Me", userEmail: "me@test", teamId: "t1" } as never;
const CHANNEL = "11111111-1111-4111-8111-111111111111";
const MESSAGE = "22222222-2222-4222-8222-222222222222";
const ROOT = "33333333-3333-4333-8333-333333333333";

const chats = [
    { chatId: CHANNEL, chatType: 3, project: { projectId: 3 } },
    { chatId: CHANNEL, chatType: 2 },
] as unknown as AllChatProps[];

const card = (extra: Partial<ActivityMessageProps>) =>
    ({
        activityId: "act-1",
        activityType: 3,
        chatType: 3,
        chatId: CHANNEL,
        chatName: "QR",
        messageId: 4,
        messageUniqueKey: MESSAGE,
        isThread: false,
        threadId: "",
        taskId: 0,
        isRead: false,
        senderId: "other",
        tsSent: "2026-11-28T10:00:00Z",
        viaAi: true,
        ...extra,
    }) as unknown as ActivityMessageProps;

describe("viaActivityModalHref", () => {
    const task = "/workspace/tasks/project/3/task/7";

    it.each([
        ["a task comment", { isThread: true, taskId: 7, taskCommentId: 41 }, `${task}/comment/41`],
        ["a task's card in the project chat", { taskId: 7 }, task],
        ["a task's description", { chatType: 5, projectId: 3, taskId: 7 }, task],
        ["a chat message", { chatType: 2 }, `/workspace/chat/gm/${CHANNEL}/message/${MESSAGE}`],
        [
            "a thread reply",
            { chatType: 2, isThread: true, threadId: ROOT },
            `/workspace/chat/gm/${CHANNEL}/thread/${ROOT}/message/${MESSAGE}`,
        ],
    ])("%s", (_name, extra, href) => {
        const got = viaActivityModalHref(card(extra as never), chats);
        expect(got).toBe(href);
        // Every link is one the modal can show.
        expect(parseInternalUrl(got!).kind).not.toBe("route");
    });

    it("is null for a chat that is not in the member's list", () => {
        expect(viaActivityModalHref(card({ chatType: 1 }), chats)).toBeNull();
    });
});

describe("the adapter marks a card made through an AI app", () => {
    const wire = (meta: Record<string, unknown> | undefined) =>
        v3ActivityToLegacy(
            {
                id: "act-1",
                activityType: 3,
                recipientUserId: "me",
                teamId: "t1",
                surfaceType: 5,
                meta: { projectId: 3, taskId: 7, ...meta },
                isRead: false,
                tsCreated: "2026-11-28T10:00:00Z",
            } as never,
            myself
        );

    it("any connected app, named family or not; nobody else", () => {
        expect(wire({ via: { kind: "oauth" } }).viaAi).toBe(true);
        expect(wire({ via: { kind: "oauth", app: "claude" } }).viaAi).toBe(true);
        expect(wire(undefined).viaAi).toBeUndefined();
        expect(wire({ via: { kind: "app" } }).viaAi).toBeUndefined();
    });
});

describe("a click on the card", () => {
    const renderCard = (activity: ActivityMessageProps) => {
        const useCM = {
            allChats: chats,
            setNotMoveChatPaneType: vi.fn(),
            setCurrentMainChat: vi.fn(),
        };
        render(
            <CssVarsProvider>
                <MemoryRouter>
                    <UrlLinkModalProvider value={{ openModalByHref: openModalByHrefMock }}>
                        <ChatListItemForActivity
                            activity={activity}
                            activityMessages={[activity]}
                            myself={myself}
                            selectedActivityId=""
                            setCurrentProject={vi.fn()}
                            setMyself={vi.fn()}
                            setSelectedActivityId={vi.fn()}
                            socket={null}
                            useCM={useCM as never}
                            useNM={{ teamNoteMeta: [{ noteId: 9 }], sharedNoteMeta: [] } as never}
                            useTEM={{} as never}
                            useTM={{} as never}
                            useUISM={{} as never}
                        />
                    </UrlLinkModalProvider>
                </MemoryRouter>
            </CssVarsProvider>
        );
        return useCM;
    };
    const press = async () => {
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: /the card/ }));
        });
    };

    it("opens the modal, marks the row read and leaves the chat panes alone", async () => {
        const useCM = renderCard(card({ isThread: true, taskId: 7, taskCommentId: 41 }));

        await press();

        const href = "/workspace/tasks/project/3/task/7/comment/41";
        expect(openModalByHrefMock).toHaveBeenCalledWith(href, { fullPageHref: href });
        expect(markReadMock).toHaveBeenCalled();
        expect(navigateMock).not.toHaveBeenCalled();
        expect(useCM.setNotMoveChatPaneType).not.toHaveBeenCalled();
    });

    it("a note mention opens the note modal, in the note's own section", async () => {
        loadSpecificNoteMock.mockResolvedValue({ noteId: 9 });
        renderCard(card({ chatType: 6, chatId: 9 as never }));

        await press();

        const href = "/workspace/notes/team/9";
        expect(openModalByHrefMock).toHaveBeenCalledWith(href, { fullPageHref: href });
        expect(navigateMock).not.toHaveBeenCalled();
    });

    it("a person's own change keeps its old click", async () => {
        const useCM = renderCard(card({ viaAi: undefined, chatType: 6, chatId: 9 as never }));
        loadSpecificNoteMock.mockResolvedValue(undefined);

        await press();

        expect(openModalByHrefMock).not.toHaveBeenCalled();
        expect(useCM.setNotMoveChatPaneType).toHaveBeenCalled();
    });
});

describe("a team note link opens in the modal", () => {
    it("is a target the modal hook supports", async () => {
        const { useUrlLinkModalState } = await import("../hooks/common/useUrlLinkModalState");
        const { renderHook } = await import("@testing-library/react");
        const navigate = vi.fn();
        const { result } = renderHook(() => useUrlLinkModalState({ navigate }));
        let outcome = "";
        act(() => {
            outcome = result.current.openModalByHref("/workspace/notes/team/9");
        });
        expect(outcome).toBe("opened");
    });
});
