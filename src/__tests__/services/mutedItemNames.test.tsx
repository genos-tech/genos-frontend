// Settings → Notifications must never label a muted row with a raw id.
//
// The regression these lock down: a mute stores its display name as a snapshot
// taken when the bell was clicked, and the two unnamed chat kinds hand it an
// EMPTY name — a DM whose partner didn't resolve, and an MDM, which has no
// title on either side of the wire. The API drops an empty label, so the panel
// fell through to printing `chatId` / `targetId`, i.e. a bare UUID that tells
// the user nothing about what they muted.

import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { chatDisplayName } from "../../features/chat/utils/chatDisplayName";
import { NotificationsProvider } from "../../services/notifications/NotificationsContext";
import { NotificationSettingsPanel } from "../../services/notifications/NotificationSettingsPanel";
import {
    DEFAULT_NOTIFICATION_PREFERENCE,
    MutedChatRef,
    MutedTargetRef,
    NotificationPreference,
} from "../../services/notifications/types";
import { UserProps } from "../../types/admin";
import { AllChatProps } from "../../types/chat";

// The pause editor owns a live clock/timezone; the digest hook fetches. Neither
// has anything to do with how a muted row is named.
vi.mock("../../services/notifications/NotificationPausePicker", () => ({
    NotificationPauseSection: () => null,
}));
vi.mock("../../hooks/common/useDigestPreference", () => ({
    useDigestPreference: () => ({
        digestEnabled: false,
        setDigestEnabled: () => undefined,
        emailDigestEnabled: false,
        setEmailDigestEnabled: () => undefined,
    }),
}));

const MDM_CHAT_ID = "c252bc6d-3c43-4ca2-8d4c-b7ea6af14803";
const DM_CHAT_ID = "a1111111-2222-3333-4444-555555555555";
const THREAD_ID = "9f8e7d6c-5b4a-3210-9876-543210fedcba";

const user = (userId: string, userName: string): UserProps => ({ userId, userName }) as UserProps;

const MYSELF = user("me-1", "Me");

// Only the fields `chatDisplayName` reads; the real row is far wider.
const chatRow = (over: Partial<AllChatProps>): AllChatProps =>
    ({ dmPartnerUser: user("", ""), ...over }) as AllChatProps;

const renderPanel = (
    prefs: Partial<NotificationPreference>,
    opts: {
        allChats?: AllChatProps[];
        teamMemberProfiles?: Record<string, UserProps>;
    } = {}
) => {
    const ctx = {
        preferences: { ...DEFAULT_NOTIFICATION_PREFERENCE, ...prefs },
        permission: "granted",
        requestPermission: () => undefined,
        setMasterEnabled: () => undefined,
        setEmailEnabled: () => undefined,
        setEmailCategoryEnabled: () => undefined,
        setGroupEnabled: () => undefined,
        setSubCategoryEnabled: () => undefined,
        unmute: () => undefined,
        unmuteTarget: () => undefined,
    };
    return render(
        <CssVarsProvider>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <NotificationsProvider value={ctx as any}>
                <NotificationSettingsPanel
                    allChats={opts.allChats}
                    myself={MYSELF}
                    teamMemberProfiles={opts.teamMemberProfiles}
                />
            </NotificationsProvider>
        </CssVarsProvider>
    );
};

const mutedChat = (over: Partial<MutedChatRef>): MutedChatRef =>
    ({ chatType: 1, chatId: DM_CHAT_ID, ...over }) as MutedChatRef;

const mutedTarget = (over: Partial<MutedTargetRef>): MutedTargetRef =>
    ({ targetType: "thread", targetId: THREAD_ID, ...over }) as MutedTargetRef;

