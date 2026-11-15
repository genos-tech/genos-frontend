/**
 * MIP-1570: a chat message a connected app wrote (the mirrored task comment, the task
 * card made over MCP) carries `message.metadata.via = { kind: "oauth", app? }`. Its
 * author line and its chat-list preview show the app's small round mark.
 *
 * Pinned here: the adapters believe only the two exact family strings (spoofs, an API
 * key and a bare connected app earn nothing), a person's message keeps the exact shape it
 * had, the header shows the mark for claude / chatgpt and nothing without it (in the plain
 * header, the grouped one and the task-card one), the chat-list preview shows it, the row's
 * memo comparator repaints on it, and no NAME reaches the DOM or an aria label.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
    channelToLegacyChat,
    v3MessageToLegacy,
    v3ThreadMessageToLegacy,
} from "../features/chat/adapters/v3ToLegacy";
import { BubbleUserName } from "../features/chat/components/bubbles/BubbleUserName";
import { sameChatRender } from "../features/chat/components/sidebar/chatListItemEquality";
import { ChatListItemMessage } from "../features/chat/components/sidebar/ChatListItemMessage";
import { UserProps } from "../types/admin";
import { ChannelKind, type Channel, type Message } from "../types/channel";
import type { AllChatProps } from "../types/chat";

afterEach(cleanup);

const CLAUDE = { kind: "oauth", app: "claude" };
const CHATGPT = { kind: "oauth", app: "chatgpt" };
/** A stranger's attempts, and kinds that must never earn a mark here. */
const NOT_A_FAMILY: unknown[] = [
    { kind: "oauth" },
    { kind: "oauth", app: "Claude" },
    { kind: "oauth", app: "claude " },
    { kind: "oauth", app: "claude-evil" },
    { kind: "oauth", app: "CHATGPT" },
    { kind: "oauth", app: 1 },
    { kind: "oauth", app: { name: "claude" } },
    { kind: "api_key", app: "claude" },
    { kind: "app", app: "claude" },
    { kind: "agent", app: "claude" },
    { app: "claude" },
    "claude",
    ["claude"],
    42,
    null,
];

const message = (metadata: Record<string, unknown>, over: Partial<Message> = {}): Message => ({
    id: "m-1",
    channelId: "c-1",
    channelKind: ChannelKind.DM,
    sender: {
        userId: "u2",
        userName: "Ann",
        userEmail: "",
        avatarImgPath: "",
        isSystemUser: false,
    },
    seq: 7,
    body: [{ type: "paragraph", content: [{ type: "text", text: "hi" }] }],
    bodyText: "hi",
    parentId: null,
    threadRootId: null,
    isThreadReply: false,
    replyCount: 0,
    reactions: [],
    mentions: [],
    attachments: [],
    metadata,
    taskId: null,
    displayId: null,
    taskStatus: null,
    editedAt: null,
    deletedAt: null,
    tsSent: "2026-11-15T09:12:00Z",
    tsUpdated: "2026-11-15T09:12:00Z",
    ...over,
});

const adapt = (m: Message) => v3MessageToLegacy({ message: m, channelId: "c-1", chatType: 1 });

const channelWith = (latest: Message): Channel =>
    ({
        id: "c-1",
        kind: ChannelKind.PM,
        title: "Project",
        profileImageUrl: "",
        projectId: 1,
        ownerId: null,
        isPrivate: false,
        legacyChatId: null,
        latestMessage: latest,
        unreadCount: 0,
        tsCreated: "2026-11-15T09:00:00Z",
        tsUpdated: "2026-11-15T09:12:00Z",
    }) as unknown as Channel;

describe("adapters: metadata.via -> viaApp", () => {
    it("carries the family for a top-level message, a thread reply and the chat-list preview", () => {
        expect(adapt(message({ via: CLAUDE })).viaApp).toBe("claude");
        expect(adapt(message({ via: CHATGPT })).viaApp).toBe("chatgpt");
        expect(
            v3ThreadMessageToLegacy({
                message: message({ via: CLAUDE }, { isThreadReply: true, parentId: "root" }),
                channelId: "c-1",
                threadRootUuid: "root",
                chatType: 3,
            }).viaApp
        ).toBe("claude");
        const chat = channelToLegacyChat({
            channel: channelWith(message({ via: CHATGPT })),
            isPinned: false,
            currentUserId: "u1",
        });
        expect(chat.latestMessage.viaApp).toBe("chatgpt");
    });

    it.each(NOT_A_FAMILY.map((v) => [JSON.stringify(v), v]))(
        "earns no mark for the spoof or other kind %s",
        (_label, via) => {
            const m = message({ via });
            expect(adapt(m).viaApp).toBeUndefined();
            expect("viaApp" in adapt(m)).toBe(false);
            expect(
                channelToLegacyChat({
                    channel: channelWith(m),
                    isPinned: false,
                    currentUserId: "u1",
                }).latestMessage.viaApp
            ).toBeUndefined();
        }
    );

    it("leaves a person's message exactly the shape it had (no viaApp key, tolerant of missing metadata)", () => {
        expect("viaApp" in adapt(message({}))).toBe(false);
        expect("viaApp" in adapt(message({ taskCommentId: 4 }))).toBe(false);
        const noMeta = message({});
        (noMeta as { metadata: unknown }).metadata = null;
        expect(adapt(noMeta).viaApp).toBeUndefined();
    });

    it("never carries a name: whatever else the metadata holds stays off the legacy row", () => {
        const owner = {
            ...CLAUDE,
            client_name: "Ken's private app name",
            key_name: "ci-key",
            connection_id: "conn-9f3a-x",
        };
        const adapted = adapt(message({ via: owner }));
        expect(JSON.stringify(adapted)).not.toContain("private app name");
        expect(JSON.stringify(adapted)).not.toContain("ci-key");
        expect(JSON.stringify(adapted)).not.toContain("conn-9f3a-x");
    });
});

