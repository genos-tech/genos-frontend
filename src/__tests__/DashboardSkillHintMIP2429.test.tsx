/**
 * MIP-2429: the Skill field's line says what THIS job does with the skill. The dashboard form draws
 * a page; "Run a skill" files what it finds in the Inbox. One parameter name, two sentences, in
 * every language.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { render as rtlRender, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ScheduleFormPanel } from "../components/layout/schedules/ScheduleFormPanel";
import { HashMentionDataProvider, type HashMentionData } from "../context/HashMentionDataContext";
import { knownParam, paramHintKey } from "../features/schedules/scheduleParams";
import { getMessages } from "../i18n";
import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";
import type { ScheduleJob } from "../services/schedules";

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
vi.mock("../features/genos/skills/skillsApi", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../features/genos/skills/skillsApi")>()),
    fetchRunnableSkills: vi.fn(async () => ({ ok: true, data: [] })),
}));

const job = (key: string, params: ScheduleJob["params"]): ScheduleJob => ({
    job: key,
    title: key,
    description: "",
    usesAi: true,
    effortDefault: "medium",
    effortCost: null,
    params,
});

// A job with no `source` parameter is not gated, so the Skill field is drawn at once.
const DASHBOARD = job("ai_dashboard", { skill_id: { type: "string" } });
const RUN_SKILL = job("run_skill", { skill_id: { type: "string", required: true } });

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

const renderForm = (only: ScheduleJob) =>
    rtlRender(
        <CssVarsProvider>
            <HashMentionDataProvider value={mention()}>
                <ScheduleFormPanel
                    jobs={[only]}
                    schedule={null}
                    timeZone="Asia/Tokyo"
                    onCancel={() => {}}
                    onSubmit={async () => ({ ok: true as const })}
                />
            </HashMentionDataProvider>
        </CssVarsProvider>
    );

const s = () => getMessages().settings.schedules;

describe("the Skill field's hint", () => {
    it("describes the dashboard page in the dashboard form", () => {
        renderForm(DASHBOARD);
        const p = within(screen.getByTestId("schedule-params"));
        expect(p.getByText(s().paramDashboardSkillHint)).toBeTruthy();
        expect(p.queryByText(s().paramSkillHint)).toBeNull();
    });

    it('keeps the Inbox sentence for "Run a skill"', () => {
        renderForm(RUN_SKILL);
        const p = within(screen.getByTestId("schedule-params"));
        expect(p.getByText(s().paramSkillHint)).toBeTruthy();
        expect(p.queryByText(s().paramDashboardSkillHint)).toBeNull();
    });

    it("is chosen by the job, and only for the parameter that has two wordings", () => {
        const skill = knownParam("skill_id")!;
        expect(paramHintKey(skill, false, "ai_dashboard")).toBe("paramDashboardSkillHint");
        expect(paramHintKey(skill, true, "run_skill")).toBe("paramSkillHint");
        expect(paramHintKey(knownParam("input")!, false, "ai_dashboard")).toBe(
            "paramSkillInputHint"
        );
    });

    it("has its own sentence in all seven languages", () => {
        for (const [lang, m] of Object.entries({ en, ja, zh, es, fr, hi, ar })) {
            const t = m.settings!.schedules!;
            expect(t.paramDashboardSkillHint, lang).toBeTruthy();
            expect(t.paramDashboardSkillHint, lang).not.toBe(t.paramSkillHint);
            if (lang !== "en") {
                expect(t.paramDashboardSkillHint, lang).not.toBe(
                    en.settings!.schedules!.paramDashboardSkillHint
                );
            }
        }
    });
});
