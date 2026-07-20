import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useChatListItem } from "../../features/chat/hooks/useChatListItem";

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
});
