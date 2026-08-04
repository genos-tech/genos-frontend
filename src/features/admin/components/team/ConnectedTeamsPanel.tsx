/**
 * "Connected teams" — the relationship layer, in the team profile.
 *
 * Sits beside member management because that is what it is: membership at
 * one level up. A connection grants NOTHING on its own — it only lets the
 * two teams name each other when sharing a chat, project, or note folder
 * later. The copy has to carry that, or "connect" reads like "give them
 * access", which is the one misunderstanding that matters here.
 *
 * Three lists, because there are three different things to do:
 *
 *   incoming   another team asked. Approve or decline.
 *   outgoing   we asked. Nothing to do but wait.
 *   active     connected. Share things, or disconnect.
 *
 * Read-only for viewers: they see who the team works with (useful, and not
 * sensitive — it is a team name), but every action is owner/editor only
 * and the server re-checks each one.
 */
import { useState } from "react";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import HubRoundedIcon from "@mui/icons-material/HubRounded";
import LinkOffRoundedIcon from "@mui/icons-material/LinkOffRounded";
import {
    Box,
    Button,
    Chip,
    FormControl,
    FormLabel,
    IconButton,
    Input,
    Stack,
    Tooltip,
    Typography,
} from "@mui/joy";

import { ModalLeaveConfirm } from "../../../../components/ui/misc/ModalLeaveConfirm";
import { fmt, useTranslation } from "../../../../i18n";
import type { TeamConnection } from "../../services/teamConnections";
import type { TeamConnectionControls } from "./useTeamConnections";

type Props = {
    connections: TeamConnectionControls;
    /** Owner or editor. Gates the actions, not the list. */
    canManage: boolean;
    /** So the "connect" form can refuse the team you are already in. */
    myTeamId: string;
    labelColor: string;
    valueColor: string;
    borderColor: string;
};

