import { useEffect, useMemo, useState } from "react";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import HubRoundedIcon from "@mui/icons-material/HubRounded";
import KeyboardRoundedIcon from "@mui/icons-material/KeyboardRounded";
import LanguageRoundedIcon from "@mui/icons-material/LanguageRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import NotificationsRoundedIcon from "@mui/icons-material/NotificationsRounded";
import PaletteRoundedIcon from "@mui/icons-material/PaletteRounded";
import PlaylistAddCheckRoundedIcon from "@mui/icons-material/PlaylistAddCheckRounded";
import PrivacyTipRoundedIcon from "@mui/icons-material/PrivacyTipRounded";
import SettingsBrightnessRoundedIcon from "@mui/icons-material/SettingsBrightnessRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import ViewStreamRoundedIcon from "@mui/icons-material/ViewStreamRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import {
    Alert,
    Box,
    Button,
    Divider,
    IconButton,
    Modal,
    ModalDialog,
    Option,
    Select,
    Sheet,
    Stack,
    Switch,
    Tab,
    TabList,
    TabPanel,
    Tabs,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { useAuth } from "../../context/AuthContext";
import { ConnectionsSection } from "../../features/integrations/components/ConnectionsSection";
import { OAUTH_INTEGRATIONS_ENABLED } from "../../features/integrations/featureFlags";
import {
    findGoogleConnection,
    hasCalendarScope,
    listConnections,
} from "../../features/integrations/services/connections";
import { redirectToOAuthConnect } from "../../features/integrations/services/oauth";
import { useAnalyticsPreferences } from "../../hooks/common/useAnalyticsPreferences";
import { useAutoCloseOnPrMergePreference } from "../../hooks/common/useAutoCloseOnPrMergePreference";
import { useAutoSyncCalendarPreference } from "../../hooks/common/useAutoSyncCalendarPreference";
import {
    BubbleStyle,
    useBubbleStylePreference,
} from "../../hooks/common/useBubbleStylePreference";
import { useDoubleClickTodoPreference } from "../../hooks/common/useDoubleClickTodoPreference";
import { useLlmModelPreference } from "../../hooks/common/useLlmModelPreference";
import { useSpotlightPreferences } from "../../hooks/common/useSpotlightPreferences";
import { ThemePreference, useThemePreference } from "../../hooks/common/useThemePreference";
import { fmt, Locale, useTranslation } from "../../i18n";
import { AgentFeatures, fetchAgentFeatures } from "../../services/agentApi";
import { NotificationSettingsPanel } from "../../services/notifications/NotificationSettingsPanel";
import { getServiceShortcutModifierKeys, isMac } from "../../utils/platform";
import { MentionGroupsPanel } from "./MentionGroupsPanel";

type Props = {
    open: boolean;
    onClose: () => void;
    // The following are only consumed by the Mention groups tab — the
    // panel reads team members from `useTEM` for the add-member picker,
    // and forwards `myself` / `setMyself` / `socket` / `useCM` /
    // `useUISM` down to `AvatarWithStatus`.
    useTEM?: import("../../hooks/common/useTeamManagement").TeamManagementState;
    myself?: import("../../types/admin").UserProps;
    setMyself?: (value: import("../../types/admin").UserProps) => void;
    socket?: import("socket.io-client").Socket | null;
    useCM?: import("../../hooks/chats/useChatManagement").ChatManagementState;
    useUISM?: import("../../hooks/common/useUIStateManagement").UIStateManagementState;
};

/**
 * Tiny inline `<kbd>` chip — Joy doesn't ship one, so we style a native
 * element to keep semantics for screen readers / a11y tooling.
 */
const Kbd = ({ children }: { children: React.ReactNode }) => (
    <Box
        component="kbd"
        sx={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 22,
            px: 0.75,
            py: 0.1,
            fontFamily: "monospace",
            fontSize: "0.72rem",
            fontWeight: 600,
            lineHeight: 1.3,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: "sm",
            bgcolor: "background.level1",
            color: "text.primary",
            boxShadow: "0 1px 0 rgba(0,0,0,0.08)",
        }}
    >
        {children}
    </Box>
);

// Pill-style active state replacing Joy's default left-bar indicator
// on the modal's vertical sidebar. Reused on every Tab in the rail.
const SIDEBAR_TAB_SX = {
    justifyContent: "flex-start",
    gap: 1.25,
    borderRadius: "md",
    px: 1.5,
    py: 0.85,
    minHeight: 36,
    fontSize: "0.875rem",
    fontWeight: 500,
    color: "text.secondary",
    transition: "background-color 0.12s ease, color 0.12s ease",
    "&::after": { display: "none" },
    "&:hover:not([aria-selected='true'])": {
        bgcolor: "background.level1",
        color: "text.primary",
    },
    "&[aria-selected='true']": {
        bgcolor: "primary.softBg",
        color: "primary.softColor",
        fontWeight: 600,
    },
} as const;

const SIDEBAR_TAB_ICON_SX = { fontSize: 18, flexShrink: 0 } as const;

