/**
 * What the rule editor holds while a person writes a rule, and how it turns into the request.
 * A half-filled row is a draft's business only: the server judges whole definitions.
 */
import type {
    AutomationRule,
    ConditionField,
    ConditionOp,
    RuleCondition,
    RuleDefinition,
    RuleTarget,
    TriggerType,
} from "./types";

export const MAX_RULES = 50;
export const MAX_CONDITIONS = 10;
export const MAX_RULE_NAME = 80;

/** A status a rule may name: a built-in category, or one of the project's own. */
export type StatusPick = { category: string; customStatusId: number | null };

export type DraftCondition = {
    /** A stable key for the row. */
    key: number;
    field: ConditionField;
    op: ConditionOp;
    value: string;
    fieldId: number | null;
};

export type ActionKind = "move" | "status" | "assignee" | "tag";

export type RuleDraft = {
    name: string;
    appliesTo: RuleTarget;
    triggerType: TriggerType;
    triggerStatus: StatusPick | null;
    triggerTag: string;
    /** "" is "anyone" (any change of assignee). */
    triggerAssignee: string;
    conditions: DraftCondition[];
    /** Which actions the rule has, in the order they are shown. */
    actions: ActionKind[];
    destinationId: number | null;
    setStatus: StatusPick | null;
    assigneeId: string;
    addTag: string;
};

let nextKey = 1;
export const conditionRow = (
    field: ConditionField = "tag",
    patch: Partial<DraftCondition> = {}
): DraftCondition => ({
    key: nextKey++,
    field,
    op: "is",
    value: "",
    fieldId: null,
    ...patch,
});

export const emptyDraft = (): RuleDraft => ({
    name: "",
    appliesTo: "task",
    triggerType: "status_changed",
    triggerStatus: null,
    triggerTag: "",
    triggerAssignee: "",
    conditions: [],
    actions: ["move"],
    destinationId: null,
    setStatus: null,
    assigneeId: "",
    addTag: "",
});

export const needsValue = (op: ConditionOp): boolean => op === "is" || op === "is_not";

export const draftOf = (rule: AutomationRule): RuleDraft => {
    const value = rule.triggerValue ?? {};
    const actions: ActionKind[] = [];
    if (rule.movesTask) actions.push("move");
    if (rule.setStatus) actions.push("status");
    if (rule.setAssigneeId) actions.push("assignee");
    if (rule.addTag) actions.push("tag");
    return {
        ...emptyDraft(),
        name: rule.name,
        appliesTo: rule.appliesTo ?? "task",
        triggerType: rule.triggerType,
        triggerStatus:
            rule.triggerType !== "status_changed"
                ? null
                : value.custom_status_id != null
                  ? // The category comes from the project's list; the id is what is saved.
                    { category: "", customStatusId: value.custom_status_id }
                  : value.status
                    ? { category: value.status, customStatusId: null }
                    : null,
        triggerTag: value.tag ?? "",
        triggerAssignee: value.assignee_id ?? "",
        conditions: rule.conditions.map((c) =>
            conditionRow(c.field, {
                op: c.op,
                value: c.value == null ? "" : String(c.value),
                fieldId: c.field_id ?? null,
            })
        ),
        actions,
        destinationId: rule.destination?.projectId ?? null,
        setStatus: rule.setStatus
            ? { category: rule.setStatus, customStatusId: rule.setCustomStatusId }
            : null,
        assigneeId: rule.setAssigneeId ?? "",
        addTag: rule.addTag ?? "",
    };
};

/** The editor's parts that are still empty, by the id the editor gives each. */
export const missingParts = (draft: RuleDraft): string[] => {
    const missing: string[] = [];
    if (draft.triggerType === "status_changed" && !draft.triggerStatus) missing.push("trigger");
    if (draft.triggerType === "tag_added" && !draft.triggerTag) missing.push("trigger");
    for (const c of draft.conditions) {
        if (
            (c.field === "custom_field" && c.fieldId == null) ||
            (needsValue(c.op) && !c.value.trim())
        ) {
            missing.push(`condition:${c.key}`);
        }
    }
    if (!draft.actions.length) missing.push("actions");
    if (draft.actions.includes("move") && draft.destinationId == null) missing.push("move");
    if (draft.actions.includes("status") && !draft.setStatus) missing.push("status");
    if (draft.actions.includes("assignee") && !draft.assigneeId) missing.push("assignee");
    if (draft.actions.includes("tag") && !draft.addTag) missing.push("tag");
    return missing;
};

const NUMERIC: readonly ConditionField[] = ["milestone", "custom_status"];

const conditionOf = (c: DraftCondition): RuleCondition => ({
    field: c.field,
    op: c.op,
    ...(c.field === "custom_field" && c.fieldId != null ? { field_id: c.fieldId } : {}),
    ...(needsValue(c.op)
        ? { value: NUMERIC.includes(c.field) ? Number(c.value) : c.value.trim() }
        : {}),
});

const has = (draft: RuleDraft, kind: ActionKind) => draft.actions.includes(kind);

export const definitionOf = (draft: RuleDraft, name: string): RuleDefinition => {
    const status = has(draft, "status") ? draft.setStatus : null;
    return {
        name: name.trim().slice(0, MAX_RULE_NAME),
        applies_to: draft.appliesTo,
        trigger_type: draft.triggerType,
        trigger_value:
            draft.triggerType === "status_changed" && draft.triggerStatus
                ? draft.triggerStatus.customStatusId != null
                    ? { custom_status_id: draft.triggerStatus.customStatusId }
                    : { status: draft.triggerStatus.category }
                : draft.triggerType === "tag_added"
                  ? { tag: draft.triggerTag }
                  : draft.triggerType === "assignee_changed" && draft.triggerAssignee
                    ? { assignee_id: draft.triggerAssignee }
                    : {},
        conditions: draft.conditions.map(conditionOf),
        destination_project_id: has(draft, "move") ? draft.destinationId : null,
        set_status: status?.category ?? "",
        set_custom_status_id: status?.customStatusId ?? null,
        set_assignee_id: has(draft, "assignee") && draft.assigneeId ? draft.assigneeId : null,
        add_tag: has(draft, "tag") ? draft.addTag : "",
    };
};

/** A milestone is in no milestone: a milestone rule drops those conditions. */
export const withTarget = (draft: RuleDraft, appliesTo: RuleTarget): RuleDraft => ({
    ...draft,
    appliesTo,
    conditions:
        appliesTo === "milestone"
            ? draft.conditions.filter((c) => c.field !== "milestone")
            : draft.conditions,
});

/** A new destination does not inherit the values that belong to the old one. */
export const withDestination = (draft: RuleDraft, destinationId: number | null): RuleDraft =>
    destinationId === draft.destinationId
        ? draft
        : {
              ...draft,
              destinationId,
              setStatus:
                  draft.setStatus?.customStatusId != null ? null : (draft.setStatus ?? null),
              addTag: "",
          };
