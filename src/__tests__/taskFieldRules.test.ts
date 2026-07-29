// Pure-logic tests for the project field-rules evaluators shared by the
// create form and the table's quick-add row: default application
// (fill-empty-only) and the required-field gate.

import { describe, expect, it } from "vitest";

import {
    applyRuleDefaults,
    getActiveRequiredFields,
    getMissingRequiredFields,
    getQuickAddBlockingFields,
    RuleDefaultsContext,
    TaskFieldDraft,
    TaskFieldRules,
} from "../features/tasks/utils/taskFieldRules";
import { TagListProps } from "../types/tasks";

const debugTag: TagListProps = { tagName: "debug", tagColor: "#111", tagTextColor: "#fff" };
const uiTag: TagListProps = { tagName: "ui", tagColor: "#222", tagTextColor: "#fff" };

const emptyDraft = (overrides: Partial<TaskFieldDraft> = {}): TaskFieldDraft => ({
    projectId: 42,
    dueDate: null,
    status: null,
    priority: null,
    effortLevel: null,
    tags: [],
    assigneeId: null,
    reporterId: null,
    ...overrides,
});

const ctx = (overrides: Partial<RuleDefaultsContext> = {}): RuleDefaultsContext => ({
    creatorUserId: "creator-1",
    teamMemberIds: ["creator-1", "member-2"],
    projectTags: [debugTag, uiTag],
    today: new Date("2026-07-19T12:00:00Z"),
    ...overrides,
});

describe("applyRuleDefaults", () => {
    it("fills every empty slot from the configured defaults", () => {
        const rules: TaskFieldRules = {
            dueDate: { defaultOffsetDays: 7 },
            priority: { default: "High" },
            effortLevel: { default: "Moderate" },
            tags: { defaultTagNames: ["debug"] },
            assignee: { default: "member-2" },
            reporter: { default: "creator" },
        };
        const next = applyRuleDefaults(emptyDraft(), rules, ctx());
        expect(next.dueDate).toBe("2026-07-26");
        expect(next.priority).toBe("High");
        expect(next.effortLevel).toBe("Moderate");
        expect(next.tags).toEqual([debugTag]);
        expect(next.assigneeId).toBe("member-2");
        expect(next.reporterId).toBe("creator-1");
    });

    it("never overwrites a non-empty value (inherited due date wins)", () => {
        const rules: TaskFieldRules = {
            dueDate: { defaultOffsetDays: 7 },
            priority: { default: "High" },
            tags: { defaultTagNames: ["debug"] },
            assignee: { default: "member-2" },
        };
        const next = applyRuleDefaults(
            emptyDraft({
                dueDate: "2026-08-01",
                priority: "Low",
                tags: [uiTag],
                assigneeId: "creator-1",
            }),
            rules,
            ctx()
        );
        expect(next.dueDate).toBe("2026-08-01");
        expect(next.priority).toBe("Low");
        expect(next.tags).toEqual([uiTag]);
        expect(next.assigneeId).toBe("creator-1");
    });

    it("handles offset 0 (due today) and month rollover", () => {
        const today = new Date("2026-07-31T12:00:00Z");
        expect(
            applyRuleDefaults(emptyDraft(), { dueDate: { defaultOffsetDays: 0 } }, ctx({ today }))
                .dueDate
        ).toBe("2026-07-31");
        expect(
            applyRuleDefaults(emptyDraft(), { dueDate: { defaultOffsetDays: 1 } }, ctx({ today }))
                .dueDate
        ).toBe("2026-08-01");
    });

    it("drops defaults whose option no longer exists", () => {
        const rules: TaskFieldRules = {
            tags: { defaultTagNames: ["deleted-tag", "debug"] },
            assignee: { default: "departed-user" },
            priority: { default: "Urgent" },
            effortLevel: { default: "Huge" },
        };
        const next = applyRuleDefaults(emptyDraft(), rules, ctx());
        // Stale tag name dropped; the surviving one still resolves.
        expect(next.tags).toEqual([debugTag]);
        expect(next.assigneeId).toBeNull();
        expect(next.priority).toBeNull();
        expect(next.effortLevel).toBeNull();
    });

    it("is the identity for an empty rules blob", () => {
        const draft = emptyDraft({ dueDate: "2026-08-01", tags: [uiTag] });
        expect(applyRuleDefaults(draft, {}, ctx())).toEqual(draft);
    });
});