const AppearanceSection = () => {
    const { preference, setPreference } = useThemePreference();
    const { t } = useTranslation();
    return (
        <Sheet sx={{ p: 2, borderRadius: "lg" }} variant="outlined">
            <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 0.5 }}>
                <PaletteRoundedIcon />
                <Typography level="title-md">{t.settings.appearance.heading}</Typography>
            </Stack>
            <Typography level="body-xs" sx={{ mb: 1.5 }}>
                {t.settings.appearance.description}
            </Typography>

            <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={2}>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography level="title-sm">{t.settings.appearance.themeLabel}</Typography>
                    <Typography level="body-xs">{t.settings.appearance.themeHelper}</Typography>
                </Box>
                <Select
                    size="sm"
                    sx={{ minWidth: 140 }}
                    value={preference}
                    onChange={(_e, value) => {
                        if (value) setPreference(value as ThemePreference);
                    }}
                >
                    <Option value="light">
                        <Stack alignItems="center" direction="row" spacing={1}>
                            <LightModeRoundedIcon sx={{ fontSize: 18 }} />
                            <Typography level="body-sm">
                                {t.settings.appearance.themeLight}
                            </Typography>
                        </Stack>
                    </Option>
                    <Option value="dark">
                        <Stack alignItems="center" direction="row" spacing={1}>
                            <DarkModeRoundedIcon sx={{ fontSize: 18 }} />
                            <Typography level="body-sm">
                                {t.settings.appearance.themeDark}
                            </Typography>
                        </Stack>
                    </Option>
                    <Option value="system">
                        <Stack alignItems="center" direction="row" spacing={1}>
                            <SettingsBrightnessRoundedIcon sx={{ fontSize: 18 }} />
                            <Typography level="body-sm">
                                {t.settings.appearance.themeSystem}
                            </Typography>
                        </Stack>
                    </Option>
                </Select>
            </Stack>
        </Sheet>
    );
};

const MessageLayoutSection = () => {
    const { style, setStyle } = useBubbleStylePreference();
    const { t } = useTranslation();
    return (
        <Sheet sx={{ p: 2, borderRadius: "lg" }} variant="outlined">
            <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 0.5 }}>
                <ChatBubbleOutlineRoundedIcon />
                <Typography level="title-md">{t.settings.messageLayout.heading}</Typography>
            </Stack>
            <Typography level="body-xs" sx={{ mb: 1.5 }}>
                {t.settings.messageLayout.description}
            </Typography>

            <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={2}>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography level="title-sm">{t.settings.messageLayout.styleLabel}</Typography>
                    <Typography level="body-xs">{t.settings.messageLayout.styleHelper}</Typography>
                </Box>
                <Select
                    size="sm"
                    sx={{ minWidth: 140 }}
                    value={style}
                    onChange={(_e, value) => {
                        if (value) setStyle(value as BubbleStyle);
                    }}
                >
                    <Option value="bubble">
                        <Stack alignItems="center" direction="row" spacing={1}>
                            <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 18 }} />
                            <Typography level="body-sm">
                                {t.settings.messageLayout.styleBubble}
                            </Typography>
                        </Stack>
                    </Option>
                    <Option value="compact">
                        <Stack alignItems="center" direction="row" spacing={1}>
                            <ViewStreamRoundedIcon sx={{ fontSize: 18 }} />
                            <Typography level="body-sm">
                                {t.settings.messageLayout.styleCompact}
                            </Typography>
                        </Stack>
                    </Option>
                </Select>
            </Stack>
        </Sheet>
    );
};

const DoubleClickTodoSection = () => {
    const { enabled, setEnabled } = useDoubleClickTodoPreference();
    const { t } = useTranslation();
    return (
        <Sheet sx={{ p: 2, borderRadius: "lg" }} variant="outlined">
            <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 0.5 }}>
                <PlaylistAddCheckRoundedIcon />
                <Typography level="title-md">{t.settings.doubleClickTodo.heading}</Typography>
            </Stack>
            <Typography level="body-xs" sx={{ mb: 1.5 }}>
                {t.settings.doubleClickTodo.description}
            </Typography>

            <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={2}>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography level="title-sm">
                        {t.settings.doubleClickTodo.toggleLabel}
                    </Typography>
                    <Typography level="body-xs">
                        {t.settings.doubleClickTodo.toggleHelper}
                    </Typography>
                </Box>
                <Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            </Stack>
        </Sheet>
    );
};

