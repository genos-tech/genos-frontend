import { useState } from "react";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import { Box, Button, Checkbox, IconButton, Sheet, Stack, Typography } from "@mui/joy";

import { AppTooltip } from "../../../components/ui/AppTooltip";
import { EmptyState } from "../../../components/ui/feedback/EmptyState";
import { SkeletonRows } from "../../../components/ui/feedback/Skeleton";
import { ConfirmDialog } from "../../../components/ui/modal/ConfirmDialog";
import { fmt, useTranslation } from "../../../i18n";
import {
    deleteAgentSession,
    deleteAllAgentSessions,
    type AgentSessionSummary,
} from "../../../services/agentApi";
import { emitAgentSessionsDeleted } from "../../agentQA";
import { relativeTimeLabel } from "../../spotlight/SpotlightContent";
import { useGenosSessions } from "../useGenosSessions";
import { GENOS_MEMORY_CONFIRM_Z_INDEX } from "./confirmLayer";

interface Props {
    accessToken: string | null;
    teamId: string;
    // Called after anything was deleted, so the page can refresh what else
    // depends on those conversations (the shared answers built from them).
    onChanged?: () => void;
}

type Target = { kind: "one"; session: AgentSessionSummary } | { kind: "all" };

/**
 * "Your Genos conversations": the History list, each row deletable, and a
 * delete-all.
 *
 * The list is `useGenosSessions` — the hook behind the Genos page's history
 * sidebar, hence the same endpoint, the same cap and the same ordering as
 * the History panel. Deleting does not touch that state directly: it
 * announces `agentSessionsDeleted`, which this hook (and every other
 * surface showing the conversation) answers by dropping the rows. One path
 * means the row cannot disappear here yet linger in the History panel.
 *
 * Outcomes the person has to be told apart:
 *  - 409 (a conversation is still answering): nothing was deleted, say wait.
 *  - 404 (already gone): that IS the state they wanted, so the row goes.
 *  - anything else: nothing known changed, say so and keep the row.
 *
 * A list that failed to LOAD is its own state, not an empty one: "you have no
 * conversations" on this page is a claim about what Genos keeps, and an
 * outage must not be able to make it. With rows already showing, a failed
 * refresh just leaves them; with none, it says so and offers a retry (the same
 * shape as the shared-answers list below it).
 */
