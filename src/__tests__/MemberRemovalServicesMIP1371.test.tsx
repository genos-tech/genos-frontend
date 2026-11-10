/**
 * MIP-1371, the pieces around the remove button: the requests it sends, the team's view of the
 * connected AI apps and the pending invites, the live notice, and the three modals' wiring.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TeamConnectedAppsSection } from "../components/layout/TeamConnectedAppsSection";
import { PendingInvitesSection } from "../features/admin/components/modals/PendingInvitesSection";
import { loadOpenWork, removeMember } from "../features/admin/services/removeMember";
import { authApi } from "../services/api";
import { handleMembershipRemoved } from "../services/channel/membershipRemoved";
import { listTeamInvites, revokeTeamInvite } from "../services/teamIntegrations";

vi.mock("../services/api", () => ({ authApi: vi.fn(), nonAuthApi: vi.fn() }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));
const listChannels = vi.fn().mockResolvedValue([]);
vi.mock("../services/channel/channelService", () => ({
    channelService: { listChannels: (...a: unknown[]) => listChannels(...a) },
}));

const get = vi.fn();
const post = vi.fn();
const del = vi.fn();
beforeEach(() => {
    get.mockReset();
    post.mockReset();
    del.mockReset();
    listChannels.mockClear();
    (authApi as ReturnType<typeof vi.fn>).mockReturnValue({ get, post, delete: del });
});

describe("removeMember", () => {
    it("a team removal posts team_id, user_id and a literal unassign flag", async () => {
        post.mockResolvedValue({ data: { unassigned: { tasks: 2, milestones: 0 } } });
        const out = await removeMember("tok", "team", "t-1", "u-1", true);
        expect(post).toHaveBeenCalledWith(
            "/team/member/remove/",
            { team_id: "t-1", user_id: "u-1", unassign_open_tasks: true },
            { suppressErrorToast: true }
        );
        expect(out).toEqual({ tasks: 2, milestones: 0 });
    });

    it("a project removal posts project_id", async () => {
        post.mockResolvedValue({ data: { unassigned: { tasks: 0, milestones: 0 } } });
        await removeMember("tok", "project", 7, "u-1", false);
        expect(post).toHaveBeenCalledWith(
            "/project/member/remove/",
            { project_id: 7, user_id: "u-1", unassign_open_tasks: false },
            { suppressErrorToast: true }
        );
    });

    it("throws the server's reason so the dialog can show it", async () => {
        post.mockRejectedValue(
            Object.assign(new Error("403"), {
                isAxiosError: true,
                response: {
                    status: 403,
                    data: { error: "Only the team owner can remove an editor." },
                },
            })
        );
        await expect(removeMember("tok", "team", "t-1", "u-1", false)).rejects.toThrow(
            "Only the team owner can remove an editor."
        );
    });

    it("falls back to a plain sentence when the server gave no reason", async () => {
        post.mockRejectedValue(new Error("network"));
        await expect(removeMember("tok", "team", "t-1", "u-1", false)).rejects.toThrow(
            "Couldn't remove that member"
        );
    });
});

describe("loadOpenWork", () => {
    it("reads the preview of the right scope and returns the counts", async () => {
        get.mockResolvedValue({ data: { openWork: { tasks: 3, milestones: 1 } } });
        expect(await loadOpenWork("tok", "project", 7, "u-1")).toEqual({
            tasks: 3,
            milestones: 1,
        });
        expect(get).toHaveBeenCalledWith("/project/member/remove/", {
            params: { project_id: 7, user_id: "u-1" },
            suppressErrorToast: true,
        });
        await loadOpenWork("tok", "team", "t-1", "u-1");
        expect(get).toHaveBeenLastCalledWith("/team/member/remove/", {
            params: { team_id: "t-1", user_id: "u-1" },
            suppressErrorToast: true,
        });
    });

    it("is null when it can't be read, never a throw", async () => {
        get.mockRejectedValue(new Error("403"));
        expect(await loadOpenWork("tok", "team", "t-1", "u-1")).toBeNull();
    });
});

const APP = {
    id: "c1",
    userId: "u1",
    userName: "Vic Viewer",
    userEmail: "vic@example.com",
    client: { name: "Claude", kind: "registered", host: "", url: "" },
    scope: "write",
    allowDestructive: false,
    isDefaultTeam: true,
    otherTeams: 2,
    lastUsedAt: null,
    createdAt: "2026-11-06T00:00:00Z",
    revocable: true,
};

const renderUi = (ui: React.ReactElement) => render(<CssVarsProvider>{ui}</CssVarsProvider>);

describe("TeamConnectedAppsSection", () => {
    it("lists each app with who connected it, and an end button only where allowed", async () => {
        get.mockResolvedValue({
            data: {
                connections: [
                    APP,
                    { ...APP, id: "c2", userName: "Olive Owner", revocable: false },
                ],
            },
        });
        renderUi(<TeamConnectedAppsSection teamId="t-1" />);
        const first = await screen.findByTestId("team-app-c1");
        expect(within(first).getByText("Claude")).toBeInTheDocument();
        expect(within(first).getByText("Connected by Vic Viewer")).toBeInTheDocument();
        expect(within(first).getByText(/also 2 other teams/)).toBeInTheDocument();
        expect(
            within(first).getByRole("button", { name: "End Claude for Vic Viewer" })
        ).toBeTruthy();
        const second = screen.getByTestId("team-app-c2");
        expect(within(second).queryByRole("button")).toBeNull();
    });

    it("renders nothing when the caller may not see the list", async () => {
        get.mockRejectedValue(new Error("404"));
        const { container } = renderUi(<TeamConnectedAppsSection teamId="t-1" />);
        await waitFor(() => expect(get).toHaveBeenCalled());
        expect(container.querySelector("[data-testid=team-connected-apps]")).toBeNull();
    });

    it("says so when no app is connected", async () => {
        get.mockResolvedValue({ data: { connections: [] } });
        renderUi(<TeamConnectedAppsSection teamId="t-1" />);
        expect(
            await screen.findByText("No AI apps are connected to this team.")
        ).toBeInTheDocument();
    });

    it("ends access for this team only after confirming, then refreshes", async () => {
        get.mockResolvedValueOnce({ data: { connections: [APP] } }).mockResolvedValue({
            data: { connections: [] },
        });
        del.mockResolvedValue({ data: { id: "c1", ended: false } });
        renderUi(<TeamConnectedAppsSection teamId="t-1" />);
        fireEvent.click(await screen.findByRole("button", { name: "End Claude for Vic Viewer" }));
        expect(del).not.toHaveBeenCalled();
        expect(await screen.findByText("End Claude for Vic Viewer?")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "End access" }));
        await waitFor(() =>
            expect(del).toHaveBeenCalledWith("/team/mcp-connections/c1/", {
                params: { team_id: "t-1" },
                suppressErrorToast: true,
            })
        );
        await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    });
});

const INVITE = {
    id: "i1",
    email: "newhire@example.com",
    memberRole: "viewer",
    projectId: null,
    projectName: null,
    invitedBy: "Olive Owner",
    expiresAt: "2026-11-20T00:00:00Z",
    createdAt: "2026-11-10T00:00:00Z",
};

describe("PendingInvitesSection", () => {
    it("lists the waiting invitations", async () => {
        get.mockResolvedValue({
            data: {
                invites: [INVITE, { ...INVITE, id: "i2", email: "g@x.com", projectName: "Site" }],
            },
        });
        renderUi(<PendingInvitesSection teamId="t-1" zIndex={1300} />);
        expect(await screen.findByText("Pending invites (2)")).toBeInTheDocument();
        expect(screen.getByText("newhire@example.com")).toBeInTheDocument();
        expect(screen.getByText("Guest of Site")).toBeInTheDocument();
    });

    it("renders nothing when there are none, or the caller may not see them", async () => {
        get.mockResolvedValue({ data: { invites: [] } });
        const a = renderUi(<PendingInvitesSection teamId="t-1" zIndex={1300} />);
        await waitFor(() => expect(get).toHaveBeenCalled());
        expect(a.container.querySelector("[data-testid=pending-invites]")).toBeNull();
        a.unmount();
        get.mockRejectedValue(new Error("404"));
        const b = renderUi(<PendingInvitesSection teamId="t-1" zIndex={1300} />);
        await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
        expect(b.container.querySelector("[data-testid=pending-invites]")).toBeNull();
    });

    it("cancels an invite only after confirming, then refreshes the list", async () => {
        get.mockResolvedValueOnce({ data: { invites: [INVITE] } }).mockResolvedValue({
            data: { invites: [] },
        });
        post.mockResolvedValue({ data: { status: "revoked" } });
        renderUi(<PendingInvitesSection teamId="t-1" zIndex={1300} />);
        fireEvent.click(
            await screen.findByRole("button", {
                name: "Cancel the invite for newhire@example.com",
            })
        );
        expect(post).not.toHaveBeenCalled();
        fireEvent.click(await screen.findByRole("button", { name: "Cancel invite" }));
        await waitFor(() =>
            expect(post).toHaveBeenCalledWith(
                "/team/invite/revoke/",
                { team_id: "t-1", invite_id: "i1" },
                { suppressErrorToast: true }
            )
        );
        await waitFor(() => expect(screen.queryByTestId("pending-invites")).toBeNull());
    });

    it("the services use the right endpoints", async () => {
        get.mockResolvedValue({ data: { invites: [INVITE] } });
        expect(await listTeamInvites("tok", "t-1")).toEqual([INVITE]);
        expect(get).toHaveBeenCalledWith("/team/invites/", {
            params: { team_id: "t-1" },
            suppressErrorToast: true,
        });
        post.mockRejectedValue({
            response: { data: { error: "This invite is already revoked." } },
        });
        await expect(revokeTeamInvite("tok", "t-1", "i1")).rejects.toThrow("already revoked");
    });
});

describe("the live notice", () => {
    const NOTICE = { scope: "project" as const, teamId: "t-1", projectIds: [7], channels: [] };

    beforeEach(() => {
        localStorage.setItem("teamId", "t-1");
    });

    it("re-reads the chat list and tells the screens that keep their own lists", () => {
        const heard = vi.fn();
        window.addEventListener("genos:membership-removed", heard);
        handleMembershipRemoved(NOTICE);
        window.removeEventListener("genos:membership-removed", heard);
        expect(listChannels).toHaveBeenCalledTimes(1);
        expect(heard).toHaveBeenCalledTimes(1);
        expect((heard.mock.calls[0][0] as CustomEvent).detail).toEqual(NOTICE);
        // Still in the team: nothing is forgotten.
        expect(localStorage.getItem("teamId")).toBe("t-1");
    });

    it("being removed from the team you are working in forgets it and reloads", () => {
        const assign = vi.fn();
        const original = window.location;
        Object.defineProperty(window, "location", {
            configurable: true,
            value: { ...original, assign },
        });
        handleMembershipRemoved({ ...NOTICE, scope: "team" });
        Object.defineProperty(window, "location", { configurable: true, value: original });
        expect(assign).toHaveBeenCalledWith("/workspace");
        expect(localStorage.getItem("teamId")).toBeNull();
        expect(listChannels).not.toHaveBeenCalled();
    });

    it("being removed from ANOTHER team leaves the one you are in alone", () => {
        handleMembershipRemoved({ ...NOTICE, scope: "team", teamId: "t-other" });
        expect(localStorage.getItem("teamId")).toBe("t-1");
        expect(listChannels).toHaveBeenCalledTimes(1);
    });

    it("a malformed notice does nothing", () => {
        handleMembershipRemoved(null as never);
        expect(listChannels).not.toHaveBeenCalled();
    });
});

const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = (path: string) => readFileSync(resolve(srcDir, path), "utf8");

describe("the three profile modals", () => {
    it.each([
        [
            "features/admin/components/modals/ModalTeamProfile.tsx",
            'kind: "team"',
            'removeMember(accessToken, "team"',
        ],
        [
            "features/admin/components/modals/ModalProjectProfile.tsx",
            'kind: "project"',
            'removeMember(accessToken, "project"',
        ],
        [
            "features/chat/components/modals/ModalGMProfile.tsx",
            'kind: "chat"',
            "channelService.removeMember(gmChat.chatId, ChannelKind.GM, userId)",
        ],
    ])(
        "%s uses the shared removal, with its button beside the role and its dialog",
        (file, kind, call) => {
            const text = source(file);
            expect(text).toContain("useMemberRemoval(");
            expect(text).toContain(kind);
            expect(text).toContain(call);
            expect(text).toMatch(/removal\.button\(\{[\s\S]{0,700}<MemberRoleControl/);
            expect(text).toContain("{removal.dialog}");
        }
    );

    it("only the team and project dialogs load open work; a chat has none", () => {
        expect(source("features/admin/components/modals/ModalTeamProfile.tsx")).toContain(
            "loadOpenWork:"
        );
        expect(source("features/admin/components/modals/ModalProjectProfile.tsx")).toContain(
            "loadOpenWork:"
        );
        expect(source("features/chat/components/modals/ModalGMProfile.tsx")).not.toContain(
            "loadOpenWork"
        );
    });

    it("the team modal shows the pending invites to managers only", () => {
        const text = source("features/admin/components/modals/ModalTeamProfile.tsx");
        expect(text).toMatch(/\{canManage && \(\s*<PendingInvitesSection/);
    });

    it("the socket router routes the notice", () => {
        expect(source("services/channel/socketRouter.ts")).toMatch(
            /on<MembershipRemovedNotice>\("membership\.removed"/
        );
    });

    it("the team keys list hides revoke where the server says it can't be done", () => {
        expect(source("components/layout/DeveloperSettingsSection.tsx")).toContain(
            "k.revocable !== false &&"
        );
    });
});
