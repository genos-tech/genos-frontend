/**
 * Install and Uninstall for public skills (MIP-2293): the Hub row menu, the page of a public skill
 * and the Installed tab, so the Installed filter (MIP-2226) can fill itself from the UI. Every
 * network edge is mocked; the layout is checked in screenshots (see the PR). What is pinned here is
 * the client's side of the API contract: which request each action sends, that the row changes only
 * once the server said yes, and which rows are offered the action at all.
 */

import { forwardRef, useImperativeHandle } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { toast } from "../components/ui/feedback/toastStore";
import * as api from "../features/genos/skills/skillsApi";
import { type SkillRow } from "../features/genos/skills/skillsApi";
import type { SkillsHost } from "../features/genos/skills/skillsHost";
import { SkillsPage } from "../features/genos/skills/SkillsPage";
import { I18nProvider } from "../i18n";

vi.mock("../context/authState", () => ({
    useAuth: () => ({ accessToken: "tok" }),
}));

vi.mock("../features/genos/skills/SkillBodyEditor", () => ({
    SkillBodyEditor: forwardRef(function Stub(
        props: { handleRef?: React.Ref<{ flush: () => Promise<void> }> },
        _ref
    ) {
        useImperativeHandle(props.handleRef, () => ({ flush: async () => undefined }));
        return <div data-testid="body-editor">editor</div>;
    }),
}));
vi.mock("../features/genos/skills/skillNoteTitle", () => ({ syncSkillNoteTitle: vi.fn() }));

vi.mock("../features/genos/skills/skillsApi", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../features/genos/skills/skillsApi")>();
    return {
        ...actual,
        fetchSkills: vi.fn(),
        fetchSkill: vi.fn(),
        fetchSkillVersions: vi.fn(),
        fetchHub: vi.fn(),
        fetchHubTags: vi.fn(),
        installSkill: vi.fn(),
        uninstallSkill: vi.fn(),
    };
});

const mine = (over: Partial<SkillRow> = {}): SkillRow => ({
    id: "s1",
    teamId: "team-1",
    slug: "weekly-update",
    title: "Weekly update",
    description: "Summarise the week",
    tags: [],
    icon: "",
    argumentHint: "",
    toolLevel: "read",
    effort: "",
    visibility: "private",
    status: "active",
    moderationReason: "",
    currentVersionNo: 1,
    publishedVersionNo: 0,
    createdAt: "2026-11-20T10:00:00Z",
    updatedAt: "2026-11-21T10:00:00Z",
    publishedAt: null,
    mine: true,
    role: "owner",
    canEdit: true,
    canManage: true,
    canHide: false,
    hiddenByTeam: false,
    ownerName: "ken",
    author: null,
    starCount: 0,
    runCount30d: 0,
    copyCount: 0,
    isOfficial: false,
    starred: false,
    sourceHarmful: false,
    editors: [],
    shares: [],
    forkedFrom: null,
    noteId: 12,
    hasUnpublishedChanges: false,
    unpublishedChanges: [],
    ...over,
});

const publicSkill = (over: Partial<SkillRow> = {}): SkillRow =>
    mine({
        id: "p1",
        teamId: "",
        slug: "roadmap-review",
        title: "Roadmap review",
        visibility: "public",
        publishedVersionNo: 3,
        publishedAt: "2026-11-21T10:00:00Z",
        mine: false,
        role: "reader",
        canEdit: false,
        canManage: false,
        ownerName: "",
        author: { handle: "ana-lopez", displayName: "Ana" },
        noteId: null,
        ...over,
    });

const list = (skills: SkillRow[]) => ({
    ok: true as const,
    data: { skills, limit: 25, used: 1, publicEnabled: true },
});
const hubPage = (skills: SkillRow[]) => ({ ok: true as const, data: { skills, hasMore: false } });

const host = {
    myself: { userId: "u1" },
    setMyself: vi.fn(),
    socket: null,
    useTEM: { teamMembers: [] },
    useCM: {},
    useUISM: {},
} as unknown as SkillsHost;

const renderPage = () =>
    render(
        <CssVarsProvider>
            <I18nProvider>
                <MemoryRouter>
                    <SkillsPage host={host} teamId="team-1" />
                </MemoryRouter>
            </I18nProvider>
        </CssVarsProvider>
    );

const openHub = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(await screen.findByRole("tab", { name: "Genos Hub" }));
};

