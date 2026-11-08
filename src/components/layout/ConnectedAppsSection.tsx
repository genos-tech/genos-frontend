import { useCallback, useEffect, useState } from "react";
import ExtensionRoundedIcon from "@mui/icons-material/ExtensionRounded";
import { Alert, Box, Button, Checkbox, Chip, Radio, Sheet, Stack, Typography } from "@mui/joy";

import { useAuth } from "../../context/AuthContext";
import {
    addableTeams,
    addTeam,
    chooseScopes,
    removeTeam,
    scopeChoiceOf,
} from "../../features/admin/consent/connectionEdit";
import { clientAddress } from "../../features/admin/consent/consentLogic";
import { fmt, useTranslation } from "../../i18n";
import {
    listMcpConnections,
    McpConnection,
    revokeMcpConnection,
    updateMcpConnection,
} from "../../services/mcpConnections";
import { EmptyState } from "../ui/feedback/EmptyState";

/**
 * Settings → Developer → Connected apps (MIP-1079): the AI apps this member has
 * allowed to use Genos as them, over MCP. Each can be narrowed (read or write,
 * deleting, which of its teams, which one is the default) or revoked, which
 * ends every token it holds at once: its next request fails.
 *
 * Adding a team is not here: that is a new decision, so it goes through the
 * app's own connect flow again. Revoking asks first, in the page, because a
 * browser confirm dialog is not available inside every host this runs in.
 */