const LlmModelSection = () => {
    const { data, loading, setChoice } = useLlmModelPreference();
    const { t } = useTranslation();

    // Cluster the catalog by provider so the model dropdown can show
    // only the models that match the currently-selected provider — the
    // backend catalog is flat, but the UI prefers Provider → Model
    // cascade so the user doesn't have to scan "Gemini Flash / Pro /
    // Claude Haiku / Sonnet" in a single list.
    const providers = useMemo(() => {
        if (!data) return [];
        const seen = new Map<string, string>();
        for (const m of data.models) {
            if (!seen.has(m.provider)) {
                seen.set(m.provider, m.provider);
            }
        }
        return Array.from(seen.keys());
    }, [data]);

    if (loading) {
        return (
            <Sheet sx={{ p: 2, borderRadius: "lg" }} variant="outlined">
                <Typography level="body-sm" sx={{ opacity: 0.7 }}>
                    Loading…
                </Typography>
            </Sheet>
        );
    }
    if (!data || data.models.length === 0) {
        return (
            <Sheet sx={{ p: 2, borderRadius: "lg" }} variant="outlined">
                <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 0.5 }}>
                    <BoltRoundedIcon />
                    <Typography level="title-md">{t.settings.llmModel.heading}</Typography>
                </Stack>
                <Typography level="body-xs">{t.settings.llmModel.noModelsConfigured}</Typography>
            </Sheet>
        );
    }

    const currentProvider = data.current.provider;
    const currentModel = data.current.model;
    const modelsForProvider = data.models.filter((m) => m.provider === currentProvider);
    const currentEntry = data.models.find(
        (m) => m.provider === currentProvider && m.model === currentModel
    );

    const providerLabel = (p: string) => {
        if (p === "gemini") return t.settings.llmModel.providerGemini;
        if (p === "claude") return t.settings.llmModel.providerClaude;
        return p;
    };

    return (
        <Sheet sx={{ p: 2, borderRadius: "lg" }} variant="outlined">
            <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 0.5 }}>
                <BoltRoundedIcon />
                <Typography level="title-md">{t.settings.llmModel.heading}</Typography>
                <Box sx={{ flex: 1 }} />
                <Typography
                    level="body-xs"
                    sx={{
                        px: 1,
                        py: 0.25,
                        borderRadius: "sm",
                        // Three-way: free=neutral, pro=primary, max=success.
                        // Distinct hues so the upgrade ladder is visually
                        // obvious without reading the label.
                        bgcolor:
                            data.tier === "max"
                                ? "success.softBg"
                                : data.tier === "pro"
                                  ? "primary.softBg"
                                  : "neutral.softBg",
                        color:
                            data.tier === "max"
                                ? "success.softColor"
                                : data.tier === "pro"
                                  ? "primary.softColor"
                                  : "neutral.softColor",
                        fontWeight: 600,
                    }}
                >
                    {data.tier === "max"
                        ? t.settings.llmModel.tierMax
                        : data.tier === "pro"
                          ? t.settings.llmModel.tierPro
                          : t.settings.llmModel.tierFree}
                </Typography>
            </Stack>
            <Typography level="body-xs" sx={{ mb: 1.5 }}>
                {t.settings.llmModel.description}
            </Typography>

            <Stack
                alignItems="center"
                direction="row"
                justifyContent="space-between"
                spacing={2}
                sx={{ mb: 1.5 }}
            >
                <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography level="title-sm">{t.settings.llmModel.providerLabel}</Typography>
                    <Typography level="body-xs">{t.settings.llmModel.providerHelper}</Typography>
                </Box>
                <Select
                    size="sm"
                    sx={{ minWidth: 180 }}
                    value={currentProvider}
                    onChange={(_e, value) => {
                        if (!value || typeof value !== "string") return;
                        // When the provider changes, default to that
                        // provider's first model in the catalog rather
                        // than leaving the previous (now-invalid) model
                        // selected — the backend resolver would fall
                        // back to the server default in that case, but
                        // the picker would visually drift.
                        const firstModel = data.models.find((m) => m.provider === value);
                        if (firstModel) {
                            void setChoice(value, firstModel.model);
                        }
                    }}
                >
                    {providers.map((p) => (
                        <Option key={p} value={p}>
                            <Typography level="body-sm">{providerLabel(p)}</Typography>
                        </Option>
                    ))}
                </Select>
            </Stack>

            <Stack
                alignItems="center"
                direction="row"
                justifyContent="space-between"
                spacing={2}
                sx={{ mb: 1.5 }}
            >
                <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography level="title-sm">{t.settings.llmModel.modelLabel}</Typography>
                    <Typography level="body-xs">
                        {currentEntry?.note || t.settings.llmModel.modelHelper}
                    </Typography>
                </Box>
                <Select
                    size="sm"
                    sx={{ minWidth: 180 }}
                    value={currentModel}
                    onChange={(_e, value) => {
                        if (!value || typeof value !== "string") return;
                        void setChoice(currentProvider, value);
                    }}
                >
                    {modelsForProvider.map((m) => (
                        <Option key={m.model} value={m.model}>
                            <Typography level="body-sm">{m.label}</Typography>
                        </Option>
                    ))}
                </Select>
            </Stack>

            <Divider sx={{ my: 1.5 }} />

            <Typography level="title-sm" sx={{ mb: 1 }}>
                {t.settings.llmModel.usageHeading}
            </Typography>
            <Stack spacing={0.75}>
                {/* Cross-cutting tier quotas come first — "LLM asks" is
                    the total daily ask count regardless of model, and
                    "Web searches" is the Tavily-tool counter. Both
                    increment in parallel with the per-model rows
                    below them. */}
                <Stack
                    alignItems="center"
                    direction="row"
                    justifyContent="space-between"
                    spacing={1}
                >
                    <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                        {t.settings.llmModel.llmAskLabel}
                    </Typography>
                    <Typography level="body-sm" sx={{ color: "text.tertiary" }}>
                        {data.limits.llm_ask.limit === null
                            ? t.settings.llmModel.usageUnlimited
                            : `${data.limits.llm_ask.used} / ${data.limits.llm_ask.limit}`}
                    </Typography>
                </Stack>
                <Stack
                    alignItems="center"
                    direction="row"
                    justifyContent="space-between"
                    spacing={1}
                >
                    <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                        {t.settings.llmModel.webSearchLabel}
                    </Typography>
                    <Typography level="body-sm" sx={{ color: "text.tertiary" }}>
                        {data.limits.web_search.limit === null
                            ? t.settings.llmModel.usageUnlimited
                            : `${data.limits.web_search.used} / ${data.limits.web_search.limit}`}
                    </Typography>
                </Stack>
                <Divider sx={{ my: 0.5 }} />
                {/* Only show per-model rows for the currently-selected
                    provider — counters for the other provider's models
                    still exist server-side, but they'd be noise here
                    given the user can't switch to them without first
                    changing the Provider dropdown. */}
                {modelsForProvider.map((m) => (
                    <Stack
                        key={`${m.provider}-${m.model}`}
                        alignItems="center"
                        direction="row"
                        justifyContent="space-between"
                        spacing={1}
                    >
                        <Typography level="body-sm">{m.label}</Typography>
                        <Typography level="body-sm" sx={{ color: "text.tertiary" }}>
                            {m.daily_limit === null
                                ? t.settings.llmModel.usageUnlimited
                                : `${m.used_today} / ${m.daily_limit}`}
                        </Typography>
                    </Stack>
                ))}
            </Stack>

            {data.tier === "free" && (
                <Typography level="body-xs" sx={{ mt: 1.5, color: "text.tertiary" }}>
                    {t.settings.llmModel.upgradeNote}
                </Typography>
            )}
        </Sheet>
    );
};

