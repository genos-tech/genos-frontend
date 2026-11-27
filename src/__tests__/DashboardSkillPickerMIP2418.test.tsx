/**
 * MIP-2418: the dashboard form lists only the skills tagged `dashboard`; "Run a skill" lists every
 * skill, as before.
 *
 * Pinned: only tagged skills are offered; the skill a schedule already runs stays listed and chosen
 * without the tag, also after another one is picked; a short or empty list says how to add one and a
 * full one does not; the filter offers no `dashboard` chip; the two strings exist in all locales.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { render as rtlRender, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ScheduleFormPanel } from "../components/layout/schedules/ScheduleFormPanel";
import { HashMentionDataProvider, type HashMentionData } from "../context/HashMentionDataContext";
import { getMessages } from "../i18n";
import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";
import type { Schedule, ScheduleJob } from "../services/schedules";

vi.setConfig({ testTimeout: 30000 });

vi.mock("../context/authState", () => ({
    useAuth: () => ({ accessToken: "tok" }),
    useOptionalAccessToken: () => "tok",
}));
const fetchRunnableSkills = vi.fn();
vi.mock("../features/genos/skills/skillsApi", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../features/genos/skills/skillsApi")>()),
    fetchRunnableSkills: (...a: unknown[]) => fetchRunnableSkills(...a),
}));

const job = (key: string, params: ScheduleJob["params"]): ScheduleJob => ({
    job: key,
    title: key,
    description: "",
    usesAi: true,
    effortDefault: "low",
    effortCost: null,
    params,
});
const DASHBOARD = job("ai_dashboard", {
    source: { type: "string", enum: ["template", "skill"] },
    skill_id: { type: "string" },
    version_no: { type: "integer", minimum: 1 },
    input: { type: "string" },
});
const RUN_SKILL = job("run_skill", {
    skill_id: { type: "string", required: true },
    version_no: { type: "integer", minimum: 1 },
    input: { type: "string" },
});

const chip = (name: string) => ({ name, color: "#808080", textColor: "white" });
const skill = (id: string, title: string, ...tags: string[]) => ({
    id,
    slug: id,
    title,
    description: "",
    group: "mine",
    ownerName: "",
    publishedVersionNo: 1,
    tagChips: tags.map(chip),
});
const SKILLS = [
    skill("k1", "Weekly numbers", "dashboard", "product"),
    skill("k2", "Release notes", "product"),
    skill("k3", "Support digest", "dashboard", "support"),
    skill("k4", "Plain one"),
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

const stored = (jobKey: string, params: Record<string, string>): Schedule => ({
    id: "s1",
    name: "My page",
    job: jobKey,
    jobTitle: jobKey,
    params,
    when: "",
    frequency: "daily",
    timeOfDay: "09:00",
    enabled: true,
    deliverPush: false,
    nextRun: null,
    lastRun: null,
    lastStatus: null,
});

const renderForm = (jobs: ScheduleJob[], schedule: Schedule | null = null) =>
    rtlRender(
        <CssVarsProvider>
            <HashMentionDataProvider value={mention()}>
                <ScheduleFormPanel
                    jobs={jobs}
                    schedule={schedule}
                    timeZone="Asia/Tokyo"
                    onCancel={() => {}}
                    onSubmit={vi.fn(async () => ({ ok: true as const }))}
                />
            </HashMentionDataProvider>
        </CssVarsProvider>
    );

const s = () => getMessages().settings.schedules;
const box = () => screen.getByRole("combobox", { name: new RegExp(`^${s().paramSkill}`) });
const hint = () => screen.queryByTestId("skill-dashboard-hint");

/** A new dashboard made by a skill, once its list has arrived. */
const newSkillDashboard = async (user: ReturnType<typeof userEvent.setup>) => {
    renderForm([DASHBOARD]);
    await user.click(screen.getByRole("combobox", { name: s().paramSource }));
    await user.click(await screen.findByRole("option", { name: s().sourceSkill }));
    await waitFor(() => expect(box()).toHaveTextContent(s().skillPlaceholder));
};
const listed = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(box());
    const options = await screen.findAllByRole("option");
    const titles = options.map((o) => within(o).getAllByText(/./)[0].textContent);
    await user.keyboard("{Escape}");
    return titles;
};

