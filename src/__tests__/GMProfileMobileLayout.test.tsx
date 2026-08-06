/**
 * The GM profile modal must actually render its body.
 *
 * Everything below the title — avatar, group name, owner, the member
 * roster, privacy, created date — lived inside one Stack carrying
 * `display: { xs: "none", md: "flex" }`, and no other branch rendered a
 * mobile version of any of it. The dialog around it had meanwhile been
 * made full-screen on xs (with a close button added precisely because
 * "mobile users have no way to dismiss the modal"), so opening the group
 * profile on a phone produced a full-screen sheet with a title and
 * nothing else.
 *
 * `toBeVisible` cannot catch this one. MUI emits a responsive `display` as
 * two `@media` blocks (`min-width:0px` for xs, `min-width:900px` for md),
 * and jsdom ignores the contents of `@media` entirely — it computed plain
 * `block` for the hidden Stack and would have called it visible either
 * way. So `hidingRule` below reads the emitted CSS instead, which is the
 * only place the breakpoint exists.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ModalGMProfile } from "../features/chat/components/modals/ModalGMProfile";
import type { UserProps } from "../types/admin";
import type { AllChatProps } from "../types/chat";

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "token" }),
    useOptionalAccessToken: () => "token",
}));

// The modal derives its whole model from the v3 snapshot. One channel and
// one member is enough to render every section under test.
const CHANNEL_ID = "11111111-1111-4111-8111-111111111111";
const snapshot = {
    channels: new Map([
        [
            CHANNEL_ID,
            {
                id: CHANNEL_ID,
                title: "Launch crew",
                ownerId: "u-owner",
                legacyChatId: 42,
                isPrivate: false,
                isExternal: false,
                profileImageUrl: "",
                tsCreated: "2026-01-02T03:04:05Z",
            },
        ],
    ]),
    membersByChannel: new Map([
        [
            CHANNEL_ID,
            [
                {
                    userId: "u-owner",
                    memberRole: "owner",
                    tsJoined: "2026-01-02T03:04:05Z",
                    user: { userName: "Ada", userEmail: "ada@example.com", avatarImgPath: "" },
                },
            ],
        ],
    ]),
};

vi.mock("../services/channel/channelService", () => ({
    channelService: {
        getSnapshot: () => snapshot,
        subscribe: () => () => {},
        refreshChannelMembers: () => Promise.resolve(),
        syncChannel: () => Promise.resolve(),
    },
}));

// Leaves that reach for their own context or network. The layout under
// test is the modal body, not what these fetch.
vi.mock("../components/ui/avatars/AvatarContext", () => ({
    useUserProfile: () => ({ userName: "Ada", userEmail: "ada@example.com" }),
}));
vi.mock("../components/ui/avatars/avatarWithStatus", () => ({
    AvatarWithStatus: () => <div />,
}));
vi.mock("../components/ui/memberRoles/MemberRoleControl", () => ({
    MemberRoleControl: () => <div />,
}));
vi.mock("../features/chat/components/modals/ExternalSharesPanel", () => ({
    ExternalSharesPanel: () => <div />,
}));
vi.mock("../features/chat/components/modals/ModalAddMembers", () => ({
    ModalAddMembers: () => null,
}));
vi.mock("../features/chat/utils/channelIdResolvers", () => ({
    resolveLegacyChatId: () => 42,
}));

const myself = { userId: "u-me", teamId: "t-1", teamName: "Team" } as UserProps;
const gmChat = { chatId: CHANNEL_ID, chatType: 2, chatName: "Launch crew" } as AllChatProps;

const renderModal = () =>
    render(
        <CssVarsProvider>
            <ModalGMProfile
                gmChat={gmChat}
                myself={myself}
                openModalGMProfile={true}
                setAvatarUserId={vi.fn()}
                setMyself={vi.fn()}
                setOpenModalGMProfile={vi.fn()}
                setOpenUserProfile={vi.fn()}
                socket={null}
                useCM={{ allChats: [], funcSetAllChats: vi.fn(), setAllChats: vi.fn() } as never}
                useTEM={{ teamMemberProfiles: {} } as never}
                useUISM={{} as never}
            />
        </CssVarsProvider>
    );

/**
 * The emitted class rule that hides `el` or any ancestor, at any
 * breakpoint — or null when nothing does. Matches the class's declaration
 * block wherever it was emitted, so a `display: none` nested in an
 * `@media` counts the same as a bare one.
 */
const hidingRule = (el: HTMLElement): string | null => {
    const css = Array.from(document.querySelectorAll("style"))
        .map((style) => style.textContent ?? "")
        .join("\n");
    for (let node: HTMLElement | null = el; node; node = node.parentElement) {
        for (const cls of Array.from(node.classList).filter((c) => c.startsWith("css-"))) {
            const blocks = css.match(new RegExp(`\\.${cls}\\{[^}]*\\}`, "g")) ?? [];
            const hidden = blocks.find((block) => /display:\s*none/.test(block));
            if (hidden) return hidden;
        }
    }
    return null;
};

describe("the group profile modal body", () => {
    it("renders every field", () => {
        renderModal();
        // One assertion per section, because the Stack that was hidden
        // wrapped all of them — a single check would not say how much of
        // the modal came back.
        expect(screen.getByText("Group name")).toBeInTheDocument();
        expect(screen.getByText("Owner")).toBeInTheDocument();
        expect(screen.getByText("Is Private")).toBeInTheDocument();
        expect(screen.getByText("Created Date")).toBeInTheDocument();
    });

    it("shows the roster, which is the reason to open it", () => {
        renderModal();
        expect(screen.getByText("Members (1/1)")).toBeInTheDocument();
        expect(screen.getByPlaceholderText("Search members...")).toBeInTheDocument();
    });

    it("hides none of it behind a breakpoint", () => {
        renderModal();
        // The regression itself: the fields were in the DOM the whole
        // time, which is why every presence assertion above passed even
        // while a phone showed an empty sheet. What was wrong was a
        // `display: none` on a wrapper, so that is what is asserted.
        for (const label of ["Group name", "Owner", "Is Private", "Created Date"]) {
            expect(hidingRule(screen.getByText(label))).toBeNull();
        }
        expect(hidingRule(screen.getByPlaceholderText("Search members..."))).toBeNull();
    });

    it("still names the group in the title", () => {
        renderModal();
        // The title was the one thing that DID render on a phone, so it is
        // the control: the fix must not have moved it.
        expect(screen.getByRole("heading", { name: /Launch crew/ })).toBeInTheDocument();
    });
});
