// AgentTurn: ONE answer turn (question, steps, answer, sources, actions),
// rendered the same way everywhere an agent answers.
//
// Used for a FINISHED turn and for the IN-FLIGHT turn (`isCurrent`), by every
// host: Spotlight's overlay and the Genos page (`SpotlightContent`), and the
// thread and note Ask modals (`AgentQAConversation`).
//
// WHY THE CONTAINERS STAY TWO (and only the turn is shared)
//   Spotlight lives at the App root, above the Avatar / project / UrlLinkModal
//   providers: a fixed backdrop at z 13100 on desktop (`SpotlightOverlay`), a
//   full-width layout on mobile, or the Genos page (`variant="page"`). The
//   thread and note asks are Joy Modals mounted inside those providers. Their
//   scroll containers, sizing, focus handling and what a click on a source
//   does (Spotlight's own preview router vs the quick-look modal) differ for
//   real reasons, so each keeps its own container. What the user reads inside
//   one answer has no such reason to differ, and used to drift: this is that
//   part, written once.
//
// PROPS-ONLY
//   No context is read and no host is known. Every word arrives in `labels`
//   (see `AgentTurnLabels`), colour in `isDark`, and every action goes out
//   through a callback, so the turn renders identically above or inside the
//   providers. (`ToolProgressList` and the approval previews read the i18n
//   context, which is mounted at the very root.)
//
// RENDER BUDGET
//   App-root writes re-render the whole app (the render storm), so a turn must
//   cost nothing when nothing about it changed. Wrapped in `memo`. A host must
//   hand it stable props: the callbacks behind refs, `labels` memoised on `t`,
//   the turn's own arrays by identity. Then a streamed `answer_delta`
//   re-renders only the in-flight turn, and typing or any App-root write
//   re-renders none. The markdown parse is the expense, and has its own memo
//   boundary (`AnswerMarkdown`) so even a re-render of the turn does not
//   re-parse the answer.
//
// EXTENSION POINTS (so a later change does not reopen this file)
//   - `renderExtraActions`: extra buttons in the per-turn action bar ("Save as
//     note", "Undo"); handed everything an action needs to know about the turn.
//   - `onApprove`: typed as the ApprovalCard's own `onApprove`, handed to it
//     untouched, so an approval that carries an edited payload flows through
//     here with no change.

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import { Box, CircularProgress, IconButton, Typography } from "@mui/joy";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { AppTooltip } from "../../components/ui/AppTooltip";
import { fmt } from "../../i18n";
import type { PendingApprovalPayload } from "../../services/agentApi";
import { entitySubtitle } from "../spotlight/SpotlightResultItem";
import type { SpotlightResult } from "../spotlight/types";
import { agentMarkdownComponents } from "./agentMarkdown";
import type { AgentTurnLabels } from "./agentTurnLabels";
import { SourceChipRow } from "./AgentTurnSources";
import { ApprovalCard } from "./ApprovalCard";
import { CitationLink } from "./CitationLink";
import {
    agentQAUrlTransform,
    buildSourcesById,
    citedChipSources,
    rewriteCitations,
} from "./citationUtils";
import { FeedbackThumbs } from "./FeedbackThumbs";
import {
    DARK_TEXT_MEDIUM,
    DARK_TEXT_SOFT,
    DARK_TEXT_STRONG,
    markdownAnswerSx,
} from "./markdownAnswerSx";
import type { AgentMentionRef } from "./mentions/types";
import { formatDurationMs, ToolProgressList } from "./ToolProgressList";
import type { ToolEvent } from "./types";

/** What a per-turn action needs to know about the turn it sits on. */
export interface AgentTurnActionContext {
    askedQuery: string;
    answer: string;
    answerSources: readonly SpotlightResult[];
    toolEvents: readonly ToolEvent[];
    // AgentRun id once the turn has finished; absent for error / cancelled /
    // legacy turns.
    runId: string | null | undefined;
    // True for the in-flight turn, false for a finished one.
    isCurrent: boolean;
    isStreaming: boolean;
    hasError: boolean;
    // The host cannot start another ask right now (a turn is streaming or
    // awaiting approval).
    askDisabled: boolean;
}

