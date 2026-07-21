/**
 * Emoji-only detection behind the enlarged ("jumbo") message rendering.
 *
 * The interesting cases are the ones where a naive rule breaks: emoji
 * built out of several code points (skin tone, ZWJ families, flags,
 * keycaps) must count as ONE emoji, and `"123"` must not count as three
 * — `\p{Emoji}` matches ASCII digits because keycaps are built from
 * them, which is the trap this detector is shaped to avoid.
 */

import { describe, expect, it } from "vitest";

import {
    countEmojiOnlyBody,
    isJumboEmojiBody,
    MAX_JUMBO_EMOJI,
} from "../components/messageBody/emojiOnlyBody";

/** A body as the renderer sees it: paragraphs, trailing one sliced off. */
const para = (...content: unknown[]) => ({ type: "paragraph", content });
const text = (t: string) => ({ type: "text", text: t, styles: {} });
const custom = (name = "party") => ({
    type: "customEmoji",
    props: { name, url: `https://example.com/${name}.png` },
});

describe("countEmojiOnlyBody — emoji-only bodies", () => {
    it("counts multi-code-point emoji as one each", () => {
        expect(countEmojiOnlyBody([para(text("👍"))])).toBe(1);
        expect(countEmojiOnlyBody([para(text("👍🏽"))])).toBe(1); // skin tone
        expect(countEmojiOnlyBody([para(text("👨‍👩‍👧‍👦"))])).toBe(1); // ZWJ family
        expect(countEmojiOnlyBody([para(text("🇯🇵"))])).toBe(1); // flag
        expect(countEmojiOnlyBody([para(text("1️⃣"))])).toBe(1); // keycap
    });

    it("ignores whitespace between and around emoji", () => {
        expect(countEmojiOnlyBody([para(text("  🎉   🎉 "))])).toBe(2);
    });

    it("counts custom (team) emoji, alone and mixed with unicode", () => {
        expect(countEmojiOnlyBody([para(custom())])).toBe(1);
        expect(countEmojiOnlyBody([para(text("🎉"), custom(), text(" 🎉"))])).toBe(3);
    });

    it("accepts a bare string inline (BlockNote's shorthand)", () => {
        expect(countEmojiOnlyBody([para("🎉")])).toBe(1);
    });

    it("spans multiple paragraphs, skipping empty ones", () => {
        expect(
            countEmojiOnlyBody([
                para(text("🎉")),
                { type: "paragraph", content: [] },
                para(custom()),
            ])
        ).toBe(2);
    });
});

describe("countEmojiOnlyBody — bodies that are NOT emoji-only", () => {
    it("rejects digits, which a `\\p{Emoji}` rule would wrongly accept", () => {
        expect(countEmojiOnlyBody([para(text("123"))])).toBe(0);
        expect(countEmojiOnlyBody([para(text("#"))])).toBe(0);
        expect(countEmojiOnlyBody([para(text("*"))])).toBe(0);
    });

    it("rejects any non-emoji character alongside the emoji", () => {
        expect(countEmojiOnlyBody([para(text("🎉 a"))])).toBe(0);
        expect(countEmojiOnlyBody([para(text("nice 🎉"))])).toBe(0);
        expect(countEmojiOnlyBody([para(text("🎉!"))])).toBe(0);
    });

    it("rejects non-emoji inline content", () => {
        const mention = { type: "mention", props: { userId: "u1", userName: "Alex" } };
        const link = { type: "link", href: "https://example.com", content: [text("🎉")] };
        expect(countEmojiOnlyBody([para(text("🎉"), mention)])).toBe(0);
        expect(countEmojiOnlyBody([para(link)])).toBe(0);
    });

    it("rejects blocks that carry their own formatting", () => {
        expect(countEmojiOnlyBody([{ type: "heading", content: [text("🎉")] }])).toBe(0);
        expect(countEmojiOnlyBody([{ type: "bulletListItem", content: [text("🎉")] }])).toBe(0);
        expect(countEmojiOnlyBody([{ ...para(text("🎉")), children: [para(text("🎉"))] }])).toBe(
            0
        );
    });

    it("rejects empty / whitespace-only / malformed bodies without throwing", () => {
        expect(countEmojiOnlyBody([])).toBe(0);
        expect(countEmojiOnlyBody([para()])).toBe(0);
        expect(countEmojiOnlyBody([para(text("   "))])).toBe(0);
        expect(countEmojiOnlyBody(undefined)).toBe(0);
        expect(countEmojiOnlyBody("not blocks")).toBe(0);
        expect(countEmojiOnlyBody([null])).toBe(0);
        expect(countEmojiOnlyBody([para(null)])).toBe(0);
    });
});

describe("isJumboEmojiBody", () => {
    it("enlarges an emoji-only body up to the cap, and not beyond", () => {
        const many = (n: number) => [para(text("🎉".repeat(n)))];
        expect(isJumboEmojiBody(many(1))).toBe(true);
        expect(isJumboEmojiBody(many(MAX_JUMBO_EMOJI))).toBe(true);
        // A wall of jumbo emoji is worse than a small one.
        expect(isJumboEmojiBody(many(MAX_JUMBO_EMOJI + 1))).toBe(false);
    });

    it("never enlarges a body that isn't emoji-only", () => {
        expect(isJumboEmojiBody([para(text("hello 🎉"))])).toBe(false);
    });
});
