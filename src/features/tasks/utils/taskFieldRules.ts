import { TagListProps } from "../../../types/tasks";
import { TaskKind } from "./taskKind";
import { effortLevels, priorities } from "./taskMeta";

// ---------------------------------------------------------------------------
// Project-owner-configured creation rules for task/milestone metadata
// fields (ProjectMaster.task_field_rules on the API). Rules are stored
// per PROJECT, apply to tasks, subtasks AND milestones created under it,
// and are enforced at CREATION ONLY, entirely in the UI — the API
// stores/serves the blob but never rejects a create (agent and internal
// creation paths must stay unaffected).
// ---------------------------------------------------------------------------

// "sprint" is absent (dropped from the feature), "status" is always
// auto-set at creation (never customizable), and "project" is always
// required and never stored.
export type ConfigurableTaskField =
    | "dueDate"
    | "effortLevel"
    | "priority"
    | "tags"
    | "reporter"
    | "assignee";

export type TaskFieldRule = {
    required?: boolean;
    /** status/priority/effortLevel: a label from `taskMeta`;
     *  assignee/reporter: `"creator"` or a userId. */
    default?: string | null;
    /** dueDate only: due = today + N days. */
    defaultOffsetDays?: number | null;
    /** tags only: tagNames, resolved against the project's LIVE tags
     *  (stale names are silently dropped). */
    defaultTagNames?: string[];
};

export type TaskFieldRules = Partial<Record<ConfigurableTaskField, TaskFieldRule>>;

/** The useTM cache slot — tagged with the project the rules belong to so
 *  consumers can detect staleness, and carrying ownerUserId so the
 *  customize UI can be owner-gated without a second fetch. */
export type ProjectTaskFieldRules = {
    projectId: number;
    ownerUserId: string | null;
    rules: TaskFieldRules;
};

/** Flat, kind-agnostic snapshot of the creation-relevant metadata.
 *  Both CreateTaskForm (from its TaskProps draft) and the table's
 *  quick-add row (from its local state) can build one. Empty string and
 *  null both mean "unset". */
export type TaskFieldDraft = {
    projectId: number | null;
    dueDate: string | null;
    status: string | null;
    priority: string | null;
    effortLevel: string | null;
    tags: TagListProps[];
    assigneeId: string | null;
    reporterId: string | null;
};

export type RuleDefaultsContext = {
    creatorUserId: string;
    /** Valid ids for assignee/reporter defaults — a defaulted user who
     *  left the team is silently dropped. */
    teamMemberIds: string[];
    /** The selected project's LIVE tags. */
    projectTags: TagListProps[];
    /** Injectable clock for tests; defaults to `new Date()`. */
    today?: Date;
};

const isSet = (value: string | null | undefined): value is string => value != null && value !== "";

// Matches the app-wide date convention (dateUtils uses toISOString).
const formatOffsetDate = (offsetDays: number, today?: Date): string => {
    const d = today ? new Date(today.getTime()) : new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().split("T")[0];
};

const resolvePersonDefault = (
    rule: TaskFieldRule | undefined,
    ctx: RuleDefaultsContext
): string | null => {
    const value = rule?.default;
    if (!isSet(value)) return null;
    if (value === "creator") return ctx.creatorUserId;
    return ctx.teamMemberIds.includes(value) ? value : null;
};

/**
 * Return a NEW draft with configured defaults filled into slots that are
 * still empty. Never overwrites a non-empty value — which is what makes
 * "an inherited due date wins over the offset default" fall out for free
 * (the create form seeds inherited dates before defaults are applied).
 * Defaults referencing options that no longer exist (a deleted tag, a
 * departed member, a label missing from taskMeta) are silently dropped.
 */
export const applyRuleDefaults = (
    draft: TaskFieldDraft,
    rules: TaskFieldRules,
    ctx: RuleDefaultsContext
): TaskFieldDraft => {
    const next: TaskFieldDraft = { ...draft, tags: [...draft.tags] };

    const offset = rules.dueDate?.defaultOffsetDays;
    if (!isSet(next.dueDate) && offset != null && offset >= 0) {
        next.dueDate = formatOffsetDate(offset, ctx.today);
    }

    const priorityDefault = rules.priority?.default;
    if (!isSet(next.priority) && isSet(priorityDefault)) {
        if (priorities.some((p) => p.priority === priorityDefault)) {
            next.priority = priorityDefault;
        }
    }
    const effortDefault = rules.effortLevel?.default;
    if (!isSet(next.effortLevel) && isSet(effortDefault)) {
        if (effortLevels.some((e) => e.level === effortDefault)) {
            next.effortLevel = effortDefault;
        }
    }

    const tagNames = rules.tags?.defaultTagNames;
    if (next.tags.length === 0 && tagNames && tagNames.length > 0) {
        next.tags = tagNames
            .map((name) => ctx.projectTags.find((t) => t.tagName === name))
            .filter((t): t is TagListProps => t != null);
    }

    if (!isSet(next.assigneeId)) {
        next.assigneeId = resolvePersonDefault(rules.assignee, ctx);
    }
    if (!isSet(next.reporterId)) {
        next.reporterId = resolvePersonDefault(rules.reporter, ctx);
    }

    return next;
};

/**
 * Field keys that are required by rule AND still unset in the draft,
 * in a stable display order. Semantics:
 *   - "project" is listed when the draft has no project — the baseline
 *     always-required field, independent of rules (keeps the missing-
 *     fields hint complete).
 *   - tags: the rule is INACTIVE while the project has no tags at all
 *     ("a field with no options can't be required").
 *   - `kind` doesn't currently change the outcome (sprint was dropped
 *     from the feature) but stays in the signature as the seam for any
 *     future per-kind carve-out.
 */
export const getMissingRequiredFields = (
    draft: TaskFieldDraft,
    rules: TaskFieldRules,
    _ctx: { kind: TaskKind; projectTags: TagListProps[] }
): Array<ConfigurableTaskField | "project"> => {
    const missing: Array<ConfigurableTaskField | "project"> = [];
    if (draft.projectId == null) missing.push("project");
    if (rules.assignee?.required && !isSet(draft.assigneeId)) missing.push("assignee");
    if (rules.reporter?.required && !isSet(draft.reporterId)) missing.push("reporter");
    if (rules.tags?.required && _ctx.projectTags.length > 0 && draft.tags.length === 0) {
        missing.push("tags");
    }
    if (rules.priority?.required && !isSet(draft.priority)) missing.push("priority");
    if (rules.effortLevel?.required && !isSet(draft.effortLevel)) missing.push("effortLevel");
    if (rules.dueDate?.required && !isSet(draft.dueDate)) missing.push("dueDate");
    return missing;
};

/** The rule-required fields that are ACTIVE for the given project state
 *  (e.g. tags-required with zero project tags is inactive) — used to
 *  render the required-asterisk indicators. */
export const getActiveRequiredFields = (
    rules: TaskFieldRules,
    projectTags: TagListProps[]
): ConfigurableTaskField[] => {
    const fields: ConfigurableTaskField[] = [];
    (Object.keys(rules) as ConfigurableTaskField[]).forEach((field) => {
        if (!rules[field]?.required) return;
        if (field === "tags" && projectTags.length === 0) return;
        fields.push(field);
    });
    return fields;
};
