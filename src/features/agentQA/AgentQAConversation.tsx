// Conversation panel for agent-Q&A surfaces. Renders the list of
// completed turns followed by the in-flight turn (if any), plus an
// empty-state hint when there's nothing yet. The hosting wrapper
// (ThreadAskModal / future NoteAskModal) handles the surrounding
// chrome — section header, summary, save/clear footer, etc.
//
// Sources for citation resolution are aggregated across every turn +
// the live ask, so a token emitted on turn 1 still resolves on turn 3.

import { memo, useCallback, useMemo, useRef, useState } from "react";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import { Box, IconButton, Stack, Typography } from "@mui/joy";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { AppTooltip } from "../../components/ui/AppTooltip";
import { useTranslation } from "../../i18n";
import { SpotlightResult } from "../spotlight/types";
import { ApprovalCard } from "./ApprovalCard";
import { agentQAUrlTransform, CitationAnchor } from "./CitationAnchor";
import { buildSourcesById, citedChipSources, rewriteCitations } from "./citationUtils";
import { FeedbackThumbs } from "./FeedbackThumbs";
import { markdownAnswerSx } from "./markdownAnswerSx";
import type { AgentMentionRef } from "./mentions/types";
import { SourceChips } from "./SourceChips";
import { getToolLabel } from "./toolLabels";
import { formatDurationMs, ToolProgressList } from "./ToolProgressList";
import type { AgentQALabels, CompletedTurn, UseAgentQAReturn } from "./types";

interface AgentQAConversationProps {
    state: UseAgentQAReturn;
    labels: AgentQALabels;
    isDark: boolean;
    onSelectSource?: (source: SpotlightResult) => void;
}

export const AgentQAConversation = ({
    state,
    labels,
    isDark,
    onSelectSource,
}: AgentQAConversationProps) => {
    // Stable identities for the callbacks handed to every TurnRow.
    // `state.onAsk` re-mints per keystroke (it closes over the live
    // query) and the hosts' `onSelectSource` may be an inline lambda —
    // either would defeat TurnRow's memo below, re-parsing every past
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
    const onSelectSourceRef = useRef(onSelectSource);
    onSelectSourceRef.current = onSelectSource;
    const onSelectSourceStable = useCallback(
        (source: SpotlightResult) => onSelectSourceRef.current?.(source),
        []
    );
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

    const hasInFlightAnswer =
        state.ask.isStreaming ||
        state.ask.askError ||
        state.ask.answer ||
        state.ask.toolEvents.length > 0 ||
        // A paused write-tool approval is also "in flight" — without
        // this the InFlightTurn (which owns the ApprovalCard) wouldn't
        // render when the agent stops at a `create_task` / `add_comment`
        // / etc. and the user couldn't approve or reject.
        state.ask.pendingApproval !== null;

    if (state.turns.length === 0 && !hasInFlightAnswer) {
        return (
            <Typography level="body-sm" sx={{ color: "text.tertiary", py: 1 }}>
                {labels.conversation.empty}
            </Typography>
        );
    }

    return (
        <Stack spacing={1.5} sx={{ mb: 1 }}>
            {state.turns.map((turn) => (
                <TurnRow
                    key={turn.id}
                    isDark={isDark}
                    labels={labels}
                    sourcesById={sourcesById}
                    turn={turn}
                    onRetry={onRetry}
                    onFeedback={onFeedback}
                    onSelectSource={onSelectSourceStable}
                />
            ))}
            {hasInFlightAnswer ? (
                <InFlightTurn
                    isDark={isDark}
                    labels={labels}
                    sourcesById={sourcesById}
                    state={state}
                    onSelectSource={onSelectSource}
                />
            ) : null}
        </Stack>
    );
};

