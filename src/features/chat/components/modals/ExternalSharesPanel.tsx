/**
 * "Teams in this chat" — the cross-team section of an external GM.
 *
 * One panel, two very different jobs, because the two sides of a share are
 * deliberately asymmetric (see `origin/services/external_grants.py`):
 *
 * - **The host** (`side === "given"`) sees every guest team and who each
 *   one let in, and may eject one person or end a whole share. It may NOT
 *   add the other organization's people, so no add control is rendered on
 *   this side — the absence is the feature, not an omission.
 * - **A guest team's owner/editor** (`canAdmit`) adds and removes their own
 *   colleagues freely, any time, with no request back to the host. This is
 *   the repeatable half of the design, so it is a plain picker rather than
 *   anything that looks like a request.
 *
 * `canAdmit` and `side` both come from the server. Deriving them here from
 * team ids would be a second, drifting copy of an authorization rule.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import LinkOffRoundedIcon from "@mui/icons-material/LinkOffRounded";
import PersonAddAltRoundedIcon from "@mui/icons-material/PersonAddAltRounded";
import PersonRemoveRoundedIcon from "@mui/icons-material/PersonRemoveRounded";
import { Box, Button, Chip, FormLabel, IconButton, Stack, Tooltip, Typography } from "@mui/joy";

import { useAuth } from "../../../../context/AuthContext";
import { fmt, useTranslation } from "../../../../i18n";
import { channelService } from "../../../../services/channel/channelService";
import { ChannelKind, type ChannelShare } from "../../../../types/channel";
import { fetchOwnTeamRoster, revokeExternalShare } from "../../../admin/services/teamConnections";

type Props = {
    channelId: string;
    /** The current user, so the picker can skip them and their own row. */
    myUserId: string;
    labelColor: string;
    valueColor: string;
    borderColor: string;
};

type RosterEntry = { userId: string; userName: string; userEmail: string };

