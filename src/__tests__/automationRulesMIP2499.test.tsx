/**
 * The rule builder (MIP-2499): a rule reads as a sentence, nothing is saved or turned on
 * without its dry run, the server's refusals show where they belong, and a Free member can
 * still turn a rule off.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    definitionOf,
    draftOf,
    emptyDraft,
    missingParts,
    withDestination,
    withTarget,
} from "../features/tasks/automation/draft";
import { statusPickOf } from "../features/tasks/automation/lookups";
import type { AutomationRule } from "../features/tasks/automation/types";
import { wordsFor } from "../features/tasks/automation/words";
import { ModalProjectStatuses } from "../features/tasks/components/statuses/ModalProjectStatuses";
import { __resetProjectStatusesStore } from "../hooks/tasks/useProjectStatuses";
import { en } from "../i18n/locales/en";
import { UserProps } from "../types/admin";
import { ProjectProps, ProjectStatusDef } from "../types/tasks";

vi.mock("../components/ui/avatars/UserAvatar", () => ({ UserAvatar: () => null }));
vi.mock("../context/authState", () => ({ useAuth: () => ({ accessToken: "t" }) }));
vi.mock("../features/tasks/services/projectStatuses", () => ({
    loadProjectStatuses: vi.fn().mockResolvedValue({ statuses: [], canManage: true }),
    reorderProjectStatuses: vi.fn(),
    deleteProjectStatus: vi.fn(),
    createProjectStatus: vi.fn(),
    updateProjectStatus: vi.fn(),
}));
vi.mock("../features/tasks/services/projectCustomFields", () => ({
    loadProjectCustomFields: vi.fn().mockResolvedValue({ fields: [], canManage: true }),
}));
vi.mock("../features/tasks/sprint-milestone/services/loadProjectSprints", () => ({
    loadProjectSprints: vi.fn().mockResolvedValue({ sprints: [] }),
}));
vi.mock("../features/tasks/sprint-milestone/services/loadProjectMilestones", () => ({
    loadProjectMilestones: vi.fn().mockResolvedValue({ milestones: [] }),
}));

const api = {
    loadRules: vi.fn(),
    createRule: vi.fn(),
    updateRule: vi.fn(),
    deleteRule: vi.fn(),
    orderRules: vi.fn(),
    dryRunRule: vi.fn(),
    loadRuleRuns: vi.fn(),
};
vi.mock("../features/tasks/automation/service", () => ({
    loadRules: (...a: unknown[]) => api.loadRules(...a),
    createRule: (...a: unknown[]) => api.createRule(...a),
    updateRule: (...a: unknown[]) => api.updateRule(...a),
    deleteRule: (...a: unknown[]) => api.deleteRule(...a),
    orderRules: (...a: unknown[]) => api.orderRules(...a),
    dryRunRule: (...a: unknown[]) => api.dryRunRule(...a),
    loadRuleRuns: (...a: unknown[]) => api.loadRuleRuns(...a),
}));

const words = en.tasks.automation;

const rule = (extra: Partial<AutomationRule> = {}): AutomationRule => ({
    ruleId: 1,
    name: "Hand over",
    position: 0,
    enabled: true,
    disabledReason: "",
    triggerType: "status_changed",
    triggerValue: { status: "WIP" },
    conditions: [{ field: "tag", op: "is", value: "tag-a" }],
    movesTask: true,
    destination: { projectId: 8, name: "Delivery", visible: true },
    setStatus: "Open",
    setCustomStatusId: null,
    setAssigneeId: null,
    addTag: null,
    ownerId: "me",
    ...extra,
});

const project = (projectId: number, projectName: string): ProjectProps => ({
    projectId,
    projectName,
    projectTags: [{ tagName: "tag-a", tagColor: "", tagTextColor: "" }],
    isJoined: true,
});

const open = () =>
    render(
        <MemoryRouter>
            <CssVarsProvider>
                <ModalProjectStatuses
                    projectId={7}
                    automation={{
                        projects: [project(7, "Intake"), project(8, "Delivery")],
                        members: [],
                        myself: { userId: "me", userName: "Me" } as UserProps,
                        profiles: {},
                        chats: [],
                    }}
                    open
                    onClose={vi.fn()}
                />
            </CssVarsProvider>
        </MemoryRouter>
    );

const openRules = async (rules: AutomationRule[], planAllows = true) => {
    api.loadRules.mockResolvedValue({ ok: true, data: { rules, planAllows } });
    open();
    fireEvent.click(screen.getByRole("tab", { name: new RegExp(words.tabAutomation) }));
    return screen.findByTestId("project-automation");
};

/** The rule's own row button (its menu is named after the rule too). */
const rowButton = () => document.querySelector<HTMLElement>('button[data-slot="rule-1"]');

