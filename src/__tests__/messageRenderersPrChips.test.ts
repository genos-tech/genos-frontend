/**
 * Neither message renderer may draw a full `LinkedPrCard` for a PR link
 * (MIP-1000): a full card fetches the PR detail at mount, so a task whose
 * comments list a dozen PRs sent a dozen requests the moment it opened. A
 * renderer that needs a PR link uses `MessagePrUnfurls`, whose chips fetch on
 * hover. A source check, because the behaviour itself needs the whole
 * BlockNote render tree to observe.
 */

import { describe, expect, it } from "vitest";

import bnChatPreviewSource from "../components/editors/bnChatPreview.tsx?raw";
import lightMessageBodySource from "../components/messageBody/LightMessageBody.tsx?raw";

describe.each([
    ["LightMessageBody", lightMessageBodySource],
    ["BnChatPreview", bnChatPreviewSource],
])("%s", (_name, source) => {
    it("draws PR links through MessagePrUnfurls", () => {
        expect(source).toMatch(/<MessagePrUnfurls\b/);
    });

    it("does not import or draw the full LinkedPrCard", () => {
        expect(source).not.toMatch(/\bLinkedPrCard\b/);
    });
});
