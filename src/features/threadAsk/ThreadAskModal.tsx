// "Ask about this thread" modal.
//
// Layout:
//   - Header (close button)
//   - Summary section (markdown), with refresh button + "stale" banner
//     when the background fingerprint poll detected new messages
//   - Conversation section: each completed turn (Q/A), then the
//     in-flight answer if any
//   - Input row (text + Send / Cancel)
//   - Footer: Save-as-Chat-Note + Clear-conversation

import { useMemo, useState } from "react";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Divider,
    IconButton,
    Modal,
    ModalDialog,
    Stack,
    Textarea,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";

import { useUrlLinkModal } from "../../hooks/common/UrlLinkModalContext";
import { useTranslation } from "../../i18n";
import { UserProps } from "../../types/admin";
import { ApprovalCard } from "../spotlight/ApprovalCard";
import { markdownAnswerSx } from "../spotlight/markdownAnswerSx";
import { ToolProgressList } from "../spotlight/ToolProgressList";
import { SpotlightResult } from "../spotlight/types";
import {
    buildSourcesById,
    CITATION_HREF_PREFIX,
    rewriteCitations,
    sourcesNotInline,
    sourceToUrl,
} from "./citationUtils";
import { saveThreadAskAsNote } from "./saveThreadAskAsNote";
import { SourceChips } from "./SourceChips";
import { UseThreadAskReturn } from "./useThreadAsk";

// ReactMarkdown's default `urlTransform` whitelists http/https/mailto/
// ircs/xmpp and blanks every other scheme to "" — including our
// `spotlight-citation:<token>` sentinel. The blanked href then falls
// through CitationAnchor's "looks like a sentinel" check and renders
// as a plain `<a href="" target="_blank">`, which opens the current
// page in a new tab on click. Whitelist the sentinel here so it
// survives intact and reaches the anchor renderer.
const threadAskUrlTransform = (url: string): string =>
    url.startsWith(CITATION_HREF_PREFIX) ? url : defaultUrlTransform(url);

interface ThreadAskModalProps {
    state: UseThreadAskReturn;
    myself: UserProps;
    accessToken: string | null;
    chatName: string;
    // Click handler invoked when a citation hyperlink inside an answer
    // is activated. Receives the resolved `SpotlightResult` for the
    // entity. The caller is expected to navigate / open a preview /
    // close the modal as it sees fit — this component stays routing-
    // agnostic so it can sit anywhere in the tree.
    onSelectSource?: (source: SpotlightResult) => void;
}

// Custom anchor renderer for ReactMarkdown. When the href matches our
// `spotlight-citation:` sentinel, render a button that resolves the
// token via `sourcesById` and:
//   1. First tries the UrlLinkModal preview — same surface chat-message
//      links use, so the user can quick-look the cited entity without
//      losing their place in the conversation. The modal sits on top
//      of ThreadAskModal (zIndex 13200) so it's not occluded.
//   2. Falls back to `onSelectSource` (full navigate) when the modal
//      didn't open — either we're outside a UrlLinkModalProvider, the
//      entity type has no modal preview yet (projects), or the href
//      shape isn't modal-able.
// Chips below the answer use only the navigate path on purpose: the
// modal preview is the primary affordance for inline citations.
const CitationAnchor = ({
    href,
    children,
    sourcesById,
    onSelectSource,
    isDark,
}: {
    href?: string;
    children?: React.ReactNode;
    sourcesById: Map<string, SpotlightResult>;
    onSelectSource?: (source: SpotlightResult) => void;
    isDark: boolean;
}) => {
    const urlLinkModal = useUrlLinkModal();
    if (href && href.startsWith(CITATION_HREF_PREFIX)) {
        const token = href.slice(CITATION_HREF_PREFIX.length);
        const source = sourcesById.get(token);
        if (source) {
            const handleClick = () => {
                const previewHref = sourceToUrl(source);
                if (previewHref && urlLinkModal) {
                    const outcome = urlLinkModal.openModalByHref(previewHref);
                    if (outcome === "opened") return;
                }
                onSelectSource?.(source);
            };
            return (
                <Box
                    component="button"
                    type="button"
                    sx={{
                        background: "none",
                        border: "none",
                        p: 0,
                        cursor: "pointer",
                        font: "inherit",
                        color: isDark ? "#a5b4fc" : "#6366f1",
                        textDecoration: "underline",
                        textDecorationStyle: "dotted",
                        textUnderlineOffset: "2px",
                        borderRadius: "3px",
                        transition: "background 100ms ease",
                        "&:hover": {
                            background: isDark
                                ? "rgba(167,139,250,0.18)"
                                : "rgba(124,58,237,0.10)",
                            textDecorationStyle: "solid",
                        },
                        "&:focus-visible": {
                            outline: "2px solid",
                            outlineColor: isDark ? "#a5b4fc" : "#6366f1",
                            outlineOffset: "1px",
                        },
                    }}
                    onClick={handleClick}
                >
                    {children}
                </Box>
            );
        }
        // Unresolved sentinel — render the children plain. Shouldn't
        // happen post-rewriteCitations but be defensive.
        return <>{children}</>;
    }
    return (
        <a href={href} rel="noopener noreferrer" target="_blank">
            {children}
        </a>
    );
};

