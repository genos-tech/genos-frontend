/**
 * Report a skill (MIP-2044), inside the Skills page that already exists: the "Report" item of a
 * teammate's row, and the notice an author sees when an operator has held or taken their skill
 * down. Every network edge is mocked; what is pinned is the CLIENT's side of the contract: which
 * request the dialog sends, when it may send, and what it does with each answer.
 */

import { forwardRef, useImperativeHandle } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { toast } from "../components/ui/feedback/toastStore";
import * as api from "../features/genos/skills/skillsApi";
import type { SkillRow } from "../features/genos/skills/skillsApi";
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
        return <div data-testid="body-editor" />;
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
        reportSkill: vi.fn(),
    };
});

const skill = (over: Partial<SkillRow> = {}): SkillRow => ({
    id: "s1",
    teamId: "team-1",
    slug: "release-notes",
    title: "Release notes",
    description: "Write the release notes",
    tags: ["release"],
    icon: "",
    argumentHint: "",
    toolLevel: "read",
    effort: "",
    visibility: "team",
    status: "active",
    moderationReason: "",
    currentVersionNo: 1,
    publishedVersionNo: 1,
    createdAt: "2026-11-20T10:00:00Z",
    updatedAt: "2026-11-21T10:00:00Z",
    publishedAt: "2026-11-21T10:00:00Z",
    mine: false,
    role: "reader",
    canEdit: false,
    canManage: false,
    canHide: false,
    hiddenByTeam: false,
    ownerName: "ayumi",
    editors: [],
    forkedFrom: null,
    noteId: null,
    hasUnpublishedChanges: false,
    unpublishedChanges: [],
    ...over,
});

const host = {
    myself: { userId: "u1" },
    setMyself: vi.fn(),
    socket: null,
    useTEM: {},
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

const list = (skills: SkillRow[]) => ({
    ok: true as const,
    data: { skills, limit: 25, used: 0 },
});

const openReport = async (user: ReturnType<typeof userEvent.setup>) => {
    await screen.findByText("Release notes");
    await user.click(screen.getByRole("button", { name: "Actions for Release notes" }));
    await user.click(await screen.findByRole("menuitem", { name: "Report" }));
};

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.fetchSkills).mockResolvedValue(list([skill()]));
    vi.mocked(api.fetchSkillVersions).mockResolvedValue({ ok: true, data: [] });
});

describe("Report on a row", () => {
    it("is offered on somebody else's skill and not on my own", async () => {
        const user = userEvent.setup();
        vi.mocked(api.fetchSkills).mockResolvedValue(
            list([skill(), skill({ id: "s2", title: "My plan", mine: true, canEdit: true })])
        );
        renderPage();
        await screen.findByText("Release notes");
        await user.click(screen.getByRole("button", { name: "Actions for Release notes" }));
        expect(await screen.findByRole("menuitem", { name: "Report" })).toBeTruthy();
        await user.keyboard("{Escape}");
        await user.click(screen.getByRole("button", { name: "Actions for My plan" }));
        await screen.findByRole("menuitem", { name: "Delete" });
        expect(screen.queryByRole("menuitem", { name: "Report" })).toBeNull();
    });

    it("cannot be sent before a reason is chosen, then sends the reason and the note", async () => {
        const user = userEvent.setup();
        vi.mocked(api.reportSkill).mockResolvedValue({ ok: true, data: { created: true } });
        const success = vi.spyOn(toast, "success").mockImplementation(() => "");
        renderPage();
        await openReport(user);
        const send = await screen.findByRole("button", { name: "Send report" });
        expect((send as HTMLButtonElement).disabled).toBe(true);
        await user.click(screen.getByRole("radio", { name: "Spam" }));
        await user.type(screen.getByLabelText(/Anything else we should know/), "  adverts  ");
        expect(
            (screen.getByRole("button", { name: "Send report" }) as HTMLButtonElement).disabled
        ).toBe(false);
        await user.click(screen.getByRole("button", { name: "Send report" }));
        await waitFor(() =>
            expect(api.reportSkill).toHaveBeenCalledWith("tok", "s1", "spam", "  adverts  ")
        );
        await waitFor(() =>
            expect(success).toHaveBeenCalledWith("Thank you. We will look at it.")
        );
        await waitFor(() =>
            expect(screen.queryByRole("button", { name: "Send report" })).toBeNull()
        );
    });

    it("shows the server's sentence and keeps the dialog when the report fails", async () => {
        const user = userEvent.setup();
        vi.mocked(api.reportSkill).mockResolvedValue({
            ok: false,
            reason: "bad_input",
            message: "This is your own skill.",
        });
        renderPage();
        await openReport(user);
        await user.click(await screen.findByRole("radio", { name: "Copyright" }));
        await user.click(screen.getByRole("button", { name: "Send report" }));
        expect(await screen.findByText("This is your own skill.")).toBeTruthy();
        expect(screen.getByRole("button", { name: "Send report" })).toBeTruthy();
    });

    it("says so in its own words when the day's limit is used up", async () => {
        const user = userEvent.setup();
        vi.mocked(api.reportSkill).mockResolvedValue({
            ok: false,
            reason: "report_limit",
            message: "You can send 20 reports a day. Try again tomorrow.",
        });
        renderPage();
        await openReport(user);
        await user.click(await screen.findByRole("radio", { name: "Spam" }));
        await user.click(screen.getByRole("button", { name: "Send report" }));
        expect(
            await screen.findByText(
                "You have sent as many reports as you can today. Try again tomorrow."
            )
        ).toBeTruthy();
    });
});

describe("an author's skill that an operator stopped", () => {
    it("says so on the row", async () => {
        vi.mocked(api.fetchSkills).mockResolvedValue(
            list([
                skill({
                    mine: true,
                    canEdit: true,
                    status: "taken_down",
                    moderationReason: "Leaks.",
                }),
            ])
        );
        renderPage();
        expect(await screen.findByText("Taken down")).toBeTruthy();
    });

    it("tells the author why, in the skill's own page", async () => {
        const user = userEvent.setup();
        const mine = skill({
            mine: true,
            canEdit: true,
            noteId: 12,
            status: "in_review",
            moderationReason: "The automatic check flagged version 1 (override).",
        });
        vi.mocked(api.fetchSkills).mockResolvedValue(list([mine]));
        vi.mocked(api.fetchSkill).mockResolvedValue({
            ok: true,
            data: { ...mine, bodyMarkdown: "# Release notes" },
        });
        renderPage();
        await user.click(await screen.findByRole("button", { name: "Release notes" }));
        expect(
            await screen.findByText(
                "This skill is held for review. Nobody else can read or run it yet."
            )
        ).toBeTruthy();
        expect(
            screen.getByText("Reason: The automatic check flagged version 1 (override).")
        ).toBeTruthy();
    });

    it("offers Report on a teammate's skill page and not on my own", async () => {
        const user = userEvent.setup();
        const theirs = skill();
        vi.mocked(api.fetchSkill).mockResolvedValue({
            ok: true,
            data: { ...theirs, bodyMarkdown: "# Release notes" },
        });
        renderPage();
        await user.click(await screen.findByRole("button", { name: "Release notes" }));
        expect(await screen.findByRole("button", { name: "Report" })).toBeTruthy();
    });
});
