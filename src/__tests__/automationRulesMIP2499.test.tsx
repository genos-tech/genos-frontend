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
} from "../features/tasks/automation/draft";
import { statusOptions } from "../features/tasks/automation/lookups";
import type { AutomationRule } from "../features/tasks/automation/types";
import { ModalProjectStatuses } from "../features/tasks/components/statuses/ModalProjectStatuses";
import { __resetProjectStatusesStore } from "../hooks/tasks/useProjectStatuses";
import { en } from "../i18n/locales/en";
import { ProjectProps, ProjectStatusDef } from "../types/tasks";

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
                        myUserId: "me",
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

    it("offers a category's built-in as the category and any other row by itself", () => {
        const row = (statusId: number, name: string, builtinKey: string | null) =>
            ({
                statusId,
                name,
                builtinKey,
                category: "WIP",
                color: "",
                sortOrder: statusId,
                isDefault: false,
                isArchived: false,
            }) as ProjectStatusDef;
        const picks = statusOptions([row(1, "WIP", "WIP"), row(2, "Code review", null)]).map(
            (o) => o.pick.customStatusId
        );
        expect(picks).toEqual([null, 2]);
        expect(statusOptions([]).map((o) => o.pick.category)).toContain("Closed");
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