// Human-readable "updated N ago" for the summary header. Renders once
// per modal render; no need for live ticking.
const formatRelative = (iso: string, t: ReturnType<typeof useTranslation>["t"]): string => {
    const ts = Date.parse(iso);
    if (Number.isNaN(ts)) return "";
    const now = Date.now();
    const diffSec = Math.max(0, Math.floor((now - ts) / 1000));
    if (diffSec < 60) return t.threadAsk.summary.updatedJustNow;
    const min = Math.floor(diffSec / 60);
    if (min < 60) return formatPlural(t.threadAsk.summary.updatedMinutes, min);
    const hr = Math.floor(min / 60);
    if (hr < 24) return formatPlural(t.threadAsk.summary.updatedHours, hr);
    const days = Math.floor(hr / 24);
    return formatPlural(t.threadAsk.summary.updatedDays, days);
};

// Tiny ICU-plural picker — the i18n harness's `fmt` handles plural
// templates but here we just need to choose between `one {}` and `other {}`.
const formatPlural = (template: string, count: number): string => {
    const match = /one\s*\{([^}]*)\}\s*other\s*\{([^}]*)\}/.exec(template);
    if (!match) return template;
    const chosen = count === 1 ? match[1] : match[2];
    return chosen.replace(/#/g, String(count));
};