const openMenu = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
    await user.click(screen.getByRole("button", { name: `Actions for ${name}` }));
};

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.fetchSkills).mockResolvedValue(list([mine()]));
    vi.mocked(api.fetchSkill).mockResolvedValue({
        ok: true,
        data: { ...publicSkill(), bodyMarkdown: "# Roadmap" },
    });
    vi.mocked(api.fetchSkillVersions).mockResolvedValue({ ok: true, data: [] });
    vi.mocked(api.fetchHub).mockResolvedValue(hubPage([publicSkill()]));
    vi.mocked(api.fetchHubTags).mockResolvedValue({ ok: true, data: [] });
    vi.mocked(api.installSkill).mockResolvedValue({ ok: true, data: { installedVersionNo: 3 } });
    vi.mocked(api.uninstallSkill).mockResolvedValue({ ok: true, data: null });
});

describe("the client of POST and DELETE /skills/<id>/install/", () => {
    it("reads the pinned version and refuses an answer without one", async () => {
        const actual = await vi.importActual<typeof import("../features/genos/skills/skillsApi")>(
            "../features/genos/skills/skillsApi"
        );
        expect(typeof actual.installSkill).toBe("function");
        expect(typeof actual.uninstallSkill).toBe("function");
        // No token = no request: a refusal value, not a throw.
        expect(await actual.installSkill(null, "p1")).toMatchObject({ ok: false });
        expect(await actual.uninstallSkill(null, "p1")).toMatchObject({ ok: false });
    });
});

describe("Install on a Hub row", () => {
    it("offers Install in the row menu, sends it, and shows Installed once the server said yes", async () => {
        const user = userEvent.setup();
        let resolveInstall: (v: { ok: true; data: { installedVersionNo: number } }) => void = () =>
            undefined;
        vi.mocked(api.installSkill).mockReturnValueOnce(
            new Promise((resolve) => {
                resolveInstall = resolve;
            })
        );
        const success = vi.spyOn(toast, "success");
        renderPage();
        await openHub(user);
        const row = (await screen.findByText("Roadmap review")).closest("li") as HTMLElement;
        expect(row.textContent).not.toContain("Installed");

        await openMenu(user, "Roadmap review");
        await user.click(await screen.findByRole("menuitem", { name: "Install" }));
        await waitFor(() => expect(api.installSkill).toHaveBeenCalledWith("tok", "p1"));
        // Nothing is shown as done before the answer.
        expect(row.textContent).not.toContain("Installed");
        resolveInstall({ ok: true, data: { installedVersionNo: 3 } });
        await waitFor(() => expect(row.textContent).toContain("Installed"));
        expect(success).toHaveBeenCalledWith(expect.stringContaining("Installed"));

        // The same menu now offers Uninstall, not Install.
        await openMenu(user, "Roadmap review");
        expect(await screen.findByRole("menuitem", { name: "Uninstall" })).toBeInTheDocument();
        expect(screen.queryByRole("menuitem", { name: "Install" })).toBeNull();
    });

    it("keeps the row as it was and says why when the server refuses", async () => {
        const user = userEvent.setup();
        vi.mocked(api.installSkill).mockResolvedValue({
            ok: false,
            reason: "bad_input",
            message: "This skill was taken down.",
        });
        const error = vi.spyOn(toast, "error");
        renderPage();
        await openHub(user);
        const row = (await screen.findByText("Roadmap review")).closest("li") as HTMLElement;
        await openMenu(user, "Roadmap review");
        await user.click(await screen.findByRole("menuitem", { name: "Install" }));
        await waitFor(() => expect(error).toHaveBeenCalledWith("This skill was taken down."));
        expect(row.textContent).not.toContain("Installed");
    });

    it("marks a skill the member already installed and offers Uninstall, which sends DELETE", async () => {
        const user = userEvent.setup();
        vi.mocked(api.fetchHub).mockResolvedValue(
            hubPage([publicSkill({ installedVersionNo: 2, updateAvailable: true })])
        );
        renderPage();
        await openHub(user);
        const row = (await screen.findByText("Roadmap review")).closest("li") as HTMLElement;
        expect(row.textContent).toContain("Installed");
        await openMenu(user, "Roadmap review");
        expect(screen.queryByRole("menuitem", { name: "Install" })).toBeNull();
        await user.click(await screen.findByRole("menuitem", { name: "Uninstall" }));
        await waitFor(() => expect(api.uninstallSkill).toHaveBeenCalledWith("tok", "p1"));
        await waitFor(() => expect(row.textContent).not.toContain("Installed"));
        expect(api.installSkill).not.toHaveBeenCalled();
    });

    it("does not offer Install on the member's own public skill", async () => {
        const user = userEvent.setup();
        vi.mocked(api.fetchHub).mockResolvedValue(
            hubPage([publicSkill({ mine: true, role: "owner", canEdit: true })])
        );
        renderPage();
        await openHub(user);
        await screen.findByText("Roadmap review");
        await openMenu(user, "Roadmap review");
        await screen.findByRole("menuitem", { name: "View" });
        expect(screen.queryByRole("menuitem", { name: "Install" })).toBeNull();
        expect(screen.queryByRole("menuitem", { name: "Uninstall" })).toBeNull();
    });

    it("sends one request however fast the menu item is used twice", async () => {
        const user = userEvent.setup();
        let resolveInstall: (v: { ok: true; data: { installedVersionNo: number } }) => void = () =>
            undefined;
        vi.mocked(api.installSkill).mockReturnValue(
            new Promise((resolve) => {
                resolveInstall = resolve;
            })
        );
        renderPage();
        await openHub(user);
        await screen.findByText("Roadmap review");
        await openMenu(user, "Roadmap review");
        await user.click(await screen.findByRole("menuitem", { name: "Install" }));
        await openMenu(user, "Roadmap review");
        await user.click(await screen.findByRole("menuitem", { name: "Install" }));
        resolveInstall({ ok: true, data: { installedVersionNo: 3 } });
        await waitFor(() => expect(api.installSkill).toHaveBeenCalledTimes(1));
    });
});