export const ConversationsSection = ({ accessToken, teamId, onChanged }: Props) => {
    const { t } = useTranslation();
    const m = t.settings.genosMemory.conversations;
    const { sessions, isLoading, loadFailed, reload } = useGenosSessions({
        accessToken,
        teamId,
        refreshKey: 0,
    });

    const [target, setTarget] = useState<Target | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // Delete-all's extra gate. Reset every time a confirm opens.
    const [acknowledged, setAcknowledged] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);

    const openConfirm = (next: Target) => {
        setTarget(next);
        setError(null);
        setAcknowledged(false);
        setNotice(null);
    };
    const closeConfirm = () => {
        if (busy) return;
        setTarget(null);
        setError(null);
    };

    const confirmDelete = async () => {
        if (!target || !accessToken || !teamId || busy) return;
        setBusy(true);
        setError(null);
        const result =
            target.kind === "one"
                ? await deleteAgentSession({ accessToken, sessionId: target.session.session_id })
                : await deleteAllAgentSessions({ accessToken, teamId });
        setBusy(false);

        if (result.kind === "in_flight") {
            setError(m.inFlight);
            return;
        }
        if (result.kind === "error") {
            setError(m.failed);
            return;
        }
        // "deleted" and "gone" both mean the conversation(s) no longer
        // exist; the announcement is what updates every list and resets any
        // open conversation.
        emitAgentSessionsDeleted(
            target.kind === "one"
                ? { teamId, sessionIds: [target.session.session_id] }
                : { teamId, all: true }
        );
        setNotice(target.kind === "all" ? m.deletedAll : null);
        setTarget(null);
        onChanged?.();
    };

    return (
        <Sheet sx={{ p: 2, borderRadius: "lg", minWidth: 0 }} variant="outlined">
            <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 0.5 }}>
                <ChatBubbleOutlineRoundedIcon />
                <Typography level="title-md" sx={{ minWidth: 0, overflowWrap: "anywhere" }}>
                    {m.heading}
                </Typography>
            </Stack>
            <Typography level="body-xs" sx={{ mb: 1.5 }}>
                {m.description}
            </Typography>

            {isLoading ? (
                <SkeletonRows count={3} label={m.loading} />
            ) : sessions.length === 0 && loadFailed ? (
                <Stack alignItems="flex-start" spacing={1} sx={{ py: 1 }}>
                    <Typography level="body-sm" sx={{ color: "danger.500" }}>
                        {m.loadFailed}
                    </Typography>
                    <Button size="sm" variant="outlined" onClick={reload}>
                        {t.common.actions.retry}
                    </Button>
                </Stack>
            ) : sessions.length === 0 ? (
                <EmptyState body={m.empty} data-empty="genos-conversations" size="xs" />
            ) : (
                <>
                    <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0, minWidth: 0 }}>
                        {sessions.map((s) => (
                            <Box
                                key={s.session_id}
                                component="li"
                                sx={{
                                    display: "flex",
                                    alignItems: "flex-start",
                                    gap: 1,
                                    py: 1,
                                    minWidth: 0,
                                    borderTop: "1px solid",
                                    borderColor: "divider",
                                    "&:first-of-type": { borderTop: "none" },
                                }}
                            >
                                {/* `minWidth: 0` is what lets the text shrink
                                    inside a flex row; without it a long
                                    unbroken question pushes the delete button
                                    off a phone-width dialog. */}
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography
                                        level="body-sm"
                                        sx={{
                                            fontWeight: 500,
                                            overflowWrap: "anywhere",
                                            display: "-webkit-box",
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: "vertical",
                                            overflow: "hidden",
                                        }}
                                    >
                                        {s.first_query || t.spotlight.states.untitled}
                                    </Typography>
                                    <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
                                        {relativeTimeLabel(s.last_active_at, t.spotlight)}
                                        {" · "}
                                        {fmt(t.spotlight.history.turnCount, {
                                            count: s.turn_count,
                                        })}
                                    </Typography>
                                </Box>
                                <AppTooltip placement="top" title={m.deleteTooltip}>
                                    <IconButton
                                        color="danger"
                                        size="sm"
                                        sx={{ flexShrink: 0 }}
                                        variant="plain"
                                        aria-label={fmt(m.deleteAria, {
                                            question: s.first_query || t.spotlight.states.untitled,
                                        })}
                                        onClick={() => openConfirm({ kind: "one", session: s })}
                                    >
                                        <DeleteOutlineRoundedIcon />
                                    </IconButton>
                                </AppTooltip>
                            </Box>
                        ))}
                    </Box>
                    <Typography level="body-xs" sx={{ mt: 1, color: "text.tertiary" }}>
                        {m.listNote}
                    </Typography>
                </>
            )}

            {notice && (
                <Typography level="body-sm" role="status" sx={{ mt: 1.5 }}>
                    {notice}
                </Typography>
            )}

            {/* Always offered, even over an empty list: delete-all also
                removes what the list can't show (older than its cap, hidden
                by the plan's history window), so "nothing listed" does not
                mean "nothing kept". */}
            <Box sx={{ mt: 1.5 }}>
                <Button
                    color="danger"
                    disabled={!accessToken || !teamId}
                    size="sm"
                    startDecorator={<DeleteOutlineRoundedIcon />}
                    variant="outlined"
                    onClick={() => openConfirm({ kind: "all" })}
                >
                    {m.deleteAll}
                </Button>
            </Box>

            <ConfirmDialog
                busy={busy}
                cancelLabel={t.common.actions.cancel}
                confirmLabel={m.deleteConfirm}
                description={m.deleteBody}
                error={error}
                open={target?.kind === "one"}
                title={m.deleteTitle}
                zIndex={GENOS_MEMORY_CONFIRM_Z_INDEX}
                destructive
                onClose={closeConfirm}
                onConfirm={confirmDelete}
            >
                {target?.kind === "one" && (
                    <Typography
                        level="body-xs"
                        sx={{
                            overflowWrap: "anywhere",
                            color: "text.tertiary",
                            display: "-webkit-box",
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                        }}
                    >
                        {target.session.first_query || t.spotlight.states.untitled}
                    </Typography>
                )}
            </ConfirmDialog>

            <ConfirmDialog
                busy={busy}
                cancelLabel={t.common.actions.cancel}
                confirmDisabled={!acknowledged}
                confirmLabel={m.deleteAllConfirm}
                description={m.deleteAllBody}
                error={error}
                open={target?.kind === "all"}
                title={m.deleteAllTitle}
                zIndex={GENOS_MEMORY_CONFIRM_Z_INDEX}
                destructive
                onClose={closeConfirm}
                onConfirm={confirmDelete}
            >
                <Checkbox
                    checked={acknowledged}
                    disabled={busy}
                    label={m.deleteAllAck}
                    size="sm"
                    onChange={(e) => setAcknowledged(e.target.checked)}
                />
            </ConfirmDialog>
        </Sheet>
    );
};
