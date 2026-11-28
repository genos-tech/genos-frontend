/**
 * The rule builder's values are picked with the task view's own pickers (MIP-2591): each one
 * writes what the rule saves, and none of them touches anything outside the rule.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AutomationRule } from "../features/tasks/automation/types";
import { ModalProjectStatuses } from "../features/tasks/components/statuses/ModalProjectStatuses";
import { __resetProjectStatusesStore } from "../hooks/tasks/useProjectStatuses";
import { en } from "../i18n/locales/en";
import { UserProps } from "../types/admin";
import { ProjectProps } from "../types/tasks";

vi.mock("../components/ui/avatars/UserAvatar", () => ({
    UserAvatar: ({ userId }: { userId?: string }) => <i data-avatar={userId ?? ""} />,
}));
vi.mock("../components/ui/avatars/avatarWithStatus", () => ({ AvatarWithStatus: () => null }));
vi.mock("../context/authState", () => ({ useAuth: () => ({ accessToken: "t" }) }));
vi.mock("../features/tasks/services/projectStatuses", () => ({
    loadProjectStatuses: vi.fn().mockResolvedValue({ statuses: [], canManage: true }),
}));
vi.mock("../features/tasks/services/projectCustomFields", () => ({
    loadProjectCustomFields: vi.fn().mockResolvedValue({ fields: [], canManage: true }),
}));
vi.mock("../features/tasks/sprint-milestone/services/loadProjectSprints", () => ({
    loadProjectSprints: vi.fn().mockResolvedValue({ sprints: [] }),
}));
const milestone = (milestoneId: number, title: string, status: string) => ({
    milestoneId,
    title,
    status,
    projectId: 7,
    sprintId: null,
    taskId: milestoneId * 10,
    assignees: [],
});
vi.mock("../features/tasks/sprint-milestone/services/loadProjectMilestones", () => ({
    loadProjectMilestones: vi.fn(async () => ({
        milestones: [milestone(3, "Launch", "Open"), milestone(4, "Dropped", "Rejected")],
    })),
}));

const api = { loadRules: vi.fn(), dryRunRule: vi.fn() };
vi.mock("../features/tasks/automation/service", () => ({
    loadRules: (...a: unknown[]) => api.loadRules(...a),
    dryRunRule: (...a: unknown[]) => api.dryRunRule(...a),
}));

const words = en.tasks.automation;

const project = (projectId: number, projectName: string, isPrivate = false): ProjectProps => ({
    projectId,
    projectName,
    projectTags: [
        { tagName: "tag-a", tagColor: "#111111", tagTextColor: "" },
        { tagName: "tag-b", tagColor: "#222222", tagTextColor: "" },
    ],
    isJoined: true,
    isPrivate,
});

const person = (userId: string, userName: string) =>
    ({ userId, userName, userEmail: `${userId}@x.test` }) as UserProps;

const rule = (extra: Partial<AutomationRule> = {}): AutomationRule => ({
    ruleId: 1,
    name: "Hand over",
    position: 0,
    enabled: true,
    disabledReason: "",
    triggerType: "status_changed",
    triggerValue: { status: "WIP" },
    conditions: [
        { field: "tag", op: "is", value: "tag-a" },
        { field: "priority", op: "is", value: "Low" },
        { field: "milestone", op: "is", value: 3 },
        { field: "reporter", op: "is", value: "me" },
    ],
    movesTask: true,
    destination: { projectId: 8, name: "Delivery", visible: true },
    setStatus: "Open",
    setCustomStatusId: null,
    setAssigneeId: "me",
    addTag: "tag-a",
    ownerId: "me",
    ...extra,
});

const openEditor = async (projects: ProjectProps[], saved = rule()) => {
    api.loadRules.mockResolvedValue({ ok: true, data: { rules: [saved], planAllows: true } });
    api.dryRunRule.mockResolvedValue({
        ok: true,
        data: { matched: 0, truncated: false, items: [] },
    });
    render(
        <MemoryRouter>
            <CssVarsProvider>
                <ModalProjectStatuses
                    projectId={7}
                    automation={{
                        projects,
                        members: [person("me", "Mia"), person("bo", "Bo")],
                        myself: person("me", "Mia"),
                        profiles: {},
                        chats: [],
                    }}
                    open
                    onClose={vi.fn()}
                />
            </CssVarsProvider>
        </MemoryRouter>
    );
    fireEvent.click(screen.getByRole("tab", { name: new RegExp(words.tabAutomation) }));
    await screen.findByTestId("project-automation");
    fireEvent.click(document.querySelector<HTMLElement>('button[data-slot="rule-1"]')!);
    return screen.findByTestId("rule-clauses");
};

const slot = (id: string) => document.querySelector<HTMLInputElement>(`[data-slot="${id}"]`)!;

/** The condition values, in the rule's order (their keys are not stable). */
const conditionSlot = (n: number) =>
    document.querySelectorAll<HTMLInputElement>('[data-slot^="condition-value-"]')[n];

