/**
 * The target chip as `InboxBubble` actually mounts it.
 *
 * `resolveInboxTarget` is unit-tested separately; this covers the wiring the
 * resolver can't: that a join request renders the chip, that clicking it opens
 * the target's profile, and that an unresolvable target renders nothing rather
 * than a chip that opens nothing.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { InboxTargetChip } from "../features/inbox/components/InboxTargetChip";
import type { AllChatProps } from "../types/chat";
import type { InboxItemProps } from "../types/common";

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "tok" }),
}));

// The profile modals drag in the whole chat/admin stack; the chip's job is to
// pick the right one and open it, which is all we assert.
vi.mock("../features/admin/components/modals/ModalProjectProfile", () => ({
    ModalProjectProfile: ({ openModalProjectProfile }: { openModalProjectProfile: boolean }) =>
        openModalProjectProfile ? <div data-testid="project-profile" /> : null,
}));
vi.mock("../features/chat/components/modals/ModalGMProfile", () => ({
    ModalGMProfile: ({ openModalGMProfile }: { openModalGMProfile: boolean }) =>
        openModalGMProfile ? <div data-testid="gm-profile" /> : null,
}));
vi.mock("../features/admin/components/modals/ModalTeamProfile", () => ({
    ModalTeamProfile: () => null,
}));
vi.mock("../features/admin/components/modals/ModalUserProfile", () => ({
    UserProfile: () => null,
}));
vi.mock("../features/admin/services/loadMyTeams", () => ({
    loadMyTeams: vi.fn().mockResolvedValue([]),
}));

const PM_CHAT = {
    chatId: "pm-uuid",
    chatType: 3,
    chatName: "Apollo",
    project: { projectId: 42 },
} as unknown as AllChatProps;

const GM_CHAT = { chatId: "gm-uuid", chatType: 2, chatName: "Squad" } as unknown as AllChatProps;

const renderChip = (itemType: number, itemOptionals: Record<string, unknown> | null) =>
    render(
        <CssVarsProvider>
            <InboxTargetChip
                inboxItem={{ itemId: 1, itemBody: [], itemType, itemOptionals } as InboxItemProps}
                myself={{ userId: "u", teamId: "t", teamName: "My Team" } as never}
                setMyself={vi.fn()}
                socket={null}
                useCM={{ allChats: [PM_CHAT, GM_CHAT] } as never}
                useTEM={{ currentTeam: { teamName: "My Team" }, teamMemberProfiles: {} } as never}
                useUISM={{} as never}
            />
        </CssVarsProvider>
    );

describe("InboxTargetChip", () => {
    it("shows the project name and opens the project profile on click", () => {
        renderChip(2, { project_id: 42, project_name: "Apollo" });

        // Joy renders `onClick` onto an overlay action <button>, not the
        // label (which is `pointer-events: none`) — click what a user clicks.
        expect(screen.getByText("Apollo")).toBeTruthy();
        expect(screen.queryByTestId("project-profile")).toBeNull();

        fireEvent.click(screen.getByRole("button"));

        expect(screen.getByTestId("project-profile")).toBeTruthy();
    });

    it("shows the GM name and opens the GM profile on click", () => {
        renderChip(3, { gm_id: "gm-uuid", gm_name: "Squad" });

        expect(screen.getByText("Squad")).toBeTruthy();
        fireEvent.click(screen.getByRole("button"));

        expect(screen.getByTestId("gm-profile")).toBeTruthy();
    });

    it("shows the team name for a team request", () => {
        renderChip(1, { team_name: "Genos" });
        expect(screen.getByText("Genos")).toBeTruthy();
    });

    it("renders nothing when the project isn't resolvable — never a dead chip", () => {
        const { container } = renderChip(2, { project_id: 999 });
        expect(container).toBeEmptyDOMElement();
    });

    it("renders nothing for an activity item", () => {
        const { container } = renderChip(0, null);
        expect(container).toBeEmptyDOMElement();
    });
});