export interface AgentTurnProps {
    askedQuery: string;
    answer: string;
    // Retrieved sources for THIS turn: they feed the chip row (cited ones
    // only) and, unless `sourcesById` is given, citation resolution.
    answerSources: SpotlightResult[];
    // Citation lookup override. Default: built from this turn's own
    // `answerSources` (what Spotlight does). The Ask modals pass one spanning
    // the whole conversation, because the server replays earlier answers into
    // the prompt and the model may re-cite a turn-1 source on turn 3. Chips
    // stay per-turn either way.
    sourcesById?: ReadonlyMap<string, SpotlightResult>;
    toolEvents: ToolEvent[];
    askError: string | null;
    // The in-flight turn (shows the spinner, "thinking" and the approval
    // card) as opposed to a finished one.
    isCurrent: boolean;
    isStreaming?: boolean;
    pendingApproval?: PendingApprovalPayload | null;
    isDark: boolean;
    labels: AgentTurnLabels;
    // Total server-side response time from `done`. Null / absent for error
    // and cancelled turns and against older backends: the line is omitted.
    elapsedMs?: number | null;
    // The structured mentions the turn was asked with; Retry re-sends them.
    mentions?: AgentMentionRef[];
    // AgentRun id keying the 👍/👎 feedback. Absent: no thumbs.
    runId?: string | null;
    // Lets a cited note read "Team note" rather than "My note".
    noteScopes?: ReadonlyMap<number, "shared" | "team">;
    // The host will not take another ask right now: Retry is disabled.
    askDisabled?: boolean;
    // A click on a citation link or a source chip. What it does (preview,
    // navigate) is the host's call.
    onPreview: (source: SpotlightResult) => void;
    // Handed to the ApprovalCard untouched; see the header.
    onApprove?: React.ComponentProps<typeof ApprovalCard>["onApprove"];
    onReject?: () => void;
    // Takes the question rather than being pre-bound, so the host's callback
    // can stay one stable identity across every turn.
    onRetry?: (askedQuery: string, mentions?: AgentMentionRef[]) => void;
    onFeedback?: (runId: string, rating: number) => void;
    // Extra per-turn actions, rendered in the action bar before the built-ins.
    // Keep the function's identity stable; it is called on every render of
    // the turn.
    renderExtraActions?: (ctx: AgentTurnActionContext) => React.ReactNode;
}

// The markdown parse, on its own memo boundary. The turn re-renders for plenty
// that has nothing to do with the answer text (a copy flips its icon, `askDisabled`
// flips on every host's stream start and end); none of that re-parses the answer.
const AnswerMarkdown = memo(
    ({
        text,
        isDark,
        sourcesById,
        onPreview,
    }: {
        text: string;
        isDark: boolean;
        sourcesById: ReadonlyMap<string, SpotlightResult>;
        onPreview: (source: SpotlightResult) => void;
    }) => (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            urlTransform={agentQAUrlTransform}
            components={{
                ...agentMarkdownComponents,
                a: ({ href, children }) => (
                    <CitationLink
                        href={href}
                        isDark={isDark}
                        sourcesById={sourcesById}
                        onPreview={onPreview}
                    >
                        {children}
                    </CitationLink>
                ),
            }}
        >
            {text}
        </ReactMarkdown>
    )
);
AnswerMarkdown.displayName = "AnswerMarkdown";

