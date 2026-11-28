/**
 * The "Installed" filter of the Skills list (MIP-2226): the public skills the member pinned, an
 * "Update available" marker on the rows a newer version has left behind, and that marker opening
 * the update diff dialog of MIP-2192. Every network edge is mocked; the layout is checked in
 * screenshots (see the PR).
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as api from "../features/genos/skills/skillsApi";
import { parseSkill, type SkillRow, type UpdateDiff } from "../features/genos/skills/skillsApi";
import type { SkillsHost } from "../features/genos/skills/skillsHost";
import { SkillsPage } from "../features/genos/skills/SkillsPage";
import { I18nProvider } from "../i18n";

vi.mock("../context/authState", () => ({
    useAuth: () => ({ accessToken: "tok" }),
}));

vi.mock("../features/genos/skills/skillsApi", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../features/genos/skills/skillsApi")>();
    return {
        ...actual,
        fetchSkills: vi.fn(),
        fetchUpdateDiff: vi.fn(),
        acceptSkillUpdate: vi.fn(),
    };
});

const base = (over: Partial<SkillRow> = {}): SkillRow => ({
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

const installed = (over: Partial<SkillRow> = {}): SkillRow =>
    base({
        id: "p1",
        teamId: "",
        slug: "roadmap-review",
        title: "Roadmap review",
        visibility: "public",
        publishedVersionNo: 3,
        mine: false,
        role: "reader",
        canEdit: false,
        canManage: false,
        ownerName: "",
        author: { handle: "ana-lopez", displayName: "Ana" },
        noteId: null,
        installedVersionNo: 1,
        updateAvailable: true,
        ...over,
    });

const upToDate = installed({
    id: "p2",
    slug: "release-notes",
    title: "Release notes",
    publishedVersionNo: 2,
    installedVersionNo: 2,
    updateAvailable: false,
});

const list = (skills: SkillRow[], publicEnabled = true) => ({
    ok: true as const,
    data: { skills, limit: 25, used: 1, publicEnabled },
});

const diff = (over: Partial<UpdateDiff> = {}): UpdateDiff => ({
    fromVersionNo: 1,
    toVersionNo: 3,
    upToDate: false,
    changes: [],
    toolLevelRaised: false,
    changelogs: [{ versionNo: 3, changelog: "Sharper agenda" }],
    diff: "@@ -1 +1 @@\n-old line\n+new line\n",
    truncated: false,
    needsConfirmation: false,
    ...over,
});

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

const openInstalled = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(await screen.findByRole("tab", { name: "Installed" }));
};

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.fetchSkills).mockImplementation(async (_token, _team, tab) =>
        tab === "installed" ? list([installed(), upToDate]) : list([base()])
    );
    vi.mocked(api.fetchUpdateDiff).mockResolvedValue({ ok: true, data: diff() });
    vi.mocked(api.acceptSkillUpdate).mockResolvedValue({
        ok: true,
        data: { installedVersionNo: 3 },
    });
});

describe("reading the pinned version of a row", () => {
    it("keeps the pinned version and the flag together, and drops a stray flag", () => {
        const row = parseSkill({ id: "p1", installedVersionNo: 2, updateAvailable: true });
        expect([row?.installedVersionNo, row?.updateAvailable]).toEqual([2, true]);
        const stray = parseSkill({ id: "p2", updateAvailable: true });
        expect([stray?.installedVersionNo, stray?.updateAvailable]).toEqual([null, false]);
        const bad = parseSkill({ id: "p3", installedVersionNo: -1, updateAvailable: true });
        expect([bad?.installedVersionNo, bad?.updateAvailable]).toEqual([null, false]);
    });
});

describe("the Installed filter", () => {
    it("sits next to My skills and Team, and asks the server for the installed tab", async () => {
        const user = userEvent.setup();
        renderPage();
        await screen.findByRole("tab", { name: "Installed" });
        const tabs = screen.getAllByRole("tab");
        expect(tabs.map((t) => t.textContent)).toEqual([
            "My skills",
            "Team skills",
            "Installed",
            "Genos Hub",
        ]);
        await openInstalled(user);
        await screen.findByText("Roadmap review");
        expect(api.fetchSkills).toHaveBeenLastCalledWith("tok", "team-1", "installed");
    });

    it("is not there while the server's public switch is off", async () => {
        vi.mocked(api.fetchSkills).mockResolvedValue(list([base()], false));
        renderPage();
        await screen.findByText("Weekly update");
        expect(screen.queryByRole("tab", { name: "Installed" })).toBeNull();
    });

    it("marks only the rows with a newer version, and every installed row has the footer", async () => {
        const user = userEvent.setup();
        renderPage();
        await openInstalled(user);
        await screen.findByText("Roadmap review");
        const rows = screen.getAllByRole("listitem");
        expect(rows).toHaveLength(2);
        const [behind, current] = rows;
        // The marker, and the line that says which versions.
        expect(within(behind).getByRole("button", { name: /Update available/ })).toBeVisible();
        expect(within(behind).getByText("Version 1 · latest 3")).toBeInTheDocument();
        // The row without the marker says so in the same slot; it has no marker button.
        expect(within(current).getByText("Version 2 · up to date")).toBeInTheDocument();
        expect(within(current).queryByRole("button", { name: /Update available/ })).toBeNull();
        // Same parts in both: the row button, the footer line and the actions menu.
        expect(behind.children.length).toBe(current.children.length);
        // A public skill reads as public, with its author's handle, never as private.
        expect(within(behind).getByText("Public")).toBeInTheDocument();
        expect(within(behind).queryByText("Private")).toBeNull();
        expect(within(behind).getByText(/By @ana-lopez/)).toBeInTheDocument();
    });

    it("opens the update dialog from the marker, and reloads the list after an update", async () => {
        const user = userEvent.setup();
        renderPage();
        await openInstalled(user);
        await screen.findByText("Roadmap review");
        const fetchesBefore = vi.mocked(api.fetchSkills).mock.calls.length;
        await user.click(screen.getByRole("button", { name: /Update available/ }));
        expect(api.fetchUpdateDiff).toHaveBeenCalledWith("tok", "p1");
        await screen.findByText("Sharper agenda");
        await user.click(screen.getByRole("button", { name: "Update to version 3" }));
        await waitFor(() => expect(api.acceptSkillUpdate).toHaveBeenCalledWith("tok", "p1", 3));
        await waitFor(() =>
            expect(vi.mocked(api.fetchSkills).mock.calls.length).toBeGreaterThan(fetchesBefore)
        );
        expect(api.fetchSkills).toHaveBeenLastCalledWith("tok", "team-1", "installed");
    });

    it("refreshes in place after an update: no skeleton, and focus goes to that row", async () => {
        const user = userEvent.setup();
        let updated = false;
        vi.mocked(api.fetchSkills).mockImplementation(async (_token, _team, tab) =>
            tab === "installed"
                ? list([
                      updated
                          ? installed({ installedVersionNo: 3, updateAvailable: false })
                          : installed(),
                      upToDate,
                  ])
                : list([base()])
        );
        vi.mocked(api.acceptSkillUpdate).mockImplementation(async () => {
            updated = true;
            return { ok: true, data: { installedVersionNo: 3 } };
        });
        renderPage();
        await openInstalled(user);
        await screen.findByText("Roadmap review");
        await user.click(screen.getByRole("button", { name: /Update available/ }));
        await screen.findByText("Sharper agenda");
        await user.click(screen.getByRole("button", { name: "Update to version 3" }));
        // The marker is gone and the row says so; the list was never swapped for a skeleton.
        await screen.findByText("Version 3 · up to date");
        expect(screen.queryByRole("button", { name: /Update available/ })).toBeNull();
        expect(screen.queryByLabelText("Loading skills…")).toBeNull();
        await waitFor(() =>
            expect(screen.getByRole("button", { name: "Roadmap review" })).toHaveFocus()
        );
    });

    it("keeps the Installed tab selected if the server's public switch turns off meanwhile", async () => {
        const user = userEvent.setup();
        let off = false;
        vi.mocked(api.fetchSkills).mockImplementation(async (_token, _team, tab) =>
            tab === "installed" ? list([installed(), upToDate], !off) : list([base()])
        );
        renderPage();
        await openInstalled(user);
        await screen.findByText("Roadmap review");
        off = true;
        await user.click(screen.getByRole("button", { name: /Update available/ }));
        await screen.findByText("Sharper agenda");
        await user.click(screen.getByRole("button", { name: "Update to version 3" }));
        await waitFor(() => expect(api.acceptSkillUpdate).toHaveBeenCalled());
        expect(await screen.findByRole("tab", { name: "Installed" })).toHaveAttribute(
            "aria-selected",
            "true"
        );
    });

    it("explains an empty list", async () => {
        const user = userEvent.setup();
        vi.mocked(api.fetchSkills).mockImplementation(async (_token, _team, tab) =>
            tab === "installed" ? list([]) : list([base()])
        );
        renderPage();
        await openInstalled(user);
        await screen.findByText("No installed skills yet");
    });

    it("draws no footer on the other tabs, whatever the rows say", async () => {
        vi.mocked(api.fetchSkills).mockResolvedValue(
            list([installed({ visibility: "team", mine: false })])
        );
        renderPage();
        await screen.findByText("Roadmap review");
        expect(screen.queryByRole("button", { name: /Update available/ })).toBeNull();
        expect(screen.queryByText(/up to date/)).toBeNull();
    });
});