export const ConnectedAppsSection = () => {
    const { t, locale } = useTranslation();
    const { accessToken } = useAuth();
    const a = t.settings.connectedApps;

    const [connections, setConnections] = useState<McpConnection[] | null>(null);
    const [loadFailed, setLoadFailed] = useState(false);
    const [availableTeams, setAvailableTeams] = useState<{ id: string; name: string }[]>([]);
    const [editing, setEditing] = useState<string | null>(null);
    const [confirming, setConfirming] = useState<string | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        const list = await listMcpConnections(accessToken);
        if (list === null) {
            setLoadFailed(true);
            return;
        }
        setLoadFailed(false);
        setConnections(list.connections);
        setAvailableTeams(list.availableTeams);
    }, [accessToken]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const replace = (next: McpConnection) =>
        setConnections((cur) => (cur ?? []).map((c) => (c.id === next.id ? next : c)));

    const revoke = async (id: string) => {
        setBusy(id);
        setError(null);
        const res = await revokeMcpConnection(accessToken, id);
        setBusy(null);
        if (!res.ok && !res.gone) {
            setError(a.revokeFailed);
            return;
        }
        // Gone already (revoked elsewhere): the list was stale, and the card goes either way.
        setConfirming(null);
        setConnections((cur) => (cur ?? []).filter((c) => c.id !== id));
        if (!res.ok) void refresh();
    };

    const save = async (
        conn: McpConnection,
        change: Parameters<typeof updateMcpConnection>[2]
    ) => {
        setBusy(conn.id);
        setError(null);
        const res = await updateMcpConnection(accessToken, conn.id, change);
        setBusy(null);
        if (!res.ok) {
            if (res.gone) {
                // Revoked elsewhere: say so and show the real list.
                setError(a.gone);
                setEditing(null);
                await refresh();
            } else {
                setError(a.saveFailed);
            }
            return;
        }
        replace(res.connection);
    };

    return (
        <Stack spacing={1.5}>
            <Stack alignItems="center" direction="row" spacing={1}>
                <ExtensionRoundedIcon sx={{ fontSize: 18 }} />
                <Typography level="title-md">{a.title}</Typography>
            </Stack>
            <Typography level="body-sm" sx={{ opacity: 0.75 }}>
                {a.blurb}
            </Typography>

            {loadFailed && (
                <Alert color="danger" size="sm">
                    {a.loadFailed}
                </Alert>
            )}
            {error && (
                <Alert color="danger" role="alert" size="sm">
                    {error}
                </Alert>
            )}
            {connections?.length === 0 && (
                <EmptyState body={a.empty} data-empty="connected-apps" size="xs" />
            )}

            {(connections ?? []).map((c) => {
                const choice = scopeChoiceOf(c);
                const teamNames = c.teams.map((x) => x.name).join(", ");
                const defaultName = c.teams.find((x) => x.id === c.defaultTeamId)?.name;
                return (
                    <Sheet
                        key={c.id}
                        data-testid="connected-app"
                        sx={{ borderRadius: 8, p: 1.25, minWidth: 0 }}
                        variant="soft"
                    >
                        <Stack spacing={1} sx={{ minWidth: 0 }}>
                            <Stack
                                alignItems="center"
                                direction="row"
                                spacing={1}
                                sx={{ minWidth: 0, flexWrap: "wrap" }}
                                useFlexGap
                            >
                                <Box sx={{ minWidth: 0, flex: 1 }}>
                                    <Typography level="title-sm" sx={{ wordBreak: "break-word" }}>
                                        {c.client.name || c.client.host || a.unnamed}
                                    </Typography>
                                    {clientAddress(c.client) && (
                                        <Typography
                                            level="body-xs"
                                            sx={{ opacity: 0.7, overflowWrap: "anywhere" }}
                                        >
                                            {clientAddress(c.client)}
                                        </Typography>
                                    )}
                                </Box>
                                {choice.destructive && (
                                    <Chip color="danger" size="sm" variant="soft">
                                        {a.canDelete}
                                    </Chip>
                                )}
                                <Chip size="sm" variant="soft">
                                    {choice.write ? a.scopeWrite : a.scopeRead}
                                </Chip>
                            </Stack>
                            <Typography
                                level="body-xs"
                                sx={{ opacity: 0.8, wordBreak: "break-word" }}
                            >
                                {fmt(a.teams, { teams: teamNames || "—" })}
                                {defaultName && c.teams.length > 1
                                    ? ` · ${fmt(a.defaultTeam, { team: defaultName })}`
                                    : ""}
                            </Typography>
                            <Typography level="body-xs" sx={{ opacity: 0.6 }}>
                                {c.lastUsedAt
                                    ? fmt(a.lastUsed, {
                                          date: new Date(c.lastUsedAt).toLocaleDateString(locale),
                                      })
                                    : a.neverUsed}
                            </Typography>

                            {editing === c.id && (
                                <Stack spacing={1} sx={{ pt: 0.5 }}>
                                    <Checkbox label={a.readLabel} size="sm" checked disabled />
                                    <Checkbox
                                        checked={choice.write}
                                        disabled={busy === c.id}
                                        label={a.writeLabel}
                                        size="sm"
                                        onChange={(e) =>
                                            void save(c, {
                                                scopes: chooseScopes({
                                                    write: e.target.checked,
                                                    destructive: choice.destructive,
                                                }),
                                            })
                                        }
                                    />
                                    <Checkbox
                                        checked={choice.destructive}
                                        color="danger"
                                        disabled={!choice.write || busy === c.id}
                                        label={a.deleteLabel}
                                        size="sm"
                                        sx={{ ml: 3 }}
                                        onChange={(e) =>
                                            void save(c, {
                                                scopes: chooseScopes({
                                                    write: choice.write,
                                                    destructive: e.target.checked,
                                                }),
                                            })
                                        }
                                    />
                                    {c.teams.map((team) => (
                                        <Stack
                                            key={team.id}
                                            alignItems="center"
                                            direction="row"
                                            spacing={1}
                                            sx={{ minWidth: 0 }}
                                        >
                                            <Typography
                                                level="body-sm"
                                                sx={{
                                                    flex: 1,
                                                    minWidth: 0,
                                                    wordBreak: "break-word",
                                                }}
                                            >
                                                {team.name}
                                            </Typography>
                                            <Radio
                                                checked={c.defaultTeamId === team.id}
                                                disabled={busy === c.id}
                                                label={a.defaultLabel}
                                                name={`default-${c.id}`}
                                                size="sm"
                                                slotProps={{
                                                    input: {
                                                        "aria-label": fmt(a.defaultFor, {
                                                            team: team.name,
                                                        }),
                                                    },
                                                }}
                                                onChange={() =>
                                                    void save(c, { defaultTeamId: team.id })
                                                }
                                            />
                                            <Button
                                                color="neutral"
                                                disabled={busy === c.id || !removeTeam(c, team.id)}
                                                size="sm"
                                                variant="plain"
                                                aria-label={fmt(a.removeTeamNamed, {
                                                    team: team.name,
                                                })}
                                                onClick={() => {
                                                    const next = removeTeam(c, team.id);
                                                    if (next) void save(c, next);
                                                }}
                                            >
                                                {a.removeTeam}
                                            </Button>
                                        </Stack>
                                    ))}
                                    {addableTeams(c, availableTeams).length > 0 && (
                                        <Stack spacing={0.75} sx={{ pt: 0.5 }}>
                                            <Typography level="body-xs" sx={{ opacity: 0.75 }}>
                                                {a.addTeamHint}
                                            </Typography>
                                            {addableTeams(c, availableTeams).map((team) => (
                                                <Checkbox
                                                    key={team.id}
                                                    checked={false}
                                                    disabled={busy === c.id}
                                                    label={team.name}
                                                    size="sm"
                                                    sx={{ wordBreak: "break-word" }}
                                                    slotProps={{
                                                        input: {
                                                            "aria-label": fmt(a.addTeamNamed, {
                                                                team: team.name,
                                                            }),
                                                        },
                                                    }}
                                                    onChange={() => {
                                                        const next = addTeam(c, team.id);
                                                        if (next) void save(c, next);
                                                    }}
                                                />
                                            ))}
                                        </Stack>
                                    )}
                                </Stack>
                            )}

                            {confirming === c.id ? (
                                <Alert
                                    color="danger"
                                    role="alertdialog"
                                    variant="soft"
                                    sx={{
                                        alignItems: "flex-start",
                                        flexDirection: "column",
                                        gap: 1,
                                    }}
                                >
                                    <Typography level="body-sm">
                                        {fmt(a.revokeConfirm, {
                                            name: c.client.name || c.client.host || a.unnamed,
                                        })}
                                    </Typography>
                                    <Stack direction="row" spacing={1}>
                                        <Button
                                            color="danger"
                                            loading={busy === c.id}
                                            size="sm"
                                            onClick={() => void revoke(c.id)}
                                        >
                                            {a.revokeYes}
                                        </Button>
                                        <Button
                                            color="neutral"
                                            disabled={busy === c.id}
                                            size="sm"
                                            variant="outlined"
                                            onClick={() => setConfirming(null)}
                                        >
                                            {a.cancel}
                                        </Button>
                                    </Stack>
                                </Alert>
                            ) : (
                                <Stack direction="row" spacing={1}>
                                    <Button
                                        color="neutral"
                                        size="sm"
                                        variant="outlined"
                                        onClick={() => setEditing(editing === c.id ? null : c.id)}
                                    >
                                        {editing === c.id ? a.done : a.change}
                                    </Button>
                                    <Button
                                        color="danger"
                                        size="sm"
                                        variant="outlined"
                                        onClick={() => setConfirming(c.id)}
                                    >
                                        {a.revoke}
                                    </Button>
                                </Stack>
                            )}
                        </Stack>
                    </Sheet>
                );
            })}
        </Stack>
    );
};
