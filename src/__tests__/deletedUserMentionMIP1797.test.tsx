/**
 * A deleted person's @mention chip reads "Deleted user", not the name that was
 * typed into the text (MIP-1797).
 *
 * Account deletion anonymises the person on the server, but the mention node in
 * a message / note / task keeps `props.userName`, and the chip fell back to it
 * whenever the id was not on the roster. The roster cannot tell "deleted" from
 * "left the team" (both leave it), so the rule here is the one the client can
 * actually prove: a profile it HOLDS that carries the anonymised marks
 * (`Deleted user` / `@deleted.invalid`) is a deleted account; an id it knows
 * nothing about keeps the stored name, because that may be somebody who simply
 * left, and their name must stay.
 */
import { act } from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { commentFirstLine } from "../components/editors/sub/commentMentions";
import { LightMessageBody } from "../components/messageBody/LightMessageBody";
import { AvatarContextProvider, ResolvedUserName } from "../components/ui/avatars/AvatarContext";
import { resolveDisplayName } from "../components/ui/avatars/avatarContextHelpers";
import { forgetEveryone, rememberPeople } from "../components/ui/avatars/userDirectory";
import { MentionChipV3 } from "../features/channel/components/MentionChipV3";
import { MessageBody as ChannelMessageBody } from "../features/channel/components/MessageBody";
import { getMessages, loadLocale } from "../i18n";
import { LOCALE_STORAGE_KEY } from "../i18n/localeSource";
import type { UserProps } from "../types/admin";
import { storedMentionName } from "../utils/mentionName";

// The light body reads the access token (PR unfurls); same seam as lightMessageBody.test.
vi.mock("../context/authState", async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    useAuth: () => ({ accessToken: null }),
}));

const me = { userId: "me", userName: "Me" } as unknown as UserProps;
const live = { userId: "live", userName: "Live Lena", userEmail: "l@x.test" } as UserProps;
// What the server stamps on an anonymised account.
const anonymised = {
    userId: "gone",
    userName: "Deleted user",
    userEmail: "deleted-1@deleted.invalid",
} as UserProps;

const DELETED = "Deleted user";

// The locale test stores "ja"; leave English for the rest of the file.
afterEach(() => localStorage.removeItem(LOCALE_STORAGE_KEY));

const ctxValue = (profiles: Record<string, UserProps> = { live }) => ({
    myself: me,
    setMyself: () => {},
    teamMemberProfiles: profiles,
    setTeamMemberProfiles: () => {},
    socket: null,
    useCM: {} as never,
    useUISM: {} as never,
});

describe("resolveDisplayName and deleted accounts", () => {
    beforeEach(() => localStorage.removeItem(LOCALE_STORAGE_KEY));
    afterEach(() => act(() => forgetEveryone()));

    it("shows 'Deleted user' for a deleted account that is still on the roster", () => {
        expect(resolveDisplayName("gone", "Real Name", me, { gone: anonymised })).toBe(DELETED);
    });

    it("shows 'Deleted user' for a deleted account the directory has seen on a payload", () => {
        // e.g. the sender of a message: the server sends them already anonymised.
        rememberPeople([anonymised]);
        expect(resolveDisplayName("gone", "Real Name", me, { live })).toBe(DELETED);
    });

    it("shows 'Deleted user' when the stored text name is already the anonymised one", () => {
        expect(resolveDisplayName("nobody", DELETED, me, { live })).toBe(DELETED);
    });

    it("keeps the stored name for somebody who is simply not on the roster (left the team)", () => {
        // Not on the roster is NOT evidence of deletion: they may have left.
        expect(resolveDisplayName("left", "Lee Leaver", me, { live })).toBe("Lee Leaver");
    });

    it("keeps a live member's current roster name", () => {
        expect(resolveDisplayName("live", "Old Lena", me, { live })).toBe("Live Lena");
    });

    it("a live roster entry wins over a stale 'deleted' directory entry", () => {
        rememberPeople([{ ...anonymised, userId: "live" }]);
        expect(resolveDisplayName("live", "Old Lena", me, { live })).toBe("Live Lena");
    });

    it("localises the label", async () => {
        localStorage.setItem(LOCALE_STORAGE_KEY, "ja");
        await loadLocale("ja");
        expect(resolveDisplayName("gone", "Real Name", me, { gone: anonymised })).toBe(
            getMessages("ja").tasks.messageTemplate.deletedUser
        );
        expect(getMessages("ja").tasks.messageTemplate.deletedUser).not.toBe(DELETED);
    });
});