const SpotlightSection = () => {
    const { aiAnswers, webSearch, setAiAnswers, setWebSearch } = useSpotlightPreferences();
    const { accessToken } = useAuth();
    const { t } = useTranslation();

    // Probe the backend feature gate so we can warn the user upfront
    // when their account isn't approved for web search — without this,
    // the only signal they get is a generic "subscribers only"
    // ToolError mid-stream in the spotlight agent. `null` until the
    // probe resolves; the warning row only renders once we actually
    // know the answer (avoids a flash of "no access" while loading).
    const [features, setFeatures] = useState<AgentFeatures | null>(null);
    useEffect(() => {
        if (!accessToken) return;
        let cancelled = false;
        fetchAgentFeatures(accessToken).then((f) => {
            if (!cancelled) setFeatures(f);
        });
        return () => {
            cancelled = true;
        };
    }, [accessToken]);

    // Only nag the user when they've actually toggled web search on.
    // After the tier rollout, "access" is "your tier has a non-zero
    // daily quota" — most tiers do, but an admin could zero out a
    // tier's `web_search_daily` and we want users to learn that
    // upfront. `null` limit means unlimited (treated as access).
    // Both the warning AND the confirmation are gated on
    // `webSearch === true` so the row stays quiet by default.
    const webSearchLimit = features?.web_search?.limit;
    const hasWebSearchAccess = webSearchLimit === null || (webSearchLimit ?? 0) > 0;
    const showAccessWarning = aiAnswers && webSearch && features !== null && !hasWebSearchAccess;
    const showAccessGranted = aiAnswers && webSearch && features !== null && hasWebSearchAccess;

    return (
        <Sheet sx={{ p: 2, borderRadius: "lg" }} variant="outlined">
            <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 0.5 }}>
                <AutoAwesomeRoundedIcon />
                <Typography level="title-md">{t.settings.spotlight.heading}</Typography>
            </Stack>
            <Typography level="body-xs" sx={{ mb: 1.5 }}>
                {t.settings.spotlight.description}
            </Typography>

            <Stack
                alignItems="center"
                direction="row"
                justifyContent="space-between"
                spacing={2}
                sx={{ mb: 1.5 }}
            >
                <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography level="title-sm">{t.settings.spotlight.aiAnswersLabel}</Typography>
                    <Typography level="body-xs">{t.settings.spotlight.aiAnswersHelper}</Typography>
                </Box>
                <Switch checked={aiAnswers} onChange={(e) => setAiAnswers(e.target.checked)} />
            </Stack>

            <Divider />

            <Stack
                alignItems="center"
                direction="row"
                justifyContent="space-between"
                spacing={2}
                sx={{ mt: 1.5, opacity: aiAnswers ? 1 : 0.5 }}
            >
                <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography level="title-sm">{t.settings.spotlight.webSearchLabel}</Typography>
                    <Typography level="body-xs">{t.settings.spotlight.webSearchHelper}</Typography>
                </Box>
                <Switch
                    checked={webSearch}
                    disabled={!aiAnswers}
                    onChange={(e) => setWebSearch(e.target.checked)}
                />
            </Stack>

            {/* Per-user backend feature gate (`UserFeatureAccess`).
                Tavily is metered, so web search is opt-in per account
                regardless of this client-side toggle. Surface the
                state inline so users learn about the gate up front
                instead of hitting "subscribers only" mid-query. */}
            {showAccessWarning && (
                <Alert
                    color="warning"
                    size="sm"
                    startDecorator={<WarningAmberRoundedIcon />}
                    sx={{ mt: 1.5 }}
                    variant="soft"
                >
                    <Box>
                        <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                            Web search access required
                        </Typography>
                        <Typography level="body-xs">
                            Your account isn't approved for web search yet. Contact your
                            administrator to request access — the toggle is on, but the spotlight
                            agent will skip web search until it's granted.
                        </Typography>
                    </Box>
                </Alert>
            )}
            {showAccessGranted && (
                <Alert
                    color="success"
                    size="sm"
                    startDecorator={<CheckCircleRoundedIcon />}
                    sx={{ mt: 1.5 }}
                    variant="soft"
                >
                    <Typography level="body-sm">
                        {features?.web_search.limit === null
                            ? "Unlimited web searches on your tier."
                            : `Today: ${features?.web_search.used ?? 0} / ${features?.web_search.limit ?? 0} web searches.`}
                    </Typography>
                </Alert>
            )}
        </Sheet>
    );
};