export const ExternalSharesPanel = ({
    channelId,
    myUserId,
    labelColor,
    valueColor,
    borderColor,
}: Props) => {
    const { t } = useTranslation();
    const { accessToken } = useAuth();
    const strings = t.chat.modals.externalShares;

    const [shares, setShares] = useState<ChannelShare[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // Which team's picker is open, and that team's roster. Fetched on
    // demand: it is the guest team's own roster, needed only when they are
    // actually about to add somebody.
    const [pickerTeamId, setPickerTeamId] = useState<string | null>(null);
    const [roster, setRoster] = useState<RosterEntry[]>([]);

    const refresh = useCallback(async () => {
        try {
            setShares(await channelService.fetchChannelShares(channelId));
        } catch {
            // A chat that turns out not to be shared and a failed fetch
            // look the same here; this section is never why the modal was
            // opened, so it stays quiet and empty.
            setShares([]);
        }
    }, [channelId]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const activeShares = useMemo(() => shares.filter((s) => s.status === "active"), [shares]);
    const pendingShares = useMemo(() => shares.filter((s) => s.status === "pending"), [shares]);

    const openPicker = async (share: ChannelShare) => {
        setError(null);
        setPickerTeamId(share.teamId);
        setRoster(await fetchOwnTeamRoster(accessToken, share.teamId));
    };

    const run = async (action: () => Promise<unknown>) => {
        setBusy(true);
        setError(null);
        try {
            await action();
        } catch {
            setError(strings.actionFailed);
        }
        setBusy(false);
        await refresh();
    };

    const admit = (userId: string) =>
        run(async () => {
            await channelService.addMembers(channelId, [userId]);
            setPickerTeamId(null);
        });

    const withdraw = (userId: string) =>
        run(() => channelService.removeMember(channelId, ChannelKind.GM, userId));

    const endShare = (share: ChannelShare) =>
        run(() => revokeExternalShare(accessToken, share.grantId, setError));

    if (shares.length === 0) return null;

    const shareRow = (share: ChannelShare) => {
        const admitted = new Set(share.participants.map((p) => p.userId));
        const addable = roster.filter((r) => !admitted.has(r.userId) && r.userId !== myUserId);
        return (
            <Box
                key={share.grantId}
                sx={{
                    px: 1.5,
                    py: 1.25,
                    borderRadius: "8px",
                    border: `1px solid ${borderColor}`,
                }}
            >
                <Stack alignItems="center" direction="row" spacing={1}>
                    <GroupsRoundedIcon sx={{ fontSize: 18, color: labelColor, flexShrink: 0 }} />
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography
                            level="body-sm"
                            sx={{ color: valueColor, fontWeight: 600 }}
                            noWrap
                        >
                            {share.teamName}
                        </Typography>
                        <Typography level="body-xs" sx={{ color: labelColor }}>
                            {share.status === "pending"
                                ? strings.awaitingTheirApproval
                                : fmt(strings.participantCount, {
                                      count: share.participants.length,
                                  })}
                        </Typography>
                    </Box>
                    <Chip color="neutral" size="sm" variant="soft">
                        {share.roleCeiling === "editor"
                            ? strings.ceilingEditor
                            : strings.ceilingViewer}
                    </Chip>
                    {share.canAdmit && share.status === "active" && (
                        <Tooltip title={strings.addFromYourTeam}>
                            <IconButton
                                aria-label={strings.addFromYourTeam}
                                color="primary"
                                disabled={busy}
                                size="sm"
                                variant="plain"
                                onClick={() => void openPicker(share)}
                            >
                                <PersonAddAltRoundedIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    )}
                    <Tooltip title={strings.endShare}>
                        <IconButton
                            aria-label={strings.endShare}
                            color="danger"
                            disabled={busy}
                            size="sm"
                            variant="plain"
                            onClick={() => void endShare(share)}
                        >
                            <LinkOffRoundedIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Stack>

                {share.participants.length > 0 && (
                    <Stack
                        direction="row"
                        spacing={0.5}
                        sx={{ mt: 1, flexWrap: "wrap", gap: 0.5 }}
                    >
                        {share.participants.map((p) => (
                            <Chip
                                key={p.userId}
                                color="primary"
                                size="sm"
                                variant="soft"
                                endDecorator={
                                    <IconButton
                                        aria-label={fmt(strings.removeParticipant, {
                                            name: p.userName,
                                        })}
                                        color="danger"
                                        disabled={busy}
                                        size="sm"
                                        variant="plain"
                                        onClick={() => void withdraw(p.userId)}
                                    >
                                        <PersonRemoveRoundedIcon sx={{ fontSize: 14 }} />
                                    </IconButton>
                                }
                            >
                                {p.userName}
                            </Chip>
                        ))}
                    </Stack>
                )}

                {pickerTeamId === share.teamId && (
                    <Box sx={{ mt: 1 }}>
                        {addable.length === 0 ? (
                            <Typography level="body-xs" sx={{ color: labelColor }}>
                                {strings.everyoneAlreadyIn}
                            </Typography>
                        ) : (
                            <Stack
                                direction="row"
                                spacing={0.5}
                                sx={{ flexWrap: "wrap", gap: 0.5 }}
                            >
                                {addable.map((candidate) => (
                                    <Button
                                        key={candidate.userId}
                                        disabled={busy}
                                        size="sm"
                                        variant="outlined"
                                        onClick={() => void admit(candidate.userId)}
                                    >
                                        {candidate.userName}
                                    </Button>
                                ))}
                            </Stack>
                        )}
                    </Box>
                )}
            </Box>
        );
    };

    return (
        <Box sx={{ mt: 2 }}>
            <FormLabel
                sx={{
                    color: labelColor,
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    mb: 0.75,
                }}
            >
                {strings.title}
            </FormLabel>
            <Typography level="body-xs" sx={{ mb: 1, color: labelColor }}>
                {strings.explainer}
            </Typography>
            <Stack spacing={1}>
                {activeShares.map(shareRow)}
                {pendingShares.map(shareRow)}
            </Stack>
            {error && (
                <Typography level="body-xs" sx={{ mt: 1, color: "var(--gp-tint-danger)" }}>
                    {error}
                </Typography>
            )}
        </Box>
    );
};
