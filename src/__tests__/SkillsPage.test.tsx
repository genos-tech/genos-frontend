/**
 * The Skills page in Settings > Genos (MIP-2041): the list, creating a skill, and the editor.
 *
 * Every network edge is mocked, and so is the note editor (BlockNote needs a real browser: the
 * layout and the editor are checked in screenshots, see the PR). What is pinned here is the
 * CLIENT's side of the API contract: which request each action sends, what the page does with
 * each answer the server can give, and that a team skill's text is saved before it is published.
 */

import { forwardRef, useImperativeHandle } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { toast } from "../components/ui/feedback/toastStore";
import * as api from "../features/genos/skills/skillsApi";
import type { SkillRow } from "../features/genos/skills/skillsApi";
import { SkillsEntryCard } from "../features/genos/skills/SkillsEntryCard";
import type { SkillsHost } from "../features/genos/skills/skillsHost";
import { SkillsPage } from "../features/genos/skills/SkillsPage";
import { I18nProvider } from "../i18n";

vi.mock("../context/authState", () => ({
    useAuth: () => ({ accessToken: "tok" }),
}));

const flush = vi.fn(async () => undefined);
const callOrder: string[] = [];
vi.mock("../features/genos/skills/SkillBodyEditor", () => ({
    SkillBodyEditor: forwardRef(function Stub(
        props: { handleRef?: React.Ref<{ flush: () => Promise<void> }>; noteId: number },
        _ref
    ) {
        useImperativeHandle(props.handleRef, () => ({
            flush: async () => {
                callOrder.push("flush");
                await flush();
            },
        }));
        return <div data-testid="body-editor">editor for note {props.noteId}</div>;
    }),
}));
vi.mock("../features/genos/skills/skillNoteTitle", () => ({ syncSkillNoteTitle: vi.fn() }));

vi.mock("../features/genos/skills/skillsApi", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../features/genos/skills/skillsApi")>();
    return {
        ...actual,
        fetchSkills: vi.fn(),
        fetchSkill: vi.fn(),
        createSkill: vi.fn(),
        updateSkill: vi.fn(),
        deleteSkill: vi.fn(),
        publishSkill: vi.fn(),
        copySkill: vi.fn(),
        fetchSkillVersions: vi.fn(),
    };
});

const skill = (over: Partial<SkillRow> = {}): SkillRow => ({
    id: "s1",
    teamId: "team-1",
    slug: "weekly-update",
    title: "Weekly update",
    description: "Summarise the week",
    tags: ["weekly"],
    icon: "⚡",
    argumentHint: "",
    toolLevel: "read",
    effort: "",
    visibility: "private",
    status: "active",
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
    editors: [],
    forkedFrom: null,
    noteId: 12,
    hasUnpublishedChanges: false,
    unpublishedChanges: [],
    ...over,
});

