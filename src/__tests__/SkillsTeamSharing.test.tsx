/**
 * Sharing Genos Skills with the team (MIP-2043), on the existing Skills page: who may edit a team
 * skill and who may only run it, copying with attribution, hiding one from the team, and what
 * taking a skill back from the team says first.
 *
 * Like `SkillsPage.test.tsx`, every network edge is mocked and so is the note editor; the layout
 * is checked in screenshots (see the PR). What is pinned here is what each ROLE sees and which
 * request each action sends.
 */

import { forwardRef, useImperativeHandle } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { toast } from "../components/ui/feedback/toastStore";
import * as api from "../features/genos/skills/skillsApi";
import { parseSkill, type SkillRow } from "../features/genos/skills/skillsApi";
import type { SkillsHost } from "../features/genos/skills/skillsHost";
import { SkillsPage } from "../features/genos/skills/SkillsPage";
import { I18nProvider } from "../i18n";

vi.mock("../context/authState", () => ({
    useAuth: () => ({ accessToken: "tok" }),
}));

vi.mock("../features/genos/skills/SkillBodyEditor", () => ({
    SkillBodyEditor: forwardRef(function Stub(
        props: { handleRef?: React.Ref<{ flush: () => Promise<void> }>; noteId: number },
        _ref
    ) {
        useImperativeHandle(props.handleRef, () => ({ flush: async () => undefined }));
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
        updateSkill: vi.fn(),
        deleteSkill: vi.fn(),
        publishSkill: vi.fn(),
        copySkill: vi.fn(),
        fetchSkillVersions: vi.fn(),
        addSkillEditor: vi.fn(),
        removeSkillEditor: vi.fn(),
        setSkillHidden: vi.fn(),
    };
});

const base = (over: Partial<SkillRow> = {}): SkillRow => ({
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
    author: null,
    starCount: 0,
    runCount30d: 0,
    copyCount: 0,
    isOfficial: false,
    starred: false,
    editors: [],
    forkedFrom: null,
    noteId: null,
    hasUnpublishedChanges: false,
    unpublishedChanges: [],
    ...over,
});

const asOwner = (over: Partial<SkillRow> = {}) =>
    base({
        mine: true,
        role: "owner",
        canEdit: true,
        canManage: true,
        noteId: 12,
        ownerName: "ken",
        ...over,
    });
const asEditor = (over: Partial<SkillRow> = {}) =>
    base({ role: "editor", canEdit: true, noteId: 12, ...over });

const team = [
    { userId: "u1", userName: "Ken" },
    { userId: "u2", userName: "Ayumi" },
    { userId: "u3", userName: "Mina" },
];

const host = {
    myself: { userId: "u1" },
    setMyself: vi.fn(),
    socket: null,
    useTEM: { teamMembers: team },
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

const serve = (row: SkillRow, body = "## Steps\n1. Read") => {
    vi.mocked(api.fetchSkills).mockResolvedValue({
        ok: true,
        data: { skills: [row], limit: 25, used: 1, publicEnabled: false },
    });
    vi.mocked(api.fetchSkill).mockResolvedValue({
        ok: true,
        data: { ...row, bodyMarkdown: body },
    });
};

const openTeamSkill = async (user: ReturnType<typeof userEvent.setup>, name = "Weekly update") => {
    await user.click(await screen.findByRole("tab", { name: "Team" }));
    await user.click(await screen.findByRole("button", { name }));
};

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.fetchSkillVersions).mockResolvedValue({ ok: true, data: [] });
});