const sender = { userId: "u2", userName: "Ann", isSystemUser: false } as UserProps;

const header = (over: Partial<React.ComponentProps<typeof BubbleUserName>> = {}) =>
    render(
        <CssVarsProvider>
            <BubbleUserName
                chatType={1}
                dtSent="Nov 15, 09:12"
                isSent={false}
                isSimpleBubble={false}
                isThread={false}
                sender={sender}
                taskId={null}
                taskStatus={null}
                tsSent="2026-11-15T09:12:00Z"
                tsUpdated="2026-11-15T09:12:00Z"
                {...over}
            />
        </CssVarsProvider>
    );

describe("message header", () => {
    it("shows the Claude mark next to the name and time", () => {
        header({ viaApp: "claude" });
        expect(screen.getByRole("img", { name: "via Claude" })).toHaveAttribute(
            "data-via-app",
            "claude"
        );
        expect(screen.getByText("Ann")).toBeInTheDocument();
        expect(screen.getByText("Nov 15, 09:12")).toBeInTheDocument();
    });

    it("shows the ChatGPT mark", () => {
        header({ viaApp: "chatgpt" });
        expect(screen.getByRole("img", { name: "via ChatGPT" })).toHaveAttribute(
            "data-via-app",
            "chatgpt"
        );
    });

    it("shows nothing without a family", () => {
        const { container } = header();
        expect(screen.queryByRole("img")).toBeNull();
        expect(container.querySelector("[data-via-app]")).toBeNull();
        expect(container.querySelector("[data-via]")).toBeNull();
    });

    it("keeps the mark on a grouped follow-up, which has the time but no name", () => {
        header({ isSimpleBubble: true, viaApp: "claude" });
        expect(screen.queryByText("Ann")).toBeNull();
        expect(screen.getByRole("img", { name: "via Claude" })).toBeInTheDocument();
    });

    it("shows the mark on a task-card header too", () => {
        header({
            chatType: 3,
            displayId: "TP-139",
            taskId: 139,
            taskStatus: "Open",
            viaApp: "claude",
        });
        expect(screen.getByText("TP-139")).toBeInTheDocument();
        expect(screen.getByRole("img", { name: "via Claude" })).toBeInTheDocument();
    });

    it("shows the mark on a mirrored thread reply header", () => {
        header({ isThread: true, viaApp: "chatgpt" });
        expect(screen.getByRole("img", { name: "via ChatGPT" })).toBeInTheDocument();
    });

    it("puts no name, key or connection in the DOM or an aria label (adapter to header)", () => {
        const adapted = adapt(
            message({
                via: {
                    ...CLAUDE,
                    client_name: "Ken's private app name",
                    key_name: "ci-key",
                    connection_id: "conn-9f3a-x",
                },
            })
        );
        const { container } = header({ viaApp: adapted.viaApp });
        const html = container.innerHTML;
        expect(html).not.toContain("private app name");
        expect(html).not.toContain("ci-key");
        expect(html).not.toContain("conn-9f3a-x");
        const labels = [...container.querySelectorAll("[aria-label]")].map((e) =>
            e.getAttribute("aria-label")
        );
        expect(labels).toEqual(["via Claude"]);
    });
});

const previewChat = (viaApp?: "claude" | "chatgpt", text = "Task created: Fix login") =>
    ({
        chatId: "c-1",
        chatType: 3,
        lastReadMessageId: "7",
        latestMessageText: text,
        latestMessage: { messageId: 7, tsSent: "2026-11-15 09:12:00", content: [], viaApp },
    }) as unknown as AllChatProps;

describe("chat-list preview", () => {
    const mount = (chat: AllChatProps) =>
        render(
            <CssVarsProvider>
                <ChatListItemMessage chat={chat} />
            </CssVarsProvider>
        );

    it("leads the preview with the app's mark when the latest message carries one", () => {
        mount(previewChat("claude"));
        expect(screen.getByRole("img", { name: "via Claude" })).toBeInTheDocument();
        expect(screen.getByText("Task created: Fix login")).toBeInTheDocument();
    });

    it("shows the ChatGPT mark", () => {
        mount(previewChat("chatgpt"));
        expect(screen.getByRole("img", { name: "via ChatGPT" })).toBeInTheDocument();
    });

    it("shows no mark for a person's message", () => {
        mount(previewChat(undefined));
        expect(screen.queryByRole("img")).toBeNull();
        expect(screen.getByText("Task created: Fix login")).toBeInTheDocument();
    });

    it("keeps an empty preview empty", () => {
        const { container } = mount(previewChat("claude", ""));
        expect(container).toBeEmptyDOMElement();
    });

    it("the row's memo comparator repaints when the mark appears or goes", () => {
        expect(sameChatRender(previewChat(undefined), previewChat("claude"))).toBe(false);
        expect(sameChatRender(previewChat("claude"), previewChat("chatgpt"))).toBe(false);
        expect(sameChatRender(previewChat("claude"), previewChat("claude"))).toBe(true);
    });
});
