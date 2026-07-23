import { useCallback, useEffect, useMemo, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import CallMergeRoundedIcon from "@mui/icons-material/CallMergeRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import HubRoundedIcon from "@mui/icons-material/HubRounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import VideoCameraFrontRoundedIcon from "@mui/icons-material/VideoCameraFrontRounded";
import {
    Alert,
    Box,
    Button,
    Card,
    Chip,
    CircularProgress,
    FormControl,
    FormLabel,
    IconButton,
    Input,
    Sheet,
    Stack,
    Tab,
    TabList,
    TabPanel,
    Tabs,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { CalendarEventModal } from "./components/CalendarEventModal";
import { ConnectionsSection } from "./components/ConnectionsSection";
import { GithubRepoAccessSection } from "./components/GithubRepoAccessSection";
import { ReconnectGoogleCalendarButton } from "./components/ReconnectGoogleCalendarButton";
import { CalendarEvent, deleteEvent, listEvents } from "./services/calendar";
import {
    ConnectionsResponse,
    findGoogleConnection,
    hasCalendarScope,
    listConnections,
} from "./services/connections";
import { GithubPullSummary, listMyPulls } from "./services/github";
import { redirectToOAuthConnect } from "./services/oauth";

import { AppTooltip } from "../../components/ui/AppTooltip";
import { useAuth } from "../../context/AuthContext";

type TabKey = "connections" | "calendar" | "github";

interface ModalInitial {
    add_meet?: boolean;
    all_day?: boolean;
    attendees?: Array<{ email: string; displayName?: string }>;
    calendar_id?: string;
    description?: string;
    end?: string;
    start?: string;
    summary?: string;
}

const eventStartLabel = (e: CalendarEvent): string => {
    const v = e.start?.dateTime || e.start?.date || "";
    if (!v) return "";
    const d = new Date(v);
    if (isNaN(d.getTime())) return v;
    return d.toLocaleString();
};

const CalendarTab = ({
    accessToken,
    googleConnected,
    calendarAuthorized,
}: {
    accessToken: string;
    googleConnected: boolean;
    /** True only when the connected Google account has the
     *  calendar.events scope. False means a sign-in-only user who
     *  still needs to grant Calendar access. */
    calendarAuthorized: boolean;
}) => {
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    // Set when a live calendar call returns `google_reauth_required`:
    // the account row still looks connected + scoped (so the prop-based
    // gates below pass), but its refresh token is dead. Drives the
    // reconnect prompt.
    const [needsReconnect, setNeedsReconnect] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [modalInitial, setModalInitial] = useState<ModalInitial | undefined>(undefined);
    const [editingEventId, setEditingEventId] = useState<string | undefined>(undefined);

    const refresh = useCallback(async () => {
        if (!googleConnected || !calendarAuthorized) {
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        const now = new Date();
        const inThirtyDays = new Date(now);
        inThirtyDays.setDate(now.getDate() + 30);
        const res = await listEvents(
            accessToken,
            { from: now.toISOString(), to: inThirtyDays.toISOString() },
            setError
        );
        setLoading(false);
        // A dead refresh token gets its own prompt (reconnect), distinct
        // from connect / grant-scope, since the account still looks
        // connected to the prop-based gates. Clear the generic error so
        // we don't double up with the reconnect Alert.
        if (res === "google_reauth_required") {
            setError(null);
            setNeedsReconnect(true);
            return;
        }
        setNeedsReconnect(false);
        // Any other non-object return is a clean domain error (already
        // surfaced through `setError`); leave the events list as it
        // was and let the surrounding UI render the appropriate
        // prompt (connect, grant scope, etc.).
        if (!res || typeof res === "string") return;
        setEvents(res.items || []);
    }, [accessToken, googleConnected, calendarAuthorized]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const openCreate = () => {
        const now = new Date();
        const oneHour = new Date(now);
        oneHour.setHours(now.getHours() + 1);
        setEditingEventId(undefined);
        setModalInitial({
            end: oneHour.toISOString(),
            start: now.toISOString(),
        });
        setModalOpen(true);
    };

    const openEdit = (event: CalendarEvent) => {
        setEditingEventId(event.id);
        // All-day events carry `start.date`/`end.date` (no `dateTime`) —
        // pass the date strings + flag so the modal opens in all-day mode.
        const isAllDay = !!event.start?.date && !event.start?.dateTime;
        setModalInitial({
            add_meet: !!event.hangoutLink,
            all_day: isAllDay,
            // Pre-populate the attendee picker (drop `self` entries
            // so we don't try to re-invite the organizer / current
            // user). External attendees without a team-member match
            // still render — the picker handles bare emails.
            attendees: (event.attendees ?? [])
                .filter((a) => !a.self && !!a.email)
                .map((a) => ({ email: a.email, displayName: a.displayName })),
            description: event.description,
            end: isAllDay ? event.end?.date : event.end?.dateTime,
            start: isAllDay ? event.start?.date : event.start?.dateTime,
            summary: event.summary,
        });
        setModalOpen(true);
    };

    const handleDelete = async (event: CalendarEvent) => {
        if (!confirm(`Delete event "${event.summary || event.id}"?`)) return;
        const ok = await deleteEvent(accessToken, event.id, {}, setError);
        if (ok) void refresh();
    };

    if (!googleConnected) {
        return (
            <Stack spacing={2}>
                <Alert color="primary">
                    Connect Google to read and manage your calendar events here.
                </Alert>
                <Button
                    startDecorator={<LinkRoundedIcon />}
                    sx={{ alignSelf: "flex-start" }}
                    onClick={() => {
                        void redirectToOAuthConnect("google", accessToken, undefined, setError);
                    }}
                >
                    Connect Google
                </Button>
            </Stack>
        );
    }

    // Connected but no calendar.events scope. This is the
    // sign-in-via-Google case — the token only carries openid /
    // email / profile. The user has to go through the OAuth flow
    // one more time under the connect intent (broader scopes).
    if (!calendarAuthorized) {
        return (
            <Stack spacing={2}>
                <Alert color="warning">
                    Calendar access hasn't been granted yet. Grant it to read and manage events
                    here. The chat header's Quick Meet, the task auto-sync, and the Calendar tab
                    all need this permission.
                </Alert>
                <Button
                    startDecorator={<LinkRoundedIcon />}
                    sx={{ alignSelf: "flex-start" }}
                    onClick={() => {
                        void redirectToOAuthConnect("google", accessToken, undefined, setError);
                    }}
                >
                    Grant Calendar access
                </Button>
            </Stack>
        );
    }

    // Connected + scoped on paper, but Google rejected the stored
    // refresh token (revoked or expired — commonly a "Testing"-mode
    // OAuth app, whose refresh tokens lapse after ~7 days). One click
    // through the connect flow mints a fresh token and repairs it.
    if (needsReconnect) {
        return (
            <Stack spacing={2}>
                <Alert color="warning">
                    Your Google Calendar connection has expired — the stored authorization was
                    revoked or timed out. Reconnect to restore Quick Meet, task auto-sync, and the
                    Calendar tab.
                </Alert>
                <ReconnectGoogleCalendarButton accessToken={accessToken} onError={setError} />
                {error && <Alert color="danger">{error}</Alert>}
            </Stack>
        );
    }

    return (
        <Stack spacing={2}>
            <Stack alignItems="center" direction="row" justifyContent="space-between">
                <Typography level="title-md">Upcoming events</Typography>
                <Button startDecorator={<AddRoundedIcon />} onClick={openCreate}>
                    New event
                </Button>
            </Stack>

            {error && <Alert color="danger">{error}</Alert>}

            {loading ? (
                <Stack alignItems="center" sx={{ py: 4 }}>
                    <CircularProgress />
                </Stack>
            ) : events.length === 0 ? (
                <Sheet sx={{ p: 3, borderRadius: "md", textAlign: "center" }} variant="outlined">
                    <Typography level="body-sm" sx={{ color: "text.secondary" }}>
                        No events in the next 30 days. Click "New event" to create one.
                    </Typography>
                </Sheet>
            ) : (
                <Stack spacing={1}>
                    {events.map((e) => (
                        <Card key={e.id} sx={{ p: 1.5 }} variant="outlined">
                            <Stack alignItems="center" direction="row" spacing={1.5}>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography level="title-sm">
                                        {e.summary || "(no title)"}
                                    </Typography>
                                    <Typography level="body-xs" sx={{ color: "text.secondary" }}>
                                        {eventStartLabel(e)}
                                    </Typography>
                                </Box>
                                {e.hangoutLink && (
                                    <AppTooltip size="sm" title="Join Google Meet">
                                        <IconButton
                                            aria-label="Join Google Meet"
                                            color="success"
                                            component="a"
                                            href={e.hangoutLink}
                                            rel="noreferrer"
                                            size="sm"
                                            target="_blank"
                                            variant="plain"
                                        >
                                            <VideoCameraFrontRoundedIcon />
                                        </IconButton>
                                    </AppTooltip>
                                )}
                                <IconButton
                                    aria-label="Edit"
                                    size="sm"
                                    variant="plain"
                                    onClick={() => openEdit(e)}
                                >
                                    <EditRoundedIcon />
                                </IconButton>
                                <IconButton
                                    aria-label="Delete"
                                    color="danger"
                                    size="sm"
                                    variant="plain"
                                    onClick={() => handleDelete(e)}
                                >
                                    <DeleteOutlineRoundedIcon />
                                </IconButton>
                                {e.htmlLink && (
                                    <IconButton
                                        aria-label="Open in Google Calendar"
                                        component="a"
                                        href={e.htmlLink}
                                        rel="noreferrer"
                                        size="sm"
                                        target="_blank"
                                        variant="plain"
                                    >
                                        <OpenInNewRoundedIcon />
                                    </IconButton>
                                )}
                            </Stack>
                        </Card>
                    ))}
                </Stack>
            )}

            <CalendarEventModal
                accessToken={accessToken}
                editingEventId={editingEventId}
                initial={modalInitial}
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                onError={setError}
                onSaved={() => {
                    void refresh();
                }}
            />
        </Stack>
    );
};

// Drives the auto-status-sync feature: when a PR merges on GitHub,
// GitHub POSTs to our webhook URL and Genos transitions any task that
// has the PR in its Links list → "Closed".
//
// Default path is **automatic**: pasting a PR URL into a task's Links
// triggers backend webhook registration on that repo using the saving
// user's stored GitHub OAuth token (the `repo` scope already granted
// via "Connect GitHub"). The manual section is only relevant when the
// user lacks repo-admin and an org admin needs to wire it up by hand.
//
// We deliberately do NOT expose `GITHUB_WEBHOOK_SECRET` over the API
// — the operator who sets it in env vars already knows the value.
const WebhookSetup = () => {
    const djangoUrl =
        (import.meta.env.VITE_DJANGO_URL as string | undefined) ||
        window.location.origin.replace(/\/+$/, "");
    const webhookUrl = `${djangoUrl.replace(/\/+$/, "")}/api/v2/github/webhook/`;

    const [copied, setCopied] = useState(false);
    const [showManual, setShowManual] = useState(false);
    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(webhookUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            /* clipboard blocked in dev / iframe — silent. */
        }
    };

    return (
        <Card sx={{ p: 2 }} variant="outlined">
            <Stack spacing={1.5}>
                <Stack alignItems="center" direction="row" spacing={1}>
                    <BoltRoundedIcon sx={{ color: "primary.500" }} />
                    <Typography level="title-sm">
                        Auto-close tasks when their PR is merged
                    </Typography>
                </Stack>

                <Alert color="success" startDecorator={<CheckRoundedIcon />}>
                    <Box>
                        <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                            No setup needed
                        </Typography>
                        <Typography level="body-xs" sx={{ color: "text.secondary" }}>
                            Paste any GitHub PR URL into a task's Links and Genos registers our
                            webhook on that repo for you, using your connected GitHub account. When
                            the PR merges, the task auto-transitions to <strong>Closed</strong>.
                        </Typography>
                    </Box>
                </Alert>

                <Box>
                    <Button
                        color="neutral"
                        size="sm"
                        sx={{ pl: 0 }}
                        variant="plain"
                        onClick={() => setShowManual((v) => !v)}
                    >
                        {showManual ? "Hide" : "Show"} manual setup
                        {showManual ? "" : " (only needed if you lack repo admin)"}
                    </Button>
                </Box>

                {showManual && (
                    <>
                        <Typography level="body-xs" sx={{ color: "text.secondary" }}>
                            If auto-registration didn&apos;t happen (typically because your GitHub
                            user lacks admin on that repo), a repo admin can paste the URL below
                            into the repo&apos;s webhook settings manually.
                        </Typography>

                        <FormControl>
                            <FormLabel>Webhook URL</FormLabel>
                            <Input
                                size="sm"
                                value={webhookUrl}
                                endDecorator={
                                    <AppTooltip size="sm" title={copied ? "Copied" : "Copy"}>
                                        <IconButton
                                            aria-label="Copy webhook URL"
                                            size="sm"
                                            variant="plain"
                                            onClick={handleCopy}
                                        >
                                            {copied ? (
                                                <CheckRoundedIcon fontSize="small" />
                                            ) : (
                                                <ContentCopyRoundedIcon fontSize="small" />
                                            )}
                                        </IconButton>
                                    </AppTooltip>
                                }
                                sx={{
                                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                                }}
                                readOnly
                            />
                        </FormControl>

                        <Sheet sx={{ p: 1.5, borderRadius: "md" }} variant="soft">
                            <Typography
                                level="body-xs"
                                sx={{ fontWeight: 600, mb: 0.5, color: "text.primary" }}
                            >
                                Manual steps (one-time per repo)
                            </Typography>
                            <Stack component="ol" spacing={0.25} sx={{ pl: 2.5, my: 0 }}>
                                <li>
                                    <Typography level="body-xs">
                                        On the GitHub repo:{" "}
                                        <strong>Settings → Webhooks → Add webhook</strong>.
                                    </Typography>
                                </li>
                                <li>
                                    <Typography level="body-xs">
                                        Payload URL: paste the URL above. Content type:{" "}
                                        <code>application/json</code>.
                                    </Typography>
                                </li>
                                <li>
                                    <Typography level="body-xs">
                                        Secret: paste the same value the operator set in the
                                        backend env var <code>GITHUB_WEBHOOK_SECRET</code>.
                                    </Typography>
                                </li>
                                <li>
                                    <Typography level="body-xs">
                                        Events: select{" "}
                                        <strong>
                                            &quot;Let me select individual events&quot;
                                        </strong>{" "}
                                        → check only <strong>Pull requests</strong>. Save.
                                    </Typography>
                                </li>
                            </Stack>
                        </Sheet>
                    </>
                )}
            </Stack>
        </Card>
    );
};

const GithubTab = ({
    accessToken,
    githubConnected,
}: {
    accessToken: string;
    githubConnected: boolean;
}) => {
    const [pulls, setPulls] = useState<GithubPullSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!githubConnected) {
            setLoading(false);
            return;
        }
        let cancelled = false;
        const run = async () => {
            setLoading(true);
            setError(null);
            const res = await listMyPulls(accessToken, { state: "open" }, setError);
            if (cancelled) return;
            setLoading(false);
            if (res === "github_not_connected" || res === null) return;
            setPulls(res.pulls || []);
        };
        void run();
        return () => {
            cancelled = true;
        };
    }, [accessToken, githubConnected]);

    if (!githubConnected) {
        return (
            <Stack spacing={2}>
                <Alert color="primary">Connect GitHub to see your pull requests here.</Alert>
                <Button
                    startDecorator={<LinkRoundedIcon />}
                    sx={{ alignSelf: "flex-start" }}
                    onClick={() => {
                        void redirectToOAuthConnect("github", accessToken, undefined, setError);
                    }}
                >
                    Connect GitHub
                </Button>
            </Stack>
        );
    }

    return (
        <Stack spacing={2}>
            <Stack alignItems="center" direction="row" justifyContent="space-between">
                <Typography level="title-md">Your open pull requests</Typography>
            </Stack>
            {error && <Alert color="danger">{error}</Alert>}
            {loading ? (
                <Stack alignItems="center" sx={{ py: 4 }}>
                    <CircularProgress />
                </Stack>
            ) : pulls.length === 0 ? (
                <Sheet sx={{ p: 3, borderRadius: "md", textAlign: "center" }} variant="outlined">
                    <Typography level="body-sm" sx={{ color: "text.secondary" }}>
                        No open pull requests authored by you.
                    </Typography>
                </Sheet>
            ) : (
                <Stack spacing={1}>
                    {pulls.map((pr) => (
                        <Card key={`${pr.repo}-${pr.number}`} sx={{ p: 1.5 }} variant="outlined">
                            <Stack alignItems="center" direction="row" spacing={1.5}>
                                <CallMergeRoundedIcon
                                    sx={{
                                        color: pr.draft
                                            ? "text.secondary"
                                            : pr.state === "open"
                                              ? "success.500"
                                              : "neutral.500",
                                    }}
                                />
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography level="title-sm">{pr.title}</Typography>
                                    <Typography level="body-xs" sx={{ color: "text.secondary" }}>
                                        {pr.repo} #{pr.number} · updated{" "}
                                        {new Date(pr.updated_at).toLocaleDateString()}
                                    </Typography>
                                </Box>
                                {pr.draft && <Chip size="sm">Draft</Chip>}
                                <IconButton
                                    aria-label="Open on GitHub"
                                    component="a"
                                    href={pr.html_url}
                                    rel="noreferrer"
                                    size="sm"
                                    target="_blank"
                                    variant="plain"
                                >
                                    <OpenInNewRoundedIcon />
                                </IconButton>
                            </Stack>
                        </Card>
                    ))}
                </Stack>
            )}

            <GithubRepoAccessSection accessToken={accessToken} />

            <WebhookSetup />
        </Stack>
    );
};

