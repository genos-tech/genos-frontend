/**
 * MIP-1134: the team tile at the top of the rail is never blank.
 *
 * A session restored from the refresh cookie has no `teamName` in storage, so
 * `myself.teamName` is "" and the tile rendered `"".slice(0, 2)`: an empty purple
 * square. Now it shows the team picture, else the first letter of the name (from
 * the team the app knows, else `myself`), else a team icon.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { cssOf } from "./utils/cssOf";

import { TeamDropdown } from "../features/admin/components/teamDropdown";

vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "t" }) }));
vi.mock("../features/admin/services/loadMyTeams", () => ({
    loadMyTeams: async () => [],
    membershipTeams: (x: unknown[]) => x,
}));

afterEach(cleanup);

const mount = (currentTeamName: string, myselfTeamName: string) =>
    render(
        <CssVarsProvider>
            <TeamDropdown
                myself={{ teamName: myselfTeamName, userId: "u" } as never}
                setAvatarUserId={() => {}}
                setMyself={() => {}}
                setOpenUserProfile={() => {}}
                socket={null}
                useCM={{} as never}
                useTEM={{ currentTeam: { teamName: currentTeamName } } as never}
                useUISM={{} as never}
            />
        </CssVarsProvider>
    );

const tile = () => screen.getByRole("button").querySelector(".MuiAvatar-root") as HTMLElement;

describe("the team tile", () => {
    it("shows the first letter of the team the app knows", () => {
        mount("genos-beta-v2", "");
        expect(tile()).toHaveTextContent("G");
    });

    it("falls back to myself's team name", () => {
        mount("", "acme");
        expect(tile()).toHaveTextContent("A");
    });

    it("is never empty: with no name at all it shows a team icon", () => {
        mount("", "");
        expect(tile().querySelector("svg")).not.toBeNull();
        expect(tile().textContent).toBe("");
    });

    it("a whitespace-only name counts as no name", () => {
        mount("  ", " ");
        expect(tile().querySelector("svg")).not.toBeNull();
    });

    it("is flat: the button is named, and the tile has no glow, gradient or scale", () => {
        mount("genos", "genos");
        expect(screen.getByRole("button")).toHaveAccessibleName("Open Team Menu");
        const css = [cssOf(screen.getByRole("button")), cssOf(tile())].join("\n").toLowerCase();
        expect(css).not.toContain("gradient");
        expect(css).not.toContain("blur(");
        expect(css).not.toContain("scale(");
        expect(css).toContain("var(--g-accent-subtle)");
    });
});
