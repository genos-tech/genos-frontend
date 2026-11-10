import { useCallback, useEffect, useState } from "react";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { Box, Chip, IconButton, Stack, Typography } from "@mui/joy";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { ConfirmDialog } from "../../../../components/ui/modal/ConfirmDialog";
import { useAuth } from "../../../../context/AuthContext";
import { fmt, useTranslation } from "../../../../i18n";
import {
    listTeamInvites,
    revokeTeamInvite,
    TeamInviteRow,
} from "../../../../services/teamIntegrations";
import { g } from "../../../../theme/tokens";

/**
 * The invitations still waiting, with a way to cancel one (MIP-1371). Owner and editors only;
 * nothing renders when there are none or the caller may not see them. `refreshKey` is bumped
 * by the host after it sends invites so a new one shows without reopening the modal.
 */
export const PendingInvitesSection = ({
    teamId,
    refreshKey,
    zIndex,
}: {
    teamId: string;
    refreshKey?: number;
    zIndex: number;
}) => {
    const { t } = useTranslation();
    const { accessToken } = useAuth();
    const p = t.admin.teamProfile.pendingInvites;
    const [rows, setRows] = useState<TeamInviteRow[] | null>(null);
    const [pending, setPending] = useState<TeamInviteRow | null>(null);

    const refresh = useCallback(async () => {
        setRows(await listTeamInvites(accessToken, teamId));
    }, [accessToken, teamId]);

    useEffect(() => {
        void refresh();
    }, [refresh, refreshKey]);

    if (!rows || rows.length === 0) return null;

    return (
        <Box data-testid="pending-invites" sx={{ mt: 1.5 }}>
            <Typography level="title-sm" sx={{ mb: 0.5 }}>
                {fmt(p.title, { count: rows.length })}
            </Typography>
            <Stack spacing={0.5}>
                {rows.map((i) => (
                    <Stack
                        key={i.id}
                        alignItems="center"
                        data-testid={`invite-${i.id}`}
                        direction="row"
                        spacing={1}
                        sx={{ minWidth: 0 }}
                    >
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography level="body-sm" noWrap>
                                {i.email}
                            </Typography>
                            <Typography level="body-xs" sx={{ color: g.text.secondary }} noWrap>
                                {fmt(p.detail, {
                                    name: i.invitedBy ?? "—",
                                    date: new Date(i.expiresAt).toLocaleDateString(),
                                })}
                            </Typography>
                        </Box>
                        {i.projectName && (
                            <Chip color="warning" size="sm" variant="soft">
                                {fmt(p.guestOf, { project: i.projectName })}
                            </Chip>
                        )}
                        <AppTooltip title={fmt(p.cancelNamed, { email: i.email })}>
                            <IconButton
                                aria-label={fmt(p.cancelNamed, { email: i.email })}
                                color="neutral"
                                size="sm"
                                variant="plain"
                                onClick={() => setPending(i)}
                            >
                                <CloseRoundedIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                        </AppTooltip>
                    </Stack>
                ))}
            </Stack>
            <ConfirmDialog
                open={pending != null}
                cancelLabel={p.keep}
                closeOnConfirm
                confirmLabel={p.confirm}
                destructive
                hostZIndex={zIndex}
                title={pending ? fmt(p.confirmTitle, { email: pending.email }) : ""}
                description={p.confirmBody}
                onClose={() => setPending(null)}
                onConfirm={async () => {
                    if (!pending) return;
                    await revokeTeamInvite(accessToken, teamId, pending.id);
                    await refresh();
                }}
            />
        </Box>
    );
};
