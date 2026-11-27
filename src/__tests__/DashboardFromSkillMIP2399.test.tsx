/**
 * MIP-2399: the dashboard form offers WHAT makes the page: a built-in page (a milestone, a project
 * or your own progress, today's choice and the default) or one of your skills. The skill choice
 * hides every built-in field, shows the skill picker and its input, always uses the model (so the
 * AI effort and its cost show), and sends the skill and nothing of the built-in kinds. Pinned both
 * ways, plus the gate rules the form is built on.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { render as rtlRender, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ScheduleFormPanel } from "../components/layout/schedules/ScheduleFormPanel";
import { HashMentionDataProvider, type HashMentionData } from "../context/HashMentionDataContext";
import { showsEffort } from "../features/schedules/scheduleEffort";
import { paramApplies, paramRequiredNow } from "../features/schedules/scheduleParams";
import { getMessages } from "../i18n";
import type { ScheduleJob } from "../services/schedules";

vi.setConfig({ testTimeout: 30000 });

vi.mock("../context/authState", () => ({
    useAuth: () => ({ accessToken: "tok" }),
    useOptionalAccessToken: () => "tok",
}));
vi.mock("../components/layout/schedules/scheduleParamHooks", () => ({
    useJoinedProjects: () => [],
    useProjectAvatars: () => new Map(),
    useProjectMilestones: () => ({ groups: [], loading: false, failed: false }),
    useNoteFolders: () => ({ mine: [], team: [], loading: false, failed: false }),
}));
const fetchRunnableSkills = vi.fn();
vi.mock("../features/genos/skills/skillsApi", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../features/genos/skills/skillsApi")>()),
    fetchRunnableSkills: (...a: unknown[]) => fetchRunnableSkills(...a),
}));

const DASHBOARD: ScheduleJob = {
    job: "ai_dashboard",
    title: "Dashboard page",
    description: "One living dashboard page.",
    usesAi: true,
    effortDefault: "low",
    effortCost: null,
    params: {
        source: { type: "string", enum: ["template", "skill"] },
        skill_id: { type: "string" },
        version_no: { type: "integer", minimum: 1 },
        input: { type: "string" },
        kind: { type: "string", enum: ["milestone", "project", "mine"] },
        milestone_id: { type: "integer", minimum: 1 },
        project_id: { type: "integer", minimum: 1 },
        period: { type: "string", enum: ["week", "month", "quarter", "year"] },
        focus: { type: "string" },
        save_to: { type: "string", enum: ["me", "personal_folder", "team_folder"] },
        folder_id: { type: "integer", minimum: 1 },
        ai_sentences: { type: "boolean" },
    },
};
const RUN_SKILL: ScheduleJob = {
    job: "run_skill",
    title: "Run a skill",
    description: "",
    usesAi: true,
    effortDefault: "medium",
    effortCost: null,
    params: {
        skill_id: { type: "string", required: true },
        version_no: { type: "integer", minimum: 1 },
        input: { type: "string" },
    },
};

const SKILLS = [
    {
        id: "k1",
        slug: "my-board",
        title: "My board",
        description: "",
        group: "mine",
        ownerName: "",
        publishedVersionNo: 2,
        tagChips: [{ name: "dashboard", color: "#808080", textColor: "white" }],
    },
];

const mention = (): HashMentionData => ({
    tasks: [],
    notes: [],
    chats: [],
    allChats: [],
    projects: [],
    todoGroups: [],
    myself: { teamId: "t1" } as never,
    refresh: () => {},
});

const renderForm = (job: ScheduleJob = DASHBOARD) => {
    const onSubmit = vi.fn(async () => ({ ok: true as const }));
    rtlRender(
        <CssVarsProvider>
            <HashMentionDataProvider value={mention()}>
                <ScheduleFormPanel
                    jobs={[job]}
                    schedule={null}
                    timeZone="Asia/Tokyo"
                    onCancel={() => {}}
                    onSubmit={onSubmit}
                />
            </HashMentionDataProvider>
        </CssVarsProvider>
    );
    return onSubmit;
};

const s = () => getMessages().settings.schedules;
const params = () => screen.getByTestId("schedule-params");
const sourceBox = () => within(params()).getByRole("combobox", { name: s().paramSource });
const pick = async (
    user: ReturnType<typeof userEvent.setup>,
    box: HTMLElement,
    option: string | RegExp
) => {
    await user.click(box);
    await user.click(await screen.findByRole("option", { name: option }));
};
const useSkill = async (user: ReturnType<typeof userEvent.setup>) =>
    pick(user, sourceBox(), s().sourceSkill);

beforeEach(() => {
    fetchRunnableSkills.mockReset();
    fetchRunnableSkills.mockResolvedValue({ ok: true, data: SKILLS });
});

describe("the gate rules", () => {
    it("treat an empty source as a built-in page", () => {
        expect(paramApplies(DASHBOARD, "kind", {})).toBe(true);
        expect(paramApplies(DASHBOARD, "skill_id", {})).toBe(false);
        expect(paramApplies(DASHBOARD, "kind", { source: "skill" })).toBe(false);
        expect(paramApplies(DASHBOARD, "skill_id", { source: "skill" })).toBe(true);
    });

    it("need BOTH the source and the kind for a milestone", () => {
        expect(paramApplies(DASHBOARD, "milestone_id", { kind: "milestone" })).toBe(true);
        expect(
            paramApplies(DASHBOARD, "milestone_id", { source: "skill", kind: "milestone" })
        ).toBe(false);
        expect(paramApplies(DASHBOARD, "milestone_id", { kind: "project" })).toBe(false);
    });

    it("require what a built-in page and a skill page cannot do without, and nothing else", () => {
        const need = (key: string, typed: Record<string, string>) =>
            paramRequiredNow(DASHBOARD, key, DASHBOARD.params[key], typed);
        expect(need("kind", {})).toBe(true);
        expect(need("period", {})).toBe(false);
        expect(need("focus", {})).toBe(false);
        expect(need("ai_sentences", {})).toBe(false);
        expect(need("skill_id", { source: "skill" })).toBe(true);
        expect(need("input", { source: "skill" })).toBe(false);
        // A hidden field has no place to say it is missing: it is never asked for.
        expect(need("version_no", { source: "skill" })).toBe(false);
        expect(need("milestone_id", { kind: "milestone" })).toBe(true);
    });

    it("leave the other jobs alone: no source, no gate", () => {
        expect(paramApplies(RUN_SKILL, "skill_id", {})).toBe(true);
        expect(paramApplies(RUN_SKILL, "input", {})).toBe(true);
        expect(paramRequiredNow(RUN_SKILL, "skill_id", RUN_SKILL.params.skill_id, {})).toBe(true);
        expect(paramRequiredNow(RUN_SKILL, "input", RUN_SKILL.params.input, {})).toBe(false);
    });

    it("show the AI effort for a skill page whatever the switch says", () => {
        expect(showsEffort(DASHBOARD, { source: "skill" })).toBe(true);
        expect(showsEffort(DASHBOARD, {})).toBe(false);
        expect(showsEffort(DASHBOARD, { ai_sentences: "true" })).toBe(true);
        expect(showsEffort(RUN_SKILL, {})).toBe(true);
    });
});

describe("the form", () => {
    it("starts on a built-in page: its fields, no skill, no effort", async () => {
        renderForm();
        expect(sourceBox()).toHaveTextContent(s().sourceTemplate);
        expect(
            within(params()).getByRole("combobox", { name: new RegExp(s().paramKind) })
        ).toBeTruthy();
        expect(within(params()).queryByRole("combobox", { name: s().paramSkill })).toBeNull();
        expect(within(params()).queryByLabelText(s().paramSkillInput)).toBeNull();
        expect(screen.queryByTestId("schedule-effort")).toBeNull();
    });

    it("a skill hides the built-in fields, shows the skill and its input, and the AI effort", async () => {
        renderForm();
        const user = userEvent.setup();
        await useSkill(user);
        const p = params();
        expect(within(p).queryByRole("combobox", { name: new RegExp(s().paramKind) })).toBeNull();
        expect(within(p).queryByRole("combobox", { name: s().paramPeriod })).toBeNull();
        expect(within(p).queryByLabelText(s().paramFocus)).toBeNull();
        expect(within(p).queryByTestId("schedule-mode")).toBeNull();
        expect(within(p).getByRole("combobox", { name: s().paramSkill })).toBeTruthy();
        expect(within(p).getByLabelText(s().paramSkillInput)).toBeTruthy();
        // Where it is saved applies to both.
        expect(within(p).getByRole("combobox", { name: s().paramSaveTo })).toBeTruthy();
        // Every run spends credits: the control that says how much shows.
        expect(screen.getByTestId("schedule-effort")).toBeTruthy();
    });

    // MIP-2423: the server's figures are for the report sentences, not a skill's run.
    it("shows no cost estimate for a skill page, and keeps it for a built-in one", async () => {
        const levels = {
            low: { creditsMilli: [100, 200] },
            medium: { creditsMilli: [300, 400] },
            high: { creditsMilli: [900, 1000] },
        };
        renderForm({
            ...DASHBOARD,
            effortCost: { levels } as unknown as ScheduleJob["effortCost"],
        });
        const user = userEvent.setup();
        await useSkill(user);
        const effort = () => within(screen.getByTestId("schedule-effort"));
        expect(effort().getByText(s().effortHintNoEstimate)).toBeTruthy();
        expect(effort().queryByText(s().effortHintSummary)).toBeNull();
        expect(effort().queryByText(/0\.1/)).toBeNull();

        await pick(user, sourceBox(), s().sourceTemplate);
        await pick(
            user,
            within(screen.getByTestId("schedule-mode")).getByRole("combobox"),
            s().scheduleModeAi
        );
        expect(effort().getByText(s().effortHintSummary)).toBeTruthy();
        // A dashboard page adds a summary, not a sentence under a task (MIP-2436).
        expect(
            within(screen.getByTestId("schedule-mode")).getByText(s().scheduleModeAiSummaryHint)
        ).toBeTruthy();
        expect(effort().getByText(/0\.1/)).toBeTruthy();
    });

    it("sends the skill and its input and nothing of the built-in kinds", async () => {
        const onSubmit = renderForm();
        const user = userEvent.setup();
        await useSkill(user);
        await waitFor(() => expect(fetchRunnableSkills).toHaveBeenCalled());
        await pick(
            user,
            within(params()).getByRole("combobox", { name: s().paramSkill }),
            /My board/
        );
        await user.type(within(params()).getByLabelText(s().paramSkillInput), "this week");
        await user.click(screen.getByRole("button", { name: s().create }));
        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
        const sent = (onSubmit.mock.calls[0] as unknown[])[0] as { job: string; params: object };
        expect(sent.job).toBe("ai_dashboard");
        expect(sent.params).toEqual({ source: "skill", skill_id: "k1", input: "this week" });
    });

    it("asks for the skill before it sends anything", async () => {
        const onSubmit = renderForm();
        const user = userEvent.setup();
        await useSkill(user);
        await user.click(screen.getByRole("button", { name: s().create }));
        expect(await screen.findByText(s().errorSkill)).toBeTruthy();
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it("going back to a built-in page drops the skill and asks for the kind again", async () => {
        const onSubmit = renderForm();
        const user = userEvent.setup();
        await useSkill(user);
        await waitFor(() => expect(fetchRunnableSkills).toHaveBeenCalled());
        await pick(
            user,
            within(params()).getByRole("combobox", { name: s().paramSkill }),
            /My board/
        );
        await user.type(within(params()).getByLabelText(s().paramSkillInput), "stale words");
        await pick(user, sourceBox(), s().sourceTemplate);
        // The kind is required again, so nothing is sent without one.
        await user.click(screen.getByRole("button", { name: s().create }));
        expect(onSubmit).not.toHaveBeenCalled();
        await pick(
            user,
            within(params()).getByRole("combobox", { name: new RegExp(s().paramKind) }),
            s().kindMine
        );
        await user.click(screen.getByRole("button", { name: s().create }));
        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
        const sent = (onSubmit.mock.calls[0] as unknown[])[0] as {
            params: Record<string, unknown>;
        };
        expect(sent.params.kind).toBe("mine");
        expect(sent.params).not.toHaveProperty("skill_id");
        expect(sent.params).not.toHaveProperty("input");
        expect(sent.params).not.toHaveProperty("version_no");
    });
});
