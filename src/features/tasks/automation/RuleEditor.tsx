/**
 * The rule as one sentence block: When / If / Then, each value a picker. The rail's dot says
 * whether its clause is complete.
 */
import { ReactNode, useEffect, useId, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import {
    Alert,
    Box,
    Button,
    Dropdown,
    FormControl,
    FormHelperText,
    FormLabel,
    IconButton,
    Input,
    MenuButton,
} from "@mui/joy";

import { MenuRow, MenuSurface } from "../../../components/ui/MoreMenu";
import { useAuth } from "../../../context/authState";
import { useProjectMemberIds } from "../../../hooks/tasks/useProjectMemberIds";
import { useProjectStatuses } from "../../../hooks/tasks/useProjectStatuses";
import { fmt } from "../../../i18n";
import { focusRing, g, type } from "../../../theme/tokens";
import {
    ActionKind,
    conditionRow,
    DraftCondition,
    MAX_CONDITIONS,
    MAX_RULE_NAME,
    needsValue,
    RuleDraft,
    withDestination,
    withTarget,
} from "./draft";
import { coarsePointer, fieldName, projectName } from "./helpers";
import { statusPickOf, useLookups } from "./lookups";
import {
    CustomFieldSlot,
    MemberSlot,
    MilestoneSlot,
    PrioritySlot,
    ProjectSlot,
    StatusSlot,
    TagSlot,
} from "./pickers";
import { SlotOption, SlotSelect } from "./slots";
import type { ConditionField, ConditionOp, RuleTarget, TriggerType } from "./types";
import { useLater } from "./useLater";
import { useAutomationWords } from "./words";

/** The parts that need attention, by id (`missingParts`, or the server's field). */
export type EditorErrors = Record<string, string>;

const ACTION_ORDER: readonly ActionKind[] = ["move", "status", "assignee", "tag"];

const coarse44 = { "@media (pointer: coarse)": { minWidth: 44, minHeight: 44 } } as const;

type NodeState = "empty" | "done" | "error";

const Clause = ({
    keyword,
    state,
    last = false,
    children,
}: {
    keyword: string;
    state: NodeState;
    last?: boolean;
    children: ReactNode;
}) => {
    const headingId = useId();
    return (
        <Box
            aria-labelledby={headingId}
            data-node={state}
            role="group"
            sx={{
                display: "grid",
                gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "88px minmax(0, 1fr)" },
                columnGap: 1,
                rowGap: 0.75,
                position: "relative",
                paddingBlock: 1.5,
                paddingInlineEnd: 1,
                paddingInlineStart: 4,
                ...(!last && { borderBottom: `1px solid ${g.border.subtle}` }),
                // The rail: one line through the three dots.
                "&::before": {
                    content: '""',
                    position: "absolute",
                    insetInlineStart: "15px",
                    insetBlockStart: 0,
                    insetBlockEnd: 0,
                    width: "1px",
                    background: g.border.default,
                    ...(last && { insetBlockEnd: "auto", height: "24px" }),
                },
                "&:first-of-type::before": {
                    insetBlockStart: "24px",
                },
                "&::after": {
                    content: '""',
                    position: "absolute",
                    insetInlineStart: "11px",
                    insetBlockStart: "22px",
                    width: "9px",
                    height: "9px",
                    borderRadius: "50%",
                    boxSizing: "border-box",
                    border: "1.5px solid",
                    borderColor:
                        state === "error"
                            ? g.danger.solid
                            : state === "done"
                              ? g.accent.solid
                              : g.text.tertiary,
                    background:
                        state === "error"
                            ? g.danger.solid
                            : state === "done"
                              ? g.accent.solid
                              : g.surface.raised,
                    transition: `background ${g.motion.fast}, border-color ${g.motion.fast}`,
                    "@media (prefers-reduced-motion: reduce)": { transition: "none" },
                },
            }}
        >
            <Box
                id={headingId}
                sx={{
                    ...type("body-sm"),
                    fontWeight: 600,
                    color: g.text.secondary,
                    alignSelf: "start",
                    minHeight: { sm: g.control.sm },
                    display: "flex",
                    alignItems: "center",
                }}
            >
                {keyword}
            </Box>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75, minWidth: 0 }}>
                {children}
            </Box>
        </Box>
    );
};

