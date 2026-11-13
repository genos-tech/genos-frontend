import { useState } from "react";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import { Box, Button, Sheet, Stack, Switch, Typography } from "@mui/joy";

import { EmptyState } from "../../../components/ui/feedback/EmptyState";
import { ErrorState } from "../../../components/ui/feedback/ErrorState";
import { SkeletonRows } from "../../../components/ui/feedback/Skeleton";
import { ConfirmDialog } from "../../../components/ui/modal/ConfirmDialog";
import { SettingRow } from "../../../components/ui/settings/SettingRow";
import { useShareAnswersPreference } from "../../../hooks/common/useShareAnswersPreference";
import { fmt, useTranslation } from "../../../i18n";
import type { SharedAnswer } from "../../../services/agentApi";
import { relativeTimeLabel } from "../../spotlight/SpotlightContent";
import { GENOS_MEMORY_CONFIRM_Z_INDEX } from "./confirmLayer";
import { useSharedAnswers } from "./useSharedAnswers";

interface Props {
    accessToken: string | null;
    teamId: string;
    // Bumped by the page when a conversation delete may have removed answers.
    refreshKey: number;
}

/**
 * "Answers shared with your team": the account-wide switch, and the list of
 * answers this person currently has shared in THIS team.
 *
 * The two are deliberately different scopes and the copy says so. The switch
 * is one setting for the whole account (turning it off removes the person's
 * answers from every team they're in), while the list is per team — the
 * workspace shows one team at a time, and another team's answers don't belong
 * in this team's shell.
 *
 * Two flows are one-way and so sit behind a confirm that says what stays and
 * what goes: turning the switch OFF, and stopping one answer.
 */
