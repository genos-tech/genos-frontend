// MIP-2567: a multi-person DM stores no title, so its History rows had no chat name.
import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HistoryModal } from "../components/layout/HistoryModal";

const chatsEntries: unknown[] = [];

vi.mock("../hooks/common/historyState", () => ({
    useHistory: () => ({
        chatsEntries,
        tasksEntries: [],
        notesEntries: [],
        clear: vi.fn(),
        record: vi.fn(),
    }),
}));

vi.mock("../components/ui/avatars/AvatarContext", () => ({
    useAvatarContext: () => ({
        myself: { userId: "u1", userName: "Me" },
        teamMemberProfiles: { u2: { userId: "u2", userName: "Bo Renamed" } },
    }),
    useOptionalAvatarContext: () => null,
    useResolvedUserName: (_id: string, fallback: string) => fallback,
}));

afterEach(() => {
    chatsEntries.length = 0;
});

const mdm = {
    chatType: 4,
    chatId: "m1",
    chatName: "",
    mdmMembers: [
        { userId: "u1", userName: "Me" },
        { userId: "u2", userName: "Bo" },
    ],
};

/* eslint-disable @typescript-eslint/no-explicit-any */
const renderModal = () =>
    render(
        <CssVarsProvider>
            <HistoryModal
                useCM={{ allChats: [mdm] } as any}
                usePM={{} as any}
                useSM={{} as any}
                useTM={{} as any}
                open
                onClose={vi.fn()}
                onOpenChat={vi.fn()}
                onOpenMilestone={vi.fn()}
                onOpenNote={vi.fn()}
                onOpenTask={vi.fn()}
                onOpenThread={vi.fn()}
            />
        </CssVarsProvider>
    );

describe("History names a multi-person DM by its members", () => {
    it("on a chat row recorded with an empty label", () => {
        chatsEntries.push({
            kind: "chat",
            chatType: 4,
            chatId: "m1",
            label: "",
            messageId: 3,
            messageText: "hello",
            openedAt: 1,
        });
        renderModal();
        expect(screen.getByText("Me, Bo Renamed")).toBeInTheDocument();
    });

    it("on a thread row recorded with the chat id as its label", () => {
        chatsEntries.push({
            kind: "thread",
            chatType: 4,
            chatId: "m1",
            threadId: "t1",
            label: "#m1",
            openedAt: 1,
        });
        renderModal();
        expect(screen.getByText("Me, Bo Renamed")).toBeInTheDocument();
        expect(screen.queryByText("#m1")).toBeNull();
    });
});
