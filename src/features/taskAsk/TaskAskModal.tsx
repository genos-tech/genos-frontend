// "Ask Genos about this task / milestone" window (MIP-1057).
//
// The conversation about ONE task or milestone, the way "Ask about this thread" and "Ask about this
// note" are about one thread or one note: it is restored when the window is opened again, it has its
// own "New conversation", and it never touches the Cmd-K / Genos page conversation.
//
// Layout:
//   - Header: the title, and the task as the conversation's SUBJECT ("MIP-1057 · its title")
//   - Body: the restore's state (loading, could not load + Retry, or gone), the conversation, and
//     below it the input (not once the task is gone)
//   - Footer: New conversation
//
// A task that cannot be opened any more (deleted, access lost: the server answers both alike) is said
// calmly, once, with one way on: ask Genos in general. Nothing here loops: the input is gone with it.

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import AddCommentOutlinedIcon from "@mui/icons-material/AddCommentOutlined";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import LinkOffRoundedIcon from "@mui/icons-material/LinkOffRounded";
import { Box, Button } from "@mui/joy";
import { useTheme } from "@mui/joy/styles";

import { visuallyHidden } from "../../components/ui/a11y/visuallyHidden";
import { EmptyState } from "../../components/ui/feedback/EmptyState";
import { ErrorState } from "../../components/ui/feedback/ErrorState";
import { Spinner } from "../../components/ui/feedback/Skeleton";
import { ModalFrame } from "../../components/ui/modal/ModalFrame";
import { useTranslation } from "../../i18n";
import { focusRing, g } from "../../theme/tokens";
import {
    AgentQAConversation,
    AgentQAInput,
    buildAgentTurnLabels,
    type AgentQALabels,
} from "../agentQA";
import type { SpotlightResult } from "../spotlight/types";
import type { UseTaskAskReturn } from "./useTaskAsk";

interface TaskAskModalProps {
    state: UseTaskAskReturn;
    /** A citation that has no preview to open (the host navigates). */
    onSelectSource?: (source: SpotlightResult) => void;
    /** "Ask Genos in general" once the task is gone: the general Ask, with `draft` (a question that
     *  was refused, when there is one) as its draft. The window closes itself first. */
    onAskInGeneral?: (draft?: string) => void;
}

