// Settings → Account lists the teams you belong to so leaving ONE of them
// is discoverable from the screen whose other exit deletes the account
// everywhere. What matters here: a team you own offers no Leave (the
// server refuses it), a guest shell isn't listed at all (there's no
// membership to give up), and leaving the team currently on screen hands
// the user to the team-picker instead of a workspace they're no longer in.

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AccountSettingsSection } from "../components/layout/AccountSettingsSection";
import { leaveTeam } from "../features/admin/services/leaveTeam";
import { loadMyTeams } from "../features/admin/services/loadMyTeams";
import { Team, UserProps } from "../types/admin";

const navigate = vi.fn();
vi.mock("react-router-dom", () => ({ useNavigate: () => navigate }));

vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "token" }) }));
vi.mock("../hooks/common/useSignOut", () => ({ useSignOut: () => vi.fn() }));
vi.mock("../features/admin/services/accountLifecycle", () => ({
    getAccountDeletionStatus: vi.fn().mockResolvedValue({
        canDelete: true,
        requiresPassword: false,
        blockingTeams: [],
    }),
    deleteAccount: vi.fn(),
    downloadAccountExport: vi.fn(),
}));
vi.mock("../features/admin/services/loadMyTeams", () => ({ loadMyTeams: vi.fn() }));
vi.mock("../features/admin/services/leaveTeam", () => ({ leaveTeam: vi.fn() }));

const MYSELF = { userId: "me", teamId: "team-a" } as UserProps;

const TEAMS: Team[] = [
    { teamId: "team-a", teamName: "Alpha", teamEmail: "a@x.dev", teamOwnerId: "someone" },
    { teamId: "team-b", teamName: "Bravo", teamEmail: "b@x.dev", teamOwnerId: "someone" },
    { teamId: "team-c", teamName: "Charlie", teamEmail: "c@x.dev", teamOwnerId: "me" },
    {
        teamId: "team-d",
        teamName: "Delta",
        teamEmail: "d@x.dev",
        teamOwnerId: "outsider",
        isGuest: true,
    },
];

// jsdom's own localStorage isn't dependable across Node versions in this
// suite; an in-memory stub keeps the assertions about the team keys honest.
const makeStorage = (): Storage => {
    const map = new Map<string, string>();
    return {
        get length() {
            return map.size;
        },
        clear: () => map.clear(),
        getItem: (key: string) => map.get(key) ?? null,
        key: (index: number) => Array.from(map.keys())[index] ?? null,
        removeItem: (key: string) => void map.delete(key),
        setItem: (key: string, value: string) => void map.set(key, String(value)),
    };
};

const rowFor = (teamName: string) => {
    const row = screen.getByText(teamName).closest("div");
    if (!row) throw new Error(`No row for ${teamName}`);
    return row;
};

/** Opens the confirm dialog for a team and clicks its Leave button. */
const leave = async (teamName: string) => {
    fireEvent.click(within(rowFor(teamName)).getByRole("button", { name: "Leave" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Leave" }));
};

const renderSection = async (onNavigateAway = vi.fn()) => {
    // `container` excludes the confirm dialog, which Joy portals to
    // <body> — the dialog names the team too, so assertions about the
    // LIST have to be scoped to the section.
    const { container } = render(
        <AccountSettingsSection myself={MYSELF} onNavigateAway={onNavigateAway} />
    );
    await screen.findByText("Alpha");
    return { container, onNavigateAway };
};

beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("localStorage", makeStorage());
    localStorage.setItem("teamId", "team-a");
    localStorage.setItem("teamName", "Alpha");
    vi.mocked(loadMyTeams).mockResolvedValue(TEAMS);
    vi.mocked(leaveTeam).mockResolvedValue(true);
});

describe("Settings → Account team list", () => {
    it("lists memberships and marks the team you're in", async () => {
        await renderSection();
        expect(screen.getByText("Bravo")).toBeInTheDocument();
        // A guest team is reachable only through a share, so there is
        // nothing to leave and it must not be offered.
        expect(screen.queryByText("Delta")).not.toBeInTheDocument();
        expect(within(rowFor("Alpha")).getByText("Current")).toBeInTheDocument();
    });

    it("replaces Leave with the reason on a team you own", async () => {
        await renderSection();
        const owned = rowFor("Charlie");
        expect(within(owned).queryByRole("button", { name: "Leave" })).not.toBeInTheDocument();
        expect(within(owned).getByText(/transfer ownership/i)).toBeInTheDocument();
    });

    it("drops the row when you leave a team you're not currently in", async () => {
        const { container } = await renderSection();
        await leave("Bravo");
        await waitFor(() =>
            expect(within(container).queryByText("Bravo")).not.toBeInTheDocument()
        );
        expect(leaveTeam).toHaveBeenCalledWith("token", "team-b", "me");
        // Still in Alpha: nothing about the current workspace changes.
        expect(navigate).not.toHaveBeenCalled();
        expect(localStorage.getItem("teamId")).toBe("team-a");
        expect(within(container).getByText("Alpha")).toBeInTheDocument();
    });

    it("sends you to the team picker when you leave the team you're in", async () => {
        const { onNavigateAway } = await renderSection();
        await leave("Alpha");
        await waitFor(() => expect(navigate).toHaveBeenCalledWith("/jointeam"));
        expect(leaveTeam).toHaveBeenCalledWith("token", "team-a", "me");
        // The workspace must not boot back into a team we just left.
        expect(localStorage.getItem("teamId")).toBeNull();
        expect(localStorage.getItem("teamName")).toBeNull();
        expect(onNavigateAway).toHaveBeenCalled();
    });

    it("keeps the row when the server refuses the leave", async () => {
        vi.mocked(leaveTeam).mockResolvedValue(false);
        const { container } = await renderSection();
        await leave("Bravo");
        await waitFor(() => expect(screen.getByText(/couldn't leave/i)).toBeInTheDocument());
        expect(within(container).getByText("Bravo")).toBeInTheDocument();
        expect(navigate).not.toHaveBeenCalled();
    });
});
