/**
 * The phone's "More" sheet carries the rail's To-Do and History (MIP-1277,
 * Ken chose option A: five tabs, the last one renamed from Account to More).
 *
 * Before, History had no entry point on a phone at all and To-Do was only
 * reachable inside Chats. Both open over the current page, so the sheet
 * closes first and then fires the same handler the desktop rail uses.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BottomTabBar } from "../components/layout/BottomTabBar";
import { MobileAccountSheet } from "../components/layout/MobileAccountSheet";
import type { UserProps } from "../types/admin";

vi.mock("../hooks/common/useIsMobile", () => ({ useIsMobile: () => true }));
vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "token" }),
    useOptionalAccessToken: () => "token",
}));
let todoVisible = true;
vi.mock("../hooks/common/useSidebarVisibility", () => ({
    HIDEABLE_SIDEBAR_ITEMS: ["inbox", "chats", "tasks", "notes", "todo"],
    useSidebarVisibility: () => ({
        loading: false,
        isVisible: (key: string) => (key === "todo" ? todoVisible : true),
        setVisible: () => {},
    }),
}));
vi.mock("../hooks/common/useSignOut", () => ({ useSignOut: () => vi.fn() }));
vi.mock("../features/admin/services/loadMyTeams", async (importOriginal) => ({
    ...((await importOriginal()) as object),
    loadMyTeams: () => Promise.resolve([]),
}));
vi.mock("../features/admin/services/switchTeam", () => ({ switchTeam: vi.fn() }));
vi.mock("../features/admin/components/modals/ModalTeamProfile", () => ({
    ModalTeamProfile: () => null,
}));
vi.mock("../features/admin/components/modals/ModalUserProfile", () => ({
    UserProfile: () => null,
}));
vi.mock("../components/layout/SettingsModal", () => ({ SettingsModal: () => null }));
vi.mock("../components/ui/avatars/UserAvatar", () => ({ UserAvatar: () => <div /> }));

const myself = { userId: "u-me", teamId: "t-mine", teamName: "Team t-mine" } as UserProps;

const renderSheet = () => {
    const onClose = vi.fn();
    const onOpenTodo = vi.fn();
    const onOpenHistory = vi.fn();
    render(
        <CssVarsProvider>
            <MobileAccountSheet
                myself={myself}
                open={true}
                setMyself={vi.fn()}
                socket={null}
                useCM={{} as never}
                useTEM={{ teamMemberProfiles: {} } as never}
                useUISM={{} as never}
                onClose={onClose}
                onOpenHistory={onOpenHistory}
                onOpenTodo={onOpenTodo}
            />
        </CssVarsProvider>
    );
    return { onClose, onOpenTodo, onOpenHistory };
};

beforeEach(() => {
    todoVisible = true;
});

describe("the More sheet", () => {
    it("opens To-Do and History, closing itself first", async () => {
        const user = userEvent.setup();
        const { onClose, onOpenTodo, onOpenHistory } = renderSheet();

        await user.click(screen.getByRole("button", { name: "To-Do" }));
        expect(onOpenTodo).toHaveBeenCalledTimes(1);
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(onClose.mock.invocationCallOrder[0]).toBeLessThan(
            onOpenTodo.mock.invocationCallOrder[0]
        );

        await user.click(screen.getByRole("button", { name: "History" }));
        expect(onOpenHistory).toHaveBeenCalledTimes(1);
        expect(onClose).toHaveBeenCalledTimes(2);
    });

    it("lists them in the rail's order, above the account rows", () => {
        renderSheet();
        const names = screen
            .getAllByRole("button")
            .map((b) => b.textContent ?? "")
            .filter((n) => /To-Do|History|Team Profile|Switch team|Settings|Sign out/i.test(n));
        expect(names[0]).toMatch(/To-Do/);
        expect(names[1]).toMatch(/History/);
        expect(names.findIndex((n) => /Settings/.test(n))).toBeGreaterThan(1);
    });

    it("follows the Settings → Sidebar toggle for To-Do, as the rail does", () => {
        todoVisible = false;
        renderSheet();
        expect(screen.queryByRole("button", { name: "To-Do" })).not.toBeInTheDocument();
        // History has no toggle.
        expect(screen.getByRole("button", { name: "History" })).toBeInTheDocument();
    });
});

describe("the tab bar's last tab", () => {
    it("is called More and opens the sheet", async () => {
        const onOpenMore = vi.fn();
        render(
            <CssVarsProvider>
                <BrowserRouter>
                    <BottomTabBar
                        useCM={{ unReadChatAndActivityCounts: 0 } as never}
                        useIM={{ unReadInboxItemCount: 0 } as never}
                        onOpenMore={onOpenMore}
                    />
                </BrowserRouter>
            </CssVarsProvider>
        );
        expect(screen.queryByText("Account")).not.toBeInTheDocument();
        await userEvent.setup().click(screen.getByText("More"));
        await waitFor(() => expect(onOpenMore).toHaveBeenCalledTimes(1));
    });
});
