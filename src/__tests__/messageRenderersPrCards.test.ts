/**
 * PR links in task comments and chat messages are drawn as the full
 * `LinkedPrCard`, hidden for a user without GitHub connected (MIP-1002).
 *
 * MIP-1000 had replaced the card with a one-line chip to save the PR-detail
 * request a card sends at mount; that was reverted because the card is the
 * better component. This pins the choice in both renderers so a chip does not
 * come back by accident. A source check, because the behaviour needs the whole
 * BlockNote render tree to observe.
 */

import { describe, expect, it } from "vitest";

import bnChatPreviewSource from "../components/editors/bnChatPreview.tsx?raw";
import lightMessageBodySource from "../components/messageBody/LightMessageBody.tsx?raw";

describe.each([
    ["LightMessageBody", lightMessageBodySource],
    ["BnChatPreview", bnChatPreviewSource],
])("%s", (_name, source) => {
    it("draws a PR link as the full LinkedPrCard", () => {
        expect(source).toMatch(/<LinkedPrCard\b/);
    });

    it("hides the card when GitHub is not connected", () => {
        expect(source).toMatch(/hideOnNotConnected/);
    });

    it("does not draw a chip", () => {
        expect(source).not.toMatch(/MessagePrUnfurls|LinkedPrCompactRow/);
    });
});