const PrivacySection = () => {
    const { enabled, setEnabled } = useAnalyticsPreferences();
    const { t } = useTranslation();
    return (
        <Sheet sx={{ p: 2, borderRadius: "lg" }} variant="outlined">
            <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 0.5 }}>
                <PrivacyTipRoundedIcon />
                <Typography level="title-md">{t.settings.privacy.heading}</Typography>
            </Stack>
            <Typography level="body-xs" sx={{ mb: 1.5 }}>
                {t.settings.privacy.description}
            </Typography>

            <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={2}>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography level="title-sm">{t.settings.privacy.shareLabel}</Typography>
                    <Typography level="body-xs">{t.settings.privacy.shareHelper}</Typography>
                </Box>
                <Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            </Stack>
        </Sheet>
    );
};

const LanguageSection = () => {
    const { t, locale, setLocale } = useTranslation();
    return (
        <Sheet sx={{ p: 2, borderRadius: "lg" }} variant="outlined">
            <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 0.5 }}>
                <LanguageRoundedIcon />
                <Typography level="title-md">{t.settings.language.heading}</Typography>
            </Stack>
            <Typography level="body-xs" sx={{ mb: 1.5 }}>
                {t.settings.language.description}
            </Typography>

            <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={2}>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography level="title-sm">{t.settings.language.label}</Typography>
                    <Typography level="body-xs">{t.settings.language.helper}</Typography>
                </Box>
                <Select
                    size="sm"
                    sx={{ minWidth: 140 }}
                    value={locale}
                    onChange={(_e, value) => {
                        if (value) setLocale(value as Locale);
                    }}
                >
                    <Option value="en">
                        <Typography level="body-sm">{t.settings.language.english}</Typography>
                    </Option>
                    <Option value="ja">
                        <Typography level="body-sm">{t.settings.language.japanese}</Typography>
                    </Option>
                    <Option value="es">
                        <Typography level="body-sm">{t.settings.language.spanish}</Typography>
                    </Option>
                    <Option value="fr">
                        <Typography level="body-sm">{t.settings.language.french}</Typography>
                    </Option>
                    <Option value="zh">
                        <Typography level="body-sm">{t.settings.language.chinese}</Typography>
                    </Option>
                    <Option value="ar">
                        <Typography level="body-sm">{t.settings.language.arabic}</Typography>
                    </Option>
                    <Option value="hi">
                        <Typography level="body-sm">{t.settings.language.hindi}</Typography>
                    </Option>
                </Select>
            </Stack>
        </Sheet>
    );
};

const AutoCloseOnPrMergeSection = () => {
    const { enabled, loading, setEnabled } = useAutoCloseOnPrMergePreference();
    const { t } = useTranslation();
    return (
        <Sheet sx={{ p: 2, borderRadius: "lg" }} variant="outlined">
            <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 0.5 }}>
                <CheckCircleOutlineRoundedIcon />
                <Typography level="title-md">{t.settings.autoCloseOnPrMerge.heading}</Typography>
            </Stack>
            <Typography level="body-xs" sx={{ mb: 1.5 }}>
                {t.settings.autoCloseOnPrMerge.description}
            </Typography>

            <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={2}>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography level="title-sm">
                        {t.settings.autoCloseOnPrMerge.toggleLabel}
                    </Typography>
                    <Typography level="body-xs">
                        {t.settings.autoCloseOnPrMerge.toggleHelper}
                    </Typography>
                </Box>
                <Switch
                    checked={enabled}
                    disabled={loading}
                    onChange={(e) => setEnabled(e.target.checked)}
                />
            </Stack>
        </Sheet>
    );
};

