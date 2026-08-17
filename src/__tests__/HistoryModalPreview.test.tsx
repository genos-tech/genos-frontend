/**
 * History rows print the same stored preview text the chat sidebar
 * does, so they had the same two bugs: a custom emoji showed as the
 * literal `:name:`, and a chat whose latest message is a GIF lost its
 * subtitle line entirely.
 *
 * `HistoryRow` renders `subtitle` at exactly ONE place, so resolving
 * there covers every row kind without widening the string-typed prop.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HistoryModal } from "../components/layout/HistoryModal";
import { TeamEmoji } from "../services/teamEmojiApi";
import { setTeamEmojiList } from "../services/teamEmojiStore";

const partyBlob: TeamEmoji = {
    emojiId: 1,
    name: "party-blob",
    url: "https://api.example.com/media/team_emoji/t1/u1-party-blob.gif",
    createdBy: "u1",
    tsCreatedAt: "2026-07-18T00:00:00Z",
};

const chatsEntries: unknown[] = [];

vi.mock("../hooks/common/useHistory", () => ({
    useHistory: () => ({
        chatsEntries,
        tasksEntries: [],
        notesEntries: [],
        clear: vi.fn(),
        record: vi.fn(),
    }),
}));

vi.mock("../components/ui/avatars/AvatarContext", () => ({
    useAvatarContext: () => ({ myself: { userId: "u1" } }),
    useResolvedUserName: (_id: string, fallback: string) => fallback,
}));

vi.mock("../components/ui/avatars/UserAvatar", () => ({
    UserAvatar: () => null,
}));

afterEach(() => {
    chatsEntries.length = 0;
    setTeamEmojiList([]);
});

// The modal reads only `useCM.allChats`; the other state managers are
// threaded straight through to handlers this test never fires.
/* eslint-disable @typescript-eslint/no-explicit-any */
const renderModal = (allChats: any[]) =>
    render(
        <CssVarsProvider>
            <HistoryModal
                useCM={{ allChats } as any}
                usePM={{} as any}
                useSM={{} as any}
                useTM={{} as any}
                open
                onClose={vi.fn()}
                onOpenChat={vi.fn()}
                onOpenMilestone={vi.fn()}
                onOpenNote={vi.fn()}
                onOpenTask={vi.fn()}
                onOpenThread={vi.fn()}
            />
        </CssVarsProvider>
    );

describe("HistoryModal chat-row subtitle", () => {
    it("resolves a custom emoji in a per-message row", () => {
        setTeamEmojiList([partyBlob]);
        chatsEntries.push({
            kind: "chat",
            chatType: 2,
            // v3 UUID-shaped string, the canonical `HistoryEntry.chatId`.
            // Matching `AllChatProps.chatId` exactly is what makes the
            // chat lookup in the modal resolve.
            chatId: "1",
            messageId: 7,
            messageText: "ship it :party-blob:",
            label: "Design",
            openedAt: Date.now(),
        });

        renderModal([]);
        expect(screen.getByAltText(":party-blob:")).toHaveAttribute("src", partyBlob.url);
    });

    it("labels a chat whose latest message is a GIF", () => {
        chatsEntries.push({
            kind: "chat",
            chatType: 2,
            // v3 UUID-shaped string, the canonical `HistoryEntry.chatId`.
            // Matching `AllChatProps.chatId` exactly is what makes the
            // chat lookup in the modal resolve.
            chatId: "1",
            label: "Design",
            openedAt: Date.now(),
        });

        renderModal([
            {
                chatType: 2,
                chatId: "1",
                latestMessageText: "",
                latestMessage: {
                    content: [
                        { type: "paragraph", content: [] },
                        {
                            type: "image",
                            props: { url: "https://media1.giphy.com/media/abc/giphy.gif" },
                        },
                    ],
                },
            },
        ]);
        expect(screen.getByText("GIF")).toBeInTheDocument();
    });

    it("leaves a plain-text subtitle alone", () => {
        chatsEntries.push({
            kind: "chat",
            chatType: 2,
            // v3 UUID-shaped string, the canonical `HistoryEntry.chatId`.
            // Matching `AllChatProps.chatId` exactly is what makes the
            // chat lookup in the modal resolve.
            chatId: "1",
            messageId: 7,
            messageText: "just text",
            label: "Design",
            openedAt: Date.now(),
        });

        renderModal([]);
        expect(screen.getByText("just text")).toBeInTheDocument();
    });
});
