// "Ask about this thread" modal.
//
// Layout:
//   - Header (close button)
//   - Summary section (markdown), with refresh button + "stale" banner
//     when the background fingerprint poll detected new messages
//   - Conversation section (delegated to AgentQAConversation)
//   - Input row (delegated to AgentQAInput)
//   - Footer: Save-as-Chat-Note + Clear-conversation
//
// The thread-specific concerns — summary, save target, header chrome —
// live here. The generic Q&A surface (turns, in-flight, approvals,
// citations, source chips) is rendered by `features/agentQA/`.

import { useMemo, useState } from "react";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
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
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { useTranslation } from "../../i18n";
import { UserProps } from "../../types/admin";
import {
    AgentQAConversation,
    AgentQAInput,
    agentQAUrlTransform,
    markdownAnswerSx,
    type AgentQALabels,
} from "../agentQA";
import { SpotlightResult } from "../spotlight/types";
import { saveThreadAskAsNote } from "./saveThreadAskAsNote";
import { UseThreadAskReturn } from "./useThreadAsk";

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
    // Stacking override. Joy's Modal defaults to the theme modal layer
    // (~1300); when this modal is opened from inside the UrlLinkModal
    // (the thread opened via "Check thread", z ≥ 10020) it would render
    // BEHIND it. Callers on that surface pass a value above the host.
    // Undefined → Joy default (correct on the chat page).
    zIndex?: number;
}

// Build the agentQA labels prop from the thread-specific i18n namespace.
// Centralising the mapping here means a future tweak to the i18n shape
// only touches one spot.
const buildLabels = (t: ReturnType<typeof useTranslation>["t"]): AgentQALabels => ({
    conversation: {
        empty: t.threadAsk.conversation.empty,
        turnLabelQ: t.threadAsk.conversation.turnLabelQ,
        turnLabelA: t.threadAsk.conversation.turnLabelA,
        placeholder: t.threadAsk.conversation.placeholder,
        send: t.threadAsk.conversation.send,
        cancel: t.threadAsk.conversation.cancel,
    },
    actions: {
        approve: t.threadAsk.actions.approve,
        reject: t.threadAsk.actions.reject,
        copyAnswer: t.threadAsk.actions.copyAnswer,
        copied: t.threadAsk.actions.copied,
        retry: t.threadAsk.actions.retry,
    },
    states: {
        streaming: t.threadAsk.states.streaming,
        thinking: t.threadAsk.states.thinking,
        answeredIn: t.threadAsk.states.answeredIn,
    },
    approval: {
        titleWithTool: t.threadAsk.approval.titleWithTool,
    },
    mentions: {
        ariaLabel: t.threadAsk.mentions.ariaLabel,
    },
});

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
    zIndex,
    onSelectSource,
}: ThreadAskModalProps) => {
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";

    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [saveSuccess, setSaveSuccess] = useState(false);

    const labels = useMemo(() => buildLabels(t), [t]);

    const onSave = async () => {
        // The summary alone is saveable — Q&A turns are optional and the
        // conversation section is only appended when some exist (see
        // `saveThreadAskAsNote`).
        if (!state.summary || !state.threadContext) return;
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
                turns: state.agentQA.turns,
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

    const ask = state.agentQA.ask;
    const turnsCount = state.agentQA.turns.length;
    const hasInFlightAnswer =
        ask.isStreaming ||
        ask.askError ||
        ask.answer ||
        ask.toolEvents.length > 0 ||
        ask.pendingApproval !== null;

    return (
        <Modal
            open={state.isOpen}
            sx={
                zIndex != null
                    ? {
                          zIndex,
                          // Joy pins Select/Autocomplete listboxes to
                          // calc(theme.zIndex.modal + 1) and does NOT track
                          // this raised `zIndex`, so the mentions autocomplete
                          // would open behind the dialog. Re-stamp the popup
                          // var on the modal root and sibling portaled
                          // listboxes (same fix as UrlLinkModal).
                          "--unstable_popup-zIndex": zIndex + 10,
                          '& ~ [role="listbox"]': {
                              "--unstable_popup-zIndex": zIndex + 10,
                          },
                      }
                    : undefined
            }
            onClose={state.close}
        >
            <ModalDialog
                className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                size="lg"
                sx={{
                    width: { xs: "92vw", sm: 620, md: 800 },
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
                            urlTransform={agentQAUrlTransform}
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
                <AgentQAConversation
                    isDark={isDark}
                    labels={labels}
                    state={state.agentQA}
                    onSelectSource={onSelectSource}
                />

                {/* Input — disabled until the summary loads so the
                    agent's "context" prompt has the summary to inject. */}
                <Box sx={{ mt: 1 }}>
                    <AgentQAInput
                        disabled={!state.summary}
                        labels={labels}
                        state={state.agentQA}
                    />
                </Box>

                <Divider sx={{ my: 2 }} />

                {/* Footer */}
                <Stack alignItems="center" direction="row" spacing={1}>
                    <Button
                        disabled={saving || !state.summary}
                        startDecorator={<SaveRoundedIcon sx={{ fontSize: 16 }} />}
                        variant="solid"
                        onClick={onSave}
                    >
                        {saving ? t.threadAsk.saveAsNote.saving : t.threadAsk.saveAsNote.button}
                    </Button>
                    <Button
                        color="neutral"
                        disabled={turnsCount === 0 && !hasInFlightAnswer}
                        variant="plain"
                        onClick={state.agentQA.clearConversation}
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