// One past Q&A turn rendered as a card-ish block.
const TurnRowInner = ({
    turn,
    labels,
    isDark,
    sourcesById,
    onSelectSource,
    onRetry,
    onFeedback,
}: {
    turn: CompletedTurn;
    labels: AgentQALabels;
    isDark: boolean;
    sourcesById: Map<string, SpotlightResult>;
    onSelectSource?: (source: SpotlightResult) => void;
    onRetry?: (askedQuery: string, mentions?: AgentMentionRef[]) => void;
    onFeedback?: (runId: string, rating: number) => void;
}) => {
    const [copied, setCopied] = useState(false);
    const showFeedback = Boolean(turn.runId) && Boolean(onFeedback) && !turn.askError;
    const handleCopy = () => {
        if (!turn.answer) return;
        navigator.clipboard
            .writeText(turn.answer)
            .then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 2000);
            })
            .catch(() => {
                /* non-secure context — ignore */
            });
    };
    const handleRetry = () => onRetry?.(turn.askedQuery, turn.mentions);
    const showCopy = Boolean(turn.answer);
    const showRetry = Boolean(turn.askedQuery) && Boolean(onRetry);
    const rewritten = useMemo(
        () => rewriteCitations(turn.answer || "(no answer)", sourcesById),
        [turn.answer, sourcesById]
    );
    // Chip row = the sources this answer cited, in either form (inline
    // link or bare token); uncited retrieved sources are dropped as noise.
    // An inline-cited source appears both in the prose and here. Computed
    // against the turn's own sources rather than the cross-turn
    // `sourcesById` because chips should reflect "what this answer
    // referenced", not the running session total.
    const chipSources = useMemo(
        () => citedChipSources(turn.answer || "", turn.answerSources || []),
        [turn.answer, turn.answerSources]
    );
    return (
        <Box
            sx={{
                borderLeft: `3px solid ${
                    isDark ? "rgba(99,102,241,0.5)" : "rgba(99,102,241,0.4)"
                }`,
                pl: 1.5,
                py: 0.25,
            }}
        >
            <Typography level="body-sm" sx={{ fontWeight: 600, color: "text.primary", mb: 0.5 }}>
                {labels.conversation.turnLabelQ}: {turn.askedQuery}
            </Typography>
            {/* Tool-progress strip: replays the steps the agent took to
                produce this answer. */}
            <ToolProgressList events={turn.toolEvents} isDark={isDark} />
            {turn.askError ? (
                <Typography level="body-sm" sx={{ color: "danger.softColor" }}>
                    {labels.conversation.turnLabelA}: {turn.askError}
                </Typography>
            ) : (
                <Box sx={markdownAnswerSx(isDark)}>
                    <Typography component="span" level="body-sm" sx={{ fontWeight: 600, mr: 0.5 }}>
                        {labels.conversation.turnLabelA}:
                    </Typography>
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        urlTransform={agentQAUrlTransform}
                        components={{
                            a: ({ href, children }) => (
                                <CitationAnchor
                                    href={href}
                                    isDark={isDark}
                                    sourcesById={sourcesById}
                                    onSelectSource={onSelectSource}
                                >
                                    {children}
                                </CitationAnchor>
                            ),
                        }}
                    >
                        {rewritten}
                    </ReactMarkdown>
                    <SourceChips sources={chipSources} onSelectSource={onSelectSource} />
                </Box>
            )}
            {/* Total response time (server-measured, from `done`).
                Error turns skip it — their timing is noise. */}
            {!turn.askError && typeof turn.elapsedMs === "number" && (
                <Typography
                    level="body-xs"
                    sx={{
                        mt: 0.25,
                        fontVariantNumeric: "tabular-nums",
                        color: "text.tertiary",
                    }}
                >
                    {(labels.states.answeredIn ?? "Answered in {duration}").replace(
                        "{duration}",
                        formatDurationMs(turn.elapsedMs)
                    )}
                </Typography>
            )}
            {(showCopy || showRetry || showFeedback) && (
                <Box
                    sx={{
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: 0.25,
                        mt: 0.25,
                    }}
                >
                    {showFeedback && (
                        <FeedbackThumbs
                            labels={{
                                up: labels.actions.feedbackUp,
                                down: labels.actions.feedbackDown,
                            }}
                            runId={turn.runId}
                            onFeedback={onFeedback}
                        />
                    )}
                    {showCopy && (
                        <AppTooltip
                            title={copied ? labels.actions.copied : labels.actions.copyAnswer}
                        >
                            <IconButton
                                color={copied ? "success" : "neutral"}
                                size="sm"
                                sx={{ minWidth: 0, p: "3px" }}
                                variant="plain"
                                onClick={handleCopy}
                            >
                                {copied ? (
                                    <CheckRoundedIcon sx={{ fontSize: 14 }} />
                                ) : (
                                    <ContentCopyRoundedIcon sx={{ fontSize: 14 }} />
                                )}
                            </IconButton>
                        </AppTooltip>
                    )}
                    {showRetry && (
                        <AppTooltip title={labels.actions.retry}>
                            <IconButton
                                color="neutral"
                                size="sm"
                                sx={{ minWidth: 0, p: "3px" }}
                                variant="plain"
                                onClick={handleRetry}
                            >
                                <ReplayRoundedIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                        </AppTooltip>
                    )}
                </Box>
            )}
        </Box>
    );
};

