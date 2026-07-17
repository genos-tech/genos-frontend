/**
 * Read-side units for team custom emoji: the store singleton, the
 * reaction glyph resolver, the v3 MessageBody branch, and the two
 * plain-text preview walkers. (Insertion UX is exercised in the
 * follow-up PR's tests; this suite covers everything that must be
 * able to RENDER a customEmoji before anyone can create one.)
 */
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EmojiGlyph } from "../components/ui/emoji/EmojiGlyph";
import { MessageBody } from "../features/channel/components/MessageBody";
import { deriveBodyText } from "../features/channel/components/MessageComposerV3";
import { getFirstLine } from "../features/chat/utils/common";
import { TeamEmoji } from "../services/teamEmojiApi";
import {
    getTeamEmojiByName,
    getTeamEmojiSnapshot,
    setTeamEmojiList,
    subscribeTeamEmoji,
} from "../services/teamEmojiStore";

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

describe("teamEmojiStore", () => {
    it("indexes by name and notifies subscribers on updates", () => {
        const listener = vi.fn();
        const unsubscribe = subscribeTeamEmoji(listener);

        setTeamEmojiList([partyBlob]);
        expect(getTeamEmojiSnapshot()).toEqual([partyBlob]);
        expect(getTeamEmojiByName("party-blob")).toEqual(partyBlob);
        expect(getTeamEmojiByName("ghost")).toBeUndefined();
        expect(listener).toHaveBeenCalledTimes(1);

        unsubscribe();
        setTeamEmojiList([]);
        expect(listener).toHaveBeenCalledTimes(1);
        expect(getTeamEmojiByName("party-blob")).toBeUndefined();
    });
});

describe("EmojiGlyph", () => {
    it("resolves a known :shortcode: to the catalog image", () => {
        setTeamEmojiList([partyBlob]);
        render(<EmojiGlyph emoji=":party-blob:" />);
        const img = screen.getByTitle(":party-blob:");
        expect(img.tagName).toBe("IMG");
        expect(img).toHaveAttribute("src", partyBlob.url);
        // The editors' image-click zoom/download handlers key off this
        // marker to leave emoji alone.
        expect(img).toHaveAttribute("data-custom-emoji", "true");
    });

    it("falls back to the literal text for unknown shortcodes (deleted emoji)", () => {
        render(<EmojiGlyph emoji=":ghost:" />);
        expect(screen.getByText(":ghost:")).toBeInTheDocument();
        expect(screen.queryByRole("img")).toBeNull();
    });

    it("passes unicode emoji through as text", () => {
        setTeamEmojiList([partyBlob]);
        render(<EmojiGlyph emoji="👍" />);
        expect(screen.getByText("👍")).toBeInTheDocument();
        expect(screen.queryByRole("img")).toBeNull();
    });
});

describe("MessageBody customEmoji branch (v3 pane)", () => {
    it("renders the baked URL as an inline image — no catalog needed", () => {
        render(
            <MessageBody
                body={[
                    {
                        type: "paragraph",
                        content: [
                            { type: "text", text: "ship it ", styles: {} },
                            {
                                type: "customEmoji",
                                props: { name: "party-blob", url: partyBlob.url },
                            },
                        ],
                    },
                ]}
                bodyText="ship it :party-blob:"
                currentUserId={null}
            />
        );
        const img = screen.getByTestId("message-body-custom-emoji-party-blob");
        expect(img).toHaveAttribute("src", partyBlob.url);
    });

    it("degrades to the shortcode text when props carry no URL", () => {
        render(
            <MessageBody
                body={[
                    {
                        type: "paragraph",
                        content: [{ type: "customEmoji", props: { name: "party-blob", url: "" } }],
                    },
                ]}
                bodyText=""
                currentUserId={null}
            />
        );
        expect(screen.getByText(":party-blob:")).toBeInTheDocument();
    });
});

describe("plain-text preview walkers", () => {
    it("getFirstLine renders a customEmoji inline as its shortcode", () => {
        expect(
            getFirstLine({
                type: "paragraph",
                content: [
                    { type: "text", text: "done", styles: {} },
                    { type: "customEmoji", props: { name: "party-blob", url: "x" } },
                ],
            })
        ).toBe("done :party-blob:");
    });

    it("deriveBodyText renders a customEmoji inline as its shortcode", () => {
        expect(
            deriveBodyText([
                {
                    type: "paragraph",
                    content: [
                        { type: "text", text: "done" },
                        { type: "customEmoji", props: { name: "party-blob", url: "x" } },
                    ],
                },
            ])
        ).toBe("done :party-blob:");
    });
});
