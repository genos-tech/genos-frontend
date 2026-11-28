/**
 * MIP-2605: the Recent Activities and Flagged messages cards hold an avatar button. The
 * row button is named by the card's text only, so it cannot be taken for that button.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChatListItemForActivity } from "../features/chat/components/sidebar/activity/chatListItemForActivity";
import { ChatListItemForFlagMessages } from "../features/chat/components/sidebar/chatListItemForFlagMessages";

vi.mock("../context/authState", () => ({ useAuth: () => ({ accessToken: "tok" }) }));
vi.mock("../features/chat/hooks/useActivityStatus", () => ({
    useActivityStatus: () => ({ updateActivityReadStatus: vi.fn(), groupedReactions: [] }),
}));
vi.mock("../features/chat/hooks/useMessageReminder", () => ({ useMessageReminder: () => null }));
vi.mock("../services/channel/channelService", () => ({ channelService: {} }));
const AvatarButton = () => <button aria-label="Group profile: Design room" type="button" />;
vi.mock("../components/ui/avatars/GMAvatar", () => ({ GMAvatar: () => <AvatarButton /> }));

afterEach(cleanup);

const myself = { userId: "me", teamId: "t1" } as never;
const useCM = {
    allChats: [{ chatId: "c1", chatType: 2, chatName: "Design room" }],
} as never;
const noop = () => {};
const common = {
    myself,
    setCurrentProject: noop,
    setMyself: noop,
    socket: null,
    useCM,
    useTEM: {} as never,
    useTM: {} as never,
    useUISM: {} as never,
};
const wrap = (ui: React.ReactElement) =>
    render(
        <MemoryRouter>
            <CssVarsProvider>{ui}</CssVarsProvider>
        </MemoryRouter>
    );

const rowButton = () => document.querySelector<HTMLElement>(".MuiListItemButton-root")!;

// jsdom leaves a nested button's label out of a computed name where browsers read it, so
// the name alone would pass without the fix: what the row is labelled BY is asserted too.
const expectNamedByText = (text: string[]) => {
    for (const part of text)
        expect(rowButton()).toHaveAccessibleName(expect.stringContaining(part));
    const avatar = screen.getByRole("button", { name: "Group profile: Design room" });
    const labels = rowButton()
        .getAttribute("aria-labelledby")!
        .split(" ")
        .map((id) => document.getElementById(id))
        .filter((el) => el !== null);
    expect(labels.length).toBeGreaterThan(1);
    expect(labels.filter((el) => el === avatar || el.contains(avatar))).toEqual([]);
};

describe("card row names", () => {
    it("a flagged-message card is named by chat, time and message", () => {
        wrap(
            <ChatListItemForFlagMessages
                {...common}
                selectedFlaggedMessageId=""
                setSelectedFlaggedMessageId={noop}
                viewMode="active"
                flaggedMessage={
                    {
                        flaggedMessageId: "f1",
                        chatType: 2,
                        chatName: "Design room",
                        chatId: "c1",
                        threadId: 0,
                        messageId: "m1",
                        contentText: "Please review the rollout plan",
                        sender: { userId: "u2", username: "Ken" },
                        dmPartnerUser: { userId: "", username: "" },
                        taskId: 0,
                        tsSent: "2026-11-07T10:00:00Z",
                    } as never
                }
            />
        );
        expectNamedByText(["Design room", ":00", "Please review the rollout plan"]);
    });

    it("an activity card is named by chat, time and message", () => {
        wrap(
            <ChatListItemForActivity
                {...common}
                activityMessages={[]}
                selectedActivityId=""
                setSelectedActivityId={noop}
                useNM={{ teamNoteMeta: [], sharedNoteMeta: [] } as never}
                activity={
                    {
                        activityId: "a1",
                        activityType: 3,
                        chatType: 2,
                        chatId: "c1",
                        chatName: "Design room",
                        messageId: 4,
                        messageUniqueKey: "m4",
                        isThread: false,
                        threadId: "",
                        taskId: 0,
                        isRead: false,
                        senderId: "other",
                        firstLineContent: "Can you check the numbers",
                        tsSent: "2026-11-28T10:00:00Z",
                    } as never
                }
            />
        );
        expectNamedByText(["Design room", ":00", "Can you check the numbers"]);
    });
});
