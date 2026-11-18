/**
 * The phone's "More" sheet carries the rail's History (MIP-1277, Ken chose option A: five tabs,
 * the last one renamed from Account to More), and the bottom bar carries To-Do (MIP-1687).
 *
 * History had no entry point on a phone at all; it opens over the current page, so the sheet
 * closes first and then fires the same handler the desktop rail uses. To-Do was a row of this
 * sheet; on a phone it is now a tab of the bar, so it is not repeated here.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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
            />
        </CssVarsProvider>
    );
    return { onClose, onOpenHistory };
};

beforeEach(() => {
    todoVisible = true;
});

describe("the More sheet", () => {
    it("opens History, closing itself first", async () => {
        const user = userEvent.setup();
        const { onClose, onOpenHistory } = renderSheet();

        await user.click(screen.getByRole("button", { name: "History" }));
        expect(onOpenHistory).toHaveBeenCalledTimes(1);
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(onClose.mock.invocationCallOrder[0]).toBeLessThan(
            onOpenHistory.mock.invocationCallOrder[0]
        );
    });

    it("lists History above the account rows", () => {
        renderSheet();
        const names = screen
            .getAllByRole("button")
            .map((b) => b.textContent ?? "")
            .filter((n) => /History|Team Profile|Switch team|Settings|Sign out/i.test(n));
        expect(names[0]).toMatch(/History/);
        expect(names.findIndex((n) => /Settings/.test(n))).toBeGreaterThan(0);
    });

    it("does not repeat To-Do, whatever the Settings → Sidebar toggle says: the bar has it", () => {
        for (const visible of [true, false]) {
            todoVisible = visible;
            const { unmount } = render(
                <CssVarsProvider>
                    <MobileAccountSheet
                        myself={myself}
                        open={true}
                        setMyself={vi.fn()}
                        socket={null}
                        useCM={{} as never}
                        useTEM={{ teamMemberProfiles: {} } as never}
                        useUISM={{} as never}
                        onClose={vi.fn()}
                        onOpenHistory={vi.fn()}
                    />
                </CssVarsProvider>
            );
            expect(screen.queryByRole("button", { name: "To-Do" })).not.toBeInTheDocument();
            unmount();
        }
    });
});

const mountBar = (
    over: { onOpenMore?: () => void; onOpenTodo?: () => void; path?: string } = {}
) => {
    window.history.replaceState({}, "", over.path ?? "/workspace/tasks");
    return render(
        <CssVarsProvider>
            <BrowserRouter>
                <BottomTabBar
                    useCM={{ unReadChatAndActivityCounts: 0 } as never}
                    useIM={{ unReadInboxItemCount: 0 } as never}
                    onOpenMore={over.onOpenMore ?? vi.fn()}
                    onOpenTodo={over.onOpenTodo ?? vi.fn()}
                />
            </BrowserRouter>
        </CssVarsProvider>
    );
};
const tabNames = () => screen.getAllByRole("button").map((b) => b.textContent?.trim() ?? "");

describe("the tab bar's To-Do tab (MIP-1687)", () => {
    it("is there, between Notes and More", () => {
        mountBar();
        expect(tabNames()).toEqual(["Inbox", "Chats", "Tasks", "Notes", "To-Do", "More"]);
    });

    it("opens the To-Do list, and only that: not the More sheet, and the page does not change", async () => {
        const onOpenTodo = vi.fn();
        const onOpenMore = vi.fn();
        mountBar({ onOpenTodo, onOpenMore, path: "/workspace/notes" });
        await userEvent.setup().click(screen.getByRole("button", { name: "To-Do" }));
        expect(onOpenTodo).toHaveBeenCalledTimes(1);
        expect(onOpenMore).not.toHaveBeenCalled();
        expect(window.location.pathname).toBe("/workspace/notes");
    });

    it("is never the current tab, whatever the route", () => {
        for (const path of ["/workspace/chat", "/workspace/tasks", "/workspace/todo"]) {
            const { unmount } = mountBar({ path });
            expect(screen.getByRole("button", { name: "To-Do" })).not.toHaveAttribute(
                "aria-current"
            );
            unmount();
        }
    });

    it("follows the Settings → Sidebar toggle: off, and it is gone", () => {
        todoVisible = false;
        mountBar();
        expect(tabNames()).toEqual(["Inbox", "Chats", "Tasks", "Notes", "More"]);
    });

    it("More still opens the sheet", async () => {
        const onOpenMore = vi.fn();
        const onOpenTodo = vi.fn();
        mountBar({ onOpenMore, onOpenTodo });
        await userEvent.setup().click(screen.getByRole("button", { name: "More" }));
        expect(onOpenMore).toHaveBeenCalledTimes(1);
        expect(onOpenTodo).not.toHaveBeenCalled();
    });

    it("the app hands the bar the same opener as the sheet used to have", () => {
        const app = readFileSync(
            join(dirname(fileURLToPath(import.meta.url)), "../App.tsx"),
            "utf8"
        ).replace(/\s+/g, " ");
        expect(app).toMatch(/<BottomTabBar[\s\S]{0,300}?onOpenTodo=\{ toggleTodoModal \}/);
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
                        onOpenTodo={vi.fn()}
                    />
                </BrowserRouter>
            </CssVarsProvider>
        );
        expect(screen.queryByText("Account")).not.toBeInTheDocument();
        await userEvent.setup().click(screen.getByText("More"));
        await waitFor(() => expect(onOpenMore).toHaveBeenCalledTimes(1));
    });
});