const dryRun = (items: { outcome: string; reason: string }[]) =>
    api.dryRunRule.mockResolvedValue({
        ok: true,
        data: {
            matched: items.length,
            truncated: false,
            items: items.map((item, i) => ({
                taskId: i + 1,
                displayId: `IN-${i + 1}`,
                title: `Task ${i + 1}`,
                status: "WIP",
                ...item,
            })),
        },
    });

beforeEach(() => {
    __resetProjectStatusesStore();
    Object.values(api).forEach((f) => f.mockReset());
});
afterEach(cleanup);

describe("what a draft sends", () => {
    it("round-trips a saved rule", () => {
        const sent = definitionOf(draftOf(rule()), "Hand over");
        expect(sent).toEqual({
            name: "Hand over",
            applies_to: "task",
            trigger_type: "status_changed",
            trigger_value: { status: "WIP" },
            conditions: [{ field: "tag", op: "is", value: "tag-a" }],
            destination_project_id: 8,
            set_status: "Open",
            set_custom_status_id: null,
            set_assignee_id: null,
            add_tag: "",
        });
    });

    it("keeps a project's own status by id, in the trigger and the action", () => {
        const sent = definitionOf(
            draftOf(
                rule({
                    triggerValue: { custom_status_id: 4 },
                    setStatus: "WIP",
                    setCustomStatusId: 9,
                })
            ),
            "x"
        );
        expect(sent.trigger_value).toEqual({ custom_status_id: 4 });
        expect([sent.set_status, sent.set_custom_status_id]).toEqual(["WIP", 9]);
    });

    it("drops the old destination's own status and tag", () => {
        const draft = {
            ...draftOf(rule({ addTag: "tag-a" })),
            setStatus: { category: "WIP", customStatusId: 9 },
        };
        const moved = withDestination(draft, 12);
        expect([moved.setStatus, moved.addTag]).toEqual([null, ""]);
        expect(withDestination(draft, 8)).toBe(draft);
    });

    it("names what is still empty", () => {
        expect(missingParts(emptyDraft())).toEqual(["trigger", "move"]);
    });

    it("saves a category's built-in as the category and any other row by itself", () => {
        const row = (statusId: number, builtinKey: string | null) =>
            ({ statusId, builtinKey, category: "WIP" }) as ProjectStatusDef;
        const rows = [row(1, "WIP"), row(2, null)];
        expect(statusPickOf("WIP", 1, rows)).toEqual({ category: "WIP", customStatusId: null });
        expect(statusPickOf("WIP", 2, rows)).toEqual({ category: "WIP", customStatusId: 2 });
        expect(statusPickOf("Closed", undefined, [])).toEqual({
            category: "Closed",
            customStatusId: null,
        });
    });
});