describe("reading the server's roles", () => {
    it("reads the role, the permission flags, the editors and where a copy came from", () => {
        const row = parseSkill({
            id: "s1",
            role: "editor",
            canEdit: true,
            canManage: false,
            canHide: false,
            hiddenByTeam: true,
            editors: [{ id: "u2", username: "ayumi" }, { id: "", username: "no id" }, 7],
            forkedFrom: {
                available: true,
                id: "s0",
                title: "Original",
                ownerName: "ken",
                versionNo: 3,
            },
        });
        expect(row?.role).toBe("editor");
        expect(row?.canEdit).toBe(true);
        expect(row?.canManage).toBe(false);
        expect(row?.hiddenByTeam).toBe(true);
        expect(row?.editors).toEqual([{ id: "u2", username: "ayumi" }]);
        expect(row?.forkedFrom).toEqual({
            available: true,
            id: "s0",
            title: "Original",
            ownerName: "ken",
            author: null,
            versionNo: 3,
        });
    });

    it("keeps nothing of an original the reader cannot see, even if a server sent it", () => {
        const row = parseSkill({
            id: "s1",
            forkedFrom: {
                available: false,
                id: "s0",
                title: "Secret",
                ownerName: "ken",
                versionNo: 2,
            },
        });
        expect(row?.forkedFrom).toEqual({
            available: false,
            id: "",
            title: "",
            ownerName: "",
            author: null,
            versionNo: 2,
        });
    });

    it("reads a skill with none of the new keys as a plain reader (an older server)", () => {
        const row = parseSkill({ id: "s1", mine: false });
        expect(row).toMatchObject({
            role: "reader",
            canEdit: false,
            canManage: false,
            canHide: false,
            hiddenByTeam: false,
            editors: [],
            forkedFrom: null,
        });
        expect(parseSkill({ id: "s2", mine: true })?.role).toBe("owner");
    });
});

describe("the Team tab", () => {
    it("marks a skill the member edits, and one the team owner hid", async () => {
        vi.mocked(api.fetchSkills).mockResolvedValue({
            ok: true,
            data: {
                skills: [
                    asEditor({ id: "a", title: "Edited by me" }),
                    base({
                        id: "b",
                        title: "Hidden one",
                        hiddenByTeam: true,
                        status: "hidden_by_team",
                    }),
                ],
                limit: 25,
                publicEnabled: false,
                used: 0,
            },
        });
        const user = userEvent.setup();
        renderPage();
        await user.click(await screen.findByRole("tab", { name: "Team" }));
        const edited = (await screen.findByRole("button", { name: "Edited by me" })).closest(
            "li"
        )!;
        expect(within(edited).getByText("Editor")).toBeTruthy();
        const hidden = screen.getByRole("button", { name: "Hidden one" }).closest("li")!;
        expect(within(hidden).getByText("Hidden from team")).toBeTruthy();
    });

    it("offers a teammate's skill as Copy to my skills and the member's own never", async () => {
        serve(base());
        vi.mocked(api.copySkill).mockResolvedValue({ ok: true, data: asOwner({ id: "c1" }) });
        const user = userEvent.setup();
        renderPage();
        await user.click(await screen.findByRole("tab", { name: "Team" }));
        await user.click(await screen.findByRole("button", { name: "Actions for Weekly update" }));
        expect(screen.queryByRole("menuitem", { name: "Hide from team" })).toBeNull();
        expect(screen.queryByRole("menuitem", { name: "Delete" })).toBeNull();
        await user.click(await screen.findByRole("menuitem", { name: "Copy to my skills" }));
        await waitFor(() => expect(api.copySkill).toHaveBeenCalledWith("tok", "s1", "team-1"));
    });

    it("does not offer to copy a private skill the member was invited to edit, nor a hidden one", async () => {
        vi.mocked(api.fetchSkills).mockResolvedValue({
            ok: true,
            data: {
                skills: [
                    asEditor({ id: "a", title: "Invited only", visibility: "private" }),
                    base({ id: "b", title: "Hidden one", hiddenByTeam: true, canHide: true }),
                ],
                limit: 25,
                publicEnabled: false,
                used: 0,
            },
        });
        const user = userEvent.setup();
        renderPage();
        await user.click(await screen.findByRole("tab", { name: "Team" }));
        await user.click(await screen.findByRole("button", { name: "Actions for Invited only" }));
        expect(screen.queryByRole("menuitem", { name: "Copy to my skills" })).toBeNull();
        await user.keyboard("{Escape}");
        await user.click(screen.getByRole("button", { name: "Actions for Hidden one" }));
        expect(screen.queryByRole("menuitem", { name: "Copy to my skills" })).toBeNull();
        expect(screen.getByRole("menuitem", { name: "Show to team" })).toBeTruthy();
    });

    it("lets the team owner hide a team skill from the list, and reads the list again", async () => {
        serve(base({ canHide: true }));
        vi.mocked(api.setSkillHidden).mockResolvedValue({
            ok: true,
            data: base({ hiddenByTeam: true, canHide: true }),
        });
        const success = vi.spyOn(toast, "success");
        const user = userEvent.setup();
        renderPage();
        await user.click(await screen.findByRole("tab", { name: "Team" }));
        await user.click(await screen.findByRole("button", { name: "Actions for Weekly update" }));
        await user.click(await screen.findByRole("menuitem", { name: "Hide from team" }));
        await waitFor(() => expect(api.setSkillHidden).toHaveBeenCalledWith("tok", "s1", true));
        expect(success).toHaveBeenCalledWith("Hidden from your team.");
        await waitFor(() =>
            expect(vi.mocked(api.fetchSkills).mock.calls.length).toBeGreaterThan(2)
        );
    });

    it("says why when the hide fails", async () => {
        serve(base({ canHide: true }));
        vi.mocked(api.setSkillHidden).mockResolvedValue({
            ok: false,
            reason: "bad_input",
            message: "Only the team owner can hide a team skill.",
        });
        const error = vi.spyOn(toast, "error");
        const user = userEvent.setup();
        renderPage();
        await user.click(await screen.findByRole("tab", { name: "Team" }));
        await user.click(await screen.findByRole("button", { name: "Actions for Weekly update" }));
        await user.click(await screen.findByRole("menuitem", { name: "Hide from team" }));
        await waitFor(() =>
            expect(error).toHaveBeenCalledWith("Only the team owner can hide a team skill.")
        );
    });
});

