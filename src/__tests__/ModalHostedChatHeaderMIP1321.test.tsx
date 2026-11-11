/**
 * MIP-1321: a chat opened in the preview dialog has no page around it. The header must not
 * draw the controls that drive the PAGE behind the dialog: the "Back to Chat" arrow (it
 * navigates the page; the dialog's own Close is the way out), the to-do pane toggle, swap
 * chats and "new task" (the dialog wires them to nothing visible).
 *
 * Rendered for real: the header is mounted with and without the dialog's host context, at the
 * phone layout and the desktop one.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NoteModalHostZIndexProvider } from "../components/modals/noteModalHostZIndex";
import { MainChatPaneHeader } from "../features/chat/components/headers/MainChatPaneHeader";
import type { ChatProps } from "../types/chat";

const mobile = vi.hoisted(() => ({ value: true }));
vi.mock("../hooks/common/useIsMobile", () => ({ useIsMobile: () => mobile.value }));
vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "token" }) }));
vi.mock("../context/CalendarModalContext", () => ({ useCalendarModal: () => null }));
vi.mock("../i18n", async () => {
    const { en } = await import("../i18n/locales/en");
    return { useTranslation: () => ({ t: en }) };
});
vi.mock("../features/chat/components/headers/HeaderUserName", () => ({
    HeaderUserName: () => <span>Partner</span>,
}));
vi.mock("../features/chat/components/modals/ModalAddMembers", () => ({
    ModalAddMembers: () => null,
}));
vi.mock("../features/chat/components/modals/ModalShareMeetLink", () => ({
    ModalShareMeetLink: () => null,
}));
vi.mock("../features/chat/hooks/useMarkAllChatActivityRead", () => ({
    useMarkAllChatActivityRead: () => ({ markAllAsRead: vi.fn() }),
}));
vi.mock("../services/notifications/MuteToggleButton", () => ({
    MuteToggleButton: () => <button aria-label="Mute notifications" />,
    MuteMenuItem: () => <li role="menuitem">Mute in menu</li>,
}));

afterEach(cleanup);

const chat = (chatType: number, partnerId: string) =>
    ({
        chatId: "c1",
        chatName: "",
        chatType,
        dmPartnerUser: { userId: partnerId },
        messages: [],
    }) as unknown as ChatProps;

const renderHeader = ({
    hosted,
    chatType = 1,
    partner = "me",
    subChat = false,
}: {
    hosted: boolean;
    chatType?: number;
    partner?: string;
    subChat?: boolean;
}) => {
    const useCM = {
        allChats: [],
        isSubChatVisible: subChat,
        activityMessages: [],
    };
    const props = {
        chat: chat(chatType, partner),
        incompleteTodoCount: 0,
        isToDoVisible: false,
        myself: { userId: "me" },
        setIsToDoVisible: vi.fn(),
        setMyself: vi.fn(),
        socket: null,
        useCM,
        useTEM: { teamMemberProfiles: [] },
        useTM: {},
        useUISM: {},
    } as unknown as React.ComponentProps<typeof MainChatPaneHeader>;
    const header = (
        <CssVarsProvider>
            <MainChatPaneHeader {...props} />
        </CssVarsProvider>
    );
    render(
        hosted ? (
            <NoteModalHostZIndexProvider value={10020}>{header}</NoteModalHostZIndexProvider>
        ) : (
            header
        )
    );
};

const openMenu = () => fireEvent.click(screen.getByRole("button", { name: /more options/i }));

describe("the phone chat header in the preview dialog", () => {
    it("draws no Back to Chat arrow (page: it does)", () => {
        mobile.value = true;
        renderHeader({ hosted: false });
        expect(screen.getByRole("button", { name: "Back to Chat" })).toBeTruthy();
        cleanup();
        renderHeader({ hosted: true });
        expect(screen.queryByRole("button", { name: "Back to Chat" })).toBeNull();
    });

    it("self-DM: mute takes the visible slot instead of the dead to-do toggle", () => {
        mobile.value = true;
        renderHeader({ hosted: true });
        expect(screen.queryByRole("button", { name: /to-do/i })).toBeNull();
        expect(screen.getByRole("button", { name: "Mute notifications" })).toBeTruthy();
        openMenu();
        expect(screen.queryByText("Mute in menu")).toBeNull();
    });

    it("self-DM on the page keeps the to-do toggle and the mute row in the menu", () => {
        mobile.value = true;
        renderHeader({ hosted: false });
        expect(screen.getByRole("button", { name: /to-do/i })).toBeTruthy();
        openMenu();
        expect(screen.getByText("Mute in menu")).toBeTruthy();
    });

    it("swap chats and new task are page controls: gone in the dialog, kept on the page", () => {
        mobile.value = true;
        renderHeader({ hosted: false, chatType: 3, partner: "other", subChat: true });
        openMenu();
        expect(screen.getByText("Swap chats")).toBeTruthy();
        expect(screen.getByText(/new task|create task/i)).toBeTruthy();
        cleanup();
        renderHeader({ hosted: true, chatType: 3, partner: "other", subChat: true });
        openMenu();
        expect(screen.queryByText("Swap chats")).toBeNull();
        expect(screen.queryByText(/new task|create task/i)).toBeNull();
    });
});

describe("the desktop chat header in the preview dialog", () => {
    it("draws no to-do toggle, swap or new-task button; the page header keeps them", () => {
        mobile.value = false;
        renderHeader({ hosted: false, chatType: 3, partner: "other", subChat: true });
        expect(screen.getByRole("button", { name: "Swap chats" })).toBeTruthy();
        cleanup();
        renderHeader({ hosted: true, chatType: 3, partner: "other", subChat: true });
        expect(screen.queryByRole("button", { name: "Swap chats" })).toBeNull();
        cleanup();
        renderHeader({ hosted: false });
        // The desktop to-do toggle has a tooltip but no accessible name: find it by its icon.
        expect(screen.getByTestId("ChecklistRoundedIcon")).toBeTruthy();
        cleanup();
        renderHeader({ hosted: true });
        expect(screen.queryByTestId("ChecklistRoundedIcon")).toBeNull();
    });
});

describe("the thread header in the preview dialog", () => {
    // Not rendered: the thread header pulls in the whole thread context. Source-level, like the
    // MIP-1296 check of its Close button; the dialog passes `hostZIndex`.
    it("draws no Back to Chat arrow while hosted", () => {
        const source = readFileSync(
            join(
                dirname(fileURLToPath(import.meta.url)),
                "../features/chat/components/headers/ThreadChatPaneHeader.tsx"
            ),
            "utf8"
        );
        expect(source).toMatch(/const isModalHosted = hostZIndex != null;/);
        expect(source).toMatch(
            /\{!isModalHosted && \(\s*<IconButton[^>]*onClick=\{handleMobileBack\}/
        );
    });
});