describe("the Automation tab", () => {
    it("reads each rule as a sentence and counts the ones turned off for a reason", async () => {
        const pane = await openRules([
            rule(),
            rule({
                ruleId: 2,
                name: "Broken",
                enabled: false,
                disabledReason: "destination_archived",
            }),
        ]);
        const sentence = within(pane).getAllByTestId("rule-sentence")[0];
        expect(sentence.textContent).toBe(
            "When status becomes WIP, if tag is tag-a, then move to Delivery and set status to Open."
        );
        expect(within(pane).getByTestId("rule-turned-off").textContent).toContain(
            words.reason.destination_archived
        );
        expect(
            screen.getByRole("tab", { name: new RegExp(words.tabAutomation) }).textContent
        ).toContain("1");
    });

    it("turns a rule off at once, and on only after its dry run", async () => {
        api.updateRule.mockResolvedValue({ ok: true, data: rule() });
        await openRules([rule()]);
        fireEvent.click(screen.getByRole("switch"));
        await waitFor(() =>
            expect(api.updateRule).toHaveBeenCalledWith(7, 1, { enabled: false }, "t")
        );
        cleanup();
        api.updateRule.mockClear();

        dryRun([{ outcome: "would_apply", reason: "" }]);
        await openRules([rule({ enabled: false })]);
        fireEvent.click(screen.getByRole("switch"));
        expect(await screen.findByText("1 task matches right now")).toBeTruthy();
        expect(api.updateRule).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: words.turnOn }));
        await waitFor(() =>
            expect(api.updateRule).toHaveBeenCalledWith(7, 1, { enabled: true }, "t")
        );
    });

    it("does not offer to turn on a rule that cannot run, and says why", async () => {
        dryRun([{ outcome: "refused", reason: "readers_outside_source" }]);
        await openRules([rule({ enabled: false })]);
        fireEvent.click(screen.getByRole("switch"));
        expect((await screen.findByRole("alert")).textContent).toContain(
            words.reason.readers_outside_source
        );
        expect(screen.getByRole("button", { name: words.turnOn })).toHaveProperty(
            "disabled",
            true
        );
    });

    it("asks for what is missing before it asks the server", async () => {
        await openRules([]);
        fireEvent.click(await screen.findByRole("button", { name: words.newRule }));
        fireEvent.click(screen.getByRole("button", { name: words.preview }));
        expect(screen.getByText(words.errName)).toBeTruthy();
        expect(screen.getAllByText(words.errSlot)).toHaveLength(2);
        expect(api.dryRunRule).not.toHaveBeenCalled();
    });

    it("puts a server refusal back in the editor, in plain words", async () => {
        api.dryRunRule.mockResolvedValue({
            ok: false,
            code: "private_to_public",
            field: "destination_project_id",
        });
        await openRules([rule()]);
        fireEvent.click(rowButton()!);
        fireEvent.click(screen.getByRole("button", { name: words.preview }));
        expect((await screen.findByRole("alert")).textContent).toMatch(/^This project is private/);
        expect(screen.getByTestId("rule-clauses")).toBeTruthy();
    });

    it("saves an edited rule after the dry run, keeping it on", async () => {
        dryRun([{ outcome: "would_apply", reason: "" }]);
        api.updateRule.mockResolvedValue({ ok: true, data: rule() });
        await openRules([rule()]);
        fireEvent.click(rowButton()!);
        fireEvent.click(screen.getByRole("button", { name: words.preview }));
        await screen.findByText("1 task matches right now");
        fireEvent.click(screen.getByRole("button", { name: words.save }));
        await waitFor(() =>
            expect(api.updateRule).toHaveBeenCalledWith(
                7,
                1,
                expect.objectContaining({ name: "Hand over", enabled: true }),
                "t"
            )
        );
        expect(api.createRule).not.toHaveBeenCalled();
    });

    it("asks before dropping an edit", async () => {
        await openRules([rule()]);
        fireEvent.click(rowButton()!);
        fireEvent.change(screen.getByRole("textbox", { name: words.nameLabel }), {
            target: { value: "Something else" },
        });
        fireEvent.click(screen.getByRole("button", { name: words.back }));
        expect(await screen.findByText(words.discardTitle)).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: words.discard }));
        await waitFor(() => expect(rowButton()).toBeTruthy());
    });

    it("lets a rule whose destination is gone be given a new one, never turned on as it is", async () => {
        await openRules([
            rule({
                enabled: false,
                disabledReason: "destination",
                destination: { projectId: null, name: null, visible: false },
            }),
        ]);
        fireEvent.click(screen.getByRole("switch"));
        expect(await screen.findByTestId("rule-clauses")).toBeTruthy();
        expect(api.dryRunRule).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: words.preview }));
        expect(screen.getByText(words.errSlot)).toBeTruthy();
    });

    it("offers no preview from the menu while the destination is not named", async () => {
        await openRules([
            rule({
                enabled: false,
                disabledReason: "destination",
                destination: { projectId: null, name: null, visible: false },
            }),
        ]);
        fireEvent.click(screen.getByRole("button", { name: "More actions for Hand over" }));
        expect(await screen.findByRole("menuitem", { name: words.edit })).toBeTruthy();
        expect(screen.queryByRole("menuitem", { name: words.preview })).toBeNull();
    });

    it("says a deleted destination was deleted, and lets the rule be edited (MIP-2554)", async () => {
        const deleted = { projectId: null, name: null, visible: false, gone: true };
        const pane = await openRules([
            rule({ destination: deleted }),
            rule({
                ruleId: 2,
                name: "Off",
                enabled: false,
                disabledReason: "destination",
                destination: deleted,
            }),
        ]);
        const sentences = within(pane).getAllByTestId("rule-sentence");
        expect(sentences[0].textContent).toContain(words.aMoveGone);
        expect(sentences[0].textContent).not.toContain(words.aMoveHidden);
        expect(within(pane).getByTestId("rule-turned-off").textContent).toContain(
            words.reason.destination_gone
        );
        // Still enabled, never "hidden": its row opens the editor to choose a new destination.
        fireEvent.click(rowButton()!);
        expect(await screen.findByTestId("rule-clauses")).toBeTruthy();
    });

    it("keeps the hidden wording for a destination the reader is not on (MIP-2554)", async () => {
        const pane = await openRules([
            rule({
                destination: { projectId: null, name: null, visible: false, gone: false },
            }),
        ]);
        expect(within(pane).getByTestId("rule-sentence").textContent).toContain(words.aMoveHidden);
        expect(rowButton()).toBeNull();
    });

    it("drops the destination's own values when the move is removed", async () => {
        dryRun([]);
        await openRules([rule({ addTag: "tag-a" })]);
        fireEvent.click(rowButton()!);
        fireEvent.click(screen.getByRole("button", { name: `Remove action: ${words.rowMove}` }));
        // The tag was one of the destination's: it has to be chosen again, from here.
        fireEvent.click(screen.getByRole("button", { name: words.preview }));
        expect(screen.getByText(words.errSlot)).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: `Remove action: ${words.rowTag}` }));
        fireEvent.click(screen.getByRole("button", { name: words.preview }));
        await waitFor(() =>
            expect(api.dryRunRule).toHaveBeenCalledWith(
                7,
                expect.objectContaining({
                    destination_project_id: null,
                    add_tag: "",
                    set_status: "Open",
                }),
                "t"
            )
        );
    });

    it("on Free shows the plan note, keeps off working and offers no editing", async () => {
        api.updateRule.mockResolvedValue({ ok: true, data: rule() });
        const pane = await openRules([rule(), rule({ ruleId: 2, enabled: false })], false);
        expect(within(pane).getByTestId("automation-plan").textContent).toContain(
            en.settings.schedules.upgradeChip
        );
        expect(screen.queryByRole("button", { name: words.newRule })).toBeNull();
        expect(rowButton()).toBeNull();
        const [on, off] = screen.getAllByRole("switch");
        expect(off).toHaveProperty("disabled", true);
        fireEvent.click(on);
        await waitFor(() =>
            expect(api.updateRule).toHaveBeenCalledWith(7, 1, { enabled: false }, "t")
        );
    });
});