const AutoSyncCalendarSection = () => {
    const { enabled, loading, setEnabled, backfill, backfillRunning } =
        useAutoSyncCalendarPreference();
    const { accessToken } = useAuth();
    const { t } = useTranslation();
    // Local connection probe. Two booleans because sign-in-via-Google
    // produces "connected but no calendar scope" — the toggle is only
    // useful when BOTH are true. Null = still loading.
    const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);
    const [calendarAuthorized, setCalendarAuthorized] = useState<boolean | null>(null);
    const [backfillMessage, setBackfillMessage] = useState<string | null>(null);
    const [backfillError, setBackfillError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        if (!accessToken) {
            setGoogleConnected(false);
            setCalendarAuthorized(false);
            return;
        }
        (async () => {
            const res = await listConnections(accessToken);
            if (cancelled) return;
            const google = findGoogleConnection(res);
            setGoogleConnected(!!google);
            setCalendarAuthorized(hasCalendarScope(google));
        })();
        return () => {
            cancelled = true;
        };
    }, [accessToken]);

    const handleBackfill = async () => {
        setBackfillError(null);
        setBackfillMessage(null);
        const result = await backfill();
        if (result === null) {
            setBackfillError(t.settings.autoSyncCalendar.backfillFailed);
            return;
        }
        // Three message branches keep the toast honest:
        //  - nothing eligible → "up to date"
        //  - only cleared links (events deleted on Google) → explain
        //    what happened so the user doesn't think the sync did
        //    something visible when it didn't
        //  - any real sync, with or without clears → show the counts
        if (result.synced === 0 && result.cleared === 0) {
            setBackfillMessage(t.settings.autoSyncCalendar.backfillUpToDate);
            return;
        }
        if (result.synced === 0 && result.cleared > 0) {
            setBackfillMessage(
                fmt(t.settings.autoSyncCalendar.backfillOnlyCleared, {
                    cleared: result.cleared,
                })
            );
            return;
        }
        const template =
            result.cleared > 0
                ? t.settings.autoSyncCalendar.backfillSuccessWithCleared
                : t.settings.autoSyncCalendar.backfillSuccess;
        setBackfillMessage(
            fmt(template, {
                total: result.synced,
                created: result.created,
                patched: result.patched,
                cleared: result.cleared,
            })
        );
    };

    // Toggle is disabled while we don't know the connection state, or
    // when the user clearly can't use the feature yet (not connected,
    // or connected without calendar scope).
    const togglesDisabled = loading || googleConnected === false || calendarAuthorized === false;

    let helperText: string = t.settings.autoSyncCalendar.toggleHelper;
    if (googleConnected === false) {
        helperText = t.settings.autoSyncCalendar.connectPrompt;
    } else if (calendarAuthorized === false) {
        helperText = t.settings.autoSyncCalendar.grantPrompt;
    }

    return (
        <Sheet sx={{ p: 2, borderRadius: "lg" }} variant="outlined">
            <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 0.5 }}>
                <CalendarMonthRoundedIcon />
                <Typography level="title-md">{t.settings.autoSyncCalendar.heading}</Typography>
            </Stack>
            <Typography level="body-xs" sx={{ mb: 1.5 }}>
                {t.settings.autoSyncCalendar.description}
            </Typography>

            <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={2}>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography level="title-sm">
                        {t.settings.autoSyncCalendar.toggleLabel}
                    </Typography>
                    <Typography level="body-xs">{helperText}</Typography>
                </Box>
                <Switch
                    checked={enabled}
                    disabled={togglesDisabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                />
            </Stack>

            {/* Connected but missing calendar scope → inline Grant
                button. Skipping when not connected at all keeps the
                prompt focused on the right action ("Connect Google
                in Integrations" already lives there, redundant link
                from settings would be noise). */}
            {googleConnected === true && calendarAuthorized === false && accessToken && (
                <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1.5 }}>
                    <Button
                        size="sm"
                        variant="solid"
                        color="primary"
                        onClick={() =>
                            void redirectToOAuthConnect(
                                "google",
                                accessToken,
                                undefined,
                                () => undefined
                            )
                        }
                    >
                        {t.settings.autoSyncCalendar.grantButton}
                    </Button>
                </Stack>
            )}

            {enabled && googleConnected && calendarAuthorized && (
                <>
                    <Divider sx={{ my: 1.5 }} />
                    <Stack
                        alignItems="center"
                        direction="row"
                        justifyContent="space-between"
                        spacing={2}
                    >
                        <Typography
                            level="body-xs"
                            sx={{ color: backfillError ? "danger.500" : "text.tertiary" }}
                        >
                            {backfillError || backfillMessage || ""}
                        </Typography>
                        <Button
                            size="sm"
                            variant="outlined"
                            disabled={backfillRunning}
                            onClick={handleBackfill}
                        >
                            {backfillRunning
                                ? t.settings.autoSyncCalendar.backfillRunning
                                : t.settings.autoSyncCalendar.backfillButton}
                        </Button>
                    </Stack>
                </>
            )}
        </Sheet>
    );
};

type ShortcutGroup = {
    title: string;
    description: string;
    rows: Array<{ label: string; combo: string[] }>;
};

