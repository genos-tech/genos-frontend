/** What the rule builder's views ask about a rule, a dry run or a name. */
import { g } from "../../../theme/tokens";
import type { DraftCondition } from "./draft";
import type { Lookups } from "./lookups";
import type { AutomationRule, DryRunResult } from "./types";
import type { AutomationWords } from "./words";

export const coarsePointer = (): boolean =>
    window.matchMedia?.("(pointer: coarse)").matches === true;

/** The server does not name where this rule moves tasks to: the reader is not on it, or it
 *  was deleted. */
export const unnamedDestination = (rule: AutomationRule): boolean =>
    rule.movesTask && rule.destination?.visible === false;

/** The engine turned it off over the destination, so another one has to be chosen. */
const DESTINATION_OFF = new Set(["destination", "destination_not_found"]);

/** The destination project was deleted: there is nothing to hide, only a new one to choose. */
export const destinationGone = (rule: AutomationRule): boolean =>
    rule.movesTask && rule.destination?.gone === true;

/** Nobody who is not on the destination may change a rule that works: that would be changing
 *  what they cannot see. One turned off over its destination, or whose destination was
 *  deleted, can be given a new one. */
export const isHidden = (rule: AutomationRule): boolean =>
    unnamedDestination(rule) &&
    !destinationGone(rule) &&
    !(!rule.enabled && DESTINATION_OFF.has(rule.disabledReason));

/** Why the engine turned it off, with a deleted destination said as that. */
export const turnedOffCode = (rule: AutomationRule): string =>
    destinationGone(rule) && DESTINATION_OFF.has(rule.disabledReason)
        ? "destination_gone"
        : rule.disabledReason;

/** Reasons about the rule itself: every match has it, and turning the rule on is pointless. */
const RULE_LEVEL = new Set([
    "plan",
    "destination_not_found",
    "destination_archived",
    "same_project",
    "private_to_public",
    "readers_outside_source",
    "bad_status",
    "assignee_not_allowed",
    "owner",
    "owner_gone",
    "owner_not_member",
    "owner_not_on_source",
    "owner_not_manager",
    "owner_not_on_destination",
]);

export const ruleProblemOf = (result: DryRunResult): string | null => {
    const reason = result.items[0]?.reason;
    return reason &&
        RULE_LEVEL.has(reason) &&
        result.items.every((i) => i.outcome === "refused" && i.reason === reason)
        ? reason
        : null;
};

export const listSx = {
    listStyle: "none",
    m: 0,
    p: 0,
    border: `1px solid ${g.border.subtle}`,
    borderRadius: g.radius.md,
    "& > li:not(:first-of-type)": { borderTop: `1px solid ${g.border.subtle}` },
} as const;

export const memberName = (lookups: Lookups, id: string): string | undefined =>
    lookups.members.find((m) => m.userId === id)?.userName;

export const projectName = (lookups: Lookups, id: number): string | undefined =>
    lookups.projects.find((p) => p.projectId === id)?.projectName;

export const fieldName = (
    words: AutomationWords,
    field: Exclude<DraftCondition["field"], "custom_field">
): string =>
    ({
        tag: words.fieldTag,
        assignee: words.fieldAssignee,
        reporter: words.fieldReporter,
        priority: words.fieldPriority,
        milestone: words.fieldMilestone,
        custom_status: words.fieldStatus,
    })[field];