export const ConnectedTeamsPanel = ({
    connections,
    canManage,
    myTeamId,
    labelColor,
    valueColor,
    borderColor,
}: Props) => {
    const { t } = useTranslation();
    const strings = t.admin.connectedTeams;

    const [teamIdDraft, setTeamIdDraft] = useState("");
    const [localError, setLocalError] = useState<string | null>(null);
    // Disconnect deletes real access on both sides, so it is confirmed.
    const [pendingRevoke, setPendingRevoke] = useState<TeamConnection | null>(null);
    const [withdrawnNotice, setWithdrawnNotice] = useState<number | null>(null);

    const { active, incoming, outgoing, busy, error } = connections;

    const handleRequest = async () => {
        const target = teamIdDraft.trim();
        if (!target) return;
        if (target === myTeamId) {
            setLocalError(strings.errorSelf);
            return;
        }
        setLocalError(null);
        const ok = await connections.request(target);
        if (ok) setTeamIdDraft("");
    };

    // Which side OWNS the shared work — the only asymmetry in a connection
    // that changes what you can do. Who asked to connect is on the row's
    // note line below, where a piece of history belongs; it was a chip
    // once, and two chips saying different things about the same
    // relationship read as one contradicting the other.
    //
    // Nothing at all on our own rows: absence of the chip is what says the
    // shared work is ours, and a "Guest" counter-chip would label the
    // majority of rows to distinguish the minority.
    const ownerChip = (connection: TeamConnection): React.ReactNode =>
        connection.isOwner ? (
            <Tooltip size="sm" title={strings.ownerTeamHint} variant="outlined">
                <Chip
                    color="primary"
                    size="sm"
                    sx={{ borderRadius: "6px", fontSize: "0.65rem", flexShrink: 0 }}
                    variant="soft"
                >
                    {strings.ownerTeam}
                </Chip>
            </Tooltip>
        ) : null;

    const row = (
        connection: TeamConnection,
        actions: React.ReactNode,
        note?: string
    ): React.ReactNode => (
        <Stack
            key={connection.connectionId}
            alignItems="center"
            direction="row"
            spacing={1}
            sx={{
                px: 1.5,
                py: 1,
                borderRadius: "8px",
                border: `1px solid ${borderColor}`,
                flexWrap: "wrap",
                rowGap: 0.5,
            }}
        >
            <GroupsRoundedIcon sx={{ fontSize: 18, color: labelColor, flexShrink: 0 }} />
            <Box sx={{ minWidth: 0, flex: 1 }}>
                <Stack alignItems="center" direction="row" spacing={0.75} sx={{ minWidth: 0 }}>
                    <Typography level="body-sm" sx={{ color: valueColor, fontWeight: 600 }} noWrap>
                        {connection.teamName}
                    </Typography>
                    {ownerChip(connection)}
                </Stack>
                {note && (
                    <Typography level="body-xs" sx={{ color: labelColor }}>
                        {note}
                    </Typography>
                )}
            </Box>
            {actions}
        </Stack>
    );

    return (
        <>
            <FormControl sx={{ mt: 1 }}>
                <FormLabel
                    sx={{
                        color: labelColor,
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        mb: 0.5,
                    }}
                >
                    {strings.title}
                </FormLabel>
                <Typography level="body-xs" sx={{ color: labelColor, mb: 1 }}>
                    {strings.explainer}
                </Typography>
            </FormControl>

            <Stack spacing={1}>
                {/* Incoming first: it is the only bucket with a decision
                    in it, and burying it under the established list is
                    how requests go unanswered for a week. */}
                {incoming.map((c) =>
                    row(
                        c,
                        canManage ? (
                            <Stack direction="row" spacing={0.5}>
                                <Tooltip size="sm" title={strings.approve} variant="outlined">
                                    <IconButton
                                        color="success"
                                        disabled={busy}
                                        size="sm"
                                        variant="soft"
                                        onClick={() =>
                                            void connections.respond(c.connectionId, true)
                                        }
                                    >
                                        <CheckRoundedIcon sx={{ fontSize: 18 }} />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip size="sm" title={strings.decline} variant="outlined">
                                    <IconButton
                                        color="neutral"
                                        disabled={busy}
                                        size="sm"
                                        variant="soft"
                                        onClick={() =>
                                            void connections.respond(c.connectionId, false)
                                        }
                                    >
                                        <CloseRoundedIcon sx={{ fontSize: 18 }} />
                                    </IconButton>
                                </Tooltip>
                            </Stack>
                        ) : (
                            <Chip color="warning" size="sm" variant="soft">
                                {strings.statusPending}
                            </Chip>
                        ),
                        strings.incomingNote
                    )
                )}

                {outgoing.map((c) =>
                    row(
                        c,
                        <Chip color="neutral" size="sm" variant="soft">
                            {strings.statusAwaiting}
                        </Chip>,
                        strings.outgoingNote
                    )
                )}

                {active.map((c) =>
                    row(
                        c,
                        <Stack alignItems="center" direction="row" spacing={0.5}>
                            <Chip
                                color="success"
                                size="sm"
                                startDecorator={<HubRoundedIcon sx={{ fontSize: 14 }} />}
                                variant="soft"
                            >
                                {strings.statusConnected}
                            </Chip>
                            {canManage && (
                                <Tooltip size="sm" title={strings.disconnect} variant="outlined">
                                    <IconButton
                                        color="danger"
                                        disabled={busy}
                                        size="sm"
                                        variant="plain"
                                        onClick={() => setPendingRevoke(c)}
                                    >
                                        <LinkOffRoundedIcon sx={{ fontSize: 18 }} />
                                    </IconButton>
                                </Tooltip>
                            )}
                        </Stack>,
                        c.direction === "outgoing"
                            ? strings.activeInvitedByUs
                            : strings.activeInvitedByThem
                    )
                )}

                {!connections.loading &&
                    active.length === 0 &&
                    incoming.length === 0 &&
                    outgoing.length === 0 && (
                        <Typography level="body-xs" sx={{ color: labelColor, py: 1 }}>
                            {strings.empty}
                        </Typography>
                    )}
            </Stack>

            {canManage && (
                <Stack
                    alignItems={{ xs: "stretch", sm: "center" }}
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    sx={{ mt: 1.5 }}
                >
                    <Input
                        placeholder={strings.teamIdPlaceholder}
                        size="sm"
                        sx={{ flex: 1, "--Input-radius": "8px", fontFamily: "monospace" }}
                        value={teamIdDraft}
                        // Enter is pinned to the inner <input> through
                        // slotProps rather than Joy's outer wrapper, which
                        // can miss events that bubble through composed
                        // slots — the same fix the rename field uses.
                        slotProps={{
                            input: {
                                onKeyDown: (e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        void handleRequest();
                                    }
                                },
                            },
                        }}
                        onChange={(e) => {
                            setTeamIdDraft(e.target.value);
                            setLocalError(null);
                        }}
                    />
                    <Button
                        disabled={busy || !teamIdDraft.trim()}
                        size="sm"
                        startDecorator={<HubRoundedIcon sx={{ fontSize: 16 }} />}
                        sx={{ borderRadius: "8px", fontWeight: 600 }}
                        variant="solid"
                        onClick={() => void handleRequest()}
                    >
                        {strings.connectButton}
                    </Button>
                </Stack>
            )}

            {(localError || error) && (
                <Typography color="danger" level="body-xs" sx={{ mt: 0.5 }}>
                    {localError ?? error}
                </Typography>
            )}

            {/* What a disconnect actually cost. Shown after the fact
                because the count isn't knowable until the server has
                deleted the rows. */}
            {withdrawnNotice !== null && (
                <Typography level="body-xs" sx={{ color: labelColor, mt: 0.5 }}>
                    {fmt(strings.withdrawnNotice, { count: withdrawnNotice })}
                </Typography>
            )}

            <ModalLeaveConfirm
                confirmLabel={strings.disconnect}
                description={strings.disconnectDescription}
                entityName={pendingRevoke?.teamName ?? ""}
                open={pendingRevoke !== null}
                title={strings.disconnectTitle}
                onCancel={() => setPendingRevoke(null)}
                onConfirm={async () => {
                    if (!pendingRevoke) return false;
                    const withdrawn = await connections.revoke(pendingRevoke.connectionId);
                    setPendingRevoke(null);
                    if (withdrawn === null) return false;
                    setWithdrawnNotice(withdrawn);
                    return true;
                }}
            />
        </>
    );
};
