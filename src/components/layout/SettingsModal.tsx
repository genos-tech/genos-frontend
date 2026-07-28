import { useEffect, useMemo, useRef, useState } from "react";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import EmojiEmotionsRoundedIcon from "@mui/icons-material/EmojiEmotionsRounded";
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
import WorkspacePremiumRoundedIcon from "@mui/icons-material/WorkspacePremiumRounded";
import {
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
import { GithubRepoAccessSection } from "../../features/integrations/components/GithubRepoAccessSection";
import { ReconnectGoogleCalendarButton } from "../../features/integrations/components/ReconnectGoogleCalendarButton";
import { OAUTH_INTEGRATIONS_ENABLED } from "../../features/integrations/featureFlags";
import { listCalendars } from "../../features/integrations/services/calendar";
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
import { useQuickReactionsPreference } from "../../hooks/common/useQuickReactionsPreference";
import { useSpotlightPreferences } from "../../hooks/common/useSpotlightPreferences";
import { ThemePreference, useThemePreference } from "../../hooks/common/useThemePreference";
import { fmt, Locale, useTranslation } from "../../i18n";
import { SubscriptionTier } from "../../services/agentApi";
import { NotificationSettingsPanel } from "../../services/notifications/NotificationSettingsPanel";
import { useColorTheme } from "../../theme/ColorThemeProvider";
import { THEME_IDS, themeSwatch } from "../../theme/themePalettes";
import { getServiceShortcutModifierKeys, isMac } from "../../utils/platform";
import { AppTooltip } from "../ui/AppTooltip";
import { EmojiGlyph } from "../ui/emoji/EmojiGlyph";
import { EmojiPicker } from "../ui/emoji/EmojiPicker";
import { MentionGroupsPanel } from "./MentionGroupsPanel";
import { CreditUsageSection } from "./settings/CreditBalance";
import { PlanUsageSection } from "./settings/PlanUsageSection";
import { TeamEmojiPanel } from "./TeamEmojiPanel";

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

/**
 * Color-theme swatches. Each dot is painted with the accent that theme
 * actually renders in the CURRENT light/dark mode, so what you see on the
 * dot is what you get when you pick it.
 *
 * Selecting writes `data-theme` on `<html>` — the whole app repaints with
 * no reload and no re-render (see `theme/ColorThemeProvider`).
 */
const ColorThemeRow = () => {
    const { themeId, setThemeId } = useColorTheme();
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";

    return (
        <Stack alignItems="center" direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
            {THEME_IDS.map((id) => {
                const selected = id === themeId;
                return (
                    <AppTooltip key={id} size="sm" title={t.settings.appearance.colorThemes[id]}>
                        <IconButton
                            aria-label={t.settings.appearance.colorThemes[id]}
                            aria-pressed={selected}
                            size="sm"
                            variant="plain"
                            sx={{
                                width: 32,
                                height: 32,
                                borderRadius: "50%",
                                padding: 0,
                                minWidth: 0,
                                // Selected state is a ring around the dot
                                // rather than a checkmark on top of it — the
                                // swatch stays legible at 20px.
                                boxShadow: selected
                                    ? `0 0 0 2px var(--joy-palette-background-surface), 0 0 0 4px ${themeSwatch(id, isDark)}`
                                    : "none",
                                "&:hover": { backgroundColor: "transparent" },
                            }}
                            onClick={() => setThemeId(id)}
                        >
                            <Box
                                sx={{
                                    width: 20,
                                    height: 20,
                                    borderRadius: "50%",
                                    backgroundColor: themeSwatch(id, isDark),
                                    border: "1px solid",
                                    borderColor: isDark
                                        ? "rgba(255,255,255,0.18)"
                                        : "rgba(0,0,0,0.14)",
                                }}
                            />
                        </IconButton>
                    </AppTooltip>
                );
            })}
        </Stack>
    );
};

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

            <Divider sx={{ my: 1.5 }} />

            <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={2}>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography level="title-sm">
                        {t.settings.appearance.colorThemeLabel}
                    </Typography>
                    <Typography level="body-xs">
                        {t.settings.appearance.colorThemeHelper}
                    </Typography>
                </Box>
                <ColorThemeRow />
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

/**
 * Settings → Chat → the three one-click reaction emoji shown when hovering
 * a chat message, thread reply, or task comment. Slack-style: each slot is
 * a button that opens the full emoji picker and replaces just that slot.
 *
 * Team custom emoji are selectable (`includeCustom` defaults on in
 * `EmojiPicker`), which is why the slots render through `EmojiGlyph` — a
 * custom pick is stored as its ":name:" shortcode and has to resolve to
 * the image here exactly as it does on the bubbles.
 */
const QuickReactionsSection = () => {
    const { emojis, setEmojiAt, reset } = useQuickReactionsPreference();
    const { t } = useTranslation();
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    // Which slot the picker is currently editing; null = picker closed.
    const [editingSlot, setEditingSlot] = useState<number | null>(null);
    // `HTMLElement`, not `HTMLButtonElement` — Joy's Button is polymorphic
    // and types its ref as the anchor variant. Only `getBoundingClientRect`
    // is read off it.
    const slotRefs = useRef<Array<HTMLElement | null>>([]);
    // Fixed-position coordinates for the picker, computed off the clicked
    // slot so it opens anchored to that button rather than at a constant
    // offset (the modal itself scrolls).
    const [pickerPos, setPickerPos] = useState<{ top: number; left: number } | null>(null);

    const openPicker = (index: number) => {
        const anchor = slotRefs.current[index];
        if (anchor) {
            const rect = anchor.getBoundingClientRect();
            const pickerHeight = 435;
            const pickerWidth = 352;
            // Prefer below the slot; flip above when there isn't room, and
            // clamp horizontally so the picker never leaves the viewport.
            const top =
                window.innerHeight - rect.bottom > pickerHeight + 20
                    ? rect.bottom + 8
                    : Math.max(20, rect.top - pickerHeight - 8);
            const left = Math.max(20, Math.min(rect.left, window.innerWidth - pickerWidth - 20));
            setPickerPos({ top, left });
        }
        setEditingSlot(index);
    };

    return (
        <Sheet sx={{ p: 2, borderRadius: "lg" }} variant="outlined">
            <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 0.5 }}>
                <EmojiEmotionsRoundedIcon />
                <Typography level="title-md">{t.settings.quickReactions.heading}</Typography>
            </Stack>
            <Typography level="body-xs" sx={{ mb: 1.5 }}>
                {t.settings.quickReactions.description}
            </Typography>

            <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={2}>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography level="title-sm">{t.settings.quickReactions.label}</Typography>
                    <Typography level="body-xs">{t.settings.quickReactions.helper}</Typography>
                </Box>
                <Stack alignItems="center" direction="row" spacing={1}>
                    {emojis.map((emoji, index) => (
                        <AppTooltip
                            key={`quick-reaction-slot-${index}`}
                            size="sm"
                            title={t.settings.quickReactions.slotTooltip}
                        >
                            <Button
                                ref={(el) => {
                                    slotRefs.current[index] = el;
                                }}
                                size="sm"
                                variant="outlined"
                                sx={{
                                    minWidth: 44,
                                    height: 40,
                                    fontSize: "20px",
                                    lineHeight: 1,
                                    borderRadius: "md",
                                    "&:hover": {
                                        backgroundColor: isDark ? "#3730a3" : "#e0e7ff",
                                    },
                                }}
                                onClick={() => openPicker(index)}
                            >
                                <EmojiGlyph emoji={emoji} size={22} />
                            </Button>
                        </AppTooltip>
                    ))}
                    <Button size="sm" variant="plain" onClick={reset}>
                        {t.settings.quickReactions.reset}
                    </Button>
                </Stack>
            </Stack>

            {editingSlot !== null && pickerPos !== null && (
                <EmojiPicker
                    pickerLeftPosition={pickerPos.left}
                    pickerRightPosition="auto"
                    pickerTopPosition={pickerPos.top}
                    setSelectedEmoji={(emoji: string | null) => {
                        // The picker also fires `null` on click-outside —
                        // only a real pick should overwrite the slot.
                        if (emoji) setEmojiAt(editingSlot, emoji);
                    }}
                    setShowEmojiPicker={(open: boolean) => {
                        if (!open) setEditingSlot(null);
                    }}
                    showEmojiPicker={true}
                    useFixedPosition={true}
                />
            )}
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

// Tier badge styling as a complete Record<SubscriptionTier, …>: the
// compiler now forces a new tier to get a hue, where the previous
// ternary chains silently fell through — `core` rendered as "Free"
// until someone noticed. Same lesson as PlansHome's tier maps.
const TIER_BADGE_COLOR: Record<SubscriptionTier, { bg: string; fg: string }> = {
    free: { bg: "neutral.softBg", fg: "neutral.softColor" },
    core: { bg: "primary.softBg", fg: "primary.softColor" },
    pro: { bg: "primary.softBg", fg: "primary.softColor" },
    max: { bg: "success.softBg", fg: "success.softColor" },
    enterprise: { bg: "warning.softBg", fg: "warning.softColor" },
};

const tierBadgeLabel = (tier: string, t: ReturnType<typeof useTranslation>["t"]): string => {
    const labels: Record<SubscriptionTier, string> = {
        free: t.settings.llmModel.tierFree,
        core: t.settings.llmModel.tierCore,
        pro: t.settings.llmModel.tierPro,
        max: t.settings.llmModel.tierMax,
        enterprise: t.settings.llmModel.tierEnterprise,
    };
    // An unknown tier string (future server ahead of this client) falls
    // back to the raw value rather than mislabeling it as Free.
    return labels[tier as SubscriptionTier] ?? tier;
};

// Exported so the Spotlight overlay's dedicated settings modal
// (`features/spotlight/SpotlightSettingsModal`) can reuse the exact same
// model-picker without threading any props — the section is self-contained
// (reads `useLlmModelPreference` internally). Keeping one implementation
// means the Gemini/Claude catalog + usage rows can't drift between the two
// surfaces.
export const LlmModelSection = () => {
    const { data, loading, setChoice, setEffort } = useLlmModelPreference();
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

    // Effort mode iff the payload carries `efforts` (backend flag on).
    // Payload-shape driven — no FE flag — so either side can deploy
    // first and this section renders whatever the server supports.
    const effortMode = Boolean(data.efforts && data.efforts.length > 0);
    // Same payload-shape convention: `credits` is present iff the
    // backend runs credits as the authoritative limit.
    const creditsMode = Boolean(data.credits);
    // Fallback mirrors the backend's DEFAULT_EFFORT ("low") — only hit
    // when `current.effort` is missing from an older payload.
    const currentEffort = data.current.effort || "low";
    const effortsForProvider = (data.efforts ?? []).filter((e) => e.provider === currentProvider);
    const effortLabel = (e: string) =>
        e === "low"
            ? t.settings.llmModel.effortLow
            : e === "high"
              ? t.settings.llmModel.effortHigh
              : t.settings.llmModel.effortMedium;
    const effortNote = (e: string) =>
        e === "low"
            ? t.settings.llmModel.effortLowNote
            : e === "high"
              ? t.settings.llmModel.effortHighNote
              : t.settings.llmModel.effortMediumNote;

    const providerLabel = (p: string) => {
        if (p === "gemini") return t.settings.llmModel.providerGemini;
        if (p === "claude") return t.settings.llmModel.providerClaude;
        if (p === "openai") return t.settings.llmModel.providerOpenai;
        // Fall back to the raw id rather than hiding the option — a
        // provider the server serves but we have no label for should
        // still be selectable.
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
                        // Tier ladder: free=neutral, core/pro=primary,
                        // max=success, enterprise=warning. Distinct hues
                        // so the upgrade ladder is visually obvious
                        // without reading the label. Maps, not ternary
                        // chains — the old chains predated `core` and
                        // silently rendered a core user as "Free".
                        bgcolor:
                            TIER_BADGE_COLOR[data.tier as SubscriptionTier]?.bg ??
                            "neutral.softBg",
                        color:
                            TIER_BADGE_COLOR[data.tier as SubscriptionTier]?.fg ??
                            "neutral.softColor",
                        fontWeight: 600,
                    }}
                >
                    {tierBadgeLabel(data.tier, t)}
                </Typography>
            </Stack>
            <Typography level="body-xs" sx={{ mb: 1.5 }}>
                {/* The legacy copy promises "a separate daily quota per
                    model" — untrue once credits rule, since the
                    per-model caps stop being enforced. */}
                {creditsMode
                    ? t.settings.llmModel.creditsDescription
                    : t.settings.llmModel.description}
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
                        if (effortMode) {
                            // Effort carries across providers verbatim:
                            // "Gemini, High" → "Claude, High" is the
                            // least-surprise reading of a provider swap.
                            void setEffort(value, currentEffort);
                            return;
                        }
                        // Legacy: when the provider changes, default to
                        // that provider's first model in the catalog
                        // rather than leaving the previous (now-invalid)
                        // model selected — the backend resolver would
                        // fall back to the server default in that case,
                        // but the picker would visually drift.
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

            {effortMode ? (
                <Stack
                    alignItems="center"
                    direction="row"
                    justifyContent="space-between"
                    spacing={2}
                    sx={{ mb: 1.5 }}
                >
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography level="title-sm">{t.settings.llmModel.effortLabel}</Typography>
                        {/* The selected effort's description doubles as
                            the helper line — this is the "diff of
                            effort" the user reads to pick. */}
                        <Typography level="body-xs">{effortNote(currentEffort)}</Typography>
                    </Box>
                    <Select
                        size="sm"
                        sx={{ minWidth: 180 }}
                        value={currentEffort}
                        onChange={(_e, value) => {
                            if (!value || typeof value !== "string") return;
                            void setEffort(currentProvider, value);
                        }}
                    >
                        {(["low", "medium", "high"] as const).map((e) => (
                            <Option key={e} value={e}>
                                <Typography level="body-sm">{effortLabel(e)}</Typography>
                            </Option>
                        ))}
                    </Select>
                </Stack>
            ) : (
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
            )}

            <Divider sx={{ my: 1.5 }} />

            {/* Credits authoritative -> the balance IS the limit, and
                every daily row below describes a cap the server no
                longer enforces. Showing both would present two limits
                when only one applies, so this REPLACES them rather than
                joining them. Payload-shape switch: `credits` is served
                only when the backend enforces it. */}
            {creditsMode ? (
                <CreditUsageSection credits={data.credits!} tier={data.tier} />
            ) : (
                <>
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
                        {/* Per-EFFORT usage rows when the backend runs effort
                    levels ("High: 2/4 today") — the counters are the
                    mapped model's, re-labeled by what the user actually
                    picks. Legacy per-model rows otherwise. Either way,
                    current provider only — other providers' counters
                    would be noise behind a dropdown switch. */}
                        {effortMode &&
                            effortsForProvider.map((e) => (
                                <Stack
                                    key={`${e.provider}-${e.effort}`}
                                    alignItems="center"
                                    direction="row"
                                    justifyContent="space-between"
                                    spacing={1}
                                >
                                    <Typography level="body-sm">
                                        {effortLabel(e.effort)}
                                    </Typography>
                                    <Typography level="body-sm" sx={{ color: "text.tertiary" }}>
                                        {e.daily_limit === null
                                            ? t.settings.llmModel.usageUnlimited
                                            : `${e.used_today} / ${e.daily_limit}`}
                                    </Typography>
                                </Stack>
                            ))}
                        {!effortMode &&
                            modelsForProvider.map((m) => (
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
                </>
            )}
        </Sheet>
    );
};

// Exported for reuse by the Spotlight overlay's dedicated settings modal —
// see the note on `LlmModelSection`. Also self-contained (reads
// `useSpotlightPreferences` internally).
export const SpotlightSection = () => {
    const { aiAnswers, webSearch, setAiAnswers, setWebSearch } = useSpotlightPreferences();
    const { t } = useTranslation();

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
    // The connection probe above only reads DB scopes, which stay intact
    // when the refresh token is revoked/expired. `needsReconnect` is set
    // by a live probe so a dead token surfaces a reconnect prompt instead
    // of a silently dead toggle (and a backfill that reports "Synced 0").
    const [needsReconnect, setNeedsReconnect] = useState(false);
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

    // Live health probe: only the connection probe above can't tell a
    // dead refresh token from a healthy one (both keep the DB scope), so
    // make one lightweight Calendar call when the account looks ready. A
    // `google_reauth_required` return flips on the reconnect prompt.
    useEffect(() => {
        if (!accessToken || googleConnected !== true || calendarAuthorized !== true) {
            setNeedsReconnect(false);
            return;
        }
        let cancelled = false;
        (async () => {
            const res = await listCalendars(accessToken);
            if (cancelled) return;
            if (res === "google_reauth_required") {
                setNeedsReconnect(true);
                return;
            }
            if (!res || typeof res === "string") {
                setNeedsReconnect(false);
                return;
            }
            // Multi-account: the endpoint only returns the bare
            // `google_reauth_required` discriminator when EVERY account
            // is dead. This setting drives task auto-sync, which is
            // pinned to the default account (server-side: login
            // identity, else oldest — the first entry returned), so a
            // healthy second account must not mask a dead default one.
            const defaultAccount = res.accounts.find((a) => a.is_primary) ?? res.accounts[0];
            setNeedsReconnect(
                !!defaultAccount &&
                    res.failed_accounts.some(
                        (f) =>
                            f.account_id === defaultAccount.id &&
                            f.reason === "google_reauth_required"
                    )
            );
        })();
        return () => {
            cancelled = true;
        };
    }, [accessToken, googleConnected, calendarAuthorized]);

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
    // connected without calendar scope, or connected with a dead token).
    const togglesDisabled =
        loading || googleConnected === false || calendarAuthorized === false || needsReconnect;

    let helperText: string = t.settings.autoSyncCalendar.toggleHelper;
    if (googleConnected === false) {
        helperText = t.settings.autoSyncCalendar.connectPrompt;
    } else if (calendarAuthorized === false) {
        helperText = t.settings.autoSyncCalendar.grantPrompt;
    } else if (needsReconnect) {
        helperText = t.settings.autoSyncCalendar.reconnectPrompt;
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
                        color="primary"
                        size="sm"
                        variant="solid"
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

            {/* Connected + scoped on paper, but the live probe found a
                dead refresh token → reconnect (re-runs the connect flow,
                minting a fresh token). Mutually exclusive with the grant
                block above (that needs scope; this needs a live token). */}
            {googleConnected === true &&
                calendarAuthorized === true &&
                needsReconnect &&
                accessToken && (
                    <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1.5 }}>
                        <ReconnectGoogleCalendarButton
                            accessToken={accessToken}
                            label={t.settings.autoSyncCalendar.reconnectButton}
                            size="sm"
                        />
                    </Stack>
                )}

            {enabled && googleConnected && calendarAuthorized && !needsReconnect && (
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
                            disabled={backfillRunning}
                            size="sm"
                            variant="outlined"
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
    | "planUsage"
    | "chat"
    | "tasks"
    | "spotlight"
    | "notifications"
    | "mentionGroups"
    | "customEmoji"
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
    const [githubConnected, setGithubConnected] = useState(false);

    // The repo-access panel is only meaningful once GitHub is connected —
    // before that the Connections rows above are the whole story, and an
    // empty "Repository access" card would just be noise.
    useEffect(() => {
        if (!accessToken) return;
        let cancelled = false;
        void listConnections(accessToken).then((res) => {
            if (cancelled) return;
            setGithubConnected(!!res?.connections.find((c) => c.provider === "github"));
        });
        return () => {
            cancelled = true;
        };
    }, [accessToken]);

    if (!accessToken) return null;
    return (
        <Stack spacing={2}>
            <ConnectionsSection accessToken={accessToken} />
            {/* Same panel the Integrations page shows, so "which repos can
                Genos see, and how do I add my new org" is answerable
                without leaving Settings. */}
            {githubConnected && <GithubRepoAccessSection accessToken={accessToken} />}
        </Stack>
    );
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
                    value={tab}
                    sx={{
                        // Sidebar tab list on the left, panel on the
                        // right. The Tabs component flexes children
                        // along its orientation, so a row layout drops
                        // out naturally once orientation flips.
                        bgcolor: "transparent",
                        gap: 2,
                    }}
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
                        <Tab sx={SIDEBAR_TAB_SX} value="general">
                            <SettingsRoundedIcon sx={SIDEBAR_TAB_ICON_SX} />
                            {t.settings.tabs.general}
                        </Tab>
                        <Tab sx={SIDEBAR_TAB_SX} value="planUsage">
                            <WorkspacePremiumRoundedIcon sx={SIDEBAR_TAB_ICON_SX} />
                            {t.settings.tabs.planUsage}
                        </Tab>
                        <Tab sx={SIDEBAR_TAB_SX} value="spotlight">
                            <AutoAwesomeRoundedIcon sx={SIDEBAR_TAB_ICON_SX} />
                            {t.settings.tabs.spotlight}
                        </Tab>
                        <Tab sx={SIDEBAR_TAB_SX} value="chat">
                            <ChatBubbleOutlineRoundedIcon sx={SIDEBAR_TAB_ICON_SX} />
                            {t.settings.tabs.chat}
                        </Tab>
                        <Tab sx={SIDEBAR_TAB_SX} value="tasks">
                            <PlaylistAddCheckRoundedIcon sx={SIDEBAR_TAB_ICON_SX} />
                            {t.settings.tabs.tasks}
                        </Tab>
                        <Tab sx={SIDEBAR_TAB_SX} value="notifications">
                            <NotificationsRoundedIcon sx={SIDEBAR_TAB_ICON_SX} />
                            {t.settings.tabs.notifications}
                        </Tab>
                        <Tab sx={SIDEBAR_TAB_SX} value="mentionGroups">
                            <GroupRoundedIcon sx={SIDEBAR_TAB_ICON_SX} />
                            {t.settings.tabs.mentionGroups}
                        </Tab>
                        <Tab sx={SIDEBAR_TAB_SX} value="customEmoji">
                            <EmojiEmotionsRoundedIcon sx={SIDEBAR_TAB_ICON_SX} />
                            {t.settings.tabs.customEmoji}
                        </Tab>
                        <Tab sx={SIDEBAR_TAB_SX} value="shortcuts">
                            <KeyboardRoundedIcon sx={SIDEBAR_TAB_ICON_SX} />
                            {t.settings.tabs.shortcuts}
                        </Tab>
                        {/* Feature-flagged so disabled deploys don't
                            show an empty tab. */}
                        {OAUTH_INTEGRATIONS_ENABLED && (
                            <Tab sx={SIDEBAR_TAB_SX} value="integrations">
                                <HubRoundedIcon sx={SIDEBAR_TAB_ICON_SX} />
                                {t.settings.tabs.integrations}
                            </Tab>
                        )}
                    </TabList>

                    <TabPanel sx={{ px: 0, py: 2 }} value="general">
                        <Stack spacing={2}>
                            <AppearanceSection />
                            <LanguageSection />
                            <PrivacySection />
                        </Stack>
                    </TabPanel>
                    <TabPanel sx={{ px: 0, py: 2 }} value="planUsage">
                        <Stack spacing={2}>
                            {/* "Compare plans" navigates to /workspace/plans;
                                close the modal so it doesn't sit on top. */}
                            <PlanUsageSection onNavigateAway={onClose} />
                        </Stack>
                    </TabPanel>
                    <TabPanel sx={{ px: 0, py: 2 }} value="spotlight">
                        <Stack spacing={2}>
                            <LlmModelSection />
                            <SpotlightSection />
                        </Stack>
                    </TabPanel>
                    <TabPanel sx={{ px: 0, py: 2 }} value="chat">
                        <Stack spacing={2}>
                            <MessageLayoutSection />
                            <QuickReactionsSection />
                            <DoubleClickTodoSection />
                        </Stack>
                    </TabPanel>
                    <TabPanel sx={{ px: 0, py: 2 }} value="tasks">
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
                    <TabPanel sx={{ px: 0, py: 2 }} value="notifications">
                        <Stack spacing={2}>
                            <NotificationSettingsPanel />
                        </Stack>
                    </TabPanel>
                    <TabPanel sx={{ px: 0, py: 2 }} value="mentionGroups">
                        <Stack spacing={2}>
                            {/* All five auxiliary props are needed to
                                render the panel's avatar rows. If any
                                call site forgets them, fall back to a
                                quiet placeholder rather than crash. */}
                            {myself && setMyself && useCM && useUISM ? (
                                <MentionGroupsPanel
                                    myself={myself}
                                    setMyself={setMyself}
                                    socket={socket ?? null}
                                    useCM={useCM}
                                    useTEM={useTEM}
                                    useUISM={useUISM}
                                />
                            ) : (
                                <Typography level="body-sm" sx={{ opacity: 0.7 }}>
                                    Loading…
                                </Typography>
                            )}
                        </Stack>
                    </TabPanel>
                    <TabPanel sx={{ px: 0, py: 2 }} value="customEmoji">
                        <Stack spacing={2}>
                            {myself ? (
                                <TeamEmojiPanel
                                    myself={myself}
                                    teamMemberProfiles={useTEM?.teamMemberProfiles ?? {}}
                                />
                            ) : (
                                <Typography level="body-sm" sx={{ opacity: 0.7 }}>
                                    Loading…
                                </Typography>
                            )}
                        </Stack>
                    </TabPanel>
                    <TabPanel sx={{ px: 0, py: 2 }} value="shortcuts">
                        <Stack spacing={2}>
                            <KeyboardShortcutsSection />
                        </Stack>
                    </TabPanel>
                    {OAUTH_INTEGRATIONS_ENABLED && (
                        <TabPanel sx={{ px: 0, py: 2 }} value="integrations">
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
