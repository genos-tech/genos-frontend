/**
 * The collaborator picker offers only people who may be collaborators (MIP-1567).
 *
 * genos-api now refuses a collaborator who could not open the task (not on the
 * project, not the assignee or reporter) with HTTP 400 for the WHOLE save, so a
 * picker that lists every teammate lets one pick throw away an edit. The rule
 * under test mirrors the server's `may_collaborate`: project members and the
 * owner, plus the assignee and reporter the form holds. The roster is read from
 * `GET /project/members/` when the list is opened.
 */
import { useState } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MultiMemberPicker } from "../features/tasks/components/autocompletes/MultiMemberPicker";
import { resetProjectMemberIdsCache } from "../hooks/tasks/useProjectMemberIds";
import { getMessages } from "../i18n";
import type { UserProps } from "../types/admin";

const get = vi.fn();
vi.mock("../services/api", () => ({
    authApi: () => ({ get }),
}));
vi.mock("../components/ui/avatars/avatarWithStatus", () => ({
    AvatarWithStatus: () => null,
}));

const person = (userId: string, userName: string): UserProps =>
    ({ userId, userName, userEmail: `${userName.toLowerCase()}@acme.test` }) as UserProps;

const me = person("me", "Me");
const ann = person("u-ann", "Ann"); // on the project
const bob = person("u-bob", "Bob"); // team only
const cy = person("u-cy", "Cy"); // team only, but the task's assignee
const di = person("u-di", "Di"); // team only, but the task's reporter
const team = [me, ann, bob, cy, di];

const roster = (...ids: string[]) => ({
    data: { project_members: ids.map((id) => ({ attendee__id: id, attendee__username: id })) },
});

type HarnessProps = {
    initial?: UserProps[];
    holderIds?: string[];
    ownerUserId?: string | null;
    dropDisallowed?: boolean;
    projectId?: number | null;
    onChange?: (next: UserProps[]) => void;
};

const Harness = ({
    initial = [],
    holderIds = [],
    ownerUserId = null,
    dropDisallowed = false,
    projectId = 7,
    onChange,
}: HarnessProps) => {
    const [selected, setSelected] = useState<UserProps[]>(initial);
    return (
        <CssVarsProvider>
            <MultiMemberPicker
                accessToken="tok"
                dropDisallowed={dropDisallowed}
                holderIds={holderIds}
                myself={me}
                ownerUserId={ownerUserId}
                placeholder="Add collaborators"
                projectId={projectId}
                selected={selected}
                setMyself={() => {}}
                socket={null}
                useCM={{} as never}
                useTEM={{ teamMembers: team, teamMemberProfiles: {} } as never}
                useUISM={{} as never}
                onChange={(next) => {
                    setSelected(next);
                    onChange?.(next);
                }}
            />
        </CssVarsProvider>
    );
};

const open = async () => {
    // Joy puts the placeholder on the input only while nothing is chosen.
    const input = screen.getByRole("combobox");
    await userEvent.click(input);
};
const optionNames = () => screen.queryAllByRole("option").map((o) => o.textContent ?? "");

beforeEach(() => {
    get.mockReset();
    resetProjectMemberIdsCache();
});

describe("who the collaborator picker offers", () => {
    it("does not offer a teammate who is not on the project, but offers a project member", async () => {
        get.mockResolvedValue(roster("u-ann"));
        render(<Harness />);
        await open();
        await waitFor(() => expect(optionNames().join("|")).toMatch(/Ann/));
        const shown = optionNames().join("|");
        expect(shown).not.toMatch(/Bob/);
        expect(shown).not.toMatch(/Cy/);
        expect(shown).not.toMatch(/Di/);
        expect(get).toHaveBeenCalledWith("/project/members/?project_id=7");
    });

    it("offers the task's assignee and reporter even when they are only on the team", async () => {
        get.mockResolvedValue(roster("u-ann"));
        render(<Harness holderIds={["u-cy", "u-di"]} />);
        await open();
        await waitFor(() => expect(optionNames().join("|")).toMatch(/Ann/));
        const shown = optionNames().join("|");
        expect(shown).toMatch(/Cy/);
        expect(shown).toMatch(/Di/);
        expect(shown).not.toMatch(/Bob/);
    });

    it("offers the owner, who may not hold a member row", async () => {
        get.mockResolvedValue(roster("u-ann"));
        render(<Harness ownerUserId="u-bob" />);
        await open();
        await waitFor(() => expect(optionNames().join("|")).toMatch(/Bob/));
    });

    it("a milestone has no holders: its assignee-only teammate is not offered", async () => {
        // TaskMainBlock passes `holderIds={[]}` for a milestone.
        get.mockResolvedValue(roster("u-ann"));
        render(<Harness holderIds={[]} />);
        await open();
        await waitFor(() => expect(optionNames().join("|")).toMatch(/Ann/));
        expect(optionNames().join("|")).not.toMatch(/Cy/);
    });

    it("never lists the whole team while the roster is loading", async () => {
        let resolve: (value: unknown) => void = () => {};
        get.mockReturnValue(new Promise((r) => (resolve = r)));
        render(<Harness holderIds={["u-cy"]} />);
        await open();
        const shown = optionNames().join("|");
        expect(shown).not.toMatch(/Ann|Bob|Di/);
        // Loading text shows while there is nothing to list yet.
        await act(async () => resolve(roster("u-ann")));
        await waitFor(() => expect(optionNames().join("|")).toMatch(/Ann/));
        expect(optionNames().join("|")).not.toMatch(/Bob/);
    });

    it("fails closed when the roster cannot be read: holders only, not the team", async () => {
        const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
        get.mockRejectedValue(new Error("offline"));
        render(<Harness holderIds={["u-cy"]} />);
        await open();
        await waitFor(() => expect(get).toHaveBeenCalled());
        await waitFor(() => expect(optionNames().join("|")).toMatch(/Cy/));
        expect(optionNames().join("|")).not.toMatch(/Ann|Bob|Di/);
        quiet.mockRestore();
    });

    it("says why when there is nobody to add", async () => {
        get.mockResolvedValue(roster());
        render(<Harness />);
        await open();
        expect(
            await screen.findByText(getMessages().tasks.picker.collaboratorsProjectOnly)
        ).toBeInTheDocument();
    });
});

