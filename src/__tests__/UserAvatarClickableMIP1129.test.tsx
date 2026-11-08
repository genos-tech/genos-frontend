/**
 * MIP-1129: an avatar that is not clickable is not a button. UserAvatar used to hand
 * its open-profile handler to the avatar box whatever `clickable` said, so after the
 * box became a keyboard region every non-clickable avatar (the ones inside rows,
 * options and table cells) would have been a tab stop that does nothing.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AvatarContextProvider } from "../components/ui/avatars/AvatarContext";
import { UserAvatar } from "../components/ui/avatars/UserAvatar";
import type { UserProps } from "../types/admin";

afterEach(cleanup);

const me = { userId: "me", userName: "Me", teamId: "team-a" } as unknown as UserProps;
const other = {
    userId: "u-1",
    userName: "Ada Lovelace",
    teamId: "team-a",
} as unknown as UserProps;

const renderAvatar = (clickable: boolean) =>
    render(
        <CssVarsProvider>
            <AvatarContextProvider
                value={{
                    myself: me,
                    setMyself: () => {},
                    teamMemberProfiles: { "u-1": other },
                    setTeamMemberProfiles: () => {},
                    socket: null,
                    useCM: {} as never,
                    useUISM: {} as never,
                }}
            >
                <UserAvatar clickable={clickable} showPulseDot={false} userId="u-1" />
            </AvatarContextProvider>
        </CssVarsProvider>
    );

describe("UserAvatar and the keyboard", () => {
    it("a clickable avatar is a named button in the tab order", () => {
        renderAvatar(true);
        const button = screen.getByRole("button", { name: "Ada Lovelace" });
        expect(button.tabIndex).toBe(0);
    });

    it("a non-clickable avatar is not a button and not a tab stop", () => {
        const { container } = renderAvatar(false);
        expect(screen.queryByRole("button")).toBeNull();
        expect(container.querySelector('[tabindex="0"]')).toBeNull();
    });
});
