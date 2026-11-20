/**
 * MIP-1715: the chat sidebar's "…" menu has "Recently deleted groups", which opens the dialog for
 * the current team.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChatSidebar } from "../features/chat/components/sidebar/ChatSidebar";
import { en } from "../i18n/locales/en";

vi.mock("../features/chat/components/sidebar/ChatList", () => ({ ChatList: () => null }));
vi.mock("../features/chat/components/sidebar/ChatSearch", () => ({ ChatSearch: () => null }));
vi.mock("../features/chat/components/sidebar/ChatSidebarDividers", () => ({
    ActivityDivider: () => null,
}));
vi.mock("../features/chat/components/sidebar/GMTagFilterRow", () => ({
    GMTagFilterRow: () => null,
}));
vi.mock("../features/chat/components/modals/ModalCreateGM", () => ({ ModalCreateGM: () => null }));
vi.mock("../features/chat/components/modals/ModalCreateMDM", () => ({
    ModalCreateMDM: () => null,
}));
vi.mock("../features/chat/components/modals/ModalJoinGM", () => ({ ModalJoinGM: () => null }));
vi.mock("../features/chat/components/modals/ModalRecentlyDeletedChats", () => ({
    ModalRecentlyDeletedChats: (p: { open: boolean; teamId: string }) =>
        p.open ? <div data-team={p.teamId} data-testid="recently-deleted" /> : null,
}));
vi.mock("../hooks/common/usePersonalGMTags", () => ({
    usePersonalGMTags: () => ({ tags: [], assignmentsByChannelId: {} }),
}));
vi.mock("../features/chat/hooks/useMarkFilteredActivityRead", () => ({
    useMarkFilteredActivityRead: () => ({ markFilteredAsRead: vi.fn() }),
}));
vi.mock("../features/chat/hooks/useWarmRecentChannels", () => ({
    useWarmRecentChannels: () => undefined,
}));

afterEach(cleanup);

describe("the chat sidebar menu", () => {
    it("opens Recently deleted groups for the current team", () => {
        render(
            <CssVarsProvider>
                <ChatSidebar
                    chatRouting={{ navigateToChatType: vi.fn() } as never}
                    incompleteTodoCount={0}
                    isToDoVisible={false}
                    myself={{ userId: "u-1", teamId: "t-1" } as never}
                    setIsToDoVisible={vi.fn()}
                    setMyself={vi.fn()}
                    socket={null}
                    usePM={{} as never}
                    useTEM={{} as never}
                    useTM={{} as never}
                    useUISM={{} as never}
                    useCM={
                        {
                            activityMessages: [],
                            allChats: [],
                            currentChatPaneType: 1,
                            flaggedMessages: [],
                            funcSetPastFlaggedMessages: vi.fn(),
                            unReadActivityMessageCounts: 0,
                            unReadChatCounts: {},
                        } as never
                    }
                />
            </CssVarsProvider>
        );
        expect(screen.queryByTestId("recently-deleted")).toBeNull();

        fireEvent.click(screen.getByRole("button", { name: /more/i }));
        fireEvent.click(screen.getByText(en.common.recentlyDeleted.menu));

        expect(screen.getByTestId("recently-deleted").getAttribute("data-team")).toBe("t-1");
    });
});
