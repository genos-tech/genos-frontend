/**
 * A flagged message shows "Mark done" on its hover toolbar, whatever the user pinned
 * (MIP-1423).
 *
 * Mark done finishes the flag (`channelService.completeFlag`: kept as done, moved to the
 * history), the same as the Flagged list's own button. "Remove flag" deletes it and stays
 * in the "…" menu. While the message is flagged, Mark done takes the flag's place on the
 * toolbar, so a pinned flag never shows twice and the menu never loses "Remove flag".
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BubbleMoreMenu } from "../features/chat/components/bubbles/BubbleMoreMenu";
import { BubbleThreadMoreMenu } from "../features/chat/components/bubbles/BubbleThreadMoreMenu";
import {
    MARK_DONE_ACTION,
    pinnedForFlagState,
    withMarkDone,
} from "../features/chat/components/bubbles/markDoneAction";
import { BubbleActionsPreferenceProvider } from "../hooks/common/useBubbleActionsPreference";
import { channelService } from "../services/channel/channelService";

vi.mock("../features/chat/components/modals/ModalDeleteMessage", () => ({
    ModalDeleteMessage: () => null,
}));

const MARK_DONE = "Mark done";

const baseMessage = {
    messageId: "m-1",
    messageIdWithChatId: "ch-1#m-1",
    messageIdWithChatIdAndThreadId: "ch-1#th-1#m-1",
    content: "hello",
    numReplies: 0,
    taskId: null,
    isFlagged: false,
    sender: { userId: "u-1", userName: "Me", isSystemUser: false },
};

const renderMenu = (kind: "main" | "thread", isFlagged: boolean) => {
    const message = { ...baseMessage, isFlagged };
    const common = {
        accessToken: "tok",
        flaggedMessages: [],
        isSent: false,
        message: message as never,
        myself: { userId: "u-1", teamId: "t-1" } as never,
        setEditTargetMessage: vi.fn(),
        setFlaggedMessages: vi.fn(),
        setIsInEdit: vi.fn(),
        setUnwrapAll: vi.fn(),
        setUnwrapCode: vi.fn(),
        socket: null,
        unwrapAll: false,
        unwrapCode: false,
        useCM: { flaggedMessages: [] } as never,
    };
    render(
        <CssVarsProvider>
            <BubbleActionsPreferenceProvider>
                {kind === "main" ? (
                    <BubbleMoreMenu
                        {...common}
                        chat={{ chatId: "ch-1", chatType: 2 } as never}
                        replyHandler={vi.fn()}
                        setCurrentChat={vi.fn()}
                        usePM={{} as never}
                        useTM={{} as never}
                    />
                ) : (
                    <BubbleThreadMoreMenu
                        {...common}
                        currentMessageIndex={0}
                        setCurrentThreadChat={vi.fn()}
                        setTargetMessageIndex={vi.fn()}
                        thread={{ chatId: "ch-1", threadId: "th-1", chatType: 2 } as never}
                    />
                )}
            </BubbleActionsPreferenceProvider>
        </CssVarsProvider>
    );
};

const pin = (...ids: string[]) =>
    window.localStorage.setItem("genos-bubble-pinned-actions-v1", JSON.stringify(ids));
/** The "…" is the last button: the toolbar's buttons render before it. */
const trigger = () => screen.getAllByRole("button").at(-1) as HTMLElement;
const toolbar = () =>
    screen
        .getAllByRole("button")
        .slice(0, -1)
        .map((b) => b.getAttribute("aria-label"));
const menuLabels = () => {
    fireEvent.click(trigger());
    return screen.getAllByRole("menuitem").map((el) => el.textContent);
};

let completeFlag: ReturnType<typeof vi.spyOn>;
let unflagMessage: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    window.localStorage.clear();
    completeFlag = vi.spyOn(channelService, "completeFlag").mockResolvedValue(undefined);
    unflagMessage = vi.spyOn(channelService, "unflagMessage").mockResolvedValue(undefined);
});
afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

describe.each(["main", "thread"] as const)("a flagged message (%s bubble)", (kind) => {
    const v3Id = kind === "main" ? "ch-1#m-1" : "ch-1#th-1#m-1";

    it("shows Mark done on the toolbar when nothing is pinned", () => {
        renderMenu(kind, true);
        expect(toolbar()).toEqual([MARK_DONE]);
    });

    it("keeps Remove flag in the menu", () => {
        renderMenu(kind, true);
        expect(menuLabels()).toContain("Remove flag");
    });

    it("puts Mark done in the pinned flag's place, never both", () => {
        pin("copyLink", "flag", "edit");
        renderMenu(kind, true);
        expect(toolbar()).toEqual(["Copy message link", MARK_DONE, "Edit message"]);
        expect(toolbar()).not.toContain("Remove flag");
        // The flag came back to the menu, so Remove flag is still one click away.
        expect(menuLabels()).toContain("Remove flag");
    });

    it("sits where the flag would when other actions are pinned", () => {
        pin("copyLink", "edit");
        renderMenu(kind, true);
        expect(toolbar()).toEqual(["Copy message link", MARK_DONE, "Edit message"]);
    });

    it("finishes the flag, not deletes it", () => {
        renderMenu(kind, true);
        fireEvent.click(screen.getByRole("button", { name: MARK_DONE }));
        expect(completeFlag).toHaveBeenCalledWith(v3Id);
        expect(unflagMessage).not.toHaveBeenCalled();
    });

    it("goes back to Flag for later once done", () => {
        renderMenu(kind, true);
        fireEvent.click(screen.getByRole("button", { name: MARK_DONE }));
        expect(toolbar()).toEqual([]);
        expect(menuLabels()).toContain("Flag for later");
    });
});

describe.each(["main", "thread"] as const)("an unflagged message (%s bubble)", (kind) => {
    it("shows no Mark done", () => {
        renderMenu(kind, false);
        expect(screen.queryByRole("button", { name: MARK_DONE })).toBeNull();
    });

    it("keeps a pinned flag as Flag for later", () => {
        pin("flag");
        renderMenu(kind, false);
        expect(toolbar()).toEqual(["Flag for later"]);
    });
});

describe("the toolbar rules", () => {
    const action = (id: string) => ({ id, label: id, icon: null, onClick: () => {} }) as never;
    const ids = (list: { id: string }[]) => list.map((a) => a.id);

    it("unpins the flag only while the message is flagged", () => {
        expect(pinnedForFlagState(["reply", "flag"], true)).toEqual(["reply"]);
        expect(pinnedForFlagState(["reply", "flag"], false)).toEqual(["reply", "flag"]);
    });

    it("adds Mark done at the flag's rank, or not at all", () => {
        const done = action(MARK_DONE_ACTION);
        expect(ids(withMarkDone([action("reply"), action("delete")], done))).toEqual([
            "reply",
            MARK_DONE_ACTION,
            "delete",
        ]);
        expect(ids(withMarkDone([action("reply")], done))).toEqual(["reply", MARK_DONE_ACTION]);
        expect(ids(withMarkDone([action("edit")], done))).toEqual([MARK_DONE_ACTION, "edit"]);
        expect(ids(withMarkDone([action("reply")], null))).toEqual(["reply"]);
    });
});
