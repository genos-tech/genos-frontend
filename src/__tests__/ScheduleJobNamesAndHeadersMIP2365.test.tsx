/**
 * MIP-2365: on the schedule form
 *   1. the report names and descriptions are worded in the member's language (the API's job
 *      catalog sends English only; the built-in jobs are mapped by key to `jobCatalog`), and
 *   2. the milestone dropdown's project group headers show the project's own avatar, as the
 *      Project updates picker does.
 *
 * jsdom draws no layout: the look at 1440 / 1024 / 390 was checked in a browser.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SchedulesSection } from "../components/layout/schedules/SchedulesSection";
import { HashMentionDataProvider, type HashMentionData } from "../context/HashMentionDataContext";
import { localizeJob } from "../features/schedules/scheduleParams";
import { I18nProvider, loadLocale, type Messages } from "../i18n";
import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";

vi.setConfig({ testTimeout: 30000 });

const E = en.settings.schedules;
// The raw catalogs are partial (a locale may ship a key late); these tests want them whole.
const whole = (l: unknown) => (l as Messages).settings.schedules;
const J = whole(ja);

vi.mock("../context/authState", () => ({ useAuth: () => ({ accessToken: "tok" }) }));

const listSchedules = vi.fn();
vi.mock("../services/schedules", () => ({
    listSchedules: (...a: unknown[]) => listSchedules(...a),
    createSchedule: vi.fn(),
    updateSchedule: vi.fn(),
    deleteSchedule: vi.fn(),
    runScheduleNow: vi.fn(),
}));

vi.mock("../features/tasks/sprint-milestone/services/loadProjectMilestones", () => ({
    loadProjectMilestones: async (projectId: number) => ({
        milestones: projectId === 11 ? [{ milestoneId: 501, title: "Launch", status: "WIP" }] : [],
    }),
}));

const AVATAR = "https://cdn.test/apollo.png";

const mention = (): HashMentionData =>
    ({
        tasks: [],
        notes: [],
        chats: [],
        allChats: [{ chatType: 3, project: { projectId: 11 }, profileImagePath: AVATAR }],
        projects: [{ projectId: 11, projectName: "Apollo", projectTags: [], isJoined: true }],
        todoGroups: [],
        myself: null,
        refresh: () => {},
    }) as unknown as HashMentionData;

// What the API sends: English, always.
const JOBS = [
    {
        job: "project_updates",
        title: "Project updates",
        description: "What changed in one project, as a short report.",
        params: { project_id: { type: "integer", minimum: 1, required: true } },
    },
    {
        job: "milestone_updates",
        title: "Milestone updates",
        description: "One milestone.",
        params: { milestone_id: { type: "integer", minimum: 1, required: true } },
    },
    {
        job: "future_job",
        title: "A future job",
        description: "Added on the server later.",
        params: {},
    },
];

beforeEach(() => {
    window.localStorage.removeItem("genos-locale");
    listSchedules.mockResolvedValue({
        timeZone: "Asia/Tokyo",
        limit: 20,
        jobs: JOBS,
        schedules: [],
        suggestions: [],
    });
});
afterEach(cleanup);

const mountIn = async (locale: "en" | "ja") => {
    await loadLocale(locale);
    window.localStorage.setItem("genos-locale", locale);
    return render(
        <CssVarsProvider>
            <I18nProvider>
                <HashMentionDataProvider value={mention()}>
                    <SchedulesSection teamId="t1" />
                </HashMentionDataProvider>
            </I18nProvider>
        </CssVarsProvider>
    );
};

describe("report names and descriptions follow the locale", () => {
    it("shows Japanese names in the Report dropdown and the description under it", async () => {
        await mountIn("ja");
        const user = userEvent.setup();
        await user.click(await screen.findByRole("button", { name: J.createFirst }));
        await user.click(screen.getByRole("combobox", { name: J.job }));

        const names = J.jobCatalog;
        expect(
            await screen.findByRole("option", { name: names.project_updates.title })
        ).toBeTruthy();
        expect(screen.getByRole("option", { name: names.milestone_updates.title })).toBeTruthy();
        // a job the server added keeps its own words
        expect(screen.getByRole("option", { name: "A future job" })).toBeTruthy();
        expect(screen.queryByRole("option", { name: "Project updates" })).toBeNull();

        await user.click(screen.getByRole("option", { name: names.milestone_updates.title }));
        expect(screen.getByText(names.milestone_updates.description)).toBeTruthy();
        expect(screen.queryByText("One milestone.")).toBeNull();
    });

    it("names a saved schedule's report in the member's language too", async () => {
        listSchedules.mockResolvedValue({
            timeZone: "Asia/Tokyo",
            limit: 20,
            jobs: JOBS,
            schedules: [
                {
                    id: "s1",
                    name: "Mon",
                    job: "project_updates",
                    jobTitle: "Project updates",
                    params: {},
                    when: "x",
                    frequency: "daily",
                    timeOfDay: "09:00",
                    enabled: true,
                    deliverPush: false,
                    nextRun: null,
                    lastRun: null,
                    lastStatus: null,
                },
            ],
            suggestions: [],
        });
        await mountIn("ja");
        expect(await screen.findByText(J.jobCatalog.project_updates.title)).toBeTruthy();
        expect(screen.queryByText("Project updates")).toBeNull();
    });

    it("has a name and a description in every locale for every built-in job", () => {
        const keys = Object.keys(E.jobCatalog);
        expect(keys.length).toBe(10);
        for (const [name, loc] of Object.entries({ ar, es, fr, hi, ja, zh })) {
            for (const k of keys) {
                const row = whole(loc).jobCatalog[k as keyof typeof E.jobCatalog];
                expect(row.title.trim(), `${name}.${k}.title`).not.toBe("");
                expect(row.description.trim(), `${name}.${k}.description`).not.toBe("");
                expect(row.title, `${name}.${k}.title is still English`).not.toBe(
                    E.jobCatalog[k as keyof typeof E.jobCatalog].title
                );
            }
        }
    });

    it("leaves an unlisted job (even one named like a prototype key) untouched", () => {
        const job = { job: "constructor", title: "T", description: "D", params: {} };
        expect(localizeJob(job, E)).toBe(job);
    });
});

describe("milestone dropdown group headers", () => {
    it("show the project's own avatar", async () => {
        await mountIn("en");
        const user = userEvent.setup();
        await user.click(await screen.findByRole("button", { name: E.createFirst }));
        await user.click(screen.getByRole("combobox", { name: "Report" }));
        await user.click(await screen.findByRole("option", { name: "Milestone updates" }));
        await user.click(await screen.findByPlaceholderText("Choose a milestone"));

        const list = await screen.findByRole("listbox");
        const header = (await within(list).findByText("Apollo")).closest("li");
        expect(header).toBeTruthy();
        const img = header!.querySelector("img");
        expect(img?.getAttribute("src")).toBe(AVATAR);
    });
});