describe("collaborators already on the task who the rule would not admit", () => {
    it("stay visible and removable, and cannot be added back", async () => {
        get.mockResolvedValue(roster("u-ann"));
        const onChange = vi.fn();
        render(<Harness initial={[bob]} onChange={onChange} />);
        // Bob (team only, saved earlier) is on the list as a chip.
        expect(screen.getByText("Bob")).toBeInTheDocument();

        // Remove him through the chip's delete control.
        const chip = screen.getByText("Bob").closest("div");
        const remove = chip?.parentElement?.querySelector("button");
        expect(remove).toBeTruthy();
        await userEvent.click(remove as HTMLElement);
        expect(onChange).toHaveBeenLastCalledWith([]);
        expect(screen.queryByText("Bob")).not.toBeInTheDocument();

        // Now he is not offered any more.
        await open();
        await waitFor(() => expect(optionNames().join("|")).toMatch(/Ann/));
        expect(optionNames().join("|")).not.toMatch(/Bob/);
    });

    it("are kept on a saved task even when the roster is known", async () => {
        get.mockResolvedValue(roster("u-ann"));
        const onChange = vi.fn();
        render(<Harness initial={[bob]} onChange={onChange} />);
        await open();
        await waitFor(() => expect(get).toHaveBeenCalled());
        expect(onChange).not.toHaveBeenCalled();
        // The chip, not the list's row for him: the row used to read "Bob - <email>", so a
        // plain `getByText("Bob")` only ever found the chip (MIP-1703 took the address off).
        const chips = screen.getAllByText("Bob").filter((el) => !el.closest('[role="option"]'));
        expect(chips).toHaveLength(1);
    });
});

describe("creating a task or milestone", () => {
    it("takes off the list whoever the project does not admit once the roster is known", async () => {
        get.mockResolvedValue(roster("u-ann"));
        const onChange = vi.fn();
        render(<Harness initial={[ann, bob]} dropDisallowed onChange={onChange} />);
        await waitFor(() => expect(onChange).toHaveBeenLastCalledWith([ann]));
        expect(screen.queryByText("Bob")).not.toBeInTheDocument();
        expect(screen.getByText("Ann")).toBeInTheDocument();
    });

    it("keeps everyone when the roster cannot be read (nothing to judge by)", async () => {
        const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
        get.mockRejectedValue(new Error("offline"));
        const onChange = vi.fn();
        render(<Harness initial={[ann, bob]} dropDisallowed onChange={onChange} />);
        await waitFor(() => expect(get).toHaveBeenCalled());
        await act(async () => {});
        expect(onChange).not.toHaveBeenCalled();
        quiet.mockRestore();
    });

    it("keeps an assignee-only teammate while they are the assignee, and drops them once they are not", async () => {
        get.mockResolvedValue(roster("u-ann"));
        const onChange = vi.fn();
        const { rerender } = render(
            <Harness holderIds={["u-cy"]} initial={[cy]} dropDisallowed onChange={onChange} />
        );
        await waitFor(() => expect(get).toHaveBeenCalled());
        await act(async () => {});
        expect(onChange).not.toHaveBeenCalled();
        // The assignee is changed: a Harness re-render with no holders.
        rerender(<Harness holderIds={[]} initial={[cy]} dropDisallowed onChange={onChange} />);
        await waitFor(() => expect(onChange).toHaveBeenLastCalledWith([]));
    });
});