const KeyboardShortcutsSection = () => {
    const { t } = useTranslation();
    // Modifier display reflects what `useGlobalServiceShortcut` actually
    // listens to: Ctrl+Cmd on Mac, Ctrl+Alt elsewhere.
    const modifierKeys = useMemo(getServiceShortcutModifierKeys, []);
    const cmdLabel = isMac() ? "⌘" : "Alt";

    const groups: ShortcutGroup[] = [
        {
            title: t.settings.shortcuts.global.title,
            description: t.settings.shortcuts.global.description,
            rows: [
                {
                    label: t.settings.shortcuts.global.rows.spotlight,
                    combo: [isMac() ? "⌘" : "Ctrl", "K"],
                },
                {
                    label: t.settings.shortcuts.global.rows.tasksNew,
                    combo: [...modifierKeys, "T"],
                },
                {
                    label: t.settings.shortcuts.global.rows.notesNew,
                    combo: [...modifierKeys, "N"],
                },
                {
                    label: t.settings.shortcuts.global.rows.calendar,
                    combo: [...modifierKeys, "C"],
                },
                {
                    label: t.settings.shortcuts.global.rows.meetClipboard,
                    combo: [...modifierKeys, "M"],
                },
                {
                    label: t.settings.shortcuts.global.rows.openHistory,
                    combo: [...modifierKeys, "H"],
                },
                {
                    label: t.settings.shortcuts.global.rows.openTaskDiagram,
                    combo: [...modifierKeys, "G"],
                },
                {
                    label: t.settings.shortcuts.global.rows.cycle,
                    combo: [
                        t.settings.shortcuts.global.cycleCombo.hold,
                        t.settings.shortcuts.global.cycleCombo.tap,
                        t.settings.shortcuts.global.cycleCombo.release,
                    ],
                },
            ],
        },
        {
            title: t.settings.shortcuts.chat.title,
            description: t.settings.shortcuts.chat.description,
            rows: [
                {
                    label: t.settings.shortcuts.chat.rows.switchTab,
                    combo: [cmdLabel, "Shift", "← / →"],
                },
                {
                    label: t.settings.shortcuts.chat.rows.moveSelection,
                    combo: [cmdLabel, "Shift", "↑ / ↓"],
                },
                {
                    label: t.settings.shortcuts.chat.rows.openThread,
                    combo: [cmdLabel, t.settings.shortcuts.chat.clickMessage],
                },
            ],
        },
    ];

    return (
        <Sheet sx={{ p: 2, borderRadius: "lg" }} variant="outlined">
            <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 0.5 }}>
                <KeyboardRoundedIcon />
                <Typography level="title-md">{t.settings.shortcuts.heading}</Typography>
            </Stack>

            <Stack spacing={2}>
                {groups.map((group, gIdx) => (
                    <Box key={group.title}>
                        <Typography level="title-sm" sx={{ mt: gIdx === 0 ? 0.5 : 0 }}>
                            {group.title}
                        </Typography>
                        <Typography level="body-xs" sx={{ mb: 1 }}>
                            {group.description}
                        </Typography>
                        <Stack spacing={0.75}>
                            {group.rows.map((row, idx) => (
                                <Box key={row.label}>
                                    <Stack
                                        alignItems="center"
                                        direction="row"
                                        justifyContent="space-between"
                                        spacing={2}
                                    >
                                        <Typography level="body-sm">{row.label}</Typography>
                                        <Stack alignItems="center" direction="row" spacing={0.5}>
                                            {row.combo.map((key, i) => (
                                                <Stack
                                                    key={`${key}-${i}`}
                                                    alignItems="center"
                                                    direction="row"
                                                    spacing={0.5}
                                                >
                                                    <Kbd>{key}</Kbd>
                                                    {i < row.combo.length - 1 && (
                                                        <Typography
                                                            level="body-xs"
                                                            sx={{ color: "text.tertiary" }}
                                                        >
                                                            +
                                                        </Typography>
                                                    )}
                                                </Stack>
                                            ))}
                                        </Stack>
                                    </Stack>
                                    {idx < group.rows.length - 1 && <Divider sx={{ mt: 0.75 }} />}
                                </Box>
                            ))}
                        </Stack>
                    </Box>
                ))}
            </Stack>
        </Sheet>
    );
};

/**
 * Dedicated home for user-level settings. Sections from top to bottom:
 *
 *   1. Appearance       – theme mode (light / dark / system).
 *   2. Message layout   – bubble vs compact rendering of chat messages.
 *   3. Spotlight        – AI answers + web search toggles.
 *   4. Privacy          – analytics opt-out.
 *   5. Language         – locale switcher (English / 日本語).
 *   6. Notifications    – delegates to `NotificationSettingsPanel`.
 *   7. Keyboard shortcuts – read-only reference for the global service shortcuts.
 *
 * Notification state is read from `NotificationsContext` provided at the
 * App root, so the modal needs no notification-specific props.
 */
// Tab keys mirror the i18n keys under `settings.tabs.*` and are kept
// as a plain string union (rather than numeric indices) so reordering
// or inserting a new tab doesn't silently shift selection.
type SettingsTabKey =
    | "general"
    | "chat"
    | "tasks"
    | "spotlight"
    | "notifications"
    | "mentionGroups"
    | "shortcuts"
    | "integrations";

/**
 * Settings → Integrations panel. Renders the same Connections UI
 * (Google + GitHub Connect/Disconnect, Grant Calendar access, test-
 * user notice) that the `/workspace/integrations` page surfaces, so
 * users can manage their providers without leaving Settings. The
 * `accessToken` gate keeps the panel quiet for pre-auth contexts
 * (e.g., if the modal were ever rendered before sign-in completes).
 */
const IntegrationsSection = () => {
    const { accessToken } = useAuth();
    if (!accessToken) return null;
    return <ConnectionsSection accessToken={accessToken} />;
};

