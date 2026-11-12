/**
 * MIP-1163: the flagged-message card's Complete / Reopen / Unflag buttons live
 * in `NavItem`'s actions slot, beside the card, not inside the row's own button
 * (a button inside a button is invalid HTML, and browsers do not reliably deliver
 * the inner click). They stay always visible, and the time label stays shown on a
 * phone (MIP-1177).
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { cssOf } from "./utils/cssOf";

import { ChatListItemForFlagMessages } from "../features/chat/components/sidebar/chatListItemForFlagMessages";

const service = vi.hoisted(() => ({
    completeFlag: vi.fn().mockResolvedValue(undefined),
    reopenFlag: vi.fn().mockResolvedValue(undefined),
    unflagMessage: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../services/channel/channelService", () => ({ channelService: service }));
vi.mock("../features/chat/hooks/useMessageReminder", () => ({ useMessageReminder: () => null }));
vi.mock("../components/ui/avatars/avatarWithStatus", () => ({ AvatarWithStatus: () => null }));
vi.mock("../components/ui/avatars/GMAvatar", () => ({ GMAvatar: () => null }));
vi.mock("../components/ui/avatars/MDMAvatar", () => ({ MDMAvatar: () => null }));
vi.mock("../components/ui/avatars/ProjectAvatar", () => ({ ProjectAvatar: () => null }));

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

const FLAG = {
    flaggedMessageId: "f1",
    chatType: 1,
    chatName: "Ken",
    chatId: "c1",
    threadId: 0,
    messageId: "m1",
    contentText: "Please review the rollout plan",
    sender: { userId: "u2", username: "Ken" },
    dmPartnerUser: { userId: "u2", username: "Ken" },
    taskId: 0,
    tsSent: "2026-11-07T10:00:00Z",
};

const mount = (viewMode: "active" | "past" = "active") =>
    render(
        <MemoryRouter>
            <CssVarsProvider>
                <ChatListItemForFlagMessages
                    flaggedMessage={FLAG as never}
                    myself={{ userId: "me" } as never}
                    selectedFlaggedMessageId=""
                    setCurrentProject={() => {}}
                    setMyself={() => {}}
                    setSelectedFlaggedMessageId={() => {}}
                    socket={null}
                    useCM={{ allChats: [] } as never}
                    useTEM={{} as never}
                    useTM={{} as never}
                    useUISM={{} as never}
                    viewMode={viewMode}
                />
            </CssVarsProvider>
        </MemoryRouter>
    );

const slot = () => document.querySelector(".NavItem-actions") as HTMLElement;
const rowButton = () => document.querySelector(".MuiListItemButton-root") as HTMLElement;

describe("flagged-message card actions", () => {
    it("Complete and Unflag sit in the actions slot, not inside the row button", () => {
        mount();
        expect(slot()).not.toBeNull();
        const buttons = [...slot().querySelectorAll("button")];
        expect(buttons).toHaveLength(2);
        // No interactive control is nested in the row's own button.
        expect(rowButton().querySelectorAll("button, [role='button']")).toHaveLength(0);
        expect(slot().closest(".MuiListItemButton-root")).toBeNull();
    });

    it("the past view has Reopen and Remove there instead", () => {
        mount("past");
        expect(slot().querySelectorAll("button")).toHaveLength(2);
        fireEvent.click(slot().querySelectorAll("button")[0]);
        expect(service.reopenFlag).toHaveBeenCalledWith("m1");
        expect(service.completeFlag).not.toHaveBeenCalled();
    });

    it("each button does its own thing and does not open the card", () => {
        const onRowClick = vi.fn();
        const { container } = mount();
        rowButton().addEventListener("click", onRowClick);
        const [complete, unflag] = [...slot().querySelectorAll("button")];
        fireEvent.click(complete);
        expect(service.completeFlag).toHaveBeenCalledWith("m1");
        fireEvent.click(unflag);
        expect(service.unflagMessage).toHaveBeenCalledWith("m1");
        expect(onRowClick).not.toHaveBeenCalled();
        expect(container).toBeTruthy();
    });

    it("the buttons are always visible (the keep class), not a hover extra, and reachable by Tab", () => {
        mount();
        for (const b of slot().querySelectorAll("button")) {
            expect(b.classList.contains("NavItem-keep")).toBe(true);
            expect(b.tabIndex).not.toBe(-1);
        }
        // The slot's fade rule skips them.
        expect(cssOf(slot())).toContain(":not(.NavItem-keep)");
    });

    it("the actions stack in a column beside the card", () => {
        mount();
        const row = slot().parentElement as HTMLElement;
        expect(cssOf(row)).toMatch(/\.NavItem-actions\s*\{[^}]*flex-direction:\s*column/);
    });

    it("the time stays shown on a phone (MIP-1177): no responsive display rule on it", () => {
        mount();
        const time = screen.getByText(/\d{1,2}:\d{2}/);
        expect(cssOf(time)).not.toMatch(/display:\s*none/);
    });

    it("the reminder chip colours come from the tokens", () => {
        mount();
        expect(cssOf(rowButton())).not.toMatch(/#c4b5fd|#7c3aed/i);
    });
});
