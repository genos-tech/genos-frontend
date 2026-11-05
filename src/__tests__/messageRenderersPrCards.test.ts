/**
 * PR links in task comments and chat messages are the PR card, loaded when it is
 * looked at (MIP-1003), and hidden for a user without GitHub connected.
 *
 * History: MIP-1000 replaced the card with a one-line chip to save the request a
 * card sends at mount; the card is the component that was liked, so MIP-1002
 * restored it, and MIP-1003 keeps it but starts the request on hover (a full
 * `LinkedPrCard` fetches the moment it mounts). This pins the choice in both
 * renderers: not a chip, and not an eager card. A source check, because the
 * behaviour needs the whole BlockNote render tree to observe.
 */

import { describe, expect, it } from "vitest";

import bnChatPreviewSource from "../components/editors/bnChatPreview.tsx?raw";
import lightMessageBodySource from "../components/messageBody/LightMessageBody.tsx?raw";

describe.each([
    ["LightMessageBody", lightMessageBodySource],
    ["BnChatPreview", bnChatPreviewSource],
])("%s", (_name, source) => {
    it("draws a PR link as the lazy PR card", () => {
        expect(source).toMatch(/<LazyPrCard\b/);
    });

    it("hides the card when GitHub is not connected", () => {
        expect(source).toMatch(/hideOnNotConnected/);
    });

    it("does not draw an eager LinkedPrCard (it fetches at mount) or a chip", () => {
        expect(source).not.toMatch(/<LinkedPrCard\b/);
        expect(source).not.toMatch(/MessagePrUnfurls|LinkedPrCompactRow/);
    });
});
