/** The shapes of `/api/v2/projects/<id>/automation-rules/` (genos-api MIP-2498). */

export type TriggerType = "status_changed" | "created" | "tag_added" | "assignee_changed";

export type TriggerValue = {
    status?: string;
    custom_status_id?: number;
    tag?: string;
    assignee_id?: string;
};

export type ConditionField =
    | "tag"
    | "assignee"
    | "reporter"
    | "priority"
    | "milestone"
    | "custom_field"
    | "custom_status";

export type ConditionOp = "is" | "is_not" | "is_set" | "is_not_set";

export type RuleCondition = {
    field: ConditionField;
    op: ConditionOp;
    value?: string | number;
    field_id?: number;
};

export type AutomationRule = {
    ruleId: number;
    name: string;
    position: number;
    enabled: boolean;
    /** Why the engine turned the rule off; "" when a person did, or it is on. */
    disabledReason: string;
    triggerType: TriggerType;
    triggerValue: TriggerValue;
    conditions: RuleCondition[];
    movesTask: boolean;
    /** What the rule acts on (genos-api MIP-2521). This builder writes task rules only. */
    appliesTo?: "task" | "milestone";
    /** Not named (`visible: false`) when the reader is not on the destination, or when it was
     *  deleted (`gone`, genos-api MIP-2544). */
    destination: {
        projectId: number | null;
        name: string | null;
        visible: boolean;
        gone?: boolean;
    } | null;
    setStatus: string | null;
    setCustomStatusId: number | null;
    setAssigneeId: string | null;
    addTag: string | null;
    ownerId: string | null;
};

/** The body of a create, an edit or a dry run of a rule not saved yet. */
export type RuleDefinition = {
    name: string;
    trigger_type: TriggerType;
    trigger_value: TriggerValue;
    conditions: RuleCondition[];
    destination_project_id: number | null;
    set_status: string;
    set_custom_status_id: number | null;
    set_assignee_id: string | null;
    add_tag: string;
};

export type RuleList = { rules: AutomationRule[]; planAllows: boolean };

export type DryRunItem = {
    taskId: number;
    displayId: string;
    title: string;
    status: string;
    outcome: "would_apply" | "refused" | "skipped";
    reason: string;
};

export type DryRunResult = { matched: number; items: DryRunItem[]; truncated: boolean };

export type RuleRun = {
    runId: number;
    taskId: number | null;
    displayId: string | null;
    state: "applied" | "refused" | "skipped";
    reason: string;
    tsDoneAt: string | null;
};