/** One line of a clause: its slots, a remove button, and what is wrong with it. */
const Line = ({
    lead,
    children,
    onRemove,
    removeLabel,
    error,
    errorId,
    leadWidth,
}: {
    /** From `sm` up, so a clause's pickers line up. */
    leadWidth?: number;
    lead?: ReactNode;
    children: ReactNode;
    onRemove?: () => void;
    removeLabel?: string;
    error?: string;
    errorId?: string;
}) => (
    <Box sx={{ minWidth: 0 }} data-line>
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 0.5, minWidth: 0 }}>
            <Box
                sx={{
                    display: "flex",
                    flex: 1,
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: 0.75,
                    minWidth: 0,
                    minHeight: g.control.sm,
                }}
            >
                {lead && (
                    <Box
                        component="span"
                        sx={{
                            ...type("body-sm"),
                            color: g.text.tertiary,
                            // The slots of a clause start on one line.
                            minWidth: { sm: leadWidth },
                        }}
                    >
                        {lead}
                    </Box>
                )}
                {children}
            </Box>
            {onRemove && (
                <IconButton
                    aria-label={removeLabel}
                    color="neutral"
                    size="sm"
                    sx={{ ...coarse44, "&:focus-visible": focusRing }}
                    variant="plain"
                    onClick={onRemove}
                >
                    <CloseRoundedIcon sx={{ fontSize: 16 }} />
                </IconButton>
            )}
        </Box>
        {error && (
            <Box
                id={errorId}
                role="alert"
                sx={{ ...type("body-xs"), color: g.danger.text, mt: 0.5 }}
            >
                {error}
            </Box>
        )}
    </Box>
);

const quietButtonSx = {
    alignSelf: "flex-start",
    "@media (pointer: coarse)": { minHeight: 44 },
} as const;

const textSx = (invalid: boolean) => ({
    ...type("body-sm"),
    width: { xs: "100%", sm: 220 },
    borderColor: invalid ? g.danger.border : g.border.default,
    boxShadow: "none",
    "@media (pointer: coarse)": { minHeight: 44 },
});

