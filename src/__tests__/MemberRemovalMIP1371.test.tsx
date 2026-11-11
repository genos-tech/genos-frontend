/**
 * MIP-1371: an owner or editor can remove another member of a team, project or chat.
 *
 * The rule is the server's (`can_remove_member`): the owner removes anyone but the owner, an
 * editor only viewers and guests, nobody removes themselves (that is Leave). The button is
 * shown by the same rule, and the dialog names what the person loses and, for a team or a
 * project, offers to unassign their open work (ticked by default).
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { useMemberRemoval } from "../components/ui/memberRoles/useMemberRemoval";
import { canRemoveMember, MEMBER_ROLE, type MemberRole } from "../utils/memberRoles";

describe("canRemoveMember", () => {
    const ROLES = Object.values(MEMBER_ROLE) as MemberRole[];
    const expected = (actor: MemberRole, target: MemberRole): boolean => {
        if (actor === "owner") return target !== "owner";
        if (actor === "editor") return target === "viewer" || target === "guest";
        return false;
    };

    it.each(ROLES.flatMap((a) => ROLES.map((t) => [a, t] as const)))("%s removing %s", (a, t) => {
        expect(canRemoveMember(a, t)).toBe(expected(a, t));
    });

    it("the owner is never removable, by anyone", () => {
        for (const actor of ROLES) expect(canRemoveMember(actor, "owner")).toBe(false);
    });

    it("an editor cannot remove another editor", () => {
        expect(canRemoveMember("editor", "editor")).toBe(false);
    });
});

const OWNER = "u-owner";
const EDITOR = "u-editor";
const EDITOR2 = "u-editor2";
const VIEWER = "u-viewer";

const members = [
    { userId: OWNER, memberRole: "viewer", name: "Olive Owner" }, // stored column is viewer
    { userId: EDITOR, memberRole: "editor", name: "Eddie Editor" },
    { userId: EDITOR2, memberRole: "editor", name: "Edna Editor" },
    { userId: VIEWER, memberRole: "viewer", name: "Vic Viewer" },
];

type HarnessProps = {
    kind: "team" | "project" | "chat";
    me: string;
    myRole: MemberRole;
    loadOpenWork?: (id: string) => Promise<{ tasks: number; milestones: number } | null>;
    remove: (id: string, unassign: boolean) => Promise<unknown>;
    onRemoved?: (id: string) => void;
};

const Harness = (p: HarnessProps) => {
    const removal = useMemberRemoval({
        kind: p.kind,
        scopeName: "Acme",
        ownerUserId: OWNER,
        myRole: p.myRole,
        myUserId: p.me,
        zIndex: 1300,
        loadOpenWork: p.loadOpenWork,
        remove: p.remove,
        onRemoved: p.onRemoved ?? (() => {}),
    });
    return (
        <>
            {members.map((m) => (
                <div key={m.userId}>{removal.button(m)}</div>
            ))}
            {removal.dialog}
        </>
    );
};

const mount = (p: HarnessProps) =>
    render(
        <CssVarsProvider>
            <Harness {...p} />
        </CssVarsProvider>
    );

const buttons = () =>
    members.filter((m) => screen.queryByTestId(`remove-member-${m.userId}`)).map((m) => m.userId);

const OPEN_WORK = { tasks: 3, milestones: 1 };

type RemoveFn = (id: string, unassign: boolean) => Promise<unknown>;

describe("who gets a remove button", () => {
    const remove = vi.fn<RemoveFn>().mockResolvedValue({});

    it("the owner gets one on every row but their own", () => {
        mount({ kind: "team", me: OWNER, myRole: "owner", remove });
        expect(buttons()).toEqual([EDITOR, EDITOR2, VIEWER]);
    });

    it("an editor gets one on viewers only, not on the owner, another editor or themselves", () => {
        mount({ kind: "team", me: EDITOR, myRole: "editor", remove });
        expect(buttons()).toEqual([VIEWER]);
    });

    it("a viewer gets none", () => {
        mount({ kind: "team", me: VIEWER, myRole: "viewer", remove });
        expect(buttons()).toEqual([]);
    });

    it("the owner's row reads as the owner even though the stored role is viewer", () => {
        mount({ kind: "team", me: EDITOR, myRole: "editor", remove });
        expect(screen.queryByTestId(`remove-member-${OWNER}`)).toBeNull();
    });

    it("the button is named after the person", () => {
        mount({ kind: "team", me: OWNER, myRole: "owner", remove });
        expect(screen.getByRole("button", { name: "Remove Vic Viewer" })).toBeInTheDocument();
    });
});

describe("the confirm dialog", () => {
    let remove: Mock<RemoveFn>;
    let onRemoved: Mock<(id: string) => void>;
    beforeEach(() => {
        remove = vi.fn<RemoveFn>().mockResolvedValue({});
        onRemoved = vi.fn<(id: string) => void>();
    });

    const open = (id = VIEWER) => fireEvent.click(screen.getByTestId(`remove-member-${id}`));

    it("names the person and what the team loses, and nothing is removed until confirmed", async () => {
        mount({ kind: "team", me: OWNER, myRole: "owner", remove, onRemoved });
        open();
        expect(await screen.findByText("Remove Vic Viewer from Acme?")).toBeInTheDocument();
        expect(
            screen.getByText(/loses access to Acme and to every project and chat/)
        ).toBeInTheDocument();
        expect(remove).not.toHaveBeenCalled();
    });

    it("each kind says what it removes", async () => {
        for (const [kind, text] of [
            ["project", /loses access to Acme and its chat/],
            ["chat", /will no longer see or get messages from Acme/],
        ] as const) {
            const { unmount } = mount({ kind, me: OWNER, myRole: "owner", remove });
            open();
            expect(await screen.findByText(text)).toBeInTheDocument();
            unmount();
        }
    });

    it("offers to unassign open work, ticked by default, with the counts", async () => {
        const loadOpenWork = vi.fn().mockResolvedValue(OPEN_WORK);
        mount({ kind: "team", me: OWNER, myRole: "owner", remove, onRemoved, loadOpenWork });
        open();
        const box = await screen.findByTestId("remove-member-unassign");
        expect(loadOpenWork).toHaveBeenCalledWith(VIEWER);
        expect(box.querySelector("input")).toBeChecked();
        expect(screen.getByText(/3 open tasks and 1 milestone/)).toBeInTheDocument();
        expect(screen.getByText(/Closed work keeps its assignee/)).toBeInTheDocument();
    });

    it("sends unassign=true when ticked and the person is removed", async () => {
        const loadOpenWork = vi.fn().mockResolvedValue(OPEN_WORK);
        mount({ kind: "team", me: OWNER, myRole: "owner", remove, onRemoved, loadOpenWork });
        open();
        await screen.findByTestId("remove-member-unassign");
        fireEvent.click(screen.getByRole("button", { name: "Remove" }));
        await waitFor(() => expect(remove).toHaveBeenCalledWith(VIEWER, true));
        await waitFor(() => expect(onRemoved).toHaveBeenCalledWith(VIEWER));
    });

    it("sends unassign=false when the box is unticked", async () => {
        const loadOpenWork = vi.fn().mockResolvedValue(OPEN_WORK);
        mount({ kind: "team", me: OWNER, myRole: "owner", remove, loadOpenWork });
        open();
        const box = (await screen.findByTestId("remove-member-unassign")).querySelector("input")!;
        fireEvent.click(box);
        fireEvent.click(screen.getByRole("button", { name: "Remove" }));
        await waitFor(() => expect(remove).toHaveBeenCalledWith(VIEWER, false));
    });

    it("offers nothing to unassign for someone with no open work, and sends false", async () => {
        const loadOpenWork = vi.fn().mockResolvedValue({ tasks: 0, milestones: 0 });
        mount({ kind: "team", me: OWNER, myRole: "owner", remove, loadOpenWork });
        open();
        await waitFor(() => expect(loadOpenWork).toHaveBeenCalled());
        expect(screen.queryByTestId("remove-member-unassign")).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "Remove" }));
        await waitFor(() => expect(remove).toHaveBeenCalledWith(VIEWER, false));
    });

    it("a chat has no work to unassign: no offer, and it never asks", async () => {
        mount({ kind: "chat", me: OWNER, myRole: "owner", remove });
        open();
        await screen.findByText(/will no longer see/);
        expect(screen.queryByTestId("remove-member-unassign")).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "Remove" }));
        await waitFor(() => expect(remove).toHaveBeenCalledWith(VIEWER, false));
    });

    it("a failure keeps the dialog open and shows the server's reason; nothing is reported removed", async () => {
        remove.mockRejectedValue(new Error("Only the team owner can remove an editor."));
        mount({ kind: "team", me: OWNER, myRole: "owner", remove, onRemoved });
        open();
        await screen.findByText("Remove Vic Viewer from Acme?");
        fireEvent.click(screen.getByRole("button", { name: "Remove" }));
        expect(
            await screen.findByText(/Only the team owner can remove an editor/)
        ).toBeInTheDocument();
        expect(onRemoved).not.toHaveBeenCalled();
        expect(screen.getByText("Remove Vic Viewer from Acme?")).toBeInTheDocument();
    });

    it("cancelling removes no one", async () => {
        mount({ kind: "team", me: OWNER, myRole: "owner", remove, onRemoved });
        open();
        await screen.findByText("Remove Vic Viewer from Acme?");
        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
        await waitFor(() => expect(screen.queryByText("Remove Vic Viewer from Acme?")).toBeNull());
        expect(remove).not.toHaveBeenCalled();
    });

    it("loading the open work does not repeat on every render", async () => {
        const loadOpenWork = vi.fn().mockResolvedValue(OPEN_WORK);
        mount({ kind: "team", me: OWNER, myRole: "owner", remove, loadOpenWork });
        open();
        await screen.findByTestId("remove-member-unassign");
        await new Promise((r) => setTimeout(r, 50));
        expect(loadOpenWork).toHaveBeenCalledTimes(1);
    });
});
