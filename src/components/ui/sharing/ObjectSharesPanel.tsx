/**
 * "Teams in this <thing>" — the cross-team panel every shared surface uses.
 *
 * Presentational on purpose: it takes the rows and the four verbs, and
 * knows nothing about channels, projects or folders. That is what lets the
 * chat panel route its add/remove through the socket layer (so the other
 * side sees the roster change live) while a project or folder goes straight
 * to the grant endpoints, without either surface reinventing the layout or,
 * worse, the rules.
 *
 * The asymmetry it renders is the feature, not a detail:
 *
 * - The host sees every guest team and may eject a person or end the share,
 *   and gets NO add control. A host "add" button would offer an action the
 *   server refuses and imply the host picks the other organization's
 *   people — the single misunderstanding this design exists to prevent.
 * - A guest team's owner/editor (`canAdmit`) gets a picker of their own
 *   colleagues, usable any time, because their side of the roster is theirs
 *   to run.
 *
 * `canAdmit` and `side` come from the server. Deriving them from team ids
 * here would be a second, drifting copy of an authorization rule.
 */
import { useState } from "react";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import LinkOffRoundedIcon from "@mui/icons-material/LinkOffRounded";
import PersonAddAltRoundedIcon from "@mui/icons-material/PersonAddAltRounded";
import PersonRemoveRoundedIcon from "@mui/icons-material/PersonRemoveRounded";
import { Box, Button, Chip, FormLabel, IconButton, Stack, Tooltip, Typography } from "@mui/joy";

import type { ObjectShare } from "../../../features/admin/services/teamConnections";
import { fmt, useTranslation } from "../../../i18n";

export type OfferableTeam = { teamId: string; teamName: string };

type Props = {
    shares: ObjectShare[];
    busy: boolean;
    error: string | null;
    /** The current user, so the admit picker never offers them to themselves. */
    myUserId: string;
    /** A guest team's own roster, fetched on demand for the admit picker. */
    rosterFor: (teamId: string) => Promise<{ userId: string; userName: string }[]>;
    onAdmit: (share: ObjectShare, userId: string) => Promise<unknown>;
    onWithdraw: (share: ObjectShare, userId: string) => Promise<unknown>;
    onRevoke: (share: ObjectShare) => Promise<unknown>;
    /** Connected teams not yet offered this object. Host managers only;
     *  pass an empty list to hide the offer control entirely. */
    offerableTeams?: OfferableTeam[];
    onOffer?: (teamId: string) => Promise<unknown>;
    labelColor: string;
    valueColor: string;
    borderColor: string;
};

export const ObjectSharesPanel = ({
    shares,
    busy,
    error,
    myUserId,
    rosterFor,
    onAdmit,
    onWithdraw,
    onRevoke,
    offerableTeams = [],
    onOffer,
    labelColor,
    valueColor,
    borderColor,
}: Props) => {
    const { t } = useTranslation();
    const strings = t.common.externalShares;

    // Which team's picker is open, and that team's roster. Fetched on
    // demand: it is the guest team's own roster, needed only when they are
    // actually about to add somebody.
    const [pickerTeamId, setPickerTeamId] = useState<string | null>(null);
    const [roster, setRoster] = useState<{ userId: string; userName: string }[]>([]);

    const openPicker = async (share: ObjectShare) => {
        setPickerTeamId(share.teamId);
        setRoster(await rosterFor(share.teamId));
    };

    const visible = shares.filter((s) => s.status === "active" || s.status === "pending");
    if (visible.length === 0 && offerableTeams.length === 0) return null;

    const shareRow = (share: ObjectShare) => {
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
                            {/* Who owns the thing, then how it stands. The
                                name above is the other team on both sides
                                of the share, so which side you are on has
                                to be said rather than inferred. */}
                            {(share.side === "given" ? strings.sideGiven : strings.sideReceived) +
                                " · "}
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
                            onClick={() => void onRevoke(share)}
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
                                        color="danger"
                                        disabled={busy}
                                        size="sm"
                                        variant="plain"
                                        aria-label={fmt(strings.removeParticipant, {
                                            name: p.userName,
                                        })}
                                        onClick={() => void onWithdraw(share, p.userId)}
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
                                        onClick={() => {
                                            setPickerTeamId(null);
                                            void onAdmit(share, candidate.userId);
                                        }}
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
            <Stack spacing={1}>{visible.map(shareRow)}</Stack>
            {offerableTeams.length > 0 && onOffer && (
                <Box sx={{ mt: 1 }}>
                    <Typography level="body-xs" sx={{ mb: 0.5, color: labelColor }}>
                        {strings.offerPrompt}
                    </Typography>
                    <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5 }}>
                        {offerableTeams.map((team) => (
                            <Button
                                key={team.teamId}
                                disabled={busy}
                                size="sm"
                                variant="outlined"
                                onClick={() => void onOffer(team.teamId)}
                            >
                                {team.teamName}
                            </Button>
                        ))}
                    </Stack>
                </Box>
            )}
            {error && (
                <Typography level="body-xs" sx={{ mt: 1, color: "var(--gp-tint-danger)" }}>
                    {error}
                </Typography>
            )}
        </Box>
    );
};
