import { useMemo, useState } from "react";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import KeyboardRoundedIcon from "@mui/icons-material/KeyboardRounded";
import LanguageRoundedIcon from "@mui/icons-material/LanguageRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import PaletteRoundedIcon from "@mui/icons-material/PaletteRounded";
import PlaylistAddCheckRoundedIcon from "@mui/icons-material/PlaylistAddCheckRounded";
import PrivacyTipRoundedIcon from "@mui/icons-material/PrivacyTipRounded";
import SettingsBrightnessRoundedIcon from "@mui/icons-material/SettingsBrightnessRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import SortRoundedIcon from "@mui/icons-material/SortRounded";
import ViewStreamRoundedIcon from "@mui/icons-material/ViewStreamRounded";
import {
    Box,
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

import {
    isSortDirection,
    isSortField,
    SORT_FIELD_OPTIONS,
} from "../../features/tasks/utils/sortTask";
import { useAnalyticsPreferences } from "../../hooks/common/useAnalyticsPreferences";
import {
    BubbleStyle,
    useBubbleStylePreference,
} from "../../hooks/common/useBubbleStylePreference";
import { useDoubleClickTodoPreference } from "../../hooks/common/useDoubleClickTodoPreference";
import { useSpotlightPreferences } from "../../hooks/common/useSpotlightPreferences";
import { SortTier, useTaskSortPreferences } from "../../hooks/common/useTaskSortPreferences";
import { ThemePreference, useThemePreference } from "../../hooks/common/useThemePreference";
import { Locale, useTranslation } from "../../i18n";
import { NotificationSettingsPanel } from "../../services/notifications/NotificationSettingsPanel";
import { getServiceShortcutModifierKeys, isMac } from "../../utils/platform";

type Props = {
    open: boolean;
    onClose: () => void;
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

const SpotlightSection = () => {
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

// One row in the 2-tier sort UI. The user picks a field (or "none" to
// drop the tier) and a direction (asc/desc). When the field is "none"
// the direction Select is disabled — its value is irrelevant.
const SortTierRow = ({
    label,
    tier,
    onChange,
    /** Disable the entire row (used to grey out the secondary tier
     *  when no primary is selected). */
    disabled,
}: {
    label: string;
    tier: SortTier | undefined;
    onChange: (next: SortTier | null) => void;
    disabled?: boolean;
}) => {
    const { t } = useTranslation();
    const field = tier?.field ?? "none";
    const direction = tier?.direction ?? "asc";
    return (
        <Stack alignItems="center" direction="row" spacing={1} sx={{ minWidth: 0 }}>
            <Typography
                level="body-sm"
                sx={{ minWidth: 80, color: disabled ? "neutral.500" : undefined }}
            >
                {label}
            </Typography>
            <Select
                disabled={disabled}
                size="sm"
                sx={{ minWidth: 140 }}
                value={field}
                onChange={(_e, value) => {
                    if (value === "none") {
                        onChange(null);
                        return;
                    }
                    if (!isSortField(value)) return;
                    onChange({ field: value, direction });
                }}
            >
                <Option value="none">{t.settings.taskSort.fieldNone}</Option>
                {SORT_FIELD_OPTIONS.map((opt) => (
                    <Option key={opt.value} value={opt.value}>
                        {t.tasks.table.columns[opt.labelKey]}
                    </Option>
                ))}
            </Select>
            <Select
                disabled={disabled || tier == null}
                size="sm"
                sx={{ minWidth: 110 }}
                value={direction}
                onChange={(_e, value) => {
                    if (!isSortDirection(value)) return;
                    if (tier == null) return;
                    onChange({ field: tier.field, direction: value });
                }}
            >
                <Option value="asc">{t.settings.taskSort.directionAsc}</Option>
                <Option value="desc">{t.settings.taskSort.directionDesc}</Option>
            </Select>
        </Stack>
    );
};

// Helper: build a new tier array after a single row's edit. If the
// primary is cleared, the secondary collapses up (or also clears).
// If the secondary equals the new primary's field, drop it to avoid
// useless duplicate sorts.
const setTierAtIndex = (current: SortTier[], index: 0 | 1, next: SortTier | null): SortTier[] => {
    const primary = index === 0 ? next : (current[0] ?? null);
    let secondary = index === 1 ? next : (current[1] ?? null);
    if (primary && secondary && primary.field === secondary.field) {
        secondary = null;
    }
    if (!primary && secondary) {
        // No primary → promote secondary to primary so the user's
        // intent (sort by something) isn't silently lost.
        return [secondary];
    }
    const result: SortTier[] = [];
    if (primary) result.push(primary);
    if (secondary) result.push(secondary);
    return result;
};

const TaskSortSection = () => {
    const { sprintBoardSortTiers, setSprintBoardSortTiers, tableSortTiers, setTableSortTiers } =
        useTaskSortPreferences();
    const { t } = useTranslation();
    return (
        <Sheet sx={{ p: 2, borderRadius: "lg" }} variant="outlined">
            <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 0.5 }}>
                <SortRoundedIcon />
                <Typography level="title-md">{t.settings.taskSort.heading}</Typography>
            </Stack>
            <Typography level="body-xs" sx={{ mb: 1.5 }}>
                {t.settings.taskSort.description}
            </Typography>

            {/* Sprint board — up to 2 tiers, default = [] (no sort). */}
            <Box sx={{ mb: 1.5 }}>
                <Typography level="title-sm">{t.settings.taskSort.sprintBoardLabel}</Typography>
                <Typography level="body-xs" sx={{ mb: 1 }}>
                    {t.settings.taskSort.sprintBoardHelper}
                </Typography>
                <Stack spacing={1}>
                    <SortTierRow
                        label={t.settings.taskSort.primaryLabel}
                        tier={sprintBoardSortTiers[0]}
                        onChange={(next) =>
                            setSprintBoardSortTiers(setTierAtIndex(sprintBoardSortTiers, 0, next))
                        }
                    />
                    <SortTierRow
                        disabled={sprintBoardSortTiers.length === 0}
                        label={t.settings.taskSort.secondaryLabel}
                        tier={sprintBoardSortTiers[1]}
                        onChange={(next) =>
                            setSprintBoardSortTiers(setTierAtIndex(sprintBoardSortTiers, 1, next))
                        }
                    />
                </Stack>
            </Box>

            <Divider />

            {/* Task table — up to 2 tiers, default = [{priority, desc}]. */}
            <Box sx={{ mt: 1.5 }}>
                <Typography level="title-sm">{t.settings.taskSort.tableLabel}</Typography>
                <Typography level="body-xs" sx={{ mb: 1 }}>
                    {t.settings.taskSort.tableHelper}
                </Typography>
                <Stack spacing={1}>
                    <SortTierRow
                        label={t.settings.taskSort.primaryLabel}
                        tier={tableSortTiers[0]}
                        onChange={(next) =>
                            setTableSortTiers(setTierAtIndex(tableSortTiers, 0, next))
                        }
                    />
                    <SortTierRow
                        disabled={tableSortTiers.length === 0}
                        label={t.settings.taskSort.secondaryLabel}
                        tier={tableSortTiers[1]}
                        onChange={(next) =>
                            setTableSortTiers(setTierAtIndex(tableSortTiers, 1, next))
                        }
                    />
                </Stack>
            </Box>
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
type SettingsTabKey = "general" | "chat" | "tasks" | "spotlight" | "notifications" | "shortcuts";

export const SettingsModal = ({ open, onClose }: Props) => {
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
                    width: { xs: "92vw", sm: 550, md: 700 },
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
                            // Fixed sidebar width keeps the panel area
                            // predictable across translated labels.
                            // The panel itself can scroll independently
                            // (ModalDialog handles overflow).
                            minWidth: 160,
                            flexShrink: 0,
                            // Drop the default underline indicator —
                            // vertical tabs read better with a left
                            // border on the active item, which Joy's
                            // theme handles for `orientation="vertical"`.
                            // Hide any horizontal-scroll affordance.
                            overflow: "visible",
                            scrollbarWidth: "none",
                        }}
                    >
                        <Tab value="general">{t.settings.tabs.general}</Tab>
                        <Tab value="chat">{t.settings.tabs.chat}</Tab>
                        <Tab value="tasks">{t.settings.tabs.tasks}</Tab>
                        <Tab value="spotlight">{t.settings.tabs.spotlight}</Tab>
                        <Tab value="notifications">{t.settings.tabs.notifications}</Tab>
                        <Tab value="shortcuts">{t.settings.tabs.shortcuts}</Tab>
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
                            <TaskSortSection />
                        </Stack>
                    </TabPanel>
                    <TabPanel value="spotlight" sx={{ px: 0, py: 2 }}>
                        <Stack spacing={2}>
                            <SpotlightSection />
                        </Stack>
                    </TabPanel>
                    <TabPanel value="notifications" sx={{ px: 0, py: 2 }}>
                        <Stack spacing={2}>
                            <NotificationSettingsPanel />
                        </Stack>
                    </TabPanel>
                    <TabPanel value="shortcuts" sx={{ px: 0, py: 2 }}>
                        <Stack spacing={2}>
                            <KeyboardShortcutsSection />
                        </Stack>
                    </TabPanel>
                </Tabs>
            </ModalDialog>
        </Modal>
    );
};