// Memo: a past turn's props only change when the conversation itself
// changes (new turn / new sources), so typing in the input and
// `answer_delta` streaming skip re-rendering every prior turn's
// ReactMarkdown parse. Same pattern (and rationale) as Spotlight's
// `TurnView`; requires the stable callback wrappers built in
// `AgentQAConversation` above.
const TurnRow = memo(TurnRowInner);

// The currently-streaming or just-errored turn (not yet promoted into
// the turns history).
const InFlightTurn = ({
    state,
    labels,
    isDark,
    sourcesById,
    onSelectSource,
}: {
    state: UseAgentQAReturn;
    labels: AgentQALabels;
    isDark: boolean;
    sourcesById: Map<string, SpotlightResult>;
    onSelectSource?: (source: SpotlightResult) => void;
}) => {
    const { t } = useTranslation();
    const { ask } = state;
    // "Thinking…" placeholder shown when the stream is active but no
    // tool calls or answer text have landed yet — gives the user
    // immediate feedback that something IS happening (and isn't a stall).
    const showThinking =
        ask.isStreaming &&
        !ask.answer &&
        !ask.askError &&
        ask.toolEvents.length === 0 &&
        !ask.pendingApproval;
    const rewritten = useMemo(
        () => rewriteCitations(ask.answer || "", sourcesById),
        [ask.answer, sourcesById]
    );
    const chipSources = useMemo(
        () => citedChipSources(ask.answer || "", ask.answerSources || []),
        [ask.answer, ask.answerSources]
    );
    return (
        <Box
            sx={{
                borderLeft: `3px solid ${isDark ? "rgba(34,197,94,0.6)" : "rgba(34,197,94,0.5)"}`,
                pl: 1.5,
                py: 0.25,
            }}
        >
            <Typography level="body-sm" sx={{ fontWeight: 600, color: "text.primary", mb: 0.5 }}>
                {labels.conversation.turnLabelQ}: {ask.askedQuery}
            </Typography>
            {/* Tool-progress strip — same as past turns. Shown live as
                the agent advances through tool calls. */}
            <ToolProgressList events={ask.toolEvents} isDark={isDark} />
            {showThinking && (
                <Typography
                    level="body-sm"
                    sx={{
                        color: "text.tertiary",
                        fontStyle: "italic",
                        mt: 0.25,
                        mb: 0.5,
                    }}
                >
                    {labels.states.thinking}
                </Typography>
            )}
            {ask.pendingApproval && (
                <ApprovalCard
                    approveLabel={labels.actions.approve}
                    isDark={isDark}
                    pending={ask.pendingApproval}
                    rejectLabel={labels.actions.reject}
                    titleText={labels.approval.titleWithTool.replace(
                        "{toolName}",
                        getToolLabel(ask.pendingApproval.tool_name, t)
                    )}
                    onApprove={state.onApprove}
                    onReject={state.onReject}
                />
            )}
            {ask.askError ? (
                <Typography level="body-sm" sx={{ color: "danger.softColor" }}>
                    {labels.conversation.turnLabelA}: {ask.askError}
                </Typography>
            ) : (
                <Box sx={markdownAnswerSx(isDark)}>
                    <Typography component="span" level="body-sm" sx={{ fontWeight: 600, mr: 0.5 }}>
                        {labels.conversation.turnLabelA}:
                    </Typography>
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        urlTransform={agentQAUrlTransform}
                        components={{
                            a: ({ href, children }) => (
                                <CitationAnchor
                                    href={href}
                                    isDark={isDark}
                                    sourcesById={sourcesById}
                                    onSelectSource={onSelectSource}
                                >
                                    {children}
                                </CitationAnchor>
                            ),
                        }}
                    >
                        {rewritten}
                    </ReactMarkdown>
                    {/* Show chips only AFTER the stream finishes — while
                        text is still arriving the sources list keeps
                        growing and a partial chip row would jitter. */}
                    {!ask.isStreaming && (
                        <SourceChips sources={chipSources} onSelectSource={onSelectSource} />
                    )}
                    {ask.isStreaming ? (
                        <Typography
                            level="body-xs"
                            sx={{ color: "text.tertiary", fontStyle: "italic", mt: 0.5 }}
                        >
                            {labels.states.streaming}
                        </Typography>
                    ) : null}
                </Box>
            )}
        </Box>
    );
};