const AgentTurnInner = ({
    askedQuery,
    answer,
    answerSources,
    sourcesById: sourcesByIdOverride,
    toolEvents,
    askError,
    isCurrent,
    isStreaming,
    pendingApproval,
    isDark,
    labels,
    elapsedMs,
    mentions,
    runId,
    noteScopes,
    askDisabled,
    onPreview,
    onApprove,
    onReject,
    onRetry,
    onFeedback,
    renderExtraActions,
}: AgentTurnProps) => {
    const [copied, setCopied] = useState(false);
    const copiedTimerRef = useRef<number | null>(null);
    useEffect(
        () => () => {
            if (copiedTimerRef.current !== null) window.clearTimeout(copiedTimerRef.current);
        },
        []
    );

    const handleRetry = useCallback(() => {
        if (onRetry) onRetry(askedQuery, mentions);
    }, [onRetry, askedQuery, mentions]);

    // Look-up table for `rewriteCitations` and the anchor override below,
    // rebuilt only when the sources array changes, not on every streamed
    // `answer_delta`. `buildSourcesById` normalises chat entity ids (which
    // ship without the `chat:` prefix) to the form the model cites.
    const ownSourcesById = useMemo(
        () => buildSourcesById(sourcesByIdOverride ? [] : answerSources),
        [sourcesByIdOverride, answerSources]
    );
    const sourcesById = sourcesByIdOverride ?? ownSourcesById;

    // The stand-in for a title-less source whose raw-token link label had to
    // be replaced: its task id, else the localized kind word.
    const fallbackLabel = useCallback(
        (s: SpotlightResult) =>
            (s.entity_type === "task" && s.task_display_id) ||
            entitySubtitle(s, labels, noteScopes),
        [labels, noteScopes]
    );

    const answerForRender = useMemo(
        () => rewriteCitations(answer, sourcesById, fallbackLabel),
        [answer, sourcesById, fallbackLabel]
    );

    // Chip row = the sources the answer cited, in either form (inline
    // `[prose](type:id)` link or bare `[type:id]` token); uncited retrieved
    // sources are dropped as noise (§4.6). Always against THIS turn's sources:
    // a chip says "what this answer referenced", not the session total.
    const chipSources = useMemo(
        () => citedChipSources(answer, answerSources),
        [answer, answerSources]
    );

    const handleCopy = useCallback(() => {
        if (!answer) return;
        navigator.clipboard
            .writeText(answer)
            .then(() => {
                setCopied(true);
                if (copiedTimerRef.current !== null) window.clearTimeout(copiedTimerRef.current);
                copiedTimerRef.current = window.setTimeout(() => {
                    copiedTimerRef.current = null;
                    setCopied(false);
                }, 2000);
            })
            .catch(() => {
                /* ignore — e.g. non-secure context */
            });
    }, [answer]);

    // "Thinking…" while the stream is open and nothing has shown up yet.
    // Not while a write waits for the user: they are the thing being waited on.
    const showThinking = isCurrent && isStreaming && !answer && !askError && !pendingApproval;
    // A finished turn that produced no text and did not fail.
    const showNoAnswer = !isCurrent && !askError && !answer;
    // Show copy for any turn with answer text.
    // Show retry for finished turns (always) and for the in-flight turn when
    // it errored.
    const showCopy = Boolean(answer);
    const showRetry = Boolean(askedQuery) && Boolean(onRetry) && (!isCurrent || Boolean(askError));
    // Thumbs need a run id to key the POST, and only make sense on a
    // finished, non-error answer.
    const showFeedback = Boolean(runId) && Boolean(onFeedback) && !askError && !isStreaming;

    const extraActions = renderExtraActions
        ? renderExtraActions({
              askedQuery,
              answer,
              answerSources,
              toolEvents,
              runId,
              isCurrent,
              isStreaming: Boolean(isStreaming),
              hasError: Boolean(askError),
              askDisabled: Boolean(askDisabled),
          })
        : null;
    const showActions = showCopy || showRetry || showFeedback || Boolean(extraActions);

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                gap: 0.5,
                opacity: isCurrent ? 1 : isDark ? 1 : 0.92,
                // Reveal action buttons on hover; always visible on touch devices.
                "& .turn-actions": { opacity: 0, transition: "opacity 0.15s" },
                "&:hover .turn-actions": { opacity: 1 },
                "&:focus-within .turn-actions": { opacity: 1 },
                "@media (hover: none)": { "& .turn-actions": { opacity: 1 } },
            }}
        >
            {askedQuery && (
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 0.75,
                        opacity: isDark ? 1 : 0.88,
                    }}
                >
                    <Typography
                        level="body-sm"
                        sx={{
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                            opacity: isDark ? 1 : 0.7,
                            color: isDark ? DARK_TEXT_MEDIUM : undefined,
                            minWidth: 18,
                            mt: "2px",
                        }}
                    >
                        {labels.turnLabelQ}
                    </Typography>
                    <Typography
                        level="body-md"
                        sx={{
                            fontWeight: 500,
                            whiteSpace: "pre-wrap",
                            color: isDark ? DARK_TEXT_STRONG : undefined,
                        }}
                    >
                        {askedQuery}
                    </Typography>
                </Box>
            )}

            <Box sx={{ display: "flex", alignItems: "flex-start", gap: 0.75 }}>
                <Typography
                    level="body-sm"
                    sx={{
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        opacity: isDark ? 1 : 0.75,
                        minWidth: 18,
                        mt: "2px",
                        color: "primary.500",
                    }}
                >
                    {labels.turnLabelA}
                </Typography>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    {isCurrent && isStreaming && !pendingApproval && (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
                            <CircularProgress
                                size="sm"
                                sx={{ "--CircularProgress-size": "12px" }}
                            />
                            <Typography
                                level="body-sm"
                                sx={{
                                    opacity: isDark ? 1 : 0.75,
                                    color: isDark ? DARK_TEXT_MEDIUM : undefined,
                                }}
                            >
                                {labels.states.streaming}
                            </Typography>
                        </Box>
                    )}
                    {isCurrent && pendingApproval && (
                        <Typography
                            level="body-sm"
                            sx={{
                                opacity: 0.85,
                                color: "warning.500",
                                fontWeight: 600,
                                mb: 0.5,
                            }}
                        >
                            {labels.states.awaitingApproval}
                        </Typography>
                    )}

                    {toolEvents.length > 0 && (
                        <ToolProgressList events={toolEvents} isDark={isDark} />
                    )}

                    {isCurrent && pendingApproval && onApprove && onReject && (
                        <ApprovalCard
                            approveLabel={labels.actions.approve}
                            isDark={isDark}
                            pending={pendingApproval}
                            rejectLabel={labels.actions.reject}
                            titleText={fmt(labels.approval.titleWithTool, {
                                toolName: labels.approval.toolLabel(pendingApproval.tool_name),
                            })}
                            onApprove={onApprove}
                            onReject={onReject}
                        />
                    )}

                    {askError && (
                        <Typography level="body-md" sx={{ color: "danger.500", mb: 0.5 }}>
                            {askError}
                        </Typography>
                    )}

                    {answer && (
                        <Box
                            sx={{
                                ...markdownAnswerSx(isDark),
                                mb: chipSources.length > 0 ? 0.75 : 0,
                            }}
                        >
                            <AnswerMarkdown
                                isDark={isDark}
                                sourcesById={sourcesById}
                                text={answerForRender}
                                onPreview={onPreview}
                            />
                        </Box>
                    )}

                    {(showThinking || showNoAnswer) && (
                        <Typography
                            level="body-md"
                            sx={{
                                opacity: isDark ? 1 : 0.75,
                                color: isDark ? DARK_TEXT_MEDIUM : undefined,
                            }}
                        >
                            {showThinking ? labels.states.thinking : labels.states.noAnswer}
                        </Typography>
                    )}

                    <SourceChipRow
                        labels={labels}
                        noteScopes={noteScopes}
                        query={askedQuery}
                        sources={chipSources}
                        onOpen={onPreview}
                    />

                    {/* Total response time (server-measured, from the
                        `done` event). Only for finished, non-error turns —
                        while streaming the spinner is the signal, and an
                        errored turn's timing is noise. */}
                    {typeof elapsedMs === "number" && !isStreaming && !askError && (
                        <Typography
                            level="body-xs"
                            sx={{
                                mt: 0.5,
                                fontVariantNumeric: "tabular-nums",
                                color: isDark ? DARK_TEXT_SOFT : undefined,
                                opacity: isDark ? 0.9 : 0.6,
                            }}
                        >
                            {fmt(labels.states.answeredIn, {
                                duration: formatDurationMs(elapsedMs),
                            })}
                        </Typography>
                    )}
                </Box>
            </Box>

            {/* Per-turn action bar: extras, 👍/👎, Copy, Retry. Fades in on hover. */}
            {showActions && (
                <Box
                    className="turn-actions"
                    sx={{ display: "flex", justifyContent: "flex-end", gap: 0.25, mt: 0.25 }}
                >
                    {extraActions}
                    {showFeedback && (
                        <FeedbackThumbs
                            runId={runId}
                            labels={{
                                up: labels.actions.feedbackUp,
                                down: labels.actions.feedbackDown,
                            }}
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
                                disabled={askDisabled}
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

AgentTurnInner.displayName = "AgentTurn";

export const AgentTurn = memo(AgentTurnInner);
