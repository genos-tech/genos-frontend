// "Ask about this note" modal.
//
// Layout:
//   - Header (close button)
//   - Summary section (markdown), with refresh button + "stale" banner
//     when the background fingerprint poll detected an edit
//   - Conversation section (delegated to AgentQAConversation)
//   - Input row (delegated to AgentQAInput)
//   - Footer: Clear-conversation
//
// Mirrors `ThreadAskModal` minus the save-as-note footer button — the
// thread version saves to a chat note for permanent record; for the
// note Q&A, the user is already viewing a note and per-turn Copy
// covers the rare "I want to keep this answer" case.

import { useMemo } from "react";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
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
import {
    AgentQAConversation,
    AgentQAInput,
    agentQAUrlTransform,
    markdownAnswerSx,
    type AgentQALabels,
} from "../agentQA";
import { SpotlightResult } from "../spotlight/types";
import { UseNoteAskReturn } from "./useNoteAsk";

interface NoteAskModalProps {
    state: UseNoteAskReturn;
    // Click handler invoked when a citation hyperlink inside an answer
    // is activated. Receives the resolved SpotlightResult for the
    // entity. The caller is expected to navigate / open a preview /
    // close the modal as it sees fit — this component stays routing-
    // agnostic so it can sit anywhere in the tree.
    onSelectSource?: (source: SpotlightResult) => void;
}

// Build the agentQA labels prop from the note-specific i18n namespace.
// Centralising the mapping here means a future tweak to the i18n shape
// only touches one spot.
const buildLabels = (t: ReturnType<typeof useTranslation>["t"]): AgentQALabels => ({
    conversation: {
        empty: t.noteAsk.conversation.empty,
        turnLabelQ: t.noteAsk.conversation.turnLabelQ,
        turnLabelA: t.noteAsk.conversation.turnLabelA,
        placeholder: t.noteAsk.conversation.placeholder,
        send: t.noteAsk.conversation.send,
        cancel: t.noteAsk.conversation.cancel,
    },
    actions: {
        approve: t.noteAsk.actions.approve,
        reject: t.noteAsk.actions.reject,
        copyAnswer: t.noteAsk.actions.copyAnswer,
        copied: t.noteAsk.actions.copied,
        retry: t.noteAsk.actions.retry,
    },
    states: {
        streaming: t.noteAsk.states.streaming,
        thinking: t.noteAsk.states.thinking,
    },
    approval: {
        titleWithTool: t.noteAsk.approval.titleWithTool,
    },
    mentions: {
        ariaLabel: t.noteAsk.mentions.ariaLabel,
    },
});

// Human-readable "updated N ago" for the summary header.
const formatRelative = (iso: string, t: ReturnType<typeof useTranslation>["t"]): string => {
    const ts = Date.parse(iso);
    if (Number.isNaN(ts)) return "";
    const now = Date.now();
    const diffSec = Math.max(0, Math.floor((now - ts) / 1000));
    if (diffSec < 60) return t.noteAsk.summary.updatedJustNow;
    const min = Math.floor(diffSec / 60);
    if (min < 60) return formatPlural(t.noteAsk.summary.updatedMinutes, min);
    const hr = Math.floor(min / 60);
    if (hr < 24) return formatPlural(t.noteAsk.summary.updatedHours, hr);
    const days = Math.floor(hr / 24);
    return formatPlural(t.noteAsk.summary.updatedDays, days);
};

// Tiny ICU-plural picker — see the matching helper in ThreadAskModal.
const formatPlural = (template: string, count: number): string => {
    const match = /one\s*\{([^}]*)\}\s*other\s*\{([^}]*)\}/.exec(template);
    if (!match) return template;
    const chosen = count === 1 ? match[1] : match[2];
    return chosen.replace(/#/g, String(count));
};

export const NoteAskModal = ({ state, onSelectSource }: NoteAskModalProps) => {
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";

    const labels = useMemo(() => buildLabels(t), [t]);

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

    const noteTitle = state.summary?.noteTitle || "";

    return (
        <Modal open={state.isOpen} onClose={state.close}>
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
                    <Typography level="title-lg">{t.noteAsk.modal.title}</Typography>
                    {noteTitle ? (
                        <Typography
                            level="body-sm"
                            sx={{ color: "text.tertiary", minWidth: 0 }}
                            noWrap
                        >
                            · {noteTitle}
                        </Typography>
                    ) : null}
                    <Box sx={{ flex: 1 }} />
                    <IconButton
                        aria-label={t.noteAsk.modal.close}
                        variant="plain"
                        onClick={state.close}
                    >
                        <CloseRoundedIcon />
                    </IconButton>
                </Stack>
                <Divider sx={{ mb: 2 }} />

                {/* Summary */}
                <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 1, mt: 0.5 }}>
                    <Typography level="title-sm">{t.noteAsk.summary.sectionTitle}</Typography>
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
                        {t.noteAsk.summary.refresh}
                    </Button>
                </Stack>

                {state.summaryLoading && !state.summary ? (
                    <Stack alignItems="center" direction="row" spacing={1} sx={{ py: 2 }}>
                        <CircularProgress size="sm" />
                        <Typography level="body-sm" sx={{ color: "text.tertiary" }}>
                            {t.noteAsk.summary.loading}
                        </Typography>
                    </Stack>
                ) : null}

                {state.summaryError ? (
                    <Alert color="danger" sx={{ mb: 1 }}>
                        <Stack alignItems="center" direction="row" spacing={1}>
                            <Typography level="body-sm">{state.summaryError}</Typography>
                            <Button size="sm" variant="soft" onClick={state.refreshSummary}>
                                {t.noteAsk.errors.retry}
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
                                {t.noteAsk.summary.stale.banner}
                            </Typography>
                            <Button
                                color="warning"
                                disabled={state.summaryLoading}
                                size="sm"
                                variant="soft"
                                onClick={state.refreshSummary}
                            >
                                {t.noteAsk.summary.stale.refreshAction}
                            </Button>
                        </Stack>
                    </Alert>
                ) : null}

                <Divider sx={{ my: 2 }} />

                {/* Conversation */}
                <Typography level="title-sm" sx={{ mb: 1 }}>
                    {t.noteAsk.conversation.header}
                </Typography>
                <AgentQAConversation
                    isDark={isDark}
                    labels={labels}
                    state={state.agentQA}
                    onSelectSource={onSelectSource}
                />

                {/* Input — disabled until the summary loads so the
                    agent's system prompt has the summary to inject. */}
                <Box sx={{ mt: 1 }}>
                    <AgentQAInput
                        disabled={!state.summary}
                        labels={labels}
                        state={state.agentQA}
                    />
                </Box>

                <Divider sx={{ my: 2 }} />

                {/* Footer — Clear only (no save button per design). */}
                <Stack alignItems="center" direction="row" spacing={1}>
                    <Box sx={{ flex: 1 }} />
                    <Button
                        color="neutral"
                        disabled={turnsCount === 0 && !hasInFlightAnswer}
                        variant="plain"
                        onClick={state.agentQA.clearConversation}
                    >
                        {t.noteAsk.conversation.clear}
                    </Button>
                </Stack>
            </ModalDialog>
        </Modal>
    );
};
