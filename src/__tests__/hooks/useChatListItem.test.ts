import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useChatListItem } from "../../features/chat/hooks/useChatListItem";

// The hook navigates on mobile (the URL is what selects the pane there),
// so it needs a router. Stubbing `useNavigate` rather than mounting a
// MemoryRouter keeps the assertion on the PATH the tap produces.
const navigateMock = vi.fn();
vi.mock("react-router-dom", () => ({
    useNavigate: () => navigateMock,
}));

// `useIsMobile` is viewport-only (`useMediaQuery` under the hood) and the
// test setup's `matchMedia` stub answers "no match" to everything, so the
// default here is DESKTOP. `setViewport("mobile")` flips it.
let isMobileViewport = false;
const setViewport = (kind: "desktop" | "mobile") => {
    isMobileViewport = kind === "mobile";
};
vi.mock("../../hooks/common/useIsMobile", () => ({
    useIsMobile: () => isMobileViewport,
}));

// `syncChannel` returns a NEVER-resolving promise so the test can prove the
// chat is switched BEFORE (and independently of) the background revalidation.
const syncChannelMock = vi.fn(() => new Promise<void>(() => {}));
vi.mock("../../services/channel/channelService", () => ({
    channelService: {
        syncChannel: (...args: unknown[]) => syncChannelMock(...args),
        pinChannel: vi.fn(),
        unpinChannel: vi.fn(),
    },
}));

// Cached read is synchronous and returns immediately from the snapshot.
const readCachedMock = vi.fn(() => [{ messageId: 7 }]);
vi.mock("../../features/chat/services/loadV3SpecificMessages", () => ({
    readV3CachedMessages: (...args: unknown[]) => readCachedMock(...args),
}));

vi.mock("../../utils/sidebarUtils", () => ({ toggleMessagesPane: vi.fn() }));

const makeChat = () =>
    ({
        chatId: "chan-b",
        chatName: "B",
        chatType: 1,
        dmPartnerUser: { userId: "u2" },
        isPinned: false,
        isPrivate: false,
        latestMessage: undefined,
        latestMessageText: "",
        profileImagePath: undefined,
        project: undefined,
        systemUserId: undefined,
        TSLastMessage: "",
    }) as never;

const makeUseCM = () =>
    ({
        isSubChatVisible: false,
        currentSubChat: undefined,
        currentMainChat: { chatId: "chan-a", chatType: 1, chatName: "A" },
        setCurrentMainChat: vi.fn(),
        setCurrentSubChat: vi.fn(),
        setIsMainChatVisible: vi.fn(),
        setIsThreadVisible: vi.fn(),
        setIsSubChatVisible: vi.fn(),
    }) as never;

const useTM = { isCreatingTask: { flag: false }, isTaskPreviewVisible: false } as never;

beforeEach(() => {
    setViewport("desktop");
    // The mobile navigate is skipped when the URL already points at the
    // tapped chat, so each case starts from the chat-type list.
    window.history.replaceState({}, "", "/workspace/chat/dm");
});
afterEach(() => vi.clearAllMocks());

describe("useChatListItem.onClickHandler", () => {
    it("switches the chat SYNCHRONOUSLY, not gated on the network sync", () => {
        const { result } = renderHook(() =>
            useChatListItem({
                chat: makeChat(),
                myself: { userId: "u1" } as never,
                isPinnedChat: false,
            })
        );

        const useCM = makeUseCM() as unknown as {
            setCurrentMainChat: ReturnType<typeof vi.fn>;
            setIsMainChatVisible: ReturnType<typeof vi.fn>;
        };

        // Single synchronous call — no `await`. The managers are handed
        // in at CALL time (not captured at render) so a memoized row
        // can't act on a stale snapshot of them.
        result.current.onClickHandler({ useCM, useTM } as never);

        // The pane is switched IMMEDIATELY, from the cached snapshot,
        // even though `syncChannel` never resolves. This is the guard
        // against regressing back to `loadV3SpecificMessages().then(...)`,
        // which blocked the switch on the REST round-trip (~1s).
        expect(readCachedMock).toHaveBeenCalledWith("chan-b", 1);
        expect(useCM.setCurrentMainChat).toHaveBeenCalledTimes(1);
        expect(useCM.setIsMainChatVisible).toHaveBeenCalledWith(true);

        // Background revalidation was kicked off (still pending).
        expect(syncChannelMock).toHaveBeenCalledWith("chan-b");

        const switched = useCM.setCurrentMainChat.mock.calls[0][0];
        expect(switched.chatId).toBe("chan-b");
        expect(switched.messages).toEqual([{ messageId: 7 }]);
    });

    it("does not touch the URL on desktop — selection stays state-first there", () => {
        const { result } = renderHook(() =>
            useChatListItem({
                chat: makeChat(),
                myself: { userId: "u1" } as never,
                isPinnedChat: false,
            })
        );

        result.current.onClickHandler({ useCM: makeUseCM(), useTM } as never);

        expect(navigateMock).not.toHaveBeenCalled();
    });

    it("navigates to the tapped chat on mobile", () => {
        setViewport("mobile");
        const { result } = renderHook(() =>
            useChatListItem({
                chat: makeChat(),
                myself: { userId: "u1" } as never,
                isPinnedChat: false,
            })
        );

        result.current.onClickHandler({ useCM: makeUseCM(), useTM } as never);

        expect(navigateMock).toHaveBeenCalledWith("/workspace/chat/dm/chan-b");
    });

    it("navigates on mobile even when the tapped chat is ALREADY the selected one", () => {
        // The regression this guards: mobile back drops `:chatId` from the
        // URL but leaves the chat selected, and `useChatRouting`'s state→URL
        // effect is keyed on the chat's identity — so re-tapping the same
        // chat used to fire nothing and the chat never reopened. Same shape
        // as the boot restore of `lastChatId`.
        setViewport("mobile");
        const alreadyOpen = makeChat();
        const { result } = renderHook(() =>
            useChatListItem({
                chat: alreadyOpen,
                myself: { userId: "u1" } as never,
                isPinnedChat: false,
            })
        );

        const useCM = {
            ...(makeUseCM() as object),
            // The pane is on chan-b already; only the URL fell back to the
            // chat-type list.
            currentMainChat: { chatId: "chan-b", chatName: "B", chatType: 1 },
        };

        result.current.onClickHandler({ useCM, useTM } as never);

        expect(navigateMock).toHaveBeenCalledWith("/workspace/chat/dm/chan-b");
    });

    it("skips the navigate when the URL already points at the tapped chat", () => {
        // `navigate` to an identical path still pushes, and a duplicate
        // history entry costs the user two Back presses to leave the chat.
        setViewport("mobile");
        window.history.replaceState({}, "", "/workspace/chat/dm/chan-b");
        const { result } = renderHook(() =>
            useChatListItem({
                chat: makeChat(),
                myself: { userId: "u1" } as never,
                isPinnedChat: false,
            })
        );

        result.current.onClickHandler({ useCM: makeUseCM(), useTM } as never);

        expect(navigateMock).not.toHaveBeenCalled();
    });

    it("builds the path from the chat's own type (MDM keeps its own segment)", () => {
        setViewport("mobile");
        const { result } = renderHook(() =>
            useChatListItem({
                chat: { ...(makeChat() as object), chatType: 4 } as never,
                myself: { userId: "u1" } as never,
                isPinnedChat: false,
            })
        );

        result.current.onClickHandler({ useCM: makeUseCM(), useTM } as never);

        expect(navigateMock).toHaveBeenCalledWith("/workspace/chat/mdm/chan-b");
    });
});