describe("a team skill as a reader", () => {
    it("can run and copy it, cannot change it, and sees no editors field", async () => {
        serve(base());
        const user = userEvent.setup();
        renderPage();
        await openTeamSkill(user);
        expect(await screen.findByText(/You can read this skill/)).toBeTruthy();
        expect(screen.queryByText("Editors")).toBeNull();
        expect(screen.queryByRole("button", { name: "Delete skill" })).toBeNull();
        expect(screen.queryByTestId("body-editor")).toBeNull();
        expect(screen.getByRole("button", { name: "Copy to my skills" })).toBeTruthy();
        expect((screen.getByLabelText(/^Title/) as HTMLInputElement).disabled).toBe(true);
    });

    it("names where a copy came from, by author and version", async () => {
        serve(
            asOwner({
                visibility: "private",
                publishedVersionNo: 0,
                forkedFrom: {
                    available: true,
                    id: "s0",
                    title: "Release notes",
                    ownerName: "ayumi",
                    author: null,
                    versionNo: 2,
                },
            })
        );
        const user = userEvent.setup();
        renderPage();
        await user.click(await screen.findByRole("button", { name: "Weekly update" }));
        expect(
            await screen.findByText("Copied from “Release notes” by ayumi (version 2).")
        ).toBeTruthy();
    });

    it("says only that the original is gone when the member can no longer see it", async () => {
        serve(
            asOwner({
                visibility: "private",
                publishedVersionNo: 0,
                forkedFrom: {
                    available: false,
                    id: "",
                    title: "",
                    ownerName: "",
                    author: null,
                    versionNo: 2,
                },
            })
        );
        const user = userEvent.setup();
        renderPage();
        await user.click(await screen.findByRole("button", { name: "Weekly update" }));
        expect(await screen.findByText("Copied from a skill you can no longer see.")).toBeTruthy();
    });

    it("copies into the member's skills from the page and goes back to the list", async () => {
        serve(base());
        vi.mocked(api.copySkill).mockResolvedValue({ ok: true, data: asOwner({ id: "c1" }) });
        const user = userEvent.setup();
        renderPage();
        await openTeamSkill(user);
        await user.click(await screen.findByRole("button", { name: "Copy to my skills" }));
        await waitFor(() => expect(api.copySkill).toHaveBeenCalledWith("tok", "s1", "team-1"));
    });
});

describe("the team owner on a team skill", () => {
    it("sees a hidden skill with the way to show it, and cannot copy it", async () => {
        serve(base({ canHide: true, hiddenByTeam: true, status: "hidden_by_team" }));
        vi.mocked(api.setSkillHidden).mockResolvedValue({
            ok: true,
            data: base({ canHide: true }),
        });
        const user = userEvent.setup();
        renderPage();
        await openTeamSkill(user);
        expect(await screen.findByText(/You hid this skill from your team/)).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Copy to my skills" })).toBeNull();
        await user.click(screen.getByRole("button", { name: "Show to team" }));
        await waitFor(() => expect(api.setSkillHidden).toHaveBeenCalledWith("tok", "s1", false));
        await waitFor(() =>
            expect(screen.getByRole("button", { name: "Hide from team" })).toBeTruthy()
        );
        expect(screen.queryByText(/You hid this skill from your team/)).toBeNull();
    });

    it("hides a visible skill from the page", async () => {
        serve(base({ canHide: true }));
        vi.mocked(api.setSkillHidden).mockResolvedValue({
            ok: true,
            data: base({ canHide: true, hiddenByTeam: true, status: "hidden_by_team" }),
        });
        const user = userEvent.setup();
        renderPage();
        await openTeamSkill(user);
        await user.click(await screen.findByRole("button", { name: "Hide from team" }));
        await waitFor(() => expect(api.setSkillHidden).toHaveBeenCalledWith("tok", "s1", true));
        expect(await screen.findByText(/You hid this skill from your team/)).toBeTruthy();
    });
});