const options = async (input: HTMLInputElement) => {
    fireEvent.focus(input);
    fireEvent.mouseDown(input);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    return within(await screen.findByRole("listbox")).getAllByRole("option");
};

const pick = async (input: HTMLInputElement, text: RegExp) => {
    const option = (await options(input)).find((o) => text.test(o.textContent ?? ""));
    expect(option, String(text)).toBeTruthy();
    fireEvent.click(option!);
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
};

const sent = async () => {
    fireEvent.click(screen.getByRole("button", { name: words.preview }));
    await waitFor(() => expect(api.dryRunRule).toHaveBeenCalled());
    return api.dryRunRule.mock.calls[0][1];
};

beforeEach(() => {
    __resetProjectStatusesStore();
    Object.values(api).forEach((f) => f.mockReset());
});
afterEach(cleanup);

describe("the rule builder's pickers", { timeout: 30_000 }, () => {
    const projects = [project(7, "Intake"), project(8, "Delivery"), project(9, "Support")];

    it("shows saved values as the task view does and saves the new picks", async () => {
        const editor = await openEditor(projects);
        // Chips and avatars, not bare names.
        expect(editor.querySelector('[title="tag-a"] [aria-hidden="true"]')).toBeTruthy();
        expect(editor.querySelector('[data-avatar="me"]')).toBeTruthy();
        await waitFor(() => expect(conditionSlot(2).value).toBe("Launch"));
        expect(slot("move").value).toBe("Delivery");

        await pick(slot("trigger"), /Pending/);
        await pick(conditionSlot(0), /tag-b/);
        await pick(conditionSlot(1), /Critical/);
        await pick(conditionSlot(3), /Bo/);
        await pick(slot("status"), /Blocked/);
        await pick(slot("assignee"), /Bo/);
        await pick(slot("tag"), /tag-b/);

        expect(await sent()).toMatchObject({
            trigger_value: { status: "Pending" },
            conditions: [
                { field: "tag", value: "tag-b" },
                { field: "priority", value: "Critical" },
                { field: "milestone", value: 3 },
                { field: "reporter", value: "bo" },
            ],
            destination_project_id: 8,
            set_status: "Blocked",
            set_custom_status_id: null,
            set_assignee_id: "bo",
            add_tag: "tag-b",
        });
    });

    it("offers no Deleted status and no finished milestone", async () => {
        await openEditor(projects);
        const statuses = (await options(slot("status"))).map((o) => o.textContent);
        expect(statuses).toContain("Rejected");
        expect(statuses).not.toContain("Deleted");
        fireEvent.keyDown(slot("status"), { key: "Escape" });
        await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());

        await waitFor(() => expect(conditionSlot(2).value).toBe("Launch"));
        const milestones = (await options(conditionSlot(2))).map((o) => o.textContent);
        expect(milestones).toHaveLength(1);
        expect(milestones[0]).toContain("Launch");
    });

    it("picks a destination, never this project, and drops the old one's tag", async () => {
        await openEditor(projects);
        const names = (await options(slot("move"))).map((o) => o.textContent);
        expect(names.join()).not.toContain("Intake");
        fireEvent.keyDown(slot("move"), { key: "Escape" });
        await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());

        await pick(slot("move"), /Support/);
        expect(slot("tag").value).toBe("");
        expect(document.querySelector('[data-slot="tag"]')).toBeTruthy();
    });

    it("lists a public project as refused for a private source, with why", async () => {
        await openEditor([
            project(7, "Intake", true),
            project(8, "Delivery", true),
            project(9, "Open"),
        ]);
        const refused = (await options(slot("move"))).find((o) =>
            o.textContent?.includes(words.privateOnly)
        );
        expect(refused?.getAttribute("aria-disabled")).toBe("true");
    });

    it("leaves anyone as the empty assignee trigger", async () => {
        await openEditor(projects, rule({ triggerType: "assignee_changed", triggerValue: {} }));
        expect(slot("trigger").getAttribute("placeholder")).toBe(words.anyone);
        await pick(slot("trigger"), /Bo/);
        expect((await sent()).trigger_value).toEqual({ assignee_id: "bo" });
    });
});
