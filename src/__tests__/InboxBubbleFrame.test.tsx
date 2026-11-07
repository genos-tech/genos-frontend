/**
 * InboxBubble on the shared Bubble frame (MIP-1130): a flat card (no tail), the
 * request type's chip takes a status ROLE where the hue is that status, and the
 * deadline line is the danger role. jsdom cannot paint, but emotion's rules are
 * in the document, so the role names are readable from the computed style.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { InboxBubble } from "../features/inbox/components/InboxBubble";
import type { InboxItemProps } from "../types/common";

vi.mock("../components/editors/bnChatPreview", () => ({
    BnChatPreview: () => <div data-testid="bn-preview" />,
}));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));

const item = (itemType: number): InboxItemProps => ({
    itemId: 1,
    itemType,
    itemBody: [{ content: [{ text: "someone is asking" }] }],
    isRead: false,
    requestStatus: "pending",
    tsSent: "2026-07-30T00:00:00Z",
    itemOptionals:
        itemType === 5 ? { kind: "team_ownership_claim", deadline: "2026-08-29T00:00:00Z" } : {},
});

const mount = (i: InboxItemProps) =>
    render(
        <CssVarsProvider>
            <InboxBubble
                inboxItem={i}
                myself={{ userId: "u1", teamId: "t1" } as never}
                setMyself={vi.fn()}
                socket={null}
                useCM={{ allChats: [] } as never}
                useTEM={{ teamMemberProfiles: {} } as never}
                useUISM={{} as never}
            />
        </CssVarsProvider>
    );

describe("InboxBubble frame", () => {
    it("is a card on the Bubble frame", () => {
        const { container } = mount(item(5));
        expect(container.querySelector('[data-bubble-layout="bubble"]')).not.toBeNull();
    });

    it("has no gradient anywhere on the card", () => {
        const { container } = mount(item(5));
        const withGradient = Array.from(container.querySelectorAll("*")).filter((el) =>
            getComputedStyle(el).backgroundImage.includes("gradient")
        );
        // The primary Approve button keeps its (palette) gradient: it is a Button.
        const nonButtons = withGradient.filter((el) => !el.closest("button"));
        expect(nonButtons).toEqual([]);
    });

    it.each([
        [5, "danger"],
        [1, "info"],
        [2, "success"],
        [4, "warning"],
    ])("type %i chip uses the %s role", (type, role) => {
        mount(item(type));
        const chip = document.querySelector(".MuiChip-root") as HTMLElement;
        expect(getComputedStyle(chip).color).toContain(`--g-${role}-text`);
        expect(getComputedStyle(chip).getPropertyValue("background")).toContain(
            `--g-${role}-subtle`
        );
    });

    it("the claim's respond-by line is the danger role", () => {
        mount(item(5));
        const line = screen.getByText(/Aug\. 29, 2026/);
        expect(getComputedStyle(line).color).toContain("--g-danger-text");
    });
});
