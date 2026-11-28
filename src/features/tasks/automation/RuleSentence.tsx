/**
 * A rule in one sentence: "When …, if …, then …". The words come from whole templates so each
 * language keeps its own order, and the values stand out from the words around them.
 */
import { Fragment, ReactNode } from "react";
import { Box } from "@mui/joy";

import { useProjectStatuses } from "../../../hooks/tasks/useProjectStatuses";
import { useTranslation } from "../../../i18n";
import { g, type } from "../../../theme/tokens";
import { StatusLabel } from "../components/meta/StatusLabel";
import { taskMetaLabel } from "../utils/taskMeta";
import {
    draftOf,
    needsValue,
    type DraftCondition,
    type RuleDraft,
    type StatusPick,
} from "./draft";
import { fmtNodes } from "./fmtNodes";
import {
    destinationGone,
    fieldName,
    forMilestones,
    memberName,
    projectName,
    unnamedDestination,
} from "./helpers";
import { statusRowOf, useLookups } from "./lookups";
import type { AutomationRule } from "./types";
import { useAutomationWords } from "./words";

const Value = ({ children }: { children: ReactNode }) => (
    <Box component="bdi" sx={{ color: g.text.primary, fontWeight: 500 }}>
        {children}
    </Box>
);

/** "a, b and c" in the reader's language. */
const useList = () => {
    const { locale } = useTranslation();
    return (parts: ReactNode[]): ReactNode => {
        if (parts.length < 2) return parts[0] ?? null;
        const format = new Intl.ListFormat(locale, { type: "conjunction" });
        return format
            .formatToParts(parts.map((_, i) => String(i)))
            .map((p, i) => (
                <Fragment key={i}>
                    {p.type === "element" ? parts[Number(p.value)] : p.value}
                </Fragment>
            ));
    };
};

const StatusWord = ({ pick, projectId }: { pick: StatusPick; projectId: number }) => {
    const words = useAutomationWords();
    const { statuses } = useProjectStatuses(projectId, pick.customStatusId);
    const row = statusRowOf(pick, statuses);
    if (!row) return <Value>{words.unknown}</Value>;
    return (
        <Box
            component="span"
            sx={{
                display: "inline-flex",
                verticalAlign: "text-bottom",
                "& [data-status-word]": { color: g.text.primary, fontWeight: 500 },
            }}
        >
            <StatusLabel row={row} status={row.category} />
        </Box>
    );
};

