/**
 * The Genos Hub on the Skills page (MIP-2047): the tab, the directory (search, tag, sort, more),
 * the star, copy and report, the skill page of a public skill, and publishing to the Hub.
 *
 * Every network edge is mocked, and so is the note editor (the layout is checked in screenshots, see
 * the PR). What is pinned here is the CLIENT's side of the API contract: which request each action
 * sends, what the page does with each answer, and that nothing public is made without the owner's
 * confirmation.
 */

import { forwardRef, useImperativeHandle } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { toast } from "../components/ui/feedback/toastStore";
import * as api from "../features/genos/skills/skillsApi";
import { parseSkill, parseSkillList, type SkillRow } from "../features/genos/skills/skillsApi";
import type { SkillsHost } from "../features/genos/skills/skillsHost";
import { SkillsPage } from "../features/genos/skills/SkillsPage";
import { handleProblem } from "../features/genos/skills/skillText";
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
        updateSkill: vi.fn(),
        copySkill: vi.fn(),
        fetchSkillVersions: vi.fn(),
        fetchHub: vi.fn(),
        fetchHubTags: vi.fn(),
        setSkillStar: vi.fn(),
        fetchPublishCheck: vi.fn(),
        publishToHub: vi.fn(),
        reportSkill: vi.fn(),
    };
});

const skill = (over: Partial<SkillRow> = {}): SkillRow => ({
    id: "s1",
    teamId: "team-1",
    slug: "weekly-update",
    title: "Weekly update",
    description: "Summarise the week",
    tags: ["weekly"],
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
    forkedFrom: null,
    noteId: 12,
    hasUnpublishedChanges: false,
    unpublishedChanges: [],
    ...over,
});

const publicSkill = (over: Partial<SkillRow> = {}): SkillRow =>
    skill({
        id: "p1",
        teamId: "",
        slug: "roadmap-review",
        title: "Roadmap review",
        description: "Review the roadmap",
        tags: ["planning"],
        visibility: "public",
        publishedVersionNo: 3,
        publishedAt: "2026-11-21T10:00:00Z",
        mine: false,
        role: "reader",
        canEdit: false,
        canManage: false,
        ownerName: "",
        author: { handle: "ana-lopez", displayName: "Ana" },
        starCount: 12,
        runCount30d: 7,
        copyCount: 4,
        noteId: null,
        ...over,
    });

const list = (skills: SkillRow[], publicEnabled: boolean) => ({
    ok: true as const,
    data: { skills, limit: 25, used: skills.length, publicEnabled },
});

const hubPage = (skills: SkillRow[], hasMore = false) => ({
    ok: true as const,
    data: { skills, hasMore },
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

const openHub = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(await screen.findByRole("tab", { name: "Genos Hub" }));
};

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.fetchSkills).mockResolvedValue(list([skill()], true));
    vi.mocked(api.fetchSkill).mockResolvedValue({
        ok: true,
        data: { ...skill(), bodyMarkdown: "# Weekly update" },
    });
    vi.mocked(api.fetchSkillVersions).mockResolvedValue({ ok: true, data: [] });
    vi.mocked(api.fetchHub).mockResolvedValue(hubPage([publicSkill()]));
    vi.mocked(api.fetchHubTags).mockResolvedValue({
        ok: true,
        data: [
            { tag: "planning", count: 3 },
            { tag: "reports", count: 1 },
        ],
    });
    vi.mocked(api.setSkillStar).mockResolvedValue({ ok: true, data: null });
});

describe("reading the server's Hub fields", () => {
    it("reads the byline, the counts and the switch, and keeps nothing it can't use", () => {
        const row = parseSkill({
            id: "p1",
            visibility: "public",
            author: { handle: "ana-lopez", displayName: "Ana" },
            starCount: 12,
            runCount30d: 7,
            copyCount: 4,
            isOfficial: true,
            starred: true,
        });
        expect(row?.author).toEqual({ handle: "ana-lopez", displayName: "Ana" });
        expect([row?.starCount, row?.runCount30d, row?.copyCount]).toEqual([12, 7, 4]);
        expect([row?.isOfficial, row?.starred]).toEqual([true, true]);
        const bare = parseSkill({ id: "p2", author: { handle: "" }, starCount: -3 });
        expect(bare?.author).toBeNull();
        expect(bare?.starCount).toBe(0);
        expect(parseSkillList({ skills: [], publicEnabled: true })?.publicEnabled).toBe(true);
        expect(parseSkillList({ skills: [] })?.publicEnabled).toBe(false);
    });

    it("checks a handle as the server does", () => {
        expect(handleProblem("ab")).toBe("short");
        expect(handleProblem("x".repeat(31))).toBe("long");
        expect(handleProblem("Has Space")).toBe("shape");
        expect(handleProblem("a--b")).toBe("shape");
        expect(handleProblem("@ana-lopez")).toBeNull();
    });
});

