/**
 * The rule as one sentence block: When / If / Then, each value a picker. The rail's dot says
 * whether its clause is complete.
 */
import { ReactNode, useId } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
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
import { useProjectStatuses } from "../../../hooks/tasks/useProjectStatuses";
import { fmt, useTranslation } from "../../../i18n";
import { focusRing, g, type } from "../../../theme/tokens";
import { StatusLabel } from "../components/meta/StatusLabel";
import { PRIORITY_NAMES } from "../meta/taskTone";
import { statusRowName } from "../utils/projectStatus";
import { taskMetaLabel } from "../utils/taskMeta";
import {
    ActionKind,
    conditionRow,
    DraftCondition,
    MAX_CONDITIONS,
    MAX_RULE_NAME,
    needsValue,
    RuleDraft,
    StatusPick,
    withDestination,
} from "./draft";
import {
    destinationProjects,
    refusedAsPublic,
    statusKey,
    statusOptions,
    statusRowOf,
    useLookups,
} from "./lookups";
import { fieldName, projectName } from "./RuleSentence";
import { SlotAutocomplete, SlotOption, SlotSelect } from "./slots";
import type { ConditionField, ConditionOp, TriggerType } from "./types";
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
                              : g.border.strong,
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
    <Box data-line sx={{ minWidth: 0 }}>
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
    const words = useAutomationWords();
    const { t } = useTranslation();
    const lookups = useLookups();
    const ids = useId();
    const patch = (change: Partial<RuleDraft>) => onChange({ ...draft, ...change });
    const errorId = (part: string) => `${ids}-${part.replace(":", "-")}`;
    const describe = (part: string) => (errors[part] ? errorId(part) : undefined);

    const moving = draft.actions.includes("move");
    const targetId =
        moving && draft.destinationId != null ? draft.destinationId : lookups.projectId;
    const target = lookups.projects.find((p) => p.projectId === targetId);
    const targetStatuses = useProjectStatuses(targetId).statuses;

    const members: SlotOption[] = lookups.members.map((m) => ({
        value: m.userId,
        label: m.userName,
    }));
    const tagsOf = (tags: { tagName: string }[] | undefined): SlotOption[] =>
        (tags ?? []).map((tag) => ({ value: tag.tagName, label: tag.tagName }));
    const statusSlots = (rows: typeof lookups.statuses, picked: StatusPick | null) => {
        const options = statusOptions(rows);
        const key = picked ? statusKey(picked) : "";
        // A saved pick the list no longer offers (turned off) is still shown.
        const kept = picked && !options.some((o) => o.key === key) && statusRowOf(picked, rows);
        const all = kept ? [...options, { key, pick: picked, row: kept }] : options;
        return {
            value: key,
            options: all.map((o) => ({
                value: o.key,
                label: statusRowName(o.row as never, t.tasks),
                node: <StatusLabel row={o.row} status={o.row.category} />,
            })),
            pickOf: (value: string) => all.find((o) => o.key === value)?.pick ?? null,
        };
    };

    const triggerSlot = () => {
        if (draft.triggerType === "status_changed") {
            const picked = draft.triggerStatus;
            const slots = statusSlots(lookups.statuses, picked);
            return (
                <SlotSelect
                    describedBy={describe("trigger")}
                    invalid={Boolean(errors.trigger)}
                    label={words.fieldStatus}
                    options={slots.options}
                    slotId="trigger"
                    value={slots.value}
                    onChange={(value) => patch({ triggerStatus: slots.pickOf(value) })}
                />
            );
        }
        if (draft.triggerType === "tag_added") {
            return (
                <SlotAutocomplete
                    describedBy={describe("trigger")}
                    invalid={Boolean(errors.trigger)}
                    label={words.fieldTag}
                    options={tagsOf(lookups.current?.projectTags)}
                    slotId="trigger"
                    value={draft.triggerTag}
                    onChange={(triggerTag) => patch({ triggerTag })}
                />
            );
        }
        if (draft.triggerType === "assignee_changed") {
            return (
                <SlotAutocomplete
                    label={words.fieldAssignee}
                    options={[{ value: "anyone", label: words.anyone }, ...members]}
                    value={draft.triggerAssignee || "anyone"}
                    people
                    onChange={(value) =>
                        patch({ triggerAssignee: value === "anyone" ? "" : value })
                    }
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
        const common = {
            describedBy: describe(part),
            invalid: Boolean(errors[part]),
            label: words.valueLabel,
            value: c.value,
            onChange: (value: string) => setCondition(c.key, { value }),
        };
        const field = lookups.fields.find((f) => f.fieldId === c.fieldId);
        if (c.field === "tag") {
            return <SlotAutocomplete {...common} options={tagsOf(lookups.current?.projectTags)} />;
        }
        if (c.field === "assignee" || c.field === "reporter" || field?.fieldType === "member") {
            return <SlotAutocomplete {...common} options={members} people />;
        }
        if (c.field === "priority") {
            return (
                <SlotSelect
                    {...common}
                    options={PRIORITY_NAMES.map((p) => ({
                        value: p,
                        label: taskMetaLabel(p, t.tasks.filters),
                    }))}
                />
            );
        }
        if (c.field === "milestone") {
            return (
                <SlotAutocomplete
                    {...common}
                    options={lookups.milestones.map((m) => ({
                        value: String(m.milestoneId),
                        label: m.title,
                    }))}
                />
            );
        }
        if (c.field === "custom_status") {
            return (
                <SlotSelect
                    {...common}
                    options={lookups.statuses
                        .filter((r) => !r.isArchived || String(r.statusId) === c.value)
                        .map((r) => ({
                            value: String(r.statusId),
                            label: statusRowName(r, t.tasks),
                            node: <StatusLabel row={r} status={r.category} />,
                        }))}
                />
            );
        }
        if (field?.fieldType === "tag") {
            return (
                <SlotAutocomplete
                    {...common}
                    options={field.options.map((o) => ({ value: o.id, label: o.label }))}
                />
            );
        }
        return (
            <Input
                error={common.invalid}
                size="sm"
                slotProps={{
                    input: {
                        "aria-label": words.valueLabel,
                        "aria-describedby": common.describedBy,
                        maxLength: 200,
                    },
                }}
                sx={textSx(common.invalid)}
                type={field?.fieldType === "date" ? "date" : "text"}
                value={c.value}
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

    const addCondition = () => {
        const row = conditionRow();
        patch({ conditions: [...draft.conditions, row] });
        window.setTimeout(
            () =>
                document
                    .querySelector<HTMLElement>(`[data-slot="condition-field-${row.key}"]`)
                    ?.focus(),
            50
        );
    };

    const destinations: SlotOption[] = destinationProjects(lookups).map((p) => ({
        value: String(p.projectId),
        label: p.projectName,
        node: (
            <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                {p.projectName}
                {p.isPrivate && <LockOutlinedIcon sx={{ fontSize: 14 }} />}
            </Box>
        ),
        disabledReason: refusedAsPublic(lookups, p) ? words.privateOnly : undefined,
    }));

    const moveDestination = (value: string) => {
        const next = withDestination(draft, value ? Number(value) : null);
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
        const common = {
            describedBy: describe(kind),
            invalid: Boolean(errors[kind]),
            label: actionLabel[kind],
            slotId: kind,
        };
        if (kind === "move") {
            return (
                <SlotAutocomplete
                    {...common}
                    options={destinations}
                    value={draft.destinationId != null ? String(draft.destinationId) : ""}
                    onChange={moveDestination}
                />
            );
        }
        if (kind === "status") {
            const slots = statusSlots(targetStatuses, draft.setStatus);
            return (
                <SlotSelect
                    {...common}
                    options={slots.options}
                    value={slots.value}
                    onChange={(value) => patch({ setStatus: slots.pickOf(value) })}
                />
            );
        }
        if (kind === "assignee") {
            return (
                <SlotAutocomplete
                    {...common}
                    options={members}
                    value={draft.assigneeId}
                    people
                    onChange={(assigneeId) => patch({ assigneeId })}
                />
            );
        }
        return (
            <SlotAutocomplete
                {...common}
                options={tagsOf(target?.projectTags)}
                value={draft.addTag}
                onChange={(addTag) => patch({ addTag })}
            />
        );
    };

    const actions = ACTION_ORDER.filter((a) => draft.actions.includes(a));
    const unused = ACTION_ORDER.filter((a) => !draft.actions.includes(a));
    const addAction = (kind: ActionKind) => {
        patch({ actions: [...draft.actions, kind] });
        // After the menu has handed focus back to its button.
        window.setTimeout(
            () => document.querySelector<HTMLElement>(`[data-slot="${kind}"]`)?.focus(),
            80
        );
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
                    autoFocus={!draft.name}
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
                    placeholder={words.namePlaceholder}
                    size="sm"
                    slotProps={{
                        input: { maxLength: MAX_RULE_NAME, "data-slot": "name" },
                    }}
                    sx={{ "@media (pointer: coarse)": { minHeight: 44 } }}
                    value={draft.name}
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
                            label={words.triggerLabel}
                            options={[
                                { value: "status_changed", label: words.optStatus },
                                { value: "created", label: words.optCreated },
                                { value: "tag_added", label: words.optTag },
                                { value: "assignee_changed", label: words.optAssignee },
                            ]}
                            slotId="trigger-type"
                            value={draft.triggerType}
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
                            onRemove={() =>
                                patch({ actions: draft.actions.filter((a) => a !== kind) })
                            }
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
