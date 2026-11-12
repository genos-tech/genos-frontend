/**
 * The Flagged pane has a History button on its section row (MIP-1423): one click to the
 * flags already marked done, without opening the "…" menu. It is the same switch as the
 * menu's "View past flagged" and is shown only on the Flagged pane.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChatSidebar } from "../features/chat/components/sidebar/ChatSidebar";

vi.mock("../features/chat/components/sidebar/ChatList", () => ({
    ChatList: (props: { flaggedViewMode?: string }) => (
        <div data-testid="chat-list" data-view={props.flaggedViewMode ?? ""} />
    ),
}));
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
vi.mock("../hooks/common/usePersonalGMTags", () => ({
    usePersonalGMTags: () => ({ tags: [], assignmentsByChannelId: {} }),
}));
vi.mock("../features/chat/hooks/useMarkFilteredActivityRead", () => ({
    useMarkFilteredActivityRead: () => ({ markFilteredAsRead: vi.fn() }),
}));
vi.mock("../features/chat/hooks/useWarmRecentChannels", () => ({
    useWarmRecentChannels: () => undefined,
}));

const FLAGGED = 6;
const ACTIVITY = 5;

const renderSidebar = (paneType: number) => {
    const funcSetPastFlaggedMessages = vi.fn().mockResolvedValue(undefined);
    const useCM = {
        activityMessages: [],
        allChats: [],
        currentChatPaneType: paneType,
        flaggedMessages: [],
        funcSetPastFlaggedMessages,
        unReadActivityMessageCounts: 0,
        unReadChatCounts: {},
    };
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
                useCM={useCM as never}
                usePM={{} as never}
                useTEM={{} as never}
                useTM={{} as never}
                useUISM={{} as never}
            />
        </CssVarsProvider>
    );
    return { funcSetPastFlaggedMessages };
};

const button = () => screen.queryByTestId("toggle-past-flagged-button");
const view = () => screen.getByTestId("chat-list").getAttribute("data-view");

afterEach(cleanup);

describe("the Flagged pane's history button", () => {
    it("is on the Flagged pane", () => {
        renderSidebar(FLAGGED);
        expect(button()).not.toBeNull();
        expect(button()?.getAttribute("aria-label")).toBe("View completed flags");
        expect(button()?.getAttribute("aria-pressed")).toBe("false");
    });

    it("is not on any other pane", () => {
        renderSidebar(ACTIVITY);
        expect(button()).toBeNull();
    });

    it("switches to the done flags and loads them, then back", () => {
        const { funcSetPastFlaggedMessages } = renderSidebar(FLAGGED);
        expect(view()).toBe("active");

        fireEvent.click(button()!);
        expect(view()).toBe("past");
        expect(funcSetPastFlaggedMessages).toHaveBeenCalledTimes(1);
        expect(button()?.getAttribute("aria-pressed")).toBe("true");
        expect(button()?.getAttribute("aria-label")).toBe("View active flags");

        fireEvent.click(button()!);
        expect(view()).toBe("active");
        // Going back reads nothing new.
        expect(funcSetPastFlaggedMessages).toHaveBeenCalledTimes(1);
    });
});