describe("the Hub tab", () => {
    it("is not there while the server's public switch is off", async () => {
        vi.mocked(api.fetchSkills).mockResolvedValue(list([skill()], false));
        renderPage();
        await screen.findByText("Weekly update");
        expect(screen.queryByRole("tab", { name: "Genos Hub" })).toBeNull();
        expect(api.fetchHub).not.toHaveBeenCalled();
    });

    it("lists the public skills with the author's handle and the numbers", async () => {
        const user = userEvent.setup();
        renderPage();
        await openHub(user);
        const row = (await screen.findByText("Roadmap review")).closest("li") as HTMLElement;
        expect(row).toBeTruthy();
        const text = row.textContent ?? "";
        expect(text).toContain("By @ana-lopez");
        expect(text).toContain("Used by 7 (30 days)");
        expect(text).toContain("Copies: 4");
        expect(text).toContain("Version 3");
        expect(within(row).getByRole("button", { name: "Star Roadmap review" })).toHaveTextContent(
            "12"
        );
        // The directory's first request: the default order, no filter.
        expect(api.fetchHub).toHaveBeenCalledWith("tok", {
            q: "",
            tag: "",
            sort: "stars",
            limit: 24,
        });
    });

    it("searches after the last keystroke, sorts and filters by tag, one request each", async () => {
        const user = userEvent.setup();
        renderPage();
        await openHub(user);
        await screen.findByText("Roadmap review");
        vi.mocked(api.fetchHub).mockClear();

        await user.type(screen.getByRole("searchbox", { name: "Search the Hub" }), "road");
        await waitFor(() =>
            expect(api.fetchHub).toHaveBeenLastCalledWith(
                "tok",
                expect.objectContaining({ q: "road" })
            )
        );
        expect(vi.mocked(api.fetchHub).mock.calls.filter(([, q]) => q.q === "road")).toHaveLength(
            1
        );

        await user.click(screen.getByRole("button", { name: "planning" }));
        await waitFor(() =>
            expect(api.fetchHub).toHaveBeenLastCalledWith(
                "tok",
                expect.objectContaining({ q: "road", tag: "planning" })
            )
        );
        expect(screen.getByRole("button", { name: "planning" })).toHaveAttribute(
            "aria-pressed",
            "true"
        );
        await user.click(screen.getByRole("button", { name: "planning" }));
        await waitFor(() =>
            expect(api.fetchHub).toHaveBeenLastCalledWith(
                "tok",
                expect.objectContaining({ tag: "" })
            )
        );

        await user.click(screen.getByRole("combobox", { name: "Sort by" }));
        await user.click(await screen.findByRole("option", { name: "Most used" }));
        await waitFor(() =>
            expect(api.fetchHub).toHaveBeenLastCalledWith(
                "tok",
                expect.objectContaining({ sort: "uses" })
            )
        );
    });

    it("shows more by asking for the next page and never repeats a row", async () => {
        const user = userEvent.setup();
        vi.mocked(api.fetchHub).mockResolvedValueOnce(hubPage([publicSkill()], true));
        renderPage();
        await openHub(user);
        await screen.findByText("Roadmap review");
        vi.mocked(api.fetchHub).mockResolvedValueOnce(
            hubPage([publicSkill(), publicSkill({ id: "p2", title: "Standup notes" })])
        );
        await user.click(screen.getByRole("button", { name: "Show more" }));
        await screen.findByText("Standup notes");
        expect(api.fetchHub).toHaveBeenLastCalledWith(
            "tok",
            expect.objectContaining({ offset: 1 })
        );
        expect(screen.getAllByText("Roadmap review")).toHaveLength(1);
        expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
    });

    it("says so when nothing matches, and when the directory failed", async () => {
        const user = userEvent.setup();
        vi.mocked(api.fetchHub).mockResolvedValue(hubPage([]));
        renderPage();
        await openHub(user);
        expect(await screen.findByText("No public skills yet")).toBeInTheDocument();
        await user.type(screen.getByRole("searchbox", { name: "Search the Hub" }), "zzz");
        expect(await screen.findByText("No skills match")).toBeInTheDocument();
        vi.mocked(api.fetchHub).mockResolvedValue({ ok: false, reason: "error", message: "" });
        await user.type(screen.getByRole("searchbox", { name: "Search the Hub" }), "z");
        expect(await screen.findByText("Couldn't load the Hub.")).toBeInTheDocument();
    });

    it("stars at once, sends the star, and takes it back when the server refuses", async () => {
        const user = userEvent.setup();
        renderPage();
        await openHub(user);
        await screen.findByText("Roadmap review");
        let resolveStar: (v: { ok: true; data: null }) => void = () => undefined;
        vi.mocked(api.setSkillStar).mockReturnValueOnce(
            new Promise((resolve) => {
                resolveStar = resolve;
            })
        );
        vi.mocked(api.fetchHub).mockResolvedValue(
            hubPage([publicSkill({ starred: true, starCount: 13 })])
        );
        await user.click(screen.getByRole("button", { name: "Star Roadmap review" }));
        expect(
            screen.getByRole("button", { name: "Remove your star from Roadmap review" })
        ).toHaveAttribute("aria-pressed", "true");
        resolveStar({ ok: true, data: null });
        await waitFor(() => expect(api.setSkillStar).toHaveBeenCalledWith("tok", "p1", true));
        await screen.findByRole("button", { name: "Remove your star from Roadmap review" });

        // A refusal (the daily limit, a skill just taken down) puts the star back and says why.
        vi.mocked(api.setSkillStar).mockResolvedValueOnce({
            ok: false,
            reason: "bad_input",
            message: "You can star 100 skills a day. Try again tomorrow.",
        });
        const error = vi.spyOn(toast, "error");
        await user.click(
            screen.getByRole("button", { name: "Remove your star from Roadmap review" })
        );
        await waitFor(() =>
            expect(error).toHaveBeenCalledWith(expect.stringContaining("100 skills"))
        );
        expect(
            await screen.findByRole("button", { name: "Remove your star from Roadmap review" })
        ).toBeInTheDocument();
    });

    it("copies a public skill into the member's team and goes to My skills", async () => {
        const user = userEvent.setup();
        vi.mocked(api.copySkill).mockResolvedValue({ ok: true, data: skill({ id: "c1" }) });
        renderPage();
        await openHub(user);
        await screen.findByText("Roadmap review");
        await user.click(screen.getByRole("button", { name: "Actions for Roadmap review" }));
        await user.click(await screen.findByRole("menuitem", { name: "Copy to my skills" }));
        await waitFor(() => expect(api.copySkill).toHaveBeenCalledWith("tok", "p1", "team-1"));
        expect(await screen.findByRole("tab", { name: "My skills", selected: true })).toBeTruthy();
    });

    it("reports a skill from its row", async () => {
        const user = userEvent.setup();
        vi.mocked(api.reportSkill).mockResolvedValue({ ok: true, data: { created: true } });
        renderPage();
        await openHub(user);
        await screen.findByText("Roadmap review");
        await user.click(screen.getByRole("button", { name: "Actions for Roadmap review" }));
        await user.click(await screen.findByRole("menuitem", { name: "Report" }));
        await user.click(await screen.findByRole("radio", { name: /spam/i }));
        await user.click(screen.getByRole("button", { name: "Send report" }));
        await waitFor(() => expect(api.reportSkill).toHaveBeenCalledWith("tok", "p1", "spam", ""));
    });
});