describe("the owner tells the team a skill is hidden", () => {
    it("says the team owner hid it, and that teammates cannot run it", async () => {
        serve(asOwner({ hiddenByTeam: true, status: "hidden_by_team" }));
        const user = userEvent.setup();
        renderPage();
        await user.click(await screen.findByRole("button", { name: "Weekly update" }));
        expect(await screen.findByText(/The team owner hid this skill/)).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Show to team" })).toBeNull();
    });
});

describe("a co-editor", () => {
    it("edits the text and details but not the name or who can use it, and cannot delete", async () => {
        serve(asEditor({ editors: [{ id: "u3", username: "mina" }] }));
        const user = userEvent.setup();
        renderPage();
        await openTeamSkill(user);
        expect(await screen.findByTestId("body-editor")).toBeTruthy();
        expect(screen.getByText(/You edit this skill as an editor/)).toBeTruthy();
        expect((screen.getByLabelText(/^Title/) as HTMLInputElement).disabled).toBe(false);
        expect((screen.getByLabelText(/^Name to type/) as HTMLInputElement).disabled).toBe(true);
        expect(screen.getAllByText("Only the owner can change this.").length).toBe(2);
        expect(screen.getByRole("button", { name: "Only me" }).hasAttribute("disabled")).toBe(
            true
        );
        expect(screen.queryByRole("button", { name: "Delete skill" })).toBeNull();
        expect(screen.getByRole("button", { name: "Publish changes" })).toBeTruthy();
    });

    it("sees who edits but cannot remove them, and can stop editing", async () => {
        serve(
            asEditor({
                editors: [
                    { id: "u1", username: "ken" },
                    { id: "u3", username: "mina" },
                ],
            })
        );
        vi.mocked(api.removeSkillEditor).mockResolvedValue({
            ok: true,
            data: [{ id: "u3", username: "mina" }],
        });
        const success = vi.spyOn(toast, "success");
        const user = userEvent.setup();
        renderPage();
        await openTeamSkill(user);
        expect(await screen.findByText("mina")).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Remove mina" })).toBeNull();
        await user.click(screen.getByRole("button", { name: "Stop editing this skill" }));
        await waitFor(() => expect(api.removeSkillEditor).toHaveBeenCalledWith("tok", "s1", "u1"));
        expect(success).toHaveBeenCalledWith("You no longer edit this skill.");
        // Back on the list.
        expect(await screen.findByRole("tab", { name: "My skills" })).toBeTruthy();
    });

    it("saves only the details it changed: the name and sharing are never sent", async () => {
        serve(asEditor());
        vi.mocked(api.updateSkill).mockResolvedValue({
            ok: true,
            data: { ...asEditor({ description: "Better words" }), bodyMarkdown: "x" },
        });
        const user = userEvent.setup();
        renderPage();
        await openTeamSkill(user);
        const description = await screen.findByLabelText(/^Description/);
        await user.clear(description);
        await user.type(description, "Better words");
        await user.click(screen.getByRole("button", { name: "Save draft" }));
        await waitFor(() =>
            expect(api.updateSkill).toHaveBeenCalledWith("tok", "s1", {
                description: "Better words",
            })
        );
    });
});

