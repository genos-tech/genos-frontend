import { useCallback, useEffect, useMemo, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import GitHubIcon from "@mui/icons-material/GitHub";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { Alert, Box, Button, Card, Chip, CircularProgress, Stack, Typography } from "@mui/joy";

import { AppTooltip } from "../../../components/ui/AppTooltip";
import {
    Connection,
    ConnectionsResponse,
    disconnectAccount,
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
    const [data, setData] = useState<ConnectionsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    // Keyed by ACCOUNT id, not provider: a user can hold several
    // Google accounts and only the one being removed should show a
    // pending state.
    const [disconnecting, setDisconnecting] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const reload = useCallback(async () => {
        if (!accessToken) return;
        setLoading(true);
        const res = await listConnections(accessToken, setError);
        setLoading(false);
        if (res) setData(res);
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
    const githubAccount = useMemo(
        () => (data?.connections || []).find((c) => c.provider === "github"),
        [data]
    );

    const handleDisconnect = async (accountId: string) => {
        setError(null);
        setDisconnecting(accountId);
        const ok = await disconnectAccount(accessToken, accountId, setError);
        setDisconnecting(null);
        if (ok) void reload();
    };

    const startConnect = (provider: "google" | "github") => {
        void redirectToOAuthConnect(provider, accessToken, undefined, setError);
    };

    /** One connected account, or an empty "Connect" affordance when
     *  `connection` is undefined. */
    const AccountRow = ({
        connection,
        provider,
        label,
        icon,
    }: {
        connection?: Connection;
        provider: "google" | "github";
        label: string;
        icon: React.ReactNode;
    }) => {
        const isPrimary = connection?.is_primary === true;
        return (
            <Card sx={{ p: 2 }} variant="outlined">
                <Stack alignItems="center" direction="row" spacing={2}>
                    <Box sx={{ fontSize: 32, display: "flex" }}>{icon}</Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack alignItems="center" direction="row" spacing={1}>
                            <Typography level="title-md">{label}</Typography>
                            {isPrimary && (
                                <Chip color="primary" size="sm">
                                    Primary login
                                </Chip>
                            )}
                        </Stack>
                        <Typography level="body-sm" sx={{ color: "text.secondary" }} noWrap>
                            {connection
                                ? connection.provider_email || "(no email shared)"
                                : "Not connected"}
                        </Typography>
                    </Box>
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
                            Grant Calendar access
                        </Button>
                    )}
                    {connection ? (
                        <AppTooltip
                            placement="left"
                            title={
                                isPrimary
                                    ? "You can't disconnect the account you signed up with."
                                    : ""
                            }
                        >
                            <span>
                                <Button
                                    color="danger"
                                    disabled={isPrimary || disconnecting === connection.id}
                                    variant="outlined"
                                    onClick={() => handleDisconnect(connection.id)}
                                >
                                    {disconnecting === connection.id
                                        ? "Disconnecting…"
                                        : "Disconnect"}
                                </Button>
                            </span>
                        </AppTooltip>
                    ) : (
                        <Button onClick={() => startConnect(provider)}>Connect</Button>
                    )}
                </Stack>
            </Card>
        );
    };

    if (loading && !data) {
        return (
            <Stack alignItems="center" sx={{ py: 4 }}>
                <CircularProgress />
            </Stack>
        );
    }

    return (
        <Stack spacing={2}>
            {error && <Alert color="danger">{error}</Alert>}

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
                        First time connecting Google?
                    </Typography>
                    <Typography level="body-xs" sx={{ color: "text.secondary", mt: 0.25 }}>
                        Our Google integration is still going through Google&apos;s verification
                        process. If you see{" "}
                        <Typography
                            component="span"
                            sx={{ fontFamily: "monospace", fontWeight: 600 }}
                        >
                            Error 403: access_denied
                        </Typography>{" "}
                        when granting access, please email{" "}
                        <Typography
                            component="a"
                            href="mailto:genos.support@genosai.dev?subject=Add%20me%20as%20Google%20test%20user"
                            sx={{ color: "primary.500", textDecoration: "underline" }}
                        >
                            genos.support@genosai.dev
                        </Typography>{" "}
                        with your Gmail address — we&apos;ll add you as a test user. Access works
                        within a minute of confirmation.
                    </Typography>
                </Box>
            </Alert>

            {googleAccounts.length === 0 ? (
                <AccountRow
                    icon={
                        <CalendarMonthRoundedIcon fontSize="inherit" sx={{ color: "#4285f4" }} />
                    }
                    label="Google"
                    provider="google"
                />
            ) : (
                <>
                    {googleAccounts.map((c) => (
                        <AccountRow
                            key={c.id}
                            connection={c}
                            icon={
                                <CalendarMonthRoundedIcon
                                    fontSize="inherit"
                                    sx={{ color: "#4285f4" }}
                                />
                            }
                            label="Google"
                            provider="google"
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
                        Add another Google account
                    </Button>
                </>
            )}
            <AccountRow
                connection={githubAccount}
                icon={<GitHubIcon fontSize="inherit" />}
                label="GitHub"
                provider="github"
            />
        </Stack>
    );
};
