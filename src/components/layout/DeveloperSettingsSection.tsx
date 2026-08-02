import { useCallback, useEffect, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import KeyRoundedIcon from "@mui/icons-material/KeyRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import WebhookRoundedIcon from "@mui/icons-material/WebhookRounded";
import {
    Alert,
    Box,
    Button,
    Checkbox,
    Chip,
    IconButton,
    Input,
    Link,
    Option,
    Select,
    Sheet,
    Stack,
    Typography,
} from "@mui/joy";

import { useAuth } from "../../context/AuthContext";
import { useTranslation } from "../../i18n";
import {
    ApiKey,
    CHANNEL_SCOPED_EVENTS,
    createApiKey,
    createWebhook,
    deleteWebhook,
    listApiKeys,
    listScopeOptions,
    listWebhooks,
    revokeApiKey,
    ScopeOptions,
    WEBHOOK_EVENTS,
    WebhookEndpoint,
} from "../../services/developerApi";
import { AppTooltip } from "../ui/AppTooltip";

type Props = {
    /** Team the webhook half operates on. API keys are per-user, so the
     *  two halves deliberately have different scopes. */
    teamId: string | null;
};

/**
 * Settings → Developer: API keys and outbound webhooks.
 *
 * ONE tab, not two. The settings `TabList` already frets in its own
 * comments about ten tabs overflowing the horizontal strip on mobile,
 * and these two things are the same job — "wire Genos into something
 * else" — so they belong behind one door.
 *
 * The load-bearing UI decision here is the ONE-SHOT SECRET. Both the API
 * key and the webhook signing secret are shown exactly once and cannot
 * be recovered (the server stores a hash for one and never re-emits the
 * other). A panel that displayed them like ordinary fields would teach
 * people to expect them back, so they get a distinct, alarming,
 * copy-first treatment that has to be dismissed deliberately.
 */
export const DeveloperSettingsSection = ({ teamId }: Props) => {
    const { t } = useTranslation();
    const { accessToken } = useAuth();
    const d = t.settings.developer;

    const [keys, setKeys] = useState<ApiKey[]>([]);
    const [hooks, setHooks] = useState<WebhookEndpoint[]>([]);
    const [loaded, setLoaded] = useState(false);

    // The plaintext, held in memory only until dismissed. Never written
    // to state that outlives the panel, and never re-fetchable.
    const [freshKey, setFreshKey] = useState<string | null>(null);
    const [freshSecret, setFreshSecret] = useState<string | null>(null);

    const [keyName, setKeyName] = useState("");
    const [keyScope, setKeyScope] = useState<"read" | "write">("read");
    const [keyBusy, setKeyBusy] = useState(false);

    const [hookUrl, setHookUrl] = useState("");
    const [hookEvents, setHookEvents] = useState<string[]>([WEBHOOK_EVENTS[0]]);
    const [hookError, setHookError] = useState<string | null>(null);
    const [hookBusy, setHookBusy] = useState(false);
    const [hookProjectIds, setHookProjectIds] = useState<number[]>([]);
    const [hookChannelIds, setHookChannelIds] = useState<string[]>([]);
    const [scopeOptions, setScopeOptions] = useState<ScopeOptions>({
        projects: [],
        channels: [],
    });

    // `message.created` is the only event that REQUIRES a scope. Everything
    // else treats an empty list as "no filter", which is why the two
    // pickers below read so differently.
    const wantsChat = hookEvents.some((e) => CHANNEL_SCOPED_EVENTS.includes(e));

    const refresh = useCallback(async () => {
        const [k, w] = await Promise.all([
            listApiKeys(accessToken),
            teamId ? listWebhooks(accessToken, teamId) : Promise.resolve([]),
        ]);
        setKeys(k ?? []);
        // `null` means the request failed OR the caller isn't a team
        // manager — the endpoint 403s/404s for non-managers. Either way
        // an empty list is the honest render; the create form below
        // surfaces the real reason if they try.
        setHooks(w ?? []);
        setLoaded(true);
        // Scope options are for the create form only, so a failure here
        // yields empty lists rather than an error — a webhook that needs
        // no scope must still be creatable.
        if (teamId) {
            // `userId` is deliberately not on the auth context (it
            // outlives logout as a last-signed-in marker), so it comes
            // from localStorage the same way every other caller reads it.
            const userId = localStorage.getItem("userId") ?? "";
            setScopeOptions(await listScopeOptions(accessToken, teamId, userId));
        }
    }, [accessToken, teamId]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const onCreateKey = async () => {
        if (!keyName.trim()) return;
        setKeyBusy(true);
        const res = await createApiKey(accessToken, {
            name: keyName.trim(),
            scope: keyScope,
        });
        setKeyBusy(false);
        if (res.status === "created") {
            setFreshKey(res.key);
            setKeyName("");
            void refresh();
        }
    };

    const onCreateHook = async () => {
        if (!teamId || !hookUrl.trim() || hookEvents.length === 0) return;
        if (wantsChat && hookChannelIds.length === 0) {
            setHookError(d.webhooks.chatNeedsChannels);
            return;
        }
        setHookBusy(true);
        setHookError(null);
        const res = await createWebhook(accessToken, {
            teamId,
            url: hookUrl.trim(),
            events: hookEvents,
            projectIds: hookProjectIds,
            channelIds: wantsChat ? hookChannelIds : [],
        });
        setHookBusy(false);
        if (res.status === "created") {
            setFreshSecret(res.secret);
            setHookUrl("");
            setHookProjectIds([]);
            setHookChannelIds([]);
            void refresh();
        } else if (res.status === "invalid") {
            // Verbatim from the server. "Webhook URL must resolve to a
            // public address" is the difference between the person
            // fixing their tunnel and filing a bug against us.
            setHookError(res.message);
        } else if (res.status === "forbidden") {
            setHookError(d.webhooks.managerOnly);
        } else {
            setHookError(d.webhooks.createFailed);
        }
    };

    const copy = (value: string) => {
        void navigator.clipboard?.writeText(value);
    };

    return (
        <Stack spacing={3}>
            {/* ── API keys ─────────────────────────────────────────── */}
            <Stack spacing={1.5}>
                <Stack direction="row" spacing={1} alignItems="center">
                    <KeyRoundedIcon sx={{ fontSize: 18 }} />
                    <Typography level="title-md">{d.keys.title}</Typography>
                </Stack>
                <Typography level="body-sm" sx={{ opacity: 0.75 }}>
                    {d.keys.blurb}{" "}
                    {/* Someone who already has a key looks HERE for the
                        reference, not on the marketing site. Opens in a
                        new tab so it never costs them an unsaved form. */}
                    <Link href="/developers" target="_blank" rel="noreferrer">
                        {d.docsLink}
                    </Link>
                </Typography>

                {freshKey && (
                    <Alert
                        color="warning"
                        variant="soft"
                        startDecorator={<WarningAmberRoundedIcon />}
                        sx={{ alignItems: "flex-start" }}
                    >
                        <Stack spacing={1} sx={{ minWidth: 0, width: "100%" }}>
                            <Typography level="title-sm">{d.oneShot.title}</Typography>
                            <Typography level="body-xs">{d.oneShot.body}</Typography>
                            <Stack direction="row" spacing={1} alignItems="center">
                                <Input
                                    readOnly
                                    value={freshKey}
                                    size="sm"
                                    sx={{ flex: 1, fontFamily: "monospace", minWidth: 0 }}
                                />
                                <AppTooltip title={d.oneShot.copy}>
                                    <IconButton
                                        size="sm"
                                        variant="soft"
                                        onClick={() => copy(freshKey)}
                                    >
                                        <ContentCopyRoundedIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                </AppTooltip>
                            </Stack>
                            <Button
                                size="sm"
                                variant="soft"
                                color="neutral"
                                onClick={() => setFreshKey(null)}
                                sx={{ alignSelf: "flex-start" }}
                            >
                                {d.oneShot.dismiss}
                            </Button>
                        </Stack>
                    </Alert>
                )}

                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <Input
                        size="sm"
                        placeholder={d.keys.namePlaceholder}
                        value={keyName}
                        onChange={(e) => setKeyName(e.target.value)}
                        sx={{ flex: 1, minWidth: 0 }}
                    />
                    <Select
                        size="sm"
                        value={keyScope}
                        onChange={(_, v) => setKeyScope((v as "read" | "write") ?? "read")}
                        sx={{ minWidth: 120 }}
                    >
                        <Option value="read">{d.keys.scopeRead}</Option>
                        <Option value="write">{d.keys.scopeWrite}</Option>
                    </Select>
                    <Button
                        size="sm"
                        startDecorator={<AddRoundedIcon sx={{ fontSize: 16 }} />}
                        loading={keyBusy}
                        disabled={!keyName.trim()}
                        onClick={onCreateKey}
                    >
                        {d.keys.create}
                    </Button>
                </Stack>

                {loaded && keys.length === 0 && (
                    <Typography level="body-xs" sx={{ opacity: 0.6 }}>
                        {d.keys.empty}
                    </Typography>
                )}
                {keys.map((k) => (
                    <Sheet
                        key={k.id}
                        variant="soft"
                        sx={{ borderRadius: 8, p: 1.25, minWidth: 0 }}
                    >
                        <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                            sx={{ minWidth: 0 }}
                        >
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                                <Typography level="title-sm" noWrap>
                                    {k.name}
                                </Typography>
                                <Typography
                                    level="body-xs"
                                    sx={{ opacity: 0.7, fontFamily: "monospace" }}
                                    noWrap
                                >
                                    {k.prefix}…
                                </Typography>
                            </Box>
                            <Chip size="sm" variant="soft">
                                {k.scope === "write" ? d.keys.scopeWrite : d.keys.scopeRead}
                            </Chip>
                            <AppTooltip title={d.keys.revoke}>
                                <IconButton
                                    size="sm"
                                    variant="plain"
                                    color="danger"
                                    onClick={async () => {
                                        if (await revokeApiKey(accessToken, k.id)) void refresh();
                                    }}
                                >
                                    <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                            </AppTooltip>
                        </Stack>
                    </Sheet>
                ))}
            </Stack>

            {/* ── Webhooks ─────────────────────────────────────────── */}
            <Stack spacing={1.5}>
                <Stack direction="row" spacing={1} alignItems="center">
                    <WebhookRoundedIcon sx={{ fontSize: 18 }} />
                    <Typography level="title-md">{d.webhooks.title}</Typography>
                </Stack>
                <Typography level="body-sm" sx={{ opacity: 0.75 }}>
                    {d.webhooks.blurb}
                </Typography>

                {freshSecret && (
                    <Alert
                        color="warning"
                        variant="soft"
                        startDecorator={<WarningAmberRoundedIcon />}
                        sx={{ alignItems: "flex-start" }}
                    >
                        <Stack spacing={1} sx={{ minWidth: 0, width: "100%" }}>
                            <Typography level="title-sm">{d.oneShot.secretTitle}</Typography>
                            <Typography level="body-xs">{d.oneShot.secretBody}</Typography>
                            <Stack direction="row" spacing={1} alignItems="center">
                                <Input
                                    readOnly
                                    value={freshSecret}
                                    size="sm"
                                    sx={{ flex: 1, fontFamily: "monospace", minWidth: 0 }}
                                />
                                <AppTooltip title={d.oneShot.copy}>
                                    <IconButton
                                        size="sm"
                                        variant="soft"
                                        onClick={() => copy(freshSecret)}
                                    >
                                        <ContentCopyRoundedIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                </AppTooltip>
                            </Stack>
                            <Button
                                size="sm"
                                variant="soft"
                                color="neutral"
                                onClick={() => setFreshSecret(null)}
                                sx={{ alignSelf: "flex-start" }}
                            >
                                {d.oneShot.dismiss}
                            </Button>
                        </Stack>
                    </Alert>
                )}

                <Input
                    size="sm"
                    placeholder={d.webhooks.urlPlaceholder}
                    value={hookUrl}
                    onChange={(e) => {
                        setHookUrl(e.target.value);
                        setHookError(null);
                    }}
                    error={!!hookError}
                    sx={{ minWidth: 0 }}
                />
                <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                    {WEBHOOK_EVENTS.map((ev) => (
                        <Checkbox
                            key={ev}
                            size="sm"
                            label={ev}
                            checked={hookEvents.includes(ev)}
                            onChange={(e) =>
                                setHookEvents((prev) =>
                                    e.target.checked ? [...prev, ev] : prev.filter((x) => x !== ev)
                                )
                            }
                        />
                    ))}
                </Stack>
                {/* Project filter — OPTIONAL. Nothing selected means every
                    project, which is what this endpoint did before scope
                    existed, so the copy has to say so or an empty picker
                    reads as "you will receive nothing". */}
                {scopeOptions.projects.length > 0 && (
                    <Box sx={{ minWidth: 0 }}>
                        <Typography level="body-xs" sx={{ opacity: 0.7, mb: 0.5 }}>
                            {hookProjectIds.length === 0
                                ? d.webhooks.projectScopeAll
                                : d.webhooks.projectScopeSome}
                        </Typography>
                        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                            {scopeOptions.projects.map((p) => (
                                <Checkbox
                                    key={p.id}
                                    size="sm"
                                    label={p.name}
                                    checked={hookProjectIds.includes(p.id)}
                                    onChange={(e) =>
                                        setHookProjectIds((prev) =>
                                            e.target.checked
                                                ? [...prev, p.id]
                                                : prev.filter((x) => x !== p.id)
                                        )
                                    }
                                />
                            ))}
                        </Stack>
                    </Box>
                )}

                {/* Channel allow-list — REQUIRED once a chat event is
                    ticked, and only rendered then. DMs are absent from
                    `scopeOptions.channels` entirely: offering one and
                    then rejecting it would have implied that routing a
                    private conversation to an external URL is a
                    supported idea that merely failed validation. */}
                {wantsChat && (
                    <Box sx={{ minWidth: 0 }}>
                        <Typography level="body-xs" sx={{ opacity: 0.7, mb: 0.5 }}>
                            {d.webhooks.channelScopeRequired}
                        </Typography>
                        {scopeOptions.channels.length === 0 ? (
                            <Typography level="body-xs" color="warning">
                                {d.webhooks.noEligibleChannels}
                            </Typography>
                        ) : (
                            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                                {scopeOptions.channels.map((c) => (
                                    <Checkbox
                                        key={c.id}
                                        size="sm"
                                        label={c.title}
                                        checked={hookChannelIds.includes(c.id)}
                                        onChange={(e) =>
                                            setHookChannelIds((prev) =>
                                                e.target.checked
                                                    ? [...prev, c.id]
                                                    : prev.filter((x) => x !== c.id)
                                            )
                                        }
                                    />
                                ))}
                            </Stack>
                        )}
                    </Box>
                )}

                {hookError && (
                    <Typography level="body-xs" color="danger">
                        {hookError}
                    </Typography>
                )}
                <Button
                    size="sm"
                    startDecorator={<AddRoundedIcon sx={{ fontSize: 16 }} />}
                    loading={hookBusy}
                    disabled={
                        !teamId ||
                        !hookUrl.trim() ||
                        hookEvents.length === 0 ||
                        (wantsChat && hookChannelIds.length === 0)
                    }
                    onClick={onCreateHook}
                    sx={{ alignSelf: "flex-start" }}
                >
                    {d.webhooks.create}
                </Button>

                {loaded && hooks.length === 0 && (
                    <Typography level="body-xs" sx={{ opacity: 0.6 }}>
                        {d.webhooks.empty}
                    </Typography>
                )}
                {hooks.map((h) => (
                    <Sheet
                        key={h.id}
                        variant="soft"
                        sx={{ borderRadius: 8, p: 1.25, minWidth: 0 }}
                    >
                        <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                            sx={{ minWidth: 0 }}
                        >
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                                <Typography level="title-sm" noWrap>
                                    {h.url}
                                </Typography>
                                <Typography level="body-xs" sx={{ opacity: 0.7 }} noWrap>
                                    {h.events.join(", ")}
                                </Typography>
                            </Box>
                            {/* The server disables an endpoint after 10
                                consecutive failures. Saying so is the
                                difference between "our webhooks stopped"
                                and a support ticket. */}
                            {!h.isActive && (
                                <Chip size="sm" color="danger" variant="soft">
                                    {d.webhooks.disabled}
                                </Chip>
                            )}
                            <AppTooltip title={d.webhooks.delete}>
                                <IconButton
                                    size="sm"
                                    variant="plain"
                                    color="danger"
                                    onClick={async () => {
                                        if (await deleteWebhook(accessToken, h.id)) void refresh();
                                    }}
                                >
                                    <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                            </AppTooltip>
                        </Stack>
                    </Sheet>
                ))}
            </Stack>
        </Stack>
    );
};
