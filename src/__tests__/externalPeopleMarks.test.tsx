/**
 * Saying which side of the wall someone is on.
 *
 * The roster now includes the other teams' people you share work with, so
 * their names and faces render everywhere — which creates a new way to be
 * wrong: an outside collaborator that looks exactly like a colleague. Every
 * mark that prevents that is asserted here, plus the one thing recognizing
 * them must NOT turn into: being addable to your own team's objects.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AvatarContextProvider } from "../components/ui/avatars/AvatarContext";
import { UserAvatar } from "../components/ui/avatars/UserAvatar";
import { ExternalChatChip } from "../features/chat/components/shared/ExternalChatChip";
import type { UserProps } from "../types/admin";
import type { AllChatProps } from "../types/chat";
import { ownTeamOnly } from "../utils/teamRoster";

const me = { userId: "me", userName: "Me", teamId: "team-a" } as unknown as UserProps;

const colleague = {
    userId: "u-colleague",
    userName: "Colleague",
    teamId: "team-a",
} as unknown as UserProps;

const outsider = {
    userId: "u-outsider",
    userName: "Outsider",
    // Filed under the roster's team, with their own team beside it.
    teamId: "team-a",
    isExternal: true,
    homeTeamId: "team-b",
    homeTeamName: "Team B",
    homeTeamImgPath: "teams/b.png",
} as unknown as UserProps;

const withRoster = (children: React.ReactNode) =>
    render(
        <AvatarContextProvider
            value={{
                myself: me,
                setMyself: () => {},
                teamMemberProfiles: {
                    "u-colleague": colleague,
                    "u-outsider": outsider,
                },
                setTeamMemberProfiles: () => {},
                socket: null,
                useCM: {} as never,
                useUISM: {} as never,
            }}
        >
            {children}
        </AvatarContextProvider>
    );

const chat = (over: Partial<AllChatProps>): AllChatProps =>
    ({ chatId: "c-1", chatType: 2, chatName: "Design", ...over }) as AllChatProps;

describe("an outsider's avatar wears their team", () => {
    it("badges the face of somebody from another team", () => {
        withRoster(<UserAvatar userId="u-outsider" />);
        // The team's name is the badge's accessible name, so this asserts
        // both that a reader can tell WHICH team and that the mark is not
        // sighted-only. Queried by label rather than by the old `title`
        // attribute: that hint sat on an element with `pointer-events:
        // none` and could never have appeared for anyone.
        expect(screen.getByLabelText("Team B")).toBeTruthy();
    });

    it("leaves a colleague's face alone", () => {
        withRoster(<UserAvatar userId="u-colleague" />);
        expect(screen.queryByLabelText("Team B")).toBeNull();
    });
});

describe("an open chat says another team is in it", () => {
    it("names the owning team on the guest side", () => {
        withRoster(
            <ExternalChatChip
                allChats={[chat({ isExternal: true, hostTeamName: "Team A" })]}
                chatId="c-1"
                chatType={2}
            />
        );
        expect(screen.getByText("Team A")).toBeTruthy();
    });

    it("still marks the host side, which has no other team to name", () => {
        withRoster(
            <ExternalChatChip
                allChats={[chat({ isExternal: true, hostTeamName: null })]}
                chatId="c-1"
                chatType={2}
            />
        );
        expect(screen.getByText("External")).toBeTruthy();
    });

    it("renders nothing for an ordinary chat", () => {
        const { container } = withRoster(
            <ExternalChatChip allChats={[chat({})]} chatId="c-1" chatType={2} />
        );
        expect(container.textContent).toBe("");
    });

    it("renders nothing when the chat isn't in the list yet", () => {
        const { container } = withRoster(
            <ExternalChatChip
                allChats={[chat({ chatId: "other", isExternal: true })]}
                chatId="c-1"
                chatType={2}
            />
        );
        expect(container.textContent).toBe("");
    });
});

describe("recognizing someone is not the same as adding them", () => {
    it("keeps outsiders out of an add-member picker", () => {
        expect(ownTeamOnly([colleague, outsider]).map((m) => m.userId)).toEqual(["u-colleague"]);
    });

    it("passes through a roster that has none", () => {
        expect(ownTeamOnly([me, colleague])).toHaveLength(2);
    });
});
