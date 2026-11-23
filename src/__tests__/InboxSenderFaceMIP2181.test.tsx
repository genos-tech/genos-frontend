/**
 * MIP-2181: the inbox GET names each card's sender (`senderId`, `sender`), so every card shows a
 * face, including the ownership claim, the cross-team notices and the reminders whose bodies name
 * nobody. The card prefers the sender over the body's first mention and falls back to the mention,
 * then to the type's tile. The team-connection card says "Connecting ..." once (its body), not
 * again as a footnote.
 *
 * jsdom cannot paint: the look is checked in a real browser (screenshots in the PR).
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AvatarContextProvider } from "../components/ui/avatars/AvatarContext";
import { forgetEveryone } from "../components/ui/avatars/userDirectory";
import { resolveActor } from "../features/inbox/components/inboxActor";
import { InboxBubble } from "../features/inbox/components/InboxBubble";
import { en } from "../i18n/locales/en";
import type { InboxItemProps } from "../types/common";

vi.mock("../components/editors/bnChatPreview", () => ({
    BnChatPreview: () => <div data-testid="bn-preview" />,
}));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));
vi.mock("../context/authState", () => ({ useAuth: () => ({ accessToken: "tok" }) }));
vi.mock("../features/admin/services/ownershipClaim", () => ({
    respondToOwnershipClaim: vi.fn().mockResolvedValue(true),
}));
vi.mock("../features/admin/services/teamConnections", () => ({
    respondToTeamConnection: vi.fn().mockResolvedValue(true),
    respondToExternalShare: vi.fn().mockResolvedValue(true),
}));
vi.mock("../features/admin/services/addInboxItem", () => ({
    addInboxItem: vi.fn().mockResolvedValue(null),
}));

const plainBody = [
    { type: "paragraph", content: [{ type: "text", text: "A claim, no mention", styles: {} }] },
];

const mentionBody = (userId: string, userName: string) => [
    {
        type: "paragraph",
        content: [
            { type: "mention", props: { userId, userName, userEmail: "", avatarImgPath: "" } },
            { type: "text", text: " did a thing", styles: {} },
        ],
    },
];

const item = (itemType: number, extra: Partial<InboxItemProps> = {}): InboxItemProps => ({
    itemId: 100 + itemType,
    itemType,
    itemBody: plainBody,
    isRead: false,
    requestStatus: "pending",
    tsSent: "2026-07-30T00:00:00Z",
    itemOptionals: { connection_id: "c1", grant_id: "g1", deadline: "2026-08-29T00:00:00Z" },
    ...extra,
});

const SAM = {
    userId: "u-sam",
    userName: "Sam Okafor",
    avatarImgPath: "https://img.example/sam.png",
};

const mount = (i: InboxItemProps) =>
    render(
        <CssVarsProvider>
            <AvatarContextProvider
                value={{
                    myself: { userId: "u1", teamId: "t1", userName: "Me" } as never,
                    setMyself: () => {},
                    teamMemberProfiles: { "u-sam": SAM as never },
                    setTeamMemberProfiles: () => {},
                    socket: null,
                    useCM: {} as never,
                    useUISM: {} as never,
                }}
            >
                <InboxBubble
                    inboxItem={i}
                    myself={{ userId: "u1", teamId: "t1" } as never}
                    setMyself={vi.fn()}
                    socket={null}
                    useCM={{ allChats: [] } as never}
                    useTEM={{ teamMemberProfiles: {} } as never}
                    useUISM={{} as never}
                    onItemChanged={vi.fn()}
                />
            </AvatarContextProvider>
        </CssVarsProvider>
    );

afterEach(() => forgetEveryone());

describe("resolveActor", () => {
    it("prefers the sender over the body's mention", () => {
        const actor = resolveActor({
            itemBody: mentionBody("u-other", "Someone Else"),
            senderId: "u-sam",
            sender: SAM,
        });
        expect(actor).toEqual({
            userId: "u-sam",
            userName: "Sam Okafor",
            avatarImgPath: "https://img.example/sam.png",
        });
    });

    it("falls back to the mention when the row has no sender", () => {
        expect(resolveActor({ itemBody: mentionBody("u-m", "Mia"), sender: null })).toEqual({
            userId: "u-m",
            userName: "Mia",
        });
        expect(resolveActor({ itemBody: mentionBody("u-m", "Mia") })).toEqual({
            userId: "u-m",
            userName: "Mia",
        });
    });

    it("is null with neither a sender nor a mention", () => {
        expect(resolveActor({ itemBody: plainBody, senderId: null, sender: null })).toBeNull();
        expect(resolveActor({ itemBody: plainBody, senderId: "" })).toBeNull();
    });

    it("takes the name from the body's mention of the same person when only the id came", () => {
        expect(
            resolveActor({ itemBody: mentionBody("u-sam", "Sam O."), senderId: "u-sam" })
        ).toEqual({ userId: "u-sam", userName: "Sam O.", avatarImgPath: undefined });
        expect(resolveActor({ itemBody: plainBody, senderId: "u-sam" })).toEqual({
            userId: "u-sam",
            userName: "",
            avatarImgPath: undefined,
        });
    });
});

describe("a face on every card", () => {
    it("an ownership claim whose body names nobody shows the sender's avatar, not the tile", () => {
        const { container } = mount(item(5, { senderId: SAM.userId, sender: SAM }));
        expect(container.querySelector("img")?.getAttribute("src")).toBe(SAM.avatarImgPath);
        expect(container.querySelector("[data-inbox-tile-tone]")).toBeNull();
    });

    it("a cross-team notice shows the sender's face", () => {
        for (const type of [7, 8]) {
            const { container, unmount } = mount(
                item(type, { senderId: SAM.userId, sender: SAM })
            );
            expect(container.querySelector("img")?.getAttribute("src")).toBe(SAM.avatarImgPath);
            expect(container.querySelector("[data-inbox-tile-tone]")).toBeNull();
            unmount();
        }
    });

    it("a sender outside the roster shows the photo the API sent", () => {
        const stranger = {
            userId: "u-out",
            userName: "Newcomer",
            avatarImgPath: "https://img.example/out.png",
        };
        const { container } = mount(item(1, { senderId: "u-out", sender: stranger }));
        expect(container.querySelector("img")?.getAttribute("src")).toBe(stranger.avatarImgPath);
    });

    it("a card with no sender and no mention keeps the type's tile", () => {
        const { container } = mount(item(5, { senderId: null, sender: null }));
        expect(container.querySelector("[data-inbox-tile-tone]")).not.toBeNull();
        expect(container.querySelector("img")).toBeNull();
    });

    it("a card Genos wrote keeps the Genos mark even when a sender is present", () => {
        // A digest has no sender in practice; this pins that the mark does not depend on it.
        const { container } = mount(
            item(6, {
                itemBody: { title: "t", text: "x" } as never,
                requestStatus: "" as never,
                senderId: SAM.userId,
                sender: SAM,
            })
        );
        expect(container.querySelector("img")?.getAttribute("src")).not.toBe(SAM.avatarImgPath);
    });
});

describe("the team-connection footnote", () => {
    const hint = "Connecting shares nothing on its own.";

    it("a connection request does not repeat its body as a footnote", () => {
        mount(item(7));
        expect(screen.queryByText(hint)).toBeNull();
        expect(JSON.stringify(en.inbox.crossTeam)).not.toContain("shares nothing");
    });

    it("a share offer keeps its own footnote", () => {
        mount(item(8));
        expect(screen.getByText(en.inbox.crossTeam.shareHint)).toBeTruthy();
    });
});