export const TaskAskModal = ({ state, onSelectSource, onAskInGeneral }: TaskAskModalProps) => {
    const theme = useTheme();
    const { t } = useTranslation();
    const target = state.target;
    const isMilestone = target?.isMilestone === true;

    const labels = useMemo<AgentQALabels>(
        () => ({
            conversation: {
                empty: isMilestone
                    ? t.taskAsk.conversation.emptyMilestone
                    : t.taskAsk.conversation.emptyTask,
                placeholder: isMilestone
                    ? t.taskAsk.conversation.placeholderMilestone
                    : t.taskAsk.conversation.placeholderTask,
                send: t.common.actions.send,
                cancel: t.common.actions.cancel,
            },
            mentions: { ariaLabel: t.spotlight.mentions.ariaLabel },
        }),
        [t, isMilestone]
    );
    const turnLabels = useMemo(() => buildAgentTurnLabels(t, "taskAsk"), [t]);

    const { agentQA } = state;
    const ask = agentQA.ask;
    const hasInFlightAnswer =
        ask.isStreaming ||
        Boolean(ask.askError) ||
        Boolean(ask.answer) ||
        ask.toolEvents.length > 0 ||
        ask.pendingApproval !== null;
    const hasConversation = agentQA.turns.length > 0 || hasInFlightAnswer;

    // The subject: what the conversation is about, by the name the member knows it by. Clamped to two
    // lines (a title can be a paragraph); a screen reader still reads all of it.
    const subject = target ? (
        <Box
            component="span"
            sx={{
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: 2,
                overflow: "hidden",
                overflowWrap: "anywhere",
            }}
        >
            {target.displayId && (
                <>
                    <Box
                        component="span"
                        translate="no"
                        sx={{
                            color: g.text.primary,
                            fontVariantNumeric: "tabular-nums",
                            fontWeight: 500,
                        }}
                    >
                        {target.displayId}
                    </Box>
                    {target.title ? " · " : ""}
                </>
            )}
            {target.title}
        </Box>
    ) : null;

    // ---- New conversation ----
    // The button disables itself once there is nothing left to clear, so the focus it had would be
    // lost to the page: put it back in the input, and say in words what happened.
    const inputWrapRef = useRef<HTMLDivElement | null>(null);
    const [announcement, setAnnouncement] = useState("");
    const startNew = useCallback(() => {
        state.startNewConversation();
        setAnnouncement(t.taskAsk.conversation.newConversationStarted);
        requestAnimationFrame(() => inputWrapRef.current?.querySelector("textarea")?.focus());
    }, [state, t]);
    // The sentence is for the moment it happens: the next question clears it.
    useEffect(() => {
        if (hasConversation) setAnnouncement("");
    }, [hasConversation]);

    const gone = state.status === "gone";
    const askInGeneral = useCallback(
        (draft?: string) => {
            state.close();
            onAskInGeneral?.(draft);
        },
        [state, onAskInGeneral]
    );

    // "Ask again" on a question the gone task refused is the person asking it anyway: it goes to the
    // general Ask as the draft, not into a window that can no longer ask.
    const conversationState = useMemo(
        () =>
            gone && onAskInGeneral
                ? {
                      ...agentQA,
                      onAsk: (query?: string) => {
                          if (query) askInGeneral(query);
                          return false;
                      },
                  }
                : agentQA,
        [gone, onAskInGeneral, agentQA, askInGeneral]
    );

    const hintId = useId();
    const closeLabel = t.common.actions.close;

    return (
        <ModalFrame
            closeLabel={closeLabel}
            description={subject ?? undefined}
            icon={<AutoAwesomeRoundedIcon sx={{ color: g.accent.text }} />}
            open={state.isOpen}
            size="xl"
            title={isMilestone ? t.taskAsk.modal.titleMilestone : t.taskAsk.modal.titleTask}
            zIndex={theme.zIndex.modal}
            actions={
                gone ? undefined : (
                    <>
                        <Box id={hintId} sx={visuallyHidden}>
                            {t.taskAsk.conversation.newConversationHint}
                        </Box>
                        <Button
                            aria-describedby={hintId}
                            color="neutral"
                            disabled={!state.canAsk || !hasConversation}
                            startDecorator={<AddCommentOutlinedIcon sx={{ fontSize: 18 }} />}
                            sx={{ "&:focus-visible": focusRing }}
                            variant="plain"
                            onClick={startNew}
                        >
                            {t.taskAsk.conversation.newConversation}
                        </Button>
                    </>
                )
            }
            headerDivider
            onClose={state.close}
        >
            {/* Said once, to a screen reader, when a new conversation starts. (Live regions, not
                role="status": the answer turn's own notices are the `status`es of this dialog.) */}
            <Box aria-atomic="true" aria-live="polite" sx={visuallyHidden}>
                {announcement}
            </Box>

            {state.status === "loading" && (
                <Box sx={{ py: 2 }}>
                    <Spinner caption={t.taskAsk.loading} />
                </Box>
            )}

            {state.status === "failed" && (
                <ErrorState
                    data-error="taskAsk-restore"
                    size="xs"
                    title={t.services.agent.taskSessionLoadFailed}
                    onRetry={state.reload}
                />
            )}

            {(hasConversation || (state.status !== "gone" && state.status !== "loading")) && (
                <AgentQAConversation
                    labels={labels}
                    state={conversationState}
                    turnLabels={turnLabels}
                    onSelectSource={onSelectSource}
                />
            )}

            {/* A live region that is always there, so the sentence is announced when it appears. */}
            <Box aria-live="polite">
                {gone && (
                    <EmptyState
                        body={t.taskAsk.gone.body}
                        data-empty="task-ask-gone"
                        icon={<LinkOffRoundedIcon />}
                        size="sm"
                        action={
                            onAskInGeneral
                                ? {
                                      label: t.taskAsk.gone.askInGeneral,
                                      onClick: () => askInGeneral(),
                                  }
                                : undefined
                        }
                        title={
                            isMilestone ? t.taskAsk.gone.titleMilestone : t.taskAsk.gone.titleTask
                        }
                    />
                )}
            </Box>

            {!gone && (
                <Box ref={inputWrapRef} sx={{ mt: 1 }}>
                    <AgentQAInput disabled={!state.canAsk} labels={labels} state={agentQA} />
                </Box>
            )}
        </ModalFrame>
    );
};
