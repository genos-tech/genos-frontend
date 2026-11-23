import { useCallback, useEffect, useMemo, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import GitHubIcon from "@mui/icons-material/GitHub";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import { Alert, Box, Button, Card, Chip, Stack, Typography } from "@mui/joy";

import { visuallyHidden } from "../../../components/ui/a11y/visuallyHidden";
import { AppTooltip } from "../../../components/ui/AppTooltip";
import { DataState } from "../../../components/ui/feedback/DataState";
import { SkeletonRows } from "../../../components/ui/feedback/Skeleton";
import { ConfirmDialog } from "../../../components/ui/modal/ConfirmDialog";
import { fmt, useTranslation } from "../../../i18n";
import { g } from "../../../theme/tokens";
import {
    Connection,
    ConnectionsResponse,
    disconnectAccount,
    githubAppBlock,
    hasCalendarScope,
    listConnections,
} from "../services/connections";
import { redirectToOAuthConnect } from "../services/oauth";

interface ConnectionsSectionProps {
    accessToken: string;
}

/**
 * Self-contained Connections panel.
 *
 * Used in two places: the `/workspace/integrations` page (full-page
 * surface with sub-tabs for Calendar/GitHub features) AND the
 * Settings → Integrations tab (settings-style modal embed).
 * Owning its own fetch/reload state means both surfaces stay in
 * sync without prop-drilling and either can be reached without
 * the other being mounted.
 */
export const ConnectionsSection = ({ accessToken }: ConnectionsSectionProps) => {
    const { t } = useTranslation();
    const [data, setData] = useState<ConnectionsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    // Keyed by ACCOUNT id, not provider: a user can hold several
    // Google accounts and only the one being removed should show a
    // pending state.
    const [disconnecting, setDisconnecting] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    // The LOAD failed (MIP-1276). Not `error`: that one also carries a failed
    // disconnect, which must not hide accounts we did load. With nothing loaded
    // the panel must not draw "Connect Google / Connect GitHub" as if the user
    // had no accounts.
    const [loadFailed, setLoadFailed] = useState(false);
    // The account waiting on a yes. Disconnecting deletes the stored tokens and
    // coming back is a full OAuth round trip, so it asks first (MIP-1301).
    const [pendingDisconnect, setPendingDisconnect] = useState<Connection | null>(null);

    const reload = useCallback(async () => {
        if (!accessToken) return;
        setLoading(true);
        setLoadFailed(false);
        const res = await listConnections(accessToken);
        setLoading(false);
        if (res) setData(res);
        else setLoadFailed(true);
    }, [accessToken]);

    useEffect(() => {
        void reload();
    }, [reload]);

    // Google is multi-account (work + personal), so it's a LIST.
    // The previous shape — one Connection per provider — silently
    // dropped every account after the first.
    const googleAccounts = useMemo(
        () => (data?.connections || []).filter((c) => c.provider === "google"),
        [data]
    );
    // The GitHub App block exists only while the server's GITHUB_APP_ENABLED switch is on
    // (MIP-2090). Without it, every branch below is the OAuth-era card, unchanged.
    const app = githubAppBlock(data);
    const githubAppAccount = useMemo(
        () => (data?.connections || []).find((c) => c.provider === "github_app"),
        [data]
    );
    // The sign-in / legacy OAuth row. It can sit next to an App row (the migration window), so
    // the two are never merged into one.
    const githubLegacyAccount = useMemo(
        () => (data?.connections || []).find((c) => c.provider === "github"),
        [data]
    );
    const githubAccount = app ? (githubAppAccount ?? githubLegacyAccount) : githubLegacyAccount;

    const handleDisconnect = async (accountId: string): Promise<boolean> => {
        setError(null);
        setDisconnecting(accountId);
        const ok = await disconnectAccount(accessToken, accountId, setError);
        setDisconnecting(null);
        if (ok) void reload();
        return ok;
    };

    const startConnect = (provider: "google" | "github") => {
        void redirectToOAuthConnect(provider, accessToken, undefined, setError);
    };

    /** What a GitHub row adds when the App is on (MIP-2090): a line of state under the account
     *  and the one button that goes through the same `Connect GitHub` call (the server decides
     *  between GitHub's install page and its authorize page). */
    interface GithubRowExtras {
        subline: React.ReactNode;
        /** Replaces the plain "Connect" button, or sits beside "Disconnect". */
        action?: { label: string; disabled: boolean; hint: string };
    }

    /** One connected account, or an empty "Connect" affordance when
     *  `connection` is undefined. */
    const AccountRow = ({
        connection,
        provider,
        label,
        icon,
        extras,
    }: {
        connection?: Connection;
        provider: "google" | "github";
        label: string;
        icon: React.ReactNode;
        extras?: GithubRowExtras;
    }) => {
        const isPrimary = connection?.is_primary === true;
        return (
            <Card sx={{ p: 2 }} variant="outlined">
                <Stack
                    alignItems="center"
                    direction="row"
                    // With a state line the row may need two lines on a phone: the buttons drop
                    // below the text instead of crushing it. `gap` (not Stack `spacing`, which is a
                    // left margin and would indent the wrapped button). Rows without a state
                    // line are unchanged.
                    spacing={extras ? 0 : 2}
                    sx={extras ? { flexWrap: "wrap", gap: 2 } : undefined}
                >
                    <Box sx={{ fontSize: 32, display: "flex" }}>{icon}</Box>
                    <Box sx={{ flex: 1, minWidth: extras ? { xs: "60%", sm: 0 } : 0 }}>
                        <Stack alignItems="center" direction="row" spacing={1}>
                            <Typography level="title-md">{label}</Typography>
                            {isPrimary && (
                                <Chip color="primary" size="sm">
                                    {t.integrations.connections.primaryLogin}
                                </Chip>
                            )}
                        </Stack>
                        <Typography level="body-sm" sx={{ color: "text.secondary" }} noWrap>
                            {connection
                                ? connection.provider_email ||
                                  t.integrations.connections.noEmailShared
                                : t.integrations.connections.notConnected}
                        </Typography>
                        {extras?.subline}
                    </Box>
                    {extras?.action && (
                        <AppTooltip placement="left" title={extras.action.hint}>
                            <span>
                                <Button
                                    color="primary"
                                    disabled={extras.action.disabled}
                                    variant={connection ? "soft" : "solid"}
                                    onClick={() => startConnect(provider)}
                                >
                                    {extras.action.label}
                                </Button>
                            </span>
                        </AppTooltip>
                    )}
                    {/* A Google account that came in via sign-in only
                        has openid/email/profile scopes — no calendar
                        access. Surface that explicitly with a Grant
                        button that re-runs the OAuth flow under the
                        connect intent (broader scopes). The callback
                        upgrades scopes on the existing row. */}
                    {connection && provider === "google" && !hasCalendarScope(connection) && (
                        <Button
                            color="primary"
                            variant="solid"
                            onClick={() => startConnect(provider)}
                        >
                            {t.integrations.connections.grantCalendarAccess}
                        </Button>
                    )}
                    {connection ? (
                        <AppTooltip
                            placement="left"
                            title={
                                isPrimary ? t.integrations.connections.primaryDisconnectHint : ""
                            }
                        >
                            <span>
                                <Button
                                    color="danger"
                                    disabled={isPrimary || disconnecting === connection.id}
                                    variant="outlined"
                                    onClick={() => setPendingDisconnect(connection)}
                                >
                                    {disconnecting === connection.id
                                        ? t.integrations.connections.disconnecting
                                        : t.integrations.connections.disconnect}
                                </Button>
                            </span>
                        </AppTooltip>
                    ) : (
                        !extras?.action && (
                            <Button onClick={() => startConnect(provider)}>
                                {t.integrations.connections.connect}
                            </Button>
                        )
                    )}
                </Stack>
            </Card>
        );
    };

    // The GitHub rows. App off (no block from the server): one row, exactly as before. App on:
    // the person's App row (or the legacy one, or none) with the state of THIS team's
    // installation under it, and the legacy row after it while one still exists.
    const ga = t.integrations.connections.githubApp;
    const installations = app?.installations ?? [];
    // `team_id` null = the server could not tell the team (none stored, several teams): leave the
    // button enabled and let the server answer, rather than lock out a person who may link.
    const cannotLink = !!app && app.team_id !== null && !app.can_link;
    const linkAction = (label: string) => ({
        label,
        disabled: cannotLink,
        hint: cannotLink ? ga.cannotLink : "",
    });
    const installationLines = (
        <Stack spacing={0.5} sx={{ mt: 0.5 }}>
            {installations.map((inst) => (
                <Stack
                    key={inst.installation_id}
                    alignItems="center"
                    direction="row"
                    sx={{ flexWrap: "wrap", columnGap: 1, rowGap: 0.25 }}
                >
                    <Typography level="body-xs" sx={{ fontWeight: 600 }}>
                        {inst.account_login}
                    </Typography>
                    {inst.suspended && (
                        <Chip color="warning" size="sm" variant="soft">
                            {ga.suspended}
                        </Chip>
                    )}
                    <Typography
                        component="a"
                        endDecorator={<OpenInNewRoundedIcon sx={{ fontSize: 14 }} />}
                        href={inst.manage_url}
                        level="body-xs"
                        rel="noreferrer"
                        target="_blank"
                        sx={{
                            color: g.link.default,
                            textDecoration: "underline",
                            minHeight: 24,
                            display: "inline-flex",
                            alignItems: "center",
                        }}
                    >
                        {ga.manageOnGithub}
                        {/* Several installations give several identical links: name the account,
                            and say it opens a new tab, for a screen reader. The visible text stays
                            the start of the accessible name. */}
                        <Box component="span" sx={visuallyHidden}>
                            {" "}
                            {fmt(ga.manageOnGithubHint, { account: inst.account_login })}
                        </Box>
                    </Typography>
                </Stack>
            ))}
        </Stack>
    );
    const accountsList = installations.map((i) => i.account_login).join(", ");
    const subline = (text: string | null, withLines: boolean, withHint = false) => (
        <Box sx={{ mt: 0.25 }}>
            {text && (
                <Typography level="body-xs" sx={{ color: "text.secondary" }}>
                    {text}
                </Typography>
            )}
            {withLines && installationLines}
            {/* Visible, not only a tooltip on a disabled button (which a keyboard never reaches). */}
            {withHint && cannotLink && (
                <Typography level="body-xs" sx={{ color: "text.secondary", mt: 0.5 }}>
                    {ga.cannotLink}
                </Typography>
            )}
        </Box>
    );
    let githubExtras: GithubRowExtras | undefined;
    if (app) {
        if (githubAppAccount) {
            githubExtras =
                installations.length > 0
                    ? { subline: subline(ga.connectedApp, true) }
                    : {
                          subline: subline(ga.notInstalled, false, true),
                          action: linkAction(ga.install),
                      };
        } else if (installations.length > 0) {
            githubExtras = {
                subline: subline(fmt(ga.needsAuthorize, { accounts: accountsList }), true, true),
                action: linkAction(ga.authorize),
            };
        } else if (githubLegacyAccount) {
            githubExtras = {
                subline: subline(ga.legacyHint, false, true),
                action: linkAction(ga.reconnect),
            };
        } else if (cannotLink) {
            // Nothing connected, nothing installed, and this person may not link one: the same
            // disabled Connect as every other state, with the reason in plain text.
            githubExtras = { subline: subline(null, false, true), action: linkAction(ga.install) };
        }
    }
    // The old OAuth row next to the App's: say which one it is, since both read "GitHub".
    const legacyExtras: GithubRowExtras = { subline: subline(ga.legacyRowNote, false) };

    const dc = t.integrations.connections.disconnectDialog;
    const pendingIsGithubApp = pendingDisconnect?.provider === "github_app";
    const pendingIsGithub = pendingDisconnect?.provider === "github" || pendingIsGithubApp;
    const pendingTitle = fmt(dc.title, {
        provider: pendingIsGithub
            ? t.integrations.providers.github
            : t.integrations.providers.google,
    });
    const pendingBody = pendingIsGithubApp
        ? dc.bodyGithubApp
        : pendingIsGithub
          ? dc.bodyGithub
          : dc.bodyGoogle;
    const pendingAccount =
        pendingDisconnect?.provider_email || t.integrations.connections.noEmailShared;

    return (
        <DataState
            error={loadFailed}
            hasData={data !== null}
            loading={loading}
            size="sm"
            skeleton={<SkeletonRows count={3} twoLines />}
            errorState={{
                title: t.integrations.connections.loadFailed,
                onRetry: () => void reload(),
                "data-error": "connections",
            }}
        >
            <Stack spacing={2}>
                {error && <Alert color="danger">{error}</Alert>}
                {pendingDisconnect && (
                    <ConfirmDialog
                        cancelLabel={t.common.actions.cancel}
                        confirmLabel={t.integrations.connections.disconnect}
                        description={pendingBody}
                        entityName={pendingAccount}
                        title={pendingTitle}
                        closeOnConfirm
                        destructive
                        open
                        onClose={() => setPendingDisconnect(null)}
                        onConfirm={async () => {
                            // A refusal stays in the dialog with a message; closing it would
                            // leave the reason only in the page's alert, behind the overlay.
                            if (!(await handleDisconnect(pendingDisconnect.id))) {
                                throw new Error(t.integrations.errors.disconnectFailed);
                            }
                        }}
                    />
                )}

                {/* User-facing notice: while our OAuth app is still in
                Google's verification queue, only whitelisted Gmail
                addresses can grant Google access. Anyone else hits
                "Error 403: access_denied" on the consent screen.
                Surfacing the support email lets users self-serve
                instead of getting stuck mid-flow. */}
                <Alert
                    color="neutral"
                    startDecorator={<InfoOutlinedIcon />}
                    sx={{ alignItems: "flex-start" }}
                    variant="soft"
                >
                    <Box>
                        <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                            {t.integrations.connections.verificationTitle}
                        </Typography>
                        <Typography level="body-xs" sx={{ color: "text.secondary", mt: 0.25 }}>
                            {t.integrations.connections.verificationBeforeError}{" "}
                            <Typography
                                component="span"
                                sx={{ fontFamily: "monospace", fontWeight: 600 }}
                            >
                                {t.integrations.connections.verificationError}
                            </Typography>{" "}
                            {t.integrations.connections.verificationAfterError}{" "}
                            <Typography
                                component="a"
                                href="mailto:genos.support@genosai.dev?subject=Add%20me%20as%20Google%20test%20user"
                                sx={{ color: g.link.default, textDecoration: "underline" }}
                            >
                                genos.support@genosai.dev
                            </Typography>{" "}
                            {t.integrations.connections.verificationEnding}
                        </Typography>
                    </Box>
                </Alert>

                {googleAccounts.length === 0 ? (
                    <AccountRow
                        label={t.integrations.providers.google}
                        provider="google"
                        icon={
                            <CalendarMonthRoundedIcon
                                fontSize="inherit"
                                sx={{ color: "#4285f4" }}
                            />
                        }
                    />
                ) : (
                    <>
                        {googleAccounts.map((c) => (
                            <AccountRow
                                key={c.id}
                                connection={c}
                                label={t.integrations.providers.google}
                                provider="google"
                                icon={
                                    <CalendarMonthRoundedIcon
                                        fontSize="inherit"
                                        sx={{ color: "#4285f4" }}
                                    />
                                }
                            />
                        ))}
                        {/* Connecting a second Google account is the whole
                        point of the multi-account calendar — work and
                        personal side by side. The consent screen opens
                        on Google's account chooser so the user picks a
                        DIFFERENT account than the one they're signed
                        into. */}
                        <Button
                            startDecorator={<AddRoundedIcon />}
                            sx={{ alignSelf: "flex-start" }}
                            variant="outlined"
                            onClick={() => startConnect("google")}
                        >
                            {t.integrations.connections.addGoogleAccount}
                        </Button>
                    </>
                )}
                <AccountRow
                    connection={githubAccount}
                    extras={githubExtras}
                    icon={<GitHubIcon fontSize="inherit" />}
                    label={t.integrations.providers.github}
                    provider="github"
                />
                {/* The old OAuth row while it still exists next to the App's (the 30-day
                    migration window): it holds the broad `repo` grant, so it keeps its own
                    Disconnect instead of hiding behind the App row. */}
                {app && githubAppAccount && githubLegacyAccount && (
                    <AccountRow
                        connection={githubLegacyAccount}
                        extras={legacyExtras}
                        icon={<GitHubIcon fontSize="inherit" />}
                        label={t.integrations.providers.github}
                        provider="github"
                    />
                )}
            </Stack>
        </DataState>
    );
};