describe("surfaces that render a mention chip", () => {
    afterEach(() => act(() => forgetEveryone()));

    const mentionBody = (userId: string, userName: string) => [
        {
            type: "paragraph",
            content: [{ type: "mention", props: { userId, userName } }],
        },
        { type: "paragraph", content: [] },
    ];

    const lightCtx = {
        myself: me,
        setMyself: () => {},
        socket: null,
        useCM: {} as never,
        useTEM: { teamMemberProfiles: {} } as never,
        useUISM: {} as never,
    };

    const renderLight = (userId: string, userName: string, profiles: Record<string, UserProps>) =>
        render(
            <AvatarContextProvider value={ctxValue(profiles)}>
                <LightMessageBody content={mentionBody(userId, userName)} {...lightCtx} />
            </AvatarContextProvider>
        );

    it("chat bubble / thread / task comment chip: deleted account", () => {
        renderLight("gone", "Real Name", { gone: anonymised });
        expect(screen.getByText(`@${DELETED}`)).toBeInTheDocument();
        expect(screen.queryByText(/Real Name/)).toBeNull();
    });

    it("chat bubble chip: member who left keeps the real name", () => {
        renderLight("left", "Lee Leaver", { live });
        expect(screen.getByText("@Lee Leaver")).toBeInTheDocument();
    });

    it("chat bubble chip: live member shows the roster name", () => {
        renderLight("live", "Old Lena", { live });
        expect(screen.getByText("@Live Lena")).toBeInTheDocument();
    });

    const renderChannel = (
        userId: string,
        userName: string,
        profiles: Record<string, UserProps>
    ) =>
        render(
            <AvatarContextProvider value={ctxValue(profiles)}>
                <ChannelMessageBody
                    body={mentionBody(userId, userName)}
                    bodyText=""
                    currentUserId="me"
                />
            </AvatarContextProvider>
        );

    it("v3 channel message body chip: deleted account", () => {
        renderChannel("gone", "Real Name", { gone: anonymised });
        expect(screen.getByTestId("message-body-mention-gone")).toHaveTextContent(`@${DELETED}`);
        expect(screen.queryByText(/Real Name/)).toBeNull();
    });

    it("v3 channel message body chip: left member keeps the real name, live member is current", () => {
        renderChannel("left", "Lee Leaver", { live });
        expect(screen.getByTestId("message-body-mention-left")).toHaveTextContent("@Lee Leaver");
        renderChannel("live", "Old Lena", { live });
        expect(screen.getByTestId("message-body-mention-live")).toHaveTextContent("@Live Lena");
    });

    it("v3 composer / editor chip: deleted account, and a member who left", () => {
        render(
            <AvatarContextProvider value={ctxValue({ gone: anonymised })}>
                <MentionChipV3
                    background="x"
                    color="y"
                    isMe={false}
                    storedName="Real Name"
                    userId="gone"
                />
                <MentionChipV3
                    background="x"
                    color="y"
                    isMe={false}
                    storedName="Lee Leaver"
                    userId="left"
                />
            </AvatarContextProvider>
        );
        expect(screen.getByTestId("mention-chip-v3-gone")).toHaveTextContent(`@${DELETED}`);
        expect(screen.getByTestId("mention-chip-v3-left")).toHaveTextContent("@Lee Leaver");
    });

    it("name leaf used by task cells", () => {
        render(
            <AvatarContextProvider value={ctxValue({ gone: anonymised })}>
                <ResolvedUserName fallbackName="Real Name" userId="gone" />
            </AvatarContextProvider>
        );
        expect(screen.getByText(DELETED)).toBeInTheDocument();
    });
});

describe("plain-text previews of a mention (no React context)", () => {
    afterEach(() => act(() => forgetEveryone()));

    it("uses the label for a directory-known deleted account, the stored name otherwise", () => {
        rememberPeople([anonymised]);
        expect(storedMentionName("gone", "Real Name")).toBe(DELETED);
        expect(storedMentionName("left", "Lee Leaver")).toBe("Lee Leaver");
        expect(storedMentionName("x", DELETED)).toBe(DELETED);
    });

    it("comment first line (inbox / notification previews) reads the label", () => {
        rememberPeople([anonymised]);
        const body = [
            {
                type: "paragraph",
                content: [
                    { type: "text", text: "ping " },
                    { type: "mention", props: { userId: "gone", userName: "Real Name" } },
                ],
            },
        ];
        expect(commentFirstLine(body)).toBe(`ping @${DELETED}`);
    });
});