export const SettingsModal = ({
    open,
    onClose,
    useTEM,
    myself,
    setMyself,
    socket,
    useCM,
    useUISM,
}: Props) => {
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";
    // Tab selection is local component state — open the modal,
    // navigate around, close — there's no need to persist this across
    // sessions. Default to "general" because it holds the broadest
    // app-wide preferences (appearance, language, privacy).
    const [tab, setTab] = useState<SettingsTabKey>("general");
    return (
        <Modal open={open} onClose={onClose}>
            <ModalDialog
                className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                size="lg"
                sx={{
                    // Widened at `lg` so the two-pane Mention groups
                    // panel (group list + member editor) fits without
                    // truncation. The other tabs still look fine in
                    // the extra space — they're single-column sheets.
                    width: { xs: "92vw", sm: 550, md: 700, lg: 920 },
                    maxHeight: "85vh",
                    overflowY: "auto",
                    overflowX: "hidden",
                    borderRadius: "xl",
                    p: 2.5,
                }}
            >
                <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 1 }}>
                    <SettingsRoundedIcon />
                    <Typography level="title-lg">{t.settings.title}</Typography>
                    <Box sx={{ flex: 1 }} />
                    <IconButton variant="plain" onClick={onClose}>
                        <CloseRoundedIcon />
                    </IconButton>
                </Stack>
                <Divider sx={{ mb: 2 }} />
                <Tabs
                    orientation="vertical"
                    sx={{
                        // Sidebar tab list on the left, panel on the
                        // right. The Tabs component flexes children
                        // along its orientation, so a row layout drops
                        // out naturally once orientation flips.
                        bgcolor: "transparent",
                        gap: 2,
                    }}
                    value={tab}
                    onChange={(_event, value) => {
                        if (typeof value === "string") setTab(value as SettingsTabKey);
                    }}
                >
                    <TabList
                        sx={{
                            minWidth: 184,
                            flexShrink: 0,
                            gap: 0.25,
                            overflow: "visible",
                            scrollbarWidth: "none",
                        }}
                    >
                        <Tab value="general" sx={SIDEBAR_TAB_SX}>
                            <SettingsRoundedIcon sx={SIDEBAR_TAB_ICON_SX} />
                            {t.settings.tabs.general}
                        </Tab>
                        <Tab value="chat" sx={SIDEBAR_TAB_SX}>
                            <ChatBubbleOutlineRoundedIcon sx={SIDEBAR_TAB_ICON_SX} />
                            {t.settings.tabs.chat}
                        </Tab>
                        <Tab value="tasks" sx={SIDEBAR_TAB_SX}>
                            <PlaylistAddCheckRoundedIcon sx={SIDEBAR_TAB_ICON_SX} />
                            {t.settings.tabs.tasks}
                        </Tab>
                        <Tab value="spotlight" sx={SIDEBAR_TAB_SX}>
                            <AutoAwesomeRoundedIcon sx={SIDEBAR_TAB_ICON_SX} />
                            {t.settings.tabs.spotlight}
                        </Tab>
                        <Tab value="notifications" sx={SIDEBAR_TAB_SX}>
                            <NotificationsRoundedIcon sx={SIDEBAR_TAB_ICON_SX} />
                            {t.settings.tabs.notifications}
                        </Tab>
                        <Tab value="mentionGroups" sx={SIDEBAR_TAB_SX}>
                            <GroupRoundedIcon sx={SIDEBAR_TAB_ICON_SX} />
                            {t.settings.tabs.mentionGroups}
                        </Tab>
                        <Tab value="shortcuts" sx={SIDEBAR_TAB_SX}>
                            <KeyboardRoundedIcon sx={SIDEBAR_TAB_ICON_SX} />
                            {t.settings.tabs.shortcuts}
                        </Tab>
                        {/* Feature-flagged so disabled deploys don't
                            show an empty tab. */}
                        {OAUTH_INTEGRATIONS_ENABLED && (
                            <Tab value="integrations" sx={SIDEBAR_TAB_SX}>
                                <HubRoundedIcon sx={SIDEBAR_TAB_ICON_SX} />
                                {t.settings.tabs.integrations}
                            </Tab>
                        )}
                    </TabList>

                    <TabPanel value="general" sx={{ px: 0, py: 2 }}>
                        <Stack spacing={2}>
                            <AppearanceSection />
                            <LanguageSection />
                            <PrivacySection />
                        </Stack>
                    </TabPanel>
                    <TabPanel value="chat" sx={{ px: 0, py: 2 }}>
                        <Stack spacing={2}>
                            <MessageLayoutSection />
                            <DoubleClickTodoSection />
                        </Stack>
                    </TabPanel>
                    <TabPanel value="tasks" sx={{ px: 0, py: 2 }}>
                        <Stack spacing={2}>
                            {/* Sort settings now live in
                                `TaskTableColumnSettings` (task table /
                                board view config), since they're
                                view-level prefs rather than user-level
                                ones. The two integrations below stay
                                here because they affect cross-feature
                                behaviour. */}
                            <AutoCloseOnPrMergeSection />
                            <AutoSyncCalendarSection />
                        </Stack>
                    </TabPanel>
                    <TabPanel value="spotlight" sx={{ px: 0, py: 2 }}>
                        <Stack spacing={2}>
                            <LlmModelSection />
                            <SpotlightSection />
                        </Stack>
                    </TabPanel>
                    <TabPanel value="notifications" sx={{ px: 0, py: 2 }}>
                        <Stack spacing={2}>
                            <NotificationSettingsPanel />
                        </Stack>
                    </TabPanel>
                    <TabPanel value="mentionGroups" sx={{ px: 0, py: 2 }}>
                        <Stack spacing={2}>
                            {/* All five auxiliary props are needed to
                                render the panel's avatar rows. If any
                                call site forgets them, fall back to a
                                quiet placeholder rather than crash. */}
                            {myself && setMyself && useCM && useUISM ? (
                                <MentionGroupsPanel
                                    useTEM={useTEM}
                                    myself={myself}
                                    setMyself={setMyself}
                                    socket={socket ?? null}
                                    useCM={useCM}
                                    useUISM={useUISM}
                                />
                            ) : (
                                <Typography level="body-sm" sx={{ opacity: 0.7 }}>
                                    Loading…
                                </Typography>
                            )}
                        </Stack>
                    </TabPanel>
                    <TabPanel value="shortcuts" sx={{ px: 0, py: 2 }}>
                        <Stack spacing={2}>
                            <KeyboardShortcutsSection />
                        </Stack>
                    </TabPanel>
                    {OAUTH_INTEGRATIONS_ENABLED && (
                        <TabPanel value="integrations" sx={{ px: 0, py: 2 }}>
                            <Stack spacing={2}>
                                <IntegrationsSection />
                            </Stack>
                        </TabPanel>
                    )}
                </Tabs>
            </ModalDialog>
        </Modal>
    );
};
