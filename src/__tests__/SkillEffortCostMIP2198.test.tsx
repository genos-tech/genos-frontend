/**
 * The effort choice of the skill editor shows what each level costs (MIP-2198), in the existing
 * field and without a new section. The server owns the numbers (`GET /skills/effort-levels/`, read
 * from the model catalog); this pins what the form does with each answer it can give.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SkillDetailsForm } from "../features/genos/skills/SkillDetailsForm";
import { draftFrom } from "../features/genos/skills/skillDraft";
import * as api from "../features/genos/skills/skillsApi";
import type { EffortLevelRow, SkillRow } from "../features/genos/skills/skillsApi";
import { I18nProvider } from "../i18n";

vi.mock("../context/authState", () => ({
    useAuth: () => ({ accessToken: "tok" }),
}));

vi.mock("../features/genos/skills/skillsApi", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../features/genos/skills/skillsApi")>();
    return { ...actual, fetchEffortLevels: vi.fn() };
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
    editors: [],
    shares: [],
    forkedFrom: null,
    noteId: 12,
    hasUnpublishedChanges: false,
    unpublishedChanges: [],
    ...over,
});

const LEVELS: EffortLevelRow[] = [
    { level: "low", relativeCost: 1, locked: false },
    { level: "medium", relativeCost: 3.2, locked: false },
    { level: "high", relativeCost: 5, locked: true },
];

const renderForm = (row: SkillRow = skill()) => {
    const onChange = vi.fn();
    render(
        <CssVarsProvider>
            <I18nProvider>
                <SkillDetailsForm
                    disabled={false}
                    draft={draftFrom(row)}
                    problems={{}}
                    serverProblems={{}}
                    skill={row}
                    onChange={onChange}
                />
            </I18nProvider>
        </CssVarsProvider>
    );
    return onChange;
};

const openEffort = async () => {
    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: "Effort" }));
    return user;
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe("parseEffortLevels", () => {
    it("keeps the three levels with a positive cost and drops anything else", () => {
        expect(
            api.parseEffortLevels({
                enabled: true,
                levels: [
                    { level: "low", relativeCost: 1, locked: false },
                    { level: "medium", relativeCost: -2, locked: true },
                    { level: "extreme", relativeCost: 9 },
                    "nope",
                    { level: "high", relativeCost: "9", locked: "yes" },
                ],
            })
        ).toEqual([
            { level: "low", relativeCost: 1, locked: false },
            { level: "medium", relativeCost: null, locked: true },
            { level: "high", relativeCost: null, locked: false },
        ]);
    });

    it("says nothing to show while the agent is not on effort levels, and fails on junk", () => {
        expect(api.parseEffortLevels({ enabled: false, levels: [] })).toEqual([]);
        expect(api.parseEffortLevels("x")).toBeNull();
    });
});

describe("the effort choice with costs", () => {
    it("shows what each level costs next to its name, and locks one above the plan", async () => {
        vi.mocked(api.fetchEffortLevels).mockResolvedValue({ ok: true, data: LEVELS });
        renderForm();
        // The cost is the field's own help and option text, not a new section.
        await screen.findByText(/Runs at the level each person has chosen/);
        await openEffort();
        expect(screen.getByRole("option", { name: "Low · lowest cost" })).toBeInTheDocument();
        expect(
            screen.getByRole("option", { name: "Medium · about 3.2× Low" })
        ).toBeInTheDocument();
        const locked = screen.getByRole("option", { name: "High · not in your plan" });
        expect(locked).toHaveAttribute("aria-disabled", "true");
        expect(screen.getByRole("option", { name: "My setting" })).toBeInTheDocument();
    });

    it("saves the level that was picked", async () => {
        vi.mocked(api.fetchEffortLevels).mockResolvedValue({ ok: true, data: LEVELS });
        const onChange = renderForm();
        await screen.findByText(/Runs at the level each person has chosen/);
        const user = await openEffort();
        await user.click(screen.getByRole("option", { name: "Medium · about 3.2× Low" }));
        expect(onChange).toHaveBeenCalledWith({ effort: "medium" });
    });

    it("keeps a level the plan no longer allows selectable while it is the saved one", async () => {
        vi.mocked(api.fetchEffortLevels).mockResolvedValue({ ok: true, data: LEVELS });
        renderForm(skill({ effort: "high" }));
        await screen.findByText(/A higher level costs more credits/);
        await openEffort();
        const option = screen.getByRole("option", { name: "High · not in your plan" });
        expect(option).not.toHaveAttribute("aria-disabled", "true");
    });

    it("explains My setting differently from a chosen level", async () => {
        vi.mocked(api.fetchEffortLevels).mockResolvedValue({ ok: true, data: LEVELS });
        renderForm(skill({ effort: "" }));
        expect(await screen.findByText(/Runs at the level each person has chosen/)).toBeVisible();
        expect(screen.queryByText(/A higher level costs more credits/)).toBeNull();
    });

    it.each([
        ["the agent is not on effort levels", { ok: true as const, data: [] }],
        ["the request fails", { ok: false as const, reason: "error" as const, message: "" }],
    ])("is the plain field as before when %s", async (_name, answer) => {
        vi.mocked(api.fetchEffortLevels).mockResolvedValue(answer);
        renderForm();
        await waitFor(() => expect(api.fetchEffortLevels).toHaveBeenCalled());
        await openEffort();
        expect(screen.getByRole("option", { name: "Low" })).toBeInTheDocument();
        expect(screen.getByRole("option", { name: "High" })).toBeInTheDocument();
        expect(screen.queryByText(/A higher level costs more credits/)).toBeNull();
        expect(screen.queryByText(/lowest cost/)).toBeNull();
    });
});
