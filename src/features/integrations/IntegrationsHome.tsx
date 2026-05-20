import { useCallback, useEffect, useMemo, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import CallMergeRoundedIcon from "@mui/icons-material/CallMergeRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import GitHubIcon from "@mui/icons-material/GitHub";
import HubRoundedIcon from "@mui/icons-material/HubRounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
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
    Modal,
    ModalDialog,
    Sheet,
    Stack,
    Tab,
    TabList,
    TabPanel,
    Tabs,
    Textarea,
    Tooltip,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import {
    CalendarEvent,
    createEvent,
    deleteEvent,
    listEvents,
    updateEvent,
} from "./services/calendar";
import {
    Connection,
    ConnectionsResponse,
    disconnectProvider,
    listConnections,
} from "./services/connections";
import { GithubPullSummary, listMyPulls } from "./services/github";
import { redirectToOAuthConnect } from "./services/oauth";

import { useAuth } from "../../context/AuthContext";

type TabKey = "connections" | "calendar" | "github";

interface EventForm {
    summary: string;
    startISO: string;
    endISO: string;
    description: string;
}

const emptyForm = (): EventForm => ({
    summary: "",
    startISO: "",
    endISO: "",
    description: "",
});

const toLocalInputValue = (iso: string | undefined): string => {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const fromLocalInputValue = (value: string): string => new Date(value).toISOString();

const eventStartLabel = (e: CalendarEvent): string => {
    const v = e.start?.dateTime || e.start?.date || "";
    if (!v) return "";
    const d = new Date(v);
    if (isNaN(d.getTime())) return v;
    return d.toLocaleString();
};

const ConnectionsTab = ({
    data,
    reload,
    accessToken,
}: {
    data: ConnectionsResponse | null;
    reload: () => void;
    accessToken: string;
}) => {
    const [disconnecting, setDisconnecting] = useState<"google" | "github" | null>(null);
    const [error, setError] = useState<string | null>(null);
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
        if (ok) reload();
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
            <Card variant="outlined" sx={{ p: 2 }}>
                <Stack direction="row" alignItems="center" spacing={2}>
                    <Box sx={{ fontSize: 32, display: "flex" }}>{icon}</Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                            <Typography level="title-md">{label}</Typography>
                            {isPrimary && (
                                <Chip size="sm" color="primary">
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
                    {c ? (
                        <Tooltip
                            title={
                                isPrimary
                                    ? "You can't disconnect the provider you signed up with."
                                    : ""
                            }
                            placement="left"
                        >
                            <span>
                                <Button
                                    variant="outlined"
                                    color="danger"
                                    disabled={isPrimary || disconnecting === provider}
                                    onClick={() => handleDisconnect(provider)}
                                >
                                    {disconnecting === provider ? "Disconnecting…" : "Disconnect"}
                                </Button>
                            </span>
                        </Tooltip>
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

    return (
        <Stack spacing={2}>
            {error && <Alert color="danger">{error}</Alert>}
            <Row
                provider="google"
                label="Google"
                icon={<CalendarMonthRoundedIcon sx={{ color: "#4285f4" }} fontSize="inherit" />}
            />
            <Row provider="github" label="GitHub" icon={<GitHubIcon fontSize="inherit" />} />
        </Stack>
    );
};

const CalendarTab = ({
    accessToken,
    googleConnected,
}: {
    accessToken: string;
    googleConnected: boolean;
}) => {
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editing, setEditing] = useState<CalendarEvent | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState<EventForm>(emptyForm());
    const [submitting, setSubmitting] = useState(false);

    const refresh = useCallback(async () => {
        if (!googleConnected) {
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
        if (res === "google_not_connected" || res === null) return;
        setEvents(res.items || []);
    }, [accessToken, googleConnected]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const openCreate = () => {
        const now = new Date();
        const oneHour = new Date(now);
        oneHour.setHours(now.getHours() + 1);
        setEditing(null);
        setForm({
            summary: "",
            startISO: toLocalInputValue(now.toISOString()),
            endISO: toLocalInputValue(oneHour.toISOString()),
            description: "",
        });
        setShowForm(true);
    };

    const openEdit = (event: CalendarEvent) => {
        setEditing(event);
        setForm({
            summary: event.summary || "",
            startISO: toLocalInputValue(event.start?.dateTime),
            endISO: toLocalInputValue(event.end?.dateTime),
            description: event.description || "",
        });
        setShowForm(true);
    };

    const submitForm = async () => {
        if (!form.summary || !form.startISO || !form.endISO) {
            setError("Title, start, and end are required.");
            return;
        }
        setSubmitting(true);
        const payload = {
            summary: form.summary,
            description: form.description || undefined,
            start: { dateTime: fromLocalInputValue(form.startISO) },
            end: { dateTime: fromLocalInputValue(form.endISO) },
        };
        const result = editing
            ? await updateEvent(accessToken, editing.id, payload, setError)
            : await createEvent(accessToken, payload, setError);
        setSubmitting(false);
        if (result) {
            setShowForm(false);
            void refresh();
        }
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
                    onClick={() => {
                        void redirectToOAuthConnect("google", accessToken, undefined, setError);
                    }}
                    startDecorator={<LinkRoundedIcon />}
                    sx={{ alignSelf: "flex-start" }}
                >
                    Connect Google
                </Button>
            </Stack>
        );
    }

    return (
        <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
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
                <Sheet variant="outlined" sx={{ p: 3, borderRadius: "md", textAlign: "center" }}>
                    <Typography level="body-sm" sx={{ color: "text.secondary" }}>
                        No events in the next 30 days. Click "New event" to create one.
                    </Typography>
                </Sheet>
            ) : (
                <Stack spacing={1}>
                    {events.map((e) => (
                        <Card key={e.id} variant="outlined" sx={{ p: 1.5 }}>
                            <Stack direction="row" alignItems="center" spacing={1.5}>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography level="title-sm">
                                        {e.summary || "(no title)"}
                                    </Typography>
                                    <Typography level="body-xs" sx={{ color: "text.secondary" }}>
                                        {eventStartLabel(e)}
                                    </Typography>
                                </Box>
                                <IconButton
                                    size="sm"
                                    variant="plain"
                                    onClick={() => openEdit(e)}
                                    aria-label="Edit"
                                >
                                    <EditRoundedIcon />
                                </IconButton>
                                <IconButton
                                    size="sm"
                                    variant="plain"
                                    color="danger"
                                    onClick={() => handleDelete(e)}
                                    aria-label="Delete"
                                >
                                    <DeleteOutlineRoundedIcon />
                                </IconButton>
                                {e.htmlLink && (
                                    <IconButton
                                        size="sm"
                                        variant="plain"
                                        component="a"
                                        href={e.htmlLink}
                                        target="_blank"
                                        rel="noreferrer"
                                        aria-label="Open in Google Calendar"
                                    >
                                        <OpenInNewRoundedIcon />
                                    </IconButton>
                                )}
                            </Stack>
                        </Card>
                    ))}
                </Stack>
            )}

            <Modal open={showForm} onClose={() => setShowForm(false)}>
                <ModalDialog sx={{ minWidth: 400, p: 3 }}>
                    <Typography level="title-lg" sx={{ mb: 2 }}>
                        {editing ? "Edit event" : "New event"}
                    </Typography>
                    <Stack spacing={2}>
                        <FormControl required>
                            <FormLabel>Title</FormLabel>
                            <Input
                                value={form.summary}
                                onChange={(e) =>
                                    setForm((f) => ({ ...f, summary: e.target.value }))
                                }
                            />
                        </FormControl>
                        <FormControl required>
                            <FormLabel>Start</FormLabel>
                            <Input
                                type="datetime-local"
                                value={form.startISO}
                                onChange={(e) =>
                                    setForm((f) => ({ ...f, startISO: e.target.value }))
                                }
                            />
                        </FormControl>
                        <FormControl required>
                            <FormLabel>End</FormLabel>
                            <Input
                                type="datetime-local"
                                value={form.endISO}
                                onChange={(e) =>
                                    setForm((f) => ({ ...f, endISO: e.target.value }))
                                }
                            />
                        </FormControl>
                        <FormControl>
                            <FormLabel>Description (optional)</FormLabel>
                            <Textarea
                                minRows={2}
                                value={form.description}
                                onChange={(e) =>
                                    setForm((f) => ({ ...f, description: e.target.value }))
                                }
                            />
                        </FormControl>
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Button variant="plain" onClick={() => setShowForm(false)}>
                                Cancel
                            </Button>
                            <Button onClick={submitForm} disabled={submitting}>
                                {submitting ? "Saving…" : editing ? "Save" : "Create"}
                            </Button>
                        </Stack>
                    </Stack>
                </ModalDialog>
            </Modal>
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
        <Card variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1.5}>
                <Stack direction="row" alignItems="center" spacing={1}>
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
                        size="sm"
                        variant="plain"
                        color="neutral"
                        onClick={() => setShowManual((v) => !v)}
                        sx={{ pl: 0 }}
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
                                value={webhookUrl}
                                readOnly
                                size="sm"
                                endDecorator={
                                    <Tooltip title={copied ? "Copied" : "Copy"} size="sm">
                                        <IconButton
                                            size="sm"
                                            variant="plain"
                                            onClick={handleCopy}
                                            aria-label="Copy webhook URL"
                                        >
                                            {copied ? (
                                                <CheckRoundedIcon fontSize="small" />
                                            ) : (
                                                <ContentCopyRoundedIcon fontSize="small" />
                                            )}
                                        </IconButton>
                                    </Tooltip>
                                }
                                sx={{
                                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                                }}
                            />
                        </FormControl>

                        <Sheet variant="soft" sx={{ p: 1.5, borderRadius: "md" }}>
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
                    onClick={() => {
                        void redirectToOAuthConnect("github", accessToken, undefined, setError);
                    }}
                    startDecorator={<LinkRoundedIcon />}
                    sx={{ alignSelf: "flex-start" }}
                >
                    Connect GitHub
                </Button>
            </Stack>
        );
    }

    return (
        <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography level="title-md">Your open pull requests</Typography>
            </Stack>
            {error && <Alert color="danger">{error}</Alert>}
            {loading ? (
                <Stack alignItems="center" sx={{ py: 4 }}>
                    <CircularProgress />
                </Stack>
            ) : pulls.length === 0 ? (
                <Sheet variant="outlined" sx={{ p: 3, borderRadius: "md", textAlign: "center" }}>
                    <Typography level="body-sm" sx={{ color: "text.secondary" }}>
                        No open pull requests authored by you.
                    </Typography>
                </Sheet>
            ) : (
                <Stack spacing={1}>
                    {pulls.map((pr) => (
                        <Card key={`${pr.repo}-${pr.number}`} variant="outlined" sx={{ p: 1.5 }}>
                            <Stack direction="row" alignItems="center" spacing={1.5}>
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
                                    size="sm"
                                    variant="plain"
                                    component="a"
                                    href={pr.html_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    aria-label="Open on GitHub"
                                >
                                    <OpenInNewRoundedIcon />
                                </IconButton>
                            </Stack>
                        </Card>
                    ))}
                </Stack>
            )}

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

    const googleConnected = !!data?.connections.find((c) => c.provider === "google");
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
                <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 3 }}>
                    <HubRoundedIcon sx={{ fontSize: 32 }} />
                    <Typography level="h2" sx={{ fontWeight: 700 }}>
                        Integrations
                    </Typography>
                </Stack>

                <Tabs
                    value={tab}
                    onChange={(_e, v) => v && setTab(v as TabKey)}
                    sx={{ bgcolor: "transparent" }}
                >
                    <TabList sx={{ mb: 2 }}>
                        <Tab value="connections">Connections</Tab>
                        <Tab value="calendar">Calendar</Tab>
                        <Tab value="github">GitHub</Tab>
                    </TabList>

                    <TabPanel value="connections" sx={{ px: 0 }}>
                        {loadingConnections ? (
                            <Stack alignItems="center" sx={{ py: 4 }}>
                                <CircularProgress />
                            </Stack>
                        ) : (
                            <ConnectionsTab
                                data={data}
                                reload={reload}
                                accessToken={accessToken}
                            />
                        )}
                    </TabPanel>

                    <TabPanel value="calendar" sx={{ px: 0 }}>
                        <CalendarTab accessToken={accessToken} googleConnected={googleConnected} />
                    </TabPanel>

                    <TabPanel value="github" sx={{ px: 0 }}>
                        <GithubTab accessToken={accessToken} githubConnected={githubConnected} />
                    </TabPanel>
                </Tabs>
            </Box>
        </Box>
    );
};
