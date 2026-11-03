// Conversation panel for the agent-Q&A modals (thread ask, note ask): the list
// of finished turns followed by the in-flight turn (if any), plus an
// empty-state hint when there's nothing yet. The hosting modal handles the
// surrounding chrome: section header, summary, save/clear footer, etc.
//
// Each turn is an `AgentTurn`, the same component Spotlight renders. This file
// is the CONTAINER half: it lives inside the providers, so it is the one place
// that reads the UrlLinkModal context and decides what a click on a source does
// (quick-look modal first, else the host's `onSelectSource`), and it hands
// every turn the stable props that keep the turns' memo working.
//
// Citations resolve across the whole conversation, not per turn: the server
// replays earlier answers into the model's prompt, so on turn 3 the model may
// re-cite a source that was only retrieved on turn 1. Chips stay per-turn.

import { useCallback, useMemo, useRef } from "react";
import { Stack, Typography } from "@mui/joy";

import { useUrlLinkModal } from "../../hooks/common/UrlLinkModalContext";
import { SpotlightResult } from "../spotlight/types";
import { AgentTurn } from "./AgentTurn";
import type { AgentTurnLabels } from "./agentTurnLabels";
import { buildSourcesById, sourceToUrl } from "./citationUtils";
import type { AgentMentionRef } from "./mentions/types";
import type { AgentQALabels, UseAgentQAReturn } from "./types";

interface AgentQAConversationProps {
    state: UseAgentQAReturn;
    labels: AgentQALabels;
    // The words of a turn (see `buildAgentTurnLabels`). Memoise on `t`.
    turnLabels: AgentTurnLabels;
    isDark: boolean;
    onSelectSource?: (source: SpotlightResult) => void;
    // Note id -> sidebar space, so a cited team note reads "Team note". The
    // modals don't have it yet; absent, every personal note reads "My note".
    noteScopes?: ReadonlyMap<number, "shared" | "team">;
}

// Stable identity for a turn restored without sources.
const NO_SOURCES: SpotlightResult[] = [];

export const AgentQAConversation = ({
    state,
    labels,
    turnLabels,
    isDark,
    onSelectSource,
    noteScopes,
}: AgentQAConversationProps) => {
    const urlLinkModal = useUrlLinkModal();

    // Stable identities for the callbacks handed to every AgentTurn.
    // `state.onAsk` re-mints per keystroke (it closes over the live
    // query) and the hosts' `onSelectSource` may be an inline lambda —
    // either would defeat the turn's memo, re-parsing every past
    // turn's markdown on each keystroke. Ref-backed wrappers keep the
    // prop identity constant while always invoking the latest handler.
    const onRetryRef = useRef(state.onAsk);
    onRetryRef.current = state.onAsk;
    const onRetry = useCallback(
        (askedQuery: string, mentions?: AgentMentionRef[]) =>
            onRetryRef.current?.(askedQuery, mentions),
        []
    );
    const onFeedbackRef = useRef(state.submitFeedback);
    onFeedbackRef.current = state.submitFeedback;
    const onFeedback = useCallback(
        (runId: string, rating: number) => onFeedbackRef.current?.(runId, rating),
        []
    );
    // A click on an inline citation or a source chip: try the UrlLinkModal
    // preview first (quick-look without losing the conversation), fall back to
    // the host's `onSelectSource` navigate handler when there's no preview —
    // outside a UrlLinkModalProvider, no deep-link URL for the source, or an
    // entity kind that isn't modal-able (projects).
    const urlLinkModalRef = useRef(urlLinkModal);
    urlLinkModalRef.current = urlLinkModal;
    const onSelectSourceRef = useRef(onSelectSource);
    onSelectSourceRef.current = onSelectSource;
    const onPreview = useCallback((source: SpotlightResult) => {
        const previewHref = sourceToUrl(source);
        const modal = urlLinkModalRef.current;
        if (previewHref && modal) {
            const outcome = modal.openModalByHref(previewHref);
            if (outcome === "opened") return;
        }
        onSelectSourceRef.current?.(source);
    }, []);

    // Aggregate every source ever cited in this conversation so a token
    // emitted on turn 1 still resolves on turn 3's answer. Dedup by
    // entity_id since the same task / chat / note may be cited many
    // times across turns.
    const sourcesById = useMemo(() => {
        const acc: SpotlightResult[] = [];
        const seen = new Set<string>();
        const push = (src?: SpotlightResult[]) => {
            for (const s of src || []) {
                const k = `${s.entity_type}:${s.entity_id}`;
                if (seen.has(k)) continue;
                seen.add(k);
                acc.push(s);
            }
        };
        for (const turn of state.turns) push(turn.answerSources);
        push(state.ask.answerSources);
        return buildSourcesById(acc);
    }, [state.turns, state.ask.answerSources]);

    const { ask } = state;
    const hasInFlightAnswer =
        ask.isStreaming ||
        ask.askError ||
        ask.answer ||
        ask.toolEvents.length > 0 ||
        // A paused write-tool approval is also "in flight" — without
        // this the in-flight turn (which owns the ApprovalCard) wouldn't
        // render when the agent stops at a `create_task` / `add_comment`
        // / etc. and the user couldn't approve or reject.
        ask.pendingApproval !== null;

    if (state.turns.length === 0 && !hasInFlightAnswer) {
        return (
            <Typography level="body-sm" sx={{ color: "text.tertiary", py: 1 }}>
                {labels.conversation.empty}
            </Typography>
        );
    }

    // Ask again is off while a turn streams or waits on an approval: a second
    // ask would race the first (same rule as Spotlight's).
    const askDisabled = ask.isStreaming || ask.pendingApproval !== null;

    return (
        <Stack spacing={1.5} sx={{ mb: 1 }}>
            {state.turns.map((turn) => (
                <AgentTurn
                    key={turn.id}
                    answer={turn.answer}
                    answerSources={turn.answerSources ?? NO_SOURCES}
                    askDisabled={askDisabled}
                    askedQuery={turn.askedQuery}
                    askError={turn.askError}
                    elapsedMs={turn.elapsedMs}
                    isCurrent={false}
                    isDark={isDark}
                    labels={turnLabels}
                    mentions={turn.mentions}
                    noteScopes={noteScopes}
                    runId={turn.runId}
                    sourcesById={sourcesById}
                    toolEvents={turn.toolEvents}
                    onFeedback={onFeedback}
                    onPreview={onPreview}
                    onRetry={onRetry}
                />
            ))}
            {hasInFlightAnswer ? (
                <AgentTurn
                    answer={ask.answer}
                    answerSources={ask.answerSources ?? NO_SOURCES}
                    askDisabled={askDisabled}
                    askedQuery={ask.askedQuery}
                    askError={ask.askError}
                    elapsedMs={ask.elapsedMs}
                    isDark={isDark}
                    isStreaming={ask.isStreaming}
                    labels={turnLabels}
                    mentions={ask.askedMentions}
                    noteScopes={noteScopes}
                    pendingApproval={ask.pendingApproval}
                    runId={ask.runId}
                    sourcesById={sourcesById}
                    toolEvents={ask.toolEvents}
                    isCurrent
                    onApprove={state.onApprove}
                    onFeedback={onFeedback}
                    onPreview={onPreview}
                    onReject={state.onReject}
                    onRetry={onRetry}
                />
            ) : null}
        </Stack>
    );
};
