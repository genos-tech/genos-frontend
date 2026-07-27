/**
 * Reaction CHIP toggle routes through the v3 channelService.
 *
 * Regression for the dead-emit bug: `ShowEmojiReaction` (the reaction
 * pills under every bubble) used to `socket.emit("message_reaction", ...)`,
 * whose Flask handler was removed in the v3 migration — so clicking a chip
 * updated optimistically then silently failed to persist / broadcast. It
 * must now call `channelService.react` / `.unreact` with the message's v3
 * UUID, exactly like the emoji-picker path (`EmojiReaction`).
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ShowEmojiReaction } from "../components/ui/emoji/ShowEmojiReaction";
import { setTeamEmojiList } from "../services/teamEmojiStore";
import type { UserProps } from "../types/admin";
import { ChannelKind } from "../types/channel";
import type { MessageProps, ThreadMessageProps } from "../types/chat";
import type { ReactionProps } from "../types/common";

const { react, unreact } = vi.hoisted(() => ({
    react: vi.fn(() => Promise.resolve(undefined)),
    unreact: vi.fn(() => Promise.resolve(undefined)),
}));
vi.mock("../services/channel/channelService", () => ({
    channelService: { react, unreact },
}));
vi.mock("../services/requestErrorNotifier", () => ({ notifyActionError: vi.fn() }));

const mkUser = (id: string): UserProps =>
    ({ userId: id, userName: `U-${id}`, userEmail: `${id}@x`, avatarImgPath: "" }) as UserProps;

const me = mkUser("me");
const other = mkUser("other");

const mkReaction = (emoji: string, sender: UserProps): ReactionProps =>
    ({ id: 1, emoji, sender, tsSent: "2026-01-01T00:00:00Z" }) as ReactionProps;

const baseProps = {
    socket: null,
    myself: me,
    chatType: 2, // GM
    chatName: "GM",
    numReplies: 0,
    dmPartnerUser: other,
    showUnderBarOption: true,
    setReactions: vi.fn(),
    setShowEmojiPicker: vi.fn(),
    setUniqueReactionEmojiCount: vi.fn(),
};

const renderChips = (props: Record<string, unknown>) =>
    render(
        <CssVarsProvider>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <ShowEmojiReaction {...({ ...baseProps, ...props } as any)} />
        </CssVarsProvider>
    );

// A reaction chip IS the button now (`ReactionChip` renders
// `<button aria-pressed>`), so there's no wrapper to reach through — the
// old helper dug for `.MuiChip-root > button` because Joy's Chip nested an
// action button inside a div.
const clickChip = (container: HTMLElement, emoji: string) => {
    const chip = [...container.querySelectorAll("button")].find((b) =>
        (b.textContent ?? "").startsWith(emoji)
    );
    if (!chip) throw new Error(`no reaction chip for ${emoji}`);
    fireEvent.click(chip);
};

describe("ShowEmojiReaction chip toggle → channelService (v3)", () => {
    beforeEach(() => {
        react.mockClear();
        unreact.mockClear();
    });

    it("unreacts (removes) when clicking a chip I already reacted with — using the v3 message id", () => {
        const message = {
            messageIdWithChatId: "v3-msg-1",
            chatId: "v3-ch-1",
            messageId: 5,
            sender: other,
        } as unknown as MessageProps;
        const { container } = renderChips({
            isThread: false,
            message,
            reactions: [mkReaction("👍", me)],
        });

        clickChip(container, "👍");

        expect(unreact).toHaveBeenCalledTimes(1);
        expect(unreact).toHaveBeenCalledWith("v3-msg-1", "v3-ch-1", ChannelKind.GM, "👍");
        expect(react).not.toHaveBeenCalled();
    });

    it("reacts (adds) when clicking a chip I have NOT reacted with", () => {
        const message = {
            messageIdWithChatId: "v3-msg-2",
            chatId: "v3-ch-1",
            messageId: 6,
            sender: other,
        } as unknown as MessageProps;
        // Someone else reacted 👀 → the chip exists but not from me.
        const { container } = renderChips({
            isThread: false,
            message,
            reactions: [mkReaction("👀", other)],
        });

        clickChip(container, "👀");

        expect(react).toHaveBeenCalledTimes(1);
        expect(react).toHaveBeenCalledWith("v3-msg-2", "v3-ch-1", ChannelKind.GM, "👀");
        expect(unreact).not.toHaveBeenCalled();
    });

    it("uses the thread-reply v3 id when rendered inside a thread", () => {
        const message = {
            messageIdWithChatIdAndThreadId: "v3-thread-msg-9",
            chatId: "v3-ch-1",
            messageId: 3,
            sender: other,
        } as unknown as ThreadMessageProps;
        const { container } = renderChips({
            isThread: true,
            message,
            reactions: [mkReaction("✅", me)],
        });

        clickChip(container, "✅");

        expect(unreact).toHaveBeenCalledWith("v3-thread-msg-9", "v3-ch-1", ChannelKind.GM, "✅");
    });

    it("renders a :shortcode: reaction as the team emoji image and toggles with the raw string", () => {
        setTeamEmojiList([
            {
                emojiId: 1,
                name: "party-blob",
                url: "https://api.example.com/media/team_emoji/t1/u1-party-blob.gif",
                createdBy: "u1",
                tsCreatedAt: "2026-07-18T00:00:00Z",
            },
        ]);
        const message = {
            messageIdWithChatId: "v3-msg-3",
            chatId: "v3-ch-1",
            messageId: 7,
            sender: other,
        } as unknown as MessageProps;
        const { container } = renderChips({
            isThread: false,
            message,
            reactions: [mkReaction(":party-blob:", other)],
        });

        const img = container.querySelector("img[title=':party-blob:']");
        expect(img).not.toBeNull();
        expect(img?.getAttribute("src")).toContain("/media/team_emoji/");

        // The chip's toggle payload stays the raw shortcode string —
        // the pipeline (socket → Django CharField) never sees an image.
        // Matched by the rendered <img> rather than text, since a custom
        // emoji chip has no shortcode text to start with.
        const chip = [...container.querySelectorAll("button")].find((b) =>
            b.querySelector("img[title=':party-blob:']")
        );
        if (!chip) throw new Error("no reaction chip for :party-blob:");
        fireEvent.click(chip);
        expect(react).toHaveBeenCalledWith("v3-msg-3", "v3-ch-1", ChannelKind.GM, ":party-blob:");

        setTeamEmojiList([]);
    });
});
