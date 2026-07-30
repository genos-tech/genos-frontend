/**
 * InboxBubble — the note-access request's "Open note" affordance.
 *
 * A note-access request (itemType 4) whose optionals reference a PERSONAL
 * note (note_type 1) renders a clickable chip that opens the note in the
 * URL-link modal via `openModalByHref('/workspace/notes/my/<id>')`. Task
 * and chat notes lack the ids to build a URL, so they render no chip.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { InboxBubble } from "../features/inbox/components/InboxBubble";
import { UrlLinkModalProvider } from "../hooks/common/UrlLinkModalContext";
import type { InboxItemProps } from "../types/common";

// BnChatPreview transitively imports the BlockNote stack — stub it.
vi.mock("../components/editors/bnChatPreview", () => ({
    BnChatPreview: () => <div data-testid="bn-preview" />,
}));

// InboxBubble reads the access token to answer ownership claims
// (itemType 5) over HTTP, and `useAuth` throws outside a provider.
// Same stub as InboxBubbleTargetChip.test.tsx.
vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "tok" }),
}));

const baseItem: InboxItemProps = {
    itemId: 1,
    itemType: 4,
    itemBody: [{ content: [{ text: "wants access" }] }],
    isRead: false,
    requestStatus: "pending",
    tsSent: "2026-07-13T00:00:00Z",
};

const renderBubble = (item: InboxItemProps, openModalByHref = vi.fn()) => {
    render(
        <CssVarsProvider>
            <UrlLinkModalProvider value={{ openModalByHref }}>
                <InboxBubble
                    inboxItem={item}
                    myself={{ userId: "u1", teamId: "t1" } as never}
                    setMyself={vi.fn()}
                    socket={null}
                    useCM={{ allChats: [] } as never}
                    useTEM={{ teamMemberProfiles: {} } as never}
                    useUISM={{} as never}
                />
            </UrlLinkModalProvider>
        </CssVarsProvider>
    );
    return openModalByHref;
};

describe("InboxBubble note-access open affordance", () => {
    it("opens a personal note in the modal on click", () => {
        const open = renderBubble({
            ...baseItem,
            itemOptionals: { note_type: 1, note_id: 433, note_title: "Q3 Strategy" },
        });
        // Joy Chip's clickable action is an overlay button, not the label.
        fireEvent.click(screen.getByRole("button", { name: /Q3 Strategy/ }));
        expect(open).toHaveBeenCalledWith("/workspace/notes/my/433");
    });

    it("renders no open chip for a task note (no routable ids)", () => {
        renderBubble({
            ...baseItem,
            itemOptionals: { note_type: 2, note_id: 433, note_title: "Spec" },
        });
        expect(screen.queryByText(/Spec/)).toBeNull();
    });

    it("renders no open chip when there are no optionals", () => {
        const open = renderBubble({ ...baseItem, itemOptionals: null });
        expect(open).not.toHaveBeenCalled();
        // No note chip; the request card (approve/reject) still renders.
        expect(screen.queryByRole("button", { name: /open/i })).toBeNull();
    });
});
