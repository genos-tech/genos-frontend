// MIP-1202: the team menu was a Menu held open with `anchorEl` state. Focus stayed on the
// tile (Arrow keys did nothing) and Escape did not close it. The Dropdown owns open / close now.
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TeamDropdown } from "../features/admin/components/teamDropdown";

const loadMyTeams = vi.fn();
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "t" }) }));
vi.mock("../features/admin/services/loadMyTeams", () => ({
    loadMyTeams: (...a: unknown[]) => loadMyTeams(...a),
    membershipTeams: (x: unknown[]) => x,
}));

afterEach(() => {
    cleanup();
    loadMyTeams.mockReset();
});

const mount = () => {
    loadMyTeams.mockResolvedValue([
        { teamId: "t1", teamName: "Alpha" },
        { teamId: "t2", teamName: "Beta" },
    ]);
    render(
        <CssVarsProvider>
            <TeamDropdown
                myself={{ teamName: "Alpha", teamId: "t1", userId: "u" } as never}
                setAvatarUserId={() => {}}
                setMyself={() => {}}
                setOpenUserProfile={() => {}}
                socket={null}
                useCM={{} as never}
                useTEM={{ currentTeam: { teamName: "Alpha" } } as never}
                useUISM={{} as never}
            />
        </CssVarsProvider>
    );
};

const trigger = () => screen.getByRole("button", { name: /team menu/i });

describe("the team menu, by keyboard", () => {
    it("reads the teams when it opens, and lists them", async () => {
        mount();
        fireEvent.click(trigger());
        expect(await screen.findByText("Beta")).toBeTruthy();
        expect(loadMyTeams).toHaveBeenCalledTimes(1);
    });

    it("takes focus into the menu when it opens", async () => {
        mount();
        fireEvent.click(trigger());
        await screen.findByText("Beta");
        await waitFor(() =>
            expect(document.activeElement?.closest('[role="menu"]')).not.toBeNull()
        );
    });

    it("Escape closes it and focus goes back to the tile", async () => {
        mount();
        fireEvent.click(trigger());
        await screen.findByText("Beta");
        await waitFor(() =>
            expect(document.activeElement?.closest('[role="menu"]')).not.toBeNull()
        );
        fireEvent.keyDown(document.activeElement as Element, { key: "Escape" });
        await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
        await waitFor(() => expect(document.activeElement).toBe(trigger()));
    });
});
