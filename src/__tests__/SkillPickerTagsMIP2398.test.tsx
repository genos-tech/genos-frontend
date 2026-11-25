/**
 * MIP-2398: where a skill is chosen it shows its tags as chips, and the schedule form's skill
 * picker can be narrowed by tag. The built-in `template` tag marks an official template.
 *
 * Pinned: the picker offers each tag once, template first; every option carries its chips; ticking a
 * tag narrows the list, a second tag narrows it further (a skill must carry all of them), no match
 * says so, unticking brings the list back; the skill already chosen is never dropped by a filter; a
 * server that sends no tags draws no filter; the `/` menu's skill rows carry the chips too.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { render as rtlRender, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SchedulesSection } from "../components/layout/schedules/SchedulesSection";
import { HashMentionDataProvider, type HashMentionData } from "../context/HashMentionDataContext";
import { MentionSuggestionDropdown } from "../features/agentQA/mentions/MentionSuggestionDropdown";
import type { AgentMentionCandidate } from "../features/agentQA/mentions/types";
import { listSchedules } from "../services/schedules";

vi.setConfig({ testTimeout: 30000 });

vi.mock("../context/authState", () => ({
    useAuth: () => ({ accessToken: "tok" }),
    useOptionalAccessToken: () => "tok",
}));
vi.mock("../services/schedules", () => ({
    listSchedules: vi.fn(),
    createSchedule: vi.fn(),
    updateSchedule: vi.fn(),
    deleteSchedule: vi.fn(),
    runScheduleNow: vi.fn(),
}));

const fetchRunnableSkills = vi.fn();
vi.mock("../features/genos/skills/skillsApi", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../features/genos/skills/skillsApi")>()),
    fetchRunnableSkills: (...a: unknown[]) => fetchRunnableSkills(...a),
}));

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
const render = (ui: React.ReactElement) =>
    rtlRender(
        <CssVarsProvider>
            <HashMentionDataProvider value={mention()}>{ui}</HashMentionDataProvider>
        </CssVarsProvider>
    );

const TEMPLATE = { name: "template", color: "#6a5acd", textColor: "white" };
const PRODUCT = { name: "product", color: "#808080", textColor: "white" };
const SALES = { name: "sales", color: "#2e8b57", textColor: "white" };

const skill = (id: string, title: string, tagChips: object[], group = "official") => ({
    id,
    slug: id,
    title,
    description: "",
    group,
    ownerName: "",
    publishedVersionNo: 1,
    tagChips,
});
const SKILLS = [
    skill("k1", "Weekly review", [], "mine"),
    skill("k2", "Status report", [TEMPLATE, PRODUCT]),
    skill("k3", "Release notes", [TEMPLATE, PRODUCT]),
    skill("k4", "Call follow-up", [TEMPLATE, SALES]),
];

const JOBS = [
    {
        job: "run_skill",
        title: "Run a skill",
        description: "Runs one of your skills on this schedule.",
        usesAi: true,
        effortDefault: "medium",
        effortCost: null,
        params: {
            skill_id: { type: "string", required: true },
            version_no: { type: "integer", minimum: 1 },
            input: { type: "string" },
        },
    },
];

beforeEach(() => {
    vi.mocked(listSchedules).mockReset();
    fetchRunnableSkills.mockReset();
    vi.mocked(listSchedules).mockResolvedValue({
        timeZone: "Asia/Tokyo",
        limit: 20,
        jobs: JOBS,
        schedules: [],
        suggestions: [],
    } as never);
    fetchRunnableSkills.mockResolvedValue({ ok: true, data: SKILLS });
});

const openPicker = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(
        await screen.findByRole("button", { name: /New schedule|Create your first schedule/ })
    );
    await user.click(screen.getByRole("combobox", { name: "Report" }));
    await user.click(await screen.findByRole("option", { name: "Run a skill" }));
    await waitFor(() => expect(fetchRunnableSkills).toHaveBeenCalled());
    return screen.findByRole("combobox", { name: "Skill" });
};
const filter = () => screen.findByTestId("skill-tag-filter");
const tick = async (user: ReturnType<typeof userEvent.setup>, name: string) =>
    user.click(within(await filter()).getByRole("button", { name }));
const titles = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole("combobox", { name: "Skill" }));
    const options = await screen.findAllByRole("option");
    return options.map((o) => within(o).getAllByText(/./)[0].textContent);
};

describe("the filter above the picker", () => {
    it("offers each tag once, template first", async () => {
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await openPicker(user);
        const names = within(await filter())
            .getAllByRole("button")
            .map((b) => b.textContent);
        expect(names).toEqual(["template", "product", "sales"]);
        expect(
            within(await filter())
                .getAllByRole("button")
                .every((b) => b.getAttribute("aria-pressed") === "false")
        ).toBe(true);
    });

    it("is not drawn when no skill has a tag", async () => {
        fetchRunnableSkills.mockResolvedValue({
            ok: true,
            data: [skill("k1", "Weekly review", [], "mine")],
        });
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await openPicker(user);
        expect(screen.queryByTestId("skill-tag-filter")).toBeNull();
    });
});

describe("the options", () => {
    it("carry their tag chips", async () => {
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await openPicker(user);
        await user.click(screen.getByRole("combobox", { name: "Skill" }));
        const status = await screen.findByRole("option", { name: /Status report/ });
        expect(within(status).getByText("template")).toBeTruthy();
        expect(within(status).getByText("product")).toBeTruthy();
        const plain = screen.getByRole("option", { name: /Weekly review/ });
        expect(within(plain).queryByText("template")).toBeNull();
    });
});

describe("narrowing", () => {
    it("ticking a tag keeps only the skills that carry it", async () => {
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await openPicker(user);
        await tick(user, "template");
        expect(await titles(user)).toEqual(["Status report", "Release notes", "Call follow-up"]);
    });

    it("a second tag narrows it further: a skill must carry all of them", async () => {
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await openPicker(user);
        await tick(user, "template");
        await tick(user, "product");
        expect(await titles(user)).toEqual(["Status report", "Release notes"]);
    });

    it("says so when no skill has all the ticked tags, and unticking brings the list back", async () => {
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await openPicker(user);
        await tick(user, "product");
        await tick(user, "sales");
        await user.click(screen.getByRole("combobox", { name: "Skill" }));
        expect(
            await screen.findByRole("option", { name: /No skill has all of these tags/ })
        ).toBeTruthy();
        await user.click(screen.getByRole("combobox", { name: "Skill" })); // close it again
        await tick(user, "sales");
        expect(await titles(user)).toEqual(["Status report", "Release notes"]);
        await user.click(screen.getByRole("combobox", { name: "Skill" })); // close it again
        await tick(user, "product");
        expect(await titles(user)).toEqual([
            "Weekly review",
            "Status report",
            "Release notes",
            "Call follow-up",
        ]);
    });

    it("never drops the skill that is already chosen", async () => {
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await openPicker(user);
        await user.click(screen.getByRole("combobox", { name: "Skill" }));
        await user.click(await screen.findByRole("option", { name: /Weekly review/ }));
        await tick(user, "template");
        const list = await titles(user);
        expect(list).toContain("Weekly review");
        expect(list).toContain("Status report");
    });
});

describe("the / menu", () => {
    const cand = (id: string, title: string, skillTags?: { name: string; color: string }[]) =>
        ({
            ref: { kind: "skill", skillId: id, label: id },
            trigger: "/",
            key: `skill:${id}`,
            skillGroup: "official",
            skillTitle: title,
            skillTags,
        }) as AgentMentionCandidate;

    it("shows a skill's tags on its row", () => {
        const anchor = document.createElement("div");
        document.body.appendChild(anchor);
        rtlRender(
            <CssVarsProvider>
                <MentionSuggestionDropdown
                    anchorRef={{ current: anchor }}
                    ariaLabel="Skills"
                    highlightIndex={0}
                    placement="above"
                    suggestions={[
                        cand("a", "Status report", [
                            { name: "template", color: "#6a5acd" },
                            { name: "product", color: "#808080" },
                            { name: "extra", color: "#808080" },
                        ]),
                        cand("b", "Plain one"),
                    ]}
                    onSelect={() => undefined}
                />
            </CssVarsProvider>
        );
        const tagged = screen.getByTestId("agent-mention-option-skill:a");
        expect(tagged.textContent).toContain("template");
        expect(tagged.textContent).toContain("product");
        // At most two, so a long title keeps its room.
        expect(tagged.textContent).not.toContain("extra");
        expect(screen.getByTestId("agent-mention-option-skill:b").textContent).not.toContain(
            "template"
        );
    });
});