const list = (skills: SkillRow[], over: Partial<api.SkillList> = {}) => ({
    ok: true as const,
    data: { skills, limit: 25, used: skills.length, ...over },
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

beforeEach(() => {
    vi.clearAllMocks();
    callOrder.length = 0;
    vi.mocked(api.fetchSkills).mockResolvedValue(list([skill()]));
    vi.mocked(api.fetchSkill).mockResolvedValue({
        ok: true,
        data: { ...skill(), bodyMarkdown: "# Weekly update" },
    });
    vi.mocked(api.fetchSkillVersions).mockResolvedValue({ ok: true, data: [] });
});

describe("the entry card", () => {
    it("draws nothing while the skills API is off (404) or failing", async () => {
        vi.mocked(api.fetchSkills).mockResolvedValue({
            ok: false,
            reason: "off",
            message: "",
        });
        const { container } = render(
            <CssVarsProvider>
                <I18nProvider>
                    <SkillsEntryCard teamId="team-1" onOpen={vi.fn()} />
                </I18nProvider>
            </CssVarsProvider>
        );
        await waitFor(() => expect(api.fetchSkills).toHaveBeenCalledWith("tok", "team-1", "mine"));
        expect(container.textContent).toBe("");
    });

    it("shows how many of the plan's skills are used, and opens the page", async () => {
        vi.mocked(api.fetchSkills).mockResolvedValue(list([skill()], { limit: 3, used: 1 }));
        const onOpen = vi.fn();
        render(
            <CssVarsProvider>
                <I18nProvider>
                    <SkillsEntryCard teamId="team-1" onOpen={onOpen} />
                </I18nProvider>
            </CssVarsProvider>
        );
        expect(await screen.findByText("1 of 3 skills used")).toBeTruthy();
        await userEvent.setup().click(screen.getByRole("button", { name: "Open" }));
        expect(onOpen).toHaveBeenCalled();
    });
});

describe("the list", () => {
    it("shows each skill with its name to type, visibility and tags", async () => {
        vi.mocked(api.fetchSkills).mockResolvedValue(
            list([
                skill({ visibility: "team", publishedVersionNo: 2 }),
                skill({ id: "s2", slug: "plan", title: "Plan", tags: [], description: "" }),
            ])
        );
        renderPage();
        expect(await screen.findByText("Weekly update")).toBeTruthy();
        expect(screen.getByText("/weekly-update")).toBeTruthy();
        expect(screen.getAllByText("Team").length).toBeGreaterThan(1);
        expect(screen.getByText("Version 2")).toBeTruthy();
        expect(screen.getByText("weekly")).toBeTruthy();
        expect(screen.getByText("/plan")).toBeTruthy();
    });

    it("reads the team tab from the server", async () => {
        const user = userEvent.setup();
        renderPage();
        await screen.findByText("Weekly update");
        vi.mocked(api.fetchSkills).mockResolvedValue(
            list([skill({ id: "s9", title: "Release notes", mine: false, ownerName: "ayumi" })])
        );
        await user.click(screen.getByRole("tab", { name: "Team" }));
        expect(await screen.findByText("Release notes")).toBeTruthy();
        expect(api.fetchSkills).toHaveBeenLastCalledWith("tok", "team-1", "team");
        expect(screen.getByText(/By ayumi/)).toBeTruthy();
    });

    it("says there are none, with the way to start", async () => {
        vi.mocked(api.fetchSkills).mockResolvedValue(list([]));
        renderPage();
        expect(await screen.findByText("No skills yet")).toBeTruthy();
        expect(screen.getByRole("button", { name: "From template" })).toBeTruthy();
    });

    it("does not call a failed load an empty list, and retries", async () => {
        vi.mocked(api.fetchSkills).mockResolvedValueOnce({
            ok: false,
            reason: "error",
            message: "",
        });
        const user = userEvent.setup();
        renderPage();
        expect(await screen.findByText("Couldn't load your skills.")).toBeTruthy();
        expect(screen.queryByText("No skills yet")).toBeNull();
        await user.click(screen.getByRole("button", { name: "Retry" }));
        expect(await screen.findByText("Weekly update")).toBeTruthy();
    });

    it("explains a full plan and stops offering New", async () => {
        vi.mocked(api.fetchSkills).mockResolvedValue(list([skill()], { limit: 1, used: 1 }));
        renderPage();
        expect(await screen.findByText(/keeps up to 1 skills and you have 1/)).toBeTruthy();
        expect(
            (screen.getByRole("button", { name: "New skill" }) as HTMLButtonElement).disabled
        ).toBe(true);
    });
});

describe("creating", () => {
    it("makes the skill from the template at once and opens it in the editor", async () => {
        vi.mocked(api.createSkill).mockResolvedValue({ ok: true, data: skill({ id: "new1" }) });
        const user = userEvent.setup();
        renderPage();
        await screen.findByText("Weekly update");
        await user.click(screen.getByRole("button", { name: "New skill" }));
        await user.click(await screen.findByRole("menuitem", { name: "From template" }));
        await waitFor(() => expect(api.createSkill).toHaveBeenCalled());
        const [token, team, input] = vi.mocked(api.createSkill).mock.calls[0];
        expect([token, team]).toEqual(["tok", "team-1"]);
        expect(input).toMatchObject({ title: "New skill", visibility: "private" });
        expect(input.bodyMarkdown).toContain("## Steps");
        expect(await screen.findByTestId("body-editor")).toBeTruthy();
        expect(api.fetchSkill).toHaveBeenCalledWith("tok", "new1");
    });

    it("makes a blank skill with no text", async () => {
        vi.mocked(api.createSkill).mockResolvedValue({ ok: true, data: skill({ id: "new2" }) });
        const user = userEvent.setup();
        renderPage();
        await screen.findByText("Weekly update");
        await user.click(screen.getByRole("button", { name: "New skill" }));
        await user.click(await screen.findByRole("menuitem", { name: "Blank skill" }));
        await waitFor(() => expect(api.createSkill).toHaveBeenCalled());
        expect(vi.mocked(api.createSkill).mock.calls[0][2].bodyMarkdown).toBe("");
    });

    it("shows the plan limit the server answers with instead of opening an editor", async () => {
        vi.mocked(api.createSkill).mockResolvedValue({
            ok: false,
            reason: "limit",
            message: "x",
            limit: 3,
            used: 3,
        });
        const user = userEvent.setup();
        renderPage();
        await screen.findByText("Weekly update");
        await user.click(screen.getByRole("button", { name: "New skill" }));
        await user.click(await screen.findByRole("menuitem", { name: "Blank skill" }));
        expect(await screen.findByText(/keeps up to 3 skills and you have 3/)).toBeTruthy();
        expect(screen.queryByTestId("body-editor")).toBeNull();
    });
});

describe("deleting from the list", () => {
    it("asks first, then deletes and reads the list again", async () => {
        vi.mocked(api.deleteSkill).mockResolvedValue({ ok: true, data: null });
        const user = userEvent.setup();
        renderPage();
        await screen.findByText("Weekly update");
        await user.click(screen.getByRole("button", { name: "Actions for Weekly update" }));
        await user.click(await screen.findByRole("menuitem", { name: "Delete" }));
        const dialog = await screen.findByRole("alertdialog");
        expect(within(dialog).getByText("Delete this skill?")).toBeTruthy();
        expect(api.deleteSkill).not.toHaveBeenCalled();
        vi.mocked(api.fetchSkills).mockResolvedValue(list([]));
        await user.click(within(dialog).getByRole("button", { name: "Delete skill" }));
        await waitFor(() => expect(api.deleteSkill).toHaveBeenCalledWith("tok", "s1"));
        expect(await screen.findByText("No skills yet")).toBeTruthy();
    });

    it("copies a teammate's skill into the member's own", async () => {
        vi.mocked(api.fetchSkills).mockResolvedValue(
            list([
                skill({
                    id: "s9",
                    title: "Release notes",
                    mine: false,
                    role: "reader",
                    canEdit: false,
                    canManage: false,
                    visibility: "team",
                    publishedVersionNo: 1,
                }),
            ])
        );
        vi.mocked(api.copySkill).mockResolvedValue({ ok: true, data: skill({ id: "c1" }) });
        const success = vi.spyOn(toast, "success");
        const user = userEvent.setup();
        renderPage();
        await user.click(await screen.findByRole("button", { name: "Actions for Release notes" }));
        await user.click(await screen.findByRole("menuitem", { name: "Copy to my skills" }));
        await waitFor(() => expect(api.copySkill).toHaveBeenCalledWith("tok", "s9", "team-1"));
        expect(success).toHaveBeenCalledWith("Copied to your skills.");
    });
});

const openEditor = async (user: ReturnType<typeof userEvent.setup>, name = "Weekly update") => {
    await user.click(await screen.findByRole("button", { name }));
    return screen.findByLabelText(/^Title/);
};

describe("the editor", () => {
    it("shows the name to type as a preview and the owner and dates", async () => {
        const user = userEvent.setup();
        renderPage();
        await openEditor(user);
        expect(screen.getByText("Runs as /weekly-update")).toBeTruthy();
        expect(screen.getByTestId("body-editor").textContent).toContain("note 12");
        expect(screen.getByText("Owner")).toBeTruthy();
        expect(screen.getByText("You")).toBeTruthy();
        expect(screen.getByText("Created")).toBeTruthy();
    });

    it("saves only what changed, and only after the person asks", async () => {
        vi.mocked(api.updateSkill).mockResolvedValue({
            ok: true,
            data: { ...skill({ description: "Short" }), bodyMarkdown: "" },
        });
        const user = userEvent.setup();
        renderPage();
        await openEditor(user);
        const save = screen.getByRole("button", { name: "Save details" }) as HTMLButtonElement;
        expect(save.disabled).toBe(true);
        const description = screen.getByLabelText(/^Description/);
        await user.clear(description);
        await user.type(description, "Short");
        expect(screen.getByText("5/280")).toBeTruthy();
        expect(api.updateSkill).not.toHaveBeenCalled();
        await user.click(save);
        await waitFor(() =>
            expect(api.updateSkill).toHaveBeenCalledWith("tok", "s1", { description: "Short" })
        );
        await waitFor(() => expect(save.disabled).toBe(true));
    });

    it("never rewrites the name of a skill that already has a title", async () => {
        const user = userEvent.setup();
        renderPage();
        const title = await openEditor(user);
        await user.clear(title);
        await user.type(title, "Plan my week");
        expect((screen.getByLabelText(/^Name to type/) as HTMLInputElement).value).toBe(
            "weekly-update"
        );
    });

    it("follows the title with the name on a new skill, until the name is written by hand", async () => {
        const user = userEvent.setup();
        vi.mocked(api.fetchSkill).mockResolvedValue({
            ok: true,
            data: {
                ...skill({
                    title: "New skill",
                    slug: "new-skill",
                    visibility: "private",
                    publishedVersionNo: 0,
                }),
                bodyMarkdown: "",
            },
        });
        renderPage();
        const title = await openEditor(user);
        await user.clear(title);
        await user.type(title, "Plan my week");
        expect((screen.getByLabelText(/^Name to type/) as HTMLInputElement).value).toBe(
            "plan-my-week"
        );
        const slug = screen.getByLabelText(/^Name to type/);
        await user.clear(slug);
        await user.type(slug, "mine");
        await user.clear(title);
        await user.type(title, "Other");
        expect((slug as HTMLInputElement).value).toBe("mine");
    });

    it("refuses a reserved name before asking the server", async () => {
        const user = userEvent.setup();
        renderPage();
        await openEditor(user);
        const slug = screen.getByLabelText(/^Name to type/);
        await user.clear(slug);
        await user.type(slug, "help");
        await user.click(screen.getByRole("button", { name: "Save details" }));
        expect(await screen.findByText("“help” is reserved. Choose another name.")).toBeTruthy();
        expect(api.updateSkill).not.toHaveBeenCalled();
    });

    it("puts a taken name on the name field", async () => {
        vi.mocked(api.updateSkill).mockResolvedValue({
            ok: false,
            reason: "conflict",
            message: "You already have a skill named `plan`.",
        });
        const user = userEvent.setup();
        renderPage();
        await openEditor(user);
        const slug = screen.getByLabelText(/^Name to type/);
        await user.clear(slug);
        await user.type(slug, "plan");
        await user.click(screen.getByRole("button", { name: "Save details" }));
        expect(await screen.findByText("You already have a skill with this name.")).toBeTruthy();
    });

    it("limits tags to five lower-case words", async () => {
        const user = userEvent.setup();
        renderPage();
        await openEditor(user);
        const input = screen.getByPlaceholderText("Add a tag");
        for (const tag of ["a1", "b2", "c3", "d4"]) await user.type(input, `${tag}{Enter}`);
        await user.type(input, "Two Words{Enter}");
        expect(await screen.findByText(/lower-case letters, digits and hyphens/)).toBeTruthy();
        await user.clear(input);
        await user.type(input, "e5{Enter}");
        await user.type(input, "f6{Enter}");
        expect(await screen.findByText("At most 5 tags.")).toBeTruthy();
    });

    it("asks before dropping unsaved details", async () => {
        const user = userEvent.setup();
        renderPage();
        const title = await openEditor(user);
        await user.type(title, "!");
        await user.click(screen.getByRole("button", { name: "Skills" }));
        const dialog = await screen.findByRole("alertdialog");
        expect(within(dialog).getByText("Discard unsaved changes?")).toBeTruthy();
        await user.click(within(dialog).getByRole("button", { name: "Discard" }));
        expect(await screen.findByRole("tab", { name: "My skills" })).toBeTruthy();
    });

    it("deletes after a confirmation and goes back to the list", async () => {
        vi.mocked(api.deleteSkill).mockResolvedValue({ ok: true, data: null });
        const user = userEvent.setup();
        renderPage();
        await openEditor(user);
        await user.click(screen.getByRole("button", { name: "Delete skill" }));
        const dialog = await screen.findByRole("alertdialog");
        await user.click(within(dialog).getByRole("button", { name: "Delete skill" }));
        await waitFor(() => expect(api.deleteSkill).toHaveBeenCalledWith("tok", "s1"));
        expect(await screen.findByRole("tab", { name: "My skills" })).toBeTruthy();
    });

    it("reads a teammate's skill without an editor, and offers a copy", async () => {
        vi.mocked(api.fetchSkills).mockResolvedValue(
            list([skill({ id: "s9", title: "Release notes", mine: false, canEdit: false })])
        );
        vi.mocked(api.fetchSkill).mockResolvedValue({
            ok: true,
            data: {
                ...skill({
                    id: "s9",
                    title: "Release notes",
                    mine: false,
                    role: "reader",
                    canEdit: false,
                    canManage: false,
                    noteId: null,
                    visibility: "team",
                    publishedVersionNo: 1,
                    ownerName: "ayumi",
                }),
                bodyMarkdown: "## Steps\n1. Read the merged PRs",
            },
        });
        const user = userEvent.setup();
        renderPage();
        await openEditor(user, "Release notes");
        expect(screen.queryByTestId("body-editor")).toBeNull();
        expect(screen.getByText(/Read the merged PRs/)).toBeTruthy();
        expect((screen.getByLabelText(/^Title/) as HTMLInputElement).disabled).toBe(true);
        expect(screen.queryByRole("button", { name: "Save details" })).toBeNull();
        expect(screen.getByRole("button", { name: "Copy to my skills" })).toBeTruthy();
        expect(screen.getByText("ayumi")).toBeTruthy();
    });
});

describe("a team skill", () => {
    const teamSkill = skill({ visibility: "team", publishedVersionNo: 1 });
    const withUnpublished = (over: Partial<SkillRow> = {}): SkillRow => ({
        ...teamSkill,
        hasUnpublishedChanges: true,
        unpublishedChanges: ["title"],
        ...over,
    });
    const serve = (row: SkillRow) => {
        vi.mocked(api.fetchSkills).mockResolvedValue(list([row]));
        vi.mocked(api.fetchSkill).mockResolvedValue({
            ok: true,
            data: { ...row, bodyMarkdown: "x" },
        });
    };
    beforeEach(() => {
        serve(teamSkill);
        vi.mocked(api.fetchSkillVersions).mockResolvedValue({
            ok: true,
            data: [{ versionNo: 1, title: "Weekly update", changelog: "First", createdAt: null }],
        });
    });

    it("lists its versions", async () => {
        const user = userEvent.setup();
        renderPage();
        await openEditor(user);
        expect(await screen.findByText("Version 1")).toBeTruthy();
        expect(screen.getByText("First")).toBeTruthy();
    });

    it("says Save is private, and offers no publishing while nothing differs", async () => {
        const user = userEvent.setup();
        renderPage();
        await openEditor(user);
        expect(
            screen.getByText(
                "Saving keeps your changes private. Teammates use version 1 until you publish."
            )
        ).toBeTruthy();
        expect(screen.getByRole("button", { name: "Save draft" })).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Save details" })).toBeNull();
        expect(screen.queryByText("Unpublished changes")).toBeNull();
        const publish = screen.getByRole("button", {
            name: "Publish changes",
        }) as HTMLButtonElement;
        expect(publish.disabled).toBe(true);
    });

    it("shows Unpublished changes and enables Publish when the draft differs", async () => {
        serve(withUnpublished());
        const user = userEvent.setup();
        renderPage();
        await openEditor(user);
        expect(await screen.findByText("Unpublished changes")).toBeTruthy();
        const publish = screen.getByRole("button", {
            name: "Publish changes",
        }) as HTMLButtonElement;
        expect(publish.disabled).toBe(false);
    });

    it("saving the details makes no version: it keeps a draft and then offers Publish", async () => {
        vi.mocked(api.updateSkill).mockResolvedValue({
            ok: true,
            data: withUnpublished({ title: "Weekly!" }),
        });
        const success = vi.spyOn(toast, "success");
        const user = userEvent.setup();
        renderPage();
        const title = await openEditor(user);
        await user.type(title, "!");
        // Typing is itself an unpublished change, before and after the save.
        expect(screen.getByText("Unpublished changes")).toBeTruthy();
        await user.click(screen.getByRole("button", { name: "Save draft" }));
        await waitFor(() =>
            expect(api.updateSkill).toHaveBeenCalledWith("tok", "s1", { title: "Weekly update!" })
        );
        await waitFor(() =>
            expect(success).toHaveBeenCalledWith(
                "Draft saved. Only you can see it until you publish."
            )
        );
        expect(api.publishSkill).not.toHaveBeenCalled();
        // Readers have no new version to read again.
        expect(api.fetchSkillVersions).toHaveBeenCalledTimes(1);
        expect(screen.getByText("Unpublished changes")).toBeTruthy();
        expect(
            (screen.getByRole("button", { name: "Publish changes" }) as HTMLButtonElement).disabled
        ).toBe(false);
    });

    it("publishes the saved draft, and says so when nothing is new", async () => {
        serve(withUnpublished());
        vi.mocked(api.publishSkill).mockResolvedValueOnce({
            ok: false,
            reason: "conflict",
            message: "Nothing changed since the last version.",
        });
        const neutral = vi.spyOn(toast, "neutral");
        const user = userEvent.setup();
        renderPage();
        await openEditor(user);
        await user.click(screen.getByRole("button", { name: "Publish changes" }));
        await waitFor(() => expect(api.publishSkill).toHaveBeenCalledWith("tok", "s1"));
        expect(callOrder).toEqual(["flush"]);
        expect(neutral).toHaveBeenCalledWith("The team already has this text.");
    });

    it("tells the team a new version is out, reads the versions again and clears the flag", async () => {
        serve(withUnpublished());
        vi.mocked(api.publishSkill).mockResolvedValue({ ok: true, data: { versionNo: 2 } });
        const success = vi.spyOn(toast, "success");
        const user = userEvent.setup();
        renderPage();
        await openEditor(user);
        // After the publish the server's page is clean.
        vi.mocked(api.fetchSkill).mockResolvedValue({
            ok: true,
            data: { ...teamSkill, publishedVersionNo: 2, bodyMarkdown: "x" },
        });
        await user.click(screen.getByRole("button", { name: "Publish changes" }));
        await waitFor(() => expect(success).toHaveBeenCalledWith("Published version 2."));
        expect(api.fetchSkillVersions).toHaveBeenCalledTimes(2);
        await waitFor(() => expect(screen.queryByText("Unpublished changes")).toBeNull());
        expect(
            (screen.getByRole("button", { name: "Publish changes" }) as HTMLButtonElement).disabled
        ).toBe(true);
    });

    it("flushes the editor before the details are saved", async () => {
        vi.mocked(api.updateSkill).mockImplementation(async () => {
            callOrder.push("patch");
            return { ok: true, data: withUnpublished({ title: "Weekly!" }) };
        });
        const user = userEvent.setup();
        renderPage();
        const title = await openEditor(user);
        await user.type(title, "!");
        await user.click(screen.getByRole("button", { name: "Save draft" }));
        await waitFor(() => expect(callOrder).toEqual(["flush", "patch"]));
    });

    it("choosing My team on a private skill is the share: it reports the published version", async () => {
        vi.mocked(api.updateSkill).mockResolvedValue({
            ok: true,
            data: { ...teamSkill, publishedVersionNo: 1 },
        });
        vi.mocked(api.fetchSkills).mockResolvedValue(list([skill()]));
        vi.mocked(api.fetchSkill).mockResolvedValue({
            ok: true,
            data: { ...skill(), bodyMarkdown: "x" },
        });
        const success = vi.spyOn(toast, "success");
        const user = userEvent.setup();
        renderPage();
        await openEditor(user);
        expect(screen.queryByText(/Saving keeps your changes private/)).toBeNull();
        await user.click(screen.getByRole("button", { name: "My team" }));
        await user.click(screen.getByRole("button", { name: "Save details" }));
        await waitFor(() =>
            expect(api.updateSkill).toHaveBeenCalledWith("tok", "s1", { visibility: "team" })
        );
        await waitFor(() => expect(success).toHaveBeenCalledWith("Published version 1."));
    });

    it("choosing Only me ends the sharing: it is not an unpublished change to publish", async () => {
        const user = userEvent.setup();
        renderPage();
        await openEditor(user);
        await user.click(screen.getByRole("button", { name: "Only me" }));
        expect(screen.queryByText("Unpublished changes")).toBeNull();
        const publish = screen.getByRole("button", {
            name: "Publish changes",
        }) as HTMLButtonElement;
        expect(publish.disabled).toBe(true);
    });

    it("a private skill has no Publish button: its text saves by itself", async () => {
        serve(skill());
        const user = userEvent.setup();
        renderPage();
        await openEditor(user);
        expect(screen.queryByRole("button", { name: /^Publish/ })).toBeNull();
        expect(screen.queryByText("Unpublished changes")).toBeNull();
    });
});