export const ThreadAskModal = ({
    state,
    myself,
    accessToken,
    chatName,
    onSelectSource,
}: ThreadAskModalProps) => {
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";

    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [saveSuccess, setSaveSuccess] = useState(false);

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

    const onSave = async () => {
        if (!state.summary || !state.threadContext) return;
        if (state.turns.length === 0) {
            // Nothing to save — give the user a non-destructive hint.
            setSaveError(t.threadAsk.saveAsNote.nothingToSave);
            return;
        }
        setSaving(true);
        setSaveError(null);
        setSaveSuccess(false);
        try {
            const today = new Date().toISOString().slice(0, 10);
            const title = t.threadAsk.saveAsNote.noteTitle
                .replace("{chatName}", chatName || "Thread")
                .replace("{date}", today);
            const metaLine = `Saved ${today} · ${state.summary.messageCount} message${
                state.summary.messageCount === 1 ? "" : "s"
            }`;
            await saveThreadAskAsNote({
                myself,
                accessToken,
                chatType: state.threadContext.chatType,
                chatId: state.threadContext.chatId,
                threadId: state.threadContext.threadId,
                title,
                summaryText: state.summary.text,
                summaryUpdatedIso: state.summary.lastUpdatedIso,
                turns: state.turns,
                summarySectionLabel: t.threadAsk.summary.sectionTitle,
                conversationSectionLabel: t.threadAsk.conversation.header,
                metaLine,
                qLabel: t.threadAsk.conversation.turnLabelQ,
                aLabel: t.threadAsk.conversation.turnLabelA,
            });
            setSaveSuccess(true);
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : t.threadAsk.saveAsNote.failed);
        } finally {
            setSaving(false);
        }
    };

    const updatedLabel = useMemo(
        () => (state.summary ? formatRelative(state.summary.lastUpdatedIso, t) : ""),
        [state.summary, t]
    );

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

    return (
        <Modal open={state.isOpen} onClose={state.close}>
            <ModalDialog
                className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                size="lg"
                sx={{
                    width: { xs: "92vw", sm: 620, md: 720 },
                    maxHeight: "90vh",
                    overflowY: "auto",
                    overflowX: "hidden",
                    borderRadius: "xl",
                    p: 2.5,
                }}
            >
                {/* Header */}
                <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 1 }}>
                    <AutoAwesomeRoundedIcon />
                    <Typography level="title-lg">{t.threadAsk.modal.title}</Typography>
                    {chatName ? (
                        <Typography
                            level="body-sm"
                            sx={{ color: "text.tertiary", minWidth: 0 }}
                            noWrap
                        >
                            · {chatName}
                        </Typography>
                    ) : null}
                    <Box sx={{ flex: 1 }} />
                    <IconButton
                        aria-label={t.threadAsk.modal.close}
                        variant="plain"
                        onClick={state.close}
                    >
                        <CloseRoundedIcon />
                    </IconButton>
                </Stack>
                <Divider sx={{ mb: 2 }} />

                {/* Summary */}
                <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 1, mt: 0.5 }}>
                    <Typography level="title-sm">{t.threadAsk.summary.sectionTitle}</Typography>
                    {state.summary && !state.summaryLoading ? (
                        <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
                            {updatedLabel}
                        </Typography>
                    ) : null}
                    <Box sx={{ flex: 1 }} />
                    <Button
                        disabled={state.summaryLoading || !state.summary}
                        size="sm"
                        startDecorator={<RefreshRoundedIcon sx={{ fontSize: 16 }} />}
                        variant="plain"
                        onClick={state.refreshSummary}
                    >
                        {t.threadAsk.summary.refresh}
                    </Button>
                </Stack>

                {state.summaryLoading && !state.summary ? (
                    <Stack alignItems="center" direction="row" spacing={1} sx={{ py: 2 }}>
                        <CircularProgress size="sm" />
                        <Typography level="body-sm" sx={{ color: "text.tertiary" }}>
                            {t.threadAsk.summary.loading}
                        </Typography>
                    </Stack>
                ) : null}

                {state.summaryError ? (
                    <Alert color="danger" sx={{ mb: 1 }}>
                        <Stack alignItems="center" direction="row" spacing={1}>
                            <Typography level="body-sm">{state.summaryError}</Typography>
                            <Button size="sm" variant="soft" onClick={state.refreshSummary}>
                                {t.threadAsk.errors.retry}
                            </Button>
                        </Stack>
                    </Alert>
                ) : null}

                {state.summary ? (
                    <Box
                        sx={{
                            ...markdownAnswerSx(isDark),
                            px: 1.25,
                            py: 1,
                            borderRadius: "md",
                            bgcolor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                        }}
                    >
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            urlTransform={threadAskUrlTransform}
                        >
                            {state.summary.text}
                        </ReactMarkdown>
                    </Box>
                ) : null}

                {state.staleSummary ? (
                    <Alert color="warning" sx={{ mt: 1 }}>
                        <Stack alignItems="center" direction="row" spacing={1}>
                            <Typography level="body-sm">
                                {t.threadAsk.summary.stale.banner}
                            </Typography>
                            <Button
                                color="warning"
                                disabled={state.summaryLoading}
                                size="sm"
                                variant="soft"
                                onClick={state.refreshSummary}
                            >
                                {t.threadAsk.summary.stale.refreshAction}
                            </Button>
                        </Stack>
                    </Alert>
                ) : null}

                <Divider sx={{ my: 2 }} />

                {/* Conversation */}
                <Typography level="title-sm" sx={{ mb: 1 }}>
                    {t.threadAsk.conversation.header}
                </Typography>
                {state.turns.length === 0 && !hasInFlightAnswer ? (
                    <Typography level="body-sm" sx={{ color: "text.tertiary", py: 1 }}>
                        {t.threadAsk.conversation.empty}
                    </Typography>
                ) : (
                    <Stack spacing={1.5} sx={{ mb: 1 }}>
                        {state.turns.map((turn) => (
                            <TurnRow
                                key={turn.id}
                                aLabel={t.threadAsk.conversation.turnLabelA}
                                isDark={isDark}
                                qLabel={t.threadAsk.conversation.turnLabelQ}
                                turn={turn}
                                sourcesById={sourcesById}
                                onSelectSource={onSelectSource}
                                onRetry={state.onAsk}
                                copyLabel={t.threadAsk.actions.copyAnswer}
                                copiedLabel={t.threadAsk.actions.copied}
                                retryLabel={t.threadAsk.actions.retry}
                            />
                        ))}
                        {hasInFlightAnswer ? (
                            <InFlightTurn
                                aLabel={t.threadAsk.conversation.turnLabelA}
                                answer={state.ask.answer}
                                answerSources={state.ask.answerSources}
                                toolEvents={state.ask.toolEvents}
                                askedQuery={state.ask.askedQuery}
                                askError={state.ask.askError}
                                isDark={isDark}
                                isStreaming={state.ask.isStreaming}
                                pendingApproval={state.ask.pendingApproval}
                                qLabel={t.threadAsk.conversation.turnLabelQ}
                                streamingLabel={t.threadAsk.states.streaming}
                                thinkingLabel={t.threadAsk.states.thinking}
                                approveLabel={t.threadAsk.actions.approve}
                                rejectLabel={t.threadAsk.actions.reject}
                                approvalTitleFormat={t.threadAsk.approval.titleWithTool}
                                onApprove={state.onApprove}
                                onReject={state.onReject}
                                sourcesById={sourcesById}
                                onSelectSource={onSelectSource}
                            />
                        ) : null}
                    </Stack>
                )}

                {/* Input */}
                <Stack alignItems="flex-end" direction="row" spacing={1} sx={{ mt: 1 }}>
                    <Textarea
                        disabled={state.ask.isStreaming}
                        maxRows={5}
                        minRows={1}
                        placeholder={t.threadAsk.conversation.placeholder}
                        sx={{ flex: 1 }}
                        value={state.query}
                        onChange={(e) => state.setQuery(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                state.onAsk();
                            }
                        }}
                    />
                    {state.ask.isStreaming ? (
                        <Button color="neutral" variant="soft" onClick={state.onCancel}>
                            {t.threadAsk.conversation.cancel}
                        </Button>
                    ) : (
                        <Button
                            disabled={!state.query.trim() || !state.summary}
                            startDecorator={<SendRoundedIcon sx={{ fontSize: 16 }} />}
                            // Wrap to drop the MouseEvent argument so it
                            // isn't coerced into `overrideQuery` and used
                            // verbatim as the query text.
                            onClick={() => state.onAsk()}
                        >
                            {t.threadAsk.conversation.send}
                        </Button>
                    )}
                </Stack>

                <Divider sx={{ my: 2 }} />

                {/* Footer */}
                <Stack alignItems="center" direction="row" spacing={1}>
                    <Button
                        disabled={saving || !state.summary || state.turns.length === 0}
                        startDecorator={<SaveRoundedIcon sx={{ fontSize: 16 }} />}
                        variant="solid"
                        onClick={onSave}
                    >
                        {saving ? t.threadAsk.saveAsNote.saving : t.threadAsk.saveAsNote.button}
                    </Button>
                    <Button
                        color="neutral"
                        disabled={state.turns.length === 0 && !hasInFlightAnswer}
                        variant="plain"
                        onClick={state.clearConversation}
                    >
                        {t.threadAsk.conversation.clear}
                    </Button>
                    <Box sx={{ flex: 1 }} />
                    {saveSuccess ? (
                        <Typography level="body-xs" sx={{ color: "success.solidBg" }}>
                            {t.threadAsk.saveAsNote.success}
                        </Typography>
                    ) : null}
                    {saveError ? (
                        <Typography level="body-xs" sx={{ color: "danger.solidBg" }}>
                            {saveError}
                        </Typography>
                    ) : null}
                </Stack>
            </ModalDialog>
        </Modal>
    );
};

