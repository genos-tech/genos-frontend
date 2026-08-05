/**
 * Sidebar preview rendering for the two message kinds the chat list
 * used to get wrong:
 *
 *   - custom emoji, which `body_text` stores as the literal `:name:`
 *     shortcode (canonical for search + reactions) and every sidebar
 *     surface printed raw;
 *   - GIF / image messages, which store NO preview text at all — the
 *     send path derives it from the first block only and `insertGif`
 *     puts the image after the cursor's empty paragraph — so the row
 *     rendered blank.
 *
 * `EmojiText` fixes the first at RENDER time (so already-sent messages
 * are covered too); `derivePreviewMediaKind` labels the second from the
 * body the chat list already holds on `latestMessage`.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { EmojiText } from "../components/ui/emoji/EmojiText";
import { v3ActivityToLegacy } from "../features/chat/adapters/v3ActivityToLegacy";
import { ChatListItemMessage } from "../features/chat/components/sidebar/ChatListItemMessage";
import { derivePreviewMediaKind } from "../features/chat/utils/common";
import { TeamEmoji } from "../services/teamEmojiApi";
import { setTeamEmojiList } from "../services/teamEmojiStore";
import { AllChatProps } from "../types/chat";

const partyBlob: TeamEmoji = {
    emojiId: 1,
    name: "party-blob",
    url: "https://api.example.com/media/team_emoji/t1/u1-party-blob.gif",
    createdBy: "u1",
    tsCreatedAt: "2026-07-18T00:00:00Z",
};

afterEach(() => {
    setTeamEmojiList([]);
});

// Minimal `AllChatProps` — the component reads only these fields.
const chatWith = (over: Partial<AllChatProps>): AllChatProps =>
    ({
        chatId: "c1",
        chatType: 2,
        chatName: "Design",
        lastReadMessageId: "5",
        latestMessageText: "",
        ...over,
    }) as AllChatProps;

describe("EmojiText", () => {
    it("resolves shortcodes embedded in a mixed preview line", () => {
        setTeamEmojiList([partyBlob]);
        render(<EmojiText text="shipped it :party-blob: today" />);

        const img = screen.getByAltText(":party-blob:");
        expect(img.tagName).toBe("IMG");
        expect(img).toHaveAttribute("src", partyBlob.url);
        // The surrounding prose survives on both sides of the glyph.
        expect(screen.getByText(/shipped it/)).toBeInTheDocument();
        expect(screen.getByText(/today/)).toBeInTheDocument();
    });

    it("resolves several shortcodes in one line", () => {
        setTeamEmojiList([partyBlob]);
        render(<EmojiText text=":party-blob: x :party-blob:" />);
        expect(screen.getAllByAltText(":party-blob:")).toHaveLength(2);
    });

    it("leaves unknown shortcodes as literal text (deleted emoji)", () => {
        render(<EmojiText text="rip :ghost:" />);
        expect(screen.getByText(/:ghost:/)).toBeInTheDocument();
        expect(screen.queryByRole("img")).toBeNull();
    });

    it("passes plain text through untouched", () => {
        setTeamEmojiList([partyBlob]);
        render(<EmojiText text="no shortcodes here" />);
        expect(screen.getByText("no shortcodes here")).toBeInTheDocument();
    });
});

describe("v3ActivityToLegacy media kind", () => {
    // The activity endpoint embeds the message with the SAME
    // `MessageSerializer` the channel list uses, so `body` is on the
    // wire — this is what makes the feed's GIF label possible without a
    // server change. If that ever regresses to a lite serializer, this
    // test still passes but the feed goes blank again, so the adapter
    // comment points at the serializer.
    const activityWire = (message: Record<string, unknown>) => ({
        id: "a1",
        activityType: 5,
        recipientUserId: "u2",
        channelId: "c1",
        channelKind: 2,
        messageId: "m1",
        actor: null,
        message: {
            id: "m1",
            channelId: "c1",
            channelKind: 2,
            sender: null,
            isThreadReply: false,
            ...message,
        },
        isRead: false,
        tsCreated: "2026-07-20T00:00:00Z",
    });

    it("carries the media kind when the message has no preview text", () => {
        const out = v3ActivityToLegacy(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            activityWire({
                bodyText: "",
                body: [
                    { type: "paragraph", content: [] },
                    {
                        type: "image",
                        props: { url: "https://media1.giphy.com/media/abc/giphy.gif" },
                    },
                ],
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            }) as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            { userId: "u2" } as any
        );
        expect(out.firstLineContent).toBe("");
        expect(out.firstLineMediaKind).toBe("gif");
    });

    it("leaves it unset when the message has real text", () => {
        const out = v3ActivityToLegacy(
            activityWire({
                bodyText: "hello",
                body: [{ type: "image", props: { url: "https://x/y.gif" } }],
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            }) as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            { userId: "u2" } as any
        );
        expect(out.firstLineMediaKind).toBeUndefined();
    });
});

describe("derivePreviewMediaKind", () => {
    it("reports a GIF from a GIPHY image block anywhere in the body", () => {
        // The exact shape `insertGif` produces: the picker inserts AFTER
        // the cursor's empty paragraph, which is why first-block-only
        // derivation returned "".
        expect(
            derivePreviewMediaKind([
                { type: "paragraph", content: [] },
                {
                    type: "image",
                    props: {
                        url: "https://media1.giphy.com/media/abc/giphy.gif?cid=x&ct=g",
                        name: "party time",
                    },
                },
            ])
        ).toBe("gif");
    });

    it("distinguishes a non-GIF image", () => {
        expect(
            derivePreviewMediaKind([
                { type: "image", props: { url: "https://cdn.example.com/a.png" } },
            ])
        ).toBe("image");
    });

    it("returns null for a text-only body", () => {
        expect(
            derivePreviewMediaKind([
                { type: "paragraph", content: [{ type: "text", text: "hi", styles: {} }] },
            ])
        ).toBeNull();
        expect(derivePreviewMediaKind(undefined)).toBeNull();
    });
});

const renderRow = (chat: AllChatProps) =>
    render(
        <CssVarsProvider>
            <ChatListItemMessage chat={chat} />
        </CssVarsProvider>
    );

describe("ChatListItemMessage", () => {
    it("labels a GIF-only message instead of rendering a blank row", () => {
        renderRow(
            chatWith({
                latestMessageText: "",
                latestMessage: {
                    content: [
                        { type: "paragraph", content: [] },
                        {
                            type: "image",
                            props: { url: "https://media1.giphy.com/media/abc/giphy.gif" },
                        },
                    ],
                    messageId: 6,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } as any,
            })
        );
        expect(screen.getByText("GIF")).toBeInTheDocument();
    });

    it("renders custom emoji in the preview line as images", () => {
        setTeamEmojiList([partyBlob]);
        renderRow(chatWith({ latestMessageText: "ship it :party-blob:" }));
        expect(screen.getByAltText(":party-blob:")).toHaveAttribute("src", partyBlob.url);
    });

    it("still renders nothing when there is neither text nor media", () => {
        const { container } = renderRow(
            chatWith({
                latestMessageText: "",
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                latestMessage: { content: [{ type: "paragraph", content: [] }] } as any,
            })
        );
        expect(container).toBeEmptyDOMElement();
    });
});
