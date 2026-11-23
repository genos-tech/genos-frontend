/**
 * The skill editor checks the name live (MIP-2210): a name is unique among your own skills, among
 * the team's shared skills when shared with the team, and among all public skills when public. The
 * server (`GET /skills/name-check/`) decides and words the answer; this pins what the name field does
 * with it, in the existing field and without a new section.
 */

import { useState } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SkillDetailsForm } from "../features/genos/skills/SkillDetailsForm";
import { draftFrom, type SkillDraft } from "../features/genos/skills/skillDraft";
import * as api from "../features/genos/skills/skillsApi";
import type { SkillRow } from "../features/genos/skills/skillsApi";
import { I18nProvider } from "../i18n";

vi.mock("../context/authState", () => ({
    useAuth: () => ({ accessToken: "tok" }),
}));

vi.mock("../features/genos/skills/skillsApi", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../features/genos/skills/skillsApi")>();
    return { ...actual, fetchEffortLevels: vi.fn(), fetchNameCheck: vi.fn() };
});

const skill = (over: Partial<SkillRow> = {}): SkillRow => ({
    id: "s1",
    teamId: "team-1",
    slug: "weekly-update",
    title: "Weekly update",
    description: "Summarise the week",
    tags: [],
    icon: "⚡",
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

const Harness = ({ row, ownerOnly = false }: { row: SkillRow; ownerOnly?: boolean }) => {
    const [draft, setDraft] = useState<SkillDraft>(draftFrom(row));
    return (
        <SkillDetailsForm
            disabled={false}
            draft={draft}
            ownerOnly={ownerOnly}
            problems={{}}
            serverProblems={{}}
            skill={row}
            onChange={(next) => setDraft((prev) => ({ ...prev, ...next }))}
        />
    );
};

const renderForm = (row: SkillRow = skill(), ownerOnly = false) =>
    render(
        <CssVarsProvider>
            <I18nProvider>
                <Harness ownerOnly={ownerOnly} row={row} />
            </I18nProvider>
        </CssVarsProvider>
    );

const typeName = async (value: string) => {
    const user = userEvent.setup();
    const input = screen.getByLabelText(/^Name to type/);
    await user.clear(input);
    await user.type(input, value);
    return input;
};

const SLOW = { timeout: 3000 };

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.fetchEffortLevels).mockResolvedValue({ ok: true, data: [] });
});

describe("the live name check", () => {
    it("shows the server's sentence under the name when it is taken", async () => {
        vi.mocked(api.fetchNameCheck).mockResolvedValue({
            ok: true,
            data: {
                slug: "planner",
                available: false,
                message: "A public skill is already named `planner`. Choose another name.",
            },
        });
        renderForm();
        await typeName("planner");
        expect(
            await screen.findByText(/A public skill is already named/, undefined, SLOW)
        ).toBeInTheDocument();
    });

    it("asks once, after the typing pause, for the team and skill being edited", async () => {
        vi.mocked(api.fetchNameCheck).mockResolvedValue({
            ok: true,
            data: { slug: "planner", available: true, message: "" },
        });
        renderForm(skill({ visibility: "team" }));
        await typeName("planner");
        await waitFor(() => expect(api.fetchNameCheck).toHaveBeenCalledTimes(1), SLOW);
        expect(api.fetchNameCheck).toHaveBeenCalledWith("tok", {
            teamId: "team-1",
            skillId: "s1",
            slug: "planner",
            visibility: "team",
        });
        // A free name keeps the usual preview, no error.
        expect(await screen.findByText("Runs as /planner")).toBeInTheDocument();
    });

    it("does not ask for the saved name, a badly formed name or a locked field", async () => {
        renderForm();
        await typeName("Has Space");
        await typeName("a");
        await typeName("help");
        await typeName("weekly-update");
        await new Promise((r) => setTimeout(r, 700));
        expect(api.fetchNameCheck).not.toHaveBeenCalled();
    });

    it("does not ask on a field only the owner may change", async () => {
        renderForm(skill(), true);
        await new Promise((r) => setTimeout(r, 700));
        expect(api.fetchNameCheck).not.toHaveBeenCalled();
    });

    it("says nothing when the check fails: saving is checked by the server again", async () => {
        vi.mocked(api.fetchNameCheck).mockResolvedValue({
            ok: false,
            reason: "error",
            message: "",
        });
        renderForm();
        await typeName("planner");
        await waitFor(() => expect(api.fetchNameCheck).toHaveBeenCalled(), SLOW);
        expect(screen.getByText("Runs as /planner")).toBeInTheDocument();
    });
});