describe("chatDisplayName", () => {
    it("joins MDM member names, resolved live", () => {
        const name = chatDisplayName(
            chatRow({
                chatType: 4,
                chatName: "",
                mdmMembers: [
                    { userId: "u-1", userName: "stale" },
                    { userId: "u-2", userName: "Bob" },
                ],
            }),
            MYSELF,
            { "u-1": user("u-1", "Alice") }
        );
        expect(name).toBe("Alice, Bob");
    });

    it("collapses past three MDM members", () => {
        const name = chatDisplayName(
            chatRow({
                chatType: 4,
                chatName: "",
                mdmMembers: ["A", "B", "C", "D", "E"].map((n) => ({
                    userId: `u-${n}`,
                    userName: n,
                })),
            }),
            MYSELF,
            {}
        );
        expect(name).toBe("A, B, C +2");
    });

    it("prefers a DM partner's current name over the snapshot on the row", () => {
        const name = chatDisplayName(
            chatRow({ chatType: 1, chatName: "Old Name", dmPartnerUser: user("u-9", "Old Name") }),
            MYSELF,
            { "u-9": user("u-9", "New Name") }
        );
        expect(name).toBe("New Name");
    });

    it("passes a GM/PM title straight through", () => {
        expect(chatDisplayName(chatRow({ chatType: 2, chatName: "#design" }), MYSELF, {})).toBe(
            "#design"
        );
    });

    it("returns empty — never an id — when nothing resolves", () => {
        expect(chatDisplayName(chatRow({ chatType: 4, chatName: "" }), MYSELF, {})).toBe("");
        expect(chatDisplayName(undefined, MYSELF, {})).toBe("");
    });
});

describe("muted chats are named, not id'd", () => {
    it("names a muted MDM from its members even though the mute stored no name", () => {
        renderPanel(
            { mutedChats: [mutedChat({ chatType: 4, chatId: MDM_CHAT_ID })] },
            {
                allChats: [
                    chatRow({
                        chatType: 4,
                        chatId: MDM_CHAT_ID,
                        chatName: "",
                        mdmMembers: [
                            { userId: "u-1", userName: "Alice" },
                            { userId: "u-2", userName: "Bob" },
                        ],
                    }),
                ],
            }
        );
        expect(screen.getByText("Alice, Bob")).toBeTruthy();
        expect(screen.queryByText(MDM_CHAT_ID)).toBeNull();
    });

    it("re-resolves a renamed DM partner instead of showing the stored name", () => {
        renderPanel(
            { mutedChats: [mutedChat({ chatName: "Old Name" })] },
            {
                allChats: [
                    chatRow({
                        chatType: 1,
                        chatId: DM_CHAT_ID,
                        chatName: "Old Name",
                        dmPartnerUser: user("u-9", "Old Name"),
                    }),
                ],
                teamMemberProfiles: { "u-9": user("u-9", "New Name") },
            }
        );
        expect(screen.getByText("New Name")).toBeTruthy();
        expect(screen.queryByText("Old Name")).toBeNull();
    });

    it("falls back to a generic when the chat is gone and no name was stored", () => {
        renderPanel({ mutedChats: [mutedChat({ chatType: 4, chatId: MDM_CHAT_ID })] });
        expect(screen.getByText("Unnamed conversation")).toBeTruthy();
        expect(screen.queryByText(MDM_CHAT_ID)).toBeNull();
    });

    it("still honours a stored name for a chat no longer in the list", () => {
        renderPanel({ mutedChats: [mutedChat({ chatType: 2, chatName: "#design" })] });
        expect(screen.getByText("#design")).toBeTruthy();
    });
});

describe("muted items are named, not id'd", () => {
    it("never shows a thread UUID when the mute carries no label", () => {
        renderPanel({ mutedTargets: [mutedTarget({})] });
        expect(screen.getByText("Untitled thread")).toBeTruthy();
        expect(screen.queryByText(THREAD_ID)).toBeNull();
    });

    it("shows the captured thread label when there is one", () => {
        renderPanel({ mutedTargets: [mutedTarget({ label: "Alice: ship the v3 header" })] });
        expect(screen.getByText("Alice: ship the v3 header")).toBeTruthy();
    });

    it("names an unlabelled task by its user-facing number", () => {
        renderPanel({ mutedTargets: [mutedTarget({ targetType: "task", targetId: "42" })] });
        expect(screen.getByText("Task #42")).toBeTruthy();
    });

    it("names an unlabelled note by its user-facing number", () => {
        renderPanel({ mutedTargets: [mutedTarget({ targetType: "note", targetId: "7" })] });
        expect(screen.getByText("Note #7")).toBeTruthy();
    });

    it("resolves a `chat` target live, like the coarse list does", () => {
        renderPanel(
            {
                mutedTargets: [
                    mutedTarget({ targetType: "chat", targetId: MDM_CHAT_ID, chatType: 4 }),
                ],
            },
            {
                allChats: [
                    chatRow({
                        chatType: 4,
                        chatId: MDM_CHAT_ID,
                        chatName: "",
                        mdmMembers: [{ userId: "u-1", userName: "Alice" }],
                    }),
                ],
            }
        );
        expect(screen.getByText("Alice")).toBeTruthy();
        expect(screen.queryByText(MDM_CHAT_ID)).toBeNull();
    });
});