export const RuleEditor = ({
    draft,
    onChange,
    errors,
    formError,
    onAnnounce,
}: {
    draft: RuleDraft;
    onChange: (next: RuleDraft) => void;
    errors: EditorErrors;
    /** A refusal that belongs to no one input. */
    formError: string | null;
    onAnnounce: (text: string) => void;
}) => {
    const words = useAutomationWords(draft.appliesTo);
    const milestone = draft.appliesTo === "milestone";
    const lookups = useLookups();
    const { accessToken } = useAuth();
    const later = useLater();
    const ids = useId();
    const patch = (change: Partial<RuleDraft>) => onChange({ ...draft, ...change });
    const errorId = (part: string) => `${ids}-${part.replace(":", "-")}`;
    const describe = (part: string) => (errors[part] ? errorId(part) : undefined);

    const moving = draft.actions.includes("move");
    const targetId =
        moving && draft.destinationId != null ? draft.destinationId : lookups.projectId;
    const target = lookups.projects.find((p) => p.projectId === targetId);
    const targetStatuses = useProjectStatuses(targetId).statuses;

    // A private project's tasks can only be given to its own people.
    const memberIds = useProjectMemberIds(target?.isPrivate ? targetId : null, accessToken, {
        userId: lookups.myself.userId,
    });
    const refreshMembers = memberIds.refresh;
    useEffect(() => refreshMembers(), [refreshMembers]);
    const picker = (part: string, label: string, slotId: string = part) => ({
        label,
        slotId,
        invalid: Boolean(errors[part]),
        describedBy: describe(part),
    });

    const triggerSlot = () => {
        if (draft.triggerType === "status_changed") {
            return (
                <StatusSlot
                    field={picker("trigger", words.fieldStatus)}
                    projectId={lookups.projectId}
                    rows={lookups.statuses}
                    value={draft.triggerStatus}
                    onChange={({ category }, statusId) =>
                        patch({
                            triggerStatus: statusPickOf(category, statusId, lookups.statuses),
                        })
                    }
                />
            );
        }
        if (draft.triggerType === "tag_added") {
            return (
                <TagSlot
                    field={picker("trigger", words.fieldTag)}
                    tags={lookups.current?.projectTags ?? []}
                    value={draft.triggerTag}
                    onChange={(triggerTag) => patch({ triggerTag })}
                />
            );
        }
        if (draft.triggerType === "assignee_changed") {
            return (
                <MemberSlot
                    field={picker("trigger", words.fieldAssignee)}
                    placeholder={words.anyone}
                    value={draft.triggerAssignee}
                    onChange={(triggerAssignee) => patch({ triggerAssignee })}
                />
            );
        }
        return null;
    };

    const setCondition = (key: number, change: Partial<DraftCondition>) =>
        patch({
            conditions: draft.conditions.map((c) => (c.key === key ? { ...c, ...change } : c)),
        });

    // The field slot names a custom field as `f:<id>`.
    const fieldOptions: SlotOption[] = [
        ...(["tag", "assignee", "reporter", "priority", "milestone", "custom_status"] as const)
            .filter((field) => field !== "custom_status" || lookups.statuses.length > 0)
            .filter((field) => field !== "milestone" || !milestone)
            .map((field) => ({ value: field as string, label: fieldName(words, field) })),
        ...lookups.fields.map((f) => ({ value: `f:${f.fieldId}`, label: f.fieldName })),
    ];

    const opOptions: SlotOption[] = [
        { value: "is", label: words.opIs },
        { value: "is_not", label: words.opIsNot },
        { value: "is_set", label: words.opSet },
        { value: "is_not_set", label: words.opNotSet },
    ];

    const conditionValue = (c: DraftCondition) => {
        const part = `condition:${c.key}`;
        const slot = {
            field: picker(part, words.valueLabel, `condition-value-${c.key}`),
            value: c.value,
            onChange: (value: string) => setCondition(c.key, { value }),
        };
        const field = lookups.fields.find((f) => f.fieldId === c.fieldId);
        if (c.field === "tag") {
            return <TagSlot {...slot} tags={lookups.current?.projectTags ?? []} />;
        }
        if (c.field === "assignee" || c.field === "reporter") return <MemberSlot {...slot} />;
        if (c.field === "priority") return <PrioritySlot {...slot} />;
        if (c.field === "milestone") return <MilestoneSlot {...slot} />;
        if (c.field === "custom_status") {
            const row = lookups.statuses.find((r) => String(r.statusId) === c.value);
            return (
                <StatusSlot
                    field={slot.field}
                    projectId={lookups.projectId}
                    rows={lookups.statuses}
                    value={row ? { category: row.category, customStatusId: row.statusId } : null}
                    // This condition names a status by itself, a built-in one too.
                    onChange={(_pick, statusId) =>
                        slot.onChange(statusId == null ? "" : String(statusId))
                    }
                />
            );
        }
        if (field?.fieldType === "tag" || field?.fieldType === "member") {
            return <CustomFieldSlot {...slot} def={field} />;
        }
        return (
            <Input
                error={slot.field.invalid}
                size="sm"
                sx={textSx(Boolean(slot.field.invalid))}
                type={field?.fieldType === "date" ? "date" : "text"}
                value={c.value}
                slotProps={{
                    input: {
                        "aria-label": words.valueLabel,
                        "aria-describedby": slot.field.describedBy,
                        maxLength: 200,
                    },
                }}
                onChange={(e) => setCondition(c.key, { value: e.target.value })}
            />
        );
    };

    const conditionLine = (c: DraftCondition, index: number) => {
        const part = `condition:${c.key}`;
        return (
            <Line
                key={c.key}
                error={errors[part]}
                errorId={errorId(part)}
                lead={index > 0 ? words.kwAnd : undefined}
                removeLabel={fmt(words.removeCondition, { n: index + 1 })}
                onRemove={() => patch({ conditions: draft.conditions.filter((x) => x !== c) })}
            >
                <SlotSelect
                    label={words.fieldLabel}
                    options={fieldOptions}
                    slotId={`condition-field-${c.key}`}
                    value={c.field === "custom_field" ? `f:${c.fieldId}` : c.field}
                    onChange={(value) =>
                        setCondition(
                            c.key,
                            value.startsWith("f:")
                                ? {
                                      field: "custom_field",
                                      fieldId: Number(value.slice(2)),
                                      value: "",
                                  }
                                : { field: value as ConditionField, fieldId: null, value: "" }
                        )
                    }
                />
                <SlotSelect
                    label={words.operatorLabel}
                    options={opOptions}
                    value={c.op}
                    onChange={(value) => setCondition(c.key, { op: value as ConditionOp })}
                />
                {needsValue(c.op) && conditionValue(c)}
            </Line>
        );
    };

    // Said on screen too: a row that just vanishes looks like lost work.
    const [droppedCondition, setDroppedCondition] = useState(false);
    const changeTarget = (target: RuleTarget) => {
        const next = withTarget(draft, target);
        const dropped = next.conditions.length < draft.conditions.length;
        onChange(next);
        setDroppedCondition(dropped);
        if (dropped) onAnnounce(words.milestoneConditionRemoved);
    };

    const addCondition = () => {
        const row = conditionRow();
        patch({ conditions: [...draft.conditions, row] });
        later(
            () =>
                document
                    .querySelector<HTMLElement>(`[data-slot="condition-field-${row.key}"]`)
                    ?.focus(),
            50
        );
    };

    const moveDestination = (destinationId: number) => {
        const next = withDestination(draft, destinationId);
        const cleared = Boolean(draft.addTag) || draft.setStatus?.customStatusId != null;
        onChange(next);
        if (cleared && next !== draft) onAnnounce(words.cleared);
    };

    const actionLabel: Record<ActionKind, string> = {
        move: words.rowMove,
        status: words.rowStatus,
        assignee: words.rowAssign,
        tag: words.rowTag,
    };
    const menuLabel: Record<ActionKind, string> = {
        move: words.actMove,
        status: words.actStatus,
        assignee: words.actAssign,
        tag: words.actTag,
    };

    const actionSlot = (kind: ActionKind) => {
        const field = picker(kind, actionLabel[kind]);
        if (kind === "move") {
            return (
                <ProjectSlot
                    field={field}
                    value={draft.destinationId}
                    onChange={moveDestination}
                />
            );
        }
        if (kind === "status") {
            return (
                <StatusSlot
                    field={field}
                    projectId={targetId}
                    rows={targetStatuses}
                    value={draft.setStatus}
                    onChange={({ category }, statusId) =>
                        patch({ setStatus: statusPickOf(category, statusId, targetStatuses) })
                    }
                />
            );
        }
        if (kind === "assignee") {
            return (
                <MemberSlot
                    field={field}
                    memberIds={memberIds.ids}
                    value={draft.assigneeId}
                    onChange={(assigneeId) => patch({ assigneeId })}
                />
            );
        }
        return (
            <TagSlot
                field={field}
                tags={target?.projectTags ?? []}
                value={draft.addTag}
                onChange={(addTag) => patch({ addTag })}
            />
        );
    };

    // Without the move the task stays here: what belonged to the destination goes with it.
    const removeAction = (kind: ActionKind) => {
        const base = kind === "move" ? withDestination(draft, null) : draft;
        const cleared =
            base !== draft && (Boolean(draft.addTag) || draft.setStatus?.customStatusId != null);
        onChange({ ...base, actions: base.actions.filter((a) => a !== kind) });
        if (cleared) onAnnounce(words.cleared);
    };

    const actions = ACTION_ORDER.filter((a) => draft.actions.includes(a));
    const unused = ACTION_ORDER.filter((a) => !draft.actions.includes(a));
    const addAction = (kind: ActionKind) => {
        patch({ actions: [...draft.actions, kind] });
        // After the menu has handed focus back to its button.
        later(() => document.querySelector<HTMLElement>(`[data-slot="${kind}"]`)?.focus(), 80);
    };

    const clauseState = (has: boolean, parts: (p: string) => boolean): NodeState =>
        Object.keys(errors).some(parts) ? "error" : has ? "done" : "empty";

    const triggerDone =
        draft.triggerType === "status_changed"
            ? draft.triggerStatus != null
            : draft.triggerType === "tag_added"
              ? Boolean(draft.triggerTag)
              : true;
    const ifDone = draft.conditions.every((c) => !needsValue(c.op) || Boolean(c.value.trim()));
    const thenDone =
        actions.length > 0 &&
        actions.every((a) =>
            a === "move"
                ? draft.destinationId != null
                : a === "status"
                  ? draft.setStatus != null
                  : a === "assignee"
                    ? Boolean(draft.assigneeId)
                    : Boolean(draft.addTag)
        );

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pb: 1 }}>
            {formError && (
                <Alert color="danger" role="alert" size="sm" variant="soft">
                    {formError}
                </Alert>
            )}
            <FormControl error={Boolean(errors.name)}>
                <FormLabel>{words.nameLabel}</FormLabel>
                <Input
                    // Not on a touch screen: the keyboard would cover the sentence.
                    autoFocus={!draft.name && !coarsePointer()}
                    placeholder={words.namePlaceholder}
                    size="sm"
                    sx={{ "@media (pointer: coarse)": { minHeight: 44 } }}
                    value={draft.name}
                    endDecorator={
                        draft.name.length >= MAX_RULE_NAME - 4 ? (
                            <Box
                                component="span"
                                sx={{ ...type("body-xs"), color: g.text.tertiary }}
                            >
                                {`${draft.name.length}/${MAX_RULE_NAME}`}
                            </Box>
                        ) : null
                    }
                    slotProps={{
                        input: { maxLength: MAX_RULE_NAME, "data-slot": "name" },
                    }}
                    onChange={(e) => patch({ name: e.target.value })}
                />
                {errors.name && <FormHelperText>{errors.name}</FormHelperText>}
            </FormControl>

            <Box
                data-testid="rule-clauses"
                sx={{
                    border: `1px solid ${g.border.subtle}`,
                    borderRadius: g.radius.md,
                    background: g.bg.subtle,
                }}
            >
                <Clause
                    keyword={words.kwWhen}
                    state={clauseState(triggerDone, (p) => p === "trigger")}
                >
                    <Line error={errors.trigger} errorId={errorId("trigger")}>
                        <SlotSelect
                            label={words.targetLabel}
                            slotId="applies-to"
                            value={draft.appliesTo}
                            options={[
                                { value: "task", label: words.targetTasks },
                                { value: "milestone", label: words.targetMilestones },
                            ]}
                            onChange={(value) => changeTarget(value as RuleTarget)}
                        />
                        <SlotSelect
                            label={words.triggerLabel}
                            slotId="trigger-type"
                            value={draft.triggerType}
                            options={[
                                { value: "status_changed", label: words.optStatus },
                                { value: "created", label: words.optCreated },
                                { value: "tag_added", label: words.optTag },
                                { value: "assignee_changed", label: words.optAssignee },
                            ]}
                            onChange={(value) => patch({ triggerType: value as TriggerType })}
                        />
                        {triggerSlot()}
                    </Line>
                </Clause>

                <Clause
                    keyword={words.kwIf}
                    state={clauseState(
                        ifDone,
                        (p) => p === "conditions" || p.startsWith("condition:")
                    )}
                >
                    {draft.conditions.length === 0 && (
                        <Box
                            sx={{
                                ...type("body-sm"),
                                color: g.text.tertiary,
                                minHeight: g.control.sm,
                                display: "flex",
                                alignItems: "center",
                            }}
                        >
                            {words.everyTask}
                        </Box>
                    )}
                    {draft.conditions.map(conditionLine)}
                    {errors.conditions && (
                        <Box role="alert" sx={{ ...type("body-xs"), color: g.danger.text }}>
                            {errors.conditions}
                        </Box>
                    )}
                    {milestone && droppedCondition && (
                        <Box sx={{ ...type("body-xs"), color: g.text.tertiary }}>
                            {words.milestoneConditionRemoved}
                        </Box>
                    )}
                    <Button
                        color="neutral"
                        disabled={draft.conditions.length >= MAX_CONDITIONS}
                        size="sm"
                        startDecorator={<AddRoundedIcon sx={{ fontSize: 16 }} />}
                        sx={quietButtonSx}
                        variant="plain"
                        onClick={addCondition}
                    >
                        {words.addCondition}
                    </Button>
                    {draft.conditions.length >= MAX_CONDITIONS && (
                        <Box sx={{ ...type("body-xs"), color: g.text.tertiary }}>
                            {words.conditionLimit}
                        </Box>
                    )}
                </Clause>

                <Clause
                    keyword={words.kwThen}
                    state={clauseState(thenDone, (p) => ["actions", ...ACTION_ORDER].includes(p))}
                    last
                >
                    {actions.map((kind) => (
                        <Line
                            key={kind}
                            error={errors[kind]}
                            errorId={errorId(kind)}
                            lead={actionLabel[kind]}
                            leadWidth={96}
                            removeLabel={fmt(words.removeAction, { action: actionLabel[kind] })}
                            onRemove={() => removeAction(kind)}
                        >
                            {actionSlot(kind)}
                        </Line>
                    ))}
                    {errors.actions && (
                        <Box role="alert" sx={{ ...type("body-xs"), color: g.danger.text }}>
                            {errors.actions}
                        </Box>
                    )}
                    {unused.length > 0 && (
                        <Dropdown>
                            <MenuButton
                                color="neutral"
                                data-slot="add-action"
                                size="sm"
                                startDecorator={<AddRoundedIcon sx={{ fontSize: 16 }} />}
                                sx={quietButtonSx}
                                variant="plain"
                            >
                                {words.addAction}
                            </MenuButton>
                            <MenuSurface placement="bottom-start" zIndex={lookups.popupZ}>
                                {unused.map((kind) => (
                                    <MenuRow key={kind} onClick={() => addAction(kind)}>
                                        {menuLabel[kind]}
                                    </MenuRow>
                                ))}
                            </MenuSurface>
                        </Dropdown>
                    )}
                    {milestone && draft.actions.includes("assignee") && (
                        <Box sx={{ ...type("body-xs"), color: g.text.tertiary }}>
                            {words.milestoneAssignNotice}
                        </Box>
                    )}
                    {moving && draft.destinationId != null && (
                        <Box sx={{ ...type("body-xs"), color: g.text.tertiary }}>
                            {fmt(words.moveNotice, {
                                project:
                                    projectName(lookups, draft.destinationId) ?? words.unknown,
                            })}
                        </Box>
                    )}
                </Clause>
            </Box>
        </Box>
    );
};