describe("milestone rules (MIP-2547)", () => {
    const milestoneRule = (extra: Partial<AutomationRule> = {}) =>
        rule({ appliesTo: "milestone", conditions: [], ...extra });
    const msWords = wordsFor(words, "milestone");

    it("keeps what the rule acts on, and drops the milestone condition for milestones", () => {
        expect(definitionOf(draftOf(milestoneRule()), "x").applies_to).toBe("milestone");
        expect(emptyDraft().appliesTo).toBe("task");
        const draft = draftOf(
            rule({
                conditions: [
                    { field: "milestone", op: "is", value: 3 },
                    { field: "tag", op: "is", value: "tag-a" },
                ],
            })
        );
        expect(withTarget(draft, "milestone").conditions.map((c) => c.field)).toEqual(["tag"]);
        expect(withTarget(draft, "task").conditions).toHaveLength(2);
    });

    it("reads as a milestone sentence and opens in the editor", async () => {
        const pane = await openRules([milestoneRule({ setAssigneeId: "me" })]);
        const sentence = within(pane).getByTestId("rule-sentence").textContent;
        expect(sentence).toContain("a milestone's status becomes");
        expect(sentence).toContain("move it and its tasks to Delivery");
        expect(sentence).toContain("its only assignee");
        fireEvent.click(rowButton()!);
        const editor = await screen.findByTestId("rule-clauses");
        expect(editor.textContent).toContain(words.milestoneAssignNotice);
        expect(editor.textContent).toContain("Every milestone");
        expect(editor.textContent).toContain("more than 200 tasks");
    });

    it("switches a task rule to milestones and previews them with plain reasons", async () => {
        api.dryRunRule.mockResolvedValue({
            ok: true,
            data: {
                matched: 1,
                truncated: false,
                items: [
                    {
                        milestoneId: 3,
                        taskId: 30,
                        displayId: "IN-30",
                        title: "Launch",
                        status: "WIP",
                        outcome: "refused",
                        reason: "too_many_tasks",
                    },
                ],
            },
        });
        await openRules([rule({ conditions: [{ field: "milestone", op: "is", value: 3 }] })]);
        fireEvent.click(rowButton()!);
        fireEvent.click(await screen.findByRole("combobox", { name: /^Applies to/ }));
        fireEvent.click(await screen.findByRole("option", { name: words.targetMilestones }));
        await waitFor(() =>
            expect(screen.getByTestId("rule-clauses").textContent).toContain("Every milestone")
        );
        expect(screen.getByTestId("rule-clauses").textContent).toContain(
            words.milestoneConditionRemoved
        );
        fireEvent.click(screen.getByRole("button", { name: words.preview }));
        expect(await screen.findByText("1 milestone matches right now")).toBeTruthy();
        expect(screen.getByTestId("preview-rows").textContent).toContain(
            "more than 200 tasks, too many for a rule to move"
        );
        expect(api.dryRunRule).toHaveBeenCalledWith(
            7,
            expect.objectContaining({ applies_to: "milestone", conditions: [] }),
            "t"
        );
    });

    it("says milestone in a turned-off reason and in the delete question", async () => {
        const pane = await openRules([milestoneRule({ enabled: false, disabledReason: "error" })]);
        expect(within(pane).getByTestId("rule-turned-off").textContent).toContain(
            msWords.reason.error
        );
        fireEvent.click(screen.getByRole("button", { name: "More actions for Hand over" }));
        fireEvent.click(await screen.findByRole("menuitem", { name: words.delete }));
        expect(await screen.findByText(msWords.deleteBody)).toBeTruthy();
    });
});
