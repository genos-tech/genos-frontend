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
import LaunchRoundedIcon from "@mui/icons-material/LaunchRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import { Alert, Box, Button, CircularProgress, Divider, Link, Stack, Typography } from "@mui/joy";
import { useTheme } from "@mui/joy/styles";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { ModalFrame } from "../../components/ui/modal/ModalFrame";
import { useUrlLinkModal } from "../../hooks/common/UrlLinkModalContext";
import { useTranslation } from "../../i18n";
import { g } from "../../theme/tokens";
import { UserProps } from "../../types/admin";
import { chatTypeCodeToSlug, entityRefToHref } from "../../utils/entityHref";
import {
    agentMarkdownComponents,
    AgentQAConversation,
    AgentQAInput,
    agentQAUrlTransform,
    buildAgentTurnLabels,
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

// Build the labels of the conversation panel and the input from the
// thread-specific i18n namespace. (What a turn itself says is
// `buildAgentTurnLabels`: one contract for every host.)
const buildLabels = (t: ReturnType<typeof useTranslation>["t"]): AgentQALabels => ({
    conversation: {
        empty: t.threadAsk.conversation.empty,
        placeholder: t.threadAsk.conversation.placeholder,
        send: t.threadAsk.conversation.send,
        cancel: t.threadAsk.conversation.cancel,
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
    const theme = useTheme();
    const { t } = useTranslation();
    const urlLinkModal = useUrlLinkModal();

    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    // Note created by the last successful save — drives the "Open note"
    // deep link in the footer.
    const [savedNoteId, setSavedNoteId] = useState<number | null>(null);
    // Fingerprint of what the last successful save contained. While the
    // current content still matches it there is nothing new to save, so
    // the button stays disabled — clicking twice would just create a
    // duplicate note. Refreshing the summary or asking/clearing a
    // follow-up changes the fingerprint and re-arms the button.
    const [savedSignature, setSavedSignature] = useState<string | null>(null);

    const labels = useMemo(() => buildLabels(t), [t]);
    const turnLabels = useMemo(() => buildAgentTurnLabels(t, "threadAsk"), [t]);

    const turns = state.agentQA.turns;
    const saveSignature = useMemo(() => {
        if (!state.summary) return null;
        const lastTurn = turns.length > 0 ? turns[turns.length - 1] : null;
        return [
            state.summary.lastUpdatedIso,
            state.summary.text.length,
            turns.length,
            lastTurn?.runId ?? "",
        ].join("|");
    }, [state.summary, turns]);
    const alreadySaved = savedSignature !== null && savedSignature === saveSignature;

    const onSave = async () => {
        // The summary alone is saveable — Q&A turns are optional and the
        // conversation section is only appended when some exist (see
        // `saveThreadAskAsNote`).
        if (!state.summary || !state.threadContext) return;
        setSaving(true);
        setSaveError(null);
        setSavedNoteId(null);
        try {
            const today = new Date().toISOString().slice(0, 10);
            const title = t.threadAsk.saveAsNote.noteTitle
                .replace("{chatName}", chatName || "Thread")
                .replace("{date}", today);
            const metaLine = `Saved ${today} · ${state.summary.messageCount} message${
                state.summary.messageCount === 1 ? "" : "s"
            }`;
            const noteId = await saveThreadAskAsNote({
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
            setSavedNoteId(noteId);
            setSavedSignature(saveSignature);
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : t.threadAsk.saveAsNote.failed);
        } finally {
            setSaving(false);
        }
    };

    // Deep link to the note the last save created. Built through
    // `entityRefToHref` so the shape stays in lockstep with
    // `parseInternalUrl` (which classifies it as a `chatNote` and hands
    // it to ModalNoteView). Only offered while `alreadySaved` holds —
    // once the user refreshes the summary or asks a follow-up the link
    // would point at a note missing that content, and the Save button
    // re-arms at the same moment.
    const savedNoteHref = useMemo(() => {
        if (savedNoteId == null || !alreadySaved || !state.threadContext) return null;
        return entityRefToHref({
            entityType: "note",
            noteKind: "chat",
            chatType: chatTypeCodeToSlug(state.threadContext.chatType),
            chatId: String(state.threadContext.chatId),
            threadId: String(state.threadContext.threadId),
            noteId: String(savedNoteId),
        });
    }, [savedNoteId, alreadySaved, state.threadContext]);

    // Open the saved note in the shared UrlLinkModal, layered above this
    // dialog, so the conversation stays readable behind the preview.
    //
    // Caveat when this modal is itself hosted inside a UrlLinkModal
    // (thread opened via "Check thread", `zIndex` set): there is only one
    // modal instance, so opening the note RE-TARGETS our own host — the
    // thread view (and this modal with it) unmounts, and closing the note
    // returns to the page behind, not to the thread. Acceptable: the
    // conversation was just persisted to the note being opened. We still
    // raise the level so the preview is correct for the frame in which
    // both are mounted.
    const onOpenSavedNote = (e: React.MouseEvent) => {
        if (!savedNoteHref || !urlLinkModal) return; // let the anchor navigate
        // Preserve cmd/ctrl/middle-click "open in new tab".
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        urlLinkModal.openModalByHref(savedNoteHref, {
            zIndex: zIndex != null ? zIndex + 10 : undefined,
        });
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
        <ModalFrame
            headerDivider
            closeLabel={t.threadAsk.modal.close}
            description={chatName ? chatName : undefined}
            icon={<AutoAwesomeRoundedIcon sx={{ color: g.accent.text }} />}
            open={state.isOpen}
            size="xl"
            title={t.threadAsk.modal.title}
            zIndex={zIndex ?? theme.zIndex.modal}
            actions={
                <>
                    <Button
                        disabled={saving || !state.summary || alreadySaved}
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
                    {savedNoteHref ? (
                        <Stack alignItems="center" direction="row" spacing={1}>
                            <Typography level="body-xs" sx={{ color: g.success.text }}>
                                {t.threadAsk.saveAsNote.success}
                            </Typography>
                            <Link
                                href={savedNoteHref}
                                level="body-xs"
                                startDecorator={<LaunchRoundedIcon sx={{ fontSize: 14 }} />}
                                onClick={onOpenSavedNote}
                            >
                                {t.threadAsk.saveAsNote.openNote}
                            </Link>
                        </Stack>
                    ) : null}
                    {saveError ? (
                        <Typography level="body-xs" sx={{ color: g.danger.text }}>
                            {saveError}
                        </Typography>
                    ) : null}
                </>
            }
            onClose={state.close}
        >
            {/* Summary */}
            <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 1, mt: 0.5 }}>
                <Typography level="title-sm">{t.threadAsk.summary.sectionTitle}</Typography>
                {state.summary && !state.summaryLoading ? (
                    <Typography level="body-xs" sx={{ color: g.text.tertiary }}>
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
                    <Typography level="body-sm" sx={{ color: g.text.tertiary }}>
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
                        ...markdownAnswerSx(),
                        px: 1.25,
                        py: 1,
                        borderRadius: "md",
                        bgcolor: g.hover,
                    }}
                >
                    <ReactMarkdown
                        components={agentMarkdownComponents}
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
                        <Typography level="body-sm">{t.threadAsk.summary.stale.banner}</Typography>
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
                labels={labels}
                state={state.agentQA}
                turnLabels={turnLabels}
                onSelectSource={onSelectSource}
            />

            {/* Input — disabled until the summary loads so the
                    agent's "context" prompt has the summary to inject. */}
            <Box sx={{ mt: 1 }}>
                <AgentQAInput disabled={!state.summary} labels={labels} state={state.agentQA} />
            </Box>
        </ModalFrame>
    );
};