export const RuleSentence = ({
    draft,
    hiddenDestination = false,
    goneDestination = false,
    destinationName,
}: {
    draft: RuleDraft;
    /** The reader is not on the destination: it is not named. */
    hiddenDestination?: boolean;
    /** The destination project was deleted. */
    goneDestination?: boolean;
    destinationName?: string | null;
}) => {
    const words = useAutomationWords();
    const { t } = useTranslation();
    const lookups = useLookups();
    const list = useList();
    const { locale } = useTranslation();
    const person = (id: string) => <Value>{memberName(lookups, id) ?? words.unknown}</Value>;
    const moves = draft.actions.includes("move") || hiddenDestination || goneDestination;
    const target = moves && draft.destinationId != null ? draft.destinationId : lookups.projectId;

    const trigger = (): ReactNode => {
        switch (draft.triggerType) {
            case "created":
                return words.trCreated;
            case "tag_added":
                return fmtNodes(words.trTag, { tag: <Value>{draft.triggerTag || "…"}</Value> });
            case "assignee_changed":
                return draft.triggerAssignee
                    ? fmtNodes(words.trAssigneeTo, { person: person(draft.triggerAssignee) })
                    : words.trAssigneeAny;
            default:
                return fmtNodes(words.trStatus, {
                    status: draft.triggerStatus ? (
                        <StatusWord pick={draft.triggerStatus} projectId={lookups.projectId} />
                    ) : (
                        <Value>…</Value>
                    ),
                });
        }
    };

    const conditionValue = (c: DraftCondition): ReactNode => {
        if (!c.value) return "…";
        switch (c.field) {
            case "assignee":
            case "reporter":
                return memberName(lookups, c.value) ?? words.unknown;
            case "priority":
                return taskMetaLabel(c.value, t.tasks.filters);
            case "milestone":
                return (
                    lookups.milestones.find((m) => String(m.milestoneId) === c.value)?.title ??
                    words.unknown
                );
            case "custom_status":
                return (
                    <StatusWord
                        pick={{ category: "", customStatusId: Number(c.value) }}
                        projectId={lookups.projectId}
                    />
                );
            case "custom_field": {
                const field = lookups.fields.find((f) => f.fieldId === c.fieldId);
                if (field?.fieldType === "tag") {
                    return field.options.find((o) => o.id === c.value)?.label ?? words.unknown;
                }
                if (field?.fieldType === "member") {
                    return memberName(lookups, c.value) ?? words.unknown;
                }
                return c.value;
            }
            default:
                return c.value;
        }
    };

    const condition = (c: DraftCondition): ReactNode => {
        const field =
            c.field === "custom_field"
                ? (lookups.fields.find((f) => f.fieldId === c.fieldId)?.fieldName ?? words.unknown)
                : // Mid-sentence, a built-in field is not a heading.
                  fieldName(words, c.field).toLocaleLowerCase(locale);
        const template = needsValue(c.op)
            ? c.op === "is"
                ? words.cIs
                : words.cIsNot
            : c.op === "is_set"
              ? words.cSet
              : words.cNotSet;
        return fmtNodes(template, {
            field: <bdi>{field}</bdi>,
            value: <Value>{conditionValue(c)}</Value>,
        });
    };

    const actions: ReactNode[] = [];
    if (goneDestination) actions.push(words.aMoveGone);
    else if (hiddenDestination) actions.push(words.aMoveHidden);
    else if (draft.actions.includes("move")) {
        const name =
            destinationName ??
            (draft.destinationId != null ? projectName(lookups, draft.destinationId) : "…");
        actions.push(fmtNodes(words.aMove, { project: <Value>{name ?? words.unknown}</Value> }));
    }
    if (draft.actions.includes("status")) {
        actions.push(
            fmtNodes(words.aStatus, {
                status: draft.setStatus ? (
                    <StatusWord pick={draft.setStatus} projectId={target} />
                ) : (
                    <Value>…</Value>
                ),
            })
        );
    }
    if (draft.actions.includes("assignee")) {
        actions.push(
            fmtNodes(words.aAssign, {
                person: draft.assigneeId ? person(draft.assigneeId) : <Value>…</Value>,
            })
        );
    }
    if (draft.actions.includes("tag")) {
        actions.push(fmtNodes(words.aTag, { tag: <Value>{draft.addTag || "…"}</Value> }));
    }

    const conditions = draft.conditions.map(condition);
    return (
        <Box
            component="span"
            data-testid="rule-sentence"
            sx={{
                ...type("body-sm"),
                display: "block",
                color: g.text.secondary,
                overflowWrap: "anywhere",
            }}
        >
            {fmtNodes(conditions.length ? words.sentenceIf : words.sentenceNoIf, {
                trigger: <>{trigger()}</>,
                conditions: (
                    <>{list(conditions.map((n, i) => <Fragment key={i}>{n}</Fragment>))}</>
                ),
                actions: <>{list(actions.map((n, i) => <Fragment key={i}>{n}</Fragment>))}</>,
            })}
        </Box>
    );
};

/** A saved rule's line: its sentence, or why this screen cannot say it. */
export const RuleSummary = ({ rule }: { rule: AutomationRule }) => {
    const words = useAutomationWords();
    if (forMilestones(rule)) {
        return (
            <Box
                component="span"
                sx={{ ...type("body-sm"), display: "block", color: g.text.secondary }}
            >
                {words.milestoneRule}
            </Box>
        );
    }
    return (
        <RuleSentence
            destinationName={rule.destination?.name}
            draft={draftOf(rule)}
            goneDestination={destinationGone(rule)}
            hiddenDestination={unnamedDestination(rule)}
        />
    );
};
