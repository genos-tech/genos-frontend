import { useCallback, useEffect, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import CallMergeRoundedIcon from "@mui/icons-material/CallMergeRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import HubRoundedIcon from "@mui/icons-material/HubRounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
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
import { useNavigate } from "react-router-dom";

import { CalendarEventModal } from "./components/CalendarEventModal";
import { ConnectionsSection } from "./components/ConnectionsSection";
import { GithubRepoAccessSection } from "./components/GithubRepoAccessSection";
import { ReconnectGoogleCalendarButton } from "./components/ReconnectGoogleCalendarButton";
import { CalendarEvent, deleteEvent, listEventsAggregate } from "./services/calendar";
import {
    ConnectionsResponse,
    findGoogleConnections,
    hasAnyCalendarScope,
    listConnections,
} from "./services/connections";
import { GithubPullSummary, listMyPulls } from "./services/github";
import { redirectToOAuthConnect } from "./services/oauth";

import { AppTooltip } from "../../components/ui/AppTooltip";
import { useAuth } from "../../context/AuthContext";
import { fmt, useTranslation } from "../../i18n";
import { fetchAgentFeatures } from "../../services/agentApi";
import { useCalendarSources } from "../calendar/hooks/useCalendarSources";

type TabKey = "connections" | "calendar" | "github";

interface ModalInitial {
    /** Which connected Google account owns `calendar_id`. Carried from
     *  the event's `_source` so an edit is authenticated against the
     *  account that actually holds the event. */
    account_id?: string;
    /** Master id when the event is one occurrence of a series. */
    recurring_event_id?: string;
    add_meet?: boolean;
    all_day?: boolean;
    attendees?: Array<{ email: string; displayName?: string }>;
    calendar_id?: string;
    description?: string;
    end?: string;
    start?: string;
    summary?: string;
}

const eventStartLabel = (e: CalendarEvent, locale: string): string => {
    const v = e.start?.dateTime || e.start?.date || "";
    if (!v) return "";
    const d = new Date(v);
    if (isNaN(d.getTime())) return v;
    return d.toLocaleString(locale);
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
    const { t, locale } = useTranslation();
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

    // Same source selection the calendar modal uses (it's shared through
    // localStorage), so this list and the grid agree on which calendars
    // the user cares about instead of this surface quietly showing only
    // the default account.
    const sources = useCalendarSources(accessToken, googleConnected && calendarAuthorized);
    const { selectedSources } = sources;

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
        const res = await listEventsAggregate(
            accessToken,
            {
                from: now.toISOString(),
                to: inThirtyDays.toISOString(),
                sources: selectedSources,
            },
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
    }, [accessToken, googleConnected, calendarAuthorized, selectedSources]);

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
            // Event ids are unique per calendar, not globally, so an
            // edit needs both halves of the source or it lands on the
            // wrong account and 404s.
            account_id: event._source?.account_id,
            calendar_id: event._source?.calendar_id,
            recurring_event_id: event.recurringEventId,
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
        if (
            !confirm(
                fmt(t.integrations.calendar.deleteConfirm, {
                    title: event.summary || event.id,
                })
            )
        )
            return;
        const ok = await deleteEvent(
            accessToken,
            event.id,
            {
                ...(event._source?.calendar_id ? { calendarId: event._source.calendar_id } : {}),
                ...(event._source?.account_id ? { accountId: event._source.account_id } : {}),
            },
            setError
        );
        if (ok) void refresh();
    };

    if (!googleConnected) {
        return (
            <Stack spacing={2}>
                <Alert color="primary">{t.integrations.calendar.connectPrompt}</Alert>
                <Button
                    startDecorator={<LinkRoundedIcon />}
                    sx={{ alignSelf: "flex-start" }}
                    onClick={() => {
                        void redirectToOAuthConnect("google", accessToken, undefined, setError);
                    }}
                >
                    {t.integrations.calendar.connectButton}
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
                <Alert color="warning">{t.integrations.calendar.grantPrompt}</Alert>
                <Button
                    startDecorator={<LinkRoundedIcon />}
                    sx={{ alignSelf: "flex-start" }}
                    onClick={() => {
                        void redirectToOAuthConnect("google", accessToken, undefined, setError);
                    }}
                >
                    {t.integrations.calendar.grantButton}
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
                <Alert color="warning">{t.integrations.calendar.reconnectPrompt}</Alert>
                <ReconnectGoogleCalendarButton accessToken={accessToken} onError={setError} />
                {error && <Alert color="danger">{error}</Alert>}
            </Stack>
        );
    }

    return (
        <Stack spacing={2}>
            <Stack alignItems="center" direction="row" justifyContent="space-between">
                <Typography level="title-md">{t.integrations.calendar.upcoming}</Typography>
                <Button startDecorator={<AddRoundedIcon />} onClick={openCreate}>
                    {t.integrations.calendar.newEvent}
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
                        {t.integrations.calendar.empty}
                    </Typography>
                </Sheet>
            ) : (
                <Stack spacing={1}>
                    {events.map((e) => (
                        <Card key={e.id} sx={{ p: 1.5 }} variant="outlined">
                            <Stack alignItems="center" direction="row" spacing={1.5}>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography level="title-sm">
                                        {e.summary || t.integrations.calendar.untitled}
                                    </Typography>
                                    <Typography level="body-xs" sx={{ color: "text.secondary" }}>
                                        {eventStartLabel(e, locale)}
                                    </Typography>
                                </Box>
                                {e.hangoutLink && (
                                    <AppTooltip size="sm" title={t.integrations.calendar.joinMeet}>
                                        <IconButton
                                            aria-label={t.integrations.calendar.joinMeet}
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
                                    aria-label={t.common.actions.edit}
                                    size="sm"
                                    variant="plain"
                                    onClick={() => openEdit(e)}
                                >
                                    <EditRoundedIcon />
                                </IconButton>
                                <IconButton
                                    aria-label={t.common.actions.delete}
                                    color="danger"
                                    size="sm"
                                    variant="plain"
                                    onClick={() => handleDelete(e)}
                                >
                                    <DeleteOutlineRoundedIcon />
                                </IconButton>
                                {e.htmlLink && (
                                    <IconButton
                                        aria-label={t.integrations.calendar.openInCalendar}
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
                calendars={sources.calendars}
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
    const { t } = useTranslation();
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
                    <Typography level="title-sm">{t.integrations.github.webhook.title}</Typography>
                </Stack>

                <Alert color="success" startDecorator={<CheckRoundedIcon />}>
                    <Box>
                        <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                            {t.integrations.github.webhook.noSetupTitle}
                        </Typography>
                        <Typography level="body-xs" sx={{ color: "text.secondary" }}>
                            {t.integrations.github.webhook.noSetupBody}
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
                        {showManual
                            ? t.integrations.github.webhook.hideManual
                            : t.integrations.github.webhook.showManual}
                        {showManual ? "" : t.integrations.github.webhook.showManualHint}
                    </Button>
                </Box>

                {showManual && (
                    <>
                        <Typography level="body-xs" sx={{ color: "text.secondary" }}>
                            {t.integrations.github.webhook.manualIntro}
                        </Typography>

                        <FormControl>
                            <FormLabel>{t.integrations.github.webhook.urlLabel}</FormLabel>
                            <Input
                                size="sm"
                                value={webhookUrl}
                                endDecorator={
                                    <AppTooltip
                                        size="sm"
                                        title={
                                            copied
                                                ? t.common.ui.copy.copied
                                                : t.common.actions.copy
                                        }
                                    >
                                        <IconButton
                                            aria-label={t.integrations.github.webhook.copyUrl}
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
                                {t.integrations.github.webhook.stepsTitle}
                            </Typography>
                            <Stack component="ol" spacing={0.25} sx={{ pl: 2.5, my: 0 }}>
                                <li>
                                    <Typography level="body-xs">
                                        {t.integrations.github.webhook.stepSettings}{" "}
                                        <strong>
                                            {t.integrations.github.webhook.settingsPath}
                                        </strong>
                                        .
                                    </Typography>
                                </li>
                                <li>
                                    <Typography level="body-xs">
                                        {t.integrations.github.webhook.stepPayload}{" "}
                                        <code>
                                            {t.integrations.github.webhook.contentTypeLabel}
                                        </code>
                                        .
                                    </Typography>
                                </li>
                                <li>
                                    <Typography level="body-xs">
                                        {t.integrations.github.webhook.stepSecret}{" "}
                                        <code>{t.integrations.github.webhook.secretEnvLabel}</code>
                                        .
                                    </Typography>
                                </li>
                                <li>
                                    <Typography level="body-xs">
                                        {t.integrations.github.webhook.stepEventsPrefix}{" "}
                                        <strong>
                                            {t.integrations.github.webhook.eventSelectionLabel}
                                        </strong>{" "}
                                        {t.integrations.github.webhook.stepEventsSuffix}{" "}
                                        <strong>
                                            {t.integrations.github.webhook.pullRequestsLabel}
                                        </strong>
                                        . {t.integrations.github.webhook.saveSuffix}
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
    const { t, locale } = useTranslation();
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
                <Alert color="primary">{t.integrations.github.connectPrompt}</Alert>
                <Button
                    startDecorator={<LinkRoundedIcon />}
                    sx={{ alignSelf: "flex-start" }}
                    onClick={() => {
                        void redirectToOAuthConnect("github", accessToken, undefined, setError);
                    }}
                >
                    {t.integrations.github.connectButton}
                </Button>
            </Stack>
        );
    }

    return (
        <Stack spacing={2}>
            <Stack alignItems="center" direction="row" justifyContent="space-between">
                <Typography level="title-md">{t.integrations.github.openPulls}</Typography>
            </Stack>
            {error && <Alert color="danger">{error}</Alert>}
            {loading ? (
                <Stack alignItems="center" sx={{ py: 4 }}>
                    <CircularProgress />
                </Stack>
            ) : pulls.length === 0 ? (
                <Sheet sx={{ p: 3, borderRadius: "md", textAlign: "center" }} variant="outlined">
                    <Typography level="body-sm" sx={{ color: "text.secondary" }}>
                        {t.integrations.github.noOpenPulls}
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
                                        {fmt(t.integrations.github.updated, {
                                            repo: pr.repo,
                                            number: pr.number,
                                            date: new Date(pr.updated_at).toLocaleDateString(
                                                locale
                                            ),
                                        })}
                                    </Typography>
                                </Box>
                                {pr.draft && <Chip size="sm">{t.integrations.github.draft}</Chip>}
                                <IconButton
                                    aria-label={t.integrations.github.openOnGithub}
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

/** Tier gate (UX tier model §7): a connector the plan doesn't include
 *  renders locked with an upgrade path. A padlock is acceptable here —
 *  this is a settings surface, not the conversation. */
const LockedIntegrationPanel = ({
    label,
    onUpgrade,
}: {
    label: string;
    onUpgrade: () => void;
}) => {
    const { t } = useTranslation();
    return (
        <Card sx={{ alignItems: "flex-start", gap: 1 }} variant="soft">
            <Stack alignItems="center" direction="row" spacing={1}>
                <LockRoundedIcon fontSize="small" />
                <Typography level="title-sm">
                    {fmt(t.integrations.locked.title, { name: label })}
                </Typography>
            </Stack>
            <Typography level="body-sm" sx={{ color: "text.secondary" }}>
                {fmt(t.integrations.locked.description, { name: label })}
            </Typography>
            <Button size="sm" variant="solid" onClick={onUpgrade}>
                {t.integrations.locked.comparePlans}
            </Button>
        </Card>
    );
};

export const IntegrationsHome = () => {
    const { accessToken } = useAuth();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [tab, setTab] = useState<TabKey>("connections");
    const [data, setData] = useState<ConnectionsResponse | null>(null);
    // The tier's integrations allowlist (/agent/features/). null =
    // unknown (older backend, or the fetch failed) and renders
    // PERMISSIVE — a fetch hiccup must never padlock a paying user.
    const [tierIntegrations, setTierIntegrations] = useState<Set<string> | null>(null);

    useEffect(() => {
        if (!accessToken) return;
        void fetchAgentFeatures(accessToken).then((f) => {
            setTierIntegrations(f?.integrations ? new Set(f.integrations) : null);
        });
    }, [accessToken]);

    const integrationAllowed = (name: "google_calendar" | "github") =>
        tierIntegrations === null || tierIntegrations.has(name);

    const reload = useCallback(async () => {
        if (!accessToken) return;
        const res = await listConnections(accessToken);
        if (res) setData(res);
    }, [accessToken]);

    useEffect(() => {
        void reload();
    }, [reload]);

    // "Any connected Google account", not "the first one". With two
    // accounts the first could be a sign-in-only row with no calendar
    // scope, which would wrongly gate the whole tab behind a "grant
    // access" prompt while the other account works fine.
    const googleConnections = findGoogleConnections(data);
    const googleConnected = googleConnections.length > 0;
    const googleCalendarAuthorized = hasAnyCalendarScope(googleConnections);
    const githubConnected = !!data?.connections.find((c) => c.provider === "github");
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    if (!accessToken) {
        return (
            <Box sx={{ p: 4 }}>
                <Alert color="danger">{t.integrations.errors.notSignedIn}</Alert>
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
                        {t.integrations.title}
                    </Typography>
                </Stack>

                <Tabs
                    sx={{ bgcolor: "transparent" }}
                    value={tab}
                    onChange={(_e, v) => v && setTab(v as TabKey)}
                >
                    <TabList sx={{ mb: 2 }}>
                        <Tab value="connections">{t.integrations.tabs.connections}</Tab>
                        <Tab value="calendar">{t.integrations.tabs.calendar}</Tab>
                        <Tab value="github">{t.integrations.tabs.github}</Tab>
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
                        {integrationAllowed("google_calendar") ? (
                            <CalendarTab
                                accessToken={accessToken}
                                calendarAuthorized={googleCalendarAuthorized}
                                googleConnected={googleConnected}
                            />
                        ) : (
                            <LockedIntegrationPanel
                                label={t.integrations.providers.googleCalendar}
                                onUpgrade={() => navigate("/workspace/plans")}
                            />
                        )}
                    </TabPanel>

                    <TabPanel sx={{ px: 0 }} value="github">
                        {integrationAllowed("github") ? (
                            <GithubTab
                                accessToken={accessToken}
                                githubConnected={githubConnected}
                            />
                        ) : (
                            <LockedIntegrationPanel
                                label={t.integrations.providers.github}
                                onUpgrade={() => navigate("/workspace/plans")}
                            />
                        )}
                    </TabPanel>
                </Tabs>
            </Box>
        </Box>
    );
};
