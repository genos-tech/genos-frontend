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

        const img = screen.getByTitle(":party-blob:");
        expect(img.tagName).toBe("IMG");
        expect(img).toHaveAttribute("src", partyBlob.url);
        // The surrounding prose survives on both sides of the glyph.
        expect(screen.getByText(/shipped it/)).toBeInTheDocument();
        expect(screen.getByText(/today/)).toBeInTheDocument();
    });

    it("resolves several shortcodes in one line", () => {
        setTeamEmojiList([partyBlob]);
        render(<EmojiText text=":party-blob: x :party-blob:" />);
        expect(screen.getAllByTitle(":party-blob:")).toHaveLength(2);
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
        expect(screen.getByTitle(":party-blob:")).toHaveAttribute("src", partyBlob.url);
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
