/**
 * MIP-1244: an avatar next to a printed name must never read "?".
 *
 * `teamMemberProfiles` (what `UserAvatar` resolves a person through) loads
 * lazily, so for its first moments there is no profile. A row that already
 * holds the person's name (a DM's partner, a task's `assigneeName`, a message's
 * sender) used to show "?" beside it. The row's own name is now the fallback; the
 * live profile still wins as soon as it arrives.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AvatarContextProvider } from "../components/ui/avatars/AvatarContext";
import { UserAvatar } from "../components/ui/avatars/UserAvatar";
import { ChatListItemAvatar } from "../features/chat/components/sidebar/ChatListItemAvatar";
import { AssigneeAvatar } from "../features/tasks/components/card/parts";
import type { UserProps } from "../types/admin";
import type { AllChatProps } from "../types/chat";

afterEach(cleanup);

const me = { userId: "me", userName: "Me", teamId: "team-a" } as unknown as UserProps;
const person = (userId: string, userName: string): UserProps =>
    ({ userId, userName, userEmail: "", teamId: "team-a" }) as unknown as UserProps;

const inCtx = (profiles: Record<string, UserProps>, node: React.ReactNode) => (
    <CssVarsProvider>
        <AvatarContextProvider
            value={{
                myself: me,
                setMyself: () => {},
                teamMemberProfiles: profiles,
                setTeamMemberProfiles: () => {},
                socket: null,
                useCM: {} as never,
                useUISM: {} as never,
            }}
        >
            {node}
        </AvatarContextProvider>
    </CssVarsProvider>
);

// The letter an avatar shows (the dot/badge children are not text).
const letters = (container: HTMLElement) =>
    Array.from(container.querySelectorAll(".MuiAvatar-root"))
        .map((el) => el.textContent)
        .join("");

describe("UserAvatar with a profile that has not loaded", () => {
    it.each([
        ["Dan OConnor", "D"],
        ["  alice chen", "A"],
        ["(DY) Ken Kamiya", "D"],
        ["田中 太郎", "田"],
        ["", "?"],
        [undefined, "?"],
        [null, "?"],
    ])("fallbackName %j -> %j", (name, expected) => {
        const { container } = render(
            inCtx({}, <UserAvatar fallbackName={name} showPulseDot={false} userId="u-9" />)
        );
        expect(letters(container)).toBe(expected);
    });

    it("the live profile name wins over the row's stored name", () => {
        const { container } = render(
            inCtx(
                { "u-9": person("u-9", "Bob Martinez") },
                <UserAvatar fallbackName="Dan OConnor" showPulseDot={false} userId="u-9" />
            )
        );
        expect(letters(container)).toBe("B");
    });

    it("a profile with no name keeps the row's printed name ahead of the email", () => {
        const noName = { ...person("u-9", ""), userEmail: "xyz@example.com" };
        const { container } = render(
            inCtx(
                { "u-9": noName },
                <UserAvatar fallbackName="Dan OConnor" showPulseDot={false} userId="u-9" />
            )
        );
        expect(letters(container)).toBe("D");
    });

    it("an explicit fallbackInitial (a chat's own letter) still wins over both", () => {
        const { container } = render(
            inCtx(
                {},
                <UserAvatar
                    fallbackInitial="G"
                    fallbackName="Dan OConnor"
                    showPulseDot={false}
                    userId="u-9"
                />
            )
        );
        expect(letters(container)).toBe("G");
    });
});

describe("the surfaces that print a name beside the avatar", () => {
    it("a DM row shows the partner's initial before the roster has loaded", () => {
        const chat = {
            chatId: "c1",
            chatType: 1,
            chatName: "",
            dmPartnerUser: person("u-2", "Carol Park"),
        } as unknown as AllChatProps;
        const { container } = render(
            inCtx(
                {},
                <ChatListItemAvatar
                    chat={chat}
                    chatType={1}
                    isYou={false}
                    myself={me}
                    setMyself={() => {}}
                    socket={null}
                    useCM={{} as never}
                    useTEM={{ teamMemberProfiles: {} } as never}
                    useUISM={{} as never}
                />
            )
        );
        expect(letters(container)).toBe("C");
    });

    it("a non-DM chat row does not read dmPartnerUser", () => {
        const chat = { chatId: "c2", chatType: 4, mdmMembers: [] } as unknown as AllChatProps;
        expect(() =>
            render(
                inCtx(
                    {},
                    <ChatListItemAvatar
                        chat={chat}
                        chatType={4}
                        isYou={false}
                        myself={me}
                        setMyself={() => {}}
                        socket={null}
                        useCM={{} as never}
                        useTEM={{ teamMemberProfiles: {} } as never}
                        useUISM={{} as never}
                    />
                )
            )
        ).not.toThrow();
    });

    it("a task card's assignee shows the stored name's initial before the roster has loaded", () => {
        const { container } = render(
            inCtx({}, <AssigneeAvatar name="Dan OConnor" userId="u-4" />)
        );
        expect(letters(container)).toBe("D");
    });

    it("an unassigned card still shows the dashed placeholder", () => {
        const { container } = render(
            inCtx({}, <AssigneeAvatar name="Dan OConnor" userId={null} />)
        );
        expect(letters(container)).toBe("?");
    });
});
