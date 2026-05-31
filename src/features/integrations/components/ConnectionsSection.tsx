import { useCallback, useEffect, useMemo, useState } from "react";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import GitHubIcon from "@mui/icons-material/GitHub";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { Alert, Box, Button, Card, Chip, CircularProgress, Stack, Typography } from "@mui/joy";

import { AppTooltip } from "../../../components/ui/AppTooltip";
import {
    Connection,
    ConnectionsResponse,
    disconnectProvider,
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
    const [disconnecting, setDisconnecting] = useState<"google" | "github" | null>(null);
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

    const connected = useMemo(() => {
        const m: Partial<Record<"google" | "github", Connection>> = {};
        for (const c of data?.connections || []) m[c.provider] = c;
        return m;
    }, [data]);

    const handleDisconnect = async (provider: "google" | "github") => {
        setError(null);
        setDisconnecting(provider);
        const ok = await disconnectProvider(accessToken, provider, setError);
        setDisconnecting(null);
        if (ok) void reload();
    };

    const Row = ({
        provider,
        label,
        icon,
    }: {
        provider: "google" | "github";
        label: string;
        icon: React.ReactNode;
    }) => {
        const c = connected[provider];
        const isPrimary = c?.is_primary === true;
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
                        {c ? (
                            <Typography level="body-sm" sx={{ color: "text.secondary" }}>
                                {c.provider_email || "(no email shared)"}
                            </Typography>
                        ) : (
                            <Typography level="body-sm" sx={{ color: "text.secondary" }}>
                                Not connected
                            </Typography>
                        )}
                    </Box>
                    {/* A Google account that came in via sign-in only
                        has openid/email/profile scopes — no calendar
                        access. Surface that explicitly with a Grant
                        button that re-runs the OAuth flow under the
                        connect intent (broader scopes). The callback
                        upgrades scopes on the existing row. */}
                    {c && provider === "google" && !hasCalendarScope(c) && (
                        <Button
                            color="primary"
                            variant="solid"
                            onClick={() => {
                                void redirectToOAuthConnect(
                                    provider,
                                    accessToken,
                                    undefined,
                                    setError
                                );
                            }}
                        >
                            Grant Calendar access
                        </Button>
                    )}
                    {c ? (
                        <AppTooltip
                            placement="left"
                            title={
                                isPrimary
                                    ? "You can't disconnect the provider you signed up with."
                                    : ""
                            }
                        >
                            <span>
                                <Button
                                    color="danger"
                                    disabled={isPrimary || disconnecting === provider}
                                    variant="outlined"
                                    onClick={() => handleDisconnect(provider)}
                                >
                                    {disconnecting === provider ? "Disconnecting…" : "Disconnect"}
                                </Button>
                            </span>
                        </AppTooltip>
                    ) : (
                        <Button
                            onClick={() => {
                                void redirectToOAuthConnect(
                                    provider,
                                    accessToken,
                                    undefined,
                                    setError
                                );
                            }}
                        >
                            Connect
                        </Button>
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

            <Row
                icon={<CalendarMonthRoundedIcon fontSize="inherit" sx={{ color: "#4285f4" }} />}
                label="Google"
                provider="google"
            />
            <Row icon={<GitHubIcon fontSize="inherit" />} label="GitHub" provider="github" />
        </Stack>
    );
};
