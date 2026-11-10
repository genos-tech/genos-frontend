import { useCallback, useEffect, useState } from "react";
import LinkOffRoundedIcon from "@mui/icons-material/LinkOffRounded";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import { Box, Chip, IconButton, Sheet, Stack, Typography } from "@mui/joy";

import { useAuth } from "../../context/AuthContext";
import { fmt, useTranslation } from "../../i18n";
import {
    endTeamMcpConnection,
    listTeamMcpConnections,
    TeamMcpConnection,
} from "../../services/teamIntegrations";
import { g } from "../../theme/tokens";
import { AppTooltip } from "../ui/AppTooltip";
import { EmptyState } from "../ui/feedback/EmptyState";
import { ConfirmDialog } from "../ui/modal/ConfirmDialog";

/**
 * The AI apps (Claude, ChatGPT…) that members connected and that can work in this team
 * (MIP-1371). Owners and editors see every one; the owner can end any, an editor a viewer's or
 * their own. Ending removes only THIS team from the app: the person's other teams keep
 * working, and an app left with no team ends. Hidden (not shown empty) for everyone else, who
 * get a 404: an empty list would read as a fact about the team rather than about their access.
 */
export const TeamConnectedAppsSection = ({ teamId }: { teamId: string }) => {
    const { t } = useTranslation();
    const { accessToken } = useAuth();
    const a = t.settings.developer.teamApps;
    const [rows, setRows] = useState<TeamMcpConnection[] | null>(null);
    const [pending, setPending] = useState<TeamMcpConnection | null>(null);

    const refresh = useCallback(async () => {
        setRows(await listTeamMcpConnections(accessToken, teamId));
    }, [accessToken, teamId]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    if (rows == null) return null;

    const appName = (c: TeamMcpConnection) => c.client.name || t.settings.connectedApps.unnamed;
    const person = (c: TeamMcpConnection) => c.userName || c.userEmail;

    return (
        <Stack spacing={1.5} data-testid="team-connected-apps">
            <Stack direction="row" spacing={1} alignItems="center">
                <SmartToyOutlinedIcon sx={{ fontSize: 18 }} />
                <Typography level="title-md">{a.title}</Typography>
            </Stack>
            <Typography level="body-sm" sx={{ opacity: 0.75 }}>
                {a.blurb}
            </Typography>
            {rows.length === 0 && <EmptyState body={a.empty} data-empty="team-apps" size="xs" />}
            {rows.map((c) => (
                <Sheet
                    key={c.id}
                    data-testid={`team-app-${c.id}`}
                    variant="soft"
                    sx={{ borderRadius: 8, p: 1.25, minWidth: 0 }}
                >
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography level="title-sm" noWrap>
                                {appName(c)}
                            </Typography>
                            <Typography level="body-xs" sx={{ opacity: 0.7 }} noWrap>
                                {fmt(a.connectedBy, { name: person(c) })}
                            </Typography>
                            <Typography level="body-xs" sx={{ opacity: 0.7 }} noWrap>
                                {c.lastUsedAt
                                    ? fmt(t.settings.connectedApps.lastUsed, {
                                          date: new Date(c.lastUsedAt).toLocaleDateString(),
                                      })
                                    : t.settings.connectedApps.neverUsed}
                                {c.otherTeams > 0 && (
                                    <>
                                        {" · "}
                                        {fmt(a.otherTeams, { count: c.otherTeams })}
                                    </>
                                )}
                            </Typography>
                        </Box>
                        {c.allowDestructive && (
                            <Chip color="danger" size="sm" variant="soft">
                                {t.settings.connectedApps.canDelete}
                            </Chip>
                        )}
                        <Chip size="sm" variant="soft">
                            {c.scope === "write"
                                ? t.settings.connectedApps.scopeWrite
                                : t.settings.connectedApps.scopeRead}
                        </Chip>
                        {c.revocable && (
                            <AppTooltip title={a.end}>
                                <IconButton
                                    aria-label={fmt(a.endNamed, {
                                        app: appName(c),
                                        name: person(c),
                                    })}
                                    color="danger"
                                    size="sm"
                                    sx={{ color: g.danger.text }}
                                    variant="plain"
                                    onClick={() => setPending(c)}
                                >
                                    <LinkOffRoundedIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                            </AppTooltip>
                        )}
                    </Stack>
                </Sheet>
            ))}
            <ConfirmDialog
                open={pending != null}
                cancelLabel={a.cancel}
                closeOnConfirm
                confirmLabel={a.confirm}
                destructive
                title={
                    pending
                        ? fmt(a.confirmTitle, { app: appName(pending), name: person(pending) })
                        : ""
                }
                description={
                    pending
                        ? fmt(a.confirmBody, { app: appName(pending), name: person(pending) })
                        : undefined
                }
                onClose={() => setPending(null)}
                onConfirm={async () => {
                    if (!pending) return;
                    await endTeamMcpConnection(accessToken, teamId, pending.id);
                    await refresh();
                }}
            />
        </Stack>
    );
};