describe("getMissingRequiredFields", () => {
    const gateCtx = { kind: "task" as const, projectTags: [debugTag] };

    it("lists each required field that is still unset", () => {
        const rules: TaskFieldRules = {
            dueDate: { required: true },
            priority: { required: true },
            effortLevel: { required: true },
            tags: { required: true },
            assignee: { required: true },
            reporter: { required: true },
        };
        expect(getMissingRequiredFields(emptyDraft(), rules, gateCtx)).toEqual([
            "assignee",
            "reporter",
            "tags",
            "priority",
            "effortLevel",
            "dueDate",
        ]);
    });

    it("omits required fields that are set", () => {
        const rules: TaskFieldRules = {
            dueDate: { required: true },
            priority: { required: true },
            tags: { required: true },
            assignee: { required: true },
        };
        const draft = emptyDraft({
            dueDate: "2026-08-01",
            priority: "High",
            tags: [debugTag],
            assigneeId: "member-2",
        });
        expect(getMissingRequiredFields(draft, rules, gateCtx)).toEqual([]);
    });

    it("treats a tags-required rule as inactive while the project has no tags", () => {
        const rules: TaskFieldRules = { tags: { required: true } };
        expect(
            getMissingRequiredFields(emptyDraft(), rules, { kind: "task", projectTags: [] })
        ).toEqual([]);
        expect(getMissingRequiredFields(emptyDraft(), rules, gateCtx)).toEqual(["tags"]);
    });

    it("lists project when the draft has none, independent of rules", () => {
        expect(getMissingRequiredFields(emptyDraft({ projectId: null }), {}, gateCtx)).toEqual([
            "project",
        ]);
    });

    it("fails open on an empty rules blob", () => {
        expect(getMissingRequiredFields(emptyDraft(), {}, gateCtx)).toEqual([]);
    });
});

describe("getActiveRequiredFields", () => {
    it("returns required fields, excluding tags when the project has none", () => {
        const rules: TaskFieldRules = {
            priority: { required: true },
            tags: { required: true },
            dueDate: { required: false, defaultOffsetDays: 3 },
        };
        expect(getActiveRequiredFields(rules, [])).toEqual(["priority"]);
        expect(getActiveRequiredFields(rules, [debugTag])).toEqual(["priority", "tags"]);
    });
});

/**
 * The quick-add gate is deliberately NOT the create form's gate. It is
 * the single read point for the "enforce required fields on quick-add"
 * preference, so both sides of the toggle are pinned here.
 */
describe("getQuickAddBlockingFields", () => {
    const gateCtx = { kind: "task" as const, projectTags: [debugTag] };
    const rules: TaskFieldRules = {
        assignee: { required: true },
        effortLevel: { required: true },
    };

    it("lets a title-only task through when enforcement is off", () => {
        expect(
            getQuickAddBlockingFields(emptyDraft(), rules, gateCtx, {
                enforceRequiredFields: false,
            })
        ).toEqual([]);
    });

    it("blocks on every required field when enforcement is on", () => {
        expect(
            getQuickAddBlockingFields(emptyDraft(), rules, gateCtx, {
                enforceRequiredFields: true,
            })
        ).toEqual(["assignee", "effortLevel"]);
    });

    it("still blocks on a missing project even with enforcement off", () => {
        // Structural, not policy: the POST cannot succeed without a
        // project, so letting it through trades an inline message for a
        // failed request.
        expect(
            getQuickAddBlockingFields(emptyDraft({ projectId: null }), rules, gateCtx, {
                enforceRequiredFields: false,
            })
        ).toEqual(["project"]);
    });

    it("matches the create form's gate exactly when enforcement is on", () => {
        expect(
            getQuickAddBlockingFields(emptyDraft({ projectId: null }), rules, gateCtx, {
                enforceRequiredFields: true,
            })
        ).toEqual(getMissingRequiredFields(emptyDraft({ projectId: null }), rules, gateCtx));
    });
});