export const SharedAnswersSection = ({ accessToken, teamId, refreshKey }: Props) => {
    const { t } = useTranslation();
    const m = t.settings.genosMemory.shared;
    const pref = useShareAnswersPreference();
    const list = useSharedAnswers({ accessToken, teamId, refreshKey });

    const [offOpen, setOffOpen] = useState(false);
    const [stopTarget, setStopTarget] = useState<SharedAnswer | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // A failed switch-ON (OFF reports inside its dialog).
    const [toggleError, setToggleError] = useState(false);

    // The preference endpoint is authoritative; the list response carries the
    // same value and stands in if that request failed. Unknown (both failed)
    // disables the switch rather than guessing, for the reason in the hook.
    const enabled = pref.enabled ?? list.sharePref;
    const known = enabled !== null;

    const onSwitch = async (next: boolean) => {
        setToggleError(false);
        if (!next) {
            // Turning OFF removes things, so it asks first.
            setError(null);
            setOffOpen(true);
            return;
        }
        const ok = await pref.setEnabled(true);
        if (!ok) {
            setToggleError(true);
            return;
        }
        // The server answers a fresh list now that sharing is back on.
        list.reload();
    };

    const confirmOff = async () => {
        if (busy) return;
        setBusy(true);
        setError(null);
        const ok = await pref.setEnabled(false);
        setBusy(false);
        if (!ok) {
            setError(m.toggleFailed);
            return;
        }
        list.clear();
        setOffOpen(false);
    };

    const confirmStop = async () => {
        if (!stopTarget || busy) return;
        setBusy(true);
        setError(null);
        const ok = await list.stopSharing(stopTarget.run_id);
        setBusy(false);
        if (!ok) {
            setError(m.stopFailed);
            return;
        }
        setStopTarget(null);
    };

    const renderList = () => {
        if (list.status === "loading") {
            return <SkeletonRows count={3} label={m.loading} />;
        }
        if (list.status === "error") {
            return (
                <ErrorState
                    data-error="genos-shared-answers"
                    size="xs"
                    title={m.loadFailed}
                    onRetry={list.reload}
                />
            );
        }
        if (enabled === false || list.answers.length === 0) {
            return (
                <EmptyState
                    body={enabled === false ? m.emptyOff : m.empty}
                    data-empty="shared-answers"
                    size="xs"
                />
            );
        }
        return (
            <>
                <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0, minWidth: 0 }}>
                    {list.answers.map((a) => (
                        <Box
                            key={a.run_id}
                            component="li"
                            sx={{
                                py: 1.25,
                                minWidth: 0,
                                borderTop: "1px solid",
                                borderColor: "divider",
                                "&:first-of-type": { borderTop: "none" },
                            }}
                        >
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
                                {a.question}
                            </Typography>
                            <Typography
                                level="body-xs"
                                sx={{
                                    mt: 0.25,
                                    overflowWrap: "anywhere",
                                    display: "-webkit-box",
                                    WebkitLineClamp: 3,
                                    WebkitBoxOrient: "vertical",
                                    overflow: "hidden",
                                }}
                            >
                                {a.answer_snippet}
                            </Typography>
                            <Typography level="body-xs" sx={{ mt: 0.5, color: "text.tertiary" }}>
                                {relativeTimeLabel(a.started_at, t.spotlight)}
                                {" · "}
                                {a.audience_size > 1
                                    ? fmt(m.audienceMany, { count: a.audience_size })
                                    : m.audienceOnlyYou}
                            </Typography>
                            <Button
                                color="neutral"
                                size="sm"
                                sx={{ mt: 0.75 }}
                                variant="outlined"
                                onClick={() => {
                                    setError(null);
                                    setStopTarget(a);
                                }}
                            >
                                {m.stop}
                            </Button>
                        </Box>
                    ))}
                </Box>
                {list.hasMore && (
                    <Typography level="body-xs" sx={{ mt: 1, color: "text.tertiary" }}>
                        {fmt(m.hasMore, { count: list.answers.length })}
                    </Typography>
                )}
            </>
        );
    };

    return (
        <Sheet sx={{ p: 2, borderRadius: "lg", minWidth: 0 }} variant="outlined">
            <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 1.5 }}>
                <GroupsRoundedIcon />
                <Typography level="title-md" sx={{ minWidth: 0, overflowWrap: "anywhere" }}>
                    {m.heading}
                </Typography>
            </Stack>

            <SettingRow
                alignItems="center"
                direction="row"
                disabled={!known || pref.saving}
                justifyContent="space-between"
                spacing={2}
                sx={{ mb: 1.5 }}
            >
                <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography level="title-sm">{m.switchLabel}</Typography>
                    <Typography level="body-xs">{m.switchHelper}</Typography>
                </Box>
                <Switch
                    checked={enabled === true}
                    disabled={!known || pref.saving}
                    slotProps={{ input: { "aria-label": m.switchLabel } }}
                    onChange={(e) => void onSwitch(e.target.checked)}
                />
            </SettingRow>
            {toggleError && (
                <Typography level="body-xs" role="alert" sx={{ mb: 1, color: "danger.500" }}>
                    {m.toggleFailed}
                </Typography>
            )}

            {renderList()}

            <ConfirmDialog
                busy={busy}
                cancelLabel={t.common.actions.cancel}
                confirmLabel={m.offConfirm}
                description={m.offBody}
                error={error}
                open={offOpen}
                title={m.offTitle}
                zIndex={GENOS_MEMORY_CONFIRM_Z_INDEX}
                destructive
                onConfirm={confirmOff}
                onClose={() => {
                    if (!busy) setOffOpen(false);
                }}
            />

            <ConfirmDialog
                busy={busy}
                cancelLabel={t.common.actions.cancel}
                confirmLabel={m.stopConfirm}
                description={m.stopBody}
                error={error}
                open={stopTarget !== null}
                title={m.stopTitle}
                zIndex={GENOS_MEMORY_CONFIRM_Z_INDEX}
                destructive
                onConfirm={confirmStop}
                onClose={() => {
                    if (!busy) setStopTarget(null);
                }}
            >
                {stopTarget && (
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
                        {stopTarget.question}
                    </Typography>
                )}
            </ConfirmDialog>
        </Sheet>
    );
};