// One past Q&A turn rendered as a card-ish block.
const TurnRow = ({
    turn,
    qLabel,
    aLabel,
    isDark,
    sourcesById,
    onSelectSource,
    onRetry,
    copyLabel,
    copiedLabel,
    retryLabel,
}: {
    turn: import("../spotlight/useSpotlight").CompletedTurn;
    qLabel: string;
    aLabel: string;
    isDark: boolean;
    sourcesById: Map<string, SpotlightResult>;
    onSelectSource?: (source: SpotlightResult) => void;
    onRetry?: (askedQuery: string) => void;
    copyLabel: string;
    copiedLabel: string;
    retryLabel: string;
}) => {
    const [copied, setCopied] = useState(false);
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
    const handleRetry = () => onRetry?.(turn.askedQuery);
    const showCopy = Boolean(turn.answer);
    const showRetry = Boolean(turn.askedQuery) && Boolean(onRetry);
    const rewritten = useMemo(
        () => rewriteCitations(turn.answer || "(no answer)", sourcesById),
        [turn.answer, sourcesById]
    );
    // Sources that the answer doesn't already reference inline as a
    // hyperlink. Inline-cited ones live in the prose itself; these
    // become a chip row underneath. Computed against the turn's own
    // sources rather than the cross-turn `sourcesById` because chips
    // should reflect "what this answer referenced", not the running
    // session total.
    const chipSources = useMemo(
        () => sourcesNotInline(turn.answer || "", turn.answerSources || []),
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
                {qLabel}: {turn.askedQuery}
            </Typography>
            {/* Tool-progress strip: replays the steps the agent took to
                produce this answer (search, fetch_task, etc.) — same
                rendering as the global Spotlight surface. */}
            <ToolProgressList events={turn.toolEvents} isDark={isDark} />
            {turn.askError ? (
                <Typography level="body-sm" sx={{ color: "danger.softColor" }}>
                    {aLabel}: {turn.askError}
                </Typography>
            ) : (
                <Box sx={markdownAnswerSx(isDark)}>
                    <Typography component="span" level="body-sm" sx={{ fontWeight: 600, mr: 0.5 }}>
                        {aLabel}:
                    </Typography>
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        urlTransform={threadAskUrlTransform}
                        components={{
                            a: ({ href, children }) => (
                                <CitationAnchor
                                    href={href}
                                    sourcesById={sourcesById}
                                    onSelectSource={onSelectSource}
                                    isDark={isDark}
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
            {(showCopy || showRetry) && (
                <Box
                    sx={{
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: 0.25,
                        mt: 0.25,
                    }}
                >
                    {showCopy && (
                        <IconButton
                            color={copied ? "success" : "neutral"}
                            size="sm"
                            sx={{ minWidth: 0, p: "3px" }}
                            title={copied ? copiedLabel : copyLabel}
                            variant="plain"
                            onClick={handleCopy}
                        >
                            {copied ? (
                                <CheckRoundedIcon sx={{ fontSize: 14 }} />
                            ) : (
                                <ContentCopyRoundedIcon sx={{ fontSize: 14 }} />
                            )}
                        </IconButton>
                    )}
                    {showRetry && (
                        <IconButton
                            color="neutral"
                            size="sm"
                            sx={{ minWidth: 0, p: "3px" }}
                            title={retryLabel}
                            variant="plain"
                            onClick={handleRetry}
                        >
                            <ReplayRoundedIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                    )}
                </Box>
            )}
        </Box>
    );
};

// The currently-streaming or just-errored turn (not yet promoted into
// the turns history).
const InFlightTurn = ({
    askedQuery,
    answer,
    answerSources,
    toolEvents,
    askError,
    isStreaming,
    pendingApproval,
    qLabel,
    aLabel,
    streamingLabel,
    thinkingLabel,
    approveLabel,
    rejectLabel,
    approvalTitleFormat,
    onApprove,
    onReject,
    isDark,
    sourcesById,
    onSelectSource,
}: {
    askedQuery: string;
    answer: string;
    answerSources: SpotlightResult[];
    toolEvents: import("../spotlight/useSpotlight").ToolEvent[];
    askError: string | null;
    isStreaming: boolean;
    pendingApproval: import("../../services/agentApi").PendingApprovalPayload | null;
    qLabel: string;
    aLabel: string;
    streamingLabel: string;
    thinkingLabel: string;
    approveLabel: string;
    rejectLabel: string;
    approvalTitleFormat: string;
    onApprove: () => void;
    onReject: () => void;
    isDark: boolean;
    sourcesById: Map<string, SpotlightResult>;
    onSelectSource?: (source: SpotlightResult) => void;
}) => {
    // "Thinking…" placeholder shown when the stream is active but no
    // tool calls or answer text have landed yet — gives the user
    // immediate feedback that something IS happening (and isn't a stall).
    const showThinking =
        isStreaming && !answer && !askError && toolEvents.length === 0 && !pendingApproval;
    const rewritten = useMemo(
        () => rewriteCitations(answer || "", sourcesById),
        [answer, sourcesById]
    );
    const chipSources = useMemo(
        () => sourcesNotInline(answer || "", answerSources || []),
        [answer, answerSources]
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
                {qLabel}: {askedQuery}
            </Typography>
            {/* Tool-progress strip — same as past turns. Shown live as
                the agent advances through tool calls. */}
            <ToolProgressList events={toolEvents} isDark={isDark} />
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
                    {thinkingLabel}
                </Typography>
            )}
            {pendingApproval && (
                <ApprovalCard
                    pending={pendingApproval}
                    isDark={isDark}
                    titleText={approvalTitleFormat.replace(
                        "{toolName}",
                        pendingApproval.tool_name
                    )}
                    approveLabel={approveLabel}
                    rejectLabel={rejectLabel}
                    onApprove={onApprove}
                    onReject={onReject}
                />
            )}
            {askError ? (
                <Typography level="body-sm" sx={{ color: "danger.softColor" }}>
                    {aLabel}: {askError}
                </Typography>
            ) : (
                <Box sx={markdownAnswerSx(isDark)}>
                    <Typography component="span" level="body-sm" sx={{ fontWeight: 600, mr: 0.5 }}>
                        {aLabel}:
                    </Typography>
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        urlTransform={threadAskUrlTransform}
                        components={{
                            a: ({ href, children }) => (
                                <CitationAnchor
                                    href={href}
                                    sourcesById={sourcesById}
                                    onSelectSource={onSelectSource}
                                    isDark={isDark}
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
                    {!isStreaming && (
                        <SourceChips sources={chipSources} onSelectSource={onSelectSource} />
                    )}
                    {isStreaming ? (
                        <Typography
                            level="body-xs"
                            sx={{ color: "text.tertiary", fontStyle: "italic", mt: 0.5 }}
                        >
                            {streamingLabel}
                        </Typography>
                    ) : null}
                </Box>
            )}
        </Box>
    );
};
