// The ONE label contract of an answer turn.
//
// `AgentTurn` is props-only (it renders above the providers in Spotlight), so
// every word it shows arrives in a single typed object. Every key is
// required: a host that forgets one gets a type error, not an English
// fallback in a Japanese UI (which is how the feedback labels went missing in
// the thread and note modals, see #643).
//
// Three hosts build it, all through `buildAgentTurnLabels` below, so the
// mapping from catalog keys to labels exists once:
//
//   - "spotlight"   Spotlight overlay + Genos page: `t.spotlight.*`
//   - "threadAsk"   the thread Ask modal: its own wording where it has any,
//   - "noteAsk"     the note Ask modal:   Spotlight's for everything else
//   - "taskAsk"     the task / milestone Ask window (MIP-1057): Spotlight's wording throughout
//                   (it has no turn strings of its own), the modals' plain "Note" for a cited note
//
// "Where it has any": the Ask modals keep the strings they already translated
// (Q/A letters, Approve/Reject, Copy/Copied, Ask again, streaming, thinking,
// "Answered in", the approval title). What they never had (the awaiting-
// approval line, "no answer", "+N more", "Show less", the thumbs, the chip and
// entity vocabulary) is Spotlight's, the way the thumbs already were.

import type { Messages } from "../../i18n";
import type { EntitySubtitleLabels } from "../spotlight/SpotlightResultItem";
import type { DroppedLabels } from "./droppedReferences";
import { getToolLabel } from "./toolLabels";
import { buildUndoLabels, type UndoLabels } from "./undoCopy";

type SpotlightMessages = Messages["spotlight"];

// `{subtitle}` / `{id}` / `{sep}` templates for the source chips.
export type ChipLabels = Readonly<Record<keyof SpotlightMessages["chip"], string>>;

export interface AgentTurnLabels {
    // "Q" / "A" gutter letters.
    turnLabelQ: string;
    turnLabelA: string;
    states: {
        // Spinner caption while the stream is open ("streaming…").
        streaming: string;
        // Shown before any text or tool step has arrived.
        thinking: string;
        // Shown while a write tool waits for the user.
        awaitingApproval: string;
        // "Answered in {duration}".
        answeredIn: string;
        // A finished turn with no answer text.
        noAnswer: string;
    };
    actions: {
        approve: string;
        reject: string;
        copyAnswer: string;
        // Copy button tooltip for the two seconds after a copy.
        copied: string;
        retry: string;
        feedbackUp: string;
        feedbackDown: string;
        // "+{count} more" (chip row collapsed) / "Show less" (expanded).
        moreCount: string;
        showLess: string;
    };
    approval: {
        // "Approval required: {toolName}".
        titleWithTool: string;
        // tool_name -> friendly name. A function because the table lives in
        // the `agentApproval` namespace, not in the turn's own.
        toolLabel: (toolName: string) => string;
    };
    // Source chips: "Task PRJ-12: title". `entitySubtitle` is the same
    // vocabulary the Spotlight result rows use.
    chip: ChipLabels;
    entitySubtitle: EntitySubtitleLabels;
    // Undo of an approved write: the control, its tooltip per tool, and a
    // sentence per outcome and refusal. One wording for every host
    // (`agentApproval.undo`); `undoCopy.ts` builds it.
    undo: UndoLabels;
    // What the server could not use of what the ask pointed at (MIP-1058): one sentence per
    // kind it reports, Spotlight's wording for every host (`spotlight.dropped`).
    dropped: DroppedLabels;
    // "Selected text": the quote of a passage the turn was asked about (MIP-1058).
    selectedText: string;
    // Next to the "out of credits" sentence (MIP-1969): where to get more.
    outOfCredits: { buy: string; upgrade: string };
    // Next to "that skill is not installed" (MIP-2589): where to install it.
    skillInstall: { hub: string; team: string };
}

export type AgentTurnHost = "spotlight" | "threadAsk" | "noteAsk" | "taskAsk";

/** Build the turn's labels for a host. Memoise the result on `t` (a new
 *  object every render would defeat the turn's `memo`). */
export const buildAgentTurnLabels = (t: Messages, host: AgentTurnHost): AgentTurnLabels => {
    const sp = t.spotlight;
    // Spotlight's own namespace is the host's own where the host is Spotlight.
    const own = host === "threadAsk" ? t.threadAsk : host === "noteAsk" ? t.noteAsk : null;
    return {
        turnLabelQ: own ? own.conversation.turnLabelQ : sp.conversation.turnLabelQ,
        turnLabelA: own ? own.conversation.turnLabelA : sp.conversation.turnLabelA,
        states: {
            streaming: own ? own.states.streaming : sp.states.streaming,
            thinking: own ? own.states.thinking : sp.states.thinking,
            awaitingApproval: sp.states.awaitingApproval,
            answeredIn: own ? own.states.answeredIn : sp.conversation.answeredIn,
            noAnswer: sp.states.noAnswer,
        },
        actions: {
            approve: own ? own.actions.approve : sp.actions.approve,
            reject: own ? own.actions.reject : sp.actions.reject,
            copyAnswer: own ? own.actions.copyAnswer : sp.actions.copyAnswer,
            copied: own ? own.actions.copied : sp.actions.copied,
            retry: own ? own.actions.retry : sp.actions.retry,
            feedbackUp: sp.actions.feedbackUp,
            feedbackDown: sp.actions.feedbackDown,
            moreCount: sp.actions.moreCount,
            showLess: sp.actions.showLess,
        },
        approval: {
            titleWithTool: own ? own.approval.titleWithTool : sp.approval.titleWithTool,
            toolLabel: (toolName) => getToolLabel(toolName, t),
        },
        chip: sp.chip,
        // A cited personal note reads "My note" / "Team note" / "Shared note"
        // by which space it lives in, which only the host can know (Spotlight
        // gets it from the note manager at the App root). The Ask modals do
        // not pass it yet, and "My note" would be WRONG for a team note, so
        // until they do they say just "Note".
        entitySubtitle:
            host !== "spotlight"
                ? { ...sp.entitySubtitle, notePersonal: sp.entitySubtitle.noteFallback }
                : sp.entitySubtitle,
        undo: buildUndoLabels(t),
        dropped: sp.dropped,
        selectedText: sp.selection.label,
        outOfCredits: {
            buy: t.services.agent.outOfCreditsBuy,
            upgrade: t.services.agent.outOfCreditsUpgrade,
        },
        skillInstall: { hub: sp.skills.openHub, team: sp.skills.openTeam },
    };
};