describe("the page of a public skill", () => {
    const openPublicPage = async () => {
        const user = userEvent.setup();
        vi.mocked(api.fetchSkill).mockResolvedValue({
            ok: true,
            data: { ...publicSkill(), bodyMarkdown: "# Roadmap\n\n1. Read it." },
        });
        renderPage();
        await openHub(user);
        await user.click(await screen.findByRole("button", { name: "Roadmap review" }));
        return user;
    };

    it("shows the author, the version, the numbers and the read-only text", async () => {
        await openPublicPage();
        const strip = (await screen.findByText(/By @ana-lopez · Ana/)).textContent ?? "";
        expect(strip).toContain("Version 3");
        expect(strip).toContain("Used by 7 (30 days)");
        expect(screen.getByText(/Read it\./)).toBeInTheDocument();
        expect(screen.queryByTestId("body-editor")).toBeNull();
        expect(screen.getByRole("button", { name: "Copy to my skills" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Report" })).toBeInTheDocument();
    });

    it("stars from the page and reads the total back", async () => {
        const user = await openPublicPage();
        const star = await screen.findByRole("button", { name: "Star Roadmap review" });
        vi.mocked(api.fetchSkill).mockResolvedValue({
            ok: true,
            data: { ...publicSkill({ starred: true, starCount: 13 }), bodyMarkdown: "x" },
        });
        await user.click(star);
        await waitFor(() => expect(api.setSkillStar).toHaveBeenCalledWith("tok", "p1", true));
        expect(
            await screen.findByRole("button", { name: "Remove your star from Roadmap review" })
        ).toHaveTextContent("13");
    });

    it("names the author of an original by the public handle on a copy", async () => {
        const user = userEvent.setup();
        vi.mocked(api.fetchSkill).mockResolvedValue({
            ok: true,
            data: {
                ...skill({
                    forkedFrom: {
                        available: true,
                        id: "p1",
                        title: "Roadmap review",
                        ownerName: "",
                        author: { handle: "ana-lopez", displayName: "" },
                        versionNo: 3,
                    },
                }),
                bodyMarkdown: "# x",
            },
        });
        renderPage();
        await user.click(await screen.findByRole("button", { name: "Weekly update" }));
        expect(
            await screen.findByText("Copied from “Roadmap review” by @ana-lopez (version 3).")
        ).toBeInTheDocument();
    });
});

describe("publishing to the Hub", () => {
    const check = (over: Partial<{ handle: string | null; ok: boolean }> = {}) => ({
        ok: true as const,
        data: {
            ready: over.ok ?? true,
            checks: [
                { key: "plan", ok: true, text: "Core plan or above" },
                { key: "email", ok: over.ok ?? true, text: "Email verified" },
                {
                    key: "handle",
                    ok: over.handle !== null && over.handle !== undefined,
                    text: "Choose a public handle",
                },
                { key: "details", ok: true, text: "Title, description and a tag" },
            ],
            profile: {
                handle: over.handle === undefined ? null : over.handle,
                displayName: "",
                publicSkills: 0,
                limits: { publishesPerDay: 5, publicSkillsMax: 50, starsPerDay: 100 },
            },
        },
    });

    const openDialog = async () => {
        const user = userEvent.setup();
        renderPage();
        await user.click(await screen.findByRole("button", { name: "Weekly update" }));
        await user.click(await screen.findByRole("button", { name: "Publish to the Hub…" }));
        return user;
    };

    it("offers nothing public while the server's switch is off", async () => {
        const user = userEvent.setup();
        vi.mocked(api.fetchSkills).mockResolvedValue(list([skill()], false));
        renderPage();
        await user.click(await screen.findByRole("button", { name: "Weekly update" }));
        await screen.findByTestId("body-editor");
        expect(screen.queryByRole("button", { name: "Publish to the Hub…" })).toBeNull();
    });

    it("makes nothing public until the handle is chosen and the terms are confirmed", async () => {
        vi.mocked(api.fetchPublishCheck).mockResolvedValue(check());
        vi.mocked(api.publishToHub).mockResolvedValue({
            ok: true,
            data: skill({ visibility: "public", publishedVersionNo: 1 }),
        });
        const user = await openDialog();
        const dialog = await screen.findByRole("dialog");
        const publish = await within(dialog).findByRole("button", { name: "Publish" });
        expect(publish).toBeDisabled();
        expect(within(dialog).getByText("Core plan or above")).toBeInTheDocument();

        await user.type(within(dialog).getByLabelText("Your public handle"), "Ana Lopez");
        expect(
            within(dialog).getByText("Use lower-case letters, digits and single hyphens.")
        ).toBeInTheDocument();
        expect(publish).toBeDisabled();
        await user.clear(within(dialog).getByLabelText("Your public handle"));
        await user.type(within(dialog).getByLabelText("Your public handle"), "ana-lopez");
        expect(publish).toBeDisabled(); // the terms are not confirmed yet
        await user.click(within(dialog).getByRole("checkbox"));
        expect(publish).toBeEnabled();
        expect(api.publishToHub).not.toHaveBeenCalled();

        await user.click(publish);
        await waitFor(() =>
            expect(api.publishToHub).toHaveBeenCalledWith("tok", "s1", {
                acceptTerms: true,
                handle: "ana-lopez",
            })
        );
        expect(await screen.findByText("Public")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Stop sharing publicly" })).toBeInTheDocument();
    });

    it("does not ask for a handle again once there is one", async () => {
        vi.mocked(api.fetchPublishCheck).mockResolvedValue(check({ handle: "ana-lopez" }));
        const user = await openDialog();
        const dialog = await screen.findByRole("dialog");
        await within(dialog).findByText("Core plan or above");
        expect(within(dialog).queryByLabelText("Your public handle")).toBeNull();
        await user.click(within(dialog).getByRole("checkbox"));
        expect(within(dialog).getByRole("button", { name: "Publish" })).toBeEnabled();
    });

    it("cannot be confirmed while the account fails a check, and says which", async () => {
        vi.mocked(api.fetchPublishCheck).mockResolvedValue(
            check({ handle: "ana-lopez", ok: false })
        );
        const user = await openDialog();
        const dialog = await screen.findByRole("dialog");
        await user.click(await within(dialog).findByRole("checkbox"));
        expect(within(dialog).getByText("Email verified")).toBeInTheDocument();
        expect(within(dialog).getByRole("button", { name: "Publish" })).toBeDisabled();
        expect(within(dialog).getAllByRole("img", { name: "Not yet" }).length).toBeGreaterThan(0);
    });

    it("lists every problem the server refused with", async () => {
        vi.mocked(api.fetchPublishCheck).mockResolvedValue(check({ handle: "ana-lopez" }));
        vi.mocked(api.publishToHub).mockResolvedValue({
            ok: false,
            reason: "bad_input",
            message: "This skill cannot be public yet.",
            problems: ["The text contains an email address.", "Add a tag."],
        });
        const user = await openDialog();
        const dialog = await screen.findByRole("dialog");
        await user.click(await within(dialog).findByRole("checkbox"));
        await user.click(within(dialog).getByRole("button", { name: "Publish" }));
        expect(
            await within(dialog).findByText("The text contains an email address.")
        ).toBeInTheDocument();
        expect(within(dialog).getByText("Add a tag.")).toBeInTheDocument();
        expect(screen.queryByText("Public")).toBeNull();
    });

    it("takes a public skill back to private after a confirmation", async () => {
        const user = userEvent.setup();
        vi.mocked(api.fetchSkill).mockResolvedValue({
            ok: true,
            data: {
                ...skill({
                    visibility: "public",
                    publishedVersionNo: 2,
                    author: { handle: "ana-lopez", displayName: "" },
                }),
                bodyMarkdown: "# x",
            },
        });
        vi.mocked(api.updateSkill).mockResolvedValue({
            ok: true,
            data: skill({ visibility: "private", publishedVersionNo: 2 }),
        });
        renderPage();
        await user.click(await screen.findByRole("button", { name: "Weekly update" }));
        await user.click(await screen.findByRole("button", { name: "Stop sharing publicly" }));
        expect(api.updateSkill).not.toHaveBeenCalled();
        await user.click(await screen.findByRole("button", { name: "Make private" }));
        await waitFor(() =>
            expect(api.updateSkill).toHaveBeenCalledWith("tok", "s1", { visibility: "private" })
        );
        expect(
            await screen.findByRole("button", { name: "Publish to the Hub…" })
        ).toBeInTheDocument();
    });
});