export const IntegrationsHome = () => {
    const { accessToken } = useAuth();
    const [tab, setTab] = useState<TabKey>("connections");
    const [data, setData] = useState<ConnectionsResponse | null>(null);
    const [loadingConnections, setLoadingConnections] = useState(true);

    const reload = useCallback(async () => {
        if (!accessToken) return;
        setLoadingConnections(true);
        const res = await listConnections(accessToken);
        setLoadingConnections(false);
        if (res) setData(res);
    }, [accessToken]);

    useEffect(() => {
        void reload();
    }, [reload]);

    const googleConnection = findGoogleConnection(data);
    const googleConnected = !!googleConnection;
    const googleCalendarAuthorized = hasCalendarScope(googleConnection);
    const githubConnected = !!data?.connections.find((c) => c.provider === "github");
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    if (!accessToken) {
        return (
            <Box sx={{ p: 4 }}>
                <Alert color="danger">Not signed in.</Alert>
            </Box>
        );
    }

    return (
        <Box
            sx={{
                flex: 1,
                minWidth: 0,
                p: { xs: 2, md: 4 },
                overflowY: "auto",
                backgroundColor: isDark ? "rgba(19,19,24,0.4)" : "rgba(255,255,255,0.6)",
                backdropFilter: "blur(8px)",
            }}
        >
            <Box sx={{ maxWidth: 800, mx: "auto" }}>
                <Stack alignItems="center" direction="row" spacing={1.5} sx={{ mb: 3 }}>
                    <HubRoundedIcon sx={{ fontSize: 32 }} />
                    <Typography level="h2" sx={{ fontWeight: 700 }}>
                        Integrations
                    </Typography>
                </Stack>

                <Tabs
                    sx={{ bgcolor: "transparent" }}
                    value={tab}
                    onChange={(_e, v) => v && setTab(v as TabKey)}
                >
                    <TabList sx={{ mb: 2 }}>
                        <Tab value="connections">Connections</Tab>
                        <Tab value="calendar">Calendar</Tab>
                        <Tab value="github">GitHub</Tab>
                    </TabList>

                    <TabPanel sx={{ px: 0 }} value="connections">
                        {/* Same component renders in Settings →
                            Integrations. The page-level fetch above
                            still populates `data` for the
                            CalendarTab / GithubTab gates below; the
                            section just does its own fetch — cheap
                            and lets either surface render alone. */}
                        <ConnectionsSection accessToken={accessToken} />
                    </TabPanel>

                    <TabPanel sx={{ px: 0 }} value="calendar">
                        <CalendarTab
                            accessToken={accessToken}
                            calendarAuthorized={googleCalendarAuthorized}
                            googleConnected={googleConnected}
                        />
                    </TabPanel>

                    <TabPanel sx={{ px: 0 }} value="github">
                        <GithubTab accessToken={accessToken} githubConnected={githubConnected} />
                    </TabPanel>
                </Tabs>
            </Box>
        </Box>
    );
};