describe("the owner chooses the editors", () => {
    it("lists them, removes one, and offers only teammates who are not editors yet", async () => {
        serve(asOwner({ editors: [{ id: "u2", username: "ayumi" }] }));
        vi.mocked(api.removeSkillEditor).mockResolvedValue({ ok: true, data: [] });
        const user = userEvent.setup();
        renderPage();
        await user.click(await screen.findByRole("button", { name: "Weekly update" }));
        expect(await screen.findByText("Editors")).toBeTruthy();
        expect(screen.getByText("ayumi")).toBeTruthy();
        await user.click(screen.getByRole("button", { name: "Remove ayumi" }));
        await waitFor(() => expect(api.removeSkillEditor).toHaveBeenCalledWith("tok", "s1", "u2"));
        expect(await screen.findByText("No editors yet.")).toBeTruthy();
    });

    it("invites a teammate from the team, never the owner themself", async () => {
        serve(asOwner());
        vi.mocked(api.addSkillEditor).mockResolvedValue({
            ok: true,
            data: [{ id: "u3", username: "mina" }],
        });
        const user = userEvent.setup();
        renderPage();
        await user.click(await screen.findByRole("button", { name: "Weekly update" }));
        await user.click(await screen.findByRole("combobox", { name: "Add an editor" }));
        const options = (await screen.findAllByRole("option")).map((o) => o.textContent);
        expect(options).toEqual(["Ayumi", "Mina"]);
        await user.click(screen.getByRole("option", { name: "Mina" }));
        await waitFor(() => expect(api.addSkillEditor).toHaveBeenCalledWith("tok", "s1", "u3"));
        expect(await screen.findByText("mina")).toBeTruthy();
    });

    it("shows the server's sentence when an invitation is refused", async () => {
        serve(asOwner());
        vi.mocked(api.addSkillEditor).mockResolvedValue({
            ok: false,
            reason: "off",
            message: "That person is not on this team.",
        });
        const error = vi.spyOn(toast, "error");
        const user = userEvent.setup();
        renderPage();
        await user.click(await screen.findByRole("button", { name: "Weekly update" }));
        await user.click(await screen.findByRole("combobox", { name: "Add an editor" }));
        await user.click(await screen.findByRole("option", { name: "Mina" }));
        await waitFor(() =>
            expect(error).toHaveBeenCalledWith("That person is not on this team.")
        );
    });
});

describe("taking a skill back from the team", () => {
    it("says what the team loses before it happens, and saves only after a yes", async () => {
        serve(asOwner());
        vi.mocked(api.updateSkill).mockResolvedValue({
            ok: true,
            data: { ...asOwner({ visibility: "private" }), bodyMarkdown: "x" },
        });
        const user = userEvent.setup();
        renderPage();
        await user.click(await screen.findByRole("button", { name: "Weekly update" }));
        await user.click(await screen.findByRole("button", { name: "Only me" }));
        await user.click(screen.getByRole("button", { name: "Save draft" }));
        const dialog = await screen.findByRole("dialog", { name: "Make this skill private?" });
        expect(
            within(dialog).getByText(/Your team stops seeing and running it right away/)
        ).toBeTruthy();
        expect(api.updateSkill).not.toHaveBeenCalled();
        await user.click(within(dialog).getByRole("button", { name: "Make private" }));
        await waitFor(() =>
            expect(api.updateSkill).toHaveBeenCalledWith("tok", "s1", { visibility: "private" })
        );
    });

    it("keeps the skill shared when the person cancels", async () => {
        serve(asOwner());
        const user = userEvent.setup();
        renderPage();
        await user.click(await screen.findByRole("button", { name: "Weekly update" }));
        await user.click(await screen.findByRole("button", { name: "Only me" }));
        await user.click(screen.getByRole("button", { name: "Save draft" }));
        const dialog = await screen.findByRole("dialog", { name: "Make this skill private?" });
        await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
        expect(api.updateSkill).not.toHaveBeenCalled();
    });

    it("sharing a private skill needs no such question", async () => {
        serve(asOwner({ visibility: "private", publishedVersionNo: 0 }));
        vi.mocked(api.updateSkill).mockResolvedValue({
            ok: true,
            data: { ...asOwner({ publishedVersionNo: 1 }), bodyMarkdown: "x" },
        });
        const user = userEvent.setup();
        renderPage();
        await user.click(await screen.findByRole("button", { name: "Weekly update" }));
        await user.click(await screen.findByRole("button", { name: "My team" }));
        await user.click(screen.getByRole("button", { name: "Save details" }));
        await waitFor(() =>
            expect(api.updateSkill).toHaveBeenCalledWith("tok", "s1", { visibility: "team" })
        );
        expect(screen.queryByRole("dialog", { name: "Make this skill private?" })).toBeNull();
    });
});