beforeEach(() => {
    fetchRunnableSkills.mockReset();
    fetchRunnableSkills.mockResolvedValue({ ok: true, data: SKILLS });
});

describe("the dashboard form", () => {
    it("lists only the skills tagged dashboard", async () => {
        const user = userEvent.setup();
        await newSkillDashboard(user);
        expect(await listed(user)).toEqual(["Weekly numbers", "Support digest"]);
    });

    it("offers the other tags to narrow by, not dashboard itself", async () => {
        const user = userEvent.setup();
        await newSkillDashboard(user);
        const filter = screen.getByTestId("skill-tag-filter");
        expect(
            within(filter)
                .getAllByRole("button")
                .map((b) => b.textContent)
        ).toEqual(["product", "support"]);
        await user.click(within(filter).getByRole("button", { name: "support" }));
        expect(await listed(user)).toEqual(["Support digest"]);
    });

    it("keeps the stored untagged skill listed and chosen, also after another is picked", async () => {
        const user = userEvent.setup();
        renderForm([DASHBOARD], stored("ai_dashboard", { source: "skill", skill_id: "k2" }));
        await waitFor(() => expect(box()).toHaveTextContent("Release notes"));
        expect(await listed(user)).toEqual(["Weekly numbers", "Release notes", "Support digest"]);
        await user.click(box());
        await user.click(await screen.findByRole("option", { name: /Weekly numbers/ }));
        expect(await listed(user)).toContain("Release notes");
    });

    it("says how to add a skill while the list is short", async () => {
        const user = userEvent.setup();
        await newSkillDashboard(user);
        expect(hint()).toHaveTextContent(s().skillDashboardHint);
    });

    it("says nothing once five skills carry the tag", async () => {
        fetchRunnableSkills.mockResolvedValue({
            ok: true,
            data: [1, 2, 3, 4, 5].map((n) => skill(`d${n}`, `Board ${n}`, "dashboard")),
        });
        const user = userEvent.setup();
        await newSkillDashboard(user);
        expect(hint()).toBeNull();
    });

    it("says that no skill has the tag when none does", async () => {
        fetchRunnableSkills.mockResolvedValue({ ok: true, data: [skill("k4", "Plain one")] });
        const user = userEvent.setup();
        await newSkillDashboard(user);
        await user.click(box());
        expect(await screen.findByRole("option", { name: s().skillDashboardNone })).toBeTruthy();
        expect(hint()).toHaveTextContent(s().skillDashboardHint);
    });
});

describe("Run a skill", () => {
    it("lists every skill, as before, with no line about the tag", async () => {
        const user = userEvent.setup();
        renderForm([RUN_SKILL], stored("run_skill", { skill_id: "k1" }));
        await waitFor(() => expect(box()).toHaveTextContent("Weekly numbers"));
        expect(await listed(user)).toEqual([
            "Weekly numbers",
            "Release notes",
            "Support digest",
            "Plain one",
        ]);
        expect(hint()).toBeNull();
        const filter = screen.getByTestId("skill-tag-filter");
        expect(within(filter).getByRole("button", { name: "dashboard" })).toBeTruthy();
    });
});

describe("the strings", () => {
    it("exist in all seven locales and name the tag as it is typed", () => {
        for (const locale of [ar, es, fr, hi, ja, zh]) {
            const t = locale.settings?.schedules;
            for (const key of ["skillDashboardNone", "skillDashboardHint"] as const) {
                expect(t?.[key]).toContain("dashboard");
                expect(t?.[key]).not.toBe(en.settings.schedules[key]);
            }
        }
    });
});
