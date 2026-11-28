// MIP-2588: pressing a project's or a DM partner's avatar in a row opens only its profile, and
// those rows no longer hold the avatar inside the row's button.
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { hasButtonAvatar } from "../features/chat/components/sidebar/activity/hasButtonAvatar";
import { ChatListItemAvatar } from "../features/chat/components/sidebar/ChatListItemAvatar";

vi.mock("../features/admin/components/modals/ModalProjectProfile", () => ({
    ModalProjectProfile: () => null,
}));
// The DM avatar's button and, like the real one, the profile it draws beside it.
vi.mock("../components/ui/avatars/avatarWithStatus", () => ({
    AvatarWithStatus: () => <button type="button">Bruno</button>,
}));

const press = (chat: Record<string, unknown>) => {
    const openRow = vi.fn();
    render(
        <CssVarsProvider>
            <div onClick={openRow}>
                <ChatListItemAvatar
                    chat={chat as never}
                    chatType={chat.chatType as number}
                    isYou={false}
                    myself={{} as never}
                    setMyself={vi.fn()}
                    socket={null}
                    useCM={{ allChats: [] } as never}
                    useTEM={{ teamMemberProfiles: {} } as never}
                    useUISM={{} as never}
                />
            </div>
        </CssVarsProvider>
    );
    fireEvent.click(screen.getByRole("button"));
    return openRow;
};

describe("a press on a row's avatar stays on the avatar", () => {
    it("a project's", () => {
        expect(press({ chatId: "p", chatType: 3, chatName: "Alpha" })).not.toHaveBeenCalled();
    });

    it("a DM partner's", () => {
        const openRow = press({
            chatId: "d",
            chatType: 1,
            chatName: "Bruno",
            dmPartnerUser: { userId: "u2", userName: "Bruno" },
        });
        expect(openRow).not.toHaveBeenCalled();
    });
});

describe("activity rows with an avatar button", () => {
    it("is every row but a personal note's mention", () => {
        const kinds = [1, 2, 3, 4, 5, 7, 8].map((chatType) =>
            hasButtonAvatar({ chatType } as never)
        );
        expect(kinds).toEqual([true, true, true, true, true, true, true]);
        expect(hasButtonAvatar({ chatType: 6 } as never)).toBe(false);
    });
});