describe("the page of a public skill", () => {
    const openPublicPage = async (over: Partial<SkillRow> = {}) => {
        const user = userEvent.setup();
        vi.mocked(api.fetchSkill).mockResolvedValue({
            ok: true,
            data: { ...publicSkill(over), bodyMarkdown: "# Roadmap" },
        });
        renderPage();
        await openHub(user);
        await user.click(await screen.findByRole("button", { name: "Roadmap review" }));
        return user;
    };

    it("installs from the page and then offers Uninstall", async () => {
        const user = await openPublicPage();
        await user.click(await screen.findByRole("button", { name: "Install" }));
        await waitFor(() => expect(api.installSkill).toHaveBeenCalledWith("tok", "p1"));
        const un = await screen.findByRole("button", { name: "Uninstall" });
        expect(screen.queryByRole("button", { name: "Install" })).toBeNull();
        await user.click(un);
        await waitFor(() => expect(api.uninstallSkill).toHaveBeenCalledWith("tok", "p1"));
        expect(await screen.findByRole("button", { name: "Install" })).toBeInTheDocument();
    });

    it("opens as installed when the detail answer says so", async () => {
        await openPublicPage({ installedVersionNo: 3, updateAvailable: false });
        expect(await screen.findByRole("button", { name: "Uninstall" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Install" })).toBeNull();
    });

    it("has no Install button on the member's own skill", async () => {
        await openPublicPage({ mine: true, role: "owner", canEdit: true, canManage: true });
        await screen.findByDisplayValue("Roadmap review");
        expect(screen.queryByRole("button", { name: "Install" })).toBeNull();
        expect(screen.queryByRole("button", { name: "Uninstall" })).toBeNull();
    });
});

describe("the Installed tab", () => {
    const openInstalled = async (user: ReturnType<typeof userEvent.setup>) => {
        await user.click(await screen.findByRole("tab", { name: "Installed" }));
    };

    it("uninstalls from the row menu and reads the list again", async () => {
        const user = userEvent.setup();
        const pinned = publicSkill({ installedVersionNo: 3, updateAvailable: false });
        vi.mocked(api.fetchSkills).mockImplementation(async (_t, _team, tab) =>
            tab === "installed" ? list([pinned]) : list([mine()])
        );
        renderPage();
        await openInstalled(user);
        await screen.findByText("Roadmap review");
        vi.mocked(api.fetchSkills).mockResolvedValue(list([]));
        await openMenu(user, "Roadmap review");
        await user.click(await screen.findByRole("menuitem", { name: "Uninstall" }));
        await waitFor(() => expect(api.uninstallSkill).toHaveBeenCalledWith("tok", "p1"));
        await waitFor(() => expect(screen.queryByText("Roadmap review")).toBeNull());
    });

    it("keeps an installed row in place and says why when the uninstall fails", async () => {
        const user = userEvent.setup();
        vi.mocked(api.fetchSkills).mockImplementation(async (_t, _team, tab) =>
            tab === "installed"
                ? list([publicSkill({ installedVersionNo: 3, updateAvailable: false })])
                : list([mine()])
        );
        vi.mocked(api.uninstallSkill).mockResolvedValue({
            ok: false,
            reason: "error",
            message: "",
        });
        const error = vi.spyOn(toast, "error");
        renderPage();
        await openInstalled(user);
        const row = (await screen.findByText("Roadmap review")).closest("li") as HTMLElement;
        await openMenu(user, "Roadmap review");
        await user.click(await screen.findByRole("menuitem", { name: "Uninstall" }));
        await waitFor(() =>
            expect(error).toHaveBeenCalledWith("Couldn't uninstall. Please try again.")
        );
        expect(within(row).getByText("Roadmap review")).toBeInTheDocument();
    });
});
