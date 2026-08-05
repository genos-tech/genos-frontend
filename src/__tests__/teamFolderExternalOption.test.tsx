/**
 * Creating a team folder for another organization, in one step.
 *
 * The dialog asked "who can access this folder" and offered the team or a
 * private invite list. Sharing across teams was reachable — pick private,
 * create, reopen the folder, find the sharing section — but only if you
 * already knew that sharing requires a restricted folder, which is a fact
 * about the implementation. Group chats have asked the question outright
 * ("Include another organization") since they learned to be external; this
 * asserts the folder dialog does too, and that the answer resolves to the
 * restriction the server requires rather than leaving the user to guess it.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ModalTeamFolderName } from "../features/notes/team-notes/modals/ModalTeamFolderName";

const connections = vi.hoisted(() => ({ active: [] as { teamId: string; teamName: string }[] }));

vi.mock("../features/admin/components/team/useTeamConnections", () => ({
    useTeamConnections: () => connections,
}));

const onSubmit = vi.fn();

const open = () =>
    render(
        <ModalTeamFolderName
            mode="create-root"
            open={true}
            teamId="team-a"
            onClose={() => {}}
            onSubmit={onSubmit}
        />
    );

const nameIt = async (user: ReturnType<typeof userEvent.setup>) =>
    user.type(screen.getByRole("textbox"), "Contract review");

describe("the folder dialog offers to share with another organization", () => {
    beforeEach(() => {
        onSubmit.mockClear();
        connections.active = [{ teamId: "team-b", teamName: "Team B" }];
    });

    it("creates a restricted folder and names the teams to offer it to", async () => {
        const user = userEvent.setup();
        open();
        await nameIt(user);
        await user.click(screen.getByRole("radio", { name: /another organization/i }));
        await user.click(screen.getByRole("button", { name: "Team B" }));
        await user.click(screen.getByRole("button", { name: /create/i }));

        // "private" is not something the user picked — it is what sharing
        // requires, resolved here so they never have to know.
        expect(onSubmit).toHaveBeenCalledWith("Contract review", "private", ["team-b"]);
    });

    it("will not create a restricted folder shared with nobody", async () => {
        const user = userEvent.setup();
        open();
        await nameIt(user);
        await user.click(screen.getByRole("radio", { name: /another organization/i }));

        // Otherwise the choice silently narrows the folder and shares it
        // with no one — strictly worse than either real answer.
        expect(screen.getByRole("button", { name: /create/i })).toBeDisabled();
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it("keeps the ordinary two answers working", async () => {
        const user = userEvent.setup();
        open();
        await nameIt(user);
        await user.click(screen.getByRole("button", { name: /create/i }));
        expect(onSubmit).toHaveBeenCalledWith("Contract review", "public", []);
    });

    it("says nothing about sharing when there is nobody to share with", async () => {
        connections.active = [];
        const user = userEvent.setup();
        open();
        await nameIt(user);

        // An option that can only ever be empty is worse than an absent
        // one; connections are made in team settings, not here.
        expect(screen.queryByRole("radio", { name: /another organization/i })).toBeNull();
    });
});
