/**
 * Adding a person to a share or a folder.
 *
 * Both surfaces used to render the entire roster as a row of buttons, which
 * works for four colleagues and not for forty — so they now use the same
 * autocomplete the assignee and reporter fields do. And the guest side's
 * candidate list had started including the HOST team's members, because the
 * roster endpoint legitimately returns the people you share work with: a
 * list that reads as "your side may hand their colleagues access to their
 * own folder", which is not a thing that can happen.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AvatarContextProvider } from "../components/ui/avatars/AvatarContext";
import { PersonPicker } from "../components/ui/PersonPicker";
import type { UserProps } from "../types/admin";

const get = vi.fn();
vi.mock("../services/api", () => ({
    authApi: () => ({ get }),
}));

const show = (node: React.ReactNode) =>
    render(
        <AvatarContextProvider
            value={{
                myself: { userId: "me", userName: "Me" } as unknown as UserProps,
                setMyself: () => {},
                teamMemberProfiles: {},
                setTeamMemberProfiles: () => {},
                socket: null,
                useCM: {} as never,
                useUISM: {} as never,
            }}
        >
            <CssVarsProvider>{node}</CssVarsProvider>
        </AvatarContextProvider>
    );

const people = [
    { userId: "u-zoe", userName: "Zoe", userEmail: "zoe@acme.test" },
    { userId: "u-ann", userName: "Ann", userEmail: "ann@acme.test" },
    { userId: "me", userName: "Me", userEmail: "me@acme.test" },
];

describe("the person picker", () => {
    it("offers the reader first, marked as themselves, then alphabetical", async () => {
        show(<PersonPicker myUserId="me" options={people} placeholder="Add" onPick={() => {}} />);
        await userEvent.click(screen.getByPlaceholderText("Add"));
        const shown = screen.getAllByRole("option").map((o) => o.textContent);
        expect(shown[0]).toMatch(/Me \(You\)/);
        expect(shown[1]).toMatch(/Ann/);
        expect(shown[2]).toMatch(/Zoe/);
    });

    it("narrows to what was typed, by email as well as name", async () => {
        show(<PersonPicker options={people} placeholder="Add" onPick={() => {}} />);
        await userEvent.type(screen.getByPlaceholderText("Add"), "zoe@");
        expect(screen.getAllByRole("option")).toHaveLength(1);
        expect(screen.getByRole("option").textContent).toMatch(/Zoe/);
    });

    it("hands back the person picked and comes back empty for the next one", async () => {
        const onPick = vi.fn();
        show(<PersonPicker options={people} placeholder="Add" onPick={onPick} />);
        const field = screen.getByPlaceholderText("Add");
        await userEvent.type(field, "Ann");
        await userEvent.click(screen.getByRole("option", { name: /ann/i }));
        expect(onPick).toHaveBeenCalledWith(
            expect.objectContaining({ userId: "u-ann", userName: "Ann" })
        );
        // Left as text, the name reads as somebody still waiting to be added.
        expect((field as HTMLInputElement).value).toBe("");
    });
});

describe("the roster offered to a guest team's manager", () => {
    beforeEach(() => get.mockReset());

    it("leaves out the other team's people, whom it cannot admit anyway", async () => {
        get.mockResolvedValue({
            data: {
                data: {
                    members: [
                        { userId: "u-ours", userName: "Ours", userEmail: "ours@b.test" },
                        {
                            userId: "u-theirs",
                            userName: "Theirs",
                            userEmail: "theirs@a.test",
                            isExternal: true,
                            homeTeamName: "Team A",
                        },
                    ],
                },
            },
        });
        const { fetchOwnTeamRoster } = await import("../features/admin/services/teamConnections");
        const roster = await fetchOwnTeamRoster("token", "team-b");
        expect(roster.map((r) => r.userId)).toEqual(["u-ours"]);
    });
});
