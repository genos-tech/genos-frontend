/**
 * MIP-1943: the follow-up soft delete that tells the open chat runs AFTER the server has erased the
 * message. If it throws, the dialog must not say "Nothing was removed": that is false by then.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BubbleMoreMenu } from "../features/chat/components/bubbles/BubbleMoreMenu";
import { BubbleActionsPreferenceProvider } from "../hooks/common/useBubbleActionsPreference";
import { en } from "../i18n/locales/en";

const forceDeleteMessage = vi.hoisted(() => vi.fn());
const deleteMessage = vi.hoisted(() => vi.fn());

vi.mock("../services/forceDelete", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../services/forceDelete")>()),
    forceDeleteMessage,
}));
vi.mock("../features/chat/services/deleteMessage", () => ({ deleteMessage }));
vi.mock("../features/chat/components/modals/ModalDeleteMessage", () => ({
    ModalDeleteMessage: () => null,
}));

const message = {
    messageId: "m-1",
    messageIdWithChatId: "ch-1#m-1",
    messageIdWithChatIdAndThreadId: "ch-1#th-1#m-1",
    content: "hello",
    numReplies: 0,
    taskId: null,
    isFlagged: false,
    chatType: 2,
    chatId: "ch-1",
    sender: { userId: "u-1", userName: "Me", isSystemUser: false },
};

describe("Delete permanently on a chat message", () => {
    beforeEach(() => {
        forceDeleteMessage.mockReset().mockResolvedValue({ deleted: true });
        deleteMessage.mockReset().mockRejectedValue(new Error("network"));
    });

    it("does not claim nothing was removed when only the follow-up failed", async () => {
        render(
            <CssVarsProvider>
                <BubbleActionsPreferenceProvider>
                    <BubbleMoreMenu
                        accessToken="tok"
                        chat={{ chatId: "ch-1", chatType: 2 } as never}
                        flaggedMessages={[]}
                        isSent={false}
                        message={message as never}
                        myself={{ userId: "u-1", teamId: "t-1" } as never}
                        replyHandler={vi.fn()}
                        setCurrentChat={vi.fn()}
                        setEditTargetMessage={vi.fn()}
                        setFlaggedMessages={vi.fn()}
                        setIsInEdit={vi.fn()}
                        setUnwrapAll={vi.fn()}
                        setUnwrapCode={vi.fn()}
                        socket={null}
                        unwrapAll={false}
                        unwrapCode={false}
                        useCM={{ flaggedMessages: [] } as never}
                        usePM={{} as never}
                        useTM={{} as never}
                    />
                </BubbleActionsPreferenceProvider>
            </CssVarsProvider>
        );
        fireEvent.click(screen.getAllByRole("button").at(-1) as HTMLElement);
        fireEvent.click(screen.getByRole("menuitem", { name: en.common.forceDelete.menu }));
        fireEvent.change(await screen.findByRole("textbox"), { target: { value: "DELETE" } });
        fireEvent.click(
            screen.getAllByRole("button", { name: en.common.forceDelete.confirm }).at(-1)!
        );
        await waitFor(() => expect(deleteMessage).toHaveBeenCalled());
        expect(screen.queryByText(/Nothing was removed/)).toBeNull();
    });
});
